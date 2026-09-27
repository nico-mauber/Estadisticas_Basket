# Tasks — F-11: Panel de calidad de datos

> **ID:** F-11 · **Prioridad:** P1 · **Fase y orden:** 1·02
> **Estado:** Completado (versión acotada, ver [progress.md](progress.md) §Alcance)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md) · decisiones en [../../00-decisiones.md](../../00-decisiones.md)

## Grupo A — Esquema
- [x] T-A1 · `competitions`, `competition_aliases`, `game_sources` (modelo + `create_all`) — RF-1, RF-2, RF-10
- [x] T-A2 · `games.competition_id`, `games.ingest_version`, `shots.court_x/court_y` sin DEFAULT (`upgrade_db`) — RF-2, RF-11, RF-14
- [x] T-A3 · Backfill idempotente de `games.competition_id` al arrancar — RF-4

## Grupo B — Ingesta
- [x] T-B1 · `fiba_fetcher`: `fetch_raw`, `fetch_raw_by_id`, `parse_game` (puro); se elimina la rama muerta `raw["shot"]` — RF-10, RF-16
- [x] T-B2 · Coordenadas reales desde `tm[n].shot[]` unidas por `actionNumber` → `court_x/court_y` — RF-11 (DA-32)
- [x] T-B3 · `games.minutes` = 40 + 5 × prórrogas — RF-11
- [x] T-B4 · `ingest.py`: `persist_game` (upsert del partido conservando la competencia + reemplazo de filas hijas), `archive_raw`, `load_archived`, `import_url`, `INGEST_VERSION = 2` — RF-3, RF-10, RF-13, RF-14
- [x] T-B5 · `ingest.reprocess_games` (archivo → FIBA por id; fallidos no cortan el lote) — RF-16, RF-17
- [x] T-B6 · `lineups.PERIOD_LEN` con `OVERTIME` — RF-15
- [x] T-B7 · PACE (y rebote individual) con los minutos reales del partido — RF-11

## Grupo C — Competencias y permisos
- [x] T-C1 · `competitions.py`: split de temporada, alias, alta, edición, fusión, reasignación, listado — RF-1…RF-5, RF-8
- [x] T-C2 · `hidden_game_ids` / `visible` aplicado en todas las rutas de lectura — RF-6
- [x] T-C3 · `auth.admin_required` / `is_admin` (`ADMIN_USERS`), `/api/me.is_admin`, escenarios en `test_auth.py` — RF-29

## Grupo D — Rutas
- [x] T-D1 · `POST /api/import` y `POST /api/seed` vía `ingest`; se elimina `_persist_game` de `app.py`
- [x] T-D2 · `GET /api/games?competition=` con `competition_*`, `has_pbp`, `has_coords`, `needs_reprocess`; `PATCH /api/games/<id>` — RF-5, RF-27
- [x] T-D3 · `GET/POST /api/competitions`, `PATCH /api/competitions/<id>`, `POST /api/competitions/<id>/merge` — RF-5, RF-8
- [x] T-D4 · `GET /api/data-quality`, `POST /api/reprocess` — RF-16…RF-26
- [x] T-D5 · `game_log[].competition_id/competition_label`, `leagues` por id, `/api/league?competition=<id>`, `search.competitions` con etiquetas — RF-9
- [x] T-D6 · `DELETE /api/games` pasa a admin; `game_log` de equipo en orden cronológico

## Grupo E — Frontend
- [x] T-E1 · `api.js`: métodos de Datos; `games`/`league` por id
- [x] T-E2 · Selectores de Liga/Equipo/Comparar/Jugador por id — RF-9
- [x] T-E3 · Pestañas Importar · Calidad de datos · Competencias; catálogo con filtro y badges de estado — RF-19, RF-27
- [x] T-E4 · `_formModal`, `_runReprocess`, `_afterDataChange`, `esc`; acciones de escritura solo para admin — RF-5, RF-16, RF-26, RF-29
- [x] T-E5 · Estilos (`.badge`, `.import-tabs`, `.modal-field`, calidad); `sw.js` → `smart-basket-v11`

## Grupo F — Docs y verificación
- [x] T-F1 · `docs/api.md`, `database.md`, `architecture.md`, `frontend.md`, `deployment.md` (`ADMIN_USERS`, timeout real), `metrics.md` (PACE)
- [x] T-F2 · Verificación (ver progress.md)
