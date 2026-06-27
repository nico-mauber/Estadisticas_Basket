# Smart-Basket — Documentación

Plataforma de analítica avanzada de básquetbol para la liga FUBB (Uruguay).

## Índice

| Documento | Contenido |
|-----------|-----------|
| [architecture.md](architecture.md) | Arquitectura general, componentes, flujo de datos |
| [database.md](database.md) | Esquema SQLite, tablas, restricciones |
| [api.md](api.md) | Todos los endpoints REST con requests/responses |
| [metrics.md](metrics.md) | Fórmulas de métricas avanzadas |
| [frontend.md](frontend.md) | SPA, vistas, service worker, PWA |
| [deployment.md](deployment.md) | Render.com, variables de entorno, dependencias |

## Stack resumido

```
Python 3.11 + Flask 3.0  →  SQLite  →  Vanilla JS SPA (PWA)
Desplegado en Render.com (Web Service + persistent disk 1GB)
Login con sesión por cookie, gateado por entorno (AUTH_USERS)
```
