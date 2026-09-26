# Progress — F-19: Filtros rápidos y cabecera de contexto

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-B1 · `context_summary` ramas team y competition
- [ ] T-B2 · rama player
- [ ] T-B3 · caché y nulos con razón
- [ ] T-B4 · ruta `GET /api/context/summary`
- [ ] T-C1 · `api.contextSummary`
- [ ] T-D1 · chips período/sede/rival
- [ ] T-D2 · panel "Más filtros"
- [ ] T-D3 · "Limpiar filtros"
- [ ] T-D4 · `renderContextHeader`
- [ ] T-D5 · aviso "Quedan N de M partidos"
- [ ] T-D6 · `mountContextDock`
- [ ] T-D7 · estilos sticky y móvil
- [ ] T-D8 · dock en S3 y retiro de pills
- [ ] T-D9 · dock en S4
- [ ] T-D10 · dock en S2 y S7
- [ ] T-D11 · S6 Comparar equipos
- [ ] T-E1 · errores y offline
- [ ] T-E2 · `sw.js`
- [ ] T-F1 … T-F15 · verificación

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (no aplica: sin esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/context/summary`.
- `docs/frontend.md` — componentes `quick-filters.js`, `context-header.js`, `ctx-dock.js`; retiro de las pills "Últ. N" de Equipo; copy nuevo.
- `docs/architecture.md` — módulo `backend/context_summary.py`.

## Deuda / TODO
