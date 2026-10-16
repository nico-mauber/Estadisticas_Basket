# Progress — F-12: Mi equipo

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`.

## Estado de tareas
### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Modelo `Fixture`
- [ ] T-A2 · Claves `alerts.*` y `my_team.*` en `CONFIG_SPEC`
- [ ] T-A3 · Scope `ui` (`home_team`, `followed_players`) en `prefs.py`

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `today_uy`, `FixtureError`, `validate_fixture`
- [ ] T-B2 · CRUD de `fixtures.py`
- [ ] T-B3 · `next_fixture`
- [ ] T-B4 · `link_game_to_fixture` y `unlink_games`
- [ ] T-B5 · Enganche en `persist_game` y `DELETE /api/games`
- [ ] T-B6 · Rutas `/api/fixtures`
- [ ] T-B7 · `rival_proximo` en `phrases.game_plan` y `/api/game-plan`
- [ ] T-B8 · Plantillas de cambios bruscos
- [ ] T-B9 · Fusión de competencias reasigna fixtures
- [ ] T-B10 · `_header`, `alert_window`, `_next_fixture`, `_game_plan`
- [ ] T-B11 · `sudden_changes`
- [ ] T-B12 · `_alerts`
- [ ] T-B13 · `_last_games`, `_top_lineups`, `_followed_players`
- [ ] T-B14 · Bloques aislados y caché
- [ ] T-B15 · Ruta `GET /api/my-team`

### Grupo C — Frontend: api.js
- [ ] T-C1 · Métodos de `api.js`

### Grupo D — Frontend: UI
- [ ] T-D1 · `my-team-controls.js`
- [ ] T-D2 · `views/mi-equipo.js` (selector, cabecera, bloques)
- [ ] T-D3 · Próximo partido
- [ ] T-D4 · Plan de juego plegable
- [ ] T-D5 · Alertas
- [ ] T-D6 · Accesos directos
- [ ] T-D7 · Pestaña Calendario
- [ ] T-D8 · Botones en Equipo y Jugador
- [ ] T-D9 · Sección inicial en el router
- [ ] T-D10 · Estilos y mobile

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados y copy
- [ ] T-E2 · `sw.js`

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `create_all` idempotente
- [ ] T-F3 · Endpoints con curl
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA-1 … CA-22
- [ ] T-F6 … T-F19 · Verificación por CA
- [ ] T-F20 · Tiempo de `GET /api/my-team`

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
| CA-22 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` / `create_all` idempotente: ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/my-team`, `GET/POST/PATCH/DELETE /api/fixtures`, referencia `rival_proximo` en `/api/game-plan`.
- `docs/database.md` — tabla `fixtures`; preferencias `ui.home_team` y `ui.followed_players`.
- `docs/frontend.md` — sección Mi equipo (S8), pestaña Calendario (S1), `my-team-controls.js`, `fixtures-manager.js`, regla de sección inicial, copy nuevo.
- `docs/architecture.md` — módulos `fixtures.py` y `my_team.py`.
- `docs/deployment.md` — nota: el calendario lo escriben los usuarios de `ADMIN_USERS`.

## Deuda / TODO
