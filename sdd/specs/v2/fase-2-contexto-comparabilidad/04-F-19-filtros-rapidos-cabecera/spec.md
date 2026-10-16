# Spec — F-19: Filtros rápidos y cabecera de contexto

> **ID:** F-19 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 04
> **Depende de:** T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md), transitiva vía T-03) · F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md), universo de competencia)
> **Habilita:** — (consumido por F-05, F-08, F-04, F-06 y toda vista con estadísticas como cabecera estándar)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4.2 · F-19 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.1 (capa transversal) · Arquitectura §3.8, §3.7, §6 (`/api/context/summary`), §7.2, §7.5, §8 (`quick-filters.js`, `context-header.js`) ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente y por qué.** F-19 es la "capa de presentación de la barra de contexto de T-03. El filtro existe, pero
debe estar al alcance de un toque y ser visible en todo momento". Pide chips en línea de período (Todos · Últimos 3 · 5 · 10
· 15), sede (Todos · Local · Visitante) y rival (un chip por equipo de la competencia); el resto de las dimensiones de T-03 en
un panel desplegable; una cabecera de contexto permanente con nombre de la entidad, récord V-D, diferencia media de puntos,
partidos incluidos y badge de muestra (T-02); el aviso de cuántos partidos quedaron tras cambiar un filtro ("la forma más
simple de evitar que alguien lea una métrica sin saber sobre cuántos partidos se calculó") y un botón de limpiar filtros.

**Qué existe hoy (verificado en código, rama `main`).**
- `frontend/js/app.js` — `renderApp()` (l.1637–1645): pills `#team-filter-pills` "Período: Todos · Últ. 5 · Últ. 3" solo en
  Equipo, visibles si el equipo tiene más de 3 partidos (`renderTeam`, l.846–849). El filtro se aplica **en el cliente**
  sobre el `game_log` (`_filteredLog(gameLog, n)`, l.673) y recalcula con `_computeAvg` (media de tasas por partido).
- `_renderTeamContent` (l.723–733): con cualquier filtro activo el récord se oculta (`rec = unfiltered ? data.record : null`)
  → hoy, justamente cuando hay filtro, el usuario **pierde** la referencia de sobre cuántos partidos mira.
- Filtro de competencia en Liga/Equipo/Comparar/Jugador (`_logComps`/`_filterByComp`/`_compOptions`, l.74–85), `<select>`
  oculto con ≤1 competencia. No hay sede, rival ni "últimos 10/15". Jugador, Comparar y Buscar no tienen período.
- `_recordCard(record, teamName)` (l.124) muestra récord total, local y visitante; `backend/app.py:team_stats` (l.480–487)
  arma `record{wins, losses, win_pct, home, away}` sobre **todos** los partidos. No existe diferencia media de puntos.
- No existe routing por hash ni estado de filtros en la URL (arquitectura §1.4, D-03).

**Qué resolvieron features anteriores.** Feature 09 (`sdd/specs/09-filtro-competencia`) agregó el filtro por competencia y
las pills Últ. N que componen con él. Fase 1 v2: F-11 crea el universo `competitions`; C-02 crea `context.py` con
`competition`/`last`; T-02 crea el badge de muestra. Fase 2: X-01 crea el router hash; T-03 crea el contrato completo de
contexto (`parse_context`, `context_echo`, `/api/context/options`, `core/context.js`, barra `context-bar.js`) y el
estado en la URL.

**Qué queda para F-19.** La presentación "a un toque": chips, panel desplegable que aloja la barra completa de T-03, la
cabecera permanente con récord/diferencia media/partidos/badge, el aviso de partidos restantes y el botón limpiar, en todas
las vistas con estadísticas, mobile-first. El cálculo del contexto, su parseo y su persistencia en la URL **no** son de F-19.

## 1. Objetivo
Que en cualquier pantalla con estadísticas el usuario vea, sin desplazarse, qué filtros están aplicados y sobre cuántos
partidos se calcula lo que mira, y pueda cambiar período, sede y rival con un toque.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4.2 F-19 (texto completo y CA); §1.1 fila "Filtros rápidos y cabecera"; §3 T-03 (dimensiones, URL,
  recálculo del badge); §3 T-02 (badge BAJA/MEDIA/ALTA, población de equipo 3/10 partidos y jugador 60/200 minutos).
- `docs/frontend.md` §Vistas (Equipo: pills Últ. N; filtro por competencia Feature 09); §Service worker.
- `docs/api.md` `GET /api/team/<team_code>` (`record`), `GET /api/competitions`.
- `00-arquitectura-transversal.md` §3.1 (resolución de competencia, DA-14), §3.7 (`sample_level`), §3.8 (parámetros de
  contexto y `core/context.js`), §3.12 (secciones/pestañas), §3.13 (organización frontend), §6 (`GET /api/context/summary`,
  dueño F-19), §7.2 (badge), §7.5 (eco de contexto), §7.8 (errores), §8 (`renderQuickFilters`, `renderContextHeader`).
- Specs previos: `sdd/specs/09-filtro-competencia/spec.md` (pills + competencia).

## 3. Historias de usuario
- US-1: Como entrenador, quiero cambiar el período (todos, últimos 3/5/10/15), la sede y el rival con un toque, para leer
  rápidamente el momento actual del equipo o el rendimiento contra un rival.
- US-2: Como entrenador, quiero ver siempre arriba el nombre de lo que analizo, su récord, la diferencia media de puntos,
  cuántos partidos incluye la selección y la confiabilidad de la muestra, para no leer una métrica sin saber sobre qué base
  se calculó.
- US-3: Como analista, quiero que al cambiar un filtro se me avise cuántos partidos quedaron, para detectar enseguida una
  selección demasiado chica o vacía.
- US-4: Como entrenador, quiero limpiar todos los filtros con un botón, para volver a la vista completa sin deshacer uno por uno.
- US-5: Como analista, quiero acceder al resto de las dimensiones de contexto (cuarto, marcador, con/sin jugador, descanso)
  desde un panel desplegable, para no saturar la pantalla con controles que uso menos.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE mostrar, en cada vista con estadísticas (§6), una fila de **chips de período**: "Todos", "Últimos 3",
  "Últimos 5", "Últimos 10", "Últimos 15", mutuamente excluyentes, con el activo resaltado. · (US-1) (Esp. v2 §F-19) ·
  Reglas: "Todos" = sin parámetro `last`; los demás fijan `last` = N (arquitectura §3.8: `last` entero > 0, UI 3/5/10/15).
- RF-2: El sistema DEBE mostrar **chips de sede**: "Todos", "Local", "Visitante", mutuamente excluyentes. · (US-1)
  (Esp. v2 §F-19) · Reglas: `venue` ∈ {`local`, `visitante`}; "Todos" = sin parámetro.
- RF-3: El sistema DEBE mostrar **chips de rival**: "Todos" más un chip por cada equipo de la competencia activa (nombre
  corto), excluido el equipo de la entidad consultada cuando la hay. · (US-1) (Esp. v2 §F-19) · Reglas: `opponent` =
  `team_code`; la lista sale de los equipos de la competencia resuelta (§3.1); si la competencia es `all`, se listan los
  equipos con partidos en la selección.
- RF-4: Los chips DEBEN reflejar el estado activo del contexto (URL de T-03) y combinarse entre sí (AND) y con los filtros
  del panel desplegable; al tocar un chip se actualiza el contexto global y se recalculan todos los bloques de la vista. ·
  (US-1) (Esp. v2 §F-19; §T-03 "los filtros se combinan", "recalcula todos los bloques")
- RF-5: El sistema DEBE ofrecer un **panel desplegable** "Más filtros" que contenga el resto de las dimensiones de T-03
  disponibles en la fase (competencia, cuarto, situación de marcador, con/sin jugador, días de descanso y las de posesión
  cuando estén habilitadas), con un contador de filtros activos dentro del panel en el botón que lo abre. · (US-5)
  (Esp. v2 §F-19, §T-03)
- RF-6: El sistema DEBE mostrar una **cabecera de contexto permanente** con: nombre de la entidad; récord "V-D"; diferencia
  media de puntos con signo; partidos incluidos "N de M partidos"; badge de muestra T-02; y la etiqueta legible de los
  filtros aplicados (ej. "Últimos 5 · Local · vs Peñarol"). · (US-2) (Esp. v2 §F-19) · Reglas:
  - Récord = victorias-derrotas de los partidos de la selección (victoria: puntos propios > puntos del rival en el resultado
    final). Para un jugador: récord del equipo en los partidos que el jugador **jugó** (DNP excluidos, `played(minutes)`).
  - Diferencia media de puntos = `Σ(pts_propios − pts_rival) / partidos` sobre el resultado final de los partidos de la
    selección, con 1 decimal y signo ("+4,3", "−2,0").
  - Partidos incluidos N = partidos que efectivamente entran en el cálculo (`context.games_used`); M = partidos de la
    entidad en la competencia sin otros filtros (`context.games_total`).
  - Badge: equipo → unidad partidos (`sample.team.min` 3 / `sample.team.high` 10); jugador → unidad minutos
    (`sample.player.min` 60 / `sample.player.high` 200); se recalcula con cada filtro (Esp. v2 §T-03 último punto).
- RF-7: La cabecera y los chips DEBEN permanecer visibles sin desplazarse (fijos al tope del área de contenido al hacer
  scroll), en desktop y en móvil (<768 px). · (US-2) (Esp. v2 §F-19 CA)
- RF-8: Al cambiar cualquier filtro, la cabecera DEBE indicar de forma destacada cuántos partidos quedaron dentro de la
  selección ("Quedan 5 de 16 partidos") durante unos segundos, y dejar el conteo permanente actualizado. · (US-3)
  (Esp. v2 §F-19)
- RF-9: Si la selección queda en 0 partidos, la cabecera DEBE decirlo explícitamente, la vista no DEBE mostrar métricas con
  cero (C-11: nulo con razón `sin_datos`) y DEBE ofrecer el botón limpiar filtros. · (US-3) (Esp. v2 §C-11)
- RF-10: El sistema DEBE mostrar un botón "Limpiar filtros" siempre visible cuando hay al menos un filtro activo (chip o
  panel), que quita todos los filtros y conserva la competencia seleccionada y la base de normalización. · (US-4)
  (Esp. v2 §F-19)
- RF-11: Si hay filtros que el backend ignoró (`context.ignored`) o partidos excluidos (`context.games_excluded`, p. ej.
  `sin_pbp` con filtro de cuarto), la cabecera DEBE informarlo en una línea secundaria ("2 partidos sin jugada a jugada
  excluidos"). · (US-2) (Arquitectura §3.8, §7.5)
- RF-12: El backend DEBE exponer el resumen de la cabecera para una entidad y un contexto, reutilizando el contrato de
  contexto de T-03 y el badge de T-02, sin recalcular métricas en el frontend. · (US-2) (Arquitectura §6
  `GET /api/context/summary`; Constitución 4 y regla 4 de `sdd/02-plan.md`)
- RF-13: Todo copy nuevo DEBE ir en español rioplatense vía `t()` (DA-21) y los números con formato es-UY (coma decimal,
  DA-36). · (US-2) (Arquitectura §3.20)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `games`, `team_game_stats`, `player_game_stats` (`pts`, `opp_pts`, `is_home`, `minutes`, `competition_id`) | consumidos | vía `repository` (F-11) | — |
| `GET /api/context/options` | consumido (T-03) | `{competitions, teams, players, dimensions[{name, level, values, available}]}` | T-03 |
| `GET /api/context/summary` | endpoint | query `entity` ∈ {`team`,`player`,`competition`}, `id`, + contexto T-03 → `{entity, label, record: "V-D", wins, losses, avg_margin, games, games_total, sample, context}`; 400 `contexto_invalido`/`parametro_invalido`, 404 `no_encontrado` | **NUEVO** (dueño F-19, arquitectura §6) → `docs/api.md` |
| Eco `context` (§7.5) de cada endpoint de métricas | consumido | `games_used`, `games_total`, `games_excluded`, `ignored`, `label` | T-03 |
| Esquema | — | sin cambios | — |

## 6. Estados de UI
Componentes: **filtros rápidos** (chips + botón "Más filtros" + "Limpiar filtros") y **cabecera de contexto**. Vistas donde
aparecen: S3 Equipo (todas las pestañas), S4 Jugador (todas las pestañas), S2 Liga (entidad = competencia; sin chips de
rival), S6 Comparar (una cabecera por lado), S7 Explorar (entidad = competencia). No aparecen en S1 Datos, S9 Configuración ni
S5 Partido (un solo partido). Copy nuevo → `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Cabecera de contexto | Esqueleto con el nombre de la entidad y "Calculando selección…" | "Ningún partido cumple los filtros" + botón "Limpiar filtros" | "No se pudo calcular la selección" (el resto de la vista sigue) | "Sin conexión: se muestran los últimos datos cargados" (si hay respuesta previa) o "Sin conexión" | "Nacional · 9-7 · Dif. media +4,3 · 16 de 16 partidos · [ALTA]" + etiqueta de filtros |
| Aviso tras cambio | — | "Quedan 0 de 16 partidos" | — | — | "Quedan 5 de 16 partidos" (resaltado ~4 s) |
| Chips | Deshabilitados mientras carga el contexto | Chips de rival: "Sin rivales en la competencia" | — | Chips operables (el cambio muestra el error de red de la vista) | Chip activo resaltado |
| Panel "Más filtros" | "Cargando filtros…" | "No hay más filtros disponibles" | "No se pudieron cargar los filtros" | idem error | Barra de T-03 + contador "(2)" en el botón |
| Línea secundaria | — | — | — | — | "2 partidos sin jugada a jugada excluidos" · "Filtro de reloj ignorado: requiere posesiones" |

## 7. Criterios de aceptación
- CA-1 (CA del cliente): **"en cualquier pantalla se puede saber, sin desplazarse, qué filtros están aplicados y sobre
  cuántos partidos."** Given cualquier vista con estadísticas (S2, S3, S4, S6, S7) con filtros activos, When el usuario
  hace scroll hasta el final de la vista en desktop y en un viewport de 375 px, Then la cabecera sigue visible y muestra
  la etiqueta de filtros y "N de M partidos".
- CA-2: Given el equipo X con 16 partidos en la competencia, When toca "Últimos 5", Then la cabecera muestra "5 de 16
  partidos", el récord y la diferencia media coinciden con los 5 partidos más recientes del game log, y aparece el aviso
  "Quedan 5 de 16 partidos".
- CA-3: Given "Últimos 10" activo, When además toca "Local" y un rival, Then los tres chips quedan activos a la vez, la URL
  contiene `last=10&venue=local&opponent=<code>` y recargar la URL reproduce chips, cabecera y bloques.
- CA-4: Given un rival contra el que el equipo nunca jugó como local con "Local" activo, When se aplica, Then la cabecera dice
  "Ningún partido cumple los filtros", los bloques muestran "—" (nunca 0) y el botón "Limpiar filtros" está visible.
- CA-5: Given filtros activos (chips y del panel), When toca "Limpiar filtros", Then quedan "Todos" en los tres grupos, el
  panel sin filtros, la competencia y la base se conservan y el botón desaparece.
- CA-6: Given un equipo con 2 partidos en la selección, When se ve la cabecera, Then el badge es BAJA (menos de
  `sample.team.min` = 3) y al cambiar el umbral en Configuración el badge cambia sin tocar código.
- CA-7: Given un jugador con 3 partidos jugados y 1 DNP en la selección, When se ve su cabecera, Then indica 3 partidos,
  el récord es el del equipo en esos 3 partidos y el badge usa minutos.
- CA-8: Given el filtro de cuarto "4" desde el panel y un partido de la selección sin play-by-play, When se aplica, Then la
  línea secundaria informa "1 partido sin jugada a jugada excluido" y el conteo N lo descuenta.
- CA-9: Given un viewport de 375 px, When se ven los chips de rival de una competencia de 12 equipos, Then se desplazan en
  horizontal dentro de su fila sin generar scroll horizontal de la página.
- CA-10: Given `GET /api/context/summary?entity=team&id=ZZZ`, When el equipo no existe, Then responde 404 con
  `{"error": "Equipo no encontrado", "code": "no_encontrado"}`; con `last=abc` responde 400 `contexto_invalido`.

## 8. Fuera de alcance
- El contrato de contexto, su parseo, la persistencia en la URL, `GET /api/context/options` y la barra completa: T-03
  (F-19 la aloja dentro del panel desplegable sin reimplementarla).
- El selector de base de normalización (T-04) y su persistencia: F-19 solo lo conserva al limpiar.
- Récord local/visitante desglosado y rachas: siguen en la tarjeta de récord existente de Resumen (no se elimina).
- Cabecera en S5 Partido (un partido no tiene "selección") y en S1/S9.
- Chips para dimensiones de posesión (reloj, origen, tipo, oportunidad): quedan en el panel y aparecen cuando A-02…A-05
  registren sus dimensiones (INCREMENTO DIFERIDO (→ A-02, A-03, A-04, A-05): disponibilidad leída de `/api/context/options`,
  sin trabajo adicional de F-19).
- Chips para quintetos como entidad propia: la cabecera en pantallas de quintetos muestra el equipo (F-06 decide si agrega
  la muestra del quinteto en su propio bloque).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **Períodos 3/5/10/15.** T-03 enumera "todos / últimos 3 / 5 / 10" y F-19 agrega 15. La
  arquitectura §3.8 ya fija `last` como entero libre con UI 3, 5, 10, 15; se adoptan los cuatro chips y el panel de T-03
  ofrece la misma lista. No hay conflicto de contrato.
- [DECISIÓN PROPUESTA — confirmar] **"Limpiar filtros" conserva la competencia y la base.** La competencia es el universo de
  cálculo (percentiles, líderes), no un filtro de lectura; limpiarla cambiaría todos los percentiles. La base (T-04) es una
  preferencia de lectura de sesión. Se limpian: `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off` y las
  dimensiones de posesión.
- [DECISIÓN PROPUESTA — confirmar] **Récord y diferencia media con filtros de evento/posesión.** Son magnitudes de partido:
  se calculan sobre el resultado final de los partidos incluidos (los que tienen pbp si hay filtro de evento), no sobre el
  tramo filtrado. La cabecera rotula "Dif. media (resultado final)" cuando hay filtro de nivel evento o posesión, para que
  no se lea como diferencial del cuarto.
- [DECISIÓN PROPUESTA — confirmar] **Récord de un jugador.** Se muestra el récord del equipo en los partidos que jugó
  (sin DNP), rotulado "Récord del equipo con él". Es el dato disponible sin inferencias; el ON/OFF sigue en F-06.
- [DECISIÓN PROPUESTA — confirmar] **Entidad en Liga y Explorar.** La entidad es la competencia: la cabecera muestra nombre y
  temporada, "N partidos" de la competencia en la selección y sin récord, diferencia media ni badge (no aplican); no hay
  chips de rival (el filtro "rival" en Liga filtraría a todos los equipos contra uno, lectura confusa). En Comparar hay una
  cabecera por cada lado.
- [DECISIÓN PROPUESTA — confirmar] **Chip de rival en la fila.** Con 10–16 equipos por competencia los chips se desplazan en
  horizontal dentro de su fila (sin scroll de página, regla 7); se usa el nombre corto del equipo.
- [DECISIÓN PROPUESTA — confirmar] **Duración del aviso.** El resaltado "Quedan N de M partidos" dura ~4 s y queda el conteo
  permanente; no se usa un toast para no tapar la cabecera en móvil.
