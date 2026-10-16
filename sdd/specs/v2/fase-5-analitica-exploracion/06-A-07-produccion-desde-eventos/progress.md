# Progress — A-07: Producción desde eventos

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md). Spec: [spec.md](spec.md). Plan: [plan.md](plan.md).

## Estado de tareas
### Grupo A — Backend: posesiones y enriquecedor
- [ ] T-A1 · Campos `steal_event`, `steal_by_id`, `dreb_event`, `dreb_by_id` en `Possession`
- [ ] T-A2 · `team_possessions(include_incomplete=…)`
- [ ] T-A3 · `enrich_chains` (vínculo FIBA + respaldo)
- [ ] T-A4 [P] · `stats_engine.chain_rates`
- [ ] T-A5 [P] · 9 `MetricDef` y tipos `chain`/`chain_player`
### Grupo B — Backend: análisis, loader, tabla y ruta
- [ ] T-B1 · `_finish_kind` y `_outcome_after`
- [ ] T-B2 · `assist_pairs_from_events`
- [ ] T-B3 · `_assist_block`
- [ ] T-B4 · `_oreb_block` (coherente con A-04)
- [ ] T-B5 · `_dreb_block`
- [ ] T-B6 · `_steal_block`
- [ ] T-B7 · `_turnover_block` y `_next_poss`
- [ ] T-B8 · `events_report`
- [ ] T-B9 · `reconcile_chains` y check `chains_tov_mismatch`
- [ ] T-B10 · `chain_bundles`, `table_rows`, tabla `events_production`
- [ ] T-B11 · `GET /api/events-production`
### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.eventsProduction`
### Grupo D — Frontend: UI
- [ ] T-D1 · `components/events-panel.js`
- [ ] T-D2 · Pestañas `eventos` de S3/S4 + tabla T-06
- [ ] T-D3 [P] · Estilos
### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados de UI
- [ ] T-E2 · `sw.js` (`STATIC` y `CACHE`)
### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `database.py` idempotente
- [ ] T-F3 · Endpoints probados con curl
- [ ] T-F4 · Consola del navegador sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 … T-F22 · Verificación de CA-1…CA-17
- [ ] T-F23 · Coherencia con A-12

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (propuesto; el cliente no define CA para A-07) | ⬜ | |
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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (A-07 no toca esquema): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/api.md` — `GET /api/events-production`, tabla `events_production`, tipos `chain`/`chain_player`
- [ ] `docs/metrics.md` — consecuencia por evento, partición doble/triple/2+1, "castigada", horizonte de una posesión, fuente derivada
- [ ] `docs/frontend.md` — pestaña Eventos de S3/S4, `events-panel.js`, copy nuevo (para extracción en F-21)
- [ ] `docs/architecture.md` — `chains.py` (análisis completo), campos nuevos de `Possession`

## Deuda / TODO
