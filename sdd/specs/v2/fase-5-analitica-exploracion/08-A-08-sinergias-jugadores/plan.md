# Plan — A-08: Sinergias entre jugadores

> **ID:** A-08 · **Prioridad:** P2 · **Fase y orden:** 5·08
> **Depende de:** A-01 · T-02 · F-06 · A-07 · F-07 (y T-01, T-05, T-06, T-03, C-08, X-01, F-11) — rutas relativas en `spec.md` encabezado y §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §5.4 · A-08 · Arquitectura §3.6, §3.7, §3.10, §3.14, §4 (`synergy.py`), §6, §7, §8
> **Estimación:** L · 12–18 h

## 1. Enfoque
Módulo dedicado **`backend/synergy.py`** (NUEVO, Arq. §4; capa estadística DA-37, on-the-fly, sin persistir) con las tres funciones fijadas por la
arquitectura —`assist_matrix`, `pair_table`, `teammate_impact`— más un orquestador `synergy_report` que arma la respuesta de `GET /api/synergy/<team_code>`.
Reutiliza, sin duplicar, tres piezas ya planificadas: (1) `chains.assist_pairs_from_events` (A-07) para el vínculo exacto asistente → anotador de
**todas** las asistencias del pbp (por eventos, no por posesiones, para que la matriz cuadre con el total del equipo aun con posesiones
incompletas); (2) `lineups.all_lineups(team, comp, ctx, size=2)` (F-06/T-02 §4.2, ya generalizado a combinaciones de `size` jugadores) como fuente de las
parejas; (3) `sample.py` de T-02 (`sample_level("pair")`, `league_prior`, `adjust_values`, `band`) para el ajuste. Lo propio de A-08 es: la matriz y su
conciliación, los rankings (triples, puntos tras asistencia, parejas) y el cálculo "con y sin" de **impacto sobre compañeros**, que se obtiene por
**resta de cajas aditivas** (estado "B sin A" = tramos con B en cancha − tramos con A y B), sin recorrer el pbp otra vez. Una ruta fina entrega todo a S3 Quintetos
(sección Sinergias) y a S4 Impacto; la tabla `pairs` (T-06) y el tipo `pair` (T-05) completan el contrato.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/synergy.py` | module (NUEVO, Arq. §4) | `assist_matrix`, `pair_table`, `teammate_impact`, `synergy_report`, `reconcile_assists`, `pair_bundles` (loader `pair`), `table_rows` (builder T-06), helpers `_pair_states`, `_scorer_stats` | RF-1…RF-18 |
| `backend/lineups.py` | module (F-06/T-02, **consumir**; si `size=2` no está cubierto, extender) | `all_lineups(team, comp, ctx, size=2)` y `pair_states(team, comp, ctx)` (PROPUESTA: devuelve `ON[b]` y `PAIR[(a,b)]` en cajas aditivas para el cálculo "con y sin") | RF-8, RF-12 |
| `backend/chains.py` | module (A-07, **consumir**) | `assist_pairs_from_events(events, name_to_id, *, team_code)` | RF-1…RF-4 |
| `backend/context.py` | module (T-03, **consumir/PROPUESTA**) | `filter_events(events, ctx, team_code, game_id) -> list[dict]` (envoltorio público de `event_predicate` + `_event_states`; ver §10) | RF-15 |
| `backend/stats_engine.py` | module (extender) | `assist_link_rates(counts)`: `assisted_pct`, `assisted_pts_share` (regla 4) | RF-6 |
| `backend/metrics_catalog.py` | module (T-05, registrar) | `register_entity("pair", synergy.pair_bundles)` | RF-8 |
| `backend/tables.py` | module (T-06, registrar) | `register_table("pairs", entity_type="pair", …)` | RF-11 |
| `backend/data_quality.py` | module (F-11, registrar) | check opcional `assist_link` (asistencias sin anotador y partidos que no cuadran) | RF-3, RF-4 |
| `backend/app.py` | route | `GET /api/synergy/<team_code>` (fina: `parse_context`, delega en `synergy.synergy_report`) | RF-1, RF-15 |
| `frontend/js/api.js` | js-api | `api.synergy(team, params)` | RF-1…RF-14 |
| `frontend/js/components/synergy-panel.js` | js-component (NUEVO, PROPUESTA de nombre) | `renderAssistMatrix`, `renderAssistRankings`, `renderPairsPanel`, `renderImpactPanel`, `renderPlayerSynergy` | RF-1…RF-14 |
| `frontend/js/views/equipo.js` | js-view (X-01) | sección "Sinergias" en la pestaña `quintetos` de S3 | RF-1…RF-13 |
| `frontend/js/views/jugador.js` | js-view (X-01) | bloque de sinergias en la pestaña `impacto` de S4 | RF-14 |
| `frontend/css/style.css` | css | sección `/* ── synergy (A-08) ── */` (matriz con intensidad, rankings, detalle) | RF-1 |
| `frontend/sw.js` | sw | sumar `js/components/synergy-panel.js` a `STATIC` y subir `CACHE` solo si X-01 no migró a runtime caching | — |
| `docs/api.md` | doc | `GET /api/synergy/<team_code>`, tabla `pairs`, tipo `pair` | cierre |
| `docs/metrics.md` | doc | matriz de asistencias, definición de impacto sobre compañeros, ajuste de parejas | cierre |
| `docs/frontend.md` | doc | sección Sinergias (S3) y bloque de Impacto (S4) y su copy | cierre |
| `docs/architecture.md` | doc | módulo `synergy.py` | cierre |

Matriz RF → archivo: RF-1/RF-2/RF-17 `synergy.assist_matrix` + `chains.assist_pairs_from_events` · RF-3/RF-4 `synergy.reconcile_assists`, `data_quality.py` · RF-5/RF-6/RF-7
`synergy.assist_matrix` (`by_assister`, `assisted_scoring`), `stats_engine.assist_link_rates` · RF-8 `synergy.pair_bundles`, `lineups.all_lineups`, `metrics_catalog.py` ·
RF-9/RF-10 `synergy.pair_table`, `sample.py` (consumo) · RF-11 `tables.py`, `synergy.table_rows` · RF-12/RF-13 `synergy.teammate_impact`, `lineups.pair_states` · RF-14
`synergy.synergy_report` (`player_view`), `views/jugador.js` · RF-15 `app.py`, `context.py` · RF-16 `synergy.py`, componentes · RF-18 `export-menu.js` (consumo), `views/equipo.js`.

## 3. Backend — rutas y modelos

**Sin cambios de esquema** (Arq. §5). **Sin claves de configuración nuevas** (consume `sample.pair.min/high/rel_pct`, `regression.pair.k`, `sample.player.min`, `population.min_size`).

### `GET /api/synergy/<team_code>` — NUEVO (ruta y claves de primer nivel fijadas en Arq. §6) · `login_required`
- Query: contexto T-03 completo (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`; `clock`, `clock_start`, `origin`, `ptype`,
  `chance` se aceptan y se informan en `context.ignored` con razón `no_aplica`); `player=<player_id>` (**PROPUESTA**: agrega `player_view` para S4); `top=<int>`
  (**PROPUESTA**, default 5, rango 1–20: tamaño de los rankings destacados). Sin `base` (conteos y tasas; el conjunto estándar de cada pareja sale de `/api/metrics/pair`).
- Respuesta 200 (valores ilustrativos; el real trae todas las filas):
```json
{
  "team": {"code": "CNF", "name": "Nacional"},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {},
              "ignored": [], "level": "partido", "population_mode": "apply_all", "games_used": 13, "games_total": 13,
              "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "assist_matrix": {
    "players": [
      {"player_id": 812, "name": "S. Canty", "ast_given": 41, "ast_received": 12, "minutes": 412.5, "sample": {"level": "alta", "unit": "minutos", "n": 412.5, "ranked": true}},
      {"player_id": 790, "name": "E. Oglivie", "ast_given": 9, "ast_received": 27, "minutes": 388.0, "sample": {"level": "alta", "unit": "minutos", "n": 388.0, "ranked": true}}
    ],
    "cells": [
      {"assister_id": 812, "scorer_id": 790, "count": 9, "pts": 19, "threes": 2}
    ],
    "unlinked": {"count": 1, "by_assister": [{"player_id": 812, "count": 1}],
                 "causes": {"sin_tiro_vinculado": 1}},
    "totals": {"matrix": 62, "unlinked": 1, "pbp": 63, "box": 63, "ok": true},
    "triples_created": {
      "pairs": [{"assister_id": 812, "assister": "S. Canty", "scorer_id": 790, "scorer": "E. Oglivie", "threes": 5, "count": 9, "ranked": true}],
      "by_assister": [{"player_id": 812, "name": "S. Canty", "threes": 11, "ranked": true}]
    },
    "assisted_scoring": [
      {"player_id": 790, "name": "E. Oglivie", "fgm": 40, "assisted_fgm": 27, "assisted_pct": {"value": 0.675, "reason": null},
       "assisted_pts": 62, "fg_pts": 92, "top_assister": {"player_id": 812, "name": "S. Canty", "count": 9},
       "sample": {"level": "alta", "unit": "minutos", "n": 388.0, "ranked": true}}
    ],
    "check": {"link": {"fiba": 62, "respaldo": 0, "sin_vinculo": 1},
              "scorer_is_teammate": true, "shot_is_made_fg": true,
              "games": [{"game_id": "2849328", "matrix": 5, "pbp": 5, "box": 5, "ok": true, "cause_hint": null}],
              "games_mismatch": []}
  },
  "pairs": {
    "population": {"scope": "plantel", "size": 38, "criterion": "parejas del equipo con ≥ 30 posesiones", "context_label": "Toda la competencia"},
    "rankings": {
      "net_rating": ["CNF:790-812", "CNF:790-801"],
      "oer": ["CNF:790-812"],
      "ts_pct": ["CNF:790-812"]
    },
    "rows": [
      {"id": "CNF:790-812", "players": [{"player_id": 790, "name": "E. Oglivie"}, {"player_id": 812, "name": "S. Canty"}],
       "values": {"possessions": {"value": 211.4, "reason": null}, "minutes": {"value": 255.2, "reason": null}, "games": {"value": 13, "reason": null},
                  "oer": {"value": 1.1912, "reason": null, "adj": {"value": 1.1504, "k": 25, "prior": 1.0203, "band": 0.1561},
                          "rank": 2, "rank_total": 38, "tied": false, "percentile": 95, "in_population": true},
                  "der": {"value": 0.9987, "reason": null, "adj": {"value": 1.0001, "k": 25, "prior": 1.0203, "band": 0.1561}},
                  "net_rating": {"value": 0.1925, "reason": null, "adj": {"value": 0.1503, "k": 25, "prior": 0.0, "band": 0.2214},
                                 "rank": 2, "rank_total": 38, "tied": false, "percentile": 95, "in_population": true},
                  "ts_pct": {"value": 0.612, "reason": null}},
       "sample": {"level": "alta", "unit": "posesiones", "n": 211.4, "min": 30, "high": 80, "min_source": "absoluto", "games": 13, "minutes": 255.2, "possessions": 211.4, "ranked": true}}
    ]
  },
  "teammate_impact": [
    {"player_id": 812, "name": "S. Canty",
     "impact_net": {"value": 0.081, "reason": null}, "impact_oer": {"value": 0.052, "reason": null},
     "teammates_valid": 7, "teammates_total": 12, "weight_mean": 58.2,
     "sample": {"level": "media", "unit": "posesiones", "n": 58.2, "min": 30, "high": 80, "ranked": true},
     "detail": [
       {"teammate_id": 790, "name": "E. Oglivie", "valid": true,
        "with": {"possessions": 211.4, "net_rating": 0.1925, "net_adj": 0.1503, "oer_adj": 1.1504},
        "without": {"possessions": 74.1, "net_rating": -0.04, "net_adj": 0.0121, "oer_adj": 1.0409},
        "delta_net": 0.1382, "delta_oer": 0.1095,
        "sample_with": {"level": "alta", "n": 211.4}, "sample_without": {"level": "media", "n": 74.1}},
       {"teammate_id": 801, "name": "J. Feldeine", "valid": false, "reason": "sin_datos", "with": {"possessions": 98.0}, "without": {"possessions": 0.0}}
     ]}
  ],
  "player_view": null
}
```
- Con `player=<id>`: `player_view = {"player_id", "best_pairs": [<filas de pairs.rows con ese jugador, top por net ajustado, solo ranked>], "assists_to": [{"scorer_id", "name", "count", "pts", "threes"}], "assists_from": [{"assister_id", "name", "count", "pts", "threes"}], "boosts": <detail de teammate_impact de ese jugador>}`; el resto de las claves se conserva (el cliente decide qué dibujar).
- **Errores** (formato §7.8): 400 `contexto_invalido` (mensaje de `parse_context`) · 400 `parametro_invalido` "El jugador no pertenece a ese equipo." · 404 `no_encontrado` "No encontramos ese equipo." · 404 `sin_pbp` "Este equipo no tiene play-by-play importado. Reimportá sus partidos." · 401 sesión (handler global).

### `GET /api/table/pairs` — NUEVO (id fijado en Arq. §6; `register_table`, T-06)
Params: `team=<team_code>` (obligatorio) + contexto + `base`. Una fila por pareja (todas las que compartieron cancha). Payload §7.6 con el conjunto estándar de T-05 completo, columna `_sample`,
`adj` por fila, `default_sort = {"key": "net_rating", "dir": "desc", "use_adjusted": true}`, `default_columns = ["_name", "_sample", "possessions", "minutes", "games", "pts", "pts_against",
"net_rating", "oer", "der", "efg_pct", "ts_pct", "to_pct", "or_pct"]`, `totals_mode="none"` y `avg_mode="none"` (las parejas se superponen: una suma de filas no es un total del equipo; el promedio
del plantel no es un promedio de competencia — ver §10). `link` de fila: `#/equipo/<code>/quintetos?pair=<id>`.

### `GET /api/metrics/pair?id=<team_code>:<pid>-<pid>` — NUEVO (tipo fijado en Arq. §6)
Loader `synergy.pair_bundles(req)`; payload §7.3 completo con `adj` y `sample` de T-02 (tipo `pair` ∈ `REGRESSED_TYPES`). `pid` ascendentes (Arq. §3.12).

## 4. Backend — lógica

### 4.1 `assist_matrix(team_code: str, comp_id: int, ctx: Context) -> dict` (firma Arq. §4)
```
games   = context.filter_games(repository.team_pbp_games(team_code, comp_id), ctx, team_code)         # partido: venue, opponent, rest, last
usados  = [g for g in games if g.events]                                                                # sin pbp → context.games_excluded.sin_pbp
para g en usados:
    name_to_id = {(r.team_code, r.player_name): r.player_id for r in g.player_rows}                      # C-08
    kept       = context.filter_events(g.events, ctx, team_code, g.game_id)                              # evento: quarter, score, on, off
    keep_set   = {ev.action_number for ev in kept}
    links      = chains.assist_pairs_from_events(g.events, name_to_id, team_code=team_code)              # A-07: TODAS las asistencias, FIBA o respaldo
    links      = [l for l in links if l.assist_event in keep_set]
    para l en links:
        si l.link == "sin_vinculo" o l.scorer_id es None o not l.made o l.scorer_id == l.assister_id:
            unlinked += 1 ; causes[sin_tiro_vinculado | tiro_no_convertido | anotador_sin_id | mismo_jugador] += 1 ; by_assister[l.assister_id] += 1
        si no: cells[(l.assister_id, l.scorer_id)].count += 1 ; .pts += 3 si l.shot_type == "3" si no 2 ; .threes += 1 si "3"
        link_counts[l.link] += 1
    pbp_g   = #{ev in kept: ev.action_type == "assist" y ev.team_code == team_code}
    box_g   = team_game_stats.ast del equipo en g           # solo si no hay filtro de evento activo; si lo hay → None (no comparable)
    check_g = {matrix: Σ cells + unlinked del partido, pbp: pbp_g, box: box_g, ok: matrix == pbp_g (y == box_g si existe), cause_hint}
    fgm_por_jugador(g) += #{ev in kept: ev.action_type in {2pt,3pt} y ev.success == 1} por player_id      # para assisted_pct
players  = jugadores con ast_given + ast_received > 0, ordenados por ast_given + ast_received desc (empate: nombre)
totals   = {matrix: Σ cells.count, unlinked, pbp: Σ pbp_g, box: Σ box_g | None, ok: matrix + unlinked == pbp (y == box si existe)}
```
- **Cuadre**: `Σ celdas + sin_vínculo = pbp` por construcción (cada asistencia cae en una celda o en `unlinked`); `pbp = box` cuando el box y el pbp coinciden. Las diferencias pbp ↔ box por
  partido se listan en `check.games_mismatch` con `cause_hint` ∈ `box_no_coincide` (el pbp está completo pero el box difiere: pasa a F-11 `pbp_box_mismatch`), `pbp_incompleto`, `desconocida`.
- `triples_created.pairs` = celdas con `threes > 0` ordenadas por `threes` desc, luego `count` desc, luego nombre; `ranked` = ambos jugadores con `sample.player` no baja (§4.5). Se devuelven los
  `top` primeros con `ranked: true` y, aparte, el resto marcado `ranked: false`. `by_assister` suma `threes` por asistente.
- `assisted_scoring[p]`: `fgm` (canastas de campo del jugador en eventos retenidos), `assisted_fgm` = Σ `count` de la columna del jugador, `assisted_pts` = Σ `pts`, `fg_pts` = `2·fgm2 + 3·fgm3`,
  `assisted_pct = _safe_div(assisted_fgm, fgm)` (null `sin_intentos` si `fgm = 0`), `top_assister` = asistente con más `count` hacia él (empate: nombre).
- **Verificación del vínculo (RF-3)**: `check.link = {fiba, respaldo, sin_vinculo}`; `scorer_is_teammate` = ningún anotador pertenece a otro equipo; `shot_is_made_fg` = todo tiro vinculado fue canasta de campo convertida. Ambos `true` o la
  conciliación lo señala. Cada partido sin `previous_action` (no reprocesado con ingesta v2) usa el respaldo de A-07 y se cuenta en `respaldo`.
- Caché: `cache.memo("synergy:assists", (team_code, comp_id, context_key(ctx)), fn)`.

### 4.2 `stats_engine.assist_link_rates(c: dict) -> dict` (regla 4)
```
assisted_pct        = _safe_div(c.assisted_fgm, c.fgm)           # % de las canastas de campo propias que fueron asistidas
assisted_pts_share  = _safe_div(c.assisted_pts, c.fg_pts)        # % de los puntos de campo propios que vienen de canastas asistidas
```
Cociente de totales de la selección (DA-02); denominador 0 → `{"value": None, "reason": "sin_intentos"}`.

### 4.3 `pair_table(team_code, comp_id, ctx) -> list` (firma Arq. §4) y loader `pair_bundles`
```
bundles = lineups.all_lineups(team_code, comp_id, ctx, size=2)           # F-06/T-02 §4.2: combinaciones de 2 jugadores de cada tramo; id "<team>:<pid>-<pid>" ascendente
prior   = sample.league_prior(comp_id, ctx)                              # T-02: PPP pooled de la competencia (§2.1)
tpos    = sample.team_offensive_possessions(team_code, comp_id, ctx)     # T-02: umbral relativo si está activo (rel_pct de pair = null por defecto)
para b en bundles:
    values = stats_engine.compute_standard(b)                            # T-05: conjunto completo
    values = sample.adjust_values(values, b, prior)                      # T-02: adj de oer/der/net_rating (entity "pair" ∈ REGRESSED_TYPES; K = regression.pair.k)
    badge  = sample.sample_level("pair", n=values["possessions"].value, unit="posesiones", team_poss=tpos,
                                 games=b.games, minutes=b.minutes, possessions=values["possessions"].value)
    row    = {id: b.entity_id, players, values, sample: badge}
pop     = Population(scope="plantel", members=[row con sample.ranked])   # PROPUESTA §10: población = parejas del equipo con muestra suficiente
fichas  = population.attach_fichas(row.values, "pair", row.id, pop)     # rank/percentil/líder dentro del plantel (T-01); adj.value como base de ranking
rankings: ordenar por net_rating.adj.value desc, oer.adj.value desc, ts_pct.value desc, solo ranked, top = parámetro `top`
```
Parejas `baja` quedan en `rows` (gris, `ranked: false`), fuera de `rankings` y de `pop`. `values.possessions`/`minutes` son las del equipo con ambos en cancha.

### 4.4 `teammate_impact(team_code, comp_id, ctx) -> list` (firma Arq. §4) — algoritmo "con y sin"
```
st = lineups.pair_states(team_code, comp_id, ctx)       # ON[b] = {own, opp, seconds, games} ; PAIR[(a,b)] ídem (a<b por player_id) — cajas aditivas de _agg
para cada jugador A, para cada compañero B != A con ON[B]:
    with     = PAIR[(min(A,B), max(A,B))]  (si no existe → vacío)
    without  = ON[B] − with                             # resta componente a componente de own/opp/seconds (aditivo: RAW_KEYS son conteos)
    b_with, b_without = StatBundle("pair", id, own, opp, seconds, games)
    v_with   = adjust_values(compute_standard(b_with), b_with, prior) ; v_without = idem
    pos_with, pos_without = possessions(own) de cada estado
    valid    = sample_level("pair", n=pos_with).ranked y sample_level("pair", n=pos_without).ranked
    si valid:  delta_net = v_with.net_rating.adj.value − v_without.net_rating.adj.value ; delta_oer = oer_adj_with − oer_adj_without
               w = min(pos_with, pos_without)
    si no:     reason = "sin_datos" si pos_without == 0 o pos_with == 0, si no "muestra_baja"
impact_net(A) = Σ w·delta_net / Σ w (sobre B válidos) ; impact_oer(A) idem ; null `sin_datos` si no hay B válidos
teammates_valid = #B válidos ; teammates_total = #B con ON ; weight_mean = Σ w / teammates_valid
sample(A) = sample_level("pair", n=weight_mean, unit="posesiones") ; ranked = level != "baja" y teammates_valid >= 1
orden: impact_net desc entre ranked; los no ranked al final y en gris
```
- Invariante verificable (CA-10): `pos_with + pos_without = pos(ON[B])` y `with + without = ON[B]` en cada caja.
- Un compañero B que nunca juega sin A (`pos_without == 0`) → `valid: false`, `reason: "sin_datos"`; se muestra en el detalle, no entra al promedio.
- **Net con ajuste en ambos estados**: `net_adj = oer_adj − der_adj` (T-02 §3.7), por lo que el diferencial es entre valores regresados (no entre crudos).

### 4.5 `pair_states` y muestra de jugador
`lineups.pair_states(team_code, comp_id, ctx)` reutiliza los tramos de `build_segments` de F-06 (misma caché `lineups:<team>`): por cada tramo con `on_court` de 5, suma la caja del tramo a `ON[i]` para
cada `i` y a `PAIR[(i,j)]` para cada par. `sample` de jugador (matriz, rankings): `sample.sample_level("player", n=minutos_en_la_selección, unit="minutos", minutes=…)`; los minutos salen de
`player_game_stats.minutes` de los partidos usados (con filtro de evento activo se informan los minutos del partido completo; nota en `docs/metrics.md`).

### 4.6 `synergy_report(team_code, comp_id, ctx, *, player_id=None, top=5) -> dict`
Orquesta `assist_matrix`, `pair_table`, `teammate_impact` (misma `ctx`), arma `context_echo` con `ignored` por `no_aplica` (dimensiones de posesión) y `player_view` si hay `player_id`. Cache
`cache.memo("synergy:report", (team_code, comp_id, context_key(ctx), player_id, top), fn)`. Partidos sin pbp → excluidos (`games_excluded.sin_pbp`); sin ningún partido con pbp → 404 `sin_pbp`.

### Manejo de nulos (C-11)
Asistencia sin anotador → `unlinked` (nunca a una celda con 0); celdas sin asistencias no existen en `cells` (la visualización las pinta vacías "·"; 0 real). `assisted_pct` con `fgm = 0` → `sin_intentos`.
Pareja sin intentos de tiro libre → FT% `sin_intentos`. Compañero sin muestra en un estado → `valid: false` con razón. `box` nulo con filtro de evento activo (no comparable). Partido sin `player_id` en una fila →
el jugador queda `anotador_sin_id` y se informa.

## 5. Frontend — capa API (api.js)
```js
synergy: (team, params) => apiFetch(`/api/synergy/${encodeURIComponent(team)}${qs(params)}`),   // params: contexto + player + top
```
Reutiliza `api.table("pairs", {team, ...})` (T-06), `api.metrics("pair", {id, ...})` (T-05), `api.ranking("pair", clave, ...)` (T-01, si la población del plantel se expone). `qs()` omite vacíos. Ningún `fetch` fuera de `api.js`.

## 6. Frontend — UI
- **S3 Equipo → pestaña `quintetos` (`#/equipo/<code>/quintetos?…`, `views/equipo.js`)**, sección "Sinergias" debajo de la tabla de quintetos/ON-OFF de F-06, con cuatro bloques:
  1. **Matriz de asistencias** (`renderAssistMatrix`): filas = quien asiste, columnas = quien anota, primera columna y cabecera fijas; cada celda muestra la cantidad y, con intensidad de fondo (opacidad proporcional a
     `count/max`, **no** color de rendimiento), el detalle en `title`/tooltip: "{asistente} → {anotador}: {count} canastas · {pts} pts · {threes} triples" (copy nuevo). Totales por fila/columna, columna "Sin vínculo" y la línea
     de cuadre "Cuadra: matriz + sin vínculo = asistencias del equipo (N)". Celdas vacías "·".
  2. **Triples y puntos tras asistencia** (`renderAssistRankings`): dos listas — "Quién genera más triples para otro" (pares y por asistente) y "Quién convierte más puntos tras asistencia" (por anotador: puntos asistidos, % asistido, asistente principal).
     Jugadores de muestra baja en gris y sin posición.
  3. **Parejas** (`renderPairsPanel`): tres rankings (Net Rating ajustado, OER ajustado, TS%) con `sampleBadge`, valor crudo y ajustado y banda (reutiliza `metricCard` de T-01 con el ranking del plantel);
     debajo la **tabla completa `pairs`** (`createDataTable` + `exportMenu`, T-06).
  4. **Jugadores que potencian a otros** (`renderImpactPanel`): ranking por `impact_net` con "N compañeros" y detalle plegable (`collapsible`) con con/sin, posesiones de cada estado y badge.
- **S4 Jugador → pestaña `impacto` (`#/jugador/<id>/impacto`, `views/jugador.js`)**: llama `api.synergy(team, {player: id, …})` y dibuja `renderPlayerSynergy`: mejores parejas, "Asiste más a", "Le asisten más", "A quién potencia".
  El resto de la pestaña (±, ON/OFF, RAPM) lo aportan F-06 y A-11.
- **Reutilizados (Arq. §8):** `metric-card.js`, `sample-badge.js`, `data-table.js`, `export-menu.js`, `collapsible.js`, `core/format.js`, `components/context-bar.js`. La matriz se exporta con `exportMenu(el,
  {getData: matrizAncha, getNode: matrixEl, formats: ["csv","xlsx","png","pdf"]})`.
- **Copy:** español rioplatense directo (DA-21 resuelta en `../../00-decisiones.md`: sin `t()` hasta F-21); el copy nuevo se lista en `docs/frontend.md`.
- **Estados:** loading, vacío, error, offline y éxito según spec §6.
- **Mobile (<768 px):** matriz con scroll horizontal **solo dentro de la card** (sticky primera columna/cabecera); rankings en una columna; tablas con primera columna fija; nav inferior sin cambios.

## 7. Navegación
Sin sección ni pestaña nueva: `quintetos` de S3 y `impacto` de S4 (Arq. §3.12, ya registradas por X-01). A-08 agrega el render de su sección dentro de esas pestañas. Parámetros de vista en el hash: `pair=<id>` (resalta una pareja), `player`
(S4). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/synergy/<team_code>`: ejemplo completo en §3; fichas §7.1 (acotadas), `adj` §7.1, `sample` §7.2, nulos §7.4, `context` §7.5.
- Tabla `pairs`: §7.6. Entidad `pair`: §7.3, `entity_id = "<team_code>:<pid>-<pid>"`.
- `lineups.pair_states` devuelve `{ "on": {pid: {own, opp, seconds, games}}, "pair": {(pid, pid): {own, opp, seconds, games}} }` con `own`/`opp` = `RAW_KEYS` de `_agg` (aditivos).
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `contexto_invalido` | mensaje de `parse_context` |
| 400 | `parametro_invalido` | "El jugador no pertenece a ese equipo." |
| 401 | — | handler global de `api.js` |
| 404 | `no_encontrado` | "No encontramos ese equipo." |
| 404 | `sin_pbp` | "Este equipo no tiene play-by-play importado. Reimportá sus partidos." |
| 429 | — | "Demasiadas solicitudes. Esperá un momento." (existente) |
| 5xx | — | "No se pudieron calcular las sinergias." |
Offline: `/api/*` siempre a red; la sección muestra "Sin conexión: las sinergias necesitan conexión." Un partido que falla al procesarse se omite y se lista en `context.games_excluded` (`error_reconstruccion`). Si X-01 no migró a
runtime caching, `synergy-panel.js` se suma a `STATIC` en `sw.js` y se sube `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **Dependencia de A-07 (`assist_pairs_from_events`)**: A-08 consume una función de A-07 (orden anterior en la fase; la arquitectura §9.1 ya la lista como dependencia: "A-08 depende de F-07 y A-07"). Si A-08 se implementara antes, el
  helper se mueve a `synergy.py` sin cambio de contrato.
- **PROPUESTA — `context.filter_events`** (T-03): T-03 deja el estado por evento como helper interno (`_event_states`, `event_predicate`); A-08 necesita un envoltorio público que devuelva los eventos que pasan los filtros de nivel evento.
  Reportado en huecos. Alternativa: llamar a `event_predicate` con el estado calculado en A-08 (duplica lógica; descartada).
- **PROPUESTA — población de T-01 para `pair`** (spec §9.5): T-01 define poblaciones por competencia; una pareja solo existe dentro de un equipo. El plan arma una `Population` por plantel y usa `population.ficha`/`attach_fichas`; el ranking dice
  "X.º de N parejas del equipo". Reportado en huecos/desacuerdos.
- **PROPUESTA — `lineups.pair_states`** y los parámetros `player`/`top` de la ruta: no figuran en Arq. §3.10/§6.
- **`all_lineups(size=2)`**: T-02 §4.2 y F-06 ya definen la enumeración por combinaciones; A-08 solo verifica que `size=2` quede cubierto (la arquitectura asigna la generalización a A-08). Si F-06 solo implementó `size=5`, A-08 completa el caso `size < 5`.
- **Costo:** parejas ≈ C(12,2) = 66 por equipo y con/sin ≈ 132 ordenados; todo sale de cajas ya cacheadas (`lineups:<team>`) y de restas; `assist_matrix` recorre eventos de los partidos del equipo (~550 por partido). Objetivo: < 1,5 s en caliente.
- **Superposición de parejas:** una posesión del equipo aporta a C(5,2) = 10 parejas; por eso `pairs` no tiene fila de totales (`totals_mode="none"`) y las posesiones por pareja no suman las del equipo.
- **Muestras pequeñas del "sin A"**: titulares casi inseparables dan `pos_without` ≈ 0 → `valid: false`; es el comportamiento esperado, no un error.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato en `assist_matrix`, `pair_table`, `teammate_impact`, `GET /api/synergy/<team_code>`, tabla `pairs` ni tipo `pair`; las PROPUESTAS anteriores son agregados.
- **Dependencias técnicas:**
  - A-07 `chains.assist_pairs_from_events` ([../06-A-07-produccion-desde-eventos/plan.md](../06-A-07-produccion-desde-eventos/plan.md)).
  - F-06 `lineups.all_lineups`, tabla `team_lineups` ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)).
  - A-01 `lineups.build_segments_both`, `Possession` (referencia de coherencia de quintetos) ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md)).
  - F-07 `matchups.py` (comparte la lógica de segmentos de dos equipos; A-08 no la usa directamente) ([../../fase-4-dia-de-partido/01-F-07-analizar-partido/plan.md](../../fase-4-dia-de-partido/01-F-07-analizar-partido/plan.md)).
  - T-02 `sample.sample_level`, `league_prior`, `adjust_values`, `band`, `team_offensive_possessions` ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-05 `StatBundle`, `compute_standard`, `register_entity` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-01 `population.ficha`, `attach_fichas` ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - T-03 `Context`, `parse_context`, `filter_games`, `event_predicate` ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - T-06 `register_table`, `data-table.js`, `export-menu.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - C-08 `player_game_stats.player_id` ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)).
  - F-11 `repository.team_pbp_games`, `cache`, `previous_action`, `data_quality.register_check` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - X-01 `registerTab`, `views/equipo.js`, `views/jugador.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: L · 12–18 h** (matriz, vínculo y conciliación 3–4 h; parejas, ajuste y rankings 2–3 h; impacto "con y sin" 2–3 h; ruta, tabla y entidad `pair` 1–2 h; UI (matriz, rankings, panel S4, tabla) 3–4 h; verificación sobre 13 partidos y docs 1–2 h). Arquitectura §9.1: L 10–16 h; +2 h por la conciliación por partido y el detalle con/sin.
