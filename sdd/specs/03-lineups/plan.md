# Plan — Feature 03: Lineups (combinaciones de 3, 4 y 5 jugadores)

## 1. Enfoque
Nuevo módulo `backend/lineups.py` — motor de reconstrucción de quintetos, COMPARTIDO con Feature 04 (ON/OFF). Camina `pbp_events` de cada partido del equipo (ordenados por `action_number`); el quinteto en cancha solo cambia con eventos `substitution` propios del equipo (`sub_type` in/out). Parte en tramos ("segments"); un tramo cuya `on_court` incluye a los K jugadores seleccionados entra en el agregado. Métricas con las fórmulas exactas de `stats_engine`/`docs/metrics.md`, reimplementadas localmente en `lineups.py` (mismo patrón que `clutch.py`, que ya no llama a `calc_team_stats` para no acoplarse a stats por-partido). Endpoint nuevo `GET /api/lineup/<team_code>?players=A|B|C`. Sin cambios de esquema (usa `pbp_events`/`starter` de Feature 02).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/lineups.py` | service (NUEVO) | `game_starters`, `build_segments`, `_agg`, `_metrics`, `lineup_stats()` | RF-1..RF-5, RF-7 |
| `backend/app.py` | route | `_team_pbp_games()` helper + `GET /api/lineup/<team_code>` | RF-6 |
| `frontend/js/api.js` | api | `api.lineup(team, players[])` | — |
| `frontend/js/app.js` | UI | apartado "Combinaciones" en vista Equipo: multi-select 3–5 jugadores + tarjeta de resultado | CA-4, CA-6 |
| `frontend/sw.js` | cache | bump versión | — |
| `docs/api.md`, `docs/architecture.md`, `docs/frontend.md` | doc | endpoint nuevo, módulo nuevo, apartado nuevo | — (cierre) |

## 3. Backend — rutas y modelos
- Sin cambios de esquema.
- `GET /api/lineup/<team_code>?players=A|B|C` (login_required): valida 3–5 nombres separados por `|` → `400 {"error":"Elegí entre 3 y 5 jugadores"}` si no. `404` si el equipo no tiene partidos con pbp. Response: shape exacto de `spec.md` §5 (`games_used`, `games_excluded`, `sample`, `metrics`, `raw`, `leaders`).

## 4. Backend — lógica
| Función | Módulo | Detalle | RF |
|---|---|---|---|
| `game_starters(player_rows, team_code)` | `lineups.py` | 5 nombres con `starter=1`; `None` si ≠5 (partido inconsistente) | RF-1, RF-7 |
| `build_segments(events, team_code, starters)` | `lineups.py` | quinteto inicial = starters; cada `substitution` propia cierra el tramo vigente y aplica in/out; segundos por tramo acumulados incrementalmente (`clock_secs` decreciente dentro del período, offset `PERIOD_LEN` en cambio de período) | RF-1, RF-2 |
| `_agg(evs, team_code)` | `lineups.py` | agrega stats crudas de un equipo sobre una lista de eventos (mismo esquema que `clutch._agg`) | RF-2 |
| `_metrics(tb, ob)` | `lineups.py` | POS/OER/DER/Net/eFG%/TS% con `_safe_div` (null si denominador 0, Feature 08) | RF-3 |
| `_leaders(evs, players)` | `lineups.py` | top scorer/assister/rebounder entre los K jugadores, solo eventos de los tramos que matchean | RF-5 |
| `lineup_stats(games, team_code, players)` | `lineups.py` | orquesta: por partido válido, filtra tramos donde `players ⊆ on_court`, suma cajas + segundos; devuelve shape final | RF-1..RF-5, RF-7 |
| `_team_pbp_games(team_code)` | `app.py` | por cada `game_id` del equipo con `pbp_events`, junta `events` (ordenados), `player_rows`, `opp_code` (de `Game.home_code`/`away_code`) | RF-6 |

## 5. Frontend — capa API (api.js)
```js
api.lineup: (team, players) => apiFetch(`/api/lineup/${team}?players=${players.map(encodeURIComponent).join("|")}`)
```

## 6. Frontend — UI
Apartado nuevo en `#sec-team`, debajo del contenido existente (después de "Ver mapa de tiro"): multi-select (checkboxes) con el roster del equipo actual (de `api.players`), validación 3–5 en el cliente antes de llamar (toast `"Elegí entre 3 y 5 jugadores"` si no), botón "Analizar combinación". Resultado: tarjeta con `statBox` reusado para OER/DER/Net/eFG%/TS%, línea de muestra ("N posesiones · M' en cancha"), aviso de muestra chica si `possessions<10`, y 3 líderes. Estado vacío si el equipo no tiene pbp (reusa el copy de Feature 02).

## 7. Navegación
Sin cambios (dentro de la vista Equipo existente).

## 8. Contratos de datos
Shape de `GET /api/lineup/<team_code>` — ver `spec.md` §5.

## 9. Manejo de errores y offline (sw.js)
`/api/lineup/*` cae bajo `/api/*` (siempre red). Bump de cache version para forzar refresco del JS nuevo.

## 10. Riesgos / decisiones
- **Fórmulas reimplementadas en `lineups.py`** (no reusa `calc_team_stats`): ese helper espera un partido completo (incluye `pace`, `minutes`, etc. que no aplican a un tramo). Se reimplementan solo POS/OER/DER/Net/eFG%/TS% con `_safe_div`, igual que ya hace `clutch.py`. Consistencia verificada por unit-test (T-F3).
- **`seconds` es aproximado**: asume duración fija por período (`PERIOD_LEN`); no modela relojes detenidos ni tiempo de posesión real (spec §9, decisión ya resuelta). Válido para el aviso de "muestra chica", no para reportes de precisión de reloj.
- **Agregación global multi-partido** (no por-partido), por decisión de spec §9.
- **Reuso del motor por Feature 04**: `game_starters`/`build_segments`/`_agg`/`_metrics` son genéricos (no asumen K jugadores); Feature 04 los reusa vía partición ON/OFF sobre el mismo `build_segments`.
