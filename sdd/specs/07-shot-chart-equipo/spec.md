# Spec — Feature 07 (tarea 9): Mapa de tiro del jugador dentro de la vista Equipo

> **Sin backend nuevo.** El endpoint (`GET /api/shots/...`) y el render SVG (`_shotChartSVG`) ya existen (Feature 01). MVP puramente frontend: mostrar el mismo mapa de tiro dentro de la vista Equipo, sin salir del análisis del equipo. Es la feature de menor riesgo del lote.

## 1. Objetivo
Permitir visualizar el mapa de tiro por zonas de cualquier jugador del equipo desde la propia vista Equipo, reutilizando exactamente el mismo mapa que hoy vive en la vista Jugador, sin navegar fuera del análisis del equipo.

## 2. Fuentes (trazabilidad)
- `docs/api.md` §`GET /api/shots/<team_code>/<player_name>` — endpoint existente que devuelve `zones`, `total_shots`, `has_coordinates`, `summary`. No cambia.
- `docs/frontend.md` §"Shot chart" — `_shotChartSVG(zones, totalShots, summary, hasCoordinates)` (dispatcher 11/3 zonas) ya implementado; `api.playerShots(teamCode, playerName)` ya existe en `api.js`.
- `docs/frontend.md` §Vistas → "Equipo": la vista ya tiene `#player-select` y el botón `#btn-show-player` ("Ver jugador").
- Feature 01 `spec.md` §8 "Fuera de alcance": *"Shot chart a nivel Equipo... no está implementado hoy"* — esta feature cubre justamente ese pendiente (a nivel jugador dentro de Equipo, no un shot chart agregado de todo el equipo).
- Constitución 9 (reusar helpers/render existentes antes de crear), 7 (mobile-first).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver el mapa de tiro de un jugador sin salir de la vista Equipo, para no perder el contexto del análisis del equipo mientras reviso a sus jugadores.

## 4. Requisitos funcionales
- RF-1: La vista Equipo DEBE permitir, tras elegir un jugador en el `#player-select` existente, mostrar su mapa de tiro por zonas **dentro de la misma vista Equipo** (sin cambiar a la sección Jugador). · (US-1, `docs/frontend.md` §Vistas Equipo)
- RF-2: El mapa DEBE ser el mismo que produce `_shotChartSVG(...)` (dispatcher 11/3 zonas según `has_coordinates`), consumiendo `api.playerShots(teamCode, playerName)` — sin duplicar la lógica de render ni la llamada de datos (regla de reuso). · (US-1, `docs/frontend.md` §Shot chart, Constitución 9)
- RF-3: Si el jugador no tiene tiros registrados (`total_shots === 0`), NO se debe insertar el mapa (mismo comportamiento que la vista Jugador). · (US-1, Feature 01 comportamiento actual)
- RF-4: El mapa dentro de Equipo DEBE convivir con el flujo existente: el botón "Ver jugador" (que navega a la vista Jugador) sigue funcionando igual; esta feature agrega una acción, no reemplaza la actual. · (US-1)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `GET /api/shots/<team_code>/<player_name>` | endpoint existente | `{ zones, total_shots, has_coordinates, summary }` — sin cambios | No |
| `api.playerShots(code, name)` | api.js existente | sin cambios | No |
| `_shotChartSVG(zones, total, summary, hasCoord)` | render existente | sin cambios | No |

Sin cambios de backend, esquema, ni `api.js`. Solo `app.js` (vista Equipo) y, si hace falta, `index.html`/CSS para el contenedor.

## 6. Estados de UI
Dentro de la vista Equipo (`#sec-team`), asociado al `#player-select` existente.
| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Mapa de tiro del jugador en Equipo | spinner mientras resuelve `api.playerShots` | jugador sin tiros (`total_shots===0`): no se inserta la tarjeta (igual que hoy en Jugador) | `.catch` silencioso (igual que hoy en Jugador — no rompe la vista) | `/api/*` siempre a red (SW) | Tarjeta con el mismo SVG de zonas + badge que la vista Jugador, titulada con el nombre del jugador |

Copy reutilizado del existente: título de tarjeta `"Shot chart por zonas — <jugador>"` (idéntico al de la vista Jugador; sin copy nuevo).

## 7. Criterios de aceptación
- CA-1: Given un equipo seleccionado y un jugador con tiros elegido en `#player-select`, When se dispara la acción de mostrar el mapa dentro de Equipo, Then aparece el mapa de tiro por zonas del jugador en la vista Equipo, sin cambiar de sección.
- CA-2: Given un jugador con `has_coordinates=false` (caso FUBB), When se muestra su mapa en Equipo, Then se renderiza el modo de 3 zonas (idéntico al de la vista Jugador).
- CA-3: Given un jugador sin tiros (`total_shots===0`), When se intenta mostrar su mapa, Then no se inserta ninguna tarjeta y no hay error en consola.
- CA-4: Given el botón "Ver jugador" existente, When se usa, Then sigue navegando a la vista Jugador como antes (esta feature no lo altera).
- CA-5: Given el mapa mostrado en Equipo y el mapa de la vista Jugador para el mismo jugador, When se comparan, Then son visualmente idénticos (misma función de render, mismos datos).

## 8. Fuera de alcance (backlog documentado)
- **Shot chart AGREGADO de todo el equipo** (suma de todos los jugadores en una sola cancha) — esta feature es el mapa *por jugador* dentro de Equipo, no un agregado del equipo. El agregado queda como feature futura.
- **Comparar mapas de dos jugadores** lado a lado.
- **Filtrar el mapa por rango de partidos** (últimos N) dentro de Equipo — el mapa usa todos los tiros del jugador (comportamiento actual del endpoint).
- **Coordenadas reales de tiro** (mejorar el modo 3 zonas) — pertenece a la exploración de Feature 01 / `tm[n].shot`, no a ésta.

## 9. Ambigüedades
- [RESUELTA] ¿Botón aparte o reusar "Ver jugador"? → **Decisión MVP:** un control adicional (ej. botón "Ver mapa de tiro" junto a "Ver jugador", o mostrar el mapa automáticamente al elegir jugador en Equipo) que inserta el mapa en la vista Equipo. El Paso 2 (plan) fija el disparador exacto respetando mobile-first; ambas opciones reusan `api.playerShots` + `_shotChartSVG`. No cambia el comportamiento del botón "Ver jugador".
- [RESUELTA] ¿Dónde se inserta la tarjeta? → **Decisión:** dentro de `#team-main` o como tarjeta dedicada bajo los controles del equipo; sin bloquear el render del resto de la vista (inserción async no-bloqueante, igual que en `renderPlayer`).
