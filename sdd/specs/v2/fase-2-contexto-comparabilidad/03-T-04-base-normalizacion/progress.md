# Progress — T-04: Base de normalización

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-B1 · `apply_base` (fixed/volume/count)
- [ ] T-B2 · `_segundos_entidad`
- [ ] T-B3 · `_posesiones_denominador`
- [ ] T-B4 · Denominador 0 → `null sin_datos`
- [ ] T-B5 · `parse_base`
- [ ] T-B6 · Conectar `base` en handlers de T-05
- [ ] T-B7 · Verificación de propagación en T-06
- [ ] T-C1 · `api.js` agrega `base` a la query
- [ ] T-D1 · `components/base-selector.js`
- [ ] T-D2 · Resolución de base activa (URL > sesión > config)
- [ ] T-D3 · Montaje en Equipo
- [ ] T-D4 · Montaje en Jugador
- [ ] T-D5 · Indicador "estimado"
- [ ] T-D6 · CSS selector
- [ ] T-D7 · Copy con `t()`
- [ ] T-E1 · Estado offline
- [ ] T-E2 · Error al cambiar de base
- [ ] T-E3 · `sw.js`
- [ ] T-F1 … T-F16 · Verificación
- [ ] T-G1 … T-G3 · (diferido)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ⬜ | |
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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A: sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/metrics.md` — sección "Base de normalización" con las 4 fórmulas y la tabla `base_mode`/`per100_den`.
- `docs/api.md` — parámetro `base` en los endpoints tocados; campo `base` en la respuesta.
- `docs/frontend.md` — `components/base-selector.js`, persistencia por sesión, copy nuevo.

## Deuda / TODO
