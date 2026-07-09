# Progress — Feature 03: Lineups (combinaciones de 3, 4 y 5 jugadores)

## Estado de tareas
- [x] Backend: motor de quintetos `lineups.py` (`game_starters`, `build_segments`, `_agg`, `_metrics`, `_leaders`, `lineup_stats`)
- [x] Backend: `_team_pbp_games()` + endpoint `GET /api/lineup/<team_code>?players=A|B|C` en `app.py`
- [x] Frontend: `api.lineup(team, players)` en `api.js`
- [x] Frontend: apartado "Combinaciones (Lineups)" en vista Equipo (multi-select + `renderTeamLineup`) + wiring de validación 3-5
- [x] Frontend: `CACHE` bump a `smart-basket-v7`
- [x] Verificación: unit-tests directos contra DB real + `test_client` (endpoints) + navegador real

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/lineup/CNF?players=P.+Prieto\|E.+Oglivie\|J.+Feldeine` → `size` implícito en `len(players)=3` (endpoint agrega `size`), `sample.possessions=43.96>0`, `net_rating(0.451) == oer(1.2056)−der(0.7546)` (assert numérico) |
| CA-2 | ✅ | Combo de 3 (`E. Oglivie, J. Feldeine, P. Prieto`) → `sample.seconds=1311.0` ≥ combo de 5 titulares del mismo grupo (`538.0`) — subset siempre ≥ superset (verificado con assert) |
| CA-3 | ✅ | `players=A\|B` (2 nombres) → `400`; `players=A\|B\|C\|D\|E\|F` (6 nombres) → `400`, ambos con `{"error":"Elegí entre 3 y 5 jugadores"}` |
| CA-4 | ✅ | Navegador: seleccionado equipo CNF, marcados 3 checkboxes, "Analizar combinación" → tarjeta con OER 1.21/DER 0.75/Net 0.45/eFG% 54.6%/TS% 56.4%, muestra "43.96 posesiones · 22' en cancha · 2 partido(s) usado(s)", líderes (J. Feldeine 15 pts, J. Feldeine 2 ast, E. Oglivie 9 reb), consola sin errores |
| CA-5 | ✅ | Test sintético: se corrompió el quinteto inicial de un partido a 4 titulares (en memoria, sin tocar DB) → `games_excluded=1`, `games_used=1`, el resultado del otro partido no se vio afectado |
| CA-6 | ✅ | Toast "Elegí entre 3 y 5 jugadores" al intentar analizar con 0 jugadores marcados (validación cliente); backend devuelve el mismo aviso de muestra chica cuando `possessions<10` (renderizado condicional verificado en código, sin caso real `<10` en el dataset actual) |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: N/A — Feature 03 no toca esquema (usa `pbp_events`/`starter` de Feature 02)
- Endpoints probados: ✅ (`test_client`: 200 combo válida, 400 combo inválida, 404 equipo sin pbp)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- Ninguna. Las fórmulas de `_metrics()` se reimplementaron localmente en `lineups.py` (no se llamó a `calc_team_stats`, que espera un partido completo) — mismo patrón ya usado por `clutch.py`. Consistencia verificada por unit-test contra datos reales.

## Endurecimiento del motor (2026-07-08)
Durante la revisión del cliente se auditó `build_segments`: el quinteto en cancha derivaba **transitoriamente** a 4/3/2 dentro de un cluster de cambios simultáneos (mismo reloj), porque se cerraba un tramo por CADA evento de sub. Medición: **0 eventos y 0 segundos** caían en esos tramos parciales en los 6 equipos → los números ya eran correctos, pero la lógica era frágil (un evento intercalado entre dos subs se hubiera mal-atribuido). **Fix:** los `substitution` actualizan `on_court` inline pero ya **no** cortan un tramo; un tramo nuevo solo arranca cuando llega un evento de juego con `on_court` distinto → los cambios simultáneos se fusionan y nunca hay quintetos parciales. Verificado: `on_court != 5` captura 0 eventos, y los números de lineup (combo 3: pos 43.96, net 0.451) quedan idénticos. Beneficia también a Feature 04 (mismo motor).

## Docs a actualizar
- [x] `docs/api.md` — endpoint `GET /api/lineup/<team_code>`
- [x] `docs/frontend.md` — apartado "Combinaciones" en Equipo, `api.lineup()`, cache `v7`
- [x] `docs/architecture.md` — módulo `lineups.py`

## Deuda / TODO (spec §8)
- % Rebote ofensivo/defensivo, Pace, y distribución de tiros de la combinación — diferidos.
- Enumeración automática de las "mejores" combinaciones (rankear todos los quintetos) — el MVP responde solo por combinación consultada.
- Plus/Minus por jugador dentro de la combinación (solo se expone el del equipo vía `pts_for−pts_against` implícito en `net_rating`).
- Comparar dos combinaciones lado a lado.
- `sample.seconds` es aproximado (asume duración fija por período); no modela reloj detenido — suficiente para el aviso de "muestra chica", no para reportes de precisión de reloj.
- Evidencia visual: `feat03-04-lineups-onoff.png` (compartida con Feature 04 — combinación + panel ON/OFF en la misma vista Equipo).
