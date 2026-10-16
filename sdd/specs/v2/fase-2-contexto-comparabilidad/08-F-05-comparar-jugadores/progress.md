# Progress — F-05: Comparar jugadores

> **Estado:** ⬜ No iniciado

## Estado de tareas
### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.metrics("player", …)`

### Grupo D — Frontend: UI
- [ ] T-D1 · Pestaña "Jugadores" en Comparar
- [ ] T-D2 · Selectores con desambiguación
- [ ] T-D3 · `renderComparePlayers()`
- [ ] T-D4 · Tabla de métricas enfrentadas
- [ ] T-D5 · Bloque de avanzadas
- [ ] T-D6 · Radar normalizado por percentil
- [ ] T-D7 · Validación "jugadores distintos"
- [ ] T-D8 · Deep link + precarga desde Plantel

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
- `upgrade_db()` idempotente (si aplica): N/A — F-05 no toca esquema
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(vacío hasta implementación)

## Docs a actualizar
- [ ] `docs/frontend.md` — módulo Jugadores de Comparar (S6), `renderComparePlayers()`, `drawComparePlayerRadar`
- [ ] `docs/api.md` — nota de que F-05 consume `GET /api/metrics/player` (T-05) o el legado `GET /api/player/<team>/<name>`, sin endpoints propios

## Deuda / TODO
(vacío hasta implementación; ver spec.md §8 para fuera de alcance: comparación de más de 2 jugadores, quintetos (F-09), ficha de identidad completa (F-16), filtros de contexto independientes por lado)
