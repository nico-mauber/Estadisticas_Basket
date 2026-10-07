# Tasks — C-03: Mapas de tiro: PPT y detalle por zona

> **ID:** C-03 · **Fase y orden:** 1·17 · **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

## Orden de ejecución

### Grupo A — Backend: módulo `shot_zones.py`
- [ ] T-A1 · Crear `backend/shot_zones.py` y mover literal `ZONE_KEYS_11`, `ZONE_POINTS`, `_2PT_ZONES`, `_3PT_ZONES`
  desde `backend/app.py`; actualizar los imports de `app.py` para tomarlos de `shot_zones` · cubre RF-8 · Done:
  `grep -n "ZONE_KEYS_11 = \[" backend/app.py` no encuentra la definición (solo el import); el backend arranca sin
  error de importación.
- [ ] T-A2 · Mover `_classify_zone_11` a `shot_zones.classify_zone(action_type, sub_type, court_x, court_y,
  qualifiers=None)` (mismo cuerpo, nombres de parámetro actualizados) · `backend/shot_zones.py` · cubre RF-8, RF-10
  · Done: `classify_zone("2pt", "layup", 0, 0)` devuelve `"restricted_area"` (mismo resultado que
  `_classify_zone_11` hoy con los mismos argumentos).
- [ ] T-A3 · `to_half_court(court_x, court_y) -> tuple[float, float]` (identidad mientras F-11 no esté integrado,
  ver plan §10 D-1) · `backend/shot_zones.py` · cubre RF-8 · Done: `to_half_court(50, 50) == (50, 50)` en el estado
  actual (sin transformación real disponible).
- [ ] T-A4 · `zone_table(shots, *, context_totals=None) -> dict` (reemplaza `_zones_from_shots`; agrega `share` por
  zona) · `backend/shot_zones.py` · cubre RF-1, RF-10 · Done: con una lista de tiros de prueba, `fg_pct`/`efg_pct`/
  `ppt` de cada zona son idénticos a los que produce `_zones_from_shots` hoy sobre la misma entrada; `share` suma
  1,0 entre zonas con intentos.
- [ ] T-A5 [P] · `zones_with_stats(entity_type, entity_id, comp_id, ctx) -> dict` (arma `zone_table` + adjunta
  `percentile`/`sample` por zona; `percentile: null` con razón si T-01 no está disponible, ver plan §10 D-3) ·
  `backend/shot_zones.py` · cubre RF-5, RF-6, RF-7 · Done: sin población disponible, cada zona con intentos trae
  `percentile: null` y una razón no vacía; con `zones_with_stats` llamado dos veces sobre los mismos datos, el
  resultado es idéntico (determinismo).
- [ ] T-A6 · Retirar `_classify_zone_11`, `ZONE_KEYS_11`, `ZONE_POINTS`, `_2PT_ZONES`, `_3PT_ZONES`,
  `_zones_from_shots` de `backend/app.py` (quedan solo los imports de `shot_zones`) · cubre RF-8, RF-10 · Done:
  `grep -n "_classify_zone_11\|_zones_from_shots" backend/app.py` solo encuentra las líneas de import.

### Grupo B — Backend: rutas
- [ ] T-B1 · `GET /api/shot-zones` (NUEVO): valida `entity ∈ {team, player}` → 400 `parametro_invalido` si no;
  resuelve equipo/jugador → 404 si no existe; resuelve competencia (F-11) → 400 `competencia_inexistente`; filtra
  `Shot` por entidad y contexto (`competition`/`last`); llama `shot_zones.zones_with_stats(...)` · `backend/app.py`
  · cubre RF-2, RF-4, RF-5 · Done: `curl "http://localhost:5000/api/shot-zones?entity=team&id=CNF"` devuelve el
  shape de §3.2 del plan con las 11 zonas.
- [ ] T-B2 · `curl` con `entity` inválido (`entity=equipo`) responde 400 con el mensaje exacto · Done: incluido en
  T-B1, verificado por separado como caso de error.
- [ ] T-B3 · `player_shots`/`team_shots` (existentes) delegan en `shot_zones.zones_with_stats(...)` y agregan
  `share` a cada zona del shape actual, sin quitar ni renombrar ningún campo existente · `backend/app.py` · cubre
  RF-2 · Done: `curl http://localhost:5000/api/shots/CNF` devuelve el mismo shape que hoy (`zones`, `total_shots`,
  `has_coordinates`, `summary`) más `share` en cada zona.

### Grupo C — Backend: verificación de nulos y no-regresión (sin cambio de código, solo confirmación)
- [ ] T-C1 · Confirmar que una zona con `attempts == 0` sigue devolviendo `fg_pct`/`efg_pct`/`ppt`/`percentile` en
  `null` (nunca `0`/`0.00`) tras el movimiento a `shot_zones.py` · cubre RF-3, RF-10 · Done: zona sin intentos en la
  respuesta de `/api/shot-zones` trae los 4 campos en `null` y `share: 0.0`.
- [ ] T-C2 [P] · Confirmar que `summary.ppt`/`summary.efg_pct` de `/api/shots/...` no cambiaron respecto del código
  anterior a este plan (comparación byte a byte de una respuesta de prueba antes/después) · cubre RF-10 · Done: diff
  vacío entre la respuesta capturada antes de mover el código y la respuesta tras T-A1…T-B3, salvo el campo `share`
  agregado.

### Grupo D — Frontend: api.js
- [ ] T-D1 · `api.shotZones(params)` (`GET /api/shot-zones` + `qs(params)`) · `frontend/js/api.js` · cubre RF-2,
  RF-4 · Done: `api.shotZones({entity: 'team', id: 'CNF', last: 5})` arma la URL
  `/api/shot-zones?entity=team&id=CNF&last=5`.

### Grupo E — Frontend: componente `shot-chart.js`
- [ ] T-E1 · Crear `frontend/js/components/shot-chart.js` y mover literal `_courtLinesSVG`, `_scSvgWrap`,
  `_shotChart11SVG`, `_shotChart3SVG` desde `frontend/js/app.js` (renombradas según §6 del plan si aplica) · cubre
  RF-9 · Done: el SVG resultante de una zona de prueba es visualmente idéntico al actual (mismas coordenadas de
  cancha, mismos colores de fondo de pintura/esquinas).
- [ ] T-E2 · `shotChart(zonesPayload, {mode, colorBy})`: cada caja de zona muestra FG%/eFG%/PPT (sin el peso, que
  pasa al tooltip) y agrega `data-zone="<key>"` · `frontend/js/components/shot-chart.js` · cubre RF-1, RF-2 · Done:
  el HTML/SVG resultante tiene un elemento `[data-zone="restricted_area"]` (y análogos) por cada zona con intentos.
- [ ] T-E3 · Color de fondo de cada caja por `percentileColor(zone.percentile)` en vez de `_scBoxFill` (umbrales
  fijos); `percentile: null` → color neutro · `frontend/js/components/shot-chart.js` · cubre RF-6 · Done: dos zonas
  de prueba con percentiles 85 y 15 producen colores de fondo distintos y visualmente en extremos opuestos de la
  escala; una zona con `percentile: null` usa el color neutro, no verde ni rojo.
- [ ] T-E4 · Zona con `attempts === 0`: caja con fondo neutro y texto `"Sin tiros registrados"` en vez de FG%/eFG%/
  PPT · `frontend/js/components/shot-chart.js` · cubre RF-3 · Done: una zona de prueba con `attempts: 0` renderiza
  ese texto exacto y no muestra `"0%"` ni `"PPT 0,00"`.
- [ ] T-E5 · `bindZoneTooltips(el, zonesPayload)`: en desktop (`hover: hover`), `mouseenter`/`mouseleave` sobre
  `[data-zone]` abren/cierran un tooltip flotante con los 7 datos, posicionado sin salirse del viewport ·
  `frontend/js/components/shot-chart.js` · cubre RF-2 · Done: al simular `mouseenter` sobre una caja de zona con
  intentos, aparece un tooltip con `made/attempts`, `FG%`, `eFG%`, `PPT`, `share%`, percentil y badge de muestra.
- [ ] T-E6 · `bindZoneTooltips`: en pantallas ≤768 px, `click`/`touchstart` abre una hoja inferior con los mismos 7
  datos y un botón de cerrar; un segundo toque la cierra · `frontend/js/components/shot-chart.js` · cubre RF-2, RF-9
  · Done: en un viewport de 375 px simulado, tocar una caja de zona abre la hoja; tocarla de nuevo la cierra.
- [ ] T-E7 [P] · Zona sin intentos: el tooltip/hoja muestra solo `"Sin tiros registrados en esta zona."`, sin los
  otros 6 datos · `frontend/js/components/shot-chart.js` · cubre RF-3 · Done: abrir el tooltip de una zona con
  `attempts: 0` muestra únicamente ese mensaje.
- [ ] T-E8 · Badge de muestra en el tooltip cuando `sample.level !== "alta"` (reusa `sample-badge.js` de T-02 si
  existe; si no, fallback local del plan §10 D-4) · `frontend/js/components/shot-chart.js` · cubre RF-7 · Done: una
  zona de prueba con `sample.level: "baja"` muestra el badge; una con `"alta"` no lo muestra (o lo muestra
  atenuado, según el patrón ya usado por otros badges de la app).
- [ ] T-E9 · Retirar `_shotChart11SVG`, `_shotChart3SVG`, `_courtLinesSVG`, `_scSvgWrap`, `_scLbl`, `_scBadge`,
  `_scBoxFill` de `frontend/js/app.js` (quedan solo los imports de `shot-chart.js`) · cubre RF-9 · Done: `grep -n
  "_scBoxFill\|_scLbl\|_scBadge" frontend/js/app.js` no encuentra definiciones, solo el uso de las funciones
  importadas.

### Grupo F — Frontend: UI (integración en las 3 vistas)
- [ ] T-F1 · Mapa de tiro agregado de Equipo: reemplazar la llamada a `_shotChartSVG(...)` alimentada por
  `api.teamShots` por `shotChart(...)` + `bindZoneTooltips(...)` alimentadas por `api.shotZones({entity: 'team',
  id, competition, last})` · `frontend/js/app.js` · cubre RF-1, RF-2 · Done: la pestaña Tiro de un equipo con datos
  renderiza el mapa con tooltips funcionando.
- [ ] T-F2 [P] · Shot chart de jugador dentro de Equipo: misma migración con `entity: 'player'` · `frontend/js/
  app.js` · cubre RF-1, RF-2 · Done: seleccionar un jugador en la pestaña Tiro de Equipo muestra su mapa con
  tooltips.
- [ ] T-F3 [P] · Shot chart de Jugador (vista Jugador): misma migración · `frontend/js/app.js` · cubre RF-1, RF-2 ·
  Done: la pestaña Tiro de un jugador renderiza el mapa con tooltips.
- [ ] T-F4 · Estado vacío: `"Sin tiros registrados para este equipo."` / `"...este jugador."` cuando
  `total_shots === 0` en las 3 vistas · `frontend/js/app.js` · cubre RF-3 · Done: un equipo/jugador sin tiros
  muestra ese mensaje en vez de un mapa vacío.

### Grupo G — Errores, estados vacíos, offline/SW
- [ ] T-G1 · Sección CSS `/* ── shot-chart tooltip (C-03) ── */` (tooltip flotante, hoja inferior, estado "sin
  tiros registrados") · `frontend/css/style.css` · cubre RF-2, RF-3 · Done: el tooltip y la hoja se ven con estilos
  propios, no heredan estilos genéricos que los corten o los dejen ilegibles.
- [ ] T-G2 · `frontend/sw.js`: agregar `js/components/shot-chart.js` a `STATIC` y subir `CACHE` al siguiente entero
  · cubre RF-2 · Done: `STATIC` incluye el archivo nuevo y `CACHE` cambió de versión.
- [ ] T-G3 · Confirmar que el manejo de error de red existente de `api.js` cubre las 3 vistas del mapa sin cambios
  adicionales · cubre offline · Done: con la red deshabilitada, las 3 vistas muestran el mensaje de error existente,
  no un traceback ni pantalla en blanco.

### Grupo H — Verificación de feature
- [ ] T-H1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-H2 · Sin cambio de esquema, no aplica `upgrade_db()` (se documenta la omisión).
- [ ] T-H3 · Cada endpoint nuevo/tocado probado con curl; shape verificado contra §3.2 del plan.
- [ ] T-H4 · Consola del navegador sin errores JS al recorrer las pestañas Tiro de Equipo y Jugador.
- [ ] T-H5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`.
- [ ] T-H6 (CA-1, CA del cliente) · En el navegador, abrir el mapa de tiro de un equipo y el shot chart de un
  jugador; confirmar visualmente que ninguna etiqueta dice "P/F"; pasar el cursor (o tocar en un viewport móvil
  simulado) sobre una zona con intentos y confirmar que aparecen los 7 datos.
- [ ] T-H7 (CA-2) · Identificar (o preparar con datos de prueba) una zona sin intentos; confirmar que no muestra
  "0%" ni "PPT 0,00" y que su tooltip dice "Sin tiros registrados en esta zona."
- [ ] T-H8 (CA-3) · `curl "http://localhost:5000/api/shot-zones?entity=team&id=CNF"` vs `curl ".../
  ?entity=team&id=CNF&last=5"`: comparar `attempts` de una misma zona entre ambas respuestas y confirmar que
  difieren si el filtro cambia la muestra.
- [ ] T-H9 (CA-4) · Identificar (o preparar) una zona con intentos por debajo del umbral `sample.clock_zone.min`;
  confirmar que su tooltip muestra el badge de muestra "baja".
- [ ] T-H10 (CA-5) · Con una competencia de al menos 3 equipos con datos, calcular a mano el percentil de PPT de
  una zona de un equipo (posición relativa entre los PPT de zona de los demás) y compararlo con el `percentile`
  devuelto por `/api/shot-zones`.
- [ ] T-H11 (CA-6) · Con una competencia de menos entidades que `population.min_size`, confirmar que `percentile`
  es `null` con razón `poblacion_insuficiente` para esa zona.
- [ ] T-H12 (CA-7) · Con un partido sin coordenadas de tiro (`has_coordinates: false` en el seed actual, dado que
  F-11 puede no estar integrado todavía), abrir su mapa agregado y confirmar que se muestra el fallback de 3 zonas
  sin error, con FG%/eFG%/PPT/peso calculables.
- [ ] T-H13 (CA-8) · Comparar visualmente (o por el valor de `fill`/`background` renderizado) el color de una zona
  con percentil ≥ 80 contra una con percentil ≤ 20 de la misma competencia: deben ser visualmente distintos según
  la escala de T-01, no los umbrales fijos anteriores.
- [ ] T-H14 (CA-9) · Recorrer las pestañas Tiro de Equipo y Jugador en desktop y con DevTools en 360 px: sin errores
  en consola, el tooltip no se corta contra el borde de la pantalla, y en el viewport móvil simulado el mapa se
  interactúa con un toque sin necesitar hover.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-A1, T-A2, T-E1, T-E2, T-E5, T-E6, T-F1, T-F2, T-F3, T-H6 |
| CA-2 | T-A4, T-C1, T-E4, T-E7, T-H7 |
| CA-3 | T-B1, T-H8 |
| CA-4 | T-A5, T-E8, T-H9 |
| CA-5 | T-A5, T-H10 |
| CA-6 | T-A5, T-H11 |
| CA-7 | T-A3, T-E1, T-H12 |
| CA-8 | T-E3, T-H13 |
| CA-9 | T-E6, T-G1, T-H14 |

## Dependencias externas
- C-07 (detalle de tiro completo) debe estar disponible: C-03 no toca `summary`/`_shotDetailGrid` pero depende del
  mismo shape de `summary` que C-07 fijó.
- T-01 (`population.py`, `percentileColor`) y T-02 (`sample.py`, `sample-badge.js`) idealmente integrados antes de
  implementar C-03 (orden 15 y 14, respectivamente, ambos antes que C-03 en la fase); si al implementar C-03 no lo
  están, se usan los fallbacks documentados en el plan §10 (D-3 percentil `null` con razón, D-4 badge local) y se
  registra el bloqueo en `progress.md` para reemplazarlos en cuanto T-01/T-02 estén disponibles.
- F-11 (coordenadas reales de tiro, `shots.court_x`/`court_y`, DA-32) es un incremento diferido explícito (plan §10
  D-1/D-2): C-03 no bloquea su cierre en la llegada de coordenadas reales, pero registra la recalibración de
  `classify_zone` como deuda pendiente de F-11.
- Reimportación/reproceso de partidos: no la ejecuta C-03 (es de F-11); C-03 solo consume lo que exista en `shots`
  en el momento de la verificación.
- Seed con al menos una competencia de 3+ equipos con datos para CA-5/CA-6, y al menos un partido sin coordenadas
  (`has_coordinates: false`, comportamiento actual mientras F-11 no esté integrado) para CA-7.
