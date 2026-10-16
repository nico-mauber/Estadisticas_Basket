# Tasks — A-08: Sinergias entre jugadores

> **ID:** A-08 · **Prioridad:** P2 · **Fase y orden:** 5·08
> **Depende de:** A-01 · T-02 · F-06 · A-07 · F-07 (y T-01, T-05, T-06, T-03, C-08, X-01, F-11) — ver `plan.md` §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

Convenciones de verificación (Constitución 8: sin suite automatizada): `curl` contra `http://localhost:5000/api/...` o verificación ad hoc con
`app.test_client()` en un script descartable (no se commitea). Dataset: los 13 partidos del seed **reprocesados con ingesta v2** (F-11; `previous_action`
presente) y, para el respaldo del vínculo, un partido con `previous_action = NULL` (inyección controlada documentada si no hay uno legado, R-05).

## Orden de ejecución

### Grupo A — Backend: piezas de soporte
- [ ] T-A1 · Verificar/completar `lineups.all_lineups(team, comp, ctx, size=2)` (combinaciones de 2 de cada tramo, id `<team>:<pid>-<pid>` ascendente, caché `lineups:<team>`) · `backend/lineups.py` · cubre RF-8 · Done: para un equipo del seed, el número de parejas = pares de jugadores que coincidieron en algún tramo; `posesiones(pareja)` = Σ posesiones de los quintetos de `all_lineups(size=5)` que contienen a ambos (aditividad, CA-9).
- [ ] T-A2 · Implementar `lineups.pair_states(team, comp, ctx)` (`ON[b]` y `PAIR[(a,b)]` con cajas aditivas de `_agg` y segundos) · `backend/lineups.py` · cubre RF-12 · Done: para cada jugador B, `Σ` de segundos de sus tramos = minutos en cancha (≈ box ± 1 %); `PAIR[(a,b)].own.fga2 ≤ ON[b].own.fga2`.
- [ ] T-A3 · Exponer `context.filter_events(events, ctx, team_code, game_id)` (envoltorio público de `event_predicate` + `_event_states`; sin filtros de evento devuelve los eventos tal cual) · `backend/context.py` · cubre RF-15 · Done: con `quarter=4` devuelve solo eventos del 4.º cuarto; con `ctx` vacío, la misma lista.
- [ ] T-A4 · Confirmar que `chains.assist_pairs_from_events` (A-07) existe con la firma del plan de A-07 §4.10; si A-08 se implementa antes, moverlo a `synergy.py` · `backend/chains.py` / `backend/synergy.py` · cubre RF-1, RF-3 · Done: sobre un partido del seed, `len(resultado)` = eventos `assist` del equipo en `GET /api/pbp/<game_id>`.
- [ ] T-A5 [P] · Agregar `assist_link_rates(counts)` (`assisted_pct`, `assisted_pts_share`) · `backend/stats_engine.py` · cubre RF-6, RF-16 · Done: llamada directa con contadores sintéticos; con `fgm = 0` devuelve `{"value": None, "reason": "sin_intentos"}`.

### Grupo B — Backend: análisis, loader, tabla y ruta
- [ ] T-B1 · Implementar `assist_matrix` (por partido: filtrado de eventos, vínculos, celdas, `unlinked` con causas, `pbp`/`box` por partido, `fgm` por jugador) con caché `synergy:assists` · `backend/synergy.py` · cubre RF-1, RF-2, RF-3, RF-4, RF-15, RF-17 · Done: `totals.matrix + totals.unlinked = totals.pbp` y `= totals.box` en el seed sin filtros; `check.link.fiba + respaldo + sin_vinculo = pbp`.
- [ ] T-B2 · Implementar `triples_created` (pares y por asistente) y `assisted_scoring` (puntos y % asistido, asistente principal) con la muestra de jugador de T-02 · `backend/synergy.py` · cubre RF-5, RF-6, RF-7 · Done: `triples_created.pairs[0].threes` coincide con el conteo manual en el pbp (CA-4); `assisted_pct = assisted_fgm / fgm`.
- [ ] T-B3 · Implementar `reconcile_assists` (por partido: matriz vs pbp vs box con `cause_hint`) y registrar el check `assist_link` en `data_quality` · `backend/synergy.py`, `backend/data_quality.py` · cubre RF-3, RF-4 · Done: `check.games_mismatch` vacío o con causa; `GET /api/data-quality` incluye el check sin romper los demás.
- [ ] T-B4 · Implementar `pair_table` + loader `pair_bundles`: `compute_standard`, `sample.adjust_values` con `league_prior`, `sample_level("pair")`, población del plantel, `attach_fichas`, rankings por ajustado (Net, OER, TS%) · `backend/synergy.py`, `backend/metrics_catalog.py` · cubre RF-8, RF-9, RF-10 · Done: pareja con < 30 posesiones: `sample.level = "baja"`, `ranked = false`, ausente de `rankings`; pareja con muestra: `adj.k = 25`; orden de `rankings.net_rating` por `adj.value`.
- [ ] T-B5 · Implementar `teammate_impact` (con/sin por resta de cajas, validez por muestra en ambos estados, ponderación, detalle) · `backend/synergy.py` · cubre RF-12, RF-13 · Done: para un par (A, B), `with + without = ON[B]` en `own` y `opp`; compañero con `pos_without = 0` → `valid: false`, `reason: "sin_datos"`.
- [ ] T-B6 · Implementar `synergy_report` (orquesta los tres bloques, `context_echo` con `ignored` por `no_aplica`, `player_view`) y la ruta `GET /api/synergy/<team_code>` con errores 400/404 · `backend/synergy.py`, `backend/app.py` · cubre RF-1, RF-14, RF-15 · Done: `curl "http://localhost:5000/api/synergy/CNF?competition=<id>"` → 200 con `assist_matrix`, `pairs`, `teammate_impact`; con `&player=<id>` agrega `player_view`; `team=ZZZ` → 404; `player` de otro equipo → 400.
- [ ] T-B7 · Registrar la tabla `pairs` (`table_rows`, `default_sort` por Net ajustado, `totals_mode="none"`, `avg_mode="none"`) · `backend/tables.py`, `backend/synergy.py` · cubre RF-11 · Done: `GET /api/table/pairs?team=CNF` devuelve payload §7.6 con una fila por pareja, `_sample`, `adj` y el conjunto estándar.

### Grupo C — Frontend: api.js
- [ ] T-C1 · Agregar `api.synergy(team, params)` · `frontend/js/api.js` · cubre RF-1 · Done: `api.synergy("CNF", {})` en la consola devuelve el JSON de T-B6.

### Grupo D — Frontend: UI
- [ ] T-D1 · Crear `components/synergy-panel.js` con `renderAssistMatrix` (intensidad por cantidad, totales, "Sin vínculo", línea de cuadre, celdas vacías "·", tooltip), `renderAssistRankings`, `renderPairsPanel`, `renderImpactPanel`, `renderPlayerSynergy` · `frontend/js/components/synergy-panel.js` · cubre RF-1…RF-14, RF-16 · Done: render con el JSON de T-B6 sin errores de consola; parejas BAJA en gris sin posición; nulos "—" con `title`.
- [ ] T-D2 · Montar la sección "Sinergias" en la pestaña `quintetos` de S3 (matriz, rankings, parejas + tabla `pairs` con `exportMenu`, potenciadores) · `frontend/js/views/equipo.js` · cubre RF-1…RF-13, RF-18 · Done: `#/equipo/CNF/quintetos` muestra los cuatro bloques; cambiar `last` en la barra T-03 recalcula; exportar la matriz a CSV reproduce lo mostrado.
- [ ] T-D3 · Montar el bloque de sinergias en la pestaña `impacto` de S4 con `player=<id>` · `frontend/js/views/jugador.js` · cubre RF-14 · Done: `#/jugador/<id>/impacto` muestra mejores parejas, a quién asiste, quién le asiste y a quién potencia.
- [ ] T-D4 [P] · Estilos `/* ── synergy (A-08) ── */` · `frontend/css/style.css` · cubre RF-1 · Done: a 360 px no hay scroll horizontal de página; matriz con sticky dentro de su card.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/vacío/error/offline con el copy de la spec §6 · `frontend/js/components/synergy-panel.js`, `frontend/js/views/equipo.js`, `frontend/js/views/jugador.js` · cubre RF-16 · Done: sin red se ve "Sin conexión: las sinergias necesitan conexión."; un equipo sin pbp muestra el copy del 404; "Ninguna pareja alcanza la muestra mínima." cuando corresponde.
- [ ] T-E2 · Sumar `js/components/synergy-panel.js` a `STATIC` y subir `CACHE` en `sw.js` (solo si X-01 no migró a runtime caching; si migró, registrar "sin cambios") · `frontend/sw.js` · cubre — · Done: con la app instalada y sin red, la pestaña abre el esqueleto y no falla la carga del módulo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`) · Done: arranque limpio, `import synergy` sin error.
- [ ] T-F2 · Esquema: A-08 no toca esquema; `python backend/database.py` corre 2 veces seguidas sin error · Done: sin error.
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl y shape verificado: `/api/synergy/<team>` (con y sin `player`, 400/404), `/api/table/pairs`, `/api/metrics/pair?id=CNF:<pid>-<pid>` · Done: respuestas con el shape del plan §3/§7.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer S3 Quintetos y S4 Impacto (desktop y 360 px) · Done: consola limpia.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (T-F6…T-F22).
- [ ] T-F6 · **CA-1 (CA del cliente)**: `curl …/api/synergy/CNF` y sumar `cells[*].count` + `unlinked.count`; comparar con (a) eventos `assist` del equipo en el pbp de los partidos de la selección (script `app.test_client()` sobre `PbpEvent`) y (b) `Σ team_game_stats.ast` de esos partidos; sumar los totales por fila y por columna + `unlinked` · Done: igualdad exacta registrada; `totals.ok == true`.
- [ ] T-F7 · **CA-2**: revisar `assist_matrix.check.link` y `check.scorer_is_teammate`/`shot_is_made_fg`; recorrer en un script ad hoc todas las asistencias de los 13 partidos y verificar que cada anotador vinculado es compañero distinto del asistente y que el tiro vinculado es canasta convertida · Done: `sin_vinculo = 0` (o anomalías listadas con causa).
- [ ] T-F8 · **CA-3**: para 3 partidos, sumar la matriz parcial (consultar con el contexto del partido, p. ej. `opponent=<rival>&last=1`) y comparar con `team_game_stats.ast` y `GET /api/pbp/<game_id>` · Done: coincide; partidos con diferencia listados con `cause_hint`.
- [ ] T-F9 · **CA-4**: elegir un par asistente → anotador con triples y contar a mano en el pbp las canastas de 3 asistidas (evento `assist` con `previous_action` → `3pt` convertido del anotador) · Done: igual al `threes` de la celda; el ranking está ordenado por esa cantidad.
- [ ] T-F10 · **CA-5**: para un anotador, sumar a mano puntos de canastas de campo asistidas y su `fg_pts`; comparar con `assisted_pts`, `fg_pts` y `assisted_pct` · Done: coincide.
- [ ] T-F11 · **CA-6**: localizar una pareja con < 30 posesiones y verificar `sample.level = "baja"`, gris, valor crudo visible, ausencia de `rankings`; en una pareja con muestra comprobar `adj.value = (pos·valor + 25·prior)/(pos + 25)` con `prior` del response (calcular a mano) · Done: coincide.
- [ ] T-F12 · **CA-7**: tomar dos parejas de `rankings.net_rating`, recalcular `net_aj = oer_aj − der_aj` y confirmar que el orden usa `adj.value` (y que difiere del orden crudo en al menos un caso, si existe) · Done: confirmado.
- [ ] T-F13 · **CA-8**: comparar los `groups` de `GET /api/metrics/pair?id=…`, `GET /api/metrics/lineup?id=…` y `GET /api/metrics/player?id=…` · Done: mismos grupos y claves, sin huecos.
- [ ] T-F14 · **CA-9**: para una pareja (A, B), sumar `possessions` de los quintetos de `GET /api/table/team_lineups?team=CNF` que contienen a ambos y comparar con `values.possessions` de la pareja · Done: igual (aditividad).
- [ ] T-F15 · **CA-10**: para (A, B) recalcular con `GET /api/metrics/pair` y con la resta de cajas: `with + without = ON[B]` y el Net ajustado de cada estado; comparar con `detail[*].with/without` y `delta_net` · Done: coincide; `pos_with + pos_without = posesiones de B en cancha` (consulta de B vía `GET /api/onoff/<team>/<nombre>` como referencia ±1 posesión).
- [ ] T-F16 · **CA-11**: ubicar un compañero con < 30 posesiones en algún estado y comprobar `valid: false`, gris y exclusión del promedio y del conteo `teammates_valid` · Done: confirmado.
- [ ] T-F17 · **CA-12**: equipo sin pbp → 404 `sin_pbp`; pareja sin tiros libres → FT% `sin_intentos`; jugador sin asistencias → fila vacía "·" y totales 0 · Done: razones correctas.
- [ ] T-F18 · **CA-13**: `last=5` → `context.games_used = 5` y cuadre; `quarter=4` → la matriz suma solo asistencias del 4.º cuarto y `totals.pbp` coincide con los `assist` del 4.º cuarto (`box: null`) · Done: coincide.
- [ ] T-F19 · **CA-14**: con un jugador de dos grafías de nombre (caso de C-08 del seed o inyección controlada), comprobar una sola fila/columna con asistencias sumadas · Done: confirmado.
- [ ] T-F20 · **CA-15**: abrir S4 Impacto de un jugador y comparar mejores parejas, "asiste más a", "le asisten más" y "a quién potencia" con la pestaña Quintetos del equipo · Done: valores iguales.
- [ ] T-F21 · **CA-16**: exportar `pairs` a CSV/XLSX con un filtro activo y exportar la matriz a CSV; verificar cabecera y contenido · Done: reproduce lo mostrado; matriz con filas = asistentes, columnas = anotadores.
- [ ] T-F22 · **CA-17**: medir `GET /api/synergy/<team>` en frío (tras reiniciar) y en caliente (`curl -w "%{time_total}"`) sobre los 13 partidos · Done: < 5 s en frío y < 1,5 s en caliente.

## Matriz de cobertura

| CA | Tareas |
|---|---|
| CA-1 | T-A4, T-B1, T-D1, T-F6 |
| CA-2 | T-A4, T-B1, T-F7 |
| CA-3 | T-B1, T-B3, T-F8 |
| CA-4 | T-B2, T-F9 |
| CA-5 | T-A5, T-B2, T-F10 |
| CA-6 | T-B4, T-D1, T-F11 |
| CA-7 | T-B4, T-F12 |
| CA-8 | T-B4, T-F13 |
| CA-9 | T-A1, T-F14 |
| CA-10 | T-A2, T-B5, T-F15 |
| CA-11 | T-B5, T-D1, T-F16 |
| CA-12 | T-A5, T-B1, T-B6, T-D1, T-E1, T-F17 |
| CA-13 | T-A3, T-B1, T-B6, T-F18 |
| CA-14 | T-B1, T-F19 |
| CA-15 | T-B6, T-D3, T-F20 |
| CA-16 | T-B7, T-D2, T-F21 |
| CA-17 | T-B1, T-B4, T-B5, T-F22 |

## Dependencias externas
- **Requisitos previos implementados:** A-07 (`assist_pairs_from_events`), F-06 (`all_lineups`, `team_lineups`), T-02 (`sample.py`), T-05, T-01, T-06, T-03, A-01, F-07, C-08, X-01 y F-11 (`previous_action`, `repository`, `cache`).
- **Reimportación/reproceso:** los 13 partidos del seed deben estar reprocesados con ingesta v2 para que el vínculo sea el oficial de FIBA (`previous_action`); un partido sin reprocesar sirve para probar el respaldo.
- **Variables de entorno:** ninguna nueva.
- **Datos de verificación (R-05):** un jugador con dos grafías de nombre (CA-14) y un caso de compañero con muestra baja en un estado (CA-11); documentar cualquier inyección controlada en `progress.md`.
- **Docs a actualizar al cierre:** `docs/api.md`, `docs/metrics.md`, `docs/frontend.md`, `docs/architecture.md`.
