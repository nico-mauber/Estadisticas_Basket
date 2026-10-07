# Progress — F-10: Buscador de quintetos y consultas guardadas

> **Estado:** ⬜ No iniciado

## Estado de tareas

### Grupo A — Backend: esquema y consultas guardadas
- [ ] T-A1 · Modelo `SavedQuery` / tabla `saved_queries`
- [ ] T-A2 · `validate_params`
- [ ] T-A3 · `save_query`, `list_queries`, `delete_query`, `is_stale`
- [ ] T-A4 · Rutas `/api/saved-queries`

### Grupo B — Backend: universo y búsqueda de quintetos
- [ ] T-B1 · `SearchSpec` y `parse_search`
- [ ] T-B2 · `universe` (memoizado)
- [ ] T-B3 · `search` (filtros, exclusiones, orden)
- [ ] T-B4 · `describe_filters`
- [ ] T-B5 · `table_rows` y `payload_extras`

### Grupo C — Backend: registro en T-06
- [ ] T-C1 · Extensiones de `register_table` (`payload_extras`, `low_sample_last`)
- [ ] T-C2 · `register_table("lineup_search", …)`
- [ ] T-C3 · Errores 400/404

### Grupo D — Frontend
- [ ] T-D1 · `api.savedQueries` / `saveQuery` / `deleteQuery`
- [ ] T-D2 · `lineup-search.js` (formulario y selectores)
- [ ] T-D3 · Resultado, tabla y exportación
- [ ] T-D4 · Estado ↔ URL
- [ ] T-D5 · `saved-queries.js`
- [ ] T-D6 · Pestañas de S7 y guardado del buscador de jugadores
- [ ] T-D7 · Estados loading/vacío/error/offline
- [ ] T-D8 · Estilos mobile
- [ ] T-D9 · Bump `sw.js`

### Grupo E — Documentación
- [ ] T-E1 · `docs/api.md`
- [ ] T-E2 · `docs/database.md`
- [ ] T-E3 · `docs/frontend.md`
- [ ] T-E4 · `docs/architecture.md`

### Grupo F — Verificación
- [ ] T-F1…T-F25

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
| CA-20 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (tabla nueva por `create_all`; correr `python backend/database.py` dos veces): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(completar durante la implementación)

## Docs a actualizar
- `docs/api.md` — `GET/POST/DELETE /api/saved-queries`, tabla `lineup_search` (parámetros `competition`, `team`, `include`, `exclude`, `min_poss`, `min.*`, `max.*`, `adjusted`, bloque `info`).
- `docs/database.md` — tabla `saved_queries` (columnas, `UNIQUE(owner, name)`).
- `docs/frontend.md` — pestañas Quintetos y Consultas de Explorar, botón "Guardar búsqueda" del buscador de jugadores, copy nuevo.
- `docs/architecture.md` — módulos `backend/lineup_search.py` y `backend/saved_queries.py`.

## Deuda / TODO
(completar durante la implementación)
