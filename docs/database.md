# Base de datos

## Configuración

- Motor: **SQLite 3** vía **Flask-SQLAlchemy 3.1** (ORM, no SQL crudo)
- Archivo local: `backend/basketball.db`
- Archivo producción: `/data/basketball.db` (disco persistente Render.com)
- Configurado via variable de entorno `DB_PATH`
- Integridad referencial mediante `cascade="all, delete-orphan"` en las relaciones del ORM (borrar un `Game` elimina sus stats y tiros)

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
| `opp_pf` | INTEGER | Faltas del rival (faltas recibidas) |
| `paint_pts` | INTEGER | Puntos en la pintura (PeP) |
| `second_chance_pts` | INTEGER | Puntos de segunda oportunidad (PtsSegCh) |
| `pts_from_tov` | INTEGER | Puntos tras pérdida rival (PtPer) |
| `bench_pts` | INTEGER | Puntos del banco |
| `fast_break_pts` | INTEGER | Puntos de contraataque (PCA) |

**Restricción única:** `(game_id, team_code)`

> Las 6 columnas de desglose (`opp_pf` … `fast_break_pts`) provienen del box score FIBA. Partidos importados antes de su incorporación las muestran en `0` hasta reimportar.

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
| `position` | TEXT DEFAULT `''` | Posición FIBA (`playingPosition`: G/F/C/PG/PF...). Vacío en partidos importados antes de su incorporación hasta reimportar |
| `plus_minus` | INTEGER DEFAULT 0 | Plus/Minus del partido (`sPlusMinusPoints` FIBA; puede ser negativo) |
| `starter` | INTEGER DEFAULT 0 | 1=titular en ese partido (`starter` FIBA). Base para reconstruir el quinteto inicial (lineups/on-off) |
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

---

### `pbp_events`
Play-by-play completo: un registro por evento de FIBA (`raw["pbp"]`). Base de lineups (Feature 03), on/off (Feature 04) y clutch (Feature 05). A diferencia de `shots` (solo 2pt/3pt), guarda **todos** los tipos de evento.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `game_id` | TEXT FK → games | |
| `team_code` | TEXT | `""` en eventos no-equipo (`game`/`period`, `tno=0`) |
| `player_name` | TEXT | `""` en eventos no-jugador |
| `period` | INTEGER | Período |
| `period_type` | TEXT | `REGULAR` / `OT` |
| `clock_secs` | INTEGER | Segundos **restantes** en el período (de `gt` `MM:SS`) |
| `s1` / `s2` | INTEGER | Marcador corrido local / visitante tras el evento |
| `action_type` | TEXT | `2pt`, `3pt`, `rebound`, `assist`, `steal`, `block`, `turnover`, `freethrow`, `foul`, `foulon`, `substitution`, `timeout`, `jumpball`, `game`, `period` |
| `sub_type` | TEXT | Ej. `in`/`out` (substitution), `layup`, etc. |
| `success` | INTEGER | 1=exitoso (según el tipo de acción) |
| `action_number` | INTEGER | Número de acción en el play-by-play |

**Restricción única:** `(game_id, action_number)` — reimportar es idempotente (insert-or-ignore).

> Partidos importados antes de la Feature 02 no tienen `pbp_events` hasta reimportarse.

## Clasificación de zonas de tiro

`app.py::_classify_zone_11()` asigna cada tiro a una de **11 zonas** (sistema de coordenadas FIBA normalizado: `x` 0–100 centro=50, `y` 0–100 línea de fondo=0):

| Zona | Puntos | Criterio |
|------|--------|----------|
| `restricted_area` | 2 | Pintura (sub_type de pintura, o `34 ≤ x ≤ 66`) |
| `mid_left_close` / `mid_right_close` | 2 | Fuera de pintura, cerca del fondo (`y < 25`) |
| `mid_left_far` / `mid_right_far` | 2 | Media distancia, codos/alas (`y ≥ 25`) |
| `mid_top` | 2 | Poste alto central (`x 42–58`, `y ≥ 25`) |
| `left_corner_3` / `right_corner_3` | 3 | Triple de esquina (`y < 14`) |
| `left_wing_3` / `right_wing_3` | 3 | Triple de ala (`x < 38` o `x ≥ 62`) |
| `top_key_3` | 3 | Triple frontal / sin coordenadas |

Constantes asociadas en `app.py`: `ZONE_KEYS_11`, `ZONE_POINTS`, `_2PT_ZONES`, `_3PT_ZONES`. Tiros sin coordenadas (`x=0, y=0`) caen en `top_key_3` (3PT) o `mid_top` (2PT sin keyword de pintura).

## Inicialización y migración

```bash
python backend/database.py
```

`init_db(app)` crea todas las tablas con `db.create_all()` (idempotente). Al arrancar `app.py` también corre `upgrade_db(app)`, que aplica `ALTER TABLE ADD COLUMN` para las columnas nuevas sobre DBs existentes — silencioso e idempotente (ignora columnas ya presentes). No requiere herramienta de migración externa.
