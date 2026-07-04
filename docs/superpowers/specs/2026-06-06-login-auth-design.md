# Login / Autenticación — Diseño

**Fecha:** 2026-06-06
**Estado:** Aprobado (diseño) — pendiente plan de implementación

## Objetivo

Proteger **toda la app** detrás de un login. Sin sesión iniciada, no se ve ni se consume nada (ni UI con datos, ni `/api/*`). Un solo sistema de auth, diferenciado **solo por configuración de entorno**: prod con login fuerte (2 cuentas), dev con 1 clave simple, local abierto para desarrollar.

## Alcance

**Incluye:**
- Login con usuario + contraseña, sesión por cookie firmada server-side.
- 2 cuentas fijas en prod, 1 en dev — credenciales en variable de entorno (sin tabla de usuarios).
- Gateo de todas las rutas de datos con `@login_required`.
- Pantalla de login en el SPA, botón "Salir", manejo de sesión expirada.
- Rate-limit básico anti fuerza bruta.

**No incluye (YAGNI):**
- Registro abierto de usuarios.
- Tabla `users` en DB / gestión multi-usuario con datos por usuario.
- Recuperación de contraseña por email, 2FA.
- Token CSRF explícito (se cubre con `SameSite=Lax` + same-origin).

## Decisiones (resueltas en brainstorming)

| Decisión | Elección | Razón |
|----------|----------|-------|
| Qué protege | Toda la app | Datos no públicos |
| Cuentas | 2 fijas (prod), 1 (dev) | Sin auto-registro |
| Sesión | Cookie server-side firmada HttpOnly | Lo más difícil de robar (no expuesto a JS) |
| Almacén credenciales | Env var `AUTH_USERS` (JSON usuario→hash) | Sin cambios de schema; sobrevive redeploys en dev/prod por igual |
| Diferenciación dev/prod | Misma lógica, distinta config de entorno | Un solo código |

## Arquitectura

### Módulo nuevo: `backend/auth.py`

Aísla la lógica de auth para no inflar `app.py`.

- `load_users() -> dict` — parsea env `AUTH_USERS` (JSON `{"usuario": "<hash>"}`). Cachea el parseo. Si el JSON es inválido → loguea error y retorna `{}` (fail-closed: nadie puede entrar).
- `auth_enabled() -> bool` — `True` si `load_users()` tiene ≥1 usuario.
- `verify(user, password) -> bool` — `werkzeug.security.check_password_hash` contra el hash del usuario.
- `login_required(fn)` — decorador. Si `auth_enabled()` y no hay `session.get("user")` → responde `401 {"error": "No autenticado"}`. Si auth deshabilitado (local) → pasa directo.
- `check_rate_limit(ip) -> bool` / `register_fail(ip)` — rate-limit en memoria: máx 5 fallos por IP en ventana de 60s → bloquea 60s. Estructura `dict[ip] = (fails, first_ts)`. Aceptable en memoria (instancia única; se resetea en redeploy).

### Cambios en `app.py`

- `app.secret_key = os.environ.get("SECRET_KEY")`. Si falta (local) → genera uno efímero por proceso (`secrets.token_hex(32)`) y loguea aviso (las sesiones se reinician al reiniciar; OK en local).
- Config de cookie de sesión:
  ```python
  app.config.update(
      SESSION_COOKIE_HTTPONLY=True,
      SESSION_COOKIE_SAMESITE="Lax",
      SESSION_COOKIE_SECURE=os.environ.get("SESSION_SECURE", "").lower() in ("1", "true", "yes"),
      PERMANENT_SESSION_LIFETIME=timedelta(days=30),
  )
  ```
  `SESSION_SECURE` es un flag explícito (no atado a `SECRET_KEY`): se setea `true` en los servicios Render (HTTPS), se deja sin setear en local para poder probar el login sobre `http://localhost`.
- `@login_required` aplicado a todas las rutas de datos.

## Rutas API

### Nuevas

| Ruta | Body | Respuesta |
|------|------|-----------|
| `POST /api/login` | `{user, password}` | `200 {ok, user}` + cookie de sesión; `401` credenciales inválidas; `429` rate-limited |
| `POST /api/logout` | — | `200 {ok}`; limpia la sesión |
| `GET /api/me` | — | `{authenticated, user, auth_required, seed_enabled}` |

`POST /api/login`: en éxito, `session["user"] = user` y `session.permanent = True`. En fallo, `register_fail(ip)`. Antes de validar, `check_rate_limit(ip)`.

`GET /api/me`: siempre abierta (el SPA la llama al arrancar para decidir login vs app). Reporta `auth_required = auth_enabled()`, `authenticated = "user" in session`, `seed_enabled` (reemplaza al actual `/api/config`).

### Gateadas con `@login_required`

`POST /api/import`, `GET /api/games`, `GET /api/teams`, `GET /api/team/<code>`, `GET /api/players/<code>`, `GET /api/player/<code>/<name>`, `GET /api/shots/<code>/<name>`, `GET /api/league`, `DELETE /api/games`, `POST /api/seed`.

### Abiertas (sin login)

`/` (sirve el SPA), estáticos, `POST /api/login`, `GET /api/me`. El SPA es público pero inútil sin datos (todo `/api` de datos da 401).

### Retiros

- Se elimina `ADMIN_TOKEN` / header `X-Admin-Token`. El borrado (`DELETE /api/games`) ahora exige login como el resto.
- Se elimina `GET /api/config` (lo absorbe `/api/me`).

## Seguridad

- **Hashing:** contraseñas como hash pbkdf2 (`werkzeug.security.generate_password_hash`). Nunca en claro. Hashes generados con un comando one-liner y pegados en `AUTH_USERS`.
- **Cookie:** `HttpOnly` (no accesible por JS → inmune a robo por XSS), firmada con `SECRET_KEY`, `SameSite=Lax` (bloquea POST cross-site → cubre CSRF al ser same-origin), `Secure` en prod.
- **Fail-closed:** `AUTH_USERS` ausente → app abierta (solo local). `AUTH_USERS` presente pero inválido → app bloqueada (nadie entra), error logueado. Render siempre tendrá `AUTH_USERS` seteado.
- **Rate-limit:** 5 fallos/IP/60s → bloqueo, mitiga fuerza bruta.
- **SECRET_KEY:** random fuerte por servicio, estable entre deploys (si cambia, se invalidan las sesiones — comportamiento aceptable).

## Config por entorno

```
PROD  (estadisticas-basket.onrender.com)
  SECRET_KEY     = <random fuerte>
  SESSION_SECURE = true
  AUTH_USERS     = {"nico":"<hash>", "otro":"<hash>"}   # 2 cuentas fuertes

DEV   (estadisticas-basket-dev.onrender.com)
  SECRET_KEY     = <random, distinto>
  SESSION_SECURE = true
  AUTH_USERS     = {"dev":"<hash clave simple>"}        # 1 clave simple

LOCAL (python app.py)
  (sin env)  → app abierta, sin login                   # comodidad de desarrollo
```

## Frontend

- **`api.js`:** agrega `login(user, password)`, `logout()`, `me()`. Quita `deleteGames` el header `X-Admin-Token` (ya no aplica) y `_adminToken()`. `apiFetch` detecta `401` global → dispara evento/callback para volver al login.
- **`boot()`:** primero `await api.me()`.
  - Si `auth_required && !authenticated` → renderiza **pantalla de login**, no construye la app.
  - Si `authenticated || !auth_required` → construye la app normal. Guarda `_seedEnabled = me.seed_enabled` y `_authUser`, `_authRequired`.
- **Pantalla login:** card centrada con input usuario, input password, botón "Entrar". Enter envía. Error inline en credenciales inválidas o `429`. Éxito → `boot()` de nuevo (carga la app).
- **Header:** si `auth_required`, muestra el usuario logueado + botón "Salir" → `api.logout()` → vuelve a login.
- **401 global:** si cualquier `/api` responde 401 (sesión expirada), el SPA vuelve a la pantalla de login con aviso "Sesión expirada".

## Manejo de errores

| Caso | Respuesta backend | UX frontend |
|------|-------------------|-------------|
| Credenciales inválidas | `401 {error}` | Mensaje inline "Usuario o contraseña incorrectos" |
| Demasiados intentos | `429 {error}` | "Demasiados intentos, esperá 1 minuto" |
| Sesión expirada (request a ruta gateada) | `401` | Volver a login con "Sesión expirada" |
| `AUTH_USERS` mal configurado (prod) | login siempre `401` | nadie entra; revisar env + logs |

## Testing

**Automated (test client Flask):**
- `POST /api/login` correcto → 200 + cookie; `GET /api/league` con esa cookie → 200.
- `POST /api/login` incorrecto → 401.
- `GET /api/league` sin sesión (auth activa) → 401.
- 6º intento fallido seguido → 429.
- `POST /api/logout` → luego `GET /api/league` → 401.
- Sin `AUTH_USERS` (auth desactivada) → `GET /api/league` → 200 sin login.
- `GET /api/me` refleja `authenticated`/`auth_required`/`seed_enabled` correctos.

**Manual:**
- Local sin env → app abre directo.
- Local con `AUTH_USERS` + `SECRET_KEY` → pantalla login; probar clave ok/mal, logout, expiración.
- Render dev: login con clave simple; verificar que sin sesión no se ve nada.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `backend/auth.py` | **nuevo** — módulo de auth |
| `backend/app.py` | secret_key + cookie config; rutas login/logout/me; `@login_required`; retiro de `ADMIN_TOKEN` y `/api/config` |
| `frontend/js/api.js` | `login/logout/me`; quitar `X-Admin-Token`/`_adminToken`; manejo 401 |
| `frontend/js/app.js` | gate en `boot()`; pantalla login; botón Salir; usar `me.seed_enabled` |
| `frontend/css/style.css` | estilos pantalla login |
| `frontend/sw.js` | bump de cache |
| `docs/api.md`, `docs/deployment.md` | documentar auth + env vars; quitar `ADMIN_TOKEN`/`/api/config` |
