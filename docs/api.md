# API REST

Base URL producción: `https://estadisticas-basket.onrender.com`  
Base URL local: `http://localhost:5000`

Todas las rutas bajo `/api/`. Respuestas en JSON. Errores retornan `{"error": "mensaje"}` con código HTTP apropiado.

> **Nulo vs cero en métricas de tasa.** Los campos de tasa (porcentajes, ratios, puntos por posesión: `oer`, `der`, `net_rating`, `efg_pct`, `ts_pct`, `fg2_pct`, `fg3_pct`, `ft_pct`, `ft_rate`, `pps`, `ppp`, `or_pct`, `dr_pct`, `trb_pct`, `to_pct`, `as_pct`, `uso_pct`, etc.) valen **`null`** cuando su denominador es 0 en ese partido (ej. un partido sin tiros libres → `ft_pct: null`, no `0`). En `averages`, esos partidos se **excluyen** del promedio (no cuentan como 0). Las stats de conteo (`pts`, `fta`, `ast`, ...) conservan su 0 real. `null` = "sin dato / sin intentos"; `0` = "valor real cero". Ver `sdd/specs/08-nulos-vs-cero/`.

> **Partidos DNP y población de promedio.** Un partido con 0 minutos disputados (DNP) **no cuenta como partido jugado**: queda fuera de todos los promedios del jugador, tanto de tasa como de conteo. Afecta a `GET /api/player/<team>/<player>`, `GET /api/players/<team>` y `GET /api/search/players`:
> - `games` es el número de partidos **jugados**, no el de fichas en `player_game_stats`.
> - `averages.*`, `uso_pct`, `pts`, `minutes` y `plus_minus` se promedian solo sobre partidos jugados.
> - `game_log` sigue devolviendo **todas** las fichas, incluidas las DNP: cada entrada trae `"played": bool` (`false` = DNP). El DNP se excluye del promedio, no de la historia.
>
> Un partido **con** minutos y 0 puntos sí cuenta — ese 0 es real. Campos que además pueden valer `null` donde antes devolvían `0`: `reb_share`, `oreb_share`, `dreb_share` (tasas: denominador 0 o sin fila de equipo), `uso_pct` en `/api/players/<team>`, y `record.win_pct` en `/api/team/<code>`. Ver `sdd/specs/12-nulos-orden-color-dnp/`.

> **Identidad de jugador.** Los tres endpoints de jugador resuelven la identidad por **nombre normalizado** (minúsculas, sin tildes, espacios colapsados) + equipo: dos fichas cuyo nombre normaliza igual son el mismo jugador y se unifican al leer, sumando sus partidos. La tabla conserva el nombre crudo — la unificación no altera datos.
> - `GET /api/player/<team>/<name>` acepta **cualquier grafía** en la URL y devuelve todos los partidos del jugador. `404` solo si no resuelve a ninguna ficha.
> - El `player`/`name` devuelto es siempre una grafía real (la de la ficha más reciente), nunca la clave normalizada.
> - `position` es la más frecuente entre las no vacías; a igual frecuencia, la de la ficha más reciente.
>
> La normalización es tipográfica, no semántica: `J. Feldeine` y `Jerome Feldeine` **no** se unifican. La competencia no entra en la clave (un jugador con partidos en dos competencias es una sola ficha, con `competitions[]`). Ver `sdd/specs/13-dedup-jugadores/`.

> **Promedios de liga por competencia.** `GET /api/team/<code>` y `GET /api/player/<team>/<name>` devuelven `leagues`: un mapa `{"<competencia>": {…}}` con el promedio de liga de cada competencia en que la entidad tiene partidos, más la clave `""` con el agregado de todas. El campo `league` se conserva y equivale a `leagues[""]`.
> - El promedio es la media **sobre todos los partidos** de esa competencia (ponderada: un equipo con 2 partidos aporta el doble que uno con 1), no la media de los promedios por equipo.
> - `avg` y `best` valen `null` —no `0`— cuando ninguna observación de la población tiene dato.
> - El promedio de liga **no** se recalcula con el subconjunto filtrado en pantalla (últimos N partidos): solo depende de la competencia seleccionada.
> - `best` ya no se consume en la UI (el indicador `↑` se retiró); se conserva en la respuesta hasta que T-01 rehaga el bloque de contexto.
>
> Ver `sdd/specs/14-promedios-de-liga/`.

> **Métricas de jugador por posesión y por minuto.** `game_log[]` y `averages` de los endpoints de jugador incluyen `as_pos`, `tov_pos` (`PER/pos`), `pts_pos`, `orb_min` y `drb_min`; y `or_pct`/`dr_pct`/`trb_pct`, que antes estaban **ausentes** y ahora traen el valor de la fórmula individual (ver `docs/metrics.md`). Todos pueden ser `null` con denominador 0 o sin datos del rival.
>
> **`ast_to` cambió de semántica**: era el promedio de los ratios por partido; ahora es el **acumulado de temporada** (`AST_total / TOV_total`), en equipo y en jugador. Un mismo jugador puede mostrar un valor distinto al de antes — el anterior era incorrecto. `null` si no hubo pérdidas (antes `99.0`). Ver `sdd/specs/15-metricas-jugador/`.

> **Competencias en borrador (F-11).** Los partidos de una competencia con `status: "borrador"` no entran en **ninguna** respuesta de lectura (equipos, liga, jugadores, buscador, mapas de tiro, quintetos, ON/OFF, cierres) hasta publicarla. Solo se ven en `GET /api/games`, `GET /api/competitions?include_hidden=1` y `GET /api/data-quality` (sección Datos).

> **Permisos de escritura (F-11).** Las rutas que modifican datos (`DELETE /api/games`, `PATCH /api/games/<id>`, `POST`/`PATCH /api/competitions…`, `POST /api/reprocess`) exigen además ser administrador: con `ADMIN_USERS` definida, solo esos usuarios; sin ella, todo usuario logueado. No admin → `403 {"error": "Tu usuario no tiene permiso para esta acción."}`. Importar no requiere admin.

> **Nulos con razón (C-11).** `GET /api/team/<code>`, `GET /api/player/<team>/<name>` y `GET /api/search/players` agregan un mapa `null_reasons` `{clave: código}` que dice **por qué** vale `null` cada métrica nula. Solo lista claves cuyo valor es `null`; el valor sigue siendo `null`.
> - Dónde: en `/api/team` y `/api/player`, `null_reasons` en la raíz explica `averages`, y cada entrada de `game_log[]` trae su propio `null_reasons`. En `/api/search/players`, cada fila trae el suyo.
> - Códigos que se emiten hoy:
>
>   | Código | Significa |
>   |---|---|
>   | `dnp` | El jugador no disputó minutos en ese partido (o en ninguno, para `averages`) |
>   | `no_registrado` | La competencia no publica ese campo (FIBA no manda la clave): `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts`, `plus_minus` |
>   | `sin_perdidas` | `ast_to` o `def_to_ratio` con 0 pérdidas: el cociente no está definido |
>   | `sin_intentos` | Cualquier otra tasa con denominador 0 |
>
> - **Sin centinelas**: `ast_to` y `def_to_ratio` con 0 pérdidas valen `null` (`sin_perdidas`), también por partido — antes `99.0` (DA-07). Ninguna respuesta contiene `Infinity` ni `NaN`.
> - **`averages.def_to_ratio`** es el acumulado `(ΣROB + ΣTAP + ΣRD) / ΣPER` (pooled, DA-02), igual que `ast_to`; antes era el promedio de los ratios por partido.
> - **Desglose FIBA y `plus_minus`**: si la competencia no los publica, valen `null` (antes `0`). En `/api/search/players`, `plus_minus` promedia solo los partidos que lo traen.

---

## POST `/api/import`

Importa un partido desde FIBA LiveStats.

**Request body:**
```json
{ "url": "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/12345/bs.html" }
```

**Response 200:**
```json
{
  "ok": true,
  "game_id": "12345",
  "teams": [
    { "code": "FUBB", "name": "Federación Uruguaya de Basketball" },
    { "code": "OPO", "name": "Oponente" }
  ],
  "competition_id": 1,
  "competition_label": "Liga Uruguaya de Basquetbol 2025/2026"
}
```

**Errores:**
- `400` — campo `url` ausente o vacío
- `502` — FIBA LiveStats no respondió o datos inválidos

**Comportamiento:** importar el mismo partido dos veces es idempotente: upsert del partido y reemplazo completo de sus equipos, jugadores, tiros y play-by-play. La competencia se resuelve por el texto de FIBA (se crea si no existe, estado `publicada`); una competencia asignada a mano se conserva. El JSON crudo queda archivado para reprocesar (F-11).

---

## GET `/api/games`

Catálogo de partidos importados (incluye los de competencias en borrador), ordenados por fecha descendente.

**Query params:** `?competition=<id>` (opcional) filtra por competencia; también acepta el texto de FIBA.

**Response:**
```json
[
  {
    "id": 1,
    "game_id": "12345",
    "competition": "Liga FUBB",
    "date": "2024-03-15",
    "home_team": "Equipo A",
    "home_code": "EQA",
    "away_team": "Equipo B",
    "away_code": "EQB",
    "home_score": 85,
    "away_score": 72,
    "minutes": 40,
    "imported_at": "2024-03-16 10:30:00",
    "competition_id": 1,
    "competition_label": "Liga FUBB 2024",
    "competition_status": "publicada",
    "ingest_version": 2,
    "has_pbp": true,
    "has_coords": true,
    "needs_reprocess": false
  }
]
```

- `competition` es el texto crudo de FIBA; `competition_id`/`competition_label` la competencia asignada.
- `minutes`: 40 + 5 por prórroga (40 en partidos no reprocesados).
- `needs_reprocess`: guardado con una versión de ingesta anterior a la vigente.

---

## PATCH `/api/games/<game_id>` — admin

Reasigna un partido a otra competencia. La asignación se conserva al reimportar y reprocesar.

**Request:** `{ "competition_id": 3 }` · **Response 200:** la fila del partido con `competition_id`/`competition_label`.

**Errores:** `400` sin `competition_id` entero o competencia inexistente · `404` partido no encontrado. (Toda competencia inexistente pasada como parámetro — `competition=`, `competition_id` — da `400`; `404` es para rutas `/api/competitions/<id>`.)

---

## GET `/api/teams`

Lista todos los equipos con conteo de partidos.

**Response:**
```json
[
  { "code": "FUBB", "name": "Federación Uruguaya", "games": 12 }
]
```

---

## GET `/api/team/<team_code>`

Stats completas del equipo: promedios, record, contexto de liga y game log.

**Parámetros:** `team_code` — case-insensitive (se normaliza a mayúsculas).

**Response:**
```json
{
  "team_code": "FUBB",
  "team_name": "Federación Uruguaya",
  "games": 12,
  "record": {
    "wins": 8,
    "losses": 4,
    "win_pct": 0.667,
    "home": "5-1",
    "away": "3-3"
  },
  "averages": {
    "oer": 1.05,
    "der": 0.98,
    "net_rating": 0.07,
    "efg_pct": 0.512,
    "ts_pct": 0.548,
    "fg2_pct": 0.48,
    "fg3_pct": 0.34,
    "ft_pct": 0.72,
    "ft_rate": 0.31,
    "ft_rate_report": 0.22,
    "pps": 1.12,
    "fg2_uso": 0.62,
    "fg3_uso": 0.38,
    "or_pct": 0.29,
    "dr_pct": 0.71,
    "trb_pct": 0.50,
    "to_pct": 0.14,
    "to_ratio": 0.13,
    "as_pct": 0.55,
    "ast_ratio": 0.18,
    "pace": 68.5,
    "pts": 72.3,
    "possessions": 68.2,
    "plays": 75.1,
    "peso_1p": 0.18,
    "peso_2p": 0.52,
    "peso_3p": 0.30,
    "opp_efg_pct": 0.48,
    "opp_ts_pct": 0.52,
    "opp_to_pct": 0.16,
    "opp_ft_rate": 0.28,
    "stocks": 9.2,
    "def_playmaking": 4.1,
    "def_to_ratio": 3.2,
    "fgm": 25, "fga": 55, "...": "..."
  },
  "league": {
    "oer": { "avg": 1.0, "best": 1.15 },
    "...": "..."
  },
  "game_log": [
    {
      "game_id": "12345",
      "date": "2024-03-15",
      "opponent": "Equipo B",
      "opponent_code": "EQB",
      "home_away": "L",
      "oer": 1.08,
      "pts": 85,
      "opp_pts": 72,
      "...": "todas las métricas del partido"
    }
  ]
}
```

**Errores:** `404` — equipo no encontrado.

---

## GET `/api/players/<team_code>`

Lista los jugadores del equipo (nombres únicos).

**Response:**
```json
["García Juan", "López Pedro", "Martínez Carlos"]
```

---

## GET `/api/player/<team_code>/<player_name>`

Stats completas del jugador.

**Response:**
```json
{
  "player": "García Juan",
  "team_code": "FUBB",
  "team_name": "Federación Uruguaya",
  "games": 10,
  "averages": {
    "oer": 1.02,
    "efg_pct": 0.49,
    "ts_pct": 0.52,
    "ft_rate": 0.35,
    "ft_rate_report": 0.24,
    "pps": 1.05,
    "ppp": 0.88,
    "fg2_uso": 0.60,
    "fg3_uso": 0.40,
    "uso_pct": 0.22,
    "ast_to": 2.1,
    "stocks": 2.3,
    "def_playmaking": 0.8,
    "physical_impact": 7.4,
    "reb_share": 0.18,
    "oreb_share": 0.12,
    "dreb_share": 0.22,
    "pts": 14.2,
    "...": "..."
  },
  "league": { "...": "promedios de liga" },
  "game_log": [{ "...": "un entry por partido" }]
}
```

**Errores:** `404` — jugador no encontrado.

---

## GET `/api/shots/<team_code>/<player_name>`

Shot chart de **11 zonas** del jugador (ver clasificación en [database.md](database.md#clasificación-de-zonas-de-tiro)).

**Response:**
```json
{
  "zones": {
    "restricted_area": { "made": 45, "attempts": 80, "pct": 0.5625, "pf": 1.125 },
    "mid_left_close":  { "made": 4,  "attempts": 10, "pct": 0.40,   "pf": 0.80 },
    "mid_top":         { "made": 6,  "attempts": 15, "pct": 0.40,   "pf": 0.80 },
    "left_corner_3":   { "made": 8,  "attempts": 20, "pct": 0.40,   "pf": 1.20 },
    "top_key_3":       { "made": 15, "attempts": 45, "pct": 0.333,  "pf": 1.00 },
    "...": "11 zonas en total (ZONE_KEYS_11)"
  },
  "total_shots": 175,
  "has_coordinates": true,
  "summary": {
    "global_pf": 1.05,
    "efg_pct":   0.512,
    "ppp":       0.98,
    "games":     10
  }
}
```

Por zona: `made`, `attempts`, `pct` (% acierto) y `pf` (puntos por intento = made × valor zona / attempts; `null` si 0 intentos).

`has_coordinates` — `true` si al menos un tiro del jugador tiene `x!=0` o `y!=0`; hoy siempre `false`: las coordenadas reales se guardan aparte en `shots.court_x/court_y` (F-11) y el mapa las usará en C-03. El frontend usa este flag para elegir entre el chart de 11 zonas y el chart simplificado de 3 zonas (ver [frontend.md](frontend.md#shot-chart)).

### GET `/api/shots/<team_code>` (agregado del equipo)

Mismo shape que el de jugador, pero agrega los tiros de **todos los jugadores** del equipo (Feature 10). `summary.ppp` se calcula desde `TeamGameStats`. Alimenta el "Mapa de tiro del equipo" en la vista Equipo.

`summary`:
- `global_pf` — puntos por tiro global
- `efg_pct` — eFG% derivado de los tiros con zona
- `ppp` — puntos por posesión del jugador (de `player_game_stats`, no solo tiros)
- `games` — partidos con datos de tiro

Tiros sin coordenadas (`x=0, y=0`, partido sin array `shot` en FIBA) caen en `top_key_3` (3PT) o `mid_top` (2PT) o `restricted_area` (2PT con keyword de pintura) — en la práctica, si ningún tiro del jugador tiene coordenadas, solo esas 3 claves de `zones` tendrán `attempts>0` (ver `has_coordinates` arriba).

---

## GET `/api/pbp/<game_id>`

Verificación del play-by-play persistido de un partido (Feature 02). Solo lectura.

**Response 200:**
```json
{
  "game_id": "2741559",
  "events": 577,
  "by_action_type": { "2pt": 89, "3pt": 48, "rebound": 71, "substitution": 112, "assist": 38, "steal": 19, "block": 3, "freethrow": 50, "turnover": 29, "...": "..." },
  "first": { "action_number": 1, "action_type": "game", "period": 1, "clock_secs": 600, "...": "..." },
  "last":  { "action_number": 999, "...": "..." }
}
```

**Errores:** `404` — `{"error": "Partido sin play-by-play. Reimportá el partido."}` (partido inexistente o importado antes de la Feature 02).

---

## GET `/api/search/players`

Todos los jugadores de la base con sus promedios, para el buscador avanzado (una entrada por `(team_code, player_name)`). El filtrado y el orden se hacen en el frontend.

**Response:**
```json
[
  {
    "player": "A. Varela",
    "team_code": "AGU",
    "team_name": "Aguada",
    "competitions": ["Liga Uruguaya de Basquetbol 2025/2026"],
    "games": 3,
    "position": "G",
    "minutes": 27.4,
    "plus_minus": 4.5,
    "efg_pct": 0.55, "ts_pct": 0.58, "oer": 1.08, "uso_pct": 0.24,
    "ppp": 1.02, "pps": 1.10, "fg2_pct": 0.50, "fg3_pct": 0.37, "ft_pct": 0.80,
    "reb_share": 0.15, "oreb_share": 0.10, "dreb_share": 0.20,
    "physical_impact": 8.0, "stocks": 2.3, "def_playmaking": 0.9,
    "pts": 14.2, "ast": 6.1, "tov": 2.0, "stl": 1.2, "blk": 0.4
  }
]
```

- `position` — última posición no vacía observada (`playingPosition` FIBA); `""` si nunca hubo dato.
- `plus_minus` / `minutes` — promedio por partido (`plus_minus` puede ser negativo).
- Las tasas siguen la regla de nulos (ver nota al inicio): `null` si no hay dato, excluidas del promedio.
- Un jugador que jugó en dos equipos aparece una vez por equipo.

---

## GET `/api/clutch/<team_code>`

Cierres del equipo (Feature 05 **v2**, C-06): rendimiento en la **ventana de cierre** (último período REGULAR con reloj ≤ `window_secs` + todas las prórrogas) **de partidos apretados** — solo cuentan los partidos con diferencia ≤ `margin` al entrar a la ventana. Devuelve un **agregado** ("mini-partido" del equipo, todos sus cierres sumados) **más un desglose por partido**. Ver `sdd/specs/05-clutch/spec.md §10` y `sdd/specs/v2/fase-1-confiabilidad/05-C-06-umbral-cierres/`.

**Query (todos opcionales):**
- `margin` — umbral de partido cerrado, entero 0–40. Default **10** (`clutch.DEFAULT_MARGIN`).
- `window_secs` — ventana de cierre en segundos, entero 60–600. Default **300** (`clutch.DEFAULT_WINDOW_SECS`).
- `competition` — id de competencia (o texto de FIBA legado): el universo son solo los partidos del equipo en ella. Sin el parámetro, todas las competencias publicadas.

Los defaults viven solo en `backend/clutch.py` (F-13 los hará configurables). La respuesta devuelve los valores usados y **el frontend arma el título con ellos**.

> Reemplaza al antiguo `GET /api/clutch?team=` (una fila por equipo-partido, en la vista Liga). El análisis se movió a la vista **Equipo**.

**Response:**
```json
{
  "team_code": "HYM", "team_name": "Hebraica Macabi",
  "margin": 10, "window_secs": 300,
  "competition": { "id": 1, "label": "Liga de Ascenso 2026" },
  "games_total": 2, "games_with_pbp": 2, "games_without_pbp": 0,
  "games_qualified": 2, "games_excluded": 0, "games_without_clutch_events": 0,
  "clutch_record": "1-1-0",
  "aggregate": {
    "pts_for": 21, "pts_against": 18, "point_diff": 3,
    "off_rating": 0.9227, "def_rating": 0.8364,
    "efg_pct": 0.4348, "ts_pct": 0.4241, "possessions": 22.76,
    "reb": 13, "ast": 6, "tov": 3, "stl": 2, "blk": 2,
    "fouls_committed": 7, "fouls_drawn": 5
  },
  "per_game": [
    {
      "game_id": "2820499", "date": "2026-04-28",
      "opponent_code": "CNF", "home_away": "V", "entry_margin": 6, "overtime_periods": 0,
      "pts": 16, "opp_pts": 12, "point_diff": 4,
      "off_rating": 1.16, "def_rating": 0.96, "efg_pct": 0.577, "ts_pct": 0.542,
      "possessions": 13.8, "tov": 1, "ast": 5, "reb": 6,
      "fouls_committed": 6, "fouls_drawn": 4,
      "top_finisher": { "name": "C. Mitchell", "pts": 5 },
      "top_creator":  { "name": "J. Canty", "ast": 1 }
    }
  ]
}
```

- `competition` = `{id, label}` de la competencia pedida, o `null` si no se filtró.
- **Calificación por ventana:** un partido entra solo si al abrir la ventana (último evento con `clock_secs > window_secs` del REGULAR final) la diferencia absoluta era ≤ `margin`. Si no, suma a `games_excluded` y no aporta al agregado. `entry_margin` = esa diferencia por partido.
- **Recuento que cierra:** `games_qualified + games_excluded + games_without_clutch_events == games_with_pbp` y `games_with_pbp + games_without_pbp == games_total`. `games_without_clutch_events` = calificó por diferencia pero no hay eventos de cierre de ambos equipos.
- **Prórrogas:** todos los eventos con `period_type` `OVERTIME` (o el legado `OT`) entran en la ventana. `per_game[].overtime_periods` = cantidad de prórrogas del partido.
- `aggregate` = suma de las stats crudas de todos los cierres calificados; tasas recalculadas sobre la suma (`null` si 0 posesiones o 0 intentos). `aggregate.point_diff == pts_for − pts_against`.
- `clutch_record` = `ganados-perdidos-empatados` de los cierres calificados (`pts > / < / == opp_pts`).
- Faltas desde `pbp_events`: `fouls_committed` (`foul`), `fouls_drawn` (`foulon`).
- **Errores:** `400` — `margin`/`window_secs` fuera de rango o no enteros ("El parámetro margin debe ser un número entero entre 0 y 40."), o competencia inexistente. `404` — equipo inexistente ("Equipo no encontrado"), sin partidos en la competencia pedida ("El equipo no tiene partidos en la competencia seleccionada.") o sin play-by-play ("Equipo sin play-by-play. Reimportá sus partidos."). Con `games_qualified == 0`, `aggregate` trae conteos 0 y tasas `null`.

---

## GET `/api/lineup/<team_code>?players=A|B|C`

Rendimiento del equipo mientras los jugadores indicados (3 a 5, separados por `|`) comparten cancha, agregado sobre todos los partidos del equipo con play-by-play (Feature 03). Motor de reconstrucción de quintetos: `backend/lineups.py`.

**Response 200:**
```json
{
  "team_code": "CNF", "players": ["P. Prieto", "E. Oglivie", "J. Feldeine"], "size": 3,
  "games_used": 2, "games_excluded": 0,
  "sample": { "possessions": 43.96, "seconds": 1311.0 },
  "metrics": { "oer": 1.2056, "der": 0.7546, "net_rating": 0.451, "efg_pct": 0.5465, "ts_pct": 0.5643 },
  "raw": { "fga": 46, "fgm": 25, "fga3": 12, "fgm3": 6, "fta": 8, "ftm": 6, "orb": 7, "drb": 14, "ast": 9, "tov": 5, "stl": 8, "blk": 2 },
  "leaders": {
    "scorer":    { "name": "J. Feldeine", "pts": 15 },
    "assister":  { "name": "J. Feldeine", "ast": 2 },
    "rebounder": { "name": "E. Oglivie",  "trb": 9 }
  }
}
```

- `games_used`/`games_excluded` — partidos con quinteto inicial válido (5 titulares) vs. descartados por datos de pbp inconsistentes (RF-1/RF-7).
- `sample.seconds` = tiempo de juego del equipo con esos jugadores en cancha. La suma de segundos de todos los tramos de un partido es exacta (PERIOD_LEN por período: 600 regular / 300 OT); no modela reloj detenido dentro de un tramo.
- Tasas `null` si su denominador es 0 (regla de nulos, ver nota al inicio).

**Errores:** `400` — `{"error": "Elegí entre 3 y 5 jugadores"}` (menos de 3 o más de 5 nombres) · `404` — equipo sin partidos con play-by-play.

---

## GET `/api/onoff/<team_code>/<player_name>`

Rendimiento del equipo con el jugador en cancha (**ON**) vs. en el banco (**OFF**), agregado sobre todos los partidos del equipo con play-by-play (Feature 04). Reusa el motor de `backend/lineups.py` (Feature 03) — ON/OFF nacen de los mismos tramos, partición exhaustiva y disjunta.

**Response 200:**
```json
{
  "team_code": "CNF", "player": "E. Oglivie", "usg_pct": 0.0947,
  "games_used": 2, "games_excluded": 0,
  "on":  { "possessions": 87.0, "seconds": 2682.0, "pts_for": 103, "pts_against": 63, "reb": 53, "orb": 15, "drb": 38, "ast": 13, "tov": 11, "stl": 8, "blk": 3, "oer": 1.1839, "der": 0.7475, "net_rating": 0.4364, "efg_pct": 0.5513, "ts_pct": 0.5787 },
  "off": { "possessions": 77.0, "seconds": 2201.0, "pts_for": 104, "pts_against": 91, "reb": 36, "orb": 10, "drb": 26, "ast": 18, "tov": 9, "stl": 5, "blk": 1, "oer": 1.3506, "der": 1.1837, "net_rating": 0.1669, "efg_pct": 0.6692, "ts_pct": 0.6842 },
  "diff": { "oer": -0.1667, "der": -0.4362, "net_rating": 0.2695, "efg_pct": -0.1179, "ts_pct": -0.1055 }
}
```

- `usg_pct` — USO% promedio del jugador (`calc_player_stats`, mismo cálculo que `/api/search/players`).
- **Conteos crudos del equipo (RF-8):** `pts_for`, `pts_against`, `reb`/`orb`/`drb`, `ast`, `tov`, `stl`, `blk` en cada conjunto ON/OFF. Escalan con los minutos del conjunto (ON suele tener más posesiones), así que su Δ no es comparable directo — las tasas sí lo son. El frontend calcula el Δ de conteos como `ON − OFF`.
- `diff = ON − OFF` (solo tasas); `null` si cualquiera de los dos lados no tiene dato (denominador 0, ver CA-2 en `sdd/specs/04-on-off/spec.md`).
- Si ON u OFF tienen `possessions: 0` (jugador jugó 0 o el 100% de los minutos), sus métricas de tasa son `null` (no `NaN`/`Infinity`).

**Errores:** `404` — `{"error": "Sin datos ON/OFF para este jugador"}` (jugador o equipo sin datos) / `{"error": "Equipo no encontrado o sin play-by-play"}`.

---

## GET `/api/competitions`

Competencias y temporadas (F-11). Una competencia **en una temporada** es el universo de cálculo. Sin parámetros devuelve solo las `publicada` (selectores); con `?include_hidden=1` también las `borrador` (sección Datos). Orden: último partido más reciente primero.

**Response:**
```json
[{ "id": 1, "name": "Liga Uruguaya de Basquetbol", "season": "2025/2026",
   "label": "Liga Uruguaya de Basquetbol 2025/2026", "status": "publicada",
   "games": 13, "teams": 12, "first_date": "2025-10-03", "last_date": "2025-11-14" }]
```

> **Cambio de forma:** antes devolvía una lista de strings.

### POST `/api/competitions` — admin
`{ "name": "Liga de Ascenso", "season": "2026" }` → `201` con el objeto. `400` sin nombre · `409` ya existe (nombre + temporada, sin distinguir mayúsculas).

### PATCH `/api/competitions/<id>` — admin
Parcial: `{ "name"?, "season"?, "status"? }` con `status` ∈ `publicada` · `borrador`. `400` estado inválido · `404` · `409` duplicado.

### POST `/api/competitions/<id>/merge` — admin
`{ "source_id": 2 }`: los partidos y alias de la competencia 2 pasan a `<id>` y la 2 se borra. Una importación futura con el texto de la 2 queda en `<id>`. **Response:** `{ "ok": true, "target": {…}, "moved_games": 4, "moved_aliases": 1 }`. `409` fusionar consigo misma.

---

## GET `/api/data-quality`

Informe de calidad de una competencia (F-11). **Query:** `?competition=<id>` (obligatorio).

**Response:**
```json
{
  "competition": { "id": 1, "label": "Liga de Ascenso 2026", "status": "borrador", "...": "..." },
  "summary": { "games": 13, "incomplete_games": 1, "incomplete_ids": ["2849340"],
               "ready_to_publish": false, "ingest_version": 2 },
  "checks": {
    "games_without_pbp":       { "status": "alerta", "count": 1, "counts_as_incomplete": true,
                                 "items": [{ "game_id": "2849340", "date": "2026-06-10", "label": "A 81 – 77 B" }] },
    "games_missing_data":      { "...": "sin los dos equipos, sin jugadores o sin fecha" },
    "games_needing_reprocess": { "...": "ingest_version anterior a la vigente" },
    "pbp_box_mismatch":        { "...": "PTS / TCi / TLi del pbp ≠ box; items con team_code y detail" },
    "lineup_inconsistencies":  { "...": "sin 5 titulares, tramos que no suman 60 × minutos o sin 5 en cancha" },
    "games_without_coords":    { "counts_as_incomplete": false },
    "null_fields":             { "items": [{ "table": "player_game_stats", "field": "position",
                                             "label": "Posición del jugador", "nulls": 18, "total": 312, "pct": 0.0577 }] },
    "possible_duplicates":     { "items": [{ "team_code": "OMU", "norm_key": "a. caldas",
                                             "variants": [{ "player_name": "A. Caldas", "games": 5 }] }] },
    "possession_gaps":         { "status": "no_disponible", "count": null, "reason": "requiere_posesiones" }
  }
}
```

Un partido es **incompleto** si falla un chequeo con `counts_as_incomplete: true`; la competencia está lista para publicar si no tiene incompletos. `status` de cada chequeo: `ok` · `alerta` · `no_disponible`.

---

## POST `/api/reprocess` — admin

Re-ejecuta la ingesta vigente sobre partidos ya importados: desde el JSON archivado, o desde FIBA (por id) si el partido se importó antes de que existiera el archivo. Idempotente; conserva la competencia asignada.

- `{ "game_ids": [...], "offset": 0 }` o `{ "competition_id": 1, "offset": 0 }`: procesa un lote de 5 partidos (`ingest.REPROCESS_BATCH`) a partir de `offset`; el cliente repite con `next_offset` hasta que sea `null`. Con 5 por lote, el peor caso (5 descargas de FIBA × 20 s) queda debajo del timeout de 180 s de gunicorn.

**Response:** `{ "processed": ["2849328", …], "failed": [{ "game_id": "…", "error": "motivo" }], "total": 13, "next_offset": 5 }`. Un partido fallido no corta el lote.

Si un partido trae filas repetidas por clave única (dos jugadores del mismo equipo con igual nombre abreviado, eventos sin número), se guarda una sola (jugador: la última ficha; tiro/evento: el primero), igual que la ingesta anterior.

---

## GET `/api/league`

Ranking de todos los equipos ordenado por OER descendente.

**Query params:** `?competition=<id>` (opcional; también acepta el texto de FIBA) — filtra el ranking y sus promedios a los partidos de esa competencia. Sin el parámetro, agrega todas las competencias publicadas. Equipos sin partidos en la competencia se omiten; competencia inexistente → `400`.

**Response:**
```json
[
  {
    "team_code": "FUBB",
    "team_name": "Federación Uruguaya",
    "games": 12,
    "oer": 1.05,
    "der": 0.98,
    "net_rating": 0.07,
    "efg_pct": 0.512,
    "ts_pct": 0.548,
    "or_pct": 0.29,
    "dr_pct": 0.71,
    "to_pct": 0.14,
    "pace": 68.5,
    "pts": 72.3
  }
]
```

> **Competencia en game_log:** `GET /api/team/<code>` y `GET /api/player/<code>/<name>` incluyen en cada entrada de `game_log` `competition` (texto de FIBA), `competition_id` y `competition_label`; el frontend filtra por `competition_id` y recompute los promedios client-side. El mapa `leagues` usa como clave el id de competencia (como string); `""` es el agregado. `GET /api/search/players` devuelve en `competitions[]` las etiquetas. El `game_log` de equipo está en orden cronológico.

---

## DELETE `/api/games`

**Admin.** Borra uno o más partidos por `game_id`. El borrado es en cascada: elimina también sus `team_game_stats`, `player_game_stats`, `shots`, `pbp_events` y el JSON archivado.

**Request body:**
```json
{ "game_ids": ["12345", "12346"] }
```

**Response 200:**
```json
{ "ok": true, "deleted": 2 }
```

**Errores:**
- `400` — `game_ids[]` ausente o no es lista
- `401` — sin sesión iniciada (ver [Autenticación](#autenticación))
- `403` — el usuario no es administrador

---

## Autenticación

Ver diseño completo en [superpowers/specs/2026-06-06-login-auth-design.md](superpowers/specs/2026-06-06-login-auth-design.md).

Cuando hay credenciales configuradas (`AUTH_USERS`), **todas las rutas de datos exigen sesión iniciada** (cookie de sesión firmada, HttpOnly). Sin sesión → `401`. Abiertas siempre: `/` (SPA), estáticos, `POST /api/login`, `GET /api/me`.

### POST `/api/login`

**Request:** `{ "user": "nico", "password": "..." }`

**Response 200:** `{ "ok": true, "user": "nico" }` + cookie de sesión.

**Errores:** `401` credenciales inválidas · `429` demasiados intentos (5 fallos/IP/60s).

### POST `/api/logout`

Limpia la sesión. **Response:** `{ "ok": true }`.

### GET `/api/me`

Estado de auth + feature flags. Llamada por el SPA al arrancar. Siempre abierta.

**Response:**
```json
{ "authenticated": false, "user": null, "auth_required": true, "seed_enabled": false, "is_admin": false }
```

`seed_enabled` refleja `SEED_ENABLED` (reemplaza al antiguo `/api/config`). `is_admin`: puede modificar datos (ver permisos de escritura arriba); la UI oculta las acciones que no puede ejecutar.

---

## POST `/api/seed` — solo dev

Importa el set fijo de partidos `SEED_URLS` (definido en `app.py`) en una sola operación. Pensado para repoblar el entorno dev sin disco persistente.

**Gating:** requiere sesión iniciada **y** `SEED_ENABLED=true`. Sin la variable (producción) responde `403`; sin sesión, `401`.

**Response 200:**
```json
{
  "ok": true,
  "imported": 12,
  "failed": 1,
  "results": [
    { "url": "...", "ok": true,  "game_id": "2849328", "teams": "A vs B" },
    { "url": "...", "ok": false, "error": "mensaje" }
  ]
}
```

**Errores:** `403` — `SEED_ENABLED` no está habilitado.
