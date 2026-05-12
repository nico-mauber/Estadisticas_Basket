import sqlite3
import os

_default_db = os.path.join(os.path.dirname(__file__), "basketball.db")
DB_PATH = os.environ.get("DB_PATH", _default_db)

# Ensure parent dir exists; fall back to app dir if mount point not available
_db_dir = os.path.dirname(os.path.abspath(DB_PATH))
if not os.path.exists(_db_dir):
    try:
        os.makedirs(_db_dir, exist_ok=True)
    except (PermissionError, OSError):
        DB_PATH = _default_db


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS games (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id     TEXT UNIQUE NOT NULL,
                competition TEXT,
                date        TEXT,
                home_team   TEXT,
                home_code   TEXT,
                away_team   TEXT,
                away_code   TEXT,
                home_score  INTEGER,
                away_score  INTEGER,
                minutes     INTEGER DEFAULT 40,
                imported_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS team_game_stats (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id     TEXT NOT NULL REFERENCES games(game_id),
                team_code   TEXT NOT NULL,
                team_name   TEXT NOT NULL,
                is_home     INTEGER NOT NULL,
                pts         INTEGER DEFAULT 0,
                fgm         INTEGER DEFAULT 0,
                fga         INTEGER DEFAULT 0,
                fgm2        INTEGER DEFAULT 0,
                fga2        INTEGER DEFAULT 0,
                fgm3        INTEGER DEFAULT 0,
                fga3        INTEGER DEFAULT 0,
                ftm         INTEGER DEFAULT 0,
                fta         INTEGER DEFAULT 0,
                orb         INTEGER DEFAULT 0,
                drb         INTEGER DEFAULT 0,
                trb         INTEGER DEFAULT 0,
                ast         INTEGER DEFAULT 0,
                tov         INTEGER DEFAULT 0,
                stl         INTEGER DEFAULT 0,
                blk         INTEGER DEFAULT 0,
                pf          INTEGER DEFAULT 0,
                opp_pts     INTEGER DEFAULT 0,
                opp_fga2    INTEGER DEFAULT 0,
                opp_fga3    INTEGER DEFAULT 0,
                opp_fta     INTEGER DEFAULT 0,
                opp_orb     INTEGER DEFAULT 0,
                opp_drb     INTEGER DEFAULT 0,
                opp_tov     INTEGER DEFAULT 0,
                UNIQUE(game_id, team_code)
            );

            CREATE TABLE IF NOT EXISTS player_game_stats (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id     TEXT NOT NULL REFERENCES games(game_id),
                team_code   TEXT NOT NULL,
                team_name   TEXT NOT NULL,
                player_name TEXT NOT NULL,
                jersey      TEXT,
                minutes     TEXT,
                pts         INTEGER DEFAULT 0,
                fgm         INTEGER DEFAULT 0,
                fga         INTEGER DEFAULT 0,
                fgm2        INTEGER DEFAULT 0,
                fga2        INTEGER DEFAULT 0,
                fgm3        INTEGER DEFAULT 0,
                fga3        INTEGER DEFAULT 0,
                ftm         INTEGER DEFAULT 0,
                fta         INTEGER DEFAULT 0,
                orb         INTEGER DEFAULT 0,
                drb         INTEGER DEFAULT 0,
                trb         INTEGER DEFAULT 0,
                ast         INTEGER DEFAULT 0,
                tov         INTEGER DEFAULT 0,
                stl         INTEGER DEFAULT 0,
                blk         INTEGER DEFAULT 0,
                pf          INTEGER DEFAULT 0,
                UNIQUE(game_id, team_code, player_name)
            );

            CREATE TABLE IF NOT EXISTS shots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id     TEXT NOT NULL REFERENCES games(game_id),
                team_code   TEXT NOT NULL,
                player_name TEXT,
                x           REAL,
                y           REAL,
                made        INTEGER DEFAULT 0,
                action_type TEXT,
                sub_type    TEXT,
                period      INTEGER,
                action_number INTEGER,
                UNIQUE(game_id, action_number)
            );
        """)
    print("DB initialized.")


if __name__ == "__main__":
    init_db()
