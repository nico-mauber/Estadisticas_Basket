# Plan — Feature 09: Filtro por competencia

## 1. Enfoque
Reusar el patrón del buscador. Backend: agregar `competition` a los game_log de team/player, `?competition=` a `/api/league`, y `GET /api/competitions`. Frontend: 3 helpers compartidos (`_logComps`/`_filterByComp`/`_compOptions`) + un `<select>` por vista que recomputa con `_computeAvg` (client-side en Equipo/Comparar/Jugador) o refetchea (Liga). Sin cambios de esquema.

## 2. Archivos
| Ruta | Responsabilidad | RF |
|---|---|---|
| `backend/app.py` | `competition` en game_log team/player; `?competition=` en `league_overview` (+ guard `if not rows: continue`); `GET /api/competitions` | RF-1..RF-3, RF-5 |
| `frontend/js/api.js` | `league(comp)`, `competitions()` | RF-2, RF-1 |
| `frontend/js/app.js` | helpers `_logComps`/`_filterByComp`/`_compOptions`; extender keys de `_computeAvg` (`uso_pct`,`ast_to`); selects+handlers en Liga/Equipo/Comparar/Jugador; refactor `renderPlayer`→`_renderPlayerContent` | RF-4..RF-7 |
| `docs/api.md`, `docs/frontend.md` | endpoint nuevo, `competition` en game_log, selects | — |

## 3. Backend
- `league_overview`: `comp = request.args.get("competition")`; si viene, `all_rows = [r for r in all_rows if r.game_id in comp_gids]` (gids de `Game.query.filter_by(competition=comp)`); `if not rows: continue` para equipos sin partidos en la competencia.
- `competitions()`: `sorted({c for (c,) in db.session.query(Game.competition).distinct() if c})`.
- team/player game_log: `"competition": game_info.competition if game_info else ""`.

## 4. Frontend
- Helpers junto a `_computeAvg`. Extender la lista de keys de `_computeAvg` con `uso_pct`, `ast_to` (inofensivo para equipo — ausentes → null).
- **Equipo**: `_teamComp`; `_renderTeamContent` filtra por comp + Últ. N (`unfiltered = !n && !_teamComp` → usa `data.averages/record`, si no `_computeAvg`); select `#team-comp` en `renderTeam`, handler junto a las pills.
- **Comparar**: select `#compare-comp` poblado en `refreshCompareSelectors` vía `api.competitions()`; en el click usar `_computeAvg(_filterByComp(dataX.game_log, comp))`.
- **Jugador**: `renderPlayer` → `_renderPlayerContent(main, data, comp)` con select `#player-comp` + handler; game log y evolución usan el log filtrado; shot chart sigue global.
- **Liga**: `api.league(_leagueComp)` + `api.competitions()`; select `#league-comp` en el header; al cambiar setea `_leagueComp` y llama `renderLeague()` (rebuild completo).

## 5. Riesgos
- `_computeAvg` extendido: `uso_pct`/`ast_to` ausentes en logs de equipo → null (ok).
- Baseline de liga cross-competencia (fuera de alcance, spec §8).
- Verificación E2E del path con >1 competencia queda al nivel de backend + unidad (hoy 1 sola competencia en la base).
