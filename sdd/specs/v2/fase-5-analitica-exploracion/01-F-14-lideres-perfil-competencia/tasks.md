# Tasks — F-14: Líderes y perfil de competencia

> **ID:** F-14 · **Prioridad:** P2 · **Fase y orden:** 5·01
> **Depende de:** T-01, A-02, F-13, T-04 (y T-05, T-02, T-06, X-01, C-02) · **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** Especificación v2 §4 · F-14 · Arquitectura §3.6, §4, §6 · [plan.md](plan.md) · [spec.md](spec.md)

## Orden de ejecución

### Grupo A — Backend: configuración (sin cambios de esquema)
- [ ] T-A1 · Pasar `leaders.min_minutes` (int, 60, 0–2000) y `leaders.top_n` (int, 10, 3–50) de `reservada` a `activa` en `CONFIG_SPEC` (sección Preferencias) · `backend/config.py` (F-13) · cubre RF-16 · Done: `curl -b cookies.txt http://localhost:5000/api/settings` lista ambas claves como activas con su default y rango; `PUT /api/settings {"values":{"leaders.top_n":2}}` → 400 (fuera de rango)
- (Sin modelos ni `upgrade_db()`: F-14 no cambia el esquema.)

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Verificar las extensiones de T-01 que F-14 necesita y agregarlas si faltan: kwarg `base` en `population()`/`league_reference()`/`full_ranking()`, campos `team_code` y `reasons` en miembros de tipo `player`, `member_bundles(pop)` · `backend/population.py` (T-01) · cubre RF-7, RF-12, RF-13 · Done: en `python -c` con app context, `population.population("player", <comp>, ctx, base="partido").members[0]` trae `id, name, team_code, values, reasons, sample, in_population`
- [ ] T-B2 · Constantes `LEADER_DEFAULT_METRICS` y `PROFILE_SECTIONS`, `ProfileError` y `effective_min_minutes(requested)` · `backend/competition_profile.py` (NUEVO) · cubre RF-3, RF-16 · Done: con `leaders.min_minutes=60` y `sample.player.min=60`, `effective_min_minutes(10)` → `{"requested": 10, "effective": 60, "raised": True}`; `effective_min_minutes(None)` → `requested == 60`
- [ ] T-B3 · `_leaders_core` (población de T-01 con `in_population`, elegibles por minutos, valores nulos excluidos con conteo, orden por dirección con desempate alfabético, puestos "1224" con `tied`, `avg` y `leader` de T-01) · `backend/competition_profile.py` · cubre RF-4, RF-5, RF-6, RF-7 · Done: con `sample.team.min`/datos del seed, para `ast` el primer puesto == `population.full_ranking("player", "ast", comp, ctx, None)["rows"][0]` y para `tov` (lower) el primer puesto es el menor valor
- [ ] T-B4 · `leaders(...)`, `leaders_payload(...)` y `leaders_cards(...)` (percentil y `population_rank` con `population.percentile`/`rank`, `cut_tied`, `top_n` de config) · `backend/competition_profile.py` · cubre RF-1, RF-2, RF-4, RF-7 · Done: `leaders_cards` devuelve una tarjeta por cada clave de `LEADER_DEFAULT_METRICS` y cada `percentile` == el de la ficha (`GET /api/metrics/player`) del mismo jugador
- [ ] T-B5 · `profile(comp, ctx, entity_type, base)` para `referencia`, `ritmo` y `reparto_tiro` (`avg` de `league_reference`, `n`, líder de `full_ranking`, razones de población insuficiente) · `backend/competition_profile.py` · cubre RF-8, RF-9, RF-10, RF-12, RF-14 · Done: para cada clave, `avg` == `GET /api/rankings/team/<clave>?competition=<id>` `avg`; con `population.min_size` alto, todas las filas `avg: null`, razón `poblacion_insuficiente`
- [ ] T-B6 · Bloque `ppp_origen` (población `origin` agrupada por origen, posesiones y pesos como cociente de totales, PPP como media de equipos, `available: false` si falta A-02/pbp) · `backend/competition_profile.py` · cubre RF-11, RF-12 · Done: Σ `possessions` de los siete orígenes == `classified_possessions` y Σ `share` == 1,0; cada `ppp.value` == media de los `ppp` de los equipos en la ficha de A-02 (`GET /api/metrics/origin?id=<TEAM>:<origen>`)
- [ ] T-B7 · `leaders_table_rows(req)` y `tables.register_table("leaders", …)` (columnas por defecto, `required_params=("metric",)`, orden por dirección, `bulk_scopes=("competition",)`) · `backend/competition_profile.py` · cubre RF-2, RF-15 · Done: `curl -b cookies.txt "http://localhost:5000/api/table/leaders?metric=pts&competition=1"` devuelve una fila por jugador elegible, `totals` con `no_aplica` y `competition_avg` == `avg` de la ficha
- [ ] T-B8 · Rutas finas `GET /api/leaders` y `GET /api/competition-profile` con validaciones (competencia concreta, `metric`, `min_minutes` 0–2000, `top` 3–50, `base`, `entity`) y errores §7.8; `import competition_profile` · `backend/app.py` · cubre RF-1, RF-8, RF-13, RF-14 · Done: `curl -b cookies.txt "http://localhost:5000/api/leaders?competition=1&metric=ast"` → 200 con `rows`; sin `competition` → 400 "Elegí una competencia para ver líderes y perfil."; `metric=foo` → 400

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.leaders(params)` y `api.competitionProfile(params)` · `frontend/js/api.js` · cubre RF-1, RF-8 · Done: desde la consola del navegador `await api.leaders({competition: 1})` devuelve `cards` y `await api.competitionProfile({competition: 1})` devuelve `sections`

### Grupo D — Frontend: UI
- [ ] T-D1 · `renderLeadersPanel`: controles (métrica agrupada con `groupsFor("player")`, mínimo de minutos), tarjetas con puesto/empate, jugador (enlace a S4), equipo, valor, badge, "Ver todos"; modo métrica con cabecera (líder, promedio, aviso de mínimo aplicado) y `createDataTable` con la tabla `leaders` · `frontend/js/components/leaders-panel.js` (NUEVO) · cubre RF-1…RF-6, RF-15, RF-17 · Done: la pestaña muestra 12 tarjetas con 10 filas cada una; al elegir una métrica aparece la tabla completa ordenable y exportable
- [ ] T-D2 · `renderProfilePanel`: pills Equipos/Jugadores, bloques con Ø, mejor, N, ranking inline al hacer clic, bloque PPP por origen con total y pesos, `exportMenu` con `tableToData` · `frontend/js/components/profile-panel.js` (NUEVO) · cubre RF-8…RF-12, RF-15 · Done: el bloque "Promedios de referencia" lista las 11 métricas de equipo y el clic en una fila despliega el ranking de T-01
- [ ] T-D3 · Habilitar y renderizar las pestañas `lideres` y `perfil`; recordar `metric`, `min_minutes` y `entity` en la query · `frontend/js/views/liga.js` (X-01) · cubre RF-17 · Done: `#/liga/lideres?competition=1&metric=ast&min_minutes=120` reproduce la vista al abrirse en una pestaña nueva
- [ ] T-D4 [P] · Estilos `.leaders-card`, `.leaders-controls`, `.profile-block`, `.profile-rank-inline` (sección comentada) · `frontend/css/style.css` · cubre RF-1, RF-8 · Done: en 360 px las tarjetas se apilan sin scroll horizontal de página

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados de ambos paneles: loading, vacío ("Ningún jugador alcanza el mínimo…", "Población insuficiente para calcular referencias."), error con "Reintentar", sin conexión, sin competencia concreta · `frontend/js/components/leaders-panel.js`, `profile-panel.js`, `views/liga.js` · cubre RF-14 · Done: con "Todas" elegido se ve "Elegí una competencia para ver líderes y perfil."; con el backend detenido se ve el mensaje de sin conexión
- [ ] T-E2 · Si X-01 no pasó a runtime caching: `leaders-panel.js` y `profile-panel.js` a `STATIC` y `CACHE` +1 · `frontend/sw.js` · cubre RF-1 · Done: tras recargar, DevTools → Application → Cache Storage incluye los módulos (o queda "no aplica" por runtime caching)

### Grupo F — Verificación de feature
Dataset: 13 partidos del seed (competencia 1). Preparación: `PUT /api/settings {"values":{"sample.team.min":2}}` para que haya población de equipos (14 equipos con 2 partidos); la población de jugadores (≥ 60 min) tiene 32 jugadores. Restaurar con `POST /api/settings/reset` al terminar.
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` idempotente: no aplica (sin cambios de esquema); igualmente `python backend/database.py` corre 2 veces sin error
- [ ] T-F3 · Endpoints probados con curl (`-b cookies.txt`): `…/api/leaders?competition=1`, `…/api/leaders?competition=1&metric=ast&min_minutes=120&top=5`, `…/api/leaders?competition=1&metric=tov`, `…/api/competition-profile?competition=1`, `…/api/competition-profile?competition=1&entity=player`, `…/api/table/leaders?metric=pts&competition=1`; shapes verificados contra plan §3
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Liga (tabla, ranking, mapa, líderes, perfil)
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`
- [ ] T-F6 · CA-1 (cliente): script ad hoc con `app.test_client()`: para cada fila de `referencia`, `ritmo` y `reparto_tiro` (equipos y jugadores) comparar `avg` con `GET /api/rankings/<entity>/<clave>?competition=1` y con `metrics.<clave>.avg` de `GET /api/metrics/<entity>?id=<cualquiera>`; para cada origen comparar `ppp.value` con la media de los `ppp` de las fichas `GET /api/metrics/origin?id=<TEAM>:<origen>`; registrar la salida en `progress.md`
- [ ] T-F7 · CA-2: para 5 métricas, `rows[0]` de `/api/leaders` == `leader` de la ficha de un jugador cualquiera y `avg` igual; en pantalla, la tarjeta coincide con el hover del ranking de la ficha
- [ ] T-F8 · CA-3: `PUT /api/settings {"values":{"leaders.min_minutes":120}}` → todas las filas con `minutes ≥ 120`; `…&min_minutes=10` → `min_minutes.effective == 60` y `raised: true`, y el aviso visible en pantalla
- [ ] T-F9 · CA-4: `…&metric=tov` (primer puesto = valor más bajo), `…&metric=to_pct`, `…&metric=uso_pct` (mayor a menor, rótulo "Mayor valor")
- [ ] T-F10 · CA-5: con `…&metric=blk` (valores enteros repetidos) verificar filas empatadas con `tied: true`, mismo `rank` y salto en el siguiente; en pantalla "3.º ="
- [ ] T-F11 · CA-6: `…&metric=pts&base=total` vs `base=partido` (con T-04 también `por40`, `por100`): valores y orden según la base y eco `base`; `…&metric=ts_pct` idéntico en todas las bases
- [ ] T-F12 · CA-7: `…&last=1` en líderes y perfil: `context.label` "Últimos 1" y `population`/`avg` distintos de los de "todos"
- [ ] T-F13 · CA-8: `curl -i …/api/leaders` sin `competition` y con `competition=all` → 400 con el mensaje; la UI con "Todas" muestra "Elegí una competencia para ver líderes y perfil."
- [ ] T-F14 · CA-9: con `sample.team.min=5` (ningún equipo califica) el perfil de equipos responde `avg: null` con `poblacion_insuficiente` y la UI "Población insuficiente para calcular referencias."
- [ ] T-F15 · CA-10: Σ posesiones de los siete orígenes == `classified_possessions` (y == posesiones clasificadas de la competencia en A-02) y Σ `share` == 1; cada PPP == media por equipo de A-02
- [ ] T-F16 · CA-11: en una copia de la base con `blk_received` en `NULL` (si T-05 ya lo usa) o con una métrica nula en algún jugador: ese jugador no aparece, `excluded_null.count > 0` y la razón es `no_registrado`
- [ ] T-F17 · CA-12: un jugador con < 60 minutos (SQL sobre `player_game_stats`) no aparece en ninguna lista con `min_minutes=0`
- [ ] T-F18 · CA-13: exportar la tabla `leaders` en CSV, XLSX, PNG y PDF; cabecera con competencia, mínimo aplicado, base y fecha; filas, orden y columnas iguales a pantalla
- [ ] T-F19 · CA-14: `PUT /api/settings {"values":{"leaders.top_n":5,"leaders.min_minutes":90}}` y recargar Líderes: tarjetas de 5 filas y mínimo 90 sin reiniciar; restaurar con `POST /api/settings/reset`
- [ ] T-F20 · CA-15: emulación de 360 px en Líderes y Perfil: sin scroll horizontal de página, tarjetas apiladas, consola sin errores
- [ ] T-F21 · CA-16: abrir `#/liga/lideres?competition=1&metric=ast&min_minutes=120` en una pestaña nueva y comprobar métrica y mínimo

### Grupo G — (diferido)
- (Sin incrementos diferidos: todas las dependencias son de fases anteriores a la 5. Mejoras futuras no comprometidas: filtro de líderes por grupo G/F/C con los grupos de C-08 y `leaders.min_attempts`, ver spec §8 y D-4.)

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B1, T-B5, T-B6, T-D2, T-F6 |
| CA-2 | T-B3, T-B4, T-D1, T-F7 |
| CA-3 | T-A1, T-B2, T-B3, T-F8 |
| CA-4 | T-B3, T-D1, T-F9 |
| CA-5 | T-B3, T-D1, T-F10 |
| CA-6 | T-B1, T-B4, T-B8, T-F11 |
| CA-7 | T-B1, T-B8, T-F12 |
| CA-8 | T-B8, T-E1, T-F13 |
| CA-9 | T-B5, T-E1, T-F14 |
| CA-10 | T-B6, T-F15 |
| CA-11 | T-B3, T-F16 |
| CA-12 | T-B3, T-F17 |
| CA-13 | T-B7, T-D1, T-F18 |
| CA-14 | T-A1, T-B2, T-F19 |
| CA-15 | T-D4, T-E1, T-F20 |
| CA-16 | T-D3, T-F21 |

## Dependencias externas
- T-01 (`population`, `GET /api/rankings`, fichas), T-05 (catálogo y claves estándar), T-02, T-06 (`tables.register_table`, `createDataTable`, `exportMenu`), F-13 (`config.get`, `PUT /api/settings`, claves `leaders.*` declaradas), T-04 (`parse_base`, bases), X-01 (`views/liga.js` con las pestañas registradas), A-02 (tipo `origin`) y C-02 (`context.parse_context`) cerrados.
- Datos: los 13 partidos del seed reprocesados con la ingesta vigente. Para el perfil de equipos hay que bajar `sample.team.min` a 2 (ver Preparación del Grupo F) o importar más partidos; para el PPP por origen, los partidos con play-by-play (13/13 en el seed).
- Variables de entorno: ninguna nueva (con `AUTH_USERS` definido, el cambio de configuración exige un usuario admin).
