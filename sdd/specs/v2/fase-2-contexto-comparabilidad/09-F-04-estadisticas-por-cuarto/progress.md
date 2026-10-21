# Progress — F-04: Estadísticas por cuarto

> **Estado:** 🔶 Implementado en Equipo (8 tramos con conjunto estándar, ficha, badge de split, resumen tipo Cierres y desglose por partido exportable); falta la pestaña `momentos` (X-01), la tabla T-06 `period_splits` y migrar Cierres
> **Fecha:** 2026-10-20

## Estado de tareas
- [x] T-A1 · Sin esquema; claves `clutch.window_secs`, `sample.split.*`, `regression.split.k`, `context.close_margin` presentes
- [x] T-B1 · `splits.WINDOWS` / `WINDOW_LABELS` / `window_label`; los tramos son rebanadas del reloj (`event_slices`), con `last5` = últimos `clutch.window_secs` del último período regular + prórrogas
- [x] T-B2 · `StatBundle` de split con `pf`, `fouls_drawn`, `blk_received` y `plus_minus` desde los eventos (reusa `clutch._agg`)
- [x] T-B3 · `splits.team_event_bundle(team, comp, ctx, window)`: minutos exactos por tramo, récord (`splits.record`), recuento de excluidos
- [x] T-B4 · Filas por partido en `bundle.meta["per_game"]` (fecha, rival, L/V, pts, pts rival, dif, min)
- [x] T-B5 · Tipo `period` (id `<equipo>:<tramo>`, 400 si el tramo es inválido) con enumerador para la población; `GET /api/periods/<equipo>` devuelve los 8 tramos
- [x] T-B6 · Badge de split en posesiones y ajuste a la media (K = `regression.split.k`)
- [x] T-B7 · `quarter` de la barra se ignora (`context.ignored`: `no_aplica`); `games_excluded.sin_pbp`
- [ ] T-B8 · Tabla T-06 `period_splits` (el bloque usa `/api/periods` y una tabla simple exportable con `exportMenu`)
- [ ] T-B9 · Cierres sigue con su camino propio (`/api/clutch`, tipo `clutch`); no se migró a `events_bundle`
- [x] T-C1 · `api.periods`
- [x] T-D1 · `components/period-block.js`: chips, resumen, panel estándar, cambio de tramo sin requests
- [🔶] T-D2 · Bloque montado en la vista Equipo (`#team-periods`, arriba de Cierres); `window` en la URL. Sin pestaña `momentos` (no hay router X-01)
- [x] T-D3 · Desglose partido a partido con exportación CSV/XLSX/PNG/PDF y metadatos del tramo
- [x] T-D4 · Chips con scroll horizontal, sin desborde de página a 360 px
- [🔶] T-E1 · Loading, error con «Reintentar», sin conexión, sin pbp, chip Prórroga deshabilitado con `title`; sin `t()` (F-21)
- [x] T-E2 · `sw.js` v37 con `period-block.js`
- [x] T-E3 · Docs
- [x] T-F · `f04_sim.py` 19/19, `f04_browser.py` 31/31 (1280 y 360 px) y regresión completa

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Chromium: tocar los 8 chips no genera requests y el bloque cambia; el resto de la pestaña conserva su estado |
| CA-2 | 🔶 | 8 tramos en orden con el conjunto estándar completo; sin la tabla T-06 `period_splits` |
| CA-3 | ✅ | LBO: Σ q1..q4 = h1 + h2 (pts 73) y h1 + h2 + pr = 79 = total del equipo con pbp |
| CA-4 | ✅ | `pr`: 1 partido, minutos = 5 × prórrogas, 6 pts |
| CA-5 | ✅ | LAG (sin prórroga): `pr` vacío, chip deshabilitado |
| CA-6 | 🔶 | La muestra baja se ve (gris, `Muestra baja`); falta probar el cambio de `sample.split.min` desde configuración |
| CA-7 | ✅ | `last5` con `clutch.margin=40`: pts a favor y en contra iguales a `/api/clutch` (17 y 18) |
| CA-8 | ✅ | `venue=local` recarga el bloque; `quarter=1` → `context.ignored` con `quarter` (`no_aplica`) |
| CA-9 | ✅ | CSV con `Tramo=Prórroga` en los filtros y nombre `momentos-pr_<equipo>` |
| CA-10 | ✅ | Partido sin pbp: `games_excluded.sin_pbp == 1` y no entra en ningún tramo |
| CA-11 | ⬜ | Puntos por cuarto desde pbp vs `period_pts`: pendiente F-11 v2 |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- **Sin `clutch.py`:** los tramos viven en `splits.py` (comparten las rebanadas con los filtros de evento de T-03).
- **Un endpoint propio:** `GET /api/periods/<equipo>` (los 8 tramos en una llamada) en vez de `api.table("period_splits")`.
- **Sin pestaña `momentos`:** el bloque va en la vista Equipo, arriba de Cierres.
- **Entidad de los splits:** el payload presenta el split como `team` (`entity.split = true`) para reutilizar los grupos del catálogo.
- **Arreglo de paso (T-03):** el conjunto estándar de un equipo con filtros de evento llegaba con `entity.type = "split"` y la UI no dibujaba ningún grupo; ahora se presenta como equipo.

## Docs actualizados
- ✅ `docs/api.md` · ✅ `docs/architecture.md` · ✅ `docs/frontend.md`

## Deuda / TODO
- Tabla T-06 `period_splits`, pestaña `momentos` (X-01), migración de Cierres a `events_bundle`.
- Conciliar los puntos por cuarto con `period_pts` (F-11 v2).
- `t()` para el copy (F-21).
