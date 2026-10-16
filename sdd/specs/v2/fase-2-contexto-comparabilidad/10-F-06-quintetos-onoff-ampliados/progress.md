# Progress — F-06: Combinaciones y ON/OFF ampliados

> **Estado:** ⬜ No iniciado

## Estado de tareas
### Grupo A — Backend: `lineups.py` sobre `StatBundle`/T-05
- [ ] T-A1 · `all_lineups()`
- [ ] T-A2 · combinaciones de 3–4 jugadores
- [ ] T-A3 · migrar `onoff_stats` a `StatBundle`
- [ ] T-A4 · `player_on_court()`

### Grupo B — Backend: cierres por quinteto y líderes
- [ ] T-B1 · `lineup_clutch()`
- [ ] T-B2 · `lineup_leaders.py` / `leaders_report()`

### Grupo C — Backend: registro T-05/T-06 y rutas
- [ ] T-C1 · `register_entity("lineup"/"onoff", …)`
- [ ] T-C2 · `register_table("team_lineups", …)`
- [ ] T-C3 · `register_table("team_onoff", …)`
- [ ] T-C4 · `register_table("team_lineup_clutch", …)`
- [ ] T-C5 · `GET /api/lineup-leaders/<team_code>`
- [ ] T-C6 · Endpoints legado sin cambio de shape

### Grupo D — Frontend: api.js
- [ ] T-D1 · `api.metrics`/`api.table`/`api.ranking`
- [ ] T-D2 · `api.lineupLeaders`

### Grupo E — Frontend: UI
- [ ] T-E1 · `lineup-leader-card.js`
- [ ] T-E2 · Tabla de todos los quintetos
- [ ] T-E3 · Selector de combinación (bloques Ataque/Defensa/Avanzado)
- [ ] T-E4 · Tabla ON/OFF del plantel
- [ ] T-E5 · Tabla de cierres por quinteto
- [ ] T-E6 · Pestaña `quintetos` en el router + deep link

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · N/A (sin cambio de esquema)
- [ ] T-F3 · Endpoints probados con curl/test_client
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA recorridos
- [ ] T-F6..T-F16 · Checks manuales de CA (ver tasks.md)

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): N/A — F-06 no toca esquema
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(vacío hasta implementación)

## Docs a actualizar
- [ ] `docs/api.md` — `GET/POST` endpoints nuevos (`/api/table/team_lineups`, `/api/table/team_onoff`, `/api/table/team_lineup_clutch`, `/api/lineup-leaders/<team_code>`, `/api/metrics/lineup`, `/api/metrics/onoff`) y confirmación de que los legado (`/api/lineup`, `/api/onoff`) no cambiaron de shape
- [ ] `docs/architecture.md` — `lineups.py` extendido, `lineup_leaders.py` nuevo
- [ ] `docs/frontend.md` — pestaña Quintetos de S3 (tarjetas de líderes, tabla completa, selector de combinación, ON/OFF del plantel, cierres por quinteto), componente `lineup-leader-card.js`
- [ ] `docs/metrics.md` — fórmulas del tramo de cierre por quinteto y del récord V-D si difieren de lo ya documentado en C-06/T-05

## Deuda / TODO
(vacío hasta implementación; ver spec.md §8 para incrementos diferidos: F-09 comparación de quintetos, A-08 parejas, F-07/F-03 emparejamientos rivales, F-10 buscador, F-15 sugerencias IA, A-01 posesiones reconstruidas en cierres)
