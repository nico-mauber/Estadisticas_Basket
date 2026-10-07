# Progress — A-03: Transición y contraataque

> **Estado:** ⬜ No iniciado

## Estado de tareas

### Grupo A — Backend: configuración, datos de posesión y enriquecedor
- [ ] T-A1 · Activar claves `transition.max_secs` / `early_offense.max_secs`
- [ ] T-A2 · Campos nuevos de `Possession` y `include_incomplete`
- [ ] T-A3 · `enrich_ptype` (tipo por primer evento de decisión)
- [ ] T-A4 · `finish_kind`
- [ ] T-A5 · `end_player_id` y `starter_id`
- [ ] T-A6 · Registro del enriquecedor

### Grupo B — Backend: fórmulas y agregación
- [ ] T-B1 · `stats_engine.ptype_rates`
- [ ] T-B2 · `transition_report` ataque (tipos, diff, primer tiro, fichas)
- [ ] T-B3 · Origen del contraataque
- [ ] T-B4 · Finalización en transición
- [ ] T-B5 · % RD → transición
- [ ] T-B6 · Corredores y primer pase de salida
- [ ] T-B7 · Bloque defensivo (por 100 y origen concedido)
- [ ] T-B8 · Pérdidas propias convertidas y balance defensivo
- [ ] T-B9 · `player_transition`
- [ ] T-B10 · `reconcile_fastbreak`
- [ ] T-B11 · Manejo de nulos

### Grupo C — Backend: registros T-05/T-03/T-06 y ruta
- [ ] T-C1 · `ptype_bundles` + `register_entity`
- [ ] T-C2 · `register_dimension("ptype")` y predicado
- [ ] T-C3 · `table_rows` + `register_table("team_ptypes")`
- [ ] T-C4 · `GET /api/transition`
- [ ] T-C5 · Errores 400/404

### Grupo D — Frontend
- [ ] T-D1 · `api.transition`
- [ ] T-D2 · `transition-panel.js`
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
- [ ] T-F1…T-F28

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente, reparto 100 %) | ⬜ | |
| CA-2 (CA del cliente, estabilidad) | ⬜ | |
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
| CA-22 | ⬜ | |
| CA-23 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (no aplica: sin cambios de esquema): —
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(completar durante la implementación)

## Docs a actualizar
- `docs/api.md` — `GET /api/transition`, tabla `team_ptypes`, tipo de entidad `ptype`, filtro de contexto `ptype`.
- `docs/metrics.md` — tres tipos y cortes configurables, primer evento de decisión, reloj derivado (resolución de 1 s), métricas ofensivas y defensivas de transición, primer pase de salida no registrado.
- `docs/frontend.md` — bloque "Transición y contraataque" de la pestaña Posesión (S3/S4), copy nuevo.
- `docs/architecture.md` — módulo `backend/transition.py`.

## Deuda / TODO
(completar durante la implementación)
