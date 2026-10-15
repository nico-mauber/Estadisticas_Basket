"""Motor de reconstrucción de quintetos en cancha — base de Lineups (Feature 03)
y ON/OFF (Feature 04).

Camina `pbp_events` (ordenados por `action_number`) de un partido: el quinteto
en cancha de un equipo solo cambia con SUS PROPIOS eventos `substitution`
(`sub_type` in/out); todo lo demás (incluidos tiros libres y rebotes) se
atribuye al tramo vigente. Ver sdd/specs/03-lineups/spec.md RF-1/RF-2 y
sdd/specs/04-on-off/spec.md RF-1. Semántica null de tasas: Feature 08.
"""
import itertools

from stats_engine import _safe_div, StatBundle

# Segundos por período: 10' por cuarto, 5' por prórroga. FIBA manda la prórroga como
# periodType "OVERTIME" (con `period` reiniciado en 1), no "OT" (F-11 RF-15).
PERIOD_LEN = {"REGULAR": 600, "OVERTIME": 300}

# `sub_type` de faltas que NO son personales de un jugador en cancha (faltas de banco o de
# cuerpo técnico): no suman a `pf` (T-05 plan §4.6).
_NON_PERSONAL_FOUL_SUBTYPES = frozenset({"benchtechnical", "coachtechnical"})


def _agg(evs, team_code):
    """Agrega stats crudas de un equipo sobre una lista de eventos pbp (mismo esquema que clutch._agg).

    T-05: suma además `pf` (faltas personales propias, sin técnicas de banco/CT) y
    `fouls_drawn` (faltas `foulon` del equipo = faltas que le cometieron, RF-13)."""
    b = dict(fgm2=0, fga2=0, fgm3=0, fga3=0, ftm=0, fta=0, orb=0, drb=0,
             ast=0, tov=0, stl=0, blk=0, pf=0, fouls_drawn=0)
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
        elif at == "foul":
            if st not in _NON_PERSONAL_FOUL_SUBTYPES:
                b["pf"] += 1
        elif at == "foulon":   b["fouls_drawn"] += 1
    b["pts"] = 2 * b["fgm2"] + 3 * b["fgm3"] + b["ftm"]
    b["fga"] = b["fga2"] + b["fga3"]
    b["fgm"] = b["fgm2"] + b["fgm3"]
    return b


_BOX_KEYS = ["fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "orb", "drb",
             "ast", "tov", "stl", "blk", "pts", "fga", "fgm", "pf", "fouls_drawn"]


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
    / 300 prórroga), y por lo tanto ON+OFF de un jugador = tiempo total de juego.
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


def build_segments_both(events, codes, starters):
    """Quintetos de AMBOS equipos por tramo (A-01 RF-9).

    codes: (home_code, away_code).
    starters: {code: set(nombres) | None}. None si no hay 5 titulares.
    Salida: [{"on_court": {code: frozenset | None}, "events": [...], "seconds": float}].
    Invariante: sum(s["seconds"]) == 600*quarters + 300*overtimes.
    """
    home, away = codes
    on_court = {}
    for code in codes:
        s = starters.get(code)
        on_court[code] = set(s) if s else None

    def _frozen():
        return {c: (frozenset(on_court[c]) if on_court[c] is not None else None) for c in codes}

    segments = []
    cur_on = _frozen()
    bucket, seg_seconds = [], 0.0
    last_period = None
    period_floor = None

    for ev in events:
        period = ev.get("period")
        clock = ev.get("clock_secs") or 0
        plen = PERIOD_LEN.get(ev.get("period_type"), 600)

        if period != last_period:
            if period_floor is not None:
                seg_seconds += period_floor
            period_floor = plen
            last_period = period

        if clock < period_floor:
            seg_seconds += period_floor - clock
            period_floor = clock

        tc = ev.get("team_code")
        if ev.get("action_type") == "substitution" and tc in codes and on_court[tc] is not None:
            player = ev.get("player_name")
            sub = (ev.get("sub_type") or "").lower()
            if sub == "out":
                on_court[tc].discard(player)
            elif sub == "in":
                on_court[tc].add(player)
        else:
            new_on = _frozen()
            if new_on != cur_on and bucket:
                segments.append({"on_court": cur_on, "events": bucket, "seconds": seg_seconds})
                bucket, seg_seconds = [], 0.0
            cur_on = new_on
            bucket.append(ev)

    if period_floor is not None:
        seg_seconds += period_floor
    segments.append({"on_court": cur_on, "events": bucket, "seconds": seg_seconds})
    return segments


def event_lineups(events, codes, starters):
    """Per-event lineup lookup (A-01): returns list parallel to events.

    Each entry: {code: frozenset | None} — the on_court at that event.
    Substitutions update state but get the PREVIOUS lineup (before the sub applies).
    """
    home, away = codes
    on_court = {}
    for code in codes:
        s = starters.get(code)
        on_court[code] = set(s) if s else None

    def _frozen():
        return {c: (frozenset(on_court[c]) if on_court[c] is not None else None) for c in codes}

    result = []
    for ev in events:
        tc = ev.get("team_code")
        if ev.get("action_type") == "substitution" and tc in codes and on_court[tc] is not None:
            result.append(_frozen())
            player = ev.get("player_name")
            sub = (ev.get("sub_type") or "").lower()
            if sub == "out":
                on_court[tc].discard(player)
            elif sub == "in":
                on_court[tc].add(player)
        else:
            result.append(_frozen())
    return result


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


def _lineup_boxes(games, team_code, players):
    """Partidos/tramos coincidentes de una combinación de jugadores (plan §4.6, extraído de
    `lineup_stats` para que `lineup_bundle` use la MISMA selección).

    games: [{game_id, events, player_rows, opp_code}, ...] del equipo (Feature 02).
    players: iterable de 3-5 nombres. Devuelve `{team_boxes, opp_boxes, leader_evs, total_seconds,
    games_used, games_excluded, games_matched}` — `games_matched` = partidos con ≥ 1 tramo
    coincidente (para `lineup_bundle.games`); `games_used` (Feature 03) cuenta los partidos CON
    titulares válidos, tengan o no tramo coincidente.
    """
    players = set(players)
    team_boxes, opp_boxes, leader_evs = [], [], []
    total_seconds = 0.0
    games_used = games_excluded = games_matched = 0

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
        games_matched += 1
        evs = [ev for s in matched for ev in s["events"]]
        team_boxes.append(_agg(evs, team_code))
        opp_boxes.append(_agg(evs, g["opp_code"]))
        total_seconds += sum(s["seconds"] for s in matched)
        leader_evs.extend(evs)

    return {
        "team_boxes": team_boxes, "opp_boxes": opp_boxes, "leader_evs": leader_evs,
        "total_seconds": total_seconds, "games_used": games_used,
        "games_excluded": games_excluded, "games_matched": games_matched,
    }


def lineup_stats(games, team_code, players):
    """games: [{game_id, events, player_rows, opp_code}, ...] del equipo (Feature 02).

    players: iterable de 3-5 nombres. Retorna sample/metrics/raw/leaders +
    games_used/games_excluded (Feature 03 RF-1..RF-7).
    """
    players = set(players)
    boxed = _lineup_boxes(games, team_code, players)
    team_boxes, opp_boxes = boxed["team_boxes"], boxed["opp_boxes"]

    tb, ob = _sum_boxes(team_boxes), _sum_boxes(opp_boxes)
    t_pos, o_pos, metrics = _metrics(tb, ob)
    scorer, assister, rebounder = _leaders(boxed["leader_evs"], players)

    return {
        "games_used":     boxed["games_used"],
        "games_excluded": boxed["games_excluded"],
        "sample": {
            "possessions": round(t_pos, 2),
            "seconds":     round(boxed["total_seconds"], 1),
        },
        "metrics": metrics,
        "raw": {
            "pts": tb["pts"], "pts_against": ob["pts"],
            "fga": tb["fga"], "fgm": tb["fgm"], "fga3": tb["fga3"], "fgm3": tb["fgm3"],
            "fta": tb["fta"], "ftm": tb["ftm"],
            "orb": tb["orb"], "drb": tb["drb"], "reb": tb["orb"] + tb["drb"],
            "ast": tb["ast"], "tov": tb["tov"], "stl": tb["stl"], "blk": tb["blk"],
        },
        "leaders": {
            "scorer":    scorer,
            "assister":  assister,
            "rebounder": rebounder,
        },
    }


def lineup_bundle(games, team_code, player_names, *, entity_id, name) -> "StatBundle | None":
    """`StatBundle` de una combinación de 3-5 jugadores (plan §4.6/§4.1), misma selección de
    partidos y tramos que `lineup_stats` (vía `_lineup_boxes`). `None` si ningún partido del
    equipo tiene pbp (el endpoint responde 404 `sin_pbp`)."""
    if not games:
        return None
    boxed = _lineup_boxes(games, team_code, player_names)
    own = dict(_sum_boxes(boxed["team_boxes"]))
    opp = dict(_sum_boxes(boxed["opp_boxes"]))
    own["blk_received"] = opp.get("blk", 0)
    opp["blk_received"] = own.get("blk", 0)
    own["plus_minus"] = own.get("pts", 0) - opp.get("pts", 0)
    opp["plus_minus"] = opp.get("pts", 0) - own.get("pts", 0)
    seconds = boxed["total_seconds"]
    minutes = seconds / 60 if seconds else 0.0
    return StatBundle(
        entity_type="lineup", entity_id=entity_id, name=name,
        own=own, opp=opp, team=None,
        games=boxed["games_matched"], minutes=minutes, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=None,
        null_reasons={},
        meta={"team_code": team_code, "games_total": boxed["games_used"],
              "games_excluded": {"sin_titulares": boxed["games_excluded"]}},
    )


def _lineup_bundles(games, team_code, size):
    """Agrupador interno (T-02 plan §4.2 pasos 2–4 / §4.3): `StatBundle` de CADA combinación de
    `size` jugadores que compartió cancha en `games` (no solo la que pide el usuario, a
    diferencia de `_lineup_boxes`/`lineup_bundle`). `games`: lista de partidos del equipo con pbp
    (mismo shape que `repository.team_pbp_games`, ya filtrados por contexto si corresponde).

    IDs ordenados por `player_id` (C-08): requiere que `player_name` ya esté canonicalizado
    (`identity.canonicalize_pbp_games`) para que las combinaciones de nombres distintos de un
    mismo jugador no se traten como quintetos distintos; el llamador resuelve nombre → id con
    `identity.resolve_player_id`/`Player.query` (igual que `bundles._names_for`, a la inversa).
    """
    from database import db, Player
    import identity

    acc: dict[tuple, dict] = {}   # combo (tuplas de ids ascendentes) -> {"evs": [...], "seconds": 0.0, "game_ids": set()}

    for g in games:
        starters = game_starters(g["player_rows"], team_code)
        if starters is None:
            continue
        segments = build_segments(g["events"], team_code, starters)
        for seg in segments:
            on_court = seg["on_court"]
            if len(on_court) < size:
                continue
            names = sorted(on_court)
            for combo_names in itertools.combinations(names, size):
                ids = []
                ok = True
                for name in combo_names:
                    pid = identity.resolve_player_id(team_code, name, create=False)
                    if pid is None:
                        ok = False
                        break
                    ids.append(identity.canonical_id(pid) or pid)
                if not ok:
                    continue
                ids_sorted = tuple(sorted(ids))
                entry = acc.setdefault(ids_sorted, {
                    "evs": [], "seconds": 0.0, "game_ids": set(), "names": {}
                })
                entry["evs"].extend(seg["events"])
                entry["seconds"] += seg["seconds"]
                entry["game_ids"].add(g["game_id"])
                for pid, name in zip(ids, combo_names):
                    canon_pid = identity.canonical_id(pid) or pid
                    entry["names"][canon_pid] = name

    out = []
    for ids_sorted, entry in acc.items():
        evs = entry["evs"]
        own = _agg(evs, team_code)
        opp_code = None
        for g in games:
            if g["game_id"] in entry["game_ids"]:
                opp_code = g["opp_code"]
                break
        opp = _agg(evs, opp_code) if opp_code else {k: 0 for k in own}
        own = dict(own)
        opp = dict(opp)
        own["blk_received"] = opp.get("blk", 0)
        opp["blk_received"] = own.get("blk", 0)
        own["plus_minus"] = own.get("pts", 0) - opp.get("pts", 0)
        opp["plus_minus"] = opp.get("pts", 0) - own.get("pts", 0)
        seconds = entry["seconds"]
        minutes = seconds / 60 if seconds else 0.0
        display_names = [entry["names"].get(pid, str(pid)) for pid in ids_sorted]
        entity_id = f"{team_code}:{'-'.join(str(i) for i in ids_sorted)}"
        out.append(StatBundle(
            entity_type="lineup", entity_id=entity_id, name=" · ".join(display_names),
            own=own, opp=opp, team=None,
            games=len(entry["game_ids"]), minutes=minutes, team_minutes=None, seconds=seconds,
            on_court=None, shots=None, possessions_counted=None,
            null_reasons={},
            meta={"team_code": team_code, "player_ids": list(ids_sorted)},
        ))
    return out


def all_lineups(team_code: str, comp_id: int | None, ctx, *, size: int = 5) -> list:
    """Todos los quintetos (o combinaciones de `size` jugadores) de un equipo en una competencia
    y contexto (T-02 plan §3.10/§4.2; adelantado para T-02, dueño final F-06).

    `ctx`: `context.Context` (fase 1: solo `last` aplica, vía `_filter_pbp_games`-equivalente).
    Cachea por petición igual que `repository.py` (`repository.memo`).
    """
    import context as context_mod
    import identity
    import repository as repo

    def build():
        games = repo.team_pbp_games(team_code, comp_id)
        out = sorted(games, key=lambda g: (g.get("info", {}).get("date") or "", g.get("game_id") or ""))
        if ctx.last:
            out = out[-ctx.last:]
        out = identity.canonicalize_pbp_games(out, team_code)
        return _lineup_bundles(out, team_code, size)

    key = ("lineups:" + team_code, comp_id, context_mod.context_key(ctx), size)
    return repo.memo(key, build)


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


def _onoff_bundle_side(boxes, opp_boxes, seconds, games, *, entity_id, name, games_total,
                       games_excluded) -> "StatBundle":
    own = dict(_sum_boxes(boxes))
    opp = dict(_sum_boxes(opp_boxes))
    own["blk_received"] = opp.get("blk", 0)
    opp["blk_received"] = own.get("blk", 0)
    own["plus_minus"] = own.get("pts", 0) - opp.get("pts", 0)
    opp["plus_minus"] = opp.get("pts", 0) - own.get("pts", 0)
    minutes = seconds / 60 if seconds else 0.0
    return StatBundle(
        entity_type="onoff", entity_id=entity_id, name=name,
        own=own, opp=opp, team=None,
        games=games, minutes=minutes, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=None,
        null_reasons={},
        meta={"team_code": None, "games_total": games_total,
              "games_excluded": {"sin_titulares": games_excluded}},
    )


def onoff_bundles(games, team_code, player_name, *, entity_id,
                  name) -> "tuple[StatBundle, StatBundle] | None":
    """`(on_bundle, off_bundle)` de un jugador (plan §4.6): misma partición ON/OFF que
    `onoff_stats`. `None` si ningún partido del equipo tiene pbp."""
    if not games:
        return None
    on_boxes, off_boxes, on_opp_boxes, off_opp_boxes = [], [], [], []
    on_seconds = off_seconds = 0.0
    on_games = off_games = games_used = games_excluded = 0

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
        secs_on = sum(s["seconds"] for s in on_segs)
        secs_off = sum(s["seconds"] for s in off_segs)
        on_seconds  += secs_on
        off_seconds += secs_off
        if secs_on > 0:
            on_games += 1
        if secs_off > 0:
            off_games += 1

    on_bundle = _onoff_bundle_side(on_boxes, on_opp_boxes, on_seconds, on_games,
                                   entity_id=entity_id, name=name, games_total=games_used,
                                   games_excluded=games_excluded)
    off_bundle = _onoff_bundle_side(off_boxes, off_opp_boxes, off_seconds, off_games,
                                    entity_id=entity_id, name=name, games_total=games_used,
                                    games_excluded=games_excluded)
    on_bundle.meta["team_code"] = team_code
    off_bundle.meta["team_code"] = team_code
    return on_bundle, off_bundle


def all_onoff_bundles(games, team_code) -> list:
    """ON+OFF de TODOS los jugadores de un equipo en una sola pasada (T-01 plan §4.2).

    `games`: partidos del equipo con pbp (`repository.team_pbp_games`, canonicalizados). Para cada
    partido con 5 titulares válidos recorre sus tramos; por tramo, cada jugador del plantel del
    partido suma los eventos al ON si está en `on_court` y al OFF si no (misma partición exhaustiva
    y disjunta que `onoff_stats`/`onoff_bundles`, pero resuelta jugador por jugador en una pasada).

    Devuelve la lista de bundles ON (uno por jugador que estuvo ≥ 1 tramo en cancha); cada bundle
    ON lleva `meta["off"]` = su bundle OFF y `meta["player_name"]`. `population` arma el id
    `team:player_id` con `identity.name_index`."""
    import identity

    name_idx = identity.name_index(team_code)

    # Universo de jugadores = unión de los planteles de todos los partidos con titulares válidos.
    # Un jugador que no entró en un partido es OFF durante todo ese partido (misma partición que
    # `onoff_stats`, que no mira el plantel: todo lo que no es ON es OFF).
    valid_games = []
    universe: set[str] = set()
    games_used = games_excluded = 0
    for g in games:
        starters = game_starters(g["player_rows"], team_code)
        if starters is None:
            games_excluded += 1
            continue
        games_used += 1
        segments = build_segments(g["events"], team_code, starters)
        # Boxes del tramo (equipo y rival) y segundos, calculados una vez por tramo.
        seg_data = [(s, _agg(s["events"], team_code), _agg(s["events"], g["opp_code"]), s["seconds"])
                    for s in segments]
        valid_games.append((g["game_id"], seg_data))
        universe |= {r.player_name for r in g["player_rows"] if r.team_code == team_code}
        for s in segments:
            universe |= set(s["on_court"])

    # acc[name] = {on:{boxes,opp,seconds,games_set}, off:{...}}
    acc: dict[str, dict] = {}

    def _slot(name):
        return acc.setdefault(name, {
            "on":  {"boxes": [], "opp": [], "seconds": 0.0, "games": set()},
            "off": {"boxes": [], "opp": [], "seconds": 0.0, "games": set()},
        })

    for game_id, seg_data in valid_games:
        for name in universe:
            slot = _slot(name)
            on_secs = off_secs = 0.0
            for s, tb, ob, secs in seg_data:
                side = "on" if name in s["on_court"] else "off"
                slot[side]["boxes"].append(tb)
                slot[side]["opp"].append(ob)
                if side == "on":
                    on_secs += secs
                else:
                    off_secs += secs
            slot["on"]["seconds"] += on_secs
            slot["off"]["seconds"] += off_secs
            if on_secs > 0:
                slot["on"]["games"].add(game_id)
            if off_secs > 0:
                slot["off"]["games"].add(game_id)

    out = []
    for name in sorted(acc):
        pid = name_idx.get(name)
        if pid is None:
            continue
        slot = acc[name]
        entity_id = f"{team_code}:{pid}"
        on_bundle = _onoff_bundle_side(
            slot["on"]["boxes"], slot["on"]["opp"], slot["on"]["seconds"],
            len(slot["on"]["games"]), entity_id=entity_id, name=name,
            games_total=games_used, games_excluded=games_excluded)
        off_bundle = _onoff_bundle_side(
            slot["off"]["boxes"], slot["off"]["opp"], slot["off"]["seconds"],
            len(slot["off"]["games"]), entity_id=entity_id, name=name,
            games_total=games_used, games_excluded=games_excluded)
        on_bundle.meta["team_code"] = team_code
        off_bundle.meta["team_code"] = team_code
        on_bundle.meta["player_name"] = name
        on_bundle.meta["off"] = off_bundle
        out.append(on_bundle)
    return out


def player_on_court(pbp_game, team_code, player_name) -> dict | None:
    """Conteos crudos propios/rivales de UN partido con `player_name` en cancha (plan §4.6).

    `None` si el partido no tiene pbp o no tiene 5 titulares válidos (el llamador —
    `bundles.player_game_bundles`— lo convierte en `games_estimated=1`). Devuelve
    `{"own", "opp", "seconds"}` — `bundles.py` arma con esto el `on_court` del bundle del
    jugador (plan §4.5 paso 3)."""
    if not pbp_game or not pbp_game.get("events"):
        return None
    starters = game_starters(pbp_game["player_rows"], team_code)
    if starters is None:
        return None
    segments = build_segments(pbp_game["events"], team_code, starters)
    on_segs = [s for s in segments if player_name in s["on_court"]]
    evs = [ev for s in on_segs for ev in s["events"]]
    own = _agg(evs, team_code)
    opp = _agg(evs, pbp_game["opp_code"])
    seconds = sum(s["seconds"] for s in on_segs)
    return {"own": own, "opp": opp, "seconds": seconds}
