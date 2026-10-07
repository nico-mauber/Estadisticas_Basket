# Progress — T-01: Ficha de métrica: valor, ranking y distancias

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md) · Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)
> Se cierra con: tabla antes/después de Liga (R-04) y tiempos de las poblaciones registrados aquí.

## Estado de tareas
### Grupo A — Backend: infraestructura, versiones y configuración
- [ ] T-A1 · Verificar si existen `cache.py` y la tabla `app_meta`; si no, crearlos con la firma de Arq. §3.14 (`get_versions`, `bump_data_version`, `bump_config_version`, `memo`, `clear`; LRU por namespace, claves con ambas versiones) · `backend/cache.py`, `backend/database.py` (modelo `AppMeta`) · cubre RF-13
- [ ] T-A2 · Auditar y completar las escrituras que deben subir `data_version`: `ingest.persist_game`, `DELETE /api/games`, `competitions.create/update/merge/assign_game`, `identity.merge_players`/`backfill_player_ids`; y las de configuración suben `config_version` · `backend/ingest.py`, `backend/app.py`, `backend/competitions.py`, `backend/identity.py` · cubre RF-13
- [ ] T-A3 [P] · Pasar a `status: "activa"` `population.min_size`, `sample.team.min/high`, `sample.player.min/high` en `CONFIG_SPEC` (si T-02 no lo hizo) · `backend/config.py` · cubre RF-10, RF-12

### Grupo B — Backend: población y ficha (`population.py`)
- [ ] T-B1 · `Member` y `Population`; `metrics_catalog.enumerate(entity_type, comp_id, ctx, variant)` y `set_enumerator`; enumeradores de `team` y `player` ya registrados por T-05 · `backend/population.py`, `backend/metrics_catalog.py` · cubre RF-10, RF-19
- [ ] T-B2 · `rank` (competición "1224") y `percentile` (mid-rank sin la propia entidad) · `backend/population.py` · cubre RF-3, RF-7, RF-9
- [ ] T-B3 · `population()` con umbrales: valores `compute_standard` + `apply_base("partido")`, ajustado de T-02 para quinteto/ON-OFF/cierre, badge `sample_for`, `in_population`, `criterion`, `context_label`, razones `sin_universo`/`contexto_no_comparable`, caché `pop:<tipo>` · `backend/population.py` · cubre RF-10, RF-11, RF-12, RF-13, RF-16, RF-18
- [ ] T-B4 · `league_reference`, `_leader`, `ficha`, `attach_fichas` (campos de plan §3.1, `basis`, `pct_reason`, `dist_*_rel` con la regla ≥ 0,05) · `backend/population.py` · cubre RF-1, RF-4, RF-5, RF-6, RF-9, RF-11, RF-12
- [ ] T-B5 [P] · `full_ranking` (filas ordenadas, `outside_population` con `hypothetical_rank`, `avg`) · `backend/population.py` · cubre RF-14
- [ ] T-B6 · Enumeradores nuevos: `lineups.all_onoff_bundles(games, team_code)` (una pasada) y `bundles.all_lineup_bundles`, `all_onoff_bundles`, `all_clutch_bundles`, registrados con `set_enumerator` · `backend/lineups.py`, `backend/bundles.py` · cubre RF-10

### Grupo C — Backend: enganche y rutas
- [ ] T-C1 · Completar el enganche de fichas en `metrics_catalog.build_payload` (pop, `rank_values` por partido/ajustado, `attach_fichas`, bloque `population`) · `backend/metrics_catalog.py` · cubre RF-1, RF-16, RF-19
- [ ] T-C2 · `GET /api/rankings/<entity_type>/<metric_key>` · `backend/app.py` · cubre RF-14
- [ ] T-C3 · `GET /api/league`: valores de la población, `in_population`, `rank`, `pct`, `include=summary` · `backend/app.py` · cubre RF-17

### Grupo D — Frontend: capa API y componentes
- [ ] T-D1 · `api.ranking(type, metric, params)` y `api.league(comp, {summary})` · `frontend/js/api.js` · cubre RF-14, RF-17
- [ ] T-D2 [P] · `core/colors.js`: `percentileColor`, `percentileBg` con anclas #ef4444/#8b949e/#22c55e · `frontend/js/core/colors.js` · cubre RF-8
- [ ] T-D3 · `components/metric-card.js`: `metricCard` en layouts `card` y `row`, `fmtDelta` (pp, signo "+"/"−", relativo), casos nulo / `pct_reason` / `in_population:false` / `basis:"partido"` / neutral · `frontend/js/components/metric-card.js` · cubre RF-1, RF-2, RF-3, RF-6, RF-11, RF-12, RF-15, RF-18, RF-19
- [ ] T-D4 · `bindMetricCards`: popover en escritorio (hover/foco, 250 ms) y hoja inferior en táctil, caché en memoria por URL, estados cargando/error/vacío, cierre con Escape / fondo / botón · `frontend/js/components/metric-card.js` · cubre RF-14
- [ ] T-D5 [P] · CSS `/* ── metric-card (T-01) ── */` (tarjeta, líneas de ficha, chip, `.fuera-poblacion`, popover, hoja inferior, atenuado de Liga) · `frontend/css/style.css` · cubre RF-3, RF-8, RF-14
- [ ] T-D6 · `standard-panel.js`: `cellHTML` usa `metricCard(..., {layout: "row"})` y la cabecera la línea `Referencia…` · `frontend/js/components/standard-panel.js` · cubre RF-1, RF-19

### Grupo E — Frontend: reemplazo en pantallas, estados y offline
- [ ] T-E1 · Simplificar `statBox` (sin `leagueKey`/`league`/`.stat-context`); retirar `isPct`/`NOT_PCT` y `statClass` si quedan sin usos; ajustar los usos restantes (Comparar) · `frontend/js/app.js` · cubre RF-15
- [ ] T-E2 · Equipo: obtener `std` una sola vez por render (`api.metrics("team", {id, competition, last, base:"partido"})`) y reemplazar las ~28 `statBox` por `metricCard` con `stdKeyFor`; aviso discreto si falla · `frontend/js/app.js` (`_renderTeamContent`) · cubre RF-1, RF-15
- [ ] T-E3 · Jugador: ídem con `player_id` (~24 `statBox`) · `frontend/js/app.js` (`_renderPlayerContent`) · cubre RF-1, RF-15
- [ ] T-E4 · Liga: `api.league(comp, {summary:true})`, columna `#` por puesto de la métrica ordenada, celdas con `percentileBg`, filas fuera de la población atenuadas con chip, `<tfoot>` "Líder" y "Ø competencia" · `frontend/js/app.js` (`renderLeague`, `_leagueTableHTML`) · cubre RF-17
- [ ] T-E5 [P] · Mapa de liga: `drawLeagueScatter` usa `axis.avgX/avgY` del `summary.avg` cuando está · `frontend/js/charts.js`, `frontend/js/app.js` · cubre RF-17
- [ ] T-E6 · `bindMetricCards` después de cada render de Equipo, Jugador, Liga y los paneles de T-05 · `frontend/js/app.js` · cubre RF-14
- [ ] T-E7 · Registrar `core/colors.js` y `components/metric-card.js` en `STATIC` y subir `CACHE` · `frontend/sw.js` · cubre RF-14
- [ ] T-E8 · Estados vacío/error/sin referencia con el copy de spec §6 · `frontend/js/app.js`, `metric-card.js` · cubre RF-12

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · Si tocó esquema (`app_meta`): `python backend/database.py` dos veces seguidas sin error
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o `app.test_client()` y shape verificado contra plan §3: `/api/metrics/{team,player,lineup,onoff,clutch}`, `/api/team/VER`, `/api/rankings/...`, `/api/league` (con y sin `include=summary`)
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo, Jugador, Liga y los paneles de T-05, en escritorio y a 360 px
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (procedimientos abajo)
- [ ] T-F6 · CA-1 (CA del cliente)
- [ ] T-F7 · CA-2 y CA-3
- [ ] T-F8 · CA-4 y CA-5
- [ ] T-F9 · CA-6
- [ ] T-F10 · CA-7 y CA-8
- [ ] T-F11 · CA-9 y CA-16
- [ ] T-F12 · CA-10
- [ ] T-F13 · CA-11 y CA-17
- [ ] T-F14 · CA-12 y CA-13
- [ ] T-F15 · CA-14 y CA-15
- [ ] T-F16 · CA-18
- [ ] T-F17 · Comparación antes/después de Liga (R-04) y rendimiento
- [ ] T-F18 · Actualizar `docs/metrics.md`, `docs/api.md`, `docs/frontend.md` (incluida la corrección de `_colorCell`), `docs/architecture.md` y anotar la mención de `_colorCell` en la regla 9 de `sdd/README.md` y en `CLAUDE.md` como pendiente de decisión humana

### Grupo G — Incrementos diferidos (diferido; no se ejecuta en este requisito)
- [ ] T-G1 (diferido) · Ficha sobre las demás dimensiones del selector global: la barra de contexto envía el contexto completo y `population()` ya lo recibe · se habilita con T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/tasks.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/tasks.md))
- [ ] T-G2 (diferido) · Población y ficha en bases por 40 y por 100 · se habilita con T-04 ([../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/tasks.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/tasks.md))
- [ ] T-G3 (diferido) · Coloreado por percentil, promedio y totales en tablas completas · se habilita con T-06 ([../16-T-06-tablas-completas-exportacion/tasks.md](../16-T-06-tablas-completas-exportacion/tasks.md))
- [ ] T-G4 (diferido) · Población de pareja, emparejamiento, cuarto, split, origen, tipo, oportunidad, tramo de reloj, zona y cadena · se habilita con A-08, F-07, F-04, T-03, A-02…A-05, C-03, A-07

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
- `docs/metrics.md` — "Ficha de métrica": población de referencia, ranking "1224", percentil mid-rank, distancias orientadas, escala de color; promedio de liga = media de entidades.
- `docs/api.md` — `GET /api/rankings/<entity_type>/<metric_key>`, campos de la ficha en `/api/metrics/*` y `standard`, `GET /api/league` (`in_population`, `rank`, `pct`, `include=summary`).
- `docs/frontend.md` — `components/metric-card.js`, `core/colors.js`, retiro del bloque `Ø` de `statBox`, Liga (posición, percentil, pie); **corregir** la mención de `_colorCell` (no existe).
- `docs/architecture.md` — `population.py`, `cache.py` (si se creó aquí) y enumeradores.
- `sdd/README.md` (regla 9) y `CLAUDE.md` citan `_colorCell`: pendiente de decisión humana (no los toca el agente).

## Deuda / TODO
