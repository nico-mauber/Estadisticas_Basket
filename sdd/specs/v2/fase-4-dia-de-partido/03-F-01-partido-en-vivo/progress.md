# Progress — F-01: Partido en vivo

> **Estado:** 🔶 Implementado y verificado con partido simulado; falta verificación en navegador y con un partido real en curso
> **Fecha:** 2026-10-16
> Reglas: `sdd/04-implement.md`. Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

## Estado de tareas

### Grupo A — Backend: `chains.py`
- [x] T-A1 · `assist_points(possessions)` — valor del tiro asistido (2/3), no toda la posesión
- [x] T-A2 · `oreb_points(possessions, events, name_to_id)` — puntos de la oportunidad (`Chance.n ≥ 2`) que abre el rebote
- [x] T-A3 · `steal_points(possessions, events, name_to_id)` — puntos de la posesión propia siguiente al robo
- [x] T-A4 · `turnover_cost(possessions)` — puntos del rival en la posesión inmediata siguiente

### Grupo B — Backend: `live.py`
- [x] T-B1 · `is_final(raw)` — `True` en el raw archivado de 2849343, `False` recortado a Q3
- [x] T-B2 · Caché TTL en memoria (LRU 32, reloj de pared) — 2 llamadas dentro del TTL = 1 descarga
- [x] T-B3 · Bloque `teams` vía `compute_standard`, minutos = tiempo transcurrido del pbp
- [x] T-B4 · `_vs_season` vía `bundles._team_bundle_from_games` — igual a `/api/metrics/team`
- [x] T-B5 · `_points_distribution` — `by_shot` suma PTS exacto; `by_origin` aparte (ver desviaciones)
- [x] T-B6 · `players_on_court` — 5/5 = último tramo de `build_segments_both` (pbp ordenado)
- [x] T-B7 · Bloque `players` — standard (OER, TS%, eFG%, USO%, +/−) + 5 cadenas
- [x] T-B8 · `live_snapshot` — caché → persistido → fetch → fin + persistencia automática → snapshot

### Grupo C — Backend: ruta
- [x] T-C1 · `GET /api/live/<game_id>[?url=]` — 200 / 400 / 404 / 502

### Grupo D — Frontend: api.js
- [x] T-D1 · `api.live(id, {url})`

### Grupo E — Frontend: UI
- [x] T-E1 · Modo en vivo: `components/live-view.js`, entrada **Seguir en vivo** en Importar (sin router X-01)
- [x] T-E2 · Polling `setTimeout` recursivo cada `live.poll_secs` (10–60); se corta en `setSection` y al abrir otro partido
- [x] T-E3 · Badge EN VIVO pulsante / DESACTUALIZADO / SIN CONEXIÓN + banners
- [x] T-E4 · Eficiencia y four factors lado a lado con Δ vs temporada (color invertido en DER y TO%)
- [x] T-E5 · Distribución en barras (dos grupos)
- [x] T-E6 · Jugadores con estado en cancha/banco (en cancha primero)
- [x] T-E7 · Finalizado: banner + vista Analizar (F-07) con los datos persistidos

### Grupo F — Verificación de feature
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · `upgrade_db()` — N/A, sin cambios de esquema
- [x] T-F3 · `/api/live` probado con curl (404 id inválido, 400 url de otro host, finalizado) y con simulación
- [ ] T-F4 · Consola del navegador sin errores JS durante 2 ciclos de polling — sin navegador en la sesión; render probado en Node (`live_render.mjs`, 13/13)
- [ ] T-F5 · CA-1 con partido real en curso

## Estado de CA (gate de aceptación)

Simulación: raw archivado de 2849343 servido con id falso `9999999` (recortado a Q3 = en curso; completo = finalizado), `fetch_raw_by_id` reemplazado, sobre una **copia** de la base (`live_sim.py`, 29/29 OK).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | 🔶 | Polling sin recarga implementado y probado en Node; al finalizar se persiste con la misma ingesta que la importación (mismo box oficial). Falta verlo con un partido real |
| CA-2 | ✅ | Dos `live_snapshot` dentro del TTL → contador de descargas = 1 |
| CA-3 | ✅ | Caché vencida + `URLError` → mismo snapshot con `stale: true`; frontend muestra "Datos desactualizados desde {hora}" |
| CA-4 | ✅ | Partido persistido → `finalizado`; el frontend dibuja la vista Analizar (F-07) con esos datos |
| CA-5 | ✅ | Raw con `game`/`end` → `finalizado`, partido en la base y en `GET /api/games` sin `POST /api/import` |
| CA-6 | ✅ | `vs_season.metrics.oer.own_avg` = `oer` de `/api/metrics/team?competition=` (0,9594 / 0,9951) |
| CA-7 | ✅ | Desglose no publicado → `null` con razón `no_registrado`; `otros_no_clasificado` visible en `by_shot` |
| CA-8 | ✅ | `players_on_court` = último tramo de `build_segments_both` (5/5 en ambos equipos) |
| CA-9 | ✅ | `/api/live/abc` → 404 `no_encontrado`; FIBA 404 sin caché → 404 |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅
- Regresión: `/api/game/2849343/possessions` idéntico tras el refactor de `possessions.py`; `/api/game/2849343` solo cambia en métricas que antes eran null (USO%, AS%, OR%, DR%, REB%, USO 2P/3P), por `derived` agregado
- Mismo resultado de cadenas por base (`game_possessions`) y en memoria (`build_from_events`): Q1–Q3 `turnover_cost` 8, `assist_points` 52
- Partido completo: `turnover_cost` 26 vs `pts_from_tov` FIBA 24; `oreb_points` coherente con `second_chance_pts`
- `node --check` en app.js, api.js, live-view.js, game-view.js, sw.js: ✅
- Consola del navegador: pendiente

## Desviaciones respecto a docs/ o plan
- **Sin router X-01:** no existe `views/partido.js`; el modo en vivo es `components/live-view.js` llamado desde `showLiveGame()` en app.js. No hay ruta `#/partido/<id>/vivo`.
- **Entrada:** los partidos en curso no están en el catálogo; se abren con **Seguir en vivo** (URL o id) en Importar.
- **Firmas de `chains.py`:** `oreb_points` y `steal_points` reciben además `events` y `name_to_id` (la `Possession` no guarda reboteador ni ladrón). Retorno uniforme `{points, count}`.
- **Clave de jugador en vivo:** `"<equipo>|<nombre>"` en vez de `player_id` int (el partido no está en la base).
- **Distribución en dos grupos:** el spec pide 8 categorías en una lista que sume 100 %, pero segunda oportunidad, contraataque y tras pérdida se superponen con pintura/media/triples/TL y entre sí. `by_shot` (excluyente, suma PTS) y `by_origin` (porcentaje de PTS cada uno, no excluyentes). Contraataque y tras pérdida salen de FIBA, no de A-01.
- **Partido finalizado:** en vez del layout en vivo con datos persistidos, se muestra la vista Analizar (F-07) con un banner (plan §8 lo define como redirección a Analizar).
- **Config:** `live.*` pasan a `activa` (editables en Configuración) con rangos del spec: `poll_secs` 10–60, `fetch_timeout_secs` 3–20.
- **Persistencia automática** la dispara cualquier usuario con sesión (no solo admin): es la misma ingesta idempotente de la importación.
- **Mejora colateral F-07:** el box del partido ahora calcula USO%/AS%/OR%/DR%/REB% (`bundles.player_derived` extraída y reutilizada).

## Docs actualizados
- ✅ `docs/api.md` — `GET /api/live/<game_id>`
- ✅ `docs/architecture.md` — `live.py`, `chains.py`, `possessions.build_from_events`, `bundles.player_derived`, cambios de `fiba_fetcher`
- ✅ `docs/frontend.md` — vista Partido (Analizar + En vivo), Seguir en vivo, `api.live`
- ✅ `docs/deployment.md` — nota DA-28 (1 worker síncrono; `render.yaml` sin cambios)

## Deuda / TODO
- T-F4/T-F5: probar en navegador y con un partido real en curso.
- DA-28: decidir `--threads` en Render (requiere revisar thread-safety de cachés y SQLite).
- Sin estado "el partido todavía no comenzó" distinto de 404 cuando FIBA aún no publica `data.json` (spec §9, NEEDS CLARIFICATION).
- A-07 extiende `chains.py` para el análisis histórico.
