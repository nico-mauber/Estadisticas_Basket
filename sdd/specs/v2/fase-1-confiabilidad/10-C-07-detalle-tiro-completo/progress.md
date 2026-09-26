# Progress — C-07: Detalle de tiro completo en equipo y jugador

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · N/A — sin cambio de esquema
- [ ] T-B1 · Clave `ppt` en `calc_team_stats`/`calc_player_stats`
- [ ] T-B2 · `season_shooting(totals)` pooled
- [ ] T-B3 · `aggregate_games` usa `season_shooting` + `null_reasons`
- [ ] T-B4 · `ppt` en `league_averages`
- [ ] T-B5 · `ppt` en `search_players`
- [ ] T-B6 · Rutas exponen `ppt`, `game_log[].ppt`, `null_reasons`
- [ ] T-C1 · N/A — `api.js` de C-02
- [ ] T-D1 · `components/shot-detail.js` `renderShotDetail`
- [ ] T-D2 · Reemplazo de `_shotDetailGrid` en Equipo y Jugador
- [ ] T-D3 · Cards Eficiencia/Producción → `ppt`
- [ ] T-D4 · Columna PPT del Buscador → `ppt`
- [ ] T-D5 · Estilos `.shot-detail-table`
- [ ] T-E1 · Estado vacío
- [ ] T-E2 · `sw.js`: `STATIC` + `CACHE`
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `upgrade_db()` N/A
- [ ] T-F3 · Endpoints probados
- [ ] T-F4 · Consola sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 … T-F15 · Verificación por CA

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |
| CA-9 | ⬜ | |
| CA-10 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A previsto)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/metrics.md` — PPT según glosario (`(2·2PM + 3·3PM)/FGA`), `pps` legado, tasas de la sección Tiro pooled
- [ ] `docs/api.md` — `averages.ppt`, `game_log[].ppt`, `totals` sobre la selección, `null_reasons`, `search/players.ppt`
- [ ] `docs/frontend.md` — `renderShotDetail`, copy nuevo, "PPT" = `ppt` en toda la app

## Deuda / TODO
