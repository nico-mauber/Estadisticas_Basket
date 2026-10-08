# Plan — T-05: Conjunto estándar de métricas — regla de completitud

> **ID:** T-05 · **Prioridad:** P0 · **Fase y orden:** Fase 1 · 13
> **Depende de:** C-01 ([../09-C-01-rebotes-distribucion-jugador/plan.md](../09-C-01-rebotes-distribucion-jugador/plan.md)) · C-04 ([../08-C-04-as-per/plan.md](../08-C-04-as-per/plan.md)) · C-07 ([../10-C-07-detalle-tiro-completo/plan.md](../10-C-07-detalle-tiro-completo/plan.md)) · C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)) · F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)) · C-08 ([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md)) · C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md)) · F-13 ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md), solo `ui.metric_labels`)
> **Habilita:** T-02, T-01, T-06, T-04, F-06, F-05, F-08, F-18, F-07, A-01, A-12
> **Estado:** ✅ Aprobado
> **Fuente:** [spec.md](spec.md) · Especificación v2 §3 · T-05 · Arquitectura §2.1–§2.3, §3.5, §3.8, §4, §5, §6, §7.3, §7.4, §8
> **Estimación:** XL · 28–38 h

## 1. Enfoque
1. **Datos primero.** FIBA publica tapones recibidos y faltas recibidas y la ingesta los descarta. Se agregan cuatro columnas (`DEFAULT NULL`),
   el parser las lee, se sube `INGEST_VERSION` y se reprocesan los partidos **desde el archivo crudo** de F-11 (sin tocar FIBA). Para quinteto,
   ON/OFF y cierre no hace falta columna: `foulon` del equipo y `block` del rival salen del pbp (verificado 26/26 contra el box).
2. **Un catálogo, una función.** `backend/metrics_catalog.py` (metadatos, sin fórmulas) define las 83 claves (59 obligatorias en 11 grupos + 24 `extra`).
   `stats_engine.compute_standard(StatBundle)` es el único lugar con las fórmulas: recibe conteos crudos ya sumados y devuelve `{clave: {value, reason}}`.
   `apply_base` escala (`total|partido`). `sum_bundles` suma bundles por partido en el de la selección (pooled por construcción).
3. **Cargadores por entidad.** Un módulo nuevo `backend/bundles.py` arma los `StatBundle` de equipo y jugador desde las filas del box; `lineups.py` los de
   quinteto y ON/OFF; `clutch.py` el de cierre. Todos se inscriben con `metrics_catalog.register_entity`.
4. **Un endpoint genérico** `GET /api/metrics/<entity_type>` y el catálogo `GET /api/metrics-catalog`; `/api/team` y `/api/player` agregan el mismo bloque
   como `standard`. Los endpoints legado no cambian.
5. **Un panel común** `components/standard-panel.js` + `core/catalog.js` reemplazan las listas por pantalla en Combinación, ON/OFF, Cierres y suman el
   bloque completo a Equipo y Jugador. Percentil/ranking (T-01), badge y ajustado (T-02) y bases por 40/100 (T-04) se enchufan en puntos de extensión
   marcados, sin rehacer nada.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/database.py` | model/migración | 4 columnas `blk_received`, `fouls_drawn` en `TeamGameStats`/`PlayerGameStats` + 4 entradas en `upgrade_db().new_cols` (sin DEFAULT) | RF-13 |
| `backend/fiba_fetcher.py` | module (parser) | leer `tot_sBlocksReceived`/`tot_sFoulsOn` y `sBlocksReceived`/`sFoulsOn` con `default=None` | RF-13 |
| `backend/ingest.py` | module | `INGEST_VERSION` 2→3; agregar las columnas a `team_cols` y `player_cols` de `persist_game` | RF-13 |
| `backend/data_quality.py` | module | 4 entradas en `NULL_FIELDS` | RF-21 |
| `backend/stats_engine.py` | service | `RAW_KEYS`, `StatBundle`, `compute_standard`, `apply_base`, `sum_bundles`, helpers puros; reasons nuevas en `null_reason` | RF-2…RF-12, RF-14, RF-15, RF-18 |
| `backend/metrics_catalog.py` | module NUEVO | `MetricDef`, `GROUPS`, `METRICS`, `EntityRequest`, `register_entity`, `catalog_json`, `standard_payload`, `build_payload`, `load_game_bundles`, `MetricsError` | RF-1, RF-2, RF-16, RF-19, RF-20 |
| `backend/bundles.py` | module NUEVO (PROPUESTA) | cargadores de `team` y `player` (por partido y de selección); registro de los 5 tipos al importar | RF-5…RF-16, RF-19 |
| `backend/lineups.py` | module | `_agg` suma `pf`/`fouls_drawn`; `lineup_bundle`, `onoff_bundles`, `player_on_court`; refactor sin cambio de salida de `lineup_stats`/`onoff_stats` | RF-2, RF-13, RF-14, RF-19 |
| `backend/clutch.py` | module | `clutch_bundle` (reusa la selección de partidos calificados de `team_clutch`) | RF-2, RF-19 |
| `backend/app.py` | route | `GET /api/metrics-catalog`, `GET /api/metrics/<entity_type>`; `standard` en `team_stats` y `player_stats` (y en `GET /api/player/<int:player_id>` de C-08); import de `bundles` | RF-2, RF-16, RF-18 |
| `backend/config.py` (de F-13) | module | `ui.metric_labels` pasa a `status: "activa"` | RF-20 |
| `frontend/js/core/catalog.js` | js-core NUEVO | `loadCatalog`, `metricDef`, `metricLabel`, `groupsFor`, `stdKeyFor` | RF-1, RF-17 |
| `frontend/js/core/format.js` | js-core (C-11) | `fmtMetric(key, value)`, `fmtSigned`; `NULL_REASON_LABELS` con los códigos nuevos | RF-3, RF-17 |
| `frontend/js/components/standard-panel.js` | js-component NUEVO | `renderStandardPanel(el, payload, opts)`: grupos, selector de base, layout "grid" y "compare" (ON/OFF), estados | RF-17 |
| `frontend/js/api.js` | js-api | `metricsCatalog()`, `metrics(type, params)` | RF-1, RF-2 |
| `frontend/js/app.js` | js-view | Equipo, Jugador, Combinación, ON/OFF y Cierres montan el panel; se retiran las grillas propias del conjunto estándar de Combinación y ON/OFF y el agregado de Cierres | RF-17 |
| `frontend/css/style.css` | css | sección `/* ── standard-panel (T-05) ── */` | RF-17 |
| `frontend/sw.js` | sw | `STATIC` += `/js/core/catalog.js`, `/js/components/standard-panel.js`; `CACHE` `smart-basket-v13` → siguiente entero (se asigna al integrar) | RF-17 |
| `docs/metrics.md` | doc (cierre) | sección "Conjunto estándar": claves, fórmulas, pooled, cambios visibles (PPT, TO%, USO%, AS%, DER/Net jugador) | RF-4…RF-12, RF-18 |
| `docs/api.md` | doc (cierre) | 2 endpoints nuevos, bloque `standard`, nulos con razón nuevos | RF-2, RF-3 |
| `docs/database.md` | doc (cierre) | 4 columnas y el significado de NULL | RF-13 |
| `docs/frontend.md` | doc (cierre) | `core/catalog.js`, `standard-panel`, copy nuevo, retiro de las grillas por pantalla | RF-17 |
| `docs/architecture.md` | doc (cierre) | módulos `metrics_catalog.py` y `bundles.py` en el mapa de capas | RF-1 |

**Matriz RF → archivo:** RF-1 (metrics_catalog, catalog.js, api.js, app.py) · RF-2 (metrics_catalog, stats_engine, bundles, lineups, clutch, app.py) · RF-3 (stats_engine,
format.js) · RF-4 (stats_engine) · RF-5…RF-12 (stats_engine, bundles, lineups, clutch) · RF-13 (database, fiba_fetcher, ingest, lineups, clutch) · RF-14 (bundles, lineups,
stats_engine) · RF-15 (stats_engine, app.py, standard-panel) · RF-16 (metrics_catalog, app.py) · RF-17 (standard-panel, catalog.js, format.js, app.js, css, sw.js) · RF-18 (app.py, docs) ·
RF-19 (metrics_catalog, bundles, lineups, clutch) · RF-20 (metrics_catalog, config.py) · RF-21 (data_quality). Sin RF huérfanos.

## 3. Backend — rutas y modelos

### 3.1 Esquema (vía `upgrade_db()`, idempotente; modelos SQLAlchemy actualizados)
| Tabla.columna | Tipo | Default | Vía | Notas |
|---|---|---|---|---|
| `team_game_stats.blk_received` | INTEGER | NULL (sin DEFAULT) | `upgrade_db().new_cols`: `("team_game_stats", "blk_received", "INTEGER")` | tapones recibidos por el equipo |
| `team_game_stats.fouls_drawn` | INTEGER | NULL | `("team_game_stats", "fouls_drawn", "INTEGER")` | faltas recibidas (`tot_sFoulsOn`) |
| `player_game_stats.blk_received` | INTEGER | NULL | `("player_game_stats", "blk_received", "INTEGER")` | |
| `player_game_stats.fouls_drawn` | INTEGER | NULL | `("player_game_stats", "fouls_drawn", "INTEGER")` | |

Sin restricciones nuevas ni cambios en las únicas existentes. NULL = "no importado todavía"; FIBA informa 0 → se guarda 0.
`ingest.INGEST_VERSION` pasa de 2 a 3 (si al implementar otro requisito ya la subió, se usa el entero siguiente al vigente): todos los partidos quedan
`needs_reprocess` y el panel Datos → Calidad los lista. Reproceso: `POST /api/reprocess` (F-11) desde `game_sources` (archivo crudo), sin red.

### 3.2 `GET /api/metrics-catalog` — NUEVO · `login_required`
Sin parámetros. Response 200:
```json
{
  "version": 1,
  "groups": [
    {"key": "volumen", "label": "Volumen", "metrics": ["games", "minutes", "possessions", "pace", "sec_per_poss"]},
    {"key": "produccion", "label": "Producción", "metrics": ["pts", "pts_against", "ppp", "oer", "der", "net_rating", "plus_minus"]},
    {"key": "tiro_volumen", "label": "Tiro — intentos y aciertos", "metrics": ["fga2", "fgm2", "fga3", "fgm3", "fta", "ftm", "fga", "fgm"]},
    {"key": "extra", "label": "Otras métricas", "metrics": ["plays", "pps", "ft_rate_report"]}
  ],
  "metrics": {
    "ppt": {"label": "PPT", "group": "tiro_valor", "fmt": "dec2", "direction": "higher", "kind": "rate", "base_mode": "fixed",
            "rel_dist": true, "entities": ["team", "player", "lineup", "onoff", "clutch"], "legacy_keys": ["pps"], "order": 31},
    "blk_received": {"label": "Tapones recibidos", "group": "defensa", "fmt": "int", "direction": "lower", "kind": "count",
                     "base_mode": "count", "rel_dist": true, "entities": ["team", "player", "lineup", "onoff", "clutch"], "legacy_keys": [], "order": 46}
  },
  "null_reasons": ["sin_intentos", "sin_perdidas", "sin_pbp", "no_registrado", "no_aplica", "sin_datos", "no_disponible", "dnp"]
}
```
(Recorte: en la respuesta real `groups` lista los 12 grupos y `metrics` las 83 claves.) `label` ya aplica `ui.metric_labels` (RF-20). Errores: 401 (sesión).

### 3.3 `GET /api/metrics/<entity_type>` — NUEVO · `login_required`
Parámetros de query:
| Param | Valor | Notas |
|---|---|---|
| `id` (obligatorio) | `team`: `team_code` (ej. `VER`) · `player`: `player_id` entero de C-08 (también acepta `<team_code>:<nombre>` y lo resuelve con `identity`) · `lineup`: `<team_code>:<pid>-<pid>-…` (3–5 ids ascendentes) · `onoff`: `<team_code>:<pid>` · `clutch`: `team_code` | |
| `competition` | id \| `all` \| texto legado | contrato de C-02 (`context.parse_context`) |
| `last` | entero > 0 | contrato de C-02 (últimos N partidos del equipo) |
| `base` | `total` \| `partido` (default `partido`) | `por40`/`por100` → 400 (T-04) |
| `margin`, `window_secs` | solo `clutch` | mismas validaciones que `/api/clutch` (`MARGIN_RANGE`, `WINDOW_RANGE`) |

Response 200 (ejemplo `GET /api/metrics/team?id=VER&competition=1&base=partido` sobre el seed; cifras verificables a mano con los totales de VER: 2 partidos, 149 pts,
154,24 posesiones propias, 155,12 del rival; recorte de 8 de las 83 claves):
```json
{
  "entity": {"type": "team", "id": "VER", "name": "VERDIRROJO", "team_code": "VER"},
  "context": {"competition": {"id": 1, "label": "Liga de Ascenso 2026"}, "applied": {}, "ignored": [], "level": "partido",
              "population_mode": "apply_all", "games_used": 2, "games_total": 2, "games_excluded": {}, "label": "Liga de Ascenso 2026"},
  "base": "partido",
  "sample": null,
  "groups": [{"key": "volumen", "label": "Volumen", "metrics": ["games", "minutes", "possessions", "pace", "sec_per_poss"]}],
  "metrics": {
    "games":       {"value": 2,      "reason": null},
    "possessions": {"value": 77.12,  "reason": null},
    "pace":        {"value": 77.34,  "reason": null},
    "pts":         {"value": 74.5,   "reason": null},
    "oer":         {"value": 0.966,  "reason": null},
    "ppt":         {"value": 0.8978, "reason": null},
    "blk_received":{"value": null,   "reason": "no_registrado"},
    "uso_pct":     {"value": null,   "reason": "no_aplica"}
  },
  "catalog_version": 1
}
```
Quinteto (`GET /api/metrics/lineup?id=CNF:12-15-18-21-30`): mismo shape; `entity.name` = apellidos separados por " · "; `context` informa `games_excluded: {"sin_titulares": n}` (partidos sin 5 titulares válidos) y `sin_pbp` para partidos sin pbp.
Jugador: agrega `coverage` = `{"games": 2, "on_court_games_exact": 2, "on_court_games_estimated": 0}`; una métrica estimada/parcial lleva `"estimated": true` o `"partial": true`:
```json
"possessions": {"value": 71.4, "reason": null, "estimated": true},
"der":         {"value": 1.02,  "reason": null, "partial": true},
"pace":        {"value": null,  "reason": "sin_pbp"}
```
ON/OFF (`GET /api/metrics/onoff?id=CNF:15`): el shape base trae en `metrics` el estado ON; agrega:
```json
"states": {"on": {"seconds": 1380.0, "metrics": {"oer": {"value": 1.12, "reason": null}}}, "off": {"seconds": 1020.0, "metrics": {"oer": {"value": 1.04, "reason": null}}}},
"diff": {"oer": 0.082, "der": -0.044, "net_rating": 0.126, "efg_pct": 0.031}
```
(`diff` = ON − OFF solo de las métricas `kind = rate`; los conteos escalan con los minutos y no se restan.) `states` es **PROPUESTA** (el §7.3 no cubre ON/OFF).

Errores (formato `{"error": "...", "code": "..."}`, `error` se mantiene para `api.js`):
| HTTP | `code` | Mensaje (es) | Cuándo |
|---|---|---|---|
| 400 | `parametro_invalido` | "Tipo de entidad desconocido" / "Falta el parámetro id" / "Elegí entre 3 y 5 jugadores" / "Base no disponible: llega con la normalización por 40 minutos y por 100 posesiones" / "La base debe ser total o partido" | |
| 400 | `competencia_inexistente` | "La competencia no existe" | `CompetitionError` de `context.parse_context` |
| 400 | `contexto_invalido` | mensaje de `ContextError` | |
| 404 | `no_encontrado` | "Entidad no encontrada" | id inexistente |
| 404 | `sin_pbp` | "Sin play-by-play para esta selección. Reimportá sus partidos." | quinteto/ON-OFF/cierre sin ningún partido con pbp |

### 3.4 `GET /api/team/<team_code>` · `GET /api/player/<team_code>/<player_name>` · `GET /api/player/<int:player_id>` (C-08) — modificados
Agregan la clave `standard` con exactamente el payload de §3.3 (`team` o `player`) calculado con los mismos `competition`, `last` y `base` de la petición. Todas las claves
actuales se conservan (RF-18). Si el cálculo del bloque falla, la respuesta legado se devuelve igual con `"standard": null` y se loguea (el legado no se degrada).

### 3.5 `GET /api/data-quality` — modificado (F-11)
`checks.null_fields.items` suma 4 filas (`team_game_stats.blk_received` "Tapones recibidos (equipo)", `team_game_stats.fouls_drawn` "Faltas recibidas (equipo)",
`player_game_stats.blk_received` "Tapones recibidos (jugador)", `player_game_stats.fouls_drawn` "Faltas recibidas (jugador)"). El cambio de `INGEST_VERSION` ya los lista en `games_needing_reprocess`.

## 4. Backend — lógica

### 4.1 Claves, bundle y registro (`stats_engine.py` + `metrics_catalog.py`)

```
RAW_KEYS = ("pts","fgm2","fga2","fgm3","fga3","ftm","fta","orb","drb","ast","tov","stl","blk",
            "blk_received","pf","fouls_drawn","plus_minus")             # Arq. §3.5 (literal)

@dataclass
class StatBundle:                                                       # Arq. §3.5 + 2 campos PROPUESTA
    entity_type; entity_id; name
    own: dict; opp: dict | None; team: dict | None
    games: int; minutes: float | None; team_minutes: float | None; seconds: float | None
    on_court: dict | None; shots: dict | None; possessions_counted: float | None
    null_reasons: dict
    derived: dict | None = None     # PROPUESTA: sumandos ponderados por minutos del jugador (ver 4.4); aditivos
    meta: dict = {}                 # PROPUESTA: team_code, team_name, games_total, games_excluded{}, game_ids[], window_secs…
```
Convenciones de `own`/`opp`/`team`: claves de `RAW_KEYS`; un conteo **desconocido** (columna NULL sin reprocesar) vale `None`, nunca 0. `on_court` (jugador) =
`{"own": dict, "opp": dict, "seconds": float, "games_exact": int, "games_estimated": int, "poss_estimated": float}`. `shots` = `{"paint_fga": int, "mid_fga": int, "fg3a": int}` o `None`.

`metrics_catalog.py` (metadatos, sin fórmulas):
```
CATALOG_VERSION = 1
@dataclass(frozen=True) class MetricDef: key,label,group,fmt,direction,kind,base_mode,per100_den,source,entities,rel_dist,legacy_keys   # Arq. §3.5
GROUPS: list[{key,label,metrics}]; METRICS: dict[str, MetricDef]   # ordenado
class MetricsError(Exception): message, status, code
@dataclass class EntityRequest: entity_type, entity_id, comp_id, ctx, base, params: dict = {}    # `params` PROPUESTA (margin/window_secs del cierre)
register_entity(entity_type, loader, *, game_loader=None, enumerator=None) -> None             # `game_loader` y `enumerator` PROPUESTA (T-06 y T-01)
catalog_json(lang="es") -> dict ; standard_payload(bundle, values, *, context_echo, base, sample, fichas=None) -> dict
build_payload(entity_type, args) -> dict ; load_game_bundles(req) -> list[tuple[dict, StatBundle]]
```
`loader(req) -> list[StatBundle]`: 1 bundle (team, player, lineup, clutch) o 2 `[on, off]` (onoff); `[]` = entidad inexistente.
`game_loader(req) -> list[tuple[dict, StatBundle]]`: un bundle por partido (`dict` = `{game_id, date, opponent_code, opponent, home_away, team_pts, opp_pts, played}`); lo pide T-06 en su plan §4.3
y se implementa aquí para `team`, `player` y `clutch`; `lineup`/`onoff` por partido quedan para F-06. `enumerator(comp_id, ctx) -> list[StatBundle]` (todas las entidades de la competencia) lo usa T-01 para poblaciones;
T-05 lo inscribe para `team` y `player`.

### 4.2 Catálogo definitivo (`METRICS`, orden de presentación)
Columnas: **clave · etiqueta · fmt · dirección · tipo/base** (`C` = count que escala con la base; `V` = volumen; `F` = fixed). `entities` = las cinco salvo donde se indica. `rel_dist` = `true` en métricas no porcentuales,
no firmadas y no neutrales de tipo C/V/F con fmt int/dec1/dec2 (decisión de T-01: porcentaje relativo solo "cuando la magnitud lo justifica"); `false` en `pct`, `signed_*` y neutrales.

| Grupo | Claves (etiqueta · fmt · dirección · tipo) |
|---|---|
| `volumen` | `games` Partidos · int · neutral · F — `minutes` Minutos · dec1 · neutral · V — `possessions` Posesiones · dec1 · neutral · V (`per100_den: own`) — `pace` PACE · dec1 · neutral · F — `sec_per_poss` Seg/posesión · dec1 · neutral · F |
| `produccion` | `pts` PTS · int · higher · C — `pts_against` PTS recibidos · int · lower · C (`per100_den: opp`) — `ppp` PPP · dec2 · higher · F — `oer` OER · dec2 · higher · F — `der` DER · dec2 · lower · F — `net_rating` Net Rating · signed_dec2 · higher · F — `plus_minus` +/- · signed_int · higher · C |
| `tiro_volumen` | `fga2` T2i · `fgm2` T2c · `fga3` T3i · `fgm3` T3c · `fta` TLi · `ftm` TLc · `fga` TCi · `fgm` TCc — int · intentos neutral, aciertos higher · C |
| `tiro_pct` | `fg_pct` FG% · `fg2_pct` FG2% · `fg3_pct` FG3% · `ft_pct` FT% · `efg_pct` eFG% · `ts_pct` TS% — pct · higher · F |
| `tiro_valor` | `ppt` PPT · `ppt_2` PPT 2 · `ppt_3` PPT 3 · `ppt_ft` PPT TL — dec2 · higher · F |
| `tiro_perfil` | `fg3_uso` Uso de triple · `fg2_uso` Uso de 2 — pct · neutral · F — `ft_rate` FT Rate · dec2 · higher · F — `paint_fga_share` % tiros en pintura · `mid_fga_share` % tiros de media distancia — pct · neutral · F |
| `balon` | `ast` AS · int · higher · C — `tov` PER · int · lower · C — `ast_to` AS/PER · dec2 · higher · F — `as_pos` AS/pos · dec2 · higher · F — `as_pct` AS% · pct · higher · F — `to_pct` TO% · pct · lower · F |
| `rebote` | `orb` RO · `drb` RD · `trb` REB — int · higher · C — `or_pct` OR% · `dr_pct` DR% · `trb_pct` REB% — pct · higher · F — `orb_pos` RO/pos · dec2 · higher · F — `drb_min` RD/min · `orb_min` RO/min — dec2 · higher · F |
| `defensa` | `stl` Robos · `blk` Tapones — int · higher · C — `blk_received` Tapones recibidos · int · lower · C — `stops` Stops · int · higher · C (`legacy_keys: stocks`) |
| `faltas` | `pf` Faltas cometidas · int · lower · C — `fouls_drawn` Faltas recibidas · int · higher · C |
| `uso` | `uso_pct` USO% · `uso_2p` USO 2P · `uso_3p` USO 3P — pct · neutral · F — `entities: ("player",)` |
| `extra` | `plays` Jugadas (TCi+0,44·TLi+PER) · dec1 · neutral · V — `pps` PTS/TCi (legado) · dec2 · higher · F — `ft_rate_report` FTc/TCi · dec2 · higher · F — `peso_1p` `peso_2p` `peso_3p` Peso 1P/2P/3P · pct · neutral · F — `to_ratio` TO ratio · pct · lower · F — `ast_ratio` AST ratio · pct · higher · F — `opp_efg_pct` eFG% rival · pct · lower · F — `opp_ts_pct` TS% rival · pct · lower · F — `opp_to_pct` TO% rival · pct · higher · F — `opp_ft_rate` FT Rate rival · dec2 · lower · F — `def_playmaking` Def. playmaking · int · higher · C — `def_to_ratio` DEF/TO · dec2 · higher · F — `physical_impact` Impacto físico · int · higher · C — `tov_pos` PER/pos · dec2 · lower · F — `reb_share` `oreb_share` `dreb_share` % reb. del equipo · pct · higher · F (`entities: player`) — `paint_pts` PtsEnPint · `second_chance_pts` Seg. oportunidad · `pts_from_tov` Pts tras pérdida · `bench_pts` Banca · `fast_break_pts` Contraataque — int · higher · C (`entities: team`) |

`legacy_keys`: `ppt`←`pps` (otra fórmula, DA-03), `stops`←`stocks`, `oer`←`off_rating`·`pts_pos`, `der`←`def_rating`, `pts`←`pts_for`, `trb`←`reb`, `pf`←`fouls_committed`, `plus_minus`←`point_diff`,
`uso_pct`←`usg_pct`. Las etiquetas viven solo aquí (más el override `ui.metric_labels`, RF-20). El conjunto de claves de `compute_standard` DEBE coincidir con `METRICS` (se verifica en T-F3).

### 4.3 `stats_engine.compute_standard(bundle)` — fórmulas y nulos
Entrada: un bundle. Salida: `{clave: {"value": v | None, "reason": código | None[, "estimated": true][, "partial": true]}}` con **las 83 claves**; las que no aplican a la entidad salen
`{"value": None, "reason": "no_aplica"}`. Redondeo: 4 decimales en tasas (como `_safe_div`), 2 en volumen.

Helpers puros: `_ratio(num, den, reason="sin_intentos")` → `(None, "no_registrado")` si `num` o `den` es `None`; `(None, reason)` si `den == 0`; si no `round(num/den, 4)`.
`pos(c)` = `c.fga2 + c.fga3 + 0.44·c.fta + c.tov − c.orb`. `plays(c)` = `fga + 0.44·fta + tov`. `fga(c)` = `fga2+fga3`; `fgm(c)` = `fgm2+fgm3`.
Si `bundle.games == 0` → las 83 claves `sin_datos`.

**Categorías.** *teamlike* (`team`, `lineup`, `onoff`, `clutch`) usa `own`/`opp` para todo. *player* usa `own` (box del jugador) para tiro, balón, rebote, defensa, faltas y USO, y `on_court` (equipo con el jugador en cancha)
para volumen y defensa-equipo.

| Grupo | teamlike | player |
|---|---|---|
| `games` | `bundle.games` | partidos jugados (DNP excluidos al armar el bundle) |
| `minutes` | team: Σ `games.minutes`; lineup/onoff/clutch: `seconds/60` | Σ minutos del box |
| `possessions` | `pos(own)` | `pos(on_court.own) + on_court.poss_estimated`; `estimated = games_estimated > 0`; sin ningún dato → nulo `sin_pbp` |
| `pace` | `40 · ((pos(own)+pos(opp))/2) / minutes` (`minutes > 0`) | `40 · ((pos(oc.own)+pos(oc.opp))/2) / (oc.seconds/60)` solo exacto; `games_exact == 0` → nulo `sin_pbp`; `games_exact < games` → `partial` |
| `sec_per_poss` | `(minutes·60) / (pos(own)+pos(opp))` | `oc.seconds / (pos(oc.own)+pos(oc.opp))`, mismas reglas que `pace` |
| `pts` | `own.pts` | `own.pts` |
| `pts_against` | `opp.pts` | `oc.opp.pts` (exacto; `sin_pbp`/`partial` como `pace`) |
| `ppp` | `pts / pos(own)` | `pts / plays(own)` |
| `oer` | `pts / pos(own)` | `pts / pos(own)` (OER individual, con −RO) |
| `der` | `opp.pts / pos(opp)` | `oc.opp.pts / pos(oc.opp)` (DA-34) |
| `net_rating` | `oer − der` (ambos no nulos) | `(oc.own.pts/pos(oc.own)) − der` (DA-34) |
| `plus_minus` | `own.pts − opp.pts` | `own.plus_minus` (Σ FIBA; `None` → `no_registrado`) |
| tiro (intentos/aciertos) | sumas de `own`; `fga=fga2+fga3`, `fgm=fgm2+fgm3` | ídem |
| `fg_pct`,`fg2_pct`,`fg3_pct`,`ft_pct` | `fgm/fga`, `fgm2/fga2`, `fgm3/fga3`, `ftm/fta` (`sin_intentos`) | ídem |
| `efg_pct` | `(fgm + 0.5·fgm3)/fga` | ídem |
| `ts_pct` | `pts / (2·(fga + 0.44·fta))` | ídem |
| `ppt`,`ppt_2`,`ppt_3`,`ppt_ft` | `(2·fgm2+3·fgm3)/fga` · `2·fgm2/fga2` · `3·fgm3/fga3` · `ftm/fta` | ídem |
| `fg3_uso`,`fg2_uso`,`ft_rate` | `fga3/fga`, `fga2/fga`, `fta/fga` | ídem |
| `paint_fga_share`,`mid_fga_share` | `shots.paint_fga/fga`, `shots.mid_fga/fga` si `bundle.shots`; si no → nulo `no_disponible` (→ C-03) | ídem |
| `ast`,`tov` | sumas | sumas |
| `ast_to` | `ast/tov` (`sin_perdidas`) | ídem |
| `as_pos` | `ast / pos(own)` | `ast / pos(own)` (posesiones propias del jugador) |
| `as_pct` | `ast / fgm` (`sin_intentos`) | `ast / (derived.fgm_team_w − fgm(own))` (DA-06; denominador ≤ 0 → `sin_intentos`) |
| `to_pct` | `tov / pos(own)` (DA-04) | `tov / plays(own)` |
| `orb`,`drb`,`trb` | sumas (`trb=orb+drb`) | ídem |
| `or_pct` | `orb/(orb+opp.drb)` | `orb / derived.orb_pool_w` |
| `dr_pct` | `drb/(drb+opp.orb)` | `drb / derived.drb_pool_w` |
| `trb_pct` | `trb/(trb+opp.orb+opp.drb)` | `trb / derived.trb_pool_w` |
| `orb_pos` | `orb / pos(own)` | `orb / possessions` (la de volumen; hereda `estimated`) |
| `orb_min`,`drb_min` | `orb/minutes`, `drb/minutes` | por minuto jugado |
| `stl`,`blk` | sumas | sumas |
| `blk_received` | `own.blk_received` (`None` → `no_registrado`); lineup/onoff/clutch: `opp.blk` | `own.blk_received` |
| `stops` | `stl + blk` | ídem |
| `pf` | `own.pf` | `own.pf` |
| `fouls_drawn` | `own.fouls_drawn` (`None` → `no_registrado`); lineup/onoff/clutch: derivado de `foulon` | `own.fouls_drawn` |
| `uso_pct`,`uso_2p`,`uso_3p` | `no_aplica` | `plays(own)/derived.plays_team_w` · `fga2/derived.t2a_team_w` · `fga3/derived.t3a_team_w` (DA-05; denominador 0 → `sin_intentos`) |
| extras | `plays`, `pps = pts/fga`, `ft_rate_report = ftm/fga`, `peso_1p/2p/3p = ftm/pts, 2·fgm2/pts, 3·fgm3/pts`, `to_ratio = tov/plays`, `ast_ratio = ast/plays`, `opp_efg_pct`, `opp_ts_pct`, `opp_ft_rate` sobre `opp`, `opp_to_pct = opp.tov/pos(opp)`, `def_playmaking = stl+blk−tov`, `def_to_ratio = (stl+blk+drb)/tov` (`sin_perdidas`), `physical_impact = trb+stl`, `tov_pos = tov/pos(own)`; `paint_pts…fast_break_pts` solo `team` (suma; `None` → `no_registrado`); `reb_share/oreb_share/dreb_share` `no_aplica` | los mismos con `own`; `opp_*` sobre `oc.opp` (exacto/`partial`); `tov_pos = tov/pos(own)`; `reb_share = trb/team.trb`, `oreb_share = orb/team.orb`, `dreb_share = drb/team.drb`; los de FIBA de equipo `no_aplica` |

Reglas de nulos: (1) `bundle.games == 0` → todo `sin_datos`. (2) Denominador 0 → `sin_intentos` (`sin_perdidas` para `ast_to` y `def_to_ratio`). (3) Un conteo `None` en cualquier operando → `no_registrado`
(incluye `blk_received`, `fouls_drawn`, `plus_minus`, `paint_pts`…). (4) Métrica de jugador que necesita segmentos y no los hay → `sin_pbp`. (5) No aplica a la entidad → `no_aplica`. (6) Nunca se redondea un nulo a 0.
Idempotencia/pureza: `compute_standard` no accede a la base ni a la configuración (se testea con diccionarios).

### 4.4 `sum_bundles`, `apply_base`
`sum_bundles(bundles: list[StatBundle]) -> StatBundle` (PROPUESTA de T-06 §4.3, se implementa aquí): suma `own`, `opp`, `team`, `games`, `minutes`, `team_minutes`, `seconds`, `shots`, `derived`, y de `on_court`
(`own`, `opp`, `seconds`, `games_exact`, `games_estimated`, `poss_estimated`); un `None` en algún sumando de un conteo deja `None` en el total (C-11: un nulo no entra en una suma como 0); `meta.game_ids` se concatena.
`apply_base(values, bundle, base) -> dict`: `base == "total"` → igual; `"partido"` → por cada clave con `base_mode ∈ {count, volume}` y valor no nulo: `round(value / games, 2)` (`games == 0` → nulo `sin_datos`); `fixed` no cambia; `games` no cambia;
cualquier otra base (`por40`, `por100`) → `ValueError("Base no disponible…")` que la capa HTTP mapea a 400 (T-04 la implementa). Importa `METRICS` dentro de la función para evitar el ciclo de imports.

### 4.5 Cargadores (`backend/bundles.py`, NUEVO, PROPUESTA — Arq. §3.5 solo nombra a lineups/clutch)
Usa `repository.*` de F-11 (`competition_games`, `team_game_rows`, `player_game_rows`, `team_pbp_games`; ver §10 D-3 si aún no existen) y `context.filter_games` de C-02. Solo partidos visibles (competencias publicadas).

**`team_game_bundles(team_code, comp_id, ctx) -> list[tuple[dict, StatBundle]]`**
1. Partidos del equipo en `comp_id` (o todos si `comp_id is None`), filtrados con `context.filter_games(games, ctx, team_code)` (en fase 1, `last`).
2. Por partido: `own = _raw(fila_equipo)`, `opp = _raw(fila_rival)` (rival = otra fila del mismo `game_id`); `_raw` copia `RAW_KEYS` desde la fila (NULL → `None`; `plus_minus = pts − opp_pts`; `fgm`/`fga` se derivan).
   `minutes = games.minutes`, `seconds = minutes·60`, `meta = {team_code, team_name, game_ids:[gid]}`.
3. `team_bundle = sum_bundles(...)`; `meta.games_total` = partidos del equipo en la competencia sin `last`; `meta.games_excluded = {}`.

**`player_game_bundles(player_id, comp_id, ctx)`**
1. `card = identity.player_card(player_id)` (C-08): `team_code`, `display_name`. Filas de box con `player_id` canónico en la competencia; partidos del equipo filtrados con `context.filter_games(…, team_code)`; se conservan los partidos con `played(minutes)` (DNP fuera).
2. Por partido jugado: `own = _raw(fila_jugador)`; `team = _raw(fila_equipo)`; `opp = _raw(fila_rival)`; `mp = _parse_minutes(minutes)`; `gm = games.minutes`; `w = mp/gm`.
   `derived = {plays_team_w: w·plays(team), t2a_team_w: w·team.fga2, t3a_team_w: w·team.fga3, fgm_team_w: w·fgm(team), orb_pool_w: w·(team.orb+opp.drb), drb_pool_w: w·(team.drb+opp.orb), trb_pool_w: w·(team.orb+team.drb+opp.orb+opp.drb)}`.
3. `on_court`: `lineups.player_on_court(pbp_game, team_code, display_name)` (4.6). Si el partido no tiene pbp o no tiene 5 titulares válidos → `{games_exact: 0, games_estimated: 1, poss_estimated: pos(team)·w, own: ceros, opp: ceros, seconds: 0}`.
4. `team_minutes = gm·5`. `shots = None` (→ C-03). `bundle = sum_bundles(...)`; `name = display_name`.
5. Nombres del pbp: `identity.canonicalize_pbp_games(games, team_code)` (C-08) antes de buscar el nombre del jugador.

Registro al importar `bundles.py`: `register_entity("team", team_loader, game_loader=team_game_bundles, enumerator=all_team_bundles)`, `register_entity("player", …, enumerator=all_player_bundles)`, y
los wrappers de `lineup`, `onoff`, `clutch` (4.6, 4.7). `app.py` importa `bundles` al arrancar.
`all_team_bundles(comp_id, ctx)`/`all_player_bundles(comp_id, ctx)`: una pasada por la competencia (para T-01); cada uno es `sum_bundles` de sus partidos.

### 4.6 `lineups.py`
- `_agg(evs, team_code)`: agrega dos claves: `pf` = eventos `foul` del equipo con `sub_type` fuera de `{benchTechnical, coachTechnical}` y `fouls_drawn` = eventos `foulon` del equipo. `_BOX_KEYS` suma ambas. Ningún consumidor legado cambia (`_side_metrics` y `lineup_stats` eligen claves).
- `lineup_bundle(games, team_code, player_names, *, entity_id, name) -> StatBundle | None`: misma selección de partidos y tramos que `lineup_stats` (se extrae la parte común a un helper `_lineup_boxes(games, team_code, players)` que usan ambas funciones;
  salida de `lineup_stats` idéntica). `own = suma de _agg(evs, team)`, `opp = suma de _agg(evs, opp_code)`, `opp.blk_received`/`own.blk_received` se completan con `blk` del rival; `own.fouls_drawn` = `foulon` propio; `plus_minus = pts − pts_against`;
  `seconds = Σ seconds de los tramos`, `minutes = seconds/60`, `games` = partidos con ≥ 1 tramo coincidente, `meta.games_excluded = {"sin_titulares": n}` (partidos con `game_starters(...) is None`) y `meta.games_total`.
  Devuelve `None` si ningún partido del equipo tiene pbp (el endpoint responde 404 `sin_pbp`).
- `onoff_bundles(games, team_code, player_name, *, entity_id, name) -> tuple[StatBundle, StatBundle] | None`: misma partición que `onoff_stats` (ON/OFF por tramo); cada estado es un bundle `entity_type="onoff"` con su `seconds`, `games` = partidos donde el estado tuvo `seconds > 0`.
- `player_on_court(pbp_game, team_code, player_name) -> dict | None`: `starters = game_starters(...)`; `None` si no hay pbp o titulares inválidos; si no, `segments = build_segments(...)` y suma `_agg` propio/rival de los tramos con `player_name in on_court`, y `seconds`.
  Devuelve `{"own", "opp", "seconds"}`; `bundles.py` lo transforma en el `on_court` del bundle.
- Sin cambios en `build_segments`, `PERIOD_LEN` ni en la salida de `lineup_stats`/`onoff_stats`.

### 4.7 `clutch.py`
`clutch_bundle(games, team_code, team_name, margin, window_secs) -> StatBundle | None`: reutiliza la selección de partidos calificados de `team_clutch` (se extrae a un helper `_qualified_games(games, team_code, margin, window_secs)` que ambas usan; la salida de `team_clutch` no cambia).
`own`/`opp` salen de `lineups._agg` sobre los eventos del cierre (incluye `pf` y `fouls_drawn`); `blk_received` = `opp.blk`; `plus_minus = pts − pts_against`; `games = games_qualified`; `seconds = Σ (window_secs + 300·prórrogas del partido)`; `meta` = `{margin, window_secs, games_excluded: {"paliza": n, "sin_pbp": m}}`.
`margin`/`window_secs` por defecto: `DEFAULT_MARGIN`/`DEFAULT_WINDOW_SECS` (F-13 los reemplaza por `clutch.margin`/`clutch.window_secs` sin tocar este código). Un partido sin eventos de cierre de ambos equipos no cuenta (igual que el legado).

### 4.8 `metrics_catalog.build_payload(entity_type, args)` — orquestación (usada por el endpoint y por `standard`)
```
1. reg = _REGISTRY[entity_type] o MetricsError(400, "Tipo de entidad desconocido", parametro_invalido)
2. id = args["id"] o MetricsError(400, "Falta el parámetro id")
3. base = args.get("base") or "partido"; si base ∉ {"total","partido","por40","por100"} → 400; por40/por100 → apply_base lanza ValueError → 400 "Base no disponible…"
4. ctx = context.parse_context(args, team_code=…, player_id=…)            # C-02; ContextError/CompetitionError → 400
5. req = EntityRequest(entity_type, id, ctx.competition_id, ctx, base, params={margin, window_secs}); bundles = reg.loader(req)
   [] → MetricsError(404, "Entidad no encontrada", no_encontrado); lineup/onoff/clutch con None → 404 sin_pbp
6. por bundle: values = compute_standard(b); values = apply_base(values, b, base)
7. # ENGANCHE T-02: badge de muestra y ajustados  (sample.sample_for / sample.adjust_values)
8. # ENGANCHE T-01: fichas (population.attach_fichas)
9. payload = standard_payload(b0, values0, context_echo=context.context_echo(ctx, games_used=b0.games, games_total=b0.meta["games_total"], games_excluded=b0.meta["games_excluded"], ignored=[]), base=base, sample=None, fichas=None)
10. onoff: payload["states"] = {on: {...}, off: {...}}; payload["diff"] = {k: on−off para kind == "rate" con ambos no nulos}; jugador: payload["coverage"]
```
`standard_payload` ordena `groups` según `GROUPS` y garantiza que **todas** las claves de `METRICS` estén en `metrics` (las faltantes `{"value": None, "reason": "no_aplica"}`); `fichas` (T-01) se fusiona en cada objeto de métrica. `load_game_bundles(req)` expone el `game_loader`.
`catalog_json(lang="es")`: serializa `GROUPS`/`METRICS` y aplica `config.get("ui.metric_labels")` a las etiquetas.

### 4.9 `fiba_fetcher.py`, `ingest.py`, `database.py`, `data_quality.py`
- Parser (`_parse_fiba_json`): en `team_row`: `"blk_received": ti(["BlocksReceived"], default=None)`, `"fouls_drawn": ti(["FoulsOn"], default=None)`; en `player_row`: `"blk_received": _i(p, ["sBlocksReceived"], default=None)`, `"fouls_drawn": _i(p, ["sFoulsOn"], default=None)`. Un 0 informado por FIBA queda 0.
- `ingest.persist_game`: agrega las cuatro claves a `team_cols`/`player_cols`; `INGEST_VERSION = 3` con el comentario de versiones actualizado.
- `database.py`: `blk_received`/`fouls_drawn` en ambos modelos (`db.Column(db.Integer)`, sin default) y las 4 entradas de `new_cols`.
- `data_quality.NULL_FIELDS`: 4 entradas nuevas (§3.5).

### 4.10 `app.py` (rutas finas)
`GET /api/metrics-catalog` → `jsonify(metrics_catalog.catalog_json())`. `GET /api/metrics/<entity_type>` → `build_payload(entity_type, request.args)`; `MetricsError`/`ValueError` → `jsonify({"error", "code"}), status`.
`team_stats` y `player_stats` (y la ruta por id de C-08) agregan `result["standard"] = _standard_block("team"|"player", id)`, que llama a `build_payload` con `request.args` y captura `MetricsError` → `None`.

### 4.11 Casos borde y rendimiento
Selección vacía → `sin_datos`. Equipo con un solo partido: todo calculable. Jugador con todos los partidos DNP: 404 en `/api/metrics/player` ("Entidad no encontrada" si nunca jugó) o `sin_datos` si la selección filtrada queda vacía. Quinteto de 3 jugadores o 5: mismo conjunto.
Partido con prórroga: `minutes = 45`, `pace` usa 45; los tramos suman 2.700 s. Costo: equipo/cierre/quinteto/ON-OFF = una pasada sobre los partidos de un equipo (≈ 2–5 ms por partido en el seed); jugador = una pasada de segmentos por partido jugado. Sin caché en T-05 (T-01 cachea poblaciones).

## 5. Frontend — capa API (`api.js`)
- `api.metricsCatalog()` → `GET /api/metrics-catalog` (mismo `apiFetch`, `credentials: "same-origin"`).
- `api.metrics(type, params)` → `GET /api/metrics/${encodeURIComponent(type)}${qs(params)}` (`qs` ya existe localmente en `api.js` y omite `""`/`null`; se exporta si hace falta fuera).
Ninguna función de render llama `fetch` (regla 9).

## 6. Frontend — UI
Ubicación en fase 1 (antes de X-01): las cinco vistas actuales; X-01 las reubica sin cambiar los componentes (Equipo → pestaña `resumen`/`quintetos`/`momentos`; Jugador → `resumen`).

**`core/catalog.js` (NUEVO)**: `loadCatalog()` (una sola petición por carga de página, `Promise` memorizada; copia en `sessionStorage` envuelta en `try/catch` para uso offline), `metricDef(key)`, `metricLabel(key)`, `groupsFor(entityType)`
(grupos con sus definiciones, filtrando por `entities`), `stdKeyFor(legacyKey)` (mapa inverso de `legacy_keys`, usado por T-01 para reemplazar `statBox`).

**`core/format.js` (C-11, extensión)**: `fmtMetric(key, value)` según `fmt` del catálogo: `pct` → `PCT`, `dec1` → `DEC1`, `dec2` → `DEC2`, `int` → `fmtNumber(v, 0)`, `signed_int`/`signed_dec2` → signo explícito ("+" o "−") + número; nulo → `"—"`.
`NULL_REASON_LABELS` suma `sin_datos`, `sin_pbp`, `no_aplica`, `no_disponible` (textos de spec §6). Importa `metricDef` de `catalog.js` (sin ciclo: `catalog.js` solo importa `api.js`).

**`components/standard-panel.js` (NUEVO)**: `renderStandardPanel(el, payload, {compact=false, layout="grid", base, onBaseChange})`.
- Estados: `payload === null` → spinner "Calculando métricas…"; payload con `games === 0` → "Sin partidos en la selección. Cambiá el filtro de competencia o de períodos."; error → texto del error en `.below-avg`.
- Cabecera: selector de dos botones "Totales | Por partido" (`.seg-toggle`, `aria-pressed`) que llama `onBaseChange(base)`; línea de contexto con `payload.context.label` y `games_used`/`games_total`; en jugador, aviso si `coverage.on_court_games_exact < coverage.games`.
- Cuerpo `layout="grid"`: un `<details class="std-group" open>` por grupo (el grupo "Otras métricas" cerrado); dentro, `.stat-grid.std-grid` con una `.stat-box.std-cell` por métrica: etiqueta (`metricLabel`), valor `fmtMetric` o `nullDisplay(reason)`, marcas "est." / "parcial" con `title`.
- Cuerpo `layout="compare"` (ON/OFF): tabla por grupo `Métrica | ON | OFF | Δ`; Δ solo en métricas `kind = rate` (con signo; sin color de rendimiento en esta fase, ver T-01).
- Puntos de extensión documentados: `cellHTML(key, metricObj, ctx)` (T-01 lo cambia por `metricCard`; T-02 agrega el estilo gris y el crudo/ajustado) y el slot `.std-head-extra` (T-02: `sampleBadge`). `compact` muestra solo los grupos volumen, producción, tiro — porcentajes y balón (uso en tarjetas angostas).
- Mobile (< 768 px): `.std-grid` de 2 columnas, `details` apilados, toggle a ancho completo, fuentes ≥ 11 px; sin scroll horizontal de página; la tabla `compare` usa `.table-wrap` con scroll interno.

**`app.js`**:
- *Equipo* (`_renderTeamContent`/`renderTeam`): nueva card "Conjunto estándar" al final (antes del game log) que llama `api.metrics("team", {id, competition, last, base})` con un contador de petición para descartar respuestas viejas; se conservan las cards actuales (T-01 las migra a la ficha).
- *Jugador* (`_renderPlayerContent`): ídem con `api.metrics("player", {id: player_id, …})`.
- *Combinación* (`renderTeamLineup`): se retiran las 5 `statBox`, la tabla de 18 columnas y `smallSample`; se monta `renderStandardPanel` con `api.metrics("lineup", {id: `${team}:${ids.sort((a,b)=>a-b).join("-")}`, competition, last})` y se conserva la franja de líderes y el recuento de partidos usados/excluidos de `api.lineup(...)`.
  Las alertas de muestra chica pasan a T-02 (badge); mientras tanto el aviso `r.sample.possessions < 10` se conserva tal cual.
- *ON/OFF* (`renderTeamOnOff`): se reemplazan las dos tablas por `renderStandardPanel(..., {layout: "compare"})` con `api.metrics("onoff", {id: `${team}:${player_id}`, …})`; se conserva la línea de muestra y el USO% del título.
- *Cierres* (`renderTeamClutch`): se reemplazan las dos `stat-grid` del agregado por el panel (`api.metrics("clutch", {id: team, competition, margin, window_secs})`); título, recuento y tabla por partido no cambian.
- Los ids de jugador salen de los `<select>`/checkboxes que C-08 migra a `player_id`; si C-08 no los migró, se resuelve el nombre con `api.players(team)` (que devuelve `player_id`).
- Estados de carga/vacío/error/offline: los de §6 del spec; sin conexión → el mensaje de red existente (no hay `/api/*` en el caché del service worker).

## 7. Navegación
Sin vistas ni hashes nuevos. `docs/frontend.md` agrega los dos módulos y el copy nuevo. En fase 2 X-01 ubica el panel en S3/S4 sin cambios en el componente.

## 8. Contratos de datos
- Request/response de §3 (shape = Arq. §7.3 + `coverage`, `states`, `diff`, `estimated`, `partial` PROPUESTA).
- Valor nulo con razón: `{"value": null, "reason": "<código>"}` con los códigos de spec RF-3; `no_disponible` es PROPUESTA (no está en la lista de §7.4).
- Filas SQLAlchemy: las cuatro columnas de §3.1; `GET /api/games` ya trae `needs_reprocess` (F-11).
- `StatBundle`: contrato interno de §4.1 (el que consumen T-02, T-01, T-06, F-06).

## 9. Manejo de errores y offline
Mapeo de §3.3. `api.js` muestra `err.error`. Offline: `/api/*` va siempre a red (`sw.js` no los intercepta), el panel muestra "No se pudo cargar…" con el mensaje del `fetch`. `sw.js`: dos archivos nuevos en `STATIC` y `CACHE` +1 (el número lo asigna quien integra;
actual `smart-basket-v13`). Archivos antiguos del caché se limpian en `activate`.

## 10. Riesgos y decisiones

**Dependencias técnicas**
- C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)): `core/format.js` (`nullDisplay`, `NULL_REASON_LABELS`), `stats_engine.null_reason(s)`, `played()`.
- F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)): `ingest.persist_game`/`INGEST_VERSION`/`reprocess_games`, `game_sources`, `data_quality.NULL_FIELDS`, `competitions.visible/resolve`, `games.minutes`, `lineups.PERIOD_LEN` con `OVERTIME`.
- C-08 ([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md)): `identity.player_card`, `identity.canonicalize_pbp_games`, `player_game_stats.player_id`.
- C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md)): `context.parse_context`, `context.filter_games`, `context.context_echo`; `/api/team` y `/api/player` aceptan `competition` y `last`.
- C-01/C-04/C-07: sus fórmulas ya están en `stats_engine` y se reproducen en `compute_standard`; `compute_standard` y los `averages` de C-02 deben coincidir en las claves compartidas (excepto las de DA-03/04/05/06, ver §10 D-2).
- F-13 ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md)): `config.get("ui.metric_labels")` y el estado `activa` de esa clave; si `config.py` no existe aún, `catalog_json` usa `{}`.
- F-11 `repository` y `cache`: ver D-3.

**Decisiones / desviaciones**
- D-1 · **Tapones y faltas recibidas sin `previous_action`.** La arquitectura (§2.3) marca el tapón recibido del quinteto como "col-v2 `previous_action`". No hace falta: cada evento `block` del rival es un tapón recibido (26/26 contra `tot_sBlocksReceived`) y `foulon` del equipo es una falta recibida (26/26). Se evita una columna de pbp.
- D-2 · **Conciliación visible (R-04).** Cambian de definición, en el bloque `standard` (no en el legado): `ppt` (DA-03), `to_pct` de equipo/quinteto (DA-04), `uso_pct` (DA-05), `as_pct` de jugador (DA-06), DER/Net/OER de jugador (DA-34) y toda tasa agregada (pooled, DA-02). Los campos legado
  (`pps`, `to_pct` por partido, `uso_pct` legado, `as_pct` legado) siguen devolviendo lo de antes (CA-15). Se registra una tabla antes/después en `progress.md` y se actualiza `docs/metrics.md`.
- D-3 · **`repository.py` y `cache.py` no existen hoy** (F-11 los difirió: `00-decisiones.md`, "F-11 alcance"). T-05 no necesita `cache`. Para leer filas necesita `repository.competition_games/team_game_rows/player_game_rows/team_pbp_games` (Arq. §3.14). Si C-02 no los creó, el Grupo A los crea con esas firmas (envolviendo las consultas actuales
  de `app.py`: `_team_game_ids`, `_team_pbp_games`) y C-02/F-13 los reutilizan; no se inventa un tercer acceso. Reportado en `huecos_arquitectura`.
- D-4 · **Módulo `bundles.py` (PROPUESTA).** La arquitectura reparte los cargadores entre `lineups`/`clutch`/`possessions`/`matchups` pero no dice dónde viven los de equipo y jugador. Se crea `bundles.py` para no mezclar acceso a datos con las fórmulas de `stats_engine`.
- D-5 · **`sum_bundles`, `load_game_bundles`, `register_entity(game_loader, enumerator)`, `EntityRequest.params`, `StatBundle.derived/meta`, `states`/`diff`/`coverage`** son PROPUESTA (T-06 y T-01 las piden; ver sus planes).
- D-6 · **Sin fallback `opp_pf`** para faltas recibidas de equipo (desacuerdo con Arq. §2.3 "fallback equipo: `opp_pf`"): no son la misma cantidad; se prefiere nulo `no_registrado`.
- D-7 · **Nuevo código de nulo `no_disponible`** (PROPUESTA sobre §7.4) para `paint_fga_share`/`mid_fga_share` hasta C-03.
- D-8 · **Dependencia de C-08** no listada en Arq. §9.1 para T-05 (desacuerdo menor; el orden de fases la cumple).
- Riesgo: **reproceso obligatorio**. Subir `INGEST_VERSION` marca todos los partidos pendientes; hasta reprocesar, `blk_received`/`fouls_drawn` de equipo y jugador salen nulos (a propósito). El reproceso desde archivo no depende de FIBA (F-11: 13 partidos en < 20 s).
- Riesgo: **dos agregaciones pooled** (`aggregate_games` de C-02 y `compute_standard`). Mitigación: verificación T-F4 compara claves compartidas; unificarlas (que `aggregate_games` llame a `compute_standard`) queda como deuda anotada, no se hace aquí.
- Riesgo: **volumen de UI** (83 métricas por entidad). Mitigación: `details` plegables, "Otras métricas" cerrado, `compact`, y la tabla completa llega con T-06.
- Riesgo: **jugador sin pbp** produce resultados mixtos (exacto/estimado/parcial); se rotula siempre y nunca se promedia silenciosamente.

**Incrementos diferidos**: percentil/badge/ajustado por métrica (→ T-01/T-02); bases por 40/100 (→ T-04); reparto por zona (→ C-03); tablas (→ T-06); adopción del conjunto por pareja, emparejamiento, cuarto, split, origen, tipo, oportunidad, tramo de reloj, zona y cadena (→ A-08, F-07, F-04, T-03, A-02, A-03, A-04, A-05, C-03, A-07).

**Estimación: XL · 28–38 h** (datos y reproceso 4 h · stats_engine/catálogo 7–9 h · bundles/lineups/clutch 6–8 h · endpoints y payload 3 h · frontend 6–8 h · verificación y docs 4–6 h).
