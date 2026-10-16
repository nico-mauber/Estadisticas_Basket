# Plan — A-07: Producción desde eventos

> **ID:** A-07 · **Prioridad:** P1 · **Fase y orden:** 5·06
> **Depende de:** A-01 · A-02 · A-03 · A-04 · F-01 (y T-05, T-01, T-02, T-03, T-06, X-01, F-11, F-13) — rutas relativas en `spec.md` encabezado y §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §5.4 · A-07 · Arquitectura §3.9, §3.8, §3.14, §4 (`chains.py`), §6, §7, §8, §9.2 I-11
> **Estimación:** L · 14–20 h

## 1. Enfoque
`backend/chains.py` ya existe (lo crea F-01 con `assist_points`, `oreb_points`, `steal_points`, `turnover_cost`, firmas fijadas en
`../../fase-4-dia-de-partido/03-F-01-partido-en-vivo/plan.md` §4). A-07 lo **extiende sin tocar esas cuatro firmas**: agrega (1) un
enriquecedor `enrich_chains` registrado en `possessions.register_enricher` (A-01) que completa en cada `Possession` los vínculos
que A-01/A-02/A-04 no guardan (quién y qué evento de robo o rebote defensivo abrió la posesión), (2) el análisis histórico
`events_report` por equipo y por jugador con desenlaces y tasas, (3) el vínculo exacto asistente → receptor
(`assist_pairs_from_events`) que consumirá A-08, (4) el loader del tipo de entidad `chain` de T-05, (5) la tabla `events_production`
de T-06 y (6) la conciliación. Las fórmulas de tasas van a `stats_engine.py` (regla 4); todo se calcula on-the-fly y se cachea
por `data_version`/`config_version` (`cache.memo`); sin cambios de esquema. Una ruta fina `GET /api/events-production`
(Arq. §6) sirve la pestaña Eventos de S3/S4, que monta un componente nuevo `events-panel.js`.

Principio de coherencia con A-04: el bloque de rebotes ofensivos **no recalcula** puntos ni conversión: agrega los mismos
`Chance` de A-04 con el mismo criterio de partición, y la verificación compara ambos endpoints.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/chains.py` | module (F-01, **extender**) | `enrich_chains` (enriquecedor), `events_report`, `_assist_block`, `_oreb_block`, `_dreb_block`, `_steal_block`, `_turnover_block`, `assist_pairs_from_events`, `reconcile_chains`, `chain_bundles` (loader `chain`/`chain_player`), `table_rows` (builder T-06), helpers `_finish_kind`, `_next_poss` | RF-1…RF-24 |
| `backend/possessions.py` | module (A-01, **extender**) | campos nuevos en `Possession`: `steal_event`, `steal_by_id`, `dreb_event`, `dreb_by_id`; parámetro `include_incomplete: bool = False` en `team_possessions` (PROPUESTA, §10) | RF-2, RF-8, RF-12, RF-14 |
| `backend/stats_engine.py` | module (extender) | `chain_rates(counts)`: fórmulas de tasas por cadena (regla 4) | RF-4…RF-6, RF-10, RF-12, RF-15, RF-17 |
| `backend/metrics_catalog.py` | module (T-05, registrar) | `register_entity("chain", chain_bundles)` y `register_entity("chain_player", chain_bundles)` (PROPUESTA); 9 `MetricDef` de grupo `extra` | RF-20, RF-21 |
| `backend/tables.py` | module (T-06, registrar) | `register_table("events_production", entity_type="chain", …)` | RF-22 |
| `backend/data_quality.py` | module (F-11, registrar) | check opcional `chains_tov_mismatch` (partidos donde puntos tras pérdida rival ≠ `pts_from_tov`) vía `register_check` | RF-23 |
| `backend/app.py` | route | `GET /api/events-production` (fina: `parse_context`, delega en `chains.events_report`) | RF-1, RF-3 |
| `frontend/js/api.js` | js-api | `api.eventsProduction(params)` | RF-1…RF-24 |
| `frontend/js/components/events-panel.js` | js-component (NUEVO, PROPUESTA de nombre) | `renderEventsPanel(el, payload, {mode: "team"\|"player"})`: cinco cards, fichas, badges, aviso de vínculo, conciliación | RF-1…RF-24 |
| `frontend/js/views/equipo.js` | js-view (X-01) | pestaña `eventos`: monta el panel (modo equipo) y la tabla `events_production` | RF-1, RF-22 |
| `frontend/js/views/jugador.js` | js-view (X-01) | pestaña `eventos`: monta el panel (modo jugador) | RF-1 |
| `frontend/css/style.css` | css | sección `/* ── events-panel (A-07) ── */` (cards, barra apilada de desenlaces, aviso) | RF-1 |
| `frontend/sw.js` | sw | sumar `js/components/events-panel.js` a `STATIC` y subir `CACHE` solo si X-01 no migró a runtime caching | — |
| `docs/api.md` | doc | `GET /api/events-production`, tabla `events_production`, tipos `chain`/`chain_player` | cierre |
| `docs/metrics.md` | doc | definición de consecuencia por evento, partición doble/triple/2+1, "castigada", horizonte de una posesión, fuente derivada | cierre |
| `docs/frontend.md` | doc | pestaña Eventos de S3/S4 y su copy | cierre |
| `docs/architecture.md` | doc | `chains.py` (análisis completo), campos nuevos de `Possession` | cierre |

Matriz RF → archivo: RF-1 `events-panel.js`, `equipo.js`, `jugador.js`, `app.py` · RF-2 `chains.py`, `possessions.py` · RF-3 `app.py`
(`parse_context`), `chains.py` · RF-4/RF-5/RF-6 `chains._assist_block`, `stats_engine.chain_rates` · RF-7 `chains._assist_block`,
`assist_pairs_from_events` · RF-8 `chains._assist_block`, `possessions.py` (`include_incomplete`) · RF-9/RF-10/RF-11
`chains._oreb_block` (sobre `Chance` de A-04) · RF-12/RF-13 `chains._dreb_block`, `enrich_chains` · RF-14/RF-15 `chains._steal_block`,
`enrich_chains` · RF-16/RF-17/RF-18 `chains._turnover_block` · RF-19 `stats_engine.py` (`_safe_div`), `chains.py` · RF-20 `chains.py`
(`population.attach_fichas`, `sample.sample_level`), `events-panel.js` · RF-21 `chains.chain_bundles`, `metrics_catalog.py` · RF-22
`tables.py`, `chains.table_rows` · RF-23 `chains.reconcile_chains`, `data_quality.py` · RF-24 `enrich_chains` (respaldo), `chains.py`.

## 3. Backend — rutas y modelos

**Sin cambios de esquema** (Arq. §5). Sin claves de configuración nuevas.

### `GET /api/events-production` — NUEVO (ruta y método fijados en Arq. §6; el shape es de este plan) · `login_required`
- Query: `entity=team|player` (obligatorio), `id=<team_code|player_id>` (obligatorio), más el contexto de T-03 completo
  (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, `clock`, `clock_start`, `origin`, `ptype`,
  `chance`; ver Arq. §3.8). Sin `base` (los desenlaces son conteos y tasas por evento; se muestran en total).
  En fase 5 el contexto lo parsea `context.parse_context(request.args, team_code=…, player_id=…)`; los parámetros inválidos →
  400 `contexto_invalido`.
- Respuesta 200 (modo equipo; valores ilustrativos). Cada objeto métrica es la ficha T-01 (§7.1) acotada a los campos que
  aplican; sin población o muestra baja → `percentile`/`rank`/`avg`/`leader` en `null` con `pct_reason`:
```json
{
  "entity": {"type": "team", "id": "CNF", "name": "Nacional"},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {}, "ignored": [],
              "level": "posesion", "population_mode": "apply_all", "games_used": 13, "games_total": 13,
              "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "link": {"games_v2": 13, "games_legacy": 0, "link_fallback": 0,
           "warning": null},
  "blocks": {
    "assists": {
      "events": {"pbp": 63, "linked": 60, "unlinked": 1, "in_incomplete": 2},
      "metrics": {
        "ast_linked": {"value": 60, "reason": null},
        "ast_pts": {"value": 128, "reason": null},
        "ast_pts_avg": {"value": 2.133, "reason": null, "rank": 4, "rank_total": 12, "tied": false, "percentile": 73,
                        "avg": 2.05, "dist_avg": 0.083, "leader": {"id": "PEN", "name": "Peñarol", "value": 2.21},
                        "dist_leader": -0.077, "in_population": true}
      },
      "kinds": [
        {"key": "doble", "label": "A doble", "count": 33, "share": 0.55, "pts": 66},
        {"key": "triple", "label": "A triple", "count": 20, "share": 0.333, "pts": 60},
        {"key": "and_one", "label": "A 2+1", "count": 7, "share": 0.117, "pts": 18}
      ],
      "top_pair": {"assister_id": 812, "assister": "S. Canty", "scorer_id": 790, "scorer": "E. Oglivie", "count": 9, "pts": 19},
      "top_receiver": {"player_id": 790, "name": "E. Oglivie", "count": 14, "pts": 29},
      "sample": {"level": "alta", "unit": "posesiones", "n": 60, "min": 15, "high": 40, "ranked": true}
    },
    "oreb": {
      "events": {"pbp": 51, "captured": 50, "in_incomplete": 1},
      "metrics": {
        "oreb_pts": {"value": 57, "reason": null},
        "pts_per_oreb": {"value": 1.14, "reason": null, "percentile": 66},
        "oreb_conversion": {"value": 0.5, "reason": null, "percentile": 70}
      },
      "outcomes": [
        {"key": "putback", "label": "Putback", "count": 14, "share": 0.28, "pts": 28, "ppp": 2.0},
        {"key": "doble", "label": "Doble", "count": 6, "share": 0.12, "pts": 12, "ppp": 2.0},
        {"key": "triple", "label": "Triple", "count": 5, "share": 0.1, "pts": 15, "ppp": 3.0},
        {"key": "falta_recibida", "label": "Falta recibida", "count": 3, "share": 0.06, "pts": 2, "ppp": 0.667},
        {"key": "perdida", "label": "Pérdida", "count": 4, "share": 0.08, "pts": 0, "ppp": 0.0},
        {"key": "sin_puntos", "label": "Sin puntos", "count": 18, "share": 0.36, "pts": 0, "ppp": 0.0}
      ],
      "team_rebounds": {"count": 7, "pts": 6},
      "sample": {"level": "alta", "unit": "posesiones", "n": 50, "ranked": true}
    },
    "dreb": {
      "events": {"pbp": 120, "opened_possession": 118, "in_incomplete": 2},
      "metrics": {
        "drb_pts": {"value": 121, "reason": null},
        "drb_pts_avg": {"value": 1.025, "reason": null, "percentile": 52},
        "drb_fb_pct": {"value": 0.186, "reason": null, "percentile": 61},
        "drb_fb_scored_pct": {"value": 0.591, "reason": null, "percentile": 45},
        "first_outlet_pass": {"value": null, "reason": "no_registrado"}
      },
      "fastbreak": {"started": 22, "scored": 13, "pts": 30, "ppp": 1.364},
      "sample": {"level": "alta", "unit": "posesiones", "n": 118, "ranked": true}
    },
    "steals": {
      "events": {"pbp": 62, "with_next_possession": 60, "no_next_possession": 1, "in_incomplete": 1},
      "metrics": {
        "stl_pts": {"value": 66, "reason": null},
        "stl_pts_avg": {"value": 1.1, "reason": null, "percentile": 60},
        "stl_conversion_pct": {"value": 0.517, "reason": null, "percentile": 58},
        "ppp_after_recovery": {"value": 1.12, "reason": null},
        "ppp_all_possessions": {"value": 0.97, "reason": null}
      },
      "outcomes": [
        {"key": "doble", "label": "Doble", "count": 22, "share": 0.367, "pts": 46},
        {"key": "triple", "label": "Triple", "count": 5, "share": 0.083, "pts": 15},
        {"key": "falta_recibida", "label": "Falta recibida", "count": 4, "share": 0.067, "pts": 5},
        {"key": "perdida_posterior", "label": "Pérdida posterior", "count": 6, "share": 0.1, "pts": 0},
        {"key": "sin_conversion", "label": "Sin conversión", "count": 23, "share": 0.383, "pts": 0}
      ],
      "sample": {"level": "alta", "unit": "posesiones", "n": 60, "ranked": true}
    },
    "turnovers": {
      "events": {"pbp": 88, "with_next_possession": 85, "no_next_possession": 3, "in_incomplete": 0},
      "metrics": {
        "tov_pts_conceded": {"value": 79, "reason": null},
        "tov_cost_avg": {"value": 0.929, "reason": null, "percentile": 38},
        "tov_punished_pct": {"value": 0.482, "reason": null, "percentile": 41}
      },
      "outcomes": [
        {"key": "doble", "label": "Dobles recibidos", "count": 29, "share": 0.341, "pts": 60},
        {"key": "triple", "label": "Triples recibidos", "count": 6, "share": 0.071, "pts": 18},
        {"key": "falta_recibida", "label": "Faltas recibidas por el rival", "count": 6, "share": 0.071, "pts": 5},
        {"key": "sin_castigo", "label": "Sin castigo", "count": 44, "share": 0.518, "pts": 0}
      ],
      "team_turnovers": {"count": 9, "pts_conceded": 11},
      "sample": {"level": "alta", "unit": "posesiones", "n": 85, "ranked": true}
    }
  },
  "reconcile": {
    "assists": {"ok": true, "sum_kinds": 60, "linked": 60, "pbp": 63, "diff": 0},
    "oreb": {"ok": true, "sum_outcomes": 50, "captured": 50, "second_chance_api_pts": 57, "pts": 57},
    "dreb": {"ok": true},
    "steals": {"ok": true, "sum_outcomes": 60, "events": 62, "no_next_possession": 1, "in_incomplete": 1},
    "turnovers": {"ok": true, "sum_outcomes": 85, "events": 88, "no_next_possession": 3},
    "pts_from_tov": {"calc": 66, "official": 68, "diff": -2, "games_compared": 13,
                     "games_mismatch": [{"game_id": "2849340", "date": "2025-10-12", "calc": 4, "official": 6,
                                         "cause_hint": "criterio_fiba"}],
                     "games_excluded": []}
  }
}
```
- Modo jugador (`entity=player&id=812`): mismos cinco bloques sobre los eventos del jugador; `top_receiver` = a quién más asiste el
  jugador; `top_pair` se omite; `team_rebounds`/`team_turnovers` se omiten; `reconcile` incluye solo las sumas de desenlaces
  (el `pts_from_tov` oficial no existe por jugador). `entity.team_code` agrega el equipo del jugador.
- **Errores** (formato §7.8): 400 `parametro_invalido` "Indicá entity=team o entity=player y un id." · 400 `contexto_invalido`
  (mensaje de `parse_context`) · 404 `no_encontrado` "No encontramos ese equipo o jugador." · 404 `sin_pbp` "Este equipo no tiene
  play-by-play importado. Reimportá sus partidos." (todos los partidos de la selección sin pbp) · 401 sesión (handler global).

### `GET /api/table/events_production` — NUEVO (id fijado en Arq. §6; `register_table`, T-06)
- Params: `team=<team_code>` (obligatorio) + contexto + `base`; `section=desenlaces|jugadores` (PROPUESTA de parámetro de sección,
  mismo patrón que `team_second_chance` de A-04), `chain=asistencia|rebote_ofensivo|rebote_defensivo|robo|perdida` (obligatorio con
  `section=jugadores`).
- `section=desenlaces`: una fila por (cadena, desenlace). `section=jugadores`: una fila por jugador del equipo para la cadena elegida.
  Payload §7.6 con columnas `_name`, `_sample`, el conjunto estándar (todas las claves de T-05; `default_visible` solo las de
  `default_columns`) y las extra `events`, `share`, `pts_event`. `totals` = total de la sección; `competition_avg` = media de los
  equipos de la población para esa fila (solo `desenlaces`).

### `GET /api/metrics/chain?id=<team_code>:<cadena>` y `GET /api/metrics/chain_player?id=<player_id>:<cadena>` — NUEVO (tipos de entidad)
`chain` fijado en Arq. §6; `chain_player` es **PROPUESTA** (§10). Loader `chains.chain_bundles(req)`; payload §7.3 completo. `<cadena>` ∈
`asistencia`, `rebote_ofensivo`, `rebote_defensivo`, `robo`, `perdida`.

### Claves de métricas nuevas (catálogo, grupo `extra`; registro en `metrics_catalog.py`)
| Clave | Etiqueta | fmt | dir | base | Fórmula (`stats_engine.chain_rates`) |
|---|---|---|---|---|---|
| `ast_pts_avg` | Puntos por asistencia | dec2 | higher | fixed | `ast_pts / ast_linked` |
| `drb_pts_avg` | Puntos tras rebote defensivo | dec2 | higher | fixed | `drb_pts / drb_poss` |
| `drb_fb_pct` | % de RD que inician contraataque | pct | neutral | fixed | `drb_transition / drb_poss` |
| `drb_fb_scored_pct` | % de contraataques tras RD que anotan | pct | higher | fixed | `drb_transition_scored / drb_transition` |
| `stl_pts_avg` | Puntos tras robo | dec2 | higher | fixed | `stl_pts / stl_with_poss` |
| `stl_conversion_pct` | % de robos que terminan en puntos | pct | higher | fixed | `stl_scored / stl_with_poss` |
| `tov_cost_avg` | Costo por pérdida | dec2 | lower | fixed | `tov_pts_conceded / tov_with_next` |
| `tov_punished_pct` | % de pérdidas castigadas | pct | lower | fixed | `tov_punished / tov_with_next` |
| `first_outlet_pass` | Primer pase de salida | — | neutral | fixed | siempre nulo `no_registrado` |
Se reutilizan sin redefinir `pts_per_oreb` y `oreb_conversion` (A-04) y las métricas estándar de T-05.

## 4. Backend — lógica

### 4.1 Campos nuevos de `Possession` (A-01, PROPUESTA — se agregan sin cambiar los existentes, Arq. §0.3)
```
steal_event:  int | None      # action_number del `steal` que originó esta posesión (propia), si lo hubo
steal_by_id:  int | None      # player_id del que robó (None si el robo es de equipo o sin jugador)
dreb_event:   int | None      # action_number del `rebound` defensivo que abrió esta posesión
dreb_by_id:   int | None      # player_id del que capturó (None = rebote de equipo)
```
`Possession` ya trae `assister_id`, `finisher_id`, `turnover_by_id`, `end_type`, `pts`, `box`, `opp_box`, `chances`, `incomplete`
(A-01 plan §4.3 y §8); `Chance.oreb_by_id`, `Chance.outcome`, `Chance.pts` (A-04 plan §4.1 y §8); `Possession.origin`
(A-02), `Possession.ptype` (A-03).

### 4.2 `enrich_chains(possessions, events, meta) -> None` (registrado con `possessions.register_enricher("chains", …)`)
Se ejecuta **después** de los enriquecedores de A-02/A-03/A-04 (orden de registro = orden de importación; `chains.py` se importa
desde `app.py` después de `origin`, `transition`, `second_chance`).
```
idx        = {ev.action_number: ev for ev in events}
by_start   = {p.start_event: p for p in possessions}
by_end     = {p.end_event: p for p in possessions if p.end_event is not None}
by_id      = {p.poss_id: p for p in possessions}
pid(ev)    = meta.name_to_id.get((ev.team_code, ev.player_name)) or None          # None = equipo / sin jugador

para ev en events:
    si ev.action_type == "steal":
        tov = idx.get(ev.previous_action)                                         # vínculo FIBA (F-11)
        si tov es None o tov.action_type != "turnover":                           # RESPALDO (partidos sin ingesta v2)
            tov = último evento "turnover" del equipo rival, mismo período, con action_number < ev.action_number
                  y a lo sumo 3 eventos antes; contar link_fallback += 1
        lost = by_end.get(tov.action_number) si tov else None                     # posesión rival que cerró la pérdida
        nxt  = by_id.get(lost.poss_id + 1) si lost else None
        si nxt y nxt.team == ev.team_code: nxt.steal_event, nxt.steal_by_id = ev.action_number, pid(ev)
    si ev.action_type == "rebound" y "defensive" en ev.sub_type:
        p = by_start.get(ev.action_number)                                        # A-01: el RD abre la posesión
        si p y p.team == ev.team_code: p.dreb_event, p.dreb_by_id = ev.action_number, pid(ev)
```
- Posesión incompleta: no se enriquece (queda con los cuatro campos en `None`), pero se **cuenta** el evento como
  `in_incomplete` (el reporte lo calcula con `include_incomplete=True`).
- Un robo cuyo vínculo no se resuelve ni por `previous_action` ni por respaldo queda **sin posesión**: el reporte lo cuenta en
  `no_next_possession` (RF-8/RF-14), nunca lo ignora.
- El enriquecedor corre dentro del caché `poss:game` (clave con `config_version`): no agrega estado propio.
- Nulos: ningún campo se completa con 0; `None` significa "sin evento o sin jugador" y el reporte los distingue con
  `steal_event is not None and steal_by_id is None` = robo de equipo.

### 4.3 `_finish_kind(p) -> str | None` (helper)
```
si p.incomplete o p.end_type no está en {"t2c","t3c"}:  None
si p.box["fta"] >= 1:                                   "and_one"      # canasta + tiro libre adicional (RF-5)
si p.end_type == "t3c":                                 "triple"
si p.end_type == "t2c":                                 "doble"
```
`_outcome_after(p)` (consecuencia de la posesión siguiente, para robos, RD y pérdidas):
```
si p.incomplete:                         None   (se cuenta como in_incomplete)
si p.end_type == "t3c":                  "triple"          # incluye 3+1
si p.end_type == "t2c":                  "doble"           # incluye 2+1
si p.end_type == "falta":                "falta_recibida"  # solo tiros libres, sin canasta de campo
si p.end_type == "perdida":              "perdida_posterior"
si no (t2f, t3f, fin_periodo):           "sin_conversion"
```
Para pérdidas se renombra `sin_conversion` → `sin_castigo` y `perdida_posterior` → `sin_castigo` (el rival perdió el balón: no
castigó). `punished = p.pts > 0`.

### 4.4 `events_report(entity_type, entity_id, comp_id, ctx) -> dict`
```
si entity_type == "team":   team = entity_id; pid_filter = None
si entity_type == "player": team = player_card(player_id).team_code; pid_filter = player_id
all_p   = possessions.team_possessions(team, comp_id, ctx, side="ataque", include_incomplete=True)
done    = [p for p in all_p if not p.incomplete]
inc     = [p for p in all_p if p.incomplete]
games   = partidos usados (context.filter_games) → contexto + games_excluded.sin_pbp
si no hay partidos con pbp: 404 sin_pbp
nxt(p)  = _next_poss(p) = índice game_possessions(p.game_id)[p.poss_id + 1] (None si p fue la última o la siguiente es incompleta)
blocks = {
  "assists":   _assist_block(done, inc, pid_filter, ...),
  "oreb":      _oreb_block(done, inc, pid_filter, ...),
  "dreb":      _dreb_block(done, inc, pid_filter, ...),
  "steals":    _steal_block(done, inc, pid_filter, ...),
  "turnovers": _turnover_block(done, inc, pid_filter, ...),
}
fichas:  population.attach_fichas(metrics_clave, "chain"|"chain_player", f"{id}:{cadena}", pop)   # si T-01 ya cerrado
badges:  sample.sample_level("split", n=<eventos del bloque>, unit="posesiones", team_poss=len(done))
reconcile = reconcile_chains(...)
cache.memo("chains:report", (entity_type, entity_id, comp_id, context_key(ctx)), fn)
```
`include_incomplete=True` hace que `team_possessions` omita su paso "excluir incompletas" (A-01 §4.5 paso 3) y aplique solo los
filtros de partido/evento; con un filtro de nivel posesión (`origin`, `ptype`, `clock`, `chance`) las incompletas se descartan
igual por tener los atributos en `None` (queda registrado en `context.applied`).

### 4.5 `_assist_block`
```
assisted = [p for p in done if p.assister_id is not None and (pid_filter is None or p.assister_id == pid_filter)]
linked   = [p for p in assisted if _finish_kind(p) is not None]
unlinked = len(assisted) - len(linked)            # asistencia cuyo tiro vinculado no es canasta convertida (dato inconsistente)
in_inc   = Σ p.box["ast"] sobre inc que cumplen el filtro de jugador  (el jugador de la asistencia en incompletas: p.assister_id)
pbp      = len(linked) + unlinked + in_inc        # y se verifica contra el conteo de eventos assist del pbp (reconcile)
por kind: count, share = count/len(linked), pts = Σ p.pts
ast_pts  = Σ p.pts  (linked)
metrics  = stats_engine.chain_rates({ast_pts, ast_linked: len(linked)})
pares    = chains.assist_pairs_from_events(...)  → top_pair / top_receiver
```
- **top_receiver** (modo jugador): `Counter(p.finisher_id for p in linked)`; empate → nombre alfabético; modo equipo: receptor con
  más canastas asistidas recibidas y `top_pair` = (`assister_id`, `finisher_id`) más frecuente.
- `finisher_id` nulo (canasta sin jugador identificado) → no entra en `top_*` y se cuenta como `scorer: null` ("Sin jugador").

### 4.6 `_oreb_block` (coherente con A-04)
```
chs = [(p, c) for p in done for c in p.chances if c.n >= 2 and (pid_filter is None or c.oreb_by_id == pid_filter)]
        # en modo equipo entran también los de equipo (oreb_by_id None) → fila team_rebounds
outcome_a07(c) = según c.outcome de A-04:
    "putback" → "putback"
    "kickout_triple" → "triple"
    "reinicio" | …  → por c.end_type: "t3c" → "triple", "t2c" → "doble"
    "falta_recibida" → "falta_recibida" ; "perdida" → "perdida" ; "sin_puntos" → "sin_puntos"
puntos = Σ c.pts ; captured = len(chs) ; conversion = #{c.pts > 0}/captured ; pts_per_oreb = puntos/captured
```
Invariante: `Σ por outcome = captured`; `puntos` = `pts_2nd` del summary de `second_chance_report` (A-04) para el equipo (se
verifica en `reconcile.oreb`). Si A-04 cambiara su partición, A-07 hereda `c.outcome` y solo remapea `doble/triple`.
En incompletas: `in_incomplete` = `Σ #{c.n >= 2}` de `inc`.

### 4.7 `_dreb_block`
```
dr = [p for p in done if p.dreb_event is not None and (pid_filter is None or p.dreb_by_id == pid_filter)]
drb_poss = len(dr) ; drb_pts = Σ p.pts ; transition = [p for p in dr if p.ptype == "transicion"]
scored = #{p.pts > 0 en transition} ; fastbreak = {started: len(transition), scored, pts: Σ pts, ppp: pts/started}
first_outlet_pass = {"value": None, "reason": "no_registrado"}                 # RF-13
```
`p.ptype is None` (posesión sin tipo, A-03) → no cuenta como transición y se informa `ptype_unknown` en `events`.

### 4.8 `_steal_block`
```
st = [p for p in done if p.steal_event is not None and (pid_filter is None or p.steal_by_id == pid_filter)]
no_next = robos del pbp del equipo (eventos steal) − len(st) − in_incomplete          # sin vínculo/posesión
por outcome = _outcome_after(p) ; stl_pts = Σ p.pts ; stl_scored = #{p.pts > 0}
ppp_after_recovery = Σ p.pts / #{p.origin == "robo"}  (sobre `done`, sin filtro de jugador en modo equipo; en modo jugador: solo las
                     posesiones con steal_by_id == jugador y origin == "robo")
ppp_all_possessions = Σ p.pts / len(done)
```
`ppp_after_recovery` usa `origin == "robo"` (A-02, RF-15) y `st` usa el evento `steal` (RF-14): ambos conjuntos coinciden salvo robos
seguidos de tiempo muerto (origen `tiempo_muerto`); la diferencia se muestra en el `title` del valor.

### 4.9 `_turnover_block`
```
tv = [p for p in done if p.end_type == "perdida" and (pid_filter is None or p.turnover_by_id == pid_filter)]
para p in tv:  n = _next_poss(p)       # posesión rival inmediata
    si n es None o n.incomplete:  no_next += 1 ; continue
    outcome = _outcome_after(n) con renombres de §4.3 ; pts = n.pts ; punished = pts > 0
tov_pts_conceded = Σ pts ; tov_with_next = len(tv) − no_next
tov_cost_avg = tov_pts_conceded / tov_with_next ; tov_punished_pct = punished / tov_with_next
team_turnovers (solo modo equipo) = las de turnover_by_id None ("Pérdida de equipo")
```
Una pérdida por falta ofensiva (vínculo `turnover → foul`) cuenta como pérdida igual que en el box.

### 4.10 `assist_pairs_from_events(events, name_to_id, *, team_code) -> list[dict]` (PROPUESTA de nombre público; la consume A-08)
```
idx = {ev.action_number: ev}
para ev en events con action_type == "assist" y team_code == team_code:
    shot = idx.get(ev.previous_action)                          # vínculo FIBA
    si shot es None o shot.action_type no en {"2pt","3pt"}: RESPALDO: último "2pt"/"3pt" convertido del mismo equipo,
        mismo período, que no sea del mismo jugador y con action_number < ev.action_number (a lo sumo 3 eventos) ; link = "respaldo"
    scorer = pid(shot) ; made = shot.success == 1 ; kind = "3" si shot.action_type == "3pt" si no "2"
    yield {game_id, assist_event, shot_event, assister_id, scorer_id, shot_type, made, link: "fiba"|"respaldo"|"sin_vinculo"}
```
Devuelve **todas** las asistencias del pbp (vinculadas o no, en posesión completa o incompleta): es la base exacta del cuadre de A-08
y el control del `pbp` del reconcile de A-07.

### 4.11 `reconcile_chains(...) -> dict`
Arma el bloque `reconcile` del response: (a) sumas de desenlaces vs eventos de cada bloque; (b) `pbp` = conteo de eventos
(`assist_pairs_from_events` y conteos de `steal`/`turnover`/`rebound` de `repository.game_events`) vs `linked + unlinked + in_incomplete`
(con filtro posesional activo el conteo del pbp se omite: `pbp: null`); (c) oreb vs `second_chance.second_chance_report(...)`
(`pts_2nd`, `oreb_conversion`); (d) **`pts_from_tov`** (informativo, solo modo equipo): para cada partido con
`team_game_stats.pts_from_tov` no NULL e `ingest_version` actual, `calc = Σ pts de posesiones propias con origin ∈ {robo, perdida_rival}`
(A-02) y `official = pts_from_tov`; `cause_hint` ∈ `posesion_incompleta` (hay incompletas en el partido), `criterio_fiba` (diferencia
con calificador `fromturnover` coincidente con el oficial; FIBA no mide por posesión), `desconocida`. Partidos con NULL → `games_excluded`
con razón `no_registrado`. Se registra además como check `chains_tov_mismatch` (`status: alerta` si hay diferencias).

### 4.12 `chain_bundles(req) -> list[StatBundle]` (loader de tipos `chain` y `chain_player`)
`entity_id` = `<team_code>:<cadena>` o `<player_id>:<cadena>`. Selección de posesiones:
| Cadena | Posesiones del bundle | `own` | `opp` |
|---|---|---|---|
| `asistencia` | `done` con `assister_id` (de `pid`, si `chain_player`) y `_finish_kind` no nulo | Σ `p.box` | Σ `p.opp_box` |
| `rebote_ofensivo` | **delega** en `second_chance.chance_bundles` con id `<team>:segunda` (A-04): oportunidades n ≥ 2 | — | — |
| `rebote_defensivo` | `done` con `dreb_event` | Σ `p.box` | Σ `p.opp_box` |
| `robo` | `done` con `steal_event` | Σ `p.box` | Σ `p.opp_box` |
| `perdida` | posesiones **rivales** inmediatas a cada pérdida propia (`_next_poss`) | Σ box del rival | Σ box propio (concedido, hueco §10) |
`StatBundle(entity_type="chain", entity_id=…, name=<etiqueta>, own, opp, games=<partidos con ≥ 1 posesión>, minutes=None,
seconds=Σ duración, possessions_counted=len(posesiones))`; `compute_standard` devuelve `no_aplica` en `pace`, `minutes` y `uso_*`
(fuera de `entities` del catálogo para `chain`). Cacheado en `cache.memo("chains:bundle", …)`.

### 4.13 `table_rows(req) -> list[TableRow]` (builder T-06)
`section=desenlaces`: por cada cadena y desenlace, bundle de las posesiones de ese desenlace (misma selección que §4.5–§4.9) con
`extra = {events, share, pts_event}`; `section=jugadores`: por jugador del equipo con ≥ 1 evento de la cadena, bundle `chain_player`.
`sample_n` = eventos de la fila; filas BAJA llevan `sample.ranked=false` (T-06 las pinta en gris). `link` de fila →
`#/jugador/<id>/eventos` (jugadores) o `null`.

### 4.14 `stats_engine.chain_rates(c: dict) -> dict` (regla 4)
```
ast_pts_avg        = _safe_div(c.ast_pts, c.ast_linked)
drb_pts_avg        = _safe_div(c.drb_pts, c.drb_poss)
drb_fb_pct         = _safe_div(c.drb_transition, c.drb_poss)
drb_fb_scored_pct  = _safe_div(c.drb_transition_scored, c.drb_transition)
stl_pts_avg        = _safe_div(c.stl_pts, c.stl_with_poss)
stl_conversion_pct = _safe_div(c.stl_scored, c.stl_with_poss)
tov_cost_avg       = _safe_div(c.tov_pts_conceded, c.tov_with_next)
tov_punished_pct   = _safe_div(c.tov_punished, c.tov_with_next)
```
Cada una devuelve `{"value": …, "reason": "sin_intentos"}` con denominador 0 (`_safe_div` → `None` + razón). Cociente de totales
de la selección (DA-02), nunca promedio de tasas por partido.

### Manejo de nulos (C-11)
Conteo de eventos = entero (0 real) solo si la entidad tiene partidos con pbp en la selección; si no, `null` `sin_pbp`. Tasas con
denominador 0 → `null` `sin_intentos`. `first_outlet_pass` → `null` `no_registrado`. Posesión incompleta → fuera del desenlace y
dentro de `in_incomplete`. Jugador sin minutos en la selección → `sin_datos`. Valor de equipo con `ptype`/`origin` nulos
(posesión sin clasificar) → no cuenta y se informa en `events`.

## 5. Frontend — capa API (api.js)
```js
eventsProduction: params => apiFetch(`/api/events-production${qs(params)}`),   // {entity, id, ...contexto}
```
Reutiliza `api.table("events_production", params)` (T-06), `api.metrics("chain", params)` (T-05), `api.ranking("chain", clave, params)`
(T-01). `qs()` omite `null`/`undefined`/`""`. Ningún `fetch` fuera de `api.js`.

## 6. Frontend — UI
- **Dónde:** S3 Equipo → pestaña `eventos` (`#/equipo/<code>/eventos?…`, `views/equipo.js`) y S4 Jugador → pestaña `eventos`
  (`#/jugador/<player_id>/eventos?…`, `views/jugador.js`). X-01 ya habilitó la pestaña con `enabled: false`; A-07 la pasa a
  `enabled: true` y le da `render` (`registerTab`).
- **Componente nuevo** `components/events-panel.js` → `renderEventsPanel(el, payload, {mode})`: una card por bloque, cada una con
  (a) fila de fichas (`metricCard(key, metricObj, {entityType: "chain"})` de T-01, valor primero, ranking X.º de N, distancia al
  líder y al promedio, percentil con `percentileColor`), (b) tabla de desenlaces (cantidad · % · puntos) con barra apilada CSS
  (sin Chart.js), (c) `sampleBadge(sample)` (T-02), (d) en Asistencias la línea "Asiste más a …" y en modo equipo "Par más
  frecuente …", (e) en Pérdidas/Rebotes de equipo las filas de equipo.
  - Aviso de vínculo (`link.warning`) como banner si `link_fallback > 0`.
  - Pie de la pestaña: "Conciliación" colapsable (`collapsible`, X-01) con las sumas y la lista de `pts_from_tov` que difieren.
  - Debajo, la **tabla completa** `events_production` con `createDataTable` + `exportMenu` (T-06) y selector `section`
    (Desenlaces · Por jugador + selector de cadena).
- **Reutilizados (Arq. §8):** `metric-card.js`, `sample-badge.js`, `data-table.js`, `export-menu.js`, `core/format.js`
  (`fmtNumber`, `nullDisplay`), `core/colors.js`, `components/collapsible.js`, `components/context-bar.js` (la barra T-03 ya está
  montada por X-01/T-03 en la vista; el panel lee `getContext()` y escucha `onContextChange` para recargar).
- **Copy:** en español rioplatense directo (la decisión DA-21 registrada en `../../00-decisiones.md` descarta `t()` hasta F-21; el copy
  nuevo queda listado en `docs/frontend.md` para su extracción).
- **Estados:** loading (spinner "Calculando producción por evento…"), vacío, error, offline y éxito según spec §6; muestra baja en
  gris sin ranking.
- **Mobile (<768 px):** cards a una columna, tablas con primera columna fija (`.table-sticky`), fichas en grilla de 2 columnas
  (<480 px: 1), barra apilada a ancho completo; la nav inferior no cambia.

## 7. Navegación
Sin sección ni pestaña nueva: usa `eventos` de S3 y S4 ya registradas por X-01 (Arq. §3.12). El contexto viaja en el hash
(`#/equipo/CNF/eventos?competition=3&last=5`). La cadena activa de la tabla va en el query como `chain=` (parámetro de vista, no
de contexto). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/events-production`: ejemplo completo en §3. Objetos métrica = §7.1 con `sample` §7.2; nulos §7.4.
- Tabla `events_production`: §7.6. Entidad `chain`/`chain_player`: §7.3.
- Campos nuevos de `Possession` (PROPUESTA, §4.1) y parámetro `include_incomplete` de `team_possessions`.
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `parametro_invalido` | "Indicá entity=team o entity=player y un id." |
| 400 | `contexto_invalido` | mensaje de `parse_context` |
| 401 | — | handler global de `api.js` (vuelve al login) |
| 404 | `no_encontrado` | "No encontramos ese equipo o jugador." |
| 404 | `sin_pbp` | "Este equipo no tiene play-by-play importado. Reimportá sus partidos." |
| 429 | — | "Demasiadas solicitudes. Esperá un momento." (existente) |
| 5xx | — | "No se pudo calcular la producción por evento." |
Offline: `/api/*` siempre a red; el panel muestra "Sin conexión: el análisis por evento necesita conexión." Un partido que
falla al reconstruirse se omite del cálculo y se lista en `context.games_excluded` con motivo `error_reconstruccion` (nunca 500 para
toda la selección, mismo criterio que A-01). Si X-01 no migró a runtime caching, `events-panel.js` se suma a `STATIC` en `sw.js`
y se sube `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **PROPUESTA `include_incomplete` en `team_possessions`** (A-01): necesario para contar eventos en posesiones incompletas y cuadrar
  con el pbp (RF-8). Cambio chico y retrocompatible (default `False`). Reportado en huecos.
- **PROPUESTA 4 campos nuevos en `Possession`** (`steal_event`, `steal_by_id`, `dreb_event`, `dreb_by_id`): A-01/A-02 no guardan quién
  recuperó ni qué evento abrió la posesión. Alternativa descartada: reconstruir en cada consulta desde `events` (obliga a leer el
  pbp en cada reporte; el enriquecedor lo hace una vez dentro del caché `poss:game`).
- **PROPUESTA tipo de entidad `chain_player`**: T-01 compara cada entidad con una población homogénea (equipos con equipos, jugadores
  con jugadores); un único tipo `chain` mezclaría poblaciones. Reportado en huecos.
- **Desacuerdo leve con Arq. §3.5 (cadena `perdida`)**: la arquitectura define `chain` sin precisar el lado atacante de la cadena
  `perdida`; el plan fija `own` = rival (concedido) y rotula la fila "Concedido tras pérdida". Reportado en huecos/desacuerdos.
- **Enumeración de miembros de la población T-01**: A-07 sigue el contrato de loaders de T-05; si T-01 enumera miembros llamando al
  loader con `entity_id='*'`, `chain_bundles` debe soportarlo (devolver un bundle por equipo/jugador con eventos en la
  competencia). Verificar contra `../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md` al implementar.
- **Horizonte de una posesión** (spec §9.5): decisión de producto; ampliar a "puntos en los próximos N segundos" queda fuera de v2.
- **Consistencia con A-12** (`pts_per_ast`): A-12 define su propia métrica de puntos por asistencia; A-07 usa `ast_pts_avg` (puntos de
  la **posesión**, incluye and-one) para no pisar la clave. Al implementar A-12/A-07 se debe confirmar que ambas dan el mismo
  número o documentar la diferencia (tarea T-F de verificación).
- **Rendimiento (R-02):** el reporte recorre posesiones ya cacheadas (`poss:game`); en caliente es O(posesiones de la selección);
  caché propio `chains:report` (LRU 64) y `chains:bundle`.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato en `chains.py` (se extiende) ni en el endpoint/tabla/tipo
  fijados; las PROPUESTAS anteriores son agregados.
- **Dependencias técnicas:**
  - F-01 `chains.py` y sus cuatro primitivas ([../../fase-4-dia-de-partido/03-F-01-partido-en-vivo/plan.md](../../fase-4-dia-de-partido/03-F-01-partido-en-vivo/plan.md)).
  - A-01 `Possession`, `game_possessions`, `team_possessions`, `register_enricher`, `possessions_bundle` ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md)).
  - A-02 `Possession.origin` ([../../fase-3-contexto-posesion/02-A-02-origen-posesion/plan.md](../../fase-3-contexto-posesion/02-A-02-origen-posesion/plan.md)).
  - A-03 `Possession.ptype` ([../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/plan.md](../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/plan.md)).
  - A-04 `Chance.outcome`, `Chance.oreb_by_id`, `second_chance_report`, `chance_bundles` ([../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/plan.md](../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/plan.md)).
  - T-05 `StatBundle`, `compute_standard`, `register_entity` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-01 `population`, `attach_fichas` ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - T-02 `sample.sample_level` ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-03 `Context`, `parse_context`, `context_key` ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - T-06 `register_table`, `data-table.js`, `export-menu.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - F-11 `previous_action`/`qualifiers`, `repository`, `cache`, `data_quality.register_check` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - C-08 `player_id` ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)).
  - X-01 `registerTab`, `views/equipo.js`, `views/jugador.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: L · 14–20 h** (enriquecedor y campos de posesión 2–3 h; cinco bloques y partición 4–5 h; vínculo exacto de asistencias y
  conciliación 2–3 h; loader/tabla/registros T-05/T-06 2–3 h; UI (panel, cards, tabla) 3–4 h; verificación sobre 13 partidos y docs
  1–2 h). Arquitectura §9.1 prevé L 12–18 h; +2 h por la conciliación con `pts_from_tov`, el modo jugador completo y el tipo
  `chain_player`.
