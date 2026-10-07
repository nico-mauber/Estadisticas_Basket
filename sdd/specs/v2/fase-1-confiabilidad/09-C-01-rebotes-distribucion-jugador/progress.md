# Progress — C-01: Rebotes y distribución en perfil de jugador

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
- [ ] T-A1 · N/A — sin cambio de esquema
- [ ] T-B1 · `_safe_pos_div` y `_pct_individual`
- [ ] T-B2 · `calc_player_stats`: POS > 0, tope 100 %, `_pool`/`_invalid`
- [ ] T-B3 · `sum_pool`, `season_player_rates`, `strip_private`, `null_reasons(overrides)`
- [ ] T-B4 · `player_stats` con cociente de totales
- [ ] T-B5 · `search_players` con cociente de totales
- [ ] T-B6 · (si C-02 está) registro en `POOLED_GROUPS`
- [ ] T-B7 · Revisión de serialización de `calc_player_stats`
- [ ] T-C1 · N/A — `api.js` sin cambios
- [ ] T-D1 · `NULL_REASON_LABELS.estimacion_invalida`
- [ ] T-D2 · Rótulos con definición
- [ ] T-E1 · Estados de nulo del perfil
- [ ] T-E2 · `sw.js`: `CACHE`
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `upgrade_db()` N/A
- [ ] T-F3 · Endpoints probados
- [ ] T-F4 · Consola sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 · Salida anterior guardada (antes/después)
- [ ] T-F7 … T-F18 · Verificación por CA
- [ ] T-G1 · (diferido → C-02) población de liga
- [ ] T-G2 · (diferido → T-05) OR%/DR% en cancha y REB%
- [ ] T-G3 · (diferido → T-02 / T-01) muestra, percentil y ficha

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
| CA-10 | ⬜ (requiere C-02) | |
| CA-11 | ⬜ (requiere C-02) | |
| CA-12 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A previsto)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/metrics.md` — §"Por posesión y por minuto (jugador)": cociente de totales de la selección, `POS ≤ 0` → nulo; §"OR% / DR% / TRB% de jugador": forma acumulada, tope 100 %, aclaración de escala; `PTS/pos ≡ OER` también en la agregación
- [ ] `docs/api.md` — nota "Métricas de jugador por posesión y por minuto": agregación acumulada; razones `sin_intentos` y `estimacion_invalida` (tabla de códigos de `null_reasons`)
- [ ] `docs/frontend.md` — cards "Por posesión y por minuto" y "Rebotes & distribución": rótulos con definición; etiqueta `estimacion_invalida`

## Deuda / TODO
