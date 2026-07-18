# Progress — Feature 01: shot chart — modo simplificado sin coordenadas

## Estado de tareas
- [x] T-B1 · `has_coordinates` agregado a `player_shots()` · `backend/app.py`
- [x] T-D1 · Paleta/heatmap/formatters extraídos a nivel de módulo (`SC_*`, `_scBoxFill`, `_scDec1/2`)
- [x] T-D2 · Líneas de cancha extraídas a `_courtLinesSVG()`
- [x] T-D3 · `_shotChart3SVG()` creado (Triple/Media/Pintura)
- [x] T-D4 · `_shotChartSVG()` convertido en dispatcher (`_shotChart11SVG` vs `_shotChart3SVG`)
- [x] T-D5 · `renderPlayer()` pasa `shots.has_coordinates` al dispatcher
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · N/A (sin cambio de esquema)
- [x] T-F3 · Endpoint probado con servidor real (`python backend/app.py` + `curl`)
- [x] T-F4 · Verificado en navegador real vía Playwright (Equipo → HEBRAICA Y MACABI → J. Canty → Ver jugador): shot chart de 3 zonas visible, sin errores de consola nuevos
- [x] T-F5 · CA-1 a CA-4 recorridos

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `test_client().get('/api/shots/HYM/J. Canty')` → `has_coordinates: false`, `total_shots: 28` |
| CA-2 | ✅ | Screenshot navegador real: vista Jugador de J. Canty muestra exactamente 2 casilleros con datos (Media 40,0%, Pintura 72,2% — Triple en 0 intentos no se dibuja) + badge P/F 1,21 / eFG% 60,7% |
| CA-3 | ✅ | Render Node con `zones` "ricas" (las 11 claves con `attempts>0`) vía `_shotChart11SVG` → 11 casilleros; `_shotChartSVG(..., true)` delega a `_shotChart11SVG` sin alterar su salida |
| CA-4 | ✅ | Screenshot confirma paleta compartida (verde ≥1.00 P/F, rojo <0.85 P/F, badge naranja/oliva) — `_scBoxFill`/`_scBadge` son las mismas funciones para ambos modos |

## Gates técnicos
- Backend arranca sin traceback: ✅ (`python backend/app.py` sirviendo en `:5000`)
- `upgrade_db()` idempotente (si aplica): N/A — sin cambio de esquema
- Endpoints probados manualmente: ✅ (`curl http://localhost:5000/api/shots/HYM/J.%20Canty` → `has_coordinates:false`)
- Consola del navegador sin errores JS: ✅ (único error preexistente: 404 de `favicon.ico`, no relacionado a esta feature)

## Desviaciones respecto a docs/ o plan
Ninguna — implementación siguió `plan.md` tal cual (extracción de helpers a nivel de módulo, `_courtLinesSVG`, dispatcher `_shotChartSVG`).

## Docs a actualizar
- [x] `docs/api.md` — agregado `has_coordinates` a la respuesta de `/api/shots/<team_code>/<player_name>` + nota de fallback a 3 zonas
- [x] `docs/frontend.md` — nueva sección "Shot chart" documentando el dispatcher 11/3 zonas; fila de la vista Jugador actualizada

## Deuda / TODO
Ninguna.
