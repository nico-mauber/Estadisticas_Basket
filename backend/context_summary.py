"""Resumen de la cabecera de contexto (F-19): qué selección quedó y cómo le fue.

Reutiliza el eco de contexto de T-03 (`context_echo`: partidos usados / totales / excluidos / filtros ignorados /
etiqueta) y el badge de muestra de T-02; no recalcula métricas. Récord y diferencia media salen del resultado final
de los partidos de la selección: victoria = puntos propios > puntos del rival.
"""
import population
import repository
import sample
from stats_engine import _parse_minutes, played


def _comp_arg(ctx):
    return None if ctx.competition_all else ctx.competition_id


def _margin(diffs: list):
    return round(sum(diffs) / len(diffs), 1) if diffs else None


def _record(wins: int, losses: int) -> str:
    return f"{wins}-{losses}"


def _team_total(team_code: str, ctx) -> int:
    """M de "N de M": partidos del equipo en la competencia SIN ningún otro filtro (ni período, sede ni rival)."""
    rows = repository.team_game_rows(_comp_arg(ctx))
    return sum(1 for r in rows.values() if r["team_code"] == team_code and repository.opponent_row(rows, r))


def _player_total(player_id: int, ctx) -> int:
    """M de "N de M" del jugador: partidos que jugó en la competencia sin otros filtros."""
    return sum(1 for r in repository.player_game_rows(_comp_arg(ctx))
               if r["player_id"] == player_id and played(r.get("minutes")))


def team_summary(team_code: str, ctx) -> dict | None:
    profile = population.team_profile(team_code, ctx)
    if profile is None:
        return None
    diffs = [g["pts"] - g["opp_pts"] for g in profile["game_log"] if g.get("pts") is not None and g.get("opp_pts") is not None]
    rec = profile["record"]
    n = profile["games"]
    return {
        "entity": {"type": "team", "id": team_code, "name": profile["team_name"]},
        "record": _record(rec["wins"], rec["losses"]), "wins": rec["wins"], "losses": rec["losses"],
        "avg_margin": _margin(diffs), "games": n, "games_total": _team_total(team_code, ctx),
        "sample": sample.sample_level("team", n=n, unit="partidos"),
        "context": profile["context"],
    }


def player_summary(player_id: int, ctx) -> dict | None:
    profile = population.player_profile(player_id, ctx)
    if profile is None:
        return None
    team_code = profile["team_code"]
    team_rows = repository.team_game_rows(None)
    mine = {r["game_id"]: r for r in repository.player_game_rows(None) if r["player_id"] == player_id}
    wins = losses = 0
    diffs, minutes = [], 0.0
    for g in profile["game_log"]:
        if not g.get("played"):
            continue                      # DNP: el récord es el del equipo en los partidos que jugó
        team = team_rows.get((g["game_id"], team_code))
        opp = repository.opponent_row(team_rows, team) if team else None
        if team is not None and opp is not None and team.get("pts") is not None and opp.get("pts") is not None:
            d = team["pts"] - opp["pts"]
            diffs.append(d)
            wins += 1 if d > 0 else 0
            losses += 1 if d <= 0 else 0
        row = mine.get(g["game_id"])
        if row and played(row.get("minutes")):
            minutes += _parse_minutes(row["minutes"])
    return {
        "entity": {"type": "player", "id": profile["player_id"], "name": profile["player"]},
        "record": _record(wins, losses), "wins": wins, "losses": losses,
        "avg_margin": _margin(diffs), "games": profile["games"], "games_total": _player_total(player_id, ctx),
        "sample": sample.sample_level("player", n=minutes, unit="minutos"),
        "context": profile["context"],
    }


def competition_summary(comp_id: int | None, ctx) -> dict:
    games = repository.competition_games(comp_id)
    label = repository.competition_labels().get(comp_id) if comp_id is not None else "Todas las competencias"
    import metrics_catalog
    from context import context_echo
    echo = context_echo(ctx, games_used=len(games), games_total=len(games), games_excluded={}, ignored=[],
                        competition_label=metrics_catalog._competition_label(ctx))
    return {
        "entity": {"type": "competition", "id": comp_id, "name": label},
        "record": None, "wins": None, "losses": None, "avg_margin": None,
        "games": len(games), "games_total": len(games), "sample": None, "context": echo,
    }
