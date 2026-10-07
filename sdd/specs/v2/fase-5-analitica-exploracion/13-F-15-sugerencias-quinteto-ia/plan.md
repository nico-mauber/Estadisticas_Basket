# Plan — F-15: Sugerencias de quinteto asistidas por IA

> **ID:** F-15 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 13
> **Depende de:** F-06 · F-03 · A-08 · T-02 (rutas relativas en "Dependencias técnicas")
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** `spec.md` de este requisito · Arquitectura §3.5, §3.7, §3.10, §3.14, §3.16, §3.21, §4, §6, §7, §8, §11 (DA-24, DA-28), §12 (R-13)
> **Estimación:** L · 12–19 h

## 1. Enfoque

Garantía estructural de "ninguna cifra difiere de la tabla": el resumen que recibe el modelo se arma **leyendo el mismo payload que la tabla** (`tables.build_table("team_lineups", …)` de F-06/T-06, y las tablas de cierres y de emparejamientos), no recalculando. Los valores salen ya formateados por un formateador de backend que replica el redondeo de `core/format.js`. El modelo no escribe cifras: escribe marcadores `{m:R1.oer}` que el backend reemplaza por el valor formateado del resumen; todo dígito fuera de marcadores, o marcador inexistente, descarta la sugerencia. La selección de filas por tipo es determinista y vive en el backend (el modelo no elige quintetos: redacta sobre los elegidos). Un módulo `llm.py` encapsula el cliente (SDK `anthropic`, import protegido, desactivable por entorno y por configuración), la llamada con salida estructurada y el manejo de negativa, tiempo agotado y límites. El frontend agrega un panel plegable en la pestaña Quintetos con límites siempre visibles, etiqueta y tabla de soporte tomada de la respuesta.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/llm.py` | module **NUEVO** | `llm_available`, `suggestions_enabled`, `lineup_suggestions`, `validate_numbers`, más privadas: `build_summary`, `format_value`, `_call_model`, `_resolve_markers`, `_rate_limit`, `_lang` | RF-2..RF-6, RF-8..RF-21 |
| `backend/app.py` (mod.) | route | `POST /api/ai/lineup-suggestions`; `GET /api/me` agrega `llm_enabled` | RF-2, RF-3, RF-18, RF-19 |
| `backend/config.py` (mod., de F-13) | config | activa `ai.suggestions_enabled` (visible solo si el entorno tiene LLM); agrega `ai.perf_pct`, `ai.low_usage_share`, `ai.top_n`, `ai.max_calls_per_hour` (PROPUESTA) | RF-3, RF-11, RF-12, RF-19 |
| `backend/requirements.txt` (mod.) | deps | agrega `anthropic` (dependencia nueva, con import protegido; justificación en §10) | RF-3 |
| `backend/test_auth.py` | test existente | sin cambios | — |
| `render.yaml` / `docs/deployment.md` | deploy | variables `LLM_*`; `--workers 1 --threads 4` si F-01 no lo dejó (DA-28) | RF-3, RF-18, RF-20 |
| `frontend/js/api.js` (mod.) | js-api | `aiLineupSuggestions(body)` | RF-2 |
| `frontend/js/components/lineup-suggestions.js` | component **NUEVO** (PROPUESTA: no figura en Arq. §8) | panel: selector de tipo, rival, botón, límites, tarjetas, tabla de soporte, regenerar | RF-1, RF-2, RF-7, RF-8, RF-15, RF-16 |
| `frontend/js/views/equipo.js` (X-01/F-06, mod.) | js-view | monta el panel bajo la tabla de quintetos solo si `llm_enabled` | RF-1, RF-3 |
| `frontend/js/app.js` (mod.) | js-view | guarda `llm_enabled` de `/api/me` | RF-3 |
| `frontend/css/style.css` (mod.) | css | sección `/* ── lineup-suggestions (F-15) ── */` | RF-7, RF-15 |
| `frontend/sw.js` (mod.) | cache | componente nuevo a `STATIC` y bump de `CACHE` si X-01 no migró a runtime caching | — |
| `docs/api.md`, `docs/deployment.md`, `docs/frontend.md`, `docs/architecture.md` | doc | endpoint, variables de entorno, panel, módulo `llm.py` | — (cierre) |

**Matriz RF → archivo:** RF-1 `lineup-suggestions.js`, `equipo.js` · RF-2 `lineup-suggestions.js`, `app.py` · RF-3 `llm.py`, `app.py`, `config.py`, `equipo.js` · RF-4 `llm.py` (`build_summary`, `_call_model`) · RF-5 `llm.py` (`build_summary`) · RF-6 `llm.py` (`_resolve_markers`, `validate_numbers`) · RF-7 `llm.py` (`supporting_rows`), `lineup-suggestions.js` · RF-8 `llm.py`, `lineup-suggestions.js` · RF-9..RF-14 `llm.py` (`_select_*`) · RF-15, RF-16 `lineup-suggestions.js`, `llm.py` (vacío sin llamada) · RF-17 `llm.py` (`build_summary` omite nulos) · RF-18 `llm.py`, `app.py` · RF-19 `llm.py` (`_rate_limit`, caché) · RF-20 `llm.py` (`build_summary`), `docs/deployment.md` · RF-21 `llm.py` (`format_value`).

## 3. Backend — rutas y modelos

Sin tablas ni columnas nuevas.

### 3.1 `POST /api/ai/lineup-suggestions` (NUEVO · `login_required`)
- Body JSON: `{"team": "CNF", "goal": "anotar", "rival": null, "competition": 3, "last": null, "refresh": false}`. `goal` ∈ `anotar | defender | reboteear | frenar_ritmo | cerrar | vs_rival | infrautilizados | a_evitar | cambio_pieza | lectura_cierres`. `rival` obligatorio si `goal == "vs_rival"`. `competition` y `last` siguen §3.8 (contexto de fase 1/2: solo esos dos; otros parámetros de T-03 que existan se aceptan con los mismos nombres). `refresh` (PROPUESTA) fuerza una llamada nueva.
- Errores: 400 `{"error": "Elegí un tipo de lectura válido", "code": "parametro_invalido", "details": {"param": "goal"}}`; 400 `{"error": "Elegí el rival", "code": "parametro_invalido", "details": {"param": "rival"}}`; 400 si `rival == team`; 404 `{"error": "Equipo no encontrado", "code": "no_encontrado"}`; 429 `{"error": "Se alcanzó el límite de {n} generaciones por hora.", "code": "limite_ia", "details": {"limit": 20}}` (código PROPUESTA, no figura en §7.8); 502 `{"error": "No se pudo generar la lectura. Probá de nuevo en unos minutos.", "code": "llm_error"}`; 502 `timeout_externo` (tiempo agotado); 503 `{"error": "Las sugerencias asistidas por IA no están disponibles.", "code": "llm_deshabilitado"}`.
- 200 (con sugerencias):
```json
{
  "team": {"code": "CNF", "name": "Nacional"}, "goal": "anotar", "rival": null,
  "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "context": {"competition": {"id": 3, "label": "…"}, "applied": {}, "level": "partido", "games_used": 14, "games_total": 14, "label": "Todos los partidos"},
  "generated": true, "generated_at": "2026-10-04T15:20:00-03:00", "model": "claude-opus-5", "cached": false, "reason": null,
  "disclaimer": "Sugerencia generada automáticamente a partir de datos ya calculados. Describe lo que ya ocurrió; no predice ni sustituye el criterio del entrenador.",
  "considered": {"rows": 3, "eligible_lineups": 14, "min_poss": 19.2, "min_poss_source": "relativo"},
  "discarded": 0,
  "suggestions": [
    {"title": "Priorizá el quinteto A para anotar",
     "text": "Prieto · Oglivie · Feldeine · Canty · Rodríguez lidera en OER ajustado (1,12) con eFG% de 55,4%; es el de mejor ataque entre los quintetos con muestra suficiente.",
     "supporting_rows": [
       {"row_id": "R1", "lineup_id": "CNF:12-15-18-21-30", "names": ["Prieto", "Oglivie", "Feldeine", "Canty", "Rodríguez"],
        "sample": {"level": "alta", "unit": "posesiones", "n": 241.0},
        "table_link": "#/equipo/CNF/quintetos?lineup=CNF:12-15-18-21-30",
        "values": {"oer_adj": {"label": "OER aj.", "display": "1,12"}, "efg_pct": {"label": "eFG%", "display": "55,4%"},
                   "possessions": {"label": "Posesiones", "display": "241,0"}}}
     ]}
  ]
}
```
- 200 sin sugerencias (no es error HTTP): `{"suggestions": [], "generated": false, "reason": "sin_quintetos_sobre_umbral" | "validacion_fallida" | "rechazo_modelo", "considered": {...}, "disclaimer": "…"}`. `sin_quintetos_sobre_umbral` incluye `considered.min_poss` para el mensaje de la UI.

### 3.2 `GET /api/me` (tocado)
Agrega `llm_enabled: bool` = `llm.suggestions_enabled()`.

### 3.3 Variables de entorno (nuevas, `docs/deployment.md`)
`LLM_ENABLED` (`true` activa), `ANTHROPIC_API_KEY` (secreto: solo en Render, nunca en el repo), `LLM_MODEL` (default `claude-opus-5`), `LLM_TIMEOUT_SECS` (60), `LLM_MAX_RETRIES` (1), `LLM_EFFORT` (opcional: `low`…`max`). Sin `LLM_ENABLED` o sin clave o sin paquete → función apagada.

### 3.4 Claves de configuración (F-13)
| Clave | Tipo · default · rango | Sección | Estado |
|---|---|---|---|
| `ai.suggestions_enabled` | bool · true | Preferencias | de Arq. §3.2; pasa a `activa`; se omite de `spec_json()` si el entorno no tiene LLM |
| `ai.perf_pct` | int · 70 · 50–99 | Preferencias | **PROPUESTA (no está en 00-arquitectura-transversal.md)** |
| `ai.low_usage_share` | float % · 5 · 0.5–25 | Preferencias | PROPUESTA |
| `ai.top_n` | int · 3 · 1–5 | Preferencias | PROPUESTA |
| `ai.max_calls_per_hour` | int · 20 · 1–200 | Preferencias | PROPUESTA |

## 4. Backend — lógica (`backend/llm.py`)

### 4.1 Disponibilidad
```
try: import anthropic  except ImportError: anthropic = None          # mismo patrón que playwright en fiba_fetcher
llm_available() -> bool                 # LLM_ENABLED truthy y ANTHROPIC_API_KEY no vacía y anthropic is not None  (entorno)
suggestions_enabled() -> bool           # llm_available() and config.get("ai.suggestions_enabled")
```
`/api/me.llm_enabled` y la ruta usan `suggestions_enabled()`; `config.spec_json()` oculta `ai.suggestions_enabled` si `not llm_available()`.

### 4.2 `lineup_suggestions(team_code, comp_id, ctx, goal, rival) -> dict`
```
1. si not suggestions_enabled(): raise LlmError(503, "llm_deshabilitado")
2. validar goal; rival requerido y distinto del equipo para vs_rival
3. summary = build_summary(team, comp, ctx, goal, rival)                       # determinista, sin modelo
4. si summary["rows"] == []: return {suggestions: [], generated: False, reason: "sin_quintetos_sobre_umbral", considered}   # RF-16: no se llama al modelo
5. key = (team, comp, context_key(ctx), goal, rival, lang, nonce(key))         # nonce sube con refresh
   try: cache.memo("llm", key, producir, max_entries=32)                       # versiones de datos/config prefijan la clave (§3.14)
   producir():
     a. _rate_limit(owner)  → LlmError(429, "limite_ia") si el usuario ya hizo ai.max_calls_per_hour llamadas en los últimos 3600 s (deque en memoria por owner = prefs.current_owner())
     b. raw = _call_model(summary)                                              # §4.6
     c. suggestions, discarded = _process(raw, summary)                          # §4.5
     d. si suggestions == []: raise _Uncached(result con reason "validacion_fallida"|"rechazo_modelo")   # no se cachea un fallo
     e. devolver el resultado completo (cacheable)
6. el resultado marca cached = True cuando viene de la caché (la marca se agrega fuera del memo)
```
`_Uncached(result)` es una excepción interna que devuelve `result` sin cachearlo. Solo las llamadas reales al modelo consumen el cupo (`_rate_limit` está dentro de `producir`). El límite es por proceso (con 1 worker, DA-28, es exacto; con N workers, aproximado: se documenta).

### 4.3 `build_summary(...)` — selección determinista de filas y valores
Fuentes (todas vía las funciones que alimentan las tablas, para que los valores sean idénticos a los de la pantalla):
- Tabla de quintetos: `tables.build_table("team_lineups", {team, competition, last, base: "total"})` → `columns`, `rows[].values/pct/adj/sample/id/link` (shape §7.6). Cada fila se convierte a un dict `{id, names, sample, vals: {clave: valor}, pct: {clave: p}, adj: {oer, der, net_rating}}` leyendo por la posición de `columns`. `base="total"` fija la base (la base T-04 no cambia el ranking ni las tasas).
- Cierres: `tables.build_table("team_lineup_clutch", {team, competition, last})` (id de tabla PROPUESTO por F-06).
- Emparejamientos: `tables.build_table("matchups_quinteto", {team, rival, competition, last})` (F-07/F-03).
- Sinergias: `synergy.teammate_impact(team, comp, ctx)` (A-08).
Elegibles = filas con `sample.level != "baja"` (`sample.is_ranked`); cierres: `sample.level == "alta"` (caso especial `clutch_lineup`, §3.7).
`team_minutes = Σ minutes de todas las filas de la tabla` (el tiempo en cancha del equipo, incluidas las de muestra baja) para la participación.

Criterios por tipo (todos ordenan solo elegibles; desempate por `possessions` desc y luego por `id`):
| `goal` | Filas | Orden | Columnas del resumen |
|---|---|---|---|
| `anotar` | top `ai.top_n` | `adj.oer` desc | oer_adj, oer, efg_pct, ts_pct, ppt, ast_to, to_pct |
| `defender` | top `ai.top_n` | `adj.der` asc | der_adj, der, stl, blk, dr_pct, opp… (solo claves presentes en la tabla) |
| `reboteear` | top `ai.top_n` | `trb_pct` desc | trb_pct, or_pct, dr_pct, trb |
| `frenar_ritmo` | top `ai.top_n` | `pace` asc | pace, sec_per_poss, net_rating_adj, oer_adj, der_adj |
| `cerrar` | top `ai.top_n` de cierres | `win_pct_clutch` desc, luego `diff_tramo` desc, luego partidos desc | clutch_wins, clutch_losses, clutch_games, clutch_win_pct, clutch_diff, net_rating_adj |
| `lectura_cierres` | top `ai.top_n + 2` de cierres | ídem | ídem |
| `vs_rival` | top `ai.top_n` de emparejamientos con `sample ≥ media`, `games ≥ 1` y quinteto propio elegible | `adj.net_rating` del emparejamiento desc | mu_net_rating_adj, mu_oer, mu_der, mu_poss, mu_games + net_rating_adj propio |
| `infrautilizados` | top `ai.top_n` | percentil de Net ajustado (`pct` de la columna `net_rating`) desc, luego participación asc; filtro: percentil ≥ `ai.perf_pct` y `minutes/team_minutes·100 ≤ ai.low_usage_share` | net_rating_adj, p_net_rating, minutes, minutes_share, possessions |
| `a_evitar` | top `ai.top_n` | `adj.net_rating.value` asc; filtro: muestra `alta` y `value + band < 0` | net_rating_adj, net_rating_band, oer_adj, der_adj, possessions |
| `cambio_pieza` | top `ai.top_n` pares | `|d_net_rating_adj|` desc | por par: out, in, d_net_rating_adj, d_oer, d_der, d_efg_pct, d_trb_pct, d_to_pct, impact_out, impact_in |

`cambio_pieza`: de los elegibles, todos los pares `(A, B)` cuyos conjuntos de `player_id` (parseados del id `<team>:<pid>-<pid>-…`) comparten exactamente 4; se orienta desde el de más minutos ("habitual") hacia el otro; `out` = jugador de A que no está en B, `in` = jugador de B que no está en A; `d_* = valor(B) − valor(A)` se calcula en el backend restando los valores numéricos (sin formatear) de las dos filas de la tabla y se formatea con `format_value` en su variante con signo; la diferencia es una cifra derivada que no aparece como columna de la tabla, así que entra al resumen como valor propio de la fila del par (y se muestra tal cual en la tabla de soporte, junto a los valores de ambos quintetos que la originan). El modelo nunca resta. `impact_out`/`impact_in` salen de `synergy.teammate_impact` (campo de impacto en Net Rating que fije el plan de A-08, ver `../08-A-08-sinergias-jugadores/plan.md`; si el jugador no tiene fila → ausente del resumen, la UI muestra "—").

**Valores del resumen**: cada fila `R<k>` = `{id: "R1", lineup_id, names[], sample: {level, n, unit}, values: {clave: {label, display}}}`. Solo entran valores no nulos (RF-17); `display = format_value(fmt, v, lang)`. Percentiles como `p_<clave>` con formato entero. Nunca se envía el `lineup_id` crudo con números como texto citable: el modelo recibe `names` y `row_id`.
`allowed = {normalizar(display) for todos los displays} ∪ {normalizar(n de muestra, partidos, minutos)}`.

**`format_value(fmt, v, lang="es")`**: replica `core/format.js` (T-05 `fmtMetric`). Reglas: `pct` → `v·100`, 1 decimal, sufijo `%`; `dec1`/`dec2` → 1/2 decimales; `int` → 0 decimales; `signed_int`/`signed_dec2` → igual con signo explícito `+` en positivos (verificar contra el `fmtMetric` final de T-05 al implementar). Redondeo **half-up sobre el valor binario exacto**, igual que `Intl.NumberFormat` (no el half-even de `format()` de Python): `Decimal(v).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)`. Separador decimal por idioma: `es` y `pt` coma, `en` punto (`useGrouping: false`, como el frontend). `v` nulo → no se formatea (se omite).

### 4.4 Prompt (sistema y mensaje)
Sistema (español rioplatense; reglas, no ejemplos de datos): "Sos un redactor de lecturas de básquet. Recibís un resumen JSON ya calculado con filas R1, R2…; cada fila tiene valores listos para citar. Reglas: (1) no calculás, no estimás, no comparás cifras por tu cuenta; (2) para nombrar un valor escribí un marcador `{m:R<k>.<clave>}` con una clave existente en esa fila; (3) no escribas ningún dígito fuera de marcadores; (4) describí lo que ya ocurrió: sin predicciones, sin hablar de lesiones, faltas, estado físico ni decisiones tácticas; (5) cada sugerencia cita al menos una fila en `row_ids`; (6) si no podés redactar algo verificable, devolvé `suggestions: []`; (7) el campo `criterion` te dice por qué se eligieron esas filas." Mensaje de usuario: el JSON del resumen (`goal`, `goal_label`, `criterion` sin cifras, `team_name`, `context_label`, `rows`). Se anota el idioma (`lang`) para que redacte en él (hoy `es`).
Esquema de salida (`output_config.format`, `type: "json_schema"`): `{"suggestions": [{"title": string, "text": string, "row_ids": [string]}]}` con `additionalProperties: false`; los límites de cantidad (≤ 3 sugerencias, ≥ 1 `row_id`) se validan en el backend (no se confía en el esquema).

### 4.5 `_process(raw, summary)` — validación y descarte
Por cada sugerencia: (1) estructura válida (`title`, `text`, `row_ids` no vacío, todos existen en el resumen); (2) en `title` y `text` sin marcadores no hay ningún dígito (regex `\d`); (3) cada marcador `\{m:(R\d+)\.([a-z0-9_]+)\}` apunta a una fila y clave existentes y se reemplaza por su `display`; (4) `validate_numbers(texto_final, allowed)`: cada token numérico del texto resultante normalizado (sin `%`, espacios, `+`; `−`→`-`; `,`→`.`) debe pertenecer a `allowed`; (5) el marcador debe referir a una fila incluida en `row_ids` (si cita R3 sin listarla, se descarta). Cualquier fallo descarta **esa** sugerencia y suma 1 a `discarded`. Se quedan como máximo `3`. Resultado con 0 sugerencias → `validacion_fallida` (o `rechazo_modelo` si `stop_reason == "refusal"`).
`validate_numbers(text, allowed) -> tuple[bool, list[str]]`: `(todos_ok, tokens_fuera)`; token = `(?<![\w.])[-+−]?\d+(?:[.,]\d+)?`; devuelve la lista de tokens no permitidos.
`supporting_rows`: por cada `row_id` de la sugerencia, `{row_id, lineup_id, names, sample, table_link, values (todas las claves de la fila con label y display)}`, sacado del resumen (no del texto del modelo).

### 4.6 `_call_model(summary)`
Cliente: `anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"], timeout=LLM_TIMEOUT_SECS, max_retries=LLM_MAX_RETRIES)`; llamada de mensajes (con el espacio beta del SDK para el mecanismo de reintento por negativa): `model=LLM_MODEL`, `max_tokens=16000` (Arq. §3.16), `system`, un solo mensaje de usuario, `output_config={"format": {...esquema...}, "effort": LLM_EFFORT}` (la clave `effort` solo si la variable existe), `betas=["server-side-fallback-2026-07-01"]` y `fallbacks="default"` (la forma exacta de pasar `fallbacks` —argumento nombrado o `extra_body`— y la versión mínima del paquete que lo soporta se verifican contra la documentación del SDK al implementar; no se fijan de memoria). No se envía `thinking` (el modelo decide; en la línea Opus 5 no se puede desactivar), ni `temperature`/`top_p` (no admitidos), ni `tool_choice` forzado ni prefill. Procesamiento: `stop_reason == "refusal"` → `rechazo_modelo`; `max_tokens` o JSON ilegible → `validacion_fallida`; excepciones de red/HTTP del SDK → `LlmError(502, "llm_error")`; `APITimeoutError` → `LlmError(502, "timeout_externo")`. Se toma solo el texto de los bloques `text`; los bloques de pensamiento se ignoran. Se registra en el log (nivel info, sin contenido del resumen ni del texto): modelo, tokens de entrada y salida (`usage`), duración y `goal`. Presupuesto de tiempo: 60 s × 2 intentos = 120 s < 180 s de gunicorn (Arq. §3.16); con un solo worker síncrono la llamada bloquearía la app → requiere DA-28 (`--workers 1 --threads 4`), que F-01 introduce; si no está aplicado al implementar F-15, la tarea T-E3 lo agrega.

### 4.7 Casos borde
Equipo sin pbp (sin quintetos) → vacío `sin_quintetos_sobre_umbral`; fila con todas las métricas nulas → no entra; `team_minutes == 0` → la participación es nula y los quintetos no entran a "infrautilizados"; pares sin fila de sinergia → impacto ausente; competencia con 2 filas elegibles → se envían 2; resumen de tamaño acotado (≤ 7 filas, ≤ 20 valores por fila). División por cero: se calcula con `_safe_div` (`stats_engine`) donde corresponda.

## 5. Frontend — capa API (`api.js`)
```js
aiLineupSuggestions: (body) => send("/api/ai/lineup-suggestions", "POST", body),   // {team, goal, rival, competition, last, refresh}
```
`me()` ya existe (trae `llm_enabled`). Sin `fetch` fuera de `api.js`.

## 6. Frontend — UI
`components/lineup-suggestions.js` (PROPUESTA): `renderLineupSuggestions(el, {teamCode, teams, context, enabled})`.
1. Si `!enabled` → no dibuja nada (RF-3).
2. Dentro de `collapsible(el, {panelId: "equipo.quintetos.ia", title: "Sugerencias asistidas por IA", defaultOpen: false})`.
3. Cabecera fija: los tres límites (RF-15) y, al lado, el texto "Las sugerencias se generan solo cuando las pedís." (aclara el costo).
4. Controles: `<select>` de tipo (10 opciones del spec §6), `<select>` de rival (visible con "Contra un rival…", lista de `teams` sin el propio) y botón "Generar sugerencias" (deshabilitado sin conexión o mientras carga).
5. Al tocar: `api.aiLineupSuggestions({team, goal, rival, competition, last})`. Loading con spinner y texto; éxito → tarjetas (`<article>`) con etiqueta "Generada automáticamente", título, texto (escapado con `esc()`; los textos del modelo nunca se insertan como HTML), y debajo "Datos que la sustentan" (tabla compacta: quinteto, valores `display`, `sampleBadge(sample)` de T-02, enlace `table_link` que pone el foco en la fila de la tabla vía `data-table` `scrollToRow(id)`). Pie con `generated_at`, `considered`, "Regenerar" (`refresh: true`).
6. Vacíos y errores por `reason`/`code` con el copy del spec §6 (el mensaje de umbral interpola `considered.min_poss`).
Componentes reutilizados: `collapsible.js` (X-01), `sample-badge.js` (T-02), `data-table.js` (`scrollToRow`, F-06), `core/format.js` (`esc` existe en `app.js`; si no, helper local), `core/prefs.js` (estado del panel). Mobile (<768 px): una columna; tabla de soporte con scroll horizontal y primera columna fija; límites arriba de las tarjetas. Copy en español directo (DA-21 resuelta); F-21 lo extrae.

## 7. Navegación
Sin ruta nueva: el panel vive en `#/equipo/<code>/quintetos` (pestaña de S3 que registra F-06). Actualiza `docs/frontend.md`. El enlace de la tabla de soporte usa `#/equipo/<code>/quintetos?lineup=<id>` (formato de id de §3.12).

## 8. Contratos de datos
Request/response en §3.1; estructura del resumen (no se expone al cliente HTTP; se registra solo en depuración local):
```json
{"goal": "anotar", "goal_label": "Anotar", "criterion": "Quintetos ordenados por OER ajustado, de mayor a menor",
 "team_name": "Nacional", "context_label": "Todos los partidos", "lang": "es",
 "rows": [{"row_id": "R1", "names": ["Prieto", "Oglivie", "Feldeine", "Canty", "Rodríguez"],
           "sample": {"level": "alta", "n": "241,0", "unit": "posesiones"},
           "values": {"oer_adj": {"label": "OER ajustado", "display": "1,12"}, "efg_pct": {"label": "eFG%", "display": "55,4%"},
                      "p_net_rating": {"label": "Percentil de Net Rating ajustado", "display": "88"}}}]}
```
Filas SQLAlchemy: ninguna.

## 9. Manejo de errores y offline
| Código | Caso | Mensaje (español) |
|---|---|---|
| 400 `parametro_invalido` | `goal` inválido, falta o repite el rival | "Elegí un tipo de lectura válido" · "Elegí el rival" · "El rival no puede ser el mismo equipo" |
| 404 `no_encontrado` | equipo inexistente | "Equipo no encontrado" |
| 429 `limite_ia` | límite por hora | "Se alcanzó el límite de {n} generaciones por hora." |
| 502 `llm_error` / `timeout_externo` | fallo del servicio de IA | "No se pudo generar la lectura. Probá de nuevo en unos minutos." |
| 503 `llm_deshabilitado` | función apagada | "Las sugerencias asistidas por IA no están disponibles." |
| 200 `reason` | `sin_quintetos_sobre_umbral` · `validacion_fallida` · `rechazo_modelo` | "Ningún quinteto supera el umbral de muestra ({n} posesiones) para esta lectura. No se genera sugerencia." · "No se pudo generar una lectura verificable. Probá de nuevo." · "El servicio de IA no pudo responder esta consulta." |
Offline: la llamada exige red (`/api/*` siempre a red); el botón se deshabilita con "Sin conexión: las sugerencias necesitan conexión.". `sw.js`: componente nuevo a `STATIC` y bump de `CACHE` si X-01 no migró a runtime caching.

## 10. Riesgos y decisiones

- **D-1 (modelo por defecto, DA-24):** se mantiene `claude-opus-5` como pide la arquitectura. Hay un modelo posterior de la misma línea (`claude-opus-5-5`) más barato por token; se reporta en `desacuerdos_arquitectura` para que el humano decida (cambiar la variable de entorno basta). Para una tarea de redacción sobre un resumen chico conviene medir también `LLM_EFFORT=low` y modelos menores antes de fijar el de producción (costo por lectura completada, no por llamada).
- **D-2 (dependencia nueva, Constitución 2):** `anthropic` es la única forma soportada de usar salida estructurada, reintento por negativa y manejo de errores tipados; reimplementarla con `urllib` duplicaría lógica de reintentos y de esquemas (DA-24 alternativa). Se declara en `requirements.txt` pero con import protegido: sin la clave o la bandera, la app arranca igual y la función queda apagada, como Playwright. Pin de versión: verificar con `pip index versions anthropic` la mínima que soporte `output_config` y `fallbacks` (no se fija de memoria).
- **D-3 (valores desde la tabla):** F-15 consume los constructores de tablas de F-06/F-07 en lugar de recalcular; si esos ids de tabla cambian, F-15 se rompe en pruebas (CA-1/CA-18 lo detectan). Dependencia explícita de los ids `team_lineups`, `team_lineup_clutch` (PROPUESTA de F-06) y `matchups_quinteto` (Arq. §6).
- **D-4 (formateador duplicado):** el redondeo del backend debe coincidir con el del frontend (half-up exacto); CA-18 lo verifica con 20 valores. Si T-05 cambia `fmtMetric`, hay que actualizar `format_value` (anotado en `docs/frontend.md`).
- **D-5 (límite por proceso):** el límite de llamadas por hora vive en memoria del proceso; con N workers es aproximado, con el worker único de DA-28 es exacto. Un reinicio lo reinicia. Aceptable para un control de costo (no es seguridad).
- **D-6 (privacidad, R-13):** salen del servidor nombres de jugadores y métricas agregadas hacia el proveedor del modelo; no salen usuarios ni datos crudos. Debe confirmarse con el cliente (spec §9). La clave solo vive en `ANTHROPIC_API_KEY` del servidor.
- **D-7 (inyección de prompt):** el resumen contiene solo texto propio y nombres de FIBA; el texto del modelo se valida (dígitos, marcadores) y se renderiza escapado; no se ejecuta ni se interpreta como HTML.
- **D-8 (costo, estimación a medir):** entrada ≈ 1,5–3 mil tokens y salida ≈ 1–2 mil por lectura: del orden de unos pocos centavos de dólar con el modelo por defecto. Se registra `usage` de cada llamada en el log y el costo medido se anota en `progress.md`; `ai.max_calls_per_hour` acota el peor caso.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato. PROPUESTAS que se reportan como huecos: componente `lineup-suggestions.js` (no figura en §8), claves `ai.*` extra, código de error `limite_ia`, campo `refresh`, formateador de backend, parámetro de contexto en el cuerpo del POST, id de tabla `team_lineup_clutch` (de F-06).
- **Dependencias técnicas:** `tables.build_table`/`register_table` y `components/data-table.js` ([T-06](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)); `sample.sample_level`/`adjusted`/`band`/`is_ranked` ([T-02](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)); `stats_engine.compute_standard` ([T-05](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)); tablas `team_lineups`/`team_lineup_clutch` y `lineups.all_lineups` ([F-06](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)); `matchups_quinteto` y `matchups.team_matchups` ([F-07](../../fase-4-dia-de-partido/01-F-07-analizar-partido/plan.md), [F-03](../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md)); `synergy.teammate_impact` ([A-08](../08-A-08-sinergias-jugadores/plan.md)); `config.py`/`prefs.py` ([F-13](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)); `cache.memo` ([F-11](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)); `collapsible.js`, router y pestañas ([X-01](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)); gunicorn con hilos ([F-01](../../fase-4-dia-de-partido/03-F-01-partido-en-vivo/plan.md), DA-28).
- **Incremento diferido (→ F-21):** salida en inglés y portugués y números con separador por idioma en el texto; `llm._lang()` devuelve `"es"` hasta que F-21 lo conecte a `i18n.current_lang()` (el formateador ya soporta los tres idiomas).
- **Estimación:** L · 12–19 h (resumen y selección por tipo 4–6 h; llamada, marcadores y validación 3–4 h; endpoint, límites, caché y configuración 2–3 h; panel 2–3 h; verificación con servicio simulado y docs 1–3 h).
