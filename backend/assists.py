"""Vínculo de cada asistencia con el tiro que la convirtió (A-12).

FIBA publica `previousAction` en cada evento del play-by-play: en una asistencia apunta al evento del
tiro que se convirtió gracias a ella. Con ese vínculo se clasifica cada asistencia por el tipo de tiro
(2 puntos, 3 puntos o tiro libre) y se calculan los puntos que generó el pasador.

Estados posibles de una selección (C-11: un dato que falta nunca vale 0):
- `ok`: el partido trae el vínculo.
- `sin_pbp`: el partido no tiene play-by-play.
- `no_registrado`: hay play-by-play y asistencias, pero sin `previous_action` (importado con una
  ingesta anterior a la 5; hay que reprocesar).

Los tiros libres no suman puntos generados: no se sabe cuántos de la serie entraron ni cuál de ellos
corresponde a la asistencia, así que se cuentan aparte y quedan fuera de `ast_points`.
"""
from collections import defaultdict

from database import db, PbpEvent

# Puntos del tiro que convirtió la asistencia, por tipo de evento de FIBA.
POINTS_BY_TYPE = {"2pt": 2, "3pt": 3}

# `previous_action` existe desde esta versión de ingesta; por debajo, el vínculo no se importó.
LINK_INGEST_VERSION = 5

_EMPTY = {"fg2": 0, "fg3": 0, "ft": 0, "unlinked": 0, "ast_points": 0, "status": "sin_pbp"}


def _blank() -> dict:
    return dict(_EMPTY)


def game_assist_links(events, *, has_pbp: bool = True) -> dict:
    """`{player_name: {fg2, fg3, ft, unlinked, ast_points, status}}` de UN partido.

    `events`: eventos del partido (objetos o dicts con `action_number`, `action_type`,
    `player_name`, `previous_action`). Una asistencia sin vínculo cuenta en `unlinked` y deja el
    estado en `no_registrado`: no se puede afirmar que generó 0 puntos."""
    def _get(ev, key):
        return ev.get(key) if isinstance(ev, dict) else getattr(ev, key, None)

    by_number = {}
    assists = []
    for ev in events:
        num = _get(ev, "action_number")
        if num is not None:
            by_number[num] = ev
        if _get(ev, "action_type") == "assist":
            assists.append(ev)

    out: dict = defaultdict(_blank)
    if not has_pbp:
        return out
    for ev in assists:
        name = _get(ev, "player_name") or ""
        if not name:
            continue
        row = out[name]
        row["status"] = "ok" if row["status"] in ("sin_pbp", "ok") else row["status"]
        prev = _get(ev, "previous_action")
        target = by_number.get(prev) if prev is not None else None
        if target is None:
            row["unlinked"] += 1
            row["status"] = "no_registrado"
            continue
        kind = _get(target, "action_type")
        if kind == "2pt":
            row["fg2"] += 1
            row["ast_points"] += POINTS_BY_TYPE["2pt"]
        elif kind == "3pt":
            row["fg3"] += 1
            row["ast_points"] += POINTS_BY_TYPE["3pt"]
        elif kind == "freethrow":
            row["ft"] += 1          # no suma puntos: ver nota del encabezado
        else:
            row["unlinked"] += 1
            row["status"] = "no_registrado"
    return out


def _merge(into: dict, other: dict) -> dict:
    for key in ("fg2", "fg3", "ft", "unlinked", "ast_points"):
        into[key] += other[key]
    # El peor estado manda: una selección con un partido sin vínculo no puede informarse como completa.
    order = {"ok": 0, "no_registrado": 1, "sin_pbp": 2}
    if order[other["status"]] > order[into["status"]]:
        into["status"] = other["status"]
    return into


def _links_of_game(game_id):
    """Vínculos de las asistencias de UN partido por jugador; `None` si no tiene play-by-play. Cacheado por versión
    de datos: la población de jugadores lo pide una vez por jugador y partido (antes, una consulta por jugador)."""
    import cache
    import repository

    def build():
        evs = repository._load_events([game_id], keep=False)[game_id]
        return dict(game_assist_links(evs)) if evs else None
    return cache.memo("assists:game", game_id, build)


def player_assist_links(player_name: str, team_code: str, game_ids) -> dict:
    """Totales del jugador sobre una selección de partidos (cociente de totales, A-12 RF-1)."""
    game_ids = list(game_ids)
    if not game_ids:
        return _blank()
    per_game = {gid: _links_of_game(gid) for gid in game_ids}
    total = _blank()
    total["status"] = "ok" if any(per_game[g] is not None for g in game_ids) else "sin_pbp"
    for gid in game_ids:
        links = per_game[gid]
        if links is None:
            total["status"] = "sin_pbp" if total["status"] == "ok" else total["status"]
            continue
        mine = links.get(player_name)
        if mine is not None:
            _merge(total, mine)
    return total


def team_assists(team_code: str, game_ids) -> int | None:
    """Asistencias del equipo en esos partidos, desde el play-by-play. `None` si no hay eventos."""
    game_ids = list(game_ids)
    if not game_ids:
        return None
    n = (db.session.query(PbpEvent)
         .filter(PbpEvent.game_id.in_(game_ids),
                 PbpEvent.team_code == team_code,
                 PbpEvent.action_type == "assist")
         .count())
    return n
