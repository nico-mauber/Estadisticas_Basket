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

## Revisión v2 (2026-07-08) — cierre por equipo + margen (spec §10)

Feedback del cliente: mover cierres de Liga → Equipo, agregar como "mini-partido" del equipo + desglose por partido, filtrar por **margen ≤ 15 al minuto 5:00**. Decisiones confirmadas: **±15 por ventana**, **agregado + desglose**.

### Cambios
- [x] Backend: `clutch_rows` → `team_clutch(games, team_code, team_name, margin=15)` + `_entry_margin`, `_box_metrics`, `_SUM_KEYS` (`clutch.py`)
- [x] Backend: `GET /api/clutch` → `GET /api/clutch/<team_code>` (`?margin=` opcional); `_team_pbp_games` ahora incluye `info:{date, home_away}` (`app.py`)
- [x] Frontend: quitado `#league-clutch` de `renderLeague`; nuevo `renderTeamClutch` + `_drawClutchTable` sobre `per_game` en vista Equipo (`#team-clutch`); `api.clutch` → `api.clutchTeam`; cache `v8`

### CA v2 (spec §10.6)
| CA | Estado | Evidencia |
|---|---|---|
| CA-v2-1 | ✅ | `GET /api/clutch/HYM` → `aggregate.point_diff (3) == pts_for(21) − pts_against(18)`; verificado en los 6 equipos |
| CA-v2-2 | ✅ | Partidos con margen > 15 al 5:00 no aparecen y suman a `games_excluded`: CNF game 2741559 (m=45), AGU/DSC 2820500 (m=38) excluidos |
| CA-v2-3 | ✅ | `aggregate.reb == Σ per_game[].reb` y `aggregate.pts_for == Σ per_game[].pts` — barrido de invariantes OK en los 6 equipos |
| CA-v2-4 | ✅ | `clutch_record`: HYM 1-1-0 (un cierre ganado por +4, otro perdido por −1), CAP 1-0-0, CNF 0-1-0 |
| CA-v2-5 | ✅ | Navegador: vista Equipo (HYM) muestra tarjeta agregada (récord 1-1-0, Dif +3, Off/Def, eFG/TS, Pts F/C, REB/AST/TOV/Robos/Tapones) + tabla por partido con `Δ@5:00`; Liga ya **no** muestra Cierres (2 cards: ranking + mapa); consola sin errores |
| CA-v2-6 | ⚠️✅ | Lógica OT intacta (`_is_clutch`); sin partido con OT en el dataset (mismo pendiente que CA-4 v1) |

### Filtro por ventana (verificado)
`_entry_margin` toma el `s1`/`s2` del último evento con `clock_secs > 300` del REGULAR final. Con `?margin=5` HYM baja a 0 calificados (sus cierres m=6,11 > 5); con `?margin=100` sube a 2 → el umbral filtra como se espera.

## Deuda / TODO (spec §8, §10.7)
- USO% y Pace del cierre (diferidos; se expone `possessions` como proxy).
- Umbral de margen configurable desde la UI (hoy fijo 15, `?margin=` en API).
- Ranking cross-equipo de cierres en Liga (se perdió al mover a Equipo; reponible como "clutch net rating" league-wide).
- Verificar CA-4/CA-v2-6 con un partido real con prórroga cuando exista en la base.
- Evidencia visual v1: `feat05-clutch.png` (tabla en Liga). Evidencia v2: `feat05v2-clutch-onoff-equipo.png` (vista Equipo: clutch agregado + por partido + ON/OFF).
