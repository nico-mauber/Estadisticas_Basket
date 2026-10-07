# Progress — C-02: Promedios de liga rotos

> **Estado:** ✅ Implementado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
- [x] T-A1 · N/A — sin cambio de esquema
- [x] T-B1 · `backend/context.py`
- [x] T-B2 · `backend/repository.py`
- [x] T-B3 · `stats_engine`: claves, `POOLED_GROUPS`, `aggregate_games`, `league_averages`, `null_reasons(overrides)`
- [x] T-B4 · `backend/population.py`: población y `league_summary`
- [x] T-B5 · `team_profile` y `player_profile`
- [x] T-B6 · Rutas finas `team_stats` / `player_stats`
- [x] T-B7 · `league_overview` con competencia por defecto
- [x] T-B8 · `/api/competitions` con `is_default`
- [x] T-B9 · Hook `_configured_default()` documentado
- [x] T-C1 · `api.js`: `team`/`player` con `params`
- [x] T-D1 · Etiquetas `sin_universo` y `sin_datos`
- [x] T-D2 · `statBox` con razón del `Ø`
- [x] T-D3 · `_compOptions` con `allValue`
- [x] T-D4 · Equipo
- [x] T-D5 · Jugador
- [x] T-D6 · Comparar
- [x] T-D7 · Liga
- [x] T-D8 · `charts.js`
- [x] T-D9 · Eliminar `_computeAvg` y helpers de filtro
- [x] T-E1 · Estados vacíos
- [x] T-E2 · Errores 400 y competencia inexistente
- [x] T-E3 · `sw.js`: `CACHE`
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · `upgrade_db()` N/A
- [x] T-F3 · Endpoints probados
- [ ] T-F4 · Consola sin errores — pendiente verificación en navegador
- [ ] T-F5 · Recorrido de CA — pendiente verificación manual
- [ ] T-F6 · Volcado "antes" guardado
- [ ] T-F7 … T-F21 · Verificación por CA — pendiente
- [ ] T-G1 · (diferido → T-01) umbrales, percentiles y ficha
- [ ] T-G2 · (diferido → T-03) contexto completo
- [ ] T-G3 · (diferido → F-13) competencia configurada por defecto

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Frontend no calcula promedios — `_computeAvg` eliminado |
| CA-2 | ✅ | `population.league_summary` devuelve `sin_universo` con `comp_id=None` |
| CA-3 | ✅ | `population.league_reference` usa `league_averages` (DA-08: media de entidades) |
| CA-4 | ✅ | `context.filter_games` con `without_last(ctx)` para el Ø — no depende de últimos N |
| CA-5 | ✅ | `repository.resolve_competition` prioriza parámetro → entidad → config → última |
| CA-6 | ✅ | `context_echo` devuelve el eco de la selección (§7.5) |
| CA-7 | ✅ | `_comp_options` devuelve competencias con conteo de partidos |
| CA-8 | ✅ | `competitions.list_competitions(default_id=...)` marca `is_default` |
| CA-9 | ✅ | Errores 400 validados: competition inexistente, last<1, last no entero |
| CA-10 | ⬜ | Pendiente C-01 CA-10 (selección en backend) |
| CA-11 | ⬜ | Pendiente C-01 CA-11 (Ø para AS/PER acumulado) |
| CA-12 | ✅ | `statBox` muestra `nullDisplay(reason)` para Ø nulo |
| CA-13 | ✅ | Radar guarded: solo con `lg?.oer?.avg != null` |
| CA-14 | ✅ | `drawPlayerEvolution` con línea Ø OER de liga |
| CA-15 | ✅ | Comparar con fila "Ø liga" en métricas avanzadas |
| CA-16 | ✅ | `_refLegend`/`_selectionNote` muestran nota de selección |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente (si aplica): ✅ (N/A — sin cambio de esquema)
- Endpoints probados manualmente: ✅ (team, player, league, competitions, edge cases)
- Consola del navegador sin errores JS: ⬜ (pendiente verificación)

## Desviaciones respecto a docs/ o plan
- `league_overview` no se migró completamente a `population.py` — sigue usando su propio cálculo inline para la tabla de standings (acepta `repository.resolve_competition` para la competencia). La migración completa queda para cuando T-01 agregue percentiles a la tabla de liga.

## Docs actualizados
- [x] `docs/api.md` — query params, response shape, `context`/`competitions`/`league`/`league_meta`, nota C-02
- [x] `docs/metrics.md` — sección "Promedio de liga (C-02)" con definición DA-08
- [x] `docs/frontend.md` — selección server-side, `_reloadTeam`/`_reloadPlayer`, charts, SW cache
- [x] `docs/architecture.md` — módulos `context.py`, `repository.py`, `population.py`, flujo actualizado

## Deuda / TODO
- `league_overview` inline → migrar a `population.py` cuando T-01 complete la ficha de métrica
- CA-10/CA-11 dependen de C-01 (selección server-side para tasas por posesión y Ø para AS/PER)
- Verificación visual completa en navegador pendiente
