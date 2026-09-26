# Spec — T-03: Selector global de contexto (splits)

> **ID:** T-03 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 02
> **Depende de:** [X-01](../01-X-01-reorganizacion-navegacion/spec.md), [F-11](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md), [T-01](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md), [T-02](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md) (y, por el módulo base, [C-02](../../fase-1-confiabilidad/11-C-02-promedios-de-liga/spec.md) y [C-08](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md)) · **Habilita:** T-04, F-19, F-04, F-18, A-06, dimensiones de A-02…A-05
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** [Especificación v2](../../00-especificacion-cliente-v2.md) §3 · T-03 (y §1.1 "Barra de contexto") · Arquitectura [§3.8, §3.1, §3.6, §3.7, §7.5, §9.2 I-02/I-08](../../00-arquitectura-transversal.md)

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §3 T-03):**
- "Barra de filtros persistente que afecta a toda la vista activa."
- "Dimensiones: competencia · período (todos / últimos 3 / 5 / 10) · local o visitante · rival · cuarto (1 a 4 y prórroga) ·
  situación de marcador (diferencia ≤ 10 o paliza) · con y sin jugador X · días de descanso."
- "Dimensiones de posesión, definidas en el bloque A: tramo de reloj (0-8 / 9-16 / 17-24) · origen de la posesión ·
  transición o media cancha · primera oportunidad o segunda oportunidad."
- "Los filtros se combinan entre sí." · "El estado del filtro viaja en la URL para poder compartir una vista concreta con el
  cuerpo técnico." · "Cada filtro aplicado recalcula también el badge de muestra de T-02."
- Criterio de aceptación: "Cambiar un filtro recalcula todos los bloques de la pantalla, y recargar la URL reproduce
  exactamente la misma vista."
- T-01 agrega: "Todo se recalcula sobre la selección activa de la barra de contexto (T-03): si el filtro es 'últimos 5
  partidos', el ranking y el líder son los de ese subconjunto, y debe indicarse."

**Qué existe hoy (verificado en código, `main`):**
- Filtros solo del lado del cliente sobre el `game_log`: `_filterByComp`, `_logComps`, `_compOptions` (`frontend/js/app.js`
  l.74–84, Feature 09) y pills "Todos · Últ. 5 · Últ. 3" (`_filteredLog`, l.673; solo en Equipo). Los promedios se
  recalculan en el navegador con `_computeAvg` (l.44), promedio de tasas por partido. Liga refetchea
  `GET /api/league?competition=<string>` (`backend/app.py:league_overview`, l.947).
- Ningún endpoint acepta sede, rival, cuarto, marcador, jugador en cancha ni descanso. `backend/app.py:_team_pbp_games`
  (l.835) arma, para lineups/on-off/cierres, `[{game_id, events, player_rows, opp_code, info:{date, home_away}}]` de todas
  las competencias.
- Piezas reutilizables: `backend/lineups.py:build_segments` (l.77) reconstruye quién está en cancha por tramo con
  segundos exactos; `backend/clutch.py:_entry_margin` (l.80) lee el marcador corrido desde `s1`/`s2` de cada evento pbp.
  Los eventos pbp traen `period`, `period_type` (`REGULAR`/`OVERTIME`, con `period` reiniciado en 1 en prórroga —
  Arquitectura D-09), `clock_secs`, `s1`, `s2`.
- Fase 1 (según arquitectura): C-02 crea `backend/context.py` con `competition` y `last` y el eco `context` en las
  respuestas; F-11 crea la tabla `competitions` y `repository.resolve_competition`; C-08 da `player_id`; T-05 registra los
  tipos de entidad y `GET /api/metrics/<entity_type>`; T-01 calcula la población con el mismo contexto; T-02 da el badge;
  T-06 da `GET /api/table/<table_id>`; X-01 (fase 2) lleva el estado a la URL `#/<sección>/<id>/<pestaña>?<query>`.

**Qué queda.** Completar el contrato de contexto (sede, rival, descanso, cuarto, marcador, con/sin jugador), el cálculo de
métricas a nivel evento sobre el play-by-play para los filtros que lo requieren, la recomputación de poblaciones, badges
y fichas con el contexto, el endpoint de opciones, la barra persistente en la UI y el estado en la URL. Las dimensiones de
posesión quedan previstas en el contrato pero se habilitan con A-02…A-05.

## 1. Objetivo
Ofrecer una barra de filtros persistente y combinable que recalcula sobre la selección activa todas las métricas,
rankings, fichas y badges de muestra de la vista, con el estado en la URL para compartirla.

## 2. Fuentes (trazabilidad)
- Especificación v2 §3 T-03 (completo), §3 T-01 "Reglas de cálculo" (recalcular sobre la selección e indicarlo), §3 T-02
  (split de contexto: 15 / 40 posesiones; K = 20 para splits), §1.1 "Barra de contexto", §6 Glosario (Posesión, OER, DER).
- `docs/api.md` §GET /api/league (parámetro `competition`), §GET /api/team, §GET /api/player, §GET /api/lineup,
  §GET /api/onoff, §GET /api/clutch; `docs/database.md` §pbp_events (`period`, `period_type`, `clock_secs`, `s1`, `s2`),
  §games (`date`, `home_code`, `away_code`); `docs/metrics.md` §Posesiones, §Eficiencia.
- `docs/frontend.md` §Filtro por competencia (Feature 09), §Vistas (pills Últ. N).
- `00-arquitectura-transversal.md` §2.1 (pooled, nulos), §3.1 (resolución de competencia, DA-14), §3.2 (clave
  `context.close_margin`, `sample.split.*`, `regression.split.k`), §3.3 (scope `ui.last_competition`), §3.5 (tipo de entidad
  `split`), §3.6 (población con contexto), §3.7 (badge), §3.8 (contrato completo), §7.5 (eco), §7.4 (razones), §7.8
  (errores), §8 (`core/context.js`, `components/context-bar.js`), §9.2 (I-02, I-07, I-08), §11 (DA-14, DA-29, DA-33).
- Specs previos: `sdd/specs/09-filtro-competencia/spec.md` (filtro de competencia en cliente), `sdd/specs/03-lineups`,
  `04-on-off`, `05-clutch` (motor de tramos y marcador corrido).

## 3. Historias de usuario
- US-1: Como entrenador, quiero filtrar toda la pantalla por período, sede, rival, cuarto, situación de marcador, días de
  descanso y presencia de un jugador, para ver cómo rinde el equipo o el jugador en ese contexto.
- US-2: Como entrenador, quiero combinar varios filtros a la vez (p. ej. "de visitante, en el 4.º cuarto, con partido
  ajustado"), para responder preguntas concretas de preparación.
- US-3: Como entrenador, quiero que el ranking, el líder, el promedio y el percentil de cada métrica se recalculen sobre el
  mismo contexto para todos los equipos, para comparar en igualdad de condiciones.
- US-4: Como entrenador, quiero ver sobre cuántas posesiones, minutos y partidos quedó calculado cada número al filtrar,
  para no leer como verdad una muestra chica.
- US-5: Como entrenador, quiero copiar la dirección con los filtros puestos y mandarla al cuerpo técnico, para que vean
  exactamente la misma vista.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE ofrecer una barra de contexto persistente, visible en toda sección con estadísticas (S2 Liga, S3
  Equipo, S4 Jugador, S6 Comparar, S7 Explorar), que aplica sus filtros a todos los bloques de la vista activa y se
  conserva al cambiar de pestaña y de sección. · (US-1) (Esp. v2 §T-03, §1.1)
- RF-2: La barra DEBE ofrecer las dimensiones: competencia; período (todos / últimos 3 / 5 / 10); sede (todos / local /
  visitante); rival (todos / un equipo de la competencia); cuarto (1, 2, 3, 4, prórroga; selección múltiple); situación de
  marcador (todos / ajustado / paliza); con jugador X y sin jugador X (jugadores del equipo analizado); días de descanso
  (todos / 0 / 1 / 2 / 3 o más). · (US-1) (Esp. v2 §T-03)
- RF-3: Los filtros DEBEN combinarse entre sí con "y" lógico (un partido o evento entra si cumple todos los filtros
  activos); dentro de cuarto, las opciones elegidas se combinan con "o". · (US-2) (Esp. v2 §T-03 "Los filtros se combinan
  entre sí")
- RF-4: El sistema DEBE clasificar cada filtro por nivel y calcular en consecuencia:
  - **Nivel partido** (competencia, período, sede, rival, descanso): selecciona partidos y agrega sus estadísticas de
    partido.
  - **Nivel evento** (cuarto, marcador, con/sin jugador): selecciona eventos del play-by-play y calcula todas las métricas
    agregando esos eventos; los partidos sin play-by-play quedan excluidos de la selección y se informan como excluidos
    con razón `sin_pbp`.
  - **Nivel posesión** (tramo de reloj, origen, tipo de ataque, oportunidad): ver RF-14.
  · (US-1, US-2) (Arquitectura §3.8 "Reglas")
- RF-5: Período DEBE tomar los últimos N partidos **de cada entidad** por fecha, después de aplicar los demás filtros de
  nivel partido; sin fecha el partido no entra en "últimos N". · (US-1) (Esp. v2 §T-01 "si el filtro es últimos 5
  partidos…"; Arquitectura §3.8)
- RF-6: Días de descanso DEBE calcularse como la cantidad de días calendario entre el partido anterior del equipo (en
  cualquier competencia cargada) y el partido, menos uno: partidos en días consecutivos = 0 días de descanso; los valores
  se agrupan en 0, 1, 2 y "3 o más". El primer partido cargado del equipo y los partidos sin fecha no tienen descanso
  calculable y quedan fuera cuando el filtro está activo (informados como excluidos). · (US-1) (§9 decisión)
- RF-7: Situación de marcador DEBE evaluarse evento por evento con el marcador corrido **antes** del evento: "ajustado" si la
  diferencia absoluta es ≤ `context.close_margin` (default 10, configurable en S9 › Reglas de contexto), "paliza" si es
  mayor. · (US-1) (Esp. v2 §T-03 "diferencia ≤ 10 o paliza"; Arquitectura DA-33)
- RF-8: Cuarto DEBE identificar los períodos regulares 1 a 4 y agrupar todas las prórrogas en "prórroga", usando el tipo
  de período del play-by-play (no solo el número, que se reinicia en las prórrogas). · (US-1) (Esp. v2 §T-03; Arquitectura
  D-09)
- RF-9: Con jugador X / sin jugador X DEBE seleccionar los eventos (y el tiempo) en que el o los jugadores elegidos
  estaban / no estaban en cancha, según la reconstrucción de quintetos existente; solo admite jugadores del equipo de la
  entidad analizada. Con este filtro activo, los percentiles, ranking, líder y promedio de la ficha quedan nulos con razón
  `contexto_no_comparable` (el filtro no tiene equivalente para las demás entidades). · (US-1) (Arquitectura §3.8
  `population_mode = entity_only`)
- RF-10: Con filtros de nivel partido o evento (salvo con/sin jugador), la población de referencia de T-01 DEBE
  recalcularse aplicando el mismo contexto a todas las entidades de la competencia (cada una con sus últimos N, su sede,
  etc.); con filtro de rival, la población excluye al rival elegido. La ficha DEBE indicar el contexto de la población
  ("Últimos 5 · Visitante"). · (US-3) (Esp. v2 §T-01; Arquitectura §3.6, §3.8 columna "Población")
- RF-11: Cada filtro aplicado DEBE recalcular el badge de muestra de T-02: sin filtros de evento, la muestra de equipo y
  jugador se mide como hoy (partidos, minutos); con cualquier filtro distinto de competencia (split de contexto), además
  se mide en posesiones con los umbrales de split (mínimo 15, alta 40, configurables) y se aplica la regresión a la media
  de OER, DER y Net Rating con K de split (20, configurable). · (US-4) (Esp. v2 §T-02 tabla "Split de contexto", "K … 20
  para splits")
- RF-12: El estado completo del filtro DEBE viajar en la dirección con los mismos nombres de parámetro que la API
  (`competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`), omitiendo los valores por
  defecto, y DEBE reconstruirse exactamente al recargar o abrir la dirección. · (US-5) (Esp. v2 §T-03; Arquitectura §3.8
  "Frontend")
- RF-13: Toda respuesta de un endpoint que acepta contexto DEBE incluir el eco `context` con: competencia resuelta,
  filtros aplicados, filtros ignorados con razón, nivel, modo de población, partidos usados y totales, partidos excluidos
  por razón y una etiqueta legible. · (US-4, US-5) (Arquitectura §7.5)
- RF-14: El contrato DEBE aceptar ya los parámetros de posesión (`clock`, `clock_start`, `origin`, `ptype`, `chance`); mientras
  su dimensión no exista, el sistema DEBE ignorarlos e informarlos en `context.ignored` con razón `requiere_posesiones`, y
  la barra NO DEBE ofrecerlos. Cada requisito A-02…A-05 habilita su dimensión sin cambiar el contrato. · (US-1) (Esp. v2
  §T-03 "Dimensiones de posesión, definidas en el bloque A"; Arquitectura §9.2 I-02)
- RF-15: El sistema DEBE exponer las opciones y la disponibilidad de cada dimensión para la competencia elegida (equipos,
  jugadores del equipo analizado, valores válidos, si la dimensión está disponible), para que la barra solo ofrezca lo que
  se puede calcular. · (US-1) (Arquitectura §6 `GET /api/context/options`)
- RF-16: Los endpoints de datos DEBEN aceptar el contexto según esta tabla en la fase 2 (lo no aceptado se informa en
  `context.ignored` con razón `no_aplica`, nunca da error):

  | Endpoint | Nivel partido | Nivel evento | Nota |
  |---|---|---|---|
  | `GET /api/metrics/<entity_type>` (team, player, split) | sí | sí | conjunto estándar T-05 |
  | `GET /api/team/<team_code>` · `GET /api/player/<team_code>/<player_name>` · `GET /api/player/<int:player_id>` | sí | sí (bloque `standard`); `game_log` solo nivel partido | |
  | `GET /api/table/<table_id>` (`league_teams`, `search_players`, `team_game_log`, `player_game_log`, `league_standings`) | sí | sí para `league_teams` y `search_players`; tablas por partido y tabla general solo nivel partido | |
  | `GET /api/rankings/<entity_type>/<metric_key>` · `GET /api/league` | sí | sí | población recalculada |
  | `GET /api/shot-zones` · `GET /api/shots/...` | sí | sí (tiros filtrados por su evento pbp) | |
  | `GET /api/lineup/<team_code>` · `GET /api/onoff/...` · `GET /api/clutch/<team_code>` | sí | no (hasta F-06 / F-04) | |
  · (US-1) (Arquitectura §6 columna "Ctx")
- RF-17: Un valor de filtro inválido (texto no reconocido, jugador de otro equipo, `last` no positivo, rival inexistente)
  DEBE responder 400 con código `contexto_invalido` y mensaje en español que nombre el parámetro. · (US-5) (Arquitectura
  §7.8)
- RF-18: Todas las métricas bajo contexto DEBEN respetar la política de nulos: una métrica sin denominador en la selección
  es nula con razón; una selección sin partidos o sin eventos da nulos con razón `sin_datos`, nunca ceros; las tasas de la
  selección son cociente de totales (Σ numerador / Σ denominador). · (US-4) (Esp. v2 §C-11; Arquitectura §2.1, DA-02)
- RF-19: La barra DEBE mostrar un botón para limpiar todos los filtros (vuelve a competencia por defecto, todos los
  partidos) y un resumen de cuántos filtros hay activos; en móvil se pliega en una línea "Filtros (n)" que abre el panel.
  · (US-1) (Constitución 7)
- RF-20: El sistema DEBE recordar por usuario la última competencia elegida y usarla como competencia inicial cuando la
  dirección no la indica y la entidad no tiene una más reciente. · (US-1) (Arquitectura §3.3 scope `ui` key
  `last_competition`)

## 5. Requisitos de datos / API
Sin cambios de esquema (Arquitectura §5). Clave de configuración nueva agregada por T-03 al catálogo de F-13.

| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `games` (`date`, `home_code`, `away_code`, `competition_id`) | tabla | sede, rival, descanso, competencia | No (competition_id de F-11) |
| `pbp_events` (`period`, `period_type`, `clock_secs`, `s1`, `s2`, `team_code`, `player_name`, `action_type`, `sub_type`, `success`, `action_number`) | tabla | cuarto, marcador corrido, jugador en cancha, agregación por evento | No |
| `player_game_stats` (`starter`, `player_id`) | tabla | titulares para la reconstrucción; `player_id` para `on`/`off` | No (player_id de C-08) |
| `shots` (`game_id`, `action_number`) | tabla | unión con el evento pbp del tiro para filtrar por cuarto/marcador/jugador | No |
| `app_config` clave `context.close_margin` | config | int, default 10, rango 1–40, sección "Reglas de contexto" | **NUEVO** (clave de T-03 en `CONFIG_SPEC`) |
| `user_prefs` scope `ui` key `last_competition` | pref | competition_id | No (tabla de F-13) |
| `GET /api/context/options` | endpoint | `?competition=&team=&player=` → `{competitions, teams, players, dimensions[]}` | **NUEVO** |
| Parámetros de contexto en endpoints "Ctx" | query | `competition, last, venue, opponent, rest, quarter, score, on, off` (+ `clock, clock_start, origin, ptype, chance` ignorados) | modificado (C-02 creó `competition`/`last`) |
| Eco `context` | campo de respuesta | shape Arquitectura §7.5 | modificado (C-02 lo emite con `competition`/`last`) |
| `GET /api/metrics/split` | endpoint (tipo de entidad) | `?id=team:<code>` o `id=player:<player_id>` + contexto → conjunto estándar §7.3 con `sample` de split | **NUEVO** (tipo `split`, dueño T-03) |
| Error `contexto_invalido` | error | 400 `{error, code: "contexto_invalido", details: {param, value}}` | No (código de §7.8) |

Valores definitivos de cada parámetro (Arquitectura §3.8): `venue` ∈ {`local`, `visitante`}; `opponent` = team_code;
`rest` ∈ {`0`, `1`, `2`, `3mas`}; `quarter` = CSV de {`1`,`2`,`3`,`4`,`pr`}; `score` ∈ {`ajustado`, `paliza`}; `on`/`off` = CSV
de `player_id`; `last` entero > 0.

## 6. Estados de UI
Copy nuevo (a agregar a `docs/frontend.md`) marcado con *(nuevo)*.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Barra de contexto | Controles deshabilitados + "Cargando filtros…" *(nuevo)* | Sin competencias: la barra no se muestra y la vista indica "Todavía no hay partidos cargados." *(nuevo)* | "No se pudieron cargar los filtros." *(nuevo)*; los bloques se calculan con los filtros de la dirección | Barra visible con los valores de la dirección; bloques con "Sin conexión: no se pueden cargar los datos." (X-01) | Controles con el estado activo; contador "Filtros (n)" *(nuevo)*; botón "Limpiar filtros" *(nuevo)* |
| Selección sin partidos | — | Cada bloque: "No hay partidos que cumplan estos filtros." *(nuevo)* + botón "Limpiar filtros" | — | — | — |
| Selección con partidos excluidos | — | — | — | — | Aviso bajo la barra: "Se excluyeron {n} partidos sin jugada a jugada." / "Se excluyeron {n} partidos sin descanso calculable." *(nuevo)* |
| Con/sin jugador activo | — | — | — | — | En cada ficha: "Percentil no disponible con filtro de jugador" *(nuevo)* como `title` del "—" (razón `contexto_no_comparable`) |
| Parámetro no aplicable en un bloque | — | — | — | — | Nota discreta en el bloque: "Este bloque no aplica el filtro de {filtro}." *(nuevo)* |
| Dirección con filtro inválido | — | — | Toast con el mensaje del backend (p. ej. "Valor inválido para 'venue': 'casa'.") *(nuevo)* y se limpian los filtros inválidos | — | — |
| Badge de split | — | — | — | — | Badge T-02 en posesiones (BAJA/MEDIA/ALTA) junto al de partidos/minutos |

Etiquetas *(nuevo)*: "Competencia", "Período" ("Todos", "Últimos 3", "Últimos 5", "Últimos 10"), "Sede" ("Todos", "Local",
"Visitante"), "Rival" ("Todos"), "Cuarto" ("1.º", "2.º", "3.º", "4.º", "Prórroga"), "Marcador" ("Todos", "Ajustado (≤ {n})",
"Paliza (> {n})"), "Con jugador", "Sin jugador", "Descanso" ("Todos", "0 días", "1 día", "2 días", "3 o más"). Etiqueta
de contexto (eco `label`): partes unidas por " · " en el orden de §3.8, p. ej. "Últimos 5 · Visitante · 4.º cuarto ·
Ajustado".

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "Cambiar un filtro recalcula todos los bloques de la pantalla, y recargar la URL reproduce
  exactamente la misma vista." — Given S3 › Resumen de un equipo del dataset, When se cambia Sede a "Visitante", Then todos
  los bloques de la pestaña (conjunto estándar, fichas, four factors, radar, badge) se vuelven a pedir con `venue=visitante`
  y muestran la etiqueta "Visitante"; When se recarga la página, Then se ve la misma vista con el mismo filtro y los
  mismos valores.
- CA-2 (RF-3, RF-12): Given `#/equipo/<code>/resumen?last=5&venue=visitante&quarter=4&score=ajustado`, When se abre, Then la
  barra muestra los cuatro filtros activos, el eco `context.applied` del bloque estándar trae los cuatro y la etiqueta es
  "Últimos 5 · Visitante · 4.º cuarto · Ajustado".
- CA-3 (RF-4, RF-8, RF-18): Given un equipo, When se pide `GET /api/metrics/team?id=<code>&quarter=1,2,3,4,pr`, Then `pts` es
  igual a la suma de puntos del equipo en el box de los partidos con play-by-play y `context.games_excluded.sin_pbp` cuenta
  los partidos sin pbp.
- CA-4 (RF-8): Given los dos partidos con prórroga del seed, When se pide `quarter=pr` para uno de sus equipos, Then los
  puntos coinciden con la suma de los parciales de prórroga del partido y los minutos de la selección son 5 por prórroga.
- CA-5 (RF-7): Given un equipo y `context.close_margin = 10`, When se piden `score=ajustado` y `score=paliza`, Then
  `pts(ajustado) + pts(paliza) = pts(sin filtro de marcador)` sobre los mismos partidos con pbp y las posesiones también
  suman.
- CA-6 (RF-9): Given un jugador titular, When se piden `on=<id>` y `off=<id>` para su equipo, Then `pts` y posesiones de ON
  + OFF igualan los del equipo en los partidos con pbp, y los percentiles vienen nulos con razón `contexto_no_comparable`.
- CA-7 (RF-5, RF-10): Given `GET /api/rankings/team/oer?last=5`, When se revisa, Then cada fila usa los últimos 5 partidos
  de ese equipo, `population.context_label` es "Últimos 5 partidos" y el puesto y el líder coinciden con la ficha de OER del
  mismo equipo en S3 con `last=5`.
- CA-8 (RF-10): Given `opponent=<rival>`, When se pide el ranking de una métrica, Then el rival no aparece en la población.
- CA-9 (RF-6): Given un equipo con partidos en días consecutivos (o, si el dataset no los tiene, un partido con fecha
  editada en la base de verificación), When se pide `rest=0`, Then entran solo esos partidos, y el primer partido del
  equipo figura en `games_excluded` con su razón.
- CA-10 (RF-11): Given un filtro `quarter=4` sobre un equipo, When se mira el bloque estándar, Then trae un badge en
  posesiones con `min` = 15 y `high` = 40 (defaults), y OER, DER y Net traen `adj` con `k` = 20; al cambiar
  `sample.split.min` en S9 a 30, el badge se recalcula con el nuevo mínimo.
- CA-11 (RF-14): Given `?clock=temprano&origin=robo`, When se pide `GET /api/metrics/team?id=<code>&clock=temprano`, Then la
  respuesta es 200, las métricas son las del equipo sin ese filtro y `context.ignored` trae
  `{"param":"clock","reason":"requiere_posesiones"}`; la barra no ofrece esas dimensiones.
- CA-12 (RF-17): Given `?venue=casa`, When se pide cualquier endpoint con contexto, Then responde 400
  `{"error":"Valor inválido para 'venue': 'casa'.","code":"contexto_invalido",…}`; Given `on=<id de un jugador de otro
  equipo>`, Then 400 con "El jugador {id} no pertenece a {equipo}.".
- CA-13 (RF-16): Given `GET /api/lineup/<code>?players=…&quarter=4`, When se revisa, Then responde como sin `quarter` y
  `context.ignored` trae `{"param":"quarter","reason":"no_aplica"}`.
- CA-14 (RF-18, sin datos): Given `opponent=<rival>` y `venue=local` sin partidos que cumplan ambos, When se abre S3, Then
  cada bloque dice "No hay partidos que cumplan estos filtros." y la API devuelve métricas nulas con razón `sin_datos`
  (ningún 0).
- CA-15 (RF-1, RF-19): Given filtros activos en S3, When se pasa a S2 Liga, Then los filtros siguen activos (salvo con/sin
  jugador); When se toca "Limpiar filtros", Then la dirección queda sin parámetros de contexto (salvo la competencia por
  defecto implícita) y los bloques se recalculan.
- CA-16 (RF-19, móvil): Given 360 px de ancho, When hay 3 filtros activos, Then la barra ocupa una línea "Filtros (3)" que
  abre el panel sin scroll horizontal de página.
- CA-17 (RF-20): Given un usuario que eligió la competencia B y luego abre la app sin `competition` en la dirección, en una
  entidad sin partidos más recientes en otra competencia, Then la competencia inicial es B.

## 8. Fuera de alcance
- Dimensiones de posesión (tramo de reloj, origen, transición/media cancha, oportunidad): INCREMENTO DIFERIDO (→ A-02, A-03,
  A-04, A-05) — se habilitan con [A-02](../../fase-3-contexto-posesion/02-A-02-origen-posesion/spec.md),
  [A-03](../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/spec.md),
  [A-04](../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/spec.md),
  [A-05](../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/spec.md) (`clock_start` también con A-05).
- Filtros de nivel evento en Combinaciones y ON/OFF: INCREMENTO DIFERIDO (→ F-06) — se habilita con
  [F-06](../10-F-06-quintetos-onoff-ampliados/spec.md). En Cierres: no aplica (el cierre ya es un tramo); F-04 decide.
- Base de normalización (T-04), chips rápidos, período "últimos 15" y cabecera de contexto (F-19).
- Filtro por jugador rival en cancha ("con/sin jugador X del rival"): no está pedido; `on`/`off` solo del propio equipo.
- Filtro por partido individual o rango de fechas: no está en la lista del cliente.
- Guardar combinaciones de filtros con nombre (lo trae F-10 para quintetos).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **"Paliza"** = diferencia absoluta mayor que `context.close_margin` (default 10) en el
  marcador corrido antes de cada evento (DA-33). Alternativa descartada: resultado final del partido (no permite ver el
  rendimiento "cuando el partido estuvo apretado" dentro de partidos que terminaron por paliza).
- [DECISIÓN PROPUESTA — confirmar] **Días de descanso** = días calendario entre partidos consecutivos del equipo menos
  uno, contando partidos de cualquier competencia cargada (la fatiga no depende de la competencia); buckets 0/1/2/3 o
  más; el primer partido cargado del equipo queda sin dato. Limitación: solo cuenta partidos importados (un partido no
  importado entre medio infla el descanso) — se aclara en el `title` del filtro.
- [DECISIÓN PROPUESTA — confirmar] **Período "últimos N"** se aplica después de los demás filtros de nivel partido (p. ej.
  "últimos 5 de visitante" = los 5 partidos de visitante más recientes), por entidad.
- [DECISIÓN PROPUESTA — confirmar] **Descanso y sede para el jugador** se toman del partido de su equipo.
- [DECISIÓN PROPUESTA — confirmar] **Nivel evento sin pbp**: los partidos sin play-by-play se excluyen (no se estiman) y se
  informan; así ON + OFF y ajustado + paliza siempre suman al total de los partidos con pbp.
- [DECISIÓN PROPUESTA — confirmar] **Marcador del evento**: se usa el marcador antes del evento (un triple que pone el
  partido 12 arriba desde 9 cuenta como "ajustado").
- [DECISIÓN PROPUESTA — confirmar] **Tiempo con filtros de evento**: los segundos de la selección son la suma del tiempo de
  reloj transcurrido mientras rige el estado filtrado (cuarto, marcador, quinteto), atribuido al estado vigente al inicio
  de cada intervalo; alimenta minutos, PACE y la base por 40 de T-04.
- [DECISIÓN PROPUESTA — confirmar] **Muestra de split**: se considera "split de contexto" toda selección con algún filtro
  distinto de la competencia; en esos casos el badge suma la medición en posesiones con los umbrales de split. Para
  jugador, las posesiones del split son las del equipo con él en cancha.
- [DECISIÓN PROPUESTA — confirmar] **Con/sin jugador** admite varios jugadores (`on=12,15` = ambos en cancha; `off=12,15` =
  ninguno de los dos). La ficha no tiene población comparable y muestra percentiles nulos.
- [DECISIÓN PROPUESTA — confirmar] **Tabla general y game log** solo aceptan filtros de nivel partido (una tabla de
  posiciones "en el 4.º cuarto" no tiene sentido deportivo); el resto se informa como ignorado.
- [DECISIÓN PROPUESTA — confirmar] **Primer partido sin descanso**: se informa como excluido con una razón nueva
  `sin_partido_previo` (no está entre los códigos de la arquitectura; ver plan §10).
