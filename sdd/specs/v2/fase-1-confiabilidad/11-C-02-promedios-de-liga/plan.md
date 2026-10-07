# Plan — C-02: Promedios de liga rotos

> **ID:** C-02 · **Prioridad:** P0 · **Fase y orden:** 1·11 (se recomienda ejecutarlo antes de C-04, C-01 y C-07, ver §10 D-1)
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)) · F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md), tal como quedó implementado: ver su `progress.md`) · **Habilita:** T-01, F-14, T-03, C-04, C-01, C-07
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 C-02 · Arquitectura §2.1, §3.1, §3.6, §3.8, §4, §7.5, §7.8, §9.2 I-12/I-13
> **Estimación:** L · 10–15 h

## 1. Enfoque
Hoy el perfil de equipo y de jugador se arma con tres piezas repartidas: (a) rutas de `app.py` que recorren **toda** la base
para construir una "población de liga" por partido, (b) `league_averages()` que promedia esos valores por partido, y (c) el
navegador, que ante cualquier filtro recalcula los promedios con `_computeAvg()`. C-02 las reemplaza por **una sola cadena en el backend**:

1. **Selección** — `context.py` (NUEVO, mínimo: `competition` y `last`, que T-03 amplía) resuelve la competencia de la petición con
   `repository.resolve_competition` (parámetro → competencia más reciente de la entidad → configurada → la del partido más reciente;
   `all` solo si se pide) y filtra los partidos de la entidad.
2. **Agregación única** — `stats_engine.aggregate_games()` convierte la lista de partidos de una selección en `averages` + `totals` +
   `null_reasons` (media de tasas por partido como hoy, más una lista extensible `POOLED_GROUPS` de cocientes de totales: hoy AS/PER y
   DEF/TO; C-07, C-01 y C-04 registran los suyos). **La misma función** calcula el perfil de la entidad y el valor de cada miembro de la población.
3. **Población** — `population.py` (NUEVO, camino `apply_thresholds=False`, Arquitectura §3.6) arma los miembros de una competencia
   (equipos; jugadores con ≥ 1 partido jugado) con la agregación anterior; `league_summary()` entrega `{avg, best, reason}` por métrica.
   El `Ø` es la media de las entidades (DA-08), excluye nulos y **no depende de `last`**.
4. **Rutas finas** — `team_stats`, `player_stats` y `league_overview` delegan en `population.team_profile`/`player_profile`/`repository`.
   Se elimina el mapa `leagues` y la lógica de liga de `app.py`.
5. **Frontend** — Equipo, Jugador y Comparar piden el perfil al servidor con `competition`/`last` y dejan de recalcular
   (`_computeAvg`, `_filterByComp`, `_filteredLog` se eliminan); `statBox` muestra la razón del `Ø` nulo; cards `TO`/`AS`/`Robos`/`Tapones`
   comparan contra su propia métrica; Comparar usa la competencia elegida y suma la fila "Ø liga"; la evolución de jugador gana su línea `Ø`;
   Liga abre en la competencia por defecto.

Sin esquema, sin dependencias nuevas. Los valores de la propia entidad **no cambian** (CA-15); cambian el `Ø`, la selección y la competencia por defecto.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/context.py` | module **NUEVO** | `Context{competition_id, competition_all, last}`, `ContextError`, `parse_context`, `context_key`, `filter_games`, `context_echo` (T-03 lo completa) | RF-1, RF-5, RF-6, RF-13, RF-14 |
| `backend/repository.py` | module **NUEVO** (subconjunto de lo que F-11 difirió) | `resolve_competition`, `team_game_rows`, `player_game_rows`, `opponent_row`; memo por petición en `flask.g` | RF-3, RF-6, RF-14 |
| `backend/population.py` | module **NUEVO** | `Population`/`Member`, `population`, `league_reference`, `league_summary` (PROPUESTA), `team_game_adv`, `player_game_adv`, `team_profile`, `player_profile` (PROPUESTA) | RF-1…RF-5, RF-9, RF-13 |
| `backend/stats_engine.py` | service | `TEAM_AVG_KEYS`, `PLAYER_AVG_KEYS`, `TOTAL_KEYS`, `LOWER_IS_BETTER`, `POOLED_GROUPS` (+ grupo `_season_balance`), `aggregate_games`; `league_averages` pasa a recibir valores por entidad y devuelve `{avg, best, reason}`; `null_reasons(…, overrides)` | RF-1, RF-2, RF-8, RF-9 |
| `backend/competitions.py` | module | `list_competitions(include_hidden, default_id=None)` agrega `is_default` | RF-6, RF-12 |
| `backend/app.py` | route | `team_stats`, `player_stats` finos (parsean contexto y delegan); `league_overview` usa `repository.resolve_competition`; `list_competitions` pasa `default_id`; se borran los bucles de liga y `leagues`. `import context, repository, population` | RF-1, RF-5, RF-6, RF-12, RF-14 |
| `frontend/js/api.js` | js-api | `team(code, params)`, `player(code, name, params)`, `clutchTeam` traduce `all` | RF-5 |
| `frontend/js/core/format.js` | js-core | `NULL_REASON_LABELS`: `sin_universo`, `sin_datos` | RF-7, RF-2 |
| `frontend/js/charts.js` | js-chart | `_norm` con guarda de `Ø` nulo; `drawPlayerEvolution(canvasId, gameLog, leagueOerAvg)` con línea `OER liga Ø` | RF-7, RF-10 |
| `frontend/js/app.js` | js-view | `statBox` (razón del `Ø`); eliminar `_computeAvg`/`_filterByComp`/`_filteredLog`/`_logComps`; `_compOptions(…, allValue)`; `renderTeam`/`_reloadTeam`/`_renderTeamContent`; `renderPlayer`/`_renderPlayerContent`; `renderCompare` (selector, `Ø` y fila "Ø liga"); `renderLeague` (competencia por defecto, `all`); `leagueKey` de `TO`/`AS`/`Robos`/`Tapones` | RF-4…RF-12 |
| `frontend/sw.js` | sw | Subir `CACHE` al siguiente entero (hoy `smart-basket-v13`; el número se asigna al integrar). Sin archivos nuevos en `STATIC` | assets |
| `docs/api.md` | doc (cierre) | `GET /api/team`, `/api/player`, `/api/league`, `/api/competitions`: query `competition`/`last`, `context`, `competitions`, `league`/`league_meta`, retiro de `leagues`; nota "Promedios de liga" reescrita; errores nuevos | RF-1…RF-14 |
| `docs/metrics.md` | doc (cierre) | Sección "Promedio de liga (Ø)": definición (media de entidades, población, exclusión de nulos y DNP, `sin_universo`) | RF-1…RF-3 |
| `docs/frontend.md` | doc (cierre) | Reescribir "Filtro por competencia" y "Contexto de las cards de stat"; tabla de funciones (`_computeAvg` eliminada); fila "Ø liga" de Comparar; evolución de jugador; copy nuevo | RF-4…RF-12 |
| `docs/architecture.md` | doc (cierre) | Módulos `context.py`, `repository.py`, `population.py` en el mapa de capas | — |

**Matriz RF → archivo:** RF-1 ✔ (population, context) · RF-2 ✔ (stats_engine `league_averages`, population) · RF-3 ✔ (population `_team_members`/`_player_members`) ·
RF-4 ✔ (population `league_summary` única; app.js) · RF-5 ✔ (context, population, app.py, api.js, app.js) · RF-6 ✔ (repository `resolve_competition`, competitions) ·
RF-7 ✔ (population, format.js, app.js, charts.js) · RF-8 ✔ (app.js `statBox`; verificación) · RF-9 ✔ (stats_engine keys, app.js) · RF-10 ✔ (charts.js, app.js) ·
RF-11 ✔ (app.js `renderCompare`) · RF-12 ✔ (app.py `league_overview`, app.js `renderLeague`) · RF-13 ✔ (context `context_echo`, population) · RF-14 ✔ (context, repository, app.py). Sin RF huérfanos.

## 3. Backend — rutas y modelos
**Sin tablas ni columnas nuevas. Sin `upgrade_db()`.** Errores con el formato vigente `{"error": "<mensaje>"}` (F-11 no adoptó `code`/`details` de Arquitectura §7.8; C-02 mantiene la convención real).

### `GET /api/team/<team_code>`  (login_required)
Query: `competition` = `<id>` | `all` | texto de FIBA (legado, vía alias) | ausente (competencia por defecto, §4.2); `last` = entero ≥ 1 | ausente.

Response 200 (ejemplo real: `GET /api/team/OLI?competition=1&last=1`, base local; los números de `league` son los de la base de 13 partidos):
```json
{
  "team_code": "OLI", "team_name": "OLIMPIA", "games": 1,
  "context": {
    "competition": {"id": 1, "label": "Liga de Ascenso 2026"},
    "applied": {"last": 1}, "ignored": [],
    "level": "partido", "population_mode": "apply_all",
    "games_used": 1, "games_total": 2, "games_excluded": {},
    "label": "Liga de Ascenso 2026 · Último partido"
  },
  "competitions": [{"id": 1, "label": "Liga de Ascenso 2026", "games": 2}],
  "record": {"wins": 0, "losses": 1, "win_pct": 0.0, "home": "0-0", "away": "0-1"},
  "averages": {"oer": 1.0502, "der": 1.19, "pace": 85.8, "ast_to": 0.9, "tov": 20.0, "...": "todas las claves de TEAM_AVG_KEYS + ast_to, def_to_ratio"},
  "null_reasons": {},
  "totals": {"fga2": 38, "fgm2": 28, "fga3": 41, "fgm3": 7, "fta": 32, "ftm": 26},
  "league": {
    "oer": {"avg": 1.0074, "best": 1.1232, "reason": null},
    "der": {"avg": 1.0145, "best": 0.8494, "reason": null},
    "tov": {"avg": 14.5714, "best": 10.0, "reason": null},
    "ast_to": {"avg": 1.2265, "best": 1.95, "reason": null},
    "...": "una entrada por cada clave de averages"
  },
  "league_meta": {"entity_type": "team", "competition_id": 1, "competition_label": "Liga de Ascenso 2026",
                  "size": 14, "criterion": "media de los equipos de la competencia (cada uno con todos sus partidos)"},
  "game_log": [{"game_id": "2849347", "date": "2026-06-11", "competition_id": 1, "competition_label": "Liga de Ascenso 2026",
                "opponent": "MONTEVIDEO B.B.C.", "opponent_code": "MON", "home_away": "V", "oer": 1.0502, "...": "métricas del partido",
                "null_reasons": {}}]
}
```
(`averages`, `totals` y el partido son los reales de Olimpia en el partido 2849347, el último de la selección `last=1`: `103-113`, 45 minutos por la prórroga. Los números de `league` son los de la base local de 13 partidos; el ejemplo de `record` sigue la misma selección.) `leagues` **ya no existe**.
Con `competition=all`: `context.competition = {"id": null, "label": "Todas las competencias"}`, `league.<k> = {"avg": null, "best": null, "reason": "sin_universo"}` para cada clave y `league_meta = {"entity_type": "team", "competition_id": null, "size": 0, "criterion": "sin_universo"}`.
Con una competencia válida sin partidos del equipo: `games: 0`, `averages.<k> = null`, `null_reasons.<k> = "sin_datos"`, `game_log: []`, `record` en cero, y `league` calculado (la competencia existe).
Errores: 400 `{"error": "La competencia no existe."}` · 400 `{"error": "La competencia no está publicada."}` (borrador) · 400 `{"error": "El parámetro last debe ser un entero mayor a 0."}` · 404 `{"error": "Equipo no encontrado"}` (el equipo no tiene ningún partido publicado).

### `GET /api/player/<team_code>/<player_name>` y `GET /api/player/<int:player_id>` (C-08)
Mismo contrato de query y de `context`/`competitions`/`league`/`league_meta` (`entity_type: "player"`, `size` = jugadores con ≥ 1 partido jugado). `games` = partidos **jugados** de la
selección; `game_log` de la selección incluye los DNP como filas `played: false`; `averages`/`totals`/`null_reasons` sobre los jugados. Sin partidos jugados en la selección: `averages.<k> = null` con razón `dnp`
(si la entidad tiene fichas pero ninguna jugada) o `sin_datos` (si no tiene fichas en la selección). Errores: los de arriba + 404 `{"error": "Jugador no encontrado"}`.

### `GET /api/league`  (mod.)
`competition` ausente → competencia por defecto (`resolve_competition(None)`); `all` → todas; id/texto legado → esa. Misma respuesta que hoy (lista de equipos con `standings_pos`, etc.). Errores: 400 de arriba. Si no hay competencias → lista vacía.

### `GET /api/competitions`  (mod.)
Cada objeto agrega `"is_default": true|false` (exactamente uno es `true` cuando hay competencias publicadas con partidos): la que devolvería `resolve_competition(None)`.

## 4. Backend — lógica

### 4.1 `backend/context.py` (NUEVO)
```
@dataclass(frozen=True)
class Context:
    competition_id: int | None     # None si competition_all o si no hay competencias
    competition_all: bool
    last: int | None

class ContextError(Exception):     # .status = 400
    def __init__(self, message, status=400): ...

parse_context(args: Mapping[str, str], *, team_code: str | None = None) -> Context
    # 1) res = repository.resolve_competition(args.get("competition"), team_code=team_code); CompetitionError → ContextError(str(e), e.status)
    # 2) last: ausente/"" → None; int(raw) falla o < 1 → ContextError("El parámetro last debe ser un entero mayor a 0.")
    # 3) Context(res["id"], res["all"], last)
context_key(ctx) -> tuple                                  # (competition_id, competition_all, last): clave de memo
filter_games(games: list[dict], ctx: Context, team_code: str) -> list[dict]
    # games: dicts con game_id, date, competition_id (equipo: team_game_rows; jugador: fichas).
    # 1) si no competition_all y competition_id no es None: conservar competition_id == ctx.competition_id
    # 2) orden cronológico (date or "", game_id)    # sin fecha → al principio (se considera más antiguo)
    # 3) si ctx.last: quedarse con los últimos N    # los N más recientes; devuelve cronológico ascendente
    # `team_code` no se usa en C-02 (T-03 lo usa para sede y rival); se mantiene por compatibilidad con Arquitectura §3.8
context_echo(ctx, *, games_used: int, games_total: int, games_excluded: dict, ignored: list, competition_label: str | None) -> dict
    # shape §7.5: competition {id, label}, applied ({"last": N} si aplica), ignored, level "partido", population_mode "apply_all",
    # games_used, games_total, games_excluded, label = etiqueta de la competencia ("Todas las competencias" si all) + " · Último partido" / " · Últimos N"
```
`level` y `population_mode` quedan como constantes del eco; T-03 las vuelve funciones. Contexto mínimo: `Context` solo tiene los 3 campos de Arquitectura §3.8 que existen en fase 1; T-03 agrega el resto con valores por defecto, sin tocar C-02.

### 4.2 `backend/repository.py` (NUEVO — subconjunto de lo que F-11 difirió)
Carga en bloque (una consulta por tabla, sin N+1) y respeta la regla de borradores (`competitions.visible`). Memo por petición en `flask.g` (clave `("team_rows", comp_id)`), sin caché entre peticiones.
```
resolve_competition(param: str | None, *, team_code: str | None = None, include_hidden: bool = False) -> dict
    # → {"id": int|None, "all": bool, "label": str|None, "source": "param"|"entidad"|"config"|"ultima"|"ninguna"}
    1. p = (param or "").strip()
    2. p.lower() == "all"  → {"id": None, "all": True, "label": "Todas las competencias", "source": "param"}
    3. p                   → cid = competitions.resolve(p)    # id numérico o alias/texto de FIBA; inexistente → CompetitionError("La competencia no existe.", 400)
                             comp = competitions.get(cid); si comp.status != "publicada" y no include_hidden →
                             CompetitionError("La competencia no está publicada.", 400)
    4. sin param y team_code → competencia del partido visible más reciente del equipo (join Game, order by Game.date desc, game_id desc;
                             saltea partidos sin competencia) → "entidad"
    5. `_configured_default()`  → hook de F-13 (`ui.default_competition_id`): hoy devuelve None; F-13 lo conecta. Si el id no existe o no está publicada se ignora → "config"
    6. competencia publicada con el partido más reciente: competitions.list_competitions()[0] → "ultima"
    7. ninguna → {"id": None, "all": False, "label": None, "source": "ninguna"}
team_game_rows(comp_id: int | None) -> dict[tuple[str, str], dict]
    # {(game_id, team_code): fila de team_game_stats + date, competition_id, game_minutes (games.minutes or 40), home_code, away_code}
    # comp_id None = todas las publicadas. Una sola consulta con join a Game.
player_game_rows(comp_id: int | None) -> list[dict]
    # filas de player_game_stats (incluye DNP) + date, competition_id, game_minutes; orden (date, game_id)
opponent_row(rows: dict, row: dict) -> dict | None
    # code rival = away_code si home_code == row["team_code"] sino home_code; rows.get((row["game_id"], code))
```
`_team_game_ids` y `_team_pbp_games` de `app.py` **no se tocan** (los usan quintetos, ON/OFF y cierres; F-11/C-06/C-08 los migran a `repository`). **PROPUESTA (no está en 00-arquitectura-transversal.md)**: `repository.py` nace con este subconjunto porque F-11 difirió el módulo a C-02 (`02-F-11-.../progress.md`); `competition_games`, `game_events` y `team_pbp_games` quedan para quien los necesite primero (C-08/T-02/C-03 los citan: hueco reportado en §10 D-4).

### 4.3 `backend/stats_engine.py`
```
TEAM_AVG_KEYS, PLAYER_AVG_KEYS: list[str]     # las listas `keys` de team_stats (app.py l.356–369) y player_stats (l.554–568), movidas sin cambios,
                                               # menos ast_to y def_to_ratio (los entregan POOLED_GROUPS)
TOTAL_KEYS = ("fga2", "fgm2", "fga3", "fgm3", "fta", "ftm")      # C-04 agrega ast, tov
LOWER_IS_BETTER = {"der", "to_pct", "to_ratio", "opp_efg_pct", "opp_ts_pct", "tov_pos", "tov", "pf"}   # solo para `best` (radar)
POOLED_GROUPS: list[Callable[[dict], tuple[dict, dict]]]          # cada grupo: sums -> (valores, razones)

_season_balance(sums) -> (vals, reasons)
    # {"ast_to": season_ast_to(sums.get("ast"), sums.get("tov")), "def_to_ratio": season_def_to_ratio(sums.get("stl"), sums.get("blk"), sums.get("drb"), sums.get("tov"))}
    # razones: sin_perdidas para los None. POOLED_GROUPS = [_season_balance] (C-07 agrega _season_shooting; C-01 agrega season_player_rates)

aggregate_games(per_game: list[dict], keys: list[str], *, empty_reason: str = "sin_datos") -> dict
    # per_game: dicts de calc_team_stats / calc_player_stats (+ desglose FIBA) de los partidos de la selección (jugador: solo los jugados)
    # → {"games": n, "averages": {...}, "totals": {...}, "null_reasons": {...}}
    1. n = len(per_game). Si n == 0: averages = {k: None para k en keys + claves de los grupos}, totals = {k: 0}, null_reasons = {k: empty_reason}   # team: "sin_datos"; jugador: "dnp"
    2. averages[k] = round(mean(valores no nulos y finitos de k), 4) o None si no hay ninguno                    # idéntico a `_avg` actual (excluye None)
    3. sums = Σ de cada clave numérica (no bool) de cada partido; los términos privados `_pool` (C-01) se suman con prefijo `pool_`
    4. para cada grupo en POOLED_GROUPS: vals, reasons = grupo(sums); averages.update(vals); overrides.update(reasons)
    5. totals = {k: int(sums.get(k, 0)) for k in TOTAL_KEYS}
    6. null_reasons = null_reasons(averages, played=True, overrides=overrides)

league_averages(member_values: list[dict], keys: list[str]) -> dict       # (mod.) ahora recibe UN dict por entidad, no por partido
    # {k: {"avg": round(mean, 4), "best": min|max según LOWER_IS_BETTER, "reason": None}}; sin valores → {"avg": None, "best": None, "reason": "sin_datos"}
null_reasons(metrics, *, played=True, overrides=None) -> dict               # (mod.) overrides[k] tiene prioridad (C-01 lo usa para estimacion_invalida;
                                                                            # si C-01 ya agregó el parámetro, no se repite)
```
Fórmula del `Ø` (nueva, `docs/metrics.md` §Promedio de liga): `Ø(k) = (1/N) · Σ_{e ∈ población, valor_e(k) ≠ null} valor_e(k)`, con `N` = cantidad de entidades con valor no nulo, y `valor_e(k)` = el valor de `k` en el `averages` de la entidad `e` calculado
sobre **todos** sus partidos jugados de la competencia (sin `last`). `best(k)` = `max`/`min` de los `valor_e(k)` (solo para escalar el radar). Nulos: una entidad con `valor_e(k) = null` no entra; si `N = 0` → `avg = null`, `reason = "sin_datos"`.

### 4.4 `backend/population.py` (NUEVO)
```
@dataclass Member:  id: str; name: str; values: dict; sample: dict; in_population: bool = True
@dataclass Population: entity_type: str; comp_id: int | None; ctx_key: tuple; members: list[Member]

team_game_adv(row: dict, opp: dict) -> dict
    # t = dict(row); t["minutes"] = row["game_minutes"]; adv = calc_team_stats(t, opp_dict(opp))
    # adv.update(paint_pts, second_chance_pts, pts_from_tov, bench_pts, fast_break_pts desde row  (NULL = no registrado, C-11), opp_pf desde row)
    # el mismo dict que hoy arma team_stats por partido; ÚNICO camino (perfil y población)
player_game_adv(row: dict, team_rows: dict) -> dict
    # p = dict(row); p.setdefault("trb", orb + drb); team = team_rows.get((gid, team_code)); opp = repository.opponent_row(team_rows, team)
    # adv = calc_player_stats(p, team_pos=0, team=team, game_minutes=row["game_minutes"], opp=opp)
    # reb_share/oreb_share/dreb_share = trb/team_trb, orb/team_orb, drb/team_drb con denominador 0 → None (lógica hoy en app.py)
population(entity_type: str, comp_id: int, ctx: Context, *, apply_thresholds: bool = False) -> Population
    # "team" | "player". apply_thresholds=True → NotImplementedError("Umbrales de población: T-01"). `ctx.last` NO entra (RF-1).
    # memo en flask.g por (entity_type, comp_id)
    _team_members(comp_id):
        rows = repository.team_game_rows(comp_id); por equipo, en orden (date, game_id):
        per_team[tc].append(team_game_adv(row, opponent_row(rows, row)))  (se omite el partido sin fila de rival)
        Member(id=tc, name=nombre del partido más reciente, values=aggregate_games(per_game, TEAM_AVG_KEYS)["averages"], sample={"games": n})
    _player_members(comp_id):
        prows = repository.player_game_rows(comp_id); trows = repository.team_game_rows(comp_id)
        agrupar por jugador: clave = player_id canónico (C-08) o (team_code, norm_name(player_name))
        adv jugados = [player_game_adv(r, trows) for r in grupo if played(r["minutes"])]   # DNP fuera
        si no hay partidos jugados → no es miembro (RF-3)
        Member(id=clave, name=resolve_identity(grupo)[0], values=aggregate_games(adv jugados, PLAYER_AVG_KEYS, empty_reason="dnp")["averages"], sample={"games": n})
league_reference(entity_type, comp_id, ctx) -> dict[str, float | None]      # firma de Arquitectura §3.6: solo la media
league_summary(entity_type: str, comp_id: int | None, ctx: Context) -> tuple[dict, dict]    # PROPUESTA (no está en 00-arquitectura-transversal.md)
    # → (league, league_meta). comp_id None (competition=all) → todas las claves con reason "sin_universo", size 0.
    # si no, league_averages([m.values for m in pop.members if m.in_population], claves de averages)
team_profile(team_code: str, ctx: Context) -> dict | None               # PROPUESTA: arma la respuesta de §3 (None → 404)
player_profile(team_code: str, player_name: str, ctx: Context) -> dict | None   # PROPUESTA (C-08: por player_id)
```
`team_profile` (algoritmo):
1. `rows = repository.team_game_rows(None)`; propias = filas con `team_code`; ninguna → `None`. `team_name` = el del partido más reciente. `competitions` = agrupar propias por `competition_id` → `[{id, label, games}]` (etiquetas de `competitions.labels()`).
2. `en_comp` = propias de la competencia (o todas si `competition_all`) → `games_total`. `sel = context.filter_games(propias, ctx, team_code)`.
3. `per_game = [team_game_adv(r, opp) for r in sel si hay rival]`; `agg = aggregate_games(per_game, TEAM_AVG_KEYS)`.
4. `record` (wins/losses/win_pct/home/away) sobre `per_game` (misma lógica que hoy; `win_pct` nulo sin partidos).
5. `league, league_meta = league_summary("team", ctx.competition_id, ctx)`; `context = context_echo(...)`.
6. `game_log` = `per_game` con `strip_private`, `date`, `competition*`, `opponent*`, `home_away`, `null_reasons(adv)`.
`player_profile`: igual con fichas del jugador (`norm_name`), `sel` incluye DNP, `adv` solo de los jugados para `aggregate_games(…, empty_reason=…)` con razón `"dnp"` si la selección tiene fichas (todas DNP) y `"sin_datos"` si no tiene ninguna; `games = len(jugados)`; `game_log` incluye los DNP (`played: false`, `null_reasons` con `dnp`). **Casos borde:** selección vacía → perfil vacío con `sin_datos`; competencia sin equipos → `league` con `sin_datos`; partido sin fila de rival → se omite (igual que hoy). **Caché:** memo por petición; sin caché entre peticiones (hueco: `cache.py`, §10 D-4).

### 4.5 `backend/app.py` (rutas finas)
```
team_stats(team_code):   ctx = context.parse_context(request.args, team_code=team_code)    # ContextError → jsonify({"error": …}), e.status
                         profile = population.team_profile(team_code, ctx); None → 404 "Equipo no encontrado"; jsonify(profile)
player_stats(team, name): ídem con population.player_profile
league_overview():       res = repository.resolve_competition(request.args.get("competition")) (CompetitionError → 400); comp_id = res["id"]; resto igual
list_competitions():     default_id = repository.resolve_competition(None)["id"]; competitions.list_competitions(include_hidden, default_id)
```
`search_players`, quintetos, ON/OFF y cierres: sin cambio.

## 5. Frontend — capa API (api.js)
```
team:       (code, params = {})        => apiFetch(`/api/team/${enc(code)}${qs(params)}`)
player:     (code, name, params = {})  => apiFetch(`/api/player/${enc(code)}/${enc(name)}${qs(params)}`)
league:     (comp)                     => apiFetch(`/api/league${qs({ competition: comp })}`)          // "all" se envía tal cual
clutchTeam: (team, comp)               => … qs({ competition: comp === "all" ? "" : comp })           // el endpoint de cierres no entiende "all"
```
`qs` ya omite `""`/`null`/`undefined`; los llamadores pasan `last: n || null`. Sin `fetch` fuera de `api.js`.

## 6. Frontend — UI
**Dónde vive.** Fase 1 (antes de X-01): vistas `#sec-team`, `#sec-player`, `#sec-compare`, `#sec-league`. X-01 las reubica en S3/S4/S6/S2; el estado `competition`/`last` pasa a la URL con T-03 (el contrato de `api.js` ya usa los nombres definitivos).

**`statBox`.** El bloque de contexto pasa a: `Ø ${isNull(avg) ? nullDisplay(lg.reason) : fmt(avg)}`, de modo que "Ø —" lleva el `title` de la razón (`sin_universo`, `sin_datos`). Sin `↑`. Si `league[leagueKey]` no existe, sin línea de contexto (igual que hoy).
**`_compOptions(comps, selected, allLabel = "Todas las competencias", allValue = "")`**: parámetro nuevo para que Equipo/Jugador/Comparar/Liga usen `allValue = "all"`; el catálogo de Datos y Buscar siguen con `""` (`/api/games` no entiende `all`).

**Equipo** (`renderTeam`, `_reloadTeam`, `_renderTeamContent`):
- Estado: `_teamData`, `_teamComp` (string; `"all"` o id), `_teamLastN`, `_teamReq` (contador para descartar respuestas viejas, patrón de F-11).
- `renderTeam(code)`: `_teamLastN = 0`, `_teamComp = null` → `api.team(code)` (sin parámetros: competencia por defecto) → `_teamComp = String(data.context.competition.id ?? "all")`; selector con `data.competitions` y valor `_teamComp` (oculto si ≤ 1 competencia); pills "Todos · Últ. 5 · Últ. 3" visibles si `data.context.games_total > 3`.
- Cambiar la competencia o una pill → `_reloadTeam()`: `api.team(code, { competition: _teamComp, last: _teamLastN || null })` y re-render; los cierres se piden con `_teamComp`.
- `_renderTeamContent(main, data)`: `av = { ...data.averages, null_reasons: data.null_reasons }`, `lg = data.league`, récord siempre visible (`data.record`), game log = `data.game_log`. Leyenda bajo los selectores: `Ø = promedio de {league_meta.size} equipos de {context.competition.label}` o, con "Todas", "Ø no disponible: elegí una competencia". Selección sin partidos (`games === 0`): "Sin partidos en esta competencia".
- `leagueKey` corregidos: `TO` → `"tov"`, `AS` → `"ast"`, `Robos` → `"stl"`, `Tapones` → `"blk"` (la caja AS/PER de C-04, `"ast_to"`).
- Radar: `drawRadar` solo si `lg.oer?.avg != null`; si no, el card muestra "El radar compara contra el promedio de una competencia: elegí una." Evolución: `drawEvolution("chart-evo", data.game_log, lg?.oer?.avg)`.
- Se eliminan `_computeAvg`, `_filterByComp`, `_filteredLog`, `_logComps`.

**Jugador** (`renderPlayer`, `_renderPlayerContent(main, data)`): ídem con `api.player(team, name, { competition })`; selector `#player-comp` con `data.competitions`; `lg = data.league`; `TO`/`AS`/`Robos`/`Tapones` con `leagueKey` propios; leyenda "Ø = promedio de {n} jugadores de {competencia}"; `drawPlayerEvolution("chart-player-evo", data.game_log, lg?.oer?.avg)`; radar con la misma guarda.

**Comparar** (`refreshCompareSelectors`, `renderCompare`): el selector usa `_compOptions(comps, sel || defaultId, …, "all")` donde `defaultId = comps.find(c => c.is_default)?.id`; `api.team(codeA, { competition })` y `api.team(codeB, { competition })` (con el selector oculto, sin parámetro); `lg = dataA.league` (misma competencia para ambos); `avA = dataA.averages`, `avB = dataB.averages` (se elimina el recálculo local); fila "Ø liga" en "Métricas avanzadas" con `lg.oer.avg`, `lg.der.avg`, `lg.net_rating.avg`, `lg.efg_pct.avg`, `lg.ts_pct.avg`, `lg.pace.avg`, `lg.or_pct.avg`, `lg.dr_pct.avg`, `lg.to_pct.avg`, `lg.as_pct.avg`, `lg.pts.avg`, `lg.possessions.avg` (`fmtOrNull(…, reason)`); radar con la guarda de "Todas".

**Liga** (`renderLeague`): `_leagueComp` arranca en el id con `is_default` (si el valor guardado ya no existe: vuelve al default); `_compOptions(…, "all")`; `_standingsCardHTML(teams, compSelHTML, pickComp)` con `pickComp = comps.length > 1 && (!_leagueComp || _leagueComp === "all")`.

**Estados.** loading: spinner existente al recargar; vacío/error/offline: los existentes + el nuevo "Sin partidos en esta competencia"; éxito: valor + `Ø`. Mobile (<768 px): sin cambios de layout; la fila "Ø liga" de Comparar vive dentro del `.table-wrap` existente (scroll interno). Copy sin `t()` (DA-21). `sw.js`: `app.js`, `api.js`, `charts.js` y `format.js` cambian → subir `CACHE`.

## 7. Navegación
Sin vistas ni rutas nuevas. X-01 mueve las cards a `#/equipo/<code>/resumen` y `#/jugador/<id>/resumen`; T-03 reemplaza el estado local `_teamComp`/`_teamLastN` por el contexto en la URL.

## 8. Contratos de datos
Los shapes de §3. Resumen del contrato nuevo:
```
perfil.context        {competition:{id,label}, applied:{last?}, ignored:[], level:"partido", population_mode:"apply_all", games_used, games_total, games_excluded:{}, label}
perfil.competitions   [{id, label, games}]                       // competencias publicadas en que la entidad tiene partidos
perfil.league         {<clave de averages>: {avg: number|null, best: number|null, reason: null|"sin_datos"|"sin_universo"}}
perfil.league_meta    {entity_type:"team"|"player", competition_id, competition_label?, size, criterion}
perfil.leagues        — ELIMINADO
/api/competitions[i]  + is_default
```
Sin filas SQLAlchemy nuevas. `Population`/`Member` son dataclasses internas (no se serializan).

## 9. Manejo de errores y offline
- 400 con mensaje en español (`La competencia no existe.` / `La competencia no está publicada.` / `El parámetro last debe ser un entero mayor a 0.`): el cliente los muestra en el toast existente; Equipo/Jugador vuelven a la competencia por defecto si la guardada ya no existe.
- 404 equipo/jugador: sin cambio. `/api/*` siempre a red (offline: mensaje existente).
- `sw.js`: no hay archivos nuevos, pero cambian cuatro assets → subir `CACHE` (cache-first).

## 10. Riesgos / decisiones
- **D-1 · Orden en la fase (desviación del orden del orquestador).** C-02 va **antes** de C-04, C-01 y C-07: crea `aggregate_games`/`POOLED_GROUPS` y mueve la selección al backend, que esos tres requisitos extienden. El grafo (Arquitectura §9.1) no lo impide (C-02 depende de C-11 y F-11). Si se mantiene el orden de carpeta, esos tres planes traen una variante que no depende de C-02 (parches puntuales en `_computeAvg`/rutas) y dejan pendientes los CA bajo filtro; C-02 los absorbe al cerrar. Reportado como desacuerdo de orden.
- **D-2 · `Ø` = media de entidades, no ponderada por partidos (DA-08 vs Feature 14 D-1).** Es un cambio de criterio respecto de lo ya documentado (`docs/api.md`, nota "Promedios de liga por competencia"): se actualiza el doc y se registra antes/después en progress (spec §9-A1). Consecuencia visible con pocos partidos: `Ø OER` y `Ø DER` dejan de coincidir.
- **D-3 · `Ø` sin umbrales (I-12).** Entidades con muestra chica entran al promedio hasta T-01. Mitigaciones ya incluidas: DNP fuera, criterio acumulado (C-01/C-04/C-07) y valores imposibles a nulo (C-01).
- **D-4 · `repository.py` parcial y sin `cache.py` (huecos de la arquitectura).** F-11 difirió `repository.py`, `cache.py`, `app_meta` y `data_version` ("→ C-02, que necesita el universo por defecto"). C-02 crea solo lo que usa (4 funciones, §4.2). Los planes de C-08, C-03, T-02, T-01, T-06 y F-13 citan `repository.competition_games`, `repository.game_events`, `repository.team_pbp_games` y `cache.memo/bump_data_version` como si existieran: **conviene asignarlos explícitamente** (propuesta: quien los necesite primero los crea; `team_pbp_games` ya existe como `app._team_pbp_games`). Sin `cache.py`, `population()` recalcula la población en cada petición (memo solo por petición): con 14 equipos y 259 fichas es despreciable; con una competencia grande se mide al integrar y se envuelve con `cache.memo` (namespace `pop:<entity_type>`, Arquitectura §3.14) cuando exista.
- **D-5 · `league_summary`, `team_profile`, `player_profile` (PROPUESTA, no están en la arquitectura).** La arquitectura fija `league_reference() -> dict[str, float|None]` (solo la media) y no dice dónde se arma el perfil. Se agregan para sacar la lógica de `app.py` (regla 3) y devolver `{avg, best, reason}`. T-05/T-01 pueden reemplazar los perfiles por `compute_standard` + `attach_fichas`.
- **D-6 · `leagues` se elimina del contrato.** Único consumidor: el frontend (se actualiza en la misma entrega). `league` (selección activa) lo reemplaza.
- **D-7 · `best` sigue en la respuesta** solo para escalar el radar; con la media de entidades `best` es el mejor equipo/jugador (antes, el mejor partido): cambia la escala del radar. Anotar en progress; T-01 reemplaza el radar por percentiles.
- **D-8 · Cambia el valor por defecto de la vista** (todas → competencia más reciente de la entidad). Sin diferencia con una sola competencia; con varias, el usuario ve primero una competencia (el selector conserva "Todas las competencias").
- **D-9 · Errores sin `code`.** Se sigue el formato real `{"error"}` (F-11, `progress.md` "Errores {error, code, details} ⏭").
- **Desviaciones respecto de la arquitectura:** `repository.py` parcial (D-4); `league_summary`/perfiles (D-5); sin `code` en errores (D-9); `Context` solo con 3 campos (T-03 completa). **Dependencias técnicas:** `competitions.resolve/get/labels/visible/list_competitions` y `ingest`/`competition_id` de [F-11](../02-F-11-calidad-datos-competencias/plan.md); `core/format.js` (`nullDisplay`, `NULL_REASON_LABELS`), `null_reasons`, `season_ast_to`, `season_def_to_ratio` de [C-11](../01-C-11-tratamiento-de-nulos/plan.md); opcional [C-08](../07-C-08-jugadores-duplicados/plan.md) (`player_id` canónico, `GET /api/player/<int:player_id>`); F-13 conecta `_configured_default()` ([../12-F-13-configuracion/plan.md](../12-F-13-configuracion/plan.md)). **Consumidores:** [T-01](../15-T-01-ficha-de-metrica/plan.md) (`population`, `league_reference`), [C-07](../10-C-07-detalle-tiro-completo/plan.md) (`aggregate_games`, `POOLED_GROUPS`), [C-04](../08-C-04-as-per/plan.md), [C-01](../09-C-01-rebotes-distribucion-jugador/plan.md), [T-03](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md) (`Context`).

## Estimación: L · 10–15 h
Backend 5–7 h (contexto 1, repositorio 1,5, población 2, agregación y rutas 1,5–2,5) · frontend 3–5 h (Equipo, Jugador, Comparar, Liga, gráficos) · verificación y docs 2–3 h. Mayor que la estimación de la arquitectura (M 6–10 h) porque F-11 dejó sin crear `repository.py` y porque el requisito incluye mover la selección al backend (RF-5), que la arquitectura asumía hecha por T-05.
