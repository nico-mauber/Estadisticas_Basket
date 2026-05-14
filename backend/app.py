from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from database import get_conn, init_db
from stats_engine import calc_team_stats, calc_player_stats, league_averages
from fiba_fetcher import fetch_game_data

app = Flask(__name__, static_folder="../frontend", static_url_path="/")
CORS(app)

init_db()


# ── Helpers ────────────────────────────────────────────────────────────────

def _row(row) -> dict:
    return {k: row[k] for k in row.keys()}


def _opp_for(conn, game_id: str, team_code: str) -> dict | None:
    cur = conn.execute(
        "SELECT * FROM team_game_stats WHERE game_id=? AND team_code!=?",
        (game_id, team_code)
    )
    row = cur.fetchone()
    return _row(row) if row else None


def _classify_zone(action_type: str, sub_type: str, y: float = 0) -> str:
    if action_type == "3pt":
        return "triple"
    sub = (sub_type or "").lower()
    if any(k in sub for k in ["layup", "dunk", "alley", "tip", "hook", "putback", "driving"]):
        return "paint"
    return "mid_range"


def _opp_dict(opp_row: dict) -> dict:
    return {
        "pts":  opp_row["pts"],
        "fgm2": opp_row["fgm2"], "fga2": opp_row["fga2"],
        "fgm3": opp_row["fgm3"], "fga3": opp_row["fga3"],
        "ftm":  opp_row["ftm"],  "fta":  opp_row["fta"],
        "orb":  opp_row["orb"],  "drb":  opp_row["drb"],
        "tov":  opp_row["tov"],
    }


# ── Import ─────────────────────────────────────────────────────────────────

@app.route("/api/import", methods=["POST"])
def import_game():
    body = request.get_json(force=True)
    url  = (body or {}).get("url", "").strip()
    if not url:
        return jsonify({"error": "Se requiere campo 'url'"}), 400

    try:
        game = fetch_game_data(url)
    except Exception as e:
        return jsonify({"error": str(e)}), 502

    game_id = game["game_id"]

    with get_conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO games
               (game_id, competition, date,
                home_team, home_code, away_team, away_code,
                home_score, away_score)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (game_id, game.get("competition"), game.get("date"),
             game.get("home_team"), game.get("home_code"),
             game.get("away_team"), game.get("away_code"),
             game.get("home_score"), game.get("away_score"))
        )

        for t in game.get("teams", []):
            conn.execute(
                """INSERT OR REPLACE INTO team_game_stats
                   (game_id, team_code, team_name, is_home,
                    pts, fgm, fga, fgm2, fga2, fgm3, fga3, ftm, fta,
                    orb, drb, trb, ast, tov, stl, blk, pf,
                    opp_pts, opp_fga2, opp_fga3, opp_fta, opp_orb, opp_drb, opp_tov)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (game_id, t["team_code"], t["team_name"], t["is_home"],
                 t["pts"], t["fgm"], t["fga"],
                 t["fgm2"], t["fga2"], t["fgm3"], t["fga3"],
                 t["ftm"], t["fta"],
                 t["orb"], t["drb"], t["trb"],
                 t["ast"], t["tov"], t["stl"], t["blk"], t["pf"],
                 t.get("opp_pts", 0), t.get("opp_fga2", 0), t.get("opp_fga3", 0),
                 t.get("opp_fta", 0), t.get("opp_orb", 0),
                 t.get("opp_drb", 0), t.get("opp_tov", 0))
            )

        for p in game.get("players", []):
            conn.execute(
                """INSERT OR REPLACE INTO player_game_stats
                   (game_id, team_code, team_name, player_name, jersey, minutes,
                    pts, fgm, fga, fgm2, fga2, fgm3, fga3, ftm, fta,
                    orb, drb, trb, ast, tov, stl, blk, pf)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (game_id, p["team_code"], p["team_name"],
                 p["player_name"], p.get("jersey"), p.get("minutes"),
                 p["pts"], p["fgm"], p["fga"],
                 p["fgm2"], p["fga2"], p["fgm3"], p["fga3"],
                 p["ftm"], p["fta"],
                 p["orb"], p["drb"], p["trb"],
                 p["ast"], p["tov"], p["stl"], p["blk"], p["pf"])
            )

        for s in game.get("shots", []):
            conn.execute(
                """INSERT OR IGNORE INTO shots
                   (game_id, team_code, player_name, x, y, made,
                    action_type, sub_type, period, action_number)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (game_id, s["team_code"], s["player_name"],
                 s["x"], s["y"], s["made"],
                 s["action_type"], s["sub_type"],
                 s["period"], s["action_number"])
            )

    # Return what teams were found so the UI can show them
    teams_imported = [
        {"code": t["team_code"], "name": t["team_name"]}
        for t in game.get("teams", [])
    ]
    return jsonify({"ok": True, "game_id": game_id, "teams": teams_imported})


# ── Games ──────────────────────────────────────────────────────────────────

@app.route("/api/games")
def list_games():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM games ORDER BY date DESC, imported_at DESC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


# ── Teams ─────────────────────────────────────────────────────────────────
# Identified by team_code. team_name = most recent name used by FIBA.

@app.route("/api/teams")
def list_teams():
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT team_code, team_name, COUNT(*) as games
            FROM team_game_stats
            GROUP BY team_code
            ORDER BY team_name
        """).fetchall()
    return jsonify([{"code": r["team_code"], "name": r["team_name"], "games": r["games"]} for r in rows])


@app.route("/api/team/<team_code>")
def team_stats(team_code: str):
    team_code = team_code.upper()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM team_game_stats WHERE team_code=?", (team_code,)
        ).fetchall()
        if not rows:
            return jsonify({"error": "Equipo no encontrado"}), 404

        team_name = rows[-1]["team_name"]  # most recent name

        game_stats = []
        for row in rows:
            t   = _row(row)
            opp_row = _opp_for(conn, row["game_id"], team_code)
            if not opp_row:
                continue
            adv = calc_team_stats(t, _opp_dict(opp_row))
            game_info = conn.execute(
                "SELECT date, home_team, away_team, home_score, away_score FROM games WHERE game_id=?",
                (row["game_id"],)
            ).fetchone()
            game_stats.append({
                "game_id":   row["game_id"],
                "date":      game_info["date"] if game_info else "",
                "opponent":      opp_row["team_name"],
                "opponent_code": opp_row["team_code"],
                "home_away": "L" if row["is_home"] else "V",
                **adv
            })

        # League context
        all_rows = conn.execute("SELECT * FROM team_game_stats").fetchall()
        all_adv  = []
        for ar in all_rows:
            ao = _opp_for(conn, ar["game_id"], ar["team_code"])
            if not ao:
                continue
            all_adv.append(calc_team_stats(_row(ar), _opp_dict(ao)))

        league = league_averages(all_adv)

    def _avg(key):
        vals = [g[key] for g in game_stats if key in g]
        return round(sum(vals) / len(vals), 4) if vals else 0

    keys = [
        "oer", "der", "net_rating", "efg_pct", "ts_pct",
        "fg2_pct", "fg3_pct", "ft_pct", "ft_rate", "ft_rate_report",
        "pps", "fg2_uso", "fg3_uso",
        "or_pct", "dr_pct", "trb_pct", "to_pct", "to_ratio",
        "as_pct", "ast_ratio", "pace", "pts", "possessions", "plays",
        "peso_1p", "peso_2p", "peso_3p",
        "opp_efg_pct", "opp_ts_pct", "opp_to_pct", "opp_ft_rate",
        "stocks", "def_playmaking", "def_to_ratio",
        "fgm", "fga", "fgm2", "fga2", "fgm3", "fga3",
        "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk",
    ]
    averages = {k: _avg(k) for k in keys}

    # Record (wins / losses)
    wins  = sum(1 for g in game_stats if g.get("pts", 0) > g.get("opp_pts", 0))
    losses = len(game_stats) - wins
    home_gs   = [g for g in game_stats if g["home_away"] == "L"]
    away_gs   = [g for g in game_stats if g["home_away"] == "V"]
    home_wins = sum(1 for g in home_gs if g.get("pts", 0) > g.get("opp_pts", 0))
    away_wins = sum(1 for g in away_gs if g.get("pts", 0) > g.get("opp_pts", 0))

    record = {
        "wins": wins, "losses": losses,
        "win_pct": round(wins / len(game_stats), 3) if game_stats else 0,
        "home": f"{home_wins}-{len(home_gs)-home_wins}",
        "away": f"{away_wins}-{len(away_gs)-away_wins}",
    }

    return jsonify({
        "team_code": team_code,
        "team_name": team_name,
        "games":     len(game_stats),
        "record":    record,
        "averages":  averages,
        "league":    league,
        "game_log":  game_stats,
    })


# ── Players ────────────────────────────────────────────────────────────────

@app.route("/api/players/<team_code>")
def team_players(team_code: str):
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT DISTINCT player_name FROM player_game_stats
               WHERE team_code=? ORDER BY player_name""",
            (team_code.upper(),)
        ).fetchall()
    return jsonify([r["player_name"] for r in rows])


@app.route("/api/player/<team_code>/<player_name>")
def player_stats(team_code: str, player_name: str):
    team_code = team_code.upper()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM player_game_stats WHERE team_code=? AND player_name=?",
            (team_code, player_name)
        ).fetchall()
        if not rows:
            return jsonify({"error": "Jugador no encontrado"}), 404

        game_log = []
        for row in rows:
            p = _row(row)
            p.setdefault("trb", p["orb"] + p["drb"])
            adv = calc_player_stats(p, team_pos=0)
            game_info = conn.execute(
                "SELECT date FROM games WHERE game_id=?", (row["game_id"],)
            ).fetchone()
            opp_row = _opp_for(conn, row["game_id"], team_code)

            # Player share of team rebounds in this game
            team_row = conn.execute(
                "SELECT orb, drb, trb FROM team_game_stats WHERE game_id=? AND team_code=?",
                (row["game_id"], team_code)
            ).fetchone()
            if team_row:
                t_orb = team_row["orb"] or 0
                t_drb = team_row["drb"] or 0
                t_trb = team_row["trb"] or (t_orb + t_drb)
                adv["reb_share"]  = round(adv["trb"] / t_trb, 4) if t_trb else 0
                adv["oreb_share"] = round(adv["orb"] / t_orb, 4) if t_orb else 0
                adv["dreb_share"] = round(adv["drb"] / t_drb, 4) if t_drb else 0
            else:
                adv["reb_share"] = adv["oreb_share"] = adv["dreb_share"] = 0

            game_log.append({
                "game_id":      row["game_id"],
                "date":         game_info["date"] if game_info else "",
                "opponent":     opp_row["team_name"] if opp_row else "",
                "opponent_code": opp_row["team_code"] if opp_row else "",
                **adv
            })

        all_players = conn.execute("SELECT * FROM player_game_stats").fetchall()
        all_adv = []
        for ap in all_players:
            pp = _row(ap)
            pp.setdefault("trb", pp["orb"] + pp["drb"])
            all_adv.append(calc_player_stats(pp, team_pos=0))

        league = league_averages(all_adv)

    def _avg(key):
        vals = [g[key] for g in game_log if key in g]
        return round(sum(vals) / len(vals), 4) if vals else 0

    keys = [
        "oer", "efg_pct", "ts_pct", "fg2_pct", "fg3_pct",
        "ft_pct", "ft_rate", "ft_rate_report", "pps", "ppp",
        "fg2_uso", "fg3_uso", "peso_1p", "peso_2p", "peso_3p",
        "or_pct", "dr_pct", "to_pct", "to_ratio", "as_pct", "ast_ratio", "ast_to",
        "stocks", "def_playmaking", "def_to_ratio", "physical_impact",
        "reb_share", "oreb_share", "dreb_share",
        "pts", "fgm", "fga", "fgm2", "fga2", "fgm3", "fga3",
        "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk",
    ]
    averages = {k: _avg(k) for k in keys}

    return jsonify({
        "player":    player_name,
        "team_code": team_code,
        "team_name": rows[0]["team_name"],
        "games":     len(game_log),
        "averages":  averages,
        "league":    league,
        "game_log":  game_log,
    })


# ── Player shots ───────────────────────────────────────────────────────────

@app.route("/api/shots/<team_code>/<player_name>")
def player_shots(team_code: str, player_name: str):
    team_code = team_code.upper()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT action_type, sub_type, y, made FROM shots WHERE team_code=? AND player_name=?",
            (team_code, player_name)
        ).fetchall()

    zones = {
        "paint":     {"made": 0, "attempts": 0},
        "mid_range": {"made": 0, "attempts": 0},
        "triple":    {"made": 0, "attempts": 0},
    }
    for row in rows:
        z = _classify_zone(row["action_type"], row["sub_type"], row["y"])
        if z in zones:
            zones[z]["attempts"] += 1
            zones[z]["made"]     += row["made"]

    for z in zones.values():
        z["pct"] = round(z["made"] / z["attempts"], 4) if z["attempts"] else None

    # League-wide zone averages (all players, all games)
    lg_zones = {
        "paint":     {"made": 0, "attempts": 0},
        "mid_range": {"made": 0, "attempts": 0},
        "triple":    {"made": 0, "attempts": 0},
    }
    with get_conn() as conn:
        all_shots = conn.execute(
            "SELECT action_type, sub_type, made FROM shots"
        ).fetchall()
    for row in all_shots:
        z = _classify_zone(row["action_type"], row["sub_type"])
        if z in lg_zones:
            lg_zones[z]["attempts"] += 1
            lg_zones[z]["made"]     += row["made"]
    for z in lg_zones.values():
        z["pct"] = round(z["made"] / z["attempts"], 4) if z["attempts"] else None

    return jsonify({
        "zones":        zones,
        "league_zones": lg_zones,
        "total_shots":  sum(z["attempts"] for z in zones.values()),
    })


# ── League ─────────────────────────────────────────────────────────────────

@app.route("/api/league")
def league_overview():
    with get_conn() as conn:
        codes = conn.execute(
            "SELECT DISTINCT team_code FROM team_game_stats"
        ).fetchall()
        all_rows = conn.execute("SELECT * FROM team_game_stats").fetchall()

        result = []
        for c_row in codes:
            code  = c_row["team_code"]
            rows  = [r for r in all_rows if r["team_code"] == code]
            # Most recent name for this code
            name  = rows[-1]["team_name"]

            adv_list = []
            for row in rows:
                ao = _opp_for(conn, row["game_id"], code)
                if not ao:
                    continue
                adv_list.append(calc_team_stats(_row(row), _opp_dict(ao)))

            if not adv_list:
                continue

            def _avg(key):
                vals = [a[key] for a in adv_list if key in a]
                return round(sum(vals) / len(vals), 4) if vals else 0

            result.append({
                "team_code":  code,
                "team_name":  name,
                "games":      len(adv_list),
                "oer":        _avg("oer"),
                "der":        _avg("der"),
                "net_rating": _avg("net_rating"),
                "efg_pct":    _avg("efg_pct"),
                "ts_pct":     _avg("ts_pct"),
                "or_pct":     _avg("or_pct"),
                "dr_pct":     _avg("dr_pct"),
                "to_pct":     _avg("to_pct"),
                "pace":       _avg("pace"),
                "pts":        _avg("pts"),
            })

    result.sort(key=lambda x: x["oer"], reverse=True)
    return jsonify(result)


# ── PWA ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
