# Tasks — C-09: Tabla general en Liga

> **ID:** C-09 · **Fase y orden:** 1·06 · **Estado:** Implementado (2026-09-26) — ver [progress.md](progress.md)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

## Orden de ejecución

### Grupo A — Backend: único lugar de puntos y desempate
- [x] T-A1 · Agregar `WIN_POINTS = 2`, `LOSS_POINTS = 1`, `standings_row(results)` y `standings_sort_key(row)` a
  `backend/stats_engine.py` · cubre RF-1, RF-2, RF-5 · Done: `standings_row([(80,70),(70,70),(60,75)])` devuelve
  `{"games": 3, "wins": 1, "losses": 2, "table_points": 4, "pts_for": 210, "pts_against": 215}` (un marcador empatado
  cuenta como derrota).
- [x] T-A2 · `league_overview` (`GET /api/league`) arma `[(r.pts, r.opp_pts) for r in rows]` con **todos** los partidos
  del equipo en el universo filtrado (no solo los que tienen fila del rival) y llama `standings_row(...)` en vez de
  calcular `table_points` a mano · `backend/app.py` · cubre RF-1, RF-2 · Done: `grep -n "2 \* wins + losses\|2\*wins"
  backend/app.py` no devuelve resultados (el cálculo vive solo en `stats_engine.standings_row`).
- [x] T-A3 · Ordenar `result` con `standings_sort_key` y asignar `standings_pos` (1-based) a cada fila antes de
  devolver la respuesta · `backend/app.py` · cubre RF-2 · Done: con datos de prueba, el equipo con más `table_points`
  tiene `standings_pos == 1`; un empate en puntos se resuelve por mayor diferencia (PF − PC).

### Grupo B — Backend: verificación de universo por competencia (sin cambio de código, solo confirmación)
- [x] T-B1 · Confirmar que el filtro `?competition=<id>` (ya resuelto por `competitions.resolve` de F-11) sigue
  restringiendo `all_rows`/`result` antes de calcular `standings_row` · cubre RF-1 (universo) · Done: con dos
  competencias sembradas, `GET /api/league?competition=<id>` solo cuenta partidos de esa competencia en `games`.

### Grupo C — Frontend: api.js
- [x] T-C1 · Confirmar que `api.league(comp)` (existente) no necesita cambios: ya envía `?competition=` y ya lo
  consume `renderLeague()` · cubre RF-1 · Done: `api.league('')` y `api.league('3')` devuelven la lista con
  `standings_pos` incluido, sin tocar `api.js`.

### Grupo D — Frontend: UI (render)
- [x] T-D1 · `_standingsCardHTML(teams, compSelHTML, pickComp)`: card "Tabla general" con columnas Equipo/PJ/PG/PP/
  Pts/PF/PC, filas ordenadas por `t.standings_pos` (sin recalcular en el cliente) · `frontend/js/app.js` · cubre RF-2,
  RF-3 · Done: con datos de prueba, la fila con `standings_pos: 1` aparece primera en la tabla renderizada.
- [x] T-D2 · Nota fija `"Solo partidos importados, no el fixture completo."` debajo del header de la card ·
  `frontend/js/app.js` · cubre RF-3 · Done: la card siempre muestra ese texto exacto cuando hay tabla visible.
- [x] T-D3 · Con `pickComp = comps.length > 1 && !_leagueComp`, la card muestra solo el header + `"Elegí una
  competencia para ver la tabla general."`, sin tabla · `frontend/js/app.js` · cubre RF-4 · Done: con dos
  competencias sembradas y "Todas" elegido, la card no renderiza `<table>`, solo el mensaje.
- [x] T-D4 [P] · Selector de competencia (`compSelHTML`, reusa `_compOptions`) ubicado dentro de la card de la tabla
  general (no en el header general de Liga) · `frontend/js/app.js` · cubre RF-4 · Done: con más de una competencia,
  el `<select>` aparece dentro de `.card` de "Tabla general" y cambiarlo llama de nuevo a `renderLeague()`.

### Grupo E — Errores, estados vacíos, offline
- [x] T-E1 · Confirmar que el `catch` existente de `renderLeague()` cubre errores de `api.league` sin cambios
  adicionales (incluye la card nueva) · cubre offline · Done: con la red deshabilitada, la sección Liga completa
  (incluida la card) muestra el mensaje de error existente, no un traceback ni pantalla en blanco.
- [x] T-E2 · Confirmar que 0 equipos con partidos en la competencia filtrada no rompe la card (no se renderiza, igual
  que el resto de la sección) · `frontend/js/app.js` · Done: con `?competition=<id sin partidos>`, la sección muestra
  "Sin datos. Importa partidos primero." y no un error JS.

### Grupo F — Verificación de feature
- [x] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [x] T-F2 · Sin cambio de esquema, no aplica `upgrade_db()` (se documenta la omisión).
- [x] T-F3 · `curl http://localhost:5000/api/league` (con sesión) devuelve cada equipo con `games/wins/losses/
  table_points/pts_for/pts_against/standings_pos` coherentes entre sí (`wins + losses == games`).
- [x] T-F4 · Consola del navegador sin errores JS al abrir la vista Liga.
- [x] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`.
- [x] T-F6 (CA-1, CA del cliente) · Con sesión iniciada y una sola competencia, abrir Liga y verificar que la tabla
  general ordena por puntos (desempate por diferencia) y que PJ/PG/PP/PF/PC de cada equipo coinciden con su game log
  (`curl http://localhost:5000/api/team/<code>` → sumar resultados a mano).
- [x] T-F7 (CA-2) · Con `app.test_client()`, llamar `standings_row` con una lista que incluya un resultado empatado y
  verificar que cuenta como derrota y que `wins + losses == games` se sostiene.
- [x] T-F8 (CA-3) · Con dos competencias sembradas (o un partido reasignado a una nueva vía `PATCH /api/games/<id>`
  de F-11), `curl "http://localhost:5000/api/league?competition=<id>"` solo cuenta los partidos de esa competencia.
- [x] T-F9 (CA-4) · Con dos competencias y "Todas" elegido en el navegador, verificar que la card pide elegir una;
  al elegir una, la tabla aparece con solo los equipos de esa competencia.
- [x] T-F10 (CA-5) · Comparar `GET /api/league` (todas y por competencia) antes y después del cambio sobre la misma
  base: idéntico salvo el campo nuevo `standings_pos`.
- [x] T-F11 (CA-6) · En DevTools a 360 px de ancho, verificar que no hay scroll horizontal de página (la tabla puede
  tener scroll interno) y que la consola no muestra errores JS.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-A1, T-A2, T-A3, T-D1, T-F6 |
| CA-2 | T-A1, T-F7 |
| CA-3 | T-B1, T-F8 |
| CA-4 | T-D3, T-D4, T-F9 |
| CA-5 | T-A2, T-A3, T-F10 |
| CA-6 | T-D1, T-F11 |

## Dependencias externas
- C-11 Grupo 0 (integración de `dev`, commit `0cc4de6` sin `venv`) debe estar mergeado antes de empezar: la card
  `_standingsCardHTML` y los campos base (`wins/losses/table_points/pts_for/pts_against`) ya vienen de ahí; C-09 solo
  centraliza el cálculo y agrega `standings_pos`.
- F-11 (`competitions.resolve`, `games.competition_id`) debe estar disponible para que el filtro `?competition=`
  funcione con ids; sin F-11 integrado, se acepta temporalmente el string legado de `games.competition` (mismo
  fallback que usa el resto de la fase 1 mientras F-11 no está mergeado).
- Reimportación de partidos no es necesaria (sin cambio de esquema ni de datos persistidos).
- Seed con al menos dos competencias simuladas (o un partido reasignado) para T-F8/T-F9: si el seed real solo tiene
  una competencia, se prueba creando una segunda con `POST /api/competitions` (F-11) y reasignando un partido con
  `PATCH /api/games/<id>` (F-11), como documenta `progress.md`.
