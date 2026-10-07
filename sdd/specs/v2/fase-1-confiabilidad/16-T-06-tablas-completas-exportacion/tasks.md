# Tasks — T-06: Tablas completas y exportación

> **ID:** T-06 · **Prioridad:** P0 · **Fase y orden:** 1·16
> **Depende de:** T-05, T-01, T-02, C-11, F-13 (y C-02, C-06, C-09, C-08, F-11 vía ellos) · **Habilita:** F-08, F-06, F-07, F-03, F-10, F-18, F-21
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** Especificación v2 §3 · T-06 · Arquitectura §3.11 · [plan.md](plan.md) · [spec.md](spec.md)

## Orden de ejecución

Los grupos se ejecutan en secuencia. El Grupo B no arranca hasta que T-05 (`StatBundle`, `compute_standard`, `apply_base`,
`EntityRequest`, loaders), T-01 (`population`) y T-02 (`sample`) estén cerrados; el Grupo D2 usa `core/prefs.js` de F-13,
`core/catalog.js`/`fmtMetric` de T-05, `core/colors.js` de T-01 y `components/sample-badge.js` de T-02.

### Grupo A — Backend: configuración (sin cambios de esquema)
- [ ] T-A1 · Activar (`status: activa`) `table.page_size` (int, 50, 10–500, sección Preferencias) y `export.csv_separator` (enum `;`|`,`, `;`, sección Preferencias), que F-13 deja declaradas como reservadas; si no estuvieran declaradas, agregarlas con esos valores · `backend/config.py` (F-13) · cubre RF-7, RF-16 · Done: `curl -b cookies.txt http://localhost:5000/api/settings` lista ambas claves con su default, rango y sección; `PUT /api/settings {"values":{"table.page_size":5}}` → 400 (fuera de rango)
- (Sin modelos ni `upgrade_db()`: T-06 no cambia el esquema.)

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `sum_bundles(bundles) -> StatBundle` (suma `own`, `opp`, `team`, `games`, `minutes`, `team_minutes`, `seconds`, `on_court`, `shots`; un `None` en un conteo de un sumando deja el total `None`; `null_reasons` = unión) · `backend/stats_engine.py` · cubre RF-4 · Done: en `python -c` con app context, `sum_bundles([b1, b2]).own["pts"] == b1.own["pts"] + b2.own["pts"]` y con un conteo `None` en `b2` el total queda `None` y `compute_standard` devuelve esa métrica con razón `no_registrado`
- [ ] T-B2 · `load_game_bundles(req: EntityRequest) -> list[tuple[dict, StatBundle]]` sobre los loaders `team`, `player` y `clutch` de T-05 (dict de partido `{game_id, date, opponent_code, opponent, home_away, team_pts, opp_pts, played}`) · `backend/metrics_catalog.py` · cubre RF-1, RF-10 · Done: para un equipo del seed la cantidad de tuplas = partidos del equipo en la competencia y `Σ team_pts` = Σ `pts` de `/api/team/<code>`; para un jugador con DNP la tupla trae `played == False`
- [ ] T-B3 · `TableError`, `TableRequest`, `TableDef`, `_REGISTRY`, `register_table(...)` (con kwargs `row_kind`, `required_params`, `extra_columns`, `default_sort`, `totals_mode`, `avg_mode`, `title_fn`), `_slug`, `_file_name`, `_filters_meta`, constante `APP_VERSION` · `backend/tables.py` (NUEVO) · cubre RF-14, RF-15 · Done: `_slug("Liga Uruguaya de Básquetbol 2025/2026") == "liga-uruguaya-de-basquetbol-2025-2026"` y `_file_name("quintetos", "CNF", "Liga X 2025/2026", "2026-09-23") == "quintetos_CNF_liga-x-2025-2026_2026-09-23"`
- [ ] T-B4 · `build_table` pasos 1–4, 6–9 y 16: validación (404 tabla inexistente, 400 parámetro faltante o base inválida), contexto, `compute_standard` + `apply_base` por fila, armado de `columns` (texto + `_sample` + todas las claves de `METRICS` del tipo, más las del conjunto obligatorio no aplicables como `no_aplica`), `values`/`reasons` alineados, `row_count` · `backend/tables.py` · cubre RF-1, RF-6, RF-20 · Done: con una tabla de prueba registrada en `python -c`, `len(row["values"]) == len(payload["columns"])` en todas las filas y toda clave del catálogo aplicable aparece (CA-12)
- [ ] T-B5 · Percentiles (paso 10): `row_kind == "entity"` con `population.population` + `population.percentile` (misma población que la ficha T-01) y `row_kind == "game"` con `_game_population` (una pasada por competencia y contexto, todas las claves a la vez); `pct` nulo para columnas de texto, neutrales, valores nulos y `competition=all` · `backend/tables.py` · cubre RF-5, RF-20 · Done: el `pct` de `oer` del equipo X en `league_teams` == `percentile` de `GET /api/metrics/team?id=X&competition=<id>` (diferencia 0); métrica `direction == neutral` (p. ej. `fg3_uso`) → `pct` null
- [ ] T-B6 · Muestra y ajustado (pasos 11–12), totales (paso 13), promedio de competencia (paso 14: `population.league_reference`; PROPUESTA `base` en esa función si T-01 no la trae, reportado en §10 del plan), `meta` §7.7 con `generated_by = prefs.current_owner()` (o `_open` si no hay sesión) y `default_sort` · `backend/tables.py` · cubre RF-4, RF-8, RF-14, RF-2 · Done: `totals.values` del game log de un equipo == métricas de `GET /api/metrics/team?id=<code>&competition=<id>&base=partido` (CA-4); `competition_avg` == `league_reference`
- [ ] T-B7 · Builders de `league_teams` y `league_standings` (usa `stats_engine.standings_row`/`standings_sort_key`; con "Todas" y varias competencias → 400 "Elegí una competencia para ver la tabla general.") · `backend/tables.py` · cubre RF-10 · Done: `GET /api/table/league_standings?competition=1` devuelve 14 filas ordenadas por `_pos` y cada `_table_points` == `standings_pos`/`table_points` de `/api/league?competition=1`; `league_teams` trae `net_rating`, `pace`, `efg_pct`… con la misma competencia
- [ ] T-B8 · Builders de `team_game_log` y `player_game_log` (textos `_date`, `_opponent`, `_venue`, `_result`; DNP como fila con todas las métricas `null` razón `dnp`; totales sin DNP) · `backend/tables.py` · cubre RF-10, RF-1 · Done: `GET /api/table/team_game_log?team=TRO&competition=1` trae tantas filas como `games` de `/api/team/TRO?` y `_result` del total = récord "G-P"; el game log de un jugador con DNP lo incluye con "—" y razón `dnp`
- [ ] T-B9 · Builders de `search_players` (por `player_id`, `team` opcional, `_position` FIBA más frecuente) y `clutch_games` (`team_clutch(...)["per_game"]` → bundles, columnas de `CLUTCH_COLS`) · `backend/tables.py` · cubre RF-10 · Done: `GET /api/table/search_players?competition=1` trae tantas filas como jugadores únicos de `/api/search/players?competition=1`; `GET /api/table/clutch_games?team=TRO&competition=1` trae `games_qualified` filas de `/api/clutch/TRO`
- [ ] T-B10 · `export_xlsx.workbook_bytes(sheets, meta)`: validación (1–20 hojas, nombres saneados y únicos ≤ 31 caracteres, filas del largo de `columns`), SpreadsheetML mínimo con `zipfile` (Portada, hojas de datos con números nativos, estilos de formato, fila de títulos y primera columna fijas, `footer`), `docProps/core.xml` · `backend/export_xlsx.py` (NUEVO) · cubre RF-12, RF-14, RF-17, RF-19 · Done: un archivo generado desde `python -c` abre en LibreOffice sin pedir reparación; `unzip -t` sin errores; celdas numéricas con `t` ausente y texto con `inlineStr`
- [ ] T-B11 · `bulk_workbook(scope, scope_id, comp_id)`: hoja por tabla con `bulk_scopes`, columnas completas, `footer`, tablas sin filas anotadas en la Portada · `backend/tables.py` · cubre RF-18 · Done: `bulk_workbook("team", "TRO", 1)` devuelve bytes con hojas "Partido a partido", "Cierres por partido" y "Jugadores" más "Portada"
- [ ] T-B12 · Rutas finas `GET /api/table/<table_id>`, `POST /api/export/xlsx` (413 por `content_length` > 10 MB o > 50.000 filas en una hoja; 400 cuerpo inválido), `GET /api/export/bulk` (400 alcance, 400 `competition=all`, 404 sin datos); `import tables` en `app.py` para registrar las tablas · `backend/app.py` · cubre RF-6, RF-12, RF-18 · Done: los errores de CA-13 responden 404/400/400/413 con mensaje en español y `code`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `apiFetchBlob(path, opts)` (mismo manejo de 401 y de error JSON que `apiFetch`; `fileName` desde `Content-Disposition`), `api.table`, `api.exportXlsx`, `api.exportBulk` (y `qs` si T-05 aún no lo agregó) · `frontend/js/api.js` · cubre RF-6, RF-12, RF-18 · Done: desde la consola del navegador `await api.table("league_teams", {competition: 1})` devuelve el payload y `await api.exportBulk({scope:"competition", competition:1})` devuelve `{blob, fileName}`

### Grupo D — Frontend: UI
- [ ] T-D1 · Mover `_cmpNullsLast` de `app.js` a `core/format.js` como `export function cmpNullsLast(av, bv, dir)` (misma lógica); `app.js` la importa y se eliminan las referencias a `_cmpNullsLast` · `frontend/js/core/format.js`, `frontend/js/app.js` · cubre RF-2 · Done: `grep -n "_cmpNullsLast" frontend/js/app.js` sin resultados y Liga/Buscador/Cierres siguen ordenando con nulos al final
- [ ] T-D2 · `toCSV`, `downloadBlob`, `tableToData`, `buildExportNode` (cabecera con título, entidad, competencia, temporada, filtros, base, orden, "Generado el … por …", `pageInfo`) · `frontend/js/components/exporters.js` (NUEVO) · cubre RF-12, RF-13, RF-14, RF-15, RF-16, RF-19 · Done: en consola, `toCSV` de un payload de prueba produce BOM, líneas `# clave: valor`, separador `;`, decimal coma, nulos vacíos y texto con `=`/`+`/`-`/`@` prefijado con `'`
- [ ] T-D3 · `toPNG(node, {width})` (SVG `foreignObject`, canvases a `<img>`, estilos computados inline, `devicePixelRatio` máx. 2) y `printNode(node, {pageSize})` (`#print-root`, `body.printing`, `afterprint`) · `frontend/js/components/exporters.js` · cubre RF-12 · Done: PNG de una tabla en Chromium abre como imagen con cabecera y filas; `window.print()` muestra solo `#print-root` en A4
- [ ] T-D4 · `createDataTable(el, {tableId, payload, onRowClick, rowFilter, filterLabels, title, exportFormats})`: estado (columnas/orden/colores/`page_size` desde `getPref` y `GET /api/settings`), orden con `cmpNullsLast` y valor ajustado, barra de herramientas, `<thead>` con `aria-sort`, `<tbody>` paginado con celdas de `fmtMetric`/`nullDisplay`/`percentileBg`/`sampleBadge`, filas `dt-row-low`, `<tfoot>` (totales y promedio), paginación con "Ver todas", columna fija, selector de columnas por grupo con "Restablecer", `getState`, `setPayload`, `destroy` · `frontend/js/components/data-table.js` (NUEVO) · cubre RF-1, RF-2, RF-3, RF-5, RF-7, RF-8, RF-9, RF-19 · Done: con el payload de `league_teams` la tabla muestra las columnas por defecto, ordena por cualquier columna con nulos al final en ambos sentidos y el selector de columnas lista todos los grupos de T-05
- [ ] T-D5 · `exportMenu(el, {getData, getNode, formats})`: botón + menú CSV/XLSX/PNG/PDF (hoja inferior en móvil), estado "Generando archivo…", toasts de éxito y error, aviso sin conexión para XLSX, fallback a PDF si PNG falla · `frontend/js/components/export-menu.js` (NUEVO) · cubre RF-11, RF-12, RF-13 · Done: desde `league_teams` los cuatro formatos descargan archivos con el nombre `ranking-liga_liga_<competencia>_<fecha>.<ext>`
- [ ] T-D6 · Estilos `.dt-toolbar`, `.dt-table`, `.dt-sticky`, `.dt-row-low`, `.dt-foot`, `.dt-sort-asc/desc`, `.dt-pager`, `.dt-colpanel`, `.dt-sheet`, `.xm-menu`, `#print-root` y `@media print` (A4, `print-color-adjust: exact`, `thead` repetido) · `frontend/css/style.css` · cubre RF-5, RF-8, RF-9, RF-12 · Done: en 360 px la tabla se desplaza dentro de su tarjeta con la primera columna fija, sin scroll horizontal de la página
- [ ] T-D7 · Migrar Liga → Ranking (`league_teams`) y Liga → Tabla general (`league_standings`, con el mensaje de "Todas" de C-09); eliminar `_leagueTableHTML`, `_sortedLeague`, `_bindLeagueTableEvents`, `_standingsCardHTML` si quedan sin usos · `frontend/js/app.js` · cubre RF-10 · Done: la tabla del navegador coincide fila por fila con `/api/table/league_teams?competition=1`; clic en una fila abre el equipo
- [ ] T-D8 · Migrar Equipo → Game log (`team_game_log`) y Jugador → Game log (`player_game_log`) respetando competencia y "Últ. N" de las pills · `frontend/js/app.js` · cubre RF-10, RF-6 · Done: al cambiar competencia o "Últ. 5" el payload se pide de nuevo y el pie se recalcula (el eco `context` cambia)
- [ ] T-D9 · Migrar Buscar (`search_players`, `rowFilter` con los filtros actuales y `filterLabels`) y Equipo → Cierres (`clutch_games`); eliminar `SEARCH_COLS`, `_renderSearchResults`, `_drawClutchTable`, `CLUTCH_COLS` si quedan sin usos · `frontend/js/app.js` · cubre RF-10 · Done: los filtros del buscador siguen funcionando y el contador muestra las filas filtradas; Cierres conserva el título y el recuento de C-06
- [ ] T-D10 [P] · Agregar `exportMenu` con `tableToData` a las 7 tablas restantes: ranking de uso (`_renderUsageRanking`), ON/OFF (`renderTeamOnOff`), combinación (`renderTeamLineup`), Comparar (`renderCompare`, las dos tablas), Four Factors (`_fourFactorsCard`), catálogo de partidos (`_gamesTable`) y detalle de tiro (`_shotDetailGrid`) · `frontend/js/app.js` · cubre RF-11 · Done: las 13 tablas del inventario de spec §0 tienen botón "Exportar" visible
- [ ] T-D11 · Bloque "Exportar todo" en Importar: alcance Equipo/Competencia, selects de competencia y equipo, botón "Exportar XLSX" con estados · `frontend/js/app.js`, `frontend/css/style.css` · cubre RF-18 · Done: el botón descarga `exportacion_<TRO|competencia>_<slug>_<fecha>.xlsx`

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados de la tabla: spinner, vacío ("No hay datos para esta selección." / "Probá con otro período o competencia."), error con "Reintentar", sin conexión ("Sin conexión. No se pudo cargar la tabla."); toast al fallar el guardado de preferencias · `frontend/js/components/data-table.js` · cubre RF-3, RF-6 · Done: con el backend detenido se ve el mensaje de sin conexión; con `team` inexistente se ve el mensaje del servidor y el botón Reintentar
- [ ] T-E2 · Mensajes del menú de exportación (XLSX sin conexión, 413, PNG fallido, bulk sin datos o sin conexión) · `frontend/js/components/export-menu.js`, `frontend/js/app.js` · cubre RF-12, RF-18 · Done: en DevTools → Network → Offline, CSV/PNG/PDF funcionan y XLSX muestra "Sin conexión: el XLSX se genera en el servidor. Probá con CSV."
- [ ] T-E3 · Agregar `/js/components/data-table.js`, `/js/components/export-menu.js` y `/js/components/exporters.js` a `STATIC` y subir `CACHE` al siguiente entero al vigente (hoy `smart-basket-v13`) · `frontend/sw.js` · cubre RF-11 · Done: tras recargar, DevTools → Application → Cache Storage muestra la nueva versión con los tres módulos y, offline, la tabla ya cargada se exporta a CSV

### Grupo F — Verificación de feature
Dataset: los 13 partidos del seed ("Liga de Ascenso 2026", competencia 1) con la ingesta v2; para CA-3 dos usuarios en `AUTH_USERS`.
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` idempotente: no aplica (sin cambios de esquema); igualmente `python backend/database.py` corre 2 veces sin error
- [ ] T-F3 · Endpoints probados con curl (con `-b cookies.txt` tras `POST /api/login`): `curl "http://localhost:5000/api/table/league_teams?competition=1"`, `…/api/table/league_standings?competition=1`, `…/api/table/team_game_log?team=TRO&competition=1&last=5&base=partido`, `…/api/table/player_game_log?player_id=<id>&competition=1`, `…/api/table/search_players?competition=1`, `…/api/table/clutch_games?team=TRO&competition=1`, `curl -X POST -H "Content-Type: application/json" -d '{…}' http://localhost:5000/api/export/xlsx -o t.xlsx`, `curl "http://localhost:5000/api/export/bulk?scope=team&team=TRO&competition=1" -o b.xlsx`; shapes verificados contra plan §3.1–§3.3
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Liga, Equipo (Resumen, Game log, Cierres), Jugador, Buscar, Comparar e Importar
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`
- [ ] T-F6 · CA-1 (cliente): para cada una de las 13 tablas del inventario, con competencia 1 y "Últ. 5", un orden y columnas personalizadas, exportar CSV, XLSX, PNG y PDF; comparar cabecera, columnas visibles en el mismo orden, filas y valores contra la pantalla; registrar una tabla por fila en `progress.md`
- [ ] T-F7 · CA-2: en Buscar ordenar por USO% asc y desc con jugadores de USO% nulo; "—" al final en ambos sentidos y los ceros reales ordenados como números
- [ ] T-F8 · CA-3: con dos usuarios, A oculta 3 columnas y agrega 2 en el game log de equipo; recargar, abrir en otro navegador y entrar como B; verificar `GET /api/prefs?scope=table.columns` de cada uno y que `player_game_log` de A no cambió
- [ ] T-F9 · CA-4: con base "partido", `totals.values` de `team_game_log` == `GET /api/metrics/team?id=TRO&competition=1&base=partido` y `competition_avg` == promedio de referencia de T-01 para cada métrica (script ad hoc con `app.test_client()` que compara claves comunes)
- [ ] T-F10 · CA-5: desactivar "Colores": ninguna celda con `background` en el DOM; reactivar: nulas, de texto y neutrales (`fg3_uso`) sin color; recargar y comprobar que se recuerda (`table.colorize`)
- [ ] T-F11 · CA-6: cambiar competencia, "Últ. 5" y base Totales/Por partido en el game log; en cada cambio el `context` y `base` del payload (Network) reflejan la selección y los totales cambian
- [ ] T-F12 · CA-7: bajar `table.page_size` a 10 desde Configuración (o `PUT /api/settings`), abrir Buscar: "Página 1 de N · <total> filas"; "Ver todas" muestra todas y el total == `row_count` de `/api/table/search_players`; restaurar el default con `POST /api/settings/reset`
- [ ] T-F13 · CA-8: abrir el CSV en un editor (BOM `EF BB BF`, líneas `# clave: valor`, `;`, decimal coma, nulos vacíos, nombre `<apartado>_<entidad>_<competencia-slug>_<fecha>.csv`) y en Excel es-UY (columnas separadas, números sumables)
- [ ] T-F14 · CA-9: abrir el XLSX en Excel y LibreOffice sin reparación; "Portada" con metadatos; números nativos sumables; porcentajes con formato %
- [ ] T-F15 · CA-10: con paginación activa exportar PNG y PDF; la cabecera dice "Filas 1–10 de <total>" y se ve solo la página visible
- [ ] T-F16 · CA-11: exportación masiva de un equipo y de la competencia desde Importar; "Portada" + una hoja por tabla con `bulk_scopes`; comparar una hoja con la tabla en pantalla (columnas completas); cronometrar y registrar el tiempo (< 60 s)
- [ ] T-F17 · CA-12: en cada tabla migrada, el selector de columnas lista todas las claves de `GET /api/metrics-catalog` aplicables al tipo (comparar listas con `jq`); las no aplicables muestran "—" con su razón en el `title`
- [ ] T-F18 · CA-13: `curl -i …/api/table/no_existe` (404 `no_encontrado`), `…/api/table/team_game_log` sin `team` (400 `parametro_invalido`), `curl -i -X POST -d '{' …/api/export/xlsx` (400), POST con una hoja de 50.001 filas (413)
- [ ] T-F19 · CA-14: usar una copia de la base con `blk_received` en `NULL` (partidos sin reprocesar) y un jugador con DNP: celda "—" sin color, al final al ordenar y vacía en CSV/XLSX
- [ ] T-F20 · CA-15: en Buscar (jugadores de pocos minutos) y en Cierres, las filas de muestra baja se ven en gris con advertencia y aparecen en CSV/XLSX
- [ ] T-F21 · CA-16: DevTools → Network → Offline con una tabla cargada: CSV, PNG y PDF generan archivo; XLSX muestra el aviso
- [ ] T-F22 · CA-17: emulación de 360 px: sin scroll horizontal de página, primera columna fija, selector de columnas y menú de exportación como hoja inferior, consola sin errores
- [ ] T-F23 · PNG en iOS/Safari (riesgo R-1): probar la exportación PNG en un iPhone o iPad real o emulado y registrar el resultado en `progress.md`; si falla, anotar el fallback a PDF

### Grupo G — (diferido)
- [ ] T-G1 · (diferido → T-03) Dimensiones de contexto distintas de `competition` y `last`: la tabla ya acepta el contexto por `parse_context`; verificar que los filtros nuevos aparecen en la cabecera de exportación
- [ ] T-G2 · (diferido → T-04) Bases `por40` y `por100`: verificar que `apply_base` las aplica a las tablas y que la cabecera de exportación las documenta
- [ ] T-G3 · (diferido → X-01) Reubicar el bloque "Exportar todo" en `#/datos/exportar`
- [ ] T-G4 · (diferido → F-21) Traducir cabeceras de exportación y etiquetas de la Portada
- [ ] T-G5 · (diferido → F-05, F-06, F-08) Migrar Comparar, ON/OFF, combinación y ranking de uso a `createDataTable`; registrar `team_roster`, `team_lineups`, `team_onoff` y verificar más de mil filas de quintetos

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B3, T-B4, T-B6, T-B10, T-D2, T-D3, T-D4, T-D5, T-D7…T-D10, T-F6 |
| CA-2 | T-D1, T-D4, T-F7 |
| CA-3 | T-D4, T-E1, T-F8 |
| CA-4 | T-B1, T-B2, T-B6, T-B8, T-F9 |
| CA-5 | T-B5, T-D4, T-D6, T-F10 |
| CA-6 | T-B4, T-D8, T-F11 |
| CA-7 | T-A1, T-D4, T-F12 |
| CA-8 | T-A1, T-D2, T-F13 |
| CA-9 | T-B10, T-B12, T-F14 |
| CA-10 | T-D2, T-D3, T-D4, T-F15 |
| CA-11 | T-B9, T-B11, T-B12, T-D11, T-F16 |
| CA-12 | T-B4, T-D4, T-F17 |
| CA-13 | T-B12, T-F18 |
| CA-14 | T-B1, T-B5, T-D4, T-F19 |
| CA-15 | T-B6, T-D4, T-D6, T-F20 |
| CA-16 | T-D5, T-E2, T-E3, T-F21 |
| CA-17 | T-D4, T-D5, T-D6, T-F22 |

## Dependencias externas
- T-05 cerrada (`StatBundle`, `compute_standard`, `apply_base`, `EntityRequest`, loaders `team`/`player`/`clutch`, `GET /api/metrics-catalog`, `core/catalog.js`, `fmtMetric`, `qs`), T-01 cerrada (`population`, `core/colors.js`), T-02 cerrada (`sample`, `components/sample-badge.js`), F-13 cerrada (`config.py`, `prefs.py`, `core/prefs.js`, `GET/PUT /api/prefs`, `GET /api/settings`), C-02 (`context.py` con `competition`/`last`), C-08 (`player_id` en buscador y game log).
- Ya implementados y usados tal cual: C-11 (`core/format.js`), C-09 (`standings_row`, `standings_sort_key`, `standings_pos`), C-06 (`clutch.team_clutch`), F-11 (`competitions.resolve`, `competitions.visible`, `ingest`).
- `cache.py` es opcional (no existe hoy; ver plan §4.1 paso 5).
- Dataset de verificación: 13 partidos del seed con ingesta v2; una copia de la base con campos en `NULL` (CA-14) y, para CA-3, `AUTH_USERS` con dos usuarios. Para CA-1 con quintetos se espera a F-06 (T-G5).
- Navegador de verificación: Chromium/Firefox de escritorio, emulación de 360 px y un dispositivo iOS para T-F23.
