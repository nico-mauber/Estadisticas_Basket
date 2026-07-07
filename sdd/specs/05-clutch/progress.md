# Progress — Feature 05 (tarea 7): Estadísticas "Clutch"

## Estado de tareas
- [x] Backend: módulo `clutch.py` (`_is_clutch`, `_agg`, `_pos`, `_leaders`, `clutch_rows`)
- [x] Backend: endpoint `GET /api/clutch` (`?team=` opcional) en `app.py`
- [x] Frontend: `api.clutch(team?)` en `api.js`
- [x] Frontend: apartado "Cierres (últimos 5 min)" en la vista Liga (`_renderClutch`/`_drawClutchTable`) + hook en `renderLeague`
- [x] Frontend: `CACHE` bump a `smart-basket-v6`
- [x] Verificación backend (endpoint) + navegador real (tabla, filtro, orden, colores)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/clutch` → 8 filas (4 partidos × 2 equipos); `point_diff == pts − opp_pts` para todas (assert) |
| CA-2 | ✅ | Ventana = último período REGULAR (P4) con `clock_secs<=300` (61 eventos en el juego probado) + OT. Puntos de cierre chicos (5–11) consistentes con 5 min; validado que pbp 2pt made = box fgm2 (CNF 35=35, COR 23=23) → agregación correcta |
| CA-3 | ✅ | `?team=AGU` y filtro en UI → todas las filas del equipo elegido (`filteredAllMatch=true`) |
| CA-4 | ⚠️✅ | Lógica incluye todos los eventos `period_type='OT'` (`_is_clutch`); sin partidos con OT en el dataset actual para observarlo — cubierto por código, pendiente de dato real con prórroga |
| CA-5 | ✅ | Vista Liga muestra tabla "Cierres" con columnas adaptadas (Fecha, Equipo, Rival, L/V, Dif, Pts, Off, Def, eFG%, TS%, TOV, AST, REB, FR, FC, Finaliza, Crea); Dif coloreado verde (+) / rojo (−); ordenable (Dif desc → [10,6,4,1,-1]); consola sin errores JS |
| CA-6 | ✅ | `top_finisher`/`top_creator` desde la ventana clutch: ej. HYM → F. Haller (3 pts) / S. Zanotta (1 ast); DSC sin asistencias → `top_creator=null` (muestra "—") |

## Gates técnicos
- Backend arranca sin traceback: ✅ (`/api/clutch` 200)
- `upgrade_db()` idempotente: N/A — Feature 05 no toca esquema (usa `pbp_events` de Feature 02)
- Endpoints probados: ✅ (`test_client` + navegador)
- Consola del navegador sin errores JS: ✅ (solo el 404 preexistente de favicon)

## Desviaciones respecto a docs/ o plan
- Ninguna. Off/Def Rating = OER/DER de `docs/metrics.md` sobre el subconjunto clutch (decisión spec §9); consistencia verificada (Off de un equipo = Def del rival: CAP 0.667 = HYM 0.667; AGU 1.375 = DSC 1.375).
- Faltas contadas desde `pbp_events` (`foul`/`foulon`), no del box score (spec §9).

## Docs a actualizar
- [x] `docs/api.md` — endpoint `GET /api/clutch`
- [x] `docs/frontend.md` — apartado "Cierres" en Liga, `api.clutch()`, cache `v6`
- [x] `docs/architecture.md` — módulo `clutch.py`

## Deuda / TODO (spec §8)
- USO% y Pace del cierre (diferidos; se expone `possessions` como proxy).
- Tarjetas resumen league-wide de "quién finaliza/crea más" agregando todos los partidos.
- Definición alternativa de clutch por margen (±5 pts) — el MVP usa la temporal pura.
- Verificar CA-4 con un partido real con prórroga cuando exista en la base.
- `_clutchData` se cachea por sesión; un import nuevo no refresca los cierres hasta recargar.
- Evidencia visual: `feat05-clutch.png` (tabla Cierres en Liga, ordenada por Dif).
