# Progress — T-05: Conjunto estándar de métricas — regla de completitud

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md) · Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)
> Se cierra con: reproceso de los 13 partidos del seed (T-A6) y comparación antes/después de la conciliación (R-04) registradas aquí.

## Estado de tareas
### Grupo A — Datos: precondiciones, esquema, parser, reproceso
- [ ] T-A1 · Verificar precondiciones: existen `context.parse_context/filter_games/context_echo` (C-02), `identity.player_card/canonicalize_pbp_games` y `player_game_stats.player_id` (C-08), `config.get` (F-13) y `repository.competition_games/team_game_rows/player_game_rows/team_pbp_games`. Si `repository.py` falta, crearlo con esas firmas (envuelve `_team_game_ids`/`_team_pbp_games` de `app.py`) · `backend/repository.py` · cubre RF-16
- [ ] T-A2 · Agregar `blk_received` y `fouls_drawn` (Integer, sin default) a `TeamGameStats` y `PlayerGameStats` y 4 entradas en `upgrade_db().new_cols` · `backend/database.py` · cubre RF-13
- [ ] T-A3 · Leer `tot_sBlocksReceived`/`tot_sFoulsOn` y `sBlocksReceived`/`sFoulsOn` con `default=None` · `backend/fiba_fetcher.py` (`_parse_fiba_json`) · cubre RF-13
- [ ] T-A4 · Agregar las 4 columnas a `team_cols`/`player_cols` y subir `INGEST_VERSION` a 3 (o al entero siguiente al vigente) · `backend/ingest.py` · cubre RF-13
- [ ] T-A5 [P] · Agregar las 4 entradas a `NULL_FIELDS` · `backend/data_quality.py` · cubre RF-21
- [ ] T-A6 · Reprocesar los 13 partidos desde el archivo (`POST /api/reprocess` en lotes hasta `next_offset: null`; con red bloqueada) · operación sobre la base local · cubre RF-13

### Grupo B — Backend: fórmulas (`stats_engine.py`)
- [ ] T-B1 · `RAW_KEYS`, dataclass `StatBundle` (con `derived`, `meta`), helpers `_ratio`, `pos`, `plays` · `backend/stats_engine.py` · cubre RF-1, RF-4
- [ ] T-B2 · `compute_standard` para entidades teamlike (volumen, producción, tiro, balón, rebote, defensa, faltas, uso `no_aplica`) con las reglas de nulos de plan §4.3 · `backend/stats_engine.py` · cubre RF-3, RF-5…RF-11
- [ ] T-B3 · `compute_standard` para jugador (volumen/defensa-equipo por `on_court`, USO/AS%/OR%/DR%/REB% por `derived`, `estimated`/`partial`, `sin_pbp`) · `backend/stats_engine.py` · cubre RF-8, RF-9, RF-12, RF-14
- [ ] T-B4 · Métricas `extra` (24) y `no_aplica` por entidad · `backend/stats_engine.py` · cubre RF-2, RF-3
- [ ] T-B5 [P] · `sum_bundles` y `apply_base` (`total`/`partido`; otra base → `ValueError`) · `backend/stats_engine.py` · cubre RF-4, RF-15
- [ ] T-B6 [P] · Extender `null_reason` con `sin_datos`, `sin_pbp`, `no_aplica`, `no_disponible` sin cambiar los códigos existentes · `backend/stats_engine.py` · cubre RF-3

### Grupo C — Backend: catálogo, cargadores y rutas
- [ ] T-C1 · `metrics_catalog.py`: `MetricDef`, `GROUPS`, `METRICS` (83 claves de plan §4.2), `EntityRequest`, `MetricsError`, `register_entity`, `catalog_json` (con `ui.metric_labels`) · `backend/metrics_catalog.py` · cubre RF-1, RF-20
- [ ] T-C2 · `lineups.py`: `_agg` suma `pf`/`fouls_drawn`; helper `_lineup_boxes`; `lineup_bundle`, `onoff_bundles`, `player_on_court` · `backend/lineups.py` · cubre RF-2, RF-13, RF-14
- [ ] T-C3 · `clutch.py`: helper `_qualified_games` + `clutch_bundle` · `backend/clutch.py` · cubre RF-2, RF-19
- [ ] T-C4 · `bundles.py`: `team_game_bundles`, `player_game_bundles`, enumeradores, registro de los 5 tipos con `register_entity` · `backend/bundles.py` · cubre RF-5…RF-16, RF-19
- [ ] T-C5 · `build_payload`, `standard_payload`, `load_game_bundles` con los dos enganches (T-02, T-01) marcados como comentarios, ON/OFF con `states`/`diff`, jugador con `coverage` · `backend/metrics_catalog.py` · cubre RF-2, RF-14, RF-16
- [ ] T-C6 · Rutas `GET /api/metrics-catalog` y `GET /api/metrics/<entity_type>`; `standard` en `team_stats`, `player_stats` y la ruta por id; import de `bundles` · `backend/app.py` · cubre RF-1, RF-2, RF-16, RF-18
- [ ] T-C7 [P] · Pasar `ui.metric_labels` a `status: "activa"` en `CONFIG_SPEC` · `backend/config.py` · cubre RF-20

### Grupo D — Frontend: capa API y núcleo
- [ ] T-D1 · `api.metricsCatalog()` y `api.metrics(type, params)` · `frontend/js/api.js` · cubre RF-1, RF-2
- [ ] T-D2 · `core/catalog.js`: `loadCatalog` (memoizada, copia en `sessionStorage` con `try/catch`), `metricDef`, `metricLabel`, `groupsFor`, `stdKeyFor` · `frontend/js/core/catalog.js` · cubre RF-1, RF-17
- [ ] T-D3 [P] · `fmtMetric`, `fmtSigned` y 4 etiquetas nuevas en `NULL_REASON_LABELS` · `frontend/js/core/format.js` · cubre RF-3, RF-17
- [ ] T-D4 · `components/standard-panel.js` (layouts `grid` y `compare`, selector de base, estados, marcas est./parcial, puntos de extensión `cellHTML` y `.std-head-extra`) · `frontend/js/components/standard-panel.js` · cubre RF-17
- [ ] T-D5 [P] · CSS `/* ── standard-panel (T-05) ── */`: `.std-panel`, `.std-head`, `.seg-toggle`, `.std-group`, `.std-grid`, `.std-cell`, `.std-est`, `.std-compare` · `frontend/css/style.css` · cubre RF-17

### Grupo E — Frontend: integración en pantallas, estados y offline
- [ ] T-E1 · Equipo: card "Conjunto estándar" con petición protegida contra respuestas viejas y selector de base · `frontend/js/app.js` (`_renderTeamContent`/`renderTeam`) · cubre RF-17
- [ ] T-E2 · Jugador: ídem con `player_id` · `frontend/js/app.js` (`_renderPlayerContent`) · cubre RF-17
- [ ] T-E3 · Combinación: retirar 5 `statBox` y tabla de 18 columnas; montar el panel con id `team:pid-pid-…`; conservar líderes y recuento · `frontend/js/app.js` (`renderTeamLineup`) · cubre RF-2, RF-17
- [ ] T-E4 · ON/OFF: reemplazar las dos tablas por el panel `compare` · `frontend/js/app.js` (`renderTeamOnOff`) · cubre RF-2, RF-17
- [ ] T-E5 · Cierres: reemplazar las dos `stat-grid` del agregado por el panel; título, recuento y tabla por partido intactos · `frontend/js/app.js` (`renderTeamClutch`) · cubre RF-2, RF-17
- [ ] T-E6 · Registrar `core/catalog.js` y `components/standard-panel.js` en `STATIC` y subir `CACHE` al entero siguiente · `frontend/sw.js` · cubre RF-17
- [ ] T-E7 · Estados de carga/vacío/error en las cinco pantallas con el copy de spec §6 · `frontend/js/app.js`, `standard-panel.js` · cubre RF-17

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `python backend/database.py` dos veces seguidas sin error (esquema tocado)
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o `app.test_client()`; shape verificado contra plan §3: `/api/metrics-catalog`, `/api/metrics/{team,player,lineup,onoff,clutch}`, `/api/team/VER`, `/api/player/...`, `/api/data-quality`
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer las cinco pantallas, en escritorio y a 360 px
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (procedimientos abajo)
- [ ] T-F6 · CA-1 (CA del cliente)
- [ ] T-F7 · CA-2 y CA-3
- [ ] T-F8 · CA-4 y CA-5
- [ ] T-F9 · CA-6 y CA-7
- [ ] T-F10 · CA-8 y CA-9
- [ ] T-F11 · CA-10
- [ ] T-F12 · CA-11 y CA-12
- [ ] T-F13 · CA-13 y CA-14
- [ ] T-F14 · CA-15
- [ ] T-F15 · CA-16 y CA-17
- [ ] T-F16 · CA-18 y comparación antes/después de la conciliación (R-04)
- [ ] T-F17 · Actualizar `docs/metrics.md`, `docs/api.md`, `docs/database.md`, `docs/frontend.md`, `docs/architecture.md` (o dejar el pendiente explícito en `progress.md`)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ⬜ | |
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
| CA-18 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/metrics.md` — sección "Conjunto estándar": 83 claves, fórmulas (pooled), cambios visibles (PPT, TO% de equipo, USO% en cancha, AS% de jugador, DER/Net de jugador), tabla antes/después.
- `docs/api.md` — `GET /api/metrics-catalog`, `GET /api/metrics/<entity_type>`, bloque `standard` en `/api/team` y `/api/player`, nulos con razón nuevos (`sin_datos`, `sin_pbp`, `no_aplica`, `no_disponible`).
- `docs/database.md` — `blk_received` y `fouls_drawn` en `team_game_stats` y `player_game_stats` (NULL = no importado todavía).
- `docs/frontend.md` — `core/catalog.js`, `fmtMetric`, `components/standard-panel.js`, copy nuevo, retiro de las grillas por pantalla en Combinación, ON/OFF y Cierres.
- `docs/architecture.md` — módulos `metrics_catalog.py` y `bundles.py` en el mapa de capas.

## Deuda / TODO
