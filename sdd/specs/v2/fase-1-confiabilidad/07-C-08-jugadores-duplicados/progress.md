# Progress — C-08: Jugadores duplicados en el buscador

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
(copiar checklist de tasks.md con [x] al implementar)

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Modelo `Player`
- [ ] T-A2 · Columna `player_game_stats.player_id`
- [ ] T-A3 · Índice `ix_pgs_player_id`

### Grupo B — Backend: módulo `identity.py`
- [ ] T-B1 · `norm_name`
- [ ] T-B2 · `resolve_identity`
- [ ] T-B3 · `position_group`
- [ ] T-B4 · `resolve_player_id`
- [ ] T-B5 · `canonical_id`
- [ ] T-B6 · `_refresh_display`
- [ ] T-B7 · `assign_game`
- [ ] T-B8 · `backfill_player_ids`
- [ ] T-B9 · `aliases`
- [ ] T-B10 · `name_index`
- [ ] T-B11 · `canonicalize_pbp_games`
- [ ] T-B12 · `player_card`
- [ ] T-B13 · `duplicate_candidates`
- [ ] T-B14 · `merge_players`

### Grupo C — Backend: hooks e integración con F-11
- [ ] T-C1 · `ingest.persist_game` → `assign_game`
- [ ] T-C2 · `upgrade_db()` → `backfill_player_ids`
- [ ] T-C3 · `data_quality` check `possible_duplicates`

### Grupo D — Backend: rutas
- [ ] T-D1 · `_resolve_legacy_player` / `_player_payload`
- [ ] T-D2 · `GET /api/players/<team_code>`
- [ ] T-D3 · `GET /api/player/<int:player_id>`
- [ ] T-D4 · `GET /api/player/<team_code>/<player_name>`
- [ ] T-D5 · `GET /api/search/players`
- [ ] T-D6 · `GET /api/shots/<team_code>/<player_name>`
- [ ] T-D7 · `GET /api/onoff/<team_code>/<player_name>`
- [ ] T-D8 · `GET /api/lineup/<team_code>`
- [ ] T-D9 · `POST /api/identity/merge`

### Grupo E — Frontend: api.js
- [ ] T-E1 · `qs(params)`
- [ ] T-E2 · `api.players`
- [ ] T-E3 · `api.playerById`
- [ ] T-E4 · `api.searchPlayers`
- [ ] T-E5 · `api.mergePlayers`

### Grupo F — Frontend: UI
- [ ] T-F1 · Buscador: filtro de posición por grupo
- [ ] T-F2 · Buscador: selector de competencia por id
- [ ] T-F3 · Buscador: navegación por `player_id`
- [ ] T-F4 · Equipo: `player-select` por `player_id`
- [ ] T-F5 · Jugador: `renderPlayer` por id
- [ ] T-F6 · `identity-merge.js`: tabla de duplicados
- [ ] T-F7 · `identity-merge.js`: modal de fusión
- [ ] T-F8 · CSS `identity-merge`

### Grupo G — Errores, estados vacíos, offline/SW
- [ ] T-G1 · Estados de UI del panel y del modal
- [ ] T-G2 · `sw.js`: asset nuevo + `CACHE`
- [ ] T-G3 · Mensajes 400/403/404/409

### Grupo H — Verificación de feature
- [ ] T-H1 … T-H17

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (incluye `backfill_player_ids`): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(completar al implementar; ver plan.md §10 para las desviaciones ya anticipadas: D-1 a D-6)

## Docs a actualizar
- [ ] `docs/database.md` — tabla `players`, `player_game_stats.player_id`, identidad persistente (reemplaza la nota
  de "identidad al leer" de `dev`)
- [ ] `docs/api.md` — `GET /api/players/<team>` (real: objetos + `player_id`, corrige D-05), `GET /api/player/
  <int:player_id>` (NUEVO), `GET /api/search/players` (+`player_id`, `position_group`, `competition_ids`), `POST
  /api/identity/merge` (NUEVO), resolución por alias en rutas legado (shots, onoff, lineup)
- [ ] `docs/frontend.md` — Buscador (grupos G/F/C), navegación por `player_id`, panel de duplicados y copy nuevo
- [ ] `docs/architecture.md` — módulo `identity.py` en el mapa de capas

## Deuda / TODO
- Dependencia de F-11 (`ingest.persist_game`, `repository.*`, `data_quality.register_check`, `cache.
  bump_data_version`, `auth.admin_required`, columnas de nombre/foto, `GET /api/competitions` con ids): si al
  implementar C-08 esas piezas todavía no están integradas, registrar aquí el bloqueo y la fecha en que se resolvió.
- Verificación de CA-1/2/5/8/10 depende de una copia de la base con un duplicado inyectado a mano (el seed real no
  tiene duplicados de grafía verificados en `dev`, 74 = 74 fichas): documentar el procedimiento de inyección usado.
- `qs()` (Grupo E, T-E1): si F-11 o T-05 ya la crearon en paralelo, C-08 la reutiliza en vez de crearla; anotar cuál
  ocurrió.
