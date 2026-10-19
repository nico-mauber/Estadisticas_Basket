# Progress — F-02: Pestaña Momentum

> **Estado:** 🔶 Implementado y verificado con pbp fabricado, partidos guardados y modo en vivo simulado; falta verificación en navegador y con un partido real en curso
> **Fecha:** 2026-10-16
> Reglas: `sdd/04-implement.md`. Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

## Estado de tareas

### Grupo A — Backend: `momentum.py`
- [x] T-A1 · `_current_run` — parcial abierto desde los deltas de `s1`/`s2`
- [x] T-A2 · `_last_n_ppp` — PPP de las últimas N posesiones completas; `pocas_posesiones` si no alcanza
- [x] T-A3 · `_last_window` — OER/DER/Net en los últimos `window_secs` de juego; `pocos_minutos` si no alcanza
- [x] T-A4 · `_last_outcomes` — últimas N posesiones (más reciente primero) con desenlace, tirador, asistente, triple, rebote ofensivo
- [x] T-A5 · Regla (a) tiros de campo convertidos seguidos
- [x] T-A6 · Regla (b) puntos en la ventana corta
- [x] T-A7 · Regla (c) canastas seguidas del equipo asistidas por el mismo jugador
- [x] T-A8 · Regla (d) rebotes ofensivos en el cuarto (reinicia por período)
- [x] T-A9 · `_cold_players` — pérdidas seguidas sin canasta/asistencia/rebote propio en el medio
- [x] T-A10 · `compute` — todas las marcas por jugador

### Grupo B — Backend: ruta
- [x] T-B1 · `GET /api/live/<game_id>/momentum` (`live.live_momentum`, mismos errores que F-01)

### Grupo C — Frontend: api.js
- [x] T-C1 · `api.momentum(id, {url})`

### Grupo D — Frontend: UI
- [x] T-D1 · Pestaña interna **Momentum** en En vivo y 7.ª pestaña en Analizar (sin router X-01)
- [x] T-D2 · Mismo temporizador de F-01: con Momentum activo cada ciclo pide `live` + `momentum`
- [x] T-D3 · Parcial abierto
- [x] T-D4 · PPP últimas N posesiones
- [x] T-D5 · OER/DER/Net últimos minutos
- [x] T-D6 · Últimas posesiones con desenlace
- [x] T-D7 · Jugadores calientes / en alerta con todas sus marcas

### Grupo E — Errores, estados vacíos, offline/SW
- [x] T-E1 · Estados vacíos por bloque (copy del spec §6)
- [x] T-E2 · Error/offline: banner y badge del header de En vivo (uno solo, compartido por las dos pestañas)

### Grupo F — Verificación de feature
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · `upgrade_db()` — N/A
- [x] T-F3 · curl: `/api/live/abc/momentum` 404; `/api/live/2849343/momentum` 200 con las 6 claves del plan §8
- [x] T-F4 · Chromium (Playwright) a 1280 px y 360 px: 0 errores de consola; pestaña Momentum en En vivo y en Analizar. Corregido en esa pasada: en tiros/libres fallados el desenlace mostraba al reboteador rival; ahora el tirador (verificado en 13 partidos × 4 cuartos: 0 jugadores del equipo equivocado)
- [ ] T-F5 · CA-1 con partido real en curso

## Estado de CA (gate de aceptación)

Pruebas en `momentum_sim.py` (32/32) sobre una copia de la base: escenarios de pbp fabricados, partido guardado 2849343 y modo en vivo simulado con el raw archivado.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | 🔶 | Pestaña sin acumulados (solo parcial, ventanas, posesiones recientes, jugadores). Falta verla con un partido real |
| CA-2 | ✅ | 2 del rival + 4 dobles propios → `8-0`, `elapsed_secs` 60 desde el primer punto |
| CA-3 | ✅ | 3 conversiones seguidas → `makes_streak`; un fallo posterior la corta |
| CA-4 | ✅ | 3 pérdidas → `cold_streak`; un rebote propio en el medio corta |
| CA-5 | ✅ | Fabricado (`makes_streak` + `assist_streak`) y real: 2849328 al entretiempo, R. Previatti con `makes_streak` + `oreb_in_quarter` |
| CA-6 | ✅ | `PUT /api/settings` `hot_consecutive_makes` 3→5 → el momentum guardado usa 5 (caché invalidado por `config_version`); con 5, 3 conversiones ya no marcan |
| CA-7 | ✅ | Partido a 1:30 de juego → PPP `pocas_posesiones`, ventana `pocos_minutos` |
| CA-8 | ✅ | 3 RO en el 2C → marca; primer evento del 3C → sin marca |
| CA-9 | ✅ | `/api/live/abc/momentum` → 404 `no_encontrado` |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅
- PPP últimas 10 y últimas 5 posesiones = cálculo manual sobre `game_possessions` (ambos equipos)
- Net = OER − DER; DER local = OER visitante en la misma ventana
- Momentum en vivo no agrega descargas (contador = 1 con snapshot + momentum)
- Reglas sobre datos reales (13 partidos × 4 finales de cuarto): `makes_streak` 40, `oreb_in_quarter` 10, `cold_streak` 4, `points_window` 3
- F-01 sin regresión: `live_sim.py` 29/29, `live_render.mjs` 13/13
- `node --check` de los JS tocados: ✅

## Desviaciones respecto a docs/ o plan
- **Claves de configuración:** el spec dice que las 9 claves `momentum.*` ya estaban catalogadas, pero `CONFIG_SPEC` tenía otras (`margin`, `run_pts`, `swing_*`, `drought_*`, `bonus_min`) reservadas y sin consumidor. Se agregaron las 8 que faltaban y se activó `window_secs`; las reservadas quedan sin tocar.
- **Fuente de datos:** el plan usa `possessions.game_possessions(game_id)` (lee la base); un partido en curso no está guardado, así que en vivo se usan las posesiones en memoria que ya arma `live.py` (`build_from_events`) y el momentum se calcula en el mismo armado del snapshot. Partido guardado → `game_possessions` + `pbp_events`.
- **OER/DER de la ventana:** puntos por posesión reconstruida (A-01) en vez de `compute_standard` (que estima posesiones con la fórmula del box; `possessions_bundle` no trae `pts`). Para una ventana de 5 minutos el conteo real es más preciso.
- **Racha:** se calcula con los deltas de marcador del pbp; no se corta ante una posesión incompleta intermedia (spec §9, caso de 0,33 %).
- **Asistencias:** las asistencias a tiros libres (FIBA las cuenta en el box) no son canastas de campo y no entran en la regla (c); por eso las detectadas son 85–97 % del box.
- **Ruta:** sin `#/partido/<id>/momentum` (no hay router X-01): pestaña interna de En vivo y 7.ª pestaña de Analizar.
- **Jugadores:** se identifican por `"<equipo>|<nombre>"` (igual que F-01 en vivo).

## Docs actualizados
- ✅ `docs/api.md` — `GET /api/live/<game_id>/momentum`
- ✅ `docs/architecture.md` — `momentum.py`
- ✅ `docs/frontend.md` — pestaña Momentum, `api.momentum()`

## Deuda / TODO
- T-F4/T-F5: probar en navegador y con un partido real en curso.
- [NEEDS CLARIFICATION] (spec §9): canasta no asistida en la racha de asistencias — implementado con la lectura estricta (corta). Confirmar con el cliente.
