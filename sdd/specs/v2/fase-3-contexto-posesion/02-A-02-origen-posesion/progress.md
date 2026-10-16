# Progress — A-02: Origen de la posesión

> **Estado:** ⬜ No iniciado

## Estado de tareas
(copiar checklist de tasks.md con [x] a medida que se completen)

### Grupo A — Backend: enriquecedor y módulo de agregación
- [ ] T-A1 · `enrich_origin` con precedencia
- [ ] T-A2 · Registro del enriquecedor
- [ ] T-A3 · Fallback de robo sin `previous_action`
- [ ] T-A4 · `oreb_info` (fila informativa)
- [ ] T-A5 · `stats_engine.origin_rates`
- [ ] T-A6 · `origin_report`
- [ ] T-A7 · `side="defensa"`
- [ ] T-A8 · Conciliación de suma
- [ ] T-A9 · `player_origin`
- [ ] T-A10 · Manejo de nulos

### Grupo B — Backend: registro T-05/T-03/T-06
- [ ] T-B1 · `origin_bundles` + `register_entity`
- [ ] T-B2 · `register_dimension("origin", …)`
- [ ] T-B3 · `table_rows` + `register_table`

### Grupo C — Backend: ruta
- [ ] T-C1 · `GET /api/origins`
- [ ] T-C2 · Errores 400/404

### Grupo D — Frontend
- [ ] T-D1 · `api.origins`
- [ ] T-D2 · `origin-panel.js`
- [ ] T-D3 · Montaje en Equipo/Jugador
- [ ] T-D4 · Estados loading/vacío/error/offline
- [ ] T-D5 · Estilos mobile
- [ ] T-D6 · Bump `sw.js`

### Grupo E — Documentación
- [ ] T-E1 · `docs/api.md`
- [ ] T-E2 · `docs/metrics.md`
- [ ] T-E3 · `docs/frontend.md`
- [ ] T-E4 · `docs/architecture.md`

### Grupo F — Verificación
- [ ] T-F1…T-F17

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (no aplica: sin cambios de esquema): —
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(completar durante la implementación)

## Docs a actualizar
- `docs/api.md` — `GET /api/origins`, tabla `team_origins`, tipo de entidad `origin`, filtro de contexto `origin`.
- `docs/metrics.md` — definición de los 8 orígenes, precedencia, fórmulas (PPP/eFG%/TO%/FT Rate/duración media),
  fallback de robo sin vínculo, `saque_banda` como default conservador.
- `docs/frontend.md` — bloque "Origen de la posesión" de la pestaña Posesión (S3/S4), copy nuevo.
- `docs/architecture.md` — módulo `backend/origin.py`.

## Deuda / TODO
(completar durante la implementación)
