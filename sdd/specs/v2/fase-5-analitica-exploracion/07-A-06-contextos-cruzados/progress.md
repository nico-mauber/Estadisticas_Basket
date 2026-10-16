# Progress — A-06: Motor de contextos cruzados

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md). Spec: [spec.md](spec.md). Plan: [plan.md](plan.md).

## Estado de tareas
### Grupo A — Backend: fórmulas y registro de dimensiones
- [ ] T-A1 [P] · `stats_engine.cross_rates`
- [ ] T-A2 · `cross_context.py` con `DIMENSIONS`
- [ ] T-A3 · Dimensión `clutch` (`_clutch_info`)
- [ ] T-A4 · `value_of` del resto de dimensiones
- [ ] T-A5 · `team_possessions(include_incomplete=…)`
### Grupo B — Backend: motor, muestra, color, ruta y tabla
- [ ] T-B1 · `_units` y `_cells` (top-N, multiplicidad, caché)
- [ ] T-B2 · Muestra y ajuste por celda
- [ ] T-B3 · Percentiles (competencia / matriz)
- [ ] T-B4 · `_check`, totales y `cross_matrix`
- [ ] T-B5 · `PRESETS` y `preset=`
- [ ] T-B6 · `cell_detail`
- [ ] T-B7 · Tabla `cross_cells`
- [ ] T-B8 · `GET /api/cross`
### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.cross`
### Grupo D — Frontend: UI
- [ ] T-D1 · `components/cross-matrix.js`
- [ ] T-D2 · Pestaña `contextos` de S7
- [ ] T-D3 · Detalle de celda y exportación
- [ ] T-D4 [P] · Estilos
### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados de UI
- [ ] T-E2 · `sw.js` (`STATIC` y `CACHE`)
### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `database.py` idempotente
- [ ] T-F3 · Endpoints probados con curl
- [ ] T-F4 · Consola del navegador sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 … T-F23 · Verificación de CA-1…CA-18

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (A-06 no toca esquema): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/api.md` — `GET /api/cross`, tabla `cross_cells`, parámetros `side`/`limit`/`color`/`preset`/`cell_x`/`cell_y`
- [ ] `docs/metrics.md` — dimensiones de cruce, unidad oportunidad, cuadre, base del percentil, solapamiento de jugador en cancha
- [ ] `docs/frontend.md` — pestaña Contextos cruzados de S7, `cross-matrix.js`, copy nuevo (para extracción en F-21)
- [ ] `docs/architecture.md` — módulo `cross_context.py`

## Deuda / TODO
