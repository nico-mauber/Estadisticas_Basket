# Progress — T-03: Selector global de contexto (splits)

> **Estado:** 🔶 Primer corte: nivel PARTIDO (últimos N, sede, rival, descanso) en Equipo y Jugador; falta nivel evento (cuarto, marcador, con/sin jugador)
> **Fecha:** 2026-10-18
> Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

## Estado de tareas
- [ ] T-A1 · Clave `context.close_margin` en `CONFIG_SPEC` (la usa el nivel evento: marcador)
- [x] T-B1 · `Context` extendido (`venue`, `opponent`, `rest`, `ignored`; los de evento se validan pero no se guardan)
- [x] T-B2 · `parse_context` valida `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off` y los 5 de posesión; `ContextError` trae `param`/`value` y `payload()` (400 `contexto_invalido` con `details`)
- [x] T-B3 · `backend/rest.py` (`team_rest`, `days_rest`): sobre todos los partidos publicados del equipo
- [x] T-B4 · `filter_games_ex` / `filter_games`: competencia → sede → rival → descanso → últimos N; entiende filas de equipo, filas de jugador y partidos con pbp (`info.date`, `info.home_away`, `opp_code`)
- [ ] T-B5 · `_event_states` (margen, cuarto, on_court)
- [ ] T-B6 · `event_predicate`
- [ ] T-B7 · `possession_predicate` (stub): los de posesión se informan en `ignored` con `requiere_posesiones`
- [ ] T-B8 · `level` / `population_mode` (hoy fijos en `partido` / `apply_all`)
- [x] T-B9 · `context_echo` con `applied` (last, venue, opponent, rest), `ignored`, `games_excluded` y `label` ("Liga · Visitante · vs STO · 0 días de descanso")
- [x] T-B10 · `context.dimensions(comp_id)`: 13 entradas (4 disponibles, 4 de evento y 5 de posesión con `available: false`)
- [x] T-B11 · `GET /api/context/options`
- [🔶] T-B12 · Handlers migrados: `/api/team`, `/api/player`, `/api/rankings`, `/api/metrics/<tipo>` (team, player, lineup, onoff, clutch), `/api/table/*`. `/api/shot-zones` informa `venue/opponent/rest` en `ignored` (`no_aplica`). Pendientes: `/api/league`, `/api/lineup`, `/api/onoff`, `/api/clutch` legacy
- [ ] T-B13 · Handlers sin nivel evento informan `ignored` (hecho para shot-zones; falta lineup/onoff/clutch legacy)
- [ ] T-B14 · Entidad `split` en `metrics_catalog`
- [x] T-B15 · Población con contexto completo: `context_key` incluye sede/rival/descanso; con `opponent` el rival sale de la población; `context_label` acorde
- [ ] T-B16 · `sample_level` para `split` (umbral 15/40, K = 20)
- [ ] T-B17 · `ui.last_competition`
- [x] T-C1 · `api.contextOptions`
- [🔶] T-C2 · `contextParams()` se agrega a perfil/métricas/tablas/ON-OFF/quinteto de Equipo y Jugador (no hay `contextToQuery` único todavía)
- [x] T-D1 · `core/context.js` (URL > sesión; `getContext`, `setContext`, `clearContext`, `contextParams`, `dropInvalid`)
- [x] T-D2 · `components/context-bar.js` (Sede, Rival, Descanso, "Limpiar filtros", contador)
- [🔶] T-D3 · Montada en Equipo y Jugador
- [ ] T-D4 · Liga / Comparar / Explorar
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
| CA-3 | ⬜ | nivel evento |
| CA-4 | ⬜ | nivel evento |
| CA-5 | ⬜ | nivel evento |
| CA-6 | ⬜ | nivel evento |
| CA-7 | ✅ | `rankings/team/oer?last=…`/`venue=local`: `context_label` de la población y mismo contexto que la ficha |
| CA-8 | ✅ | `opponent=STO`: STO ya no es miembro de la población; solo quedan los equipos que lo enfrentaron |
| CA-9 | ✅ | Fechas editadas en la copia de la base: `rest=0` deja solo el segundo partido en días consecutivos; el primero cuenta en `games_excluded.sin_partido_previo` |
| CA-10 | ⬜ | `split` pendiente |
| CA-11 | ✅ | `clock=temprano` y `quarter=4` → 200 con `context.ignored` (`requiere_posesiones` / `no_implementado`); la barra no los ofrece (`available: false`) |
| CA-12 | ✅ | `venue=casa`, `rest=7`, `opponent=ZZZZ`, `last=0` → 400 `contexto_invalido` con `details.param` |
| CA-13 | ⬜ | clutch/lineup/onoff legacy todavía no informan `ignored` |
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
- **Alcance en dos cortes:** este corte cubre el nivel partido; el nivel evento (`quarter`, `score`, `on`, `off`) se valida pero se informa en `ignored` con razón `no_implementado` (razón nueva, no está en el plan).
- **Sin router X-01:** la barra vive dentro de `team-main` / `player-main` y el estado va en `?venue=&opponent=&rest=` (no en el hash).
- **`dimensions`:** 13 entradas (el plan decía 12: `on` y `off` aparecen por separado).
- **Selección vacía:** `/api/metrics/*` responde 404 `sin_partidos` en vez de métricas nulas; la UI lo traduce al estado vacío.
- **Shot-zones y Cierres:** no aplican el contexto todavía; la nota bajo la barra lo avisa.
- **`rest.py`:** módulo nuevo propuesto por el plan (§10).
- **Contexto y `last`:** `last` sigue en las pills de Equipo (Jugador no las tiene).

## Docs actualizados
- ✅ `docs/api.md` — `GET /api/context/options` y parámetros `venue`, `opponent`, `rest`
- ✅ `docs/architecture.md` — `context.py` ampliado y `rest.py`
- ✅ `docs/frontend.md` — barra de contexto

## Deuda / TODO
- Nivel evento: `_event_states`, `event_predicate`, `quarter`/`score`/`on`/`off`, `context.close_margin`, entidad `split`, umbrales de muestra de split (T-B5…B8, B14, B16).
- Liga / Comparar / Explorar con la barra; tablas `league_teams`, `search_players`.
- Contexto en shot-zones, `/api/league` y los endpoints legacy de lineup/onoff/clutch.
- `ui.last_competition` (T-B17).
- `t()` para el copy (F-21).
