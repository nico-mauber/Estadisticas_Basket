# Progress — Feature 06 (tarea 8): Buscador avanzado de jugadores

## Estado de tareas
- [x] T-A1 · Columnas `position` (String "") + `plus_minus` (Integer 0) en `PlayerGameStats` + `upgrade_db()` · `backend/database.py`
- [x] T-B1 · Parseo `playingPosition`→`position`, `sPlusMinusPoints`→`plus_minus` · `backend/fiba_fetcher.py`
- [x] T-B2 · Persistencia de `position`/`plus_minus` en `_persist_game` (values + on_conflict) · `backend/app.py`
- [x] T-B3 · `GET /api/search/players` (agrupa team+player, promedios null-aware, position/plus_minus/minutes/competitions) · `backend/app.py`
- [x] T-B4 · Re-import de los 4 partidos (2741559, 2820499, 2820500, 2820501) → columnas pobladas
- [x] T-C1 · `api.searchPlayers()` · `frontend/js/api.js`
- [x] T-D1 · `search` en `sections`+`NAV_ITEMS`; sección `#sec-search` · `frontend/js/app.js`
- [x] T-D2 · `renderSearch()` + `_applySearch()` (form, filtrado AND en cliente, contador) · `frontend/js/app.js`
- [x] T-D3 · `_renderSearchResults()` (tabla ordenable, fila→`renderPlayer`, "Limpiar") · `frontend/js/app.js`
- [x] T-D4 · `CACHE` `smart-basket-v4`→`v5` · `frontend/sw.js`
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · `upgrade_db` idempotente (corrido 2× sin error; columnas existen)
- [x] T-F3 · `GET /api/search/players` probado (74 jugadores, shape completo, position 94/95, plus_minus 80≠0)
- [x] T-F4 · Navegador real (Playwright): tab Buscar, filtros AND, canónico, orden, fila→Jugador, Limpiar, consola limpia
- [x] T-F5 · CA-1 a CA-7 recorridos

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/search/players` → array de 74, una entrada por jugador con `position`, `plus_minus` y métricas promedio; `games` = partidos del jugador |
| CA-2 | ✅ | Ejemplo canónico (G + eFG%>60% + USO%>20% + AST/g>6) aplicado en navegador: mecanismo correcto (inputs `%` 60/20 → 0.60/0.20). Resultado = 0 jugadores (correcto: ningún G del set de 4 partidos cumple los 3 umbrales) |
| CA-3 | ✅ | AND probado: solo-G=24, solo-Ast≥3=14, G∧Ast≥3=**8** (≤ min(24,14)) → intersección, no unión |
| CA-4 | ✅ | Click en fila (J. Feldeine) → `setSection("player")` + `renderPlayer`: vista Jugador visible con stat-boxes |
| CA-5 | ✅ | Click en encabezado "Pts" → orden desc [22.5, 21, 21, 21, 19] (monótono) |
| CA-6 | ✅ | "Limpiar" → 74 jugadores (reset completo de inputs/selects) |
| CA-7 | ✅ | `position`/`plus_minus` existen; `upgrade_db` corrido 2× sin error (idempotente) |

## Gates técnicos
- Backend arranca sin traceback: ✅ (`/api/me` 200, `/api/search/players` 200)
- `upgrade_db()` idempotente: ✅ (2 corridas, `ALTER TABLE ADD COLUMN` ignora columnas existentes)
- Endpoints probados: ✅ (`test_client` + navegador)
- Consola del navegador sin errores JS: ✅ (solo el 404 preexistente de favicon)

## Desviaciones respecto a docs/ o plan
- Ninguna funcional. `_i()` de `fiba_fetcher` parsea `sPlusMinusPoints` incluyendo negativos (`int(float(...))`) — verificado (valores -39, -32, etc. en la tabla).
- CSS nuevo agregado a `style.css` (`.search-filters`, `.search-ranges`, `.range-filter`, `.search-actions`, `.search-table`) — reusa tokens existentes; entra en `STATIC[]` (cache v5).

## Docs a actualizar
- [x] `docs/database.md` — columnas `position` / `plus_minus`
- [x] `docs/api.md` — endpoint `GET /api/search/players`
- [x] `docs/frontend.md` — vista "Buscar", `api.searchPlayers()`, cache `v5`

## Deuda / TODO
- Filtros diferidos (spec §8): Chaos, Offensive Dependency, Win Shares, "Rating" (sin fórmula — `[NEEDS CLARIFICATION]`); Edad (no está en el feed FIBA); Defensive Rating / Pace por jugador.
- Filtrado en frontend sobre el dataset completo; migrar a server-side si el volumen crece.
- Un jugador transferido aparece una vez por equipo (aceptado en MVP).
- Evidencia visual: `feat06-buscador.png` (full page) — vista Buscar con filtro G + Ast/g≥3 → 8 jugadores.
