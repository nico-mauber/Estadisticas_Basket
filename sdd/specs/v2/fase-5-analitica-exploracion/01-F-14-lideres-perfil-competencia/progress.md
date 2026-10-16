# Progress — F-14: Líderes y perfil de competencia

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · Activar `leaders.min_minutes` y `leaders.top_n`
- [ ] T-B1 · Extensiones de `population.py` (base, `team_code`, `reasons`, `member_bundles`)
- [ ] T-B2 · Constantes, `ProfileError` y `effective_min_minutes`
- [ ] T-B3 · `_leaders_core` sobre la población de T-01
- [ ] T-B4 · `leaders`, `leaders_payload` y `leaders_cards`
- [ ] T-B5 · `profile`: referencia, ritmo y reparto de tiro
- [ ] T-B6 · Bloque `ppp_origen`
- [ ] T-B7 · Tabla `leaders` registrada en T-06
- [ ] T-B8 · Rutas `/api/leaders` y `/api/competition-profile`
- [ ] T-C1 · `api.leaders` y `api.competitionProfile`
- [ ] T-D1 · `components/leaders-panel.js`
- [ ] T-D2 · `components/profile-panel.js`
- [ ] T-D3 · Habilitar las pestañas `lideres` y `perfil` de Liga
- [ ] T-D4 · Estilos de tarjetas y perfil
- [ ] T-E1 · Estados vacíos, error y sin conexión
- [ ] T-E2 · Service worker (si corresponde)
- [ ] T-F1 … T-F21 · Verificación de feature (checks obligatorios y un check por CA)

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
| CA-14 | ⬜ | |
| CA-15 | ⬜ | |
| CA-16 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/leaders`, `GET /api/competition-profile`, tabla `leaders`, errores
- `docs/frontend.md` — pestañas Líderes y Perfil de Liga, componentes `leaders-panel` y `profile-panel`, copy nuevo
- `docs/metrics.md` — líderes y promedios de referencia (misma población que los percentiles; mínimo efectivo de minutos)
- `docs/architecture.md` — módulo `competition_profile.py`

## Deuda / TODO
