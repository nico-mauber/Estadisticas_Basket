# Plan — A-05: Tramo de reloj de posesión

> **ID:** A-05 · **Prioridad:** P1 · **Fase y orden:** 3·05
> **Depende de:** A-01 ([../01-A-01-motor-posesiones/plan.md](../01-A-01-motor-posesiones/plan.md)) · A-04 ([../04-A-04-segunda-oportunidad/plan.md](../04-A-04-segunda-oportunidad/plan.md)) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)) · C-03 ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md))
> **Habilita:** F-07, A-06
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §5.2 · A-05 · Arquitectura §1.6, §2.1, §3.2, §3.5, §3.8, §3.9, §3.11, §6, §7, §8
> **Estimación:** XL · 20–26 h

## 1. Enfoque
Enriquecedor `clock` registrado en `possessions.register_enricher` (A-01) que completa, sobre el reloj de posesión derivado, el tramo de cada tiro (`shots[].band`, regla de la arquitectura §3.9) y, para cada oportunidad (`Chance`), su evento de decisión, su tramo (`Chance.band`), el jugador y el quinteto que la terminan, el tipo de pérdida y una caja de conteos propia (`Chance.box`). Un módulo dedicado **`backend/possession_clock.py`** (NUEVO — PROPUESTA de nombre, capa estadística tipo DA-37; el nombre evita chocar con `clock`) agrega por tramo y por bloque de reloj (24 s / 14 s), en ataque y en defensa, para equipo, jugador y quinteto, arma el panel de decisión de siete preguntas y la matriz zona × tramo, y delega las fórmulas en `stats_engine` (regla 4). El mapa filtrable por tramo reutiliza `shot_zones.zones_with_stats` (C-03) extendido a contexto de nivel posesión. Se registran las dimensiones de contexto `clock`/`clock_start`, el tipo de entidad `clock` (T-05) y las tablas `team_clock` y `zone_clock_matrix` (T-06). Una ruta fina `GET /api/possession-clock` sirve el bloque de UI "Tramo de reloj de posesión" de S3/S4. Todo on-the-fly, cacheado por `data_version`/`config_version` (cambiar un corte en S9 reasigna los tiros en la siguiente petición); sin cambios de esquema.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/possession_clock.py` | module (NUEVO, PROPUESTA de nombre) | `band_of`, enriquecedor `enrich_clock`, `clock_report`, `player_clock`, `lineup_clock`, `decision_panel`, `clock_matrix`, loader `clock_bundles`, builders `table_rows`/`matrix_rows`, registro de dimensiones | RF-1…RF-16 |
| `backend/possessions.py` | module (A-01, extender) | campos nuevos de `Chance` (`band`, `end_elapsed`, `end_player_id`, `end_lineup`, `turnover_kind`, `box`) y claves nuevas de cada `shots[]` (`clock_start`, `lineup`) (PROPUESTAS, §10); soporte de los filtros `clock`/`clock_start` en el recorte por oportunidad de `team_possessions` (mecanismo de A-04, D-7) | RF-2, RF-3, RF-4, RF-12, RF-13 |
| `backend/shot_zones.py` | module (C-03, extender) | `zones_with_stats` toma los tiros de las posesiones recortadas cuando el contexto tiene nivel posesión (`clock`/`clock_start`) y `zone_table_from_shots(shots)` para defensa/quinteto | RF-11, RF-12 |
| `backend/stats_engine.py` | module (extender) | `clock_rates(counts)` (volumen, `share`, eFG%, TS%, PPT, PPP, TO%, violaciones de 24 s, reparto) — regla 4 | RF-5 |
| `backend/metrics_catalog.py` | module (T-05, registrar) | `register_entity("clock", clock_bundles)`; `MetricDef` de las claves propias (grupo `extra`): `clock_shot_share`, `clock_viol24_rate` | RF-13 |
| `backend/context.py` | module (T-03, registrar) | `register_dimension("clock", …)`, `register_dimension("clock_start", …)` y ramas `clock`/`clock_start` en `possession_predicate` | RF-12, RF-13 |
| `backend/tables.py` | module (T-06, registrar) | `register_table("team_clock", …)`, `register_table("zone_clock_matrix", …)` | RF-11, RF-13 |
| `backend/config.py` | module (F-13) | pasar `clock.early_max` y `clock.mid_max` de `"reservada"` a `"activa"` | RF-15 |
| `backend/app.py` | route | `GET /api/possession-clock` (fina); `/api/shot-zones` pasa `Context` completo (T-03 ya lo hace); `import possession_clock` | RF-4…RF-16 |
| `frontend/js/api.js` | js-api | `api.possessionClock(params)` | RF-5…RF-11 |
| `frontend/js/components/clock-panel.js` | js-component (NUEVO, PROPUESTA) | render del bloque: tramos, reloj de 14, panel de decisión, jugadores, matriz con mapas, conciliación | RF-5…RF-11, RF-14 |
| `frontend/js/views/equipo.js` | js-view (X-01) | montar el bloque en la pestaña `posesion` (S3) y en `quintetos` (sección del quinteto seleccionado, F-06) | RF-5…RF-9 |
| `frontend/js/views/jugador.js` | js-view (X-01) | montar el bloque en la pestaña `posesion` (S4, modo jugador) | RF-8 |
| `frontend/css/style.css` | css | sección `/* ── clock-panel (A-05) ── */` (tarjetas de decisión, matriz, pestañas de tramo mobile) | RF-10, RF-11 |
| `frontend/sw.js` | sw | sumar `js/components/clock-panel.js` a `STATIC` y subir `CACHE` solo si X-01 aún no pasó a runtime caching | — |
| `docs/api.md` | docs | `GET /api/possession-clock`, `clock`/`clock_start` en `/api/shot-zones`, tablas `team_clock`/`zone_clock_matrix`, tipo `clock`, filtros | cierre |
| `docs/metrics.md` | docs | **fuente derivada del reloj de posesión** (resolución de 1 s, regla de tramos, reloj de 14, nulos), unidad oportunidad, fórmulas por tramo, tipos de pérdida | cierre |
| `docs/frontend.md` | docs | bloque "Tramo de reloj de posesión", matriz y copy | cierre |
| `docs/architecture.md` | docs | módulo `possession_clock.py` | cierre |

Matriz RF → archivo: RF-1/RF-2/RF-3/RF-4 `possession_clock.py` (`band_of`, `enrich_clock`), `possessions.py`; RF-5 `stats_engine.py`, `possession_clock.py`; RF-6 `possession_clock.py` (`reconcile`); RF-7 `possession_clock.py` (`side`); RF-8 `possession_clock.py` (`player_clock`), `jugador.js`; RF-9 `possession_clock.py` (`lineup_clock`), `equipo.js`; RF-10 `possession_clock.py` (`decision_panel`), `clock-panel.js`; RF-11 `possession_clock.py` (`clock_matrix`), `shot_zones.py`, `tables.py`, `clock-panel.js`; RF-12 `shot_zones.py`, `context.py`, `possessions.py`; RF-13 `metrics_catalog.py`, `context.py`, `tables.py`; RF-14 `clock-panel.js` + `sample.py`/`population.py` (consumo); RF-15 `config.py`; RF-16 `possession_clock.py`.

## 3. Backend — rutas y modelos

### `GET /api/possession-clock` — NUEVO · PROPUESTA (no está en 00-arquitectura-transversal.md)
- Auth: `login_required`. Contexto T-03 completo (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, `origin`, `ptype`, `chance`; `clock` y `clock_start` se ignoran aquí porque la vista ya desglosa por tramo y se informan en `context.ignored` con razón `no_aplica`). Sin `base`.
- Query: exactamente uno de `team=<team_code>`, `player=<player_id>`, `lineup=<team_code>:<pid>-<pid>-<pid>-<pid>-<pid>` (ids ascendentes de 5 jugadores); `side=ataque|defensa` (default `ataque`; con `player` y `lineup`, `defensa` se acepta y usa las oportunidades del rival con ese jugador/quinteto del equipo en cancha).
- Respuesta 200, `team`, `side=ataque` (valores ilustrativos; los tramos `medio` y `tardio` repiten la forma de `temprano`):
```json
{
  "entity": {"type": "team", "id": "CNF", "name": "Nacional"},
  "side": "ataque",
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {},
              "ignored": [{"param": "clock", "reason": "no_aplica"}, {"param": "clock_start", "reason": "no_aplica"}],
              "level": "posesion", "population_mode": "apply_all", "games_used": 13, "games_total": 13,
              "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "clock_source": {"kind": "derivado", "resolution_secs": 1,
                   "note": "Reloj de posesión derivado del reloj de partido (FIBA no publica el shot clock)."},
  "thresholds": {"early_max": 8, "mid_max": 16, "reset_secs": 14},
  "reconcile": {"fga_team": 912, "in_bands_24": 801, "in_bands_14": 94, "no_clock": 9, "in_incomplete": 8, "ok": true,
                "chances_24": 780, "chances_14": 111},
  "bands": [
    {"key": "temprano", "label": "Temprano", "range": "0–8 s",
     "all": {"shots": 232, "share": 0.2544},
     "r24": {"chances": 201, "shots": 205, "share": 0.2248, "pts": 241,
             "metrics": {"ppp": {"value": 1.2, "reason": null, "percentile": 77, "avg": 1.07, "dist_avg": 0.13, "sample": {"level": "alta", "unit": "posesiones", "n": 201}},
                         "efg_pct": {"value": 0.571, "reason": null}, "ts_pct": {"value": 0.598, "reason": null},
                         "ppt": {"value": 1.19, "reason": null}, "to_pct": {"value": 0.094, "reason": null},
                         "viol24_rate": {"value": 0.0, "reason": null}},
             "mix": {"t2": 0.41, "t3": 0.27, "tl": 0.12, "perdida": 0.2},
             "shape": {"paint_share": 0.47, "perimeter_share": 0.53},
             "turnover_types": {"pase": 9, "manejo": 6, "pasos": 2, "viol24": 0, "otras": 2},
             "sample": {"level": "alta", "n": 201, "unit": "posesiones", "min": 15, "high": 40}},
     "r14": {"chances": 41, "shots": 27, "share": 0.0296, "pts": 33, "metrics": {}, "mix": {}, "shape": {}, "turnover_types": {}, "sample": {}}},
    {"key": "medio", "label": "Medio", "range": "9–16 s", "all": {}, "r24": {}, "r14": {}},
    {"key": "tardio", "label": "Tardío", "range": "17–24 s", "all": {}, "r24": {},
     "r14": {"value": null, "reason": "no_aplica"}}
  ],
  "no_clock": {"shots": 9, "chances": 7, "reason": "reloj_no_derivable"},
  "decision": {
    "q1_perdidas": {"to_pct": {"temprano": 0.094, "medio": 0.12, "tardio": 0.21},
                    "share_of_turnovers": {"temprano": 0.22, "medio": 0.45, "tardio": 0.33},
                    "by_type": {"temprano": {"pase": 9, "manejo": 6, "pasos": 2, "viol24": 0, "otras": 2}, "medio": {}, "tardio": {}}},
    "q2_eficiencia": {"best_band": "temprano",
                      "rows": [{"band": "temprano", "ppp": {"value": 1.2, "avg": 1.07, "dist_avg": 0.13}, "efg_pct": {"value": 0.571, "avg": 0.52, "dist_avg": 0.051}}]},
    "q3_zona_tramo": {"ref": "matrix"},
    "q4_seleccion": [{"band": "temprano", "t2": 0.41, "t3": 0.27, "tl": 0.12, "paint_share": 0.47, "perimeter_share": 0.53}],
    "q5_decide": {"top_by_band": {"temprano": [{"player_id": 812, "name": "S. Canty", "uso_pct": 0.19, "efg_pct": 0.62}], "medio": [], "tardio": []}},
    "q6_costo_tardio": {"ppp_tardio": {"value": 0.82}, "ppp_temprano": {"value": 1.2}, "diff": {"value": -0.38},
                         "reach_tardio_share": {"value": 0.31, "reason": null}},
    "q7_rival": {"ref": "side=defensa"}
  },
  "players": [
    {"player_id": 812, "name": "S. Canty",
     "by_band": {"temprano": {"shots": 21, "efg_pct": {"value": 0.62, "reason": null}, "ppt": {"value": 1.24, "reason": null},
                              "uso_pct": {"value": 0.19, "reason": null}, "finished": 28, "ppp_personal": {"value": 1.18, "reason": null},
                              "sample": {"level": "media", "n": 28, "unit": "posesiones"}},
                 "medio": {}, "tardio": {}}},
    {"player_id": null, "name": "Equipo / sin jugador", "by_band": {"temprano": {"finished": 3}}}
  ],
  "matrix": {"has_coordinates": true,
             "bands": {"temprano": {"zones": {"restricted_area": {"made": 18, "attempts": 27, "fg_pct": 0.667, "efg_pct": 0.667, "ppt": 1.33, "share": 0.116, "percentile": 74, "sample": {"level": "alta", "unit": "intentos", "n": 27, "min": 10, "high": 30}}},
                                  "summary": {"ppt": 1.19, "efg_pct": 0.571, "total_shots": 232}, "has_coordinates": true},
                       "medio": {}, "tardio": {}, "sin_reloj": {}}}
}
```
- `side=defensa`: mismas claves `entity`, `side`, `context`, `clock_source`, `thresholds`, `reconcile`, `bands`, `no_clock`, `decision.q7_rival`, `players` (jugadores rivales omitidos: `players: []`) y `matrix` (sin percentil: `percentile: null`, `percentile_reason: "no_aplica"`) sobre las oportunidades del rival contra el equipo.
- `player=<id>`: `entity.type = "player"`; `bands[].r24/r14` describen **los tiros del jugador** y las oportunidades que termina; `players` = una sola fila (el jugador); `decision` omite `q5` y `q7`.
- `lineup=<id>`: `entity.type = "lineup"`; `bands` sobre las oportunidades cuyo `end_lineup` es el quinteto y los tiros cuyo `lineup` es el quinteto; `matrix` sin percentil; `reconcile` informa los tiros del quinteto.
- Errores (§7.8): 400 `parametro_invalido` "Indicá un equipo, un jugador o un quinteto." / "El lado debe ser ataque o defensa." / "Id de quinteto inválido"; 400 `contexto_invalido` (de `parse_context`); 404 `no_encontrado` "No encontramos ese equipo, jugador o quinteto."; 404 `sin_pbp` "Este equipo no tiene play-by-play importado. Reimportá sus partidos."

### `GET /api/shot-zones` (C-03, modificado)
Acepta `clock` (CSV de `temprano|medio|tardio`) y `clock_start` (`24|14`) como parte del contexto T-03. Con alguno presente, `zones_with_stats` calcula las zonas desde las posesiones recortadas (§4.7) y el percentil con `population("zone", comp, ctx)` con el mismo filtro. El shape de la respuesta no cambia (`zones{11}`, `summary`, `has_coordinates`, `context`).

### `GET /api/table/team_clock` · `GET /api/table/zone_clock_matrix` — NUEVOS (ids fijados en Arq. §6)
- `team_clock`: `tables.register_table("team_clock", entity_type="clock", title="Tramo de reloj — {equipo}", builder=possession_clock.table_rows, default_columns=["_name","_sample","shots","share","efg_pct","ts_pct","ppt","ppp","to_pct","viol24_rate"], bulk_scopes=("team",))`. Params: `team`/`player`/`lineup`, `side`, `section=bandas|jugadores` (PROPUESTA, mismo mecanismo que A-04) + contexto. Filas: una por tramo y bloque (`Temprano · reloj de 24 s`, `Medio · reloj de 24 s`, `Tardío · reloj de 24 s`, `Temprano · reloj de 14 s`, `Medio · reloj de 14 s`) más "Sin reloj derivable"; en `jugadores`, una fila por jugador y tramo.
- `zone_clock_matrix`: `register_table("zone_clock_matrix", entity_type="zone", title="Zona × tramo — {entidad}", builder=possession_clock.matrix_rows, default_columns=["_zone","_band","attempts","fg_pct","efg_pct","ppt"], bulk_scopes=())`. Una fila por celda (11 zonas × tramos + "sin reloj"), formato largo para exportar; textos `_zone`, `_band`; `fga`/`fgm`/`fg_pct`/`efg_pct`/`ppt` del catálogo; badge de intentos.

### `GET /api/metrics/clock?id=<team_code>:<tramo>[:14]` — NUEVO (tipo fijado en Arq. §6)
Loader `possession_clock.clock_bundles(req)` → `StatBundle` con la suma de `Chance.box` de las oportunidades del tramo (reloj de 24 s por defecto; sufijo `:14` para el de 14 s, que en `tardio` devuelve nulo `no_aplica`). Payload §7.3 completo.

### Esquema y configuración
Sin cambios de esquema (Arq. §5). Claves de `CONFIG_SPEC` que A-05 **activa** (declaradas por F-13 como `reservada`):
| Clave | Tipo | Default | Rango | Sección | Consumidor |
|---|---|---|---|---|---|
| `clock.early_max` | int (s) | 8 | 4–12 | Reglas de contexto | A-05 (`band_of`), A-06 |
| `clock.mid_max` | int (s) | 16 | 10–20 | Reglas de contexto | A-05 (`band_of`), A-06 |
Coherencia ya validada por F-13: `clock.early_max < clock.mid_max`. `clock.reset_secs` (14) es de A-01 y ya está activa.

## 4. Backend — lógica

| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `band_of(elapsed, shot_clock_start)` | `possession_clock.py` | regla de tramos | RF-2, RF-3 |
| `enrich_clock(possessions, events, meta)` | `possession_clock.py` | enriquecedor A-01 | RF-1…RF-4, RF-8, RF-9, RF-15 |
| `clock_report(entity_type, entity_id, comp_id, ctx, *, side)` | `possession_clock.py` | agregación | RF-5…RF-7, RF-14, RF-16 |
| `player_clock(...)` · `lineup_clock(...)` | `possession_clock.py` | réplica jugador/quinteto | RF-8, RF-9 |
| `decision_panel(report, comp_id, ctx)` | `possession_clock.py` | siete preguntas | RF-10 |
| `clock_matrix(entity_type, entity_id, comp_id, ctx, *, side)` | `possession_clock.py` | zona × tramo | RF-11 |
| `clock_bundles(req)` · `table_rows(req)` · `matrix_rows(req)` | `possession_clock.py` | loader y builders T-06 | RF-13 |
| `clock_rates(c)` | `stats_engine.py` | fórmulas | RF-5 |

### 4.1 `band_of(elapsed, shot_clock_start) -> str | None`
```
if elapsed is None: return None                                    # reloj no derivable → nulo, nunca "temprano" (RF-2)
early, mid = config.get("clock.early_max"), config.get("clock.mid_max")
if elapsed <= early: return "temprano"
if shot_clock_start >= 24:                                          # oportunidad de reloj completo (24 s)
    return "medio" if elapsed <= mid else "tardio"
return "medio" if elapsed <= min(mid, shot_clock_start) else None   # reloj reiniciado (14 s): sin tramo tardío; > 14 → dato inconsistente (RF-3)
```
Con los cortes por defecto: 0–8 temprano, 9–16 medio, 17–24 tardío; reloj de 14: 0–8 temprano, 9–14 medio.

### 4.2 `enrich_clock(possessions, events, meta) -> None` (registrado con `possessions.register_enricher("clock", enrich_clock)`)
Entradas: posesiones de un partido (A-01 con `chances` y `shots[]`; `origin`/`ptype` de A-02/A-03 ya enriquecidos; `end_player_id` de A-03 no se usa aquí porque es por posesión y el análisis es por oportunidad), eventos por `action_number`, `meta = {game_id, codes, name_to_id, mclock, event_lineups}` (A-01 §4.3). Configuración leída por `band_of`.
```
idx = {ev["action_number"]: i for i, ev in enumerate(events)}
TURNOVER_KIND = {"badpass": "pase", "ballhandling": "manejo", "travel": "pasos", "24sec": "viol24"}   # resto → "otras"
for pos in possessions:
    if pos.incomplete:
        for ch in pos.chances: ch.band = ch.end_elapsed = ch.end_player_id = ch.end_lineup = ch.turnover_kind = ch.box = None
        for s in pos.shots: s["band"] = None
        continue
    for n, ch in enumerate(pos.chances):
        lo = idx[ch.start_event]
        hi = idx[pos.chances[n+1].start_event] if n+1 < len(pos.chances) else idx[pos.end_event] + 1     # [lo, hi): rango de la oportunidad
        own = [ev for ev in events[lo:hi] if ev["team_code"] == pos.team]
        ch.box = _count(own)                                  # fga2/fgm2/fga3/fgm3/fta/ftm/tov (+ viol24 = turnovers con sub_type "24sec") — mismo criterio que lineups._agg
        # evento de decisión: último tiro de campo; si no hay, la pérdida; si no, el primer tiro libre de la falta recibida
        fga = [ev for ev in own if ev["action_type"] in ("2pt", "3pt")]
        if fga:                         dec = fga[-1]
        elif ch.end_type == "perdida":  dec = first(ev for ev in own if ev["action_type"] == "turnover")
        elif ch.end_type == "falta":    dec = first(ev for ev in own if ev["action_type"] == "freethrow")   # el reloj del 1.er TL es el de la falta
        else:                           dec = None                                                            # fin de período sin acción
        if dec is None: ch.band = ch.end_elapsed = None; ch.end_player_id = None; ch.end_lineup = None; continue    # fin de período sin acción
        e = ch.start_clock - meta["mclock"][dec["action_number"]]
        ch.end_elapsed = e if 0 <= e <= ch.shot_clock_start + 1 else None                                         # no derivable → nulo
        ch.band = band_of(ch.end_elapsed, ch.shot_clock_start)
        ch.end_player_id = (name_to_id(dec) if dec["action_type"] in ("2pt", "3pt", "turnover")
                            else name_to_id(último `foulon` de pos.team en own) )                                  # None = pérdida/falta de equipo
        ch.end_lineup = tuple(sorted(meta["event_lineups"][idx[dec["action_number"]]][pos.team] or ())) or None     # 5 ids o None
        if dec["action_type"] == "turnover": ch.turnover_kind = TURNOVER_KIND.get((dec.get("sub_type") or "").lower(), "otras")
    for s in pos.shots:                                       # tramo por tiro (arquitectura §3.9)
        ch = chance_containing(pos, s["action_number"])       # la oportunidad cuyo rango contiene el tiro
        s["band"] = band_of(s["elapsed"], ch.shot_clock_start)
        s["clock_start"] = ch.shot_clock_start
        s["lineup"] = tuple(sorted(meta["event_lineups"][idx[s["action_number"]]][pos.team] or ())) or None
```
- Un tiro con `elapsed` nulo (A-01 `reloj_no_derivable`) queda con `band = None` y cuenta en `no_clock`; una oportunidad sin evento de decisión (fin de período sin acción) queda con `band = None` y cuenta como "sin tramo" aparte (no es dato faltante: no hubo acción).
- Resolución de 1 s: un tiro a 8,4 s se lee como 8 (temprano). Documentado en `docs/metrics.md`.
- Caché: el enriquecido queda dentro del caché de `game_possessions` (`poss:game`, clave con `config_version`): cambiar `clock.early_max`/`clock.mid_max` invalida y reasigna sin reiniciar (RF-15, CA-3).

### 4.3 `clock_report(entity_type, entity_id, comp_id, ctx, *, side="ataque") -> dict`
```
ctx_t  = replace(ctx, clock=None, clock_start=None)
poss   = possessions.team_possessions(team, comp_id, ctx_t, side=side, include_incomplete=True)       # incluye incompletas para conciliar (parámetro PROPUESTO por A-03)
chs    = [(p, ch) for p in poss if not p.incomplete for ch in p.chances]                              # oportunidades de posesiones completas
shots  = [s for p in poss for s in p.shots]                                                          # tiros de TODAS las posesiones (completas e incompletas) para conciliar
in_inc = [s for p in poss if p.incomplete for s in p.shots]
for band in ("temprano", "medio", "tardio"):
    sh_all = [s for s in shots if s["band"] == band and not p_incomplete(s)]                          # ambos relojes
    for block, cs in (("r24", 24), ("r14", 14)):
        C = [ch for (p, ch) in chs if ch.band == band and (ch.shot_clock_start >= 24) == (block == "r24")]
        S = [s for s in sh_all if (s["clock_start"] >= 24) == (block == "r24")]
        counts = {n: len(C), pts: Σ ch.pts, shots: len(S), fga: len(S),
                  fgm: Σ s["made"], fga3: #{s: ZONE_POINTS[s["zone"]] == 3}, fgm3: #{s made de 3}, pts_fg: Σ s["pts"],
                  fta: Σ ch.box.fta, ftm: Σ ch.box.ftm, tov: Σ ch.box.tov, viol24: Σ ch.box.viol24,
                  t2/t3/tl/perdida: conteo de ch.end_type (t2c|t2f → t2, t3c|t3f → t3, falta → tl, perdida → perdida),
                  paint: #{s: s["zone"] in PAINT_ZONES}}
        rates = stats_engine.clock_rates(counts)         # ver §4.4
        sample = sample.sample_level("split", n=len(C), unit="posesiones", team_poss=len(chs))
        r14/tardio → {"value": None, "reason": "no_aplica"}
no_clock = {"shots": #{s: band None and not incomplete}, "chances": #{ch: band None and hubo decisión con reloj no derivable}}
reconcile = {fga_team: Σ box fga2+fga3 del equipo en la selección (team_game_rows; pbp si falta), in_bands_24, in_bands_14, no_clock, in_incomplete, ok: suma == fga_team}
fichas: population.attach_fichas({ppp, efg_pct, to_pct, ppt}, "clock", f"{team}:{band}", pop_band)  con pop_band = population("clock", comp_id, replace(ctx_t, clock=(band,), clock_start="24"))   # PROPUESTA §10 D-3: población acotada al tramo
```
Caché: `cache.memo("poss:clock", (entity_type, entity_id, comp_id, context_key(ctx), side), fn)`.
Partidos sin pbp → excluidos por `team_possessions` y contados en `context.games_excluded.sin_pbp`.

### 4.4 `stats_engine.clock_rates(c: dict) -> dict` (regla 4: fórmulas)
```
efg_pct     = _safe_div(c.fgm + 0.5*c.fgm3, c.fga)                       # (T2c + T3c + 0,5·T3c)/(T2i + T3i) con fgm = T2c+T3c
ppt         = _safe_div(c.pts_fg, c.fga)                                  # puntos de campo / tiros de campo intentados
ts_pct      = _safe_div(c.pts_fg + c.ftm, 2*(c.fga + 0.44*c.fta))         # definición mixta del spec §9
ppp         = _safe_div(c.pts, c.n)                                       # puntos de las oportunidades del tramo / oportunidades
to_pct      = _safe_div(c.tov, c.n)
viol24_rate = _safe_div(c.viol24, c.n)
mix         = {t2, t3, tl, perdida: _safe_div(c.<k>, c.n)}                # suma 100 % de las oportunidades del tramo
paint_share = _safe_div(c.paint, c.fga) ; perimeter_share = 1 − paint_share (None si fga = 0)
share       = _safe_div(c.fga, c.fga_total)                                # tiros del bloque / tiros de campo del equipo en la selección
```
Fórmulas idénticas al glosario v2 §6 y a la conciliación §2.2 de la arquitectura (eFG%, TS%, PPT); A-05 solo las aplica al subconjunto de cada tramo. `PAINT_ZONES` = `restricted_area`, `mid_left_close`, `mid_right_close` (alinear con `paint_fga_share` de T-05).

### 4.5 `player_clock(player_id, comp_id, ctx)` y `lineup_clock(lineup_id, comp_id, ctx)`
- **Jugador**: `poss = team_possessions(team, comp_id, ctx_t, side="ataque", include_incomplete=True)`; tiros = `s["player_id"] == pid`; oportunidades terminadas = `ch.end_player_id == pid`; por (tramo, bloque): `shots`, `efg_pct`, `ppt`, `ts_pct` (FT de las oportunidades que termina), `finished`, `ppp_personal = Σ ch.pts / finished`, `uso_pct = finished / oportunidades del equipo en el tramo` (misma base que el plantel). Modo equipo: la tabla `players` agrega todos los jugadores del plantel con ≥ 1 oportunidad terminada más la fila "Equipo / sin jugador" (`end_player_id is None`); la suma de `finished` por tramo es igual a las oportunidades del equipo con tramo (CA-10).
- **Quinteto**: filtro `ch.end_lineup == ids` y `s["lineup"] == ids`; mismo cálculo que el equipo. `lineup_id = <team>:<pid>-…` con ids ascendentes (convención de §3.12); 400 si no hay exactamente 5 ids o no son del mismo equipo. Los tiros/oportunidades con `lineup = None` (no hay 5 identificados) no pertenecen a ningún quinteto y se informan en `reconcile.sin_quinteto`.
- Muestra: `sample.sample_level("split", n=oportunidades, unit="posesiones")` por fila de tramo; en modo quinteto, además badge global con `lineup` (`sample.lineup.*`).

### 4.6 `decision_panel(report, comp_id, ctx) -> dict` (RF-10)
Reutiliza los números del propio `report` (sin recalcular):
- **q1**: `to_pct` por tramo (r24), `share_of_turnovers[b] = tov_b / Σ tov` (tramos con reloj de 24 s) y `by_type` desde `turnover_types` (CA-8).
- **q2**: `ppp` y `efg_pct` por tramo con `avg`/`dist_avg`/`percentile` de las fichas de `pop_band` (misma convención orientada de T-01, DA-09); `best_band` = tramo de mayor PPP entre los de muestra ≥ `media`.
- **q3**: referencia a `matrix` (§4.7).
- **q4**: `mix` y `shape` por tramo.
- **q5**: `top_by_band[b]` = hasta 3 jugadores por `uso_pct` con su `efg_pct`, solo muestra ≥ `media`.
- **q6**: `ppp_tardio`, `ppp_temprano`, `diff = ppp_tardio − ppp_temprano`, `reach_tardio_share = chances_tardio(r24) / Σ chances con tramo (r24)` (null `sin_intentos` si 0).
- **q7**: referencia a la vista `side=defensa` (el front la pide con las mismas métricas); con `side=defensa` el panel muestra directamente q1–q6 sobre el rival.

### 4.7 `clock_matrix(entity_type, entity_id, comp_id, ctx, *, side)` y extensión de `shot_zones`
```
for band in ("temprano", "medio", "tardio"):
    zones = shot_zones.zones_with_stats(entity_type, entity_id, comp_id, replace(ctx_t, clock=(band,)))     # equipo y jugador: percentil y badge `sample.clock_zone` (C-03)
no_clock = zone_table_from_shots([s for s in shots if s["band"] is None])                                    # "sin reloj", sin percentil
# defensa y quinteto: zone_table_from_shots(shots filtrados) sin percentil (percentile: null, percentile_reason: "no_aplica")
```
- `shot_zones.zones_with_stats(entity_type, entity_id, comp_id, ctx)`: si `context.level(ctx) == "posesion"` (hay `clock`/`clock_start`), arma `shots` desde `possessions.team_possessions(team, comp_id, ctx)` (posesiones recortadas a las oportunidades que cumplen el filtro; `shots` ya recortados al tramo) en lugar de leer la tabla `shots`; si no, comportamiento de C-03 sin cambio. La población de percentiles se recalcula con el mismo `ctx` (T-01).
- `zone_table_from_shots(shots: list[dict]) -> dict` (NUEVA, PROPUESTA): agrupa dicts `{zone, made, pts}` en las 11 zonas con las mismas fórmulas de `zone_table` (FG%, eFG%, PPT) y devuelve el shape de C-03; reutilizada por `zone_table`.
- Invariantes (CA-13): Σ `attempts` de las zonas de un tramo == `bands[b].all.shots`; Σ tramos + `sin_reloj` por zona == intentos de la zona sin filtro.
- Sin coordenadas reales (`has_coordinates == false`): las zonas son las aproximadas por defecto de C-03; la respuesta lleva `has_coordinates: false` y la UI muestra el aviso (RF-16, CA-18).

### 4.8 Recorte por oportunidad para `clock`/`clock_start` (extensión de A-04 D-7)
`possessions.team_possessions` con `ctx.clock` o `ctx.clock_start` devuelve posesiones **recortadas** a las oportunidades que cumplen (`ch.band in ctx.clock` y/o `str(ch.shot_clock_start) == ctx.clock_start`): `p.chances` y `p.shots` quedan reducidos, `p.pts = Σ ch.pts`, `p.box` = suma de `ch.box`. Las oportunidades de una misma posesión que no cumplen se descartan. `context.possession_predicate` agrega la rama correspondiente. Así `GET /api/metrics/team?clock=tardio` y `/api/shot-zones?clock=tardio` calculan sobre exactamente los tiros y oportunidades del tramo (`possessions_counted` = oportunidades que cumplen; documentado en `docs/metrics.md`).

### 4.9 `clock_bundles(req)`, dimensiones y tablas
- `StatBundle(entity_type="clock", entity_id="CNF:tardio" | "CNF:temprano:14", own=<Σ Chance.box de las oportunidades del tramo>, opp=<Σ box del rival en las mismas posesiones>, games=<partidos con ≥ 1 oportunidad>, minutes=None, seconds=Σ duración de las oportunidades, possessions_counted=n)`; `compute_standard` devuelve `no_aplica` en `pace`, `minutes`, `uso_*`. Claves propias (grupo `extra`): `clock_shot_share` (pct, neutral, fixed) y `clock_viol24_rate` (pct, lower, fixed).
- `context.register_dimension("clock", level="posesion", values=("temprano","medio","tardio"), parser=_parse_clock)` y `register_dimension("clock_start", level="posesion", values=("24","14"), parser=_parse_clock_start)`; valores fuera del enum → 400 `contexto_invalido`.
- `table_rows(req)` / `matrix_rows(req)`: builders T-06 (ver §3); columnas propias (`shots`, `share`, `viol24_rate`, `attempts`) con metadatos en el catálogo.

### Manejo de nulos (C-11)
Tiro sin reloj derivable → tramo nulo y fila "Sin reloj derivable" (nunca `temprano`). Oportunidad sin acción por fin de período → sin tramo, contada aparte. Tramo sin oportunidades o tiros → métricas `null` con razón `sin_intentos` (la fila nunca se omite); `r14.tardio` → `null` `no_aplica`. Partidos sin pbp → `sin_pbp`. Sin coordenadas → `has_coordinates: false` y razón `sin_coordenadas` en la matriz.

## 5. Frontend — capa API (api.js)
- `api.possessionClock({team, player, lineup, side, ...context})` → `apiFetch("/api/possession-clock" + qs(params))`.
- `api.shotZones(params)` (C-03) ya acepta contexto: no cambia su firma (pasa `clock`/`clock_start` desde `contextToQuery`).
- Reutiliza `api.table("team_clock" | "zone_clock_matrix", params)` (T-06), `api.metrics("clock", params)` (T-05), `api.ranking(...)` (T-01).

## 6. Frontend — UI
- **Ubicación**: S3 Equipo → pestaña `posesion` (`#/equipo/<code>/posesion?…`), último sub-bloque "Tramo de reloj de posesión" (después de Origen A-02, Transición A-03 y Segunda oportunidad A-04); S4 Jugador → pestaña `posesion` (modo jugador); S3 → pestaña `quintetos` como sección colapsable "Tramo de reloj" del quinteto seleccionado (gancho: `renderQuintetosTab` de F-06 expone el contenedor del detalle de la combinación; A-05 agrega la sección debajo del panel estándar). El mapa filtrable por tramo no tiene vista propia: usa la barra de contexto (T-03 ofrece `clock`/`clock_start` desde que `GET /api/context/options` los marca `available: true`) sobre las pestañas Tiro de S3/S4.
- **Componentes reutilizados** (Arq. §8): `shot-chart.js` (`shotChart`, `bindZoneTooltips` de C-03: cada mapa de la matriz es una llamada con el payload de zonas del tramo), `metric-card.js`, `sample-badge.js`, `data-table.js` (`team_clock`, `zone_clock_matrix`), `export-menu.js` (CSV/XLSX/PNG/PDF de la matriz con `getNode` = contenedor de los tres mapas), `core/format.js`, `core/colors.js`, `core/context.js`, `context-bar.js`. Sin `t()` (DA-21 resuelta: copy directo en español).
- **Nuevo**: `components/clock-panel.js` → `renderClockPanel(el, payload, {mode: "team"|"player"|"lineup"})` (PROPUESTA):
  1. Nota fija de fuente: "Reloj de posesión derivado del reloj de partido (FIBA no publica el shot clock)." y leyenda de cortes ("Temprano: 0–{early_max} s · Medio: {early_max+1}–{mid_max} s · Tardío: {mid_max+1}–24 s").
  2. Tabla de tramos del reloj de 24 s (T-06) con las columnas del spec §6 y badge de muestra; tabla aparte "Reloj de 14 s (tras rebote ofensivo): no hay tramo tardío"; fila "Sin reloj derivable".
  3. Panel de decisión: siete tarjetas con título-pregunta (copy del cliente), el dato principal (frase con plantilla fija y valores formateados, p. ej. "El 45 % de las pérdidas ocurre en el tramo medio"), y la tabla o gráfico de respaldo (barras CSS).
  4. Matriz zona × tramo: tres mapas (temprano, medio, tardío) con el tooltip de 7 datos y color por percentil; tabla larga exportable debajo; pestañas de tramo en mobile.
  5. Tabla de jugadores (modo equipo) con USO% y eficiencia por tramo.
  6. Selector Ataque/Defensa (chips) → recarga con `side`; en defensa el título cambia a "Tramo en que obligamos a tirar al rival" y las columnas leen "concedido"/"forzado".
  7. Pie: conciliación "Tiros: A en reloj de 24 s + B en reloj de 14 s + C sin reloj + D en posesiones incompletas = N (100 %)".
- **Estados**: spinner mientras carga; vacío/errores/offline con el copy del spec §6; filas y celdas de muestra baja en gris sin color de rendimiento.
- **Mobile 768 px**: tablas con columna fija, un mapa por pestaña de tramo, tarjetas de decisión en una columna.

## 7. Navegación
Sin sección nueva. Usa las pestañas `posesion` (S3/S4) y `quintetos` (S3) de X-01/F-06 (Arq. §3.12). El estado Ataque/Defensa va en la query del hash como `side=defensa` (PROPUESTA: parámetro de vista, no de contexto; mismo patrón que A-02/A-03/A-04). El filtro de tramo del mapa vive en el contexto (`clock=tardio`, `clock_start=14`) y se conserva al cambiar de pestaña. Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
- Response de `/api/possession-clock`: ejemplo completo en §3. Objetos métrica = §7.1 (T-01) con `sample` §7.2; nulos §7.4 (`sin_intentos`, `no_aplica`, `reloj_no_derivable`, `sin_coordenadas`, `sin_pbp`). `matrix.bands[b]` = shape de `GET /api/shot-zones` (C-03), consumible directamente por `shotChart`.
- Tablas `team_clock` y `zone_clock_matrix`: §7.6. Entidad `clock`: §7.3.
- Campos nuevos de `Chance` (PROPUESTA, en `possessions.py`, completados solo por `enrich_clock`): `band: str | None`, `end_elapsed: int | None`, `end_player_id: int | None`, `end_lineup: tuple[int, ...] | None`, `turnover_kind: str | None` (`pase` | `manejo` | `pasos` | `viol24` | `otras`), `box: dict | None` (`fga2`, `fgm2`, `fga3`, `fgm3`, `fta`, `ftm`, `tov`, `viol24`). Claves nuevas en cada elemento de `Possession.shots[]`: `clock_start: int`, `lineup: tuple[int, ...] | None` (`band` ya está en el contrato de A-01).
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
| Código | `code` | Mensaje (español) |
|---|---|---|
| 400 | `parametro_invalido` | "Indicá un equipo, un jugador o un quinteto." / "El lado debe ser ataque o defensa." / "Id de quinteto inválido" |
| 400 | `contexto_invalido` | mensaje de `parse_context` |
| 401 | — | handler global de `api.js` (login) |
| 404 | `no_encontrado` | "No encontramos ese equipo, jugador o quinteto." |
| 404 | `sin_pbp` | "Este equipo no tiene play-by-play importado. Reimportá sus partidos." |
| 429 | — | "Demasiadas solicitudes. Esperá un momento." (existente) |
Offline: `/api/*` siempre a red; el panel muestra "Sin conexión: el análisis de posesiones necesita conexión." Si X-01 no pasó a runtime caching, sumar `js/components/clock-panel.js` a `STATIC` y subir `CACHE` al siguiente entero.

## 10. Riesgos / decisiones
- **D-1 · Reloj derivado y resolución de 1 s (riesgo principal).** El tramo depende de `clock_secs` (1 s; centésimas solo en el último minuto) y de que A-01 fije bien el inicio de la oportunidad (`start_clock`): tras canasta rival el reloj de posesión arranca con el saque, que no se registra, así que el `elapsed` puede estar sobreestimado en 1–3 s en esas posesiones (el tiempo del saque cuenta como posesión). Limitación documentada en `docs/metrics.md`; la lectura es "tiempo de reloj de partido transcurrido desde que la posesión quedó definida", no shot clock.
- **D-2 · Endpoint propio y campos de `Chance` (PROPUESTA).** La arquitectura fija `team_clock`, `zone_clock_matrix` y el tipo `clock`, pero no un endpoint para el bloque ni los campos de `Chance` que necesita el análisis por oportunidad, jugador y quinteto. Se propone `GET /api/possession-clock` (patrón de `/api/origins`, `/api/transition`, `/api/second-chance`) y los campos de §8. Reportado en huecos.
- **D-3 · Población acotada al tramo (PROPUESTA).** `population("clock", comp_id, ctx)` enumeraría `<equipo>:<tramo>` de los tres tramos mezclados; para que "promedio de la competencia en ese mismo tramo" sea correcto se invoca con `ctx` acotado (`replace(ctx, clock=(band,), clock_start="24")`), como A-02/A-03. Reportado en huecos (T-01).
- **D-4 · `possessions_counted` y `ppp`.** El PPP por tramo usa oportunidades exactas (`possessions_counted`), no la fórmula de posesiones `2PA + 3PA + 0,44·FTA + TOV − OR` (difieren ~1–3 % en oportunidades que terminan en tiros libres); la arquitectura §3.9 pide que "PPP por origen/tipo/tramo" use `possessions_counted`. `compute_standard` debe preferirlo para `ppp` cuando el bundle lo trae (a coordinar con T-05/A-01; mismo criterio ya asumido por A-02/A-03).
- **D-5 · Matriz zona × tramo: A-05 vs A-06.** C-03 la difiere a A-06 ([C-03 plan §10](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)); la arquitectura (§6) y el cliente (A-05) la asignan a A-05. Se construye aquí con la forma de matriz fija zona × tramo; A-06 reutiliza esta función como caso particular del cruce genérico. Reportado como desacuerdo leve.
- **D-6 · Filtro `clock` a nivel oportunidad (PROPUESTA).** El contrato de §3.8 lo declara "nivel posesión"; el reloj es de la oportunidad. Se implementa con el mismo recorte por oportunidad de A-04 D-7 (documentado en `docs/metrics.md`).
- **D-7 · Rebote de equipo y oportunidades sin jugador.** Las oportunidades que terminan en pérdida de equipo o falta sin `foulon` identificable cuentan en "Equipo / sin jugador"; no se reparten entre jugadores.
- **D-8 · Alcance y partición.** El requisito es grande (XL por la réplica a jugador y quinteto, el panel de decisión y la matriz). Si en la implementación superara 26 h, partir en (a) equipo + defensa + reloj de 14 + conciliación + dimensiones y (b) jugador + quinteto + panel de decisión + matriz y extensión de `shot_zones`.
- Desviaciones respecto de la arquitectura: ninguna de contrato; las PROPUESTAS anteriores y la **activación** de claves declaradas por F-13 (la arquitectura §3.2 dice que A-05 las "agrega"; F-13 las declara como reservadas y A-05 las activa).
- **Dependencias técnicas:**
  - A-01 `possessions.game_possessions`, `team_possessions`, `register_enricher`, `Possession`, `Chance`, `lineups.build_segments_both`/`event_lineups` ([../01-A-01-motor-posesiones/plan.md](../01-A-01-motor-posesiones/plan.md)).
  - A-03 parámetro `include_incomplete` de `team_possessions` ([../03-A-03-transicion-contraataque/plan.md](../03-A-03-transicion-contraataque/plan.md)); A-04 recorte por oportunidad ([../04-A-04-segunda-oportunidad/plan.md](../04-A-04-segunda-oportunidad/plan.md)).
  - F-13 `config.get`, `CONFIG_SPEC` ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
  - C-03 `shot_zones.classify_zone`/`zone_table`/`zones_with_stats`, `components/shot-chart.js` ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)).
  - F-11 `pbp_events.previous_action`/`qualifiers`, coordenadas de tiro, `repository`, `cache` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - T-05 `StatBundle`, `compute_standard`, `register_entity` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-02 `sample.sample_level` (`split`, `clock_zone`) ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - T-01 `population.population`, `attach_fichas` ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)).
  - T-06 `tables.register_table`, `data-table.js`, `export-menu.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - C-08 `identity.player_card` ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)).
  - F-06 pestaña `quintetos` y ids de quinteto ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)).
  - T-03 `context.register_dimension`, `parse_context`, `/api/context/options` ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)).
  - X-01 `registerTab`, vistas `equipo.js`/`jugador.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
- **Incrementos diferidos:** ninguno.
- **Estimación: XL · 20–26 h** (enriquecedor, `band_of` y campos de `Chance` 4 h, agregación por tramo y reloj de 14 con conciliación 4 h, defensa, jugador y quinteto 3–4 h, panel de decisión 2 h, matriz y extensión de `shot_zones` 3–4 h, registros T-03/T-05/T-06 y activación de config 2 h, UI 4 h, verificación y docs 3–4 h). Ajuste sobre la arquitectura (14–20 h): +6 h por la réplica a quinteto, la matriz exportable y la extensión de `shot_zones`; ver D-8 para la partición.
