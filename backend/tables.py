"""
Registro de tablas y armado del payload de tabla completa (T-06, módulo NUEVO).

`register_table` inscribe cada tabla (una por apartado de datos agregados); `build_table`
arma, para un `table_id`, los `StatBundle` de cada fila con el *builder* registrado, calcula
el conjunto estándar (`stats_engine.compute_standard` + `apply_base`, T-05), agrega
percentiles (`population`, T-01), badge de muestra (`sample`, T-02), fila de totales
(`sum_bundles`) y promedio de competencia (`population.league_reference`), y devuelve todas
las filas en el formato compacto por columnas (Arq. §7.6, plan §3.1).

`export_xlsx.workbook_bytes` escribe el XLSX; `bulk_workbook` arma la exportación masiva.
Las rutas finas viven en `app.py`. Ver plan §4.1/§4.2/§4.5/§4.6.
"""
import datetime
import unicodedata
from dataclasses import dataclass, field
from typing import Callable, Mapping

import cache
import config
import context as context_mod
import metrics_catalog
import population as population_mod
import prefs
import stats_engine
from competitions import CompetitionError
from metrics_catalog import GROUPS, METRICS, EntityRequest, load_game_bundles
from stats_engine import StatBundle, apply_base, compute_standard, sum_bundles

# Versión de la app para la cabecera de exportación (plan §4.1 paso 15; se actualiza al
# integrar — NO se lee el service worker desde Python).
APP_VERSION = "smart-basket-v22"

_BASE_VALUES = ("total", "partido", "por40", "por100")
BASE_LABELS = {"total": "Total", "partido": "Por partido", "por40": "Por 40 minutos", "por100": "Por 100 posesiones"}


# ── Errores ───────────────────────────────────────────────────────────────────

class TableError(Exception):
    """Error de negocio de una tabla; `status` HTTP, `code` identificador estable (plan §3.1).

    `body` es el JSON de error `{"error", "code"[, "details"]}` que la ruta serializa."""

    def __init__(self, status: int, message: str, code: str, details: dict | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code
        self.details = details

    @property
    def body(self) -> dict:
        out = {"error": self.message, "code": self.code}
        if self.details:
            out["details"] = self.details
        return out


# ── Dataclasses ────────────────────────────────────────────────────────────────

@dataclass
class TableRequest:
    table_id: str
    params: dict
    comp_id: int | None
    ctx: object
    base: str


@dataclass
class TableDef:
    table_id: str
    entity_type: str
    title: str
    builder: Callable
    default_columns: tuple
    bulk_scopes: tuple = ()
    row_kind: str = "entity"              # entity | game
    required_params: tuple = ()
    extra_columns: tuple = ()             # (key, label, fmt) de columnas de texto/valor no catálogo
    default_sort: dict | None = None
    totals_mode: str = "sum"             # sum | none
    avg_mode: str = "population"          # population | none
    title_fn: Callable | None = None


@dataclass
class TableRow:
    """Fila intermedia de un builder (plan §4.1). `bundle is None` → fila sin métricas (DNP):
    todas las métricas salen nulas con `reason_if_null` (por defecto `dnp`)."""
    id: str
    link: str | None = None
    texts: dict = field(default_factory=dict)
    bundle: StatBundle | None = None
    extra: dict = field(default_factory=dict)
    sample: dict | None = None
    adj: dict | None = None
    reason_if_null: str = "dnp"


_REGISTRY: dict[str, TableDef] = {}


def register_table(table_id: str, *, entity_type: str, title: str, builder: Callable,
                   default_columns, bulk_scopes=(), **kwargs) -> None:
    """Inscribe una tabla (firma de Arq. §3.11 + kwargs PROPUESTA de plan §4.1)."""
    _REGISTRY[table_id] = TableDef(
        table_id=table_id, entity_type=entity_type, title=title, builder=builder,
        default_columns=tuple(default_columns), bulk_scopes=tuple(bulk_scopes),
        row_kind=kwargs.get("row_kind", "entity"),
        required_params=tuple(kwargs.get("required_params", ())),
        extra_columns=tuple(kwargs.get("extra_columns", ())),
        default_sort=kwargs.get("default_sort"),
        totals_mode=kwargs.get("totals_mode", "sum"),
        avg_mode=kwargs.get("avg_mode", "population"),
        title_fn=kwargs.get("title_fn"),
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _slug(s) -> str:
    """ASCII en minúsculas, sin tildes, `[^a-z0-9]+ → "-"`, recortado (plan §4.1)."""
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower()
    out = []
    prev_dash = False
    for ch in s:
        if "a" <= ch <= "z" or "0" <= ch <= "9":
            out.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                out.append("-")
            prev_dash = True
    return "".join(out).strip("-")


def _file_name(section, entity, comp_label, date) -> str:
    """`<apartado-slug>_<entidad>_<competencia-slug>_<AAAA-MM-DD>` (plan §4.1).

    `entity` ya viene en su forma final (código de equipo, `jugador-12-...` o `liga`) y no se
    vuelve a sluguear (conserva el código de equipo en mayúsculas)."""
    return f"{_slug(section)}_{entity}_{_slug(comp_label or 'todas')}_{date}"


def _filters_meta(echo: dict) -> list:
    """`context.applied` → `[{label, value}]` legibles (plan §4.1)."""
    out = []
    applied = (echo or {}).get("applied") or {}
    last = applied.get("last")
    if last:
        out.append({"label": "Período", "value": "Último partido" if last == 1 else f"Últimos {last}"})
    else:
        out.append({"label": "Período", "value": "Todos los partidos"})
    return out


# ── build_table ────────────────────────────────────────────────────────────────

def build_table(table_id: str, args: Mapping[str, str]) -> dict:
    """Payload de `GET /api/table/<table_id>` (plan §3.1 / §4.1, pasos 1-16)."""
    # 1. Tabla registrada
    tdef = _REGISTRY.get(table_id)
    if tdef is None:
        raise TableError(404, "Tabla inexistente", "no_encontrado")

    # 2. Parámetros obligatorios
    for p in tdef.required_params:
        if not (args.get(p) or "").strip():
            raise TableError(400, f"Parámetro inválido: falta {p}", "parametro_invalido",
                             {"param": p})

    # 3. Contexto
    id_kwargs = _id_kwargs(tdef, args)
    try:
        ctx = context_mod.parse_context(args, **id_kwargs)
    except context_mod.ContextError as e:
        msg = str(e)
        code = "competencia_inexistente" if "competencia" in msg.lower() else "contexto_invalido"
        raise TableError(e.status, msg, code) from e
    except CompetitionError as e:
        raise TableError(e.status, str(e), "competencia_inexistente") from e
    comp_id = ctx.competition_id

    # 4. Base
    base = (args.get("base") or config.get("ui.default_base") or "partido")
    if base not in _BASE_VALUES:
        raise TableError(400, "Base inválida", "parametro_invalido")

    treq = TableRequest(table_id=table_id, params=dict(args), comp_id=comp_id, ctx=ctx, base=base)

    # 5. Memo entre peticiones (namespace nuevo tables:<id>). `cache.memo` construye fuera del
    # lock y propaga las excepciones sin cachearlas, así un TableError del builder llega intacto.
    key = (table_id, tuple(sorted((k, str(v)) for k, v in args.items())))
    return cache.memo("tables:" + table_id, key, lambda: _compute(tdef, treq))


def _id_kwargs(tdef: TableDef, args: Mapping[str, str]) -> dict:
    """`team_code=`/`player_id=` para `parse_context` (default de competencia por entidad)."""
    if tdef.entity_type in ("team", "clutch"):
        tc = args.get("team")
        return {"team_code": tc.upper()} if tc else {}
    if tdef.entity_type == "player":
        raw = args.get("player_id")
        try:
            return {"player_id": int(raw)} if raw else {}
        except (TypeError, ValueError):
            return {}
    return {}


def _compute(tdef: TableDef, treq: TableRequest) -> dict:
    # 6. Filas del builder
    rows = tdef.builder(treq)

    entity_type = tdef.entity_type
    comp_id = treq.comp_id
    ctx = treq.ctx
    base = treq.base

    has_sample = entity_type in _SAMPLE_ENTITIES

    # 8. Columnas
    columns = _build_columns(tdef, has_sample)
    metric_cols = [c for c in columns if c["type"] == "metric"]

    # 10. Percentiles — preparar población / game-population
    pop = None
    game_pop = None
    if comp_id is not None:
        if tdef.row_kind == "entity":
            try:
                pop = population_mod.population(entity_type, comp_id, ctx)
            except Exception:
                pop = None
        else:
            game_pop = _game_population(entity_type, comp_id, ctx)

    min_pop = config.get("population.min_size")

    out_rows = []
    for row in rows:
        values_map, reasons = _row_values(row, base)
        pct_map = _row_percentiles(row, metric_cols, values_map, tdef, pop, game_pop, comp_id, min_pop)

        row_values = []
        row_pct = []
        for c in columns:
            if c["type"] == "text":
                row_values.append(row.texts.get(c["key"]))
                row_pct.append(None)
            elif c["key"] == "_sample":
                row_values.append(row.sample)
                row_pct.append(None)
            else:
                mobj = values_map.get(c["key"]) or {"value": None, "reason": "no_aplica"}
                row_values.append(mobj.get("value"))
                row_pct.append(pct_map.get(c["key"]))

        out_rows.append({
            "id": row.id,
            "link": row.link,
            "values": row_values,
            "pct": row_pct,
            "adj": row.adj,
            "reasons": reasons,
            "sample": row.sample,
        })

    # 13. Totales
    totals = _totals(tdef, rows, columns, base) if tdef.totals_mode == "sum" else None

    # 14. Promedio de competencia
    competition_avg = None
    if tdef.avg_mode == "population":
        competition_avg = _competition_avg(entity_type, comp_id, ctx, base, columns)

    # Eco de contexto
    comp_label = _competition_label(comp_id)
    echo = context_mod.context_echo(ctx, games_used=len(out_rows), games_total=len(out_rows),
                                    games_excluded={}, ignored=[], competition_label=comp_label)

    # 15. meta
    title = tdef.title_fn(treq) if tdef.title_fn else tdef.title
    meta = _meta(tdef, treq, title, echo, comp_label)

    return {
        "table_id": tdef.table_id,
        "title": title,
        "entity_type": entity_type,
        "row_kind": tdef.row_kind,
        "columns": columns,
        "rows": out_rows,
        "totals": totals,
        "competition_avg": competition_avg,
        "default_sort": tdef.default_sort,
        "row_count": len(out_rows),
        "context": echo,
        "base": base,
        "meta": meta,
    }


_SAMPLE_ENTITIES = frozenset({"player", "lineup", "onoff", "clutch"})


def _build_columns(tdef: TableDef, has_sample: bool) -> list:
    """`extra_columns` (texto) + `_sample` + todas las claves del catálogo del tipo (orden GROUPS),
    con `default_visible` (plan §4.1 paso 8)."""
    columns = []
    sticky_done = False
    for (key, label, fmt) in tdef.extra_columns:
        col = {"key": key, "label": label, "type": "text",
               "default_visible": key in tdef.default_columns}
        if not sticky_done:
            col["sticky"] = True
            sticky_done = True
        columns.append(col)

    if has_sample:
        columns.append({"key": "_sample", "label": "Muestra", "type": "sample",
                        "default_visible": True})

    for g in GROUPS:
        for key in g["metrics"]:
            mdef = METRICS[key]
            if tdef.entity_type not in mdef.entities:
                continue
            columns.append({"key": key, "type": "metric",
                            "default_visible": key in tdef.default_columns})
    return columns


def _row_values(row: TableRow, base: str) -> tuple:
    """`(values_map, reasons)` de una fila. `bundle is None` (DNP) → todas nulas con
    `row.reason_if_null`."""
    pre = (row.extra or {}).get("precomputed")
    if pre is not None:
        values_map = {k: (pre.get(k) or {"value": None, "reason": row.reason_if_null}) for k in METRICS}
        reasons = {k: v.get("reason") for k, v in values_map.items() if v.get("value") is None}
        return values_map, reasons

    if row.bundle is None:
        reason = row.reason_if_null
        values_map = {k: {"value": None, "reason": reason} for k in METRICS}
        return values_map, {k: reason for k in METRICS}

    values = compute_standard(row.bundle)
    try:
        values = apply_base(values, row.bundle, base)
    except ValueError as e:
        raise TableError(400, "Base inválida", "parametro_invalido") from e

    values_map = {}
    reasons = {}
    for k in METRICS:
        obj = values.get(k) or {"value": None, "reason": "no_aplica"}
        values_map[k] = obj
        if obj.get("value") is None:
            reasons[k] = obj.get("reason")
    return values_map, reasons


def _row_percentiles(row, metric_cols, values_map, tdef, pop, game_pop, comp_id, min_pop) -> dict:
    """`{key: pct|None}` por columna de métrica (plan §4.1 paso 10)."""
    out = {}
    if comp_id is None or row.bundle is None:
        return {c["key"]: None for c in metric_cols}

    for c in metric_cols:
        key = c["key"]
        mdef = METRICS[key]
        value = (values_map.get(key) or {}).get("value")
        if value is None or mdef.direction == "neutral":
            out[key] = None
            continue

        if tdef.row_kind == "entity":
            if pop is None:
                out[key] = None
                continue
            members = [m for m in pop.members
                       if m.in_population and m.values.get(key) is not None]
            if len(members) < min_pop:
                out[key] = None
                continue
            others = [m.values[key] for m in members if str(m.id) != str(row.id)]
            out[key] = population_mod.percentile(value, others, mdef.direction)
        else:  # game
            others_all = (game_pop or {}).get(key, [])
            # excluir una aparición del propio valor (percentil sin la propia fila)
            others = list(others_all)
            try:
                others.remove(value)
            except ValueError:
                pass
            if not others:
                out[key] = None
            else:
                out[key] = population_mod.percentile(value, others, mdef.direction)
    return out


def _game_population(entity_type: str, comp_id: int, ctx) -> dict:
    """`{key: [valores por partido-entidad no nulos]}` de toda la competencia en el contexto
    (plan §4.2). Una pasada por competencia, cacheada en `tables:gamepop`."""
    key = (entity_type, comp_id, context_mod.context_key(ctx))

    def build():
        values_by_key: dict = {k: [] for k in METRICS}
        if entity_type == "team":
            import repository
            codes = sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()})
            for code in codes:
                req = EntityRequest(entity_type="team", entity_id=code, comp_id=comp_id,
                                    ctx=ctx, base="partido")
                _accumulate_game_values(req, values_by_key)
        elif entity_type == "player":
            pop = population_mod.population("player", comp_id, ctx)
            for m in pop.members:
                if not m.in_population:
                    continue
                req = EntityRequest(entity_type="player", entity_id=m.id, comp_id=comp_id,
                                    ctx=ctx, base="partido")
                _accumulate_game_values(req, values_by_key)
        elif entity_type == "clutch":
            import repository
            codes = sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()})
            for code in codes:
                req = EntityRequest(entity_type="clutch", entity_id=code, comp_id=comp_id,
                                    ctx=ctx, base="partido")
                _accumulate_game_values(req, values_by_key)
        return values_by_key

    return cache.memo("tables:gamepop", key, build)


def _accumulate_game_values(req: EntityRequest, values_by_key: dict) -> None:
    try:
        per_game = load_game_bundles(req)
    except Exception:
        return
    for _info, bundle in per_game:
        if bundle is None:
            continue
        values = compute_standard(bundle)
        for k in METRICS:
            v = (values.get(k) or {}).get("value")
            if v is not None:
                values_by_key[k].append(v)


def _totals(tdef, rows, columns, base) -> dict | None:
    """Fila de totales: `sum_bundles` de los bundles no nulos → `compute_standard` → `apply_base`
    (plan §4.1 paso 13). Textos: `Total`/récord `G-P` en game logs."""
    bundles = [r.bundle for r in rows if r.bundle is not None]
    values_map = {}
    if bundles:
        tb = sum_bundles(bundles)
        values = compute_standard(tb)
        try:
            values = apply_base(values, tb, base)
        except ValueError:
            pass
        values_map = values

    texts = _totals_texts(tdef, rows)
    reasons = {}
    out_values = []
    for c in columns:
        if c["type"] == "text":
            out_values.append(texts.get(c["key"]))
        elif c["key"] == "_sample":
            out_values.append(None)
        else:
            obj = values_map.get(c["key"]) or {"value": None, "reason": "sin_datos"}
            out_values.append(obj.get("value"))
            if obj.get("value") is None:
                reasons[c["key"]] = obj.get("reason")
    return {"label": "Total", "values": out_values, "reasons": reasons}


def _totals_texts(tdef, rows) -> dict:
    """Textos de la fila de totales: `Total` en la primera columna fija; récord `G-P` en
    `_result` cuando es un game log (plan §4.1 paso 13)."""
    texts = {}
    first_text = next((c for c in tdef.extra_columns), None)
    if first_text:
        texts[first_text[0]] = "Total"
    if tdef.row_kind == "game" and any(c[0] == "_result" for c in tdef.extra_columns):
        wins = losses = 0
        for r in rows:
            if r.bundle is None:
                continue
            tp = r.extra.get("team_pts")
            op = r.extra.get("opp_pts")
            if tp is None or op is None:
                continue
            if tp > op:
                wins += 1
            else:
                losses += 1
        texts["_result"] = f"{wins}-{losses}"
    return texts


def _competition_avg(entity_type, comp_id, ctx, base, columns) -> dict:
    """Fila de promedio de competencia (plan §4.1 paso 14)."""
    if comp_id is None:
        values_map = {}
        reason_default = "sin_universo"
    else:
        try:
            ref = population_mod.league_reference(entity_type, comp_id, ctx, base=base)
        except Exception:
            ref = {}
        values_map = {k: {"value": ref.get(k), "reason": None if ref.get(k) is not None else "sin_datos"}
                      for k in METRICS}
        reason_default = "sin_datos"

    reasons = {}
    out_values = []
    for i, c in enumerate(columns):
        if c["type"] == "text":
            out_values.append("Promedio competencia" if i == 0 else None)
        elif c["key"] == "_sample":
            out_values.append(None)
        else:
            obj = values_map.get(c["key"]) or {"value": None, "reason": reason_default}
            out_values.append(obj.get("value"))
            if obj.get("value") is None:
                reasons[c["key"]] = obj.get("reason") or reason_default
    return {"label": "Promedio competencia", "values": out_values, "reasons": reasons}


def _competition_label(comp_id):
    if comp_id is None:
        return None
    try:
        import repository
        return repository.competition_labels().get(comp_id)
    except Exception:
        return None


def _meta(tdef, treq, title, echo, comp_label) -> dict:
    """Metadatos de exportación (Arq. §7.7, plan §4.1 paso 15)."""
    today = datetime.date.today().isoformat()
    generated_at = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    entity_id, entity_name, file_entity = _meta_entity(tdef, treq)
    season = None
    if treq.comp_id is not None:
        try:
            from database import db, Competition
            c = db.session.get(Competition, treq.comp_id)
            season = c.season if c else None
        except Exception:
            season = None
    return {
        "title": title,
        "section": _slug(title),
        "entity": {"type": tdef.entity_type, "id": entity_id, "name": entity_name},
        "competition": {"id": treq.comp_id, "label": comp_label, "season": season},
        "filters": _filters_meta(echo),
        "base": {"key": treq.base, "label": BASE_LABELS[treq.base]},
        "sort": None,
        "columns_visible": None,
        "generated_at": generated_at,
        "generated_by": prefs.current_owner(),
        "app_version": APP_VERSION,
        "file_name": _file_name(_section_slug(tdef), file_entity, comp_label, today),
    }


def _section_slug(tdef) -> str:
    return _slug(tdef.title.split("—")[0])


def _meta_entity(tdef, treq) -> tuple:
    """`(id, name, file_entity)` para meta y nombre de archivo."""
    et = tdef.entity_type
    if et in ("lineup", "onoff") and treq.params.get("team"):
        code = treq.params["team"].upper()
        return code, code, code      # quintetos y ON/OFF son de UN equipo (F-06)
    if et in ("team", "clutch"):
        code = (treq.params.get("team") or "").upper()
        return code, code, code or "liga"
    if et == "player":
        raw = treq.params.get("player_id")
        if raw:
            import identity
            try:
                card = identity.player_card(int(raw))
            except (TypeError, ValueError):
                card = None
            if card:
                return (card["player_id"], card["display_name"],
                        f"jugador-{card['player_id']}-{_slug(card['display_name'])}")
            return raw, str(raw), f"jugador-{raw}"
    return None, "Liga", "liga"


# ── bulk_workbook (T-B11) ──────────────────────────────────────────────────────

def bulk_workbook(scope: str, scope_id: str, comp_id: int) -> bytes:
    """XLSX multi-hoja: una hoja por tabla con `scope` en `bulk_scopes`, columnas completas,
    footer de totales y promedio, tablas sin filas anotadas en la Portada (plan §4.5). 404 si
    todas vacías."""
    import export_xlsx

    base = config.get("ui.default_base") or "partido"
    tdefs = [t for t in _REGISTRY.values() if scope in t.bulk_scopes]

    comp_label = _competition_label(comp_id)
    scope_label = scope_id.upper() if scope == "team" else (comp_label or "competencia")

    sheets = []
    empty = []
    for t in tdefs:
        args = {"competition": str(comp_id), "base": base}
        if scope == "team":
            args["team"] = scope_id.upper()
            args["player_id"] = ""  # no aplica
        try:
            payload = build_table(t.table_id, args)
        except TableError:
            empty.append(_bulk_sheet_name(t))
            continue
        if not payload["rows"]:
            empty.append(_bulk_sheet_name(t))
            continue
        sheets.append(_payload_to_sheet(payload, _bulk_sheet_name(t)))

    if not sheets:
        raise TableError(404, "No hay datos para exportar en esta selección.", "no_encontrado")

    today = datetime.date.today().isoformat()
    entity = scope_id.upper() if scope == "team" else "competencia"
    meta = {
        "title": f"Exportación completa — {scope_label}",
        "entity": {"type": scope, "id": scope_id, "name": scope_label},
        "competition": {"id": comp_id, "label": comp_label},
        "filters": [{"label": "Base", "value": BASE_LABELS[base]}],
        "base": {"key": base, "label": BASE_LABELS[base]},
        "generated_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "generated_by": prefs.current_owner(),
        "app_version": APP_VERSION,
        "file_name": f"exportacion_{entity}_{_slug(comp_label or 'todas')}_{today}",
        "empty_tables": empty,
    }
    return export_xlsx.workbook_bytes(sheets, meta)


_BULK_SHEET_NAMES = {
    "team_game_log": "Partido a partido",
    "clutch_games": "Cierres por partido",
    "search_players": "Jugadores",
    "league_teams": "Ranking de Liga",
    "league_standings": "Tabla general",
}


def _bulk_sheet_name(tdef: TableDef) -> str:
    """Nombre de la hoja en la exportación masiva (plan §4.5 / T-B11)."""
    return _BULK_SHEET_NAMES.get(tdef.table_id, tdef.title.split("—")[0].strip())


def _payload_to_sheet(payload: dict, sheet_name: str) -> dict:
    """Convierte un payload de `build_table` en una hoja de `export_xlsx.workbook_bytes`
    (todas las columnas, footer = totales + promedio)."""
    columns = []
    for c in payload["columns"]:
        if c["type"] == "metric":
            mdef = METRICS[c["key"]]
            columns.append({"key": c["key"], "label": mdef.label, "fmt": mdef.fmt})
        elif c["key"] == "_sample":
            columns.append({"key": "_sample", "label": c.get("label", "Muestra"), "fmt": "text"})
        else:
            columns.append({"key": c["key"], "label": c.get("label", c["key"]), "fmt": "text"})

    rows = []
    for r in payload["rows"]:
        rows.append([_cell_for_sheet(col, v) for col, v in zip(payload["columns"], r["values"])])

    footer = []
    if payload.get("totals"):
        footer.append([_cell_for_sheet(col, v)
                       for col, v in zip(payload["columns"], payload["totals"]["values"])])
    if payload.get("competition_avg"):
        footer.append([_cell_for_sheet(col, v)
                       for col, v in zip(payload["columns"], payload["competition_avg"]["values"])])

    return {"name": sheet_name[:31] or payload["table_id"], "columns": columns,
            "rows": rows, "footer": footer}


def _cell_for_sheet(col, value):
    """Celda de hoja: el badge de muestra se serializa como su nivel (texto)."""
    if col.get("key") == "_sample":
        if isinstance(value, dict):
            return value.get("level")
        return None
    return value


# ── Builders (plan §4.2) ───────────────────────────────────────────────────────

def _team_season_rows(comp_id, ctx) -> list:
    """`[(code, name, StatBundle, [(pts, opp_pts), ...]), ...]` por equipo de la competencia."""
    import repository
    rows = repository.team_game_rows(comp_id)
    codes = sorted({r["team_code"] for r in rows.values()})
    out = []
    for code in codes:
        req = EntityRequest(entity_type="team", entity_id=code, comp_id=comp_id, ctx=ctx,
                            base="partido")
        per_game = load_game_bundles(req)
        per_game = [(i, b) for i, b in per_game if b is not None]
        if not per_game:
            continue
        name = per_game[-1][1].name
        bundle = sum_bundles([b for _, b in per_game])
        results = [(i["team_pts"], i["opp_pts"]) for i, _ in per_game]
        out.append((code, name, bundle, results))
    return out


def _build_league_teams(treq: TableRequest) -> list:
    rows = _team_season_rows(treq.comp_id, treq.ctx)
    out = []
    for code, name, bundle, _results in rows:
        out.append(TableRow(id=code, link=f"team:{code}", texts={"_name": name}, bundle=bundle))
    return out


def _build_league_standings(treq: TableRequest) -> list:
    if treq.comp_id is None:
        # "Todas" / varias competencias → 400 (C-09 / D-11)
        raise TableError(400, "Elegí una competencia para ver la tabla general.", "parametro_invalido")

    win_points = config.get("standings.win_points")
    loss_points = config.get("standings.loss_points")
    tiebreak = config.get("standings.tiebreak")

    rows = _team_season_rows(treq.comp_id, treq.ctx)
    enriched = []
    for code, name, bundle, results in rows:
        srow = stats_engine.standings_row(results, win_points, loss_points)
        enriched.append((code, name, bundle, srow))

    enriched.sort(key=lambda t: stats_engine.standings_sort_key(t[3], tiebreak))
    out = []
    for pos, (code, name, bundle, srow) in enumerate(enriched, start=1):
        texts = {
            "_pos": str(pos),
            "_name": name,
            "_wins": srow["wins"],
            "_losses": srow["losses"],
            "_table_points": srow["table_points"],
            "_pts_for": srow["pts_for"],
            "_pts_against": srow["pts_against"],
        }
        out.append(TableRow(id=code, link=f"team:{code}", texts=texts, bundle=bundle))
    return out


def _venue_result_texts(info) -> dict:
    """Textos `_date`/`_opponent`/`_venue`/`_result` de un partido."""
    tp, op = info.get("team_pts"), info.get("opp_pts")
    if tp is None or op is None:
        result = "—"
    else:
        result = f"{'G' if tp > op else 'P'} {tp}-{op}"
    return {
        "_date": info.get("date"),
        "_opponent": info.get("opponent"),
        "_venue": info.get("home_away"),
        "_result": result,
    }


def _build_team_game_log(treq: TableRequest) -> list:
    code = (treq.params.get("team") or "").upper()
    req = EntityRequest(entity_type="team", entity_id=code, comp_id=treq.comp_id, ctx=treq.ctx,
                        base=treq.base)
    per_game = load_game_bundles(req)
    if not per_game:
        raise TableError(404, "Equipo no encontrado", "no_encontrado")
    # orden cronológico descendente (default_sort lo re-aplica el cliente)
    per_game = sorted(per_game, key=lambda t: (t[0].get("date") or "", t[0]["game_id"]), reverse=True)
    out = []
    for info, bundle in per_game:
        texts = _venue_result_texts(info)
        out.append(TableRow(id=str(info["game_id"]), link=None, texts=texts, bundle=bundle,
                            extra={"team_pts": info.get("team_pts"), "opp_pts": info.get("opp_pts")}))
    return out


def _build_player_game_log(treq: TableRequest) -> list:
    raw = treq.params.get("player_id")
    try:
        pid = int(raw)
    except (TypeError, ValueError):
        raise TableError(400, "Parámetro inválido: player_id", "parametro_invalido",
                         {"param": "player_id"})
    req = EntityRequest(entity_type="player", entity_id=pid, comp_id=treq.comp_id, ctx=treq.ctx,
                        base=treq.base)
    per_game = load_game_bundles(req)
    if not per_game:
        raise TableError(404, "Jugador no encontrado", "no_encontrado")
    per_game = sorted(per_game, key=lambda t: (t[0].get("date") or "", t[0]["game_id"]), reverse=True)
    out = []
    for info, bundle in per_game:
        texts = {
            "_date": info.get("date"),
            "_opponent": info.get("opponent"),
        }
        row = TableRow(id=str(info["game_id"]), link=None, texts=texts, bundle=bundle,
                       extra={"team_pts": info.get("team_pts"), "opp_pts": info.get("opp_pts")},
                       reason_if_null="dnp")
        out.append(row)
    return out


def _build_search_players(treq: TableRequest) -> list:
    import identity
    import repository
    comp_id = treq.comp_id
    team_filter = (treq.params.get("team") or "").upper() or None

    rows = repository.player_game_rows(comp_id)
    pids = sorted({identity.canonical_id(r["player_id"]) for r in rows
                   if r.get("player_id") is not None} - {None})
    out = []
    for pid in pids:
        card = identity.player_card(pid)
        if card is None:
            continue
        if team_filter and card["team_code"] != team_filter:
            continue
        req = EntityRequest(entity_type="player", entity_id=pid, comp_id=comp_id, ctx=treq.ctx,
                            base=treq.base)
        played_games = [(i, b) for i, b in load_game_bundles(req) if b is not None]
        texts = {
            "_name": card["display_name"],
            "_team": card["team_code"],
            "_position": card.get("position") or "",
        }
        if not played_games:
            # Convocado sin jugar en la competencia: fila con métricas nulas (igual que el
            # buscador legado, que lista a todos los convocados con games=0).
            out.append(TableRow(id=str(pid), link=f"player:{pid}", texts=texts, bundle=None,
                                sample=None, reason_if_null="dnp"))
            continue
        bundle = sum_bundles([b for _, b in played_games])
        sample = _player_sample(bundle)
        out.append(TableRow(id=str(pid), link=f"player:{pid}", texts=texts, bundle=bundle,
                            sample=sample))
    return out


def _player_sample(bundle) -> dict | None:
    import sample as sample_mod
    try:
        return sample_mod.sample_for("player", [bundle])
    except Exception:
        return None


def _build_clutch_games(treq: TableRequest) -> list:
    code = (treq.params.get("team") or "").upper()
    params = {}
    margin = treq.params.get("margin")
    if margin not in (None, ""):
        try:
            params["margin"] = int(margin)
        except (TypeError, ValueError):
            pass
    req = EntityRequest(entity_type="clutch", entity_id=code, comp_id=treq.comp_id, ctx=treq.ctx,
                        base=treq.base, params=params)
    per_game = load_game_bundles(req)
    if not per_game:
        raise TableError(404, "El equipo no tiene cierres en la selección.", "no_encontrado")

    import sample as sample_mod
    out = []
    for info, bundle in per_game:
        tp, op = info.get("team_pts"), info.get("opp_pts")
        result = "—" if tp is None or op is None else f"{'G' if tp > op else 'P'} {tp}-{op}"
        texts = {
            "_date": info.get("date"),
            "_opponent": info.get("opponent"),
            "_venue": info.get("home_away"),
            "_entry_margin": info.get("entry_margin"),
            "_result": result,
        }
        try:
            sample = sample_mod.sample_level("split", n=None, unit="posesiones",
                                             possessions=stats_engine.pos(bundle.own) or 0)
        except Exception:
            sample = None
        out.append(TableRow(id=str(info["game_id"]), link=None, texts=texts, bundle=bundle,
                            extra={"team_pts": tp, "opp_pts": op}, sample=sample))
    return out


# ── Quintetos y ON/OFF del plantel (F-06) ─────────────────────────────────────

def _lineup_rows(treq: TableRequest, size: int) -> list:
    """Filas de las combinaciones de `size` jugadores del equipo (F-06 RF-3, RF-5, RF-6)."""
    import lineups
    import sample as sample_mod

    team_code = (treq.params.get("team") or "").upper()
    bundles = lineups.all_lineups(team_code, treq.comp_id, treq.ctx, size=size)
    team_poss = sample_mod.team_offensive_possessions(team_code, treq.comp_id, treq.ctx)
    prior = sample_mod.league_prior(treq.comp_id, treq.ctx)

    out = []
    for b in bundles:
        badge = sample_mod.sample_for("lineup", [b], team_poss=team_poss)
        values = sample_mod.adjust_values(compute_standard(b), b, prior)
        adj = {k: values[k]["adj"] for k in sample_mod.REGRESSED_KEYS
               if (values.get(k) or {}).get("adj") is not None}
        pids = (b.meta or {}).get("player_ids") or []
        out.append(TableRow(
            id=b.entity_id, link=f"lineup:{b.entity_id}",
            texts={"_players": b.name, "_size": len(pids)},
            bundle=b, sample=badge, adj=adj or None,
            extra={"player_ids": pids},
        ))
    return out


def _build_team_lineups(treq: TableRequest) -> list:
    raw = (treq.params.get("size") or "5").strip()
    try:
        size = int(raw)
    except ValueError:
        raise TableError(400, "El parámetro size debe ser 3, 4 o 5", "parametro_invalido",
                         {"param": "size"}) from None
    if size not in (3, 4, 5):
        raise TableError(400, "El parámetro size debe ser 3, 4 o 5", "parametro_invalido",
                         {"param": "size"})
    return _lineup_rows(treq, size)


def _build_team_onoff(treq: TableRequest) -> list:
    """Una fila por jugador del plantel: ON, OFF o la diferencia ON − OFF (`view`, F-06 RF-12)."""
    import identity
    import lineups
    import repository
    import sample as sample_mod

    team_code = (treq.params.get("team") or "").upper()
    view = (treq.params.get("view") or "on").strip().lower()
    if view not in ("on", "off", "diff"):
        raise TableError(400, "El parámetro view debe ser on, off o diff", "parametro_invalido",
                         {"param": "view"})

    games = repository.team_pbp_games(team_code, treq.comp_id)
    games = context_mod.filter_games(games, treq.ctx, team_code)
    games = identity.canonicalize_pbp_games(games, team_code)
    on_bundles = lineups.all_onoff_bundles(games, team_code)
    team_poss = sample_mod.team_offensive_possessions(team_code, treq.comp_id, treq.ctx)
    prior = sample_mod.league_prior(treq.comp_id, treq.ctx)
    name_idx = identity.name_index(team_code)

    out = []
    for on_b in on_bundles:
        off_b = (on_b.meta or {}).get("off")
        player_name = (on_b.meta or {}).get("player_name") or on_b.name
        pid = name_idx.get(player_name)
        badge = sample_mod.sample_for("onoff", [on_b, off_b or on_b], team_poss=team_poss)
        row_id = f"{team_code}:{pid if pid is not None else player_name}"

        if view == "diff":
            # La diferencia no es un bundle: se calcula clave por clave sobre los valores ya escalados.
            on_v = sample_mod.adjust_values(compute_standard(on_b), on_b, prior)
            off_v = sample_mod.adjust_values(compute_standard(off_b), off_b, prior) if off_b else {}
            try:
                on_v = apply_base(on_v, on_b, treq.base)
                if off_b is not None:
                    off_v = apply_base(off_v, off_b, treq.base)
            except ValueError as e:
                raise TableError(400, "Base inválida", "parametro_invalido") from e
            diff = {}
            for k in METRICS:
                a = (on_v.get(k) or {}).get("value")
                c = (off_v.get(k) or {}).get("value")
                # Nulo de cualquier lado → diferencia nula con razón (nunca 0, F-06 RF-23)
                diff[k] = ({"value": round(a - c, 4), "reason": None}
                           if a is not None and c is not None
                           else {"value": None, "reason": "sin_datos"})
            out.append(TableRow(
                id=row_id, link=None, texts={"_player": player_name},
                bundle=None, sample=badge,
                extra={"precomputed": diff, "player_id": pid, "minutes": on_b.minutes},
                reason_if_null="sin_datos",
            ))
            continue

        shown = on_b if view == "on" else off_b
        if shown is None:
            out.append(TableRow(id=row_id, link=None, texts={"_player": player_name},
                                bundle=None, sample=badge, extra={"player_id": pid},
                                reason_if_null="sin_datos"))
            continue
        values = sample_mod.adjust_values(compute_standard(shown), shown, prior)
        adj = {k: values[k]["adj"] for k in sample_mod.REGRESSED_KEYS
               if (values.get(k) or {}).get("adj") is not None}
        out.append(TableRow(
            id=row_id, link=None, texts={"_player": player_name},
            bundle=shown, sample=badge, adj=adj or None,
            extra={"player_id": pid, "minutes": shown.minutes},
        ))

    out.sort(key=lambda r: -((r.extra or {}).get("minutes") or 0))
    return out


# ── Registro de las 6 tablas de T-06 (plan §4.2) ───────────────────────────────

register_table(
    "league_teams", entity_type="team", title="Ranking de Liga",
    builder=_build_league_teams,
    default_columns=("_name", "games", "oer", "der", "net_rating", "pace", "efg_pct", "ts_pct",
                     "or_pct", "dr_pct", "to_pct", "ft_rate", "fg3_uso", "ast_to", "stl"),
    bulk_scopes=("competition",), row_kind="entity",
    extra_columns=(("_name", "Equipo", "text"),),
    default_sort={"key": "net_rating", "dir": "desc", "use_adjusted": False},
)

register_table(
    "league_standings", entity_type="team", title="Tabla general",
    builder=_build_league_standings,
    default_columns=("_pos", "_name", "games", "_wins", "_losses", "_table_points",
                     "_pts_for", "_pts_against"),
    bulk_scopes=("competition",), row_kind="entity",
    extra_columns=(("_pos", "Pos.", "int"), ("_name", "Equipo", "text"),
                   ("_wins", "PG", "int"), ("_losses", "PP", "int"),
                   ("_table_points", "Pts", "int"), ("_pts_for", "PF", "int"),
                   ("_pts_against", "PC", "int")),
    default_sort={"key": "_pos", "dir": "asc", "use_adjusted": False},
    totals_mode="none", avg_mode="none",
)

register_table(
    "team_game_log", entity_type="team", title="Partido a partido",
    builder=_build_team_game_log, required_params=("team",),
    default_columns=("_date", "_opponent", "_venue", "_result", "pts", "oer", "der",
                     "efg_pct", "ts_pct", "or_pct", "dr_pct", "to_pct"),
    bulk_scopes=("team",), row_kind="game",
    extra_columns=(("_date", "Fecha", "text"), ("_opponent", "Rival", "text"),
                   ("_venue", "L/V", "text"), ("_result", "Result.", "text")),
    default_sort={"key": "_date", "dir": "desc", "use_adjusted": False},
    title_fn=lambda treq: f"Partido a partido — {(treq.params.get('team') or '').upper()}",
)

register_table(
    "player_game_log", entity_type="player", title="Partido a partido",
    builder=_build_player_game_log, required_params=("player_id",),
    default_columns=("_date", "_opponent", "pts", "fgm", "fga", "fgm3", "fga3", "ftm", "fta",
                     "orb", "drb", "ast", "tov", "oer", "efg_pct", "ts_pct"),
    bulk_scopes=(), row_kind="game",
    extra_columns=(("_date", "Fecha", "text"), ("_opponent", "Rival", "text")),
    default_sort={"key": "_date", "dir": "desc", "use_adjusted": False},
)

register_table(
    "search_players", entity_type="player", title="Buscador de jugadores",
    builder=_build_search_players,
    default_columns=("_name", "_team", "_position", "games", "minutes", "pts", "trb", "ast",
                     "ts_pct", "efg_pct", "uso_pct", "ast_to"),
    bulk_scopes=("competition", "team"), row_kind="entity",
    extra_columns=(("_name", "Jugador", "text"), ("_team", "Equipo", "text"),
                   ("_position", "Pos.", "text")),
    default_sort={"key": "pts", "dir": "desc", "use_adjusted": False},
)

register_table(
    "clutch_games", entity_type="clutch", title="Cierres por partido",
    builder=_build_clutch_games, required_params=("team",),
    default_columns=("_date", "_opponent", "_venue", "_entry_margin", "_result", "plus_minus",
                     "pts", "oer", "der", "efg_pct", "ts_pct", "tov", "ast", "trb",
                     "fouls_drawn", "pf"),
    bulk_scopes=("team",), row_kind="game",
    extra_columns=(("_date", "Fecha", "text"), ("_opponent", "Rival", "text"),
                   ("_venue", "L/V", "text"), ("_entry_margin", "Δ inicio", "int"),
                   ("_result", "Result.", "text")),
    default_sort={"key": "_date", "dir": "desc", "use_adjusted": False},
    title_fn=lambda treq: f"Cierres por partido — {(treq.params.get('team') or '').upper()}",
)

register_table(
    "team_lineups", entity_type="lineup", title="Quintetos", builder=_build_team_lineups,
    required_params=("team",),
    default_columns=("_players", "games", "minutes", "possessions", "oer", "der", "net_rating",
                     "efg_pct", "ts_pct", "to_pct", "or_pct", "dr_pct", "plus_minus"),
    bulk_scopes=("team",), row_kind="entity",
    extra_columns=(("_players", "Quinteto", "text"), ("_size", "Jugadores", "int")),
    default_sort={"key": "net_rating", "dir": "desc", "use_adjusted": True},
    title_fn=lambda treq: (
        f"Quintetos — {(treq.params.get('team') or '').upper()}"
        if (treq.params.get('size') or '5') == '5'
        else f"Combinaciones de {treq.params.get('size')} — {(treq.params.get('team') or '').upper()}"),
)

register_table(
    "team_onoff", entity_type="onoff", title="ON/OFF del plantel", builder=_build_team_onoff,
    required_params=("team",),
    default_columns=("_player", "games", "minutes", "possessions", "oer", "der", "net_rating",
                     "efg_pct", "ts_pct", "to_pct", "or_pct", "dr_pct", "plus_minus"),
    bulk_scopes=("team",), row_kind="entity",
    extra_columns=(("_player", "Jugador", "text"),),
    default_sort={"key": "net_rating", "dir": "desc", "use_adjusted": True},
    totals_mode="none",
    title_fn=lambda treq: (
        f"ON/OFF — {(treq.params.get('team') or '').upper()}"
        + {"on": " (en cancha)", "off": " (fuera de cancha)",
           "diff": " (diferencia)"}.get((treq.params.get('view') or 'on').lower(), "")),
)
