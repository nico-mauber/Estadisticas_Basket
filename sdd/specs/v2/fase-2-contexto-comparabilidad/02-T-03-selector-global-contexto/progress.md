# Progress — T-03: Selector global de contexto (splits)

> **Estado:** 🔶 ✅ Implementado: niveles PARTIDO, EVENTO y POSESIÓN en Equipo, Jugador, Liga, Comparar y Explorar; mapa de tiro (partido + reloj), cierres/combinación/ON-OFF (partido) y `ui.last_competition` (RF-20)
> **Fecha:** 2026-10-18
> Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

## Estado de tareas
- [x] T-A1 · Clave `context.close_margin` (int, 10, 1–40) en `CONFIG_SPEC`
- [x] T-B1 · `Context` extendido (`venue`, `opponent`, `rest`, `ignored`; los de evento se validan pero no se guardan)
- [x] T-B2 · `parse_context` valida `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off` y los 5 de posesión; `ContextError` trae `param`/`value` y `payload()` (400 `contexto_invalido` con `details`)
- [x] T-B3 · `backend/rest.py` (`team_rest`, `days_rest`): sobre todos los partidos publicados del equipo
- [x] T-B4 · `filter_games_ex` / `filter_games`: competencia → sede → rival → descanso → últimos N; entiende filas de equipo, filas de jugador y partidos con pbp (`info.date`, `info.home_away`, `opp_code`)
- [x] T-B5 · `splits.event_slices`: rebanadas por (período, marcador, quinteto) con segundos exactos (en vez de `_event_states` por evento)
- [x] T-B6 · Predicado de rebanada (`splits._passes`): cuarto (o), marcador y con/sin jugador con Y lógico
- [x] T-B7 · `poss_filter.possession_pass` / `chance_pass` (2026-11-17): origen y tipo por posesión; oportunidad, tramo y reloj por oportunidad; cuarto/marcador/con-sin con el estado al inicio de la posesión
- [x] T-B8 · `context.level` / `population_mode` (`entity_only` con con/sin jugador)
- [x] T-B9 · `context_echo` con `applied` (last, venue, opponent, rest), `ignored`, `games_excluded` y `label` ("Liga · Visitante · vs STO · 0 días de descanso")
- [x] T-B10 · `context.dimensions(comp_id)`: 13 entradas (4 disponibles, 4 de evento y 5 de posesión con `available: false`)
- [x] T-B11 · `GET /api/context/options`
- [🔶] T-B12 · Handlers migrados (el nivel evento solo lo calcula `team`): `/api/team`, `/api/player`, `/api/rankings`, `/api/metrics/<tipo>` (team, player, lineup, onoff, clutch), `/api/table/*`. `/api/shot-zones` informa `venue/opponent/rest` en `ignored` (`no_aplica`). Pendientes: `/api/league`, `/api/lineup`, `/api/onoff`, `/api/clutch` legacy
- [x] T-B13 · Handlers sin nivel evento informan `ignored` (shot-zones, lineup/onoff/clutch, tablas sin `levels`)
- [🔶] T-B14 · `StatBundle(entity_type="split")` para el equipo con filtros de evento o de posesión (`poss_filter.team_bundle`, los dos lados) y bundle de jugador filtrado (`poss_filter.player_bundle`); sin endpoint `/api/metrics/split` propio
- [x] T-B15 · Población con contexto completo: `context_key` incluye sede/rival/descanso; con `opponent` el rival sale de la población; `context_label` acorde
- [x] T-B16 · Badge de split en posesiones (mín. 15, alta 40) y ajuste a la media con K = 20 (probado en el equipo)
- [ ] T-B17 · `ui.last_competition`
- [x] T-C1 · `api.contextOptions`
- [🔶] T-C2 · `contextParams()` se agrega a perfil/métricas/tablas/ON-OFF/quinteto de Equipo y Jugador (no hay `contextToQuery` único todavía)
- [x] T-D1 · `core/context.js` (URL > sesión; `getContext`, `setContext`, `clearContext`, `contextParams`, `dropInvalid`)
- [x] T-D2 · `components/context-bar.js` (Sede, Rival, Descanso, "Limpiar filtros", contador)
- [x] T-D3 · Montada en Equipo y Jugador, con los niveles evento y posesión en ambas (subpanel plegable "Posesión")
- [x] T-D4 · Liga / Comparar / Explorar (2026-11-17)
- [x] T-D5 · CSS: panel plegable "Filtros (n)" en móvil, sin scroll horizontal
- [ ] T-D6 · Copy con `t()` (no existe `t()`, F-21)
- [x] T-E1 · Selección sin partidos: "No hay partidos que cumplan estos filtros." + "Limpiar filtros"; el endpoint de métricas responde 404 `sin_partidos`
- [x] T-E2 · Aviso "Se excluyeron N partidos sin descanso calculable" (`sin_pbp` queda para el nivel evento)
- [x] T-E3 · Valor inválido: el cliente descarta lo que no reconoce; si el servidor responde `contexto_invalido`, toast + se limpia solo ese parámetro y se reintenta
- [x] T-E4 · `sw.js` v35 con `core/context.js` y `context-bar.js`
- [x] T-F · Verificación de este corte (`t03_sim.py` 31/31, `t03_browser.py` 34/34, regresión completa)
- [ ] T-G1 … T-G3 · (diferido)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | 🔶 | En Equipo y Jugador cambiar la sede recalcula perfil, estándar, game log, ON/OFF y quintetos con `venue=…` (Network en Chromium); falta Liga/Comparar/Explorar |
| CA-2 | 🔶 | `?venue=visitante&rest=0` en la dirección reconstruye la barra; sin `quarter`/`score` todavía |
| CA-3 | ✅ | Σ pts por cuarto (1,2,3,4,pr) = total del box (152 = 152) en LAG; `quarter=1,2,3,4,pr` = sin filtro; minutos por cuarto = 10 × partidos con pbp |
| CA-4 | ✅ | `quarter=pr` en un equipo con prórroga: minutos = 5 × prórrogas; en un equipo sin prórroga: 404 `sin_partidos` |
| CA-5 | ✅ | `ajustado` + `paliza` = total (pts 137 + 15 = 152; minutos 69,3 + 10,7 = 80) |
| CA-6 | ✅ | `on` + `off` = total (pts 123 + 29 = 152; minutos 63,6 + 16,4 = 80); `population_mode: entity_only` y `contexto_no_comparable` |
| CA-7 | ✅ | `rankings/team/oer?last=…`/`venue=local`: `context_label` de la población y mismo contexto que la ficha |
| CA-8 | ✅ | `opponent=STO`: STO ya no es miembro de la población; solo quedan los equipos que lo enfrentaron |
| CA-9 | ✅ | Fechas editadas en la copia de la base: `rest=0` deja solo el segundo partido en días consecutivos; el primero cuenta en `games_excluded.sin_partido_previo` |
| CA-10 | 🔶 | `quarter=4`: `sample` en posesiones con min 15 / alta 40 y `adj.k = 20` en OER; falta probar el cambio de `sample.split.min` en la configuración |
| CA-11 | ✅ | Con las dimensiones de posesión registradas (`available: true`), `clock`/`origin`/… se aplican en equipo y jugador; los endpoints que no los calculan (`period`, lineup, tablas) los informan con `no_aplica` (`t03p_sim.py`) |
| CA-12 | ✅ | `venue=casa`, `rest=7`, `opponent=ZZZZ`, `last=0` → 400 `contexto_invalido` con `details.param` |
| CA-13 | 🔶 | `/api/metrics/clutch?quarter=4` → 200 con `ignored: no_aplica`; faltan los endpoints legacy `/api/lineup`, `/api/onoff`, `/api/clutch` |
| CA-14 | ✅ | `opponent=STO&venue=local` sin coincidencias: mensaje en el bloque y en el panel estándar; nunca ceros |
| CA-15 | ✅ | El contexto se conserva al pasar de Equipo a Jugador (URL + sesión); "Limpiar filtros" deja la URL sin parámetros |
| CA-16 | ✅ | 360 px: una línea "Filtros (n)" plegable, sin scroll horizontal |
| CA-17 | ⬜ | `ui.last_competition` pendiente |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅
- Endpoints probados con `test_client` sobre una copia de la base: ✅ (`t03_sim.py`)
- Consola del navegador sin errores JS: ✅ (los 404 de la consola son la respuesta `sin_partidos` esperada de una selección vacía)

## Desviaciones respecto a docs/ o plan
- **Alcance en cortes:** el nivel evento solo lo calcula el equipo (`team`). En jugador se valida y se informa en `ignored` con razón `no_implementado` (razón nueva, no está en el plan); en lineup/onoff/clutch/tablas, `no_aplica`.
- **Sin router X-01:** la barra vive dentro de `team-main` / `player-main` y el estado va en `?venue=&opponent=&rest=` (no en el hash).
- **`dimensions`:** 13 entradas (el plan decía 12: `on` y `off` aparecen por separado); las 8 de partido/evento están disponibles.
- **Selección vacía:** `/api/metrics/*` responde 404 `sin_partidos` en vez de métricas nulas; la UI lo traduce al estado vacío.
- **Shot-zones y Cierres:** no aplican el contexto todavía; la nota bajo la barra lo avisa.
- **`rest.py`:** módulo nuevo propuesto por el plan (§10).
- **Contexto y `last`:** `last` sigue en las pills de Equipo (Jugador no las tiene).

## Docs actualizados
- ✅ `docs/api.md` — `GET /api/context/options` y parámetros `venue`, `opponent`, `rest`
- ✅ `docs/architecture.md` — `context.py` ampliado y `rest.py`
- ✅ `docs/frontend.md` — barra de contexto

## Deuda / TODO
- Con/sin jugador solo existe a nivel equipo: la población no se recalcula (`entity_only`).
- `ui.last_competition` (T-B17).
- `t()` para el copy (F-21).

## RF-20 `ui.last_competition` (2026-11-16)
- Elegir competencia en Liga, Equipo o Jugador la guarda en la preferencia `ui.last_competition`; Liga la usa al abrirse sin competencia en la dirección (si sigue vigente; si no, la por defecto). La dirección siempre manda. Equipo y Jugador siguen abriendo en la competencia de su partido más reciente (DA-14). Verificado en Chromium con dos competencias (`t03_lastcomp_browser.py` 4/4).

## Nivel posesión y nivel evento del jugador (2026-11-17)
- **Contrato:** `clock_start` = `24|14` y `chance` = `primera|segunda` (arquitectura §3.8; el código aceptaba `temprano|medio|tardio` y `1|2|3mas`); `clock`, `origin` y `ptype` aceptan listas CSV. `Context` suma `clock`, `clock_start`, `origin`, `ptype`, `chance` (en `context_key`, el eco y la etiqueta). Elegir todos los valores de una lista = sin filtro. `level()` devuelve `posesion`. `/api/context/options` las ofrece con `available: true`, rótulos, `multi` y `unit`.
- **Equipo:** `poss_filter.team_bundle` suma las posesiones completas del equipo y las del rival que cumplen el filtro (dos lados: OER, DER, Net, OR%). Con `chance`/`clock`/`clock_start` la unidad es la oportunidad, con los rebotes por estructura de A-04.
- **Jugador:** `/api/metrics/player`, el bloque estándar de `/api/player` y los rankings de jugador aplican cuarto, marcador, con/sin compañero y los filtros de posesión: su box dentro de las unidades elegidas, minutos = segundos en cancha en ellas, equipo y rival con él en cancha. La población de jugadores usa el mismo contexto (salvo con/sin, `entity_only`). La razón `no_implementado` desaparece.
- **Barra:** en Equipo y Jugador, subpanel plegable "Posesión" (Origen, Tipo de ataque y Tramo de reloj con selección múltiple; Reloj; Oportunidad). La nota de la tabla nombra los filtros que no aplica.
- **Evidencia:** `t03p_sim.py` 36/36: suma de los 7 orígenes = posesiones completas (160) y sus puntos (180); `origin=robo` = entidad `origin` (14 posesiones); primera + segunda = oportunidades; `chance=segunda` = entidad `chance` (18 pts); `clock=tardio&clock_start=14` = oportunidades que cumplen (A-05 CA-15); jugador con todos los cuartos = su box (37 pts, 51,55 min contra 51,48 del box); suma de cuartos = total; con + sin compañero = total; población de 141 jugadores con `quarter=4`; valores inválidos → 400. `t03p_browser.py` 30/30 (Chromium 1280 y 360 px y en inglés, sin errores de consola ni textos sin traducir).
- **Desvío:** los paneles de A-02…A-05 (Equipo › Posesión) no recortan sus propias tablas por los filtros de posesión: los informan en `ignored` (`no_aplica`). El cruce de dimensiones lo hace A-06.

## Liga, Comparar, Explorar, mapa de tiro y endpoints viejos (2026-11-17)
- **Liga:** `/api/league` aplica partido, evento y posesión a la población (valores, ranking, percentiles, `Ø`) y devuelve `context`; la clasificación (récord, puntos) sigue siendo del partido completo (nota en pantalla); `on`/`off` → `ignored`. Tabla `league_teams`, `GET /api/leaders` y `GET /api/competition-profile` con el mismo contexto. Barra con cuarto, marcador y Posesión.
- **Comparar:** barra arriba de las pestañas; Jugadores con evento y posesión (`api.metrics("player")` con el contexto para los dos), Equipos y Quintetos con nivel partido. Cierra la deuda de F-05 ("el contexto no se aplica a esta comparación").
- **Explorar:** barra en Jugadores (tabla `search_players` con `levels`), Quintetos, Contextos y Similares.
- **Mapa de tiro (A-05 RF-12):** `/api/shot-zones` aplica `last`/`venue`/`opponent`/`rest` y `clock`/`clock_start` (tramo de la oportunidad de cada tiro), con percentiles sobre la población con el mismo contexto; el resto va en `ignored` y el mapa lo avisa.
- **Endpoints viejos (T-B12):** `/api/lineup`, `/api/onoff`, `/api/clutch` aplican el nivel partido y devuelven el eco.
- **`/api/metrics/split`:** alias de `team` con el contexto de la petición.
- **Evidencia:** `t03q_sim.py` 25/25 (suma por tramo ≤ total y `clock=tardio` = tiros del tramo; `venue=local` en el mapa; onoff/clutch/lineup con eco; Liga `quarter=4` = valor de población del equipo con el mismo filtro; `league_teams origin=robo` y `search_players quarter=4` = métricas de la entidad; split = team; líderes con `quarter=4`). `t03q_browser.py` 26/26 en Chromium 1280/360 px e inglés (el único texto marcado es una frase del plan de juego que el servidor ya devuelve en inglés).

