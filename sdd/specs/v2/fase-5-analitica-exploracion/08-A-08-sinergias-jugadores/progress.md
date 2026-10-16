# Progress — A-08: Sinergias entre jugadores

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md). Spec: [spec.md](spec.md). Plan: [plan.md](plan.md).

## Estado de tareas
### Grupo A — Backend: piezas de soporte
- [ ] T-A1 · `lineups.all_lineups(size=2)`
- [ ] T-A2 · `lineups.pair_states`
- [ ] T-A3 · `context.filter_events`
- [ ] T-A4 · `chains.assist_pairs_from_events` (A-07)
- [ ] T-A5 [P] · `stats_engine.assist_link_rates`
### Grupo B — Backend: análisis, loader, tabla y ruta
- [ ] T-B1 · `assist_matrix`
- [ ] T-B2 · Triples generados y puntos tras asistencia
- [ ] T-B3 · `reconcile_assists` y check `assist_link`
- [ ] T-B4 · `pair_table` y loader `pair`
- [ ] T-B5 · `teammate_impact`
- [ ] T-B6 · `synergy_report` y `GET /api/synergy/<team_code>`
- [ ] T-B7 · Tabla `pairs`
### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.synergy`
### Grupo D — Frontend: UI
- [ ] T-D1 · `components/synergy-panel.js`
- [ ] T-D2 · Sección Sinergias en S3 Quintetos
- [ ] T-D3 · Bloque de sinergias en S4 Impacto
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
- [ ] T-F6 … T-F22 · Verificación de CA-1…CA-17

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (A-08 no toca esquema): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/api.md` — `GET /api/synergy/<team_code>` (+ `player`, `top`), tabla `pairs`, tipo `pair`
- [ ] `docs/metrics.md` — matriz de asistencias y su cuadre, impacto sobre compañeros (con y sin), ajuste de parejas
- [ ] `docs/frontend.md` — sección Sinergias (S3 Quintetos) y bloque de Impacto (S4), `synergy-panel.js`, copy nuevo (para extracción en F-21)
- [ ] `docs/architecture.md` — módulo `synergy.py`

## Deuda / TODO
