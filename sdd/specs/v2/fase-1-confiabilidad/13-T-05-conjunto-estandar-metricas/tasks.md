# Tasks — T-05: Conjunto estándar de métricas — regla de completitud

> **ID:** T-05 · **Prioridad:** P0 · **Fase y orden:** Fase 1 · 13
> **Depende de:** C-01, C-04, C-07, C-11, F-11, C-08, C-02 (ver [plan.md](plan.md) §10) · **Habilita:** T-02, T-01, T-06, T-04, F-06, F-05, F-08, F-18, F-07, A-01, A-12
> **Estado:** ✅ Aprobado
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md) · Especificación v2 §3 · T-05
> **Estimación:** XL · 28–38 h

Convenciones: los comandos usan la app local en `http://localhost:5000` (sin `AUTH_USERS` no hay login). "Seed" = los 13 partidos de `SEED_URLS`
ya cargados en `backend/basketball.db` (competencia id 1, "Liga de Ascenso 2026"; 14 equipos, 2 partidos por equipo salvo `LBO` y `MNE` con 1; 187 jugadores).
"Script ad hoc" = verificación con `app.test_client()` o `python -c` que no se versiona (Constitución 8: no hay suite automatizada). Valores de referencia del equipo `VER` (2 partidos, base `total`):
`pts` 149, posesiones 154,24 propias y 155,12 del rival, OER 0,966, DER 1,0315, PACE 77,34, eFG% 0,4489, PPT 0,8978, TO% 0,1686, AS/PER 1,3462.

## Orden de ejecución

### Grupo A — Datos: precondiciones, esquema, parser, reproceso
- [ ] T-A1 · Verificar precondiciones: existen `context.parse_context/filter_games/context_echo` (C-02), `identity.player_card/canonicalize_pbp_games` y `player_game_stats.player_id` (C-08), `config.get` (F-13) y `repository.competition_games/team_game_rows/player_game_rows/team_pbp_games`. Si `repository.py` falta, crearlo con esas firmas (envuelve `_team_game_ids`/`_team_pbp_games` de `app.py`) · `backend/repository.py` · cubre RF-16 · Done: `python -c "import repository, context, identity"` sin error; `repository.team_pbp_games("VER", 1)` devuelve 2 partidos con `events`
- [ ] T-A2 · Agregar `blk_received` y `fouls_drawn` (Integer, sin default) a `TeamGameStats` y `PlayerGameStats` y 4 entradas en `upgrade_db().new_cols` · `backend/database.py` · cubre RF-13 · Done: `python backend/database.py` dos veces seguidas sin error y `PRAGMA table_info` de ambas tablas muestra las columnas, `dflt_value` vacío
- [ ] T-A3 · Leer `tot_sBlocksReceived`/`tot_sFoulsOn` y `sBlocksReceived`/`sFoulsOn` con `default=None` · `backend/fiba_fetcher.py` (`_parse_fiba_json`) · cubre RF-13 · Done: `fiba_fetcher.parse_game(raw_archivado, gid)` del seed devuelve enteros en los 2 `teams` y en los 24 `players` de un partido; con una clave removida del JSON devuelve `None`
- [ ] T-A4 · Agregar las 4 columnas a `team_cols`/`player_cols` y subir `INGEST_VERSION` a 3 (o al entero siguiente al vigente) · `backend/ingest.py` · cubre RF-13 · Done: `GET /api/games` marca los 13 partidos `needs_reprocess: true`
- [ ] T-A5 [P] · Agregar las 4 entradas a `NULL_FIELDS` · `backend/data_quality.py` · cubre RF-21 · Done: `GET /api/data-quality?competition=1` lista las 4 filas de `null_fields` con `nulls == total` antes del reproceso
- [ ] T-A6 · Reprocesar los 13 partidos desde el archivo (`POST /api/reprocess` en lotes hasta `next_offset: null`; con red bloqueada) · operación sobre la base local · cubre RF-13 · Done: las 4 filas de `null_fields` pasan a `nulls: 0`; para un partido, Σ `player_game_stats.fouls_drawn` por equipo = `team_game_stats.fouls_drawn` (consulta SQL) y `filas` de `shots`/`pbp_events` no cambian (26 · 312 · 1769 · 7163)

### Grupo B — Backend: fórmulas (`stats_engine.py`)
- [ ] T-B1 · `RAW_KEYS`, dataclass `StatBundle` (con `derived`, `meta`), helpers `_ratio`, `pos`, `plays` · `backend/stats_engine.py` · cubre RF-1, RF-4 · Done: `python -c "from stats_engine import StatBundle, RAW_KEYS"`; `pos` coincide con `possessions()` existente en 3 vectores
- [ ] T-B2 · `compute_standard` para entidades teamlike (volumen, producción, tiro, balón, rebote, defensa, faltas, uso `no_aplica`) con las reglas de nulos de plan §4.3 · `backend/stats_engine.py` · cubre RF-3, RF-5…RF-11 · Done: script ad hoc con los totales de `VER` (dicts) devuelve OER 0,966, DER 1,0315, PACE 77,34, eFG% 0,4489, PPT 0,8978, TO% 0,1686 (= PER/POS), AS/PER 1,3462; `blk_received=None` → `no_registrado`; `tov=0` → `ast_to` nulo `sin_perdidas`
- [ ] T-B3 · `compute_standard` para jugador (volumen/defensa-equipo por `on_court`, USO/AS%/OR%/DR%/REB% por `derived`, `estimated`/`partial`, `sin_pbp`) · `backend/stats_engine.py` · cubre RF-8, RF-9, RF-12, RF-14 · Done: script ad hoc con un partido sintético de un jugador de 24 min en un partido de 40 devuelve USO% igual a `PLAYS_jug × 40 / (24 × PLAYS_equipo)`; sin `on_court` exacto, `der` y `pace` son `sin_pbp` y `possessions` es estimado
- [ ] T-B4 · Métricas `extra` (24) y `no_aplica` por entidad · `backend/stats_engine.py` · cubre RF-2, RF-3 · Done: el conjunto de claves devuelto = las 83 de `METRICS` para los cinco tipos (verificado en T-C5)
- [ ] T-B5 [P] · `sum_bundles` y `apply_base` (`total`/`partido`; otra base → `ValueError`) · `backend/stats_engine.py` · cubre RF-4, RF-15 · Done: `sum_bundles` de los 2 bundles de `VER` da `pts` 149; un `None` en `blk_received` de un sumando deja `None`; `apply_base(.., "partido")` da `pts` 74,5 y no cambia `oer`; `apply_base(.., "por40")` lanza `ValueError`
- [ ] T-B6 [P] · Extender `null_reason` con `sin_datos`, `sin_pbp`, `no_aplica`, `no_disponible` sin cambiar los códigos existentes · `backend/stats_engine.py` · cubre RF-3 · Done: los 4 códigos están en la lista que devuelve el catálogo; `null_reason("ast_to")` sigue siendo `sin_perdidas`

### Grupo C — Backend: catálogo, cargadores y rutas
- [ ] T-C1 · `metrics_catalog.py`: `MetricDef`, `GROUPS`, `METRICS` (83 claves de plan §4.2), `EntityRequest`, `MetricsError`, `register_entity`, `catalog_json` (con `ui.metric_labels`) · `backend/metrics_catalog.py` · cubre RF-1, RF-20 · Done: `len(METRICS) == 83`, 12 grupos, claves únicas, cada clave en exactamente un grupo
- [ ] T-C2 · `lineups.py`: `_agg` suma `pf`/`fouls_drawn`; helper `_lineup_boxes`; `lineup_bundle`, `onoff_bundles`, `player_on_court` · `backend/lineups.py` · cubre RF-2, RF-13, RF-14 · Done: `GET /api/lineup/...` y `GET /api/onoff/...` devuelven JSON idéntico al de antes (diff vacío sobre 3 combinaciones y 3 jugadores del seed); `lineup_bundle` de un quinteto da `fouls_drawn` = `foulon` del pbp
- [ ] T-C3 · `clutch.py`: helper `_qualified_games` + `clutch_bundle` · `backend/clutch.py` · cubre RF-2, RF-19 · Done: `GET /api/clutch/<team>` idéntico al de antes; `clutch_bundle.games == games_qualified` y `seconds == Σ(window_secs + 300·prórrogas)`
- [ ] T-C4 · `bundles.py`: `team_game_bundles`, `player_game_bundles`, enumeradores, registro de los 5 tipos con `register_entity` · `backend/bundles.py` · cubre RF-5…RF-16, RF-19 · Done: `bundles.team_game_bundles("VER", 1, ctx)` devuelve 2 tuplas; `sum_bundles` = bundle de equipo; para un jugador, `Σ derived.plays_team_w` coincide con el cálculo a mano de un partido
- [ ] T-C5 · `build_payload`, `standard_payload`, `load_game_bundles` con los dos enganches (T-02, T-01) marcados como comentarios, ON/OFF con `states`/`diff`, jugador con `coverage` · `backend/metrics_catalog.py` · cubre RF-2, RF-14, RF-16 · Done: ad hoc: `set(payload["metrics"])` de `team`, `player`, `lineup`, `onoff`, `clutch` son iguales entre sí y a `set(METRICS)`; las listas `groups` son iguales
- [ ] T-C6 · Rutas `GET /api/metrics-catalog` y `GET /api/metrics/<entity_type>`; `standard` en `team_stats`, `player_stats` y la ruta por id; import de `bundles` · `backend/app.py` · cubre RF-1, RF-2, RF-16, RF-18 · Done: `curl http://localhost:5000/api/metrics-catalog` responde 200; `curl "http://localhost:5000/api/metrics/team?id=VER&competition=1&base=total"` responde 200 con `pts.value == 149`
- [ ] T-C7 [P] · Pasar `ui.metric_labels` a `status: "activa"` en `CONFIG_SPEC` · `backend/config.py` · cubre RF-20 · Done: `PUT /api/settings {"values": {"ui.metric_labels": {"ppt": "Puntos por tiro"}}}` (admin) y `GET /api/metrics-catalog` muestra la etiqueta nueva; `POST /api/settings/reset` la restituye

### Grupo D — Frontend: capa API y núcleo
- [ ] T-D1 · `api.metricsCatalog()` y `api.metrics(type, params)` · `frontend/js/api.js` · cubre RF-1, RF-2 · Done: en la consola, `await api.metrics("team", {id:"VER", competition:1})` devuelve el payload
- [ ] T-D2 · `core/catalog.js`: `loadCatalog` (memoizada, copia en `sessionStorage` con `try/catch`), `metricDef`, `metricLabel`, `groupsFor`, `stdKeyFor` · `frontend/js/core/catalog.js` · cubre RF-1, RF-17 · Done: `groupsFor("player")` devuelve 12 grupos con 59+24 definiciones (las de `uso`/`reb_share` incluidas); `groupsFor("team")` omite `uso` y `reb_share`
- [ ] T-D3 [P] · `fmtMetric`, `fmtSigned` y 4 etiquetas nuevas en `NULL_REASON_LABELS` · `frontend/js/core/format.js` · cubre RF-3, RF-17 · Done: `fmtMetric("efg_pct", 0.4489)` → "44,9%"; `fmtMetric("net_rating", -0.0654)` → "−0,07"; `fmtMetric("blk_received", null)` → "—"
- [ ] T-D4 · `components/standard-panel.js` (layouts `grid` y `compare`, selector de base, estados, marcas est./parcial, puntos de extensión `cellHTML` y `.std-head-extra`) · `frontend/js/components/standard-panel.js` · cubre RF-17 · Done: renderizado con un payload de `VER` muestra 12 grupos (el último cerrado) y 83 celdas; con `games == 0` muestra el texto de vacío
- [ ] T-D5 [P] · CSS `/* ── standard-panel (T-05) ── */`: `.std-panel`, `.std-head`, `.seg-toggle`, `.std-group`, `.std-grid`, `.std-cell`, `.std-est`, `.std-compare` · `frontend/css/style.css` · cubre RF-17 · Done: a 360 px el panel no genera scroll horizontal de página

### Grupo E — Frontend: integración en pantallas, estados y offline
- [ ] T-E1 · Equipo: card "Conjunto estándar" con petición protegida contra respuestas viejas y selector de base · `frontend/js/app.js` (`_renderTeamContent`/`renderTeam`) · cubre RF-17 · Done: abrir `VER` muestra el panel con `pts` 74,5 (partido); cambiar a "Totales" muestra 149 y recarga
- [ ] T-E2 · Jugador: ídem con `player_id` · `frontend/js/app.js` (`_renderPlayerContent`) · cubre RF-17 · Done: un jugador con minutos muestra `uso_pct` y `uso_2p`; un DNP-only muestra el vacío
- [ ] T-E3 · Combinación: retirar 5 `statBox` y tabla de 18 columnas; montar el panel con id `team:pid-pid-…`; conservar líderes y recuento · `frontend/js/app.js` (`renderTeamLineup`) · cubre RF-2, RF-17 · Done: una combinación de 5 del seed muestra los 12 grupos, incluidos FG2%, FG3%, FT%, PPT, AS/PER y OR%
- [ ] T-E4 · ON/OFF: reemplazar las dos tablas por el panel `compare` · `frontend/js/app.js` (`renderTeamOnOff`) · cubre RF-2, RF-17 · Done: la tabla muestra ON · OFF · Δ para todas las métricas del catálogo; Δ vacío en conteos
- [ ] T-E5 · Cierres: reemplazar las dos `stat-grid` del agregado por el panel; título, recuento y tabla por partido intactos · `frontend/js/app.js` (`renderTeamClutch`) · cubre RF-2, RF-17 · Done: el agregado muestra los 12 grupos; el encabezado "CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)" no cambia
- [ ] T-E6 · Registrar `core/catalog.js` y `components/standard-panel.js` en `STATIC` y subir `CACHE` al entero siguiente · `frontend/sw.js` · cubre RF-17 · Done: con DevTools → Application, el SW nuevo instala ambos archivos; la app carga sin red tras la primera visita (los `/api/*` fallan con el mensaje de red)
- [ ] T-E7 · Estados de carga/vacío/error en las cinco pantallas con el copy de spec §6 · `frontend/js/app.js`, `standard-panel.js` · cubre RF-17 · Done: con la base vacía (copia de la db sin partidos) y con un equipo sin partidos en la competencia elegida se ve el copy de vacío

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`) · Done: servidor escuchando, importa `metrics_catalog` y `bundles` sin errores
- [ ] T-F2 · `python backend/database.py` dos veces seguidas sin error (esquema tocado) · Done: segunda corrida sin excepción y sin columnas duplicadas
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o `app.test_client()`; shape verificado contra plan §3: `/api/metrics-catalog`, `/api/metrics/{team,player,lineup,onoff,clutch}`, `/api/team/VER`, `/api/player/...`, `/api/data-quality` · Done: respuestas con el shape del plan; `set(compute_standard(...)) == set(METRICS)` para los cinco tipos
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer las cinco pantallas, en escritorio y a 360 px · Done: 0 errores
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (procedimientos abajo)
- [ ] T-F6 · CA-1 (CA del cliente) · Done: ad hoc: pedir `lineup` (`CNF:…` de 5 jugadores de un equipo con pbp del seed), `player` (uno de ese quinteto), `onoff`, `team` y `clutch`; las listas de grupos y `sorted(metrics.keys())` son idénticas entre los cinco y al catálogo; el emparejamiento queda anotado como pendiente de F-07
- [ ] T-F7 · CA-2 y CA-3 · Done: el mismo script confirma que `fg2_pct`, `fg3_pct`, `ft_pct`, `efg_pct`, `ts_pct`, `ppt`, `ppt_2`, `ppt_3`, `ppt_ft`, `fg3_uso`, `ft_rate`, `ast_to`, `to_pct`, `or_pct`, `dr_pct`, `orb_pos`, `blk_received`, `fouls_drawn` existen en `lineup` y en `onoff` con `value` o `reason`
- [ ] T-F8 · CA-4 y CA-5 · Done: un jugador del seed sin pérdidas (buscar con SQL `tov = 0` y minutos > 0) devuelve `ast_to` nulo `sin_perdidas`; uno con `fga3 = 0` devuelve `fg3_pct` nulo `sin_intentos` y `fgm3.value == 0`; `uso_pct` del quinteto es `no_aplica`
- [ ] T-F9 · CA-6 y CA-7 · Done: antes de T-A6, `blk_received`/`fouls_drawn` de `VER` y de un jugador salen `no_registrado` y la UI muestra "—" con el `title`; después de T-A6, Σ jugadores = equipo = `foulon` del pbp (y Σ `blk_received` = `block` del rival) en los 26 equipo-partido
- [ ] T-F10 · CA-8 y CA-9 · Done: para `VER`, `oer`, `efg_pct`, `to_pct` del bloque `standard` coinciden con los valores de referencia de la cabecera de este documento (calculados sobre los totales de `team_game_stats`); con `last=1` y un equipo, Σ `uso_pct × min_jug/(5·40)` de sus jugadores ∈ [0,97; 1,00]; Σ `ast` de jugadores = `ast` del equipo; `as_pct` de un jugador = AST/(w·TCc_eq − TCc_jug) calculado a mano
- [ ] T-F11 · CA-10 · Done: `GET /api/metrics/onoff?id=…` de un jugador: para `pts`, `fga`, `ast`, `tov`, `pf`, `fouls_drawn`, `blk_received` ON + OFF = total del equipo en los partidos usados (`games_used`; se compara con la suma de `team_game_stats` de esos partidos), y `states.on.seconds + states.off.seconds` = 2.400 por partido (2.700 en los dos partidos con prórroga: 2849340 y 2849347)
- [ ] T-F12 · CA-11 y CA-12 · Done: simular un partido sin pbp en una copia de la base (`DELETE FROM pbp_events WHERE game_id = …`) y pedir un jugador de ese partido: `der`/`pace` `sin_pbp`, `possessions` con `estimated: true`; un jugador con 0:00 en un partido no suma ese partido en `games`
- [ ] T-F13 · CA-13 y CA-14 · Done: `GET /api/metrics/team?id=VER&competition=99` → 400 `competencia_inexistente`; equipo existente en competencia sin sus partidos → 200 con `sin_datos`; `base=por40` → 400 con el mensaje de plan §3.3; `base=partido` → `pts` 74,5 y `oer` 0,966
- [ ] T-F14 · CA-15 · Done: volcar `/api/team`, `/api/player`, `/api/lineup`, `/api/onoff`, `/api/clutch` de 2 equipos antes y después (misma base), quitar la clave `standard` y comparar: sin diferencias
- [ ] T-F15 · CA-16 y CA-17 · Done: recorrido en navegador de las cinco pantallas (escritorio y 360 px) con captura en `progress.md`; `PUT /api/settings` de `ui.metric_labels` cambia la etiqueta en la UI tras recargar
- [ ] T-F16 · CA-18 y comparación antes/después de la conciliación (R-04) · Done: segunda corrida de `upgrade_db()` sin error; tabla en `progress.md` con `ppt` vs `pps`, `to_pct` equipo (PER/POS vs PER/plays), `uso_pct` en cancha vs partido completo, `as_pct` jugador, DER/Net jugador, para `VER` y 3 jugadores
- [ ] T-F17 · Actualizar `docs/metrics.md`, `docs/api.md`, `docs/database.md`, `docs/frontend.md`, `docs/architecture.md` (o dejar el pendiente explícito en `progress.md`) · Done: cada doc describe lo implementado

## Matriz de cobertura CA → tareas
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-C1, T-C2, T-C3, T-C4, T-C5, T-E3, T-E4, T-E5, T-F6 |
| CA-2 | T-C1, T-C5, T-D2, T-F7 |
| CA-3 | T-B2, T-C2, T-E3, T-E4, T-F7 |
| CA-4 | T-B2, T-B3, T-F8 |
| CA-5 | T-B2, T-B4, T-F8 |
| CA-6 | T-A2, T-A3, T-A4, T-A5, T-B2, T-F9 |
| CA-7 | T-A3, T-A6, T-C2, T-F9 |
| CA-8 | T-B2, T-B5, T-C4, T-F10 |
| CA-9 | T-B2, T-B3, T-C4, T-F10 |
| CA-10 | T-C2, T-C5, T-F11 |
| CA-11 | T-B3, T-C4, T-F12 |
| CA-12 | T-C4, T-F12 |
| CA-13 | T-B1, T-C5, T-C6, T-E7, T-F13 |
| CA-14 | T-B5, T-C6, T-D4, T-F13 |
| CA-15 | T-C2, T-C3, T-C6, T-F14 |
| CA-16 | T-D4, T-D5, T-E1, T-E2, T-E3, T-E4, T-E5, T-E6, T-E7, T-F4, T-F15 |
| CA-17 | T-C1, T-C7, T-F15 |
| CA-18 | T-A2, T-F2, T-F16 |

## Dependencias externas
- C-11, F-11, C-08 y C-02 implementados (en `v2`: C-11 y F-11 sí; C-08 y C-02 vienen antes en el orden de fase). Si `repository.py`/`cache.py` no existen, ver plan §10 D-3 (T-A1).
- Reproceso de los partidos existentes (T-A6) tras desplegar: en producción, entrar a Datos → Calidad y reprocesar cada competencia (el archivo crudo evita volver a FIBA; los partidos importados antes de F-11 sin archivo se descargan de FIBA).
- Sin variables de entorno nuevas. Sin dependencias Python nuevas (Constitución 2).
- Dataset de verificación: seed de 13 partidos reprocesado; para CA-12 y CA-13 se trabaja sobre una copia de `basketball.db`.
- Percentiles, badge, ajustado y bases por 40/100 NO se verifican aquí (T-01, T-02, T-04).
