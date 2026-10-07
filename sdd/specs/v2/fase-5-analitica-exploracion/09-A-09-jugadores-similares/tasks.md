# Tasks — A-09: Jugadores similares

> **ID:** A-09 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 09
> **Depende de:** T-05, T-01, C-03, C-08 (y T-02, F-13, X-01, T-06, F-03 consumidos; ver [plan.md](plan.md) §10)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Configuración (sin cambios de esquema)
- [ ] T-A1 · Activar `similar.top_n` en `CONFIG_SPEC` (`status: activa`, consumidor A-09) · `backend/config.py` · cubre RF-16 · Done: `GET /api/settings` la lista como activa con default 10 y rango 3–50; `config.get("similar.top_n")` devuelve `10`.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Crear `backend/similarity.py` con `DIMENSIONS`, constantes (`MIN_DIMENSIONS = 6`, `ZONE_COVERAGE_MIN = 0.90`), `SimilarityError` (`code`, `message`, `status`), `_member` y `_position_groups` (filas de `player_game_stats` por `player_id` + `identity.resolve_identity` + `identity.position_group`) · `backend/similarity.py` · cubre RF-2, RF-6 · Done: `python -c` con `app.app_context()`: `_position_groups([<id>])` devuelve `{id: ("PG", "G")}` para un jugador del seed.
- [ ] T-B2 · `_zone_vectors(comp_id)`: consulta de `shots` + `player_id`, cobertura de coordenadas, modo `"11"`/`"3"`, reparto por zona con `shot_zones.zone_table`, cache `similar:zones` · `backend/similarity.py` · cubre RF-3, RF-7 · Done: para la competencia del seed reprocesado devuelve `mode == "11"` y, por jugador, 11 proporciones que suman 1,0 (±0,0001); con `court_x` anulado en una copia de la base devuelve `mode == "3"`.
- [ ] T-B3 · Perfil crudo por miembro de la población (USO%, OR%, DR%, AS%, TO%, PPT, FT Rate, `min_pg` = minutos/partidos, zonas), media y desvío por dimensión/componente sobre `in_population`, z por miembro, dimensiones inactivas (< `population.min_size` valores o desvío 0) · `backend/similarity.py` · cubre RF-2, RF-3, RF-4, RF-7 · Done: script ad hoc imprime media y desvío de las nueve dimensiones de la competencia del seed y coinciden con un cálculo independiente sobre `GET /api/metrics/player` (tolerancia 1e-4); un jugador con `games = 0` tiene `min_pg` nulo (no 0).
- [ ] T-B4 · Distancia y similitud (`_pair_distance`: dimensiones comparables, `n ≥ 6`, raíz del promedio de diferencias estandarizadas, zonas como una dimensión; `similitud = round(100/(1+d))`) · `backend/similarity.py` · cubre RF-5, RF-7 · Done: `_pair_distance(a, a) == 0` con similitud 100; `_pair_distance(a, b) == _pair_distance(b, a)`; con perfiles sintéticos con 4 dimensiones nulas devuelve `None` (`perfil_incompleto`).
- [ ] T-B5 · `similar_payload`: validaciones (`min_minutes ≥ sample.player.min`, `top_n` 3–50, `position`/`mismo`), filtros (minutos, grupo de posición, `team_code`), exclusión de baja muestra y de la propia referencia, orden `(distance, nombre)`, `closest`/`furthest`, `excluded`, `population`, `method`, `reason`, `reference` con `in_population` y `sample` · `backend/similarity.py` · cubre RF-1, RF-4, RF-5, RF-6, RF-8, RF-9, RF-10, RF-13, RF-14 · Done: para un jugador del seed devuelve ≤ `top_n` resultados distintos, sin la referencia, ordenados por distancia ascendente, cada uno con las nueve dimensiones y `closest` de 3 claves y `furthest` de 2.
- [ ] T-B6 · Wrapper `similar_players(...)` con la firma de la arquitectura (+ `team_code`) y `cache.memo("similar", …)` con `data_version`/`config_version` en la clave · `backend/similarity.py` · cubre RF-1, RF-16 · Done: dos llamadas idénticas seguidas devuelven el mismo objeto y cambiar `similar.top_n` vía `PUT /api/settings` cambia la cantidad en la siguiente respuesta sin reiniciar.
- [ ] T-B7 · Ruta fina `GET /api/similar/<int:player_id>` (resolución de competencia, `competition=all` → 400, errores §7.8, 404 con `identity.player_card`) · `backend/app.py` · cubre RF-1, RF-6, RF-14 · Done: `curl` con `player_id` válido → 200 con el shape del plan §3.2; `competition=all` → 400; `position=Z` → 400; `/api/similar/999999` → 404 `no_encontrado`.
- [ ] T-B8 · `profile_suggestions(team_code, rival_code, comp_id, ctx, *, threats, top_n=3)` · `backend/similarity.py` · cubre RF-15 · Done: con `threats` = top USO% de un rival del seed devuelve `estimate: true` y, por amenaza, hasta 3 candidatos del equipo propio con `similarity`, `minutes_per_game` y `uso_pct`; una amenaza sin perfil suficiente trae `candidates: []` y `reason`.
- [ ] T-B9 · Conectar `suggestions_profile` en el informe de F-03 (llamada dentro de `try/except`) · `backend/prepare.py` · cubre RF-15 · Done: `GET /api/prepare?team=<A>&rival=<B>` devuelve `suggestions_profile` no nulo con `estimate: true`; si `similarity` falla (simulado), el informe sigue respondiendo 200 con `suggestions_profile: null`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.similar(playerId, params)` con `qs()` · `frontend/js/api.js` · cubre RF-1, RF-11 · Done: desde la consola `await api.similar(<id>, {})` resuelve con `results`.

### Grupo D — Frontend: UI
- [ ] T-D1 · `renderSimilarPlayers`: tarjeta de referencia (con aviso de muestra baja), filtros con debounce, método, tabla con barra de similitud y "Se parecen en / Difieren en", estados loading/vacío/error/offline · `frontend/js/components/similar-players.js` · cubre RF-6, RF-9, RF-10, RF-18 · Done: con un payload de prueba se ven filtros, método y 10 filas ordenadas; un `reference.in_population = false` muestra el aviso.
- [ ] T-D2 · Fila expandible con las nueve dimensiones (valor referencia, valor jugador, diferencia en z; zonas como top 3 con la constante de copy) y exportación con `exportMenu` (`getData` con meta, columnas y filas) · `frontend/js/components/similar-players.js` · cubre RF-9, RF-12 · Done: al expandir una fila aparecen las nueve dimensiones; el menú ofrece CSV, XLSX, PNG y PDF.
- [ ] T-D3 · Habilitar y renderizar la pestaña `similares` de S4 con filtros en la query de la ruta y `competition` del contexto; contador de pedido · `frontend/js/views/jugador.js` · cubre RF-11 · Done: `#/jugador/<id>/similares` muestra los parecidos; cambiar el filtro de posición actualiza la query (`?position=G`) y recargar reproduce la vista.
- [ ] T-D4 · Habilitar la pestaña `similares` de S7 con `renderSimilarPicker` y `?player=`; agregar a la tabla del buscador la columna/botón "Similares" (con `stopPropagation`) · `frontend/js/views/explorar.js`, `frontend/js/components/similar-players.js` · cubre RF-11 · Done: desde una fila del buscador, "Similares" abre `#/explorar/similares?player=<id>`; tocar el nombre de la fila sigue abriendo el perfil.
- [ ] T-D5 · CSS de `/* ── similar-players (A-09) ── */` con tabla, barra, fila expandida y modo móvil · `frontend/css/style.css` · cubre RF-9 · Done: en 375 px sin scroll horizontal de la página (`document.documentElement.scrollWidth <= innerWidth`) y filtros apilados.
- [ ] T-D6 · Bloque "Perfil parecido en tu plantel — estimación" en el informe de F-03 (oculto con `null`/sin filas; aviso "No es marcaje individual"; incluido en la exportación) · `frontend/js/components/prepare-report.js` · cubre RF-15 · Done: con el informe de un rival del seed aparece el bloque con el aviso; con `suggestions_profile: null` no hay ningún nodo visible.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Mensajes de error/offline del plan §9 y copy de estados del spec §6 · `frontend/js/components/similar-players.js`, vistas · cubre RF-6, RF-14 · Done: con la red cortada (DevTools Offline) y resultados previos se ve "Sin conexión: se muestran los últimos resultados cargados"; un jugador sin minutos muestra "Este jugador no tiene minutos en esta competencia.".
- [ ] T-E2 · `sw.js`: subir `CACHE` al siguiente entero (y `STATIC` si X-01 no pasó a runtime caching) · `frontend/sw.js` · cubre §9 · Done: DevTools → Application muestra la caché nueva con el módulo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · No toca esquema: `python backend/database.py` corre dos veces seguidas sin error.
- [ ] T-F3 · Endpoint probado con curl (sesión: `curl -c c.txt -X POST … /api/login`): `curl -b c.txt "http://localhost:5000/api/similar/<player_id>"`, `…?position=G`, `…?position=mismo`, `…?min_minutes=200`, `…?top_n=5`, `…&competition=<id>`; shape de plan §3.2 verificado.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer S4 › Similares, S7 › Similares (con y sin jugador elegido), la acción del buscador y el bloque del informe de F-03.
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`.
- [ ] T-F6 · CA-2: para 3 jugadores del seed, contar resultados (= `similar.top_n` o menos), comprobar que la referencia no figura, que no hay repetidos y que el orden es por `distance` ascendente (a igual distancia, por nombre).
- [ ] T-F7 · CA-3: script ad hoc (`python -c`, `app.app_context()`) que, para 2 referencias y todos sus resultados, recalcula z-scores y distancia desde `population.population("player", …)` independiente (media y desvío propios), compara con `distance` y `similarity` (tolerancia 1e-4) e imprime el recuento de resultados verificados y de discrepancias (debe ser 0); registrar en `progress.md` un resultado calculado a mano (dimensión por dimensión) para un caso.
- [ ] T-F8 · CA-4: `position=G` → todos `position_group == "G"`; `position=mismo` → mismo grupo que la referencia (y 400 con una referencia sin posición, forzada en una copia de la base); `min_minutes=200` → todos con ≥ 200 minutos; `min_minutes=10` (menor que 60) → 400.
- [ ] T-F9 · CA-5: con perfiles sintéticos en `python -c` (dimensiones `ppt`, `ft_rate`, `zonas` nulas) verificar que `_pair_distance` no imputa y que con menos de 6 dimensiones devuelve `None`; con un jugador real sin tiros (o una copia de la base con un jugador sin FGA) verificar `profile[*].value == null` con razón y `excluded.perfil_incompleto` incrementado.
- [ ] T-F10 · CA-6: ningún resultado con `minutes < sample.player.min`; un jugador de referencia con menos minutos que el umbral devuelve 200 con `reference.in_population == false` y la pantalla muestra el aviso.
- [ ] T-F11 · CA-7: para dos jugadores A y B, `_pair_distance(A, B) == _pair_distance(B, A)`; un jugador clonado (perfil idéntico, en una copia de la base o con perfil sintético) tiene distancia 0 y similitud 100.
- [ ] T-F12 · CA-8: con coordenadas completas `population.zone_mode == "11"`; en una copia de la base con `UPDATE shots SET court_x = NULL, court_y = NULL` para más del 10 % de los tiros → `"3"`, y la leyenda de la pantalla lo informa.
- [ ] T-F13 · CA-9: abrir `#/jugador/<id>/similares` y, desde el buscador de S7, "Similares" en una fila → `#/explorar/similares?player=<id>` con los mismos resultados; recargar (F5) reproduce la vista.
- [ ] T-F14 · CA-10: exportar los resultados a CSV, XLSX, PNG y PDF; abrir el CSV/XLSX y verificar referencia, competencia, filtros y una fila por resultado con las nueve dimensiones.
- [ ] T-F15 · CA-11: `curl` con `/api/similar/999999`, `competition=999`, `position=Z`, `top_n=2` y `top_n=99` → 404 / 400 `competencia_inexistente` / 400 / 400 / 400 con los mensajes del plan §3.2.
- [ ] T-F16 · CA-12: generar el informe de F-03 de un equipo contra un rival con jugadores de alto USO% → `suggestions_profile.estimate == true` con hasta 3 candidatos por amenaza, `similarity`, `minutes_per_game` y `uso_pct`; la pantalla muestra "estimación" y "No es marcaje individual"; una amenaza sin perfil muestra su razón.
- [ ] T-F17 · CA-13: `PUT /api/settings {"values": {"similar.top_n": 5}}` → 5 resultados; restablecer con `POST /api/settings/reset {"keys": ["similar.top_n"]}` → 10.
- [ ] T-F18 · CA-1 (CA del cliente) — **protocolo de validación manual con alguien del ambiente**: (1) coordinar con un entrenador o analista de la FUBB que conozca a los jugadores; (2) cargar la competencia real más completa disponible (no solo el seed) y verificar `population.size`; (3) acordar 5 jugadores de referencia de roles distintos (base organizador, escolta anotador, ala, ala-pívot, pívot reboteador); (4) mostrarle por cada referencia los 10 resultados con nombre, equipo, posición y min/partido, **sin** similitud ni distancia; (5) que marque cada resultado "equivalente", "parecido" o "no"; (6) registrar en `progress.md` la tabla referencia × resultado × marca, las observaciones y, para los "no", la dimensión que la persona cree que falló; (7) aprobar si en ≥ 4 de las 5 referencias hay ≥ 6 de 10 resultados "equivalente" o "parecido"; (8) si no aprueba, no tocar parámetros: anotar las dimensiones señaladas y devolver la decisión al cliente (pesos o dimensiones nuevos), repitiendo el protocolo después.
- [ ] T-F19 · CA-14: DevTools 375 px en S4 y S7 → filtros apilados, sin scroll horizontal de la página, columnas "Se parecen/Difieren" ocultas y visibles al expandir.
- [ ] T-F20 · CA-15: medir (Network o `time curl`) `GET /api/similar/<id>` con la caché fría (reiniciar el backend o importar/borrar un partido para subir `data_version`) y caliente en la competencia más grande; registrar los tiempos en `progress.md` (objetivo: frío < 3 s, caliente < 1,5 s).

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B5, T-D1, T-D3, T-F18 |
| CA-2 | T-B5, T-F6 |
| CA-3 | T-B3, T-B4, T-B5, T-F7 |
| CA-4 | T-B5, T-B7, T-F8 |
| CA-5 | T-B3, T-B4, T-B5, T-F9 |
| CA-6 | T-B5, T-D1, T-F10 |
| CA-7 | T-B4, T-F11 |
| CA-8 | T-B2, T-D1, T-F12 |
| CA-9 | T-C1, T-D3, T-D4, T-F13 |
| CA-10 | T-D2, T-F14 |
| CA-11 | T-B5, T-B7, T-E1, T-F15 |
| CA-12 | T-B8, T-B9, T-D6, T-F16 |
| CA-13 | T-A1, T-B6, T-F17 |
| CA-14 | T-D5, T-F19 |
| CA-15 | T-B6, T-F20 |

## Dependencias externas
- Fase 1 y fase 2 integradas: T-05 (`compute_standard`, claves estándar de jugador), T-01 (`population.py`), C-03 (`shot_zones.py`, coordenadas reales vía F-11), C-08 (`player_id`, `identity.position_group`), T-02, F-13, X-01 (pestañas `similares` registradas), T-06 (menú de exportación). Sin ellos A-09 no puede empezar.
- F-03 implementado (`prepare.py` con `rival_threats.top_usage` y `suggestions_profile = None`, `prepare-report.js`) para T-B9, T-D6 y T-F16.
- Dataset: los 13 partidos del seed reprocesados con la ingesta v2 sirven para T-F2…T-F17; el protocolo de T-F18 y la medición de T-F20 necesitan la competencia real más completa disponible (decenas de partidos por equipo) y a la persona del ambiente.
- Sesión válida para curl (`AUTH_USERS` local o modo abierto) y usuario admin para editar configuración (`ADMIN_USERS` sin definir = todos admin).
- Confirmación del cliente sobre la interpretación del "emparejamiento propuesto por perfil" (spec §9, `[NEEDS CLARIFICATION]`) antes de T-B8, T-B9 y T-D6; T-B1…T-B7 y la UI de S4/S7 no dependen de ella.
