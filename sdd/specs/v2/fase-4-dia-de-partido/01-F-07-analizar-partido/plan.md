# Plan — F-07: Analizar partido

> **ID:** F-07 · **Prioridad:** P1 · **Fase y orden:** Fase 4 — Día de partido · 01
> **Depende de:** X-01, T-05, T-06, A-05, F-06, C-03, A-01, T-02, F-11 (rutas en [spec.md](spec.md)) · **Habilita:** F-03, F-01, F-02, A-08, A-11
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Arquitectura §3.9, §3.10, §3.11, §3.12, §3.13, §3.14, §4, §6, §7, §8 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))
> **Estimación:** XL · 30–40 h

## 1. Enfoque

Dos módulos backend nuevos de la arquitectura: `backend/game_analysis.py` (partido completo: encabezado, box oficial + conjunto
estándar, parciales, línea de tiempo, jugada a jugada, zonas filtradas) y `backend/matchups.py` (coincidencia en cancha de dos
equipos a partir de `lineups.build_segments_both` de A-01, en tres niveles; `team_matchups` queda lista para F-03). Todo se
calcula on-the-fly con `stats_engine.compute_standard` sobre `StatBundle` y se cachea con `cache.memo` por
(`game_id`, versiones). Las tablas se registran en `tables.register_table` (T-06) y la entidad `matchup` en
`metrics_catalog.register_entity` (T-05). El frontend agrega el componente reutilizable `components/game-view.js`
(`renderGameView(el, payload, {mode})`) y completa la pestaña `analizar` de `views/partido.js` (creada por X-01), reutilizando
`data-table.js`, `export-menu.js`, `exporters.js`, `shot-chart.js`, `sample-badge.js` y `tabs.js`.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/game_analysis.py` | module NUEVO | `game_detail`, `game_pbp`, `score_timeline`, `game_shots` (PROPUESTA), `period_partials`, `reconcile_game`, builders de tablas `game_players`/`game_lineups` | RF-1, RF-3–RF-19, RF-25, RF-28, RF-29 |
| `backend/matchups.py` | module NUEVO | `game_matchups`, `team_matchups`, `_intersect_segments`, bundles de emparejamiento, loader de entidad `matchup`, builders de tablas `matchups_*` | RF-20–RF-24, RF-28 |
| `backend/app.py` | route | 4 rutas finas: `GET /api/game/<game_id>`, `…/pbp`, `…/matchups`, `…/shots` (PROPUESTA) | RF-1, RF-13, RF-17, RF-18, RF-21 |
| `backend/config.py` | module (ext.) | agrega a `CONFIG_SPEC` la clave `game.run_min_points` (PROPUESTA) | RF-11 |
| `backend/metrics_catalog.py` | module (ext.) | `register_entity("matchup", matchups.load_matchup_bundles)` (registro desde `matchups.py` al importar) | RF-21, CA-9 |
| `backend/tables.py` | module (consumo) | registros `game_players`, `game_lineups` (PROPUESTA), `matchups_quinteto`, `matchups_jugador`, `matchups_jugador_quinteto` (llamados desde los módulos dueños) | RF-5, RF-20, RF-21, RF-25 |
| `frontend/js/api.js` | js-api | `api.game`, `api.gamePbp`, `api.gameMatchups`, `api.gameShots` | RF-1, RF-13, RF-17, RF-21 |
| `frontend/js/components/game-view.js` | js-component NUEVO | `renderGameView(el, payload, {mode})` y sub-bloques (`gvHeader`, `gvBox`, `gvPartials`, `gvTimeline`, `gvShots`, `gvPbp`, `gvLineups`, `gvMatchups`, `gvScoutingReport`) | RF-3–RF-27 |
| `frontend/js/views/partido.js` | js-view (ext.) | pestaña `analizar`: carga, estados, enlace a bloques; habilita la sección S5 (`registerSection({slug:"partido", enabled:true})` y `registerTab("partido", {slug:"analizar"})`) | RF-1, RF-3 |
| `frontend/js/views/datos.js` | js-view (edit) | fila del catálogo (`partidos`) navega a `#/partido/<game_id>/analizar` | RF-2 |
| `frontend/js/views/equipo.js`, `frontend/js/views/jugador.js` | js-view (edit) | filas del game log con enlace al partido | RF-2 |
| `frontend/js/charts.js` | js-chart (ext.) | `drawScoreTimeline(canvas, timeline, {homeName, awayName})` con plugin inline de marcas (períodos, tiempos muertos, rachas) | RF-10, RF-11 |
| `frontend/js/components/shot-chart.js` | js-component (ext. acotada) | opción `colorBy: "none"` para un partido (PROPUESTA de extensión del componente de C-03) y `onZoneClick` | RF-13, RF-16 |
| `frontend/css/style.css` | css | sección `/* ── game-view (F-07) ── */` (encabezado, chips de estado, timeline, lista pbp, matriz de cruces, `@media print` del informe A4) | RF-3, RF-10, RF-17, RF-26 |
| `frontend/sw.js` | sw | subir `CACHE` al siguiente entero (con runtime caching de X-01 no hace falta tocar `STATIC`; si X-01 no cambió la estrategia, agregar `/js/components/game-view.js`) | offline |
| `docs/api.md` | doc | 4 endpoints nuevos, tablas nuevas, entidad `matchup` | cierre |
| `docs/frontend.md` | doc | sección S5 · Analizar, componente `game-view.js`, copy nuevo, `drawScoreTimeline` | cierre |
| `docs/architecture.md` | doc | módulos `game_analysis.py`, `matchups.py` | cierre |
| `docs/metrics.md` | doc | definición de racha, tiempo transcurrido, métricas de emparejamiento (coincidencia en cancha) | cierre |

Matriz RF → archivo: RF-1 (app.py, game_analysis, partido.js, api.js) · RF-2 (datos.js, equipo.js, jugador.js) · RF-3 (game_analysis, game-view) · RF-4–RF-6 (game_analysis, tables, game-view) · RF-7 (game_analysis.reconcile_game, game-view) · RF-8–RF-9 (game_analysis.period_partials, game-view) · RF-10–RF-12 (game_analysis.score_timeline, config.py, charts.js, game-view) · RF-13–RF-16 (game_analysis.game_shots, app.py, api.js, shot-chart.js, game-view) · RF-17–RF-19 (game_analysis.game_pbp, app.py, api.js, game-view) · RF-20 (game_analysis/matchups, tables, game-view) · RF-21–RF-24 (matchups, tables, metrics_catalog, app.py, game-view) · RF-25 (tables, export-menu vía game-view) · RF-26 (game-view `gvScoutingReport`, style.css print) · RF-27 (game-view) · RF-28 (módulos backend) · RF-29 (todos, vía `compute_standard` y `nullDisplay`).

## 3. Backend — rutas y modelos

Sin tablas ni columnas nuevas. Todas las rutas con `login_required`. Errores con el formato de Arquitectura §7.8.

### 3.1 `GET /api/game/<game_id>` NUEVO (Arquitectura §6)
- Parámetros: `base` ∈ `total|partido|por40|por100` (default `total`; aplica al conjunto estándar de jugadores).
- Response 200 (ejemplo recortado, claves completas):
```json
{
  "game": {"game_id": "2513425", "date": "2026-05-10", "competition_id": 3,
           "competition_label": "Liga Uruguaya de Básquetbol 2025/2026",
           "home_code": "CNF", "home_team": "Nacional", "away_code": "PEN", "away_team": "Peñarol",
           "home_score": 84, "away_score": 79, "minutes": 45, "overtimes": 1,
           "has_pbp": true, "has_coords": true, "needs_reprocess": false},
  "box": {
    "home": {"team_code": "CNF", "team_name": "Nacional",
             "official": {"pts": 84, "fgm2": 22, "fga2": 41, "fgm3": 9, "fga3": 28, "ftm": 13, "fta": 17,
                          "orb": 11, "drb": 27, "trb": 38, "ast": 18, "tov": 12, "stl": 7, "blk": 3, "pf": 19,
                          "team_orb": 2, "team_drb": 3, "team_tov": 1, "blk_received": 2, "fouls_drawn": 21,
                          "paint_pts": 36, "second_chance_pts": 12, "pts_from_tov": 14, "bench_pts": 22, "fast_break_pts": 9}},
    "away": {"...": "idem"},
    "checks": {"ok": true,
               "items": [{"check": "score_final", "ok": true},
                         {"check": "players_sum", "ok": true, "diffs": {}},
                         {"check": "period_sum", "ok": true},
                         {"check": "timeline_final", "ok": true}]}
  },
  "standard": {"home": {"...": "Arquitectura §7.3 (entity type team, id CNF, contexto del partido)"},
               "away": {"...": "§7.3"}},
  "players": {"...": "payload §7.6 de la tabla game_players (todas las filas de ambos equipos; columna _team)"},
  "partials": [
    {"period": "1", "label": "1C", "home": 22, "away": 18,
     "ratings": {"home": {"possessions": {"value": 19.4, "reason": null}, "oer": {"value": 1.134, "reason": null},
                          "der": {"...": ""}, "net_rating": {}, "pace": {}, "efg_pct": {}, "ts_pct": {},
                          "to_pct": {}, "or_pct": {}, "ft_rate": {}},
                 "away": {"...": "idem"}}},
    {"period": "pr1", "label": "PR1", "home": 11, "away": 6, "ratings": {"...": ""}}
  ],
  "partials_source": "oficial",
  "timeline": {"...": "§8.2"},
  "lineups": {"home": {"...": "payload §7.6 de game_lineups (team=home)"}, "away": {"...": ""}},
  "base": "total"
}
```
- Partido sin pbp: `timeline: null`, `lineups: null`, `partials[].ratings.*.*` = `{"value": null, "reason": "sin_pbp"}`,
  `partials_source` = `oficial` (si `period_pts` existe) o `null` con `partials: []` y `partials_reason: "no_registrado"`.
- Errores: 404 `{"error": "Partido no encontrado", "code": "no_encontrado"}`; 400 `parametro_invalido` si `base` no válida
  ("Base de normalización inválida").

### 3.2 `GET /api/game/<game_id>/pbp` NUEVO
- Parámetros: `player` (player_id entero, opcional), `type` (CSV de grupos: `tiro`, `tiro_libre`, `rebote`, `asistencia`,
  `perdida`, `robo`, `tapon`, `falta`, `cambio`, `tiempo_muerto`, `otro`), `period` (CSV de `1`,`2`,`3`,`4`,`pr`; mismos
  valores que `quarter` de T-03).
- Response 200:
```json
{"game_id": "2513425", "total": 562, "count": 14,
 "filters": {"player": 1043, "type": ["tiro"], "period": ["3"]},
 "type_groups": [{"key": "tiro", "count": 131}, {"key": "rebote", "count": 88}],
 "events": [
   {"action_number": 301, "period": 3, "period_type": "REGULAR", "period_label": "3C", "clock": "07:32",
    "elapsed": 1348, "team_code": "CNF", "player_id": 1043, "player": "A. Varela",
    "action_type": "3pt", "sub_type": "jumpshot", "type_group": "tiro", "success": 1,
    "qualifiers": ["fromturnover"], "previous_action": null,
    "score": {"home": 51, "away": 47}, "margin_home": 4}
 ]}
```
- Errores: 404 `no_encontrado` ("Partido no encontrado"); 404 `sin_pbp` ("Partido sin play-by-play. Reimportá el partido.");
  400 `parametro_invalido` ("Tipo de evento inválido: xyz" / "Período inválido" / "Jugador inválido").

### 3.3 `GET /api/game/<game_id>/matchups` NUEVO
- Parámetros: `level` ∈ `quinteto` (default) | `jugador` | `jugador_quinteto`; `side` ∈ `home|away` (solo
  `jugador_quinteto`: qué equipo aporta el jugador; default `home`; `away` = sentido inverso).
- Response 200 = payload §7.6 de la tabla `matchups_<level>` con `game=<game_id>` (ver §8.3). Además
  `"matrix": {"rows": [ids propios], "cols": [ids rivales], "cells": {"<row>|<col>": {"net_rating_adj": 0.08, "possessions": 12.4, "level": "media"}}}`
  solo para `quinteto` (vista matricial; cruces sin coincidencia ausentes → "Sin datos").
- Errores: 404 `no_encontrado`; 404 `sin_pbp` ("Partido sin play-by-play: no se pueden calcular los cruces."); 400
  `parametro_invalido` ("Nivel inválido").

### 3.4 `GET /api/game/<game_id>/shots` NUEVO — PROPUESTA (no está en 00-arquitectura-transversal.md)
- Parámetros: `team` (team_code; obligatorio), `player` (player_id), `quarter` (CSV `1..4`,`pr`), `clock` (CSV
  `temprano`,`medio`,`tardio`), `zone` (clave de zona de `shot_zones.ZONE_KEYS_11` o de 3 zonas).
- Response 200:
```json
{"game_id": "2513425", "team_code": "CNF", "has_coordinates": true, "mode": 11,
 "filters": {"quarter": ["2"], "clock": ["tardio"], "zone": null, "player": null},
 "zones": {"paint_restricted": {"made": 3, "attempts": 5, "fg_pct": 0.6, "efg_pct": 0.6, "ppt": 1.2, "share": 0.25,
                                "percentile": null, "pct_reason": "contexto_no_comparable",
                                "sample": {"level": "baja", "unit": "intentos", "n": 5, "min": 10, "high": 30, "ranked": false}}},
 "summary": {"attempts": 20, "made": 9, "efg_pct": 0.5, "ppt": 1.05, "no_band": 3, "reset14": 2},
 "shots": [{"action_number": 212, "player_id": 1043, "player": "A. Varela", "period": 2, "clock": "01:12",
            "zone": "above_break_3", "band": "tardio", "shot_clock_start": 24, "made": 0, "pts": 0,
            "court_x": 71.2, "court_y": 18.3}]}
```
- `zones` usa exactamente el shape de `GET /api/shot-zones` (C-03) para que `shotChart()` lo consuma sin cambios.
- Errores: 404 `no_encontrado`; 400 `parametro_invalido` (equipo que no jugó el partido: "El equipo no jugó este partido";
  zona/tramo/cuarto inválido). Si `clock` se pide y el partido no tiene pbp → 200 con `zones` vacías y
  `summary.no_band = attempts`, más `"ignored": [{"param": "clock", "reason": "sin_pbp"}]`.

### 3.5 Tablas T-06 y entidad `matchup`
- `GET /api/table/game_players?game=<id>[&base=…]` (PROPUESTA de id), `GET /api/table/game_lineups?game=<id>&team=<code>`
  (PROPUESTA de id), `GET /api/table/matchups_quinteto?game=<id>` · `matchups_jugador?game=<id>` ·
  `matchups_jugador_quinteto?game=<id>&side=home|away` (ids de Arquitectura §6). Los builders `matchups_*` aceptan
  alternativamente `team=<code>&rival=<code>` (+ contexto T-03) para F-03 (`team_matchups`).
- `GET /api/metrics/matchup?id=<row_id>&game=<game_id>` o `&team=…&rival=…` (+ contexto) → §7.3.
  Formato de `row_id` (PROPUESTA, extiende la convención de quinteto de Arquitectura §3.12):
  `quinteto`: `CNF:12-15-18-21-30|PEN:3-4-7-9-11`; `jugador`: `CNF:12|PEN:7`; `jugador_quinteto`: `CNF:12|PEN:3-4-7-9-11`
  (el primer segmento es siempre el lado "propio" de la fila).

### 3.6 Configuración
| Clave | Tipo | Default | Rango | Sección S9 | Consumidor | Agrega |
|---|---|---|---|---|---|---|
| `game.run_min_points` | int (pts) | 8 | 4–20 | Reglas de contexto | F-07, F-01, F-02 | F-07 — PROPUESTA (no está en 00-arquitectura-transversal.md) |

Consumidas (existentes): `sample.matchup.min` (8), `sample.matchup.high` (25), `regression.matchup.k` (25),
`sample.lineup.min/high/rel_pct`, `regression.lineup.k`, `sample.ppp_sd`, `sample.band_z`, `sample.clock_zone.min/high`.

## 4. Backend — lógica

### 4.1 `game_analysis.py` (NUEVO, dueño F-07; firmas públicas de Arquitectura §4)

**Constantes**: `PERIOD_TYPES`, `PERIOD_LEN` importadas de `lineups.py` (corregidas por F-11: `{"REGULAR": 600, "OVERTIME": 300}`).
`TYPE_GROUPS = {"tiro": {"2pt","3pt"}, "tiro_libre": {"freethrow"}, "rebote": {"rebound"}, "asistencia": {"assist"},
"perdida": {"turnover"}, "robo": {"steal"}, "tapon": {"block"}, "falta": {"foul","foulon"}, "cambio": {"substitution"},
"tiempo_muerto": {"timeout"}, "otro": {"period","game","jumpball","headcoachchallenge"}}` (tipo desconocido → `otro`).

**`elapsed_secs(period: int, period_type: str, clock_secs: int) -> int`** (helper público, lo reutilizan F-01/F-02):
- `REGULAR`: `(period − 1)·600 + (600 − clock)`; `OVERTIME`: `2400 + (period − 1)·300 + (300 − clock)` (period reiniciado en 1
  en prórroga, D-09). `clock` nulo → `None`.

**`period_key(period, period_type) -> str`**: `"1".."4"` o `"pr"+n`; etiqueta `"1C".."4C"`, `"PR1"`.

**`game_detail(game_id: str) -> dict`** — `cache.memo("game", (game_id,), …)`:
1. `g = repository` fila de `games` (404 si no existe). `comp = competitions` label por `g.competition_id`.
2. `tgs = team_game_stats` del partido (home/away por `is_home`); `pgs = player_game_stats` (con `player_id`);
   `events = repository.game_events(game_id)`; `has_pbp = bool(events)`; `has_coords` = algún `shots.court_x` no nulo;
   `needs_reprocess` = `team_game_stats.ingest_version` nulo o `< ingest.INGEST_VERSION`; `overtimes = max(0, (g.minutes − 40)/5)`
   (si `minutes` nulo: contar `period_type == "OVERTIME"` distintos en pbp).
3. **Box oficial**: por equipo, copiar los conteos de `team_game_stats` (columnas F-11 pueden ser `NULL` → se devuelven `null`
   con `null_reasons[col] = "no_registrado"`).
4. **Estándar de equipo**: `StatBundle(entity_type="team", entity_id=code, own=RAW_KEYS de tgs, opp=RAW_KEYS del rival,
   games=1, minutes=g.minutes o 40+5·PR, seconds=minutes·60, shots=conteo de zonas del partido)` →
   `compute_standard` → `metrics_catalog.standard_payload(bundle, values, context_echo=ctx_partido, base="total",
   sample=None)`. `ctx_partido` = eco §7.5 con `label = "Partido {fecha} · {local} vs {visitante}"`, `games_used = 1`.
   Sin fichas T-01 (percentil `null`, `pct_reason: "contexto_no_comparable"`).
5. **Jugadores**: `tables.build_table("game_players", {"game": game_id, "base": base})` (§4.3).
6. **Parciales**: `period_partials(game_id, events, tgs)` (abajo).
7. **Línea de tiempo**: `score_timeline(game_id)` si `has_pbp`.
8. **Quintetos**: `tables.build_table("game_lineups", {"game": game_id, "team": code})` por equipo si `has_pbp`.
9. **Conciliación**: `reconcile_game(g, tgs, pgs, partials, timeline)`.

**`period_partials(game_id, events, tgs) -> tuple[list[dict], str | None]`**:
- Fuente 1 (`oficial`): `tgs.period_pts` (JSON lista, REGULAR y luego prórrogas) de ambos equipos.
- Fuente 2 (`pbp`): último `s1`/`s2` de cada período (orden `action_number`) menos el del período anterior.
- Ratings: por período `p`, `evs_p = [e for e in events if period_key(e) == p]`; `own = lineups._agg(evs_p, home)` y
  `opp = lineups._agg(evs_p, away)` extendidos con `pf` (`foul`), `fouls_drawn` (`foulon`) y `blk_received` (`block` cuyo
  `previous_action` es tiro del equipo, col-v2); `StatBundle(entity_type="period", seconds=PERIOD_LEN[pt], games=1)` →
  `compute_standard` → se extraen `possessions, oer, der, net_rating, pace, efg_pct, ts_pct, to_pct, or_pct, ft_rate`
  (el resto del conjunto queda disponible vía `/api/metrics/period` de F-04).
- Sin pbp: ratings `{value: null, reason: "sin_pbp"}`.

**`score_timeline(game_id: str) -> dict`** (firma de Arquitectura §4):
```
events ← repository.game_events(game_id); si vacío → None
home, away ← códigos; min_run ← config.get("game.run_min_points")
prev ← (0, 0); points ← []; timeouts ← []; runs ← []; run ← None
para cada ev en orden de action_number:
    t ← elapsed_secs(ev.period, ev.period_type, ev.clock_secs)
    si ev.action_type == "timeout": timeouts.append({t, period_label, clock, team_code})
    cur ← (ev.s1, ev.s2) si ambos no nulos, si no prev
    si cur ≠ prev:
        d_home, d_away ← cur − prev          # s1 = local (primer equipo de tm), s2 = visitante
        scorer ← home si d_home > 0 si no away   # (nunca ambos en un mismo evento)
        points.append({t, period_label, clock, home: cur[0], away: cur[1], margin: cur[0]−cur[1], team: scorer, action_number})
        si run y run.team == scorer: run.pts += d; run.end ← (t, cur)
        si no: cerrar run (si run.pts ≥ min_run → runs.append); run ← {team: scorer, pts: d, start: (t_prev_point, prev), end: (t, cur)}
        prev ← cur
cerrar run final
lead_changes ← cambios de signo estricto de margin (ignorando 0); ties ← veces que margin vuelve a 0 después del inicio
biggest_lead ← {home: max(margin, 0), away: max(−margin, 0)} con t
periods ← [{key, label, start_t}] desde elapsed de inicio de cada período presente
duration ← 2400 + 300·overtimes
```
- Racha: `start_t` = tiempo del último punto del rival (o 0), `end_t` = último punto de la racha; `from_score`/`to_score`.
- Robustez: `s1/s2` no monótonos (corrección de FIBA) → se toma el valor del evento (el marcador puede bajar); la racha se corta.
- Marcador final de la timeline = último `cur` (lo usa `reconcile_game`).

**`game_pbp(game_id: str, *, player_id: int | None, types: list[str] | None, period: str | None) -> list[dict]`** (firma de
Arquitectura §4; la ruta pasa `period` como CSV):
1. Validar `types ⊆ TYPE_GROUPS` y `period ⊆ {"1","2","3","4","pr"}` → `ValueError` → 400.
2. Mapear `player_name` → `player_id` con `identity.resolve_player_id(team, name, create=False)` (mapa por partido cacheado).
3. Filtrar en orden: período (`pr` = cualquier `OVERTIME`), grupo (`TYPE_GROUPS`), jugador (`player_id`).
4. Cada fila: shape §3.2; `score` = último `s1/s2` no nulo hasta ese evento (arrastrado); `qualifiers` = CSV → lista.
- La ruta arma `type_groups` (conteo sobre el partido sin filtro de tipo) y `total`.

**`game_shots(game_id: str, team_code: str, *, player_id=None, quarters=None, bands=None, zone=None) -> dict`** — PROPUESTA:
1. `shots` del partido y equipo (`shots.court_x/court_y`, `action_type`, `sub_type`, `period`, `action_number`, `made`).
2. Zona: `shot_zones.classify_zone(action_type, sub_type, court_x, court_y, qualifiers_del_evento_pbp)` (C-03); sin coordenadas →
   modo 3 zonas de C-03 (`has_coordinates = false`).
3. Tramo: índice `action_number → (band, shot_clock_start)` desde `possessions.game_possessions(game_id)` recorriendo
   `Possession.shots[]` (A-05 setea `band`); ausente o `None` → `band = None` (cuenta en `summary.no_band`).
4. Filtros AND: período (tiros `period` + `period_type` del evento pbp con igual `action_number`; `pr` = OVERTIME), banda (si
   hay filtro de banda, `band None` se excluye), jugador, zona (solo filtra la lista `shots`, no el mapa, para que el mapa
   siga mostrando el contexto de las demás zonas resaltando la elegida).
5. `zones = shot_zones.zone_table(filtrados)`; por zona `percentile = None`, `pct_reason = "contexto_no_comparable"`,
   `sample = sample.sample_level("clock_zone", n=attempts, unit="intentos")` (umbral de zona T-02).
6. `summary`: intentos, convertidos, `efg_pct`, `ppt` (fórmulas §2.2 vía `stats_engine`), `no_band`, `reset14` (tiros con
   `shot_clock_start == 14`).

**`reconcile_game(g, tgs, pgs, partials, timeline) -> dict`**:
- `score_final`: `tgs[home].pts == g.home_score` y `tgs[away].pts == g.away_score`.
- `players_sum`: para cada conteo `c ∈ {pts, fgm2, fga2, fgm3, fga3, ftm, fta, ast, stl, blk, pf}`: `Σ pgs[c] == tgs[c]`;
  para `orb`, `drb`: `Σ pgs + team_orb/team_drb` (si la columna es `NULL`, check `no_disponible` para ese conteo); `tov`:
  `Σ pgs.tov + team_tov`. `diffs = {c: {"players": x, "team": y}}` de los que no cuadran.
- `period_sum`: `Σ partials[].home == tgs[home].pts` (ídem away) si hay parciales.
- `timeline_final`: último punto de la timeline == marcador final (si hay pbp).
- `ok = all(check.ok for check in checks if check.ok is not None)`. Nunca modifica valores.

### 4.2 `matchups.py` (NUEVO, dueño F-07; firmas de Arquitectura §3.10)

**`_game_segments(game_id) -> list[dict]`**: `events = repository.game_events(game_id)`; `starters` por equipo con
`lineups.game_starters(player_rows, code)` mapeados a `player_id`; `lineups.build_segments_both(events, (home, away), starters)`
(A-01) → tramos `{on_court: {code: frozenset(player_id)}, events, seconds}`. Si algún equipo no tiene 5 titulares → partido
excluido con razón `sin_pbp` (motivo detallado `titulares_incompletos` en `details`). Cacheado `cache.memo("matchups:game", (game_id,))`.

**`_side_counts(evs, code) -> dict`**: conteos `RAW_KEYS` desde eventos (`lineups._agg` + `pf`, `fouls_drawn`,
`blk_received`), `pts` incluidos.

**`_player_counts(evs, player_id) -> dict`**: PTS, T2c/T2i, T3c/T3i, TLc/TLi, RO, RD, AS, PER del jugador en esos eventos.

**`game_matchups(game_id: str, level: str) -> list[dict]`**:
```
segs ← _game_segments(game_id)
acc ← {}                                     # clave de cruce → {evs, seconds, games:{gid: poss}}
para cada seg en segs:
    A ← seg.on_court[home]; B ← seg.on_court[away]
    claves ← según level:
        quinteto:          [(home, A, away, B)] si |A| == |B| == 5
        jugador:           [(home, {a}, away, {b}) para a en A, b en B]
        jugador_quinteto:  side=home → [(home, {a}, away, B) para a en A]; side=away → [(away, {b}, home, A) para b en B]
    para cada clave: acc[clave].evs += seg.events; acc[clave].seconds += seg.seconds
filas ← []
para cada (clave, v):
    own ← _side_counts(v.evs, lado_propio); opp ← _side_counts(v.evs, lado_rival)
    bundle ← StatBundle(entity_type="matchup", entity_id=row_id(clave), own, opp, games=1,
                        seconds=v.seconds, minutes=v.seconds/60)
    values ← compute_standard(bundle)
    pos ← values.possessions.value; pos_opp ← posesiones del rival (fórmula glosario sobre opp)
    badge ← sample.sample_level("matchup", n=pos, unit="posesiones", possessions=pos, minutes=v.seconds/60, games=1)
    prior ← PPP pooled de la competencia del partido (population.league_reference / §2.1)
    adj ← {oer: sample.adjusted(oer, pos, prior, "matchup"), der: sample.adjusted(der, pos_opp, prior, "matchup")}
          net_adj ← oer_adj − der_adj; banda Net ← sample.band(...) (fórmula §3.7)
    extra (level jugador): player_a ← _player_counts(v.evs, a); player_b ← _player_counts(v.evs, b);
                           plus_minus ← own.pts − opp.pts
    filas.append({bundle, values, badge, adj, extra, games: [{game_id, possessions: pos}]})
```
- Posesiones: fórmula del glosario sobre los conteos del tramo (`T2i + T3i − RO + PER + 0,44·TLi`), igual que quintetos
  (Arquitectura §2.1). Se reporta `possessions` (propias) y `opp_possessions`.
- Invariante verificable (CA-8): para `quinteto`, `Σ filas.seconds` = segundos con 5 vs 5 reconstruidos; `Σ own POS` =
  POS del equipo por segmentos (partición exacta porque cada segmento pertenece a un solo cruce).
- Cruces que nunca coincidieron: no generan fila (la matriz los muestra "Sin datos", razón `sin_enfrentamientos`).

**`team_matchups(team_code, rival_code, comp_id, ctx, level) -> list[dict]`** (lo consume F-03): mismo algoritmo acumulando
sobre todos los partidos entre ambos equipos de `repository.competition_games(comp_id)` filtrados por `context.filter_games`
(los filtros de nivel evento de T-03 se aplican con `context.event_predicate` sobre `seg.events`); `games` acumula
`{game_id, possessions}` por partido para el historial por celda. Partidos sin pbp → `games_excluded.sin_pbp`. Cache
`cache.memo("matchups:team", (team_code, rival_code, comp_id, context_key(ctx), level))`.

**`load_matchup_bundles(req: EntityRequest) -> list[StatBundle]`**: parsea `req.entity_id` (formato §3.5), recalcula vía
`game_matchups`/`team_matchups` y devuelve el bundle de esa fila; registrado con
`metrics_catalog.register_entity("matchup", load_matchup_bundles)`.

**Builders T-06** (`tables.register_table`):
- `matchups_quinteto` / `matchups_jugador` / `matchups_jugador_quinteto`: `entity_type="matchup"`, `builder` → filas desde
  `game_matchups` (param `game`) o `team_matchups` (params `team`, `rival` + contexto), `default_columns = ["_name", "_rival",
  "_sample", "minutes", "possessions", "pts", "pts_against", "net_rating", "efg_pct", "opp_efg_pct", "ts_pct", "opp_ts_pct",
  "to_pct", "or_pct"]`; nivel jugador agrega `plus_minus` y columnas `_a_pts`, `_a_fg`, `_b_pts`, `_b_fg` (texto
  "T2 3/5 · T3 1/4 · TL 2/2"). `default_sort = {"key": "net_rating", "dir": "desc", "use_adjusted": true}`. Filas con
  `level == "baja"` llevan `sample.ranked = false` (T-06 las pinta en gris; el orden recomendado las deja al final).
  `link` de fila: `#/partido/<game_id>/analizar?block=cruces&row=<row_id>` (con `game`) o el primer partido del historial.

### 4.3 Tablas del partido (en `game_analysis.py`) — ids PROPUESTA
- `game_players`: `entity_type="player"`; una fila por `player_game_stats` del partido; `StatBundle(entity_type="player",
  own = conteos del box del jugador, team = conteos del equipo, games = 1 si `played(minutes)` si no 0, minutes =
  `_parse_minutes`, team_minutes = minutos de partido·5, on_court = tramos del jugador en ese partido desde
  `lineups.build_segments` (o estimado por minutos con `estimated: true` sin pbp))` → `compute_standard` + `apply_base(base)`.
  DNP: todas las tasas `null` con razón `dnp`; `games = 0`. Columnas fijas: `_name`, `_team`, `_jersey`, `_starter`
  (titular ✓). `totals` = fila por equipo (suma de conteos; tasas desde el total). Sin `competition_avg` (partido único →
  `null`).
- `game_lineups`: `entity_type="lineup"`; tramos 5-jugadores del equipo en el partido agregados por `on_court` (misma lógica
  que `lineups.all_lineups` de F-06 restringida a un `game_id`); badge `sample_level("lineup", …)` con `team_poss` = posesiones
  del equipo en el partido; `adj` con `regression.lineup.k`.

### 4.4 Rutas (`app.py`, finas)
```
@app.route("/api/game/<game_id>")            → game_analysis.game_detail(game_id) + base (tables) ; KeyError → 404
@app.route("/api/game/<game_id>/pbp")        → parse args → game_analysis.game_pbp(...) ; ValueError → 400 ; sin eventos → 404 sin_pbp
@app.route("/api/game/<game_id>/matchups")   → level/side → tables.build_table("matchups_"+level, {"game": id, "side": side}) + matrix
@app.route("/api/game/<game_id>/shots")      → game_analysis.game_shots(...)
```
Mensajes de error centralizados en español (§9).

### 4.5 Caché y rendimiento
- Namespaces (PROPUESTA de nombres, Arquitectura §3.14 fija solo algunos): `game` (detalle), `matchups:game`, `matchups:team`.
  Claves prefijadas por `data_version`/`config_version` → cambiar `game.run_min_points` invalida la timeline.
- Objetivo: `GET /api/game/<id>` < 1,5 s en frío con un partido de ~550 eventos (A-01 ~5 ms/partido; `compute_standard` por
  ~25 jugadores + ~20 quintetos). Medir y registrar en `progress.md`.

## 5. Frontend — capa API (`api.js`)
```
game:         (id, params)        => apiFetch(`/api/game/${enc(id)}${qs(params)}`)            // {base}
gamePbp:      (id, params)        => apiFetch(`/api/game/${enc(id)}/pbp${qs(params)}`)        // {player, type, period}
gameMatchups: (id, params)        => apiFetch(`/api/game/${enc(id)}/matchups${qs(params)}`)   // {level, side}
gameShots:    (id, params)        => apiFetch(`/api/game/${enc(id)}/shots${qs(params)}`)      // {team, player, quarter, clock, zone}
```
`qs()` de T-05 (omite vacíos). Las tablas usan `api.table(tableId, params)` (T-06) y la entidad `api.metrics("matchup", {id, game})`.

## 6. Frontend — UI

**Ubicación.** S5 Partido (`views/partido.js`, creada por X-01 con la sección deshabilitada). F-07 la habilita:
`registerSection({slug: "partido", label: t("nav.partido", "Partido"), icon: "match", priority: 2, enabled: true})` y
`registerTab("partido", {slug: "analizar", label: t("partido.tabs.analizar", "Analizar"), enabled: true, render})`. Ruta
`#/partido/<game_id>/analizar[?block=<bloque>&row=<id>]`. Sin `game_id` → lista breve de últimos partidos (reusa
`api.games()`) para elegir.

**Componente `components/game-view.js`** (Arquitectura §8, dueño F-07):
```
renderGameView(el, payload, {mode = "analizar", blocks = ALL_BLOCKS, onNavigate}) -> {update(payload), destroy()}
ALL_BLOCKS = ["header", "checks", "resumen", "box", "tiros", "jugadas", "quintetos", "cruces"]
```
- `mode: "vivo"` (para F-01): oculta `checks` y exportes XLSX, muestra `payload.status` en el encabezado y permite
  `update()` incremental sin re-montar (los bloques guardan su estado de filtros). F-02/F-03 usan sub-bloques exportados
  (`gvTimeline`, `gvMatchups`) directamente.
- Pestañas internas con `components/tabs.js`: Resumen (parciales + ratings + línea de tiempo + estándar de equipos lado a
  lado) · Box (tabla `game_players` con `createDataTable`, filtro de equipo con chips Local/Visitante, `base-selector.js` de
  T-04) · Tiros (dos mapas, uno por equipo, con `shotChart(zones, {mode, colorBy: "none"})` + `bindZoneTooltips`, chips de
  Cuarto [1 2 3 4 PR] y Tramo [Temprano · Medio · Tardío], select de jugador, lista de tiros de la zona elegida; cada cambio
  llama `api.gameShots`) · Jugadas (select de jugador agrupado por equipo, chips de tipo multi-selección, chips de período,
  contador, lista virtualizada simple por páginas de 100; tipos traducidos con `t("pbp.type.<action_type>.<sub_type>")`) ·
  Quintetos (`createDataTable` con payloads `lineups.home/away`) · Cruces (selector de nivel con `tabs.js`, para
  `jugador_quinteto` toggle "Mis jugadores vs sus quintetos / Sus jugadores vs mis quintetos"; tabla `createDataTable`;
  para `quinteto` además vista "Matriz" (sin color por percentil, porque en un partido no hay población): cada celda muestra
  el Net ajustado con signo, fondo gris si la muestra es baja y "Sin datos" si no hubo cruce; leyenda de coincidencia en cancha).
- Estados: loading/vacío/error/offline con el copy de spec §6; nulos con `nullDisplay(reason)`; números con `fmtMetric`.
- Exportación: `exportMenu` en cada tabla (`getData` desde `createDataTable.getState()`; `meta` §7.7 con `entity:
  {type: "game", id, name: "Nacional 84 – 79 Peñarol"}`, `filters` de la pestaña); botón "Informe de scouting" → construye
  un contenedor oculto `gvScoutingReport(payload)` (encabezado, estándar resumido de ambos equipos —grupos producción,
  tiro_pct, balon, rebote—, parciales, timeline como `<img>` del canvas, mapas SVG, top 8 jugadores por `pts` con eFG%/TS%,
  top 5 cruces quinteto por posesiones) y llama `printNode(node, {pageSize: "A4"})`.
- Línea de tiempo: `drawScoreTimeline(canvas, payload.timeline, {homeName, awayName})` en `charts.js`: línea de margen
  (local positivo arriba), relleno por signo con los colores de equipo del tema, líneas verticales por período, triángulos
  en tiempos muertos (tooltip "Tiempo muerto {equipo} · {período} {reloj}"), bandas sombreadas en rachas; debajo, lista de
  rachas y los tres datos (cambios de liderazgo, empates, máxima ventaja).
- Aviso de conciliación (`checks.ok == false`) arriba de las pestañas con enlace a `#/datos/calidad`.

**Enlaces de entrada (RF-2):** `views/datos.js` (pestaña `partidos`): click en fila (fuera del modo selección) →
`navigate("partido", {id: game_id, tab: "analizar"})`; `views/equipo.js`/`views/jugador.js` (`gamelog`): celda de fecha/rival
como enlace `#/partido/<game_id>/analizar`.

**Mobile 768 px:** pestañas internas con scroll horizontal; mapas uno debajo del otro con selector Local/Visitante; tablas con
columna fija (T-06); chips en una fila con scroll; el informe de scouting mantiene A4 (CSS de impresión independiente del
viewport).

## 7. Navegación
- Habilita S5 en el registro de X-01 (en móvil entra en la barra por prioridad S5 = 2.ª, DA-23).
- Rutas: `#/partido/<game_id>/analizar`, con `block` ∈ `resumen|box|tiros|jugadas|quintetos|cruces` y `row` opcional (enlaces
  desde F-03 y desde filas de cruces). Actualizar el mapa de vistas de `docs/frontend.md`.

## 8. Contratos de datos
### 8.1 `game`, `box`, `standard`, `partials` — ver §3.1.
### 8.2 `timeline`
```json
{"duration": 2700, "periods": [{"key": "1", "label": "1C", "start_t": 0}, {"key": "pr1", "label": "PR1", "start_t": 2400}],
 "points": [{"t": 14, "period_label": "1C", "clock": "09:46", "home": 2, "away": 0, "margin": 2, "team": "CNF", "action_number": 5}],
 "timeouts": [{"t": 1480, "period_label": "3C", "clock": "05:20", "team_code": "PEN"}],
 "runs": [{"team_code": "CNF", "pts": 10, "start_t": 1320, "end_t": 1470, "from": {"home": 48, "away": 47}, "to": {"home": 58, "away": 47}, "period_label": "3C"}],
 "lead_changes": 7, "ties": 4,
 "biggest_lead": {"home": {"pts": 12, "t": 1600}, "away": {"pts": 6, "t": 700}},
 "final": {"home": 84, "away": 79}, "run_min_points": 8}
```
### 8.3 Fila de tabla `matchups_*` (payload §7.6)
```json
{"id": "CNF:12-15-18-21-30|PEN:3-4-7-9-11",
 "link": "#/partido/2513425/analizar?block=cruces&row=CNF:12-15-18-21-30|PEN:3-4-7-9-11",
 "values": ["Prieto · Oglivie · Feldeine · Canty · Rodríguez", "Pérez · … (PEN)", null, 6.4, 13.2, 15, 11, 0.301, 0.583, 0.458, 0.61, 0.52, 0.151, 0.333],
 "pct": [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
 "adj": {"oer": {"value": 1.07, "band": 0.49}, "der": {"value": 0.97, "band": 0.49}, "net_rating": {"value": 0.10, "band": 0.69}},
 "reasons": {}, "sample": {"level": "media", "n": 13.2, "unit": "posesiones", "min": 8, "high": 25, "ranked": true},
 "games": [{"game_id": "2513425", "possessions": 13.2}],
 "extra": null}
```
Nivel `jugador`: `extra = {"plus_minus": 4, "player_a": {"player_id": 1043, "pts": 7, "fgm2": 2, "fga2": 3, "fgm3": 1, "fga3": 2, "ftm": 0, "fta": 0, "orb": 0, "drb": 2, "ast": 1, "tov": 0}, "player_b": {...}}`.
`pct` siempre `null` en partido único (razón de tabla `contexto_no_comparable`); con `team`/`rival` (F-03) los percentiles
vienen de la población de emparejamientos de la competencia (T-01).

## 9. Manejo de errores y offline
| Código | Cuándo | Mensaje (UI) |
|---|---|---|
| 400 `parametro_invalido` | base, tipo, período, nivel, zona, tramo o equipo inválidos | "Filtro inválido: {detalle}." |
| 401 | sesión vencida | handler global de `api.js` (login) |
| 404 `no_encontrado` | `game_id` inexistente | "Partido no encontrado. Volvé al catálogo." |
| 404 `sin_pbp` | pbp/cruces sin eventos | estado vacío del bloque (no error de vista) |
| 500 | excepción | "No se pudo cargar el partido." + consola |
| red | offline | "Sin conexión: el análisis del partido necesita conexión." |
- El componente trata cada bloque de forma independiente: un 404 `sin_pbp` en jugadas no invalida box ni parciales.
- `sw.js`: subir `CACHE` (número asignado al integrar). Con la estrategia de runtime caching de X-01, `game-view.js` se cachea
  al primer uso; si X-01 no la implementó, agregar `/js/components/game-view.js` a `STATIC`.

## 10. Riesgos / decisiones
- **Piezas de otros dueños que se consumen tal cual**: `lineups.build_segments_both` y `PERIOD_LEN` corregido (A-01/F-11),
  `possessions.game_possessions` + `shots[].band` (A-01/A-05), `shot_zones.classify_zone/zone_table` y `shot-chart.js`
  (C-03), `compute_standard`/`standard_payload`/`register_entity` (T-05), `sample_level/adjusted/band` (T-02),
  `register_table`/`build_table`/`data-table.js`/`export-menu.js`/`exporters.js` (T-06), router/tabs/`views/partido.js`
  (X-01), `repository`/`cache`/`identity` (F-11/C-08).
- **PROPUESTAS (no están en 00-arquitectura-transversal.md)**: endpoint `GET /api/game/<game_id>/shots`; ids de tabla
  `game_players` y `game_lineups`; clave `game.run_min_points`; opción `colorBy: "none"` y `onZoneClick` en `shotChart`;
  formato de `row_id` de emparejamiento; parámetro `side` de `…/matchups`; namespaces de caché `game`, `matchups:game`,
  `matchups:team`; helper público `game_analysis.elapsed_secs`.
- **Desacuerdo menor con la arquitectura**: `game_analysis.game_pbp(..., period: str | None)` recibe un solo período; la spec
  pide filtros combinables y T-03 usa CSV en `quarter`. Se implementa aceptando CSV en el string (`"1,3"`) sin cambiar la
  firma; se sugiere tiparlo `list[str] | None`.
- **Racha vs "parciales"**: decisión de spec §9 (umbral configurable). Riesgo de discusión de producto: bajo.
- **Timeline con `s1/s2` nulos** en eventos no anotadores: se arrastra el último marcador; riesgo nulo.
- **Conciliación**: si FIBA manda un pbp con puntos que no cuadran con el box, la vista muestra el box y avisa (no "corrige").
- **Rendimiento**: los emparejamientos de un partido son baratos (~40 tramos); `team_matchups` de F-03 recorre todos los
  partidos entre ambos equipos (≤ 4 por temporada): trivial. El costo lo domina A-01 en frío.
- **Riesgo R-09 (PNG en iOS)**: el informe de scouting usa impresión (PDF), no PNG; el PNG queda para tablas.
- **Dependencias técnicas**:
  - X-01 → `core/router.js`, `components/tabs.js`, `views/partido.js` ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)).
  - T-05 → `StatBundle`, `compute_standard`, `apply_base`, `metrics_catalog.register_entity`, `standard_payload` ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)).
  - T-06 → `tables.register_table`, `build_table`, `components/data-table.js`, `export-menu.js`, `exporters.js` ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)).
  - T-02 → `sample.sample_level`, `adjusted`, `band`, `components/sample-badge.js` ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)).
  - C-03 → `shot_zones.py`, `components/shot-chart.js` ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)).
  - F-06 → lógica de agregación de quintetos (`lineups.all_lineups`) ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)).
  - A-01 → `lineups.build_segments_both`, `possessions.game_possessions` ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md)).
  - A-05 → `Possession.shots[].band`, `Chance.shot_clock_start` ([../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/plan.md](../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/plan.md)).
  - F-11 → `repository.game_events`, `cache.memo`, columnas `period_pts`, `team_orb/drb/tov`, `court_x/y`, `ingest_version` ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)).
  - F-13 → `config.get`, `CONFIG_SPEC` ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)).
- **Incrementos diferidos**: apertura desde el calendario de S8 → INCREMENTO DIFERIDO (→ F-12,
  [../../fase-5-analitica-exploracion/12-F-12-mi-equipo/](../../fase-5-analitica-exploracion/12-F-12-mi-equipo/spec.md));
  consumo de `matchups.stints` → A-11; sinergias → A-08.
- **Estimación: XL · 30–40 h** (backend `game_analysis` 8–10 h, `matchups` 7–9 h, rutas/tablas/entidad 3–4 h, componente
  y UI 9–12 h, timeline chart 2–3 h, verificación de 13 partidos + docs 3–4 h). Si se supera 40 h, partir en
  F-07a (partido: box, parciales, timeline, pbp, tiros) y F-07b (quintetos y coincidencia en cancha).
