# Plan — A-03: Transición y contraataque

> **ID:** A-03 · **Prioridad:** P1 · **Fase y orden:** 3·03
> **Depende de:** A-01 ([../01-A-01-motor-posesiones/plan.md](../01-A-01-motor-posesiones/plan.md)) · A-02 ([../02-A-02-origen-posesion/plan.md](../02-A-02-origen-posesion/plan.md)) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md))
> **Habilita:** A-04, A-06, A-07
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §5.2 · A-03 · Arquitectura §1.6, §2.1, §3.2, §3.5, §3.8, §3.9, §6, §7, §9.2
> **Estimación:** L · 12–18 h

## 1. Enfoque
Enriquecedor `ptype` registrado en `possessions.register_enricher` (A-01) que completa `Possession.ptype` midiendo, sobre el reloj de posesión derivado, los segundos hasta el **primer evento de decisión** de cada posesión completa (primer tiro de campo, falta recibida con tiros libres o pérdida) y aplicando los cortes `transition.max_secs` / `early_offense.max_secs` de la configuración (F-13). El mismo pase completa cuatro atributos auxiliares por posesión (`first_elapsed`, `finish_kind`, `starter_id`, `end_player_id`) que usan las métricas de finalización y de corredores. Sobre las posesiones enriquecidas, un módulo dedicado **`backend/transition.py`** (NUEVO — PROPUESTA de nombre, capa estadística tipo DA-37) agrega frecuencia, eficiencia, origen, finalización, % RD → transición, corredores y el bloque defensivo, delegando las fórmulas en `stats_engine` (regla 4, reutilizando `origin_rates` de A-02). Se registran la dimensión de contexto `ptype`, el tipo de entidad `ptype` (T-05) y la tabla `team_ptypes` (T-06). Una ruta fina `GET /api/transition` sirve el bloque "Transición y contraataque" de la pestaña Posesión. Todo on-the-fly, cacheado por `data_version`/`config_version` (cambiar un corte en S9 reclasifica en la siguiente petición); sin cambios de esquema.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/transition.py` | module (NUEVO, PROPUESTA de nombre) | enriquecedor `enrich_ptype`, `transition_report`, `player_transition`, `reconcile_fastbreak`, loader `ptype_bundles`, builder `table_rows`, registro de dimensión | RF-1…RF-21 |
| `backend/possessions.py` | module (A-01, extender) | campos nuevos de `Possession` (`first_elapsed`, `ptype_reason`, `finish_kind`, `starter_id`, `end_player_id`) y parámetro `include_incomplete` de `team_possessions` (PROPUESTAS, §10) | RF-1, RF-3, RF-8, RF-10 |
| `backend/stats_engine.py` | module (extender) | `ptype_rates(counts)` (delega en `origin_rates` de A-02; agrega `first_shot_secs`, `share`) — regla 4 | RF-4, RF-5, RF-7 |
| `backend/metrics_catalog.py` | module (T-05, registrar) | `register_entity("ptype", ptype_bundles)`; `MetricDef` de las claves propias (grupo `extra`): `ptype_share`, `first_shot_secs` | RF-17 |
| `backend/context.py` | module (T-03, registrar) | `register_dimension("ptype", level="posesion", values=(…), parser=_parse_ptype)` y rama `ptype` en `possession_predicate` | RF-17 |
| `backend/tables.py` | module (T-06, registrar) | `register_table("team_ptypes", entity_type="ptype", …)` | RF-17 |
| `backend/config.py` | module (F-13) | pasar `transition.max_secs` y `early_offense.max_secs` de `status: "reservada"` a `"activa"` (el catálogo ya trae nombre, rango y regla de coherencia) | RF-16 |
| `backend/app.py` | route | `GET /api/transition` (fina: parsea contexto, delega); `import transition` (registra enganches) | RF-4…RF-21 |
| `frontend/js/api.js` | js-api | `api.transition(params)` | RF-4…RF-19 |
| `frontend/js/components/transition-panel.js` | js-component (NUEVO, PROPUESTA) | render del bloque (fichas, tipos, origen, finalización, corredores, defensa, conciliación) | RF-4…RF-15, RF-18 |
| `frontend/js/views/equipo.js` | js-view (X-01) | montar el bloque en la pestaña `posesion` (S3), debajo de A-02 | RF-4…RF-15 |
| `frontend/js/views/jugador.js` | js-view (X-01) | montar el bloque en la pestaña `posesion` (S4, modo jugador) | RF-19 |
| `frontend/css/style.css` | css | sección `/* ── transition (A-03) ── */` (fichas, barra apilada, histograma de barras CSS) | RF-8, RF-7 |
| `frontend/sw.js` | sw | sumar `js/components/transition-panel.js` a `STATIC` y subir `CACHE` solo si X-01 aún no pasó a runtime caching | — |
| `docs/api.md` | docs | `GET /api/transition`, tabla `team_ptypes`, tipo `ptype`, filtro `ptype` | cierre |
| `docs/metrics.md` | docs | definición de los tres tipos, primer evento de decisión, reloj derivado, métricas ofensivas/defensivas, cortes configurables | cierre |
| `docs/frontend.md` | docs | bloque "Transición y contraataque" y su copy | cierre |
| `docs/architecture.md` | docs | módulo `transition.py` | cierre |

Matriz RF → archivo: RF-1/RF-2/RF-3 `transition.py` (`enrich_ptype`), `possessions.py`; RF-4/RF-5/RF-7 `stats_engine.py`, `transition.py`; RF-6 `transition.py`; RF-8 `transition.py` (`finish_kind`), `possessions.py`; RF-9 `transition.py`; RF-10/RF-11/RF-19 `transition.py` (`player_transition`), `possessions.py`, `transition-panel.js`, `jugador.js`; RF-12/RF-13/RF-14/RF-15 `transition.py` (`side="defensa"`); RF-16 `config.py`; RF-17 `metrics_catalog.py`, `context.py`, `tables.py`; RF-18 `transition-panel.js` + `sample.py`/`population.py` (consumo); RF-20 `transition.py`; RF-21 `transition.py` (`reconcile_fastbreak`).

## 3. Backend — rutas y modelos

### `GET /api/transition` — NUEVO · PROPUESTA (no está en 00-arquitectura-transversal.md)
- Auth: `login_required`. Contexto T-03 completo (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, `clock`, `clock_start`, `origin`, `chance`; `ptype` se ignora aquí porque la vista ya desglosa por tipo y se informa en `context.ignored` con razón `no_aplica`). Sin `base` (tasas por posesión; los conteos se muestran en total).
- Query: `team=<team_code>` **o** `player=<player_id>` (uno obligatorio); `side=ataque|defensa` (default `ataque`; con `player` solo `ataque`).
- Respuesta 200, `side=ataque`, `team` (valores ilustrativos):
```json
{
  "entity": {"type": "team", "id": "CNF", "name": "Nacional"},
  "side": "ataque",
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {}, "ignored": [{"param": "ptype", "reason": "no_aplica"}],
              "level": "posesion", "population_mode": "apply_all", "games_used": 13, "games_total": 13,
              "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "summary": {"possessions": 231, "classified": 214,
              "unclassified": {"incompleta": 2, "sin_accion": 12, "reloj_no_derivable": 3},
              "reconciled": true,
              "thresholds": {"transition_max_secs": 7, "early_max_secs": 12}},
  "identity": {"transition_share": {"value": 0.191, "reason": null, "percentile": 74, "rank": 3, "rank_total": 12,
                                     "sample": {"level": "alta", "unit": "posesiones", "n": 214}}},
  "types": [
    {"key": "transicion", "label": "Transición", "possessions": 41, "share": 0.1916, "pts": 48,
     "metrics": {"ppp": {"value": 1.17, "reason": null, "percentile": 80}, "efg_pct": {"value": 0.571, "reason": null},
                 "to_pct": {"value": 0.098, "reason": null}, "ft_rate": {"value": 0.24, "reason": null},
                 "duration_avg": {"value": 6.1, "reason": null}, "first_shot_secs": {"value": 4.8, "reason": null}},
     "sample": {"level": "alta", "n": 41, "unit": "posesiones", "min": 15, "high": 40}},
    {"key": "early", "label": "Early offense", "possessions": 62, "share": 0.2897, "pts": 61, "metrics": {}, "sample": {}},
    {"key": "media_cancha", "label": "Media cancha", "possessions": 111, "share": 0.5187, "pts": 104, "metrics": {}, "sample": {}}
  ],
  "diff": {"ppp_trans_vs_half": {"value": 0.23, "reason": null}, "ppp_early_vs_half": {"value": 0.05, "reason": null}},
  "first_shot": {"mean": {"value": 11.4, "reason": null}, "n": 198, "without_shot": 16,
                 "hist": [{"secs": "0-3", "n": 14}, {"secs": "4-7", "n": 27}, {"secs": "8-12", "n": 62}, {"secs": "13-18", "n": 58}, {"secs": "19+", "n": 37}]},
  "origin_of_transition": [
    {"key": "rebote_defensivo", "label": "Tras rebote defensivo", "transitions": 22, "share": 0.537, "pts": 27, "ppp": 1.23, "origin_possessions": 98, "origin_runs_share": 0.224, "sample": {"level": "media", "n": 22, "unit": "posesiones"}},
    {"key": "robo", "label": "Tras robo", "transitions": 10, "share": 0.244, "pts": 14, "ppp": 1.4, "origin_possessions": 18, "origin_runs_share": 0.556, "sample": {}},
    {"key": "canasta_rival", "label": "Tras canasta rival", "transitions": 4, "share": 0.098, "pts": 3, "ppp": 0.75, "origin_possessions": 61, "origin_runs_share": 0.066, "sample": {}},
    {"key": "perdida_rival", "label": "Tras pérdida rival sin robo", "transitions": 3, "share": 0.073, "pts": 2, "ppp": 0.67, "origin_possessions": 9, "origin_runs_share": 0.333, "sample": {}},
    {"key": "otros", "label": "Otros", "transitions": 2, "share": 0.049, "pts": 2, "ppp": 1.0, "origin_possessions": 28, "origin_runs_share": 0.071, "sample": {}}
  ],
  "finish_in_transition": [
    {"key": "bandeja_volcada", "label": "Bandeja o volcada", "possessions": 15, "share": 0.366, "pts": 24, "ppp": 1.6},
    {"key": "otro_2", "label": "Otro tiro de 2", "possessions": 3, "share": 0.073, "pts": 2, "ppp": 0.67},
    {"key": "triple_esquina", "label": "Triple de esquina", "possessions": 4, "share": 0.098, "pts": 6, "ppp": 1.5},
    {"key": "triple_frontal", "label": "Triple frontal", "possessions": 7, "share": 0.171, "pts": 6, "ppp": 0.86},
    {"key": "tiro_libre", "label": "Tiro libre", "possessions": 8, "share": 0.195, "pts": 10, "ppp": 1.25},
    {"key": "perdida", "label": "Pérdida", "possessions": 4, "share": 0.098, "pts": 0, "ppp": 0.0}
  ],
  "finish_period_end": {"possessions": 0},
  "dreb_to_transition": {"drb_possessions": 98, "to_transition": 22, "share": {"value": 0.2245, "reason": null},
                         "scored": 14, "scored_share": {"value": 0.6364, "reason": null}},
  "players": [
    {"player_id": 812, "name": "S. Canty", "initiated": 12, "finished": 9, "finished_pts": 13, "ppp_personal": {"value": 1.44, "reason": null},
     "assists_in_transition": 3, "sample": {"level": "media", "n": 21, "unit": "posesiones"}}
  ],
  "players_coverage": {"initiator_identified": 33, "transitions": 41},
  "pass_out": {"value": null, "reason": "no_registrado",
               "note": "FIBA no registra los pases, solo el que termina en asistencia."},
  "reconcile": {"ptype_pts_transition": 48, "fast_break_pts_official": 51, "fastbreak_qualifier_pts": 49,
                "games_compared": 13, "games_excluded": [], "per_game": [{"game_id": "2849328", "date": "2025-10-12", "calc": 4, "official": 6, "qualifier": 4}]}
}
```
- `side=defensa` (mismas claves `entity`, `side`, `context`, `summary`, `types`, `diff` sobre las **posesiones del rival**, más):
```json
"defense": {
  "conceded_per100": {"value": 18.9, "reason": null},
  "conceded_by_origin": [
    {"key": "perdida_propia", "label": "Tras pérdida propia", "transitions": 21, "share": 0.51, "pts": 28, "ppp": 1.33},
    {"key": "tiro_fallado", "label": "Tras tiro fallado", "transitions": 14, "share": 0.34, "pts": 15, "ppp": 1.07},
    {"key": "canasta_propia", "label": "Tras canasta propia", "transitions": 3, "share": 0.07, "pts": 2, "ppp": 0.67},
    {"key": "otros", "label": "Otros", "transitions": 3, "share": 0.07, "pts": 3, "ppp": 1.0}
  ],
  "own_turnovers_to_transition": {"own_turnovers": 168, "followed_by_transition": 21, "share": {"value": 0.125, "reason": null},
                                   "followed_by_scored_transition": 14, "scored_share": {"value": 0.667, "reason": null},
                                   "excluded_next_incomplete": 2},
  "balance": {"fg_misses": 612, "rival_scored_transitions": 17, "share": {"value": 0.0278, "reason": null},
              "per100_possessions": {"value": 7.4, "reason": null}}
}
```
  `players`, `pass_out`, `first_shot`, `origin_of_transition`, `finish_in_transition` y `dreb_to_transition` se omiten en defensa (la vista defensiva del cliente no los pide).
- Con `player=<id>`: `types[]` describe las posesiones que el jugador **finaliza** por tipo (`possessions` = finalizadas, `pts`, `metrics.ppp` = PPP personal, `efg_pct` del jugador); bloque `runner` = `{"initiated": 12, "initiated_pts": 14, "assists_in_transition": 3, "coverage": {...}}`; `identity`, `diff` y `reconcile` se omiten.
- Errores (§7.8): 400 `parametro_invalido` "Indicá un equipo o un jugador." / "El lado debe ser ataque o defensa."; 400 `contexto_invalido` (de `parse_context`); 404 `no_encontrado` "No encontramos ese equipo o jugador."; 404 `sin_pbp` "Este equipo no tiene play-by-play importado. Reimportá sus partidos." (todos los partidos de la selección sin pbp).

### `GET /api/table/team_ptypes` — NUEVO (id fijado en Arq. §6)
`tables.register_table("team_ptypes", entity_type="ptype", title="Transición y tipos de ataque — {equipo}", builder=transition.table_rows, default_columns=["_name","_sample","possessions","share","ppp","efg_pct","to_pct","ft_rate","duration_avg","first_shot_secs"], bulk_scopes=("team",))`. Params: `team`, `side`, `section=tipos|origen|jugadores` (PROPUESTA, mismo mecanismo que A-04) + contexto. Payload §7.6: una fila por tipo (`tipos`), por origen del contraataque (`origen`) o por jugador (`jugadores`); `totals` = posesiones clasificadas; `competition_avg` = media de los equipos de la población.

### `GET /api/metrics/ptype?id=<team_code>:<tipo>` — NUEVO (tipo fijado en Arq. §6)
Loader `transition.ptype_bundles(req)` → `StatBundle` con los conteos de las posesiones de ese tipo (propios y del rival en las mismas posesiones). Payload §7.3 completo.

### Esquema y configuración
Sin cambios de esquema (Arq. §5). Claves de `CONFIG_SPEC` que A-03 **activa** (declaradas por F-13 con estado `reservada`; la UI de S9 las muestra editables y `PUT /api/settings` las acepta recién entonces):
| Clave | Tipo | Default | Rango | Sección | Consumidor |
|---|---|---|---|---|---|
| `transition.max_secs` | int (s) | 7 | 3–12 | Reglas de contexto | A-03 (`enrich_ptype`), A-04 (coste del RO), A-06 |
| `early_offense.max_secs` | int (s) | 12 | 8–20 | Reglas de contexto | A-03 (`enrich_ptype`) |
Coherencia ya validada por F-13: `transition.max_secs < early_offense.max_secs`.

## 4. Backend — lógica

| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `enrich_ptype(possessions, events, meta)` | `transition.py` | enriquecedor A-01 | RF-1, RF-2, RF-3, RF-8, RF-10, RF-16 |
| `transition_report(entity_type, entity_id, comp_id, ctx, *, side)` | `transition.py` | agregación completa | RF-4…RF-9, RF-12…RF-15, RF-18, RF-20 |
| `player_transition(player_id, comp_id, ctx)` | `transition.py` | corredores y participación por tipo | RF-10, RF-11, RF-19 |
| `reconcile_fastbreak(team_code, comp_id, ctx)` | `transition.py` | validación cruzada | RF-21 |
| `ptype_bundles(req)` | `transition.py` | loader tipo `ptype` | RF-17 |
| `table_rows(req)` | `transition.py` | builder T-06 | RF-17 |
| `ptype_rates(c)` | `stats_engine.py` | fórmulas | RF-4, RF-5, RF-7 |

### 4.1 `enrich_ptype(possessions, events, meta) -> None` (registrado con `possessions.register_enricher("ptype", enrich_ptype)`)
Entradas: posesiones de un partido (A-01, con `chances`, `shots[]` con `elapsed`/`zone`/`player_id`, `end_type`, `origin` de A-02 — el enriquecedor `origin` se registra antes, A-02 es orden 02), eventos del partido (`pbp_events` como dicts por `action_number`), `meta = {game_id, codes, name_to_id, mclock, event_lineups}` (A-01 §4.3). Configuración: `cut_t = config.get("transition.max_secs")`, `cut_e = config.get("early_offense.max_secs")`.
```
idx = {ev["action_number"]: (i, ev) for i, ev in enumerate(events)}
LAYUP = {"layup", "drivinglayup", "reverselayup", "tipinlayup", "dunk"}
for k, pos in enumerate(possessions):                 # orden de start_event, ambos equipos
    pos.ptype = pos.ptype_reason = pos.first_elapsed = pos.finish_kind = None
    pos.starter_id = pos.end_player_id = None
    if pos.incomplete: pos.ptype_reason = "incompleta"; continue
    c1 = pos.chances[0]
    # 1) primer evento de decisión y segundos de reloj de posesión hasta él
    if pos.shots:                                      # primer tiro de campo de la posesión
        elapsed = pos.shots[0]["elapsed"]              # A-01: c1.start_clock − mclock(tiro); None si no derivable
    elif c1.end_type in ("perdida", "falta"):          # sin tiro previo: decide la pérdida o la falta (clock del 1.er TL = reloj de la falta)
        elapsed = c1.start_clock − meta["mclock"][c1.end_event]
        if not (0 <= elapsed <= c1.shot_clock_start + 1): elapsed = None
    else:                                              # fin_periodo sin tiro, falta ni pérdida
        pos.ptype_reason = "sin_accion"; elapsed = SIN
    if elapsed is None: pos.ptype_reason = "reloj_no_derivable"
    elif elapsed is not SIN:
        pos.first_elapsed = elapsed
        pos.ptype = ("transicion" if elapsed <= cut_t else "early" if elapsed <= cut_e else "media_cancha")
    # 2) finalización (último evento de la posesión) — RF-8
    et = pos.end_type
    if et in ("t2c", "t2f"):
        sub = (idx[pos.shots[-1]["action_number"]][1].get("sub_type") or "").lower()
        pos.finish_kind = "bandeja_volcada" if sub in LAYUP else "otro_2"
    elif et in ("t3c", "t3f"):
        pos.finish_kind = "triple_esquina" if pos.shots[-1]["zone"] in ("left_corner_3", "right_corner_3") else "triple_frontal"
    elif et == "falta":   pos.finish_kind = "tiro_libre"
    elif et == "perdida": pos.finish_kind = "perdida"
    else:                 pos.finish_kind = "fin_periodo"
    # 3) jugador que finaliza — RF-10
    pos.end_player_id = (pos.shots[-1]["player_id"] if et in ("t2c","t2f","t3c","t3f")
                         else pos.turnover_by_id if et == "perdida"
                         else foulon_player(events, idx, c1/última chance, pos.team) or pos.finisher_id if et == "falta"
                         else None)
    # 4) jugador que inicia — RF-10 (solo orígenes con evento de recuperación individual)
    if pos.origin == "rebote_defensivo":
        ev = idx[pos.start_event][1]                   # A-01: la posesión se abre en el propio rebote defensivo
        pos.starter_id = meta["name_to_id"].get((ev["team_code"], ev.get("player_name"))) or None
    elif pos.origin == "robo" and k > 0:
        steal = steal_linked(events, idx, possessions[k-1].end_event, pos.team)   # steal.previous_action == turnover de la posesión previa; fallback: último `steal` del equipo entre prev.end_event y pos.start_event
        pos.starter_id = meta["name_to_id"].get((steal["team_code"], steal.get("player_name"))) if steal else None
```
- Una posesión puede tener `ptype = None` con razón: `incompleta` (A-01), `sin_accion`, `reloj_no_derivable`; nunca se imputa a un tipo ni a 0 (RF-3).
- `elapsed` tiene resolución de 1 s (reloj derivado; centésimas solo en el último minuto): un tiro "a los 7,4 s" se lee como 7 → transición. Documentado como limitación en `docs/metrics.md`.
- `foulon_player(...)`: último evento `foulon` del equipo atacante dentro del rango de eventos de la oportunidad terminal; `None` si no hay (queda `finisher_id` de A-01 si hubo TL convertido).
- Caché: el enriquecido queda dentro del caché de `game_possessions` (`poss:game`, clave con `data_version`/`config_version`): cambiar un corte en S9 invalida y reclasifica sin reiniciar (RF-16, CA-4).
- Complejidad: una pasada lineal por partido (< 1 ms adicional por partido sobre el costo de A-01).

### 4.2 `transition_report(entity_type, entity_id, comp_id, ctx, *, side="ataque") -> dict`
```
ctx_t = replace(ctx, ptype=None)                                 # el filtro ptype no aplica a esta vista (context.ignored: no_aplica)
poss  = possessions.team_possessions(team, comp_id, ctx_t, side=side, include_incomplete=True)
incomp = [p for p in poss if p.incomplete]
complete = [p for p in poss if not p.incomplete]
classified = [p for p in complete if p.ptype]
unclassified = Counter({"incompleta": len(incomp)}) + Counter(p.ptype_reason for p in complete if not p.ptype)
by_type = group classified by p.ptype                           # 3 claves exhaustivas y disjuntas (RF-1, CA-1)
for key, grp in by_type:
    c = counts(grp)       # n, pts, fga2/fgm2/fga3/fgm3/fta/ftm/tov (Σ p.box), duration_sum, first_sum/first_n (Σ shots[0].elapsed de las que tienen tiro)
    metrics = stats_engine.ptype_rates(c)                       # ppp, efg_pct, to_pct, ft_rate, duration_avg, first_shot_secs
    share   = n / len(classified)                               # suma exacta 1 (CA-1)
    sample  = sample.sample_level("split", n=n, unit="posesiones", team_poss=len(complete))
diff = {"ppp_trans_vs_half": ppp(transicion) − ppp(media_cancha), "ppp_early_vs_half": ppp(early) − ppp(media_cancha)}   # None si alguno es None
fichas (percentil/rank/avg/leader): population.attach_fichas({ppp, efg_pct, to_pct, ft_rate, ptype_share}, "ptype", f"{team}:{key}", pop_key)
      con pop_key = population.population("ptype", comp_id, replace(ctx_t, ptype=(key,)))   # PROPUESTA §10 D-3: población acotada al tipo
```
**Solo `side="ataque"`:**
- `first_shot`: sobre `classified` con `p.shots`: `mean = Σ shots[0].elapsed / n`, `hist` en tramos fijos `0-3, 4-7, 8-12, 13-18, 19+` (por defecto alineados con los cortes; no se mueven con la configuración), `without_shot` = clasificadas sin tiro (RF-7, CA-9).
- `origin_of_transition`: `trans = by_type["transicion"]`; agrupar por `p.origin` con los grupos `rebote_defensivo`, `robo`, `canasta_rival`, `perdida_rival` y `otros` (= `saque_banda` + `tiempo_muerto` + `tiro_libre_rival`); por grupo `transitions`, `share = transitions/len(trans)`, `pts`, `ppp = pts/transitions`, `origin_possessions` = posesiones **clasificadas** del grupo de origen y `origin_runs_share = transitions/origin_possessions` (RF-6, CA-8: `Σ transitions == len(trans)`).
- `finish_in_transition`: `trans` agrupadas por `p.finish_kind` en las seis categorías; `fin_periodo` va a `finish_period_end` y no entra en `share` (RF-8, CA-10).
- `dreb_to_transition`: `drb = [p for p in classified if p.origin == "rebote_defensivo"]`; `to_transition = [p in drb if ptype == "transicion"]`; `scored = [p in to_transition if p.pts > 0]`; `share = len(to_transition)/len(drb)` y `scored_share = len(scored)/len(to_transition)`; denominador 0 → `null` `sin_intentos` (RF-9, CA-11).
- `players`: sobre `trans`: `initiated[pid]` por `p.starter_id`, `finished[pid]` y `finished_pts[pid]` por `p.end_player_id` / `p.pts`, `assists_in_transition[pid]` por `p.assister_id` en transiciones con `pts > 0`; `ppp_personal = finished_pts/finished` (null `sin_intentos` si 0); nombre vía `identity.player_card`; muestra `sample.sample_level("split", n=finished, unit="posesiones", …)`; `players_coverage = {initiator_identified: #trans con starter_id, transitions: len(trans)}` (RF-10, CA-12). Orden: `finished` desc, luego `initiated` desc, luego `player_id`.
- `pass_out = {"value": None, "reason": "no_registrado", "note": "FIBA no registra los pases, solo el que termina en asistencia."}` (RF-11, CA-13).
- `reconcile = reconcile_fastbreak(team, comp_id, ctx_t)` (§4.4).

**Solo `side="defensa"`** (`poss` = posesiones del rival; `types`/`diff` calculados igual sobre ellas):
- `conceded_per100 = 100 × len(trans_rival) / len(classified_rival)` (null `sin_intentos` si 0) (RF-13).
- `conceded_by_origin`: transiciones del rival agrupadas por origen visto desde el atacante: `perdida_propia` = {`robo`, `perdida_rival`}, `tiro_fallado` = {`rebote_defensivo`}, `canasta_propia` = {`canasta_rival`}, `otros` = {`saque_banda`, `tiempo_muerto`, `tiro_libre_rival`}; cantidad, `share`, `pts`, `ppp` (RF-13).
- `own_turnovers_to_transition` (RF-14): por partido de la selección, sobre `ps = game_possessions(gid)` ordenadas: para cada `p` propia completa con `end_type == "perdida"` que cumple `context.possession_predicate(ctx_t)`, `q = ps[i+1]`; si `q.team == p.opp` y mismo período: `q.incomplete` → `excluded_next_incomplete += 1`; si no, `own_turnovers += 1`, `followed_by_transition += (q.ptype == "transicion")`, `followed_by_scored_transition += (q.ptype == "transicion" and q.pts > 0)`. `share = followed/own_turnovers`, `scored_share = scored/followed`.
- `balance` (RF-15): `rival_scored_transitions = #{q en rival: q.origin == "rebote_defensivo" and q.ptype == "transicion" and q.pts > 0 and follows_fg_miss(q)}` con `follows_fg_miss(q)` = el evento de apertura es un rebote cuyo `previous_action` (o, sin vínculo, el último tiro previo del mismo período) es `2pt`/`3pt` fallado propio (no tiro libre); `fg_misses = Σ (fga − fgm)` de `p.box` de las posesiones propias completas (`team_possessions(..., side="ataque")`); `share = rival_scored_transitions/fg_misses`; `per100_possessions = 100 × rival_scored_transitions / posesiones propias clasificadas`. Misma aproximación que `cost_of_oreb` de A-04 (D-4), aquí con el tipo del cliente (primeros `transition.max_secs`).

### 4.3 `player_transition(player_id, comp_id, ctx) -> dict`
```
games = equipos del jugador con pbp en la selección (filter_games de su equipo)
poss  = team_possessions(team, comp_id, ctx_t, side="ataque")                    # posesiones completas del equipo
mine  = [p for p in poss if p.end_player_id == player_id and p.ptype]          # finalizadas por el jugador
types = por ptype: possessions=len, pts=Σ p.pts, ppp=pts/len, efg_pct (Σ p.box con shots del propio jugador), share = len/len(mine)
runner = {initiated: #{p: p.starter_id == player_id and p.ptype == "transicion"}, initiated_pts, assists_in_transition: #{p: p.assister_id == player_id and p.ptype == "transicion" and p.pts > 0}}
```
Sin posesiones finalizadas → `types` con `possessions: 0` y métricas `null` `sin_intentos`; jugador de un equipo sin pbp → 404 `sin_pbp`.

### 4.4 `reconcile_fastbreak(team_code, comp_id, ctx) -> dict` (RF-21, no bloqueante)
```
for game in partidos del equipo en la selección con pbp:
    tgs = repository.team_game_rows(comp_id)[(game_id, team)]
    if tgs.ingest_version is None or tgs.ingest_version < ingest.INGEST_VERSION: excluded.append({game_id, reason: "no_registrado"}); continue
    calc      = Σ p.pts de game_possessions(game_id) con p.team == team, completas y p.ptype == "transicion"
    official  = tgs.fast_break_pts                                      # box FIBA (PCA)
    qualifier = Σ puntos de tiros de campo convertidos del equipo con 'fastbreak' ∈ qualifiers
    per_game.append({game_id, date, calc, official, qualifier})
return {ptype_pts_transition: Σcalc, fast_break_pts_official: Σofficial, fastbreak_qualifier_pts: Σqualifier, games_compared, games_excluded, per_game}
```
Solo informa; ninguna diferencia produce error ni alerta (criterios distintos: FIBA marca contraataque por jugada, no por segundos).

### 4.5 `stats_engine.ptype_rates(c: dict) -> dict` (regla 4: fórmulas)
```
base = origin_rates(c)                    # A-02: ppp = pts/n · efg_pct = (fgm2+fgm3+0.5·fgm3)/(fga2+fga3) · to_pct = tov/n · ft_rate = fta/(fga2+fga3) · duration_avg = duration_sum/n
first_shot_secs = _safe_div(c.first_sum, c.first_n)
share           = _safe_div(c.n, c.classified)
```
Fórmulas idénticas al glosario v2 §6 y a la conciliación §2.2 de la arquitectura (PPP, eFG%, TO%, FT Rate); A-03 solo las aplica sobre el subconjunto de posesiones de cada tipo.

### 4.6 `ptype_bundles(req)`, dimensión de contexto y tabla
- `StatBundle(entity_type="ptype", entity_id="CNF:transicion", own=<Σ p.box de las posesiones del tipo>, opp=<Σ p.opp_box>, games=<partidos con ≥ 1 posesión del tipo>, minutes=None, seconds=Σ p.duration, possessions_counted=n)`; `compute_standard` devuelve `no_aplica` en `pace`, `minutes`, `uso_*` (el catálogo declara `ptype` solo para las claves de posesión). Claves propias (grupo `extra`, `MetricDef`): `ptype_share` (pct, neutral, fixed) y `first_shot_secs` (dec1, neutral, fixed).
- `context.register_dimension("ptype", level="posesion", values=("transicion","early","media_cancha"), parser=_parse_ptype)` (CSV; valores fuera del enum → 400 `contexto_invalido`). `context.possession_predicate` recibe la rama `ptype`: `p.ptype in ctx.ptype` (las posesiones con `ptype = None` quedan fuera mientras el filtro esté activo). `GET /api/context/options` pasa `available: true` para `ptype`.
- `table_rows(req)`: tres filas (tipos), N filas (orígenes) o N filas (jugadores) según `section`; cada fila es un `StatBundle` del grupo más columnas propias (`possessions`, `share`, `duration_avg`, `first_shot_secs`) declaradas `type: "metric"` con metadatos en el catálogo.

### Manejo de nulos (C-11)
Posesión incompleta, sin acción o sin reloj derivable nunca aporta a un tipo ni a 0 (RF-3). Tipo sin posesiones → métricas `null` con razón `sin_intentos`, `possessions: 0` (la fila nunca se omite). `first_shot_secs` nulo si ninguna posesión del tipo tuvo tiro. Equipos o partidos sin pbp → `sin_pbp` y `context.games_excluded`. Partidos sin ingesta v2 → fuera de la conciliación con razón `no_registrado`.

## 5. Frontend — capa API (api.js)
- `api.transition({team, player, side, ...context})` → `apiFetch("/api/transition" + qs(params))`.
- Reutiliza `api.table("team_ptypes", params)` (T-06), `api.metrics("ptype", params)` (T-05), `api.ranking(...)` (T-01) y `api.settings()` (F-13) para leer los cortes que muestra la leyenda.

## 6. Frontend — UI
- **Ubicación**: S3 Equipo → pestaña `posesion` (`#/equipo/<code>/posesion?…`), segundo sub-bloque "Transición y contraataque" (después de "Origen de la posesión", antes de "Segunda oportunidad" y "Tramo de reloj"); S4 Jugador → pestaña `posesion` (modo jugador). X-01 ya existe en fase 3: `registerTab("equipo", {slug: "posesion", enabled: true, …})` lo hace A-02 (o el primero en implementarse).
- **Componentes reutilizados** (Arq. §8): `metric-card.js` (fichas de frecuencia, PPP, eFG%, TO%), `sample-badge.js`, `data-table.js` (tabla de tipos, de origen y de corredores con `tableId: "team_ptypes"`), `export-menu.js`, `core/format.js` (`fmtNumber`, `nullDisplay`, `PCT`), `core/colors.js` (`percentileColor`), `core/context.js`, `context-bar.js`. Sin `t()` (DA-21 resuelta: el copy va en español directo y F-21 lo extrae).
- **Nuevo**: `components/transition-panel.js` → `renderTransitionPanel(el, payload, {mode: "team"|"player"})` (PROPUESTA):
  1. Fila de fichas: Frecuencia de transición (destacada, "Identidad de juego") · PPP transición · PPP media cancha · Diferencial (verde si > 0) · Seg. al primer tiro.
  2. Tabla de tipos (T-06) + leyenda de cortes: "Transición: hasta {transition.max_secs} s · Early: hasta {early_offense.max_secs} s · Media cancha: desde el segundo {early+1}".
  3. Origen del contraataque (tabla) y distribución de finalización (barra apilada + tabla); histograma de segundos al primer tiro con barras CSS (sin Chart.js).
  4. Fichas "% de rebotes defensivos que corren" y "Terminan en anotación".
  5. Tabla de corredores con la leyenda de cobertura y la fila "Primer pase de salida: —" con razón `no_registrado`.
  6. Selector Ataque/Defensa (chips) → recarga con `side`; en defensa el título cambia a "Transición concedida" y se muestran las fichas (PPP concedido en transición vs media cancha · Transiciones cada 100 posesiones · Pérdidas que el rival corre · Balance defensivo) y la tabla de origen concedido.
  7. Pie: leyenda de conciliación de posesiones y enlace "Ver validación con FIBA" (lista de partidos: puntos reconstruidos vs `fast_break_pts`).
- **Estados**: spinner mientras carga; vacío/errores/offline con el copy del spec §6; filas de muestra baja en gris sin color de rendimiento.
- **Mobile 768 px**: fichas en grilla de 2 columnas (1 columna < 480 px), tablas con columna fija, chips a ancho completo.

## 7. Navegación
Sin sección nueva. Usa la pestaña `posesion` de S3/S4 (X-01, Arq. §3.12); el estado Ataque/Defensa va en la query del hash como `side=defensa` (PROPUESTA: parámetro de vista, no de contexto; no se propaga al cambiar de sección, mismo patrón que A-02 y A-04). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/transition`: ejemplo completo en §3. Objetos métrica = §7.1 (T-01) con `sample` §7.2; nulos §7.4 (`sin_intentos`, `no_registrado`, `sin_pbp`, `no_aplica`).
- Tabla `team_ptypes`: §7.6. Entidad `ptype`: §7.3.
- Campos nuevos de `Possession` (PROPUESTA, en `possessions.py`, completados solo por `enrich_ptype`): `first_elapsed: int | None`, `ptype_reason: str | None` (`incompleta` | `sin_accion` | `reloj_no_derivable`), `finish_kind: str | None` (`bandeja_volcada` | `otro_2` | `triple_esquina` | `triple_frontal` | `tiro_libre` | `perdida` | `fin_periodo`), `starter_id: int | None`, `end_player_id: int | None`. Los reutilizan A-04, A-05 y A-07. `Possession.ptype` ya existe (reservado por A-01).
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `parametro_invalido` | "Indicá un equipo o un jugador." / "El lado debe ser ataque o defensa." |
| 400 | `contexto_invalido` | mensaje de `parse_context` |
| 401 | — | handler global de `api.js` (login) |
| 404 | `no_encontrado` | "No encontramos ese equipo o jugador." |
| 404 | `sin_pbp` | "Este equipo no tiene play-by-play importado. Reimportá sus partidos." |
| 429 | — | "Demasiadas solicitudes. Esperá un momento." (existente) |
Offline: `/api/*` siempre a red; el panel muestra "Sin conexión: el análisis de posesiones necesita conexión." Si X-01 no pasó a runtime caching, sumar `js/components/transition-panel.js` a `STATIC` y subir `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **D-1 · Endpoint propio (PROPUESTA).** La arquitectura fija la tabla `team_ptypes` y el tipo `ptype`, pero no un endpoint para resumen, origen, finalización, corredores y bloque defensivo. Se propone `GET /api/transition` (mismo patrón que `/api/origins` y `/api/second-chance`). Reportado en huecos.
- **D-2 · Campos nuevos en `Possession` y `include_incomplete` (PROPUESTA).** `Possession` solo reserva `ptype`; los cinco campos auxiliares de §8 son necesarios para finalización y corredores y los reusan A-04/A-05/A-07. `team_possessions(..., include_incomplete=False)` (A-01) permite contar las incompletas en `summary.unclassified` sin duplicar el filtrado de contexto. Se agregan sin cambiar firmas existentes (Arq. §0.3).
- **D-3 · Población acotada al tipo (PROPUESTA).** `population.population(entity_type, comp_id, ctx)` enumera entidades; para `ptype` (como para `origin` en A-02) los miembros serían `<equipo>:<tipo>` de los tres tipos mezclados y el percentil de "PPP en transición" compararía contra todos los tipos. Se invoca con `ctx` acotado (`replace(ctx, ptype=(key,))`) para que el loader solo devuelva el tipo pedido por equipo. Reportado en huecos (T-01 debería documentarlo para entidades con subclave).
- **D-4 · `possession_predicate` por dimensión (PROPUESTA).** T-03 entrega `possession_predicate` como stub y `register_dimension` sin predicado; cada dueño de dimensión agrega su rama en `context.py` (A-02 `origin`, A-03 `ptype`, A-04 `chance`, A-05 `clock`). Reportado en huecos.
- **D-5 · Posesiones `sin_accion` fuera del reparto.** Alternativa descartada: asignarlas por duración (inflaría `media_cancha` con posesiones agotadas por el reloj del cuarto). Cambiar el criterio toca solo `enrich_ptype`.
- **D-6 · Primer pase de salida no calculable.** Se declara `no_registrado` en lugar de inferirlo (cualquier inferencia de "quién saca" sería inventada). El sustituto (asistencias en transición) se rotula como aproximación.
- **D-7 · Resolución de 1 s.** Los cortes (7 y 12 s) se evalúan sobre reloj derivado de 1 s: un tiro a 7,4 s cuenta como 7. Aceptable y configurable; documentar en `docs/metrics.md`.
- **D-8 · Coordenadas de tiro.** La distinción esquina/frontal de los triples depende de `shot_zones.classify_zone` (C-03) con coordenadas reales (F-11, DA-32). En partidos no reprocesados todos los triples caen en una zona por defecto y la fila "Triple de esquina" subestima; la leyenda de conciliación lo avisa con "Reprocesá los partidos para ver esquina y frontal" cuando `has_coordinates` es falso.
- **D-9 · Reloj reiniciado a 14.** Las oportunidades 2.ª+ tienen reloj de 14 s: el primer evento de decisión se mide siempre en la oportunidad 1 de la posesión (reloj de 24), así que el tipo no se contamina con el reinicio. El análisis de las oportunidades con reloj de 14 es de A-05.
- Desviaciones respecto de la arquitectura: ninguna de contrato; solo las PROPUESTAS anteriores y la **activación** de claves ya declaradas por F-13 (la arquitectura §3.2 dice que A-03 las "agrega"; F-13 las declara como reservadas y A-03 las activa, ver [F-13 plan §10 D-1](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
- **Dependencias técnicas:**
  - A-01 `possessions.game_possessions`, `team_possessions`, `register_enricher`, `Possession`, `Chance` ([../01-A-01-motor-posesiones/plan.md](../01-A-01-motor-posesiones/plan.md)).
  - A-02 `Possession.origin`, `stats_engine.origin_rates` ([../02-A-02-origen-posesion/plan.md](../02-A-02-origen-posesion/plan.md)).
  - F-13 `config.get`, `CONFIG_SPEC` ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
  - F-11 `pbp_events.previous_action`/`qualifiers`, `ingest.INGEST_VERSION`, `repository`, `cache` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - T-05 `StatBundle`, `compute_standard`, `register_entity` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-02 `sample.sample_level` ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-01 `population.population`, `attach_fichas` ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - T-06 `tables.register_table`, `data-table.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - C-03 `shot_zones.classify_zone` (zonas de esquina) ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)).
  - C-08 `identity.player_card` (nombre del jugador) ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)).
  - T-03 `context.register_dimension`, `parse_context` ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - X-01 `registerTab`, vistas `equipo.js`/`jugador.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: L · 12–18 h** (enriquecedor y atributos auxiliares 3 h, agregación ofensiva y finalización 3 h, bloque defensivo y cruces 2–3 h, corredores y nivel jugador 1–2 h, registros T-03/T-05/T-06 y activación de config 1–2 h, UI 3 h, verificación y docs 2–3 h). Ajuste sobre la arquitectura (10–16 h): +2 h por el bloque defensivo completo y la validación cruzada con FIBA.
