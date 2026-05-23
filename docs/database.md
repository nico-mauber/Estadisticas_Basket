# Base de datos

## Configuración

- Motor: **SQLite 3**
- Archivo local: `backend/basketball.db`
- Archivo producción: `/data/basketball.db` (disco persistente Render.com)
- Configurado via variable de entorno `DB_PATH`
- `PRAGMA foreign_keys = ON` activo en cada conexión

## Esquema

### `games`
Un registro por partido importado.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `game_id` | TEXT UNIQUE NOT NULL | ID numérico extraído de la URL FIBA |
| `competition` | TEXT | Nombre de la competencia |
| `date` | TEXT | Fecha en formato `YYYY-MM-DD` |
| `home_team` | TEXT | Nombre equipo local |
| `home_code` | TEXT | Código corto equipo local (ej. `FUBB`) |
| `away_team` | TEXT | Nombre equipo visitante |
| `away_code` | TEXT | Código corto equipo visitante |
| `home_score` | INTEGER | Puntos equipo local |
| `away_score` | INTEGER | Puntos equipo visitante |
| `minutes` | INTEGER DEFAULT 40 | Duración del partido (usado para pace) |
| `imported_at` | TEXT DEFAULT now | Timestamp de importación |

---

### `team_game_stats`
Stats de box score por equipo por partido. Incluye stats del rival pre-calculadas para evitar JOINs costosos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `game_id` | TEXT FK → games | |
| `team_code` | TEXT NOT NULL | |
| `team_name` | TEXT NOT NULL | |
| `is_home` | INTEGER NOT NULL | 1=local, 0=visitante |
| `pts` | INTEGER | Puntos |
| `fgm` / `fga` | INTEGER | Tiros de campo totales |
| `fgm2` / `fga2` | INTEGER | Tiros de 2 puntos |
| `fgm3` / `fga3` | INTEGER | Tiros de 3 puntos |
| `ftm` / `fta` | INTEGER | Tiros libres |
| `orb` / `drb` / `trb` | INTEGER | Rebotes ofensivos/defensivos/totales |
| `ast` | INTEGER | Asistencias |
| `tov` | INTEGER | Pérdidas |
| `stl` | INTEGER | Robos |
| `blk` | INTEGER | Tapas |
| `pf` | INTEGER | Faltas personales |
| `opp_pts` | INTEGER | Puntos del rival |
| `opp_fga2` / `opp_fga3` | INTEGER | Intentos de tiro del rival |
| `opp_fta` | INTEGER | Tiros libres intentados del rival |
| `opp_orb` / `opp_drb` | INTEGER | Rebotes del rival |
| `opp_tov` | INTEGER | Pérdidas del rival |

**Restricción única:** `(game_id, team_code)`

---

### `player_game_stats`
Stats individuales por jugador por partido.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `game_id` | TEXT FK → games | |
| `team_code` | TEXT NOT NULL | |
| `team_name` | TEXT NOT NULL | |
| `player_name` | TEXT NOT NULL | Nombre completo (de FIBA) |
| `jersey` | TEXT | Número de camiseta |
| `minutes` | TEXT | Minutos jugados (formato `MM:SS`) |
| `pts` | INTEGER | |
| `fgm` / `fga` | INTEGER | |
| `fgm2` / `fga2` | INTEGER | |
| `fgm3` / `fga3` | INTEGER | |
| `ftm` / `fta` | INTEGER | |
| `orb` / `drb` / `trb` | INTEGER | |
| `ast` / `tov` / `stl` / `blk` / `pf` | INTEGER | |

**Restricción única:** `(game_id, team_code, player_name)`

---

### `shots`
Registro de cada tiro por partido. Tiene coordenadas `x/y` si vienen del array `shot` de FIBA; si viene del play-by-play, `x=0, y=0`.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `game_id` | TEXT FK → games | |
| `team_code` | TEXT NOT NULL | |
| `player_name` | TEXT | |
| `x` | REAL | Coordenada horizontal (espacio FIBA 0–100) |
| `y` | REAL | Coordenada vertical (espacio FIBA 0–100) |
| `made` | INTEGER | 1=convertido, 0=fallado |
| `action_type` | TEXT | `"2pt"` o `"3pt"` |
| `sub_type` | TEXT | Ej. `"layup"`, `"dunk"`, `"jumpshot"` |
| `period` | INTEGER | Período del partido |
| `action_number` | INTEGER | Número de acción en el play-by-play |

**Restricción única:** `(game_id, action_number)`

## Clasificación de zonas de tiro

`app.py::_classify_zone()` asigna cada tiro a una de 4 zonas:

| Zona | Criterio |
|------|----------|
| `paint` | 2PT con sub_type que contenga: layup, dunk, alley, tip, hook, putback, driving |
| `mid_range` | 2PT que no sea paint |
| `corner_3` | 3PT con `y < 15` o `y > 85` (esquinas según coordenadas FIBA) |
| `above_break_3` | 3PT restante (arco superior) |

## Inicialización

```bash
python backend/database.py
```

Crea todas las tablas con `CREATE TABLE IF NOT EXISTS` — es idempotente y seguro de correr múltiples veces.
