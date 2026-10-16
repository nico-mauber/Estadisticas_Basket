# Tasks — T-03: Selector global de contexto (splits)

> **ID:** T-03 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 02
> **Depende de:** X-01 · F-11 · T-01 · T-02 (y C-02, C-08) · **Habilita:** T-04, F-19, F-04, F-18, A-06, dimensiones de A-02…A-05
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Agregar la fila `context.close_margin` (int, default 10, rango 1–40, sección "Reglas de contexto") a `CONFIG_SPEC` · `backend/config.py` · cubre RF-7 · Done: `config.get("context.close_margin") == 10` en una consola Python contra la app

### Grupo B — Backend: contexto y lógica
- [ ] T-B1 · Extender `Context` con los 11 campos nuevos (default `None`) sin romper el uso actual de C-02 (`competition_id`, `competition_all`, `last`) · `backend/context.py` · cubre RF-2, RF-14 · Done: `Context(competition_id=1, competition_all=False, last=5)` sigue construyéndose sin los campos nuevos
- [ ] T-B2 · Reescribir `parse_context` para validar y parsear `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, `clock`, `clock_start`, `origin`, `ptype`, `chance`, con `ContextError` (400 `contexto_invalido`) en cada valor inválido · `backend/context.py` · cubre RF-2, RF-9, RF-17 · Done: `parse_context({"venue": "casa"})` levanta `ContextError` con mensaje "Valor inválido para 'venue': 'casa'."
- [ ] T-B3 · Crear `backend/rest.py` con `days_rest(team_code, game_date)` sobre todos los partidos importados del equipo (cualquier competencia), cacheado por `data_version` · `backend/rest.py` · cubre RF-6 · Done: para dos partidos consecutivos del seed, `days_rest` del segundo da `0`
- [ ] T-B4 · `filter_games(games, ctx, team_code)`: aplica `venue`, `opponent`, `rest` (vía `rest.days_rest`) y `last` (después de los anteriores, por fecha desc) · `backend/context.py` · cubre RF-5, RF-6 · Done: con `last=5&venue=visitante` sobre un equipo del seed, la lista resultante tiene ≤5 partidos y todos son de visitante
- [ ] T-B5 · `_event_states(game_id, team_code)`: recorre `pbp_events` del partido y calcula por evento `margin_before` (marcador corrido antes del evento), `period_bucket` (`"pr"` si `period_type=="OVERTIME"`, si no `str(period)`) y `on_court` (vía `lineups.build_segments`) · `backend/context.py` · cubre RF-7, RF-8, RF-9 · Done: para uno de los 2 partidos con prórroga del seed, los eventos de `period_type=="OVERTIME"` tienen `period_bucket == "pr"`
- [ ] T-B6 · `event_predicate(ctx, team_code)`: combina cuarto (OR dentro del CSV), marcador y on/off con AND; devuelve `None` si no hay filtros de evento activos · `backend/context.py` · cubre RF-3, RF-7, RF-8, RF-9 · Done: con `quarter=4` sobre un partido, solo los eventos del último cuarto (o de las prórrogas si `pr` también está) pasan el predicado
- [ ] T-B7 · `possession_predicate(ctx)` como stub que siempre devuelve `None` · `backend/context.py` · cubre RF-14 · Done: `possession_predicate(Context(..., clock=("temprano",)))` devuelve `None`
- [ ] T-B8 · `level(ctx)` y `population_mode(ctx)` · `backend/context.py` · cubre RF-4, RF-9 · Done: `level(Context(..., quarters=("4",)))  == "evento"`; `population_mode(Context(..., on=(128,))) == "entity_only"`
- [ ] T-B9 · `context_echo(ctx, *, games_used, games_total, games_excluded, ignored)`: arma el shape §7.5 completo, incluida `label` legible · `backend/context.py` · cubre RF-13 · Done: con `last=5&venue=visitante&quarter=4&score=ajustado`, `label == "Últimos 5 · Visitante · 4.º cuarto · Ajustado"`
- [ ] T-B10 · `register_dimension`/`available_dimensions(comp_id)`: registro con las 12 dimensiones fijas (7 disponibles, 5 de posesión `available: false`) · `backend/context.py` · cubre RF-15 · Done: `available_dimensions(comp_id)` devuelve 12 entradas, 5 con `"available": false`
- [ ] T-B11 · `GET /api/context/options` (ruta fina) · `backend/app.py` · cubre RF-15 · Done: `curl "http://localhost:5000/api/context/options?competition=<id>"` devuelve `competitions`, `teams`, `players`, `dimensions`
- [ ] T-B12 · Migrar handlers "Ctx" existentes (`/api/team`, `/api/player`, `/api/league`, `/api/shots`, `/api/shot-zones`, `/api/rankings/<entity>/<metric>`, `/api/metrics/<entity_type>`) a `parse_context` completo y bifurcación por `level(ctx)` (box vs `_event_states`) · `backend/app.py`, módulos consumidores (T-01 `population.py`, T-05 `stats_engine.py`/`metrics_catalog.py`, C-03 `shot_zones.py`) · cubre RF-4, RF-16 · Done: `GET /api/team/<code>?quarter=1,2,3,4,pr` responde 200 con `context.applied.quarter` presente
- [ ] T-B13 · Handlers que **no** aceptan nivel evento en fase 2 (`/api/lineup`, `/api/onoff`, `/api/clutch`, `/api/league` tabla general) devuelven la respuesta habitual e informan cualquier parámetro de evento en `context.ignored` con razón `no_aplica`, sin error 400 · `backend/app.py` · cubre RF-16 · Done: `GET /api/clutch/<code>?quarter=4` responde 200 igual que sin `quarter`, con `context.ignored` conteniendo `{"param":"quarter","reason":"no_aplica"}`
- [ ] T-B14 · Registrar tipo de entidad `split` en `metrics_catalog.register_entity` con un loader que arma un `StatBundle` desde la selección de contexto (partido o evento) · `backend/metrics_catalog.py` (T-05, extendido por T-03) · cubre RF-1 · Done: `GET /api/metrics/split?id=team:<code>&quarter=4` responde con el conjunto estándar completo (T-05) y `sample.unit == "posesiones"`
- [ ] T-B15 · `population()`/`ficha()` (T-01) reciben el `Context` completo en cada llamada de T-03 y devuelven `population.context_label` acorde · `backend/population.py` (T-01, verificado por T-03) · cubre RF-10 · Done: `GET /api/rankings/team/oer?last=5` trae `population.context_label == "Últimos 5 partidos"`
- [ ] T-B16 · `sample_level(entity_type="split", ...)` con umbral y K de `sample.split.*`/`regression.split.k` · `backend/sample.py` (T-02, verificado) · cubre RF-11 · Done: el badge de una selección con filtro trae `min: 15, high: 40` (defaults) y, para OER/DER/Net, `adj.k == 20`
- [ ] T-B17 · Resolución de competencia con `ui.last_competition` (scope `ui`, F-13) cuando la URL no la indica y la entidad no tiene una más reciente · `backend/context.py`, `backend/prefs.py` (consumido) · cubre RF-20 · Done: tras `PUT /api/prefs {"scope":"ui","key":"last_competition","value":<id>}`, una petición sin `competition` explícito resuelve a ese id

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.contextOptions(params)` · `frontend/js/api.js` · cubre RF-15 · Done: `api.contextOptions({competition: 3})` hace `GET /api/context/options?competition=3`
- [ ] T-C2 · Todos los métodos existentes que llaman endpoints "Ctx" arman la query desde `contextToQuery(ctx)` en vez de `{competition, last}` sueltos · `frontend/js/api.js` · cubre RF-12 · Done: `grep -n "contextToQuery" frontend/js/api.js` aparece en `api.team`, `api.player`, `api.league`, `api.shots`, `api.rankings`, `api.metrics`

### Grupo D — Frontend: UI
- [ ] T-D1 · Crear `core/context.js` con `getContext`, `setContext`, `clearContext`, `contextToQuery`, `contextFromQuery`, `onContextChange` (estado en `location.hash` query) · `frontend/js/core/context.js` · cubre RF-1, RF-12 · Done: `setContext({venue: "local"})` seguido de `getContext().venue === "local"` y el hash cambia
- [ ] T-D2 · Crear `components/context-bar.js` con los controles de las 7 dimensiones disponibles + botón "Limpiar filtros" + contador · `frontend/js/components/context-bar.js` · cubre RF-2, RF-19 · Done: tocar "Sede: Visitante" dispara `onChange` con el contexto actualizado
- [ ] T-D3 [P] · Montar la barra en `views/equipo.js`, `views/jugador.js` (X-01) · `frontend/js/views/equipo.js`, `frontend/js/views/jugador.js` · cubre RF-1 · Done: cambiar un filtro en S3 recalcula el bloque estándar sin recargar la página
- [ ] T-D4 [P] · Montar la barra en `views/liga.js`, `views/comparar.js`, `views/explorar.js` (X-01) · mismos archivos · cubre RF-1 · Done: idem en S2/S6/S7
- [ ] T-D5 · CSS de la barra: fila desktop con scroll horizontal si no entra; panel plegable móvil sin scroll horizontal de página · `frontend/css/style.css` · cubre RF-19, CA-16 · Done: en 360 px la barra ocupa una línea "Filtros (n)"
- [ ] T-D6 · Copy nuevo con `t('context.*', '…')` · `context-bar.js` · cubre §Constitución (DA-21) · Done: `grep -n "Todos los filtros" frontend/js` solo dentro de `t(`

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Selección sin partidos: cada bloque muestra "No hay partidos que cumplan estos filtros." + botón "Limpiar filtros" · vistas que montan la barra · cubre RF-18 · Done: con `opponent`+`venue` sin coincidencias, el bloque estándar de S3 muestra el mensaje
- [ ] T-E2 · Nota "Se excluyeron N partidos sin jugada a jugada / sin descanso calculable" bajo la barra cuando `games_excluded` trae `sin_pbp`/`sin_partido_previo`/`sin_fecha` · vistas · cubre RF-13 · Done: con `quarter=4` sobre un equipo con algún partido sin pbp en el seed, aparece el aviso
- [ ] T-E3 · Toast de error con el mensaje de `contexto_invalido` y limpieza automática del/de los parámetro(s) inválido(s) de la URL · vistas / `core/context.js` · cubre RF-17 · Done: abrir `#/equipo/<code>/resumen?venue=casa` muestra el toast y la URL queda sin `venue`
- [ ] T-E4 · `sw.js`: agregar `context.js`/`context-bar.js` si X-01 no cubre con runtime caching todavía · `frontend/sw.js` · cubre §9 · Done: los dos archivos aparecen servidos offline en DevTools

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · Sin cambios de esquema: N/A (se registra en progress)
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl: `/api/context/options`, `/api/team/<code>?quarter=…`, `/api/rankings/team/oer?last=5`, `/api/metrics/split?id=team:<code>&quarter=4`, `/api/clutch/<code>?quarter=4` (verifica `ignored`)
- [ ] T-F4 · Consola del navegador sin errores JS al abrir S2/S3/S4/S6/S7 y cambiar cada dimensión de la barra
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress
- [ ] T-F6 · CA-1 (CA del cliente): en S3 › Resumen de un equipo del dataset, cambiar Sede a "Visitante"; verificar en Network que todos los bloques piden con `venue=visitante`; recargar y comprobar que la vista es idéntica
- [ ] T-F7 · CA-2: abrir `#/equipo/<code>/resumen?last=5&venue=visitante&quarter=4&score=ajustado` directamente; comprobar barra y `context.applied` con `app.test_client()` o Network
- [ ] T-F8 · CA-3: `curl` a `GET /api/metrics/team?id=<code>&quarter=1,2,3,4,pr` y comparar `pts` contra la suma del box de los partidos con pbp; revisar `context.games_excluded.sin_pbp`
- [ ] T-F9 · CA-4: para los 2 partidos con prórroga del seed, `quarter=pr` sobre su equipo; comparar puntos con los parciales de prórroga y minutos = 5×N prórrogas
- [ ] T-F10 · CA-5: `score=ajustado` + `score=paliza` sobre un equipo; verificar `pts(ajustado)+pts(paliza) == pts(sin filtro)` sobre los mismos partidos con pbp
- [ ] T-F11 · CA-6: `on=<id titular>` y `off=<id titular>`; verificar suma de `pts`/posesiones y `contexto_no_comparable` en percentiles
- [ ] T-F12 · CA-7: `GET /api/rankings/team/oer?last=5`; comparar puesto y líder contra la ficha de OER del mismo equipo en S3 con `last=5`
- [ ] T-F13 · CA-8: `opponent=<rival>` en un ranking; verificar que el rival no está en `rows`/`outside_population`
- [ ] T-F14 · CA-9: `rest=0` sobre un equipo con partidos consecutivos (o con fecha editada en la base de verificación); verificar que el primer partido del equipo aparece en `games_excluded`
- [ ] T-F15 · CA-10: `quarter=4`; verificar `sample.min==15`, `sample.high==40`, `adj.k==20` en OER/DER/Net; cambiar `sample.split.min` a 30 en S9 y repetir
- [ ] T-F16 · CA-11: `clock=temprano&origin=robo` en `/api/metrics/team`; verificar 200, métricas iguales a sin el filtro, `context.ignored` con `requiere_posesiones`, y que la barra no ofrece esas dimensiones (`available:false` en `/api/context/options`)
- [ ] T-F17 · CA-12: `venue=casa` → 400 `contexto_invalido`; `on=<jugador de otro equipo>` → 400 con el mensaje del jugador
- [ ] T-F18 · CA-13: `GET /api/lineup/<code>?players=…&quarter=4`; verificar respuesta igual a sin `quarter` y `context.ignored` con `no_aplica`
- [ ] T-F19 · CA-14: `opponent`+`venue` sin partidos; verificar mensaje en UI y métricas `null` con `sin_datos` (ningún 0) en la respuesta cruda
- [ ] T-F20 · CA-15: aplicar filtros en S3, navegar a S2, verificar que se conservan (salvo `on`/`off`); tocar "Limpiar filtros" y verificar URL sin parámetros de contexto
- [ ] T-F21 · CA-16: DevTools en 360 px con 3 filtros activos; verificar "Filtros (3)" sin scroll horizontal de página
- [ ] T-F22 · CA-17: fijar competencia B vía `ui.last_competition`, abrir la app sin `competition` en la URL sobre una entidad sin partidos más recientes en otra competencia; verificar que arranca en B

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 (diferido → A-02, A-03, A-04, A-05) · Reemplazar el stub de `possession_predicate` por el cálculo real sobre `possessions.py` y activar `clock`/`clock_start`/`origin`/`ptype`/`chance` en `available_dimensions` vía `register_dimension`
- [ ] T-G2 (diferido → F-06) · Habilitar nivel evento en `/api/lineup`, `/api/onoff`
- [ ] T-G3 (diferido → F-04) · Decidir si Cierres acepta filtros de evento adicionales al propio tramo de cierre

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B12, T-D1, T-D2, T-D3, T-F6 |
| CA-2 | T-B9, T-D1, T-F7 |
| CA-3 | T-B5, T-B6, T-B12, T-F8 |
| CA-4 | T-B5, T-F9 |
| CA-5 | T-B6, T-F10 |
| CA-6 | T-B6, T-B8, T-F11 |
| CA-7 | T-B15, T-F12 |
| CA-8 | T-B4, T-F13 |
| CA-9 | T-B3, T-B4, T-F14 |
| CA-10 | T-B16, T-F15 |
| CA-11 | T-B2, T-B7, T-B10, T-F16 |
| CA-12 | T-B2, T-F17 |
| CA-13 | T-B13, T-F18 |
| CA-14 | T-E1, T-F19 |
| CA-15 | T-D1, T-D2, T-F20 |
| CA-16 | T-D5, T-F21 |
| CA-17 | T-B17, T-F22 |

## Dependencias externas
- Fase 1 cerrada e integrada: F-11 (`repository`, `cache`, `competitions`), T-01 (`population.py` con contexto), T-02
  (`sample.py` con `entity_type="split"`), T-05 (`metrics_catalog.py`, `GET /api/metrics/<entity_type>`), C-08
  (`player_id`), F-13 (`app_config`, `user_prefs`, `admin_required`).
- X-01 integrado (rutas hash, `core/router.js`, vistas por sección).
- Dataset de verificación: 13 partidos del seed (2 con prórroga) reprocesados con ingesta v2; al menos un equipo con
  partidos consecutivos (o fecha editada en la base de verificación) para CA-9.
- Variable `SEED_ENABLED=1` + login para poblar la base local antes de correr T-F3…T-F22.
