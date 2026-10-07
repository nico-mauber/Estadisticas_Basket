# Plan — F-02: Pestaña Momentum

> **ID:** F-02 · **Prioridad:** P1 · **Fase y orden:** Fase 4 — Día de partido · 04
> **Depende de:** F-01 ([../03-F-01-partido-en-vivo/plan.md](../03-F-01-partido-en-vivo/plan.md)) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)) · A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §4 · F-02 · Arquitectura §3.2, §3.9, §3.17, §4, §6, §8
> **Estimación:** M · 8–12 h

## 1. Enfoque

`momentum.py` (NUEVO, PROPUESTA de nombre — spec §9) es un módulo de solo cálculo: recibe el mismo `parsed`/snapshot que
`live.live_snapshot` ya construyó (F-01) y `possessions.game_possessions(game_id)` (A-01), y deriva sobre eso las 3
ventanas de equipo, la racha y las 5 reglas de jugador. No vuelve a tocar red ni caché propia: la caché ya la tiene
`live.py` (mismo TTL). El endpoint `GET /api/live/<game_id>/momentum` llama primero a `live.live_snapshot(game_id)` (para
reusar exactamente el mismo dato que ve En vivo en ese instante) y a `possessions.game_possessions(game_id)`, y pasa ambos
a `momentum.compute(...)`. Todos los umbrales se leen de `config.get("momentum.<clave>")`, ya catalogados por la
arquitectura — este plan no agrega ninguna clave nueva a `CONFIG_SPEC`.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/momentum.py` | module (NUEVO, PROPUESTA de nombre) | `compute(game_id, snapshot, possessions)` y las funciones de racha/ventanas/reglas de jugador | RF-4..RF-13 |
| `backend/app.py` | route | `GET /api/live/<game_id>/momentum` (ruta fina, delega en `momentum.py`) | RF-1, RF-2, RF-3 |
| `frontend/js/api.js` | api | `api.momentum(id)` | RF-1 |
| `frontend/js/views/partido.js` (de F-01/F-07) | js-view | registra el modo `momentum`; reutiliza el mismo adaptador de polling de F-01 (no crea uno propio) | RF-1, RF-3 |
| `frontend/js/components/game-view.js` (de F-07, extendido por F-01) | component (extiende) | agrega el bloque Momentum (racha, ventanas, jugadores) cuando `mode` incluye momentum, o vive en un componente separado si `game-view.js` ya está grande — decidir al implementar según cómo haya quedado tras F-01 | RF-4..RF-10 |
| `frontend/css/style.css` | css | sección `/* ── momentum (F-02) ── */`: tarjetas de jugador caliente/frío, indicador de racha | RF-4, RF-8, RF-9 |
| `frontend/sw.js` | cache | `/api/live/*` ya cae bajo `/api/*` (siempre a red, desde F-01); sin cambio si no hay archivo estático nuevo | — |
| `docs/api.md`, `docs/architecture.md`, `docs/frontend.md` | doc | endpoint `GET /api/live/<game_id>/momentum`, módulo `momentum.py`, pestaña Momentum | — (cierre) |

**Matriz RF → archivo:**

| RF | Archivo(s) |
|---|---|
| RF-1, RF-2, RF-3 | `app.py`, `views/partido.js` (reusa polling de F-01) |
| RF-4 | `momentum.py` (`_current_run`) |
| RF-5 | `momentum.py` (`_last_n_possessions_ppp`) |
| RF-6 | `momentum.py` (`_last_window_ratings`) |
| RF-7 | `momentum.py` (`_last_outcomes`) |
| RF-8 | `momentum.py` (`_hot_players`) |
| RF-9 | `momentum.py` (`_cold_players`) |
| RF-10 | `momentum.py` (`compute` agrega todas las marcas por jugador) |
| RF-11 | `momentum.py` (todo umbral vía `config.get`) |
| RF-12, RF-13 | `momentum.py` (razones C-11, reinicio por cuarto) |

## 3. Backend — rutas y modelos

Sin cambios de esquema.

**`GET /api/live/<game_id>/momentum`** (login_required)
- Sin query adicional.
- 404 `{"error": "Partido no encontrado", "code": "no_encontrado"}` — mismo criterio que `GET /api/live/<game_id>` (F-01).
- 502 `{"error": "No se pudo obtener el partido en vivo", "code": "fiba_no_disponible"}` — heredado de F-01 si
  `live_snapshot` no pudo obtener ni siquiera un snapshot `stale`.
- 200 → shape de §8 (`{run, last_possessions, last_window, last_outcomes, hot[], cold[]}`).

## 4. Backend — lógica

### `backend/momentum.py` (NUEVO)

```
compute(game_id: str, snapshot: dict, possessions: list[Possession]) -> dict
    # orquesta las 6 funciones de abajo y arma el payload de §8; cada sub-bloque trae su propia razón de nulo si no
    # hay datos suficientes (RF-12)

_current_run(events: list[dict]) -> dict | None
    # recorre pbp en orden inverso desde el evento más reciente; acumula puntos del mismo team_code hasta encontrar
    # una canasta del equipo contrario; "None" (sin racha) si el último evento de puntuación fue seguido inmediatamente
    # por un punto del rival sin que el primer equipo sume después
    # -> {"team_code": ..., "points": 8, "opp_points": 0, "since_clock": {"period": 3, "clock_secs": 274},
    #     "elapsed_secs": 134}
    # spec §9: si la posesión intermedia (entre dos canastas del mismo equipo) está marcada `incomplete` por A-01,
    # la racha se corta ahí por precaución (C-11)

_last_n_possessions_ppp(possessions: list[Possession], n: int) -> dict
    # últimas n posesiones válidas (no incompletas) por team_code, PPP = Σpts / n (o razón `pocas_posesiones` si el
    # partido tiene menos de n posesiones jugadas en total)   -> RF-5, RF-12

_last_window_ratings(possessions: list[Possession], window_secs: int, period_len: dict) -> dict
    # filtra posesiones cuyo tiempo de juego transcurrido (acumulado con PERIOD_LEN, no reloj de pared) cae dentro de
    # los últimos window_secs; agrega StatBundle de cada equipo -> stats_engine.compute_standard (oer, der, net_rating)
    # razón `pocos_minutos` si el partido lleva menos de window_secs jugados   -> RF-6, RF-12

_last_outcomes(possessions: list[Possession], n: int) -> list[dict]
    # últimas n posesiones (incompletas incluidas, marcadas como tales) por equipo, cada una:
    # {"team_code", "end_type", "pts", "assister_id", "is_three": end_type == "t3c", "had_second_chance": len(chances)>1}
    # -> RF-7

_hot_players(snapshot: dict, possessions: list[Possession], period: int, elapsed_in_period_secs: int) -> list[dict]
    # (a) makes_streak: recorre eventos de tiro de campo/TL de cada jugador en orden, cuenta consecutivos convertidos
    #     sin fallo intermedio -> compara con config.get("momentum.hot_consecutive_makes")
    # (b) points_window: suma de puntos del jugador en los últimos config.get("momentum.hot_points_window_secs") de
    #     tiempo de juego -> compara con config.get("momentum.hot_points")
    # (c) assist_streak: recorre canastas consecutivas del EQUIPO (no del jugador); si todas están asistidas por el
    #     mismo jugador sin interrupción, cuenta -> compara con config.get("momentum.assist_streak"); una canasta sin
    #     asistir corta la racha (spec §9)
    # (d) oreb_in_quarter: cuenta rebotes ofensivos del jugador en el período actual (reinicia al cambiar `period`,
    #     RF-13) -> compara con config.get("momentum.oreb_in_quarter")
    # cada jugador que cumple ≥1 regla aparece una vez en la lista con todas sus marcas vigentes (RF-10):
    # {"player_id", "name", "marks": ["makes_streak", "assist_streak"]}

_cold_players(possessions: list[Possession]) -> list[dict]
    # recorre pérdidas de cada jugador en orden, cuenta consecutivas (sin evento de balón exitoso del mismo jugador —
    # tiro convertido, asistencia, rebote — en el medio) -> compara con config.get("momentum.cold_consecutive_tov")
    # {"player_id", "name", "marks": ["cold_streak"]}
```

**Manejo de nulos (C-11).** Cada ventana trae su propia razón cuando no hay muestra suficiente: `last_possessions.reason
= "pocas_posesiones"` si el partido tiene menos de `momentum.last_possessions` posesiones jugadas en total;
`last_window.reason = "pocos_minutos"` si lleva menos de `momentum.window_secs` de juego. `run` es `null` (sin razón,
es un estado normal: "no hay racha abierta ahora mismo") cuando el último punto lo anotó el equipo que le sigue
inmediatamente el rival.

**Casos borde.**
- Partido recién empezado (0 posesiones): todas las ventanas devuelven su estado vacío explícito, sin excepción.
- Cambio de cuarto: `oreb_in_quarter` se calcula filtrando por `period` actual (extraído del snapshot), no acumulado.
- Empate a la salida del vestuario (0-0 al reanudar tras el descanso): `run = null` (sin racha), correcto.

## 5. Frontend — capa API (api.js)

```js
api.momentum: (id) => apiFetch(`/api/live/${id}/momentum`)
```

## 6. Frontend — UI

Vista: S5 · Partido, modo `momentum`. Ruta `#/partido/<game_id>/momentum`, registrada por F-01/X-01; F-02 la habilita.
Reutiliza el mismo `setTimeout` de polling que F-01 configuró para el modo `vivo` — si el usuario está en la pestaña
Momentum, el `views/partido.js` de F-01 dispara **ambas** llamadas (`api.live(id)` y `api.momentum(id)`) en el mismo ciclo
para no duplicar temporizadores (RF-3), o, si resulta más simple al implementar, solo llama `api.momentum(id)` mientras
esa pestaña está activa (decisión de implementación, sin impacto en el contrato).

**Componentes compartidos reutilizados** (§8 de la arquitectura): `core/format.js` (`nullDisplay`, `fmtNumber`),
`core/colors.js` (no aplica percentil, pero sí color de "caliente"/"frío" con la misma paleta base), `components/
metric-card.js` (para OER/DER/Net Rating de la ventana de 5 minutos, reutilizando su formato de ficha sin ranking —
`showRanking: false`, ya soportado por la firma de la arquitectura §8).

**Estados** (loading/vacío/error/offline/éxito): copiados literalmente de `spec.md` §6.

**Mobile (<768 px):** contenido compacto en una columna (spec §6); sin necesidad de pestañas internas adicionales dentro
de Momentum.

## 7. Navegación

Agrega el modo `momentum` a la pestaña S5 · Partido (ya registrada por F-01 con `vivo`, F-07 con `analizar`); F-02 la
habilita con `enabled: true`. Ruta: `#/partido/<game_id>/momentum`.

## 8. Contratos de datos

### `GET /api/live/<game_id>/momentum` — response 200
```json
{
  "run": {"team_code": "CNF", "points": 8, "opp_points": 0,
          "since": {"period": 3, "clock_secs": 274}, "elapsed_secs": 134},
  "last_possessions": {
    "n": 10, "reason": null,
    "home": {"ppp": {"value": 1.20, "reason": null}}, "away": {"ppp": {"value": 0.90, "reason": null}}
  },
  "last_window": {
    "window_secs": 300, "reason": null,
    "home": {"oer": {"value": 1.15, "reason": null}, "der": {"value": 0.95, "reason": null},
             "net_rating": {"value": 0.20, "reason": null}},
    "away": {"oer": {"value": 0.95, "reason": null}, "der": {"value": 1.15, "reason": null},
             "net_rating": {"value": -0.20, "reason": null}}
  },
  "last_outcomes": {
    "home": [{"end_type": "t3c", "pts": 3, "assister_id": 812, "is_three": true, "had_second_chance": false}],
    "away": [{"end_type": "perdida", "pts": 0, "assister_id": null, "is_three": false, "had_second_chance": false}]
  },
  "hot": [{"player_id": 812, "name": "J. Pérez", "marks": ["makes_streak", "points_window"]}],
  "cold": [{"player_id": 933, "name": "M. Silva", "marks": ["cold_streak"]}]
}
```

Filas SQLAlchemy: ninguna nueva ni tocada (F-02 no toca esquema ni persiste nada, Constitución 4).

## 9. Manejo de errores y offline

| Código | Situación | Mensaje |
|---|---|---|
| 404 `no_encontrado` | `game_id` no resuelve (heredado de F-01) | "Partido no encontrado" |
| 502 `fiba_no_disponible` | snapshot no disponible (heredado de F-01) | "No se pudo obtener el partido en vivo" |
| 401 | sin sesión | manejador existente de `api.js` |

Offline: mismo criterio que F-01 (`/api/*` siempre a red; sin conexión, se reutiliza el mismo banner de "Sin conexión" que
En vivo, sin duplicar el copy).

Sin archivos estáticos nuevos fuera de los que F-01 ya agregó a `STATIC[]`, salvo que el bloque Momentum se extraiga a un
componente separado (`components/momentum-panel.js`) — en ese caso se agrega a `STATIC[]` con el bump de `CACHE`
correspondiente.

## 10. Riesgos y decisiones

- **Reglas de racha de asistencia con canastas no asistidas** (spec §9, NEEDS CLARIFICATION): la implementación por
  defecto corta la racha ante cualquier canasta consecutiva del equipo sin asistencia registrada, siguiendo la lectura
  más estricta del enunciado del cliente ("4 asistencias consecutivas… con ese jugador como asistente" implica que las 4
  canastas deben estar asistidas por él, no solo que el equipo anote 4 veces). Si el humano confirma la lectura
  alternativa (saltar canastas no asistidas sin cortar), es un cambio acotado a `_hot_players.assist_streak`.
- **`momentum.py` como nombre de módulo**: PROPUESTA de nombre de archivo únicamente (spec §9); el endpoint y el dueño ya
  están fijados por la arquitectura, así que este plan no introduce ningún contrato nuevo fuera de lo ya vinculante.
- **Reuso estricto de la fuente de F-01**: `momentum.py` nunca llama `fiba_fetcher` directamente ni mantiene su propia
  caché — toda la resiliencia ante fallos de FIBA (snapshot `stale`, timeout) ya la resolvió F-01 y F-02 hereda ese
  comportamiento sin reimplementarlo.
- **Sin desviaciones respecto a la arquitectura.**
- **Dependencias técnicas**: `live.live_snapshot` (`../03-F-01-partido-en-vivo/plan.md`), `possessions.
  game_possessions`/`Possession`/`Chance` (`../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md`), `config.get`
  y las 9 claves `momentum.*` ya catalogadas (`../../fase-1-confiabilidad/12-F-13-configuracion/plan.md`),
  `stats_engine.compute_standard` (T-05).
- **Sin incrementos diferidos**: todo lo pedido por el cliente para F-02 es implementable con lo que ya entregan sus
  dependencias declaradas (F-01, F-13, A-01), sin piezas de fases posteriores.
