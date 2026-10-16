# Progress — A-04: Rebote ofensivo y segunda oportunidad

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · Claves `oreb.putback_secs` / `oreb.kickout_secs` en `CONFIG_SPEC`
- [ ] T-A2 · Campos nuevos de `Chance`
- [ ] T-B1 · `kind_of` + fallback `previous_shot_event`
- [ ] T-B2 · `enrich_second_chance` (modo + desenlace) registrado
- [ ] T-B3 · `stats_engine.second_chance_rates`
- [ ] T-B4 · `second_chance_report` (resumen, desenlaces, orígenes, cadenas, jugadores)
- [ ] T-B5 · `cost_of_oreb`
- [ ] T-B6 · `reconcile_second_chance` + check de calidad
- [ ] T-B7 · `player_second_chance`
- [ ] T-B8 · Fichas T-01 y badges T-02
- [ ] T-B9 · Tipo de entidad `chance`
- [ ] T-B10 · Dimensión de contexto `chance`
- [ ] T-B11 · Tabla `team_second_chance`
- [ ] T-B12 · Ruta `GET /api/second-chance`
- [ ] T-C1 · `api.secondChance`
- [ ] T-D1 · `renderSecondChancePanel`
- [ ] T-D2 · Montaje en Equipo → Posesión (ataque/defensa)
- [ ] T-D3 · Montaje en Jugador → Posesión
- [ ] T-D4 · Estilos
- [ ] T-E1 · Estados de UI
- [ ] T-E2 · `sw.js` (si aplica)
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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (no aplica: sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/second-chance`, tabla `team_second_chance`, tipo `chance`, filtro `chance`.
- `docs/metrics.md` — segunda oportunidad, desenlaces, PPP por oportunidad, puntos por RO, conversión, coste del RO, OR% concedido, reloj derivado.
- `docs/frontend.md` — bloque "Segunda oportunidad" de la pestaña Posesión y su copy.
- `docs/architecture.md` — módulo `second_chance.py`.

## Deuda / TODO
