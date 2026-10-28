"""Configuración global de la app — F-13.

Catálogo único de claves (CONFIG_SPEC). Solo los overrides se persisten en `app_config`;
una clave sin fila vale su default. Lectura cacheada por request (flask.g).
"""
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from flask import g, session
from database import db, AppConfig

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class ConfigKey:
    key: str
    type: str
    default: Any
    min: float | None = None
    max: float | None = None
    choices: tuple | None = None
    dynamic_choices: str | None = None
    unit: str | None = None
    label: str = ""
    help: str = ""
    section: str = "preferencias"
    consumer: str = ""
    status: str = "reservada"


SECTIONS = [
    ("umbrales", "Umbrales de muestra"),
    ("contexto", "Reglas de contexto"),
    ("momentum", "Reglas de Momentum"),
    ("preferencias", "Preferencias"),
]

def _k(key, **kw):
    return ConfigKey(key=key, **kw)

CONFIG_SPEC: dict[str, ConfigKey] = {}

def _register(*keys):
    for k in keys:
        CONFIG_SPEC[k.key] = k

_register(
    # ── Contexto (activas) ──
    _k("clutch.margin", type="int", default=10, min=0, max=40,
       unit="puntos", label="Diferencia máxima de partido cerrado",
       help="Un partido cuenta como cierre si la diferencia al inicio de la ventana es menor o igual a este valor.",
       section="contexto", consumer="C-06, F-06, A-06", status="activa"),
    _k("context.close_margin", type="int", default=10, min=1, max=40,
       unit="puntos", label="Diferencia de marcador ajustado",
       help="En el filtro de situación de marcador, un evento es «ajustado» si la diferencia antes del evento es menor o igual a este valor; si es mayor, es «paliza».",
       section="contexto", consumer="T-03", status="activa"),
    _k("clutch.window_secs", type="int", default=300, min=60, max=600,
       unit="segundos", label="Ventana de cierre",
       help="Segundos finales del último período regular que definen la ventana de cierre.",
       section="contexto", consumer="C-06, F-04, F-06", status="activa"),

    # ── Preferencias (activas) ──
    _k("standings.win_points", type="int", default=2, min=0, max=5,
       unit="puntos", label="Puntos por partido ganado",
       help="Puntos que suma un equipo en la tabla general por cada partido ganado.",
       section="preferencias", consumer="C-09", status="activa"),
    _k("standings.loss_points", type="int", default=1, min=0, max=5,
       unit="puntos", label="Puntos por partido perdido",
       help="Puntos que suma un equipo en la tabla general por cada partido perdido.",
       section="preferencias", consumer="C-09", status="activa"),
    _k("standings.tiebreak", type="enum", default="diferencia",
       choices=("diferencia", "ninguno"),
       label="Criterio de desempate", help="Con 'diferencia', a igual puntaje ordena por PF − PC descendente.",
       section="preferencias", consumer="C-09", status="activa"),
    _k("ui.default_competition_id", type="int_or_null", default=None,
       dynamic_choices="competitions",
       label="Competencia por defecto",
       help="Competencia que se usa cuando no se indica una explícitamente. 'Automática' usa la más reciente.",
       section="preferencias", consumer="F-11, T-03", status="activa"),

    # ── Umbrales (T-02: activas) ──
    _k("sample.lineup.min", type="int", default=15, min=1, max=500,
       unit="posesiones", label="Muestra mínima de quinteto",
       help="Posesiones mínimas para mostrar un quinteto.", section="umbrales", consumer="T-02",
       status="activa"),
    _k("sample.lineup.high", type="int", default=40, min=1, max=2000,
       unit="posesiones", label="Muestra alta de quinteto",
       help="Posesiones para considerar muestra alta en quinteto.", section="umbrales", consumer="T-02",
       status="activa"),
    _k("sample.lineup.rel_pct", type="float_or_null", default=1.5, min=0, max=20,
       label="Umbral relativo de quinteto", section="umbrales", consumer="T-02", status="activa"),
    _k("sample.pair.min", type="int", default=30, min=1, max=500,
       unit="posesiones", label="Muestra mínima de dupla", section="umbrales", consumer="T-02",
       status="activa"),
    _k("sample.pair.high", type="int", default=80, min=1, max=2000,
       unit="posesiones", label="Muestra alta de dupla", section="umbrales", consumer="T-02",
       status="activa"),
    _k("sample.pair.rel_pct", type="float_or_null", default=None, min=0, max=20,
       label="Umbral relativo de dupla", section="umbrales", consumer="T-02"),
    _k("sample.onoff.min", type="int", default=40, min=1, max=500,
       unit="posesiones", label="Muestra mínima ON/OFF", section="umbrales", consumer="T-02, F-06",
       status="activa"),
    _k("sample.onoff.high", type="int", default=120, min=1, max=2000,
       unit="posesiones", label="Muestra alta ON/OFF", section="umbrales", consumer="T-02, F-06",
       status="activa"),
    _k("sample.onoff.rel_pct", type="float_or_null", default=None, min=0, max=20,
       label="Umbral relativo ON/OFF", section="umbrales", consumer="T-02"),
    _k("sample.matchup.min", type="int", default=8, min=1, max=500,
       unit="posesiones", label="Muestra mínima de matchup", section="umbrales", consumer="T-02, F-07",
       status="activa"),
    _k("sample.matchup.high", type="int", default=25, min=1, max=2000,
       unit="posesiones", label="Muestra alta de matchup", section="umbrales", consumer="T-02, F-07",
       status="activa"),
    _k("sample.matchup.rel_pct", type="float_or_null", default=None, min=0, max=20,
       label="Umbral relativo de matchup", section="umbrales", consumer="T-02"),
    _k("sample.split.min", type="int", default=15, min=1, max=500,
       unit="posesiones", label="Muestra mínima de split", section="umbrales", consumer="T-02, T-03",
       status="activa"),
    _k("sample.split.high", type="int", default=40, min=1, max=2000,
       unit="posesiones", label="Muestra alta de split", section="umbrales", consumer="T-02, T-03",
       status="activa"),
    _k("sample.split.rel_pct", type="float_or_null", default=None, min=0, max=20,
       label="Umbral relativo de split", section="umbrales", consumer="T-02"),
    _k("sample.clock_zone.min", type="int", default=10, min=1, max=500,
       unit="intentos", label="Muestra mínima de zona de reloj", section="umbrales", consumer="T-02, C-03",
       status="activa"),
    _k("sample.clock_zone.high", type="int", default=30, min=1, max=2000,
       unit="intentos", label="Muestra alta de zona de reloj", section="umbrales", consumer="T-02, C-03",
       status="activa"),
    _k("sample.clutch_lineup.min_poss", type="int", default=2, min=1, max=20,
       unit="posesiones", label="Posesiones mínimas de quinteto en cierre", section="umbrales",
       consumer="F-06", status="activa"),
    _k("sample.clutch_lineup.high_games", type="int", default=3, min=1, max=20,
       unit="partidos", label="Partidos muestra alta de quinteto en cierre", section="umbrales",
       consumer="F-06", status="activa"),
    _k("sample.player.min", type="int", default=60, min=1, max=5000,
       unit="minutos", label="Minutos mínimos de jugador", section="umbrales", consumer="T-01, T-02",
       status="activa"),
    _k("sample.player.high", type="int", default=200, min=1, max=10000,
       unit="minutos", label="Minutos muestra alta de jugador", section="umbrales", consumer="T-01, T-02",
       status="activa"),
    _k("sample.team.min", type="int", default=3, min=1, max=100,
       unit="partidos", label="Partidos mínimos de equipo", section="umbrales", consumer="T-01, T-02",
       status="activa"),
    _k("sample.team.high", type="int", default=10, min=1, max=200,
       unit="partidos", label="Partidos muestra alta de equipo", section="umbrales", consumer="T-01, T-02",
       status="activa"),
    _k("sample.relative_enabled", type="bool", default=True,
       label="Umbral relativo habilitado", section="umbrales", consumer="T-02", status="activa"),
    _k("sample.ppp_sd", type="float", default=1.15, min=0.5, max=2,
       label="Desviación estándar de PPP", section="umbrales", consumer="T-02", status="activa"),
    _k("sample.band_z", type="float", default=1.96, min=1, max=3,
       label="Z de banda de confianza", section="umbrales", consumer="T-02", status="activa"),
    _k("regression.lineup.k", type="int", default=25, min=0, max=500,
       label="K de regresión de quinteto", section="umbrales", consumer="T-02", status="activa"),
    _k("regression.onoff.k", type="int", default=50, min=0, max=500,
       label="K de regresión ON/OFF", section="umbrales", consumer="T-02", status="activa"),
    _k("regression.split.k", type="int", default=20, min=0, max=500,
       label="K de regresión de split", section="umbrales", consumer="T-02", status="activa"),
    _k("regression.pair.k", type="int", default=25, min=0, max=500,
       label="K de regresión de dupla", section="umbrales", consumer="T-02", status="activa"),
    _k("regression.matchup.k", type="int", default=25, min=0, max=500,
       label="K de regresión de matchup", section="umbrales", consumer="T-02", status="activa"),
    _k("regression.clutch_lineup.k", type="int", default=25, min=0, max=500,
       label="K de regresión de quinteto en cierre", section="umbrales", consumer="T-02",
       status="activa"),
    _k("population.min_size", type="int", default=3, min=2, max=20,
       unit="entidades", label="Tamaño mínimo de población", section="umbrales", consumer="T-01",
       status="activa"),

    # ── Contexto (activas — F-07) ──
    _k("game.run_min_points", type="int", default=8, min=4, max=20,
       unit="puntos", label="Puntos mínimos de racha destacada",
       help="Mínimo de puntos consecutivos de un equipo sin respuesta para destacar una racha en la línea de tiempo del partido.",
       section="contexto", consumer="F-07, F-01, F-02", status="activa"),

    # ── Contexto (reservadas) ──
    _k("context.close_margin", type="int", default=10, min=1, max=40,
       unit="puntos", label="Diferencia de partido cerrado (contexto)", section="contexto", consumer="T-03"),
    _k("transition.max_secs", type="int", default=7, min=3, max=12,
       unit="segundos", label="Transición: duración máxima", section="contexto", consumer="A-03", status="activa"),
    _k("early_offense.max_secs", type="int", default=12, min=8, max=20,
       unit="segundos", label="Ataque temprano: duración máxima", section="contexto", consumer="A-03", status="activa"),
    _k("oreb.putback_secs", type="int", default=3, min=1, max=6,
       unit="segundos", label="Segundo chance: ventana de putback", section="contexto", consumer="A-04", status="activa"),
    _k("oreb.kickout_secs", type="int", default=6, min=2, max=10,
       unit="segundos", label="Segundo chance: ventana de kickout", section="contexto", consumer="A-04", status="activa"),
    _k("clock.early_max", type="int", default=8, min=4, max=12,
       unit="segundos", label="Zona de reloj: early máximo", section="contexto", consumer="A-05", status="activa"),
    _k("clock.mid_max", type="int", default=16, min=10, max=20,
       unit="segundos", label="Zona de reloj: mid máximo", section="contexto", consumer="A-05", status="activa"),
    _k("clock.reset_secs", type="int", default=14, min=10, max=24,
       unit="segundos", label="Reset de reloj de posesión",
       help="Segundos de posesión tras rebote ofensivo (FIBA: 14).",
       section="contexto", consumer="A-01, A-05", status="activa"),

    # ── Momentum (F-02) ──
    _k("momentum.last_possessions", type="int", default=10, min=3, max=30,
       unit="posesiones", label="Últimas posesiones (PPP)", section="momentum", consumer="F-02",
       help="Cantidad de posesiones recientes de cada equipo para el PPP.", status="activa"),
    _k("momentum.window_secs", type="int", default=300, min=60, max=600,
       unit="segundos", label="Ventana de OER/DER/Net", section="momentum", consumer="F-02",
       help="Tiempo de juego reciente para OER, DER y Net Rating (300 = últimos 5 minutos).",
       status="activa"),
    _k("momentum.last_outcomes", type="int", default=5, min=3, max=10,
       unit="posesiones", label="Últimas posesiones con desenlace", section="momentum", consumer="F-02",
       status="activa"),
    _k("momentum.hot_consecutive_makes", type="int", default=3, min=2, max=10,
       unit="tiros", label="Caliente: conversiones de campo seguidas", section="momentum", consumer="F-02",
       status="activa"),
    _k("momentum.hot_points", type="int", default=8, min=3, max=30,
       unit="puntos", label="Caliente: puntos en la ventana corta", section="momentum", consumer="F-02",
       status="activa"),
    _k("momentum.hot_points_window_secs", type="int", default=180, min=60, max=600,
       unit="segundos", label="Caliente: ventana corta de puntos", section="momentum", consumer="F-02",
       status="activa"),
    _k("momentum.assist_streak", type="int", default=4, min=2, max=10,
       unit="asistencias", label="Caliente: canastas seguidas asistidas por el jugador", section="momentum",
       consumer="F-02", help="Una canasta del equipo sin asistencia o asistida por otro corta la racha.",
       status="activa"),
    _k("momentum.oreb_in_quarter", type="int", default=3, min=2, max=10,
       unit="rebotes", label="Caliente: rebotes ofensivos en el cuarto", section="momentum", consumer="F-02",
       status="activa"),
    _k("momentum.cold_consecutive_tov", type="int", default=3, min=2, max=10,
       unit="pérdidas", label="Alerta: pérdidas seguidas", section="momentum", consumer="F-02",
       help="Pérdidas del jugador sin canasta, asistencia ni rebote propio en el medio.", status="activa"),

    # ── Momentum (reservadas: catálogo de la arquitectura, sin consumidor todavía) ──
    _k("momentum.margin", type="int", default=10, min=1, max=40,
       unit="puntos", label="Diferencia máxima para momentum", section="momentum", consumer="F-02"),
    _k("momentum.run_pts", type="int", default=5, min=2, max=20,
       unit="puntos", label="Puntos mínimos de racha", section="momentum", consumer="F-02"),
    _k("momentum.run_max_opp", type="int", default=3, min=0, max=10,
       unit="puntos", label="Puntos máximos del rival en racha", section="momentum", consumer="F-02"),
    _k("momentum.swing_pts", type="int", default=8, min=3, max=30,
       unit="puntos", label="Puntos mínimos de swing", section="momentum", consumer="F-02"),
    _k("momentum.swing_window_secs", type="int", default=180, min=60, max=600,
       unit="segundos", label="Ventana de swing", section="momentum", consumer="F-02"),
    _k("momentum.drought_secs", type="int", default=4, min=1, max=10,
       unit="minutos", label="Sequía: minutos sin anotar", section="momentum", consumer="F-02"),
    _k("momentum.drought_min_opp", type="int", default=3, min=1, max=20,
       unit="puntos", label="Sequía: mínimo del rival", section="momentum", consumer="F-02"),
    _k("momentum.bonus_min", type="int", default=3, min=1, max=10,
       unit="partidos", label="Bonus: partidos mínimos", section="momentum", consumer="F-02"),

    # ── Preferencias (reservadas) ──
    _k("ui.default_base", type="enum", default="partido",
       choices=("total", "partido", "por40", "por100"),
       label="Base de normalización por defecto", section="preferencias", consumer="T-05, T-04",
       help="Base con la que arrancan las vistas si no se eligió otra en la sesión.", status="activa"),
    _k("ui.metric_labels", type="json", default={},
       label="Etiquetas personalizadas de métricas", section="preferencias", consumer="T-05",
       status="activa"),
    _k("table.page_size", type="int", default=50, min=10, max=500,
       label="Filas por página en tablas", section="preferencias", consumer="T-06", status="activa"),
    _k("export.csv_separator", type="enum", default=";", choices=(";", ","),
       label="Separador de CSV", section="preferencias", consumer="T-06", status="activa"),
    _k("live.poll_secs", type="int", default=30, min=10, max=60,
       unit="segundos", label="Intervalo de polling en vivo", section="preferencias", consumer="F-01",
       status="activa"),
    _k("live.cache_ttl_secs", type="int", default=15, min=5, max=60,
       unit="segundos", label="TTL de caché en vivo", section="preferencias", consumer="F-01",
       status="activa"),
    _k("live.fetch_timeout_secs", type="int", default=8, min=3, max=20,
       unit="segundos", label="Timeout de fetch en vivo", section="preferencias", consumer="F-01",
       status="activa"),
    _k("leaders.min_minutes", type="int", default=60, min=0, max=2000,
       unit="minutos", label="Minutos mínimos para líderes", section="preferencias", consumer="F-14"),
    _k("leaders.top_n", type="int", default=10, min=3, max=50,
       label="Top N de líderes", section="preferencias", consumer="F-14"),
    _k("gameplan.items_min", type="int", default=3, min=1, max=20,
       label="Mínimo de ítems de game plan", section="preferencias", consumer="F-17"),
    _k("gameplan.items_max", type="int", default=5, min=1, max=20,
       label="Máximo de ítems de game plan", section="preferencias", consumer="F-17"),
    _k("gameplan.min_z", type="float", default=0.5, min=0, max=3,
       label="Z mínimo de game plan", section="preferencias", consumer="F-17"),
    _k("insights.low_pct", type="int", default=10, min=1, max=49,
       label="Percentil bajo de insights", section="preferencias", consumer="A-10"),
    _k("insights.high_pct", type="int", default=90, min=51, max=99,
       label="Percentil alto de insights", section="preferencias", consumer="A-10"),
    _k("insights.min_items", type="int", default=3, min=1, max=20,
       label="Mínimo de insights", section="preferencias", consumer="A-10"),
    _k("insights.max_items", type="int", default=5, min=1, max=20,
       label="Máximo de insights", section="preferencias", consumer="A-10"),
    _k("alerts.lookback_days", type="int", default=7, min=1, max=90,
       unit="días", label="Días de lookback de alertas", section="preferencias", consumer="F-12"),
    _k("alerts.change_z", type="float", default=1.5, min=0.5, max=5,
       label="Z de cambio significativo", section="preferencias", consumer="F-12"),
    _k("trends.default_ma", type="int", default=5, min=2, max=20,
       label="Media móvil por defecto", section="preferencias", consumer="F-18"),
    _k("trends.last_n", type="int", default=5, min=1, max=50,
       label="Últimos N de tendencias", section="preferencias", consumer="F-18"),
    _k("similar.top_n", type="int", default=10, min=3, max=50,
       label="Top N de jugadores similares", section="preferencias", consumer="A-09"),
    _k("rapm.lambdas", type="json", default=[500, 1000, 2000, 4000, 8000],
       label="Lambdas de RAPM", section="umbrales", consumer="A-11"),
    _k("rapm.folds", type="int", default=5, min=2, max=10,
       label="Folds de cross-validation RAPM", section="umbrales", consumer="A-11"),
    _k("ai.suggestions_enabled", type="bool", default=True,
       label="Sugerencias de IA habilitadas", section="preferencias", consumer="F-15"),
    _k("ui.default_language", type="enum", default="es", choices=("es", "en", "pt"),
       label="Idioma por defecto", section="preferencias", consumer="F-21"),
)


COHERENCE_RULES = [
    ("sample.lineup.min", "<=", "sample.lineup.high"),
    ("sample.pair.min", "<=", "sample.pair.high"),
    ("sample.onoff.min", "<=", "sample.onoff.high"),
    ("sample.matchup.min", "<=", "sample.matchup.high"),
    ("sample.split.min", "<=", "sample.split.high"),
    ("sample.player.min", "<=", "sample.player.high"),
    ("sample.team.min", "<=", "sample.team.high"),
    ("clock.early_max", "<", "clock.mid_max"),
    ("transition.max_secs", "<", "early_offense.max_secs"),
    ("oreb.putback_secs", "<", "oreb.kickout_secs"),
    ("gameplan.items_min", "<=", "gameplan.items_max"),
    ("insights.min_items", "<=", "insights.max_items"),
    ("insights.low_pct", "<", "insights.high_pct"),
]


class ConfigError(Exception):
    def __init__(self, errors: dict):
        self.errors = errors
        super().__init__(str(errors))


def _load_overrides() -> dict:
    if not hasattr(g, "_config_overrides"):
        rows = db.session.execute(db.text("SELECT key, value FROM app_config")).fetchall()
        overrides = {}
        for key, raw in rows:
            if key not in CONFIG_SPEC:
                log.warning("Clave de config desconocida en DB: %s", key)
                continue
            try:
                overrides[key] = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                log.warning("Valor inválido en app_config para %s: %s", key, raw)
        g._config_overrides = overrides
    return g._config_overrides


def _invalidate_cache():
    g.pop("_config_overrides", None)


def get(key: str) -> Any:
    spec = CONFIG_SPEC.get(key)
    if spec is None:
        raise KeyError(f"Clave de configuración desconocida: {key}")
    overrides = _load_overrides()
    return overrides.get(key, spec.default)


def get_many(prefix: str) -> dict:
    return {k: get(k) for k in CONFIG_SPEC if k.startswith(prefix)}


def _validate_value(spec: ConfigKey, raw) -> tuple[Any, str | None]:
    t = spec.type

    if t == "int":
        if isinstance(raw, bool):
            return None, "Debe ser un número entero"
        try:
            v = int(raw)
        except (ValueError, TypeError):
            return None, "Debe ser un número entero"
        if spec.min is not None and v < spec.min:
            return None, f"Debe estar entre {int(spec.min)} y {int(spec.max)} {spec.unit or ''}".strip()
        if spec.max is not None and v > spec.max:
            return None, f"Debe estar entre {int(spec.min)} y {int(spec.max)} {spec.unit or ''}".strip()
        return v, None

    if t == "float":
        if isinstance(raw, bool):
            return None, "Debe ser un número"
        try:
            v = float(str(raw).replace(",", ".")) if isinstance(raw, str) else float(raw)
        except (ValueError, TypeError):
            return None, "Debe ser un número"
        if spec.min is not None and v < spec.min:
            return None, f"Debe estar entre {spec.min} y {spec.max}"
        if spec.max is not None and v > spec.max:
            return None, f"Debe estar entre {spec.min} y {spec.max}"
        return v, None

    if t in ("int_or_null", "float_or_null"):
        if raw is None or raw == "":
            return None, None
        base = "int" if t == "int_or_null" else "float"
        return _validate_value(ConfigKey(key=spec.key, type=base, default=spec.default,
                                         min=spec.min, max=spec.max), raw)

    if t == "bool":
        if isinstance(raw, bool):
            return raw, None
        if isinstance(raw, str):
            if raw.lower() == "true":
                return True, None
            if raw.lower() == "false":
                return False, None
        return None, "Debe ser true o false"

    if t == "enum":
        if raw in spec.choices:
            return raw, None
        return None, f"Valor no permitido. Opciones: {', '.join(str(c) for c in spec.choices)}"

    if t == "json":
        if isinstance(raw, (dict, list)):
            return raw, None
        if isinstance(raw, str):
            try:
                return json.loads(raw), None
            except json.JSONDecodeError:
                return None, "JSON inválido"
        return None, "Debe ser un objeto o lista JSON"

    return None, f"Tipo desconocido: {t}"


def _validate_dynamic(spec: ConfigKey, value) -> str | None:
    if spec.dynamic_choices == "competitions" and value is not None:
        from competitions import list_competitions
        comps = list_competitions()
        ids = {c["id"] for c in comps}
        if value not in ids:
            return "La competencia no existe"
    return None


def _current_user() -> str:
    from auth import auth_enabled
    if auth_enabled():
        return session.get("user", "_open")
    return "_open"


def set_values(values: dict) -> dict:
    errors = {}
    parsed = {}

    for k, raw in values.items():
        spec = CONFIG_SPEC.get(k)
        if spec is None:
            errors[k] = "Clave desconocida"
            continue
        if spec.status != "activa":
            errors[k] = f"Se habilita con {spec.consumer}"
            continue
        v, err = _validate_value(spec, raw)
        if err:
            errors[k] = err
            continue
        dyn_err = _validate_dynamic(spec, v)
        if dyn_err:
            errors[k] = dyn_err
            continue
        parsed[k] = v

    if not errors:
        effective = {k: get(k) for k in CONFIG_SPEC if CONFIG_SPEC[k].status == "activa"}
        effective.update(parsed)
        for a, op, b in COHERENCE_RULES:
            sa, sb = CONFIG_SPEC.get(a), CONFIG_SPEC.get(b)
            if not sa or not sb or sa.status != "activa" or sb.status != "activa":
                continue
            va, vb = effective.get(a), effective.get(b)
            if va is None or vb is None:
                continue
            if op == "<=" and va > vb:
                errors[a] = f"El mínimo no puede superar al máximo ({sa.label} <= {sb.label})"
            elif op == "<" and va >= vb:
                errors[a] = f"Debe ser menor que {sb.label}"

    if errors:
        raise ConfigError(errors)

    now = datetime.now(timezone.utc).isoformat()
    user = _current_user()

    for k, v in parsed.items():
        if v == CONFIG_SPEC[k].default:
            db.session.execute(db.text("DELETE FROM app_config WHERE key = :k"), {"k": k})
        else:
            existing = db.session.execute(
                db.text("SELECT key FROM app_config WHERE key = :k"), {"k": k}
            ).fetchone()
            if existing:
                db.session.execute(db.text(
                    "UPDATE app_config SET value = :v, updated_at = :t, updated_by = :u WHERE key = :k"
                ), {"k": k, "v": json.dumps(v), "t": now, "u": user})
            else:
                db.session.execute(db.text(
                    "INSERT INTO app_config (key, value, updated_at, updated_by) VALUES (:k, :v, :t, :u)"
                ), {"k": k, "v": json.dumps(v), "t": now, "u": user})
    db.session.commit()
    _invalidate_cache()
    _bump_config_version("set_values")
    return payload()


def _bump_config_version(reason: str) -> None:
    """Sube `config_version` del caché entre peticiones (T-01/T-A2): un cambio de configuración
    invalida las poblaciones memorizadas. Tolerante a que `cache.py` no esté disponible."""
    try:
        import cache
        cache.bump_config_version(reason)
    except Exception:
        log.exception("No se pudo subir config_version del caché")


def reset(keys: list[str]) -> dict:
    errors = {}
    for k in keys:
        spec = CONFIG_SPEC.get(k)
        if spec is None:
            errors[k] = "Clave desconocida"
        elif spec.status != "activa":
            errors[k] = f"Se habilita con {spec.consumer}"
    if errors:
        raise ConfigError(errors)

    if keys:
        placeholders = ", ".join(f":k{i}" for i in range(len(keys)))
        params = {f"k{i}": k for i, k in enumerate(keys)}
        db.session.execute(db.text(f"DELETE FROM app_config WHERE key IN ({placeholders})"), params)
        db.session.commit()
    _invalidate_cache()
    _bump_config_version("reset")
    return payload()


def reset_section(slug: str) -> dict:
    keys = [k for k, s in CONFIG_SPEC.items() if s.section == slug and s.status == "activa"]
    return reset(keys)


def spec_json() -> list[dict]:
    overrides = _load_overrides()
    override_meta = {}
    rows = db.session.execute(
        db.text("SELECT key, updated_at, updated_by FROM app_config")
    ).fetchall()
    for key, at, by in rows:
        override_meta[key] = (at, by)

    result = []
    for key, s in CONFIG_SPEC.items():
        entry = {
            "key": s.key, "type": s.type, "default": s.default,
            "min": s.min, "max": s.max,
            "choices": list(s.choices) if s.choices else None,
            "unit": s.unit, "label": s.label, "help": s.help,
            "section": s.section, "status": s.status, "consumer": s.consumer,
            "modified": key in overrides,
            "updated_at": override_meta.get(key, (None, None))[0],
            "updated_by": override_meta.get(key, (None, None))[1],
        }

        if s.dynamic_choices == "competitions":
            try:
                from competitions import list_competitions
                comps = list_competitions()
                entry["choices"] = [
                    {"value": None, "label": "Automática (la más reciente)"},
                ] + [{"value": c["id"], "label": c["label"]} for c in comps]
            except Exception:
                entry["choices"] = [{"value": None, "label": "Automática (la más reciente)"}]

        result.append(entry)
    return result


def payload() -> dict:
    from auth import is_admin
    values = {}
    for k, s in CONFIG_SPEC.items():
        if s.status == "activa":
            values[k] = get(k)
    return {
        "version": 0,
        "is_admin": is_admin(),
        "values": values,
        "sections": [{"slug": s, "label": l} for s, l in SECTIONS],
        "spec": spec_json(),
    }
