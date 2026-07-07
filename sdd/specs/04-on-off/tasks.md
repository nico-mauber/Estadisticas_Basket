# Tasks — Feature 04: ON / OFF

## Orden de ejecución

### Grupo A — Backend: agregación ON/OFF (reusa motor de Feature 03)
- [x] T-A1 · `_side_metrics()` (agrega un lado: posesiones/pts_for/pts_against/oer/der/net/eFG%/TS%) · `backend/lineups.py` · cubre RF-2, RF-3, RF-5
- [x] T-A2 · `onoff_stats()` (partición ON/OFF por partido vía `build_segments`, diff null-safe) · `backend/lineups.py` · cubre RF-1..RF-5

### Grupo B — Backend: ruta
- [x] T-B1 · `GET /api/onoff/<team_code>/<player_name>` (404 si sin datos, `usg_pct` vía `calc_player_stats`) · `backend/app.py` · cubre RF-6, RF-7

### Grupo C — Frontend
- [x] T-C1 · `api.onoff(team, player)` · `frontend/js/api.js`
- [x] T-C2 · Panel ON/OFF en vista Equipo (tabla `ON|OFF|Δ` + muestra + "sin muestra") · `frontend/js/app.js`
- [x] T-C3 · Bump `sw.js` cache version

### Grupo F — Verificación de feature
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · Unit-test directo: titular con muchos minutos → `on.possessions>0`; `diff.net_rating == on.net_rating - off.net_rating`
- [x] T-F3 · CA-2: jugador con `off.possessions==0` → métricas `null` (no `NaN`/`Infinity`)
- [x] T-F4 · CA-5: `on.possessions + off.possessions` ≈ posesiones totales del equipo en esos partidos
- [x] T-F5 · Jugador inexistente → `404 {"error":"Sin datos ON/OFF para este jugador"}`
- [x] T-F6 · Navegador: panel ON/OFF en vista Equipo, tabla con Δ coloreado, sin errores de consola
- [x] T-F7 · Recorrer CA-1 a CA-5 del spec y marcar ✅/❌

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-A1, T-A2, T-B1, T-F2 |
| CA-2 | T-A1, T-F3 |
| CA-3 | T-C1, T-C2, T-F6 |
| CA-4 | T-B1, T-F5 |
| CA-5 | T-A2, T-F4 |
