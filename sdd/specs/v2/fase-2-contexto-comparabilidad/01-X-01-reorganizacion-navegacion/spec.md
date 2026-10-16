# Spec — X-01: Reorganización de la navegación en secciones y pestañas

> **ID:** X-01 (**ID provisional (no figura en la especificación v2) — confirmar con el cliente**) · **Prioridad:** P1 (propuesta; el cliente no la fijó — ver §9) · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 01
> **Depende de:** Fase 1 cerrada (en particular [F-11](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md), [F-13](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md), [C-08](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md), [T-06](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md), [C-03](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/spec.md)) · **Habilita:** T-03, F-16, F-08, F-05, F-04, F-17, F-07, F-20, F-12, F-21
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** [Especificación v2](../../00-especificacion-cliente-v2.md) §1 (1.1, 1.2, 1.3) · X-01 (implícito) · Arquitectura [§3.12, §3.13, §8, §9.2 (I-16, I-17, I-18)](../../00-arquitectura-transversal.md)

## 0. Contexto y situación actual

**Qué pide el cliente.** La §1 de la especificación v2 reorganiza la app "en secciones y módulos" y fija una regla dura:
*"Nada de lo que existe hoy se elimina: se reubica."* Define nueve secciones (§1.2) — S1 Datos, S2 Liga, S3 Equipo, S4
Jugador, S5 Partido (nueva), S6 Comparar, S7 Explorar (hoy Buscar), S8 Mi equipo (nueva), S9 Configuración (nueva) —, y
para S3 dice: *"Organizado en pestañas internas para que la pantalla deje de ser un scroll continuo."* La especificación no
le asigna ID a esta reorganización: la describe como marco para todos los requisitos. Este documento la convierte en un
requisito propio (X-01) porque es la precondición de las pestañas y secciones que traen T-03, F-16, F-08, F-04, F-07,
F-12, F-20 y F-21.

**Qué existe hoy (verificado en código, rama `main`; la fase 1 no cambia la navegación salvo lo indicado):**
- `frontend/js/app.js` (1.873 líneas, monolítico): `const sections = ["import","league","team","compare","player","search"]`
  (l.181) y `setSection(id)` (l.184) que solo muestra/oculta los `div.section` y marca el botón activo. `renderApp()`
  (l.1609) arma header, `<nav>` con los 6 botones de `NAV_ITEMS` (l.1600) y los contenedores `#sec-*`. Arranca siempre en
  `setSection("import")` (l.1813).
- **No hay routing por hash**: ninguna línea lee ni escribe `location.hash` y no hay listener de `hashchange`. Recargar la
  página vuelve siempre a Importar y pierde el equipo/jugador elegido. `docs/frontend.md` §Vistas afirma "La navegación es
  por `#hash`" — discrepancia D-03 de la arquitectura.
- Vista Equipo (`renderTeam` l.836, `_renderTeamContent` l.723): un único scroll con, en este orden, controles (selector de
  equipo, selector de jugador, "Ver jugador", "Ver mapa de tiro", "Ver ON/OFF", pills "Todos · Últ. 5 · Últ. 3", selector
  de competencia), mapa de tiro del equipo (`renderTeamShotmapTeam`), mapa del jugador (`renderTeamShotmap`), ON/OFF
  (`renderTeamOnOff`), Combinaciones (`renderTeamLineup`), cards Eficiencia · Tiro · Rebotes & Misc · Defensa avanzada ·
  Desglose ofensivo · Game log · Perfil de equipo (radar) · Evolución por partido, Cierres (`renderTeamClutch`) y
  "Jugadores más influyentes — USO%" (`_renderUsageRanking`).
- Vista Jugador (`renderPlayer` l.1313, `_renderPlayerContent` l.1327): Producción ofensiva · Tiro · Rebotes & distribución ·
  Defensa avanzada · Perfil (radar) · Evolución · Game log · Shot chart por zonas. Se llega solo desde Equipo o Buscar.
- `frontend/css/style.css`: `nav` fijo abajo con 6 botones en móvil (<768 px) y barra superior en desktop (l.154–206).
- `frontend/sw.js`: `CACHE = "smart-basket-v9"`, `STATIC` con 7 archivos; cache-first **sin guardar** respuestas nuevas: un
  módulo JS que no esté en `STATIC` no funciona offline.
- Fase 1 (según arquitectura §3.12 y §9.2 I-17/I-18): F-11 agrega pestañas internas a Importar ("Importar · Partidos ·
  Calidad · Competencias"), F-13 agrega un engranaje en el header que abre la vista de configuración, T-06 agrega el botón
  de exportación masiva en Importar, C-03 mueve el mapa de tiro a `components/shot-chart.js`, C-11 crea `core/format.js`
  y `core/i18n.js`, T-05/T-01/T-02/T-06 crean componentes en `components/`, C-08 introduce `player_id`.

**Qué resolvieron features anteriores.** Feature 05 v2 movió Cierres de Liga a Equipo; Feature 09 agregó los selectores de
competencia; Features 03/04/10/11 sumaron apartados al scroll de Equipo (origen del problema de "scroll continuo").

**Qué queda.** Router por hash con deep links, registro de 9 secciones y sus pestañas con bandera de habilitación,
reubicación del contenido actual en pestañas de S1–S4, S6, S7 y S9, navegación móvil viable para 9 secciones, mudanza del
monolito a módulos de vista y service worker que no rompa offline con módulos nuevos.

## 1. Objetivo
Reorganizar la app en las nueve secciones de la especificación v2, con pestañas internas y direcciones compartibles
(deep links), reubicando todo el contenido existente sin eliminar nada y dejando el lugar preparado para los requisitos
que llegan después.

## 2. Fuentes (trazabilidad)
- Especificación v2 §1 "Arquitectura de la aplicación" (frase "Nada de lo que existe hoy se elimina: se reubica"), §1.1
  (capa transversal), §1.2 (mapa de secciones), §1.3 (composición de S1–S9).
- `docs/frontend.md` §Vistas (SPA), §`app.js`, §Service Worker, §Responsive / Mobile.
- `docs/architecture.md` (vistas del frontend; D-21: dice 5 vistas, hay 6).
- `00-arquitectura-transversal.md` §1.4 (frontend actual), §1.5 (D-03, D-21), §3.3 (scope `panel.collapsed`), §3.12
  (secciones, rutas, móvil), §3.13 (módulos ES, service worker), §3.20 (`t()`), §8 (`core/router.js`,
  `components/tabs.js`, `components/collapsible.js`), §9.2 (I-16, I-17, I-18), §11 (DA-22, DA-23).
- Constitución (sdd/README.md) reglas 2, 7 y 9.

## 3. Historias de usuario
- US-1: Como entrenador, quiero una navegación por secciones que respondan a una pregunta concreta ("¿cómo juega este
  equipo?", "¿qué datos tengo cargados?"), para encontrar cada cosa sin recorrer un scroll largo.
- US-2: Como entrenador, quiero que Equipo y Jugador estén divididos en pestañas, para ir directo al tiro, a los quintetos
  o al game log.
- US-3: Como entrenador, quiero copiar la dirección de lo que estoy viendo y mandarla al cuerpo técnico, para que abran
  exactamente la misma pantalla (sección, equipo o jugador, pestaña y filtros).
- US-4: Como entrenador que usa el celular, quiero una barra inferior usable con las secciones principales y acceso al
  resto, para navegar con el pulgar.
- US-5: Como usuario habitual, quiero seguir encontrando todo lo que existe hoy (importar, catálogo, ranking, mapa de liga,
  cierres, ON/OFF, combinaciones, mapas de tiro, buscador, configuración), para no perder funciones con el cambio.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE organizar la navegación en nueve secciones con estos nombres y este orden: S1 Datos, S2 Liga,
  S3 Equipo, S4 Jugador, S5 Partido, S6 Comparar, S7 Explorar, S8 Mi equipo, S9 Configuración. · (US-1) (Esp. v2 §1.2)
- RF-2: El sistema DEBE mostrar solo las secciones y pestañas cuyo contenido existe; una sección o pestaña cuyo requisito
  todavía no está implementado NO se muestra (ni como "próximamente"), y cada requisito posterior la habilita. En esta
  fase quedan ocultas S5 Partido y S8 Mi equipo. · (US-1, US-5) (Esp. v2 §1.2, §1.3; Arquitectura §3.12)
- RF-3: El sistema DEBE reflejar en la dirección del navegador la sección, la entidad (equipo o jugador), la pestaña y los
  filtros activos, con la forma `#/<sección>/<id>/<pestaña>?<filtros>`, y DEBE reconstruir exactamente esa vista al abrir
  o recargar la dirección (deep link). · (US-3) (Arquitectura §3.12; `docs/frontend.md` §Vistas)
- RF-4: El sistema DEBE soportar los botones Atrás/Adelante del navegador: cada cambio de sección, entidad o pestaña es un
  paso del historial. · (US-3)
- RF-5: S1 Datos DEBE agrupar en pestañas: Importar (alta por URL y lote de seed en desarrollo), Partidos (catálogo con
  selección y borrado), Calidad y Competencias (las pestañas que F-11 creó en Importar) y Exportar (la exportación masiva
  de T-06). · (US-1, US-5) (Esp. v2 §1.3 S1)
- RF-6: S2 Liga DEBE agrupar en pestañas: Tabla (tabla general de C-09), Ranking (ranking avanzado de equipos de T-01/T-06)
  y Mapa (mapa de liga con ejes seleccionables). · (US-1, US-5) (Esp. v2 §1.3 S2)
- RF-7: S3 Equipo DEBE mostrar un selector de equipo y, con un equipo elegido, las pestañas: Resumen (récord, conjunto
  estándar/fichas, four factors, radar, evolución de OER, desglose ofensivo y "Jugadores más influyentes — USO%"), Tiro
  (mapa de tiro del equipo, mapa de un jugador del equipo y detalle T2/T3/TL), Quintetos (combinaciones y ON/OFF), Momentos
  (cierres) y Game log (tabla partido a partido). · (US-2, US-5) (Esp. v2 §1.3 S3)
- RF-8: S4 Jugador DEBE mostrar un selector de jugador (por equipo) y, con un jugador elegido, las pestañas: Resumen
  (producción ofensiva, tiro, defensa, radar, evolución), Tiro (mapa de tiro por zonas y detalle), Distribución (rebotes y
  distribución de C-01), Impacto (+/- y ON/OFF del jugador) y Game log. · (US-2, US-5) (Esp. v2 §1.3 S4)
- RF-9: S6 Comparar DEBE ofrecer la pestaña Equipos con el contenido actual de Comparar; S7 Explorar DEBE ofrecer la
  pestaña Jugadores con el buscador actual (vista "Buscar" renombrada a "Explorar"); S9 Configuración DEBE contener la
  configuración de F-13 (que en fase 1 se abría con el engranaje del header), organizada en las pestañas Umbrales, Reglas
  de contexto, Reglas de Momentum y Preferencias; una pestaña de S9 sin claves se oculta. · (US-1, US-5) (Esp. v2 §1.3 S6,
  S7, S9)
- RF-10: Toda función que hoy existe DEBE seguir accesible después de la reorganización; la relación función actual →
  nueva ubicación DEBE quedar documentada (tabla de §5) y verificada una por una. · (US-5) (Esp. v2 §1)
- RF-11: En pantallas de menos de 768 px, la barra inferior fija DEBE mostrar como máximo cuatro secciones habilitadas
  elegidas por prioridad (S8, S5, S3, S4, S2, S6, S7, S1, S9) más un botón "Más" que abre una hoja con el resto de las
  secciones habilitadas; en pantallas de 768 px o más, todas las secciones habilitadas van en la barra superior.
  · (US-4) (Arquitectura §3.12, DA-23; Constitución 7)
- RF-12: Las pestañas internas DEBEN ser usables en móvil: una fila desplazable horizontalmente, con la pestaña activa
  visible y resaltada, sin desbordar el ancho de la pantalla. · (US-2, US-4) (Constitución 7)
- RF-13: Al cambiar de pestaña dentro de una sección, el sistema DEBE conservar la entidad elegida y los filtros de la
  dirección; al cambiar de sección DEBE conservar los filtros de la dirección (salvo con/sin jugador, que es propio de la
  entidad) y recordar la última entidad visitada de S3 y S4 en la sesión. · (US-2, US-3) (Arquitectura §3.8 "Frontend")
- RF-14: Los enlaces internos existentes DEBEN convertirse en navegación con dirección: fila del ranking de Liga → S3 del
  equipo; fila del buscador → S4 del jugador; "Ver jugador" de Equipo → S4 del jugador; filas del plantel/USO% → S4.
  · (US-3, US-5)
- RF-15: Una dirección inválida (sección inexistente, pestaña deshabilitada, equipo o jugador inexistente) DEBE llevar a
  un estado recuperable: pestaña por defecto de la sección o selector de entidad, con un aviso en español; nunca una
  pantalla en blanco. · (US-3)
- RF-16: La sección inicial al abrir la app sin dirección DEBE ser: S1 Datos › Importar si la base no tiene partidos; si
  tiene, S2 Liga › Tabla (hasta que F-12 habilite S8, que pasa a ser la de inicio). · (US-1) (§9 decisión)
- RF-17: Las direcciones con el formato viejo por hash plano, si alguna quedó guardada (`#import`, `#league`, `#team`,
  `#compare`, `#player`, `#search`), DEBEN redirigir a su sección nueva. · (US-5)
- RF-18: La app DEBE seguir funcionando sin conexión para la cáscara (HTML, CSS, JS de todas las secciones) después de
  una primera visita, aunque se agreguen módulos nuevos; los datos (`/api/*`) siguen yendo siempre a la red.
  · (US-5) (`docs/frontend.md` §Service Worker; Arquitectura §3.13)
- RF-19: Todo texto nuevo de navegación (nombres de secciones y pestañas, "Más", avisos) DEBE estar en español y pasar por
  el mecanismo de traducción preparado en fase 1. · (US-1) (Arquitectura §3.20, DA-21; Constitución 7)
- RF-20: El sistema DEBE ofrecer un panel plegable reutilizable cuyo estado abierto/cerrado se recuerda por usuario, para
  los paneles que lo pidan (F-17, F-12). · (US-2) (Arquitectura §3.3 scope `panel.collapsed`, §8)

## 5. Requisitos de datos / API
Sin cambios de esquema ni endpoints nuevos. Consume endpoints existentes y los de fase 1 tal como están.

| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `GET /api/me` | endpoint | `{authenticated, user, auth_required, seed_enabled, is_admin}` (F-11) — decide qué acciones de S1/S9 se muestran | No |
| `GET /api/games` | endpoint | lista del catálogo (F-11) — define la sección inicial (RF-16) | No |
| `GET /api/teams` · `GET /api/players/<team_code>` · `GET /api/player/<int:player_id>` | endpoint | selectores de S3/S4 con `player_id` (C-08) | No |
| `GET /api/prefs` · `PUT /api/prefs` | endpoint | scope `panel.collapsed` (F-13) para el panel plegable | No |
| Rutas hash | contrato frontend | `#/<sección>/<id>/<pestaña>?<query>` con los slugs de la tabla siguiente | **NUEVO** |

**Mapa de reubicación (función actual → sección/pestaña; slugs fijados en Arquitectura §3.12):**

| Función actual (vista `main` + fase 1) | Nueva ubicación | Ruta |
|---|---|---|
| Importar por URL + "Agregar partidos" (seed) | S1 Datos › Importar | `#/datos/importar` |
| Catálogo de partidos, selección, borrado | S1 Datos › Partidos | `#/datos/partidos` |
| Calidad de datos (F-11) | S1 Datos › Calidad | `#/datos/calidad` |
| Competencias y reproceso (F-11) | S1 Datos › Competencias | `#/datos/competencias` |
| Exportación masiva XLSX (T-06) | S1 Datos › Exportar | `#/datos/exportar` |
| Tabla general (C-09) | S2 Liga › Tabla | `#/liga/tabla` |
| Ranking de equipos (T-01/T-06) | S2 Liga › Ranking | `#/liga/ranking` |
| Mapa de liga (C-10) | S2 Liga › Mapa | `#/liga/mapa` |
| Equipo: récord, conjunto estándar, four factors, radar, evolución, desglose, USO% | S3 › Resumen | `#/equipo/<code>/resumen` |
| Equipo: mapa del equipo, mapa de un jugador, detalle de tiro | S3 › Tiro | `#/equipo/<code>/tiro` |
| Equipo: Combinaciones, ON/OFF | S3 › Quintetos | `#/equipo/<code>/quintetos` |
| Equipo: Cierres | S3 › Momentos | `#/equipo/<code>/momentos` |
| Equipo: Game log | S3 › Game log | `#/equipo/<code>/gamelog` |
| Jugador: producción, tiro, defensa, radar, evolución | S4 › Resumen | `#/jugador/<player_id>/resumen` |
| Jugador: shot chart | S4 › Tiro | `#/jugador/<player_id>/tiro` |
| Jugador: rebotes y distribución (C-01) | S4 › Distribución | `#/jugador/<player_id>/distribucion` |
| Jugador: ON/OFF (hoy solo desde Equipo) y +/- | S4 › Impacto | `#/jugador/<player_id>/impacto` |
| Jugador: game log | S4 › Game log | `#/jugador/<player_id>/gamelog` |
| Comparar equipos | S6 › Equipos | `#/comparar/equipos?a=<code>&b=<code>` |
| Buscar jugadores | S7 › Jugadores | `#/explorar/jugadores` |
| Configuración (engranaje F-13) | S9 › Umbrales / Reglas de contexto / Reglas de Momentum / Preferencias | `#/configuracion/<pestaña>` |

Pestañas y secciones previstas pero **no habilitadas** por X-01 (las habilita su requisito): S1 `calendario` (F-12); S2
`lideres`, `perfil` (F-14); S3 `posesion` (A-02…A-05), `eventos` (A-07), `plantel` (F-08), `enfrentamiento` (F-20);
S4 `ficha` (F-16), `posesion` (A-03/A-05), `eventos` (A-07), `similares` (A-09), `tendencias` (F-18); S5 completa
(F-07, F-01, F-02, F-03); S6 `jugadores` (F-05), `quintetos` (F-09), `h2h` (F-03); S7 `quintetos`, `consultas` (F-10),
`contextos` (A-06), `similares` (A-09); S8 completa (F-12).

## 6. Estados de UI
Copy nuevo (a agregar a `docs/frontend.md`) marcado con *(nuevo)*.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Barra de secciones (desktop/móvil) | — (se dibuja con el registro, sin red) | — | — | Se muestra desde caché del service worker | Sección activa resaltada; en móvil 4 secciones + "Más" *(nuevo)* |
| Hoja "Más" (móvil) | — | — | — | Igual | Lista de secciones restantes con ícono y nombre; se cierra al elegir o al tocar fuera |
| Pestañas de sección | — | — | — | Igual | Pestaña activa resaltada; fila desplazable en móvil |
| S3 sin equipo elegido | "Cargando equipos…" *(nuevo)* | "Todavía no hay equipos. Importá partidos desde Datos." *(nuevo)* con enlace a `#/datos/importar` | "No se pudieron cargar los equipos." *(nuevo)* | "Sin conexión: no se pueden cargar los datos." *(nuevo)* | Selector de equipo + texto "Elegí un equipo para ver su análisis." *(nuevo)* |
| S4 sin jugador elegido | "Cargando jugadores…" *(nuevo)* | "Elegí un equipo y un jugador." *(nuevo)* | igual que S3 | igual que S3 | Selectores equipo → jugador |
| Dirección con equipo/jugador inexistente | — | — | Aviso: "No encontramos ese equipo." / "No encontramos ese jugador." *(nuevo)* y se muestra el selector | — | — |
| Dirección con pestaña no disponible | — | — | Aviso: "Esa pestaña todavía no está disponible." *(nuevo)* y se abre la pestaña por defecto | — | — |
| Dirección con sección inexistente o deshabilitada | — | — | Aviso: "Esa sección no existe o todavía no está disponible." *(nuevo)* y se abre la sección inicial | — | — |
| Contenido de cada pestaña | El estado actual de cada vista (spinner + "Cargando…") | Copy actual de cada vista | Copy actual de cada vista | "Sin conexión: no se pueden cargar los datos." *(nuevo)* | Contenido reubicado sin cambios funcionales |
| Panel plegable | — | — | Si no se puede guardar la preferencia, el panel igual se pliega (solo en la sesión) | Igual | Encabezado con flecha ▸/▾ y título |

Nombres visibles *(nuevo)*: secciones "Datos", "Liga", "Equipo", "Jugador", "Partido", "Comparar", "Explorar", "Mi equipo",
"Configuración"; botón "Más"; pestañas "Importar", "Partidos", "Calidad", "Competencias", "Calendario", "Exportar", "Tabla",
"Ranking", "Mapa", "Líderes", "Perfil", "Resumen", "Tiro", "Posesión", "Eventos", "Quintetos", "Momentos", "Plantel",
"Enfrentamiento", "Game log", "Ficha", "Distribución", "Impacto", "Similares", "Tendencias", "Equipos", "Jugadores",
"Head to head", "Contextos", "Consultas", "Umbrales", "Reglas de contexto", "Reglas de Momentum", "Preferencias".

## 7. Criterios de aceptación
- CA-1 (RF-1, RF-2): Given la app con la fase 1 cerrada, When se abre en desktop, Then la barra superior muestra, en orden,
  Datos, Liga, Equipo, Jugador, Comparar, Explorar y Configuración, y no muestra Partido ni Mi equipo.
- CA-2 (RF-3, RF-13): Given un equipo con partidos, When el usuario abre S3, elige el equipo y la pestaña Quintetos, Then
  la dirección queda `#/equipo/<code>/quintetos`, y al recargar la página se ve la misma pestaña del mismo equipo.
- CA-3 (RF-3): Given la dirección `#/equipo/<code>/resumen?competition=<id>&last=5` copiada en otro navegador con sesión
  iniciada, When se abre, Then se ve el Resumen del equipo con la competencia y "Últ. 5" aplicados.
- CA-4 (RF-4): Given el usuario navegó Liga › Tabla → Equipo `<code>` › Resumen → pestaña Tiro, When presiona Atrás dos
  veces, Then vuelve a Resumen y luego a Liga › Tabla.
- CA-5 (RF-10, RF-5…RF-9): Given la tabla de reubicación de §5, When se recorre cada fila, Then cada función existe en su
  nueva ubicación y responde como antes (22 filas verificadas).
- CA-6 (RF-11): Given un viewport de 360 px de ancho, When se abre la app, Then la barra inferior muestra Equipo, Jugador,
  Liga y Comparar más "Más", sin desbordar; "Más" abre una hoja con Explorar, Datos y Configuración.
- CA-7 (RF-12): Given un viewport de 360 px en S4 con un jugador, When se miran las pestañas, Then entran en una fila
  desplazable, la activa está visible y la página no tiene scroll horizontal.
- CA-8 (RF-15): Given la dirección `#/equipo/NOEXISTE/resumen`, When se abre, Then aparece el aviso "No encontramos ese
  equipo." y el selector de equipo, sin errores en la consola.
- CA-9 (RF-15, RF-2): Given la dirección `#/equipo/<code>/plantel` antes de que exista F-08, When se abre, Then aparece
  el aviso "Esa pestaña todavía no está disponible." y se abre Resumen; `#/partido/123/analizar` abre la sección inicial
  con el aviso de sección no disponible.
- CA-10 (RF-16): Given una base sin partidos, When se abre la app sin hash, Then abre `#/datos/importar`; Given una base
  con partidos, Then abre `#/liga/tabla`.
- CA-11 (RF-14): Given Liga › Ranking, When se hace clic en la fila de un equipo, Then la dirección pasa a
  `#/equipo/<code>/resumen`; Given Explorar, When se hace clic en un jugador, Then pasa a `#/jugador/<player_id>/resumen`.
- CA-12 (RF-17): Given la dirección vieja `#search`, When se abre, Then redirige a `#/explorar/jugadores`.
- CA-13 (RF-18): Given una primera visita completa con conexión, When se corta la red (DevTools "Offline") y se recarga,
  Then la cáscara de la app (barra, pestañas, selectores) se dibuja y cada bloque de datos muestra "Sin conexión: no se
  pueden cargar los datos."
- CA-14 (RF-20): Given un panel plegable cerrado por el usuario, When recarga la app en otro navegador con el mismo
  usuario, Then el panel sigue cerrado.
- CA-15 (RF-9): Given un usuario no administrador (con `ADMIN_USERS` definida), When abre S9, Then ve los valores en solo
  lectura, como en F-13; Given la sección Reglas de Momentum sin claves en fase 2, Then esa pestaña no se muestra.
- CA-16 (nulos C-11, sin regresión): Given un jugador con métricas nulas (p. ej. sin intentos de triple), When se abre
  cualquier pestaña de S4, Then los nulos se ven "—" con su razón, igual que antes de la reorganización.

## 8. Fuera de alcance
- El contenido de las pestañas y secciones no habilitadas (lo trae cada requisito dueño, listado en §5).
- La barra de contexto global (T-03), el selector de base (T-04) y los filtros rápidos/cabecera (F-19): X-01 solo deja la
  dirección preparada para llevar esos parámetros y conserva los filtros actuales (competencia, "Últ. N").
- Cambiar métricas, fórmulas o componentes de la fase 1: la reorganización no modifica números.
- Enlace del catálogo de partidos y del game log a S5: INCREMENTO DIFERIDO (→ F-07) — se habilita con
  [F-07](../../fase-4-dia-de-partido/01-F-07-analizar-partido/spec.md).
- S8 como pantalla de inicio: INCREMENTO DIFERIDO (→ F-12) — se habilita con
  [F-12](../../fase-5-analitica-exploracion/12-F-12-mi-equipo/spec.md).
- Abrir S5 › Preparar desde el calendario: INCREMENTO DIFERIDO (→ F-12, F-03).
- Traducción a otros idiomas (F-21); X-01 solo usa `t()` con fallback en español.
- Routing por URL de servidor (`pushState`): descartado por la arquitectura (§3.12).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **ID y prioridad.** El cliente no asignó ID ni prioridad a la reorganización de §1. Se
  usa `X-01` como ID provisional y P1, porque es precondición de 10 requisitos P0/P1 de las fases 2–5 y la fase 1 ya dejó
  las piezas que se reubican. Confirmar con el cliente ID y prioridad.
- [DECISIÓN PROPUESTA — confirmar] **Ocultar vs "próximamente".** Se ocultan las pestañas y secciones sin contenido
  (Arquitectura §3.12). Motivo: la especificación insiste en no mostrar pantallas incompletas (T-05) y un "próximamente"
  en 25 pestañas llenaría la navegación de huecos. Costo: el cliente no ve el mapa final hasta que cada requisito llega.
- [DECISIÓN PROPUESTA — confirmar] **Móvil con 9 secciones** (DA-23): cuatro secciones prioritarias + "Más". Con S5 y S8
  ocultas, en fase 2 la barra muestra Equipo, Jugador, Liga, Comparar.
- [DECISIÓN PROPUESTA — confirmar] **Sección inicial**: Datos si la base está vacía, Liga › Tabla si no; S8 lo será al
  habilitarse (F-12). Alternativa descartada: recordar la última sección (confunde al compartir enlaces).
- [DECISIÓN PROPUESTA — confirmar] **Ubicación de "Jugadores más influyentes — USO%"**: queda en S3 › Resumen hasta que
  F-08 habilite Plantel, que lo absorbe. **ON/OFF**: en S3 › Quintetos (como está hoy, con selector de jugador) y además
  en S4 › Impacto para el jugador abierto (mismo componente). **Mapa de un jugador dentro de Equipo**: en S3 › Tiro.
- [DECISIÓN PROPUESTA — confirmar] **Pestaña Distribución de S4** se habilita en X-01 con el contenido de C-01 (ya
  implementado en fase 1); A-12 la completa. **Impacto de S4** se habilita con +/- y ON/OFF; A-08 y A-11 la completan.
- [DECISIÓN PROPUESTA — confirmar] **Recordar entidad**: la última entidad de S3 y S4 se recuerda en la sesión del
  navegador (no por usuario en el servidor) — no aparece en la especificación y F-12 cubre "equipo fijado".
- [DECISIÓN PROPUESTA — confirmar] **Pestañas de S9**: los nombres de §1.3 S9 del cliente ("Umbrales de muestra", "Reglas
  de contexto", "Reglas de Momentum", "Preferencias") se abrevian a "Umbrales" en la pestaña; una pestaña sin claves
  (Momentum, hasta F-02) no se muestra.
