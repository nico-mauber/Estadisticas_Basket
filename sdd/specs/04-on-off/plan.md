# Plan — Feature 04: ON / OFF

## 1. Enfoque
Reusa íntegramente el motor de `backend/lineups.py` (Feature 03): `game_starters()` + `build_segments()` ya generan tramos con el quinteto completo en cancha; ON = tramos donde el jugador ∈ `on_court`, OFF = el resto (partición exhaustiva y disjunta por construcción — CA-5 se cumple estructuralmente, no por cálculo aparte). Nueva función `onoff_stats()` en el mismo módulo. Endpoint nuevo `GET /api/onoff/<team_code>/<player_name>`. Sin cambios de esquema.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/lineups.py` | service | `_side_metrics()`, `onoff_stats()` | RF-1..RF-5 |
| `backend/app.py` | route | `GET /api/onoff/<team_code>/<player_name>` (reusa `_team_pbp_games` de Feature 03) + cálculo de `usg_pct` promedio (reusa `calc_player_stats`) | RF-6, RF-7 |
| `frontend/js/api.js` | api | `api.onoff(team, player)` | — |
| `frontend/js/app.js` | UI | panel ON/OFF en vista Equipo: selector de jugador + tabla `ON \| OFF \| Δ` | CA-3 |
| `frontend/sw.js` | cache | bump versión | — |
| `docs/api.md`, `docs/architecture.md`, `docs/frontend.md` | doc | endpoint nuevo, apartado nuevo | — (cierre) |

## 3. Backend — rutas y modelos
- Sin cambios de esquema.
- `GET /api/onoff/<team_code>/<player_name>` (login_required): `404 {"error":"Sin datos ON/OFF para este jugador"}` si el jugador no tiene `player_game_stats` en ese equipo o el equipo no tiene pbp. Response: shape de `spec.md` §5 (`on`, `off`, `diff`, `usg_pct`).

## 4. Backend — lógica
| Función | Módulo | Detalle | RF |
|---|---|---|---|
| `_side_metrics(boxes, opp_boxes, seconds)` | `lineups.py` | agrega cajas de un lado (ON u OFF) → posesiones/pts_for/pts_against/oer/der/net/eFG%/TS% | RF-2, RF-3, RF-5 |
| `onoff_stats(games, team_code, player_name)` | `lineups.py` | por partido válido: `build_segments`, separa tramos por `player_name in on_court`, acumula ON/OFF (equipo + rival + segundos); calcula `diff = ON−OFF` (null si algún lado es null) | RF-1..RF-5 |
| `usg_pct` | `app.py` | promedio de `calc_player_stats(...).uso_pct` sobre `player_game_stats` del jugador (mismo patrón que `search_players`) | RF-6 |

## 5. Frontend — capa API (api.js)
```js
api.onoff: (team, player) => apiFetch(`/api/onoff/${team}/${encodeURIComponent(player)}`)
```

## 6. Frontend — UI
Panel nuevo en `#sec-team`, asociado al `#player-select` existente: botón "Ver ON/OFF" → tabla de 3 columnas (`ON | OFF | Δ`) para OER/DER/Net Rating/eFG%/TS%, con `_colorCell` en Δ (verde si ON mejora al equipo — considerar `der`/`opp` como "menor es mejor" al colorear, igual que `league_averages.lower_is_better`). Debajo: muestra ON/OFF (posesiones, segundos). Si `off.possessions==0` (o `on`), mostrar "sin muestra" en vez de la fila numérica (evita `null`/`NaN` visual).

## 7. Navegación
Sin cambios (dentro de la vista Equipo existente).

## 8. Contratos de datos
Shape de `GET /api/onoff/<team_code>/<player_name>` — ver `spec.md` §5.

## 9. Manejo de errores y offline (sw.js)
`/api/onoff/*` cae bajo `/api/*` (siempre red). Bump de cache version.

## 10. Riesgos / decisiones
- **Partición exhaustiva por construcción**: como ON/OFF nacen de los mismos `segments` de `build_segments`, `on.possessions + off.possessions` no puede divergir de las posesiones totales de los partidos usados — no requiere verificación numérica adicional más allá de un chequeo de suma (CA-5).
- **"Chaos" / "Offensive Dependency"**: fuera del MVP (sin fórmula definida, spec §9) — no se tocan en esta implementación.
- **Reuso exacto de `build_segments`**: cualquier fix futuro al motor de segmentos (ej. precisión de `seconds`) beneficia a Feature 03 y 04 por igual, sin duplicar lógica.
