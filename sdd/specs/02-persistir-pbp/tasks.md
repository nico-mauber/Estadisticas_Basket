# Tasks — Feature 02: persistir play-by-play

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Modelo `PbpEvent` (tabla `pbp_events`, unique `(game_id, action_number)`) + relación cascade en `Game` · `backend/database.py` · cubre RF-3 · Done: `db.create_all()` crea la tabla
- [ ] T-A2 · Columna `starter` (Integer default 0) en `PlayerGameStats` + `upgrade_db()` · `backend/database.py` · cubre RF-4 · Done: columna existe tras `upgrade_db`

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `_gt_to_secs()` + emitir `game["pbp"]` con todos los eventos normalizados en `_parse_fiba_json` · `backend/fiba_fetcher.py` · cubre RF-1, RF-2 · Done: `fetch_game_data` devuelve `pbp` con >500 eventos, cada uno con `clock_secs` int y `team_code`/`player_name` derivados
- [ ] T-B2 · `starter` por jugador en `player_row` · `backend/fiba_fetcher.py` · cubre RF-4 · Done: players con `starter` 0/1 (5 titulares por equipo con 1)
- [ ] T-B3 · Persistir pbp (insert-or-ignore) + `starter` en `_persist_game` · `backend/app.py` · cubre RF-3, RF-4, RF-6 · Done: tras importar, `pbp_events` poblada y `shots` sin cambios
- [ ] T-B4 · Endpoint `GET /api/pbp/<game_id>` (conteos + first/last, 404 si vacío) · `backend/app.py` · cubre RF-5 · Done: `curl /api/pbp/<gid>` devuelve el shape del plan
- [ ] T-B5 · Re-import de los 4 partidos · script one-shot · cubre RF-3, RF-4 · Done: `pbp_events` con >2000 filas totales; `starter` poblado

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `python backend/database.py` ×2 + `upgrade_db` ×2 sin error; columna `starter` existe (idempotente)
- [ ] T-F3 · `GET /api/pbp/<gid>` probado: `events>500`, `by_action_type` con substitution/rebound/assist/steal/block/2pt/3pt/freethrow/turnover; una fila `substitution` con team_code+player_name+sub_type∈{in,out}+clock_secs válido
- [ ] T-F4 · Reimport idempotente: conteo de `pbp_events` de un game_id idéntico antes/después; conteo de `shots` sin cambios
- [ ] T-F5 · Recorrer CA-1 a CA-6 del spec y marcar ✅/❌

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B1, T-B3, T-B4, T-B5, T-F3 |
| CA-2 | T-B1, T-B3, T-F3 |
| CA-3 | T-B3, T-F4 |
| CA-4 | T-A2, T-F2 |
| CA-5 | T-B3, T-F4 |
| CA-6 | T-B2, T-B3, T-B5 |

## Dependencias externas
- Re-import (T-B5) requiere red a FIBA LiveStats; corre DESPUÉS de A1/A2/B1/B2/B3.
