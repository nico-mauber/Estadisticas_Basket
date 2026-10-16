# Progress — A-05: Tramo de reloj de posesión

> **Estado:** ⬜ No iniciado

## Estado de tareas

### Grupo A — Backend: configuración, datos de oportunidad y enriquecedor
- [ ] T-A1 · Activar claves `clock.early_max` / `clock.mid_max`
- [ ] T-A2 · Campos nuevos de `Chance` y de `shots[]`
- [ ] T-A3 · `band_of`
- [ ] T-A4 · `enrich_clock` (oportunidades)
- [ ] T-A5 · Tramo, `clock_start` y quinteto por tiro
- [ ] T-A6 · Registro del enriquecedor
- [ ] T-A7 · Recorte por oportunidad (`clock`/`clock_start`) y predicado

### Grupo B — Backend: fórmulas y agregación
- [ ] T-B1 · `stats_engine.clock_rates`
- [ ] T-B2 · `clock_report` ataque (r24/r14, fichas, badges)
- [ ] T-B3 · Conciliación de tiros
- [ ] T-B4 · Defensa
- [ ] T-B5 · `player_clock` y tabla de jugadores
- [ ] T-B6 · `lineup_clock`
- [ ] T-B7 · `decision_panel`
- [ ] T-B8 · `shot_zones` (nivel posesión, `zone_table_from_shots`)
- [ ] T-B9 · `clock_matrix`
- [ ] T-B10 · Manejo de nulos

### Grupo C — Backend: registros T-05/T-03/T-06 y ruta
- [ ] T-C1 · `clock_bundles` + `register_entity`
- [ ] T-C2 · `register_dimension("clock"/"clock_start")`
- [ ] T-C3 · `table_rows`/`matrix_rows` + `register_table`
- [ ] T-C4 · `GET /api/possession-clock`
- [ ] T-C5 · Errores 400/404

### Grupo D — Frontend
- [ ] T-D1 · `api.possessionClock`
- [ ] T-D2 · `clock-panel.js` (tramos, decisión, jugadores)
- [ ] T-D3 · Matriz zona × tramo y exportación
- [ ] T-D4 · Montaje en Equipo (Posesión, Quintetos) y Jugador
- [ ] T-D5 · Estados loading/vacío/error/offline
- [ ] T-D6 · Estilos mobile
- [ ] T-D7 · Bump `sw.js`

### Grupo E — Documentación
- [ ] T-E1 · `docs/api.md`
- [ ] T-E2 · `docs/metrics.md`
- [ ] T-E3 · `docs/frontend.md`
- [ ] T-E4 · `docs/architecture.md`

### Grupo F — Verificación
- [ ] T-F1…T-F26

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
| CA-21 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (no aplica: sin cambios de esquema): —
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(completar durante la implementación)

## Docs a actualizar
- `docs/api.md` — `GET /api/possession-clock`, filtros `clock`/`clock_start` (también en `/api/shot-zones`), tablas `team_clock` y `zone_clock_matrix`, tipo de entidad `clock`.
- `docs/metrics.md` — fuente derivada del reloj de posesión (resolución de 1 s), regla de tramos y reloj de 14, unidad oportunidad, fórmulas por tramo (TS% mixto), tipos de pérdida, limitaciones.
- `docs/frontend.md` — bloque "Tramo de reloj de posesión" (S3/S4/Quintetos), panel de decisión, matriz zona × tramo, copy nuevo.
- `docs/architecture.md` — módulo `backend/possession_clock.py`.

## Deuda / TODO
(completar durante la implementación)
