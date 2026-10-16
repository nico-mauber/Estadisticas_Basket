# Tasks — F-02: Pestaña Momentum

> **ID:** F-02 · **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** `spec.md`, `plan.md`

## Orden de ejecución

### Grupo A — Backend: `momentum.py`
- [ ] T-A1 [P] · `_current_run(events)` · `backend/momentum.py` · cubre RF-4 · Done: sobre un pbp fabricado con 4 canastas seguidas del mismo equipo (8 puntos) seguidas de una canasta del rival, devuelve `points=8` hasta el evento del rival y `None` después
- [ ] T-A2 [P] · `_last_n_possessions_ppp(possessions, n)` · `backend/momentum.py` · cubre RF-5, RF-12 · Done: sobre un partido del seed con más de 10 posesiones, el PPP de las últimas 10 coincide con el cálculo manual (Σpts/10) sobre esas mismas 10; con un partido de menos de 10 posesiones jugadas, devuelve `reason: "pocas_posesiones"`
- [ ] T-A3 [P] · `_last_window_ratings(possessions, window_secs, period_len)` · `backend/momentum.py` · cubre RF-6, RF-12 · Done: sobre un partido del seed, filtrando los últimos 300 s de tiempo de juego, `oer`/`der`/`net_rating` coinciden con `stats_engine.compute_standard` aplicado a las posesiones de esa ventana calculadas a mano
- [ ] T-A4 [P] · `_last_outcomes(possessions, n)` · `backend/momentum.py` · cubre RF-7 · Done: sobre un partido del seed, las últimas 5 posesiones de un equipo listadas coinciden en orden y `end_type` con el pbp real
- [ ] T-A5 · `_hot_players` regla (a) conversiones consecutivas · `backend/momentum.py` · cubre RF-8a, RF-11 · Done: un jugador con 3 conversiones seguidas en el pbp de un partido del seed aparece con la marca `makes_streak`; cambiando `momentum.hot_consecutive_makes` a 5 (mock de config), ese mismo jugador deja de aparecer por esa regla
- [ ] T-A6 [P] · `_hot_players` regla (b) puntos en ventana · `backend/momentum.py` · cubre RF-8b, RF-11 · Done: un jugador con ≥8 puntos en los últimos 180 s de un partido del seed aparece con la marca `points_window`
- [ ] T-A7 [P] · `_hot_players` regla (c) asistencias consecutivas · `backend/momentum.py` · cubre RF-8c, RF-11 · Done: 4 canastas consecutivas del equipo todas asistidas por el mismo jugador → aparece con `assist_streak`; una quinta canasta no asistida en el medio de una racha de 4 corta el conteo (según la decisión del plan §10)
- [ ] T-A8 [P] · `_hot_players` regla (d) rebotes ofensivos en el cuarto · `backend/momentum.py` · cubre RF-8d, RF-13 · Done: 3 rebotes ofensivos del mismo jugador en el cuarto actual → marca `oreb_in_quarter`; al simular el cambio de período, el conteo vuelve a 0
- [ ] T-A9 · `_cold_players` (pérdidas consecutivas) · `backend/momentum.py` · cubre RF-9, RF-11 · Done: 3 pérdidas consecutivas del mismo jugador sin evento de balón exitoso en el medio → marca `cold_streak`
- [ ] T-A10 · `compute(game_id, snapshot, possessions)` (orquesta T-A1..T-A9, agrega marcas múltiples por jugador) · `backend/momentum.py` · cubre RF-1, RF-2, RF-10, RF-12 · Done: sobre un partido del seed con al menos un jugador con dos marcas simultáneas (fabricar el escenario si el seed no lo tiene naturalmente), el objeto de ese jugador en `hot[]` trae ambas en `marks`

### Grupo B — Backend: ruta
- [ ] T-B1 · `GET /api/live/<game_id>/momentum` (llama `live.live_snapshot` + `possessions.game_possessions`, delega en `momentum.compute`) · `backend/app.py` · cubre RF-1, RF-2, RF-3 · Done: `curl "http://localhost:5000/api/live/<game_id>/momentum"` sobre un partido del seed devuelve 200 con las 6 claves de nivel raíz del spec §8; sobre un `game_id` inexistente, 404 con el mismo mensaje que F-01

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.momentum(id)` · `frontend/js/api.js` · cubre RF-1 · Done: en consola del navegador, `await api.momentum("<game_id>")` devuelve el objeto completo sin lanzar

### Grupo D — Frontend: UI
- [ ] T-D1 · Registrar modo `momentum` en el router de S5 · `frontend/js/views/partido.js` · cubre RF-1 · Done: `#/partido/<game_id>/momentum` renderiza la vista sin recargar la página
- [ ] T-D2 · Reutilizar el ciclo de polling de F-01 para disparar `api.momentum(id)` mientras esta pestaña está activa · `frontend/js/views/partido.js` · cubre RF-3 · Done: DevTools Network confirma que no hay un segundo `setTimeout` independiente corriendo en paralelo al de F-01 (mismo intervalo, sin duplicar temporizadores)
- [ ] T-D3 [P] · Bloque Racha actual · `frontend/js/components/game-view.js` (o `momentum-panel.js` si se extrae) · cubre RF-4 · Done: recorrido en navegador con un partido en racha muestra "Racha N-0 de {equipo} ({tiempo})"; sin racha, muestra "Sin racha abierta"
- [ ] T-D4 [P] · Bloque Últimas N posesiones (PPP) · ídem · cubre RF-5, RF-12 · Done: recorrido en navegador muestra el PPP de cada equipo o el estado vacío si el partido acaba de empezar
- [ ] T-D5 [P] · Bloque Últimos 5 minutos (OER/DER/Net) · ídem · cubre RF-6, RF-12 · Done: recorrido en navegador muestra la tabla comparativa de ambos equipos
- [ ] T-D6 [P] · Bloque Últimas 5 posesiones con desenlace · ídem · cubre RF-7 · Done: recorrido en navegador muestra la lista cronológica con ícono por tipo de desenlace
- [ ] T-D7 · Bloque Jugadores calientes/fríos (tarjetas con todas las marcas vigentes) · ídem · cubre RF-8, RF-9, RF-10 · Done: recorrido en navegador confirma que un jugador con dos marcas simultáneas muestra ambas en su tarjeta

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados vacíos por bloque (spec §6) · `frontend/js/components/game-view.js` (o `momentum-panel.js`) · cubre RF-12 · Done: con un partido recién comenzado, cada ventana muestra su copy de vacío correspondiente, sin excepción JS
- [ ] T-E2 · Error/offline heredado de F-01 (sin banner duplicado) · `frontend/js/views/partido.js` · cubre — · Done: simular fallo de red (DevTools offline) muestra el mismo banner que En vivo, una sola vez, no uno por pestaña

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` — N/A, F-02 no toca esquema
- [ ] T-F3 · Endpoint probado con curl sobre un partido del seed y sobre un `game_id` inexistente; shape verificado contra §8 del plan
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la pestaña Momentum completa
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅/❌

## Matriz de cobertura (CA → tareas)

| CA | Procedimiento manual | Tareas |
|---|---|---|
| CA-1 (CA del cliente) | Abrir la pestaña Momentum de un partido en curso junto a En vivo (F-01) en otra pestaña del navegador, confirmar visualmente que Momentum no repite el boxscore acumulado y solo muestra racha/ventanas/jugadores | T-A10, T-D3..T-D7, T-F4 |
| CA-2 | Con un pbp que tenga una secuencia de 8 puntos consecutivos del mismo equipo, verificar que el bloque de racha muestra "8-0" con el tiempo correcto | T-A1, T-D3, T-F4 |
| CA-3 | Con un jugador con 3 conversiones consecutivas en el pbp, verificar que aparece marcado caliente por esa regla | T-A5, T-D7, T-F4 |
| CA-4 | Con un jugador con 3 pérdidas consecutivas, verificar que aparece en alerta | T-A9, T-D7, T-F4 |
| CA-5 | Con un jugador que cumple dos reglas de "caliente" a la vez, verificar que ambas marcas aparecen en su tarjeta | T-A10, T-D7, T-F4 |
| CA-6 | Cambiar `momentum.hot_consecutive_makes` de 3 a 5 vía `PUT /api/settings` (o la UI de F-13), recargar la pestaña, confirmar que un jugador con 3 conversiones ya no aparece caliente por esa regla | T-A5, T-F3 |
| CA-7 | Abrir Momentum en un partido con menos de 10 posesiones jugadas, confirmar que el bloque de últimas N posesiones muestra el estado vacío explícito | T-A2, T-D4, T-F4 |
| CA-8 | Con un jugador con 2 rebotes ofensivos en el 2.º cuarto, simular el cambio al 3.er cuarto, confirmar que el conteo vuelve a 0 | T-A8, T-F3 |
| CA-9 | `curl "http://localhost:5000/api/live/no-existe-123/momentum"` → 404 con el mensaje exacto | T-B1, T-F3 |

0 CA sin cobertura (9/9).

## Dependencias externas

- Reimportación de partidos: no aplica; la verificación en caliente de racha/ventanas requiere un partido real en curso
  de FIBA LiveStats o un doble local del fetch de FIBA (mismo mecanismo de prueba que F-01, compartido).
- Variables de entorno: ninguna nueva.
- Requisitos previos que deben estar implementados antes de ejecutar el Grupo F de F-02: F-01 (`live.live_snapshot`), F-13
  (`config.get`, `CONFIG_SPEC` con las 9 claves `momentum.*` expuestas), A-01 (`possessions.game_possessions`).
- Configuración: las 9 claves `momentum.*` deben existir con sus defaults en la base (`app_config` vacía = defaults de
  `CONFIG_SPEC`, sin necesidad de seed adicional) antes de poder verificar CA-6.
