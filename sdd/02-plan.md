# Paso 2 — PLAN

> Objetivo: decidir el CÓMO técnico del spec. Arquitectura de código de la feature: archivos, rutas, modelos, funciones. Aún no se escribe código de producción.

## Entrada
- `sdd/specs/NN-<feature>/spec.md` (con gate del Paso 1 pasado).
- `docs/architecture.md` (capas: `app.py` → módulos backend).
- `docs/database.md` (modelos SQLAlchemy, esquema, migración).
- `docs/api.md` (firmas exactas de endpoints existentes).
- `docs/frontend.md` (estructura de archivos, vistas, `api.js`, `charts.js`, service worker).
- `docs/metrics.md` (fórmulas, si la feature toca métricas).

## Salida
Archivo `sdd/specs/NN-<feature>/plan.md`:

```markdown
# Plan — Feature NN: <nombre>

## 1. Enfoque
Resumen de 3-5 líneas de la estrategia técnica.

## 2. Archivos (crear/editar)
Tabla: ruta | tipo (route/model/service/module/js-view/js-api/js-chart/css) | responsabilidad | RF que cubre.

## 3. Backend — rutas y modelos
Por endpoint nuevo/tocado: método+ruta, request/response, códigos de error.
Por columna/tabla nueva: nombre, tipo, default, si requiere `upgrade_db()`.

## 4. Backend — lógica
Por función nueva/tocada en `stats_engine.py` / `fiba_fetcher.py` / `database.py` (o módulo nuevo): firma, fórmula exacta (copiada de docs/metrics.md si aplica), qué stats crudas consume.

## 5. Frontend — capa API
Métodos nuevos/tocados en `api.js`: firma, endpoint que llaman, `credentials` si aplica.

## 6. Frontend — UI
Por vista/función de render en `app.js`: qué sección de docs/frontend.md toca, estados que renderiza, uso de `charts.js` si aplica, helpers reusados (`_colorCell`, `_fourFactorsCard`, etc.).

## 7. Navegación
Si agrega vista/hash nuevo: actualizar mapa de vistas de docs/frontend.md.

## 8. Contratos de datos
Shape de JSON de request/response nuevos. Filas SQLAlchemy nuevas/tocadas.

## 9. Manejo de errores y offline
Mapeo de códigos HTTP (400/401/404/429/502) a mensajes en español.
Si agrega asset estático: actualizar `STATIC[]` y versión de `CACHE` en `sw.js`.

## 10. Riesgos / decisiones
Trade-offs tomados. Desviaciones respecto a docs/ (si las hay) con justificación → también van a progress.md.
```

## Reglas
1. **No inventar endpoint/columna**: todo debe existir en `docs/api.md`/`docs/database.md`, o quedar marcado como NUEVO — y agregarse a esos docs al cerrar la feature (Paso 4).
2. **Respetar capas**: rutas Flask delgadas → lógica en módulos backend; frontend UI → `api.js` → `fetch`. Ninguna función de render llama `fetch()` directo.
3. **Reusar antes de crear**: helpers de color/tabla/gráfico ya existentes se reutilizan; solo se crean los nuevos que la feature requiera.
4. **Métricas = stats_engine.py**: el plan nunca calcula métricas avanzadas en frontend ni las persiste en DB.
5. **Mobile-first**: si toca UI, verificar el breakpoint `768px` y el nav inferior fijo en mobile.

## Gate de salida
- [ ] Cada RF del spec tiene ≥1 archivo en §2 que lo cubre (matriz RF→archivo completa).
- [ ] Firmas de endpoints/columnas coinciden con docs/api.md y docs/database.md, o están marcadas NUEVO.
- [ ] Fórmulas de métricas (si aplica) idénticas a docs/metrics.md.
- [ ] Cero llamadas `fetch()` fuera de `api.js`.
- [ ] Cumple Constitución (stack, capas, esquema vía `upgrade_db()`, español, mobile-first).

Al pasar el gate → avanzar a `03-tasks.md`.
