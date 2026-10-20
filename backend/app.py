import os
import secrets
from datetime import timedelta
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from sqlalchemy import func
from database import db, init_db, upgrade_db, Game, TeamGameStats, PlayerGameStats, Player, Shot, PbpEvent, DB_PATH
from stats_engine import (calc_team_stats, calc_player_stats,
                          _parse_minutes, played, resolve_identity,
                          season_ast_to, null_reasons,
                          sum_pool, season_player_rates,
                          standings_row, standings_sort_key)
from clutch import team_clutch, MARGIN_RANGE, WINDOW_RANGE
import lineups
import competitions
import context
import data_quality
import identity
import ingest
import config
import population
import prefs
import repository
import metrics_catalog
import bundles  # noqa: F401 — se importa para que registre los 5 tipos de entidad (T-05)
import cache
import tables  # noqa: F401 — se importa para que registre las tablas de T-06 al arrancar
import export_xlsx
import shot_zones
import possessions
import game_analysis
import live
import prepare
import matchups  # noqa: F401 — registra entidad matchup
from metrics_catalog import MetricsError
from tables import TableError
from competitions import CompetitionError
from context import ContextError
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
    identity.backfill_player_ids()   # fichas de jugador de partidos ya importados (idempotente, C-08 RF-2)


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


# Zone constants and classification moved to shot_zones.py (C-03)
from shot_zones import (ZONE_KEYS_11, ZONE_POINTS, _2PT_ZONES, _3PT_ZONES,
                         _PAINT_KWORDS, classify_zone as _classify_zone_11)


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


def _standard_block(entity_type: str, entity_id) -> dict | None:
    """Bloque `standard` (T-05 plan §3.4/§4.10) para `/api/team` y `/api/player`: mismo
    `build_payload` que `GET /api/metrics/<entity_type>`, con los query args de la petición en
    curso. `None` si el cálculo falla — el legado se sirve igual, nunca se degrada (RF-18)."""
    try:
        args = dict(request.args)
        args["id"] = entity_id
        return metrics_catalog.build_payload(entity_type, args)
    except MetricsError as e:
        app.logger.warning("standard block (%s %s) falló: %s", entity_type, entity_id, e.message)
        return None
    except Exception:
        app.logger.exception("standard block (%s %s) falló de forma inesperada", entity_type, entity_id)
        return None


@app.route("/api/context/options")
@login_required
def context_options():
    """Opciones del selector de contexto (T-03 RF-15): competencias, equipos de la competencia elegida y
    las dimensiones con su nivel, valores válidos y disponibilidad. `?competition=<id>|all|<texto>`."""
    try:
        res = repository.resolve_competition(request.args.get("competition"))
    except CompetitionError as e:
        return jsonify({"error": str(e), "code": "competencia_inexistente"}), e.status
    comp_id = None if res["all"] else res["id"]
    teams = {}
    for r in repository.team_game_rows(comp_id).values():
        teams[r["team_code"]] = r["team_name"]
    return jsonify({
        "competition": {"id": res["id"], "all": res["all"]},
        "competitions": [{"id": cid, "label": label} for cid, label in repository.competition_labels().items()],
        "teams": [{"code": c, "name": n} for c, n in sorted(teams.items(), key=lambda t: t[1])],
        "dimensions": context.dimensions(comp_id),
    })


@app.route("/api/periods/<team_code>")
@login_required
def team_periods(team_code: str):
    """Estadísticas por tramo del partido (F-04): los 8 tramos (1.º–4.º cuarto, mitades, prórroga y últimos 5
    minutos) en una sola respuesta, cada uno con el conjunto estándar de T-05, su ficha de T-01 en el mismo
    tramo, el badge de muestra de split, el récord del tramo y el desglose por partido. Acepta el contexto de
    T-03 (el filtro `quarter` se ignora: manda el tramo). `?base=` como en `/api/metrics/*`."""
    import splits
    team_code = team_code.upper()
    if not any(r["team_code"] == team_code for r in repository.team_game_rows(None).values()):
        return jsonify({"error": "Equipo no encontrado", "code": "no_encontrado"}), 404
    out, echo = [], None
    for w in splits.WINDOWS:
        args = dict(request.args)
        args["id"] = f"{team_code}:{w}"
        try:
            payload = metrics_catalog.build_payload("period", args)
            empty = False
        except MetricsError as e:
            if e.code == "sin_partidos":
                payload, empty = None, True
            else:
                return jsonify({"error": e.message, "code": e.code}), e.status
        ctx = None
        entry = {"window": w, "label": splits.window_label(w), "empty": empty, "standard": payload,
                 "summary": None, "games": []}
        if payload is not None:
            import context as context_mod
            kw = {"team_code": team_code}
            ctx = context_mod.parse_context(request.args, **kw, event_level=True)
            b = splits.team_event_bundle(team_code, ctx.competition_id, _no_quarter(ctx), w)
            per_game = (b.meta or {}).get("per_game", []) if b else []
            pts = b.own.get("pts") if b else None
            opp = b.opp.get("pts") if b else None
            entry["games"] = per_game
            entry["summary"] = {
                "record": splits.record(per_game), "games_with_window": len(per_game),
                "pts": pts, "pts_against": opp,
                "point_diff": None if pts is None or opp is None else pts - opp,
            }
            echo = echo or payload["context"]
        out.append(entry)
    if echo is None:   # ningún tramo tiene datos: eco de la selección igual (sin partidos que cumplan)
        import context as context_mod
        try:
            ctx = _no_quarter(context_mod.parse_context(request.args, team_code=team_code, event_level=True))
        except ContextError as e:
            return jsonify(e.payload()), e.status
        echo = context_mod.context_echo(ctx, games_used=0, games_total=0, games_excluded={}, ignored=[],
                                        competition_label=metrics_catalog._competition_label(ctx))
        echo["level"] = "evento"
    return jsonify({"team_code": team_code, "windows": out, "context": echo,
                    "window_secs": config.get("clutch.window_secs")})


def _no_quarter(ctx):
    import dataclasses
    return dataclasses.replace(ctx, quarters=())


@app.route("/api/metrics-catalog")
@login_required
def metrics_catalog_route():
    """Catálogo de las 83 métricas estándar (T-05 plan §3.2): grupos, metadatos y razones de nulo."""
    return jsonify(metrics_catalog.catalog_json())


@app.route("/api/metrics/<entity_type>")
@login_required
def metrics_route(entity_type: str):
    """Conjunto estándar de métricas de una entidad (T-05 plan §3.3): `?id=` obligatorio,
    `competition`/`last`/`base` (y `margin`/`window_secs` para `clutch`)."""
    try:
        payload = metrics_catalog.build_payload(entity_type, request.args)
    except MetricsError as e:
        return jsonify({"error": e.message, "code": e.code}), e.status
    except ValueError as e:
        return jsonify({"error": str(e), "code": "parametro_invalido"}), 400
    return jsonify(payload)


@app.route("/api/table/<table_id>")
@login_required
def table_route(table_id: str):
    """Tabla completa de un apartado (T-06 plan §3.1/§4.6). Errores con `code`/`details`."""
    try:
        return jsonify(tables.build_table(table_id, request.args))
    except TableError as e:
        return jsonify(e.body), e.status


# Límite de cuerpo de exportación (plan §3.2 / D-10): 10 MB y 50.000 filas por hoja.
_XLSX_MAX_BYTES = 10 * 1024 * 1024
_XLSX_MAX_ROWS = 50000


@app.route("/api/export/xlsx", methods=["POST"])
@login_required
def export_xlsx_route():
    """Genera un XLSX con lo que el cliente envía ya ordenado (T-06 plan §3.2/§4.6).

    413 si el cuerpo supera 10 MB (`content_length`) o una hoja supera 50.000 filas;
    400 si el cuerpo es inválido (JSON malformado, fila con celdas de más, `fmt` desconocido,
    más de 20 hojas, nombre de hoja vacío)."""
    if request.content_length is not None and request.content_length > _XLSX_MAX_BYTES:
        return jsonify({"error": "La tabla es demasiado grande para exportar en XLSX; exportá en CSV.",
                        "code": "parametro_invalido"}), 413

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or "sheets" not in data:
        return jsonify({"error": "Cuerpo de exportación inválido", "code": "parametro_invalido"}), 400

    sheets = data.get("sheets")
    if isinstance(sheets, list):
        for si, sheet in enumerate(sheets):
            if isinstance(sheet, dict) and len(sheet.get("rows") or []) > _XLSX_MAX_ROWS:
                return jsonify({"error": "La tabla es demasiado grande para exportar en XLSX; exportá en CSV.",
                                "code": "parametro_invalido"}), 413

    meta = data.get("meta") or {}
    try:
        content = export_xlsx.workbook_bytes(sheets, meta)
    except ValueError as e:
        return jsonify({"error": "Cuerpo de exportación inválido", "code": "parametro_invalido",
                        "details": {"reason": str(e)}}), 400

    file_name = (meta.get("file_name") or "export") + ".xlsx"
    from urllib.parse import quote
    disposition = (f'attachment; filename="{_ascii_fallback(file_name)}"; '
                   f"filename*=UTF-8''{quote(file_name)}")
    from flask import Response
    return Response(content, mimetype=export_xlsx.XLSX_MIME,
                    headers={"Content-Disposition": disposition})


@app.route("/api/export/bulk")
@login_required
def export_bulk_route():
    """Exportación masiva de un equipo o una competencia (T-06 plan §3.3/§4.5/§4.6)."""
    scope = request.args.get("scope")
    if scope not in ("team", "competition"):
        return jsonify({"error": "Alcance inválido: usá team o competition",
                        "code": "parametro_invalido"}), 400

    raw_comp = request.args.get("competition")
    if str(raw_comp or "").strip().lower() == "all":
        return jsonify({"error": "La exportación masiva requiere una competencia concreta",
                        "code": "parametro_invalido"}), 400
    try:
        comp_id = repository.resolve_competition(raw_comp)["id"]
    except CompetitionError as e:
        return jsonify({"error": str(e), "code": "competencia_inexistente"}), e.status
    if comp_id is None:
        return jsonify({"error": "La exportación masiva requiere una competencia concreta",
                        "code": "parametro_invalido"}), 400

    scope_id = (request.args.get("team") or "").upper() if scope == "team" else ""
    if scope == "team" and not scope_id:
        return jsonify({"error": "Parámetro inválido: falta team", "code": "parametro_invalido",
                        "details": {"param": "team"}}), 400

    try:
        content = tables.bulk_workbook(scope, scope_id, comp_id)
    except TableError as e:
        return jsonify(e.body), e.status

    import datetime as _dt
    comp_label = repository.competition_labels().get(comp_id)
    entity = scope_id if scope == "team" else "competencia"
    today = _dt.date.today().isoformat()
    file_name = f"exportacion_{entity}_{tables._slug(comp_label or 'todas')}_{today}.xlsx"
    from urllib.parse import quote
    disposition = (f'attachment; filename="{_ascii_fallback(file_name)}"; '
                   f"filename*=UTF-8''{quote(file_name)}")
    from flask import Response
    return Response(content, mimetype=export_xlsx.XLSX_MIME,
                    headers={"Content-Disposition": disposition})


def _ascii_fallback(name: str) -> str:
    """Nombre de archivo ASCII para el `filename=` clásico (el `filename*` lleva el UTF-8)."""
    import unicodedata
    s = unicodedata.normalize("NFKD", name)
    return "".join(c for c in s if ord(c) < 128).replace('"', "") or "export.xlsx"


@app.route("/api/rankings/<entity_type>/<metric_key>")
@login_required
def rankings_route(entity_type: str, metric_key: str):
    """Ranking completo de una métrica en la población (T-01 plan §3.2/§4.6): `?id=` (resaltado,
    opcional), `competition`/`last` (contrato de C-02), `base` (coherencia; el ranking de conteos
    es siempre por partido)."""
    from metrics_catalog import METRICS

    valid_types = ("team", "player", "lineup", "onoff", "clutch")
    if entity_type not in valid_types:
        return jsonify({"error": "Tipo de entidad desconocido", "code": "parametro_invalido"}), 400
    mdef = METRICS.get(metric_key)
    if mdef is None:
        return jsonify({"error": "Métrica desconocida", "code": "parametro_invalido"}), 400
    if entity_type not in mdef.entities:
        return jsonify({"error": "La métrica no aplica a este tipo de entidad",
                        "code": "parametro_invalido"}), 400

    raw_id = request.args.get("id")
    kwargs = metrics_catalog._entity_id_kwargs(entity_type, str(raw_id)) if raw_id else {}
    try:
        ctx = context.parse_context(request.args, **kwargs, event_level=entity_type in ("team", "period"))
    except ContextError as e:
        msg = str(e)
        code = "competencia_inexistente" if "competencia" in msg.lower() else "contexto_invalido"
        return jsonify({"error": msg, "code": code}), e.status
    except CompetitionError as e:
        return jsonify({"error": str(e), "code": "competencia_inexistente"}), e.status

    variant = None
    if entity_type == "lineup" and raw_id and ":" in str(raw_id):
        pids = [p for p in str(raw_id).split(":", 1)[1].split("-") if p.strip()]
        variant = len(pids) or None

    result = population.full_ranking(entity_type, metric_key, ctx.competition_id, ctx,
                                     highlight_id=raw_id, variant=variant)
    return jsonify(result)


@app.route("/api/team/<team_code>")
@login_required
def team_stats(team_code: str):
    """Perfil del equipo para la selección activa: `?competition=<id>|all|<texto>` (ausente = la de su
    partido más reciente) y `?last=<n>`. El promedio de liga es el de la competencia (C-02)."""
    team_code = team_code.upper()
    try:
        ctx = context.parse_context(request.args, team_code=team_code, event_level=True)
    except ContextError as e:
        return jsonify(e.payload()), e.status
    profile = population.team_profile(team_code, ctx)
    if profile is None:
        return jsonify({"error": "Equipo no encontrado"}), 404
    profile["standard"] = _standard_block("team", team_code)
    return jsonify(profile)


# ── Players ────────────────────────────────────────────────────────────────

@app.route("/api/players/<team_code>")
@login_required
def team_players(team_code: str):
    team_code = team_code.upper()
    try:
        comp_id = competitions.resolve(request.args.get("competition"))   # ausente = todas
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
    # Una entrada por ficha de jugador (C-08): dos grafías del mismo nombre son un solo jugador.
    game_dates = {g.game_id: (g.date or "") for g in Game.query.all()}
    q = _visible(PlayerGameStats.query.filter_by(team_code=team_code), PlayerGameStats)
    if comp_id:
        q = q.filter(PlayerGameStats.game_id.in_(db.session.query(Game.game_id).filter_by(competition_id=comp_id)))
    display = {p.id: p.display_name for p in Player.query.filter_by(team_code=team_code).all()}
    groups: dict = {}
    for pr in sorted(q.all(), key=lambda r: (game_dates.get(r.game_id, ""), r.game_id)):
        groups.setdefault(identity.group_key(pr), []).append(pr)

    result = []
    for rows in groups.values():
        name = display.get(rows[0].player_id) or resolve_identity(rows)[0]
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
            "player_id": rows[0].player_id,
            "name":    name,
            "games":   len(played_rows),   # partidos JUGADOS — Feature 12 RF-7
            "uso_pct": avg_uso,
            "pts":     avg_pts,
        })
    result.sort(key=lambda x: (x["uso_pct"] is None, -(x["uso_pct"] or 0), x["name"]))
    return jsonify(result)


def _resolve_legacy_player(team_code: str, name: str) -> int | None:
    """Ficha de un jugador por (equipo, nombre en cualquier grafía). None si no existe (C-08 RF-10)."""
    try:
        return identity.resolve_player_id(team_code.upper(), name or "", create=False)
    except ValueError:
        return None


def _player_response(pid: int | None):
    """Perfil de una ficha para la selección activa (`competition`, `last`); 404 si no existe (C-08, C-02)."""
    if pid is None:
        return jsonify({"error": "Jugador no encontrado"}), 404
    try:
        ctx = context.parse_context(request.args, player_id=pid)
    except ContextError as e:
        return jsonify(e.payload()), e.status
    payload = population.player_profile(pid, ctx)
    if payload is None:
        return jsonify({"error": "Jugador no encontrado"}), 404
    payload["standard"] = _standard_block("player", pid)
    return jsonify(payload)


@app.route("/api/player/<int:player_id>")
@login_required
def player_by_id(player_id: int):
    return _player_response(identity.canonical_id(player_id))   # una ficha absorbida responde la que la absorbió


@app.route("/api/player/<team_code>/<player_name>")
@login_required
def player_stats(team_code: str, player_name: str):
    return _player_response(_resolve_legacy_player(team_code, player_name))


# ── Shots (jugador y equipo) ─────────────────────────────────────────────────

def _zones_from_shots(rows):
    """Clasifica una lista de tiros en las 11 zonas + totales. Delegado a shot_zones (C-03).

    Preserves legacy field names (pct, efg) alongside the new ones (fg_pct, efg_pct).
    """
    zones, total_fga, total_pts, fgm2, fgm3, has_coordinates = shot_zones.zone_table(rows)
    # Legacy routes used 'pct' and 'efg'; zone_table uses 'fg_pct' and 'efg_pct'.
    # Add legacy aliases for backward compatibility.
    for z in zones.values():
        z["pct"] = z["fg_pct"]
        z["efg"] = z["efg_pct"]
    return zones, total_fga, total_pts, fgm2, fgm3, has_coordinates


@app.route("/api/shots/<team_code>/<player_name>")
@login_required
def player_shots(team_code: str, player_name: str):
    team_code = team_code.upper()
    pid = _resolve_legacy_player(team_code, player_name)
    if pid is None:
        return jsonify({"error": "Jugador no encontrado"}), 404
    names = identity.aliases(pid)   # tiros y pbp guardan el nombre crudo: se usan todas las grafías
    rows = _visible(Shot.query.filter(Shot.team_code == team_code, Shot.player_name.in_(names)), Shot).all()
    zones, total_fga, total_pts, fgm2, fgm3, has_coordinates = _zones_from_shots(rows)

    games = _visible(db.session.query(Shot.game_id).filter(
        Shot.team_code == team_code, Shot.player_name.in_(names)
    ), Shot).distinct().count()

    pgs = _visible(db.session.query(
        func.sum(PlayerGameStats.pts).label("pts"),
        func.sum(PlayerGameStats.fga).label("fga"),
        func.sum(PlayerGameStats.fta).label("fta"),
        func.sum(PlayerGameStats.tov).label("tov"),
    ).filter(PlayerGameStats.player_id == pid), PlayerGameStats).first()

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


# ── Shot zones with percentile and sample (C-03) ──────────────────────────

@app.route("/api/shot-zones")
@login_required
def shot_zones_route():
    """Shot zones enriched with PPT percentile and sample badge (C-03)."""
    entity = request.args.get("entity")
    if entity not in ("team", "player"):
        return jsonify({"error": "El parametro entity debe ser 'team' o 'player'",
                        "code": "parametro_invalido"}), 400

    entity_id = request.args.get("id", "")
    if not entity_id:
        return jsonify({"error": "Se requiere el parametro id",
                        "code": "parametro_invalido"}), 400

    # Resolve competition and last from query args
    try:
        comp_raw = request.args.get("competition")
        comp_id = competitions.resolve(comp_raw) if comp_raw else None
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status

    last_raw = request.args.get("last", "").strip()
    last = None
    if last_raw:
        try:
            last = int(last_raw)
            if last < 1:
                raise ValueError
        except ValueError:
            return jsonify({"error": "El parametro last debe ser un entero mayor a 0.",
                            "code": "parametro_invalido"}), 400

    if entity == "team":
        entity_id = entity_id.upper()
        shots_fn = shot_zones._shots_for_team
    else:
        # player: entity_id is player_id
        try:
            entity_id = int(entity_id)
        except ValueError:
            return jsonify({"error": "El id de jugador debe ser un entero",
                            "code": "parametro_invalido"}), 400
        entity_id = identity.canonical_id(entity_id)
        if entity_id is None:
            return jsonify({"error": "Jugador no encontrado"}), 404
        shots_fn = shot_zones._shots_for_player

    result = shot_zones.zones_with_stats(entity, entity_id, comp_id, last, shots_fn)

    # Build context echo
    labels = competitions.labels()
    comp_label = labels.get(comp_id, {}).get("label") if comp_id else None
    result["context"] = {
        "competition": {"id": comp_id, "label": comp_label},
        "applied": {"last": last} if last else {},
        # Sede, rival y descanso (T-03) todavía no recortan los tiros: se informa, no se calla.
        "ignored": [{"param": p, "reason": "no_aplica"} for p in ("venue", "opponent", "rest")
                    if request.args.get(p)],
    }

    return jsonify(result)


# ── Player search ────────────────────────────────────────────────────────────

@app.route("/api/search/players")
@login_required
def search_players():
    """Todos los jugadores de la base con sus promedios, para el buscador.

    Una entrada por ficha de jugador (C-08). Tasas promediadas excluyendo None
    (Feature 08); conteos incluyen 0. Filtrado y orden se hacen en el frontend; el filtro
    opcional `competition` recorta los partidos que alimentan los promedios.
    """
    try:
        comp_id = competitions.resolve(request.args.get("competition"))   # ausente = todas
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
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
        groups.setdefault(identity.group_key(pr), []).append(pr)
    display = {p.id: p.display_name for p in Player.query.all()}

    metric_keys = [
        "efg_pct", "ts_pct", "oer", "uso_pct", "ppp", "pps", "ppt",
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
    for rows in groups.values():
        team_code = rows[0].team_code
        per_game, comps, pm_vals, min_vals = [], set(), [], []
        # Grafía real de la ficha + posición determinista entre TODOS sus partidos (C-08 RF-4/RF-6)
        player_name, position = resolve_identity(rows)
        player_name = display.get(rows[0].player_id) or player_name
        if comp_id and not any(games.get(r.game_id) and games[r.game_id].competition_id == comp_id for r in rows):
            continue   # la ficha no tiene partidos en la competencia pedida
        for pr in rows:
            # La competencia sale de TODAS las fichas: estar convocado sin jugar
            # igual ubica al jugador en esa competencia.
            g = games.get(pr.game_id)
            if g and g.competition_id in labels:
                comps.add(labels[g.competition_id]["label"])

            # Filtro de competencia: solo los partidos de esa competencia alimentan los promedios
            if comp_id and not (g and g.competition_id == comp_id):
                continue
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
            "player_id":    rows[0].player_id,
            "player":       player_name,
            "team_code":    team_code,
            "team_name":    rows[-1].team_name,
            "competitions": sorted(comps),
            "competition_ids": sorted({games[r.game_id].competition_id for r in rows
                                       if r.game_id in games and games[r.game_id].competition_id}),
            "games":        len(per_game),   # partidos JUGADOS — Feature 12 RF-7
            "position":     position,
            "position_group": identity.position_group(position),
            "minutes":      round(sum(min_vals) / len(min_vals), 1) if min_vals else None,
            "plus_minus":   round(sum(pm_vals) / len(pm_vals), 1) if pm_vals else None,
        }
        for k in metric_keys:
            rec[k] = _avg_metric(k)
        for k in count_keys:
            rec[k] = _avg_count(k)
        # C-01: las 9 tasas por posesión / por minuto / de rebote individual, como cociente de totales
        rate_vals, rate_reasons = season_player_rates(sum_pool(per_game))
        rec.update(rate_vals)
        # AS/PER de temporada — mismo criterio acumulado (C-04 / Feature 15 RF-7)
        rec["ast_to"] = season_ast_to(sum(gm.get("ast", 0) or 0 for gm in per_game),
                                      sum(gm.get("tov", 0) or 0 for gm in per_game))
        stat_keys = metric_keys + count_keys + ["minutes", "plus_minus", "ast_to"]
        rec["null_reasons"] = null_reasons({k: rec[k] for k in stat_keys},
                                           played=bool(per_game), overrides=rate_reasons)   # C-11 RF-3
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


# ── Análisis de partido (F-07) ──────────────────────────────────────────────

@app.route("/api/game/<game_id>")
@login_required
def game_detail_route(game_id: str):
    base = request.args.get("base", "total")
    if base not in ("total", "partido", "por40", "por100"):
        return jsonify({"error": "Base de normalización inválida", "code": "parametro_invalido"}), 400
    result = game_analysis.game_detail(game_id, base)
    if result is None:
        return jsonify({"error": "Partido no encontrado", "code": "no_encontrado"}), 404
    return jsonify(result)


@app.route("/api/game/<game_id>/pbp")
@login_required
def game_pbp_route(game_id: str):
    game = Game.query.filter_by(game_id=game_id).first()
    if not game:
        return jsonify({"error": "Partido no encontrado", "code": "no_encontrado"}), 404
    events = game_analysis._load_events(game_id)
    if not events:
        return jsonify({"error": "Partido sin play-by-play. Reimportá el partido.",
                        "code": "sin_pbp"}), 404

    player_id = None
    raw_player = request.args.get("player")
    if raw_player:
        try:
            player_id = int(raw_player)
        except (ValueError, TypeError):
            return jsonify({"error": "Jugador inválido", "code": "parametro_invalido"}), 400

    types = None
    raw_type = request.args.get("type")
    if raw_type:
        types = [t.strip() for t in raw_type.split(",") if t.strip()]

    periods = None
    raw_period = request.args.get("period")
    if raw_period:
        periods = [p.strip() for p in raw_period.split(",") if p.strip()]

    try:
        result = game_analysis.game_pbp(
            game_id, events, game.home_code, game.away_code,
            player_id=player_id, types=types, periods=periods,
        )
    except ValueError as e:
        return jsonify({"error": str(e), "code": "parametro_invalido"}), 400
    return jsonify(result)


@app.route("/api/game/<game_id>/matchups")
@login_required
def game_matchups_route(game_id: str):
    game = Game.query.filter_by(game_id=game_id).first()
    if not game:
        return jsonify({"error": "Partido no encontrado", "code": "no_encontrado"}), 404
    events = PbpEvent.query.filter_by(game_id=game_id).first()
    if not events:
        return jsonify({"error": "Partido sin play-by-play: no se pueden calcular los cruces.",
                        "code": "sin_pbp"}), 404

    level = request.args.get("level", "quinteto")
    side = request.args.get("side", "home")

    try:
        result = matchups.game_matchups(game_id, level, side=side)
    except ValueError as e:
        return jsonify({"error": str(e), "code": "parametro_invalido"}), 400

    if result is None:
        return jsonify({"error": "No se pudieron calcular los cruces.", "code": "sin_pbp"}), 404
    return jsonify(result)


@app.route("/api/game/<game_id>/shots")
@login_required
def game_shots_route(game_id: str):
    team = request.args.get("team")
    if not team:
        return jsonify({"error": "Parámetro obligatorio: team", "code": "parametro_invalido"}), 400

    player_id = None
    raw_player = request.args.get("player")
    if raw_player:
        try:
            player_id = int(raw_player)
        except (ValueError, TypeError):
            return jsonify({"error": "Jugador inválido", "code": "parametro_invalido"}), 400

    quarters = None
    raw_q = request.args.get("quarter")
    if raw_q:
        quarters = [q.strip() for q in raw_q.split(",") if q.strip()]

    bands = None
    raw_c = request.args.get("clock")
    if raw_c:
        bands = [b.strip() for b in raw_c.split(",") if b.strip()]

    zone = request.args.get("zone")

    try:
        result = game_analysis.game_shots(
            game_id, team,
            player_id=player_id, quarters=quarters, bands=bands, zone=zone,
        )
    except ValueError as e:
        msg = str(e)
        code = "no_encontrado" if "no encontrado" in msg.lower() else "parametro_invalido"
        return jsonify({"error": msg, "code": code}), 404 if code == "no_encontrado" else 400
    return jsonify(result)


# ── Posesiones (A-01) ────────────────────────────────────────────────────────

@app.route("/api/game/<game_id>/possessions")
@login_required
def game_possessions_route(game_id: str):
    game = Game.query.filter_by(game_id=game_id).first()
    if not game:
        return jsonify({"error": "Partido no encontrado.", "code": "no_encontrado"}), 404
    events = PbpEvent.query.filter_by(game_id=game_id).first()
    if not events:
        return jsonify({"error": "Este partido no tiene play-by-play.", "code": "sin_pbp"}), 404

    team_filter = request.args.get("team")
    if team_filter and team_filter not in (game.home_code, game.away_code):
        return jsonify({"error": "Equipo inválido para este partido.", "code": "parametro_invalido"}), 400

    detail = request.args.get("detail") == "1"
    full = possessions._game_full(game_id)
    poss_list, outside_points, anomalies = full

    result_poss = poss_list
    if team_filter:
        result_poss = [p for p in poss_list if p.team == team_filter]

    rec = possessions.reconcile({"game_id": game_id})

    def _serialize_poss(p):
        d = {
            "poss_id": p.poss_id, "team": p.team, "opp": p.opp,
            "period": p.period, "period_type": p.period_type,
            "start_clock": p.start_clock, "end_clock": p.end_clock,
            "duration": p.duration,
            "start_event": p.start_event, "end_event": p.end_event,
            "origin": p.origin, "ptype": p.ptype,
            "chances": [{"n": c.n, "start_event": c.start_event,
                         "start_clock": c.start_clock, "shot_clock_start": c.shot_clock_start,
                         "end_event": c.end_event, "end_type": c.end_type,
                         "pts": c.pts, "outcome": c.outcome} for c in p.chances],
            "shots": p.shots,
            "end_type": p.end_type, "pts": p.pts,
            "own_on_court": p.own_on_court, "opp_on_court": p.opp_on_court,
            "lineup_changed": p.lineup_changed,
            "finisher_id": p.finisher_id, "assister_id": p.assister_id,
            "turnover_by_id": p.turnover_by_id,
            "incomplete": p.incomplete, "incomplete_reason": p.incomplete_reason,
        }
        if detail:
            d["event_numbers"] = p.event_numbers
            d["box"] = p.box
            d["opp_box"] = p.opp_box
            d["score_start"] = p.score_start
        return d

    return jsonify({
        "game_id": game_id,
        "teams": {"home": game.home_code, "away": game.away_code},
        "possessions": [_serialize_poss(p) for p in result_poss],
        "outside_points": outside_points,
        "reconcile": rec,
        "anomalies": [{"action_number": a.get("action_number"), "kind": a.get("kind"),
                       "detail": a.get("detail")} for a in anomalies],
    })


@app.route("/api/possessions/reconcile")
@login_required
def possessions_reconcile_route():
    comp_param = request.args.get("competition")
    if not comp_param or comp_param == "all":
        return jsonify({"error": "Elegí una competencia para conciliar.",
                        "code": "parametro_invalido"}), 400
    try:
        comp_id = int(comp_param)
    except (ValueError, TypeError):
        return jsonify({"error": "La competencia no existe.",
                        "code": "competencia_inexistente"}), 400

    from database import Competition
    comp = Competition.query.filter_by(id=comp_id).first()
    if not comp:
        return jsonify({"error": "La competencia no existe.",
                        "code": "competencia_inexistente"}), 400

    result = possessions.reconcile({"comp_id": comp_id})
    result["competition"] = {"id": comp.id, "label": competitions.label(comp)}
    return jsonify(result)


# ── Partido en vivo (F-01) ───────────────────────────────────────────────────

@app.route("/api/live/<game_id>")
@login_required
def live_route(game_id: str):
    return _live_response(live.live_snapshot, game_id)


@app.route("/api/live/<game_id>/momentum")
@login_required
def live_momentum_route(game_id: str):
    return _live_response(live.live_momentum, game_id)


def _live_response(fn, game_id: str):
    url = (request.args.get("url") or "").strip() or None
    if url and not live.valid_source_url(game_id, url):
        return jsonify({"error": "URL de FIBA LiveStats inválida para este partido.",
                        "code": "parametro_invalido"}), 400
    try:
        return jsonify(fn(game_id, url))
    except live.LiveNotFound:
        return jsonify({"error": "Partido no encontrado.", "code": "no_encontrado"}), 404
    except live.LiveFetchError:
        return jsonify({"error": "No se pudo obtener el partido en vivo.",
                        "code": "fiba_no_disponible"}), 502


# ── Preparar partido (F-03) ──────────────────────────────────────────────────

def _bad(msg, status=400, code="parametro_invalido"):
    return jsonify({"error": msg, "code": code}), status


@app.route("/api/prepare")
@login_required
def prepare_route():
    team = (request.args.get("team") or "").strip().upper()
    rival = (request.args.get("rival") or "").strip().upper()
    if not team:
        return _bad("Falta el equipo")
    if not rival:
        return _bad("Falta el rival")
    if team == rival:
        return _bad("El rival no puede ser el mismo equipo")
    try:
        last = context._parse_last(request.args.get("last"))
        comp = repository.resolve_competition(request.args.get("competition"), team_code=team)
    except ContextError as e:
        return _bad(str(e), e.status)
    except CompetitionError as e:
        return _bad(str(e), e.status)
    if comp["id"] is None:
        return _bad("Elegí una competencia para preparar el partido.")
    try:
        return jsonify(prepare.prepare_report(team, rival, comp["id"], last=last))
    except prepare.PrepareError as e:
        return _bad(e.message, e.status, e.code)


@app.route("/api/h2h")
@login_required
def h2h_route():
    a = (request.args.get("a") or "").strip().upper()
    b = (request.args.get("b") or "").strip().upper()
    if not a or not b:
        return _bad("Faltan los dos equipos")
    if a == b:
        return _bad("El rival no puede ser el mismo equipo")
    comp_id = None
    if request.args.get("competition"):
        try:
            comp_id = competitions.resolve(request.args.get("competition"))
        except CompetitionError as e:
            return _bad(str(e), e.status)
    return jsonify(prepare.head_to_head(a, b, comp_id))


# ── Lineups / ON-OFF / Clutch (motor de quintetos + cierres) ─────────────────

def _team_game_ids(team_code: str, comp_id: int | None = None) -> set[str]:
    """Partidos visibles del equipo, opcionalmente de una sola competencia."""
    q = _visible(TeamGameStats.query.filter_by(team_code=team_code), TeamGameStats)
    if comp_id:
        q = q.filter(TeamGameStats.game_id.in_(
            db.session.query(Game.game_id).filter_by(competition_id=comp_id)))
    return {tr.game_id for tr in q.all()}


def _team_pbp_games(team_code: str, comp_id: int | None = None) -> list[dict]:
    """Partidos del equipo con pbp: [{game_id, events, player_rows, opp_code}, ...].

    Base compartida por Feature 03 (lineups), Feature 04 (on/off) y cierres.
    """
    games = []
    for gid in _team_game_ids(team_code, comp_id):
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

    pids = []
    for name in players:
        pid = _resolve_legacy_player(team_code, name)
        if pid is None:
            return jsonify({"error": f"Jugador no encontrado: {name}"}), 400
        if pid not in pids:
            pids.append(pid)
    if len(pids) < 3:   # dos nombres de la misma ficha cuentan una sola vez
        return jsonify({"error": "Elegí entre 3 y 5 jugadores"}), 400

    games = _team_pbp_games(team_code)
    if not games:
        return jsonify({"error": "Equipo no encontrado o sin play-by-play"}), 404

    names = [db.session.get(Player, pid).display_name for pid in pids]
    result = lineups.lineup_stats(identity.canonicalize_pbp_games(games, team_code), team_code, names)
    result.update({"team_code": team_code, "players": names, "size": len(names)})
    return jsonify(result)


@app.route("/api/onoff/<team_code>/<player_name>")
@login_required
def onoff_route(team_code: str, player_name: str):
    """Rendimiento del equipo con un jugador en cancha (ON) vs en el banco (OFF) (Feature 04)."""
    team_code = team_code.upper()
    games = _team_pbp_games(team_code)
    if not games:
        return jsonify({"error": "Equipo no encontrado o sin play-by-play"}), 404

    pid = _resolve_legacy_player(team_code, player_name)
    player_rows = (_visible(PlayerGameStats.query.filter_by(player_id=pid), PlayerGameStats).all()
                   if pid is not None else [])
    if not player_rows:
        return jsonify({"error": "Sin datos ON/OFF para este jugador"}), 404

    display_name = db.session.get(Player, pid).display_name
    result = lineups.onoff_stats(identity.canonicalize_pbp_games(games, team_code), team_code, display_name)

    uso_vals = []
    for pr in player_rows:
        p = _to_dict(pr)
        p.setdefault("trb", p["orb"] + p["drb"])
        team_row = TeamGameStats.query.filter_by(game_id=pr.game_id, team_code=team_code).first()
        t_dict = _to_dict(team_row) if team_row else None
        adv = calc_player_stats(p, team_pos=0, team=t_dict)
        if adv.get("uso_pct") is not None:
            uso_vals.append(adv["uso_pct"])
    result["usg_pct"] = round(sum(uso_vals) / len(uso_vals), 4) if uso_vals else None
    result["team_code"] = team_code
    result["player"] = display_name
    result["player_id"] = pid
    return jsonify(result)


@app.route("/api/clutch/<team_code>")
@login_required
def clutch_team(team_code: str):
    """Cierre del equipo: agregado ("mini-partido") + desglose por partido (Feature 05 v2).

    Solo cuentan los cierres con diferencia ≤ `margin` al entrar a la ventana. Sin
    `?margin`/`?window_secs` usa los defaults de clutch.py (C-06). `?competition=<id>`
    limita el universo. Ver sdd/specs/05-clutch/spec.md §10.
    """
    team_code = team_code.upper()
    try:
        margin = _int_arg("margin", *MARGIN_RANGE)
        window_secs = _int_arg("window_secs", *WINDOW_RANGE)
        comp_id = competitions.resolve(request.args.get("competition"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status

    row = (_visible(TeamGameStats.query.filter_by(team_code=team_code), TeamGameStats)
           .join(Game, Game.game_id == TeamGameStats.game_id)
           .order_by(Game.date.desc(), Game.game_id.desc()).first())   # nombre más reciente
    if not row:
        return jsonify({"error": "Equipo no encontrado"}), 404
    game_ids = _team_game_ids(team_code, comp_id)
    if not game_ids:
        return jsonify({"error": "El equipo no tiene partidos en la competencia seleccionada."}), 404

    games = _team_pbp_games(team_code, comp_id)
    if not games:
        return jsonify({"error": "Equipo sin play-by-play. Reimportá sus partidos."}), 404

    result = team_clutch(games, team_code, row.team_name, margin, window_secs,
                         games_without_pbp=len(game_ids) - len(games))
    comp = competitions.get(comp_id) if comp_id else None
    result["competition"] = {"id": comp.id, "label": competitions.label(comp)} if comp else None
    return jsonify(result)


def _int_arg(name: str, lo: int, hi: int) -> int | None:
    """Query param entero opcional en [lo, hi]. Ausente → None; inválido → ValueError."""
    raw = request.args.get(name)
    if raw is None or raw == "":
        return None
    try:
        value = int(raw)
    except ValueError:
        value = None
    if value is None or not lo <= value <= hi:
        raise ValueError(f"El parámetro {name} debe ser un número entero entre {lo} y {hi}.")
    return value


# ── League ─────────────────────────────────────────────────────────────────

@app.route("/api/competitions")
@login_required
def list_competitions():
    """Competencias (F-11). Sin parámetros, solo las publicadas (selectores); con
    `include_hidden=1` también las en borrador (sección Datos). `is_default` marca la competencia por
    defecto (C-02)."""
    include_hidden = request.args.get("include_hidden") in ("1", "true")
    default_id = repository.resolve_competition(None)["id"]   # la que se usa sin parámetro ni entidad
    return jsonify(competitions.list_competitions(include_hidden, default_id))


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


# ── Identidad de jugador (C-08) ─────────────────────────────────────────────

@app.route("/api/identity/merge", methods=["POST"])
@admin_required
def identity_merge():
    """Une dos fichas del mismo equipo: `target_id` absorbe a `source_id`."""
    body = request.get_json(silent=True) or {}
    t, s = body.get("target_id"), body.get("source_id")
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in (t, s)):
        return jsonify({"error": "Indicá target_id y source_id enteros"}), 400
    try:
        result = identity.merge_players(t, s)
        db.session.commit()
    except identity.IdentityError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), e.status
    cache.bump_data_version("identity.merge_players")   # invalida poblaciones memorizadas (T-A2)
    return jsonify(result)


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


_LEAGUE_METRIC_KEYS = ("oer", "der", "net_rating", "efg_pct", "ts_pct",
                       "or_pct", "dr_pct", "to_pct", "pace", "pts", "stl")


@app.route("/api/league")
@login_required
def league_overview():
    """Tabla de Liga (T-01 plan §3.3/§4.5): las filas conservan sus claves (C-09) pero los valores
    `oer…stl` salen de la POBLACIÓN de equipos (cociente de totales, por partido en `pts`/`stl`),
    y cada fila agrega `in_population`, `rank` y `pct`. `include=summary` agrega `avg`, `leaders`
    y `population`. Sin `include`, lista (sin cambio de forma)."""
    codes    = db.session.query(TeamGameStats.team_code).distinct().all()
    games_by_id = {g.game_id: g for g in Game.query.all()}
    # orden cronológico: rows[-1] es el partido más reciente de cada equipo
    all_rows = sorted(_visible(TeamGameStats.query, TeamGameStats).all(),
                      key=lambda r: ((games_by_id[r.game_id].date or "") if r.game_id in games_by_id else "", r.game_id))

    # Competencia (id; acepta el texto de FIBA por compatibilidad): ausente = la competencia por
    # defecto (la del partido más reciente, RF-12); `all` = todas. Evita mezclar competencias.
    try:
        comp_id = repository.resolve_competition(request.args.get("competition"))["id"]
    except CompetitionError as e:
        return jsonify({"error": str(e)}), e.status
    if comp_id:
        comp_gids = {g.game_id for g in Game.query.filter_by(competition_id=comp_id).all()}
        all_rows = [r for r in all_rows if r.game_id in comp_gids]

    ctx = context.Context(comp_id, comp_id is None, None)
    pop = population.population("team", comp_id, ctx)
    members_by_id = {m.id: m for m in pop.members}

    result = []
    for (code,) in codes:
        rows = [r for r in all_rows if r.team_code == code]
        if not rows:
            continue  # equipo sin partidos en la competencia filtrada
        name = rows[-1].team_name
        member = members_by_id.get(code)

        row_out = {
            "team_code":  code,
            "team_name":  name,
            **standings_row([(r.pts, r.opp_pts) for r in rows],
                           win_points=config.get("standings.win_points"),
                           loss_points=config.get("standings.loss_points")),
            "in_population": bool(member and member.in_population),
        }
        rank_cell, pct_cell = {}, {}
        for k in _LEAGUE_METRIC_KEYS:
            v = member.values.get(k) if member else None
            row_out[k] = v
            mdef = metrics_catalog.METRICS[k]
            in_members = [m for m in pop.members if m.in_population and m.values.get(k) is not None]
            if v is None or len(in_members) < config.get("population.min_size"):
                rank_cell[k] = None
                pct_cell[k] = None
                continue
            others = [m.values[k] for m in in_members if m.id != code]
            r_, tied = population.rank(v, others, mdef.direction)
            rank_cell[k] = {"rank": r_, "total": len(in_members), "tied": tied}
            pct_cell[k] = population.percentile(v, others, mdef.direction)
        row_out["rank"] = rank_cell
        row_out["pct"] = pct_cell
        result.append(row_out)

    # Posición en la tabla general (C-09): el orden y el desempate se deciden acá.
    tiebreak = config.get("standings.tiebreak")
    for pos, row in enumerate(sorted(result, key=lambda r: standings_sort_key(r, tiebreak)), start=1):
        row["standings_pos"] = pos

    # Orden null-safe (Feature 12 RF-1): por oer descendente con nulos al final.
    result.sort(key=lambda x: (x["oer"] is None, -(x["oer"] or 0)))

    if request.args.get("include") != "summary":
        return jsonify(result)

    avg = population.league_reference("team", comp_id, ctx)
    avg = {k: avg.get(k) for k in _LEAGUE_METRIC_KEYS}
    leaders = {}
    in_members = [m for m in pop.members if m.in_population]
    for k in _LEAGUE_METRIC_KEYS:
        ldr = population._leader([m for m in in_members if m.values.get(k) is not None],
                                 k, metrics_catalog.METRICS[k].direction)
        leaders[k] = ({"id": ldr.id, "name": ldr.name, "value": ldr.values[k]} if ldr else None)
    return jsonify({
        "teams": result,
        "avg": avg,
        "leaders": leaders,
        "population": {"size": pop.size, "criterion": pop.criterion,
                       "context_label": pop.context_label, "reason": pop.reason},
    })


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
    if games:
        cache.bump_data_version("delete_games")   # invalida poblaciones memorizadas (T-A2)

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


# ── Configuración (F-13) ──────────────────────────────────────────────────

@app.route("/api/settings")
@login_required
def get_settings():
    return jsonify(config.payload())


@app.route("/api/settings", methods=["PUT"])
@admin_required
def put_settings():
    body = request.get_json(silent=True) or {}
    values = body.get("values")
    if not values or not isinstance(values, dict):
        return jsonify({"error": "No hay valores para guardar", "code": "parametro_invalido"}), 400
    try:
        result = config.set_values(values)
    except config.ConfigError as e:
        code = "parametro_invalido"
        for v in e.errors.values():
            if "habilita con" in str(v) or "desconocida" in str(v).lower():
                code = "clave_no_disponible"
                break
        return jsonify({"error": "Hay valores inválidos", "code": code, "details": e.errors}), 400
    return jsonify(result)


@app.route("/api/settings/reset", methods=["POST"])
@admin_required
def reset_settings():
    body = request.get_json(silent=True) or {}
    keys = body.get("keys")
    section = body.get("section")
    if not keys and not section:
        return jsonify({"error": "Indicá claves o una sección", "code": "parametro_invalido"}), 400
    try:
        if section:
            result = config.reset_section(section)
        else:
            result = config.reset(keys)
    except config.ConfigError as e:
        return jsonify({"error": "Hay valores inválidos", "code": "clave_no_disponible", "details": e.errors}), 400
    return jsonify(result)


@app.route("/api/settings/calibrate", methods=["POST"])
@login_required
def calibrate_settings():
    """Calibración de K por correlación de mitades (T-02 plan §3): `{entity, competition}` →
    shape de `sample.calibrate_k`. 401 sin sesión (`login_required`); 403 `requiere_admin` si el
    usuario no es administrador (código estable para el frontend, a diferencia del 403 genérico
    de `admin_required`)."""
    if not is_admin():
        return jsonify({"error": "Necesitás permisos de administrador", "code": "requiere_admin"}), 403

    body = request.get_json(silent=True) or {}
    entity = body.get("entity")
    if entity not in ("lineup", "onoff"):
        return jsonify({"error": "Calibración no disponible para esta entidad",
                        "code": "parametro_invalido"}), 400

    competition = body.get("competition")
    if competition in (None, "", "all"):
        return jsonify({"error": "Elegí una competencia", "code": "competencia_inexistente"}), 400
    try:
        comp_id = int(competition)
    except (TypeError, ValueError):
        return jsonify({"error": "Elegí una competencia", "code": "competencia_inexistente"}), 400
    from database import Competition
    if db.session.get(Competition, comp_id) is None:
        return jsonify({"error": "Elegí una competencia", "code": "competencia_inexistente"}), 400

    import sample
    try:
        result = sample.calibrate_k(entity, comp_id)
    except ValueError:
        return jsonify({"error": "Calibración no disponible para esta entidad",
                        "code": "parametro_invalido"}), 400
    return jsonify(result)


@app.route("/api/prefs")
@login_required
def get_prefs():
    scope = request.args.get("scope", "")
    try:
        values = prefs.get_prefs(scope)
    except ValueError as e:
        return jsonify({"error": str(e), "code": "parametro_invalido"}), 400
    return jsonify({"scope": scope, "values": values})


@app.route("/api/prefs", methods=["PUT"])
@login_required
def put_pref():
    body = request.get_json(silent=True) or {}
    scope = body.get("scope", "")
    key = body.get("key", "")
    value = body.get("value")
    try:
        prefs.set_pref(scope, key, value)
    except ValueError as e:
        return jsonify({"error": str(e), "code": "parametro_invalido"}), 400
    return jsonify({"scope": scope, "key": key, "value": value})


@app.route("/api/prefs", methods=["DELETE"])
@login_required
def delete_pref():
    body = request.get_json(silent=True) or {}
    scope = body.get("scope", "")
    key = body.get("key", "")
    try:
        deleted = prefs.delete_pref(scope, key)
    except ValueError as e:
        return jsonify({"error": str(e), "code": "parametro_invalido"}), 400
    return jsonify({"scope": scope, "key": key, "deleted": deleted})


# ── PWA ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
