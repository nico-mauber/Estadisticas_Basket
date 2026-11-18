"""Segunda oportunidad (A-04): cada rebote ofensivo abre una oportunidad nueva dentro de la misma posesión.

`enrich_chances` se registra como enriquecedor de `possessions` y completa en cada `Chance` con n ≥ 2 su
desenlace (`putback`, `reinicio`, `kickout_triple`, `falta_recibida`, `perdida`, `sin_puntos`), el modo del
tiro, los segundos del rebote al tiro, el tipo de tiro fallado que dio el rebote y los jugadores que
capturan y finalizan. `second_chance_report` / `player_second_chance` agregan todo en ataque y en defensa y
`reconcile` lo concilia con `second_chance_pts` del box oficial. On-the-fly: nada se persiste.

FIBA no publica la ubicación del rebote ni pases no asistidos: la zona del rebote y el rebote largo vs en la
zona son `no_registrado`; el "putback" exige que el tiro no tenga asistencia vinculada (D-2).
"""
from collections import Counter

import cache
import config
import context as context_mod
import identity
import possessions
import repository
import sample
import transition as transition_mod
from flask import has_app_context

OUTCOMES = ("putback", "reinicio", "kickout_triple", "falta_recibida", "perdida", "sin_puntos")
OUTCOME_LABELS = {"putback": "Putback inmediato", "reinicio": "Reinicio de ataque", "kickout_triple": "Kick-out a triple",
                  "falta_recibida": "Falta recibida", "perdida": "Pérdida", "sin_puntos": "Sin puntos"}
SOURCES = ("triple", "media_distancia", "cercano", "tiro_libre", "desconocido")
SOURCE_LABELS = {"triple": "Tras triple fallado", "media_distancia": "Tras media distancia fallada",
                 "cercano": "Tras tiro cercano fallado", "tiro_libre": "Tras tiro libre fallado",
                 "desconocido": "Tiro no identificado"}
MODES = ("putback", "kickout", "reinicio")
MODE_LABELS = {"putback": "Putback", "kickout": "Kick-out", "reinicio": "Reinicio"}
SIDES = ("ataque", "defensa")
SECS_BINS = ((0, 2, "0-2 s"), (3, 5, "3-5 s"), (6, 9, "6-9 s"), (10, 14, "10-14 s"), (15, 99, "15 s o más"))
NO_REGISTRADO = {"value": None, "reason": "no_registrado"}
REBOUND_ZONE_NOTE = "FIBA LiveStats no registra dónde se captura el rebote."


def _cuts():
    if has_app_context():
        return int(config.get("oreb.putback_secs")), int(config.get("oreb.kickout_secs"))
    return 3, 6


# ── Clasificación ────────────────────────────────────────────────────────────

def _source_of(p, k, events, idx):
    """Tipo de tiro fallado que dio el rebote (el que cerró la oportunidad anterior)."""
    prev = p.chances[k - 1]
    if prev.end_event not in idx:
        return "desconocido"
    at = events[idx[prev.end_event]].get("action_type")
    if at == "3pt":
        return "triple"
    if at == "freethrow":
        return "tiro_libre"
    if at == "2pt":
        shot = next((s for s in p.shots if s["action_number"] == prev.end_event), None)
        zone = shot.get("zone") if shot else None
        return "desconocido" if zone is None else ("cercano" if zone == "restricted_area" else "media_distancia")
    return "desconocido"


def enrich_chances(poss, events, meta):
    """Enriquecedor de A-01: completa los campos de A-04 en cada `Chance` con n ≥ 2."""
    put_s, kick_s = _cuts()
    idx, n2id = meta["event_index"], meta["name_to_id"]
    for p in poss:
        if p.incomplete:
            continue
        for k, ch in enumerate(p.chances):
            if ch.n < 2:
                continue
            ev = events[idx[ch.start_event]]
            name = ev.get("player_name")
            ch.rebounder_id = n2id.get((p.team, name)) if name else None
            ch.source = _source_of(p, k, events, idx)
            shot = next((s for s in p.shots if s["action_number"] > ch.start_event
                         and (ch.end_event is None or s["action_number"] <= ch.end_event)), None)
            et = ch.end_type
            ch.mode = ch.shot_secs = None
            if shot is not None:
                secs = shot.get("elapsed")
                ch.shot_secs = secs
                is3 = events[idx[shot["action_number"]]].get("action_type") == "3pt"
                assisted = et in ("t2c", "t3c") and p.assister_id is not None
                if secs is not None and secs <= put_s and not assisted:
                    ch.mode = "putback"
                elif secs is not None and is3 and secs <= kick_s:
                    ch.mode = "kickout"
                else:
                    ch.mode = "reinicio"
            if et == "perdida":
                ch.outcome = "perdida"
            elif et == "falta":
                ch.outcome = "falta_recibida"
            elif et in ("t2c", "t3c"):
                ch.outcome = {"putback": "putback", "kickout": "kickout_triple"}.get(ch.mode, "reinicio")
            else:
                ch.outcome = "sin_puntos"
            if shot is not None:
                ch.finisher_id = shot.get("player_id")
            elif et == "perdida":
                ch.finisher_id = p.turnover_by_id
            elif et == "falta":
                for an in p.event_numbers or ():
                    if an < ch.start_event or (ch.end_event is not None and an > ch.end_event):
                        continue
                    e = events[idx[an]]
                    if e.get("action_type") == "foulon" and e.get("team_code") == p.team:
                        ch.finisher_id = n2id.get((p.team, e.get("player_name")))
                if ch.finisher_id is None and k == len(p.chances) - 1:
                    ch.finisher_id = p.finisher_id


possessions.register_enricher("chances", enrich_chances)


# ── Agregación ───────────────────────────────────────────────────────────────

def _m(v):
    return {"value": v, "reason": None if v is not None else "sin_intentos"}


def _div(a, b, nd=4):
    return round(a / b, nd) if b else None


def _seconds(pairs):
    secs = [ch.shot_secs for _, ch in pairs if ch.shot_secs is not None]
    return {"mean": _m(_div(sum(secs), len(secs))), "possessions": len(secs), "without_shot": len(pairs) - len(secs),
            "distribution": [{"label": lab, "possessions": sum(1 for s in secs if lo <= s <= hi)}
                             for lo, hi, lab in SECS_BINS]}


def _outcome_rows(pairs):
    total = len(pairs)
    rows = []
    for key in OUTCOMES:
        grp = [ch for _, ch in pairs if ch.outcome == key]
        n = len(grp)
        pts = sum(ch.pts for ch in grp)
        rows.append({"key": key, "label": OUTCOME_LABELS[key], "count": n, "share": _div(n, total), "pts": pts,
                     "ppp": _m(_div(pts, n)),
                     "sample": sample.sample_level("origin", n=n, unit="posesiones", team_poss=total)})
    return rows


def _mode_rows(pairs):
    out = []
    for key in MODES:
        grp = [ch for _, ch in pairs if ch.mode == key]
        made = sum(1 for ch in grp if ch.end_type in ("t2c", "t3c"))
        out.append({"key": key, "label": MODE_LABELS[key], "attempts": len(grp), "made": made,
                    "pct": _m(_div(made, len(grp)))})
    return out


def _source_rows(pairs):
    total = len(pairs)
    rows = []
    for key in SOURCES:
        grp = [ch for _, ch in pairs if ch.source == key]
        if key == "desconocido" and not grp:
            continue
        pts = sum(ch.pts for ch in grp)
        rows.append({"key": key, "label": SOURCE_LABELS[key], "count": len(grp), "share": _div(len(grp), total),
                     "pts": pts, "ppp": _m(_div(pts, len(grp))),
                     "sample": sample.sample_level("origin", n=len(grp), unit="posesiones", team_poss=total)})
    return rows


def _name(pid):
    card = identity.player_card(pid) if pid is not None else None
    return (card or {}).get("display_name") or f"jugador {pid}"


def _players(pairs):
    cap, cap_pts, cap_conv, own_put = Counter(), Counter(), Counter(), Counter()
    fin, fin_pts = Counter(), Counter()
    for p, ch in pairs:
        r = ch.rebounder_id
        cap[r] += 1
        cap_pts[r] += ch.pts
        cap_conv[r] += 1 if ch.pts > 0 else 0
        if ch.outcome == "putback" and ch.finisher_id == r and r is not None:
            own_put[r] += 1
        if ch.finisher_id is not None:
            fin[ch.finisher_id] += 1
            fin_pts[ch.finisher_id] += ch.pts
    ids = sorted((set(cap) | set(fin)) - {None})
    rows = [{"player_id": pid, "name": _name(pid), "captured": cap[pid], "capture_pts": cap_pts[pid],
             "conversion": _m(_div(cap_conv[pid], cap[pid])), "own_putbacks": own_put[pid],
             "finished": fin[pid], "finish_pts": fin_pts[pid], "ppp_personal": _m(_div(fin_pts[pid], fin[pid])),
             "sample": sample.sample_level("origin", n=cap[pid], unit="posesiones")} for pid in ids]
    rows.sort(key=lambda r: (-r["captured"], -r["finished"], r["player_id"]))
    team = {"player_id": None, "name": "Rebote de equipo", "captured": cap[None], "capture_pts": cap_pts[None],
            "conversion": _m(_div(cap_conv[None], cap[None])), "own_putbacks": 0, "finished": 0, "finish_pts": 0,
            "ppp_personal": _m(None), "sample": sample.sample_level("origin", n=cap[None], unit="posesiones")}
    return {"rows": rows, "team_row": team,
            "totals": {"captured": len(pairs), "finish_pts": sum(fin_pts.values())}}


def _build(team_code, comp_id, ctx, side):
    mine, used, total, excluded, per_game = transition_mod._selection(team_code, comp_id, ctx, side)
    complete = [p for p in mine if not p.incomplete]
    pairs = [(p, ch) for p in complete for ch in p.chances if ch.n >= 2]
    first_n = len(complete)
    first_pts = sum(p.chances[0].pts for p in complete)
    sec_pts = sum(ch.pts for _, ch in pairs)
    conv = sum(1 for _, ch in pairs if ch.pts > 0)
    ppp1, ppp2 = _div(first_pts, first_n), _div(sec_pts, len(pairs))
    chain_poss = [p for p in complete if len(p.chances) >= 3]
    with_ro = [p for p in complete if len(p.chances) >= 2]
    orb_box = sum(p.box.get("orb") or 0 for p in complete)
    out = {
        "side": side,
        "summary": {"possessions": len(complete), "second_chances": len(pairs), "classified": len(pairs),
                    "oreb_in_box": orb_box, "incomplete": len(mine) - len(complete),
                    "reconciled": sum(r["count"] for r in _outcome_rows(pairs)) == len(pairs)},
        "ppp_first": _m(ppp1), "ppp_second": _m(ppp2),
        "ppp_diff": _m(round(ppp2 - ppp1, 4) if ppp1 is not None and ppp2 is not None else None),
        "pts_per_oreb": _m(ppp2), "conversion": _m(_div(conv, len(pairs))),
        "outcomes": _outcome_rows(pairs), "modes": _mode_rows(pairs), "sources": _source_rows(pairs),
        "rebound_zone": dict(NO_REGISTRADO, note=REBOUND_ZONE_NOTE),
        "chains": {"possessions_with_oreb": len(with_ro), "chains": len(chain_poss),
                   "share": _m(_div(len(chain_poss), len(with_ro))),
                   "ppp": _m(_div(sum(p.pts for p in chain_poss), len(chain_poss)))},
        "secs_to_shot": _seconds(pairs),
        "games_used": used, "games_total": total, "games_excluded": excluded,
    }
    if side == "ataque":
        out["players"] = _players(pairs)
        rival = [p for _, ps in per_game for p in ps if p.opp == team_code and not p.incomplete]
        costly = [p for p in rival if p.origin == "rebote_defensivo"]
        trans = [p for p in costly if p.ptype == "transicion"]
        misses = sum((p.box.get("fga2") or 0) + (p.box.get("fga3") or 0) - (p.box.get("fgm2") or 0)
                     - (p.box.get("fgm3") or 0) for p in complete)
        out["cost"] = {"approximation": True, "note": "Aproximación: FIBA no registra quién fue al rebote.",
                       "rival_rebound_possessions": len(costly), "transitions_conceded": len(trans),
                       "share": _m(_div(len(trans), len(costly))), "pts": sum(p.pts for p in trans),
                       "ppp": _m(_div(sum(p.pts for p in trans), len(trans))),
                       "per100_misses": _m(_div(100 * len(trans), misses, 2))}
        out["reconcile"] = reconcile(team_code, per_game)
    else:
        orb_c = sum(p.box.get("orb") or 0 for p in complete)
        drb_own = sum(p.opp_box.get("drb") or 0 for p in complete)
        out["or_pct_conceded"] = _m(_div(orb_c, orb_c + drb_own))
        out["long_rebound"] = dict(NO_REGISTRADO, note=REBOUND_ZONE_NOTE)
    return out


def reconcile(team_code, per_game):
    """Puntos de segunda oportunidad calculados vs `team_game_stats.second_chance_pts` (informativo por partido)."""
    from database import Game, TeamGameStats
    import ingest
    games, excluded = [], []
    calc_t = off_t = 0
    for g, ps in per_game:
        game = Game.query.filter_by(game_id=g["game_id"]).first()
        if game is None or (game.ingest_version or 1) < ingest.INGEST_VERSION:
            excluded.append({"game_id": g["game_id"], "reason": "no_registrado"})
            continue
        tgs = TeamGameStats.query.filter_by(game_id=g["game_id"], team_code=team_code).first()
        mine = [p for p in ps if p.team == team_code]
        calc = sum(ch.pts for p in mine if not p.incomplete for ch in p.chances if ch.n >= 2)
        incomplete_ro = sum(max(0, len(p.chances) - 1) for p in mine if p.incomplete)
        official = tgs.second_chance_pts if tgs is not None else None
        games.append({"game_id": g["game_id"], "calc": calc, "official": official,
                      "diff": None if official is None else calc - official, "incomplete_oreb": incomplete_ro})
        calc_t += calc
        off_t += official or 0
    return {"games": games, "excluded": excluded, "calc": calc_t, "official": off_t, "diff": calc_t - off_t,
            "games_mismatch": [g for g in games if g["diff"]]}


# ── API ──────────────────────────────────────────────────────────────────────

def second_chance_report(team_code, comp_id, ctx, *, side="ataque"):
    key = (team_code, comp_id, context_mod.context_key(ctx), side)
    out = dict(cache.memo("poss:chance", key, lambda: _build(team_code, comp_id, ctx, side)))
    out["context"] = transition_mod._echo(ctx, out.pop("games_used"), out.pop("games_total"), out.pop("games_excluded"))
    return out


def player_second_chance(player_id, comp_id, ctx):
    card = identity.player_card(player_id)
    if card is None:
        return None
    pid = identity.canonical_id(player_id) or player_id
    mine, used, total, excluded, _ = transition_mod._selection(card["team_code"], comp_id, ctx, "ataque")
    pairs = [(p, ch) for p in mine if not p.incomplete for ch in p.chances if ch.n >= 2]
    cap = [ch for _, ch in pairs if ch.rebounder_id == pid]
    fin = [ch for _, ch in pairs if ch.finisher_id == pid]
    return {
        "side": "ataque",
        "capture": {"captured": len(cap), "pts": sum(ch.pts for ch in cap),
                    "conversion": _m(_div(sum(1 for ch in cap if ch.pts > 0), len(cap))),
                    "own_putbacks": sum(1 for ch in cap if ch.outcome == "putback" and ch.finisher_id == pid),
                    "sample": sample.sample_level("origin", n=len(cap), unit="posesiones")},
        "finish": {"finished": len(fin), "pts": sum(ch.pts for ch in fin),
                   "ppp_personal": _m(_div(sum(ch.pts for ch in fin), len(fin))),
                   "sample": sample.sample_level("origin", n=len(fin), unit="posesiones")},
        "outcomes": _outcome_rows([(None, ch) for ch in fin]),
        "summary": {"possessions": len(cap) + len(fin), "second_chances": len(pairs), "classified": len(fin),
                    "reconciled": True},
        "context": transition_mod._echo(ctx, used, total, excluded),
    }


# ── Entidad `chance` (T-05) y tabla `team_second_chance` (T-06) ──────────────
# Cada oportunidad se mide con los eventos de su tramo (desde su evento inicial hasta el que abre la siguiente). Los
# rebotes se asignan por estructura y no por evento: el rebote ofensivo que abre la oportunidad siguiente es el
# desenlace de ESTA (RO = 1 si hubo otra oportunidad) y el rebote defensivo del rival cierra la última si terminó en
# fallo. Así PPP (puntos / jugadas), OER y OR% de las oportunidades quedan bien definidos.

CHANCE_KINDS = ("primera", "segunda")
CHANCE_LABELS = {"primera": "Primera oportunidad", "segunda": "Segunda oportunidad"}
SECTIONS = ("desenlaces", "origen", "jugadores")
_SHOT_TYPES = ("2pt", "3pt", "freethrow")


def _chance_items(team_code, comp_id, ctx, side):
    """[(posesión, oportunidad, caja propia, caja rival, segundos)] de las posesiones completas del lado."""
    import lineups
    _mine, used, total, excluded, per_game = transition_mod._selection(team_code, comp_id, ctx, side)
    items = []
    for g, ps in per_game:
        order = sorted(g.get("events") or [], key=lambda e: e.get("action_number") or 0)
        idx = {e.get("action_number"): i for i, e in enumerate(order)}
        for p in ps:
            if (p.team if side == "ataque" else p.opp) != team_code or p.incomplete:
                continue
            for k, ch in enumerate(p.chances):
                lo = idx.get(ch.start_event)
                if lo is None:
                    continue
                nxt = p.chances[k + 1] if k + 1 < len(p.chances) else None
                if nxt is not None and nxt.start_event in idx:
                    hi = idx[nxt.start_event]
                else:
                    hi = idx[p.end_event] + 1 if p.end_event in idx else len(order)
                span = [e for e in order[lo:hi] if e.get("action_type") != "rebound"]
                own, opp = lineups._agg(span, p.team), lineups._agg(span, p.opp)
                shots = [e for e in span if e.get("team_code") == p.team and e.get("action_type") in _SHOT_TYPES]
                missed_last = bool(shots) and shots[-1].get("success") != 1
                own["orb"], own["drb"] = (1 if nxt is not None else 0), 0
                opp["orb"], opp["drb"] = 0, (1 if nxt is None and missed_last else 0)
                end_clock = nxt.start_clock if nxt is not None else p.end_clock
                secs = (ch.start_clock - end_clock if ch.start_clock is not None and end_clock is not None
                        and ch.start_clock >= end_clock else 0)
                items.append((p, ch, own, opp, secs))
    return items, used, total, excluded


def _group_bundle(team_code, items, entity_id, name, meta):
    import lineups
    from stats_engine import StatBundle
    own = lineups._sum_boxes([i[2] for i in items])
    opp = lineups._sum_boxes([i[3] for i in items])
    own["blk_received"], opp["blk_received"] = opp.get("blk", 0), own.get("blk", 0)
    own["plus_minus"] = opp["plus_minus"] = None
    seconds = sum(i[4] for i in items)
    return StatBundle(
        entity_type="split", entity_id=entity_id, name=name, own=own, opp=opp, team=None,
        games=len({i[0].game_id for i in items}), minutes=seconds / 60, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=len(items), null_reasons={},
        meta={"team_code": team_code, "split": True, "poss_exact": True, "one_side": True, **meta})


def chance_bundle(team_code, kind, comp_id, ctx, side="ataque"):
    """`StatBundle` de las primeras o segundas oportunidades (n ≥ 2) del equipo; `None` si no hay ninguna."""
    def build():
        items, _used, total, excluded = _chance_items(team_code, comp_id, ctx, side)
        group = [i for i in items if (i[1].n >= 2) == (kind == "segunda")]
        if not group:
            return None
        return _group_bundle(team_code, group, f"{team_code}:{kind}", f"{team_code} · {CHANCE_LABELS[kind]}",
                             {"chance": kind, "side": side, "variant": f"{kind}:{side}",
                              "games_total": total, "games_excluded": excluded})
    k = ("chance_bundle", team_code, kind, comp_id, context_mod.context_key(ctx), side)
    return repository.memo(k, build)


def _chance_loader(req):
    import metrics_catalog
    team_code, _, kind = str(req.entity_id).partition(":")
    if kind not in CHANCE_KINDS:
        raise metrics_catalog.MetricsError("Oportunidad inválida. Usá primera o segunda.", 400, "parametro_invalido")
    side = (req.params or {}).get("side") or "ataque"
    if side not in SIDES:
        raise metrics_catalog.MetricsError("El lado debe ser ataque o defensa.", 400, "parametro_invalido")
    b = chance_bundle(team_code.upper(), kind, req.comp_id, req.ctx, side)
    return [b] if b is not None else []


def all_chance_bundles(comp_id, ctx, variant=None):
    """Población del tipo `chance`: todos los equipos en la misma oportunidad y lado (`variant` = `tipo:lado`)."""
    if not variant or ":" not in str(variant):
        return []
    kind, side = str(variant).split(":", 1)
    if kind not in CHANCE_KINDS or side not in SIDES:
        return []
    out = []
    for code in sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()}):
        b = chance_bundle(code, kind, comp_id, ctx, side)
        if b is not None:
            out.append(b)
    return out


def table_rows(treq):
    """Builder de `team_second_chance` (RF-18): una fila por desenlace, por origen del rebote o por jugador que
    capturó el rebote ofensivo, cada una con el conjunto estándar de esas segundas oportunidades."""
    import tables
    team_code = (treq.params.get("team") or "").upper()
    side = treq.params.get("side") or "ataque"
    section = treq.params.get("section") or "desenlaces"
    if side not in SIDES:
        raise tables.TableError(400, "El lado debe ser ataque o defensa.", "parametro_invalido", {"param": "side"})
    if section not in SECTIONS:
        raise tables.TableError(400, "Sección inválida: usá desenlaces, origen o jugadores.", "parametro_invalido",
                                {"param": "section"})
    if section == "jugadores" and side != "ataque":
        raise tables.TableError(400, "La sección jugadores es solo de ataque.", "parametro_invalido", {"param": "side"})
    items, _u, _t, _e = _chance_items(team_code, treq.comp_id, treq.ctx, side)
    second = [i for i in items if i[1].n >= 2]
    total = len(second)
    if section == "desenlaces":
        groups = [(key, OUTCOME_LABELS[key], [i for i in second if i[1].outcome == key]) for key in OUTCOMES]
    elif section == "origen":
        groups = [(key, SOURCE_LABELS[key], [i for i in second if i[1].source == key]) for key in SOURCES]
        groups = [g for g in groups if g[0] != "desconocido" or g[2]]
    else:
        by = {}
        for i in second:
            by.setdefault(i[1].rebounder_id, []).append(i)
        groups = [(str(pid), _name(pid), grp) for pid, grp in by.items() if pid is not None]
        groups.sort(key=lambda g: (-len(g[2]), g[1]))
        if None in by:
            groups.append(("equipo", "Rebote de equipo", by[None]))
    rows = []
    for key, label, grp in groups:
        b = _group_bundle(team_code, grp, f"{team_code}:{key}", label, {"chance": "segunda", "side": side}) if grp else None
        badge = sample.sample_level("origin", n=len(grp), unit="posesiones", team_poss=total)
        share = "—" if not total else f"{len(grp) / total * 100:.1f}".replace(".", ",") + " %"
        rows.append(tables.TableRow(
            id=f"{team_code}:{section}:{key}", link=f"player:{key}" if section == "jugadores" and key.isdigit() else None,
            texts={"_name": label, "_share": share}, bundle=b, sample=badge, reason_if_null="sin_intentos"))
    return rows


_TABLE_TITLES = {"desenlaces": "por desenlace", "origen": "por origen del rebote", "jugadores": "por jugador"}


def _register():
    import metrics_catalog
    import tables
    metrics_catalog.register_entity("chance", _chance_loader, enumerator=all_chance_bundles)
    tables.register_table(
        "team_second_chance", entity_type="chance", title="Segunda oportunidad", builder=table_rows,
        required_params=("team",),
        default_columns=("_name", "_sample", "possessions_counted", "_share", "pts", "ppp", "efg_pct", "to_pct",
                         "ft_rate", "or_pct"),
        bulk_scopes=("team",), row_kind="entity",
        extra_columns=(("_name", "Grupo", "text"), ("_share", "% de las 2.ª oport.", "text")),
        default_sort=None, totals_mode="sum", avg_mode="none", pct_mode="none",
        title_fn=lambda treq: (
            f"Segunda oportunidad{' del rival' if treq.params.get('side') == 'defensa' else ''} "
            f"{_TABLE_TITLES.get(treq.params.get('section') or 'desenlaces', '')} — {(treq.params.get('team') or '').upper()}"),
    )


_register()
