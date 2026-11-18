"""Filtros de nivel posesión y bundles filtrados de equipo y jugador (T-03 con A-02…A-05).

Con algún filtro de posesión (`origin`, `ptype`, `chance`, `clock`, `clock_start`) las métricas se calculan agregando
las posesiones de A-01 (no el box): las del equipo en ataque y las del rival (el equipo en defensa) que cumplen el
mismo filtro, así el bundle tiene los dos lados (OER, DER, Net, OR%). `origin` y `ptype` actúan sobre la posesión;
`chance`, `clock` y `clock_start` sobre la OPORTUNIDAD (A-04 D-7, A-05 §4.8): con alguno de ellos la unidad es la
oportunidad y sus rebotes se asignan por estructura (como la entidad `chance`). Los filtros de evento (cuarto,
marcador, con/sin jugador) se evalúan con el estado al INICIO de cada posesión.

Sin filtros de posesión, el nivel evento del jugador sale de las rebanadas de `splits.py` (mismo criterio que el
equipo). Ambos caminos devuelven, por partido, las partes que suma el bundle del jugador: su box, el del equipo y el
rival en todas las unidades elegidas y en las que estuvo en cancha.

Nada se persiste: todo sale de `possessions.game_possessions` y `pbp_events` (cacheados).
"""
import config
import context as context_mod
import identity
import lineups
import possessions
import repository
from stats_engine import StatBundle

_BOX = lineups._BOX_KEYS


def _empty():
    return {k: 0 for k in _BOX}


def _add(dst, src):
    for k in _BOX:
        dst[k] += src.get(k, 0) or 0


# ── Predicados ───────────────────────────────────────────────────────────────

def _canon_ids(ids):
    if not ids:
        return None
    out = set()
    for i in ids:
        c = identity.canonical_id(i)
        out.add(c if c is not None else i)
    return out


def possession_pass(p, ctx, court_ids, close_margin) -> bool:
    """¿La posesión cumple origen, tipo y los filtros de evento (estado al inicio)? `court_ids`: jugadores del
    EQUIPO consultado en cancha (canónicos) o None."""
    if ctx.origin and (p.origin or "saque_banda") not in ctx.origin:
        return False
    if ctx.ptype and p.ptype not in ctx.ptype:
        return False
    if ctx.quarters:
        bucket = "pr" if p.period_type != "REGULAR" else str(p.period)
        if bucket not in ctx.quarters:
            return False
    if ctx.score:
        s = p.score_start
        margin = abs(s[0] - s[1]) if s and s[0] is not None and s[1] is not None else 0
        if ("ajustado" if margin <= close_margin else "paliza") != ctx.score:
            return False
    if ctx.on or ctx.off:
        if court_ids is None:
            return False
        if ctx.on and not set(ctx.on) <= court_ids:
            return False
        if ctx.off and set(ctx.off) & court_ids:
            return False
    return True


def chance_pass(ch, ctx) -> bool:
    if ctx.chance == "primera" and ch.n != 1:
        return False
    if ctx.chance == "segunda" and ch.n < 2:
        return False
    if ctx.clock and ch.band not in ctx.clock:
        return False
    if ctx.clock_start and str(ch.shot_clock_start) != ctx.clock_start:
        return False
    return True


# ── Unidades por partido ─────────────────────────────────────────────────────

def _poss_box(p):
    """(caja del equipo que ataca, caja del que defiende) de una posesión (cajas del motor A-01)."""
    a, d = _empty(), _empty()
    for dst, src in ((a, p.box), (d, p.opp_box)):
        for k in ("fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk", "pf",
                  "fouls_drawn"):
            dst[k] = src.get(k) or 0
        dst["fga"] = dst["fga2"] + dst["fga3"]
        dst["fgm"] = dst["fgm2"] + dst["fgm3"]
        dst["pts"] = 2 * dst["fgm2"] + 3 * dst["fgm3"] + dst["ftm"]
    return a, d


def _chance_spans(p, order, idx):
    """[(oportunidad, caja de quien ataca, caja de quien defiende, segundos, eventos)] con los rebotes por estructura
    (mismo criterio que `second_chance._chance_items`)."""
    out = []
    for k, ch in enumerate(p.chances):
        lo = idx.get(ch.start_event)
        if lo is None:
            continue
        nxt = p.chances[k + 1] if k + 1 < len(p.chances) else None
        if nxt is not None and nxt.start_event in idx:
            hi = idx[nxt.start_event]
        else:
            hi = idx[p.end_event] + 1 if p.end_event in idx else len(order)
        evs = order[lo:hi]
        span = [e for e in evs if e.get("action_type") != "rebound"]
        own, opp = lineups._agg(span, p.team), lineups._agg(span, p.opp)
        shots = [e for e in span if e.get("team_code") == p.team and e.get("action_type") in ("2pt", "3pt", "freethrow")]
        missed_last = bool(shots) and shots[-1].get("success") != 1
        own["orb"], own["drb"] = (1 if nxt is not None else 0), 0
        opp["orb"], opp["drb"] = 0, (1 if nxt is None and missed_last else 0)
        end_clock = nxt.start_clock if nxt is not None else p.end_clock
        secs = (ch.start_clock - end_clock if ch.start_clock is not None and end_clock is not None
                and ch.start_clock >= end_clock else 0)
        out.append((ch, own, opp, secs, evs))
    return out


def _poss_events(p, order, idx):
    lo, hi = idx.get(p.start_event), idx.get(p.end_event)
    if lo is None:
        return []
    return order[lo:(hi + 1 if hi is not None else len(order))]


def possession_units(g, team_code, ctx, close_margin):
    """Unidades (posesiones u oportunidades) del partido que cumplen el filtro, desde el punto de vista de `team_code`:
    `[(caja propia, caja rival, segundos, ids propios en cancha | None, eventos, es_ataque)]`."""
    chance_mode = context_mod.has_chance_filters(ctx)
    order = sorted(g.get("events") or [], key=lambda e: e.get("action_number") or 0)
    idx = {e.get("action_number"): i for i, e in enumerate(order)}
    out = []
    for p in possessions.game_possessions(g["game_id"]):
        if p.incomplete:
            continue
        if p.team == team_code:
            attack, court = True, _canon_ids(p.own_on_court)
        elif p.opp == team_code:
            attack, court = False, _canon_ids(p.opp_on_court)
        else:
            continue
        if not possession_pass(p, ctx, court, close_margin):
            continue
        if chance_mode:
            for ch, a, d, secs, evs in _chance_spans(p, order, idx):
                if chance_pass(ch, ctx):
                    own, opp = (a, d) if attack else (d, a)
                    out.append((own, opp, secs, court, evs, attack))
        else:
            a, d = _poss_box(p)
            own, opp = (a, d) if attack else (d, a)
            out.append((own, opp, p.duration or 0, court, _poss_events(p, order, idx), attack))
    return out


# ── Equipo ───────────────────────────────────────────────────────────────────

def _finish_box(own, opp):
    own["blk_received"], opp["blk_received"] = opp.get("blk", 0), own.get("blk", 0)
    own["plus_minus"] = own["pts"] - opp["pts"]
    opp["plus_minus"] = opp["pts"] - own["pts"]
    return own, opp


def _meta(team_code, ctx, all_rows, sin_pbp, extra=None):
    scoped = context_mod.filter_games(all_rows, context_mod.without_last(ctx), team_code)
    excluded = {"sin_pbp": sin_pbp} if sin_pbp else {}
    excluded.update(context_mod.rest_excluded(all_rows, ctx, team_code))
    name = next((r.get("team_name") for r in all_rows if r.get("team_name")), team_code)
    return name, {"team_code": team_code, "team_name": name, "split": True, "poss_exact": True,
                  "unit": "oportunidad" if context_mod.has_chance_filters(ctx) else "posesion",
                  "games_total": len(scoped), "games_excluded": excluded, **(extra or {})}


def team_bundle(team_code, comp_id, ctx):
    """`StatBundle` del equipo con filtros de posesión (y de evento); `None` si ninguna unidad cumple."""
    key = ("poss_team_bundle", team_code, comp_id, context_mod.context_key(ctx))
    return repository.memo(key, lambda: _team_bundle(team_code, comp_id, ctx))


def _team_bundle(team_code, comp_id, ctx):
    import splits
    games, all_rows, sin_pbp = splits._selection(team_code, comp_id, ctx)
    close = config.get("context.close_margin")
    own, opp = _empty(), _empty()
    seconds, n_att, n_def, used = 0.0, 0, 0, set()
    for g in games:
        for o, d, secs, _court, _evs, attack in possession_units(g, team_code, ctx, close):
            _add(own, o)
            _add(opp, d)
            seconds += secs
            used.add(g["game_id"])
            if attack:
                n_att += 1
            else:
                n_def += 1
    if not used:
        return None
    _finish_box(own, opp)
    name, meta = _meta(team_code, ctx, all_rows, sin_pbp, {"units_def": n_def, "game_ids": sorted(used)})
    return StatBundle(
        entity_type="split", entity_id=team_code, name=name, own=own, opp=opp, team=None,
        games=len(used), minutes=seconds / 60, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=n_att, null_reasons={}, meta=meta)


# ── Jugador ──────────────────────────────────────────────────────────────────

def _display_to_pid(team_code) -> dict:
    """{nombre de ficha → id canónico} del equipo (los eventos de `canonicalize_pbp_games` usan ese nombre)."""
    def build():
        from database import Player
        out = {}
        for p in Player.query.filter_by(team_code=team_code).all():
            cid = identity.canonical_id(p.id)
            if cid is not None and cid == p.id:
                out[p.display_name] = cid
        return out
    return repository.memo(("display_to_pid", team_code), build)


def _part():
    return {"own": _empty(), "oc_own": _empty(), "oc_opp": _empty(), "oc_secs": 0.0}


def _game_parts_from_units(units, team_code, n2p):
    """Unidades `(caja propia, caja rival, segundos, ids en cancha, eventos)` → partes del partido por jugador."""
    team, opp, secs = _empty(), _empty(), 0.0
    players: dict = {}
    for o, d, s, court, evs in units:
        _add(team, o)
        _add(opp, d)
        secs += s
        for pid in (court or ()):
            part = players.setdefault(pid, _part())
            _add(part["oc_own"], o)
            _add(part["oc_opp"], d)
            part["oc_secs"] += s
        by_name: dict = {}
        for ev in evs:
            if ev.get("team_code") == team_code and ev.get("player_name"):
                by_name.setdefault(ev["player_name"], []).append(ev)
        for name, pevs in by_name.items():
            pid = n2p.get(name)
            if pid is None:
                continue
            _add(players.setdefault(pid, _part())["own"], lineups._agg(pevs, team_code))
    return {"team": team, "opp": opp, "secs": secs, "players": players}


def team_player_parts(team_code, comp_id, ctx):
    """`{game_id: partes}` con los filtros de evento/posesión de `ctx` para TODOS los jugadores del equipo (un solo
    recorrido; cada jugador elige después sus partidos). Sin `last`: los últimos N son de cada jugador."""
    base_ctx = context_mod.without_last(ctx)
    key = ("poss_player_parts", team_code, comp_id, context_mod.context_key(base_ctx))
    return repository.memo(key, lambda: _team_player_parts(team_code, comp_id, base_ctx))


def _team_player_parts(team_code, comp_id, ctx):
    import splits
    games, _rows, _sin = splits._selection(team_code, comp_id, ctx)
    n2p = _display_to_pid(team_code)
    close = config.get("context.close_margin")
    out = {}
    if context_mod.has_possession_filters(ctx):
        for g in games:
            units = [(o, d, s, court, evs) for o, d, s, court, evs, _a in possession_units(g, team_code, ctx, close)]
            out[g["game_id"]] = _game_parts_from_units(units, team_code, n2p)
        return out
    on_names = splits._selected_names(team_code, ctx.on) if ctx.on else []
    off_names = splits._selected_names(team_code, ctx.off) if ctx.off else []
    for g in games:
        starters = lineups.game_starters(g["player_rows"], team_code)
        if starters is None:
            continue
        units = []
        for sl in splits.event_slices(g["events"], team_code, starters, close):
            if not splits._passes(sl, ctx, on_names, off_names):
                continue
            court = {n2p[n] for n in (sl["on_court"] or ()) if n in n2p} if sl["on_court"] is not None else None
            units.append((lineups._agg(sl["events"], team_code), lineups._agg(sl["events"], g["opp_code"]),
                          sl["seconds"], court, sl["events"]))
        out[g["game_id"]] = _game_parts_from_units(units, team_code, n2p)
    return out


def player_bundle(player_id, comp_id, ctx):
    """`StatBundle` del jugador con filtros de evento y/o posesión: su box dentro de las unidades elegidas y el del
    equipo con él en cancha; minutos = segundos en cancha dentro de la selección. `None` si no jugó ninguna unidad."""
    from stats_engine import played
    import bundles
    from bundles import player_derived
    card = identity.player_card(player_id)
    if card is None:
        return None
    pid, team_code = card["player_id"], card["team_code"]
    rows = bundles._rows_by_player(comp_id).get(pid, [])
    sel = [r for r in context_mod.filter_games([r for r in rows if played(r.get("minutes"))], ctx, team_code)]
    parts = team_player_parts(team_code, comp_id, ctx)
    own, team, opp, oc_own, oc_opp = _empty(), _empty(), _empty(), _empty(), _empty()
    oc_secs = all_secs = 0.0
    games, sin_pbp, derived_parts = [], 0, []
    for r in sel:
        gp = parts.get(r["game_id"])
        if gp is None:
            sin_pbp += 1
            continue
        mine = gp["players"].get(pid)
        if mine is None or mine["oc_secs"] <= 0:
            continue
        _add(own, mine["own"])
        _add(oc_own, mine["oc_own"])
        _add(oc_opp, mine["oc_opp"])
        oc_secs += mine["oc_secs"]
        _add(team, gp["team"])
        _add(opp, gp["opp"])
        all_secs += gp["secs"]
        derived_parts.append(player_derived(gp["team"], gp["opp"], mine["oc_secs"] / 60, gp["secs"] / 60 or 1))
        games.append(r["game_id"])
    if not games:
        return None
    _finish_box(team, opp)
    own["blk_received"] = None
    own["plus_minus"] = oc_own["pts"] - oc_opp["pts"]
    for b in (oc_own, oc_opp):
        b["blk_received"] = None
        b["plus_minus"] = None
    derived = {k: sum(d[k] for d in derived_parts if d.get(k) is not None) for k in derived_parts[0]}
    all_rows = [r for r in repository.team_game_rows(comp_id).values() if r["team_code"] == team_code]
    _name, meta = _meta(team_code, ctx, all_rows, sin_pbp,
                        {"game_ids": games, "player_split": True,
                         "unit": ("oportunidad" if context_mod.has_chance_filters(ctx)
                                  else "posesion" if context_mod.has_possession_filters(ctx) else "evento")})
    meta["poss_exact"] = context_mod.has_possession_filters(ctx)
    meta["games_total"] = len([r for r in context_mod.filter_games(rows, context_mod.without_last(ctx), team_code)
                               if played(r.get("minutes"))])
    meta["team_name"] = card.get("team_name") or meta["team_name"]
    on_court = {"games_exact": len(games), "games_estimated": 0, "poss_estimated": 0.0,
                "own": oc_own, "opp": oc_opp, "seconds": oc_secs}
    minutes = oc_secs / 60
    return StatBundle(
        entity_type="player", entity_id=pid, name=card["display_name"], own=own, opp=opp, team=team,
        games=len(games), minutes=minutes, team_minutes=all_secs / 60 * 5, seconds=oc_secs,
        on_court=on_court, shots=None, possessions_counted=None, null_reasons={}, derived=derived, meta=meta)
