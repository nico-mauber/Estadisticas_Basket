# Progress — C-06: Umbral de cierres de partido

> **Estado:** ✅ Completado (2026-09-26) · rama `v2`
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Decisiones humanas aplicadas
**Alcance completo** (umbral y ventana en un único lugar, título desde la respuesta, recuento que cierra, prórrogas
`OVERTIME`, filtro de competencia de Equipo, validación 400) y DA-21 (copy en español directo, sin `t()`). Registro en
[../../00-decisiones.md](../../00-decisiones.md).

## Estado de tareas
- [x] T-A1 · `clutch.py`: `DEFAULT_MARGIN = 10`, `DEFAULT_WINDOW_SECS = 300`, `MARGIN_RANGE`, `WINDOW_RANGE`,
  `OVERTIME_TYPES = ("OVERTIME", "OT")`. Sin alias `CLUTCH_SECS` (nadie más lo importaba)
- [x] T-A2 · `_is_clutch(ev, last_regular, window_secs)` reconoce `OVERTIME`/`OT`
- [x] T-A3 · `_entry_margin(evs, last_reg, window_secs)`
- [x] T-A4 · `per_game[].overtime_periods`
- [x] T-A5 · `team_clutch(..., margin=None, window_secs=None, games_without_pbp=0)` con el recuento completo
- [x] T-A6 · `_int_arg(name, lo, hi)` en `app.py` (ausente → `None`, inválido → `ValueError`)
- [x] T-A7 · `clutch_team` valida y delega los defaults en `clutch.py`
- [x] T-A8 · `?competition=` con `competitions.resolve` (F-11 ya integrado: sin fallback por texto)
- [x] T-B1 · Nulos con denominador 0 confirmados
- [x] T-C1 · `api.clutchTeam(team, comp)`
- [x] T-D1 … T-D5 · `_clutchTitle`, `_clutchCount`, columna PR, cabecera `Δ@m:ss`, estado vacío con el recuento
- [x] T-E1 · Los 404 del backend se muestran en la card por el camino de error existente
- [x] T-E2 · Offline: mismo camino de error (probado con una respuesta 500 simulada)
- [x] T-F1 … T-F16 · ver CA

## Estado de CA (gate de aceptación)
Backend: `app.test_client()` sobre una copia de la base (13 partidos, 14 equipos, 2 con prórroga). Frontend: Chromium
headless sobre la base local.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Encabezado renderizado: **"CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)"**; recuento "1 calificado(s) · 1 excluido(s) por diferencia mayor a 10" |
| CA-2 | ✅ | `?margin=15` vs default: en ALB, COL, LAG, OMU, SAY y TAB un partido pasa de calificado a excluido (−1 / +1) |
| CA-3 | ✅ | Los 14 equipos: `qualified + excluded + without_clutch_events == with_pbp`, `with_pbp + without_pbp == total`, y `games_total` = filas del equipo en `team_game_stats` |
| CA-4 | ✅ | `?margin=8&window_secs=180` → `margin 8`, `window_secs 180`. Sin literales `10`/`15`/`300`/`5:00`/`5 min` de cierres en `app.js` ni en la ruta (solo un comentario de ejemplo) |
| CA-5 | ✅ | 2849340: `overtime_periods 1`, pts 17 / opp 18; 2849347: `overtime_periods 1`, pts 30 / opp 23 — iguales a la suma de pbp del 4.º cuarto con reloj ≤ 300 + `OVERTIME` |
| CA-6 | ✅ | `margin=50`, `margin=abc`, `window_secs=30`, `margin=-1`, `window_secs=601` → 400 "El parámetro margin debe ser un número entero entre 0 y 40."; bordes `0`/`600` → 200 |
| CA-7 | ✅ | Competencia nueva con un partido de ALB: `games_total 1`, `competition {id, label: "Copa C06 2026"}`; la competencia 1 queda con el otro. En el navegador, elegir la competencia en Equipo pide `/api/clutch/ALB?competition=2` y la card muestra "Copa C06 2026 · …"; "Todas" pide sin parámetro |
| CA-8 | ✅ | Sin pbp en todos sus partidos → 404 "Equipo sin play-by-play. Reimportá sus partidos."; con uno solo sin pbp → `games_without_pbp 1` |
| CA-9 | ✅ | Cierre sin tiros del equipo → `efg_pct`/`ts_pct` `null` en la fila y en el agregado |
| CA-10 | ✅ | Carga (respuesta demorada) y error (500 simulado): el título dice "CIERRES" |
| CA-11 | ✅ | 360 px: encabezado sin desborde, sin scroll horizontal, 0 errores JS |

Otros:
- Equipo sin partidos en la competencia pedida → 404 "El equipo no tiene partidos en la competencia seleccionada.";
  competencia inexistente → 400; competencia en borrador fuera del universo "todas".
- **Regresión:** los 10 cierres calificados de partidos sin prórroga son idénticos a los del `clutch.py` anterior (salvo
  el campo nuevo `overtime_periods`). Solo cambian los 2 partidos con prórroga, que ahora incluyen sus eventos.
- `python backend/test_auth.py` → TODOS LOS TESTS OK.

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: N/A (sin esquema)
- Endpoints probados: ✅ (19/19 casos de backend)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- **Formato de error:** se mantiene `{error}` (formato vigente de la API, igual que F-11); sin `code`.
- **"Todas" = sin parámetro:** la card no envía `competition=all`, igual que Liga y Datos (`competitions.resolve`
  trata el vacío como "todas").
- `games_without_pbp` se calcula en la ruta (partidos del equipo en el universo − partidos con pbp) y se pasa a
  `team_clutch`, como proponía el plan (D-1).
- El nombre del equipo sale de su partido más reciente, como `/api/teams` desde F-11.
- La cabecera "Δ@5:00" de la tabla también se arma con `window_secs`.
- El estado vacío muestra el recuento completo ("Sin cierres apretados: 0 calificado(s) · 1 excluido(s)…") en vez de
  "los {e} partido(s)… se definieron por más de…", que era inexacto con partidos sin eventos de cierre.

## Docs actualizados
- [x] `docs/api.md` — `GET /api/clutch/<team_code>`: query, defaults, recuento, prórrogas, competencia, errores
- [x] `docs/architecture.md` — `clutch.py`: constantes únicas y firma nueva
- [x] `docs/frontend.md` — card de Cierres (copy, competencia, respuestas tardías), `api.clutchTeam(team, comp?)`

## Deuda / TODO
- → F-13: `DEFAULT_MARGIN`/`DEFAULT_WINDOW_SECS` pasan a leerse de la configuración.
- `lineups`/ON-OFF siguen sin filtro de competencia (fuera de alcance de C-06).
