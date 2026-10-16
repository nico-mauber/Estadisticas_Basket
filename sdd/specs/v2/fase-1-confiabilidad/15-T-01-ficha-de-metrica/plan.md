# Plan — T-01: Ficha de métrica: valor, ranking y distancias

> **ID:** T-01 · **Prioridad:** P0 · **Fase y orden:** Fase 1 · 15
> **Depende de:** C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md)) · C-08 ([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md)) · F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)) · T-05 ([../13-T-05-conjunto-estandar-metricas/plan.md](../13-T-05-conjunto-estandar-metricas/plan.md)) · T-02 ([../14-T-02-confiabilidad-muestra/plan.md](../14-T-02-confiabilidad-muestra/plan.md)) · F-13 ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md))
> **Habilita:** T-06, C-03, A-12, F-05, F-08, F-06, F-17, F-03, F-14, A-09, A-10
> **Estado:** ✅ Aprobado
> **Fuente:** [spec.md](spec.md) · Especificación v2 §3 · T-01 · Arquitectura §2.1, §3.6, §3.8, §3.14, §7.1, §7.1b, §8, §9.2 I-08/I-12
> **Estimación:** XL · 24–34 h

## 1. Enfoque
1. **Cálculo único en `backend/population.py`** (creado por C-02 con `population()` y `league_reference()` sin umbrales). T-01 cambia su camino por defecto a `apply_thresholds=True`, construye cada miembro con las **mismas funciones que muestran el valor**
   (`stats_engine.compute_standard` + `apply_base("partido")` de T-05, badge y ajustado de T-02), y agrega `rank`, `percentile`, `ficha`, `attach_fichas`, `full_ranking` con las fórmulas de la arquitectura §3.6.
2. **La ficha viaja con el valor.** El orquestador de T-05 (`metrics_catalog.build_payload`) tiene un enganche marcado para la ficha: el payload de `GET /api/metrics/<tipo>` y los bloques `standard` de equipo y jugador salen con los campos de la ficha. El ranking completo
   sale por un endpoint propio (`GET /api/rankings/...`) que se pide solo al pasar el cursor o tocar.
3. **Enumeración por tipo de entidad.** Equipo y jugador reutilizan los enumeradores de T-05; quinteto (`lineups.all_lineups` de T-02), ON/OFF y cierre se enumeran con tres funciones nuevas en `bundles.py`, una sola pasada por equipo.
4. **Coherencia con Liga.** `GET /api/league` se alimenta de la misma población (cociente de totales) y devuelve posición y percentil por celda; con `include=summary` también promedio y líder de cada columna.
5. **Frontend:** `core/colors.js` (escala), `components/metric-card.js` (ficha en tarjeta y en fila, hover/hoja inferior), reemplazo de `statBox` con `Ø` en Equipo y Jugador, columna `#`/percentil/pie en Liga, y el panel estándar de T-05 pasa a usar la ficha.
6. **Caché.** Las poblaciones se memorizan por versión de datos y de configuración (Arq. §3.14). F-11 difirió `cache.py`; si al implementar no existe se crea con la firma de la arquitectura (§10 D-2).

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/population.py` | module (mod.; lo crea C-02) | `population(..., apply_thresholds=True)`, `league_reference`, `rank`, `percentile`, `ficha`, `attach_fichas`, `full_ranking`, `Population`/`Member` | RF-1…RF-13, RF-16, RF-18 |
| `backend/cache.py` | module (NUEVO **condicional**, Arq. §3.14) | `get_versions`, `bump_data_version`, `bump_config_version`, `memo`, `clear` + tabla `app_meta` (solo si no existe al empezar) | RF-13 (rendimiento) |
| `backend/metrics_catalog.py` | module (mod., dueño T-05) | enganche de fichas en `build_payload`; `enumerate(entity_type, comp_id, ctx, variant)` y `set_enumerator` | RF-1, RF-16, RF-19 |
| `backend/bundles.py` | module (mod., dueño T-05) | `all_lineup_bundles`, `all_onoff_bundles`, `all_clutch_bundles`; registro de sus enumeradores | RF-10, RF-13 |
| `backend/lineups.py` | module (mod.) | `all_onoff_bundles(games, team_code)` (una pasada por equipo: ON y OFF de todos los jugadores) | RF-10 |
| `backend/config.py` | module (mod., dueño F-13) | `population.min_size`, `sample.team.min/high`, `sample.player.min/high` pasan a `status: "activa"` (si T-02 no las activó) | RF-10, RF-12 |
| `backend/app.py` | route | `GET /api/rankings/<entity_type>/<metric_key>`; `GET /api/league` (población, `rank`, `pct`, `include=summary`); `bump_data_version` en los puntos de escritura que falten | RF-14, RF-17 |
| `backend/ingest.py`, `backend/competitions.py`, `backend/identity.py` (C-08) | module (mod. mínima) | auditoría: toda escritura de datos llama `cache.bump_data_version` (si faltaba) | RF-13 |
| `frontend/js/core/colors.js` | js-core NUEVO | `percentileColor(p)`, `percentileBg(p, alpha)` | RF-8 |
| `frontend/js/components/metric-card.js` | js-component NUEVO | `metricCard(key, metricObj, opts)`, `bindMetricCards(el, opts)`, popover/hoja del ranking | RF-1…RF-3, RF-6, RF-11, RF-14, RF-15, RF-18, RF-19 |
| `frontend/js/components/standard-panel.js` | js-component (mod., T-05) | `cellHTML` usa `metricCard` en layout "row" | RF-1, RF-19 |
| `frontend/js/api.js` | js-api | `api.ranking(type, metric, params)`; `api.league(comp, {summary})` | RF-14, RF-17 |
| `frontend/js/app.js` | js-view | Equipo y Jugador: `statBox` → `metricCard` con `std.metrics`; Liga: `#`, percentil, atenuado, pie; `statBox` sin `Ø`; Ø del mapa de liga | RF-15, RF-17 |
| `frontend/js/charts.js` | js-chart | `drawLeagueScatter` acepta `axis.avgX/avgY` (promedio de la población) | RF-17 |
| `frontend/css/style.css` | css | `/* ── metric-card (T-01) ── */`: tarjeta, chip de percentil, `.fuera-poblacion`, popover, hoja inferior | RF-3, RF-8, RF-14 |
| `frontend/sw.js` | sw | `STATIC` += `/js/core/colors.js`, `/js/components/metric-card.js`; `CACHE` al entero siguiente | RF-14 |
| `docs/metrics.md` | doc (cierre) | "Ficha de métrica": población, ranking, percentil, distancias, color; promedio de liga = media de entidades | RF-3…RF-9 |
| `docs/api.md` | doc (cierre) | `/api/rankings`, campos de la ficha, `/api/league` | RF-14, RF-17 |
| `docs/frontend.md` | doc (cierre) | `metric-card`, `colors.js`, retiro de `Ø`; **corrige** la mención de `_colorCell` (no existe; Arq. §1.5 D-04) | RF-15 |
| `docs/architecture.md` | doc (cierre) | `population.py`, `cache.py`, enumeradores | RF-1 |

**Matriz RF → archivo:** RF-1 (population, metrics_catalog, metric-card) · RF-2 (metric-card) · RF-3 (population `rank`, metric-card) · RF-4 (population `ficha`) · RF-5 (population `league_reference`) · RF-6 (population, metric-card) ·
RF-7 (population `percentile`) · RF-8 (colors.js, css) · RF-9 (population, metrics_catalog) · RF-10 (population, bundles, lineups, config) · RF-11 (population, metric-card) · RF-12 (population) · RF-13 (population, cache, ingest/competitions/identity) ·
RF-14 (app.py, api.js, metric-card, css) · RF-15 (app.js, metric-card) · RF-16 (population, T-02) · RF-17 (app.py, app.js, charts.js) · RF-18 (population, metric-card) · RF-19 (population, metric-card, standard-panel). Sin RF huérfanos.

## 3. Backend — rutas y modelos
Sin tablas ni columnas nuevas (excepto `app_meta` solo si `cache.py` no existe: tabla `app_meta(key TEXT PK, value TEXT)` por `create_all`, con `data_version` y `config_version` en 1; arquitectura §5).

### 3.1 Campos de la ficha en `GET /api/metrics/<tipo>` y en `standard` (modificado; Arq. §7.1)
Cada objeto de `metrics[clave]` conserva `value`/`reason` de T-05 y agrega (ejemplo `GET /api/metrics/team?id=VER&competition=1&last=5`, con `sample.team.min = 2` y 12 equipos calificados; valores ilustrativos):
```json
"oer": {
  "value": 0.966, "reason": null,
  "rank": 9, "rank_total": 12, "tied": false, "in_population": true,
  "percentile": 27,
  "avg": 1.0112, "dist_avg": -0.0452, "dist_avg_rel": -0.0447,
  "leader": {"id": "OMU", "name": "OMU", "value": 1.1502},
  "dist_leader": -0.1842, "dist_leader_rel": -0.1601,
  "pct_reason": null, "basis": null
},
"pts": {
  "value": 149, "reason": null, "rank": 7, "rank_total": 12, "tied": false, "in_population": true, "percentile": 41,
  "avg": 78.2, "dist_avg": -3.7, "dist_avg_rel": -0.0473, "leader": {"id": "OMU", "name": "OMU", "value": 86.5}, "dist_leader": -12.0, "dist_leader_rel": -0.1387,
  "pct_reason": null, "basis": "partido"
},
"blk_received": {"value": null, "reason": "no_registrado", "rank": null, "rank_total": null, "tied": false, "in_population": true, "percentile": null,
                 "avg": null, "dist_avg": null, "dist_avg_rel": null, "leader": null, "dist_leader": null, "dist_leader_rel": null, "pct_reason": null, "basis": null}
```
`basis = "partido"` marca los conteos/volumen mostrados en totales (el ranking y las distancias están en por partido, RF-18; en `pts` el valor `149` es el total y `avg`/`dist_*` están en por partido). Sin población: `rank`, `percentile`, `avg`, `leader`, `dist_*` en `null` y `pct_reason ∈ {"sin_universo",
"poblacion_insuficiente", "contexto_no_comparable"}`. `adj` y `sample` (T-02) se conservan; si hay `adj`, `rank`/`percentile`/`avg`/`leader` son del ajustado.

### 3.2 `GET /api/rankings/<entity_type>/<metric_key>` — NUEVO · `login_required`
| Param | Valor | Notas |
|---|---|---|
| `id` | id de la entidad a resaltar (formato de `GET /api/metrics`) | opcional; sin él, ninguna fila queda resaltada |
| `competition`, `last` | contrato de C-02 | mismos que usó la ficha |
| `base` | `total` \| `partido` | se acepta por coherencia con la ficha; el ranking de conteos/volumen es siempre por partido (`rank_basis`) |

Response 200 (Arq. §7.1b + `rank_basis`, `reason`; ilustrativo):
```json
{"entity_type": "team", "metric": "oer", "direction": "higher", "rank_basis": null,
 "population": {"size": 12, "criterion": "equipos con ≥ 2 partidos", "competition_id": 1, "context_label": "Últimos 5 partidos", "reason": null},
 "rows": [
   {"rank": 1, "tied": false, "id": "OMU", "name": "OMU", "value": 1.1502, "in_population": true, "highlight": false},
   {"rank": 9, "tied": false, "id": "VER", "name": "VERDIRROJO", "value": 0.966, "in_population": true, "highlight": true}
 ],
 "outside_population": [{"id": "LBO", "name": "LBO", "value": 1.21, "hypothetical_rank": 1, "highlight": false, "sample": {"level": "baja", "unit": "partidos", "n": 1, "ranked": false}}],
 "avg": 1.0112}
```
`rows` ordenadas por `rank` y luego nombre; empates comparten `rank` y llevan `tied: true`. Valores nulos no aparecen en `rows` (no se rankean). `competition=all` o población vacía → 200 con `rows: []`, `population.size: 0` y `population.reason`.
Errores (`{"error", "code"}`): 400 `parametro_invalido` ("Tipo de entidad desconocido" / "Métrica desconocida" / "La métrica no aplica a este tipo de entidad"), 400 `competencia_inexistente`, 400 `contexto_invalido`, 401.

### 3.3 `GET /api/league` — modificado
Mantiene su ruta, los parámetros (`competition`) y las claves de fila (`team_code, team_name, games, wins, losses, table_points, pts_for, pts_against, standings_pos, oer, der, net_rating, efg_pct, ts_pct, or_pct, dr_pct, to_pct, pace, pts, stl`), con dos cambios:
1. Los valores `oer…stl` salen de la población de equipos (cociente de totales, base por partido para `pts`/`stl`); `to_pct` es TO% = PER/POS (DA-04). Cada fila agrega `in_population` (bool), `rank` (`{clave: {"rank": 3, "total": 12, "tied": false}}`) y `pct` (`{clave: p}`) para las 11 claves.
2. `include=summary` devuelve `{"teams": [...filas...], "avg": {clave: v}, "leaders": {clave: {"id","name","value"}}, "population": {"size","criterion","context_label","reason"}}`. Sin el parámetro, lista (sin cambio de forma).
Errores: sin cambios (400 competencia inexistente). Los equipos fuera de la población siguen en la lista con `in_population: false` y sus `rank`/`pct` hipotéticos.

## 4. Backend — lógica

### 4.1 Estructuras y enumeración
```
@dataclass Member:  id, name, values: dict[str, float|None], sample: dict|None, in_population: bool, games: int, team_code: str|None
@dataclass Population: entity_type, comp_id, ctx_key, variant, members: list[Member], criterion: str, context_label: str, reason: str|None
population(entity_type, comp_id, ctx, *, apply_thresholds=True, variant=None) -> Population      # cacheado: cache.memo("pop:"+entity_type, (comp_id, context_key(ctx), apply_thresholds, variant), _build)
```
`variant`: para `lineup` el tamaño de la combinación (3, 4, 5); `None` en los demás. `_build`:
1. `comp_id is None` (vista "todas") → `Population(members=[], reason="sin_universo")`. Si `context.population_mode(ctx) == "entity_only"` → `reason="contexto_no_comparable"`.
2. `bundles = metrics_catalog.enumerate(entity_type, comp_id, ctx, variant)` (enumeradores de §4.2). Si `[]` → población vacía (`reason=None`).
3. Por bundle: `values = stats_engine.compute_standard(b)` → `apply_base(values, b, "partido")` (los conteos/volumen en por partido, RF-18); si el tipo admite regresión (`sample.REGRESSED_TYPES`), `values = sample.adjust_values(values, b, prior)` y el valor de ranking de `oer`/`der`/`net_rating` es `adj.value` (RF-16).
   `badge = sample.sample_for(entity_type, [b] o [on, off], team_poss=…)` (T-02; `onoff` usa los dos estados).
4. `in_population = badge["ranked"]` si `apply_thresholds` (equipo: `games ≥ sample.team.min`; jugador: `minutes ≥ sample.player.min`; quinteto/ON-OFF/cierre: mínimo efectivo de T-02) y `True` si no (camino de C-02).
5. `Member.values = {clave: valor_de_ranking}` para las 83 claves (None si nulo). `criterion` = texto por tipo ("equipos con ≥ {min} partidos", "jugadores con ≥ {min} minutos", "quintetos con ≥ {min} posesiones"…) leído de `config.get`. `context_label` = `context.context_echo(...)["label"]`.

### 4.2 Enumeradores por tipo (`metrics_catalog.enumerate` + registro)
| Tipo | Enumerador | Origen |
|---|---|---|
| `team` | `bundles.all_team_bundles(comp_id, ctx)` | T-05 |
| `player` | `bundles.all_player_bundles(comp_id, ctx)` (jugadores con ≥ 1 partido jugado en la selección) | T-05 |
| `lineup` | `bundles.all_lineup_bundles(comp_id, ctx, size)` = `chain(lineups.all_lineups(team, comp_id, ctx, size=size) for team in equipos con pbp)` | T-02 (`all_lineups`) + NUEVO |
| `onoff` | `bundles.all_onoff_bundles(comp_id, ctx)` = por equipo `lineups.all_onoff_bundles(games, team_code)`; devuelve el bundle ON con `meta["off"]` = bundle OFF; ids `team:player_id` vía `identity.name_index` | NUEVO |
| `clutch` | `bundles.all_clutch_bundles(comp_id, ctx)` = `clutch.clutch_bundle(...)` por equipo con partidos calificados | NUEVO |
`metrics_catalog.set_enumerator(entity_type, fn)` (PROPUESTA) registra los tres nuevos al importar `bundles.py`. `lineups.all_onoff_bundles(games, team_code)`: por partido con 5 titulares válidos, `build_segments`; por tramo, para cada jugador del plantel del partido, suma los eventos al ON si `player in on_court` y al OFF si no
(misma partición exhaustiva y disjunta de `onoff_stats`); costo O(tramos × jugadores). Las claves de jugador del pbp se pasan por `identity.canonicalize_pbp_games` (C-08).

### 4.3 Funciones de la ficha (`population.py`; fórmulas de Arq. §3.6, copiadas)
`s = +1` si `direction ∈ {higher, neutral}`, `−1` si `lower`. Las comparaciones de igualdad se hacen sobre los valores ya redondeados a 4 decimales de `compute_standard`.
| Función | Firma | Algoritmo |
|---|---|---|
| `rank` | `rank(value, others: list[float], direction) -> tuple[int, bool]` | `rank = 1 + #{o ∈ others : s·(o − value) > 0}` (competición estándar "1224"); `tied = #{o == value} > 0` |
| `percentile` | `percentile(value, others, direction) -> int \| None` | `N = len(others)`; `N == 0` → `None`; `B = #{s·(o − value) < 0}`, `E = #{o == value}`; `round(100·(B + 0.5·E)/N)` (0–100) |
| `league_reference` | `league_reference(entity_type, comp_id, ctx, **kw) -> dict[str, float \| None]` | por clave: media de `Member.values[clave]` no nulos de los miembros `in_population`; sin valores → `None` |
| `_leader` | interno | entre miembros `in_population` con valor: el mejor (`max` si higher/neutral, `min` si lower); empate → nombre en orden alfabético ascendente (comparación sin tildes ni mayúsculas) |
| `ficha` | `ficha(metric_key, value, entity_id, pop, *, rank_value=None) -> dict` | ver pseudocódigo |
| `attach_fichas` | `attach_fichas(metrics: dict, entity_type, entity_id, pop, *, rank_values: dict) -> dict` | para cada clave de `metrics` con objeto: `metrics[k].update(ficha(k, metrics[k]["value"], entity_id, pop, rank_value=rank_values.get(k)))`; no toca `value`/`reason`/`adj`/`sample` |
| `full_ranking` | `full_ranking(entity_type, metric_key, comp_id, ctx, highlight_id, variant=None) -> dict` | shape §3.2: miembros `in_population` con valor, ordenados por mejor→peor con desempate por nombre, `rank` por competición estándar; `outside_population`: miembros fuera con `hypothetical_rank = 1 + #{miembros in_population estrictamente mejores}` y su `sample`; `avg` = `league_reference` |

Pseudocódigo de `ficha`:
```
d = METRICS[key].direction ; s = -1 if d == "lower" else 1
v_rank = rank_value if rank_value is not None else value               # por partido para conteos/volumen; ajustado donde hay adj
basis  = "partido" if METRICS[key].base_mode in ("count","volume") and base == "total" else None
if value is None: return {todo None, tied False, in_population: member.in_population, pct_reason None, basis}
if pop.reason: return {todo None, pct_reason: pop.reason}
members = [m for m in pop.members if m.in_population and m.values.get(key) is not None]
if len(members) < config.get("population.min_size"): return {todo None, pct_reason: "poblacion_insuficiente"}
me = pop.get(entity_id); in_pop = me.in_population if me else False
others = [m.values[key] for m in members if m.id != entity_id]
r, tied = rank(v_rank, others, d); p = percentile(v_rank, others, d)
avg = mean(m.values[key] for m in members); leader = _leader(members)
dist_avg = s*(v_rank - avg) ; dist_leader = s*(v_rank - leader.value)
rel = lambda dist, ref: dist/abs(ref) if (METRICS[key].rel_dist and abs(ref) >= 0.05) else None
return {rank: r, rank_total: len(members), tied, in_population: in_pop, percentile: p, avg, dist_avg, dist_avg_rel: rel(dist_avg, avg),
        leader: {id, name, value}, dist_leader, dist_leader_rel: rel(dist_leader, leader.value), pct_reason: None, basis}
```
Notas: (a) si la entidad es el único miembro-líder, `dist_leader = 0`; (b) el total de un miembro incluye a la entidad; el de una entidad fuera de la población, no (su rank es hipotético); (c) las métricas `neutral` se calculan como `higher` y la UI no las colorea; (d) la reformulación de `population.min_size` frente a Arq. §3.6
(`N' + 1 < min_size`) es equivalente para miembros y consistente para fuera de población; (e) `value` mostrado y `rank_value` difieren solo en conteos/volumen en base `total` y en métricas con `adj`.

### 4.4 Enganche en `metrics_catalog.build_payload` (paso 8 de T-05)
```
pop = population.population(entity_type, comp_id, ctx, variant=_variant(entity_type, id))        # comp_id None → pop con reason
rank_values = {k: v["value"] for k, v in apply_base(compute_standard(b0), b0, "partido").items()}
for k, adj in values_adj.items(): rank_values[k] = adj["value"]                                    # T-02
population.attach_fichas(payload["metrics"], entity_type, entity_id, pop, rank_values=rank_values)
payload["population"] = {"size": n_in_pop, "criterion": pop.criterion, "context_label": pop.context_label, "reason": pop.reason}
```
ON/OFF: la ficha se adjunta a las métricas del estado ON (la población son los estados ON); los de `states.off` reciben solo valor. `fichas=None` se mantiene como parámetro de `standard_payload` (T-05) y aquí se pasa el diccionario.

### 4.5 `GET /api/league`
`league_overview` pasa a: `ctx = context.parse_context(request.args)`; `pop = population.population("team", comp_id, ctx)`; por miembro arma la fila legado (`standings_row(...)` de C-09 sobre los resultados de la selección, `standings_pos` como hoy) y completa `rank`/`pct` con `population.rank`/`percentile` sobre las 11 claves; `include=summary` agrega
`avg = league_reference(...)` y `leaders`. Si C-02 ya migró la ruta a `population`, solo se agregan `rank`/`pct`/`in_population`/`include=summary`. Orden de las filas: por `oer` descendente con nulos al final (como hoy).

### 4.6 `GET /api/rankings/...`
Ruta fina: valida tipo y clave contra `METRICS` (y `entities`), `ctx = context.parse_context(args, …)`, `variant` desde `id` si es `lineup`, `population.full_ranking(...)`, `jsonify`. Errores de §3.2.

### 4.7 Caché y versiones
`cache.memo` con clave prefijada por `(data_version, config_version)`. Escrituras que DEBEN subir `data_version` (auditoría T-A2): `ingest.persist_game` (importar y reprocesar), `DELETE /api/games`, `competitions.create/update/merge/assign_game`, `identity.merge_players`/`backfill`. Cambios de configuración suben `config_version`
(`config.set_values`/`reset`, F-13). `LRU` por namespace (`pop:*`, máx. 64 entradas). Con N workers cada proceso lee las versiones en la petición siguiente. Costo esperado en el seed: población de equipos < 0,3 s, de jugadores < 1 s, de quintetos < 1 s, en frío; medir y registrar en `progress.md`.

## 5. Frontend — capa API (`api.js`)
- `api.ranking(type, metric, params)` → `GET /api/rankings/${type}/${metric}${qs(params)}`.
- `api.league(comp, {summary} = {})` → `GET /api/league${qs({competition: comp, include: summary ? "summary" : ""})}`; la firma actual `api.league(comp)` sigue funcionando.
- Sin otro `fetch` fuera de `api.js` (regla 9).

## 6. Frontend — UI

**`core/colors.js` (NUEVO).** `percentileColor(p) -> "rgb(r,g,b)" | null`: `null` si `p == null`; anclas `[0, #ef4444]`, `[50, #8b949e]`, `[100, #22c55e]`; interpolación lineal en RGB por tramo y redondeo a entero. `percentileBg(p, alpha = 0.18)` → `rgba(...)` con la misma escala. Constantes exportadas para pruebas manuales.

**`components/metric-card.js` (NUEVO).**
- `metricCard(key, metricObj, {entityType, label, layout = "card", showRanking = true, valueOverride}) -> string`.
  - Layout `card` (Equipo/Jugador): `.stat-box.metric-card` con etiqueta (`label` o `metricLabel(key)`), valor grande (`fmtMetric` o `nullDisplay(reason)`), y debajo —si hay ficha— cuatro líneas: **ranking** `N.º de M` (con "=" si `tied`: `=2.º de 12`); **líder** `Líder: {nombre} {valor} ({dist_leader con signo})`; **promedio** `Ø {avg} ({dist_avg con signo})`; **percentil** chip `pNN` con `percentileBg`.
  - Layout `row` (panel estándar, tablas): una línea `valor · N.º/M · pNN` con el detalle en el tooltip.
  - Formato de distancia: `fmtDelta(key, d)`: `pct` → puntos porcentuales con una decimal y sufijo " pp" (`−2,1 pp`); `dec1`/`dec2`/`int` → signo + número en las decimales del catálogo; porcentaje relativo entre paréntesis ` (−4,5 %)` cuando `dist_*_rel != null`. Signo "+" / "−" (U+2212). Tooltip: `Diferencia: {valor − referencia}` (aritmética sin orientar) y, si la métrica es de menos-es-mejor, `menos es mejor`.
  - Casos: `metricObj.value == null` → solo `nullDisplay`; `pct_reason` → una línea tenue con su texto ("Sin referencia: la población tiene menos de 3 entidades"…); `in_population === false` → clase `.fuera-poblacion` (gris) + chip "Muestra baja · fuera de la población"; `basis === "partido"` → "(por partido)" junto al ranking; `direction === neutral` (por catálogo) → sin color ni "mejor/peor".
  - Ayuda de referencia: línea tenue `Referencia: {rank_total} {criterion} · {context_label}` una vez por card de grupo (la arma `bindMetricCards` desde `payload.population`).
- `bindMetricCards(el, {entityType, contextQuery})`: delega eventos en `el`. Escritorio (`(hover: hover)`): `mouseenter`/`focusin` sobre `.metric-card[data-metric]` con 250 ms de espera → `api.ranking(entityType, key, {id, ...contextQuery})` → popover `role="dialog"` posicionado bajo la ficha, `max-height: 50vh; overflow: auto`, fila resaltada con `scrollIntoView({block: "center"})`; `mouseleave`/`Escape` lo cierra. Táctil (`(hover: none)`): toque → hoja inferior (`position: fixed; bottom: 0; max-height: 70vh`) con botón "Cerrar" y cierre al tocar el fondo.
  Contenido: título `Ranking — {métrica}`, filas `{puesto}. {nombre} {valor}` (la consultada en negrita y con `percentileBg`), sección "Fuera de la población (muestra baja)" y pie `Ø {avg} · {n} entidades`. Cache en memoria por URL con vida de la vista (se vacía al re-renderizar o cambiar el contexto). Estados: cargando (spinner), error ("No se pudo cargar el ranking"), vacío ("Sin datos para armar el ranking").
- Accesibilidad: el chip incluye el texto `pNN` (el color no es el único portador); popover enfocable por teclado; contraste ≥ 4,5:1 del texto sobre `percentileBg` en los dos temas (se verifica en T-F13).

**`components/standard-panel.js` (T-05, extensión).** `cellHTML(key, metricObj, ctx)` devuelve `metricCard(key, metricObj, {layout: "row"})`; la cabecera muestra la línea `Referencia…` desde `payload.population`.

**`app.js`.**
- `statBox(label, value, display, leagueKey, league, higherIsBetter, reason)` pierde `leagueKey`/`league`/`higherIsBetter` y el bloque `.stat-context` (`Ø`): queda `statBox(label, value, display, reason)` para los pocos usos sin ficha (Comparar). Se elimina `isPct`/`NOT_PCT` y `statClass` si quedan sin usos (T-C).
- *Equipo* (`_renderTeamContent`): `std = await getStandard("team", teamCode)` (una sola petición por render, con `base: "partido"`, compartida con el panel de T-05) y cada `statBox(...)` pasa a `metricCard(stdKeyFor(clave), std.metrics[stdKey], {entityType: "team", label})`; si `std` falla, las cards muestran solo el valor (sin ficha) y un aviso discreto.
  Las cards "Eficiencia", "Tiro", "Rebotes & Misc", "Defensa" y "Desglose ofensivo" cambian de `statBox` a `metricCard` conservando sus etiquetas; "PPT" pasa a leer `ppt` (T-05 D-2).
- *Jugador* (`_renderPlayerContent`): ídem con `api.metrics("player", {id: player_id, ...})`.
- *Liga* (`renderLeague`, `_leagueTableHTML`): `api.league(comp, {summary: true})`; `_leagueTeams = res.teams`; `#` = `rank[sortKey].rank` si la columna ordenada es una métrica rankeable (con `=` en empates), si no el índice; celdas con `percentileBg(pct[clave])`; filas con `in_population === false` atenuadas y chip "Muestra baja"; `<tfoot>` con las filas "Líder" (nombre y valor de `leaders[clave]`) y "Ø competencia" (`avg[clave]`).
  La tabla general (C-09) y el mapa no cambian, salvo que `drawLeagueScatter` recibe `axis.avgX`/`avgY` del `summary.avg` (el promedio de la población, no de todos los equipos).
- Los tooltips y la hoja inferior se enganchan con `bindMetricCards(sectionEl, {entityType, contextQuery: {competition, last}})` después de cada render.
- Estados: loading/vacío/error/offline de spec §6; móvil 768 px: `.stat-grid` de 2 columnas, texto de líneas de ficha ≥ 11 px con `word-break: break-word`; hoja inferior con scroll interno.

## 7. Navegación
Sin vistas ni hashes nuevos. `docs/frontend.md` agrega los dos módulos y el copy nuevo. En fase 2, T-03 enviará el contexto completo al mismo componente (`contextQuery`).

## 8. Contratos de datos
Request/response de §3 (Arq. §7.1 y §7.1b + `basis`, `rank_basis`, `population`, `include=summary` PROPUESTA). `Member`/`Population` internos. Sin filas SQLAlchemy nuevas (salvo `app_meta` condicional).

## 9. Manejo de errores y offline
| HTTP | `code` | Mensaje (es) | Cuándo |
|---|---|---|---|
| 400 | `parametro_invalido` | "Tipo de entidad desconocido" · "Métrica desconocida" · "La métrica no aplica a este tipo de entidad" | `/api/rankings` |
| 400 | `competencia_inexistente` | "La competencia no existe" | contexto |
| 400 | `contexto_invalido` | mensaje de `ContextError` | contexto |
| 401 | — | handler existente de `api.js` | sin sesión |
Offline: `/api/*` a red; la ficha ya recibida permanece; el popover muestra "No se pudo cargar el ranking". `sw.js`: `core/colors.js` y `components/metric-card.js` a `STATIC`; `CACHE` +1 (número asignado al integrar).

## 10. Riesgos y decisiones

**Dependencias técnicas**
- C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md)): `population.py` (esqueleto con `population`/`league_reference`), `context.py` (`parse_context`, `context_key`, `population_mode`, `context_echo`), parámetros `competition`/`last`.
- T-05 ([../13-T-05-conjunto-estandar-metricas/plan.md](../13-T-05-conjunto-estandar-metricas/plan.md)): `compute_standard`, `apply_base`, `StatBundle`, `METRICS`/`metricDef`, `register_entity`/enumeradores, `build_payload` (enganches), `standard-panel.js`, `stdKeyFor`.
- T-02 ([../14-T-02-confiabilidad-muestra/plan.md](../14-T-02-confiabilidad-muestra/plan.md)): `sample.sample_for`, `adjust_values`, `is_ranked`, `league_prior`, `lineups.all_lineups`.
- F-13 ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md)): `config.get` y el estado `activa` de `population.min_size`, `sample.team.*`, `sample.player.*`.
- F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)): `cache.py`/`app_meta`/`repository` (diferidos, ver D-2), `competitions.visible`.
- C-08 ([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md)): `player_id` en ids de jugador/ON-OFF/quinteto y `identity.name_index`.
- C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)): `nullDisplay`, `fmtNumber`.

**Decisiones / desviaciones**
- D-1 · **Ranking por partido en conteos y volumen** (RF-18): la arquitectura no distingue; sin esto el equipo con más partidos lideraría `pts` o `fga` en base "Totales". Campo `basis` es PROPUESTA sobre §7.1.
- D-2 · **`cache.py` / `app_meta` no existen hoy** (F-11 los difirió, [../02-F-11-calidad-datos-competencias/progress.md](../02-F-11-calidad-datos-competencias/progress.md)); F-13 los exige para `config.get`. Si al empezar T-01 siguen sin existir, la tarea A-1 los crea con la firma de Arq. §3.14 (`get_versions`, `bump_data_version`, `bump_config_version`, `memo`, `clear`) y audita los puntos que deben subir la versión
  (riesgo R-08). Si ya existen (por F-13), solo se audita. T-06 plan §4.1 paso 5 asume la misma regla ("lo crea el primer requisito que lo necesite").
- D-3 · **`GET /api/league?include=summary`** (PROPUESTA): la respuesta actual es una lista y la tabla necesita promedio y líder por columna; en vez de romper el contrato se agrega un modo opcional. Alternativa descartada: N llamadas a `/api/rankings` (una por columna).
- D-4 · **Población de ON/OFF y cierres** (spec §9): usa los estados ON y los agregados de cierre con los umbrales de T-02; el cliente no definió umbrales propios para cierres de equipo.
- D-5 · **Cambio visible en Liga**: valores pooled y TO% = PER/POS; se documenta antes/después (R-04). La media de equipos reemplaza al promedio de partidos-equipo de `league_averages` en la ficha; `league_averages`/`leagues` quedan para el radar y como legado (sin uso nuevo).
- D-6 · **Objeción menor a Arq. §3.6**: `N' + 1 < min_size` se reformula como "entidades con valor en la población < `population.min_size`" (equivalente para miembros). Sin desacuerdo de fondo.
- D-7 · `metrics_catalog.set_enumerator`, `enumerate`, `Population.variant`, `include=summary`, `population` en el payload y `basis` son PROPUESTA (no están en 00-arquitectura-transversal.md): hacen falta para poblaciones de quintetos por tamaño, para la tabla de Liga y para el rotulado por partido.
- Riesgo: **seed sin población** (2 partidos por equipo): se verifica bajando `sample.team.min` a 2 desde Configuración (documentado en CA-16).
- Riesgo: **costo de poblaciones de quintetos** (miles de combinaciones en una temporada completa) → caché por versión; las combinaciones de 3 y 4 jugadores se calculan solo si se piden.
- Riesgo: **inconsistencia entre pantallas** (mismo valor con redondeos distintos) → una sola fuente (`compute_standard`) y comparación por igualdad sobre valores redondeados a 4 decimales.
- Riesgo: **cambio de números por la conciliación** (T-05 D-2) se vuelve visible en las cards al reemplazar `statBox`; el aviso va en `docs/metrics.md` y en `progress.md`.

**Incrementos diferidos**: ficha sobre las demás dimensiones del selector (→ T-03); base por 40/100 (→ T-04); percentil por zona (→ C-03); coloreado y promedio en tablas (→ T-06); población de pareja, emparejamiento, cuarto, split, origen, tipo, oportunidad, tramo de reloj y cadena (→ sus dueños).

**Estimación: XL · 24–34 h** (population + enumeradores 8–10 h · caché y auditoría de versiones 2–4 h · endpoints y Liga 3–4 h · frontend 8–10 h · verificación y docs 4–6 h). Es mayor que la orientativa de la arquitectura (L 16–24 h) porque incluye enumeradores de ON/OFF y cierre, la caché condicional y la migración de ~50 `statBox`.
