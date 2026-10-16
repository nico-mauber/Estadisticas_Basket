# Progress — F-09: Comparar quintetos

> **Estado:** ⬜ No iniciado

## Estado de tareas
### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.metrics("lineup", …)`

### Grupo D — Frontend: UI
- [ ] T-D1 · Pestaña "Quintetos" en Comparar
- [ ] T-D2 · Selector de combinación por lado (equipo + checkboxes)
- [ ] T-D3 · `renderCompareLineups()`
- [ ] T-D4 · Tabla de métricas enfrentadas (valor ajustado)
- [ ] T-D5 · Badge de muestra visible en ambos
- [ ] T-D6 · Radar comparativo
- [ ] T-D7 · Validación "combinaciones distintas"
- [ ] T-D8 · Panel "Ver todas las métricas"
- [ ] T-D9 · Deep link + precarga desde F-06

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado vacío
- [ ] T-E2 · `sw.js` (si aplica)

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · N/A (sin backend nuevo)
- [ ] T-F3 · Endpoint(s) probados
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA recorridos
- [ ] T-F6..T-F11 · Checks manuales de CA (ver tasks.md)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): N/A — F-09 no toca esquema
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(vacío hasta implementación)

## Docs a actualizar
- [ ] `docs/frontend.md` — módulo Quintetos de Comparar (S6), `renderCompareLineups()`
- [ ] `docs/api.md` — nota de que F-09 consume `GET /api/metrics/lineup` (T-05/F-06) o el legado `GET /api/lineup/<team>?players=...`, sin endpoints propios

## Deuda / TODO
(vacío hasta implementación; ver spec.md §8 para fuera de alcance: más de 2 quintetos, emparejamiento con historial (F-03/F-07), buscador de quintetos (F-10), sugerencias automáticas (F-15))
