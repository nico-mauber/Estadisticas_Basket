# Progress — F-15: Sugerencias de quinteto asistidas por IA

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`.

## Estado de tareas
### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Sin cambios de esquema (confirmación)
- [ ] T-A2 · Claves `ai.*` en `CONFIG_SPEC`
- [ ] T-A3 · `anthropic` en `requirements.txt`

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Disponibilidad (`llm_available`, `suggestions_enabled`)
- [ ] T-B2 · `format_value`
- [ ] T-B3 · `validate_numbers`
- [ ] T-B4 · `build_summary` y elegibles
- [ ] T-B5 · Selección: anotar, defender, reboteear, frenar ritmo
- [ ] T-B6 · Selección: cerrar, lectura de cierres
- [ ] T-B7 · Selección: contra un rival
- [ ] T-B8 · Selección: infrautilizados, a evitar
- [ ] T-B9 · Selección: cambio de una pieza
- [ ] T-B10 · `_call_model`
- [ ] T-B11 · `_process` (validación y descarte)
- [ ] T-B12 · `lineup_suggestions` (caché, límites)
- [ ] T-B13 · Ruta y `llm_enabled` en `/api/me`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.aiLineupSuggestions`

### Grupo D — Frontend: UI
- [ ] T-D1 · Montaje condicionado por `llm_enabled`
- [ ] T-D2 · Panel, límites y controles
- [ ] T-D3 · Generación, tarjetas y soporte
- [ ] T-D4 · Vacíos, errores y regenerar
- [ ] T-D5 · Estilos y mobile

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Offline
- [ ] T-E2 · `sw.js`
- [ ] T-E3 · `render.yaml` y `docs/deployment.md`

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · Esquema sin cambios
- [ ] T-F3 · Endpoints con servicio simulado
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA-1 … CA-19
- [ ] T-F6 … T-F18 · Verificación por CA
- [ ] T-F19 · Registro de modelo, duración, tokens y costo

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` / `create_all` idempotente (sin cambios de esquema): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `POST /api/ai/lineup-suggestions`; `llm_enabled` en `/api/me`.
- `docs/deployment.md` — variables `LLM_ENABLED`, `ANTHROPIC_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_SECS`, `LLM_MAX_RETRIES`, `LLM_EFFORT`; hilos de gunicorn (DA-28).
- `docs/frontend.md` — panel de sugerencias, copy nuevo, formateador numérico de backend.
- `docs/architecture.md` — módulo `llm.py`, dependencia opcional `anthropic`, claves `ai.*`.
- `docs/metrics.md` — nota: el resumen y las cifras de IA usan los mismos valores y formato que la tabla de quintetos.

## Deuda / TODO
