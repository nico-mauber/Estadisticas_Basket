import os
import secrets
from datetime import timedelta
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from sqlalchemy import func
from database import db, init_db, upgrade_db, Game, TeamGameStats, PlayerGameStats, Shot, PbpEvent, DB_PATH
from stats_engine import (calc_team_stats, calc_player_stats, league_averages,
                          _parse_minutes, played, norm_name, resolve_identity,
                          season_ast_to, season_def_to_ratio, null_reasons)
from clutch import team_clutch
import lineups
import competitions
import data_quality
import ingest
from competitions import CompetitionError
from auth import (
    login_required, admin_required, is_admin, auth_enabled, verify,
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
with app.app_context():
    competitions.backfill()   # partidos sin competencia (idempotente, F-11 RF-4)


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


def _visible(query, model):
    """Excluye los partidos de competencias en borrador (F-11): solo se ven en Datos."""
    return competitions.visible(query, model)


def _comp_fields(game: Game | None, labels: dict) -> dict:
    """competition_id + etiqueta de la competencia de un partido (para los selectores)."""
    cid = game.competition_id if game else None
    return {"competition_id": cid, "competition_label": labels.get(cid, {}).get("label")}


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
        result = ingest.import_url(url)
    except ValueError as e:
        # ValueError covers bad URLs AND FibaSchemaError (upstream schema drift).
        # Log so a format change is visible in server logs, not just the UI.
        db.session.rollback()
        app.logger.warning("Import rejected for %s: %s", url, e)
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        app.logger.error("Import failed: %s", e)
        return jsonify({"error": "No se pudo obtener datos de FIBA LiveStats. Verifica la URL."}), 502

    return jsonify({"ok": True, **result})


# ── Games ──────────────────────────────────────────────────────────────────

@app.route("/api/games")
@login_required
def list_games():
    """Catálogo de partidos (sección Datos: incluye competencias en borrador).

    `competition=<id>` filtra. Cada fila indica su competencia y su estado de datos.
    """
    q = Game.query
    try:
        comp_id = competitions.resolve(request.args.get("competition"))
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
    if comp_id:
        q = q.filter_by(competition_id=comp_id)
    games = q.order_by(Game.date.desc(), Game.imported_at.desc()).all()
    with_pbp = {gid for (gid,) in db.session.query(PbpEvent.game_id).distinct()}
    with_coords = {gid for (gid,) in db.session.query(Shot.game_id)
                   .filter(Shot.court_x.isnot(None)).distinct()}
    labels = competitions.labels()
    return jsonify([_game_row(g, labels, with_pbp, with_coords) for g in games])


def _game_row(g: Game, labels: dict, with_pbp: set, with_coords: set) -> dict:
    return {
        **_to_dict(g),
        **_comp_fields(g, labels),
        "competition_status": labels.get(g.competition_id, {}).get("status"),
        "has_pbp":         g.game_id in with_pbp,
        "has_coords":      g.game_id in with_coords,
        "needs_reprocess": ingest.needs_reprocess(g),
    }


@app.route("/api/games/<game_id>", methods=["PATCH"])
@admin_required
def assign_game(game_id: str):
    """Reasigna un partido a otra competencia (sobrevive a reimportar y reprocesar)."""
    comp_id = (request.get_json(force=True) or {}).get("competition_id")
    if not isinstance(comp_id, int):
        return jsonify({"error": "Se requiere competition_id entero."}), 400
    try:
        g = competitions.assign_game(game_id, comp_id)
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
    return jsonify({**_to_dict(g), **_comp_fields(g, competitions.labels())})


# ── Teams ─────────────────────────────────────────────────────────────────

@app.route("/api/teams")
@login_required
def list_teams():
    # Nombre del equipo = el de su partido más reciente (el orden de las filas cambia al
    # reprocesar, F-11), no el de una fila cualquiera del GROUP BY.
    rows = (_visible(db.session.query(TeamGameStats.team_code, TeamGameStats.team_name, Game.date)
                     .join(Game, Game.game_id == TeamGameStats.game_id), TeamGameStats)
            .order_by(Game.date, Game.game_id).all())
    teams: dict[str, dict] = {}
    for code, name, _date in rows:
        t = teams.setdefault(code, {"code": code, "games": 0})
        t["name"] = name
        t["games"] += 1
    return jsonify(sorted(teams.values(), key=lambda t: t["name"]))


@app.route("/api/team/<team_code>")
@login_required
def team_stats(team_code: str):
    team_code = team_code.upper()
    rows = _visible(TeamGameStats.query.filter_by(team_code=team_code), TeamGameStats).all()
    if not rows:
        return jsonify({"error": "Equipo no encontrado"}), 404

    games_by_id = {g.game_id: g for g in Game.query.all()}
    # Orden cronológico explícito: el orden de las filas cambia al reprocesar (F-11)
    rows.sort(key=lambda r: ((games_by_id[r.game_id].date or "") if r.game_id in games_by_id else "", r.game_id))
    team_name = rows[-1].team_name
    labels = competitions.labels()

    game_stats = []
    for row in rows:
        game_info = games_by_id.get(row.game_id)
        t   = _to_dict(row)
        t["minutes"] = game_info.minutes if game_info else 40   # PACE con prórrogas (F-11)
        opp = _opp_for(row.game_id, team_code)
        if not opp:
            continue
        adv = calc_team_stats(t, _opp_dict(opp))
        # Desglose FIBA: NULL = la competencia no lo publica; se devuelve null, no 0 (C-11 RF-11)
        adv.update({k: t.get(k) for k in
                    ("paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts")})
        adv["opp_pf"] = t.get("opp_pf", 0)
        game_stats.append({
            "game_id":       row.game_id,
            "date":          game_info.date if game_info else "",
            "competition":   game_info.competition if game_info else "",
            **_comp_fields(game_info, labels),
            "opponent":      opp.team_name,
            "opponent_code": opp.team_code,
            "home_away":     "L" if row.is_home else "V",
            **adv,
            "null_reasons":  null_reasons(adv),   # C-11 RF-3
        })

    # Población de liga POR COMPETENCIA (Feature 14 RF-1): comparar contra un promedio
    # que mezcla torneos distintos no da contexto real. Clave = id de competencia (F-11);
    # "" es el agregado.
    game_comp = {gid: str(g.competition_id or "") for gid, g in games_by_id.items()}
    own_comps = {game_comp.get(r.game_id, "") for r in rows}

    all_adv = []
    by_comp: dict[str, list] = {}
    for ar in _visible(TeamGameStats.query, TeamGameStats).all():
        ao = _opp_for(ar.game_id, ar.team_code)
        if not ao:
            continue
        ad = _to_dict(ar)
        ad["minutes"] = games_by_id[ar.game_id].minutes if ar.game_id in games_by_id else 40
        adv = calc_team_stats(ad, _opp_dict(ao))
        all_adv.append(adv)
        by_comp.setdefault(game_comp.get(ar.game_id, ""), []).append(adv)

    leagues = {"": league_averages(all_adv)}
    for comp in own_comps:
        if comp:   # solo las competencias donde este equipo jugó: son las seleccionables
            leagues[comp] = league_averages(by_comp.get(comp, []))
    league = leagues[""]

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
        "ppt_2", "ppt_3", "ppt_ft",
        "fgm", "fga", "fgm2", "fga2", "fgm3", "fga3",
        "ftm", "fta", "orb", "drb", "trb", "ast", "tov", "stl", "blk", "pf",
        "opp_pf", "paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts",
    ]
    averages = {k: _avg(k) for k in keys}
    # AS/PER de temporada — mismo criterio acumulado que en jugador (C-04 / Feature 15 RF-7)
    def _sum(key):
        return sum(g.get(key, 0) or 0 for g in game_stats)

    averages["ast_to"] = season_ast_to(_sum("ast"), _sum("tov"))
    # DEF/TO acumulado (pooled, DA-02): sin centinela, un partido sin pérdidas no se pierde (C-11)
    averages["def_to_ratio"] = season_def_to_ratio(_sum("stl"), _sum("blk"), _sum("drb"), _sum("tov"))
    # C-07: totales de temporada, además del promedio por partido (Feature 16 RF-5)
    totals = {k: _sum(k) for k in ("fga2", "fgm2", "fga3", "fgm3", "fta", "ftm")}

    wins      = sum(1 for g in game_stats if g.get("pts", 0) > g.get("opp_pts", 0))
    losses    = len(game_stats) - wins
    home_gs   = [g for g in game_stats if g["home_away"] == "L"]
    away_gs   = [g for g in game_stats if g["home_away"] == "V"]
    home_wins = sum(1 for g in home_gs if g.get("pts", 0) > g.get("opp_pts", 0))
    away_wins = sum(1 for g in away_gs if g.get("pts", 0) > g.get("opp_pts", 0))

    record = {
        "wins":    wins,
        "losses":  losses,
        "win_pct": round(wins / len(game_stats), 3) if game_stats else None,  # tasa: sin partidos → None (RF-5)
        "home":    f"{home_wins}-{len(home_gs) - home_wins}",
        "away":    f"{away_wins}-{len(away_gs) - away_wins}",
    }

    return jsonify({
        "team_code": team_code,
        "team_name": team_name,
        "games":     len(game_stats),
        "record":    record,
        "averages":  averages,
        "null_reasons": null_reasons(averages),   # razón de cada null de `averages` (C-11 RF-3)
        "league":    league,     # = leagues[""] — se conserva por compatibilidad
        "leagues":   leagues,    # promedio de liga por competencia (Feature 14 RF-1)
        "totals":    totals,     # totales de temporada (Feature 16 RF-5)
        "game_log":  game_stats,
    })


# ── Players ────────────────────────────────────────────────────────────────

@app.route("/api/players/<team_code>")
@login_required
def team_players(team_code: str):
    team_code = team_code.upper()
    # Una entrada por jugador con nombre NORMALIZADO: dos grafías del mismo nombre
    # son un solo jugador (Feature 13 RF-1/RF-2). Orden por fecha para que
    # `resolve_identity` desempate por "más reciente".
    game_dates = {g.game_id: (g.date or "") for g in Game.query.all()}
    groups: dict[str, list] = {}
    for pr in sorted(_visible(PlayerGameStats.query.filter_by(team_code=team_code), PlayerGameStats).all(),
                     key=lambda r: (game_dates.get(r.game_id, ""), r.game_id)):
        groups.setdefault(norm_name(pr.player_name), []).append(pr)

    result = []
    for _norm_key in sorted(groups):
        rows = groups[_norm_key]
        name, _position = resolve_identity(rows)
        uso_vals, pts_vals = [], []
        played_rows = [r for r in rows if played(r.minutes)]   # Feature 12 RF-6
        for row in played_rows:
            p = _to_dict(row)
            p.setdefault("trb", p["orb"] + p["drb"])
            team_row = TeamGameStats.query.filter_by(
                game_id=row.game_id, team_code=team_code
            ).first()
            game_obj = Game.query.filter_by(game_id=row.game_id).first()
            t_dict   = _to_dict(team_row) if team_row else None
            game_min = game_obj.minutes if game_obj else 40
            opp_row  = _opp_for(row.game_id, team_code)   # Feature 15 RF-6
            adv = calc_player_stats(p, team_pos=0, team=t_dict, game_minutes=game_min,
                                    opp=_to_dict(opp_row) if opp_row else None)
            if adv.get("uso_pct") is not None:
                uso_vals.append(adv["uso_pct"])
            pts_vals.append(p.get("pts", 0))
        # USO% es tasa: sin ningún valor válido → None, no 0 (Feature 12 RF-5)
        avg_uso = round(sum(uso_vals) / len(uso_vals), 4) if uso_vals else None
        avg_pts = round(sum(pts_vals) / len(pts_vals), 2) if pts_vals else None
        result.append({
            "name":    name,
            "games":   len(played_rows),   # partidos JUGADOS — Feature 12 RF-7
            "uso_pct": avg_uso,
            "pts":     avg_pts,
        })
    result.sort(key=lambda x: (x["uso_pct"] is None, -(x["uso_pct"] or 0)))
    return jsonify(result)


@app.route("/api/player/<team_code>/<player_name>")
@login_required
def player_stats(team_code: str, player_name: str):
    team_code = team_code.upper()
    # Resolver por nombre NORMALIZADO: acepta cualquier grafía en la URL y devuelve
    # TODOS los partidos del jugador, aunque el nombre haya variado (Feature 13 RF-5).
    key  = norm_name(player_name)
    rows = [r for r in _visible(PlayerGameStats.query.filter_by(team_code=team_code), PlayerGameStats).all()
            if norm_name(r.player_name) == key]
    if not rows:
        return jsonify({"error": "Jugador no encontrado"}), 404
    rows.sort(key=lambda r: r.game_id)
    player_name, _pos = resolve_identity(rows)   # grafía real para la respuesta (RF-4)
    labels = competitions.labels()

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
        # `opp` habilita OR%/DR%/TRB% individuales (Feature 15 RF-6)
        adv = calc_player_stats(p, team_pos=0, team=t_dict, game_minutes=game_min,
                                opp=_to_dict(opp) if opp else None)

        if team_row:
            t_orb = team_row.orb or 0
            t_drb = team_row.drb or 0
            t_trb = team_row.trb or (t_orb + t_drb)
            # Tasas: denominador 0 → None, no 0 (Feature 12 RF-5; mismo patrón que search_players)
            adv["reb_share"]  = round(adv["trb"] / t_trb, 4) if t_trb else None
            adv["oreb_share"] = round(adv["orb"] / t_orb, 4) if t_orb else None
            adv["dreb_share"] = round(adv["drb"] / t_drb, 4) if t_drb else None
        else:
            adv["reb_share"] = adv["oreb_share"] = adv["dreb_share"] = None

        is_played = played(row.minutes)
        game_log.append({
            "game_id":       row.game_id,
            "date":          game_info.date if game_info else "",
            "competition":   game_info.competition if game_info else "",
            **_comp_fields(game_info, labels),
            "opponent":      opp.team_name  if opp else "",
            "opponent_code": opp.team_code  if opp else "",
            "played":        is_played,   # false = DNP (Feature 12 RF-6)
            **adv,
            "null_reasons":  null_reasons(adv, played=is_played),   # C-11 RF-3
        })

    # Población de liga POR COMPETENCIA (Feature 14 RF-1); clave = id de competencia, "" = agregado.
    game_comp = {g.game_id: str(g.competition_id or "") for g in Game.query.all()}
    own_comps = {game_comp.get(r.game_id, "") for r in rows}

    # La población de liga necesita equipo y rival de cada ficha: sin ellos, OR%/DR%/
    # TRB% individuales y USO% saldrían None y esas métricas quedarían sin Ø (Feature 15 RF-9).
    all_team_rows = {(tr.game_id, tr.team_code): tr for tr in TeamGameStats.query.all()}
    game_len      = {g.game_id: (g.minutes or 40) for g in Game.query.all()}

    all_adv = []
    by_comp: dict[str, list] = {}
    for ap in _visible(PlayerGameStats.query, PlayerGameStats).all():
        pp = _to_dict(ap)
        pp.setdefault("trb", pp["orb"] + pp["drb"])
        tr_own = all_team_rows.get((ap.game_id, ap.team_code))
        tr_opp = next((tr for (gid, tc), tr in all_team_rows.items()
                       if gid == ap.game_id and tc != ap.team_code), None)
        adv = calc_player_stats(pp, team_pos=0,
                                team=_to_dict(tr_own) if tr_own else None,
                                game_minutes=game_len.get(ap.game_id, 40),
                                opp=_to_dict(tr_opp) if tr_opp else None)
        all_adv.append(adv)
        by_comp.setdefault(game_comp.get(ap.game_id, ""), []).append(adv)

    leagues = {"": league_averages(all_adv)}
    for comp in own_comps:
        if comp:
            leagues[comp] = league_averages(by_comp.get(comp, []))
    league = leagues[""]

    # Población de promedio: solo partidos jugados. Un DNP no cuenta como partido
    # jugado (Feature 12 RF-6); el game_log sigue devolviéndolos todos (CA-8).
    played_log = [g for g in game_log if g["played"]]

    def _avg(key):
        # Excluye None (tasas sin dato): un partido sin intentos no cuenta como 0.
        vals = [g[key] for g in played_log if key in g and g[key] is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

    keys = [
        "oer", "efg_pct", "ts_pct", "fg2_pct", "fg3_pct",
        "ft_pct", "ft_rate", "ft_rate_report", "pps", "ppp",
        "fg2_uso", "fg3_uso", "peso_1p", "peso_2p", "peso_3p",
        "or_pct", "dr_pct", "trb_pct", "to_pct", "to_ratio", "as_pct", "ast_ratio", "ast_to",
        # C-01 — por posesión y por minuto (Feature 15)
        "as_pos", "tov_pos", "pts_pos", "orb_min", "drb_min",
        # C-07 — PPT por tipo de tiro (Feature 16)
        "ppt_2", "ppt_3", "ppt_ft",
        "stocks", "def_playmaking", "def_to_ratio", "physical_impact",
        "reb_share", "oreb_share", "dreb_share",
        "uso_pct",
        "pts", "fgm", "fga", "fgm2", "fga2", "fgm3", "fga3",
        "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk",
    ]
    averages = {k: _avg(k) for k in keys}
    # AS/PER de temporada: cociente de los TOTALES, no promedio de los ratios por
    # partido (Feature 15 RF-7 / C-04). Solo sobre partidos jugados.
    def _sum(key):
        return sum(g.get(key, 0) or 0 for g in played_log)

    averages["ast_to"] = season_ast_to(_sum("ast"), _sum("tov"))
    # DEF/TO acumulado (pooled, DA-02), mismo criterio que AS/PER (C-11)
    averages["def_to_ratio"] = season_def_to_ratio(_sum("stl"), _sum("blk"), _sum("drb"), _sum("tov"))
    # C-07: totales de temporada sobre los partidos JUGADOS (Feature 16 RF-5 + Feature 12 RF-6)
    totals = {k: _sum(k) for k in ("fga2", "fgm2", "fga3", "fgm3", "fta", "ftm")}

    return jsonify({
        "player":    player_name,
        "team_code": team_code,
        "team_name": rows[0].team_name,
        "games":     len(played_log),   # partidos JUGADOS (excluye DNP) — Feature 12 RF-7
        "averages":  averages,
        # Sin partidos jugados, todo `averages` es null por DNP (C-11 RF-3)
        "null_reasons": null_reasons(averages, played=bool(played_log)),
        "league":    league,     # = leagues[""] — se conserva por compatibilidad
        "leagues":   leagues,    # promedio de liga por competencia (Feature 14 RF-1)
        "totals":    totals,     # totales de temporada (Feature 16 RF-5)
        "game_log":  game_log,
    })


# ── Shots (jugador y equipo) ─────────────────────────────────────────────────

def _zones_from_shots(rows):
    """Clasifica una lista de tiros en las 11 zonas + totales. Compartido jugador/equipo."""
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
            # PPT = puntos de la zona / intentos de la zona. Antes se llamaba `pf`:
            # misma fórmula, etiqueta equivocada (C-03 / Feature 16 §9).
            z["ppt"] = round(z["made"] * ZONE_POINTS[k] / z["attempts"], 3)
            # eFG% de la zona = (FGM + 0.5×3PM)/FGA aplicado a una zona de un solo
            # valor de puntos → factor 1.0 en zonas de 2, 1.5 en zonas de 3.
            factor   = 1.5 if ZONE_POINTS[k] == 3 else 1.0
            z["efg"] = round(z["made"] * factor / z["attempts"], 4)
        else:
            z["pct"] = None
            z["ppt"] = None
            z["efg"] = None

    return zones, total_fga, total_pts, fgm2, fgm3, has_coordinates


@app.route("/api/shots/<team_code>/<player_name>")
@login_required
def player_shots(team_code: str, player_name: str):
    team_code = team_code.upper()
    rows = _visible(Shot.query.filter_by(team_code=team_code, player_name=player_name), Shot).all()
    zones, total_fga, total_pts, fgm2, fgm3, has_coordinates = _zones_from_shots(rows)

    games = _visible(db.session.query(Shot.game_id).filter_by(
        team_code=team_code, player_name=player_name
    ), Shot).distinct().count()

    pgs = _visible(db.session.query(
        func.sum(PlayerGameStats.pts).label("pts"),
        func.sum(PlayerGameStats.fga).label("fga"),
        func.sum(PlayerGameStats.fta).label("fta"),
        func.sum(PlayerGameStats.tov).label("tov"),
    ).filter_by(team_code=team_code, player_name=player_name), PlayerGameStats).first()

    ppp = None
    if pgs and pgs.fga:
        poss = (pgs.fga or 0) + 0.44 * (pgs.fta or 0) + (pgs.tov or 0)
        if poss:
            ppp = round((pgs.pts or 0) / poss, 3)

    return jsonify({
        "zones": zones,
        "total_shots": total_fga,
        "has_coordinates": has_coordinates,
        "summary": {
            "ppt":       round(total_pts / total_fga, 3) if total_fga else None,
            "efg_pct":   round((fgm2 + 1.5 * fgm3) / total_fga, 4) if total_fga else None,
            "ppp":       ppp,
            "games":     games,
        },
    })


@app.route("/api/shots/<team_code>")
@login_required
def team_shots(team_code: str):
    """Mapa de tiro AGREGADO del equipo (todos sus jugadores)."""
    team_code = team_code.upper()
    rows = _visible(Shot.query.filter_by(team_code=team_code), Shot).all()
    zones, total_fga, total_pts, fgm2, fgm3, has_coordinates = _zones_from_shots(rows)

    games = _visible(db.session.query(Shot.game_id).filter_by(team_code=team_code), Shot).distinct().count()

    tgs = _visible(db.session.query(
        func.sum(TeamGameStats.pts).label("pts"),
        func.sum(TeamGameStats.fga).label("fga"),
        func.sum(TeamGameStats.fta).label("fta"),
        func.sum(TeamGameStats.tov).label("tov"),
    ).filter_by(team_code=team_code), TeamGameStats).first()

    ppp = None
    if tgs and tgs.fga:
        poss = (tgs.fga or 0) + 0.44 * (tgs.fta or 0) + (tgs.tov or 0)
        if poss:
            ppp = round((tgs.pts or 0) / poss, 3)

    return jsonify({
        "zones": zones,
        "total_shots": total_fga,
        "has_coordinates": has_coordinates,
        "summary": {
            "ppt":       round(total_pts / total_fga, 3) if total_fga else None,
            "efg_pct":   round((fgm2 + 1.5 * fgm3) / total_fga, 4) if total_fga else None,
            "ppp":       ppp,
            "games":     games,
        },
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
    labels    = competitions.labels()

    # Identidad por nombre NORMALIZADO: dos grafías del mismo nombre son un solo
    # jugador (Feature 13 RF-1/RF-2). Orden estable por fecha del partido para que
    # `resolve_identity` pueda desempatar por "más reciente".
    all_prs = sorted(_visible(PlayerGameStats.query, PlayerGameStats).all(),
                     key=lambda r: ((games[r.game_id].date if r.game_id in games else ""), r.game_id))
    groups = {}
    for pr in all_prs:
        groups.setdefault((pr.team_code, norm_name(pr.player_name)), []).append(pr)

    metric_keys = [
        "efg_pct", "ts_pct", "oer", "uso_pct", "ppp", "pps",
        "fg2_pct", "fg3_pct", "ft_pct",
        "reb_share", "oreb_share", "dreb_share",
        "physical_impact", "stocks", "def_playmaking",
        # C-01 — por posesión, por minuto y rebote individual (Feature 15)
        "as_pos", "tov_pos", "pts_pos", "orb_min", "drb_min",
        "or_pct", "dr_pct", "trb_pct",
        "ppt_2", "ppt_3", "ppt_ft",
    ]
    count_keys = ["pts", "ast", "tov", "stl", "blk"]

    result = []
    for (team_code, _norm_key), rows in groups.items():
        per_game, comps, pm_vals, min_vals = [], set(), [], []
        # Grafía real + posición determinista del grupo unificado (Feature 13 RF-3/RF-4)
        player_name, position = resolve_identity(rows)
        for pr in rows:
            # La competencia sale de TODAS las fichas: estar convocado sin jugar
            # igual ubica al jugador en esa competencia.
            g = games.get(pr.game_id)
            if g and g.competition_id in labels:
                comps.add(labels[g.competition_id]["label"])

            # Un DNP no entra en ningún promedio (Feature 12 RF-6).
            if not played(pr.minutes):
                continue

            p = _to_dict(pr)
            p.setdefault("trb", p["orb"] + p["drb"])
            team_row = team_rows.get((pr.game_id, team_code))
            t_dict   = _to_dict(team_row) if team_row else None
            # Rival del mismo partido, desde el mapa ya construido — sin consulta extra
            opp_row  = next((tr for (gid, tc), tr in team_rows.items()
                             if gid == pr.game_id and tc != team_code), None)
            g_obj    = games.get(pr.game_id)
            adv = calc_player_stats(p, team_pos=0, team=t_dict,
                                    game_minutes=(g_obj.minutes if g_obj else 40),
                                    opp=_to_dict(opp_row) if opp_row else None)
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
            if pr.plus_minus is not None:   # NULL = la competencia no lo registra (C-11 RF-11)
                pm_vals.append(pr.plus_minus)
            min_vals.append(_parse_minutes(pr.minutes))

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
            "games":        len(per_game),   # partidos JUGADOS — Feature 12 RF-7
            "position":     position,
            "minutes":      round(sum(min_vals) / len(min_vals), 1) if min_vals else None,
            "plus_minus":   round(sum(pm_vals) / len(pm_vals), 1) if pm_vals else None,
        }
        for k in metric_keys:
            rec[k] = _avg_metric(k)
        for k in count_keys:
            rec[k] = _avg_count(k)
        # AS/PER de temporada — mismo criterio acumulado (C-04 / Feature 15 RF-7)
        rec["ast_to"] = season_ast_to(sum(gm.get("ast", 0) or 0 for gm in per_game),
                                      sum(gm.get("tov", 0) or 0 for gm in per_game))
        stat_keys = metric_keys + count_keys + ["minutes", "plus_minus", "ast_to"]
        rec["null_reasons"] = null_reasons({k: rec[k] for k in stat_keys},
                                           played=bool(per_game))   # C-11 RF-3
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


# ── Lineups / ON-OFF / Clutch (motor de quintetos + cierres) ─────────────────

def _team_pbp_games(team_code: str) -> list[dict]:
    """Partidos del equipo con pbp: [{game_id, events, player_rows, opp_code}, ...].

    Base compartida por Feature 03 (lineups) y Feature 04 (on/off).
    """
    game_ids = {
        tr.game_id for tr in _visible(TeamGameStats.query.filter_by(team_code=team_code), TeamGameStats).all()
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
            "info":        {"date": g.date, "home_away": "L" if g.home_code == team_code else "V"},
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

    if not _visible(PlayerGameStats.query.filter_by(team_code=team_code, player_name=player_name),
                    PlayerGameStats).first():
        return jsonify({"error": "Sin datos ON/OFF para este jugador"}), 404

    result = lineups.onoff_stats(games, team_code, player_name)

    uso_vals = []
    for pr in _visible(PlayerGameStats.query.filter_by(team_code=team_code, player_name=player_name),
                       PlayerGameStats).all():
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


@app.route("/api/clutch/<team_code>")
@login_required
def clutch_team(team_code: str):
    """Cierre del equipo: agregado ("mini-partido") + desglose por partido (Feature 05 v2).

    Solo cuentan los cierres con diferencia ≤ margen (default 15) al minuto 5:00.
    Ver sdd/specs/05-clutch/spec.md §10.
    """
    team_code = team_code.upper()
    row = _visible(TeamGameStats.query.filter_by(team_code=team_code), TeamGameStats).first()
    if not row:
        return jsonify({"error": "Equipo no encontrado"}), 404

    games = _team_pbp_games(team_code)
    if not games:
        return jsonify({"error": "Equipo sin play-by-play. Reimportá sus partidos."}), 404

    margin = request.args.get("margin", type=int)
    if margin is None or margin < 0:
        margin = 10   # C-06: partido cerrado = dif ≤ 10 (antes 15)
    return jsonify(team_clutch(games, team_code, row.team_name, margin))


# ── League ─────────────────────────────────────────────────────────────────

@app.route("/api/competitions")
@login_required
def list_competitions():
    """Competencias (F-11). Sin parámetros, solo las publicadas (selectores); con
    `include_hidden=1` también las en borrador (sección Datos)."""
    include_hidden = request.args.get("include_hidden") in ("1", "true")
    return jsonify(competitions.list_competitions(include_hidden))


@app.route("/api/competitions", methods=["POST"])
@admin_required
def create_competition():
    body = request.get_json(force=True) or {}
    try:
        comp = competitions.create(body.get("name"), body.get("season"))
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
    return jsonify(competitions.describe(comp)), 201


@app.route("/api/competitions/<int:comp_id>", methods=["PATCH"])
@admin_required
def update_competition(comp_id: int):
    try:
        comp = competitions.update(comp_id, request.get_json(force=True) or {})
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
    return jsonify(competitions.describe(comp))


@app.route("/api/competitions/<int:comp_id>/merge", methods=["POST"])
@admin_required
def merge_competition(comp_id: int):
    """Fusiona `source_id` en `comp_id`: partidos y alias pasan a la destino."""
    source_id = (request.get_json(force=True) or {}).get("source_id")
    if not isinstance(source_id, int):
        return jsonify({"error": "Se requiere source_id entero."}), 400
    try:
        return jsonify({"ok": True, **competitions.merge(comp_id, source_id)})
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status


# ── Calidad de datos + reproceso (F-11) ─────────────────────────────────────

@app.route("/api/data-quality")
@login_required
def data_quality_report():
    try:
        comp_id = competitions.resolve(request.args.get("competition"))
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
    if not comp_id:
        return jsonify({"error": "Elegí una competencia."}), 400
    comp = competitions.get(comp_id)
    return jsonify({"competition": competitions.describe(comp), **data_quality.report(comp_id)})


@app.route("/api/reprocess", methods=["POST"])
@admin_required
def reprocess():
    """Re-ejecuta la ingesta por lotes sobre `{game_ids: [...]}` o `{competition_id}`, con
    `offset` (default 0). El cliente repite con `next_offset` mientras no sea null; el tamaño
    del lote lo decide el backend (`ingest.REPROCESS_BATCH`)."""
    body = request.get_json(force=True) or {}
    batch, offset = ingest.REPROCESS_BATCH, body.get("offset", 0)
    if not isinstance(offset, int) or offset < 0:
        return jsonify({"error": "offset debe ser un entero ≥ 0."}), 400
    if body.get("game_ids") is not None:
        ids = body["game_ids"]
        if not isinstance(ids, list) or not ids:
            return jsonify({"error": "Se requiere al menos un game_id."}), 400
        all_ids = [str(i) for i in ids]
    else:
        comp_id = body.get("competition_id")
        if not isinstance(comp_id, int):
            return jsonify({"error": "Se requiere competition_id entero o game_ids."}), 400
        try:
            competitions.get(comp_id)
        except CompetitionError as e:
            return jsonify({"error": str(e)}), e.status
        all_ids = [gid for (gid,) in db.session.query(Game.game_id)
                   .filter_by(competition_id=comp_id).order_by(Game.game_id)]
    chunk = all_ids[offset:offset + batch]
    result = ingest.reprocess_games(chunk)
    nxt = offset + batch
    return jsonify({**result, "total": len(all_ids), "next_offset": nxt if nxt < len(all_ids) else None})


@app.route("/api/league")
@login_required
def league_overview():
    codes    = db.session.query(TeamGameStats.team_code).distinct().all()
    games_by_id = {g.game_id: g for g in Game.query.all()}
    minutes  = {gid: g.minutes or 40 for gid, g in games_by_id.items()}
    # orden cronológico: rows[-1] es el partido más reciente de cada equipo
    all_rows = sorted(_visible(TeamGameStats.query, TeamGameStats).all(),
                      key=lambda r: ((games_by_id[r.game_id].date or "") if r.game_id in games_by_id else "", r.game_id))

    # Filtro opcional por competencia (id; acepta el texto de FIBA por compatibilidad):
    # mantiene solo los partidos de esa competencia (evita mezclar competencias).
    try:
        comp_id = competitions.resolve(request.args.get("competition"))
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
    if comp_id:
        comp_gids = {g.game_id for g in Game.query.filter_by(competition_id=comp_id).all()}
        all_rows = [r for r in all_rows if r.game_id in comp_gids]

    result = []
    for (code,) in codes:
        rows = [r for r in all_rows if r.team_code == code]
        if not rows:
            continue  # equipo sin partidos en la competencia filtrada
        name = rows[-1].team_name

        adv_list = []
        for row in rows:
            ao = _opp_for(row.game_id, code)
            if not ao:
                continue
            t = _to_dict(row)
            t["minutes"] = minutes.get(row.game_id, 40)   # PACE con prórrogas (F-11)
            adv_list.append(calc_team_stats(t, _opp_dict(ao)))

        if not adv_list:
            continue

        def _avg(key):
            # Excluye None: un nulo no entra en el promedio ni cuenta como 0
            # (Feature 14 RF-4). Sin el filtro, sum() con un None levanta TypeError.
            vals = [a[key] for a in adv_list if a.get(key) is not None]
            return round(sum(vals) / len(vals), 4) if vals else None

        # C-09: tabla de posiciones — 2 puntos por ganado, 1 por perdido.
        # Un marcador igualado cuenta como derrota (no existe en FIBA; se define
        # para que PG + PP == PJ se sostenga ante un dato corrupto). Feature 17 RF-2.
        wins   = sum(1 for r in rows if (r.pts or 0) > (r.opp_pts or 0))
        losses = len(rows) - wins

        result.append({
            "team_code":  code,
            "team_name":  name,
            "games":      len(adv_list),
            # C-09 — tabla general (Feature 17 RF-1/RF-2/RF-3)
            "wins":         wins,
            "losses":       losses,
            "table_points": 2 * wins + losses,
            "pts_for":      sum(r.pts or 0 for r in rows),
            "pts_against":  sum(r.opp_pts or 0 for r in rows),
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

    # Orden null-safe: desde la Feature 14 `_avg` puede devolver None, y comparar
    # None con float levanta TypeError. Los nulos van al final (Feature 12 RF-1).
    result.sort(key=lambda x: (x["oer"] is None, -(x["oer"] or 0)))
    return jsonify(result)


# ── Delete games ──────────────────────────────────────────────────────────

@app.route("/api/games", methods=["DELETE"])
@admin_required
def delete_games():
    body = request.get_json(force=True) or {}
    ids  = body.get("game_ids", [])
    if not ids or not isinstance(ids, list):
        return jsonify({"error": "Se requiere game_ids[]"}), 400

    games = Game.query.filter(Game.game_id.in_(ids)).all()
    for g in games:
        db.session.delete(g)  # cascade: stats, tiros, pbp y JSON archivado
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
        "is_admin":      is_admin(),
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
            res = ingest.import_url(url)
            results.append({
                "url": url, "ok": True, "game_id": res["game_id"],
                "teams": " vs ".join(t["name"] for t in res["teams"]),
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
