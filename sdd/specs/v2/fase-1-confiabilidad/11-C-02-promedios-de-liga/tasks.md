# Tasks — C-02: Promedios de liga rotos

> **ID:** C-02 · **Prioridad:** P0 · **Fase y orden:** 1·11 (recomendado: antes de C-04, C-01 y C-07)
> **Depende de:** C-11 · F-11 · **Habilita:** T-01, F-14, T-03, C-04, C-01, C-07
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · N/A — sin cambio de esquema (confirmar que ningún modelo de `backend/database.py` cambia y que `upgrade_db()` no se toca) · cubre — · Done: `git diff backend/database.py` vacío.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Crear `backend/context.py`: `Context` (3 campos), `ContextError`, `parse_context`, `context_key`, `filter_games` (competencia + últimos N, devuelve cronológico), `context_echo` · cubre RF-1, RF-5, RF-13, RF-14 · Done: `python -c` con 4 partidos de fechas distintas y `last=2` → `filter_games` devuelve los 2 más recientes en orden ascendente; `parse_context({"last": "0"})` y `{"last": "abc"}` levantan `ContextError` con "El parámetro last debe ser un entero mayor a 0."; `context_echo` devuelve las 10 claves del shape de plan §3.
- [ ] T-B2 · Crear `backend/repository.py`: `resolve_competition` (param → `all` → id/alias → entidad → hook de config → última → ninguna), `team_game_rows`, `player_game_rows`, `opponent_row`, con memo en `flask.g` y respeto de borradores · cubre RF-3, RF-6, RF-14 · Done: con `app.test_client()` sobre la copia de la base: `resolve_competition("all")["all"] is True`; `resolve_competition(None, team_code="OLI")["id"] == 1` y `["source"] == "entidad"`; `resolve_competition("999")` levanta `CompetitionError` 400 "La competencia no existe."; `len(team_game_rows(1)) == 26` y `len(player_game_rows(1)) == 312`.
- [ ] T-B3 · `stats_engine.py`: mover `TEAM_AVG_KEYS`/`PLAYER_AVG_KEYS` desde `app.py` (sin `ast_to`/`def_to_ratio`), agregar `TOTAL_KEYS`, `LOWER_IS_BETTER`, `POOLED_GROUPS` con `_season_balance`, `aggregate_games`; reescribir `league_averages(member_values, keys)` con `reason`; `null_reasons(…, overrides)` · cubre RF-1, RF-2, RF-8, RF-9 · Done: `aggregate_games` sobre los 2 partidos de Olimpia reproduce `averages` y `totals` que hoy devuelve `/api/team/OLI` (comparar los 60 valores); con lista vacía → todo `None` con la razón pedida; `league_averages([{"a": 1.0}, {"a": None}, {"a": 3.0}], ["a"])["a"] == {"avg": 2.0, "best": 3.0, "reason": None}` y sin valores → `{"avg": None, "best": None, "reason": "sin_datos"}`.
- [ ] T-B4 · Crear `backend/population.py`: `Member`, `Population`, `team_game_adv`, `player_game_adv` (incluye `reb_share`/`oreb_share`/`dreb_share`), `population` (memo por petición; `apply_thresholds=True` → `NotImplementedError`), `league_reference`, `league_summary` · cubre RF-2, RF-3, RF-4, RF-7, RF-9 · Done: `population("team", 1, ctx).members` tiene 14 miembros; `population("player", 1, ctx).members` tiene 152 (no 312: sin DNP); `league_summary("team", 1, ctx)[0]["oer"]` ≈ `{"avg": 1.0074, "best": 1.1232}`; `league_summary("team", None, ctx)` → todas las claves con `reason == "sin_universo"`.
- [ ] T-B5 · `population.team_profile` y `population.player_profile` (selección con `filter_games`, `aggregate_games`, `record`, `game_log` sin claves privadas, `competitions`, `league`/`league_meta`, `context`) · cubre RF-1, RF-5, RF-13 · Done: `team_profile("OLI", ctx)` devuelve las claves del plan §3 y **ninguna** `leagues`; con `ctx.last = 1`: `games == 1`, `context.games_used == 1`, `games_total == 2`.
- [ ] T-B6 · `app.py`: `team_stats` y `player_stats` finos (parsean contexto, delegan, 400/404); borrar los bucles de liga, `leagues` y `_avg`/`keys` locales · cubre RF-5, RF-14 · Done: `grep -n "league_averages\|leagues\|_opp_for" backend/app.py` sin usos en `team_stats`/`player_stats`; `curl -s "http://localhost:5000/api/team/OLI?competition=999"` → 400 con el mensaje; `…?last=0` → 400; `…/api/team/ZZZ` → 404.
- [ ] T-B7 [P] · `league_overview`: `repository.resolve_competition` (ausente = por defecto; `all` = todas) · `backend/app.py` · cubre RF-12 · Done: `curl -s http://localhost:5000/api/league` y `…?competition=1` devuelven 14 equipos con `standings_pos` (base local de una sola competencia); `…?competition=all` idéntico.
- [ ] T-B8 [P] · `competitions.list_competitions(include_hidden, default_id)` con `is_default`; la ruta pasa `repository.resolve_competition(None)["id"]` · `backend/competitions.py`, `backend/app.py` · cubre RF-6, RF-12 · Done: `curl -s http://localhost:5000/api/competitions` → exactamente un objeto con `is_default: true`.
- [ ] T-B9 · Dejar documentado en el código el hook `_configured_default()` (devuelve `None` hasta F-13) y que `last` no entra en `population()` · `backend/repository.py`, `backend/population.py` · cubre RF-1, RF-6 · Done: comentario/docstring con referencia a F-13 y a T-01.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.team(code, params = {})`, `api.player(code, name, params = {})`, `api.clutchTeam` traduce `all` → sin parámetro; `api.league` pasa `all` · `frontend/js/api.js` · cubre RF-5 · Done: en DevTools → Network `api.team("OLI", {competition: "1", last: 3})` pide `/api/team/OLI?competition=1&last=3`; `last: null` no aparece en la URL.

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · `NULL_REASON_LABELS`: `sin_universo` ("Elegí una competencia para ver el promedio de liga") y `sin_datos` ("Sin datos en la selección") · `frontend/js/core/format.js` · cubre RF-7 · Done: `nullDisplay("sin_universo")` trae el `title` correcto.
- [ ] T-D2 · `statBox`: el contexto muestra `Ø` con `nullDisplay(lg.reason)` cuando `avg` es nulo · `frontend/js/app.js` · cubre RF-2, RF-7 · Done: con `league.oer = {avg: null, reason: "sin_universo"}` la card muestra "Ø —" con el `title`.
- [ ] T-D3 · `_compOptions(comps, selected, allLabel, allValue = "")` y reemplazo de `_logComps` por `data.competitions` · `frontend/js/app.js` · cubre RF-5, RF-6 · Done: Equipo/Jugador/Comparar/Liga usan `allValue "all"`; el catálogo de Datos y Buscar siguen con `""` y funcionan.
- [ ] T-D4 · Equipo: `renderTeam` (competencia por defecto desde `context`), `_reloadTeam` (con `_teamReq`), pills por `context.games_total > 3`, selector con `data.competitions`, leyenda del `Ø`, récord siempre visible, estado "Sin partidos en esta competencia", radar con guarda, `leagueKey` `TO→tov`, `AS→ast`, `Robos→stl`, `Tapones→blk`; los cierres reciben `_teamComp` · `frontend/js/app.js` · cubre RF-4…RF-10 · Done: abrir Olimpia muestra la competencia preseleccionada; cambiar pill o selector dispara un request a `/api/team/OLI?…`; `TO` muestra `Ø 14,57`.
- [ ] T-D5 · Jugador: `renderPlayer`/`_renderPlayerContent(main, data)` con `api.player(…, { competition })`, selector, leyenda "Ø = promedio de {n} jugadores de {competencia}", `leagueKey` propios, radar con guarda · `frontend/js/app.js` · cubre RF-4, RF-5, RF-7, RF-9 · Done: M. Perdomo muestra `Ø` de OER = `league.oer.avg` de la respuesta.
- [ ] T-D6 · Comparar: selector con default `is_default`, `api.team(code, { competition })` para A y B, `avA/avB = data.averages`, `lg = dataA.league`, fila "Ø liga" en "Métricas avanzadas", radar con guarda · `frontend/js/app.js` · cubre RF-4, RF-7, RF-11 · Done: Olimpia vs Tabaré en "Liga de Ascenso 2026" muestra la fila "Ø liga" con `OER 1,01`.
- [ ] T-D7 [P] · Liga: `_leagueComp` arranca en `is_default`; opción "Todas" con valor `all`; `pickComp` para la tabla general · `frontend/js/app.js` · cubre RF-12 · Done: Liga abre en la competencia por defecto; elegir "Todas" con varias competencias pide elegir (C-09).
- [ ] T-D8 [P] · `charts.js`: `_norm` devuelve `null` si `lg.avg`/`lg.best` son nulos; `drawPlayerEvolution(canvasId, gameLog, leagueOerAvg)` con dataset "OER liga Ø" · `frontend/js/charts.js` · cubre RF-7, RF-10 · Done: la evolución de jugador dibuja la línea punteada con el valor de la card OER; con `Ø` nulo no hay línea ni error.
- [ ] T-D9 · Eliminar `_computeAvg`, `_filterByComp`, `_filteredLog`, `_logComps` y toda referencia a `data.leagues` · `frontend/js/app.js` · cubre RF-5 · Done: `grep -n "_computeAvg\|_filterByComp\|_filteredLog\|_logComps\|\.leagues" frontend/js/app.js` sin resultados.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado vacío "Sin partidos en esta competencia" (Equipo y Jugador) y mensaje del radar sin competencia · `frontend/js/app.js` · cubre RF-7, RF-14 · Done: `/api/team/OLI?competition=<id vacía>` se ve con "—" y el mensaje, sin errores JS.
- [ ] T-E2 · 400 de competencia/`last`: toast con el `error`; si la competencia guardada de la vista ya no existe, volver a la default · `frontend/js/app.js` · cubre RF-14 · Done: borrar la competencia seleccionada (en copia) y recargar la vista no deja la pantalla en error.
- [ ] T-E3 · Subir `CACHE` al siguiente entero · `frontend/sw.js` · cubre (assets) · Done: la caché nueva trae `app.js`, `api.js`, `charts.js` y `core/format.js` actualizados.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`DB_PATH=<copia> python backend/app.py`).
- [ ] T-F2 · `upgrade_db()` idempotente: N/A (sin esquema) — anotar en progress.
- [ ] T-F3 · Endpoints probados con curl: `/api/team/OLI`, `…?competition=1&last=1`, `…?competition=all`, `…?competition=999`, `…?last=0`; `/api/player/OLI/M.%20Perdomo` (+ ídem); `/api/league`, `/api/league?competition=all`; `/api/competitions` → shapes de plan §3 y §8.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Liga, Equipo, Jugador, Comparar y Buscador.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress.md.
- [ ] T-F6 · **Antes de tocar código**, guardar en el scratchpad un volcado (script ad hoc con `app.test_client()` sobre la copia de la base, en el commit `20552ef`) de `averages`, `totals`, `record`, `null_reasons` y `game_log` de los 14 equipos y de los 152 jugadores, más los `Ø` vigentes de OER/DER/pace/TO (para R-04 y CA-15).
- [ ] T-F7 · CA-1 (cliente): en el navegador, Equipo → Olimpia: anotar `Ø OER` de la card y el valor de la línea "OER liga Ø" (tooltip del gráfico); Comparar → Olimpia vs Tabaré (misma competencia): fila "Ø liga" → los tres coinciden (`1,01`); `curl` de `/api/team/OLI?competition=1` y `/api/team/TAB?competition=1` → `league` idéntico (comparación de JSON en Python).
- [ ] T-F8 · CA-2: `curl` de `/api/team/OLI?competition=1` y de `…&last=1` → `league` idéntico, `averages` distinto, `games_used` 2 y 1. Registrar la prueba también en la UI si un equipo tiene > 3 partidos (la base local no: las pills están ocultas).
- [ ] T-F9 · CA-3: script con `app.test_client()` que pide el perfil de los 14 equipos (`competition=1`) y compara la media de `averages[k]` con `league[k].avg` para `oer`, `der`, `pace`, `tov`, `ast`, `ast_to`, `efg_pct` (esperado `1.0074`, `1.0145`, `79.0979`, `14.5714`, `17.3929`, `1.2265`, `0.4923`); lo mismo para los 152 jugadores (`pts`, `oer`) recorriendo `/api/players/<team>` y `/api/player/<team>/<name>`.
- [ ] T-F10 · CA-4: jugadores con `ast_to` nulo (J. Lamas y otros sin pérdidas) no entran en el `Ø` de AS/PER (contar `N` = no nulos); `POST /api/competitions` vacía (id nuevo) → `/api/team/OLI?competition=<id>` → `games: 0`, valores `null` con `sin_datos`, `league` con `sin_datos`, sin `0` en ninguna parte.
- [ ] T-F11 · CA-5, CA-7: en la copia de la base, `POST /api/competitions {"name": "Copa C02", "season": "2026"}` y `PATCH /api/games/2849334 {"competition_id": <id>}` (COL–VER, 2026-06-10) → `/api/team/VER` sin parámetro devuelve `context.competition.id == <Copa C02>` (su partido más reciente), `/api/team/VER?competition=1` el otro partido; `league_meta.size == 2` para la Copa y 14 para "Liga de Ascenso 2026" (`COL` y `VER` juegan en ambas); `league.oer.avg` de la Copa == media de `averages.oer` de COL y VER con `competition=<Copa>`; `/api/competitions` marca `is_default` en la competencia con el partido más reciente ("Liga de Ascenso 2026", 2026-06-11) y Liga abre en ella; Equipo y Jugador de VER/COL (y sus jugadores) abren preseleccionando la Copa, que es la competencia de su partido más reciente.
- [ ] T-F12 · CA-6: Equipo y Comparar con "Todas las competencias" → "Ø —" con `title` "Elegí una competencia para ver el promedio de liga"; el radar dice "elegí una competencia".
- [ ] T-F13 · CA-8: `league_meta.size` de `/api/player/OLI/M.%20Perdomo?competition=1` == 152; un jugador con solo fichas DNP no es miembro (comparar con el conteo directo en SQL: jugadores con al menos una ficha de minutos > 0).
- [ ] T-F14 · CA-9: en cada vista (Liga, Equipo, Jugador, Comparar, Buscar) ejecutar en la consola `document.body.innerText.match(/↑\s*\d|\d{3,},\d\s*%/g)` → `null`; `grep -n "↑" frontend/js/app.js` solo muestra las flechas de ejes del mapa de liga (C-10).
- [ ] T-F15 · CA-10: Equipo y Jugador → cards `TO`, `AS`, `Robos`, `Tapones`: la línea `Ø` es de su propia métrica (p. ej. `TO Ø 14,57`) y el color compara conteo con conteo; una card sin `Ø` no tiene clase `above-avg`/`below-avg`.
- [ ] T-F16 · CA-11: Jugador → M. Perdomo → curva de evolución: línea "OER liga Ø" con el valor de la card OER.
- [ ] T-F17 · CA-12: Comparar con "Todas" → radar no se dibuja y se informa; con la competencia elegida, radar y fila "Ø liga" coinciden con Equipo.
- [ ] T-F18 · CA-13: DevTools → Network al cambiar el selector de competencia y las pills: nuevo request a `/api/team/OLI?competition=…&last=…`; `grep` de T-D9 sin resultados; récord, promedios, totales y game log corresponden a la selección.
- [ ] T-F19 · CA-14: `curl` con `competition=999`, `last=0`, `last=abc` → 400 con los mensajes del plan §3.
- [ ] T-F20 · CA-15: repetir el volcado de T-F6 con el código nuevo y comparar `averages`, `totals`, `record`, `null_reasons` y `game_log` de los 14 equipos y 152 jugadores (sin filtro, misma competencia): sin diferencias; anotar las diferencias esperadas de `league` (antes/después de OER/DER/pace/TO y de las métricas de jugador: `oer 0,9541 → 0,9556`, `as_pos 0,1961 → 0,1939`, `or_pct 0,0642 → 0,0792`).
- [ ] T-F21 · CA-16: consola sin errores y 360 px sin scroll horizontal de página en Liga, Equipo, Jugador y Comparar.

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 · **(diferido → T-01)** `population(…, apply_thresholds=True)`, percentil, ranking, distancias y ficha; reemplazo del `Ø` por la ficha · se resuelve en [T-01](../15-T-01-ficha-de-metrica/plan.md) · Done: lo verifica T-01.
- [ ] T-G2 · **(diferido → T-03)** Resto de los campos de `Context` (sede, rival, descanso, cuarto, marcador, con/sin jugador…), barra de contexto y estado en la URL · se resuelve en [T-03](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md).
- [ ] T-G3 · **(diferido → F-13)** Conectar `_configured_default()` a `ui.default_competition_id` · se resuelve en [F-13](../12-F-13-configuracion/plan.md).

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B4, T-B5, T-D4, T-D6, T-D8, T-F7 |
| CA-2 | T-B1, T-B4, T-B5, T-F8 |
| CA-3 | T-B3, T-B4, T-F9 |
| CA-4 | T-B3, T-B4, T-D1, T-D2, T-E1, T-F10 |
| CA-5 | T-B2, T-B4, T-F11 |
| CA-6 | T-B4, T-D1, T-D2, T-D4, T-D6, T-F12 |
| CA-7 | T-B2, T-B7, T-B8, T-D4, T-D5, T-D7, T-F11 |
| CA-8 | T-B4, T-F13 |
| CA-9 | T-D2, T-D9, T-F14 |
| CA-10 | T-B3, T-D4, T-D5, T-F15 |
| CA-11 | T-D8, T-F16 |
| CA-12 | T-D6, T-D8, T-F17 |
| CA-13 | T-B1, T-B5, T-B6, T-C1, T-D4, T-D9, T-F18 |
| CA-14 | T-B1, T-B2, T-B6, T-E2, T-F19 |
| CA-15 | T-B3, T-B5, T-F6, T-F20 |
| CA-16 | T-E3, T-F4, T-F21 |

## Dependencias externas
- C-11 y F-11 cerrados (ya lo están en la rama `v2`: `competitions.py`, `ingest.py`, `core/format.js`, `null_reasons`).
- Dataset de verificación: los 13 partidos del seed en `backend/basketball.db` ("Liga de Ascenso 2026"); para CA-4, CA-5, CA-7 y T-E2, una **copia** de la base con una 2ª competencia y una competencia vacía (Arquitectura R-05); no tocar la base real. Servidor sobre la copia: `DB_PATH=<copia> python backend/app.py`.
- Modo abierto (sin `AUTH_USERS`) o cookie de sesión para curl; `ADMIN_USERS` sin definir (cualquier logueado es admin) para dar de alta competencias y reasignar partidos en la copia.
- C-08 para `GET /api/player/<int:player_id>` y la clave de identidad `player_id` (opcional; si no está, la identidad es `(team_code, norm_name)` como hoy).
- Orden de la fase: recomendado antes de C-04, C-01 y C-07 (plan §10 D-1).
