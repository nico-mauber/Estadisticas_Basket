"""Transición y contraataque (A-03): tipo de cada posesión según la velocidad con que se resuelve.

`enrich_ptype` se registra como enriquecedor de `possessions` (DESPUÉS de `origin`) y completa `Possession.ptype`
con los segundos de reloj de posesión hasta el primer evento de decisión (tiro de campo, falta recibida o pérdida):
`transicion` si ≤ `transition.max_secs`, `early` si ≤ `early_offense.max_secs`, `media_cancha` en el resto. Los
cortes se leen de la configuración (F-13) en cada reconstrucción: cambiarlos invalida el caché de posesiones.
`transition_report` y `player_transition` agregan las posesiones clasificadas, en ataque y en defensa.

Todo on-the-fly. FIBA no publica reloj de posesión ni pases: el reloj es derivado (resolución de 1 s) y el primer
pase de salida queda `no_registrado`.
"""
from collections import Counter, defaultdict

import cache
import config
import context as context_mod
import identity
import metrics_catalog
import origin as origin_mod          # importar `origin` primero garantiza su orden como enriquecedor
import possessions
import repository
import sample
import stats_engine
import tables
from flask import has_app_context
from stats_engine import StatBundle

PTYPES = ("transicion", "early", "media_cancha")
LABELS = {"transicion": "Transición", "early": "Ataque temprano", "media_cancha": "Media cancha"}
SIDES = ("ataque", "defensa")
LAYUP = frozenset({"layup", "drivinglayup", "reverselayup", "tipinlayup", "dunk"})
CORNERS = frozenset({"left_corner_3", "right_corner_3"})
FINISH_KINDS = ("bandeja_volcada", "otro_2", "triple_esquina", "triple_frontal", "tiro_libre", "perdida")
FINISH_LABELS = {"bandeja_volcada": "Bandeja o volcada", "otro_2": "Otro tiro de 2", "triple_esquina": "Triple de esquina",
                 "triple_frontal": "Triple frontal", "tiro_libre": "Tiro libre", "perdida": "Pérdida"}
# origen del contraataque (visto desde el atacante)
ORIGIN_GROUPS = (("rebote_defensivo", "Tras rebote defensivo"), ("robo", "Tras robo"),
                 ("canasta_rival", "Tras canasta rival"), ("perdida_rival", "Tras pérdida rival sin robo"),
                 ("otros", "Otros"))
_OTHER_ORIGINS = frozenset({"saque_banda", "tiempo_muerto", "tiro_libre_rival"})
# origen concedido (visto desde el defensor)
CONCEDED_GROUPS = (("perdida_propia", "Tras pérdida propia", frozenset({"robo", "perdida_rival"})),
                   ("tiro_fallado", "Tras tiro fallado propio", frozenset({"rebote_defensivo"})),
                   ("canasta_propia", "Tras canasta propia", frozenset({"canasta_rival"})),
                   ("otros", "Otros", _OTHER_ORIGINS))
FIRST_SHOT_BINS = ((0, 3, "0-3 s"), (4, 7, "4-7 s"), (8, 12, "8-12 s"), (13, 18, "13-18 s"), (19, 99, "19 s o más"))
PASS_OUT = {"value": None, "reason": "no_registrado",
            "note": "FIBA no registra los pases, solo el que termina en asistencia."}
_STEAL_WINDOW = 10      # eventos hacia atrás desde la apertura donde se busca el robo


# ── Clasificación ────────────────────────────────────────────────────────────

def _cuts():
    if has_app_context():
        return int(config.get("transition.max_secs")), int(config.get("early_offense.max_secs"))
    return 7, 12


def _ptype_of(elapsed, cut_t, cut_e):
    return "transicion" if elapsed <= cut_t else "early" if elapsed <= cut_e else "media_cancha"


def _foulon_player(p, events, idx, n2id):
    """Jugador del equipo atacante que recibió la última falta de la posesión (`foulon`); None si no hay."""
    found = None
    for an in p.event_numbers or ():
        e = events[idx[an]]
        if e.get("action_type") == "foulon" and e.get("team_code") == p.team:
            found = n2id.get((p.team, e.get("player_name")))
    return found


def _steal_player(p, events, i0, n2id):
    """Quien robó el balón que abre la posesión: último `steal` del equipo en los eventos previos del período."""
    pk = (events[i0].get("period"), events[i0].get("period_type"))
    for j in range(i0 - 1, max(-1, i0 - 1 - _STEAL_WINDOW), -1):
        e = events[j]
        if (e.get("period"), e.get("period_type")) != pk:
            break
        if e.get("action_type") == "steal" and e.get("team_code") == p.team:
            return n2id.get((p.team, e.get("player_name")))
    return None


def enrich_ptype(poss, events, meta):
    """Enriquecedor de A-01: completa tipo, motivo, finalización y jugadores de cada posesión."""
    cut_t, cut_e = _cuts()
    idx, n2id, mc = meta["event_index"], meta["name_to_id"], meta["mclock_list"]
    for p in poss:
        p.ptype = p.ptype_reason = p.first_elapsed = p.finish_kind = p.starter_id = p.end_player_id = None
        if p.incomplete:
            p.ptype_reason = "incompleta"
            continue
        c1 = p.chances[0]
        elapsed, sin_accion = None, False
        if p.shots:
            elapsed = p.shots[0]["elapsed"]
        elif c1.end_type in ("perdida", "falta") and c1.end_event in idx:
            elapsed = c1.start_clock - mc[idx[c1.end_event]]
            if not 0 <= elapsed <= c1.shot_clock_start + 1:
                elapsed = None
        else:
            sin_accion = True
        if sin_accion:
            p.ptype_reason = "sin_accion"
        elif elapsed is None:
            p.ptype_reason = "reloj_no_derivable"
        else:
            p.first_elapsed = elapsed
            p.ptype = _ptype_of(elapsed, cut_t, cut_e)

        et = p.end_type
        last = p.shots[-1] if p.shots else None
        if et in ("t2c", "t2f") and last:
            sub = (events[idx[last["action_number"]]].get("sub_type") or "").lower()
            p.finish_kind = "bandeja_volcada" if sub in LAYUP else "otro_2"
        elif et in ("t3c", "t3f") and last:
            p.finish_kind = "triple_esquina" if last.get("zone") in CORNERS else "triple_frontal"
        elif et == "falta":
            p.finish_kind = "tiro_libre"
        elif et == "perdida":
            p.finish_kind = "perdida"
        else:
            p.finish_kind = "fin_periodo"
        if et in ("t2c", "t2f", "t3c", "t3f") and last:
            p.end_player_id = last.get("player_id")
        elif et == "perdida":
            p.end_player_id = p.turnover_by_id
        elif et == "falta":
            p.end_player_id = _foulon_player(p, events, idx, n2id) or p.finisher_id

        i0 = idx.get(p.start_event)
        if i0 is not None and p.origin == "rebote_defensivo":
            e = events[i0]
            p.starter_id = n2id.get((e.get("team_code"), e.get("player_name")))
        elif i0 is not None and p.origin == "robo":
            p.starter_id = _steal_player(p, events, i0, n2id)


possessions.register_enricher("ptype", enrich_ptype)


# ── Agregación ───────────────────────────────────────────────────────────────

def _counts(group):
    c = {"n": len(group), "pts": 0, "fga2": 0, "fgm2": 0, "fga3": 0, "fgm3": 0, "fta": 0, "tov": 0,
         "duration_sum": 0, "first_sum": 0, "first_n": 0}
    for p in group:
        c["pts"] += p.pts
        for k in ("fga2", "fgm2", "fga3", "fgm3", "fta", "tov"):
            c[k] += p.box.get(k) or 0
        c["duration_sum"] += p.duration or 0
        if p.shots and p.shots[0].get("elapsed") is not None:
            c["first_sum"] += p.shots[0]["elapsed"]
            c["first_n"] += 1
    return c


def _m(v):
    return {"value": v, "reason": None if v is not None else "sin_intentos"}


def _ppp(group):
    return round(sum(p.pts for p in group) / len(group), 4) if group else None


def _type_row(key, group, classified_n, total_n):
    c = _counts(group)
    rates = stats_engine.origin_rates(c)
    rates["first_shot_secs"] = stats_engine._safe_div(c["first_sum"], c["first_n"])
    return {
        "key": key, "label": LABELS[key], "possessions": c["n"],
        "share": round(c["n"] / classified_n, 4) if classified_n else None,
        "metrics": {m: _m(v) for m, v in rates.items()},
        "sample": sample.sample_level("origin", n=c["n"], unit="posesiones", team_poss=total_n,
                                      games=len({p.game_id for p in group})),
    }


def _group_rows(trans, groups_key, groups, classified_by_origin=None):
    """Transiciones agrupadas por origen: cantidad, %, puntos, PPP (y % del origen que corre)."""
    rows = []
    for gk, label, *rest in groups:
        members = rest[0] if rest else None
        grp = [p for p in trans if (p.origin in members if members else
                                    (p.origin in _OTHER_ORIGINS if gk == "otros" else p.origin == gk))]
        row = {"key": gk, "label": label, "transitions": len(grp),
               "share": round(len(grp) / len(trans), 4) if trans else None,
               "pts": sum(p.pts for p in grp), "ppp": _m(_ppp(grp))}
        if classified_by_origin is not None:
            n = classified_by_origin.get(gk, 0)
            row["origin_possessions"] = n
            row["origin_runs_share"] = _m(round(len(grp) / n, 4) if n else None)
        rows.append(row)
    return rows


def _selection(team_code, comp_id, ctx, side):
    """(posesiones del lado, partidos usados, partidos totales, excluidos, listas por partido)."""
    games, total, excluded = origin_mod._games_for(team_code, comp_id, ctx)
    per_game = []
    for g in games:
        ps = possessions.game_possessions(g["game_id"])
        per_game.append((g, ps))
    mine = [p for _, ps in per_game for p in ps if (p.team if side == "ataque" else p.opp) == team_code]
    return mine, len(games), total, excluded, per_game


def _build_report(team_code, comp_id, ctx, side):
    mine, used, total, excluded, per_game = _selection(team_code, comp_id, ctx, side)
    complete = [p for p in mine if not p.incomplete]
    classified = [p for p in complete if p.ptype]
    unclass = Counter({"incompleta": len(mine) - len(complete)})
    unclass.update(p.ptype_reason for p in complete if not p.ptype)
    by = {k: [] for k in PTYPES}
    for p in classified:
        by[p.ptype].append(p)
    rows = [_type_row(k, by[k], len(classified), len(complete)) for k in PTYPES]
    vals = {r["key"]: r["metrics"]["ppp"]["value"] for r in rows}

    def diff(a):
        return round(vals[a] - vals["media_cancha"], 4) if vals[a] is not None and vals["media_cancha"] is not None else None
    out = {
        "side": side, "types": rows,
        "summary": {"possessions": len(complete), "classified": len(classified),
                    "unclassified": dict(unclass), "reconciled": sum(r["possessions"] for r in rows) == len(classified)},
        "ppp_diff": {"transicion_vs_media_cancha": _m(diff("transicion")), "early_vs_media_cancha": _m(diff("early"))},
        "games_used": used, "games_total": total, "games_excluded": excluded,
    }
    trans = by["transicion"]
    if side == "ataque":
        out.update(_attack_blocks(classified, trans, per_game, team_code))
    else:
        out.update(_defense_blocks(classified, trans, per_game, team_code, mine, comp_id, ctx))
    return out


def _attack_blocks(classified, trans, per_game, team_code):
    with_shot = [p for p in classified if p.shots and p.shots[0].get("elapsed") is not None]
    hist = [{"label": lab, "possessions": sum(1 for p in with_shot if lo <= p.shots[0]["elapsed"] <= hi)}
            for lo, hi, lab in FIRST_SHOT_BINS]
    first_shot = {"mean": _m(stats_engine._safe_div(sum(p.shots[0]["elapsed"] for p in with_shot), len(with_shot))),
                  "distribution": hist, "possessions": len(with_shot),
                  "without_shot": len(classified) - len(with_shot)}
    by_origin = Counter()
    for p in classified:
        by_origin["otros" if p.origin in _OTHER_ORIGINS else p.origin] += 1
    origin_rows = _group_rows(trans, "origin", [(k, lab) for k, lab in ORIGIN_GROUPS], by_origin)
    played = [p for p in trans if p.finish_kind != "fin_periodo"]
    finish = []
    for k in FINISH_KINDS:
        grp = [p for p in played if p.finish_kind == k]
        finish.append({"key": k, "label": FINISH_LABELS[k], "possessions": len(grp),
                       "share": round(len(grp) / len(played), 4) if played else None,
                       "pts": sum(p.pts for p in grp), "ppp": _m(_ppp(grp))})
    drb = [p for p in classified if p.origin == "rebote_defensivo"]
    to_tr = [p for p in drb if p.ptype == "transicion"]
    scored = [p for p in to_tr if p.pts > 0]
    dreb = {"defensive_rebounds": len(drb), "to_transition": len(to_tr), "scored": len(scored),
            "share": _m(round(len(to_tr) / len(drb), 4) if drb else None),
            "scored_share": _m(round(len(scored) / len(to_tr), 4) if to_tr else None)}
    return {"first_shot": first_shot, "origin_of_transition": origin_rows, "finish_in_transition": finish,
            "dreb_to_transition": dreb, "pass_out": PASS_OUT,
            "players": _players(trans), "reconcile_fastbreak": reconcile_fastbreak(per_game, team_code)}


def _players(trans):
    ini, fin, fin_pts, ast = Counter(), Counter(), Counter(), Counter()
    for p in trans:
        if p.starter_id is not None:
            ini[p.starter_id] += 1
        if p.end_player_id is not None:
            fin[p.end_player_id] += 1
            fin_pts[p.end_player_id] += p.pts
        if p.assister_id is not None and p.pts > 0:
            ast[p.assister_id] += 1
    rows = []
    for pid in sorted(set(ini) | set(fin) | set(ast)):
        card = identity.player_card(pid)
        rows.append({"player_id": pid, "name": (card or {}).get("display_name") or f"jugador {pid}",
                     "initiated": ini[pid], "finished": fin[pid], "pts": fin_pts[pid],
                     "ppp_personal": _m(round(fin_pts[pid] / fin[pid], 4) if fin[pid] else None),
                     "assists_in_transition": ast[pid],
                     "sample": sample.sample_level("origin", n=fin[pid], unit="posesiones")})
    rows.sort(key=lambda r: (-r["finished"], -r["initiated"], r["player_id"]))
    return {"rows": rows, "coverage": {"initiator_identified": sum(1 for p in trans if p.starter_id is not None),
                                       "transitions": len(trans)}}


def _defense_blocks(classified, trans, per_game, team_code, mine, comp_id, ctx):
    conceded = {"value": round(100 * len(trans) / len(classified), 2) if classified else None,
                "reason": None if classified else "sin_intentos", "transitions": len(trans)}
    by_origin = _group_rows(trans, "origin", [(k, lab, mem) for k, lab, mem in CONCEDED_GROUPS])
    # pérdidas propias seguidas de una transición rival
    own_tov = followed = scored = excl = 0
    for _, ps in per_game:
        for i, p in enumerate(ps):
            if p.team != team_code or p.incomplete or p.end_type != "perdida" or i + 1 >= len(ps):
                continue
            q = ps[i + 1]
            if q.team != p.opp or q.period != p.period or q.period_type != p.period_type:
                continue
            if q.incomplete:
                excl += 1
                continue
            own_tov += 1
            if q.ptype == "transicion":
                followed += 1
                scored += 1 if q.pts > 0 else 0
    # balance defensivo: tiros de campo propios fallados que terminan en transición rival con puntos
    own_attack = [p for _, ps in per_game for p in ps if p.team == team_code and not p.incomplete]
    misses = sum((p.box.get("fga2") or 0) + (p.box.get("fga3") or 0) - (p.box.get("fgm2") or 0)
                 - (p.box.get("fgm3") or 0) for p in own_attack)
    rival_scored = sum(1 for p in trans if p.origin == "rebote_defensivo" and p.pts > 0)
    return {
        "conceded_per100": conceded, "conceded_by_origin": by_origin,
        "own_turnovers_to_transition": {
            "own_turnovers": own_tov, "followed_by_transition": followed, "followed_by_scored": scored,
            "excluded_next_incomplete": excl,
            "share": _m(round(followed / own_tov, 4) if own_tov else None),
            "scored_share": _m(round(scored / followed, 4) if followed else None)},
        "balance": {"rival_scored_transitions": rival_scored, "fg_misses": misses,
                    "share": _m(round(rival_scored / misses, 4) if misses else None),
                    "per100_possessions": _m(round(100 * rival_scored / len(own_attack), 2) if own_attack else None)},
    }


def reconcile_fastbreak(per_game, team_code):
    """Validación cruzada NO bloqueante: puntos de transición reconstruidos vs `fast_break_pts` del box de FIBA.

    Solo partidos con ingesta actual: el box se importó con `PointsFastBreak` bien leído. FIBA y el cliente no usan
    el mismo criterio, por eso se informa la diferencia sin marcarla como error."""
    import ingest
    from database import Game, TeamGameStats
    games, excluded = [], []
    for g, ps in per_game:
        game = Game.query.filter_by(game_id=g["game_id"]).first()
        if game is None or (game.ingest_version or 1) < ingest.INGEST_VERSION:
            excluded.append({"game_id": g["game_id"], "reason": "no_registrado"})
            continue
        tgs = TeamGameStats.query.filter_by(game_id=g["game_id"], team_code=team_code).first()
        mine = sum(p.pts for p in ps if p.team == team_code and p.ptype == "transicion")
        official = tgs.fast_break_pts if tgs is not None else None
        games.append({"game_id": g["game_id"], "reconstructed": mine, "official": official,
                      "diff": None if official is None else mine - official})
    return {"games": games, "excluded": excluded,
            "note": "Criterio distinto al de FIBA: la diferencia es informativa, no un error."}


# ── API ──────────────────────────────────────────────────────────────────────

def _echo(ctx, used, total, excluded):
    import metrics_catalog as mc
    return context_mod.context_echo(
        ctx, games_used=used, games_total=total, games_excluded=excluded, ignored=[],
        competition_label=mc._competition_label(ctx))


def transition_report(team_code, comp_id, ctx, *, side="ataque"):
    key = (team_code, comp_id, context_mod.context_key(ctx), side)
    out = dict(cache.memo("poss:ptype", key, lambda: _build_report(team_code, comp_id, ctx, side)))
    out["context"] = _echo(ctx, out.pop("games_used"), out.pop("games_total"), out.pop("games_excluded"))
    return out


def player_transition(player_id, comp_id, ctx):
    """Posesiones que el jugador finaliza por tipo y sus transiciones iniciadas / asistidas."""
    card = identity.player_card(player_id)
    if card is None:
        return None
    pid = identity.canonical_id(player_id) or player_id
    mine, used, total, excluded, _ = _selection(card["team_code"], comp_id, ctx, "ataque")
    classified = [p for p in mine if not p.incomplete and p.ptype]
    fin = [p for p in classified if p.end_player_id == pid]
    rows = []
    for k in PTYPES:
        grp = [p for p in fin if p.ptype == k]
        shot_fin = [p for p in grp if p.end_type in ("t2c", "t2f", "t3c", "t3f")]
        efg = (sum(1 for p in shot_fin if p.end_type == "t2c") + 1.5 * sum(1 for p in shot_fin if p.end_type == "t3c"))
        rows.append({"key": k, "label": LABELS[k], "possessions": len(grp),
                     "share": round(len(grp) / len(fin), 4) if fin else None,
                     "metrics": {"ppp": _m(_ppp(grp)),
                                 "efg_pct": _m(round(efg / len(shot_fin), 4) if shot_fin else None)},
                     "sample": sample.sample_level("origin", n=len(grp), unit="posesiones")})
    trans = [p for p in classified if p.ptype == "transicion"]
    runner = {"initiated": sum(1 for p in trans if p.starter_id == pid),
              "initiated_pts": sum(p.pts for p in trans if p.starter_id == pid),
              "assists_in_transition": sum(1 for p in trans if p.assister_id == pid and p.pts > 0),
              "pass_out": PASS_OUT}
    return {"side": "ataque", "types": rows, "runner": runner,
            "summary": {"possessions": len(fin), "classified": len(fin), "reconciled": True},
            "context": _echo(ctx, used, total, excluded)}


# ── Entidad `ptype` (T-05) y tabla `team_ptypes` (T-06) ──────────────────────

def _parse_id(entity_id):
    team_code, _, key = str(entity_id).partition(":")
    if key not in PTYPES:
        raise metrics_catalog.MetricsError("Tipo inválido. Usá " + ", ".join(PTYPES), 400, "parametro_invalido")
    return team_code.upper(), key


def _side(params):
    side = (params or {}).get("side") or "ataque"
    if side not in SIDES:
        raise metrics_catalog.MetricsError("El lado debe ser ataque o defensa.", 400, "parametro_invalido")
    return side


def ptype_bundle(team_code, key, comp_id, ctx, side="ataque"):
    k = ("ptype_bundle", team_code, key, comp_id, context_mod.context_key(ctx), side)
    return repository.memo(k, lambda: _ptype_bundle(team_code, key, comp_id, ctx, side))


def _ptype_bundle(team_code, key, comp_id, ctx, side):
    mine, used, total, excluded, _ = _selection(team_code, comp_id, ctx, side)
    group = [p for p in mine if not p.incomplete and p.ptype == key]
    if not group:
        return None
    bk = origin_mod._BUNDLE_KEYS
    own = {k: sum(p.box.get(k) or 0 for p in group) for k in bk}
    opp = {k: sum(p.opp_box.get(k) or 0 for p in group) for k in bk}
    own["pts"], opp["pts"] = sum(p.pts for p in group), 0
    own["plus_minus"] = opp["plus_minus"] = None
    seconds = sum(p.duration or 0 for p in group)
    name = origin_mod._team_name(team_code)
    meta = {"team_code": team_code, "team_name": name, "split": True, "poss_exact": True, "ptype": key,
            "side": side, "variant": f"{key}:{side}", "games_total": total, "games_excluded": excluded}
    return StatBundle(
        entity_type="split", entity_id=team_code, name=name, own=own, opp=opp, team=None,
        games=len({p.game_id for p in group}), minutes=seconds / 60, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=len(group), null_reasons={}, meta=meta)


def _ptype_loader(req):
    team_code, key = _parse_id(req.entity_id)
    b = ptype_bundle(team_code, key, req.comp_id, req.ctx, _side(req.params))
    return [b] if b is not None else []


def all_ptype_bundles(comp_id, ctx, variant=None):
    if not variant or ":" not in str(variant):
        return []
    key, side = str(variant).split(":", 1)
    if key not in PTYPES or side not in SIDES:
        return []
    out = []
    for code in sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()}):
        b = ptype_bundle(code, key, comp_id, ctx, side)
        if b is not None:
            out.append(b)
    return out


metrics_catalog.register_entity("ptype", _ptype_loader, enumerator=all_ptype_bundles)


def table_rows(treq):
    team_code = (treq.params.get("team") or "").upper()
    side = treq.params.get("side") or "ataque"
    if side not in SIDES:
        raise tables.TableError(400, "El lado debe ser ataque o defensa.", "parametro_invalido", {"param": "side"})
    mine, _, _, _, _ = _selection(team_code, treq.comp_id, treq.ctx, side)
    complete = [p for p in mine if not p.incomplete]
    classified = [p for p in complete if p.ptype]
    rows = []
    for key in PTYPES:
        n = sum(1 for p in classified if p.ptype == key)
        rows.append(tables.TableRow(
            id=f"{team_code}:{key}", link=None,
            texts={"_ptype": LABELS[key], "_share": origin_mod._share_text(n, len(classified))},
            bundle=ptype_bundle(team_code, key, treq.comp_id, treq.ctx, side),
            sample=sample.sample_level("origin", n=n, unit="posesiones", team_poss=len(complete)),
            extra={"possessions": n}, reason_if_null="sin_intentos"))
    return rows


tables.register_table(
    "team_ptypes", entity_type="ptype", title="Transición y tipo de posesión", builder=table_rows,
    required_params=("team",),
    default_columns=("_ptype", "possessions", "_share", "pts", "oer", "efg_pct", "to_pct", "ft_rate"),
    bulk_scopes=("team",), row_kind="entity",
    extra_columns=(("_ptype", "Tipo", "text"), ("_share", "% del total", "text")),
    default_sort=None, totals_mode="none",
    title_fn=lambda treq: (
        f"Tipo de posesión{' rival' if treq.params.get('side') == 'defensa' else ''} — "
        f"{(treq.params.get('team') or '').upper()}"),
)
