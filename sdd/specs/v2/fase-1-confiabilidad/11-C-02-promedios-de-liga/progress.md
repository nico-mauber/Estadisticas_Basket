# Progress — C-02: Promedios de liga rotos

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
- [ ] T-A1 · N/A — sin cambio de esquema
- [ ] T-B1 · `backend/context.py`
- [ ] T-B2 · `backend/repository.py`
- [ ] T-B3 · `stats_engine`: claves, `POOLED_GROUPS`, `aggregate_games`, `league_averages`, `null_reasons(overrides)`
- [ ] T-B4 · `backend/population.py`: población y `league_summary`
- [ ] T-B5 · `team_profile` y `player_profile`
- [ ] T-B6 · Rutas finas `team_stats` / `player_stats`
- [ ] T-B7 · `league_overview` con competencia por defecto
- [ ] T-B8 · `/api/competitions` con `is_default`
- [ ] T-B9 · Hook `_configured_default()` documentado
- [ ] T-C1 · `api.js`: `team`/`player` con `params`
- [ ] T-D1 · Etiquetas `sin_universo` y `sin_datos`
- [ ] T-D2 · `statBox` con razón del `Ø`
- [ ] T-D3 · `_compOptions` con `allValue`
- [ ] T-D4 · Equipo
- [ ] T-D5 · Jugador
- [ ] T-D6 · Comparar
- [ ] T-D7 · Liga
- [ ] T-D8 · `charts.js`
- [ ] T-D9 · Eliminar `_computeAvg` y helpers de filtro
- [ ] T-E1 · Estados vacíos
- [ ] T-E2 · Errores 400 y competencia inexistente
- [ ] T-E3 · `sw.js`: `CACHE`
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `upgrade_db()` N/A
- [ ] T-F3 · Endpoints probados
- [ ] T-F4 · Consola sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 · Volcado "antes" guardado
- [ ] T-F7 … T-F21 · Verificación por CA
- [ ] T-G1 · (diferido → T-01) umbrales, percentiles y ficha
- [ ] T-G2 · (diferido → T-03) contexto completo
- [ ] T-G3 · (diferido → F-13) competencia configurada por defecto

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
| CA-16 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A previsto)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/api.md` — `GET /api/team`, `/api/player`, `/api/league`, `/api/competitions`: query `competition`/`last`, `context`, `competitions`, `league`/`league_meta`, retiro de `leagues`, errores 400 nuevos; reescribir la nota "Promedios de liga por competencia" (media de entidades, no ponderada por partidos)
- [ ] `docs/metrics.md` — sección "Promedio de liga (Ø)": definición, población, exclusión de nulos y DNP, razón `sin_universo`/`sin_datos`
- [ ] `docs/frontend.md` — reescribir "Filtro por competencia" y "Contexto de las cards de stat"; quitar `_computeAvg` de la tabla de funciones; fila "Ø liga" de Comparar; línea `Ø` en la evolución de jugador; copy nuevo
- [ ] `docs/architecture.md` — módulos `context.py`, `repository.py`, `population.py` en el mapa de capas

## Deuda / TODO
- `Ø` antes/después a registrar (R-04): OER equipos `1,0078 → 1,0074`, DER `1,0078 → 1,0145`, pace `79,40 → 79,10`, TO `14,69 → 14,57`; jugadores `oer 0,9541 → 0,9556`, `as_pos 0,1961 → 0,1939`, `or_pct 0,0642 → 0,0792` (valores esperados de la base local de 13 partidos; confirmar al implementar).
