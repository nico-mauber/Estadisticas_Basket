# Progress — A-10: Insights automáticos en texto

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · activar `insights.*` en `config.py`
- [ ] T-A2 · sección `insights` en `rules.json`
- [ ] T-A3 · 8 plantillas nuevas en `es.json`
- [ ] T-B1 · validación ampliada de plantillas
- [ ] T-B2 · `score_candidates` público
- [ ] T-B3 · `insights.py` (`insights_payload`, coherencia)
- [ ] T-B4 · `sudden_changes`
- [ ] T-B5 · caché y eco de contexto
- [ ] T-B6 · ruta `GET /api/insights`
- [ ] T-C1 · `api.insights`
- [ ] T-D1 · `renderInsights`
- [ ] T-D2 · bloque en Equipo › Resumen
- [ ] T-D3 · bloque en Jugador › Resumen
- [ ] T-D4 · CSS
- [ ] T-E1 · errores y offline
- [ ] T-E2 · `sw.js`
- [ ] T-F1 … T-F19 · verificación

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
| CA-15 | ⬜ | |
| CA-16 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (no aplica: sin esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/insights` (parámetros, shape, errores).
- `docs/frontend.md` — componente `insights-panel.js`, bloque Insights en Equipo y Jugador › Resumen, copy nuevo y motivos.
- `docs/architecture.md` — módulo `backend/insights.py`; ampliaciones de `phrases.py`, `es.json` y `rules.json`.
- `docs/metrics.md` — "Insights automáticos": regla de disparo (percentil ≤ 10 / ≥ 90), familias, redacción de "menos es mejor", definición de cambio brusco.

## Deuda / TODO
