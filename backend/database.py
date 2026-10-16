import os
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

_default_db = os.path.join(os.path.dirname(__file__), "basketball.db")
DB_PATH = os.environ.get("DB_PATH", _default_db)

_db_dir = os.path.dirname(os.path.abspath(DB_PATH))
if not os.path.exists(_db_dir):
    try:
        os.makedirs(_db_dir, exist_ok=True)
    except (PermissionError, OSError):
        DB_PATH = _default_db


class Competition(db.Model):
    """Una competencia EN una temporada: universo de cálculo de percentiles y promedios (F-11).

    `status`: `publicada` (visible en toda la app) o `borrador` (sus partidos solo se ven en
    la sección Datos). (name, season) es único; se valida en competitions.py porque SQLite
    trata dos NULL como distintos en un UNIQUE.
    """
    __tablename__ = "competitions"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name       = db.Column(db.String,  nullable=False)
    season     = db.Column(db.String)
    status     = db.Column(db.String,  nullable=False, default="publicada")
    created_at = db.Column(db.String,  default=lambda: datetime.utcnow().isoformat())


class CompetitionAlias(db.Model):
    """Texto de competencia tal como lo publica FIBA → competencia (F-11)."""
    __tablename__ = "competition_aliases"

    source_name    = db.Column(db.String,  primary_key=True)
    competition_id = db.Column(db.Integer, db.ForeignKey("competitions.id"), nullable=False)


class Player(db.Model):
    """Ficha persistente de un jugador EN un equipo (C-08).

    Clave de identidad: (team_code, norm_key) donde `norm_key` es el nombre normalizado
    (minúsculas, sin tildes, sin espacios dobles). La competencia NO es parte de la clave: es
    un filtro. `merged_into` apunta a la ficha que absorbió a esta (fusión manual); las
    consultas siempre resuelven a la ficha canónica (`merged_into IS NULL`).
    """
    __tablename__  = "players"
    __table_args__ = (db.UniqueConstraint("team_code", "norm_key"),)

    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    team_code    = db.Column(db.String,  nullable=False)
    norm_key     = db.Column(db.String,  nullable=False)
    display_name = db.Column(db.String,  nullable=False)   # grafía real más reciente
    first_name   = db.Column(db.String)
    family_name  = db.Column(db.String)
    photo_url    = db.Column(db.String)
    merged_into  = db.Column(db.Integer, db.ForeignKey("players.id"))
    created_at   = db.Column(db.String,  default=lambda: datetime.utcnow().isoformat())


class Game(db.Model):
    __tablename__ = "games"

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    game_id     = db.Column(db.String,  unique=True, nullable=False)
    competition = db.Column(db.String)
    date        = db.Column(db.String)
    home_team   = db.Column(db.String)
    home_code   = db.Column(db.String)
    away_team   = db.Column(db.String)
    away_code   = db.Column(db.String)
    home_score  = db.Column(db.Integer)
    away_score  = db.Column(db.Integer)
    minutes     = db.Column(db.Integer, default=40)           # 40 + 5 × prórrogas (ingesta ≥ 2)
    imported_at = db.Column(db.String,  default=lambda: datetime.utcnow().isoformat())
    competition_id = db.Column(db.Integer)                      # F-11; `competition` queda como texto crudo
    ingest_version = db.Column(db.Integer)                      # NULL = ingesta previa a F-11 (ver ingest.py)

    team_stats   = db.relationship("TeamGameStats",   backref="game", cascade="all, delete-orphan")
    player_stats = db.relationship("PlayerGameStats", backref="game", cascade="all, delete-orphan")
    shots        = db.relationship("Shot",            backref="game", cascade="all, delete-orphan")
    pbp_events   = db.relationship("PbpEvent",        backref="game", cascade="all, delete-orphan")
    source       = db.relationship("GameSource",      backref="game", cascade="all, delete-orphan",
                                   uselist=False)


class TeamGameStats(db.Model):
    __tablename__  = "team_game_stats"
    __table_args__ = (db.UniqueConstraint("game_id", "team_code"),)

    id        = db.Column(db.Integer, primary_key=True, autoincrement=True)
    game_id   = db.Column(db.String,  db.ForeignKey("games.game_id"), nullable=False)
    team_code = db.Column(db.String,  nullable=False)
    team_name = db.Column(db.String,  nullable=False)
    is_home   = db.Column(db.Integer, nullable=False)

    pts  = db.Column(db.Integer, default=0)
    fgm  = db.Column(db.Integer, default=0)
    fga  = db.Column(db.Integer, default=0)
    fgm2 = db.Column(db.Integer, default=0)
    fga2 = db.Column(db.Integer, default=0)
    fgm3 = db.Column(db.Integer, default=0)
    fga3 = db.Column(db.Integer, default=0)
    ftm  = db.Column(db.Integer, default=0)
    fta  = db.Column(db.Integer, default=0)
    orb  = db.Column(db.Integer, default=0)
    drb  = db.Column(db.Integer, default=0)
    trb  = db.Column(db.Integer, default=0)
    ast  = db.Column(db.Integer, default=0)
    tov  = db.Column(db.Integer, default=0)
    stl  = db.Column(db.Integer, default=0)
    blk  = db.Column(db.Integer, default=0)
    pf   = db.Column(db.Integer, default=0)

    opp_pts  = db.Column(db.Integer, default=0)
    opp_fga2 = db.Column(db.Integer, default=0)
    opp_fga3 = db.Column(db.Integer, default=0)
    opp_fta  = db.Column(db.Integer, default=0)
    opp_orb  = db.Column(db.Integer, default=0)
    opp_drb  = db.Column(db.Integer, default=0)
    opp_tov  = db.Column(db.Integer, default=0)
    opp_pf   = db.Column(db.Integer, default=0)

    paint_pts         = db.Column(db.Integer, default=0)
    second_chance_pts = db.Column(db.Integer, default=0)
    pts_from_tov      = db.Column(db.Integer, default=0)
    bench_pts         = db.Column(db.Integer, default=0)
    fast_break_pts    = db.Column(db.Integer, default=0)
    # T-05: tapones y faltas recibidas. NULL = "no importado todavía" (regla de columnas
    # nuevas, C-11); un 0 informado por FIBA se guarda como 0.
    blk_received      = db.Column(db.Integer)
    fouls_drawn       = db.Column(db.Integer)


class PlayerGameStats(db.Model):
    __tablename__  = "player_game_stats"
    __table_args__ = (db.UniqueConstraint("game_id", "team_code", "player_name"),)

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    game_id     = db.Column(db.String,  db.ForeignKey("games.game_id"), nullable=False)
    team_code   = db.Column(db.String,  nullable=False)
    team_name   = db.Column(db.String,  nullable=False)
    player_name = db.Column(db.String,  nullable=False)
    jersey      = db.Column(db.String)
    minutes     = db.Column(db.String)
    position    = db.Column(db.String,  default="")   # playingPosition FIBA (G/F/C...)
    plus_minus  = db.Column(db.Integer, default=0)    # sPlusMinusPoints FIBA (por partido)
    starter     = db.Column(db.Integer, default=0)    # 1=titular (FIBA `starter`)
    # C-08: ficha del jugador y datos de identidad de FIBA. NULL = "no importado todavía"
    # (los partidos viejos los reciben al reprocesar; `player_id` lo completa identity.py).
    player_id   = db.Column(db.Integer)
    first_name  = db.Column(db.String)
    family_name = db.Column(db.String)
    photo_url   = db.Column(db.String)

    pts  = db.Column(db.Integer, default=0)
    fgm  = db.Column(db.Integer, default=0)
    fga  = db.Column(db.Integer, default=0)
    fgm2 = db.Column(db.Integer, default=0)
    fga2 = db.Column(db.Integer, default=0)
    fgm3 = db.Column(db.Integer, default=0)
    fga3 = db.Column(db.Integer, default=0)
    ftm  = db.Column(db.Integer, default=0)
    fta  = db.Column(db.Integer, default=0)
    orb  = db.Column(db.Integer, default=0)
    drb  = db.Column(db.Integer, default=0)
    trb  = db.Column(db.Integer, default=0)
    ast  = db.Column(db.Integer, default=0)
    tov  = db.Column(db.Integer, default=0)
    stl  = db.Column(db.Integer, default=0)
    blk  = db.Column(db.Integer, default=0)
    pf   = db.Column(db.Integer, default=0)
    # T-05: tapones y faltas recibidas. NULL = "no importado todavía" (regla de columnas
    # nuevas, C-11); un 0 informado por FIBA se guarda como 0.
    blk_received = db.Column(db.Integer)
    fouls_drawn  = db.Column(db.Integer)


class Shot(db.Model):
    __tablename__  = "shots"
    __table_args__ = (db.UniqueConstraint("game_id", "action_number"),)

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    game_id       = db.Column(db.String,  db.ForeignKey("games.game_id"), nullable=False)
    team_code     = db.Column(db.String,  nullable=False)
    player_name   = db.Column(db.String)
    x             = db.Column(db.Float)
    y             = db.Column(db.Float)
    made          = db.Column(db.Integer, default=0)
    action_type   = db.Column(db.String)
    sub_type      = db.Column(db.String)
    period        = db.Column(db.Integer)
    action_number = db.Column(db.Integer)
    # Coordenadas reales de FIBA (`tm[n].shot[]`): 0–100 a lo largo (x) y a lo ancho (y) de la
    # cancha COMPLETA. NULL si el partido no las trae. `x`/`y` (legado) siguen en 0 hasta C-03.
    court_x       = db.Column(db.Float)
    court_y       = db.Column(db.Float)


class PbpEvent(db.Model):
    """Play-by-play: un registro por evento de FIBA (subs, tiros, rebotes, faltas...).

    Base de lineups (Feature 03), on/off (Feature 04) y clutch (Feature 05).
    `clock_secs` = segundos restantes en el período (de `gt`). Se guardan todos
    los eventos; el análisis filtra por `action_type`.
    """
    __tablename__  = "pbp_events"
    __table_args__ = (db.UniqueConstraint("game_id", "action_number"),)

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    game_id       = db.Column(db.String,  db.ForeignKey("games.game_id"), nullable=False)
    team_code     = db.Column(db.String,  default="")   # "" en eventos no-equipo (game/period)
    player_name   = db.Column(db.String,  default="")   # "" en eventos no-jugador
    period        = db.Column(db.Integer)
    period_type   = db.Column(db.String)                # REGULAR / OVERTIME
    clock_secs    = db.Column(db.Integer)               # segundos restantes en el período
    s1            = db.Column(db.Integer, default=0)     # marcador local corrido
    s2            = db.Column(db.Integer, default=0)     # marcador visitante corrido
    action_type   = db.Column(db.String)
    sub_type      = db.Column(db.String)
    success       = db.Column(db.Integer, default=0)
    action_number = db.Column(db.Integer)


class AppConfig(db.Model):
    """Configuración global de la app (F-13). Solo guarda overrides del default."""
    __tablename__ = "app_config"

    key        = db.Column(db.String, primary_key=True)
    value      = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.String, nullable=False)
    updated_by = db.Column(db.String)


class AppMeta(db.Model):
    """Metadatos de la app persistidos (T-01, Arq. §3.14/§5): versiones de datos y de
    configuración que prefijan las claves de `cache.memo`. Una fila por clave
    (`data_version`, `config_version`); `create_all` la crea idempotentemente y
    `cache.get_versions` siembra las filas faltantes con `1`."""
    __tablename__ = "app_meta"

    key   = db.Column(db.String, primary_key=True)
    value = db.Column(db.Text, nullable=False)


class UserPref(db.Model):
    """Preferencias personales por usuario de sesión (F-13)."""
    __tablename__  = "user_prefs"
    __table_args__ = (db.PrimaryKeyConstraint("owner", "scope", "key"),)

    owner      = db.Column(db.String, nullable=False)
    scope      = db.Column(db.String, nullable=False)
    key        = db.Column(db.String, nullable=False)
    value      = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.String, nullable=False)


class GameSource(db.Model):
    """JSON crudo de FIBA archivado (gzip) para reprocesar sin volver a descargarlo (F-11, DA-12)."""
    __tablename__ = "game_sources"

    game_id    = db.Column(db.String, db.ForeignKey("games.game_id"), primary_key=True)
    source_url = db.Column(db.String)
    fetched_at = db.Column(db.String)
    raw_gz     = db.Column(db.LargeBinary)
    page_info  = db.Column(db.Text)      # JSON {date, competition} scrapeado de bs.html


def init_db(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
    print("DB initialized.")


def upgrade_db(app):
    """Add new columns to existing tables (idempotent)."""
    new_cols = [
        ("team_game_stats", "opp_pf",            "INTEGER DEFAULT 0"),
        ("team_game_stats", "paint_pts",          "INTEGER DEFAULT 0"),
        ("team_game_stats", "second_chance_pts",  "INTEGER DEFAULT 0"),
        ("team_game_stats", "pts_from_tov",       "INTEGER DEFAULT 0"),
        ("team_game_stats", "bench_pts",          "INTEGER DEFAULT 0"),
        ("team_game_stats", "fast_break_pts",     "INTEGER DEFAULT 0"),
        ("player_game_stats", "position",          "TEXT DEFAULT ''"),
        ("player_game_stats", "plus_minus",        "INTEGER DEFAULT 0"),
        ("player_game_stats", "starter",           "INTEGER DEFAULT 0"),
        # F-11 — sin DEFAULT: NULL = "no importado todavía" (regla de columnas nuevas, C-11)
        ("games", "competition_id", "INTEGER"),
        ("games", "ingest_version", "INTEGER"),
        ("shots", "court_x",        "REAL"),
        ("shots", "court_y",        "REAL"),
        # C-08 — identidad de jugador (sin DEFAULT: NULL = "no importado todavía")
        ("player_game_stats", "player_id",   "INTEGER"),
        ("player_game_stats", "first_name",  "TEXT"),
        ("player_game_stats", "family_name", "TEXT"),
        ("player_game_stats", "photo_url",   "TEXT"),
        # T-05 — tapones y faltas recibidas (sin DEFAULT: NULL = "no importado todavía")
        ("team_game_stats",   "blk_received", "INTEGER"),
        ("team_game_stats",   "fouls_drawn",  "INTEGER"),
        ("player_game_stats", "blk_received", "INTEGER"),
        ("player_game_stats", "fouls_drawn",  "INTEGER"),
    ]
    with app.app_context():
        conn = db.engine.raw_connection()
        cur = conn.cursor()
        for table, col, typedef in new_cols:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}")
            except Exception:
                pass  # column already exists
        # C-08: el completado y todas las consultas de ficha filtran por player_id
        cur.execute("CREATE INDEX IF NOT EXISTS ix_pgs_player_id ON player_game_stats(player_id)")
        conn.commit()
        conn.close()


if __name__ == "__main__":
    from flask import Flask
    _app = Flask(__name__)
    _app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
    init_db(_app)
