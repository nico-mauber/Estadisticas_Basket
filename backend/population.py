"""
Población de liga y perfiles de equipo y de jugador (C-02).

La POBLACIÓN de una competencia son sus entidades —equipos con ≥ 1 partido, jugadores con ≥ 1 partido
JUGADO— cada una con UN valor por métrica: el de todos sus partidos de la competencia, calculado con la
misma agregación (`stats_engine.aggregate_games`) que su propio perfil. El `Ø` de liga es la media de esos
valores (cada entidad una vez, DA-08), sin los nulos, y NO depende del filtro de últimos N (RF-1).

T-01 completa este módulo (`apply_thresholds=True`, percentil, ranking, ficha); hoy solo existe el camino
`apply_thresholds=False`: todas las entidades de la competencia con datos, sin mínimos de muestra.

`team_profile` / `player_profile` arman la respuesta de `GET /api/team` y `GET /api/player` para la
selección activa (competencia + últimos N); las rutas de `app.py` solo parsean el contexto y delegan.
"""
from dataclasses import dataclass, field
from types import SimpleNamespace

import identity
import repository
import stats_engine
from context import Context, filter_games, context_echo, context_key, without_last, rest_excluded
from database import db, Player
from stats_engine import (aggregate_games, calc_team_stats, calc_player_stats, league_averages,
                          null_reasons, played, resolve_identity, strip_private,
                          TEAM_AVG_KEYS, PLAYER_AVG_KEYS)

_TEAM_CRITERION = "media de los equipos de la competencia (cada uno con todos sus partidos)"
_PLAYER_CRITERION = "media de los jugadores de la competencia (cada uno con todos sus partidos jugados)"
_FIBA_EXTRAS = ("paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts")
_OPP_KEYS = ("pts", "fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "orb", "drb", "tov")


@dataclass
class Member:
    id: str | int
    name: str
    values: dict                         # {clave: valor de ranking} de las 83 claves (None si nulo)
    sample: dict | None = None           # badge de muestra (T-02) o {"games": n} en el camino legado
    in_population: bool = True           # T-01: False para quien no llega al mínimo de muestra
    games: int = 0
    team_code: str | None = None


@dataclass
class Population:
    entity_type: str                     # team | player | lineup | onoff | clutch
    comp_id: int | None
    ctx_key: tuple
    variant: object = None               # tamaño de la combinación para lineup; None en los demás
    members: list = field(default_factory=list)
    criterion: str = ""
    context_label: str = ""
    reason: str | None = None

    @property
    def size(self) -> int:
        """Entidades en la población (in_population)."""
        return sum(1 for m in self.members if m.in_population)

    def get(self, entity_id):
        """Miembro por id (comparación laxa de str para equipos/quintetos), o None."""
        for m in self.members:
            if m.id == entity_id or str(m.id) == str(entity_id):
                return m
        return None


# ── Un partido de una entidad ───────────────────────────────────────────────

def team_game_adv(row: dict, opp: dict) -> dict:
    """Métricas de UN partido de un equipo. Único camino: lo usan el perfil y la población."""
    t = dict(row)
    t["minutes"] = row["game_minutes"]               # PACE con prórrogas (F-11)
    adv = calc_team_stats(t, {k: opp[k] for k in _OPP_KEYS})
    # Desglose FIBA: NULL = la competencia no lo publica; se devuelve null, no 0 (C-11 RF-11)
    adv.update({k: row.get(k) for k in _FIBA_EXTRAS})
    adv["opp_pf"] = row.get("opp_pf", 0)
    return adv


def player_game_adv(row: dict, team_rows: dict) -> dict:
    """Métricas de UNA ficha de jugador en un partido (incluye `reb_share` / `oreb_share` / `dreb_share`)."""
    p = dict(row)
    p.setdefault("trb", p["orb"] + p["drb"])
    team = team_rows.get((row["game_id"], row["team_code"]))
    opp = repository.opponent_row(team_rows, team) if team else None
    # `opp` habilita OR%/DR%/TRB% individuales (Feature 15 RF-6)
    adv = calc_player_stats(p, team_pos=0, team=team, game_minutes=row["game_minutes"], opp=opp)
    if team:
        t_orb, t_drb = team.get("orb") or 0, team.get("drb") or 0
        t_trb = team.get("trb") or (t_orb + t_drb)
        # Tasas: denominador 0 → None, no 0 (Feature 12 RF-5)
        adv["reb_share"] = round(adv["trb"] / t_trb, 4) if t_trb else None
        adv["oreb_share"] = round(adv["orb"] / t_orb, 4) if t_orb else None
        adv["dreb_share"] = round(adv["drb"] / t_drb, 4) if t_drb else None
    else:
        adv["reb_share"] = adv["oreb_share"] = adv["dreb_share"] = None
    return adv


# ── Población ───────────────────────────────────────────────────────────────

def _team_members(comp_id: int) -> list:
    rows = repository.team_game_rows(comp_id)
    per_team: dict = {}
    for row in rows.values():                          # orden cronológico
        opp = repository.opponent_row(rows, row)
        if opp:                                        # sin fila del rival no hay métricas del partido
            per_team.setdefault(row["team_code"], []).append((row, team_game_adv(row, opp)))
    members = []
    for code, items in per_team.items():
        agg = aggregate_games([a for _, a in items], TEAM_AVG_KEYS, entity_type="team")
        members.append(Member(id=code, name=items[-1][0]["team_name"], values=agg["averages"],
                              sample={"games": len(items)}, games=len(items), team_code=code))
    return members


def _player_members(comp_id: int) -> list:
    team_rows = repository.team_game_rows(comp_id)
    groups: dict = {}
    for row in repository.player_game_rows(comp_id):
        groups.setdefault(identity.group_key(row), []).append(row)
    members = []
    for key, rows in groups.items():
        jugados = [r for r in rows if played(r["minutes"])]    # un DNP no es un partido (RF-3)
        if not jugados:
            continue                                   # solo convocado: no entra en la población
        advs = [player_game_adv(r, team_rows) for r in jugados]
        agg = aggregate_games(advs, PLAYER_AVG_KEYS, entity_type="player", empty_reason="dnp")
        members.append(Member(id=key, name=rows[-1]["player_name"], values=agg["averages"],
                              sample={"games": len(jugados)}, games=len(jugados),
                              team_code=rows[-1]["team_code"]))
    return members


def _legacy_population(entity_type: str, comp_id: int) -> Population:
    """Población de C-02 (sin umbrales, valores de `aggregate_games`): la fuente del bloque
    `league`/`leagues` legado de `/api/team` y `/api/player` y del radar (RF-5/D-5). T-01 NO la
    cambia; la ficha usa la población nueva (`population(..., apply_thresholds=True)`)."""
    members = _team_members(comp_id) if entity_type == "team" else _player_members(comp_id)
    return Population(entity_type, comp_id, (comp_id,), members=members)


def league_reference(entity_type: str, comp_id: int | None, ctx: Context, *,
                     variant=None, apply_thresholds: bool = True, base: str = "partido") -> dict:
    """`{métrica: promedio}` de la población (Arq. §3.6): por clave, la media de los valores no
    nulos de los miembros `in_population`. Sin universo → todos `None`.

    Los valores de cada miembro están en base `partido` (`population()` aplica `apply_base`
    partido). Para `base == "total"` (T-06, R-5) las métricas `count`/`volume` se re-escalan a
    total por miembro multiplicando por sus partidos antes de promediar; las tasas (`fixed`) no
    dependen de la base. Fase 1 solo soporta `total`/`partido`."""
    if comp_id is None:
        return {k: None for k in stats_engine.metrics_catalog_keys()}
    pop = population(entity_type, comp_id, ctx, apply_thresholds=apply_thresholds, variant=variant)
    members = [m for m in pop.members if m.in_population]

    count_keys = set()
    if base == "total":
        import metrics_catalog
        count_keys = {k for k, d in metrics_catalog.METRICS.items()
                      if d.base_mode in ("count", "volume")}

    out = {}
    for k in stats_engine.metrics_catalog_keys():
        if base == "total" and k in count_keys:
            vals = [m.values.get(k) * (m.games or 0) for m in members
                    if m.values.get(k) is not None]
        else:
            vals = [m.values.get(k) for m in members if m.values.get(k) is not None]
        out[k] = round(sum(vals) / len(vals), 4) if vals else None
    return out


def league_summary(entity_type: str, comp_id: int | None, ctx: Context, *,
                   competition_label: str | None = None) -> tuple:
    """`(league, league_meta)` LEGADO de una competencia (C-02): `{métrica: {avg, best, reason, n}}`
    sobre la población SIN umbrales (todas las entidades con datos). Lo consumen el bloque `league`
    de `/api/team`/`/api/player` y el radar; T-01 no lo toca (la ficha tiene su propio `avg`)."""
    keys = stats_engine.metric_keys(entity_type)
    if comp_id is None:
        league = {k: {"avg": None, "best": None, "reason": "sin_universo", "n": 0} for k in keys}
        return league, {"entity_type": entity_type, "competition_id": None, "competition_label": None,
                        "size": 0, "criterion": "sin_universo"}
    pop = _legacy_population(entity_type, comp_id)
    members = [m.values for m in pop.members if m.in_population]
    criterion = _TEAM_CRITERION if entity_type == "team" else _PLAYER_CRITERION
    return (league_averages(members, keys),
            {"entity_type": entity_type, "competition_id": comp_id,
             "competition_label": competition_label, "size": len(members), "criterion": criterion})


# ── Población con umbrales, ranking y ficha (T-01) ───────────────────────────

import unicodedata

import cache
import config

_CRITERIA = {
    "team": "equipos con ≥ {min} partidos",
    "player": "jugadores con ≥ {min} minutos",
    "lineup": "quintetos con ≥ {min} posesiones",
    "onoff": "jugadores con ON/OFF suficiente",
    "clutch": "equipos con cierres suficientes",
    "period": "equipos con muestra suficiente en el tramo",
}


def _criterion_text(entity_type: str) -> str:
    import sample as sample_mod
    tmpl = _CRITERIA.get(entity_type, "entidades con muestra suficiente")
    try:
        if entity_type == "team":
            return tmpl.format(min=config.get("sample.team.min"))
        if entity_type == "player":
            return tmpl.format(min=config.get("sample.player.min"))
        if entity_type == "lineup":
            return tmpl.format(min=config.get("sample.lineup.min"))
    except Exception:
        pass
    return tmpl


def population(entity_type: str, comp_id: int | None, ctx: Context, *,
              apply_thresholds: bool = True, variant=None) -> Population:
    """Población de referencia de una métrica: cada entidad del universo de la competencia con su
    valor por clave (el MISMO que muestra su ficha), su badge de muestra y si entra o no en la
    población (T-01 plan §4.1). `ctx.last` SÍ interviene en los valores de cada miembro (cada
    entidad con sus últimos N, RF-13), pero el universo es la competencia completa.

    Cacheada entre peticiones por versión de datos y de configuración (`cache.memo`)."""
    if entity_type not in ("team", "player", "lineup", "onoff", "clutch", "period"):
        raise ValueError(f"entity_type inválido: {entity_type}")

    key = (comp_id, context_key(ctx), apply_thresholds, variant)

    def build():
        return _build_population(entity_type, comp_id, ctx, apply_thresholds, variant)

    return cache.memo("pop:" + entity_type, key, build)


def _build_population(entity_type, comp_id, ctx, apply_thresholds, variant) -> Population:
    import sample as sample_mod

    ctx_key = context_key(ctx)
    criterion = _criterion_text(entity_type)
    context_label = ""
    try:
        context_label = context_echo(ctx, games_used=0, games_total=0, games_excluded={},
                                     ignored=[], competition_label=_label_for(comp_id))["label"]
    except Exception:
        context_label = ""

    def _pop(members, reason):
        return Population(entity_type=entity_type, comp_id=comp_id, ctx_key=ctx_key, variant=variant,
                          members=members, criterion=criterion, context_label=context_label,
                          reason=reason)

    if comp_id is None:
        return _pop([], "sin_universo")

    import metrics_catalog
    bundles = metrics_catalog.enumerate(entity_type, comp_id, ctx, variant)
    if not bundles:
        return _pop([], None)

    prior = None
    if entity_type in sample_mod.REGRESSED_TYPES or any(b.entity_type in sample_mod.REGRESSED_TYPES for b in bundles):
        prior = sample_mod.league_prior(comp_id, ctx)

    members = []
    for b in bundles:
        values = stats_engine.compute_standard(b)
        try:
            values = stats_engine.apply_base(values, b, "partido")
        except ValueError:
            pass
        if entity_type in sample_mod.REGRESSED_TYPES or b.entity_type in sample_mod.REGRESSED_TYPES:
            values = sample_mod.adjust_values(values, b, prior)

        # Valor de ranking por clave: `adj.value` donde hay ajuste (RF-16), si no el valor por partido.
        ranking_values = {}
        for k in stats_engine.metrics_catalog_keys():
            obj = values.get(k) or {}
            adj = obj.get("adj")
            if adj is not None and adj.get("value") is not None:
                ranking_values[k] = adj["value"]
            else:
                ranking_values[k] = obj.get("value")

        # Badge de muestra e `in_population`.
        badge = None
        team_poss = None
        if entity_type in sample_mod.ENTITY_SAMPLE:
            meta = b.meta or {}
            if entity_type in ("lineup", "onoff", "clutch"):
                tc = meta.get("team_code")
                if tc:
                    team_poss = sample_mod.team_offensive_possessions(tc, comp_id, ctx)
            if entity_type == "onoff":
                off_b = (b.meta or {}).get("off")
                sample_bundles = [b, off_b] if off_b is not None else [b, b]
            else:
                sample_bundles = [b]
            stype = "split" if b.entity_type == "split" else entity_type   # equipo con filtros de evento
            badge = sample_mod.sample_for(stype, sample_bundles, team_poss=team_poss)

        in_pop = True
        if apply_thresholds:
            in_pop = bool(badge and badge.get("ranked"))

        members.append(Member(
            id=b.entity_id, name=b.name, values=ranking_values, sample=badge,
            in_population=in_pop, games=b.games or 0, team_code=(b.meta or {}).get("team_code")))

    return _pop(members, None)


def _label_for(comp_id):
    if comp_id is None:
        return None
    try:
        return repository.competition_labels().get(comp_id)
    except Exception:
        return None


# ── Ranking, percentil, líder, ficha (Arq. §3.6) ─────────────────────────────

def _sign(direction: str) -> int:
    return -1 if direction == "lower" else 1


def rank(value, others: list, direction: str):
    """Puesto por competición estándar "1224" (Arq. §3.6): `rank = 1 + #{o : s·(o − value) > 0}`;
    `tied = #{o == value} > 0`. Compara sobre valores ya redondeados por `compute_standard`."""
    s = _sign(direction)
    r = 1 + sum(1 for o in others if o is not None and s * (o - value) > 0)
    tied = any(o is not None and o == value for o in others)
    return r, tied


def percentile(value, others: list, direction: str):
    """Percentil mid-rank SIN la propia entidad (Arq. §3.6): `round(100·(B + 0,5·E)/N)`, con
    `B` = estrictamente peores, `E` = iguales, `N` = `len(others)`. `N == 0` → `None`."""
    vals = [o for o in others if o is not None]
    n = len(vals)
    if n == 0:
        return None
    s = _sign(direction)
    b = sum(1 for o in vals if s * (o - value) < 0)   # o peor que value (orientado)
    e = sum(1 for o in vals if o == value)
    return round(100 * (b + 0.5 * e) / n)


def _norm_name(name) -> str:
    """Nombre sin tildes ni mayúsculas para el desempate alfabético (Arq. §3.6)."""
    s = unicodedata.normalize("NFKD", str(name))
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def _leader(members: list, key: str, direction: str):
    """Miembro con el mejor valor en `key` entre `members` (ya `in_population` y con valor no nulo);
    empate → el primero alfabético (sin tildes/mayúsculas). None si no hay valores."""
    cands = [m for m in members if m.values.get(key) is not None]
    if not cands:
        return None
    s = _sign(direction)
    best = max(m.values[key] * s for m in cands)
    tied = [m for m in cands if m.values[key] * s == best]
    tied.sort(key=lambda m: _norm_name(m.name))
    return tied[0]


def ficha(metric_key: str, value, entity_id, pop: Population, *, rank_value=None, base: str = "partido") -> dict:
    """Los campos de la ficha de UNA métrica (Arq. §3.6, pseudocódigo de plan §4.3). No toca
    `value`/`reason`: solo devuelve los campos nuevos para fusionar."""
    import metrics_catalog
    mdef = metrics_catalog.METRICS.get(metric_key)
    direction = mdef.direction if mdef else "higher"
    s = _sign(direction)
    v_rank = rank_value if rank_value is not None else value

    basis = None
    if mdef and mdef.base_mode in ("count", "volume") and base == "total":
        basis = "partido"

    me = pop.get(entity_id)
    in_pop = me.in_population if me else False

    empty = {"rank": None, "rank_total": None, "tied": False, "in_population": in_pop,
             "percentile": None, "avg": None, "dist_avg": None, "dist_avg_rel": None,
             "leader": None, "dist_leader": None, "dist_leader_rel": None,
             "pct_reason": None, "basis": basis}

    if value is None:
        return empty
    if pop.reason:
        return {**empty, "pct_reason": pop.reason}

    members = [m for m in pop.members if m.in_population and m.values.get(metric_key) is not None]
    if len(members) < config.get("population.min_size"):
        return {**empty, "pct_reason": "poblacion_insuficiente"}

    others = [m.values[metric_key] for m in members if str(m.id) != str(entity_id)]
    r, tied = rank(v_rank, others, direction)
    p = percentile(v_rank, others, direction)

    vals = [m.values[metric_key] for m in members]
    avg = round(sum(vals) / len(vals), 4)
    leader_m = _leader(members, metric_key, direction)
    leader_val = leader_m.values[metric_key] if leader_m else None

    dist_avg = round(s * (v_rank - avg), 4)
    dist_leader = round(s * (v_rank - leader_val), 4) if leader_val is not None else None

    def _rel(dist, ref):
        if dist is None or ref is None:
            return None
        if not (mdef and mdef.rel_dist):
            return None
        if abs(ref) < 0.05:
            return None
        return round(dist / abs(ref), 4)

    return {
        "rank": r, "rank_total": len(members), "tied": tied, "in_population": in_pop,
        "percentile": p, "avg": avg,
        "dist_avg": dist_avg, "dist_avg_rel": _rel(dist_avg, avg),
        "leader": ({"id": leader_m.id, "name": leader_m.name, "value": leader_val}
                   if leader_m else None),
        "dist_leader": dist_leader, "dist_leader_rel": _rel(dist_leader, leader_val),
        "pct_reason": None, "basis": basis,
    }


def attach_fichas(metrics: dict, entity_type: str, entity_id, pop: Population, *,
                  rank_values: dict, base: str = "partido") -> dict:
    """Fusiona los campos de la ficha en cada objeto de `metrics` (plan §4.3). No toca
    `value`/`reason`/`adj`/`sample`."""
    for k, obj in metrics.items():
        if not isinstance(obj, dict):
            continue
        obj.update(ficha(k, obj.get("value"), entity_id, pop,
                         rank_value=rank_values.get(k), base=base))
    return metrics


def full_ranking(entity_type: str, metric_key: str, comp_id: int | None, ctx: Context,
                 highlight_id=None, variant=None) -> dict:
    """Ranking completo de una métrica en la población (plan §3.2/§4.3): filas ordenadas, fuera de
    población con rank hipotético, y promedio."""
    import metrics_catalog
    mdef = metrics_catalog.METRICS[metric_key]
    direction = mdef.direction
    s = _sign(direction)

    pop = population(entity_type, comp_id, ctx, variant=variant)
    in_pop = [m for m in pop.members if m.in_population and m.values.get(metric_key) is not None]
    out_pop = [m for m in pop.members if not m.in_population and m.values.get(metric_key) is not None]

    in_vals = [m.values[metric_key] for m in in_pop]

    rows = []
    for m in in_pop:
        v = m.values[metric_key]
        others = [x for x in in_vals]
        # excluir UNA aparición propia para el rank competición estándar sobre los demás
        others_wo = list(others)
        others_wo.remove(v)
        r, tied = rank(v, others_wo, direction)
        rows.append({"rank": r, "tied": tied, "id": m.id, "name": m.name, "value": v,
                     "in_population": True, "highlight": str(m.id) == str(highlight_id)})
    rows.sort(key=lambda row: (row["rank"], _norm_name(row["name"])))

    outside = []
    for m in out_pop:
        v = m.values[metric_key]
        hyp = 1 + sum(1 for x in in_vals if s * (x - v) > 0)
        outside.append({"id": m.id, "name": m.name, "value": v,
                        "hypothetical_rank": hyp,
                        "highlight": str(m.id) == str(highlight_id),
                        "sample": m.sample})
    outside.sort(key=lambda row: (row["hypothetical_rank"], _norm_name(row["name"])))

    avg = round(sum(in_vals) / len(in_vals), 4) if in_vals else None

    return {
        "entity_type": entity_type,
        "metric": metric_key,
        "direction": direction,
        "rank_basis": "partido" if mdef.base_mode in ("count", "volume") else None,
        "population": {
            "size": len(in_pop),
            "criterion": pop.criterion,
            "competition_id": comp_id,
            "context_label": pop.context_label,
            "reason": pop.reason,
        },
        "rows": rows,
        "outside_population": outside,
        "avg": avg,
    }


# ── Perfiles ────────────────────────────────────────────────────────────────

def _comp_options(rows: list, labels: dict, counts=None) -> list:
    """Competencias en que la entidad tiene partidos: `[{id, label, games}]` (selector de la vista).
    `counts(fila)` dice qué filas suman a `games` (el jugador cuenta solo las que jugó)."""
    games: dict = {}
    for r in rows:
        cid = r.get("competition_id")
        if cid is not None:
            games[cid] = games.get(cid, 0) + (1 if counts is None or counts(r) else 0)
    return sorted(({"id": cid, "label": labels.get(cid, "—"), "games": n} for cid, n in games.items()),
                  key=lambda c: c["label"])


def team_profile(team_code: str, ctx: Context) -> dict | None:
    """Respuesta de `GET /api/team/<code>` para la selección `ctx`. None = el equipo no tiene partidos."""
    rows = repository.team_game_rows(None)
    own_all = [r for r in rows.values() if r["team_code"] == team_code]
    if not own_all:
        return None
    labels = repository.competition_labels()
    own = [r for r in own_all if repository.opponent_row(rows, r)]
    sel = filter_games(own, ctx, team_code)
    games_total = len(filter_games(own, without_last(ctx), team_code))

    per_game = [(r, team_game_adv(r, repository.opponent_row(rows, r))) for r in sel]
    advs = [a for _, a in per_game]
    agg = aggregate_games(advs, TEAM_AVG_KEYS, entity_type="team")

    wins = sum(1 for a in advs if a.get("pts", 0) > a.get("opp_pts", 0))
    home = [a for (r, a) in per_game if r["is_home"]]
    away = [a for (r, a) in per_game if not r["is_home"]]
    home_wins = sum(1 for a in home if a.get("pts", 0) > a.get("opp_pts", 0))
    away_wins = sum(1 for a in away if a.get("pts", 0) > a.get("opp_pts", 0))
    record = {
        "wins": wins,
        "losses": len(advs) - wins,
        "win_pct": round(wins / len(advs), 3) if advs else None,   # tasa: sin partidos → None (RF-5)
        "home": f"{home_wins}-{len(home) - home_wins}",
        "away": f"{away_wins}-{len(away) - away_wins}",
    }

    game_log = []
    for r, adv in per_game:
        opp = repository.opponent_row(rows, r)
        game_log.append({
            "game_id": r["game_id"],
            "date": r["date"],
            "competition": r["competition"],
            "competition_id": r["competition_id"],
            "competition_label": labels.get(r["competition_id"]),
            "opponent": opp["team_name"],
            "opponent_code": opp["team_code"],
            "home_away": "L" if r["is_home"] else "V",
            **adv,
            "null_reasons": null_reasons(adv),   # C-11 RF-3
        })

    comp_id = None if ctx.competition_all else ctx.competition_id
    comp_label = labels.get(ctx.competition_id)
    league, league_meta = league_summary("team", comp_id, ctx, competition_label=comp_label)
    return {
        "team_code": team_code,
        "team_name": own_all[-1]["team_name"],           # el del partido más reciente (F-11)
        "games": len(per_game),
        "context": context_echo(ctx, games_used=len(per_game), games_total=games_total,
                                games_excluded=rest_excluded(own, ctx, team_code), ignored=[],
                                competition_label=comp_label),
        "competitions": _comp_options(own, labels),
        "record": record,
        "averages": agg["averages"],
        "null_reasons": agg["null_reasons"],
        "totals": agg["totals"],
        "league": league,
        "league_meta": league_meta,
        "game_log": game_log,
    }


def player_profile(player_id: int, ctx: Context) -> dict | None:
    """Respuesta de `GET /api/player/…` para la selección `ctx`: TODAS las fichas de la ficha de jugador
    (aunque el nombre haya variado, C-08), con los DNP en el game log pero fuera de los promedios.
    None = la ficha no tiene partidos visibles."""
    own = [r for r in repository.player_game_rows(None) if r["player_id"] == player_id]
    if not own:
        return None
    ficha = db.session.get(Player, player_id)
    team_rows = repository.team_game_rows(None)
    labels = repository.competition_labels()
    # posición estable entre TODOS sus partidos (C-08 RF-4/RF-6), no solo los de la selección
    position = resolve_identity([SimpleNamespace(player_name=r["player_name"], position=r["position"])
                                 for r in own])[1]
    team_code = own[-1]["team_code"]

    sel = filter_games(own, ctx, team_code)
    scoped = filter_games(own, without_last(ctx), team_code)

    game_log, jugados = [], []
    for r in sel:
        adv = player_game_adv(r, team_rows)
        is_played = played(r["minutes"])
        if is_played:
            jugados.append(adv)
        team = team_rows.get((r["game_id"], team_code))
        opp = repository.opponent_row(team_rows, team) if team else None
        game_log.append({
            "game_id": r["game_id"],
            "date": r["date"],
            "competition": r["competition"],
            "competition_id": r["competition_id"],
            "competition_label": labels.get(r["competition_id"]),
            "opponent": opp["team_name"] if opp else "",
            "opponent_code": opp["team_code"] if opp else "",
            "played": is_played,                       # false = DNP (Feature 12 RF-6)
            **strip_private(adv),
            "null_reasons": null_reasons(adv, played=is_played),   # C-11 RF-3
        })

    # Sin partidos jugados todo es nulo: `dnp` si la selección tiene fichas (todas DNP), `sin_datos` si no
    agg = aggregate_games(jugados, PLAYER_AVG_KEYS, entity_type="player",
                          empty_reason="dnp" if sel else "sin_datos")

    comp_id = None if ctx.competition_all else ctx.competition_id
    comp_label = labels.get(ctx.competition_id)
    league, league_meta = league_summary("player", comp_id, ctx, competition_label=comp_label)
    n_dnp = len(sel) - len(jugados)
    return {
        "player": ficha.display_name,                  # grafía real de la ficha, nunca el nombre normalizado
        "player_id": player_id,
        "position": position,
        "position_group": identity.position_group(position),
        "team_code": team_code,
        "team_name": own[-1]["team_name"],
        "games": len(jugados),                         # partidos JUGADOS (excluye DNP) — Feature 12 RF-7
        "context": context_echo(ctx, games_used=len(jugados),
                                games_total=sum(1 for r in scoped if played(r["minutes"])),
                                games_excluded={**rest_excluded(own, ctx, team_code),
                                                **({"dnp": n_dnp} if n_dnp else {})}, ignored=[],
                                competition_label=comp_label),
        "competitions": _comp_options(own, labels, lambda r: played(r["minutes"])),
        "averages": agg["averages"],
        "null_reasons": agg["null_reasons"],
        "totals": agg["totals"],
        "league": league,
        "league_meta": league_meta,
        "game_log": game_log,
    }
