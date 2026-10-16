# Tasks — Feature 15: métricas de jugador

> Plan: `sdd/specs/15-metricas-jugador/plan.md` (gate del Paso 2 pasado). Reglas: `sdd/03-tasks.md`.

## Orden de ejecución

### Grupo A — Backend: esquema
- [ ] **T-A1** · N/A — sin cambio de esquema · **Done:** `database.py` sin cambios en el diff.

### Grupo B — Backend: lógica y rutas
- [ ] **T-B1** · `calc_player_stats`: `as_pos`, `tov_pos`, `pts_pos` sobre `p_pos` (reusando `oer`
  para `pts_pos`) · `backend/stats_engine.py` · cubre RF-1, RF-2, RF-3, RF-5 ·
  **Done:** un jugador con posesiones devuelve los 3 con valor; con `p_pos == 0` devuelve `null`.
- [ ] **T-B2** · `calc_player_stats`: `orb_min`, `drb_min` desde `_parse_minutes(p["minutes"])` ·
  `backend/stats_engine.py` · cubre RF-4, RF-5 ·
  **Done:** `RO/min` de un partido coincide con `RO ÷ minutos` calculado a mano; DNP → `null`.
- [ ] **T-B3** · `calc_player_stats`: parámetro `opp=None` + `or_pct`/`dr_pct`/`trb_pct` con la
  fórmula individual de RF-6 · `backend/stats_engine.py` · cubre RF-6 ·
  **Done:** con `team` y `opp` presentes devuelve valor; sin `opp`, `null`.
- [ ] **T-B4** · `season_ast_to(ast, tov)` — `None` si `tov == 0` · `backend/stats_engine.py` ·
  cubre RF-7, RF-8 · **Done:** `season_ast_to(12, 6) == 2.0`; `season_ast_to(5, 0) is None`.
- [ ] **T-B5** · `league_averages`: agregar las 5 claves nuevas; `tov_pos` a `lower_is_better` ·
  `backend/stats_engine.py` · cubre RF-9 · **depende de T-B1, T-B2** ·
  **Done:** el `league` de la respuesta trae entrada para las 5.
- [ ] **T-B6** · `player_stats`: pasar `opp` a `calc_player_stats`; `averages.ast_to` vía
  `season_ast_to` sobre los totales de partidos jugados · `backend/app.py` · cubre RF-6, RF-7 ·
  **depende de T-B3, T-B4** · **Done:** CA-5 y CA-7 pasan.
- [ ] **T-B7** [P] · `team_stats`: `averages.ast_to` de equipo vía `season_ast_to` · `backend/app.py` ·
  cubre RF-7, RF-8 · **depende de T-B4** · **Done:** CA-8 pasa.
- [ ] **T-B8** [P] · `search_players`: derivar `opp` de `team_rows` y pasarlo; AS/PER acumulado ·
  `backend/app.py` · cubre RF-6, RF-7 · **depende de T-B3, T-B4** ·
  **Done:** el buscador trae las 5 claves nuevas y `or_pct` con valor.
- [ ] **T-B9** [P] · `team_players`: pasar `opp` · `backend/app.py` · cubre RF-6 · **depende de T-B3** ·
  **Done:** sin regresión en el roster.

### Grupo C — Frontend: api.js
- [ ] **T-C1** · N/A — sin cambios · **Done:** `api.js` sin cambios en el diff.

### Grupo D — Frontend: UI
- [ ] **T-D1** · Agregar `as_pos` a `NOT_PCT` en `statBox` · `frontend/js/app.js` · cubre RF-1 ·
  **Done:** `AS/pos` de `0.12` se muestra `0.12`, no `12.0%`.
- [ ] **T-D2** · Cinco `statBox` nuevas en el bloque de producción del perfil (`PER/pos` con
  `higherIsBetter = false`) · `frontend/js/app.js` · cubre RF-1…RF-4, RF-9 · **depende de T-B5, T-D1** ·
  **Done:** CA-1 pasa; cada card muestra su `Ø`.

### Grupo E — Errores y estados vacíos
- [ ] **T-E1** · Jugador con minutos y 0 posesiones → los 3 por-posesión en `"—"`, los 2 por-minuto con
  valor · cubre RF-5 · **Done:** sin excepción ni `NaN`.
- [ ] **T-E2** · Partido sin fila de rival → `or_pct`/`dr_pct`/`trb_pct` en `null`, los 5 indicadores
  intactos · cubre RF-6 · **Done:** el perfil carga igual.
- [ ] **T-E3** · `sw.js` sin cambios · **Done:** `STATIC[]` y `CACHE` sin tocar.

### Grupo F — Verificación de feature
- [ ] **T-F1** · Backend arranca sin traceback
- [ ] **T-F2** · N/A — sin cambio de esquema
- [ ] **T-F3** · Endpoints probados contra el shape del plan §8
- [ ] **T-F4** · Consola sin errores JS nuevos
- [ ] **T-F5** · Recorrer CA-1…CA-10 y marcar ✅ con evidencia en `progress.md`

## Matriz de cobertura (CA → tareas)

| CA | Tareas |
|---|---|
| CA-1 · Los 5 con valor numérico | T-B1, T-B2, T-B5, T-D2 |
| CA-2 · 0 posesiones → null | T-B1, T-E1 |
| CA-3 · DNP no aporta | T-B1, T-B2, T-B6 |
| CA-4 · `RO/min` coincide con el cálculo manual | T-B2 |
| CA-5 · `OR%`/`DR%` con valor | T-B3, T-B6 |
| CA-6 · `OR%` coincide con la fórmula de RF-6 | T-B3 |
| CA-7 · AS/PER = 12/6 = 2.00 | T-B4, T-B6 |
| CA-8 · Mismo criterio en equipo | T-B4, T-B7 |
| CA-9 · Sin pérdidas → `"—"` | T-B4 |
| CA-10 · Consola sin errores JS | T-F4 |

10 CA, 0 sin cubrir.

## Dependencias externas

- **Base con minutos y rebotes reales** — presente: 95 filas con `minutes` en formato `"MM:SS"` y
  rebotes de equipo y rival en `team_game_stats`. Suficiente para CA-1, CA-4, CA-5 y CA-6.
- **Un jugador con pérdidas > 0 para CA-7** y **uno sin pérdidas para CA-9** — verificar que existan
  antes de T-B6; si no, construir el caso a nivel unitario y registrarlo.
- **Navegador** para T-F4 y CA-1 (no hay test suite — Constitución 8).
- Sin variables de entorno ni dependencias nuevas.
