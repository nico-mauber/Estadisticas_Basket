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
| **Importar** | `#import` | Input URL FIBA LiveStats + botón importar |
| **Liga** | `#league` | Tabla ranking de equipos, columnas ordenables |
| **Equipo** | `#team` | Record, Four Factors, métricas avanzadas, shot chart (si hay datos), game log |
| **Jugador** | `#player` | Métricas individuales, shot chart por zonas, game log |
| **Comparar** | `#compare` | Radar chart overlay de dos equipos + tabla comparativa |

## `api.js`

Capa delgada de fetch. Cada función llama a un endpoint y retorna el JSON parseado. No tiene lógica de presentación. Ejemplo:

```js
export async function fetchTeam(code)   // GET /api/team/<code>
export async function fetchPlayer(...)  // GET /api/player/<code>/<name>
export async function fetchShots(...)   // GET /api/shots/<code>/<name>
export async function importGame(url)   // POST /api/import
```

## `charts.js`

Wrappers sobre Chart.js v4.

| Función | Tipo | Descripción |
|---------|------|-------------|
| `drawLeagueScatter(canvasId, data, xKey, yKey, ...)` | Scatter | Mapa ofensivo/defensivo con zoom+pan (wheel + pinch) |
| `drawCompareRadar(canvasId, avgA, avgB, league, labelA, labelB)` | Radar | Dos equipos superpuestos (naranja + azul) |
| `resetZoom(canvasId)` | Util | Reset zoom del scatter |

**Plugins cargados desde CDN en `index.html`:**
- `hammerjs@2.0.8` — touch events para pinch-zoom
- `chartjs-plugin-zoom@2.0.1` — zoom/pan sobre Chart.js

## `app.js`

Lógica principal. Funciones clave:

| Función | Descripción |
|---------|-------------|
| `_renderLeague()` | Renderiza tabla de liga con sort clickeable |
| `_renderTeamContent(data)` | Record card + Four Factors + métricas + shot chart + game log |
| `_renderPlayerContent(data)` | Métricas jugador + shot chart por zonas + game log |
| `_computeAvg(gameLog, keys)` | Promedia un array de partidos sobre las keys pedidas |
| `_fourFactorsCard(av, name)` | Tabla Four Factors equipo vs rival con color-coding |
| `_recordCard(record, name)` | Display W/L con porcentaje, local, visitante |
| `_colorCell(val, avg, invert)` | Color verde/rojo relativo al promedio de liga |

## Service Worker (`sw.js`)

Cache name: `courtiq-v9`

**Estrategia:**
- `install`: pre-cachea los archivos estáticos listados en `STATIC[]`
- `activate`: elimina todas las caches anteriores (versiones viejas)
- `fetch`: rutas `/api/*` siempre van a red (nunca caché). Todo lo demás: cache-first con fallback a red.

**Para forzar actualización del SW:** incrementar la versión en `const CACHE = "courtiq-vN"`.

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
