# Progress — F-17: Plan de juego

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · activar `gameplan.*` en `config.py`
- [ ] T-A2 · `rules.json`
- [ ] T-A3 · `es.json` (30 plantillas)
- [ ] T-B1 · `phrases.py` base y validación
- [ ] T-B2 · `pick_template`, `format_value`, `render`
- [ ] T-B3 · `game_plan` núcleo (competencia)
- [ ] T-B4 · referencia rival
- [ ] T-B5 · referencia período anterior
- [ ] T-B6 · modo `matchup`
- [ ] T-B7 · payload, eco de contexto y caché
- [ ] T-B8 · ruta `GET /api/game-plan`
- [ ] T-C1 · `api.gamePlan`
- [ ] T-D1 · `renderPlanItem` / `fmtPlanDelta`
- [ ] T-D2 · `renderGamePlan`
- [ ] T-D3 · montaje en Equipo › Resumen
- [ ] T-D4 · CSS
- [ ] T-E1 · errores y offline
- [ ] T-E2 · `sw.js`
- [ ] T-F1 … T-F19 · verificación
- [ ] T-G1 … T-G3 · incrementos diferidos (→ F-12, → F-03)

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
| CA-9 | ⬜ | |
| CA-10 | ⬜ | |
| CA-11 | ⬜ | |
| CA-12 | ⬜ | |
| CA-13 | ⬜ | |
| CA-14 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (no aplica: sin esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/game-plan` (parámetros, shape, errores).
- `docs/frontend.md` — componente `game-plan.js`, panel en Equipo › Resumen, copy nuevo y motivos.
- `docs/architecture.md` — módulo `backend/phrases.py` y directorio `backend/phrases/` (`es.json`, `rules.json`).
- `docs/metrics.md` — "Plan de juego": puntaje `z`, desvío poblacional, referencias, familias.

## Deuda / TODO
