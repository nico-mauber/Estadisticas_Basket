# Tasks — Feature 07 (tarea 9): Mapa de tiro del jugador dentro de Equipo

## Orden de ejecución

### Grupo D — Frontend: UI
- [ ] T-D1 · Agregar botón `#btn-show-shotmap` ("Ver mapa de tiro") en `.team-controls` y contenedor `#team-shotmap` bajo la card de controles · `frontend/js/app.js` (`renderApp` template) · cubre RF-1 · Done: el botón y el div existen en el DOM de la vista Equipo
- [ ] T-D2 · Crear `renderTeamShotmap(teamCode, playerName)` que fetchea `api.playerShots` y renderiza `_shotChartSVG` en `#team-shotmap` (mismo markup/estilo que `renderPlayer`); si `total_shots===0` limpia y toast · `frontend/js/app.js` · cubre RF-2, RF-3 · Done: llamar la fn con un jugador con tiros inserta la tarjeta del mapa; con jugador sin tiros no inserta card
- [ ] T-D3 · Wire click de `#btn-show-shotmap` (lee selects; valida; llama `renderTeamShotmap`); limpiar `#team-shotmap` al cambiar de equipo · `frontend/js/app.js` · cubre RF-1, RF-4 · Done: elegir equipo+jugador y pulsar el botón muestra el mapa en Equipo sin cambiar de sección; "Ver jugador" sigue navegando a Jugador

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (no se tocó backend, se corre igual para servir el front)
- [ ] T-F2 · N/A — sin esquema
- [ ] T-F3 · N/A — sin endpoint nuevo (reusa `/api/shots` existente)
- [ ] T-F4 · Navegador real: Equipo → elegir equipo+jugador → "Ver mapa de tiro" → mapa visible en Equipo; consola sin errores JS; "Ver jugador" sigue yendo a la vista Jugador
- [ ] T-F5 · Recorrer CA-1 a CA-5 del spec y marcar ✅/❌

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-D1, T-D2, T-D3, T-F4 |
| CA-2 | T-D2, T-F4 |
| CA-3 | T-D2, T-F4 |
| CA-4 | T-D3, T-F4 |
| CA-5 | T-D2, T-F4 |

## Dependencias externas
Ninguna — reusa endpoint + render existentes; datos ya en `backend/basketball.db`.
