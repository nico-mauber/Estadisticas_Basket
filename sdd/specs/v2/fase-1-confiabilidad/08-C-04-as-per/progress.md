# Progress — C-04: AS/PER (asistencias sobre pérdidas)

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
- [ ] T-A1 · N/A — sin cambio de esquema
- [ ] T-B1 · `ast_to` por partido en `calc_team_stats`
- [ ] T-B2 · `totals.ast`/`totals.tov` en `team_stats`
- [ ] T-B3 · `totals.ast`/`totals.tov` en `player_stats`
- [ ] T-B4 · Razón `sin_perdidas` por partido de equipo
- [ ] T-C1 · N/A — `api.js` sin cambios
- [ ] T-D1 · (solo si C-02 no está) `_computeAvg` pooled para `ast_to`
- [ ] T-D2 · Caja AS/PER en Equipo
- [ ] T-D3 · Caja AS/PER en Jugador (rótulo y `leagueKey`)
- [ ] T-D4 · Columna AS/PER en los game logs
- [ ] T-D5 · Fila AS/PER en Comparar
- [ ] T-D6 · Columna AS/PER en el Buscador
- [ ] T-E1 · Estado sin pérdidas con `title`
- [ ] T-E2 · `sw.js`: `CACHE`
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `upgrade_db()` N/A
- [ ] T-F3 · Endpoints probados
- [ ] T-F4 · Consola sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 … T-F15 · Verificación por CA
- [ ] T-G1 · (diferido → C-02) `Ø` de AS/PER
- [ ] T-G2 · (diferido → T-01) percentil y ficha

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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A previsto)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/metrics.md` — §"Pérdidas y asistencias": definición única de AS/PER (rótulo, PER = pérdidas, acumulado de la selección, valor por partido, nulo `sin_perdidas`)
- [ ] `docs/api.md` — `totals.ast`/`totals.tov`; `game_log[].ast_to` de equipo
- [ ] `docs/frontend.md` — caja AS/PER (Equipo y Jugador), columnas de game log, fila de Comparar, columna del Buscador, nota transitoria de `_computeAvg`

## Deuda / TODO
