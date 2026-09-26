# Plan — T-02: Confiabilidad de muestra

> **ID:** T-02 · **Prioridad:** P0 · **Fase y orden:** 1·14
> **Depende de:** F-13 ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md)), T-05 ([../13-T-05-conjunto-estandar-metricas/plan.md](../13-T-05-conjunto-estandar-metricas/plan.md)), F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)), C-08 ([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md))
> **Habilita:** T-01, T-06, C-03, F-06, F-19, T-03, F-09, F-10, A-06, A-08, A-11, F-15
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §3 · T-02 · Arquitectura §2.1, §3.2, §3.7, §3.10, §7.1, §7.2, §9.2
> **Estimación:** L · 14–20 h

## 1. Enfoque
Módulo dedicado `backend/sample.py` (DA-37: capa estadística sin persistencia) con las firmas de arquitectura §3.7, que lee
todo de `config.get()` (F-13) y opera sobre los `StatBundle` de T-05. El servicio se engancha en un único punto: el armado
del payload estándar (`metrics_catalog.standard_payload`, T-05), que ya recibe `sample`; T-02 le pasa el badge y agrega `adj`
a OER/DER/Net en las entidades tipo quinteto. Se adelanta `lineups.all_lineups` (firma §3.10, dueño F-06) porque la
calibración y el CA del cliente necesitan enumerar todos los quintetos en fase 1. En el frontend, un componente
`components/sample-badge.js` y la extensión del `standard-panel` de T-05 (gris bajo mínimo, crudo + ajustado ± banda); se
elimina el umbral fijo de 10 posesiones de `app.js`. La calibración se expone como `POST /api/settings/calibrate` (admin) y
un botón en la vista de Configuración de F-13.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/sample.py` | module NUEVO | niveles, umbral relativo, prior, regresión, banda, rankeabilidad, calibración | RF-1…RF-7, RF-9, RF-10, RF-12, RF-15 |
| `backend/lineups.py` | module (mod.) | `all_lineups(team_code, comp_id, ctx, *, size=5)` adelantado (firma §3.10); `_group_segments` interno | RF-12, RF-13 |
| `backend/metrics_catalog.py` | module (mod., dueño T-05) | `standard_payload` recibe el badge de `sample.sample_for` y los `adj` de `sample.adjust_values`; `EntityRequest` sin cambios | RF-1, RF-7, RF-8 |
| `backend/app.py` | route (mod.) | `POST /api/settings/calibrate` (fina, `admin_required`); `GET /api/metrics/<entity_type>` y bloques `standard` pasan por el enganche | RF-1, RF-12 |
| `backend/config.py` | module (mod., dueño F-13) | verificación: las claves `sample.*`/`regression.*`/`sample.ppp_sd`/`sample.band_z`/`sample.relative_enabled` están en `CONFIG_SPEC` con nombre y default de §3.2; si falta alguna, T-02 la agrega | RF-2, RF-4, RF-7, RF-9 |
| `frontend/js/components/sample-badge.js` | js-component NUEVO | `sampleBadge(sample, {compact})` | RF-1, RF-3, RF-11 |
| `frontend/js/components/standard-panel.js` | js-component (mod., dueño T-05) | badge en la cabecera; fila de métrica con crudo + ajustado ± banda; clase gris bajo mínimo | RF-8, RF-11, RF-14 |
| `frontend/js/app.js` | js-view (mod.) | paneles Combinación/ON-OFF/Cierres: badge y ajustados; retirar `r.sample.possessions < 10` y el copy "Muestra chica" | RF-5, RF-11, RF-14 |
| `frontend/js/views/configuracion.js` (vista `config` de F-13; si F-13 la ubicó en otro archivo, se edita ese) | js-view (mod.) | botón "Calibrar K" por entidad en la sección Umbrales + "Aplicar" | RF-12 |
| `frontend/js/api.js` | js-api (mod.) | `api.calibrate(entity, competition)` | RF-12 |
| `frontend/css/style.css` | css (mod.) | sección `/* ── sample-badge (T-02) ── */`: `.sample-badge`, `.sample-baja/.sample-media/.sample-alta`, `.metric-low-sample` (gris), `.adj-value`, `.adj-band` | RF-1, RF-11 |
| `frontend/sw.js` | sw (mod.) | agregar `/js/components/sample-badge.js` a `STATIC`; subir `CACHE` al siguiente entero asignado al integrar | RF-1 |
| `docs/metrics.md` | doc (cierre) | sección "Confiabilidad de muestra": niveles, umbral relativo, regresión, banda, calibración | todos |
| `docs/api.md` | doc (cierre) | `POST /api/settings/calibrate`; `sample` y `adj` en el payload estándar | RF-1, RF-12 |
| `docs/frontend.md` | doc (cierre) | componente `sample-badge`, copy nuevo, retiro de "Muestra chica" | RF-11, RF-14 |
| `docs/architecture.md` | doc (cierre) | módulo `sample.py`; `all_lineups` en `lineups.py` | RF-13 |

Matriz RF→archivo: RF-1 (sample.py, metrics_catalog.py, sample-badge.js, css, sw.js) · RF-2 (sample.py, config.py) · RF-3 (sample.py,
sample-badge.js) · RF-4 (sample.py, config.py) · RF-5 (sample.py, app.js) · RF-6 (sample.py) · RF-7 (sample.py, metrics_catalog.py) ·
RF-8 (metrics_catalog.py, standard-panel.js) · RF-9 (sample.py) · RF-10 (sample.py) · RF-11 (sample-badge.js, standard-panel.js,
app.js, css) · RF-12 (sample.py, lineups.py, app.py, api.js, configuracion.js) · RF-13 (lineups.py) · RF-14 (app.js,
standard-panel.js) · RF-15 (sample.py vía `config.get` + caché versionada).

## 3. Backend — rutas y modelos

Sin cambios de esquema (arquitectura §5: T-02 "sin cambios de esquema").

### `POST /api/settings/calibrate` — NUEVO (arquitectura §6), `login_required` + `admin_required`
- Body: `{"entity": "lineup" | "onoff", "competition": <int>}`. `competition` obligatorio (no admite `all`).
- Response 200:
```json
{
  "entity": "lineup",
  "competition_id": 3,
  "method": "partidos_alternos",
  "units": 42,
  "units_excluded": 118,
  "n_half_mean": 38.4,
  "r": 0.452,
  "k_suggested": 46.6,
  "k_current": 25,
  "config_key": "regression.lineup.k",
  "warnings": []
}
```
  `warnings` ⊆ `["muestra_insuficiente", "correlacion_no_positiva"]`; con cualquiera de ellas `k_suggested = null`.
- Errores (§7.8): 400 `{"error": "Calibración no disponible para esta entidad", "code": "parametro_invalido"}` (entidad fuera de
  {lineup, onoff}); 400 `{"error": "Elegí una competencia", "code": "competencia_inexistente"}` (falta, `all` o id inexistente);
  401 sin sesión; 403 `{"error": "Necesitás permisos de administrador", "code": "requiere_admin"}`.
- No escribe nada: "Aplicar" en la UI llama a `PUT /api/settings {values: {"regression.lineup.k": 47}}` (F-13), que redondea al
  entero y valida el rango 0–500.

### `GET /api/metrics/<entity_type>` (T-05) — campos que agrega T-02
- `sample` (raíz del payload, shape §7.2) para `team`, `player`, `lineup`, `onoff`, `clutch`.
- `metrics.oer.adj`, `metrics.der.adj`, `metrics.net_rating.adj` = `{"value", "k", "prior", "band"}` para `lineup`, `onoff`
  (en ON/OFF, el payload de cada estado lleva los suyos) y `clutch`; `null` en `team`/`player`.
- Ejemplo (combinación, recorte):
```json
{
  "entity": {"type": "lineup", "id": "CNF:12-15-18-21-30", "name": "Prieto · Oglivie · Feldeine · Canty · Rodríguez", "team_code": "CNF"},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {}, "level": "partido", "games_used": 9, "games_total": 9, "games_excluded": {"sin_pbp": 0}, "label": "Todos los partidos"},
  "base": "partido",
  "sample": {"level": "media", "unit": "posesiones", "n": 23.5, "min": 19.2, "high": 40, "min_source": "relativo",
             "games": 4, "minutes": 31.5, "possessions": 23.5, "ranked": true},
  "metrics": {
    "oer": {"value": 1.1915, "reason": null, "adj": {"value": 1.1033, "k": 25, "prior": 1.0203, "band": 0.3237}},
    "der": {"value": 0.9787, "reason": null, "adj": {"value": 1.0000, "k": 25, "prior": 1.0203, "band": 0.3227}},
    "net_rating": {"value": 0.2128, "reason": null, "adj": {"value": 0.1033, "k": 25, "prior": 0.0, "band": 0.4570}}
  }
}
```
- Nulos: sin partidos en la selección → `sample = {"level": "baja", "n": 0, …, "ranked": false}` y métricas `{"value": null,
  "reason": "sin_datos"}`; sin posesiones en un estado ON/OFF → `adj: null` y `reason: "sin_intentos"`.

### `GET /api/team/<team_code>`, `GET /api/player/<team_code>/<player_name>` — dentro de `standard` (T-05)
- `standard.sample`: equipo → unidad `partidos` (`sample.team.*`); jugador → unidad `minutos` (`sample.player.*`). Sin `adj`.

### Endpoints legado `GET /api/lineup`, `/api/onoff`, `/api/clutch`
- Sin cambios de shape (compatibilidad). La UI pasa a leer `/api/metrics/lineup|onoff|clutch` (T-05) para badge y ajustados.

## 4. Backend — lógica

### 4.1 `backend/sample.py` (NUEVO) — firmas de arquitectura §3.7 + auxiliares marcados

Constante de mapeo entidad → prefijo de configuración — **PROPUESTA (no está en 00-arquitectura-transversal.md)**:
```
ENTITY_SAMPLE = {
  "lineup": "lineup", "pair": "pair", "onoff": "onoff", "matchup": "matchup",
  "split": "split", "clutch": "split", "period": "split", "origin": "split",
  "ptype": "split", "chance": "split", "chain": "split",
  "clock": "clock_zone", "zone": "clock_zone", "clutch_lineup": "clutch_lineup",
  "player": "player", "team": "team",
}
UNIT = {"lineup|pair|onoff|matchup|split|clutch|period|origin|ptype|chance|chain": "posesiones",
        "clock|zone": "intentos", "player": "minutos", "team": "partidos", "clutch_lineup": "partidos"}
REGRESSED_TYPES = {"lineup", "pair", "onoff", "matchup", "split", "clutch", "clutch_lineup"}
REGRESSED_KEYS  = ("oer", "der", "net_rating")
```
Los dueños posteriores (C-03 `zone`, F-04 `period`, A-02… ) solo agregan su tipo al mapa si difiere.

| Función | Firma | Entrada | Algoritmo / fórmula | RF |
|---|---|---|---|---|
| `effective_min` | `effective_min(entity_type: str, *, team_poss: float \| None) -> float` | config | `p = ENTITY_SAMPLE[e]`; `m = config.get(f"sample.{p}.min")` (para `clutch_lineup`: `min_poss`); `rel = config.get(f"sample.{p}.rel_pct")` si la clave existe; si `config.get("sample.relative_enabled")` y `rel is not None` y `team_poss`: `return max(m, rel/100·team_poss)`; si no `return m` | RF-2, RF-4 |
| `sample_level` | `sample_level(entity_type, *, n, unit, team_poss=None, games=None, minutes=None, possessions=None) -> dict` | — | `mn = effective_min(...)`; `hi = config.get(f"sample.{p}.high")`; `level = "baja" if n < mn else ("media" if n < hi else "alta")`; `min_source = "relativo" if mn > m_abs else "absoluto"`; devuelve §7.2 con `n` redondeado a 1 decimal, `min` a 1 decimal y `ranked = level != "baja"`. `n` nulo → tratado como 0 (`level = baja`). Caso `clutch_lineup`: `n` = partidos contados, `hi = high_games`, niveles solo `baja`/`alta` | RF-1, RF-3, RF-6 |
| `league_prior` **PROPUESTA** | `league_prior(comp_id: int, ctx: Context) -> float \| None` | `repository.team_game_rows(comp_id)` (F-11) + `context.filter_games` | `Σpts / Σposesiones` sobre todos los equipo-partido de la competencia en el contexto, con `stats_engine.possessions(fga2, fga3, fta, orb, tov)`; `None` si Σposesiones = 0. Caché `cache.memo("sample:prior", (comp_id, context_key(ctx)))` | RF-7 |
| `team_offensive_possessions` **PROPUESTA** | `team_offensive_possessions(team_code: str, comp_id: int, ctx: Context) -> float \| None` | ídem | Σ posesiones ofensivas del equipo en la competencia y el contexto (misma fórmula); caché `sample:team_poss` | RF-4 |
| `adjusted` | `adjusted(value: float \| None, poss: float, prior: float, entity_type: str) -> dict \| None` | config | `if value is None or prior is None: return None`; `K = config.get(f"regression.{p}.k")`; `v_aj = (poss·value + K·prior)/(poss + K)` (si `poss + K == 0` → `None`); `return {"value": round(v_aj, 4), "k": K, "prior": round(prior, 4), "band": band(poss, entity_type, metric_key)}` — ver nota de firma | RF-7, RF-9 |
| `band` | `band(poss: float, entity_type: str, metric_key: str, *, poss_def: float \| None = None) -> float` (**kwarg `poss_def` PROPUESTA**) | config | `z = sample.band_z`, `σ = sample.ppp_sd`, `K` de la entidad; OER/DER: `z·σ/√(poss + K)`; `net_rating`: `z·σ·√(1/(poss + K) + 1/(poss_def + K))`; redondeo 4 decimales | RF-9 |
| `adjust_values` **PROPUESTA** | `adjust_values(values: dict, bundle: StatBundle, prior: float \| None) -> dict` | `values` de `compute_standard`, `bundle.own/opp` | si `bundle.entity_type ∉ REGRESSED_TYPES` → sin cambios. `pos_of = possessions(own)`, `pos_def = possessions(opp)`; `oer.adj = adjusted(oer, pos_of, prior)`; `der.adj = adjusted(der, pos_def, prior)`; `net.adj = {value: oer_aj − der_aj, k, prior: 0.0, band: band(pos_of, e, "net_rating", poss_def=pos_def)}` si ambos existen, si no `None` | RF-7, RF-8, RF-9 |
| `sample_for` **PROPUESTA** | `sample_for(entity_type: str, bundles: list[StatBundle], *, team_poss: float \| None) -> dict` | bundles del loader T-05 | posesiones de cada bundle = `possessions(own)`; `n` según unidad: posesiones (onoff: `min(pos_on, pos_off)` con los dos bundles), minutos (`bundle.minutes`), partidos (`bundle.games`); `games`, `minutes` (`seconds/60` si no hay minutos), `possessions` siempre informados; delega en `sample_level` | RF-1, RF-5 |
| `is_ranked` | `is_ranked(badge: dict) -> bool` | — | `badge is not None and badge["level"] != "baja"` | RF-10, RF-11 |
| `calibrate_k` | `calibrate_k(entity_type: str, comp_id: int) -> dict` | ver 4.3 | ver 4.3 | RF-12 |

Nota de firma: arquitectura fija `adjusted(value, poss, prior, entity_type)` sin `metric_key`; como la banda de OER y DER tiene
la misma fórmula, `adjusted` calcula la banda con `metric_key="oer"` y la de Net la arma `adjust_values` (que conoce ambos
lados). No se cambia la firma pública.

Todas las lecturas de umbrales pasan por `config.get()`, cuyo caché se invalida por `config_version` (F-13, arquitectura
§3.2/§3.14) → RF-15 sin trabajo adicional. `prior` y `team_poss` se cachean con `data_version`/`config_version` en la clave (vía
`cache.memo`, F-11).

### 4.2 `backend/lineups.py` — `all_lineups` adelantado (firma arquitectura §3.10; dueño F-06)
`all_lineups(team_code: str, comp_id: int, ctx: Context, *, size: int = 5) -> list[StatBundle]`
1. `games = repository.team_pbp_games(team_code, comp_id)` → `context.filter_games(games, ctx, team_code)` (en fase 1: `last`).
2. Por partido: `starters = game_starters(...)`; si `None` → contar en `games_excluded` y seguir. `segments =
   build_segments(events, team_code, starters)` (misma lógica endurecida; la constante `PERIOD_LEN` ya corregida por F-11).
3. Por segmento: para cada combinación `c` de `size` jugadores de `on_court` (`itertools.combinations`, ordenada por
   `player_id` —C-08 resuelve nombre → id—): acumular en `acc[c]` los eventos, `seconds` y el `game_id`.
4. Por combinación: `own = _agg(evs, team_code)`, `opp = _agg(evs, opp_code)` (por partido y sumado: pooled), `StatBundle(
   entity_type="lineup", entity_id=f"{team_code}:{'-'.join(ids)}", name=" · ".join(apellidos), own, opp, games=len(game_ids),
   seconds=Σseconds, minutes=Σseconds/60, …)`. Las fórmulas **no** se calculan aquí: el llamador usa
   `stats_engine.compute_standard` (T-05).
5. Caché `cache.memo(f"lineups:{team_code}", (comp_id, context_key(ctx), size), …)` (namespace fijado en §3.14).
F-06 lo extiende (tabla `team_lineups`, `lineup_clutch`) sin cambiar la firma. Riesgo de memoria: para `size=3` hay 10
combinaciones por segmento; acotado por el LRU.

### 4.3 Calibración `calibrate_k(entity_type, comp_id)` — pseudo-código
```
if entity_type not in ("lineup", "onoff"): raise ValueError("no_calibrable")
ctx = Context(competition_id=comp_id)            # sin otros filtros
units = []                                        # (n_a, oer_a, n_b, oer_b)
for team in teams_of(comp_id):
    games = sorted(team_pbp_games(team, comp_id), key=(date, game_id))
    half_a = games[0::2]; half_b = games[1::2]     # partidos alternos (I-10)
    if entity_type == "lineup":
        A = {b.entity_id: b for b in _bundles_for_games(team, half_a, size=5)}   # mismo agrupador que all_lineups
        B = {b.entity_id: b for b in _bundles_for_games(team, half_b, size=5)}
    else:  # onoff: unidad = jugador, estado ON
        A = {pid: on_bundle(onoff over half_a)}; B = {...half_b}
    for uid in A ∩ B:
        n_a, n_b = possessions(A[uid].own), possessions(B[uid].own)
        if n_a + n_b < config.get(f"sample.{p}.min") or n_a == 0 or n_b == 0: excluded += 1; continue
        units.append((n_a, pts_a/n_a, n_b, pts_b/n_b))
warnings = []
if len(units) < 10: warnings.append("muestra_insuficiente")
r = pearson([u.oer_a for u in units], [u.oer_b for u in units]) if len(units) >= 3 else None
if r is None or r <= 0: warnings.append("correlacion_no_positiva")
n_half = mean([(u.n_a + u.n_b)/2 for u in units]) if units else None
k = n_half·(1 − r)/r if not warnings else None
return {entity, competition_id, method: "partidos_alternos", units: len(units), units_excluded: excluded,
        n_half_mean: round(n_half,1), r: round(r,3), k_suggested: round(k,1), k_current: config.get(f"regression.{p}.k"),
        config_key: f"regression.{p}.k", warnings}
```
- `_bundles_for_games` es el agrupador interno de `all_lineups` (pasos 2–4) aplicado a una lista de partidos dada —
  **PROPUESTA**: helper privado `lineups._lineup_bundles(games, team_code, size)` que `all_lineups` también usa (sin
  duplicar lógica).
- Pearson en Python puro (sin dependencias). Tiempo esperado: una pasada por todos los partidos con pbp de la competencia
  (≈ lo mismo que construir todas las poblaciones de quintetos): < 10 s en frío para ~200 partidos; bajo el timeout de 180 s.
- **Dónde queda el resultado**: se devuelve en la respuesta y la UI lo muestra; no se persiste (regla 4). Al aplicar, el K
  queda en `app_config` (`regression.<e>.k`, con `updated_by`/`updated_at`) y sube `config_version`. La corrida sobre el dataset
  de verificación se registra en `progress.md` (evidencia y valor sugerido).

### 4.4 Enganche en el payload estándar (T-05)
En el armado de `GET /api/metrics/<entity_type>` y de los bloques `standard` (función de T-05 que llama a los loaders y a
`standard_payload`), T-02 agrega dos pasos:
```
bundles = loader(req)                                       # T-05
values  = stats_engine.compute_standard(bundle)             # T-05
team_poss = sample.team_offensive_possessions(team, comp, ctx) if entity in ("lineup","pair","onoff","split","clutch") else None
badge   = sample.sample_for(entity_type, bundles, team_poss=team_poss)
prior   = sample.league_prior(comp, ctx) if entity_type in REGRESSED_TYPES else None
values  = sample.adjust_values(values, bundle, prior)       # agrega adj (on y off por separado en onoff)
payload = metrics_catalog.standard_payload(bundle, values, context_echo=…, base=…, sample=badge, fichas=None)
```
`competition=all` → `prior` y `team_poss` se calculan sobre todos los partidos (sin universo no afecta la regresión, solo
percentiles); se informa `context.competition = null`.

## 5. Frontend — capa API (api.js)
- `api.calibrate(entity, competition)` → `POST /api/settings/calibrate` con body JSON `{entity, competition}` (mismo
  `apiFetch`, `credentials` como el resto).
- Consume los ya existentes: `api.metrics(type, params)` (T-05), `api.settings()`, `api.saveSettings(values)` (F-13).

## 6. Frontend — UI

Ubicación en fase 1 (antes de X-01): vista Equipo (paneles Combinación, ON/OFF, Cierres), cabeceras de Equipo y Jugador
(bloque estándar de T-05) y vista `config` detrás del engranaje del header (F-13, sección Umbrales). X-01 los reubica en
S3 `quintetos`/`momentos`, S4 y S9 `umbrales` sin cambiar los componentes.

### 6.1 `components/sample-badge.js` (NUEVO, dueño T-02, arquitectura §8)
`sampleBadge(sample, {compact = false} = {}) -> string`
- `sample` nulo → `""`. `n = 0` → `t('sample.badge.none', 'Sin muestra')` con clase `.sample-baja`.
- Normal: `<span class="sample-badge sample-${level}" title="${tooltip}">${t('sample.badge.level', 'Muestra {nivel}', {nivel: LEVEL_LABEL[level]})}${compact ? "" : " · " + detalle}</span>`
  con `LEVEL_LABEL = {baja: "BAJA", media: "MEDIA", alta: "ALTA"}`, `detalle` = `"{possessions} pos · {games} PJ · {minutes}'"`
  (omitir partes nulas; formato es-UY con `fmtNumber`, C-11).
- Tooltip: `t('sample.badge.min_abs', 'Mínimo {min} {unidad} (piso absoluto) · alta desde {high}')` o
  `t('sample.badge.min_rel', 'Mínimo {min} {unidad} (1,5 % de las posesiones del equipo) · alta desde {high}')` (el % sale de la
  config en el payload de settings cacheado; si no está disponible, se omite el porcentaje).
- Colores: `baja` gris con borde punteado, `media` ámbar (`--yellow` o token existente), `alta` verde (`--green`); texto ≥ 11 px
  en móvil.

### 6.2 `components/standard-panel.js` (dueño T-05) — extensiones
- Cabecera: `sampleBadge(payload.sample)`.
- Si `!payload.sample.ranked`: el contenedor recibe `.metric-low-sample` (valores en `--muted`) y una línea
  `t('sample.low.warning', 'Muestra baja: no entra en rankings ni recomendaciones')`.
- Filas `oer`/`der`/`net_rating` con `adj`: `"<valor crudo> <span class='adj-value'>aj. <ajustado></span> <span class='adj-band'>± <banda></span>"`,
  tooltip `t('sample.adj.tooltip', 'Ajustado hacia la media de la competencia (K = {k}, media {prior})')`. Formato con
  `fmtMetric` del catálogo (T-05).

### 6.3 `app.js` — paneles de Equipo
- `renderTeamLineup`: pasa a renderizar desde `api.metrics('lineup', {id, competition, last})` con `standard-panel` (si T-05
  ya lo migró, solo se verifica); se **elimina** `smallSample` (`r.sample.possessions < 10`, copy "Muestra chica…").
- `renderTeamOnOff`: badge del menor de los dos estados en el título; ajustados de OER/DER/Net por estado en la tabla
  `ON | Eficiencia | OFF | Δ` (Δ del crudo, como hoy; el ajustado se muestra debajo del crudo en cada columna); "sin muestra" →
  `t('sample.onoff.no_sample', '{lado}: sin muestra')`.
- `renderTeamClutch`: badge de entidad `clutch` (split) junto al título; ajustados en las stat-box del agregado.
- Estados: loading = spinner existente; error = mensajes existentes de `docs/frontend.md`; sin conexión = `/api/*` a red.

### 6.4 Configuración (vista de F-13) — sección Umbrales
- Bajo los campos `regression.lineup.k` y `regression.onoff.k`: botón `t('config.calibrate.button', 'Calibrar con los datos cargados')`
  (solo visible si `/api/me.is_admin`), usa la competencia por defecto o la elegida en un select de competencias
  (`api.competitions()`).
- Estados: loading `t('config.calibrate.loading', 'Calibrando…')`; resultado `t('config.calibrate.result', 'K sugerido: {k} (r = {r} · {units} unidades · {n} pos por mitad)')`;
  advertencias `t('config.calibrate.insufficient', 'No hay unidades suficientes para calibrar en esta competencia')` /
  `t('config.calibrate.no_corr', 'La correlación entre mitades no es positiva: no se sugiere K')`; botón
  `t('config.calibrate.apply', 'Aplicar')` → `api.saveSettings({[config_key]: Math.round(k)})` → toast `t('config.calibrate.applied', 'K actualizado')`.
- Mobile 768 px: badge y botón en una línea con wrap; bandas en una segunda línea bajo el valor.

## 7. Navegación
Sin vistas ni hashes nuevos. En fase 2, X-01 ubica los paneles en S3 → `quintetos` / `momentos` y la calibración en S9 →
`umbrales`. Actualizar el mapa de `docs/frontend.md` solo con los componentes.

## 8. Contratos de datos
- Badge (arquitectura §7.2): `{level, unit, n, min, high, min_source, games, minutes, possessions, ranked}` — `level ∈ {baja,
  media, alta}`, `unit ∈ {posesiones, minutos, partidos, intentos}`, `min_source ∈ {absoluto, relativo}`.
- `adj` (arquitectura §7.1): `{value, k, prior, band}`; `net_rating.adj.prior = 0.0`.
- Calibración: shape de §3 de este plan (`warnings` es **PROPUESTA** de extensión de §3.7, junto con `units_excluded`,
  `k_current`, `config_key`, `competition_id`).
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | Cuándo | Mensaje (es) |
|---|---|---|
| 400 `parametro_invalido` | entidad no calibrable | "Calibración no disponible para esta entidad" |
| 400 `competencia_inexistente` | calibrar sin competencia, con `all` o id inexistente | "Elegí una competencia" |
| 401 | sin sesión | handler existente de `api.js` |
| 403 `requiere_admin` | usuario fuera de `ADMIN_USERS` | "Necesitás permisos de administrador" |
Offline: `/api/*` siempre a red; el panel muestra el error de red existente. `sw.js`: `sample-badge.js` a `STATIC` y `CACHE` +1
(número asignado al integrar; si X-01 ya pasó a runtime caching, no hace falta).

## 10. Riesgos / decisiones
- **Pieza adelantada `lineups.all_lineups`** (dueño F-06 en §3.10): T-02 la necesita en fase 1 para calibrar K de quintetos y
  para verificar el CA del cliente; T-01 la usa para la población de quintetos. Se implementa con la firma exacta y F-06 la
  extiende. Reportado como desacuerdo/hueco de la arquitectura (§9.2 no la lista entre las piezas adelantadas).
- **Funciones auxiliares PROPUESTA** (`league_prior`, `team_offensive_possessions`, `adjust_values`, `sample_for`,
  `ENTITY_SAMPLE`, kwarg `poss_def` de `band`, helper `_lineup_bundles`): §3.7 fija el núcleo pero no cómo obtener el prior, las
  posesiones del equipo ni el mapeo entidad→clave; sin ellas cada consumidor lo reimplementaría.
- **Cierres del equipo como `split`** (spec §9): evita inventar un umbral que el cliente no definió.
- **Cambio visible**: el aviso de 10 posesiones pasa a badge con mínimo 15 (o relativo): combinaciones que antes no tenían
  aviso ahora salen `baja`. Se documenta en `docs/frontend.md`.
- **Dataset de verificación (R-05)**: con 13 partidos del seed, pocos quintetos superan 15 posesiones y la calibración dará
  `muestra_insuficiente`; se registra y se verifica con la segunda competencia (o bajando `sample.lineup.min` para la prueba,
  documentado).
- **Rendimiento**: `league_prior` y `team_offensive_possessions` cacheados; `all_lineups` cacheado por equipo. Objetivo: panel
  Combinación < 1,5 s en caliente (§3.14).
- **Objeción a la arquitectura (se sigue igual)**: la regresión de ON/OFF aplica a cada estado por separado con K = 50; el Δ
  ajustado ON−OFF no está definido en §3.7. Se muestra el Δ crudo (como hoy) y los ajustados por estado; F-06 decide si agrega
  Δ ajustado.

**Dependencias técnicas**
- F-13 ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md)): `config.get`, `CONFIG_SPEC` con las claves de
  §3.2, `PUT /api/settings`, vista `config`.
- T-05 ([../13-T-05-conjunto-estandar-metricas/plan.md](../13-T-05-conjunto-estandar-metricas/plan.md)): `StatBundle`,
  `compute_standard`, `standard_payload(sample=…)`, loaders `lineup`/`onoff`/`clutch`/`team`/`player`, `standard-panel.js`,
  `api.metrics`, `fmtMetric`.
- F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)):
  `repository.team_pbp_games`, `repository.team_game_rows`, `cache.memo`, `auth.admin_required`, `PERIOD_LEN` corregido.
- C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md)): `context.Context`, `filter_games`,
  `context_key`.
- C-08 ([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md)): `player_id` para los ids de quinteto.
- C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)): `core/format.js`, `core/i18n.js`.

**Incrementos diferidos**: tabla y tarjetas de quintetos (→ F-06); cierre por quinteto en pantalla (→ F-06); calibración por
posesiones alternas y σ empírico (→ A-01); badges de pareja/emparejamiento/split/zona/tramo (→ A-08, F-07, T-03, C-03, A-05).

**Estimación: L · 14–20 h** (sample.py 5–7 h; all_lineups 2–3 h; enganche y endpoint 2–3 h; frontend 3–4 h; verificación y docs 2–3 h).
