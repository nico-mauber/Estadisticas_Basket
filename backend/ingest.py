"""
Ingesta de partidos: persistencia, archivo del JSON crudo y reproceso (F-11).

Un partido se guarda siempre igual, venga de una importación o de un reproceso:
la fila de `games` se hace upsert (conserva `id`, `imported_at` y la competencia asignada)
y sus filas hijas (equipos, jugadores, tiros, play-by-play) se reemplazan completas. Así
reprocesar dos veces deja exactamente el mismo estado y no quedan filas viejas huérfanas.

El JSON crudo de FIBA se archiva comprimido en `game_sources` (DA-12): reprocesar tras un
cambio del parser no depende de que FIBA siga sirviendo el partido.
"""
import gzip
import json
from datetime import datetime

from sqlalchemy.dialects.sqlite import insert as sqlite_insert

import competitions
import fiba_fetcher
from database import db, Game, GameSource, TeamGameStats, PlayerGameStats, Shot, PbpEvent

# Versión de la ingesta con que se guardó cada partido (`games.ingest_version`).
#   NULL / 1 — previa a F-11 (sin minutos reales ni coordenadas de tiro)
#   2        — F-11: minutos reales, coordenadas, archivo crudo
# Subirla cuando un cambio del parser deba llegar a los partidos ya importados: el panel de
# calidad los marca "pendientes de reproceso".
INGEST_VERSION = 2

# Partidos por petición de reproceso. Peor caso sin archivo: 5 descargas × 20 s de timeout de
# urllib = 100 s, por debajo de los 180 s de gunicorn (render.yaml).
REPROCESS_BATCH = 5


def needs_reprocess(game: Game) -> bool:
    """Guardado con una ingesta anterior a la vigente (NULL = previa a F-11)."""
    return (game.ingest_version or 1) < INGEST_VERSION


def import_url(url: str) -> dict:
    """Descarga, archiva y guarda un partido desde su URL de FIBA LiveStats."""
    raw, page_info = fiba_fetcher.fetch_raw(url)
    game_id = fiba_fetcher.extract_game_id(url)
    game = fiba_fetcher.parse_game(raw, game_id, page_info)
    persist_game(game)
    archive_raw(game_id, raw, page_info, source_url=url)
    db.session.commit()
    return _summary(game)


def _summary(game: dict) -> dict:
    g = Game.query.filter_by(game_id=game["game_id"]).first()
    comp = competitions.labels().get(g.competition_id) if g and g.competition_id else None
    return {
        "game_id": game["game_id"],
        "teams": [{"code": t["team_code"], "name": t["team_name"]} for t in game.get("teams", [])],
        "competition_id": g.competition_id if g else None,
        "competition_label": comp["label"] if comp else None,
    }


def archive_raw(game_id: str, raw: dict, page_info: dict, source_url: str | None = None) -> None:
    src = db.session.get(GameSource, game_id) or GameSource(game_id=game_id)
    src.source_url = source_url or src.source_url
    src.fetched_at = datetime.utcnow().isoformat()
    src.raw_gz = gzip.compress(json.dumps(raw, separators=(",", ":")).encode("utf-8"))
    src.page_info = json.dumps(page_info or {}, ensure_ascii=False)
    db.session.add(src)


def load_archived(game_id: str) -> tuple[dict, dict] | None:
    src = db.session.get(GameSource, game_id)
    if not src or not src.raw_gz:
        return None
    return json.loads(gzip.decompress(src.raw_gz)), json.loads(src.page_info or "{}")


def persist_game(game: dict) -> None:
    """Guarda un partido parseado. No hace commit (lo hace quien llama)."""
    game_id = game["game_id"]

    # La competencia asignada (automática o manual) se conserva al reimportar/reprocesar
    existing = Game.query.filter_by(game_id=game_id).first()
    comp_id = (existing.competition_id if existing and existing.competition_id
               else competitions.ensure_for_source(game.get("competition")))

    fields = dict(
        competition    = game.get("competition"),
        date           = game.get("date"),
        home_team      = game.get("home_team"),
        home_code      = game.get("home_code"),
        away_team      = game.get("away_team"),
        away_code      = game.get("away_code"),
        home_score     = game.get("home_score"),
        away_score     = game.get("away_score"),
        minutes        = game.get("minutes", 40),
        competition_id = comp_id,
        ingest_version = INGEST_VERSION,
    )
    db.session.execute(
        sqlite_insert(Game).values(game_id=game_id, **fields)
        .on_conflict_do_update(index_elements=["game_id"], set_=fields)
    )

    for model in (TeamGameStats, PlayerGameStats, Shot, PbpEvent):
        model.query.filter_by(game_id=game_id).delete(synchronize_session=False)

    team_cols = ("team_code", "team_name", "is_home", "pts", "fgm", "fga", "fgm2", "fga2",
                 "fgm3", "fga3", "ftm", "fta", "orb", "drb", "trb", "ast", "tov", "stl", "blk", "pf",
                 "opp_pts", "opp_fga2", "opp_fga3", "opp_fta", "opp_orb", "opp_drb", "opp_tov", "opp_pf",
                 "paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts")
    player_cols = ("team_code", "team_name", "player_name", "jersey", "minutes", "position",
                   "plus_minus", "starter", "pts", "fgm", "fga", "fgm2", "fga2", "fgm3", "fga3",
                   "ftm", "fta", "orb", "drb", "trb", "ast", "tov", "stl", "blk", "pf")
    shot_cols = ("team_code", "player_name", "x", "y", "court_x", "court_y", "made",
                 "action_type", "sub_type", "period", "action_number")
    pbp_cols = ("team_code", "player_name", "period", "period_type", "clock_secs", "s1", "s2",
                "action_type", "sub_type", "success", "action_number")

    # Filas repetidas por clave única dentro de un mismo partido (dos jugadores con el mismo
    # nombre abreviado, eventos sin actionNumber): se conserva una, como hacía la ingesta
    # anterior con su upsert, en lugar de abortar la importación. Jugadores: gana la última
    # ficha; tiros y eventos: el primero.
    players = list({(r.get("team_code"), r.get("player_name")): r for r in game.get("players", [])}.values())
    shots = list({r.get("action_number"): r for r in reversed(game.get("shots", []))}.values())[::-1]
    pbp = list({r.get("action_number"): r for r in reversed(game.get("pbp", []))}.values())[::-1]

    # executemany: un statement por tabla (~500 eventos por partido)
    for model, rows, cols in ((TeamGameStats, game.get("teams", []), team_cols),
                              (PlayerGameStats, players, player_cols),
                              (Shot, shots, shot_cols),
                              (PbpEvent, pbp, pbp_cols)):
        if rows:
            db.session.execute(sqlite_insert(model),
                               [{"game_id": game_id, **{c: r.get(c) for c in cols}} for r in rows])


def reprocess_games(game_ids: list[str]) -> dict:
    """Re-ejecuta la ingesta vigente sobre partidos ya importados.

    Fuente: el JSON archivado; si el partido no lo tiene, se descarga de FIBA por su id (con
    la fecha y competencia ya guardadas) y se archiva. Un partido que falla no corta el lote.
    """
    processed, failed = [], []
    for gid in game_ids:
        game_row = Game.query.filter_by(game_id=gid).first()
        if not game_row:
            failed.append({"game_id": gid, "error": "Partido no encontrado."})
            continue
        try:
            archived = load_archived(gid)
            if archived:
                raw, page_info = archived
            else:
                raw = fiba_fetcher.fetch_raw_by_id(gid)
                page_info = {"date": game_row.date or "", "competition": game_row.competition or ""}
            game = fiba_fetcher.parse_game(raw, gid, page_info)
            persist_game(game)
            if not archived:
                archive_raw(gid, raw, page_info)
            db.session.commit()
            processed.append(gid)
        except Exception as e:   # FIBA caído, JSON inválido, etc.: se informa y se sigue
            db.session.rollback()
            failed.append({"game_id": gid, "error": str(e) or e.__class__.__name__})
    return {"processed": processed, "failed": failed}
