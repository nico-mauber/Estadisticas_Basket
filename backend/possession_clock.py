"""Tramo de reloj de posesión (A-05) y composición de puntos del equipo.

`enrich_clock` se registra como enriquecedor de `possessions` y completa, sobre el reloj de posesión derivado,
el tramo de cada tiro (`shots[].band`, `shots[].clock_start`) y, por oportunidad (`Chance`), su evento de
decisión, su tramo, sus conteos (`box`) y el tipo de pérdida. Tramos: temprano (0 a `clock.early_max`, 8 s),
medio (hasta `clock.mid_max`, 16 s) y tardío (el resto hasta 24 s). Tras rebote ofensivo el reloj se reinicia a
14 s (`clock.reset_secs`): esas oportunidades se analizan aparte (`r14`) y no tienen tramo tardío.

FIBA LiveStats no publica el shot clock: el reloj de posesión se deriva restando el reloj de partido en el
evento al reloj de partido al inicio de la oportunidad (resolución de 1 s). Un tiro sin reloj derivable queda
sin tramo (`no_clock`), nunca como `temprano`.

`clock_report` agrega por tramo en ataque y en defensa, para un equipo y una selección de partidos (o un
partido). `points_mix` descompone los puntos del equipo en triples, dobles y tiros libres y mide el peso de
pérdidas y asistencias. Todo on-the-fly: nada se persiste.
"""
from collections import Counter, defaultdict

import cache
import config
import context as context_mod
import identity
import possessions
import repository
import sample
import stats_engine
import transition as transition_mod
from flask import has_app_context

BANDS = ("temprano", "medio", "tardio")
BAND_LABELS = {"temprano": "Temprano", "medio": "Medio", "tardio": "Tardío"}
SIDES = ("ataque", "defensa")
TURNOVER_KIND = {"badpass": "pase", "ballhandling": "manejo", "travel": "pasos", "24sec": "viol24"}
TURNOVER_KINDS = ("pase", "manejo", "pasos", "viol24", "otras")
TURNOVER_LABELS = {"pase": "Pase", "manejo": "Manejo", "pasos": "Pasos", "viol24": "24 segundos", "otras": "Otras"}
PAINT_ZONES = frozenset({"restricted_area"})   # igual que `paint_fga_share` del conjunto estándar (T-05)
SOURCE_NOTE = "Reloj de posesión derivado del reloj de partido (FIBA no publica el shot clock)."
# Cómo termina la oportunidad = su evento de decisión (un tiro al final del período tiene `end_type` fin_periodo)
_DEC_KIND = {"2pt": "t2", "3pt": "t3", "freethrow": "tl", "turnover": "perdida"}


def _cuts():
    if has_app_context():
        return int(config.get("clock.early_max")), int(config.get("clock.mid_max")), int(config.get("clock.reset_secs"))
    return 8, 16, 14


def band_of(elapsed, shot_clock_start, cuts=None):
    """Tramo del reloj de posesión; None si el reloj no es derivable (nunca `temprano`)."""
    if elapsed is None:
        return None
    early, mid, _ = cuts or _cuts()
    if elapsed <= early:
        return "temprano"
    if shot_clock_start >= 24:
        return "medio" if elapsed <= mid else "tardio"
    return "medio" if elapsed <= min(mid, shot_clock_start) else None   # reloj de 14: sin tramo tardío


# ── Enriquecedor ─────────────────────────────────────────────────────────────

def _chance_box(own):
    box = {"fga2": 0, "fgm2": 0, "fga3": 0, "fgm3": 0, "fta": 0, "ftm": 0, "tov": 0, "viol24": 0}
    for ev in own:
        at, ok = ev.get("action_type"), ev.get("success") == 1
        if at in ("2pt", "3pt"):
            n = 3 if at == "3pt" else 2
            box[f"fga{n}"] += 1
            box[f"fgm{n}"] += 1 if ok else 0
        elif at == "freethrow":
            box["fta"] += 1
            box["ftm"] += 1 if ok else 0
        elif at == "turnover":
            box["tov"] += 1
            box["viol24"] += 1 if (ev.get("sub_type") or "").lower() == "24sec" else 0
    return box


def enrich_clock(poss, events, meta):
    """Enriquecedor de A-01: tramo por tiro y por oportunidad, `Chance.box` y tipo de pérdida."""
    cuts = _cuts()
    idx, mc = meta["event_index"], meta["mclock_list"]
    for p in poss:
        for ch in p.chances:
            ch.band = ch.end_elapsed = ch.box = ch.turnover_kind = ch.end_player_id = None
        for s in p.shots:
            s["band"], s["clock_start"] = None, None
        if p.incomplete or not p.chances:
            continue
        starts = [ch.start_event for ch in p.chances]
        for k, ch in enumerate(p.chances):
            lo = idx.get(ch.start_event)
            if lo is None:
                continue
            if k + 1 < len(p.chances) and p.chances[k + 1].start_event in idx:
                hi = idx[p.chances[k + 1].start_event]
            else:
                hi = idx[p.end_event] + 1 if p.end_event in idx else len(events)
            own = [ev for ev in events[lo:hi] if ev.get("team_code") == p.team]
            ch.box = _chance_box(own)
            dec = None
            fga = [ev for ev in own if ev.get("action_type") in ("2pt", "3pt")]
            if fga:
                dec = fga[-1]
            elif ch.end_type == "perdida":
                dec = next((ev for ev in own if ev.get("action_type") == "turnover"), None)
            elif ch.end_type == "falta":
                dec = next((ev for ev in own if ev.get("action_type") == "freethrow"), None)
            if dec is None or dec["action_number"] not in idx:
                continue
            ch.box["dec"] = _DEC_KIND.get(dec.get("action_type"))
            ch.end_player_id = meta["name_to_id"].get((p.team, dec.get("player_name")))
            e = ch.start_clock - mc[idx[dec["action_number"]]]
            ch.end_elapsed = e if 0 <= e <= ch.shot_clock_start + 1 else None
            ch.band = band_of(ch.end_elapsed, ch.shot_clock_start, cuts)
            if dec.get("action_type") == "turnover":
                ch.turnover_kind = TURNOVER_KIND.get((dec.get("sub_type") or "").lower(), "otras")
        for s in p.shots:
            k = max((i for i, st in enumerate(starts) if st <= s["action_number"]), default=0)
            ch = p.chances[k]
            s["clock_start"] = ch.shot_clock_start
            s["band"] = band_of(s["elapsed"], ch.shot_clock_start, cuts)


possessions.register_enricher("clock", enrich_clock)


# ── Agregación ───────────────────────────────────────────────────────────────

def _m(v):
    return {"value": v, "reason": None if v is not None else "sin_intentos"}


def _div(a, b, nd=4):
    return round(a / b, nd) if b else None


def _counts(chs, shots):
    """Sumas de un bloque (tramo × reloj): oportunidades `chs` [(posesión, Chance)] y tiros `shots`."""
    c = {"n": len(chs), "pts": sum(ch.pts for _, ch in chs), "fga": len(shots), "fgm": sum(1 for s in shots if s["made"]),
         "fga3": sum(1 for s in shots if s.get("three")), "fgm3": sum(1 for s in shots if s.get("three") and s["made"]),
         "pts_fg": sum(s["pts"] for s in shots), "paint": sum(1 for s in shots if s.get("zone") in PAINT_ZONES),
         "fta": 0, "ftm": 0, "tov": 0, "viol24": 0, "t2": 0, "t3": 0, "tl": 0, "perdida": 0}
    types = Counter()
    for _, ch in chs:
        for k in ("fta", "ftm", "tov", "viol24"):
            c[k] += (ch.box or {}).get(k, 0)
        kind = (ch.box or {}).get("dec")
        if kind:
            c[kind] += 1
        if ch.turnover_kind:
            types[ch.turnover_kind] += 1
    c["types"] = dict(types)
    return c


def _block(c, team, side_games):
    """Un bloque ya con tasas: volumen, eFG%, TS%, PPT, PPP, TO%, violaciones y reparto."""
    rates = stats_engine.clock_rates(c)
    n = c["n"]
    return {
        "chances": n, "shots": c["fga"], "pts": c["pts"],
        "share": _div(c["fga"], team["fga"]),
        "pts_share": _div(c["pts_fg"], team["pts_fg"]),
        "metrics": {k: _m(v) for k, v in rates["metrics"].items()},
        "mix": {k: _m(v) for k, v in rates["mix"].items()},
        "threes": {"attempts": c["fga3"], "made": c["fgm3"], "pct": _m(_div(c["fgm3"], c["fga3"])),
                   "share_of_band": _m(_div(c["fga3"], c["fga"])),
                   "share_of_team_3pa": _m(_div(c["fga3"], team["fga3"])),
                   "pts": 3 * c["fgm3"], "pts_share": _m(_div(3 * c["fgm3"], team["pts_fg"]))},
        "shape": {"paint_share": _m(rates["paint_share"]),
                  "perimeter_share": _m(None if rates["paint_share"] is None else round(1 - rates["paint_share"], 4))},
        "turnover_types": {k: c["types"].get(k, 0) for k in TURNOVER_KINDS},
        "sample": sample.sample_level("split", n=n, unit="posesiones", team_poss=side_games["poss"]),
    }


def _selection(team_code, comp_id, ctx, side, game_id):
    """(posesiones del lado, partidos usados, partidos totales, excluidos, [(juego, posesiones)])."""
    if not game_id:
        return transition_mod._selection(team_code, comp_id, ctx, side)
    games = [g for g in repository.team_pbp_games(team_code, None) if g["game_id"] == game_id]
    per_game = [(g, possessions.game_possessions(g["game_id"])) for g in games]
    mine = [p for _, ps in per_game for p in ps if (p.team if side == "ataque" else p.opp) == team_code]
    return mine, len(games), len(games), {}, per_game


def _box_rows(per_game, team_code, side):
    """Filas oficiales (team_game_stats) del lado analizado en los partidos usados."""
    rows = repository.team_game_rows(None)
    out = []
    for g, _ in per_game:
        r = rows.get((g["game_id"], team_code))
        if r is None:
            continue
        if side == "defensa":
            r = rows.get((g["game_id"], r.get("opp_code")))
        if r is not None:
            out.append(r)
    return out


def _sum(rows, key):
    return sum(r.get(key) or 0 for r in rows)


def _team_assist_points(rows):
    """Puntos generados por las asistencias del lado analizado (A-12); estado del vínculo."""
    import assists
    total = {"fg2": 0, "fg3": 0, "ft": 0, "unlinked": 0, "ast_points": 0, "status": "ok"}
    if not rows:
        total["status"] = "sin_pbp"
        return total
    for r in rows:
        data = repository.game_pbp_data(r["game_id"])
        if not data:
            total["status"] = "sin_pbp" if total["status"] == "ok" else total["status"]
            continue
        mine = [e for e in data["events"] if e.get("team_code") == r["team_code"]]
        for row in assists.game_assist_links(mine).values():
            assists._merge(total, row)
    return total


def points_mix(rows):
    """Composición de los puntos del lado analizado y peso de pérdidas y asistencias (box oficial)."""
    pts = _sum(rows, "pts")
    fgm2, fgm3, ftm = _sum(rows, "fgm2"), _sum(rows, "fgm3"), _sum(rows, "ftm")
    fga2, fga3, fta = _sum(rows, "fga2"), _sum(rows, "fga3"), _sum(rows, "fta")
    tov, orb, ast = _sum(rows, "tov"), _sum(rows, "orb"), _sum(rows, "ast")
    poss = fga2 + fga3 + 0.44 * fta + tov - orb
    ppp = _div(pts, poss)
    parts = [
        {"key": "t3", "label": "Triples", "pts": 3 * fgm3, "made": fgm3, "attempts": fga3},
        {"key": "t2", "label": "Dobles", "pts": 2 * fgm2, "made": fgm2, "attempts": fga2},
        {"key": "tl", "label": "Tiros libres", "pts": ftm, "made": ftm, "attempts": fta},
    ]
    for part in parts:
        part["share"] = _m(_div(part["pts"], pts))
        part["pct"] = _m(_div(part["made"], part["attempts"]))
        part["attempts_share"] = _m(_div(part["attempts"], fga2 + fga3 + fta) if part["key"] != "tl"
                                    else _div(fta, fga2 + fga3 + fta))
    link = _team_assist_points(rows)
    linked_ok = link["status"] == "ok"
    ast_pts = link["ast_points"] if linked_ok else None
    return {
        "games": len(rows), "pts": pts, "parts": parts,
        "reconciled": sum(p["pts"] for p in parts) == pts,
        "possessions": round(poss, 1) if rows else None, "ppp": _m(ppp),
        "turnovers": {"count": tov, "per_game": _m(_div(tov, len(rows), 2)),
                      "poss_share": _m(_div(tov, poss)),
                      "est_points_lost": _m(None if ppp is None else round(tov * ppp, 1)),
                      "note": "Estimación: cada pérdida cuesta lo que el equipo anota en promedio por posesión."},
        "assists": {"count": ast, "per_game": _m(_div(ast, len(rows), 2)),
                    "fgm_assisted_share": _m(_div(ast, fgm2 + fgm3)),
                    "ast_points": {"value": ast_pts, "reason": None if linked_ok else
                                   ("sin_pbp" if link["status"] == "sin_pbp" else "no_registrado")},
                    "ast_points_share": _m(_div(ast_pts, pts) if linked_ok else None),
                    "linked": {"fg2": link["fg2"], "fg3": link["fg3"], "ft": link["ft"], "unlinked": link["unlinked"]},
                    "note": "Los tiros libres asistidos no suman puntos generados: no se sabe cuántos de la serie entraron."},
        "official_origin": {"second_chance": _sum(rows, "second_chance_pts"), "fast_break": _sum(rows, "fast_break_pts"),
                            "from_turnovers": _sum(rows, "pts_from_tov"), "paint": _sum(rows, "paint_pts")},
    }


# ── Jugador, matriz zona × tramo y panel de decisión (A-05, segunda entrega) ─────────────────────────────

ZONE_LABELS = {
    "restricted_area": "Pintura", "mid_left_close": "Media cerca (izq.)", "mid_right_close": "Media cerca (der.)",
    "mid_left_far": "Media lejos (izq.)", "mid_right_far": "Media lejos (der.)", "mid_top": "Media frontal",
    "left_corner_3": "Triple esquina (izq.)", "right_corner_3": "Triple esquina (der.)",
    "left_wing_3": "Triple ala (izq.)", "right_wing_3": "Triple ala (der.)", "top_key_3": "Triple frontal",
    "sin_zona": "Sin zona (sin coordenadas)",
}
MATRIX_BANDS = BANDS + ("sin_reloj",)


def _pname(pid):
    card = identity.player_card(pid) if pid is not None else None
    return (card or {}).get("display_name") or f"jugador {pid}"


def _index_players(chs, done_shots):
    """Índices del reloj de 24 s por (jugador, tramo): tiros, oportunidades que termina y oportunidades del equipo."""
    shots_by, fin_by, team_n = defaultdict(list), defaultdict(list), Counter()
    for s in done_shots:
        if s["band"] and (s["clock_start"] or 0) >= 24:
            shots_by[(s["player_id"], s["band"])].append(s)
    for p, ch in chs:
        if ch.band and ch.shot_clock_start >= 24:
            fin_by[(ch.end_player_id, ch.band)].append((p, ch))
            team_n[ch.band] += 1
    return shots_by, fin_by, team_n


def _player_band(sh, fin, n_team):
    """Métricas de un jugador en un tramo: sus tiros, las oportunidades que termina y su peso en las del equipo."""
    fga, fgm = len(sh), sum(1 for s in sh if s["made"])
    fgm3 = sum(1 for s in sh if s.get("three") and s["made"])
    pts_fg = sum(s["pts"] for s in sh)
    fta = sum((ch.box or {}).get("fta", 0) for _, ch in fin)
    ftm = sum((ch.box or {}).get("ftm", 0) for _, ch in fin)
    pts = sum(ch.pts for _, ch in fin)
    return {
        "shots": fga, "made": fgm,
        "efg_pct": _m(_div(fgm + 0.5 * fgm3, fga)), "ppt": _m(_div(pts_fg, fga)),
        "ts_pct": _m(_div(pts_fg + ftm, 2 * (fga + 0.44 * fta))),
        "finished": len(fin), "uso_pct": _m(_div(len(fin), n_team)), "ppp_personal": _m(_div(pts, len(fin))),
        "sample": sample.sample_level("origin", n=len(fin), unit="posesiones"),
    }


def _players_table(chs, done_shots):
    """Plantel por tramo (reloj de 24 s) más la fila "Equipo / sin jugador". Σ finished por tramo = oportunidades del equipo."""
    shots_by, fin_by, team_n = _index_players(chs, done_shots)
    pids = sorted({k[0] for k in list(shots_by) + list(fin_by)} - {None})
    rows = []
    for pid in pids:
        by_band = {b: _player_band(shots_by.get((pid, b), []), fin_by.get((pid, b), []), team_n[b]) for b in BANDS}
        rows.append({"player_id": pid, "name": _pname(pid), "by_band": by_band,
                     "finished": sum(v["finished"] for v in by_band.values()), "shots": sum(v["shots"] for v in by_band.values())})
    rows.sort(key=lambda r: (-r["finished"], -r["shots"], r["player_id"]))
    team_row = {"player_id": None, "name": "Equipo / sin jugador",
                "by_band": {b: _player_band(shots_by.get((None, b), []), fin_by.get((None, b), []), team_n[b]) for b in BANDS}}
    team_row["finished"] = sum(v["finished"] for v in team_row["by_band"].values())
    return {"rows": rows, "team_row": team_row,
            "totals": {b: {"chances": team_n[b],
                           "finished": sum(r["by_band"][b]["finished"] for r in rows) + team_row["by_band"][b]["finished"]}
                       for b in BANDS}}


def _matrix(done_shots):
    """Matriz zona × tramo (ambos relojes): intentos, FG%, eFG% y PPT por celda; Σ de cada tramo = tiros del tramo."""
    import shot_zones
    zones = list(shot_zones.ZONE_KEYS_11) + ["sin_zona"]
    cells = {z: {b: {"attempts": 0, "made": 0, "made3": 0, "pts": 0} for b in MATRIX_BANDS} for z in zones}
    for s in done_shots:
        c = cells[s.get("zone") or "sin_zona"][s["band"] or "sin_reloj"]
        c["attempts"] += 1
        c["made"] += 1 if s["made"] else 0
        c["made3"] += 1 if (s.get("three") and s["made"]) else 0
        c["pts"] += s["pts"]
    out = []
    for z in zones:
        row = {"key": z, "label": ZONE_LABELS[z], "bands": {}}
        for b in MATRIX_BANDS:
            c = cells[z][b]
            n = c["attempts"]
            row["bands"][b] = {"attempts": n, "made": c["made"], "fg_pct": _m(_div(c["made"], n)),
                               "efg_pct": _m(_div(c["made"] + 0.5 * c["made3"], n)), "ppt": _m(_div(c["pts"], n)),
                               "sample": sample.sample_level("zone", n=n, unit="intentos")}
        out.append(row)
    return {"zones": out, "bands": list(MATRIX_BANDS),
            "totals": {b: sum(cells[z][b]["attempts"] for z in zones) for b in MATRIX_BANDS},
            "has_coordinates": any(s.get("zone") for s in done_shots)}


def _band_means(team_code, comp_id, ctx, side):
    """PPP y eFG% por tramo (reloj de 24 s) de UN equipo: base del promedio de la competencia."""
    mine, *_ = transition_mod._selection(team_code, comp_id, ctx, side)
    complete = [p for p in mine if not p.incomplete]
    chs = [(p, ch) for p in complete for ch in p.chances]
    shots = [s for p in complete for s in p.shots]
    out = {}
    for b in BANDS:
        bc = [ch for _, ch in chs if ch.band == b and ch.shot_clock_start >= 24]
        bs = [s for s in shots if s["band"] == b and (s["clock_start"] or 0) >= 24]
        fgm3 = sum(1 for s in bs if s.get("three") and s["made"])
        out[b] = {"ppp": _div(sum(ch.pts for ch in bc), len(bc)),
                  "efg_pct": _div(sum(1 for s in bs if s["made"]) + 0.5 * fgm3, len(bs))}
    return out


def _league_bands(comp_id, ctx, side):
    """Promedio de la competencia por tramo: media de los equipos con valor (misma convención que T-01). None sin competencia."""
    if comp_id is None:
        return None
    import dataclasses

    def build():
        cx = dataclasses.replace(ctx, on=(), off=())
        codes = sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()})
        per_team = [_band_means(c, comp_id, cx, side) for c in codes]
        out = {}
        for b in BANDS:
            out[b] = {}
            for k in ("ppp", "efg_pct"):
                vals = [t[b][k] for t in per_team if t[b][k] is not None]
                out[b][k] = {"avg": _div(sum(vals), len(vals)), "teams": len(vals)}
        return out
    return cache.memo("poss:clock_league", (comp_id, context_mod.context_key(ctx), side), build)


def _decision(rows, players, league):
    """Las siete preguntas de decisión, con los números de la propia tabla de tramos (sin recalcular)."""
    r24 = {r["key"]: r["r24"] for r in rows}
    tov = {b: sum(r24[b]["turnover_types"].values()) for b in BANDS}
    tov_total = sum(tov.values())

    def val(b, k):
        return r24[b]["metrics"][k]["value"]

    q2 = []
    for b in BANDS:
        row = {"band": b, "sample": r24[b]["sample"]}
        for k in ("ppp", "efg_pct"):
            avg = ((league or {}).get(b, {}).get(k) or {}).get("avg")
            v = val(b, k)
            row[k] = {"value": v, "avg": avg, "dist_avg": None if v is None or avg is None else round(v - avg, 4)}
        q2.append(row)
    ranked = [r for r in q2 if r["ppp"]["value"] is not None and r["sample"]["level"] != "baja"]
    best = max(ranked, key=lambda r: r["ppp"]["value"])["band"] if ranked else None
    chances_b = {b: r24[b]["chances"] for b in BANDS}
    n_band = sum(chances_b.values())
    ppp_t, ppp_e = val("tardio", "ppp"), val("temprano", "ppp")
    top = {}
    if players:
        for b in BANDS:
            cands = [r for r in players["rows"] if r["by_band"][b]["finished"] > 0]
            cands.sort(key=lambda r: -r["by_band"][b]["finished"])
            top[b] = [{"player_id": r["player_id"], "name": r["name"], "finished": r["by_band"][b]["finished"],
                       "uso_pct": r["by_band"][b]["uso_pct"], "efg_pct": r["by_band"][b]["efg_pct"],
                       "sample": r["by_band"][b]["sample"]} for r in cands[:3]]
    return {
        "q1_perdidas": {"to_pct": {b: val(b, "to_pct") for b in BANDS}, "turnovers": tov,
                        "share_of_turnovers": {b: _div(tov[b], tov_total) for b in BANDS},
                        "by_type": {b: r24[b]["turnover_types"] for b in BANDS}},
        "q2_eficiencia": {"best_band": best, "rows": q2, "league": bool(league)},
        "q3_zona_tramo": {"ref": "matrix"},
        "q4_seleccion": [{"band": b, "mix": {k: v["value"] for k, v in r24[b]["mix"].items()},
                          "paint_share": r24[b]["shape"]["paint_share"]["value"],
                          "perimeter_share": r24[b]["shape"]["perimeter_share"]["value"]} for b in BANDS],
        "q5_decide": {"top_by_band": top},
        "q6_costo_tardio": {"ppp_tardio": _m(ppp_t), "ppp_temprano": _m(ppp_e),
                            "diff": _m(None if ppp_t is None or ppp_e is None else round(ppp_t - ppp_e, 4)),
                            "reach_tardio_share": _m(_div(chances_b["tardio"], n_band)),
                            "chances": chances_b},
        "q7_rival": {"ref": "side=defensa"},
    }


def _build(team_code, comp_id, ctx, side, game_id):
    mine, used, total, excluded, per_game = _selection(team_code, comp_id, ctx, side, game_id)
    complete = [p for p in mine if not p.incomplete]
    cuts = _cuts()
    all_shots = [s for p in mine for s in p.shots]
    done_shots = [s for p in complete for s in p.shots]
    team = {"fga": len(all_shots), "fga3": sum(1 for s in all_shots if s.get("three")),
            "pts_fg": sum(s["pts"] for s in all_shots), "poss": len(complete)}
    chs = [(p, ch) for p in complete for ch in p.chances]
    rows = []
    for key in BANDS:
        sh_all = [s for s in done_shots if s["band"] == key]
        row = {"key": key, "label": BAND_LABELS[key],
               "range": ("0–%d s" % cuts[0]) if key == "temprano" else
               ("%d–%d s" % (cuts[0] + 1, cuts[1])) if key == "medio" else "%d–24 s" % (cuts[1] + 1),
               "all": {"shots": len(sh_all), "share": _div(len(sh_all), team["fga"])}}
        for blk, is24 in (("r24", True), ("r14", False)):
            if blk == "r14" and key == "tardio":
                row[blk] = {"value": None, "reason": "no_aplica"}
                continue
            bc = [(p, ch) for p, ch in chs if ch.band == key and (ch.shot_clock_start >= 24) == is24]
            bs = [s for s in sh_all if ((s["clock_start"] or 0) >= 24) == is24]
            row[blk] = _block(_counts(bc, bs), team, team)
        rows.append(row)
    in24 = sum(r["r24"]["shots"] for r in rows)
    in14 = sum(r["r14"]["shots"] for r in rows if "shots" in r["r14"])
    no_clock = sum(1 for s in done_shots if s["band"] is None)
    in_inc = sum(len(p.shots) for p in mine if p.incomplete)
    box = _box_rows(per_game, team_code, side)
    fga_team = _sum(box, "fga2") + _sum(box, "fga3")
    no_clock_ch = sum(1 for _, ch in chs if ch.band is None and (ch.box or {}).get("dec"))
    players_tbl = _players_table(chs, done_shots) if side == "ataque" else None
    return {
        "side": side,
        "clock_source": {"kind": "derivado", "resolution_secs": 1, "note": SOURCE_NOTE},
        "thresholds": {"early_max": cuts[0], "mid_max": cuts[1], "reset_secs": cuts[2]},
        "bands": rows,
        "no_clock": {"shots": no_clock, "chances": no_clock_ch, "reason": "reloj_no_derivable"},
        "reconcile": {"fga_team": fga_team, "fga_engine": team["fga"], "in_bands_24": in24, "in_bands_14": in14,
                      "no_clock": no_clock, "in_incomplete": in_inc,
                      "ok": in24 + in14 + no_clock + in_inc == fga_team,
                      "chances_24": sum(1 for _, ch in chs if ch.shot_clock_start >= 24),
                      "chances_14": sum(1 for _, ch in chs if ch.shot_clock_start < 24)},
        "points_mix": points_mix(box),
        "matrix": _matrix(done_shots),
        "players": players_tbl,
        "decision": _decision(rows, players_tbl, _league_bands(comp_id, ctx, side) if not game_id else None),
        "summary": {"possessions": len(complete), "incomplete": len(mine) - len(complete), "shots": team["fga"]},
        "games_used": used, "games_total": total, "games_excluded": excluded,
    }


def player_clock(player_id, comp_id, ctx):
    """Tramos del reloj de posesión de UN jugador: sus tiros y las oportunidades que termina, con su peso en las del equipo."""
    card = identity.player_card(player_id)
    if card is None:
        return None
    pid = identity.canonical_id(player_id) or player_id

    def build():
        mine, used, total, excluded, _ = transition_mod._selection(card["team_code"], comp_id, ctx, "ataque")
        complete = [p for p in mine if not p.incomplete]
        chs = [(p, ch) for p in complete for ch in p.chances]
        done_shots = [s for p in complete for s in p.shots]
        shots_by, fin_by, team_n = _index_players(chs, done_shots)
        by_band = {b: _player_band(shots_by.get((pid, b), []), fin_by.get((pid, b), []), team_n[b]) for b in BANDS}
        cuts = _cuts()
        return {"side": "ataque", "clock_source": {"kind": "derivado", "resolution_secs": 1, "note": SOURCE_NOTE},
                "thresholds": {"early_max": cuts[0], "mid_max": cuts[1], "reset_secs": cuts[2]},
                "by_band": by_band,
                "bands": [{"key": b, "label": BAND_LABELS[b], "chances": team_n[b]} for b in BANDS],
                "summary": {"shots": sum(v["shots"] for v in by_band.values()),
                            "finished": sum(v["finished"] for v in by_band.values()),
                            "possessions": len(complete)},
                "games_used": used, "games_total": total, "games_excluded": excluded}
    out = dict(cache.memo("poss:clock_player", (pid, comp_id, context_mod.context_key(ctx)), build))
    out["context"] = transition_mod._echo(ctx, out.pop("games_used"), out.pop("games_total"), out.pop("games_excluded"))
    return out


def clock_report(team_code, comp_id, ctx, *, side="ataque", game_id=None):
    key = (team_code, comp_id, context_mod.context_key(ctx), side, game_id)
    out = dict(cache.memo("poss:clock", key, lambda: _build(team_code, comp_id, ctx, side, game_id)))
    out["context"] = transition_mod._echo(ctx, out.pop("games_used"), out.pop("games_total"), out.pop("games_excluded"))
    if game_id:
        out["game_id"] = game_id
        out["context"]["label"] = f"Partido {game_id}"
    return out
