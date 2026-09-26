# Plan — F-11: Panel de calidad de datos

> **ID:** F-11 · **Prioridad:** P1 · **Fase y orden:** 1·02
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)) · **Habilita:** C-09, C-08, C-02, T-05, C-03, T-01, F-13, F-16, A-12, A-01, T-03, F-14
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [Especificación v2](../../00-especificacion-cliente-v2.md) §4 · F-11 · Arquitectura [§3.1, §3.14, §3.21, §4, §5, §6, §7.4, §7.8](../../00-arquitectura-transversal.md)
> **Estimación:** XL · 32–40 h

## 1. Enfoque
F-11 es la pieza de infraestructura de datos de v2. Se hace en cinco capas, en este orden: (1) esquema aditivo (tablas nuevas por `create_all`, columnas nuevas `DEFAULT NULL` por `upgrade_db()`, backfill idempotente de `games.competition_id`); (2) ingesta v2: el parser pasa a ser puro (`fiba_fetcher.parse_game`) y la persistencia sale de `app.py` a `backend/ingest.py` con upsert `do_update` en todas las tablas, archivo gzip del JSON crudo y `INGEST_VERSION = 2`; (3) módulos transversales `cache.py` (versiones `data_version`/`config_version` en `app_meta` + LRU), `repository.py` (resolución de competencia y carga en bloque) y `competitions.py`; (4) `data_quality.py` con chequeos registrables y el reproceso por lotes; (5) UI en pestañas dentro de Importar + migración de los 4 selectores a ids. Se corrige `OVERTIME` en `lineups.py`. `auth.admin_required` se adelanta aquí (I-14). Nada de métricas se persiste.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/database.py` | model | Modelos `Competition`, `CompetitionAlias`, `GameSource`, `AppMeta`; columnas nuevas en `Game`, `TeamGameStats`, `PlayerGameStats`, `Shot`, `PbpEvent`; entradas en `upgrade_db().new_cols`; llamada a backfill | RF-1, RF-2, RF-4, RF-10, RF-11, RF-14 |
| `backend/fiba_fetcher.py` | module | `fetch_raw(url)`, `parse_game(raw, source_url, page_info)`; `fetch_game_data` agrega `_raw`/`_page_info`; ingesta v2 (tiros de `tm[n].shot[]`, minutos, períodos, columnas nuevas, nulos) | RF-11, RF-12 |
| `backend/ingest.py` NUEVO | module | `persist_game`, `archive_raw`, `load_archived`, `reprocess_games`, `INGEST_VERSION` | RF-10, RF-13, RF-14, RF-16, RF-17 |
| `backend/competitions.py` NUEVO | module | alias, alta/edición/fusión, reasignación, backfill, listado | RF-1…RF-5, RF-8 |
| `backend/repository.py` NUEVO | module | `resolve_competition`, `competition_games`, `team_game_rows`, `player_game_rows`, `game_events`, `team_pbp_games` | RF-6, RF-7, RF-27, RF-28 |
| `backend/cache.py` NUEVO | module | `get_versions`, `bump_data_version`, `bump_config_version`, `memo`, `clear` | RF-18 |
| `backend/data_quality.py` NUEVO | module | `quality_report`, `register_check`, 7 chequeos + `possession_gaps` no disponible | RF-19…RF-25 |
| `backend/auth.py` | module | `admin_required`, `is_admin`, `_admin_users` | RF-29 |
| `backend/test_auth.py` | test (existente, asserts planos) | escenarios admin (con/sin `ADMIN_USERS`, modo abierto) | RF-29 |
| `backend/lineups.py` | module | `PERIOD_TYPES`, `PERIOD_LEN` con `OVERTIME` | RF-15, RF-24 |
| `backend/app.py` | route | rutas finas: import (delegar a `ingest`), games GET/DELETE/PATCH, teams, competitions ×4, data-quality, reprocess, me; `league_overview` resuelve competencia por `repository`; `_team_pbp_games` delega en `repository.team_pbp_games`; se elimina `_persist_game` | RF-3, RF-5…RF-9, RF-16…RF-19, RF-26…RF-29 |
| `frontend/js/api.js` | js-api | métodos nuevos/tocados (§5) | RF-5, RF-8, RF-16, RF-19, RF-27 |
| `frontend/js/components/data-quality.js` NUEVO | js-component | `renderDataQuality(el, report, {isAdmin, onReprocess, onPublish})` | RF-19…RF-26 |
| `frontend/js/components/competitions-admin.js` NUEVO | js-component | `renderCompetitionsAdmin(el, comps, {isAdmin, onChange})` | RF-5, RF-6, RF-8 |
| `frontend/js/components/reprocess-runner.js` NUEVO | js-component | `runReprocess({gameIds} \| {competitionId}, {onProgress})` (encadena lotes) | RF-16, RF-17 |
| `frontend/js/app.js` | js-view | `renderImport` con pestañas Importar · Partidos · Calidad · Competencias; catálogo con filtro y badges; selectores de Liga/Equipo/Comparar/Jugador por id; `_isAdmin` desde `/api/me` | RF-9, RF-19, RF-26, RF-27, RF-29 |
| `frontend/css/style.css` | css | sección `/* ── data-quality (F-11) ── */`: tabs internas, cards de chequeo, badges de estado, barra de progreso | RF-19, RF-27 |
| `frontend/sw.js` | cache | agregar los 3 componentes a `STATIC`, subir `CACHE` al siguiente entero | — |
| `docs/database.md` | doc | tablas y columnas nuevas, `period_type` REGULAR/OVERTIME, `games.minutes` escrito, upsert do_update | cierre |
| `docs/api.md` | doc | endpoints nuevos/modificados, shape de `/api/competitions` | cierre |
| `docs/architecture.md` | doc | módulos `ingest`, `competitions`, `repository`, `cache`, `data_quality`; "FIBA sí expone coordenadas" (D-06) | cierre |
| `docs/frontend.md` | doc | pestañas de Importar, copy nuevo, selectores por id, componentes nuevos | cierre |
| `docs/deployment.md` | doc | `ADMIN_USERS`; comando real `gunicorn app:app --timeout 180` (D-20); tamaño del archivo crudo | cierre |
| `docs/metrics.md` | doc | §Pace: MIN = minutos reales del partido (40 + 5 × prórrogas) | cierre |

Matriz RF → archivo: RF-1/2/4 → database, competitions · RF-3 → ingest, competitions · RF-5 → competitions, app, competitions-admin · RF-6/7 → repository, competitions, app · RF-8 → competitions, app, api · RF-9 → app.js, api · RF-10 → ingest, database · RF-11/12 → fiba_fetcher, database · RF-13/14 → ingest · RF-15 → lineups · RF-16/17 → ingest, app, reprocess-runner · RF-18 → cache, ingest, competitions, app · RF-19…25 → data_quality, app, data-quality.js · RF-26 → data-quality.js, competitions · RF-27 → app (games), repository, app.js · RF-28 → app (teams), repository · RF-29 → auth, test_auth, app, app.js.

## 3. Backend — rutas y modelos

### 3.1 Esquema (todo aditivo; Constitución 5)

**Tablas nuevas (modelo + `db.create_all()`):**

| Tabla | Columnas | Constraints |
|---|---|---|
| `competitions` | `id` INTEGER PK autoincrement · `name` TEXT NOT NULL · `season` TEXT NULL · `status` TEXT NOT NULL DEFAULT 'publicada' · `is_default` INTEGER DEFAULT 0 · `created_at` TEXT · `updated_at` TEXT | `UNIQUE(name, season)` (nota: SQLite trata NULL como distinto en UNIQUE → `competitions.create_competition` verifica duplicado con `season IS NULL` en código) |
| `competition_aliases` | `source_name` TEXT PK · `competition_id` INTEGER NOT NULL FK → `competitions.id` | — |
| `game_sources` | `game_id` TEXT PK FK → `games.game_id` · `fetched_at` TEXT · `raw_gz` BLOB · `page_info` TEXT (JSON) · `parser_version` INTEGER | relación `Game.source` con `cascade="all, delete-orphan"` (borrar partido borra su archivo) |
| `app_meta` | `key` TEXT PK · `value` TEXT | filas `data_version`, `config_version` (se crean con valor "0" si faltan) |

**Columnas nuevas (modelo + `upgrade_db().new_cols`, `DEFAULT NULL` — sin cláusula DEFAULT en el ALTER):**

| Tabla | Columna | Tipo | Fuente FIBA |
|---|---|---|---|
| `games` | `competition_id` | INTEGER | alias de `games.competition` |
| `games` | `source_url` | TEXT | URL importada |
| `team_game_stats` | `blk_received` | INTEGER | `tot_sBlocksReceived` |
| `team_game_stats` | `fouls_drawn` | INTEGER | `tot_sFoulsOn` |
| `team_game_stats` | `team_orb` / `team_drb` | INTEGER | `tot_sReboundsTeamOffensive` / `tot_sReboundsTeamDefensive` |
| `team_game_stats` | `team_tov` | INTEGER | `tot_sTurnoversTeam` |
| `team_game_stats` | `period_pts` | TEXT (JSON lista) | pbp (`s1`/`s2` al cierre de cada período) o `p1_score…p4_score`, `ot_score` |
| `team_game_stats` | `ingest_version` | INTEGER | `INGEST_VERSION` |
| `player_game_stats` | `blk_received`, `fouls_drawn`, `paint_pts`, `second_chance_pts`, `fast_break_pts` | INTEGER | `sBlocksReceived`, `sFoulsOn`, `sPointsInThePaint`, `sPointsSecondChance`, `sPointsFastBreak` |
| `player_game_stats` | `first_name`, `family_name`, `photo_url` | TEXT | `firstName`/`internationalFirstName`, `familyName`/`internationalFamilyName`, `photoT` o `photoS` |
| `shots` | `court_x`, `court_y` | REAL | `tm[n].shot[k].x`, `.y` (0–100, cancha completa) |
| `pbp_events` | `previous_action` | INTEGER | `previousAction` |
| `pbp_events` | `qualifiers` | TEXT | `qualifier[]` ordenado, unido por `,` |

Restricciones únicas existentes intactas. `games.minutes` (existe, DEFAULT 40) pasa a escribirse.

**Backfill** (llamado al final de `upgrade_db()`, dentro de `app_context`): `competitions.backfill_competition_ids()` — solo `WHERE competition_id IS NULL`; idempotente. `cache` asegura las filas de `app_meta`.

### 3.2 Endpoints

Todos `login_required`; **A** = además `admin_required`. Errores con §7.8: `{"error": "<mensaje>", "code": "<codigo>", "details": {}}`.

**POST `/api/import`** (mod.) — body `{url}` sin cambios. Flujo: `fetch_game_data(url)` → `ingest.persist_game(game, source_url=url)` → `cache.bump_data_version("import")`.
```json
{"ok": true, "game_id": "2849328", "teams": [{"code": "CNF", "name": "Nacional"}, {"code": "PEN", "name": "Peñarol"}],
 "competition_id": 1, "competition_label": "Liga Uruguaya de Basquetbol 2025/2026"}
```
Errores: 400 `parametro_invalido` "Se requiere campo 'url'" (existente) / mensaje de `ValueError` (existente); 502 `fiba_no_disponible` "No se pudo obtener datos de FIBA LiveStats. Verifica la URL." (existente).

**GET `/api/games`** (mod.) — query `competition` opcional (id, `all` o texto legado; sin parámetro = todas, comportamiento actual). Orden actual (fecha desc, `imported_at` desc).
```json
[{"id": 1, "game_id": "2849328", "competition": "Liga Uruguaya de Basquetbol 2025/2026", "date": "2025-10-03",
  "home_team": "Nacional", "home_code": "CNF", "away_team": "Peñarol", "away_code": "PEN",
  "home_score": 81, "away_score": 77, "minutes": 40, "imported_at": "2026-09-01T12:00:00",
  "competition_id": 1, "competition_label": "Liga Uruguaya de Basquetbol 2025/2026", "competition_status": "publicada",
  "source_url": "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849328/",
  "has_pbp": true, "has_coords": true, "needs_reprocess": false}]
```
`has_pbp` = existe ≥ 1 fila en `pbp_events`; `has_coords` = existe ≥ 1 tiro con `court_x IS NOT NULL`; `needs_reprocess` = algún `team_game_stats.ingest_version` nulo o < `INGEST_VERSION`. Se calculan con 3 consultas agregadas por lote (no por fila). `competition_status` es PROPUESTA (no está en 00-arquitectura-transversal.md): la UI de Partidos lo necesita para marcar partidos de competencias en borrador. Error: 400 `competencia_inexistente` "La competencia no existe."

**DELETE `/api/games`** (mod.) **A** — igual que hoy + `cache.bump_data_version("delete")`. La cascada ORM incluye `game_sources`. 403 `requiere_admin` "Tu usuario no tiene permiso para esta acción."

**PATCH `/api/games/<game_id>`** NUEVO **A** — body `{"competition_id": 3}` → `competitions.assign_game` → bump → devuelve la fila como en GET `/api/games`. Errores: 400 `parametro_invalido` "Se requiere competition_id entero."; 404 `no_encontrado` "Partido no encontrado."; 400 `competencia_inexistente`.

**GET `/api/teams`** (mod.) — query `competition` opcional. `[{"code": "CNF", "name": "Nacional", "games": 7, "competition_id": 1}]` (`competition_id` = la pedida o `null` si no se filtró). Sin parámetro: comportamiento actual (todas).

**GET `/api/competitions`** (mod., **cambio de shape**) — query `include_hidden=1` (PROPUESTA (no está en 00-arquitectura-transversal.md): la sección Datos necesita ver las `borrador`; sin el parámetro se excluyen `borrador` y las `archivada` van al final).
```json
[{"id": 1, "name": "Liga Uruguaya de Basquetbol", "season": "2025/2026", "label": "Liga Uruguaya de Basquetbol 2025/2026",
  "status": "publicada", "is_default": false, "games": 13, "teams": 12,
  "first_date": "2025-10-03", "last_date": "2025-11-14", "aliases": ["Liga Uruguaya de Basquetbol 2025/2026"]}]
```
Orden: publicadas por `last_date` desc, luego borrador (si se incluyen), luego archivadas. `aliases` es PROPUESTA (útil para verificar fusiones en la pestaña Competencias).

**POST `/api/competitions`** NUEVO **A** — body `{"name": "Liga de Ascenso", "season": "2026"}` → 201 con el objeto. Errores: 400 `parametro_invalido` "El nombre es obligatorio."; 409 `conflicto` "Ya existe una competencia con ese nombre y temporada."

**PATCH `/api/competitions/<int:comp_id>`** NUEVO **A** — body parcial `{name?, season?, status?, is_default?}`. `status` ∈ {publicada, borrador, archivada}; `is_default: true` desmarca la anterior. Devuelve el objeto. Errores: 400 `parametro_invalido` "Estado inválido."; 404 `no_encontrado` "Competencia no encontrada."; 409 `conflicto`.

**POST `/api/competitions/<int:comp_id>/merge`** NUEVO **A** — body `{"source_id": 2}` → mueve partidos y alias de 2 a `comp_id`, borra 2 → `{"ok": true, "target": {…objeto…}, "moved_games": 4, "moved_aliases": 1}`. Errores: 404; 409 `conflicto` "No se puede fusionar una competencia consigo misma."

**GET `/api/data-quality`** NUEVO — query `competition=<id>` (obligatorio en la práctica; sin él se resuelve con `repository.resolve_competition`; `all` → 400 `parametro_invalido` "Elegí una competencia.").
```json
{
  "competition": {"id": 1, "label": "Liga Uruguaya de Basquetbol 2025/2026", "status": "borrador"},
  "summary": {"games": 13, "incomplete_games": 1, "incomplete_ids": ["2849340"], "ready_to_publish": false,
              "ingest_version": 2, "data_version": 42},
  "checks": {
    "games_without_pbp":        {"status": "alerta", "count": 1, "counts_as_incomplete": true,
                                 "items": [{"game_id": "2849340", "date": "2025-10-10", "label": "Nacional 81 – 77 Peñarol"}]},
    "games_without_coords":     {"status": "ok", "count": 0, "counts_as_incomplete": false, "items": []},
    "games_needing_reprocess":  {"status": "ok", "count": 0, "counts_as_incomplete": true, "items": []},
    "null_fields":              {"status": "alerta", "count": 2, "counts_as_incomplete": false,
                                 "items": [{"table": "player_game_stats", "field": "photo_url", "label": "Foto del jugador",
                                            "nulls": 61, "total": 312, "pct": 0.1955, "reason": "no_registrado"}]},
    "possible_duplicates":      {"status": "alerta", "count": 1, "counts_as_incomplete": false,
                                 "items": [{"team_code": "CNF", "norm_key": "juan perez", "kind": "grafia",
                                            "variants": [{"player_name": "Juan Pérez", "games": 5}, {"player_name": "juan  perez", "games": 1}]}]},
    "lineup_inconsistencies":   {"status": "ok", "count": 0, "counts_as_incomplete": true, "items": []},
    "pbp_box_mismatch":         {"status": "ok", "count": 0, "counts_as_incomplete": true, "items": []},
    "possession_gaps":          {"status": "no_disponible", "count": null, "counts_as_incomplete": false,
                                 "reason": "requiere_posesiones", "items": []}
  }
}
```
`summary` y `counts_as_incomplete` son PROPUESTA (no está en 00-arquitectura-transversal.md): la arquitectura fija `{competition, checks}`; el resumen es imprescindible para el CA del cliente (una pantalla, "no hay partidos incompletos"). Se agregan sin alterar las claves fijadas. Errores: 400 `competencia_inexistente`.

**POST `/api/reprocess`** NUEVO **A** — body `{"game_ids": ["2849328"]}` o `{"competition_id": 1, "offset": 0}`; opcional `"mode": "archivo" | "fiba"` (default `archivo`; PROPUESTA de exponer el `mode` que la firma de `ingest.reprocess_games` ya tiene). Lote máximo: 20 en modo archivo, **5** cuando algún partido del lote requiere FIBA (ver §10 R-2).
```json
{"processed": 20, "failed": [{"game_id": "2849340", "reason": "fiba_no_disponible", "error": "No se pudo obtener datos de FIBA LiveStats."}],
 "next_offset": 20, "total": 33, "data_version": 43}
```
`next_offset: null` al terminar. `total` es PROPUESTA (barra de progreso). Con `game_ids` > 20 → 400 `parametro_invalido` "Máximo 20 partidos por llamada." Un fallo de un partido no aborta el lote (rollback de ese partido y sigue).

**GET `/api/me`** (mod.) — agrega `"is_admin": true|false`.

**GET `/api/league`** (mod. mínima) — el parámetro `competition` pasa por `repository.resolve_competition` (id, `all` o texto legado). Sin parámetro: todas (comportamiento actual, compatibilidad; C-02/T-01 cambian el default después). El filtrado pasa de `Game.competition == texto` a `Game.competition_id == id`.

## 4. Backend — lógica

### 4.1 `backend/fiba_fetcher.py` (mod.)

| Función | Firma | Detalle |
|---|---|---|
| `fetch_raw` | `fetch_raw(url: str) -> tuple[dict, dict]` | `_data_url` → `_fetch_direct` (fallback Playwright igual que hoy) → `_validate_raw`; `page_info = _fetch_page_info(url)` solo si `url` es una página `bs.html`/carpeta de partido. Devuelve `(raw, page_info)` |
| `parse_game` | `parse_game(raw: dict, source_url: str, page_info: dict) -> dict` | parser puro (sin red): cuerpo actual de `_parse_fiba_json` + ingesta v2 (abajo) + completa `date`/`competition` desde `page_info` si faltan; llama `_validate_game` |
| `fetch_game_data` | firma sin cambio | `raw, info = fetch_raw(url)`; `game = parse_game(raw, url, info)`; `game["_raw"] = raw; game["_page_info"] = info` |
| `_parse_fiba_json` | se conserva como alias de `parse_game(raw, source_url, {})` (compatibilidad) | — |
| `_opt_int` NUEVO (privado) | `_opt_int(d: dict, keys: list[str]) -> int \| None` | primera clave presente y convertible → int; ninguna presente → `None` (0 informado → 0) — RF-12 |

Ingesta v2 dentro de `parse_game`:
1. **Equipo** (por cada `tm[k]`): `blk_received = _opt_int(t, ["tot_sBlocksReceived"])`, `fouls_drawn = _opt_int(t, ["tot_sFoulsOn"])`, `team_orb/team_drb/team_tov` desde `tot_sReboundsTeamOffensive/Defensive`, `tot_sTurnoversTeam`. Las columnas existentes conservan su conversión actual (0 si falta) — no se cambia la semántica de columnas `DEFAULT 0` existentes.
2. **Minutos**: `team_minutes = _parse_minutes(t["tot_sMinutes"])` si existe ("225:00" → 225) → `game_minutes = round(team_minutes / 5)`; si no, `40 + 5 × #{períodos distintos con periodType == "OVERTIME"}` del pbp; si no hay pbp, 40. `game["minutes"] = game_minutes`.
3. **Puntos por período**: si hay pbp: para cada período en orden (REGULAR 1..4, luego OVERTIME 1..n) tomar `s1`/`s2` del último evento del período y restar el acumulado anterior → listas para local (`s1`) y visitante (`s2`); si no hay pbp: `[p1_score, p2_score, p3_score, p4_score] + ([ot_score] si > 0)`; si faltan todos → `None`. Se serializa como JSON (`"[20, 18, 22, 21]"`).
4. **Jugador**: `blk_received`, `fouls_drawn`, `paint_pts`, `second_chance_pts`, `fast_break_pts` con `_opt_int` sobre `sBlocksReceived`, `sFoulsOn`, `sPointsInThePaint`, `sPointsSecondChance`, `sPointsFastBreak`; `first_name = p.get("firstName") or p.get("internationalFirstName") or None`, `family_name` análogo; `photo_url = p.get("photoT") or p.get("photoS") or None`. `player_name` **no cambia** de fuente (clave única).
5. **Tiros**: reemplazar la lectura de `raw.get("shot")` por la iteración de `t.get("shot") or []` de cada equipo `tm[k]` (el equipo lo da la clave `k`, no `tno`); por tiro: `court_x = float(shot["x"])`, `court_y = float(shot["y"])` si existen (si no, `None`); `x = y = 0.0` (legado, C-03 decide su uso — DA-32); `made = shot["r"]`, `period = shot["per"]`, `action_number = shot["actionNumber"]`, `action_type`, `sub_type`; jugador por `(tno, shirtNumber)` como hoy. Si ningún equipo trae `shot[]`, fallback actual al pbp con `court_x = court_y = None`.
6. **Eventos pbp**: agregar `previous_action = _opt_int(ev, ["previousAction"])` y `qualifiers = ",".join(sorted(ev["qualifier"]))` si es lista no vacía, `""` si lista vacía (dato informado: sin calificadores) y `None` si la clave falta.
7. `period_type` se guarda tal cual lo manda FIBA (`REGULAR`/`OVERTIME`); no se normaliza a `OT`.

### 4.2 `backend/ingest.py` NUEVO

```
INGEST_VERSION: int = 2

persist_game(game: dict, *, source_url: str) -> list[dict]
  1. comp_id = competitions.ensure_competition_for_source(game["competition"] or "")   # "" → alias "(sin competencia)"
  2. upsert games: valores actuales + minutes, source_url;
     on_conflict_do_update: set_ = campos actuales + minutes + source_url
                                   + competition_id = COALESCE(games.competition_id, excluded.competition_id)   # RF-5: la reasignación manual sobrevive
  3. upsert team_game_stats (set_ incluye columnas nuevas + period_pts + ingest_version = INGEST_VERSION)
  4. upsert player_game_stats (set_ incluye columnas nuevas)
  5. shots: executemany sqlite_insert(Shot).on_conflict_do_update(index_elements=[game_id, action_number],
            set_={team_code, player_name, x, y, court_x, court_y, made, action_type, sub_type, period})
  6. pbp_events: executemany on_conflict_do_update(index_elements=[game_id, action_number], set_=todas las columnas no clave)
  7. si "_raw" in game: archive_raw(game_id, game["_raw"], game.get("_page_info") or {})
  8. commit; return [{code, name}] (igual que hoy) — el caller agrega competition_id/label a la respuesta
  (no sube data_version: lo hace el caller una vez por request/lote)

archive_raw(game_id: str, raw: dict, page_info: dict) -> None
  raw_gz = gzip.compress(json.dumps(raw, separators=(",", ":")).encode("utf-8"), compresslevel=6)
  upsert game_sources(game_id, fetched_at=utcnow iso, raw_gz, page_info=json.dumps(page_info), parser_version=INGEST_VERSION)

load_archived(game_id: str) -> tuple[dict, dict] | None
  fila = GameSource.get(game_id); None si no existe → (json.loads(gzip.decompress(raw_gz)), json.loads(page_info or "{}"))

reprocess_games(game_ids: list[str], *, mode: str = "archivo") -> dict
  if len(game_ids) > 20: ValueError
  processed, failed = 0, []
  for gid in game_ids:
    try:
      arch = load_archived(gid) if mode == "archivo" else None
      if arch:
        raw, info = arch
        url = Game.source_url or ""
      else:
        url = Game.source_url or f"{_ALLOWED_BASE}/u/FUBB/{gid}/"   # ver §10 R-3
        raw, info = fiba_fetcher.fetch_raw(url)
      info = {**{"date": g.date, "competition": g.competition}, **{k: v for k, v in info.items() if v}}  # no pisar con vacío
      game = fiba_fetcher.parse_game(raw, url, info); game["_raw"] = raw; game["_page_info"] = info
      persist_game(game, source_url=url); processed += 1
    except Exception as e:
      db.session.rollback(); failed.append({game_id, reason: "fiba_no_disponible" | "esquema_fiba" | "error", error: str(e)})
  return {processed, failed}
```
- El `game_id` del parser sale de `_extract_game_id(source_url)`; si el reproceso desde archivo no tiene URL, se fuerza `game["game_id"] = gid` antes de persistir.
- La competencia **no se recalcula** en reproceso para partidos con `competition_id` (COALESCE).

### 4.3 `backend/competitions.py` NUEVO

| Función | Algoritmo |
|---|---|
| `_split_season(source: str) -> tuple[str, str \| None]` (privada) | `m = re.search(r"(\d{4}(?:\s*[/-]\s*\d{2,4})?)\s*$", s)`; si hay match y queda nombre no vacío: `name = s[:m.start()].strip(" -–·")`, `season = re.sub(r"\s+", "", m.group(1))`; si no, `(s.strip(), None)`. "" → ("(sin competencia)", None) |
| `ensure_competition_for_source(source_name: str) -> int` | busca alias exacto (`strip`, espacios colapsados); si existe → id; si no: `(name, season) = _split_season`; busca competencia con ese par (NULL-safe); si no existe la crea con `status = "publicada"` (DA-13); crea alias; flush; devuelve id |
| `list_competitions(*, include_hidden: bool = False) -> list[dict]` | una consulta agregada: `games` agrupados por `competition_id` (count, min/max date) + equipos distintos (`team_game_stats` join `games`) + alias; arma `label = f"{name} {season}".strip()`; filtra/ordena según RF-6 |
| `create_competition(name: str, season: str \| None) -> dict` | valida nombre no vacío; duplicado NULL-safe → `ConflictError`; inserta; `bump_data_version("competition")` |
| `update_competition(comp_id: int, **fields) -> dict` | valida `status`; si `is_default` true → `UPDATE competitions SET is_default = 0`; unicidad; `updated_at`; bump |
| `merge_competitions(target_id: int, source_id: int) -> dict` | `target_id == source_id` → `ConflictError`; `UPDATE games SET competition_id = target WHERE competition_id = source`; `UPDATE competition_aliases SET competition_id = target WHERE competition_id = source`; si la origen era default y la destino no, hereda; `DELETE` origen; bump; devuelve conteos |
| `assign_game(game_id: str, comp_id: int) -> None` | valida existencia de ambos; `UPDATE games SET competition_id`; bump |
| `backfill_competition_ids() -> int` | `SELECT DISTINCT competition FROM games WHERE competition_id IS NULL`; por cada texto `ensure_competition_for_source` y `UPDATE games SET competition_id = ? WHERE competition_id IS NULL AND competition IS ?`; devuelve filas actualizadas (0 en la segunda corrida) |

Excepciones de dominio (`CompetitionError`, `ConflictError`, `NotFoundError`) que las rutas mapean a 400/409/404.

### 4.4 `backend/repository.py` NUEVO

```
resolve_competition(param: str | None, *, team_code: str | None = None, player_name: str | None = None,
                    include_hidden: bool = False) -> dict
  # → {"id": int | None, "all": bool, "label": str | None, "source": "param" | "alias" | "entidad" | "config" | "ultima"}
  1. param numérico → competencia por id (404→CompetitionNotFound); si status == "borrador" y not include_hidden → CompetitionNotFound
  2. param == "all" → {"id": None, "all": True}
  3. param texto → alias → id (si no hay alias: CompetitionNotFound)
  4. sin param y entidad (team_code / player_name) → competencia publicada del partido más reciente de la entidad
  5. config.get("ui.default_competition_id") si F-13 ya existe (import protegido: try/except ImportError → None)
  6. competencia publicada con el partido más reciente; si no hay ninguna → {"id": None, "all": False}
  # Nota: los endpoints legado que hoy tratan "sin parámetro" como "todas" (league, games, teams) conservan
  # ese comportamiento llamando resolve_competition solo si llega el parámetro (compatibilidad; C-02 migra).

competition_games(comp_id: int) -> list[dict]                  # memo("repo:games", (comp_id,)): filas de games como dict
team_game_rows(comp_id: int) -> dict[tuple[str, str], dict]    # memo: {(game_id, team_code): fila team_game_stats} — elimina N+1 de _opp_for
player_game_rows(comp_id: int) -> list[dict]                   # memo
game_events(game_id: str) -> list[dict]                        # memo("repo:events"): pbp ordenado por action_number
team_pbp_games(team_code: str, comp_id: int | None) -> list[dict]
  # mismo shape que app._team_pbp_games + "competition_id"; comp_id None = todas (compatibilidad de lineups/onoff/clutch)
  # carga en bloque: games del equipo (1 consulta), eventos por IN(game_ids) (1 consulta), player rows por IN (1 consulta)
```
`app._team_pbp_games(team_code)` pasa a `return repository.team_pbp_games(team_code, None)` (sin cambio de resultados).

### 4.5 `backend/cache.py` NUEVO

```
get_versions() -> tuple[int, int]      # (data_version, config_version); 1 SELECT por request, memorizado en flask.g; fuera de request → consulta directa
bump_data_version(reason: str) -> int  # UPDATE app_meta SET value = value + 1 WHERE key = 'data_version'; commit; limpia flask.g; log info(reason)
bump_config_version() -> int           # ídem config_version (lo usa F-13)
memo(namespace: str, key: tuple, fn: Callable[[], T], *, max_entries: int = 64) -> T
  # dict por namespace de OrderedDict; clave completa = (data_version, config_version) + key; hit → move_to_end; miss → fn(),
  # insertar, si len > max_entries → popitem(last=False). Thread-safe con threading.Lock (DA-28 hilos).
clear(namespace: str | None = None) -> None
```
Correcto con N workers: cada proceso lee las versiones de `app_meta` en cada request, y como la clave incluye las versiones, un bump en otro worker hace que las entradas viejas no se vuelvan a usar (se descartan por LRU).

### 4.6 `backend/data_quality.py` NUEVO

```
_CHECKS: dict[str, Callable[[int], dict]] = {}     # orden de inserción = orden de presentación
register_check(name: str, fn: Callable[[int], dict]) -> None    # A-01 reemplaza "possession_gaps"
quality_report(comp_id: int) -> dict                             # memo("dq", (comp_id,)); shape §3.2
  games = repository.competition_games(comp_id)
  checks = {name: fn(comp_id) for name, fn in _CHECKS.items()}
  incomplete = ∪ items[*].game_id de checks con counts_as_incomplete y status == "alerta"
             ∪ partidos sin 2 filas en team_game_stats o sin player_game_stats o sin date
  summary = {games: len(games), incomplete_games, incomplete_ids, ready_to_publish: incomplete_games == 0, ...}
```

Chequeos (cada uno devuelve `{status, count, counts_as_incomplete, items}`; `status = "alerta"` si `count > 0`, si no `"ok"`):

| Chequeo | Algoritmo | Incompleto |
|---|---|---|
| `games_without_pbp` | `games` de la competencia `LEFT JOIN (SELECT game_id, COUNT(*) FROM pbp_events GROUP BY game_id)` con conteo 0/NULL | sí |
| `games_without_coords` | partidos con ≥ 1 tiro y 0 tiros con `court_x IS NOT NULL`, más partidos sin tiros | no (advertencia) |
| `games_needing_reprocess` | `team_game_stats` con `ingest_version IS NULL OR < INGEST_VERSION`, o sin fila en `game_sources` | sí |
| `null_fields` | para una lista fija `NULL_FIELDS = [(tabla, campo, etiqueta)]` — `games.date` (NULL o ''), `player_game_stats.position` ('' o NULL), `team_game_stats.{blk_received, fouls_drawn, team_orb, team_drb, team_tov, period_pts}`, `player_game_stats.{blk_received, fouls_drawn, paint_pts, second_chance_pts, fast_break_pts, first_name, family_name, photo_url}`, `shots.court_x`, `pbp_events.{previous_action, qualifiers}` — `SUM(CASE WHEN campo IS NULL THEN 1 ELSE 0 END)`, `COUNT(*)` restringido a la competencia; ítem por campo con `nulls > 0`; `reason` = `no_registrado`. `previous_action` se cuenta solo sobre eventos cuyo tipo lo tiene en FIBA (`assist`, `rebound`, `steal`, `block`, `foulon`) para no inflar | no |
| `possible_duplicates` | `player_game_stats` de la competencia agrupado por `(team_code, norm_name(player_name))`: grupos con > 1 grafía cruda → `kind: "grafia"`; mismo grupo con > 1 `(first_name, family_name)` no nulos distintos o > 1 `photo_url` no nula distinta → `kind: "sobre_fusion"`; grupos de distinto `norm_key` con igual `norm_name(family_name)` + misma inicial de nombre → `kind: "abreviatura"`. `norm_name` desde `stats_engine` (de `dev`) — C-08 lo moverá a `identity` con re-export | no |
| `lineup_inconsistencies` | por partido con pbp y cada equipo: `starters = lineups.game_starters(rows, team)`; `len != 5` → ítem `motivo: "titulares"`; `segs = lineups.build_segments(events, team, starters)`; algún `len(on_court) != 5` → `motivo: "quinteto_incompleto"`; `abs(Σ seconds − 60·games.minutes) > 1` → `motivo: "segundos"` con ambos valores | sí |
| `pbp_box_mismatch` | por equipo-partido con pbp: `pts_pbp = Σ(2 si 2pt éxito, 3 si 3pt éxito, 1 si freethrow éxito)`, `fga_pbp = #2pt + #3pt`, `fta_pbp = #freethrow` del equipo; comparar con `team_game_stats.pts/fga/fta`; diferencia ≠ 0 en alguno → ítem con `{game_id, team_code, box: {pts, fga, fta}, pbp: {…}}` | sí |
| `possession_gaps` | `{status: "no_disponible", count: None, reason: "requiere_posesiones", counts_as_incomplete: False, items: []}` — INCREMENTO DIFERIDO (→ A-01) | no |

Costo: 13 partidos → < 1 s; competencia de ~200 partidos: `lineup_inconsistencies` reconstruye segmentos (≈ 5 ms/partido/equipo) ≈ 2 s en frío, luego cacheado por `data_version`.

### 4.7 `backend/auth.py` (mod.)

```
_admin_users() -> set[str] | None     # os.environ.get("ADMIN_USERS"): split(","), strip, sin vacíos; None si la variable no está o queda vacía
is_admin() -> bool
  if not auth_enabled(): return True                       # modo abierto (local)
  if "user" not in session: return False
  admins = _admin_users(); return admins is None or session["user"] in admins
admin_required(fn)                                         # @wraps; 401 {"error": "No autenticado"} si auth y sin sesión;
                                                           # 403 {"error": "Tu usuario no tiene permiso para esta acción.", "code": "requiere_admin"} si not is_admin()
```
Uso: `@login_required` + `@admin_required` (este último ya chequea sesión; el orden no cambia el resultado). `test_auth.py`: casos (a) modo abierto → admin; (b) auth sin `ADMIN_USERS` → usuario logueado admin; (c) auth con `ADMIN_USERS="ana"` → "ana" admin, "beto" no; (d) sin sesión → no admin.

### 4.8 `backend/lineups.py` (mod.)

`PERIOD_TYPES = ("REGULAR", "OVERTIME")`; `PERIOD_LEN = {"REGULAR": 600, "OVERTIME": 300, "OT": 300}` (se conserva `"OT"` por compatibilidad con cualquier dato viejo). `build_segments` ya usa `PERIOD_LEN.get(ev.get("period_type"), 600)` (l.107): con la clave nueva la prórroga suma 300 s. Verificación: la suma de segundos de un partido con prórroga pasa de 3000 (bug) a 2700.

### 4.9 `backend/app.py` (mod.)

- Import de `ingest`, `competitions`, `repository`, `cache`, `data_quality`, `admin_required`, `is_admin`.
- `import_game` y `seed_games`: `ingest.persist_game(game, source_url=url)` + un `cache.bump_data_version(...)` al final (seed: uno solo al final del lote). Se elimina `_persist_game`.
- Mapeo de excepciones de dominio a §7.8 con un helper `_err(msg, code, status, details=None)` (solo formatea: sin lógica de negocio).
- `list_games`: `repository.resolve_competition` si viene `competition`; los flags `has_pbp/has_coords/needs_reprocess` los calcula una función `data_quality.game_flags(game_ids) -> dict[str, dict]` (PROPUESTA de helper público en `data_quality`, 3 consultas agregadas).
- `league_overview`: filtrar por `competition_id` resuelto (sin cambios en el cálculo).

## 5. Frontend — capa API (`api.js`)

| Método | Endpoint |
|---|---|
| `games(params = {})` (mod.) | GET `/api/games` + `qs({competition})` |
| `teams(params = {})` (mod.) | GET `/api/teams` + `qs({competition})` |
| `competitions({includeHidden} = {})` (mod.) | GET `/api/competitions` (+ `?include_hidden=1`) — devuelve objetos |
| `createCompetition(body)` | POST `/api/competitions` |
| `updateCompetition(id, patch)` | PATCH `/api/competitions/${id}` |
| `mergeCompetitions(targetId, sourceId)` | POST `/api/competitions/${targetId}/merge` |
| `assignGame(gameId, competitionId)` | PATCH `/api/games/${gameId}` |
| `dataQuality(comp)` | GET `/api/data-quality?competition=${comp}` |
| `reprocess(body)` | POST `/api/reprocess` |
| `league(comp)` (sin cambio de firma) | ahora recibe id |

Todos con JSON y `credentials: "same-origin"` (vía `apiFetch`). `qs(params)` es de T-05 (§8 arquitectura); como F-11 va antes, se agrega aquí una versión mínima privada `_qs` (omite `null`/`undefined`/`""`) que T-05 reemplaza por la pública — PROPUESTA de adelantar `qs`. `apiFetch` se extiende para conservar `code` del error: `const e = new Error(err.error); e.code = err.code; e.status = res.status` (necesario para distinguir 403 `requiere_admin` y 409).

## 6. Frontend — UI

**Dónde vive (fase 1):** vista Importar (`#sec-import`), con pestañas internas implementadas como fila de `.filter-pill` (patrón existente de "Todos · Últ. 5 · Últ. 3"): `Importar` (default) · `Partidos` · `Calidad` · `Competencias`. La pestaña activa se guarda en `sessionStorage` (try/catch). X-01 moverá cada pestaña a S1 (`datos/importar`, `datos/partidos`, `datos/calidad`, `datos/competencias`) usando `components/tabs.js`, sin reescribir los componentes de F-11.

- **Importar**: card actual (URL + botón + seed dev). El toast de éxito agrega la competencia: `t('datos.importar.ok_comp', 'Competencia: {label}', {label})`.
- **Partidos**: la card "Partidos importados (N)" se mueve aquí. Arriba, select de competencia (`include_hidden` si admin) con opción "Todas". Tabla `_gamesTable` + columna Estado con badges (`.dq-badge`): "Sin PBP" (ámbar), "Sin coordenadas" (gris), "Reprocesar" (ámbar), "Borrador" (gris) — nulos/ok sin badge. Acciones admin en modo selección: "Reprocesar seleccionados" (usa `reprocess-runner`), "Mover a competencia…" (modal con select → `api.assignGame` por partido), "Eliminar seleccionados" (existente). Paginación actual (10).
- **Calidad** (`components/data-quality.js`): select de competencia (todas, incluidas borrador); resumen en una card (`N partidos · M incompletos` + pill de estado verde "Lista para publicar" / ámbar "Revisar antes de publicar" + estado de la competencia + botón "Publicar" si `status != publicada` y admin + botón "Reprocesar competencia" si admin). Debajo, una card por chequeo en `.stat-grid`-like: título, ícono de estado (✓ ok verde, ! alerta ámbar, — no disponible gris), conteo, lista desplegable de ítems (máx. 20 visibles + "Ver todos"). Ítems de partido con acciones "Reprocesar" y "Mover". `null_fields` como tabla Campo · Nulos · Total · % (usa `fmtNumber` de C-11 con coma decimal). El chequeo `possession_gaps` gris con el copy de diferido. Los chequeos que no cuentan como incompletitud llevan la nota "Advertencia: no bloquea la publicación".
- **Competencias** (`components/competitions-admin.js`): lista (cards en móvil, tabla en desktop) con etiqueta, estado, por defecto (★), partidos, equipos, rango de fechas; acciones admin: Editar (form inline nombre/temporada), Estado (select publicada/borrador/archivada), "Marcar por defecto", "Fusionar en…" (modal con select de destino y confirmación "Los N partidos de <A> pasarán a <B>. ¿Continuar?"), "Nueva competencia" (form). Tras cada cambio: recarga la lista, `refreshTeamSelector()`, `refreshCompareSelectors()`.
- **Reproceso** (`components/reprocess-runner.js`): `runReprocess(target, {onProgress})` itera `api.reprocess` hasta `next_offset == null` (competencia) o en trozos de 20 (`game_ids`); acumula `failed`; `onProgress(done, total)` pinta una barra `.dq-progress`; si una llamada falla por red, se detiene y reporta "Sin conexión: el reproceso se detuvo en X de N."
- **Selectores de competencia (RF-9)**: `_compOptions(comps, selected)` pasa a recibir objetos `{id, label, status}` y usar `value = id`; las archivadas al final con sufijo " (archivada)". Liga: `api.league(_leagueComp)` con id. Equipo/Jugador/Comparar filtran `game_log` en el cliente: se compara por `g.competition_id` — requiere que `game_log` traiga `competition_id` (ver §10 H-1); mientras tanto, `_filterByComp` mapea id → conjunto de alias (`comp.aliases`) y compara contra `g.competition` (texto crudo), que es exacto por construcción del alias. Se mantiene "ocultar con ≤ 1 competencia".
- **Admin**: `_isAdmin` desde `api.me()` al arrancar; acciones de escritura con `if (_isAdmin)`; un 403 muestra el toast de §6 del spec.
- **Componentes compartidos reutilizados**: `toast`, `_fmtDate`, `_gamesTable`, `.card`, `.filter-pill`, `.modal`/`.modal-backdrop`, `core/format.js` (`fmtNumber`, `nullDisplay`) e `core/i18n.js` (`t`) de C-11. Ningún componente de §8 de la arquitectura es de F-11 (los tres nuevos son PROPUESTA).
- **Estados**: loading con `<span class="spinner">`; vacío/error/offline con el copy del spec §6; éxito con toasts.
- **Mobile 768 px**: pills con `overflow-x: auto`; cards de chequeo a una columna; la tabla de partidos conserva `.table-wrap` con scroll; modales a ancho completo; la barra inferior fija no cambia (Importar sigue siendo un botón).

## 7. Navegación
Sin secciones nuevas: 4 pestañas internas dentro de Importar (§3.12 arquitectura, "Fase 1"). `docs/frontend.md` §Vistas → Importar documenta las pestañas. Sin cambios en la barra inferior. No se usa hash (X-01).

## 8. Contratos de datos
- Response de `/api/import`, `/api/games`, `/api/teams`, `/api/competitions`, `/api/data-quality`, `/api/reprocess`, `/api/me`: ver §3.2.
- Ítem de chequeo: `{status: "ok"|"alerta"|"no_disponible", count: int|null, counts_as_incomplete: bool, reason?: str, items: [...]}`; shapes de ítem por chequeo en §4.6.
- Dict de partido parseado (salida de `parse_game`), campos agregados: `minutes`; `teams[].{blk_received, fouls_drawn, team_orb, team_drb, team_tov, period_pts}`; `players[].{blk_received, fouls_drawn, paint_pts, second_chance_pts, fast_break_pts, first_name, family_name, photo_url}`; `shots[].{court_x, court_y}`; `pbp[].{previous_action, qualifiers}`; `_raw`, `_page_info` (solo en `fetch_game_data`).
- Filas nuevas: `competitions`, `competition_aliases`, `game_sources`, `app_meta` (§3.1).

## 9. Manejo de errores y offline

| Código | `code` | Mensaje (español) | UI |
|---|---|---|---|
| 400 | `parametro_invalido` | "Se requiere competition_id entero." · "Máximo 20 partidos por llamada." · "Elegí una competencia." · "Estado inválido." · "El nombre es obligatorio." | toast error |
| 400 | `competencia_inexistente` | "La competencia no existe." | toast + recarga selects |
| 401 | — | "No autenticado" (existente) | vuelve al login (handler existente) |
| 403 | `requiere_admin` | "Tu usuario no tiene permiso para esta acción." | toast; oculta acciones |
| 404 | `no_encontrado` | "Partido no encontrado." · "Competencia no encontrada." | toast |
| 409 | `conflicto` | "Ya existe una competencia con ese nombre y temporada." · "No se puede fusionar una competencia consigo misma." | toast en el formulario |
| 502 | `fiba_no_disponible` | "No se pudo obtener datos de FIBA LiveStats. Verifica la URL." (import) / ítem de `failed[]` (reproceso) | toast / lista de fallidos |

Offline: `/api/*` siempre a red (SW actual); un `TypeError` de `fetch` se traduce a "Sin conexión. Revisá tu red e intentá de nuevo." en las pestañas nuevas. `sw.js`: agregar `/js/components/data-quality.js`, `/js/components/competitions-admin.js`, `/js/components/reprocess-runner.js` a `STATIC` y subir `CACHE` al siguiente entero (número asignado al integrar, arquitectura §3.13).

## 10. Riesgos / decisiones

- **R-1 Tiempo de reproceso vs timeout de gunicorn (180 s).** Desde archivo: parse + upsert ≈ 0,2–0,5 s/partido → 20 partidos < 15 s. Desde FIBA: `_fetch_direct` (timeout 20 s) + `_fetch_page_info` (10 s) por partido → 20 partidos podrían superar 180 s en el peor caso. Decisión: lote de 20 en modo archivo y **5** si algún partido del lote necesita FIBA (el backend reduce el lote y devuelve `next_offset` acorde). Ver desacuerdo D-1.
- **R-2 Tamaño del archivo crudo.** ≈ 50 KB gzip por partido (DA-12) → 1.000 partidos ≈ 50 MB de 1 GB de disco. Aceptable; se documenta en `docs/deployment.md`.
- **R-3 Partidos viejos sin `source_url`.** `_data_url` solo necesita el `game_id`, pero `_fetch_page_info` necesita la URL de la página (con el segmento de liga, p. ej. `/u/FUBB/`). Para partidos sin URL se reconstruye `…/u/FUBB/<game_id>/` (todos los partidos actuales son de FUBB); si la página falla, se conservan la fecha y competencia ya guardadas (`info` no pisa con vacío). Riesgo bajo; se registra en `progress.md` si aparece otro segmento.
- **R-4 Cambio de shape de `/api/competitions`** (strings → objetos): rompe a los consumidores actuales en `app.js` (Liga l.521, Comparar l.174). Se migran en el mismo cambio (RF-9). No hay otros clientes.
- **R-5 Semántica de columnas existentes `DEFAULT 0`.** No se tocan (Constitución 5 y alcance); solo las nuevas son NULL. C-11/T-05 deciden el tratamiento de las viejas.
- **R-6 Riesgo de invalidación incompleta** (R-08 arquitectura): toda escritura de F-11 pasa por `ingest`, `competitions` o las rutas de borrado, que suben `data_version`. Revisión explícita en T-F.
- **R-7 Verificación con datos insuficientes** (R-05 arquitectura): la base local está vacía; para CA-3, CA-5, CA-7, CA-17 se usan inyecciones controladas documentadas sobre una **copia** de la base (`DB_PATH` apuntando a la copia) y una segunda competencia creada a mano (POST `/api/competitions` + reasignación de 3 partidos).
- **Decisión: `summary` y `counts_as_incomplete` en `/api/data-quality`** — agregados a la shape fijada (PROPUESTA) porque el CA del cliente pide ver "que no hay partidos incompletos" en una sola pantalla.
- **Decisión: helper `data_quality.game_flags`** para los flags del catálogo (PROPUESTA): evita duplicar las consultas de los chequeos en `app.py`.
- **Decisión: componentes frontend propios** (`data-quality.js`, `competitions-admin.js`, `reprocess-runner.js`) — PROPUESTA (no están en §8/§3.13 de la arquitectura); X-01 los importa desde `views/datos.js`.
- **H-1 (hueco)**: `game_log` de `/api/team` y `/api/player` no trae `competition_id`; el filtro por id en el cliente usa los alias como puente. PROPUESTA: que T-05 (dueño de esos endpoints en v2) agregue `competition_id` a cada fila de `game_log`; F-11 no lo agrega para no tocar un contrato ajeno.

**Desviaciones respecto de la arquitectura**
- D-1: lote de reproceso de 5 cuando interviene FIBA (la arquitectura fija "máx. 20 por llamada"): 20 × 30 s de timeouts supera los 180 s de gunicorn. Se sigue el máximo de 20 para el modo archivo.
- `POST /api/import` queda `login_required` (no admin) — la arquitectura es internamente inconsistente (§3.21 vs §6); se sigue la tabla de endpoints §6.
- `include_hidden` en `GET /api/competitions` y `competition_status`, `aliases`, `total` en respuestas: PROPUESTA aditiva.

**Dependencias técnicas**
- C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)): Grupo 0 (integración de `dev`: `norm_name` en `stats_engine`), `core/format.js` (`fmtNumber`, `nullDisplay`), `core/i18n.js` (`t`), códigos de nulo §7.4 (`no_registrado`, `requiere_posesiones`).
- F-13 ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md)), posterior: `config.get("ui.default_competition_id")` en `resolve_competition` (import protegido hasta que exista); F-13 reutiliza `admin_required` y `cache.bump_config_version`.
- C-08 ([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md)), posterior: consume `first_name`/`family_name`/`photo_url` y reemplaza el chequeo `possible_duplicates` por `identity.duplicate_candidates(comp_id)`, además de agregar `player_id` en `persist_game`.
- A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md)): registra `possession_gaps` con `data_quality.register_check` (INCREMENTO DIFERIDO).
- C-03, T-05, C-02, C-09, T-01, T-03, F-14: consumen `competitions`, `repository.resolve_competition`, `cache.memo` y las columnas nuevas.

**Incrementos diferidos**
- INCREMENTO DIFERIDO (→ A-01): chequeo `possession_gaps` real y partidos con conciliación > 5 % (DA-30). F-11 deja el punto de extensión (`register_check`) y el placeholder `no_disponible`.

**Estimación:** XL · 32–40 h (esquema y backfill 4 h · ingesta v2 y parser 8 h · ingest/reproceso/archivo 5 h · competitions + repository + cache 6 h · data_quality 5 h · auth + tests 1,5 h · rutas 2,5 h · UI 4 pestañas + selectores 7 h · verificación con inyecciones y docs 4 h). No se propone partición: si superara 40 h, la ingesta v2 (grupo B1) puede separarse como sub-entrega previa.
</content>
</invoke>
