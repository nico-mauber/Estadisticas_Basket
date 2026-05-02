# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
cd backend
pip install -r requirements.txt
python app.py
# Serves at http://localhost:5000 (Flask dev server)
```

Initialize/reset database schema:
```bash
python backend/database.py
```

No build step for frontend — vanilla JS, no bundler. No test suite exists.

## Architecture

Full-stack Python/JS monolith:

- **`backend/fiba_fetcher.py`** — Scrapes FIBA LiveStats URLs. Tries direct HTTP first, falls back to Playwright (headless Chromium) if page requires JS. Entry point: `fetch_game_data(url)`.
- **`backend/stats_engine.py`** — Computes 20+ advanced basketball metrics (OER, DER, TS%, eFG%, pace, possessions, etc.) based on Dean Oliver's "Basketball on Paper" formulas. `calc_team_stats(team, opponent)` and `calc_player_stats(player, team_pos)` are the main functions.
- **`backend/database.py`** — SQLite schema: `games`, `team_game_stats`, `player_game_stats`. Foreign keys and unique constraints enforced.
- **`backend/app.py`** — Flask REST API. All routes under `/api/`. Also serves `frontend/index.html` at `/`.
- **`frontend/js/app.js`** — Single-page app with 4 views: Import, League, Team, Player. Fetches from API, renders stat tables with color-coding relative to league averages.
- **`frontend/sw.js`** — Service worker: caches static assets, always network-fetches `/api/` routes.

## Data Flow

```
User imports FIBA URL → POST /api/import
  → fiba_fetcher.py parses JSON
  → database.py stores raw stats
  → stats_engine.py derives advanced metrics on read
  → app.py returns JSON to frontend
```

## Key API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/import` | Import game from FIBA LiveStats URL |
| `GET /api/games` | All imported games |
| `GET /api/teams` | Unique teams with game counts |
| `GET /api/team/<team_code>` | Team stats + game log |
| `GET /api/players/<team_code>` | Player roster for team |
| `GET /api/player/<team_code>/<player_name>` | Player stats + game log |
| `GET /api/league` | League-wide rankings |

## Tech Stack

- Python 3.11 / Flask 3.0 / flask-cors / Playwright 1.44
- SQLite (file: `backend/basketball.db`)
- Vanilla JS ES6, CSS3 custom properties (dark mode), PWA

## Notes

- UI labels and error messages are in Spanish.
- Advanced stats are computed on-the-fly at query time, not stored.
- `games.minutes` defaults to 40 (regulation); used in pace calculations.
