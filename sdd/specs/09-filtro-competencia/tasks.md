# Tasks — Feature 09: Filtro por competencia

## Grupo A — Backend
- [x] T-A1 · `competition` en game_log de `team_stats` y `player_stats` · `backend/app.py` · RF-3
- [x] T-A2 · `?competition=` en `league_overview` + guard `if not rows: continue` · `backend/app.py` · RF-2
- [x] T-A3 · `GET /api/competitions` · `backend/app.py` · RF-1

## Grupo B — Frontend
- [x] T-B1 · `api.league(comp)` + `api.competitions()` · `frontend/js/api.js` · RF-2, RF-1
- [x] T-B2 · helpers `_logComps`/`_filterByComp`/`_compOptions` + extender keys de `_computeAvg` · `frontend/js/app.js` · RF-4
- [x] T-B3 · Equipo: `_teamComp`, filtro+recompute, select `#team-comp` + handler (compone con pills) · `frontend/js/app.js` · RF-4, RF-6, RF-7
- [x] T-B4 · Comparar: select `#compare-comp` + `_computeAvg(_filterByComp(...))` · `frontend/js/app.js` · RF-4, RF-6
- [x] T-B5 · Jugador: `renderPlayer`→`_renderPlayerContent` + select `#player-comp` + handler · `frontend/js/app.js` · RF-4, RF-6
- [x] T-B6 · Liga: select `#league-comp` + refetch/re-render · `frontend/js/app.js` · RF-5, RF-6

## Grupo F — Verificación
- [x] T-F1 · `node --check` app.js/api.js sin errores de sintaxis
- [x] T-F2 · Smoke endpoints: `/api/competitions` 200, `/api/league?competition=` filtra (6 vs 0), `competition` en game_log team/player
- [x] T-F3 · Navegador: 4 vistas con 1 competencia → selects ocultos, sin regresión, consola sin errores
- [ ] T-F4 · (pendiente dato real) con >1 competencia: selects aparecen y cambian los promedios

## Matriz CA → tareas
| CA | Tareas |
|---|---|
| CA-1 | T-A3, T-F2 |
| CA-2 | T-A2, T-F2 |
| CA-3 | T-A1, T-F2 |
| CA-4 | T-B2..T-B6, T-F3 |
| CA-5 | T-B3..T-B6, T-F4 |
| CA-6 | T-F3 |
