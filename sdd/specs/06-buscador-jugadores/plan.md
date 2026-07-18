# Plan — Feature 06 (tarea 8): Buscador avanzado de jugadores

## 1. Enfoque
Backend: parsear `playingPosition` + `sPlusMinusPoints` en `fiba_fetcher.py`, persistir 2 columnas nuevas en `player_game_stats` (`position`, `plus_minus`) vía `upgrade_db()`, y exponer `GET /api/search/players` que agrega TODOS los jugadores de la base con sus promedios (reusa `calc_player_stats`, con la semántica null de Feature 08). Frontend: vista nueva "Buscar" (`#sec-search`) con formulario de filtros combinables (texto/select/rango) que filtra en el navegador sobre el dataset completo, tabla de resultados ordenable (reusa patrón de Liga) y fila clickeable → `renderPlayer`. Re-import de los 4 partidos para poblar `position`/`plus_minus`.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/database.py` | model | columnas `position` (String, default "") y `plus_minus` (Integer, default 0) en `PlayerGameStats`; agregarlas a `upgrade_db()` | RF-2, RF-3 |
| `backend/fiba_fetcher.py` | service | parsear `playingPosition` → `position`, `sPlusMinusPoints` → `plus_minus` en `player_row` | RF-2, RF-3 |
| `backend/app.py` | route | persistir `position`/`plus_minus` en `_persist_game` (insert + on_conflict update); nuevo `GET /api/search/players` | RF-1, RF-2, RF-3 |
| `frontend/js/api.js` | js-api | `api.searchPlayers()` → `GET /api/search/players` | RF-1 |
| `frontend/js/app.js` | js-view | `sections`+`NAV_ITEMS` con `search`; sección `#sec-search`; `renderSearch()` (form + filtrado + tabla ordenable + fila→renderPlayer) | RF-4..RF-7 |
| `frontend/sw.js` | sw | sin cambio de assets (app.js/api.js ya están en `STATIC[]`); bump `CACHE` a v5 para forzar recarga del nuevo JS | — |
| `docs/api.md`, `docs/database.md`, `docs/frontend.md` | doc | endpoint nuevo, columnas nuevas, vista nueva | — (cierre) |

## 3. Backend — rutas y modelos
- `player_game_stats.position` TEXT DEFAULT `''`; `player_game_stats.plus_minus` INTEGER DEFAULT 0. Vía `upgrade_db()` (`ALTER TABLE ADD COLUMN`), idempotente.
- `GET /api/search/players` (login_required). Response: array, una entrada por `(team_code, player_name)`:
```json
{ "player":"A. Varela","team_code":"AGU","team_name":"...","competitions":["Liga X"],
  "games":3,"position":"G","minutes":27.4,"plus_minus":4.5,
  "efg_pct":0.55,"ts_pct":0.58,"oer":1.08,"uso_pct":0.24,"ppp":1.02,"pps":1.1,
  "fg2_pct":0.5,"fg3_pct":0.37,"ft_pct":0.8,
  "reb_share":0.15,"oreb_share":0.1,"dreb_share":0.2,
  "physical_impact":8.0,"stocks":2.3,"def_playmaking":0.9,
  "pts":14.2,"ast":6.1,"tov":2.0,"stl":1.2,"blk":0.4 }
```
Sin parámetros (filtrado en frontend). Errores: ninguno específico (array vacío si no hay jugadores).

## 4. Backend — lógica
| Función | Módulo | Detalle | RF |
|---|---|---|---|
| `_parse_fiba_json` player_row | `fiba_fetcher.py` | `"position": (p.get("playingPosition") or "").strip()`, `"plus_minus": _i(p, ["sPlusMinusPoints"])` (usa helper `_i` existente; puede ser negativo → `_i` parsea `int(float(...))`) | RF-2, RF-3 |
| `_persist_game` | `app.py` | agregar `position`/`plus_minus` en `values(...)` y en `on_conflict_do_update set_(...)` de `PlayerGameStats` | RF-2, RF-3 |
| `search_players()` | `app.py` | agrupa `PlayerGameStats` por `(team_code, player_name)`; por partido calcula `calc_player_stats` (+ reb shares con `team_row`); promedia tasas **excluyendo None** (Feature 08) y conteos incluyendo 0; `position` = última no vacía; `plus_minus`/`minutes` promedio (`_parse_minutes`); `competitions` = set de `games.competition`. Precarga `Game` y `TeamGameStats` en dicts para evitar N+1 | RF-1 |

Reusa `calc_player_stats`, `_parse_minutes`, `_to_dict`. Importar `_parse_minutes` desde `stats_engine`.

## 5. Frontend — capa API (api.js)
`searchPlayers: () => _get("/api/search/players")` (mismo patrón que los demás métodos; `credentials:"same-origin"` heredado).

## 6. Frontend — UI (app.js)
- `sections` → `["import","league","team","compare","player","search"]`; `NAV_ITEMS.search = { icon:"🔎", label:"Buscar" }`.
- Sección `#sec-search`: panel de filtros + `<div id="search-results">`.
- `renderSearch()`: fetch `api.searchPlayers()` una vez (cache en `_searchData`); render form con: input nombre (contains, case-insensitive), selects Equipo / Competencia / Posición (poblados del dataset), y pares mín/máx para métricas numéricas (eFG%, TS%, OER, USO%, AST/g, TOV, STL, BLK, minutos, plus_minus, reb shares, etc.). Botón "Buscar" (aplica) y "Limpiar".
- Filtrado en cliente: AND de todos los filtros activos; un valor `null` en una métrica NO matchea filtros de rango sobre esa métrica (Feature 08 §9).
- Tabla de resultados: columnas = métricas filtradas/clave; ordenable por columna (reusa la lógica de sort de Liga: adaptar `_bindLeagueTableEvents` o replicar mínimamente); fila clickeable → `setSection("player"); renderPlayer(team_code, player)`.
- Contador "N jugadores"; estados vacío/sin-coincidencias con copy del spec §6.
- Helpers reusados: `PCT`, `DEC2`, `_colorCell`/`statClass` no aplican (no hay league avg acá) — mostrar valores crudos formateados.

## 7. Navegación
Nuevo item de nav `search` + sección `#sec-search`. Actualizar mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
Nuevo shape de `/api/search/players` (§3). Columnas nuevas `position`/`plus_minus` en `player_game_stats`.

## 9. Manejo de errores y offline (sw.js)
- `app.js`/`api.js` ya en `STATIC[]`. Bump `const CACHE="smart-basket-v5"` para que el SW sirva el JS nuevo (si no, cache-first sirve el viejo).
- Error de red al cargar el dataset → copy "No se pudo cargar el buscador".

## 10. Riesgos / decisiones
- **Re-import necesario**: los 4 partidos ya en DB tienen `position=''`/`plus_minus=0` hasta reimportar. Se reimporta vía `fetch_game_data` + `_persist_game` (script one-shot o `POST /api/seed` en dev). Registrar en `progress.md`.
- **Decisión (spec §9):** filtrado en frontend (dataset chico). Si crece → server-side (backlog).
- **Decisión:** `position` = última no vacía observada; jugador sin posición no matchea filtro de posición pero sí los demás.
- **Riesgo:** un jugador que aparece en 2 equipos (transferencia) genera 2 entradas (una por `(team_code,player_name)`). Aceptado para MVP (refleja su paso por cada equipo); documentado.
- **Plus/Minus negativo**: `plus_minus` puede ser negativo; el filtro de rango debe permitir mín negativos.
