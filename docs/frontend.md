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
| **Importar** | `#import` | Input URL FIBA LiveStats + botón importar; botón "Agregar partidos" (seed) solo si `seed_enabled` (dev) |
| **Liga** | `#league` | Tabla ranking de equipos (columnas ordenables) + mapa de dispersión con ejes X/Y seleccionables (`LEAGUE_MAPS`). *(Los Cierres se movieron a la vista Equipo — Feature 05 v2.)* |
| **Equipo** | `#team` | Record, Four Factors, métricas avanzadas, desglose ofensivo, shot chart (si hay datos), game log. Botón **"Ver mapa de tiro"**: shot chart por zonas del jugador seleccionado dentro de Equipo (`#team-shotmap`). Botón **"Ver ON/OFF"**: dos tablas `ON \| OFF \| Δ` del jugador — **Eficiencia** (tasas, Δ del backend) y **Producción del equipo** (conteos crudos: pts a favor/contra, REB, AST, pérdidas, robos, tapones; Δ = ON−OFF) (`#team-onoff`, `renderTeamOnOff`, Feature 04). Apartado **"Combinaciones (Lineups)"**: multi-select de 3-5 jugadores + botón "Analizar combinación" → tarjeta de métricas y líderes (`#team-lineup-picker`/`#team-lineup`, `renderTeamLineup`, Feature 03). Apartado **"Cierres (últimos 5 min, dif ≤ 15)"**: tarjeta agregada del equipo ("mini-partido" de sus cierres apretados, con récord) + tabla por partido ordenable (`#team-clutch`, `renderTeamClutch`, Feature 05 v2) |
| **Jugador** | `#player` | Métricas individuales, shot chart (11 zonas o 3 zonas según disponibilidad de coordenadas), game log |
| **Comparar** | `#compare` | Radar de tres polígonos (equipo A, equipo B, promedio liga) + box score FIBA |
| **Buscar** | `#search` | Buscador avanzado de jugadores: filtros combinables (nombre, equipo, competencia, posición, rangos mín/máx de métricas) sobre todos los jugadores de la base; tabla ordenable; fila → vista Jugador |

**Vista Equipo — card "Desglose ofensivo":** se renderiza solo si hay datos (>0) en PeP / Seg. Op. / Ptos/PER / Banca / PCA (columnas `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts`).

**Vista Comparar — box score FIBA:** tabla de 3 columnas (`valor A | etiqueta | valor B`) con el ganador de cada fila resaltado en verde. Filas: LC, 2Pts, 3Pts, 1Pt (con %), REB, As, ST, Blq, PER, FP (formato `faltas (recibidas)`), PeP, PtsSegCh, PtPer, Pts Banca, PCA. Clase CSS `.fiba-box`.

## `api.js`

Capa delgada de fetch. Exporta el objeto `api` (un método por endpoint) y `setUnauthorizedHandler(fn)`. Cada request usa `credentials: "same-origin"` (envía la cookie de sesión). Un `401` global dispara el handler → el SPA vuelve a la pantalla de login.

```js
api.login(user, password)   // POST   /api/login
api.logout()                // POST   /api/logout
api.me()                    // GET    /api/me  (auth + feature flags)
api.importGame(url)         // POST   /api/import
api.team(code)              // GET    /api/team/<code>
api.players(code) / api.player(code, name) / api.playerShots(code, name)
api.searchPlayers()         // GET /api/search/players (buscador avanzado)
api.clutchTeam(team)        // GET /api/clutch/<team> (cierres del equipo: agregado + por partido)
api.lineup(team, players[]) // GET /api/lineup/<team>?players=A|B|C (combinaciones 3-5)
api.onoff(team, player)     // GET /api/onoff/<team>/<player>
api.league() / api.teams() / api.games()
api.deleteGames(ids)        // DELETE /api/games
api.seed()                  // POST   /api/seed  (dev)
```

## `charts.js`

Wrappers sobre Chart.js v4.

| Función | Tipo | Descripción |
|---------|------|-------------|
| `drawLeagueScatter(canvasId, teams, axis)` | Scatter | Mapa de liga con ejes X/Y configurables (`axis` = `{xKey,yKey,xName,yName,xTitle,yTitle,xPct,yPct}`); zoom+pan. Presets en `LEAGUE_MAPS` (Eficiencia, Rebotes, Recuperos/Puntos) |
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
| `_computeAvg(gameLog, keys)` | Promedia un array de partidos sobre las keys pedidas |
| `_fourFactorsCard(av, name)` | Tabla Four Factors equipo vs rival con color-coding |
| `_recordCard(record, name)` | Display W/L con porcentaje, local, visitante |
| `_colorCell(val, avg, invert)` | Color verde/rojo relativo al promedio de liga |

## Shot chart

SVG de cancha clara estilo "El Metro" (`frontend/js/app.js`), generado por `_shotChartSVG(zones, totalShots, summary, hasCoordinates)`:

- `hasCoordinates=true` → `_shotChart11SVG`: 11 casilleros (restricted_area, mid_left/right_close, mid_left/right_far, mid_top, left/right_corner_3, left/right_wing_3, top_key_3).
- `hasCoordinates=false` → `_shotChart3SVG`: 3 casilleros (Triple/top_key_3, Media/mid_top, Pintura/restricted_area) — caso real de la competencia FUBB, cuyo feed de FIBA LiveStats no expone coordenadas de tiro (ver [api.md → GET /api/shots](api.md#get-apishotsteam_codeplayer_name)).

Ambos modos comparten geometría de cancha, paleta y heatmap por P/F (`_courtLinesSVG`, `_scLbl`, `_scBadge`, constantes `SC_*`) — sin duplicación de estilo entre modos.

El mismo mapa se muestra en dos lugares: en la vista **Jugador** (`renderPlayer`) y dentro de la vista **Equipo** vía el botón "Ver mapa de tiro" (`renderTeamShotmap` → contenedor `#team-shotmap`). Ambos reusan `api.playerShots(...)` + `_shotChartSVG(...)`.

## Login (frontend)

- `boot()` llama `api.me()` al arrancar. Si `auth_required && !authenticated` → renderiza la **pantalla de login** (`showLogin()`) y no construye la app.
- `renderApp()` arma la app normal; el header muestra el usuario + botón **Salir** cuando hay auth.
- `setUnauthorizedHandler` → ante un `401` (sesión expirada) vuelve a `showLogin()` con aviso.
- Sin auth (local sin `AUTH_USERS`), `boot()` va directo a la app. Ver [api.md → Autenticación](api.md#autenticación) y [deployment.md](deployment.md#configurar-el-login-en-render-paso-a-paso).

## Service Worker (`sw.js`)

Cache name: `smart-basket-v8`

**Estrategia:**
- `install`: pre-cachea los archivos estáticos listados en `STATIC[]`
- `activate`: elimina todas las caches anteriores (versiones viejas)
- `fetch`: rutas `/api/*` siempre van a red (nunca caché). Todo lo demás: cache-first con fallback a red.

**Para forzar actualización del SW:** incrementar la versión en `const CACHE = "smart-basket-vN"`.

**Assets cacheados:**
```js
"/", "/manifest.json", "/css/style.css",
"/js/app.js", "/js/api.js", "/js/charts.js", "/js/chart.umd.min.js"
```

## PWA

- `manifest.json` define nombre, colores, iconos y `display: standalone`
- Iconos generados con Pillow: círculo naranja con costuras de básquetbol
- En iOS: el ícono solo se actualiza si se desinstala y reinstala la app desde Safari (comportamiento de iOS, no un bug)

## Responsive / Mobile

- Nav inferior fijo en mobile (`position: fixed; bottom: 0`)
- Nav superior en desktop
- CSS custom properties para dark mode
- Breakpoint principal: `768px`
