"""Producción desde eventos (A-07): la consecuencia en puntos de cada asistencia, rebote ofensivo, rebote defensivo, robo y
pérdida, para un equipo o un jugador. Todo sale de las posesiones de A-01 (con origen, tipo, oportunidades y finalizador ya
asignados); aquí solo se vinculan y se agrupan. Las posesiones incompletas quedan fuera de los desenlaces y se informan aparte.
El horizonte de la consecuencia es una posesión: la que sigue al evento. FIBA no publica los pases: el primer pase de salida
es `no_registrado`.
"""
from collections import Counter

import cache
import context as context_mod
import identity
import origin as origin_mod
import possessions
import repository
import sample
from context import context_key
from database import TeamGameStats

BLOCKS = ("assists", "oreb", "dreb", "steals", "turnovers")
PASS_OUT = {"value": None, "reason": "no_registrado", "note": "FIBA no registra los pases de salida."}


class EventsError(Exception):
    def __init__(self, status: int, message: str, code: str = "parametro_invalido"):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code

    def payload(self) -> dict:
        return {"error": self.message, "code": self.code}


def _m(num, den, *, nd=4):
    return {"value": round(num / den, nd), "reason": None} if den else {"value": None, "reason": "sin_intentos"}


def _canon(pid):
    return (identity.canonical_id(pid) or pid) if pid is not None else None


def _name(pid):
    card = identity.player_card(pid) if pid is not None else None
    return card["display_name"] if card else (f"Jugador {pid}" if pid is not None else None)


def _fg_kind(p):
    """doble, triple o 2+1 (canasta de campo con tiro libre adicional) de una posesión con canasta."""
    made = [s for s in p.shots if s.get("made")]
    if not made:
        return None
    if (p.box.get("fta") or 0) > 0:
        return "mas1"
    return "triple" if made[-1].get("three") else "doble"


def _result(p):
    """Desenlace de una posesión: doble, triple, falta recibida, pérdida posterior o sin conversión."""
    e = p.end_type
    if e == "t2c":
        return "doble"
    if e == "t3c":
        return "triple"
    if e == "falta":
        return "falta"
    if e == "perdida":
        return "perdida"
    return "sin_conversion"


# ── Recolección (memoizada por selección) ────────────────────────────────────

def _collect(team, comp_id, ctx):
    def build():
        games, total, excluded = origin_mod._games_for(team, comp_id, ctx)
        recs = {"assists": [], "oreb": [], "dreb": [], "steals": [], "turnovers": []}
        pbp = Counter()
        incomplete = Counter()
        all_poss = 0
        all_pts = 0
        pts_tov_games = []
        fallback = 0
        import assists as assists_mod
        from database import Game
        old = {gm.game_id for gm in Game.query.filter(Game.game_id.in_([g["game_id"] for g in games])).all()
               if (gm.ingest_version or 1) < assists_mod.LINK_INGEST_VERSION}
        for g in games:
            for e in g["events"]:
                if e.get("team_code") != team:
                    continue
                at, st = e.get("action_type"), (e.get("sub_type") or "").lower()
                if at == "assist":
                    pbp["assists"] += 1
                elif at == "steal":
                    pbp["steals"] += 1
                elif at == "turnover":
                    pbp["turnovers"] += 1
                elif at == "rebound" and "defensive" in st:
                    pbp["dreb"] += 1
                elif at == "rebound" and "offensive" in st:
                    pbp["oreb"] += 1
            plist = possessions.game_possessions(g["game_id"])
            conceded, gap = 0, False
            for i, p in enumerate(plist):
                if p.team != team:
                    continue
                if p.incomplete:
                    incomplete["any"] += 1
                    gap = True
                    if p.assister_id is not None:
                        incomplete["assists"] += 1
                    if p.origin == "robo":
                        incomplete["steals"] += 1
                    if p.turnover_by_id is not None or p.end_type == "perdida":
                        incomplete["turnovers"] += 1
                    continue
                all_poss += 1
                all_pts += p.pts
                if p.assister_id is not None and any(s.get("made") for s in p.shots):
                    recs["assists"].append({"assister": _canon(p.assister_id), "receiver": _canon(p.finisher_id), "kind": _fg_kind(p), "pts": p.pts, "game": g["game_id"]})
                    if g["game_id"] in old:
                        # partido importado sin `previous_action`: la asistencia se vinculó solo por proximidad (CA-15)
                        fallback += 1
                for ch in p.chances:
                    if ch.n >= 2:
                        cat = {"putback": "putback", "falta_recibida": "falta", "perdida": "perdida", "sin_puntos": "sin_puntos"}.get(ch.outcome)
                        if cat is None:
                            cat = "triple" if ch.end_type == "t3c" else "doble"
                        recs["oreb"].append({"player": _canon(ch.rebounder_id), "cat": cat, "pts": ch.pts or 0, "game": g["game_id"]})
                if p.origin == "rebote_defensivo":
                    recs["dreb"].append({"player": _canon(p.starter_id), "trans": p.ptype == "transicion", "pts": p.pts, "game": g["game_id"]})
                if p.origin == "robo":
                    recs["steals"].append({"player": _canon(p.starter_id), "cat": _result(p), "pts": p.pts, "game": g["game_id"]})
                if p.end_type == "perdida":
                    nxt = plist[i + 1] if i + 1 < len(plist) else None
                    r = {"player": _canon(p.turnover_by_id), "game": g["game_id"], "pts": 0, "cat": "sin_posesion_siguiente"}
                    if nxt is not None and nxt.team != team and nxt.period == p.period:
                        if nxt.incomplete:
                            r["cat"] = "posesion_incompleta"
                            incomplete["turnover_next"] += 1
                        else:
                            r["pts"] = nxt.pts
                            res = _result(nxt)
                            r["cat"] = res if res in ("doble", "triple", "falta") else "sin_castigo"
                            conceded += nxt.pts
                    recs["turnovers"].append(r)
            row = TeamGameStats.query.filter_by(game_id=g["game_id"], team_code=g["opp_code"]).first()
            box = getattr(row, "pts_from_tov", None) if row is not None else None
            pts_tov_games.append({"game_id": g["game_id"], "computed": conceded, "box": box, "gap": gap})
        return {"recs": recs, "pbp": dict(pbp), "incomplete": dict(incomplete), "poss": all_poss, "pts": all_pts,
                "games_used": len(games), "games_total": total, "excluded": excluded, "pts_tov": pts_tov_games,
                "link_fallback": fallback}
    return cache.memo("events:collect", (team, comp_id, context_key(ctx)), build)


# ── Bloques ──────────────────────────────────────────────────────────────────

def _badge(n, games):
    return sample.sample_level("split", n=n, unit="eventos", games=games)


def _assists(recs, pid, games, pbp, incomplete, team_mode):
    rs = [r for r in recs if pid is None or r["assister"] == pid]
    n = len(rs)
    pts = sum(r["pts"] for r in rs)
    kinds = {k: {"count": sum(1 for r in rs if r["kind"] == k), "points": sum(r["pts"] for r in rs if r["kind"] == k)} for k in ("doble", "triple", "mas1")}
    for k in kinds.values():
        k["share"] = _m(k["count"], n)
    rec = Counter(r["receiver"] for r in rs if r["receiver"] is not None)
    top = None
    if rec:
        best = sorted(rec.items(), key=lambda kv: (-kv[1], _name(kv[0]) or ""))[0]
        top = {"id": best[0], "name": _name(best[0]), "count": best[1], "points": sum(r["pts"] for r in rs if r["receiver"] == best[0])}
    out = {"events": n, "points": pts, "points_per_assist": _m(pts, n), "kinds": kinds, "top_receiver": top, "sample": _badge(n, games)}
    if team_mode:
        pair = Counter((r["assister"], r["receiver"]) for r in rs if r["assister"] is not None and r["receiver"] is not None)
        if pair:
            (a, b), c = sorted(pair.items(), key=lambda kv: (-kv[1], _name(kv[0][0]) or "", _name(kv[0][1]) or ""))[0]
            out["top_pair"] = {"assister": _name(a), "receiver": _name(b), "count": c}
        out["reconcile"] = {"pbp": pbp.get("assists", 0), "linked": n, "incomplete": incomplete.get("assists", 0),
                            "unlinked": max(0, pbp.get("assists", 0) - n - incomplete.get("assists", 0))}
        out["reconcile"]["ok"] = out["reconcile"]["linked"] + out["reconcile"]["unlinked"] + out["reconcile"]["incomplete"] == out["reconcile"]["pbp"]
    else:
        out["by_kind_ok"] = sum(k["count"] for k in kinds.values()) == n
    return out


OREB_CATS = ("putback", "doble", "triple", "falta", "perdida", "sin_puntos")


def _oreb(recs, pid, games, pbp, team_mode):
    rs = [r for r in recs if (pid is None or r["player"] == pid)]
    n = len(rs)
    pts = sum(r["pts"] for r in rs)
    cats = {c: {"count": sum(1 for r in rs if r["cat"] == c), "points": sum(r["pts"] for r in rs if r["cat"] == c)} for c in OREB_CATS}
    for c in cats.values():
        c["share"] = _m(c["count"], n)
        c["ppp"] = _m(c["points"], c["count"])
    out = {"events": n, "points": pts, "points_per_oreb": _m(pts, n), "conversion": _m(sum(1 for r in rs if r["pts"] > 0), n), "outcomes": cats, "sample": _badge(n, games)}
    if team_mode:
        out["team_rebounds"] = sum(1 for r in recs if r["player"] is None)
        out["reconcile"] = {"pbp": pbp.get("oreb", 0), "classified": n, "ok": sum(c["count"] for c in cats.values()) == n}
    return out


def _dreb(recs, pid, games, pbp, team_mode):
    rs = [r for r in recs if (pid is None or r["player"] == pid)]
    n = len(rs)
    trans = [r for r in rs if r["trans"]]
    out = {"events": n, "counterattacks": {"count": len(trans), "share": _m(len(trans), n)},
           "counterattack_scores": {"count": sum(1 for r in trans if r["pts"] > 0), "share": _m(sum(1 for r in trans if r["pts"] > 0), len(trans))},
           "points": sum(r["pts"] for r in rs), "points_in_transition": sum(r["pts"] for r in trans),
           "ppp": _m(sum(r["pts"] for r in rs), n), "first_pass": PASS_OUT, "sample": _badge(n, games)}
    if team_mode:
        out["team_rebounds"] = sum(1 for r in recs if r["player"] is None)
        out["pbp"] = pbp.get("dreb", 0)
    return out


STEAL_CATS = ("doble", "triple", "falta", "perdida", "sin_conversion")


def _steals(recs, pid, games, pbp, incomplete, team_mode, poss, pts):
    rs = [r for r in recs if (pid is None or r["player"] == pid)]
    n = len(rs)
    cats = {c: {"count": sum(1 for r in rs if r["cat"] == c), "points": sum(r["pts"] for r in rs if r["cat"] == c)} for c in STEAL_CATS}
    for c in cats.values():
        c["share"] = _m(c["count"], n)
    out = {"events": n, "points": sum(r["pts"] for r in rs), "points_per_steal": _m(sum(r["pts"] for r in rs), n), "outcomes": cats,
           "ppp_after_steal": _m(sum(r["pts"] for r in rs), n), "ppp_all": _m(pts, poss), "sample": _badge(n, games)}
    if team_mode:
        out["reconcile"] = {"pbp": pbp.get("steals", 0), "linked": n, "incomplete": incomplete.get("steals", 0),
                            "unlinked": max(0, pbp.get("steals", 0) - n - incomplete.get("steals", 0))}
        out["reconcile"]["ok"] = sum(c["count"] for c in cats.values()) == n
    return out


TOV_CATS = ("doble", "triple", "falta", "sin_castigo", "sin_posesion_siguiente", "posesion_incompleta")


def _turnovers(recs, pid, games, pbp, incomplete, team_mode):
    rs = [r for r in recs if (pid is None or r["player"] == pid)]
    n = len(rs)
    cats = {c: {"count": sum(1 for r in rs if r["cat"] == c), "points": sum(r["pts"] for r in rs if r["cat"] == c)} for c in TOV_CATS}
    with_next = [r for r in rs if r["cat"] in ("doble", "triple", "falta", "sin_castigo")]
    punished = sum(1 for r in with_next if r["pts"] > 0)
    pts = sum(r["pts"] for r in with_next)
    for c in cats.values():
        c["share"] = _m(c["count"], n)
    out = {"events": n, "with_next_possession": len(with_next), "points_conceded": pts, "cost_per_turnover": _m(pts, len(with_next)),
           "punished": {"count": punished, "share": _m(punished, len(with_next))}, "outcomes": cats, "sample": _badge(n, games)}
    if team_mode:
        out["team_turnovers"] = sum(1 for r in recs if r["player"] is None)
        inc = incomplete.get("turnovers", 0)
        out["reconcile"] = {"pbp": pbp.get("turnovers", 0), "linked": n, "incomplete": inc, "unlinked": max(0, pbp.get("turnovers", 0) - n - inc),
                            "ok": sum(c["count"] for c in cats.values()) == n}
    return out


def _tov_control(rows):
    """Puntos tras pérdida (calculados) contra `pts_from_tov` del rival en el box oficial."""
    diff = []
    for r in rows:
        if r["box"] is None:
            diff.append({"game_id": r["game_id"], "reason": "no_registrado"})
        elif abs(r["box"] - r["computed"]) > 0:
            diff.append({"game_id": r["game_id"], "computed": r["computed"], "box": r["box"],
                         "cause": "posesion_incompleta" if r["gap"] else "criterio_fiba"})
    return {"games": len(rows), "differing": diff}


def events_production(entity, ident, comp_id, ctx):
    key = (entity, str(ident), comp_id, context_key(ctx))
    return cache.memo("events:report", key, lambda: _build(entity, ident, comp_id, ctx))


def _build(entity, ident, comp_id, ctx):
    if entity == "team":
        team, pid, name = str(ident).upper(), None, str(ident).upper()
    else:
        card = identity.player_card(int(ident))
        if card is None:
            raise EventsError(404, "Jugador no encontrado", "no_encontrado")
        team, pid, name = card["team_code"], _canon(int(ident)), card["display_name"]
    if not repository.team_pbp_games(team, comp_id):
        raise EventsError(404, "Este equipo no tiene play-by-play importado. Reimportá sus partidos." if entity == "team"
                          else "Este jugador no tiene play-by-play importado. Reimportá sus partidos.", "sin_pbp")
    d = _collect(team, comp_id, ctx)
    r, g, tm = d["recs"], d["games_used"], entity == "team"
    blocks = {
        "assists": _assists(r["assists"], pid, g, d["pbp"], d["incomplete"], tm),
        "oreb": _oreb(r["oreb"], pid, g, d["pbp"], tm),
        "dreb": _dreb(r["dreb"], pid, g, d["pbp"], tm),
        "steals": _steals(r["steals"], pid, g, d["pbp"], d["incomplete"], tm, d["poss"], d["pts"]),
        "turnovers": _turnovers(r["turnovers"], pid, g, d["pbp"], d["incomplete"], tm),
    }
    out = {"entity": {"type": entity, "id": str(ident), "name": name, "team": team}, "blocks": blocks,
           "excluded": {"incomplete": d["incomplete"].get("any", 0)}, "link_fallback": d.get("link_fallback", 0),
           "context": context_mod.context_echo(ctx, games_used=g, games_total=d["games_total"], games_excluded=d["excluded"], ignored=[],
                                               competition_label=repository.competition_labels().get(comp_id) if comp_id is not None else None)}
    if tm:
        out["reconcile"] = {k: blocks[k]["reconcile"] for k in ("assists", "oreb", "steals", "turnovers")}
        out["reconcile"]["pts_from_tov"] = _tov_control(d["pts_tov"])
    return out


# ── Tabla `events_production` (T-06, A-07 RF-22) ─────────────────────────────
# Mismos registros que el panel: por cadena (asistencia, rebote ofensivo, rebote defensivo, robo, pérdida) una fila por
# desenlace o por jugador, con eventos, % del total, puntos de la posesión siguiente y puntos por evento.

CHAINS = {"asistencia": "assists", "rebote_ofensivo": "oreb", "rebote_defensivo": "dreb", "robo": "steals", "perdida": "turnovers"}
CHAIN_LABELS = {"asistencia": "Asistencias", "rebote_ofensivo": "Rebotes ofensivos", "rebote_defensivo": "Rebotes defensivos",
                "robo": "Robos", "perdida": "Pérdidas"}
OUTCOME_LABELS = {
    "assists": {"doble": "Termina en doble", "triple": "Termina en triple", "mas1": "Termina en 2+1"},
    "oreb": {"putback": "Putback", "doble": "Doble", "triple": "Triple", "falta": "Falta recibida", "perdida": "Pérdida",
             "sin_puntos": "Finalización sin puntos"},
    "dreb": {"transicion": "Abre contraataque", "posicional": "Ataque posicional"},
    "steals": {"doble": "Doble", "triple": "Triple", "falta": "Falta recibida", "perdida": "Pérdida posterior",
               "sin_conversion": "Sin conversión"},
    "turnovers": {"doble": "Doble recibido", "triple": "Triple recibido", "falta": "Falta recibida por el rival",
                  "sin_castigo": "Sin castigo", "sin_posesion_siguiente": "Sin posesión siguiente (fin de período)",
                  "posesion_incompleta": "Posesión siguiente incompleta"},
}
_PLAYER_KEY = {"assists": "assister", "oreb": "player", "dreb": "player", "steals": "player", "turnovers": "player"}


def _cat(block, r):
    if block == "assists":
        return r["kind"]
    if block == "dreb":
        return "transicion" if r["trans"] else "posicional"
    return r["cat"]


def table_rows(treq):
    import tables
    team = (treq.params.get("team") or "").upper()
    chain = treq.params.get("chain") or "asistencia"
    section = treq.params.get("section") or "desenlaces"
    if chain not in CHAINS:
        raise tables.TableError(400, "Cadena inválida: usá " + ", ".join(CHAINS) + ".", "parametro_invalido", {"param": "chain"})
    if section not in ("desenlaces", "jugadores"):
        raise tables.TableError(400, "Sección inválida: usá desenlaces o jugadores.", "parametro_invalido", {"param": "section"})
    if not repository.team_pbp_games(team, treq.comp_id):
        raise tables.TableError(404, "Este equipo no tiene play-by-play importado. Reimportá sus partidos.", "sin_pbp")
    block = CHAINS[chain]
    d = _collect(team, treq.comp_id, treq.ctx)
    recs, games = d["recs"][block], d["games_used"]
    total = len(recs)
    if section == "desenlaces":
        groups = [(k, label, [r for r in recs if _cat(block, r) == k]) for k, label in OUTCOME_LABELS[block].items()]
    else:
        by = {}
        for r in recs:
            by.setdefault(r[_PLAYER_KEY[block]], []).append(r)
        groups = sorted(((str(pid), _name(pid) or f"jugador {pid}", rs) for pid, rs in by.items() if pid is not None),
                        key=lambda g: (-len(g[2]), g[1]))
        if None in by:
            groups.append(("equipo", "Del equipo (sin jugador)", by[None]))
    rows = []
    for key, label, rs in groups:
        n, pts = len(rs), sum(r["pts"] for r in rs)
        scored = sum(1 for r in rs if r["pts"] > 0)
        rows.append(tables.TableRow(
            id=f"{team}:{chain}:{section}:{key}",
            link=f"player:{key}" if section == "jugadores" and key.isdigit() else None,
            texts={"_name": label, "_events": n, "_share": round(n / total, 4) if total else None, "_pts": pts,
                   "_pts_per": round(pts / n, 4) if n else None, "_scored": round(scored / n, 4) if n else None},
            bundle=None, sample=_badge(n, games), reason_if_null="no_aplica"))
    return rows


def _register_table():
    import tables
    tables.register_table(
        "events_production", entity_type="chain", title="Producción desde eventos", builder=table_rows,
        required_params=("team",),
        default_columns=("_name", "_sample", "_events", "_share", "_pts", "_pts_per", "_scored"),
        bulk_scopes=(), row_kind="entity",
        extra_columns=(("_name", "Grupo", "text"), ("_events", "Eventos", "value:int"), ("_share", "% del total", "value:pct"),
                       ("_pts", "Puntos siguientes", "value:int"), ("_pts_per", "Puntos por evento", "value:dec2"),
                       ("_scored", "% con puntos", "value:pct")),
        default_sort=None, totals_mode="none", avg_mode="none", pct_mode="none", sample_col=True,
        title_fn=lambda treq: (f"{CHAIN_LABELS.get(treq.params.get('chain') or 'asistencia', 'Eventos')} "
                               f"{'por jugador' if treq.params.get('section') == 'jugadores' else 'por desenlace'} — "
                               f"{(treq.params.get('team') or '').upper()}"),
    )


_register_table()


# ── Entidad `chain` (T-05, A-07 RF-21) ───────────────────────────────────────
# Cada cadena como un split de posesiones con el conjunto estándar completo (id `<equipo>:<cadena>`). Las posesiones de cada
# cadena son las mismas que miden los bloques del panel (horizonte de una posesión):
#   asistencia       → posesiones propias que terminan en canasta asistida
#   rebote_ofensivo  → oportunidades tras rebote ofensivo propio (n ≥ 2; rebotes por estructura, como la entidad `chance`)
#   rebote_defensivo → posesiones propias que nacen de un rebote defensivo
#   robo             → posesiones propias que nacen de un robo
#   perdida          → la posesión del RIVAL que sigue a cada pérdida propia (mismo período): lo que la pérdida costó
# Es de un solo lado (el que ataca en esas posesiones): ritmo, DER y Net van `no_aplica`.

def _chain_units(team, comp_id, ctx, chain):
    """[(caja de quien ataca, caja de quien defiende, segundos, game_id)] de la cadena."""
    import poss_filter
    games, total, excluded = origin_mod._games_for(team, comp_id, ctx)
    units = []
    for g in games:
        plist = possessions.game_possessions(g["game_id"])
        order = idx = None
        for i, p in enumerate(plist):
            if p.team != team or p.incomplete:
                continue
            if chain == "asistencia":
                if p.assister_id is None or not any(s.get("made") for s in p.shots):
                    continue
                a, d = poss_filter._poss_box(p)
                units.append((a, d, p.duration or 0, g["game_id"]))
            elif chain in ("rebote_defensivo", "robo"):
                if p.origin != chain:
                    continue
                a, d = poss_filter._poss_box(p)
                units.append((a, d, p.duration or 0, g["game_id"]))
            elif chain == "rebote_ofensivo":
                if len(p.chances) < 2:
                    continue
                if order is None:
                    order = sorted(g.get("events") or [], key=lambda e: e.get("action_number") or 0)
                    idx = {e.get("action_number"): k for k, e in enumerate(order)}
                for ch, a, d, secs, _ev in poss_filter._chance_spans(p, order, idx):
                    if ch.n >= 2:
                        units.append((a, d, secs, g["game_id"]))
            elif chain == "perdida":
                if p.end_type != "perdida":
                    continue
                nxt = plist[i + 1] if i + 1 < len(plist) else None
                if nxt is None or nxt.team == team or nxt.period != p.period or nxt.incomplete:
                    continue
                a, d = poss_filter._poss_box(nxt)
                units.append((a, d, nxt.duration or 0, g["game_id"]))
    return units, total, excluded


def chain_bundle(team, chain, comp_id, ctx):
    from stats_engine import StatBundle

    def build():
        import poss_filter
        units, total, excluded = _chain_units(team, comp_id, ctx, chain)
        if not units:
            return None
        own, opp = poss_filter._empty(), poss_filter._empty()
        for a, d, _s, _g in units:
            poss_filter._add(own, a)
            poss_filter._add(opp, d)
        own["blk_received"], opp["blk_received"] = opp.get("blk", 0), own.get("blk", 0)
        own["plus_minus"] = opp["plus_minus"] = None
        seconds = sum(u[2] for u in units)
        rows = [r for r in repository.team_game_rows(comp_id).values() if r["team_code"] == team]
        name = next((r.get("team_name") for r in rows if r.get("team_name")), team)
        meta = {"team_code": team, "team_name": name, "split": True, "poss_exact": True, "one_side": True, "chain": chain,
                "variant": chain, "perspective": "rival" if chain == "perdida" else "propio",
                "unit": "oportunidad" if chain == "rebote_ofensivo" else "posesion",
                "games_total": total, "games_excluded": excluded}
        return StatBundle(entity_type="split", entity_id=f"{team}:{chain}", name=name,
                          own=own, opp=opp, team=None, games=len({u[3] for u in units}), minutes=seconds / 60,
                          team_minutes=None, seconds=seconds, on_court=None, shots=None, possessions_counted=len(units),
                          null_reasons={}, meta=meta)
    return repository.memo(("chain_bundle", team, chain, comp_id, context_key(ctx)), build)


def _parse_chain_id(entity_id):
    import metrics_catalog
    team, _, chain = str(entity_id).partition(":")
    if chain not in CHAINS:
        raise metrics_catalog.MetricsError(
            "La cadena debe ser asistencia, rebote_ofensivo, rebote_defensivo, robo o perdida.", 400, "parametro_invalido")
    return team.strip().upper(), chain


def _chain_loader(req):
    team, chain = _parse_chain_id(req.entity_id)
    b = chain_bundle(team, chain, req.comp_id, req.ctx)
    return [b] if b is not None else []


def all_chain_bundles(comp_id, ctx, variant=None):
    """Población del tipo `chain`: todos los equipos en la MISMA cadena (`variant` = cadena)."""
    if variant not in CHAINS:
        return []
    out = []
    for code in sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()}):
        b = chain_bundle(code, variant, comp_id, ctx)
        if b is not None:
            out.append(b)
    return out


def _register_entity():
    import metrics_catalog
    metrics_catalog.register_entity("chain", _chain_loader, enumerator=all_chain_bundles)


_register_entity()

