# Progress — A-01: Reconstrucción de la posesión

> **Estado:** ✅ Completado
> **Fecha:** 2026-10-14

## Estado de tareas
- [x] T-A1 · `build_segments_both` + `event_lineups`
- [x] T-A2 · `clock.reset_secs` en `CONFIG_SPEC`
- [x] T-A3 · `StatBundle.poss_seconds` / `finished_poss`
- [x] T-B1 · Dataclasses + `register_enricher`
- [x] T-B2 · Pre-proceso (`mclock`, series de TL, vínculos)
- [x] T-B3 · Máquina de estados: cierres
- [x] T-B4 · Rebote ofensivo → nueva oportunidad (14)
- [x] T-B5 · Series de TL (tiro, and-one, técnicas, antideportivas)
- [x] T-B6 · Huecos e incompletas
- [x] T-B7 · Conteos por lado, jugadores implicados, quintetos
- [x] T-B8 · `game_possessions` cacheado
- [x] T-B9 · `reconcile`
- [x] T-B10 · `team_possessions`
- [x] T-B11 · `possessions_bundle` + `ppp_stats`
- [x] T-B12 · Métricas `possessions_counted`, `off_poss_duration`, `player_poss_duration`
- [x] T-B13 · Check `possession_gaps`
- [x] T-B14 · σ empírico + `calibrate_k` con `method`
- [x] T-B15 · Rutas `/api/game/<id>/possessions`, `/api/possessions/reconcile`
- [x] T-C1 · Métodos de `api.js`
- [x] T-D1 · Tarjeta de conciliación
- [x] T-D2 · Hoja de inspección
- [x] T-D3 · Check en Calidad
- [ ] T-E1 · Estados vacío/error/offline (parcial: errores con copy; offline delega a F-11)
- [x] T-E2 · `sw.js` v24 → v25
- [x] T-F1 … T-F19 · Verificación (por script y test_client)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | `reconcile?competition=1`: diff -0.27 % pooled, 0 equipos fuera del 2 %, 0 partidos sobre 5 % |
| CA-2 | ✅ | `pts_ok: True` en 26/26 equipo-partidos |
| CA-3 | ✅ | Posesiones con 2+ oportunidades; 2.ª con `shot_clock_start=14` |
| CA-4 | ✅ | Faltas de tiro con serie TL cierran correctamente |
| CA-5 | ✅ | And-one (1of1 tras canasta) detectado por look-ahead |
| CA-6 | ✅ | TL técnicos no cierran posesión; `outside_points` correcto |
| CA-7 | ✅ | Partidos con prórroga: `period_type=OVERTIME`, cierres `fin_periodo` |
| CA-8 | ✅ | `possession_gaps` reporta 2 incompletas |
| CA-9 | ✅ | Sin 5 titulares: `own_on_court=null` |
| CA-10 | ✅ | Partido sin pbp: 404 `sin_pbp` |
| CA-11 | ✅ | `duration >= 0` en todas las posesiones |
| CA-12 | ✅ | `clock.reset_secs` configurable (default 14) |
| CA-13 | ✅ | `possessions_counted=81.0`, `off_poss_duration=14.3` en `/api/metrics/team?id=OMU` |
| CA-14 | ✅ | Check `possession_gaps` en Calidad: 2 incompletas (alerta) |
| CA-15 | pendiente | Medición de rendimiento en browser |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema (no regresión): ✅
- Endpoints probados (test_client): ✅ shot-zones 200, game possessions 200 (161 poss), reconcile 200, error cases 404/400/400, data-quality 200
- Consola del navegador sin errores JS: pendiente (verificación manual)

## Desviaciones respecto a docs/ o plan
- **Sin `previous_action`/`qualifiers`:** columnas no existen. Vínculos por proximidad; and-one por look-ahead.
- **And-one timing relajado:** no exige igualdad de `mclock` (FIBA registra ±1-9s).
- **Salto entre dos → `perdida`** con `turnover_by_id=null`.
- **Métricas 83 → 86:** `possessions_counted`, `off_poss_duration`, `player_poss_duration`.
- **`team_possessions` sin `context.filter_games`:** dicts de `team_pbp_games` no tienen formato compatible; competencia ya filtrada por parámetro.
- **`possessions_bundle` rama en loaders:** solo integrado en `bundles._team_bundle_from_games`; rama `level=="posesion"` completa diferida a T-03.
- **Calibración `posesiones_alternas`:** método aceptado en `calibrate_k(method=...)` pero algoritmo por posesiones diferido a cuando existan dimensiones de contexto (A-02..A-05).

## Docs actualizados
- ✅ `docs/api.md` — 2 endpoints nuevos, `possession_gaps` actualizado
- ✅ `docs/architecture.md` — módulo `possessions.py`
- `docs/metrics.md` — pendiente
- `docs/frontend.md` — pendiente

## Deuda / TODO
- T-E1: copy de estados vacío/error/offline completo (la UI muestra errores genéricos)
- CA-15: medición de rendimiento en frío/caliente
- Rama `level == "posesion"` en loaders de T-03
- Algoritmo de calibración por posesiones alternas
- `player_poss_duration` para `finished_poss` del jugador (depende de A-12)
