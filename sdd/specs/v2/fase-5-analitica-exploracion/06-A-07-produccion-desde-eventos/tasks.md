# Tasks — A-07: Producción desde eventos

> **ID:** A-07 · **Prioridad:** P1 · **Fase y orden:** 5·06
> **Depende de:** A-01 · A-02 · A-03 · A-04 · F-01 (y T-05, T-01, T-02, T-03, T-06, X-01, F-11) — ver `plan.md` §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

Convenciones de verificación (Constitución 8: sin suite automatizada): `curl` contra `http://localhost:5000/api/...` con la sesión
abierta (o sin auth en local), o verificación ad hoc con `app.test_client()` en un script descartable (no se commitea). Dataset: los 13
partidos del seed, **reprocesados con ingesta v2** (`POST /api/reprocess`, F-11) + una competencia/partido sin `previous_action`
para CA-15 (un partido importado antes de F-11 o con las columnas en `NULL`).

## Orden de ejecución

### Grupo A — Backend: posesiones y enriquecedor
- [ ] T-A1 · Agregar a `Possession` los campos `steal_event`, `steal_by_id`, `dreb_event`, `dreb_by_id` (default `None`) · `backend/possessions.py` · cubre RF-2, RF-12, RF-14 · Done: `python -c "import possessions"` sin error; `game_possessions(<gid>)[0].steal_event is None`.
- [ ] T-A2 · Agregar el parámetro `include_incomplete: bool = False` a `team_possessions` (omite el paso "excluir incompletas") · `backend/possessions.py` · cubre RF-8, RF-2 · Done: con `False` el resultado es idéntico al de A-01 (mismos conteos que antes); con `True` la cantidad sube exactamente en las incompletas del reporte de `reconcile`.
- [ ] T-A3 · Implementar `enrich_chains(possessions, events, meta)` con vínculo FIBA (`previous_action`) y respaldo por proximidad, y registrarlo con `register_enricher("chains", …)` después de origin/ptype/second_chance · `backend/chains.py` · cubre RF-12, RF-14, RF-24 · Done: en un partido del seed, `Σ #{p.steal_event is not None}` + robos sin posesión + robos en incompletas = cantidad de eventos `steal` del pbp; `Σ #{p.dreb_event is not None}` = rebotes defensivos que abren posesión.
- [ ] T-A4 [P] · Agregar `chain_rates(counts)` con las 8 fórmulas (denominador 0 → nulo `sin_intentos`) · `backend/stats_engine.py` · cubre RF-4, RF-6, RF-10, RF-12, RF-15, RF-17, RF-19 · Done: llamada directa con contadores sintéticos devuelve los valores esperados; con `ast_linked=0` devuelve `{"value": None, "reason": "sin_intentos"}` y nunca `NaN`/`Infinity`.
- [ ] T-A5 [P] · Registrar las 9 `MetricDef` nuevas (grupo `extra`) y los tipos de entidad `chain` y `chain_player` · `backend/metrics_catalog.py` · cubre RF-20, RF-21 · Done: `GET /api/metrics-catalog` lista las 9 claves con `direction` y `fmt` del plan §3; `tov_cost_avg` y `tov_punished_pct` con `direction: lower`.

### Grupo B — Backend: análisis, loader, tabla y ruta
- [ ] T-B1 · Implementar `_finish_kind` y `_outcome_after` · `backend/chains.py` · cubre RF-5, RF-14, RF-16 · Done: tabla de verdad verificada con posesiones sintéticas (t2c, t3c, t2c con fta≥1, falta, perdida, t2f, fin_periodo).
- [ ] T-B2 · Implementar `assist_pairs_from_events` (vínculo FIBA + respaldo) · `backend/chains.py` · cubre RF-7, RF-8, RF-24 · Done: sobre un partido del seed, `len(resultado)` = eventos `assist` del equipo en `GET /api/pbp/<game_id>`; `link == "sin_vinculo"` solo donde el tiro vinculado no existe.
- [ ] T-B3 · Implementar `_assist_block` · `backend/chains.py` · cubre RF-4…RF-8 · Done: `doble+triple+and_one = linked`; `ast_pts = Σ pts`; `ast_pts_avg = ast_pts/linked`; `top_receiver`/`top_pair` presentes.
- [ ] T-B4 · Implementar `_oreb_block` sobre los `Chance` de A-04 con la partición de la spec · `backend/chains.py` · cubre RF-9, RF-10, RF-11 · Done: `Σ outcomes = captured`; `oreb_pts`, `pts_per_oreb`, `oreb_conversion` idénticos a `GET /api/second-chance?team=<code>` (`pts_2nd`, `pts_per_oreb`, `oreb_conversion`).
- [ ] T-B5 · Implementar `_dreb_block` (transición vía `ptype`, `first_outlet_pass` nulo `no_registrado`) · `backend/chains.py` · cubre RF-12, RF-13 · Done: `fastbreak.started ≤ opened_possession`, `scored ≤ started`; `first_outlet_pass` = `{"value": null, "reason": "no_registrado"}`.
- [ ] T-B6 · Implementar `_steal_block` (con `ppp_after_recovery` por `origin == "robo"`) · `backend/chains.py` · cubre RF-14, RF-15 · Done: `Σ outcomes + no_next + in_incomplete = robos del pbp`.
- [ ] T-B7 · Implementar `_turnover_block` y `_next_poss` · `backend/chains.py` · cubre RF-16, RF-17, RF-18 · Done: `Σ outcomes + no_next = pérdidas del pbp (incl. de equipo)`; `tov_cost_avg = tov_pts_conceded / tov_with_next`.
- [ ] T-B8 · Implementar `events_report` (modo equipo y jugador, contexto, `link`, `sample_level`, `attach_fichas`, caché `chains:report`) · `backend/chains.py` · cubre RF-1, RF-3, RF-19, RF-20, RF-24 · Done: `events_report("team","CNF",3,ctx)` devuelve los cinco bloques con el shape del plan §3; con `ctx` sin pbp lanza el error de `sin_pbp`.
- [ ] T-B9 · Implementar `reconcile_chains` (sumas, pbp, A-04, `pts_from_tov`) + check `chains_tov_mismatch` en `data_quality` · `backend/chains.py`, `backend/data_quality.py` · cubre RF-23 · Done: el bloque `reconcile` trae `ok` por bloque y `games_mismatch` con `cause_hint`; partidos con `pts_from_tov` NULL en `games_excluded` con razón `no_registrado`.
- [ ] T-B10 · Implementar `chain_bundles` (loader) y `table_rows` (builder T-06) y registrar `events_production` · `backend/chains.py`, `backend/tables.py`, `backend/metrics_catalog.py` · cubre RF-21, RF-22 · Done: `GET /api/metrics/chain?id=CNF:asistencia` devuelve los mismos grupos que `GET /api/metrics/team?id=CNF`; `GET /api/table/events_production?team=CNF&section=desenlaces` devuelve payload §7.6.
- [ ] T-B11 · Agregar la ruta fina `GET /api/events-production` (valida `entity`/`id`, `parse_context`, delega en `events_report`, mapea errores 400/404) e importar `chains` después de los enriquecedores · `backend/app.py` · cubre RF-1, RF-3 · Done: `curl "http://localhost:5000/api/events-production?entity=team&id=CNF&competition=<id>"` → 200 con los cinco bloques; `entity=xyz` → 400 `parametro_invalido`; `id=ZZZ` → 404 `no_encontrado`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · Agregar `api.eventsProduction(params)` · `frontend/js/api.js` · cubre RF-1 · Done: `api.eventsProduction({entity:"team", id:"CNF"})` en la consola del navegador devuelve el JSON del T-B11.

### Grupo D — Frontend: UI
- [ ] T-D1 · Crear `components/events-panel.js` con `renderEventsPanel(el, payload, {mode})`: cinco cards, fichas T-01, badge T-02, barra apilada de desenlaces, "Asiste más a …", filas de equipo, banner de vínculo de respaldo, "Primer pase de salida: —" con `title` · `frontend/js/components/events-panel.js` · cubre RF-1, RF-7, RF-13, RF-20, RF-24 · Done: render con el JSON del T-B11 sin errores de consola; nulos como "—" con `title`; nunca color en nulos.
- [ ] T-D2 · Montar el panel en la pestaña `eventos` de S3 y S4 (habilitar con `registerTab`), con recarga al cambiar el contexto y la tabla `events_production` debajo (`createDataTable` + `exportMenu`, selector Desenlaces/Por jugador y de cadena) · `frontend/js/views/equipo.js`, `frontend/js/views/jugador.js` · cubre RF-1, RF-3, RF-22 · Done: `#/equipo/CNF/eventos` y `#/jugador/<id>/eventos` muestran el panel; cambiar `last` en la barra T-03 recalcula los cinco bloques.
- [ ] T-D3 [P] · Estilos `/* ── events-panel (A-07) ── */` (cards, barra apilada, banner, grilla de fichas, mobile) · `frontend/css/style.css` · cubre RF-1 · Done: a 360 px de ancho no hay scroll horizontal de página; tablas con primera columna fija.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/vacío/error/offline con el copy de la spec §6 en cada card y en el panel · `frontend/js/components/events-panel.js` · cubre RF-19 · Done: sin red el panel muestra "Sin conexión: el análisis por evento necesita conexión."; un equipo sin pbp muestra el copy del 404.
- [ ] T-E2 · Sumar `js/components/events-panel.js` a `STATIC` y subir `CACHE` en `sw.js` (solo si X-01 no migró a runtime caching; si migró, registrar "sin cambios" en `progress.md`) · `frontend/sw.js` · cubre — · Done: con la app instalada y sin red, la pestaña abre el esqueleto y no falla la carga del módulo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`) · Done: arranque limpio, `import chains` sin error.
- [ ] T-F2 · Esquema: A-07 no toca esquema; verificar que `python backend/database.py` corre 2 veces seguidas sin error · Done: sin error (idempotente, sin columnas nuevas).
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl y shape verificado: `/api/events-production` (equipo y jugador, 400/404), `/api/table/events_production` (`section=desenlaces` y `jugadores&chain=robo`), `/api/metrics/chain?id=CNF:robo`, `/api/metrics/chain_player?id=<pid>:perdida` · Done: respuestas con el shape del plan §3/§7.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la pestaña Eventos de un equipo y de un jugador (desktop y 360 px) · Done: consola limpia.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (T-F6…T-F22).
- [ ] T-F6 · **CA-1**: abrir `#/equipo/<code>/eventos` y comprobar que las cinco cards muestran desenlace y puntos, no solo conteos · Done: captura/descripción en `progress.md`.
- [ ] T-F7 · **CA-2**: con `curl … entity=team&id=CNF`, calcular `kinds[*].count` (suma = `events.linked`) y `events.linked + unlinked + in_incomplete`; compararlo con el conteo de eventos `assist` del equipo (script `app.test_client()` sobre `PbpEvent` `action_type='assist'`) y con `team_game_stats.ast` · Done: igualdad registrada; si pbp y box difieren, anotar el motivo.
- [ ] T-F8 · **CA-3**: script ad hoc que recorre el pbp de los 13 partidos, vincula cada `assist` a su tiro convertido y suma 2/3 pts + tiro libre adicional del and-one; comparar con `blocks.assists.metrics.ast_pts.value` · Done: igual (o diferencias explicadas por posesiones incompletas).
- [ ] T-F9 · **CA-4**: comparar `blocks.oreb.metrics.{oreb_pts, pts_per_oreb, oreb_conversion}` con `GET /api/second-chance?team=CNF` (`pts_2nd`, `pts_per_oreb`, `oreb_conversion`) y verificar `Σ outcomes = captured` · Done: valores idénticos.
- [ ] T-F10 · **CA-5**: comprobar `fastbreak.started ≤ events.opened_possession`, `scored ≤ started`, y que `drb_fb_pct` coincide con el % de RD que se convierten en transición de `GET /api/transitions` (A-03; endpoint a confirmar en su plan) · Done: coincide.
- [ ] T-F11 · **CA-6**: verificar `Σ outcomes + no_next_possession + in_incomplete = robos del pbp`; y, en un partido, que Σ puntos tras robo del equipo A = Σ puntos recibidos tras pérdida del equipo B para las pérdidas vinculadas a esos robos (script ad hoc) · Done: igualdad registrada.
- [ ] T-F12 · **CA-7**: verificar `Σ outcomes + no_next_possession = pérdidas del pbp (incluidas de equipo)`; recalcular a mano `tov_cost_avg` y `tov_punished_pct` de un equipo desde `outcomes` · Done: coincide.
- [ ] T-F13 · **CA-8**: sumar, para cada bloque, el valor de todos los jugadores del equipo (`entity=player` para cada `player_id` de `GET /api/players/<team>`) más la fila de equipo y comparar con el total del equipo · Done: igual.
- [ ] T-F14 · **CA-9**: consultar `quarter=1`, `2`, `3`, `4`, `pr` por separado, sumar `ast_linked` y comparar con la consulta sin filtro; consultar `last=5` y verificar `context.games_used = 5` · Done: suma igual al total.
- [ ] T-F15 · **CA-10**: con un jugador sin robos y con minutos, comprobar conteos 0 y tasas `null`/`sin_intentos`; con una competencia sin pbp (o `competition` sin partidos con pbp) comprobar 404 `sin_pbp`/bloque `sin_pbp` · Done: razones correctas; sin color de rendimiento en "—" (inspección visual).
- [ ] T-F16 · **CA-11**: elegir un jugador con menos de `sample.split.min` eventos en un bloque y verificar badge BAJA en gris, `ranked: false` y ausencia en `GET /api/rankings/chain_player/<clave>` · Done: confirmado.
- [ ] T-F17 · **CA-12**: pasar el cursor por `ast_pts_avg` y comparar ranking/líder/promedio/percentil con `GET /api/rankings/chain/ast_pts_avg` · Done: coincide el puesto, el líder y el promedio.
- [ ] T-F18 · **CA-13**: comparar los `groups` de `GET /api/metrics/chain?id=CNF:asistencia`, `…:robo` y `GET /api/metrics/team?id=CNF` · Done: mismos grupos y claves, sin huecos.
- [ ] T-F19 · **CA-14**: en la tabla `events_production` con `last=5`, exportar CSV y XLSX y comprobar filas, columnas visibles y cabecera con el filtro · Done: coincide con lo mostrado.
- [ ] T-F20 · **CA-15**: con un partido sin `previous_action` (importado antes de F-11), abrir la pestaña y comprobar `link.link_fallback > 0`, el banner de reimportación y que las sumas de CA-2/CA-6/CA-7 se mantienen · Done: confirmado. *Si no hay partido legado disponible: inyección controlada (poner `previous_action = NULL` en un partido de prueba) y documentarla en `progress.md` (R-05).*
- [ ] T-F21 · **CA-16**: revisar `reconcile.pts_from_tov`: partidos que difieren con `cause_hint`, y partidos con NULL excluidos como `no_registrado` · Done: lista revisada y registrada.
- [ ] T-F22 · **CA-17**: medir `GET /api/events-production` en frío (tras reiniciar) y en caliente sobre los 13 partidos (`curl -w "%{time_total}"`) · Done: < 5 s en frío y < 1,5 s en caliente; si no, anotar en `progress.md` y evaluar el plan §10.
- [ ] T-F23 · Verificar coherencia con A-12: comparar `ast_pts_avg` de un jugador con `pts_per_ast` de A-12 (si ya está implementado) y documentar la diferencia de definición · Done: registrado en `progress.md`.

## Matriz de cobertura

| CA | Tareas |
|---|---|
| CA-1 | T-B8, T-D1, T-D2, T-F6 |
| CA-2 | T-A3, T-B2, T-B3, T-F7 |
| CA-3 | T-B3, T-F8 |
| CA-4 | T-B4, T-F9 |
| CA-5 | T-A3, T-B5, T-F10 |
| CA-6 | T-A3, T-B6, T-F11 |
| CA-7 | T-B1, T-B7, T-F12 |
| CA-8 | T-B8, T-F13 |
| CA-9 | T-B8, T-B11, T-F14 |
| CA-10 | T-A4, T-B8, T-D1, T-E1, T-F15 |
| CA-11 | T-B8, T-D1, T-F16 |
| CA-12 | T-A5, T-B8, T-D1, T-F17 |
| CA-13 | T-A5, T-B10, T-F18 |
| CA-14 | T-B10, T-D2, T-F19 |
| CA-15 | T-A3, T-B2, T-D1, T-F20 |
| CA-16 | T-B9, T-F21 |
| CA-17 | T-B8, T-F22 |

## Dependencias externas
- **Requisitos previos implementados:** A-01 (motor de posesiones, `register_enricher`, `team_possessions`), A-02 (`origin`), A-03 (`ptype`), A-04 (`Chance.outcome`, `oreb_by_id`, `second_chance_report`), F-01 (`chains.py` con las cuatro primitivas), T-05, T-01, T-02, T-03, T-06, X-01, F-11 y C-08.
- **Reimportación/reproceso:** los 13 partidos del seed deben estar reprocesados con ingesta v2 (`previous_action`, `qualifiers`, `ingest_version`) para que el vínculo no use el respaldo; un partido sin reprocesar sirve para CA-15.
- **Variables de entorno:** ninguna nueva.
- **Datos de verificación (R-05):** una segunda competencia o inyección controlada para validar el contexto `competition` (CA-9) y el universo de la población (CA-12); documentar la inyección en `progress.md`.
- **Alineación con A-03/A-12:** confirmar el endpoint de transición de A-03 (T-F10) y la definición de `pts_per_ast` de A-12 (T-F23) al implementar.
- **Docs a actualizar al cierre:** `docs/api.md`, `docs/metrics.md`, `docs/frontend.md`, `docs/architecture.md`.
