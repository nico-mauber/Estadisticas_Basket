# Base de datos

## Configuración

- Motor: **SQLite 3** vía **Flask-SQLAlchemy 3.1** (ORM, no SQL crudo)
- Archivo local: `backend/basketball.db`
- Archivo producción: `/data/basketball.db` (disco persistente Render.com)
- Configurado via variable de entorno `DB_PATH`
- Integridad referencial mediante `cascade="all, delete-orphan"` en las relaciones del ORM (borrar un `Game` elimina sus stats y tiros)

## Esquema

### `competitions`
Una competencia **en una temporada** (F-11): universo de cálculo de percentiles, promedios y rankings.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT NOT NULL | Nombre sin la temporada (ej. `Liga de Ascenso`) |
| `season` | TEXT | Temporada detectada al final del texto de FIBA (`2026`, `2025/2026`); NULL si no hay |
| `status` | TEXT NOT NULL DEFAULT `publicada` | `publicada` · `borrador` (sus partidos solo se ven en la sección Datos) |
| `created_at` | TEXT | |

(`name`, `season`) es único sin distinguir mayúsculas; se valida en `competitions.py` porque SQLite trata dos NULL como distintos en un UNIQUE.

### `competition_aliases`
Texto de competencia tal como llega de FIBA → competencia. Permite renombrar y fusionar sin tocar `games.competition`.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `source_name` | TEXT PK | Texto crudo (ej. `Liga de Ascenso 2026`) |
| `competition_id` | INTEGER NOT NULL FK → competitions | |

### `game_sources`
JSON crudo de FIBA archivado para reprocesar sin volver a descargarlo (F-11, DA-12). ~50 KB por partido.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `game_id` | TEXT PK FK → games | Se borra en cascada con el partido |
| `source_url` | TEXT | URL importada (NULL si se archivó al reprocesar un partido viejo) |
| `fetched_at` | TEXT | |
| `raw_gz` | BLOB | `data.json` comprimido con gzip |
| `page_info` | TEXT | JSON `{date, competition}` scrapeado de `bs.html` |

### `games`
Un registro por partido importado.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `game_id` | TEXT UNIQUE NOT NULL | ID numérico extraído de la URL FIBA |
| `competition` | TEXT | Texto de competencia tal como lo publica FIBA (crudo, no se edita) |
| `date` | TEXT | Fecha en formato `YYYY-MM-DD` |
| `home_team` | TEXT | Nombre equipo local |
| `home_code` | TEXT | Código corto equipo local (ej. `FUBB`) |
| `away_team` | TEXT | Nombre equipo visitante |
| `away_code` | TEXT | Código corto equipo visitante |
| `home_score` | INTEGER | Puntos equipo local |
| `away_score` | INTEGER | Puntos equipo visitante |
| `minutes` | INTEGER DEFAULT 40 | Duración real: 40 + 5 por prórroga (PACE, rebote individual). 40 en partidos no reprocesados |
| `imported_at` | TEXT DEFAULT now | Timestamp de importación |
| `competition_id` | INTEGER | Competencia asignada (F-11): por alias al importar, o manual. Backfill idempotente al arrancar |
| `ingest_version` | INTEGER | Versión de la ingesta con que se guardó (`ingest.INGEST_VERSION`); NULL = previa a F-11 → pendiente de reproceso |

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
| `paint_pts` | INTEGER | Puntos en la pintura. **Etiqueta de UI: `PtsEnPint`** (antes `PeP`) — la columna NO se renombra (C-05 / Constitución 5) |
| `second_chance_pts` | INTEGER | Puntos de segunda oportunidad (PtsSegCh) |
| `pts_from_tov` | INTEGER | Puntos tras pérdida rival (PtPer) |
| `bench_pts` | INTEGER | Puntos del banco |
| `fast_break_pts` | INTEGER | Puntos de contraataque (PCA) |

**Restricción única:** `(game_id, team_code)`

> Las 6 columnas de desglose (`opp_pf` … `fast_break_pts`) provienen del box score FIBA. Partidos importados antes de su incorporación las muestran en `0` hasta reimportar.
>
> `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts` y `fast_break_pts` se guardan **`NULL`** si FIBA no manda la clave (la competencia no publica el dato) y `0` solo si FIBA informa 0 (C-11). El `DEFAULT 0` de la columna solo aplica a filas viejas; reimportar un partido reescribe el valor.

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
| `plus_minus` | INTEGER DEFAULT 0 | Plus/Minus del partido (`sPlusMinusPoints` FIBA; puede ser negativo). `NULL` si FIBA no manda la clave (C-11) |
| `starter` | INTEGER DEFAULT 0 | 1=titular en ese partido (`starter` FIBA). Base para reconstruir el quinteto inicial (lineups/on-off) |
| `pts` | INTEGER | |
| `fgm` / `fga` | INTEGER | |
| `fgm2` / `fga2` | INTEGER | |
| `fgm3` / `fga3` | INTEGER | |
| `ftm` / `fta` | INTEGER | |
| `orb` / `drb` / `trb` | INTEGER | |
| `ast` / `tov` / `stl` / `blk` / `pf` | INTEGER | |

**Restricción única:** `(game_id, team_code, player_name)` — sobre el nombre **crudo**, tal como llega de FIBA.

> **Identidad vs unicidad.** La restricción de arriba no define quién es un jugador: solo impide dos filas idénticas en un mismo partido. La **identidad** se resuelve al leer, por nombre normalizado + equipo (`norm_name()` en `stats_engine.py`), de modo que dos grafías del mismo nombre (`"C. Zinaich"` / `"C.  ZINAICH"`) se unifican en una sola ficha sin tocar los datos. Esto cubre todo el histórico sin migración. Ver `sdd/specs/13-dedup-jugadores/`.
>
> La columna `position` puede venir vacía en algunos partidos (FIBA no siempre carga `playingPosition`): al unificar gana la más frecuente entre las no vacías.

---

### `shots`
Registro de cada tiro por partido, uno por evento `2pt`/`3pt` del play-by-play. Las coordenadas reales van en `court_x/court_y`; `x/y` quedan en 0.

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
| `court_x` / `court_y` | REAL | Coordenadas reales de FIBA (`tm[n].shot[]`): 0–100 a lo largo / a lo ancho de la cancha **completa**. NULL si el partido no las trae o no se reprocesó |

**Restricción única:** `(game_id, action_number)`

> `x`/`y` siguen en 0: la clasificación de 11 zonas asume otra geometría y se rehace con `court_x/court_y` en C-03.

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
| `period_type` | TEXT | `REGULAR` / `OVERTIME` (en prórroga `period` reinicia en 1) |
| `clock_secs` | INTEGER | Segundos **restantes** en el período (de `gt` `MM:SS`) |
| `s1` / `s2` | INTEGER | Marcador corrido local / visitante tras el evento |
| `action_type` | TEXT | `2pt`, `3pt`, `rebound`, `assist`, `steal`, `block`, `turnover`, `freethrow`, `foul`, `foulon`, `substitution`, `timeout`, `jumpball`, `game`, `period` |
| `sub_type` | TEXT | Ej. `in`/`out` (substitution), `layup`, etc. |
| `success` | INTEGER | 1=exitoso (según el tipo de acción) |
| `action_number` | INTEGER | Número de acción en el play-by-play |

**Restricción única:** `(game_id, action_number)`.

> **Reimportar / reprocesar** (F-11): el partido se hace upsert y sus filas de `team_game_stats`, `player_game_stats`, `shots` y `pbp_events` se **reemplazan** completas. Mismo resultado y misma cantidad de filas sin importar cuántas veces se repita.

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

### Regla para columnas nuevas (C-11, vinculante)

Toda columna nueva que guarde un dato publicado por FIBA se crea **sin valor por defecto** (`NULL` = "no importado todavía" o "la competencia no lo publica"), y la ingesta escribe `0` **solo** cuando FIBA informa 0. Un `DEFAULT 0` haría indistinguible "no hay dato" de "vale cero", y ese cero falso entraría en promedios y rankings.
