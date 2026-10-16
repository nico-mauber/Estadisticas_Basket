# Progress — F-04: Estadísticas por cuarto

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · Confirmar precondiciones (sin esquema; columnas F-11 y claves F-13)
- [ ] T-B1 · `WINDOWS`, `WINDOW_LABELS`, `window_events()`
- [ ] T-B2 · `events_bundle()` + `_agg` con `pf`/`fouls_drawn`/`blk_received`/`plus_minus`
- [ ] T-B3 · `window_minutes()` + `period_bundles()`
- [ ] T-B4 · `period_game_rows()`
- [ ] T-B5 · Registro del tipo `period` + caché
- [ ] T-B6 · Muestra y regresión de split
- [ ] T-B7 · Eco de contexto (`quarter` ignorado, `sin_pbp`)
- [ ] T-B8 · Tabla `period_splits`
- [ ] T-B9 · Tipo `clutch` con ventana de C-06 / migración a `events_bundle`
- [ ] T-C1 · Confirmar `api.table`/`api.metrics`
- [ ] T-D1 · `components/period-block.js`
- [ ] T-D2 · Pestaña `momentos` en `views/equipo.js`
- [ ] T-D3 · Tabla partido a partido + exportación
- [ ] T-D4 · Estilos y móvil
- [ ] T-E1 · Estados loading/vacío/error/offline
- [ ] T-E2 · `sw.js`
- [ ] T-E3 · Docs
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `upgrade_db()` idempotente (N/A)
- [ ] T-F3 · Endpoints probados con curl
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA recorridos

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ⬜ | |
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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A: sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/api.md` — tipo `period` en `/api/metrics/<entity_type>`; tabla `period_splits` (`view`, `window`)
- [ ] `docs/metrics.md` — definición de los 8 tramos, minutos por tramo, faltas desde pbp
- [ ] `docs/frontend.md` — pestaña Momentos, `components/period-block.js`, copy nuevo, versión de `CACHE`
- [ ] `docs/architecture.md` — `clutch.py` generalizado a tramos

## Deuda / TODO
