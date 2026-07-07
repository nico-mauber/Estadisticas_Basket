# Plan — Feature 07 (tarea 9): Mapa de tiro del jugador dentro de Equipo

## 1. Enfoque
Puro frontend. Reusar `api.playerShots(teamCode, playerName)` + `_shotChartSVG(...)` (ya existentes). En la vista Equipo, agregar un botón "Ver mapa de tiro" junto al "Ver jugador" existente, que inserta la misma tarjeta de shot chart que arma `renderPlayer`, dentro de un contenedor dedicado `#team-shotmap` en la sección Equipo — sin cambiar de vista. Cero backend, cero `api.js`, cero esquema.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `frontend/js/app.js` (`renderApp` template) | js-view | agregar botón `#btn-show-shotmap` en `.team-controls` + contenedor `#team-shotmap` bajo la card de controles | RF-1 |
| `frontend/js/app.js` (nueva fn `renderTeamShotmap`) | js-view | fetch `api.playerShots` + render `_shotChartSVG` en `#team-shotmap` (mismo markup que `renderPlayer`) | RF-1, RF-2, RF-3 |
| `frontend/js/app.js` (`renderApp` listeners + `renderTeam`) | js-view | wire click de `#btn-show-shotmap`; limpiar `#team-shotmap` al cambiar de equipo | RF-1, RF-4 |
| `docs/frontend.md` | doc | documentar el mapa de tiro dentro de Equipo | — (cierre) |

## 3. Backend — rutas y modelos
Sin cambios. Reusa `GET /api/shots/<team_code>/<player_name>` tal cual.

## 4. Backend — lógica
Sin cambios.

## 5. Frontend — capa API (api.js)
Sin cambios — `api.playerShots(code, name)` ya existe.

## 6. Frontend — UI (app.js)
- `renderApp()` template, bloque `#sec-team`:
  - En `.team-controls`, tras `#btn-show-player`, agregar `<button class="btn btn-ghost" id="btn-show-shotmap">Ver mapa de tiro</button>`.
  - Tras la card de controles (antes de `#team-main`), agregar `<div id="team-shotmap"></div>`.
- Nueva `renderTeamShotmap(teamCode, playerName)`:
  - `const box = document.getElementById("team-shotmap"); box.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';`
  - `api.playerShots(teamCode, playerName).then(shots => { if (!shots || !shots.total_shots) { box.innerHTML=""; toast("Sin datos de tiro para este jugador","err"); return; } box.innerHTML = \`<div class="card"><div class="card-title">Shot chart por zonas <span style="...">— ${playerName}</span></div>${_shotChartSVG(shots.zones, shots.total_shots, shots.summary, shots.has_coordinates)}</div>\`; }).catch(()=>{ box.innerHTML=""; });`
  - Reusa exactamente el mismo `_shotChartSVG` y el mismo título/estilo que la tarjeta de `renderPlayer` (regla de reuso, Constitución 9).
- Listener en `renderApp()`: `#btn-show-shotmap` → lee `#team-select`/`#player-select`; si faltan, `toast("Selecciona equipo y jugador","err")`; si no, `renderTeamShotmap(team, player)` + scroll al contenedor.
- `renderTeam()` (o el `change` de `#team-select`): limpiar `#team-shotmap` (`innerHTML=""`) al cambiar de equipo para no dejar el mapa de un equipo previo.

## 7. Navegación
Sin cambios — no agrega vista ni hash. El botón "Ver jugador" sigue navegando a `#player` como antes.

## 8. Contratos de datos
Ninguno nuevo — consume el shape existente de `/api/shots` (`zones`, `total_shots`, `has_coordinates`, `summary`).

## 9. Manejo de errores y offline (sw.js)
Sin cambios — no agrega asset estático; `/api/shots/*` ya está fuera de caché por ser `/api/*`. `.catch` silencioso limpia el contenedor (mismo patrón que `renderPlayer`).

## 10. Riesgos / decisiones
- **Decisión (spec §9):** disparador = botón explícito "Ver mapa de tiro" (no auto-mostrar al elegir jugador), para no disparar fetch en cada cambio de select y respetar mobile-first (acción intencional).
- **Decisión:** contenedor dedicado `#team-shotmap` fuera de `#team-main` (que `_renderTeamContent` sobrescribe) — así el mapa no se borra al cambiar el filtro de período, pero sí se limpia al cambiar de equipo.
- Riesgo mínimo: duplicación de markup con `renderPlayer`. Se acepta (2 usos); si crece, se extrae un helper `_shotChartCard(playerName, shots)` — deuda menor documentada.
