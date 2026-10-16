# Tasks — A-03: Transición y contraataque

> **ID:** A-03 · **Prioridad:** P1 · **Fase y orden:** 3·03
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: configuración, datos de posesión y enriquecedor
- [ ] T-A1 · Activar `transition.max_secs` y `early_offense.max_secs` en `CONFIG_SPEC` (`status: "reservada"` → `"activa"`) · `backend/config.py` · cubre RF-16 · Done: `GET /api/settings` las lista como editables y `PUT /api/settings` con `{"values": {"transition.max_secs": 6}}` responde 200 (y 400 `parametro_invalido` con `transition.max_secs: 13` por coherencia)
- [ ] T-A2 · Agregar a `Possession` los campos `first_elapsed`, `ptype_reason`, `finish_kind`, `starter_id`, `end_player_id` (default `None`) y el parámetro `include_incomplete=False` de `team_possessions` · `backend/possessions.py` · cubre RF-1, RF-3, RF-8, RF-10 · Done: `python -c "import possessions"` sin error y `team_possessions(..., include_incomplete=True)` devuelve también las incompletas
- [ ] T-A3 · Crear `backend/transition.py` con `enrich_ptype(possessions, events, meta)`: primer evento de decisión, cortes de configuración, `ptype`/`ptype_reason`/`first_elapsed` · `backend/transition.py` · cubre RF-1, RF-2, RF-3 · Done: sobre un partido del seed cada posesión completa con acción tiene `ptype` en {transicion, early, media_cancha} y las demás una `ptype_reason`
- [ ] T-A4 · Calcular `finish_kind` (subtipo del tiro de 2 y zona del triple) en `enrich_ptype` · `backend/transition.py` · cubre RF-8 · Done: una bandeja (`layup`) queda `bandeja_volcada` y un triple de `left_corner_3` queda `triple_esquina`
- [ ] T-A5 · Calcular `end_player_id` (tiro, pérdida, `foulon`) y `starter_id` (rebote defensivo; robo vinculado por `previous_action` con fallback de vecindad) · `backend/transition.py` · cubre RF-10 · Done: para una transición tras rebote defensivo `starter_id` es el `player_id` del rebotero y para un rebote de equipo es `None`
- [ ] T-A6 · Registrar el enriquecedor con `possessions.register_enricher("ptype", enrich_ptype)` y `import transition` desde `app.py` · `backend/transition.py`, `backend/app.py` · cubre RF-1 · Done: `GET /api/game/<game_id>/possessions` devuelve `ptype` no nulo en las posesiones completas

### Grupo B — Backend: fórmulas y agregación
- [ ] T-B1 [P] · `stats_engine.ptype_rates(c)` (delega en `origin_rates`; agrega `first_shot_secs` y `share`) · `backend/stats_engine.py` · cubre RF-4, RF-5, RF-7 · Done: `ptype_rates` con `n=0` devuelve todas las claves `None` sin excepción
- [ ] T-B2 · `transition_report(..., side="ataque")`: tipos, `share`, `diff`, `first_shot`, `summary.unclassified`, badge T-02 y fichas T-01 (con población acotada al tipo) · `backend/transition.py` · cubre RF-4, RF-5, RF-7, RF-18, RF-20 · Done: `share` de los tres tipos suma 1 y `Σ possessions == summary.classified`
- [ ] T-B3 · Origen del contraataque (`origin_of_transition`) y cruce con A-02 · `backend/transition.py` · cubre RF-6 · Done: `Σ transitions` de las filas == `types[transicion].possessions`
- [ ] T-B4 · Distribución de finalización en transición (`finish_in_transition`, `finish_period_end`) · `backend/transition.py` · cubre RF-8 · Done: las seis categorías suman las transiciones menos `finish_period_end`
- [ ] T-B5 · `dreb_to_transition` (% RD → transición y % que anota) · `backend/transition.py` · cubre RF-9 · Done: `drb_possessions` == posesiones clasificadas con origen `rebote_defensivo`
- [ ] T-B6 · Corredores (`players`, `players_coverage`, `assists_in_transition`) y `pass_out` nulo con razón `no_registrado` · `backend/transition.py` · cubre RF-10, RF-11 · Done: `pass_out.value == null` y `reason == "no_registrado"`; `Σ initiated ≤ transitions`
- [ ] T-B7 · Bloque defensivo (`side="defensa"`): `types`/`diff` del rival, `conceded_per100`, `conceded_by_origin` · `backend/transition.py` · cubre RF-12, RF-13 · Done: `conceded_per100 == 100 × transiciones / posesiones clasificadas del rival`
- [ ] T-B8 · `own_turnovers_to_transition` (posesión rival siguiente por orden de partido, incompletas excluidas y contadas) y `balance` (con `follows_fg_miss`) · `backend/transition.py` · cubre RF-14, RF-15 · Done: los denominadores coinciden con las pérdidas propias completas y los tiros de campo propios fallados
- [ ] T-B9 · `player_transition(player_id, comp_id, ctx)` · `backend/transition.py` · cubre RF-19 · Done: `types[].possessions` suma las posesiones que el jugador finaliza
- [ ] T-B10 [P] · `reconcile_fastbreak` (solo ingesta v2; sin error ante diferencias) · `backend/transition.py` · cubre RF-21 · Done: partidos sin `ingest_version` actual aparecen en `games_excluded` con razón `no_registrado`
- [ ] T-B11 · Manejo de nulos: `sin_intentos` en denominadores 0, `sin_pbp` y `games_excluded` · `backend/transition.py` · cubre RF-20 · Done: un filtro que deja 0 transiciones devuelve `value: null, reason: "sin_intentos"` y `possessions: 0`, sin `NaN`

### Grupo C — Backend: registros T-05/T-03/T-06 y ruta
- [ ] T-C1 [P] · `ptype_bundles(req)` + `metrics_catalog.register_entity("ptype", …)` + `MetricDef` de `ptype_share` y `first_shot_secs` · `backend/transition.py`, `backend/metrics_catalog.py` · cubre RF-17 · Done: `GET /api/metrics/ptype?id=CNF:transicion` devuelve todas las claves del conjunto estándar
- [ ] T-C2 [P] · `context.register_dimension("ptype", …)` y rama `ptype` en `possession_predicate` · `backend/context.py`, `backend/transition.py` · cubre RF-17 · Done: `GET /api/context/options` marca `ptype` `available: true`
- [ ] T-C3 [P] · `table_rows(req)` + `tables.register_table("team_ptypes", …)` (secciones `tipos`, `origen`, `jugadores`) · `backend/transition.py`, `backend/tables.py` · cubre RF-17 · Done: `GET /api/table/team_ptypes?team=CNF` devuelve payload §7.6 con 3 filas
- [ ] T-C4 · `GET /api/transition` (fina: `parse_context`, valida `team` xor `player` y `side`, delega) · `backend/app.py` · cubre RF-4…RF-21 · Done: `curl -b c.txt "http://localhost:5000/api/transition?team=CNF"` responde 200 con el shape del plan §3
- [ ] T-C5 [P] · Errores 400/404 del plan §9 · `backend/app.py` · cubre RF-20 · Done: `?` sin entidad → 400; `team=XXX` → 404; equipo sin pbp → 404 `sin_pbp`

### Grupo D — Frontend
- [ ] T-D1 · `api.transition(params)` · `frontend/js/api.js` · cubre RF-4…RF-19 · Done: `await api.transition({team: "CNF"})` en consola devuelve el objeto
- [ ] T-D2 · `components/transition-panel.js` con `renderTransitionPanel(el, payload, {mode})` (fichas, tabla de tipos, origen, finalización, histograma CSS, corredores, bloque defensivo, conciliación) · `frontend/js/components/transition-panel.js` · cubre RF-4…RF-15, RF-18 · Done: el panel renderiza con los datos del seed sin errores de consola
- [ ] T-D3 · Montar el panel en la pestaña `posesion` de S3 y S4 (debajo de A-02), con selector Ataque/Defensa y `side` en el hash · `frontend/js/views/equipo.js`, `frontend/js/views/jugador.js` · cubre RF-19 · Done: `#/equipo/CNF/posesion` muestra el bloque y recargar conserva `side=defensa`
- [ ] T-D4 [P] · Estados loading/vacío/error/offline con el copy del spec §6 · `frontend/js/components/transition-panel.js` · cubre RF-20 · Done: cortar la red muestra "Sin conexión: el análisis de posesiones necesita conexión."
- [ ] T-D5 [P] · Estilos: grilla de fichas, barra apilada, histograma de barras CSS, mobile · `frontend/css/style.css` · cubre RF-7, RF-8 · Done: a 360 px de ancho no hay scroll horizontal de página
- [ ] T-D6 · Sumar `transition-panel.js` a `STATIC` y subir `CACHE` solo si X-01 no pasó a runtime caching · `frontend/sw.js` · Done: el panel carga con el SW activo tras recargar

### Grupo E — Documentación (cierre)
- [ ] T-E1 · `docs/api.md`: `GET /api/transition`, tabla `team_ptypes`, tipo `ptype`, filtro `ptype`
- [ ] T-E2 · `docs/metrics.md`: tres tipos, primer evento de decisión, reloj derivado y resolución de 1 s, métricas ofensivas y defensivas, cortes configurables, limitación del primer pase de salida
- [ ] T-E3 · `docs/frontend.md`: bloque "Transición y contraataque" y copy nuevo
- [ ] T-E4 · `docs/architecture.md`: módulo `transition.py`

### Grupo F — Verificación de feature (manual, Constitución 8)
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · Sin cambio de esquema: confirmar que `python backend/database.py` sigue corriendo sin error (no se agregó nada)
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o navegador (`/api/transition` ataque, defensa y jugador; `/api/table/team_ptypes`; `/api/metrics/ptype`); shape verificado contra el plan §3
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo → Posesión → Transición (ataque, defensa) y Jugador → Posesión
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅
- [ ] T-F6 · CA-1: `curl -b c.txt "http://localhost:5000/api/transition?team=CNF&competition=<id>"` y sumar `types[].share` (== 1) y `types[].possessions` (== `summary.classified`) para al menos 3 equipos
- [ ] T-F7 · CA-2: pedir `&venue=local`, `&venue=visitante` y sin filtro; verificar que transiciones y clasificadas de los dos subconjuntos suman las del total y repetir la consulta devuelve el mismo `identity.transition_share.value`
- [ ] T-F8 · CA-3: con `GET /api/game/<game_id>/possessions` localizar posesiones con primer evento a 7, 8, 12 y 13 s (o inyectar el caso ad hoc con `app.test_client()` sobre `enrich_ptype`) y confirmar `transicion`, `early`, `early`, `media_cancha`
- [ ] T-F9 · CA-4: `PUT /api/settings` con `transition.max_secs = 6` y repetir T-F8: la posesión de 7 s pasa a `early` sin reiniciar; restaurar el default con `POST /api/settings/reset`
- [ ] T-F10 · CA-5: en el mismo equipo hallar dos posesiones de origen `rebote_defensivo` con tipos distintos (ver `origin` y `ptype` en la inspección de A-01)
- [ ] T-F11 · CA-6: verificar `summary.unclassified` y que `classified + Σ unclassified == posesiones completas + incompletas` (comparar con `GET /api/possessions/reconcile`)
- [ ] T-F12 · CA-7: recalcular a mano Σ puntos / Σ posesiones de transición y de media cancha desde la inspección de A-01 de 2 partidos y comparar con `types[].metrics.ppp` y `diff`
- [ ] T-F13 · CA-8: sumar `origin_of_transition[].transitions` y comparar con `types[transicion].possessions`
- [ ] T-F14 · CA-9: sumar `first_shot.hist[].n` y comparar con las posesiones clasificadas con tiro; recalcular el promedio desde `shots[0].elapsed`
- [ ] T-F15 · CA-10: sumar `finish_in_transition[].possessions + finish_period_end.possessions` == transiciones; localizar una bandeja y un triple de esquina en la inspección y confirmar su categoría
- [ ] T-F16 · CA-11: comparar `dreb_to_transition.drb_possessions` con la cantidad de posesiones de origen `rebote_defensivo` de `GET /api/origins?team=<code>` (A-02)
- [ ] T-F17 · CA-12: elegir un jugador con rebotes defensivos y robos; contar a mano sus transiciones iniciadas en la inspección y compararlas con `players[].initiated`; verificar `Σ initiated ≤ transitions` y la cobertura "N de M"
- [ ] T-F18 · CA-13: confirmar `pass_out.value == null` y `reason == "no_registrado"` y la explicación en pantalla; confirmar `assists_in_transition` en la tabla
- [ ] T-F19 · CA-14: `side=defensa` de A y de B en los mismos partidos: transiciones concedidas por A == transiciones de B contra A; verificar `conceded_per100`
- [ ] T-F20 · CA-15: contar a mano las pérdidas propias completas con posesión rival siguiente en 1 partido y comparar con `own_turnovers_to_transition`
- [ ] T-F21 · CA-16: comparar el numerador del balance con las posesiones rivales de origen `rebote_defensivo` y tipo `transicion` con puntos > 0 y el denominador con los tiros de campo propios fallados (`fga − fgm`)
- [ ] T-F22 · CA-17: `curl -b c.txt "http://localhost:5000/api/metrics/team?id=CNF&ptype=transicion&competition=<id>"`: `context.ignored` sin `ptype` y `possessions_counted` igual a las transiciones
- [ ] T-F23 · CA-18: `GET /api/metrics/ptype?id=CNF:transicion`: todas las claves del conjunto estándar presentes (no aplicables con `reason: "no_aplica"`)
- [ ] T-F24 · CA-19: consulta con `quarter=pr` en una competencia sin prórrogas (o equipo sin transiciones) → `null` con `sin_intentos`, `possessions: 0`, sin `NaN`; equipo sin pbp → 404 `sin_pbp`
- [ ] T-F25 · CA-20: forzar muestra baja con `last=1` y confirmar badge "baja", fila en gris y sin percentil
- [ ] T-F26 · CA-21: en los 2 partidos con prórroga del seed, verificar en la inspección que las posesiones de la prórroga tienen `ptype`
- [ ] T-F27 · CA-22: revisar `reconcile`: partidos con ingesta v2 con `calc`/`official`/`qualifier` y partidos sin ingesta v2 en `games_excluded`; confirmar que ninguna diferencia produce error
- [ ] T-F28 · CA-23: recorrer Equipo → Posesión → Transición en viewport < 768 px, sin scroll horizontal ni errores de consola

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente, reparto 100 %) | T-A3, T-B2, T-F6 |
| CA-2 (CA del cliente, estabilidad) | T-B2, T-F7 |
| CA-3 | T-A3, T-F8 |
| CA-4 | T-A1, T-A6, T-F9 |
| CA-5 | T-A3, T-F10 |
| CA-6 | T-A2, T-A3, T-B2, T-F11 |
| CA-7 | T-B1, T-B2, T-F12 |
| CA-8 | T-B3, T-F13 |
| CA-9 | T-B1, T-B2, T-F14 |
| CA-10 | T-A4, T-B4, T-F15 |
| CA-11 | T-B5, T-F16 |
| CA-12 | T-A5, T-B6, T-F17 |
| CA-13 | T-B6, T-D2, T-F18 |
| CA-14 | T-B7, T-F19 |
| CA-15 | T-B8, T-F20 |
| CA-16 | T-B8, T-F21 |
| CA-17 | T-C2, T-F22 |
| CA-18 | T-C1, T-F23 |
| CA-19 | T-B11, T-C5, T-F24 |
| CA-20 | T-B2, T-D2, T-F25 |
| CA-21 | T-A3, T-F26 |
| CA-22 | T-B10, T-F27 |
| CA-23 | T-D5, T-F28 |

## Dependencias externas
- Competencia del seed (13 partidos) reprocesada con ingesta v2 (F-11): necesaria para `previous_action` (robo → pérdida exacto) y `qualifiers` (validación `fastbreak`) y, con coordenadas reales, para distinguir triple de esquina de frontal. Sin reprocesar, T-F15 solo puede verificar la categoría por subtipo y T-F27 queda en `games_excluded`.
- Módulos de A-01 y A-02 disponibles (`possessions.py` con `register_enricher`, `team_possessions`, `origin` completado), ya cerrados antes en la fase 3.
- Claves `transition.max_secs` y `early_offense.max_secs` declaradas por F-13 (cerrado en fase 1) y usuario administrador para T-F9 (`ADMIN_USERS` o modo abierto).
- `shot_zones.classify_zone` de C-03 (zonas de esquina) y `identity.player_card` de C-08.
- Pestaña `posesion` de X-01 registrada (X-01 cerrado en fase 2).
