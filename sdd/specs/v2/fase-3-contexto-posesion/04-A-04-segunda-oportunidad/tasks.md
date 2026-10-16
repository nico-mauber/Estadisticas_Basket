# Tasks — A-04: Rebote ofensivo y segunda oportunidad

> **ID:** A-04 · **Prioridad:** P1 · **Fase y orden:** 3·04
> **Depende de:** A-01, A-03 (y A-02, F-11, F-13, T-02, T-05, T-06, T-03, X-01, C-03) · **Habilita:** A-05, A-06, A-07
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: configuración y modelo de oportunidad
- [ ] T-A1 · Agregar `oreb.putback_secs` (3, 1–6) y `oreb.kickout_secs` (6, 2–10) a `CONFIG_SPEC`, sección "Reglas de contexto" · `backend/config.py` · cubre RF-2 · Done: `GET /api/settings` las lista con default y rango; S9 → Contexto las muestra.
- [ ] T-A2 · Agregar a `Chance` los campos `oreb_event`, `oreb_by_id`, `missed_shot_kind`, `first_shot_mode`, `first_shot_elapsed` (default `None`) · `backend/possessions.py` · cubre RF-2, RF-6, RF-9 · Done: `GET /api/game/<id>/possessions` sigue respondiendo y cada chance trae las claves nuevas en `null`.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Implementar `kind_of(shot)` y `previous_shot_event(events, reb)` (fallback sin `previous_action`) · `backend/second_chance.py` · cubre RF-6 · Done: con `app.test_client()`/script ad hoc, un rebote tras triple fallado devuelve `triple`; un partido sin `previous_action` devuelve el tiro previo.
- [ ] T-B2 · Implementar `enrich_second_chance` (modo del tiro y precedencia de desenlaces D-1) y registrarlo con `possessions.register_enricher("second_chance", …)` · `backend/second_chance.py` · cubre RF-1, RF-2 · Done: en `/api/game/<id>/possessions` toda chance n≥2 de posesión completa tiene `outcome` ∈ enum y las n=1 `null`.
- [ ] T-B3 · Implementar `stats_engine.second_chance_rates(c)` con `_safe_div` · `backend/stats_engine.py` · cubre RF-3, RF-4, RF-11 · Done: con conteos de prueba devuelve PPP/pts por RO/conversión/OR% concedido; denominador 0 → `None`.
- [ ] T-B4 · Implementar `_aggregate(side)` + `second_chance_report` (resumen, desenlaces, orígenes, cadenas, jugadores) con caché `poss:second_chance` · `backend/second_chance.py` · cubre RF-3…RF-9, RF-14, RF-20 · Done: suma de desenlaces = `second_chances` y suma de puntos = `second_chance_pts` para un equipo del seed.
- [ ] T-B5 · Implementar `cost_of_oreb` (consume `origin` de A-02 y `ptype` de A-03) · `backend/second_chance.py` · cubre RF-10 · Done: devuelve `transitions_conceded ≤ rival_dreb_possessions` y `approximation: true`.
- [ ] T-B6 · Implementar `reconcile_second_chance` + check `second_chance_mismatch` en `data_quality.register_check` · `backend/second_chance.py`, `backend/data_quality.py` · cubre RF-13 · Done: `reconcile.calc`, `official`, `games_mismatch`, `games_excluded` presentes; `GET /api/data-quality` muestra el check.
- [ ] T-B7 · Implementar `player_second_chance` (captura y finalización; conciliación por jugador contra `player_game_stats.second_chance_pts` no nulo) · `backend/second_chance.py` · cubre RF-9, RF-19 · Done: `?player=<id>` devuelve `summary` + `finishing`.
- [ ] T-B8 · Adjuntar fichas T-01 (`population.attach_fichas`) y badges T-02 (`sample.sample_level('split', …)`) a métricas y filas · `backend/second_chance.py` · cubre RF-16, RF-17 · Done: `summary.metrics.ppp_2nd.percentile` y `sample.level` presentes.
- [ ] T-B9 · Registrar tipo de entidad `chance` (`chance_bundles`) y metadatos de claves de la vista en el catálogo · `backend/second_chance.py`, `backend/metrics_catalog.py` · cubre RF-15 · Done: `GET /api/metrics/chance?id=<code>:segunda` trae todas las claves del conjunto estándar.
- [ ] T-B10 · Registrar la dimensión `chance` (`context.register_dimension`) con unidad oportunidad (D-7) · `backend/context.py`, `backend/second_chance.py` · cubre RF-15, RF-17 · Done: `GET /api/context/options` lista `chance` como disponible; `chance=segunda` ya no aparece en `context.ignored`.
- [ ] T-B11 · Registrar la tabla `team_second_chance` (`table_rows`, parámetro `section`) · `backend/second_chance.py`, `backend/tables.py` · cubre RF-18 · Done: `GET /api/table/team_second_chance?team=<code>&section=desenlaces` devuelve payload §7.6.
- [ ] T-B12 · Ruta fina `GET /api/second-chance` (validación `team`/`player`, `side`, contexto, errores §9) · `backend/app.py` · cubre RF-3…RF-14, RF-19, RF-20 · Done: curl con `team`, con `player`, con `side=defensa` y sin parámetros (400) responde lo esperado.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.secondChance(params)` usando `qs()` · `frontend/js/api.js` · cubre RF-3…RF-19 · Done: llamada desde consola devuelve el JSON.

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · `renderSecondChancePanel` (fichas, desenlaces, orígenes, jugadores, coste, defensa, conciliación) con `t()` · `frontend/js/components/second-chance-panel.js` · cubre RF-3…RF-13, RF-16 · Done: el bloque se ve con datos del seed.
- [ ] T-D2 · Montar el bloque en la pestaña `posesion` de Equipo con selector Ataque/Defensa y `side` en la query del hash · `frontend/js/views/equipo.js` · cubre RF-14, RF-17 · Done: cambiar a Defensa recarga y la URL conserva `side=defensa`.
- [ ] T-D3 · Montar el modo jugador en la pestaña `posesion` de S4 · `frontend/js/views/jugador.js` · cubre RF-19 · Done: perfil de un pívot muestra RO capturados y finalización.
- [ ] T-D4 [P] · Estilos del histograma y leyendas · `frontend/css/style.css` · cubre RF-11 · Done: histograma legible en 360 px.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/vacío/error/offline con el copy de spec §6; filas de muestra baja en gris; "—" con `title` en nulos · `second-chance-panel.js` · cubre RF-7, RF-12, RF-16, RF-20 · Done: equipo sin pbp y selección sin RO muestran el copy exacto.
- [ ] T-E2 · Si `sw.js` sigue con lista `STATIC`: sumar el componente y subir `CACHE` · `frontend/sw.js` · Done: recarga offline no rompe la carga del módulo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · `upgrade_db()` idempotente: no aplica (sin cambios de esquema); verificar que `python backend/database.py` sigue corriendo 2 veces sin error.
- [ ] T-F3 · Endpoints probados con curl: `curl -b cookies.txt "http://localhost:5000/api/second-chance?team=<code>&competition=<id>"`, `…&side=defensa`, `…?player=<id>`, `http://localhost:5000/api/table/team_second_chance?team=<code>&section=jugadores`, `http://localhost:5000/api/metrics/chance?id=<code>:segunda`; shapes verificados contra plan §3.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo → Posesión (ataque y defensa) y Jugador → Posesión.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md`.
- [ ] T-F6 · CA-1 (cliente): con los 13 partidos del seed reprocesados, comparar `reconcile.calc` vs `reconcile.official` por equipo (script ad hoc con `app.test_client()` iterando `GET /api/teams`); registrar tabla equipo · calculado · oficial · diferencia · partidos con diferencia y causa.
- [ ] T-F7 · CA-2: sumar `outcomes[].chances` y `outcomes[].pts` y comparar con `summary.second_chances` y `summary.metrics.second_chance_pts`.
- [ ] T-F8 · CA-3: comparar `summary.oreb_captured + summary.oreb_in_incomplete` con Σ`orb` del box del equipo en la selección (`GET /api/team/<code>` o consulta SQLite).
- [ ] T-F9 · CA-4: buscar en `/api/game/<id>/possessions` una chance con tiro asistido a ≤3 s del RO y verificar que su `first_shot_mode` no es `putback`.
- [ ] T-F10 · CA-5: `PUT /api/settings {"values": {"oreb.putback_secs": 2}}`, recargar, comparar conteo de `putback` (≤ antes) y total (igual); restaurar con `POST /api/settings/reset`.
- [ ] T-F11 · CA-6: sumar `players[].oreb` (incluida "Rebote de equipo") y `players[].finished_pts` vs totales.
- [ ] T-F12 · CA-7: navegador — tarjeta "Zona del rebote" y "Rebote largo vs en la zona" muestran "—" con explicación.
- [ ] T-F13 · CA-8: `?team=<code>&last=1&quarter=1` (o una selección sin RO) → métricas `null` con `reason: "sin_intentos"`; UI "—".
- [ ] T-F14 · CA-9: selección chica (`last=1`) → badge "baja" en gris, sin percentil.
- [ ] T-F15 · CA-10: `side=defensa` de A contra B (`opponent=B`) vs `side=ataque` de B con `opponent=A`: PPP 2.ª iguales; `opp_or_pct == 1 − dr_pct` del equipo.
- [ ] T-F16 · CA-11: `curl "http://localhost:5000/api/metrics/team?id=<code>&chance=segunda"` → sin `chance` en `context.ignored` y `possessions_counted == second_chances`.
- [ ] T-F17 · CA-12: `GET /api/metrics/chance?id=<code>:segunda` → comparar claves con `GET /api/metrics-catalog` (ninguna faltante).
- [ ] T-F18 · CA-13: con un partido importado con ingesta anterior (o `ingest_version` puesto en NULL en una copia de la base), verificar `reconcile.games_excluded` y que el origen del RO se sigue calculando.
- [ ] T-F19 · CA-14: navegador en modo responsive 360×740 — sin scroll horizontal; consola limpia.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B6, T-B12, T-D1, T-F6 |
| CA-2 | T-B2, T-B4, T-F7 |
| CA-3 | T-B2, T-B4, T-F8 |
| CA-4 | T-B2, T-F9 |
| CA-5 | T-A1, T-B2, T-F10 |
| CA-6 | T-B4, T-B7, T-F11 |
| CA-7 | T-D1, T-E1, T-F12 |
| CA-8 | T-B3, T-E1, T-F13 |
| CA-9 | T-B8, T-E1, T-F14 |
| CA-10 | T-B4, T-B3, T-F15 |
| CA-11 | T-B10, T-F16 |
| CA-12 | T-B9, T-F17 |
| CA-13 | T-B1, T-B6, T-F18 |
| CA-14 | T-D1, T-D4, T-F19 |

## Dependencias externas
- A-01, A-02 y A-03 implementados (motor, `origin`, `ptype`); F-11 (columnas `previous_action`/`qualifiers`, `ingest_version`,
  `data_quality`), F-13, T-01, T-02, T-03, T-05, T-06, C-03 y X-01 cerrados.
- Dataset de verificación: los 13 partidos del seed **reprocesados con la ingesta v2** (`POST /api/reprocess`), de modo que
  `second_chance_pts` y `previous_action` sean confiables. Requiere login y `SEED_ENABLED` solo en local.
- Sin variables de entorno nuevas.
