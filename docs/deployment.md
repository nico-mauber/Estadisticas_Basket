# Deployment

## Producción — Render.com

URL: `https://estadisticas-basket.onrender.com`

### Configuración (`render.yaml`)

```yaml
services:
  - type: web
    name: courtiq
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
    disk:
      name: courtiq-db
      mountPath: /data
      sizeGB: 1
    envVars:
      - key: DB_PATH
        value: /data/basketball.db
```

### Variables de entorno

| Variable | Valor en producción | Descripción |
|----------|--------------------|----|
| `DB_PATH` | `/data/basketball.db` | Ruta a SQLite. Sin esta var usa `backend/basketball.db` |
| `PORT` | (asignado por Render) | Gunicorn lo lee automáticamente |
| `SECRET_KEY` | `<random fuerte>` | Firma la cookie de sesión. Estable entre deploys (si cambia, se invalidan las sesiones). Generar: `python -c "import secrets;print(secrets.token_hex(32))"` |
| `SESSION_SECURE` | `true` | Marca la cookie de sesión como `Secure` (solo HTTPS). `true` en Render; sin setear en local (para probar login sobre http) |
| `AUTH_USERS` | `{"nico":"<hash>", ...}` | JSON usuario→hash. **Presencia activa el login** en toda la app. Prod: 2 cuentas fuertes. Dev: 1 clave simple. Local: sin setear → app abierta. Generar hash: `python -c "from werkzeug.security import generate_password_hash as g;print(g('miclave'))"` |
| `SEED_ENABLED` | **solo dev** | `true` habilita `POST /api/seed` y el botón "Agregar partidos". **No definir en producción** — sin la var, el endpoint responde 403. (También exige sesión iniciada.) |

**Login:** ver diseño en [superpowers/specs/2026-06-06-login-auth-design.md](superpowers/specs/2026-06-06-login-auth-design.md). Se retiró `ADMIN_TOKEN` — el borrado ahora exige login como el resto.

### Configurar el login en Render (paso a paso)

> **Ojo con las ramas:** el servicio **dev** deploya de `dev`, el de **prod** de `main`. El código de login debe estar en la rama que el servicio deploya. Si seteás `AUTH_USERS` en prod pero `main` todavía no tiene el login, la app sigue abierta (el código viejo ignora la variable). Mergear `dev → main` **antes** de configurar prod.

**Dónde se ponen las variables:**
1. dashboard.render.com → clic en el servicio (`estadisticas-basket-dev` o `estadisticas-basket`).
2. Menú izquierdo → **Environment**.
3. Sección **Environment Variables** → **Add Environment Variable** (campos Key + Value).
4. Repetir por cada variable → **Save Changes** (redeploy automático ~1-2 min).

**Generar los valores** (en local, una vez):
```bash
# SECRET_KEY (uno distinto por servicio)
python -c "import secrets;print(secrets.token_hex(32))"

# Hash de cada contraseña (1 por cuenta) — pegar SOLO el hash, nunca la clave
python -c "from werkzeug.security import generate_password_hash as g;print(g('LA_CLAVE'))"
```

**Variables a setear:**

| Servicio | Variables |
|----------|-----------|
| **dev** (`estadisticas-basket-dev`) | `SECRET_KEY=<random>` · `SESSION_SECURE=true` · `AUTH_USERS={"dev":"<hash clave simple>"}` · (`SEED_ENABLED=true` ya existente) |
| **prod** (`estadisticas-basket`) | `SECRET_KEY=<otro random>` · `SESSION_SECURE=true` · `AUTH_USERS={"nico":"<hash1>","juan":"<hash2>"}` · (sin `SEED_ENABLED`) |

`AUTH_USERS` va en **una sola línea**, JSON válido. Los `$` y `:` del hash se pegan tal cual en el dashboard (no hay problema de shell ahí).

**Verificar:**
1. Esperar el redeploy (pestaña **Events**).
2. Abrir la URL → debe aparecer la **pantalla de login**.
3. Entrar con usuario + clave → carga la app. Botón **Salir** → vuelve al login.

**Secretos:** los valores reales de `SECRET_KEY` y `AUTH_USERS` viven **solo** en el dashboard de Render, nunca en el repo. Sin `AUTH_USERS`, la app queda abierta (uso local).

### Plan

- **Web Service:** Starter ($7/mes) — requerido para usar disco persistente (el tier Free no lo soporta)
- **Persistent Disk:** 1GB ($0.25/mes) — el disco persiste entre deploys y reinicios; la DB no se pierde. 1GB ≈ 45.000 partidos con tiros

### Entornos dev y prod

Cada servicio Render tiene su **propio disco persistente independiente**. Un servicio `*-dev` y uno de producción no comparten DB ni entran en conflicto — no se necesita PostgreSQL ni configuración especial. El disco se agrega **después** de crear el servicio: dashboard → servicio → tab **Disk** → mount path `/data`, 1GB.

### Python version

Fijada en `backend/.python-version`:
```
3.11
```

Razón: `greenlet` (dependencia de Playwright) es incompatible con Python 3.14+ en Render.

### Deploy automático

Render detecta pushes a la rama `main` y redeploya automáticamente. Si no se dispara, usar **Manual Deploy** en el dashboard.

---

## Desarrollo local

```bash
cd backend
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

Flask dev server con `debug=True`. No requiere gunicorn.

**Inicializar / resetear DB:**
```bash
python backend/database.py
```

---

## Dependencias

### Python (`backend/requirements.txt`)

| Paquete | Versión | Uso |
|---------|---------|-----|
| `flask` | 3.0.3 | Framework web + serving de estáticos |
| `flask-cors` | 4.0.1 | CORS headers (dev con frontend separado) |
| `flask-sqlalchemy` | 3.1.1 | ORM sobre SQLite |
| `playwright` | 1.44.0 | Fallback headless para FIBA URLs bloqueadas |
| `gunicorn` | latest | WSGI server para producción |

**Nota:** Playwright requiere instalar el navegador por separado (`playwright install chromium`). En Render no está disponible sin configuración extra, por lo que el fallback Playwright no funciona en producción — solo el fetch directo con `urllib`.

### JavaScript (frontend)

Sin `package.json`. Dependencias cargadas desde CDN o incluidas en el repo:

| Librería | Origen | Uso |
|----------|--------|-----|
| Chart.js v4 | `js/chart.umd.min.js` (local) | Gráficos |
| hammerjs 2.0.8 | CDN jsDelivr | Touch events para zoom |
| chartjs-plugin-zoom 2.0.1 | CDN jsDelivr | Zoom/pan en scatter charts |

---

## Estructura de directorios

```
basketball-analytics/
├── backend/
│   ├── app.py              # Flask app + rutas API
│   ├── database.py         # SQLite schema + conexiones
│   ├── fiba_fetcher.py     # Scraping FIBA LiveStats
│   ├── stats_engine.py     # Motor de métricas avanzadas
│   ├── requirements.txt    # Dependencias Python
│   ├── .python-version     # Pin Python 3.11
│   └── basketball.db       # DB local (no commiteada)
├── frontend/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   ├── charts.js
│   │   └── chart.umd.min.js
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── docs/                   # Esta documentación
├── render.yaml             # Config deploy Render.com
└── CLAUDE.md               # Instrucciones para Claude Code
```
