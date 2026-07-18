"""Clutch (últimos 5 minutos del partido) — agregación sobre pbp_events. Feature 05.

Ventana clutch = último período REGULAR con clock_secs <= 300 + todos los eventos OT.
Métricas con fórmulas de docs/metrics.md; semántica null de Feature 08 (tasa con
denominador 0 → None).
"""
from stats_engine import _safe_div

CLUTCH_SECS = 300


def _is_clutch(ev, last_regular):
    if ev.get("period_type") == "OT":
        return True
    return (
        ev.get("period_type") == "REGULAR"
        and ev.get("period") == last_regular
        and (ev.get("clock_secs") or 0) <= CLUTCH_SECS
    )


def _agg(evs):
    """Agrega stats crudas de una lista de eventos pbp de un equipo."""
    b = dict(fgm2=0, fga2=0, fgm3=0, fga3=0, ftm=0, fta=0, orb=0, drb=0,
             ast=0, tov=0, stl=0, blk=0, foul=0, foulon=0)
    for ev in evs:
        at = ev.get("action_type")
        ok = ev.get("success") == 1
        st = (ev.get("sub_type") or "").lower()
        if at == "2pt":
            b["fga2"] += 1; b["fgm2"] += 1 if ok else 0
        elif at == "3pt":
            b["fga3"] += 1; b["fgm3"] += 1 if ok else 0
        elif at == "freethrow":
            b["fta"] += 1; b["ftm"] += 1 if ok else 0
        elif at == "rebound":
            if "offensive" in st:   b["orb"] += 1
            elif "defensive" in st: b["drb"] += 1
        elif at == "assist":   b["ast"] += 1
        elif at == "turnover": b["tov"] += 1
        elif at == "steal":    b["stl"] += 1
        elif at == "block":    b["blk"] += 1
        elif at == "foul":     b["foul"] += 1
        elif at == "foulon":   b["foulon"] += 1
    b["pts"] = 2 * b["fgm2"] + 3 * b["fgm3"] + b["ftm"]
    b["fga"] = b["fga2"] + b["fga3"]
    b["fgm"] = b["fgm2"] + b["fgm3"]
    return b


def _pos(b):
    """POS = 2PA + 3PA + FTA×0.44 + TOV − OR (docs/metrics.md)."""
    return b["fga2"] + b["fga3"] + 0.44 * b["fta"] + b["tov"] - b["orb"]


def _leaders(evs):
    """Jugador que más finaliza (puntos) y que más crea (asistencias) en el cierre."""
    pts, ast = {}, {}
    for ev in evs:
        p = ev.get("player_name") or ""
        if not p:
            continue
        at = ev.get("action_type")
        ok = ev.get("success") == 1
        if at == "2pt" and ok:        pts[p] = pts.get(p, 0) + 2
        elif at == "3pt" and ok:      pts[p] = pts.get(p, 0) + 3
        elif at == "freethrow" and ok: pts[p] = pts.get(p, 0) + 1
        elif at == "assist":          ast[p] = ast.get(p, 0) + 1
    top_p = max(pts.items(), key=lambda kv: kv[1]) if pts else None
    top_a = max(ast.items(), key=lambda kv: kv[1]) if ast else None
    return (
        {"name": top_p[0], "pts": top_p[1]} if top_p else None,
        {"name": top_a[0], "ast": top_a[1]} if top_a else None,
    )


def _entry_margin(evs, last_reg):
    """Diferencia absoluta de marcador al abrir la ventana (minuto 5:00).

    Toma el `s1`/`s2` corrido del último evento con `clock_secs > 300` del último
    período REGULAR (marcador al entrar al cierre). Sin evento previo → 0 (califica).
    Ver sdd/specs/05-clutch/spec.md §10.1.
    """
    pre = [e for e in evs
           if e.get("period_type") == "REGULAR" and e.get("period") == last_reg
           and (e.get("clock_secs") or 0) > CLUTCH_SECS]
    if not pre:
        return 0
    last = max(pre, key=lambda e: e.get("action_number") or 0)
    return abs((last.get("s1") or 0) - (last.get("s2") or 0))


_SUM_KEYS = ["fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "orb", "drb",
             "ast", "tov", "stl", "blk", "foul", "foulon", "pts", "fga", "fgm"]


def _box_metrics(tb, ob):
    """Métricas de cierre (docs/metrics.md) sobre un box de equipo + rival."""
    t_pos, o_pos = _pos(tb), _pos(ob)
    return {
        "off_rating": _safe_div(tb["pts"], t_pos),
        "def_rating": _safe_div(ob["pts"], o_pos),
        "efg_pct":    _safe_div(tb["fgm"] + 0.5 * tb["fgm3"], tb["fga"]),
        "ts_pct":     _safe_div(tb["pts"], 2 * (tb["fga"] + 0.44 * tb["fta"])),
        "possessions": round(t_pos, 2),
    }


def team_clutch(games, team_code, team_name, margin=15):
    """Cierre agregado ("mini-partido") + desglose por partido de UN equipo.

    games: [{game_id, events, opp_code, info:{date, home_away}}, ...] (Feature 02).
    Solo cuentan los partidos con diferencia ≤ `margin` al minuto 5:00 (§10.1).
    Ver sdd/specs/05-clutch/spec.md §10.
    """
    per_game, team_boxes, opp_boxes = [], [], []
    excluded = wins = losses = ties = 0

    for g in games:
        evs = g["events"]
        opp = g["opp_code"]
        reg_periods = [e["period"] for e in evs
                       if e.get("period_type") == "REGULAR" and e.get("period")]
        last_reg = max(reg_periods) if reg_periods else 4

        em = _entry_margin(evs, last_reg)
        if em > margin:
            excluded += 1                       # paliza al 5:00 → no es un cierre
            continue

        clutch = [e for e in evs if _is_clutch(e, last_reg)]
        codes = {e.get("team_code") for e in clutch if e.get("team_code")}
        if team_code not in codes or opp not in codes:
            continue                            # sin eventos de cierre de ambos equipos

        tb = _agg([e for e in clutch if e.get("team_code") == team_code])
        ob = _agg([e for e in clutch if e.get("team_code") == opp])
        team_boxes.append(tb)
        opp_boxes.append(ob)
        top_fin, top_cre = _leaders([e for e in clutch if e.get("team_code") == team_code])

        pd = tb["pts"] - ob["pts"]
        if   pd > 0: wins += 1
        elif pd < 0: losses += 1
        else:        ties += 1

        gi = g.get("info", {})
        per_game.append({
            "game_id":         g["game_id"],
            "date":            gi.get("date", ""),
            "opponent_code":   opp,
            "home_away":       gi.get("home_away", ""),
            "entry_margin":    em,
            "pts":             tb["pts"],
            "opp_pts":         ob["pts"],
            "point_diff":      pd,
            "tov":             tb["tov"],
            "ast":             tb["ast"],
            "reb":             tb["orb"] + tb["drb"],
            "fouls_committed": tb["foul"],
            "fouls_drawn":     tb["foulon"],
            "top_finisher":    top_fin,
            "top_creator":     top_cre,
            **_box_metrics(tb, ob),
        })

    T = {k: sum(b.get(k, 0) for b in team_boxes) for k in _SUM_KEYS}
    O = {k: sum(b.get(k, 0) for b in opp_boxes)  for k in _SUM_KEYS}
    aggregate = {
        "pts_for":         T["pts"],
        "pts_against":     O["pts"],
        "point_diff":      T["pts"] - O["pts"],
        "reb":             T["orb"] + T["drb"],
        "ast":             T["ast"],
        "tov":             T["tov"],
        "stl":             T["stl"],
        "blk":             T["blk"],
        "fouls_committed": T["foul"],
        "fouls_drawn":     T["foulon"],
        **_box_metrics(T, O),
    }

    per_game.sort(key=lambda r: (r.get("date") or "", r["game_id"]), reverse=True)
    return {
        "team_code":       team_code,
        "team_name":       team_name,
        "margin":          margin,
        "games_qualified": len(per_game),
        "games_excluded":  excluded,
        "clutch_record":   f"{wins}-{losses}-{ties}",
        "aggregate":       aggregate,
        "per_game":        per_game,
    }
