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
from context import Context, filter_games, context_echo, context_key, without_last
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
    values: dict                         # {clave: valor} = `averages` de aggregate_games
    sample: dict = field(default_factory=dict)
    in_population: bool = True           # T-01: False para quien no llega al mínimo de muestra


@dataclass
class Population:
    entity_type: str                     # "team" | "player"
    comp_id: int | None
    ctx_key: tuple
    members: list


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
                              sample={"games": len(items)}))
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
                              sample={"games": len(jugados)}))
    return members


def population(entity_type: str, comp_id: int, ctx: Context, *, apply_thresholds: bool = False) -> Population:
    """Entidades de una competencia con su valor por métrica. `ctx.last` NO interviene: el promedio de
    liga es el de la competencia completa, no el del subconjunto en pantalla (RF-1; T-01 decide si el
    contexto entra en la población). Memo por petición, sin caché entre peticiones."""
    if apply_thresholds:
        raise NotImplementedError("Umbrales de población: T-01")
    if entity_type not in ("team", "player"):
        raise ValueError(f"entity_type inválido: {entity_type}")

    def build():
        members = _team_members(comp_id) if entity_type == "team" else _player_members(comp_id)
        return Population(entity_type, comp_id, context_key(without_last(ctx)), members)

    return repository.memo(("population", entity_type, comp_id), build)


def league_reference(entity_type: str, comp_id: int, ctx: Context) -> dict:
    """`{métrica: promedio}` de la competencia (la firma de arquitectura §3.6): solo la media."""
    pop = population(entity_type, comp_id, ctx)
    summary = league_averages([m.values for m in pop.members if m.in_population],
                              stats_engine.metric_keys(entity_type))
    return {k: v["avg"] for k, v in summary.items()}


def league_summary(entity_type: str, comp_id: int | None, ctx: Context, *,
                   competition_label: str | None = None) -> tuple:
    """`(league, league_meta)` de una competencia: `{métrica: {avg, best, reason, n}}` y de qué población
    salió. Sin competencia (`all` o ninguna) no hay universo: cada métrica es `Ø —` con razón
    `sin_universo` (RF-7)."""
    keys = stats_engine.metric_keys(entity_type)
    if comp_id is None:
        league = {k: {"avg": None, "best": None, "reason": "sin_universo", "n": 0} for k in keys}
        return league, {"entity_type": entity_type, "competition_id": None, "competition_label": None,
                        "size": 0, "criterion": "sin_universo"}
    pop = population(entity_type, comp_id, ctx)
    members = [m.values for m in pop.members if m.in_population]
    criterion = _TEAM_CRITERION if entity_type == "team" else _PLAYER_CRITERION
    return (league_averages(members, keys),
            {"entity_type": entity_type, "competition_id": comp_id,
             "competition_label": competition_label, "size": len(members), "criterion": criterion})


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
                                games_excluded={}, ignored=[], competition_label=comp_label),
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
                                games_excluded={"dnp": n_dnp} if n_dnp else {}, ignored=[],
                                competition_label=comp_label),
        "competitions": _comp_options(own, labels, lambda r: played(r["minutes"])),
        "averages": agg["averages"],
        "null_reasons": agg["null_reasons"],
        "totals": agg["totals"],
        "league": league,
        "league_meta": league_meta,
        "game_log": game_log,
    }
