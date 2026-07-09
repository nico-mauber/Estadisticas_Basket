# Plan — Feature 05 (tarea 7): Estadísticas "Clutch"

> Este plan documenta el estado **actual (v2)**. La v1 (cierres en Liga, una fila por equipo-partido) está descrita en `spec.md §1-§9` y fue reemplazada por la revisión v2 (`spec.md §10`).

## 1. Enfoque
Módulo `backend/clutch.py` agrega el play-by-play (`pbp_events`) sobre la ventana de cierre (último período REGULAR con `clock_secs ≤ 300` + OT). La v2 lo reorienta a **un equipo**: `team_clutch()` calcula un agregado ("mini-partido" de todos sus cierres apretados) + un desglose por partido, contando solo los partidos con diferencia ≤ `margin` al minuto 5:00. Reusa `_team_pbp_games` de Feature 03. Sin cambios de esquema (usa `pbp_events` de Feature 02). Fórmulas de `docs/metrics.md` (reimplementadas localmente como en lineups, con `_safe_div` null-safe).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/clutch.py` | service | `_is_clutch`, `_agg`, `_pos`, `_leaders`, `_entry_margin`, `_box_metrics`, `team_clutch()` | RF-1..RF-4, §10 |
| `backend/app.py` | route | `GET /api/clutch/<team_code>` (`?margin=`); `_team_pbp_games` con `info` | RF-5, §10.4 |
| `frontend/js/api.js` | api | `api.clutchTeam(team)` | — |
| `frontend/js/app.js` | UI | `renderTeamClutch` + `_drawClutchTable` en vista Equipo; quitar clutch de `renderLeague` | RF-6, §10.5 |
| `frontend/sw.js` | cache | bump `v8` | — |
| `docs/api.md`, `docs/architecture.md`, `docs/frontend.md` | doc | endpoint, módulo, apartado | — |

## 3. Backend — lógica
| Función | Módulo | Detalle |
|---|---|---|
| `_is_clutch(ev, last_reg)` | `clutch.py` | OT siempre; si no, REGULAR ∧ período==last_reg ∧ `clock_secs≤300` |
| `_agg(evs)` | `clutch.py` | agrega box de una lista de eventos (2pt/3pt/ft/reb/ast/tov/stl/blk/foul/foulon) |
| `_entry_margin(evs, last_reg)` | `clutch.py` | `abs(s1−s2)` del último evento con `clock_secs>300` del REGULAR final (margen al 5:00) |
| `_box_metrics(tb, ob)` | `clutch.py` | off/def rating, eFG%, TS%, possessions con `_safe_div` |
| `team_clutch(games, code, name, margin)` | `clutch.py` | califica por margen, agrega equipo + rival, arma `aggregate` + `per_game` + `clutch_record` |
| `_team_pbp_games(code)` | `app.py` | + `info:{date, home_away}` (compartido con Feat 03/04) |

## 4. Frontend — UI
Apartado en `#sec-team` (`#team-clutch`), refrescado en `renderTeam` y limpiado al cambiar de equipo. Tarjeta agregada (Dif/Off/Def/eFG/TS + conteos + récord + N calificados/excluidos) con `statBox`, y tabla `per_game` ordenable (`_drawClutchTable`, columna `Δ@5:00` = `entry_margin`). Estado vacío si `games_qualified == 0`.

## 5. Riesgos / decisiones
- **Filtro por ventana (no por evento):** el margen se evalúa una vez, al 5:00; si califica, entran todos los eventos del cierre (decisión del cliente, spec §10.1). Alternativa "por evento" quedó descartada.
- **Fórmulas locales** en `clutch.py` (no `calc_team_stats`): igual que lineups, porque el helper espera un partido completo. Consistencia por invariantes (progress).
- **Se pierde la comparación cross-equipo** al mover a Equipo — documentado en backlog §10.7.
