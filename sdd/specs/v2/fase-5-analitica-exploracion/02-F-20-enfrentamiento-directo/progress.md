# Progress — F-20: Enfrentamiento directo dentro de Equipo

> Estado: ⬜ No iniciado

## Estado de tareas
(copiar checklist de tasks.md con [x] al implementar)

### Grupo A — Backend: `rival_comparison.py`
- [ ] T-A1 · `compare` (agregación y `compute_standard`)
- [ ] T-A2 · `deltas` y `top_deltas`
- [ ] T-A3 · Bloque `sample`

### Grupo B — Backend: ruta
- [ ] T-B1 · `GET /api/rival-comparison`
- [ ] T-B2 · Validaciones 400/404

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.rivalComparison(params)`

### Grupo D — Frontend: UI
- [ ] T-D1 · Habilitar pestaña `enfrentamiento`
- [ ] T-D2 · Selector de rival
- [ ] T-D3 · Lectura de `?rival=` preseleccionado
- [ ] T-D4 · Bloque Historial
- [ ] T-D5 · Bloque Comparación de promedios
- [ ] T-D6 · Bloque Diferencias más marcadas
- [ ] T-D7 · Enlaces a F-03 y emparejamientos

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados vacíos por bloque
- [ ] T-E2 · `sw.js` STATIC (si aplica)

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `upgrade_db()` (N/A)
- [ ] T-F3 · Endpoint probado con curl
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA recorridos manualmente

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A, sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

(completar al implementar)

## Docs a actualizar
- [ ] `docs/api.md` — endpoint `GET /api/rival-comparison`
- [ ] `docs/architecture.md` — módulo `backend/rival_comparison.py`
- [ ] `docs/frontend.md` — pestaña Enfrentamiento en Equipo, `api.rivalComparison()`

## Deuda / TODO
- [NEEDS CLARIFICATION] (spec §9): si "promedios generales" debe excluir los partidos contra el propio rival del cálculo.
- [NEEDS CLARIFICATION] (spec §9): umbral mínimo de partidos contra un rival para la comparación de promedios (se usó `sample.team.min` = 3 por defecto).
