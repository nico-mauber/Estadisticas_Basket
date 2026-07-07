# API REST

Base URL producción: `https://estadisticas-basket.onrender.com`  
Base URL local: `http://localhost:5000`

Todas las rutas bajo `/api/`. Respuestas en JSON. Errores retornan `{"error": "mensaje"}` con código HTTP apropiado.

> **Nulo vs cero en métricas de tasa.** Los campos de tasa (porcentajes, ratios, puntos por posesión: `oer`, `der`, `net_rating`, `efg_pct`, `ts_pct`, `fg2_pct`, `fg3_pct`, `ft_pct`, `ft_rate`, `pps`, `ppp`, `or_pct`, `dr_pct`, `trb_pct`, `to_pct`, `as_pct`, `uso_pct`, etc.) valen **`null`** cuando su denominador es 0 en ese partido (ej. un partido sin tiros libres → `ft_pct: null`, no `0`). En `averages`, esos partidos se **excluyen** del promedio (no cuentan como 0). Las stats de conteo (`pts`, `fta`, `ast`, ...) conservan su 0 real. `null` = "sin dato / sin intentos"; `0` = "valor real cero". Ver `sdd/specs/08-nulos-vs-cero/`.

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
  ]
}
```

**Errores:**
- `400` — campo `url` ausente o vacío
- `502` — FIBA LiveStats no respondió o datos inválidos

**Comportamiento:** upsert (`ON CONFLICT DO UPDATE`) — importar el mismo partido dos veces es idempotente.

---

## GET `/api/games`

Lista todos los partidos importados, ordenados por fecha descendente.

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
    "imported_at": "2024-03-16 10:30:00"
  }
]
```

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

`has_coordinates` — `true` si al menos un tiro del jugador tiene coordenadas reales (`x!=0` o `y!=0`); `false` si todos son `x=0,y=0` (partido importado sin array `shot` de FIBA, caso típico de la competencia FUBB). El frontend usa este flag para elegir entre el chart de 11 zonas y el chart simplificado de 3 zonas (ver [frontend.md](frontend.md#shot-chart)).

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

## GET `/api/clutch`

Cierres de partido: rendimiento en los **últimos 5 minutos** (último período REGULAR con reloj ≤ 5:00 + prórrogas completas). Una fila por equipo-partido (Feature 05). Filtro opcional `?team=<code>`.

**Response:**
```json
[
  {
    "game_id": "2820500", "date": "2026-04-28",
    "team_code": "AGU", "team_name": "Aguada",
    "opponent_code": "DSC", "home_away": "V",
    "pts": 11, "opp_pts": 1, "point_diff": 10,
    "off_rating": 1.375, "def_rating": 0.127,
    "efg_pct": 0.7857, "ts_pct": 0.7857,
    "tov": 1, "ast": 2, "reb": 6,
    "fouls_committed": 1, "fouls_drawn": 2,
    "possessions": 8.0,
    "top_finisher": { "name": "E. Clark", "pts": 6 },
    "top_creator":  { "name": "J. Osimani", "ast": 1 }
  }
]
```

- `off_rating`/`def_rating` = OER/DER (docs/metrics.md) sobre las posesiones del cierre; `null` si 0 posesiones.
- `point_diff` = `pts − opp_pts` en la ventana clutch.
- `top_finisher`/`top_creator` = jugador con más puntos / asistencias **dentro del cierre** (`null` si no hubo).
- Faltas desde `pbp_events`: `fouls_committed` (`foul`), `fouls_drawn` (`foulon`).
- `[]` si ningún partido tiene play-by-play (ver [Feature 02](database.md#pbp_events)).

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
- `sample.seconds` es aproximado (asume 600s por cuarto, 300s por prórroga; no modela reloj detenido).
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
  "on":  { "possessions": 87.0, "seconds": 2682.0, "pts_for": 103, "pts_against": 63, "oer": 1.1839, "der": 0.7475, "net_rating": 0.4364, "efg_pct": 0.5513, "ts_pct": 0.5787 },
  "off": { "possessions": 77.0, "seconds": 2201.0, "pts_for": 104, "pts_against": 91, "oer": 1.3506, "der": 1.1837, "net_rating": 0.1669, "efg_pct": 0.6692, "ts_pct": 0.6842 },
  "diff": { "oer": -0.1667, "der": -0.4362, "net_rating": 0.2695, "efg_pct": -0.1179, "ts_pct": -0.1055 }
}
```

- `usg_pct` — USO% promedio del jugador (`calc_player_stats`, mismo cálculo que `/api/search/players`).
- `diff = ON − OFF`; `null` si cualquiera de los dos lados no tiene dato (denominador 0, ver CA-2 en `sdd/specs/04-on-off/spec.md`).
- Si ON u OFF tienen `possessions: 0` (jugador jugó 0 o el 100% de los minutos), sus métricas de tasa son `null` (no `NaN`/`Infinity`).

**Errores:** `404` — `{"error": "Sin datos ON/OFF para este jugador"}` (jugador o equipo sin datos) / `{"error": "Equipo no encontrado o sin play-by-play"}`.

---

## GET `/api/league`

Ranking de todos los equipos ordenado por OER descendente.

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

---

## DELETE `/api/games`

Borra uno o más partidos por `game_id`. El borrado es en cascada: elimina también sus `team_game_stats`, `player_game_stats` y `shots`.

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
{ "authenticated": false, "user": null, "auth_required": true, "seed_enabled": false }
```

`seed_enabled` refleja `SEED_ENABLED` (reemplaza al antiguo `/api/config`).

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
