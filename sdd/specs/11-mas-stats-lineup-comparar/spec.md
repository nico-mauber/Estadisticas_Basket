# Spec — Feature 11: Más estadísticas en Combinación (lineup) y Comparar

> Feedback del cliente (2026-07-13): "En combinación mostrar más estadísticas, también en comparar, en una tabla similar a la de cierres → por partido".

## 1. Objetivo
Mostrar más estadísticas en la card de Combinación (lineup) de la vista Equipo y en la vista Comparar, presentadas como una tabla ancha estilo la de Cierres (una fila por entidad, muchas columnas de stats).

## 2. Fuentes
- `frontend/js/app.js` — `renderTeamLineup` (card de combinación), `renderCompare` (box score FIBA + radar), `_drawClutchTable` (tabla ancha `.search-table` de referencia).
- `backend/lineups.py` — `lineup_stats` (`raw`/`metrics`/`sample`).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver la línea completa de una combinación (crudos + tasas), no solo 5 métricas.
- US-2: Como entrenador, quiero comparar las métricas avanzadas de dos equipos en una tabla.

## 4. Requisitos funcionales
- RF-1: `lineup_stats` DEBE exponer en `raw` también `pts`, `pts_against` y `reb` (además de los crudos ya presentes). · (US-1)
- RF-2: La card de Combinación DEBE incluir una tabla ancha (`.search-table`) con una fila: Off/Def/Net/eFG%/TS%/Pos/Pts/Pts-C/REB/OR/DR/AST/TOV/ROB/TAP/FGA/3PA/FTA. Los statboxes y líderes actuales se mantienen. · (US-1)
- RF-3: La vista Comparar DEBE incluir una tabla ancha "Métricas avanzadas" (`.search-table`) con una fila por equipo: Off/Def/Net/eFG%/TS%/Pace/OR%/DR%/TO%/AS%/Pts/Pos. El box score FIBA y el radar se mantienen. · (US-2)

## 5. API
Sin endpoints nuevos. `GET /api/lineup/...` `raw` amplía 3 campos (`pts`, `pts_against`, `reb`). Comparar reusa `GET /api/team/<code>` (averages).

## 6. UI
| Componente | éxito |
|---|---|
| Combinación (`#team-lineup`) | statboxes + **tabla ancha** + líderes |
| Comparar (`#compare-result`) | radar + box score FIBA + **card "Métricas avanzadas"** (tabla 2 filas) |

## 7. Criterios de aceptación
- CA-1: `GET /api/lineup/...` → `raw` incluye `pts`, `pts_against`, `reb`.
- CA-2: La card de Combinación muestra la tabla ancha con los valores del combo (verificable: Pts/REB/AST coherentes con el combo).
- CA-3: Comparar muestra la card "Métricas avanzadas" con una fila por equipo y las columnas listadas; sin errores de consola.

## 8. Fuera de alcance
- Desglose por-partido de una combinación (lineup_stats agrega multi-partido; no hay per-game de lineup).
- Colorear ganador en la tabla avanzada de Comparar (se difiere; el box score FIBA ya resalta ganadores).
