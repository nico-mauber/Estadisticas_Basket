# Progress — F-07: Analizar partido

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

## Estado de tareas
- [ ] T-A1 · `game.run_min_points` en `CONFIG_SPEC`
- [ ] T-A2 · `game_analysis.py`: `TYPE_GROUPS`, `elapsed_secs`, `period_key`
- [ ] T-B1 · `period_partials`
- [ ] T-B2 · `score_timeline`
- [ ] T-B3 · `game_pbp`
- [ ] T-B4 · `game_shots`
- [ ] T-B5 · `reconcile_game`
- [ ] T-B6 · Tabla `game_players`
- [ ] T-B7 · Tabla `game_lineups`
- [ ] T-B8 · `game_detail`
- [ ] T-B9 · `matchups.game_matchups` (3 niveles)
- [ ] T-B10 · `matchups.team_matchups`
- [ ] T-B11 · Entidad `matchup` + tablas `matchups_*`
- [ ] T-B12 · Rutas `/api/game/<id>`, `/pbp`, `/matchups`, `/shots`
- [ ] T-C1 · Métodos de `api.js`
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
- [ ] T-E2 · `sw.js`
- [ ] T-F1 … T-F23 · Verificación
- [ ] T-G1 (diferido → F-12) · Enlace desde calendario

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ⬜ | |
| CA-2 (CA del cliente) | ⬜ | |
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
- `upgrade_db()` idempotente (si aplica): ⬜ (F-07 no toca esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/game/<game_id>`, `/pbp`, `/matchups`, `/shots`; tablas `game_players`, `game_lineups`, `matchups_*`; entidad `matchup`.
- `docs/frontend.md` — sección S5 · Analizar, componente `components/game-view.js`, `drawScoreTimeline`, copy nuevo.
- `docs/architecture.md` — módulos `game_analysis.py` y `matchups.py`.
- `docs/metrics.md` — racha (parcial), tiempo transcurrido con prórrogas, métricas de coincidencia en cancha.

## Deuda / TODO
