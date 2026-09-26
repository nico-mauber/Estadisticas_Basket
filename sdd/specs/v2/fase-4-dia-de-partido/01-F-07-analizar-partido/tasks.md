# Tasks — F-07: Analizar partido

> **ID:** F-07 · **Prioridad:** P1 · **Fase y orden:** Fase 4 — Día de partido · 01
> **Depende de:** X-01, T-05, T-06, A-05, F-06, C-03, A-01, T-02, F-11 · **Habilita:** F-03, F-01, F-02, A-08, A-11
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: configuración y helpers
- [ ] T-A1 · Agregar `game.run_min_points` (int, 8, 4–20, "Reglas de contexto") a `CONFIG_SPEC` · `backend/config.py` · cubre RF-11 · Done: `GET /api/settings` lista la clave con default 8 y `PUT` con 25 responde 400 por rango.
- [ ] T-A2 [P] · Crear `game_analysis.py` con `TYPE_GROUPS`, `elapsed_secs`, `period_key` (usa `PERIOD_LEN` de `lineups`) · `backend/game_analysis.py` · cubre RF-12, RF-18 · Done: en `python -c` `elapsed_secs(1,"OVERTIME",0) == 2700` y `elapsed_secs(4,"REGULAR",0) == 2400`.

### Grupo B — Backend: lógica
- [ ] T-B1 · `period_partials` (fuente oficial `period_pts`, fallback pbp; ratings por período con `compute_standard`) · `backend/game_analysis.py` · cubre RF-8, RF-9 · Done: para un partido del seed, Σ parciales = `team_game_stats.pts` en ambos equipos y la prórroga aparece como `pr1`.
- [ ] T-B2 · `score_timeline` (puntos, tiempos muertos, rachas con `config.get("game.run_min_points")`, cambios de liderazgo, empates, máxima ventaja) · `backend/game_analysis.py` · cubre RF-10, RF-11, RF-12 · Done: `final` = marcador final en los 13 partidos; `duration` = 2700 en un partido con 1 prórroga.
- [ ] T-B3 · `game_pbp` con filtros jugador/tipo/período y validación (`ValueError`) · `backend/game_analysis.py` · cubre RF-17, RF-18 · Done: filtro `type=["tiro"], period="3"` devuelve solo `2pt/3pt` de `period == 3` REGULAR.
- [ ] T-B4 · `game_shots` (zonas con `shot_zones`, tramo desde `possessions.game_possessions`, `no_band`, `reset14`, fallback 3 zonas) · `backend/game_analysis.py` · cubre RF-13, RF-14, RF-15, RF-16 · Done: sin filtros, Σ `zones[].attempts` = `fga` oficial del equipo; con `bands=["tardio"]` ningún tiro con `band` nulo en `shots`.
- [ ] T-B5 · `reconcile_game` (score_final, players_sum con rebotes/pérdidas de equipo, period_sum, timeline_final) · `backend/game_analysis.py` · cubre RF-7 · Done: `checks.ok == true` en los 13 partidos reprocesados, o diferencia listada y explicada en `progress.md`.
- [ ] T-B6 · Builder y registro de tabla `game_players` (conjunto estándar de jugador en el partido, DNP con `dnp`, totales por equipo, base T-04) · `backend/game_analysis.py` · cubre RF-5, RF-6, RF-29 · Done: `GET /api/table/game_players?game=<id>` devuelve una fila por jugador del box y `totals` por equipo.
- [ ] T-B7 · Builder y registro de tabla `game_lineups` (quintetos del partido con badge y `adj`) · `backend/game_analysis.py` · cubre RF-20 · Done: Σ `minutes` de las filas de un equipo = minutos de partido (± 0,1).
- [ ] T-B8 · `game_detail` (encabezado, box oficial, estándar de equipos, ensamblado y `cache.memo("game", …)`) · `backend/game_analysis.py` · cubre RF-1, RF-3, RF-4, RF-28 · Done: `game_detail` de un partido sin pbp devuelve `timeline: null`, `lineups: null` sin excepción.
- [ ] T-B9 · `matchups.py`: `_game_segments` (sobre `build_segments_both`), `_side_counts`, `_player_counts`, `game_matchups` en 3 niveles con badge/adj/banda · `backend/matchups.py` · cubre RF-21, RF-22, RF-23, RF-24 · Done: nivel `quinteto`: Σ `possessions` propias de las filas = POS del equipo por segmentos 5v5 (± 0,5).
- [ ] T-B10 · `team_matchups` (todos los partidos entre dos equipos de la competencia, contexto, historial `games[]`) · `backend/matchups.py` · cubre RF-21 (habilita F-03) · Done: para dos equipos con 2 cruces en el seed, cada fila trae `games` con 1–2 elementos y `possessions` sumadas.
- [ ] T-B11 · `load_matchup_bundles` + `register_entity("matchup", …)` y registro de tablas `matchups_quinteto/_jugador/_jugador_quinteto` (params `game` o `team`+`rival`) · `backend/matchups.py` · cubre RF-21, RF-25 · Done: `GET /api/metrics/matchup?id=…&game=…` devuelve los mismos `groups` que `/api/metrics/lineup`.
- [ ] T-B12 · Rutas `GET /api/game/<game_id>`, `/pbp`, `/matchups`, `/shots` con errores §9 del plan · `backend/app.py` · cubre RF-1, RF-13, RF-17, RF-21 · Done: curl de cada ruta devuelve el shape del plan §3; `game_id` inexistente → 404 `no_encontrado`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.game`, `api.gamePbp`, `api.gameMatchups`, `api.gameShots` con `qs()` · `frontend/js/api.js` · cubre RF-1, RF-13, RF-17, RF-21 · Done: desde la consola, `await api.game("<id>")` devuelve el payload.

### Grupo D — Frontend: UI
- [ ] T-D1 · `drawScoreTimeline` con plugin inline (períodos, tiempos muertos, rachas) · `frontend/js/charts.js` · cubre RF-10, RF-11 · Done: el gráfico de un partido del seed muestra separadores de cuarto y triángulos en cada tiempo muerto.
- [ ] T-D2 · Esqueleto `renderGameView(el, payload, {mode})` con pestañas internas y encabezado + chips de estado + aviso de conciliación · `frontend/js/components/game-view.js` · cubre RF-3, RF-7, RF-27 · Done: `mode: "vivo"` renderiza los mismos bloques sin `checks`.
- [ ] T-D3 · Bloque Resumen: parciales + ratings + timeline + estándar de ambos equipos lado a lado · `frontend/js/components/game-view.js` · cubre RF-4, RF-8, RF-10 · Done: tabla de parciales con fila por período y ratings "—" con razón en partidos sin pbp.
- [ ] T-D4 · Bloque Box: `createDataTable` sobre `players`, chips Local/Visitante, `base-selector` · `frontend/js/components/game-view.js` · cubre RF-5, RF-6 · Done: ordenar por TS% deja nulos al final en ambos sentidos; DNP en gris "No jugó".
- [ ] T-D5 · Opción `colorBy: "none"` y `onZoneClick` en `shotChart` · `frontend/js/components/shot-chart.js` · cubre RF-16 · Done: mapa de partido sin colores de rendimiento; tooltip con 7 datos y "Percentil: no aplica en un partido".
- [ ] T-D6 · Bloque Tiros: dos mapas, chips Cuarto/Tramo, select jugador, lista de tiros por zona, nota "sin tramo" · `frontend/js/components/game-view.js` · cubre RF-13, RF-14, RF-15 · Done: cambiar un chip vuelve a pedir `api.gameShots` y actualiza el mapa sin recargar la vista.
- [ ] T-D7 · Bloque Jugadas: filtros jugador/tipo/período, contador, paginado de 100, etiquetas traducidas con `t()` · `frontend/js/components/game-view.js` · cubre RF-17, RF-18, RF-19 · Done: contador "{n} de {total} eventos" coincide con las filas.
- [ ] T-D8 · Bloque Quintetos (dos tablas) y bloque Cruces (niveles, toggle de sentido, matriz, leyenda de coincidencia en cancha) · `frontend/js/components/game-view.js` · cubre RF-20–RF-24 · Done: filas de muestra baja en gris con badge; celdas sin cruce "Sin datos".
- [ ] T-D9 · Exportación por tabla (`exportMenu` con meta del partido) e informe de scouting (`gvScoutingReport` + `printNode` A4) · `frontend/js/components/game-view.js`, `frontend/css/style.css` · cubre RF-25, RF-26 · Done: la vista previa de impresión muestra 1–2 páginas A4 con todos los bloques del informe.
- [ ] T-D10 · Pestaña `analizar` en `views/partido.js` y habilitación de S5 en el registro (sección + pestaña) · `frontend/js/views/partido.js` · cubre RF-1 · Done: `#/partido/<id>/analizar` renderiza y recargar reproduce la vista.
- [ ] T-D11 [P] · Enlaces de entrada: catálogo (`views/datos.js`), game log de Equipo y Jugador · `frontend/js/views/datos.js`, `views/equipo.js`, `views/jugador.js` · cubre RF-2 · Done: click en cada origen navega a la vista del partido correcto.
- [ ] T-D12 · Estilos `/* ── game-view (F-07) ── */` y responsive 768 px · `frontend/css/style.css` · cubre RF-3, RF-17 · Done: a 360 px de ancho no hay scroll horizontal de página; pestañas internas con scroll propio.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/vacío/error/offline de cada bloque con el copy de spec §6 (vía `t()`) · `frontend/js/components/game-view.js` · cubre RF-19, RF-29 · Done: partido sin pbp muestra los 5 estados vacíos de bloque y el box completo.
- [ ] T-E2 · Subir `CACHE` en `sw.js` (y `STATIC` si X-01 no implementó runtime caching) · `frontend/sw.js` · Done: tras recargar, DevTools → Application muestra la caché nueva.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · No toca esquema: confirmar que `python backend/database.py` corre 2 veces seguidas sin error (sin cambios de F-07).
- [ ] T-F3 · Endpoints probados con curl (modo abierto local, sin `AUTH_USERS`): `curl -s http://localhost:5000/api/games | python -c "import sys,json;print([g['game_id'] for g in json.load(sys.stdin)][:3])"`; luego `curl -s http://localhost:5000/api/game/<id>`, `…/pbp?type=tiro&period=3`, `…/matchups?level=jugador`, `…/shots?team=<code>&quarter=2&clock=tardio`; shape = plan §3.
- [ ] T-F4 · Consola del navegador sin errores JS recorriendo las 6 pestañas internas en un partido con pbp y en uno sin pbp.
- [ ] T-F5 · Recorrer CA-1…CA-16 y marcar ✅ en `progress.md`.
- [ ] T-F6 · CA-1: script ad hoc con `app.test_client()` que recorre los 13 `game_id` del seed, llama `/api/game/<id>` y afirma `box.checks.ok`, `pts == home_score/away_score`, Σ `partials` = pts y `timeline.final` = marcador; registrar la salida en `progress.md`.
- [ ] T-F7 · CA-2: en consola, `renderGameView(div, payload, {mode: "vivo"})` con el payload de un partido: renderiza los mismos bloques sin errores y sin aviso de conciliación.
- [ ] T-F8 · CA-3: navegador — desde catálogo, game log de Equipo y game log de Jugador se abre `#/partido/<id>/analizar`; F5 reproduce la vista.
- [ ] T-F9 · CA-4: partido con prórroga del seed — timeline con `duration = 2700` (o 3000), fila `PR1` en parciales, encabezado "1 prórroga".
- [ ] T-F10 · CA-5: filtro jugador + "Tiro de campo" + 3.er cuarto; contar filas vs contador y comparar con `…/pbp?player=<pid>&type=tiro&period=3` (`count`).
- [ ] T-F11 · CA-6: `…/shots?team=<code>&quarter=2&clock=tardio` → `summary.attempts` = tiros de campo del 2.º cuarto con `band == "tardio"` (contados desde `/api/game/<id>/possessions` de A-01); `summary.no_band` informado.
- [ ] T-F12 · CA-7: `…/shots?team=<code>` sin filtros → Σ `zones[].attempts` = `box.<lado>.official.fga2 + fga3`.
- [ ] T-F13 · CA-8: `…/matchups?level=quinteto` → filas con `sample.level == "baja"` en gris en la UI; Σ `possessions` propias de las filas = POS por segmentos 5v5 (comparar con la suma de `game_lineups`).
- [ ] T-F14 · CA-9: `GET /api/metrics/matchup?id=<row_id>&game=<id>`, `/api/metrics/lineup?id=…` y `/api/metrics/player?id=…` → mismos `groups[].key` y mismas claves en `metrics`.
- [ ] T-F15 · CA-10: abrir un partido sin pbp (borrar pbp en una copia local de la base o importar uno sin pbp): box y parciales presentes; bloques de pbp con estado vacío; ninguna métrica 0 en lugar de "—".
- [ ] T-F16 · CA-11: partido con un DNP: fila "No jugó", tasas "—" con título "No jugó", minutos no sumados en totales.
- [ ] T-F17 · CA-12: exportar a CSV y XLSX las tablas Box y Cruces con un orden y columnas no default; abrir ambos archivos y comparar filas/columnas/orden y cabecera `# Partido`, `# Competencia`, `# Filtros`, `# Generado`.
- [ ] T-F18 · CA-13: "Informe de scouting" → vista previa de impresión A4 con encabezado, box resumido, parciales, línea de tiempo, mapas y top 5 cruces; guardar PDF y adjuntar ruta en `progress.md`.
- [ ] T-F19 · CA-14: búsqueda de "marcaje" en `frontend/js/components/game-view.js`, `frontend/i18n` y en la UI renderizada → sin resultados; leyenda visible.
- [ ] T-F20 · CA-15: `curl -i http://localhost:5000/api/game/NOEXISTE` → 404 `no_encontrado`; `curl -i "http://localhost:5000/api/game/<id>/pbp?type=xyz"` → 400 `parametro_invalido`.
- [ ] T-F21 · CA-16: en un partido con racha ≥ 8, verla destacada; `PUT /api/settings {"values": {"game.run_min_points": 12}}`; recargar y comprobar que las rachas de 8–11 ya no aparecen; restaurar con `POST /api/settings/reset`.
- [ ] T-F22 · Medir `GET /api/game/<id>` en frío y en caliente (`curl -w "%{time_total}"`) y registrar en `progress.md` (objetivo < 1,5 s en frío).
- [ ] T-F23 · Actualizar `docs/api.md`, `docs/frontend.md`, `docs/architecture.md`, `docs/metrics.md` (plan §2) y registrar desviaciones/PROPUESTAS en `progress.md`.

### Grupo G — Incremento diferido (→ F-12)
- [ ] T-G1 (diferido) · Enlace desde la fila de `fixtures` con `game_id` (S8 / S1 calendario) a `#/partido/<game_id>/analizar` · lo implementa F-12 reutilizando `navigate("partido", …)` · Done: desde el calendario se abre el partido importado.

## Matriz de cobertura
| CA | Tareas |
|---|---|
| CA-1 | T-B1, T-B2, T-B5, T-B8, T-B12, T-F6 |
| CA-2 | T-D2, T-F7 |
| CA-3 | T-D10, T-D11, T-F8 |
| CA-4 | T-A2, T-B1, T-B2, T-F9 |
| CA-5 | T-B3, T-D7, T-F10 |
| CA-6 | T-B4, T-D6, T-F11 |
| CA-7 | T-B4, T-F12 |
| CA-8 | T-B9, T-B11, T-D8, T-F13 |
| CA-9 | T-B11, T-F14 |
| CA-10 | T-B8, T-E1, T-F15 |
| CA-11 | T-B6, T-D4, T-F16 |
| CA-12 | T-B6, T-B11, T-D9, T-F17 |
| CA-13 | T-D9, T-F18 |
| CA-14 | T-D8, T-F19 |
| CA-15 | T-B12, T-F20 |
| CA-16 | T-A1, T-B2, T-F21 |

## Dependencias externas
- Requisitos implementados antes: X-01, T-05, T-06, T-02, C-03, F-06, A-01, A-05, F-11, F-13, C-08 (ver plan §10).
- **Reproceso con ingesta v2** de los 13 partidos del seed (F-11: `POST /api/reprocess`) para tener `period_pts`, rebotes/pérdidas de equipo, coordenadas, `previous_action`, `qualifiers` y `player_id`. Sin reproceso, CA-1 (rebotes de equipo), CA-6/CA-7 (coordenadas) no son verificables.
- Dataset: base local con los 13 partidos del seed (requiere `SEED_ENABLED=1` y login si hay `AUTH_USERS`; R-05), incluidos los 2 con prórroga; para CA-10, un partido sin pbp (copia de la base con `DELETE FROM pbp_events WHERE game_id=…`, documentado).
- Sin variables de entorno nuevas.
