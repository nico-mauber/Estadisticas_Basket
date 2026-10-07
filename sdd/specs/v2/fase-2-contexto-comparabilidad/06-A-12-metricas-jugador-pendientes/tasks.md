# Tasks — A-12: Métricas de jugador pendientes

> **ID:** A-12 · **Prioridad:** P1 · **Fase y orden:** 2·06
> **Depende de:** C-01, T-01, F-11, T-05, X-01 (y C-08, T-02, C-11) · **Habilita:** — (A-01 completa el tercer indicador)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** Especificación v2 §5.4 · A-12 · Arquitectura §3.5, §5 · [plan.md](plan.md) · [spec.md](spec.md)

## Orden de ejecución

### Grupo A — Backend: esquema e ingesta
- [ ] T-A1 · Columna `PbpEvent.previous_action` (Integer) y entrada `("pbp_events", "previous_action", "INTEGER")` en `upgrade_db().new_cols` · `backend/database.py` · cubre RF-5 · Done: `python backend/database.py` corre dos veces seguidas sin error y `PRAGMA table_info(pbp_events)` lista `previous_action` INTEGER sin default
- [ ] T-A2 [P] · Leer `previousAction` en cada evento del pbp (`_i(ev, ["previousAction"], default=None)`) · `backend/fiba_fetcher.py` · cubre RF-5 · Done: con `python -c` sobre un JSON archivado (`ingest.load_archived`) y `parse_game`, los 459 eventos `assist` del seed traen `previous_action` entero y los eventos que FIBA no vincula traen `None`
- [ ] T-A3 · `pbp_cols` suma `"previous_action"` y `INGEST_VERSION` sube al siguiente entero al vigente (hoy 2), con el comentario de versiones actualizado · `backend/ingest.py` · cubre RF-5 · Done: `needs_reprocess` devuelve `True` para los 13 partidos del seed y `persist_game` de un partido deja `previous_action` no nulo en sus asistencias
- [ ] T-A4 · Campo `("pbp_events", "previous_action", "Vínculo de asistencias (previous_action)")` en `NULL_FIELDS`; `_null_fields` cuenta sobre eventos `assist` · `backend/data_quality.py` · cubre RF-11 · Done: `GET /api/data-quality?competition=1` antes del reproceso lista el campo con `nulls == total == 459`; después, `nulls == 0`
- [ ] T-A5 · Reprocesar los partidos existentes desde el archivo (panel de calidad de Importar o `POST /api/reprocess`), sin red · operación sobre `backend/basketball.db` (copia previa) · cubre RF-5 · Done: respuesta `{processed: [13 ids], failed: []}`; `SELECT COUNT(*) FROM pbp_events` sigue en 7163 y `SELECT COUNT(*) FROM pbp_events WHERE action_type='assist' AND previous_action IS NULL` = 0

### Grupo B — Backend: lógica
- [ ] T-B1 · `assists.POINTS_BY_TYPE` y `game_assist_links(events, player_ids, *, ingest_version)` (clasifica fg2/fg3/ft/unlinked, estados `ok`/`sin_pbp`/`no_registrado`) · `backend/assists.py` (NUEVO) · cubre RF-3, RF-10 · Done: sobre un partido del seed, `Σ (fg2+fg3+ft+unlinked)` de todos los jugadores = asistencias del partido en `team_game_stats`; con `previous_action` en `None` y versión anterior → `status == "no_registrado"`
- [ ] T-B2 · `competition_assist_links(game_ids)` (consulta solo `assist/2pt/3pt/freethrow` + mapa `(game_id, team_code, player_name) → identity.canonical_id(player_id)`) y `player_assist_links(player_id, game_ids)` (solo partidos jugados) · `backend/assists.py` · cubre RF-3, RF-4, RF-10 · Done: para un jugador del seed devuelve `games_total` = partidos jugados (DNP fuera) y `fg2+fg3+ft+unlinked` = su `ast` en el box de los partidos con vínculo
- [ ] T-B3 · Campo `StatBundle.ast_links` (default `None`) y fórmulas de `ast_team_share`, `ast_points`, `pts_per_ast` y del slot nulo `player_poss_duration` (`requiere_posesiones`) en `compute_standard`; `detail` y `coverage` · `backend/stats_engine.py` · cubre RF-1, RF-4, RF-8, RF-10 · Done: con un bundle de prueba `own.ast=80`, `team.ast=400` → `ast_team_share == 0.2`; `fg2=10, fg3=5` → `ast_points == 35` y `pts_per_ast == 2.3333`; `fg2=fg3=0` → `pts_per_ast` nulo `sin_intentos`; `ast_links=None` → nulo `sin_pbp`
- [ ] T-B4 · Cuatro `MetricDef` (`ast_team_share`, `ast_points`, `pts_per_ast`, `player_poss_duration`) en `METRICS`/`GROUPS` y el loader del tipo `player` asigna `bundle.ast_links` con `assists.player_assist_links` · `backend/metrics_catalog.py` · cubre RF-6, RF-9 · Done: `curl -b cookies.txt "http://localhost:5000/api/metrics-catalog"` lista las 4 claves con entidad `player`; `GET /api/metrics/player?id=<player_id>&competition=1` las trae dentro de `metrics`
- [ ] T-B5 · `apply_base`: `ast_points` como `count`; `detail` se escala igual; el resto fijo · `backend/stats_engine.py` · cubre RF-9 · Done: `…/api/metrics/player?id=<player_id>&competition=1&base=partido` → `ast_points` = total ÷ partidos jugados; `pts_per_ast` igual al de `base=total`

### Grupo C — Frontend: api.js
- (Sin métodos nuevos: se reutilizan `api.metrics` de T-05 y `api.ranking` de T-01.)
- [ ] T-C1 · Verificar que `api.metrics("player", {id, competition, last, base})` está disponible y arma la query con `qs`; si T-05 lo nombró distinto, usar ese nombre · `frontend/js/api.js` · cubre RF-7 · Done: en la consola del navegador `await api.metrics("player", {id: <player_id>, competition: 1})` devuelve `metrics.ast_team_share`

### Grupo D — Frontend: UI
- [ ] T-D1 [P] · Etiquetas `sin_pbp` ("Partido sin play-by-play") y `requiere_posesiones` ("Se calcula con el motor de posesiones (en desarrollo)") en `NULL_REASON_LABELS` si faltan · `frontend/js/core/format.js` · cubre RF-8, RF-10 · Done: `nullDisplay("requiere_posesiones")` devuelve "—" con ese `title`
- [ ] T-D2 · `renderCreationCard` con los 4 `metricCard`, subtítulos que distinguen AS/pos de la cuota, línea de puntos y asistencias a tiros de campo, nota de cobertura y de tiros libres, badge de muestra y estados (loading, error, offline, vacío) · `frontend/js/components/assist-card.js` (NUEVO) · cubre RF-2, RF-7, RF-8, RF-10 · Done: la card renderiza con un payload de prueba en la consola y los tooltips de fórmula aparecen al pasar el cursor
- [ ] T-D3 [P] · Estilos `.assist-card`, `.assist-note` (sección comentada) · `frontend/css/style.css` · cubre RF-7 · Done: en 360 px la card no genera scroll horizontal
- [ ] T-D4 · Montar la card en S4 → `distribucion` y quitar `AS/pos` de la card "Rebotes y distribución" de C-01 · `frontend/js/views/jugador.js` · cubre RF-2, RF-7 · Done: `#/jugador/<player_id>/distribucion` muestra "Creación de juego" con AS/pos y cuota juntos y la card de rebotes sin AS/pos

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Errores del endpoint (404, red) y estado "Sin asistencias a tiros de campo" · `frontend/js/components/assist-card.js` · cubre RF-7, RF-10 · Done: con el backend detenido se ve "Sin conexión. No se pudo cargar la creación de juego."; jugador sin asistencias muestra 0,0 % y "—" en puntos por asistencia
- [ ] T-E2 · Si X-01 no pasó a runtime caching: `assist-card.js` a `STATIC` y `CACHE` +1 · `frontend/sw.js` · cubre RF-7 · Done: tras recargar, DevTools → Application → Cache Storage incluye el módulo (o la tarea queda "no aplica" por runtime caching)

### Grupo F — Verificación de feature
Dataset: 13 partidos del seed reprocesados (T-A5), competencia 1; el jugador de ejemplo se elige con un buscador de jugadores con ≥ 60 minutos y asistencias (`curl -b cookies.txt "http://localhost:5000/api/search/players?competition=1"`).
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` idempotente: `python backend/database.py` corre 2 veces seguidas sin error
- [ ] T-F3 · Endpoints probados: `curl -b cookies.txt "http://localhost:5000/api/metrics/player?id=<player_id>&competition=1"`, `…&base=partido`, `…/api/rankings/player/ast_team_share?competition=1`, `…/api/rankings/player/pts_per_ast?competition=1`, `…/api/data-quality?competition=1`, `…/api/metrics-catalog`; shapes verificados contra plan §3.2
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer S4 (Resumen, Distribución, Tiro, Game log) y Buscar
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`
- [ ] T-F6 · CA-1 (cliente): abrir `#/jugador/<player_id>/distribucion` de un jugador con ≥ 60 min; verificar que se ven AS/pos, % asistencias del equipo, puntos por asistencia y segundos de posesión, cada uno con la ficha de T-01 (valor, "N.º de M", líder, promedio, percentil); anotar que la cuarta queda en "—" por A-01
- [ ] T-F7 · CA-2: script ad hoc con `app.test_client()`: para un partido del seed y un equipo, `Σ AST_j / AST_equipo == 1`; y comparar `ast_team_share` de un jugador con `Σ ast_jugador / Σ ast_equipo` calculado por SQL sobre `player_game_stats`/`team_game_stats` de los partidos que jugó
- [ ] T-F8 · CA-3: con el mismo script, listar para los 32 jugadores ≥ 60 min `as_pos` y `ast_team_share` y verificar que los órdenes (rankings) difieren; revisar los tooltips en pantalla
- [ ] T-F9 · CA-4: script ad hoc sobre `pbp_events`: para cada `assist` del jugador, buscar el evento con `action_number == previous_action` (mismo equipo) y sumar 2 si `2pt`, 3 si `3pt`; comparar con `ast_points` de `/api/metrics/player`; verificar 2,00 ≤ `pts_per_ast` ≤ 3,00
- [ ] T-F10 · CA-5: buscar con SQL un jugador con asistencias vinculadas a `freethrow` (hay 46 en el seed); verificar que `detail.ft` las cuenta, que no entran en `ast_points`/`pts_per_ast` y que `ast` y `as_pos` siguen contándolas; ver el tooltip en la card
- [ ] T-F11 · CA-6: en una copia de la base, poner `previous_action = NULL` y `games.ingest_version = 2` en un partido: `ast_points` queda calculado con los demás y `coverage.games_with_link < games_total`; con todos en NULL → nulo `no_registrado` y "—" con "Reimportá sus partidos" en la UI
- [ ] T-F12 · CA-7: en la copia, borrar los `pbp_events` de un partido (o usar un partido sin pbp): `ast_team_share` y `as_pos` siguen calculándose; con todos los partidos de la selección sin pbp, `ast_points` nulo `sin_pbp`
- [ ] T-F13 · CA-8: para 3 jugadores, `jq '.metrics.player_poss_duration'` de `/api/metrics/player` → `{"value": null, "reason": "requiere_posesiones"}`
- [ ] T-F14 · CA-9: comparar `rank`, `leader` y `avg` de la ficha de cada clave nueva con la fila y el promedio de `GET /api/rankings/player/<clave>` (mismo `highlight`)
- [ ] T-F15 · CA-10: jugador con < 60 minutos: badge "baja", gris y `in_population: false`; el promedio de la población no cambia al incluirlo (comparar `avg` con y sin él)
- [ ] T-F16 · CA-11: `…&base=total` vs `…&base=partido`: `ast_points` se escala; `pts_per_ast`, `ast_team_share` y `player_poss_duration` idénticos (con T-04 implementada, repetir con `por40` y `por100`)
- [ ] T-F17 · CA-12: reprocesar dos veces (`POST /api/reprocess` con los 13 `game_ids`); contar filas de `pbp_events` (7.163), asistencias con `previous_action` (459) y que `GET /api/data-quality?competition=1` no marca partidos pendientes
- [ ] T-F18 · CA-13: jugador con 0 asistencias y equipo con asistencias: `ast_team_share.value == 0` y `pts_per_ast` nulo `sin_intentos`; la UI muestra "0,0 %" y "—"
- [ ] T-F19 · CA-14: emulación de 360 px sobre S4 → Distribución: sin scroll horizontal de página, consola sin errores

### Grupo G — (diferido)
- [ ] T-G1 · (diferido → A-01) Reemplazar el slot nulo de `player_poss_duration` por la duración media de las posesiones que el jugador finaliza (`Possession.finisher_id`, `duration`); la card, el catálogo y la ficha no cambian · `backend/stats_engine.py`, `backend/possessions.py`
- [ ] T-G2 · (diferido → A-07, A-08) Reutilizar `assists.game_assist_links` (o el vínculo de posesiones) para producción de puntos tras asistencia de equipo y matriz asistente→finalizador

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B3, T-B4, T-D2, T-D4, T-F6 (el tercer indicador: T-G1) |
| CA-2 | T-B3, T-F7 |
| CA-3 | T-B3, T-D2, T-F8 |
| CA-4 | T-A2, T-A3, T-A5, T-B1, T-B2, T-B3, T-F9 |
| CA-5 | T-B1, T-B3, T-D2, T-F10 |
| CA-6 | T-B1, T-B3, T-D2, T-E1, T-F11 |
| CA-7 | T-B1, T-B2, T-B3, T-F12 |
| CA-8 | T-B3, T-B4, T-D1, T-F13 |
| CA-9 | T-B4, T-F14 |
| CA-10 | T-B4, T-D2, T-F15 |
| CA-11 | T-B5, T-F16 |
| CA-12 | T-A1, T-A3, T-A4, T-A5, T-F17 |
| CA-13 | T-B3, T-E1, T-F18 |
| CA-14 | T-D2, T-D3, T-F19 |

## Dependencias externas
- T-05 y T-01 cerradas (`/api/metrics/player`, `GET /api/rankings`, `metricCard`, `compute_standard`, `StatBundle`), X-01 cerrada (`views/jugador.js` con la pestaña `distribucion`), C-08 (`player_id`, `identity.canonical_id`), C-01 (`as_pos`).
- **Reimportación/reproceso**: los partidos ya cargados deben reprocesarse con la ingesta nueva (T-A5); sin eso `pts_per_ast`/`ast_points` son nulos. No requiere red si el JSON está archivado (`game_sources`, F-11).
- Hacer una **copia de `backend/basketball.db`** antes de T-A5 y de las pruebas destructivas de T-F11/T-F12 (Constitución 5).
- `cache.py` es opcional (no existe hoy; ver plan §4.1).
- Dataset: los 13 partidos del seed; para T-F11/T-F12, una copia de la base con valores modificados a mano.
