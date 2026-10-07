# Tasks — C-01: Rebotes y distribución en perfil de jugador

> **ID:** C-01 · **Prioridad:** P0 · **Fase y orden:** 1·09 (recomendado: después de C-02)
> **Depende de:** C-11 · **Habilita:** T-05, A-12 · el `Ø` lo completa C-02
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · N/A — sin cambio de esquema (confirmar que ningún modelo de `backend/database.py` cambia) · cubre — · Done: `git diff backend/database.py` vacío.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Crear `_safe_pos_div(num, den)` (None si `den` no es > 0) y `_pct_individual(num, den) -> (valor, invalido)` (None+inválido si el valor supera 1; `den == 0` → `(None, False)`) · `backend/stats_engine.py` · cubre RF-4, RF-5 · Done: `python -c` → `_safe_pos_div(5, -0.12) is None`, `_safe_pos_div(0, 6.88) == 0.0`, `_pct_individual(40, 2.0)[1] is True`, `_pct_individual(1, 0) == (None, False)`.
- [ ] T-B2 · `calc_player_stats`: `oer`/`as_pos`/`tov_pos`/`pts_pos` con `_safe_pos_div`; `or_pct`/`dr_pct`/`trb_pct` con `_pct_individual`; devolver `_pool` (`pos`, `min` y los seis términos de rebote si hay equipo y rival) y `_invalid` · `backend/stats_engine.py` · cubre RF-1…RF-5 · Done: con la fila de G. Viera del partido 2849330 (8:58 min, 0 FGA, 2 FTA, 1 RO) → `as_pos is None`, `pts_pos is None`, `oer is None`, `possessions == -0.12`, `_pool["pos"] == -0.12`; con J. Lucchini (0:15, 1 RO) → `or_pct is None` y `"or_pct" in _invalid`.
- [ ] T-B3 · Crear `sum_pool(per_game)`, `season_player_rates(sums)` y `strip_private(d)`; extender `null_reasons(metrics, *, played=True, overrides=None)` con `overrides` y la razón `estimacion_invalida` para las claves de `_invalid` · `backend/stats_engine.py` · cubre RF-1…RF-8 · Done: con las sumas de M. Perdomo (`ast 14, tov 7, pts 25, orb 2, drb 1, pool_pos 29.52, pool_min 60.8833, …`) → `as_pos 0.4743`, `tov_pos 0.2371`, `pts_pos 0.8469 == oer`, `orb_min 0.0328`, `drb_min 0.0164`, `or_pct 0.0326`, `dr_pct 0.0158`; con las de J. Lucchini → `or_pct None` y `reasons["or_pct"] == "estimacion_invalida"`, `as_pos None` y `reasons["as_pos"] == "sin_intentos"`; con `{}` → todo `None`.
- [ ] T-B4 · `player_stats`: conservar `per_game_adv`, serializar `game_log` con `strip_private`, sobrescribir `averages` con `season_player_rates(sum_pool(<solo partidos jugados>))` (incluye `oer`) y pasar `overrides` a `null_reasons` · `backend/app.py` · cubre RF-1…RF-8 · Done: `curl -s "http://localhost:5000/api/player/OLI/M.%20Perdomo"` → `averages.as_pos == 0.4743` y `averages.oer == averages.pts_pos`; `curl -s "…/api/player/TAB/G.%20Viera"` → `game_log[0].as_pos == null` con `null_reasons.as_pos == "sin_intentos"`; la respuesta se serializa (sin `set` ni claves `_*`: `grep -c '"_pool"'` en el JSON = 0).
- [ ] T-B5 [P] · `search_players`: tras el bucle por partido, `season_player_rates(sum_pool(per_game))` para `as_pos, tov_pos, pts_pos, oer, orb_min, drb_min, or_pct, dr_pct, trb_pct` y `overrides` en `null_reasons` · `backend/app.py` · cubre RF-9 · Done: la fila de M. Perdomo en `/api/search/players` tiene exactamente los mismos 9 valores que `averages` de su perfil.
- [ ] T-B6 · **(si C-02 está cerrado)** En lugar de T-B4/T-B5, registrar `season_player_rates` en `POOLED_GROUPS` de `aggregate_games` y dejar que `player_stats`, `search_players` y la población de liga lo usen · `backend/stats_engine.py` · cubre RF-1…RF-3, RF-11 · Done: `league_summary("player", …)` calcula los siete indicadores con el mismo criterio que el perfil.
- [ ] T-B7 · Revisión de serialización: el único sitio que serializa un dict de `calc_player_stats` es `player_stats` (`game_log`) · `backend/app.py` · cubre — · Done: `grep -n "calc_player_stats" backend/app.py` y revisión de cada uso confirma que ninguno devuelve el dict crudo en `jsonify`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · N/A — sin métodos nuevos en `api.js` · cubre — · Done: `git diff frontend/js/api.js` vacío.

### Grupo D — Frontend: UI
- [ ] T-D1 · Agregar `estimacion_invalida: "Estimación no válida: la muestra de minutos es demasiado chica"` a `NULL_REASON_LABELS` · `frontend/js/core/format.js` · cubre RF-5 · Done: `nullDisplay("estimacion_invalida")` devuelve un `<span class="null-val" title="Estimación no válida…">—</span>`.
- [ ] T-D2 · Helper `_hint(label, text)` y rótulos con `title` (AS/pos, PER/pos, PTS/pos, RO/min, RD/min en "Por posesión y por minuto"; OR% y DR% en "Rebotes & distribución" con la aclaración de escala) · `frontend/js/app.js` · cubre RF-10 · Done: al pasar el cursor por cada etiqueta se lee la definición del spec §6; el `title` de OR%/DR% contiene "no es comparable con el OR% de equipo".

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Confirmar los estados de nulo en el perfil: "—" con `title` para `sin_intentos`, `estimacion_invalida` y `dnp` (jugador sin partidos jugados), sin clase `above-avg`/`below-avg` · `frontend/js/app.js` · cubre RF-4, RF-5, RF-8 · Done: N. Cerminatti → tres "—" con "Sin intentos…" y `0,00` en RO/min y RD/min; J. Lucchini → OR% "—" con "Estimación no válida…".
- [ ] T-E2 · Subir `CACHE` al siguiente entero · `frontend/sw.js` · cubre (assets) · Done: la caché nueva contiene `app.js` y `core/format.js` actualizados.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · `upgrade_db()` idempotente: N/A (sin esquema) — anotar en progress.
- [ ] T-F3 · Endpoints probados con curl: `/api/player/OLI/M.%20Perdomo`, `/api/player/TAB/G.%20Viera`, `/api/player/TRO/J.%20Lucchini`, `/api/player/STO/N.%20Cerminatti`, `/api/search/players` → shapes de plan §3 y §8.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer el perfil de jugador y el Buscador.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress.md.
- [ ] T-F6 · Guardar (en progress) la salida **anterior** de los jugadores del plan §10.1 paso 4 antes de tocar código (R-04) y la **nueva** al terminar.
- [ ] T-F7 · CA-1 (cliente): script ad hoc con `app.test_client()` sobre una copia de la base: recorrer `/api/players/<team>` de los 14 equipos y `/api/player/<team>/<name>` de cada jugador con `games > 0`; afirmar que no hay valores negativos en las 9 claves, que `or_pct`/`dr_pct`/`trb_pct` están en `[0, 1]` o nulos con razón, que `as_pos`/`tov_pos`/`pts_pos` son numéricos cuando `ΣPOS > 0` y que RO/min y RD/min son numéricos con minutos > 0; anotar el resumen (152 jugadores con minutos; 14 con `ΣPOS = 0`).
- [ ] T-F8 · CA-2: correr el script de plan §10.1 paso 1 para M. Perdomo y comparar con `averages` del API y con la pantalla (`0,47 / 0,24 / 0,85 / 0,03 / 0,02 / 3,3% / 1,6%`); anotar los totales usados.
- [ ] T-F9 · CA-3: G. Viera → game log partido 2849330 con "—" en AS/pos y PTS/pos; temporada `AS/pos 0,15`, `PER/pos 0,00`, `PTS/pos 1,02`, `OER 1,02`; ningún negativo.
- [ ] T-F10 · CA-4: N. Cerminatti → tres tasas por posesión en "—" (`title` "Sin intentos: no se puede calcular"), RO/min y RD/min `0,00`.
- [ ] T-F11 · CA-5: J. Lucchini (OR%) e I. Rocha (DR%) → "—" con el `title` de `estimacion_invalida`; el JSON no contiene `5.16` ni `1.43` en `or_pct`/`dr_pct`.
- [ ] T-F12 · CA-6: jugador con un partido DNP (`game_log[].played == false`, p. ej. N. Cerminatti en el partido 2849340 con `0:00`) → `games` cuenta solo jugados y los términos del DNP no cambian los totales (comparar con el script del paso 1 de plan §10.1).
- [ ] T-F13 · CA-7: comparar la fila de `/api/search/players` con `averages` del perfil para M. Perdomo (los 9 valores idénticos).
- [ ] T-F14 · CA-8: para los 152 jugadores con minutos, `averages.pts_pos == averages.oer` (perfil) y `rec.pts_pos == rec.oer` (Buscador); y `game_log[].pts_pos == game_log[].oer`.
- [ ] T-F15 · CA-9: hover/tap en las siete etiquetas → definición visible; el `title` de OR%/DR% aclara la escala.
- [ ] T-F16 · CA-10 (requiere C-02): con una selección de un solo partido, los siete indicadores coinciden con el valor del game log de ese partido; con la competencia completa coinciden con el perfil sin filtro. Si C-02 no está, registrar "pendiente (C-02)" en progress.
- [ ] T-F17 · CA-11 (requiere C-02): `league.or_pct.avg` y `league.dr_pct.avg` de `GET /api/player/…?competition=<id>` no nulos y distintos de 0; el perfil muestra `Ø` real. Si C-02 no está, "pendiente (C-02)".
- [ ] T-F18 · CA-12: consola sin errores y 360 px sin scroll horizontal de página en el perfil y el Buscador.

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 · **(diferido → C-02)** Población de liga de jugadores con el mismo criterio acumulado, sin fichas DNP y sin negativos · se resuelve en [C-02](../11-C-02-promedios-de-liga/plan.md) · Done: lo verifica C-02 (CA-11 de este spec).
- [ ] T-G2 · **(diferido → T-05)** OR%/DR% exactos con rebotes del equipo mientras el jugador está en cancha (pbp, `on_court`) y caja REB% · se resuelve en [T-05](../13-T-05-conjunto-estandar-metricas/plan.md) · Done: lo verifica T-05.
- [ ] T-G3 · **(diferido → T-02 / T-01)** Mínimos de muestra, badge, percentil y ficha de los siete indicadores · se resuelve en [T-02](../14-T-02-confiabilidad-muestra/plan.md) y [T-01](../15-T-01-ficha-de-metrica/plan.md).

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B1…T-B4, T-E1, T-F7 |
| CA-2 | T-B2, T-B3, T-B4, T-F8 |
| CA-3 | T-B1, T-B2, T-B4, T-F9 |
| CA-4 | T-B3, T-E1, T-F10 |
| CA-5 | T-B1, T-B2, T-B3, T-D1, T-E1, T-F11 |
| CA-6 | T-B3, T-B4, T-F12 |
| CA-7 | T-B5, T-F13 |
| CA-8 | T-B3, T-B4, T-B5, T-F14 |
| CA-9 | T-D2, T-F15 |
| CA-10 | T-B6 (C-02), T-F16 |
| CA-11 | T-B6 (C-02), T-F17 (+ T-G1) |
| CA-12 | T-E2, T-F4, T-F18 |

## Dependencias externas
- Grupo 0 de C-11 cerrado (código de `dev` integrado) y `core/format.js` (`NULL_REASON_LABELS`, `nullDisplay`) disponible (ya cerrado en la rama `v2`).
- Dataset de verificación: los 13 partidos del seed ya importados en `backend/basketball.db` (incluye dos partidos con prórroga: `2849340` y `2849347`, `games.minutes = 45`, con el reproceso de F-11); no hace falta red. Trabajar sobre una **copia** de la base para los scripts con `app.test_client()`.
- C-02 cerrado (recomendado antes; condiciona T-B6, T-F16, T-F17) — plan §10 D-1.
- C-08 para `GET /api/player/<int:player_id>` (opcional; si no está, usar la ruta por nombre).
