# Progress — T-06: Tablas completas y exportación

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · Activar `table.page_size` y `export.csv_separator` en `CONFIG_SPEC`
- [ ] T-B1 · `stats_engine.sum_bundles`
- [ ] T-B2 · `metrics_catalog.load_game_bundles`
- [ ] T-B3 · Registro de tablas y helpers de nombre de archivo
- [ ] T-B4 · `build_table`: validación, columnas y valores
- [ ] T-B5 · Percentiles por fila (entidad y partido)
- [ ] T-B6 · Muestra, totales, promedio de competencia y metadatos
- [ ] T-B7 · Builders `league_teams` y `league_standings`
- [ ] T-B8 · Builders `team_game_log` y `player_game_log`
- [ ] T-B9 · Builders `search_players` y `clutch_games`
- [ ] T-B10 · `export_xlsx.workbook_bytes`
- [ ] T-B11 · `bulk_workbook`
- [ ] T-B12 · Rutas `/api/table`, `/api/export/xlsx`, `/api/export/bulk`
- [ ] T-C1 · `apiFetchBlob`, `api.table`, `api.exportXlsx`, `api.exportBulk`
- [ ] T-D1 · `cmpNullsLast` a `core/format.js`
- [ ] T-D2 · `toCSV`, `downloadBlob`, `tableToData`, `buildExportNode`
- [ ] T-D3 · `toPNG` y `printNode`
- [ ] T-D4 · `components/data-table.js`
- [ ] T-D5 · `components/export-menu.js`
- [ ] T-D6 · Estilos de tabla, menú y `@media print`
- [ ] T-D7 · Migrar Liga: ranking y tabla general
- [ ] T-D8 · Migrar game logs de equipo y jugador
- [ ] T-D9 · Migrar Buscar y Cierres
- [ ] T-D10 · Botón de exportación en las 7 tablas restantes
- [ ] T-D11 · Bloque "Exportar todo" en Importar
- [ ] T-E1 · Estados de la tabla
- [ ] T-E2 · Mensajes del menú de exportación
- [ ] T-E3 · Service worker (`STATIC` y `CACHE`)
- [ ] T-F1 … T-F23 · Verificación de feature (checks obligatorios y un check por CA)
- [ ] T-G1 · (diferido → T-03) Dimensiones de contexto en la cabecera
- [ ] T-G2 · (diferido → T-04) Bases `por40` y `por100`
- [ ] T-G3 · (diferido → X-01) Reubicar "Exportar todo" en `#/datos/exportar`
- [ ] T-G4 · (diferido → F-21) Cabeceras de exportación traducidas
- [ ] T-G5 · (diferido → F-05, F-06, F-08) Migrar Comparar, ON/OFF, combinación y ranking de uso

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |
| CA-9 | ⬜ | |
| CA-10 | ⬜ | |
| CA-11 | ⬜ | |
| CA-12 | ⬜ | |
| CA-13 | ⬜ | |
| CA-14 | ⬜ | |
| CA-15 | ⬜ | |
| CA-16 | ⬜ | |
| CA-17 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/table/<table_id>`, `POST /api/export/xlsx`, `GET /api/export/bulk`; payload de tabla §7.6; errores
- `docs/frontend.md` — componentes `data-table`, `export-menu`, `exporters`; inventario de tablas migradas; copy nuevo; exportación masiva en Importar; `@media print`; service worker (`CACHE`, `STATIC`)
- `docs/architecture.md` — módulos `tables.py` y `export_xlsx.py`; extensiones `stats_engine.sum_bundles` y `metrics_catalog.load_game_bundles`
- `docs/metrics.md` — nota de totales y promedio de competencia en tablas (pooled, DA-02/DA-08)

## Deuda / TODO
