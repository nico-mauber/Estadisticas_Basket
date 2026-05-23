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

### Plan

- **Web Service:** Starter ($7/mes)
- **Persistent Disk:** 1GB — el disco persiste entre deploys y reinicios; la DB no se pierde

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
