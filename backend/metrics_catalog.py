"""
Catálogo estándar de métricas (T-05, Grupo C): metadatos puros, sin fórmulas.

`stats_engine.compute_standard` es el único lugar con las 83 fórmulas; este módulo solo
describe cada clave (etiqueta, formato, dirección, agrupación, cómo escala con la base) y
orquesta la petición HTTP (`build_payload`) delegando en los cargadores de cada tipo de
entidad (`register_entity`, Grupo C: bundles.py/lineups.py/clutch.py).

Plan §4.1/§4.2/§4.5/§4.8.
"""
from dataclasses import dataclass, field
from typing import Callable

import stats_engine
from stats_engine import StatBundle, compute_standard, apply_base, sum_bundles

CATALOG_VERSION = 1


@dataclass(frozen=True)
class MetricDef:
    """Metadatos de una clave del catálogo (plan §3.5/§4.2). Sin fórmula: la fórmula vive en
    `stats_engine.compute_standard`."""
    key: str
    label: str
    group: str
    fmt: str                      # int | dec1 | dec2 | pct | signed_int | signed_dec2
    direction: str                # higher | lower | neutral
    kind: str                     # count | rate | volume
    base_mode: str                # count | volume | fixed
    per100_den: str | None = None
    source: str | None = None
    entities: tuple = ("team", "player", "lineup", "onoff", "clutch")
    rel_dist: bool = True
    legacy_keys: tuple = ()


# ── Grupos (orden de presentación, plan §4.2) ────────────────────────────────

GROUPS = [
    {"key": "volumen", "label": "Volumen",
     "metrics": ["games", "minutes", "possessions", "pace", "sec_per_poss"]},
    {"key": "produccion", "label": "Producción",
     "metrics": ["pts", "pts_against", "ppp", "oer", "der", "net_rating", "plus_minus"]},
    {"key": "tiro_volumen", "label": "Tiro — intentos y aciertos",
     "metrics": ["fga2", "fgm2", "fga3", "fgm3", "fta", "ftm", "fga", "fgm"]},
    {"key": "tiro_pct", "label": "Tiro — porcentajes",
     "metrics": ["fg_pct", "fg2_pct", "fg3_pct", "ft_pct", "efg_pct", "ts_pct"]},
    {"key": "tiro_valor", "label": "Tiro — valor",
     "metrics": ["ppt", "ppt_2", "ppt_3", "ppt_ft"]},
    {"key": "tiro_perfil", "label": "Tiro — perfil",
     "metrics": ["fg3_uso", "fg2_uso", "ft_rate", "paint_fga_share", "mid_fga_share"]},
    {"key": "balon", "label": "Balón",
     "metrics": ["ast", "tov", "ast_to", "as_pos", "as_pct", "to_pct"]},
    {"key": "rebote", "label": "Rebote",
     "metrics": ["orb", "drb", "trb", "or_pct", "dr_pct", "trb_pct", "orb_pos", "drb_min", "orb_min"]},
    {"key": "defensa", "label": "Defensa",
     "metrics": ["stl", "blk", "blk_received", "stops"]},
    {"key": "faltas", "label": "Faltas",
     "metrics": ["pf", "fouls_drawn"]},
    {"key": "uso", "label": "Uso",
     "metrics": ["uso_pct", "uso_2p", "uso_3p"]},
    {"key": "extra", "label": "Otras métricas",
     "metrics": [
         "plays", "pps", "ft_rate_report", "peso_1p", "peso_2p", "peso_3p",
         "to_ratio", "ast_ratio", "opp_efg_pct", "opp_ts_pct", "opp_to_pct", "opp_ft_rate",
         "def_playmaking", "def_to_ratio", "physical_impact", "tov_pos",
         "reb_share", "oreb_share", "dreb_share",
         "paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts",
     ]},
]

_ALL_ENTITIES = ("team", "player", "lineup", "onoff", "clutch")
_PLAYER_ONLY = ("player",)
_TEAM_ONLY = ("team",)


def _md(key, label, group, fmt, direction, kind, base_mode, *, entities=_ALL_ENTITIES,
        rel_dist=True, legacy_keys=()) -> MetricDef:
    return MetricDef(key=key, label=label, group=group, fmt=fmt, direction=direction,
                     kind=kind, base_mode=base_mode, entities=entities,
                     rel_dist=rel_dist, legacy_keys=legacy_keys)


_DEFS = [
    # ── volumen ──
    _md("games", "Partidos", "volumen", "int", "neutral", "count", "fixed", rel_dist=False),
    _md("minutes", "Minutos", "volumen", "dec1", "neutral", "volume", "volume"),
    _md("possessions", "Posesiones", "volumen", "dec1", "neutral", "volume", "volume"),
    _md("pace", "PACE", "volumen", "dec1", "neutral", "rate", "fixed"),
    _md("sec_per_poss", "Seg/posesión", "volumen", "dec1", "neutral", "rate", "fixed"),

    # ── produccion ──
    _md("pts", "PTS", "produccion", "int", "higher", "count", "count", legacy_keys=("pts_for",)),
    _md("pts_against", "PTS recibidos", "produccion", "int", "lower", "count", "count"),
    _md("ppp", "PPP", "produccion", "dec2", "higher", "rate", "fixed"),
    _md("oer", "OER", "produccion", "dec2", "higher", "rate", "fixed",
        legacy_keys=("off_rating", "pts_pos")),
    _md("der", "DER", "produccion", "dec2", "lower", "rate", "fixed", legacy_keys=("def_rating",)),
    _md("net_rating", "Net Rating", "produccion", "signed_dec2", "higher", "rate", "fixed", rel_dist=False),
    _md("plus_minus", "+/-", "produccion", "signed_int", "higher", "count", "count", rel_dist=False,
        legacy_keys=("point_diff",)),

    # ── tiro_volumen ──
    _md("fga2", "T2i", "tiro_volumen", "int", "neutral", "count", "count"),
    _md("fgm2", "T2c", "tiro_volumen", "int", "higher", "count", "count"),
    _md("fga3", "T3i", "tiro_volumen", "int", "neutral", "count", "count"),
    _md("fgm3", "T3c", "tiro_volumen", "int", "higher", "count", "count"),
    _md("fta", "TLi", "tiro_volumen", "int", "neutral", "count", "count"),
    _md("ftm", "TLc", "tiro_volumen", "int", "higher", "count", "count"),
    _md("fga", "TCi", "tiro_volumen", "int", "neutral", "count", "count"),
    _md("fgm", "TCc", "tiro_volumen", "int", "higher", "count", "count"),

    # ── tiro_pct ──
    _md("fg_pct", "FG%", "tiro_pct", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("fg2_pct", "FG2%", "tiro_pct", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("fg3_pct", "FG3%", "tiro_pct", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("ft_pct", "FT%", "tiro_pct", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("efg_pct", "eFG%", "tiro_pct", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("ts_pct", "TS%", "tiro_pct", "pct", "higher", "rate", "fixed", rel_dist=False),

    # ── tiro_valor ──
    _md("ppt", "PPT", "tiro_valor", "dec2", "higher", "rate", "fixed", legacy_keys=("pps",)),
    _md("ppt_2", "PPT 2", "tiro_valor", "dec2", "higher", "rate", "fixed"),
    _md("ppt_3", "PPT 3", "tiro_valor", "dec2", "higher", "rate", "fixed"),
    _md("ppt_ft", "PPT TL", "tiro_valor", "dec2", "higher", "rate", "fixed"),

    # ── tiro_perfil ──
    _md("fg3_uso", "Uso de triple", "tiro_perfil", "pct", "neutral", "rate", "fixed", rel_dist=False),
    _md("fg2_uso", "Uso de 2", "tiro_perfil", "pct", "neutral", "rate", "fixed", rel_dist=False),
    _md("ft_rate", "FT Rate", "tiro_perfil", "dec2", "higher", "rate", "fixed"),
    _md("paint_fga_share", "% tiros en pintura", "tiro_perfil", "pct", "neutral", "rate", "fixed",
        rel_dist=False),
    _md("mid_fga_share", "% tiros de media distancia", "tiro_perfil", "pct", "neutral", "rate", "fixed",
        rel_dist=False),

    # ── balon ──
    _md("ast", "AS", "balon", "int", "higher", "count", "count"),
    _md("tov", "PER", "balon", "int", "lower", "count", "count"),
    _md("ast_to", "AS/PER", "balon", "dec2", "higher", "rate", "fixed"),
    _md("as_pos", "AS/pos", "balon", "dec2", "higher", "rate", "fixed"),
    _md("as_pct", "AS%", "balon", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("to_pct", "TO%", "balon", "pct", "lower", "rate", "fixed", rel_dist=False),

    # ── rebote ──
    _md("orb", "RO", "rebote", "int", "higher", "count", "count"),
    _md("drb", "RD", "rebote", "int", "higher", "count", "count"),
    _md("trb", "REB", "rebote", "int", "higher", "count", "count", legacy_keys=("reb",)),
    _md("or_pct", "OR%", "rebote", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("dr_pct", "DR%", "rebote", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("trb_pct", "REB%", "rebote", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("orb_pos", "RO/pos", "rebote", "dec2", "higher", "rate", "fixed"),
    _md("drb_min", "RD/min", "rebote", "dec2", "higher", "rate", "fixed"),
    _md("orb_min", "RO/min", "rebote", "dec2", "higher", "rate", "fixed"),

    # ── defensa ──
    _md("stl", "Robos", "defensa", "int", "higher", "count", "count"),
    _md("blk", "Tapones", "defensa", "int", "higher", "count", "count"),
    _md("blk_received", "Tapones recibidos", "defensa", "int", "lower", "count", "count"),
    _md("stops", "Stops", "defensa", "int", "higher", "count", "count", legacy_keys=("stocks",)),

    # ── faltas ──
    _md("pf", "Faltas cometidas", "faltas", "int", "lower", "count", "count",
        legacy_keys=("fouls_committed",)),
    _md("fouls_drawn", "Faltas recibidas", "faltas", "int", "higher", "count", "count"),

    # ── uso (solo jugador) ──
    _md("uso_pct", "USO%", "uso", "pct", "neutral", "rate", "fixed", entities=_PLAYER_ONLY,
        rel_dist=False, legacy_keys=("usg_pct",)),
    _md("uso_2p", "USO 2P", "uso", "pct", "neutral", "rate", "fixed", entities=_PLAYER_ONLY,
        rel_dist=False),
    _md("uso_3p", "USO 3P", "uso", "pct", "neutral", "rate", "fixed", entities=_PLAYER_ONLY,
        rel_dist=False),

    # ── extra ──
    _md("plays", "Jugadas (TCi+0,44·TLi+PER)", "extra", "dec1", "neutral", "volume", "volume"),
    _md("pps", "PTS/TCi (legado)", "extra", "dec2", "higher", "rate", "fixed"),
    _md("ft_rate_report", "FTc/TCi", "extra", "dec2", "higher", "rate", "fixed"),
    _md("peso_1p", "Peso 1P", "extra", "pct", "neutral", "rate", "fixed", rel_dist=False),
    _md("peso_2p", "Peso 2P", "extra", "pct", "neutral", "rate", "fixed", rel_dist=False),
    _md("peso_3p", "Peso 3P", "extra", "pct", "neutral", "rate", "fixed", rel_dist=False),
    _md("to_ratio", "TO ratio", "extra", "pct", "lower", "rate", "fixed", rel_dist=False),
    _md("ast_ratio", "AST ratio", "extra", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("opp_efg_pct", "eFG% rival", "extra", "pct", "lower", "rate", "fixed", rel_dist=False),
    _md("opp_ts_pct", "TS% rival", "extra", "pct", "lower", "rate", "fixed", rel_dist=False),
    _md("opp_to_pct", "TO% rival", "extra", "pct", "higher", "rate", "fixed", rel_dist=False),
    _md("opp_ft_rate", "FT Rate rival", "extra", "dec2", "lower", "rate", "fixed"),
    _md("def_playmaking", "Def. playmaking", "extra", "int", "higher", "count", "count"),
    _md("def_to_ratio", "DEF/TO", "extra", "dec2", "higher", "rate", "fixed"),
    _md("physical_impact", "Impacto físico", "extra", "int", "higher", "count", "count"),
    _md("tov_pos", "PER/pos", "extra", "dec2", "lower", "rate", "fixed"),
    _md("reb_share", "% reb. del equipo", "extra", "pct", "higher", "rate", "fixed",
        entities=_PLAYER_ONLY, rel_dist=False),
    _md("oreb_share", "% reb. of. del equipo", "extra", "pct", "higher", "rate", "fixed",
        entities=_PLAYER_ONLY, rel_dist=False),
    _md("dreb_share", "% reb. def. del equipo", "extra", "pct", "higher", "rate", "fixed",
        entities=_PLAYER_ONLY, rel_dist=False),
    _md("paint_pts", "PtsEnPint", "extra", "int", "higher", "count", "count", entities=_TEAM_ONLY),
    _md("second_chance_pts", "Seg. oportunidad", "extra", "int", "higher", "count", "count",
        entities=_TEAM_ONLY),
    _md("pts_from_tov", "Pts tras pérdida", "extra", "int", "higher", "count", "count",
        entities=_TEAM_ONLY),
    _md("bench_pts", "Banca", "extra", "int", "higher", "count", "count", entities=_TEAM_ONLY),
    _md("fast_break_pts", "Contraataque", "extra", "int", "higher", "count", "count",
        entities=_TEAM_ONLY),
]

METRICS: dict[str, MetricDef] = {d.key: d for d in _DEFS}

# El conjunto de claves debe coincidir EXACTAMENTE con las 83 de stats_engine.compute_standard.
assert set(METRICS) == stats_engine.metrics_catalog_keys(), (
    "metrics_catalog.METRICS debe tener las mismas claves que stats_engine.metrics_catalog_keys()")
assert len(METRICS) == 83, f"Se esperaban 83 claves, hay {len(METRICS)}"
assert len(GROUPS) == 12, f"Se esperaban 12 grupos, hay {len(GROUPS)}"

_group_keys_seen: set = set()
for _g in GROUPS:
    for _k in _g["metrics"]:
        assert _k not in _group_keys_seen, f"clave {_k} aparece en más de un grupo"
        _group_keys_seen.add(_k)
assert _group_keys_seen == set(METRICS), "cada clave de METRICS debe estar en exactamente un grupo"


NULL_REASON_CODES = list(stats_engine.NULL_REASON_CODES)


class MetricsError(Exception):
    """Error de negocio del endpoint de métricas; `status` es el código HTTP, `code` el
    identificador estable que consume el frontend (plan §3.3)."""

    def __init__(self, message: str, status: int = 400, code: str = "parametro_invalido"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


@dataclass
class EntityRequest:
    entity_type: str
    entity_id: object
    comp_id: int | None
    ctx: object
    base: str
    params: dict = field(default_factory=dict)


@dataclass
class _Registration:
    loader: Callable
    game_loader: Callable | None = None
    enumerator: Callable | None = None


_REGISTRY: dict[str, _Registration] = {}


def register_entity(entity_type: str, loader: Callable, *, game_loader: Callable | None = None,
                    enumerator: Callable | None = None) -> None:
    """Inscribe el cargador de un tipo de entidad (`bundles.py`/`lineups.py`/`clutch.py` al
    importarse). `loader(req) -> list[StatBundle]`: 1 bundle (team/player/lineup/clutch) o 2
    (`[on, off]` para onoff); `[]` = entidad inexistente."""
    _REGISTRY[entity_type] = _Registration(loader=loader, game_loader=game_loader, enumerator=enumerator)


def _ui_metric_labels() -> dict:
    try:
        import config
        return config.get("ui.metric_labels") or {}
    except Exception:
        return {}


def catalog_json(lang: str = "es") -> dict:
    """Serializa `GROUPS`/`METRICS` (plan §3.2); aplica `ui.metric_labels` (F-13/RF-20) a la
    etiqueta cuando el admin la personalizó."""
    overrides = _ui_metric_labels()
    metrics = {}
    for key, mdef in METRICS.items():
        metrics[key] = {
            "label": overrides.get(key, mdef.label),
            "group": mdef.group,
            "fmt": mdef.fmt,
            "direction": mdef.direction,
            "kind": mdef.kind,
            "base_mode": mdef.base_mode,
            "per100_den": mdef.per100_den,
            "source": mdef.source,
            "entities": list(mdef.entities),
            "rel_dist": mdef.rel_dist,
            "legacy_keys": list(mdef.legacy_keys),
        }
    return {
        "version": CATALOG_VERSION,
        "groups": [{"key": g["key"], "label": g["label"], "metrics": list(g["metrics"])} for g in GROUPS],
        "metrics": metrics,
        "null_reasons": NULL_REASON_CODES,
    }


def standard_payload(bundle: "StatBundle", values: dict, *, context_echo: dict, base: str,
                     sample: dict | None = None, fichas: dict | None = None) -> dict:
    """Arma el payload de `GET /api/metrics/<entity_type>` (plan §4.8 paso 9): entidad, contexto,
    base, grupos y las 83 claves (las que falten en `values` → `no_aplica`). `fichas` (T-01) se
    fusiona en cada objeto de métrica."""
    values_completos = {}
    for key in METRICS:
        obj = values.get(key)
        if obj is None:
            obj = {"value": None, "reason": "no_aplica"}
        else:
            obj = dict(obj)
        if fichas and key in fichas:
            obj.update(fichas[key])
        values_completos[key] = obj

    entity = {
        "type": bundle.entity_type,
        "id": bundle.entity_id,
        "name": bundle.name,
        "team_code": (bundle.meta or {}).get("team_code"),
    }
    return {
        "entity": entity,
        "context": context_echo,
        "base": base,
        "sample": sample,
        "groups": [{"key": g["key"], "label": g["label"], "metrics": list(g["metrics"])} for g in GROUPS],
        "metrics": values_completos,
        "catalog_version": CATALOG_VERSION,
    }


_BASE_VALUES = ("total", "partido", "por40", "por100")


def _entity_id_kwargs(entity_type: str, raw_id: str) -> dict:
    """`team_code=`/`player_id=` para `context.parse_context` según el tipo de entidad."""
    if entity_type == "team":
        return {"team_code": raw_id.upper()}
    if entity_type == "player":
        try:
            return {"player_id": int(raw_id)}
        except (TypeError, ValueError):
            return {}
    if entity_type in ("lineup", "onoff"):
        team_code = raw_id.split(":", 1)[0] if ":" in raw_id else raw_id
        return {"team_code": team_code.upper()}
    if entity_type == "clutch":
        return {"team_code": raw_id.upper()}
    return {}


def build_payload(entity_type: str, args) -> dict:
    """Orquestación de `GET /api/metrics/<entity_type>` y del bloque `standard` de `/api/team` y
    `/api/player` (plan §4.8, 10 pasos)."""
    reg = _REGISTRY.get(entity_type)
    if reg is None:
        raise MetricsError("Tipo de entidad desconocido", 400, "parametro_invalido")

    entity_id = args.get("id")
    if not entity_id:
        raise MetricsError("Falta el parámetro id", 400, "parametro_invalido")

    base = args.get("base") or "partido"
    if base not in _BASE_VALUES:
        raise MetricsError("La base debe ser total o partido", 400, "parametro_invalido")

    import context as context_mod
    from competitions import CompetitionError

    try:
        ctx = context_mod.parse_context(args, **_entity_id_kwargs(entity_type, str(entity_id)))
    except context_mod.ContextError as e:
        # `context.parse_context` envuelve tanto `CompetitionError` (competencia inexistente o en
        # borrador) como su propio `ContextError` (p. ej. `last` inválido) en `ContextError`; se
        # distingue por el mensaje para mapear al código de plan §3.3.
        msg = str(e)
        code = "competencia_inexistente" if "competencia" in msg.lower() else "contexto_invalido"
        raise MetricsError(msg, e.status, code) from e
    except CompetitionError as e:
        raise MetricsError(str(e), e.status, "competencia_inexistente") from e

    params = {}
    if entity_type == "clutch":
        margin = args.get("margin")
        window_secs = args.get("window_secs")
        if margin not in (None, ""):
            params["margin"] = int(margin)
        if window_secs not in (None, ""):
            params["window_secs"] = int(window_secs)

    req = EntityRequest(entity_type=entity_type, entity_id=entity_id, comp_id=ctx.competition_id,
                        ctx=ctx, base=base, params=params)

    bundles = reg.loader(req)
    if not bundles:
        raise MetricsError("Entidad no encontrada", 404, "no_encontrado")

    def _values_for(bundle):
        values = compute_standard(bundle)
        try:
            values = apply_base(values, bundle, base)
        except ValueError as e:
            raise MetricsError(str(e), 400, "parametro_invalido") from e
        return values

    b0 = bundles[0]
    values0 = _values_for(b0)

    meta0 = b0.meta or {}
    competition_label = meta0.get("team_name") and None  # placeholder: la etiqueta real viene de ctx
    comp_label = _competition_label(ctx)
    echo = context_mod.context_echo(
        ctx, games_used=b0.games, games_total=meta0.get("games_total", b0.games),
        games_excluded=meta0.get("games_excluded", {}), ignored=[],
        competition_label=comp_label)

    sample = None
    if b0.possessions_counted is not None:
        sample = {"possessions": b0.possessions_counted}

    payload = standard_payload(b0, values0, context_echo=echo, base=base, sample=sample, fichas=None)

    if entity_type == "onoff":
        if len(bundles) < 2:
            raise MetricsError("Sin play-by-play para esta selección. Reimportá sus partidos.",
                               404, "sin_pbp")
        on_bundle, off_bundle = bundles[0], bundles[1]
        on_values = values0
        off_values = _values_for(off_bundle)
        payload["states"] = {
            "on": {"seconds": on_bundle.seconds, "metrics": on_values},
            "off": {"seconds": off_bundle.seconds, "metrics": off_values},
        }
        diff = {}
        for key, mdef in METRICS.items():
            if mdef.kind != "rate":
                continue
            a, b = on_values.get(key, {}).get("value"), off_values.get(key, {}).get("value")
            if a is not None and b is not None:
                diff[key] = round(a - b, 4)
        payload["diff"] = diff

    if entity_type == "player":
        oc = b0.on_court or {}
        payload["coverage"] = {
            "games": b0.games,
            "on_court_games_exact": oc.get("games_exact", 0),
            "on_court_games_estimated": oc.get("games_estimated", 0),
        }

    return payload


def _competition_label(ctx) -> str | None:
    import repository
    if ctx.competition_id is None:
        return None
    return repository.competition_labels().get(ctx.competition_id)


def load_game_bundles(req: "EntityRequest") -> list:
    """`[(dict, StatBundle), ...]` por partido (T-06). `MetricsError(400)` si el tipo de entidad
    no tiene `game_loader` registrado."""
    reg = _REGISTRY.get(req.entity_type)
    if reg is None or reg.game_loader is None:
        raise MetricsError("Sin detalle por partido para este tipo de entidad", 400, "parametro_invalido")
    return reg.game_loader(req)
