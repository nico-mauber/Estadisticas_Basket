# Progress — A-01: Reconstrucción de la posesión

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · `build_segments_both` + `event_lineups`
- [ ] T-A2 · `clock.reset_secs` en `CONFIG_SPEC`
- [ ] T-A3 · `StatBundle.poss_seconds` / `finished_poss`
- [ ] T-B1 · Dataclasses + `register_enricher`
- [ ] T-B2 · Pre-proceso (`mclock`, series de TL, vínculos)
- [ ] T-B3 · Máquina de estados: cierres
- [ ] T-B4 · Rebote ofensivo → nueva oportunidad (14)
- [ ] T-B5 · Series de TL (tiro, and-one, técnicas, antideportivas)
- [ ] T-B6 · Huecos e incompletas
- [ ] T-B7 · Conteos por lado, jugadores implicados, quintetos
- [ ] T-B8 · `game_possessions` cacheado
- [ ] T-B9 · `reconcile`
- [ ] T-B10 · `team_possessions`
- [ ] T-B11 · `possessions_bundle` + rama nivel posesión
- [ ] T-B12 · Métricas `possessions_counted`, `off_poss_duration`, `player_poss_duration`
- [ ] T-B13 · Check `possession_gaps`
- [ ] T-B14 · σ empírico + calibración por posesiones alternas
- [ ] T-B15 · Rutas `/api/game/<id>/possessions`, `/api/possessions/reconcile`
- [ ] T-C1 · Métodos de `api.js`
- [ ] T-D1 · Tarjeta de conciliación
- [ ] T-D2 · Hoja de inspección
- [ ] T-D3 · Check en Calidad
- [ ] T-E1 · Estados vacío/error/offline
- [ ] T-E2 · `sw.js`
- [ ] T-F1 … T-F19 · Verificación

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
| CA-15 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (sin cambios de esquema; control de no regresión)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/metrics.md` — posesiones reconstruidas (reglas, reloj derivado, conciliación y diagnóstico), `possessions_counted`, `off_poss_duration`, `player_poss_duration`.
- `docs/api.md` — `GET /api/game/<game_id>/possessions`, `GET /api/possessions/reconcile`, check `possession_gaps` de `/api/data-quality`.
- `docs/architecture.md` — módulo `possessions.py`, `lineups.build_segments_both`, caché `poss:game`.
- `docs/frontend.md` — copy nuevo de Datos → Calidad (posesiones).

## Deuda / TODO
