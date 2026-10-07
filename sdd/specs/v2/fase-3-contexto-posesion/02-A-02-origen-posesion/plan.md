# Plan — A-02: Origen de la posesión

> **ID:** A-02 · **Prioridad:** P1 · **Fase y orden:** 3·02
> **Depende de:** A-01 ([../01-A-01-motor-posesiones/plan.md](../01-A-01-motor-posesiones/plan.md))
> **Habilita:** A-03, A-06, A-07, F-14
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §5.2 · A-02 · Arquitectura §1.6, §2.1, §3.2, §3.8, §3.9, §6, §9.2 (DA-29)
> **Estimación:** L · 10–16 h

## 1. Enfoque
Enriquecedor de posesiones `origin` registrado en `possessions.register_enricher` (A-01) que completa `Possession.origin`
aplicando la precedencia fijada por la arquitectura sobre el evento que abre cada posesión. Sobre las posesiones enriquecidas,
un módulo dedicado **`backend/origin.py`** (NUEVO — PROPUESTA de nombre, capa estadística tipo DA-37) agrega volumen,
eficiencia, duración media y distribución de finalizaciones por origen, en ataque y en defensa, delegando las fórmulas del
conjunto estándar en `stats_engine.compute_standard` (regla 4). Se registran la dimensión de contexto `origin`, el tipo de
entidad `origin` (T-05) y la tabla `team_origins` (T-06). Una ruta fina `GET /api/origins` sirve el bloque "Origen de la
posesión" de la pestaña Posesión de S3/S4. Todo on-the-fly con caché por `data_version`/`config_version`; sin cambios de
esquema.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/origin.py` | module (NUEVO, PROPUESTA de nombre) | enriquecedor `enrich_origin`, agregación `origin_report`, `player_origin`, builder de tabla, loader de entidad `origin`, registro de dimensión | RF-1…RF-15 |
| `backend/possessions.py` | module (A-01, extender) | ninguno — `Possession.origin` ya existe (reservado por A-01); A-02 solo escribe el atributo | RF-1…RF-4 |
| `backend/stats_engine.py` | module (extender) | fórmulas `origin_rates(counts)` (volumen, %, PPP, eFG%, TO%, FT Rate, duración media) — regla 4 | RF-5 |
| `backend/metrics_catalog.py` | module (T-05, registrar) | `register_entity("origin", loader)`; metadatos de claves propias de la vista (grupo `extra`): `origin_share`, `origin_duration_avg` | RF-10 |
| `backend/context.py` | module (T-03, registrar) | `register_dimension("origin", level="posesion", values=(8 orígenes), parser=_parse_origin)` | RF-10, RF-12 |
| `backend/tables.py` | module (T-06, registrar) | `register_table("team_origins", entity_type="origin", …)` | RF-13 |
| `backend/app.py` | route | `GET /api/origins` (fina: parsea contexto, llama a `origin_report`) | RF-5…RF-9, RF-14 |
| `frontend/js/api.js` | js-api | `api.origins(params)` | RF-5…RF-14 |
| `frontend/js/components/origin-panel.js` | js-component (NUEVO, PROPUESTA) | render del bloque (resumen por origen, distribución de finalización, fila informativa RO, conciliación de suma) | RF-5…RF-9 |
| `frontend/js/views/equipo.js` | js-view (X-01) | montar el bloque en la pestaña `posesion` (S3; junto a A-03/A-04/A-05) | RF-6, RF-12 |
| `frontend/js/views/jugador.js` | js-view (X-01) | montar el bloque en la pestaña `posesion` de S4 (modo jugador) | RF-14 |
| `frontend/css/style.css` | css | sección `/* ── origin (A-02) ── */` (tabla, barra apilada de finalización mobile) | RF-6 |
| `frontend/sw.js` | sw | sumar `origin-panel.js` a `STATIC` y subir `CACHE` si X-01 aún no pasó a runtime caching (si ya pasó: sin cambios) | — |
| `docs/api.md` | docs | `GET /api/origins`, tabla `team_origins`, tipo `origin`, filtro `origin` | cierre |
| `docs/metrics.md` | docs | definición de los 8 orígenes, precedencia, fórmulas de la tabla, fuente derivada del reloj (referencia a A-01) | cierre |
| `docs/frontend.md` | docs | bloque "Origen de la posesión" de Posesión y su copy | cierre |
| `docs/architecture.md` | docs | módulo `origin.py` | cierre |

Matriz RF→archivo: RF-1/RF-2/RF-3/RF-4 `origin.py` (enriquecedor); RF-5 `stats_engine.py`, `origin.py`; RF-6 `origin.py`,
`origin-panel.js`; RF-7 `origin.py`; RF-8 `origin.py` (`side`); RF-9/RF-15 `origin.py` (conciliación y nulos); RF-10
`metrics_catalog.py`, `context.py`; RF-11 `origin-panel.js` + `sample.py` (consumo); RF-12 `app.py` + `context.py` +
`population.py` (consumo); RF-13 `tables.py`; RF-14 `jugador.js`, `player_origin`.

## 3. Backend — rutas y modelos

### `GET /api/origins` — NUEVO · PROPUESTA (no está en 00-arquitectura-transversal.md, mismo patrón que `GET /api/second-chance` de A-04)
- Auth: `login_required`. Contexto T-03 completo (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`,
  `on`, `off`, `clock`, `clock_start`, `ptype`, `chance`; `origin` se ignora aquí porque la vista ya desglosa por origen y se
  informa en `context.ignored` con razón `no_aplica`). Sin `base` (tasas por posesión; conteos se muestran en total).
- Query: `team=<team_code>` **o** `player=<player_id>` (uno obligatorio); `side=ataque|defensa` (default `ataque`).
- Respuesta 200 (ejemplo abreviado con valores ilustrativos):
```json
{
  "entity": {"type": "team", "id": "CNF", "name": "Nacional"},
  "side": "ataque",
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {}, "ignored": [],
              "level": "posesion", "population_mode": "apply_all", "games_used": 13, "games_total": 13,
              "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "summary": {"possessions": 923, "classified": 923, "reconciled": true},
  "origins": [
    {"key": "canasta_rival", "label": "Tras canasta rival", "possessions": 312, "share": 0.338,
     "metrics": {
       "ppp": {"value": 1.02, "reason": null, "percentile": 55, "sample": {"level": "alta", "unit": "posesiones", "n": 312}},
       "efg_pct": {"value": 0.512, "reason": null}, "to_pct": {"value": 0.121, "reason": null},
       "ft_rate": {"value": 0.31, "reason": null}, "duration_avg": {"value": 15.4, "reason": null}
     },
     "finish": {"t2": 0.41, "t3": 0.22, "tl": 0.18, "perdida": 0.19, "fin_periodo": {"count": 3, "excluded_from_share": true}},
     "sample": {"level": "alta", "n": 312, "unit": "posesiones"}},
    {"key": "rebote_defensivo", "label": "Tras rebote defensivo", "possessions": 401, "share": 0.434, "metrics": {}, "finish": {}, "sample": {}},
    {"key": "robo", "label": "Tras robo", "possessions": 88, "share": 0.095, "metrics": {}, "finish": {}, "sample": {}},
    {"key": "perdida_rival", "label": "Tras pérdida rival sin robo", "possessions": 41, "share": 0.044, "metrics": {}, "finish": {}, "sample": {}},
    {"key": "saque_banda", "label": "Saque de banda", "possessions": 52, "share": 0.056, "metrics": {}, "finish": {}, "sample": {}},
    {"key": "tiempo_muerto", "label": "Saque de fondo tras tiempo muerto", "possessions": 19, "share": 0.021, "metrics": {}, "finish": {}, "sample": {"level": "baja", "n": 19, "unit": "posesiones"}},
    {"key": "tiro_libre_rival", "label": "Tras tiro libre rival", "possessions": 10, "share": 0.011, "metrics": {}, "finish": {}, "sample": {"level": "baja", "n": 10, "unit": "posesiones"}}
  ],
  "oreb_info": {"label": "Tras rebote ofensivo", "possessions": 142, "note": "No participa de los ocho orígenes: es el inicio de una segunda oportunidad (ver A-04)."},
  "reconcile": {"sum_origins": 923, "total_possessions": 923, "ok": true}
}
```
- Con `side=defensa` el mismo shape describe las posesiones del rival contra el equipo (`metrics` = concedido/forzado;
  etiquetas de columnas leen "concedido"/"forzado" en la UI).
- Con `player=<id>`: `origins[]` describe de qué origen recibe el balón el jugador cuando **finaliza** la posesión
  (`Possession.finisher_id == player_id`); `oreb_info` y `reconcile` se omiten (la unidad de análisis por jugador no es la
  totalidad de posesiones del equipo).
- Errores (§7.8): 400 `parametro_invalido` "Indicá un equipo o un jugador." / "El lado debe ser ataque o defensa."; 400
  `contexto_invalido` (de `parse_context`); 404 `no_encontrado` "No encontramos ese equipo o jugador."; 404 `sin_pbp` "Este
  equipo no tiene play-by-play importado. Reimportá sus partidos." (todos los partidos de la selección sin pbp).

### `GET /api/table/team_origins` — NUEVO (id fijado en Arq. §6)
Registrada con `tables.register_table("team_origins", entity_type="origin", title="Origen de la posesión — {equipo}",
builder=origin.table_rows, default_columns=["_name","_sample","possessions","share","ppp","efg_pct","to_pct","ft_rate",
"duration_avg"], bulk_scopes=("team",))`. Params: `team`, `side` + contexto. Payload §7.6 con una fila por origen (ataque o
defensa según `side`), `totals` = total de posesiones clasificadas, `competition_avg` = media de los equipos de la
población.

### `GET /api/metrics/origin?id=<team_code>:<origen>` — NUEVO (tipo fijado en Arq. §6)
Loader `origin.origin_bundles(req)` → `StatBundle` con los conteos de las posesiones de ese origen (propios y del rival en
las mismas posesiones vía `side`). Payload §7.3 completo (todas las claves del conjunto estándar; las no aplicables como
`pace`, `minutes`, `uso_*` → `no_aplica`).

### Esquema
Sin cambios (Arq. §5: A-01…A-11 son on-the-fly). A-02 no agrega claves de configuración propias (usa `sample.split.*` de
F-13 para el badge de muestra).

## 4. Backend — lógica

| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `enrich_origin(possessions, events, game)` | `origin.py` | enriquecedor A-01 | RF-1, RF-2, RF-3, RF-4 |
| `origin_report(entity_type, entity_id, comp_id, ctx, *, side)` | `origin.py` | agregación completa | RF-5…RF-9 |
| `player_origin(player_id, comp_id, ctx)` | `origin.py` | orígenes de las posesiones que finaliza el jugador | RF-14 |
| `origin_bundles(req)` | `origin.py` | loader tipo `origin` | RF-10 |
| `table_rows(req)` | `origin.py` | builder T-06 | RF-13 |
| `origin_rates(c)` | `stats_engine.py` | fórmulas | RF-5 |

### 4.1 `enrich_origin(possessions, events, game) -> None` (registrado con `possessions.register_enricher("origin", …)`)
Entradas: posesiones de un partido (A-01, ya con `chances`, `end_type`, `start_event`), eventos del partido (`pbp_events`
como dicts, ordenados por `action_number`, con `previous_action`/`qualifiers` cuando existen los agrega F-11), metadatos del
partido (`meta.event_lineups`, `meta.mclock`).
```
idx = {ev.action_number: ev for ev in events}
prev_close = None                                    # última posesión cerrada (de cualquier equipo), para robo sin vínculo
for pos in possessions (en orden de start_event):
    if pos.incomplete: pos.origin = None; prev_close = pos si cerró; continue
    if pos.start_event es el primer evento de juego del período (jumpball startperiod, o el primer evento tras `period`/`start`
       sin evento de posesión previo en el período) or es posesión alterna al abrir cuarto/prórroga:
        pos.origin = "saque_banda"                    # RF-3, DA-29: inicio de período/salto inicial
        continue
    open_ev = idx[pos.start_event]                    # evento que abrió la posesión (según la máquina de estados de A-01)
    # ventana de precedencia: se mira el evento que cerró la posesión anterior del rival (o el evento inmediatamente
    # anterior a open_ev en el pbp) para decidir el origen, aplicando la precedencia fijada por la arquitectura:
    # tiempo_muerto > robo > rebote_defensivo > tiro_libre_rival > canasta_rival > perdida_rival > saque_banda
    closing = idx.get(prior_close_event(pos, events))  # evento que cerró la posesión anterior (ver abajo)
    if hay un evento `timeout` del propio equipo o del rival entre el cierre anterior y open_ev (misma vecindad de
       action_number, sin evento de juego intermedio del equipo que abre):
        pos.origin = "tiempo_muerto"                   # RF-2, D-2 del spec: cualquier timeout inmediatamente antes
    elif closing.action_type == "turnover" and hay evento "steal" vinculado por previous_action a closing (o, sin vínculo,
         evento "steal" del equipo que abre en la misma vecindad de action_number — fallback D-1 §9 del spec):
        pos.origin = "robo"
    elif closing.action_type == "rebound" and closing.sub_type == "defensive" and closing.team_code == pos.team:
        pos.origin = "rebote_defensivo"
    elif closing.action_type == "freethrow" and closing.team_code == pos.opp and es el último TL de una serie del rival:
        pos.origin = "tiro_libre_rival"
    elif closing.action_type in ("2pt", "3pt") and closing.success and closing.team_code == pos.opp:
        pos.origin = "canasta_rival"
    elif closing.action_type == "turnover" and closing.team_code == pos.opp:
        pos.origin = "perdida_rival"
    else:
        pos.origin = "saque_banda"                     # fallback: sin evento de cierre identificable (p. ej. heldball)
    prev_close = pos
```
- `prior_close_event(pos, events)`: el `end_event` de la posesión inmediatamente anterior en el partido (cualquier equipo),
  recorrido por orden de `start_event`; si no hay posesión anterior en el período (primera del período mediante posesión
  alterna, ya cubierto arriba) se usa el evento `period`/`start`.
- Las posesiones que siguen a un **rebote ofensivo propio** (`Chance n ≥ 2` dentro de la misma `Possession`) no pasan por
  este enriquecedor a nivel de posesión — son la misma posesión, no una nueva: no generan un origen nuevo (RF-4). La fila
  informativa "Tras rebote ofensivo" del payload (`oreb_info`) se calcula aparte, contando `Chance.n >= 2` de A-04 cuando
  está disponible; hasta que A-04 se implemente (misma fase, orden posterior) se cuenta directamente sobre
  `pos.chances` de A-01 sin depender de `Chance.outcome`.
- Caché: el enriquecido queda dentro del caché de `game_possessions` (`poss:game`, clave con `config_version`); A-02 no
  agrega claves de configuración, así que el enriquecedor es determinístico sobre el pbp del partido (no depende de
  `config_version`, pero se recalcula igual si cambia `data_version`).
- Nulos: posesión incompleta → `origin = None` (no se clasifica). Ningún origen queda sin asignar para una posesión
  completa (el `else` final garantiza `saque_banda` como default, documentado en `docs/metrics.md` como "origen no
  identificable, tratado como saque de banda" — decisión que preserva CA-1, suma exacta).

### 4.2 `origin_report(entity_type, entity_id, comp_id, ctx, *, side="ataque") -> dict`
```
poss = possessions.team_possessions(team, comp_id, ctx, side=side)   # ya filtradas por contexto (A-01 aplica possession_predicate)
complete = [p for p in poss if not p.incomplete]
by_origin = group complete by p.origin                                # 8 claves exhaustivas y disjuntas (RF-1, CA-1)
for key, group in by_origin:
    counts = {pts: Σp.pts, fga2/fgm2/fga3/fgm3/fta/ftm: Σ sobre p.shots y p.chances[].end_type, tov: #{end_type=="perdida"},
              duration_sum: Σp.duration, n: len(group)}
    metrics = stats_engine.origin_rates(counts)                       # PPP, eFG%, TO%, FT Rate, duración media
    finish = distribución de p.end_type agrupado T2/T3/TL/Pérdida (RF-6); fin_periodo aparte, no en el reparto %
    sample = sample.sample_level("split", n=len(group), unit="posesiones", team_poss=len(complete))
    fichas: population.attach_fichas({ppp, efg_pct, to_pct}, "origin", f"{team}:{key}", pop) si T-01 ya cerrado
oreb_info = {"possessions": Σ Chance.n>=2 en `complete`, "note": copy fijo}
reconcile = {"sum_origins": Σ n de by_origin, "total_possessions": len(complete), "ok": sum_origins == total_possessions}
```
- Sin posesiones de un origen: `metrics.*` → `{"value": null, "reason": "sin_intentos"}`, `possessions: 0` (CA-6).
- Partidos sin pbp → excluidos por `team_possessions` y contados en `context.games_excluded.sin_pbp`.
- Caché: `cache.memo("poss:origin", (team, comp_id, context_key(ctx), side), fn)`.

### 4.3 `stats_engine.origin_rates(c: dict) -> dict` (regla 4: fórmulas)
```
ppp            = _safe_div(c.pts, c.n)
efg_pct        = _safe_div(c.fgm2 + c.fgm3 + 0.5*c.fgm3, c.fga2 + c.fga3)
to_pct         = _safe_div(c.tov, c.n)
ft_rate        = _safe_div(c.fta, c.fga2 + c.fga3)
duration_avg   = _safe_div(c.duration_sum, c.n)
```
Fórmulas idénticas al glosario v2 (§6) y a la conciliación §2.2 de la arquitectura (PPP/eFG%/TO%/FT Rate ya conciliadas por
T-05; A-02 solo las aplica sobre el subconjunto de posesiones de cada origen, no reinterpreta coeficientes).

### 4.4 `origin_bundles(req) -> list[StatBundle]` y registro de dimensión
- `StatBundle(entity_type="origin", entity_id="CNF:robo", own=<RAW_KEYS sumados de las posesiones del origen>,
  opp=<eventos del rival en esas mismas posesiones (faltas, robos, tapones, rebotes)>, games=<partidos con al menos una
  posesión de ese origen>, minutes=None, seconds=Σ duración de las posesiones, possessions_counted=n)`. `compute_standard`
  devuelve `no_aplica` en `pace`, `minutes`, `uso_*` (fuera de `entities` del catálogo para `origin`).
- `context.register_dimension("origin", level="posesion", values=("canasta_rival","rebote_defensivo","robo",
  "perdida_rival","saque_banda","tiempo_muerto","tiro_libre_rival"), parser=_parse_origin)` (CSV; `_parse_origin` valida
  contra el enum, 400 `contexto_invalido` si algún valor no pertenece).

### 4.5 `table_rows(req)` (builder T-06)
Una fila por origen (7 filas, orden fijo del cliente) más la fila informativa de rebote ofensivo (marcada
`informational: true`, fuera de `totals`); cada fila es un `StatBundle` del grupo más columnas propias de la vista
(`possessions`, `share`, `ppp`, `efg_pct`, `to_pct`, `ft_rate`, `duration_avg`, `finish_t2`, `finish_t3`, `finish_tl`,
`finish_perdida`) declaradas como columnas `type: "metric"` con metadatos en el catálogo (grupo `extra`).

### Manejo de nulos (C-11)
Posesión incompleta nunca aporta a ningún origen. Origen sin posesiones → métricas `null` con razón `sin_intentos`,
`possessions: 0` (nunca se omite la fila). Partidos sin pbp → `sin_pbp`, contados en `context.games_excluded`.

## 5. Frontend — capa API (api.js)
- `api.origins({team, player, side, ...context})` → `apiFetch("/api/origins" + qs(params))`.
- Reutiliza `api.table("team_origins", params)` (T-06), `api.metrics("origin", params)` (T-05), `api.ranking(...)` (T-01).

## 6. Frontend — UI
- **Ubicación**: S3 Equipo → pestaña `posesion` (`#/equipo/<code>/posesion?…`), primer sub-bloque "Origen de la posesión"
  (antes de A-03/A-04/A-05 en el orden de la pestaña); S4 Jugador → pestaña `posesion` (modo jugador). X-01 (fase 2) ya
  existe cuando A-02 se construye (fase 3): `registerTab("equipo", {slug: "posesion", enabled: true, …})` — A-02 habilita
  la pestaña si ningún requisito anterior de la fase lo hizo.
- **Componentes reutilizados** (Arq. §8): `metric-card.js` (fichas de PPP/eFG%/TO%/FT Rate por origen), `sample-badge.js`,
  `data-table.js` (tabla de orígenes con `tableId: "team_origins"`), `export-menu.js`, `core/format.js` (`fmtNumber`,
  `nullDisplay`), `core/colors.js` (`percentileColor`), `core/i18n.js` (`t()`), `core/context.js` (`getContext`,
  `onContextChange`), `context-bar.js`.
- **Nuevo**: `components/origin-panel.js` → `renderOriginPanel(el, payload, {mode: "team"|"player"})` (PROPUESTA):
  1. Tabla T-06 de 7 orígenes (Origen · Posesiones · % · PPP · eFG% · TO% · FT Rate · Duración media) con badge de muestra
     por fila y reparto de finalización como barra apilada (T2/T3/TL/Pérdida; "fin de período" con nota aparte).
  2. Fila informativa "Tras rebote ofensivo" (fuera de la suma), con la nota fija enlazando a Segunda oportunidad (A-04).
  3. Selector Ataque/Defensa (chips) → recarga con `side`; en defensa el título cambia a "Origen de la posesión rival" y
     las columnas leen "concedido"/"forzado".
  4. Leyenda de conciliación: "Posesiones clasificadas: N de N (100 %)" o alerta si `reconcile.ok === false`.
- **Estados**: spinner mientras carga; vacío/errores/offline con el copy de spec §6; filas de muestra baja en gris sin
  color de rendimiento.
- **Mobile 768 px**: tabla con columna "Origen" fija (`.table-sticky`), reparto de finalización como barra apilada
  horizontal de ancho completo (spec §6).

## 7. Navegación
Sin sección nueva. Usa la pestaña `posesion` de S3/S4 (X-01, Arq. §3.12); el estado Ataque/Defensa va en la query del hash
como `side=defensa` (PROPUESTA: parámetro de vista, no de contexto; no se propaga al cambiar de sección, mismo patrón que
A-04). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/origins`: ejemplo completo en §3. Objetos métrica = §7.1 (T-01) con `sample` §7.2; nulos §7.4.
- Tabla `team_origins`: §7.6. Entidad `origin`: §7.3.
- Sin campos nuevos en `Possession`/`Chance` (A-02 solo escribe `Possession.origin`, ya reservado por A-01).
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `parametro_invalido` | "Indicá un equipo o un jugador." / "El lado debe ser ataque o defensa." |
| 400 | `contexto_invalido` | mensaje de `parse_context` |
| 401 | — | handler global de `api.js` (login) |
| 404 | `no_encontrado` | "No encontramos ese equipo o jugador." |
| 404 | `sin_pbp` | "Este equipo no tiene play-by-play importado. Reimportá sus partidos." |
Offline: `/api/*` siempre a red; el panel muestra "Sin conexión: el análisis de posesiones necesita conexión." Si X-01 no
pasó a runtime caching, sumar `js/components/origin-panel.js` a `STATIC` y subir `CACHE`.

## 10. Riesgos / decisiones
- **Endpoint propio (PROPUESTA).** La arquitectura fija la tabla `team_origins` y el tipo `origin`, pero no un endpoint
  para el resumen/desglose/conciliación. Se propone `GET /api/origins` (mismo patrón que `GET /api/second-chance` de A-04
  y `GET /api/cross`). Reportado en huecos.
- **Precedencia con ventana de vecindad (D-2 de spec).** La arquitectura fija el orden de precedencia pero no el algoritmo
  exacto para resolver "el evento que cierra la posesión anterior" cuando hay eventos administrativos (timeout,
  substitution) entre el cierre y la apertura. Se resuelve mirando el evento de cierre real (ignorando eventos que no
  cambian el estado del juego) y, para `timeout`, cualquier evento `timeout` en la vecindad de `action_number` entre el
  cierre anterior y la apertura de la posesión — interpretación PROPUESTA, documentada en `docs/metrics.md`.
- **Robo sin vínculo `previous_action` (fallback, D-1 de spec).** Para partidos no reprocesados con ingesta v2, se usa
  heurística de vecindad de `action_number` en vez del vínculo exacto; puede fallar en jugadas con eventos fuera de orden
  (misma limitación que A-01 R-1). Se documenta como limitación y se recomienda reprocesar (F-11).
- **`saque_banda` como fallback universal.** Cualquier apertura de posesión que no matchee ninguna de las siete
  condiciones anteriores cae en `saque_banda` (nunca un noveno origen ni una posesión sin clasificar) — esto es lo que
  garantiza CA-1 (suma exacta) incluso ante casos no modelados explícitamente por el cliente (ej. salto tras doble falta
  técnica simultánea). Se documenta como decisión conservadora en `docs/metrics.md`.
- **Fila informativa de rebote ofensivo antes de que A-04 exista.** A-04 es el orden 04 de esta misma fase (después de
  A-02 en 02 y A-03 en 03); cuando A-02 se implementa, `Chance.outcome` de A-04 todavía no existe. `oreb_info.possessions`
  se calcula contando `len(p.chances) - 1` para `p` con `len(p.chances) >= 2` directamente sobre las `Chance` de A-01 (que
  ya reserva el campo), sin depender de la clasificación de desenlaces de A-04. No es un incremento diferido: es un
  cálculo completo con datos de A-01 solamente.
- **Rebotes de equipo** (141 en 13 partidos, Arq. §1.6): un rebote defensivo de equipo (`qualifier team`, sin jugador)
  cierra la posesión rival igual que uno individual; el origen `rebote_defensivo` no distingue si el rebote fue individual
  o de equipo (el cliente no lo pide).
- Desviaciones respecto de la arquitectura: ninguna de contrato; solo las PROPUESTAS anteriores.
- **Dependencias técnicas:**
  - A-01 `possessions.game_possessions`, `team_possessions`, `register_enricher`, `Possession`, `Chance`
    ([../01-A-01-motor-posesiones/plan.md](../01-A-01-motor-posesiones/plan.md)).
  - F-11 `pbp_events.previous_action`/`qualifiers`, `repository`, `cache`
    ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - T-05 `StatBundle`, `compute_standard`, `register_entity`
    ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-02 `sample.sample_level`
    ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-01 `population.population`, `attach_fichas`
    ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - T-06 `tables.register_table`, `data-table.js`
    ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - T-03 `context.register_dimension`, `parse_context`
    ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - X-01 `registerTab`, vistas `equipo.js`/`jugador.js`
    ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno (A-01 pertenece a la misma fase y ya está resuelto; la fila informativa de rebote
  ofensivo se calcula completa con datos de A-01, según se explica arriba).
- **Estimación: L · 10–16 h** (enriquecedor y precedencia 4 h, agregación y reparto de finalización 3 h, registros
  T-03/T-05/T-06 2 h, UI 3 h, verificación y docs 2–3 h).
