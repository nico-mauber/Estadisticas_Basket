# Plan — F-04: Estadísticas por cuarto

> **ID:** F-04 · **Prioridad:** P1 · **Fase y orden:** 2·09
> **Depende de:** C-06 · T-05 · T-02 · T-03 · X-01 (+ T-01, T-06, F-11, F-13 ya cerrados en fase 1) — rutas en [spec.md](spec.md)
> **Habilita:** — (A-06 reutiliza el tipo `period`)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §4 · F-04 · Arquitectura §2.1, §3.2, §3.5, §3.7, §3.8, §3.11, §3.12, §3.14, §6, §7
> **Estimación:** L · 9–14 h

## 1. Enfoque
Se generaliza la agregación por ventana temporal de `backend/clutch.py` (que ya filtra eventos de pbp por período y reloj) a un conjunto fijo de 8 tramos. Por cada tramo y partido se separan los eventos del equipo y del rival, se suman los conteos crudos (`RAW_KEYS`) y se arma un `StatBundle` que calcula `stats_engine.compute_standard` (regla 4: ninguna fórmula nueva fuera de `stats_engine.py`). El tipo de entidad `period` se registra en `metrics_catalog` y la tabla `period_splits` en `tables.py`. El frontend pide **una sola vez** la tabla de 8 filas (todos los tramos con fichas, badge y `adj`) y el selector cambia de fila en memoria: por construcción no hay recarga (CA del cliente). El desglose por partido se pide a demanda con la misma tabla en modo `partidos`. En la pestaña Momentos se reubica también el bloque de Cierres usando el tipo `clutch` de T-05 y el mismo componente.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/clutch.py` | module (mod.) | `WINDOWS`, `WINDOW_LABELS`, `window_events()`, `window_minutes()`, `events_bundle()`, `period_bundles()`, `period_game_rows()`; `_agg` suma `pf`/`fouls_drawn`/`blk_received`/`plus_minus` | RF-1, RF-2, RF-3, RF-4, RF-10, RF-13 |
| `backend/stats_engine.py` | module (sin cambios de fórmula) | se consume `StatBundle`, `compute_standard` (T-05) | RF-3 |
| `backend/metrics_catalog.py` | module (mod.) | `register_entity("period", _load_period)` | RF-3, RF-8 |
| `backend/tables.py` | module (mod.) | `register_table("period_splits", …)` con builder de 8 filas y modo `partidos` | RF-4, RF-11 |
| `backend/population.py` | consumo | población `period` (miembros = equipos de la competencia en el mismo tramo) vía el loader registrado | RF-8 |
| `backend/sample.py` | consumo | `sample_level("split", …)`, `adjusted(…, "split")`, `band()` | RF-6, RF-7 |
| `backend/context.py` | consumo | `parse_context`, `filter_games`, `event_predicate`, `context_echo` (con `quarter` en `ignored`) | RF-9, RF-10 |
| `backend/repository.py` | consumo | `team_pbp_games(team_code, comp_id)` | RF-2 |
| `backend/app.py` | route | sin rutas nuevas (usa `/api/metrics/<entity_type>` y `/api/table/<table_id>`); verificar que `period` no choca con otras rutas | RF-3, RF-11 |
| `frontend/js/api.js` | js-api | sin métodos nuevos: usa `api.table("period_splits", params)` y `api.metrics("clutch", params)` (T-05/T-06) | RF-5 |
| `frontend/js/components/period-block.js` | js-component **NUEVO** — PROPUESTA (no está en 00-arquitectura-transversal.md) | `renderPeriodBlock(el, payload, {onWindowChange})`: chips + resumen tipo Cierres + `renderStandardPanel` + `sampleBadge` | RF-1, RF-4, RF-5, RF-6, RF-7, RF-8 |
| `frontend/js/views/equipo.js` | js-view (mod.) | pestaña `momentos`: monta bloque por tramo + bloque Cierres; `registerTab("equipo", {slug: "momentos", enabled: true})` si X-01 la dejó deshabilitada | RF-5, RF-12 |
| `frontend/css/style.css` | css | sección `/* ── period-block (F-04) ── */`: chips con scroll horizontal en móvil, estado gris | RF-1, RF-6 |
| `frontend/sw.js` | cache | agregar `/js/components/period-block.js` si `STATIC` sigue existiendo; subir `CACHE` (si X-01 ya pasó a runtime caching, solo subir `CACHE`) | — |
| `docs/api.md` | doc (cierre) | tipo `period` en `/api/metrics/<entity_type>`, tabla `period_splits` (parámetros `view`, `window`) | — |
| `docs/metrics.md` | doc (cierre) | definición de los 8 tramos, minutos por tramo, faltas desde pbp | — |
| `docs/frontend.md` | doc (cierre) | pestaña Momentos, `period-block.js`, copy nuevo | — |
| `docs/architecture.md` | doc (cierre) | `clutch.py` generalizado a tramos | — |

Matriz RF → archivo: RF-1 `clutch.py`, `period-block.js`, `style.css` · RF-2 `clutch.py`, `repository.py` · RF-3 `clutch.py`, `metrics_catalog.py`, `stats_engine.py` · RF-4 `clutch.py`, `tables.py`, `period-block.js` · RF-5 `period-block.js`, `equipo.js` · RF-6 `sample.py`, `period-block.js` · RF-7 `sample.py`, `period-block.js` · RF-8 `population.py`, `metrics_catalog.py`, `period-block.js` · RF-9 `context.py`, `tables.py` · RF-10 `clutch.py`, `context.py` · RF-11 `tables.py`, `equipo.js` (data-table + export-menu) · RF-12 `equipo.js` · RF-13 `clutch.py` (`null_reasons`), `stats_engine.py`.

## 3. Backend — rutas y modelos
**Sin cambios de esquema** (arquitectura §5: F-04 no toca esquema). Sin rutas nuevas: F-04 registra un tipo de entidad y una tabla en los endpoints genéricos.

### 3.1 `GET /api/metrics/period` (endpoint de T-05; tipo `period` NUEVO)
- Parámetros: `id=<team_code>:<tramo>` con `tramo ∈ {q1,q2,q3,q4,h1,h2,pr,last5}` (formato de id: PROPUESTA (no está en 00-arquitectura-transversal.md), mismo estilo que el id de quinteto `<team_code>:<…>` de §3.12); contexto T-03 (`competition`, `last`, `venue`, `opponent`, `rest`, `score`, `on`, `off`; `quarter` se ignora); `base` (T-04: `total|partido|por40|por100`).
- Response (shape §7.3 con fichas §7.1):
```json
{
  "entity": {"type": "period", "id": "CNF:q3", "name": "Nacional — 3.er cuarto", "team_code": "CNF", "window": "q3", "window_label": "3.er cuarto"},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {"last": 5},
              "ignored": [{"param": "quarter", "reason": "no_aplica"}], "level": "evento", "population_mode": "apply_all",
              "games_used": 5, "games_total": 16, "games_excluded": {"sin_pbp": 0}, "label": "Últimos 5 · 3.er cuarto"},
  "base": "partido",
  "sample": {"level": "media", "unit": "posesiones", "n": 92.4, "min": 15, "high": 40, "min_source": "absoluto",
             "games": 5, "minutes": 50.0, "possessions": 92.4, "ranked": true},
  "summary": {"record": "3-2-0", "games_with_window": 5, "pts": 88, "pts_against": 81, "point_diff": 7},
  "groups": [{"key": "volumen", "label": "Volumen", "metrics": ["games", "minutes", "possessions", "pace", "sec_per_poss"]}],
  "metrics": {
    "games": {"value": 5, "reason": null},
    "minutes": {"value": 10.0, "reason": null},
    "oer": {"value": 0.9524, "reason": null, "rank": 4, "rank_total": 12, "tied": false, "in_population": true, "percentile": 71,
            "avg": 0.9311, "dist_avg": 0.0213, "dist_avg_rel": 0.0229, "leader": {"id": "PEN", "name": "Peñarol", "value": 1.0410},
            "dist_leader": -0.0886, "dist_leader_rel": -0.0851, "adj": {"value": 0.9498, "k": 20, "prior": 0.9402, "band": 0.2072}, "sample": null},
    "blk_received": {"value": null, "reason": "no_registrado"},
    "uso_pct": {"value": null, "reason": "no_aplica"}
  },
  "catalog_version": 1
}
```
  El bloque `summary` es PROPUESTA (no está en 00-arquitectura-transversal.md): campos extra del tipo `period` para "la misma información que Cierres"; `standard_payload` admite claves extra del loader (se pide a T-05 aceptar `extra: dict`, ver §10).
- Errores (formato §7.8): `400 {"error": "Tramo inválido. Usá q1, q2, q3, q4, h1, h2, pr o last5", "code": "parametro_invalido"}`; `400 contexto_invalido` (de `parse_context`); `404 {"error": "Equipo no encontrado", "code": "no_encontrado"}`; `404 {"error": "Este equipo no tiene play-by-play importado. Reimportá sus partidos.", "code": "sin_pbp"}` cuando ningún partido de la selección tiene pbp.

### 3.2 `GET /api/table/period_splits` (tabla T-06; id listado en arquitectura §6, dueño F-04)
- Parámetros: `team=<code>` (obligatorio), contexto T-03, `base`; `view=tramos` (default) | `partidos`; `window=<tramo>` (obligatorio si `view=partidos`). `view` y `window` son PROPUESTA (no está en 00-arquitectura-transversal.md).
- `view=tramos`: 8 filas en el orden de `WINDOWS`. Columnas: `_name` (tramo, sticky), `_sample` (badge), `_record` (texto "G-P-E"), `_games_with_window` (int), y una columna `metric` por cada clave de `METRICS` aplicable a `period` (default visibles: `possessions, pts, pts_against, plus_minus, oer, der, net_rating, efg_pct, ts_pct, to_pct, or_pct, ft_rate, pace`). `rows[i].adj` con OER/DER/Net; `rows[i].sample` badge; `rows[i].pct` alineado; `rows[i].link = "#/equipo/<code>/momentos?window=<tramo>"`. `totals` = partido completo (tramo sintético "Partido completo", misma agregación sobre todos los eventos) para control; `competition_avg` = media de la población del tramo por defecto (`q1`) — ver §10. `default_sort = {"key": "_order", "dir": "asc", "use_adjusted": false}` (orden natural de tramos).
- `view=partidos`: una fila por partido con el tramo (fecha, rival, L/V, `entry_margin` solo en `last5`, pts, pts_against, point_diff y las mismas columnas métricas; `pct` null — sin población por partido); `default_sort = {"key": "_date", "dir": "desc"}`.
- Ejemplo de fila (`view=tramos`):
```json
{"id": "CNF:q3", "link": "#/equipo/CNF/momentos?window=q3",
 "values": ["3.er cuarto", null, "3-2-0", 5, 92.4, 88, 81, 7, 0.9524, 0.8766, 0.0758, 0.512, 0.556, 0.141, 0.301, 0.284, 73.9],
 "pct": [null, null, null, null, null, 64, 58, 61, 71, 66, 69, 60, 62, 55, 48, 51, null],
 "adj": {"oer": {"value": 0.9498, "band": 0.2072}, "der": {"value": 0.8812, "band": 0.2051}, "net_rating": {"value": 0.0686, "band": 0.2916}},
 "reasons": {}, "sample": {"level": "media", "n": 92.4, "unit": "posesiones"}}
```
- Errores: `400 {"error": "Falta el equipo", "code": "parametro_invalido"}`; `400` tramo inválido en `view=partidos`; `404 sin_pbp` como en 3.1.

### 3.3 Cierres (sin cambios de contrato)
`GET /api/metrics/clutch?id=<team_code>` (T-05) y `GET /api/clutch/<team_code>` (legado, C-06) se consumen tal cual. `GET /api/table/clutch_games?team=<code>` (C-06 vía T-06) para el desglose por partido de Cierres.

## 4. Backend — lógica
| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `WINDOWS`, `WINDOW_LABELS` | `clutch.py` | `("q1","q2","q3","q4","h1","h2","pr","last5")`; etiquetas vía `t()` backend no existe aún → strings en español (F-21 los traduce) | RF-1 |
| `window_events(events, window, *, window_secs) -> list[dict] \| None` | `clutch.py` (PROPUESTA de firma) | ver pseudo-código | RF-1, RF-10 |
| `window_minutes(events, window, *, window_secs) -> float` | `clutch.py` (PROPUESTA) | q = 10; h = 20; pr = 5 × n_OT; last5 = window_secs/60 + 5 × n_OT | RF-3 |
| `events_bundle(evs, team_code, opp_code, *, entity_type, entity_id, name, seconds, games) -> StatBundle` | `clutch.py` (PROPUESTA; ver §10 coordinación con T-05/C-06) | `own = _agg(team_evs)`, `opp = _agg(opp_evs)` → `RAW_KEYS` | RF-2, RF-3 |
| `_agg(evs)` (mod.) | `clutch.py` | agrega `pf` (eventos `foul` salvo `benchTechnical`/`coachTechnical`), `fouls_drawn` (`foulon`), `blk_received` (se completa en `events_bundle` = `blk` del rival), `plus_minus` (= pts − pts_against, en `events_bundle`); conserva `foul`/`foulon` legado | RF-3, RF-13 |
| `period_bundles(team_code, comp_id, ctx) -> list[StatBundle]` | `clutch.py` (PROPUESTA) | loader del tipo `period`: 8 bundles | RF-2, RF-3, RF-9 |
| `period_game_rows(team_code, window, comp_id, ctx) -> list[dict]` | `clutch.py` (PROPUESTA) | filas por partido para `view=partidos` | RF-4, RF-11 |
| `_load_period(req: EntityRequest) -> list[StatBundle]` | `clutch.py`, registrado en `metrics_catalog` | parsea `entity_id`; para población devuelve los bundles de todos los equipos de la competencia en ese tramo | RF-8 |
| `compute_standard(bundle)` / `apply_base` | `stats_engine.py` (T-05/T-04) | fórmulas del catálogo §3.5 | RF-3 |

### 4.1 Selección de eventos por tramo (pseudo-código)
```
REG = "REGULAR"; OT = PERIOD_TYPES[1]            # "OVERTIME" (constantes compartidas de C-06/F-11)
def window_events(events, window, *, window_secs):
    reg = [e for e in events if e.period_type == REG and e.period]
    last_reg = max(e.period for e in reg) if reg else 4
    ot = [e for e in events if e.period_type == OT]
    if window in ("q1","q2","q3","q4"):  sel = [e for e in reg if e.period == int(window[1])]
    elif window == "h1":                  sel = [e for e in reg if e.period in (1, 2)]
    elif window == "h2":                  sel = [e for e in reg if e.period in (3, 4)]
    elif window == "pr":                  sel = ot                       # vacío → None (partido sin prórroga)
    elif window == "last5":               sel = [e for e in reg if e.period == last_reg and (e.clock_secs or 0) <= window_secs] + ot
    return sel or None
```
- Se reutiliza el criterio de `_is_clutch` corregido por C-06 (prórroga = `period_type` en `PERIOD_TYPES` distinto de `REGULAR`), no una copia nueva: `last5` llama al mismo predicado de ventana que usa Cierres pasándole `margin=None` (sin filtro de diferencia). Si C-06 dejó el predicado como `_is_clutch(ev, last_regular, window_secs)`, `window_events` lo invoca.
- Un evento con `clock_secs` nulo en `last5` se trata como 0 (mismo criterio actual de `_is_clutch`).
- Eventos sin `team_code` (inicio/fin de período, `game`) se descartan al separar lados (no suman nada en `_agg`).

### 4.2 Agregación por tramo (pseudo-código)
```
def period_bundles(team_code, comp_id, ctx):
    games = repository.team_pbp_games(team_code, comp_id)          # [{game_id, events, player_rows, opp_code, info, competition_id}]
    games = context.filter_games(games, ctx, team_code)            # nivel partido: last, venue, opponent, rest
    pred  = context.event_predicate(ctx_sin_quarter, team_code)    # nivel evento: score, on, off (None si no hay)
    ws    = config.get("clutch.window_secs")
    out = []
    for w in WINDOWS:
        team_evs, opp_evs, secs, n_games, rec = [], [], 0.0, 0, {W:0, L:0, T:0}
        for g in games:
            sel = window_events(g.events, w, window_secs=ws)
            if sel is None: continue                                 # el partido no tiene el tramo (pr)
            if pred: sel = [e for e in sel if pred(e, estado(g, e))]  # estado = marcador corrido/en cancha (T-03)
            t = [e for e in sel if e.team_code == team_code]; o = [e for e in sel if e.team_code == g.opp_code]
            n_games += 1; secs += window_minutes(g.events, w, window_secs=ws) * 60
            d = pts(t) - pts(o); rec[W if d > 0 else L if d < 0 else T] += 1
            team_evs += t; opp_evs += o
        b = events_bundle(team_evs, team_code, None, entity_type="period", entity_id=f"{team_code}:{w}",
                          name=f"{team_name} — {WINDOW_LABELS[w]}", seconds=secs or None, games=n_games)
        if n_games == 0: b.null_reasons["*"] = "sin_datos"          # todas las métricas nulas con razón
        b.extra = {"record": f"{rec[W]}-{rec[L]}-{rec[T]}", "games_with_window": n_games, ...}
        out.append(b)
    return out
```
- `StatBundle`: `own`/`opp` = `RAW_KEYS` sumadas; `games` = partidos con el tramo; `minutes = seconds/60`; `team_minutes = None`; `on_court = None`; `shots = {paint_fga, mid_fga, fg3a}` desde calificador `pointsinthepaint` de `pbp_events.qualifiers` (col-v2; si es nulo → `paint_fga_share`/`mid_fga_share` nulos con `no_registrado`); `possessions_counted = None`.
- Con filtro de evento `on`/`off` (T-03), `secs` deja de ser exacto (el tramo no se juega completo con el jugador): en ese caso `minutes` = segundos de los tramos de `build_segments` que caen dentro de la ventana y cumplen la condición (se reutiliza la intersección por reloj que usa T-03 para sus filtros de evento). Si T-03 no expone esos segundos, `minutes`, `pace` y `sec_per_poss` salen nulos con razón `no_aplica` y queda anotado en `progress.md`.
- **Nulos (C-11):** tasas con denominador 0 → `null` `sin_intentos` (lo resuelve `compute_standard`); `blk_received`/`fouls_drawn` son conteos de pbp y siempre existen si hay pbp (`foulon`, `block` del rival); `uso_pct/uso_2p/uso_3p` → `no_aplica`; tramo sin partidos → `sin_datos` en todas.
- **Muestra y regresión:** `sample.sample_level("split", n=POS, unit="posesiones", team_poss=posesiones del equipo en la competencia y contexto, games=n_games, minutes=secs/60, possessions=POS)`; `sample.adjusted(v, POS, prior, "split")` para `oer`/`der` (prior = PPP pooled de la competencia en el mismo tramo y contexto, §2.1) y `net_aj = oer_aj − der_aj`; banda con `sample.band`. `DER` usa las posesiones del rival.
- **Población (T-01):** `population("period", comp_id, ctx)` invoca `_load_period` para cada equipo de la competencia con el mismo tramo (el `entity_id` de la petición fija el tramo); `in_population` según `is_ranked(badge)`. Costo: 12 equipos × ~16 partidos × 8 tramos sobre eventos ya cargados → < 200 ms en frío; cacheado por `cache.memo("pop:period", (comp_id, context_key(ctx), window), …)`.
- **Caché:** `cache.memo("period", (team_code, comp_id, context_key(ctx)), lambda: period_bundles(...))` — namespace `period` es PROPUESTA (no está en 00-arquitectura-transversal.md §3.14). La tabla de 8 filas reutiliza ese resultado.
- **Casos borde:** partido con `last_reg < 4` (pbp truncado) → `q4`/`h2` no existen para ese partido (se excluye del tramo; se cuenta aparte en `context.games_excluded.pbp_incompleto` — PROPUESTA de razón, se reporta como hueco); equipo con eventos solo de un lado en un tramo → se cuenta igual (el rival anotó 0 → `pts_against = 0`, válido).

### 4.3 Bloque Cierres en la misma pestaña
No se toca `team_clutch`. La pestaña consume `GET /api/metrics/clutch?id=<code>` (tipo `clutch` de T-05, que ya aplica C-06: `clutch.margin`, `clutch.window_secs`, prórrogas `OVERTIME`). Si al llegar F-04 el tipo `clutch` de T-05 todavía usa `_box_metrics`, F-04 lo reencamina a `events_bundle` (migración "C-06/F-04 migran cierres", §3.5) sin cambiar el shape legado de `/api/clutch`.

## 5. Frontend — capa API (api.js)
Sin métodos nuevos (regla 9). Se usan los de T-05/T-06:
```js
api.table("period_splits", {team, ...contextToQuery(ctx), base})                 // 8 filas, una sola vez por contexto
api.table("period_splits", {team, view: "partidos", window, ...ctxQuery})        // desglose a demanda
api.metrics("clutch", {id: team, ...ctxQuery})                                    // bloque Cierres
```

## 6. Frontend — UI
- **Ubicación:** S3 Equipo → pestaña `momentos` (`#/equipo/<code>/momentos[?window=q3&…contexto]`), `views/equipo.js`. X-01 ya registra la pestaña (tabla §3.12); F-04 la habilita/completa. El tramo elegido va en la URL (`window`, PROPUESTA de parámetro de vista, no de contexto T-03) con `history.replaceState` para no disparar `hashchange` ni re-render (RF-5).
- **Componentes reutilizados (§8 arquitectura):** `renderStandardPanel` (T-05), `metricCard`/`bindMetricCards` (T-01, hover con `api.ranking("period", key, …)`), `sampleBadge` (T-02), `createDataTable` + `exportMenu` (T-06), `renderContextBar`/`quick-filters` (T-03/F-19), `renderTabs` (X-01), `fmtMetric`/`nullDisplay` (C-11/T-05), `t()`.
- **Componente nuevo** `components/period-block.js` (PROPUESTA): `renderPeriodBlock(el, tablePayload, {initialWindow, onWindowChange})`:
  1. Dibuja una vez la estructura: fila de chips (`button.filter-pill` existentes), contenedor de resumen, contenedor del panel y botón "Ver partido a partido".
  2. `select(window)`: toma la fila `id == <team>:<window>` del payload ya cargado, convierte `values/pct/adj/sample` al shape de `renderStandardPanel` (helper `rowToStandard(payload, row)`), repinta **solo** resumen + panel. Sin `fetch`.
  3. Chips de tramos con `games_with_window == 0` → `disabled` + `title`.
  4. "Ver partido a partido" → `api.table(... view: "partidos", window)` y `createDataTable` en un contenedor plegable debajo; cambiar de tramo con la tabla abierta la vuelve a pedir (es la única llamada al cambiar de tramo, y no redibuja el bloque).
- **Resumen tipo Cierres** (misma información que `renderTeamClutch`): Dif (signed, verde/rojo por signo), Pts F / C, récord del tramo "G-P-E", "N partido(s) con el tramo", badge. OER/DER/Net muestran crudo + ajustado ± banda.
- **Cierres** debajo, con el mismo `renderStandardPanel` + tabla `clutch_games`; título leído de `margin`/`window_secs` del payload (C-06).
- **Estados:** loading con `spinner` y copy del spec §6; vacío (sin pbp); error (mensaje del backend); offline (mensaje de sin conexión); muestra baja (clase gris + aviso). Todo copy con `t('equipo.momentos.<clave>', 'Texto')`.
- **Mobile (<768 px):** chips en una fila con `overflow-x: auto` y `scroll-snap`; panel del conjunto estándar en una columna; la tabla partido a partido usa la columna fija de T-06; la barra inferior fija no se tapa (padding inferior existente).

## 7. Navegación
Sin sección nueva. Pestaña `momentos` de S3 (existente en el registro de X-01). Parámetro de vista `window` en la query del hash (se conserva al recargar; no se propaga a otras secciones). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- `period` → shape §7.3 + `entity.window`, `entity.window_label`, `summary{record, games_with_window, pts, pts_against, point_diff}` (§3.1).
- `period_splits` → payload §7.6 (§3.2); columnas extra `_record`, `_games_with_window`, `_order`, `_date`, `_opponent`, `_venue`, `_entry_margin` (tipo `text`/`int`, sin `pct`).
- Metadatos de exportación (§7.7): `section: "momentos"`, `filters` incluye `{"label": "Tramo", "value": "3.er cuarto"}`; nombre de archivo `momentos-<tramo>_<team>_<competencia-slug>_<fecha>`.
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | Cuándo | Mensaje (español) |
|---|---|---|
| 400 `parametro_invalido` | tramo fuera de la lista, falta `team` | "Tramo inválido. Usá q1, q2, q3, q4, h1, h2, pr o last5" / "Falta el equipo" |
| 400 `contexto_invalido` | valor de contexto desconocido | mensaje de `parse_context` |
| 401 | sin sesión | handler global de `api.js` (login) |
| 404 `no_encontrado` | equipo inexistente | "Equipo no encontrado" |
| 404 `sin_pbp` | ningún partido con pbp en la selección | "Este equipo no tiene play-by-play importado. Reimportá sus partidos." |
Offline: `/api/*` siempre a red (SW); la UI muestra el copy de sin conexión y conserva el último bloque dibujado. `sw.js`: sumar `period-block.js` a `STATIC` (o confiar en el runtime caching de X-01) y subir `CACHE` al siguiente entero asignado al integrar.

## 10. Riesgos / decisiones
- **Sin recarga por construcción:** se cargan los 8 tramos en una llamada (cada tramo trae fichas T-01 → la población por tramo se calcula para los 8; costo acotado y cacheado). Alternativa descartada: pedir `/api/metrics/period` por tramo al hacer clic (cumple "sin recargar la pantalla" pero agrega latencia por clic).
- **`competition_avg` de la tabla:** el payload §7.6 admite una sola fila de promedio; en `view=tramos` cada fila es un tramo distinto, así que se muestra el promedio de la competencia **del tramo seleccionado** (el frontend lo toma de `metrics[*].avg` de la ficha). Se deja `competition_avg` = `null` en el payload de 8 filas. Desviación menor de §7.6, justificada.
- **Coordinación con T-05/C-06 (migración de Cierres):** la arquitectura asigna la migración de Cierres a "C-06/F-04". Si T-05 ya creó un constructor de `StatBundle` desde eventos para el tipo `clutch`, `events_bundle` **es** ese constructor (se renombra o se reexporta, sin duplicar). Riesgo de trabajo duplicado → revisar el código de T-05 antes de T-B2.
- **`standard_payload` con campos extra:** el tipo `period` necesita `summary` además del conjunto estándar. Se pide a T-05 que `standard_payload(..., extra=None)` acepte un dict extra; si no, `summary` viaja en `entity.summary`. Reportado como hueco.
- **Razón `no_aplica` en `context.ignored`:** la arquitectura solo fija `requiere_posesiones` para `ignored`; se usa `no_aplica` (código existente de §7.4). Reportado como hueco.
- **Faltas desde pbp vs box:** el box oficial (`pf`) puede diferir del conteo de eventos `foul` (técnicas). Se verifica en el partido completo y se documenta en `docs/metrics.md`.
- **Filtros `on`/`off` con tramo:** combinación válida (T-03) pero con minutos no triviales; ver §4.2.
- **Desviaciones respecto de la arquitectura:** (1) componente `period-block.js` no listado en §8; (2) parámetros `view`/`window` de `period_splits`; (3) formato de id `<team>:<tramo>`; (4) namespace de caché `period`. Todas marcadas PROPUESTA.
- **Dependencias técnicas:** `stats_engine.StatBundle`, `compute_standard`, `metrics_catalog.register_entity`, `standard_payload` ([T-05 plan](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)); `sample.sample_level/adjusted/band/is_ranked` ([T-02 plan](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)); `population.population/attach_fichas`, `metric-card.js` ([T-01 plan](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)); `tables.register_table`, `data-table.js`, `export-menu.js` ([T-06 plan](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)); `PERIOD_TYPES`, predicado de ventana y `clutch.window_secs` ([C-06 plan](../../fase-1-confiabilidad/05-C-06-umbral-cierres/plan.md), [F-13 plan](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)); `repository.team_pbp_games`, `cache.memo`, `period_pts` ([F-11 plan](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)); `context.parse_context/filter_games/event_predicate/context_echo`, `core/context.js` ([T-03 plan](../02-T-03-selector-global-contexto/plan.md)); `core/router.js`, `registerTab`, `views/equipo.js` ([X-01 plan](../01-X-01-reorganizacion-navegacion/plan.md)).
- **Estimación:** L · 9–14 h (la arquitectura estimó M 6–10 h; se suma la migración del bloque Cierres a la pestaña, la población por tramo y la verificación con prórrogas).
