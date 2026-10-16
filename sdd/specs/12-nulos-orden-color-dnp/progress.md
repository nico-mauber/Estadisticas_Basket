# Progress — Feature 12: nulos — orden, color y DNP

> Cierre de C-11 (`Smart-Basket Especificacion v2.docx` §1, P0). Continuación de Feature 08.

## Estado de tareas

### Grupo Z — Auditoría previa
- [x] **T-Z1** · Auditoría ejecutada **antes** de tocar código (decisión D-5 del plan). Ver §Auditoría.

### Grupo A — Backend: esquema
- [x] **T-A1** · N/A — sin cambio de esquema. `database.py` sin tocar en el diff.

### Grupo B — Backend: lógica y rutas
- [x] **T-B1** · `played(minutes) -> bool` · `backend/stats_engine.py`
- [x] **T-B2** · `player_stats`: `reb_share`/`oreb_share`/`dreb_share` → `None` · `backend/app.py`
- [x] **T-B3** · `player_stats`: campo `played` en cada entrada de `game_log` · `backend/app.py`
- [x] **T-B4** · `player_stats`: `_avg()` sobre `played_log` · `backend/app.py`
- [x] **T-B5** · `player_stats`: `games` = `len(played_log)` · `backend/app.py`
- [x] **T-B6** · `team_players`: `games`/`avg_uso`/`avg_pts` sobre jugados; `avg_uso` → `None` · `backend/app.py`
- [x] **T-B7** · `search_players`: `games`/`_avg_count`/`minutes` sobre jugados · `backend/app.py`

### Grupo C — Frontend: api.js
- [x] **T-C1** · N/A — `api.js` sin cambios en el diff.

### Grupo D — Frontend: UI
- [x] **T-D1** · `_cmpNullsLast(av, bv, dir)` · `frontend/js/app.js`
- [x] **T-D2** · `_sortedLeague` delega (8 líneas → 2)
- [x] **T-D3** · `_drawClutchTable` delega (elimina `-Infinity`)
- [x] **T-D4** · `_renderSearchResults` delega (elimina `-Infinity`)
- [x] **T-D5** · `cell()` de Cierres: rama `diff` null-safe
- [x] **T-D6** · `_computeAvg` filtra `played !== false`
- [x] **T-D7** · `charts.js` evolución: `?? 0` → `null` (4 datasets)
- [x] **T-D8** · `charts.js` `_norm`: `return 0` → `return null`

### Grupo E — Errores, estados vacíos, offline
- [x] **T-E1** · Caso borde jugador todo-DNP verificado (A. Hazan, T. Bentancour)
- [x] **T-E2** · `sw.js` sin cambios — sin assets nuevos
- [x] **T-E3** · Hallazgos de T-Z1 aplicados. Ver §Desviaciones (D-7).

### Grupo F — Verificación
- [x] **T-F1** · Backend arranca sin traceback
- [x] **T-F2** · N/A — sin cambio de esquema
- [x] **T-F3** · Los 3 endpoints tocados + 7 más probados con `test_client` y `curl`
- [x] **T-F4** · Consola sin errores JS nuevos
- [x] **T-F5** · CA-1…CA-12 recorridos ✅

## Auditoría T-Z1 (ejecutada antes de tocar código)

Barrido sistemático de patrones de fallback a cero (`else 0`, `?? 0`, `|| 0`, `-Infinity`) en
`backend/*.py` y `frontend/js/*.js`, más el recorrido de las 10 vistas.

| Vista | Estado | Hallazgos |
|---|---|---|
| Importar | ✅ limpia | — |
| Liga | ✅ limpia | `_sortedLeague` ya cumplía el orden de nulos (patrón de referencia) |
| Equipo | ⚠️ → corregida | `win_pct` con fallback a `0` |
| Cierres | ⚠️ → corregida | orden con `-Infinity`; celda `diff` sin guarda de nulo |
| Combinaciones | ✅ limpia | — |
| ON/OFF | ✅ limpia | — |
| Mapa de tiro (equipo y jugador) | ✅ limpia | — |
| Jugador | ⚠️ → corregida | `reb_share` a `0`; DNP en promedios y recuento; evolución con `?? 0`; radar con `_norm → 0` |
| Comparar | ⚠️ → corregida | **`N1`/`D1` renderizaban TODO nulo como `0`/`"0"`**; `rawRow`/`shootRow` pintaban ganador comparando nulos; 5 filas con `\|\| 0` |
| Buscador | ⚠️ → corregida | orden con `-Infinity`; `games`/`minutes` incluían DNP |

**Ruteados fuera de esta feature** (registrados, no parchados):
- `app.py` `league_overview` — fallback `{avg:0, best:0}` de los promedios de liga → **Feature 14 (C-02)**,
  spec §8. Es el origen del `Ø 0.0%` que reporta C-01.
- `stats_engine.py` sentinels `ast_to`/`def_to_ratio` = `99.0`/`inf` cuando no hay pérdidas →
  **deuda abierta de Feature 08**, spec §8. Verificado en la respuesta real: `"ast_to": 99.0`.

## Estado de CA (gate de aceptación)

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | Buscador, columna `uso_pct` ASC: cabeza `["0.0%","0.0%","0.0%"]`, cola `["—","—","—"]`. 9 nulos, todos al final. Antes del fix el `-Infinity` los ponía primeros |
| CA-2 | ✅ | Misma columna DESC: cabeza `["31.1%","24.9%","22.2%"]`, cola `["—","—","—"]` |
| CA-3 | ✅ | Cierres de HYM (2 filas) con `off_rating` nulo inyectado vía intercepción de `fetch` — ninguna fila de cierres de la base real tiene nulos. Click 1 → `["1.16","—"]`; click 2 → `["1.16","—"]`. Último en ambos sentidos |
| CA-4 | ✅ | Celda nula de Cierres: `className` vacío, sin `<span>` de color. Barrido global: 0 elementos con clase `above-avg`/`below-avg`/`winner`/`loser` cuyo contenido sea `"—"` |
| CA-5 | ✅ | Barrido de `td`/`.stat-value`/`.stat-context`/`p`/`span`/`th` en las 10 vistas contra `/\b(null\|NaN\|undefined\|Infinity)\b/`: **0 coincidencias** |
| CA-6 | ✅ | Verificado a nivel unitario (`t_trb = 0` → `reb_share=None`, `oreb=None`, `dreb=None`). Ningún partido de la base real tiene un equipo con 0 rebotes, así que el caso no es alcanzable end-to-end |
| CA-7 | ✅ | `GET /api/player/CNF/F. Pereira`: `games: 1` (antes 2), `averages.pts: 4.0` (antes 2.0). En UI: `PPT 4.00`, `FT% 50.0%` (1/2), todos del único partido jugado. Buscador columna `G`: `1` |
| CA-8 | ✅ | Mismo jugador: `len(game_log) == 2`. En UI el game log muestra las 2 filas — el DNP del 28/04 (0 pts, 0/0) sigue visible |
| CA-9 | ✅ | Verificado a nivel unitario: log de `[20:00 → 0 pts, 25:00 → 10 pts, 0:00 → 0 pts]` da 2 jugados y promedio `5.0`. El 0 de partido jugado cuenta; el DNP no |
| CA-10 | ✅ | `chart-player-evo` de F. Pereira, dataset OER: `[2.128, null]`. Antes: `[2.128, 0]` — caída falsa a cero |
| CA-11 | ✅ | Recorrido de las 10 vistas (Importar, Liga, Equipo, Jugador, Comparar, Buscador, Cierres, Combinaciones, ON/OFF, mapas de tiro): **0 hallazgos** de `0` falso o nulo coloreado |
| CA-12 | ✅ | Consola tras el recorrido completo: 1 error, el `404` de `favicon.ico` — preexistente y documentado en Feature 01. Cero errores JS de esta feature |

**Evidencia adicional (RF-9, no tiene CA propio):** `chart-player-radar` de F. Pereira reporta
`nulls: 3` — los tres ejes sin dato ya no se dibujan en el borde interior del radar.

## Gates técnicos

- Backend arranca sin traceback: ✅ (`python backend/app.py` sirviendo en `:5000`, `/api/me` → 200)
- `upgrade_db()` idempotente: **N/A** — sin cambio de esquema
- Endpoints probados manualmente: ✅ — los 3 tocados (`/api/player/*`, `/api/players/*`,
  `/api/search/players`) más `/api/team`, `/api/league`, `/api/teams`, `/api/games`, `/api/clutch`,
  `/api/shots`, `/api/competitions`, todos `200`. (`/api/lineup/CNF` → `400` sin `?players=`,
  comportamiento preexistente y correcto)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan

**D-7 · Comparar: la corrección fue mayor que lo previsto en plan §2.**
El plan listaba solo las 5 filas del desglose ofensivo (`|| 0` sobre `paint_pts` y compañía). La
auditoría destapó que los formateadores `N1` y `D1` de `renderCompare` convertían **todo** nulo en
`0`/`"0"` — es decir, el box score completo de Comparar, no 5 filas. Además `rawRow` (`va >= vb`) y
`shootRow` pintaban ganador/perdedor comparando nulos, que en JS coercionan a 0 y hacían "ganar"
siempre al lado A. Se agregó un helper `winCls(va, vb, lowerBetter)` que devuelve clase neutra si
falta cualquiera de los dos lados, y `shootRow` pasó a omitir el porcentaje cuando no hay dato en vez
de mostrar `(0%)`. Plan §2 actualizado. **Sin cambio de alcance**: sigue dentro de RF-3/RF-4/RF-10.

**D-8 · `win_pct` (`app.py` `team_stats`) entró por la auditoría.**
Tasa con denominador 0 cayendo a `0`. No estaba en plan §2. Cambio seguro y verificado: el frontend
ya renderizaba `win_pct == null` → `"—"` desde antes (`app.js` línea 144), así que el contrato ya
contemplaba el nulo y solo el backend no lo emitía.

**D-9 · El orden del roster (`team_players`) tuvo que volverse null-safe.**
Efecto colateral de T-B6: al pasar `uso_pct` de `0` a `None`, el `sort(key=..., reverse=True)`
existente levantaba `TypeError` al comparar `None` con `float`. Se reemplazó por una clave de tupla
que deja los nulos al final — la misma regla de RF-1, aplicada del lado del servidor.

**D-10 · CA-3 y CA-6 no son alcanzables con los datos reales de la base.**
Ninguna fila de cierres tiene un valor nulo, y ningún equipo tiene 0 rebotes en un partido. CA-3 se
verificó interceptando la respuesta de `/api/clutch/HYM` para inyectar un nulo (prueba de
comportamiento real sobre el render y el orden); CA-6 se verificó a nivel unitario sobre la expresión
exacta del endpoint. Se registra para que no se lea como cobertura end-to-end plena.

**D-11 · Se respeta la decisión D-2 del plan: el radar propaga el nulo.**
No hizo falta el fallback (dibujar el vértice al 50% con marca). Con 3 ejes nulos el polígono de
F. Pereira sigue siendo legible.

## Docs a actualizar

- [x] `docs/api.md` — cambio de contrato de los 3 endpoints de jugador: campo `played` en
  `game_log`, `games` = partidos jugados, `reb_share`/`oreb_share`/`dreb_share` y `uso_pct` admiten
  `null`, `win_pct` admite `null`
- [x] `docs/metrics.md` — `Reb Share` bajo la regla de nulo; regla DNP y su relación con Feature 08
- [x] `docs/frontend.md` — regla de orden de nulos en tablas ordenables + helper `_cmpNullsLast`

## Deuda / TODO

- **Evolución: el DNP dibuja `pts = 0`.** RF-8 cubre los nulos, y `pts` de un DNP es un `0` de
  conteo, no un nulo — así que el punto se dibuja en 0. Semánticamente el gráfico debería saltear el
  partido entero cuando `played === false`. Fuera del alcance literal del spec; decidir con el
  cliente si el DNP debe desaparecer de la serie o quedar como 0.
- **Sentinels `ast_to` / `def_to_ratio` (`99.0`, `inf`).** Siguen como deuda de Feature 08. `inf`
  además serializa a `Infinity`, que es JSON inválido en sentido estricto; hoy no llega a pantalla
  porque el valor real observado es `99.0`, pero conviene cerrarlo.
- **`plus_minus` ausente se guarda como `0`** (`app.py` `search_players`). La columna tiene
  `default=0` en el esquema, así que "no informado" y "cero real" son indistinguibles a nivel de
  datos. No es un bug de render: requiere cambio de esquema, fuera del alcance de C-11.
- **`app.js:159`, `app.js:425/463`, `app.js:848`** usan el recuento de partidos de **equipo**, que
  esta feature no tocó. Si alguna vez se aplica una regla análoga a equipos, revisar esos tres sitios.
