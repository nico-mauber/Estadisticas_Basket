# Progress — T-03: Selector global de contexto (splits)

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · Clave `context.close_margin` en `CONFIG_SPEC`
- [ ] T-B1 · Extender `Context`
- [ ] T-B2 · `parse_context` con validación de los 11 campos
- [ ] T-B3 · `backend/rest.py` (`days_rest`)
- [ ] T-B4 · `filter_games` (venue, opponent, rest, last)
- [ ] T-B5 · `_event_states` (margen, cuarto, on_court)
- [ ] T-B6 · `event_predicate`
- [ ] T-B7 · `possession_predicate` (stub)
- [ ] T-B8 · `level` / `population_mode`
- [ ] T-B9 · `context_echo`
- [ ] T-B10 · `register_dimension` / `available_dimensions`
- [ ] T-B11 · `GET /api/context/options`
- [ ] T-B12 · Migrar handlers Ctx existentes
- [ ] T-B13 · Handlers sin nivel evento (lineup/onoff/clutch) informan `ignored`
- [ ] T-B14 · Tipo de entidad `split` en `metrics_catalog`
- [ ] T-B15 · `population()`/`ficha()` con contexto completo
- [ ] T-B16 · `sample_level` para `split`
- [ ] T-B17 · Resolución con `ui.last_competition`
- [ ] T-C1 · `api.contextOptions`
- [ ] T-C2 · Métodos existentes con `contextToQuery`
- [ ] T-D1 · `core/context.js`
- [ ] T-D2 · `components/context-bar.js`
- [ ] T-D3 · Montaje en Equipo/Jugador
- [ ] T-D4 · Montaje en Liga/Comparar/Explorar
- [ ] T-D5 · CSS barra de contexto
- [ ] T-D6 · Copy con `t()`
- [ ] T-E1 · Selección sin partidos
- [ ] T-E2 · Aviso de partidos excluidos
- [ ] T-E3 · Toast de filtro inválido
- [ ] T-E4 · `sw.js`
- [ ] T-F1 … T-F22 · Verificación
- [ ] T-G1 … T-G3 · (diferido)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ⬜ | |
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
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A: sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/context/options`; parámetros de contexto en cada endpoint "Ctx" tocado; eco `context` completo (§7.5).
- `docs/frontend.md` — barra de contexto (`core/context.js`, `components/context-bar.js`), copy nuevo.
- `docs/metrics.md` — nota sobre "split de contexto" como entidad del catálogo estándar.

## Deuda / TODO
