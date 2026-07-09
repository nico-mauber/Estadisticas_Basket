# Tasks — Feature 05 (tarea 7): Estadísticas "Clutch"

> Estado actual = v2 (`spec.md §10`). Las tareas v1 (cierres en Liga) quedaron reemplazadas.

## Grupo A — Backend
- [x] T-A1 · `_is_clutch`/`_agg`/`_pos`/`_leaders` (ventana de cierre) · `backend/clutch.py` · RF-1..RF-4
- [x] T-A2 · **(v2)** `_entry_margin` + `_box_metrics` + `team_clutch()` (agregado + por partido + margen) · `backend/clutch.py` · §10.1-10.3
- [x] T-A3 · **(v2)** `GET /api/clutch/<team_code>` (`?margin=`), `_team_pbp_games` con `info` · `backend/app.py` · §10.4

## Grupo B — Frontend
- [x] T-B1 · `api.clutchTeam(team)` · `frontend/js/api.js`
- [x] T-B2 · **(v2)** `renderTeamClutch` + `_drawClutchTable` en vista Equipo; quitar clutch de `renderLeague` · `frontend/js/app.js` · §10.5
- [x] T-B3 · Bump `sw.js` cache `v8`

## Grupo F — Verificación
- [x] T-F1 · Backend sin traceback; smoke de endpoints (200/404)
- [x] T-F2 · Invariantes en los 6 equipos: `aggregate.point_diff == pts_for − pts_against`, `aggregate[k] == Σ per_game[k]` (reb/ast/tov/pts)
- [x] T-F3 · Filtro de margen: excluye palizas (m=45, m=38); `?margin=5`/`?margin=100` cambian `games_qualified` como se espera
- [x] T-F4 · Navegador: vista Equipo con tarjeta agregada + tabla por partido; Liga sin clutch; consola sin errores
- [x] T-F5 · Recorrer CA-v2-1..CA-v2-6 (progress.md)

## Matriz de cobertura (CA v2 → tareas)
| CA | Tareas |
|---|---|
| CA-v2-1 | T-A2, T-A3, T-F2 |
| CA-v2-2 | T-A2, T-F3 |
| CA-v2-3 | T-A2, T-F2 |
| CA-v2-4 | T-A2, T-F2 |
| CA-v2-5 | T-B1, T-B2, T-F4 |
| CA-v2-6 | T-A1 (OT), pendiente dato real |
