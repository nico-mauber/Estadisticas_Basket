import os
import secrets
from datetime import timedelta
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from sqlalchemy import func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from database import db, init_db, upgrade_db, Game, TeamGameStats, PlayerGameStats, Shot, PbpEvent, DB_PATH
from stats_engine import calc_team_stats, calc_player_stats, league_averages, _parse_minutes
from fiba_fetcher import fetch_game_data
from clutch import clutch_rows
import lineups
from auth import (
    login_required, auth_enabled, verify,
    check_rate_limit, register_fail, clear_fails, client_ip,
)

app = Flask(__name__, static_folder="../frontend", static_url_path="/")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Session / cookie security
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
if not os.environ.get("SECRET_KEY"):
    app.logger.warning("SECRET_KEY no seteada — clave efímera (las sesiones se reinician al reiniciar).")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_SECURE", "").lower() in ("1", "true", "yes"),
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
)

CORS(app, supports_credentials=True)

init_db(app)
upgrade_db(app)


# ── Helpers ────────────────────────────────────────────────────────────────

def _seed_enabled() -> bool:
    """Seed endpoint is dev-only — gated by the SEED_ENABLED env var.

    Set SEED_ENABLED=true ONLY on the dev Render service. Production never
    has the variable, so POST /api/seed returns 403 there.
    """
    return os.environ.get("SEED_ENABLED", "").strip().lower() in ("1", "true", "yes")


# Fixed roster of FIBA LiveStats games for one-click dev seeding.
SEED_URLS = [
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849328/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849331/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849329/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849327/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849353/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849347/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849340/bs.html",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849343/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849337/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849334/bs.html",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849350/",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849332/bs.html",
    "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849330/bs.html",
]


def _to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def _opp_for(game_id: str, team_code: str) -> TeamGameStats | None:
    return TeamGameStats.query.filter(
        TeamGameStats.game_id == game_id,
        TeamGameStats.team_code != team_code
    ).first()


def _classify_zone(action_type: str, sub_type: str, y: float = 0, x: float = 0) -> str:
    if action_type == "3pt":
        if x != 0 or y != 0:
            if y < 15 or y > 85:
                return "corner_3"
        return "above_break_3"
    sub = (sub_type or "").lower()
    if any(k in sub for k in ["layup", "dunk", "alley", "tip", "hook", "putback", "driving"]):
        return "paint"
    return "mid_range"


_PAINT_KWORDS = {"layup", "dunk", "alley", "tip", "hook", "putback", "driving", "fingerroll"}

ZONE_KEYS_11 = [
    "restricted_area",
    "mid_left_close", "mid_right_close",
    "mid_left_far",   "mid_right_far",   "mid_top",
    "left_corner_3",  "right_corner_3",
    "left_wing_3",    "right_wing_3",    "top_key_3",
]

ZONE_POINTS = {
    "restricted_area": 2, "mid_left_close": 2, "mid_right_close": 2,
    "mid_left_far": 2,    "mid_right_far": 2,   "mid_top": 2,
    "left_corner_3": 3,   "right_corner_3": 3,
    "left_wing_3": 3,     "right_wing_3": 3,    "top_key_3": 3,
}

_2PT_ZONES = {"restricted_area", "mid_left_close", "mid_right_close",
              "mid_left_far", "mid_right_far", "mid_top"}
_3PT_ZONES = {"left_corner_3", "right_corner_3", "left_wing_3",
              "right_wing_3", "top_key_3"}


def _classify_zone_11(action_type: str, sub_type: str, x: float = 0, y: float = 0) -> str:
    """
    Classify a shot into one of 11 zones.

    Coordinate system (FIBA LiveStats normalized):
      x: 0–100, center=50, left<50
      y: 0–100, baseline=0, increases away from basket

    Zone geometry matches SVG rendering:
      restricted_area  = full paint box (x 34–66)
      mid_left_close   = outside paint left, near baseline (x<34, y<25)
      mid_right_close  = outside paint right, near baseline (x>66, y<25)
      mid_left_far     = left elbow / wing mid (x<42, y≥25)
      mid_right_far    = right elbow (x≥58, y≥25)
      mid_top          = high post center (x 42–58, y≥25)
    """
    sub       = (sub_type or "").lower()
    has_coord = x != 0 or y != 0

    if action_type == "3pt":
        if has_coord and y < 14:
            return "left_corner_3" if x < 50 else "right_corner_3"
        if not has_coord:
            return "top_key_3"
        if x < 38:
            return "left_wing_3"
        if x >= 62:
            return "right_wing_3"
        return "top_key_3"

    # 2pt — paint keywords always → restricted area
    paint_sub = any(k in sub for k in _PAINT_KWORDS)
    if paint_sub:
        return "restricted_area"

    if has_coord:
        # Inside paint box (lane lines x ≈ 34–66)
        if 34 <= x <= 66:
            return "restricted_area"
        # Outside paint, near baseline
        if y < 25:
            return "mid_left_close" if x < 50 else "mid_right_close"
        # Mid-range above baseline
        if x < 42:
            return "mid_left_far"
        if x >= 58:
            return "mid_right_far"
        return "mid_top"

    return "mid_top"


def _opp_dict(opp: TeamGameStats) -> dict:
    return {
        "pts":  opp.pts,
        "fgm2": opp.fgm2, "fga2": opp.fga2,
        "fgm3": opp.fgm3, "fga3": opp.fga3,
        "ftm":  opp.ftm,  "fta":  opp.fta,
        "orb":  opp.orb,  "drb":  opp.drb,
        "tov":  opp.tov,
    }


# ── Import ─────────────────────────────────────────────────────────────────

@app.route("/api/import", methods=["POST"])
@login_required
def import_game():
    body = request.get_json(force=True)
    url  = (body or {}).get("url", "").strip()
    if not url:
        return jsonify({"error": "Se requiere campo 'url'"}), 400

    try:
        game = fetch_game_data(url)
    except ValueError as e:
        # ValueError covers bad URLs AND FibaSchemaError (upstream schema drift).
        # Log so a format change is visible in server logs, not just the UI.
        app.logger.warning("Import rejected for %s: %s", url, e)
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        app.logger.error("Import failed: %s", e)
        return jsonify({"error": "No se pudo obtener datos de FIBA LiveStats. Verifica la URL."}), 502

    game_id        = game["game_id"]
    teams_imported = _persist_game(game)
    return jsonify({"ok": True, "game_id": game_id, "teams": teams_imported})


def _persist_game(game: dict) -> list[dict]:
    """Upsert a parsed game (game + team/player/shot rows) and commit.

    Shared by POST /api/import and POST /api/seed. Returns the list of
    imported teams ({code, name}). Raises on DB error (caller handles).
    """
    game_id = game["game_id"]

    # Upsert game
    db.session.execute(
        sqlite_insert(Game).values(
            game_id     = game_id,
            competition = game.get("competition"),
            date        = game.get("date"),
            home_team   = game.get("home_team"),
            home_code   = game.get("home_code"),
            away_team   = game.get("away_team"),
            away_code   = game.get("away_code"),
            home_score  = game.get("home_score"),
            away_score  = game.get("away_score"),
        ).on_conflict_do_update(
            index_elements=["game_id"],
            set_=dict(
                competition = game.get("competition"),
                date        = game.get("date"),
                home_team   = game.get("home_team"),
                home_code   = game.get("home_code"),
                away_team   = game.get("away_team"),
                away_code   = game.get("away_code"),
                home_score  = game.get("home_score"),
                away_score  = game.get("away_score"),
            )
        )
    )

    for t in game.get("teams", []):
        db.session.execute(
            sqlite_insert(TeamGameStats).values(
                game_id   = game_id,
                team_code = t["team_code"],
                team_name = t["team_name"],
                is_home   = t["is_home"],
                pts  = t["pts"],  fgm  = t["fgm"],  fga  = t["fga"],
                fgm2 = t["fgm2"], fga2 = t["fga2"],
                fgm3 = t["fgm3"], fga3 = t["fga3"],
                ftm  = t["ftm"],  fta  = t["fta"],
                orb  = t["orb"],  drb  = t["drb"],  trb  = t["trb"],
                ast  = t["ast"],  tov  = t["tov"],
                stl  = t["stl"],  blk  = t["blk"],  pf   = t["pf"],
                opp_pts  = t.get("opp_pts",  0),
                opp_fga2 = t.get("opp_fga2", 0),
                opp_fga3 = t.get("opp_fga3", 0),
                opp_fta  = t.get("opp_fta",  0),
                opp_orb  = t.get("opp_orb",  0),
                opp_drb  = t.get("opp_drb",  0),
                opp_tov  = t.get("opp_tov",  0),
                opp_pf   = t.get("opp_pf",   0),
                paint_pts         = t.get("paint_pts",         0),
                second_chance_pts = t.get("second_chance_pts", 0),
                pts_from_tov      = t.get("pts_from_tov",      0),
                bench_pts         = t.get("bench_pts",         0),
                fast_break_pts    = t.get("fast_break_pts",    0),
            ).on_conflict_do_update(
                index_elements=["game_id", "team_code"],
                set_=dict(
                    team_name = t["team_name"],
                    pts  = t["pts"],  fgm  = t["fgm"],  fga  = t["fga"],
                    fgm2 = t["fgm2"], fga2 = t["fga2"],
                    fgm3 = t["fgm3"], fga3 = t["fga3"],
                    ftm  = t["ftm"],  fta  = t["fta"],
                    orb  = t["orb"],  drb  = t["drb"],  trb  = t["trb"],
                    ast  = t["ast"],  tov  = t["tov"],
                    stl  = t["stl"],  blk  = t["blk"],  pf   = t["pf"],
                    opp_pts  = t.get("opp_pts",  0),
                    opp_fga2 = t.get("opp_fga2", 0),
                    opp_fga3 = t.get("opp_fga3", 0),
                    opp_fta  = t.get("opp_fta",  0),
                    opp_orb  = t.get("opp_orb",  0),
                    opp_drb  = t.get("opp_drb",  0),
                    opp_tov  = t.get("opp_tov",  0),
                    opp_pf   = t.get("opp_pf",   0),
                    paint_pts         = t.get("paint_pts",         0),
                    second_chance_pts = t.get("second_chance_pts", 0),
                    pts_from_tov      = t.get("pts_from_tov",      0),
                    bench_pts         = t.get("bench_pts",         0),
                    fast_break_pts    = t.get("fast_break_pts",    0),
                )
            )
        )

    for p in game.get("players", []):
        db.session.execute(
            sqlite_insert(PlayerGameStats).values(
                game_id     = game_id,
                team_code   = p["team_code"],
                team_name   = p["team_name"],
                player_name = p["player_name"],
                jersey      = p.get("jersey"),
                minutes     = p.get("minutes"),
                position    = p.get("position", ""),
                plus_minus  = p.get("plus_minus", 0),
                starter     = p.get("starter", 0),
                pts  = p["pts"],  fgm  = p["fgm"],  fga  = p["fga"],
                fgm2 = p["fgm2"], fga2 = p["fga2"],
                fgm3 = p["fgm3"], fga3 = p["fga3"],
                ftm  = p["ftm"],  fta  = p["fta"],
                orb  = p["orb"],  drb  = p["drb"],  trb  = p["trb"],
                ast  = p["ast"],  tov  = p["tov"],
                stl  = p["stl"],  blk  = p["blk"],  pf   = p["pf"],
            ).on_conflict_do_update(
                index_elements=["game_id", "team_code", "player_name"],
                set_=dict(
                    team_name = p["team_name"],
                    jersey    = p.get("jersey"),
                    minutes   = p.get("minutes"),
                    position   = p.get("position", ""),
                    plus_minus = p.get("plus_minus", 0),
                    starter    = p.get("starter", 0),
                    pts  = p["pts"],  fgm  = p["fgm"],  fga  = p["fga"],
                    fgm2 = p["fgm2"], fga2 = p["fga2"],
                    fgm3 = p["fgm3"], fga3 = p["fga3"],
                    ftm  = p["ftm"],  fta  = p["fta"],
                    orb  = p["orb"],  drb  = p["drb"],  trb  = p["trb"],
                    ast  = p["ast"],  tov  = p["tov"],
                    stl  = p["stl"],  blk  = p["blk"],  pf   = p["pf"],
                )
            )
        )

    for s in game.get("shots", []):
        db.session.execute(
            sqlite_insert(Shot).values(
                game_id       = game_id,
                team_code     = s["team_code"],
                player_name   = s["player_name"],
                x             = s["x"],
                y             = s["y"],
                made          = s["made"],
                action_type   = s["action_type"],
                sub_type      = s["sub_type"],
                period        = s["period"],
                action_number = s["action_number"],
            ).on_conflict_do_nothing()
        )

    for ev in game.get("pbp", []):
        db.session.execute(
            sqlite_insert(PbpEvent).values(
                game_id       = game_id,
                team_code     = ev["team_code"],
                player_name   = ev["player_name"],
                period        = ev["period"],
                period_type   = ev["period_type"],
                clock_secs    = ev["clock_secs"],
                s1            = ev["s1"],
                s2            = ev["s2"],
                action_type   = ev["action_type"],
                sub_type      = ev["sub_type"],
                success       = ev["success"],
                action_number = ev["action_number"],
            ).on_conflict_do_nothing()
        )

    db.session.commit()

    return [
        {"code": t["team_code"], "name": t["team_name"]}
        for t in game.get("teams", [])
    ]


# ── Games ──────────────────────────────────────────────────────────────────

@app.route("/api/games")
@login_required
def list_games():
    games = Game.query.order_by(Game.date.desc(), Game.imported_at.desc()).all()
    return jsonify([_to_dict(g) for g in games])


# ── Teams ─────────────────────────────────────────────────────────────────

@app.route("/api/teams")
@login_required
def list_teams():
    rows = (
        db.session.query(
            TeamGameStats.team_code,
            TeamGameStats.team_name,
            func.count().label("games"),
        )
        .group_by(TeamGameStats.team_code)
        .order_by(TeamGameStats.team_name)
        .all()
    )
    return jsonify([{"code": r.team_code, "name": r.team_name, "games": r.games} for r in rows])


@app.route("/api/team/<team_code>")
@login_required
def team_stats(team_code: str):
    team_code = team_code.upper()
    rows = TeamGameStats.query.filter_by(team_code=team_code).all()
    if not rows:
        return jsonify({"error": "Equipo no encontrado"}), 404

    team_name = rows[-1].team_name

    game_stats = []
    for row in rows:
        t   = _to_dict(row)
        opp = _opp_for(row.game_id, team_code)
        if not opp:
            continue
        adv = calc_team_stats(t, _opp_dict(opp))
        game_info = Game.query.filter_by(game_id=row.game_id).first()
        game_stats.append({
            "game_id":       row.game_id,
            "date":          game_info.date if game_info else "",
            "opponent":      opp.team_name,
            "opponent_code": opp.team_code,
            "home_away":     "L" if row.is_home else "V",
            **adv,
            "opp_pf":            t.get("opp_pf",            0),
            "paint_pts":         t.get("paint_pts",         0),
            "second_chance_pts": t.get("second_chance_pts", 0),
            "pts_from_tov":      t.get("pts_from_tov",      0),
            "bench_pts":         t.get("bench_pts",         0),
            "fast_break_pts":    t.get("fast_break_pts",    0),
        })

    all_rows = TeamGameStats.query.all()
    all_adv  = []
    for ar in all_rows:
        ao = _opp_for(ar.game_id, ar.team_code)
        if not ao:
            continue
        all_adv.append(calc_team_stats(_to_dict(ar), _opp_dict(ao)))

    league = league_averages(all_adv)

    def _avg(key):
        # Excluye None (tasas sin dato): un partido sin intentos no cuenta como 0.
        vals = [g[key] for g in game_stats if key in g and g[key] is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

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
        "ftm", "fta", "orb", "drb", "trb", "ast", "tov", "stl", "blk", "pf",
        "opp_pf", "paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts",
    ]
    averages = {k: _avg(k) for k in keys}

    wins      = sum(1 for g in game_stats if g.get("pts", 0) > g.get("opp_pts", 0))
    losses    = len(game_stats) - wins
    home_gs   = [g for g in game_stats if g["home_away"] == "L"]
    away_gs   = [g for g in game_stats if g["home_away"] == "V"]
    home_wins = sum(1 for g in home_gs if g.get("pts", 0) > g.get("opp_pts", 0))
    away_wins = sum(1 for g in away_gs if g.get("pts", 0) > g.get("opp_pts", 0))

    record = {
        "wins":    wins,
        "losses":  losses,
        "win_pct": round(wins / len(game_stats), 3) if game_stats else 0,
        "home":    f"{home_wins}-{len(home_gs) - home_wins}",
        "away":    f"{away_wins}-{len(away_gs) - away_wins}",
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
@login_required
def team_players(team_code: str):
    team_code = team_code.upper()
    names = [
        r.player_name for r in
        PlayerGameStats.query
        .filter_by(team_code=team_code)
        .with_entities(PlayerGameStats.player_name)
        .distinct()
        .order_by(PlayerGameStats.player_name)
        .all()
    ]
    result = []
    for name in names:
        rows = PlayerGameStats.query.filter_by(team_code=team_code, player_name=name).all()
        uso_vals, pts_vals = [], []
        for row in rows:
            p = _to_dict(row)
            p.setdefault("trb", p["orb"] + p["drb"])
            team_row = TeamGameStats.query.filter_by(
                game_id=row.game_id, team_code=team_code
            ).first()
            game_obj = Game.query.filter_by(game_id=row.game_id).first()
            t_dict   = _to_dict(team_row) if team_row else None
            game_min = game_obj.minutes if game_obj else 40
            adv = calc_player_stats(p, team_pos=0, team=t_dict, game_minutes=game_min)
            if adv.get("uso_pct") is not None:
                uso_vals.append(adv["uso_pct"])
            pts_vals.append(p.get("pts", 0))
        avg_uso = round(sum(uso_vals) / len(uso_vals), 4) if uso_vals else 0
        avg_pts = round(sum(pts_vals) / len(pts_vals), 2) if pts_vals else 0
        result.append({
            "name":    name,
            "games":   len(rows),
            "uso_pct": avg_uso,
            "pts":     avg_pts,
        })
    result.sort(key=lambda x: x["uso_pct"], reverse=True)
    return jsonify(result)


@app.route("/api/player/<team_code>/<player_name>")
@login_required
def player_stats(team_code: str, player_name: str):
    team_code = team_code.upper()
    rows = PlayerGameStats.query.filter_by(
        team_code=team_code, player_name=player_name
    ).all()
    if not rows:
        return jsonify({"error": "Jugador no encontrado"}), 404

    game_log = []
    for row in rows:
        p = _to_dict(row)
        p.setdefault("trb", p["orb"] + p["drb"])

        game_info = Game.query.filter_by(game_id=row.game_id).first()
        opp       = _opp_for(row.game_id, team_code)
        team_row  = TeamGameStats.query.filter_by(
            game_id=row.game_id, team_code=team_code
        ).first()

        t_dict   = _to_dict(team_row) if team_row else None
        game_min = game_info.minutes if game_info else 40
        adv = calc_player_stats(p, team_pos=0, team=t_dict, game_minutes=game_min)

        if team_row:
            t_orb = team_row.orb or 0
            t_drb = team_row.drb or 0
            t_trb = team_row.trb or (t_orb + t_drb)
            adv["reb_share"]  = round(adv["trb"] / t_trb, 4) if t_trb else 0
            adv["oreb_share"] = round(adv["orb"] / t_orb, 4) if t_orb else 0
            adv["dreb_share"] = round(adv["drb"] / t_drb, 4) if t_drb else 0
        else:
            adv["reb_share"] = adv["oreb_share"] = adv["dreb_share"] = 0

        game_log.append({
            "game_id":       row.game_id,
            "date":          game_info.date if game_info else "",
            "opponent":      opp.team_name  if opp else "",
            "opponent_code": opp.team_code  if opp else "",
            **adv
        })

    all_players = PlayerGameStats.query.all()
    all_adv = []
    for ap in all_players:
        pp = _to_dict(ap)
        pp.setdefault("trb", pp["orb"] + pp["drb"])
        all_adv.append(calc_player_stats(pp, team_pos=0))

    league = league_averages(all_adv)

    def _avg(key):
        # Excluye None (tasas sin dato): un partido sin intentos no cuenta como 0.
        vals = [g[key] for g in game_log if key in g and g[key] is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

    keys = [
        "oer", "efg_pct", "ts_pct", "fg2_pct", "fg3_pct",
        "ft_pct", "ft_rate", "ft_rate_report", "pps", "ppp",
        "fg2_uso", "fg3_uso", "peso_1p", "peso_2p", "peso_3p",
        "or_pct", "dr_pct", "to_pct", "to_ratio", "as_pct", "ast_ratio", "ast_to",
        "stocks", "def_playmaking", "def_to_ratio", "physical_impact",
        "reb_share", "oreb_share", "dreb_share",
        "uso_pct",
        "pts", "fgm", "fga", "fgm2", "fga2", "fgm3", "fga3",
        "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk",
    ]
    averages = {k: _avg(k) for k in keys}

    return jsonify({
        "player":    player_name,
        "team_code": team_code,
        "team_name": rows[0].team_name,
        "games":     len(game_log),
        "averages":  averages,
        "league":    league,
        "game_log":  game_log,
    })


# ── Player shots ───────────────────────────────────────────────────────────

@app.route("/api/shots/<team_code>/<player_name>")
@login_required
def player_shots(team_code: str, player_name: str):
    team_code = team_code.upper()
    rows = Shot.query.filter_by(team_code=team_code, player_name=player_name).all()

    has_coordinates = any((row.x or 0) != 0 or (row.y or 0) != 0 for row in rows)

    zones = {k: {"made": 0, "attempts": 0} for k in ZONE_KEYS_11}
    for row in rows:
        z = _classify_zone_11(row.action_type, row.sub_type, row.x or 0, row.y or 0)
        zones[z]["attempts"] += 1
        zones[z]["made"]     += row.made

    total_fga = sum(z["attempts"] for z in zones.values())
    total_pts = sum(zones[k]["made"] * ZONE_POINTS[k] for k in ZONE_KEYS_11)
    fgm2 = sum(zones[k]["made"] for k in _2PT_ZONES)
    fgm3 = sum(zones[k]["made"] for k in _3PT_ZONES)

    for k, z in zones.items():
        if z["attempts"]:
            z["pct"] = round(z["made"] / z["attempts"], 4)
            z["pf"]  = round(z["made"] * ZONE_POINTS[k] / z["attempts"], 3)
        else:
            z["pct"] = None
            z["pf"]  = None

    games = db.session.query(Shot.game_id).filter_by(
        team_code=team_code, player_name=player_name
    ).distinct().count()

    pgs = db.session.query(
        func.sum(PlayerGameStats.pts).label("pts"),
        func.sum(PlayerGameStats.fga).label("fga"),
        func.sum(PlayerGameStats.fta).label("fta"),
        func.sum(PlayerGameStats.tov).label("tov"),
    ).filter_by(team_code=team_code, player_name=player_name).first()

    ppp = None
    if pgs and pgs.fga:
        poss = (pgs.fga or 0) + 0.44 * (pgs.fta or 0) + (pgs.tov or 0)
        if poss:
            ppp = round((pgs.pts or 0) / poss, 3)

    summary = {
        "global_pf": round(total_pts / total_fga, 3) if total_fga else None,
        "efg_pct":   round((fgm2 + 1.5 * fgm3) / total_fga, 4) if total_fga else None,
        "ppp":       ppp,
        "games":     games,
    }

    return jsonify({
        "zones": zones,
        "total_shots": total_fga,
        "has_coordinates": has_coordinates,
        "summary": summary,
    })


# ── Player search ────────────────────────────────────────────────────────────

@app.route("/api/search/players")
@login_required
def search_players():
    """Todos los jugadores de la base con sus promedios, para el buscador.

    Una entrada por (team_code, player_name). Tasas promediadas excluyendo None
    (Feature 08); conteos incluyen 0. Filtrado y orden se hacen en el frontend.
    """
    games     = {g.game_id: g for g in Game.query.all()}
    team_rows = {(tr.game_id, tr.team_code): tr for tr in TeamGameStats.query.all()}

    groups = {}
    for pr in PlayerGameStats.query.all():
        groups.setdefault((pr.team_code, pr.player_name), []).append(pr)

    metric_keys = [
        "efg_pct", "ts_pct", "oer", "uso_pct", "ppp", "pps",
        "fg2_pct", "fg3_pct", "ft_pct",
        "reb_share", "oreb_share", "dreb_share",
        "physical_impact", "stocks", "def_playmaking",
    ]
    count_keys = ["pts", "ast", "tov", "stl", "blk"]

    result = []
    for (team_code, player_name), rows in groups.items():
        per_game, comps, pm_vals, min_vals = [], set(), [], []
        position = ""
        for pr in rows:
            p = _to_dict(pr)
            p.setdefault("trb", p["orb"] + p["drb"])
            team_row = team_rows.get((pr.game_id, team_code))
            t_dict   = _to_dict(team_row) if team_row else None
            adv = calc_player_stats(p, team_pos=0, team=t_dict)
            if team_row:
                t_orb = team_row.orb or 0
                t_drb = team_row.drb or 0
                t_trb = team_row.trb or (t_orb + t_drb)
                adv["reb_share"]  = round(adv["trb"] / t_trb, 4) if t_trb else None
                adv["oreb_share"] = round(adv["orb"] / t_orb, 4) if t_orb else None
                adv["dreb_share"] = round(adv["drb"] / t_drb, 4) if t_drb else None
            else:
                adv["reb_share"] = adv["oreb_share"] = adv["dreb_share"] = None
            per_game.append(adv)
            g = games.get(pr.game_id)
            if g and g.competition:
                comps.add(g.competition)
            pm_vals.append(pr.plus_minus if pr.plus_minus is not None else 0)
            min_vals.append(_parse_minutes(pr.minutes))
            if getattr(pr, "position", "") :
                position = pr.position

        def _avg_metric(k):
            vals = [gm[k] for gm in per_game if gm.get(k) is not None]
            return round(sum(vals) / len(vals), 4) if vals else None

        def _avg_count(k):
            vals = [gm.get(k, 0) or 0 for gm in per_game]
            return round(sum(vals) / len(vals), 2) if vals else None

        rec = {
            "player":       player_name,
            "team_code":    team_code,
            "team_name":    rows[-1].team_name,
            "competitions": sorted(comps),
            "games":        len(rows),
            "position":     position,
            "minutes":      round(sum(min_vals) / len(min_vals), 1) if min_vals else 0,
            "plus_minus":   round(sum(pm_vals) / len(pm_vals), 1) if pm_vals else 0,
        }
        for k in metric_keys:
            rec[k] = _avg_metric(k)
        for k in count_keys:
            rec[k] = _avg_count(k)
        result.append(rec)

    result.sort(key=lambda r: r["player"])
    return jsonify(result)


# ── Play-by-play (verificación) ──────────────────────────────────────────────

@app.route("/api/pbp/<game_id>")
@login_required
def game_pbp(game_id: str):
    """Verificación del pbp persistido de un partido (Feature 02)."""
    rows = (
        PbpEvent.query.filter_by(game_id=game_id)
        .order_by(PbpEvent.action_number)
        .all()
    )
    if not rows:
        return jsonify({"error": "Partido sin play-by-play. Reimportá el partido."}), 404

    by_action = {}
    for r in rows:
        by_action[r.action_type] = by_action.get(r.action_type, 0) + 1

    return jsonify({
        "game_id":        game_id,
        "events":         len(rows),
        "by_action_type": by_action,
        "first":          _to_dict(rows[0]),
        "last":           _to_dict(rows[-1]),
    })


# ── Clutch (últimos 5 min) ───────────────────────────────────────────────────

@app.route("/api/clutch")
@login_required
def clutch_overview():
    """Cierres de partido: una fila por equipo-partido (Feature 05).

    Filtro opcional ?team=<code>. `[]` si ningún partido tiene pbp.
    """
    events_by_game = {}
    for ev in PbpEvent.query.all():
        events_by_game.setdefault(ev.game_id, []).append(_to_dict(ev))

    game_info = {
        g.game_id: {
            "date":      g.date,
            "home_code": g.home_code,
            "away_code": g.away_code,
            "home_team": g.home_team,
            "away_team": g.away_team,
        }
        for g in Game.query.all()
    }

    rows = clutch_rows(events_by_game, game_info)

    team = request.args.get("team")
    if team:
        rows = [r for r in rows if r["team_code"] == team.upper()]

    rows.sort(key=lambda r: (r.get("date") or "", r["game_id"]), reverse=True)
    return jsonify(rows)


# ── Lineups / ON-OFF (motor de quintetos) ────────────────────────────────────

def _team_pbp_games(team_code: str) -> list[dict]:
    """Partidos del equipo con pbp: [{game_id, events, player_rows, opp_code}, ...].

    Base compartida por Feature 03 (lineups) y Feature 04 (on/off).
    """
    game_ids = {
        tr.game_id for tr in TeamGameStats.query.filter_by(team_code=team_code).all()
    }
    games = []
    for gid in game_ids:
        events = [
            _to_dict(e) for e in
            PbpEvent.query.filter_by(game_id=gid).order_by(PbpEvent.action_number).all()
        ]
        if not events:
            continue
        g = Game.query.filter_by(game_id=gid).first()
        if not g:
            continue
        opp_code = g.away_code if g.home_code == team_code else g.home_code
        if not opp_code:
            continue
        games.append({
            "game_id":     gid,
            "events":      events,
            "player_rows": PlayerGameStats.query.filter_by(game_id=gid).all(),
            "opp_code":    opp_code,
        })
    return games


@app.route("/api/lineup/<team_code>")
@login_required
def lineup_route(team_code: str):
    """Rendimiento del equipo con una combinación de 3-5 jugadores en cancha (Feature 03)."""
    team_code = team_code.upper()
    players = [p for p in request.args.get("players", "").split("|") if p.strip()]
    if not (3 <= len(players) <= 5):
        return jsonify({"error": "Elegí entre 3 y 5 jugadores"}), 400

    games = _team_pbp_games(team_code)
    if not games:
        return jsonify({"error": "Equipo no encontrado o sin play-by-play"}), 404

    result = lineups.lineup_stats(games, team_code, players)
    result.update({"team_code": team_code, "players": players, "size": len(players)})
    return jsonify(result)


@app.route("/api/onoff/<team_code>/<player_name>")
@login_required
def onoff_route(team_code: str, player_name: str):
    """Rendimiento del equipo con un jugador en cancha (ON) vs en el banco (OFF) (Feature 04)."""
    team_code = team_code.upper()
    games = _team_pbp_games(team_code)
    if not games:
        return jsonify({"error": "Equipo no encontrado o sin play-by-play"}), 404

    if not PlayerGameStats.query.filter_by(team_code=team_code, player_name=player_name).first():
        return jsonify({"error": "Sin datos ON/OFF para este jugador"}), 404

    result = lineups.onoff_stats(games, team_code, player_name)

    uso_vals = []
    for pr in PlayerGameStats.query.filter_by(team_code=team_code, player_name=player_name).all():
        p = _to_dict(pr)
        p.setdefault("trb", p["orb"] + p["drb"])
        team_row = TeamGameStats.query.filter_by(game_id=pr.game_id, team_code=team_code).first()
        t_dict = _to_dict(team_row) if team_row else None
        adv = calc_player_stats(p, team_pos=0, team=t_dict)
        if adv.get("uso_pct") is not None:
            uso_vals.append(adv["uso_pct"])
    result["usg_pct"] = round(sum(uso_vals) / len(uso_vals), 4) if uso_vals else None
    result["team_code"] = team_code
    result["player"] = player_name
    return jsonify(result)


# ── League ─────────────────────────────────────────────────────────────────

@app.route("/api/league")
@login_required
def league_overview():
    codes    = db.session.query(TeamGameStats.team_code).distinct().all()
    all_rows = TeamGameStats.query.all()

    result = []
    for (code,) in codes:
        rows = [r for r in all_rows if r.team_code == code]
        name = rows[-1].team_name

        adv_list = []
        for row in rows:
            ao = _opp_for(row.game_id, code)
            if not ao:
                continue
            adv_list.append(calc_team_stats(_to_dict(row), _opp_dict(ao)))

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
            "stl":        _avg("stl"),
        })

    result.sort(key=lambda x: x["oer"], reverse=True)
    return jsonify(result)


# ── Delete games ──────────────────────────────────────────────────────────

@app.route("/api/games", methods=["DELETE"])
@login_required
def delete_games():
    body = request.get_json(force=True) or {}
    ids  = body.get("game_ids", [])
    if not ids or not isinstance(ids, list):
        return jsonify({"error": "Se requiere game_ids[]"}), 400

    games = Game.query.filter(Game.game_id.in_(ids)).all()
    for g in games:
        db.session.delete(g)  # cascade removes team_stats, player_stats, shots
    db.session.commit()

    return jsonify({"ok": True, "deleted": len(games)})


# ── Auth ─────────────────────────────────────────────────────────────────────

@app.route("/api/login", methods=["POST"])
def login():
    ip = client_ip()
    if not check_rate_limit(ip):
        return jsonify({"error": "Demasiados intentos. Esperá 1 minuto."}), 429
    body = request.get_json(force=True) or {}
    user = (body.get("user") or "").strip()
    password = body.get("password") or ""
    if verify(user, password):
        session.permanent = True
        session["user"] = user
        clear_fails(ip)
        return jsonify({"ok": True, "user": user})
    register_fail(ip)
    return jsonify({"error": "Usuario o contraseña incorrectos"}), 401


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    """Auth + feature flags. Llamada por el SPA al arrancar. Siempre abierta."""
    return jsonify({
        "authenticated": "user" in session,
        "user":          session.get("user"),
        "auth_required": auth_enabled(),
        "seed_enabled":  _seed_enabled(),
    })


# ── Seed (dev-only) ──────────────────────────────────────────────────────────

@app.route("/api/seed", methods=["POST"])
@login_required
def seed_games():
    """Import the fixed SEED_URLS roster in one shot. Dev-only.

    Gated by SEED_ENABLED — returns 403 in production where the var is unset.
    """
    if not _seed_enabled():
        return jsonify({"error": "Seed deshabilitado en este entorno."}), 403

    results = []
    for url in SEED_URLS:
        try:
            game  = fetch_game_data(url)
            teams = _persist_game(game)
            results.append({
                "url": url, "ok": True, "game_id": game["game_id"],
                "teams": " vs ".join(t["name"] for t in teams),
            })
        except Exception as e:
            db.session.rollback()
            app.logger.warning("Seed failed for %s: %s", url, e)
            results.append({"url": url, "ok": False, "error": str(e)})

    imported = sum(1 for r in results if r["ok"])
    return jsonify({
        "ok": True,
        "imported": imported,
        "failed":   len(results) - imported,
        "results":  results,
    })


# ── PWA ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
