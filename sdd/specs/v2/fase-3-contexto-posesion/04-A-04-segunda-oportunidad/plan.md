# Plan — A-04: Rebote ofensivo y segunda oportunidad

> **ID:** A-04 · **Prioridad:** P1 · **Fase y orden:** 3·04
> **Depende de:** A-01, A-03 (y A-02, F-11, F-13, T-02, T-05, T-06, T-03, X-01, C-03) · **Habilita:** A-05, A-06, A-07
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §5.2 · A-04 · Arquitectura §3.9, §3.8, §3.2, §6, §7
> **Estimación:** L · 12–18 h

## 1. Enfoque
Enriquecedor de posesiones `second_chance` registrado en `possessions.register_enricher` (A-01) que completa `Chance.outcome` y
los atributos de la cadena (modo del tiro, tipo de tiro fallado que originó el RO, segundos del rebote al tiro). Sobre esas
posesiones enriquecidas, un módulo dedicado **`backend/second_chance.py`** (NUEVO — PROPUESTA de nombre, capa estadística tipo
DA-37) agrega las métricas ofensivas/defensivas y la conciliación con `second_chance_pts`, delegando en
`stats_engine.compute_standard` las fórmulas del conjunto estándar (regla 4). Se registran: la dimensión de contexto `chance`, el
tipo de entidad `chance` (T-05) y la tabla `team_second_chance` (T-06). Una ruta fina `GET /api/second-chance` sirve el bloque de
UI de la pestaña Posesión de S3/S4. Todo on-the-fly con caché por `data_version`/`config_version`; sin cambios de esquema.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/second_chance.py` | module (NUEVO, PROPUESTA de nombre) | enriquecedor `enrich_second_chance`, agregación `second_chance_report`, `player_second_chance`, `reconcile_second_chance`, builder de tabla, loader de entidad `chance`, registro de dimensión | RF-1…RF-20 |
| `backend/possessions.py` | module (A-01, extender) | agregar a `Chance` los campos `oreb_event`, `oreb_by_id`, `missed_shot_kind`, `first_shot_mode`, `first_shot_elapsed` (PROPUESTA, §10) | RF-2, RF-6, RF-9, RF-11 |
| `backend/stats_engine.py` | module (extender) | fórmulas nuevas `second_chance_rates(counts)` (PPP 1.ª/2.ª, pts por RO, conversión, OR% concedido) — regla 4 | RF-3, RF-4, RF-11 |
| `backend/metrics_catalog.py` | module (T-05, registrar) | `register_entity("chance", loader)`; metadatos de claves de la vista (grupo `extra`): `ppp_2nd`, `ppp_1st`, `ppp_2nd_diff`, `pts_per_oreb`, `oreb_conversion`, `oreb_chain_ppp`, `opp_or_pct` | RF-15 |
| `backend/context.py` | module (T-03, registrar) | `register_dimension("chance", level="posesion", values=("primera","segunda"), parser=…)` + predicado a nivel oportunidad | RF-15, RF-17 |
| `backend/tables.py` | module (T-06, registrar) | `register_table("team_second_chance", entity_type="chance", …)` | RF-18 |
| `backend/config.py` | module (F-13, extender `CONFIG_SPEC`) | claves `oreb.putback_secs` (int, 3, 1–6), `oreb.kickout_secs` (int, 6, 2–10), sección "Reglas de contexto", consumidor A-04 | RF-2 |
| `backend/data_quality.py` | module (F-11, registrar) | check opcional `second_chance_mismatch` (partidos con diferencia vs oficial) vía `register_check` | RF-13 |
| `backend/app.py` | route | `GET /api/second-chance` (fina: parsea contexto, llama a `second_chance_report`) | RF-3…RF-14, RF-19 |
| `frontend/js/api.js` | js-api | `api.secondChance(params)` | RF-3…RF-19 |
| `frontend/js/components/second-chance-panel.js` | js-component (NUEVO, PROPUESTA) | render del bloque (resumen, desenlaces, orígenes, jugadores, coste, defensa, conciliación) | RF-3…RF-14, RF-16 |
| `frontend/js/views/equipo.js` | js-view (X-01) | montar el bloque en la pestaña `posesion` (junto a A-02/A-03/A-05) | RF-14, RF-17 |
| `frontend/js/views/jugador.js` | js-view (X-01) | montar el bloque en la pestaña `posesion` de S4 (modo jugador) | RF-19 |
| `frontend/css/style.css` | css | sección `/* ── second-chance (A-04) ── */` (histograma, leyendas) | RF-11 |
| `frontend/sw.js` | sw | sumar `second-chance-panel.js` a `STATIC` y subir `CACHE` si X-01 aún no pasó a runtime caching (si ya pasó: sin cambios) | — |
| `docs/api.md` | docs | `GET /api/second-chance`, tabla `team_second_chance`, tipo `chance`, filtro `chance` | cierre |
| `docs/metrics.md` | docs | definiciones de segunda oportunidad, desenlaces, PPP por oportunidad, puntos por RO, conversión, coste del RO, fuente derivada del reloj | cierre |
| `docs/frontend.md` | docs | bloque "Segunda oportunidad" de Posesión y su copy | cierre |
| `docs/architecture.md` | docs | módulo `second_chance.py` | cierre |

Matriz RF → archivo: RF-1 `second_chance.py`/`possessions.py`; RF-2 `second_chance.py`, `possessions.py`, `config.py`; RF-3/RF-4
`stats_engine.py`, `second_chance.py`; RF-5/RF-6/RF-8 `second_chance.py`; RF-7/RF-12 `second_chance.py` + panel; RF-9
`second_chance.py`, panel; RF-10 `second_chance.py` (consume A-02/A-03); RF-11 `stats_engine.py`, `second_chance.py`; RF-13
`second_chance.py`, `data_quality.py`; RF-14 `second_chance.py` (`side`); RF-15 `metrics_catalog.py`, `context.py`; RF-16 panel +
`sample.py` (consumo); RF-17 `app.py` + `context.py` + `population.py` (consumo); RF-18 `tables.py`; RF-19 `jugador.js`,
`player_second_chance`; RF-20 todos (null con razón).

## 3. Backend — rutas y modelos

### `GET /api/second-chance` — NUEVO · PROPUESTA (no está en 00-arquitectura-transversal.md)
- Auth: `login_required`. Contexto T-03 completo (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`,
  `off`, `clock`, `clock_start`, `origin`, `ptype`; `chance` se ignora aquí porque la vista ya separa 1.ª/2.ª y se informa en
  `context.ignored` con razón `no_aplica`). Sin `base` (tasas por oportunidad; los conteos se muestran en total).
- Query: `team=<team_code>` **o** `player=<player_id>` (uno obligatorio); `side=ataque|defensa` (default `ataque`).
- Respuesta 200 (ejemplo abreviado con valores ilustrativos):
```json
{
  "entity": {"type": "team", "id": "CNF", "name": "Nacional"},
  "side": "ataque",
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {}, "ignored": [],
              "level": "posesion", "population_mode": "apply_all", "games_used": 13, "games_total": 13,
              "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "summary": {
    "possessions": 923, "first_chances": 923, "second_chances": 142, "oreb_captured": 142,
    "oreb_in_incomplete": 1,
    "metrics": {
      "ppp_1st": {"value": 0.97, "reason": null, "percentile": 55, "sample": {"level": "alta", "unit": "posesiones", "n": 923}},
      "ppp_2nd": {"value": 1.12, "reason": null, "percentile": 71, "sample": {"level": "alta", "unit": "posesiones", "n": 142}},
      "ppp_2nd_diff": {"value": 0.15, "reason": null},
      "pts_per_oreb": {"value": 1.12, "reason": null},
      "oreb_conversion": {"value": 0.486, "reason": null},
      "second_chance_pts": {"value": 159, "reason": null},
      "chains_2plus": {"value": 18, "reason": null},
      "chains_2plus_share": {"value": 0.143, "reason": null},
      "oreb_chain_ppp": {"value": 1.33, "reason": null},
      "oreb_zone": {"value": null, "reason": "no_registrado"}
    }
  },
  "outcomes": [
    {"key": "putback", "label": "Putback inmediato", "chances": 41, "share": 0.289, "pts": 58, "ppp": 1.41,
     "attempts_by_mode": {"fga": 62, "fgm": 27}, "sample": {"level": "alta", "n": 41, "unit": "posesiones"}},
    {"key": "reinicio", "label": "Reinicio de ataque", "chances": 30, "share": 0.211, "pts": 64, "ppp": 2.13, "attempts_by_mode": {"fga": 55, "fgm": 30}, "sample": {}},
    {"key": "kickout_triple", "label": "Kick-out a triple", "chances": 9, "share": 0.063, "pts": 27, "ppp": 3.0, "attempts_by_mode": {"fga": 21, "fgm": 9}, "sample": {}},
    {"key": "falta_recibida", "label": "Falta recibida", "chances": 8, "share": 0.056, "pts": 10, "ppp": 1.25, "sample": {}},
    {"key": "perdida", "label": "Pérdida", "chances": 12, "share": 0.085, "pts": 0, "ppp": 0.0, "sample": {}},
    {"key": "sin_puntos", "label": "Sin puntos", "chances": 42, "share": 0.296, "pts": 0, "ppp": 0.0, "sample": {}}
  ],
  "oreb_origin": [
    {"key": "triple", "label": "Tras triple fallado", "oreb": 51, "share": 0.359, "pts": 55, "ppp": 1.08},
    {"key": "media_distancia", "label": "Tras media distancia", "oreb": 20, "share": 0.141, "pts": 22, "ppp": 1.1},
    {"key": "cercano", "label": "Tras tiro cercano", "oreb": 63, "share": 0.444, "pts": 74, "ppp": 1.17},
    {"key": "tiro_libre", "label": "Tras tiro libre", "oreb": 8, "share": 0.056, "pts": 8, "ppp": 1.0},
    {"key": null, "label": "Sin tiro vinculado", "oreb": 0, "share": 0.0, "pts": 0, "ppp": null, "reason": "sin_intentos"}
  ],
  "chains": {"possessions_with_oreb": 126, "chains_2plus": 18, "ppp": 1.33, "max_length": 4},
  "players": [
    {"player_id": 812, "name": "S. Canty", "oreb": 22, "chain_pts": 27, "conversion": 0.5, "own_putbacks": 7,
     "finished": 15, "finished_pts": 24, "finish_ppp": 1.6, "sample": {"level": "media", "n": 22, "unit": "posesiones"}},
    {"player_id": null, "name": "Rebote de equipo", "oreb": 11, "chain_pts": 9, "conversion": 0.36, "own_putbacks": 0,
     "finished": 0, "finished_pts": 0, "finish_ppp": null, "reason": "no_aplica"}
  ],
  "cost": {"missed_shots": 612, "rival_dreb_possessions": 470, "transitions_conceded": 88, "transition_share": 0.187,
           "pts_conceded": 101, "ppp_conceded": 1.15, "per_100_missed": 14.4, "approximation": true},
  "defense": {"opp_or_pct": {"value": 0.27, "reason": null, "percentile": 40},
              "opp_ppp_2nd": {"value": 1.05, "reason": null},
              "opp_secs_to_shot": {"mean": 4.1, "hist": [{"secs": "0-3", "n": 52}, {"secs": "4-6", "n": 30}, {"secs": "7-14", "n": 33}]},
              "dreb_long_vs_paint": {"value": null, "reason": "no_registrado"}},
  "reconcile": {"calc": 159, "official": 159, "diff": 0, "games_compared": 13,
                "games_mismatch": [], "games_excluded": [], "qualifier_2ndchance_pts": 159}
}
```
- Con `side=defensa` el mismo shape describe las posesiones del rival contra el equipo (`summary.metrics` = concedido).
- Con `player=<id>`: `summary` y `outcomes` sobre las segundas oportunidades **que el jugador abrió con su RO**; bloque
  `finishing` = segundas oportunidades que el jugador finalizó (`finished`, `finished_pts`, `finish_ppp`); `players` se omite;
  `reconcile` compara contra `player_game_stats.second_chance_pts` (por jugador-partido) cuando no es NULL.
- Errores (§7.8): 400 `parametro_invalido` "Indicá un equipo o un jugador." / "El lado debe ser ataque o defensa."; 400
  `contexto_invalido` (de `parse_context`); 404 `no_encontrado` "No encontramos ese equipo o jugador."; 404 `sin_pbp` "Este
  equipo no tiene play-by-play importado. Reimportá sus partidos." (todos los partidos de la selección sin pbp).

### `GET /api/table/team_second_chance` — NUEVO (id fijado en Arq. §6)
Registrada con `tables.register_table("team_second_chance", entity_type="chance", title="Segunda oportunidad — {equipo}",
builder=second_chance.table_rows, default_columns=["_name","_sample","chances","share","pts","ppp"], bulk_scopes=("team",))`.
Params: `team`, `side`, `section=desenlaces|origen|jugadores` (PROPUESTA: parámetro de sección) + contexto. Payload §7.6 con
filas por desenlace/origen/jugador, `totals` = totales de la sección, `competition_avg` = media de los equipos de la población.

### `GET /api/metrics/chance?id=<team_code>:<primera|segunda>` — NUEVO (tipo fijado en Arq. §6)
Loader `second_chance.chance_bundles(req)` → `StatBundle` con los conteos de las oportunidades de ese tipo (propios y del rival en
las mismas oportunidades vía `side`). Payload §7.3 completo.

### Esquema
Sin cambios (Arq. §5). Claves de configuración nuevas en `CONFIG_SPEC` (no son esquema: `app_config` solo guarda overrides):
| Clave | Tipo | Default | Rango | Sección | Consumidor |
|---|---|---|---|---|---|
| `oreb.putback_secs` | int (s) | 3 | 1–6 | Reglas de contexto | A-04, A-07 |
| `oreb.kickout_secs` | int (s) | 6 | 2–10 | Reglas de contexto | A-04, A-07 |

## 4. Backend — lógica

| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `enrich_second_chance(possessions, events, game)` | `second_chance.py` | enriquecedor A-01 | RF-1, RF-2, RF-6, RF-11 |
| `second_chance_report(entity_type, entity_id, comp_id, ctx, *, side)` | `second_chance.py` | agregación completa | RF-3…RF-14 |
| `player_second_chance(player_id, comp_id, ctx)` | `second_chance.py` | captura/finalización | RF-9, RF-19 |
| `reconcile_second_chance(team_code, comp_id, ctx)` | `second_chance.py` | vs `second_chance_pts` | RF-13 |
| `chance_bundles(req)` | `second_chance.py` | loader tipo `chance` | RF-15 |
| `table_rows(req)` | `second_chance.py` | builder T-06 | RF-18 |
| `second_chance_rates(c)` | `stats_engine.py` | fórmulas | RF-3, RF-4, RF-11 |

### 4.1 `enrich_second_chance(possessions, events, game) -> None` (registrado con `possessions.register_enricher("second_chance", …)`)
Entradas: posesiones de un partido (A-01, con `chances` ya abiertas por cada RO), eventos del partido (`pbp_events` como dicts,
ordenados por `action_number`, con `previous_action` y `qualifiers` cuando existen), metadatos del partido. Configuración:
`p = config.get("oreb.putback_secs")`, `k = config.get("oreb.kickout_secs")`.
```
idx = {ev.action_number: ev for ev in events}
for pos in possessions:
    if pos.incomplete: for ch in pos.chances: ch.outcome = None; continue
    for ch in pos.chances:
        if ch.n == 1: ch.outcome = None; continue            # solo 2.ª+ (el 1.º no tiene RO)
        reb = idx[ch.start_event]                            # evento rebound/offensive que abrió la chance
        ch.oreb_event = reb.action_number
        ch.oreb_by_id = reb.player_id or None                # None = rebote de equipo (qualifier 'team' o jugador vacío)
        missed = idx.get(reb.previous_action) or previous_shot_event(events, reb)   # fallback sin F-11
        ch.missed_shot_kind = kind_of(missed)                # 'triple' | 'media_distancia' | 'cercano' | 'tiro_libre' | None
        own = [e for e in events_in(ch) if e.team_code == pos.team and e.action_type not in NON_PLAY]
        first_fga = first(e for e in own if e.action_type in ('2pt','3pt'))
        if first_fga:
            dt = reb.clock_secs - first_fga.clock_secs       # mismo período; reloj restante → segundos transcurridos
            assisted = has_linked_assist(first_fga, events)  # assist con previous_action == first_fga.action_number
            is_first_event = own and own[0] is first_fga
            if is_first_event and dt <= p and not assisted: mode = 'putback'
            elif first_fga.action_type == '3pt' and dt <= k: mode = 'kickout_triple'
            else: mode = 'reinicio'
            ch.first_shot_mode, ch.first_shot_elapsed = mode, max(dt, 0)
        # desenlace (precedencia D-1)
        term = ch.end_type                                   # A-01: t2c|t2f|t3c|t3f|falta|perdida|fin_periodo
        if term == 'perdida' and not first_fga:              ch.outcome = 'perdida'
        elif term == 'falta' and not made_fg(ch):            ch.outcome = 'falta_recibida'
        elif made_fg(ch):                                     ch.outcome = ch.first_shot_mode
        else:                                                 ch.outcome = 'sin_puntos'   # tiro fallado o fin de período
```
- `kind_of(shot)`: `freethrow` → `tiro_libre`; `3pt` → `triple`; `2pt` → zona de `shot_zones.classify_zone(action_type, sub_type,
  court_x, court_y, qualifiers)` (C-03): `restricted_area` → `cercano`, resto de zonas de 2 → `media_distancia`; sin coordenadas
  ni calificador `pointsinthepaint` → por `sub_type` (`layup`, `drivinglayup`, `reverselayup`, `tipinlayup`, `dunk` → `cercano`;
  resto → `media_distancia`); sin tiro vinculado → `None` (fila "Sin tiro vinculado").
- `previous_shot_event(events, reb)`: último evento `2pt`/`3pt`/`freethrow` fallado (`success = 0`) anterior al rebote en el
  mismo período (fallback para partidos sin `previous_action`, CA-13).
- Caché: el enriquecido queda dentro del caché de `game_possessions` (`poss:game`, clave con `config_version`, así un cambio de
  `oreb.putback_secs` recalcula).
- Nulos: reloj no monótono irreparable → A-01 ya marca la posesión incompleta; `dt < 0` por evento fuera de orden → `dt = 0`.

### 4.2 `second_chance_report(entity_type, entity_id, comp_id, ctx, *, side="ataque") -> dict`
```
poss = possessions.team_possessions(team, comp_id, ctx, side=side)   # ya filtradas por contexto (A-01 aplica possession_predicate)
complete = [p for p in poss if not p.incomplete]
ch1 = [p.chances[0] for p in complete]
ch2 = [c for p in complete for c in p.chances if c.n >= 2]
counts = {
  pts_1st: Σ c.pts for c in ch1, n_1st: len(ch1),
  pts_2nd: Σ c.pts for c in ch2, n_2nd: len(ch2),
  oreb: len(ch2), conv: #{c in ch2 : c.pts > 0},
  chains: #{p : len(p.chances) >= 3}, chains_pts: Σ p.pts (esas), with_oreb: #{p : len(p.chances) >= 2},
  opp_orb / own_drb (defensa): rebotes en las mismas posesiones (ver 4.4)
}
rates = stats_engine.second_chance_rates(counts)
outcomes = group ch2 by c.outcome → {chances, pts, ppp = pts/chances, share = chances/n_2nd, attempts_by_mode (por first_shot_mode incl. fallados)}
oreb_origin = group ch2 by c.missed_shot_kind
players = group ch2 by c.oreb_by_id (captura) ∪ group ch2 by finisher (finalización: Possession.finisher_id de la chance terminal)
cost = cost_of_oreb(team, comp_id, ctx)                                 # 4.3
defense = second_chance_report(..., side='defensa') solo métricas opp_*   # sin recursión infinita: función interna _aggregate(side)
reconcile = reconcile_second_chance(team, comp_id, ctx) if side == 'ataque'
fichas: population.attach_fichas({ppp_2nd, pts_per_oreb, oreb_conversion, opp_or_pct}, 'chance', f"{team}:segunda", pop)
badges: sample.sample_level('split', n=<chances>, unit='posesiones', team_poss=len(complete))
```
- Sin RO: `ppp_2nd`, `pts_per_oreb`, `oreb_conversion` → `{"value": null, "reason": "sin_intentos"}` (CA-8).
- Partidos sin pbp → excluidos por `team_possessions` y contados en `context.games_excluded.sin_pbp`.
- Caché: `cache.memo("poss:second_chance", (team, comp_id, context_key(ctx), side), fn)`.

### 4.3 `cost_of_oreb` (interna)
Posesiones del **rival** (`team_possessions(team, comp_id, ctx, side="defensa")`) con `origin == "rebote_defensivo"` (A-02) cuyo
evento de inicio es un rebote defensivo sobre un tiro propio fallado de campo; `transitions_conceded = #{ptype == "transicion"}`
(A-03); `pts_conceded = Σ pts`; `ppp_conceded = pts_conceded / transitions_conceded`; `transition_share = transitions_conceded /
rival_dreb_possessions`; `per_100_missed = 100 · transitions_conceded / missed_shots` con `missed_shots` = tiros de campo propios
fallados en posesiones completas. `ptype` nulo (posesión incompleta) → excluida. `approximation: true` siempre (D-4).

### 4.4 `stats_engine.second_chance_rates(c: dict) -> dict` (regla 4: fórmulas)
```
ppp_1st         = _safe_div(c.pts_1st, c.n_1st)
ppp_2nd         = _safe_div(c.pts_2nd, c.n_2nd)
ppp_2nd_diff    = ppp_2nd − ppp_1st  (None si alguno es None)
pts_per_oreb    = _safe_div(c.pts_2nd, c.oreb)          # glosario: puntos de la cadena / RO capturados
oreb_conversion = _safe_div(c.conv, c.oreb)
oreb_chain_ppp  = _safe_div(c.chains_pts, c.chains)
opp_or_pct      = _safe_div(c.opp_orb, c.opp_orb + c.own_drb)   # glosario OR% del rival = 1 − DR% propio
```
`opp_orb`/`own_drb`: rebotes del rival ofensivos y propios defensivos dentro de las posesiones rivales completas de la selección
(eventos `rebound` con `team_code` y `sub_type`; los de equipo incluidos, igual que el box de FIBA).
`pts_per_oreb == ppp_2nd` por construcción (cada RO en posesión completa abre exactamente una oportunidad); se exponen ambas
porque el cliente las nombra por separado; `docs/metrics.md` lo aclara.

### 4.5 `reconcile_second_chance(team_code, comp_id, ctx) -> dict`
```
for game in partidos del equipo en la selección con pbp:
    tgs = repository.team_game_rows(comp_id)[(game_id, team)]
    if tgs.ingest_version is None or tgs.ingest_version < ingest.INGEST_VERSION:
        excluded.append({game_id, reason: 'no_registrado'}); continue
    calc = Σ c.pts for p in game_possessions(game_id) if p.team == team and not p.incomplete for c in p.chances if c.n >= 2
    calc_incl_incomplete = ídem incluyendo posesiones incompletas (diagnóstico)
    q2 = Σ puntos de eventos de tiro convertidos del equipo con 'qualifiers' ∋ '2ndchance'
    official = tgs.second_chance_pts
    if calc != official: mismatch.append({game_id, date, rival, calc, official, q2, incomplete_possessions, cause_hint})
return {calc: Σcalc, official: Σofficial, diff, games_compared, games_mismatch, games_excluded, qualifier_2ndchance_pts: Σq2}
```
`cause_hint` ∈ `posesion_incompleta` (hay posesiones incompletas en el partido), `criterio_fiba` (q2 == official ≠ calc),
`desconocida`. Registrado además como check `second_chance_mismatch` en `data_quality.register_check` (status `alerta` si hay
partidos con diferencia).

### 4.6 `chance_bundles(req) -> list[StatBundle]` y registro de dimensión
- `StatBundle(entity_type="chance", entity_id="CNF:segunda", own=<RAW_KEYS sumados de los eventos del equipo dentro de las
  oportunidades>, opp=<eventos del rival en las mismas oportunidades (faltas, robos, tapones, rebotes defensivos)>,
  games=<partidos con al menos una oportunidad>, minutes=None, seconds=Σ duración de las oportunidades, possessions_counted=n)`.
  `compute_standard` devuelve `no_aplica` en `pace`, `minutes`, `uso_*` (fuera de `entities` del catálogo para `chance`).
- `context.register_dimension("chance", level="posesion", values=("primera","segunda"), parser=_parse_chance)`. Como la
  oportunidad es sub-posesión, A-04 agrega a `context.possession_predicate` el soporte de **unidad oportunidad** (D-7): con
  `chance` presente, `team_possessions` devuelve posesiones "recortadas" a las oportunidades que cumplen (PROPUESTA §10).

### 4.7 `table_rows(req)` (builder T-06)
Una fila por desenlace (`section=desenlaces`), por origen (`origen`) o por jugador (`jugadores`); cada fila es un `StatBundle`
de las oportunidades de ese grupo más columnas propias de la vista (`chances`, `share`, `pts`, `ppp`, `oreb`, `conversion`,
`finished_pts`) declaradas como columnas `type: "metric"` con metadatos en el catálogo (grupo `extra`).

## 5. Frontend — capa API (api.js)
- `api.secondChance({team, player, side, ...context})` → `apiFetch("/api/second-chance" + qs(params))`.
- Reutiliza `api.table("team_second_chance", params)` (T-06), `api.metrics("chance", params)` (T-05), `api.ranking(...)` (T-01).

## 6. Frontend — UI
- **Ubicación**: S3 Equipo → pestaña `posesion` (`#/equipo/<code>/posesion?…`), sub-bloque "Segunda oportunidad" debajo de
  Origen (A-02) y Transición (A-03); S4 Jugador → pestaña `posesion` (modo jugador). X-01 ya existe en fase 3: la pestaña se
  habilita con `registerTab("equipo", {slug: "posesion", enabled: true, …})` si A-02 no lo hizo antes.
- **Componentes reutilizados** (Arq. §8): `metric-card.js` (fichas de PPP 1.ª/2.ª, puntos por RO, conversión, OR% concedido),
  `sample-badge.js`, `data-table.js` (desenlaces, orígenes, jugadores con `tableId: "team_second_chance"`), `export-menu.js`,
  `core/format.js` (`fmtNumber`, `nullDisplay`), `core/colors.js` (`percentileColor`), `core/i18n.js` (`t()`),
  `core/context.js` (`getContext`, `onContextChange`), `context-bar.js`.
- **Nuevo**: `components/second-chance-panel.js` → `renderSecondChancePanel(el, payload, {mode: "team"|"player"})` (PROPUESTA):
  1. Fila de fichas: PPP 1.ª · PPP 2.ª · Diferencial (verde si > 0) · Puntos por RO · Conversión · Cadenas 2+ (con su PPP).
  2. Tabla de desenlaces (T-06) + columna "Intentos por modo" (FGA/FGM de putback, kick-out, reinicio).
  3. Tabla de origen del RO + fila informativa "Zona del rebote: —" con `title`.
  4. Tabla "Captura vs finalización" (modo equipo) o bloque "Finalización" (modo jugador).
  5. Tarjeta "Coste del rebote ofensivo" con leyenda de aproximación.
  6. Selector Ataque/Defensa (chips) → recarga con `side`; en defensa, fichas de OR% concedido, PPP concedido en 2.ª y histograma
     de segundos hasta el tiro (barras CSS, sin Chart.js).
  7. Pie: leyenda de conciliación con el box oficial y enlace "Ver detalle" (lista de partidos con diferencia o excluidos).
- **Estados**: spinner mientras carga; vacío/errores/offline con el copy de spec §6; filas de muestra baja en gris sin color.
- **Mobile 768 px**: fichas en grilla de 2 columnas (<480 px: 1), tablas con columna fija, chips a ancho completo.

## 7. Navegación
Sin sección nueva. Usa la pestaña `posesion` de S3/S4 (X-01, Arq. §3.12); el estado Ataque/Defensa va en la query del hash como
`side=defensa` (PROPUESTA: parámetro de vista, no de contexto; no se propaga al cambiar de sección). Actualizar el mapa de vistas de
`docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/second-chance`: ejemplo completo en §3. Objetos métrica = §7.1 (T-01) con `sample` §7.2; nulos §7.4.
- Tabla `team_second_chance`: §7.6. Entidad `chance`: §7.3.
- Campos nuevos de `Chance` (PROPUESTA, en `possessions.py`): `oreb_event: int | None`, `oreb_by_id: int | None`,
  `missed_shot_kind: str | None`, `first_shot_mode: str | None` (`putback|kickout_triple|reinicio`), `first_shot_elapsed: int | None`.
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
Offline: `/api/*` siempre a red; el panel muestra "Sin conexión: el análisis de posesiones necesita conexión." Si X-01 no pasó a
runtime caching, sumar `js/components/second-chance-panel.js` a `STATIC` y subir `CACHE`.

## 10. Riesgos / decisiones
- **Endpoint propio (PROPUESTA).** La arquitectura fija la tabla `team_second_chance` y el tipo `chance`, pero no un endpoint para
  el bloque de resumen/desenlaces/defensa/conciliación. Se propone `GET /api/second-chance` (mismo patrón que `/api/cross` y
  `/api/events-production`). Reportado en huecos.
- **Campos nuevos en `Chance` (PROPUESTA).** `Chance` solo tiene `outcome` para A-04; los campos de §8 son necesarios para origen del
  RO, putback y captura/finalización y los reutiliza A-07. Se agregan sin cambiar los existentes (Arq. §0.3).
- **Filtro `chance` a nivel oportunidad (PROPUESTA, D-7).** El contrato de §3.8 lo declara "nivel posesión"; una segunda
  oportunidad es sub-posesión. Se implementa recortando posesiones a oportunidades; se documenta en `docs/metrics.md`.
- **Conciliación.** Riesgo de que el criterio de FIBA para `PointsSecondChance` difiera en casos límite (falta en ataque tras RO,
  RO de equipo tras tiro libre); mitigación: validación cruzada con el calificador `2ndchance` y lista de partidos con causa.
  Partidos anteriores a la ingesta v2 (clave FIBA mal leída en el pasado, gotcha de `CLAUDE.md`) quedan fuera de la comparación.
- **Reloj de 1 s.** Las ventanas de 3 s y 6 s se evalúan con reloj derivado de resolución 1 s: un putback a 3,4 s puede leerse como
  3 s. Aceptable; configurable.
- **Rebotes de equipo** (141 en 13 partidos, Arq. §1.6): se cuentan como RO (igual que el box) y aparecen como "Rebote de equipo".
- Desviaciones respecto de la arquitectura: ninguna de contrato; solo las PROPUESTAS anteriores.
- **Dependencias técnicas:**
  - A-01 `possessions.game_possessions`, `team_possessions`, `register_enricher`, `Possession`, `Chance`
    ([../01-A-01-motor-posesiones/plan.md](../01-A-01-motor-posesiones/plan.md)).
  - A-02 `Possession.origin` ([../02-A-02-origen-posesion/plan.md](../02-A-02-origen-posesion/plan.md)); A-03 `Possession.ptype`
    ([../03-A-03-transicion-contraataque/plan.md](../03-A-03-transicion-contraataque/plan.md)).
  - F-11 `pbp_events.previous_action`/`qualifiers`, `ingest.INGEST_VERSION`, `repository`, `cache`, `data_quality.register_check`
    ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - F-13 `config.get`, `CONFIG_SPEC` ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
  - T-05 `StatBundle`, `compute_standard`, `register_entity` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-02 `sample.sample_level` ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-01 `population.population`, `attach_fichas` ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - T-06 `tables.register_table`, `data-table.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - C-03 `shot_zones.classify_zone` ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)).
  - T-03 `context.register_dimension`, `parse_context` ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - X-01 `registerTab`, vistas `equipo.js`/`jugador.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: L · 12–18 h** (enriquecedor 3 h, agregación y conciliación 4 h, registros T-03/T-05/T-06 2 h, UI 4 h, verificación
  y docs 2–4 h). Ajuste sobre la arquitectura (10–16 h): +2 h por la conciliación con causa y la validación con `2ndchance`.
