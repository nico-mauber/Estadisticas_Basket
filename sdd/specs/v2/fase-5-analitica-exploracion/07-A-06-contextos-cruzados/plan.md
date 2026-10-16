# Plan — A-06: Motor de contextos cruzados

> **ID:** A-06 · **Prioridad:** P2 · **Fase y orden:** 5·07
> **Depende de:** A-01 · A-02 · A-03 · A-04 · A-05 · T-02 · T-03 (y T-01, T-05, T-06, X-01, C-06, F-13) — rutas relativas en `spec.md` encabezado y §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §5.3 · A-06 · Arquitectura §3.6, §3.7, §3.8, §3.9, §3.14, §4 (`cross_context.py`), §6 (`GET /api/cross`), §7, §8
> **Estimación:** L · 12–18 h

## 1. Enfoque
Un único módulo dedicado **`backend/cross_context.py`** (NUEVO, DA-37: capa estadística sobre `stats_engine`, no persiste) con
`cross_matrix(team_code, dim_x, dim_y, metric_key, comp_id, ctx) -> dict` (firma fijada en Arq. §4). El motor trabaja en cuatro
pasos: (1) obtiene las posesiones del equipo con `possessions.team_possessions(team, comp, ctx, side)` (A-01, ya filtradas por el
contexto T-03); (2) las convierte en **unidades** (posesión u oportunidad) con sus conteos propios y del rival; (3) asigna a cada
unidad un valor por dimensión mediante un **registro de dimensiones** (una función `value_of` por dimensión, que lee los atributos
que ya dejaron A-01…A-05, C-06 y el quinteto/jugadores en cancha) y acumula conteos por celda, fila, columna y total; (4) calcula la
métrica por celda con `stats_engine.cross_rates` (regla 4), el badge/ajuste de T-02, el percentil de T-01 y la **verificación de
cuadre**. Los conteos por celda se cachean aparte de la métrica (`cache.memo("cross:cells")`), de modo que cambiar de métrica o
intercambiar ejes no recalcula las posesiones. Una ruta fina `GET /api/cross` (Arq. §6) sirve a la pestaña Contextos cruzados de S7
(`components/cross-matrix.js` + `views/explorar.js`). No hay cambios de esquema.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/cross_context.py` | module (NUEVO, Arq. §4) | `DIMENSIONS` (registro de 11 dimensiones), `PRESETS`, `cross_matrix`, `_units`, `_cells`, `_competition_percentiles`, `_matrix_percentiles`, `_check`, `cell_detail`, `table_rows` | RF-1…RF-19 |
| `backend/stats_engine.py` | module (extender) | `cross_rates(counts, *, unit)`: fórmulas de las 8 métricas por celda (regla 4) | RF-3, RF-13, RF-19 |
| `backend/possessions.py` | module (A-01/A-07) | `team_possessions(..., include_incomplete=True)` para contar las incompletas excluidas (parámetro PROPUESTO por A-07; si A-06 se implementa antes, se agrega aquí con el mismo contrato) | RF-18 |
| `backend/tables.py` | module (T-06, registrar) | `register_table("cross_cells", entity_type="split", …)` | RF-17 |
| `backend/app.py` | route | `GET /api/cross` (fina: valida parámetros, `parse_context`, delega en `cross_matrix`/`cell_detail`) | RF-1, RF-5, RF-16 |
| `frontend/js/api.js` | js-api | `api.cross(params)` | RF-1…RF-16 |
| `frontend/js/components/cross-matrix.js` | js-component (NUEVO, PROPUESTA de nombre) | `renderCrossMatrix(el, payload, {onCell, colorBasis})`: matriz con color, badge, totales, leyenda, verificación de cuadre | RF-6…RF-12 |
| `frontend/js/views/explorar.js` | js-view (X-01) | pestaña `contextos` de S7: selectores, chips de cruces, intercambio de ejes, detalle de celda, exportación | RF-1, RF-14, RF-15, RF-16, RF-17 |
| `frontend/js/charts.js` | — | sin cambios (la matriz es HTML/CSS, no Chart.js) | — |
| `frontend/css/style.css` | css | sección `/* ── cross-matrix (A-06) ── */` (celdas, gris, sticky, leyenda) | RF-6…RF-8 |
| `frontend/sw.js` | sw | sumar `js/components/cross-matrix.js` a `STATIC` y subir `CACHE` solo si X-01 no migró a runtime caching | — |
| `docs/api.md` | doc | `GET /api/cross`, tabla `cross_cells`, parámetros | cierre |
| `docs/metrics.md` | doc | definición de las dimensiones (cuarto, clutch, tramo, etc.), unidad oportunidad, cuadre, base del percentil | cierre |
| `docs/frontend.md` | doc | pestaña Contextos cruzados de S7 y su copy | cierre |
| `docs/architecture.md` | doc | módulo `cross_context.py` | cierre |

Matriz RF → archivo: RF-1 `cross_context.py`, `app.py`, `views/explorar.js` · RF-2 `cross_context.DIMENSIONS` · RF-3
`stats_engine.cross_rates` · RF-4 `cross_context._units` (`side`), `possessions.team_possessions` · RF-5 `app.py` (`parse_context`),
`cross_context.py` · RF-6/RF-7 `cross_context.py` + `sample.py` (consumo), `cross-matrix.js` · RF-8/RF-9 `cross_context._competition_percentiles`/
`_matrix_percentiles` + `population.py` (consumo), `core/colors.js` (consumo), `cross-matrix.js` · RF-10/RF-11 `cross_context._check` ·
RF-12 `cross_context._cells` (top-N + "Otros") · RF-13 `cross_context._units` (unidad oportunidad), `stats_engine.cross_rates` ·
RF-14 `cross_context.PRESETS`, `views/explorar.js` · RF-15 `views/explorar.js` · RF-16 `cross_context.cell_detail` +
`metrics_catalog.standard_payload` (consumo) · RF-17 `tables.py`, `cross_context.table_rows`, `export-menu.js` (consumo) · RF-18
`possessions.py`, `cross_context._cells` · RF-19 `stats_engine.cross_rates`, `cross-matrix.js`.

## 3. Backend — rutas y modelos

**Sin cambios de esquema** (Arq. §5). **Sin claves de configuración nuevas.**

### `GET /api/cross` — NUEVO (ruta y método fijados en Arq. §6; `login_required`)
- Query base (Arq. §6): `team=<team_code>` · `dim_x=<clave>` · `dim_y=<clave>` · `metric=<clave>` + contexto T-03 completo
  (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, `clock`, `clock_start`, `origin`, `ptype`,
  `chance`). **Parámetros extra (PROPUESTA de este plan):** `side=ataque|defensa` (default `ataque`), `limit=<int>` (N de quintetos/
  jugadores, default 8, rango 3–20), `color=competencia|matriz` (default `competencia`), `preset=<id>` (si viene, ignora
  `dim_x`/`dim_y`/`metric`/`side` salvo que se pasen explícitos), `cell_x=<valor>&cell_y=<valor>` (devuelve el detalle estándar de esa
  celda en vez de la matriz).
- Dimensiones (`dim_x` columnas, `dim_y` filas): `cuarto`, `clutch`, `tramo`, `origen`, `tipo`, `oportunidad`, `quinteto`, `jugador`,
  `finalizador` (PROPUESTA, §9.5 del spec), `sede`, `rival`. Métricas: `ppp`, `efg_pct`, `ts_pct`, `ppt`, `to_pct`, `or_pct`,
  `ft_rate`, `volumen`.
- Respuesta 200 (ejemplo abreviado: el real trae **todas** las celdas `x·y`; valores ilustrativos):
```json
{
  "team": {"code": "CNF", "name": "Nacional"},
  "side": "ataque",
  "unit": "posesion",
  "metric": {"key": "ppp", "label": "PPP", "fmt": "dec2", "direction": "higher"},
  "dims": {
    "x": {"key": "tramo", "label": "Tramo de reloj", "partition": true, "team_specific": false,
          "values": [{"key": "temprano", "label": "Temprano (0–8 s)"}, {"key": "medio", "label": "Medio (9–16 s)"},
                     {"key": "tardio", "label": "Tardío (17–24 s)"}, {"key": "sin_tiro", "label": "Sin tiro"}]},
    "y": {"key": "cuarto", "label": "Cuarto", "partition": true, "team_specific": false,
          "values": [{"key": "1", "label": "1.er cuarto"}, {"key": "2", "label": "2.º cuarto"},
                     {"key": "3", "label": "3.er cuarto"}, {"key": "4", "label": "4.º cuarto"}, {"key": "pr", "label": "Prórroga"}]}
  },
  "cells": [
    {"x": "temprano", "y": "1", "n": 41,
     "counts": {"pts": 47, "fga2": 22, "fgm2": 12, "fga3": 9, "fgm3": 3, "fta": 6, "ftm": 4, "tov": 2, "orb": 3, "opp_drb": 14},
     "value": 1.146, "reason": null,
     "adj": {"value": 1.06, "k": 20, "prior": 0.98, "band": 0.31},
     "pct": 74, "pct_basis": "competencia", "pct_reason": null,
     "sample": {"level": "alta", "unit": "posesiones", "n": 41, "min": 15, "high": 40, "min_source": "absoluto", "ranked": true}},
    {"x": "tardio", "y": "pr", "n": 4, "counts": {"pts": 2, "...": 0}, "value": 0.5, "reason": null, "adj": null,
     "pct": null, "pct_basis": "competencia", "pct_reason": "muestra_baja",
     "sample": {"level": "baja", "unit": "posesiones", "n": 4, "min": 15, "ranked": false}},
    {"x": "sin_tiro", "y": "pr", "n": 0, "counts": null, "value": null, "reason": "sin_intentos", "adj": null, "pct": null,
     "pct_basis": "competencia", "pct_reason": "sin_datos", "sample": {"level": "baja", "unit": "posesiones", "n": 0, "ranked": false}}
  ],
  "row_totals": [{"y": "1", "n": 212, "value": 1.02, "reason": null, "counts": {"...": 0}}],
  "col_totals": [{"x": "temprano", "n": 301, "value": 1.12, "reason": null, "counts": {"...": 0}}],
  "grand_total": {"n": 923, "value": 0.98, "reason": null, "counts": {"...": 0}},
  "check": {"ok": true, "mode": "particion", "n_cells": 923, "n_total": 923, "pts_cells": 905, "pts_total": 905,
            "fga_cells": 1301, "fga_total": 1301, "fta_cells": 232, "fta_total": 232, "multiplicity": null},
  "excluded": {"incomplete": 7, "games": {"sin_pbp": 0}, "sin_quinteto": 0},
  "color": {"basis": "competencia", "reason": null, "population": {"size": 12, "criterion": "equipos con ≥ 3 partidos"}},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {}, "ignored": [],
              "level": "posesion", "population_mode": "apply_all", "games_used": 13, "games_total": 13,
              "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "presets": [
    {"id": "tramo_origen", "label": "Tramo de reloj × origen", "question": "¿Aprovechamos las posesiones que empiezan con ventaja?",
     "dim_x": "tramo", "dim_y": "origen", "metric": "ppp", "side": "ataque"}
  ]
}
```
- **Con `cell_x`/`cell_y`:** `{"team": {...}, "cell": {"x": "temprano", "y": "1"}, "standard": <payload §7.3 entity.type "split">, "context": {...}}`.
- **Errores** (formato §7.8): 400 `parametro_invalido` "Elegí dos dimensiones distintas." (`dim_x == dim_y`) · 400 `parametro_invalido`
  "Dimensión inválida." / "Métrica inválida." / "El lado debe ser ataque o defensa." · 400 `contexto_invalido` (mensaje de
  `parse_context`) · 404 `no_encontrado` "No encontramos ese equipo." · 404 `sin_pbp` "Este equipo no tiene play-by-play importado.
  Reimportá sus partidos." · 401 sesión (handler global).

### `GET /api/table/cross_cells` — NUEVO (id PROPUESTA; `register_table`, T-06)
Params: `team`, `dim_x`, `dim_y`, `side`, `limit` + contexto + `base`. Una fila por celda con `n > 0`: `_name` ("Tramo temprano · 1.er cuarto"),
`_sample`, el conjunto estándar de T-05 completo y `link: null`. `default_columns = ["_name", "_sample", "possessions_counted", "ppp",
"efg_pct", "ts_pct", "ppt", "to_pct", "or_pct", "ft_rate"]`; `totals` = total general; `competition_avg` = no aplica (`avg_mode="none"`).

## 4. Backend — lógica

### 4.1 Registro de dimensiones (`DIMENSIONS`)
```
DimDef: key, label, partition: bool, team_specific: bool, fixed_values: tuple | None, value_of(unit, meta) -> str | list[str] | None
meta = {team, side, home_away_by_game, clutch_by_game, names_by_id, cfg: {early_max, mid_max}}
```
| Clave | Valores | partición | específica del equipo | `value_of(unit)` (lee…) |
|---|---|---|---|---|
| `cuarto` | `1`,`2`,`3`,`4`,`pr` | sí | no | `"pr"` si `p.period_type == "OVERTIME"` si no `str(p.period)` (mismos slugs que T-03 `quarter`; varias prórrogas → `pr`) |
| `clutch` | `cierre`,`resto` | sí | no | `_clutch_info(game_id)` + posición de la posesión (§4.2) |
| `tramo` | `temprano`,`medio`,`tardio`,`sin_tiro`,`sin_dato` | sí | no | banda del **último** tiro de campo de la unidad con `band` (A-05); sin tiro de campo → `sin_tiro`; tiros pero ninguna banda derivable → `sin_dato` |
| `origen` | los 7 de A-02 (`canasta_rival`,`rebote_defensivo`,`robo`,`perdida_rival`,`saque_banda`,`tiempo_muerto`,`tiro_libre_rival`) | sí | no | `p.origin` (A-02); `rebote_ofensivo` no es origen de posesión (DA-29: fila informativa fuera de la suma, ver §10) |
| `tipo` | `transicion`,`early`,`media_cancha` | sí | no | `p.ptype` (A-03) |
| `oportunidad` | `primera`,`segunda` | sí | no | `"primera"` si `c.n == 1` si no `"segunda"` (**unidad = oportunidad**) |
| `quinteto` | id `<team>:<pid>-…`, `sin_quinteto`, `otros` | sí | sí | quinteto del equipo analizado al inicio de la posesión: ataque `p.own_on_court`, defensa `p.opp_on_court`; `None` o ≠ 5 → `sin_quinteto` |
| `jugador` | `player_id`, `otros` | **no (solapada)** | sí | lista de `player_id` en cancha del equipo analizado al inicio (misma fuente que `quinteto`); `None` → no aporta a ninguna fila |
| `finalizador` | `player_id`, `sin_jugador`, `otros` | sí | sí | jugador que finaliza la unidad (§4.3) |
| `sede` | `local`,`visitante` | sí | no | `meta.home_away_by_game[game_id]` (desde `repository.competition_games(comp_id)`: `home_code == team` → `local`) |
| `rival` | `team_code`, `otros` | sí | sí | `p.opp` (ataque) / `p.team` (defensa) |

Las dimensiones **no específicas del equipo** y de partición (`cuarto`, `clutch`, `tramo`, `origen`, `tipo`, `oportunidad`, `sede`)
son las "universales" que permiten percentil frente a la competencia (RF-9). Etiquetas de `tramo` se arman con
`config.get("clock.early_max")`/`clock.mid_max` ("Temprano (0–{early_max} s)", "Medio ({early_max+1}–{mid_max} s)", "Tardío
({mid_max+1}–24 s)").

### 4.2 Clutch por posesión — `_clutch_info(game_id) -> (qualifies: bool, last_reg: int)` (memoizado `cross:clutch`)
```
evs        = repository.game_events(game_id)                                   # F-11
last_reg   = máx. period de eventos con period_type == "REGULAR"
window     = config.get("clutch.window_secs") ; margin = config.get("clutch.margin")        # F-13/C-06
qualifies  = clutch._entry_margin(evs, last_reg, window) <= margin              # función existente de clutch.py
```
`value_of_clutch(p)`: `"cierre"` si `qualifies` y `clutch._is_clutch({"period_type": p.period_type, "period": p.period,
"clock_secs": p.start_clock}, last_reg, window)` (función existente; reconoce `OVERTIME`/`OT`), si no `"resto"`. Se evalúa al **inicio**
de la posesión (decisión §9.3 del spec).

### 4.3 Unidades y conteos — `_units(team, comp_id, ctx, side, with_chances) -> (units, excluded)`
```
poss_all = possessions.team_possessions(team, comp_id, ctx, side=side, include_incomplete=True)
done     = [p for p in poss_all if not p.incomplete] ;  excluded.incomplete = len(poss_all) - len(done)
si no with_chances:  unidad = posesión → counts = {own: Σ p.box (RAW_KEYS), opp: Σ p.opp_box, n: 1, pts: p.pts, seconds: p.duration}
si with_chances:     unidad = (p, c) para cada c en p.chances → counts por oportunidad:
                       evs   = eventos del partido con c.start_event <= action_number <= c.end_event (bisect sobre repository.game_events)
                       own   = lineups._agg(evs, p.team) ; opp = lineups._agg(evs, p.opp) ; pts = c.pts ; n = 1
                       (OR% no se calcula: cross_rates devuelve no_aplica para unit="oportunidad")
```
`finalizador(unit)`: posesión → `p.finisher_id or p.turnover_by_id or último tiro de p.shots → player_id`; oportunidad → si
`c.end_event` coincide con un tiro de `p.shots` → su `player_id`; si no y `c` es la última oportunidad → el de la posesión; si no `None`
(→ `sin_jugador`). `tramo(unit)`: tiros de la unidad = `p.shots` con `action_number` entre `c.start_event` y `c.end_event` (oportunidad) o todos
(posesión); banda del último con `band is not None`.

### 4.4 `_cells(team, dx, dy, side, comp_id, ctx, limit) -> dict` (memoizado `cross:cells`, clave `(team, dx, dy, side, comp_id, context_key(ctx), limit)`)
```
with_chances = "oportunidad" in (dx, dy)
units, excluded = _units(...)
para unit en units:
    vx = DIMENSIONS[dx].value_of(unit, meta) ; vy = DIMENSIONS[dy].value_of(unit, meta)
    (los valores pueden ser listas: jugador) → producto cartesiano de valores
    cells[(vx, vy)] += counts ;  row[vy] += counts ; col[vx] += counts ;  grand += counts       # grand: UNA vez por unidad
    mult += len(vx_list) * len(vy_list)   # para el cuadre de dimensiones solapadas
top-N: para cada eje team_specific: ordenar valores por n total desc (empate: clave asc), conservar `limit`,
       el resto se reasigna a "otros" y se re-suma (los totales no cambian)
devolver {cells, row_totals, col_totals, grand, excluded, mult, values_x, values_y}
```
Los valores `fixed_values` de las dimensiones no específicas se devuelven siempre (celdas vacías con `n = 0`); los valores de
dimensiones específicas solo si tienen `n > 0` (más "otros" si corresponde). Cada celda guarda `counts = {own, opp, n, seconds}` completos
(RAW_KEYS), no un subconjunto: sirven para las 8 métricas y para el `StatBundle` del detalle.

### 4.5 `stats_engine.cross_rates(counts, *, unit) -> dict[str, {"value", "reason"}]` (regla 4)
Con `o = counts.own`, `r = counts.opp`, `n = counts.n`, `fga = o.fga2 + o.fga3`, `fgm = o.fgm2 + o.fgm3`:
```
ppp      = _safe_div(o.pts, n)                                        # puntos de las unidades / unidades contadas (= A-02 §4.3)
efg_pct  = _safe_div(fgm + 0.5 * o.fgm3, fga)
ts_pct   = _safe_div(o.pts, 2 * (fga + 0.44 * o.fta))
ppt      = _safe_div(2 * o.fgm2 + 3 * o.fgm3, fga)                    # puntos de campo / TCi (DA-03)
to_pct   = _safe_div(o.tov, n)                                        # pérdidas / unidades (glosario: pérdidas / posesiones)
or_pct   = _safe_div(o.orb, o.orb + r.drb)  si unit == "posesion" ; {"value": None, "reason": "no_aplica"} si unit == "oportunidad"
ft_rate  = _safe_div(o.fta, fga)
volumen  = n                                                           # entero; "Posesiones" u "Oportunidades" según unit
```
Denominador 0 → `{"value": None, "reason": "sin_intentos"}` (nunca 0). Fórmulas idénticas al glosario v2 §6 y a la conciliación §2.2
de la arquitectura; `o.pts` incluye los tiros libres de la unidad (como en A-02/A-04). Cociente de totales de la celda (DA-02).

### 4.6 Muestra, ajuste y gris (T-02)
Por celda: `sample = sample.sample_level("split", n=n, unit="posesiones", team_poss=team_total_poss, games=<partidos con n>)`;
`ranked = sample.is_ranked(badge)`. Solo PPP: `adj = sample.adjusted(ppp, n, prior, "split")` con `prior = possessions.ppp_stats(comp_id,
ctx)["mean"]` (A-01, PPP pooled de la competencia; con `side=defensa` el mismo prior); `adj.band` = `sample.band(n, "split", "ppp")`.
Celda con `ranked == false`: se devuelve con valor y `sample`, `pct = null`, `pct_reason = "muestra_baja"`, y se **excluye** de
`others` de cualquier percentil (RF-7).

### 4.7 Percentiles y color
**Dirección** (`_direction(metric, side)`): ataque → la de `metrics_catalog` (`ppp`, `efg_pct`, `ts_pct`, `ppt`, `or_pct`, `ft_rate`: higher;
`to_pct`: lower; `volumen`: neutral). Defensa (concedido): `ppp`, `efg_pct`, `ts_pct`, `ppt`, `or_pct`, `ft_rate`: **lower**; `to_pct`
(pérdidas del rival que provocamos): **higher**; `volumen`: neutral.
**Base `competencia`** (`_competition_percentiles`): válida si `color == "competencia"`, ambas dimensiones universales y
`context.population_mode(ctx) == "apply_all"`. Para cada equipo `t` de `population.population("team", comp_id, ctx).members` con
`in_population`: `_cells(t, dx, dy, side, …)` (sin límite) → valor de la celda `(vx, vy)` de `t` si su `sample.ranked`. Para la celda
del equipo analizado: `percentile(value_adj_o_crudo, others, direction)` y `rank` con las fórmulas de T-01 (`population.percentile`,
excluye al propio equipo). Si `len(others) + 1 < population.min_size` → `pct = null`, `pct_reason = "poblacion_insuficiente"`.
PPP usa el valor **ajustado** de cada celda (T-01 "valor ajustado").
**Base `matriz`** (`_matrix_percentiles`): para dimensiones específicas del equipo, contexto `entity_only` o `color=matriz`: `others` =
valores de las **demás celdas válidas** (`ranked`, valor no nulo) de la misma matriz; `pct_reason` `"contexto_no_comparable"` o
`"sin_universo"` informa por qué no se usó la competencia; `color.basis = "matriz"`.
Métrica `volumen` o dirección neutral: `pct = null` sin razón de error (sin color de rendimiento). El color lo aplica el frontend con
`percentileColor(pct)` (`core/colors.js`, T-01); `ranked == false` → gris fijo.

### 4.8 `_check(cells, grand, mult, partition_x, partition_y)` (RF-10, RF-11)
```
n_cells   = Σ cells.n ; pts_cells = Σ cells.own.pts ; fga_cells = Σ (fga2+fga3) ; fta_cells = Σ fta   (y los mismos del total)
si ambas dimensiones son partición:   ok = (n_cells == grand.n) y (pts_cells == grand.pts) y (fga_cells == grand.fga) y (fta_cells == grand.fta)
si alguna es solapada (jugador):      ok = (n_cells == mult) y pts_cells == Σ pts × multiplicidad (por unidad)   ; multiplicity = {expected, found}
en ambos casos: grand.n == len(units) (= total del equipo sin cruzar)
```
`check.ok == false` deja la matriz visible y la UI muestra "El cuadre no cierra: revisá posesiones incompletas." (ver spec §6);
la tarea de verificación lo trata como defecto.

### 4.9 `PRESETS` (RF-14)
| id | dim_x · dim_y | lado | métrica inicial | pregunta (copy) |
|---|---|---|---|---|
| `tramo_origen` | `tramo` · `origen` | ataque | `ppp` | "¿Aprovechamos las posesiones que empiezan con ventaja?" |
| `tramo_cuarto` | `tramo` · `cuarto` | ataque | `ppp` | "¿Nos precipitamos o nos atascamos al final del partido?" |
| `tipo_quinteto` | `tipo` · `quinteto` | ataque | `volumen` | "¿Qué combinación corre y cuál juega en estático?" |
| `segunda_finalizador` | `oportunidad` · `finalizador` | ataque | `ppp` | "¿Quién genera realmente los puntos extra?" |
| `transicion_concedida_quinteto` | `tipo` · `quinteto` | defensa | `volumen` | "¿Qué quinteto no equilibra atrás?" |
| `tramo_clutch` | `tramo` · `clutch` | ataque | `volumen` | "¿Cómo cambia la selección de tiro en los últimos cinco minutos de un partido igualado?" |
La métrica inicial de cada cruce es una decisión del plan (el cliente no la fija); el usuario puede cambiarla (RF-15).

### 4.10 `cell_detail(team, dx, dy, vx, vy, …) -> dict` y `table_rows(req)`
`cell_detail`: toma `counts` de `_cells`, arma `StatBundle(entity_type="split", entity_id=f"{team}:{dx}={vx}|{dy}={vy}", own=counts.own,
opp=counts.opp, games=<partidos de la celda>, seconds=counts.seconds, possessions_counted=counts.n)`, calcula
`stats_engine.compute_standard(bundle)` y devuelve `metrics_catalog.standard_payload(...)` (shape §7.3). Las métricas sin fuente por
posesión (`minutes`, `uso_*`, `pace`) salen `no_aplica`. `table_rows(req)`: una `TableRow` por celda con `n > 0` (bundle de `cell_detail`,
`sample_n` = `n`); `register_table("cross_cells", …)` con `avg_mode="none"`.

### 4.11 `cross_matrix(...)` — orquestación
```
validar dims/metric/side ; resolver preset ; team existe y tiene pbp (si no: 404 sin_pbp)
data   = _cells(team, dx, dy, side, comp_id, ctx, limit)
cells  = para cada (vx, vy) del producto de values_x × values_y:
            rates = stats_engine.cross_rates(counts, unit) ; value = rates[metric_key]
            sample/adj (§4.6) ; pct (§4.7) ; devolver el objeto del shape §3
totales = mismas métricas sobre row/col/grand (sin pct)
check = _check(...) ; context = context.context_echo(ctx, games_used, games_total, games_excluded, ignored)
cache.memo("cross:matrix", (… , metric_key, color), fn)         # LRU 64; versionado por data_version/config_version
```
### Manejo de nulos (C-11)
Celda sin unidades → `value: null`, `reason: "sin_intentos"`, `counts: null`. Denominador 0 → `sin_intentos`. OR% con oportunidad →
`no_aplica`. Partido sin pbp → fuera de la selección (`games_excluded.sin_pbp`). Posesión incompleta → excluida (`excluded.incomplete`).
Quinteto desconocido → `sin_quinteto` (no se descarta: así el cuadre cierra). `tramo` no derivable → `sin_dato`.

## 5. Frontend — capa API (api.js)
```js
cross: params => apiFetch(`/api/cross${qs(params)}`),        // {team, dim_x, dim_y, metric, side, limit, color, preset, cell_x, cell_y, ...contexto}
```
Reutiliza `api.table("cross_cells", params)` (T-06) y `api.contextOptions(...)` (T-03, lista de equipos). `qs()` omite vacíos. Ningún
`fetch` fuera de `api.js`.

## 6. Frontend — UI
- **Dónde:** S7 Explorar → pestaña `contextos` (`#/explorar/contextos?team=CNF&x=tramo&y=origen&metric=ppp&side=ataque&color=competencia&…`,
  `views/explorar.js`). X-01 la registra con `enabled: false`; A-06 la habilita con `registerTab("explorar", {slug: "contextos", …})`.
- **Selectores:** equipo (de `api.contextOptions().teams`), lado (chips Ataque/Defensa), dimensión X, dimensión Y (las 11 con su
  etiqueta; la otra se deshabilita), métrica (8), botón "⇄ Intercambiar ejes", selector de N (quintetos/jugadores) y base de color
  (Competencia / Esta matriz). **Chips de los 6 cruces** (de `payload.presets`).
- **Componente nuevo** `components/cross-matrix.js` → `renderCrossMatrix(el, payload, {onCell, colorBasis})`: tabla HTML con cabecera
  fija; cada celda muestra el valor (`fmtMetric`/`fmtNumber` es-UY) y, debajo, `n` y el badge (`sampleBadge(sample, {compact: true})`);
  fondo `percentileBg(pct)` (alpha 0,18; `core/colors.js`); celda BAJA gris fija con badge BAJA; nulo "—" con `title` de la razón
  (`nullDisplay`). Totales en fila y columna finales con estilo distinto; leyenda de la escala y de la base del color; indicador
  "Cuadra: Σ celdas = total (N)" o aviso de `check.ok == false`; nota de solapamiento cuando hay `jugador`.
- **Detalle de celda:** clic/tap → hoja (desktop: panel lateral; móvil: hoja inferior) con `renderStandardPanel` (T-05) del `standard`
  de `api.cross({…, cell_x, cell_y})`.
- **Cambio de métrica / intercambio de ejes sin recargar (RF-15):** el cambio de métrica vuelve a llamar a `api.cross` (los conteos están
  cacheados en el servidor; respuesta inmediata) y redibuja solo el componente; el intercambio de ejes intercambia `x`/`y` en el estado y
  llama a `api.cross`. El estado vive en el hash (`core/context.js` conserva el contexto; los parámetros de vista `team`, `x`, `y`, `metric`,
  `side`, `color`, `limit` van en el mismo query).
- **Exportación:** `exportMenu(el, {getData: () => ({meta, columns, rows}), getNode: () => matrixEl, formats: ["csv","xlsx","png","pdf"]})`
  (T-06): `getData` arma la matriz ancha (primera columna = fila; una columna por valor de X; totales al final) con `meta` que documenta
  equipo, competencia, filtros, lado, dimensiones, métrica y base de color; `getNode` exporta la vista como PNG/PDF. Debajo, "Ver todas las
  celdas" abre `createDataTable` con la tabla `cross_cells`.
- **Reutilizados (Arq. §8):** `sample-badge.js`, `standard-panel.js`, `export-menu.js`, `data-table.js`, `context-bar.js`,
  `core/colors.js`, `core/format.js`, `core/context.js`, `components/tabs.js`.
- **Copy:** español rioplatense directo (DA-21 resuelta en `../../00-decisiones.md`: sin `t()` hasta F-21); el copy nuevo queda listado en
  `docs/frontend.md`.
- **Estados:** loading, vacío, error, offline, éxito: tabla §6 del spec.
- **Mobile (<768 px):** selectores apilados; chips de cruces en dos filas con scroll interno; la matriz dentro de `.matrix-scroll`
  (overflow-x auto **solo del contenedor**), primera columna y cabecera `position: sticky`; el detalle como hoja inferior; sin scroll
  horizontal de página.

## 7. Navegación
Pestaña `contextos` de S7 `explorar` (Arq. §3.12). Parámetros de vista en el hash: `team`, `x`, `y`, `metric`, `side`, `color`, `limit`,
`preset` (no son contexto T-03; al cambiar de sección se descartan salvo el contexto). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/cross`: ejemplo completo en §3. Objetos de celda con `sample` §7.2; nulos §7.4; `context` §7.5; detalle §7.3.
- Tabla `cross_cells`: §7.6. Entidad de la celda: `split` (T-05/T-03), id `<team>:<dim_x>=<v>|<dim_y>=<v>` (PROPUESTA de formato).
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `parametro_invalido` | "Elegí dos dimensiones distintas." · "Dimensión inválida." · "Métrica inválida." · "El lado debe ser ataque o defensa." |
| 400 | `contexto_invalido` | mensaje de `parse_context` |
| 401 | — | handler global de `api.js` |
| 404 | `no_encontrado` | "No encontramos ese equipo." |
| 404 | `sin_pbp` | "Este equipo no tiene play-by-play importado. Reimportá sus partidos." |
| 429 | — | "Demasiadas solicitudes. Esperá un momento." (existente) |
| 5xx | — | "No se pudo armar la matriz." |
Offline: `/api/*` siempre a red; el módulo muestra "Sin conexión: el cruce de contextos necesita conexión." Un partido que falla al
reconstruirse se omite y se lista en `context.games_excluded` (`error_reconstruccion`). Si X-01 no migró a runtime caching,
`cross-matrix.js` se suma a `STATIC` y se sube `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **PROPUESTA — parámetros y shape de `/api/cross`:** Arq. §6 fija solo `team`, `dim_x`, `dim_y`, `metric` y "Ctx"; `side`, `limit`,
  `color`, `preset`, `cell_x`/`cell_y` y el shape son del plan. Reportado en huecos.
- **PROPUESTA — dimensión `finalizador`** (spec §9.5) y **tabla `cross_cells`** (spec §9.11): no figuran en Arq. §3.8/§6.
- **PROPUESTA — unidad oportunidad:** el contrato de T-03 declara `chance` de "nivel posesión"; A-04 ya propone el recorte a
  oportunidades. A-06 usa la misma unidad y cuenta los conteos desde eventos con `lineups._agg` (no depende de internals de A-04).
- **DA-29 / fila informativa del rebote ofensivo:** `rebote_ofensivo` no es un valor de la dimensión `origen` (Arq. §3.9); el efecto de los
  rebotes ofensivos se ve con la dimensión `oportunidad`. La fila informativa de A-02 no entra en la matriz (no es una posesión).
- **Coste de percentil frente a la competencia:** requiere calcular la misma matriz para cada equipo de la población (≈ 12 ×
  posesiones del equipo); se cachea por equipo (`cross:cells`) y por contexto; en frío ≈ 12 reconstrucciones ya cacheadas por
  `poss:game` (A-01). Si supera el objetivo, el plan permite degradar a `color=matriz` con aviso (CA-18 lo mide).
- **Tamaño de matriz:** hasta 11 × 11 = 121 celdas con top-N; con `limit` 20 en dos ejes específicos serían 21 × 21 = 441 (aceptable en
  HTML; paginación no necesaria).
- **Solapamiento de `jugador`:** cada posesión pertenece a 5 jugadores; los totales de columna no son la suma de filas (spec §9.4). Se
  documenta en `docs/metrics.md` y en la nota de la UI.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato en `cross_matrix(team_code, dim_x, dim_y, metric_key, comp_id, ctx)`;
  la firma se respeta (los parámetros `side`, `limit`, `color` se pasan como kwargs opcionales, PROPUESTA).
- **Dependencias técnicas:**
  - A-01 `Possession`, `team_possessions`, `ppp_stats`, `game_possessions` ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md)).
  - A-02 `Possession.origin` ([../../fase-3-contexto-posesion/02-A-02-origen-posesion/plan.md](../../fase-3-contexto-posesion/02-A-02-origen-posesion/plan.md)).
  - A-03 `Possession.ptype` ([../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/plan.md](../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/plan.md)).
  - A-04 `Chance` (`n`, `start_event`, `end_event`, `pts`) y el filtro `chance` ([../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/plan.md](../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/plan.md)).
  - A-05 `Possession.shots[].band` ([../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/plan.md](../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/plan.md)).
  - A-07 parámetro `include_incomplete` de `team_possessions` ([../06-A-07-produccion-desde-eventos/plan.md](../06-A-07-produccion-desde-eventos/plan.md)).
  - T-02 `sample.sample_level`, `adjusted`, `band`, `is_ranked` ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-03 `Context`, `parse_context`, `context_key`, `population_mode`, `context_echo` ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - T-01 `population.population`, `percentile` ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - T-05 `StatBundle`, `compute_standard`, `standard_payload` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-06 `register_table`, `export-menu.js`, `data-table.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - C-06 `clutch._is_clutch`, `clutch._entry_margin` y config de cierres vía F-13 ([../../fase-1-confiabilidad/05-C-06-umbral-cierres/plan.md](../../fase-1-confiabilidad/05-C-06-umbral-cierres/plan.md), [../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
  - F-11 `repository.game_events`, `repository.competition_games`, `cache.memo` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - X-01 `registerTab`, `views/explorar.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: L · 12–18 h** (registro de dimensiones y unidades 4–5 h; celdas, métricas, muestra/ajuste y cuadre 3–4 h; percentiles
  y color 2 h; ruta, tabla y presets 1–2 h; UI (matriz, selectores, detalle, exportación) 3–4 h; verificación sobre 13 partidos y docs
  1–2 h). Dentro del rango de la arquitectura (L 12–20 h).
