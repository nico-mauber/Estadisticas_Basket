# Plan — Feature 02: persistir play-by-play

## 1. Enfoque
Nueva tabla `pbp_events` (creada por `db.create_all()` al ser un modelo nuevo) + columna `starter` en `player_game_stats` (vía `upgrade_db()`). Extender `_parse_fiba_json` en `fiba_fetcher.py` para emitir `game["pbp"]` (todos los eventos, no solo tiros) reusando los mapas `tno_to_code`/`shirt_to_name`, y `starter` por jugador. `_persist_game` inserta los pbp con insert-or-ignore por `(game_id, action_number)` (mismo patrón que `shots`) y setea `starter`. Endpoint de verificación `GET /api/pbp/<game_id>`. Re-import de los 4 partidos para poblar. No toca la lógica de `shots` ni el box score.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/database.py` | model | modelo `PbpEvent` + relación cascade en `Game`; columna `starter` en `PlayerGameStats` + `upgrade_db()` | RF-3, RF-4 |
| `backend/fiba_fetcher.py` | service | `game["pbp"]` con todos los eventos normalizados + `clock_secs`; `starter` por jugador | RF-1, RF-2, RF-4 |
| `backend/app.py` | route | persistir pbp + `starter` en `_persist_game`; endpoint `GET /api/pbp/<game_id>` | RF-3, RF-4, RF-5, RF-6 |
| (re-import) | dato | reimportar los 4 partidos para poblar `pbp_events`/`starter` | RF-3, RF-4 |
| `docs/database.md`, `docs/api.md` | doc | tabla nueva, columna nueva, endpoint nuevo | — (cierre) |

## 3. Backend — rutas y modelos
- Tabla `pbp_events`: `id` PK; `game_id` FK→games; `team_code` TEXT; `player_name` TEXT; `period` INT; `period_type` TEXT; `clock_secs` INT; `s1` INT; `s2` INT; `action_type` TEXT; `sub_type` TEXT; `success` INT; `action_number` INT. `UniqueConstraint(game_id, action_number)`. Relación `Game.pbp_events` con `cascade="all, delete-orphan"`.
- Columna `player_game_stats.starter` INTEGER DEFAULT 0 (vía `upgrade_db()`).
- `GET /api/pbp/<game_id>` (login_required): `{ "game_id", "events": int, "by_action_type": {...}, "first": {...}, "last": {...} }`; `404 {"error":"Partido sin play-by-play. Reimportá el partido."}` si 0 eventos.

## 4. Backend — lógica
| Función | Módulo | Detalle | RF |
|---|---|---|---|
| `_gt_to_secs(gt)` | `fiba_fetcher.py` | `"MM:SS"`→`MM*60+SS` (int); vacío/None→0; tolera `"M:SS"` | RF-2 |
| `_parse_fiba_json` (pbp) | `fiba_fetcher.py` | recorre `raw["pbp"]`; por evento: `team_code=tno_to_code.get(tno,"")`, `player_name=shirt_to_name.get((tno,shirt)) or ev.get("player") or ""`, `period`, `period_type=ev.get("periodType")`, `clock_secs=_gt_to_secs(ev.get("gt"))`, `s1/s2=_i`, `action_type`, `sub_type`, `success=_i`, `action_number=_i`. Guarda TODOS los eventos | RF-1, RF-2 |
| `_parse_fiba_json` (starter) | `fiba_fetcher.py` | `player_row["starter"] = int(p.get("starter") or 0)` | RF-4 |
| `_persist_game` (pbp) | `app.py` | loop insert `PbpEvent` con `on_conflict_do_nothing()` por `(game_id, action_number)` | RF-3, RF-6 |
| `_persist_game` (starter) | `app.py` | agregar `starter` a values + on_conflict update de `PlayerGameStats` | RF-4 |
| `game_pbp()` | `app.py` | agrega conteos por `action_type`, first/last por `action_number` | RF-5 |

## 5. Frontend — capa API (api.js)
Sin cambios (esta feature no tiene UI). El endpoint de verificación se prueba por curl/test_client.

## 6. Frontend — UI
Ninguna. (Feature de datos + endpoint de verificación.)

## 7. Navegación
Sin cambios.

## 8. Contratos de datos
Nuevo shape de `GET /api/pbp/<game_id>` (§3). Tabla `pbp_events` + columna `starter`.

## 9. Manejo de errores y offline (sw.js)
Sin cambios de asset. `/api/pbp/*` cae bajo `/api/*` (siempre red).

## 10. Riesgos / decisiones
- **Re-import necesario**: los 4 partidos no tienen pbp hasta reimportar (igual que Feature 06). Se reimporta con los mismos URLs FUBB.
- **Decisión (spec §9):** `clock_secs` = segundos restantes en el período (mapeo directo de `gt`), no tiempo total. Suficiente para clutch (Feature 05).
- **Decisión:** se guardan TODOS los eventos (incluidos `game`/`period` con `tno=0`→`team_code=""`), para trazabilidad; las features de análisis filtran por `action_type`.
- **Idempotencia**: insert-or-ignore por `(game_id, action_number)` → reimportar no duplica (CA-3).
- **Riesgo:** el mismo `action_number` puede repetirse entre partidos distintos pero la unicidad es `(game_id, action_number)`, así que no colisiona.
