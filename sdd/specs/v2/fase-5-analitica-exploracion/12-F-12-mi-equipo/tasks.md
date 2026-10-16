# Tasks — F-12: Mi equipo

> **ID:** F-12 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 12
> **Depende de:** F-03 · F-17 · A-10 · F-13 · X-01
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** `plan.md` de este mismo requisito

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Modelo `Fixture` (tabla `fixtures`, índice por `date`) · `backend/database.py` · cubre RF-7, RF-9 · Done: `python backend/database.py` crea la tabla; correrlo dos veces no da error
- [ ] T-A2 [P] · Activar `alerts.lookback_days` y `alerts.change_z` y agregar `my_team.last_games`, `my_team.top_lineups`, `my_team.max_followed` (PROPUESTA) a `CONFIG_SPEC` · `backend/config.py` · cubre RF-16, RF-17, RF-20..RF-22 · Done: `GET /api/settings` lista las 5 claves en "Preferencias" con sus defaults (7, 1.5, 5, 3, 12)
- [ ] T-A3 [P] · Permitir `home_team` y `followed_players` en el scope `ui` si `prefs.py` tiene lista blanca · `backend/prefs.py` · cubre RF-1, RF-22 · Done: `PUT /api/prefs` con `{scope:"ui", key:"home_team", value:"CNF"}` responde 200 y `GET /api/prefs?scope=ui` lo devuelve

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `today_uy`, `FixtureError`, `validate_fixture` (fecha ISO, hora `HH:MM`, equipos distintos y conocidos, competencia existente, URL FIBA válida) · `backend/fixtures.py` · cubre RF-7 · Done: validar a mano con `app.test_client()` los 6 casos de error del plan §9 devuelve el código y mensaje esperado
- [ ] T-B2 · `list_fixtures`, `get_fixture`, `create_fixture` (con duplicado exacto → 409), `update_fixture`, `delete_fixture`, `fixture_dict` · `backend/fixtures.py` · cubre RF-7 · Done: ciclo crear → listar → editar → borrar sobre la base local deja la tabla vacía
- [ ] T-B3 · `next_fixture(team, today)` (futuro, sin `game_id`, orden fecha+hora; hoy cuenta como próximo) · `backend/fixtures.py` · cubre RF-9, RF-12 · Done: con fixtures de ayer, hoy y mañana para CNF, `next_fixture("CNF", hoy)` devuelve el de hoy; con `today=mañana+1` devuelve `None`
- [ ] T-B4 · `link_game_to_fixture` (±1 día, exactitud de local/visitante, idempotente) y `unlink_games` · `backend/fixtures.py` · cubre RF-11 · Done: cargar un fixture con los equipos y fecha de un partido del seed, reimportar ese partido: queda `game_id` completado; reimportar de nuevo no cambia nada
- [ ] T-B5 · Enganchar `link_game_to_fixture` en `persist_game` y `unlink_games` en `DELETE /api/games` · `backend/ingest.py`, `backend/app.py` · cubre RF-11 · Done: borrar el partido vinculado deja `fixtures.game_id` en NULL
- [ ] T-B6 · Rutas `GET/POST /api/fixtures`, `PATCH/DELETE /api/fixtures/<int:fixture_id>` (`admin_required` en escritura, `bump_data_version("fixtures")`) · `backend/app.py` · cubre RF-7 · Done: con `ADMIN_USERS` definida y un usuario no admin, `POST` responde 403 `requiere_admin`; con admin, 201
- [ ] T-B7 · `phrases.game_plan(reference="rival_proximo")` + `404 sin_proximo_partido` en `GET /api/game-plan` · `backend/phrases.py`, `backend/app.py` · cubre RF-13 · Done: `curl ".../api/game-plan?team=CNF&reference=rival_proximo"` devuelve 200 con el rival del próximo partido, y 404 `sin_proximo_partido` sin calendario
- [ ] T-B8 · Plantillas `cambio_brusco_mejora` y `cambio_brusco_empeora` · `backend/phrases/es.json` · cubre RF-17 · Done: `phrases.render("cambio_brusco_empeora", {...})` produce el texto con valores formateados por el catálogo
- [ ] T-B9 · `competitions.merge_competitions` reasigna `fixtures.competition_id` (PROPUESTA, riesgo R-3) · `backend/competitions.py` · cubre RF-7 · Done: fusionar dos competencias deja sus fixtures bajo la competencia destino
- [ ] T-B10 · `my_team._header`, `alert_window`, `_next_fixture`, `_game_plan` · `backend/my_team.py` · cubre RF-4, RF-5, RF-10, RF-12, RF-15 · Done: llamar a `my_team_payload` desde un script ad hoc devuelve cabecera con récord y `sample`, y `next_fixture` o su razón
- [ ] T-B11 · `sudden_changes` (lista `ALERT_METRICS`, z orientado, mínimos de muestra, ordenar, recortar) · `backend/my_team.py` · cubre RF-17, RF-18 · Done: con `alerts.change_z` bajo se obtienen alertas; con un valor alto, ninguna; una métrica nula en la ventana no aparece
- [ ] T-B12 · `_alerts` (ventana, insights de A-10 con `last = n`, cambios, razón `sin_partidos_en_ventana`) · `backend/my_team.py` · cubre RF-16, RF-19 · Done: equipo sin partidos en la ventana devuelve `reason` y listas vacías
- [ ] T-B13 · `_last_games`, `_top_lineups`, `_followed_players` (ids desde `prefs`, truncado por `max_followed`, `identity.player_card`, jugador no disponible) · `backend/my_team.py` · cubre RF-20..RF-23 · Done: seguir un id inexistente devuelve `available: false` sin error
- [ ] T-B14 · Aislar cada bloque (`blocks_failed`), caché `my_team` con claves versionadas y preferencias fuera del memo · `backend/my_team.py` · cubre RF-25 · Done: forzar una excepción en `_alerts` deja los otros bloques con datos y `blocks_failed.alerts` completo
- [ ] T-B15 · Ruta `GET /api/my-team` (fallback a `ui.home_team`, `today`, 404/400, `reason: sin_equipo_fijado`) · `backend/app.py` · cubre RF-3, RF-4, RF-6 · Done: sin preferencia ni `team` responde `{"team": null, "reason": "sin_equipo_fijado"}`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.myTeam`, `api.fixtures`, `api.createFixture`, `api.updateFixture`, `api.deleteFixture` · `frontend/js/api.js` · cubre RF-3..RF-14 · Done: desde la consola del navegador `await api.myTeam({})` devuelve el payload; ningún `fetch` fuera de `api.js`

### Grupo D — Frontend: UI
- [ ] T-D1 · `components/my-team-controls.js`: `homeTeamButton` y `followButton` (prefs optimistas, límite, toast de error) · cubre RF-1, RF-2, RF-22 · Done: el botón alterna su texto y el valor queda en `GET /api/prefs?scope=ui` tras recargar
- [ ] T-D2 · `views/mi-equipo.js`: selector sin equipo, cabecera, carga por bloques con skeleton y error con "Reintentar" · cubre RF-4, RF-5, RF-6, RF-25 · Done: `#/mi-equipo` con equipo fijado muestra la cabecera sin parámetros en la URL
- [ ] T-D3 · Bloque Próximo partido y botón "Preparar partido" (estados vacíos de §6) · `views/mi-equipo.js` · cubre RF-10, RF-12, RF-14 · Done: el botón abre `#/partido/preparar?team=…&rival=…&fixture=…` con ambos equipos elegidos
- [ ] T-D4 · Bloque Plan de juego con `collapsible` (`panelId: "mi-equipo.plan"`) y `game-plan.js` (referencia por defecto; `rival_proximo` solo si `next_available`) · `views/mi-equipo.js`, `components/game-plan.js` · cubre RF-15, RF-13 · Done: plegar el panel, recargar y ver que sigue plegado
- [ ] T-D5 · Bloque Alertas (insights, cambios bruscos con valores y badge, estado sin partidos) · `views/mi-equipo.js` · cubre RF-16..RF-19, RF-24 · Done: cada cambio brusco muestra valor semana, valor resto, diferencia y partidos de cada lado
- [ ] T-D6 · Bloque Accesos directos: últimos partidos, quintetos más usados, jugadores seguidos (carrusel en móvil, selector para seguir, "Dejar de seguir") · `views/mi-equipo.js` · cubre RF-20..RF-23 · Done: seguir y dejar de seguir un jugador actualiza S8 sin recargar
- [ ] T-D7 [P] · Pestaña `calendario` en S1: tabla, filtros, acciones Preparar/Importar, formulario solo admin · `components/fixtures-manager.js`, `views/datos.js` · cubre RF-7, RF-8, RF-14 · Done: un admin agrega un partido y aparece en la tabla; un no admin no ve los controles
- [ ] T-D8 [P] · Botón "Fijar como mi equipo" en la cabecera de Equipo y "Seguir" en la de Jugador · `views/equipo.js`, `views/jugador.js` · cubre RF-2, RF-22 · Done: ambos botones aparecen y funcionan
- [ ] T-D9 · `initialSection()` con equipo fijado → `mi-equipo`; habilitar S8; esperar `loadPrefs("ui")` antes de resolver · `core/router.js`, `app.js` · cubre RF-3 · Done: abrir la app sin hash con equipo fijado aterriza en `#/mi-equipo`; con hash explícito, lo respeta
- [ ] T-D10 [P] · Estilos de S8 y del calendario (`/* ── mi-equipo (F-12) ── */`), mobile 768 px · `css/style.css` · cubre RF-26 · Done: a 360 px no hay scroll horizontal de página

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados vacío/error/offline con el copy literal del spec §6 en todos los bloques · `views/mi-equipo.js`, `fixtures-manager.js` · cubre RF-6, RF-12, RF-19, RF-25 · Done: cada estado de la tabla §6 del spec se ve al forzarlo
- [ ] T-E2 [P] · `sw.js`: componentes nuevos a `STATIC` y bump de `CACHE` (solo si X-01 no migró a runtime caching) · `frontend/sw.js` · Done: offline, la cáscara de S8 carga y muestra "Sin conexión: Mi equipo necesita conexión."

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `python backend/database.py` corre 2 veces seguidas sin error (la tabla `fixtures` se crea una sola vez)
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o `app.test_client()` (con `-b/-c` para la sesión): `GET /api/my-team` (con y sin preferencia, con `today`), `GET/POST/PATCH/DELETE /api/fixtures`, `GET /api/game-plan?reference=rival_proximo`, `DELETE /api/games`; verificar shape contra `plan.md` §3
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer S8, el calendario, "Fijar como mi equipo" y "Seguir"
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md`
- [ ] T-F6 · CA-1 (CA del cliente): fijar el equipo, cerrar sesión, abrir la app en ventana privada con la misma cuenta y confirmar que abre en `#/mi-equipo`, URL sin query, sin chips ni selects de filtro modificados
- [ ] T-F7 · CA-2: con dos cuentas de `AUTH_USERS`, fijar CNF con una y PEN con la otra; recargar cada una y comprobar el equipo propio; revisar `user_prefs` (dueños distintos)
- [ ] T-F8 · CA-3 y CA-4: sin preferencia abre Datos/Liga y S8 muestra el selector; con preferencia, abrir `#/liga/ranking` directamente no redirige
- [ ] T-F9 · CA-5, CA-6, CA-7: cargar fixtures de ayer/hoy/mañana con un admin y verificar el próximo partido, "Preparar partido" y los estados vacíos; repetir con `?today=` en el curl para fijar el día
- [ ] T-F10 · CA-8: importar (o reimportar) un partido del seed cuyo cruce y fecha coincidan con un fixture y verificar `game_id`; borrar el partido y verificar el desvínculo
- [ ] T-F11 · CA-9: con `ADMIN_USERS=<otro usuario>` verificar 403 `requiere_admin` y controles ocultos; con el admin, 201/200
- [ ] T-F12 · CA-10: comparar `GET /api/game-plan` (`reference=competencia` y `rival_proximo`) con el panel de S8 y el de la sección Equipo; sin calendario, la referencia no se ofrece y la API devuelve 404 `sin_proximo_partido`
- [ ] T-F13 · CA-11 y CA-12: con fixtures y partidos dentro de la ventana (usar `?today=` cercano a la fecha de partidos del seed), comparar insights con `GET /api/insights?entity=team&id=…&last=<n>` y recalcular a mano un cambio brusco con los valores por partido (`/api/team/<code>`); cambiar `alerts.change_z` y `alerts.lookback_days` en Configuración y recargar
- [ ] T-F14 · CA-13 y CA-14: `today` sin partidos en la ventana → mensaje; ventana de 1–2 partidos → badge "baja"; una métrica nula (equipo sin pérdidas en la ventana, o inyectar un caso con `ast_to` nulo) no genera alerta
- [ ] T-F15 · CA-15 y CA-16: comparar los quintetos de S8 con `GET /api/table/team_lineups` ordenada por minutos y los últimos partidos con el game log del equipo
- [ ] T-F16 · CA-17 y CA-18: seguir/dejar de seguir, superar `my_team.max_followed`, seguir un id fusionado (C-08) o inexistente
- [ ] T-F17 · CA-19: forzar un error en un bloque (excepción temporal) y confirmar que el resto se ve y "Reintentar" funciona
- [ ] T-F18 · CA-20 y CA-21: equipo con menos de `sample.team.min` partidos → badge "baja", sin colores; 360 px de ancho sin scroll horizontal y "Mi equipo" primero en la barra
- [ ] T-F19 · CA-22: `curl` sin cookie a `GET /api/my-team` con `AUTH_USERS` → 401; sin `AUTH_USERS` → 200 y `user_prefs.owner = '_open'`
- [ ] T-F20 · Medir `GET /api/my-team` en caliente (objetivo < 1,5 s) y registrar el tiempo en `progress.md`

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-A3, T-B15, T-D1, T-D2, T-D9, T-F6 |
| CA-2 | T-A3, T-D1, T-F7 |
| CA-3 | T-D2, T-D9, T-F8 |
| CA-4 | T-D9, T-F8 |
| CA-5 | T-B3, T-B10, T-D3, T-F9 |
| CA-6 | T-B3, T-B10, T-D3, T-E1, T-F9 |
| CA-7 | T-B3, T-F9 |
| CA-8 | T-B4, T-B5, T-F10 |
| CA-9 | T-B6, T-D7, T-F11 |
| CA-10 | T-B7, T-D4, T-F12 |
| CA-11 | T-B11, T-B12, T-D5, T-F13 |
| CA-12 | T-A2, T-B11, T-B12, T-F13 |
| CA-13 | T-B12, T-D5, T-E1, T-F14 |
| CA-14 | T-B11, T-D5, T-F14 |
| CA-15 | T-B13, T-D6, T-F15 |
| CA-16 | T-B13, T-D6, T-F15 |
| CA-17 | T-A2, T-D1, T-D6, T-F16 |
| CA-18 | T-B13, T-D6, T-F16 |
| CA-19 | T-B14, T-D2, T-E1, T-F17 |
| CA-20 | T-B10, T-D2, T-F18 |
| CA-21 | T-D10, T-F18 |
| CA-22 | T-B15, T-F19 |

## Dependencias externas
- **Fase 1 cerrada y X-01 integrada**: `auth.admin_required` y `cache.py` (F-11), `config.py`/`prefs.py`/`core/prefs.js` (F-13), `identity.py` (C-08), `population.py`/`sample.py`/`metrics_catalog.py` (T-01/T-02/T-05), registro de secciones y pestañas (X-01).
- **F-17 y A-10** deben exponer `phrases.game_plan`, `components/game-plan.js` e `insights.insights` antes de T-B7, T-B12 y T-D4; **F-06** debe exponer `lineups.all_lineups` antes de T-B13; **F-03** debe tener `views/partido.js` con el modo `preparar` antes de T-D3; **F-07** para el enlace a Analizar.
- **Dataset de verificación**: los 13 partidos del seed reimportados con la ingesta v2 (reproceso); dos cuentas en `AUTH_USERS` (una listada en `ADMIN_USERS`); fixtures de prueba cargados a mano (un cruce que coincida con un partido del seed para CA-8); para CA-11/CA-14 usar `?today=` fijado a pocos días de las fechas de los partidos del seed.
- **Variables de entorno**: `AUTH_USERS` y `ADMIN_USERS` (ya existentes) para CA-2 y CA-9; ninguna variable nueva.
