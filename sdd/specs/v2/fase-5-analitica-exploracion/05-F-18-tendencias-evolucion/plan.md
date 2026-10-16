# Plan — F-18: Tendencias y evolución configurable

> **ID:** F-18 · **Prioridad:** P2 · **Fase y orden:** 5·05
> **Depende de:** T-05 · T-06 (grafo del orquestador) · T-03 · T-02 · T-04 (grafo corregido de Arq. §9.1) — y T-01, F-13, C-11, X-01. Rutas relativas en `spec.md` encabezado y §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §4 · F-18 · Arquitectura §3.2, §3.5, §3.8, §3.11, §4 (`trends.py`), §6 (`GET /api/trends`), §7, §8
> **Estimación:** L · 12–18 h

## 1. Enfoque
Un módulo dedicado **`backend/trends.py`** (NUEVO, Arq. §4: `trend_series`, `recent_vs_rest`) arma la **serie partido a partido** de cualquier entidad (equipo, jugador, quinteto) sobre la
infraestructura de T-05/T-06: `metrics_catalog.load_game_bundles(req)` entrega cada partido con su `StatBundle`; `stats_engine.compute_standard` + `apply_base` (T-04) calculan **todas** las claves del conjunto estándar de
cada partido (se cachean juntas: cambiar de métrica no recalcula bundles); `stats_engine.sum_bundles` suma los partidos de "últimos N" y de "resto" para el **delta pooled** (DA-02); una prueba de **Welch**
(`stats_engine.welch_t_test`, Python puro) da la significancia sobre los valores por partido. Sobre la misma lista de partidos se derivan el gráfico de **diferencia de puntos** (métrica `plus_minus`), la **media móvil**
(promedio de los últimos *k* valores válidos) y los **hitos** (cortes de racha, ausencias de jugadores clave, local/visitante). Una ruta fina `GET /api/trends` (Arq. §6) devuelve todo en un solo payload. En el frontend,
un **único componente** `components/trend-chart.js` (selector de hasta 3 series, pares, media móvil, N, hitos, indicador de tendencia, exportación con el menú de T-06) reemplaza a `drawEvolution`/`drawPlayerEvolution`
y se monta en S3 Game log, S4 Tendencias y el detalle de quinteto de S3 Quintetos. Los gráficos nuevos viven en `charts.js` (`drawTrend`, `drawMargin`, plugin de hitos). Sin cambios de esquema.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/trends.py` | module (NUEVO, Arq. §4) | `trend_series`, `recent_vs_rest`, `trends_report` (orquestador), `_game_table` (valores por partido, cacheado), `_assign_axes`, `_moving_average`, `_margin_series`, `_streak_milestones`, `_absence_milestones`, `_key_players`, `_reference` | RF-1…RF-16 |
| `backend/stats_engine.py` | module (extender) | `welch_t_test(a, b) -> dict`, helpers `_betacf`, `_betainc` (regla 4: fórmulas estadísticas puras) | RF-7, RF-8 |
| `backend/metrics_catalog.py` | module (T-05/T-06, **consumir**) | `load_game_bundles(req)`; `METRICS` (fmt, direction, entities) | RF-1, RF-14 |
| `backend/config.py` | module (F-13, extender `CONFIG_SPEC`) | claves `trends.default_ma`, `trends.last_n`, `trends.alpha`, `trends.key_players`, `trends.streak_min` (sección Preferencias) | RF-6, RF-7, RF-9, RF-10, RF-18 |
| `backend/app.py` | route | `GET /api/trends` (fina: valida `entity`/`id`/`metrics`/`ma`/`last_n`, `parse_context`, `parse_base`, delega en `trends.trends_report`) | RF-1, RF-14 |
| `frontend/js/api.js` | js-api | `api.trends(params)` | RF-1…RF-18 |
| `frontend/js/components/trend-chart.js` | js-component (NUEVO, PROPUESTA de nombre) | `renderTrendChart(el, {entityType, entityId, viewParams})`: selector de series, pares, media móvil, N, toggles, gráficos, tarjetas de tendencia, lista de hitos (móvil), exportación; `destroy()` | RF-1…RF-18 |
| `frontend/js/charts.js` | js-chart | **nuevos** `drawTrend(canvasId, payload, opts)`, `drawMargin(canvasId, payload)`, plugin `milestonesPlugin`; **eliminar** `drawEvolution` y `drawPlayerEvolution` al migrar las vistas | RF-2, RF-4, RF-5, RF-6, RF-9, RF-13, RF-15, RF-16 |
| `frontend/js/views/equipo.js` | js-view (X-01) | pestaña `gamelog`: componente (entidad `team`) encima de la tabla de game log; pestaña `quintetos`: "Evolución del quinteto" (entidad `lineup`) cuando hay quinteto seleccionado (`?lineup=<id>`) | RF-11, RF-13 |
| `frontend/js/views/jugador.js` | js-view (X-01) | pestaña `tendencias`: componente (entidad `player`) | RF-11, RF-13 |
| `frontend/js/app.js` | js-view (legado) | quitar el import y las llamadas a `drawEvolution`/`drawPlayerEvolution` y las cards "Evolución por partido" (si X-01 aún no las movió) | RF-13 |
| `frontend/css/style.css` | css | sección `/* ── trend-chart (F-18) ── */` (selector, chips, tarjetas de tendencia, lista de hitos, mobile) | RF-1…RF-9 |
| `frontend/sw.js` | sw | sumar `js/components/trend-chart.js` a `STATIC` y subir `CACHE` solo si X-01 no migró a runtime caching | — |
| `docs/api.md` | doc | `GET /api/trends`, claves de configuración | cierre |
| `docs/metrics.md` | doc | media móvil, delta pooled, prueba de Welch, "jugador clave", racha, diferencia de puntos | cierre |
| `docs/frontend.md` | doc | componente de evolución; **quitar** `drawEvolution`/`drawPlayerEvolution` de la tabla de charts (l.96–97) y agregar `drawTrend`/`drawMargin`; copy nuevo | cierre |
| `docs/architecture.md` | doc | módulo `trends.py`; función `welch_t_test` | cierre |

Matriz RF → archivo: RF-1/RF-3 `trends.py`, `metrics_catalog.py` (consumo), `trend-chart.js` · RF-2 `trends._assign_axes`, `charts.drawTrend` · RF-4 `trends._reference` + `population.league_reference` (T-01, consumo),
`charts.drawTrend` · RF-5 `trends._margin_series`, `charts.drawMargin` · RF-6 `trends._moving_average`, `charts.drawTrend` · RF-7/RF-8 `trends.recent_vs_rest`, `stats_engine.welch_t_test`, `sample.py` (consumo), `trend-chart.js` ·
RF-9/RF-10 `trends._streak_milestones`, `_absence_milestones`, `_key_players`, `charts.milestonesPlugin` · RF-11/RF-12/RF-13 `trend-chart.js`, `equipo.js`, `jugador.js`, `app.js` · RF-14 `app.py`, `trends.py`
(`context`/`base`) · RF-15 `trends._game_table`, `charts.drawTrend` · RF-16 `trends._game_table` (`sample`), `charts.drawTrend` · RF-17 `trend-chart.js` + `export-menu.js` (T-06, consumo) · RF-18 `config.py`.

## 3. Backend — rutas y modelos

**Sin cambios de esquema** (Arq. §5). Claves de configuración nuevas (en `CONFIG_SPEC`; `app_config` solo guarda overrides), sección **Preferencias**, consumidor F-18:
| Clave | Tipo | Default | Rango | Origen |
|---|---|---|---|---|
| `trends.default_ma` | enum 3\|5\|10 | 5 | — | Arq. §3.2 |
| `trends.last_n` | int | 5 | 2–20 | Arq. §3.2 |
| `trends.alpha` | float | 0.05 | 0.01–0.2 | **PROPUESTA** (no está en la tabla de Arq. §3.2) |
| `trends.key_players` | int | 5 | 1–10 | **PROPUESTA** |
| `trends.streak_min` | int | 3 | 2–10 | **PROPUESTA** |

### `GET /api/trends` — NUEVO (ruta y parámetros base fijados en Arq. §6) · `login_required`
- Query: `entity=team|player|lineup` · `id=<team_code | player_id | <team>:<pid>-<pid>-…>` · `metrics=<k1,k2,k3>` (1–3 claves del catálogo; ausente → defaults del par `oer,der` para team/lineup y `pts,oer` para player) · `ma=3|5|10|0` (default `trends.default_ma`; `0` = sin media) ·
  `last_n=<int>` (**PROPUESTA**, default `trends.last_n`, 2–20) + contexto T-03 completo (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`; en fase 5 también las dimensiones de posesión,
  que filtran los partidos) + `base` (T-04: `total|partido|por40|por100`, default `partido` para esta vista).
- Respuesta 200 (equipo; valores ilustrativos, abreviados a 4 partidos de 17):
```json
{
  "entity": {"type": "team", "id": "CNF", "name": "Nacional", "team_code": "CNF"},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {}, "ignored": [],
              "level": "partido", "population_mode": "apply_all", "games_used": 17, "games_total": 17,
              "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "base": "partido", "ma": 5, "last_n": 5,
  "defaults": {"ma": 5, "last_n": 5, "alpha": 0.05, "streak_min": 3, "key_players": 5},
  "metrics": [
    {"key": "oer", "label": "OER", "fmt": "dec2", "direction": "higher", "scale": "ratio", "axis": "y"},
    {"key": "der", "label": "DER", "fmt": "dec2", "direction": "lower", "scale": "ratio", "axis": "y"}
  ],
  "axes": {"y": {"scale": "ratio", "label": "OER · DER"}, "y2": null},
  "games": [
    {"i": 0, "game_id": "2849328", "date": "2025-10-04", "opponent_code": "PEN", "opponent": "Peñarol", "home_away": "L",
     "team_pts": 84, "opp_pts": 78, "result": "W", "margin": 6, "played": true, "sample": null},
    {"i": 1, "game_id": "2849331", "date": "2025-10-11", "opponent_code": "TRO", "opponent": "Trouville", "home_away": "V",
     "team_pts": 71, "opp_pts": 75, "result": "L", "margin": -4, "played": true, "sample": null}
  ],
  "series": [
    {"key": "oer",
     "points": [{"i": 0, "value": 1.09, "reason": null, "ma": null}, {"i": 1, "value": 0.97, "reason": null, "ma": null},
                {"i": 2, "value": 1.12, "reason": null, "ma": null}, {"i": 3, "value": 1.03, "reason": null, "ma": null}],
     "reference": {"value": 1.07, "reason": null}},
    {"key": "der", "points": [{"i": 0, "value": 1.01, "reason": null, "ma": null}], "reference": {"value": 1.07, "reason": null}}
  ],
  "margin": {"metric": "plus_minus",
             "points": [{"i": 0, "value": 6, "reason": null, "result": "W"}, {"i": 1, "value": -4, "reason": null, "result": "L"}]},
  "trend": [
    {"key": "oer", "last_n": 5, "recent": {"value": 1.118, "games": 5}, "rest": {"value": 1.052, "games": 12},
     "delta": 0.066, "delta_oriented": 0.066, "delta_rel": 0.0627,
     "test": {"name": "welch", "t": 1.92, "df": 7.9, "p": 0.091, "alpha": 0.05},
     "significance": "no_significativa", "verdict": "sin_cambio_significativo", "reason": null,
     "sample": {"level": "media", "unit": "partidos", "n": 5, "min": 3, "high": 10, "min_source": "absoluto", "games": 5, "ranked": true}}
  ],
  "milestones": [
    {"type": "streak_end", "i": 9, "game_id": "2849349", "label": "Fin de racha de 4 victorias", "streak": {"result": "W", "length": 4}},
    {"type": "absence", "i": 4, "game_id": "2849335", "label": "Ausente: S. Canty", "players": [{"player_id": 812, "name": "S. Canty"}]}
  ],
  "key_players": [{"player_id": 812, "name": "S. Canty", "minutes": 412.5}],
  "presets": [
    {"id": "pts_vs_pts_against", "label": "Puntos anotados frente a recibidos", "metrics": ["pts", "pts_against"]},
    {"id": "oer_vs_der", "label": "OER frente a DER", "metrics": ["oer", "der"]},
    {"id": "efg_vs_to", "label": "eFG% frente a TO%", "metrics": ["efg_pct", "to_pct"]}
  ]
}
```
- **Jugador (`entity=player`)**: `games[*].played = false` y `series[*].points[*].reason = "dnp"` en los DNP; `margin.metric = "plus_minus"` del jugador (nulo `no_registrado` si la competencia no lo publica); `key_players` excluye al propio jugador;
  `entity.team_code` agrega el equipo de la ficha.
- **Quinteto (`entity=lineup`, id `<team>:<pid>-…`)**: `games` incluye **todos** los partidos del equipo en la selección; los partidos donde el quinteto no jugó traen `reason: "sin_datos"`; `games[*].sample` = badge T-02 de quinteto
  (`level`, `n`) del partido; `series[*].reference` = `{"value": null, "reason": "sin_universo"}`.
- **Errores** (formato §7.8): 400 `parametro_invalido` "Elegí hasta tres métricas." · "Métrica inválida: {clave}." · "Las métricas elegidas tienen más de dos escalas distintas." · "La media móvil debe ser 3, 5, 10 o 0." · "Indicá entity y id." ·
  400 `contexto_invalido` (mensaje de `parse_context`) · 404 `no_encontrado` "No encontramos esa entidad." · 404 `sin_pbp` "Esta entidad no tiene play-by-play importado. Reimportá sus partidos." (solo `lineup` y métricas de posesiones)
  · 401 sesión (handler global).

### Familias de escala para los ejes (`_assign_axes`)
| `scale` | `fmt` del catálogo |
|---|---|
| `pct` | `pct` |
| `ratio` | `dec2`, `signed_dec2` |
| `count` | `int`, `signed_int`, `dec1` |
Una familia → un eje (`y`); dos → `y` (la de la primera métrica) e `y2`; tres → 400.

## 4. Backend — lógica

### 4.1 `_game_table(entity_type, entity_id, comp_id, ctx, base) -> dict` (cacheado `cache.memo("trends:games", (…, context_key(ctx), base))`)
```
games_bundles = metrics_catalog.load_game_bundles(EntityRequest(entity_type, entity_id, comp_id, ctx, base))   # T-06 §4.3: [(game_dict, StatBundle)], ordenado por fecha asc
para (g, b) en games_bundles:
    values = stats_engine.compute_standard(b)           # TODAS las claves del conjunto estándar (nulos con razón)
    values = stats_engine.apply_base(values, b, base)   # T-04
    result = "W" si g.team_pts > g.opp_pts, "L" si <, None si faltan
    margin = g.team_pts − g.opp_pts                      # resultado del partido (para el color)
    sample = (lineup) sample.sample_level("lineup", n=values["possessions"].value, unit="posesiones") sin umbral relativo (team_poss=None) ; si no None
    played = g.played                                    # jugador: False = DNP → values nulos con razón "dnp" (C-11)
tabla = {games: [...], values: [ {clave: {value, reason}} por partido ], bundles: [...] }              # los bundles quedan para sum_bundles (no se serializan)
```
- Equipo: `load_game_bundles` de `team`; jugador: del `player` (DNP incluidos con `played = false`); quinteto: del `lineup` **más los partidos del equipo sin el quinteto** (el loader de F-06 devuelve solo
  los que jugó; `trends` completa la lista con `repository.competition_games` filtrado por equipo y `context.filter_games`, con `values` nulos `sin_datos`).
- Los `StatBundle` por partido de `lineup` provienen del loader `lineup` de F-06 (`all_lineups` por partido); ver §10 para la alternativa si el loader no expone la serie por partido.

### 4.2 `trend_series(entity_type, entity_id, metric_keys, comp_id, ctx, ma) -> dict` (firma Arq. §4)
```
valida metric_keys (1..3, ∈ METRICS) ; ma ∈ {0, 3, 5, 10}
tabla = _game_table(...)
series = []
para key en metric_keys:
    pts = [{i, value, reason} para cada partido: v = tabla.values[i][key]]      # clave no aplicable a la entidad → reason "no_aplica" (la clave existe en values por T-05)
    pts = _moving_average(pts, ma)                                              # agrega `ma` a cada punto
    series.append({key, points: pts, reference: _reference(entity_type, entity_id, key, comp_id, ctx, base)})
axes = _assign_axes(metric_keys)
margin = _margin_series(tabla)                                                  # métrica plus_minus por partido + result
devolver {metrics: [...], axes, games, series, margin, ...}
```
**`_moving_average(points, k)`**: `k == 0` → `ma = None` en todos. Si no: recorre los puntos en orden; mantiene la lista de los últimos `k` valores **válidos** (value no nulo); el `ma` del punto `i` es el
promedio simple de esa lista **si el punto `i` tiene valor y la lista tiene `k` elementos**, si no `None`. (Un partido sin valor no recibe `ma`; la ventana lo salta.) Redondeo a 4 decimales; fórmula de visualización,
no una tasa (spec §9.4).

**`_margin_series(tabla)`**: `value = tabla.values[i]["plus_minus"]` (equipo: `pts − pts_against`; jugador: Σ `sPlusMinusPoints`; quinteto: `pts − pts_against` en cancha); `result` = el del partido (color). Nulo
con razón (p. ej. `no_registrado`, `dnp`, `sin_datos`) → barra ausente.

**`_reference(entity_type, entity_id, key, comp_id, ctx, base)`**: equipo y jugador → `population.league_reference(entity_type, comp_id, ctx, base=base)[key]` (T-01; media de las entidades de la población, DA-08;
el parámetro `base` es PROPUESTA de T-06 §4.3 sobre `league_reference`); quinteto → `{"value": None, "reason": "sin_universo"}`; `competition=all` → `sin_universo`.

### 4.3 `recent_vs_rest(entity_type, entity_id, metric_keys, comp_id, ctx, last_n, base) -> list[dict]` (firma Arq. §4 con parámetros explícitos)
```
tabla = _game_table(...)                                                       # mismo universo que la serie (ctx.last ya aplicado)
idx_validos(key) = [i para i en partidos si tabla.values[i][key].value no es None]
para key en metric_keys:
    idx = idx_validos(key) ; recent = idx[-last_n:] ; rest = idx[:-last_n]
    si len(recent) < 3 o len(rest) < 3: devolver {key, recent/rest con games, delta: None, significance: None, verdict: None, reason: "muestra_insuficiente"}
                                         (si rest está vacío por N ≥ partidos: reason "sin_datos")
    rb = stats_engine.sum_bundles([bundle[i] para i en recent]) ; sb = sum_bundles([... rest])
    v_recent = apply_base(compute_standard(rb), rb, base)[key].value ; v_rest = idem(sb)         # COCIENTE DE TOTALES por grupo (DA-02)
    delta = v_recent − v_rest ; s = +1 si direction == "higher", −1 si "lower", 0 si "neutral"
    delta_oriented = s·delta (None si neutral) ; delta_rel = delta/|v_rest| (None si v_rest == 0)
    test = stats_engine.welch_t_test([values por partido de recent], [values por partido de rest])
    alpha = config.get("trends.alpha")
    significance = "significativa" si test.p < alpha, si no "no_significativa"
    verdict = (significativa) "mejora" si delta_oriented > 0, "empeora" si < 0, "cambio" si neutral ; (no significativa) "sin_cambio_significativo"
    sample = sample.sample_level("team", n=min(len(recent), len(rest)), unit="partidos", games=len(recent) + len(rest))      # PROPUESTA: umbrales de partidos de T-02 (3/10) para la comparación
```
- Para claves de **conteo** (p. ej. `pts`) el valor por grupo en base `partido` es el promedio por partido (pooled = Σ/partidos); en `total`, la suma del grupo (no comparable entre grupos de tamaño distinto: el
  sistema fuerza la comparación en base `partido` cuando la base pedida es `total`, y lo informa en `trend[*].base_used`).
- Valores de claves `null` en un partido (reason) no entran a ningún grupo (RF-8, C-11).

### 4.4 `stats_engine.welch_t_test(a: list[float], b: list[float]) -> dict` (regla 4, Python puro)
```
n1, n2 = len(a), len(b) ; si n1 < 2 o n2 < 2: {"t": None, "df": None, "p": None, "reason": "muestra_insuficiente"}
m1, m2 = media(a), media(b) ; v1, v2 = varianza muestral (n−1) de a y b ; se1 = v1/n1 ; se2 = v2/n2
si se1 + se2 == 0: {"t": 0.0 si m1 == m2 si no None, "df": n1+n2−2, "p": 1.0 si m1 == m2 si no 0.0}      # varianza nula: caso borde explícito
t  = (m1 − m2)/√(se1 + se2)
df = (se1 + se2)² / (se1²/(n1−1) + se2²/(n2−1))                                                           # Welch–Satterthwaite
p  = I_x(df/2, 1/2)  con x = df/(df + t²)                                                                  # dos colas: P(|T| ≥ |t|)
I_x(a, b) = betainc regularizada: bt = exp(lgamma(a+b) − lgamma(a) − lgamma(b) + a·ln x + b·ln(1−x)) ;
            si x < (a+1)/(a+b+2): bt·betacf(a,b,x)/a si no 1 − bt·betacf(b,a,1−x)/b                          # (Lentz, máx. 200 iteraciones, ε = 3e-12)
```
Se verifica contra valores tabulados (p. ej. `t = 2,0`, `df = 10` → `p ≈ 0,0734`; `t = 1,0`, `df = 5` → `p ≈ 0,3632`) en la tarea de verificación.

### 4.5 Hitos
**`_streak_milestones(games, streak_min)`**: recorre `result` en orden; cuenta la racha corriente (`W` o `L`); cuando cambia el resultado y la racha previa tenía longitud `≥ streak_min`, agrega
`{"type": "streak_end", "i": <partido que corta>, "label": "Fin de racha de {n} victorias|derrotas", "streak": {result, length}}`. Partidos sin `result` cortan la racha sin hito.

**`_key_players(team_code, comp_id, ctx, exclude_player_id)`**: `rows = repository.player_game_rows(comp_id)` del equipo en los partidos de la selección; minutos totales por `player_id` (solo `played`); ordena por minutos desc
(empate: nombre) y toma `config.get("trends.key_players")` (excluyendo al jugador de la entidad si `entity == "player"`).

**`_absence_milestones(games, key_players, rows)`**: para cada jugador clave, `idx_jugados` = índices de los partidos de la serie donde jugó; `first, last = min, max`; ausencias = índices `i` en `[first, last]` que no están en `idx_jugados`
(sin fila o DNP). Agrupa por partido: `{"type": "absence", "i", "label": "Ausente: A, B", "players": [...]}`.

Local/visitante: no es un hito aparte; `games[*].home_away` ("L"/"V") se dibuja como marca del eje (spec §9.7).

### 4.6 `trends_report(entity_type, entity_id, metric_keys, comp_id, ctx, ma, last_n, base) -> dict`
Orquesta `_game_table`, `trend_series`, `recent_vs_rest`, hitos, `key_players`, `presets`, `defaults` y `context_echo(ctx, games_used, games_total, games_excluded, ignored)`. Entidad inexistente → 404; entidad sin partidos en la selección →
`games: []` (el frontend muestra "No hay partidos para graficar.").

### Manejo de nulos (C-11)
Partido sin valor → punto `value: null` con razón (`dnp`, `sin_intentos`, `sin_datos`, `sin_perdidas`, `no_registrado`, `sin_pbp`, `no_aplica`); nunca 0. La media móvil y los grupos del indicador excluyen nulos. DNP/quinteto ausente = hueco.
`margin` nulo → barra ausente. Referencia sin universo → `sin_universo`. Indicador con grupo < 3 → `muestra_insuficiente`. Varianza nula → caso borde de §4.4 (p = 1 o 0), nunca división por cero.

## 5. Frontend — capa API (api.js)
```js
trends: params => apiFetch(`/api/trends${qs(params)}`),    // {entity, id, metrics, ma, last_n, base, ...contexto}
```
`qs()` omite vacíos. Ningún `fetch` fuera de `api.js`. Reutiliza `api.metricsCatalog()` (T-05, ya cargado por `core/catalog.js`) para poblar el selector con grupos, etiquetas y `entities`.

## 6. Frontend — UI
- **Componente `components/trend-chart.js`** → `renderTrendChart(el, {entityType, entityId, viewParams}) -> {destroy()}`:
  1. **Estado** (`metrics[]` ≤ 3, `ma`, `lastN`, `showMa`, `showRef`, `showMilestones`, `showMargin`): inicial desde los parámetros de vista del hash (`tm`, `ma`, `tn`), si no, desde `payload.defaults` del primer pedido.
  2. **Selector de series**: hasta 3 selectores desplegables agrupados por `GROUPS` del catálogo (solo claves cuyo `entities` incluye la entidad), botón "Quitar", **chips de pares** (`payload.presets`), selector de media móvil (3 · 5 · 10 · Sin media), campo N (2–20) e interruptores (Media móvil, Referencia, Hitos, Diferencia de puntos).
     Al elegir una tercera métrica de una escala distinta de las dos presentes, el componente la deshabilita con el aviso "Las métricas elegidas tienen más de dos escalas distintas." (validación en cliente; el backend también valida).
  3. **Cambio sin recargar (RF-12):** cada cambio dispara `api.trends(...)` y redibuja **solo** el componente (destruye y recrea las instancias de Chart.js con `_destroy`, conserva el estado); se invalida con un contador `_renderSeq` para ignorar respuestas viejas; el estado se refleja en el hash (`replaceState` de los parámetros de vista `tm`, `ma`, `tn`, sin tocar el contexto T-03).
  4. **Gráfico principal** (`charts.drawTrend`): hasta 3 líneas crudas (línea fina, puntos), media móvil de cada serie (línea gruesa punteada del mismo color), referencia de liga (línea punteada gris), ejes `y`/`y2` con títulos del payload, hitos con el plugin
     (líneas verticales y marcadores; "L"/"V" bajo cada punto), tooltip con fecha, rival, L/V, resultado, valor y razón del hueco; partidos con `sample.level == "baja"` (quinteto) como puntos huecos.
  5. **Gráfico de diferencia de puntos** (`charts.drawMargin`): barras por partido, verde (`W`) / roja (`L`), línea de cero resaltada, tooltip con marcador.
  6. **Tarjetas de tendencia** (una por métrica): "Últimos {N}: {valor} · Resto: {valor} · Δ {delta con signo} ({delta_rel %})", sentido ("Mejora" / "Empeora" / "Cambio" / "Sin cambio significativo"), significancia ("Diferencia significativa (p = {p})") y `sampleBadge`;
     nulo `muestra_insuficiente` en gris con el copy de la spec.
  7. **Lista de hitos** (móvil <768 px: debajo del gráfico; desktop: tooltip del marcador).
  8. **Exportación:** `exportMenu(menuEl, {getData, getNode: () => contenedor, formats: ["png", "pdf", "csv"]})`; `getNode` incluye ambos `<canvas>` (el exportador los convierte en imágenes, T-06 §6.2); `getData` arma `meta` (entidad, competencia, filtros, base,
     métricas con etiquetas, media móvil, N, fecha) y `columns`/`rows` = una fila por partido (`fecha`, `rival`, `L/V`, `resultado`, y por serie `valor` y `media móvil`).
- **Gráficos (`charts.js`)**: `drawTrend(canvasId, payload, {showMa, showRef, showMilestones})` y `drawMargin(canvasId, payload)`. Colores: series con la paleta existente (`C.accent`, `C.blue`, `C.green`); victoria `C.green`, derrota `rgba(239,68,68,1)` (rojo
  de la escala T-01). Etiquetas del eje X = `MM-DD`. Formato de números es-UY (`fmtNumber`). Se reutilizan `_destroy` y `_applyDefaults` existentes.
- **Montaje:** S3 `gamelog` (equipo; encima de la tabla de game log de T-06), S4 `tendencias` (jugador) y S3 `quintetos` → "Evolución del quinteto" dentro del detalle del quinteto seleccionado (`#/equipo/<code>/quintetos?lineup=<id>`, F-06).
- **Reutilizados (Arq. §8):** `export-menu.js`, `exporters.js`, `sample-badge.js`, `core/catalog.js`, `core/format.js`, `core/context.js` (`getContext`, `onContextChange` → recarga del componente), `components/context-bar.js`, `components/collapsible.js` (panel de hitos en móvil).
- **Copy:** español rioplatense directo (DA-21 resuelta en `../../00-decisiones.md`: sin `t()` hasta F-21); el copy nuevo queda listado en `docs/frontend.md`.
- **Estados:** loading, vacío, error, offline y éxito según spec §6.
- **Mobile (<768 px):** selectores apilados; chips y selector de media con scroll interno; el gráfico a ancho completo con altura 220 px; tarjetas de tendencia en una columna; hitos en lista; sin scroll horizontal de página.

## 7. Navegación
Sin sección ni pestaña nueva: `gamelog` de S3, `tendencias` de S4 y el detalle de quinteto de `quintetos` (X-01, Arq. §3.12). Parámetros de vista en el hash: `tm=<k1,k2,k3>`, `ma=<0|3|5|10>`, `tn=<N>` (no son contexto T-03; no se descartan al cambiar de pestaña
dentro de la misma entidad). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/trends`: ejemplo completo en §3; `sample` §7.2, nulos §7.4, `context` §7.5.
- `trend[*].test = {name: "welch", t, df, p, alpha}`; `significance ∈ {significativa, no_significativa}` o `null` con `reason`; `verdict ∈ {mejora, empeora, cambio, sin_cambio_significativo}` o `null`.
- `milestones[*].type ∈ {streak_end, absence}`; `games[*].home_away ∈ {"L","V"}`.
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `parametro_invalido` | "Elegí hasta tres métricas." · "Métrica inválida: {clave}." · "Las métricas elegidas tienen más de dos escalas distintas." · "La media móvil debe ser 3, 5, 10 o 0." · "Indicá entity y id." |
| 400 | `contexto_invalido` | mensaje de `parse_context` |
| 401 | — | handler global de `api.js` |
| 404 | `no_encontrado` | "No encontramos esa entidad." |
| 404 | `sin_pbp` | "Esta entidad no tiene play-by-play importado. Reimportá sus partidos." |
| 429 | — | "Demasiadas solicitudes. Esperá un momento." (existente) |
| 5xx | — | "No se pudo armar la evolución." |
Offline: `/api/*` siempre a red; el componente muestra "Sin conexión: la evolución necesita conexión." Si X-01 no migró a runtime caching, `trend-chart.js` se suma a `STATIC` en `sw.js` y se sube `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **PROPUESTA — claves `trends.alpha`, `trends.key_players`, `trends.streak_min`:** Arq. §3.2 solo define `trends.default_ma` y `trends.last_n` para F-18; sin estas tres, el umbral de significancia, la definición de "clave" y el largo de racha quedarían fijos en el código (contra F-13/T-02).
  Reportado en huecos.
- **PROPUESTA — parámetro `last_n` y `base_used` de `GET /api/trends`** (Arq. §6 fija `entity`, `id`, `metrics`, `ma`): necesarios para el indicador (N configurable) y para informar el forzado a base `partido` cuando se pide `total`.
- **Dependencia de T-06 §4.3 (PROPUESTA de T-06):** `metrics_catalog.load_game_bundles` y `stats_engine.sum_bundles` no están en la arquitectura. T-06 los propone y los cita para F-18; si T-05 expone otro nombre, F-18 usa ese. **Alternativa** si el loader de `lineup` (F-06) no expone la serie por partido:
  `trends._lineup_game_bundles` arma un bundle por partido con `lineups.build_segments` (F-06 ya cachea `lineups:<team>`) filtrando los tramos del quinteto; se documenta como riesgo y se decide al implementar.
- **Prueba de significancia:** Welch sobre valores por partido es aproximada para tasas (no normales) y para N chicos; se informa el p-valor y se advierte en `docs/metrics.md`; no hay corrección por comparaciones múltiples (hasta 3 indicadores). Alternativa descartada: prueba de permutación exacta
  (costo mayor, mismo resultado práctico) y `scipy` (dependencia nueva, regla 2).
- **Delta pooled vs prueba por partido:** el delta mostrado es de cociente de totales (DA-02, consistente con T-01) y el p-valor sale de los valores por partido; pueden discrepar levemente en tasas con partidos de volumen muy distinto. Se documenta.
- **Base `total`:** comparar totales de grupos de tamaño distinto no tiene sentido; el indicador fuerza `partido` y lo informa.
- **Ausencias derivadas del box:** un jugador sin fila en el partido o con DNP se cuenta como ausente dentro de su rango de actividad; puede incluir decisiones técnicas (no solo lesiones). Se rotula "Ausente" sin causa.
- **Quinteto por partido con muestra mínima:** el umbral de muestra del partido usa el mínimo absoluto de T-02 (`sample.lineup.min`), sin umbral relativo (no tiene sentido por partido).
- **Retiro de gráficos fijos:** `drawEvolution`/`drawPlayerEvolution` se eliminan solo al migrar las dos vistas (CA-20); hasta entonces conviven. La línea "OER liga Ø" se conserva como referencia (RF-4).
- **Rendimiento:** `_game_table` calcula todas las claves por partido una vez (≈ 17–33 partidos) y se cachea por entidad/contexto/base; cambiar de métrica no recalcula bundles. Quinteto: costo del loader por partido (cacheado por `lineups:<team>`).
- **Desviaciones respecto de la arquitectura:** ninguna de contrato en `trend_series`/`recent_vs_rest` (la firma `(...)` de Arq. §4 se concreta con `last_n` y `base`) ni en `GET /api/trends`; las PROPUESTAS anteriores son agregados.
- **Dependencias técnicas:**
  - T-05 `StatBundle`, `compute_standard`, `METRICS`/`GROUPS`, `register_entity` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-06 `load_game_bundles`, `sum_bundles`, `export-menu.js`, `exporters.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - T-04 `apply_base`, `parse_base` ([../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/plan.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/plan.md)).
  - T-03 `Context`, `parse_context`, `filter_games`, `context_echo` ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - T-02 `sample.sample_level` ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-01 `population.league_reference` ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - F-13 `CONFIG_SPEC`, `config.get` ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
  - F-06 loader `lineup`, enlace `?lineup=` ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)).
  - F-11 `repository.competition_games`, `repository.player_game_rows`, `cache.memo` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - C-11 DNP como hueco ([../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/plan.md](../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/plan.md)).
  - X-01 `registerTab`, `views/equipo.js`, `views/jugador.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: L · 12–18 h** (`trends.py` y serie por partido 3–4 h; Welch, media móvil, indicador y hitos 3–4 h; ruta y configuración 1–2 h; componente y gráficos (selector, ejes, plugin de hitos, margen, tarjetas, exportación) 4–5 h; migración de las vistas y retiro de los gráficos fijos 1 h;
  verificación sobre 13 partidos y docs 1–2 h). Arquitectura §9.1: L 10–16 h; +2 h por la prueba estadística y los hitos de ausencia.
