# Progress — F-08: Plantel dentro de Equipo

> **Estado:** ⬜ No iniciado

## Estado de tareas
### Grupo A — Backend: bundles del plantel
- [ ] T-A1 · `team_roster_bundles()`

### Grupo B — Backend: registro T-06
- [ ] T-B1 · `register_table("team_roster", …)`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.table()`

### Grupo D — Frontend: UI
- [ ] T-D1 · Pestaña Plantel con tabla completa
- [ ] T-D2 · Acción "Ver ficha"
- [ ] T-D3 · Acción "Comparar"
- [ ] T-D4 · Retiro/condicional de `_renderUsageRanking`

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado vacío
- [ ] T-E2 · `sw.js` (si aplica)

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · N/A (sin cambio de esquema)
- [ ] T-F3 · Endpoint probado
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA recorridos
- [ ] T-F6..T-F13 · Checks manuales de CA (ver tasks.md)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): N/A — F-08 no toca esquema
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(vacío hasta implementación)

## Docs a actualizar
- [ ] `docs/api.md` — `GET /api/table/team_roster` (nuevo)
- [ ] `docs/frontend.md` — pestaña Plantel de S3, retiro de la tarjeta "Jugadores más influyentes — USO%"
- [ ] `docs/architecture.md` — `team_roster_bundles` (ubicación final del módulo)

## Deuda / TODO
(vacío hasta implementación; ver spec.md §8 para fuera de alcance: ficha de identidad F-16, comparación en sí F-05, cabecera de contexto F-19)
