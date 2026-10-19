"""Cadenas de producción desde eventos (F-01 dueño; A-07 extiende sin cambiar firmas).

Atribuyen puntos a acciones individuales (asistencia, rebote ofensivo, robo, pérdida)
sobre las posesiones de A-01 en memoria, sin persistir. Todas devuelven
`{player_key: {"points": int, "count": int}}`; un jugador sin la acción no aparece
(ausencia = 0 real, no dato faltante: el llamador decide si hay pbp).
`player_key` es el id que usaron las posesiones (`name_to_id` del partido).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from possessions import Possession

_STEAL_WINDOW = 2   # action_numbers entre la pérdida y el robo que la provocó


def _add(out: dict, key, points: int) -> None:
    entry = out.setdefault(key, {"points": 0, "count": 0})
    entry["points"] += points
    entry["count"] += 1


def assist_points(possessions: list[Possession]) -> dict:
    """Puntos del tiro de campo asistido (2 o 3), por asistente."""
    out: dict = {}
    for p in possessions:
        if p.incomplete or p.assister_id is None:
            continue
        made = [s for s in p.shots if s.get("made")]
        if made:
            _add(out, p.assister_id, made[-1].get("pts") or 0)
    return out


def oreb_points(possessions: list[Possession], events: list[dict], name_to_id: dict) -> dict:
    """Puntos de la oportunidad abierta por cada rebote ofensivo, por reboteador."""
    by_an = {e.get("action_number"): e for e in events}
    out: dict = {}
    for p in possessions:
        if p.incomplete:
            continue
        for ch in p.chances:
            if ch.n < 2:
                continue
            ev = by_an.get(ch.start_event)
            if not ev or ev.get("action_type") != "rebound" or not ev.get("player_name"):
                continue
            pid = name_to_id.get((ev.get("team_code"), ev.get("player_name")))
            if pid is not None:
                _add(out, pid, ch.pts or 0)
    return out


def steal_points(possessions: list[Possession], events: list[dict], name_to_id: dict) -> dict:
    """Puntos de la posesión propia que sigue a cada robo, por ladrón."""
    poss = list(possessions)
    out: dict = {}
    for ev in events:
        if ev.get("action_type") != "steal" or not ev.get("player_name"):
            continue
        team, an = ev.get("team_code"), ev.get("action_number")
        pid = name_to_id.get((team, ev.get("player_name")))
        if pid is None or an is None:
            continue
        lost = next((i for i, p in enumerate(poss)
                     if p.team != team and p.turnover_by_id is not None
                     and p.end_event is not None and abs(an - p.end_event) <= _STEAL_WINDOW), None)
        if lost is None:
            continue
        nxt = next((p for p in poss[lost + 1:] if p.team == team), None)
        _add(out, pid, nxt.pts if nxt is not None and not nxt.incomplete else 0)
    return out


def turnover_cost(possessions: list[Possession]) -> dict:
    """Puntos que anotó el rival en la posesión inmediata siguiente a cada pérdida."""
    poss = list(possessions)
    out: dict = {}
    for i, p in enumerate(poss):
        if p.incomplete or p.turnover_by_id is None:
            continue
        nxt = poss[i + 1] if i + 1 < len(poss) else None
        cost = nxt.pts if nxt is not None and nxt.team != p.team and not nxt.incomplete else 0
        _add(out, p.turnover_by_id, cost)
    return out
