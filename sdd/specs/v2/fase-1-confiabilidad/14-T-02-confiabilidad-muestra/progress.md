# Progress — T-02: Confiabilidad de muestra

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · Verificar/agregar claves de muestra y regresión en `CONFIG_SPEC`
- [ ] T-B1 · `effective_min`, `sample_level`, `is_ranked` y mapas de entidad
- [ ] T-B2 · `league_prior`, `team_offensive_possessions`
- [ ] T-B3 · `adjusted`, `band`, `adjust_values`
- [ ] T-B4 · `sample_for`
- [ ] T-B5 · `_lineup_bundles` + `all_lineups` (pieza adelantada de F-06)
- [ ] T-B6 · `calibrate_k`
- [ ] T-B7 · Enganche en el payload estándar
- [ ] T-B8 · `POST /api/settings/calibrate`
- [ ] T-C1 · `api.calibrate`
- [ ] T-D1 · `components/sample-badge.js`
- [ ] T-D2 · Estilos del badge
- [ ] T-D3 · `standard-panel`: badge, gris, ajustados
- [ ] T-D4 · Panel Combinación sin umbral fijo
- [ ] T-D5 · Panel ON/OFF
- [ ] T-D6 · Panel Cierres
- [ ] T-D7 · Calibración en Configuración
- [ ] T-E1 · Errores de calibración en la UI
- [ ] T-E2 · `sw.js`
- [ ] T-F1 … T-F18 · Verificación
- [ ] T-G1 … T-G4 · (diferidos)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ⬜ | |
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

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (no aplica: sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/metrics.md` — sección "Confiabilidad de muestra" (niveles, umbral relativo, regresión, banda, calibración de K)
- `docs/api.md` — `POST /api/settings/calibrate`; `sample` y `adj` en el payload estándar
- `docs/frontend.md` — componente `sample-badge`, copy nuevo, retiro del aviso "Muestra chica" de 10 posesiones
- `docs/architecture.md` — módulo `sample.py`; `lineups.all_lineups`

## Deuda / TODO
