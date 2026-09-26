# Tasks — C-06: Umbral de cierres de partido

> **ID:** C-06 · **Fase y orden:** 1·05 · **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

## Orden de ejecución

### Grupo A — Backend: único lugar del umbral y la ventana
- [ ] T-A1 · Agregar `DEFAULT_MARGIN = 10`, `DEFAULT_WINDOW_SECS = 300`, `CLUTCH_SECS = DEFAULT_WINDOW_SECS` (alias) y
  `PERIOD_TYPES_OT = {"OT", "OVERTIME"}` a `backend/clutch.py` · cubre RF-2, RF-7 · Done: `grep -n "margin=15\|margin=10\|CLUTCH_SECS = 300" backend/clutch.py backend/app.py frontend/js/app.js` no devuelve más literales que la constante recién creada.
- [ ] T-A2 · `_is_clutch(ev, last_regular, window_secs=DEFAULT_WINDOW_SECS)` reconoce `period_type in PERIOD_TYPES_OT` · `backend/clutch.py` · cubre RF-7 · Done: con un evento `period_type="OVERTIME"` la función devuelve `True`.
- [ ] T-A3 · `_entry_margin(evs, last_reg, window_secs=DEFAULT_WINDOW_SECS)` compara contra `window_secs` en vez de `CLUTCH_SECS` · `backend/clutch.py` · cubre RF-1, RF-2 · Done: llamada con `window_secs=180` cambia el resultado frente a `window_secs=300` en un caso con eventos entre los minutos 3 y 5.
- [ ] T-A4 [P] · Calcular `overtime_periods` por partido (períodos distintos con `period_type in PERIOD_TYPES_OT` en el partido completo) · `backend/clutch.py` · cubre RF-7 · Done: un partido con una prórroga en el fixture de prueba devuelve `overtime_periods == 1`.
- [ ] T-A5 · `team_clutch(games, team_code, team_name, margin=None, window_secs=None, competition=None)`: aplica defaults, agrega `games_total`, `games_with_pbp`, `games_without_pbp` (0 por ahora, ver plan §10 D-1), `games_without_clutch_events`, `margin`, `window_secs`, `competition` a la respuesta · `backend/clutch.py` · cubre RF-2, RF-3, RF-5, RF-7, RF-8 · Done: `games_qualified + games_excluded + games_without_clutch_events == games_with_pbp`.
- [ ] T-A6 · Helper `_parse_int_param(raw, lo, hi)` en `backend/app.py` · cubre RF-9 · Done: `_parse_int_param("abc", 0, 40)` y `_parse_int_param("50", 0, 40)` devuelven `None`; `_parse_int_param("8", 0, 40)` devuelve `8`.
- [ ] T-A7 · `clutch_team`: valida `margin`/`window_secs` con T-A6 → 400 `parametro_invalido` si inválidos; deja de tener default propio de `margin` (delega en `team_clutch`) · `backend/app.py` · cubre RF-2, RF-9 · Done: `GET /api/clutch/HYM?margin=abc` responde 400 con `code: "parametro_invalido"`.
- [ ] T-A8 [P] · Resolución de `competition` con fallback local (D-2 del plan) si F-11 aún no está integrado: filtra por `Game.competition` (string) o pasa `None` · `backend/app.py` · cubre RF-8 · Done: con dos competencias sembradas, `?competition=<label exacto>` filtra `games_total` a los partidos de esa competencia.

### Grupo B — Backend: verificación de nulos (sin cambio de código, solo confirmación)
- [ ] T-B1 · Confirmar que `_box_metrics`/`_safe_div` siguen devolviendo `None` con denominador 0 tras los cambios de A · cubre RF-10 · Done: partido con `fga == 0` en la ventana de cierre → `efg_pct`/`ts_pct` del agregado son `null`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.clutch(team, params = {})` agrega `params` a la query (`margin`, `window_secs`, `competition`) sin romper las llamadas existentes sin argumentos · `frontend/js/api.js` · cubre RF-8, RF-9 · Done: `api.clutch('CNF')` sigue funcionando igual; `api.clutch('CNF', {window_secs: 180})` agrega `?window_secs=180` a la URL.

### Grupo D — Frontend: UI (render)
- [ ] T-D1 · `renderTeamClutch`: título "Cierres" (sin números) en loading y error · `frontend/js/app.js` · cubre RF-4 · Done: durante la carga y ante un error, el `<h3>`/título de la card muestra exactamente "Cierres".
- [ ] T-D2 · Título de éxito construido con `d.margin`/`d.window_secs` (helper `fmtMin`) → "Cierres (últimos {min} min, dif ≤ {margen})" en mayúsculas · `frontend/js/app.js` · cubre RF-4 · Done: con `margin=10, window_secs=300` el título renderizado es "CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)".
- [ ] T-D3 · Línea de recuento con los 4 contadores + segmentos opcionales (sin play-by-play, sin eventos de cierre) · `frontend/js/app.js` · cubre RF-5, RF-6 · Done: con datos de prueba (`games_qualified=9, games_excluded=2`) el recuento muestra "9 calificado(s) · 2 excluido(s) por diferencia mayor a 10".
- [ ] T-D4 [P] · Columna "PR" en la tabla `per_game` (muestra `overtime_periods` si > 0) · `frontend/js/app.js` · cubre RF-7 · Done: el partido con prórroga del fixture muestra "1" en la columna PR; el resto de filas la muestra en blanco.
- [ ] T-D5 [P] · Estado vacío (0 calificados) usa `margin`/`window_secs` de la respuesta en el mensaje · `frontend/js/app.js` · cubre RF-6 · Done: con `games_qualified=0`, el mensaje cita el margen y el minuto de la respuesta, no un literal fijo.

### Grupo E — Errores, estados vacíos, offline
- [ ] T-E1 · Mensaje 404 nuevo "El equipo no tiene partidos en la competencia seleccionada." se muestra en la card cuando aplica · `frontend/js/app.js` · cubre RF-8 · Done: con `?competition=<id sin partidos del equipo>` la card muestra ese mensaje exacto.
- [ ] T-E2 · Verificar que el manejo de error de red existente de `api.js` cubre la card de Cierres sin cambios adicionales · cubre offline · Done: con la red del navegador deshabilitada, la card muestra el mensaje de error de red existente (no un traceback ni pantalla en blanco).

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · Sin cambio de esquema, no aplica `upgrade_db()` (se documenta la omisión).
- [ ] T-F3 · `curl http://localhost:5000/api/clutch/HYM` (con sesión) devuelve `margin: 10, window_secs: 300` y los 4 contadores de universo consistentes entre sí.
- [ ] T-F4 · Consola del navegador sin errores JS al abrir la vista Equipo y su card de Cierres.
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`.
- [ ] T-F6 (CA-1) · Con sesión iniciada, abrir la vista Equipo de un equipo con partidos importados y verificar en el navegador que el encabezado dice exactamente "CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)".
- [ ] T-F7 (CA-2) · `curl "http://localhost:5000/api/clutch/HYM?margin=15"` vs `curl "http://localhost:5000/api/clutch/HYM"`: comparar `games_qualified`/`games_excluded` y verificar que el partido con diferencia entre 11 y 15 pasa de calificado a excluido.
- [ ] T-F8 (CA-3) · Con `app.test_client()` (`GET /api/clutch/<team_code>` para cada equipo del seed), verificar `games_qualified + games_excluded + games_without_clutch_events == games_with_pbp` y `games_with_pbp + games_without_pbp == games_total`.
- [ ] T-F9 (CA-4) · `curl "http://localhost:5000/api/clutch/HYM?margin=8&window_secs=180"`, confirmar que la respuesta trae `margin: 8, window_secs: 180`; luego `grep -rn "≤ 10\|≤ 15\|dif ≤\|CLUTCH_SECS = 300" frontend/js/app.js backend/app.py` no debe encontrar literales de umbral/ventana asociados a Cierres fuera de la constante de `clutch.py`.
- [ ] T-F10 (CA-5) · Identificar en el seed un partido con prórroga y diferencia ≤ 10 al 5:00 del último cuarto regular (revisar `backend/app.py` `SEED_URLS` + `GET /api/pbp/<game_id>`); pedir `/api/clutch/<equipo>` y verificar `overtime_periods ≥ 1` en ese partido y que `pts`/`opp_pts` incluyan los puntos de la prórroga (sumar a mano los eventos `2pt`/`3pt`/`freethrow` con `success=1` del último cuarto con `clock_secs ≤ 300` más los eventos `OVERTIME`).
- [ ] T-F11 (CA-6) · `curl "http://localhost:5000/api/clutch/HYM?margin=50"`, `?margin=abc`, `?window_secs=30`: los tres responden 400 con `code: "parametro_invalido"` y mensaje en español.
- [ ] T-F12 (CA-7) · Con al menos dos competencias sembradas (o simuladas con dos valores de `Game.competition`), verificar que `?competition=<label>` filtra `games_total`; en el navegador, cambiar la competencia elegida en Equipo y confirmar que la card de Cierres se recalcula.
- [ ] T-F13 (CA-8) · `curl http://localhost:5000/api/clutch/<equipo sin pbp>` (o un equipo sembrado sin partidos con pbp) responde 404 `sin_pbp` con el mensaje "Equipo sin play-by-play. Reimportá sus partidos."
- [ ] T-F14 (CA-9) · Buscar (o preparar con datos de prueba) un cierre calificado sin intentos de tiro de un equipo; verificar que `efg_pct`/`ts_pct` del agregado son `null` y la UI muestra "—".
- [ ] T-F15 (CA-10) · En el navegador, observar el título durante la carga (recargar con throttling) y ante un error simulado (URL de equipo inexistente): en ambos casos el encabezado dice solo "CIERRES", sin umbral.
- [ ] T-F16 (CA-11) · Recorrer la vista Equipo en desktop y con las DevTools en 360 px de ancho: sin errores en consola y el encabezado de Cierres no desborda ni corta texto.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-A1, T-A5, T-D2, T-F6 |
| CA-2 | T-A3, T-A5, T-A7, T-F7 |
| CA-3 | T-A5, T-F8 |
| CA-4 | T-A1, T-A5, T-A7, T-D2, T-F9 |
| CA-5 | T-A4, T-F10 |
| CA-6 | T-A6, T-A7, T-F11 |
| CA-7 | T-A8, T-F12 |
| CA-8 | T-E1, T-F13 |
| CA-9 | T-B1, T-F14 |
| CA-10 | T-D1, T-F15 |
| CA-11 | T-F16 |

## Dependencias externas
- C-11 Grupo 0 (integración de `dev`, commit `0cc4de6` sin `venv`) debe estar mergeado antes de empezar: hoy `main`
  tiene `margin=15` y `CLUTCH_SECS=300` sin las correcciones de `dev` (`margin=10`, título desde `d.margin`); C-06
  parte de ese estado ya integrado.
- Reimportación de partidos no es necesaria (sin cambio de esquema ni de datos persistidos).
- Seed con al menos un partido con prórroga y diferencia ≤ 10 al 5:00 del último cuarto regular (T-F10): verificar
  contra los 13 partidos de `SEED_URLS` cuál cumple; si ninguno cumple exactamente, documentar en `progress.md` y
  usar el partido con prórroga más cercano, dejando registrada la brecha (no bloquea el cierre de la feature, C-11
  ya usa un patrón similar de verificación con datos reales).
- Si F-11 aún no está integrado en la rama de trabajo al implementar C-06: usar el fallback D-2 del plan
  (`Game.competition` string) y dejar una nota en "Deuda / TODO" de `progress.md` para retirarlo cuando F-11 esté.
