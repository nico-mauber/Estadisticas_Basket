# Plan — A-01: Reconstrucción de la posesión

> **ID:** A-01 · **Prioridad:** P0 · **Fase y orden:** 3·01
> **Depende de:** T-05, F-11, C-11 (+ F-13, T-03, T-02, C-08 ya cerrados) · **Habilita:** A-02…A-07, A-11, F-01, F-02, F-07
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [Especificación v2 §5.1 · A-01](../../00-especificacion-cliente-v2.md) · Arquitectura §3.9, §3.10, §3.14, §3.8, §6, §9.2
> **Estimación:** XL · 28–40 h

## 1. Enfoque
Módulo dedicado `backend/possessions.py` (NUEVO, DA-37) que, por partido, recorre `pbp_events` en orden de `action_number` con un **reloj monótono por período** (misma técnica que `lineups.build_segments`, lección Feature 04 v3) y una **máquina de estados** de posesión/oportunidad/serie de tiros libres que aplica las cinco reglas del cliente. Cada posesión es un `Possession` (dataclass de arquitectura §3.9) con sus conteos por lado, quintetos de ambos equipos (vía `lineups.build_segments_both`, NUEVO) y marca de incompleta. El resultado se cachea en `cache.memo("poss:game", …)` (versionado por `data_version`/`config_version`), nunca se persiste. Encima: `team_possessions` (selección por equipo/competencia/contexto), `possessions_bundle` (posesiones → `StatBundle` → `stats_engine.compute_standard`), `reconcile` (contado vs fórmula por equipo-partido y equipo-competencia con diagnóstico) y `register_enricher` para A-02…A-05. Se registran el check `possession_gaps` (F-11), las claves `possessions_counted`/`off_poss_duration`/`player_poss_duration` (T-05/A-12) y el σ empírico + calibración por posesiones alternas (T-02). UI mínima de control en Datos → Calidad.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/possessions.py` | module NUEVO | `Chance`, `Possession`, `game_possessions`, `team_possessions`, `possessions_bundle`*, `reconcile`, `register_enricher`, `ppp_stats`*, `possession_gaps_check`*, helpers de máquina de estados | RF-1…RF-11, RF-14, RF-15, RF-16, RF-17 |
| `backend/lineups.py` | module (mod.) | `build_segments_both(events, codes, starters)` NUEVO reutilizando la lógica de `build_segments`; usa `PERIOD_LEN`/`PERIOD_TYPES` corregidos por F-11 | RF-9 |
| `backend/stats_engine.py` | module (mod.) | `StatBundle` + campos `poss_seconds`* y `finished_poss`*; `compute_standard` calcula `possessions_counted`, `off_poss_duration`, `player_poss_duration` | RF-15 |
| `backend/metrics_catalog.py` | module (mod.) | 3 `MetricDef` (grupo volumen/uso, `source="poss"`) | RF-15 |
| `backend/config.py` | module (mod.) | `CONFIG_SPEC` + `clock.reset_secs` | RF-4 |
| `backend/data_quality.py` | module (mod.) | recibe el registro de `possession_gaps` (se quita el placeholder `no_disponible` de F-11) | RF-13 |
| `backend/sample.py` | module (mod.) | `band()` usa `possessions.ppp_stats().sd` si hay posesiones; `calibrate_k(..., method="posesiones_alternas")` | RF-16 |
| loaders de tipos de entidad (`team`, `lineup`, `split`; ubicación según plan de T-05/T-03) | module (mod.) | rama `context.level(ctx) == "posesion"` → `possessions.possessions_bundle` | RF-14 |
| `backend/app.py` | route (mod.) | `GET /api/game/<game_id>/possessions`, `GET /api/possessions/reconcile`; `import possessions` (registra enganches y check) | RF-12 |
| `frontend/js/api.js` | js-api (mod.) | `api.gamePossessions(gameId, params)`, `api.possessionsReconcile(params)` | RF-12 |
| `frontend/js/views/datos.js` | js-view (mod.) | tarjeta "Conciliación de posesiones" + hoja de inspección dentro de la pestaña `calidad` | RF-10, RF-12, RF-13 |
| `frontend/css/style.css` | css (mod.) | sección `/* ── posesiones (A-01) ── */`: tabla de inspección, fila incompleta, alerta de diferencia | RF-10 |
| `frontend/sw.js` | sw (mod.) | subir `CACHE` al siguiente entero al integrar (si X-01 mantiene versionado; sin archivo estático nuevo) | — |
| `docs/metrics.md` | doc | §Posesiones reconstruidas: reglas, reloj derivado (fuente derivada, resolución 1 s), `possessions_counted`, `off_poss_duration`, `player_poss_duration`, conciliación | cierre |
| `docs/api.md` | doc | 2 endpoints nuevos; check `possession_gaps` en `/api/data-quality` | cierre |
| `docs/architecture.md` | doc | módulo `possessions.py`, `build_segments_both`, caché `poss:game` | cierre |
| `docs/frontend.md` | doc | copy nuevo de Calidad (posesiones) | cierre |

`*` = PROPUESTA (no está en 00-arquitectura-transversal.md), ver §10.

## 3. Backend — rutas y modelos

**Sin cambios de esquema** (arquitectura §5): posesiones on-the-fly.

### GET `/api/game/<game_id>/possessions` — NUEVO · `login_required`
- Query: `team=<code>` (opcional, filtra por equipo atacante), `detail=1` (opcional, agrega `event_numbers` de cada posesión).
- Response 200:
```json
{
  "game_id": "2849328",
  "teams": {"home": "CNF", "away": "PEN"},
  "possessions": [
    {"poss_id": 1, "team": "CNF", "opp": "PEN", "period": 1, "period_type": "REGULAR",
     "start_clock": 600, "end_clock": 583, "duration": 17,
     "start_event": 4, "end_event": 11,
     "origin": null, "ptype": null,
     "chances": [
       {"n": 1, "start_event": 4, "start_clock": 600, "shot_clock_start": 24, "end_event": 9, "end_type": "t2f", "pts": 0, "outcome": null},
       {"n": 2, "start_event": 10, "start_clock": 586, "shot_clock_start": 14, "end_event": 11, "end_type": "t2c", "pts": 2, "outcome": null}
     ],
     "shots": [
       {"action_number": 9, "elapsed": 12, "band": null, "zone": "mid_left_close", "made": false, "pts": 0, "player_id": 41},
       {"action_number": 11, "elapsed": 3, "band": null, "zone": "restricted_area", "made": true, "pts": 2, "player_id": 44}
     ],
     "end_type": "t2c", "pts": 2,
     "own_on_court": [12, 15, 18, 21, 41], "opp_on_court": [101, 104, 107, 110, 113],
     "lineup_changed": false,
     "finisher_id": 44, "assister_id": 12, "turnover_by_id": null,
     "incomplete": false, "incomplete_reason": null}
  ],
  "outside_points": {"CNF": 0, "PEN": 1},
  "reconcile": {
    "CNF": {"counted": 78, "incomplete": 0, "period_end_empty": 2, "formula_pbp": 77.52, "formula_box": 77.52,
            "diff_pct": 0.62, "pts_poss": 81, "pts_outside": 0, "pts_box": 81, "pts_ok": true},
    "PEN": {"counted": 79, "incomplete": 1, "period_end_empty": 1, "formula_pbp": 78.28, "formula_box": 78.28,
            "diff_pct": 0.92, "pts_poss": 75, "pts_outside": 1, "pts_box": 76, "pts_ok": true}
  },
  "anomalies": [{"action_number": 233, "kind": "rebote_inconsistente", "detail": "rebote defensivo del equipo atacante"}]
}
```
- Errores: 404 `{"error": "Partido no encontrado.", "code": "no_encontrado"}`; 404 `{"error": "Este partido no tiene play-by-play.", "code": "sin_pbp"}`; 400 `{"error": "Equipo inválido para este partido.", "code": "parametro_invalido"}`.

### GET `/api/possessions/reconcile` — NUEVO · `login_required`
- Query: `competition` (§3.1; `all` → 400, la conciliación es por universo).
- Response 200:
```json
{
  "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "teams": [
    {"team_code": "CNF", "team_name": "Nacional", "games": 3, "counted": 231, "incomplete": 1,
     "period_end_empty": 5, "formula": 229.84, "formula_box": 229.84, "diff_pct": 0.5, "within_2pct": true}
  ],
  "totals": {"counted": 2116, "formula": 2104.8, "diff_pct": 0.53, "incomplete": 7, "incomplete_pct": 0.33},
  "games_over_5pct": [
    {"game_id": "2849340", "date": "2025-10-12", "team_code": "TRO", "counted": 80, "formula": 75.9,
     "diff_pct": 5.4, "incomplete": 2, "reasons": {"cambio_sin_cierre": 2}, "period_end_empty": 3}
  ],
  "games_excluded": {"sin_pbp": 0},
  "max_diff_pct": 2.0
}
```
`teams[].formula` = fórmula del glosario sobre conteos del pbp (§9 spec); `formula_box` = misma fórmula sobre `team_game_stats`. `diff_pct = 100·(counted − formula)/formula` (null si `formula == 0`, razón `sin_intentos`).
- Errores: 400 `competencia_inexistente` "La competencia no existe."; 400 `parametro_invalido` "Elegí una competencia para conciliar."

### GET `/api/data-quality` (F-11, mod. por registro)
Check `possession_gaps`: `{"status": "ok" | "alerta", "count": 7, "pct": 0.33, "items": [{"game_id", "date", "label", "incomplete", "reasons": {...}, "diff_pct": {"CNF": 0.6, "PEN": 0.9}}]}`. `alerta` si `pct > 1` o hay algún equipo con |dif| > 2 % o algún equipo-partido > 5 %.

### GET `/api/metrics/<entity_type>` / bloque `standard` (T-05)
Sin cambio de contrato: aparecen `possessions_counted`, `off_poss_duration` (team, lineup, onoff, clutch, split, period) y `player_poss_duration` (player) en sus grupos.

### Configuración
`clock.reset_secs` — int · default 14 · rango 10–24 · sección "Reglas de contexto" · consumidores A-01, A-05 · dueño A-01 (arquitectura §3.2).

## 4. Backend — lógica

### 4.1 `lineups.build_segments_both(events, codes: tuple[str, str], starters: dict[str, set]) -> list[dict]` (NUEVO)
- Entradas: eventos del partido ordenados por `action_number`; `codes = (home, away)`; `starters = {code: set(nombres)}` (de `game_starters`; si un equipo no tiene 5 titulares, su entrada es `None`).
- Algoritmo: igual a `build_segments` pero con `on_court = {code: set}` por equipo; un evento `substitution` de cualquiera de los dos equipos actualiza el set de ese equipo; un tramo nuevo se abre al llegar un evento de juego con `frozenset` distinto en **cualquiera** de los dos lados (fusión de cambios simultáneos); segundos con el mismo piso monótono y volcado de cola por período usando `PERIOD_LEN[period_type]` (`OVERTIME` = 300).
- Salida: `[{"on_court": {code: frozenset | None}, "events": [...], "seconds": float, "first_index": int}]`. Además (uso interno de A-01) se expone `event_lineups(events, codes, starters) -> list[dict]` PROPUESTA: por índice de evento, el `on_court` vigente de ambos lados (evita recorrer segmentos por posesión).
- Invariante verificable: `Σ seconds == 600·4 + 300·prórrogas` (mismo gate que Feature 04 v3).

### 4.2 Pre-proceso por partido — `_prepare(game_id)` (interno)
1. `events = repository.game_events(game_id)` (dicts, orden `action_number`); `game = repository.competition_games(...)` fila del partido (códigos local/visitante); `rows = player_game_stats` del partido.
2. `name_to_id[(team_code, player_name)] = player_id` (C-08; los rebotes/pérdidas de equipo tienen `player_name == ""` → `None`).
3. Índice de período ordinal: `REGULAR p → p`, `OVERTIME p → 4 + p`; `plen = PERIOD_LEN[period_type]`.
4. **Reloj monótono**: por período, `mclock_i = min(floor, clock_secs_i)`, `floor` arranca en `plen` y solo baja. Todas las duraciones y `elapsed` usan `mclock` (un evento registrado tarde con reloj mayor queda en el piso: nunca produce duraciones negativas).
5. Parseo: `freethrow` `sub_type` "XofY" → `(x, y)` (si no parsea → anomalía `tl_sin_serie`, se trata como 1of1); `qualifiers` (CSV de F-11) → set; `previous_action` (F-11) → índice del evento vinculado.

### 4.3 Máquina de estados — `_build(game_id) -> (list[Possession], outside_points, anomalies)`
Estado: `cur: Possession | None`, `chance: Chance | None`, `last_end_clock`, `ft_series: {team, y, technical, retain, andone_poss} | None`, `pending_miss: {team, kind: "t2"|"t3"|"tl", action_number} | None`, `action_to_poss: dict[int, Possession]`.

```
open(team, ev):     poss_id += 1
                    start_clock = last_end_clock si mismo período, si no plen
                    cur = Possession(team, opp=otro, period, period_type, start_clock, start_event=ev.an,
                                     chances=[Chance(n=1, start_event=ev.an, start_clock=start_clock, shot_clock_start=24)],
                                     own_on_court/opp_on_court = event_lineups[ev] (ids), box={}, opp_box={}, ...)
close(ev, end_type, *, clock=None):
                    chance.end_event = cur.end_event = ev.an; chance.end_type = cur.end_type = end_type
                    cur.end_clock = clock ?? mclock(ev); cur.duration = max(0, start_clock − end_clock)
                    last_end_clock = cur.end_clock; append; cur = chance = pending_miss = None
gap(ev, reason):    cur.incomplete = True; cur.incomplete_reason = reason; close(ev_anterior, None); anomalies += …
ensure(team, ev):   si cur es None → open(team, ev)
                    si cur.team != team → gap(ev, "cambio_sin_cierre"); open(team, ev)
```
Por evento `ev` (tipo `at = action_type`, `T = team_code`):
- `period`/`start`: si `cur` abierto → `close(ev, "fin_periodo", clock=0)` (período anterior); `last_end_clock = plen`.
- `period`/`end`: si `cur` abierto → `close(ev, "fin_periodo", clock=0)`.
- `substitution`, `timeout`, `headcoachchallenge`, `game`: no cambian la posesión (quedan en la lista de eventos que reciben los enriquecedores; A-02 lee `timeout`).
- `jumpball` `startperiod`/`won`: no abre; la posesión la abre la primera acción ofensiva. `heldball`: marca `pending_change = True`; si la siguiente acción ofensiva es del otro equipo → `close(ev_heldball, "perdida")` con `turnover_by_id = None` y anomalía informativa `salto_cambio_posesion` (no es hueco).
- `2pt`/`3pt` por `T`: `ensure(T, ev)`; si `chance` tiene `pending_miss` del mismo equipo sin rebote (tapón fuera, rebote no registrado) se continúa en la misma oportunidad. Registrar tiro en `cur.shots` con `elapsed = chance.start_clock − mclock(ev)` (si < 0 o > `shot_clock_start` + 1 → `elapsed = None`, anomalía `reloj_no_derivable`), `zone` = `shot_zones.classify_zone(...)` sobre la fila de `shots` unida por `action_number` (C-03), `player_id`, `pts`. `box.fga2/fga3 += 1`.
  - Convertido: `box.fgm*`, `cur.pts += 2|3`, `finisher_id = player`. **Look-ahead and-one**: si entre los eventos siguientes con el mismo `mclock` hay `foul` del rival con calificador `shooting` y `1freethrow` (o, sin calificadores, `foulon` de `T` + `freethrow` "1of1" de `T`) → `ft_series = {team: T, y: 1, andone_poss: cur}` y **no** se cierra; si no → `close(ev, "t2c"|"t3c")`.
  - Errado: `pending_miss = {T, "t2"|"t3", an}`.
- `foul` (`sub_type`): `technical`, `benchTechnical`, `coachTechnical` → la próxima serie de TL del equipo contrario se marca `technical = True`; `unsportsmanlike`/`disqualifying` de la defensa → próxima serie `retain = True` (el atacante conserva: no se cierra tras el último TL); `offensive` → sin acción (la pérdida vinculada cierra). `opp_box.pf += 1` / `box.pf += 1` según lado.
- `foulon` de `T`: `box.fouls_drawn += 1` si `T == cur.team`.
- `freethrow` de `T` con `(x, y)`:
  - Serie técnica → puntos a `cur.pts` si `cur` y `cur.team == T`, si no a `outside_points[T]`; `box.fta/ftm` solo si suma a la posesión; nunca abre ni cierra.
  - Serie normal: si `cur` abierto y `cur.team != T`: si `pending_miss` del otro equipo → `close(ev_prev, pending_miss.kind + "f")` (el tiro errado del rival terminó su posesión: falta en el rebote) y `open(T, ev)`; si no → `gap(ev, "cambio_sin_cierre")` y `open(T, ev)`. Si no hay `cur` → `open(T, ev)`.
  - `box.fta += 1`; si convertido `box.ftm += 1`, `cur.pts += 1`, `finisher_id = player` (si no hay canasta previa en la posesión).
  - Si `x == y` (último de la serie): convertido y no `retain` → `close(ev, end_type)` con `end_type = shot end ("t2c"/"t3c")` si `andone_poss is cur`, si no `"falta"`; errado → `pending_miss = {T, "tl", an}`. `retain` → no cierra (la posesión sigue; reloj de la oportunidad no se reinicia, §10 R-5).
  - Rebote registrado entre TL no finales de la misma serie → ignorado (anomalía informativa `rebote_entre_tl`).
- `rebound` de `T` (`offensive`/`defensive`, calificador `team` incluido):
  - `defensive` y `cur` abierto y `cur.team != T` → `opp_box.drb += 1` en `cur`; `close(ev, pending_miss.kind + "f")` (`t2f`/`t3f`/`falta` si fue TL; si no hay `pending_miss` → `close(ev, "t2f")` + anomalía `rebote_sin_tiro`); `open(T, ev)` con `start_clock = mclock(ev)`.
  - `defensive` sin `cur` → `open(T, ev)`.
  - `offensive` y `cur.team == T` → `box.orb += 1`; cerrar la oportunidad vigente (`chance.end_type = pending_miss.kind + "f"`); abrir `Chance(n+1, start_event=an, start_clock=mclock(ev), shot_clock_start=config.get("clock.reset_secs"))`; `pending_miss = None`.
  - `defensive` y `cur.team == T` (dato inconsistente) → se trata como ofensivo + anomalía `rebote_inconsistente`. `offensive` de `T != cur.team` → `gap(ev, "cambio_sin_cierre")` y `open(T, ev)`.
- `turnover` de `T`: `ensure(T, ev)`; `box.tov += 1`; `turnover_by_id = player` (o `None` si de equipo); `close(ev, "perdida")`.
- `steal` de `T`: `opp_box.stl += 1` en la posesión de la pérdida vinculada (`previous_action`; sin vínculo → la última posesión cerrada del rival).
- `assist` de `T`: `box.ast += 1` y `assister_id` en la posesión del tiro vinculado (`previous_action` → `action_to_poss`); sin vínculo → la última posesión de `T`.
- `block` de `T`: `opp_box.blk += 1` y `box.blk_received += 1` en la posesión del tiro vinculado.
- Fin del partido: si `cur` abierto → `close(último, "fin_periodo", clock=0)`.

Post-proceso: (a) toda posesión con `end_type is None` y no incompleta → incompleta `sin_finalizacion`; (b) `cur.pts == Σ chance.pts` (verificación interna; si difiere, anomalía); (c) enriquecedores registrados, en orden de registro: `fn(possessions, events, meta)` con `meta = {game_id, codes, name_to_id, mclock, event_lineups}`; (d) congelar.

Incompleta → `origin = ptype = None`, `chances[].outcome = None`, `shots[].band = None` (los enriquecedores la saltean).

### 4.4 `game_possessions(game_id: str) -> list[Possession]` (arquitectura §3.9)
`cache.memo("poss:game", (game_id,), lambda: _build(game_id)[0], max_entries=256)`. La clave queda prefijada por `(data_version, config_version)`: cambiar `clock.reset_secs`, `transition.max_secs`, etc. invalida sin reiniciar. `_build` completo (con `outside_points` y `anomalies`) se cachea en el mismo namespace con clave `(game_id, "full")`.

### 4.5 `team_possessions(team_code, comp_id, ctx, *, side="ataque") -> list[Possession]`
1. `games = context.filter_games(repository.team_pbp_games(team_code, comp_id), ctx, team_code)`.
2. Por partido: `game_possessions(gid)`; `side == "ataque"` → `p.team == team_code`; `"defensa"` → `p.opp == team_code`.
3. Excluir `p.incomplete`.
4. Filtros de nivel evento adaptados a posesión (PROPUESTA de semántica, se coordina con T-03): `quarter` → `p.period`/`p.period_type`; `on`/`off` → `own_on_court` (ataque) u `opp_on_court` (defensa) del lado del equipo consultado; `score` → margen al inicio (`p.score_start`*, desde `s1`/`s2` del evento previo al inicio). Con quintetos nulos y filtro `on`/`off` → excluida y contada en `games_excluded["sin_quinteto"]`*.
5. `pred = context.possession_predicate(ctx)` (T-03; A-02…A-05 registran dimensiones) → filtrar.

### 4.6 `possessions_bundle(possessions, *, entity_type, entity_id, name, games) -> StatBundle` (PROPUESTA)
`own = Σ p.box` (RAW_KEYS), `opp = Σ p.opp_box` + conteos del rival en esas posesiones no aplican (el rival no ataca en posesiones propias: para DER/`pts_against` el loader pide además `team_possessions(..., side="defensa")` y suma su `box` como `opp`), `possessions_counted = len(possessions)`, `poss_seconds = Σ p.duration`, `seconds = Σ p.duration` (ataque) + defensa, `games = len({p.game_id})`. Las fórmulas las aplica `stats_engine.compute_standard` (regla 4). Métricas sin fuente por posesión (p. ej. `minutes` de jugador) → nulo `no_aplica`.

### 4.7 Métricas nuevas en `stats_engine.compute_standard`
- `possessions_counted` = `bundle.possessions_counted` (null `requiere_posesiones` si `None`; `sin_pbp` si la entidad no tiene partidos con pbp).
- `off_poss_duration` = `bundle.poss_seconds / bundle.possessions_counted` (null `sin_intentos` si 0).
- `player_poss_duration` = `finished_poss.seconds / finished_poss.count`, con `finished_poss` = posesiones completas del equipo cuya finalización es del jugador (`finisher_id` o `turnover_by_id` == jugador) (interpretación a confirmar con A-12, §10).
Metadatos (`metrics_catalog`): `possessions_counted` (Posesiones contadas, volumen, dec1, neutral, volume, own, poss); `off_poss_duration` (Seg. por posesión propia, volumen, dec1, neutral, fixed, poss); `player_poss_duration` (Seg. de posesión, uso, dec1, neutral, fixed, poss, entities=("player",)).
El loader de `team`/`player` (T-05) completa `bundle.possessions_counted/poss_seconds/finished_poss` llamando a `team_possessions` solo si la competencia tiene pbp; no cambia `possessions` (fórmula).

### 4.8 `reconcile(scope: dict) -> dict`
- `scope = {"game_id": ...}` → por equipo del partido: `counted` (completas), `incomplete`, `period_end_empty` (completas con `end_type == "fin_periodo"` y sin tiro/TL/pérdida), `formula_pbp = fga2 + fga3 + 0.44·fta + tov − orb` sobre el pbp del equipo (mismos conteos que `lineups._agg`, con `tov` incluyendo pérdidas de equipo), `formula_box` desde `team_game_stats`, `diff_pct`, `pts_poss` (Σ pts de completas + incompletas), `pts_outside`, `pts_box`, `pts_ok = pts_poss + pts_outside == pts_box`.
- `scope = {"comp_id": ...}` → suma por equipo de todos sus partidos con pbp de la competencia (pooled: `diff_pct = 100·(Σcounted − Σformula)/Σformula`), `within_2pct = |diff_pct| ≤ 2`, `games_over_5pct` por equipo-partido, `totals`, `games_excluded.sin_pbp`. Cacheado en `poss:game` con clave `("reconcile", comp_id)`.
- **Procedimiento de diagnóstico de huecos** (documentado en `docs/metrics.md` y usado en Grupo F): para cada equipo-partido con |dif| > 5 %: (1) contar incompletas por motivo; (2) contar `period_end_empty`; (3) comparar `formula_pbp` vs `formula_box` (si difieren, el problema es pbp↔box → check `pbp_box_mismatch` de F-11, no la reconstrucción); (4) listar `anomalies` por tipo; (5) abrir la inspección del partido y revisar las posesiones alrededor de cada anomalía contra `GET /api/pbp/<game_id>`. Se registra en `progress.md` la causa de cada caso.

### 4.9 `possession_gaps_check(comp_id: int) -> dict` (PROPUESTA de nombre) + registro
`data_quality.register_check("possession_gaps", possession_gaps_check)` al importar el módulo. Recorre partidos con pbp de la competencia; `count` = incompletas; `pct = 100·count/total`; `items` por partido con incompletas o |dif| > 5 %.

### 4.10 `ppp_stats(comp_id: int, ctx) -> dict` (PROPUESTA) y cambios en `sample.py`
`{mean, sd, n}` de puntos por posesión completa (todas las posesiones de la competencia, ambos lados una sola vez). `sample.band(...)`: `σ = ppp_stats.sd` si `n ≥ 500`, si no `config.get("sample.ppp_sd")`. `calibrate_k(entity, comp_id, method="posesiones_alternas")`: para cada unidad, posesiones ordenadas por (fecha, partido, poss_id) repartidas por paridad; OER por mitad; `r`; `K = n̄_mitad·(1−r)/r`; el response agrega `method`.

### 4.11 `register_enricher(name, fn)`
Lista ordenada en módulo; registrar dos veces el mismo `name` reemplaza. A-02 (`origin`), A-03 (`ptype`), A-04 (`outcome`), A-05 (`band`) se registran al importar su módulo o sección. Un enriquecedor que lanza excepción no rompe la reconstrucción: se loguea, sus atributos quedan `None` y se agrega anomalía `enricher_error`.

### Manejo de nulos (C-11)
Posesión incompleta nunca aporta 0: queda fuera. `elapsed`/`band` nulos cuando el reloj no es derivable. Quintetos nulos sin 5 titulares. `diff_pct` nulo si fórmula 0. Métricas con razón: `requiere_posesiones`, `sin_pbp`, `sin_intentos`, `no_aplica`.

## 5. Frontend — capa API (api.js)
- `api.gamePossessions(gameId, params = {})` → `GET /api/game/${gameId}/possessions${qs(params)}`.
- `api.possessionsReconcile(params)` → `GET /api/possessions/reconcile${qs(params)}` (`params.competition` obligatorio).
Ambos vía `apiFetch` (credenciales de sesión como el resto).

## 6. Frontend — UI
- **Dónde**: S1 Datos → pestaña `calidad` (`views/datos.js`, X-01 ya implementado en fase 3). El check `possession_gaps` se renderiza con el mismo componente de checks de F-11 (sin cambios: pasa de `no_disponible` a ok/alerta).
- **Tarjeta "Conciliación de posesiones"** (debajo de los checks): título `t('datos.calidad.posesiones.titulo', 'Conciliación de posesiones')`; nota `t('datos.calidad.posesiones.nota', 'Reconstruidas una por una vs fórmula del glosario. Diferencia admitida: 2 % por equipo.')`; tabla ordenable (`cmpNullsLast`): Equipo · Partidos · Reconstruidas · Fórmula · Diferencia % · Incompletas; diferencia con clase `.poss-alert` si |dif| > 2. Debajo, "Partidos con diferencia mayor al 5 %" (lista; vacío: `t('datos.calidad.posesiones.sin_desvios', 'Ningún partido supera el 5 %.')`). Botón CSV con `exporters.toCSV` + `downloadBlob` (T-06).
- **Hoja de inspección** (clic en un partido de la lista o en un ítem del check): modal/hoja inferior en móvil con la tabla de posesiones (# · Equipo · Per. · Inicio · Fin · Dur. · Op. · Final. · Pts · Estado) formateada con `fmtNumber`; incompletas con clase `.poss-incomplete` y el motivo en `title`; chips de filtro por equipo; resumen de conciliación arriba ("Reconstruidas 78 · Fórmula 77,5 · +0,6 %").
- Estados: loading (spinner/skeleton de F-11), vacío/error/offline con el copy del spec §6, éxito.
- Componentes reutilizados: `core/format.js` (`fmtNumber`, `nullDisplay`, `cmpNullsLast`), `core/i18n.js` (`t`), `components/exporters.js`, modal existente (`.modal`), `components/tabs.js` (pestaña ya existe).
- Mobile (<768 px): tabla de conciliación con columna Equipo fija (`.table-sticky`); la inspección oculta Inicio/Fin y muestra Dur.; hoja inferior a pantalla completa.

## 7. Navegación
Sin sección ni pestaña nueva. La hoja de inspección abre con `#/datos/calidad?competition=<id>&game=<game_id>` (parámetro `game` PROPUESTA de la vista, no es contexto T-03) para poder compartir el enlace.

## 8. Contratos de datos
- `Possession`/`Chance`: arquitectura §3.9 + campos PROPUESTA: `box: dict`, `opp_box: dict` (RAW_KEYS por lado dentro de la posesión), `lineup_changed: bool`, `score_start: tuple[int, int] | None`, `event_numbers: tuple[int, ...]` (rango de `action_number` de la posesión, para `detail=1` y enriquecedores).
- `StatBundle` (T-05) + `poss_seconds: float | None`, `finished_poss: dict | None` (PROPUESTA).
- JSON: §3 (inspección y conciliación); check `possession_gaps` según contrato de F-11.
- Serialización: `own_on_court`/`opp_on_court` como listas ordenadas de `player_id` (o `null`).

## 9. Manejo de errores y offline
| Situación | HTTP | Mensaje |
|---|---|---|
| Partido inexistente | 404 `no_encontrado` | "Partido no encontrado." |
| Partido sin pbp | 404 `sin_pbp` | "Este partido no tiene play-by-play." |
| `team` ajeno al partido | 400 `parametro_invalido` | "Equipo inválido para este partido." |
| Competencia inexistente | 400 `competencia_inexistente` | "La competencia no existe." |
| `competition=all` o ausente sin default | 400 `parametro_invalido` | "Elegí una competencia para conciliar." |
| Sin sesión | 401 | handler global de `api.js` |
| Error inesperado en reconstrucción de un partido | — | el partido se omite de la conciliación y se lista en `items` del check con motivo `error_reconstruccion` (nunca 500 para toda la competencia) |
Offline: `/api/*` siempre a red; la UI muestra el copy de sin conexión de F-11. Sin asset estático nuevo; si X-01 mantiene `CACHE` versionado, se sube al siguiente entero por el cambio de `views/datos.js` y `style.css`.

## 10. Riesgos / decisiones
- **R-1 Orden de eventos**: `action_number` no es cronológico en jugadas corregidas; el reloj monótono evita duraciones negativas pero puede asignar una duración 0 a una posesión cuyo evento de cierre se registró "antes". Mitigación: CA-11 + anomalía `reloj_no_derivable`; se mide cuántos casos hay en el seed.
- **R-2 And-one por look-ahead**: sin calificadores (partidos no reprocesados con ingesta v2) se usa la heurística `foulon` + "1of1" con el mismo reloj; un TL técnico 1of1 con el mismo reloj podría confundirse. Mitigación: exigir ingesta v2 para A-01 (dependencia F-11) y marcar la heurística como fallback.
- **R-3 Fin de período sin acción**: inflan `counted` vs fórmula (+0,5 % en el prototipo). Decisión: se cuentan y se informan aparte (spec §9).
- **R-4 Rendimiento/memoria** (R-02 transversal): ~2–5 ms por partido; `max_entries=256` en `poss:game` (≈ 256 partidos × ~160 posesiones). Medición en CA-15.
- **R-5 Reloj tras antideportiva** (reinicio a 14 por falta): no modelado; se documenta como limitación.
- **R-6 Definición de `player_poss_duration`**: interpretación "duración media de las posesiones que el jugador finaliza"; A-12 debe confirmar (se reporta como hueco).
- **Desviaciones/propuestas respecto de la arquitectura** (todas PROPUESTA, reportadas en huecos): campos `box`, `opp_box`, `lineup_changed`, `score_start`, `event_numbers` en `Possession`; `poss_seconds`, `finished_poss` en `StatBundle`; funciones `possessions_bundle`, `ppp_stats`, `possession_gaps_check`, `lineups.event_lineups`; parámetro de vista `game` en `#/datos/calidad`; tablas de diagnóstico de Calidad **no** registradas en T-06 (son diagnósticos admin, no tablas de métricas; exportan CSV con el exportador de T-06).
- **Objeción (desacuerdo leve)**: la arquitectura fija `end_type ∈ {t2c, t2f, t3c, t3f, falta, perdida, fin_periodo}` sin valor para cambio por salto entre dos; se mapea a `perdida` con `turnover_by_id = null` (queda explícito en `docs/metrics.md`).
- **Dependencias técnicas**:
  - F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)): `repository.game_events`, `repository.team_pbp_games`, `repository.competition_games`, `cache.memo`, `data_quality.register_check`, columnas `pbp_events.previous_action`/`qualifiers`, `lineups.PERIOD_LEN`/`PERIOD_TYPES` con `OVERTIME`.
  - T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)): `StatBundle`, `compute_standard`, `metrics_catalog.METRICS`/`register_entity`.
  - F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)): `config.get`, `CONFIG_SPEC`.
  - T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)): `sample.band`, `sample.calibrate_k`.
  - T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)): `Context`, `filter_games`, `possession_predicate`, `level`.
  - C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)): `player_game_stats.player_id`.
  - C-03 ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)): `shot_zones.classify_zone` (zona de cada tiro).
  - X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)): `views/datos.js`, pestaña `calidad`.
- **Estimación: XL · 28–40 h** (máquina de estados y casos borde 12–16 h; `build_segments_both` 3–4 h; conciliación + diagnóstico 4–6 h; integraciones T-05/T-02/F-11/T-03 4–6 h; UI 3–4 h; verificación sobre 13 partidos + docs 4–6 h).
