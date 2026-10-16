# Progress — F-16: Ficha de identidad del jugador

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · 6 columnas nuevas en `players` (`upgrade_db()`)
- [ ] T-B1 · `position_group`
- [ ] T-B2 · `_player_competitions`
- [ ] T-B3 · `player_profile`
- [ ] T-B4 · `_validate_profile_fields`
- [ ] T-B5 · `update_player_profile`
- [ ] T-B6 · `GET /api/player-profile/<id>`
- [ ] T-B7 · `PUT /api/player-profile/<id>`
- [ ] T-B8 · Verificación: sin datos manuales en exportación masiva
- [ ] T-C1 · `api.playerProfile`
- [ ] T-C2 · `api.savePlayerProfile`
- [ ] T-D1 · `components/player-header.js`
- [ ] T-D2 · Montaje de la cabecera en S4
- [ ] T-D3 · Pestaña `ficha`
- [ ] T-D4 · Formulario de edición (admin)
- [ ] T-D5 · CSS cabecera/ficha
- [ ] T-D6 · Copy con `t()`
- [ ] T-E1 · Estado 404
- [ ] T-E2 · Estado offline
- [ ] T-E3 · Estado sin permiso
- [ ] T-E4 · `sw.js`
- [ ] T-F1 … T-F15 · Verificación

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/database.md` — 6 columnas nuevas de `players` (F-16).
- `docs/api.md` — `GET`/`PUT /api/player-profile/<int:player_id>`.
- `docs/frontend.md` — cabecera de identidad, pestaña Ficha, copy nuevo.

## Deuda / TODO
