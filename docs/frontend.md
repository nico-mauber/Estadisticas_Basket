# Frontend

Vanilla JS ES6, sin bundler, sin frameworks. PWA con service worker.

## Estructura de archivos

```
frontend/
├── index.html          # Entrada única (SPA)
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
├── css/
│   └── style.css       # Estilos globales, dark mode, responsive
├── js/
│   ├── app.js          # Lógica SPA: vistas, routing, renders
│   ├── api.js          # Capa de fetching (wrappers sobre fetch())
│   ├── charts.js       # Chart.js: scatter, radar, helpers
│   └── chart.umd.min.js  # Chart.js v4 (bundled localmente)
└── icons/
    ├── icon-192.png    # Ícono PWA 192×192 (basketball)
    └── icon-512.png    # Ícono PWA 512×512 (basketball)
```

## Vistas (SPA)

La navegación es por `#hash` o botones de tab. No hay routing del servidor.

| Vista | ID sección | Descripción |
|-------|-----------|-------------|
| **Importar** (Datos) | `#import` | Tres pestañas (F-11): **Importar** (URL de FIBA + seed dev + catálogo con filtro por competencia y estado de datos), **Calidad de datos** (informe de una competencia, reproceso y publicación) y **Competencias** (alta, edición, estado, fusión). Ver "Sección Datos" abajo |
| **Liga** | `#league` | Tabla ranking de equipos (columnas ordenables) + mapa de dispersión con ejes X/Y seleccionables (`LEAGUE_MAPS`). *(Los Cierres se movieron a la vista Equipo — Feature 05 v2.)* **Filtro por competencia** (Feature 09): `<select>` en el header del ranking que refetchea `api.league(comp)` (solo si hay >1 competencia) |
| **Equipo** | `#team` | Record, Four Factors, métricas avanzadas, desglose ofensivo, shot chart (si hay datos), game log. Botón **"Ver mapa de tiro"**: shot chart por zonas del jugador seleccionado dentro de Equipo (`#team-shotmap`). Botón **"Ver ON/OFF"**: dos tablas `ON \| OFF \| Δ` del jugador — **Eficiencia** (tasas, Δ del backend) y **Producción del equipo** (conteos crudos: pts a favor/contra, REB, AST, pérdidas, robos, tapones; Δ = ON−OFF) (`#team-onoff`, `renderTeamOnOff`, Feature 04). Apartado **"Combinaciones (Lineups)"**: multi-select de 3-5 jugadores + botón "Analizar combinación" → tarjeta de métricas y líderes (`#team-lineup-picker`/`#team-lineup`, `renderTeamLineup`, Feature 03). Apartado **"Cierres (últimos 5 min, dif ≤ 10)"**: tarjeta agregada del equipo ("mini-partido" de sus cierres apretados, con récord y recuento de partidos) + tabla por partido ordenable con columna PR (prórrogas) (`#team-clutch`, `renderTeamClutch`, Feature 05 v2 / C-06). Respeta la competencia elegida en `#team-comp` (la pide al backend) |
| **Jugador** | `#player` | Métricas individuales, shot chart (11 zonas o 3 zonas según disponibilidad de coordenadas), game log |
| **Comparar** | `#compare` | Radar de tres polígonos (equipo A, equipo B, promedio liga) + box score FIBA |
| **Buscar** | `#search` | Buscador avanzado de jugadores: filtros combinables (nombre, equipo, competencia, posición, rangos mín/máx de métricas) sobre todos los jugadores de la base; tabla ordenable; fila → vista Jugador |

**Vista Equipo — card "Desglose ofensivo":** siempre visible: PtsEnPint / Seg. Op. / Ptos/PER / Banca / PCA (columnas `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts`). Toda etiqueta nueva de `paint_pts` (catálogo de métricas, cabeceras de exportación, traducciones) es `PtsEnPint` (C-05). Si la competencia no publica un campo se ve "—" con la razón "La competencia no registra este dato" (C-11). *(Seg. Op. y PCA se poblaban en 0 por claves FIBA mal escritas — corregido en `fiba_fetcher.py`: `PointsSecondChance`/`PointsFastBreak`.)*

**Filtro por competencia (Feature 09, por id desde F-11):** helpers compartidos `_logComps`/`_filterByComp`/`_compOptions`, que trabajan con `competition_id` y la etiqueta `competition_label` (el texto de FIBA puede renombrarse o fusionarse). Las competencias en borrador no aparecen. Selectores en **Liga** (refetch `api.league(comp)`), **Equipo** (`#team-comp`, filtra el `game_log` y recomputa con `_computeAvg`; compone con las pills Últ. N), **Comparar** (`#compare-comp`) y **Jugador** (`#player-comp`, `renderPlayer`→`_renderPlayerContent`). Cada `<select>` se oculta si hay ≤1 competencia. `_computeAvg` incluye las keys de jugador `uso_pct`/`ast_to`.

**ON/OFF — minutos:** el panel muestra `N' en cancha` (tiempo de juego del equipo con el jugador en cancha/banca). La suma de segundos por partido es exacta (arreglado el doble-conteo por reloj no-monótono en `build_segments`).

**Mapa de tiro del equipo (Feature 10):** además del mapa por jugador (botón "Ver mapa de tiro"), la vista Equipo muestra automáticamente el mapa AGREGADO del equipo (`#team-teamshot`, `renderTeamShotmapTeam` → `api.teamShots`), reusando `_shotChartSVG`.

**Más stats en Combinación y Comparar (Feature 11):** la card de Combinación (lineup) incluye una tabla ancha (`.search-table`) con la línea completa (Off/Def/Net/eFG%/TS%/Pos/Pts/REB/AST/…); Comparar incluye una card "Métricas avanzadas" (tabla de 2 filas, una por equipo).

**Vista Comparar — box score FIBA:** tabla de 3 columnas (`valor A | etiqueta | valor B`) con el ganador de cada fila resaltado en verde. Filas: LC, 2Pts, 3Pts, 1Pt (con %), REB, As, ST, Blq, PER, FP (formato `faltas (recibidas)`), PtsEnPint, PtsSegCh, PtPer, Pts Banca, PCA. Clase CSS `.fiba-box`.

### Sección Datos (vista Importar, F-11)

Pestañas internas (`.import-tabs`, pills con scroll horizontal en móvil). X-01 las reubica en S1 sin cambiar su contenido.

- **Importar:** importación por URL, seed (dev) y catálogo paginado con filtro `#catalog-comp` (competencias incluidas las en borrador) y columna **Estado** (`_dataBadges`: Borrador · Sin PBP · Sin coordenadas · Reprocesar · OK). Modo selección (solo admin): **Mover a competencia…**, **Reprocesar**, **Eliminar**.
- **Calidad de datos:** selector de competencia, resumen ("Lista para publicar" / "Revisar antes de publicar", partidos, incompletos) y una card por chequeo (`QUALITY_CHECKS`, `_qualityCheckCard`; listas largas colapsadas con `<details>`). Admin: **Reprocesar competencia** y **Publicar** / **Pasar a borrador** (con incompletos pide confirmación: "Hay M partidos incompletos. ¿Publicar igual?").
- **Competencias:** tabla con etiqueta, estado, partidos, equipos y fechas. Admin: **Nueva competencia**, **Editar** (nombre, temporada, estado) y **Fusionar en…**.

Helpers: `_formModal({title, text, fields, confirm, danger, onSubmit})` (modal con formulario; si `onSubmit` lanza, muestra el error y queda abierto; también lo usa el borrado), `_runReprocess({competitionId} | {gameIds}, onProgress)` (encadena lotes con `next_offset` — el tamaño lo decide el backend — y muestra "Reprocesando X de N…"), `_afterDataChange()` (refresca selectores y descarta el buscador cacheado tras cualquier cambio de datos), `esc()` (escapa texto editable por el usuario). Las acciones de escritura solo se muestran si `/api/me` devuelve `is_admin: true`.

## `api.js`

Capa delgada de fetch. Exporta el objeto `api` (un método por endpoint) y `setUnauthorizedHandler(fn)`. Cada request usa `credentials: "same-origin"` (envía la cookie de sesión). Un `401` global dispara el handler → el SPA vuelve a la pantalla de login.

```js
api.login(user, password)   // POST   /api/login
api.logout()                // POST   /api/logout
api.me()                    // GET    /api/me  (auth + feature flags)
api.importGame(url)         // POST   /api/import
api.team(code)              // GET    /api/team/<code>
api.players(code) / api.player(code, name) / api.playerShots(code, name) / api.teamShots(code)  // teamShots = mapa agregado del equipo
api.searchPlayers()         // GET /api/search/players (buscador avanzado)
api.clutchTeam(team, comp?) // GET /api/clutch/<team>[?competition=] (cierres del equipo: agregado + por partido)
api.lineup(team, players[]) // GET /api/lineup/<team>?players=A|B|C (combinaciones 3-5)
api.onoff(team, player)     // GET /api/onoff/<team>/<player>
api.league(comp?) / api.teams() / api.games(comp?)  // comp = id de competencia
api.deleteGames(ids)        // DELETE /api/games (admin)
// Datos (F-11)
api.competitions(includeHidden?)       // GET /api/competitions[?include_hidden=1]
api.createCompetition({name, season})  // POST  (admin)
api.updateCompetition(id, {name?, season?, status?})   // PATCH (admin)
api.mergeCompetition(id, sourceId)     // POST /api/competitions/<id>/merge (admin)
api.assignGame(gameId, compId)         // PATCH /api/games/<id> (admin)
api.dataQuality(compId)                // GET /api/data-quality
api.reprocess({game_ids} | {competition_id, offset})   // POST /api/reprocess (admin)
api.seed()                  // POST   /api/seed  (dev)
```

## `charts.js`

Wrappers sobre Chart.js v4.

| Función | Tipo | Descripción |
|---------|------|-------------|
| `drawLeagueScatter(canvasId, teams, axis)` | Scatter | Mapa de liga con ejes X/Y configurables (`axis` = `{xKey,yKey,xName,yName,xTitle,yTitle,xPct,yPct,xAvgLabel,yAvgLabel}`, armado por `_mapAxis` en `app.js`); zoom+pan. Presets en `LEAGUE_MAPS` (Eficiencia, Rebotes, Recuperos/Puntos). Los equipos con un eje nulo no se dibujan. Lienzo 2:1 en desktop y cuadrado en móvil (≤ 768 px), para que el título del eje Y entre completo |
| `drawRadar(canvasId, averages, league, label)` | Radar | Equipo vs promedio de liga (vista equipo) |
| `drawCompareRadar(canvasId, avgA, avgB, league, labelA, labelB)` | Radar | **Tres polígonos**: equipo A (naranja), equipo B (azul), promedio liga (gris punteado) |
| `drawEvolution(canvasId, gameLog, leagueOerAvg)` | Línea | Evolución de OER del equipo partido a partido vs media liga |
| `drawPlayerEvolution(canvasId, gameLog)` | Línea | Evolución de métricas del jugador partido a partido |
| `resetZoom(canvasId)` | Util | Reset zoom del scatter |

**Plugins cargados desde CDN en `index.html`:**
- `hammerjs@2.0.8` — touch events para pinch-zoom
- `chartjs-plugin-zoom@2.0.1` — zoom/pan sobre Chart.js

## `app.js`

Lógica principal. Funciones clave:

| Función | Descripción |
|---------|-------------|
| `boot()` | Consulta `api.me()`; decide pantalla de login vs app |
| `showLogin(msg)` | Renderiza la pantalla de login y cablea el submit |
| `renderApp()` | Construye el layout completo (header, nav, secciones) |
| `_renderLeague()` | Renderiza tabla de liga con sort clickeable |
| `_renderTeamContent(data)` | Record card + Four Factors + métricas + shot chart + game log |
| `_renderPlayerContent(data)` | Métricas jugador + shot chart por zonas + game log |
| `_computeAvg(gameLog)` | Promedia un array de partidos (filtro de competencia / últimos N). Excluye las entradas con `played === false` (DNP). `def_to_ratio` es acumulado (pooled). Devuelve además `null_reasons` para las claves nulas (la razón común de los partidos, o `sin_intentos`) |
| `_cmpNullsLast(av, bv, dir)` | **Comparador único de tablas ordenables.** Ver "Orden de nulos" abajo |
| `_fourFactorsCard(av, name)` | Tabla Four Factors equipo vs rival con color-coding |
| `_recordCard(record, name)` | Display W/L con porcentaje, local, visitante |
| `statClass(value, avg, hib)` | Clase de rendimiento; devuelve `"neutral"` si el valor o el promedio son `null` |
| `statBox(label, value, display, leagueKey, league, hib, reason)` | Card de métrica. Contexto: **solo `Ø {promedio}`** — el indicador `↑ {mejor}` se retiró (ver abajo). Si `value` es nulo muestra `nullDisplay(reason)` |

### `core/format.js` — formato numérico y nulos (C-11)

Único punto de formateo de números de la UI. **Coma decimal es-UY** en toda la app ("1,09", "60,0%",
DA-36); no usar `toFixed` para texto visible (solo para coordenadas SVG o datos numéricos de Chart.js).
Chart.js usa `Chart.defaults.locale = "es-UY"` para ticks y tooltips por defecto.

| Export | Descripción |
|---|---|
| `fmtNumber(v, decimals)` | Número con coma decimal, sin separador de miles; nulo → "—" |
| `PCT`, `PCT0`, `DEC1`, `DEC2` | Porcentaje con 1 / 0 decimales, número con 1 / 2 decimales |
| `isNull(v)` | `null`, `undefined`, `NaN` o `±Infinity` |
| `nullDisplay(reason)` | `<span class="null-val" title="…">—</span>`: "—" gris con la razón en el title |
| `fmtOrNull(v, fmt, reason)` | Valor formateado, o `nullDisplay(reason)` si es nulo |
| `NULL_REASON_LABELS` | Copy de cada código de `null_reasons` (ver `docs/api.md`) |

Reglas de nulos en la UI: un nulo se ve "—" (nunca 0, `null`, `NaN`); un 0 real se ve 0; un nulo nunca
recibe color de rendimiento; una resta o complemento con un operando nulo da nulo (RebOf% rival en
Four Factors). En el game log de jugador un partido DNP se muestra como fila "DNP" sin números, y en
la evolución queda como hueco.

### Contexto de las cards de stat

La card muestra el valor de la entidad y, debajo, `Ø {promedio de liga}` — el de la **competencia
seleccionada**, tomado de `data.leagues[compActiva]`. El filtro de últimos N cambia el valor de la
entidad pero **no** el `Ø`.

El indicador `↑ {mejor de la liga}` fue **eliminado**: era el máximo de la población sin mínimo de
muestra, y producía valores imposibles (`↑ 9900.0%`). Su reemplazo es el percentil de T-01. No
reintroducirlo. Ver `sdd/specs/14-promedios-de-liga/`.

⚠️ `statBox` decide si formatear como porcentaje por **substring** del nombre de la métrica
(`pct`, `or_`, `dr_`, `to_`, `as_`), con una lista de exclusión `NOT_PCT` para los ratios que caen mal
en ese heurístico (`def_to_ratio`, `as_pos`). Al agregar una métrica cuyo nombre contenga esos
fragmentos sin ser un porcentaje, agregarla a `NOT_PCT` o el valor se mostrará multiplicado por 100.
Ya obligó a dos parches; lo correcto sería declarar el formato junto a cada métrica.

### Perfil de jugador — card "Por posesión y por minuto"

`AS/pos`, `PER/pos`, `PTS/pos`, `RO/min`, `RD/min` (`sdd/specs/15-metricas-jugador/`). `PER` es
**pérdidas**, no Player Efficiency Rating — convención ya vigente en la app (`Ptos/PER`, fila `PER`
de Comparar). `PER/pos` se renderiza con `higherIsBetter = false`.

### Orden de nulos en tablas ordenables

Un `null` **nunca se ordena como si fuera 0**: va siempre al final, **en ambos sentidos**. La regla
vive en un único helper, `_cmpNullsLast(av, bv, dir)`, que consumen los tres sitios ordenables —
`_sortedLeague` (Liga), `_drawClutchTable` (Cierres) y `_renderSearchResults` (Buscador).

El mecanismo importa: el nulo se **aparta** de la comparación (devuelve `1`/`-1` **sin multiplicar
por `dir`**) en vez de recibir un valor extremo. Asignarle `-Infinity`, que es lo que se hacía antes,
funciona en descendente y falla en ascendente, donde los nulos encabezan la tabla.

Al agregar una tabla ordenable nueva, usar este helper — no escribir un comparador propio.
Un `null` tampoco recibe color de rendimiento: `statClass` y `winCls` (Comparar) devuelven clase
neutra si falta cualquiera de los dos lados. Ver `sdd/specs/12-nulos-orden-color-dnp/`.

## Shot chart

SVG de cancha clara estilo "El Metro" (`frontend/js/app.js`), generado por `_shotChartSVG(zones, totalShots, summary, hasCoordinates)`:

- `hasCoordinates=true` → `_shotChart11SVG`: 11 casilleros (restricted_area, mid_left/right_close, mid_left/right_far, mid_top, left/right_corner_3, left/right_wing_3, top_key_3).
- `hasCoordinates=false` → `_shotChart3SVG`: 3 casilleros (Triple/top_key_3, Media/mid_top, Pintura/restricted_area). Hoy es el caso de todos los partidos: FIBA sí publica coordenadas (`tm[n].shot[]`) y desde F-11 se guardan en `shots.court_x/court_y`, pero el mapa de 11 zonas las usa recién en C-03 (ver [api.md → GET /api/shots](api.md#get-apishotsteam_codeplayer_name)).

Ambos modos comparten geometría de cancha, paleta y heatmap por P/F (`_courtLinesSVG`, `_scLbl`, `_scBadge`, constantes `SC_*`) — sin duplicación de estilo entre modos.

El mismo mapa se muestra en dos lugares: en la vista **Jugador** (`renderPlayer`) y dentro de la vista **Equipo** vía el botón "Ver mapa de tiro" (`renderTeamShotmap` → contenedor `#team-shotmap`). Ambos reusan `api.playerShots(...)` + `_shotChartSVG(...)`.

## Login (frontend)

- `boot()` llama `api.me()` al arrancar. Si `auth_required && !authenticated` → renderiza la **pantalla de login** (`showLogin()`) y no construye la app.
- `renderApp()` arma la app normal; el header muestra el usuario + botón **Salir** cuando hay auth.
- `setUnauthorizedHandler` → ante un `401` (sesión expirada) vuelve a `showLogin()` con aviso.
- Sin auth (local sin `AUTH_USERS`), `boot()` va directo a la app. Ver [api.md → Autenticación](api.md#autenticación) y [deployment.md](deployment.md#configurar-el-login-en-render-paso-a-paso).

## Service Worker (`sw.js`)

Cache name: `smart-basket-v12`

**Estrategia:**
- `install`: pre-cachea los archivos estáticos listados en `STATIC[]`
- `activate`: elimina todas las caches anteriores (versiones viejas)
- `fetch`: rutas `/api/*` siempre van a red (nunca caché). Todo lo demás: cache-first con fallback a red.

**Para forzar actualización del SW:** incrementar la versión en `const CACHE = "smart-basket-vN"`.

**Assets cacheados:**
```js
"/", "/manifest.json", "/css/style.css",
"/js/app.js", "/js/api.js", "/js/charts.js", "/js/core/format.js", "/js/chart.umd.min.js"
```

Todo módulo ES nuevo que importe `app.js` debe agregarse a `STATIC` (y subir `CACHE`): el fetch
cache-first no guarda respuestas nuevas, así que un módulo fuera de la lista rompe la app offline.

## PWA

- `manifest.json` define nombre, colores, iconos y `display: standalone`
- Iconos generados con Pillow: círculo naranja con costuras de básquetbol
- En iOS: el ícono solo se actualiza si se desinstala y reinstala la app desde Safari (comportamiento de iOS, no un bug)

## Responsive / Mobile

- Nav inferior fijo en mobile (`position: fixed; bottom: 0`)
- Nav superior en desktop
- CSS custom properties para dark mode
- Breakpoint principal: `768px`

## Cierres (umbral de partido cerrado)

El umbral de "partido cerrado" es **dif ≤ 10** al entrar a los últimos 5 minutos (C-06; antes 15).
Umbral y ventana viven en un solo lugar: `DEFAULT_MARGIN` y `DEFAULT_WINDOW_SECS` en
`backend/clutch.py`, expuestos en la respuesta de `GET /api/clutch/<code>` como `margin` y
`window_secs`. **La card arma todo su copy con esos dos valores** (`_clutchTitle`, `_clutchCount`,
cabecera `Δ@m:ss`) — no escribir `10`, `15`, `5 min` ni `5:00` como literales en el frontend: esa
duplicación fue la causa de que la leyenda quedara desincronizada. Mientras carga o si falla, el título
dice solo "Cierres".

Copy de la card: título "Cierres (últimos {min} min, dif ≤ {margen})" (mayúsculas por CSS; ventana no
entera en minutos con coma decimal, "1,5 min"); recuento "{q} calificado(s) · {e} excluido(s) por
diferencia mayor a {margen}" más " · {s} sin eventos de cierre" y " · {n} sin play-by-play" si no son 0,
precedido por la competencia si se eligió una; sin calificados: "Sin cierres apretados: {recuento}.".
Las respuestas que llegan tarde (se cambió de equipo o de competencia) se descartan (`_clutchReq`).
Ver `sdd/specs/v2/fase-1-confiabilidad/05-C-06-umbral-cierres/`.

### Mapa de tiro y card "Tiro" (C-03 / C-07)

Cada zona del mapa muestra **volumen %**, **PPT**, **% de acierto** y **eFG%** (caja SVG de 54×44).
El encabezado muestra `PPT` y `eFG%`. **El indicador `P/F` fue retirado de toda la app** — era la
misma fórmula de PPT mal etiquetada; no reintroducirlo.

La card "Tiro" (Equipo y Jugador) incluye `_shotDetailGrid(av, totals, lg)`: `T2i`/`T2c`, `T3i`/`T3c`,
`TLi`/`TLc` como `promedio (total temporada)`, más `PPT`, `PPT 2`, `PPT 3` y `PPT TL`.
Ver `sdd/specs/16-tiro-completo-ppt/`.

### Vista Liga — tabla general y ejes del mapa (C-09 / C-10)

**Tabla general** (`_standingsCardHTML`): tabla de posiciones clásica arriba del ranking — Equipo, PJ,
PG, PP, Pts, PF, PC. Puntos = 2 por ganado + 1 por perdido. Ordena por puntos y desempata por
diferencia (PF − PC). Se alimenta del mismo `_leagueTeams` que el ranking: **sin fetch adicional**.

> La tabla refleja únicamente los partidos importados, no el fixture completo.

**Convención de flechas en los ejes del mapa**: la flecha indica la **dirección en pantalla** del
mejor rendimiento — `→`/`←` en el eje horizontal, `↑`/`↓` en el vertical. No usar `↑` en un eje
horizontal para decir "más es mejor": esa ambigüedad fue el defecto que reportó C-10.
El gráfico no invierte la escala (`reverse: false` en `charts.js`), así que el valor más alto siempre
se dibuja arriba.

La flecha **no se escribe a mano**: cada eje de `LEAGUE_MAPS` declara la dirección de su métrica
(`xDir`/`yDir`: `higher` | `lower` | `neutral`) y un calificador (`xQual`/`yQual`), y `_mapAxis` arma
el título con `_axisTitle` — "OER (→ mejor ataque)", "DER (↓ mejor defensa)", "OR% (→ mejor)",
"DR% (↑ mejor)". Una métrica `neutral` lleva el título sin flecha. Las líneas de promedio de liga se
rotulan "Prom. <métrica>", sin flecha. Si algún día se invierte un eje, `AXIS_ARROWS` debe invertir
su flecha. Ver `sdd/specs/v2/fase-1-confiabilidad/04-C-10-mapa-liga-eje-rebote/`.
