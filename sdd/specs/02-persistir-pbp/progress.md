# Progress — Feature 02: persistir play-by-play

## Estado de tareas
- [x] T-A1 · Modelo `PbpEvent` (tabla `pbp_events`, unique `(game_id, action_number)`) + relación cascade en `Game` · `backend/database.py`
- [x] T-A2 · Columna `starter` en `PlayerGameStats` + `upgrade_db()` · `backend/database.py`
- [x] T-B1 · `_gt_to_secs()` + emisión de `game["pbp"]` (todos los eventos) en `_parse_fiba_json` · `backend/fiba_fetcher.py`
- [x] T-B2 · `starter` por jugador en `player_row` · `backend/fiba_fetcher.py`
- [x] T-B3 · Persistencia de pbp (insert-or-ignore) + `starter` en `_persist_game` · `backend/app.py`
- [x] T-B4 · Endpoint `GET /api/pbp/<game_id>` · `backend/app.py`
- [x] T-B5 · Re-import de los 4 partidos → `pbp_events` (2162 filas) + `starter` (40)
- [x] T-F1 · Backend arranca sin traceback (import de `app` OK, endpoints responden)
- [x] T-F2 · `upgrade_db` idempotente (2 corridas sin error; `pbp_events` + `starter` existen)
- [x] T-F3 · `GET /api/pbp/2741559` probado (577 eventos, todos los action types clave)
- [x] T-F4 · Reimport idempotente verificado; `shots` sin cambios
- [x] T-F5 · CA-1 a CA-6 recorridos

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/pbp/2741559` → `events: 577` (>500); `by_action_type` = {substitution:112, rebound:71, assist:38, steal:19, block:3, 2pt:89, 3pt:48, freethrow:50, turnover:29, ...} — todos presentes |
| CA-2 | ✅ | Fila `substitution` de ejemplo: `team_code='COR'`, `player_name='F. Medina'`, `sub_type='out'`, `clock_secs=341` (0–600 del período 1) |
| CA-3 | ✅ | Idempotencia: `pbp_events` de 2741559 antes=577, después de reimportar=577 (insert-or-ignore por `(game_id, action_number)`) |
| CA-4 | ✅ | `python`+import `app` 2× → `upgrade_db` sin error; columna `player_game_stats.starter` existe |
| CA-5 | ✅ | `shots` = 558 filas antes y después del reimport (esta feature no toca `shots`) |
| CA-6 | ✅ | Titulares: 10 por partido (5×2), 40 en total con `starter=1` |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: ✅ (`ALTER TABLE ADD COLUMN starter` ignora si ya existe; `pbp_events` creada por `create_all`)
- Endpoints probados manualmente: ✅ (`GET /api/pbp/<gid>` 200 + 404 para inexistente)
- Consola del navegador sin errores JS: N/A — esta feature no tiene UI

## Desviaciones respecto a docs/ o plan
- Ninguna. `game["pbp"]` guarda todos los eventos incluidos `game`/`period` (`tno=0` → `team_code=""`), como decidido en spec §9.

## Docs a actualizar
- [x] `docs/database.md` — tabla `pbp_events` + columna `starter`
- [x] `docs/api.md` — endpoint `GET /api/pbp/<game_id>`

## Deuda / TODO
- El motor de reconstrucción de quintetos (consumidor de `pbp_events` + `starter`) es de Features 03/04 — no incluido acá.
- Coordenadas de tiro desde `tm[n].shot` (detectado en la investigación) — fuera de alcance, feature aparte.
