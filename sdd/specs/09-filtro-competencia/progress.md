# Progress — Feature 09: Filtro por competencia

## Estado
- [x] Backend: `competition` en game_log team/player; `?competition=` en `/api/league` (+ guard sin filas); `GET /api/competitions`
- [x] Frontend: helpers `_logComps`/`_filterByComp`/`_compOptions`; `_computeAvg` extendido (`uso_pct`,`ast_to`); selects+handlers en Liga/Equipo/Comparar/Jugador; `renderPlayer` refactorizado a `_renderPlayerContent`
- [x] `api.league(comp)` + `api.competitions()`
- [x] Verificación backend + navegador (1 competencia)

## CA
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/competitions` → `["Liga Uruguaya de Basquetbol 2025/2026"]` |
| CA-2 | ✅ | `/api/league?competition=Liga…` → 6 equipos; `?competition=Nope` → `[]` (200, sin 500 tras el guard `if not rows`) |
| CA-3 | ✅ | `team/CNF` y `player/CNF/E. Oglivie` traen `competition` en `game_log[0]` |
| CA-4 | ✅ | 1 competencia → `#league-comp` no existe, `#team-comp-wrap` display none, `#compare-comp` display none, `#player-comp` no existe; Liga 2 cards, Jugador 8 cards, sin regresión |
| CA-5 | ⏳ | Pendiente dato real con 2ª competencia; path client-side reusa `_computeAvg` (probado por las pills Últ. N) + backend `?competition=` verificado |
| CA-6 | ✅ | Consola sin errores en Liga/Equipo/Comparar/Jugador |

## Notas / desviaciones
- El baseline de liga (Ø/best) queda cross-competencia aunque se filtre (spec §8) — inocuo con 1 competencia.
- Bug encontrado y corregido durante la verificación: `league_overview` crasheaba (`IndexError` en `rows[-1]`) cuando un equipo quedaba sin partidos tras el filtro → se agregó `if not rows: continue`.
- El shot chart del jugador sigue global (no filtrado por competencia) — spec §8.

## Docs
- [x] `docs/api.md` — `/api/competitions`, `?competition=` en `/api/league`, `competition` en game_log
- [x] `docs/frontend.md` — selects de competencia en las 4 vistas, cache v9
