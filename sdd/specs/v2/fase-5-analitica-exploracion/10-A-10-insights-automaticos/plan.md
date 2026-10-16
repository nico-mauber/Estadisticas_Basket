# Plan — A-10: Insights automáticos en texto

> **ID:** A-10 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 10
> **Depende de:** T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)) · F-17 ([../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md)); consume T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)), T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)), F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)), X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)), C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md), `player_id`)
> **Habilita:** F-12, F-21
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Arquitectura §3.15, §3.6, §3.7, §3.2, §4, §6, §7.1, §7.4, §7.8, §8
> **Estimación:** L · 8–11 h

## 1. Enfoque
A-10 es una extensión fina del motor de frases de F-17. Agrega tres cosas: (1) plantillas genéricas de percentil extremo por
dirección de métrica y de cambio de rendimiento (`es.json`) y la sección `insights` de `rules.json` (qué métricas entran); (2) el
módulo `backend/insights.py`, que pide la población de T-01, calcula la ficha de cada métrica, dispara con `percentil ≤ insights.low_pct`
o `≥ insights.high_pct`, ordena por extremidad, deduplica por familia, rellena la plantilla y **verifica la coherencia** de cada frase
contra su ficha antes de emitirla; (3) el endpoint `GET /api/insights` y el bloque "Insights" en Resumen de Equipo y de Jugador.
`insights.sudden_changes` reutiliza el cálculo de período anterior de F-17 (`phrases.score_candidates`) para definir el "cambio
brusco" que consumirá F-12. Nada se persiste, no hay esquema nuevo y todo umbral sale de `config.get()`.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/insights.py` | module **NUEVO** | `insights`, `insights_payload`, `sudden_changes`, helpers de coherencia | RF-1…RF-12, RF-15, RF-16 |
| `backend/phrases.py` (F-17) | module (edit) | `WHEN_VALUES` += `cambio_mejora`/`cambio_empeora`; `validate_templates` valida cobertura genérica y de `rules["insights"]`; `_candidates` pasa a público `score_candidates` (PROPUESTA, §10) y `game_plan` lo reutiliza | RF-3, RF-14, RF-16 |
| `backend/phrases/es.json` (F-17) | datos (edit) | 8 plantillas nuevas: 6 genéricas de percentil extremo y 2 de cambio | RF-3, RF-5, RF-7, RF-14, RF-16 |
| `backend/phrases/rules.json` (F-17) | datos (edit) | sección `insights` (métricas de equipo y de jugador) y `as_pos` en la familia `circulacion` | RF-8, RF-10 |
| `backend/config.py` (F-13) | module (edit) | activar `insights.low_pct`, `insights.high_pct`, `insights.min_items`, `insights.max_items` (`status: activa`, consumidor A-10) | RF-2, RF-15 |
| `backend/app.py` | route | `GET /api/insights` fina (validación de `entity`/`id`, `parse_context`, errores §7.8) | RF-1, RF-12 |
| `frontend/js/api.js` | js-api | `api.insights(params)` | RF-13 |
| `frontend/js/components/insights-panel.js` | js-component **NUEVO** (PROPUESTA, §10) | `renderInsights(el, payload, opts)`, tono, evidencia, estados | RF-13, RF-17 |
| `frontend/js/views/equipo.js` (X-01) | js-view | montar el bloque en `resumen` (entidad `team`), refresco con `onContextChange` | RF-12, RF-13 |
| `frontend/js/views/jugador.js` (X-01) | js-view | montar el bloque en `resumen` (entidad `player`, `player_id`) | RF-12, RF-13 |
| `frontend/css/style.css` | css | sección `/* ── insights-panel (A-10) ── */`: `.ins-list`, `.ins-item`, `.ins-pos`/`.ins-neg`/`.ins-neu`, `.ins-evidence`, <768 px | RF-13 |
| `frontend/sw.js` | sw | con runtime caching (X-01) basta subir `CACHE` al siguiente entero; si no, sumar `/js/components/insights-panel.js` a `STATIC` | §9 |
| `docs/api.md` | doc (cierre) | `GET /api/insights` | — |
| `docs/frontend.md` | doc (cierre) | `insights-panel.js`, bloque en Resumen, copy nuevo | — |
| `docs/architecture.md` | doc (cierre) | módulo `insights.py`, plantillas de insights | — |
| `docs/metrics.md` | doc (cierre) | "Insights automáticos": regla de disparo, familias, cambio brusco | — |

Matriz RF → archivo: RF-1/RF-2 `insights.py`, `config.py` · RF-3/RF-14 `es.json`, `phrases.py` · RF-4/RF-6 `insights.py`
(coherencia con la ficha) · RF-5/RF-7 `es.json` (plantillas por dirección) · RF-8 `rules.json`, `insights.py` · RF-9/RF-10 `insights.py` ·
RF-11 `insights.py`, `insights-panel.js` · RF-12 `insights.py`, `app.py`, vistas · RF-13 `insights-panel.js`, vistas, `api.js` ·
RF-15 `config.py` · RF-16 `insights.py`, `phrases.py` · RF-17 `es.json`, `insights-panel.js`.

## 3. Backend — rutas y modelos

### 3.1 Esquema
Sin tablas ni columnas nuevas. Lee `app_config` (claves `insights.*`) vía `config.get`.

### 3.2 `GET /api/insights` — NUEVO (dueño A-10, `login_required`)
Query: `entity` ∈ {`team`, `player`} (obligatorio); `id` (obligatorio: `team_code` o `player_id` entero); contexto T-03
(`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, …) con `context.parse_context(request.args,
team_code=…|player_id=…)`. `base` se ignora.

Response 200 (equipo, tres frases):
```json
{
  "entity": {"type": "team", "id": "CNF", "name": "Nacional"},
  "insights": [
    {"metric": "to_pct", "label": "TO%", "tone": "positivo", "when": "extremo_alto", "family": "to_pct",
     "percentile": 99, "value": 0.1189, "avg": 0.1652, "rank": 1, "rank_total": 12,
     "template_id": "generico_lower_extremo_alto",
     "text": "Nacional está entre los mejores de la competencia en TO% (percentil 99: 11,9% frente a 16,5% de promedio; menos es mejor)"},
    {"metric": "efg_pct", "label": "eFG%", "tone": "positivo", "when": "extremo_alto", "family": "tiro",
     "percentile": 92, "value": 0.5612, "avg": 0.5243, "rank": 2, "rank_total": 12,
     "template_id": "generico_higher_extremo_alto",
     "text": "Nacional está en el percentil 92 de eFG% de la competencia (56,1% frente a 52,4% de promedio)"},
    {"metric": "fg3_uso", "label": "Uso de triple", "tone": "neutro", "when": "extremo_bajo", "family": "fg3_uso",
     "percentile": 8, "value": 0.2814, "avg": 0.3466, "rank": 11, "rank_total": 12,
     "template_id": "generico_neutral_extremo_bajo",
     "text": "Nacional está en el percentil 8 de Uso de triple de la competencia (28,1% frente a 34,7% de promedio)"}
  ],
  "below_min": false,
  "reason": null,
  "rule": {"low_pct": 10, "high_pct": 90, "min_items": 3, "max_items": 5,
           "metrics_evaluated": 17, "extremes_found": 4},
  "sample": {"level": "media", "unit": "partidos", "n": 7, "min": 3, "high": 10, "min_source": "absoluto",
             "games": 7, "minutes": null, "possessions": null, "ranked": true},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
              "applied": {"last": 5}, "ignored": [], "level": "partido", "population_mode": "apply_all",
              "games_used": 5, "games_total": 16, "games_excluded": {"sin_pbp": 0}, "label": "Últimos 5"},
  "catalog_version": 1
}
```
`tone` ∈ {`positivo`, `negativo`, `neutro`}; `rank`/`rank_total` provienen de la ficha. Sin frases (200): `insights: []` y `reason` ∈
{`muestra_baja`, `contexto_no_comparable`, `sin_universo`, `poblacion_insuficiente`, `sin_datos`, `sin_extremos`}; con menos de
`min_items`: `below_min: true`. Jugador: `entity: {"type": "player", "id": 128, "name": "A. Varela", "team_code": "CNF"}` y
`sample.unit = "minutos"`.

Errores (formato §7.8):
| Caso | HTTP | `code` | `error` |
|---|---|---|---|
| Falta `entity` o valor desconocido | 400 | `parametro_invalido` | "Falta el parámetro entity" / "Entidad desconocida: usá team o player" |
| Falta `id` o `player_id` no numérico | 400 | `parametro_invalido` | "Falta el parámetro id" / "El id del jugador debe ser un número" |
| Contexto inválido | 400 | `contexto_invalido` | mensaje de `parse_context` (T-03) |
| Competencia inexistente | 400 | `competencia_inexistente` | mensaje de `resolve_competition` |
| Equipo o jugador inexistente | 404 | `no_encontrado` | "Equipo no encontrado" / "Jugador no encontrado" |
| Plantillas inválidas | 500 | `plantillas_invalidas` | "Las plantillas de insights no son válidas" |
| Sin sesión | 401 | — | handler de `api.js` |

### 3.3 Configuración (F-13)
F-13 reserva `insights.low_pct` (int, 10, 0–100), `insights.high_pct` (int, 90, 0–100), `insights.min_items` (int, 3, 1–10),
`insights.max_items` (int, 5, 1–10) con reglas de coherencia `low_pct < high_pct` y `min_items ≤ max_items`. A-10 solo las pasa a
`status: activa` y fija el consumidor; no agrega claves. (Las claves `alerts.*` las agrega F-12.)

## 4. Backend — lógica

### 4.1 Plantillas nuevas (`backend/phrases/es.json`)
Ocho plantillas con `metric: "*"` (genéricas por dirección; `entities: ["team", "player"]`), sin dígitos, con los marcadores
permitidos de la arquitectura §3.15:

| `id` | `direction` | `when` | `text` |
|---|---|---|---|
| `generico_higher_extremo_alto` | `higher` | `extremo_alto` | {entidad} está en el percentil {p} de {metrica} de la competencia ({valor} frente a {media} de promedio) |
| `generico_higher_extremo_bajo` | `higher` | `extremo_bajo` | {entidad} está en el percentil {p} de {metrica} de la competencia ({valor} frente a {media} de promedio) |
| `generico_neutral_extremo_alto` | `neutral` | `extremo_alto` | {entidad} está en el percentil {p} de {metrica} de la competencia ({valor} frente a {media} de promedio) |
| `generico_neutral_extremo_bajo` | `neutral` | `extremo_bajo` | {entidad} está en el percentil {p} de {metrica} de la competencia ({valor} frente a {media} de promedio) |
| `generico_lower_extremo_alto` | `lower` | `extremo_alto` | {entidad} está entre los mejores de la competencia en {metrica} (percentil {p}: {valor} frente a {media} de promedio; menos es mejor) |
| `generico_lower_extremo_bajo` | `lower` | `extremo_bajo` | {entidad} está entre los peores de la competencia en {metrica} (percentil {p}: {valor} frente a {media} de promedio; menos es mejor) |
| `cambio_mejora` | — | `cambio_mejora` | {metrica} de {entidad} mejoró a {valor} en el tramo reciente (antes {referencia}; {delta}) |
| `cambio_empeora` | — | `cambio_empeora` | {metrica} de {entidad} empeoró a {valor} en el tramo reciente (antes {referencia}; {delta}) |

La primera fila es **literalmente** la plantilla del cliente ("{equipo}" → `{entidad}`, "{métrica}" → `{metrica}` por los nombres fijados
en la arquitectura §3.15). Las de `higher` y `neutral` comparten texto pero tienen ids distintos para poder cambiarlas por separado
(F-21, ajustes de redacción) sin tocar la lógica. `{delta}` en `cambio_*` es la **diferencia aritmética** propio − referencia con signo
(`format_value(..., delta=True)`): así "mejoró a 14,2% (antes 16,0%; −1,8 pp)" en TO% no se lee al revés.

### 4.2 Reglas (`backend/phrases/rules.json`)
Se agrega:
```json
"insights": {
  "team":   ["oer", "der", "net_rating", "pace", "efg_pct", "ts_pct", "ppt", "fg2_pct", "fg3_pct", "ft_pct",
             "fg3_uso", "ft_rate", "to_pct", "or_pct", "dr_pct", "ast_to", "as_pct"],
  "player": ["oer", "efg_pct", "ts_pct", "ppt", "fg2_pct", "fg3_pct", "ft_pct", "ft_rate", "fg3_uso", "uso_pct",
             "to_pct", "or_pct", "dr_pct", "as_pct", "ast_to", "as_pos"]
}
```
y `as_pos` en `families.circulacion` (`["ast_to", "as_pct", "as_pos"]`). Toda clave debe existir en `metrics_catalog.METRICS` y tener
`base_mode == "fixed"` (lo comprueba `validate_templates`).

### 4.3 `backend/phrases.py` — cambios
- `WHEN_VALUES` pasa a `("ventaja", "riesgo", "extremo_alto", "extremo_bajo", "cambio_mejora", "cambio_empeora")`.
- `validate_templates` suma: (a) por cada `direction` ∈ {higher, lower, neutral} y `when` ∈ {extremo_alto, extremo_bajo} existe una
  genérica para `team` y para `player`; (b) existen `cambio_mejora` y `cambio_empeora`; (c) cada métrica de `rules["insights"][entity]`
  tiene dirección conocida y resuelve plantilla para ambos extremos; se mantienen las reglas existentes (sin dígitos, marcadores permitidos) y el largo máximo
  por `when`: `MAX_LEN` suma 160 caracteres para `extremo_alto`, `extremo_bajo`, `cambio_mejora` y `cambio_empeora`.
- `pick_template` ya resuelve genéricas (`metric == "*"`) por `direction` (F-17 §4.2); no cambia.
- `score_candidates(entity_type, entity_id, *, reference, rival, comp_id, ctx, mode="perfil") -> dict`: el bloque de F-17 que arma
  `candidatos` (población, miembro propio, referencia, `z`, ficha) se extrae a esta función pública y devuelve
  `{"candidates": [...], "reason": str | None, "pop": Population, "own": member, "ref_sample": dict | None, "sample_warning": bool}`;
  `game_plan` la llama y aplica `_select`. Sin cambio de comportamiento para F-17 (refactor verificable con T-F2 de F-17 de nuevo).

### 4.4 `backend/insights.py` (NUEVO)

| Función | Firma | Algoritmo |
|---|---|---|
| `insights` | `insights(entity_type: str, entity_id: str \| int, comp_id: int, ctx: Context) -> list[dict]` | `return insights_payload(...)["insights"]` (firma de la arquitectura §4). |
| `insights_payload` | `insights_payload(entity_type, entity_id, comp_id, ctx) -> dict` (PROPUESTA, §10) | Ver pseudo-código. Cacheado: `cache.memo("insights", (entity_type, str(entity_id), comp_id, context.context_key(ctx)), fn, max_entries=128)` (la clave se prefija con `data_version`/`config_version`, §3.14). |
| `sudden_changes` | `sudden_changes(team_code: str, comp_id: int, ctx: Context, *, window_games: int, change_z: float) -> dict` (PROPUESTA, §10) | Ver 4.5. |
| `_coherent` | `_coherent(item: dict, ficha: dict, cfg: dict) -> bool` | Verdadero solo si: `when == "extremo_alto"` ⇒ `ficha.percentile ≥ cfg.high_pct`; `when == "extremo_bajo"` ⇒ `ficha.percentile ≤ cfg.low_pct`; `item.percentile == ficha.percentile`; `item.value == ficha.value`; `item.avg == ficha.avg`. Si falla: no se emite y se registra `log.warning("insight descartado por incoherencia", metric, …)` (nunca debería ocurrir; es una red de seguridad del CA-1). |
| `_tone` | `_tone(when: str, direction: str) -> str` | `neutral` → `neutro`; `extremo_alto` → `positivo`; `extremo_bajo` → `negativo` (el percentil ya está orientado: alto = mejor). |
| `_games_total` | `_games_total(entity_type, entity_id, comp_id) -> int` | Partidos de la entidad en la competencia sin filtros (`repository.team_game_rows` / `repository.player_game_rows` con `played(minutes)` para jugador). Para `context_echo`. |

`insights_payload` — pseudo-código:
```
si entity_type no en ("team", "player"): InsightError("parametro_invalido", 400)
cfg = {low_pct, high_pct, min_items, max_items} = config.get("insights.*")                    # RF-15
si ctx.competition_all:                                   → vacío, reason "sin_universo"
si context.population_mode(ctx) == "entity_only":         → vacío, reason "contexto_no_comparable"
pop = population.population(entity_type, comp_id, ctx)                                          # T-01, cacheada
si miembros in_population < config.get("population.min_size"): → vacío, reason "poblacion_insuficiente"
own = _member(pop, str(entity_id));  si own es None:      → vacío, reason "sin_datos"
si own.sample.level == "baja":                            → vacío, reason "muestra_baja"         # T-02, RF-9
rules = phrases.load_rules();  metrics = rules["insights"][entity_type]
cands = []
para order, m en enumerate(metrics):
    d = METRICS[m]
    si entity_type no en d.entities: continuar                                                    # no_aplica
    v = own.values.get(m);  si v es None: continuar                                               # RF-10, C-11
    f = population.ficha(m, v, entity_id, pop);  p = f["percentile"]
    si p es None o f["avg"] es None: continuar
    si p >= cfg.high_pct: when = "extremo_alto"
    elif p <= cfg.low_pct: when = "extremo_bajo"
    sino: continuar                                                                               # RF-2
    cands += [{metric: m, label: d.label, when, family: _family(m, rules), order, extremeness: abs(p − 50),
               direction: d.direction, percentile: p, value: v, avg: f["avg"], rank: f["rank"], rank_total: f["rank_total"]}]
ordenar cands por (−extremeness, order)
out, used = [], set()
para c en cands:                                                                                   # RF-8
    si c.family en used: continuar
    tpl = phrases.pick_template(c.metric, c.when, entity_type, direction=c.direction)
    si tpl es None: continuar
    text = phrases.render(tpl["id"], {entidad: own.name, metrica: c.label, p: str(c.percentile),
               valor: phrases.format_value(c.metric, c.value), media: phrases.format_value(c.metric, c.avg)})
    item = {metric, label, tone: _tone(c.when, c.direction), when, family, percentile, value, avg, rank, rank_total, template_id: tpl["id"], text}
    si no _coherent(item, f, cfg): continuar
    out += [item]; used += {c.family}
    si len(out) == cfg.max_items: parar
below_min = len(out) < cfg.min_items
reason = "sin_extremos" si len(out) == 0 sino None
devolver {entity: {type, id, name}, insights: out, below_min, reason,
          rule: {…cfg, metrics_evaluated: len(metrics), extremes_found: len(cands)},
          sample: own.sample, context: context.context_echo(ctx, games_used=own.sample.games, games_total=_games_total(…), …), catalog_version}
```
**Fórmulas / reglas:** percentil, ranking y promedio son los de T-01 (`population.ficha`; arquitectura §3.6: percentil mid-rank que
excluye a la propia entidad, orientado: alto = mejor); este módulo no calcula ninguna métrica ni percentil propio (regla 4:
nada de fórmulas de métricas fuera de `stats_engine`). Extremidad = `|percentil − 50|`.

**Nulos (C-11):** métrica nula, sin percentil o sin promedio → se omite (no hay frase con "—" ni con 0). `metrics_evaluated −
extremes_found` no distingue los omitidos por nulo de los no extremos (solo cuenta informativa).

**Casos borde:** jugador sin `player_id` en la población (fuera de los ≥ `sample.player.min` minutos) → `muestra_baja`; equipo con
`in_population: false` → ídem; `max_items < min_items` imposible por la coherencia de F-13; empate de extremidad → orden de catálogo;
percentiles redondeados a entero (T-01) comparan contra umbrales enteros (inclusivos).

### 4.5 `sudden_changes` — definición operativa de "cambio brusco"
```
sudden_changes(team_code, comp_id, ctx, *, window_games, change_z) -> dict
    si window_games < 1 o change_z <= 0: InsightError("parametro_invalido", 400)
    si window_games < config.get("sample.team.min"):  devolver {"changes": [], "reason": "muestra_baja", window_games, change_z}
    ctx_w = dataclasses.replace(ctx, last=window_games)
    sc = phrases.score_candidates("team", team_code, reference="periodo_anterior", rival=None, comp_id=comp_id, ctx=ctx_w)
    si sc["reason"]: devolver {"changes": [], "reason": sc["reason"], …}        # periodo_anterior_insuficiente, muestra_baja, …
    cambios = [c para c en sc["candidates"] si abs(c.z) >= change_z]            # |z| = |delta orientado| / desvío poblacional
    ordenar por −|z|
    para cada c: when = "cambio_mejora" si c.delta > 0 sino "cambio_empeora"
        text = render(pick_template(c.metric, when, "team")["id"], {entidad, metrica, valor: fmt(c.own), referencia: fmt(c.ref),
                                                                      delta: format_value(c.metric, c.delta_raw, delta=True)})
    devolver {"changes": [{metric, label, when, tone, own, ref, delta, delta_raw, z, text}], "reason": None, window_games, change_z, context: …}
```
Equivalencia con F-17: es el mismo cálculo de la referencia `periodo_anterior` (valor pooled de los partidos anteriores a los
últimos `window_games`) y el mismo `z`; solo cambia el filtro (`|z| ≥ change_z` en lugar de `min_z` y de la selección por columna) y las
plantillas (`cambio_*`). Los valores de `window_games` y `change_z` los pasa quien llama (F-12 con `alerts.lookback_days` /
`alerts.change_z`); A-10 no agrega claves de configuración.

## 5. Frontend — capa API
- `insights: params => apiFetch(`/api/insights${qs(params)}`)` — `params = {entity, id, ...contextToQuery(getContext())}`; `qs()` de T-05.
  Sin `fetch` fuera de `api.js`.

## 6. Frontend — UI

**Ubicación.** S3 Equipo › `resumen` y S4 Jugador › `resumen` (X-01), como card "Insights" cerca del tope (bajo la cabecera de contexto
de F-19 y la ficha de F-16, antes de las cards de métricas); en Equipo queda antes del panel Plan de juego de F-17. Host `<div id="team-insights">` /
`<div id="player-insights">`.

**`components/insights-panel.js`** (PROPUESTA de nombre; la arquitectura §8 no lo lista):
- `renderInsights(el, payload, {status = "ok", errorMessage = "", onRetry})`: card con título "Insights".
  - `status = "loading"`: esqueleto "Generando insights…". `"error"`: "No se pudieron generar los insights" + "Reintentar" (`onRetry`).
    `"offline"`: "Sin conexión: se muestran los últimos insights cargados" (si hay `payload`) o "Sin conexión".
  - `payload.reason` → texto del spec §6 según código; `payload.insights.length === 0` y `reason == null` no ocurre (el servicio pone
    `sin_extremos`).
  - Lista `<ul class="ins-list">`: por cada insight `<li class="ins-item ins-pos|ins-neg|ins-neu">` con icono (▲ / ▼ / ●), el `text`
    (escapado con `esc()`) y una línea `.ins-evidence`: "p92 · 2.º de 12 · {context.label}". Tooltip/`title` con la evidencia completa
    ("Percentil 92 · 56,1% (Ø 52,4%) · 2.º de 12"), formateada con el formato del catálogo (`fmtMetric` de T-05 / `core/format.js`).
  - Nota "Pocos valores extremos en esta selección." si `payload.below_min` y hay frases.
  - `.ins-item` en verde/rojo con las clases existentes `above-avg`/`below-avg`; neutro en `var(--muted)`.
- Helper local `_ordinal(rank)` → "2.º" (es-UY) y copy en constantes al inicio del archivo (extracción futura por F-21).
- Reutiliza `core/format.js` (`fmtNumber`, `nullDisplay`) y el helper `esc()`.

**Vistas.** En `equipo.js` y `jugador.js`: `loadInsights()` → `renderInsights(host, null, {status: "loading"})` → `api.insights({entity, id,
...contextToQuery(getContext())})` con contador de pedido (la última respuesta gana); `onContextChange(loadInsights)`; errores de red
→ `status: "offline"`; otros → `status: "error"`. `id` = `team_code` (S3) o `player_id` (S4).

**Móvil (<768 px):** una columna, `.ins-evidence` en su propia línea con `white-space: normal`; sin scroll horizontal.

## 7. Navegación
Sin secciones ni pestañas nuevas. `docs/frontend.md` documenta el bloque en Equipo › Resumen y Jugador › Resumen.

## 8. Contratos de datos
- Respuesta de `/api/insights`: §3.2. Claves **fijas** para F-12: `entity`, `insights[].{metric, label, tone, when, percentile, value, avg,
  text}`, `below_min`, `reason`, `context`.
- `sudden_changes`: `{changes: [{metric, label, when, tone, own, ref, delta, delta_raw, z, text}], reason, window_games, change_z, context}`.
- Plantillas: forma de F-17 más `direction` en las genéricas (`metric: "*"`).

## 9. Manejo de errores y offline
| Situación | Mensaje (español) |
|---|---|
| 400 `parametro_invalido` | mensaje del backend (programación defensiva: la UI no arma esas llamadas) |
| 400 `contexto_invalido` | "Hay un filtro inválido en la dirección. Limpiá los filtros." |
| 404 `no_encontrado` | "No encontramos esta entidad en la competencia elegida" |
| 401 | handler global de `api.js` |
| 5xx / red | "No se pudieron generar los insights" + "Reintentar" |
| Sin conexión | "Sin conexión: se muestran los últimos insights cargados" |
- `sw.js`: subir `CACHE` al siguiente entero al integrar (hoy `smart-basket-v13`; lo asigna la integración, arquitectura §3.13); sumar
  `/js/components/insights-panel.js` a `STATIC` solo si X-01 no pasó a runtime caching.

## 10. Riesgos / decisiones
- **PROPUESTA (no está en 00-arquitectura-transversal.md): `insights_payload` y `sudden_changes`.** La arquitectura §4 fija solo
  `insights(entity_type, entity_id, comp_id, ctx) -> list[dict]`; el endpoint necesita el sobre (`reason`, `below_min`, `sample`,
  `context`) y F-12 necesita la definición de cambio brusco con función propia. Reportado en huecos.
- **PROPUESTA: `components/insights-panel.js`.** El componente no está en la tabla §8 de la arquitectura (la capa transversal "Insights en
  texto" no tiene dueño de UI). Reportado en huecos.
- **PROPUESTA: `phrases.score_candidates` público.** F-17 deja el armado de candidatos como helper privado; A-10 lo expone para no duplicar
  el cálculo de referencia, `z` y ficha en `insights.py`. Si F-17 ya lo nombró distinto, se usa ese nombre.
- **PROPUESTA: `tone`, `family` y `below_min` en el contrato.** Extensión del shape; no afecta a los campos de la arquitectura.
- **Marcadores del cliente vs. arquitectura.** El cliente escribe `{equipo}` y `{métrica}`; la arquitectura §3.15 fija `{entidad}` y
  `{metrica}` (sin tilde, válido para jugadores). Se usan los de la arquitectura; el texto resultante es idéntico al del ejemplo del cliente.
- **Desviación a la letra del cliente (menos-es-mejor).** Para métricas con dirección `lower`, la frase no usa la redacción literal del
  cliente (sería ambigua con un percentil orientado); decisión registrada en spec §9.
- **Riesgo: pocos extremos con poblaciones chicas.** Con 12 equipos el percentil mid-rank ≥ 90 solo lo alcanzan los dos primeros puestos
  (p. ej. el 2.º de 12: `10 / 11` = 91) y ≤ 10 los dos últimos; con 6 equipos casi nadie dispara. Es el comportamiento esperado del
  umbral del cliente; la UI explica `below_min`/`sin_extremos`. Los umbrales son editables (F-13).
- **Riesgo: redondeo servidor/cliente.** `format_value` usa mitad hacia arriba sobre `Decimal(repr(v))`; el cliente usa `Intl.NumberFormat`.
  Diferencias solo en empates exactos del último dígito; se verifica sobre el seed (T-F5) y, si aparecen, el texto del insight pasa a
  mostrar la cadena formateada en servidor también en la tarjeta de evidencia.
- **Riesgo: contradicción por contexto distinto.** El bloque y las cards deben usar el mismo `ctx` (ambos leen `getContext()`); un cambio de
  contexto refresca ambos. Mitigación: el eco `context.label` se muestra en el bloque y se compara en T-F5.
- **Riesgo: F-12 define la ventana de "última semana" y los umbrales de `alerts.*`.** A-10 solo entrega `sudden_changes` con parámetros
  explícitos; la conversión de `alerts.lookback_days` a `window_games` queda para F-12 (huecos).
- **Incrementos diferidos.** (→ F-12) alertas en Mi equipo con `insights()` y `sudden_changes()`; (→ F-21) traducción de `es.json`.
- **Dependencias técnicas.** `population.population` / `ficha` (T-01, [plan](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md));
  `phrases.py`, `es.json`, `rules.json`, `pick_template`, `render`, `format_value`, `validate_templates`, `score_candidates` (F-17,
  [plan](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md)); `sample.sample_level` (T-02,
  [plan](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)); `metrics_catalog.METRICS` (T-05,
  [plan](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)); `config.get`, claves `insights.*` (F-13,
  [plan](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)); `context.parse_context` / `context_echo` / `population_mode`
  (T-03, [plan](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)); `views/equipo.js`, `views/jugador.js`
  (X-01, [plan](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)); `identity.player_card`, `player_id`
  (C-08, [plan](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)); `repository`, `cache.memo` (F-11,
  [plan](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)). Consumidor posterior: F-12
  ([plan](../12-F-12-mi-equipo/plan.md)).
- **Estimación:** L · 8–11 h (plantillas, reglas y validación 1,5 h; `insights.py` con coherencia y `sudden_changes` 3 h; endpoint y config
  1 h; componente y vistas 2 h; estilos 0,5 h; docs 0,5 h; verificación 1,5–2 h). La arquitectura §9.1 estima M 6–10 h; el plan queda en
  L por incluir `sudden_changes` y la verificación de coherencia sobre todas las entidades del seed.
