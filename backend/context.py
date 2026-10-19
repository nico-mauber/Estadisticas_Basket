"""
Contexto de una petición de perfil (C-02, T-03): competencia, últimos N y filtros de nivel partido.

`Context` lleva la selección que se aplica a todos los endpoints "Ctx". Los nombres de los parámetros de
query son los definitivos (`?competition=<id>|all|<texto de FIBA>&last=<n>&venue=local|visitante&
opponent=<team_code>&rest=0|1|2|3mas`).

Alcance actual de T-03: nivel PARTIDO (competencia, últimos N, sede, rival, descanso). Los parámetros de
nivel evento (`quarter`, `score`, `on`, `off`) y de posesión (`clock`, `clock_start`, `origin`, `ptype`,
`chance`) se validan pero todavía no se aplican: se informan en `context.ignored`.

Quién decide qué: este módulo solo interpreta y filtra; la competencia por defecto se resuelve en
`repository.resolve_competition` y el promedio de liga en `population.py`.
"""
from dataclasses import dataclass, field, replace
from typing import Mapping

import repository
from competitions import CompetitionError

LAST_ERROR = "El parámetro last debe ser un entero mayor a 0."
ALL_LABEL = repository.ALL_LABEL

VENUES = ("local", "visitante")
REST_VALUES = ("0", "1", "2", "3mas")
REST_LABELS = {"0": "0 días de descanso", "1": "1 día de descanso", "2": "2 días de descanso",
               "3mas": "3 o más días de descanso"}
VENUE_LABELS = {"local": "Local", "visitante": "Visitante"}

# Parámetros que el contrato acepta pero todavía no se calculan.
EVENT_PARAMS = ("quarter", "score", "on", "off")                       # nivel evento
POSSESSION_PARAMS = ("clock", "clock_start", "origin", "ptype", "chance")   # nivel posesión (A-02…A-05)
_QUARTER_VALUES = ("1", "2", "3", "4", "pr")
_POSSESSION_VALUES = {
    "clock": ("temprano", "medio", "tardio"),
    "clock_start": ("temprano", "medio", "tardio"),
    "origin": ("robo", "rebote_def", "rebote_of", "saque", "tiro_libre", "pelota_muerta"),
    "ptype": ("transicion", "media_cancha", "segunda_oportunidad"),
    "chance": ("1", "2", "3mas"),
}
_SCORE_VALUES = ("ajustado", "paliza")


class ContextError(Exception):
    """Parámetro de contexto inválido; `status` es el código HTTP (400)."""

    def __init__(self, message: str, status: int = 400, param: str | None = None, value=None):
        super().__init__(message)
        self.status = status
        self.param = param
        self.value = value

    @property
    def code(self) -> str:
        return "competencia_inexistente" if "competencia" in str(self).lower() else "contexto_invalido"

    def payload(self) -> dict:
        out = {"error": str(self), "code": self.code}
        if self.param:
            out["details"] = {"param": self.param, "value": self.value}
        return out


@dataclass(frozen=True)
class Context:
    competition_id: int | None    # None si `competition_all` o si no hay competencias
    competition_all: bool
    last: int | None              # los N partidos más recientes de la ENTIDAD; None = todos
    venue: str | None = None      # "local" | "visitante"
    opponent: str | None = None   # team_code del rival
    rest: str | None = None       # "0" | "1" | "2" | "3mas"
    # Parámetros válidos pero sin cálculo todavía: ((param, razón), ...). No entra en la clave de caché.
    ignored: tuple = field(default=(), compare=False)


def _invalid(param: str, value) -> ContextError:
    return ContextError(f"Valor inválido para '{param}': '{value}'.", 400, param, value)


def parse_context(args: Mapping[str, str], *, team_code: str | None = None,
                  player_id: int | None = None) -> Context:
    """Query de la petición → `Context`. `team_code` / `player_id` identifican a la entidad
    consultada: sin `competition` se usa la de su partido más reciente (DA-14)."""
    try:
        res = repository.resolve_competition(args.get("competition"), team_code=team_code,
                                             player_id=player_id)
    except CompetitionError as e:
        raise ContextError(str(e), e.status) from e
    comp_id = None if res["all"] else res["id"]

    venue = (args.get("venue") or "").strip() or None
    if venue is not None and venue not in VENUES:
        raise _invalid("venue", venue)

    rest = (args.get("rest") or "").strip() or None
    if rest is not None and rest not in REST_VALUES:
        raise _invalid("rest", rest)

    opponent = (args.get("opponent") or "").strip().upper() or None
    if opponent is not None and opponent not in _team_codes(comp_id):
        raise _invalid("opponent", args.get("opponent"))

    ignored = []
    for p in EVENT_PARAMS:
        v = (args.get(p) or "").strip()
        if not v:
            continue
        _validate_event_param(p, v)
        ignored.append((p, "no_implementado"))
    for p in POSSESSION_PARAMS:
        v = (args.get(p) or "").strip()
        if not v:
            continue
        if v not in _POSSESSION_VALUES[p]:
            raise _invalid(p, v)
        ignored.append((p, "requiere_posesiones"))

    return Context(res["id"], res["all"], _parse_last(args.get("last")),
                   venue=venue, opponent=opponent, rest=rest, ignored=tuple(ignored))


def _validate_event_param(param: str, value: str) -> None:
    if param == "quarter":
        if any(q.strip() not in _QUARTER_VALUES for q in value.split(",")):
            raise _invalid(param, value)
    elif param == "score":
        if value not in _SCORE_VALUES:
            raise _invalid(param, value)
    else:   # on / off
        if any(not p.strip().isdigit() for p in value.split(",")):
            raise _invalid(param, value)


def _team_codes(comp_id: int | None) -> set:
    """Códigos de los equipos con partidos en la competencia (o en todas si `comp_id` es None)."""
    return {r["team_code"] for r in repository.team_game_rows(comp_id).values()}


def _parse_last(raw) -> int | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        n = int(raw)
    except ValueError:
        raise ContextError(LAST_ERROR, 400, "last", raw) from None
    if n < 1:
        raise ContextError(LAST_ERROR, 400, "last", raw)
    return n


def context_key(ctx: Context) -> tuple:
    """Clave de memo/caché del contexto."""
    return (ctx.competition_id, ctx.competition_all, ctx.last, ctx.venue, ctx.opponent, ctx.rest)


def without_last(ctx: Context) -> Context:
    """El mismo contexto sin el filtro de últimos N (el "total" contra el que se informa `games_total`)."""
    return replace(ctx, last=None)


def _chrono(g: dict) -> tuple:
    info = g.get("info") or {}
    return (g.get("date") or info.get("date") or "", g.get("game_id") or "")


def _facts(g: dict, team_code: str | None) -> tuple:
    """(sede, rival) de un partido, sea fila de equipo, fila de jugador o partido con pbp."""
    info = g.get("info") or {}
    tc = g.get("team_code") or team_code
    if g.get("home_code") is not None or g.get("away_code") is not None:
        if g.get("home_code") == tc:
            return "local", g.get("away_code")
        if g.get("away_code") == tc:
            return "visitante", g.get("home_code")
        return None, g.get("opp_code")
    venue = {"L": "local", "V": "visitante"}.get(info.get("home_away"))
    return venue, g.get("opp_code")


def filter_games_ex(games: list[dict], ctx: Context, team_code: str | None = None) -> tuple[list, dict]:
    """Partidos de UNA entidad que entran en la selección (cronológico ascendente) y los excluidos por razón.

    `games`: dicts con `game_id`, `date` (o `info.date`) y, si vienen de varias competencias,
    `competition_id`. Orden de aplicación: competencia → sede → rival → descanso → últimos N (RF-5)."""
    import rest as rest_mod

    out = list(games)
    excluded: dict = {}
    if not ctx.competition_all and ctx.competition_id is not None:
        out = [g for g in out if g.get("competition_id", ctx.competition_id) == ctx.competition_id]
    if ctx.venue or ctx.opponent:
        out = [g for g in out
               if (not ctx.venue or _facts(g, team_code)[0] == ctx.venue)
               and (not ctx.opponent or _facts(g, team_code)[1] == ctx.opponent)]
    if ctx.rest and out:
        kept = []
        for g in out:
            tc = g.get("team_code") or team_code
            bucket = rest_mod.days_rest(tc, g.get("game_id")) if tc else None
            if bucket == ctx.rest:
                kept.append(g)
            elif bucket is None:
                reason = ("sin_fecha" if not (g.get("date") or (g.get("info") or {}).get("date"))
                          else "sin_partido_previo")
                excluded[reason] = excluded.get(reason, 0) + 1
        out = kept
    out.sort(key=_chrono)
    if ctx.last:
        out = out[-ctx.last:]
    return out, excluded


def filter_games(games: list[dict], ctx: Context, team_code: str | None = None) -> list[dict]:
    """`filter_games_ex` sin el detalle de excluidos."""
    return filter_games_ex(games, ctx, team_code)[0]


def rest_excluded(games: list[dict], ctx: Context, team_code: str | None = None) -> dict:
    """Partidos que el filtro de descanso dejó fuera por no tener descanso calculable."""
    return filter_games_ex(games, replace(ctx, last=None), team_code)[1]


def _last_label(n: int) -> str:
    return "Último partido" if n == 1 else f"Últimos {n}"


def context_echo(ctx: Context, *, games_used: int, games_total: int, games_excluded: dict,
                 ignored: list, competition_label: str | None) -> dict:
    """Eco de la selección que se aplicó (arquitectura §7.5): lo que el cliente muestra y reenvía."""
    comp_label = ALL_LABEL if ctx.competition_all else competition_label
    parts = [comp_label or "Sin competencia"]
    applied = {}
    if ctx.last:
        applied["last"] = ctx.last
        parts.append(_last_label(ctx.last))
    if ctx.venue:
        applied["venue"] = ctx.venue
        parts.append(VENUE_LABELS[ctx.venue])
    if ctx.opponent:
        applied["opponent"] = ctx.opponent
        parts.append(f"vs {ctx.opponent}")
    if ctx.rest:
        applied["rest"] = ctx.rest
        parts.append(REST_LABELS[ctx.rest])
    all_ignored = list(ignored) + [{"param": p, "reason": r} for p, r in ctx.ignored]
    return {
        "competition": {"id": ctx.competition_id, "label": comp_label},
        "applied": applied,
        "ignored": all_ignored,
        "level": "partido",
        "population_mode": "apply_all",
        "games_used": games_used,
        "games_total": games_total,
        "games_excluded": games_excluded,
        "label": " · ".join(parts),
    }


def dimensions(comp_id: int | None) -> list[dict]:
    """Dimensiones del contrato y si se pueden ofrecer hoy (RF-14, RF-15)."""
    def d(name, level, values, available=True):
        return {"name": name, "level": level, "values": values, "available": available}
    return [
        d("last", "partido", [3, 5, 10]),
        d("venue", "partido", list(VENUES)),
        d("opponent", "partido", sorted(_team_codes(comp_id))),
        d("rest", "partido", list(REST_VALUES)),
        d("quarter", "evento", list(_QUARTER_VALUES), False),
        d("score", "evento", list(_SCORE_VALUES), False),
        d("on", "evento", [], False),
        d("off", "evento", [], False),
        *[d(p, "posesion", list(_POSSESSION_VALUES[p]), False) for p in POSSESSION_PARAMS],
    ]
