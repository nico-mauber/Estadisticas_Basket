"""
Competencias y temporadas: el universo de cálculo (F-11).

Una fila de `competitions` es una competencia EN una temporada. Cada texto de competencia
que llega de FIBA (`games.competition`, se conserva crudo) se mapea a una competencia por
`competition_aliases`, así renombrar o fusionar no toca el dato scrapeado.

Estados: `publicada` (visible en toda la app) y `borrador` (sus partidos solo se ven en la
sección Datos: no entran en ningún cálculo ni listado — ver `hidden_game_ids`).
"""
import re
from datetime import datetime

from flask import g
from sqlalchemy import func

from database import db, Competition, CompetitionAlias, Game, TeamGameStats

STATUSES = ("publicada", "borrador")
DEFAULT_STATUS = "publicada"   # DA-13: las creadas al importar no se ocultan

# Sufijo de temporada al final del texto de FIBA: "2026", "2025/2026", "2025-26".
_SEASON_RE = re.compile(r"(\d{4}(?:\s*[/-]\s*\d{2,4})?)\s*$")


class CompetitionError(Exception):
    """Error de negocio con su código HTTP (400 dato inválido, 404, 409 conflicto)."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def split_source(source: str) -> tuple[str, str | None]:
    """'Liga Uruguaya de Basquetbol 2025/2026' → ('Liga Uruguaya de Basquetbol', '2025/2026')."""
    text = re.sub(r"\s+", " ", source or "").strip()
    m = _SEASON_RE.search(text)
    if not m or not text[:m.start()].strip():
        return text, None
    season = re.sub(r"\s+", "", m.group(1))
    return text[:m.start()].strip(), season


def label(c: Competition) -> str:
    return f"{c.name} {c.season}" if c.season else c.name


def _find(name: str, season: str | None, exclude_id: int | None = None) -> Competition | None:
    q = Competition.query.filter(func.lower(Competition.name) == name.lower())
    q = q.filter(Competition.season.is_(None)) if season is None else q.filter(Competition.season == season)
    if exclude_id is not None:
        q = q.filter(Competition.id != exclude_id)
    return q.first()


def ensure_for_source(source: str) -> int | None:
    """Id de la competencia de un texto de FIBA; crea competencia y alias si no existen.

    No hace commit: lo hace quien persiste el partido. Texto vacío → None (sin competencia).
    """
    source = re.sub(r"\s+", " ", source or "").strip()
    if not source:
        return None
    alias = db.session.get(CompetitionAlias, source)
    if alias:
        return alias.competition_id
    name, season = split_source(source)
    comp = _find(name, season)
    if not comp:
        comp = Competition(name=name, season=season, status=DEFAULT_STATUS)
        db.session.add(comp)
        db.session.flush()
    db.session.add(CompetitionAlias(source_name=source, competition_id=comp.id))
    db.session.flush()
    return comp.id


def backfill() -> int:
    """Asigna competencia a los partidos que no la tienen. Idempotente: solo toca NULL."""
    games = Game.query.filter(Game.competition_id.is_(None)).all()
    for game in games:
        game.competition_id = ensure_for_source(game.competition)
    db.session.commit()
    return len(games)


def get(comp_id: int) -> Competition:
    comp = db.session.get(Competition, comp_id)
    if not comp:
        raise CompetitionError("Competencia no encontrada.", 404)
    return comp


def resolve(value) -> int | None:
    """Parámetro `competition` de una petición → id. Acepta id o el texto de FIBA (legado)."""
    value = str(value or "").strip()
    if not value:
        return None
    if value.isdigit():
        comp = db.session.get(Competition, int(value))
        if not comp:
            raise CompetitionError("La competencia no existe.", 400)
        return comp.id
    alias = db.session.get(CompetitionAlias, value)
    if not alias:
        raise CompetitionError("La competencia no existe.", 400)
    return alias.competition_id


def to_dict(c: Competition, stats: dict | None = None) -> dict:
    st = (stats or {}).get(c.id, {})
    return {
        "id": c.id, "name": c.name, "season": c.season, "label": label(c), "status": c.status,
        "games": st.get("games", 0), "teams": st.get("teams", 0),
        "first_date": st.get("first_date"), "last_date": st.get("last_date"),
    }


def describe(c: Competition) -> dict:
    """Objeto de una competencia con sus conteos (respuestas de alta y edición)."""
    return to_dict(c, _stats())


def _stats() -> dict:
    games = (db.session.query(Game.competition_id, func.count(Game.id),
                              func.min(Game.date), func.max(Game.date))
             .group_by(Game.competition_id).all())
    teams = (db.session.query(Game.competition_id, func.count(func.distinct(TeamGameStats.team_code)))
             .join(TeamGameStats, TeamGameStats.game_id == Game.game_id)
             .group_by(Game.competition_id).all())
    out = {cid: {"games": n, "first_date": d0 or None, "last_date": d1 or None} for cid, n, d0, d1 in games}
    for cid, n in teams:
        out.setdefault(cid, {})["teams"] = n
    return out


def list_competitions(include_hidden: bool = False) -> list[dict]:
    """Competencias ordenadas por último partido (más reciente primero). Sin `include_hidden`,
    solo las publicadas (selectores de Liga/Equipo/Comparar/Jugador)."""
    q = Competition.query
    if not include_hidden:
        q = q.filter(Competition.status == "publicada")
    stats = _stats()
    items = [to_dict(c, stats) for c in q.all()]
    items.sort(key=lambda c: (c["last_date"] or "", c["label"]), reverse=True)
    return items


def create(name: str, season: str | None) -> Competition:
    name = (name or "").strip()
    season = (season or "").strip() or None
    if not name:
        raise CompetitionError("El nombre es obligatorio.")
    if _find(name, season):
        raise CompetitionError("Ya existe una competencia con ese nombre y temporada.", 409)
    comp = Competition(name=name, season=season, status=DEFAULT_STATUS)
    db.session.add(comp)
    db.session.commit()
    return comp


def update(comp_id: int, data: dict) -> Competition:
    comp = get(comp_id)
    name = (data.get("name", comp.name) or "").strip()
    season = (data.get("season", comp.season) or "").strip() or None
    status = data.get("status", comp.status)
    if not name:
        raise CompetitionError("El nombre es obligatorio.")
    if status not in STATUSES:
        raise CompetitionError("Estado inválido.")
    if _find(name, season, exclude_id=comp.id):
        raise CompetitionError("Ya existe una competencia con ese nombre y temporada.", 409)
    comp.name, comp.season, comp.status = name, season, status
    db.session.commit()
    return comp


def merge(target_id: int, source_id: int) -> dict:
    """Pasa partidos y alias de `source_id` a `target_id` y borra la competencia origen."""
    if target_id == source_id:
        raise CompetitionError("No se puede fusionar una competencia consigo misma.", 409)
    target, source = get(target_id), get(source_id)
    moved_games = Game.query.filter_by(competition_id=source.id).update({"competition_id": target.id})
    moved_aliases = CompetitionAlias.query.filter_by(competition_id=source.id).update(
        {"competition_id": target.id})
    db.session.delete(source)
    db.session.commit()
    return {"target": describe(target), "moved_games": moved_games, "moved_aliases": moved_aliases}


def assign_game(game_id: str, comp_id: int) -> Game:
    """Reasignación manual; sobrevive a reimportaciones y reprocesos (ingest la respeta)."""
    game = Game.query.filter_by(game_id=game_id).first()
    if not game:
        raise CompetitionError("Partido no encontrado.", 404)
    if not db.session.get(Competition, comp_id):
        raise CompetitionError("La competencia no existe.", 400)
    game.competition_id = comp_id
    db.session.commit()
    return game


def labels() -> dict[int, dict]:
    """{id: {"label", "status"}} de todas las competencias (para decorar partidos)."""
    return {c.id: {"label": label(c), "status": c.status} for c in Competition.query.all()}


def hidden_game_ids() -> set[str]:
    """Partidos de competencias en borrador: fuera de todo cálculo y listado salvo en Datos.

    Se calcula una vez por petición (cache en `flask.g`).
    """
    if "hidden_game_ids" not in g:
        rows = (db.session.query(Game.game_id)
                .join(Competition, Competition.id == Game.competition_id)
                .filter(Competition.status == "borrador").all())
        g.hidden_game_ids = {gid for (gid,) in rows}
    return g.hidden_game_ids


def visible(query, model):
    """Filtra una query de un modelo con `game_id` para excluir los partidos ocultos."""
    hidden = hidden_game_ids()
    return query.filter(model.game_id.notin_(hidden)) if hidden else query
