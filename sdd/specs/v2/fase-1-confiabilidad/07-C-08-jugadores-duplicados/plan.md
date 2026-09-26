# Plan — C-08: Jugadores duplicados en el buscador

> **ID:** C-08 · **Prioridad:** P0 · **Fase y orden:** 1·07
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)) · F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)) · **Habilita:** T-01, F-16, F-05, T-03, F-10, A-09, A-11, F-12, C-03
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 · C-08 · Arquitectura §3.4, §4, §5, §6, §7.8, §9.2 I-15
> **Estimación:** L · 12–18 h

## 1. Enfoque

La identidad pasa de "string de nombre agrupado al leer" (estado de `dev`, Feature 13) a una **ficha persistente**:
tabla `players` con `UNIQUE(team_code, norm_key)` y `player_game_stats.player_id` (Arquitectura §3.4). Un módulo nuevo
`backend/identity.py` concentra toda la lógica (normalización, resolución, completado, fusión, candidatos); las rutas quedan
finas y agrupan por `player_id` en vez de por nombre. Las rutas legado por nombre resuelven el nombre a ficha y usan **todas
las grafías** de la ficha para `shots` y `pbp_events` (que no tienen `player_id`). La ingesta v2 de F-11 llama a identity
al persistir cada partido; `upgrade_db()` completa el histórico de forma idempotente. El panel de calidad de F-11 recibe el
check `possible_duplicates` con candidatos a fusión manual, y la fusión la hace un admin vía `POST /api/identity/merge`.
Sin dependencias nuevas; sin tocar la restricción única existente; sin reescribir nombres.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/database.py` | model | Modelo `Player` (tabla `players`, NUEVO); columna `PlayerGameStats.player_id` (NUEVO); entrada en `upgrade_db().new_cols`; llamada a `identity.backfill_player_ids()` al final de `upgrade_db()` | RF-2 |
| `backend/identity.py` | module (NUEVO) | `norm_name`, `resolve_identity` (movidas de `stats_engine`), `resolve_player_id`, `backfill_player_ids`, `player_card`, `duplicate_candidates`, `merge_players` (Arquitectura §3.4) + PROPUESTAS `canonical_id`, `assign_game`, `aliases`, `name_index`, `canonicalize_pbp_games`, `position_group` | RF-1…RF-6, RF-10…RF-13 |
| `backend/stats_engine.py` | service | `norm_name`/`resolve_identity` pasan a ser re-export de `identity` (compatibilidad con imports existentes) | RF-1 |
| `backend/ingest.py` (F-11) | module | Tras upsert de `player_game_stats` en `persist_game`, llamar `identity.assign_game(game_id)` | RF-2 |
| `backend/data_quality.py` (F-11) | module | `register_check("possible_duplicates", …)` pasa a usar `identity.duplicate_candidates` (reemplaza la versión con `norm_name` de F-11, I-15) | RF-12 |
| `backend/app.py` | route | `team_players`, `player_stats`, `search_players` agrupan por `player_id`; ruta NUEVA `GET /api/player/<int:player_id>`; `player_shots`, `onoff_route`, `lineup_route` resuelven por ficha y alias; ruta NUEVA `POST /api/identity/merge`; helper `_player_payload(player_id)` y `_resolve_legacy_player(team_code, name)` | RF-7…RF-11, RF-13 |
| `frontend/js/api.js` | js-api | `players(code, params)`, `playerById(id, params)`, `searchPlayers(params)`, `mergePlayers(targetId, sourceId)`; `qs()` si no existe todavía (ver §10) | RF-7…RF-9, RF-11, RF-14 |
| `frontend/js/app.js` | js-view | Buscador: filtro de posición por grupo, refetch por competencia, clic → perfil por id. Equipo: `player-select` con `value = player_id` y nombre visible. Jugador: carga por id | RF-5, RF-7, RF-8, RF-14 |
| `frontend/js/components/identity-merge.js` | js-component (NUEVO, PROPUESTA) | `renderDuplicateItems(el, check, {isAdmin, onMerged})`, `openMergeDialog(pair, {onMerged})` — consumido por la pestaña Calidad de F-11 | RF-11, RF-12 |
| `frontend/css/style.css` | css | Sección `/* ── identity-merge (C-08) ── */` (tabla de pares, modal) | RF-11, RF-12 |
| `frontend/sw.js` | sw | Agregar `/js/components/identity-merge.js` a `STATIC` y subir `CACHE` al siguiente entero | RF-12 |
| `docs/database.md` | doc (cierre) | Tabla `players`, `player_game_stats.player_id`, completado idempotente, identidad persistente (reemplaza la nota de "identidad al leer") | RF-2 |
| `docs/api.md` | doc (cierre) | `GET /api/players/<team>` real (objetos + `player_id`, corrige D-05), `GET /api/player/<int:player_id>`, `GET /api/search/players` (+`player_id`, `position_group`, `competition_ids`, filtro), `POST /api/identity/merge`, resolución por alias en rutas legado | RF-7…RF-11 |
| `docs/frontend.md` | doc (cierre) | Buscador (grupos G/F/C), navegación por id, panel de duplicados y copy nuevo | RF-5, RF-12, RF-14 |
| `docs/architecture.md` | doc (cierre) | Módulo `identity.py` en el mapa de capas | RF-1 |

**Matriz RF → archivo:** RF-1 identity/stats_engine · RF-2 database/identity/ingest · RF-3 identity/app · RF-4 identity ·
RF-5 identity/app/app.js · RF-6 identity · RF-7 app/api.js/app.js · RF-8 app/api.js/app.js · RF-9 app/api.js ·
RF-10 app/identity · RF-11 identity/app/api.js/identity-merge.js · RF-12 identity/data_quality/identity-merge.js ·
RF-13 identity (cache) · RF-14 app.js. Sin RF huérfanos.

## 3. Backend — rutas y modelos

### 3.1 Esquema

| Tabla / columna | Tipo | Default | Vía | Restricciones |
|---|---|---|---|---|
| `players.id` | INTEGER | autoincrement | `create_all` | PK |
| `players.team_code` | TEXT | — | `create_all` | NOT NULL |
| `players.norm_key` | TEXT | — | `create_all` | NOT NULL; `UNIQUE(team_code, norm_key)` |
| `players.display_name` | TEXT | — | `create_all` | NOT NULL (grafía real más reciente) |
| `players.first_name` · `.family_name` · `.photo_url` | TEXT | NULL | `create_all` | copiados de la primera fila que los traiga (F-11) |
| `players.merged_into` | INTEGER | NULL | `create_all` | FK `players.id` (sin cascada) |
| `players.created_at` | TEXT | NULL | `create_all` | ISO-8601 |
| `player_game_stats.player_id` | INTEGER | NULL | `upgrade_db()` `("player_game_stats", "player_id", "INTEGER")` + completado | índice PROPUESTA `CREATE INDEX IF NOT EXISTS ix_pgs_player_id ON player_game_stats(player_id)` en `upgrade_db()` |

La restricción única `(game_id, team_code, player_name)` de `player_game_stats` no se toca. `players` no tiene columnas de
F-16 (las agrega F-16 por `upgrade_db()`).

### 3.2 Endpoints

**GET `/api/players/<team_code>`** (modificado · `login_required`)
- Query: `competition` opcional (`<id>` | `all` | string legado; ausente = todas, ver spec §9). Resolución con
  `repository.resolve_competition` (F-11).
- Response 200:
```json
[{"player_id": 12, "name": "C. Zinaich", "games": 2, "uso_pct": 0.2145, "pts": 19.0},
 {"player_id": 15, "name": "J. Feldeine", "games": 2, "uso_pct": null, "pts": 11.5}]
```
- Errores: 400 `{"error": "Competencia inexistente", "code": "competencia_inexistente"}`. Equipo sin filas → `[]` (como hoy).

**GET `/api/player/<int:player_id>`** (NUEVO · `login_required` · Ctx en la medida que C-02/T-05 lo agreguen al builder común)
- Response 200: exactamente el shape de `GET /api/player/<team>/<name>` en `dev` (`player`, `team_code`, `team_name`, `games`,
  `averages`, `totals`, `league`, `leagues`, `game_log[]`) **+** `"player_id": 12` (canónico) **+** `"position": "PF"`,
  `"position_group": "F"`.
- Si `player_id` fue absorbido por otra ficha, responde la ficha canónica (`player_id` de la respuesta ≠ el pedido).
- Errores: 404 `{"error": "Jugador no encontrado", "code": "no_encontrado"}`.

**GET `/api/player/<team_code>/<player_name>`** (existente): `_resolve_legacy_player` → `_player_payload(pid)`. Mismo shape +
`player_id`. 404 sin cambio de copy. Si la ficha resuelta es de otro equipo (imposible por clave) → 404.

**GET `/api/search/players`** (modificado)
- Query: `competition` opcional (ausente = todas).
- Cada entrada (shape de `dev` + campos nuevos):
```json
{"player_id": 12, "player": "C. Zinaich", "team_code": "CNF", "team_name": "Nacional",
 "competitions": ["Liga Uruguaya de Basquetbol 2025/2026"], "competition_ids": [3],
 "games": 2, "position": "PF", "position_group": "F", "minutes": 24.1, "plus_minus": 3.5,
 "efg_pct": 0.52, "...": "resto de métricas de dev sin cambio"}
```
- `position`/`position_group` salen de **todos** los partidos de la ficha (atributo estable, no cambia con el filtro).
- `competitions`/`competition_ids` = competencias de todas las fichas-partido (incluye convocado sin jugar, como `dev`).
- `competition_ids` es PROPUESTA (no está en 00-arquitectura-transversal.md): la arquitectura solo fija `+ player_id`; se
  necesita para que el select de competencia del buscador trabaje con ids (F-11 migra los selects a ids).

**GET `/api/shots/<team_code>/<player_name>`** (existente): resuelve ficha; filtra `Shot.player_name IN aliases(pid)` y
`Shot.team_code == team_code`; el resumen `pgs` suma `PlayerGameStats.player_id == pid`. Shape sin cambio (C-03 lo rehace
después delegando en `shot_zones`). 404 si no resuelve: `{"error": "Jugador no encontrado"}` — hoy devuelve 200 con cero
tiros para un nombre inexistente; el cambio a 404 se documenta (ver §10 D-5).

**GET `/api/onoff/<team_code>/<player_name>`** (existente): resuelve ficha (404 `"Sin datos ON/OFF para este jugador"` si no
resuelve, copy actual); `games = identity.canonicalize_pbp_games(repository.team_pbp_games(team, None), team)`;
`lineups.onoff_stats(games, team, display_name)`; USO% sobre `PlayerGameStats.player_id == pid`. Response + `"player_id"`.

**GET `/api/lineup/<team_code>?players=A|B|C`** (existente): cada nombre se resuelve a ficha (`create=False`); nombre que no
resuelve → 400 `{"error": "Jugador no encontrado: {nombre}", "code": "parametro_invalido"}` (PROPUESTA de copy; hoy un
nombre inexistente da métricas vacías); dos nombres que resuelven a la misma ficha → 400 `"Elegí entre 3 y 5 jugadores"`
(copy existente, porque en realidad quedan menos de 3 distintos). Luego `canonicalize_pbp_games` + `lineup_stats` con los
`display_name`. Shape sin cambio.

**POST `/api/identity/merge`** (NUEVO · `admin_required` de F-11)
- Body: `{"target_id": 15, "source_id": 41}`.
- Response 200:
```json
{"player": {"player_id": 15, "team_code": "CNF", "display_name": "J. Feldeine", "position": "PG",
            "position_group": "G", "games": 3, "aliases": ["J. Feldeine", "Jerome Feldeine"]},
 "merged": {"source_id": 41, "rows_moved": 1}, "data_version": 57}
```
- Errores (§7.8): 400 `parametro_invalido` `"Indicá target_id y source_id enteros"` / `"No se puede unificar una ficha
  consigo misma"`; 403 `requiere_admin` `"Necesitás permisos de administrador para unificar jugadores"`; 404 `no_encontrado`
  `"Jugador no encontrado"`; 409 `conflicto` `"Solo se pueden unificar fichas del mismo equipo"`.

## 4. Backend — lógica (`backend/identity.py`, NUEVO salvo indicación)

| Función | Firma | Entradas | RF |
|---|---|---|---|
| `norm_name` | `norm_name(s) -> str` | string | RF-1 |
| `resolve_identity` | `resolve_identity(rows) -> tuple[str, str]` | filas con `.player_name`, `.position`, orden antiguo→reciente | RF-4, RF-6 |
| `canonical_id` | `canonical_id(player_id: int) -> int \| None` — PROPUESTA | `players.merged_into` | RF-11 |
| `resolve_player_id` | `resolve_player_id(team_code, player_name, *, first_name=None, family_name=None, photo_url=None, create=True) -> int` (con `create=False` puede devolver `None`) | `players` | RF-1, RF-2 |
| `assign_game` | `assign_game(game_id: str) -> int` — PROPUESTA | `player_game_stats` del partido | RF-2 |
| `backfill_player_ids` | `backfill_player_ids() -> int` | filas con `player_id IS NULL` | RF-2 |
| `aliases` | `aliases(player_id: int) -> list[str]` — PROPUESTA | `player_game_stats.player_name` de la ficha | RF-10 |
| `name_index` | `name_index(team_code: str) -> dict[str, int]` — PROPUESTA | nombres crudos → id canónico | RF-10 |
| `canonicalize_pbp_games` | `canonicalize_pbp_games(games: list[dict], team_code: str) -> list[dict]` — PROPUESTA | shape de `repository.team_pbp_games` | RF-10 |
| `position_group` | `position_group(pos: str \| None) -> str \| None` — PROPUESTA | posición FIBA | RF-5 |
| `player_card` | `player_card(player_id: int) -> dict` | `players` + filas | RF-4, RF-6, RF-9 |
| `duplicate_candidates` | `duplicate_candidates(competition_id: int \| None) -> list[dict]` | `players`, `player_game_stats`, `games` | RF-12 |
| `merge_players` | `merge_players(target_id: int, source_id: int) -> dict` | `players`, `player_game_stats` | RF-11, RF-13 |

**`norm_name(s)`** — código de `dev` sin cambios: `s = (s or "").strip().lower()` → NFD descartando categoría `Mn` →
`re.sub(r"\s+", " ", s)`. `stats_engine.norm_name = identity.norm_name` (re-export; `stats_engine` importa de `identity`,
`identity` no importa de `stats_engine` → sin ciclo).

**`resolve_identity(rows)`** — código de `dev` sin cambios (nombre = última fila; posición = no vacía más frecuente,
desempate por la más reciente; `""` si ninguna).

**`position_group(pos)`**: `p = (pos or "").strip().upper()`; `{"G","PG","SG"} → "G"`, `{"F","SF","PF"} → "F"`, `{"C"} → "C"`;
otro valor no vacío (p. ej. `"G-F"` si FIBA lo enviara) → primer carácter si es G/F/C, si no `None`; vacío → `None`.

**`canonical_id(pid)`**: sigue `merged_into` con conjunto de visitados (corte ante ciclo → devuelve el último id sin
`merged_into`, y lo registra en log); `None` si el id no existe.

**`resolve_player_id(...)`**:
```
key = norm_name(player_name);  si key == "": raise ValueError("nombre vacío")
row = Player.query.filter_by(team_code=team_code, norm_key=key).first()
si row:
    completar first_name/family_name/photo_url SOLO si en row son NULL y vienen informados (nunca sobrescribir)
    return canonical_id(row.id)
si not create: return None
insertar Player(team_code, norm_key=key, display_name=player_name.strip(), first/family/photo, created_at=now)
    ante IntegrityError (carrera entre workers) → rollback del savepoint y re-consultar
return nuevo id
```

**`assign_game(game_id)`** (hook de `ingest.persist_game`, en la misma transacción después del upsert de jugadores):
para cada fila de `player_game_stats` del partido: `pid = resolve_player_id(row.team_code, row.player_name,
first_name=row.first_name, family_name=row.family_name, photo_url=row.photo_url)`; si `row.player_id != pid` → asignar.
Después `_refresh_display(pids_tocados)`; si hubo fichas nuevas o asignaciones distintas, la versión la sube `ingest`
(ya hace `bump_data_version` al importar). Devuelve filas asignadas.

**`_refresh_display(pids)`** (privada): por ficha canónica, fila más reciente por `(games.date, games.game_id)` →
`display_name = row.player_name.strip()`.

**`backfill_player_ids()`** (llamada al final de `upgrade_db()`, dentro del contexto de app):
```
filas = player_game_stats WHERE player_id IS NULL, JOIN games, ORDER BY games.date, game_id
si no hay filas: return 0                                   # idempotente: la 2.ª corrida no hace nada
cache local {(team, key): id} precargado desde players
por fila: pid = cache o resolve_player_id(...); fila.player_id = pid
commit por lotes de 500; _refresh_display(todas las fichas tocadas)
si asignó > 0: cache.bump_data_version("identity_backfill")
return asignadas
```
Costo: 13 partidos ≈ 300 filas (ms); 200 partidos ≈ 5.000 filas (< 2 s una sola vez).

**`aliases(pid)`**: `SELECT DISTINCT player_name FROM player_game_stats WHERE player_id = :canonical` (las filas de fichas
absorbidas ya apuntan al canónico, ver `merge_players`).

**`name_index(team_code)`**: `{row.player_name: canonical(row.player_id)}` para todas las filas del equipo (+ variantes por
`norm_name` para nombres de pbp que no estén en el box: clave `norm_name(nombre)` → id). Memo por request (`flask.g`), no LRU.

**`canonicalize_pbp_games(games, team_code)`**: copia superficial de cada partido; en `events`, para los eventos con
`team_code == team_code` y `player_name` no vacío, reemplaza `player_name` por `display_name` de su ficha canónica
(vía `name_index`; si no resuelve, deja el crudo); en `player_rows`, devuelve objetos livianos (`SimpleNamespace` con
`player_name`, `team_code`, `starter`, `minutes`) con el nombre canónico para las filas del equipo. No modifica la base ni
el caché de `repository`. Garantiza que `lineups.build_segments`/`onoff_stats` vean un único nombre por jugador.

**`player_card(pid)`**: `{player_id, team_code, team_name (fila más reciente), display_name, position, position_group,
jersey (partido más reciente), games (partidos jugados, `played(minutes)`), games_listed (convocatorias), first_name,
family_name, photo_url, aliases[], competition_ids[]}`; 404 lo decide la ruta si devuelve `None`.

**`duplicate_candidates(competition_id)`** — algoritmo:
```
fichas = players canónicos (merged_into IS NULL) con ≥1 fila en la competencia (todas si None)
por ficha: game_ids, jerseys, norm tokens de display_name, pares (first_name, family_name) normalizados, photo_urls
surname = último token; given = tokens previos sin "."; initial = given[0][0] si given
por equipo, por par (a, b) con game_ids(a) ∩ game_ids(b) = ∅:
    regla apellido_inicial: surname(a)==surname(b) y initial(a)==initial(b) y (len(given(a)[0])==1 o len(given(b)[0])==1)
    regla dorsal_apellido: jerseys(a) ∩ jerseys(b) ≠ ∅ y prefijo común de surname ≥ 4 caracteres
    → item {kind: "candidato", reason, team_code, players: [resumen(a), resumen(b)], can_merge: true}
por ficha: más de un par (first,family) distinto → {kind: "posible_fusion_incorrecta", reason: "nombre_completo_distinto", ...}
           más de una photo_url distinta → {kind: "posible_fusion_incorrecta", reason: "foto_distinta", ...}
resumen(x) = {player_id, name, games, jerseys, first_date, last_date}
orden: team_code, kind, reason
```
Registro: `data_quality.register_check("possible_duplicates", lambda comp_id: {"status": "alerta" if items else "ok",
"count": len(items), "items": items})`. El shape de `items[]` es PROPUESTA (la arquitectura solo fija `{status, count, items[]}`).

**`merge_players(target_id, source_id)`**:
```
t, s = canonical_id(target_id), canonical_id(source_id)
None → NotFound;  t == s → ValueError("misma ficha");  team(t) != team(s) → Conflict
en una transacción:
    UPDATE players SET merged_into = t WHERE id = s OR merged_into = s      # aplana la cadena
    n = UPDATE player_game_stats SET player_id = t WHERE player_id = s
    completar first/family/photo de t desde s si en t son NULL
_refresh_display([t]);  v = cache.bump_data_version("identity_merge")
return {player: player_card(t) (con aliases), merged: {source_id: s, rows_moved: n}, data_version: v}
```
Reversibilidad por datos (sin UI): `merged_into = NULL` en `s` y `player_id = s` para las filas cuyo
`(team_code, norm_name(player_name)) == (team(s), s.norm_key)`.

**Rutas en `app.py`** (finas):
- `_resolve_legacy_player(team_code, name) -> int | None` = `identity.resolve_player_id(team_code.upper(), name, create=False)`.
- `_player_payload(pid)`: cuerpo actual de `player_stats` de `dev` con `rows = PlayerGameStats.query.filter_by(player_id=pid)`
  ordenadas por `(date, game_id)`; `player` = `display_name`; agrega `player_id`, `position`, `position_group`. El resto
  (game_log, averages, totals, leagues, reglas C-11 de DNP y nulos) sin cambio. C-02/T-05 extienden este único builder.
- `search_players`: `groups` por `row.player_id` (filas con `player_id` NULL — no deberían existir tras el completado — se
  resuelven al vuelo con `resolve_player_id(create=True)`); filtro de competencia aplicado a las filas que alimentan
  promedios y `games`; posición desde `player_card`. Resto del cálculo de `dev` sin cambio.
- `team_players`: ídem, agrupado por `player_id`, filtro de competencia; salida con `player_id`.

Nulos (C-11): la unificación no crea valores; `uso_pct`/`pts` siguen `null` sin partidos jugados; `position` `""` y
`position_group` `null` sin dato (la UI muestra "—").

Caché: `bump_data_version` en fusión y completado (RF-13); el resto de lecturas no se cachea en C-08.

## 5. Frontend — capa API (`api.js`)

| Método | Endpoint | Notas |
|---|---|---|
| `api.players(code, params = {})` | `GET /api/players/<code>` + `qs(params)` | firma compatible (params opcional) |
| `api.playerById(id, params = {})` | `GET /api/player/<id>` + `qs(params)` | NUEVO |
| `api.searchPlayers(params = {})` | `GET /api/search/players` + `qs(params)` | firma compatible |
| `api.mergePlayers(targetId, sourceId)` | `POST /api/identity/merge` body JSON | NUEVO; errores 403/409 con `error` legible |

`qs(params)` con el contrato de Arquitectura §8 (omite `null`/`undefined`/`""`). Si F-11 no lo creó, C-08 lo crea con ese
contrato exacto (T-05 lo reutiliza). `api.player(code, name)`, `api.playerShots`, `api.onoff`, `api.lineup` sin cambio.

## 6. Frontend — UI

Ubicación (fase 1, antes de X-01): vistas actuales de `app.js` (Buscar, Equipo, Jugador) y la pestaña **Calidad** de la vista
Importar que crea F-11 (§3.12). X-01 las reubica en S7 `explorar/jugadores`, S3 y S4 sin cambiar componentes.

- **Buscar** (`renderSearch`/filtros, `dev` l.1587–1680): el select `sf-pos` pasa a 3 opciones fijas G/F/C con etiquetas
  `t('search.pos.g','Base/Escolta (G)')`, `t('search.pos.f','Alero/Ala-pívot (F)')`, `t('search.pos.c','Pívot (C)')` y filtra
  por `p.position_group`; la columna Posición sigue mostrando el valor FIBA (`"—"` si vacío, vía `nullDisplay` de C-11).
  `sf-comp`: opciones por `id` (de `api.competitions()` de F-11); al cambiar → `api.searchPlayers({competition: id})` y
  re-render (loading con el spinner existente). Filas con `data-player-id`; clic → abre Jugador por id.
- **Equipo** (`dev` l.916–931): `player-select` con `<option value="${p.player_id}">${p.name}</option>`; los handlers que hoy
  leen el nombre (`renderTeamShotmap`, `renderTeamOnOff`) toman el texto de la opción (display name) — las rutas legado
  resuelven alias; el picker de combinaciones mantiene nombres (`display_name`).
- **Jugador**: el select de jugador usa `player_id`; `renderPlayer` llama `api.playerById(id)`; el shot chart sigue con
  `api.playerShots(team, data.player)`.
- **Calidad → Posibles duplicados** (`components/identity-merge.js`, PROPUESTA): tabla responsive (en < 768 px, tarjetas
  apiladas) con columnas Equipo · Ficha A · Ficha B · Motivo (`t('dq.dup.reason.apellido_inicial','Mismo apellido e inicial')`,
  `…dorsal_apellido 'Mismo dorsal y apellido parecido'`, `…nombre_completo_distinto 'Nombres completos distintos en la misma
  ficha'`, `…foto_distinta 'Fotos distintas en la misma ficha'`) · acción. Botón `"Unificar"` solo si `me.is_admin` y
  `can_merge`; abre modal (`.modal` existente) para elegir qué ficha conserva el nombre ("Conservar {A}" / "Conservar {B}")
  → `api.mergePlayers` → toast de éxito y recarga del check. Estados del spec §6.
- Helpers reutilizados: `toast`, `.modal`, `.search-table`, `nullDisplay`/`t()` (C-11), `cmpNullsLast` (sin cambio).
- Mobile 768 px: el modal usa el ancho completo con márgenes de 16 px; botones de 44 px de alto.

## 7. Navegación
Sin vistas ni hashes nuevos (el routing por hash llega con X-01). La pestaña "Calidad" es de F-11; C-08 solo aporta su
bloque. `docs/frontend.md` documenta que la navegación al perfil usa `player_id`.

## 8. Contratos de datos
- Fila SQLAlchemy nueva `Player` (§3.1); `PlayerGameStats.player_id`.
- Responses de §3.2. Item de `possible_duplicates` (PROPUESTA):
```json
{"kind": "candidato", "reason": "apellido_inicial", "team_code": "CNF", "can_merge": true,
 "players": [{"player_id": 15, "name": "J. Feldeine", "games": 12, "jerseys": ["7"], "first_date": "2025-10-02", "last_date": "2026-03-01"},
             {"player_id": 41, "name": "Jerome Feldeine", "games": 1, "jerseys": ["7"], "first_date": "2026-03-08", "last_date": "2026-03-08"}]}
```

## 9. Manejo de errores y offline
| Código | Cuándo | Mensaje (español) |
|---|---|---|
| 400 | merge sin ids / misma ficha; lineup con nombre inexistente | `"Indicá target_id y source_id enteros"` · `"No se puede unificar una ficha consigo misma"` · `"Jugador no encontrado: {nombre}"` |
| 401 | sin sesión | handler existente de `api.js` |
| 403 | merge sin admin | `"Necesitás permisos de administrador para unificar jugadores"` |
| 404 | perfil/shots por nombre o id inexistente | `"Jugador no encontrado"` (existente) |
| 409 | merge entre equipos | `"Solo se pueden unificar fichas del mismo equipo"` |
Offline: `/api/*` siempre a red; sin conexión el buscador y el panel muestran el error de red existente y el modal de fusión
`"Sin conexión: no se puede unificar ahora"`. `sw.js`: nuevo asset en `STATIC` + `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **D-1 · Competencia fuera de la clave** (DA-10; spec §9). Mantiene la desviación D-1 de `dev`; la competencia es filtro.
- **D-2 · Fusión reasigna `player_id`** de las filas absorbidas además de marcar `merged_into`: todas las consultas quedan
  simples (`player_id = canónico`) y la fusión sigue siendo reversible por datos (§4). Alternativa descartada: resolver la
  cadena en cada consulta (más joins y riesgo de olvidos).
- **D-3 · `shots`/`pbp_events` sin `player_id`**: se resuelven por alias/`name_index` (dentro de un partido el nombre de tiros
  y pbp coincide con el del box porque el parser usa el mapa dorsal→nombre, `fiba_fetcher.py` l.370–372). Agregar
  `player_id` a esas tablas no está en la arquitectura y no hace falta.
- **D-4 · Riesgo de sobre-fusión** (R-11): la clave tipográfica puede unir a dos "P. Prieto" del mismo equipo; se detecta
  con nombres completos y foto (F-11 captura `first_name`/`family_name`/`photo_url`) y se lista en el panel. Separar fichas
  queda fuera de alcance.
- **D-5 · Cambios visibles menores**: `GET /api/shots/<team>/<nombre inexistente>` pasa de 200 vacío a 404; `lineup` con un
  nombre inexistente pasa a 400. Se documentan en `docs/api.md`. El frontend ya maneja ambos (toast/`catch`).
- **D-6 · Datos de verificación sin duplicados** (R-05): CA-1/2/5/8/10 sobre copia de la base con inyección controlada.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato. Se agregan PROPUESTAS (no están en
  00-arquitectura-transversal.md): `identity.canonical_id`, `assign_game`, `aliases`, `name_index`, `canonicalize_pbp_games`,
  `position_group`; campos `position_group` y `competition_ids` en el buscador; shape de `items[]` de `possible_duplicates`;
  componente `components/identity-merge.js`; índice `ix_pgs_player_id`. `qs()` lo fija la arquitectura como pieza de T-05
  (orden 13) pero lo necesitan F-11/C-08 antes: se crea con su contrato exacto (hueco reportado).
- **Dependencias técnicas:** F-11 → `ingest.persist_game` (hook), `repository.resolve_competition`,
  `repository.team_pbp_games`, `data_quality.register_check`, `cache.bump_data_version`, `auth.admin_required`,
  columnas `player_game_stats.first_name/family_name/photo_url`, `GET /api/competitions` con ids
  ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)); C-11 → Grupo 0 (`norm_name`,
  `resolve_identity`, rutas de `dev`), `core/format.js` (`nullDisplay`), `core/i18n.js` (`t`)
  ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)).
- **Estimación: L · 12–18 h** (esquema + completado 2 h; identity 4–5 h; rutas 3–4 h; UI buscador/equipo/jugador 2–3 h;
  panel y modal 2 h; verificación con copia inyectada y docs 2 h).
