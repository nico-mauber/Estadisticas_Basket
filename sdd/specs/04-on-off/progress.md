# Progress — Feature 04: ON / OFF

## Estado de tareas
- [x] Backend: `_side_metrics()` + `onoff_stats()` en `lineups.py` (reusa `build_segments`/`game_starters`/`_agg` de Feature 03)
- [x] Backend: endpoint `GET /api/onoff/<team_code>/<player_name>` en `app.py` (+ `usg_pct` vía `calc_player_stats`)
- [x] Frontend: `api.onoff(team, player)` en `api.js`
- [x] Frontend: panel "ON / OFF" en vista Equipo (`#team-onoff`, `renderTeamOnOff`, botón "Ver ON/OFF")
- [x] Frontend: `CACHE` bump a `smart-basket-v7` (compartido con Feature 03)
- [x] Verificación: unit-tests directos (reales + sintético para división por cero) + `test_client` + navegador real

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/onoff/CNF/E.%20Oglivie` → `on.possessions=87.0>0`, `off.possessions=77.0>0`, `diff.net_rating(0.2695) == on.net_rating(0.4364)−off.net_rating(0.1669)` (assert numérico) |
| CA-2 | ✅ | Test sintético (jugador que nunca sale de cancha en un partido fabricado): `off.possessions==0` → `off.oer/der/net_rating=None`; `diff.oer=None`; sin `NaN`/`Infinity` |
| CA-3 | ✅ | Navegador: panel ON/OFF para "E. Oglivie" → tabla `ON\|OFF\|Δ` (OER 1.18/1.35 Δ-0.17, DER 0.75/1.18 Δ-0.44, Net 0.44/0.17 Δ+0.27, eFG% 55.1%/66.9%, TS% 57.9%/68.4%), Δ coloreado verde/rojo, muestra "ON: 87 pos · 45' \| OFF: 77 pos · 37'", consola sin errores |
| CA-4 | ✅ | `GET /api/onoff/CNF/Nadie` → `404 {"error":"Sin datos ON/OFF para este jugador"}` |
| CA-5 | ✅ | Verificado numéricamente: `on.possessions(87.0) + off.possessions(77.0) = 164.0` == posesiones totales calculadas directamente sobre TODOS los eventos de esos partidos (`_agg` sin partición) = `164.0` — partición exhaustiva y disjunta confirmada |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: N/A — Feature 04 no toca esquema
- Endpoints probados: ✅ (`test_client`: 200 válido, 404 jugador inexistente)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- Ninguna. `on`/`off` nacen de partir los mismos `segments` de `build_segments` (Feature 03) por `player_name in on_court` — la exhaustividad/disjunción de CA-5 es una propiedad estructural del código, no un cálculo aparte que pueda desalinearse.

## Docs a actualizar
- [x] `docs/api.md` — endpoint `GET /api/onoff/<team_code>/<player_name>`
- [x] `docs/frontend.md` — panel "ON/OFF" en Equipo, `api.onoff()`, cache `v7`
- [x] `docs/architecture.md` — módulo `lineups.py` (compartido con Feature 03)

## Deuda / TODO (spec §8)
- Conteos crudos (PER/ROB/TAP/AST/REB) ON vs OFF como cifras — ya agregados internamente (`_side_metrics` no los expone todos); agregar en iteración siguiente si se pide.
- "Chaos" y "Offensive Dependency" — sin fórmula definida (spec §9), no implementados.
- Impacto por-partido (ON/OFF de un partido puntual) — el MVP es global multi-partido.
- Evidencia visual: `feat03-04-lineups-onoff.png` (compartida con Feature 03).
