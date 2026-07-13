"""Motor de reconstrucción de quintetos en cancha — base de Lineups (Feature 03)
y ON/OFF (Feature 04).

Camina `pbp_events` (ordenados por `action_number`) de un partido: el quinteto
en cancha de un equipo solo cambia con SUS PROPIOS eventos `substitution`
(`sub_type` in/out); todo lo demás (incluidos tiros libres y rebotes) se
atribuye al tramo vigente. Ver sdd/specs/03-lineups/spec.md RF-1/RF-2 y
sdd/specs/04-on-off/spec.md RF-1. Semántica null de tasas: Feature 08.
"""
from stats_engine import _safe_div

PERIOD_LEN = {"REGULAR": 600, "OT": 300}  # segundos (10' por cuarto, 5' por prórroga FIBA)


def _agg(evs, team_code):
    """Agrega stats crudas de un equipo sobre una lista de eventos pbp (mismo esquema que clutch._agg)."""
    b = dict(fgm2=0, fga2=0, fgm3=0, fga3=0, ftm=0, fta=0, orb=0, drb=0,
             ast=0, tov=0, stl=0, blk=0)
    for ev in evs:
        if ev.get("team_code") != team_code:
            continue
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
    b["pts"] = 2 * b["fgm2"] + 3 * b["fgm3"] + b["ftm"]
    b["fga"] = b["fga2"] + b["fga3"]
    b["fgm"] = b["fgm2"] + b["fgm3"]
    return b


_BOX_KEYS = ["fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "orb", "drb",
             "ast", "tov", "stl", "blk", "pts", "fga", "fgm"]


def _sum_boxes(boxes):
    out = {k: 0 for k in _BOX_KEYS}
    for b in boxes:
        for k in _BOX_KEYS:
            out[k] += b.get(k, 0)
    return out


def _pos(b):
    """POS = 2PA + 3PA + FTA×0.44 + TOV − OR (docs/metrics.md)."""
    return b["fga2"] + b["fga3"] + 0.44 * b["fta"] + b["tov"] - b["orb"]


def _metrics(tb, ob):
    t_pos, o_pos = _pos(tb), _pos(ob)
    oer = _safe_div(tb["pts"], t_pos)
    der = _safe_div(ob["pts"], o_pos)
    net = round(oer - der, 4) if (oer is not None and der is not None) else None
    efg = _safe_div(tb["fgm"] + 0.5 * tb["fgm3"], tb["fga"])
    ts  = _safe_div(tb["pts"], 2 * (tb["fga"] + 0.44 * tb["fta"]))
    return t_pos, o_pos, {"oer": oer, "der": der, "net_rating": net, "efg_pct": efg, "ts_pct": ts}


def game_starters(player_rows, team_code):
    """5 titulares (`starter=1`) de ese equipo en ese partido, o None si no son exactamente 5."""
    names = {r.player_name for r in player_rows if r.team_code == team_code and r.starter == 1}
    return names if len(names) == 5 else None


def build_segments(events, team_code, starters):
    """events (de un partido, ordenados por action_number) → lista de tramos.

    Cada tramo: {"on_court": frozenset, "events": [...], "seconds": float}.

    Los eventos `substitution` del equipo actualizan `on_court` pero NO cortan un
    tramo por sí mismos: un tramo nuevo solo arranca cuando llega un evento de
    juego con un `on_court` distinto. Así, varios cambios simultáneos (mismo
    reloj) se fusionan en UN solo cambio de quinteto y nunca se generan quintetos
    parciales transitorios (4/3/2 jugadores) que mal-atribuyan eventos o segundos.

    Segundos por tramo: los eventos vienen ordenados por `action_number`, no por
    reloj, así que el reloj puede saltar hacia arriba dentro de un período (misma
    jugada registrada fuera de orden). Se acumula tiempo solo cuando el reloj baja
    de un nuevo mínimo del período (`period_floor`); los saltos hacia atrás no
    suman ni se re-cuentan. Al cerrar cada período se vuelca su cola
    (`period_floor`, del mínimo alcanzado hasta 0:00) al tramo abierto → la suma
    de segundos de todos los tramos es EXACTA: PERIOD_LEN por período (600 regular
    / 300 OT), y por lo tanto ON+OFF de un jugador = tiempo total de juego.
    """
    segments = []
    on_court = set(starters)
    cur_on = frozenset(on_court)
    bucket, seg_seconds = [], 0.0
    last_period = None
    period_floor = None   # reloj mínimo (seg restantes) alcanzado en el período actual

    for ev in events:
        period = ev.get("period")
        clock  = ev.get("clock_secs") or 0
        plen   = PERIOD_LEN.get(ev.get("period_type"), 600)

        if period != last_period:
            # volcar la cola del período anterior (de su mínimo hasta 0:00) al tramo abierto
            if period_floor is not None:
                seg_seconds += period_floor
            period_floor = plen        # el período nuevo arranca con el reloj completo
            last_period = period

        # avanzar tiempo solo cuando el reloj llega a un nuevo mínimo del período;
        # saltos hacia atrás (clock >= floor) no suman y nunca se re-cuentan
        if clock < period_floor:
            seg_seconds += period_floor - clock
            period_floor = clock

        if ev.get("action_type") == "substitution" and ev.get("team_code") == team_code:
            player, sub = ev.get("player_name"), (ev.get("sub_type") or "").lower()
            if sub == "out":
                on_court.discard(player)
            elif sub == "in":
                on_court.add(player)
            # cambio pendiente: se materializa al llegar el próximo evento de juego
        else:
            new_on = frozenset(on_court)
            if new_on != cur_on and bucket:
                # el quinteto cambió desde el último evento de juego; el tiempo
                # acumulado transcurrió con el quinteto viejo → se cierra con él
                segments.append({"on_court": cur_on, "events": bucket, "seconds": seg_seconds})
                bucket, seg_seconds = [], 0.0
            cur_on = new_on
            bucket.append(ev)

    # volcar la cola del último período al tramo abierto
    if period_floor is not None:
        seg_seconds += period_floor
    segments.append({"on_court": cur_on, "events": bucket, "seconds": seg_seconds})
    return segments


def _leaders(evs, players):
    """Líderes de puntos/asistencias/rebotes entre `players`, sobre los eventos dados."""
    pts, ast, treb = {}, {}, {}
    for ev in evs:
        p = ev.get("player_name") or ""
        if p not in players:
            continue
        at, ok = ev.get("action_type"), ev.get("success") == 1
        if at == "2pt" and ok:         pts[p] = pts.get(p, 0) + 2
        elif at == "3pt" and ok:       pts[p] = pts.get(p, 0) + 3
        elif at == "freethrow" and ok: pts[p] = pts.get(p, 0) + 1
        elif at == "assist":           ast[p] = ast.get(p, 0) + 1
        elif at == "rebound":          treb[p] = treb.get(p, 0) + 1

    def _top(d, key):
        if not d:
            return None
        name, val = max(d.items(), key=lambda kv: kv[1])
        return {"name": name, key: val}

    return _top(pts, "pts"), _top(ast, "ast"), _top(treb, "trb")


def lineup_stats(games, team_code, players):
    """games: [{game_id, events, player_rows, opp_code}, ...] del equipo (Feature 02).

    players: iterable de 3-5 nombres. Retorna sample/metrics/raw/leaders +
    games_used/games_excluded (Feature 03 RF-1..RF-7).
    """
    players = set(players)
    team_boxes, opp_boxes, leader_evs = [], [], []
    total_seconds = 0.0
    games_used = games_excluded = 0

    for g in games:
        starters = game_starters(g["player_rows"], team_code)
        if starters is None:
            games_excluded += 1
            continue
        games_used += 1
        segments = build_segments(g["events"], team_code, starters)
        matched = [s for s in segments if players <= s["on_court"]]
        if not matched:
            continue
        evs = [ev for s in matched for ev in s["events"]]
        team_boxes.append(_agg(evs, team_code))
        opp_boxes.append(_agg(evs, g["opp_code"]))
        total_seconds += sum(s["seconds"] for s in matched)
        leader_evs.extend(evs)

    tb, ob = _sum_boxes(team_boxes), _sum_boxes(opp_boxes)
    t_pos, o_pos, metrics = _metrics(tb, ob)
    scorer, assister, rebounder = _leaders(leader_evs, players)

    return {
        "games_used":     games_used,
        "games_excluded": games_excluded,
        "sample": {
            "possessions": round(t_pos, 2),
            "seconds":     round(total_seconds, 1),
        },
        "metrics": metrics,
        "raw": {
            "fga": tb["fga"], "fgm": tb["fgm"], "fga3": tb["fga3"], "fgm3": tb["fgm3"],
            "fta": tb["fta"], "ftm": tb["ftm"], "orb": tb["orb"], "drb": tb["drb"],
            "ast": tb["ast"], "tov": tb["tov"], "stl": tb["stl"], "blk": tb["blk"],
        },
        "leaders": {
            "scorer":    scorer,
            "assister":  assister,
            "rebounder": rebounder,
        },
    }


def _side_metrics(boxes, opp_boxes, seconds):
    tb, ob = _sum_boxes(boxes), _sum_boxes(opp_boxes)
    t_pos, o_pos, metrics = _metrics(tb, ob)
    return {
        "possessions":  round(t_pos, 2),
        "seconds":      round(seconds, 1),
        "pts_for":      tb["pts"],
        "pts_against":  ob["pts"],
        # conteos crudos del equipo (RF-8): escalan con los minutos del conjunto
        "reb":          tb["orb"] + tb["drb"],
        "orb":          tb["orb"],
        "drb":          tb["drb"],
        "ast":          tb["ast"],
        "tov":          tb["tov"],
        "stl":          tb["stl"],
        "blk":          tb["blk"],
        **metrics,
    }


def onoff_stats(games, team_code, player_name):
    """games: [{game_id, events, player_rows, opp_code}, ...] del equipo (Feature 02).

    Partición exhaustiva y disjunta ON/OFF de todos los eventos del equipo
    (Feature 04 RF-1..RF-5, CA-5).
    """
    on_boxes, off_boxes, on_opp_boxes, off_opp_boxes = [], [], [], []
    on_seconds = off_seconds = 0.0
    games_used = games_excluded = 0

    for g in games:
        starters = game_starters(g["player_rows"], team_code)
        if starters is None:
            games_excluded += 1
            continue
        games_used += 1
        segments = build_segments(g["events"], team_code, starters)
        on_segs  = [s for s in segments if player_name in s["on_court"]]
        off_segs = [s for s in segments if player_name not in s["on_court"]]
        on_evs   = [ev for s in on_segs  for ev in s["events"]]
        off_evs  = [ev for s in off_segs for ev in s["events"]]

        on_boxes.append(_agg(on_evs, team_code))
        off_boxes.append(_agg(off_evs, team_code))
        on_opp_boxes.append(_agg(on_evs, g["opp_code"]))
        off_opp_boxes.append(_agg(off_evs, g["opp_code"]))
        on_seconds  += sum(s["seconds"] for s in on_segs)
        off_seconds += sum(s["seconds"] for s in off_segs)

    on  = _side_metrics(on_boxes,  on_opp_boxes,  on_seconds)
    off = _side_metrics(off_boxes, off_opp_boxes, off_seconds)

    def _diff(key):
        a, b = on.get(key), off.get(key)
        return round(a - b, 4) if (a is not None and b is not None) else None

    diff = {k: _diff(k) for k in ("oer", "der", "net_rating", "efg_pct", "ts_pct")}

    return {
        "games_used":     games_used,
        "games_excluded": games_excluded,
        "on":   on,
        "off":  off,
        "diff": diff,
    }
