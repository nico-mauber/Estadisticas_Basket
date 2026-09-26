# Tasks — X-01: Reorganización de la navegación en secciones y pestañas

> **ID:** X-01 (provisional) · **Prioridad:** P1 (propuesta) · **Fase y orden:** Fase 2 · 01
> **Depende de:** Fase 1 cerrada · **Habilita:** T-03, F-16, F-08, F-05, F-04, F-17, F-07, F-20, F-12, F-21
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- (sin tareas: X-01 no toca backend ni esquema)

### Grupo B — Frontend: núcleo de navegación
- [ ] T-B1 · Crear `core/router.js` con `registerSection`, `registerTab`, `parseHash`, `navigate`, `onRoute`, `enabledSections`, `mobileSections`, `start` (plan §6.1) · `frontend/js/core/router.js` · cubre RF-1, RF-3, RF-4 · Done: en consola, `parseHash('#/equipo/CNF/tiro?competition=3')` devuelve `{section:'equipo', id:'CNF', tab:'tiro', query:{competition:'3'}}` y `parseHash('#/partido/preparar?team=A&rival=B')` devuelve `tab:'preparar'` sin id
- [ ] T-B2 · Resolución de rutas: hash vacío → sección inicial, hashes legado, sección/pestaña inexistente o deshabilitada, sección sin id → picker, `replaceState` en correcciones (plan §6.1 "Resolución") · `core/router.js` · cubre RF-15, RF-16, RF-17 · Done: `#search` termina en `#/explorar/jugadores` sin entrada extra en el historial
- [ ] T-B3 · Conservación de query entre pestañas/secciones (sin `on`/`off` al cambiar de sección) y última entidad de S3/S4 en `sessionStorage` con try/catch · `core/router.js` · cubre RF-13 · Done: cambiar de Equipo a Liga conserva `competition`; volver a Equipo sin id abre el último equipo
- [ ] T-B4 [P] · Crear `core/ui.js` (PROPUESTA) con `toast`, `loadingHTML`, `emptyHTML`, `errorHTML`, `offlineAware` movidos/derivados de `app.js` · `frontend/js/core/ui.js` · cubre RF-15, RF-18 · Done: `toast` funciona importado desde una vista
- [ ] T-B5 [P] · Crear `components/tabs.js` (`renderTabs`) con fila desplazable y activa visible · `frontend/js/components/tabs.js` · cubre RF-12 · Done: en 360 px la activa queda visible tras render
- [ ] T-B6 [P] · Crear `components/collapsible.js` con estado en prefs `panel.collapsed` (vía `core/prefs.js`) · `frontend/js/components/collapsible.js` · cubre RF-20 · Done: alternar un panel hace `PUT /api/prefs` con scope `panel.collapsed` (pestaña Network)
- [ ] T-B7 · Crear `components/nav.js` (PROPUESTA): barra desktop con todas las habilitadas; móvil 4 por prioridad + "Más" con hoja accesible; re-dibujo en `onRoute` y `matchMedia` · `frontend/js/components/nav.js` · cubre RF-1, RF-11 · Done: en 360 px se ven Equipo, Jugador, Liga, Comparar y "Más"
- [ ] T-B8 · Mover helpers compartidos a `views/_shared.js` (PROPUESTA) sin cambiar su lógica · `frontend/js/views/_shared.js` · cubre RF-10 · Done: `grep -n "function _computeAvg" frontend/js/app.js` sin resultados y las vistas los importan

### Grupo C — Frontend: api.js
- [ ] T-C1 · Verificar que ningún módulo nuevo use `fetch()` fuera de `api.js` y que el método de perfil por id de C-08 exista · `frontend/js/api.js` · cubre RF-10 · Done: `grep -rn "fetch(" frontend/js --include=*.js` solo muestra `api.js`

### Grupo D — Frontend: vistas (mudanza por sección)
- [ ] T-D1 · `views/datos.js`: registrar S1 y pestañas; mover `renderImport` (importar), `_gamesTable`/paginación/selección/`_showDeleteModal` (partidos), montar pestañas de F-11 (calidad, competencias) y botón masivo de T-06 (exportar) · `frontend/js/views/datos.js` · cubre RF-5 · Done: las 5 pestañas funcionan como antes (importar un partido, paginar, borrar con modal)
- [ ] T-D2 · `views/liga.js`: registrar S2; pestañas `tabla` (C-09), `ranking` (T-06 `league_teams`), `mapa` (`LEAGUE_MAPS`, `drawLeagueScatter`, reset); selector de competencia compartido leído de/escrito en la query; clic de fila → S3 · `frontend/js/views/liga.js` · cubre RF-6, RF-14 · Done: `#/liga/mapa?competition=<id>` dibuja el scatter de esa competencia
- [ ] T-D3 · `views/comparar.js`: registrar S6 `equipos`; `a`/`b` en la query; comparar al entrar si ambos están · `frontend/js/views/comparar.js` · cubre RF-9 · Done: `#/comparar/equipos?a=<A>&b=<B>` muestra el radar sin tocar botones
- [ ] T-D4 · `views/explorar.js`: registrar S7 `jugadores`; mover el buscador; clic de fila → `#/jugador/<player_id>/resumen` · `frontend/js/views/explorar.js` · cubre RF-9, RF-14 · Done: clic en un jugador cambia el hash a su `player_id`
- [ ] T-D5 · `views/equipo.js` — picker y cabecera de entidad (selector de equipo, competencia, pills Últ. N desde la query) + caché `loadTeam(code, query)` · `frontend/js/views/equipo.js` · cubre RF-7, RF-13 · Done: cambiar de pestaña no repite `GET /api/team/<code>` (Network)
- [ ] T-D6 · `views/equipo.js` — pestaña `resumen` (récord, estándar/fichas, four factors, cards, desglose en `collapsible`, radar, evolución, USO% con enlace a S4) · `views/equipo.js` · cubre RF-7, RF-14, RF-20 · Done: contenido idéntico al scroll anterior para esas cards
- [ ] T-D7 · `views/equipo.js` — pestañas `tiro` (mapa del equipo + mapa de jugador + detalle T2/T3/TL), `quintetos` (combinaciones + ON/OFF; exportar `renderOnOffPanel`), `momentos` (cierres), `gamelog` · `views/equipo.js` · cubre RF-7 · Done: cada pestaña reproduce su apartado anterior
- [ ] T-D8 · `views/jugador.js` — picker equipo → jugador (`player_id`), caché por `(id, query)`, pestañas `resumen`, `tiro`, `distribucion`, `impacto` (+/- y `renderOnOffPanel`), `gamelog` · `frontend/js/views/jugador.js` · cubre RF-8, RF-13 · Done: `#/jugador/<id>/impacto` muestra el ON/OFF del jugador
- [ ] T-D9 · `views/configuracion.js`: registrar S9 con pestañas filtradas por `section` de `spec_json`; quitar el engranaje del header · `frontend/js/views/configuracion.js`, `frontend/js/app.js` · cubre RF-9 · Done: Umbrales, Reglas de contexto y Preferencias visibles; Reglas de Momentum oculta
- [ ] T-D10 [P] · `views/partido.js` y `views/mi-equipo.js` como cáscaras con `enabled: false` y pestañas/modos registrados · `frontend/js/views/partido.js`, `frontend/js/views/mi-equipo.js` · cubre RF-2 · Done: `#/partido/1/analizar` redirige con el aviso de sección no disponible
- [ ] T-D11 · Reducir `app.js` a `boot`, `showLogin`, `renderApp` (header + `#nav` + `<main id="view">`), `appState`, imports de vistas y `router.start()`; borrar los bloques movidos · `frontend/js/app.js` · cubre RF-1, RF-3, RF-16 · Done: `app.js` < 250 líneas y la app arranca sin errores
- [ ] T-D12 · CSS: secciones `nav + hoja Más (X-01)`, `tabs (X-01)`, `collapsible (X-01)`, cabecera de entidad; nav con N botones · `frontend/css/style.css` · cubre RF-11, RF-12 · Done: sin scroll horizontal en 360 px en ninguna sección
- [ ] T-D13 · Todo copy nuevo con `t('nav.…', '…')` / `t('comun.…', '…')` · vistas y componentes nuevos · cubre RF-19 · Done: `grep -n "Esa pestaña todavía" frontend/js` aparece solo dentro de llamadas `t(`

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados de S3/S4 sin entidad, entidad inexistente (404 → aviso + picker), vacío con enlace a Datos, error y offline en cada pestaña (`core/ui.js`) · vistas S3/S4 · cubre RF-15, RF-18 · Done: `#/equipo/NOEXISTE/resumen` muestra "No encontramos ese equipo."
- [ ] T-E2 · `sw.js`: runtime caching de estáticos same-origin (`cache.put` si `ok` y `basic`), `/api/*` a red, pre-caché de router y vistas, `CACHE` al siguiente entero · `frontend/sw.js` · cubre RF-18 · Done: en DevTools › Application › Cache Storage aparecen `/js/views/*.js` tras navegar
- [ ] T-E3 · Protección de renders solapados (`_renderSeq`) en router y cargas de vistas · `core/router.js`, vistas · cubre RF-3 · Done: cambiar rápido entre 3 pestañas deja visible solo la última

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` idempotente: no aplica (sin cambios de esquema); se registra "N/A" en progress
- [ ] T-F3 · Endpoints consumidos probados: `curl -s -b cookies.txt http://localhost:5000/api/teams`, `/api/players/<code>`, `/api/player/<player_id>`, `/api/games`, `/api/me` responden 200 con el shape de fase 1
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer las 7 secciones habilitadas y todas sus pestañas
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress
- [ ] T-F6 · CA-1: abrir `http://localhost:5000/` en desktop (≥1024 px) y comprobar orden y ausencia de Partido y Mi equipo
- [ ] T-F7 · CA-2: S3 → equipo del seed (p. ej. el primer `code` de `/api/teams`) → Quintetos; comprobar hash `#/equipo/<code>/quintetos`; F5 conserva la vista
- [ ] T-F8 · CA-3: copiar `#/equipo/<code>/resumen?competition=<id>&last=5` a una ventana privada, iniciar sesión y abrirla; el selector de competencia y la pill "Últ. 5" están activos y los promedios coinciden con la ventana original
- [ ] T-F9 · CA-4: recorrido Liga › Tabla → fila de equipo (Ranking) → Resumen → Tiro; Atrás ×2 vuelve a Resumen y luego a Liga
- [ ] T-F10 · CA-5: checklist de las 22 filas de la tabla de reubicación (spec §5), una evidencia por fila en progress (acción realizada + resultado)
- [ ] T-F11 · CA-6 y CA-7: DevTools en modo dispositivo 360×740: barra con 4 + "Más"; hoja con Explorar, Datos, Configuración; pestañas de S4 desplazables sin scroll horizontal de página (`document.documentElement.scrollWidth <= innerWidth` en consola)
- [ ] T-F12 · CA-8 y CA-9: abrir `#/equipo/NOEXISTE/resumen`, `#/equipo/<code>/plantel` y `#/partido/123/analizar`; comprobar avisos y destino
- [ ] T-F13 · CA-10: con base vacía (`DB_PATH` a un archivo nuevo) abrir `/` → `#/datos/importar`; con el seed importado → `#/liga/tabla`
- [ ] T-F14 · CA-11: clic en fila de Liga › Ranking y en fila de Explorar; comprobar hashes
- [ ] T-F15 · CA-12: abrir `http://localhost:5000/#search` → `#/explorar/jugadores`
- [ ] T-F16 · CA-13: visitar todas las secciones con red, DevTools › Network › Offline, recargar; la cáscara se dibuja y los bloques muestran "Sin conexión: no se pueden cargar los datos."
- [ ] T-F17 · CA-14: plegar "Desglose ofensivo" en S3 › Resumen; abrir la app en otro navegador con el mismo usuario (`AUTH_USERS` local con dos navegadores) → sigue plegado; verificar con `curl -s -b cookies.txt "http://localhost:5000/api/prefs?scope=panel.collapsed"`
- [ ] T-F18 · CA-15: con `ADMIN_USERS=otro` y sesión de un usuario no admin, abrir S9: valores en solo lectura; la pestaña Reglas de Momentum no aparece
- [ ] T-F19 · CA-16: abrir en S4 un jugador sin triples intentados; FG3% muestra "—" con `title` de razón en Resumen y Tiro

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 (diferido → F-07) · Enlace de filas del catálogo (S1 › Partidos) y del game log (S3/S4) a `#/partido/<game_id>/analizar` · lo implementa F-07 al habilitar S5
- [ ] T-G2 (diferido → F-12) · Sección inicial = S8 cuando esté habilitada · lo implementa F-12 (la regla ya está en `initialSection`)
- [ ] T-G3 (diferido → F-12, F-03) · Abrir `#/partido/preparar?team=&rival=&fixture=` desde el calendario

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B1, T-B7, T-D10, T-D11, T-F6 |
| CA-2 | T-B1, T-B3, T-D5, T-D7, T-F7 |
| CA-3 | T-B1, T-B3, T-D5, T-F8 |
| CA-4 | T-B1, T-B2, T-D2, T-F9 |
| CA-5 | T-B8, T-D1…T-D9, T-F10 |
| CA-6 | T-B7, T-D12, T-F11 |
| CA-7 | T-B5, T-D12, T-F11 |
| CA-8 | T-B2, T-E1, T-F12 |
| CA-9 | T-B2, T-D10, T-F12 |
| CA-10 | T-B2, T-F13 |
| CA-11 | T-D2, T-D4, T-F14 |
| CA-12 | T-B2, T-F15 |
| CA-13 | T-B4, T-E1, T-E2, T-F16 |
| CA-14 | T-B6, T-D6, T-F17 |
| CA-15 | T-D9, T-F18 |
| CA-16 | T-D8, T-F19 |

## Dependencias externas
- Fase 1 cerrada e integrada (C-11 `core/i18n.js`/`core/format.js`; F-11 pestañas de Importar, `is_admin`; F-13
  `core/prefs.js`, `/api/prefs`, vista de configuración; C-08 `player_id`; T-06 tablas y exportación masiva; C-03
  `components/shot-chart.js`).
- Dataset de verificación: 13 partidos del seed reprocesados con la ingesta v2 (`SEED_ENABLED=1` + login) y, para CA-3,
  al menos dos competencias (Arquitectura R-05).
- Para CA-14/CA-15: `AUTH_USERS` con dos usuarios y `ADMIN_USERS` definida en el entorno local.
- Número de `CACHE` del service worker asignado al integrar.
