# Tasks — C-07: Detalle de tiro completo en equipo y jugador

> **ID:** C-07 · **Prioridad:** P1 · **Fase y orden:** 1·10 (propuesto: después de C-02)
> **Depende de:** C-11 · C-02 · **Habilita:** T-05, C-03
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · N/A — sin cambio de esquema (confirmar que ningún modelo de `backend/database.py` cambia) · cubre — · Done: `git diff backend/database.py` vacío.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Agregar la clave `ppt = (2·fgm2 + 3·fgm3)/(fga2 + fga3)` vía `_safe_div` · `backend/stats_engine.py` `calc_team_stats` y `calc_player_stats` · cubre RF-2, RF-10 · Done: en `python -c` con `fgm2=4, fga2=10, fgm3=4, fga3=10, ftm=5, fta=6, pts=25` → `ppt == 1.0` (20/20) y `pps == 1.25`; con `fga2=fga3=0` → `ppt is None`.
- [ ] T-B2 · Crear `season_shooting(totals) -> (vals, reasons)` (PROPUESTA) con las 9 tasas pooled · `backend/stats_engine.py` · cubre RF-3, RF-4, RF-5 · Done: con totales `fga2=90, fgm2=52, fga3=53, fgm3=23, fta=50, ftm=34` devuelve `ppt 1.2098`, `ppt_2 1.1556`, `ppt_3 1.3019`, `ppt_ft 0.68`, `fg3_pct 0.434`; con `fga3=0` → `ppt_3 None` y `reasons["ppt_3"] == "sin_intentos"`.
- [ ] T-B3 · Hacer que `aggregate_games` (C-02) sobrescriba las 9 tasas con `season_shooting(totals)` y fusione razones en `null_reasons` · `backend/stats_engine.py` · cubre RF-4, RF-6 · Done: `GET /api/team/<code>` devuelve `averages.ppt_3 == round(3·totals.fgm3/totals.fga3, 4)`.
- [ ] T-B4 [P] · Agregar `ppt` a `keys` de `league_averages` · `backend/stats_engine.py` · cubre RF-9 · Done: `GET /api/team/<code>?competition=<id>` trae `league.ppt.avg` no nulo con datos.
- [ ] T-B5 [P] · Agregar `ppt` a `metric_keys` de `search_players` · `backend/app.py` · cubre RF-7, RF-8 · Done: `GET /api/search/players` trae `ppt` y `pps` en cada fila.
- [ ] T-B6 · Revisar que `team_stats`/`player_stats` expongan `game_log[].ppt`, `averages.ppt` y `null_reasons` sin lógica en la ruta · `backend/app.py` · cubre RF-1, RF-10 · Done: curl muestra las claves; la ruta no contiene fórmulas (revisión de diff).

### Grupo C — Frontend: api.js
- [ ] T-C1 · N/A — `api.team/api.player` con `params` los crea C-02 · Done: confirmado en `frontend/js/api.js`.

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · Crear `renderShotDetail(av, totals, games, league, reasons)` (tabla T2/T3/TL por partido y total + 4 PPT con `statBox` y `nullDisplay`, copy con `t()`) · `frontend/js/components/shot-detail.js` · cubre RF-1, RF-2, RF-3, RF-5 · Done: import sin errores; la card renderiza 3 filas y 4 PPT.
- [ ] T-D2 · Reemplazar `_shotDetailGrid` por `renderShotDetail` en `_renderTeamContent` y `_renderPlayerContent` y borrar `_shotDetailGrid` · `frontend/js/app.js` · cubre RF-1 · Done: `grep -n _shotDetailGrid frontend/js` sin resultados; ambas vistas muestran la sección.
- [ ] T-D3 [P] · Cards Eficiencia (Equipo) y Producción ofensiva (Jugador): `PPT` → `av.ppt` / `leagueKey "ppt"` · `frontend/js/app.js` · cubre RF-7 · Done: `grep -n "av.pps" frontend/js/app.js` sin resultados.
- [ ] T-D4 [P] · Columna PPT del Buscador → `ppt` · `frontend/js/app.js` · cubre RF-7 · Done: la columna ordena por `ppt` con nulos al final.
- [ ] T-D5 · Estilos `.shot-detail-table` (sección comentada `/* ── shot-detail (C-07) ── */`) · `frontend/css/style.css` · cubre RF-1 · Done: a 360 px la tabla entra sin scroll horizontal.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado vacío "Sin partidos jugados en la selección" cuando `games === 0` · `frontend/js/components/shot-detail.js` · cubre RF-5 · Done: jugador con solo DNP en la selección muestra el mensaje, no ceros.
- [ ] T-E2 · Agregar `/js/components/shot-detail.js` a `STATIC` y subir `CACHE` · `frontend/sw.js` · cubre RF-1 · Done: en DevTools → Application → Cache Storage el módulo está en la caché nueva.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · `upgrade_db()` idempotente: N/A (sin esquema) — anotar en progress.
- [ ] T-F3 · Endpoints probados: `curl -b cookies.txt "http://localhost:5000/api/team/CNF?competition=<id>"`, `…/api/player/<int:player_id>?competition=<id>`, `…/api/search/players` → shapes de plan §8.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo, Jugador y Buscador.
- [ ] T-F5 · Recorrer cada CA y marcar ✅ en progress.md.
- [ ] T-F6 · CA-1 (cliente): abrir Equipo (CNF) y un Jugador en el navegador → la sección Tiro muestra T2/T3/TL (intentos y convertidos) y los 4 PPT.
- [ ] T-F7 · CA-2: con la respuesta de `/api/team/CNF`, verificar `totals.fga2 / games == averages.fga2` (y las otras 5) y lo mismo en pantalla.
- [ ] T-F8 · CA-3: calcular a mano con `totals` los 4 PPT y FG2%/FG3%/FT% y comparar con pantalla y con `averages` (a 2 decimales); anotar los números en progress.
- [ ] T-F9 · CA-4: en un partido con TLc > 0 del `game_log`, verificar `ppt < pps` y `ppt == (2·fgm2+3·fgm3)/(fga2+fga3)`.
- [ ] T-F10 · CA-5: buscar con `app.test_client()` un jugador con `totals.fga3 == 0` (script ad hoc que recorre `/api/players/<team>`); en pantalla T3i/T3c = 0, PPT 3 y FG3% = "—" con `title` "Sin intentos" y sin color.
- [ ] T-F11 · CA-6: en Equipo aplicar "Últ. 3" y cambiar la competencia (con 2 competencias en el dataset, ver dependencias) → curl con `last=3` y comparar totales con la suma manual de los 3 partidos del `game_log`; ningún PPT en "—".
- [ ] T-F12 · CA-7: jugador con DNP (`game_log[].played == false`) → `games` y `totals` excluyen ese partido (comparar con suma manual).
- [ ] T-F13 · CA-8: para CNF y para un jugador, leer "PPT" en card Eficiencia/Producción, sección Tiro y Buscador → mismo valor.
- [ ] T-F14 · CA-9: `league.ppt.avg` de `/api/team/CNF?competition=<id>` == `league.ppt.avg` de `/api/team/<otro>?competition=<id>` y == media de los `averages.ppt` de todos los equipos de la competencia (script `app.test_client()`).
- [ ] T-F15 · CA-10: consola sin errores (mismo recorrido que T-F4) y mobile 360 px sin scroll horizontal.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-D1, T-D2, T-F6 |
| CA-2 | T-B3, T-B6, T-D1, T-F7 |
| CA-3 | T-B2, T-B3, T-D1, T-F8 |
| CA-4 | T-B1, T-F9 |
| CA-5 | T-B2, T-D1, T-E1, T-F10 |
| CA-6 | T-B3 (+ C-02), T-F11 |
| CA-7 | T-B3 (+ C-02/C-11), T-F12 |
| CA-8 | T-D3, T-D4, T-B5, T-F13 |
| CA-9 | T-B4, T-F14 |
| CA-10 | T-D5, T-E2, T-F15 |

## Dependencias externas
- Grupo 0 de C-11 cerrado (código de `dev` 0cc4de6 integrado) y `core/format.js` / `core/i18n.js` disponibles.
- C-02 cerrado (o al menos su Grupo B: `context.py`, `aggregate_games`, parámetros `competition`/`last` en `/api/team` y `/api/player`) — ver plan §10 D-1.
- C-08 para `GET /api/player/<int:player_id>` (si no está, verificar con la ruta legado por nombre).
- Dataset de verificación: 13 partidos del seed (`SEED_ENABLED=1` + login) reprocesados con la ingesta v2 de F-11; para CA-6 una segunda competencia (Arquitectura R-05).
