# Progress — F-07: Analizar partido

> **Estado:** 🔶 En progreso (backend completo, frontend pendiente)
> **Fecha:** 2026-10-14
> Reglas: `sdd/04-implement.md`. Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

## Estado de tareas
- [x] T-A1 · `game.run_min_points` en `CONFIG_SPEC`
- [x] T-A2 · `game_analysis.py`: `TYPE_GROUPS`, `elapsed_secs`, `period_key`
- [x] T-B1 · `period_partials` (pbp fallback; oficial no disponible sin F-11 v2)
- [x] T-B2 · `score_timeline` (puntos, tiempos muertos, rachas, liderazgo, empates, máxima ventaja)
- [x] T-B3 · `game_pbp` con filtros jugador/tipo/período
- [x] T-B4 · `game_shots` (zonas, bandas desde A-01, filtros)
- [x] T-B5 · `reconcile_game` (score_final, players_sum, period_sum, timeline_final)
- [x] T-B6 · `_game_player_bundles` (StatBundle por jugador, DNP, base T-04)
- [x] T-B7 · `_game_lineup_bundles` (quintetos con badge)
- [x] T-B8 · `game_detail` (ensamblador + `cache.memo("game", ...)`)
- [x] T-B9 · `matchups.game_matchups` (3 niveles: quinteto, jugador, jugador_quinteto)
- [x] T-B10 · `matchups.team_matchups` (placeholder para F-03)
- [x] T-B11 · Entidad `matchup` registrada en `metrics_catalog`
- [x] T-B12 · Rutas `/api/game/<id>`, `/pbp`, `/matchups`, `/shots`
- [x] T-C1 · Métodos de `api.js`: `game`, `gamePbp`, `gameMatchups`, `gameShots`
- [ ] T-D1 · `drawScoreTimeline`
- [ ] T-D2 · Esqueleto `renderGameView`
- [ ] T-D3 · Bloque Resumen
- [ ] T-D4 · Bloque Box
- [ ] T-D5 · `shotChart` `colorBy: "none"` / `onZoneClick`
- [ ] T-D6 · Bloque Tiros
- [ ] T-D7 · Bloque Jugadas
- [ ] T-D8 · Bloques Quintetos y Cruces
- [ ] T-D9 · Exportación e informe de scouting
- [ ] T-D10 · Pestaña `analizar` + habilitar S5
- [ ] T-D11 · Enlaces desde catálogo y game logs
- [ ] T-D12 · Estilos y responsive
- [ ] T-E1 · Estados de bloques
- [x] T-E2 · `sw.js` v25 → v26
- [ ] T-F1 … T-F23 · Verificación
- [ ] T-G1 (diferido → F-12) · Enlace desde calendario

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | 🔶 parcial | `score_final=True`, `period_sum=True`, `timeline_final=True` en 13/13 partidos. `players_sum` falla en 13/13 por rebotes/pérdidas de equipo (esperado: `team_orb/drb/tov` no disponibles sin ingest v2) |
| CA-2 (CA del cliente) | ⬜ | pendiente frontend |
| CA-3 | ⬜ | pendiente frontend |
| CA-4 | ⬜ | pendiente frontend |
| CA-5 | 🔶 | backend: `pbp?type=tiro&period=3` filtra correctamente; falta UI |
| CA-6 | 🔶 | backend: `shots?quarter=2` filtra; bandas sin dato (A-05 pendiente) |
| CA-7 | 🔶 | backend: `shots` sin filtros Σ zones[].attempts = fga del equipo; falta UI |
| CA-8 | 🔶 | backend: matchups quinteto con badge y Σ posesiones; falta UI |
| CA-9 | ⬜ | pendiente métricas de entidad |
| CA-10 | ⬜ | pendiente frontend |
| CA-11 | ⬜ | pendiente frontend |
| CA-12 | ⬜ | pendiente frontend |
| CA-13 | ⬜ | pendiente frontend |
| CA-14 | ⬜ | pendiente frontend |
| CA-15 | ✅ | `GET /api/game/NOEXISTE` → 404 `no_encontrado`; `/pbp?type=xyz` → 400 `parametro_invalido` |
| CA-16 | ⬜ | pendiente frontend |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅ (F-07 no toca esquema)
- Endpoints probados (test_client): ✅ game 200, pbp 200 (593 total, 36 filtered), matchups quinteto 200 (36 rows), matchups jugador 200 (100 rows), shots 200, error cases 404/400
- Consola del navegador sin errores JS: pendiente (verificación manual)

## Desviaciones respecto a docs/ o plan
- **Parciales solo desde pbp:** `period_pts` (fuente oficial) no disponible sin F-11 ingest v2. Se usa el fallback pbp en todos los partidos.
- **`players_sum` falla en todos los partidos:** FIBA reporta rebotes y pérdidas de equipo que no suman en jugadores individuales. Las columnas `team_orb`, `team_drb`, `team_tov` no existen aún (F-11).
- **Bandas de tiro (A-05):** `no_band = N` (todos) porque A-05 no implementó el campo `band` en posesiones.
- **`team_matchups` placeholder:** F-03 lo consume; implementación completa diferida.
- **`load_matchup_bundles` placeholder:** para `/api/metrics/matchup`, implementación completa diferida.
- **Sin tablas T-06:** `game_players`, `game_lineups`, `matchups_*` no registradas en `tables.register_table` — se usa formato directo del game_detail. Tablas formales para T-06 diferidas al frontend.
- **Sin router X-01:** frontend monolítico en app.js, sin views/ ni tabs.js.
- **`shot_zones.py` existe:** investigador reportó ausencia, pero existe y funciona.

## Métricas de rendimiento
- pendiente

## Docs actualizados
- ✅ `docs/api.md` — 4 endpoints F-07 documentados
- ✅ `docs/architecture.md` — `game_analysis.py` y `matchups.py` descritos

## Deuda / TODO
- T-D1..T-D12: Frontend completo (componente game-view.js, pestaña analizar)
- T-E1: Estados vacío/error/offline de cada bloque
- T-F1..T-F23: Verificación completa
- Tablas T-06 formales (register_table)
- load_matchup_bundles completo
- team_matchups completo (F-03)
- Parciales desde period_pts (F-11)
- Bandas de tiro (A-05)
