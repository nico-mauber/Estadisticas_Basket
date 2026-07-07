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


def clutch_rows(events_by_game, game_info):
    """Una fila por equipo-partido con métricas del cierre.

    events_by_game: {game_id: [ev dict, ...]}
    game_info:      {game_id: {date, home_code, away_code, home_team, away_team}}
    """
    out = []
    for gid, evs in events_by_game.items():
        reg_periods = [e["period"] for e in evs
                       if e.get("period_type") == "REGULAR" and e.get("period")]
        last_reg = max(reg_periods) if reg_periods else 4
        clutch = [e for e in evs if _is_clutch(e, last_reg)]
        codes = [c for c in {e.get("team_code") for e in clutch} if c]
        if len(codes) != 2:
            continue  # sin eventos de cierre con 2 equipos (ej. sólo subs) → se omite
        gi = game_info.get(gid, {})
        for tc in codes:
            opp = next(c for c in codes if c != tc)
            tb = _agg([e for e in clutch if e.get("team_code") == tc])
            ob = _agg([e for e in clutch if e.get("team_code") == opp])
            t_pos, o_pos = _pos(tb), _pos(ob)
            top_fin, top_cre = _leaders([e for e in clutch if e.get("team_code") == tc])
            if tc == gi.get("home_code"):
                team_name = gi.get("home_team")
            elif tc == gi.get("away_code"):
                team_name = gi.get("away_team")
            else:
                team_name = tc
            out.append({
                "game_id":         gid,
                "date":            gi.get("date", ""),
                "team_code":       tc,
                "team_name":       team_name,
                "opponent_code":   opp,
                "home_away":       "L" if tc == gi.get("home_code") else "V",
                "pts":             tb["pts"],
                "opp_pts":         ob["pts"],
                "point_diff":      tb["pts"] - ob["pts"],
                "off_rating":      _safe_div(tb["pts"], t_pos),
                "def_rating":      _safe_div(ob["pts"], o_pos),
                "efg_pct":         _safe_div(tb["fgm"] + 0.5 * tb["fgm3"], tb["fga"]),
                "ts_pct":          _safe_div(tb["pts"], 2 * (tb["fga"] + 0.44 * tb["fta"])),
                "tov":             tb["tov"],
                "ast":             tb["ast"],
                "reb":             tb["orb"] + tb["drb"],
                "fouls_committed": tb["foul"],
                "fouls_drawn":     tb["foulon"],
                "possessions":     round(t_pos, 2),
                "top_finisher":    top_fin,
                "top_creator":     top_cre,
            })
    return out
