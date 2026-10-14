# Progress — T-06: Tablas completas y exportación

> **Estado:** ✅ Implementado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md) · Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

## Estado de tareas
Grupos A–E completos (T-A1, T-B1…T-B12, T-C1, T-D1…T-D11, T-E1…T-E3). Grupo F (verificación visual)
pendiente de navegador gráfico. Grupo G diferido (T-03, T-04, X-01, F-21, F-05/F-06/F-08).

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ (datos) / ⚠️ (visual) | 6 tablas migradas a `createDataTable`/`mountTable`, 8 tablas legacy con `exportMenu`; backend 6 builders verificados con `test_client`; CSV/XLSX/PNG/PDF no verificados visualmente |
| CA-2 (nulos al final) | ✅ | `cmpNullsLast` en `format.js` (migrado de `_cmpNullsLast`); `node --check` OK; sin `_cmpNullsLast` en app.js |
| CA-3 (preferencias por usuario) | ⚠️ | `getPref`/`setPref` integrados en `data-table.js` para columnas/orden/colores; sin verificación multi-usuario en navegador |
| CA-4 (totales) | ✅ | `build_table` paso 13 suma bundles; game log verificado con `test_client` |
| CA-5 (percentiles) | ✅ | `build_table` paso 10: entidad via `population.population`, partido via `_game_population`; `direction == neutral` pct null |
| CA-6 (cambio contexto) | ✅ | `mountTable` re-fetcha al cambiar competencia/last/base; team/player game log pasan loader con params actuales |
| CA-7 (paginación) | ✅ | `page_size` desde prefs/config; "Ver todas" desactiva paginación |
| CA-8 (CSV) | ✅ (lógica) | `toCSV`: BOM, `# clave: valor`, separador `;`, decimal coma, nulos vacíos, protección fórmulas; sin verificación en Excel real |
| CA-9 (XLSX) | ✅ (lógica) | `export_xlsx.py`: SpreadsheetML válido, números nativos, pane freeze, portada; `unzip -t` sin errores (T-B10 done-check) |
| CA-10 (PNG/PDF) | ⚠️ | `toPNG` y `printNode` implementados; sin verificación visual |
| CA-11 (bulk) | ✅ | `bulk_workbook`: Portada + hojas por tabla; `GET /api/export/bulk?scope=team&team=TRO&competition=1` 200 OK, 13 KB |
| CA-12 (selector columnas) | ✅ (lógica) | `data-table.js` selector por grupo del catálogo; sin verificación DOM visual |
| CA-13 (errores) | ✅ | 404 tabla inexistente, 400 param faltante verificados con `test_client` |
| CA-14 (nulos) | ✅ | `null` con razón `no_registrado`/`dnp` formateado "—" con `fmtMetric`; sin color ni ranking |
| CA-15 (muestra baja) | ✅ (lógica) | `sampleBadge` integrado; fila `.dt-row-low`; sin verificación visual |
| CA-16 (offline) | ⚠️ | CSV/PNG/PDF son client-side; XLSX muestra aviso; sw.js CACHE v23 con 3 módulos nuevos; sin verificación offline real |
| CA-17 (mobile) | ⚠️ | CSS mobile-first, columna fija, hoja inferior para selector/exportar; sin verificación a 360 px |

## Gates técnicos
- Backend arranca sin traceback: ✅ (`test_client` sin error)
- `upgrade_db()` idempotente (sin cambios de esquema): ✅
- Endpoints probados (`test_client`): ✅ (`league_teams` 14×78, `league_standings` 14×84, `team_game_log` 2×81, `search_players` 187×82, `clutch_games` ALB 1 row, `export/bulk` 13 KB)
- `node --check` sin errores en 8 JS: ✅
- Consola del navegador sin errores: ⚠️ sin verificación visual

## Archivos creados/modificados

### Backend (8 archivos)
- `backend/tables.py` (NUEVO): `TableDef`, `TableRequest`, `register_table`, `build_table` (16 pasos), `bulk_workbook`, 6 builders
- `backend/export_xlsx.py` (NUEVO): `workbook_bytes(sheets, meta)` — SpreadsheetML/OOXML con zipfile
- `backend/config.py`: `table.page_size` y `export.csv_separator` activadas
- `backend/metrics_catalog.py`: `load_game_bundles` ajustado para multi-type dispatch
- `backend/bundles.py`: player DNP handling, clutch game_loader
- `backend/clutch.py`: `clutch_game_bundles` + `_clutch_box_to_bundle`
- `backend/population.py`: `league_reference(..., base="partido")` kwarg
- `backend/app.py`: 3 rutas nuevas (`GET /api/table/<table_id>`, `POST /api/export/xlsx`, `GET /api/export/bulk`)

### Frontend (8 archivos)
- `frontend/js/components/data-table.js` (NUEVO): `createDataTable`, `mountTable`
- `frontend/js/components/export-menu.js` (NUEVO): `exportMenu`
- `frontend/js/components/exporters.js` (NUEVO): `toCSV`, `toPNG`, `printNode`, `downloadBlob`, `tableToData`, `buildExportNode`
- `frontend/js/api.js`: `apiFetchBlob`, `api.table`, `api.exportXlsx`, `api.exportBulk`
- `frontend/js/core/format.js`: `cmpNullsLast` exportado (migrado de `_cmpNullsLast` en app.js)
- `frontend/js/app.js`: 6 tablas migradas a `createDataTable`/`mountTable`, 8 legacy con `exportMenu`, bloque "Exportar todo", funciones legacy eliminadas
- `frontend/css/style.css`: estilos `.dt-*`, `.xm-*`, `#print-root`, `@media print`
- `frontend/sw.js`: CACHE v23, 3 módulos nuevos en STATIC

## Desviaciones respecto a docs/ o plan
- `mountTable` wrapper: no previsto en el plan pero necesario para el patrón fetch+spinner+error+retry que se repite en 5 de 6 tablas; `createDataTable` directa solo en search (que pre-filtra client-side).
- `_mountTableExport` y `_mountPanelExport`: helpers locales en app.js que envuelven `exportMenu` para tablas legacy (DOM `<table>`) y paneles (stat-boxes/tablas múltiples). No previstos como funciones separadas.
- T-D10 lista 7 tablas legacy; se implementaron 8 exports (compare tiene 2 tablas: box + advanced, cada una con su propio `_mountTableExport`).
- Clutch TRO 404: correcto, 0 partidos calificados para TRO en seed. ALB tiene 1 partido clutch.

## Rendimiento
- `build_table("league_teams", competition=1)`: instantáneo con caché (14 rows × 78 cols)
- `bulk_workbook("team", "TRO", 1)`: 13 KB, ~0.5 s en frío
- `search_players(competition=1)`: 187 rows × 82 cols, instantáneo cacheado

## Docs actualizados
- [x] `docs/api.md` — 3 endpoints nuevos (`GET /api/table`, `POST /api/export/xlsx`, `GET /api/export/bulk`)
- [x] `docs/frontend.md` — 3 componentes, estructura de archivos, tablas migradas, exportación, `@media print`
- [x] `docs/architecture.md` — módulos `tables.py` y `export_xlsx.py`, diagrama actualizado

## Deuda / TODO
- Verificación visual pendiente: selector de columnas DOM, paginación, colores, export PNG/PDF, mobile 360 px, offline, multi-usuario.
- PNG en iOS/Safari (riesgo R-1, T-F23): no probado.
- Tablas legacy pendientes de migración a `createDataTable` (T-G5, diferido a F-05/F-06/F-08): comparar, ON/OFF, combinación, ranking de uso.
