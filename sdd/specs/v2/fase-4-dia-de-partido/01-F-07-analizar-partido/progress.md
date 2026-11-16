# Progress — F-07: Analizar partido

> **Estado:** ✅ Completado (2026-11-16): CA-1…CA-16 verificados (backend 33/33 en 3 scripts, Chromium 45/45 a 1280 y 360 px)
> **Fecha:** 2026-10-16
> Reglas: `sdd/04-implement.md`. Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

## Estado de tareas
- [x] T-A1 · `game.run_min_points` en `CONFIG_SPEC`
- [x] T-A2 · `game_analysis.py`: `TYPE_GROUPS`, `elapsed_secs`, `period_key`
- [x] T-B1 · `period_partials` (pbp fallback; oficial no disponible sin F-11 v2)
- [x] T-B2 · `score_timeline` (puntos, tiempos muertos, rachas, liderazgo, empates, máxima ventaja)
- [x] T-B3 · `game_pbp` con filtros jugador/tipo/período
- [x] T-B4 · `game_shots` (zonas, bandas desde A-01, filtros)
- [x] T-B5 · `reconcile_game` (score_final, players_sum, period_sum, timeline_final)
- [x] T-B6 · `_game_player_bundles` (StatBundle por jugador, DNP, base T-04)
- [x] T-B7 · `_game_lineup_bundles` (quintetos con badge)
- [x] T-B8 · `game_detail` (ensamblador + `cache.memo("game", ...)`)
- [x] T-B9 · `matchups.game_matchups` (3 niveles: quinteto, jugador, jugador_quinteto)
- [x] T-B10 · `matchups.team_matchups` (placeholder para F-03)
- [x] T-B11 · Entidad `matchup` registrada en `metrics_catalog`
- [x] T-B12 · Rutas `/api/game/<id>`, `/pbp`, `/matchups`, `/shots`
- [x] T-C1 · Métodos de `api.js`: `game`, `gamePbp`, `gameMatchups`, `gameShots`
- [x] T-D1 · `drawScoreTimeline` en `charts.js`
- [x] T-D2 · Esqueleto `renderGameView` en `game-view.js` (6 tabs: Resumen/Box/Tiros/Jugadas/Quintetos/Cruces)
- [x] T-D3 · Bloque Resumen (parciales, timeline, ratings por período, conjunto estándar)
- [x] T-D4 · Bloque Box (box oficial por equipo con jugadores, DNP, +/−, conciliación)
- [x] T-D5 · `shotChart` `colorBy: "none"` (sin percentil en vista partido)
- [x] T-D6 · Bloque Tiros (mapa de tiro home/away side-by-side)
- [x] T-D7 · Bloque Jugadas (PBP filtrable por período/tipo/jugador, 200 eventos máx)
- [x] T-D8 · Bloques Quintetos y Cruces (lineup table con OER/DER/Net/eFG/muestra, matchups con PPP)
- [x] T-D9 · Menú Exportar en el encabezado: CSV/XLSX con el box de ambos equipos; PNG (1080 px) y PDF A4 de 2 páginas con el informe de scouting (`game-report.js`)
- [x] T-D10 · Sección `partido` habilitada en app.js (sin botón nav, acceso desde catálogo)
- [x] T-D11 · Click en fila del catálogo abre vista partido
- [x] T-D12 · Estilos game-view en `style.css` (responsive, tabs, tablas, shots grid)
- [x] T-E1 · Estados de bloque: loading, error con «Reintentar» y aviso de sin conexión (`_blockError`); guarda de pestaña contra respuestas tardías
- [x] T-E2 · `sw.js` v26 → v27 (game-view.js en STATIC)
- [x] T-F1 … T-F23 · Verificación (ver tabla de CA y evidencia abajo)
- [x] T-G1 · Enlace desde calendario: Datos › Calendario y Mi equipo enlazan `#/partido/<id>` (hecho en F-12)
- [x] Cierre (2026-11-16): ingesta 6 (parciales oficiales y rebotes/pérdidas de equipo), entidad `matchup` completa, tablas T-06 `game_players`/`game_lineups`/`game_matchups`, filtros de tiros por cuarto y tramo, contador del jugada a jugada, modo `vivo`, pestaña en la dirección

## Estado de CA (gate de aceptación)
Evidencia: `f07_sim.py` 9/9, `f07_sim2.py` 11/11, `f07_tables.py` 13/13 (copia de la base reprocesada con la ingesta 6) y `f07_browser.py` 45/45 en Chromium a 1280 y 360 px, sin errores de consola (scratchpad de la sesión; servidor de prueba con un partido sin pbp borrado a propósito).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ✅ | 13/13 partidos: PTS = marcador, Σ jugadores + rebotes/pérdidas de equipo = total en cada conteo, Σ parciales oficiales = PTS, timeline final = marcador (`partials_source = "oficial"`) |
| CA-2 (CA del cliente) | ✅ | `renderGameView(div, id, {mode: "vivo", payload})` dibuja las 8 pestañas y el box desde el payload, sin exportar ni conciliación ni errores |
| CA-3 | ✅ | Catálogo, game log de Equipo y de Jugador abren `#/partido/<id>/analizar`; la pestaña viaja en la dirección (`#/partido/<id>/box`) y recargar la reproduce |
| CA-4 | ✅ | 2849347 y 2849340: duración 2700 s, columna `PR1` en parciales, encabezado "1 prórroga" |
| CA-5 | ✅ | F. Medina + Tiro de campo + 3C → contador "(2 de 593 eventos)" = 2 filas = `…/pbp?player=68&type=tiro&period=3` |
| CA-6 | ✅ | LAG 2.º cuarto + tardío: 6 intentos en la UI = 6 tiros de campo tardíos del 2.º cuarto en A-01; los sin tramo se informan aparte ("N sin tramo") |
| CA-7 | ✅ | Sin filtros: 71 intentos = TCi oficial |
| CA-8 | ✅ | Cruces quinteto: 35 de 36 filas en gris (muestra baja) con badge; Σ posesiones de la tabla = Σ del endpoint |
| CA-9 | ✅ | `/api/metrics/matchup?id=…&game=…`: mismos grupos y claves que `/api/metrics/lineup` y `/api/metrics/player`; PTS del cruce = `pts_for` de la fila |
| CA-10 | ✅ | Partido sin pbp: encabezado, box y parciales oficiales; línea de tiempo, jugadas, quintetos y cruces con estado vacío y "Reimportalo desde Datos › Calidad…" |
| CA-11 | ✅ | Fila "· No jugó", métricas nulas con razón `dnp`, minutos nulos (no suman) |
| CA-12 | ✅ | Box/quintetos/cruces son tablas T-06: el CSV trae las mismas filas y columnas visibles, con cabecera `# Título`, `# Entidad: Partido <id>`, `# Competencia`, `# Temporada`, `# Filtros: Partido=…`, `# Generado`; XLSX sale de los mismos datos |
| CA-13 | ✅ | Informe de scouting A4 (`game-report.js`, verificado en be2f63a) |
| CA-14 | ✅ | Leyenda "Coincidencia en cancha…" visible; "marcaje" no aparece en la página ni en los diccionarios |
| CA-15 | ✅ | `/api/game/NOEXISTE` → 404 `no_encontrado`; `/pbp?type=xyz` → 400 `parametro_invalido` |
| CA-16 | ✅ | 3 rachas ≥ 8; con `game.run_min_points = 12` quedan 2 al recargar; restaurado con `POST /api/settings/reset` |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅ (F-07 no toca esquema)
- Endpoints probados (test_client): ✅ game 200, pbp 200 (593 total, 36 filtered), matchups quinteto 200 (36 rows), matchups jugador 200 (100 rows), shots 200, error cases 404/400
- Consola del navegador sin errores JS: ✅ Chromium (Playwright) a 1280 px y 360 px, las 7 pestañas (incluida Momentum de F-02) sin errores de consola, sin "undefined/NaN" y sin scroll horizontal de página (2026-10-16)
- `game-view.js` syntax check: ✅ (node -c)
- `shot-chart.js` syntax check: ✅ (node -c)
- Dev server localhost:5000: ✅ (game-view.js served 200)

## Desviaciones respecto a docs/ o plan
- **Parciales:** fuente oficial desde la ingesta 6 (`team_game_stats.period_pts`). FIBA da una sola cifra para todas las prórrogas (`ot_score`): con una prórroga va directa; con varias se reparten según el pbp. Sin parciales oficiales se reconstruyen del pbp (`partials_source = "pbp"`).
- **Rebotes y pérdidas de equipo:** columnas nuevas `team_orb`, `team_drb`, `team_tov` (ingesta 6). Los partidos ya importados quedan "pendientes de reproceso" en Datos › Calidad hasta reprocesarlos; mientras tanto la conciliación los informa como `unverified` en vez de falla.
- **Tablas T-06 formales:** `game_players`, `game_lineups`, `game_matchups` (sin percentiles ni promedio de competencia: `pct_mode = "none"`). El box es una tabla ordenable, no el formato fijo del box de FIBA; el modo `vivo` conserva el formato fijo desde el payload.
- **Entidad `matchup`:** el id es el de la fila de cruces; sin `?game=` suma todos los enfrentamientos de la competencia. Sin población (no hay universo de cruces comparable).
- **Ruta:** `#/partido/<id>/<pestaña>` con `analizar` = Resumen (el spec nombra solo `analizar`).
- **Sin router X-01 por vistas:** la vista sigue en `components/game-view.js` montada por `app.js`.

## Métricas de rendimiento
- `GET /api/game/<id>`: 0,59 s en frío y 0,22 s en caliente (servidor de desarrollo por HTTP, base de 13 partidos); `GET /api/table/game_players`: 0,23 s. Objetivo < 1,5 s en frío cumplido.

## Docs actualizados
- ✅ `docs/api.md` — forma real de `GET /api/game/<id>`, tablas `game_*`, entidad `matchup`
- ✅ `docs/database.md` — `team_orb`, `team_drb`, `team_tov`, `period_pts`
- ✅ `docs/architecture.md` — ingesta 6, `game_analysis`, `matchups`, `tables` (`pct_mode`, `sample_col`)
- ✅ `docs/frontend.md` — vista del partido, dirección con pestaña, tablas, filtros, modo vivo

## Deuda / TODO
- Ninguna de F-07. Pendiente operativo: reprocesar en QA/producción los partidos importados (Datos › Calidad) para tener parciales oficiales y rebotes de equipo.
