# Plan — T-03: Selector global de contexto (splits)

> **ID:** T-03 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 02
> **Depende de:** [X-01](../01-X-01-reorganizacion-navegacion/plan.md) · [F-11](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md) · [T-01](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md) · [T-02](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md) (y, por el módulo base, [C-02](../../fase-1-confiabilidad/11-C-02-promedios-de-liga/plan.md) y [C-08](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md))
> **Habilita:** T-04, F-19, F-04, F-18, A-06, dimensiones de A-02…A-05
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Arquitectura §2.1, §3.1, §3.6, §3.7, §3.8, §3.13, §6, §7.5, §7.8, §8, §9.2 (I-02, I-07, I-08)
> **Estimación:** XL · 26–34 h

## 1. Enfoque

C-02 deja creado `backend/context.py` con `Context{competition_id, competition_all, last}` y `parse_context`/`filter_games`
mínimos, y `population.py` con el camino `apply_thresholds=False`. T-03 es dueño del contrato completo: **extiende**
`Context` con los 11 campos restantes (§3.8), reescribe `parse_context` para parsearlos y validarlos, agrega
`event_predicate`/`possession_predicate`/`register_dimension`/`context_echo` completo, y crea el endpoint
`GET /api/context/options`. En el backend, cada handler que hoy recibe `competition`/`last` sueltos pasa a recibir un
`Context` completo; el cálculo se bifurca por `level(ctx)`: `partido` sigue usando `repository.competition_games` +
box; `evento` agrega sobre `pbp_events` con un predicado por evento (marcador corrido, cuarto, jugadores en cancha vía
`lineups.build_segments`). En el frontend, `core/context.js` (estado en la URL) y `components/context-bar.js`
(controles) son nuevos; se montan en las vistas de S2/S3/S4/S6/S7 ya reorganizadas por X-01. El tipo de entidad `split`
se registra en `metrics_catalog` para que `GET /api/metrics/split` devuelva el conjunto estándar de T-05 sobre una
selección con contexto.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/context.py` | module (mod., creado por C-02) | `Context` completo (11 campos nuevos), `parse_context` (validación de los 11 parámetros), `context_key`, `level`, `population_mode`, `filter_games` (rest/venue/opponent), `event_predicate` (quarter/score/on/off), `possession_predicate` (stub que siempre excluye hasta A-01), `context_echo` completo (§7.5), `register_dimension`, `available_dimensions(comp_id)` | RF-2…RF-17 |
| `backend/repository.py` | module (F-11, consumido) | usar `competition_games`/`team_pbp_games` ya existentes; sin cambios de firma | RF-4 |
| `backend/rest.py` (PROPUESTA, ver §10) | module **NUEVO** | `days_rest(team_code: str, game_date: str, comp_id_scope: None) -> int \| None` (días de descanso sobre **todos** los partidos importados del equipo, cualquier competencia) | RF-6 |
| `backend/app.py` | route | `GET /api/context/options` (fino, delega en `context.available_dimensions`); todos los handlers "Ctx" de fase 2 (`/api/team`, `/api/player`, `/api/league`, `/api/rankings/...`, `/api/shots/...`, `/api/shot-zones`) pasan a leer `Context` completo en vez de `competition`/`last` sueltos | RF-1, RF-4, RF-15, RF-16 |
| `backend/population.py` | module (C-02, extendido por T-01; T-03 solo agrega el parámetro `ctx` completo donde faltaba) | `population(...)` ya recibe `Context`; T-03 verifica que el contexto completo (no solo `competition`/`last`) llegue a cada llamada | RF-10 |
| `backend/sample.py` | module (T-02, consumido) | `sample_level(entity_type="split", ...)` ya cubre `split` (umbral `sample.split.*`, K `regression.split.k`); T-03 solo lo invoca | RF-11 |
| `backend/metrics_catalog.py` | module (T-05, extendido) | `register_entity("split", loader=_split_loader)` donde `_split_loader(EntityRequest) -> list[StatBundle]` agrega los conteos de la selección (partido o evento) en un único `StatBundle` | RF-1 (conjunto estándar bajo contexto) |
| `backend/config.py` | module (F-13, extendido) | agrega `context.close_margin` a `CONFIG_SPEC` (ya listada en arquitectura §3.2, dueño T-03) | RF-7 |
| `backend/auth.py` / `backend/prefs.py` | module (consumidos) | lectura de `user_prefs` scope `ui` key `last_competition` (F-13) | RF-20 |
| `frontend/js/core/context.js` | js-core **NUEVO** | `getContext()`, `setContext(patch)`, `clearContext()`, `contextToQuery(ctx)`, `contextFromQuery(query)`, `onContextChange(fn)` | RF-1, RF-3, RF-12 |
| `frontend/js/components/context-bar.js` | js-component **NUEVO** | `renderContextBar(el, {options, context, onChange})` | RF-1, RF-2, RF-19 |
| `frontend/js/api.js` | js-api | `api.contextOptions(params)`, `qs()` ya existe (T-05); todo método que llame endpoints "Ctx" agrega los 11 parámetros vía `qs(contextToQuery(ctx))` | RF-12, RF-15 |
| `frontend/js/views/equipo.js` · `jugador.js` · `liga.js` · `comparar.js` · `explorar.js` (X-01) | js-view | montar `renderContextBar` antes del contenido; recalcular al `onContextChange` | RF-1 |
| `frontend/js/core/router.js` (X-01) | js-core (consumido) | conservar `query` entre pestañas/secciones salvo `on`/`off` (ya lo hace X-01 T-B3); T-03 verifica que cubra los 11 parámetros | RF-1 |
| `frontend/css/style.css` | css | sección `/* ── context-bar (T-03) ── */` (barra pegajosa, chips, panel plegable en móvil) | RF-19, CA-16 |
| `frontend/sw.js` | sw | agregar `context.js`, `context-bar.js` a estáticos (o confiar en runtime caching de X-01) | §9 |
| `docs/api.md` | doc | `GET /api/context/options`, parámetros de contexto en cada endpoint tocado, eco `context` completo | cierre |
| `docs/database.md` | doc | sin cambios de esquema (nota explícita) | cierre |
| `docs/frontend.md` | doc | barra de contexto, `core/context.js`, copy nuevo | cierre |
| `docs/metrics.md` | doc | nota: "split de contexto" como entidad del catálogo, con el mismo conjunto estándar | cierre |

**Matriz RF → archivo:** RF-1 → `context-bar.js`, vistas, `router.js`; RF-2 → `context.py` (`parse_context`), `context-bar.js`;
RF-3 → `context.py` (predicados AND/OR de `quarter`); RF-4 → `context.py` (`level`), `app.py` (bifurcación box/pbp); RF-5 →
`context.py` (`filter_games`, orden de aplicación); RF-6 → `rest.py`, `context.py`; RF-7 → `context.py`
(`event_predicate` de `score`), `config.py`; RF-8 → `context.py` (`event_predicate` de `quarter`, usa `period_type`); RF-9 →
`context.py` (`event_predicate` de `on`/`off`, usa `lineups.build_segments`), `population.py` (`population_mode`); RF-10 →
`population.py`, `context.py` (`context_echo.label`); RF-11 → `sample.py` (ya cubre split), `context.py`; RF-12 →
`core/context.js`, `app.py` (query params); RF-13 → `context.py` (`context_echo`); RF-14 → `context.py` (`Context` con
campos de posesión que `parse_context` acepta y `filter_games`/`event_predicate` ignoran, informados en `ignored`); RF-15 →
`app.py` (`/api/context/options`), `context.py` (`available_dimensions`); RF-16 → `app.py` (cada handler agrega/ignora
contexto según la tabla del spec); RF-17 → `context.py` (`ContextError` → 400); RF-18 → `stats_engine.py` (sin cambio,
ya pooled y con nulos); RF-19 → `context-bar.js`; RF-20 → `prefs.py`, `context.py` (resolución de competencia con
`ui.last_competition`).

## 3. Backend — rutas y modelos

Sin cambios de esquema (Arquitectura §5: T-03 no está en la lista de tablas/columnas nuevas). Única clave de
configuración nueva (ya prevista en arquitectura §3.2, tabla `app_config`, sin migración de esquema porque `app_config`
la crea F-13):

| Clave | Tipo | Default | Rango | Sección | Vía |
|---|---|---|---|---|---|
| `context.close_margin` | int (pts) | 10 | 1–40 | Reglas de contexto | fila existente de `CONFIG_SPEC` (F-13 crea la tabla; T-03 agrega la fila) |

### `GET /api/context/options` — NUEVO (`login_required`)
- Query: `competition` (id o `all`), `team` (opcional, acota `players` al plantel del equipo).
- Response 200:
```json
{
  "competitions": [{"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}],
  "teams": [{"code": "CNF", "name": "Nacional"}],
  "players": [{"player_id": 128, "name": "A. Varela"}],
  "dimensions": [
    {"name": "venue", "level": "partido", "values": ["local", "visitante"], "available": true},
    {"name": "opponent", "level": "partido", "values": ["CNF", "PEN", "…"], "available": true},
    {"name": "rest", "level": "partido", "values": ["0", "1", "2", "3mas"], "available": true},
    {"name": "quarter", "level": "evento", "values": ["1", "2", "3", "4", "pr"], "available": true},
    {"name": "score", "level": "evento", "values": ["ajustado", "paliza"], "available": true},
    {"name": "on", "level": "evento", "values": null, "available": true},
    {"name": "off", "level": "evento", "values": null, "available": true},
    {"name": "clock", "level": "posesion", "values": ["temprano", "medio", "tardio"], "available": false},
    {"name": "clock_start", "level": "posesion", "values": ["24", "14"], "available": false},
    {"name": "origin", "level": "posesion", "values": null, "available": false},
    {"name": "ptype", "level": "posesion", "values": ["transicion", "early", "media_cancha"], "available": false},
    {"name": "chance", "level": "posesion", "values": ["primera", "segunda"], "available": false}
  ]
}
```
- `available = false` para las 5 dimensiones de posesión hasta que A-01…A-05 las habiliten (`register_dimension` las
  reemplaza; hasta entonces `context.py` las declara "no disponibles" con una tabla fija, sin importar de un módulo
  que no existe todavía).
- Errores: 400 `competencia_inexistente` si `competition` no resuelve.

### Endpoints existentes que pasan a aceptar contexto completo (Ctx, RF-16)
Todos ya existen (arquitectura §6); T-03 no cambia su ruta ni su shape base, solo el parseo de query y el eco `context`:

| Endpoint | Antes (C-02) | Con T-03 |
|---|---|---|
| `GET /api/team/<team_code>` | `competition`, `last` | + `venue, opponent, rest, quarter, score, on, off` (evento agrega desde pbp con `event_predicate`) |
| `GET /api/player/<team_code>/<player_name>` · `GET /api/player/<int:player_id>` (C-08) | ídem | ídem |
| `GET /api/league` | `competition` | + `last` (ya de C-02); resto de nivel partido; nivel evento no aplica a la tabla (informado `ignored` con `no_aplica`) |
| `GET /api/rankings/<entity_type>/<metric_key>` (T-01) | `competition`, `last` | contexto completo (población recalculada con el mismo contexto, arquitectura §3.6) |
| `GET /api/shots/<team_code>[/<player_name>]` · `GET /api/shot-zones` (C-03) | `competition`, `last` | + nivel evento (tiros filtrados por su evento pbp vía `action_number`) |
| `GET /api/metrics/<entity_type>` (T-05) | `competition`, `last` | contexto completo; `entity_type=split` nuevo |
| `GET /api/lineup/<team_code>` · `GET /api/onoff/<team_code>/<player_name>` · `GET /api/clutch/<team_code>` | `competition` (si aplica) | **sin cambio en fase 2** (RF-16: nivel evento no aplica hasta F-06/F-04; `ignored` con `no_aplica` para cualquier parámetro de evento recibido) |

### Ampliación de `context.py` (dueño T-03; base de C-02)
```python
@dataclass(frozen=True)
class Context:
    competition_id: int | None
    competition_all: bool
    last: int | None
    venue: str | None = None                      # "local" | "visitante"
    opponent: str | None = None                    # team_code
    rest: str | None = None                        # "0" | "1" | "2" | "3mas"
    quarters: tuple[str, ...] | None = None         # subset de {"1","2","3","4","pr"}
    score: str | None = None                        # "ajustado" | "paliza"
    on: tuple[int, ...] | None = None                # player_id
    off: tuple[int, ...] | None = None
    clock: tuple[str, ...] | None = None             # sin efecto hasta A-05
    clock_start: str | None = None                   # sin efecto hasta A-05
    origin: tuple[str, ...] | None = None            # sin efecto hasta A-02
    ptype: tuple[str, ...] | None = None              # sin efecto hasta A-03
    chance: str | None = None                         # sin efecto hasta A-04

def parse_context(args, *, team_code=None, player_id=None) -> Context: ...
def context_key(ctx: Context) -> tuple: ...           # tupla hasheable para cache.memo
def level(ctx: Context) -> str: ...                   # "posesion" > "evento" > "partido" (el más fino presente)
def population_mode(ctx: Context) -> str: ...         # "entity_only" si on/off; si no, "apply_all"
def filter_games(games: list[dict], ctx: Context, team_code: str) -> list[dict]: ...
def event_predicate(ctx: Context, team_code: str) -> Callable[[dict, dict], bool] | None: ...
def possession_predicate(ctx: Context) -> Callable[[object], bool] | None: ...   # devuelve None hasta A-01 (stub)
def context_echo(ctx, *, games_used, games_total, games_excluded, ignored) -> dict: ...
def register_dimension(name, *, level, values, parser) -> None: ...
def available_dimensions(comp_id: int | None) -> list[dict]: ...
```

## 4. Backend — lógica

| Función | Módulo | Entradas | Algoritmo | RF |
|---|---|---|---|---|
| `parse_context` | `context.py` | `request.args`, `team_code`/`player_id` opcionales | 1) `competition` → `repository.resolve_competition(args.get("competition"), team_code=…, player_id=…)` (§3.1; incluye DA-14 y `ui.last_competition` si `team_code`/`player_id` no dan una más reciente — RF-20). 2) `last` → int > 0 o `None`; `int()` que falla → 400. 3) `venue` → debe ∈ {local, visitante} o 400 `contexto_invalido` "Valor inválido para 'venue': '<v>'.". 4) `opponent` → debe ser un `team_code` de la competencia resuelta o 400. 5) `rest` → ∈ {0,1,2,3mas}. 6) `quarter` → CSV, cada valor ∈ {1,2,3,4,pr}, se guarda como tupla ordenada. 7) `score` → ∈ {ajustado, paliza}. 8) `on`/`off` → CSV de enteros; cada `player_id` debe pertenecer al `team_code` (si se da) o 400 "El jugador {id} no pertenece a {equipo}."; si ambos jugadores están en `on` y `off` simultáneamente → 400. 9) `clock`/`clock_start`/`origin`/`ptype`/`chance` → se parsean con la misma validación de forma pero **no** se usan (nivel posesión aún no disponible); si llegan valores fuera de la lista fija → 400 igual (evita URLs corruptas silenciosas). | RF-2, RF-17 |
| `level` | `context.py` | `ctx` | `"posesion"` si algún campo de posesión no es `None` (aun sin efecto, para que `possession_predicate` decida); si no, `"evento"` si `quarters`/`score`/`on`/`off` no son `None`; si no, `"partido"`. | RF-4 |
| `filter_games` | `context.py` | `games: list[dict]` (de `repository.competition_games`), `ctx`, `team_code` | 1) filtra por `competition_id` (ya resuelto). 2) `venue`: `home_code == team_code` si `local`, `away_code == team_code` si `visitante`. 3) `opponent`: el otro código == `opponent`. 4) `rest`: `days_rest(team_code, g["date"])` ∈ bucket pedido; partidos sin fecha o primer partido del equipo → excluidos, contados en `games_excluded["sin_partido_previo"]` (o `sin_fecha` si falta `date`). 5) `last`: ordena por fecha desc y toma los primeros `last` **después** de los filtros anteriores (RF-5); sin fecha → al final, no cuentan para "últimos N" si `last` está activo. | RF-5, RF-6 |
| `days_rest` | `rest.py` (NUEVO) | `team_code`, `game_date` | Consulta `repository` (memoizada) para los partidos del equipo en **todas** las competencias ordenados por fecha; ubica el partido de `game_date` y el inmediato anterior con fecha válida; `dias = (fecha_actual - fecha_anterior).days - 1`; `None` si no hay anterior o si alguna fecha falta; bucket: `0` si `dias==0`, `1` si `==1`, `2` si `==2`, `3mas` si `>=3`. Cacheada por `(team_code, data_version)` vía `cache.memo("rest", ...)`. | RF-6 |
| `event_predicate` | `context.py` | `ctx`, `team_code` | Devuelve `None` si no hay filtros de evento activos (evita costo). Si no, arma un predicado `(evento: dict, estado: dict) -> bool` que evalúa, en este orden: **cuarto** — `estado["period_bucket"]` (calculado antes por evento: `"pr"` si `period_type == "OVERTIME"`, si no `str(period)`) ∈ `ctx.quarters`; **marcador** — `estado["margin_before"]` (ver abajo) ≤ `close_margin` para `ajustado`, > para `paliza`; **on/off** — `estado["on_court"]` (set de `player_id` del equipo, calculado por `lineups.build_segments`) contiene todos los de `ctx.on` y ninguno de `ctx.off`. Los tres se combinan con AND; dentro de `quarters` el CSV se combina con OR (ya resuelto como pertenencia a la tupla). | RF-3, RF-7, RF-8, RF-9 |
| — cálculo del estado por evento (helper interno `_event_states(game_id, team_code)`) | `context.py` | `pbp_events` del partido (vía `repository.game_events`) | Recorre eventos en orden (`action_number`); mantiene marcador corrido con `s1`/`s2` (arquitectura: "marcador antes del evento" → se lee el `s1`/`s2` de row **anterior** al evento actual, o 0-0 al inicio); mantiene `period_bucket` del evento; llama a `lineups.build_segments(events, team_code, starters)` una vez por partido y asigna a cada evento el `on_court` del tramo vigente (por `action_number`). Devuelve `[{action_number, margin_before, period_bucket, on_court}]`. Partidos sin `pbp_events` → lista vacía, contados en `games_excluded["sin_pbp"]`. | RF-4, RF-7, RF-8, RF-9 |
| `possession_predicate` | `context.py` | `ctx` | Devuelve `None` siempre en fase 2 (`clock`/`origin`/`ptype`/`chance` no tienen efecto); A-01 lo reemplaza cuando exista `possessions.py`. | RF-14 |
| `population_mode` | `context.py` | `ctx` | `"entity_only"` si `ctx.on` o `ctx.off` no son `None`; si no, `"apply_all"`. | RF-9 |
| `context_echo` | `context.py` | `ctx`, `games_used`, `games_total`, `games_excluded: dict[str,int]`, `ignored: list[dict]` | Arma el shape §7.5: `competition` (id+label desde `repository`), `applied` (dict solo con los campos no-default de `ctx`, con `quarter`/`on`/`off` como CSV), `ignored`, `level(ctx)`, `population_mode(ctx)`, `games_used`, `games_total`, `games_excluded`, `label` (join " · " de: período si `last`, sede si `venue`, "vs {rival}" si `opponent`, cuartos si `quarters` ["4.º cuarto" / "1.º y 2.º cuarto" / …], "Ajustado"/"Paliza" si `score`, "Con {nombre}"/"Sin {nombre}" si `on`/`off`, descanso si `rest`). | RF-13 |
| `register_dimension` / `available_dimensions` | `context.py` | — | Registro simple `dict[str, DimensionDef]`; `available_dimensions` arma la lista fija de 12 dimensiones (7 con `available=True` desde T-03, 5 con `available=False` hasta que A-02…A-05 llamen `register_dimension` y sobrescriban la entrada). | RF-15 |

**Manejo de nulos (C-11):** una selección con `games_used == 0` (todos los partidos filtrados fuera, o todos sin pbp con
filtro de evento) hace que **todas** las métricas de la entidad devuelvan `{"value": null, "reason": "sin_datos"}` —
nunca 0. Una tasa con denominador 0 dentro de la selección → `null` con su razón propia (`sin_intentos`, `sin_perdidas`).
**Caso borde división por cero:** `close_margin = 0` es válido (rango 1–40 en `CONFIG_SPEC`, así que en la práctica nunca
es 0; documentado igual). **Caché:** cada llamada a `context.filter_games`/`event_predicate` pasa por `repository`
(cacheado por competencia) y el resultado final de cada endpoint se memoiza con `cache.memo("ctx:<entity>", context_key(ctx) + (team_code,), fn)`.

## 5. Frontend — capa API (api.js)
- `api.contextOptions: (params) => apiFetch(`/api/context/options${qs(params)}`)`.
- Todo método existente que ya acepta `competition`/`last` (`api.team`, `api.player`, `api.league`, `api.shots`, …)
  cambia su firma interna para aceptar un objeto `ctx` completo y arma la query con `qs(contextToQuery(ctx))` (T-05 ya
  provee `qs()` que omite `null`/`undefined`/`""`).

## 6. Frontend — UI

**Ubicación (arquitectura §3.12, en fase 2 X-01 ya implementado):** la barra de contexto vive como franja persistente
debajo de la cabecera de sección, en S2 Liga, S3 Equipo, S4 Jugador, S6 Comparar (pestaña equipos/jugadores) y S7
Explorar. Componente compartido `components/context-bar.js`, montado una vez por vista con
`renderContextBar(el, {options, context, onChange})`.

**Componentes reutilizados (arquitectura §8):** `core/prefs.js` (F-13, para `ui.last_competition`), `core/i18n.js`
(`t()`), `core/format.js` (`fmtNumber` para el margen configurado en el chip "Ajustado (≤10)"), `components/tabs.js`
(X-01, sin relación directa pero conviven en la misma vista), `components/sample-badge.js` (T-02, para el badge de
split dentro de cada card).

**Controles de la barra** (desktop: fila horizontal con scroll si no entra; móvil <768 px: resumen "Filtros (n)" +
botón que abre un panel plegable a pantalla completa, arquitectura regla 7):
- Selects: Competencia, Período, Sede, Rival, Descanso.
- Multi-select (checkboxes): Cuarto.
- Radio/select: Marcador (Todos/Ajustado/Paliza).
- Buscador con chips: Con jugador / Sin jugador (autocompleta sobre `options.players`, máx. razonable sin límite duro).
- Botón "Limpiar filtros" (visible solo si `Object.keys(context.applied).length > 0`).

**Estados:** loading/vacío/error/offline/éxito según spec §6 (con controles deshabilitados durante la carga inicial de
`options`, y la barra mostrando de entrada los valores ya presentes en la URL sin esperar a `options` para no bloquear
el primer render — arma la lista de valores por defecto y la completa cuando `options` llega).

**Mobile 768 px:** el panel plegable ocupa una hoja (`position: fixed`, `inset: 0`, scroll interno) con "Aplicar" y
"Cancelar"; los chips resumen quedan en una sola línea con `overflow-x: hidden` y `text-overflow: ellipsis` en el
contador.

## 7. Navegación
No agrega secciones ni pestañas (arquitectura §3.12 ya fija las rutas de X-01). El estado de la barra se refleja en el
query string de la ruta hash activa (`#/<seccion>/<id>/<pestaña>?competition=…`), conservado por `core/router.js`
(X-01) entre pestañas y, salvo `on`/`off`, entre secciones (RF-1).

## 8. Contratos de datos
- `GET /api/context/options` → shape §3.
- `context` (eco) → shape arquitectura §7.5, con `label` armado según §4.
- `Context` (dataclass) → shape de código §3 (no es JSON; documentado para quien firme código en su plan).

## 9. Manejo de errores y offline
| Código | Mensaje |
|---|---|
| 400 `contexto_invalido` | "Valor inválido para '<param>': '<valor>'." / "El jugador {id} no pertenece a {equipo}." / "La competencia indicada no existe." (`competencia_inexistente`, reutilizado de C-02) |
| 401 | handler global existente |
| red/offline | la barra queda con los últimos valores conocidos (de la URL); cada bloque de la vista muestra "Sin conexión: no se pueden cargar los datos." (patrón de X-01) |
- `frontend/sw.js`: si X-01 ya migró a runtime caching, `context.js`/`context-bar.js` quedan cubiertos automáticamente;
  si no, se agregan a `STATIC[]` y sube `CACHE` (ambos casos verificados en tasks).

## 10. Riesgos / decisiones

- **PROPUESTA (no está en 00-arquitectura-transversal.md): módulo `backend/rest.py`.** La arquitectura no asigna un
  módulo para el cálculo de "días de descanso"; T-03 lo aloja en un módulo nuevo dedicado (regla 3: `app.py` no
  contiene lógica) en vez de meterlo en `context.py` para no mezclar el parser de contexto con una consulta a
  `repository`. Reportado en `huecos_arquitectura`.
- **PROPUESTA: razón de nulo `sin_partido_previo`.** No está en la lista fija de §7.4. Se usa solo para `games_excluded`
  del filtro `rest` (no para el `value`/`reason` de una métrica, que sigue usando los códigos fijados). Reportado.
- **Objeción (no bloquea, sigo la arquitectura):** el contrato de contexto define `on`/`off` como CSV de `player_id`,
  lo cual exige que el frontend resuelva nombre → id antes de armar la URL (ya disponible desde C-08). Se documenta
  para que quien construya `context-bar.js` no intente aceptar nombres crudos.
- **Desviación respecto a la arquitectura:** ninguna. `possession_predicate` se implementa como stub que siempre
  devuelve `None` (arquitectura §3.9 prevé exactamente este tratamiento vía I-02) en vez de omitir la función; así
  A-01 solo tiene que reemplazar el cuerpo, no crear la firma.
- **Riesgo de rendimiento:** `_event_states` recorre todo el pbp de cada partido filtrado; para un equipo con 30
  partidos y filtro de evento, son ~30 × 550 eventos. Se memoiza por `(game_id, data_version)` en el namespace
  `pop:<entity_type>` compartido con T-01, o un namespace propio `ctx:events` si el volumen lo justifica (a medir en
  progress.md; objetivo heredado de arquitectura §3.14: vista de equipo/jugador < 1,5 s en caliente).
- **Riesgo de alcance:** T-03 no construye `lineups.build_segments_both` (eso es A-01); para `on`/`off` alcanza con
  `build_segments` (un solo equipo) que ya existe. Verificado en `backend/lineups.py`.
- **Dependencias técnicas:** `backend/context.py` (mínimo de C-02, [../../fase-1-confiabilidad/11-C-02-promedios-de-liga/plan.md](../../fase-1-confiabilidad/11-C-02-promedios-de-liga/plan.md));
  `repository.resolve_competition`, `repository.competition_games`, `repository.game_events`, `cache.memo`
  (F-11, [../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md));
  `population.population/ficha`, `core/colors.js` (T-01, [../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md));
  `sample.sample_level` para `entity_type="split"` (T-02, [../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md));
  `metrics_catalog.register_entity`, `stats_engine.compute_standard` (T-05, [../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md));
  `identity.player_card`/`player_id` (C-08, [../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md));
  `core/router.js`, `views/*.js` (X-01, [../01-X-01-reorganizacion-navegacion/plan.md](../01-X-01-reorganizacion-navegacion/plan.md));
  `prefs.get_prefs`/`set_pref` scope `ui` key `last_competition` (F-13, [../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md), si su plan aún no está escrito se referencia igual por ruta fija).
- **Incremento diferido:** dimensiones de posesión — ver spec §8. En este plan, Grupo de tareas final "(diferido)".
- **Estimación:** XL · 26–34 h (backend `context.py` completo + `rest.py` 8–10 h, endpoint de opciones + bifurcación de
  handlers existentes 6–8 h, frontend `context.js` + `context-bar.js` + integración en 5 vistas 8–10 h, verificación y
  docs 4–6 h).
