# Plan — Feature 01: shot chart — modo simplificado sin coordenadas

## 1. Enfoque
Backend: calcular `has_coordinates` en `player_shots()` (`backend/app.py`) a partir de las filas `Shot` ya consultadas — sin query extra. Frontend: `_shotChartSVG()` en `frontend/js/app.js` recibe el flag y, si es `false`, delega a una nueva función `_shotChart3SVG()` que dibuja la misma cancha clara pero con 3 casilleros grandes (Pintura / Media / Triple) reusando los helpers de color/formato ya definidos dentro de `_shotChartSVG` (se extraen a nivel de módulo para reuso). No se toca `_classify_zone_11` ni el esquema de `shots`.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/app.py` | route | agregar `has_coordinates` a la respuesta de `player_shots()` | RF-1 |
| `frontend/js/app.js` | js-chart | extraer helpers de color/formato a nivel módulo; nueva función `_shotChart3SVG(zones, totalShots, summary)`; `_shotChartSVG` pasa a ser el dispatcher que elige 11-zonas vs 3-zonas según `has_coordinates` | RF-2, RF-3, RF-4 |
| `frontend/js/app.js` (llamada en `renderPlayer`) | js-view | pasar `shots.has_coordinates` a la función de render | RF-2, RF-3 |
| `docs/api.md` | doc | documentar campo nuevo `has_coordinates` en la respuesta de `/api/shots/<team_code>/<player_name>` | — (cierre de feature) |

## 3. Backend — rutas y modelos
Ruta existente, sin cambio de firma: `GET /api/shots/<team_code>/<player_name>`.
Response agrega un campo top-level:
```json
{
  "zones": { "...": "sin cambios" },
  "total_shots": 175,
  "has_coordinates": false,
  "summary": { "...": "sin cambios" }
}
```
Sin cambios de request, sin nuevos códigos de error.

## 4. Backend — lógica
| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `player_shots()` | `backend/app.py` | `has_coordinates = any((row.x or 0) != 0 or (row.y or 0) != 0 for row in rows)` — calculado sobre el mismo `rows` ya cargado por el query existente (línea 593), sin query adicional | RF-1 |

## 5. Frontend — capa API (api.js)
Sin cambios — `api.playerShots(teamCode, playerName)` ya devuelve el JSON completo del endpoint; el campo nuevo llega automáticamente.

## 6. Frontend — UI (app.js / charts.js)
- `_shotChartSVG(zones, totalShots, summary, hasCoordinates)`: pasa a ser un dispatcher delgado — si `hasCoordinates === false` llama a `_shotChart3SVG(...)` y retorna; si no, sigue el render de 11 zonas actual (sin cambios de geometría/estilo).
- Constantes compartidas (`dec1`, `dec2`, `boxFill`, paleta `courtBg/paintBg/restrictBg/cornerBg/line/boxText`) se mueven fuera de `_shotChartSVG` a nivel de módulo (arriba de ambas funciones) para que `_shotChart3SVG` las reuse sin duplicar — cumple regla de "reusar antes de crear".
- `_shotChart3SVG(zones, totalShots, summary)`: mismo `viewBox`/tamaño de cancha (340×320), mismas líneas de cancha (contorno, pintura, círculo restringido, arco de 3, aro, tablero) que ya dibuja `_shotChartSVG` — se extrae el bloque de "líneas de cancha" (líneas 893-915 actuales) a un helper `_courtLinesSVG()` reusado por ambas funciones. Sobre esa base dibuja 3 cajas grandes en vez de 11 chicas:
  - Triple (`top_key_3`) — caja arriba, centrada, fuera del arco.
  - Media (`mid_top`) — caja centrada dentro del arco, sobre la pintura.
  - Pintura (`restricted_area`) — caja verde dentro del semicírculo restringido (igual posición/estilo que hoy).
  - Mismo `lbl()` (share%, P/F, FG% grande) y `badge()` (P/F global + eFG%) que el modo 11 zonas.
- `renderPlayer()`: en el `.then(shots => ...)` que arma la card del shot chart, pasar `shots.has_coordinates` como 4º argumento a `_shotChartSVG`.

## 7. Navegación
Sin cambios — misma vista `#player`, misma card.

## 8. Contratos de datos
`has_coordinates: boolean` — `true` si ≥1 tiro del jugador tiene `x!=0` o `y!=0`; `false` si todos son `(0,0)` (partido importado vía fallback `pbp`, sin array `shot` de FIBA).

## 9. Manejo de errores y offline (sw.js)
Sin cambios — no se agrega ni modifica ningún asset estático; `/api/shots/...` ya está excluido de caché por ser ruta `/api/*`.

## 10. Riesgos / decisiones
- Riesgo: un jugador con muy pocos tiros donde por azar 1 solo tiro trae coordenadas reales y el resto no (mezcla dentro del mismo jugador, ej. importó un partido de una fuente con array `shot` y otro sin). Decisión: `has_coordinates` es a nivel de conjunto completo de tiros del jugador (any-tiene-coords) — si hay aunque sea 1 con coords reales, se prioriza el chart de 11 zonas (RF-3), porque en ese caso sí hay señal real de al menos parte de los tiros. Documentado aquí, no requiere spec aparte.
- Decisión: no se agrega columna a `shots` ni se persiste `has_coordinates` — se deriva en cada request (barato: ya se iteran todos los `rows`).
