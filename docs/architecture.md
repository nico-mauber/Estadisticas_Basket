# Arquitectura

## Visión general

Smart-Basket es un monolito full-stack: Flask sirve tanto la API REST como los archivos estáticos del frontend. Cuando hay credenciales configuradas (`AUTH_USERS`), toda la app queda detrás de un login con sesión por cookie (ver [auth.py](#authpy)).

```
┌─────────────────────────────────────────────────────────┐
│                     Render.com                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  gunicorn → Flask (backend/app.py)               │   │
│  │                                                  │   │
│  │   /api/*  ──→  routes Flask                      │   │
│  │   /*       ──→  frontend/index.html (static)     │   │
│  │                                                  │   │
│  │   auth.py          (login + sesión, env-gated)   │   │
│  │   fiba_fetcher.py  (descarga + parseo FIBA)      │   │
│  │   ingest.py        (persistencia + reproceso)    │   │
│  │   competitions.py  (competencias y temporadas)   │   │
│  │   data_quality.py  (panel de calidad)            │   │
│  │   stats_engine.py  (métricas avanzadas)          │   │
│  │   clutch.py        (cierres, sobre pbp_events)   │
│   lineups.py       (quintetos: lineups + on/off) │   │
│  │   database.py      (SQLite vía /data/basketball.db)│  │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Persistent Disk 1GB  →  /data/basketball.db            │
└─────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS
         ▼
┌──────────────────────┐
│  Browser / PWA       │
│  frontend/js/app.js  │  SPA, 6 vistas (+ login)
│  frontend/sw.js      │  Service Worker (cache offline)
└──────────────────────┘
```

## Componentes backend

### `app.py`
Punto de entrada Flask. Registra todas las rutas `/api/*`. Llama a los otros módulos; no contiene lógica de negocio.

### `auth.py`
Autenticación, aislada de `app.py`. Credenciales en la variable de entorno `AUTH_USERS` (JSON `usuario→hash`); sin tabla de usuarios (sobrevive redeploys en dev y prod por igual). Provee:
- `load_users()` / `auth_enabled()` — parseo cacheado, fail-closed si el JSON es inválido.
- `verify(user, password)` — valida con `werkzeug.check_password_hash`.
- `login_required` — decorador que exige sesión; gatea todas las rutas de datos.
- `admin_required` / `is_admin()` — gate de las rutas que modifican datos (borrar, reasignar, editar competencias, reprocesar). Con `ADMIN_USERS` (lista separada por coma) solo esos usuarios; sin la variable, todo usuario autenticado; app abierta = todos (F-11, DA-18).
- rate-limit en memoria (5 fallos/IP/60s).

La sesión es una cookie firmada (`SECRET_KEY`), `HttpOnly` + `SameSite=Lax` + `Secure` en prod. Ver [api.md → Autenticación](api.md#autenticación).

### `fiba_fetcher.py`
Extrae datos de FIBA LiveStats.

Descarga y parseo están separados para poder reprocesar desde el JSON archivado sin red:
- `fetch_raw(url)` → `(raw, page_info)`: `data/{game_id}/data.json` por `urllib` (Playwright solo como respaldo, no existe en Render) + fecha y competencia scrapeadas de `bs.html` (no vienen en el `data.json`).
- `fetch_raw_by_id(game_id)` → `raw`: para reprocesar partidos importados antes de que existiera el archivo.
- `parse_game(raw, game_id, page_info)` → dict normalizado (`teams[]`, `players[]`, `shots[]`, `pbp[]`, `minutes`). Puro: no accede a la red.
- `fetch_game_data(url)` = `parse_game(*fetch_raw(url))`.

**Coordenadas de tiro:** FIBA sí las publica, en `tm[n].shot[]` (cancha completa, 0–100). Se unen al pbp por `actionNumber` y se guardan en `shots.court_x/court_y`; `x/y` (legado) quedan en 0 hasta que C-03 clasifique zonas con esta geometría. **Minutos:** 40 + 5 por prórroga (`periodType = "OVERTIME"`).

### `ingest.py`
Persistencia de partidos (F-11). `import_url(url)` descarga, guarda y archiva; `persist_game(game)` hace upsert de `games` (conserva la competencia asignada) y **reemplaza** sus filas hijas (equipos, jugadores, tiros, pbp), así reprocesar es idempotente y no deja filas huérfanas; `archive_raw` guarda el JSON crudo gzip en `game_sources`; `reprocess_games(ids)` re-ejecuta la ingesta desde el archivo (o desde FIBA si no hay archivo) y reporta fallidos sin cortar el lote. `INGEST_VERSION` marca con qué versión se guardó cada partido.

### `competitions.py`
Competencias y temporadas (F-11): el texto de FIBA se mapea a una competencia por alias; alta, edición, fusión, reasignación de partidos; `hidden_game_ids()` / `visible(query, model)` excluyen de toda lectura los partidos de competencias en borrador.

### `data_quality.py`
Informe de calidad de una competencia (F-11): partidos sin pbp, con datos básicos faltantes, pendientes de reproceso, pbp que no cuadra con el box, quintetos inconsistentes (usa `lineups`), sin coordenadas, campos nulos, posibles duplicados; "posesiones que no cerraron" queda `no_disponible` hasta A-01.

### `stats_engine.py`
Calcula métricas avanzadas on-the-fly en cada request (no se persisten en DB).

- `calc_team_stats(t, opp)` — recibe stats crudas del equipo y del rival, retorna ~35 métricas.
- `calc_player_stats(p, team_pos)` — versión jugador.
- `league_averages(all_stats)` — media y mejor valor de la liga para cada métrica.

Ver [metrics.md](metrics.md) para fórmulas completas.

### `clutch.py`
Agrega el play-by-play (`pbp_events`) para los **últimos 5 minutos** del partido (último período REGULAR con reloj ≤ 5:00 + prórrogas). `team_clutch(games, team_code, team_name, margin=15)` retorna el cierre de UN equipo: un **agregado** ("mini-partido" de todos sus cierres apretados) + un **desglose por partido**, contando solo los partidos con diferencia ≤ `margin` al minuto 5:00 (`_entry_margin`). Usa las fórmulas de `stats_engine`. Alimenta `GET /api/clutch/<team_code>` en la vista Equipo. Base: Feature 02 (pbp persistido). Ver `sdd/specs/05-clutch/spec.md §10` (revisión v2).

### `lineups.py`
Motor de reconstrucción de quintetos en cancha, compartido por **Feature 03 (lineups)** y **Feature 04 (on/off)**. `build_segments(events, team_code, starters)` camina `pbp_events` de un partido y parte en tramos cada vez que el equipo hace una `substitution`; cada tramo guarda el quinteto en cancha (`on_court`), sus eventos y los segundos transcurridos (exacto: 600 s por cuarto, 300 s por prórroga `OVERTIME`). `lineup_stats()` filtra tramos donde una combinación de 3-5 jugadores está en cancha; `onoff_stats()` parte todos los tramos en ON/OFF para un jugador (partición exhaustiva y disjunta por construcción). Alimenta `GET /api/lineup/<team>` y `GET /api/onoff/<team>/<player>`. Base: Feature 02 (`pbp_events` + `starter`).

### `database.py`
SQLite. `DB_PATH` resuelto desde variable de entorno `DB_PATH` (default: `backend/basketball.db`).

Lógica de creación del directorio al cargar el módulo: si el directorio del path no existe, intenta `makedirs`; si hay `PermissionError` (disco no montado en Render), hace fallback al directorio local del módulo.

Ver [database.md](database.md) para esquema completo.

## Flujo de datos principal

```
1. Usuario ingresa URL FIBA LiveStats
        │
        ▼
2. POST /api/import
        │
        ▼
3. ingest.import_url(url)
   ├─ fiba_fetcher.fetch_raw(url) → data.json + fecha/competencia de bs.html
   ├─ fiba_fetcher.parse_game() → teams[], players[], shots[], pbp[], minutes
   ├─ persist_game(): upsert de games (+ competencia por alias) y reemplazo de
   │  team_game_stats, player_game_stats, shots, pbp_events
   └─ archive_raw(): JSON crudo gzip en game_sources (para reprocesar)
        │
        ▼
5. GET /api/team/<code> (u otro endpoint)
   ├─ Lee raw stats de SQLite
   ├─ stats_engine.calc_team_stats() por cada partido
   ├─ stats_engine.league_averages() con todos los partidos
   └─ Retorna JSON con averages + game_log + league context
        │
        ▼
6. frontend/js/app.js renderiza tablas con color-coding
   relativo a promedios de liga
```

## Decisiones de diseño

| Decisión | Razón |
|----------|-------|
| Métricas calculadas on-the-fly | Simplicidad; evita recomputar toda la DB al cambiar fórmulas |
| SQLite en lugar de Postgres | Suficiente para escala FUBB; cero configuración de servidor |
| Monolito Flask sirviendo frontend | Deploy single-service en Render; sin CORS cross-origin en producción |
| Playwright opcional | Render.com no tiene Chromium instalado por defecto |
| Upsert del partido + reemplazo de sus filas hijas | Importar o reprocesar el mismo partido dos veces deja el mismo estado |
| JSON crudo archivado (gzip) | Reprocesar tras un cambio del parser sin depender de FIBA (~50 KB por partido) |
| Competencia por alias del texto de FIBA | Renombrar o fusionar competencias sin tocar el dato scrapeado |
| Migración vía `upgrade_db()` | `ALTER TABLE ADD COLUMN` idempotente al arranque; evita dependencia de Alembic |
| Credenciales en env var (no tabla `users`) | Sobreviven redeploys en dev (disco efímero) y prod por igual; sin schema nuevo |
| Login gateado por entorno | Mismo código en dev/prod; la fuerza del login = qué `AUTH_USERS` se configura por servicio |
