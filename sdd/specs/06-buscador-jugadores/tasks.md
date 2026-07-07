# Tasks — Feature 06 (tarea 8): Buscador avanzado de jugadores

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Agregar columnas `position` (String default "") y `plus_minus` (Integer default 0) a `PlayerGameStats` + a `upgrade_db()` · `backend/database.py` · cubre RF-2, RF-3 · Done: `python backend/database.py` ×2 sin error; columnas existen

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Parsear `playingPosition`→`position` y `sPlusMinusPoints`→`plus_minus` en `player_row` · `backend/fiba_fetcher.py` · cubre RF-2, RF-3 · Done: `fetch_game_data` de un juego devuelve players con `position` no vacío y `plus_minus` entero (puede ser negativo)
- [ ] T-B2 · Persistir `position`/`plus_minus` en `_persist_game` (values + on_conflict update) · `backend/app.py` · cubre RF-2, RF-3 · Done: tras importar, `player_game_stats.position`/`plus_minus` poblados
- [ ] T-B3 · Nuevo `GET /api/search/players` (agrupa por team+player, promedios null-aware, position/plus_minus/minutes/competitions) · `backend/app.py` · cubre RF-1 · Done: `curl /api/search/players` devuelve array con una entrada por jugador y todos los campos del shape del plan
- [ ] T-B4 · Re-import de los 4 partidos para poblar las columnas nuevas · script one-shot · cubre RF-2, RF-3 · Done: `position` no vacío para la mayoría de jugadores; algún `plus_minus != 0`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.searchPlayers()` → `GET /api/search/players` · `frontend/js/api.js` · cubre RF-1 · Done: método existe y devuelve el array

### Grupo D — Frontend: UI
- [ ] T-D1 · Agregar `search` a `sections` + `NAV_ITEMS`; sección `#sec-search` en `renderApp` · `frontend/js/app.js` · cubre RF-7 · Done: aparece el tab "Buscar" y su sección
- [ ] T-D2 · `renderSearch()`: fetch dataset, render form (nombre/equipo/competencia/posición/rangos), filtrado AND en cliente, contador · `frontend/js/app.js` · cubre RF-4, RF-5 · Done: aplicar filtros combinados reduce la tabla (AND)
- [ ] T-D3 · Tabla de resultados ordenable + fila clickeable → `renderPlayer` + botón "Limpiar" · `frontend/js/app.js` · cubre RF-6 · Done: click en encabezado ordena; click en fila abre vista Jugador; "Limpiar" resetea
- [ ] T-D4 · Bump `CACHE` en `sw.js` a v5 · `frontend/sw.js` · cubre — · Done: el navegador carga el JS nuevo

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `python backend/database.py` ×2 sin error (upgrade_db idempotente)
- [ ] T-F3 · `GET /api/search/players` probado: shape correcto, position/plus_minus poblados tras re-import
- [ ] T-F4 · Navegador real: tab Buscar → ejemplo canónico (G + eFG%>60% + USO%>20% + AST/g>6) filtra correcto; fila→Jugador; orden; limpiar; consola sin errores JS
- [ ] T-F5 · Recorrer CA-1 a CA-7 del spec y marcar ✅/❌

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B3, T-B4, T-F3 |
| CA-2 | T-B3, T-D2, T-F4 |
| CA-3 | T-D2, T-F4 |
| CA-4 | T-D3, T-F4 |
| CA-5 | T-D3, T-F4 |
| CA-6 | T-D3, T-F4 |
| CA-7 | T-A1, T-F2 |

## Dependencias externas
- Re-import de los 4 partidos (T-B4) requiere red a FIBA LiveStats (mismos SEED_URLS). Debe correr DESPUÉS de T-A1/T-B1/T-B2 (esquema + parseo listos).
