"""
Contexto de una petición de perfil (C-02): la competencia y el filtro de últimos N partidos.

Es la versión mínima de `Context` que prevé la arquitectura (§3.8): hoy solo `competition` y `last`;
T-03 le agrega sede, rival, descanso, cuarto, marcador, con/sin jugador… con valores por defecto, sin
tocar a quienes ya lo usan. Los nombres de los parámetros de query son los definitivos
(`?competition=<id>|all|<texto de FIBA>&last=<n>`).

Quién decide qué: este módulo solo interpreta y filtra; la competencia por defecto se resuelve en
`repository.resolve_competition` y el promedio de liga en `population.py`.
"""
from dataclasses import dataclass, replace
from typing import Mapping

import repository
from competitions import CompetitionError

LAST_ERROR = "El parámetro last debe ser un entero mayor a 0."
ALL_LABEL = repository.ALL_LABEL


class ContextError(Exception):
    """Parámetro de contexto inválido; `status` es el código HTTP (400)."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Context:
    competition_id: int | None    # None si `competition_all` o si no hay competencias
    competition_all: bool
    last: int | None              # los N partidos más recientes de la ENTIDAD; None = todos


def parse_context(args: Mapping[str, str], *, team_code: str | None = None,
                  player_id: int | None = None) -> Context:
    """Query de la petición → `Context`. `team_code` / `player_id` identifican a la entidad
    consultada: sin `competition` se usa la de su partido más reciente (DA-14)."""
    try:
        res = repository.resolve_competition(args.get("competition"), team_code=team_code,
                                             player_id=player_id)
    except CompetitionError as e:
        raise ContextError(str(e), e.status) from e
    return Context(res["id"], res["all"], _parse_last(args.get("last")))


def _parse_last(raw) -> int | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        n = int(raw)
    except ValueError:
        raise ContextError(LAST_ERROR) from None
    if n < 1:
        raise ContextError(LAST_ERROR)
    return n


def context_key(ctx: Context) -> tuple:
    """Clave de memo/caché del contexto."""
    return (ctx.competition_id, ctx.competition_all, ctx.last)


def without_last(ctx: Context) -> Context:
    """El mismo contexto sin el filtro de últimos N: el universo del promedio de liga (RF-1)."""
    return replace(ctx, last=None)


def _chrono(g: dict) -> tuple:
    return (g.get("date") or "", g.get("game_id") or "")


def filter_games(games: list[dict], ctx: Context, team_code: str | None = None) -> list[dict]:
    """Partidos de UNA entidad que entran en la selección, en orden cronológico ascendente.

    `games`: dicts con `game_id`, `date` y `competition_id` (filas de equipo o fichas de jugador).
    1) la competencia (salvo `competition_all`); 2) cronológico (sin fecha = el más antiguo);
    3) los últimos N. `team_code` no se usa todavía: T-03 lo necesita para sede y rival.
    """
    out = list(games)
    if not ctx.competition_all and ctx.competition_id is not None:
        out = [g for g in out if g.get("competition_id") == ctx.competition_id]
    out.sort(key=_chrono)
    if ctx.last:
        out = out[-ctx.last:]
    return out


def _last_label(n: int) -> str:
    return "Último partido" if n == 1 else f"Últimos {n}"


def context_echo(ctx: Context, *, games_used: int, games_total: int, games_excluded: dict,
                 ignored: list, competition_label: str | None) -> dict:
    """Eco de la selección que se aplicó (arquitectura §7.5): lo que el cliente muestra y reenvía."""
    comp_label = ALL_LABEL if ctx.competition_all else competition_label
    parts = [comp_label or "Sin competencia"]
    if ctx.last:
        parts.append(_last_label(ctx.last))
    return {
        "competition": {"id": ctx.competition_id, "label": comp_label},
        "applied": {"last": ctx.last} if ctx.last else {},
        "ignored": ignored,
        "level": "partido",
        "population_mode": "apply_all",
        "games_used": games_used,
        "games_total": games_total,
        "games_excluded": games_excluded,
        "label": " · ".join(parts),
    }
