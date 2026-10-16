# Progress — A-12: Métricas de jugador pendientes

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · Columna `pbp_events.previous_action` y `upgrade_db()`
- [ ] T-A2 · Parser: leer `previousAction` del pbp
- [ ] T-A3 · `pbp_cols` e `INGEST_VERSION`
- [ ] T-A4 · Panel de calidad: campo `previous_action`
- [ ] T-A5 · Reprocesar los partidos existentes desde el archivo
- [ ] T-B1 · `assists.game_assist_links`
- [ ] T-B2 · `competition_assist_links` y `player_assist_links`
- [ ] T-B3 · `StatBundle.ast_links` y fórmulas en `compute_standard`
- [ ] T-B4 · Catálogo: 4 claves nuevas y loader `player`
- [ ] T-B5 · `apply_base` para `ast_points`
- [ ] T-C1 · Verificar `api.metrics` (sin métodos nuevos)
- [ ] T-D1 · Etiquetas de razón `sin_pbp` y `requiere_posesiones`
- [ ] T-D2 · `components/assist-card.js`
- [ ] T-D3 · Estilos de la card
- [ ] T-D4 · Montar la card en S4 → Distribución
- [ ] T-E1 · Errores y estados vacíos de la card
- [ ] T-E2 · Service worker (si corresponde)
- [ ] T-F1 … T-F19 · Verificación de feature (checks obligatorios y un check por CA)
- [ ] T-G1 · (diferido → A-01) `player_poss_duration` con duraciones de posesión
- [ ] T-G2 · (diferido → A-07, A-08) Reutilizar el vínculo asistencia→canasta

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
- `upgrade_db()` idempotente (si aplica): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/database.md` — columna `pbp_events.previous_action` y versión de ingesta
- `docs/metrics.md` — `ast_team_share`, `ast_points`, `pts_per_ast`, `player_poss_duration` (diferido); diferencia con `as_pos` y `as_pct`; regla de asistencias ligadas a tiros libres
- `docs/api.md` — claves nuevas en `metrics` de `GET /api/metrics/player`, campos `detail` y `coverage`
- `docs/frontend.md` — card "Creación de juego", copy nuevo
- `docs/architecture.md` — módulo `assists.py`

## Deuda / TODO
