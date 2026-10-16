# Progress — C-07: Detalle de tiro completo en equipo y jugador

> **Estado:** ✅ Implementado

## Estado de tareas
- [x] T-A1 · N/A — sin cambio de esquema
- [x] T-B1 · `ppt` en `calc_team_stats`/`calc_player_stats` vía `_safe_div`
- [x] T-B2 · `season_shooting(sums)` pooled: 9 tasas desde totales
- [x] T-B3 · `aggregate_games` usa `season_shooting` + fusiona `null_reasons`
- [x] T-B4 · `ppt` en `TEAM_AVG_KEYS`/`PLAYER_AVG_KEYS` para `league_averages`
- [x] T-B5 · `ppt` en `metric_keys` de `search_players`
- [x] T-B6 · Rutas exponen `ppt`, `game_log[].ppt`, `null_reasons` sin lógica en ruta
- [x] T-C1 · N/A — `api.js` de C-02
- [x] T-D1 · **Desviación:** `_shotDetailGrid` se mantiene inline en `app.js` (no se creó componente separado)
- [x] T-D2 · `_shotDetailGrid` usa `av.ppt` para PPT general
- [x] T-D3 · Cards Eficiencia (Equipo) y Producción ofensiva (Jugador): `PPT` → `av.ppt`/`"ppt"`
- [x] T-D4 · `SEARCH_METRICS` columna PPT → `{ key: "ppt" }`
- [x] T-D5 · Estilos `.shot-detail-table` ya funcionales (existentes de dev)
- [x] T-E1 · Estado vacío manejado por `statBox` + `nullDisplay` existente
- [x] T-E2 · `sw.js`: `CACHE` → `smart-basket-v18` (sin archivo nuevo en `STATIC`)
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · `upgrade_db()` N/A — sin cambio de esquema
- [x] T-F3 · Endpoints probados: team ALB `ppt: 1.0809`, player `ppt: 1.2727`, search `ppt` presente

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | `_shotDetailGrid` muestra T2/T3/TL + 4 PPT en Equipo y Jugador |
| CA-2 | ✅ | `aggregate_games` calcula totales sobre selección; promedio = total/games |
| CA-3 | ✅ | `season_shooting` pooled: `ppt = (2·fgm2+3·fgm3)/fga`, verificado team ALB `ppt=1.0809` = hand calc |
| CA-4 | ✅ | `ppt` excluye FT del numerador; `ppt < pps` cuando TLc > 0 (ALB: 1.0809 < 1.3456) |
| CA-5 | ✅ | `season_shooting` devuelve `None` + `sin_intentos` con denominador 0; `statBox` muestra "—" |
| CA-6 | ✅ | Selección vía `context.filter_games` (C-02); totales sobre selección |
| CA-7 | ✅ | DNP excluido por `population.py` (C-02/C-11) |
| CA-8 | ✅ | "PPT" = `ppt` en card Eficiencia, Producción, `_shotDetailGrid` y Buscador |
| CA-9 | ✅ | `ppt` en `TEAM_AVG_KEYS`/`PLAYER_AVG_KEYS` → `league_averages` → `league.ppt.avg` |
| CA-10 | ⬜ | Pendiente verificación visual en navegador |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente (si aplica): ✅ (N/A — sin cambio de esquema)
- Endpoints probados manualmente: ✅ (team, player, search — ppt presente y correcto)
- Consola del navegador sin errores JS: ⬜ (pendiente verificación)

## Desviaciones respecto a docs/ o plan
- **No se creó `components/shot-detail.js`.** `_shotDetailGrid` se mantiene inline en `app.js` porque `statBox` no está exportado y refactorizarlo requeriría cambios de alcance mayor. La función existente ya cumple RF-1.
- T-D1/T-D2 del plan asumían componente separado — en su lugar se actualizó `_shotDetailGrid` in-place.
- T-E1 (estado vacío) no requirió componente nuevo — `statBox` + `nullDisplay` de C-11 ya maneja denominador 0.

## Docs actualizados
- [x] `docs/metrics.md` — PPT = `(2×FGM2 + 3×FGM3)/FGA`, PPS legado, clave API `ppt`
- [x] `docs/api.md` — `ppt` en lista de tasas nulables, ejemplo search_players con `ppt`
- [x] `docs/frontend.md` — nota C-07 `ppt` vs `pps`, `season_shooting` pooled, `SEARCH_METRICS`

## Deuda / TODO
- Verificación visual completa en navegador pendiente (CA-10)
- `pps` se mantiene en backend por retro-compat (RF-8); retirar cuando T-05 migre
