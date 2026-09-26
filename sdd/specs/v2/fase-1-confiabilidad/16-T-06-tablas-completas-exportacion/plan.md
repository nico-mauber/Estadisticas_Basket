# Plan — T-06: Tablas completas y exportación

> **ID:** T-06 · **Prioridad:** P0 · **Fase y orden:** 1·16
> **Depende de:** T-05 · T-01 · T-02 · C-11 · F-13 (+ C-02, C-06, C-09, F-11 cerrados) — ver [spec.md](spec.md)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §3 · T-06 · Arquitectura §3.11, §3.3, §3.2, §6, §7.6, §7.7, §8
> **Estimación:** XL · 30–40 h

## 1. Enfoque

Backend: módulo NUEVO `backend/tables.py` con un **registro de tablas** (`register_table`) y `build_table()` que, para un
`table_id`, arma los `StatBundle` de cada fila con el *builder* registrado, calcula el conjunto estándar con
`stats_engine.compute_standard` + `apply_base` (T-05), agrega percentiles (`population.percentile`, T-01), badge de muestra
(`sample.sample_level`, T-02), fila de totales (suma de bundles) y promedio de competencia (`population.league_reference`), y
devuelve **todas** las filas en formato compacto por columnas (§7.6). Módulo NUEVO `backend/export_xlsx.py` escribe XLSX con
`zipfile` (stdlib). Tres rutas finas en `app.py`. Frontend: tres componentes NUEVOS (`components/data-table.js`,
`components/export-menu.js`, `components/exporters.js`) que ordenan (con `cmpNullsLast`), paginan, ocultan columnas, colorean
y serializan en el cliente; las 6 tablas de datos agregados migran al componente; las 7 restantes reciben `exportMenu`.
Cero dependencias nuevas (DA-19): CSV en cliente, XLSX en servidor con stdlib, PNG por SVG `foreignObject`, PDF por
`window.print()`.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/tables.py` | module NUEVO | `TableRequest`, `register_table`, `build_table`, `bulk_workbook`, builders de las 6 tablas de T-06, metadatos §7.7, nombre de archivo | RF-1, RF-2, RF-4, RF-6, RF-7, RF-8, RF-10, RF-14, RF-15, RF-18, RF-20 |
| `backend/export_xlsx.py` | module NUEVO | `workbook_bytes(sheets, meta)`: SpreadsheetML mínimo con portada, números nativos y formatos | RF-12, RF-14, RF-17, RF-18, RF-19 |
| `backend/metrics_catalog.py` (T-05) | module (extensión) | `load_game_bundles(req)` — PROPUESTA (ver §4.3) | RF-1, RF-10 |
| `backend/stats_engine.py` (T-05) | module (extensión) | `sum_bundles(bundles)` — PROPUESTA (ver §4.3) | RF-4 |
| `backend/config.py` (F-13) | module (extensión) | agrega `table.page_size` y `export.csv_separator` a `CONFIG_SPEC` (sección Preferencias) | RF-7, RF-16 |
| `backend/app.py` | route | `GET /api/table/<table_id>`, `POST /api/export/xlsx`, `GET /api/export/bulk` (finas); import de `tables` para que se registren las tablas | RF-6, RF-12, RF-18 |
| `frontend/js/components/data-table.js` | js-component NUEVO | `createDataTable` (orden, columnas, colores, totales, promedio, paginación, columna fija, badge, filas grises) | RF-1…RF-9, RF-19 |
| `frontend/js/components/export-menu.js` | js-component NUEVO | `exportMenu` (botón + menú CSV/XLSX/PNG/PDF, estados) | RF-11, RF-12, RF-13 |
| `frontend/js/components/exporters.js` | js-component NUEVO | `toCSV`, `toPNG`, `printNode`, `downloadBlob`, helpers de cabecera y nombre | RF-12…RF-16, RF-19 |
| `frontend/js/api.js` | js-api | `apiFetchBlob`, `api.table`, `api.exportXlsx`, `api.exportBulk` | RF-6, RF-12, RF-18 |
| `frontend/js/app.js` | js-view | migra Liga (ranking + tabla general), game log de equipo y jugador, buscador y cierres a `createDataTable`; agrega `exportMenu` a las 7 tablas restantes; bloque de exportación masiva en Importar | RF-10, RF-11, RF-18 |
| `frontend/css/style.css` | css | secciones `/* ── data-table (T-06) ── */`, `/* ── export-menu (T-06) ── */`, `@media print` (contenedor de impresión A4) | RF-5, RF-8, RF-9, RF-12, RF-17(vista) |
| `frontend/sw.js` | sw | agrega los 3 módulos a `STATIC` y sube `CACHE` al siguiente entero (número asignado al integrar) | RF-11 (offline CSV/PNG/PDF) |
| `docs/api.md` | doc | 3 endpoints nuevos, payload §7.6, errores | cierre |
| `docs/frontend.md` | doc | componentes nuevos, inventario de tablas, copy nuevo, exportación, `@media print`, SW | cierre |
| `docs/architecture.md` | doc | módulos `tables.py` y `export_xlsx.py` | cierre |

Matriz RF → archivo: RF-1 (tables.py, metrics_catalog.py, data-table.js) · RF-2 (tables.py `default_sort`, data-table.js) ·
RF-3 (data-table.js + `core/prefs.js` de F-13) · RF-4 (tables.py, stats_engine.py, data-table.js) · RF-5 (tables.py `pct`,
data-table.js + `core/colors.js`) · RF-6 (tables.py + `context.py`, app.py, api.js) · RF-7 (config.py, data-table.js) · RF-8
(tables.py + `sample.py`, data-table.js, style.css) · RF-9 (data-table.js, style.css) · RF-10 (tables.py builders, app.js) ·
RF-11 (export-menu.js, app.js) · RF-12 (exporters.js, export_xlsx.py, app.py) · RF-13 (data-table.js `getState`, export-menu.js)
· RF-14 (tables.py `meta`, exporters.js, export_xlsx.py) · RF-15 (tables.py `file_name`, exporters.js) · RF-16 (exporters.js
`toCSV`, config.py) · RF-17 (export_xlsx.py) · RF-18 (tables.py `bulk_workbook`, app.py, api.js, app.js) · RF-19 (`core/format.js`
de C-11, exporters.js, export_xlsx.py) · RF-20 (tables.py; data-table.js no calcula).

## 3. Backend — rutas y modelos

Sin modelos nuevos ni `upgrade_db()`. Todas las rutas con `login_required`; errores con el formato §7.8
`{"error", "code", "details"}`.

### 3.1 `GET /api/table/<table_id>` (NUEVO)

- **Parámetros**:
  - propios de cada tabla (validados por `tables.build_table` según el registro):

    | table_id | Parámetros obligatorios | Opcionales |
    |---|---|---|
    | `league_teams` | — | — |
    | `league_standings` | — | — |
    | `team_game_log` | `team=<team_code>` | — |
    | `player_game_log` | `player_id=<int>` (o legado `team` + `player`) | — |
    | `search_players` | — | `team=<team_code>` (plantel; usado por la exportación masiva) |
    | `clutch_games` | `team=<team_code>` | `margin` (compatibilidad con `/api/clutch`) |

  - contexto (Arq. §3.8, vía `context.parse_context`): en fase 1 `competition` (id \| `all` \| string legado) y `last`; desde
    T-03 todos los de §3.8 (sin cambios en T-06).
  - `base` ∈ `total` \| `partido` (fase 1, T-05); `por40` \| `por100` desde T-04. Default `ui.default_base`.
- **Response 200** (payload §7.6; ejemplo real de forma para `team_game_log`):
```json
{
  "table_id": "team_game_log", "title": "Partido a partido — Nacional",
  "entity_type": "team",
  "row_kind": "game",
  "columns": [
    {"key": "_date", "label": "Fecha", "type": "text", "sticky": true, "default_visible": true},
    {"key": "_opponent", "label": "Rival", "type": "text", "default_visible": true},
    {"key": "_venue", "label": "L/V", "type": "text", "default_visible": true},
    {"key": "_result", "label": "Result.", "type": "text", "default_visible": true},
    {"key": "pts", "type": "metric", "default_visible": true},
    {"key": "oer", "type": "metric", "default_visible": true},
    {"key": "der", "type": "metric", "default_visible": true},
    {"key": "efg_pct", "type": "metric", "default_visible": true},
    {"key": "ts_pct", "type": "metric", "default_visible": true},
    {"key": "or_pct", "type": "metric", "default_visible": true},
    {"key": "dr_pct", "type": "metric", "default_visible": true},
    {"key": "to_pct", "type": "metric", "default_visible": true},
    {"key": "blk_received", "type": "metric", "default_visible": false}
  ],
  "rows": [
    {"id": "2489130", "link": null,
     "values": ["2026-03-15", "Peñarol", "L", "G 84-79", 84, 1.0912, 1.0260, 0.5231, 0.5610, 0.2903, 0.7101, 0.1402, null],
     "pct": [null, null, null, null, 66, 58, 61, 55, 60, 47, 52, 40, null],
     "adj": null,
     "reasons": {"blk_received": "no_registrado"},
     "sample": null}
  ],
  "totals": {"label": "Total", "values": ["Total", null, null, "9-7", 81.4, 1.0701, 1.0433, 0.5102, 0.5488, 0.2811, 0.7050, 0.1455, null],
             "reasons": {"blk_received": "no_registrado"}},
  "competition_avg": {"label": "Promedio competencia", "values": ["Promedio competencia", null, null, null, 79.9, 1.0512, 1.0512, 0.5010, 0.5390, 0.2850, 0.7150, 0.1480, null],
                      "reasons": {"blk_received": "no_registrado"}},
  "default_sort": {"key": "_date", "dir": "desc", "use_adjusted": false},
  "row_count": 16,
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {"last": null},
              "ignored": [], "level": "partido", "population_mode": "apply_all", "games_used": 16, "games_total": 16,
              "games_excluded": {"sin_pbp": 0}, "label": "Todos los partidos"},
  "base": "partido",
  "meta": {"title": "Partido a partido — Nacional", "section": "partido-a-partido",
           "entity": {"type": "team", "id": "CNF", "name": "Nacional"},
           "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026", "season": "2025/2026"},
           "filters": [{"label": "Período", "value": "Todos los partidos"}],
           "base": {"key": "partido", "label": "Por partido"},
           "sort": null, "columns_visible": null,
           "generated_at": "2026-09-23T14:05:00-03:00", "generated_by": "nico", "app_version": "smart-basket-v14",
           "file_name": "partido-a-partido_CNF_liga-uruguaya-de-basquetbol-2025-2026_2026-09-23"}
}
```
  - Columnas `type: "metric"` sin `label`: la etiqueta, `fmt` y `direction` salen del catálogo de T-05 en el cliente
    (`core/catalog.js`), así el nombre es idéntico en toda la app (CA de T-05).
  - Columnas de valores que no son del catálogo (p. ej. PG/PP/puntos de tabla general) usan `type: "value"` con `label`,
    `fmt` y `direction` inline — PROPUESTA (no está en 00-arquitectura-transversal.md): extiende §7.6 con un tipo de columna
    más; el payload sigue siendo compatible.
  - `row_kind` ∈ {`entity`, `game`} — PROPUESTA (no está en 00-arquitectura-transversal.md): indica si las filas son
    entidades (percentil contra la población de T-01) o partidos de una entidad (percentil contra partidos, spec §9 D-6).
  - `row_count` — PROPUESTA: redundante con `rows.length`, facilita verificar "no truncar" desde curl.
  - `meta.sort` y `meta.columns_visible` vuelven `null`: los completa el cliente al exportar (son estado de pantalla).
- **Errores**: 404 `{"error": "Tabla inexistente", "code": "no_encontrado"}` (id no registrado); 404
  `{"error": "Equipo no encontrado", "code": "no_encontrado"}` / `"Jugador no encontrado"`; 400
  `{"error": "Parámetro inválido: falta team", "code": "parametro_invalido", "details": {"param": "team"}}`; 400
  `{"error": "Base inválida", "code": "parametro_invalido"}` (base fuera de las disponibles en la fase); 400
  `contexto_invalido` / `competencia_inexistente` (propagados desde `parse_context`).

### 3.2 `POST /api/export/xlsx` (NUEVO)

- **Request** (el cliente envía exactamente lo mostrado, ya ordenado y con columnas visibles):
```json
{
  "meta": { "...": "§7.7 completo, con sort y columns_visible" },
  "sheets": [
    {"name": "Partido a partido",
     "columns": [{"key": "_date", "label": "Fecha", "fmt": "text"}, {"key": "oer", "label": "OER", "fmt": "dec2"},
                 {"key": "efg_pct", "label": "eFG%", "fmt": "pct"}],
     "rows": [["2026-03-15", 1.0912, 0.5231], ["2026-03-08", null, 0.4988]],
     "footer": [["Total", 1.0701, 0.5102], ["Promedio competencia", 1.0512, 0.5010]]}
  ]
}
```
  `fmt` ∈ `text | int | signed_int | dec1 | dec2 | signed_dec2 | pct` (los del catálogo T-05). `footer` opcional
  (PROPUESTA: extiende el body de §6 para exportar las filas de totales y promedio).
- **Response 200**: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  `Content-Disposition: attachment; filename="<meta.file_name>.xlsx"; filename*=UTF-8''<…>`.
- **Errores**: 400 `{"error": "Cuerpo de exportación inválido", "code": "parametro_invalido", "details": {"field": "sheets[0].rows[3]"}}`
  (JSON malformado, fila con cantidad de celdas distinta de las columnas, `fmt` desconocido, más de 20 hojas, nombre de hoja
  vacío); 413 `{"error": "La tabla es demasiado grande para exportar en XLSX; exportá en CSV.", "code": "parametro_invalido"}`
  (más de 50.000 filas en una hoja o cuerpo > 10 MB; el tamaño se valida con `request.content_length` antes de parsear).

### 3.3 `GET /api/export/bulk` (NUEVO)

- **Parámetros**: `scope=team&team=<team_code>` \| `scope=competition`; `competition` (obligatorio en la práctica; si falta se
  resuelve con `repository.resolve_competition`); `base` opcional (default `ui.default_base`). `competition=all` → 400 (sin
  universo no hay promedios ni percentiles).
- **Response 200**: XLSX con hoja "Portada" y una hoja por tabla registrada con `scope` en `bulk_scopes`, con todas las
  columnas (spec §9 D-9). Nombre: `exportacion_<CNF|competencia>_<competencia-slug>_<AAAA-MM-DD>.xlsx`.
- **Errores**: 400 `{"error": "Alcance inválido: usá team o competition", "code": "parametro_invalido"}`; 400
  `{"error": "La exportación masiva requiere una competencia concreta", "code": "parametro_invalido"}`; 404 equipo sin datos
  en la competencia `{"error": "No hay datos para exportar en esta selección.", "code": "no_encontrado"}`.

### 3.4 Configuración (F-13 `CONFIG_SPEC`, dueño T-06)

| Clave | Tipo | Default | Rango | Sección | Consumidor |
|---|---|---|---|---|---|
| `table.page_size` | int | 50 | 10–500 | Preferencias | `data-table.js` (leída de `GET /api/settings` una vez por sesión y al guardar configuración) |
| `export.csv_separator` | enum `;` \| `,` | `;` | — | Preferencias | `exporters.toCSV` (si `,` → decimal punto; si `;` → decimal coma) |

## 4. Backend — lógica

### 4.1 `backend/tables.py` (NUEVO)

```
TableRequest (dataclass): table_id: str; params: dict[str, str]; comp_id: int | None; ctx: Context; base: str
TableDef (dataclass, interno): table_id, entity_type, title, builder, default_columns, bulk_scopes,
        row_kind = "entity", required_params = (), extra_columns = (), default_sort = None,
        totals_mode = "sum",            # "sum" | "none"
        avg_mode = "population"          # "population" | "none"
_REGISTRY: dict[str, TableDef]

register_table(table_id, *, entity_type, title, builder, default_columns, bulk_scopes=()) -> None   # firma de Arq. §3.11
    # kwargs opcionales PROPUESTA: row_kind, required_params, extra_columns, default_sort, totals_mode, avg_mode, title_fn
build_table(table_id: str, args: Mapping[str, str]) -> dict                                            # payload §7.6
bulk_workbook(scope: str, scope_id: str, comp_id: int) -> bytes
```

**Contrato del builder**: `builder(req) -> list[TableRow]` donde `TableRow` (PROPUESTA, dataclass interno) =
`{id: str, link: str | None, texts: dict[str, str | None], bundle: StatBundle, extra: dict[str, float | None],
sample_n: dict | None, adj: dict | None}`. La firma de la arquitectura (`-> list[StatBundle]`) se respeta como caso simple:
si el builder devuelve `StatBundle` sueltos, `build_table` los envuelve con `id = bundle.entity_id`, `texts = {"_name":
bundle.name}`.

**`build_table` paso a paso:**
1. `tdef = _REGISTRY.get(table_id)` → si falta, `TableError(404, "Tabla inexistente", "no_encontrado")`.
2. Validar `required_params` en `args` → 400 `parametro_invalido`.
3. `ctx = context.parse_context(args, team_code=args.get("team"), player_id=…)` (C-02/T-03); `comp_id = ctx.competition_id`.
4. `base = args.get("base") or config.get("ui.default_base")`; validar contra las bases disponibles
   (`stats_engine.apply_base` lanza `ValueError` para bases no implementadas → 400 "Base inválida").
5. Memo: `cache.memo("tables:" + table_id, (table_id, sorted(args.items())), lambda: _compute(...))` (namespace NUEVO,
   PROPUESTA; la clave ya incluye `data_version`/`config_version`, §3.14).
6. `rows = tdef.builder(TableRequest(...))`.
7. Por cada fila: `values = stats_engine.compute_standard(row.bundle)` → `values = stats_engine.apply_base(values, row.bundle,
   base)` (en filas `game`, `total` y `partido` coinciden; `por40`/`por100` escalan conteos desde T-04).
8. Columnas: `_text` (de `texts`, en el orden de `extra_columns`) + `_sample` si la entidad tiene muestra + **todas** las claves
   de `metrics_catalog.METRICS` cuyo `entities` incluye `entity_type` (orden `GROUPS`), con `default_visible = key in
   default_columns`; claves fuera de `entities` también se agregan con valor `null` razón `no_aplica` solo si el grupo es
   obligatorio de T-05 (así el selector muestra el conjunto completo, CA-12).
9. `values` de la fila alineados con `columns`: texto → string; métrica → `v["value"]`; `reasons[key] = v["reason"]` si nulo.
10. Percentiles (`pct`), solo para columnas `metric` con `direction != neutral`:
    - `row_kind == "entity"`: `pop = population.population(entity_type, comp_id, ctx)`; `pct[key] =
      population.percentile(value, others_sin_la_fila, direction)` — igual que la ficha T-01 (misma población, mismos umbrales).
      Si `comp_id is None` (`competition=all`) → `pct` null (`sin_universo`).
    - `row_kind == "game"`: `others` = valores de la métrica en **todos los partidos-entidad de la competencia** en el mismo
      contexto (excluido el propio partido), obtenidos con `_game_population(entity_type, comp_id, ctx, key)` (§4.2).
    - Valor nulo → `pct` null (nunca color, C-11).
11. Adjusted (T-02): si `entity_type` admite regresión (`lineup`, `onoff`, `pair`, `matchup`, `split`, `clutch_lineup`), `adj =
    {key: sample.adjusted(value, poss, prior, entity_type)}` para `oer`, `der`, `net_rating`; `default_sort.use_adjusted =
    true`. En las 6 tablas de T-06 no aplica (equipos/jugadores/partidos) → `adj: null`.
12. Muestra: si `entity_type ∈ {player, lineup, onoff, clutch}` → `sample = sample.sample_level(entity_type, n=…, unit=…)`
    (jugador: minutos; cierre por partido: posesiones del tramo con umbral `sample.split.*` —ver §10 R-4—).
13. Totales (`totals_mode == "sum"`): `tb = stats_engine.sum_bundles([r.bundle for r in rows])` → `compute_standard` →
    `apply_base(…, base)`; textos: `"Total"` en la columna fija, récord `"G-P"` en `_result` cuando la tabla es game log;
    `pct` no se calcula para totales (sin color). `totals_mode == "none"` → `totals: null` y la UI muestra "—" con `no_aplica`.
14. Promedio (`avg_mode == "population"`): `ref = population.league_reference(entity_type, comp_id, ctx)` (valores por entidad
    en base `partido` según T-01); para bases distintas de `partido`, PROPUESTA: `league_reference(..., base=base)` (ver §10
    huecos). Métricas `fixed` no dependen de la base. `comp_id is None` → fila con `null` razón `sin_universo`.
15. `meta` §7.7 con `generated_by = prefs.current_owner()`, `app_version` = constante `APP_VERSION` leída de `sw.js`… →
    PROPUESTA: constante `APP_VERSION` en `tables.py` actualizada al integrar (no se lee el SW desde Python).
    `file_name = _file_name(section_slug, entity_id_or_label, competition_label, today)`.
16. `row_count = len(rows)`; devolver el payload.

**Helpers internos:**
- `_slug(s) -> str`: `unicodedata.normalize("NFKD")`, quita diacríticos, minúsculas, `[^a-z0-9]+ → "-"`, recorta `-`.
- `_file_name(section, entity, comp_label, date) -> str`: `f"{_slug(section)}_{entity}_{_slug(comp_label or 'todas')}_{date}"`;
  `entity` es el código de equipo, el `player_id` + slug del nombre (`jugador-12-a-varela`) o `liga` para tablas de competencia.
- `_filters_meta(ctx_echo) -> list[{label, value}]`: traduce `context.applied` a etiquetas legibles ("Período: Últimos 5").

### 4.2 Builders de las 6 tablas de T-06 (en `tables.py`, registrados al importar el módulo)

| table_id | entity_type · row_kind | Builder (entradas) | Columnas por defecto (las de hoy) | Orden por defecto | Totales / promedio | bulk_scopes |
|---|---|---|---|---|---|---|
| `league_teams` | team · entity | por equipo de la competencia: `sum_bundles(load_game_bundles(team))` (= bundle de temporada en el contexto) | `_name`, `games`, `oer`, `der`, `net_rating`, `pace`, `efg_pct`, `ts_pct`, `or_pct`, `dr_pct`, `to_pct`, `ft_rate`, `fg3_uso`, `ast_to`, `stl` (las columnas actuales de `_leagueTableHTML`, con claves estándar) | `net_rating` desc | sum (agregado de la competencia) / population | `competition` |
| `league_standings` | team · entity | mismos bundles + `extra` = `wins`, `losses`, `table_points` (C-09, puntos `standings.win_points`/`loss_points`, desempate `standings.tiebreak`) | `_name`, `games`, `_wins`, `_losses`, `_table_points`, `pts`, `pts_against`, `plus_minus` | `_table_points` desc, desempate `plus_minus` desc (solo si `standings.tiebreak == diferencia`) | none / none | `competition` |
| `team_game_log` | team · game | `load_game_bundles(EntityRequest("team", team, comp_id, ctx, base))` → una fila por partido; textos `_date`, `_opponent`, `_venue` (L/V), `_result` ("G 84-79"/"P 70-75") | `_date`, `_opponent`, `_venue`, `_result`, `pts`, `oer`, `der`, `efg_pct`, `ts_pct`, `or_pct`, `dr_pct`, `to_pct` | `_date` desc | sum (= temporada del equipo; `_result` = récord "G-P") / population (team) | `team` |
| `player_game_log` | player · game | `load_game_bundles(EntityRequest("player", str(player_id), …))`; partidos DNP como filas con todas las métricas `null` razón `dnp` | `_date`, `_opponent`, `pts`, `fgm`, `fga`, `fgm3`, `fga3`, `ftm`, `fta`, `orb`, `drb`, `ast`, `tov`, `oer`, `efg_pct`, `ts_pct` | `_date` desc | sum (DNP excluidos, `played`) / population (player) | — |
| `search_players` | player · entity | por jugador (`player_id`) con partidos en la competencia: `sum_bundles(load_game_bundles(player))`; `team` opcional filtra el plantel; textos `_name`, `_team`, `_position` (FIBA más frecuente, DA-11) | `_name`, `_team`, `_position`, `games`, `minutes`, `pts`, `trb`, `ast`, `ts_pct`, `efg_pct`, `uso_pct`, `ast_to` (columnas actuales de `SEARCH_COLS` con claves estándar) | `pts` desc | sum / population (player) | `competition`, `team` (filtrado) |
| `clutch_games` | clutch · game | `clutch.team_clutch(...)["per_game"]` convertido a bundles por partido por el loader `clutch` de T-05 (`load_game_bundles(EntityRequest("clutch", team, …))`); textos `_date`, `_opponent`, `_entry_margin` (marcador al inicio del tramo), `_result` | `_date`, `_opponent`, `_entry_margin`, `_result`, `pts`, `pts_against`, `plus_minus`, `oer`, `der`, `efg_pct`, `ts_pct`, `trb`, `ast`, `tov` | `_date` desc | sum (= agregado de cierres) / population (clutch de los equipos de la competencia) | `team` |

**`_game_population(entity_type, comp_id, ctx, key) -> list[float]`** (PROPUESTA, interno): para cada equipo (o cada jugador
`in_population` de T-01) de la competencia, `load_game_bundles` → `compute_standard` por partido → lista de valores no nulos de
`key`. Cacheado con `cache.memo("tables:gamepop", (entity_type, comp_id, context_key(ctx)), …)` calculando **todas** las claves a
la vez (una pasada por competencia). Costo estimado: 13 partidos × 24 jugadores ≈ 312 bundles en el seed; temporada completa
(~200 partidos) ≈ 4.800 bundles de jugador (< 2 s en frío, luego en caché).

### 4.3 Extensiones a módulos de T-05 (PROPUESTA — no están en 00-arquitectura-transversal.md)

- `metrics_catalog.load_game_bundles(req: EntityRequest) -> list[tuple[dict, StatBundle]]`: expone el loader registrado por
  tipo de entidad **partido a partido**. `dict` de partido = `{game_id, date, opponent_code, opponent, home_away, team_pts,
  opp_pts, played}`. Necesario porque `StatBundle` (Arq. §3.5) no lleva `game_id` y los game logs, la población de partidos y
  F-18 necesitan la serie por partido. Si el plan de T-05 ya expone algo equivalente, se usa ese nombre y esta propuesta se
  retira.
- `stats_engine.sum_bundles(bundles: list[StatBundle]) -> StatBundle`: suma `own`, `opp`, `team`, `games`, `minutes`,
  `team_minutes`, `seconds`, `on_court` (suma de sus `own`/`opp`/`seconds`, `estimated = any`), `shots`,
  `possessions_counted` (None si alguno es None); `null_reasons` = unión. Un `None` en un conteo de un sumando (columna
  `DEFAULT NULL` sin reprocesar) → el conteo total queda `None` (C-11: un nulo no entra en una suma como 0) y
  `compute_standard` devuelve la métrica nula con razón `no_registrado`. Es suma de conteos, no una fórmula; vive en
  `stats_engine` para que `lineups`/`clutch`/`tables`/`trends` usen la misma.

### 4.4 `backend/export_xlsx.py` (NUEVO)

`workbook_bytes(sheets: list[dict], meta: dict) -> bytes` (firma Arq. §4).
1. Validar: 1–20 hojas; nombres únicos, ≤ 31 caracteres, sin `[]:*?/\` (se sanean y se deduplican con sufijo " (2)");
   cada fila del largo de `columns`.
2. `zipfile.ZipFile(BytesIO(), "w", ZIP_DEFLATED)` con: `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`,
   `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheet1.xml` (Portada), `sheetN.xml` (datos), `docProps/core.xml`
   (título, autor = `generated_by`, fecha).
3. Estilos (`styles.xml`, `numFmts` + `cellXfs`): 0 general · 1 texto en negrita (títulos) · 2 `0` (int) · 3 `+0;-0;0`
   (signed_int) · 4 `0.0` (dec1) · 5 `0.00` (dec2) · 6 `+0.00;-0.00;0.00` (signed_dec2) · 7 `0.0%` (pct) · 8 cursiva gris (nota).
   El separador decimal lo pone Excel según la configuración regional (número nativo).
4. Celdas: texto → `t="inlineStr"` con `<is><t xml:space="preserve">…</t></is>` (escape XML de `& < > " '` y remoción de
   caracteres de control no válidos en XML 1.0); número → `<c r="B2" s="5"><v>1.0912</v></c>`; `None` → celda omitida (vacía).
   Referencias `A1` con conversión base 26 de columna.
5. Hoja de datos: fila 1 títulos (estilo 1), filas de datos, fila vacía, `footer` en negrita; `<sheetViews><pane ySplit="1"
   xSplit="1" state="frozen"/>` (fila de títulos y primera columna fijas); `<cols>` con ancho estimado por largo de título.
6. Portada: filas "Título", "Entidad", "Competencia", "Temporada", "Filtros" (una fila por filtro), "Base", "Orden",
   "Columnas visibles", "Generado", "Usuario", "Versión", y la nota "Celda vacía = dato inexistente (—). Métricas calculadas por
   Smart-Basket; fórmulas en docs/metrics.md."
7. Devolver `bytes`.

### 4.5 `bulk_workbook(scope, scope_id, comp_id) -> bytes`

1. Tablas = `[t for t in _REGISTRY.values() if scope in t.bulk_scopes]` en orden de registro.
2. Para cada tabla: `payload = build_table(t.table_id, {"competition": comp_id, "team": scope_id si scope == "team", "base": …})`
   (usa la caché); hoja = todas las columnas (texto + métricas) en el orden del payload, filas en `default_sort`, `footer` =
   totales y promedio; valores `fmt` según catálogo (texto para columnas de texto).
3. Tablas sin filas → se omiten y se anotan en la portada ("Sin datos: Cierres por partido"). Si todas vacías → 404.
4. `export_xlsx.workbook_bytes(sheets, meta_bulk)` con `meta_bulk.title = "Exportación completa — <equipo|competencia>"`.
5. Objetivo < 60 s (Arq. §3.14); se mide y registra en `progress.md`.

### 4.6 Rutas en `app.py` (finas)

```
@app.route("/api/table/<table_id>")          → try: return jsonify(tables.build_table(table_id, request.args))
                                               except TableError as e: return jsonify(e.body), e.status
@app.route("/api/export/xlsx", POST)         → valida content_length ≤ 10 MB (413); data = request.get_json(silent=True);
                                               bytes = export_xlsx.workbook_bytes(data["sheets"], data["meta"]) (ValueError → 400);
                                               return Response(bytes, mimetype=XLSX_MIME, headers=Content-Disposition)
@app.route("/api/export/bulk")               → tables.bulk_workbook(scope, team, comp_id) → Response XLSX
```

## 5. Frontend — capa API (`api.js`)

- `apiFetchBlob(path, opts = {}) -> Promise<{blob, fileName}>` (NUEVO, Arq. §8): mismo manejo de 401 y de errores que
  `apiFetch` (si `!res.ok` intenta leer JSON de error); `fileName` desde `Content-Disposition` (`filename*` UTF-8 o `filename`).
- `api.table(tableId, params) → apiFetch(\`/api/table/${encodeURIComponent(tableId)}${qs(params)}\`)` (`qs` de T-05 omite
  `null`/`undefined`/`""`).
- `api.exportXlsx(body) → apiFetchBlob("/api/export/xlsx", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})`.
- `api.exportBulk(params) → apiFetchBlob(\`/api/export/bulk${qs(params)}\`)`.
- Reutiliza de F-13: `api.prefs(scope)`, `api.savePref(scope, key, value)`, `api.settings()`.

## 6. Frontend — UI

### 6.1 `components/data-table.js` (NUEVO)

Firma (Arq. §8): `createDataTable(el, {tableId, payload, onRowClick}) -> {setPayload(p), getState(), destroy()}`. Opciones
adicionales PROPUESTA (extensión compatible): `rowFilter(row) -> bool` y `filterLabels: [{label, value}]` (filtros locales de
la pantalla, p. ej. el buscador), `title` (para la cabecera de exportación), `exportFormats` (default los 4).

Algoritmo de render:
1. Estado inicial: `visible = getPref("table.columns", tableId, null) ?? columnas con default_visible`; filtrar claves que ya
   no existan en el payload; `sort = getPref("table.sort", tableId, null) ?? payload.default_sort`; `colorize =
   getPref("table.colorize", tableId, true)`; `pageSize = settings["table.page_size"] ?? 50`; `page = 0`; `showAll = false`.
2. Filas = `payload.rows.filter(rowFilter ?? always)`; orden estable: `cmpNullsLast(valorOrden(a), valorOrden(b), dir)` (de
   `core/format.js`, C-11), donde `valorOrden` usa `adj[key].value` si `default_sort.use_adjusted` y existe; texto con
   `localeCompare("es")`; desempate por índice original.
3. Barra de herramientas: "Columnas" (abre panel), interruptor "Colores", `exportMenu`, contador "N filas".
4. `<thead>`: `<th data-key aria-sort>` con etiqueta `metricLabel(key)` (catálogo) o `label` del payload; flecha ↑/↓ en la
   columna ordenada; clic alterna desc → asc (texto: asc → desc); `setPref("table.sort", tableId, {key, dir})` (fallo → toast).
5. `<tbody>`: página `rows.slice(page*pageSize, …)` o todas si `showAll`; celda métrica: `fmtMetric(key, v)` (T-05) o, si nulo,
   `nullDisplay(reason)` con `title = NULL_REASON_LABELS[reason]`; fondo `colorize ? percentileBg(pct) : ""` (null → sin
   color); celda `_sample` → `sampleBadge(sample, {compact: true})`; fila con `sample.level == "baja"` → clase `.dt-row-low`
   (texto gris) + `title` "Muestra baja: fuera de rankings" (copy T-02). Si `adj[key]`, la celda muestra el valor crudo y debajo
   "aj. 1,03 ± 0,36" en tamaño chico.
6. `<tfoot>`: fila `totals` y fila `competition_avg` (clase `.dt-foot`, sin color); `null` → "—".
7. Paginación: "‹ Anterior · Página X de Y · Siguiente ›" + "Ver todas (N)" / "Paginar"; oculta si N ≤ pageSize.
8. Columna fija: primera columna con `position: sticky; left: 0` (`.dt-sticky`), fondo `var(--card)`.
9. Clic en fila → `onRowClick(row)` o navegar a `row.link` si existe.
10. Selector de columnas: panel (desktop: popover anclado; móvil <768 px: hoja inferior `.dt-sheet`) con un bloque por grupo
    `groupsFor(entityType)`; casillas; "Restablecer" (borra la preferencia: `setPref(..., null)` → vuelve a `default_visible`);
    la columna fija no se puede ocultar. Guarda con `setPref("table.columns", tableId, visible)`.
11. `getState() -> {columns: [colVisibleOrdenada], rows: [filasFiltradasOrdenadas], pageRows: [filasDeLaPágina], sort, colorize,
    page, pageCount, showAll, filterLabels}` (lo usa el export-menu).
12. `setPayload(p)` re-renderiza conservando columnas/orden/página si el `tableId` es el mismo.
13. `destroy()` quita listeners y el panel.

### 6.2 `components/export-menu.js` (NUEVO)

`exportMenu(el, {getData: () => ({meta, columns, rows, footer, pageInfo}), getNode: () => HTMLElement, formats})`:
botón "Exportar" (ícono descarga) → menú "CSV · XLSX · PNG · PDF" (móvil: hoja inferior). Al elegir:
- CSV → `downloadBlob(toCSV(data), meta.file_name + ".csv")`.
- XLSX → `api.exportXlsx({meta, sheets: [{name: meta.title.slice(0, 31), columns, rows, footer}]})` → `downloadBlob`.
  Sin conexión (`navigator.onLine === false` o `TypeError` de red) → toast de §6 de la spec.
- PNG → `toPNG(buildExportNode(getNode(), meta, pageInfo), {width: 1200})`.
- PDF → `printNode(buildExportNode(...), {pageSize: "A4"})`.
- Estado "Generando archivo…" (botón deshabilitado) y toast "Archivo generado: <nombre>".
Para `createDataTable`, `getData` lo arma el propio componente: `meta` = `payload.meta` + `sort: {key, dir, label}` +
`columns_visible` + `filters` = `meta.filters ∪ filterLabels`; `columns` = `[{key, label, fmt}]` visibles; `rows` = todas las
filas filtradas y ordenadas (valores crudos, sin formatear); `footer` = totales y promedio; `pageInfo` = "Filas 1–50 de 312".
Para las 7 tablas que no migran: `getData` lee las filas visibles de su `<table>` (texto de celdas) con
`tableToData(tableEl, meta)` (helper de `exporters.js`) y `meta` mínima armada por la vista (título, entidad, competencia
del filtro activo, fecha).

### 6.3 `components/exporters.js` (NUEVO)

- `toCSV({meta, columns, rows, footer}) -> Blob`: sep = `export.csv_separator`; decimal = `,` si sep es `;`, si no `.`;
  líneas `# Título: …`, `# Entidad: …`, `# Competencia: …`, `# Temporada: …`, `# Filtros: Período=Últimos 5; …`, `# Base: …`,
  `# Orden: …`, `# Generado: …`, `# Usuario: …`, `# Celda vacía = dato inexistente (—)`; fila de títulos (pct → "eFG% (%)");
  valores: número por `fmt` (pct ×100 con 1 decimal, dec2 2 decimales, int entero; sin separador de miles), `null` → vacío;
  texto entrecomillado si contiene sep, comillas o salto de línea (comillas duplicadas); `\r\n`; prefijo BOM `﻿`;
  `new Blob([...], {type: "text/csv;charset=utf-8"})`. Anti-inyección de fórmulas: texto que empieza con `= + - @` → prefijo `'`.
- `toPNG(node, {width}) -> Promise<Blob>`: clona el nodo; reemplaza cada `<canvas>` por `<img src=canvas.toDataURL()>`; copia
  estilos computados relevantes inline (recorrido del árbol con `getComputedStyle`, lista blanca de propiedades); arma
  `<svg xmlns width height><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">…</div></foreignObject></svg>`;
  `Image` desde `data:image/svg+xml;charset=utf-8,…`; dibuja en `<canvas>` con `devicePixelRatio` (máx. 2); `canvas.toBlob("image/png")`.
  Si falla (`SecurityError` por canvas contaminado en Safari/iOS, R-09) → rechaza y el menú muestra el toast de fallback a PDF.
- `printNode(node, {pageSize})`: inserta `#print-root` con el clon + cabecera y la clase `body.printing`; `window.print()`;
  limpia en `afterprint`. CSS `@media print`: oculta todo salvo `#print-root`, `@page { size: A4; margin: 12mm }`, tablas con
  `thead { display: table-header-group }` y `tr { break-inside: avoid }`, colores con `print-color-adjust: exact`.
- `downloadBlob(blob, fileName)`: `URL.createObjectURL` + `<a download>` + `revokeObjectURL` diferido.
- `buildExportNode(node, meta, pageInfo) -> HTMLElement` (interno): contenedor con cabecera (título, entidad, competencia y
  temporada, filtros, base, orden, "Generado el 23/09/2026 14:05 por nico", `pageInfo`) + clon del nodo, ancho fijo.
- `tableToData(tableEl, meta) -> {meta, columns, rows}` (interno, para tablas no migradas).

### 6.4 Migración de las vistas (`app.js`)

| Vista | Hoy | Después |
|---|---|---|
| Liga → Ranking | `_leagueTableHTML`/`_sortedLeague`/`_bindLeagueTableEvents`/`_bindLeagueRowClicks` | `createDataTable(el, {tableId: "league_teams", payload: await api.table("league_teams", {competition})})`; clic de fila → equipo (conserva comportamiento). El mapa de liga sigue con `api.league` |
| Liga → Tabla general | `_standingsCardHTML` | `createDataTable` con `league_standings` |
| Equipo → Game log | `<table>` en `_renderTeamContent` | `createDataTable` con `team_game_log` (`competition`, `last` de las pills existentes) |
| Jugador → Game log | `<table>` en `_renderPlayerContent` | `createDataTable` con `player_game_log` |
| Buscar | `_renderSearchResults`/`SEARCH_COLS`/`_applySearch` | `createDataTable` con `search_players` y `rowFilter` = filtros actuales del buscador (texto, equipo, posición, mínimos); `filterLabels` para la cabecera |
| Equipo → Cierres | `_drawClutchTable` | `createDataTable` con `clutch_games` |
| Exportación en las 7 restantes | — | `exportMenu` en: `_renderUsageRanking`, `renderTeamOnOff`, `renderTeamLineup`, `renderCompare` (2 tablas), `_fourFactorsCard`, `_gamesTable` (Importar), `_shotDetailGrid` |
| Importar → "Exportar todo" (NUEVO bloque) | — | selector "Alcance: Equipo · Competencia", select de competencia (de `api.competitions()`), select de equipo (de `api.teams()`), botón "Exportar XLSX" → `api.exportBulk({scope, team, competition})` |

Las funciones reemplazadas se eliminan de `app.js` (sin usos restantes); `_cmpNullsLast` de `dev` ya fue movida a
`core/format.js` por C-11.

### 6.5 Estados y mobile

Estados de la spec §6 (spinner, vacío, error con "Reintentar", sin conexión, éxito). CSS nuevo:
`.dt-toolbar`, `.dt-table` (hereda `.search-table`), `.dt-sticky`, `.dt-row-low`, `.dt-foot`, `.dt-sort-asc/desc`,
`.dt-pager`, `.dt-colpanel`, `.dt-sheet` (hoja inferior en <768 px, fija abajo por encima de la nav inferior), `.xm-menu`,
`#print-root` y `@media print`. En <768 px la barra de herramientas usa íconos con `aria-label`.

## 7. Navegación
Sin vistas ni hashes nuevos (X-01 aún no existe). La exportación masiva vive en la vista Importar (Arq. §9.2 I-17); X-01 la
mueve a `#/datos/exportar`. `docs/frontend.md` documenta el bloque nuevo de Importar y la barra de herramientas de las tablas.

## 8. Contratos de datos
- Payload de tabla: Arq. §7.6 + extensiones PROPUESTA `row_kind`, `row_count`, columnas `type: "value"` (`{key, label, type:
  "value", fmt, direction, default_visible}`), `totals.label`/`competition_avg.label`.
- Metadatos de exportación: Arq. §7.7 (el servidor completa todo salvo `sort` y `columns_visible`, que agrega el cliente).
- Body de `POST /api/export/xlsx`: §3.2 (con `footer` opcional PROPUESTA).
- Preferencias (F-13): `table.columns/<table_id>` = `["_date", "oer", …]`; `table.sort/<table_id>` = `{"key": "oer", "dir":
  "desc"}`; `table.colorize/<table_id>` = `true|false`.
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | Caso | Mensaje (UI) |
|---|---|---|
| 400 `parametro_invalido` | falta parámetro, base inválida, body XLSX inválido | el `error` del servidor |
| 400 `contexto_invalido` / `competencia_inexistente` | contexto mal formado | el `error` del servidor |
| 401 | sesión vencida | handler existente (vuelve al login) |
| 404 `no_encontrado` | tabla/equipo/jugador inexistente, bulk sin datos | "Tabla inexistente" / "No hay datos para exportar en esta selección." |
| 413 | XLSX demasiado grande | "La tabla es demasiado grande para exportar en XLSX; exportá en CSV." |
| red caída | fetch rechazado | "Sin conexión. No se pudo cargar la tabla." / aviso XLSX / bulk |
Service worker: agregar `/js/components/data-table.js`, `/js/components/export-menu.js`, `/js/components/exporters.js` a
`STATIC` y subir `CACHE` al siguiente entero (p. ej. `smart-basket-v1N`, número asignado al integrar, Arq. §3.13). Con los
módulos en caché, CSV/PNG/PDF funcionan offline sobre la tabla ya cargada.

## 10. Riesgos / decisiones

- **R-1 PNG en Safari/iOS** (Arq. R-09): `foreignObject` puede contaminar el canvas o no cargar fuentes. Mitigación: fallback
  a PDF con aviso; prueba en iOS registrada en `progress.md`; si falla sistemáticamente, DA-19 prevé vendorizar html2canvas
  (requiere aprobación: Constitución 2).
- **R-2 Consistencia "lo que está en pantalla"**: el cliente envía al XLSX exactamente las filas/columnas que ordenó; el
  servidor no recalcula. Riesgo: redondeo — el XLSX recibe valores crudos (no formateados) y aplica formato por `fmt`, igual que
  la pantalla (`fmtMetric` usa los mismos decimales del catálogo).
- **R-3 Tamaño del payload**: 1.000+ quintetos × ~65 columnas ≈ 65 mil números (~600 KB JSON sin comprimir). Aceptable; si
  hace falta, Flask-Compress no se agrega (dependencia): se recomienda gzip en el proxy de Render (fuera de alcance).
- **R-4 Muestra de `clutch_games`**: la fila es un partido; su badge usa `sample.split.min/high` sobre posesiones del tramo
  (es un split por período). Decisión propia, reversible.
- **R-5 Promedio de competencia en base ≠ partido**: `population.league_reference` (Arq. §3.6) no recibe base. En fase 1 solo
  existen `total` y `partido`; para `total` se usa la media de los totales de las entidades — requiere `base` en la población.
  PROPUESTA: kwarg `base: str = "partido"` en `population()`/`league_reference()` (hueco reportado).
- **R-6 Performance de `_game_population`**: primera carga de un game log de jugador en una temporada completa ≈ 4.800
  bundles. Mitigación: caché `tables:gamepop` por competencia y contexto; medir en `progress.md`.
- **Decisiones**: paginación (no scroll virtual); percentil de partidos contra partidos (spec §9 D-6); CSV con celdas vacías
  para nulos; tablas de métricas-en-filas sin migrar (D-8); exportación masiva con columnas completas (D-9).
- **Desviaciones respecto de la arquitectura**: ninguna de contrato. Extensiones PROPUESTA (compatibles, T-06 es dueño de
  §7.6 y `data-table.js`): `row_kind`, `row_count`, columnas `type: "value"`, `footer` en el body XLSX, opciones `rowFilter` y
  `filterLabels` de `createDataTable`, namespaces de caché `tables:<id>` y `tables:gamepop`, constante `APP_VERSION`.
  Extensiones a módulos de otros dueños (PROPUESTA): `metrics_catalog.load_game_bundles`, `stats_engine.sum_bundles`,
  `base` en `population.league_reference`.
- **Incrementos diferidos**: T-03 (dimensiones de contexto: la tabla ya las acepta vía `parse_context`); T-04 (`por40`/`por100`:
  vía `apply_base`); X-01 (reubicar exportación masiva en `datos/exportar`); F-21 (traducir cabeceras de exportación con
  `backend/i18n.py`); F-05/F-06/F-08 (migrar Comparar, ON/OFF, combinación y ranking de uso al componente).

**Dependencias técnicas**
- T-05 ([../13-T-05-conjunto-estandar-metricas/plan.md](../13-T-05-conjunto-estandar-metricas/plan.md)): `metrics_catalog.METRICS`,
  `GROUPS`, `EntityRequest`, loaders `team`/`player`/`clutch`; `stats_engine.StatBundle`, `compute_standard`, `apply_base`;
  `core/catalog.js` (`metricLabel`, `metricDef`, `groupsFor`), `fmtMetric`.
- T-01 ([../15-T-01-ficha-de-metrica/plan.md](../15-T-01-ficha-de-metrica/plan.md)): `population.population`, `percentile`,
  `league_reference`; `core/colors.js` `percentileBg`.
- T-02 ([../14-T-02-confiabilidad-muestra/plan.md](../14-T-02-confiabilidad-muestra/plan.md)): `sample.sample_level`,
  `sample.adjusted`; `components/sample-badge.js`.
- C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)): `core/format.js` (`cmpNullsLast`,
  `nullDisplay`, `NULL_REASON_LABELS`, `fmtNumber`), `core/i18n.js` (`t`).
- F-13 ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md)): `config.get`, `CONFIG_SPEC`, `prefs.current_owner`,
  `core/prefs.js` (`getPref`, `setPref`), `GET /api/settings`.
- C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md)): `context.parse_context`, `context_echo`.
- F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)): `repository.resolve_competition`,
  `cache.memo`, `competitions.list_competitions`.
- C-09 ([../06-C-09-tabla-general-liga/plan.md](../06-C-09-tabla-general-liga/plan.md)) y C-06 ([../05-C-06-umbral-cierres/plan.md](../05-C-06-umbral-cierres/plan.md)):
  cálculo de tabla general y de cierres que los builders reutilizan.
- C-08 ([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md)): `player_id` en buscador y game log.

**Estimación: XL · 30–40 h** (backend `tables.py` + builders 10–13 h; `export_xlsx.py` 4–5 h; `data-table.js` 6–8 h;
exportadores + menú 5–7 h; migración de 6 tablas + 7 botones + bloque masivo 3–4 h; verificación y docs 2–3 h).
