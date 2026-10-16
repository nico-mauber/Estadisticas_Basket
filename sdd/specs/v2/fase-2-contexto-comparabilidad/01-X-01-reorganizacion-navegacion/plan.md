# Plan — X-01: Reorganización de la navegación en secciones y pestañas

> **ID:** X-01 (provisional — confirmar con el cliente) · **Prioridad:** P1 (propuesta) · **Fase y orden:** Fase 2 · 01
> **Depende de:** Fase 1 cerrada ([F-11](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md), [F-13](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md), [C-08](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md), [T-06](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md), [C-03](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md), [C-11](../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/plan.md)) · **Habilita:** T-03, F-16, F-08, F-05, F-04, F-17, F-07, F-20, F-12, F-21
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · [Arquitectura](../../00-arquitectura-transversal.md) §3.12, §3.13, §8
> **Estimación:** XL · 24–34 h

## 1. Enfoque
Frontend puro, sin backend ni esquema. (1) Se crea `core/router.js`, dueño del hash `#/<sección>/<id>/<pestaña>?<query>`,
con un registro de secciones y pestañas con bandera `enabled` (Arquitectura §3.12, §8). (2) Se muda el monolito
`app.js` a módulos ES por sección en `views/` (DA-22): cada vista registra su sección y sus pestañas y exporta funciones
`render`. El código se **mueve**, no se reescribe: las funciones actuales (`renderTeam`, `_renderTeamContent`,
`renderTeamOnOff`, etc.) se parten por pestaña conservando su HTML y su lógica. (3) Se crean `components/tabs.js` y
`components/collapsible.js`. (4) La barra de navegación se genera desde el registro (desktop: todas; móvil: 4 por prioridad
+ "Más"). (5) El service worker pasa a runtime caching para que los módulos nuevos funcionen offline sin mantener
`STATIC` a mano. `app.js` queda con arranque, login, layout y router.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `frontend/js/core/router.js` | NUEVO js-core | Parseo/escritura del hash, registro de secciones/pestañas, `hashchange`, redirecciones, sección inicial, rutas legado | RF-1, RF-2, RF-3, RF-4, RF-13, RF-15, RF-16, RF-17 |
| `frontend/js/core/ui.js` | NUEVO js-core — PROPUESTA (no está en 00-arquitectura-transversal.md) | Helpers de UI compartidos que hoy están en `app.js`: `toast`, `loadingHTML(msg)`, `emptyHTML(msg)`, `errorHTML(err)`, `offlineAware(err)` | RF-10, RF-15, RF-18 |
| `frontend/js/views/_shared.js` | NUEVO js-view — PROPUESTA (no está en 00-arquitectura-transversal.md) | Helpers legados compartidos entre vistas movidos tal cual desde `app.js`: `statClass`, `statBox`, `_computeAvg`, `_logComps`, `_filterByComp`, `_compOptions`, `_fourFactorsCard`, `_recordCard`, `_fmtDate`, `_filteredLog` (solo los que sigan vivos al cierre de fase 1) | RF-10 |
| `frontend/js/components/tabs.js` | NUEVO component | `renderTabs(el, tabs, activeSlug, onChange)` | RF-7, RF-8, RF-12 |
| `frontend/js/components/collapsible.js` | NUEVO component | `collapsible(el, {panelId, title, defaultOpen})` con prefs `panel.collapsed` | RF-20 |
| `frontend/js/components/nav.js` | NUEVO component — PROPUESTA (no está en 00-arquitectura-transversal.md) | Dibuja la barra de secciones desde el registro y la hoja "Más" | RF-1, RF-11 |
| `frontend/js/views/datos.js` | NUEVO js-view | S1: `importar` (de `renderImport`), `partidos` (de `_gamesTable`, `_showDeleteModal`, handlers de selección/paginación), `calidad`/`competencias` (componentes de F-11), `exportar` (botón de T-06) | RF-5, RF-10 |
| `frontend/js/views/liga.js` | NUEVO js-view | S2: `tabla` (C-09 `_standingsCardHTML`), `ranking` (tabla `league_teams` de T-06), `mapa` (`_drawLeagueMap`, `LEAGUE_MAPS`) | RF-6, RF-14 |
| `frontend/js/views/equipo.js` | NUEVO js-view | S3: selector + pestañas `resumen`, `tiro`, `quintetos`, `momentos`, `gamelog` (de `renderTeam`, `_renderTeamContent`, `renderTeamShotmapTeam`, `renderTeamShotmap`, `renderTeamOnOff`, `renderTeamLineup`, `renderTeamClutch`, `_renderUsageRanking`) | RF-7, RF-13, RF-14 |
| `frontend/js/views/jugador.js` | NUEVO js-view | S4: selectores + pestañas `resumen`, `tiro`, `distribucion`, `impacto`, `gamelog` (de `renderPlayer`, `_renderPlayerContent`; ON/OFF reutiliza el render de `equipo.js`) | RF-8, RF-13 |
| `frontend/js/views/comparar.js` | NUEVO js-view | S6: `equipos` (de `renderCompare`, `refreshCompareSelectors`), ids en query `a`, `b` | RF-9 |
| `frontend/js/views/explorar.js` | NUEVO js-view | S7: `jugadores` (de `renderSearch`, `_applySearch`, `_renderSearchResults` o la tabla `search_players` de T-06) | RF-9, RF-14 |
| `frontend/js/views/configuracion.js` | NUEVO js-view | S9: pestañas `umbrales`, `contexto`, `momentum`, `preferencias` sobre la vista de F-13 (filtra `spec_json` por `section`) | RF-9 |
| `frontend/js/views/partido.js` | NUEVO js-view (cáscara) | Registra S5 con `enabled: false` y sus modos `analizar`, `vivo`, `momentum`, `preparar` | RF-2 |
| `frontend/js/views/mi-equipo.js` | NUEVO js-view (cáscara) | Registra S8 con `enabled: false` | RF-2 |
| `frontend/js/app.js` | js-view (edit) | Queda: `boot`, `showLogin`, `renderApp` (header + contenedor de nav + `<main id="view">`), import de las vistas, arranque del router; se eliminan los bloques movidos | RF-1, RF-3, RF-16 |
| `frontend/js/api.js` | js-api (sin cambios de métodos) | Se verifica que todas las vistas usen solo `api.*` (regla 9) | — |
| `frontend/css/style.css` | css (edit) | Secciones nuevas: `/* ── nav + hoja Más (X-01) ── */`, `/* ── tabs (X-01) ── */`, `/* ── collapsible (X-01) ── */`; se ajusta `nav` a N botones | RF-11, RF-12, RF-20 |
| `frontend/index.html` | html (edit mínimo) | Sin cambios de scripts (ya carga `app.js` como módulo); `<main>` se genera en `renderApp` | — |
| `frontend/sw.js` | sw (edit) | Runtime caching; `CACHE` al siguiente entero (asignado al integrar, p. ej. `smart-basket-v1N`) | RF-18 |
| `docs/frontend.md` | doc (al cierre) | Reescribir §Vistas (9 secciones, pestañas, rutas), §`app.js`, estructura `core/components/views`, §Service Worker; corregir D-03 | RF-3, RF-18 |
| `docs/architecture.md` | doc (al cierre) | Vistas del frontend (D-21) y módulos ES | RF-1 |

**Matriz RF → archivo:** RF-1 router, nav, app · RF-2 router, partido, mi-equipo, vistas · RF-3 router, app · RF-4 router ·
RF-5 datos · RF-6 liga · RF-7 equipo, tabs · RF-8 jugador, tabs · RF-9 comparar, explorar, configuracion · RF-10 todas las
vistas, `_shared`, `ui` · RF-11 nav, style.css · RF-12 tabs, style.css · RF-13 router, equipo, jugador · RF-14 liga,
explorar, equipo · RF-15 router, ui · RF-16 router · RF-17 router · RF-18 sw.js, ui · RF-19 todas (vía `t()`) · RF-20
collapsible.

## 3. Backend — rutas y modelos
Sin cambios. No hay endpoints nuevos ni tocados; no hay tablas ni columnas. Flask sigue sirviendo `/` (`index`) y los
estáticos; el hash no llega al servidor.

## 4. Backend — lógica
Sin cambios de backend. La lógica nueva es de frontend y se detalla en §6/§7.

## 5. Frontend — capa API (api.js)
Sin métodos nuevos. Métodos que usa X-01 directamente: `api.me()`, `api.games()` (sección inicial), `api.teams()`,
`api.players(code)` (selector de S4 con `player_id`, C-08), `api.prefs(scope)` / `api.savePref(scope, key, value)` (F-13, vía
`core/prefs.js`). Todas las vistas movidas siguen llamando los mismos métodos que hoy; ningún `fetch()` fuera de `api.js`.

## 6. Frontend — UI

### 6.1 `core/router.js` (firma de Arquitectura §8)
```
registerSection({slug, label, icon, priority, enabled, defaultTab, needsId, idLabel})   // label vía t()
registerTab(section, {slug, label, enabled, render, order})
    render(el: HTMLElement, route: {section, id, tab, query}) -> Promise<void> | void
parseHash(hash = location.hash) -> {section, id, tab, query: URLSearchParams-like objeto plano}
navigate(section, {id, tab, query, replace = false})   // escribe location.hash (replace → history.replaceState)
onRoute(fn)                                             // suscriptores (nav, context-bar de T-03)
enabledSections() -> [secciones habilitadas ordenadas por # (S1..S9)]
mobileSections() -> {primary: [≤4 por priority], more: [resto]}
start({initialSection})                                 // listener hashchange + primer render
```
- **Formato**: `#/<section>[/<id>][/<tab>][?<query>]`. Reglas de parseo:
  1. Quitar `#` y el `/` inicial; separar `?`. `query` → objeto (claves repetidas: último valor; valores CSV quedan como
     string, T-03 los interpreta).
  2. Segmentos: `[section, a, b]`. Si la sección tiene `needsId` (equipo, jugador, partido): `id = a`, `tab = b`. Si no:
     `tab = a`. Excepción: `#/partido/preparar?...` (modo sin id, F-03) — se resuelve porque `preparar` está registrado
     como pestaña "sin id"; X-01 deja el caso en el parser (`tab` reconocido en la posición del id).
  3. `id` de equipo: `team_code` en mayúsculas; de jugador: entero (`player_id` de C-08); de quinteto (futuro):
     `<team_code>:<pid>-<pid>-…`.
- **Resolución** (`_resolve(route)`), en orden:
  1. Hash vacío → `initialSection()` (RF-16): `api.games()`; lista vacía → `datos/importar`; si no → `liga/tabla`; si S8 está
     habilitada → `mi-equipo` (lo activará F-12). `replace = true`.
  2. Hash legado sin `/` (RF-17): mapa `{import: "datos/importar", league: "liga/tabla", team: "equipo", compare:
     "comparar/equipos", player: "jugador", search: "explorar/jugadores"}` → `navigate(..., {replace: true})`.
  3. Sección inexistente o `enabled: false` → toast `t('nav.aviso.seccion_no_disponible', 'Esa sección no existe o todavía no
     está disponible.')` + sección inicial (replace).
  4. Sección con `needsId` y sin id → render del selector de la vista (`view.renderPicker(el, route)`).
  5. Pestaña ausente → `defaultTab` de la sección (replace, conservando id y query). Pestaña inexistente o deshabilitada →
     toast `t('nav.aviso.pestana_no_disponible', 'Esa pestaña todavía no está disponible.')` + `defaultTab` (replace).
  6. Render: la vista dibuja la cabecera de entidad + `renderTabs(...)` + `tab.render(el, route)`.
- **Historial** (RF-4): cada `navigate` sin `replace` agrega una entrada (asignar `location.hash`). Las correcciones
  automáticas usan `history.replaceState(null, "", url)` + render manual (no dispara `hashchange`) para no crear pasos
  basura.
- **Conservación** (RF-13): helper `withQuery(patch, {dropEntity = false})`: al cambiar de pestaña se copia `query` entera;
  al cambiar de sección se copia `query` sin `on`/`off` (claves de T-03 propias de la entidad). La última entidad de S3/S4 se
  guarda en `sessionStorage` (`sb.last.equipo`, `sb.last.jugador`, con try/catch); al entrar a S3/S4 sin id y con
  entidad recordada → `navigate(section, {id: recordado, tab: defaultTab, replace: true})`.
- **Re-render**: solo cambia lo necesario. Si cambia `section` o `id` → re-render de toda la vista; si cambia solo `tab` →
  re-render del contenedor de la pestaña; si cambia solo `query` → la vista decide (en X-01: re-render de la pestaña
  activa, porque los filtros actuales se leen de la query — ver 6.4).
- Evita dobles render: bandera `_renderSeq` (contador); un render que termina después de otro más nuevo no escribe en el
  DOM (el patrón protege también de respuestas lentas de `api.*`).

### 6.2 Registro de secciones (valores de Arquitectura §3.12)
| slug | label | icon | priority (móvil) | needsId | defaultTab | enabled en X-01 | pestañas habilitadas en X-01 |
|---|---|---|---|---|---|---|---|
| `datos` | Datos | 📥 | 8 | no | `importar` | sí | `importar`, `partidos`, `calidad`, `competencias`, `exportar` |
| `liga` | Liga | 🏆 | 5 | no | `tabla` | sí | `tabla`, `ranking`, `mapa` |
| `equipo` | Equipo | 🛡️ | 3 | sí (`team_code`) | `resumen` | sí | `resumen`, `tiro`, `quintetos`, `momentos`, `gamelog` |
| `jugador` | Jugador | 👤 | 4 | sí (`player_id`) | `resumen` | sí | `resumen`, `tiro`, `distribucion`, `impacto`, `gamelog` |
| `partido` | Partido | 🏀 | 2 | sí (`game_id`) | `analizar` | **no** | — |
| `comparar` | Comparar | ⚖️ | 6 | no | `equipos` | sí | `equipos` |
| `explorar` | Explorar | 🔎 | 7 | no | `jugadores` | sí | `jugadores` |
| `mi-equipo` | Mi equipo | ⭐ | 1 | no | — | **no** | — |
| `configuracion` | Configuración | ⚙️ | 9 | no | `umbrales` | sí | las que tengan claves en `spec_json` |

Las pestañas no habilitadas se registran igual con `enabled: false` (para que el router distinga "no disponible" de
"inexistente") en el orden de §3.12. Cada requisito posterior cambia `enabled` a `true` en su vista y le da `render`.

### 6.3 Barra de navegación (`components/nav.js`, RF-11)
- `renderNav(el, route)`: si `matchMedia('(min-width: 768px)')` → botones de `enabledSections()` en orden S1…S9. Si no →
  `mobileSections()`: `primary` = las 4 habilitadas de menor `priority`; `more` = resto en orden S1…S9. Con la fase 2:
  primary = Equipo (3), Jugador (4), Liga (5), Comparar (6); more = Datos, Explorar, Configuración. Si `more` queda vacío,
  no se dibuja "Más".
- Botón "Más" (`t('nav.mas', 'Más')`, ícono ☰): abre una hoja inferior (`.nav-sheet`, `role="dialog"`, `aria-modal`) con
  los ítems de `more`; se cierra al elegir, al tocar el fondo o con Escape. Si la sección activa está en `more`, el botón
  "Más" se marca activo.
- Re-dibuja en `onRoute` y en `change` del `matchMedia` (rotación de pantalla).
- El engranaje de F-13 en el header se elimina (S9 pasa a la barra; en móvil, dentro de "Más").

### 6.4 Vistas (mudanza pestaña por pestaña)
Regla general: cada `render` recibe `(el, route)` y dibuja en `el` exactamente el HTML que hoy produce la función de
origen; los `id` de DOM se conservan cuando son únicos dentro de la pestaña (evita reescribir handlers). Los selectores de
filtro existentes (competencia, pills "Últ. N") leen su valor inicial de `route.query.competition` / `route.query.last` y,
al cambiar, llaman `navigate(section, {id, tab, query: {...query, competition, last}})` (nombres de parámetro de
Arquitectura §3.8) en lugar de guardar el estado en variables de módulo (`_teamComp`, `_teamLastN`, `_leagueComp`,
`_playerComp`). Así los deep links reproducen los filtros actuales (CA-3) hasta que T-03 centralice el estado en
`core/context.js`.

**S1 `views/datos.js`**
- `importar`: formulario de URL y botón seed (`_seedEnabled` pasa a leerse de `appState.me.seed_enabled`; `appState` es
  un objeto exportado por `app.js` con la respuesta de `api.me()`; ver §10 R-2).
- `partidos`: `_gamesTable(games, page)`, paginación, modo selección y `_showDeleteModal` (con el ajuste de D-19 ya hecho
  por C-11). Tras importar o borrar: `refreshTeamSelector`/`refreshCompareSelectors` ya no existen como globales → las
  vistas S3/S6 recargan sus listas al entrar (cada render llama `api.teams()`).
- `calidad`, `competencias`: montan los componentes que F-11 creó para sus pestañas internas de Importar, sin cambios.
- `exportar`: monta el botón/diálogo de exportación masiva de T-06.

**S2 `views/liga.js`**: `tabla` = card de tabla general (C-09); `ranking` = tabla completa `league_teams` (T-06) con clic
de fila → `navigate('equipo', {id: code, tab: 'resumen'})`; `mapa` = selector `LEAGUE_MAPS` + `drawLeagueScatter` +
reset de zoom. El selector de competencia se muestra una sola vez arriba de las pestañas (compartido).

**S3 `views/equipo.js`**
- `renderPicker(el, route)`: `api.teams()` → `<select>` "— Seleccionar equipo —"; al elegir → `navigate('equipo', {id,
  tab: 'resumen', query})`. Estados: "Cargando equipos…", vacío con enlace a Datos, error.
- Cabecera de entidad (siempre visible sobre las pestañas): nombre del equipo, selector para cambiar de equipo (misma
  pestaña), selector de competencia y pills "Todos · Últ. 5 · Últ. 3" existentes.
- Carga compartida: `loadTeam(code, query)` memoriza la última respuesta de `api.team(code, …)` por `(code, query)` para
  que cambiar de pestaña no repita la petición (caché en memoria del módulo, se invalida al cambiar código o query).
- `resumen`: récord, bloque de conjunto estándar/fichas (T-05/T-01), four factors, cards Eficiencia/Tiro/Rebotes & Misc/
  Defensa avanzada tal como queden tras T-01, Desglose ofensivo, radar "Perfil de equipo", "Evolución por partido",
  "Jugadores más influyentes — USO%" (clic → `navigate('jugador', {id: player_id, tab: 'resumen'})`).
- `tiro`: `renderTeamShotmapTeam` (mapa del equipo, C-03) + selector de jugador del equipo y botón "Ver mapa de tiro" →
  `renderTeamShotmap` debajo + detalle T2/T3/TL (C-07).
- `quintetos`: card "Combinaciones (Lineups)" con el multi-select y "Analizar combinación" (`renderTeamLineup`) + selector de
  jugador y "Ver ON/OFF" (`renderTeamOnOff`).
- `momentos`: `renderTeamClutch` (cierres, título leído de `margin`/config).
- `gamelog`: tabla `team_game_log` (T-06) o la card "Game log" actual si T-06 no la migró.
- Botón "Ver jugador" desaparece de los controles: su función la cubren los enlaces de USO% y de las tablas a S4 (RF-14);
  el selector de jugador de las pestañas Tiro/Quintetos sigue siendo local a esas pestañas.

**S4 `views/jugador.js`**
- `renderPicker`: selector de equipo (`api.teams()`) → selector de jugador (`api.players(code)` → `player_id`, nombre) →
  `navigate('jugador', {id: player_id, tab: 'resumen'})`.
- Carga compartida: `api.playerById(player_id, params)` (método de C-08 para `GET /api/player/<int:player_id>`; si C-08
  lo nombró distinto, se usa ese nombre) memorizado por `(id, query)`.
- `resumen`: Producción ofensiva, Tiro, Defensa avanzada, radar "Perfil de jugador", "Evolución por partido" y el bloque
  estándar de T-05 si lo hay. `tiro`: shot chart por zonas (C-03) y detalle T2/T3/TL. `distribucion`: card "Rebotes &
  distribución" (C-01). `impacto`: +/- (del estándar) + ON/OFF del jugador reutilizando el render de `equipo.js`
  (`renderOnOffPanel(el, team_code, player)` exportado). `gamelog`: tabla `player_game_log` (T-06) o la card actual.

**S6 `views/comparar.js`**: `equipos` con `?a=<code>&b=<code>`: si ambos están en la query se compara al entrar (deep link);
el botón "Comparar" hace `navigate('comparar', {tab: 'equipos', query: {...query, a, b}})`.

**S7 `views/explorar.js`**: `jugadores` = buscador actual (o tabla `search_players` de T-06); clic de fila →
`navigate('jugador', {id: player_id, tab: 'resumen'})`. El título pasa de "Buscador de jugadores" a mantenerse igual (la
sección se llama "Explorar"; la pestaña "Jugadores").

**S9 `views/configuracion.js`**: toma el render de F-13 y lo filtra por `section` de `spec_json()`: `umbrales` ↔ sección
"Umbrales", `contexto` ↔ "Reglas de contexto", `momentum` ↔ "Reglas de Momentum", `preferencias` ↔ "Preferencias".
`enabled` de cada pestaña = hay al menos una clave con esa sección (se calcula al primer `api.settings()`; hasta entonces
se muestran las tres de fase 1). Permisos y guardado sin cambios (F-13).

### 6.5 `components/tabs.js`
`renderTabs(el, tabs, activeSlug, onChange)`: `tabs = [{slug, label}]` (solo habilitadas). Dibuja
`<div class="tabs" role="tablist">` con `<button role="tab" aria-selected>`; `onChange(slug)` →
`navigate(section, {id, tab: slug, query})`. Al dibujar hace `scrollIntoView({inline: 'center', block: 'nearest'})` de la
activa (RF-12). CSS: `display:flex; overflow-x:auto; scrollbar-width:none; white-space:nowrap; gap`; activa con borde
inferior `--accent`; en ≥768 px sin scroll si entran.

### 6.6 `components/collapsible.js`
`collapsible(el, {panelId, title, defaultOpen = true})`: envuelve el contenido de `el` en `<details>`-like propio
(botón con `aria-expanded`); estado inicial = `getPref('panel.collapsed', panelId, !defaultOpen)` de `core/prefs.js`
(F-13); al alternar → `setPref('panel.collapsed', panelId, collapsed)` (servidor + copia local; si falla, solo sesión).
En X-01 se usa en S3 › Resumen para "Desglose ofensivo" (`panelId: 'equipo.desglose'`), como primer consumidor
verificable del CA-14; F-17 y F-12 lo reutilizan.

### 6.7 Estados y móvil
- Carga/vacío/error/offline con `core/ui.js`: `loadingHTML(t('comun.cargando', 'Cargando…'))`; error de red
  (`TypeError: Failed to fetch` o `navigator.onLine === false`) → `t('comun.sin_conexion', 'Sin conexión: no se pueden
  cargar los datos.')`; otros errores → mensaje del backend (`err.message`, ya en español).
- 768 px: barra inferior con 5 botones como máximo (4 + Más) → ancho mínimo 72 px por botón en 360 px; pestañas en fila
  desplazable; cabecera de entidad en dos líneas (nombre / selectores) bajo 480 px.

## 7. Navegación
Mapa final de vistas para `docs/frontend.md` (reemplaza la tabla de §Vistas): las 22 filas de la tabla de reubicación del
spec §5 + las secciones/pestañas registradas deshabilitadas. Rutas de Arquitectura §3.12, sin cambios:
`#/datos/<pestaña>`, `#/liga/<pestaña>`, `#/equipo/<team_code>/<pestaña>`, `#/jugador/<player_id>/<pestaña>`,
`#/partido/<game_id>/<modo>` y `#/partido/preparar?team=&rival=` (deshabilitadas), `#/comparar/<pestaña>?a=&b=`,
`#/explorar/<pestaña>`, `#/mi-equipo` (deshabilitada), `#/configuracion/<pestaña>`. Query con los nombres de §3.8
(`competition`, `last` en X-01; T-03/T-04 agregan el resto).

## 8. Contratos de datos
Sin JSON nuevo. Contrato interno de ruta:
```json
{"section": "equipo", "id": "CNF", "tab": "quintetos", "query": {"competition": "3", "last": "5"}}
```
Registro (objeto interno de `router.js`):
```json
{"slug": "equipo", "label": "Equipo", "icon": "🛡️", "priority": 3, "enabled": true, "needsId": true,
 "defaultTab": "resumen",
 "tabs": [{"slug": "resumen", "label": "Resumen", "enabled": true, "order": 1},
          {"slug": "plantel", "label": "Plantel", "enabled": false, "order": 7}]}
```
Preferencia de panel plegable: `PUT /api/prefs {"scope": "panel.collapsed", "key": "equipo.desglose", "value": true}` (F-13).

## 9. Manejo de errores y offline
- Errores HTTP en las pestañas: los mismos que hoy (401 → login por `setUnauthorizedHandler`; 404 de equipo/jugador →
  aviso de RF-15 y selector; 400/502 → toast con `err.message`).
- **Service worker (RF-18)**: nueva estrategia en `sw.js`:
  - `install`: pre-cachea el mínimo (`/`, `/manifest.json`, `/css/style.css`, `/js/app.js`, `/js/api.js`,
    `/js/charts.js`, `/js/chart.umd.min.js`) + `/js/core/router.js` y las vistas, para que la primera carga offline
    tenga la cáscara completa.
  - `fetch`: `/api/*` → red siempre (sin cambios). Peticiones `GET` same-origin no-API → cache-first; si no está, red y se
    **guarda** una copia (`cache.put`) cuando `response.ok` y `response.type === 'basic'`. Peticiones a otros orígenes
    (CDN de hammerjs/zoom, Google Fonts) → red con fallback a caché si existe (sin guardarlas por defecto).
  - `activate`: borra cachés viejas (sin cambios).
  - `CACHE` sube al siguiente entero al integrar (Arquitectura §3.13).
- Navegación offline: `navigate` no depende de red; cada pestaña muestra su estado offline.

## 10. Riesgos / decisiones
- **R-1 Regresiones por la mudanza** (≈1.900 líneas repartidas en 9 módulos; sin test suite — Arquitectura R-06). Mitigación:
  mover por bloques en orden (helpers → S1 → S2 → S6 → S7 → S3 → S4 → S9), arrancando la app entre bloque y bloque, y el
  recorrido de las 22 filas de reubicación (CA-5) como checklist en `progress.md`.
- **R-2 Estado global implícito**: `app.js` usa variables de módulo compartidas entre vistas (`_teamData`, `_teamLastN`,
  `_teamComp`, `_leagueComp`, `_playerComp`, `_seedEnabled`, `_authRequired`, `_authUser`, `selectMode`,
  `selectedGames`, `importPage`). Decisión: los filtros pasan a la query (6.4); los datos de sesión (`me`) a un objeto
  `appState` exportado por `app.js` y leído por las vistas; el estado de selección del catálogo queda local a
  `datos.js`.
- **R-3 Conflictos con trabajo paralelo de fase 2** (T-03, F-16, F-08 editan las mismas vistas): X-01 va primero en la fase
  (orden 01) y deja una vista por archivo, lo que reduce los choques posteriores (Arquitectura R-07).
- **R-4 Dependencias de CDN** (hammerjs, chartjs-plugin-zoom, Google Fonts) no se cachean por defecto: offline el mapa de
  liga pierde zoom. Se acepta (sin cambio respecto de hoy).
- **Decisión: ocultar pestañas no habilitadas** (spec §9) en lugar de "próximamente".
- **Decisión: sección inicial** Datos/Liga (spec §9, RF-16).
- **Decisión: pestañas de S9 desde `spec_json`** (una pestaña sin claves no se muestra).
- **Desviaciones respecto de la arquitectura**: ninguna de contrato. Se agregan tres piezas no listadas en §8 de la
  arquitectura, marcadas PROPUESTA: `core/ui.js` (toast y estados), `views/_shared.js` (helpers legados compartidos) y
  `components/nav.js` (barra + hoja "Más"). Motivo: sin ellas, la mudanza a módulos obligaría a duplicar helpers entre
  vistas (regla 9) o a dejarlos en `app.js` con imports circulares (`app.js` importa las vistas y las vistas importarían
  `app.js`).
- **Dependencias técnicas**: `core/i18n.js` `t()` y `core/format.js` (C-11,
  [plan](../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/plan.md)); `core/prefs.js` `getPref/setPref` y la vista de
  configuración (F-13, [plan](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)); pestañas internas de Importar,
  `GET /api/games` con estado y `is_admin` (F-11, [plan](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md));
  `player_id` en `/api/players/<team_code>` y `GET /api/player/<int:player_id>` (C-08,
  [plan](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)); tablas `league_teams`, `team_game_log`,
  `player_game_log`, `search_players` y exportación masiva (T-06,
  [plan](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)); `components/shot-chart.js` (C-03,
  [plan](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)); `components/standard-panel.js` (T-05),
  `metric-card.js` (T-01), `sample-badge.js` (T-02) — se montan sin cambios.
- **Incrementos diferidos**: enlace catálogo/game log → S5 (→ F-07); S8 como inicio (→ F-12); Preparar desde calendario
  (→ F-12, F-03). Tratamiento: bandera `enabled` y tareas del grupo G (diferido).
- **Estimación:** XL · 24–34 h (router + registro 5–7 h; mudanza de S1/S2/S6/S7/S9 6–8 h; S3/S4 con pestañas 7–10 h; nav
  móvil + tabs + collapsible + CSS 3–4 h; service worker 1–2 h; verificación de 22 reubicaciones + docs 2–3 h).
