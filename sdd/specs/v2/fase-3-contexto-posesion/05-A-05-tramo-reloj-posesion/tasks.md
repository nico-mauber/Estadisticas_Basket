# Tasks — A-05: Tramo de reloj de posesión

> **ID:** A-05 · **Prioridad:** P1 · **Fase y orden:** 3·05
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: configuración, datos de oportunidad y enriquecedor
- [ ] T-A1 · Activar `clock.early_max` y `clock.mid_max` en `CONFIG_SPEC` (`status: "reservada"` → `"activa"`) · `backend/config.py` · cubre RF-15 · Done: `GET /api/settings` las lista como editables; `PUT /api/settings` con `{"values": {"clock.early_max": 6}}` responde 200 y con `clock.early_max: 17` responde 400 por coherencia
- [ ] T-A2 · Agregar a `Chance` los campos `band`, `end_elapsed`, `end_player_id`, `end_lineup`, `turnover_kind`, `box` y a cada `shots[]` las claves `clock_start` y `lineup` · `backend/possessions.py` · cubre RF-2, RF-3, RF-4, RF-8, RF-9 · Done: `python -c "import possessions"` sin error
- [ ] T-A3 · Crear `backend/possession_clock.py` con `band_of(elapsed, shot_clock_start)` (cortes de configuración; reloj de 14 sin tramo tardío; `elapsed` nulo → `None`) · `backend/possession_clock.py` · cubre RF-2, RF-3 · Done: `band_of(8,24)=="temprano"`, `band_of(9,24)=="medio"`, `band_of(16,24)=="medio"`, `band_of(17,24)=="tardio"`, `band_of(10,14)=="medio"`, `band_of(15,14) is None`, `band_of(None,24) is None`
- [ ] T-A4 · `enrich_clock(possessions, events, meta)`: rango de eventos por oportunidad, `Chance.box`, evento de decisión, `end_elapsed`, `band`, `end_player_id`, `end_lineup`, `turnover_kind` · `backend/possession_clock.py` · cubre RF-1, RF-4, RF-8, RF-9 · Done: sobre un partido del seed cada oportunidad con acción tiene `band` (o `None` con motivo) y `Σ ch.box.fga` de las posesiones completas == tiros de campo del equipo en posesiones completas
- [ ] T-A5 · Asignar `shots[].band`, `shots[].clock_start`, `shots[].lineup` · `backend/possession_clock.py` · cubre RF-2, RF-3, RF-9 · Done: cada tiro de una oportunidad con reloj de 14 tiene `clock_start == 14` y nunca `band == "tardio"`
- [ ] T-A6 · Registrar `possessions.register_enricher("clock", enrich_clock)` e `import possession_clock` desde `app.py` · `backend/possession_clock.py`, `backend/app.py` · cubre RF-1 · Done: `GET /api/game/<game_id>/possessions` muestra `band` en `shots`
- [ ] T-A7 · Soporte de `clock`/`clock_start` en `team_possessions` (recorte por oportunidad, reutilizando el mecanismo de A-04) y rama en `context.possession_predicate` · `backend/possessions.py`, `backend/context.py` · cubre RF-12, RF-13 · Done: `team_possessions("CNF", comp, ctx(clock=("tardio",)))` devuelve solo oportunidades y tiros `tardio`

### Grupo B — Backend: fórmulas y agregación
- [ ] T-B1 [P] · `stats_engine.clock_rates(c)` (eFG%, TS% mixto, PPT, PPP, TO%, violaciones de 24 s, reparto, pintura/perímetro, `share`) · `backend/stats_engine.py` · cubre RF-5 · Done: `clock_rates` con `n=0` y `fga=0` devuelve todas las claves `None` sin excepción
- [ ] T-B2 · `clock_report(..., side="ataque")`: bloques `r24`/`r14` por tramo, `all`, `no_clock`, badge T-02 y fichas T-01 con población acotada al tramo · `backend/possession_clock.py` · cubre RF-3, RF-5, RF-14, RF-16 · Done: `r14.tardio` es `{"value": null, "reason": "no_aplica"}` y los porcentajes de `r24` no incluyen tiros de reloj de 14
- [ ] T-B3 · Conciliación (`reconcile`: `fga_team`, `in_bands_24`, `in_bands_14`, `no_clock`, `in_incomplete`, `ok`) · `backend/possession_clock.py` · cubre RF-6 · Done: `ok == true` y la suma coincide con `standard.fga` de `GET /api/team/<code>`
- [ ] T-B4 · `side="defensa"` sobre `team_possessions(..., side="defensa")` · `backend/possession_clock.py` · cubre RF-7 · Done: la respuesta lleva `side: "defensa"` y `players: []`
- [ ] T-B5 · `player_clock(player_id, comp_id, ctx)` y tabla `players` del modo equipo (USO%, PPP personal, fila "Equipo / sin jugador") · `backend/possession_clock.py` · cubre RF-8 · Done: Σ `finished` por tramo == oportunidades del equipo con tramo
- [ ] T-B6 · `lineup_clock(lineup_id, comp_id, ctx)` (validación de id de 5 jugadores del mismo equipo; `sin_quinteto`) · `backend/possession_clock.py` · cubre RF-9 · Done: Σ tiros de todos los quintetos + `sin_quinteto` == tiros del equipo por tramo
- [ ] T-B7 · `decision_panel(report, comp_id, ctx)` (q1…q7 con tipos de pérdida, diferencial contra la competencia en el mismo tramo, `reach_tardio_share`) · `backend/possession_clock.py` · cubre RF-10 · Done: `q1_perdidas.share_of_turnovers` suma 1 y `q6.reach_tardio_share` == `chances(tardio, r24)/Σ chances con tramo (r24)`
- [ ] T-B8 · `shot_zones.zone_table_from_shots` y rama de nivel posesión en `zones_with_stats` · `backend/shot_zones.py` · cubre RF-11, RF-12 · Done: `GET /api/shot-zones?entity=team&id=CNF&clock=tardio` suma `attempts` == tiros `tardio`
- [ ] T-B9 · `clock_matrix(...)` (tres tramos con percentil y badge `clock_zone`, "sin reloj"; defensa y quinteto sin percentil) · `backend/possession_clock.py` · cubre RF-11, RF-16 · Done: Σ `attempts` por tramo == `bands[b].all.shots`; con `has_coordinates == false` se informa el aviso
- [ ] T-B10 · Manejo de nulos: `sin_intentos`, `sin_pbp`, `games_excluded` · `backend/possession_clock.py` · cubre RF-16 · Done: un filtro que deja 0 oportunidades devuelve `value: null, reason: "sin_intentos"` y volumen `0`, sin `NaN`

### Grupo C — Backend: registros T-05/T-03/T-06 y ruta
- [ ] T-C1 [P] · `clock_bundles(req)` + `metrics_catalog.register_entity("clock", …)` + `MetricDef` de `clock_shot_share` y `clock_viol24_rate` · `backend/possession_clock.py`, `backend/metrics_catalog.py` · cubre RF-13 · Done: `GET /api/metrics/clock?id=CNF:tardio` devuelve todas las claves del conjunto estándar y `…:tardio:14` devuelve `no_aplica`
- [ ] T-C2 [P] · `context.register_dimension("clock", …)` y `("clock_start", …)` con sus parsers · `backend/context.py`, `backend/possession_clock.py` · cubre RF-13 · Done: `GET /api/context/options` marca `clock` y `clock_start` `available: true`; `clock=xx` → 400 `contexto_invalido`
- [ ] T-C3 [P] · `table_rows` y `matrix_rows` + `tables.register_table("team_clock", …)` y `("zone_clock_matrix", …)` · `backend/possession_clock.py`, `backend/tables.py` · cubre RF-11, RF-13 · Done: `GET /api/table/team_clock?team=CNF` y `GET /api/table/zone_clock_matrix?team=CNF` devuelven payload §7.6
- [ ] T-C4 · `GET /api/possession-clock` (fina: `parse_context`, valida `team`/`player`/`lineup` y `side`, delega) · `backend/app.py` · cubre RF-5…RF-11 · Done: `curl -b c.txt "http://localhost:5000/api/possession-clock?team=CNF"` responde 200 con el shape del plan §3
- [ ] T-C5 [P] · Errores 400/404 del plan §9 · `backend/app.py` · cubre RF-16 · Done: sin entidad → 400; `team=XXX` → 404; equipo sin pbp → 404 `sin_pbp`; `lineup=CNF:1-2` → 400 "Id de quinteto inválido"

### Grupo D — Frontend
- [ ] T-D1 · `api.possessionClock(params)` · `frontend/js/api.js` · cubre RF-5…RF-11 · Done: `await api.possessionClock({team: "CNF"})` en consola devuelve el objeto
- [ ] T-D2 · `components/clock-panel.js` con `renderClockPanel(el, payload, {mode})`: nota de fuente, tabla de tramos, bloque de reloj de 14, panel de decisión (siete tarjetas), tabla de jugadores, conciliación · `frontend/js/components/clock-panel.js` · cubre RF-1, RF-5…RF-10, RF-14 · Done: el panel renderiza con datos del seed sin errores de consola y muestra la nota de fuente derivada
- [ ] T-D3 · Matriz zona × tramo: tres mapas con `shotChart`/`bindZoneTooltips` de C-03 (color por percentil, "Sin tiros registrados"), tabla larga y `export-menu.js` · `frontend/js/components/clock-panel.js` · cubre RF-11 · Done: el tooltip de una celda muestra los 7 datos y el CSV exportado tiene todas las celdas
- [ ] T-D4 · Montar el bloque en la pestaña `posesion` de S3 y S4 y como sección colapsable del quinteto seleccionado en `quintetos`, con selector Ataque/Defensa y `side` en el hash · `frontend/js/views/equipo.js`, `frontend/js/views/jugador.js` · cubre RF-8, RF-9 · Done: `#/equipo/CNF/posesion` muestra el bloque y recargar conserva `side=defensa`
- [ ] T-D5 [P] · Estados loading/vacío/error/offline y aviso de zonas aproximadas con el copy del spec §6 · `frontend/js/components/clock-panel.js` · cubre RF-16 · Done: cortar la red muestra "Sin conexión: el análisis de posesiones necesita conexión."
- [ ] T-D6 [P] · Estilos: tarjetas de decisión, matriz, pestañas de tramo en mobile · `frontend/css/style.css` · cubre RF-10, RF-11 · Done: a 360 px no hay scroll horizontal de página
- [ ] T-D7 · Sumar `clock-panel.js` a `STATIC` y subir `CACHE` solo si X-01 no pasó a runtime caching · `frontend/sw.js` · Done: el panel carga con el SW activo tras recargar

### Grupo E — Documentación (cierre)
- [ ] T-E1 · `docs/api.md`: `GET /api/possession-clock`, `clock`/`clock_start` en `/api/shot-zones`, tablas `team_clock`/`zone_clock_matrix`, tipo `clock`, filtros
- [ ] T-E2 · `docs/metrics.md`: **fuente derivada del reloj de posesión** (resolución de 1 s, regla de tramos, reloj de 14, tratamiento de nulos), unidad oportunidad, fórmulas por tramo (TS% mixto), tipos de pérdida, limitación del saque tras canasta
- [ ] T-E3 · `docs/frontend.md`: bloque "Tramo de reloj de posesión", matriz y copy nuevo
- [ ] T-E4 · `docs/architecture.md`: módulo `possession_clock.py`

### Grupo F — Verificación de feature (manual, Constitución 8)
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · Sin cambio de esquema: confirmar que `python backend/database.py` sigue corriendo sin error
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o navegador (`/api/possession-clock` en ataque, defensa, jugador y quinteto; `/api/shot-zones?clock=…`; `/api/table/team_clock`; `/api/table/zone_clock_matrix`; `/api/metrics/clock`); shape verificado contra el plan §3
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo → Posesión → Tramo de reloj (ataque, defensa), Jugador → Posesión y Equipo → Quintetos
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅
- [ ] T-F6 · CA-1: `curl -b c.txt "http://localhost:5000/api/possession-clock?team=CNF&competition=<id>"`: `Σ bands[].all.shots + no_clock.shots + reconcile.in_incomplete == reconcile.fga_team` y `fga_team` == `standard.fga` de `GET /api/team/CNF?competition=<id>`; repetir con 3 equipos y `reconcile.ok == true`
- [ ] T-F7 · CA-2: en la inspección de A-01 (`GET /api/game/<game_id>/possessions`) localizar tiros con `elapsed` 8, 9, 16 y 17 (o inyectar el caso con `app.test_client()` sobre `band_of`) y confirmar `temprano`, `medio`, `medio`, `tardio`
- [ ] T-F8 · CA-3: `PUT /api/settings` con `clock.early_max = 6` y repetir T-F7: el tiro de 8 s pasa a `medio` sin reiniciar el servidor; restaurar con `POST /api/settings/reset`
- [ ] T-F9 · CA-4: localizar una segunda oportunidad (reloj de 14) con tiro a 10 s (→ `medio`, `r14`) y, si existe, uno a 15 s (→ tramo nulo `reloj_no_derivable`); confirmar `bands[tardio].r14 == {"value": null, "reason": "no_aplica"}`
- [ ] T-F10 · CA-5: localizar (o inyectar con `app.test_client()`) un tiro con `elapsed` nulo y confirmar que está en `no_clock.shots` y no en `temprano`
- [ ] T-F11 · CA-6: recalcular a mano Σ puntos / Σ oportunidades del tramo `temprano` (reloj de 24 s) desde la inspección de 2 partidos y comparar con `bands[temprano].r24.metrics.ppp`; verificar eFG%, TS% y PPT con las fórmulas del glosario
- [ ] T-F12 · CA-7: sumar `mix` (t2 + t3 + tl + perdida == 1) por tramo y comparar `to_pct` con pérdidas/oportunidades
- [ ] T-F13 · CA-8: sumar `turnover_types` por tramo == pérdidas del tramo; verificar que `viol24_rate` == pérdidas con subtipo `24sec` / oportunidades (contrastar con `GET /api/pbp/<game_id>`)
- [ ] T-F14 · CA-9: `side=defensa` de A y de B en los mismos partidos: tiros y oportunidades por tramo de A en defensa == los de B en ataque contra A
- [ ] T-F15 · CA-10: `GET /api/possession-clock?team=CNF` (`players`): Σ tiros por jugador + sin jugador == tiros del equipo por tramo; Σ USO% por tramo == 1
- [ ] T-F16 · CA-11: sumar los tiros de todos los quintetos de 5 de `GET /api/table/team_lineups?team=CNF` (F-06) pedidos con `lineup=` + `reconcile.sin_quinteto` == tiros del equipo por tramo
- [ ] T-F17 · CA-12: abrir el panel de decisión y verificar las siete tarjetas contra la tabla de tramos (q1 suma 100 %, q2 = diferencial vs la competencia en el mismo tramo, q6 %, q7 == vista defensa)
- [ ] T-F18 · CA-13: verificar la matriz: Σ intentos por tramo == `bands[b].all.shots`; Σ tramos + "sin reloj" por zona == intentos de la zona en `GET /api/shot-zones?entity=team&id=CNF`; tooltip con los 7 datos; celdas de muestra baja en gris; exportar CSV y contar las celdas
- [ ] T-F19 · CA-14: `GET /api/shot-zones?entity=team&id=CNF&clock=tardio` → Σ `attempts` == `bands[tardio].all.shots`; con `clock_start=14` solo oportunidades de reloj de 14
- [ ] T-F20 · CA-15: `curl -b c.txt "http://localhost:5000/api/metrics/team?id=CNF&clock=tardio&clock_start=14&competition=<id>"`: `context.ignored` sin `clock` ni `clock_start` y `possessions_counted` == oportunidades que cumplen
- [ ] T-F21 · CA-16: `GET /api/metrics/clock?id=CNF:tardio`: todas las claves del conjunto estándar (no aplicables con `reason: "no_aplica"`); `…:tardio:14` → `no_aplica`
- [ ] T-F22 · CA-17: tramo `tardio` con `clock_start=14` → `null` con `sin_intentos` / `no_aplica`, volumen `0`, sin `NaN`; equipo sin pbp → 404 `sin_pbp`
- [ ] T-F23 · CA-18: con una competencia sin reprocesar con coordenadas (o la del seed antes de F-11), abrir la matriz: aviso "Las zonas son aproximadas…" y `has_coordinates: false`
- [ ] T-F24 · CA-19: en los 2 partidos con prórroga del seed, verificar que los tiros de la prórroga tienen `band`
- [ ] T-F25 · CA-20: confirmar la nota de fuente derivada en pantalla y en `docs/metrics.md`
- [ ] T-F26 · CA-21: recorrer Equipo → Posesión → Tramo de reloj en viewport < 768 px, sin scroll horizontal ni errores de consola

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-A4, T-A5, T-B2, T-B3, T-F6 |
| CA-2 | T-A3, T-F7 |
| CA-3 | T-A1, T-A6, T-F8 |
| CA-4 | T-A3, T-A5, T-B2, T-F9 |
| CA-5 | T-A3, T-A5, T-B10, T-F10 |
| CA-6 | T-B1, T-B2, T-F11 |
| CA-7 | T-B1, T-F12 |
| CA-8 | T-A4, T-B1, T-F13 |
| CA-9 | T-B4, T-F14 |
| CA-10 | T-A4, T-B5, T-F15 |
| CA-11 | T-A4, T-A5, T-B6, T-F16 |
| CA-12 | T-B7, T-D2, T-F17 |
| CA-13 | T-B8, T-B9, T-D3, T-F18 |
| CA-14 | T-A7, T-B8, T-F19 |
| CA-15 | T-A7, T-C2, T-F20 |
| CA-16 | T-C1, T-F21 |
| CA-17 | T-B10, T-C5, T-F22 |
| CA-18 | T-B9, T-D5, T-F23 |
| CA-19 | T-A4, T-F24 |
| CA-20 | T-D2, T-E2, T-F25 |
| CA-21 | T-D6, T-F26 |

## Dependencias externas
- Competencia del seed (13 partidos) reprocesada con ingesta v2 (F-11): necesaria para las coordenadas reales de tiro (matriz con zonas precisas, T-F18/T-F23), `qualifiers` y `previous_action`. Sin reprocesar, la matriz opera con zonas aproximadas y T-F23 se verifica con ese estado.
- Módulos de A-01, A-03 y A-04 disponibles (`possessions.py` con `register_enricher`, `include_incomplete` y recorte por oportunidad), ya cerrados antes en la fase 3.
- C-03 cerrado: `shot_zones.py`, `GET /api/shot-zones` y `components/shot-chart.js` (`shotChart`, `bindZoneTooltips`).
- Claves `clock.early_max`, `clock.mid_max` declaradas por F-13 y `clock.reset_secs` activa por A-01; usuario administrador para T-F8 (`ADMIN_USERS` o modo abierto).
- F-06 cerrado (pestaña `quintetos` y tabla `team_lineups` para T-F16) y X-01 (pestaña `posesion`).
- Un segundo equipo en la misma competencia (A y B con partidos entre sí) para T-F14.
