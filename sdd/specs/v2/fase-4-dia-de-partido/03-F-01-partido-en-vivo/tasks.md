# Tasks — F-01: Partido en vivo

> **ID:** F-01 · **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** `spec.md`, `plan.md`

## Orden de ejecución

### Grupo A — Backend: `chains.py`
- [ ] T-A1 [P] · `assist_points(possessions)` · `backend/chains.py` · cubre RF-15, RF-19 · Done: sobre las posesiones de un partido del seed con asistencias conocidas, la suma de `points` de todos los asistentes = puntos del equipo generados desde jugadas asistidas (verificable contra el conteo manual de `assist` en el pbp del partido)
- [ ] T-A2 [P] · `oreb_points(possessions)` · `backend/chains.py` · cubre RF-15, RF-19 · Done: sobre un partido con rebotes ofensivos conocidos, cada capturador aparece con al menos los puntos de las cadenas que terminaron en canasta
- [ ] T-A3 [P] · `steal_points(possessions)` · `backend/chains.py` · cubre RF-15, RF-19 · Done: sobre un partido con robos conocidos, la suma de `points` no supera los puntos totales del equipo en el partido
- [ ] T-A4 [P] · `turnover_cost(possessions)` · `backend/chains.py` · cubre RF-15, RF-19 · Done: sobre un partido con pérdidas conocidas, cada jugador con pérdida aparece con el costo de la posesión rival inmediata siguiente (0 si el rival no anotó)

### Grupo B — Backend: `live.py`
- [ ] T-B1 · `is_final(raw)` · `backend/live.py` · cubre RF-6 · Done: sobre el JSON crudo archivado de un partido ya finalizado del seed, devuelve `True`; sobre una copia del mismo JSON con el evento de fin quitado, devuelve `False`
- [ ] T-B2 · Caché TTL en memoria (`{game_id: (fetched_at, snapshot)}`, LRU acotado) · `backend/live.py` · cubre RF-3, RF-4 · Done: dos llamadas a `live_snapshot(game_id)` dentro de `live.cache_ttl_secs` no vuelven a llamar `fetch_raw` (verificable con un contador/mock temporal)
- [ ] T-B3 · `_build_snapshot(parsed, status)` — bloque `teams` (RF-7, RF-8, RF-9) vía `stats_engine.compute_standard` · `backend/live.py` · cubre RF-7, RF-8, RF-9 · Done: sobre el JSON de un partido finalizado del seed tratado como "en curso" (simulando `status="en_curso"`), `teams.home.standard.oer.value` es numérico y no null si hubo posesiones
- [ ] T-B4 · `_vs_season(team_code, comp_id)` (promedio pooled de partidos previos) · `backend/live.py` · cubre RF-10 · Done: el promedio calculado coincide con la media pooled devuelta por `GET /api/team/<team_code>?competition=<id>` sobre los mismos partidos (excluyendo el partido en curso)
- [ ] T-B5 · `_points_distribution(team_stats)` (categorías + "otros_no_clasificado") · `backend/live.py` · cubre RF-11, RF-12, RF-13 · Done: sobre un partido del seed, la suma de las 8 categorías (incluida "otros_no_clasificado") = PTS oficial del equipo, exacto
- [ ] T-B6 · Bloque `players_on_court` (vía `lineups.build_segments_both`) · `backend/live.py` · cubre RF-16 · Done: sobre un partido del seed, `players_on_court.home` tiene exactamente 5 `player_id` correspondientes al último tramo de `build_segments` para ese equipo
- [ ] T-B7 · Bloque `players` (standard + chains por jugador) · `backend/live.py` · cubre RF-14, RF-15 · Done: cada jugador con minutos > 0 en el box aparece en `players.home`/`players.away` con las 5 claves de `standard` y las 5 de `chains` del spec §8
- [ ] T-B8 · `live_snapshot(game_id)` (orquestación: caché → fetch → parse → is_final → persist si corresponde → build_snapshot) · `backend/live.py` · cubre RF-2, RF-5, RF-6, RF-18 · Done: llamado sobre un `game_id` de un partido finalizado del seed (simulando que aún no estaba persistido), la segunda llamada devuelve `status: "finalizado"` y el partido aparece en `GET /api/games`

### Grupo C — Backend: ruta
- [ ] T-C1 · `GET /api/live/<game_id>` (delega en `live_snapshot`, traduce `LiveFetchError` a 502, `game_id` desconocido a 404) · `backend/app.py` · cubre RF-1, RF-2 · Done: `curl "http://localhost:5000/api/live/<game_id>"` sobre un partido del seed devuelve 200 con las 6 claves de nivel raíz del spec §8

### Grupo D — Frontend: api.js
- [ ] T-D1 · `api.live(id)` · `frontend/js/api.js` · cubre RF-1 · Done: en consola del navegador, `await api.live("<game_id>")` devuelve el objeto completo sin lanzar

### Grupo E — Frontend: UI (render + polling)
- [ ] T-E1 · Registrar modo `vivo` en el router de S5 (`core/router.js registerTab`) · `frontend/js/views/partido.js` · cubre RF-1 · Done: `#/partido/<game_id>/vivo` renderiza la vista sin recargar la página
- [ ] T-E2 · Adaptador de polling (`setTimeout` recursivo cada `live.poll_secs`, se detiene al desmontar o al `status === "finalizado"`) · `frontend/js/views/partido.js` · cubre RF-2 · Done: con el DevTools abierto, observar en la pestaña Network que las llamadas a `/api/live/<id>` se repiten cada ≤60 s mientras la vista está montada, y cesan al navegar a otra vista
- [ ] T-E3 · Indicador "EN VIVO" pulsante / ícono de desactualizado (`stale`) · `frontend/css/style.css`, `frontend/js/components/game-view.js` · cubre RF-18 · Done: forzando `stale: true` en la respuesta (mock temporal), el indicador cambia visualmente y aparece el banner "Datos desactualizados desde {hora}"
- [ ] T-E4 [P] · Bloque métricas de equipo (tabla comparativa con Δ vs promedio de temporada) · `frontend/js/components/game-view.js` · cubre RF-7..RF-10 · Done: recorrido en navegador muestra OER/DER/Net/eFG%/TS%/PPP/posesiones de ambos equipos lado a lado con la diferencia vs promedio
- [ ] T-E5 [P] · Bloque distribución de puntos (gráfico de barras/torta con "otros/no clasificado") · `frontend/js/components/game-view.js`, `frontend/js/charts.js` (extiende) · cubre RF-11..RF-13 · Done: recorrido en navegador confirma que las categorías suman visualmente el 100% de los puntos del equipo
- [ ] T-E6 [P] · Bloque jugadores (tabla con estado en cancha/banco) · `frontend/js/components/game-view.js` · cubre RF-14..RF-16 · Done: los 5 jugadores marcados "en cancha" coinciden con `players_on_court` de la respuesta
- [ ] T-E7 · Banner "Partido finalizado" con enlace a Analizar cuando `status === "finalizado"` · `frontend/js/views/partido.js` · cubre RF-5, RF-6 · Done: al simular la transición de `en_curso` a `finalizado` (partido del seed reimportado en caliente), aparece el banner y el enlace navega a `#/partido/<game_id>/analizar`

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` — N/A, F-01 no toca esquema
- [ ] T-F3 · `GET /api/live/<game_id>` probado con curl sobre un partido del seed y sobre un `game_id` inexistente (404); shape verificado contra §8 del plan
- [ ] T-F4 · Consola del navegador sin errores JS durante al menos 2 ciclos completos de polling
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅/❌

## Matriz de cobertura (CA → tareas)

| CA | Procedimiento manual | Tareas |
|---|---|---|
| CA-1 (CA del cliente) | Con un partido de FIBA LiveStats real en curso (o el JSON de un partido del seed servido localmente simulando estar "en curso"), abrir `#/partido/<id>/vivo`, observar que los valores cambian sin recargar y que, al finalizar, coinciden con `GET /api/game/<id>` (F-07) | T-B8, T-E2, T-F4 |
| CA-2 | Abrir la misma vista en dos pestañas del navegador simultáneamente, contar las descargas reales a FIBA en los logs del servidor durante un intervalo de `live.cache_ttl_secs` — debe haber 1, no 2 | T-B2, T-F3 |
| CA-3 | Simular una falla de red hacia FIBA (bloquear el dominio en DevTools) durante el polling → confirmar que se muestra el snapshot anterior con el banner de desactualizado, sin pantalla en blanco | T-B2, T-E3, T-F4 |
| CA-4 | Abrir `#/partido/<id>/vivo` para un partido ya persistido → confirmar que se muestra la misma estructura de bloques con los datos finales | T-B8, T-E7, T-F4 |
| CA-5 | Con un JSON de partido preparado para terminar en la siguiente descarga, verificar que tras el polling que detecta el fin, `GET /api/games` incluye el partido sin haber llamado `POST /api/import` manualmente | T-B1, T-B8, T-F3 |
| CA-6 | Comparar `teams.home.vs_season` de la respuesta contra el promedio calculado manualmente sobre `GET /api/team/<team_code>?competition=<id>` para los mismos partidos previos | T-B4, T-F3 |
| CA-7 | Con un partido sin coordenadas/calificadores para alguna categoría, verificar que la categoría aparece nula con razón y que "otros_no_clasificado" refleja la diferencia | T-B5, T-E5, T-F4 |
| CA-8 | Comparar `players_on_court` de la respuesta contra el resultado directo de `lineups.build_segments` para el mismo partido y momento | T-B6, T-E6, T-F4 |
| CA-9 | `curl "http://localhost:5000/api/live/no-existe-123"` → 404 con el mensaje exacto | T-C1, T-F3 |

0 CA sin cobertura (9/9).

## Dependencias externas

- Reimportación de partidos: no aplica directamente, pero la verificación en caliente (CA-1, CA-5) requiere un partido
  real en curso de FIBA LiveStats, o un mecanismo de prueba que sirva un JSON local simulando el ciclo "en curso →
  finalizado" (ambiente de verificación a definir al implementar; los 13 partidos del seed están todos finalizados, así
  que la verificación de "en curso" necesita o un partido real en vivo el día de la verificación, o un doble local del
  fetch de FIBA).
- Variables de entorno: ninguna nueva (usa las mismas de `fiba_fetcher.py`, sin cambios).
- Requisitos previos que deben estar implementados antes de ejecutar el Grupo F de F-01: F-07 (`game_analysis.py`,
  `game-view.js`, `GET /api/game/<game_id>`), A-01 (`possessions.py`, `lineups.build_segments_both`), F-11 (`ingest.
  persist_game`, `fiba_fetcher.fetch_raw`/`parse_game`).
- Cambio de despliegue (fuera de esta feature, documentado como riesgo en el plan §10): `render.yaml` a
  `--workers 1 --threads 4` (DA-28) — no es una tarea de código de F-01, pero debe coordinarse antes de exponer la vista en
  producción con tráfico real concurrente.
