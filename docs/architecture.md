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
│  │   fiba_fetcher.py  (scraping FIBA LiveStats)     │   │
│  │   stats_engine.py  (métricas avanzadas)          │   │
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
│  frontend/js/app.js  │  SPA, 5 vistas (+ login)
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
- rate-limit en memoria (5 fallos/IP/60s).

La sesión es una cookie firmada (`SECRET_KEY`), `HttpOnly` + `SameSite=Lax` + `Secure` en prod. Ver [api.md → Autenticación](api.md#autenticación).

### `fiba_fetcher.py`
Extrae datos de FIBA LiveStats.

**Estrategia de fetch:**
1. Extrae el `game_id` numérico de la URL `bs.html`.
2. Construye la URL directa `data/{game_id}/data.json`.
3. Intenta fetch con `urllib` + headers de navegador.
4. Si falla con 403, hace fallback a Playwright (Chromium headless).
5. Playwright es opcional (`try/except ImportError`): en producción sin navegador instalado simplemente falla con mensaje claro.

**Salida:** dict normalizado con claves `game_id`, `competition`, `date`, `teams[]`, `players[]`, `shots[]`.

`competition` y `date` **no vienen en el `data.json`** de FIBA — se scrapean de la página `bs.html` (`_fetch_page_info`: `span#competitionName` para la competencia, patrón de fecha para la fecha).

### `stats_engine.py`
Calcula métricas avanzadas on-the-fly en cada request (no se persisten en DB).

- `calc_team_stats(t, opp)` — recibe stats crudas del equipo y del rival, retorna ~35 métricas.
- `calc_player_stats(p, team_pos)` — versión jugador.
- `league_averages(all_stats)` — media y mejor valor de la liga para cada métrica.

Ver [metrics.md](metrics.md) para fórmulas completas.

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
3. fiba_fetcher.fetch_game_data(url)
   ├─ fetch data.json (urllib o Playwright)
   └─ _parse_fiba_json() → normaliza teams[], players[], shots[]
        │
        ▼
4. app.py → upsert (ON CONFLICT DO UPDATE) en games, team_game_stats,
                  player_game_stats, shots
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
| Upsert (`ON CONFLICT DO UPDATE`) | Importar el mismo partido dos veces es idempotente |
| Migración vía `upgrade_db()` | `ALTER TABLE ADD COLUMN` idempotente al arranque; evita dependencia de Alembic |
| Credenciales en env var (no tabla `users`) | Sobreviven redeploys en dev (disco efímero) y prod por igual; sin schema nuevo |
| Login gateado por entorno | Mismo código en dev/prod; la fuerza del login = qué `AUTH_USERS` se configura por servicio |
