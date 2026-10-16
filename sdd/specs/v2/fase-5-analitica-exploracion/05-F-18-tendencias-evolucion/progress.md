# Progress — F-18: Tendencias y evolución configurable

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md). Spec: [spec.md](spec.md). Plan: [plan.md](plan.md).

## Estado de tareas
### Grupo A — Backend: configuración y estadística
- [ ] T-A1 [P] · Claves `trends.*` en `CONFIG_SPEC`
- [ ] T-A2 [P] · `stats_engine.welch_t_test`
### Grupo B — Backend: serie, tendencia, hitos y ruta
- [ ] T-B1 · `_game_table`
- [ ] T-B2 · `_assign_axes` y validación de métricas
- [ ] T-B3 · `_moving_average` y `trend_series`
- [ ] T-B4 · `recent_vs_rest`
- [ ] T-B5 · Hitos (rachas, jugadores clave, ausencias)
- [ ] T-B6 · `trends_report` y `GET /api/trends`
### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.trends`
### Grupo D — Frontend: gráficos y componente
- [ ] T-D1 · `drawTrend` y `drawMargin`
- [ ] T-D2 · `milestonesPlugin`
- [ ] T-D3 · `components/trend-chart.js`
- [ ] T-D4 · Exportación
- [ ] T-D5 · Montaje en S3 Game log, S4 Tendencias y S3 Quintetos
- [ ] T-D6 · Retiro de `drawEvolution`/`drawPlayerEvolution`
- [ ] T-D7 [P] · Estilos
### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados de UI
- [ ] T-E2 · `sw.js` (`STATIC` y `CACHE`)
### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `database.py` idempotente
- [ ] T-F3 · Endpoints probados con curl
- [ ] T-F4 · Consola del navegador sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 · Verificación numérica de la prueba de Welch
- [ ] T-F7 … T-F26 · Verificación de CA-1…CA-21

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |
| CA-9 | ⬜ | |
| CA-10 | ⬜ | |
| CA-11 | ⬜ | |
| CA-12 | ⬜ | |
| CA-13 | ⬜ | |
| CA-14 | ⬜ | |
| CA-15 | ⬜ | |
| CA-16 | ⬜ | |
| CA-17 | ⬜ | |
| CA-18 | ⬜ | |
| CA-19 | ⬜ | |
| CA-20 | ⬜ | |
| CA-21 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (F-18 no toca esquema): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/api.md` — `GET /api/trends`, claves de configuración `trends.*`
- [ ] `docs/metrics.md` — media móvil, delta pooled, prueba de Welch, jugador clave, racha, diferencia de puntos
- [ ] `docs/frontend.md` — componente de evolución, `drawTrend`/`drawMargin`, retiro de `drawEvolution`/`drawPlayerEvolution`, copy nuevo (para extracción en F-21)
- [ ] `docs/architecture.md` — módulo `trends.py`, `welch_t_test`

## Deuda / TODO
