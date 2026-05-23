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

**Comportamiento:** `INSERT OR REPLACE` — importar el mismo partido dos veces es idempotente.

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

Shot chart por zonas del jugador vs promedios de liga.

**Response:**
```json
{
  "zones": {
    "paint":         { "made": 45, "attempts": 80, "pct": 0.5625 },
    "mid_range":     { "made": 12, "attempts": 30, "pct": 0.40 },
    "corner_3":      { "made": 8,  "attempts": 20, "pct": 0.40 },
    "above_break_3": { "made": 15, "attempts": 45, "pct": 0.333 }
  },
  "league_zones": {
    "paint":         { "made": 1200, "attempts": 2400, "pct": 0.50 },
    "...": "..."
  },
  "total_shots": 175
}
```

Si el jugador no tiene datos de coordenadas (partido sin array `shot` en FIBA), `x=0, y=0` — todos los tiros caen en `mid_range` o `above_break_3` según tipo.

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
