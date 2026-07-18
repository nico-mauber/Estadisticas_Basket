# Spec — Feature 09: Filtro por competencia (Liga / Equipo / Comparar / Jugador)

> Feedback del cliente (2026-07-13): un equipo puede tener partidos de MÁS DE UNA competencia; hoy todas las vistas agregan y promedian esos partidos juntos, mezclando competencias. Se agrega un selector de competencia (como en Buscar) en Liga, Equipo, Comparar y Jugador. Hoy la base tiene 1 sola competencia → es forward-looking (el selector se oculta si hay ≤1).

## 1. Objetivo
Permitir filtrar las estadísticas de las vistas Liga, Equipo, Comparar y Jugador por una competencia específica, para que los promedios no mezclen partidos de competencias distintas. Sin competencia elegida ("Todas"), el comportamiento es el actual.

## 2. Fuentes (trazabilidad)
- `backend/database.py` — `Game.competition` (existe; `TeamGameStats`/`PlayerGameStats` NO tienen competencia → se join por `game_id`).
- `backend/app.py` — `search_players` ya acumula `competitions` por jugador (patrón a replicar); `team_stats`, `player_stats`, `league_overview`.
- `frontend/js/app.js` — vista Buscar (`renderSearch`/`_applySearch`, select `#sf-comp`) como patrón; `_computeAvg`, `_filteredLog`, las pills Últ. N (mecanismo de filtro cliente reusable).
- `docs/api.md`, `docs/frontend.md`.
- Constitución: reglas 3 (rutas `/api/*`), 4 (métricas on-the-fly), 9 (reuso de helpers frontend).

## 3. Historias de usuario
- US-1: Como entrenador, quiero filtrar una vista por competencia, para ver los promedios de esa competencia sin mezclarlos con otra.
- US-2: Como entrenador, quiero que el filtro conviva con los filtros existentes (Últ. N en Equipo), para combinar recortes.

## 4. Requisitos funcionales
- RF-1: El backend DEBE exponer `GET /api/competitions` → lista de competencias distintas. · (US-1)
- RF-2: `GET /api/league` DEBE aceptar `?competition=<c>` y agregar solo los partidos de esa competencia (ranking + promedios). · (US-1)
- RF-3: `GET /api/team/<code>` y `GET /api/player/<code>/<name>` DEBEN incluir `competition` en cada entrada del `game_log`, para que el frontend filtre y recompute client-side. · (US-1)
- RF-4: Las vistas Equipo, Comparar y Jugador DEBEN filtrar su `game_log` por competencia y recomputar los promedios con `_computeAvg` (reuso del mecanismo de las pills Últ. N). · (US-1, US-2)
- RF-5: La vista Liga DEBE refetchear `GET /api/league?competition=` al cambiar el selector (no tiene game_log client-side). · (US-1)
- RF-6: Todos los selectores DEBEN ocultarse cuando hay ≤1 competencia (no aporta valor). Valor vacío = "Todas las competencias" = sin filtro. · (US-1)
- RF-7: En Equipo, el filtro por competencia DEBE componer con las pills Últ. N (ambos recortan el mismo `game_log` antes de `_computeAvg`). · (US-2)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `GET /api/competitions` | endpoint | `["Liga Uruguaya…", …]` (strings distintos) | **NUEVO** |
| `GET /api/league?competition=<c>` | endpoint | igual shape; solo equipos con partidos en `c` | modificado |
| `GET /api/team/<code>` game_log[] | campo | `+ "competition"` por partido | modificado |
| `GET /api/player/<code>/<name>` game_log[] | campo | `+ "competition"` por partido | modificado |

Sin cambios de esquema (usa `Game.competition`). Helpers frontend nuevos: `_logComps`, `_filterByComp`, `_compOptions`.

## 6. Estados de UI
| Vista | ≤1 competencia | >1 competencia | filtro activo |
|---|---|---|---|
| Liga | select oculto | `<select>` en el header del ranking; al cambiar refetch + re-render tabla+mapa | ranking solo de esa competencia |
| Equipo | `#team-comp-wrap` oculto | select junto a las pills; recompute client-side | promedios de la competencia (compone con Últ. N); record solo sin filtro |
| Comparar | `#compare-comp` oculto | select en los controles; recompute de ambos equipos | box score de la competencia |
| Jugador | select oculto | select arriba de la primera card; recompute | métricas + game log de la competencia |

## 7. Criterios de aceptación
- CA-1: `GET /api/competitions` devuelve la lista de competencias distintas de `games`.
- CA-2: `GET /api/league?competition=X` devuelve solo equipos con partidos en X; con competencia inexistente → `[]` (sin 500).
- CA-3: `GET /api/team/<code>` y `/api/player/...` traen `competition` en cada `game_log[]`.
- CA-4: Con 1 competencia, los 4 selects están ocultos y el comportamiento es idéntico al previo (sin regresión).
- CA-5: Con >1 competencia (verificable importando un partido de otra), elegir una cambia los promedios mostrados; en Equipo compone con Últ. 5/Últ. 3.
- CA-6: Sin errores de consola en las 4 vistas.

## 8. Fuera de alcance
- Baseline de liga (Ø/best para colorear en Equipo/Jugador) por-competencia — queda cross-competencia; se difiere (requiere baseline backend por-competencia).
- Shot chart del jugador por-competencia — el mapa sigue siendo global del jugador (se difiere; el feed FUBB no expone coordenadas igual).
- Método de promedios (media de %/partido vs. pooled) — el cliente confirmó que "revisar promedios" = mezcla de competencias, no el método.

## 9. Ambigüedades
- [RESUELTA] ¿Filtro client-side o backend? → **Equipo/Comparar/Jugador client-side** (reusan `_computeAvg` sobre el `game_log` que ya viene); **Liga backend** (`?competition=`, no tiene game_log client-side).
- [RESUELTA] ¿Mostrar el select siempre? → **Solo si >1 competencia** (RF-6).
