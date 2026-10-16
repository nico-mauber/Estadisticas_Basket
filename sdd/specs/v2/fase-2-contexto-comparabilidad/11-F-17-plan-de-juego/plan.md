# Plan — F-17: Plan de juego

> **ID:** F-17 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 11
> **Depende de:** T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)) · T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)) · X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)); consume además T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)) y T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md))
> **Habilita:** F-03, A-10, F-12, F-21, F-20
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Arquitectura §3.15, §3.6, §3.7, §3.2, §3.3, §3.8, §6, §7.1, §7.4, §7.8, §8
> **Estimación:** L · 13–18 h

## 1. Enfoque
F-17 crea el motor de frases de plantillas fijas (`backend/phrases.py` + plantillas por idioma) y, encima de él, la selección de
ventajas y riesgos: para cada métrica del conjunto del plan toma el valor propio y el de la referencia **de la misma población
que usan las fichas de T-01** (así cada ítem es verificable contra la pantalla), calcula el delta orientado y su puntaje
`z = delta / desvío de la población`, elige entre `gameplan.items_min` y `gameplan.items_max` por columna con `|z| ≥ gameplan.min_z`
y rellena la frase con la plantilla de esa métrica y ese disparo. El endpoint `GET /api/game-plan` es fino; el panel
(`components/game-plan.js`) se monta en S3 Equipo › Resumen dentro de `collapsible` (estado recordado por usuario). El modo
`matchup` de `game_plan` queda listo para F-03 y el renderer de ítem se exporta para reutilizarlo en el informe, en Mi equipo
(F-12) y en F-20. Nada se persiste y no hay cambios de esquema; los umbrales salen de `config.get()`.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/phrases.py` | module **NUEVO** | `load_templates`, `load_rules`, `validate_templates`, `pick_template`, `format_value`, `render`, `game_plan` (+ helpers privados de selección y de período anterior); `python backend/phrases.py` valida las plantillas | RF-2…RF-13, RF-16, RF-17, RF-18 |
| `backend/phrases/es.json` | datos **NUEVO** | 30 plantillas (15 métricas × ventaja/riesgo) en español rioplatense | RF-6, RF-16, RF-19 |
| `backend/phrases/rules.json` | datos **NUEVO** (PROPUESTA, §10) | familias de métricas y conjunto de métricas del plan de juego (independiente del idioma) | RF-10, RF-11 |
| `backend/config.py` (F-13) | module (edit) | activar `gameplan.items_min`, `gameplan.items_max`, `gameplan.min_z` (`status: activa`, consumidor F-17/F-03) | RF-9, RF-18 |
| `backend/metrics_catalog.py` (T-05) | module (edit mínima) | exponer el acceso público a los loaders registrados `load_bundles(req: EntityRequest) -> list[StatBundle]` si T-05 no lo hizo (PROPUESTA, §10) | RF-7 |
| `backend/app.py` | route | `GET /api/game-plan` fina (parseo de contexto, validación, errores §7.8) | RF-1, RF-7, RF-8, RF-13 |
| `frontend/js/api.js` | js-api | `api.gamePlan(params)` | RF-1 |
| `frontend/js/components/game-plan.js` | js-component **NUEVO** | `renderGamePlan(el, payload, opts)`, `renderPlanItem(item)`, `fmtPlanDelta(item)`, `planReasonText(reason, payload)` | RF-1…RF-5, RF-7, RF-8, RF-12, RF-13, RF-15, RF-19 |
| `frontend/js/views/equipo.js` (X-01) | js-view | montar el panel en la pestaña `resumen`, estado de referencia en `sessionStorage`, refresco con `onContextChange` | RF-1, RF-7, RF-13, RF-15 |
| `frontend/css/style.css` | css | sección `/* ── game-plan (F-17) ── */`: `.gp`, `.gp-controls`, `.gp-cols`, `.gp-item`, `.gp-pos`/`.gp-neg`, `.gp-minor`, apilado <768 px | RF-1, RF-2 |
| `frontend/sw.js` | sw | con el runtime caching de X-01 basta subir `CACHE` al siguiente entero; si no, sumar `/js/components/game-plan.js` a `STATIC` | §9 |
| `docs/api.md` | doc (cierre) | `GET /api/game-plan` | — |
| `docs/frontend.md` | doc (cierre) | componente `game-plan.js`, panel en Equipo › Resumen, copy nuevo | — |
| `docs/architecture.md` | doc (cierre) | módulo `phrases.py`, directorio `backend/phrases/` | — |
| `docs/metrics.md` | doc (cierre) | sección "Plan de juego": puntaje `z`, desvío poblacional, referencias, familias | — |

Matriz RF → archivo: RF-1 `game-plan.js`, `equipo.js`, `app.py`, `api.js` · RF-2/RF-3/RF-4/RF-5 `phrases.py` (campos del ítem) +
`game-plan.js` (render) · RF-6 `phrases.py`, `es.json` · RF-7 `phrases.py`, `app.py`, `game-plan.js`, `metrics_catalog.py` ·
RF-8 `phrases.py`, `app.py`, `game-plan.js` · RF-9 `phrases.py`, `config.py` · RF-10 `phrases.py`, `rules.json` · RF-11 `phrases.py`,
`rules.json` · RF-12 `phrases.py`, `game-plan.js` · RF-13 `phrases.py`, `app.py`, `equipo.js`, `game-plan.js` · RF-14 `phrases.py`
(misma fuente que la ficha) · RF-15 `game-plan.js` (`collapsible`), `equipo.js` · RF-16 `phrases.py` · RF-17 `phrases.py`
(`validate_templates`) · RF-18 `config.py`, `phrases.py` · RF-19 `es.json`, `game-plan.js`, `format.js` (reuso).

## 3. Backend — rutas y modelos

### 3.1 Esquema
Sin tablas ni columnas nuevas. Lee `app_config` (claves `gameplan.*`) y `user_prefs` (`panel.collapsed`) vía los módulos de F-13.

### 3.2 `GET /api/game-plan` — NUEVO (dueño F-17, `login_required`)
Query:
- `team` (obligatorio): `team_code` (mayúsculas; el servicio normaliza con `.upper()` como el resto de las rutas de equipo).
- `reference` ∈ {`competencia` (default), `rival`, `periodo_anterior`}; `rival_proximo` es un valor reconocido pero rechazado (RF-8).
- `rival` (team_code): obligatorio si `reference=rival`; debe ser distinto de `team` y existir en la competencia resuelta.
- Contexto T-03 (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, …) parseado con
  `context.parse_context(request.args, team_code=team)`. `base` se ignora (el plan solo usa métricas `fixed`).

Response 200 (referencia `competencia`; ítems abreviados a dos por columna para el ejemplo):
```json
{
  "team": {"code": "CNF", "name": "Nacional"},
  "reference": {"type": "competencia", "label": "Ø competencia", "rival": null},
  "advantages": [
    {"metric": "efg_pct", "label": "eFG%", "group": "tiro_pct", "fmt": "pct", "family": "tiro",
     "direction": "ventaja", "icon": "↑",
     "delta": 0.0082, "delta_rel": 0.0156, "delta_raw": 0.0082,
     "own": 0.5324, "ref": 0.5242, "percentile": 71, "rank": 4, "rank_total": 12,
     "z": 1.12, "minor": false,
     "template_id": "ventaja_efg_pct", "text": "Ventaja en tiro: buscá volumen en medio campo"},
    {"metric": "to_pct", "label": "TO%", "group": "balon", "fmt": "pct", "family": "balon",
     "direction": "ventaja", "icon": "↑",
     "delta": 0.0181, "delta_rel": 0.1131, "delta_raw": -0.0181,
     "own": 0.1419, "ref": 0.1600, "percentile": 83, "rank": 2, "rank_total": 12,
     "z": 0.94, "minor": false,
     "template_id": "ventaja_to_pct", "text": "Cuidás el balón: sostené la circulación sin apuro"}
  ],
  "risks": [
    {"metric": "or_pct", "label": "OR%", "group": "rebote", "fmt": "pct", "family": "or_pct",
     "direction": "riesgo", "icon": "↓",
     "delta": -0.0412, "delta_rel": -0.1403, "delta_raw": -0.0412,
     "own": 0.2524, "ref": 0.2936, "percentile": 25, "rank": 9, "rank_total": 12,
     "z": -1.31, "minor": false,
     "template_id": "riesgo_or_pct", "text": "Poco rebote ofensivo: definí cuántos jugadores mandar al rebote según el rival"}
  ],
  "items": [ "…advantages + risks, mismo shape (comodidad para F-03)…" ],
  "sample": {"own": {"level": "media", "unit": "partidos", "n": 5, "min": 3, "high": 10, "min_source": "absoluto",
                     "games": 5, "minutes": null, "possessions": null, "ranked": true},
             "ref": null},
  "sample_warning": false,
  "reason": null,
  "rule": {"items_min": 3, "items_max": 5, "min_z": 0.5, "order": "abs_z", "metrics_evaluated": 15, "metrics_scored": 14},
  "population": {"size": 12, "competition_id": 3},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
              "applied": {"last": 5}, "ignored": [], "level": "partido", "population_mode": "apply_all",
              "games_used": 5, "games_total": 16, "games_excluded": {"sin_pbp": 0}, "label": "Últimos 5"},
  "catalog_version": 1
}
```
Sin ítems (200): `advantages: []`, `risks: []`, `items: []`, `reason` ∈ {`muestra_baja`, `contexto_no_comparable`,
`sin_universo`, `poblacion_insuficiente`, `sin_datos`, `rival_sin_datos`, `periodo_anterior_insuficiente`, `sin_diferencias`}.
`sample.own` siempre presente cuando el equipo tiene datos. Referencia `rival`: `reference = {"type": "rival", "label": "Rival
Peñarol", "rival": {"code": "PEN", "name": "Peñarol"}}` y `sample.ref` = badge del rival. Referencia `periodo_anterior`: `label` =
"Período anterior (antes de los últimos 5)" y `sample.ref` = badge del período anterior.

Errores (formato §7.8):
| Caso | HTTP | `code` | `error` |
|---|---|---|---|
| Falta `team` | 400 | `parametro_invalido` | "Falta el parámetro team" |
| `reference` desconocida | 400 | `parametro_invalido` | "Referencia inválida: usá competencia, rival o periodo_anterior" |
| `reference=rival_proximo` | 400 | `referencia_no_disponible` | "Todavía no hay calendario cargado para resolver el rival del próximo partido" |
| `reference=rival` sin `rival` | 400 | `parametro_invalido` | "Elegí un rival para comparar" |
| `rival` igual a `team` | 400 | `parametro_invalido` | "El rival debe ser distinto del equipo" |
| `reference=periodo_anterior` sin `last` | 400 | `parametro_invalido` | "Elegí un período (Últimos N) para comparar con el período anterior" |
| Contexto inválido | 400 | `contexto_invalido` | mensaje de `parse_context` (T-03) |
| Competencia inexistente | 400 | `competencia_inexistente` | mensaje de `resolve_competition` |
| Equipo o rival inexistente en la competencia | 404 | `no_encontrado` | "Equipo no encontrado" / "Rival no encontrado" |
| Plantillas inválidas | 500 | `plantillas_invalidas` | "Las plantillas del plan de juego no son válidas" (detalle en el log) |
| Sin sesión | 401 | — | handler de `api.js` |

### 3.3 Configuración (F-13) y preferencias
- `config.py` (F-13) ya reserva `gameplan.items_min` (int, 3, 1–10), `gameplan.items_max` (int, 5, 1–10) y `gameplan.min_z`
  (float, 0,5, 0–3; PROPUESTA de la arquitectura) con la regla de coherencia `items_min ≤ items_max`. F-17 solo cambia su
  `status` de `reservada` a `activa` y el `consumer` a "F-17, F-03"; **no** agrega claves nuevas.
- Preferencia por usuario: `PUT /api/prefs {"scope": "panel.collapsed", "key": "equipo.game_plan", "value": true}` (endpoint de
  F-13, sin cambios). Mi equipo (F-12) usará `mi_equipo.game_plan` (clave propia, no compartida).

## 4. Backend — lógica

### 4.1 Archivos de datos
**`backend/phrases/rules.json`** (independiente del idioma; PROPUESTA):
```json
{
  "version": 1,
  "families": {
    "tiro": ["efg_pct", "ts_pct", "ppt"],
    "circulacion": ["ast_to", "as_pct"]
  },
  "game_plan": {
    "team": ["oer", "der", "net_rating", "efg_pct", "ts_pct", "ppt", "fg2_pct", "fg3_pct", "ft_pct",
             "ft_rate", "to_pct", "or_pct", "dr_pct", "ast_to", "as_pct"]
  }
}
```
Una métrica sin entrada en `families` es una familia de un solo elemento (su propia clave). A-10 agrega la sección `insights`.

**`backend/phrases/es.json`**:
```json
{"lang": "es", "version": 1,
 "templates": [
   {"id": "ventaja_efg_pct", "metric": "efg_pct", "when": "ventaja", "entities": ["team"],
    "text": "Ventaja en tiro: buscá volumen en medio campo"}
 ]}
```
Campos: `id` (único), `metric` (clave del catálogo T-05 o `"*"` para plantillas genéricas —las usa A-10—, con `direction`
`higher|lower|neutral`), `when` ∈ {`ventaja`, `riesgo`, `extremo_alto`, `extremo_bajo`} (A-10 agrega `cambio_mejora`,
`cambio_empeora`), `entities` (lista de tipos de entidad), `text` (con marcadores), `text_matchup` opcional (variante para el modo
`matchup`, no usada en la v1 de F-17). Las 30 plantillas de F-17 (sin dígitos; los números de la lectura salen siempre de
marcadores, y en F-17 las frases no llevan marcadores):

| Métrica | `ventaja` | `riesgo` |
|---|---|---|
| `oer` | Ataque eficiente: sostené las situaciones que mejor te generan puntos | Ataque poco eficiente: buscá tiros de mejor calidad antes que más volumen |
| `der` | Defensa sólida: mantené la presión y el cierre de los tiros del rival | Defensa vulnerable: ajustá la cobertura para limitar los tiros cómodos del rival |
| `net_rating` | Saldo de eficiencia a favor: cuidá las rotaciones que lo sostienen | Saldo de eficiencia en contra: revisá las rotaciones que más lo castigan |
| `efg_pct` | Ventaja en tiro: buscá volumen en medio campo | Tiro poco efectivo: priorizá los tiros de mejor calidad y los ataques al aro |
| `ts_pct` | Anotás con eficiencia total: mantené la mezcla de tiros y la llegada a la línea | Eficiencia total baja: sumá tiros libres y evitá los tiros de baja calidad |
| `ppt` | Cada tiro de campo rinde: mantené el volumen de los tiros de mayor valor | Cada tiro de campo rinde poco: reemplazá los tiros de bajo valor por mejores opciones |
| `fg2_pct` | Eficaz en el tiro de dos puntos: atacá el aro y la pintura | Poco efectivo en el tiro de dos puntos: mejorá la selección de tiros cerca del aro |
| `fg3_pct` | Triple confiable: generá ventajas para abrir tiros de tres puntos | Triple poco confiable: limitá los triples forzados y buscá solo los abiertos |
| `ft_pct` | Buen porcentaje en libres: forzá faltas y cerrá los partidos desde la línea | Libres poco confiables: no dependas de la línea para cerrar los partidos |
| `ft_rate` | Llegás seguido a la línea: seguí atacando el aro para provocar faltas | Llegás poco a la línea: atacá más el aro para provocar faltas |
| `to_pct` | Cuidás el balón: sostené la circulación sin apuro | Perdés demasiados balones: simplificá las decisiones y asegurá el pase |
| `or_pct` | Dominás el rebote ofensivo: mandá hombres al rebote para ganar segundas oportunidades | Poco rebote ofensivo: definí cuántos jugadores mandar al rebote según el rival |
| `dr_pct` | Cerrás bien el rebote defensivo: aprovechalo para salir a correr | Cedés rebotes defensivos: reforzá el bloqueo para evitar segundas oportunidades rivales |
| `ast_to` | Circulación ordenada, más asistencias que pérdidas: seguí moviendo el balón | Más pérdidas que asistencias: bajá el riesgo en los pases |
| `as_pct` | Buena parte de las canastas nacen de pase: mantené el movimiento de balón | Pocas canastas nacen de pase: buscá más pases antes del tiro |

Reglas de redacción (las mismas que aplicará A-10): (1) la frase habla de una dirección, nunca de una cifra; (2) una plantilla
`ventaja` solo se selecciona con delta orientado > 0 y una `riesgo` con delta orientado < 0, por lo que no puede contradecir el
dato; (3) sin dígitos ni números escritos a mano; (4) un solo renglón (≤ 100 caracteres); (5) imperativo en voseo.

### 4.2 `backend/phrases.py` (NUEVO)

**Constantes**: `PHRASES_DIR = <dir de phrases.py>/phrases`; `LANGS = ("es",)` (F-21 agrega `en`, `pt`); `MARKERS = ("entidad",
"metrica", "valor", "referencia", "delta", "p", "media", "rival")` (arquitectura §3.15); `WHEN_VALUES = ("ventaja", "riesgo",
"extremo_alto", "extremo_bajo")`; `REFERENCES = ("competencia", "rival", "periodo_anterior", "rival_proximo")`;
`MODES = ("perfil", "matchup")`.

**`class PhraseError(Exception)`**: `code`, `message`, `status` (400/404/500) — la ruta lo traduce a §7.8.

| Función | Firma | Entradas | Algoritmo / reglas |
|---|---|---|---|
| `load_rules` | `load_rules() -> dict` | `rules.json` | Carga y memoriza por (ruta, mtime). Valida que `families` sea `dict[str, list[str]]` y que `game_plan[entity]` sea lista. |
| `load_templates` | `load_templates(lang: str = "es") -> dict` | `phrases/<lang>.json` | Lang no soportado → `PhraseError("parametro_invalido", …, 400)`. Devuelve `{lang, version, templates, by_key}` con `by_key[(metric, when, entity)] -> template` (expandiendo `entities`) y `generic[(direction, when, entity)]` para `metric == "*"`. Memoriza por (lang, mtime). Llama a `validate_templates` y, si hay errores, `PhraseError("plantillas_invalidas", …, 500)`. |
| `validate_templates` | `validate_templates(data: dict, rules: dict, metrics: dict) -> list[str]` | `metrics_catalog.METRICS` | Errores (lista de textos): id duplicado; `when` fuera de `WHEN_VALUES`; `metric` ni clave del catálogo ni `"*"`; marcador fuera de `MARKERS` (`re.findall(r"\{(\w+)\}", text)`); **dígito en `text`** (`re.search(r"\d", text)`); `text` vacío o más largo que el máximo de su `when` (`MAX_LEN = {"ventaja": 100, "riesgo": 100}`; A-10 agrega 160 para `extremo_*` y `cambio_*`); falta de plantilla `ventaja` o `riesgo` para alguna métrica de `rules["game_plan"][entity]`; métrica de `game_plan` con dirección `neutral` (no puede ser ventaja/riesgo). |
| `pick_template` | `pick_template(metric_key: str, when: str, entity_type: str, *, mode: str = "perfil", direction: str \| None = None, lang: str = "es") -> dict \| None` | — | 1) exacta `(metric_key, when, entity_type)`; 2) genérica `("*", direction, when, entity_type)`; 3) `None`. Si `mode == "matchup"` y la plantilla tiene `text_matchup`, el texto efectivo es ese. |
| `format_value` | `format_value(metric_key: str, value: float \| None, *, delta: bool = False) -> str` | `METRICS[key].fmt` | `None` → `"—"`. `pct`: `value·100` con 1 decimal y `%` (con `delta=True`: signo explícito y sufijo ` pp`); `dec1`/`dec2`: 1/2 decimales (con `delta=True`, signo explícito); `int`: entero; `signed_int`/`signed_dec2`: con signo. Coma decimal es-UY. Redondeo **half-up** sobre `Decimal(repr(value))` (igual que `Intl.NumberFormat`, para no divergir de la UI por el último dígito). |
| `render` | `render(template_id: str, values: dict, *, lang: str = "es") -> str` | plantilla por id | Sustituye cada `{marcador}`; si la plantilla usa un marcador ausente en `values` → `PhraseError("marcador_faltante", …, 500)` (bug de programación, nunca texto con `{p}` visible); marcador sobrante en `values` se ignora. Los valores numéricos se formatean antes con `format_value`; `delta` = `format_value(metric, delta_raw, delta=True)` (diferencia aritmética con signo, propio − referencia; ninguna plantilla de F-17 lo usa, lo usa A-10), `valor` = valor propio, `referencia` = valor de la referencia, `media` = promedio de la competencia, `p` = percentil entero, `rival` = nombre del rival. |
| `game_plan` | `game_plan(entity_type: str, entity_id: str, *, reference: str, rival: str \| None, comp_id: int, ctx: Context, mode: str = "perfil") -> dict` | `population`, `sample`, `config`, `metrics_catalog`, `stats_engine`, `repository` | Ver 4.3. |

### 4.3 `game_plan` — algoritmo
```
validar:
  entity_type != "team"                → PhraseError("parametro_invalido", "El plan de juego solo está disponible para equipos", 400)
  reference not in REFERENCES o mode not in MODES → 400 parametro_invalido
  mode == "matchup": reference := "rival"                       (F-03: siempre contra el rival)
  reference == "rival_proximo"         → PhraseError("referencia_no_disponible", …, 400)   # INCREMENTO DIFERIDO → F-12
  reference == "rival": rival requerido y != entity_id          → 400
  reference == "periodo_anterior": ctx.last requerido            → 400
cfg = {items_min, items_max, min_z} = config.get("gameplan.*")      # RF-18; nunca literales
motivo vacío por contexto:
  ctx.competition_all                  → respuesta vacía, reason "sin_universo"
  context.population_mode(ctx) == "entity_only" (filtros on/off) → vacía, reason "contexto_no_comparable"
pop = population.population("team", comp_id, ctx)                  # cacheada por T-01; apply_thresholds=True
own = _member(pop, entity_id)        # None → vacía, reason "sin_datos"
si pop.size (miembros in_population) < config.get("population.min_size") → vacía, reason "poblacion_insuficiente"
sample_own = own.sample                                             # badge T-02 (equipo: unidad partidos)
si sample_own.level == "baja" y mode == "perfil" → vacía, reason "muestra_baja"
si sample_own.level == "baja" y mode == "matchup" → sample_warning = True (se sigue)
ref_values, ref_sample, ref_label:
  competencia:      ref_values = population.league_reference("team", comp_id, ctx)      # {clave: media de in_population}
  rival:            r = _member(pop, rival); None → vacía "rival_sin_datos"; ref_values = r.values; ref_sample = r.sample
                    si ref_sample.level == "baja" → sample_warning = True (el usuario eligió a ese rival)
  periodo_anterior: ref_values, ref_sample = _previous_period(entity_id, comp_id, ctx)  # 4.4; None → vacía "periodo_anterior_insuficiente"
candidatos = []
para orden, m in enumerate(rules["game_plan"]["team"]):
    d = METRICS[m]; si d.direction == "neutral": continuar            # defensivo (validate_templates ya lo impide)
    v = own.values.get(m); r = ref_values.get(m)
    si v es None o r es None: contar en `skipped`, continuar            # C-11: nunca 0 ni imputación
    sigma = _sigma(pop, m)            # pstdev de valores no nulos de miembros in_population; None si < 2 valores o σ == 0
    si sigma es None: continuar
    s = +1 si d.direction == "higher" sino −1
    delta = s·(v − r);  z = delta / sigma
    si z == 0: continuar
    ficha = population.ficha(m, v, entity_id, pop)                     # percentil, ranking
    cand = {metric: m, label: d.label, group: d.group, fmt: d.fmt, family: _family(m, rules),
            direction: "ventaja" si delta > 0 sino "riesgo", icon: "↑" / "↓",
            delta, delta_rel: delta/abs(r) si d.rel_dist y r != 0 sino None, delta_raw: v − r,
            own: v, ref: r, percentile: ficha["percentile"], rank: ficha["rank"], rank_total: ficha["rank_total"],
            z, minor: False, order}
advantages = _select(candidatos, +1, cfg);  risks = _select(candidatos, −1, cfg)
para cada ítem: tpl = pick_template(metric, direction, "team", mode=mode); text = render(tpl.id, {entidad, metrica, valor, referencia, delta, p, media, rival})
si ambas listas vacías y no hay motivo previo → reason "sin_diferencias"
```
`_select(cands, sign, cfg)`:
```
pool = ordenar([c for c in cands if sign·c.z > 0], por (−|z|, order))
out, used = [], set()
para c en pool:                                  # 1) ítems plenos
    si |c.z| < cfg.min_z: continuar
    si len(out) >= cfg.items_max: parar
    si c.family en used: continuar
    out += [c]; used += {c.family}
si len(out) < cfg.items_min:                      # 2) relleno con diferencias menores del mismo signo
    para c en pool:
        si c en out o c.family en used: continuar
        c.minor = True; out += [c]; used += {c.family}
        si len(out) >= cfg.items_min: parar
devolver ordenar(out, por (−|z|, order))
```
El relleno nunca supera a un ítem pleno (|z| < min_z ≤ |z| de los plenos), así el orden final es por `|z|` decreciente.

`_sigma(pop, m)` = `statistics.pstdev([mem.values[m] for mem in pop.members if mem.in_population and mem.values.get(m) is not None])`
con mínimo 2 valores y `σ > 0`. `_member(pop, id)` busca por `str(mem.id) == str(id)`.

**Cierres del payload:** `population = {size: nº de miembros in_population, competition_id}`; `context = context.context_echo(ctx,
games_used=<games del miembro propio>, games_total=<partidos del equipo en la competencia sin filtros, de repository>,
games_excluded=…, ignored=…)`; `items = advantages + risks`; `rule = {items_min, items_max, min_z, order: "abs_z",
metrics_evaluated, metrics_scored}`.

**Caché:** `cache.memo("gplan", (entity_id, reference, rival, comp_id, context.context_key(ctx), mode), fn, max_entries=128)`;
la clave se prefija con `data_version`/`config_version` (arquitectura §3.14), por lo que cambiar `gameplan.*` o importar datos
invalida solo (RF-18). La población ya está cacheada por T-01 (`pop:team`).

**Nulos (C-11):** una métrica sin valor propio o de referencia se **omite** del plan y se cuenta en `rule.metrics_evaluated −
rule.metrics_scored`; jamás se sustituye por 0. `delta_rel` es `null` cuando la referencia es 0 o la métrica no define
distancia relativa.

### 4.4 `_previous_period(team_code, comp_id, ctx) -> tuple[dict, dict] | None` (privado de `phrases.py`)
```
n = ctx.last                                          # ya validado (>0)
ctx_full = dataclasses.replace(ctx, last=None)        # mismos filtros, todos los partidos
recent = metrics_catalog.load_bundles(EntityRequest("team", team_code, comp_id, ctx, base="total"))[0]
full   = metrics_catalog.load_bundles(EntityRequest("team", team_code, comp_id, ctx_full, base="total"))[0]
prev_games = full.games − recent.games
si prev_games < config.get("sample.team.min"): devolver None            # "periodo_anterior_insuficiente"
prev = _bundle_minus(full, recent)                    # resta de conteos
values = stats_engine.compute_standard(prev)          # {clave: {"value", "reason"}}
ref_values = {k: v["value"] for k, v in values.items()}
ref_sample = sample.sample_level("team", n=prev_games, unit="partidos", games=prev_games)
```
`_bundle_minus(full, recent)`: nuevo `StatBundle` con `own`, `opp`, `team` y `shots` restados clave a clave (claves de
`RAW_KEYS` y de `shots`), `games`, `minutes`, `team_minutes`, `seconds` restados (`None` si alguno es `None`), `on_court = None`,
`possessions_counted = None`, `null_reasons` = unión. Es manipulación de conteos, no una fórmula (regla 4: toda tasa se calcula
después en `compute_standard`, política pooled DA-02). Si `recent ⊄ full` por algún desfase de filtros (restar da negativos) →
`PhraseError("periodo_anterior_insuficiente")`.

## 5. Frontend — capa API
- `gamePlan: params => apiFetch(`/api/game-plan${qs(params)}`)` — `params = {team, reference, rival, ...contextToQuery(getContext())}`
  (`qs()` de T-05 omite `null`/`undefined`/`""`). Sin `fetch` fuera de `api.js`.
- Consumidos: `api.contextOptions({competition})` (T-03) para la lista de rivales; `api.savePref`/`api.prefs` vía `core/prefs.js`
  (F-13) desde `collapsible`.

## 6. Frontend — UI

**Ubicación.** S3 Equipo › pestaña `resumen` (`views/equipo.js`, X-01), debajo de la card "Four Factors" y antes de las cards de
detalle. Un contenedor `<div id="team-gameplan">` se monta una vez por carga de equipo. (Si X-01 no estuviera integrado, el panel
se monta en `renderTeam` de `app.js`, `#team-main`, con el mismo componente; no es el camino previsto.)

**`components/game-plan.js`** — exports:
- `renderGamePlan(el, payload, {panelId = "equipo.game_plan", teams = [], reference = "competencia", rival = null, status = "ok", errorMessage = "", onReferenceChange, onRetry})`:
  - Primera llamada sobre `el`: arma el armazón (`.gp-controls`, `.gp-meta`, `.gp-body`) y llama a
    `collapsible(el, {panelId, title: "Plan de juego", defaultOpen: true})` (X-01); marca `el.dataset.gpMounted = "1"`. Después de
    envolver, vuelve a buscar por selector (`.gp-body`, `.gp-ref`, `.gp-rival`) para no depender de qué devuelve `collapsible`.
    Llamadas siguientes: solo actualizan controles y `.gp-body`.
  - Controles: `<select class="gp-ref">` con "Ø competencia", "Un rival…", "Mi equipo: período anterior" (habilitada solo si el
    contexto tiene `last`; si no, `disabled` con título "Elegí un período (Últimos N) para usarla") y "Rival del próximo partido"
    `disabled` con la nota "Disponible cuando se cargue el calendario" (RF-8); `<select class="gp-rival">` (visible con "Un
    rival…") con los equipos de `teams` menos el propio. `onReferenceChange({reference, rival})` dispara el refetch.
  - `.gp-meta`: "Referencia: {label} · {context.label o 'Todos los partidos'} · {games_used} de {games_total} partidos" +
    `sampleBadge(payload.sample.own, {compact: true})` (T-02).
  - `.gp-body`: dos columnas `.gp-col` "Ventajas" (`advantages`) y "Vulnerabilidades" (`risks`); cada columna una lista `<ul>` de
    `renderPlanItem`. Columna vacía → "Sin ventajas destacadas" / "Sin vulnerabilidades destacadas". Con `payload.reason` → un solo
    bloque con `planReasonText(reason, payload)` (copy de la tabla del spec §6).
  - Estados: `status = "loading"` (esqueleto "Calculando plan de juego…"), `"error"` ("No se pudo calcular el plan de juego" +
    botón "Reintentar" → `onRetry`), `"offline"` ("Sin conexión: se muestra el último plan cargado" si hay `payload`).
- `renderPlanItem(item) -> string` (también lo reutilizan F-03, F-12 y F-20): `<li class="gp-item gp-pos|gp-neg [gp-minor]"
  title="Diferencia aritmética: {delta_raw formateada} (propio − referencia)">` con, en este orden, `.gp-ico` ("↑"/"↓"),
  `.gp-metric` (`item.label`), `.gp-delta` (`fmtPlanDelta(item)`, verde/rojo con las clases existentes `above-avg`/`below-avg`),
  `.gp-vals` (`fmtMetric`/formato del catálogo: "53,2% vs 52,4%"), `.gp-pct` ("p71", color `percentileColor(item.percentile)`
  de `core/colors.js`; nulo → `nullDisplay`), `.gp-text` (`item.text`). Los ítems con `minor` llevan un `title` adicional
  "Diferencia menor". `item.text` se inserta con `esc()` (el texto sale de una plantilla propia, pero se escapa igual).
- `fmtPlanDelta(item) -> string`: signo explícito (`+`/`−`); `pct` → puntos porcentuales con una decimal ("+0,8"), `dec1`/`dec2` →
  1/2 decimales, `int` → entero; usa `fmtNumber` de `core/format.js` (es-UY). Nulo → "—".
- `planReasonText(reason, payload) -> string`: copy del spec §6 con `{n}`/`{m}` de `payload.sample.own` (`n`, `min`).

**`views/equipo.js` (resumen)**: 
1. `const host = el.querySelector("#team-gameplan")`; estado de sesión `{reference, rival}` leído de `sessionStorage` (`sb.gp.reference`,
   `sb.gp.rival`) dentro de `try/catch`; defaults `competencia`/`null`.
2. `loadPlan()`: `renderGamePlan(host, null, {status: "loading", …})` → `api.gamePlan({team, reference, rival, ...contextToQuery(getContext())})`
   → `renderGamePlan(host, payload, {…})`. Contador de pedido (`++seq`; se ignora una respuesta vieja). Error → `status: "error"`; sin red
   (`navigator.onLine === false` o `TypeError`) → `status: "offline"`.
3. `onContextChange(loadPlan)` y `onRoute` (desuscribir al salir de la pestaña).
4. `onReferenceChange` guarda en `sessionStorage` y llama a `loadPlan()`. Si se elige "Mi equipo: período anterior" sin `last` en el
   contexto, la opción está deshabilitada (no se llega a pedir).
5. `teams` sale de `api.contextOptions({competition})`; se carga una vez por competencia.

**Componentes compartidos reutilizados (arquitectura §8):** `collapsible.js` (X-01), `sample-badge.js` (T-02), `core/colors.js`
(`percentileColor`, T-01), `core/format.js` (`fmtNumber`, `nullDisplay`) y el helper `esc()` existente (`app.js`, l.129; X-01 lo deja en `core/`), `core/context.js` (T-03), `core/prefs.js` (F-13).

**Móvil (<768 px):** `.gp-cols` pasa a una sola columna (Ventajas arriba, Vulnerabilidades debajo); cada `.gp-item` es una grilla
de dos filas (icono + métrica + delta + percentil / valores / frase en su propia línea con `white-space: normal`); selectores a
ancho completo. Sin scroll horizontal.

## 7. Navegación
Sin secciones ni pestañas nuevas: el panel vive en `#/equipo/<code>/resumen`. El estado de referencia no va en la URL (spec §9).
`docs/frontend.md` documenta el panel en el mapa de Equipo › Resumen.

## 8. Contratos de datos
- Ítem de plan (`advantages[]`, `risks[]`, `items[]`): ver §3.2. Claves **fijas** que F-03/F-12/F-20 pueden asumir: `metric`, `label`,
  `direction` (`ventaja`|`riesgo`), `icon`, `delta` (orientado), `delta_raw`, `own`, `ref`, `percentile`, `text`, `z`, `minor`.
  Arquitectura §6 fija `{metric, delta, own, ref, percentile, text, direction}`; F-17 agrega el resto (extensión compatible).
- `phrases.game_plan(...)` devuelve el mismo objeto que el endpoint (sin `catalog_version` obligatorio) con `mode` y `sample_warning`.
- Estado de sesión: `sessionStorage["sb.gp.reference"]`, `sessionStorage["sb.gp.rival"]` (strings).
- Preferencia: `panel.collapsed` / `equipo.game_plan` (bool).

## 9. Manejo de errores y offline
| Situación | Mensaje (español) |
|---|---|
| 400 `parametro_invalido` / `referencia_no_disponible` | El mensaje del backend, bajo el selector de referencia; vuelve a "Ø competencia" |
| 400 `contexto_invalido` | "Hay un filtro inválido en la dirección. Limpiá los filtros." (patrón de T-03/F-19) |
| 404 `no_encontrado` | "No encontramos este equipo en la competencia elegida" |
| 401 | handler global de `api.js` (vuelve al login) |
| 5xx / red | "No se pudo calcular el plan de juego" + "Reintentar" |
| Sin conexión | "Sin conexión: se muestra el último plan cargado" (si hay respuesta previa) o "Sin conexión" |
- `sw.js`: X-01 cambia a runtime caching, así que el módulo nuevo queda en caché al primer uso; igual se sube `CACHE` al siguiente entero
  al integrar (hoy `smart-basket-v13`; el número lo asigna la integración, arquitectura §3.13). Si X-01 no cambió la estrategia, agregar
  `/js/components/game-plan.js` a `STATIC`.
- Las plantillas son datos del servidor (`backend/phrases/*.json`): no hay assets estáticos nuevos en el cliente más allá del módulo.

## 10. Riesgos / decisiones
- **PROPUESTA (no está en 00-arquitectura-transversal.md): `backend/phrases/rules.json`.** La arquitectura §3.15 fija las plantillas
  por idioma (`es.json`) pero no dónde viven las reglas independientes del idioma (conjunto de métricas del plan, familias,
  y —desde A-10— conjunto de insights). Guardarlas dentro de `es.json` obligaría a F-21 a duplicarlas por idioma. Reportado en huecos.
- **PROPUESTA: `metrics_catalog.load_bundles(req)`.** La arquitectura §3.5 define `register_entity(entity_type, loader)` pero no el
  acceso público a los loaders; `population.py` lo necesita igual y F-17 lo usa para el período anterior. Si T-05/T-01 ya lo expone
  con otro nombre, se usa ese. Reportado en huecos.
- **PROPUESTA: campos extra en el ítem y `items` plano.** El contrato de la arquitectura §6 (`{metric, delta, own, ref, percentile, text,
  direction}`) se amplía con `label`, `icon`, `delta_raw`, `delta_rel`, `z`, `minor`, `family`, `template_id`, `rank`, `rank_total`; y se
  agrega `items` (concatenación de ventajas y riesgos) porque el plan de F-03 (§4, `_advantages_and_threats`) separa por `direction` a partir de
  una lista única. Compatibles hacia atrás con ambas lecturas.
- **PROPUESTA: forma de plantilla ampliada.** `metric: "*"` + `direction` (plantillas genéricas, las usa A-10), `entities`, `text_matchup`
  opcional, y `when` extensible. La forma de la arquitectura (`id`, `metric`, `when`, `text`) sigue siendo válida.
- **Objeción menor a la arquitectura §3.15 (`phrases.py` y `phrases/`).** Un módulo `phrases.py` y un directorio `phrases/` con el mismo
  nombre en `backend/` conviven en Python (el directorio sin `__init__.py` es un paquete-espacio de nombres y el módulo `.py` tiene
  precedencia en `import phrases`), pero confunde a quien lee. Se sigue la arquitectura; mitigación: no crear `__init__.py` en el
  directorio y verificar `python -c "import phrases; print(phrases.__file__)"` (T-F2). Si molesta, renombrar el directorio a
  `phrase_templates/` es un cambio de una línea (`PHRASES_DIR`). Reportado en desacuerdos.
- **Desviación a la letra del cliente: orden por `z` y no por el delta crudo.** El cliente dice "ordenados por magnitud del delta"; las
  unidades difieren entre métricas, por eso se ordena por `z` (arquitectura §3.15 ya lo fija). Se registra la decisión en spec §9.
- **Muestra baja en modo `matchup`.** La arquitectura §3.15 dice "entidades con muestra media/alta"; F-03 (spec RF-6, plan §4) espera
  ítems con `sample_warning`. Se concilia: `perfil` excluye, `matchup` advierte. Reportado en desacuerdos para que F-03 y T-02 lo
  confirmen.
- **DA-21 resuelta (sin `t()` en las fases tempranas).** El copy del panel y los motivos se escriben en español directo, concentrados en
  constantes al inicio de `game-plan.js` para que F-21 los extraiga; las plantillas ya viven en un archivo por idioma.
- **Riesgo: dependencia de la población de T-01.** Si `Population.members[*].values` no trae todas las claves del plan, el panel omite
  esas métricas (se ve en `rule.metrics_scored`). Mitigación: tarea de verificación de la cobertura (T-F4).
- **Riesgo: período anterior con filtros de evento.** La resta de conteos es exacta para conteos crudos, pero `possessions_counted`
  (A-01) no se resta; con filtros de posesión (fase 3) la referencia usa `possessions` por fórmula. Documentado; sin impacto en fase 2.
- **Riesgo: redondeo servidor/cliente.** Las frases de F-17 no llevan cifras; A-10 sí y reutiliza `format_value` (half-up). Verificado en A-10.
- **Incrementos diferidos.** (→ F-03) presencia en el informe: ya consumida vía `phrases.game_plan(mode="matchup")` y `renderPlanItem`.
  (→ F-12) panel en Mi equipo y referencia `rival_proximo` (necesita `fixtures.next_fixture`, arquitectura §3.19): el servicio ya rechaza el
  valor con `referencia_no_disponible`, F-12 lo implementa y habilita la opción del selector.
- **Dependencias técnicas.**
  `population.population` / `league_reference` / `ficha` (T-01, [plan](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md));
  `metrics_catalog.METRICS` / `load_bundles`, `stats_engine.compute_standard`, `StatBundle` (T-05, [plan](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md));
  `sample.sample_level` y `components/sample-badge.js` (T-02, [plan](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md));
  `config.get`, claves `gameplan.*`, `prefs`, `core/prefs.js` (F-13, [plan](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md));
  `context.parse_context` / `context_key` / `population_mode` / `context_echo`, `core/context.js`, `GET /api/context/options` (T-03, [plan](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md));
  `components/collapsible.js`, `views/equipo.js`, `components/tabs.js` (X-01, [plan](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md));
  `repository.competition_games`, `repository.team_game_rows`, `cache.memo` (F-11, [plan](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md));
  `core/colors.js` (T-01); `core/format.js` (C-11, [plan](../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/plan.md)).
  Consumidores posteriores: F-03 ([plan](../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md)), A-10 ([plan](../../fase-5-analitica-exploracion/10-A-10-insights-automaticos/plan.md)), F-12 ([plan](../../fase-5-analitica-exploracion/12-F-12-mi-equipo/plan.md)).
- **Estimación:** L · 13–18 h (motor de frases y plantillas 4–5 h; `game_plan` con período anterior y selección 3–4 h; endpoint, config y
  caché 1,5–2 h; componente y vista 3–4 h; estilos y móvil 1 h; docs y verificación 2–3 h).
