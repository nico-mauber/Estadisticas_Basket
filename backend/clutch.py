"""Clutch (cierres de partido) — agregación sobre pbp_events. Feature 05 · C-06.

Ventana clutch = último período REGULAR con clock_secs <= window_secs + todas las prórrogas.
Métricas con fórmulas de docs/metrics.md; semántica null de Feature 08 (tasa con
denominador 0 → None).
"""
from stats_engine import _safe_div, StatBundle
import config

MARGIN_RANGE = (0, 40)
WINDOW_RANGE = (60, 600)

OVERTIME_TYPES = ("OVERTIME", "OT")   # FIBA manda OVERTIME; OT es el valor legado


def _is_clutch(ev, last_regular, window_secs):
    if ev.get("period_type") in OVERTIME_TYPES:
        return True
    return (
        ev.get("period_type") == "REGULAR"
        and ev.get("period") == last_regular
        and (ev.get("clock_secs") or 0) <= window_secs
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


def _entry_margin(evs, last_reg, window_secs):
    """Diferencia absoluta de marcador al abrir la ventana (p. ej. minuto 5:00).

    Toma el `s1`/`s2` corrido del último evento con `clock_secs > window_secs` del último
    período REGULAR (marcador al entrar al cierre). Sin evento previo → 0 (califica).
    Ver sdd/specs/05-clutch/spec.md §10.1.
    """
    pre = [e for e in evs
           if e.get("period_type") == "REGULAR" and e.get("period") == last_reg
           and (e.get("clock_secs") or 0) > window_secs]
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


def _qualified_games(games, team_code, margin, window_secs):
    """Partidos calificados de cierre (plan §4.7, extraído de `team_clutch` para que
    `clutch_bundle` use la MISMA selección). Un partido califica si la diferencia al entrar a la
    ventana es ≤ `margin` y hay eventos de cierre de AMBOS equipos (§10.1).

    Devuelve `{"qualified": [...], "excluded": n, "without_events": m}` — cada elemento de
    `qualified` es `{game_id, date, opp, home_away, entry_margin, overtimes, tb, ob, clutch_evs}`
    (`tb`/`ob` = `_agg` del equipo/rival sobre los eventos de cierre).
    """
    qualified = []
    excluded = without_events = 0
    for g in games:
        evs = g["events"]
        opp = g["opp_code"]
        reg_periods = [e["period"] for e in evs
                       if e.get("period_type") == "REGULAR" and e.get("period")]
        last_reg = max(reg_periods) if reg_periods else 4

        em = _entry_margin(evs, last_reg, window_secs)
        if em > margin:
            excluded += 1                       # paliza al entrar al cierre → no es un cierre
            continue

        clutch = [e for e in evs if _is_clutch(e, last_reg, window_secs)]
        codes = {e.get("team_code") for e in clutch if e.get("team_code")}
        if team_code not in codes or opp not in codes:
            without_events += 1                 # sin eventos de cierre de ambos equipos
            continue
        overtimes = len({e.get("period") for e in evs if e.get("period_type") in OVERTIME_TYPES})

        tb = _agg([e for e in clutch if e.get("team_code") == team_code])
        ob = _agg([e for e in clutch if e.get("team_code") == opp])

        qualified.append({
            "game_id": g["game_id"], "date": g.get("info", {}).get("date", ""),
            "opp": opp, "home_away": g.get("info", {}).get("home_away", ""),
            "entry_margin": em, "overtimes": overtimes,
            "tb": tb, "ob": ob, "clutch_evs": clutch,
        })
    return {"qualified": qualified, "excluded": excluded, "without_events": without_events}


def team_clutch(games, team_code, team_name, margin=None, window_secs=None, games_without_pbp=0):
    """Cierre agregado ("mini-partido") + desglose por partido de UN equipo.

    games: partidos con pbp [{game_id, events, opp_code, info:{date, home_away}}, ...].
    Solo cuentan los partidos con diferencia ≤ `margin` al entrar a la ventana (§10.1).
    `margin`/`window_secs` en None → DEFAULT_MARGIN/DEFAULT_WINDOW_SECS (C-06).
    `games_without_pbp`: partidos del equipo en el universo que no tienen pbp (solo se
    informan, para que el recuento cierre). Ver sdd/specs/05-clutch/spec.md §10.
    """
    margin = config.get("clutch.margin") if margin is None else margin
    window_secs = config.get("clutch.window_secs") if window_secs is None else window_secs

    sel = _qualified_games(games, team_code, margin, window_secs)
    excluded, without_events = sel["excluded"], sel["without_events"]
    per_game, team_boxes, opp_boxes = [], [], []
    wins = losses = ties = 0

    for q in sel["qualified"]:
        tb, ob = q["tb"], q["ob"]
        team_boxes.append(tb)
        opp_boxes.append(ob)
        top_fin, top_cre = _leaders([e for e in q["clutch_evs"] if e.get("team_code") == team_code])

        pd = tb["pts"] - ob["pts"]
        if   pd > 0: wins += 1
        elif pd < 0: losses += 1
        else:        ties += 1

        per_game.append({
            "game_id":         q["game_id"],
            "date":            q["date"],
            "opponent_code":   q["opp"],
            "home_away":       q["home_away"],
            "entry_margin":    q["entry_margin"],
            "overtime_periods": q["overtimes"],
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
        "window_secs":     window_secs,
        # Recuento: qualified + excluded + without_clutch_events = with_pbp;
        # with_pbp + without_pbp = total.
        "games_total":     len(games) + games_without_pbp,
        "games_with_pbp":  len(games),
        "games_without_pbp": games_without_pbp,
        "games_qualified": len(per_game),
        "games_excluded":  excluded,             # diferencia mayor al umbral
        "games_without_clutch_events": without_events,
        "clutch_record":   f"{wins}-{losses}-{ties}",
        "aggregate":       aggregate,
        "per_game":        per_game,
    }


def _clutch_box_to_bundle(tb, ob, team_code, team_name, window_secs, overtimes, game_id):
    """`StatBundle` de UN partido de cierre (mismo armado de conteos que `clutch_bundle`)."""
    own = {k: tb.get(k, 0) for k in _SUM_KEYS}
    opp = {k: ob.get(k, 0) for k in _SUM_KEYS}
    own["pf"] = own.pop("foul", 0)
    own["fouls_drawn"] = own.pop("foulon", 0)
    opp["pf"] = opp.pop("foul", 0)
    opp["fouls_drawn"] = opp.pop("foulon", 0)
    own["blk_received"] = opp.get("blk", 0)
    opp["blk_received"] = own.get("blk", 0)
    own["plus_minus"] = own.get("pts", 0) - opp.get("pts", 0)
    opp["plus_minus"] = opp.get("pts", 0) - own.get("pts", 0)
    seconds = window_secs + 300 * overtimes
    minutes = seconds / 60 if seconds else 0.0
    return StatBundle(
        entity_type="clutch", entity_id=team_code, name=team_name,
        own=own, opp=opp, team=None,
        games=1, minutes=minutes, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=None,
        null_reasons={},
        meta={"team_code": team_code, "window_secs": window_secs, "game_ids": [game_id]},
    )


def clutch_game_bundles(req) -> list:
    """`[(dict_partido, StatBundle), ...]` por cierre calificado de un equipo (T-06, loader de
    partido del tipo `clutch`). `req` es un `metrics_catalog.EntityRequest`."""
    import identity
    import repository
    team_code = str(req.entity_id).upper()
    comp_id = req.comp_id
    margin = (req.params or {}).get("margin")
    window_secs = (req.params or {}).get("window_secs")
    margin = config.get("clutch.margin") if margin is None else margin
    window_secs = config.get("clutch.window_secs") if window_secs is None else window_secs

    games = repository.team_pbp_games(team_code, comp_id)
    games = _filter_pbp_games(games, req.ctx)
    games = identity.canonicalize_pbp_games(games, team_code)
    if not games:
        return []

    row = None
    for r in repository.team_game_rows(comp_id).values():
        if r["team_code"] == team_code:
            row = r
    team_name = row["team_name"] if row else team_code

    opp_names = {}
    for r in repository.team_game_rows(comp_id).values():
        opp_names[r["team_code"]] = r["team_name"]

    sel = _qualified_games(games, team_code, margin, window_secs)
    out = []
    for q in sel["qualified"]:
        bundle = _clutch_box_to_bundle(q["tb"], q["ob"], team_code, team_name,
                                       window_secs, q["overtimes"], q["game_id"])
        info = {
            "game_id": q["game_id"], "date": q["date"],
            "opponent_code": q["opp"], "opponent": opp_names.get(q["opp"], q["opp"]),
            "home_away": q["home_away"],
            "team_pts": q["tb"]["pts"], "opp_pts": q["ob"]["pts"], "played": True,
            "entry_margin": q["entry_margin"], "overtimes": q["overtimes"],
        }
        out.append((info, bundle))
    # orden cronológico descendente (como team_clutch.per_game)
    out.sort(key=lambda t: (t[0].get("date") or "", t[0]["game_id"]), reverse=True)
    return out


def _filter_pbp_games(games, ctx):
    """Últimos N partidos del contexto sobre `repository.team_pbp_games` (idéntico a
    `bundles._filter_pbp_games`; se duplica para evitar el import cruzado)."""
    out = sorted(games, key=lambda g: (g.get("info", {}).get("date") or "", g.get("game_id") or ""))
    if ctx and getattr(ctx, "last", None):
        out = out[-ctx.last:]
    return out


def clutch_bundle(games, team_code, team_name, margin=None, window_secs=None) -> "StatBundle | None":
    """`StatBundle` del cierre agregado de un equipo (plan §4.7): reusa `_qualified_games` (misma
    selección que `team_clutch`). `None` si ningún partido del equipo tiene pbp."""
    if not games:
        return None
    margin = config.get("clutch.margin") if margin is None else margin
    window_secs = config.get("clutch.window_secs") if window_secs is None else window_secs

    sel = _qualified_games(games, team_code, margin, window_secs)
    qualified = sel["qualified"]

    own = {k: sum(q["tb"].get(k, 0) for q in qualified) for k in _SUM_KEYS}
    opp = {k: sum(q["ob"].get(k, 0) for q in qualified) for k in _SUM_KEYS}
    own["pf"] = own.pop("foul", 0)
    own["fouls_drawn"] = own.pop("foulon", 0)
    opp["pf"] = opp.pop("foul", 0)
    opp["fouls_drawn"] = opp.pop("foulon", 0)
    own["blk_received"] = opp.get("blk", 0)
    opp["blk_received"] = own.get("blk", 0)
    own["plus_minus"] = own.get("pts", 0) - opp.get("pts", 0)
    opp["plus_minus"] = opp.get("pts", 0) - own.get("pts", 0)

    seconds = sum(window_secs + 300 * q["overtimes"] for q in qualified)
    minutes = seconds / 60 if seconds else 0.0
    games_sin_pbp = 0   # el llamador (app.py) conoce `games_without_pbp`; T-05 no lo recibe acá

    return StatBundle(
        entity_type="clutch", entity_id=team_code, name=team_name,
        own=own, opp=opp, team=None,
        games=len(qualified), minutes=minutes, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=None,
        null_reasons={},
        meta={"team_code": team_code, "margin": margin, "window_secs": window_secs,
              "games_excluded": {"paliza": sel["excluded"], "sin_pbp": games_sin_pbp},
              "games_total": len(games)},
    )
