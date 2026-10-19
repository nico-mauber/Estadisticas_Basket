"""Días de descanso de un equipo antes de un partido (T-03 RF-6).

Se mide sobre TODOS los partidos publicados del equipo (cualquier competencia): días calendario entre el
partido anterior y este, menos uno. Partidos en días consecutivos = 0 días de descanso. Se agrupa en
`0`, `1`, `2` y `3mas`. Sin partido anterior o sin fecha válida no hay descanso calculable.
"""
from datetime import date

import repository

BUCKETS = ("0", "1", "2", "3mas")


def _parse(d) -> date | None:
    try:
        return date.fromisoformat(str(d)[:10])
    except (TypeError, ValueError):
        return None


def _bucket(days: int) -> str:
    return "3mas" if days >= 3 else str(max(days, 0))


def team_rest(team_code: str) -> dict:
    """{game_id: bucket | None} de cada partido publicado del equipo (memoizado por versión de datos).
    None = descanso no calculable (primer partido del equipo o fecha faltante)."""
    def build():
        rows = [r for r in repository.team_game_rows(None).values() if r["team_code"] == team_code]
        rows.sort(key=lambda r: (r.get("date") or "", r["game_id"]))
        out, prev = {}, None
        for r in rows:
            cur = _parse(r.get("date"))
            out[r["game_id"]] = None if (cur is None or prev is None) else _bucket((cur - prev).days - 1)
            if cur is not None:
                prev = cur
        return out
    return repository.memo(("team_rest", team_code), build)


def days_rest(team_code: str, game_id: str) -> str | None:
    """Bucket de descanso del equipo antes del partido (`None` si no es calculable)."""
    return team_rest(team_code).get(game_id)
