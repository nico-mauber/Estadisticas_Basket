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
│   ├── chart.umd.min.js  # Chart.js v4 (bundled localmente)
│   ├── core/
│   │   ├── format.js     # Formato numérico, nulos, cmpNullsLast (C-11, T-06)
│   │   ├── prefs.js      # Preferencias usuario (F-13)
│   │   ├── catalog.js    # Catálogo de métricas (T-05)
│   │   └── colors.js     # Colores por percentil (T-01)
│   └── components/
│       ├── data-table.js    # Tabla completa con estado (T-06)
│       ├── export-menu.js   # Menú exportar CSV/XLSX/PNG/PDF (T-06)
│       ├── exporters.js     # toCSV, toPNG, printNode, helpers (T-06)
│       ├── standard-panel.js # Panel estándar de métricas (T-05)
│       ├── metric-card.js   # Card de ficha con ranking (T-01)
│       ├── sample-badge.js  # Badge de muestra (T-02)
│       ├── shot-chart.js    # SVG cancha + tooltip/sheet por zona (C-03)
│       └── settings-form.js # Formulario de configuración (F-13)
└── icons/
    ├── icon-192.png    # Ícono PWA 192×192 (basketball)
    └── icon-512.png    # Ícono PWA 512×512 (basketball)
```

## Vistas (SPA)

La navegación es por `#hash` o botones de tab. No hay routing del servidor.

| Vista | ID sección | Descripción |
|-------|-----------|-------------|
| **Importar** (Datos) | `#import` | Tres pestañas (F-11): **Importar** (URL de FIBA + seed dev + catálogo con filtro por competencia y estado de datos), **Calidad de datos** (informe de una competencia, reproceso y publicación) y **Competencias** (alta, edición, estado, fusión). Ver "Sección Datos" abajo |
| **Liga** | `#league` | Tabla general (C-09) + tabla ranking de equipos (columnas ordenables) + mapa de dispersión con ejes X/Y seleccionables (`LEAGUE_MAPS`). *(Los Cierres se movieron a la vista Equipo — Feature 05 v2.)* **Filtro por competencia** (Feature 09): `<select id="league-comp">` en el header de la tabla general (arriba de todo: filtra las tres cards) que refetchea `api.league(comp)` (solo si hay >1 competencia) |
| **Equipo** | `#team` | Record, Four Factors, métricas avanzadas, desglose ofensivo, shot chart (si hay datos), game log. Botón **"Ver mapa de tiro"**: shot chart por zonas del jugador seleccionado dentro de Equipo (`#team-shotmap`). Botón **"Ver ON/OFF"**: dos tablas `ON \| OFF \| Δ` del jugador — **Eficiencia** (tasas, Δ del backend) y **Producción del equipo** (conteos crudos: pts a favor/contra, REB, AST, pérdidas, robos, tapones; Δ = ON−OFF) (`#team-onoff`, `renderTeamOnOff`, Feature 04). Apartado **"Combinaciones (Lineups)"**: multi-select de 3-5 jugadores + botón "Analizar combinación" → tarjeta de métricas y líderes (`#team-lineup-picker`/`#team-lineup`, `renderTeamLineup`, Feature 03). Apartado **"Cierres (últimos 5 min, dif ≤ 10)"**: tarjeta agregada del equipo ("mini-partido" de sus cierres apretados, con récord y recuento de partidos) + tabla por partido ordenable con columna PR (prórrogas) (`#team-clutch`, `renderTeamClutch`, Feature 05 v2 / C-06). Respeta la competencia elegida en `#team-comp` (la pide al backend) |
| **Jugador** | `#player` | Métricas individuales, shot chart (11 zonas o 3 zonas según disponibilidad de coordenadas), game log |
| **Comparar** | `#compare` | Radar de tres polígonos (equipo A, equipo B, promedio liga) + box score FIBA |
| **Partido** | `#partido` (sin botón en la barra) | Dos modos sobre `#partido-main`. **Analizar** (F-07, `components/game-view.js`, `renderGameView`): pestañas Resumen · Box Score · Tiros · Jugadas · Quintetos · Cruces; se abre con click en una fila del catálogo (`showGame`). Botón **Exportar** en el encabezado (`components/game-report.js`, `mountGameExport` sobre `exportMenu`): CSV/XLSX con el box de ambos equipos y PNG (1080 px) / PDF A4 de 2 páginas con el informe de scouting (parciales, conjunto estándar, línea de tiempo en SVG, mapas de tiro, mejores jugadores por valoración y los 5 cruces con más posesiones); tiros y cruces se precargan en segundo plano. Cada pestaña con carga remota muestra «Reintentar» (o aviso de sin conexión) si falla, sin romper el resto, y ignora respuestas tardías de otra pestaña. `exportMenu` acepta `render: {png, pdf}` con un nodo de informe ya armado. **En vivo** (F-01, `components/live-view.js`, `renderLiveView`): se abre con **Seguir en vivo** en Importar (`showLiveGame(id, url)`); badge "EN VIVO" pulsante, período y reloj, eficiencia y four factors de ambos equipos con Δ contra el promedio de temporada propio, distribución de puntos (por tipo de tiro, suma 100 %; por origen, no excluyentes), jugadores con estado en cancha/banco y cadenas de puntos. Polling con `setTimeout` recursivo cada `live.poll_secs` (acotado a 10–60 s); se corta con `destroyLiveView()` al cambiar de sección (`setSection`) o abrir otro partido. Estados: "Datos desactualizados desde {hora}" (`stale`), "Sin conexión…" (conserva la última vista), 404/502 con su mensaje, "Sin datos aún: el partido no comenzó.". Al detectar el fin muestra el banner "Partido finalizado" y la vista Analizar con los datos ya persistidos. **Momentum** (F-02, `components/momentum-panel.js`, `momentumHTML`): pestaña interna de En vivo (parcial abierto, PPP de las últimas N posesiones, OER/DER/Net de los últimos minutos, últimas posesiones con desenlace, jugadores 🔥 calientes / 🧊 en alerta con todas sus marcas); con la pestaña activa, cada ciclo del mismo temporizador pide `api.live` y `api.momentum` (sin polling propio). En Analizar es la 7.ª pestaña y muestra el estado al cierre del partido |
| **Preparar** | `#preparar` | F-03, `components/prepare-report.js` (`renderPrepare`): selector de equipo propio, rival y partidos del rival (todos / últimos 3, 5, 10) → `api.prepare`. Bloques: encabezado, ventajas y amenazas (duelos con percentil), quintetos más usados del rival (Net aj. ± banda, gris = muestra baja, top 8 + ver todos), amenazas ofensivas (mayor USO%, mapa de zonas con la más productiva, de dónde vienen sus puntos), historial (fila → Analizar), coincidencia en cancha (leyenda fija; niveles quinteto/jugador/jugador-quinteto en ambos sentidos; selector "con qué cinco salgo" e inverso: ordena por Net del cruce, muestra baja y "Sin datos" al final; fila → partidos del cruce con enlace a Analizar). Exporta PDF A4 de 2 páginas (`printNode` + `.prx-print`), PNG vertical 1080 px (nodo `.prx-png` montado fuera de pantalla antes de `toPNG`, layout en bloque porque `toPNG` no copia grid/flex) y CSV con cabecera T-06 |
| **Buscar** | `#search` | Buscador avanzado de jugadores: filtros combinables (nombre, equipo, competencia, posición por grupo G/F/C, rangos mín/máx de métricas) sobre una entrada por ficha de jugador; cambiar de competencia recalcula los promedios en el backend; tabla ordenable; fila → vista Jugador por `player_id` |

**Vista Equipo — card "Desglose ofensivo":** siempre visible: PtsEnPint / Seg. Op. / Ptos/PER / Banca / PCA (columnas `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts`). Toda etiqueta nueva de `paint_pts` (catálogo de métricas, cabeceras de exportación, traducciones) es `PtsEnPint` (C-05). Si la competencia no publica un campo se ve "—" con la razón "La competencia no registra este dato" (C-11). *(Seg. Op. y PCA se poblaban en 0 por claves FIBA mal escritas — corregido en `fiba_fetcher.py`: `PointsSecondChance`/`PointsFastBreak`.)*

**AS/PER (C-04):** la caja "AS/PER" (`_astPerBox`, con `title` "Asistencias sobre pérdidas, acumulado de la selección (PER = pérdidas)") está en la card "Rebotes & Misc" de Equipo y en "Rebotes & distribución" de Jugador y muestra `ΣAS/ΣPER` con los totales debajo (`1,48 (43/29)`); sin pérdidas es "—" con `title` "Sin pérdidas: el cociente no está definido". No muestra `Ø` ni color mientras no exista un promedio de liga del mismo criterio (C-02). Los game logs de Equipo y Jugador tienen la columna "AS/PER" (`title` "AS/PER del partido"), Comparar equipos la fila "AS/PER" y el Buscador la columna "AS/PER" (ordenable, nulos al final).

**Selección por competencia (C-02, reemplaza Feature 09 client-side):** la selección se resuelve en el backend via query params `?competition=<id>&last=<n>`. El frontend envía la selección y recibe el perfil filtrado con promedios, league y context. Selectores: **Liga** (refetch `api.league(comp)`), **Equipo** (`_teamComp` + `_teamLastN`, refetch con `_reloadTeam()`), **Comparar** (`#compare-comp`, ambos equipos con misma competencia) y **Jugador** (`_playerComp`, refetch con `_reloadPlayer()`). `_compOptions(comps, selected, allLabel, allValue)` arma las `<option>` del selector desde `data.competitions`. Helpers eliminados: `_computeAvg`, `_filterByComp`, `_filteredLog`, `_logComps`.

**ON/OFF — minutos:** el panel muestra `N' en cancha` (tiempo de juego del equipo con el jugador en cancha/banca). La suma de segundos por partido es exacta (arreglado el doble-conteo por reloj no-monótono en `build_segments`).

**Mapa de tiro del equipo (Feature 10 + C-03):** además del mapa por jugador (botón "Ver mapa de tiro"), la vista Equipo muestra automáticamente el mapa AGREGADO del equipo (`#team-teamshot`, `renderTeamShotmapTeam` → `api.shotZones`), usando `shotChart` + `bindZoneTooltips` de `components/shot-chart.js`.

**Más stats en Combinación y Comparar (Feature 11):** la card de Combinación (lineup) incluye una tabla ancha (`.search-table`) con la línea completa (Off/Def/Net/eFG%/TS%/Pos/Pts/REB/AST/…); Comparar incluye una card "Métricas avanzadas" (tabla de 2 filas, una por equipo).

**Vista Comparar — box score FIBA:** tabla de 3 columnas (`valor A | etiqueta | valor B`) con el ganador de cada fila resaltado en verde. Filas: LC, 2Pts, 3Pts, 1Pt (con %), REB, As, ST, Blq, PER, FP (formato `faltas (recibidas)`), PtsEnPint, PtsSegCh, PtPer, Pts Banca, PCA. Clase CSS `.fiba-box`.

### Sección Datos (vista Importar, F-11)

Pestañas internas (`.import-tabs`, pills con scroll horizontal en móvil). X-01 las reubica en S1 sin cambiar su contenido.

- **Importar:** importación por URL, **Seguir en vivo** (misma caja: URL de FIBA o id numérico → vista Partido en modo En vivo, F-01), seed (dev) y catálogo paginado con filtro `#catalog-comp` (competencias incluidas las en borrador) y columna **Estado** (`_dataBadges`: Borrador · Sin PBP · Sin coordenadas · Reprocesar · OK). Modo selección (solo admin): **Mover a competencia…**, **Reprocesar**, **Eliminar**.
- **Calidad de datos:** selector de competencia, resumen ("Lista para publicar" / "Revisar antes de publicar", partidos, incompletos) y una card por chequeo (`QUALITY_CHECKS`, `_qualityCheckCard`; listas largas colapsadas con `<details>`). Admin: **Reprocesar competencia** y **Publicar** / **Pasar a borrador** (con incompletos pide confirmación: "Hay M partidos incompletos. ¿Publicar igual?"). **Jugadores posiblemente duplicados** (C-08): lo dibuja `components/identity-merge.js` (`renderDuplicateItems`): una fila por candidato (equipo, las dos fichas con PJ y dorsal, motivo); el admin ve **Unificar** → modal "Conservar «A» / «B»" → `api.mergePlayers` → toast "Fichas unificadas: {nombre} ahora suma {n} partidos" y se recarga el informe. Sin candidatos: "No se detectaron posibles duplicados en esta competencia".
- **Selector de jugador en Equipo** (C-08): `#player-select` usa `player_id` como `value` y el nombre como texto (`data-name`); Ver jugador abre `renderPlayer(team, nombre, player_id)` (`api.playerById`); mapa de tiro, ON/OFF y combinaciones siguen por nombre (el backend resuelve cualquier grafía).
- **Competencias:** tabla con etiqueta, estado, partidos, equipos y fechas. Admin: **Nueva competencia**, **Editar** (nombre, temporada, estado) y **Fusionar en…**.

Helpers: `_formModal({title, text, fields, confirm, danger, onSubmit})` (modal con formulario; si `onSubmit` lanza, muestra el error y queda abierto; también lo usa el borrado), `_runReprocess({competitionId} | {gameIds}, onProgress)` (encadena lotes con `next_offset` — el tamaño lo decide el backend — y muestra "Reprocesando X de N…"), `_afterDataChange()` (refresca selectores y descarta el buscador cacheado tras cualquier cambio de datos), `esc()` (escapa texto editable por el usuario). Las acciones de escritura solo se muestran si `/api/me` devuelve `is_admin: true`.

## `api.js`

Capa delgada de fetch. Exporta el objeto `api` (un método por endpoint) y `setUnauthorizedHandler(fn)`. Cada request usa `credentials: "same-origin"` (envía la cookie de sesión). Un `401` global dispara el handler → el SPA vuelve a la pantalla de login.

```js
api.login(user, password)   // POST   /api/login
api.logout()                // POST   /api/logout
api.me()                    // GET    /api/me  (auth + feature flags)
api.importGame(url)         // POST   /api/import
api.team(code, params?)     // GET    /api/team/<code>[?competition=&last=] (C-02)
api.players(code, params?) / api.player(code, name, params?) / api.playerById(id, params?) / api.playerShots(code, name) / api.teamShots(code)  // params: {competition, last}
api.searchPlayers()         // GET /api/search/players (buscador avanzado)
api.clutchTeam(team, comp?) // GET /api/clutch/<team>[?competition=] (cierres del equipo: agregado + por partido)
api.lineup(team, players[]) // GET /api/lineup/<team>?players=A|B|C (combinaciones 3-5)
api.onoff(team, player)     // GET /api/onoff/<team>/<player>
api.league(comp?) / api.teams() / api.games(comp?)  // comp = id de competencia
api.deleteGames(ids)        // DELETE /api/games (admin)
api.metricsCatalog()        // GET /api/metrics-catalog (T-05)
api.metrics(type, params)   // GET /api/metrics/<type> (T-05: team|player|lineup|onoff|clutch)
api.calibrate(entity, comp) // POST /api/settings/calibrate (T-02, admin)
api.ranking(type, metric, p) // GET /api/rankings/<type>/<metric> (T-01)
api.league(comp, {summary})  // GET /api/league[?include=summary] (T-01)
// Datos (F-11)
api.competitions(includeHidden?)       // GET /api/competitions[?include_hidden=1]
api.createCompetition({name, season})  // POST  (admin)
api.updateCompetition(id, {name?, season?, status?})   // PATCH (admin)
api.mergeCompetition(id, sourceId)     // POST /api/competitions/<id>/merge (admin)
api.assignGame(gameId, compId)         // PATCH /api/games/<id> (admin)
api.dataQuality(compId)                // GET /api/data-quality
api.reprocess({game_ids} | {competition_id, offset})   // POST /api/reprocess (admin)
api.seed()                  // POST   /api/seed  (dev)
// Partido (F-07 / F-01)
api.game(id, params?) / api.gamePbp(id, p?) / api.gameMatchups(id, p?) / api.gameShots(id, p)  // GET /api/game/<id>[/pbp|/matchups|/shots]
api.live(id, {url}?)        // GET    /api/live/<id>[?url=]  (snapshot en vivo, polling)
api.momentum(id, {url}?)    // GET    /api/live/<id>/momentum[?url=]  (F-02)
api.prepare({team, rival, last?, competition?})  // GET /api/prepare (F-03)
api.h2h({a, b, competition?})                    // GET /api/h2h (F-03)
// Configuración (F-13)
api.settings()              // GET    /api/settings
api.saveSettings(values)    // PUT    /api/settings
api.resetSettings(body)     // POST   /api/settings/reset
api.prefs(scope)            // GET    /api/prefs?scope=
api.savePref(scope, k, v)   // PUT    /api/prefs
api.deletePref(scope, k)    // DELETE /api/prefs
```

## `charts.js`

Wrappers sobre Chart.js v4.

| Función | Tipo | Descripción |
|---------|------|-------------|
| `drawLeagueScatter(canvasId, teams, axis)` | Scatter | Mapa de liga con ejes X/Y configurables (`axis` = `{xKey,yKey,xName,yName,xTitle,yTitle,xPct,yPct,xAvgLabel,yAvgLabel}`, armado por `_mapAxis` en `app.js`); zoom+pan. Presets en `LEAGUE_MAPS` (Eficiencia, Rebotes, Recuperos/Puntos). Los equipos con un eje nulo no se dibujan. Lienzo 2:1 en desktop y cuadrado en móvil (≤ 768 px), para que el título del eje Y entre completo |
| `drawRadar(canvasId, averages, league, label)` | Radar | Equipo vs promedio de liga (vista equipo) |
| `drawCompareRadar(canvasId, avgA, avgB, league, labelA, labelB)` | Radar | **Tres polígonos**: equipo A (naranja), equipo B (azul), promedio liga (gris punteado) |
| `drawEvolution(canvasId, gameLog, leagueOerAvg)` | Línea | Evolución de OER del equipo partido a partido vs media liga |
| `drawPlayerEvolution(canvasId, gameLog, leagueOerAvg)` | Línea | Evolución de métricas del jugador partido a partido + línea Ø OER de liga (C-02) |
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
| `_reloadTeam()` / `_reloadPlayer()` | Refetch del perfil con la selección activa (`competition`, `last`) via query params (C-02). El backend resuelve la competencia y devuelve promedios, league y context; el frontend no recalcula |
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
seleccionada**, tomado de `data.league` (C-02: un solo objeto, ya filtrado por el backend). El filtro
de últimos N cambia el valor de la entidad pero **no** el `Ø`. Sin competencia (`all`), `Ø` muestra
"—" con razón `sin_universo`. Sin datos en la población, razón `sin_datos`.

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
de Comparar). `PER/pos` se renderiza con `higherIsBetter = false`. Cada etiqueta lleva su definición en un `title`
(`_hint`): AS/pos "Asistencias por posesión propia (posesión = T2i + T3i + 0,44 × TLi + PER − RO)", PER/pos "Pérdidas por
posesión propia (PER = pérdidas)", PTS/pos "Puntos por posesión propia (igual al OER del jugador)", RO/min y RD/min
"… por minuto disputado". En "Rebotes & distribución", `OR%`/`DR%` aclaran que son la porción de los rebotes disponibles
que capturó mientras estuvo en cancha, **estimada por minutos y no comparable con el OR%/DR% de equipo**. Un nulo por
estimación imposible muestra "—" con `title` "Estimación no válida: la muestra de minutos es demasiado chica".

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

## Shot chart (`components/shot-chart.js`, C-03)

SVG de cancha clara estilo "El Metro", extraído de `app.js` a `components/shot-chart.js`. Consume `GET /api/shot-zones` vía `api.shotZones(params)`.

**Exports:**
- `shotChart(payload, opts)` — renderiza SVG. Elige 11 zonas o 3 zonas según `payload.has_coordinates`.
- `bindZoneTooltips(el, payload)` — enlaza interacción a los elementos `[data-zone]`: desktop (`hover:hover`) muestra tooltip posicionado cerca del cursor; mobile muestra bottom sheet con botón cerrar y backdrop.

**Datos del tooltip (7 puntos):** nombre de zona, made/attempts, FG%, eFG%, PPT, share %, percentil, sample badge (si no es "alta").

**Colores por zona:** `percentileColor(zone.percentile)` de `core/colors.js`. Sin percentil (null): gris neutro `#d1d5db`. Zona con 0 intentos: caja gris chica con "—".

**Modos:**
- `has_coordinates=true` → 11 casilleros (restricted_area, mid_left/right_close, mid_left/right_far, mid_top, left/right_corner_3, left/right_wing_3, top_key_3).
- `has_coordinates=false` → 3 casilleros (top_key_3, mid_top, restricted_area).

**Call sites (3):** vista Equipo mapa agregado (`renderTeamShotmapTeam`), vista Equipo mapa por jugador (`renderTeamShotmap`), vista Jugador. Todos usan `api.shotZones({entity, id, competition})` + `shotChart(shots)` + `bindZoneTooltips(el, shots)`. Estado vacío: "Sin tiros registrados para este equipo/jugador."

**CSS:** `.sc-tooltip` (desktop, position fixed, z-index 9999), `.sc-sheet` + `.sc-sheet-backdrop` (mobile bottom sheet).

## Login (frontend)

- `boot()` llama `api.me()` al arrancar. Si `auth_required && !authenticated` → renderiza la **pantalla de login** (`showLogin()`) y no construye la app.
- `renderApp()` arma la app normal; el header muestra el usuario + botón **Salir** cuando hay auth.
- `setUnauthorizedHandler` → ante un `401` (sesión expirada) vuelve a `showLogin()` con aviso.
- Sin auth (local sin `AUTH_USERS`), `boot()` va directo a la app. Ver [api.md → Autenticación](api.md#autenticación) y [deployment.md](deployment.md#configurar-el-login-en-render-paso-a-paso).

## Service Worker (`sw.js`)

Cache name: `smart-basket-v24`

**Estrategia:**
- `install`: pre-cachea los archivos estáticos listados en `STATIC[]`
- `activate`: elimina todas las caches anteriores (versiones viejas)
- `fetch`: rutas `/api/*` siempre van a red (nunca caché). Todo lo demás: cache-first con fallback a red.

**Para forzar actualización del SW:** incrementar la versión en `const CACHE = "smart-basket-vN"`.

**Assets cacheados:**
```js
"/", "/manifest.json", "/css/style.css",
"/js/app.js", "/js/api.js", "/js/charts.js", "/js/core/format.js",
"/js/core/prefs.js", "/js/core/catalog.js", "/js/core/colors.js", "/js/components/identity-merge.js",
"/js/components/settings-form.js", "/js/components/standard-panel.js", "/js/components/sample-badge.js",
"/js/components/metric-card.js", "/js/components/shot-chart.js", "/js/chart.umd.min.js"
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

> **C-07: `ppt` vs `pps`.** Las labels "PPT" en cards Eficiencia (equipo) y Producción (jugador) usan
> clave `ppt` = `(2·FGM2 + 3·FGM3) / FGA`. `pps` (`PTS/FGA`, incluye FT en numerador) se mantiene
> en backend por retro-compat pero no se muestra en UI. `SEARCH_METRICS` usa `ppt`.
> Tasas de tiro pooled (`season_shooting`) calculan `ppt`, `ppt_2`, `ppt_3`, `ppt_ft`, `fg2_pct`,
> `fg3_pct`, `ft_pct`, `fg2_uso`, `fg3_uso` desde totales de temporada.

### Conjunto estándar de métricas (T-05)

`core/catalog.js`: `loadCatalog()` (memoizada, una sola petición de `api.metricsCatalog()` por carga de
página, copia en `sessionStorage`), `metricDef(key)`, `metricLabel(key)`, `groupsFor(entityType)` (12 grupos
filtrados por `entities`), `stdKeyFor(legacyKey)` (mapa inverso de `legacy_keys`).

`core/format.js` (extensión C-11): `fmtMetric(key, value)` formatea según `fmt` del catálogo (`pct`→`PCT`,
`dec1`/`dec2`→`DEC1`/`DEC2`, `int`→entero, `signed_int`/`signed_dec2`→signo explícito "+"/"−"); `fmtSigned`.
`NULL_REASON_LABELS` suma `sin_pbp`, `no_aplica`, `no_disponible`.

`components/standard-panel.js`: `renderStandardPanel(el, payload, {layout, base, onBaseChange})`. Layout
`grid` (Equipo, Jugador, Combinación, Cierres): un `<details class="std-group">` por grupo (el grupo "Otras
métricas" cerrado), celdas con etiqueta + valor + marcas "est."/"parcial". Layout `compare` (ON/OFF): tabla
`Métrica | ON | OFF | Δ` (Δ solo en tasas). Estados: cargando ("Calculando métricas…"), vacío ("Sin partidos
en la selección…"), error (mensaje del backend). Selector de base (T-04) "Totales · Por partido · Por 40' · Por 100 pos." (`core/base.js`): una sola base para toda la sesión (sessionStorage `sb.base`), reflejada en la URL (`?base=`); sin elección arranca en `ui.default_base` (Configuración). El backend escala; el panel solo la pide. Métrica con posesiones estimadas → marca "estimado".

Montado en las cinco pantallas: Equipo y Jugador agregan una card nueva "Conjunto estándar" (no reemplaza las
cards existentes); Combinación, ON/OFF y Cierres **reemplazan** sus grillas de métricas anteriores por el
panel (conservan líderes, recuento de partidos y tabla por partido donde ya existían). Ver
`sdd/specs/v2/fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/`.

### Ficha de métrica (T-01)

`core/colors.js`: `percentileColor(p)` y `percentileBg(p, alpha)` — escala continua rojo(#ef4444,p0) ·
gris(#8b949e,p50) · verde(#22c55e,p100), interpolación lineal RGB.

`components/metric-card.js`: `metricCard(key, metricObj, {entityType, label, layout})` — reemplaza `statBox` en
Equipo/Jugador. Layout `card`: valor grande + cuatro líneas (ranking "N.º de M", líder con distancia, promedio
con signo, chip percentil coloreado). Layout `row`: usado por `standard-panel.js` (`cellHTML`). `fmtDelta`
formatea distancias (puntos porcentuales " pp" en porcentajes, signo U+2212). Casos: valor nulo → solo "—";
`pct_reason` → línea tenue ("Sin referencia: la población tiene menos de N entidades" / "Elegí una competencia…"
/ "Este filtro no tiene una población comparable"); `in_population: false` → `.fuera-poblacion` + chip "Muestra
baja · fuera de la población"; `basis: "partido"` → "(por partido)"; métrica neutral → sin color.
`bindMetricCards(el, {entityType, contextQuery})`: hover (escritorio) o tap (móvil) → popover/hoja inferior con
el ranking completo de la métrica (`api.ranking`), entidad resaltada, "Fuera de la población" aparte, pie "Ø …".

El bloque "Ø {promedio}" de `statBox` se retiró de Equipo y Jugador (ahora `statBox(label, value, display,
reason)` solo para los pocos usos sin ficha). Vista Liga: columna `#` por puesto de la métrica ordenada, celdas
coloreadas por percentil, filas fuera de población atenuadas con chip, `<tfoot>` con "Líder" y "Ø competencia"
(de `api.league(comp, {summary:true})`). El `_colorCell(val, avg, invert)` que mencionaban docs/CLAUDE.md/
Constitución regla 9 **nunca existió** (arquitectura §1.5 D-04); el color de percentil vive en `core/colors.js`.

### Confiabilidad de muestra (T-02)

`components/sample-badge.js`: `sampleBadge(sample, {compact})` — badge "Muestra BAJA/MEDIA/ALTA · N pos · M
PJ · S'" con tooltip de mínimo (absoluto o relativo). Integrado en `standard-panel.js`: cabecera del panel
(badge), clase `.metric-low-sample` + aviso "Muestra baja: no entra en rankings ni recomendaciones" cuando
`!sample.ranked`, y en las celdas `oer`/`der`/`net_rating` el valor crudo junto al ajustado (`.adj-value`) y
la banda de error (`.adj-band`) cuando el payload trae `adj`. El aviso fijo de "Muestra chica" (umbral 10
hardcodeado) se retiró: el umbral ahora es configurable (F-13) y por defecto 15 posesiones.

Vista Configuración (`renderConfig`): card de calibración de K (solo admin) — selector de entidad
(quinteto/ON-OFF) y competencia, botón que llama `api.calibrate(entity, competition)` y muestra "K sugerido:
N (r = … · U unidades · P pos por mitad)" o la advertencia correspondiente; "Aplicar" guarda el K sugerido
vía `api.saveSettings`.

### Configuración (F-13)

Ícono ⚙ en header (`btn-config`) abre sección `#sec-config`, fuera del nav principal. `renderConfig()` carga `api.settings()`, genera formulario con `renderSettingsForm(el, payload, {onSave, onReset})` (`components/settings-form.js`).

Controles por tipo: `int`/`float` → number, `bool` → checkbox, `enum` → select, `int_or_null` con choices → select, `json` → textarea. Solo lectura si `!is_admin`. Pills de sección, badge "Modificado", botón ↺ por clave, "Restablecer módulo" por sección. Sección sin claves activas: mensaje con features consumidoras. Errores de validación en línea por campo.

**Preferencias** (`core/prefs.js`): `loadPrefs(scope)` carga de API, cachea en memoria + localStorage. `getPref(scope, key, def)` lectura sync. `setPref(scope, key, value)` escritura optimista. Scopes: `table.columns`, `table.sort`, `table.colorize`, `panel.collapsed`, `ui`.

### Vista Liga — tabla general y ejes del mapa (C-09 / C-10)

**Tabla general** (T-06: migrada a `mountTable` con `league_standings`): tabla de posiciones clásica
arriba del ranking. Puntos = 2 por ganado + 1 por perdido; ordena por `_pos`. **Puntos, orden y desempate
los decide el backend** (`table_points`, `standings_pos`; DA-31, configurables desde F-13). El ranking
usa `mountTable` con `league_teams`; clic en fila abre el equipo.

- Bajo el título: "Solo partidos importados, no el fixture completo." (la tabla no conoce el fixture).
- Con más de una competencia y "Todas" elegido, la card no muestra la tabla (sumaría torneos distintos)
  sino "Elegí una competencia para ver la tabla general.". Con una sola competencia se ve siempre.

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

### Tablas completas y exportación (T-06)

**`components/data-table.js`**: `createDataTable(el, opts)` — tabla completa con estado,
ordenamiento (via `cmpNullsLast`), paginación (`page_size` desde prefs/config), selector de columnas
por grupo, celdas coloreadas por percentil (`percentileBg`), badge de muestra baja, filas de totales
y promedio, columna fija. `mountTable(el, loader, opts)` — wrapper que muestra spinner, fetcha el
payload via loader, monta `createDataTable` y maneja errores/reintentos/vacío.

**`components/exporters.js`**: `toCSV(data)` — CSV con BOM, cabecera `# clave: valor`, separador `;`,
decimal coma, nulos vacíos, protección de fórmulas (`'` prefix). `toPNG(node, {width})` — SVG
`foreignObject` con estilos inline, `devicePixelRatio` máx 2. `printNode(node, {pageSize})` — inyecta
`#print-root`, clase `body.printing`, escucha `afterprint`. `downloadBlob(blob, name)`, `tableToData(el, meta)`
serializa un `<table>` DOM a datos exportables. `buildExportNode(data)` — nodo HTML con cabecera
(título, entidad, competencia, filtros, base, orden, `pageInfo`, "Generado el … por …").

**`components/export-menu.js`**: `exportMenu(el, {getData, getNode, formats})` — botón + menú
CSV/XLSX/PNG/PDF (hoja inferior en móvil ≤ 768 px). Estados: "Generando archivo…", toast éxito/error,
aviso sin conexión para XLSX (servidor), fallback a PDF si PNG falla.

**Tablas migradas a `createDataTable`** (6): `league_teams`, `league_standings` (Liga),
`team_game_log`, `player_game_log`, `clutch_games`, `search_players`. Las funciones legacy eliminadas:
`_leagueTableHTML`, `_sortedLeague`, `_bindLeagueTableEvents`, `_standingsCardHTML`,
`_drawClutchTable`, `_renderSearchResults`, `SEARCH_COLS`, `CLUTCH_COLS`.

**Tablas legacy con exportMenu** (7+1): catálogo de partidos, ranking de uso, four factors, detalle
de tiro, ON/OFF, combinación, comparar (×2). Wrappers `_mountTableExport` (para `<table>`) y
`_mountPanelExport` (para paneles de stat-boxes/tablas múltiples).

**Bloque "Exportar todo"** en Importar: alcance Equipo/Competencia, selects dinámicos, botón
"Exportar XLSX" con estados (spinner/error/descarga) via `api.exportBulk`.

**`core/format.js`**: `cmpNullsLast(av, bv, dir)` — comparador con nulos al final en ambos sentidos,
strings con locale `es`. Migrado desde `app.js` (`_cmpNullsLast`).

**`@media print`**: solo `#print-root` visible, `print-color-adjust: exact`, `thead` repetido en
saltos de página. Clase `body.printing` oculta nav, header y footer.

**`sw.js`**: CACHE v23, 3 módulos nuevos en STATIC (`data-table.js`, `export-menu.js`, `exporters.js`).
