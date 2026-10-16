# Plan — F-10: Buscador de quintetos y consultas guardadas

> **ID:** F-10 · **Prioridad:** P2 · **Fase y orden:** 5·04
> **Depende de:** T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)) · T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)) · F-06 ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)) · C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md))
> **Habilita:** — (completa la sección S7 Explorar)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §4 · F-10 · Arquitectura §3.3, §3.7, §3.8, §3.11, §3.12, §4, §5, §6, §7, §9
> **Estimación:** L · 10–16 h

## 1. Enfoque
Un módulo dedicado **`backend/lineup_search.py`** (NUEVO — PROPUESTA de nombre, capa estadística tipo DA-37) arma el **universo** de quintetos de una competencia (`lineups.all_lineups` de F-06 sobre cada equipo, el conjunto estándar de `stats_engine.compute_standard`, la regresión y la muestra de T-02) y le aplica los filtros del cliente en el **servidor**, en orden fijo y con desempate estable, de modo que la misma consulta devuelva siempre las mismas filas en el mismo orden. Se expone como la tabla T-06 `lineup_search` (`GET /api/table/lineup_search`), así la tabla, el orden, la paginación, los percentiles y la exportación CSV/XLSX/PNG/PDF salen de T-06 sin código propio. La persistencia es una tabla nueva `saved_queries` y el módulo `saved_queries.py` de la arquitectura: se guarda el **diccionario plano de parámetros** de la búsqueda (los mismos nombres de la query de la tabla), por lo que "reejecutar" es literalmente volver a pedir esa query. El frontend agrega a S7 Explorar las pestañas `quintetos` y `consultas` y el botón "Guardar búsqueda" del buscador de jugadores, que guarda y restaura sus filtros locales. Sin cambios de esquema fuera de `saved_queries` (tabla nueva por `create_all`); sin dependencias nuevas.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/lineup_search.py` | module (NUEVO, PROPUESTA de nombre) | `parse_search`, `universe`, `search`, `table_rows`, `payload_extras`, `describe_filters`, `SearchSpec` | RF-1…RF-9, RF-14, RF-16, RF-17 |
| `backend/saved_queries.py` | module (NUEVO, Arq. §4) | `list_queries(owner, kind=None)`, `save_query(owner, name, kind, params, *, overwrite=False)`, `delete_query(owner, query_id)`, `validate_params(kind, params)`, `is_stale(params)` | RF-10…RF-14 |
| `backend/database.py` | model | modelo `SavedQuery` (tabla `saved_queries`, `UNIQUE(owner, name)`) creado por `db.create_all()` | RF-10 |
| `backend/tables.py` | module (T-06, registrar y extender) | `register_table("lineup_search", …)` y soporte del gancho `payload_extras` y de `default_sort.low_sample_last` (PROPUESTAS de extensión, §10 D-3) | RF-6, RF-7, RF-9 |
| `backend/app.py` | route | `GET/POST /api/saved-queries`, `DELETE /api/saved-queries/<int:query_id>` (finas, `login_required`); `import lineup_search, saved_queries` | RF-10…RF-14 |
| `backend/prefs.py` | module (F-13, consumido) | `current_owner()` — sin cambios | RF-10 |
| `frontend/js/api.js` | js-api | `api.savedQueries(kind)`, `api.saveQuery(body)`, `api.deleteQuery(id)`; `api.table("lineup_search", params)` ya existe (T-06) | RF-6, RF-10…RF-12 |
| `frontend/js/components/lineup-search.js` | js-component (NUEVO, PROPUESTA) | `renderLineupSearch(el, {competition, players, initial, onSaved})`: formulario, selector de jugadores, tabla T-06, guardar | RF-1…RF-9, RF-15 |
| `frontend/js/components/saved-queries.js` | js-component (NUEVO, PROPUESTA) | `renderSavedQueries(el, {onRun})`: lista, ejecutar, eliminar; `saveQueryDialog({kind, params, onSaved})` | RF-10…RF-14 |
| `frontend/js/views/explorar.js` | js-view (X-01) | registrar las pestañas `quintetos` y `consultas`; en `jugadores`, botón "Guardar búsqueda" y restauración de filtros | RF-1, RF-10, RF-12, RF-15 |
| `frontend/css/style.css` | css | sección `/* ── lineup-search (F-10) ── */` (formulario, chips de jugadores, lista de consultas, mobile) | RF-2, RF-12 |
| `frontend/sw.js` | sw | sumar `js/components/lineup-search.js` y `js/components/saved-queries.js` a `STATIC` y subir `CACHE` solo si X-01 aún no pasó a runtime caching | — |
| `docs/api.md` | docs | `GET/POST/DELETE /api/saved-queries`, tabla `lineup_search` y sus parámetros | cierre |
| `docs/database.md` | docs | tabla `saved_queries` | cierre |
| `docs/frontend.md` | docs | pestañas Quintetos y Consultas de Explorar, copy nuevo, "Guardar búsqueda" del buscador de jugadores | cierre |
| `docs/architecture.md` | docs | módulos `lineup_search.py` y `saved_queries.py` | cierre |

Matriz RF → archivo: RF-1/RF-2/RF-3/RF-4/RF-5 `lineup_search.py` (`parse_search`, `search`), `lineup-search.js`; RF-6 `lineup_search.py` (`table_rows`), `tables.py`, `lineup-search.js`; RF-7 `lineup_search.py`, `tables.py`; RF-8 `tables.py` (T-06 consumido) + `lineup_search.py` (no filtra la población); RF-9 `tables.py` (`payload_extras`), `lineup_search.py` (`describe_filters`), T-06 (exportadores); RF-10 `saved_queries.py`, `database.py`, `app.py`, `saved-queries.js`; RF-11 `saved_queries.py` (`validate_params`), `lineup-search.js` (materializa defaults); RF-12 `saved-queries.js`, `explorar.js`; RF-13 `saved_queries.py` (`is_stale`), `saved-queries.js`; RF-14 `lineup_search.py`, `saved-queries.js`; RF-15 `lineup-search.js`, `explorar.js`; RF-16 `lineup_search.py`; RF-17 `lineup_search.py`.

## 3. Backend — rutas y modelos

### 3.1 Tabla `saved_queries` — NUEVA (Arq. §5; vía `db.create_all()`, sin `upgrade_db()`)
| Columna | Tipo | Default | Notas |
|---|---|---|---|
| `id` | INTEGER PK autoincremental | — | |
| `owner` | TEXT NOT NULL | — | `prefs.current_owner()`: usuario de la sesión o `"_open"` en modo abierto (no es tabla de usuarios, DA-17) |
| `name` | TEXT NOT NULL | — | 1–80 caracteres, sin espacios sobrantes |
| `kind` | TEXT NOT NULL | — | `quintetos` \| `jugadores` |
| `params` | TEXT NOT NULL | `'{}'` | JSON de un objeto plano `{clave: valor-string}` (≤ 4 KB) |
| `created_at` · `updated_at` | TEXT | ISO 8601 | |
Restricción: `UNIQUE(owner, name)`. No toca ninguna restricción existente (Constitución 5).

### 3.2 `GET /api/table/lineup_search` — NUEVO (id fijado en Arq. §6; parámetros PROPUESTA)
- Auth `login_required`. Contexto T-03 vía `context.parse_context` (en fase 5: todos los de §3.8). `base` ∈ `total|partido|por40|por100` (default `ui.default_base`, T-04).
- Parámetros propios (todos strings; **PROPUESTA**, no están en la arquitectura):
| Parámetro | Valores | Default | Notas |
|---|---|---|---|
| `competition` | id entero | resolución §3.1 | `all` → 400 "Elegí una competencia." |
| `team` | `team_code` | todos | |
| `include` | CSV de `player_id` | — | el quinteto contiene a **todos** |
| `exclude` | CSV de `player_id` | — | no contiene a **ninguno**; ids repetidos en `include` y `exclude` → 400 |
| `min_poss` | número ≥ 0 | omitido = regla T-02 (`ranked`) | con número: `possessions ≥ min_poss` incluso muestra baja; `0` = todos |
| `min.<métrica>` · `max.<métrica>` | número (porcentajes como fracción: `0.55`) | — | `<métrica>` ∈ claves del catálogo T-05 con `lineup` en `entities` |
| `adjusted` | `1` \| `0` | `1` | aplica a `oer`, `der`, `net_rating` |
- Respuesta 200: payload §7.6 de T-06 con `entity_type: "lineup"`, `row_kind: "entity"`, más dos extensiones (§10 D-3):
```json
{
  "table_id": "lineup_search", "title": "Buscador de quintetos — Liga Uruguaya de Básquetbol 2025/2026",
  "entity_type": "lineup", "row_kind": "entity",
  "columns": [
    {"key": "_name", "label": "Quinteto", "type": "text", "sticky": true, "default_visible": true},
    {"key": "_team", "label": "Eq", "type": "text", "default_visible": true},
    {"key": "_sample", "label": "Muestra", "type": "badge", "default_visible": true},
    {"key": "possessions", "type": "metric", "default_visible": true},
    {"key": "net_rating", "type": "metric", "default_visible": true},
    {"key": "oer", "type": "metric", "default_visible": true},
    {"key": "der", "type": "metric", "default_visible": true},
    {"key": "efg_pct", "type": "metric", "default_visible": true}
  ],
  "rows": [
    {"id": "CNF:12-15-18-21-30", "link": "#/equipo/CNF/quintetos?lineup=CNF:12-15-18-21-30",
     "values": ["Prieto · Oglivie · Feldeine · Canty · Rodríguez", "CNF", null, 64.2, 0.121, 1.12, 1.0, 0.571],
     "pct": [null, null, null, null, 88, 80, 71, 79],
     "adj": {"net_rating": {"value": 0.09, "band": 0.18}, "oer": {"value": 1.1, "band": 0.12}, "der": {"value": 1.01, "band": 0.12}},
     "reasons": {}, "sample": {"level": "alta", "n": 64.2, "unit": "posesiones", "min": 15, "high": 40}}
  ],
  "totals": null,
  "competition_avg": {"label": "Promedio competencia", "values": ["Promedio competencia", null, null, 38.5, 0.0, 1.05, 1.05, 0.52], "reasons": {}},
  "default_sort": {"key": "net_rating", "dir": "desc", "use_adjusted": true, "low_sample_last": true},
  "row_count": 37,
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {"last": 5}, "ignored": [], "level": "partido",
              "population_mode": "apply_all", "games_used": 60, "games_total": 78, "games_excluded": {"sin_pbp": 0}, "label": "Últimos 5"},
  "base": "partido",
  "info": {"total_lineups": 412, "matched": 37,
           "excluded": {"jugadores": 301, "min_poss": 41, "rangos": 28, "nulos": 5},
           "effective_min_poss": {"rule": "t02", "value": null},
           "data_version": 128, "config_version": 4},
  "meta": {"title": "Buscador de quintetos", "section": "buscador-quintetos",
           "entity": {"type": "competition", "id": 3, "name": "Liga Uruguaya de Básquetbol 2025/2026"},
           "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026", "season": "2025/2026"},
           "filters": [{"label": "Período", "value": "Últimos 5"}, {"label": "Equipo", "value": "Nacional"},
                       {"label": "Incluye a", "value": "S. Canty, M. Prieto"}, {"label": "Mínimo de posesiones", "value": "30"},
                       {"label": "eFG% mín.", "value": "55,0 %"}, {"label": "Valor", "value": "Ajustado por muestra"}],
           "base": {"key": "partido", "label": "Por partido"}, "sort": null, "columns_visible": null,
           "generated_at": "2026-10-04T14:05:00-03:00", "generated_by": "nico", "app_version": "smart-basket-v14",
           "file_name": "buscador-quintetos_liga_liga-uruguaya-de-basquetbol-2025-2026_2026-10-04"}
}
```
  `info` y `meta.filters` (extensiones PROPUESTA de T-06): `info.excluded` cuenta cada quinteto una sola vez, en el primer filtro que lo excluye, en el orden jugadores → mínimo de posesiones → rangos (con `nulos` = excluidos porque una métrica filtrada es nula). `info.total_lineups` = universo antes de filtrar.
- Errores (§7.8): 400 `parametro_invalido` "Elegí una competencia." / "Un jugador no puede estar incluido y excluido a la vez." / "Métrica inválida: {clave}" / "Valor inválido para {parámetro}." / "El mínimo supera al máximo en {métrica}."; 400 `contexto_invalido` y `competencia_inexistente` (de `parse_context`); 404 `no_encontrado` "Jugador no encontrado: {id}" / "Equipo no encontrado: {code}"; `rows: []` con `row_count: 0` cuando nada cumple (no es error). Una competencia sin partidos con pbp devuelve `rows: []` y `info.total_lineups: 0`.

### 3.3 `GET /api/saved-queries` · `POST /api/saved-queries` · `DELETE /api/saved-queries/<int:query_id>` — NUEVOS (Arq. §6)
- `GET /api/saved-queries?kind=quintetos|jugadores` → 200 lista del usuario, orden `updated_at` desc, `id` desc:
```json
[{"id": 7, "name": "Cierres sólidos Nacional", "kind": "quintetos",
  "params": {"competition": "3", "team": "CNF", "include": "812", "min_poss": "30", "min.efg_pct": "0.55", "adjusted": "1", "last": "5", "ui.sort": "net_rating:desc",
             "_saved": {"data_version": 128, "config_version": 4}},
  "created_at": "2026-10-04T14:10:00-03:00", "updated_at": "2026-10-04T14:10:00-03:00", "stale": false}]
```
  `stale` (PROPUESTA) = `params._saved` difiere de `cache.get_versions()` actuales.
- `POST /api/saved-queries` body `{"name": "…", "kind": "quintetos", "params": {…}, "overwrite": false}` → 201 con la fila. El servidor **valida** (`validate_params`), descarta cualquier `_saved` enviado y escribe el suyo con las versiones actuales. `overwrite: true` (PROPUESTA) reemplaza `params` y `updated_at` de la consulta del mismo nombre.
- `DELETE /api/saved-queries/<int:query_id>` → 200 `{"deleted": 7}`.
- Errores (§7.8): 400 `parametro_invalido` "Poné un nombre a la consulta." / "El nombre no puede superar los 80 caracteres." / "Tipo de consulta inválido." / "La consulta tiene parámetros inválidos: {clave}." / "Llegaste al máximo de 100 consultas guardadas."; 409 `conflicto` "Ya tenés una consulta con ese nombre."; 404 `no_encontrado` "Consulta no encontrada." (inexistente **o de otro usuario**); 401 handler global.

### 3.4 Claves de `params` válidas por tipo (`validate_params`)
- `kind: "quintetos"`: `competition` (id entero), `team`, `include`, `exclude`, `min_poss`, `adjusted`, `min.<métrica>`/`max.<métrica>` (métrica ∈ catálogo T-05 con `lineup`), `base`, los parámetros de contexto de §3.8 (`last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, `clock`, `clock_start`, `origin`, `ptype`, `chance`), `ui.sort` (`<clave>:<asc|desc>`, solo vista; el cliente no lo envía a la tabla). Todos los valores son strings.
- `kind: "jugadores"`: `competition`, `name`, `team`, `position` (grupo `G|F|C`, DA-11), `min.<clave>`/`max.<clave>` (`^[a-z0-9_]{1,40}$`), `ui.sort`.
- Cualquier otra clave → 400. `_saved` es reservada del servidor.

## 4. Backend — lógica

### 4.1 `backend/lineup_search.py`
```
@dataclass(frozen=True)
SearchSpec: comp_id: int; team: str | None; include: tuple[int, ...]; exclude: tuple[int, ...]
            min_poss: float | None; ranges: dict[str, tuple[float | None, float | None]]; adjusted: bool

parse_search(args: Mapping[str, str], ctx: Context) -> SearchSpec            # ValueError → 400 parametro_invalido
universe(comp_id: int, ctx: Context) -> list[dict]                           # cacheado
search(spec: SearchSpec, ctx: Context) -> tuple[list[dict], dict]            # (filas ordenadas, info)
table_rows(req: TableRequest) -> list[TableRow]                              # builder T-06
payload_extras(req: TableRequest) -> dict                                    # {"info": {...}, "filters": [{label, value}]}
describe_filters(spec: SearchSpec, ctx: Context) -> list[dict]               # etiquetas legibles para meta.filters
```
**`parse_search`**: `comp_id = ctx.competition_id` (si `ctx.competition_all` o `None` → "Elegí una competencia."); `team` ∈ equipos de la competencia o 404; `include`/`exclude` → ids enteros, cada uno resuelto con `identity.canonical_id` (C-08; `None` → 404 "Jugador no encontrado: {id}"; fusionado → su canónico, RF-14), sin duplicados, intersección no vacía → 400; `min_poss`: `float ≥ 0` o `None`; cada `min.<k>`/`max.<k>`: `k` ∈ `metrics_catalog.METRICS` con `"lineup" in entities`, número finito (`math.isfinite`), `min ≤ max`; `adjusted = args.get("adjusted", "1") != "0"`.

**`universe(comp_id, ctx)`** (cacheado con `cache.memo("lineup_search:universe", (comp_id, context_key(ctx)), fn, max_entries=8)`; la clave ya incluye `data_version`/`config_version`, §3.14):
```
teams  = sorted({g["home_code"], g["away_code"] for g in repository.competition_games(comp_id)})
prior  = sample.league_prior(comp_id, ctx)                                   # T-02
rows = []
for team in teams:
    team_poss = sample.team_offensive_possessions(team, comp_id, ctx)       # T-02 (umbral relativo del quinteto)
    for b in lineups.all_lineups(team, comp_id, ctx, size=5):               # F-06; cacheado lineups:<team>
        values = stats_engine.compute_standard(b)                           # T-05 (conjunto estándar completo, pooled)
        values = sample.adjust_values(values, b, prior)                     # T-02: agrega adj en oer/der/net_rating
        badge  = sample.sample_for("lineup", [b], team_poss=team_poss)      # T-02: nivel, n, min, high, ranked
        rows.append({"id": b.entity_id, "team": team, "name": b.name, "players": frozenset(ids de b.entity_id),
                     "bundle": b, "values": values, "badge": badge,
                     "poss": values["possessions"]["value"]})
return sorted(rows, key=lambda r: r["id"])                                  # base determinista: orden por id
```
Los equipos sin pbp aportan 0 quintetos y se cuentan en `context.games_excluded` (RF-16). No se usan hilos ni estado global fuera de `cache.memo`.

**`search(spec, ctx)`**: sobre `universe(...)`, en este orden y contando la **primera** causa de exclusión:
```
for r in universe:
    if spec.team and r.team != spec.team:                       continue          # no cuenta como exclusión (alcance de la búsqueda)
    if not (set(spec.include) <= r.players) or (set(spec.exclude) & r.players):    excl["jugadores"] += 1; continue
    if spec.min_poss is None:
        if not sample.is_ranked(r.badge):                       excl["min_poss"] += 1; continue      # regla T-02 (RF-4)
    elif r.poss is None or r.poss < spec.min_poss:              excl["min_poss"] += 1; continue
    ok = True
    for key, (lo, hi) in spec.ranges.items():
        v = value_for(r, key, spec.adjusted)         # adjusted y key ∈ {oer, der, net_rating} → r.values[key]["adj"]["value"]; si no → r.values[key]["value"]
        if v is None:                                           excl["nulos"] += 1; ok = False; break   # un nulo no cumple un rango (RF-3)
        if (lo is not None and v < lo) or (hi is not None and v > hi): excl["rangos"] += 1; ok = False; break
    if ok: matched.append(r)
matched.sort(key=lambda r: (r.badge["level"] == "baja",                       # baja al final del orden por defecto (RF-4, RF-7)
                            -(adj_net(r) if adj_net(r) is not None else -inf),   # Net Rating ajustado desc; nulos al final
                            r.id))                                             # desempate estable por id (RF-7)
```
`value_for` compara el mismo valor que muestra la columna ajustada. Los porcentajes se comparan como fracción. `info = {total_lineups: len(universe filtrado por team), matched, excluded, effective_min_poss: {rule: "t02", value: None} o {rule: "usuario", value: min_poss}, data_version, config_version}`.

**`table_rows(req)`**: `spec = parse_search(req.params, req.ctx)`; `matched, _ = search(spec, req.ctx)`; devuelve `TableRow(id=r.id, link=f"#/equipo/{r.team}/quintetos?lineup={r.id}", texts={"_name": r.name, "_team": r.team}, bundle=r.bundle, extra={}, sample_n=r.badge, adj=<adj de net_rating/oer/der>)` en el orden de `search`. T-06 calcula `pct` con `population.population("lineup", comp_id, ctx)` (población **completa** de la competencia, no la filtrada: RF-8, CA-6) y arma columnas, promedio y meta. `register_table("lineup_search", entity_type="lineup", title="Buscador de quintetos — {competencia}", builder=table_rows, default_columns=[…], totals_mode="none", avg_mode="population", default_sort={"key": "net_rating", "dir": "desc", "use_adjusted": True, "low_sample_last": True}, payload_extras=payload_extras)`.

**Orden y estabilidad (RF-7)**: el payload sale en el orden de `search`; el cliente ordena siempre desde el orden del payload con `Array.prototype.sort` (estable), por lo que los empates conservan el desempate por id (§10 D-3 pide a `data-table.js` hacerlo explícito).

### 4.2 `backend/saved_queries.py` (Arq. §4)
```
list_queries(owner: str, kind: str | None = None) -> list[dict]
save_query(owner: str, name: str, kind: str, params: dict, *, overwrite: bool = False) -> dict   # SavedQueryError(400/409)
delete_query(owner: str, query_id: int) -> None                                                  # SavedQueryError(404)
validate_params(kind: str, params: dict) -> dict          # normaliza a {str: str}, rechaza claves desconocidas, tamaño ≤ 4 KB
is_stale(params: dict) -> bool                            # params["_saved"] != versiones actuales de cache.get_versions()
MAX_PER_OWNER = 100; MAX_NAME = 80                        # PROPUESTA (§9 del spec)
```
- `save_query`: recorta el nombre; valida; `owner` siempre de `prefs.current_owner()` en la ruta (nunca del body); si existe `(owner, name)`: sin `overwrite` → 409, con `overwrite` → `UPDATE params, updated_at`; si no, `count(owner) ≥ MAX_PER_OWNER` → 400; escribe `params._saved = {data_version, config_version}` (de `cache.get_versions()`); `commit` y devuelve la fila.
- `delete_query`: `DELETE WHERE id = :id AND owner = :owner`; 0 filas → 404 (una consulta ajena es indistinguible de una inexistente).
- Las consultas **no** suben `data_version` (no alteran cálculos).

### 4.3 Reejecución (RF-11, RF-13, RF-14)
Reejecutar = `GET /api/table/lineup_search?<params sin "_saved" ni "ui.*">`. Como la consulta guarda `competition` por id y todos los defaults materializados, el resultado depende solo de los datos y de la configuración: mismas filas, mismo orden, mismos valores. Si `competition` ya no existe → `parse_context` responde 400 `competencia_inexistente` y la UI muestra el aviso del spec §6. Jugadores fusionados → `identity.canonical_id` en `parse_search`. `stale` informa cambios de datos/configuración.

### Manejo de nulos (C-11)
Valores nulos de métrica en una fila → `values[k] = {value: null, reason}` (heredado de `compute_standard`); un nulo no cumple un rango y se cuenta en `info.excluded.nulos` (nunca se trata como 0). Quinteto sin posesiones → `poss: None`, queda fuera de `min_poss` explícito. Equipos sin pbp → fuera del universo, contados en el eco de contexto.

### Caché y rendimiento
`universe` memoizado por (competencia, contexto) y versionado (§3.14); `lineups:<team>` (F-06) lo comparte con la tabla `team_lineups`. En frío: una pasada por equipo (≈ lo que ya paga la población de quintetos de T-01/T-02); objetivo < 10 s para ~200 partidos y < 1,5 s en caliente (CA-18). Memoria: ~1.500 quintetos × conjunto estándar; LRU de 8 entradas.

## 5. Frontend — capa API (api.js)
- `api.savedQueries(kind)` → `GET /api/saved-queries${qs({kind})}`.
- `api.saveQuery({name, kind, params, overwrite})` → `POST /api/saved-queries` (JSON; el 409 llega como `Error` con `e.code === "conflicto"`, mecanismo de F-13 D-4).
- `api.deleteQuery(id)` → `DELETE /api/saved-queries/${id}`.
- Reutiliza `api.table("lineup_search", params)` (T-06), `api.searchPlayers()` (lista para el selector de jugadores) y `api.competitions()` (F-11).

## 6. Frontend — UI
- **Ubicación**: S7 Explorar → pestañas `quintetos` (`#/explorar/quintetos?…`) y `consultas` (`#/explorar/consultas`); en `jugadores` se agrega el botón "Guardar búsqueda". Orden de pestañas: Jugadores · Quintetos · Contextos (A-06) · Similares (A-09) · Consultas (X-01 registra el resto con `enabled`).
- **Componentes reutilizados** (Arq. §8): `data-table.js` (`createDataTable` con `lineup_search`), `export-menu.js`, `sample-badge.js`, `metric-card.js` no se usa (la ficha vive en S3), `core/format.js` (`fmtNumber`, `nullDisplay`, `PCT`), `core/catalog.js` (`groupsFor("lineup")`, `metricLabel`), `core/router.js` (`navigate`, `onRoute`, `registerTab`), `core/context.js` y `context-bar.js` (competencia y contexto), el modal `_formModal` existente (nombre de la consulta y confirmaciones), `esc()`. Sin `t()` (DA-21 resuelta: copy directo en español).
- **`components/lineup-search.js`** → `renderLineupSearch(el, {competition, initial})`:
  1. Barra: selector de competencia (de `api.competitions()`; sin "Todas") + selector de equipo (equipos de la competencia).
  2. Selectores de jugadores **Incluir** y **Excluir**: campo de texto con sugerencias desde `api.searchPlayers()` (nombre + equipo; filtradas por equipo si hay equipo elegido), chips con la ✕ para quitar; guardan `player_id`.
  3. Mínimo de posesiones (número; placeholder = mínimo efectivo de T-02 leído de `info.effective_min_poss`/`sample.lineup.min`; vacío = regla de T-02) y casilla "Valor ajustado por muestra" (marcada; aplica a OER, DER y Net).
  4. Rangos mín/máx para un conjunto base de métricas (`net_rating`, `oer`, `der`, `efg_pct`, `ts_pct`, `ppt`, `or_pct`, `dr_pct`, `to_pct`, `ast_to`, `pace`, `minutes`) con el mismo patrón `data-pct` del buscador de jugadores (porcentajes en %, enviados como fracción) y un selector "Agregar métrica" con el resto del catálogo del quinteto.
  5. Botones "Buscar", "Limpiar" y "Guardar búsqueda"; contador "N quintetos de M" desde `info`; aviso de exclusiones ("301 quintetos descartados por jugadores · 41 por muestra · 28 por rangos · 5 por dato nulo").
  6. Tabla `createDataTable` + `exportMenu` (CSV como acción principal; `getData` devuelve lo mostrado). Fila → `navigate("equipo", {id: team, tab: "quintetos", query: {lineup: id}})`.
  7. Estado ↔ URL: cada búsqueda hace `navigate("explorar", {tab: "quintetos", query: params, replace: true})` y al entrar con parámetros los restaura (RF-15).
- **`components/saved-queries.js`**: `renderSavedQueries(el, {onRun})` lista (nombre, tipo, resumen de filtros legible armado con los mismos rótulos de `describe_filters`, fecha, ícono de "datos cambiaron" si `stale`), "Ejecutar" → `navigate("explorar", {tab: kind, query: params})` con un banner si `stale`, "Eliminar" con confirmación; `saveQueryDialog({kind, params, onSaved})` pide el nombre, maneja 409 ("Reemplazar" reenvía con `overwrite: true`).
- **Buscador de jugadores (`jugadores`)**: el botón "Guardar búsqueda" serializa el estado de los filtros locales (`name`, `team`, `competition` (id), `position`, `min.*`/`max.*`, `ui.sort`) con `kind: "jugadores"`; al entrar con esos parámetros en la URL (desde Consultas), restaura los controles y aplica el filtro local (`rowFilter` de T-06). La lógica de filtrado no cambia.
- **Estados**: spinner "Cargando quintetos…"; vacío/errores/offline y modales con el copy del spec §6; filas de muestra baja en gris con badge y advertencia (T-02/T-06); el aviso `stale` es un banner no bloqueante.
- **Mobile 768 px**: formulario en una columna, rangos en un bloque plegable "Más filtros", tabla con `_name` fija, lista de consultas en tarjetas.

## 7. Navegación
Pestañas nuevas de S7: `quintetos` y `consultas` (slugs fijados en Arq. §3.12); `registerTab("explorar", {slug: "quintetos", label: "Quintetos", enabled: true, render: renderQuintetosSearch})` y `({slug: "consultas", label: "Consultas", enabled: true, render: renderConsultas})`. Rutas: `#/explorar/quintetos?competition=3&team=CNF&include=812&min_poss=30&min.efg_pct=0.55&last=5` y `#/explorar/consultas`. Los parámetros de contexto conservan los nombres de §3.8; `include`/`exclude`/`min_poss`/`min.*`/`max.*`/`adjusted` son parámetros de vista (no de contexto, no se propagan al cambiar de sección). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Tabla `lineup_search`: §7.6 más `info` y `meta.filters` (extensiones, §3.2). Fila de `saved_queries`: §3.3 (`id`, `name`, `kind`, `params`, `created_at`, `updated_at`, `stale`).
- `params` es un objeto plano de strings; las claves reservadas `_saved` (servidor) y `ui.*` (solo vista) nunca viajan a la tabla.
- Filas SQLAlchemy nuevas: `SavedQuery(id, owner, name, kind, params, created_at, updated_at)`.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `parametro_invalido` | "Elegí una competencia." / "Un jugador no puede estar incluido y excluido a la vez." / "Métrica inválida: {clave}" / "El mínimo supera al máximo en {métrica}." / "Poné un nombre a la consulta." / "El nombre no puede superar los 80 caracteres." / "La consulta tiene parámetros inválidos: {clave}." / "Llegaste al máximo de 100 consultas guardadas." |
| 400 | `competencia_inexistente` | "La competencia no existe." (la UI lo traduce al aviso de consulta) |
| 400 | `contexto_invalido` | mensaje de `parse_context` |
| 401 | — | handler global de `api.js` (login) |
| 404 | `no_encontrado` | "Jugador no encontrado: {id}" / "Equipo no encontrado: {code}" / "Consulta no encontrada." |
| 409 | `conflicto` | "Ya tenés una consulta con ese nombre." |
| 429 | — | "Demasiadas solicitudes. Esperá un momento." (existente) |
Offline: `/api/*` siempre a red; la vista muestra "Sin conexión: la búsqueda de quintetos necesita conexión." / "Sin conexión: las consultas necesitan conexión." Si X-01 no pasó a runtime caching, sumar los dos módulos nuevos a `STATIC` y subir `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **D-1 · Filtrado en el servidor (decisión).** El buscador de jugadores filtra en el cliente porque su universo (cientos de filas con pocas columnas) cabe en memoria; el de quintetos es más grande (≈ 1.500 filas con el conjunto estándar) y exige regresión, muestra y población del servidor. Filtrar en el servidor además permite verificar con `curl` el CA del cliente (misma query → mismo resultado) y exportar con los filtros en la cabecera. Alternativa descartada: bajar el universo completo y filtrar con `rowFilter` (payload grande, doble lógica de umbrales).
- **D-2 · La consulta guardada es la query, no un resultado.** Guardar solo parámetros hace que "mismo resultado sobre los mismos datos" dependa del determinismo del servidor (orden estable, sin dependencia de dicts ni de la hora). Alternativa descartada: instantánea del resultado (se desactualiza y duplica datos).
- **D-3 · Extensiones de T-06 (PROPUESTA, no están en 00-arquitectura-transversal.md).** (a) `register_table(..., payload_extras=fn)` que agrega `info` y completa `meta.filters` con los filtros de la búsqueda; (b) `default_sort.low_sample_last` (las filas de muestra baja van después en el orden por defecto); (c) `createDataTable` ordena siempre desde el orden del payload con sort estable. Son cambios chicos al contrato de tablas; se reportan en huecos. Sin (a), `info` iría en un endpoint aparte; sin (b), el orden por defecto no cumpliría RF-4.
- **D-4 · Funciones de T-02 usadas.** `league_prior`, `team_offensive_possessions`, `adjust_values`, `sample_for` e `is_ranked` son las funciones de T-02 (algunas PROPUESTA de T-02, [plan §4.1](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)); si T-02 las nombra distinto al implementarse, F-10 las sigue.
- **D-5 · Competencia explícita.** Una sola competencia por búsqueda: la población de percentiles es por competencia (T-01) y mezclar competencias confunde percentiles, ranking y regresión.
- **D-6 · `stale` por versiones globales.** Se compara contra `data_version`/`config_version` (cualquier cambio de datos, aunque sea de otra competencia, marca la consulta); es conservador y barato. Refinarlo por competencia no se justifica.
- **D-7 · Privacidad y permisos.** `owner` sale siempre de la sesión (`prefs.current_owner()`), nunca del body; las consultas de otros usuarios devuelven 404. No requiere `admin_required` (lectura y escritura de lo propio, `login_required`; igual criterio que `user_prefs`, DA-17).
- **D-8 · Tamaño del universo en frío.** Si `all_lineups` de 12 equipos supera el objetivo de 10 s en una temporada completa, se precalienta `lineups:<team>` en la primera visita de S3 → Quintetos (ya cacheado por F-06) y se mide en `progress.md`; no se persiste nada (regla 4).
- Desviaciones respecto de la arquitectura: ninguna de contrato; PROPUESTAS: módulo `lineup_search.py`, parámetros de `lineup_search`, `overwrite` y `stale` en saved-queries, claves `ui.sort`/`_saved` de `params`, y las extensiones de T-06 de D-3.
- **Dependencias técnicas:**
  - F-06 `lineups.all_lineups`, tabla `team_lineups`, ids de quinteto, `renderQuintetosTab` y deep link `?lineup=` ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)).
  - T-02 `sample.sample_for`, `adjust_values`, `league_prior`, `team_offensive_possessions`, `is_ranked` ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-06 `tables.register_table`, `TableRow`, `data-table.js`, `export-menu.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - T-05 `StatBundle`, `compute_standard`, `metrics_catalog.METRICS` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-01 `population.population("lineup", …)` y percentiles ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - C-08 `identity.canonical_id`, `player_id` en `search_players` ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)).
  - F-13 `prefs.current_owner`, `config.get` ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
  - F-11 `cache.memo`, `cache.get_versions`, `repository.competition_games` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - T-03 `context.parse_context`, `context_key` ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - X-01 S7 `views/explorar.js`, `registerTab` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: L · 10–16 h** (universo y filtros en el servidor 3 h, `saved_queries` y rutas 2 h, extensiones de T-06 y registro de tabla 1–2 h, frontend (formulario, selector de jugadores, consultas) 4–5 h, verificación y docs 2–3 h). Coincide con la arquitectura (L 8–14 h) más 2 h por las extensiones de T-06 y el guardado del buscador de jugadores.
