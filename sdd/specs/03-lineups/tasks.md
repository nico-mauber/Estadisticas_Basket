# Tasks — Feature 03: Lineups (combinaciones de 3, 4 y 5 jugadores)

## Orden de ejecución

### Grupo A — Backend: motor de quintetos
- [x] T-A1 · `game_starters()` (5 titulares o `None` si inconsistente) · `backend/lineups.py` · cubre RF-1, RF-7
- [x] T-A2 · `build_segments()` (tramos por substitution propia + segundos acumulados) · `backend/lineups.py` · cubre RF-1, RF-2
- [x] T-A3 · `_agg()` / `_metrics()` (POS/OER/DER/Net/eFG%/TS%, null-safe) · `backend/lineups.py` · cubre RF-3
- [x] T-A4 · `_leaders()` (scorer/assister/rebounder entre K jugadores) · `backend/lineups.py` · cubre RF-5

### Grupo B — Backend: orquestación y ruta
- [x] T-B1 · `lineup_stats(games, team_code, players)` (agrega multi-partido, games_used/excluded) · `backend/lineups.py` · cubre RF-1..RF-5, RF-7
- [x] T-B2 · `_team_pbp_games(team_code)` helper · `backend/app.py` · cubre RF-6
- [x] T-B3 · `GET /api/lineup/<team_code>?players=A|B|C` (valida 3–5, 400/404) · `backend/app.py` · cubre RF-6

### Grupo C — Frontend
- [x] T-C1 · `api.lineup(team, players)` · `frontend/js/api.js`
- [x] T-C2 · Apartado "Combinaciones" en vista Equipo (multi-select + tarjeta resultado + avisos) · `frontend/js/app.js`
- [x] T-C3 · Bump `sw.js` cache version

### Grupo F — Verificación de feature
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · Unit-test directo (script python): combinación de 5 titulares de un equipo real → `size` implícito por `len(players)`, `sample.possessions>0`, `net_rating == oer-der`
- [x] T-F3 · Verificación de invariante: `sample.seconds` de una combinación de 3 ≤ segundos totales del jugador que menos jugó de los 3 (aprox, vía suma de tramos)
- [x] T-F4 · `players` con 2 o 6 nombres → `400`
- [x] T-F5 · Navegador: apartado en vista Equipo, analizar combinación de titulares, sin errores de consola
- [x] T-F6 · Recorrer CA-1 a CA-6 del spec y marcar ✅/❌

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-A1..T-B3, T-F2 |
| CA-2 | T-A2, T-F3 |
| CA-3 | T-B3, T-F4 |
| CA-4 | T-C1, T-C2, T-F5 |
| CA-5 | T-A1, T-B1, T-F2 |
| CA-6 | T-C2, T-F5 |
