# Tasks — F-06: Combinaciones y ON/OFF ampliados

> **ID:** F-06 · **Prioridad:** P1 · **Fase y orden:** 2·10
> **Depende de:** T-05 · T-02 · T-01 · T-06 · C-06 · F-13
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** plan.md de este mismo requisito

## Orden de ejecución

### Grupo A — Backend: `lineups.py` sobre `StatBundle`/T-05
- [ ] T-A1 · Agregar `all_lineups(team_code, comp_id, ctx, *, size=5) -> list[StatBundle]` (agrupa TODOS los tramos de `build_segments` por `on_court`, arma `StatBundle` por combo, excluye tramos con `len(on_court) != 5` y los cuenta como inconsistencias) · `backend/lineups.py` · cubre RF-1, RF-3, RF-21 · Done: sobre el dataset de verificación, `all_lineups("CNF", comp_id, ctx)` devuelve ≥1 `StatBundle` con `own["pts"] > 0` y `games >= 1`
- [ ] T-A2 · Generalizar el mismo camino a combinaciones de 3–4 jugadores (RF-9: reusa `all_lineups` con `size` variable o el `lineup_stats` existente adaptado a `StatBundle`) · `backend/lineups.py` · cubre RF-9 · Done: pedir una combinación de 3 jugadores conocida devuelve un `StatBundle` con `possessions_counted is None` y `own` no vacío
- [ ] T-A3 · Migrar `onoff_stats` para que cada lado (ON, OFF) arme un `StatBundle` y delegue en `stats_engine.compute_standard`, conservando la partición exhaustiva (`_agg`/`build_segments` sin cambios de comportamiento) · `backend/lineups.py` · cubre RF-10, RF-23 · Done: `on.possessions + off.possessions` sigue igualando el total del equipo (regresión de CA-5 de Feature 04)
- [ ] T-A4 [P] · `player_on_court(team_code, player_id, comp_id, ctx) -> dict | None` (bundle ON de un jugador por id, arquitectura §4) · `backend/lineups.py` · cubre RF-10, RF-22 · Done: devuelve `None` si el jugador no tiene tramos ON en la selección, dict con `own`/`opp` si los tiene

### Grupo B — Backend: cierres por quinteto y líderes
- [ ] T-B1 · `lineup_clutch(team_code, comp_id, ctx) -> list[dict]` (récord V-D, diferencial del tramo, métricas del tramo, badge, ajustado con `regression.clutch_lineup.k`) · `backend/lineups.py` · cubre RF-13, RF-14, RF-15 · Done: sobre un equipo con ≥1 partido cerrado en el dataset, devuelve ≥1 fila con `record` en formato "V-D" y `sample.level` en `{baja, alta}`
- [ ] T-B2 · `backend/lineup_leaders.py` (NUEVO): `CATEGORIES` + `leaders_report(team_code, comp_id, ctx, *, top_n=3) -> dict` (7 categorías, exclusión de muestra baja, orden por ajustado donde aplica, fichas T-01) · `backend/lineup_leaders.py` · cubre RF-16, RF-17, RF-18 · Done: `leaders_report(...)["categories"]` trae 7 entradas con `key` en el orden del RF-16, cada `items[0]` con `sample.level != "baja"`

### Grupo C — Backend: registro T-05/T-06 y rutas
- [ ] T-C1 · `metrics_catalog.register_entity("lineup", loader)` y `register_entity("onoff", loader)` (si T-05 no los registró aún) apuntando a `all_lineups`/`onoff_stats` · `backend/metrics_catalog.py` · cubre RF-1, RF-9, RF-10 · Done: `GET /api/metrics/lineup?id=<team>:<pids>` devuelve el shape §7.3 con `groups` no vacío
- [ ] T-C2 · `tables.register_table("team_lineups", ...)` con `builder=all_lineups`, columnas por defecto del conjunto T-05 + `_sample` · `backend/tables.py` · cubre RF-3, RF-4 · Done: `GET /api/table/team_lineups?team=CNF` devuelve `rows` con una fila por quinteto usado
- [ ] T-C3 · `tables.register_table("team_onoff", ...)` con parámetro `state` (`on`\|`off`\|`diff`, PROPUESTA) · `backend/tables.py` · cubre RF-12 · Done: `GET /api/table/team_onoff?team=CNF&state=diff` devuelve una fila por jugador del plantel
- [ ] T-C4 · `tables.register_table("team_lineup_clutch", ...)` con `builder=lineup_clutch` (PROPUESTA) · `backend/tables.py` · cubre RF-14 · Done: `GET /api/table/team_lineup_clutch?team=CNF` devuelve filas con columna `_record` tipo texto
- [ ] T-C5 · `GET /api/lineup-leaders/<team_code>` (PROPUESTA) → `lineup_leaders.leaders_report` · `backend/app.py` · cubre RF-16..RF-19 · Done: `GET /api/lineup-leaders/CNF` devuelve 200 con `categories` (o `categories: []` + `empty_reason` si ningún quinteto supera el umbral)
- [ ] T-C6 [P] · Mantener `GET /api/lineup/<team_code>` y `GET /api/onoff/<team_code>/<player_name>` sin cambio de shape (regresión) · `backend/app.py` · cubre RF-22 · Done: `test_client().get("/api/lineup/CNF?players=A|B|C")` responde el mismo shape que antes de F-06

### Grupo D — Frontend: api.js
- [ ] T-D1 · `api.metrics(entityType, params)`, `api.table(tableId, params)`, `api.ranking(entityType, metric, params)` (si T-05/T-01/T-06 no los agregaron aún) · `frontend/js/api.js` · cubre RF-1, RF-3, RF-7 · Done: `api.table("team_lineups", {team: "CNF"})` resuelve el JSON de T-C2
- [ ] T-D2 [P] · `api.lineupLeaders(team, params)` · `frontend/js/api.js` · cubre RF-16 · Done: llamada resuelve el JSON de T-C5

### Grupo E — Frontend: UI (pestaña Quintetos)
- [ ] T-E1 · `frontend/js/components/lineup-leader-card.js` (NUEVO): `renderLeaderCard(el, category, payload)` (grid 7 tarjetas, top 3, ajustado±banda, percentil, badge, ranking, distancias, enlace a fila) · cubre RF-16..RF-18 · Done: renderiza 7 tarjetas sin excepciones con un payload real de `api.lineupLeaders`
- [ ] T-E2 · Tabla de todos los quintetos con `components/data-table.js` sobre `api.table("team_lineups", …)` + `export-menu.js` · `frontend/js/views/equipo.js` (o `app.js` si X-01 no integró aún) · cubre RF-3, RF-4, RF-8 · Done: la tabla ordena por Net Rating (ajustado), filas de muestra baja en gris al final, exportación CSV descarga un archivo
- [ ] T-E3 · Selector de combinación (3–5 jugadores) con `standard-panel.js` mostrando los bloques Ataque/Defensa/Avanzado sobre el panel completo T-05 · cubre RF-2, RF-9 · Done: elegir 3, 4 o 5 jugadares muestra los tres bloques con las métricas listadas en RF-2; elegir 2 o 6 deshabilita el botón "Analizar"
- [ ] T-E4 · Tabla ON/OFF del plantel con selector ON/OFF/Diferencia sobre `api.table("team_onoff", …)` · cubre RF-10, RF-11, RF-12 · Done: cambiar el selector refetchea y reordena sin recargar la página
- [ ] T-E5 · Tabla de cierres por quinteto sobre `api.table("team_lineup_clutch", …)` con columna "Récord" tipo texto · cubre RF-13, RF-14, RF-15 · Done: muestra "V-D (pct%)" y badge BAJA cuando `partidos_contados < 3`
- [ ] T-E6 · Registrar la pestaña `quintetos` en el router de X-01 (o sección propia si X-01 no cerró aún) con deep link `?lineup=<id>` que resalta la fila (`data-table.js` `scrollToRow`) · cubre RF-8, CA-11 · Done: abrir `#/equipo/CNF/quintetos?lineup=CNF:12-15-18-21-30` resalta esa fila al cargar

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · N/A — F-06 no cambia esquema (§5 de la arquitectura no lo lista)
- [ ] T-F3 · Endpoints probados con `curl`/`test_client()` contra `http://localhost:5000`: `GET /api/metrics/lineup?id=<team>:<pids>`, `GET /api/table/team_lineups?team=<code>`, `GET /api/table/team_onoff?team=<code>&state=diff`, `GET /api/table/team_lineup_clutch?team=<code>`, `GET /api/lineup-leaders/<code>`, `GET /api/lineup/<code>?players=A|B|C` (legado sin cambio de shape)
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la pestaña Quintetos completa (tarjetas, combinación, tabla, ON/OFF, cierres)
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅/❌
- [ ] T-F6 · CA-1 (CA del cliente): con `curl http://localhost:5000/api/table/team_lineups?team=<code>` contar filas totales y filas con `sample.level != "baja"`; confirmar que hay al menos una sobre el umbral y que ninguna fila de `GET /api/lineup-leaders/<code>` tiene `sample.level == "baja"`
- [ ] T-F7 · CA-2 (CA del cliente): comparar en el navegador las claves de `groups`/`metrics` de `GET /api/metrics/lineup?id=…`, `GET /api/metrics/onoff?id=…` y `GET /api/metrics/player?id=…` (de T-05): mismas claves, mismos grupos
- [ ] T-F8 · CA-3: con `test_client()`, sumar `possessions`/`pts`/`pts_against` de todas las filas de `team_lineups` de un equipo y comparar con los totales calculados directamente sobre `_team_pbp_games` (sin partición)
- [ ] T-F9 · CA-4/CA-5: en el navegador, ordenar la tabla por Net Rating y verificar visualmente que el orden usa el ajustado (comparar con el crudo mostrado en la misma fila) y que las filas de muestra baja quedan al final en ambos sentidos de orden
- [ ] T-F10 · CA-6/CA-7: `curl http://localhost:5000/api/table/team_onoff?team=<code>&state=diff` para un titular de minutos completos (o partido sintético); verificar `off` con métricas `null` y sin `NaN`/`Infinity` en la respuesta
- [ ] T-F11 · CA-8/CA-9/CA-10: `curl http://localhost:5000/api/table/team_lineup_clutch?team=<code>` antes y después de cambiar `sample.clutch_lineup.min_poss` vía `PUT /api/settings` (F-13); confirmar que el conteo de partidos calificados cambia sin reiniciar el servidor
- [ ] T-F12 · CA-11: en el navegador, hacer clic en un quinteto de una tarjeta líder y confirmar que la URL cambia a `?lineup=<id>` y la fila correspondiente queda resaltada
- [ ] T-F13 · CA-12/CA-13: exportar la tabla de quintetos y el bloque de tarjetas a CSV/XLSX; abrir el archivo y verificar cabecera (equipo, competencia, filtros, base) y filas coincidentes con lo mostrado en pantalla
- [ ] T-F14 · CA-14: en el navegador, elegir 3 jugadores y confirmar los tres bloques; elegir 2 y confirmar que el backend responde 400 "Elegí entre 3 y 5 jugadores"
- [ ] T-F15 · CA-15: sobre un partido con prórroga del dataset de verificación, confirmar en `curl` que la suma de segundos de los tramos de ese partido es `2400 + 300 × prórrogas` (sin segundos fantasma)
- [ ] T-F16 · CA-16: con un equipo sin play-by-play (o simulando la ausencia), recorrer la pestaña y confirmar el copy de "sin play-by-play" en cada bloque, sin ningún 0 falso

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-A1, T-C2, T-B2, T-C5, T-F6 |
| CA-2 | T-C1, T-F7 |
| CA-3 | T-A1, T-C2, T-F8 |
| CA-4 | T-C2, T-E2, T-F9 |
| CA-5 | T-B2, T-C1 (población T-01), T-F9 |
| CA-6 | T-A3, T-C3, T-F10 |
| CA-7 | T-A3, T-F10 |
| CA-8 | T-B1, T-C4, T-F11 |
| CA-9 | T-B1, T-B2, T-F11 |
| CA-10 | T-B1, T-F11 (depende de F-13 `PUT /api/settings`) |
| CA-11 | T-E1, T-E2, T-E6, T-F12 |
| CA-12 | T-E2, T-F13 (depende de T-06 `export-menu.js`) |
| CA-13 | T-B2, T-E1, T-F13 |
| CA-14 | T-A2, T-E3, T-F14 |
| CA-15 | T-A1 (vía `build_segments`, ya corregido por F-11), T-F15 |
| CA-16 | T-E2..T-E5, T-F16 |

## Dependencias externas
- **F-13 debe estar implementado** (o sus valores por defecto disponibles vía `config.get`) antes de T-B1/T-B2/T-F11: umbrales `sample.lineup.*`, `sample.onoff.*`, `sample.clutch_lineup.*`, `regression.lineup.k`, `regression.onoff.k`, `regression.clutch_lineup.k`, `clutch.margin`, `clutch.window_secs`.
- **T-05 debe exponer `stats_engine.compute_standard`/`StatBundle`/`apply_base`** antes de T-A1..T-A4.
- **T-01 debe exponer `population.ficha`/`attach_fichas`** antes de T-B2/T-C1 (fichas en tarjetas y tabla).
- **T-02 debe exponer `sample.sample_level`/`adjusted`/`is_ranked`/`band`** antes de T-B1/T-B2.
- **T-06 debe exponer `tables.register_table`/`build_table` y `components/data-table.js`/`export-menu.js`** antes de T-C2..T-C4/T-E2.
- **C-06 debe haber corregido `PERIOD_TYPES`/`OVERTIME` en `clutch.py`** antes de T-B1 (ventana de cierre con prórrogas).
- **C-08 (ids de jugador) es opcional en el momento de implementar F-06**: si aún no cerró, F-06 usa nombres (como hoy) y migra a `player_id` cuando C-08 esté disponible (RF-22 ya contempla el legado por nombre).
- **Dataset de verificación**: los 13 partidos del seed (2 con prórroga) + reproceso con ingesta v2 si F-11 ya corrió; sin eso, T-F15 no es verificable con datos reales.
- Ninguna variable de entorno nueva.
