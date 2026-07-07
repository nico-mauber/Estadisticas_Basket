# Tasks — Feature 01: shot chart — modo simplificado sin coordenadas

## Orden de ejecución

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Agregar `has_coordinates` a la respuesta de `player_shots()` (calculado sobre `rows` ya cargado) · `backend/app.py` · cubre RF-1 · Done: `curl` a `/api/shots/<team>/<player>` de un jugador con datos FUBB reales devuelve `"has_coordinates": false`

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · Extraer paleta/heatmap/formatters (`courtBg`, `paintBg`, `restrictBg`, `cornerBg`, `line`, `boxText`, `boxFill`, `dec1`, `dec2`) de dentro de `_shotChartSVG` a nivel de módulo en `frontend/js/app.js` · cubre RF-4 · Done: `_shotChartSVG` sigue renderizando igual (comparar output visual del modo 11 zonas antes/después)
- [ ] T-D2 · Extraer bloque de líneas de cancha (contorno, pintura, círculo restringido, arco 3pt, aro, tablero) a helper `_courtLinesSVG()` · `frontend/js/app.js` · cubre RF-4 · Done: modo 11 zonas se ve idéntico a antes de la extracción
- [ ] T-D3 · Crear `_shotChart3SVG(zones, totalShots, summary)` con 3 casilleros grandes (Triple/Media/Pintura) reusando `_courtLinesSVG()`, `lbl()`, `badge()`, paleta compartida · `frontend/js/app.js` · cubre RF-2, RF-4 · Done: SVG renderiza 3 cajas con share%/P/F/FG% y badge, mismo heatmap de color que modo 11 zonas
- [ ] T-D4 · Convertir `_shotChartSVG` en dispatcher: recibe `hasCoordinates`, delega a `_shotChart3SVG` si `false`, sino sigue con el render de 11 zonas actual · `frontend/js/app.js` · cubre RF-2, RF-3 · Done: con `has_coordinates:true` no cambia el output respecto al comportamiento previo a la feature
- [ ] T-D5 · `renderPlayer()`: pasar `shots.has_coordinates` como 4º argumento al llamar `_shotChartSVG` · `frontend/js/app.js` · cubre RF-2, RF-3 · Done: la card del shot chart en la vista Jugador refleja el modo correcto según el jugador consultado

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · N/A — no se tocó esquema (`shots` sin cambios de columnas)
- [ ] T-F3 · `curl http://localhost:5000/api/shots/<team>/<player>` (con cookie de sesión si aplica) para un jugador con datos FUBB reales → verificar `has_coordinates:false` y que `zones` solo tiene `attempts>0` en `restricted_area`/`mid_top`/`top_key_3`
- [ ] T-F4 · Abrir vista Jugador en navegador para ese jugador → consola sin errores JS, chart de 3 zonas visible con badge
- [ ] T-F5 · Recorrer CA-1 a CA-4 del spec y marcar ✅/❌ con evidencia

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B1, T-F3 |
| CA-2 | T-D3, T-D4, T-D5, T-F3, T-F4 |
| CA-3 | T-D4, T-D5, T-F4 |
| CA-4 | T-D1, T-D3, T-F4 |

## Dependencias externas
Ninguna (no requiere env var nueva, ni dato semilla adicional — el escenario "sin coordenadas" ya está presente en `backend/basketball.db` con los partidos FUBB ya importados).
