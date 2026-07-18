# Progress — Feature 07 (tarea 9): Mapa de tiro del jugador dentro de Equipo

## Estado de tareas
- [x] T-D1 · Botón `#btn-show-shotmap` ("Ver mapa de tiro") + contenedor `#team-shotmap` en la vista Equipo · `frontend/js/app.js`
- [x] T-D2 · `renderTeamShotmap(teamCode, playerName)` — fetch `api.playerShots` + render `_shotChartSVG` en `#team-shotmap` (mismo markup/título que `renderPlayer`); `total_shots===0` → limpia + toast
- [x] T-D3 · Wire click de `#btn-show-shotmap`; `#team-shotmap` se limpia al cambiar de equipo
- [x] T-F1 · Backend arranca sin traceback (`python backend/app.py` → `/api/me` 200)
- [x] T-F2 · N/A — sin esquema
- [x] T-F3 · N/A — sin endpoint nuevo (reusa `/api/shots`)
- [x] T-F4 · Navegador real (Playwright): flujo Equipo → CNF → jugador → "Ver mapa de tiro" verificado
- [x] T-F5 · CA-1 a CA-5 recorridos

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | Navegador real: Equipo → CNF → L. Parodi → "Ver mapa de tiro" → `#team-shotmap` contiene `<svg>`; `stillOnTeam=true`, `playerSectionVisible=false` (no cambió de sección) |
| CA-2 | ✅ | El mapa lo renderiza `_shotChartSVG` (dispatcher 11/3 zonas por `has_coordinates`), la misma función verificada en Feature 01; el SVG se dibujó sin error |
| CA-3 | ✅ | El loop de verificación probó varios jugadores; los que no tienen tiros no insertaron tarjeta (box vacío + toast "Sin datos de tiro para este jugador") — sin error de consola |
| CA-4 | ✅ | Tras mostrar el mapa, "Ver jugador" sigue navegando: `verJugadorNavigates=true` (sección `#player` visible con stat-boxes) |
| CA-5 | ✅ | Mismo `_shotChartSVG` + mismo título "Shot chart por zonas — <jugador>" que `renderPlayer` (`mapCardTitle="Shot chart por zonas — L. Parodi"`) → visualmente idéntico |

## Gates técnicos
- Backend arranca sin traceback: ✅ (sin cambios de backend; server sirvió el front)
- `upgrade_db()` idempotente: N/A — sin esquema
- Endpoints probados: N/A nuevo — reusa `/api/shots` existente (probado indirectamente al renderizar el mapa)
- Consola del navegador sin errores JS: ✅ (único error = `favicon.ico` 404 preexistente; 0 errores JS de la feature)

## Desviaciones respecto a docs/ o plan
Ninguna — implementación siguió `plan.md`: botón explícito "Ver mapa de tiro", contenedor `#team-shotmap` fuera de `#team-main`, limpieza al cambiar de equipo, reuso de `api.playerShots`/`_shotChartSVG`.

## Docs a actualizar
- [x] `docs/frontend.md` — fila de la vista Equipo (botón "Ver mapa de tiro") + sección "Shot chart" (dos lugares que reusan el mismo render)

## Deuda / TODO
- Duplicación menor de markup de la tarjeta de shot chart entre `renderPlayer` y `renderTeamShotmap` (2 usos). Si aparece un 3er uso, extraer helper `_shotChartCard(playerName, shots)`.
- Evidencia visual: screenshot `feat07-team-shotmap.png` guardado por Playwright en su dir de salida; verificación funcional por asserts de DOM (svg presente, título correcto, sección correcta).
