# Tasks — F-05: Comparar jugadores

> **ID:** F-05 · **Prioridad:** P1 · **Fase y orden:** 2·08
> **Depende de:** T-05 · T-01 · C-08 · X-01
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** plan.md de este mismo requisito

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- (sin tareas: F-05 no toca esquema — reusa `players`/`competitions` existentes)

### Grupo B — Backend: lógica y rutas
- (sin tareas: F-05 no crea endpoints ni funciones de backend nuevas — consume `GET /api/metrics/player` de T-05/T-01, o el legado `GET /api/player/<team_code>/<player_name>` como degradación documentada en plan.md §10)

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.metrics("player", {id, competition})` (si T-05 no lo agregó aún) · `frontend/js/api.js` · cubre RF-5 · Done: llamada resuelve el shape §7.3

### Grupo D — Frontend: UI
- [ ] T-D1 · Pestaña "Jugadores" dentro de S6 Comparar (registro en `tabs.js`/router) · `frontend/js/views/comparar.js` (o `app.js`) · cubre RF-1 · Done: `#/comparar/jugadores` muestra dos selectores de jugador
- [ ] T-D2 · Selectores de jugador con nombre + equipo + competencia visibles (desambiguación de homónimos) · cubre RF-1, RF-3 · Done: buscar un nombre repetido en dos equipos distintos muestra ambas opciones diferenciadas
- [ ] T-D3 · `renderComparePlayers()`: pide `api.metrics("player", …)` (o `api.player` legado) para A y B en paralelo, resuelve `competition_id` por jugador (RF-4) · cubre RF-2, RF-4, RF-5 · Done: comparar dos jugadores de competencias distintas no produce error y cada uno trae su propia competencia
- [ ] T-D4 · Tabla de métricas enfrentadas (tiro + conteos) con colores ganador/perdedor y "—" en nulos, igual formato que `renderCompare()` de equipos · cubre RF-2, RF-7 · Done: un jugador sin triples intentados muestra "—" en la fila de 3, sin color
- [ ] T-D5 · Bloque de métricas avanzadas (tabla `advRow` con claves de jugador) · cubre RF-2 · Done: la tabla muestra OER/DER/Net/eFG%/TS%/PACE/OR%/DR%/TO%/AS%/PTS/POS de ambos jugadores
- [ ] T-D6 · `drawComparePlayerRadar` (o adaptación de `drawCompareRadar`) normalizado a percentil por competencia propia · `frontend/js/charts.js` · cubre RF-6 · Done: el radar se dibuja sin error con dos jugadores de competencias distintas
- [ ] T-D7 [P] · Validación "Elegí dos jugadores distintos" (por `player_id` o `team_code`+nombre normalizado) · cubre RF-8, CA-5 · Done: elegir el mismo jugador en A y B muestra el mensaje y no ejecuta la comparación
- [ ] T-D8 [P] · Deep link `#/comparar/jugadores?a=<id>&b=<id>` y precarga desde la acción "Comparar" del Plantel (F-08, si está implementado) · cubre RF-9 · Done: abrir la URL con `a`/`b` precarga ambos selectores

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado vacío "Elegí dos jugadores para comparar" antes de la primera comparación · cubre CA-1 (parcialmente)
- [ ] T-E2 [P] · Bump de `sw.js` `CACHE` si se agregan archivos nuevos y X-01 no migró aún a runtime caching

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · N/A — F-05 no cambia esquema ni crea endpoints backend
- [ ] T-F3 · `curl`/navegador: confirmar que `GET /api/metrics/player?id=<id>&competition=<comp>` (o el legado) responde 200 para dos jugadores de competencias distintas del dataset
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la comparación de jugadores completa
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅/❌
- [ ] T-F6 · CA-1 (CA del cliente): en el navegador, comparar dos jugadores válidos y confirmar que aparecen radar, tabla enfrentada y avanzadas con la misma estructura visual que la comparación de equipos
- [ ] T-F7 · CA-2: comparar dos jugadores de equipos y competencias distintas del dataset y confirmar que no hay error y que cada uno muestra la etiqueta de su propia competencia junto al percentil
- [ ] T-F8 · CA-3: identificar en el dataset un jugador sin triples intentados, compararlo y confirmar "—" en la fila de 3 sin color ganador/perdedor
- [ ] T-F9 · CA-4: comparar los mismos dos valores que trae `GET /api/player/<team>/<name>` individualmente contra lo mostrado en la tabla enfrentada de F-05 (deben coincidir numéricamente)
- [ ] T-F10 · CA-5: elegir el mismo jugador en A y B y confirmar el mensaje de validación sin ejecutar la comparación
- [ ] T-F11 · CA-6: si F-08 está implementado, desde el Plantel marcar dos jugadores y "Comparar", y confirmar que la comparación se abre con ambos precargados; si F-08 no está implementado, verificar solo que la URL objetivo se arma con los `player_id`/nombres correctos

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-D1, T-D3, T-D4, T-D5, T-D6, T-F6 |
| CA-2 | T-D3, T-F7 |
| CA-3 | T-D4, T-F8 |
| CA-4 | T-D3, T-F9 |
| CA-5 | T-D7, T-F10 |
| CA-6 | T-D8, T-F11 (depende de F-08) |

## Dependencias externas
- **T-05 debe exponer `stats_engine.compute_standard`/`GET /api/metrics/player`** antes de T-C1/T-D3 (o F-05 usa el
  legado `GET /api/player/<team>/<name>` con degradación documentada en plan.md §10).
- **T-01 debe exponer `population.ficha` con población por competencia** antes de que RF-4/T-D3/T-D6 tengan percentil
  real; sin T-01, la comparación funciona igual pero sin percentil (degradación).
- **C-08 (ids de jugador) es opcional**: sin él, la identificación usa `team_code` + nombre normalizado (T-D7).
- **X-01 debe registrar la pestaña `jugadores` de S6** antes de T-D1 (o F-05 la agrega como sección propia si X-01 no
  llegó).
- **F-08 (Plantel) es opcional para T-F11/CA-6**: sin F-08, se verifica solo el armado de URL.
- **Dataset de verificación**: los 13 partidos del seed, con al menos dos jugadores de competencias distintas (si el
  dataset tiene una sola competencia real, T-F7/CA-2 se verifica con una segunda competencia de copia, como indica R-05
  de la arquitectura) y un jugador sin triples intentados.
- Ninguna variable de entorno nueva.
