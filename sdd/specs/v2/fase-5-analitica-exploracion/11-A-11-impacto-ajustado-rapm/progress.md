# Progress — A-11: Impacto ajustado (RAPM)

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md). Spec: [spec.md](spec.md). Plan: [plan.md](plan.md).

## Estado de tareas
### Grupo A — Backend: configuración, stints y helpers
- [ ] T-A1 [P] · Claves `rapm.lambdas` y `rapm.folds` en `CONFIG_SPEC`
- [ ] T-A2 [P] · Helpers `weighted_mean` y `spearman`
- [ ] T-A3 · `matchups.stints`
### Grupo B — Backend: núcleo numérico, publicación, rutas y tabla
- [ ] T-B1 · `_design`
- [ ] T-B2 · `_normal_equations` y pliegues
- [ ] T-B3 · `_cg_solve`
- [ ] T-B4 · `_cross_validate`
- [ ] T-B5 · `_publish`
- [ ] T-B6 · `_diagnostics`
- [ ] T-B7 · `rapm()` y `rapm_cached()`
- [ ] T-B8 · `GET /api/rapm` y `POST /api/rapm/recompute`
- [ ] T-B9 · Tabla `rapm`
- [ ] T-B10 (condicional, solo si CA-16 > 30 s y con aprobación) · `numpy`
### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.rapm` y `api.rapmRecompute`
### Grupo D — Frontend: UI
- [ ] T-D1 · `components/rapm-panel.js`
- [ ] T-D2 · Panel en S4 Impacto + acción administrada
- [ ] T-D3 [P] · Estilos
### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados de UI y mensajes 403/502
- [ ] T-E2 · `sw.js` (`STATIC` y `CACHE`)
### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `database.py` idempotente y sin tablas nuevas
- [ ] T-F3 · Endpoints probados con curl
- [ ] T-F4 · Consola del navegador sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 · Verificación numérica del solver
- [ ] T-F7 … T-F26 · Verificación de CA-1…CA-20

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |
| CA-9 | ⬜ | |
| CA-10 | ⬜ | |
| CA-11 | ⬜ | |
| CA-12 | ⬜ | |
| CA-13 | ⬜ | |
| CA-14 | ⬜ | |
| CA-15 | ⬜ | |
| CA-16 | ⬜ | |
| CA-17 | ⬜ | |
| CA-18 | ⬜ | |
| CA-19 | ⬜ | |
| CA-20 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (A-11 no toca esquema): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Medición de rendimiento (DA-25)
| Competencia | Partidos | Filas | Jugadores | Resoluciones | Iteraciones CG (media) | Duración (s) | ¿> 30 s? |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/api.md` — `GET /api/rapm`, `POST /api/rapm/recompute`, tabla `rapm`, claves `rapm.lambdas`/`rapm.folds`
- [ ] `docs/metrics.md` — definición de RAPM (modelo, signo, unidades, λ, cobertura, limitaciones) y verificación de dominancia
- [ ] `docs/frontend.md` — bloque de impacto ajustado en S4 Impacto, `rapm-panel.js`, copy nuevo (para extracción en F-21)
- [ ] `docs/architecture.md` — módulo `rapm.py`, `matchups.stints`, caché `rapm`, decisión sobre `numpy`
- [ ] `docs/deployment.md` — caché volátil y recálculo tras desplegar; recomendación DA-28

## Deuda / TODO
