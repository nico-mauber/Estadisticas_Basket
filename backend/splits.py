"""Splits de nivel evento (T-03) y tramos del partido (F-04).

Un partido con play-by-play se recorre en orden y se parte en "rebanadas": tramos de juego con el mismo
(período, situación de marcador, últimos 5 minutos sí/no, quinteto del equipo en cancha). Cada rebanada
guarda sus eventos y los segundos de reloj que transcurrieron en ese estado. El filtro elige rebanadas;
las métricas se calculan sobre los eventos (y los segundos) de las rebanadas elegidas, igual que el
cierre (`clutch.py`).

- Cuarto (T-03): `1`…`4` o `pr` (todas las prórrogas juntas, por `period_type`).
- Marcador: se evalúa con el marcador corrido ANTES del evento. `ajustado` si la diferencia es ≤
  `context.close_margin`, `paliza` si es mayor (no se superponen).
- Con/sin jugador: eventos y segundos en que TODOS los jugadores de `on` están en cancha y NINGUNO de `off`.
- Tramos (F-04): `q1`…`q4`, `h1` (1.ª mitad), `h2`, `pr` y `last5` (últimos `clutch.window_secs` del último
  período regular más las prórrogas). Con un tramo elegido, el filtro `quarter` de la barra se ignora.

Los segundos suman exactamente la duración del partido (600 por período regular, 300 por prórroga), como
los tramos de `lineups.build_segments`.
"""
import config
import repository
from clutch import _agg, _SUM_KEYS, OVERTIME_TYPES
from lineups import PERIOD_LEN, game_starters
from stats_engine import StatBundle

SPLIT_ENTITY = "split"

WINDOWS = ("q1", "q2", "q3", "q4", "h1", "h2", "pr", "last5")
WINDOW_LABELS = {
    "q1": "1.er cuarto", "q2": "2.º cuarto", "q3": "3.er cuarto", "q4": "4.º cuarto",
    "h1": "1.ª mitad", "h2": "2.ª mitad", "pr": "Prórroga", "last5": "Últimos 5 minutos",
}
_WINDOW_BUCKETS = {"q1": {"1"}, "q2": {"2"}, "q3": {"3"}, "q4": {"4"}, "h1": {"1", "2"}, "h2": {"3", "4"}, "pr": {"pr"}}


def window_label(window: str) -> str:
    if window == "last5":
        secs = config.get("clutch.window_secs")
        return "Últimos 5 minutos" if secs == 300 else f"Últimos {secs / 60:g} minutos"
    return WINDOW_LABELS[window]


def _bucket(ev) -> str:
    return "pr" if ev.get("period_type") in OVERTIME_TYPES else str(ev.get("period"))


def event_slices(events, team_code, starters, close_margin, late_secs=None) -> list[dict]:
    """Eventos (ordenados por `action_number`) → `[{bucket, score, late, on_court, seconds, events}]`.

    `starters`: 5 titulares del equipo (o None: sin quinteto, `on_court` queda en None).
    `late_secs`: si se da, separa los últimos `late_secs` del último período regular (y toda prórroga)."""
    regular = [e.get("period") for e in events
               if e.get("period_type") not in OVERTIME_TYPES and e.get("period")]
    last_reg = max(regular) if regular else 4
    on_court = set(starters) if starters else None
    state = {"margin": 0, "floor": None, "period": None, "ptype": None}
    slices: dict = {}
    order: list = []

    def late_now():
        if late_secs is None:
            return False
        if state["ptype"] in OVERTIME_TYPES:
            return True
        return state["period"] == last_reg and state["floor"] is not None and state["floor"] <= late_secs

    # Quinteto CONFIRMADO: `on_court` puede estar a medio cambiar (varios `substitution` seguidos en la
    # misma detención), así que las rebanadas se arman con el último quinteto completo, igual que el
    # `cur_on` de `lineups.build_segments`.
    confirmed = [frozenset(on_court) if on_court is not None else None]

    def key(bucket):
        score = "ajustado" if state["margin"] <= close_margin else "paliza"
        return (bucket, score, late_now(), confirmed[0])

    def get(k):
        if k not in slices:
            slices[k] = {"bucket": k[0], "score": k[1], "late": k[2], "on_court": k[3], "seconds": 0.0, "events": []}
            order.append(k)
        return slices[k]

    cur = None

    def advance(to):
        """Lleva el reloj de `floor` a `to`; si cruza el umbral de "últimos minutos", parte los segundos."""
        nonlocal cur
        floor = state["floor"]
        if to >= floor:
            return
        if (late_secs is not None and state["ptype"] not in OVERTIME_TYPES and state["period"] == last_reg
                and floor > late_secs >= to):
            get(cur)["seconds"] += floor - late_secs
            state["floor"] = late_secs
            cur = key(_bucket({"period": state["period"], "period_type": state["ptype"]}))
            floor = late_secs
        get(cur)["seconds"] += floor - to
        state["floor"] = to

    for ev in events:
        pk = (ev.get("period"), ev.get("period_type"))
        clock = ev.get("clock_secs") or 0
        plen = PERIOD_LEN.get(ev.get("period_type"), 600)
        if (state["period"], state["ptype"]) != pk:
            if state["floor"] is not None and cur is not None:
                advance(0)                              # cola del período anterior (hasta 0:00)
            state.update(period=ev.get("period"), ptype=ev.get("period_type"), floor=plen)
            cur = key(_bucket(ev))
        advance(clock)                                  # el reloj solo avanza hacia un nuevo mínimo

        if ev.get("action_type") == "substitution":
            if on_court is not None and ev.get("team_code") == team_code:
                player, sub = ev.get("player_name"), (ev.get("sub_type") or "").lower()
                if sub == "out":
                    on_court.discard(player)
                elif sub == "in":
                    on_court.add(player)
            # El cambio queda PENDIENTE hasta el próximo evento de juego: varios cambios en la misma
            # detención se fusionan en uno y no se arman quintetos parciales de 4 o 6 (igual que
            # `lineups.build_segments`, que es la reconstrucción canónica del resto de las features).
            continue

        get(cur)["events"].append(ev)                   # el evento cuenta con el estado ANTERIOR
        s1, s2 = ev.get("s1"), ev.get("s2")
        if s1 is not None and s2 is not None:
            state["margin"] = abs(s1 - s2)
        # Recién acá se confirma el quinteto y el marcador nuevo: el siguiente evento de juego ya corre
        # con ese estado. Un quinteto incompleto (cambios a medio aplicar dentro de la misma detención)
        # NO se confirma: se espera a que vuelva a haber cinco, igual que `lineups.build_segments`.
        if on_court is not None and (len(on_court) == 5 or confirmed[0] is None):
            confirmed[0] = frozenset(on_court)
        cur = key(_bucket(ev))

    if state["floor"] is not None and cur is not None:
        advance(0)
    return [slices[k] for k in order]


def _passes(sl, ctx, on_names, off_names, window=None) -> bool:
    if window == "last5":
        if not sl["late"]:
            return False
    elif window:
        if sl["bucket"] not in _WINDOW_BUCKETS[window]:
            return False
    elif ctx.quarters and sl["bucket"] not in ctx.quarters:
        return False
    if ctx.score and sl["score"] != ctx.score:
        return False
    if on_names or off_names:
        on = sl["on_court"]
        if on is None:
            return False
        if on_names and not set(on_names) <= on:
            return False
        if off_names and set(off_names) & on:
            return False
    return True


def _selected_names(team_code, pids):
    import bundles
    if not pids:
        return []
    return bundles._names_for(team_code, list(pids))


def _game_split(g, team_code, ctx, close_margin, on_names, off_names, window=None):
    """`(own_events, opp_events, seconds)` de la selección en UN partido, o `None` si el partido no permite
    calcular el filtro (sin titulares para con/sin jugador)."""
    needs_court = bool(on_names or off_names)
    starters = game_starters(g["player_rows"], team_code) if needs_court else None
    if needs_court and starters is None:
        return None
    opp = g["opp_code"]
    late = config.get("clutch.window_secs") if window == "last5" else None
    own_evs, opp_evs, seconds = [], [], 0.0
    for sl in event_slices(g["events"], team_code, starters, close_margin, late_secs=late):
        if not _passes(sl, ctx, on_names, off_names, window):
            continue
        seconds += sl["seconds"]
        for ev in sl["events"]:
            code = ev.get("team_code")
            if code == team_code:
                own_evs.append(ev)
            elif code == opp:
                opp_evs.append(ev)
    return own_evs, opp_evs, seconds


def _selection(team_code, comp_id, ctx):
    """Partidos con pbp del contexto, filas del equipo y recuento de partidos sin pbp."""
    import context as context_mod
    import identity

    games = repository.team_pbp_games(team_code, comp_id)
    games = context_mod.filter_games(games, ctx, team_code)
    games = identity.canonicalize_pbp_games(games, team_code)
    all_rows = [r for r in repository.team_game_rows(comp_id).values() if r["team_code"] == team_code]
    pbp_ids = {g["game_id"] for g in games}
    sin_pbp = sum(1 for r in context_mod.filter_games(all_rows, ctx, team_code) if r["game_id"] not in pbp_ids)
    return games, all_rows, sin_pbp


def _bundle_from(team_code, ctx, all_rows, sin_pbp, window, per_game, boxes, sin_titulares):
    import context as context_mod
    own_boxes = [b[0] for b in boxes]
    opp_boxes = [b[1] for b in boxes]
    seconds = sum(b[2] for b in boxes)
    team_name = team_code
    for r in all_rows:
        team_name = r.get("team_name") or team_name
    own = {k: sum(b.get(k, 0) for b in own_boxes) for k in _SUM_KEYS}
    opp = {k: sum(b.get(k, 0) for b in opp_boxes) for k in _SUM_KEYS}
    own["pf"], opp["pf"] = own.pop("foul", 0), opp.pop("foul", 0)
    own["fouls_drawn"], opp["fouls_drawn"] = own.pop("foulon", 0), opp.pop("foulon", 0)
    own["blk_received"], opp["blk_received"] = opp.get("blk", 0), own.get("blk", 0)
    own["plus_minus"] = own.get("pts", 0) - opp.get("pts", 0)
    opp["plus_minus"] = opp.get("pts", 0) - own.get("pts", 0)

    scoped = context_mod.filter_games(all_rows, context_mod.without_last(ctx), team_code)
    excluded = {}
    if sin_pbp:
        excluded["sin_pbp"] = sin_pbp
    if sin_titulares:
        excluded["sin_titulares"] = sin_titulares
    excluded.update(context_mod.rest_excluded(all_rows, ctx, team_code))
    meta = {"team_code": team_code, "team_name": team_name, "split": True,
            "games_total": len(scoped), "games_excluded": excluded, "per_game": per_game}
    if window:
        meta["window"] = window
    return StatBundle(
        entity_type=SPLIT_ENTITY, entity_id=team_code, name=team_name,
        own=own, opp=opp, team=None,
        games=len(boxes), minutes=seconds / 60 if seconds else 0.0, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=None, null_reasons={}, meta=meta,
    )


def _per_game_row(g, own_box, opp_box, secs, team_code):
    info = g.get("info") or {}
    return {
        "game_id": g["game_id"], "date": info.get("date", ""), "opponent_code": g["opp_code"],
        "home_away": info.get("home_away", ""), "pts": own_box["pts"], "opp_pts": opp_box["pts"],
        "point_diff": own_box["pts"] - opp_box["pts"], "minutes": round(secs / 60, 2),
    }


def team_event_bundle(team_code, comp_id, ctx, window=None):
    """`StatBundle` del equipo agregando SOLO los eventos que cumplen cuarto / marcador / con-sin jugador (o el
    tramo `window` de F-04) sobre los partidos con pbp que pasan los filtros de partido. `None` si ningún partido
    con pbp aporta eventos a la selección.

    Memoizado por petición: la población de un tramo pide un bundle por equipo (14 × 8 ventanas en una
    sola respuesta de `/api/periods`) y cada uno recorre el play-by-play completo del equipo."""
    import context as context_mod
    key = ("split_bundle", team_code, comp_id, context_mod.context_key(ctx), window)
    return repository.memo(key, lambda: _team_event_bundle(team_code, comp_id, ctx, window))


def _team_event_bundle(team_code, comp_id, ctx, window=None):
    games, all_rows, sin_pbp = _selection(team_code, comp_id, ctx)
    close_margin = config.get("context.close_margin")
    on_names = _selected_names(team_code, ctx.on)
    off_names = _selected_names(team_code, ctx.off)
    if (ctx.on and on_names is None) or (ctx.off and off_names is None):
        return None

    boxes, per_game = [], []
    sin_titulares = 0
    for g in games:
        res = _game_split(g, team_code, ctx, close_margin, on_names, off_names, window)
        if res is None:
            sin_titulares += 1
            continue
        own_evs, opp_evs, secs = res
        if not own_evs and not opp_evs and secs == 0:
            continue
        ob, pb = _agg(own_evs), _agg(opp_evs)
        boxes.append((ob, pb, secs))
        per_game.append(_per_game_row(g, ob, pb, secs, team_code))
    if not boxes:
        return None
    per_game.sort(key=lambda r: (r["date"] or "", r["game_id"]), reverse=True)
    return _bundle_from(team_code, ctx, all_rows, sin_pbp, window, per_game, boxes, sin_titulares)


def all_team_event_bundles(comp_id, ctx, window=None):
    rows = repository.team_game_rows(comp_id)
    out = []
    for code in sorted({r["team_code"] for r in rows.values()}):
        b = team_event_bundle(code, comp_id, ctx, window)
        if b is not None:
            out.append(b)
    return out


def record(per_game) -> str:
    """Récord del tramo "G-P-E" según los puntos del tramo en cada partido."""
    w = sum(1 for r in per_game if r["point_diff"] > 0)
    l = sum(1 for r in per_game if r["point_diff"] < 0)
    return f"{w}-{l}-{len(per_game) - w - l}"
