# API REST

Base URL producción: `https://estadisticas-basket.onrender.com`  
Base URL local: `http://localhost:5000`

Todas las rutas bajo `/api/`. Respuestas en JSON. Errores retornan `{"error": "mensaje"}` con código HTTP apropiado.

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
  "summary": {
    "global_pf": 1.05,
    "efg_pct":   0.512,
    "ppp":       0.98,
    "games":     10
  }
}
```

Por zona: `made`, `attempts`, `pct` (% acierto) y `pf` (puntos por intento = made × valor zona / attempts; `null` si 0 intentos).

`summary`:
- `global_pf` — puntos por tiro global
- `efg_pct` — eFG% derivado de los tiros con zona
- `ppp` — puntos por posesión del jugador (de `player_game_stats`, no solo tiros)
- `games` — partidos con datos de tiro

Tiros sin coordenadas (`x=0, y=0`, partido sin array `shot` en FIBA) caen en `top_key_3` (3PT) o `mid_top` (2PT).

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

**Headers:** si la variable de entorno `ADMIN_TOKEN` está definida, se exige `X-Admin-Token: <token>`. Sin la variable, el endpoint queda abierto (uso local).

**Response 200:**
```json
{ "ok": true, "deleted": 2 }
```

**Errores:**
- `400` — `game_ids[]` ausente o no es lista
- `401` — `X-Admin-Token` faltante o incorrecto (solo si `ADMIN_TOKEN` está seteado)

---

## GET `/api/config`

Feature flags para el frontend.

**Response:**
```json
{ "seed_enabled": false }
```

`seed_enabled` refleja la variable de entorno `SEED_ENABLED`. El frontend muestra el botón "Agregar partidos" solo si es `true`.

---

## POST `/api/seed` — solo dev

Importa el set fijo de partidos `SEED_URLS` (definido en `app.py`) en una sola operación. Pensado para repoblar el entorno dev sin disco persistente.

**Gating:** requiere `SEED_ENABLED=true`. Sin la variable (producción) responde `403`.

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
