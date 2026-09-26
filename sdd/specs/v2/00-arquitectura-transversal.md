# Arquitectura transversal — Smart-Basket v2

> **Documento vinculante** para los spec/plan/tasks de las 51 carpetas de `sdd/specs/v2/`.
> Autor: agente arquitecto · Fecha: 2026-09-23 · Estado: **Borrador (agente) — pendiente de revisión humana**.
> Fuentes: `00-especificacion-cliente-v2.md` (producto), `docs/*.md` (estado documentado), código de `backend/` y `frontend/`
> en la rama `main` (working tree) **y** en la rama `dev` (ver §1.0), specs `sdd/specs/03-*…11-*`, y 13 partidos reales
> de FIBA LiveStats (los de `SEED_URLS` en `backend/app.py`) inspeccionados en solo lectura (la base local `backend/basketball.db` está vacía).

---

## 0. Propósito y reglas de uso para los redactores

1. **Qué fija este documento.** Nombres de módulos, funciones y firmas públicas, endpoints, parámetros de query, claves de
   configuración, claves de métricas, enumeraciones, tablas y columnas, shapes JSON y componentes frontend compartidos.
   Todo redactor **usa estos nombres literalmente**. Si su requisito necesita algo que no está acá, lo marca como
   `PROPUESTA (no está en 00-arquitectura-transversal.md)` con justificación, y no lo usa como si existiera.
2. **Jerarquía de fuentes.**
   - Qué pide el cliente → `00-especificacion-cliente-v2.md` (fuente de verdad de producto para v2).
   - Cómo está hoy el sistema → `docs/` (fuente de verdad del estado actual; Constitución regla 1) + §1 de este documento.
   - Cómo se construye lo transversal → este documento.
   - Cómo se construye cada requisito → su `plan.md`, que **no** puede contradecir este documento.
   Cuando la especificación v2 contradice `docs/` (ej. fórmulas del glosario §6 vs `docs/metrics.md`), la contradicción está
   resuelta en §2 con una decisión; si la decisión cambia números visibles, lleva `[DECISIÓN HUMANA: DA-xx]` y el redactor
   **asume el default** indicado en §11 hasta que el humano decida. El requisito dueño actualiza `docs/` al cerrar.
3. **Un solo dueño por pieza.** Cada módulo, endpoint, tabla, clave de configuración y componente tiene **un** requisito
   dueño (§4, §5, §6, §8, §3.2). Otros requisitos pueden **agregar** campos o funciones declarados acá, pero no cambiar el
   contrato existente. Si un requisito necesita una pieza cuyo dueño va después en el orden, se aplica el tratamiento de §9.
4. **Marcas normalizadas** (usar exactamente así en los documentos):
   - `NUEVO` — endpoint, columna, tabla, módulo o componente que no existe hoy (regla de `sdd/02-plan.md`).
   - `[DECISIÓN HUMANA: DA-xx]` — la decisión la toma el humano; el documento sigue con el default de §11.
   - `PROPUESTA (no está en 00-arquitectura-transversal.md)` — hueco detectado por el redactor.
   - `INCREMENTO DIFERIDO (→ <ID>)` — parte del requisito que se completa cuando se implemente otro requisito posterior.
   - `[NEEDS CLARIFICATION: …]` — ambigüedad de producto no resuelta (proceso SDD, `sdd/01-specify.md`).
5. **Rama base.** Todo el diseño parte del supuesto de `[DECISIÓN HUMANA: DA-01]` (default: el Bloque C ya implementado en
   la rama `dev` se integra primero, dentro de C-11). Leer §1.0 antes que nada.

---

## 1. Estado actual verificado

### 1.0 Ramas: `main` (producción) vs `dev` (Bloque C ya implementado) — hallazgo crítico

- El working tree está en `main` (commit `2b5f14c`, "Merge dev into main (prod)"), limpio salvo `sdd/specs/v2/`.
- La rama `dev` (local y `origin/dev`) tiene **3 commits más** que `main`:
  - `0cc4de6` (2026-08-10) **"feat: Bloque C completo — correcciones C-01 a C-11"**: implementa las 11 correcciones de
    esta misma especificación v2 en 7 features SDD (`sdd/specs/12-nulos-orden-color-dnp` … `18-etiquetas-y-umbrales`,
    más `sdd/ROADMAP-bloque-C.md`), con 64/65 CA verificados y `docs/` actualizados. Toca `app.py`, `clutch.py`,
    `stats_engine.py`, `app.js`, `charts.js` y `docs/{api,database,frontend,metrics}.md`. **Sin cambios de esquema.**
  - `669250e` y `3c65008`: agregan `backend/venv/` (≈3.300 archivos, 740 mil líneas) y `package-lock.json`. **Basura: no
    se integra.** `.gitignore` no excluye `backend/venv/`.
- El `CLAUDE.md` local (ignorado por git) describe el estado de `dev` (`_cmpNullsLast`, `NOT_PCT`, `winCls`, umbral de
  cierres ≤10). Eso explica las discrepancias (a) y (b) que detectó el orquestador: en `main` el umbral es 15 y la UI dice
  `PeP`; en `dev` ya es 10 y `PtsEnPint`.
- **Qué implementa `dev` (resumen verificado con `git diff main dev`):**
  | Req. | Feature dev | Implementado en `dev` | Pendiente para v2 (lo que queda para la carpeta C-xx) |
  |---|---|---|---|
  | C-11 | 12 | `_cmpNullsLast(av,bv,dir)` único (Liga, Cierres, Buscador); `played(minutes)` (DNP fuera de promedios, campo `played` en `game_log`); `reb_share`/`uso_pct`/`win_pct` → `null`; `winCls` en Comparar; `charts.js` sin ceros falsos | Sentinels `ast_to`/`def_to_ratio` = 99.0 (DA-07); política de columnas nuevas con `NULL` (§3.1/§5); contrato "nulo con razón" (§7.4); DNP dibujado como 0 en evolución |
  | C-08 | 13 | `norm_name()` + `resolve_identity()` en `stats_engine.py`; unificación **al leer** por (equipo, nombre normalizado); competencia **fuera** de la clave (desviación D-1) | Identidad persistente `players` + `player_id` (§3.4); fusión manual; panel de duplicados (F-11) |
  | C-02 | 14 | Mapa `leagues` por competencia en `/api/team` y `/api/player`; `league_averages` devuelve `null` sin datos; se retiró el `↑ best` de `statBox`; `NOT_PCT` | Universo por `competition_id` (§3.1); definición final del promedio (DA-08); reemplazo por la ficha T-01 |
  | C-01 / C-04 | 15 | `as_pos`, `tov_pos`, `pts_pos`, `orb_min`, `drb_min`; OR%/DR%/TRB% individuales (fórmula por minutos); `season_ast_to()` (AS/PER acumulado) | Percentiles/umbrales (T-01/T-02); sentinel de `ast_to` por partido |
  | C-03 / C-07 | 16 | `zones[].ppt` y `zones[].efg` (se eliminó `pf`/`global_pf`); `summary.ppt`; `totals`; `ppt_2/ppt_3/ppt_ft`; `_shotDetailGrid()` | Tooltip de 7 datos (C-03), coordenadas reales (§1.6), PPT general según glosario (DA-03) |
  | C-09 / C-10 | 17 | `/api/league` con `wins/losses/table_points/pts_for/pts_against`; `_standingsCardHTML()`; flechas `→` en ejes X | Universo por competencia; desempate/puntos configurables (DA-31); etiqueta interna `↑ ${xName}` del scatter (sigue en `charts.js`, l.424 en `main` / l.428 en `dev`) |
  | C-05 / C-06 | 18 | `PeP`→`PtsEnPint`; `team_clutch(..., margin=10)`; título de Cierres leído de `margin` | C-05: `docs/database.md` (l.60 en `dev`) conserva "antes `PeP`" como nota y el CA pide búsqueda global sin resultados. C-06: umbral y ventana en configuración (F-13); prórrogas mal detectadas también en `dev` (§1.5 D-09) |

> **Consecuencia para los redactores de C-xx:** su `spec.md` es un **delta sobre el Bloque C de `dev`** (leer
> `git show dev:sdd/specs/<NN>/spec.md` y `progress.md`), no una reimplementación. La integración de `0cc4de6` es el
> **Grupo 0 de las tasks de C-11** (primera carpeta de la Fase 1). Todas las C-xx dependen de ese grupo.

### 1.1 Backend — módulos y funciones clave (`main`; delta `dev` indicado)

**`backend/app.py`** (1099 líneas; contiene lógica de negocio pese a la regla 3):
- Zonas de tiro: `_classify_zone` (l.79, legado sin uso), `_PAINT_KWORDS` (l.91), `ZONE_KEYS_11` (l.93), `ZONE_POINTS` (l.101),
  `_2PT_ZONES`/`_3PT_ZONES` (l.108), `_classify_zone_11(action_type, sub_type, x, y)` (l.114), `_zones_from_shots(rows)` (l.627).
- Persistencia: `_persist_game(game) -> list[dict]` (l.203–379): upsert `ON CONFLICT DO UPDATE` en `games`,
  `team_game_stats`, `player_game_stats`; **`on_conflict_do_nothing` en `shots` y `pbp_events`** (reimportar no actualiza
  esas filas). No guarda la URL de origen ni `games.minutes`.
- Helpers: `_to_dict`, `_opp_for(game_id, team_code)` (N+1 consultas), `_opp_dict`, `_team_pbp_games(team_code)` (l.835:
  `[{game_id, events, player_rows, opp_code, info:{date, home_away}}]`, todas las competencias).
- Rutas: ver §1.3. `team_stats` (l.409) promedia **tasas por partido** (`_avg` excluye `None`) y calcula `league` con
  `calc_team_stats` sobre **todos** los partidos de **todas** las competencias. `player_stats` (l.543) arma la población de
  liga con `calc_player_stats(pp, team_pos=0)` **sin equipo ni rival** (USO% siempre `None` en la liga) e incluye DNP.
  `league_overview` (l.947) `_avg` incluye `None` (riesgo de `TypeError`) y devuelve 0 si no hay datos.
  `search_players` (l.727) agrupa por nombre crudo. `team_players` (l.501) devuelve objetos, no strings.
- `dev`: agrega `leagues`, `totals`, `played`, `ast_to` acumulado, identidad normalizada, orden null-safe y tabla general.

**`backend/stats_engine.py`** (302 líneas en `main`):
- `_safe_div(num, den, default=None)` (l.7) → `round(num/den, 4)` o `None`. `_parse_minutes(s)` (l.19).
  `possessions(fga2, fga3, fta, orb, tov)` (l.32) = `2PA + 3PA + 0.44·FTA + TOV − OR`.
- `calc_team_stats(t, opp)` (l.37) devuelve **49 claves**: `possessions, plays, oer, der, net_rating, pace, efg_pct, ts_pct,
  fg2_pct, fg3_pct, ft_pct, ft_rate, ft_rate_report, pps, fg2_uso, fg3_uso, peso_1p, peso_2p, peso_3p, or_pct, dr_pct,
  trb_pct, to_pct, to_ratio, as_pct, ast_ratio, opp_efg_pct, opp_ts_pct, opp_to_pct, opp_ft_rate, stocks, def_playmaking,
  def_to_ratio, pts, fgm, fga, fgm2, fga2, fgm3, fga3, ftm, fta, orb, drb, trb, ast, tov, stl, blk, pf, opp_pts`.
  `pace` usa `t.get("minutes", 40)` y `t` nunca trae minutos → **siempre 40** (prórrogas mal). `def_to_ratio` = 99.0 si
  `tov == 0` (sentinel). `dev` agrega `ppt_2, ppt_3, ppt_ft`.
- `calc_player_stats(p, team_pos, team=None, game_minutes=40)` (l.176): `possessions, plays, oer, efg_pct, ts_pct, ft_rate,
  ft_rate_report, pps, ppp (=PTS/PLAYS), fg2_pct, fg3_pct, ft_pct, fg2_uso, fg3_uso, to_pct, to_ratio, as_pct (=AST/FGM
  propio, llega a >100%), ast_ratio, ast_to (99.0 si tov=0), peso_1p..3p, stocks, def_playmaking, def_to_ratio,
  physical_impact, uso_pct (plays jugador / plays equipo del partido completo), pts…pf`. `app.py` agrega `reb_share,
  oreb_share, dreb_share`. `dev` agrega `ppt_2/3/ft, as_pos, tov_pos, pts_pos, orb_min, drb_min, or_pct, dr_pct, trb_pct`
  (parámetro nuevo `opp`), y funciones `norm_name`, `resolve_identity`, `played`, `season_ast_to`.
- `league_averages(all_stats)` (l.273): `{clave: {avg, best}}` para 32 claves; `lower_is_better = {der, to_pct, to_ratio,
  opp_efg_pct, opp_ts_pct}`; sin datos → `{avg: 0, best: 0}` (`dev`: `None`; agrega claves C-01/C-07 y `tov_pos`).

**`backend/lineups.py`** (287 líneas): `PERIOD_LEN = {"REGULAR": 600, "OT": 300}` (l.12, **FIBA manda `OVERTIME`**, ver §1.5);
`_agg(evs, team_code)` (cuenta 2pt/3pt/FT/rebotes/ast/tov/stl/blk; **no** faltas ni tapones recibidos); `_sum_boxes`, `_pos`,
`_metrics(tb, ob)` (OER/DER/Net/eFG%/TS%); `game_starters(player_rows, team_code)` (5 con `starter=1` o `None`);
`build_segments(events, team_code, starters)` (l.77: tramos `{on_court, events, seconds}`; segundos exactos por período con
piso monótono); `_leaders`; `lineup_stats(games, team_code, players)` (3–5 jugadores, devuelve `games_used, games_excluded,
sample{possessions, seconds}, metrics{oer, der, net_rating, efg_pct, ts_pct}, raw{pts, pts_against, fga, fgm, fga3, fgm3,
fta, ftm, orb, drb, reb, ast, tov, stl, blk}, leaders`); `_side_metrics`; `onoff_stats(games, team_code, player_name)`
(`on/off{possessions, seconds, pts_for, pts_against, reb, orb, drb, ast, tov, stl, blk, oer, der, net_rating, efg_pct,
ts_pct}`, `diff` solo tasas). Agregación **pooled** (suma cajas, calcula la tasa una vez).

**`backend/clutch.py`** (193 líneas): `CLUTCH_SECS = 300`; `_is_clutch(ev, last_regular)` (l.12, OT si `period_type == "OT"`);
`_agg(evs)` (incluye `foul`/`foulon`); `_entry_margin(evs, last_reg)` (marcador al 5:00); `_box_metrics` (claves
`off_rating, def_rating, efg_pct, ts_pct, possessions`); `team_clutch(games, team_code, team_name, margin=15)` (l.109; `dev`:
`margin=10`) → `{team_code, team_name, margin, games_qualified, games_excluded, clutch_record "G-P-E", aggregate{pts_for,
pts_against, point_diff, reb, ast, tov, stl, blk, fouls_committed, fouls_drawn, off_rating, def_rating, efg_pct, ts_pct,
possessions}, per_game[…]}`.

**`backend/fiba_fetcher.py`** (499 líneas): `fetch_game_data(url)` (l.210) = `_data_url` → `_fetch_direct` (urllib, timeout 20 s)
→ fallback `_fetch_playwright` (no disponible en Render) → `_validate_raw` → `_parse_fiba_json(raw, url)` (l.246) →
`_validate_game` → `_fetch_page_info(url)` (scrapea fecha y `span#competitionName` de `bs.html`; timeout 10 s).
Dict normalizado: `{game_id, competition, date, teams[{team_code, team_name, is_home, pts, fgm2, fga2, fgm3, fga3, ftm, fta,
orb, drb, trb, ast, tov, stl, blk, pf, paint_pts, second_chance_pts, pts_from_tov, bench_pts, fast_break_pts, fgm, fga,
opp_pts, opp_fga2, opp_fga3, opp_fta, opp_orb, opp_drb, opp_tov, opp_pf}], players[{team_code, team_name, player_name
(= FIBA name/scoreboardName, ej. "A. Varela"), jersey, minutes "MM:SS", position, plus_minus, starter, pts…pf, fgm, fga}],
shots[{team_code, player_name, x, y, made, action_type, sub_type, period, action_number}], pbp[{team_code, player_name,
period, period_type, clock_secs, s1, s2, action_type, sub_type, success, action_number}], home_*, away_*}`.
El local es el primer equipo de `tm`. Los tiros se leen de **`raw["shot"]` (nivel raíz), que no existe** → siempre cae al
pbp con `x = y = 0` (l.379–427). Ver §1.6.

**Campos del JSON de FIBA disponibles pero NO persistidos** (verificado en 13 partidos):
| Nivel | Campos | Consumidores v2 |
|---|---|---|
| Equipo `tm[n]` | `shot[]` **con coordenadas `x`,`y`** (+`per`, `perType`, `actionNumber`, `subType`, `r`, `shirtNumber`); `p1_score…p4_score`, `ot_score`; `tot_sBlocksReceived`; `tot_sFoulsOn` (faltas recibidas); `tot_sReboundsTeam(Offensive/Defensive)`; `tot_sTurnoversTeam`; `tot_sMinutes` ("225:00" con prórroga); `tot_sTimeLeading`, `tot_sBiggestLead`, `tot_sBiggestScoringRun`, `tot_sLeadChanges`, `tot_sTimesScoresLevel`; `coach`, `scoring[]`, `lds` | C-03, T-05, F-04, F-07, F-11 |
| Jugador `pl[k]` | `sBlocksReceived`, `sFoulsOn`, `sPointsInThePaint`, `sPointsSecondChance`, `sPointsFastBreak`, `eff_1…eff_7`, `firstName`, `familyName`, `internationalFirstName/FamilyName`, `scoreboardName`, `photoT`/`photoS` (URL con hash estable cuando existe; falta en ~20% de las fichas), `active` | T-05, F-16, C-08 |
| Evento `pbp[i]` | `previousAction` (vínculo), `qualifier[]`, `clock` ("MM:SS:cc", centésimas solo en el último minuto), `lead`, `scoring`, `pno` | A-01…A-07, A-12, F-01 |
| No publicados | shot clock, ubicación de saques (banda/fondo), coordenadas de rebote, asignación defensiva, altura, nacimiento, nacionalidad | A-05 (derivar), A-02 (inferir), A-04 (nulo), F-03 (advertencia), F-16 (carga manual) |

Sí se persisten hoy: dorsal (`shirtNumber` → `jersey`), posición por partido (`playingPosition` → `position`), titular
(`starter`), +/- (`sPlusMinusPoints` → `plus_minus`) y el desglose de equipo (`paint_pts`, `second_chance_pts`, `pts_from_tov`,
`bench_pts`, `fast_break_pts`).

**`backend/database.py`**: modelos `Game`, `TeamGameStats`, `PlayerGameStats`, `Shot`, `PbpEvent` (cascade desde `Game`);
`init_db(app)` → `db.create_all()`; `upgrade_db(app)` (l.167) aplica `ALTER TABLE … ADD COLUMN` sobre una lista `new_cols`
ignorando errores (idempotente). `DB_PATH` desde env.

**`backend/auth.py`**: `load_users()`, `auth_enabled()`, `verify()`, rate-limit en memoria, `login_required`, `client_ip()`.
Sin roles. **`backend/test_auth.py`**: únicos tests automatizados (asserts planos).

**Despliegue**: `render.yaml` → `gunicorn app:app --timeout 180` (1 worker síncrono por defecto), disco 1 GB en `/data`,
Python 3.11. Plan Starter (512 MB RAM).

### 1.2 Esquema actual y `upgrade_db()`

| Tabla | Columnas | Restricción única |
|---|---|---|
| `games` | `id` PK, `game_id` TEXT NOT NULL, `competition` TEXT (string scrapeado, incluye temporada: "Liga Uruguaya de Basquetbol 2025/2026"), `date` TEXT `YYYY-MM-DD`, `home_team`, `home_code`, `away_team`, `away_code`, `home_score`, `away_score`, `minutes` INTEGER DEFAULT 40 (**nunca se escribe**), `imported_at` | `game_id` |
| `team_game_stats` | `id`, `game_id` FK, `team_code`, `team_name`, `is_home`, `pts`, `fgm/fga`, `fgm2/fga2`, `fgm3/fga3`, `ftm/fta`, `orb/drb/trb`, `ast`, `tov`, `stl`, `blk`, `pf`, `opp_pts`, `opp_fga2`, `opp_fga3`, `opp_fta`, `opp_orb`, `opp_drb`, `opp_tov`, `opp_pf`, `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts` (todas INTEGER DEFAULT 0) | `(game_id, team_code)` |
| `player_game_stats` | `id`, `game_id` FK, `team_code`, `team_name`, `player_name` (crudo), `jersey`, `minutes` "MM:SS", `position` DEFAULT '', `plus_minus` DEFAULT 0, `starter` DEFAULT 0, `pts…pf` DEFAULT 0 | `(game_id, team_code, player_name)` |
| `shots` | `id`, `game_id` FK, `team_code`, `player_name`, `x`, `y` (hoy siempre 0), `made`, `action_type` (2pt/3pt), `sub_type`, `period`, `action_number` | `(game_id, action_number)` |
| `pbp_events` | `id`, `game_id` FK, `team_code`, `player_name`, `period`, `period_type` (REGULAR/**OVERTIME**), `clock_secs` (restantes), `s1`, `s2`, `action_type`, `sub_type`, `success`, `action_number` | `(game_id, action_number)` |

No hay concepto de temporada ni de competencia como entidad (discrepancia (c) del orquestador, confirmada). Las columnas
agregadas con `DEFAULT 0` hacen indistinguible "no importado" de "cero" (anti-patrón C-11).

### 1.3 Endpoints actuales (`main`; todos con `login_required` salvo login/logout/me/`/`)

| Método | Ruta | Parámetros | Notas |
|---|---|---|---|
| POST | `/api/import` | body `{url}` | 400 URL/esquema, 502 FIBA |
| GET | `/api/games` | — | lista completa por fecha desc |
| DELETE | `/api/games` | body `{game_ids[]}` | cascada ORM |
| GET | `/api/teams` | — | `[{code, name, games}]` |
| GET | `/api/team/<team_code>` | — | `{team_code, team_name, games, record, averages, league, game_log[]}` (`dev`: `leagues`, `totals`) |
| GET | `/api/players/<team_code>` | — | `[{name, games, uso_pct, pts}]` (docs dice lista de strings) |
| GET | `/api/player/<team_code>/<player_name>` | — | `{player, team_code, team_name, games, averages, league, game_log[]}` |
| GET | `/api/shots/<team_code>/<player_name>` | — | `{zones{11}, total_shots, has_coordinates, summary{global_pf, efg_pct, ppp, games}}` (`dev`: `ppt`, `efg` por zona) |
| GET | `/api/shots/<team_code>` | — | agregado del equipo |
| GET | `/api/search/players` | — | una entrada por (equipo, nombre) |
| GET | `/api/pbp/<game_id>` | — | verificación del pbp |
| GET | `/api/lineup/<team_code>` | `players=A\|B\|C` (3–5 nombres) | 400/404 |
| GET | `/api/onoff/<team_code>/<player_name>` | — | + `usg_pct` |
| GET | `/api/clutch/<team_code>` | `margin` (default 15; `dev` 10) | |
| GET | `/api/competitions` | — | `["<string>", …]` |
| GET | `/api/league` | `competition=<string>` | lista de equipos + `stl` |
| POST | `/api/login` · `/api/logout` | | abiertas |
| GET | `/api/me` | | `{authenticated, user, auth_required, seed_enabled}` |
| POST | `/api/seed` | | dev (`SEED_ENABLED`) |

### 1.4 Frontend

- **Archivos**: `index.html` (carga `app.js` como `type="module"`, Chart.js local, hammerjs y chartjs-plugin-zoom desde
  jsDelivr), `js/app.js` (1873 líneas, monolítico), `js/api.js` (único lugar con `fetch`, `apiFetch` devuelve JSON, 401 →
  handler), `js/charts.js` (`drawRadar`, `drawCompareRadar`, `drawEvolution`, `drawPlayerEvolution`, `drawLeagueScatter`,
  `resetZoom`; `_norm` mapea `null → 0` en `main`), `css/style.css` (tokens `--bg … --blue`, breakpoints 480/768/1024,
  `.card`, `.stat-grid`, `.stat-box`, `.filter-pill`, `.search-table`, `.table-sticky`, `.onoff-table`, `.fiba-box`, `.modal`).
- **Navegación**: `sections = ["import","league","team","compare","player","search"]` (app.js l.181); `setSection(id)` solo
  muestra/oculta `div.section`. **No hay routing por hash** (no se lee ni escribe `location.hash`; no hay `hashchange`),
  aunque `docs/frontend.md` lo afirma. Barra inferior fija con 6 botones en móvil (<768 px), barra superior en desktop.
- **Helpers reutilizables existentes**: `toast`, `PCT`, `DEC2`, `statClass(value, avg, hib)`, `statBox(label, value, display,
  leagueKey, league, hib)` (heurística de % por substring; `main` muestra `Ø avg ↑ best`), `_computeAvg(gameLog)` (promedio
  simple de tasas por partido, recalcula `net_rating`), `_logComps`/`_filterByComp`/`_compOptions` (filtro por competencia),
  `_fourFactorsCard(av, name)`, `_recordCard`, `_fmtDate`, `_gamesTable`, `_filteredLog(gameLog, n)` (últimos N por fecha),
  shot chart SVG (`_shotChartSVG(zones, total, summary, hasCoordinates)` → `_shotChart11SVG` / `_shotChart3SVG`, `_scLbl`,
  `_scBadge`, `_courtLinesSVG`, constantes `SC_*`, `_scBoxFill` por umbrales fijos 1.00/0.85). **No existen** en `main`:
  `_cmpNullsLast`, `NOT_PCT`, `winCls` (existen en `dev`) ni `_colorCell` (no existe en ninguna rama, aunque lo citan
  `docs/frontend.md`, `CLAUDE.md` y la regla 9 de la Constitución).
- **Filtro por competencia**: Liga refetchea `api.league(comp)`; Equipo/Comparar/Jugador filtran el `game_log` en el cliente y
  recalculan con `_computeAvg`; los selects se ocultan con ≤1 competencia. **Últimos N**: pills "Todos · Últ. 5 · Últ. 3" en
  Equipo (visibles si `games > 3`), componen con la competencia; con filtro activo el récord se oculta.
- **Service worker**: `CACHE = "smart-basket-v9"`, `STATIC = ["/", "/manifest.json", "/css/style.css", "/js/app.js",
  "/js/api.js", "/js/charts.js", "/js/chart.umd.min.js"]`; `/api/*` siempre a red; resto cache-first **sin guardar**
  respuestas nuevas (un módulo nuevo que no esté en `STATIC` no funciona offline).
- El modal de borrado todavía pide un "token de administrador" en `localStorage` (resabio del `ADMIN_TOKEN` retirado).

### 1.5 Discrepancias docs/CLAUDE.md vs código (verificadas)

| # | Discrepancia | Impacto / dueño de la corrección |
|---|---|---|
| D-01 | `CLAUDE.md` describe `dev`; el working tree es `main` (umbral 15, `PeP`, sin `_cmpNullsLast`/`NOT_PCT`/`winCls`) | DA-01, C-11 Grupo 0 |
| D-02 | `dev` contiene `backend/venv/` y `package-lock.json` commiteados | C-11 Grupo 0: integrar solo `0cc4de6`; agregar `backend/venv/` a `.gitignore` |
| D-03 | `docs/frontend.md`: "navegación por `#hash`" — no existe routing por hash | X-01 |
| D-04 | `_colorCell(val, avg, invert)` citado en `docs/frontend.md`, `CLAUDE.md` y Constitución regla 9: no existe | T-01 crea `percentileColor` (§8); corregir docs al cerrar T-01 |
| D-05 | `docs/api.md`: `GET /api/players/<team>` devuelve strings; real: `[{name, games, uso_pct, pts}]` | C-08 |
| D-06 | `docs/architecture.md`/`api.md`/`frontend.md`: "FUBB no expone coordenadas de tiro" — **falso**: están en `tm[n].shot[]`; el parser lee `raw["shot"]` (inexistente) | F-11 (captura), C-03 (uso) — DA-32 |
| D-07 | `_classify_zone_11` asume media cancha normalizada; FIBA da cancha completa (x a lo largo, y a lo ancho, lados alternan al descanso) y la pintura no tiene límite de profundidad | C-03 (`shot_zones.py`) |
| D-08 | `games.minutes` nunca se completa → PACE sobreestimado en partidos con prórroga | F-11 (ingesta v2) |
| D-09 | **FIBA usa `periodType = "OVERTIME"` (con `period` reiniciado en 1)**; `clutch._is_clutch` y `lineups.PERIOD_LEN` esperan `"OT"` → las prórrogas **no entran** en Cierres y `build_segments` suma 300 s fantasma por prórroga; `docs/database.md` dice `REGULAR / OT` | C-06 (clutch), F-11 (constantes compartidas `PERIOD_TYPES`), F-06/F-04 |
| D-10 | `shots`/`pbp_events` con `on_conflict_do_nothing`: reimportar no actualiza | F-11 |
| D-11 | `_persist_game` (lógica de negocio) está en `app.py` (regla 3) | F-11 lo mueve a `ingest.py` |
| D-12 | Sentinels `ast_to`/`def_to_ratio` = 99.0 contaminan promedios (origen del "↑ 9900.0%") | C-11 (DA-07) |
| D-13 | `as_pct` de jugador = AST/FGM propio (>100%, origen del "↑ 1050.0%") | T-05 (DA-06) |
| D-14 | `statBox` de Equipo/Jugador compara conteos contra tasas (`TO` vs `to_ratio`, `AS` vs `ast_ratio`) y usa claves de liga inexistentes (`stl`, `blk`) | T-01 (la ficha reemplaza el bloque) |
| D-15 | `docs/metrics.md` PPT = PTS/FGA (incluye TL) vs glosario v2 (puntos de campo/TCi) vs PPT por zona (puntos de campo) | T-05/C-07 (DA-03) |
| D-16 | `docs/metrics.md` TO% (sobre plays) y USO% (plays del partido completo) vs glosario v2 (posesiones; "en cancha") | T-05 (DA-04, DA-05) |
| D-17 | Promedios de temporada = media de tasas por partido (equipo/jugador) vs lineups/on-off/clutch pooled vs AS/PER acumulado (`dev`) | T-05 (DA-02) |
| D-18 | `charts.js` `drawLeagueScatter` dibuja `↑ ${xName}` junto a la línea media del eje X (residuo de C-10 también en `dev`) | C-10 |
| D-19 | Modal de borrado pide token de admin en `localStorage` (backend ya no lo usa) | C-11 (limpieza UI) |
| D-20 | `docs/deployment.md` muestra `gunicorn app:app`; `render.yaml` usa `--timeout 180` | F-11 (al tocar deployment) |
| D-21 | `docs/architecture.md` "5 vistas"; hay 6 | X-01 |
| D-22 | Base local `backend/basketball.db` vacía: toda verificación exige importar (seed requiere login + `SEED_ENABLED`) | Riesgo R-05 |
| D-23 | `playingPosition` varía partido a partido para el mismo jugador (G/PG, F/PF, C/PF: 20 de las 125 fichas con más de un partido en los 13 partidos del seed) y falta en 18 filas jugador-partido — es un rol por partido, no un atributo | C-08 (DA-11) |
| D-24 | `sdd/README.md` pide carpetas `sdd/specs/NN-<feature>/`; v2 usa `sdd/specs/v2/fase-N-…/NN-<ID>-…/` | §10 declara la convención |

### 1.6 Play-by-play real de FIBA LiveStats (13 partidos, 7.163 eventos, 551/partido, 2 con prórroga)

**Tipos de evento (`action_type`) y subtipos:**
`substitution` 1272 (`in`/`out`) · `rebound` 1064 (`offensive`/`defensive`; 141 con calificador `team` y jugador vacío) ·
`2pt` 1045 (`layup, drivinglayup, reverselayup, tipinlayup, dunk, floatingjumpshot, jumpshot, pullupjumpshot, hookshot,
turnaroundjumpshot`) · `3pt` 724 (`jumpshot, pullupjumpshot`) · `freethrow` 565 (`1of1, 1of2, 2of2, 1of3, 2of3, 3of3`) ·
`foul` 545 (`personal, offensive, technical, benchTechnical, coachTechnical, unsportsmanlike, disqualifying`) · `foulon` 525 ·
`assist` 459 · `turnover` 382 (`badpass, ballhandling, offensive, travel, 24sec, outofbounds, backcourt, doubledribble, 5sec`) ·
`steal` 227 · `period` 108 (`start`/`end`) · `timeout` 99 (`full`) · `block` 73 · `jumpball` 47 (`startperiod, won, lost,
heldball`) · `game` 26 · `headcoachchallenge` 2.

**Calificadores (`qualifier[]`, hoy no persistidos):** `pointsinthepaint` 871 · `fromturnover` 454 · `2ndchance` 312 ·
`fastbreak` 240 · `2freethrow` 242 / `1freethrow` 66 / `3freethrow` 5 (en faltas: TL otorgados) · `shooting` 215 (falta en
acción de tiro) · `team` 141 · `blocked` 73 · `confirmed` 67 · `double` 2 · `rejected` 2.

**Vínculos (`previousAction`, hoy no persistido):** `assist → 2pt/3pt/freethrow` (459/459) · `rebound → 2pt/3pt/freethrow`
(tiro fallado) · `steal → turnover` (227/227) · `block → 2pt/3pt` · `foulon → foul` (525/525) · `turnover → foul` (falta en
ataque) · `jumpball → jumpball`.

**Qué permite reconstruir y qué no:**
| Necesidad | Disponible | Cómo |
|---|---|---|
| Asistencia → canasta (A-07, A-08, A-12) | Sí, exacto | `previous_action` del `assist` |
| Rebote → tiro fallado; tipo de tiro previo (A-04) | Sí | `previous_action` del `rebound` |
| Robo → pérdida; tipo de pérdida (A-02, A-05) | Sí | `previous_action` + `sub_type` de `turnover` |
| Falta → tiros libres; and-one; técnicas | Sí | secuencia `foul`(`shooting`,`NfreethrowS`) → `foulon` → `freethrow XofY` |
| Contraataque / segunda oportunidad / tras pérdida (clasificación de FIBA) | Sí (validación cruzada) | calificadores `fastbreak`, `2ndchance`, `fromturnover` |
| Tiempos muertos (F-07, A-02) | Sí | `timeout` |
| Saque de banda / de fondo | **No** (no hay evento de saque) | inferir por el evento previo (A-02, DA-29) |
| Shot clock | **No publicado** | derivar: reloj de partido al inicio de la posesión − reloj al tiro (resolución 1 s; centésimas solo en el último minuto) |
| Coordenadas de tiro | **Sí** en `tm[n].shot[]` (1.769 tiros = 100% de los tiros del pbp, unidos por `actionNumber`) | ver transformación abajo |
| Coordenadas / zona del rebote | **No** | A-04 "zona del rebote" → nulo con razón `no_registrado` |
| Asignación defensiva | **No** | F-03 lo advierte (coincidencia en cancha, no marcaje) |

**Geometría de coordenadas (verificada):** `x ∈ [0,100]` a lo largo de la cancha (28 m), `y ∈ [0,100]` a lo ancho (15 m); cada
equipo ataca un aro distinto por mitad. Transformación a media cancha: si `x ≤ 50` → `prof_m = x·0,28`, `lat_m = y·0,15`; si
`x > 50` → `prof_m = (100−x)·0,28`, `lat_m = (100−y)·0,15` (lateral visto desde el medio de la cancha mirando al aro).
Aro en `(lat 7,5 m, prof 1,575 m)`. Con esa transformación: tiros de 3 a mediana 7,49 m del aro (1 de 724 a menos de 6,4 m);
tiros de 2 a máximo 6,62 m; triples de esquina con `lat ≈ 0,5–0,7 m` o `≈ 14,4–14,6 m`. **Las coordenadas son confiables.**

**Prototipo de reconstrucción de posesiones** (≈100 líneas, fuera del repo, reglas de A-01 sin atributos): sobre 26
equipo-partido, total reconstruido 2.116 vs 2.104,8 por fórmula (**+0,53 %** agregado; por equipo-partido entre −1,3 % y
+3,3 %); puntos reconciliados con el box en 26/26; 7 posesiones con hueco (0,33 %). El criterio ≤2 % de A-01 es alcanzable
**sobre totales por equipo y competencia**, no partido a partido (DA-30).

Otros hechos: `tot_sReboundsOffensive` del equipo **incluye** los rebotes de equipo (jugadores + `ReboundsTeamOffensive`), igual
que el pbp; `tot_sTurnovers` incluye pérdidas de equipo. El salto inicial solo existe en el 1.er cuarto (FIBA: los demás
períodos arrancan con saque por posesión alterna).

---

## 2. Conciliación de métricas

### 2.1 Política de agregación (vale para todas las métricas)

- **Cociente de totales ("pooled")**: toda métrica de tasa sobre una selección de varios partidos/tramos se calcula como
  `Σnumerador / Σdenominador` de la selección, no como promedio de las tasas por partido. `[DECISIÓN HUMANA: DA-02]`
  (default: pooled). Es lo que ya hacen lineups, on/off, clutch y el AS/PER acumulado de `dev`, y es condición para que las
  cuatro bases de T-04 sean consistentes entre sí.
- **Conteos**: se suman; la base de T-04 los divide (por partido, por 40 min, por 100 posesiones).
- **Nulos (C-11)**: tasa con denominador 0 → `null` con razón; un `null` nunca entra en un numerador, denominador ni promedio.
  DNP no cuenta como partido jugado (`played(minutes)` de `dev`).
- **Serie partido a partido (`game_log`)**: sigue devolviendo la tasa de cada partido (para gráficos y tablas por partido).
- **Promedio de la competencia** (referencia de T-01, C-02, F-14, F-17): media aritmética de los valores de las entidades de la
  población de referencia (cada entidad con su valor pooled). `[DECISIÓN HUMANA: DA-08]`.
- **Prior de la regresión a la media** (T-02): PPP de la competencia pooled (`Σpts / Σposesiones` de todos los equipo-partido
  de la competencia en el contexto) para OER y DER; prior de Net Rating = 0.
- "Posesiones" según entidad y uso:
  - Equipo/quinteto/split/tramo: fórmula del glosario sobre los conteos propios (métrica `possessions` y denominador de PPP,
    TO%, AS/pos, RO/pos y de la base por 100).
  - Jugador, **volumen y base por 100**: posesiones del equipo con el jugador en cancha (exactas por segmentos de pbp; en
    partidos sin pbp se estiman por fracción de minutos `POS_equipo × min_jug / min_partido` y la métrica lleva
    `"estimated": true`).
  - Jugador, **denominador de PPP y TO%**: "posesiones terminadas por el jugador" = `PLAYS = TCi + 0,44·TLi + PER` (numerador
    del USO% del glosario).
  - Jugador, **OER individual y AS/pos**: `POS_jugador` (fórmula con −RO de `docs/metrics.md`), sin cambio.

### 2.2 Tabla de conciliación (glosario v2 §6 | `docs/metrics.md` | implementación | decisión)

| Métrica (clave) | Glosario v2 | docs/metrics.md | Implementación (`main` / `dev`) | ¿Conflicto? | Decisión |
|---|---|---|---|---|---|
| Posesiones `possessions` | T2i+T3i−RO+PER+0,44·TLi | igual | igual | No | Mantener. A-01 agrega `possessions_counted` |
| OER `oer` | Puntos / posesiones propias | PTS/POS | equipo: media de OER por partido; jugador: PTS/POS_jugador | Agregación | Pooled (DA-02). Jugador: individual (sin cambio) |
| DER `der` | Puntos recibidos / posesiones rival | igual | media por partido | Agregación | Pooled. Jugador: DER del equipo con el jugador en cancha (pbp) (DA-34) |
| Net Rating `net_rating` | OER − DER | igual | media por partido | Agregación | Pooled. Jugador: `on_oer − der` en cancha (DA-34) |
| eFG% `efg_pct` | (T2c+T3c+0,5·T3c)/(T2i+T3i) | (FGM+0,5·3PM)/FGA | igual | No (equivalentes) | Mantener, pooled |
| TS% `ts_pct` | Pts/(2·(T2i+T3i+0,44·TLi)) | igual | igual | No | Mantener, pooled |
| FG% `fg_pct` | — | — | no existe clave | Hueco | **NUEVA**: TCc/TCi |
| FG2% / FG3% / FT% | — | 2PM/2PA, 3PM/3PA, FTM/FTA | igual | No | Pooled |
| PPT `ppt` | Puntos desde tiros de campo / TCi | PTS/FGA (`pps`, incluye TL) | `pps`=PTS/FGA; zona: puntos de campo/intentos | **Sí** | `[DECISIÓN HUMANA: DA-03]` default: `ppt = (2·T2c+3·T3c)/TCi`; `pps` queda como clave legado hasta que T-05 migre las pantallas |
| PPT 2 / 3 / TL | — | `dev`: 2·2PM/2PA, 3·3PM/3PA, FTM/FTA | `dev` | No | Mantener (`ppt_2`, `ppt_3`, `ppt_ft`) |
| PPP `ppp` | Puntos / posesiones | PTS/PLAYS (jugador) | jugador PTS/PLAYS; equipo no existe; `summary.ppp` de tiros usa PLAYS también para equipo | Parcial | Equipo/quinteto/split: PTS/POS (= OER por definición). Jugador: PTS/PLAYS (sin cambio numérico). `summary.ppp` de equipo pasa a PTS/POS (C-03) |
| USO% `uso_pct` | Posesiones terminadas por el jugador / posesiones del equipo con el jugador en cancha | PLAYS_jug / PLAYS_equipo (partido completo) | igual a docs | **Sí** | `[DECISIÓN HUMANA: DA-05]` default: `PLAYS_jug × (min_equipo/5) / (min_jug × PLAYS_equipo)` (equipo en cancha por minutos), pooled |
| USO 2P / USO 3P `uso_2p` `uso_3p` | listadas en T-05, sin fórmula | — | — | Hueco | PROPUESTA del arquitecto: `T2i_jug×(min_eq/5)/(min_jug×T2i_eq)` (ídem T3i). Solo jugador; otras entidades `no_aplica` |
| Uso de triple / de 2 `fg3_uso` `fg2_uso` | T3i/TCi | 3PA/FGA, 2PA/FGA | igual | No | Mantener |
| FT Rate `ft_rate` | TLi/TCi | FTA/FGA | igual | No | Mantener |
| OR% / DR% `or_pct` `dr_pct` | RO/(RO+RD rival); RD/(RD+RO rival) | equipo igual; `dev`: jugador por minutos | `main`: jugador sin valor; `dev`: individual | Parcial | Equipo/quinteto: glosario. Jugador: fórmula individual de `dev` (equivalente "en cancha"). La UI rotula la escala (≈29 % equipo vs ≈4 % jugador) |
| REB% `trb_pct` | (T-05 "REB%") | TRB% | igual | Nombre | Clave `trb_pct`, etiqueta "REB%" |
| RO/pos `orb_pos` | T-05 | — | — | Hueco | **NUEVA**: RO / posesiones propias (jugador: RO / posesiones del equipo con él en cancha) |
| RO/min · RD/min `orb_min` `drb_min` | T-05 | `dev` | `dev` | No | Mantener; equipo: por minuto de partido |
| AS/PER `ast_to` | C-04: definir y unificar | `dev`: acumulado | `main`: media de ratios + 99.0; `dev`: ΣAST/ΣPER | Resuelto en `dev` | Pooled en equipo y jugador; `null` con razón `sin_perdidas` si ΣPER=0 (DA-07) |
| AS/pos `as_pos` | A-12 "asistencias sobre posesiones propias" | `dev` AST/POS_jugador | `dev` | No | Mantener; equipo/quinteto: AST/POS |
| AS% `as_pct` | T-05 "AS%" sin fórmula; A-12 "% de asistencias sobre el total del equipo" | AST/FGM (equipo) | jugador AST/FGM propio (bug) | **Sí** | Equipo/quinteto: AST/TCc. Jugador `[DECISIÓN HUMANA: DA-06]`: `AST / ((min_jug/(min_eq/5))·TCc_eq − TCc_jug)`. La cuota de A-12 es otra clave: `ast_team_share = AST_jug/AST_eq` |
| TO% `to_pct` | Pérdidas / posesiones | PER/(TCi+0,44·TLi+PER) | igual a docs | **Sí** | `[DECISIÓN HUMANA: DA-04]` default: equipo/quinteto `PER/POS`; jugador `PER/PLAYS` (sin cambio). `opp_to_pct` con el mismo criterio |
| PACE `pace` | Posesiones por 40 min | 40·((POS+POS_rival)/2)/MIN | MIN siempre 40 | Parcial | Mantener fórmula de docs con minutos reales (40 + 5 por prórroga, F-11); pooled; quinteto por segundos en cancha |
| Segundos por posesión `sec_per_poss` | T-05 Volumen | — | — | Hueco | **NUEVA**: `segundos_en_cancha / (POS + POS_rival)` (tempo). Con A-01: `off_poss_duration` = duración media de posesiones propias |
| Stops `stops` | T-05 | STL+BLK (clave `stocks`) | `stocks` | Nombre | Clave estándar `stops` = STL+BLK (docs); `stocks` alias legado |
| Tapones recibidos `blk_received` | T-05 | — | no persistido | Datos | **NUEVA** columna (F-11); quinteto: `block` vinculado a tiro propio |
| Faltas recibidas `fouls_drawn` | T-05 | `opp_pf` = faltas del rival | equipo `opp_pf`; jugador no | Datos | **NUEVA** columna (`tot_sFoulsOn`, `sFoulsOn`); quinteto: eventos `foulon` |
| +/- `plus_minus` | T-05 | columna FIBA | jugador box | No | Jugador: Σ`sPlusMinusPoints`. Equipo/quinteto/on-off: `pts − pts_against` |
| PTS recibidos `pts_against` | T-05 | `opp_pts` | equipo | No | Jugador: en cancha (pbp) |
| Partidos / minutos `games` `minutes` | T-05 | — | varía | — | Jugador: partidos jugados (sin DNP); quinteto: segundos/60 de tramos |
| Reparto por zona `paint_fga_share` `mid_fga_share` | T-05 "reparto por zona" | — | — | Hueco | **NUEVAS** (triples = `fg3_uso`); detalle de 11 zonas vía `/api/shot-zones` (C-03) |
| PtsEnPint `paint_pts` | PtsEnPint (antes PEP) | columna `paint_pts` | `dev` renombró la etiqueta | Resuelto (C-05) | Columna sin renombrar |
| Percentil | 0–100 en competencia/temporada | — | — | — | T-01 (§3.6) |
| Valor ajustado | (pos·valor + K·media)/(pos+K) | — | — | — | T-02 (§3.7): prior pooled; Net ajustado = OER_aj − DER_aj |
| Reloj de posesión, tramos, reset 14, transición, early, media cancha, origen, 2.ª oportunidad, putback, puntos por RO | glosario | — | — | — | A-01…A-05 (§3.9, claves de config §3.2) |
| Extras (no obligatorias en T-05) | — | `ft_rate_report`, `to_ratio`, `ast_ratio`, `peso_1p/2p/3p`, `opp_efg_pct`, `opp_ts_pct`, `opp_to_pct`, `opp_ft_rate`, `def_playmaking`, `def_to_ratio`, `physical_impact`, `reb_share/oreb_share/dreb_share`, `tov_pos`, `pts_pos`, `plays`, desglose FIBA | existen | No | Se conservan en el catálogo, grupo `extra`. `def_to_ratio` pooled y `null` si ΣPER=0 |

### 2.3 Conjunto estándar T-05 — calculabilidad hoy

Fuente: `box` = `team_game_stats`/`player_game_stats`; `pbp` = requiere `pbp_events` del partido; `col-v2` = requiere columna
nueva de la ingesta v2 (F-11) y reproceso; `A-01` = requiere el motor de posesiones. Fórmulas exactas en §3.5.

| Grupo | Métricas | Equipo | Jugador | Quinteto / ON-OFF / cuarto / cierre / split |
|---|---|---|---|---|
| Volumen | games, minutes, possessions, pace, sec_per_poss | box | box (pace: pbp) | pbp |
| Producción | pts, pts_against, ppp, oer, der, net_rating, plus_minus | box | box (pts_against, der, net_rating: pbp) | pbp |
| Tiro — intentos y aciertos | fga2, fgm2, fga3, fgm3, fta, ftm, fga, fgm | box | box | pbp |
| Tiro — porcentajes | fg_pct, fg2_pct, fg3_pct, ft_pct, efg_pct, ts_pct | box | box | pbp |
| Tiro — valor | ppt, ppt_2, ppt_3, ppt_ft | box | box | pbp |
| Tiro — perfil | fg3_uso, fg2_uso, ft_rate, paint_fga_share, mid_fga_share | box + shots | box + shots | pbp (calificador `pointsinthepaint`: col-v2) |
| Balón | ast, tov, ast_to, as_pos, as_pct, to_pct | box | box | pbp |
| Rebote | orb, drb, trb, or_pct, dr_pct, trb_pct, orb_pos, drb_min, orb_min | box | box (orb_pos: pbp o estimación) | pbp |
| Defensa | stl, blk, blk_received, stops (+pts_against) | box (+col-v2) | box (+col-v2) | pbp (`block`→tiro: col-v2 `previous_action`) |
| Faltas | pf, fouls_drawn | box (+col-v2) | box (+col-v2) | pbp (`foul`/`foulon`) |
| Uso e impacto | uso_pct, uso_2p, uso_3p | no aplica | box | no aplica |

---

## 3. Decisiones transversales

### 3.1 Competencia y temporada como universo de cálculo (dueño: F-11)

**Decisión.**
- Nueva tabla `competitions` (id, `name`, `season`, `status`, `is_default`) y tabla `competition_aliases(source_name → competition_id)`.
  Una fila de `competitions` = una competencia **en una temporada** ("Liga Uruguaya de Básquetbol" + "2025/2026"): es el
  **universo de cálculo** de percentiles, promedios, líderes y rankings.
- `games.competition_id` (NUEVO, nullable). `games.competition` (TEXT) se conserva intacto como el string crudo scrapeado
  (Constitución 5: nada destructivo).
- Al importar: `competitions.ensure_competition_for_source(source_name)` busca el alias; si no existe crea la competencia
  (`name` = string sin el sufijo de temporada, `season` = sufijo detectado con la regex `(\d{4}(?:\s*[/-]\s*\d{2,4})?)\s*$`,
  o `NULL`) y el alias. Backfill idempotente en `upgrade_db()` para los partidos existentes (`WHERE competition_id IS NULL`).
- Edición en S1 (F-11): renombrar, fijar temporada, marcar por defecto, fusionar dos competencias (reasigna partidos y
  alias), reasignar un partido, cambiar `status` ∈ {`publicada`, `borrador`, `archivada`} (default `publicada`,
  `[DECISIÓN HUMANA: DA-13]`; `borrador` oculta la competencia fuera de S1).
- **Resolución de la competencia de una petición** (`repository.resolve_competition`), en este orden: parámetro
  `competition=<id>` → `competition=all` (sin universo: solo listados; percentiles `null` con razón `sin_universo`) →
  string no numérico (compatibilidad: se resuelve por alias) → competencia más reciente **de la entidad** consultada (equipo,
  jugador) → `ui.default_competition_id` (config) → competencia con el partido más reciente. `[DECISIÓN HUMANA: DA-14]`.
- `GET /api/competitions` cambia a objetos (§6); F-11 migra los 4 selects existentes (Liga, Equipo, Comparar, Jugador) a ids.

**Descartadas.** (a) Seguir usando `games.competition` TEXT como clave: no permite renombrar ni fusionar variantes del
nombre scrapeado. (b) FK obligatoria con migración: rompe la regla 5. (c) Temporada como tabla aparte: la temporada solo
existe asociada a una competencia en estos datos; sobra una tabla.

**Constitución.** Tablas nuevas vía modelo + `create_all`; columna nueva vía `upgrade_db()`; backfill idempotente solo sobre
`NULL`; sin tocar restricciones únicas. Consumidores: C-02, C-09, C-08, T-01, T-03, F-14, F-19.

### 3.2 Configuración (dueño: F-13)

**Almacenamiento.** Tabla `app_config(key TEXT PK, value TEXT JSON, updated_at, updated_by)`; solo guarda las claves
modificadas. El catálogo completo (default, tipo, rango, etiqueta, sección de S9, consumidor) vive en código en
`backend/config.py` → `CONFIG_SPEC`. **Ningún umbral queda fijo en el código**: el código lee siempre `config.get(clave)`.

**API de lectura (firma):** `config.get(key: str) -> Any` (valor tipado; override de DB o default), `config.get_many(prefix:
str) -> dict`, `config.set_values(values: dict, *, user: str | None) -> dict` (valida tipo/rango; incrementa
`config_version`), `config.reset(keys: list[str]) -> dict`, `config.spec_json() -> list[dict]`. Lectura cacheada por
`config_version` (§3.14). Endpoints en §6.

**Extensión.** F-13 crea `config.py` e incluye las claves de fase 1 (y las de C-06/C-09, que migra desde constantes). Cada
requisito posterior **agrega sus claves a `CONFIG_SPEC` con exactamente el nombre y default de esta tabla**; la UI de S9 se
genera desde `spec_json()` (las claves nuevas aparecen solas en su sección).

**Catálogo completo de claves** (tipo · default · rango · sección S9 · consumidor · dueño que la agrega):

| Clave | Tipo | Default | Rango | Sección | Consumidor | Agrega |
|---|---|---|---|---|---|---|
| `sample.lineup.min` | int (pos) | 15 | 1–500 | Umbrales | T-02, T-01, F-06, F-09, F-10, F-15 | F-13 |
| `sample.lineup.high` | int (pos) | 40 | 1–2000 | Umbrales | T-02 | F-13 |
| `sample.lineup.rel_pct` | float % o null | 1.5 | 0–20 | Umbrales | T-02 | F-13 |
| `sample.pair.min` / `.high` / `.rel_pct` | int/int/float·null | 30 / 80 / null | | Umbrales | T-02, A-08 | F-13 |
| `sample.onoff.min` / `.high` / `.rel_pct` | int (pos por estado) | 40 / 120 / null | | Umbrales | T-02, F-06 | F-13 |
| `sample.matchup.min` / `.high` / `.rel_pct` | int (pos) | 8 / 25 / null | | Umbrales | T-02, F-07, F-03 | F-13 |
| `sample.split.min` / `.high` / `.rel_pct` | int (pos) | 15 / 40 / null | | Umbrales | T-02, T-03, F-04, A-02…A-06 | F-13 |
| `sample.clock_zone.min` / `.high` | int (intentos) | 10 / 30 | | Umbrales | T-02, C-03, A-05 | F-13 |
| `sample.clutch_lineup.min_poss` | int (pos del tramo por partido) | 2 | 1–20 | Umbrales | F-06 | F-13 |
| `sample.clutch_lineup.high_games` | int (partidos cerrados) | 3 | 1–20 | Umbrales | F-06 | F-13 |
| `sample.player.min` / `.high` | int (min) | 60 / 200 | | Umbrales | T-01 (población), T-02 | F-13 |
| `sample.team.min` / `.high` | int (partidos) | 3 / 10 | | Umbrales | T-01 (población), T-02 | F-13 |
| `sample.relative_enabled` | bool | true | | Umbrales | T-02 (DA-15) | F-13 |
| `regression.lineup.k` | int | 25 | 0–500 | Umbrales | T-02 | F-13 |
| `regression.onoff.k` | int | 50 | 0–500 | Umbrales | T-02 | F-13 |
| `regression.split.k` | int | 20 | 0–500 | Umbrales | T-02 | F-13 |
| `regression.pair.k` · `regression.matchup.k` · `regression.clutch_lineup.k` | int | 25 · 25 · 25 (DA-16) | 0–500 | Umbrales | T-02 | F-13 |
| `sample.ppp_sd` | float | 1.15 (DA-16) | 0.5–2 | Umbrales | T-02 (banda) | F-13 |
| `sample.band_z` | float | 1.96 | 1–3 | Umbrales | T-02 | F-13 |
| `population.min_size` | int | 3 | 2–20 | Umbrales | T-01 (mínimo de entidades para percentil) | F-13 |
| `clutch.margin` | int (pts) | 10 | 0–40 | Reglas de contexto | C-06, F-06, A-06 | F-13 |
| `clutch.window_secs` | int (s) | 300 | 60–600 | Reglas de contexto | C-06, F-04 ("últimos 5 minutos"), F-06 | F-13 |
| `standings.win_points` / `standings.loss_points` | int | 2 / 1 | 0–5 | Preferencias | C-09 (DA-31) | F-13 |
| `standings.tiebreak` | enum `diferencia` \| `ninguno` | `diferencia` | | Preferencias | C-09 | F-13 |
| `ui.default_base` | enum `total`\|`partido`\|`por40`\|`por100` | `partido` | | Preferencias | T-04 | F-13 |
| `ui.default_competition_id` | int o null | null (= automática, DA-14) | | Preferencias | F-11, T-03 | F-13 |
| `ui.metric_labels` | json `{clave: etiqueta}` | `{}` | | Preferencias | T-05 (catálogo) | F-13 |
| `table.page_size` | int | 50 | 10–500 | Preferencias | T-06 | T-06 |
| `export.csv_separator` | enum `;` \| `,` | `;` (DA-20) | | Preferencias | T-06 | T-06 |
| `context.close_margin` | int (pts) | 10 | 1–40 | Reglas de contexto | T-03 (`score`), A-06 | T-03 |
| `transition.max_secs` | int (s) | 7 | 3–12 | Reglas de contexto | A-03 | A-03 |
| `early_offense.max_secs` | int (s) | 12 | 8–20 | Reglas de contexto | A-03 | A-03 |
| `oreb.putback_secs` | int (s) | 3 | 1–6 | Reglas de contexto | A-04 | A-04 |
| `oreb.kickout_secs` | int (s) | 6 | 2–10 | Reglas de contexto | A-04 | A-04 |
| `clock.early_max` | int (s) | 8 | 4–12 | Reglas de contexto | A-05 | A-05 |
| `clock.mid_max` | int (s) | 16 | 10–20 | Reglas de contexto | A-05 | A-05 |
| `clock.reset_secs` | int (s) | 14 | 10–24 | Reglas de contexto | A-01, A-05 | A-01 |
| `momentum.last_possessions` | int | 10 | 3–30 | Reglas de Momentum | F-02 | F-02 |
| `momentum.window_secs` | int (s) | 300 | 60–600 | Reglas de Momentum | F-02 | F-02 |
| `momentum.last_outcomes` | int | 5 | 3–10 | Reglas de Momentum | F-02 | F-02 |
| `momentum.hot_consecutive_makes` | int | 3 | 2–10 | Reglas de Momentum | F-02 | F-02 |
| `momentum.hot_points` / `momentum.hot_points_window_secs` | int / int (s) | 8 / 180 | | Reglas de Momentum | F-02 | F-02 |
| `momentum.assist_streak` | int | 4 | 2–10 | Reglas de Momentum | F-02 | F-02 |
| `momentum.oreb_in_quarter` | int | 3 | 2–10 | Reglas de Momentum | F-02 | F-02 |
| `momentum.cold_consecutive_tov` | int | 3 | 2–10 | Reglas de Momentum | F-02 | F-02 |
| `live.poll_secs` | int (s) | 30 | 10–60 | Preferencias | F-01 (cliente) | F-01 |
| `live.cache_ttl_secs` | int (s) | 15 | 5–60 | Preferencias | F-01 (servidor) | F-01 |
| `live.fetch_timeout_secs` | int (s) | 8 | 3–20 | Preferencias | F-01 | F-01 |
| `leaders.min_minutes` | int (min) | 60 | 0–2000 | Preferencias | F-14 | F-14 |
| `leaders.top_n` | int | 10 | 3–50 | Preferencias | F-14 | F-14 |
| `gameplan.items_min` / `gameplan.items_max` | int | 3 / 5 | 1–10 | Preferencias | F-17, F-03 | F-17 |
| `gameplan.min_z` | float | 0.5 (PROPUESTA) | 0–3 | Preferencias | F-17, F-03 | F-17 |
| `insights.low_pct` / `insights.high_pct` | int | 10 / 90 | 0–100 | Preferencias | A-10 | A-10 |
| `insights.min_items` / `insights.max_items` | int | 3 / 5 | 1–10 | Preferencias | A-10 | A-10 |
| `alerts.lookback_days` | int | 7 | 1–60 | Preferencias | F-12 | F-12 |
| `alerts.change_z` | float | 1.5 (PROPUESTA) | 0.5–4 | Preferencias | F-12 | F-12 |
| `trends.default_ma` | enum 3\|5\|10 | 5 | | Preferencias | F-18 | F-18 |
| `trends.last_n` | int | 5 | 2–20 | Preferencias | F-18 | F-18 |
| `similar.top_n` | int | 10 | 3–50 | Preferencias | A-09 | A-09 |
| `rapm.lambdas` | json lista | `[500,1000,2000,4000,8000]` | | Umbrales | A-11 | A-11 |
| `rapm.folds` | int | 5 | 2–10 | Umbrales | A-11 | A-11 |
| `ai.suggestions_enabled` | bool | true | | Preferencias | F-15 (visible solo si el entorno tiene LLM) | F-15 |
| `ui.default_language` | enum `es`\|`en`\|`pt` | `es` | | Preferencias | F-21 | F-21 |

**Invalidación de cachés.** `config.set_values`/`reset` incrementan `app_meta.config_version`; todas las claves de caché
incluyen esa versión (§3.14), así que el cambio "se refleja inmediatamente" en la próxima petición de cualquier worker. El
frontend recarga la vista activa tras guardar.

**Permisos.** Escribir configuración exige `admin_required` (§3.21).

**Descartadas.** Archivo JSON/YAML en disco (no editable desde la UI; en dev el disco es efímero); variables de entorno
(requieren redeploy y no las edita el entrenador). **Constitución.** Tabla nueva vía `create_all`; lógica en `config.py` (regla
3), rutas finas; sin dependencias nuevas.

### 3.3 Preferencias por usuario (dueño: F-13)

**Decisión.** Tabla `user_prefs(owner TEXT, scope TEXT, key TEXT, value TEXT JSON, updated_at, PK(owner, scope, key))`.
`owner` = `session["user"]` cuando hay auth; `"_open"` en modo abierto (local sin `AUTH_USERS`). **No es una tabla de
usuarios**: no guarda credenciales, perfiles ni lista de usuarios; los usuarios siguen definidos solo en `AUTH_USERS`.
`[DECISIÓN HUMANA: DA-17]` (default: sí). `backend/prefs.py`: `current_owner() -> str`, `get_prefs(scope: str) -> dict`,
`set_pref(scope, key, value) -> None`, `delete_pref(scope, key) -> None`. Frontend `core/prefs.js` con copia en
`localStorage` para arranque rápido (siempre con fallback si `localStorage` falla).

**Scopes fijados:**
| scope | key | valor | Dueño del uso |
|---|---|---|---|
| `table.columns` | `<table_id>` | lista de claves visibles | T-06 |
| `table.sort` | `<table_id>` | `{key, dir}` | T-06 |
| `table.colorize` | `<table_id>` | bool | T-06 |
| `panel.collapsed` | `<panel_id>` | bool | X-01 (componente) / F-17 (panel Plan de juego) |
| `ui` | `language` | `es`\|`en`\|`pt` | F-21 |
| `ui` | `home_team` | team_code | F-12 |
| `ui` | `followed_players` | lista de `player_id` | F-12 |
| `ui` | `last_competition` | competition_id | T-03 |

La base de normalización (T-04) se mantiene **por sesión** (`sessionStorage` + URL), con default global `ui.default_base`.
Las consultas guardadas de F-10 van en su propia tabla (`saved_queries`, §5), con `owner`.

**Descartadas.** Solo `localStorage` (no cumple "recordada por usuario" entre dispositivos); guardar en `app_config` (es global).
**Constitución.** Regla 6: la identidad sigue saliendo de la sesión gateada por `AUTH_USERS`; `user_prefs` no guarda
credenciales ni define usuarios (DA-17).

### 3.4 Identidad de jugador (dueño: C-08; extiende F-16)

**Decisión.**
- Tabla `players` (NUEVA): `id` PK, `team_code`, `norm_key` (= `norm_name(player_name)` de `dev`: minúsculas, sin
  diacríticos, espacios colapsados), `display_name` (grafía de la ficha más reciente), `first_name`, `family_name`,
  `photo_url`, `merged_into` (FK a `players.id`, fusión manual), `created_at`; `UNIQUE(team_code, norm_key)`.
- `player_game_stats.player_id` (NUEVO, nullable) completado al importar (`identity.resolve_player_id`) y por backfill
  idempotente. La restricción única existente `(game_id, team_code, player_name)` no se toca.
- **Clave de identidad = (equipo, nombre normalizado)**; la competencia **no** forma parte de la clave (es un filtro): se
  mantiene la desviación D-1 de `dev` porque agregarla parte a un jugador en dos fichas y contradice el CA de C-08.
  `[DECISIÓN HUMANA: DA-10]`.
- Fusión manual (mismo equipo): `POST /api/identity/merge` marca `merged_into`; toda resolución sigue la cadena.
- Posición de la ficha = valor FIBA no vacío más frecuente (desempate: más reciente) — `resolve_identity` de `dev`. Filtros
  por grupo: G = {G, PG, SG}, F = {F, SF, PF}, C = {C}. `[DECISIÓN HUMANA: DA-11]`.
- Dorsal de la ficha = el del partido más reciente. "Club actual" (F-16) = el equipo de la ficha consultada. Vincular fichas
  de la misma persona en equipos distintos queda **fuera de alcance de v2** (cada ficha es por equipo).
- F-16 agrega a `players`: `height_cm`, `birth_year`, `nationality`, `profile_notes`, `profile_updated_at`,
  `profile_updated_by` (carga manual; lo que FIBA no publica se muestra nulo con razón `no_registrado`).
- Referencias en URLs y parámetros nuevos: **`player_id` entero**. Las rutas legado por nombre
  (`/api/player/<team>/<name>`, `/api/onoff/<team>/<name>`, `/api/shots/<team>/<name>`) siguen funcionando resolviendo el
  nombre a `player_id`.
- Riesgo de sobre-fusión (dos jugadores distintos con el mismo nombre abreviado en el mismo equipo): F-11 lo detecta
  (mismo `norm_key` con `first_name`/`family_name` distintos, o `photo_url` distinta) y lo lista en calidad de datos.

**Funciones (`backend/identity.py`, C-08):** `norm_name(s) -> str` (movida desde `stats_engine`, con re-export),
`resolve_identity(rows) -> tuple[str, str]` (de `dev`), `resolve_player_id(team_code, player_name, *, first_name=None,
family_name=None, photo_url=None, create=True) -> int`, `backfill_player_ids() -> int`, `player_card(player_id) -> dict`,
`duplicate_candidates(competition_id: int | None) -> list[dict]`, `merge_players(target_id, source_id) -> dict`.

**Descartadas.** (a) Solo unificación al leer (estado de `dev`): no da ids estables para URLs, filtros `on`/`off`, jugadores
seguidos (F-12), consultas guardadas (F-10) ni fichas editables (F-16). (b) Reescribir `player_name` en la tabla: destructivo
(regla 5). (c) Clave con competencia (DA-10). (d) Hash de la foto como clave: falta en ~20 % de las fichas.
**Constitución.** Tabla nueva + columna vía `upgrade_db()` + backfill idempotente; la restricción única existente queda intacta.

### 3.5 Conjunto estándar T-05 (dueño: T-05)

**Reparto por la Constitución regla 4** ("métricas avanzadas on-the-fly en `stats_engine.py`"): las **fórmulas** del conjunto
estándar viven en `stats_engine.py`; `backend/metrics_catalog.py` (NUEVO) guarda solo **metadatos** y el registro de tipos de
entidad. `lineups.py`, `clutch.py`, `possessions.py`, `matchups.py` arman `StatBundle` (conteos crudos) y delegan el cálculo en
`stats_engine.compute_standard`, eliminando progresivamente sus copias locales de fórmulas (`lineups._metrics`,
`clutch._box_metrics`): F-06 migra lineups/on-off, C-06/F-04 migran cierres.

```
# ── backend/metrics_catalog.py (NUEVO, T-05): metadatos, sin fórmulas ──
MetricDef (dataclass frozen):
  key: str            # snake_case definitivo (tabla abajo)
  label: str          # etiqueta es (override global: config ui.metric_labels)
  group: str          # volumen | produccion | tiro_volumen | tiro_pct | tiro_valor | tiro_perfil | balon | rebote | defensa | faltas | uso | extra
  fmt: str            # pct | dec1 | dec2 | int | signed_int | signed_dec2
  direction: str      # higher | lower | neutral   (neutral = sin color de rendimiento)
  kind: str           # count | rate | volume
  base_mode: str      # count (escala con T-04) | fixed (no escala) | volume (ver §3.8)
  per100_den: str     # own | opp   (posesiones propias o del rival para la base por 100)
  source: str         # box | pbp | shots | poss (A-01) | col_v2
  entities: tuple     # tipos de entidad donde aplica; fuera → null con razón no_aplica
  rel_dist: bool      # mostrar distancia relativa (%) en la ficha T-01
  legacy_keys: tuple  # claves viejas equivalentes (compatibilidad)
GROUPS: list[{key, label, metrics: [keys]}]   # orden de presentación
METRICS: dict[str, MetricDef]                  # ordenado
EntityRequest (dataclass): entity_type: str; entity_id: str; comp_id: int | None; ctx: Context; base: str
catalog_json(lang: str = "es") -> dict         # aplica overrides de config ui.metric_labels
register_entity(entity_type: str, loader: Callable[[EntityRequest], list[StatBundle]]) -> None
standard_payload(bundle: StatBundle, values: dict, *, context_echo: dict, base: str, sample: dict,
                 fichas: dict | None = None) -> dict   # shape §7.3

# ── backend/stats_engine.py (T-05 extiende): único lugar con fórmulas ──
RAW_KEYS = ("pts","fgm2","fga2","fgm3","fga3","ftm","fta","orb","drb","ast","tov","stl","blk",
            "blk_received","pf","fouls_drawn","plus_minus")

StatBundle (dataclass):
  entity_type: str; entity_id: str; name: str
  own: dict        # RAW_KEYS del lado analizado (conteos)
  opp: dict | None # RAW_KEYS del rival durante la misma selección
  team: dict | None     # para jugador: conteos del equipo en los partidos jugados (+ fgm)
  games: int; minutes: float | None; team_minutes: float | None; seconds: float | None
  on_court: dict | None # para jugador: {own, opp, seconds, estimated: bool} del equipo con él en cancha (pbp; estimado por minutos si falta)
  shots: dict | None    # {paint_fga, mid_fga, fg3a} desde shots/pbp
  possessions_counted: float | None   # A-01
  null_reasons: dict    # razones a nivel entidad (ej. {"*pbp*": "sin_pbp"})

compute_standard(bundle: StatBundle) -> dict[str, dict]      # {key: {"value": v|None, "reason": str|None}}
apply_base(values: dict, bundle: StatBundle, base: str) -> dict   # T-05: total|partido; T-04 agrega por40|por100
```

**Claves definitivas** (fórmulas; `POS` = posesiones de la entidad; jugador = columna J):

| Clave | Etiqueta | Grupo | fmt | dir | base | Equipo / quinteto / tramo | Jugador |
|---|---|---|---|---|---|---|---|
| `games` | Partidos | volumen | int | neutral | fixed | partidos de la selección | partidos jugados (sin DNP) |
| `minutes` | Minutos | volumen | dec1 | neutral | volume | Σ minutos de partido (40+5·PR) / Σ seg en cancha ÷ 60 | Σ minutos box |
| `possessions` | Posesiones | volumen | dec1 | neutral | volume | fórmula glosario | del equipo con el jugador en cancha (pbp; estimada por minutos con `estimated: true` si falta pbp) |
| `pace` | PACE | volumen | dec1 | neutral | fixed | 40·(POS+POS_rival)/2 / minutos | en cancha (pbp) |
| `sec_per_poss` | Seg/posesión | volumen | dec1 | neutral | fixed | segundos / (POS+POS_rival) | en cancha (pbp) |
| `pts` | PTS | produccion | int | higher | count | Σpts | Σpts |
| `pts_against` | PTS recibidos | produccion (+defensa) | int | lower | count | Σpts rival | en cancha (pbp) |
| `ppp` | PPP | produccion | dec2 | higher | fixed | pts/POS | pts/PLAYS |
| `oer` | OER | produccion | dec2 | higher | fixed | pts/POS | pts/POS_jugador |
| `der` | DER | produccion | dec2 | lower | fixed | pts_rival/POS_rival | en cancha (pbp) |
| `net_rating` | Net Rating | produccion | signed_dec2 | higher | fixed | oer − der | on_oer − der (en cancha) |
| `plus_minus` | +/- | produccion | signed_int | higher | count | pts − pts_against | Σ sPlusMinusPoints |
| `fga2` `fgm2` `fga3` `fgm3` `fta` `ftm` `fga` `fgm` | T2i T2c T3i T3c TLi TLc TCi TCc | tiro_volumen | int | intentos neutral / aciertos higher | count | Σ | Σ |
| `fg_pct` | FG% | tiro_pct | pct | higher | fixed | fgm/fga | ídem |
| `fg2_pct` `fg3_pct` `ft_pct` | FG2% FG3% FT% | tiro_pct | pct | higher | fixed | fgm2/fga2, fgm3/fga3, ftm/fta | ídem |
| `efg_pct` | eFG% | tiro_pct | pct | higher | fixed | (fgm+0,5·fgm3)/fga | ídem |
| `ts_pct` | TS% | tiro_pct | pct | higher | fixed | pts/(2·(fga+0,44·fta)) | ídem |
| `ppt` | PPT | tiro_valor | dec2 | higher | fixed | (2·fgm2+3·fgm3)/fga (DA-03) | ídem |
| `ppt_2` `ppt_3` `ppt_ft` | PPT 2 · PPT 3 · PPT TL | tiro_valor | dec2 | higher | fixed | 2·fgm2/fga2 · 3·fgm3/fga3 · ftm/fta | ídem |
| `fg3_uso` `fg2_uso` | Uso de triple · Uso de 2 | tiro_perfil | pct | neutral | fixed | fga3/fga · fga2/fga | ídem |
| `ft_rate` | FT Rate | tiro_perfil | dec2 | higher | fixed | fta/fga | ídem |
| `paint_fga_share` `mid_fga_share` | % tiros en pintura · % media distancia | tiro_perfil | pct | neutral | fixed | intentos de zona/fga (zonas C-03; pbp: `pointsinthepaint`) | ídem |
| `ast` `tov` | AS · PER | balon | int | higher · lower | count | Σ | Σ |
| `ast_to` | AS/PER | balon | dec2 | higher | fixed | Σast/Σtov (null `sin_perdidas`) | ídem |
| `as_pos` | AS/pos | balon | dec2 | higher | fixed | ast/POS | ast/POS_jugador |
| `as_pct` | AS% | balon | pct | higher | fixed | ast/fgm | DA-06 |
| `to_pct` | TO% | balon | pct | lower | fixed | tov/POS (DA-04) | tov/PLAYS |
| `orb` `drb` `trb` | RO · RD · REB | rebote | int | higher | count | Σ | Σ |
| `or_pct` `dr_pct` `trb_pct` | OR% · DR% · REB% | rebote | pct | higher | fixed | orb/(orb+drb_rival) · drb/(drb+orb_rival) · trb/(trb+trb_rival) | fórmula individual `dev` |
| `orb_pos` | RO/pos | rebote | dec2 | higher | fixed | orb/POS | orb/POS en cancha (pbp; si no, estimación `POS_eq·min_jug/min_partido`, marcada) |
| `drb_min` `orb_min` | RD/min · RO/min | rebote | dec2 | higher | fixed | drb/minutos · orb/minutos | ídem (min jugados) |
| `stl` `blk` | Robos · Tapones | defensa | int | higher | count | Σ | Σ |
| `blk_received` | Tapones recibidos | defensa | int | lower | count | col-v2 (quinteto: pbp `block`→tiro propio) | col-v2 |
| `stops` | Stops | defensa | int | higher | count | stl+blk (legado `stocks`) | ídem |
| `pf` | Faltas cometidas | faltas | int | lower | count | Σ | Σ |
| `fouls_drawn` | Faltas recibidas | faltas | int | higher | count | col-v2 (fallback equipo: `opp_pf`); quinteto: `foulon` | col-v2 |
| `uso_pct` | USO% | uso | pct | neutral | fixed | no_aplica | DA-05 |
| `uso_2p` `uso_3p` | USO 2P · USO 3P | uso | pct | neutral | fixed | no_aplica | §2.2 (PROPUESTA) |

Claves agregadas por requisitos posteriores (registradas en el catálogo por su dueño): `possessions_counted` y
`off_poss_duration` (A-01, volumen), `player_poss_duration` (A-01, uso; hasta entonces nulo `requiere_posesiones` en A-12),
`ast_team_share` y `pts_per_ast` (A-12, balon).

**Compatibilidad con claves actuales.** El payload estándar usa solo claves estándar. Mapeo legado → estándar:
`pps`→`ppt` (fórmula distinta, DA-03), `stocks`→`stops`, `usg_pct`→`uso_pct`, `off_rating`→`oer`, `def_rating`→`der`,
`pts_for`→`pts`, `reb`→`trb`, `fouls_committed`→`pf`, `point_diff`→`plus_minus`, `global_pf`/`pf` de zonas→`ppt` (ya en
`dev`). Los endpoints legado conservan sus claves hasta que el requisito dueño migre la pantalla (T-05: Equipo y Jugador;
F-06: Combinación y ON/OFF; C-06/F-04: Cierres).

**Adopción por entidad.** Tipos registrados por T-05 en fase 1: `team`, `player`, `lineup` (3–5 jugadores), `onoff`,
`clutch`. Tipos registrados por su dueño cuando se construyen: `zone` (C-03), `period` (F-04), `split` (T-03),
`matchup` (F-07), `pair` (A-08), `origin` (A-02), `ptype` (A-03), `chance` (A-04), `clock` (A-05), `chain` (A-07).
En fase 1 cada apartado existente muestra el conjunto completo con `components/standard-panel.js` (T-05) y, desde T-06, con la
tabla completa. Toda métrica que no aplica o no puede calcularse devuelve `null` con razón; **nunca se omite**.

**Descartadas.** Una lista de métricas por pantalla (lo que T-05 prohíbe); calcular en el frontend (regla 4 y regla 4 de
`sdd/02-plan.md`); seguir con `calc_team_stats`/`calc_player_stats` por partido y promediar (incompatible con DA-02 y con T-04).
**Constitución.** Regla 4: fórmulas en `stats_engine.py`, on-the-fly, nada persistido; las fórmulas nuevas o cambiadas
(§2.2) se escriben en `docs/metrics.md` al cerrar T-05. Interpretación aplicada en todo el documento: las **fórmulas** de
métricas viven en `stats_engine.py`; las **capas estadísticas** sobre ellas (percentiles T-01, regresión T-02, posesiones A-01,
RAPM A-11, similitud A-09) son módulos dedicados (regla 3) que consumen `stats_engine` y no persisten resultados, como ya
hacen `lineups.py` y `clutch.py`. `[DECISIÓN HUMANA: DA-37]`.

### 3.6 Ficha de métrica T-01 (dueño: T-01; base creada por C-02)

**Módulo `backend/population.py`** (creado por C-02 con `population()` y `league_reference()` usando solo el camino
`apply_thresholds=False` —todas las entidades de la competencia con datos—; T-01 implementa `apply_thresholds=True`, que pasa a
ser el default, y agrega el resto):
```
population(entity_type: str, comp_id: int, ctx: Context, *, apply_thresholds: bool = True) -> Population   # cacheado
  Population: {entity_type, comp_id, ctx_key, members: [ {id, name, values: {key: v}, sample: {...}, in_population: bool} ]}
league_reference(entity_type, comp_id, ctx) -> dict[str, float | None]       # media de las entidades in_population
rank(value, others: list[float], direction) -> tuple[int, bool]               # (puesto, empatado)
percentile(value, others: list[float], direction) -> float | None
ficha(metric_key, value, entity_id, pop: Population) -> dict                  # shape §7.1
attach_fichas(metrics: dict, entity_type, entity_id, pop) -> dict
full_ranking(entity_type, metric_key, comp_id, ctx, highlight_id) -> dict     # para el hover
```

**Fórmulas exactas.** `others` = valores no nulos de los **miembros de la población, excluida la propia entidad**
(`N' = len(others)`); `s = +1` si `direction == higher`, `−1` si `lower`.
- Percentil: `p = 100 · (B + 0,5·E) / N'`, con `B` = cantidad de `others` estrictamente peores (`s·(o − v) < 0`) y `E` =
  cantidad de `others` iguales. Redondeo a entero. `null` si `v` es nulo (razón de la métrica), si no hay universo
  (`sin_universo`), si `N' + 1 < population.min_size` (`poblacion_insuficiente`) o si el contexto no es comparable
  (`contexto_no_comparable`, §3.8). Mismo cálculo para entidades dentro y fuera de la población.
- Ranking: competición estándar ("1224"): `rank = 1 + #{others estrictamente mejores}`; `tied = E > 0`; `rank_total =`
  tamaño de la población (**incluye** a la entidad si está en la población; si está fuera, `rank` es hipotético y `in_population
  = false`). Se muestra "7.º de 12" (con marca `=` si hay empate).
- Líder: mejor valor de la población (`max` o `min` según dirección; empate → orden alfabético del nombre). Si la entidad
  consultada es el líder, `dist_leader = 0`.
- Distancias **orientadas** (positivo = mejor que la referencia en toda métrica, incluidas las "menos es mejor"):
  `dist_leader = s·(v − leader)` (≤ 0 para todo miembro), `dist_avg = s·(v − avg)`; relativas
  `dist_*_rel = dist_* / |ref|` (null si ref = 0), mostradas solo si `rel_dist` de la métrica. `[DECISIÓN HUMANA: DA-09]`.
  El tooltip muestra también la diferencia aritmética.
- Métricas neutrales (`direction == neutral`): percentil calculado como si fuera `higher`, **sin color** de rendimiento.
- Métricas con valor ajustado (T-02): ranking, percentil y líder se calculan sobre `adj.value`.

**"Menos es mejor"** (dirección `lower`): `der`, `pts_against`, `tov`, `to_pct`, `pf`, `blk_received`, `opp_efg_pct`,
`opp_ts_pct`, `opp_ft_rate`, `to_ratio`, `tov_pos`.

**Población de referencia** (miembros `in_population`): equipos con `games ≥ sample.team.min`; jugadores con
`minutes ≥ sample.player.min`; quintetos/parejas/on-off/emparejamientos/splits/tramos con posesiones (o intentos) ≥ mínimo
efectivo de T-02. Los que no llegan reciben la ficha completa marcada `in_population: false` y no afectan percentiles, líder
ni promedio. **Contexto:** la población se recalcula aplicando el mismo contexto a todas las entidades (cada equipo con sus
últimos 5, etc.) y la ficha lo indica (`population.context_label`). Esto concilia C-02 ("no sobre el subconjunto filtrado en
pantalla") con T-01 ("todo se recalcula sobre la selección activa").

**Color.** Escala continua `percentileColor(p)` (§8): rojo `#ef4444` en 0 → gris `#8b949e` en 50 → verde `#22c55e` en 100,
interpolación lineal RGB por tramo. Nulo o neutral → sin color.

**Ranking completo (hover/tap).** `GET /api/rankings/<entity_type>/<metric_key>` (§6, shape §7.1b); en móvil abre una hoja
inferior. Reemplaza al bloque "Ø liga / ↑ x" en todas las cards (el `Ø` de C-02 vive hasta que T-01 lo sustituye).

**Descartadas.** Percentil por interpolación lineal de cuantiles (resultados distintos con N chico, difícil de verificar
contra la tabla); ranking denso "1223" (la spec pide "salto en el siguiente"); incluir en la población a los de muestra baja
(la spec lo prohíbe). **Constitución.** Cálculo en backend sin persistir; `population.py` es módulo dedicado (DA-37); el color
se aplica en el frontend con una única función (`core/colors.js`).

### 3.7 Confiabilidad de muestra T-02 (dueño: T-02)

**Módulo `backend/sample.py`:**
```
effective_min(entity_type: str, *, team_poss: float | None) -> float
    # max(sample.<e>.min, rel_pct/100 · team_poss) si sample.relative_enabled y rel_pct no es null; si no, sample.<e>.min
sample_level(entity_type: str, *, n: float, unit: str, team_poss: float | None = None,
             games: int | None = None, minutes: float | None = None, possessions: float | None = None) -> dict   # badge §7.2
adjusted(value: float | None, poss: float, prior: float, entity_type: str) -> dict | None   # {value, k, prior, band}
band(poss: float, entity_type: str, metric_key: str) -> float
is_ranked(badge: dict) -> bool          # level != "baja"
calibrate_k(entity_type: str, comp_id: int) -> dict
```
- Niveles: `baja` si `n < min_efectivo`; `media` si `min_efectivo ≤ n < high`; `alta` si `n ≥ high`. Unidad por entidad:
  posesiones (lineup, pair, onoff —el menor de los dos estados—, matchup, split), intentos (clock_zone), minutos (player),
  partidos (team). Caso especial `clutch_lineup`: un partido cuenta si el quinteto jugó ≥ `sample.clutch_lineup.min_poss`
  posesiones del tramo; nivel `baja` si partidos contados < `high_games`, `alta` si ≥ (sin `media`).
- `team_poss` = posesiones ofensivas del equipo en la competencia y el contexto.
- Regresión (solo OER, DER, Net Rating de lineup, pair, onoff, matchup, split, clutch_lineup):
  `valor_aj = (pos·valor + K·prior)/(pos + K)`, `K = regression.<e>.k`, prior de §2.1; `net_aj = oer_aj − der_aj`.
- Banda (95 %): OER/DER: `±band_z · σ / √(pos + K)`; Net: `±band_z · σ · √(1/(pos_of + K) + 1/(pos_def + K))`;
  `σ = sample.ppp_sd` (con A-01: desvío empírico de puntos por posesión de la competencia).
- Exclusión: `baja` → gris con advertencia, fuera de población (T-01), rankings, tarjetas de líderes (F-06, F-14) y
  sugerencias (F-15, F-03, A-10). Se muestra igual.
- **Calibración de K** (herramienta, admin): `POST /api/settings/calibrate {entity, competition}` → para cada unidad con
  muestra suficiente divide sus partidos en dos mitades por paridad (partidos alternos), calcula OER en cada mitad,
  correlación `r` entre unidades, y `K_sugerido = n̄_mitad · (1 − r) / r`. Devuelve `{entity, units, n_half_mean, r,
  k_suggested, method}`. No modifica la config: la UI ofrece "Aplicar" (PUT settings). INCREMENTO DIFERIDO (→ A-01): método por
  posesiones alternas.

**Descartadas.** Ocultar entidades de muestra baja (la spec pide mostrarlas en gris); intervalo binomial para eficiencias por
posesión (los puntos por posesión no son binarios); K fijo en código (F-13 lo prohíbe). **Constitución.** Umbrales y K en
configuración; cálculo on-the-fly en `sample.py` (DA-37); nada persistido.

### 3.8 Contexto T-03 y normalización T-04

**Parámetros de query (nombres y valores definitivos):**
| Parámetro | Valores | Default | Nivel | Población (T-01) | Disponible desde |
|---|---|---|---|---|---|
| `competition` | id entero \| `all` \| string legado | §3.1 | partido | aplica a todos | fase 1 (C-02) |
| `last` | entero > 0 (UI: 3, 5, 10, 15) | todos | partido | cada entidad sus últimos N | fase 1 (C-02 parsea; T-01 aplica) |
| `venue` | `local` \| `visitante` | ambos | partido | aplica a todos | T-03 |
| `opponent` | team_code | todos | partido | aplica a todos salvo al rival | T-03 |
| `rest` | `0` \| `1` \| `2` \| `3mas` (días desde el partido anterior del equipo) | todos | partido | aplica a todos | T-03 |
| `quarter` | lista CSV de `1`,`2`,`3`,`4`,`pr` | todos | evento | aplica a todos | T-03 |
| `score` | `ajustado` (\|dif\| ≤ `context.close_margin` en el marcador corrido antes del evento, DA-33) \| `paliza` | ambos | evento | aplica a todos | T-03 |
| `on` | CSV de `player_id` (con jugador/es en cancha) | — | evento | `entity_only` | T-03 |
| `off` | CSV de `player_id` (sin jugador/es) | — | evento | `entity_only` | T-03 |
| `clock` | CSV de `temprano`,`medio`,`tardio` | todos | posesión | aplica a todos | A-05 |
| `clock_start` | `24` \| `14` | ambos | posesión | aplica a todos | A-05 |
| `origin` | CSV de orígenes A-02 (§3.9) | todos | posesión | aplica a todos | A-02 |
| `ptype` | CSV de `transicion`,`early`,`media_cancha` | todos | posesión | aplica a todos | A-03 |
| `chance` | `primera` \| `segunda` | ambas | posesión | aplica a todos | A-04 |
| `base` (T-04) | `total` \| `partido` \| `por40` \| `por100` | `ui.default_base` | — | — | T-04 (`total`/`partido` desde T-05) |

Reglas: los filtros se combinan (AND). Si hay algún filtro de nivel evento, las métricas se calculan agregando `pbp_events`
(no el box); si hay de nivel posesión, agregando posesiones de A-01. Filtro `entity_only` → percentiles `null` con razón
`contexto_no_comparable`. Un parámetro de posesión antes de que exista su dimensión → se ignora y se informa en
`context.ignored` con razón `requiere_posesiones`; la UI no lo ofrece (lee disponibilidad de `/api/context/options`).
Partidos sin fecha → excluidos de `rest` (razón `sin_fecha`). Partidos sin pbp con filtro de evento → excluidos y contados en
`context.games_excluded` con razón `sin_pbp`.

**Módulo `backend/context.py`** (lo crea C-02 con `competition` y `last`; T-03 es dueño del contrato completo; A-02…A-05
registran sus dimensiones):
```
@dataclass(frozen=True)
class Context:
    competition_id: int | None; competition_all: bool
    last: int | None; venue: str | None; opponent: str | None; rest: str | None
    quarters: tuple[str, ...] | None; score: str | None
    on: tuple[int, ...] | None; off: tuple[int, ...] | None
    clock: tuple[str, ...] | None; clock_start: str | None
    origin: tuple[str, ...] | None; ptype: tuple[str, ...] | None; chance: str | None
parse_context(args: Mapping[str, str], *, team_code: str | None = None, player_id: int | None = None) -> Context   # ContextError → 400
    # `competition` se resuelve con repository.resolve_competition (§3.1); valores desconocidos → 400 contexto_invalido
context_key(ctx: Context) -> tuple
level(ctx: Context) -> str                     # "partido" | "evento" | "posesion"
population_mode(ctx: Context) -> str           # "apply_all" | "entity_only"
filter_games(games: list[dict], ctx: Context, team_code: str) -> list[dict]
event_predicate(ctx: Context, team_code: str) -> Callable[[dict, dict], bool] | None     # (evento, estado{margen, on_court})
possession_predicate(ctx: Context) -> Callable[[object], bool] | None
context_echo(ctx: Context, *, games_used: int, games_total: int, games_excluded: dict, ignored: list) -> dict   # §7.5
register_dimension(name: str, *, level: str, values: tuple[str, ...], parser: Callable) -> None
```

**Frontend.** Estado en la URL: `#/<seccion>/<id>/<pestaña>?competition=3&last=5&venue=local&base=por40` (mismos nombres que la
API; se omiten los defaults). `core/context.js` (T-03): `getContext()`, `setContext(patch)`, `clearContext()`,
`contextToQuery(ctx)`, `contextFromQuery(query)`, `onContextChange(fn)`. Al cambiar de pestaña se conserva todo el contexto;
al cambiar de sección se conservan todos los parámetros salvo `on`/`off`. Recargar la URL reproduce la vista (CA de T-03).
En fase 1 (sin T-03) las vistas pasan `{competition, last}` explícitos a `api.js`.

**Base T-04.** Se calcula en backend (`stats_engine.apply_base`), nunca en el frontend:
- `total`: sin cambios. `partido`: métricas `count` y `volume` ÷ `games`.
- `por40`: métricas `count` × `2400 / segundos_de_la_entidad` (equipo: minutos de partido; jugador: minutos jugados;
  quinteto: segundos en cancha).
- `por100`: métricas `count` × `100 / posesiones` (`per100_den = own` → posesiones propias; `opp` → del rival; jugador:
  posesiones del equipo con él en cancha, exactas por pbp o estimadas por minutos con `estimated: true`, §2.1).
- Métricas `fixed` (tasas, porcentajes, ratios, `games`, `pace`, `sec_per_poss`) nunca se escalan. Métricas `volume`
  (`minutes`, `possessions`): `partido` → por partido; `por40`/`por100` → se muestran en **total** (son la muestra de respaldo).
- Aplica a equipo, jugador, quintetos y splits. La respuesta incluye `base` (eco).

**Descartadas.** Filtrar solo en el cliente sobre el `game_log` (mecanismo actual de competencia/últimos N): no sirve para
filtros de evento/posesión ni para recalcular poblaciones; estado del filtro en `localStorage` (la spec exige URL
compartible); normalizar en el frontend (regla 4). **Constitución.** Parser en módulo dedicado; rutas finas; cálculos en
backend; `api.js` sigue siendo el único punto de `fetch`.

### 3.9 Motor de posesiones A-01 (y atributos A-02…A-05)

**Persistencia vs cálculo.** **On-the-fly con caché en memoria, sin persistir** (Constitución 4: las posesiones son un
derivado de las reglas de configuración; persistirlas obligaría a reprocesar ante cada cambio de corte). Costo medido del
prototipo: ~2–5 ms por partido; competencia de ~200 partidos ≈ 1 s en frío, luego cacheado por (`game_id`,
`data_version`, `config_version`).

**Módulo `backend/possessions.py` (A-01):**
```
@dataclass(slots=True)
class Chance:            # oportunidad (1.ª = inicio de posesión; 2.ª+ = tras rebote ofensivo propio)  (A-04)
    n: int; start_event: int; start_clock: int; shot_clock_start: int        # 24 | 14
    end_event: int | None; end_type: str | None; pts: int; outcome: str | None   # outcome A-04

@dataclass(slots=True)
class Possession:
    game_id: str; poss_id: int; team: str; opp: str
    period: int; period_type: str                   # REGULAR | OVERTIME
    start_clock: int; end_clock: int; duration: int # segundos
    start_event: int; end_event: int | None
    origin: str | None                              # A-02
    ptype: str | None                               # A-03
    chances: list[Chance]
    shots: list[dict]                               # {action_number, elapsed, band (A-05), zone (C-03), made, pts, player_id}
    end_type: str | None                            # t2c | t2f | t3c | t3f | falta | perdida | fin_periodo
    pts: int
    own_on_court: frozenset | None; opp_on_court: frozenset | None
    finisher_id: int | None; assister_id: int | None; turnover_by_id: int | None
    incomplete: bool; incomplete_reason: str | None
game_possessions(game_id: str) -> list[Possession]                                      # cacheado
team_possessions(team_code: str, comp_id: int, ctx: Context, *, side: str = "ataque") -> list[Possession]   # side: ataque | defensa
reconcile(scope: dict) -> dict                    # contado vs fórmula por equipo-partido y por equipo-competencia
register_enricher(name: str, fn: Callable[[list[Possession], list[dict], dict], None]) -> None   # A-02…A-05
```
- **Reglas** (spec A-01): termina con canasta (salvo and-one: termina en el TL adicional), último TL convertido de la serie
  (no técnicas), rebote defensivo rival (incluido de equipo), pérdida o fin de período. El rebote ofensivo continúa la
  posesión y abre una `Chance` nueva con `shot_clock_start = clock.reset_secs`. TL de falta en acción de tiro pertenecen a la
  posesión que la generó; técnicas/antideportivas no cierran salvo cambio de sentido.
- **Incompleta**: si el pbp deja huecos (cambio de equipo atacante sin evento de cierre, reloj no monótono irreparable) →
  `incomplete = True`, excluida de los cálculos de contexto, nunca imputada a 0; cuenta en calidad de datos (F-11, check
  `possession_gaps`).
- **Reloj de posesión**: derivado (FIBA no publica shot clock): `elapsed = start_clock_de_la_chance − clock_del_evento`
  (mismo período), resolución 1 s. Documentar en `docs/metrics.md` que la fuente es derivada.
- **Quintetos**: A-01 agrega a `lineups.py` `build_segments_both(events, codes: tuple[str, str], starters: dict[str, set]) ->
  list[dict]` (tramos con `on_court: {code: frozenset}` para ambos equipos), reutilizando la lógica de `build_segments`
  (misma fusión de cambios simultáneos y piso monótono). Constantes compartidas `PERIOD_TYPES = ("REGULAR", "OVERTIME")` y
  `PERIOD_LEN = {"REGULAR": 600, "OVERTIME": 300}` (corrige D-09; las corrige F-11 en `lineups.py` y C-06 en `clutch.py`).
- **Conciliación ≤ 2 %**: sobre el total por equipo y competencia (DA-30); partidos con |dif| > 5 % se listan en F-11.
- **Enganches** (cada uno setea atributos en `Possession` vía `register_enricher`):
  - A-02 `origin` ∈ `canasta_rival`, `rebote_defensivo`, `robo`, `perdida_rival`, `saque_banda`, `tiempo_muerto`,
    `tiro_libre_rival`; precedencia: `tiempo_muerto` > `robo` > `rebote_defensivo` > `tiro_libre_rival` > `canasta_rival` >
    `perdida_rival` > `saque_banda`. Inicio de período y salto inicial → `saque_banda`. `rebote_ofensivo` es origen de
    **oportunidades** (Chance n ≥ 2), fila informativa fuera de la suma de posesiones (DA-29).
  - A-03 `ptype` ∈ `transicion` (primer tiro, falta recibida o pérdida con `elapsed ≤ transition.max_secs`), `early`
    (≤ `early_offense.max_secs`), `media_cancha` (resto); incompletas → `null`.
  - A-04 `Chance.outcome` ∈ `putback`, `reinicio`, `kickout_triple`, `falta_recibida`, `perdida`, `sin_puntos`.
  - A-05 `shots[].band` ∈ `temprano` (elapsed ≤ `clock.early_max`), `medio` (≤ `clock.mid_max`), `tardio` (resto); en
    chances de 14 s no existe `tardio` (> 14 → `null`, dato inconsistente); `null` si el reloj no es derivable.
- Métricas de posesión (PPP por origen/tipo/tramo, etc.) usan `possessions_counted`; en esas vistas la suma de filas cuadra
  exactamente con el total contado (CA de A-02, A-03, A-05).

**Descartadas.** Tabla `possessions` persistida (rompe la regla 4 y obliga a reprocesar ante cada cambio de cortes de
configuración); usar solo los calificadores de FIBA (`fastbreak`, `2ndchance`) en lugar de reconstruir (no dan duración, reloj
ni origen; se usan para validación cruzada). **Constitución.** On-the-fly con caché; módulo dedicado (DA-37); sin esquema nuevo.

### 3.10 Segmentos y emparejamientos (F-06, F-07, F-03, A-08, A-11)

| Necesidad | Dónde | Dueño | Firma |
|---|---|---|---|
| Todos los quintetos de un equipo (tabla F-06) | `lineups.py` | F-06 | `all_lineups(team_code: str, comp_id: int, ctx: Context, *, size: int = 5) -> list[StatBundle]` |
| Cierres por quinteto (récord, diferencial del tramo) | `lineups.py` | F-06 | `lineup_clutch(team_code, comp_id, ctx) -> list[dict]` (usa ventana de `clutch.py` con `clutch.margin`/`clutch.window_secs`) |
| Quintetos de ambos equipos por evento | `lineups.py` | A-01 | `build_segments_both(...)` (§3.9) |
| Quinteto vs quinteto, jugador vs jugador, jugador vs quinteto | `matchups.py` (NUEVO) | F-07 | `game_matchups(game_id: str, level: str) -> list[dict]`; `team_matchups(team_code: str, rival_code: str, comp_id: int, ctx: Context, level: str) -> list[dict]` con `level ∈ {"quinteto", "jugador", "jugador_quinteto"}`; cada fila = `StatBundle` de ambos lados + `games: [{game_id, possessions}]` |
| Parejas (K = 2) | `lineups.py` | A-08 | generaliza `lineup_stats`/`all_lineups` a `size=2` |
| Stints para RAPM | `matchups.py` | A-11 | `stints(comp_id: int, ctx: Context) -> list[dict]` (`{home_on, away_on, poss_home, poss_away, pts_home, pts_away}`) |

Reglas: toda fila de emparejamiento por debajo de `sample.matchup.min` se muestra en gris con banda y no se ordena entre los
recomendados; cruces sin antecedentes → celda vacía con razón `sin_enfrentamientos` (nunca 0). El módulo se nombra
"coincidencia en cancha", no "marcaje" (advertencia F-03).

**Descartadas.** Duplicar la reconstrucción de quintetos por pantalla (la lógica ya endurecida de `build_segments` se reutiliza);
inferir marcaje individual (FIBA no lo registra). **Constitución.** Extensión de `lineups.py` y módulo nuevo `matchups.py`;
fórmulas vía `stats_engine.compute_standard`; sin persistencia.

### 3.11 Tablas y exportación T-06 (dueño: T-06)

**Backend `backend/tables.py` (NUEVO):**
```
TableRequest (dataclass): table_id: str; params: dict[str, str]; comp_id: int | None; ctx: Context; base: str
register_table(table_id: str, *, entity_type: str, title: str, builder: Callable[[TableRequest], list[StatBundle]],
               default_columns: list[str], bulk_scopes: tuple[str, ...] = ()) -> None     # bulk_scopes ⊆ {"team", "competition"}
build_table(table_id: str, args: Mapping[str, str]) -> dict       # payload §7.6 (todas las filas)
bulk_workbook(scope: str, scope_id: str, comp_id: int) -> bytes   # XLSX multi-hoja
```
Cada requisito registra sus tablas (ids en §6). `GET /api/table/<table_id>` devuelve **todas** las filas (payload compacto por
columnas); el frontend ordena, pagina y exporta sobre ese dataset (la tabla de quintetos puede superar las mil filas: nunca
se trunca en silencio; paginación de `table.page_size` con "Ver todas").

**Exportación (cero dependencias nuevas, `[DECISIÓN HUMANA: DA-19]`):**
| Formato | Dónde | Cómo |
|---|---|---|
| CSV | cliente (`components/exporters.js`) | UTF-8 con BOM, separador `export.csv_separator` (`;`), coma decimal, líneas de cabecera `# clave: valor` (DA-20) |
| XLSX | servidor `POST /api/export/xlsx` | `backend/export_xlsx.py` con `zipfile` (stdlib) y SpreadsheetML mínimo (inline strings, números nativos, hoja "Portada" con metadatos); el cliente envía exactamente columnas visibles, orden y filas mostradas |
| PNG | cliente | serialización del nodo a SVG `foreignObject` (estilos computados inline; canvases de Chart.js convertidos a `<img>`), dibujado en `<canvas>` → `toBlob` |
| PDF | cliente | `window.print()` con hoja `@media print` (A4) sobre un contenedor de impresión; el usuario guarda como PDF |
| XLSX masivo (S1) | servidor `GET /api/export/bulk` | una hoja por tabla registrada con `bulk_scopes`, más "Portada" |

**Metadatos** (§7.7) en todo archivo: entidad, competencia y temporada, filtros aplicados, base, orden, columnas visibles,
fecha de generación, usuario. **Nombre de archivo**: `<apartado>_<entidad>_<competencia-slug>_<AAAA-MM-DD>.<ext>` (slug ASCII
en minúsculas, sin tildes; ej. `quintetos_CNF_liga-uruguaya-2025-2026_2026-09-23.xlsx`).
**F-03**: PDF A4 de 2 páginas = vista de informe con CSS de impresión y saltos de página fijos; PNG vertical = la misma vista
en maqueta de 1080 px de ancho exportada con el exportador PNG; CSV de los datos base.

**Descartadas.** Paginación y orden en el servidor (la exportación debe reproducir exactamente lo mostrado y los datasets caben
en memoria); PDF en servidor con `reportlab`/`weasyprint` (dependencias pesadas; WeasyPrint necesita librerías de sistema
que Render no trae); SheetJS/html2canvas vendorizados (solo si falla la opción sin dependencias, DA-19).
**Constitución.** Regla 2: cero dependencias nuevas (`zipfile` es stdlib); rutas finas; `fetch` solo en `api.js`.

### 3.12 Navegación X-01 (dueño: X-01)

**Secciones y rutas hash** (`#/<seccion>/<id?>/<pestaña?>?<contexto>`):
| # | Sección | Slug | Id | Pestañas / modos (slug) | Habilita |
|---|---|---|---|---|---|
| S1 | Datos | `datos` | — | `importar` (default), `partidos`, `calidad`, `competencias`, `calendario`, `exportar` | X-01 (+F-11, F-12, T-06) |
| S2 | Liga | `liga` | — | `tabla` (default), `ranking`, `mapa`, `lideres`, `perfil` | X-01 (+F-14) |
| S3 | Equipo | `equipo` | team_code | `resumen` (default), `tiro`, `posesion`, `eventos`, `quintetos`, `momentos`, `plantel`, `enfrentamiento`, `gamelog` | X-01 (+A-0x, F-08, F-20…) |
| S4 | Jugador | `jugador` | player_id | `ficha`, `resumen` (default), `tiro`, `posesion`, `eventos`, `distribucion`, `impacto`, `similares`, `tendencias`, `gamelog` | X-01 (+F-16, A-09…) |
| S5 | Partido | `partido` | game_id | `analizar` (F-07), `vivo` (F-01), `momentum` (F-02); `#/partido/preparar?team=<code>&rival=<code>[&fixture=<id>]` (F-03) | F-07 |
| S6 | Comparar | `comparar` | — | `equipos` (default), `jugadores` (F-05), `quintetos` (F-09), `h2h` (F-03); ids en query `a`, `b` | X-01 |
| S7 | Explorar | `explorar` | — | `jugadores` (default), `quintetos` (F-10), `contextos` (A-06), `similares` (A-09), `consultas` (F-10) | X-01 |
| S8 | Mi equipo | `mi-equipo` | — | — | F-12 |
| S9 | Configuración | `configuracion` | — | `umbrales`, `contexto`, `momentum`, `preferencias` | F-13 (en fase 1 como vista suelta) |

- Registro de secciones y pestañas con bandera `enabled`: una sección/pestaña cuyo requisito todavía no existe **no se
  muestra**. Cada requisito habilita la suya.
- Id de quinteto en rutas/params: `<team_code>:<pid>-<pid>-…` con ids ascendentes.
- **Móvil (<768 px)**: la barra inferior muestra hasta **4 secciones habilitadas por prioridad + "Más"** (hoja con el resto).
  Prioridad: S8, S5, S3, S4, S2, S6, S7, S1, S9. `[DECISIÓN HUMANA: DA-23]`. Desktop: todas las habilitadas en la barra superior.
- **Fase 1 (antes de X-01)**: F-11 agrega pestañas internas a la vista Importar ("Importar · Partidos · Calidad ·
  Competencias"); F-13 agrega un botón de engranaje en el header que abre la vista `config` (no ocupa lugar en la barra
  inferior). X-01 las reubica en S1 y S9 sin cambiar sus componentes.

**Descartadas.** Barra inferior con 9 ítems o con scroll horizontal (no entra en 360 px; regla 7 exige nav inferior usable);
routing por `pushState` (requiere que Flask sirva todas las rutas del SPA; el hash no toca el backend). **Constitución.**
Regla 7: mobile-first, breakpoint 768 px, nav inferior fija; copy en español.

### 3.13 Organización del frontend (dueño: X-01; piezas por requisito)

**Decisión**: módulos ES nativos, sin bundler (`index.html` ya carga `app.js` como módulo). `[DECISIÓN HUMANA: DA-22]`.
```
frontend/js/
  app.js              # arranque, login, layout (se achica; X-01 mueve vistas a views/)
  api.js              # ÚNICO lugar con fetch (regla 9); agrega qs() (T-05) y apiFetchBlob() (T-06)
  charts.js           # wrappers Chart.js existentes
  core/   format.js (C-11) · i18n.js (C-11) · catalog.js (T-05) · colors.js (T-01) · prefs.js (F-13)
          router.js (X-01) · context.js (T-03)
  components/  standard-panel.js (T-05) · metric-card.js (T-01) · sample-badge.js (T-02) · data-table.js (T-06)
          export-menu.js (T-06) · exporters.js (T-06) · shot-chart.js (C-03) · tabs.js (X-01) · collapsible.js (X-01)
          context-bar.js (T-03) · base-selector.js (T-04) · quick-filters.js (F-19) · context-header.js (F-19)
          game-plan.js (F-17) · game-view.js (F-07)
  views/  datos.js · liga.js · equipo.js · jugador.js · partido.js · comparar.js · explorar.js · mi-equipo.js · configuracion.js  (X-01 crea; cada requisito completa su pestaña)
frontend/i18n/  es.json (F-21 crea; en/pt F-21)
```
- Desde la fase 1 todo código nuevo va en `core/` o `components/`; `app.js` los importa. X-01 hace la mudanza de vistas.
- **Service worker**: todo requisito que agregue un archivo estático lo suma a `STATIC` y sube `CACHE` al siguiente entero
  (`smart-basket-v10`, `v11`, …; el número se asigna al integrar). X-01 cambia la estrategia a runtime caching
  (cache-first que **guarda** en caché toda respuesta estática same-origin, `/api/*` siempre a red), eliminando el riesgo de
  olvidar módulos.
- CSS: se mantiene un único `css/style.css`, con una sección comentada por componente (`/* ── metric-card (T-01) ── */`).
- Copy nuevo siempre con `t('clave', 'Texto en español')` (§3.20).

**Descartadas.** Seguir con `app.js` monolítico (≈1.900 líneas hoy; v2 lo multiplicaría y los 10 redactores lo editarían en
paralelo); bundler o framework (regla 2). **Constitución.** Vanilla JS ES6 sin bundler (los módulos ES nativos lo son);
regla 9: `fetch` solo en `api.js`, reutilizar helpers existentes antes de crear nuevos.

### 3.14 Caché y rendimiento (dueño: F-11)

- Tabla `app_meta(key TEXT PK, value TEXT)` con `data_version` y `config_version` (enteros). `data_version` sube en
  importar, borrar, reprocesar, fusionar/editar competencias o jugadores, editar fichas; `config_version` en cambios de
  configuración.
- `backend/cache.py`: `get_versions() -> tuple[int, int]` (1 consulta por petición, memorizada en `flask.g`),
  `bump_data_version(reason: str) -> int`, `bump_config_version() -> int`, `memo(namespace: str, key: tuple, fn:
  Callable[[], T], *, max_entries: int = 64) -> T` (LRU por namespace; la clave se prefija con ambas versiones),
  `clear(namespace: str | None = None) -> None`. Correcto con N workers de gunicorn: cada proceso detecta versiones nuevas en
  la siguiente petición.
- `backend/repository.py` (F-11): carga en bloque por competencia y cachea: `resolve_competition(...)`,
  `competition_games(comp_id) -> list[dict]`, `team_game_rows(comp_id) -> dict[tuple[str, str], dict]`,
  `player_game_rows(comp_id) -> list[dict]`, `game_events(game_id) -> list[dict]`, `team_pbp_games(team_code, comp_id) ->
  list[dict]` (reemplaza a `app._team_pbp_games`, mismo shape + `competition_id`). Elimina los N+1 de `_opp_for`.
- Namespaces fijados: `pop:<entity_type>` (poblaciones T-01), `poss:game` (posesiones A-01), `lineups:<team>` (F-06),
  `rapm` (A-11), `live:<game_id>` (F-01, TTL propio), `cfg` (config).
- Objetivos: vista de equipo/jugador < 1,5 s en caliente; informe F-03 < 10 s en frío (poblaciones de la competencia +
  emparejamientos de ambos equipos); exportación masiva < 60 s.
- Memoria: Render Starter tiene 512 MB. Eventos como dicts (compatibilidad con `lineups`/`clutch`); LRU acotado; se
  recomienda 1 worker con hilos (DA-28).

**Descartadas.** Redis/memcached (servicio y dependencia nuevos); caché persistida en SQLite de métricas (regla 4); TTL fijo
sin versionado (sirve datos viejos tras importar o cambiar configuración). **Constitución.** Sin dependencias; nada de
métricas persistido (solo contadores de versión en `app_meta`).

### 3.15 Motor de plantillas de frases (dueño: F-17; extiende A-10; traduce F-21)

- `backend/phrases.py`: `load_templates(lang: str = "es") -> dict`, `render(template_id: str, values: dict, *, lang: str = "es")
  -> str`, `game_plan(entity_type: str, entity_id: str, *, reference: str, rival: str | None, comp_id: int, ctx: Context,
  mode: str = "perfil") -> dict` (`mode ∈ {"perfil", "matchup"}`; F-03 usa `matchup`).
- Plantillas en `backend/phrases/es.json` (F-21 agrega `en.json`, `pt.json`): `{"id": "ventaja_efg_pct", "metric":
  "efg_pct", "when": "ventaja" | "riesgo" | "extremo_alto" | "extremo_bajo", "text": "Ventaja en tiro: buscá volumen en medio
  campo"}`. Marcadores permitidos: `{entidad}`, `{metrica}`, `{valor}`, `{referencia}`, `{delta}`, `{p}`, `{media}`,
  `{rival}`; los valores se formatean con el `fmt` del catálogo (nunca números libres).
- Disparo F-17: puntaje `z = dist_orientada / σ_población`; ventajas = mayores `z` positivos, riesgos = menores negativos,
  `gameplan.items_min`…`items_max` por columna con `|z| ≥ gameplan.min_z`, orden por `|z|`. Solo métricas con plantilla y
  entidades con muestra `media`/`alta`.
- Disparo A-10: percentil ≤ `insights.low_pct` o ≥ `insights.high_pct`; entre `insights.min_items` y `max_items` frases;
  plantillas `extremo_alto`/`extremo_bajo`.
- Referencias de F-17: `competencia` (default), `rival` (elegido), `periodo_anterior` (el propio equipo antes del corte de
  `last`); `rival_proximo` INCREMENTO DIFERIDO (→ F-12).

**Descartadas.** Generación libre por IA (F-17 y A-10 la prohíben); plantillas en el frontend (duplicarían la lógica de disparo
y los valores). **Constitución.** Módulo dedicado en backend; archivos JSON de datos (no dependencias); copy en español.

### 3.16 Integración LLM (dueño: F-15)

- **Cliente**: SDK oficial `anthropic` (Python) como dependencia **opcional** con import protegido (mismo patrón que
  Playwright); sin el paquete o sin clave, la función queda deshabilitada y el resto de la sección intacto.
  `[DECISIÓN HUMANA: DA-24]` (alternativa: HTTP directo con `urllib` a `POST https://api.anthropic.com/v1/messages`).
- **Variables de entorno** (docs/deployment.md): `LLM_ENABLED` (flag), `ANTHROPIC_API_KEY` (secreto, solo en Render),
  `LLM_MODEL` (default `claude-opus-5`; alternativas de menor costo `claude-sonnet-5` o `claude-haiku-4-5` — decisión de costo
  del cliente), `LLM_TIMEOUT_SECS` (default 60), `LLM_MAX_RETRIES` (default 1), `LLM_EFFORT` (opcional). `/api/me` agrega
  `llm_enabled`.
- **Llamada**: bajo demanda (botón), nunca en la carga; `max_tokens` 16000; salida estructurada JSON
  (`output_config.format`) con sugerencias que referencian valores por **marcadores** (`{m:<fila>.<clave>}`) que el backend
  reemplaza con los valores ya formateados del resumen; manejar `stop_reason == "refusal"` y usar el mecanismo de fallback del
  servidor (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) por defecto.
- **Validación**: toda cifra del texto final debe existir en el resumen enviado (regex de números contra el conjunto de
  valores formateados); si una sugerencia contiene números fuera de marcadores o no validados, se descarta. Solo se envían
  quintetos con muestra ≥ `media`; si ninguno califica, no se llama al modelo y la UI lo dice.
- **Timeouts en Render**: 60 s por intento × 2 intentos (1 reintento) = 120 s < 180 s de gunicorn; con 1 worker síncrono una
  llamada bloquearía la app → DA-28.
- Módulo `backend/llm.py`: `llm_available() -> bool`, `lineup_suggestions(team_code: str, comp_id: int, ctx: Context, goal:
  str, rival: str | None) -> dict`, `validate_numbers(text: str, allowed: set[str]) -> tuple[bool, list[str]]`.

**Descartadas.** Llamar al modelo en cada carga (la spec lo prohíbe por costo y latencia); enviarle datos crudos o pedirle
cálculos (la spec lo prohíbe). **Constitución.** Regla 2: el paquete `anthropic` es una dependencia nueva **opcional**, que el
plan de F-15 debe justificar (DA-24); secretos solo en variables de entorno (regla 6 por analogía); lógica en módulo dedicado.

### 3.17 Datos en vivo (dueño: F-01; consume F-02)

- Fuente: el mismo `data/<game_id>/data.json` de FIBA LiveStats se actualiza durante el partido.
- **Polling iniciado por el cliente** cada `live.poll_secs` (≤ 60 s, spec); el servidor cachea el JSON por partido con TTL
  `live.cache_ttl_secs` (una sola descarga por intervalo para todos los usuarios) y timeout `live.fetch_timeout_secs`; ante
  fallo sirve el último snapshot con `stale: true`. Sin hilos de fondo (Render/gunicorn).
- `backend/live.py`: `live_snapshot(game_id: str) -> dict` (parsea con `fiba_fetcher.parse_game`, calcula con los mismos
  módulos que F-07 y A-01 sobre datos en memoria), `is_final(raw: dict) -> bool` (evento `game`/`end` con `confirmed`).
- **Persistencia**: no se escribe en la base durante el partido; al detectar fin se persiste automáticamente con
  `ingest.persist_game` (idempotente) y se archiva el JSON (`[DECISIÓN HUMANA: DA-27]`).
- Partidos finalizados abren la misma vista con los datos persistidos (spec F-01).

**Descartadas.** Hilo o proceso de fondo que consulte FIBA (Render + gunicorn síncrono no lo garantizan y multiplicarían
descargas por worker); WebSockets/SSE (infraestructura nueva). **Constitución.** Rutas `/api/*` finas; reutiliza
`fiba_fetcher` e `ingest`; sin esquema nuevo.

### 3.18 Cálculo numérico (A-11, A-09)

- **A-09 similitud**: Python puro (z-score por dimensión dentro de la competencia, distancia euclidiana; ~200 jugadores × 10
  dimensiones → milisegundos). Sin dependencias.
- **A-11 RAPM**: ridge sobre stints (≈12 mil filas × ≈360 columnas dispersas). Default **Python puro** con gradiente conjugado
  disperso y grilla `rapm.lambdas` × `rapm.folds`, cómputo bajo demanda (acción "Recalcular" admin) cacheado por
  (competencia, `data_version`, `config_version`); **no se persiste** (regla 4). Si el cómputo medido supera 30 s, el plan de
  A-11 propone `numpy` como dependencia justificada. `[DECISIÓN HUMANA: DA-25]`.

**Descartadas.** `scikit-learn` (dependencia pesada para un ridge); persistir coeficientes (regla 4). **Constitución.** Regla 2
(sin dependencias salvo justificación medida); módulos dedicados (DA-37).

### 3.19 Calendario / próximo partido (dueño: F-12)

- Hoy no existe fixture (FIBA LiveStats no lo publica en `data.json`). Modelo mínimo: tabla `fixtures` (§5) con carga manual
  en S1 → `calendario` (o desde S8). `fixtures.game_id` se completa al importar el partido (match por fecha + equipos).
- `backend/fixtures.py`: `list_fixtures(comp_id: int | None, team_code: str | None) -> list[dict]`, `next_fixture(team_code:
  str, today: str) -> dict | None`, CRUD.
- Consumidores: F-12 (próximo partido, acceso a Preparar), F-17 (`rival_proximo`), S5 (abrir Preparar desde el calendario).
  `[DECISIÓN HUMANA: DA-26]`.

**Descartadas.** Scrapear fixtures de sitios de terceros (frágil, fuera del dominio permitido `fibalivestats…`); inferir el
próximo rival de la alternancia de partidos (no es confiable). **Constitución.** Tabla nueva vía `create_all`; CRUD admin.

### 3.20 i18n (dueño final: F-21)

- `[DECISIÓN HUMANA: DA-21]` default: **preparar desde la fase 1**. C-11 crea `frontend/js/core/i18n.js` con
  `t(key: string, fallback: string, params?: object) -> string` (hoy devuelve el fallback en español interpolando `{param}`).
  Todo copy **nuevo** de cualquier requisito usa `t()` con claves `seccion.componente.texto`. F-21 extrae el copy existente de
  `app.js`, crea `frontend/i18n/{es,en,pt}.json`, selector persistente (`user_prefs` scope `ui`, key `language`) y traduce
  plantillas (`backend/phrases/*.json`) y cabeceras de exportación (`backend/i18n.py`).
- Etiquetas de métricas: vienen del catálogo (§3.5); las siglas internacionales (eFG%, TS%, OER) no se traducen.
- Formato numérico: es-UY con coma decimal en toda la UI y exportaciones visuales (`fmtNumber`, `core/format.js`), tal como los
  ejemplos de la especificación ("1,09", "60,0 %"). `[DECISIÓN HUMANA: DA-36]`.

**Descartadas.** Librería i18n de terceros (regla 2); retrofit completo en F-21 sin preparación (costo alto: todo el copy de
fases 1–4 quedaría hardcodeado). **Constitución.** Regla 7 (UI en español) se mantiene: español es el idioma por defecto y el
fallback de `t()`.

### 3.21 Permisos (dueño: F-11)

- `AUTH_USERS` no tiene roles. Se agrega la variable de entorno **opcional** `ADMIN_USERS` (lista separada por comas).
  `auth.admin_required(fn)`: con auth habilitado, exige sesión y, si `ADMIN_USERS` está definida, que el usuario esté en ella;
  sin `ADMIN_USERS`, todo usuario autenticado es admin; en modo abierto (local) todo está permitido. `auth.is_admin() ->
  bool`; `/api/me` agrega `is_admin`. `test_auth.py` suma los escenarios. `[DECISIÓN HUMANA: DA-18]`.
- Acciones `admin_required`: importar/borrar partidos (ya exigen login), editar/fusionar competencias, reasignar partidos,
  reprocesar, escribir configuración, calibrar K, fusionar jugadores, editar fichas (F-16), CRUD de calendario, recalcular
  RAPM. Lectura y preferencias propias: `login_required`.

**Descartadas.** Roles en una tabla (prohibido por la regla 6); roles dentro del JSON de `AUTH_USERS` (cambia su formato y rompe
`load_users`). **Constitución.** Regla 6: los usuarios siguen solo en variables de entorno; `test_auth.py` cubre el cambio.

---

## 4. Mapa de módulos backend

| Módulo | Responsabilidad | Crea | Extienden / consumen | Funciones públicas (firma) |
|---|---|---|---|---|
| `app.py` (mod.) | Solo rutas finas | — | todos | rutas de §6 |
| `ingest.py` NUEVO | Persistencia de un partido parseado + archivo crudo + reproceso | F-11 | C-08 (identidad), F-01 (fin de vivo) | `persist_game(game: dict, *, source_url: str) -> list[dict]` (si `game` trae `_raw`/`_page_info`, los archiva con `archive_raw`); `reprocess_games(game_ids: list[str], *, mode: str = "archivo") -> dict` (`mode ∈ {"archivo","fiba"}`, máx. 20 por llamada); `archive_raw(game_id: str, raw: dict, page_info: dict) -> None`; `load_archived(game_id: str) -> tuple[dict, dict] \| None`; `INGEST_VERSION: int = 2` |
| `fiba_fetcher.py` (mod.) | Descarga y parseo | — | F-11 (ingesta v2), F-01 | `fetch_game_data(url) -> dict` (sin cambio de firma; el dict agrega `_raw` y `_page_info`, que `ingest` archiva y no persiste como columnas); `fetch_raw(url) -> tuple[dict, dict]` (raw, page_info); `parse_game(raw: dict, source_url: str, page_info: dict) -> dict` (parser puro, sin red: lo usan reproceso desde archivo y vivo). Ingesta v2: tiros desde `tm[n].shot[]` (`court_x`, `court_y`), `minutes` = 40 + 5 × prórrogas, `period_pts`, `blk_received`, `fouls_drawn`, rebotes/pérdidas de equipo, nombres completos y foto, `previous_action`, `qualifiers` |
| `competitions.py` NUEVO | Competencias, alias, universo | F-11 | T-03, C-09, F-14 | `list_competitions() -> list[dict]`; `ensure_competition_for_source(source_name: str) -> int`; `create_competition(name: str, season: str \| None) -> dict`; `update_competition(comp_id: int, **fields) -> dict`; `merge_competitions(target_id: int, source_id: int) -> dict`; `assign_game(game_id: str, comp_id: int) -> None`; `backfill_competition_ids() -> int` |
| `repository.py` NUEVO | Carga en bloque y resolución | F-11 | todos los de métricas | ver §3.14 |
| `cache.py` NUEVO | Versiones + LRU | F-11 | todos | ver §3.14 |
| `data_quality.py` NUEVO | Panel de calidad | F-11 | C-08, A-01 | `quality_report(comp_id: int) -> dict`; `register_check(name: str, fn: Callable[[int], dict]) -> None` |
| `auth.py` (mod.) | Admin opcional | F-11 | F-13, C-08, F-16, F-12, T-02, A-11 | `admin_required(fn)`, `is_admin() -> bool` |
| `identity.py` NUEVO | Identidad de jugador | C-08 | F-16, F-11, A-09, T-03 | ver §3.4 |
| `config.py` NUEVO | Configuración | F-13 | todos | ver §3.2 |
| `prefs.py` NUEVO | Preferencias por usuario | F-13 | T-06, F-17, F-12, F-21 | ver §3.3 |
| `context.py` NUEVO | Contexto de petición | C-02 (mínimo) | T-03 (dueño del contrato), A-02…A-05, T-01 | ver §3.8 |
| `population.py` NUEVO | Poblaciones, promedio, ficha | C-02 | T-01 (ficha, rankings), F-14, F-17, A-10 | ver §3.6 |
| `metrics_catalog.py` NUEVO | Metadatos del conjunto estándar y registro de tipos de entidad (sin fórmulas) | T-05 | A-01, A-12, todos los tipos de entidad | ver §3.5 |
| `stats_engine.py` (mod.) | **Único lugar con fórmulas** (regla 4): legado por partido + conjunto estándar | — | T-05 (`RAW_KEYS`, `StatBundle`, `compute_standard`, `apply_base`), T-04 (bases `por40`/`por100`), C-11 (sentinels), C-08 (re-export de `norm_name`) | `calc_team_stats`, `calc_player_stats`, `league_averages` se conservan como fachada hasta que T-05 migre las pantallas; firmas nuevas en §3.5 |
| `sample.py` NUEVO | Muestra, regresión, banda, calibración | T-02 | T-01, F-06, F-07, F-03, F-15, A-06, A-08, A-11 | ver §3.7 |
| `tables.py` NUEVO | Registro y payload de tablas | T-06 | todos los que exponen tablas | ver §3.11 |
| `export_xlsx.py` NUEVO | Escritura XLSX stdlib | T-06 | F-03, F-07, F-10 | `workbook_bytes(sheets: list[dict], meta: dict) -> bytes` |
| `shot_zones.py` NUEVO | Zonas de tiro (geometría FIBA) | C-03 | A-05, F-07, A-09, F-03 | `to_half_court(court_x: float, court_y: float) -> tuple[float, float]`; `classify_zone(action_type: str, sub_type: str, court_x: float \| None, court_y: float \| None, qualifiers: str \| None) -> str`; `zone_table(shots: list[dict]) -> dict`; `ZONE_KEYS_11`, `ZONE_POINTS` (movidas desde `app.py`) |
| `lineups.py` (mod.) | Quintetos, on/off, parejas | — | T-05 (bundles), F-06 (`all_lineups`, `lineup_clutch`), A-01 (`build_segments_both`, `PERIOD_LEN`), A-08 (size=2), F-11 (fix OVERTIME) | ver §3.10 + `player_on_court(team_code: str, player_id: int, comp_id: int, ctx: Context) -> dict \| None` (T-05) |
| `clutch.py` (mod.) | Cierres | — | C-06 (OVERTIME, competencia), F-13 (conecta config), F-06, F-04 | `team_clutch(games, team_code, team_name, margin=None, window_secs=None)` (None → `config.get("clutch.margin")`/`config.get("clutch.window_secs")` desde F-13; antes, 10/300) |
| `possessions.py` NUEVO | Motor de posesiones | A-01 | A-02…A-07, F-01, F-02, A-06, A-11 | ver §3.9 |
| `matchups.py` NUEVO | Emparejamientos, stints | F-07 | F-03, A-08, A-11, F-15 | ver §3.10 |
| `game_analysis.py` NUEVO | Partido completo | F-07 | F-01, F-02, F-03 | `game_detail(game_id: str) -> dict`; `game_pbp(game_id: str, *, player_id: int \| None, types: list[str] \| None, period: str \| None) -> list[dict]`; `score_timeline(game_id: str) -> dict` |
| `prepare.py` NUEVO | Informe previo, H2H | F-03 | F-20, F-12, F-15 | `prepare_report(team_code: str, rival_code: str, comp_id: int, ctx: Context) -> dict`; `head_to_head(team_a: str, team_b: str, comp_id: int \| None) -> dict` |
| `live.py` NUEVO | Vivo | F-01 | F-02 | ver §3.17 |
| `chains.py` NUEVO | Producción desde eventos | F-01 (primitivas) | A-07 (análisis completo), A-08 | `assist_points(possessions) -> dict`; `oreb_points(possessions) -> dict`; `steal_points(possessions) -> dict`; `turnover_cost(possessions) -> dict` |
| `phrases.py` NUEVO | Plantillas de frases | F-17 | A-10, F-03, F-12, F-21 | ver §3.15 |
| `insights.py` NUEVO | Insights automáticos | A-10 | F-12 | `insights(entity_type: str, entity_id: str, comp_id: int, ctx: Context) -> list[dict]` |
| `competition_profile.py` NUEVO | Líderes y perfil | F-14 | — | `leaders(comp_id: int, ctx: Context, metric_key: str, min_minutes: int) -> list[dict]`; `profile(comp_id: int, ctx: Context) -> dict` |
| `trends.py` NUEVO | Tendencias | F-18 | — | `trend_series(entity_type: str, entity_id: str, metric_keys: list[str], comp_id: int, ctx: Context, ma: int) -> dict`; `recent_vs_rest(...) -> dict` |
| `cross_context.py` NUEVO | Contextos cruzados | A-06 | — | `cross_matrix(team_code: str, dim_x: str, dim_y: str, metric_key: str, comp_id: int, ctx: Context) -> dict` |
| `synergy.py` NUEVO | Sinergias | A-08 | F-15 | `assist_matrix(team_code, comp_id, ctx) -> dict`; `pair_table(team_code, comp_id, ctx) -> list`; `teammate_impact(team_code, comp_id, ctx) -> list` |
| `similarity.py` NUEVO | Similares | A-09 | F-03 | `similar_players(player_id: int, comp_id: int, *, position_group: str \| None, min_minutes: int, top_n: int) -> list[dict]` |
| `rapm.py` NUEVO | Impacto ajustado | A-11 | — | `rapm(comp_id: int, ctx: Context) -> dict` |
| `fixtures.py` NUEVO | Calendario | F-12 | F-17, F-03 | ver §3.19 |
| `llm.py` NUEVO | Sugerencias IA | F-15 | — | ver §3.16 |
| `i18n.py` NUEVO | Textos backend (exportes, frases) | F-21 | T-06, phrases | `t(key: str, lang: str = "es", **params) -> str` |
| `saved_queries.py` NUEVO | Consultas guardadas | F-10 | — | `list_queries(owner)`, `save_query(owner, name, kind, params)`, `delete_query(owner, query_id)` |

---

## 5. Cambios de esquema previstos

Vía: **tabla nueva** = modelo SQLAlchemy en `database.py` + `db.create_all()` (idempotente); **columna nueva** = modelo +
entrada en `upgrade_db().new_cols` (`ALTER TABLE ADD COLUMN`); **backfill** = función idempotente llamada desde
`upgrade_db()` que solo completa `NULL`. Columnas nuevas con dato de FIBA: **`DEFAULT NULL`** (nulo = "no importado todavía";
el parser escribe 0 cuando FIBA informa 0). Reimportación/reproceso necesario donde se indica.

| Tabla / columna | Tipo | Default | Vía | Dueño | Notas |
|---|---|---|---|---|---|
| `competitions` | tabla: `id` INTEGER PK, `name` TEXT NOT NULL, `season` TEXT, `status` TEXT NOT NULL DEFAULT 'publicada', `is_default` INTEGER DEFAULT 0, `created_at` TEXT, `updated_at` TEXT | — | create_all | F-11 | `UNIQUE(name, season)` |
| `competition_aliases` | tabla: `source_name` TEXT PK, `competition_id` INTEGER NOT NULL FK | — | create_all | F-11 | un alias por string scrapeado |
| `games.competition_id` | INTEGER | NULL | ALTER + backfill | F-11 | desde `games.competition` vía alias |
| `games.source_url` | TEXT | NULL | ALTER | F-11 | URL de importación (reproceso por FIBA) |
| `games.minutes` (existe) | INTEGER | 40 | dato | F-11 | ahora se escribe: 40 + 5 × prórrogas |
| `game_sources` | tabla: `game_id` TEXT PK FK (cascade), `fetched_at` TEXT, `raw_gz` BLOB, `page_info` TEXT JSON, `parser_version` INTEGER | — | create_all | F-11 | JSON crudo gzip (~50 KB/partido) (DA-12) |
| `app_meta` | tabla: `key` TEXT PK, `value` TEXT | — | create_all | F-11 | `data_version`, `config_version` |
| `team_game_stats.blk_received` · `.fouls_drawn` · `.team_orb` · `.team_drb` · `.team_tov` | INTEGER | NULL | ALTER | F-11 | reproceso |
| `team_game_stats.period_pts` | TEXT (JSON lista por período, REGULAR y luego prórrogas) | NULL | ALTER | F-11 | parciales F-04/F-07 |
| `team_game_stats.ingest_version` | INTEGER | NULL | ALTER | F-11 | NULL o < `INGEST_VERSION` = necesita reproceso |
| `player_game_stats.blk_received` · `.fouls_drawn` · `.paint_pts` · `.second_chance_pts` · `.fast_break_pts` | INTEGER | NULL | ALTER | F-11 | reproceso |
| `player_game_stats.first_name` · `.family_name` · `.photo_url` | TEXT | NULL | ALTER | F-11 | identidad (C-08/F-16) |
| `shots.court_x` · `shots.court_y` | REAL | NULL | ALTER | F-11 | coordenadas FIBA de cancha completa (0–100) leídas de `tm[n].shot[]`; `x`/`y` legado quedan en 0 hasta que C-03 active el mapa de 11 zonas (DA-32); requiere reproceso |
| `pbp_events.previous_action` | INTEGER | NULL | ALTER | F-11 | vínculo FIBA |
| `pbp_events.qualifiers` | TEXT (CSV ordenado) | NULL | ALTER | F-11 | calificadores FIBA |
| upsert de `shots` y `pbp_events` | — | — | código | F-11 | `on_conflict_do_update` (reproceso idempotente) |
| `players` | tabla: `id` INTEGER PK, `team_code` TEXT NOT NULL, `norm_key` TEXT NOT NULL, `display_name` TEXT NOT NULL, `first_name` TEXT, `family_name` TEXT, `photo_url` TEXT, `merged_into` INTEGER FK players.id, `created_at` TEXT | — | create_all | C-08 | `UNIQUE(team_code, norm_key)` |
| `player_game_stats.player_id` | INTEGER | NULL | ALTER + backfill | C-08 | no toca `UNIQUE(game_id, team_code, player_name)` |
| `app_config` | tabla: `key` TEXT PK, `value` TEXT JSON, `updated_at` TEXT, `updated_by` TEXT | — | create_all | F-13 | |
| `user_prefs` | tabla: `owner` TEXT, `scope` TEXT, `key` TEXT, `value` TEXT JSON, `updated_at` TEXT; PK `(owner, scope, key)` | — | create_all | F-13 | no es tabla de usuarios (DA-17) |
| `players.height_cm` · `.birth_year` | INTEGER | NULL | ALTER | F-16 | carga manual |
| `players.nationality` · `.profile_notes` · `.profile_updated_at` · `.profile_updated_by` | TEXT | NULL | ALTER | F-16 | |
| `saved_queries` | tabla: `id` INTEGER PK, `owner` TEXT NOT NULL, `name` TEXT NOT NULL, `kind` TEXT NOT NULL (`quintetos`\|`jugadores`), `params` TEXT JSON, `created_at` TEXT, `updated_at` TEXT | — | create_all | F-10 | `UNIQUE(owner, name)` |
| `fixtures` | tabla: `id` INTEGER PK, `competition_id` INTEGER, `date` TEXT NOT NULL, `time` TEXT, `home_code` TEXT NOT NULL, `away_code` TEXT NOT NULL, `game_id` TEXT, `source_url` TEXT, `notes` TEXT, `created_at` TEXT, `created_by` TEXT | — | create_all | F-12 | `game_id` se completa al importar |

Sin cambios de esquema: C-01…C-07, C-09…C-11 (la integración de `dev` tampoco toca el esquema), A-01…A-11 (on-the-fly), T-01,
T-02, T-03, T-04, T-05, T-06, X-01, F-01…F-09, F-14, F-15, F-17…F-21.

---

## 6. Catálogo de endpoints nuevos y modificados

Convenciones: rutas bajo `/api/`, sustantivos en inglés, kebab-case para compuestos, ids en la ruta, filtros como query
según §3.8. **Regla anti-colisión (Werkzeug):** nunca registrar en la misma posición de un mismo prefijo un segmento
estático y uno variable (por eso `/api/metrics-catalog` y no `/api/metrics/catalog` junto a `/api/metrics/<entity_type>`;
`/api/identity/merge` y no `/api/players/merge` junto a `/api/players/<team_code>`).
Todos con `login_required`; los marcados **A** con `admin_required`. "Ctx" = acepta contexto T-03 (en fase 1 solo
`competition` y `last`); "Base" = acepta `base` T-04. Errores con el formato de §7.8. Contrato = sección de §7 o descripción.
Un requisito que no es dueño de un endpoint solo puede **agregar** los campos que esta tabla le asigna (§0.3).

| Método + ruta | Dueño | Propósito | Ctx | Base | Contrato |
|---|---|---|---|---|---|
| POST `/api/import` (mod.) | F-11 | Ingesta v2 (columnas nuevas, archivo crudo, `competition_id`, `player_id`) | — | — | sin cambio de request; response + `competition_id` |
| GET `/api/games` (mod.) | F-11 | Catálogo con estado | `competition` | — | + `competition_id`, `competition_label`, `has_pbp`, `has_coords`, `needs_reprocess` |
| DELETE `/api/games` (mod.) **A** | F-11 | Borrado + `data_version` | — | — | sin cambio |
| PATCH `/api/games/<game_id>` **A** | F-11 | Reasignar competencia | — | — | body `{competition_id}` |
| GET `/api/teams` (mod.) | F-11 | Equipos de la competencia | `competition` | — | + `competition_id` |
| GET `/api/competitions` (mod.) | F-11 | Lista de competencias | — | — | `[{id, name, season, label, status, is_default, games, teams, first_date, last_date}]` |
| POST `/api/competitions` **A** | F-11 | Alta | — | — | body `{name, season}` |
| PATCH `/api/competitions/<int:comp_id>` **A** | F-11 | Edición | — | — | body parcial `{name, season, status, is_default}` |
| POST `/api/competitions/<int:comp_id>/merge` **A** | F-11 | Fusión | — | — | body `{source_id}` |
| GET `/api/data-quality` | F-11 | Panel de calidad | `competition` | — | `{competition, checks: {games_without_pbp, games_without_coords, games_needing_reprocess, null_fields, possible_duplicates, lineup_inconsistencies, pbp_box_mismatch, possession_gaps}}`; cada check `{status: ok\|alerta\|no_disponible, count, items[]}` |
| POST `/api/reprocess` **A** | F-11 | Reprocesar (máx. 20 partidos por llamada; el cliente itera) | — | — | body `{game_ids[]}` o `{competition_id, offset}`; response `{processed, failed[], next_offset, data_version}` |
| GET `/api/me` (mod.) | F-11 | + `is_admin` (F-15 agrega `llm_enabled`) | — | — | |
| GET `/api/players/<team_code>` (mod.) | C-08 | Plantel con ids | `competition` | — | `[{player_id, name, games, uso_pct, pts}]` |
| GET `/api/player/<int:player_id>` NUEVO | C-08 | Perfil por id (shape del legado) | Ctx | — | igual a `/api/player/<team>/<name>` + `player_id` |
| GET `/api/search/players` (mod.) | C-08 | Buscador con ids | `competition` | — | + `player_id` |
| POST `/api/identity/merge` **A** | C-08 | Fusión manual | — | — | body `{target_id, source_id}` (mismo equipo) |
| GET `/api/settings` | F-13 | Config + spec | — | — | `{version, values: {clave: valor}, spec: [ {key, type, default, min, max, label, section, help} ]}` |
| PUT `/api/settings` **A** | F-13 | Guardar | — | — | body `{values: {...}}` → igual a GET |
| POST `/api/settings/reset` **A** | F-13 | Volver a defaults | — | — | body `{keys[]}` |
| GET `/api/prefs` | F-13 | Preferencias propias | — | — | query `scope` → `{scope, values: {key: value}}` |
| PUT `/api/prefs` | F-13 | Guardar preferencia | — | — | body `{scope, key, value}` |
| DELETE `/api/prefs` | F-13 | Borrar preferencia | — | — | body `{scope, key}` |
| GET `/api/clutch/<team_code>` (mod.) | C-06 | Cierres con prórrogas (`OVERTIME`) y universo de competencia | Ctx | — | shape actual; `margin`/`window_secs` por defecto 10/300 en C-06 y leídos de config desde F-13 (el query `margin` sigue aceptándose) |
| GET `/api/league` (mod.) | T-01 | Ranking + población | Ctx | — | filas + `in_population`, `pct: {clave: p}`, `rank: {clave: {rank, total, tied}}` |
| GET `/api/team/<team_code>` (mod.) | T-05 | + bloque `standard` | Ctx | Base | §7.3 dentro de `standard` |
| GET `/api/player/<team_code>/<player_name>` (mod.) | T-05 | + bloque `standard` | Ctx | Base | ídem |
| GET `/api/metrics-catalog` NUEVO | T-05 | Catálogo (etiquetas con `ui.metric_labels`) | — | — | `{groups: [...], metrics: {clave: {label, group, fmt, direction, base_mode, rel_dist}}, null_reasons: [códigos]}` |
| GET `/api/metrics/<entity_type>` NUEVO | T-05 | Conjunto estándar de una entidad | Ctx | Base | query `id` (§3.12) → §7.3 |
| POST `/api/settings/calibrate` **A** | T-02 | Calibración de K | — | — | body `{entity, competition}` → §3.7 |
| GET `/api/rankings/<entity_type>/<metric_key>` NUEVO | T-01 | Ranking completo (hover) | Ctx | — | §7.1b |
| GET `/api/table/<table_id>` NUEVO | T-06 | Tabla completa | Ctx | Base | §7.6 |
| POST `/api/export/xlsx` NUEVO | T-06 | Serializar tabla(s) mostrada(s) | — | — | body `{meta, sheets: [{name, columns, rows}]}` → archivo |
| GET `/api/export/bulk` NUEVO | T-06 | XLSX masivo | `competition` | — | query `scope=team&team=<code>` o `scope=competition` → archivo |
| GET `/api/shot-zones` NUEVO | C-03 | Zonas con 7 datos + muestra + percentil | Ctx | — | query `entity=team\|player&id=…` → `{zones: {clave: {made, attempts, fg_pct, efg_pct, ppt, share, percentile, sample}}, summary, has_coordinates, context}` |
| GET `/api/shots/<team_code>` · `/<team_code>/<player_name>` (mod.) | C-03 | Legado delega en `shot_zones` | Ctx | — | shape de `dev` + `share` por zona |
| GET `/api/context/options` NUEVO | T-03 | Valores y disponibilidad de dimensiones | `competition` | — | `{competitions, teams, players, dimensions: [{name, level, values, available}]}` |
| GET `/api/context/summary` NUEVO | F-19 | Cabecera de contexto | Ctx | — | query `entity`, `id` → `{label, record: "W-L", avg_margin, games, games_total, sample}` |
| GET `/api/player-profile/<int:player_id>` NUEVO | F-16 | Ficha de identidad | Ctx | — | `{player_id, display_name, jersey, position, height_cm, birth_year, nationality, team, context_line, fields_null_reasons}` |
| PUT `/api/player-profile/<int:player_id>` **A** | F-16 | Carga manual | — | — | body parcial |
| GET `/api/game-plan` NUEVO | F-17 | Plan de juego | Ctx | — | query `team`, `reference`, `rival` → `{advantages[], risks[], reference}`; ítem `{metric, delta, own, ref, percentile, text, direction}` |
| GET `/api/game/<game_id>/possessions` NUEVO | A-01 | Inspección de posesiones de un partido | — | — | `{game_id, possessions[], reconcile}` |
| GET `/api/possessions/reconcile` NUEVO | A-01 | Conciliación por equipo | `competition` | — | `{teams: [{team_code, counted, formula, diff_pct}], games_over_5pct[]}` |
| GET `/api/game/<game_id>` NUEVO | F-07 | Partido completo | — | Base | `{game, box: {home, away}, players, partials, timeline, lineups, standard}` |
| GET `/api/game/<game_id>/pbp` NUEVO | F-07 | Jugada a jugada filtrable | — | — | query `player`, `type`, `period` |
| GET `/api/game/<game_id>/matchups` NUEVO | F-07 | Matchups del partido | — | — | query `level` |
| GET `/api/prepare` NUEVO | F-03 | Informe previo | Ctx | — | query `team`, `rival`, `last` → `{summary, advantages, threats, rival_lineups, rival_threats, h2h, matchups, suggestions_profile}` |
| GET `/api/h2h` NUEVO | F-03 | Head to head | `competition` | — | query `a`, `b` |
| GET `/api/live/<game_id>` NUEVO | F-01 | Snapshot en vivo | — | — | `{status, stale, fetched_at, teams, players_on_court, distribution, vs_season}` |
| GET `/api/live/<game_id>/momentum` NUEVO | F-02 | Momentum | — | — | `{run, last_possessions, last_window, last_outcomes, hot[], cold[]}` |
| GET `/api/leaders` NUEVO | F-14 | Líderes | Ctx | Base | query `metric`, `min_minutes` |
| GET `/api/competition-profile` NUEVO | F-14 | Perfil de competencia | Ctx | — | promedios de referencia = los de T-01 |
| GET `/api/saved-queries` · POST · DELETE `/api/saved-queries/<int:query_id>` NUEVO | F-10 | Consultas guardadas | — | — | `{id, name, kind, params}` |
| GET `/api/trends` NUEVO | F-18 | Series y tendencia | Ctx | Base | query `entity`, `id`, `metrics`, `ma` |
| GET `/api/events-production` NUEVO | A-07 | Producción desde eventos | Ctx | — | query `entity`, `id` |
| GET `/api/cross` NUEVO | A-06 | Matriz de contextos cruzados | Ctx | — | query `team`, `dim_x`, `dim_y`, `metric` |
| GET `/api/synergy/<team_code>` NUEVO | A-08 | Sinergias | Ctx | — | `{assist_matrix, pairs, teammate_impact}` |
| GET `/api/similar/<int:player_id>` NUEVO | A-09 | Jugadores similares | `competition` | — | query `position`, `min_minutes` |
| GET `/api/insights` NUEVO | A-10 | Insights | Ctx | — | query `entity`, `id` |
| GET `/api/rapm` NUEVO · POST `/api/rapm/recompute` **A** | A-11 | Impacto ajustado | `competition` | — | `{players: [{player_id, off, def, total, possessions}], lambda, folds}` |
| GET `/api/fixtures` · POST **A** · PATCH/DELETE `/api/fixtures/<int:fixture_id>` **A** NUEVO | F-12 | Calendario | `competition` | — | fila de `fixtures` |
| GET `/api/my-team` NUEVO | F-12 | Pantalla Mi equipo | Ctx | — | `{team, next_fixture, game_plan, alerts, shortcuts}` |
| POST `/api/ai/lineup-suggestions` NUEVO | F-15 | Sugerencias IA bajo demanda | Ctx | — | body `{team, goal, rival}` → `{suggestions: [{text, supporting_rows[]}], generated: true, disclaimer}` |

**Ids de tablas (`/api/table/<table_id>`) y dueño:** `league_teams` (T-06, migra el ranking de Liga), `league_standings`
(C-09 vía T-06), `team_game_log` y `player_game_log` (T-06), `search_players` (T-06), `clutch_games` (C-06 vía T-06),
`team_roster` (F-08), `team_lineups` (F-06), `team_onoff` (F-06), `period_splits` (F-04), `matchups_quinteto` /
`matchups_jugador` / `matchups_jugador_quinteto` (F-07; F-03 los reutiliza), `team_origins` (A-02), `team_ptypes` (A-03),
`team_second_chance` (A-04), `team_clock` / `zone_clock_matrix` (A-05), `lineup_search` (F-10), `events_production` (A-07),
`pairs` (A-08), `leaders` (F-14), `rapm` (A-11).

**Tipos de entidad (`/api/metrics/<entity_type>`) y dueño:** `team`, `player`, `lineup`, `onoff`, `clutch` (T-05); `zone`
(C-03); `split` (T-03); `period` (F-04); `matchup` (F-07); `origin` (A-02); `ptype` (A-03); `chance` (A-04); `clock` (A-05);
`chain` (A-07); `pair` (A-08).

---

## 7. Contratos JSON compartidos

### 7.1 Ficha de métrica (T-01) — objeto de cada métrica dentro de `metrics`
```json
"oer": {
  "value": 1.0912, "reason": null,
  "rank": 7, "rank_total": 12, "tied": false, "in_population": true,
  "percentile": 58,
  "avg": 1.0701, "dist_avg": 0.0211, "dist_avg_rel": 0.0197,
  "leader": {"id": "PEN", "name": "Peñarol", "value": 1.1502},
  "dist_leader": -0.059, "dist_leader_rel": -0.0513,
  "adj": null,
  "sample": null
}
```
`adj` (solo métricas regresadas de entidades tipo quinteto): `{"value": 1.03, "k": 25, "prior": 1.02, "band": 0.36}`.
`sample` por métrica solo donde la muestra es propia de la métrica (zonas, tramos): badge §7.2. Sin universo/población:
`rank`, `percentile`, `avg`, `leader` y distancias en `null` con `"pct_reason": "sin_universo"` (o `poblacion_insuficiente`,
`contexto_no_comparable`).

### 7.1b Ranking completo (T-01)
```json
{"entity_type": "team", "metric": "oer", "direction": "higher",
 "population": {"size": 12, "criterion": "equipos con ≥ 3 partidos", "competition_id": 3, "context_label": "Últimos 5 partidos"},
 "rows": [
   {"rank": 1, "tied": false, "id": "PEN", "name": "Peñarol", "value": 1.1502, "in_population": true, "highlight": false},
   {"rank": 7, "tied": false, "id": "CNF", "name": "Nacional", "value": 1.0912, "in_population": true, "highlight": true}
 ],
 "outside_population": [{"id": "TRO", "name": "Trouville", "value": 1.21, "hypothetical_rank": 1, "sample": {"level": "baja"}}],
 "avg": 1.0701}
```

### 7.2 Badge de muestra (T-02)
```json
{"level": "media", "unit": "posesiones", "n": 23.5, "min": 19.2, "high": 40,
 "min_source": "relativo", "games": 4, "minutes": 31.5, "possessions": 23.5, "ranked": true}
```
`level ∈ {baja, media, alta}`; `unit ∈ {posesiones, minutos, partidos, intentos}`; `min_source ∈ {absoluto, relativo}`.

### 7.3 Conjunto estándar por entidad (T-05)
```json
{
  "entity": {"type": "lineup", "id": "CNF:12-15-18-21-30", "name": "Prieto · Oglivie · Feldeine · Canty · Rodríguez", "team_code": "CNF"},
  "context": { "...": "§7.5" },
  "base": "partido",
  "sample": { "...": "§7.2" },
  "groups": [{"key": "volumen", "label": "Volumen", "metrics": ["games", "minutes", "possessions", "pace", "sec_per_poss"]}],
  "metrics": {
    "games": {"value": 4, "reason": null},
    "blk_received": {"value": null, "reason": "no_registrado"},
    "uso_pct": {"value": null, "reason": "no_aplica"},
    "oer": { "...": "§7.1" }
  },
  "catalog_version": 1
}
```
Toda clave de `METRICS` aplicable al grupo está presente en `metrics` (nunca se omite). Sin T-01 todavía, cada métrica trae
solo `value` y `reason`.

### 7.4 Valor nulo con razón (C-11)
`{"value": null, "reason": "<código>"}`. En los endpoints legado con diccionarios planos se agrega un mapa paralelo
`"null_reasons": {"or_pct": "sin_pbp"}`. **Códigos fijados** (etiquetas en `core/format.js`, `NULL_REASON_LABELS`):
`sin_intentos` (denominador 0), `sin_perdidas` (AS/PER o DEF/TO con 0 pérdidas), `dnp` (no jugó), `sin_pbp` (partido/s sin
play-by-play), `requiere_posesiones` (métrica de A-01 no disponible o posesión incompleta), `no_registrado` (la competencia o
la importación no trae el dato; reprocesar), `sin_coordenadas`, `no_aplica` (la métrica no aplica a la entidad),
`sin_datos` (la entidad no tiene partidos en la selección), `sin_fecha`, `sin_enfrentamientos`, y para percentiles
`sin_universo`, `poblacion_insuficiente`, `contexto_no_comparable`. UI: "—" con `title` = etiqueta de la razón; nunca color de
rendimiento; nulos al final al ordenar en ambos sentidos (`cmpNullsLast`).

### 7.5 Eco de contexto (T-03; C-02 lo emite con `competition` y `last`)
```json
"context": {
  "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "applied": {"last": 5, "venue": "local"},
  "ignored": [{"param": "clock", "reason": "requiere_posesiones"}],
  "level": "partido",
  "population_mode": "apply_all",
  "games_used": 5, "games_total": 16,
  "games_excluded": {"sin_pbp": 0},
  "label": "Últimos 5 · Local"
}
```

### 7.6 Payload de tabla (T-06)
```json
{
  "table_id": "team_lineups", "title": "Quintetos — Nacional",
  "entity_type": "lineup",
  "columns": [
    {"key": "_name", "label": "Quinteto", "type": "text", "sticky": true, "default_visible": true},
    {"key": "_sample", "label": "Muestra", "type": "badge", "default_visible": true},
    {"key": "net_rating", "type": "metric", "default_visible": true},
    {"key": "blk_received", "type": "metric", "default_visible": false}
  ],
  "rows": [
    {"id": "CNF:12-15-18-21-30", "link": "#/equipo/CNF/quintetos?lineup=CNF:12-15-18-21-30",
     "values": ["Prieto · Oglivie · …", null, 0.121, 1],
     "pct": [null, null, 71, 40],
     "adj": {"net_rating": {"value": 0.08, "band": 0.21}},
     "reasons": {},
     "sample": {"level": "alta", "n": 64.2, "unit": "posesiones"}}
  ],
  "totals": {"values": ["Total equipo", null, 0.052, 38], "reasons": {}},
  "competition_avg": {"values": ["Promedio competencia", null, 0.0, 29], "reasons": {}},
  "default_sort": {"key": "net_rating", "dir": "desc", "use_adjusted": true},
  "context": { "...": "§7.5" }, "base": "partido",
  "meta": { "...": "§7.7" }
}
```
`values`/`pct` alineados con `columns` (formato compacto para tablas de más de mil filas); `pct` null en columnas de texto,
neutrales o nulas.

### 7.7 Metadatos de exportación (T-06)
```json
{"title": "Quintetos — Nacional", "section": "quintetos",
 "entity": {"type": "team", "id": "CNF", "name": "Nacional"},
 "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026", "season": "2025/2026"},
 "filters": [{"label": "Período", "value": "Últimos 5"}, {"label": "Sede", "value": "Local"}],
 "base": {"key": "por100", "label": "Por 100 posesiones"},
 "sort": {"key": "net_rating", "dir": "desc", "label": "Net Rating ajustado ↓"},
 "columns_visible": ["_name", "_sample", "net_rating", "oer", "der"],
 "generated_at": "2026-09-23T14:05:00-03:00", "generated_by": "nico", "app_version": "smart-basket-v14",
 "file_name": "quintetos_CNF_liga-uruguaya-2025-2026_2026-09-23"}
```

### 7.8 Formato de error
`{"error": "Mensaje legible en español", "code": "codigo_snake", "details": {}}` — `error` se mantiene (compatibilidad con
`api.js`); `code` y `details` son nuevos y opcionales. Códigos HTTP: 400 validación (`parametro_invalido`,
`competencia_inexistente`, `contexto_invalido`), 401 sin sesión, 403 (`requiere_admin`, `seed_deshabilitado`), 404
(`no_encontrado`, `sin_pbp`), 409 (`conflicto`: fusión o unicidad), 429 rate-limit, 502 (`fiba_no_disponible`,
`llm_error`, `timeout_externo`), 503 (`llm_deshabilitado`).

---

## 8. Componentes frontend compartidos

| Componente | Archivo | Firma | Dueño | Consumidores |
|---|---|---|---|---|
| Formato y nulos | `core/format.js` | `PCT(v)`, `DEC1(v)`, `DEC2(v)`, `INT(v)`, `fmtNumber(v, decimals)` (es-UY), `nullDisplay(reason)`, `cmpNullsLast(a, b, dir)` (de `dev`), `NULL_REASON_LABELS` | C-11 (T-05 agrega `fmtMetric(key, value)` desde el catálogo; reemplaza la heurística `isPct`/`NOT_PCT`) | todos |
| i18n | `core/i18n.js` | `t(key, fallback, params)` | C-11 (F-21 carga diccionarios) | todos |
| Catálogo | `core/catalog.js` | `loadCatalog() -> Promise`, `metricDef(key)`, `metricLabel(key)`, `groupsFor(entityType)` | T-05 | todos |
| Escala de color por percentil | `core/colors.js` | `percentileColor(p) -> "rgb(r,g,b)" \| null`, `percentileBg(p, alpha = 0.18) -> string \| null` (null si p nulo o métrica neutral) | T-01 | T-06, C-03, A-06, F-17 |
| Preferencias | `core/prefs.js` | `getPref(scope, key, def)`, `setPref(scope, key, value)` | F-13 | T-06, F-17, F-12, F-21, T-03 |
| Router | `core/router.js` | `parseHash() -> {section, id, tab, query}`, `navigate(section, {id, tab, query})`, `onRoute(fn)`, `registerSection({slug, label, icon, priority, enabled})`, `registerTab(section, {slug, label, enabled, render})` | X-01 | todos los de UI desde fase 2 |
| Contexto | `core/context.js` | §3.8 | T-03 | todas las vistas |
| Panel de conjunto estándar | `components/standard-panel.js` | `renderStandardPanel(el, payload, {compact})` | T-05 | Equipo, Jugador, Combinación, ON/OFF, Cierres |
| Ficha de métrica | `components/metric-card.js` | `metricCard(key, metricObj, {entityType, showRanking = true}) -> string` + `bindMetricCards(el, {entityType, contextQuery})` (hover/tap → `api.ranking`) | T-01 | todas las cards |
| Badge de muestra | `components/sample-badge.js` | `sampleBadge(sample, {compact}) -> string` | T-02 | T-01, T-06, F-06, F-19, C-03 |
| Celda nula | `core/format.js` `nullDisplay` | — | C-11 | todos |
| Tabla completa | `components/data-table.js` | `createDataTable(el, {tableId, payload, onRowClick}) -> {setPayload(p), getState(), destroy()}` (orden con `cmpNullsLast`, selector de columnas, coloreado desactivable, totales, promedio, paginación, columna fija) | T-06 | todas las tablas |
| Menú de exportación | `components/export-menu.js` | `exportMenu(el, {getData: () => ({meta, columns, rows}), getNode: () => HTMLElement, formats})` | T-06 | tablas, F-03, F-07, F-18 |
| Exportadores | `components/exporters.js` | `toCSV(data) -> Blob`, `toPNG(node, {width}) -> Promise<Blob>`, `printNode(node, {pageSize: "A4"})`, `downloadBlob(blob, fileName)` | T-06 | export-menu, F-03 |
| Mapa de tiro + tooltip | `components/shot-chart.js` | `shotChart(zonesPayload, {mode: 11\|3, colorBy: "percentile"}) -> string` (color por percentil de PPT de la zona, DA-35; modo 3 zonas solo si `has_coordinates` es falso), `bindZoneTooltips(el, zonesPayload)` (7 datos de C-03; hover en desktop, tap en móvil; zona sin intentos → "Sin tiros registrados") | C-03 (mueve `_shotChartSVG` y familia) | Equipo, Jugador, F-07, A-05 |
| Pestañas | `components/tabs.js` | `renderTabs(el, tabs, activeSlug, onChange)` | X-01 | S1–S9 |
| Panel plegable | `components/collapsible.js` | `collapsible(el, {panelId, title, defaultOpen})` (estado en prefs `panel.collapsed`) | X-01 | F-17, F-12 |
| Barra de contexto | `components/context-bar.js` | `renderContextBar(el, {options, context, onChange})` | T-03 | todas las vistas |
| Selector de base | `components/base-selector.js` | `renderBaseSelector(el, {value, onChange})` | T-04 | Equipo, Jugador, Quintetos, splits |
| Filtros rápidos | `components/quick-filters.js` | `renderQuickFilters(el, {teams, context, onChange})` (chips período/sede/rival + limpiar) | F-19 | todas las vistas |
| Cabecera de contexto | `components/context-header.js` | `renderContextHeader(el, summary)` | F-19 | todas las vistas |
| Plan de juego | `components/game-plan.js` | `renderGamePlan(el, payload, {panelId})` | F-17 | S3, S8, F-03 |
| Vista de partido | `components/game-view.js` | `renderGameView(el, gamePayload, {mode: "analizar"\|"vivo"})` | F-07 | F-01, F-02 |

`api.js` (regla 9) agrega, cada dueño, métodos `api.<nombreCamelCase>(...)` por endpoint de §6 (ej. `api.metricsCatalog()`,
`api.metrics(type, params)`, `api.table(tableId, params)`, `api.ranking(type, metric, params)`, `api.settings()`,
`api.saveSettings(values)`, `api.prefs(scope)`, `api.savePref(scope, key, value)`, `api.dataQuality(comp)`,
`api.reprocess(body)`, `api.exportXlsx(body)`, `api.exportBulk(params)`, `api.contextOptions(params)`,
`api.contextSummary(params)`, `api.shotZones(params)`, `api.game(id)`, `api.prepare(params)`, `api.live(id)`), con
`qs(params)` (T-05: arma query omitiendo `null`/`undefined`/`""`) y `apiFetchBlob(path, opts)` (T-06).

---

## 9. Grafo de dependencias entre requisitos

### 9.1 Dependencias corregidas, habilitaciones y estimación orientativa

"Cambios" = diferencias con la propuesta del orquestador. Estimación orientativa del arquitecto (el redactor la ajusta en
su plan): S ≤ 3 h · M 3–8 h · L 8–20 h · XL 20–40 h.

| ID | Depende de (corregido) | Habilita | Cambios vs orquestador | Estim. |
|---|---|---|---|---|
| C-11 | — (incluye Grupo 0: integración de `dev`) | todas las C-xx, F-11, T-05, T-06 | + dueño de la integración de `dev`, de `core/format.js` e `core/i18n.js` | M 6–10 h |
| F-11 | C-11 | C-09, C-08, C-02, T-05, C-03, T-01, F-16, A-12, A-01, T-03 | + ingesta v2, `repository`, `cache`, `admin_required` | XL 28–40 h |
| C-05 | C-11 | — | + C-11 (integración) | S 1–2 h |
| C-10 | C-11 | — | + C-11 | S 1–2 h |
| C-06 | C-11 | F-13, F-04, F-06 | + C-11; + corrección OVERTIME en `clutch.py` | S 2–3 h |
| C-09 | C-11, F-11 | T-06 (`league_standings`) | + C-11 | S 2–3 h |
| C-08 | C-11, F-11 | T-01, F-16, F-05, T-03, F-10, A-09, A-11, F-12 | + C-11 | L 10–16 h |
| C-04 | C-11 | T-05 | — | S 1–3 h |
| C-01 | C-11 | T-05, A-12 | — | S 2–3 h |
| C-07 | C-11 | T-05, C-03 | + PPT general según glosario (DA-03) | M 3–5 h |
| C-02 | C-11, F-11 | T-01, F-14 | + crea `population.py` y `context.py` mínimos | M 6–10 h |
| F-13 | C-06, C-11, F-11 | T-02, T-04, T-06, F-06, F-17, A-03, A-05, F-02, F-14, F-12, F-21 | + C-11, F-11 (admin); + migra constantes de C-09 | L 12–18 h |
| T-05 | C-01, C-04, C-07, C-11, F-11 | T-02, T-01, T-06, T-04, F-06, F-05, F-08, F-18, F-07, A-01 | + F-11 (columnas nuevas) | XL 24–36 h |
| T-02 | F-13, T-05 | T-01, T-06, C-03, F-06, F-19, T-03, F-09, F-10, A-06, A-08, A-11, F-15 | — | L 12–18 h |
| T-01 | C-02, C-08, F-11, T-05, T-02 | T-06, C-03, A-12, F-05, F-08, F-06, F-17, F-03, F-14, A-09, A-10 | — | L 16–24 h |
| T-06 | T-05, T-01, T-02, C-11, F-13 | F-08, F-06, F-07, F-03, F-10, F-18, F-21 | + T-02 (badge en filas), F-13 (prefs) | XL 28–40 h |
| C-03 | C-07, T-01, T-02, F-11 | A-05, F-07, A-09 | + F-11 (coordenadas) | L 12–18 h |
| X-01 | Fase 1 cerrada | T-03, F-16, F-08, F-05, F-04, F-17, F-07, F-20, F-12, F-21 | — | XL 20–32 h |
| T-03 | X-01, F-11, T-01, T-02 | T-04, F-19, F-04, F-18, A-06, dimensiones de A-02…A-05 | + T-01, T-02 | XL 24–36 h |
| T-04 | T-05, T-03 | F-14, F-18 | — | M 6–10 h |
| F-19 | T-03, T-02 | — | — | M 6–10 h |
| F-16 | C-08, X-01, F-11 | — | + F-11 (nombres completos) | M 6–10 h |
| A-12 | C-01, T-01, F-11 | — | + F-11 (`previous_action`) | M 5–8 h |
| F-08 | T-05, T-01, T-06, X-01 | — | — | M 4–8 h |
| F-05 | T-05, T-01, C-08, X-01 | F-09 | + C-08, X-01 | M 6–10 h |
| F-04 | C-06, T-05, T-02, T-03, X-01 | — | + T-03 (dimensión cuarto) | M 6–10 h |
| F-06 | T-05, T-02, T-01, T-06, C-06, F-13 | F-07, F-03, F-09, F-10, A-08, F-15 | — | XL 20–32 h |
| F-17 | T-01, T-05, X-01, F-13 | F-03, A-10, F-12, F-21 | + X-01, F-13 | L 12–18 h |
| A-01 | T-05, F-11, C-11 | A-02…A-07, F-01, F-02, A-06, A-11 | + C-11 | XL 24–40 h |
| A-02 | A-01 | A-03, A-06, A-07, F-14 | — | L 10–16 h |
| A-03 | A-01, A-02, F-13 | A-04, A-06, A-07 | — | L 10–16 h |
| A-04 | A-01, A-03 | A-05, A-06, A-07 | + A-03 (coste del rebote: transiciones concedidas) | L 10–16 h |
| A-05 | A-01, A-04, F-13, C-03 | F-07, A-06 | — | L 14–20 h |
| F-07 | X-01, T-05, T-06, A-05, F-06, C-03, A-01 | F-03, F-01, A-08, A-11 | + C-03, A-01 | XL 28–40 h |
| F-03 | F-07, T-01, T-02, F-06, F-17, T-06 | F-20, F-12, F-15 | — | XL 30–40 h (partición sugerida si supera 40 h: informe · emparejamientos · salidas) |
| F-01 | F-07, A-01 | F-02, A-07 | — | XL 20–32 h |
| F-02 | F-01, F-13, A-01 | — | — | M 8–12 h |
| F-14 | T-01, A-02, F-13, T-04 | — | + T-04 | M 6–10 h |
| F-20 | X-01, F-03 | — | — | M 3–6 h |
| F-09 | T-02, T-05, F-05, F-06 | — | — | M 4–8 h |
| F-10 | T-02, T-06, F-06, C-08 | — | + C-08 (ids de jugadores) | L 8–14 h |
| F-18 | T-05, T-06, T-03, T-02, T-04 | — | + T-03, T-02, T-04 | L 10–16 h |
| A-07 | A-01, A-02, A-03, A-04, F-01 | A-08 | + F-01 (`chains.py`) | L 12–18 h |
| A-06 | A-01…A-05, T-02, T-03 | — | — | L 12–20 h |
| A-08 | A-01, T-02, F-06, F-07, A-07 | F-15 | + F-07, A-07 | L 10–16 h |
| A-09 | T-05, T-01, C-03, C-08 | F-03 (incremento) | + C-03, C-08 | M 6–10 h |
| A-10 | T-01, F-17 | F-12, F-21 | — | M 6–10 h |
| A-11 | A-01, T-02, F-07 | — | + F-07 (stints) | XL 20–32 h |
| F-12 | F-03, F-17, A-10, F-13, X-01 | — | + F-13, X-01 | L 10–16 h |
| F-15 | F-06, F-03, A-08, T-02 | — | — | L 12–20 h |
| F-21 | X-01, F-17, A-10, T-06 | — | — | XL 24–40 h |

Total orientativo ≈ 580–915 h (Fase 1 ≈ 165–260 h; Fase 2 ≈ 115–185 h; Fase 3 ≈ 70–110 h; Fase 4 ≈ 85–125 h;
Fase 5 ≈ 145–235 h).

### 9.2 Inversiones de fase y piezas adelantadas (con tratamiento)

| # | Inversión | Tratamiento |
|---|---|---|
| I-01 | F-11 "posesiones incompletas" necesita A-01 (fase 3) | INCREMENTO DIFERIDO (→ A-01): F-11 muestra el check `possession_gaps` con `status: no_disponible` y ofrece la conciliación pbp↔box (`pbp_box_mismatch`) como proxy; A-01 registra el check con `data_quality.register_check` |
| I-02 | T-03 dimensiones de posesión necesitan A-01…A-05 | T-03 fija el contrato completo (§3.8); los parámetros de posesión se informan en `ignored` y no se ofrecen en la UI; cada A-0x registra su dimensión con `context.register_dimension` |
| I-03 | A-12 "segundos promedio de posesión" necesita A-01 | INCREMENTO DIFERIDO (→ A-01): la clave `player_poss_duration` existe en el catálogo con `null` razón `requiere_posesiones`; A-01 la calcula |
| I-04 | F-17 (fase 2) comparte plantillas con A-10 (fase 5) | Pieza adelantada: F-17 crea `phrases.py` y el formato de plantillas; A-10 agrega plantillas y la regla por percentil extremo |
| I-05 | F-03 "sugerencia de emparejamiento por perfil" necesita A-09 (fase 5) | INCREMENTO DIFERIDO (→ A-09): F-03 reserva el bloque (oculto, rotulado "estimación"); A-09 lo activa |
| I-06 | F-17/F-12 "rival del próximo partido" necesita calendario | F-17 ofrece "rival elegido"; INCREMENTO DIFERIDO (→ F-12): `fixtures` y la referencia `rival_proximo` |
| I-07 | C-03 "respeta la barra de contexto" necesita T-03 | C-03 usa `context.parse_context` desde el día 1 (en fase 1 solo `competition` y `last`); T-03 lo extiende sin tocar C-03 |
| I-08 | T-01 "recalcular sobre la selección de T-03" | `population()` recibe `Context` desde el día 1; T-03 amplía el contexto; sin retrabajo |
| I-09 | T-05 exige el conjunto en entidades futuras (emparejamiento, pareja, cuarto, split, origen, tramo, zona, cadena) | Registro de tipos de entidad; CA de T-05 en fase 1 se verifica con equipo/jugador/quinteto/ON-OFF/cierre; cada dueño verifica su tipo (emparejamiento en F-07) |
| I-10 | T-02 calibración por mitades de posesiones necesita A-01 | Fase 1: mitades por paridad de partidos; INCREMENTO DIFERIDO (→ A-01): método por posesiones alternas |
| I-11 | F-01 (fase 4) necesita cadenas de eventos de A-07 (fase 5) | Pieza adelantada: F-01 crea `chains.py` con las primitivas mínimas; A-07 lo extiende |
| I-12 | C-02 (antes de T-01/T-02) necesita población de referencia | C-02 promedia todas las entidades de la competencia (sin umbrales); T-01 aplica umbrales (el valor puede moverse; se documenta) |
| I-13 | `context.py` (dueño de contrato T-03, fase 2) se necesita en fase 1 | Pieza adelantada: C-02 crea el módulo con `competition`/`last` según §3.8 |
| I-14 | `admin_required` se necesita antes de F-13 | Pieza adelantada: F-11 lo crea en `auth.py` |
| I-15 | Panel de duplicados (F-11) antes de la identidad persistente (C-08) | F-11 detecta duplicados con `norm_name` de `dev`; C-08 lo migra a `players` |
| I-16 | S5, S8 (fases 4–5) en la navegación de X-01 (fase 2) | Registro con bandera `enabled`; secciones ocultas hasta que F-07/F-12 las habiliten; S5 desde calendario: INCREMENTO DIFERIDO (→ F-12) |
| I-17 | Exportación masiva "desde S1" (T-06, fase 1) antes de que exista S1 (X-01) | El botón vive en la vista Importar (precursora de S1); X-01 lo reubica en `datos/exportar` |
| I-18 | F-11 y F-13 necesitan UI antes de X-01 | Pestañas internas en Importar y engranaje en el header (§3.12) |
| I-19 | Emparejamientos por evento (F-07) necesitan quintetos de ambos equipos | A-01 crea `lineups.build_segments_both` en fase 3; F-07 (fase 4) lo consume |

**Precondición P-00** (Grupo 0 de C-11): integrar `0cc4de6` de `dev` en la rama de trabajo de v2 (sin `669250e`/`3c65008`),
agregar `backend/venv/` a `.gitignore`, re-verificar en humo los CA de las features 12–18 con los partidos del seed.
Todas las C-xx dependen de P-00.

---

## 10. Convenciones para los documentos v2

- **Ubicación y nombres**: cada carpeta de requisito contiene exactamente `spec.md`, `plan.md`, `tasks.md`, `progress.md`.
  Rutas relativas desde una carpeta de requisito: especificación `../../00-especificacion-cliente-v2.md`, este documento
  `../../00-arquitectura-transversal.md`, otro requisito `../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md`
  (ruta exacta del mapa). Citar secciones como `00-arquitectura-transversal.md §3.6`.
- **Plantillas**: se respetan las secciones de `sdd/specs/_TEMPLATE/` y las reglas de `sdd/01…04`; solo cambia el encabezado.
- **Encabezado de `spec.md`**:
  ```markdown
  # Spec — <ID>: <título>

  > **ID:** <ID> · **Prioridad:** <P0|P1|P2> · **Fase y orden:** <fase>·<NN>
  > **Depende de:** <IDs con ruta relativa> · **Habilita:** <IDs>
  > **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
  > **Fuente:** Especificación v2 §<sección> · <ID> · Arquitectura §<secciones>
  ```
- **Encabezado de `plan.md`** y **`tasks.md`**: igual, con título `# Plan — <ID>: <título>` / `# Tasks — <ID>: <título>`,
  gate `Paso 2` / `Paso 3`; el plan agrega `> **Estimación:** <S|M|L|XL> · <min>–<max> h`.
- **`progress.md`**: plantilla de `_TEMPLATE/progress.md` con el encabezado `# Progress — <ID>: <título>` y la línea
  `> **Estado:** ⬜ No iniciado`.
- **Trazabilidad**: §2 "Fuentes" de cada spec cita la especificación v2 (sección + ID), `docs/…`, este documento y, para C-xx,
  los specs de `dev` (`git show dev:sdd/specs/<NN>/spec.md`).
- **Marcas**: las de §0.4, literalmente. Todo endpoint/columna/tabla/módulo/componente nuevo se marca `NUEVO` y debe figurar
  en §4/§5/§6/§8; si no figura → `PROPUESTA (no está en 00-arquitectura-transversal.md)`.
- **Incrementos diferidos**: en el spec, en §8 "Fuera de alcance" como `INCREMENTO DIFERIDO (→ <ID>)`; en el requisito
  receptor, como RF explícito "completa el incremento diferido de <ID>".
- **Copy de UI**: español rioplatense ("Reimportá sus partidos", "Elegí entre 3 y 5 jugadores"), siempre vía `t()`.
- **Escala de estimación** (horas de implementación con agente de codificación, incluida verificación manual y
  actualización de `docs/`): S ≤ 3 h · M 3–8 h · L 8–20 h · XL 20–40 h; si supera 40 h, justificar y proponer partición.
- **Verificación** (Constitución 8): CA verificables con curl/navegador sobre un dataset de verificación: los 13 partidos del
  seed + reproceso con ingesta v2 (+ una segunda competencia cuando el CA lo requiera, ver R-05).
- **Docs a actualizar**: cada plan lista qué archivo de `docs/` actualiza al cerrar (api, database, metrics, frontend,
  architecture, deployment).

---

## 11. Decisiones abiertas para el humano

| ID | Pregunta | Opciones | Recomendación | Default que asumen los redactores | Afecta |
|---|---|---|---|---|---|
| DA-01 | ¿v2 parte del Bloque C ya implementado en `dev`? | (a) integrar `0cc4de6` (sin venv) como Grupo 0 de C-11; (b) rehacer desde `main` | (a) | (a); C-xx = delta sobre `dev` | todas las C-xx, T-05, T-01, T-06 |
| DA-02 | ¿Tasas de una selección como cociente de totales o promedio de tasas por partido? | pooled / promedio | pooled | pooled | T-05, C-02, C-04, T-01, T-04, todas las vistas |
| DA-03 | ¿PPT según glosario (puntos de campo/TCi) reemplaza a `pps` (PTS/TCi)? | sí / mantener docs | sí | sí (`ppt`), `pps` legado | C-07, T-05, C-03 |
| DA-04 | ¿TO% según glosario (pérdidas/posesiones) para equipo y quinteto? | sí / mantener plays | sí | sí; jugador sobre PLAYS | T-05, four factors, F-06, F-01 |
| DA-05 | ¿USO% "con el jugador en cancha" vía fórmula de minutos? | sí / mantener partido completo | sí | sí | T-05, A-12, F-01, F-03, A-09 |
| DA-06 | ¿AS% de jugador = fórmula estándar (asistencias sobre canastas de compañeros en cancha)? | sí / AST/FGM propio | sí | sí; `ast_team_share` aparte | T-05, A-12, A-09 |
| DA-07 | ¿Sentinels 99.0 de AS/PER y DEF/TO pasan a nulo con razón `sin_perdidas`? | nulo / mantener 99 | nulo | nulo | C-11, C-04, T-05 |
| DA-08 | ¿Promedio de competencia = media de entidades de la población (no ponderada por partidos)? | entidades / partidos-equipo | entidades | entidades | C-02, T-01, F-14 |
| DA-09 | ¿Distancias de la ficha orientadas (positivo = mejor) en todas las métricas? | orientadas / aritméticas | orientadas (aritmética en tooltip) | orientadas | T-01, F-17, C-03 |
| DA-10 | ¿Identidad = equipo + nombre normalizado, competencia fuera de la clave, tabla `players`? | sí / clave con competencia | sí | sí | C-08, F-16, A-09, A-11, F-12, F-10, T-03 |
| DA-11 | Taxonomía de posiciones | FIBA más frecuente + grupos G/F/C / unificar catálogo | la primera | la primera | C-08, F-16, A-09, S7 |
| DA-12 | ¿Archivar el JSON crudo de FIBA (gzip) para reprocesar sin depender de FIBA? | sí / no | sí (~50 KB por partido) | sí | F-11 |
| DA-13 | Estado inicial de competencias creadas al importar | `publicada` / `borrador` | `publicada` | `publicada` | F-11 |
| DA-14 | Competencia por defecto de una vista | la más reciente de la entidad / global | de la entidad | de la entidad; "todas" sin percentiles | F-11, C-02, T-01, T-03, F-19 |
| DA-15 | Umbral relativo | solo quintetos (1,5 %) / todas las entidades | solo quintetos hasta calibrar | solo quintetos | T-02, F-13, F-06 |
| DA-16 | K de pareja, emparejamiento y cierre por quinteto; σ de la banda | 25 y 1,15 / otros | 25 y 1,15 hasta calibrar | 25 y 1,15 | T-02, F-13 |
| DA-17 | ¿Preferencias por usuario en servidor (`user_prefs` por nombre de sesión) respetan la regla 6? | sí / solo `localStorage` | sí | sí | F-13, T-06, F-17, F-12, F-21 |
| DA-18 | Permisos | `ADMIN_USERS` opcional / todos admin / sin cambios | `ADMIN_USERS` opcional | opcional; sin ella todos admin | F-11, F-13, C-08, F-16, F-12, A-11, T-02 |
| DA-19 | Exportación sin dependencias nuevas (CSV cliente, XLSX stdlib, PNG foreignObject, PDF impresión) | sí / vendorizar html2canvas y SheetJS | sí; revisar PNG en iOS | sí | T-06, F-03, F-07, F-18 |
| DA-20 | CSV: separador y decimal | `;` + coma / `,` + punto | `;` + coma (Excel es-UY) | `;` + coma, UTF-8 BOM | T-06 |
| DA-21 | ¿Preparar i18n desde la fase 1 (`t()` en todo copy nuevo)? | sí / retrofit en F-21 | sí | sí | todos los de UI, F-21 |
| DA-22 | Frontend en módulos ES nativos | sí / seguir monolítico | sí | sí | todos los de UI, `sw.js` |
| DA-23 | Navegación móvil con 9 secciones | 4 prioritarias + "Más" / scroll horizontal | 4 + "Más" | S8, S5, S3, S4 + "Más" | X-01 |
| DA-24 | LLM: SDK oficial `anthropic` (opcional) o HTTP con `urllib`; modelo por defecto | SDK + `claude-opus-5` / urllib / modelo más barato | SDK + `claude-opus-5`, configurable | SDK opcional, `LLM_MODEL=claude-opus-5` | F-15 |
| DA-25 | RAPM en Python puro o con `numpy` | puro / numpy | puro; numpy si > 30 s medido | puro | A-11 |
| DA-26 | Calendario manual (`fixtures`) | sí / sin calendario | sí | sí, en F-12 | F-12, F-17, F-03, X-01 |
| DA-27 | Vivo: polling de cliente + caché TTL + persistencia al finalizar | sí / hilo de fondo | sí | sí | F-01, F-02 |
| DA-28 | Gunicorn con hilos (`--workers 1 --threads 4`, gthread) al entrar F-01/F-15 | sí / mantener 1 worker síncrono | sí | sí, al cerrar F-01 | F-01, F-15, deployment |
| DA-29 | Origen "tras rebote ofensivo" y posesiones de inicio de período | fila informativa + `saque_banda` / 9.º origen | fila informativa | fila informativa; inicio → `saque_banda` | A-02, A-04, T-03, A-06 |
| DA-30 | Criterio ≤ 2 % de A-01 | por equipo y competencia / por partido | por equipo y competencia | por equipo y competencia (>5 % por partido en calidad) | A-01, F-11 |
| DA-31 | Tabla general: puntos 2/1 y desempate por diferencia, configurables | sí / fijo | sí + aclaración "solo partidos importados" | sí | C-09, F-13 |
| DA-32 | Mapa de tiro de 11 zonas con coordenadas reales (requiere reprocesar todos los partidos) | sí / seguir con 3 zonas | sí | sí | F-11, C-03, F-07, A-05, A-09 |
| DA-33 | "Situación de marcador" a nivel evento (marcador corrido) | evento / resultado final | evento | evento, umbral `context.close_margin` | T-03, A-06 |
| DA-34 | DER/Net de jugador en el conjunto estándar = del equipo con él en cancha; OER individual | sí / nulos `no_aplica` | sí | sí | T-05, F-05, A-09 |
| DA-35 | Color del mapa de tiro por percentil de PPT de la zona (reemplaza umbrales 1,00/0,85) | sí / mantener umbrales | sí | sí | C-03 |
| DA-36 | Formato numérico es-UY (coma decimal) en toda la UI | sí / punto decimal | sí (como los ejemplos de la spec) | sí | T-05, todos los de UI, T-06 |
| DA-37 | Interpretación de la regla 4: fórmulas de métricas en `stats_engine.py`; capas estadísticas (percentiles, regresión, posesiones, RAPM, similitud) en módulos dedicados que no persisten | sí / todo dentro de `stats_engine.py` | sí (precedente `lineups.py`/`clutch.py`) | sí | T-05, T-01, T-02, A-01, A-09, A-11, C-02 |

---

## 12. Riesgos transversales

| ID | Riesgo | Mitigación |
|---|---|---|
| R-01 | Divergencia `main`/`dev` y commits basura (venv) al integrar | P-00 con cherry-pick de `0cc4de6`; `.gitignore`; re-verificación de CA 12–18 |
| R-02 | Memoria y CPU en Render Starter (512 MB, 1 worker síncrono) con poblaciones, posesiones, emparejamientos y RAPM cacheados | LRU acotado por namespace, carga por competencia, DA-28, objetivos de §3.14 medidos en `progress.md` |
| R-03 | Dependencia de FIBA LiveStats (cambios de esquema, disponibilidad de partidos viejos, bloqueos) | Archivo crudo (DA-12), `_validate_raw`/`_validate_game`, reproceso desde archivo, timeouts cortos en vivo |
| R-04 | Cambios visibles de números por la conciliación (pooled, PPT, TO%, USO%, AS%) | DA-02…DA-06 aprobadas antes de T-05; nota de cambio en la UI y en `docs/metrics.md`; comparación antes/después en `progress.md` |
| R-05 | Datos de verificación insuficientes (base local vacía, una sola competencia, sin prórrogas, sin duplicados) → CA no verificables de punta a punta (ya ocurrió en `dev`) | Dataset de verificación: 13 partidos del seed (2 con prórroga) reprocesados + una segunda competencia real o de copia; inyección controlada documentada |
| R-06 | Sin test suite: regresiones al mover `_persist_game`, refactorizar `app.js` y cambiar fórmulas | Invariantes verificadas a mano y registradas (partición ON/OFF, suma de orígenes = total, pbp = box, conciliación de posesiones); `test_auth.py` extendido para admin |
| R-07 | Conflictos por trabajo paralelo sobre `app.js`, `api.js`, `style.css`, `sw.js` | Módulos ES (DA-22), secciones comentadas por dueño en CSS, número de `CACHE` asignado al integrar |
| R-08 | Invalidación de caché incompleta (un cambio de datos que no sube `data_version`) | Toda escritura pasa por `ingest`/`competitions`/`identity`/`config`, que suben la versión; revisar en cada plan |
| R-09 | Exportación PNG con `foreignObject` en Safari/iOS y fuentes externas | Probar en iOS; fallback a PDF; DA-19 prevé vendorizar solo si falla |
| R-10 | Muestras mínimas (emparejamientos de 8 posesiones) leídas como verdad | Badge, gris, banda visible, exclusión de recomendados (T-02) |
| R-11 | Sobre-fusión de identidades (mismo nombre abreviado en un equipo) | Detección en F-11 (nombres completos, foto); fusión manual en C-08; la separación de una ficha queda como PROPUESTA si aparece un caso real |
| R-12 | Datos personales de jugadores (altura, nacimiento, nacionalidad; Ley 18.331 de Uruguay) | Solo datos deportivos de carga manual por usuarios autorizados; sin exportación masiva de fichas personales |
| R-13 | LLM: costo, latencia, privacidad (se envían métricas agregadas a un servicio externo), clave filtrada | Bajo demanda, flag, clave solo en Render, resumen sin datos crudos, validación de cifras, fallback deshabilitable |
| R-14 | Vivo: bloqueo del worker y límites de FIBA | Caché TTL compartida, timeout 8 s, snapshot `stale`, DA-28 |
| R-15 | Alcance (≈580–915 h en 51 requisitos) | Respetar el orden de fases; P0 primero; partición de F-03 si supera 40 h |
| R-16 | Prórrogas: `OVERTIME` vs `OT` (D-09) ya produce cierres y segundos erróneos en producción | Corrección temprana (F-11 en `lineups.py`, C-06 en `clutch.py`) y verificación con los 2 partidos con prórroga del seed |
