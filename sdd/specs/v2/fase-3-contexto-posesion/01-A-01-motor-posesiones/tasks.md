# Tasks — A-01: Reconstrucción de la posesión

> **ID:** A-01 · **Prioridad:** P0 · **Fase y orden:** 3·01
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md) · [Especificación v2 §5.1 · A-01](../../00-especificacion-cliente-v2.md)

## Orden de ejecución

### Grupo A — Backend: base de quintetos y configuración
- [ ] T-A1 · Implementar `build_segments_both(events, codes, starters)` y `event_lineups(...)` (PROPUESTA) reutilizando la lógica de `build_segments` · `backend/lineups.py` · cubre RF-9 · Done: con `app.test_client()`/script ad hoc sobre un partido del seed, `Σ seconds == 2400` (4 cuartos) y `== 2700` en un partido con una prórroga; cada tramo tiene 5 ids por lado (o `None` sin 5 titulares).
- [ ] T-A2 [P] · Agregar `clock.reset_secs` (int, 14, 10–24, "Reglas de contexto") a `CONFIG_SPEC` · `backend/config.py` · cubre RF-4 · Done: `GET /api/settings` lista la clave con default 14 y aparece en S9 → Contexto.
- [ ] T-A3 [P] · Agregar `poss_seconds` y `finished_poss` a `StatBundle` (PROPUESTA, default `None`) · `backend/stats_engine.py` · cubre RF-15 · Done: el backend arranca y `/api/metrics/team?id=<code>` responde igual que antes.

### Grupo B — Backend: motor, conciliación y rutas
- [ ] T-B1 · Dataclasses `Chance`/`Possession` (arquitectura §3.9 + campos PROPUESTA `box`, `opp_box`, `lineup_changed`, `score_start`, `event_numbers`) y `register_enricher` · `backend/possessions.py` · cubre RF-2 · Done: `import possessions` sin error.
- [ ] T-B2 · Pre-proceso `_prepare` (orden por `action_number`, índice ordinal de período, reloj monótono `mclock`, parseo "XofY", calificadores y `previous_action`, `name_to_id`) · `backend/possessions.py` · cubre RF-1, RF-8 · Done: script ad hoc imprime para un partido `mclock` no creciente dentro de cada período.
- [ ] T-B3 · Máquina de estados: apertura/cierre por canasta, TL final, rebote defensivo (incl. de equipo), pérdida, fin de período · `backend/possessions.py:_build` · cubre RF-3 · Done: en un partido del seed ninguna posesión queda con `end_type` nulo salvo las incompletas.
- [ ] T-B4 · Rebote ofensivo → nueva `Chance` con `shot_clock_start = config.get("clock.reset_secs")` · `backend/possessions.py:_build` · cubre RF-4 · Done: inspección muestra posesiones con 2+ oportunidades y la 2.ª con 14.
- [ ] T-B5 · Series de TL: falta en acción de tiro, and-one por calificadores con fallback heurístico, técnicas (puntos fuera de posesión), antideportivas con retención · `backend/possessions.py:_build` · cubre RF-5, RF-6 · Done: CA-4, CA-5 y CA-6 verificables en la inspección.
- [ ] T-B6 · Huecos: `gap()` con motivos (`cambio_sin_cierre`, `sin_finalizacion`, `reloj_no_derivable`…), lista `anomalies`, salto entre dos → `perdida` · `backend/possessions.py:_build` · cubre RF-7 · Done: inyección de CA-8 produce `incomplete: true` con motivo.
- [ ] T-B7 · Asignación de conteos por lado (`box`/`opp_box`), `assist`/`block`/`steal` por `previous_action`, `finisher_id`/`assister_id`/`turnover_by_id`, quintetos por `event_lineups` · `backend/possessions.py:_build` · cubre RF-2, RF-9 · Done: Σ `box.pts` por equipo = puntos pbp del equipo.
- [ ] T-B8 · `game_possessions` con `cache.memo("poss:game", ...)` y ejecución de enriquecedores protegida · `backend/possessions.py` · cubre RF-17 · Done: segunda llamada en el mismo proceso no recalcula (log/tiempo); tras cambiar `clock.reset_secs` sí recalcula.
- [ ] T-B9 · `reconcile(scope)` por partido y por competencia (fórmula pbp y box, `period_end_empty`, puntos vs box, `games_over_5pct`) · `backend/possessions.py` · cubre RF-10, RF-11 · Done: sobre el seed, `totals.diff_pct` en ±2 y `pts_ok` true en 26/26 equipo-partido.
- [ ] T-B10 · `team_possessions(team_code, comp_id, ctx, side)` con filtros de contexto adaptados a posesión y `possession_predicate` · `backend/possessions.py` · cubre RF-14 · Done: `team_possessions("CNF", comp, ctx_quarter_4)` solo devuelve posesiones del 4.º cuarto.
- [ ] T-B11 · `possessions_bundle(...)` (PROPUESTA) y rama `level == "posesion"` en los loaders de `team`/`lineup`/`split` · `backend/possessions.py` + loaders (T-05/T-03) · cubre RF-14 · Done: con un parámetro de posesión registrado de prueba (dimensión dummy en script ad hoc) la respuesta de `/api/metrics/team` sale de posesiones y `context.level == "posesion"`.
- [ ] T-B12 · Métricas `possessions_counted`, `off_poss_duration`, `player_poss_duration` en `compute_standard` + `MetricDef` en catálogo + loaders team/player completan el bundle · `backend/stats_engine.py`, `backend/metrics_catalog.py` · cubre RF-15 · Done: CA-13.
- [ ] T-B13 · `possession_gaps_check` + `data_quality.register_check("possession_gaps", ...)`, quitando el placeholder `no_disponible` · `backend/possessions.py`, `backend/data_quality.py` · cubre RF-13 · Done: `GET /api/data-quality?competition=<id>` trae `possession_gaps.status` ≠ `no_disponible`.
- [ ] T-B14 · `ppp_stats` (PROPUESTA) + `sample.band` con σ empírico + `calibrate_k(method="posesiones_alternas")` · `backend/possessions.py`, `backend/sample.py` · cubre RF-16 · Done: `POST /api/settings/calibrate {"entity":"lineup","competition":<id>,"method":"posesiones_alternas"}` devuelve `method: "posesiones_alternas"` y un `k_suggested` numérico o nulo con razón.
- [ ] T-B15 · Rutas `GET /api/game/<game_id>/possessions` y `GET /api/possessions/reconcile` (finas, errores §9 del plan) · `backend/app.py` · cubre RF-12 · Done: curl con partido real devuelve el shape del plan §3; partido inexistente → 404 `no_encontrado`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.gamePossessions(gameId, params)` y `api.possessionsReconcile(params)` · `frontend/js/api.js` · cubre RF-12 · Done: desde la consola del navegador ambas promesas resuelven con el JSON.

### Grupo D — Frontend: UI
- [ ] T-D1 · Tarjeta "Conciliación de posesiones" (tabla ordenable, alerta > 2 %, lista > 5 %, CSV) en la pestaña `calidad` · `frontend/js/views/datos.js`, `frontend/css/style.css` · cubre RF-10 · Done: se ve la tabla con los equipos del seed y el CSV descarga con `;` y coma decimal.
- [ ] T-D2 · Hoja de inspección de posesiones de un partido (filtro por equipo, incompletas marcadas, `#/datos/calidad?game=`) · `frontend/js/views/datos.js`, `frontend/css/style.css` · cubre RF-12 · Done: clic en un partido abre la hoja; recargar la URL la reabre.
- [ ] T-D3 · Check `possession_gaps` renderizado como ok/alerta con texto "N posesiones incompletas (x,x %) en M partidos" · `frontend/js/views/datos.js` · cubre RF-13 · Done: CA-14.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados vacío/error/offline con copy del spec §6 vía `t()` · `frontend/js/views/datos.js` · cubre RF-12, RF-13 · Done: competencia sin pbp muestra "Ningún partido de esta competencia tiene play-by-play. Reimportá sus partidos."; con la red cortada se ve el copy de sin conexión.
- [ ] T-E2 · Subir `CACHE` en `sw.js` si X-01 mantiene versionado · `frontend/sw.js` · Done: tras recargar, DevTools → Application muestra la versión nueva.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · Sin cambios de esquema: `python backend/database.py` corre 2 veces seguidas sin error (control de no regresión).
- [ ] T-F3 · Endpoints nuevos/tocados probados con curl: `curl -b cookie.txt "http://localhost:5000/api/game/2849328/possessions?detail=1"`, `curl -b cookie.txt "http://localhost:5000/api/possessions/reconcile?competition=<id>"`, `curl -b cookie.txt "http://localhost:5000/api/data-quality?competition=<id>"`, `curl -b cookie.txt "http://localhost:5000/api/metrics/team?id=CNF"`; shapes verificados contra plan §3.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Datos → Calidad, la tarjeta de conciliación y la inspección.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` con evidencia.
- [ ] T-F6 · CA-1 (CA del cliente): con el seed reprocesado (ingesta v2), `GET /api/possessions/reconcile?competition=<id>` → todo `teams[].within_2pct == true`; si alguno falla, aplicar el procedimiento de diagnóstico del plan §4.8 y documentar causa y corrección en `progress.md` antes de seguir.
- [ ] T-F7 · CA-2: script ad hoc con `app.test_client()` recorre los 13 partidos y verifica `reconcile[team].pts_ok` en los 26 equipo-partido.
- [ ] T-F8 · CA-3: buscar en `?detail=1` una posesión con `len(chances) ≥ 2` y canasta en la 2.ª; verificar `shot_clock_start == 14` y `pts`.
- [ ] T-F9 · CA-4 y CA-5: localizar en `GET /api/pbp/<game_id>` una falta `shooting` con "2of2" convertido y un and-one ("1of1" tras canasta); verificar en la inspección cierre, `end_type` y puntos.
- [ ] T-F10 · CA-6: localizar una falta `technical` en el pbp del seed; verificar que la posesión en curso no cierra y `outside_points` suma el TL técnico del equipo no atacante.
- [ ] T-F11 · CA-7: en los 2 partidos con prórroga, verificar posesiones `period_type == "OVERTIME"`, duraciones en [0, 300] y cierre `fin_periodo` en el último evento de cada período.
- [ ] T-F12 · CA-8: en una copia de la base (`DB_PATH` a un archivo temporal), borrar un `rebound` defensivo de un partido; recalcular y verificar `incomplete: true` con motivo, `possessions_counted` una menos y el ítem en `possession_gaps`. Restaurar.
- [ ] T-F13 · CA-9: en la copia, poner `starter = 0` a un titular de un equipo; verificar `own_on_court == null` para ese equipo y resto completo.
- [ ] T-F14 · CA-10: `curl` a un partido sin pbp (importar uno sin pbp o borrar sus eventos en la copia) → 404 `sin_pbp`; la conciliación lo cuenta en `games_excluded.sin_pbp`.
- [ ] T-F15 · CA-11: script ad hoc verifica en todo el seed `duration == start_clock − end_clock ≥ 0` y `0 ≤ elapsed ≤ shot_clock_start` o `null`.
- [ ] T-F16 · CA-12: `PUT /api/settings {"values": {"clock.reset_secs": 12}}`, repetir la inspección → 2.ªs oportunidades con 12; restaurar con `POST /api/settings/reset`.
- [ ] T-F17 · CA-13: `/api/metrics/team?id=CNF` con `possessions_counted` y `off_poss_duration` con valor; `/api/metrics/lineup?id=<quinteto sin pbp>` con nulos y razón.
- [ ] T-F18 · CA-14: navegador, Datos → Calidad muestra el check con cantidad, % y partidos.
- [ ] T-F19 · CA-15: medir con `time curl` la conciliación en frío (reinicio) y en caliente; anotar tiempos en `progress.md`.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B3, T-B4, T-B5, T-B6, T-B9, T-B15, T-F6 |
| CA-2 | T-B5, T-B7, T-B9, T-F7 |
| CA-3 | T-B4, T-F8 |
| CA-4 | T-B5, T-F9 |
| CA-5 | T-B5, T-F9 |
| CA-6 | T-B5, T-F10 |
| CA-7 | T-A1, T-B2, T-B3, T-F11 |
| CA-8 | T-B6, T-B13, T-F12 |
| CA-9 | T-A1, T-B7, T-F13 |
| CA-10 | T-B15, T-E1, T-F14 |
| CA-11 | T-B2, T-F15 |
| CA-12 | T-A2, T-B8, T-F16 |
| CA-13 | T-A3, T-B12, T-F17 |
| CA-14 | T-B13, T-D3, T-F18 |
| CA-15 | T-B8, T-F19 |

## Dependencias externas
- Fases 1 y 2 cerradas; en particular F-11 (ingesta v2 con `previous_action` y `qualifiers`, `repository`, `cache`, `data_quality`, corrección `OVERTIME` en `lineups.py`), T-05, F-13, T-02, T-03, C-08 y C-03.
- **Reproceso** de todos los partidos de la competencia de verificación con ingesta v2 (`POST /api/reprocess`) antes de T-F6.
- Dataset de verificación: los 13 partidos del seed (`SEED_ENABLED=1` + login; 2 con prórroga); copia de la base para las inyecciones de CA-8/9/10 (`DB_PATH` temporal).
- Sin variables de entorno nuevas ni dependencias pip/npm.
