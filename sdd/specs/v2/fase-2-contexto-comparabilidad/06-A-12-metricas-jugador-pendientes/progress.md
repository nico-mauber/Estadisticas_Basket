# Progress — A-12: Métricas de jugador pendientes

> **Estado:** ✅ Implementado (cuota de asistencias del equipo, puntos generados y puntos por asistencia; `player_poss_duration` ya lo aportaba A-01)
> **Fecha:** 2026-10-23

## Estado de tareas
- [x] RF-1 · `ast_team_share` = AST del jugador ÷ AST del equipo en los partidos que disputó (cociente de totales; los DNP quedan fuera)
- [x] RF-2 · AS/pos y la cuota del equipo son dos indicadores distintos, con tooltips de fórmula distintos, uno junto al otro
- [x] RF-3 · Cada asistencia se vincula con su tiro (`previousAction`) y se clasifica en 2 puntos, 3 puntos o tiro libre
- [x] RF-4 · `ast_points` = 2 × asist. a 2 + 3 × asist. a 3; `pts_per_ast` = `ast_points` ÷ asistencias a tiros de campo
- [x] RF-5 · `pbp_events.previous_action` persistido; `INGEST_VERSION` 4 → 5; los 13 partidos reprocesados desde el archivo, sin red
- [x] RF-6 · Las tres claves en el catálogo (solo jugador; `no_aplica` en el resto); 86 → 89 métricas
- [x] RF-7 · Card "Creación de juego" en la vista Jugador, cada indicador con su ficha de T-01
- [x] RF-8 · `player_poss_duration`: ya lo calculaba A-01; la card muestra "—" con la explicación mientras falte el dato
- [x] RF-9 · `ast_points` escala con la base de T-04; la cuota y los puntos por asistencia no
- [x] RF-10 · Sin vínculo → `no_registrado`; sin pbp → `sin_pbp`; sin asistencias → `sin_asistencias`; nunca 0
- [x] RF-11 · El panel de calidad cuenta las asistencias sin vínculo (`previous_action`)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| Vínculo importado | ✅ | 459 de 459 asistencias con `previous_action`; apuntan siempre a un 2pt, 3pt o tiro libre |
| Clasificación completa | ✅ | Partido 2849343: 19 a 2, 6 a 3, 4 a tiro libre = 29 = asistencias del box oficial |
| Cuota del equipo | ✅ | F. Garcia: 8 de 30 = 26,7 %, igual al cálculo independiente |
| Puntos generados | ✅ | 14 puntos con 8 asistencias; 2,33 por asistencia |
| Nulos | ✅ | Partido con el vínculo borrado → `no_registrado`; la cuota se sigue calculando |
| Base | ✅ | `base=partido` divide `ast_points` por los partidos jugados; la cuota no cambia |
| Equipo | ✅ | `ast_team_share` en un equipo → `no_aplica` |
| Panel de calidad | ✅ | `previous_action`: 0 sin vínculo sobre 459 asistencias |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: ✅ (corre dos veces sin error)
- Consola del navegador sin errores JS: ✅ (1280 y 360 px)
- Verificación: `a12_sim.py` 19/19, `a12_browser.py` 24/24, regresión completa en verde

## Desviaciones respecto a docs/ o plan
- **`player_poss_duration` no es nuevo:** ya existía en el grupo "uso" y A-01 lo calcula; se dejó como está y se agregó solo a la card. Una primera versión lo duplicó en el grupo "balón" y la aserción de claves del catálogo lo detectó.
- **Sin módulo `assist-card.js` ni pestaña `distribucion`:** la card entra en el grupo de métricas de la vista Jugador, como el resto de las cards.
- **AS/pos se mantiene también en "Por posesión y por minuto"** (no se quitó de allí): aparece en las dos cards.
- **Razones nuevas:** `sin_asistencias` y `requiere_posesiones` se agregaron a `NULL_REASON_CODES`.

## Docs actualizados
- ✅ `docs/metrics.md` · ✅ `docs/database.md`

## Deuda / TODO
- Quitar AS/pos de "Por posesión y por minuto" si se decide que solo viva en Creación de juego.
- `t()` para el copy (F-21).
