# Plan — F-01: Partido en vivo

> **ID:** F-01 · **Prioridad:** P1 · **Fase y orden:** Fase 4 — Día de partido · 03
> **Depende de:** F-07 ([../01-F-07-analizar-partido/plan.md](../01-F-07-analizar-partido/plan.md)) · A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §4 · F-01 · Arquitectura §3.9, §3.14, §3.17, §4, §6, §9
> **Estimación:** XL · 20–32 h

## 1. Enfoque

`live.py` (NUEVO) es la única pieza propia de datos: descarga el JSON de FIBA con `fiba_fetcher.fetch_raw`/`parse_game`
(funciones puras que F-11 deja listas), lo cachea en memoria por `game_id` con TTL corto (namespace `live:<game_id>`,
§3.14), y calcula el snapshot reutilizando exactamente los mismos módulos que F-07 usa para partidos cerrados
(`stats_engine.compute_standard`, `lineups.build_segments`/`build_segments_both`, A-01 `game_possessions` sobre el JSON en
memoria). No hay tabla nueva, no hay hilo de fondo, no hay WebSocket: el cliente hace polling y el servidor cachea. Al
detectar el evento de fin (`live.is_final`), delega la persistencia en `ingest.persist_game` (F-11), que ya es idempotente.
`chains.py` (NUEVO, dueño F-01 por adelanto §9.2 I-11) nace aquí con 4 funciones mínimas que A-07 (fase 5) extiende — F-01
las usa solo para el bloque de jugadores del partido en curso, sin pretender el análisis histórico completo. El frontend no
crea una vista nueva: agrega el modo `vivo` al router de S5 que ya registró F-07, y reutiliza `components/game-view.js` con
un adaptador de polling.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/live.py` | module (NUEVO) | `live_snapshot(game_id)`, `is_final(raw)`, caché TTL, detección de fin + persistencia automática | RF-2..RF-6, RF-18 |
| `backend/chains.py` | module (NUEVO) | `assist_points`, `oreb_points`, `steal_points`, `turnover_cost` (primitivas mínimas) | RF-15, RF-19 |
| `backend/app.py` | route | `GET /api/live/<game_id>` (ruta fina, delega en `live.py`) | RF-1, RF-2 |
| `backend/fiba_fetcher.py` (mod., de F-11) | module | ya expone `fetch_raw(url) -> tuple[dict, dict]` y `parse_game(raw, source_url, page_info) -> dict` (funciones puras, sin red aparte de `fetch_raw`) — F-01 no las modifica, solo las consume | RF-3 |
| `backend/config.py` (mod., de F-13) | config | ya cataloga `live.poll_secs`/`live.cache_ttl_secs`/`live.fetch_timeout_secs` (Arquitectura §3.2); si F-13 aún no está integrado al implementar F-01, `live.py` usa los defaults embebidos (30/15/8) sin bloquear la feature | RF-2, RF-3, RF-4 |
| `frontend/js/api.js` | api | `api.live(id)` | RF-1 |
| `frontend/js/views/partido.js` (de X-01/F-07) | js-view | modo `vivo`: adaptador de polling sobre `game-view.js` | RF-1, RF-2 |
| `frontend/js/components/game-view.js` (de F-07) | component (extiende) | soporta `mode: "vivo"` con refresco periódico — si F-07 ya dejó el hook de polling genérico, F-01 solo lo conecta; si no, F-01 lo agrega aquí (verificar `../01-F-07-analizar-partido/plan.md` §6 antes de implementar) | RF-1, RF-27 (F-07) |
| `frontend/css/style.css` | css | sección `/* ── live (F-01) ── */`: indicador "EN VIVO" pulsante, banner de datos desactualizados | RF-18 |
| `frontend/sw.js` | cache | `/api/live/*` cae bajo `/api/*` (siempre a red); sin cambio de `STATIC[]` si no hay archivo nuevo fuera de los ya listados | — |
| `docs/api.md`, `docs/architecture.md`, `docs/frontend.md`, `docs/deployment.md` | doc | endpoint `GET /api/live/<game_id>`, módulos `live.py`/`chains.py`, vista modo Vivo, nota de DA-28 (gunicorn con hilos) | — (cierre) |

**Matriz RF → archivo:**

| RF | Archivo(s) |
|---|---|
| RF-1 | `app.py`, `views/partido.js`, `components/game-view.js` |
| RF-2, RF-3, RF-4 | `live.py`, `config.py` |
| RF-5 | `views/partido.js` (delega en `api.game(id)` de F-07 cuando `status == "finalizado"`) |
| RF-6 | `live.py` (`is_final`), `ingest.py` (F-11, sin cambios, solo se invoca) |
| RF-7, RF-8, RF-9 | `live.py` (usa `stats_engine.compute_standard`) |
| RF-10 | `live.py` (promedio pooled vía `repository.competition_games` + `stats_engine`) |
| RF-11, RF-12, RF-13 | `live.py` (`_points_distribution`) |
| RF-14, RF-15 | `live.py`, `chains.py` |
| RF-16 | `live.py` (usa `lineups.build_segments`/`build_segments_both`) |
| RF-17, RF-18 | `live.py` (razones C-11), `components/game-view.js` (banner `stale`) |
| RF-19 | `chains.py` |
| RF-20 | heredado de `fiba_fetcher.parse_game` + `ingest.persist_game` (F-11), sin cambio en F-01 |

## 3. Backend — rutas y modelos

Sin cambios de esquema (confirmado por Arquitectura §5).

**`GET /api/live/<game_id>`** (login_required)
- Sin query adicional (el `game_id` alcanza; F-01 no acepta contexto T-03 — un partido puntual no tiene splits).
- 404 `{"error": "Partido no encontrado", "code": "no_encontrado"}` si `game_id` no resuelve ni por URL de FIBA conocida
  (ver ambigüedad §9 del spec) ni por partido ya persistido.
- 502 `{"error": "No se pudo obtener el partido en vivo", "code": "fiba_no_disponible"}` solo si la descarga falla **y**
  no hay ningún snapshot cacheado previo para servir como `stale` (primera consulta de un partido con FIBA caído).
- 200 → shape de §8 (`{status, stale, fetched_at, teams, players_on_court, distribution, vs_season}`). Si el partido ya
  está persistido (`status == "finalizado"`), el frontend redirige a consumir `GET /api/game/<game_id>` (F-07) para el
  contenido completo, y esta ruta sigue disponible solo para el resumen rápido de cabecera ("Partido finalizado, ver
  Analizar").

## 4. Backend — lógica

### `backend/live.py` (NUEVO)

```
live_snapshot(game_id: str) -> dict
    # 1. cache.memo("live", (game_id,), fn, max_entries=32) con TTL propio (no el TTL de data_version/config_version:
    #    live usa su propio reloj de pared, ver nota de caché abajo)
    # 2. si hay snapshot cacheado y no expiró -> devolverlo tal cual
    # 3. si expiró: url = resolver_url(game_id) (misma URL de importación si ya se conoce, o la última usada)
    #    intenta fetch_raw(url) con timeout config.get("live.fetch_timeout_secs")
    #    si falla:
    #        si hay snapshot previo (aunque expirado) -> devolverlo con stale=True, fetched_at del snapshot viejo
    #        si no hay snapshot previo -> lanza LiveFetchError (la ruta la traduce a 502)
    #    si tiene éxito: raw, page_info = resultado; parsed = parse_game(raw, url, page_info)
    #        if is_final(raw): ingest.persist_game(parsed, source_url=url); status = "finalizado"
    #        else: status = "en_curso"
    #        snapshot = _build_snapshot(parsed, status)
    #        cachear snapshot con fetched_at = ahora, stale = False
    #    devolver snapshot

is_final(raw: dict) -> bool
    # evento tipo "game" con subtipo "end" y qualifier "confirmed" en pbp[] (Arquitectura §1.6: action_type "game" existe,
    # subtipo "end"/confirmed verificado en los 13 partidos del seed — todos finalizados)

_build_snapshot(parsed: dict, status: str) -> dict
    # arma StatBundle de cada equipo desde parsed["teams"] (conteos ya parseados, mismo shape que fiba_fetcher entrega
    # siempre) -> stats_engine.compute_standard -> RF-7, RF-8, RF-9
    # _vs_season(team_code, comp_id) -> promedio pooled de team_game_stats ya persistidos en la competencia activa
    #   (repository.competition_games, excluye el game_id en curso si ya estuviera persistido por error) -> RF-10
    # _points_distribution(team_stats) -> paint_pts/second_chance_pts/pts_from_tov/fast_break_pts + resto derivado de
    #   ppt_2/ppt_3/ppt_ft; categoría "otros_no_clasificado" = pts - suma de las categorías conocidas -> RF-11..RF-13
    # players_on_court: lineups.build_segments_both(parsed["pbp"], (home_code, away_code), starters) -> último tramo
    #   -> {team_code: frozenset(player_ids en cancha)} -> RF-16
    # players: por cada jugador con minutos > 0, compute_standard del jugador + chains.assist_points/oreb_points/
    #   steal_points/turnover_cost filtrados a ese jugador -> RF-14, RF-15

_points_distribution / _vs_season: funciones privadas de live.py, no expuestas fuera del módulo (F-02 las reutiliza
    llamando a live_snapshot(), no reimplementa el cálculo)
```

### `backend/chains.py` (NUEVO)

```
assist_points(possessions: list[Possession]) -> dict[int, dict]
    # por assister_id: {"points": suma de pts de posesiones donde assister_id no es None,
    #                    "count": cantidad de asistencias}
oreb_points(possessions: list[Possession]) -> dict[int, dict]
    # por jugador que capturó un rebote ofensivo (Chance.n >= 2): puntos de la cadena que sigue a ese rebote,
    #   atribuidos al capturador (requiere el player_id del rebote, disponible en pbp_events)
steal_points(possessions: list[Possession]) -> dict[int, dict]
    # por jugador con robo (origin == "robo" de A-02 si ya está disponible en el partido en memoria; en F-01, sin A-02
    #   activo sobre datos en vivo, se aproxima con el evento pbp "steal" directo -> puntos de la posesión que sigue)
turnover_cost(possessions: list[Possession]) -> dict[int, dict]
    # por jugador con pérdida (turnover_by_id): puntos que anotó el rival en la posesión inmediatamente siguiente
    #   (si esa posesión no está incompleta)
```

**Manejo de nulos (C-11).** Todo valor sin base de cálculo (jugador sin posesiones asociadas a un tipo de evento, partido
sin pbp aún publicado) devuelve `{"value": null, "reason": "sin_pbp"}` o similar; `chains.py` nunca completa con 0 un
jugador que no tuvo el evento — simplemente no aparece en el dict de retorno, y `live.py` interpreta la ausencia como 0
real (evento que no ocurrió) vs. dato faltante (sin pbp en absoluto) con una bandera separada a nivel de partido.

**Caché.** El TTL de `live.py` es un reloj de pared (`time.time()` + `live.cache_ttl_secs`), **no** el versionado de
`data_version`/`config_version` de `cache.py` (§3.14) — un partido en curso cambia sin que nadie suba esas versiones. Se
implementa como un dict propio `{game_id: (fetched_at, snapshot)}` en memoria de proceso, acotado (LRU simple, máximo 32
partidos simultáneos — más que suficiente para una sola competencia en curso). Al persistir el partido finalizado, `live.py`
invalida su entrada de caché para ese `game_id` (la próxima consulta cae en `status == "finalizado"` y redirige a F-07).

**Casos borde.**
- FIBA caído en la primera consulta de un partido (nunca se cacheó nada): 502 (RF-4 exige snapshot previo para servir
  `stale`; sin snapshot previo no hay qué servir).
- Partido que nunca llega a evento de fin (URL vieja, corte de transmisión): el snapshot queda `stale` indefinidamente
  hasta que alguien lo reimporte manualmente (fuera de alcance de F-01, es un caso de Calidad de datos F-11).
- División por cero en `_points_distribution` (equipo con 0 puntos): `stats_engine._safe_div` ya lo cubre.

## 5. Frontend — capa API (api.js)

```js
api.live: (id) => apiFetch(`/api/live/${id}`)
```

## 6. Frontend — UI

Vista: S5 · Partido, modo `vivo`. Ruta `#/partido/<game_id>/vivo`, registrada por F-07/X-01; F-01 la habilita
(`enabled: true`). Adaptador de polling en `views/partido.js`: `setInterval` (o `setTimeout` recursivo, preferible para no
solapar si una respuesta tarda) cada `live.poll_secs` (leído de `GET /api/settings` si F-13 está disponible, si no, 30 s
fijo) que llama `api.live(id)` y vuelve a pasar el payload a `game-view.js` con `mode: "vivo"`. Se detiene el polling
cuando `status === "finalizado"` (redirige el banner a Analizar) o cuando el usuario navega fuera de la vista
(`clearTimeout` en el cleanup del router).

**Componentes compartidos reutilizados** (§8 de la arquitectura): `components/game-view.js` (F-07, estructura completa de
bloques), `components/standard-panel.js` (conjunto estándar de equipo/jugador), `components/sample-badge.js` (si algún
bloque de F-01 expone muestra — el partido en curso normalmente no la necesita, pero `vs_season` sí puede traer badge del
promedio de temporada), `core/format.js` (`nullDisplay`, `fmtNumber`), `core/colors.js` (color de Δ vs promedio, no
percentil — un partido no tiene población).

**Estados** (loading/vacío/error/offline/éxito): copiados literalmente de `spec.md` §6. El indicador "EN VIVO" pulsante se
muestra solo cuando `status === "en_curso"` y `stale === false`; cambia a un ícono estático de "desactualizado" cuando
`stale === true`.

**Mobile (<768 px):** igual criterio que F-07 (pestañas internas horizontales con scroll).

## 7. Navegación

Agrega el modo `vivo` a la pestaña S5 · Partido (ya registrada por F-07 con `analizar`); F-01 la habilita con `enabled:
true` al integrarse. Ruta: `#/partido/<game_id>/vivo`.

## 8. Contratos de datos

### `GET /api/live/<game_id>` — response 200 (partido en curso)
```json
{
  "status": "en_curso",
  "stale": false,
  "fetched_at": "2026-09-28T21:14:32-03:00",
  "teams": {
    "home": {"code": "CNF", "name": "Nacional",
      "standard": {"oer": {"value": 1.08, "reason": null}, "der": {"value": 0.97, "reason": null},
                   "net_rating": {"value": 0.11, "reason": null}, "efg_pct": {"value": 54.1, "reason": null},
                   "ts_pct": {"value": 56.8, "reason": null}, "ppp": {"value": 1.08, "reason": null},
                   "possessions": {"value": 42.0, "reason": null}, "to_pct": {"value": 12.1, "reason": null},
                   "or_pct": {"value": 28.4, "reason": null}, "ft_rate": {"value": 0.21, "reason": null},
                   "ppt": {"value": 1.31, "reason": null}},
      "vs_season": {"oer": {"delta": 0.04, "own_avg": 1.04}, "net_rating": {"delta": -0.02, "own_avg": 0.13}}},
    "away": { "...": "mismo shape" }
  },
  "distribution": {
    "home": {"paint_pts": {"value": 14, "reason": null}, "mid_pts": {"value": 6, "reason": null},
             "three_pts": {"value": 9, "reason": null}, "ft_pts": {"value": 5, "reason": null},
             "second_chance_pts": {"value": 4, "reason": null}, "fast_break_pts": {"value": 8, "reason": null},
             "pts_from_tov": {"value": 6, "reason": null}, "otros_no_clasificado": {"value": 2, "reason": null}},
    "away": { "...": "mismo shape" }
  },
  "players_on_court": {"home": [812, 815, 820, 833, 841], "away": [901, 905, 910, 920, 933]},
  "players": {
    "home": [
      {"player_id": 812, "name": "J. Pérez", "on_court": true,
       "standard": {"oer": {"value": 1.15, "reason": null}, "ts_pct": {"value": 61.2, "reason": null},
                    "efg_pct": {"value": 58.0, "reason": null}, "uso_pct": {"value": 24.1, "reason": null},
                    "plus_minus": {"value": 6, "reason": null}},
       "chains": {"points_created": {"value": 11, "reason": null}, "points_from_assist": {"value": 4, "reason": null},
                  "oreb_points": {"value": 2, "reason": null}, "steal_points": {"value": 0, "reason": null},
                  "turnover_cost": {"value": 3, "reason": null}}}
    ],
    "away": ["..."]
  }
}
```

### `GET /api/live/<game_id>` — response 200 (partido finalizado, resumen)
```json
{"status": "finalizado", "stale": false, "fetched_at": "2026-09-28T23:02:10-03:00",
 "game_id": "abc123", "redirect": "#/partido/abc123/analizar"}
```

Filas SQLAlchemy: ninguna nueva ni tocada (F-01 no toca esquema; al persistir usa las tablas ya existentes vía
`ingest.persist_game` de F-11).

## 9. Manejo de errores y offline

| Código | Situación | Mensaje |
|---|---|---|
| 404 `no_encontrado` | `game_id` no resuelve a ninguna URL de FIBA conocida ni a un partido persistido | "Partido no encontrado" |
| 502 `fiba_no_disponible` | descarga falló y no hay snapshot previo | "No se pudo obtener el partido en vivo" |
| 401 | sin sesión | manejador existente de `api.js` |

Offline: la vista completa requiere `/api/*` (siempre a red); sin conexión, el polling falla silenciosamente y el
frontend muestra el banner de "Sin conexión" (spec §6), reintentando en el siguiente ciclo de `live.poll_secs` sin mostrar
un error por cada intento fallido individual (evita spam de toasts).

Sin archivos estáticos nuevos fuera de los ya cubiertos (`views/partido.js`, `game-view.js` ya están en `STATIC[]` desde
F-07); si el plan de F-07 no incluyó `game-view.js` como archivo separado (podría estar dentro de otro bundle de módulos
ES), F-01 no necesita tocar `sw.js`.

## 10. Riesgos y decisiones

- **Gunicorn síncrono con 1 worker**: una llamada de polling que dispara `fetch_raw` (bloqueante, hasta
  `live.fetch_timeout_secs`) puede bloquear el único worker mientras se resuelve. Mitigación ya prevista por la
  arquitectura: DA-28 (pasar a `--workers 1 --threads 4` gthread al cerrar F-01) — se documenta como cambio de despliegue
  en `docs/deployment.md`, no como código de este plan (Constitución 2: sin dependencias nuevas; el cambio es de
  configuración de `render.yaml`, no de paquete).
- **`chains.py` con alcance mínimo**: esta spec implementa solo lo que F-01 necesita para el bloque de jugadores del
  partido en curso (aproximaciones donde A-02/A-03 no están activas sobre datos en memoria de un partido sin cerrar). A-07
  (fase 5) puede necesitar ajustar las firmas si el análisis histórico completo revela un caso que estas 4 funciones no
  cubren — se reporta como ajuste al plan de A-07 si el humano lo aprueba al llegar a esa fase, sin bloquear F-01.
- **Sin desviaciones respecto a la arquitectura.**
- **Dependencias técnicas**: `game_analysis.py`/`components/game-view.js`
  (`../01-F-07-analizar-partido/plan.md`), `possessions.py`/`lineups.build_segments_both`
  (`../../fase-3-contexto-posesion/01-A-01-motor-posesiones/plan.md`), `ingest.persist_game`/`fiba_fetcher.fetch_raw`/
  `parse_game` (F-11, `../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md`), `stats_engine.
  compute_standard` (T-05, `../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md`).
- **Incremento diferido** (→ A-07, fase 5): desglose fino de producción desde eventos para el análisis histórico completo
  — `chains.py` de F-01 queda como base, A-07 lo extiende sin cambiar sus firmas públicas.
