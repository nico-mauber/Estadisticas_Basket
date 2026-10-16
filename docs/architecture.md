# Arquitectura

## Visión general

Smart-Basket es un monolito full-stack: Flask sirve tanto la API REST como los archivos estáticos del frontend. Cuando hay credenciales configuradas (`AUTH_USERS`), toda la app queda detrás de un login con sesión por cookie (ver [auth.py](#authpy)).

```
┌─────────────────────────────────────────────────────────┐
│                     Render.com                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  gunicorn → Flask (backend/app.py)               │   │
│  │                                                  │   │
│  │   /api/*  ──→  routes Flask                      │   │
│  │   /*       ──→  frontend/index.html (static)     │   │
│  │                                                  │   │
│  │   auth.py          (login + sesión, env-gated)   │   │
│  │   fiba_fetcher.py  (descarga + parseo FIBA)      │   │
│  │   ingest.py        (persistencia + reproceso)    │   │
│  │   competitions.py  (competencias y temporadas)   │   │
│  │   data_quality.py  (panel de calidad)            │   │
│  │   identity.py      (fichas de jugador)           │   │
│  │   stats_engine.py  (métricas avanzadas)          │   │
│  │   clutch.py        (cierres, sobre pbp_events)   │   │
│  │   lineups.py       (quintetos: lineups + on/off)  │   │
│  │   config.py        (configuración global, F-13)   │   │
│  │   prefs.py         (preferencias usuario, F-13)   │   │
│  │   shot_zones.py    (zonas de tiro + percentil, C-03)│   │
│  │   tables.py        (tablas completas, T-06)       │   │
│  │   export_xlsx.py   (XLSX SpreadsheetML, T-06)     │   │
│  │   database.py      (SQLite vía /data/basketball.db)│  │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Persistent Disk 1GB  →  /data/basketball.db            │
└─────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS
         ▼
┌──────────────────────┐
│  Browser / PWA       │
│  frontend/js/app.js  │  SPA, 6 vistas + config (+ login)
│  frontend/sw.js      │  Service Worker (cache offline)
└──────────────────────┘
```

## Componentes backend

### `app.py`
Punto de entrada Flask. Registra todas las rutas `/api/*`. Llama a los otros módulos; no contiene lógica de negocio.

### `auth.py`
Autenticación, aislada de `app.py`. Credenciales en la variable de entorno `AUTH_USERS` (JSON `usuario→hash`); sin tabla de usuarios (sobrevive redeploys en dev y prod por igual). Provee:
- `load_users()` / `auth_enabled()` — parseo cacheado, fail-closed si el JSON es inválido.
- `verify(user, password)` — valida con `werkzeug.check_password_hash`.
- `login_required` — decorador que exige sesión; gatea todas las rutas de datos.
- `admin_required` / `is_admin()` — gate de las rutas que modifican datos (borrar, reasignar, editar competencias, reprocesar). Con `ADMIN_USERS` (lista separada por coma) solo esos usuarios; sin la variable, todo usuario autenticado; app abierta = todos (F-11, DA-18).
- rate-limit en memoria (5 fallos/IP/60s).

La sesión es una cookie firmada (`SECRET_KEY`), `HttpOnly` + `SameSite=Lax` + `Secure` en prod. Ver [api.md → Autenticación](api.md#autenticación).

### `fiba_fetcher.py`
Extrae datos de FIBA LiveStats.

Descarga y parseo están separados para poder reprocesar desde el JSON archivado sin red:
- `fetch_raw(url)` → `(raw, page_info)`: `data/{game_id}/data.json` por `urllib` (Playwright solo como respaldo, no existe en Render) + fecha y competencia scrapeadas de `bs.html` (no vienen en el `data.json`).
- `fetch_raw_by_id(game_id)` → `raw`: para reprocesar partidos importados antes de que existiera el archivo.
- `parse_game(raw, game_id, page_info)` → dict normalizado (`teams[]`, `players[]`, `shots[]`, `pbp[]`, `minutes`). Puro: no accede a la red.
- `fetch_game_data(url)` = `parse_game(*fetch_raw(url))`.

**Coordenadas de tiro:** FIBA sí las publica, en `tm[n].shot[]` (cancha completa, 0–100). Se unen al pbp por `actionNumber` y se guardan en `shots.court_x/court_y`; `x/y` (legado) quedan en 0 hasta que C-03 clasifique zonas con esta geometría. **Minutos:** 40 + 5 por prórroga (`periodType = "OVERTIME"`).

### `ingest.py`
Persistencia de partidos (F-11). `import_url(url)` descarga, guarda y archiva; `persist_game(game)` hace upsert de `games` (conserva la competencia asignada) y **reemplaza** sus filas hijas (equipos, jugadores, tiros, pbp), así reprocesar es idempotente y no deja filas huérfanas; `archive_raw` guarda el JSON crudo gzip en `game_sources`; `reprocess_games(ids)` re-ejecuta la ingesta desde el archivo (o desde FIBA si no hay archivo) y reporta fallidos sin cortar el lote. `INGEST_VERSION` marca con qué versión se guardó cada partido.

### `competitions.py`
Competencias y temporadas (F-11): el texto de FIBA se mapea a una competencia por alias; alta, edición, fusión, reasignación de partidos; `hidden_game_ids()` / `visible(query, model)` excluyen de toda lectura los partidos de competencias en borrador.

### `data_quality.py`
Informe de calidad de una competencia (F-11): partidos sin pbp, con datos básicos faltantes, pendientes de reproceso, pbp que no cuadra con el box, quintetos inconsistentes (usa `lineups`), sin coordenadas, campos nulos, posibles duplicados; `possession_gaps` (A-01) delega en `possessions.possession_gaps_check` para reportar posesiones incompletas y partidos con diferencia de conciliación mayor al 5 %.

### `possessions.py`
Reconstrucción de posesiones (A-01): máquina de estados sobre `pbp_events` que recorre cada partido en orden de `action_number` con reloj monótono por período. `game_possessions(game_id)` devuelve la lista cacheada (`cache.memo("poss:game", ...)`; nunca persistida). `team_possessions(team_code, comp_id)` filtra por equipo/competencia. `reconcile(scope)` concilia conteo reconstruido vs fórmula del glosario por partido o competencia. `possession_gaps_check(comp_id)` alimenta el check de calidad. `register_enricher(name, fn)` permite a A-02..A-05 inyectar atributos. `ppp_stats(comp_id)` calcula media y σ de PPP empírico. `build_segments_both` y `event_lineups` en `lineups.py` dan los quintetos de ambos equipos por tramo y por evento.

### `game_analysis.py`
Análisis completo de un partido (F-07): vista Analizar (S5). Carga datos del partido (game, team_game_stats, player_game_stats, shots, pbp_events) y calcula todo on-the-fly sin persistir. `TYPE_GROUPS` mapea 11 grupos en español sobre `action_type`. `period_partials(game_id, events, tgs_map)` calcula parciales derivados del pbp con ratings por período (fallback; la fuente oficial `period_pts` requiere F-11 v2). `score_timeline(game_id, events, ...)` arma la línea de tiempo con puntos, tiempos muertos, rachas (`game.run_min_points`), cambios de líder, empates y máxima ventaja. `game_pbp(game_id, events, ...)` filtra jugada a jugada por `player_id`, `types` (grupos) y `periods`. `game_shots(game_id, team_code, ...)` clasifica por zona (`shot_zones`), agrega badges de muestra y filtra por jugador/cuartos/banda/zona. `reconcile_game(...)` ejecuta 4 checks (score_final, players_sum, period_sum, timeline_final). `_game_player_bundles` y `_game_lineup_bundles` calculan StatBundle por jugador y por quinteto. `game_detail(game_id, base)` ensambla todo en un payload cacheado (`cache.memo("game", ...)`).

### `matchups.py`
Coincidencia en cancha (F-07): cruces entre quintetos/jugadores de un partido. `_game_segments` cachea los tramos de `lineups.build_segments_both`. `game_matchups(game_id, level, side)` soporta 3 niveles (`quinteto`, `jugador`, `jugador_quinteto`) con conteo de eventos, posesiones, badge y plus/minus. `team_matchups` es placeholder para F-03. `_register()` registra la entidad `matchup` en `metrics_catalog`.

### `identity.py`
Identidad de jugador (C-08): una ficha por jugador y equipo (`players`), clave `(equipo, nombre normalizado)`. `resolve_player_id` crea o encuentra la ficha; `assign_game(game_id)` la asocia a cada fila de un partido (la llama `ingest.persist_game`) y `backfill_player_ids()` completa el histórico al arrancar (idempotente). `aliases`/`name_index`/`canonicalize_pbp_games` permiten consultar por nombre en cualquier grafía sobre `shots` y `pbp_events`, que guardan el nombre crudo. `duplicate_candidates` alimenta el panel de calidad y `merge_players` es la fusión manual de un administrador. `norm_name`/`resolve_identity` (puras) siguen en `stats_engine.py`.

### `context.py`
Contexto de una petición de perfil (C-02): `Context` dataclass (`competition_id`, `competition_all`, `last`). `parse_context(args)` interpreta los query params `?competition=<id>|all&last=<n>`; `filter_games` aplica el filtro de competencia y últimos N sobre las filas de una entidad; `context_echo` arma el eco de la selección (§7.5). `without_last(ctx)` devuelve el mismo contexto sin el filtro last (el promedio de liga no depende del subconjunto en pantalla).

### `repository.py`
Acceso de lectura a los partidos (C-02): carga en bloque (una consulta por tabla por petición, sin N+1) las filas de equipo y de jugador de los partidos visibles. `resolve_competition(param, entity, config)` resuelve la competencia de la petición (parámetro → entidad → configuración F-13 → última de la liga → ninguna). `team_game_rows(comp_id)` / `player_game_rows(comp_id)` devuelven dicts planos listos para `stats_engine`. Memoización por petición vía `flask.g`.

### `population.py`
Población de liga y perfiles de equipo y de jugador (C-02). La población de una competencia son sus entidades con un valor por métrica (todos sus partidos, misma agregación que el perfil). `league_averages` calcula el `Ø` como media de esos valores (DA-08: cada entidad una vez, no ponderada por partidos). `team_profile` / `player_profile` arman la respuesta de `GET /api/team` y `GET /api/player` para la selección activa: `app.py` solo parsea el contexto y delega. Sin competencia (`all`), cada métrica es `Ø —` con razón `sin_universo`.

### `stats_engine.py`
Calcula métricas avanzadas on-the-fly en cada request (no se persisten en DB).

- `calc_team_stats(t, opp)` — recibe stats crudas del equipo y del rival, retorna ~35 métricas.
- `calc_player_stats(p, team_pos)` — versión jugador.
- `aggregate_games(per_game, keys, entity_type)` — agrega partidos: promedios (pooled para tasas, DA-02), totales y razones de nulos.
- `league_averages(member_values, keys)` — media y mejor valor de la liga para cada métrica (DA-08: media de entidades, no de partidos).
- `metric_keys(entity_type)` — claves de métricas de equipo o jugador.
- `StatBundle` / `compute_standard(bundle)` / `sum_bundles` / `apply_base` (T-05) — el conjunto estándar de 83
  métricas: puro (no accede a la base ni a config), consumido por `metrics_catalog.build_payload`.

Ver [metrics.md](metrics.md) para fórmulas completas.

### `population.py`
Población de referencia y ficha de métrica (C-02 + T-01). `population(entity_type, comp_id, ctx, *,
apply_thresholds=True, variant)` enumera las entidades de una competencia (vía los enumeradores de
`metrics_catalog`), calcula sus valores con `compute_standard`+`apply_base("partido")`+ajuste de T-02, y marca
`in_population` según los umbrales de muestra. `rank`/`percentile`/`_leader`/`league_reference`/`ficha`/
`attach_fichas`/`full_ranking` arman los cinco elementos de la ficha (T-01, fórmulas en `docs/metrics.md`).
Cacheada entre peticiones por `cache.memo`. El camino legado de C-02 (`league_summary`, perfiles) usa
`_legacy_population` sin umbrales.

### `cache.py`
Caché entre peticiones versionada (T-01). `memo(namespace, key, build_fn)` con LRU por namespace, claves
prefijadas por `(data_version, config_version)` leídas de la tabla `app_meta`. `bump_data_version` /
`bump_config_version` invalidan todo lo cacheado al escribir datos (ingesta, borrado, competencias, identidad)
o configuración (F-13). Tolerante a correr fuera de `app_context`.

### `shot_zones.py`
Zonas de tiro y percentil por zona (C-03). Extrae la clasificación de 11 zonas de `app.py` y agrega enriquecimiento estadístico. `classify_zone(action_type, sub_type, court_x, court_y, qualifiers)` clasifica un tiro en una de las 11 zonas (ZONE_KEYS_11). `zone_table(shots)` agrega tiros por zona con FG%, eFG%, PPT y share. `zones_with_stats(entity_type, entity_id, comp_id, last, shots_query_fn)` añade percentil y muestra por zona comparando con la población de la competencia. Alimenta `GET /api/shot-zones`.

### `sample.py`
Confiabilidad de muestra (T-02): niveles (`baja`/`media`/`alta`), umbral relativo con piso absoluto, prior de
la competencia (`league_prior`), regresión a la media (`adjusted`, `adjust_values`), banda de error (`band`),
rankeabilidad (`is_ranked`) y calibración de K por correlación de mitades (`calibrate_k`, partidos alternos).
Puro — no persiste nada; lee todo de `config.get()`. Se engancha en `metrics_catalog.build_payload` (T-05),
agregando `sample` y `adj` al payload estándar de quinteto/ON-OFF/cierre.

### `metrics_catalog.py`
Catálogo único del conjunto estándar de métricas (T-05): `MetricDef`, `GROUPS` (12), `METRICS` (83 claves con
label/grupo/formato/dirección/`base_mode`/entidades/`legacy_keys`), `register_entity`, `catalog_json`,
`standard_payload`, `build_payload` (orquesta validación de parámetros, contexto C-02, carga del bundle,
`stats_engine.compute_standard` + `apply_base`). Alimenta `GET /api/metrics-catalog` y
`GET /api/metrics/<entity_type>`.

### `bundles.py`
Cargadores de `StatBundle` (T-05) para equipo y jugador: `team_game_bundles`, `player_game_bundles` arman los
conteos crudos por partido desde `repository.*` y los registran en `metrics_catalog`. Quinteto/ON-OFF/cierre
se cargan desde `lineups.lineup_bundle`/`onoff_bundles` y `clutch.clutch_bundle` respectivamente (mismos
módulos que ya existían, extendidos).

### `tables.py`
Motor de tablas completas (T-06). `TableDef`, `TableRequest`, `_REGISTRY`, `register_table` con kwargs
(`row_kind`, `required_params`, `extra_columns`, `default_sort`, `totals_mode`, `avg_mode`, `title_fn`).
`build_table` (pipeline 16 pasos): validación, contexto, `compute_standard` + `apply_base` por fila,
armado de columnas (texto + métricas del catálogo), percentiles (entidad vía `population`, partido vía
`_game_population`), muestra, ajustado, totales, promedio de competencia, `meta` con `generated_by` y
`default_sort`. `bulk_workbook(scope, scope_id, comp_id)` genera bytes XLSX multi-hoja. 6 builders:
`league_teams`, `league_standings`, `team_game_log`, `player_game_log`, `search_players`, `clutch_games`.
Alimenta `GET /api/table/<table_id>` y `GET /api/export/bulk`.

### `export_xlsx.py`
Generador SpreadsheetML/OOXML (T-06). `workbook_bytes(sheets, meta)` arma un `.xlsx` válido con `zipfile`
(sin openpyxl): Portada con metadatos, hojas de datos con números nativos (`<c>` sin `t`), texto inline
(`inlineStr`), estilos de formato (porcentaje, decimal), fila de títulos y primera columna fijas (pane
freeze), footer. Límites: 1–20 hojas, nombres ≤ 31 chars, ≤ 50 000 filas.

### `config.py`
Configuración global (F-13). `CONFIG_SPEC`: catálogo de 81 claves con tipo, default, rango, sección y status (`activa`/`reservada`). 6 claves activas: `clutch.margin`, `clutch.window_secs`, `standings.win_points`, `standings.loss_points`, `standings.tiebreak`, `ui.default_competition_id`. Las reservadas se habilitan al implementar su feature consumidora. `get(key)` lee override o default (overrides cacheados en `flask.g`). `set_values(values)` valida tipo/rango/coherencia y escribe atómicamente; borra la fila si el valor iguala al default (RF-2). `reset(keys)` / `reset_section(slug)` borran overrides. `spec_json()` / `payload()` generan la respuesta para el frontend.

### `prefs.py`
Preferencias por usuario (F-13). Scopes: `table.columns`, `table.sort`, `table.colorize`, `panel.collapsed`, `ui` (con claves restringidas). `current_owner()` resuelve usuario de sesión o `"_open"`. CRUD: `get_prefs(scope)`, `set_pref(scope, key, value)`, `delete_pref(scope, key)`.

### `clutch.py`
Agrega el play-by-play (`pbp_events`) para la **ventana de cierre** del partido (último período REGULAR con reloj ≤ `window_secs` + todas las prórrogas, `period_type` `OVERTIME`/`OT`). Umbral y ventana se leen de `config.get()` (F-13); los `DEFAULT_MARGIN`/`DEFAULT_WINDOW_SECS` anteriores fueron eliminados. `team_clutch(games, team_code, team_name, margin=None, window_secs=None, games_without_pbp=0)` retorna el cierre de UN equipo: un **agregado** ("mini-partido" de todos sus cierres apretados) + un **desglose por partido**, contando solo los partidos con diferencia ≤ `margin` al entrar a la ventana (`_entry_margin`), y el recuento completo de partidos (C-06). Usa las fórmulas de `stats_engine`. Alimenta `GET /api/clutch/<team_code>` en la vista Equipo. Base: Feature 02 (pbp persistido). Ver `sdd/specs/05-clutch/spec.md §10` (revisión v2).

### `lineups.py`
Motor de reconstrucción de quintetos en cancha, compartido por **Feature 03 (lineups)** y **Feature 04 (on/off)**. `build_segments(events, team_code, starters)` camina `pbp_events` de un partido y parte en tramos cada vez que el equipo hace una `substitution`; cada tramo guarda el quinteto en cancha (`on_court`), sus eventos y los segundos transcurridos (exacto: 600 s por cuarto, 300 s por prórroga `OVERTIME`). `lineup_stats()` filtra tramos donde una combinación de 3-5 jugadores está en cancha; `onoff_stats()` parte todos los tramos en ON/OFF para un jugador (partición exhaustiva y disjunta por construcción). Alimenta `GET /api/lineup/<team>` y `GET /api/onoff/<team>/<player>`. Base: Feature 02 (`pbp_events` + `starter`).

### `database.py`
SQLite. `DB_PATH` resuelto desde variable de entorno `DB_PATH` (default: `backend/basketball.db`).

Lógica de creación del directorio al cargar el módulo: si el directorio del path no existe, intenta `makedirs`; si hay `PermissionError` (disco no montado en Render), hace fallback al directorio local del módulo.

Ver [database.md](database.md) para esquema completo.

## Flujo de datos principal

```
1. Usuario ingresa URL FIBA LiveStats
        │
        ▼
2. POST /api/import
        │
        ▼
3. ingest.import_url(url)
   ├─ fiba_fetcher.fetch_raw(url) → data.json + fecha/competencia de bs.html
   ├─ fiba_fetcher.parse_game() → teams[], players[], shots[], pbp[], minutes
   ├─ persist_game(): upsert de games (+ competencia por alias) y reemplazo de
   │  team_game_stats, player_game_stats, shots, pbp_events
   └─ archive_raw(): JSON crudo gzip en game_sources (para reprocesar)
        │
        ▼
5. GET /api/team/<code> (u otro endpoint)
   ├─ context.parse_context() → competencia + últimos N
   ├─ population.team_profile() → perfil completo
   │   ├─ repository.team_game_rows() → filas en bloque
   │   ├─ stats_engine.aggregate_games() → promedios pooled
   │   └─ population.league_summary() → Ø de la competencia (DA-08)
   └─ Retorna JSON con averages + game_log + league + context
        │
        ▼
6. frontend/js/app.js renderiza tablas con color-coding
   relativo a promedios de liga
```

## Decisiones de diseño

| Decisión | Razón |
|----------|-------|
| Métricas calculadas on-the-fly | Simplicidad; evita recomputar toda la DB al cambiar fórmulas |
| SQLite en lugar de Postgres | Suficiente para escala FUBB; cero configuración de servidor |
| Monolito Flask sirviendo frontend | Deploy single-service en Render; sin CORS cross-origin en producción |
| Playwright opcional | Render.com no tiene Chromium instalado por defecto |
| Upsert del partido + reemplazo de sus filas hijas | Importar o reprocesar el mismo partido dos veces deja el mismo estado |
| JSON crudo archivado (gzip) | Reprocesar tras un cambio del parser sin depender de FIBA (~50 KB por partido) |
| Competencia por alias del texto de FIBA | Renombrar o fusionar competencias sin tocar el dato scrapeado |
| Migración vía `upgrade_db()` | `ALTER TABLE ADD COLUMN` idempotente al arranque; evita dependencia de Alembic |
| Credenciales en env var (no tabla `users`) | Sobreviven redeploys en dev (disco efímero) y prod por igual; sin schema nuevo |
| Login gateado por entorno | Mismo código en dev/prod; la fuerza del login = qué `AUTH_USERS` se configura por servicio |
