# Tasks — T-01: Ficha de métrica: valor, ranking y distancias

> **ID:** T-01 · **Prioridad:** P0 · **Fase y orden:** Fase 1 · 15
> **Depende de:** C-02, C-08, F-11, T-05, T-02, F-13 (ver [plan.md](plan.md) §10) · **Habilita:** T-06, C-03, A-12, F-05, F-08, F-06, F-17, F-03, F-14, A-09, A-10
> **Estado:** ✅ Aprobado
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md) · Especificación v2 §3 · T-01
> **Estimación:** XL · 24–34 h

Convenciones: app local en `http://localhost:5000` (sin `AUTH_USERS` no hay login ni `ADMIN_USERS`). "Seed" = los 13 partidos de `SEED_URLS` reprocesados con la ingesta de T-05 (competencia id 1). **Preparación de verificación (R-05):** el seed tiene 2 partidos por equipo
(`LBO` y `MNE` tienen 1), así que con `sample.team.min = 3` no hay población. Antes de los checks de Grupo F: `PUT /api/settings` con `{"values": {"sample.team.min": 2}}` → 12 equipos califican y `LBO`/`MNE` quedan fuera (sirven para CA-7). "Script ad hoc" = `app.test_client()` o `python -c` sin versionar
(Constitución 8: no hay suite automatizada).

## Orden de ejecución

### Grupo A — Backend: infraestructura, versiones y configuración
- [ ] T-A1 · Verificar si existen `cache.py` y la tabla `app_meta`; si no, crearlos con la firma de Arq. §3.14 (`get_versions`, `bump_data_version`, `bump_config_version`, `memo`, `clear`; LRU por namespace, claves con ambas versiones) · `backend/cache.py`, `backend/database.py` (modelo `AppMeta`) · cubre RF-13 · Done: `python -c "import cache"`; `cache.memo("x", (1,), lambda: 42)` devuelve 42 y una segunda llamada no ejecuta la función; `bump_data_version("test")` invalida la entrada
- [ ] T-A2 · Auditar y completar las escrituras que deben subir `data_version`: `ingest.persist_game`, `DELETE /api/games`, `competitions.create/update/merge/assign_game`, `identity.merge_players`/`backfill_player_ids`; y las de configuración suben `config_version` · `backend/ingest.py`, `backend/app.py`, `backend/competitions.py`, `backend/identity.py` · cubre RF-13 · Done: ad hoc: leer `get_versions()`, borrar un partido en una copia de la base y volver a leer: `data_version` sube; reprocesar un partido y editar una competencia también lo suben
- [ ] T-A3 [P] · Pasar a `status: "activa"` `population.min_size`, `sample.team.min/high`, `sample.player.min/high` en `CONFIG_SPEC` (si T-02 no lo hizo) · `backend/config.py` · cubre RF-10, RF-12 · Done: `GET /api/settings` las lista en `values` con sus defaults 3, 3, 10, 60, 200; `PUT` de `sample.team.min` a 2 responde 200

### Grupo B — Backend: población y ficha (`population.py`)
- [ ] T-B1 · `Member` y `Population`; `metrics_catalog.enumerate(entity_type, comp_id, ctx, variant)` y `set_enumerator`; enumeradores de `team` y `player` ya registrados por T-05 · `backend/population.py`, `backend/metrics_catalog.py` · cubre RF-10, RF-19 · Done: `metrics_catalog.enumerate("team", 1, ctx, None)` devuelve 14 bundles; `enumerate("player", 1, ctx, None)` devuelve 187 jugadores del seed
- [ ] T-B2 · `rank` (competición "1224") y `percentile` (mid-rank sin la propia entidad) · `backend/population.py` · cubre RF-3, RF-7, RF-9 · Done: ad hoc: `rank(5, [9, 7, 5, 5, 3], "higher") == (3, True)`; sobre `[4,3,3,1]` con valor 3 → rank 2 y 2 empatados, el siguiente (1) es 4.º; `percentile` con 5 peores, 1 igual y 5 mejores (excluida la propia) = 50; líder único = 100; `lower` invierte; `others == []` → `None`
- [ ] T-B3 · `population()` con umbrales: valores `compute_standard` + `apply_base("partido")`, ajustado de T-02 para quinteto/ON-OFF/cierre, badge `sample_for`, `in_population`, `criterion`, `context_label`, razones `sin_universo`/`contexto_no_comparable`, caché `pop:<tipo>` · `backend/population.py` · cubre RF-10, RF-11, RF-12, RF-13, RF-16, RF-18 · Done: con `sample.team.min = 2` la población de equipos del seed tiene 12 miembros `in_population` y 2 fuera (`LBO`, `MNE`); una segunda llamada es instantánea (caché); `competition=all` → miembros vacíos y razón `sin_universo`
- [ ] T-B4 · `league_reference`, `_leader`, `ficha`, `attach_fichas` (campos de plan §3.1, `basis`, `pct_reason`, `dist_*_rel` con la regla ≥ 0,05) · `backend/population.py` · cubre RF-1, RF-4, RF-5, RF-6, RF-9, RF-11, RF-12 · Done: ad hoc: para `der` (lower) de un equipo, `dist_avg` tiene el signo de (avg − valor) y `dist_leader ≤ 0`; el líder del empate por el primer puesto es el primero alfabético; una entidad fuera de la población no altera `avg` ni `leader` de las demás
- [ ] T-B5 [P] · `full_ranking` (filas ordenadas, `outside_population` con `hypothetical_rank`, `avg`) · `backend/population.py` · cubre RF-14 · Done: ad hoc: el `rank` de cada fila coincide con `rank()`; las filas con valor nulo no aparecen; `len(rows) == population.size`
- [ ] T-B6 · Enumeradores nuevos: `lineups.all_onoff_bundles(games, team_code)` (una pasada) y `bundles.all_lineup_bundles`, `all_onoff_bundles`, `all_clutch_bundles`, registrados con `set_enumerator` · `backend/lineups.py`, `backend/bundles.py` · cubre RF-10 · Done: para un equipo del seed, ON + OFF de cada jugador de `all_onoff_bundles` coincide con el resultado de `lineups.onoff_stats` para ese jugador (mismos `seconds` y mismos conteos); `all_clutch_bundles` devuelve un bundle por equipo con cierres

### Grupo C — Backend: enganche y rutas
- [ ] T-C1 · Completar el enganche de fichas en `metrics_catalog.build_payload` (pop, `rank_values` por partido/ajustado, `attach_fichas`, bloque `population`) · `backend/metrics_catalog.py` · cubre RF-1, RF-16, RF-19 · Done: `GET /api/metrics/team?id=VER&competition=1` trae en `oer` los campos `rank`, `rank_total`, `percentile`, `avg`, `leader`, `dist_*`; `GET /api/team/VER?competition=1` trae lo mismo en `standard.metrics.oer`
- [ ] T-C2 · `GET /api/rankings/<entity_type>/<metric_key>` · `backend/app.py` · cubre RF-14 · Done: `curl "http://localhost:5000/api/rankings/team/oer?id=VER&competition=1"` → 200, `rows` ordenado, VER con `highlight: true`, `outside_population` con `LBO` y `MNE`; `metric_key=nope` → 400 `parametro_invalido`
- [ ] T-C3 · `GET /api/league`: valores de la población, `in_population`, `rank`, `pct`, `include=summary` · `backend/app.py` · cubre RF-17 · Done: `curl "http://localhost:5000/api/league?competition=1&include=summary"` devuelve `teams`, `avg`, `leaders`, `population`; sin `include`, devuelve la lista de siempre con las claves nuevas por fila

### Grupo D — Frontend: capa API y componentes
- [ ] T-D1 · `api.ranking(type, metric, params)` y `api.league(comp, {summary})` · `frontend/js/api.js` · cubre RF-14, RF-17 · Done: en la consola, `await api.ranking("team","oer",{id:"VER",competition:1})` devuelve el ranking; `api.league(1)` sigue devolviendo una lista
- [ ] T-D2 [P] · `core/colors.js`: `percentileColor`, `percentileBg` con anclas #ef4444/#8b949e/#22c55e · `frontend/js/core/colors.js` · cubre RF-8 · Done: en consola `percentileColor(0)` = "rgb(239,68,68)", `(50)` = "rgb(139,148,158)", `(100)` = "rgb(34,197,94)", `(25)` = promedio lineal entre los dos primeros; `percentileColor(null) === null`
- [ ] T-D3 · `components/metric-card.js`: `metricCard` en layouts `card` y `row`, `fmtDelta` (pp, signo "+"/"−", relativo), casos nulo / `pct_reason` / `in_population:false` / `basis:"partido"` / neutral · `frontend/js/components/metric-card.js` · cubre RF-1, RF-2, RF-3, RF-6, RF-11, RF-12, RF-15, RF-18, RF-19 · Done: renderizar con el `oer` de `VER` muestra "9.º de 12", "Líder: …", "Ø …", chip p27; con `reason` y sin ficha muestra solo "—" con `title`
- [ ] T-D4 · `bindMetricCards`: popover en escritorio (hover/foco, 250 ms) y hoja inferior en táctil, caché en memoria por URL, estados cargando/error/vacío, cierre con Escape / fondo / botón · `frontend/js/components/metric-card.js` · cubre RF-14 · Done: en escritorio, pasar el cursor sobre la ficha muestra el ranking con la entidad resaltada en < 1 s; en emulación móvil, el toque abre la hoja con "Cerrar"
- [ ] T-D5 [P] · CSS `/* ── metric-card (T-01) ── */` (tarjeta, líneas de ficha, chip, `.fuera-poblacion`, popover, hoja inferior, atenuado de Liga) · `frontend/css/style.css` · cubre RF-3, RF-8, RF-14 · Done: a 360 px una tarjeta con ficha no desborda su columna; el texto de las líneas mide ≥ 11 px
- [ ] T-D6 · `standard-panel.js`: `cellHTML` usa `metricCard(..., {layout: "row"})` y la cabecera la línea `Referencia…` · `frontend/js/components/standard-panel.js` · cubre RF-1, RF-19 · Done: el panel estándar de Equipo muestra valor · puesto · percentil por métrica

### Grupo E — Frontend: reemplazo en pantallas, estados y offline
- [ ] T-E1 · Simplificar `statBox` (sin `leagueKey`/`league`/`.stat-context`); retirar `isPct`/`NOT_PCT` y `statClass` si quedan sin usos; ajustar los usos restantes (Comparar) · `frontend/js/app.js` · cubre RF-15 · Done: `grep -n "stat-context\|NOT_PCT" frontend/js/app.js frontend/css/style.css` sin resultados; Comparar sigue mostrando sus valores
- [ ] T-E2 · Equipo: obtener `std` una sola vez por render (`api.metrics("team", {id, competition, last, base:"partido"})`) y reemplazar las ~28 `statBox` por `metricCard` con `stdKeyFor`; aviso discreto si falla · `frontend/js/app.js` (`_renderTeamContent`) · cubre RF-1, RF-15 · Done: abrir `VER` muestra las cards con ficha; con la red cortada tras cargar, las cards ya dibujadas siguen y un recálculo sin red muestra el error
- [ ] T-E3 · Jugador: ídem con `player_id` (~24 `statBox`) · `frontend/js/app.js` (`_renderPlayerContent`) · cubre RF-1, RF-15 · Done: un jugador con minutos suficientes muestra ficha en cada card; uno bajo el mínimo muestra "Muestra baja · fuera de la población"
- [ ] T-E4 · Liga: `api.league(comp, {summary:true})`, columna `#` por puesto de la métrica ordenada, celdas con `percentileBg`, filas fuera de la población atenuadas con chip, `<tfoot>` "Líder" y "Ø competencia" · `frontend/js/app.js` (`renderLeague`, `_leagueTableHTML`) · cubre RF-17 · Done: ordenar por OER: la primera fila es el líder y el pie coincide con `leaders.oer`/`avg.oer`; `LBO`/`MNE` atenuados
- [ ] T-E5 [P] · Mapa de liga: `drawLeagueScatter` usa `axis.avgX/avgY` del `summary.avg` cuando está · `frontend/js/charts.js`, `frontend/js/app.js` · cubre RF-17 · Done: la línea "Prom. OER" del mapa cae en el mismo valor que "Ø" del pie de la tabla
- [ ] T-E6 · `bindMetricCards` después de cada render de Equipo, Jugador, Liga y los paneles de T-05 · `frontend/js/app.js` · cubre RF-14 · Done: hover en una card de Equipo y en una celda del panel estándar abren el mismo ranking
- [ ] T-E7 · Registrar `core/colors.js` y `components/metric-card.js` en `STATIC` y subir `CACHE` · `frontend/sw.js` · cubre RF-14 · Done: DevTools → Application: el SW instala ambos archivos y la app carga sin red tras la primera visita
- [ ] T-E8 · Estados vacío/error/sin referencia con el copy de spec §6 · `frontend/js/app.js`, `metric-card.js` · cubre RF-12 · Done: con `population.min_size = 13` las cards muestran "Sin referencia: la población tiene menos de 13 entidades" y el valor sigue visible

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`) · Done: servidor escuchando; importa `population`, `cache`, `bundles` sin errores
- [ ] T-F2 · Si tocó esquema (`app_meta`): `python backend/database.py` dos veces seguidas sin error · Done: segunda corrida sin excepción
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o `app.test_client()` y shape verificado contra plan §3: `/api/metrics/{team,player,lineup,onoff,clutch}`, `/api/team/VER`, `/api/rankings/...`, `/api/league` (con y sin `include=summary`) · Done: respuestas con el shape del plan
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo, Jugador, Liga y los paneles de T-05, en escritorio y a 360 px · Done: 0 errores
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (procedimientos abajo)
- [ ] T-F6 · CA-1 (CA del cliente) · Done: ad hoc con `sample.team.min = 2`: para 3 métricas (`oer`, `der`, `efg_pct`) y 3 equipos, `rank`/`rank_total`/`leader`/`avg` de la ficha = posición en la lista de `GET /api/league?include=summary` ordenada por esa métrica (solo `in_population`), `leaders[clave]` y `avg[clave]`; verificación visual en Liga y Equipo
- [ ] T-F7 · CA-2 y CA-3 · Done: la card OER de `VER` muestra los cinco elementos; para `der`, el líder es el DER más bajo de la lista, `rank = 1` en el DER más bajo, percentil > 50 si DER < promedio, `dist_avg > 0`, `dist_leader ≤ 0` y el tooltip muestra la diferencia aritmética con el signo contrario
- [ ] T-F8 · CA-4 y CA-5 · Done: `games` (todos con 2 partidos) devuelve `rank 1`, `tied: true`, `percentile 50` en los 12 equipos calificados; un empate construido con valores sintéticos (script con `population.rank`) da 1, 2, 2, 4; el cálculo del percentil con 5 peores/1 igual/5 mejores da 50
- [ ] T-F9 · CA-6 · Done: consola del navegador: `percentileColor(0|50|100)` = los tres anclas, `(25)` y `(75)` = puntos medios; una métrica neutral (`fg3_uso`) y una nula no muestran color
- [ ] T-F10 · CA-7 y CA-8 · Done: `LBO` (1 partido): `in_population: false`, ranking hipotético; agregar/quitar `LBO` de la lista (con `sample.team.min` 1 → 2) no cambia el `avg` ni el `leader` de `VER`; con `population.min_size = 13` o `competition=all` los campos de ficha son nulos con `poblacion_insuficiente` / `sin_universo` y el valor se ve
- [ ] T-F11 · CA-9 y CA-16 · Done: con `sample.team.min = 1`, `last=1` → 14 equipos, líder y promedio distintos de los de la temporada y la ficha dice "Último partido"/"Últimos 1"; volver a "Todos" restituye; cambiar `sample.team.min` 2 → 3 → 2 cambia el total de `/api/rankings/team/oer` (12 → 0 → 12) sin reiniciar el servidor; tras `DELETE` de un partido en una copia de la base el total de partidos y el promedio se recalculan (invalidación de caché, R-08)
- [ ] T-F12 · CA-10 · Done: navegador de escritorio: hover sobre OER de `VER` abre el ranking con `VER` resaltado, "Fuera de la población" con `LBO`/`MNE` y el pie; emulación móvil: el toque abre la hoja con "Cerrar"
- [ ] T-F13 · CA-11 y CA-17 · Done: `grep -rn "stat-context\|9900\|1050" frontend/js frontend/css` sin variaciones sobrantes; recorrido de Equipo y Jugador sin "Ø" ni "↑" fuera de los títulos de ejes; a 360 px sin scroll horizontal de página y texto ≥ 11 px; contraste del texto sobre `percentileBg` ≥ 4,5:1 medido con las herramientas del navegador en tema claro y oscuro
- [ ] T-F14 · CA-12 y CA-13 · Done: `blk_received` de `VER` antes del reproceso (copia de la base con `ingest_version` previa) → "—" sin ranking ni color y esa entidad no cuenta en el total; `GET /api/metrics/lineup?id=…` de un quinteto con `net_rating.adj`: `rank`/`percentile` calculados sobre `adj.value` (si el seed no tiene quintetos sobre el mínimo, bajar `sample.lineup.min` a 5 para la prueba y registrarlo)
- [ ] T-F15 · CA-14 y CA-15 · Done: `oer` de `VER` en `/api/metrics/team`, `/api/team/VER` (`standard`) y `/api/rankings/team/oer` da el mismo puesto, total, líder y promedio; `GET /api/metrics/team?id=VER&base=total` devuelve `pts.value = 149` con `basis: "partido"` y `avg`/`dist_avg` en por partido
- [ ] T-F16 · CA-18 · Done: navegador, Liga: ordenar por distintas columnas actualiza `#`; `LBO`/`MNE` atenuados con "Muestra baja"; el pie "Líder" y "Ø competencia" coincide con `include=summary`; tabla general (C-09) sin cambios
- [ ] T-F17 · Comparación antes/después de Liga (R-04) y rendimiento · Done: tabla en `progress.md` con OER/DER/NRtg/TO%/PACE de 3 equipos (promedio de tasas por partido de antes vs cociente de totales de ahora); tiempos en frío/caliente de las poblaciones de equipo, jugador, quinteto (< 1,5 s en caliente)
- [ ] T-F18 · Actualizar `docs/metrics.md`, `docs/api.md`, `docs/frontend.md` (incluida la corrección de `_colorCell`), `docs/architecture.md` y anotar la mención de `_colorCell` en la regla 9 de `sdd/README.md` y en `CLAUDE.md` como pendiente de decisión humana · Done: cada doc describe lo implementado

### Grupo G — Incrementos diferidos (diferido; no se ejecuta en este requisito)
- [ ] T-G1 (diferido) · Ficha sobre las demás dimensiones del selector global: la barra de contexto envía el contexto completo y `population()` ya lo recibe · se habilita con T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/tasks.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/tasks.md))
- [ ] T-G2 (diferido) · Población y ficha en bases por 40 y por 100 · se habilita con T-04 ([../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/tasks.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/tasks.md))
- [ ] T-G3 (diferido) · Coloreado por percentil, promedio y totales en tablas completas · se habilita con T-06 ([../16-T-06-tablas-completas-exportacion/tasks.md](../16-T-06-tablas-completas-exportacion/tasks.md))
- [ ] T-G4 (diferido) · Población de pareja, emparejamiento, cuarto, split, origen, tipo, oportunidad, tramo de reloj, zona y cadena · se habilita con A-08, F-07, F-04, T-03, A-02…A-05, C-03, A-07

## Matriz de cobertura CA → tareas
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-B3, T-B4, T-C1, T-C3, T-E4, T-F6 |
| CA-2 | T-B4, T-C1, T-D3, T-E2, T-F7 |
| CA-3 | T-B2, T-B4, T-D3, T-F7 |
| CA-4 | T-B2, T-D3, T-F8 |
| CA-5 | T-B2, T-F8 |
| CA-6 | T-D2, T-F9 |
| CA-7 | T-B3, T-B4, T-D3, T-F10 |
| CA-8 | T-B3, T-B4, T-E8, T-F10 |
| CA-9 | T-B3, T-C1, T-E2, T-F11 |
| CA-10 | T-B5, T-C2, T-D1, T-D4, T-E6, T-F12 |
| CA-11 | T-E1, T-E2, T-E3, T-F13 |
| CA-12 | T-B4, T-D3, T-F14 |
| CA-13 | T-B3, T-B5, T-C1, T-F14 |
| CA-14 | T-C1, T-C2, T-D6, T-F15 |
| CA-15 | T-B3, T-B4, T-D3, T-F15 |
| CA-16 | T-A1, T-A2, T-A3, T-B3, T-F11 |
| CA-17 | T-D3, T-D5, T-D4, T-F13 |
| CA-18 | T-C3, T-E4, T-E5, T-F16 |

## Dependencias externas
- T-05, T-02, C-02, C-08 y F-13 implementados (T-02 aporta `sample.py` y `lineups.all_lineups`; F-13 aporta `config.get`). Si `cache.py` no existe, T-A1 lo crea (plan §10 D-2).
- Seed reprocesado con la ingesta de T-05 (`POST /api/reprocess`), para que las métricas con `blk_received`/`fouls_drawn` tengan valor.
- Cambio temporal de configuración para verificar (`sample.team.min = 2`, luego restituir con `POST /api/settings/reset`); `sample.lineup.min` solo si hace falta para CA-13. Sin variables de entorno nuevas ni dependencias Python nuevas.
- Dataset: el seed no alcanza para mostrar percentiles con los umbrales por defecto; para una verificación con umbrales reales se necesita una segunda competencia o más partidos (R-05).
