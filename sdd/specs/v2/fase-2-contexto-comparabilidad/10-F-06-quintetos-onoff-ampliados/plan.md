# Plan — F-06: Combinaciones y ON/OFF ampliados

> **ID:** F-06 · **Prioridad:** P1 · **Fase y orden:** 2·10
> **Depende de:** T-05 · T-02 · T-01 · T-06 · C-06 · F-13 (rutas relativas en spec.md §0/§2)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** spec.md de este mismo requisito · Arquitectura §2.1, §2.3, §3.2, §3.5–§3.7, §3.10, §3.11, §3.12, §6, §7
> **Estimación:** XL · 22–32 h

## 1. Enfoque
Migrar `lineups.py` para que arme `StatBundle` (conteos crudos por quinteto/combinación/ON-OFF) y delegue el cálculo de
métricas en `stats_engine.compute_standard` (T-05), en lugar de sus fórmulas locales (`_metrics`, `_side_metrics`). Agregar
`all_lineups()` (todos los quintetos de 5 que el equipo usó), `lineup_clutch()` (récord y métricas del tramo de cierre por
quinteto, reusando `clutch.py` con `clutch.margin`/`clutch.window_secs` de configuración) y `lineup_leaders()` (7 categorías).
Registrar dos tablas T-06 (`team_lineups`, `team_onoff`) y una tercera de cierres por quinteto. Migrar `renderTeamLineup` y
`renderTeamOnOff` de `app.js` a la pestaña `quintetos` de S3, con los tres bloques del cliente (Ataque/Defensa/Avanzado) más
el panel completo T-05, la tabla T-06 y las tarjetas de líderes. Todo sobre `player_id` (C-08) desde el día 1 cuando esté
disponible; hasta entonces (si F-06 se implementa antes de que C-08 cierre en la integración real) los endpoints legado por
nombre siguen funcionando sin cambios.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/lineups.py` (mod.) | service | `all_lineups()`, `lineup_clutch()`, `player_on_court()`; `_side_metrics`/`_metrics` quedan como fachada de compatibilidad hasta que T-05 migre sus últimos consumidores; nuevas funciones arman `StatBundle` y llaman `stats_engine.compute_standard` | RF-1, RF-2, RF-9, RF-10, RF-22 |
| `backend/lineup_leaders.py` (NUEVO) | service | `leaders_report(team_code, comp_id, ctx) -> dict` (7 categorías × top 3) | RF-16..RF-19 |
| `backend/clutch.py` (mod., si F-13/C-06 aún no expusieron el parámetro) | service | ventana de cierre parametrizada desde config (ya cubierto por C-06/F-13; F-06 solo consume) | RF-13..RF-15 |
| `backend/app.py` (mod.) | route | `GET /api/lineup-leaders/<team_code>`; `GET /api/table/team_lineup_clutch` (registro); rutas legado sin cambio de shape | RF-13..RF-19 |
| `backend/tables.py` (mod., de T-06) | registro | `register_table("team_lineups", ...)`, `register_table("team_onoff", ...)`, `register_table("team_lineup_clutch", ...)` | RF-3, RF-4, RF-12, RF-14 |
| `backend/metrics_catalog.py` (mod., de T-05) | registro | `register_entity("lineup", loader)`, `register_entity("onoff", loader)` si T-05 no los cerró aún | RF-1, RF-9, RF-10 |
| `frontend/js/api.js` (mod.) | api | `api.lineupLeaders(team, params)`, `api.table("team_lineups", params)`, `api.table("team_onoff", params)`, `api.table("team_lineup_clutch", params)`, `api.metrics("lineup", params)`, `api.metrics("onoff", params)` | RF-3, RF-9, RF-10, RF-16 |
| `frontend/js/views/equipo.js` (X-01) o `app.js` si X-01 no está integrado aún | js-view | pestaña `quintetos`: tarjetas de líderes, tabla de todos los quintetos, selector de combinación (3–5), tabla ON/OFF del plantel, tabla de cierres por quinteto | RF-2, RF-3, RF-9..RF-19 |
| `frontend/js/components/standard-panel.js`, `metric-card.js`, `sample-badge.js`, `data-table.js`, `export-menu.js` (de T-05/T-01/T-02/T-06) | components | reusados sin modificar | RF-1, RF-4, RF-5, RF-7 |
| `frontend/js/components/lineup-leader-card.js` (NUEVO) | component | `renderLeaderCard(el, category, payload)` | RF-16..RF-18 |
| `frontend/css/style.css` (mod.) | css | sección `/* ── lineup-leader-card (F-06) ── */` (grid de 7 tarjetas, badge gris de muestra baja) | RF-16 |
| `frontend/sw.js` (mod.) | cache | agrega los módulos nuevos a `STATIC` (si X-01 aún no migró a runtime caching) y sube `CACHE` | — |
| `docs/api.md`, `docs/architecture.md`, `docs/frontend.md`, `docs/metrics.md` | doc | endpoints y tablas nuevas, apartado Quintetos ampliado, fórmulas de cierre por quinteto | — (cierre) |

Matriz RF → archivo: RF-1/RF-2 → `lineups.py`+`metrics_catalog.py`; RF-3/RF-4/RF-12/RF-14 → `tables.py`+`data-table.js`;
RF-5/RF-6/RF-7 → `sample.py` (T-02, consumido)+`population.py` (T-01, consumido); RF-8 → `data-table.js` (link de fila);
RF-9 → `lineups.py` (`lineup_stats` existente, ahora delega en `compute_standard`); RF-10/RF-11 → `lineups.onoff_stats` (mod.);
RF-13..RF-15 → `lineup_leaders.py`+`lineups.lineup_clutch`+`clutch.py`; RF-16..RF-19 → `lineup_leaders.py`+`lineup-leader-card.js`;
RF-20 → `context.py` (T-03, consumido; en fase 2 sin T-03 aún completo, se pasa `{competition, last}` explícito); RF-21 →
`lineups.build_segments`+`data_quality.py` (F-11, consumido); RF-22 → `identity.py` (C-08, consumido); RF-23 → `stats_engine.py`
(sentinels, C-11, consumido).

## 3. Backend — rutas y modelos

### Endpoints
- `GET /api/metrics/lineup?id=<team>:<pid>-<pid>-...&competition=<id>&last=<n>&base=<b>` — de T-05, F-06 es quien registra el
  tipo de entidad `lineup` con su loader (`all_lineups` filtrado a un id) y provee `StatBundle`. Response: shape §7.3 del
  documento de arquitectura + fichas §7.1 (T-01) + `adj`/`sample` (T-02). Errores: 400 `{"error": "Id de quinteto inválido",
  "code": "parametro_invalido"}` si el id no matchea `<team_code>:<pid>-...`; 404 `{"error": "Quinteto no encontrado",
  "code": "no_encontrado"}` si el equipo no usó esa combinación.
- `GET /api/metrics/onoff?id=<team>:<pid>&competition=<id>&last=<n>&base=<b>` — devuelve el estado ON del jugador con el
  conjunto estándar; el frontend pide también `state=off` para el estado OFF y compone el `diff` en el cliente restando
  valor por valor (evita duplicar `compute_standard` con signo invertido en el backend). PROPUESTA (no está en
  00-arquitectura-transversal.md): el parámetro `state` no está fijado por T-05; se documenta acá y se agrega al catálogo de
  endpoints al cerrar F-06.
- `GET /api/table/team_lineups?team=<code>&competition=<id>&last=<n>&base=<b>` — tabla T-06 con todas las combinaciones de 5
  del equipo. Response: shape §7.6. Errores: 404 `{"error": "Equipo no encontrado", "code": "no_encontrado"}`.
- `GET /api/table/team_onoff?team=<code>&state=on|off|diff&competition=<id>&last=<n>&base=<b>` — una fila por jugador del
  plantel (ids C-08). `state` PROPUESTA (no está en la arquitectura): default `diff`.
- `GET /api/table/team_lineup_clutch?team=<code>&competition=<id>` — cierres por quinteto. PROPUESTA (no está en la
  arquitectura): id de tabla no listado en el catálogo §6; se agrega al registro central al integrar.
- `GET /api/lineup-leaders/<team_code>?competition=<id>&last=<n>` — PROPUESTA (no está en la arquitectura). Response:
  ```json
  {
    "team_code": "CNF",
    "categories": [
      {"key": "impacto", "label": "Impacto",
       "criteria": [
         {"metric": "net_rating", "label": "Net Rating ajustado", "adjusted": true, "direction": "higher",
          "items": [
            {"rank": 1, "lineup_id": "CNF:12-15-18-21-30", "names": ["Prieto","Oglivie","Feldeine","Canty","Rodríguez"],
             "value": 0.121, "adj": {"value": 0.09, "band": 0.18}, "percentile": 88,
             "rank_ficha": 2, "rank_total": 14, "dist_leader": -0.02, "dist_avg": 0.06,
             "sample": {"level": "media", "n": 34.0, "unit": "posesiones"}}
          ]}
       ]}
    ],
    "context": "...", "thresholds": {"min_poss": 15.0, "min_poss_source": "relativo"}
  }
  ```
  Errores: 200 con `categories: []` y `"empty_reason": "sin_quintetos_sobre_umbral"` si ningún quinteto supera el mínimo (no
  es un error HTTP: la spec exige mostrar el estado vacío explicado, no una falla).

### Tablas/columnas
Sin cambios de esquema (F-06 no está en la lista de `§5 Cambios de esquema previstos` de la arquitectura).

## 4. Backend — lógica

```
# backend/lineups.py (extiende)
def all_lineups(team_code: str, comp_id: int, ctx: Context, *, size: int = 5) -> list[StatBundle]:
    """
    1. repository.team_pbp_games(team_code, comp_id) -> juegos con pbp filtrados por ctx (competencia, last).
    2. Para cada partido con 5 titulares (game_starters): build_segments(events, team_code, starters).
    3. Agrupar TODOS los tramos por on_court (frozenset de nombres/ids) sin filtrar por un quinteto elegido
       (a diferencia de lineup_stats, que filtra por `players <= s["on_court"]` de una combinación pedida):
       lineups_by_combo: dict[frozenset, list[segment]].
    4. Para size=5: solo combos con len(on_court) == 5 (tramos con 3/4 en cancha por sustitución simultánea mal
       resuelta se excluyen y se cuentan para data_quality.lineup_inconsistencies, RF-21).
    5. Para cada combo: agg_own = _agg(eventos de sus tramos, team_code); agg_opp = _agg(eventos, opp_code);
       seconds = sum(seconds de sus tramos); possessions = _pos(agg_own).
    6. Arma StatBundle(entity_type="lineup", entity_id=f"{team_code}:{'-'.join(sorted(pids))}",
       name=" · ".join(display_names), own=agg_own, opp=agg_opp, games=len(partidos con ese combo),
       minutes=None, seconds=seconds, on_court=None, shots=None, possessions_counted=None, null_reasons={}).
    7. Devuelve list[StatBundle], una por combo distinto usado.
    """

def lineup_clutch(team_code: str, comp_id: int, ctx: Context) -> list[dict]:
    """
    1. clutch_games = clutch.qualifying_games(team_code, comp_id, ctx) (de C-06: partidos con ventana de cierre
       válida, margin/window_secs leídos de config).
    2. Para cada partido calificado: build_segments(events, team_code, starters); intersectar los tramos con la
       ventana de cierre [window_secs, 0] del último período regular + prórrogas (mismo criterio de PERIOD_TYPES
       que clutch._is_clutch, ya corregido por F-11/C-06 para OVERTIME).
    3. Acumular por quinteto (frozenset de 5): posesiones_del_tramo, segundos_del_tramo, pts_for/pts_against del
       tramo, resultado del partido completo (W/L del equipo, no del tramo).
    4. Un partido cuenta para el récord de un quinteto si posesiones_del_tramo >= sample.clutch_lineup.min_poss.
       V += 1 si el equipo ganó ese partido, D += 1 si perdió (empate no aplica en basket).
    5. sample.sample_level("clutch_lineup", n=partidos_contados, unit="partidos", games=partidos_contados) (T-02):
       nivel "alta" si partidos_contados >= sample.clutch_lineup.high_games, si no "baja" (sin nivel "media", según
       arquitectura §3.7 caso especial clutch_lineup).
    6. Net Rating del tramo con sample.adjusted(..., entity_type="clutch_lineup") (K = regression.clutch_lineup.k).
    7. Devuelve lista de dicts {lineup_id, names, record: "V-D", win_pct, games_qualified, diff_tramo:
       {pts_for, pts_against, diff}, standard: dict del conjunto T-05 del tramo, adj, sample}.
    """
```

```
# backend/lineup_leaders.py (NUEVO)
CATEGORIES = [
  {"key": "impacto", "label": "Impacto", "criteria": [
      ("net_rating", "Net Rating ajustado", True), ("oer", "OER", False), ("der", "DER", False)]},
  {"key": "tiro", "label": "Tiro", "criteria": [
      ("efg_pct", "eFG%", False), ("ts_pct", "TS%", False), ("ppt", "PPT", False)]},
  {"key": "rebote", "label": "Rebote", "criteria": [
      ("or_pct", "OR%", False), ("dr_pct", "DR%", False), ("trb_pct", "REB%", False), ("trb", "Rebotes totales", False)]},
  {"key": "cuidado_balon", "label": "Cuidado del balón", "criteria": [
      ("to_pct", "TO%", False), ("ast_to", "AS/PER", False)]},
  {"key": "ritmo", "label": "Ritmo", "criteria": [("pace", "PACE", False)]},
  {"key": "cierres", "label": "Cierres", "criteria": [
      ("net_rating_clutch", "Net Rating ajustado (cierre)", True), ("win_pct_clutch", "% victorias en cierres", False)]},
  {"key": "volumen", "label": "Volumen", "criteria": [("minutes", "Minutos", False), ("possessions", "Posesiones", False)]},
]

def leaders_report(team_code: str, comp_id: int, ctx: Context, *, top_n: int = 3) -> dict:
    """
    1. bundles = lineups.all_lineups(team_code, comp_id, ctx)
    2. values = {b.entity_id: stats_engine.compute_standard(b) for b in bundles}  # T-05
    3. sample_of = {id: sample.sample_level("lineup", n=posesiones, unit="posesiones",
                    team_poss=posesiones_ofensivas_del_equipo_en_comp) for id, b in ...}  # T-02
    4. eligible = [id for id, s in sample_of.items() if sample.is_ranked(s)]  # excluye 'baja'
    5. Para "cierres": eligible_clutch = ids con partidos_contados >= sample.clutch_lineup.high_games
       (lineup_clutch ya calculado aparte, join por lineup_id).
    6. Para cada categoría → criterio: ordenar `eligible` (o `eligible_clutch`) por valor ajustado si
       (net_rating|oer|der|net_rating_clutch) si no por valor crudo, dirección `higher`/`lower`; top_n.
    7. Para cada item: population.ficha(metric_key, value, id, poblacion_de_la_competencia) (T-01) para
       percentile/rank/dist_leader/dist_avg; sample.sample_badge (T-02).
    8. Si `eligible` está vacío para toda categoría: {"categories": [], "empty_reason": "sin_quintetos_sobre_umbral"}.
    """
```

Manejo de nulos (C-11): un quinteto sin intentos de TL → `ft_pct` nulo `sin_intentos` (heredado de `compute_standard`); un
estado OFF sin posesiones → todas sus métricas `null` (heredado de `_side_metrics`, ahora vía `StatBundle` vacío);
`lineup_clutch` sin partidos calificados → lista vacía, no error. Caché: `cache.memo("lineups:<team>", (comp_id, ctx_key),
fn)` (namespace fijado en arquitectura §3.14).

## 5. Frontend — capa API (api.js)
```js
api.metrics = (entityType, params) => apiFetch(`/api/metrics/${entityType}${qs(params)}`);           // T-05
api.table   = (tableId, params)   => apiFetch(`/api/table/${tableId}${qs(params)}`);                  // T-06
api.ranking = (entityType, metric, params) => apiFetch(`/api/rankings/${entityType}/${metric}${qs(params)}`); // T-01
api.lineupLeaders = (team, params) => apiFetch(`/api/lineup-leaders/${team}${qs(params)}`);            // F-06
```
`qs()` es de T-05 (arma query string omitiendo `null`/`undefined`/`""`); F-06 no la crea, la reusa.

## 6. Frontend — UI
Pestaña `quintetos` de S3 (`#/equipo/<code>/quintetos`; en fase 2, si X-01 aún no integró el router, vive como sección
propia dentro de `renderTeam`, igual que hoy `renderTeamLineup`/`renderTeamOnOff`, y se reubica sin cambiar sus funciones
cuando X-01 cierre — arquitectura §3.12 "en fase 1 antes de X-01"; F-06 es fase 2 así que en el caso normal X-01 ya está
resuelto y esta pestaña se registra directamente con `router.registerTab`).

Orden de bloques (arriba→abajo, según lectura rápida→dato del cliente):
1. **Tarjetas de líderes** (`components/lineup-leader-card.js`, grid de 7, 2 columnas en mobile <768px, 1 fila de 7 en
   desktop con scroll horizontal si no entran): loading = skeleton; vacío = mensaje de RF-16 con el umbral leído de config;
   éxito = tarjeta con 5 nombres, valor, ajustado±banda, `metric-card.js` embebido compacto, `sample-badge.js`, clic → ancla
   a la fila de la tabla completa (`data-table.js` expone `scrollToRow(id)`).
2. **Selector de combinación personalizada** (checkboxes de 3–5 jugadores, mismo `#team-lineup-picker` reutilizado) →
   `standard-panel.js` con los tres bloques Ataque/Defensa/Avanzado como agrupación visual encima del panel completo
   agrupado por T-05 (`groups` del payload).
3. **Tabla de todos los quintetos** (`data-table.js` con `payload` de `api.table("team_lineups", ...)`, `export-menu.js`).
4. **Tabla ON/OFF del plantel** con selector ON/OFF/Diferencia (`<select>` que refetchea `state`).
5. **Cierres por quinteto** (`data-table.js` sobre `team_lineup_clutch`, columna adicional "Récord" no numérica con
   `type: "text"` que muestra "2-1 (67%)").

Componentes compartidos reusados: `standard-panel.js`, `metric-card.js`, `sample-badge.js`, `data-table.js`,
`export-menu.js`, `exporters.js`, `base-selector.js` (T-04), `context-bar.js`/`quick-filters.js` (T-03, en fase 2 solo
competencia/last si T-03 no cerró todavía todas sus dimensiones). Estados loading/vacío/error/offline/éxito: tabla §6 de
spec.md. Mobile 768px: tarjetas en columna única de a 2; tabla con scroll horizontal y columna `_name` sticky
(`data-table.js` ya lo resuelve, T-06).

## 7. Navegación
Pestaña `quintetos` dentro de S3 `equipo` (registrada en `core/router.js` por X-01; F-06 llama
`router.registerTab("equipo", {slug: "quintetos", label: "Quintetos", enabled: true, render: renderQuintetosTab})`).
Deep link: `#/equipo/CNF/quintetos?lineup=CNF:12-15-18-21-30` resalta esa fila al cargar (RF-8, RF-11 de CA-11).

## 8. Contratos de datos
Shapes: `/api/metrics/lineup` y `/api/metrics/onoff` → §7.3 de la arquitectura (idéntico shape que `/api/metrics/player`,
CA-2). `/api/table/team_lineups`, `/api/table/team_onoff`, `/api/table/team_lineup_clutch` → §7.6. `/api/lineup-leaders/<team>`
→ shape propio arriba (§3 de este plan), marcado PROPUESTA.

## 9. Manejo de errores y offline
| Código | Caso | Mensaje es |
|---|---|---|
| 400 | id de quinteto mal formado | "Id de quinteto inválido" |
| 400 | selector con 2 o 6 jugadores | "Elegí entre 3 y 5 jugadores" (copy existente, Feature 03) |
| 404 | equipo sin pbp / combinación nunca usada | "Equipo no encontrado o sin play-by-play" (existente) / "Este equipo no tiene play-by-play importado. Reimportá sus partidos." |
| 404 | jugador sin datos ON/OFF | "Sin datos ON/OFF para este jugador" (existente) |
| 502/504 | timeout de cálculo (poblaciones grandes) | toast genérico + reintento manual |

`sw.js`: si X-01 todavía no migró a runtime caching (arquitectura §3.13), F-06 agrega sus módulos nuevos
(`lineup-leader-card.js`) a `STATIC[]` y sube `CACHE` en 1. `/api/*` sigue yendo siempre a red.

## 10. Riesgos y decisiones
- **Riesgo:** `all_lineups` sobre un equipo con muchos partidos puede generar cientos de combinaciones de 5 (rotaciones
  amplias) → mitigado por caché `lineups:<team>` versionada y por el límite natural de que solo entran combos con al menos
  1 tramo real jugado.
- **Riesgo:** doble fuente de verdad entre `lineup_stats` (combinación elegida, legado) y `all_lineups` (todas). Decisión:
  `all_lineups` es la fuente para la tabla y las tarjetas; el selector de 3–5 sigue usando `lineup_stats`/`onoff_stats`
  adaptado a `StatBundle` para la vista de detalle, sin duplicar la lógica de segmentos (ambos llaman a `build_segments`).
- **Desviación respecto de la arquitectura:** ninguna; los tres endpoints marcados PROPUESTA (`team_lineup_clutch`, el
  parámetro `state` de `team_onoff`, y `/api/lineup-leaders/<team_code>`) llenan huecos que la arquitectura delega
  explícitamente en "cada requisito registra sus tablas" (§3.11) y "PROPUESTA" (§0.1); se reportan en `huecos_arquitectura`.
- **Dependencias técnicas:** `stats_engine.compute_standard`/`StatBundle` (T-05, `../13-T-05-conjunto-estandar-metricas/plan.md`);
  `sample.sample_level`/`adjusted`/`is_ranked` (T-02, `../14-T-02-confiabilidad-muestra/plan.md`); `population.ficha` (T-01,
  `../15-T-01-ficha-de-metrica/plan.md`); `tables.register_table`/`build_table` (T-06,
  `../16-T-06-tablas-completas-exportacion/plan.md`); `clutch.margin`/`clutch.window_secs` desde `config.get` (F-13,
  `../12-F-13-configuracion/plan.md`) y la corrección `PERIOD_TYPES`/`OVERTIME` (C-06,
  `../05-C-06-umbral-cierres/plan.md`, y F-11 en `lineups.py`); ids de jugador (C-08,
  `../07-C-08-jugadores-duplicados/plan.md`); pestaña y router (X-01, `../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md`).
- **Estimación:** XL · 22–32 h (backend `all_lineups`/`lineup_clutch`/`lineup_leaders` 8–10 h; endpoints y tablas 4–6 h;
  frontend tarjetas+tabla+ON/OFF+cierres 8–12 h; verificación manual y docs 2–4 h).
