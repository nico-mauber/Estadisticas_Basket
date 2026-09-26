# Progress — C-05: Renombrar PEP

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`.

## Estado de tareas
- [ ] T-A1 · N/A — sin cambio de esquema
- [ ] T-B1 · N/A — sin cambios de backend
- [ ] T-C1 · N/A — `api.js` sin cambios
- [ ] T-D1 · `t('equipo.desglose.paint_pts', 'PtsEnPint')` en "Desglose ofensivo"
- [ ] T-D2 · `t('comparar.box.paint_pts', 'PtsEnPint')` en Comparar
- [ ] T-D3 · Import de `t` en `app.js`
- [ ] T-E1 · Subir `CACHE` en `sw.js`
- [ ] T-E2 · `docs/database.md` sin la sigla vieja
- [ ] T-E3 · Regla de etiqueta en `docs/frontend.md`
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · N/A esquema
- [ ] T-F3 · curl `/api/team/CNF`
- [ ] T-F4 · Consola sin errores
- [ ] T-F5 · Recorrido de CA
- [ ] T-F6 · CA-1 (cliente)
- [ ] T-F7 · CA-2
- [ ] T-F8 · CA-3
- [ ] T-F9 · CA-4
- [ ] T-F10 · CA-5
- [ ] T-F11 · CA-6

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A previsto)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- [ ] `docs/database.md` — descripción de `paint_pts` sin la sigla vieja (l.60)
- [ ] `docs/frontend.md` — `PtsEnPint` en Equipo y Comparar; regla para etiquetas futuras

## Deuda / TODO
