# Spec — Feature 10: Mapa de tiro del equipo (vista Equipo)

> Feedback del cliente (2026-07-13): "no mostrar solo el mapa de tiro de jugador, también mostrar el mapa de tiro del equipo".

## 1. Objetivo
En la vista Equipo, mostrar el mapa de tiro AGREGADO del equipo (todos sus jugadores), además del mapa por jugador que ya existe.

## 2. Fuentes
- `backend/app.py` — `player_shots` (`/api/shots/<team>/<player>`) y la lógica de zonas (`_zones_from_shots`, `ZONE_KEYS_11`, `_classify_zone_11`).
- `frontend/js/app.js` — `_shotChartSVG`, `renderTeamShotmap` (mapa del jugador dentro de Equipo).

## 3. Historia de usuario
- US-1: Como entrenador, quiero ver dónde tira el equipo entero, para entender el perfil ofensivo colectivo.

## 4. Requisitos funcionales
- RF-1: El backend DEBE exponer `GET /api/shots/<team_code>` con el mapa de zonas agregado de TODOS los jugadores del equipo (mismo shape que el de jugador). PPP del equipo desde `TeamGameStats`. · (US-1)
- RF-2: La vista Equipo DEBE mostrar el mapa del equipo automáticamente al seleccionar un equipo (card propia, `#team-teamshot`), reusando `_shotChartSVG`. · (US-1)
- RF-3: El mapa del jugador (botón "Ver mapa de tiro") DEBE seguir funcionando igual. · (US-1)

## 5. API
| Endpoint | Shape | Nuevo? |
|---|---|---|
| `GET /api/shots/<team_code>` | `{ zones, total_shots, has_coordinates, summary:{global_pf,efg_pct,ppp,games} }` | **NUEVO** |

## 6. UI
| Componente | vacío | éxito |
|---|---|---|
| `#team-teamshot` | sin tiros → card vacía (no se muestra) | card "Mapa de tiro del equipo — CÓDIGO" con el SVG de zonas |

## 7. Criterios de aceptación
- CA-1: `GET /api/shots/CNF` → `total_shots > 0`, zonas con made/attempts, summary con ppp/games del equipo.
- CA-2: Al seleccionar un equipo, aparece la card "Mapa de tiro del equipo" con el SVG, arriba del mapa del jugador.
- CA-3: El mapa del jugador (botón) sigue funcionando; ambos coexisten sin errores de consola.

## 8. Fuera de alcance
- Filtro del mapa del equipo por competencia (queda global, como el del jugador).
