"""Desglose ofensivo calculado cuando FIBA no lo publica.

Algunas competencias no mandan `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts` ni
`fast_break_pts`: la ingesta guarda `NULL` y la card "Desglose ofensivo" quedaba en "—". Con el
play-by-play y los tiros se pueden calcular:

- `bench_pts`: puntos de los jugadores que no empezaron el partido (box, exacto).
- `paint_pts`: 2 × tiros de campo convertidos dentro de la pintura (zona `restricted_area`).
- `second_chance_pts`: puntos de las oportunidades que siguen a un rebote ofensivo (A-04).
- `pts_from_tov`: puntos de las posesiones que empiezan con un robo o una pérdida rival (A-02).
- `fast_break_pts`: puntos de las posesiones de transición (A-03; aproximación: es lo que se resuelve
  en `transition.max_secs` o menos, no la definición de FIBA).

Solo se completa el valor `NULL` (lo que FIBA informa, incluso 0, no se toca) y la fila queda marcada en
`_derived` para que la pantalla diga que es un cálculo propio.
"""
import cache
import possessions
import repository
import shot_zones
import transition  # noqa: F401 — registra el tipo de posesión (A-03) antes de leer `ptype`
from database import db, PlayerGameStats

EXTRAS = ("paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts")
_LABELS = {"paint_pts": "pintura", "second_chance_pts": "segunda oportunidad", "pts_from_tov": "tras pérdida rival",
           "bench_pts": "banca", "fast_break_pts": "contraataque"}
DERIVED_NOTE = ("Calculado desde el play-by-play: FIBA no publica este dato en la competencia. "
                "El contraataque cuenta las posesiones de transición (aproximación).")


def _bench_points(game_ids) -> dict:
    """`{(game_id, team_code): puntos de quienes no fueron titulares}`; una consulta para todos los partidos."""
    out: dict = {}
    ids = list(game_ids)
    for i in range(0, len(ids), 400):
        q = (db.session.query(PlayerGameStats.game_id, PlayerGameStats.team_code, db.func.sum(PlayerGameStats.pts))
             .filter(PlayerGameStats.game_id.in_(ids[i:i + 400]), PlayerGameStats.starter == 0)
             .group_by(PlayerGameStats.game_id, PlayerGameStats.team_code))
        for gid, team, pts in q.all():
            out[(gid, team)] = int(pts or 0)
    return out


def _from_possessions(game_id: str, team_code: str) -> dict:
    """Puntos por origen de las posesiones del equipo; vacío si el partido no tiene play-by-play."""
    def build():
        poss = possessions.game_possessions(game_id)
        mine = [p for p in poss if p.team == team_code and not p.incomplete]
        if not mine:
            return {}
        return {
            "second_chance_pts": sum(ch.pts for p in mine for ch in p.chances if ch.n >= 2),
            "pts_from_tov": sum(p.pts for p in mine if p.origin in ("robo", "perdida_rival")),
            "fast_break_pts": sum(p.pts for p in mine if p.ptype == "transicion"),
        }
    return cache.memo("breakdown:poss", (game_id, team_code), build)


def fill_extras(rows: dict) -> None:
    """Completa en `rows` ({(game_id, team_code): fila}) los campos de EXTRAS que vienen `NULL`."""
    pending = {k: r for k, r in rows.items() if any(r.get(e) is None for e in EXTRAS)}
    if not pending:
        return
    bench = _bench_points({gid for gid, _ in pending})
    for (gid, team), r in pending.items():
        derived = {}
        derived.update(_from_possessions(gid, team))
        zones = shot_zones.game_zone_counts(gid)
        if zones is not None and (team, None) in zones:
            derived["paint_pts"] = zones[(team, None)]["paint_pts"]
        if (gid, team) in bench:
            derived["bench_pts"] = bench[(gid, team)]
        used = []
        for key in EXTRAS:
            if r.get(key) is None and key in derived:
                r[key] = derived[key]
                used.append(key)
        if used:
            r["_derived"] = used


def derived_sources(rows) -> dict:
    """`{clave: "calculado" | "oficial"}` para las filas dadas: "calculado" si algún partido salió del cálculo propio."""
    return {k: ("calculado" if any(k in (r.get("_derived") or ()) for r in rows) else "oficial") for k in EXTRAS}


repository.register_row_filler(fill_extras)
