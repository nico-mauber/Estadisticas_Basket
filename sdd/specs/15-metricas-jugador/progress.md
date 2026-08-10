# Progress — Feature 15: métricas de jugador

> Cierre de C-01 y C-04 (`Smart-Basket Especificacion v2.docx` §1, P0/P1).

## Estado de tareas

- [x] **T-A1** · N/A — sin cambio de esquema
- [x] **T-B1** · `as_pos`, `tov_pos`, `pts_pos` · `backend/stats_engine.py`
- [x] **T-B2** · `orb_min`, `drb_min` desde `_parse_minutes` · `backend/stats_engine.py`
- [x] **T-B3** · Parámetro `opp` + `or_pct`/`dr_pct`/`trb_pct` individuales · `backend/stats_engine.py`
- [x] **T-B4** · `season_ast_to(ast, tov)` · `backend/stats_engine.py`
- [x] **T-B5** · 5 claves nuevas en `league_averages`; `tov_pos` en `lower_is_better`
- [x] **T-B6** · `player_stats`: `opp` + AS/PER acumulado + claves nuevas en `keys`
- [x] **T-B7** · `team_stats`: AS/PER acumulado de equipo
- [x] **T-B8** · `search_players`: `opp` derivado de `team_rows` + claves nuevas + AS/PER acumulado
- [x] **T-B9** · `team_players`: `opp` vía `_opp_for`
- [x] **T-C1** · N/A — `api.js` sin cambios
- [x] **T-D1** · `as_pos` agregado a `NOT_PCT`
- [x] **T-D2** · Card "Por posesión y por minuto" con las 5 métricas
- [x] **T-E1**, **T-E2**, **T-E3** · Ver §CA y §Gates
- [x] **T-F1** a **T-F5** · Ver §Gates y §CA

## Diagnóstico previo (respuesta a la pregunta de C-01)

C-01 pregunta si el `"—"` de OR%/DR% es *"dato faltante o error de cálculo"*.
**Respuesta: dato faltante.** `calc_player_stats` nunca incluía `or_pct`, `dr_pct` ni `trb_pct` en el
dict que devolvía; la UI los pedía y recibía `undefined`. El `Ø 0.0%` que acompañaba el reporte era un
bug distinto, ya corregido en la **Feature 14**.

Y los cinco indicadores de C-01 **no existían con ningún nombre**: `RO/min` y `RD/min` no tenían
análogo alguno — ninguna métrica de la app era por minuto. Confirmado por el cliente (2026-08-10):
son métricas nuevas a agregar, no existentes mal etiquetadas.

## Estado de CA (gate de aceptación)

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | Perfil de C. Zinaich: `AS/pos 0.15` (Ø 0.31), `PER/pos 0.07` (Ø 0.19), `PTS/pos 1.23` (Ø 1.16), `RO/min 0.10` (Ø 0.04), `RD/min 0.27` (Ø 0.12). Ninguno `"—"` |
| CA-2 | ✅ | `F. De Leon`, partido 2820500: jugó con `possessions = 0` → `as_pos: null`, y `orb_min` con valor. Unitario: 0 posesiones y 10 min → los 3 por-posesión `None`, `drb_min = 0.2` |
| CA-3 | ✅ | `F. Pereira`: partido jugado → `as_pos 0.5319`; partido DNP → `as_pos: null`, `orb_min: null`. `averages.orb_min` sale solo del partido jugado |
| CA-4 | ✅ | `C. Zinaich`, partido 2820499: `RO/min` manual = 2 ÷ 21.0833 = **0.0949**; la API devuelve **0.0949** |
| CA-5 | ✅ | Mismo perfil: `OR% 11.3%` y `DR% 23.9%` con valor y con `Ø` (4.0% y 11.8%). Antes ambos `"—"` |
| CA-6 | ✅ | `OR%` manual = (2×40) ÷ (21.0833×(14+26)) = **0.0949** → API **0.0949**. `DR%` manual = (6×40) ÷ (21.0833×(33+25)) = **0.1963** → API **0.1963** |
| CA-7 | ✅ | `B. Weatherspoon`: AST=3, TOV=5 → acumulado **0.6**. El promedio de los ratios por partido daría **1.125** (casi el doble). La API devuelve **0.6** |
| CA-8 | ✅ | CNF: AST=31, TOV=23 → `averages.ast_to = 1.3478` = 31/23. Mismo criterio acumulado que en jugador |
| CA-9 | ✅ | `A. Ibarguen`, `A. Mendez`, `B. Barrera` (0 pérdidas en la temporada): `ast_to: null` → UI `"—"`, no `99.0` ni `Infinity` |
| CA-10 | ✅ | Consola tras recorrer Equipo, perfil de jugador y Buscador: **0 errores** |

## Gates técnicos

- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: **N/A** — sin cambio de esquema
- Endpoints probados manualmente: ✅ — `/api/player`, `/api/players`, `/api/search/players`,
  `/api/team`, `/api/league`, todos `200` con los campos nuevos
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan

**D-1 · La población de liga de jugadores necesitó equipo y rival, no previsto en plan §4.**
El plan hacía pasar `opp` en las tres rutas que calculan **la ficha consultada**, pero el bucle que
construye la **población de liga** (agregado en la Feature 14) seguía llamando
`calc_player_stats(pp, team_pos=0)` sin `team` ni `opp`. Resultado: `or_pct` del jugador tenía valor
pero su `Ø` de liga era `None`. Se agregaron los mapas `all_team_rows` y `game_len` a `player_stats`
para alimentar también esa población. Sin consultas extra: dos `query.all()` que ya se hacían.

**D-2 · `PTS/pos` reusa la variable `oer`, no la recalcula** (spec §9, plan D-2). Verificado:
`averages.pts_pos == averages.oer`. Dos etiquetas, una fuente.

**D-3 · `as_pos` cayó en la trampa de `isPct`, como anticipó el plan (D-6).**
`"as_pos".includes("as_")` es verdadero, así que sin la exclusión un AS/pos de `0.15` se habría
mostrado como `15.0%`. Es la segunda vez que se paga la fragilidad del heurístico que la Feature 14
dejó documentada — ver §Deuda.

**D-4 · El sentinel `99.0` sobrevive en el `game_log`** (spec §8, plan D-4). RF-8 corrigió el valor
**de temporada**, que es el visible en la card. El `ast_to` por partido del `game_log` conserva el
sentinel. No se grafica hoy; si alguna vez se hace, mostrará picos de 99.

## Docs a actualizar

- [x] `docs/metrics.md` — las 5 fórmulas nuevas, la fórmula individual de rebote, la equivalencia
  `PTS/pos ≡ OER` y el criterio acumulado de AS/PER
- [x] `docs/api.md` — campos nuevos y cambio de semántica de `ast_to`
- [x] `docs/frontend.md` — card "Por posesión y por minuto"; `as_pos` en `NOT_PCT`

## Deuda / TODO

- **El heurístico `isPct` de `statBox` sigue siendo frágil** y ya obligó a dos parches (`def_to_ratio`
  en la Feature 14, `as_pos` acá). Lo correcto es declarar el formato junto a cada métrica en vez de
  inferirlo del nombre. Cada métrica nueva cuyo nombre contenga `pct`, `or_`, `dr_`, `to_` o `as_` sin
  ser porcentaje volverá a romperlo.
- **`def_to_ratio` arrastra el mismo problema que tenía AS/PER**: se calcula por partido y se promedia.
  Debería ser acumulado de temporada como AS/PER. C-04 no lo pide, así que quedó fuera de alcance —
  pero es la misma clase de error, ya corregida al lado.
- **Los 5 indicadores nuevos no tienen percentil ni umbral de muestra** (T-01/T-02). Un jugador con
  3 minutos puede encabezar `RO/min` con una muestra que no significa nada.
- **`or_pct` de liga (4.0%) parece bajo** pero es correcto: es el promedio individual sobre todas las
  fichas-partido, y cada jugador captura una porción chica del rebote disponible. No confundir con el
  `OR%` de **equipo**, que ronda 29%. Son métricas distintas con el mismo nombre — vale la pena
  distinguirlas en la UI si genera confusión con el cliente.
