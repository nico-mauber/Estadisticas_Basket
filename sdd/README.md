# SDD — Spec-Driven Development para Smart-Basket

Pipeline de 4 pasos para agregar features o cambios a Smart-Basket con trazabilidad completa a `docs/`. Este directorio NO contiene código: contiene el proceso.

## Los 4 pasos

```
docs/ (fuente de verdad) ──► 1. SPECIFY ──► 2. PLAN ──► 3. TASKS ──► 4. IMPLEMENT
                              spec.md         plan.md      tasks.md      código + progress.md
                            (qué y por qué)   (cómo)       (en qué orden) (hecho y verificado)
```

| Paso | Archivo de instrucciones | Produce | Gate de salida |
|---|---|---|---|
| 1. Specify | `01-specify.md` | `sdd/specs/NN-<feature>/spec.md` | Requisitos 100% trazables a docs/; 0 ambigüedades abiertas |
| 2. Plan | `02-plan.md` | `sdd/specs/NN-<feature>/plan.md` | Cumple Constitución; no inventa endpoint/columna |
| 3. Tasks | `03-tasks.md` | `sdd/specs/NN-<feature>/tasks.md` | Tareas atómicas, ordenadas, verificables |
| 4. Implement | `04-implement.md` | código + `sdd/specs/NN-<feature>/progress.md` | Criterios de aceptación del spec ✅ + gates técnicos |

## Especificar por feature, no por fase fija

Smart-Basket ya está en producción (ver `docs/`) — no es una app por construir desde cero. No hay una lista fija de fases a recorrer: cada spec cubre una feature o cambio concreto (nuevo endpoint, nueva métrica, nueva vista, cambio de esquema). Nombrar la carpeta `sdd/specs/NN-<feature-en-kebab-case>/` con `NN` incremental (ver `_TEMPLATE/` para copiar la estructura).

## Constitución (innegociable — se valida en cada gate)

1. `docs/` manda. Ante conflicto código-vs-docs, ganan los docs — y se actualiza el doc correspondiente al cerrar la feature (docs desincronizados = deuda, no detalle menor). Ante vacío en docs, se marca `[NEEDS CLARIFICATION]` en el spec — nunca se inventa.
2. Stack fijo: Python 3.11 + Flask 3.0 + Flask-SQLAlchemy + SQLite. Frontend: vanilla JS ES6, sin bundler, sin frameworks. No agregar dependencias npm/pip nuevas salvo justificación explícita en el plan.
3. Rutas nuevas siempre bajo `/api/*`, registradas en `app.py`. `app.py` no contiene lógica de negocio: vive en `fiba_fetcher.py` / `stats_engine.py` / `database.py` o un módulo nuevo dedicado.
4. Métricas avanzadas se calculan on-the-fly en `stats_engine.py` (nunca se persisten en DB). Fórmulas EXACTAS de `docs/metrics.md` — no reinterpretar coeficientes.
5. Cambios de esquema SQLite vía `upgrade_db()` (`ALTER TABLE ADD COLUMN` idempotente). Nunca migraciones destructivas ni herramienta externa (Alembic). No romper restricciones únicas existentes.
6. Login gateado por `AUTH_USERS` (env var) + `login_required`. Nunca hardcodear credenciales ni crear tabla `users`.
7. UI en español, mobile-first (breakpoint principal `768px`), nav inferior fija en mobile.
8. No hay test suite automatizado en el proyecto: el gate de verificación es manual (arrancar backend + probar endpoints + revisar navegador). La evidencia se documenta en `progress.md`, no se asume.
9. Frontend sin llamadas `fetch()` fuera de `api.js`; componentes/render reusan helpers existentes (`_colorCell`, `_fourFactorsCard`, `charts.js`) antes de crear nuevos.

## Regla de flujo

- No se avanza de paso sin pasar el gate del paso anterior.
- Un cambio de alcance a mitad de feature → volver al paso 1 (actualizar spec), no parchar en caliente.
- `progress.md` de cada feature registra desviaciones y qué doc de `docs/` quedó pendiente de actualizar.
