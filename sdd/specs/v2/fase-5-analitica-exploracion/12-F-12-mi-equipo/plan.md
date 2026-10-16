# Plan — F-12: Mi equipo

> **ID:** F-12 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 12
> **Depende de:** F-03 · F-17 · A-10 · F-13 · X-01 (rutas relativas en `spec.md` y en "Dependencias técnicas")
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** `spec.md` de este requisito · Arquitectura §3.2, §3.3, §3.12, §3.14, §3.15, §3.19, §3.21, §4, §5, §6, §7, §8, §9.2
> **Estimación:** L · 11–17 h

## 1. Enfoque

El backend arma S8 en **una sola llamada** `GET /api/my-team` (como `GET /api/prepare` de F-03), delegando todo el cálculo: `population`/`phrases.game_plan` (T-01/F-17), `insights.insights` (A-10), `lineups.all_lineups` (F-06) y `metrics_catalog` (T-05). Lo único propio es: (1) el calendario (`fixtures.py`, tabla `fixtures`, CRUD admin, `next_fixture`, vinculación al importar); (2) un módulo de ensamblado `my_team.py` (PROPUESTA: la arquitectura lista `fixtures.py` y la ruta pero no el módulo que arma la pantalla; la regla 3 prohíbe lógica en `app.py`) que calcula la ventana de la última semana, las variaciones bruscas y los accesos directos; (3) la completitud de la referencia `rival_proximo` en `phrases.game_plan`. El equipo fijado y los jugadores seguidos NO tienen endpoint propio: son preferencias (`ui · home_team`, `ui · followed_players`) por `PUT /api/prefs` de F-13. El frontend completa `views/mi-equipo.js` (cáscara de X-01), agrega la pestaña `calendario` a S1, dos controles reutilizables (fijar equipo, seguir jugador) y ajusta la resolución de la sección inicial del router. Cada bloque del payload se arma aislado: si uno falla, el resto responde (RF-25).

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/database.py` (mod.) | model | modelo `Fixture` (tabla `fixtures`) vía `create_all` | RF-7, RF-9, RF-11 |
| `backend/fixtures.py` | module **NUEVO** | `list_fixtures`, `next_fixture`, `get_fixture`, `create_fixture`, `update_fixture`, `delete_fixture`, `link_game_to_fixture`, `unlink_games`, `today_uy`, `fixture_dict` | RF-7, RF-9, RF-11, RF-12 |
| `backend/my_team.py` | module **NUEVO** (PROPUESTA) | `my_team_payload`, `alert_window`, `sudden_changes`, `last_games`, `top_lineups`, `followed_players_cards` | RF-3..RF-6, RF-15..RF-25 |
| `backend/phrases.py` (mod., de F-17) | module | `game_plan(..., reference="rival_proximo")`: resuelve el rival con `fixtures.next_fixture`; plantillas `cambio_brusco_mejora`/`cambio_brusco_empeora` en `backend/phrases/es.json` | RF-13, RF-17 |
| `backend/phrases/es.json` (mod., de F-17) | data | 2 plantillas nuevas de cambios bruscos | RF-17 |
| `backend/ingest.py` (mod.) | module | `persist_game` llama `fixtures.link_game_to_fixture(game_id)` tras escribir el partido | RF-11 |
| `backend/app.py` (mod.) | route | `GET /api/my-team`; `GET/POST /api/fixtures`; `PATCH/DELETE /api/fixtures/<int:fixture_id>`; `GET /api/game-plan` acepta `reference=rival_proximo`; `DELETE /api/games` llama `fixtures.unlink_games` | RF-6..RF-14, RF-25 |
| `backend/config.py` (mod., de F-13) | config | activa `alerts.lookback_days`, `alerts.change_z`; agrega `my_team.last_games`, `my_team.top_lineups`, `my_team.max_followed` (PROPUESTA) | RF-16, RF-17, RF-20..RF-22 |
| `backend/prefs.py` (de F-13) | module | sin cambios; se agrega `home_team` y `followed_players` a la lista blanca de claves del scope `ui` si F-13 la implementó | RF-1, RF-22 |
| `frontend/js/api.js` (mod.) | js-api | `myTeam`, `fixtures`, `createFixture`, `updateFixture`, `deleteFixture` | RF-3..RF-14 |
| `frontend/js/views/mi-equipo.js` (X-01, completa) | js-view | `renderMiEquipo`: cabecera, próximo partido, plan de juego, alertas, accesos directos; selector sin equipo; bloques aislados | RF-3..RF-6, RF-10, RF-12, RF-15..RF-26 |
| `frontend/js/components/my-team-controls.js` | component **NUEVO** (PROPUESTA) | `homeTeamButton(el, {teamCode})`, `followButton(el, {playerId})` (lógica de prefs y límite) | RF-1, RF-2, RF-22 |
| `frontend/js/components/fixtures-manager.js` | component **NUEVO** (PROPUESTA) | pestaña Calendario: tabla, formulario (admin), acciones Preparar/Importar | RF-7, RF-8, RF-14 |
| `frontend/js/views/datos.js` (X-01, mod.) | js-view | habilita y renderiza la pestaña `calendario` | RF-8 |
| `frontend/js/views/equipo.js` (X-01, mod.) | js-view | botón "Fijar como mi equipo" en la cabecera | RF-2 |
| `frontend/js/views/jugador.js` (X-01, mod.) | js-view | botón "Seguir" en la cabecera | RF-22 |
| `frontend/js/core/router.js` (X-01, mod.) | js-core | `initialSection()`: equipo fijado → `mi-equipo`; habilita S8 (`enabled: true`) | RF-3 |
| `frontend/js/components/game-plan.js` (F-17, mod. mínima) | component | ofrece `rival_proximo` solo si el payload trae `next_fixture` | RF-13, RF-15 |
| `frontend/css/style.css` (mod.) | css | sección `/* ── mi-equipo (F-12) ── */` | RF-26 |
| `frontend/sw.js` (mod.) | cache | si X-01 no migró a runtime caching: `STATIC` + los 2 componentes nuevos y bump de `CACHE` al siguiente entero | — |
| `docs/api.md`, `docs/database.md`, `docs/frontend.md`, `docs/architecture.md`, `docs/deployment.md` | doc | endpoints, tabla `fixtures`, vista S8, módulos, nota de `ADMIN_USERS` para el calendario | — (cierre) |

**Matriz RF → archivo:** RF-1 `my-team-controls.js`, `core/prefs.js`, `prefs.py` · RF-2 `my-team-controls.js`, `views/equipo.js`, `views/mi-equipo.js` · RF-3 `core/router.js` · RF-4 `my_team.py`, `app.py`, `mi-equipo.js` · RF-5 `my_team.py` (cabecera), `mi-equipo.js` · RF-6 `mi-equipo.js`, `my_team.py` · RF-7 `fixtures.py`, `database.py`, `app.py`, `fixtures-manager.js` · RF-8 `views/datos.js`, `fixtures-manager.js` · RF-9 `fixtures.py` · RF-10 `my_team.py`, `mi-equipo.js` · RF-11 `ingest.py`, `fixtures.py`, `app.py` (delete) · RF-12 `my_team.py`, `mi-equipo.js` · RF-13 `phrases.py`, `app.py`, `game-plan.js` · RF-14 `fixtures-manager.js`, `mi-equipo.js` · RF-15 `my_team.py`, `mi-equipo.js` (reusa `game-plan.js`, `collapsible.js`) · RF-16..RF-19 `my_team.py`, `phrases.py`, `config.py` · RF-20 `my_team.py` · RF-21 `my_team.py` (usa `lineups.all_lineups`) · RF-22/RF-23 `my_team.py`, `my-team-controls.js`, `mi-equipo.js` · RF-24 `core/format.js` (consumido) · RF-25 `my_team.py` (bloques aislados), `mi-equipo.js` · RF-26 `style.css`, `core/router.js`.

## 3. Backend — rutas y modelos

### 3.1 Tabla `fixtures` (NUEVA · `db.create_all()` en `init_db`, idempotente; no requiere `upgrade_db()`)
| Columna | Tipo | Default | Constraints |
|---|---|---|---|
| `id` | INTEGER | autoincremental | PRIMARY KEY |
| `competition_id` | INTEGER | NULL | sin FK dura (la competencia puede fusionarse; ver §10) |
| `date` | TEXT `YYYY-MM-DD` | — | NOT NULL; índice `ix_fixtures_date` |
| `time` | TEXT `HH:MM` | NULL | |
| `home_code` | TEXT | — | NOT NULL |
| `away_code` | TEXT | — | NOT NULL |
| `game_id` | TEXT | NULL | vinculado al importar |
| `source_url` | TEXT | NULL | enlace FIBA opcional (para importar cuando se juegue) |
| `notes` | TEXT | NULL | |
| `created_at` | TEXT ISO 8601 | — | |
| `created_by` | TEXT | NULL | usuario de sesión o `_open` |

Sin restricción única: un mismo cruce puede repetirse (ida y vuelta, otra fase). Se rechaza solo el duplicado exacto `(date, home_code, away_code)` por validación (409 `conflicto`) para evitar doble carga.

### 3.2 `GET /api/my-team` (NUEVO · `login_required`)
- Query: `team` (opcional; si falta se lee `ui · home_team` del usuario), `competition` (opcional, resuelta con `repository.resolve_competition`), `today` (opcional `YYYY-MM-DD`; PROPUESTA solo para verificación y pruebas; si falta, `fixtures.today_uy()`). **No acepta otros filtros de contexto**: S8 es "sin filtros" por diseño (RF-4); el eco `context` informa `applied: {}`.
- Errores: 400 `{"error": "Fecha inválida", "code": "parametro_invalido", "details": {"param": "today"}}`; 404 `{"error": "Equipo no encontrado", "code": "no_encontrado"}` si `team` no existe en la competencia resuelta.
- 200 sin equipo (ni parámetro ni preferencia): `{"team": null, "reason": "sin_equipo_fijado"}`.
- 200 completo (ejemplo; los bloques usan el patrón `{"value", "reason"}` de §7.4 cuando un valor no se puede calcular):
```json
{
  "team": {"code": "CNF", "name": "Nacional", "source": "pref"},
  "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "header": {
    "record": {"wins": 10, "losses": 4, "text": "10-4"},
    "avg_margin": {"value": 6.4, "reason": null},
    "games": 14, "games_total": 14,
    "sample": {"level": "alta", "unit": "partidos", "n": 14, "min": 3, "high": 10, "min_source": "absoluto", "ranked": true}
  },
  "next_fixture": {
    "fixture_id": 12, "date": "2026-10-09", "time": "21:00", "days_left": 5,
    "is_home": false, "rival": {"code": "PEN", "name": "Peñarol"},
    "competition_id": 3, "notes": null,
    "prepare_link": "#/partido/preparar?team=CNF&rival=PEN&fixture=12"
  },
  "next_fixture_reason": null,
  "game_plan": {"reference": {"type": "rival_proximo", "rival": "PEN"}, "advantages": [], "risks": [], "next_available": true},
  "alerts": {
    "window": {"days": 7, "from": "2026-09-27", "to": "2026-10-04", "games": 2, "sample": {"level": "baja", "unit": "partidos", "n": 2, "min": 3, "high": 10, "min_source": "absoluto", "ranked": false}},
    "insights": [{"metric": "efg_pct", "percentile": 92, "text": "Nacional está en el percentil 92 de eFG% de la competencia (56,1% frente a 52,4% de promedio)"}],
    "changes": [
      {"metric": "to_pct", "direction": "empeora", "week_value": 0.181, "rest_value": 0.131, "delta": 0.050,
       "z": -1.9, "games_week": 2, "games_rest": 12, "sample": {"level": "baja", "unit": "partidos", "n": 2, "ranked": false},
       "text": "Nacional: TO% en la última semana (18,1%) frente a 13,1% en el resto de la temporada"}
    ],
    "reason": null
  },
  "shortcuts": {
    "last_games": [{"game_id": "abc123", "date": "2026-10-02", "rival": {"code": "PEN", "name": "Peñarol"}, "is_home": true,
                    "score_own": 82, "score_rival": 77, "result": "G", "competition_id": 3, "link": "#/partido/abc123/analizar"}],
    "top_lineups": [{"lineup_id": "CNF:12-15-18-21-30", "names": ["Prieto", "Oglivie", "Feldeine", "Canty", "Rodríguez"],
                     "minutes": {"value": 118.4, "reason": null}, "possessions": {"value": 241.0, "reason": null}, "games": 12,
                     "net_rating": {"value": 0.121, "reason": null, "adj": {"value": 0.09, "band": 0.18}},
                     "sample": {"level": "alta", "unit": "posesiones", "n": 241.0},
                     "link": "#/equipo/CNF/quintetos?lineup=CNF:12-15-18-21-30"}],
    "followed_players": [{"player_id": 812, "name": "J. Pérez", "team_code": "CNF", "available": true,
                          "games": {"value": 14, "reason": null},
                          "recent": {"games": 5, "metrics": {"pts": {"value": 17.2, "reason": null}, "trb": {"value": 5.4, "reason": null},
                                     "ast": {"value": 3.1, "reason": null}, "ts_pct": {"value": 0.571, "reason": null}, "minutes": {"value": 28.3, "reason": null}}},
                          "link": "#/jugador/812"}],
    "followed_truncated": false
  },
  "blocks_failed": {},
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {}, "ignored": [], "level": "partido",
              "population_mode": "apply_all", "games_used": 14, "games_total": 14, "games_excluded": {}, "label": "Todos los partidos"}
}
```
- `blocks_failed`: `{ "<bloque>": {"code": "...", "error": "..."} }` cuando un bloque lanza excepción (se registra en el log); ese bloque queda `null` y el resto se sirve (RF-25). Bloques: `next_fixture`, `game_plan`, `alerts`, `last_games`, `top_lineups`, `followed_players`.
- `result`: `"G"` ganado, `"P"` perdido.

### 3.3 `GET /api/fixtures` · `POST` (A) · `PATCH`/`DELETE /<int:fixture_id>` (A) (NUEVOS)
- `GET /api/fixtures?competition=<id>&team=<code>&from=<YYYY-MM-DD>` (`login_required`; `team` y `from` son PROPUESTA menor sobre §6). 200:
```json
{"fixtures": [{"id": 12, "competition_id": 3, "competition_label": "Liga Uruguaya de Básquetbol 2025/2026",
  "date": "2026-10-09", "time": "21:00", "home_code": "PEN", "home_name": "Peñarol", "away_code": "CNF", "away_name": "Nacional",
  "game_id": null, "played": false, "source_url": null, "notes": null, "created_by": "nico", "created_at": "2026-10-01T10:00:00-03:00"}]}
```
Orden: fecha y hora ascendentes.
- `POST /api/fixtures` (A). Body `{date, time?, home_code, away_code, competition_id?, source_url?, notes?}` → 201 con la fila. Errores: 400 `parametro_invalido` ("Elegí la fecha del partido." / "Elegí dos equipos distintos." / "Equipo desconocido: importá al menos un partido de ese equipo antes de cargarlo en el calendario." con `details.team`), 400 `competencia_inexistente`, 409 `conflicto` ("Ya hay un partido cargado con esa fecha y esos equipos."), 403 `requiere_admin`.
- `PATCH /api/fixtures/<id>` (A): body parcial de los mismos campos más `game_id` (para vincular o desvincular a mano: `null` desvincula). 404 `no_encontrado`.
- `DELETE /api/fixtures/<id>` (A): `{"ok": true}`; 404 si no existe.
- Toda escritura llama `cache.bump_data_version("fixtures")` (Arq. §3.14) para invalidar `my_team`.

### 3.4 Tocados
- `GET /api/game-plan` (F-17): `reference` acepta `rival_proximo`; resuelve con `fixtures.next_fixture(team, today_uy())`. Sin próximo partido → 404 `{"error": "No hay un próximo partido cargado para este equipo", "code": "sin_proximo_partido"}`.
- `POST /api/import`: sin cambio de request/response; la vinculación ocurre dentro de `persist_game`.
- `DELETE /api/games`: antes de borrar, `fixtures.unlink_games(game_ids)`.
- Claves de `CONFIG_SPEC` (F-13): ver §4.8.

## 4. Backend — lógica

### 4.1 `backend/fixtures.py`
```
today_uy() -> str                        # (datetime.now(timezone.utc) + timedelta(hours=-3)).date().isoformat(); Uruguay sin horario de verano
list_fixtures(comp_id: int | None, team_code: str | None, *, date_from: str | None = None) -> list[dict]
    # Fixture.query con filtros; order_by(date, time NULLS LAST); fixture_dict agrega nombres (de TeamGameStats.team_name más reciente por código),
    # competition_label (competitions.list_competitions), played = game_id is not None
next_fixture(team_code: str, today: str) -> dict | None
    # filtra home_code == team o away_code == team, game_id IS NULL, date >= today; el primero por (date, time or "00:00", id)
get_fixture(fixture_id) -> Fixture | None
create_fixture(data: dict, *, user: str) -> dict          # validate_fixture + duplicado exacto → FixtureError(409)
update_fixture(fixture_id: int, data: dict) -> dict       # parcial; revalida; permite game_id
delete_fixture(fixture_id: int) -> None
link_game_to_fixture(game_id: str) -> int | None
unlink_games(game_ids: list[str]) -> int
FixtureError(Exception): message, status, code, details     # patrón de competitions.CompetitionError
```
**`validate_fixture(data)`**: fecha obligatoria y ISO válida (`date.fromisoformat`); hora opcional con regex `^([01]\d|2[0-3]):[0-5]\d$`; `home_code != away_code`; ambos códigos deben existir en `TeamGameStats.team_code` (si no → 400 con `details.team`); `competition_id`, si viene, debe existir (`competitions.list_competitions`); `source_url`, si viene, debe pasar `fiba_fetcher` (`_data_url` valida host permitido) — si no, 400 `parametro_invalido`.
**`link_game_to_fixture(game_id)`** (se llama después de escribir el partido, dentro de la misma transacción de `persist_game`, sin commit propio):
1. `g = Game` por `game_id`; si no tiene `date` válida → devuelve None (no hay con qué casar).
2. Candidatos: `Fixture` con `game_id IS NULL`, `home_code == g.home_code`, `away_code == g.away_code` y `abs(date − g.date) ≤ 1 día`.
3. Elige el de menor `abs(date − g.date)` y, a igualdad, el de menor `id`; setea `game_id`; devuelve su id. Si ya existe un fixture con ese `game_id` no hace nada (idempotente al reimportar o reprocesar).
**`unlink_games(game_ids)`**: `UPDATE fixtures SET game_id = NULL WHERE game_id IN (…)`; devuelve cantidad.
Nulos/casos borde: hora ausente se ordena como `00:00`; fecha futura lejana permitida; fecha pasada permitida (histórico).

### 4.2 `backend/my_team.py` (PROPUESTA de módulo)
```
my_team_payload(team_code: str, comp_id: int, today: str, *, lang: str = "es") -> dict
    # cacheado: cache.memo("my_team", (team_code, comp_id, today), fn, max_entries=32)  → clave prefijada con data_version/config_version (§3.14)
    ctx = context.parse_context({"competition": str(comp_id)}, team_code=team_code)     # sin last ni filtros
    blocks = {}
    for name, fn in (("next_fixture", ...), ("game_plan", ...), ("alerts", ...), ("last_games", ...), ("top_lineups", ...), ("followed_players", ...)):
        try: blocks[name] = fn()
        except Exception: log.exception(...); blocks[name] = None; failed[name] = {code: "error_interno", error: "..."}
    header = _header(team_code, comp_id, ctx)         # la cabecera NO es aislable: si falla, la ruta responde 500
```
**`_header`**: partidos del equipo en la competencia (`repository.competition_games(comp_id)` filtrados por equipo), `wins`/`losses` por marcador, `avg_margin = Σ(pts − opp_pts)/games` (nulo `sin_datos` si `games == 0`), `sample = sample.sample_level("team", n=games, unit="partidos", games=games)` (T-02). `games_total == games` (sin filtros).
**`_next_fixture`**: `f = fixtures.next_fixture(team, today)`. `None` → `next_fixture=None` y `next_fixture_reason = "sin_calendario"` si `fixtures.list_fixtures(None, None)` está vacío, o `"sin_proximos"` si hay calendario pero ninguno futuro del equipo. Con `f`: `days_left = (date.fromisoformat(f.date) − date.fromisoformat(today)).days`; `is_home = f.home_code == team`; `rival` = el otro código con su nombre; `prepare_link = "#/partido/preparar?team={team}&rival={rival}&fixture={id}"`.
**`_game_plan`**: `reference = "rival_proximo" if next_fixture else "competencia"`; `phrases.game_plan("team", team, reference=reference, rival=rival_code_or_None, comp_id=comp_id, ctx=ctx, mode="perfil")`. El payload agrega `next_available = next_fixture is not None` para que `game-plan.js` sepa si ofrecer `rival_proximo`.
**`alert_window(team_code, comp_id, today) -> dict`**: `days = config.get("alerts.lookback_days")`; `start = today − days`; partidos del equipo con `start ≤ date ≤ today` (fecha nula se excluye); `n = len(...)`; `games_week` = esos partidos (ids). `sample = sample.sample_level("team", n=n, unit="partidos", games=n)`.
**`_alerts`**:
1. `win = alert_window(...)`. Si `win.games == 0` → `{"window": win, "insights": [], "changes": [], "reason": "sin_partidos_en_ventana"}` (la UI muestra "No hubo partidos en los últimos N días.").
2. `insights = insights.insights("team", team_code, comp_id, ctx_n)` con `ctx_n = replace(ctx, last=n)` (A-10; renderiza `text` y, si vienen, `metric`/`percentile`; el módulo respeta `insights.low_pct/high_pct/min_items/max_items`). Si A-10 devuelve vacío → lista vacía.
3. `changes = sudden_changes(team_code, comp_id, win.games_ids)`.
**`sudden_changes(team_code, comp_id, week_game_ids) -> list[dict]`** (algoritmo, lista fija `ALERT_METRICS = ("oer","der","net_rating","efg_pct","ts_pct","ppt","to_pct","or_pct","dr_pct","ft_rate","ast_to")`; solo métricas con `direction` ∈ {higher, lower} en `metrics_catalog.METRICS`; PROPUESTA de la lista, fácil de ampliar):
```
rest = partidos del equipo en la competencia con game_id ∉ week_game_ids y date < start      # "el resto de la temporada" = anteriores a la ventana
si len(rest) < config.get("sample.team.min") → []                                              # sin base de comparación
b_week = _team_bundle(team, week_games)                                                        # StatBundle agrupado (pooled, DA-02)
v_week = stats_engine.compute_standard(b_week)                                                 # {clave: {value, reason}}
por_partido = [stats_engine.compute_standard(_team_bundle(team, [g])) for g in rest]           # un bundle por partido
para clave en ALERT_METRICS:
    xs = [v[clave].value for v in por_partido si v[clave].value no es None]
    si v_week[clave].value es None o len(xs) < sample.team.min: continuar                     # nulo nunca alerta (RF-18)
    mu = mean(xs); sd = stdev(xs) (muestral, n−1); si sd == 0: continuar
    s = +1 si direction == "higher" si no −1
    z = s * (v_week − mu) / sd
    si abs(z) >= config.get("alerts.change_z"): item {metric, direction: "mejora" si z > 0 si no "empeora",
        week_value, rest_value: mu, delta: v_week − mu, z: round(z, 2), games_week, games_rest: len(xs), sample (T-02 por partidos de la ventana),
        text: phrases.render("cambio_brusco_mejora"|"cambio_brusco_empeora", {entidad, metrica, valor, media, delta}, lang)}
ordenar por abs(z) desc; cortar a insights.max_items
```
`_team_bundle(team, games)` reutiliza el armado de `StatBundle` del loader `team` de T-05 (`metrics_catalog.register_entity("team", loader)`); la firma exacta de ese helper la fija `../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md`; si T-05 no lo expone con filtro por partidos, F-12 lo envuelve llamando al loader con un `Context` que acota los partidos (nunca duplica fórmulas: regla 4). Formato del texto: `valor`/`media` con el `fmt` del catálogo (como §3.15, "nunca números libres").
**`_last_games`**: partidos del equipo ordenados por fecha desc, `config.get("my_team.last_games")`; `result` por marcador; `link = "#/partido/<game_id>/analizar"` (S5 de F-07).
**`_top_lineups`**: `bundles = lineups.all_lineups(team, comp, ctx)`; para cada uno `values = stats_engine.compute_standard(b)`, `sample = sample.sample_level("lineup", n=posesiones, unit="posesiones", team_poss=...)` y, para `net_rating`, `sample.adjusted(...)` (T-02); orden por `minutes` desc (`b.seconds`/60), desempate por `possessions` y por `entity_id`; top `my_team.top_lineups`. Sin pbp → lista vacía con `reason: "sin_pbp"` (la UI muestra el vacío de §6). No excluye muestra baja (es un acceso directo, no un ranking): lleva su badge.
**`_followed_players`**: `ids = prefs.get_prefs("ui").get("followed_players", [])`, truncado a `config.get("my_team.max_followed")` (`followed_truncated` si hubo recorte). Para cada id: `identity.player_card(id)` (C-08, resuelve la cadena `merged_into`); si no existe → `{"player_id": id, "available": false, "reason": "no_encontrado"}`. Si existe: métricas recientes con `metrics_catalog` loader `player` (`EntityRequest(entity_type="player", entity_id=str(id), comp_id, ctx con last=5, base="partido")`), claves `pts, trb, ast, ts_pct, minutes`; el jugador puede ser de otro equipo: su competencia es la resuelta para su propio equipo (`repository.resolve_competition` por jugador).
Nulos (C-11): todo número va como `{value, reason}`; división por cero → razón `sin_datos`/`sin_intentos`; jugador sin partidos recientes → métricas `null` con `dnp` o `sin_datos`.
Caché: `cache.memo("my_team", (team_code, comp_id, today, lang), …)`; las preferencias (`followed_players`) se leen FUERA del memo (son por usuario) y se agregan al payload cacheado (no se mezclan datos de usuarios en caché).

### 4.3 `phrases.game_plan` — `rival_proximo`
En `reference` se agrega el caso `"rival_proximo"`: `f = fixtures.next_fixture(entity_id, fixtures.today_uy())`; si `f is None` → `PhrasesError(404, "sin_proximo_partido", "No hay un próximo partido cargado para este equipo")` (la ruta lo mapea a 404); si no, `rival = el otro código` y el cálculo sigue el camino de `reference="rival"` de F-17 sin más cambios. El payload agrega `reference.type == "rival_proximo"` y `reference.fixture_id`.

### 4.4 `ingest.persist_game` / borrado
Al final de `persist_game(game)` (antes del commit del llamador): `fixtures.link_game_to_fixture(game["game_id"])`. En la ruta `DELETE /api/games`: `fixtures.unlink_games(ids)` antes del borrado ORM. Reproceso (`reprocess_games`) vuelve a llamar `persist_game`, que es idempotente (sin cambio).

### 4.5 Claves de configuración (F-13)
| Clave | Tipo · default · rango | Sección | Acción de F-12 |
|---|---|---|---|
| `alerts.lookback_days` | int · 7 · 1–60 | Preferencias | pasa de `reservada` a `activa` |
| `alerts.change_z` | float · 1.5 · 0.5–4 | Preferencias | ídem |
| `my_team.last_games` | int · 5 · 1–20 | Preferencias | **PROPUESTA (no está en 00-arquitectura-transversal.md)** |
| `my_team.top_lineups` | int · 3 · 1–10 | Preferencias | PROPUESTA |
| `my_team.max_followed` | int · 12 · 1–50 | Preferencias | PROPUESTA |

## 5. Frontend — capa API (`api.js`)
```js
myTeam:        (p)        => apiFetch(`/api/my-team${qs(p)}`),                       // {team?, competition?, today?}
fixtures:      (p)        => apiFetch(`/api/fixtures${qs(p)}`),                      // {competition?, team?, from?}
createFixture: (body)     => send("/api/fixtures", "POST", body),
updateFixture: (id, body) => send(`/api/fixtures/${id}`, "PATCH", body),
deleteFixture: (id)       => send(`/api/fixtures/${id}`, "DELETE", {}),
```
`api.prefs`/`api.savePref` (F-13), `api.gamePlan` (F-17), `api.importGame` (existente) y `api.players` se reutilizan. Ninguna función de render llama `fetch` (regla 9).

## 6. Frontend — UI

**S8 (`views/mi-equipo.js`, `#/mi-equipo`)**, con `registerSection({slug:"mi-equipo", enabled: true})` y sin pestañas.
1. Resolución: `getPref("ui","home_team")` → si es nulo, `renderPicker`: `<select>` de `api.teams()` + botón "Fijar como mi equipo" (`setPref`) y el texto de §6 del spec.
2. Con equipo: `api.myTeam({})` (sin parámetros → el backend toma la preferencia; así el equipo fijado manda aunque el `localStorage` de otro dispositivo difiera). Render por bloques independientes con skeleton y `blocks_failed` → tarjeta de error con "Reintentar" (vuelve a pedir y repinta el bloque).
3. Cabecera: nombre, competencia, `record.text`, `avg_margin` (`fmtOrNull`), partidos, `sampleBadge(header.sample)` (T-02) y enlace "Cambiar equipo" (reabre el selector, sin perder el actual hasta confirmar).
4. Próximo partido: tarjeta con "Próximo partido · {rival} · {fecha} {hora} · Local/Visitante · faltan {n} días"; botón "Preparar partido" → `navigate("partido", {tab:"preparar", query:{team, rival, fixture}})`. Estados vacíos de §6 con enlace "Cargar calendario" (`#/datos/calendario`) solo si `is_admin`.
5. Plan de juego: `renderGamePlan(el, payload.game_plan, {panelId: "mi-equipo.plan"})` dentro de `collapsible(el, {panelId:"mi-equipo.plan", title:"Plan de juego"})` (X-01/F-17: estado en prefs `panel.collapsed`). El selector de referencia de `game-plan.js` pide `api.gamePlan({team, reference})`; `rival_proximo` solo se ofrece si `next_available`.
6. Alertas: dos listas ("Insights de la semana", "Cambios bruscos") con encabezado "Últimos {n} días · {games} partidos" y `sampleBadge`; cada cambio brusco muestra `texto`, valor de la semana, valor del resto, diferencia con signo y flecha (↑ mejora / ↓ empeora, color por sentido, no por percentil: la alerta no es una ficha).
7. Accesos directos: tres tarjetas (últimos partidos, quintetos más usados, jugadores seguidos). Jugadores: carrusel en móvil; selector "Seguir a un jugador" (lista de `api.players(homeTeam)` + buscador de `api.searchPlayers()` ya cargado) y "Dejar de seguir".
**Controles (`components/my-team-controls.js`)**: `homeTeamButton(el, {teamCode})` (alterna "Fijar como mi equipo" / "Es tu equipo ✓"); `followButton(el, {playerId})` lee `getPref("ui","followed_players",[])`, valida el máximo con `config`/payload (el límite llega en `GET /api/settings` o se aplica del lado servidor al truncar; el frontend lee `my_team.max_followed` de `api.settings()` una vez y lo cachea; si no puede, usa el servidor como fuente: el truncado se informa con `followed_truncated`), hace `setPref` optimista y toast de error si falla.
**Calendario (`components/fixtures-manager.js`, pestaña `calendario` de S1)**: tabla de partidos (fecha, hora, local, visitante, competencia, estado "Jugado/Pendiente"), filtro por equipo y por "Solo futuros"; acciones por fila: "Preparar" (abre Preparar con `fixture`), "Importar" (si hay `source_url` y no está jugado → `api.importGame(url)`, el vínculo lo hace el backend), y solo admin: editar/borrar y formulario "Agregar partido" (fecha, hora, local, visitante, competencia, enlace FIBA, notas). El rol sale de `/api/me.is_admin`.
**Ajuste del router (`core/router.js`)**: `initialSection()`: si `getPref("ui","home_team")` está definido y la sección S8 está habilitada → `mi-equipo`; si no, la regla de X-01 **sin** el atajo "S8 habilitada → mi-equipo" (ver §10). `loadPrefs("ui")` debe resolverse **antes** de calcular la sección inicial (en `boot()`); si falla, se usa la copia de `localStorage` y se reintenta luego.
Componentes compartidos reutilizados: `collapsible.js`, `tabs.js` (X-01), `game-plan.js` (F-17), `sample-badge.js` (T-02), `core/format.js` (`fmtOrNull`, `nullDisplay`), `core/prefs.js` (F-13), `data-table.js` NO (el calendario no es una tabla de métricas; ver §10). Estados loading/vacío/error/offline/éxito: tabla §6 del spec. Mobile 768 px: bloques apilados, carrusel de jugadores, formulario en una columna. Copy en español directo (DA-21 resuelta: sin `t()`); F-21 lo extrae.

## 7. Navegación
Habilita S8 (`#/mi-equipo`, sin pestañas, ⭐, prioridad móvil 1) y la pestaña `#/datos/calendario` (S1), ambas ya registradas con `enabled: false` por X-01. Actualiza `docs/frontend.md` (mapa de rutas, sección inicial). `#/partido/preparar?...&fixture=<id>`: el parámetro `fixture` ya figura en Arquitectura §3.12; F-03 solo exige `team` y `rival`, así que `fixture` es opcional (verificar que `views/partido.js` lo ignore sin error).

## 8. Contratos de datos
Shapes en §3.2 y §3.3. Filas SQLAlchemy: `Fixture(id, competition_id, date, time, home_code, away_code, game_id, source_url, notes, created_at, created_by)`. Preferencias: `ui.home_team` = `"CNF"` (string); `ui.followed_players` = `[812, 77]` (lista de enteros, orden = orden de seguimiento).

## 9. Manejo de errores y offline
| Código | Caso | Mensaje (español) |
|---|---|---|
| 400 `parametro_invalido` | fecha/equipos inválidos en el calendario; `today` inválido | "Elegí la fecha del partido." · "Elegí dos equipos distintos." · "Equipo desconocido: importá al menos un partido de ese equipo antes de cargarlo en el calendario." · "Fecha inválida" |
| 401 | sin sesión | handler global de `api.js` |
| 403 `requiere_admin` | escribir calendario sin ser admin | "Tu usuario no tiene permiso para esta acción." (copy existente de `auth.py`) |
| 404 `no_encontrado` | equipo o fixture inexistente | "Equipo no encontrado" · "Partido del calendario no encontrado" |
| 404 `sin_proximo_partido` | `rival_proximo` sin calendario | "No hay un próximo partido cargado para este equipo" |
| 409 `conflicto` | duplicado exacto | "Ya hay un partido cargado con esa fecha y esos equipos." |
Offline: `/api/*` siempre a red; S8 muestra "Sin conexión: Mi equipo necesita conexión." (los datos de S8 no se cachean). La preferencia `home_team` en `localStorage` permite abrir la cáscara de S8 offline. `sw.js`: si X-01 no migró a runtime caching, agregar `/js/components/my-team-controls.js` y `/js/components/fixtures-manager.js` a `STATIC` y subir `CACHE` al siguiente entero (el número se asigna al integrar, Arq. §3.13).

## 10. Riesgos y decisiones

- **D-1 (ajuste a X-01):** `initialSection()` de X-01 (RF-16) manda a S8 en cuanto está habilitada. Con F-12 eso llevaría a un usuario sin equipo fijado a una pantalla vacía; se condiciona a "equipo fijado" (decisión §9 del spec). Cambio mínimo en `core/router.js`; se actualiza `../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md` §6.1 punto 1 al integrar.
- **D-2 (PROPUESTA):** módulo `my_team.py`, claves `my_team.*`, parámetros `team`/`from` de `GET /api/fixtures`, `today` de `GET /api/my-team` y `reference=rival_proximo` en `/api/game-plan` no figuran en la arquitectura; se reportan como huecos. Justificación: regla 3 (rutas finas), F-13 ("ningún umbral fijo") y verificación sin esperar fechas reales.
- **D-3 (alertas):** la ventana "última semana" se traduce a `last = n`. Riesgo: con n = 1 o 2 los percentiles de A-10 se calculan con una población de "últimos 1–2 partidos de cada equipo", ruidosa. Mitigación: badge de muestra baja (T-02) visible en la ventana y en cada alerta; alternativa si el cliente la prefiere: calcular insights sobre toda la temporada y marcar los que cambiaron en la semana (más costosa; queda como [NEEDS CLARIFICATION] de §9 del spec solo si el cliente la pide).
- **D-4 (calendario como tabla propia, no de T-06):** T-06 aplica a tablas de métricas ("toda tabla … completa y exportable"); el calendario es un dato administrativo de pocas filas sin métricas. Si el cliente lo exige, se registra con `tables.register_table("fixtures", …)` sin cambiar el modelo.
- **D-5 (seguimiento por ficha):** `followed_players` guarda `player_id` (C-08). Al fusionarse dos fichas, `identity` resuelve la cadena; el id viejo sigue funcionando. Si se borra la ficha, se muestra "Jugador no disponible".
- **R-1:** sin partidos reales con fecha futura, el próximo partido solo se verifica cargando fixtures de prueba y con `?today=`; documentado en `tasks.md`.
- **R-2:** cálculo de cambios bruscos = N partidos × 11 métricas × `compute_standard`; con ≈35 partidos son ≈385 evaluaciones por equipo, sin I/O adicional (datos de `repository` ya cacheados). Objetivo `GET /api/my-team` < 1,5 s en caliente (§3.14); se mide y registra en `progress.md`.
- **R-3:** `fixtures.competition_id` sin FK: si se fusionan competencias (F-11), los fixtures quedarían apuntando a la fusionada. `competitions.merge_competitions` debería reasignarlos; PROPUESTA: tarea T-B9 lo agrega (UPDATE `fixtures SET competition_id = target WHERE competition_id = source`).
- **Desviaciones respecto de la arquitectura:** ninguna de contrato; solo las PROPUESTAS de D-2 y el ajuste D-1.
- **Dependencias técnicas:** `auth.admin_required`/`is_admin` y `cache.memo`/`bump_data_version`, `repository.competition_games`/`resolve_competition`, `competitions.*` ([F-11](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)); `config.get`, `prefs.py`, `core/prefs.js` ([F-13](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)); `identity.player_card` ([C-08](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)); `stats_engine.compute_standard`/`StatBundle`, `metrics_catalog.register_entity` ([T-05](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)); `population`/fichas ([T-01](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)); `sample.sample_level`/`adjusted` ([T-02](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)); `context.parse_context` ([C-02](../../fase-1-confiabilidad/11-C-02-promedios-de-liga/plan.md)); registro de secciones, `collapsible`, `tabs`, router ([X-01](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)); `lineups.all_lineups` ([F-06](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)); `phrases.game_plan`, `game-plan.js` ([F-17](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md)); `insights.insights` ([A-10](../10-A-10-insights-automaticos/plan.md)); modo Preparar y `views/partido.js` ([F-03](../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md)); enlace a Analizar ([F-07](../../fase-4-dia-de-partido/01-F-07-analizar-partido/plan.md)).
- **Incrementos diferidos que completa:** F-17 `rival_proximo` (RF-13), F-03 "Preparar desde el calendario" (RF-14), X-01 "S8 como inicio" (RF-3). Incremento diferido que deja: alertas sobre jugadores seguidos (→ ninguno planificado; fuera de alcance del spec).
- **Estimación:** L · 11–17 h (backend fixtures + my_team + alertas 5–7 h; frontend S8 + calendario + controles 4–6 h; router/prefs/ajustes y verificación manual 1–2 h; docs 1–2 h).
