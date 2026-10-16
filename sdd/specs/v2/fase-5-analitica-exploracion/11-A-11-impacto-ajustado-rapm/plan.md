# Plan — A-11: Impacto ajustado (RAPM)

> **ID:** A-11 · **Prioridad:** P2 · **Fase y orden:** 5·11
> **Depende de:** A-01 · T-02 · F-07 (y F-13, F-11, C-08, T-01, T-05, T-06, X-01) — rutas relativas en `spec.md` encabezado y §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §5.4 · A-11 · Arquitectura §3.2, §3.7, §3.10, §3.14, §3.18, §3.21, §4 (`rapm.py`), §6, §7, §8
> **Estimación:** XL · 22–34 h

## 1. Enfoque
Módulo dedicado **`backend/rapm.py`** (NUEVO, Arq. §4, DA-37: capa estadística, on-the-fly, **no persiste**). Cinco etapas:
(1) **Stints**: `matchups.stints(comp_id, ctx)` (A-11 lo agrega al módulo de F-07, Arq. §3.10) agrupa las posesiones completas de A-01 por
`(partido, quinteto local, quinteto visitante)` y devuelve posesiones y puntos de cada lado. (2) **Diseño**: cada stint genera hasta dos
observaciones (local ataca / visitante ataca); cada una tiene 10 columnas activas (5 ofensivas `O_p` del atacante, 5 defensivas `D_p` del
defensor), respuesta `y = 100·pts/poss` y peso `w = poss`; el nivel base (intercepto, media ponderada de `y`) se resta y **no se penaliza**.
(3) **Ecuaciones normales dispersas**: `A = XᵀWX` (dict-of-dicts → listas) y `b`, construidas una vez; cada pliegue resta la contribución de sus partidos.
(4) **Resolución** con **gradiente conjugado precondicionado (Jacobi)** en Python puro, con arranque en caliente entre λ y chequeo de tiempo máximo;
**validación cruzada por partidos** sobre la grilla `rapm.lambdas × rapm.folds`; λ = el de menor error de validación (empate → mayor). (5) **Publicación**:
coeficientes del ajuste final con ese λ → `off = β_O`, `def = −β_D` (signo orientado), `total = off + def`, posesiones/minutos, muestra T-02, fichas T-01,
`onoff_net` crudo, diagnóstico de dominancia por muestras chicas y detalle del modelo. El resultado se guarda en una caché de memoria **con sus versiones**
(`data_version`, `config_version`) para poder mostrarlo "desactualizado"; `GET` solo lee, `POST /api/rapm/recompute` (admin) calcula. Sin cambios de esquema.
`numpy` es una **decisión condicionada a la medición** (DA-25): el plan incluye el interruptor y la tarea de medición, no la dependencia.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/rapm.py` | module (NUEVO, Arq. §4) | `rapm(comp_id, ctx)` (calcula y guarda), `rapm_cached(comp_id)` (lee), `_design`, `_normal_equations`, `_cg_solve`, `_cross_validate`, `_publish`, `_diagnostics`, `table_rows` (builder T-06), constantes técnicas `MAX_SECS`, `CG_TOL`, `CG_MAXIT` | RF-1…RF-20 |
| `backend/matchups.py` | module (F-07, **extender**) | `stints(comp_id, ctx) -> list[dict]` (Arq. §3.10, dueño A-11), caché `matchups:stints` | RF-1, RF-2, RF-5 |
| `backend/config.py` | module (F-13, extender `CONFIG_SPEC`) | claves `rapm.lambdas` (json lista, `[500,1000,2000,4000,8000]`) y `rapm.folds` (int, 5, rango 2–10), sección Umbrales, consumidor A-11 | RF-4 |
| `backend/stats_engine.py` | module (extender) | `weighted_mean`, `spearman` (helpers numéricos puros) usados por el diagnóstico (regla 4: fórmulas en `stats_engine`) | RF-10 |
| `backend/tables.py` | module (T-06, registrar) | `register_table("rapm", entity_type="player", …)` con columnas extra | RF-19 |
| `backend/app.py` | route | `GET /api/rapm` y `POST /api/rapm/recompute` (finas; el POST con `@admin_required`) | RF-13, RF-14 |
| `backend/auth.py` | module (F-11, **consumir**) | `admin_required` | RF-13 |
| `frontend/js/api.js` | js-api | `api.rapm(params)`, `api.rapmRecompute(body)` | RF-1…RF-16 |
| `frontend/js/components/rapm-panel.js` | js-component (NUEVO, PROPUESTA de nombre) | `renderRapmPanel(el, payload, {playerId, isAdmin, onRecompute})`: tarjeta, banner, ranking, detalles del modelo | RF-7…RF-15 |
| `frontend/js/views/jugador.js` | js-view (X-01) | pestaña `impacto` de S4: monta el panel de RAPM (junto a ±, ON/OFF y sinergias de A-08) y la tabla `rapm` | RF-1, RF-19 |
| `frontend/css/style.css` | css | sección `/* ── rapm (A-11) ── */` (barras ofensivo/defensivo/total, banner, detalles) | RF-7 |
| `frontend/sw.js` | sw | sumar `js/components/rapm-panel.js` a `STATIC` y subir `CACHE` solo si X-01 no migró a runtime caching | — |
| `backend/requirements.txt` | deps | **solo si CA-16 supera 30 s** y el humano aprueba: `numpy` (con justificación medida en `progress.md`) | RF-16 |
| `docs/api.md` | doc | `GET /api/rapm`, `POST /api/rapm/recompute`, tabla `rapm`, claves de configuración | cierre |
| `docs/metrics.md` | doc | definición de RAPM (modelo, signo, unidades, λ, cobertura, limitaciones), verificación de dominancia | cierre |
| `docs/frontend.md` | doc | bloque de impacto ajustado en S4 Impacto y su copy | cierre |
| `docs/architecture.md` | doc | módulo `rapm.py`, `matchups.stints`, caché `rapm`, decisión sobre `numpy` | cierre |
| `docs/deployment.md` | doc | nota: caché volátil, recalcular tras desplegar; recomendación DA-28 (1 worker) | cierre |

Matriz RF → archivo: RF-1/RF-2/RF-5 `matchups.stints`, `rapm._design` · RF-3 `rapm._publish` · RF-4 `rapm._cross_validate`, `config.py` · RF-6 `app.py`, `rapm.rapm` (ignora contexto) · RF-7 `rapm._publish`,
`rapm-panel.js` · RF-8/RF-9 `rapm._publish` (`population.percentile`, `sample.sample_level`), `rapm-panel.js` · RF-10 `rapm._diagnostics`, `stats_engine.py` · RF-11 `rapm._publish` (`onoff_net`) ·
RF-12 `rapm._cross_validate`, `rapm-panel.js` · RF-13/RF-14 `rapm.rapm`, `rapm.rapm_cached`, `app.py`, `auth.py` · RF-15 `rapm._publish` (`model`, `cv`) · RF-16 `rapm._cg_solve` (`deadline`), `app.py` ·
RF-17 `rapm.rapm` · RF-18 `matchups.stints` (`player_id`) · RF-19 `tables.py`, `rapm.table_rows` · RF-20 `rapm._publish`.

## 3. Backend — rutas y modelos

**Sin cambios de esquema** (Arq. §5). Claves de configuración nuevas (en `CONFIG_SPEC`; `app_config` solo guarda overrides):
| Clave | Tipo | Default | Rango | Sección | Consumidor |
|---|---|---|---|---|---|
| `rapm.lambdas` | json lista de números | `[500, 1000, 2000, 4000, 8000]` | 1–10 valores, cada uno 1–100 000 | Umbrales | A-11 |
| `rapm.folds` | int | 5 | 2–10 | Umbrales | A-11 |

### `GET /api/rapm` — NUEVO (ruta fijada en Arq. §6) · `login_required`
- Query: `competition=<id>` (obligatorio; `all` → 400); `player=<player_id>` (**PROPUESTA**: devuelve además `player` con la fila y su puesto, y recorta `players` al top `top` + el jugador); `top=<int>` (PROPUESTA, default 25, 1–500;
  `0` = todos); `diagnostics=1` (default 1). Los demás parámetros de contexto T-03 se aceptan y se informan en `context.ignored` con razón `no_aplica`.
- Nunca calcula: lee `rapm._RESULTS[comp_id]`. Respuestas 200:
  - Sin cálculo: `{"status": "sin_calcular", "competition": {...}, "can_recompute": true|false, "message": "El impacto ajustado todavía no se calculó."}`.
  - Calculado: ejemplo (valores ilustrativos):
```json
{
  "status": "listo", "stale": false,
  "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "computed_at": "2026-10-04T14:05:12-03:00", "duration_s": 18.4, "data_version": 12, "config_version": 3,
  "lambda": 2000, "lambdas": [500, 1000, 2000, 4000, 8000], "folds": 5,
  "cv": [{"lambda": 500, "error": 1480.2}, {"lambda": 1000, "error": 1471.9}, {"lambda": 2000, "error": 1468.3},
         {"lambda": 4000, "error": 1469.0}, {"lambda": 8000, "error": 1472.5}],
  "cv_baseline": 1475.8,
  "folds_by_game": {"2849328": 0, "2849329": 1},
  "model": {"rows": 11890, "stints": 6120, "players": 183, "games": 130,
            "possessions_total": 21500, "possessions_used": 20512, "coverage": 0.954,
            "excluded": {"incompletas": 120, "sin_quinteto": 868, "games_sin_pbp": 0}, "lineup_changed_share": 0.031,
            "intercept": 98.4, "cg": {"solves": 26, "iterations_mean": 41}},
  "players": [
    {"player_id": 812, "name": "S. Canty", "team_code": "CNF",
     "off": {"value": 2.1, "reason": null}, "def": {"value": 1.4, "reason": null}, "total": {"value": 3.5, "reason": null,
        "rank": 3, "rank_total": 140, "tied": false, "percentile": 98, "avg": 0.0, "dist_avg": 3.5,
        "leader": {"id": 790, "name": "E. Oglivie", "value": 4.1}, "dist_leader": -0.6, "in_population": true},
     "possessions": 1604, "poss_off": 812, "poss_def": 792, "minutes": 412.5, "games": 13,
     "onoff_net": {"value": 6.2, "reason": null},
     "sample": {"level": "alta", "unit": "minutos", "n": 412.5, "min": 60, "high": 200, "min_source": "absoluto", "ranked": true}}
  ],
  "player": null,
  "diagnostics": {
    "dominance": {"ok": true, "top_n": 10, "top_min_possessions": 1210, "p25_possessions": 640, "ranked_players": 140,
                  "spearman_abs_total_vs_possessions": 0.31},
    "compare_unregularized": {"lambda": 5, "top10_low_sample_unregularized": 3, "top10_low_sample_chosen": 0,
                              "top10_overlap": 6, "low_sample_definition": "minutos < sample.player.min"}
  },
  "warnings": [],
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {},
              "ignored": [{"param": "last", "reason": "no_aplica"}], "level": "partido", "population_mode": "apply_all",
              "games_used": 130, "games_total": 130, "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"}
}
```
  - `stale: true` cuando `data_version`/`config_version` guardadas ≠ vigentes (`cache.get_versions()`); el payload se devuelve igual y la UI muestra el banner (RF-14).
  - `warnings` ∈ `lambda_en_el_borde`, `sin_mejora_vs_modelo_vacio` (`cv` mínimo ≥ `cv_baseline`), `muchos_cambios_de_quinteto` (`lineup_changed_share > 0,10`).
  - `status: "datos_insuficientes"`: `{"status": "datos_insuficientes", "message": "Hacen falta al menos 10 partidos con play-by-play para validar el modelo.", "games": 4, "needed": 10}` (`needed = 2·rapm.folds`).
- `player=<id>`: `player = <fila del jugador>` (o `null` con `reason: "sin_datos"` si no tiene posesiones en stints usados); si el jugador no pertenece a la competencia → 404.
- **Errores** (formato §7.8): 400 `parametro_invalido` "Elegí una competencia." (`competition` ausente o `all`) · 400 `competencia_inexistente` "La competencia no existe." · 404 `no_encontrado` "No encontramos ese jugador." · 401 sesión.

### `POST /api/rapm/recompute` — NUEVO (Arq. §6, **A** = `admin_required`)
- Body `{"competition": <id>}`. Ejecuta `rapm.rapm(comp_id, ctx)` (síncrono) y devuelve el mismo payload que `GET` (`status: "listo"`, `stale: false`) o `datos_insuficientes`.
- **Errores:** 403 `requiere_admin` "Solo un administrador puede recalcular." · 400 `parametro_invalido` / `competencia_inexistente` · **502 `timeout_externo`** "El cálculo superó el tiempo máximo. Reducí la grilla de λ en Configuración." (RF-16).

### `GET /api/table/rapm` — NUEVO (id fijado en Arq. §6; `register_table`, T-06)
Params: `competition` (obligatorio) + `base`. Una fila por jugador con posesiones en stints usados: bundles `player` de T-05 (conjunto estándar completo) más columnas extra `_rapm_off`, `_rapm_def`, `_rapm_total`, `_rapm_poss`,
`_onoff_net` (`TableRow.extra`, T-06 plan §4.1). `default_columns = ["_name", "_team", "_sample", "_rapm_total", "_rapm_off", "_rapm_def", "_rapm_poss", "minutes", "_onoff_net", "plus_minus"]`;
`default_sort = {"key": "_rapm_total", "dir": "desc"}`; `totals_mode="none"`, `avg_mode="none"`. Si el RAPM no está calculado: 200 con `rows: []` y `meta.status = "sin_calcular"` (la tabla nunca dispara el cálculo).
La cabecera de exportación agrega `λ`, `folds`, `computed_at`, `coverage` (T-06 §7.7, campos `extra_meta`, PROPUESTA).

## 4. Backend — lógica

### 4.1 `matchups.stints(comp_id: int, ctx: Context) -> list[dict]` (firma Arq. §3.10; dueño A-11)
```
juegos   = context.filter_games(repository.competition_games(comp_id), ctx, team_code=None)          # solo `competition` (A-11 ignora el resto, RF-6)
para g en juegos con pbp:
    poss = possessions.game_possessions(g.game_id)                                                 # A-01, cacheado (poss:game)
    para p en poss:
        si p.incomplete: excluded.incompletas += 1 ; continue
        si p.own_on_court es None o p.opp_on_court es None o len(...) != 5: excluded.sin_quinteto += 1 ; continue
        home_on, away_on = (own, opp) si p.team == g.home_code si no (opp, own)
        key = (g.game_id, frozenset(home_on), frozenset(away_on))
        st = acc[key]  # {game_id, home_on, away_on, poss_home: 0, poss_away: 0, pts_home: 0, pts_away: 0}
        si p.team == g.home_code: st.poss_home += 1 ; st.pts_home += p.pts
        si no:                    st.poss_away += 1 ; st.pts_away += p.pts
        si p.lineup_changed: changed += 1
devolver [st ...] + resumen {possessions_total, excluded, lineup_changed}                         # el resumen va en un atributo/segundo valor interno `stints_summary`
```
- Shape de cada stint (Arq. §3.10 + `game_id` PROPUESTA, necesario para los pliegues): `{"game_id", "home_on": [player_id…], "away_on": [player_id…], "poss_home", "poss_away", "pts_home", "pts_away"}`.
- Las posesiones de un partido sin pbp no existen (el partido queda en `games_excluded.sin_pbp`). Invariante verificable: `Σ(poss_home + poss_away) + excluidas = total de posesiones de A-01` de la competencia.
- Caché `cache.memo("matchups:stints", (comp_id, context_key(ctx)), fn)`.

### 4.2 `_design(stints) -> Design`
```
players  = sorted({pid for st in stints for pid in st.home_on + st.away_on})            # ids ascendentes → índice p ∈ [0, P)
col_O(p) = p ; col_D(p) = P + p                                                          # 2P columnas
para st en stints:
    si st.poss_home > 0: fila(off=home_on, def=away_on, w=st.poss_home, y=100·st.pts_home/st.poss_home, game=st.game_id)
    si st.poss_away > 0: fila(off=away_on, def=home_on, w=st.poss_away, y=100·st.pts_away/st.poss_away, game=st.game_id)
fila = (game_idx, [col_O(p) para p en off] + [col_D(q) para q en def], w, y)             # 10 columnas activas
mu       = Σ w·y / Σ w                                                                   # nivel base (puntos por 100 posesiones de la competencia)
```
Si `players` < 10 o `filas` = 0 → `datos_insuficientes` (motivo `sin_stints`).

### 4.3 `_normal_equations(rows, mu)` y pliegues
```
A     = [dict() for _ in range(2P)] ; Sy = [0.0]*2P ; S1 = [0.0]*2P        # Sy = Σ w·y·x ; S1 = Σ w·x   (b = Sy − mu·S1)
para fila en rows:  cols = fila.cols
    para i en cols: Ai = A[i]; Sy[i] += w·y ; S1[i] += w ; para j en cols: Ai[j] = Ai.get(j, 0.0) + w
pliegue k: Ak (solo filas con fold(game) == k) y Syk/S1k acumulados igual                                      # una sola pasada sobre las filas
fold(game) = índice del partido en `sorted(game_ids)` módulo `rapm.folds`                                       # determinista (mismo resultado en cualquier worker)
A_train(k) = A − Ak (resta por clave) ; b_train(k) = (Sy − Syk) − mu_k·(S1 − S1k) ; mu_k = (Σwy − Σwy_k)/(Σw − Σw_k)
```
Cada `A_train` se convierte a listas `(idx, val)` por fila para el producto matriz-vector. Memoria ≈ nnz(A) ≈ 80–120 mil entradas por matriz (cinco pliegues + completa: aceptable en 512 MB; se libera tras cada pliegue).

### 4.4 `_cg_solve(Arows, b, lam, x0, deadline) -> (x, iters)` — gradiente conjugado precondicionado
```
diag[i] = Arows.diag[i] + lam   (precondicionador M = diag)
r = b − (A·x0 + lam·x0) ; z = r/diag ; p = z ; rz = r·z
repetir hasta CG_MAXIT:
    Ap = A·p + lam·p ; alpha = rz/(p·Ap) ; x += alpha·p ; r −= alpha·Ap
    si ‖r‖/‖b‖ < CG_TOL: break
    si time.monotonic() > deadline: lanzar RapmTimeout
    z = r/diag ; rz_new = r·z ; p = z + (rz_new/rz)·p ; rz = rz_new
```
`CG_TOL = 1e-5`, `CG_MAXIT = 500`, `MAX_SECS = 150` (constantes técnicas de seguridad respecto del `--timeout 180` de gunicorn, `render.yaml`; no son umbrales de negocio). Con ridge `lam ≥ 1` el sistema es definido positivo (convergencia asegurada).

### 4.5 `_cross_validate(design, lambdas, folds, deadline)`
```
para cada pliegue k en 0..folds−1:
    x = ceros ; para lam en sorted(lambdas):
        x, it = _cg_solve(A_train(k), b_train(k), lam, x0=x, deadline)            # arranque en caliente entre λ ascendentes
        error[lam] += Σ_{filas del pliegue k} w·(y − mu_k − Σ_j x_j·x_ij)² / (Σ w de esas filas)         # error cuadrático ponderado de validación
cv[lam] = error[lam] / folds    (promedio de pliegues)
cv_baseline = mismo error con x = 0 (modelo vacío: solo nivel base)
lam* = argmin cv ; empate → el mayor λ
warnings: lambda_en_el_borde si lam* es el mínimo o el máximo de la grilla (y la grilla tiene > 1 valor) ; sin_mejora_vs_modelo_vacio si cv[lam*] ≥ cv_baseline
```
Con `folds` partidos se garantiza que los stints de un mismo partido no se separan (RF-4). Número de resoluciones: `folds × |grilla| + 1 (final) + 1 (diagnóstico λ_min/100)`.

### 4.6 `_publish(design, x_final, lam)`
```
off_p   = x_final[col_O(p)]            (puntos/100 sobre la media cuando p ataca)
def_p   = −x_final[col_D(p)]           (signo orientado: positivo = reduce los puntos del rival)
total_p = off_p + def_p
poss_off(p) = Σ w de filas con p en off ; poss_def(p) = Σ w de filas con p en def ; possessions = poss_off + poss_def
minutes/games = player_game_stats de la competencia (repository.player_game_rows(comp_id)) por player_id ; DNP no suma
onoff_net(p) = 100·( Σ pts_atacando / Σ poss_atacando − Σ pts_defendiendo / Σ poss_defendiendo ) sobre las filas donde p está en cancha     # crudo, mismas posesiones
sample(p) = sample.sample_level("player", n=minutes, unit="minutos", minutes=minutes, games=games) ; ranked = level != "baja"
población = jugadores con ranked ; para cada métrica en (off, def, total): others = valores de la población sin el propio
   ficha = population.ficha-compatible: rank = 1 + #{others mejores}, tied, percentile = population.percentile(value, others, "higher"), avg = media de la población, leader = máximo (empate: nombre)
reason: jugador sin filas → {"value": null, "reason": "sin_datos"} ; muestra baja → valores presentes, `sample.level = "baja"`, sin rank/percentile (`pct_reason: "muestra_baja"`)
```
Redondeo: `off/def/total` a 2 decimales (se publican ya redondeados; `total = round(off + def, 2)` calculado desde los valores sin redondear), `possessions` a entero, `onoff_net` a 1 decimal.

### 4.7 `_diagnostics(players, design, lam)` (RF-10)
```
ranked    = [p for p in players if p.sample.ranked and p.total.value is not None]
top10     = ordenar ranked por total desc [:10]
p25       = percentil 25 de `possessions` entre `ranked` (interpolación lineal)
dominance = {ok: min(p.possessions for p in top10) >= p25, top_n: 10, top_min_possessions, p25_possessions, ranked_players,
             spearman_abs_total_vs_possessions: stats_engine.spearman([|p.total|], [p.possessions])}
compare   = refit con lam_min/100 (1 resolución extra): top10 sin regularizar vs top10 elegido →
            {lambda: lam_min/100, top10_low_sample_unregularized: #{p en top10_unreg con minutos < sample.player.min},
             top10_low_sample_chosen: #{... en top10 elegido}, top10_overlap: |intersección|}
```
Nota: en el `compare_unregularized` el ranking sin regularizar **no** filtra por muestra (muestra qué pasaría sin ridge); el elegido sí aplica el mínimo de T-02 (RF-9).

### 4.8 `rapm(comp_id, ctx) -> dict` y `rapm_cached(comp_id)`
```
rapm(comp_id, ctx):   # firma Arq. §4; la llama POST /api/rapm/recompute
    ctx se usa solo para `competition`; juegos = partidos con pbp de la competencia
    si #juegos < 2·folds: devolver datos_insuficientes
    t0 = monotonic() ; deadline = t0 + MAX_SECS
    stints = matchups.stints(comp_id, ctx) → design → CV → ajuste final → publish → diagnostics
    payload = {...§3...} ; _RESULTS[comp_id] = {"payload": payload, "data_version": dv, "config_version": cv}          # LRU de 4 competencias
    devolver payload (stale=False)
rapm_cached(comp_id):  # GET
    e = _RESULTS.get(comp_id) ; si e es None → {"status": "sin_calcular", ...}
    stale = (e.data_version, e.config_version) != cache.get_versions()
    devolver {**e.payload, "stale": stale}
```
`_RESULTS` es un dict de proceso (no `cache.memo`: `memo` prefija las versiones en la clave y volvería invisible el resultado viejo; el plan necesita mostrarlo "desactualizado"; ver §10). `RapmTimeout` → la ruta devuelve 502 `timeout_externo` y **no** guarda nada.

### 4.9 `table_rows(req) -> list[TableRow]` (builder T-06)
Lee `rapm_cached`; si no hay resultado devuelve `[]`. Por jugador: `StatBundle` de `player` (loader de T-05, conjunto estándar) + `extra` = `_rapm_off`, `_rapm_def`, `_rapm_total`, `_rapm_poss`, `_onoff_net` y `sample` de T-02.

### Manejo de nulos (C-11)
Jugador sin filas: `off/def/total = null` `sin_datos`. Sin cálculo: `status: "sin_calcular"` (nunca ceros). Jugador de muestra baja: valores presentes, sin ficha (`muestra_baja`). `onoff_net` con denominador 0 → `sin_intentos`. Equipos/partidos sin pbp: contados en `context.games_excluded.sin_pbp`. Posesiones sin quinteto: excluidas y contadas (`model.excluded`).

## 5. Frontend — capa API (api.js)
```js
rapm:          params => apiFetch(`/api/rapm${qs(params)}`),                         // {competition, player, top, diagnostics}
rapmRecompute: body   => send("/api/rapm/recompute", "POST", body),                  // {competition}
```
Reutiliza `api.table("rapm", {competition})` (T-06) y `api.me()` (`is_admin`, F-11) para mostrar el botón. `qs()` omite vacíos. Ningún `fetch` fuera de `api.js`.

## 6. Frontend — UI
- **Dónde:** S4 Jugador → pestaña `impacto` (`#/jugador/<player_id>/impacto?competition=<id>`, `views/jugador.js`). La pestaña ya la habilita X-01 (±, ON/OFF) y A-08 (sinergias); A-11 agrega el bloque "Impacto ajustado".
- **Componente nuevo** `components/rapm-panel.js` → `renderRapmPanel(el, payload, {playerId, isAdmin, onRecompute})`:
  1. **Estado**: `sin_calcular` → mensaje y botón "Calcular impacto ajustado" (solo `isAdmin`); `datos_insuficientes` → mensaje con `games`/`needed`; `listo` con `stale` → banner "Los datos cambiaron desde el último cálculo ({fecha}). Recalculá para actualizar." con botón (admin).
  2. **Tarjeta del jugador**: tres barras horizontales (Ofensivo · Defensivo · Total) centradas en 0 con valor en puntos por 100 posesiones (formato `fmtNumber(v, 1)` con signo; color por `percentileColor(percentile)` solo si hay ficha), y **siempre debajo** "Posesiones: N (ataque a / defensa b) · Minutos m · Partidos g" y `sampleBadge(sample)`. Al lado "ON/OFF crudo: {onoff_net}" con leyenda "Net Rating con el jugador en cancha, sin ajustar". Ranking "X.º de N" con ficha T-01 (`metricCard`).
  3. **Advertencias** (`warnings`) como avisos ámbar.
  4. **Ranking completo**: tabla `rapm` (`createDataTable` + `exportMenu`, T-06) colapsable ("Ver ranking completo"), con el jugador consultado resaltado.
  5. **Detalles del modelo** (`collapsible`, estado en prefs `panel.collapsed`): λ elegido, grilla y curva de error (tabla `cv`; sin Chart.js), pliegues, filas, stints, jugadores, partidos, cobertura, duración, fecha, y la **verificación del ranking** ("Top 10: mínimo {x} posesiones · p25 {y} → ✓/✗"; "Sin regularizar entrarían {n} jugadores de muestra baja al top 10; con el λ elegido, {m}").
- **Acción Recalcular (admin):** `onRecompute` → `api.rapmRecompute({competition})` con botón deshabilitado y texto "Calculando… puede tardar hasta un minuto."; éxito → toast y recarga del bloque; 502 → mensaje de la spec §6; 403 → "Solo un administrador puede recalcular."
- **Reutilizados (Arq. §8):** `metric-card.js`, `sample-badge.js`, `data-table.js`, `export-menu.js`, `collapsible.js`, `core/colors.js`, `core/format.js` (`fmtNumber`, `nullDisplay`), `components/context-bar.js` (muestra "no aplica" para filtros ignorados).
- **Copy:** español rioplatense directo (DA-21 resuelta en `../../00-decisiones.md`: sin `t()` hasta F-21); el copy nuevo queda listado en `docs/frontend.md`.
- **Estados:** loading, vacío, error, offline y éxito según spec §6.
- **Mobile (<768 px):** tarjeta apilada, barras a ancho completo, tabla con primera columna fija, detalles del modelo plegados por defecto; sin cambios en la nav inferior.

## 7. Navegación
Sin sección ni pestaña nueva: usa `impacto` de S4 (Arq. §3.12, ya registrada por X-01). Parámetro de vista `competition` en el hash (contexto T-03: A-11 solo lo usa). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/rapm`: ejemplo completo en §3; fichas §7.1 (acotadas a `total`), `sample` §7.2, nulos §7.4, `context` §7.5.
- Tabla `rapm`: §7.6 (`extra` por fila, T-06). Sin entidad nueva en T-05.
- `_RESULTS[comp_id] = {payload, data_version, config_version}` (memoria de proceso; **no** es una tabla ni se persiste).
- Stint (`matchups.stints`): §4.1. Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `parametro_invalido` | "Elegí una competencia." |
| 400 | `competencia_inexistente` | "La competencia no existe." |
| 401 | — | handler global de `api.js` |
| 403 | `requiere_admin` | "Solo un administrador puede recalcular." |
| 404 | `no_encontrado` | "No encontramos ese jugador." |
| 502 | `timeout_externo` | "El cálculo superó el tiempo máximo. Reducí la grilla de λ en Configuración." |
| 5xx | — | "No se pudo cargar el impacto ajustado." |
Offline: `/api/*` siempre a red; el panel muestra "Sin conexión: el impacto ajustado necesita conexión." Si X-01 no migró a runtime caching, `rapm-panel.js` se suma a `STATIC` en `sw.js` y se sube `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **Rendimiento (DA-25, R-02):** estimación de diseño: matriz normal con ≈ 80–120 mil entradas, ≈ 40 iteraciones de CG por resolución, ≈ 26 resoluciones → del orden de 30 s en Python puro. El plan **no** agrega `numpy` de antemano: la tarea de medición (CA-16) decide. Si supera 30 s, se propone `numpy` como dependencia **justificada** (`backend/requirements.txt`, import protegido en `rapm.py` con el mismo patrón que Playwright; la implementación alternativa `_solve_numpy` usa `numpy.linalg.solve` sobre `A + λI` densa de ≈ 360–500 columnas, milisegundos por resolución). Mientras tanto, mitigaciones de Python puro: arranque en caliente entre λ, precondicionador de Jacobi, tolerancia 1e-5, tiempo máximo de 150 s con abort limpio.
- **Caché volátil y workers:** `_RESULTS` vive en memoria del proceso: se pierde al reiniciar/desplegar y, con varios workers, cada uno tiene la suya. DA-28 (1 worker, hilos) lo mitiga; `docs/deployment.md` indica recalcular tras desplegar. Descartado: persistir coeficientes (regla 4) o recalcular en cada GET (bloquearía el worker).
- **PROPUESTA — almacenamiento propio en lugar de `cache.memo`:** Arq. §3.18 pide "cacheado por (competencia, `data_version`, `config_version`)"; `cache.memo` incluye las versiones en la clave y no permite mostrar un resultado anterior como "desactualizado" ni distinguir "no calculado" de "calculado con versión vieja". Se guarda el resultado con sus versiones en un dict acotado (LRU 4). Reportado en huecos.
- **PROPUESTA — `game_id` en el stint** (Arq. §3.10 lista `{home_on, away_on, poss_home, poss_away, pts_home, pts_away}`): necesario para los pliegues por partido (RF-4). Reportado en huecos.
- **PROPUESTA — parámetros `player`/`top`/`diagnostics`, `status`, `stale`, `warnings`, `diagnostics`** del response de `/api/rapm` (Arq. §6 fija `{players: [{player_id, off, def, total, possessions}], lambda, folds}`): el shape del plan es un superconjunto compatible (las claves de la arquitectura existen con esos nombres; `off`/`def`/`total` son objetos `{value, reason, …}` en lugar de números para cumplir C-11). Reportado como desviación leve.
- **PROPUESTA — `MAX_SECS`, `CG_TOL`, `CG_MAXIT` como constantes técnicas** en `rapm.py` (no son umbrales de negocio; F-13 no las expone).
- **Limitaciones del modelo** (documentadas en `docs/metrics.md`): sin ventaja de localía, sin decaimiento temporal, sin a priori informativo, un coeficiente por ficha de jugador (traspasos), quintetos atribuidos al inicio de la posesión; con pocos partidos (p. ej. los 13 del seed) la validación elige λ grandes y los impactos quedan muy contraídos hacia 0 (comportamiento esperado, se advierte con `lambda_en_el_borde` o `sin_mejora_vs_modelo_vacio`).
- **Dominancia (CA-1):** el diagnóstico mide, no corrige; el mínimo de muestra de T-02 es el mecanismo de exclusión y la regularización el de contracción. Si el diagnóstico falla (`ok == false`), se documenta y se evalúa subir el λ mínimo de la grilla en lugar de tocar el algoritmo.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato en `rapm(comp_id, ctx)`, `matchups.stints`, rutas, tabla `rapm`, claves `rapm.lambdas`/`rapm.folds`; las PROPUESTAS anteriores son agregados.
- **Dependencias técnicas:**
  - A-01 `possessions.game_possessions`, `Possession.own_on_court/opp_on_court/lineup_changed/incomplete` ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md)).
  - F-07 `matchups.py` (módulo base de `stints`) ([../../fase-4-dia-de-partido/01-F-07-analizar-partido/plan.md](../../fase-4-dia-de-partido/01-F-07-analizar-partido/plan.md)).
  - T-02 `sample.sample_level` (jugador) ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - F-13 `CONFIG_SPEC`, `config.get` ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
  - F-11 `auth.admin_required`, `cache.get_versions`, `repository.competition_games`, `repository.player_game_rows` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - C-08 `player_id` ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)).
  - T-01 `population.percentile` y fichas ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - T-05 `StatBundle`, loader `player`, `GET /api/metrics/player` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-06 `register_table`, `TableRow.extra`, `data-table.js`, `export-menu.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - X-01 `registerTab`, `views/jugador.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: XL · 22–34 h** (`matchups.stints` y diseño 4–5 h; ecuaciones normales dispersas, CG y validación cruzada 6–9 h; publicación, fichas y diagnóstico 3–4 h; rutas, config y tabla 2–3 h; UI (panel, acciones admin, detalles) 4–5 h; medición de rendimiento y decisión `numpy` 1–3 h; verificación sobre 13 partidos y docs 2–4 h). Dentro del rango de la arquitectura (XL 20–32 h); +2 h de margen por la verificación numérica del solver y el diagnóstico de dominancia.
