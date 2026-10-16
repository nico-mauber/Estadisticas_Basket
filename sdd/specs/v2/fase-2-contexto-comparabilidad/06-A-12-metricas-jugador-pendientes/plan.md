# Plan — A-12: Métricas de jugador pendientes

> **ID:** A-12 · **Prioridad:** P1 · **Fase y orden:** 2·06
> **Depende de:** C-01, T-01, F-11, T-05, X-01 (y C-08, C-02, T-02, C-11 vía ellos) — ver [spec.md](spec.md)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §5.4 · A-12 · Arquitectura §1.6, §2.2, §3.5, §3.6, §5, §9.2 I-03
> **Estimación:** M · 5–8 h

## 1. Enfoque

Tres piezas pequeñas sobre la infraestructura de fase 1:

1. **Datos**: `pbp_events.previous_action` (columna nueva, `DEFAULT NULL`) leída de `previousAction` en `fiba_fetcher.py`, guardada
   por `ingest.persist_game`, con `INGEST_VERSION` subida para que el panel de calidad (F-11) marque los partidos a reprocesar;
   el reproceso desde el JSON archivado (`ingest.reprocess_games`, lotes de `REPROCESS_BATCH`) completa los partidos existentes.
2. **Cálculo**: módulo nuevo `backend/assists.py` (PROPUESTA de nombre) que vincula cada evento `assist` con su evento de
   puntuación y devuelve conteos por jugador; `stats_engine.compute_standard` (T-05) suma las fórmulas de las claves nuevas
   (`ast_team_share`, `ast_points`, `pts_per_ast`) y el slot nulo de `player_poss_duration`; el catálogo (`metrics_catalog.py`)
   las registra para la entidad `player` y el loader de `player` de T-05 adjunta los conteos al `StatBundle`
   (campo nuevo `ast_links`, PROPUESTA). Las fichas y percentiles de T-01 salen solas por `attach_fichas`.
3. **UI**: card "Creación de juego" (`components/assist-card.js`, PROPUESTA de archivo) montada en S4 → Distribución, con
   `metricCard` (T-01) y `sampleBadge` (T-02) por indicador. Sin endpoints nuevos: consume `GET /api/metrics/player` (T-05).

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/database.py` | model | `PbpEvent.previous_action = db.Column(db.Integer)`; entrada `("pbp_events", "previous_action", "INTEGER")` en `upgrade_db().new_cols` (sin DEFAULT: NULL = no importado) | RF-5 |
| `backend/fiba_fetcher.py` | parser | en el bloque "Full play-by-play", agregar `"previous_action": _i(ev, ["previousAction"], default=None)` al dict de cada evento | RF-5 |
| `backend/ingest.py` | ingest | `pbp_cols` suma `"previous_action"`; `INGEST_VERSION` sube al siguiente entero (comentario de versiones con la línea nueva) | RF-5 |
| `backend/data_quality.py` | module | `NULL_FIELDS` suma `("pbp_events", "previous_action", "Vínculo de asistencias (previous_action)")`; `_null_fields` cuenta solo eventos `assist` para ese campo (`models` suma `PbpEvent`) | RF-11 |
| `backend/assists.py` | module NUEVO (PROPUESTA) | `game_assist_links`, `competition_assist_links`, `player_assist_links`, constante `POINTS_BY_TYPE` | RF-3, RF-4, RF-10 |
| `backend/stats_engine.py` | module (T-05) | campo `StatBundle.ast_links: dict \| None = None`; en `compute_standard`: `ast_team_share`, `ast_points`, `pts_per_ast`, `player_poss_duration` (nulo `requiere_posesiones`); `apply_base` trata `ast_points` como `count` | RF-1, RF-4, RF-8, RF-9 |
| `backend/metrics_catalog.py` | module (T-05) | 4 `MetricDef` nuevas (entidad `player`) + pertenencia a `GROUPS`; el loader del tipo `player` llama a `assists.player_assist_links` y asigna `bundle.ast_links` y `bundle.null_reasons["*ast_links*"]` | RF-6, RF-10 |
| `backend/app.py` | route | **sin cambios** (los endpoints de T-05/T-01/C-08 devuelven las claves nuevas) | — |
| `frontend/js/core/format.js` | js-core | `NULL_REASON_LABELS` suma `sin_pbp` y `requiere_posesiones` si T-05 todavía no los agregó | RF-8, RF-10 |
| `frontend/js/components/assist-card.js` | js-component NUEVO (PROPUESTA) | `renderCreationCard(el, payload, {contextQuery})`: 4 indicadores con `metricCard`/`sampleBadge`, tooltips, estados | RF-2, RF-7, RF-8 |
| `frontend/js/views/jugador.js` | js-view (X-01) | monta la card en la pestaña `distribucion`; quita `AS/pos` de la card de C-01 | RF-2, RF-7 |
| `frontend/css/style.css` | css | sección `/* ── assist-card (A-12) ── */` (grilla 1–2 columnas, nota de cobertura) | RF-7 |
| `frontend/sw.js` | sw | `assist-card.js` a `STATIC` y `CACHE` +1 **solo** si X-01 aún no pasó a runtime caching | RF-7 |
| `docs/database.md` | doc | columna `pbp_events.previous_action`, versión de ingesta | cierre |
| `docs/metrics.md` | doc | definición de `ast_team_share`, `pts_per_ast`, `ast_points`, `player_poss_duration` (diferido); diferencia con `as_pos` y `as_pct`; regla de asistencias ligadas a tiro libre | cierre |
| `docs/api.md` | doc | claves nuevas en `metrics`, campo `detail` y `coverage` | cierre |
| `docs/frontend.md` | doc | card "Creación de juego", copy nuevo | cierre |
| `docs/architecture.md` | doc | módulo `assists.py` | cierre |

Matriz RF → archivo: RF-1 (`stats_engine.py`, `metrics_catalog.py`) · RF-2 (`assist-card.js`, `jugador.js`) · RF-3
(`assists.py`, `database.py`, `fiba_fetcher.py`, `ingest.py`) · RF-4 (`assists.py`, `stats_engine.py`) · RF-5 (`database.py`,
`fiba_fetcher.py`, `ingest.py`) · RF-6 (`metrics_catalog.py`) · RF-7 (`assist-card.js`, `jugador.js`, `style.css`) · RF-8
(`stats_engine.py`, `metrics_catalog.py`, `assist-card.js`, `format.js`) · RF-9 (`stats_engine.py` `apply_base`, contexto en el
loader) · RF-10 (`assists.py`, `stats_engine.py`, `assist-card.js`) · RF-11 (`data_quality.py`).

## 3. Backend — rutas y modelos

### 3.1 Esquema

| Tabla.columna | Tipo | Default | Vía | Constraints |
|---|---|---|---|---|
| `pbp_events.previous_action` | INTEGER | NULL | modelo `PbpEvent` + `upgrade_db()` (`ALTER TABLE pbp_events ADD COLUMN previous_action INTEGER`, error ignorado si existe, idempotente) | ninguna; es el `actionNumber` del evento vinculado. NULL = no importado todavía (partido anterior a la versión de ingesta) |

Semántica: FIBA manda `previousAction` en `assist`, `rebound`, `steal`, `block`, `foulon`, `turnover` y otros; para los
eventos que no lo traen el parser guarda NULL (`_i(..., default=None)`). La distinción "no importado" vs "FIBA no envió vínculo"
la da la versión de ingesta del partido (`games.ingest_version`): un partido con la versión nueva cuyo `assist` tiene NULL es un
vínculo ausente (cuenta como `sin vínculo`); un partido con versión anterior es "no registrado".

No hay tablas nuevas ni backfill: el dato se completa reprocesando desde `game_sources` (sin red).

### 3.2 Endpoints

Sin rutas nuevas. A-12 agrega claves a la respuesta de endpoints de otros dueños:

**`GET /api/metrics/player?id=<player_id>&competition=<id>[&last=<n>][&base=<b>]`** (T-05; ejemplo de las claves nuevas dentro
de `metrics`, con la ficha de T-01; valores ilustrativos)
```json
"ast_team_share": {
  "value": 0.2143, "reason": null,
  "rank": 3, "rank_total": 32, "tied": false, "in_population": true, "percentile": 91,
  "avg": 0.0821, "dist_avg": 0.1322, "leader": {"id": "12", "name": "C. Zinaich", "value": 0.3012},
  "dist_leader": -0.0869, "adj": null, "sample": null
},
"pts_per_ast": {
  "value": 2.41, "reason": null,
  "rank": 5, "rank_total": 32, "tied": false, "in_population": true, "percentile": 84,
  "avg": 2.27, "dist_avg": 0.14, "leader": {"id": "7", "name": "M. Aguilera", "value": 2.68},
  "dist_leader": -0.27, "adj": null, "sample": null,
  "detail": {"fg2": 41, "fg3": 22, "ft": 5, "unlinked": 0, "games_ok": 11, "games_total": 13},
  "coverage": {"games_with_link": 11, "games_total": 13}
},
"ast_points": {"value": 169, "reason": null, "percentile": 88, "detail": {"fg2": 41, "fg3": 22}, "...": "ficha T-01"},
"player_poss_duration": {"value": null, "reason": "requiere_posesiones"}
```
- `detail` y `coverage` son campos adicionales **propios de A-12** (PROPUESTA: extienden el contrato §7.1/§7.3, aditivos y
  opcionales); solo aparecen en `pts_per_ast` y `ast_points`.
- Nulos: `pts_per_ast` sin asistencias a tiros de campo → `{"value": null, "reason": "sin_intentos"}`; ningún partido de la
  selección con pbp → razón `sin_pbp`; con pbp pero sin `previous_action` → `no_registrado`; con una selección mixta se calcula
  con los partidos con vínculo y `coverage.games_with_link < games_total`.
- Con `base` ≠ `total`, `ast_points` y `detail` se escalan según `apply_base`; `pts_per_ast`/`ast_team_share` no.
- Errores: los de T-05 (400 `parametro_invalido`, 404 `no_encontrado`); A-12 no agrega códigos.

**`GET /api/rankings/player/<metric_key>`** (T-01): acepta las 4 claves nuevas sin cambios (la población usa los valores
de `compute_standard`).

## 4. Backend — lógica

### 4.1 `backend/assists.py` (NUEVO — PROPUESTA de módulo; capa de cálculo sobre `pbp_events`, sin persistir)

```
POINTS_BY_TYPE = {"2pt": 2, "3pt": 3}

game_assist_links(events: list[dict], player_ids: dict[tuple[str, str], int], *, ingest_version: int | None)
        -> {"status": "ok" | "sin_pbp" | "no_registrado",
            "players": {player_id: {"fg2": int, "fg3": int, "ft": int, "unlinked": int}}}
competition_assist_links(game_ids: list[str]) -> dict[str, dict]        # game_id → resultado de game_assist_links; cacheado
player_assist_links(player_id: int, game_ids: list[str]) -> dict | None
        # {"fg2","fg3","ft","unlinked","games_ok","games_total","games_sin_pbp","games_no_registrado"}; None si game_ids vacío
```

**`game_assist_links` paso a paso**
1. Si `events` está vacío o no tiene ningún `assist` ni tiros → `status = "sin_pbp"`, `players = {}`.
2. `by_num = {e["action_number"]: e for e in events}` (solo `assist`, `2pt`, `3pt`, `freethrow` hace falta cargar; ver §4.2).
3. Para cada `e` con `action_type == "assist"`:
   - `pid = player_ids.get((e["team_code"], e["player_name"]))`; si es `None` (jugador no mapeado) → se ignora y se cuenta en
     `unmapped` (log), nunca se asigna a otro.
   - Si `e["previous_action"] is None`: marca el partido `no_registrado` (si `ingest_version` es menor que la vigente o es NULL;
     en un partido de la versión vigente cuenta como `unlinked`).
   - `t = by_num.get(e["previous_action"])`:
     - `t is None` o `t["team_code"] != e["team_code"]` o `t["success"] != 1` → `unlinked += 1`.
     - `t["action_type"] == "2pt"` → `fg2 += 1`; `"3pt"` → `fg3 += 1`; `"freethrow"` → `ft += 1`; otro tipo → `unlinked += 1`.
4. `status = "no_registrado"` si hubo algún `assist` con `previous_action is None` en un partido de versión anterior; si no `"ok"`.
5. Devuelve `players[pid]` con los cuatro contadores (jugadores sin asistencias no aparecen: contarán 0 en la suma).

**`competition_assist_links(game_ids)`**: una consulta por lote a `PbpEvent` filtrando `action_type IN ("assist", "2pt", "3pt",
"freethrow")` y `game_id IN game_ids` (≈ 90 eventos por partido en vez de 550), más el mapa
`(game_id, team_code, player_name) → canonical_id(player_id)` de `PlayerGameStats` (C-08, `identity.canonical_id`), y llama a
`game_assist_links` por partido. Caché: `cache.memo("assists:links", (tuple(sorted(game_ids)),), …)` **si `cache.py` existe**
(F-11 lo difirió; ver `../../00-decisiones.md`); sin él, se calcula por petición (≈ 200 partidos × 90 eventos: despreciable) y
se mide en `progress.md`.

**`player_assist_links(player_id, game_ids)`**: filtra `game_ids` a los partidos que el jugador **jugó** (`played(minutes)`),
suma `fg2/fg3/ft/unlinked` de los partidos con `status == "ok"` y cuenta `games_ok`, `games_sin_pbp`, `games_no_registrado`,
`games_total` (= partidos jugados de la selección).

Contexto de nivel evento (T-03 `quarter`, `score`, `on`/`off`): el loader pasa `ctx`; si `context.event_predicate(ctx, team)`
no es `None`, el **vínculo se resuelve sobre el partido completo** y el filtro se aplica a los eventos `assist` (el predicado
recibe `(evento, estado)` con el estado del marcador y de los jugadores en cancha del evento). Esto evita perder el evento
vinculado cuando cae fuera del filtro (p. ej. asistencia en el cuarto elegido, canasta ya registrada en el mismo cuarto: caso
normal, pero también el borde de un cambio de cuarto). En fase 2 con solo `competition` y `last` no hay predicado.

### 4.2 Fórmulas en `stats_engine.compute_standard` (regla 4; el cálculo vive en `stats_engine`, no en `assists.py`)

```
# entradas: bundle.own["ast"], bundle.team["ast"] (conteos del equipo en los partidos jugados), bundle.ast_links
ast_team_share:
    if bundle.team is None or bundle.team.get("ast") is None  → null, reason "sin_datos"
    team_ast = bundle.team["ast"]
    value = _safe_div(bundle.own["ast"], team_ast)         # team_ast == 0 → None → reason "sin_intentos"
ast_points / pts_per_ast:
    l = bundle.ast_links
    if l is None or l["games_ok"] == 0:
        reason = "no_registrado" if (l and l["games_no_registrado"] > 0) else "sin_pbp"
        → ambos nulos con esa razón
    fg = l["fg2"] + l["fg3"]
    ast_points  = 2*l["fg2"] + 3*l["fg3"]                  # conteo (0 es un cero real si games_ok > 0 y no hay asistencias a campo)
    pts_per_ast = _safe_div(ast_points, fg)                 # fg == 0 → None, reason "sin_intentos"
    detail   = {fg2, fg3, ft, unlinked, games_ok, games_total}
    coverage = {games_with_link: games_ok, games_total}
player_poss_duration:
    value None, reason "requiere_posesiones"                # A-01 reemplaza este bloque
```
- Cociente de totales (DA-02): los conteos de `ast_links` ya son la suma de la selección; no se promedian ratios por partido.
- `ast_team_share` ≠ `as_pct` (T-05, DA-06) ≠ `as_pos`: tres claves, tres fórmulas, ninguna deriva de otra.
- Coherencia box↔pbp: `Σ player_game_stats.ast = Σ eventos assist` (459 = 459 en el seed). `ast_team_share` usa el box (cuando
  el nivel de contexto es evento, el loader de T-05 arma `own.ast`/`team.ast` desde el pbp y la fórmula no cambia).
- `apply_base` (T-04): `ast_points` con `base_mode = count`; `pts_per_ast`, `ast_team_share`, `player_poss_duration` con
  `fixed` (o `volume` no aplica). `detail` se escala solo para `fg2/fg3/ft/unlinked` cuando la base no es `total`
  (se aplica la misma conversión que a `ast_points`).

### 4.3 Catálogo (`metrics_catalog.py`, T-05)

| key | label | group | fmt | direction | kind · base_mode | source | entities | rel_dist |
|---|---|---|---|---|---|---|---|---|
| `ast_team_share` | % asist. del equipo | balon | pct | neutral (D-4) | rate · fixed | box | `("player",)` | False |
| `ast_points` | Pts. por asistencias | balon | int | higher | count · count | col_v2 (pbp + `previous_action`) | `("player",)` | False |
| `pts_per_ast` | Pts. por asistencia | balon | dec2 | higher | rate · fixed | col_v2 | `("player",)` | False |
| `player_poss_duration` | Seg. de posesión | uso | dec1 | neutral | rate · fixed | poss (A-01) | `("player",)` | False |

`ast_points` es `PROPUESTA (no está en 00-arquitectura-transversal.md)`: la arquitectura solo nombra `ast_team_share` y
`pts_per_ast` para A-12; se agrega el conteo de puntos porque el cliente pide "cuánto asiste y cuántos puntos se convierten".
Las otras tres claves están en Arq. §3.5.

### 4.4 Ingesta y reproceso
- `fiba_fetcher.py` (bloque "Full play-by-play"): agrega `"previous_action": _i(ev, ["previousAction"], default=None)`. Sin
  otro cambio del parseo; `_i` ya devuelve `default` si la clave falta.
- `ingest.persist_game`: `pbp_cols = (…, "action_number", "previous_action")`. El reemplazo de filas hijas (`delete` +
  `executemany`) ya es idempotente: reprocesar dos veces deja el mismo número de eventos.
- `INGEST_VERSION`: sube al siguiente entero al vigente al integrar (hoy 2). Efecto: `needs_reprocess` marca todos los
  partidos ya importados; el panel de calidad (F-11) muestra "pendientes de reproceso" y el botón existente los reprocesa desde
  el archivo (`game_sources`), sin red, en lotes de `REPROCESS_BATCH` (5).
- `data_quality._null_fields`: para `("pbp_events", "previous_action", …)` el total es `COUNT(assist)` y los nulos
  `COUNT(assist AND previous_action IS NULL)`; razón `no_registrado`.

### 4.5 Manejo de nulos y casos borde (C-11)
- 0 asistencias del jugador con equipo que sí asistió → `ast_team_share = 0,0` (cero real); `pts_per_ast` nulo `sin_intentos`.
- Equipo sin asistencias en los partidos jugados → `ast_team_share` nulo `sin_intentos`.
- DNP: excluido de `games` y de las sumas (`played(minutes)`).
- Jugador de dos fichas fusionadas (C-08): `canonical_id` unifica; los eventos se mapean por el nombre de cada partido.
- Asistencia cuyo evento vinculado no está en el pbp (hueco de `actionNumber`) → `unlinked`; se informa en `detail`.
- Prórroga: sin tratamiento especial (el vínculo no depende del período).

## 5. Frontend — capa API (`api.js`)
Sin métodos nuevos: se usa `api.metrics("player", {id: player_id, ...contextQuery, base})` (T-05) y `api.ranking("player",
clave, params)` (T-01) que ya abre el ranking completo desde `metricCard`.

## 6. Frontend — UI

**Dónde vive.** S4 → pestaña **Distribución** (`#/jugador/<player_id>/distribucion`, X-01). Antes de X-01 (no aplica: X-01 es
anterior a A-12) la card se montaría en `_renderPlayerContent` de `app.js`.

**Componente `components/assist-card.js`** (NUEVO — PROPUESTA de archivo):
`renderCreationCard(el, payload, {contextQuery})` donde `payload` es la respuesta de `/api/metrics/player`.
1. Título "Creación de juego".
2. `.stat-grid` con cuatro `metricCard(key, payload.metrics[key], {entityType: "player"})` (T-01) en este orden: `as_pos`
   (AS/pos), `ast_team_share` (% asist. del equipo), `pts_per_ast` (Pts. por asistencia), `player_poss_duration` (Seg. de
   posesión). Los dos primeros llevan un subtítulo que los distingue: "por posesión propia" / "del total del equipo".
3. Debajo de `pts_per_ast`: línea secundaria "`ast_points` pts. de `fg2+fg3` asist. a tiros de campo" y, si `detail.ft > 0`,
   "(+ `ft` asist. ligadas a tiros libres, no cuentan)"; si `coverage.games_with_link < games_total`: "Calculado sobre X de
   Y partidos; reimportá los demás".
4. `player_poss_duration`: `nullDisplay("requiere_posesiones")` con el texto "Se calcula con el motor de posesiones (en
   desarrollo)" (copy nuevo) y se mantiene el espacio para que A-01 lo complete.
5. Badge de muestra T-02 (`sampleBadge(payload.sample, {compact: true})`) en el encabezado de la card; con muestra baja los
   indicadores en gris (`.metric-low-sample`).
6. Estados: loading (spinner), error (mensaje del servidor + "Reintentar"), offline ("Sin conexión. No se pudo cargar la
   creación de juego."), vacío (ver spec §6).
7. `bindMetricCards(el, {entityType: "player", contextQuery})` para el hover/tap del ranking completo.

**Mobile (768 px).** `.stat-grid` ya colapsa a una o dos columnas; el ranking completo abre como hoja inferior (T-01).

**Reutiliza (Arq. §8):** `metricCard`/`bindMetricCards` (T-01), `sampleBadge` (T-02), `nullDisplay`/`NULL_REASON_LABELS` y
`fmtNumber` (C-11), `core/catalog.js` (`metricLabel`), `api.metrics`.

## 7. Navegación
Sin vistas nuevas: la pestaña `distribucion` de S4 ya la registra X-01 (`#/jugador/<player_id>/distribucion`).

## 8. Contratos de datos
- `GET /api/metrics/player`: §7.3 + §7.1 (ficha) con `detail` y `coverage` aditivos en `pts_per_ast`/`ast_points` (PROPUESTA).
- Entrada de `game_assist_links`: eventos con claves `action_number, action_type, team_code, player_name, success,
  previous_action` (las columnas de `PbpEvent`).
- Sin cambios en `GET /api/player/<…>` legado.

## 9. Errores y offline
| Caso | Respuesta / UI |
|---|---|
| Jugador inexistente | 404 del endpoint de T-05 → card con el mensaje del servidor y "Reintentar" |
| Competencia sin partidos reprocesados | `pts_per_ast`/`ast_points` `no_registrado`: "—" + "Reimportá sus partidos" |
| Partido sin pbp | `sin_pbp` → "—" + "Partido sin play-by-play" |
| Red caída | "Sin conexión. No se pudo cargar la creación de juego." |
| Service worker | si X-01 ya usa runtime caching, nada que agregar; si no, `assist-card.js` a `STATIC` y `CACHE` +1 |

## 10. Riesgos y decisiones
- **R-1 Reproceso obligatorio.** Sin reprocesar, `pts_per_ast` y `ast_points` salen nulos `no_registrado` (no fabricamos el dato
  por inferencia: C-11 `00-decisiones.md`). Mitigación: la subida de `INGEST_VERSION` hace que el panel de F-11 ofrezca el
  reproceso, que funciona sin red desde `game_sources` (13 partidos reprocesados en 19,9 s en F-11).
- **R-2 Vínculos de FIBA a tiros libres (10 %).** Decisión D-1 del spec: se informan aparte y no entran en los puntos.
  Verificado: 459/459 asistencias del seed con vínculo; 0 sin vínculo; 459 = 459 con el box.
- **R-3 Orden del pbp.** El JSON de FIBA lista los eventos del más nuevo al más viejo; la base los guarda con `action_number` y
  los módulos ordenan por él. `game_assist_links` no depende del orden (usa `by_num`).
- **R-4 Colisión de versiones de ingesta.** Si otros requisitos de fase 2 (p. ej. F-16, F-04) también suben `INGEST_VERSION`,
  el valor final lo define el orden de integración; el plan no fija un número. Ver spec D-6.
- **R-5 Nombres del loader de T-05.** El plan de T-05 se escribe en paralelo; el nombre exacto de la función del loader `player`
  y de `StatBundle` puede variar. A-12 solo necesita: (a) un punto donde asignar `bundle.ast_links`, (b) `bundle.team["ast"]`.
  Si T-05 los nombra distinto, se usa el suyo.
- **Desviaciones respecto de la arquitectura:** (1) `ast_points` y el campo `StatBundle.ast_links` no están en §3.5/§4
  (PROPUESTA, aditivos); (2) `assists.py` no está en §4 (PROPUESTA; se evita sobrecargar `lineups.py` y se deja a A-07
  reutilizar el vínculo); (3) la columna `previous_action` se agrega acá y no en F-11 (diferida por decisión humana).
- **Incrementos diferidos.** `player_poss_duration` (→ A-01): tarea final marcada "(diferido)" en `tasks.md`; A-07 y A-08
  reutilizan `assists.game_assist_links` o lo reemplazan por su cadena de posesiones.

**Dependencias técnicas**
- C-01 ([../../fase-1-confiabilidad/09-C-01-rebotes-distribucion-jugador/plan.md](../../fase-1-confiabilidad/09-C-01-rebotes-distribucion-jugador/plan.md)): `as_pos`, card "Rebotes y distribución" (de la que se mueve AS/pos).
- T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)): `StatBundle`, `compute_standard`, `apply_base`, `metrics_catalog` (`MetricDef`, `GROUPS`, loader `player`).
- T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)): `population`, `attach_fichas`, `metricCard`, `GET /api/rankings`.
- T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)): `sample_level`, `sampleBadge`.
- F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md), implementada acotada): `ingest.persist_game`/`reprocess_games`/`INGEST_VERSION`/`game_sources`, `data_quality.NULL_FIELDS`.
- C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)): `PlayerGameStats.player_id`, `identity.canonical_id`.
- C-11 ([../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/plan.md](../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/plan.md)): `nullDisplay`, `NULL_REASON_LABELS`, `played`.
- X-01 ([../01-X-01-reorganizacion-navegacion/plan.md](../01-X-01-reorganizacion-navegacion/plan.md)): `views/jugador.js`, pestaña `distribucion`.
- T-03 ([../02-T-03-selector-global-contexto/plan.md](../02-T-03-selector-global-contexto/plan.md)) y T-04 ([../03-T-04-base-normalizacion/plan.md](../03-T-04-base-normalizacion/plan.md)): contexto y base.
- Posterior: A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md)) completa `player_poss_duration`.

**Estimación: M · 5–8 h** (columna + parser + ingesta + calidad 1 h; `assists.py` y fórmulas 2–3 h; catálogo y loader 1 h;
card y tab 1–2 h; reproceso, verificación y docs 1–1,5 h).
