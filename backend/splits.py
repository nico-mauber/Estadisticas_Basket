"""Splits de nivel evento (T-03): cuarto, situación de marcador y con/sin jugador.

Un partido con play-by-play se recorre en orden y se parte en "rebanadas": tramos de juego con el mismo
(período, situación de marcador, quinteto del equipo en cancha). Cada rebanada guarda sus eventos y los
segundos de reloj que transcurrieron en ese estado. El filtro elige rebanadas; las métricas se calculan
sobre los eventos (y los segundos) de las rebanadas elegidas, igual que el cierre (`clutch.py`).

- Cuarto: `1`…`4` o `pr` (todas las prórrogas juntas, por `period_type`).
- Marcador: se evalúa con el marcador corrido ANTES del evento. `ajustado` si la diferencia es ≤
  `context.close_margin`, `paliza` si es mayor (no se superponen).
- Con/sin jugador: eventos y segundos en que TODOS los jugadores de `on` están en cancha y NINGUNO de `off`.

Los segundos suman exactamente la duración del partido (600 por período regular, 300 por prórroga), como
los tramos de `lineups.build_segments`.
"""
import config
import repository
from clutch import _agg, _SUM_KEYS
from lineups import PERIOD_LEN, game_starters
from stats_engine import StatBundle

SPLIT_ENTITY = "split"


def _bucket(ev) -> str:
    return "pr" if ev.get("period_type") == "OVERTIME" else str(ev.get("period"))


def event_slices(events, team_code, starters, close_margin) -> list[dict]:
    """Eventos (ordenados por `action_number`) → `[{bucket, score, on_court, seconds, events}]`.

    `starters`: 5 titulares del equipo (o None: sin quinteto, `on_court` queda en None)."""
    on_court = set(starters) if starters else None
    margin = 0
    slices: dict = {}
    order: list = []
    last_period = None
    floor = None
    cur = None

    def key(bucket):
        score = "ajustado" if margin <= close_margin else "paliza"
        return (bucket, score, frozenset(on_court) if on_court is not None else None)

    def get(k):
        if k not in slices:
            slices[k] = {"bucket": k[0], "score": k[1], "on_court": k[2], "seconds": 0.0, "events": []}
            order.append(k)
        return slices[k]

    for ev in events:
        pk = (ev.get("period"), ev.get("period_type"))
        clock = ev.get("clock_secs") or 0
        plen = PERIOD_LEN.get(ev.get("period_type"), 600)
        if pk != last_period:
            if floor is not None and cur is not None:
                get(cur)["seconds"] += floor          # cola del período anterior (hasta 0:00)
            floor = plen
            last_period = pk
            cur = key(_bucket(ev))
        if clock < floor:
            get(cur)["seconds"] += floor - clock      # el reloj solo avanza hacia un nuevo mínimo
            floor = clock

        if ev.get("action_type") == "substitution":
            if on_court is not None and ev.get("team_code") == team_code:
                player, sub = ev.get("player_name"), (ev.get("sub_type") or "").lower()
                if sub == "out":
                    on_court.discard(player)
                elif sub == "in":
                    on_court.add(player)
                cur = key(_bucket(ev))
            continue

        get(cur)["events"].append(ev)                 # el evento cuenta con el estado ANTERIOR
        s1, s2 = ev.get("s1"), ev.get("s2")
        if s1 is not None and s2 is not None:
            margin = abs(s1 - s2)
        cur = key(_bucket(ev))

    if floor is not None and cur is not None:
        get(cur)["seconds"] += floor
    return [slices[k] for k in order]


def _passes(sl, ctx, on_names, off_names) -> bool:
    if ctx.quarters and sl["bucket"] not in ctx.quarters:
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
    names = bundles._names_for(team_code, list(pids))
    return names


def _game_split(g, team_code, ctx, close_margin, on_names, off_names):
    """`(own_events, opp_events, seconds)` de la selección en UN partido, o `None` si el partido no permite
    calcular el filtro (sin titulares para con/sin jugador)."""
    needs_court = bool(on_names or off_names)
    starters = game_starters(g["player_rows"], team_code) if needs_court else None
    if needs_court and starters is None:
        return None
    opp = g["opp_code"]
    own_evs, opp_evs, seconds = [], [], 0.0
    for sl in event_slices(g["events"], team_code, starters, close_margin):
        if not _passes(sl, ctx, on_names, off_names):
            continue
        seconds += sl["seconds"]
        for ev in sl["events"]:
            code = ev.get("team_code")
            if code == team_code:
                own_evs.append(ev)
            elif code == opp:
                opp_evs.append(ev)
    return own_evs, opp_evs, seconds


def _to_counts(box):
    own = {k: box.get(k, 0) for k in _SUM_KEYS}
    own["pf"] = own.pop("foul", 0)
    own["fouls_drawn"] = own.pop("foulon", 0)
    return own


def team_event_bundle(team_code, comp_id, ctx):
    """`StatBundle` del equipo agregando SOLO los eventos que cumplen cuarto / marcador / con-sin jugador
    sobre los partidos con pbp que pasan los filtros de partido. `None` si no hay ningún partido con pbp."""
    import context as context_mod
    import identity

    games = repository.team_pbp_games(team_code, comp_id)
    games = context_mod.filter_games(games, ctx, team_code)
    games = identity.canonicalize_pbp_games(games, team_code)

    all_rows = [r for r in repository.team_game_rows(comp_id).values() if r["team_code"] == team_code]
    scoped = context_mod.filter_games(all_rows, context_mod.without_last(ctx), team_code)
    pbp_ids = {g["game_id"] for g in games}
    sin_pbp = sum(1 for r in context_mod.filter_games(all_rows, ctx, team_code) if r["game_id"] not in pbp_ids)

    close_margin = config.get("context.close_margin")
    on_names = _selected_names(team_code, ctx.on)
    off_names = _selected_names(team_code, ctx.off)
    if (ctx.on and on_names is None) or (ctx.off and off_names is None):
        return None

    own_boxes, opp_boxes = [], []
    seconds = 0.0
    used = sin_titulares = 0
    team_name = team_code
    for r in all_rows:
        team_name = r.get("team_name") or team_name
    for g in games:
        res = _game_split(g, team_code, ctx, close_margin, on_names, off_names)
        if res is None:
            sin_titulares += 1
            continue
        own_evs, opp_evs, secs = res
        if not own_evs and not opp_evs and secs == 0:
            continue
        used += 1
        seconds += secs
        own_boxes.append(_agg(own_evs))
        opp_boxes.append(_agg(opp_evs))
    own = {k: sum(b.get(k, 0) for b in own_boxes) for k in _SUM_KEYS}
    opp = {k: sum(b.get(k, 0) for b in opp_boxes) for k in _SUM_KEYS}
    own["pf"], opp["pf"] = own.pop("foul", 0), opp.pop("foul", 0)
    own["fouls_drawn"], opp["fouls_drawn"] = own.pop("foulon", 0), opp.pop("foulon", 0)
    own["blk_received"], opp["blk_received"] = opp.get("blk", 0), own.get("blk", 0)
    own["plus_minus"] = own.get("pts", 0) - opp.get("pts", 0)
    opp["plus_minus"] = opp.get("pts", 0) - own.get("pts", 0)

    if used == 0:
        return None            # ningún partido con pbp aporta eventos: selección vacía

    excluded = {}
    if sin_pbp:
        excluded["sin_pbp"] = sin_pbp
    if sin_titulares:
        excluded["sin_titulares"] = sin_titulares
    excluded.update(context_mod.rest_excluded(all_rows, ctx, team_code))
    return StatBundle(
        entity_type=SPLIT_ENTITY, entity_id=team_code, name=team_name,
        own=own, opp=opp, team=None,
        games=used, minutes=seconds / 60 if seconds else 0.0, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=None, null_reasons={},
        meta={"team_code": team_code, "team_name": team_name, "split": True,
              "games_total": len(scoped), "games_excluded": excluded},
    )


def all_team_event_bundles(comp_id, ctx):
    rows = repository.team_game_rows(comp_id)
    out = []
    for code in sorted({r["team_code"] for r in rows.values()}):
        b = team_event_bundle(code, comp_id, ctx)
        if b is not None:
            out.append(b)
    return out
