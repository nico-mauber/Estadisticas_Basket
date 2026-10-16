# Progress — C-05: Renombrar PEP

> **Estado:** ✅ Completado (2026-09-26) · rama `v2`
> Reglas: `sdd/04-implement.md`.

## Decisiones humanas aplicadas
Las 3 propuestas de spec §9 (alcance de la búsqueda, nota de `docs/database.md` sin la sigla, regla para etiquetas
futuras) y DA-21 (sin `t()`: el copy va en español directo). Registro en [../../00-decisiones.md](../../00-decisiones.md).

## Estado de tareas
- [x] T-A1 · N/A — sin cambio de esquema
- [x] T-B1 · N/A — sin cambios de backend
- [x] T-C1 · N/A — `api.js` sin cambios
- [x] T-D1 · "Desglose ofensivo" rotula `PtsEnPint` (ya venía de `dev`; sin `t()` por DA-21)
- [x] T-D2 · Comparar rotula `PtsEnPint` (ídem)
- [x] T-D3 · N/A — DA-21: no hay `t()`
- [x] T-E1 · `CACHE` → `smart-basket-v12` (compartido con C-10 y C-06)
- [x] T-E2 · `docs/database.md` sin la sigla vieja
- [x] T-E3 · Regla de etiqueta en `docs/frontend.md` (Vista Equipo — "Desglose ofensivo")
- [x] T-F1 … T-F11 · ver CA

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | `git grep -n -i -w "pep" -- frontend backend docs ':!backend/venv'` → **0 líneas**. Navegador: `innerText` de Equipo y de Comparar sin la palabra |
| CA-2 | ✅ | Equipo ALB: `PtsEnPint` = "36,00" = `averages.paint_pts` 36.0 |
| CA-3 | ✅ | Comparar ALB vs 2º equipo: fila `PtsEnPint` con los dos valores |
| CA-4 | ✅ | `team_game_stats.paint_pts` existe; `count(paint_pts)` = 26 antes y después |
| CA-5 | ✅ | `averages.paint_pts = null` inyectado en el equipo A → fila `['—', 'PtsEnPint', '34,0']` |
| CA-6 | ✅ | 360 px: sin scroll horizontal de página |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: N/A (sin esquema)
- Endpoints probados manualmente: ✅ (`/api/team`)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- RF-5 (`t()`) no aplica: DA-21 decidió no preparar i18n en fase 1.
- El renombre visible ya venía de `dev` (DA-01); C-05 solo quitó el residuo de `docs/database.md` y dejó la regla.

## Docs actualizados
- [x] `docs/database.md` — `paint_pts` con su etiqueta `PtsEnPint`, sin la sigla vieja
- [x] `docs/frontend.md` — regla: toda etiqueta nueva de `paint_pts` es `PtsEnPint`
