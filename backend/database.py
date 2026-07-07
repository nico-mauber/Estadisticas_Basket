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
    minutes     = db.Column(db.Integer, default=40)
    imported_at = db.Column(db.String,  default=lambda: datetime.utcnow().isoformat())

    team_stats   = db.relationship("TeamGameStats",   backref="game", cascade="all, delete-orphan")
    player_stats = db.relationship("PlayerGameStats", backref="game", cascade="all, delete-orphan")
    shots        = db.relationship("Shot",            backref="game", cascade="all, delete-orphan")
    pbp_events   = db.relationship("PbpEvent",        backref="game", cascade="all, delete-orphan")


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
    period_type   = db.Column(db.String)                # REGULAR / OT
    clock_secs    = db.Column(db.Integer)               # segundos restantes en el período
    s1            = db.Column(db.Integer, default=0)     # marcador local corrido
    s2            = db.Column(db.Integer, default=0)     # marcador visitante corrido
    action_type   = db.Column(db.String)
    sub_type      = db.Column(db.String)
    success       = db.Column(db.Integer, default=0)
    action_number = db.Column(db.Integer)


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
    ]
    with app.app_context():
        conn = db.engine.raw_connection()
        cur = conn.cursor()
        for table, col, typedef in new_cols:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}")
            except Exception:
                pass  # column already exists
        conn.commit()
        conn.close()


if __name__ == "__main__":
    from flask import Flask
    _app = Flask(__name__)
    _app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
    init_db(_app)
