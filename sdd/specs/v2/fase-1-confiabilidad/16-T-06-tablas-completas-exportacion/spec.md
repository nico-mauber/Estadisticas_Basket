# Spec — T-06: Tablas completas y exportación

> **ID:** T-06 · **Prioridad:** P0 · **Fase y orden:** 1·16
> **Depende de:** T-05 ([../13-T-05-conjunto-estandar-metricas/spec.md](../13-T-05-conjunto-estandar-metricas/spec.md)) · T-01 ([../15-T-01-ficha-de-metrica/spec.md](../15-T-01-ficha-de-metrica/spec.md)) · T-02 ([../14-T-02-confiabilidad-muestra/spec.md](../14-T-02-confiabilidad-muestra/spec.md)) · C-11 ([../01-C-11-tratamiento-de-nulos/spec.md](../01-C-11-tratamiento-de-nulos/spec.md)) · F-13 ([../12-F-13-configuracion/spec.md](../12-F-13-configuracion/spec.md)) · (usa C-02, C-06, C-09, F-11 ya cerrados)
> **Habilita:** F-08, F-06, F-07, F-03, F-10, F-18, F-21 (y toda tabla de requisitos posteriores: A-02…A-08, A-11, F-04, F-14)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §3 · T-06 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.11, §3.3, §6, §7.6, §7.7, §8 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal).** "Todo apartado que muestre datos agregados debe ofrecer, además de la visualización
resumida, la tabla completa con el conjunto estándar de T-05. Las tarjetas y los gráficos son la lectura rápida; la tabla es
el dato." Y en §3: "T-05 y T-06 son los que evitan que cada apartado nuevo vuelva a quedar incompleto."

**Qué existe hoy (verificado en código).** Rama `main` y rama `dev` (commit `0cc4de6`, integrado por el Grupo 0 de C-11,
DA-01). No existe ningún componente de tabla genérico ni ninguna exportación. Cada tabla es HTML armado a mano en
`frontend/js/app.js` con columnas fijas elegidas por pantalla:

| # | Tabla actual (función en `app.js` de `dev`) | Filas | Columnas hoy | Orden | Destino en v2 |
|---|---|---|---|---|---|
| 1 | Ranking de Liga (`_leagueTableHTML`, `_sortedLeague`, `_bindLeagueTableEvents`) | equipos | ~15 métricas fijas | sí, con `_cmpNullsLast` (dev) | **migra en T-06** (`league_teams`) |
| 2 | Tabla general (`_standingsCardHTML`, C-09) | equipos | PJ, PG, PP, Pts, PF, PC | no | **migra en T-06** (`league_standings`) |
| 3 | Game log de equipo (`_renderTeamContent`, tabla "Game log") | partidos | Fecha, Rival, L/V, Pts, OER, DER, eFG%, TS%, OR%, DR%, TO% | no | **migra en T-06** (`team_game_log`) |
| 4 | Game log de jugador (`_renderPlayerContent`, tabla "Game log — …") | partidos | Fecha, Rival, Pts, FGM/A, 3PM/A, FTM/A, OR, DR, Ast, TOV, OER, eFG%, TS% | no | **migra en T-06** (`player_game_log`) |
| 5 | Buscador de jugadores (`_renderSearchResults`, `SEARCH_COLS`, `_applySearch`) | jugadores | columnas fijas + filtros locales | sí, con `_cmpNullsLast` (dev) | **migra en T-06** (`search_players`) |
| 6 | Cierres por partido (`_drawClutchTable`, C-06) | partidos cerrados | fijas | sí, con `_cmpNullsLast` (dev) | **migra en T-06** (`clutch_games`) |
| 7 | Ranking de uso (`_renderUsageRanking`) | jugadores del equipo | USO%, PPG, PJ | no | F-08 (`team_roster`); en T-06 solo botón de exportación |
| 8 | ON/OFF (`renderTeamOnOff`, `.onoff-table`) | métricas | ON · OFF · Δ | no | F-06 (`team_onoff`); en T-06 solo botón de exportación |
| 9 | Combinación (`renderTeamLineup`) | 1 quinteto | 18 fijas | no | F-06 (`team_lineups`); en T-06 solo botón de exportación |
| 10 | Comparar equipos (`renderCompare`: `.compare-table.fiba-box` y "Métricas avanzadas") | 2 equipos | fijas | no | F-05/S6; en T-06 solo botón de exportación |
| 11 | Four Factors (`_fourFactorsCard`) | factores | equipo vs rival | no | tarjeta resumen; en T-06 solo botón de exportación |
| 12 | Catálogo de partidos (`_gamesTable`, vista Importar) | partidos | Fecha, Local, Result., Visitante, Competencia | no, paginada a mano | F-11 la amplía; en T-06 solo botón de exportación |
| 13 | Detalle de tiro T2/T3/TL (`_shotDetailGrid`, C-07, `dev`) | tipos de tiro | intentos, aciertos, %, PPT | no | en T-06 solo botón de exportación |

Otros hechos verificados: `frontend/js/api.js` → `apiFetch` siempre devuelve JSON (no hay descarga de archivos);
`frontend/css/style.css` no tiene reglas `@media print`; `backend/app.py` no usa `send_file` ni respuestas binarias;
`frontend/sw.js` usa `CACHE = "smart-basket-v9"` con lista `STATIC` fija (un módulo nuevo no incluido no funciona offline).
El orden null-safe `_cmpNullsLast(av, bv, dir)` existe solo en `dev` (C-11 lo mueve a `core/format.js` como `cmpNullsLast`).

**Qué resolvieron features anteriores.** Feature 12 (`dev`): nulos al final al ordenar en Liga, Cierres y Buscador.
C-11: contrato "nulo con razón" y `nullDisplay`. T-05: conjunto estándar (catálogo + `compute_standard` + `apply_base` con
bases `total`/`partido`). T-01: percentiles, población y `percentileColor`. T-02: badge de muestra y valores ajustados.
F-13: `user_prefs` (preferencias por usuario) y `app_config`. C-02: `context.py` con `competition` y `last`.

**Qué queda (alcance de T-06).** Un único componente de tabla completa y un único mecanismo de exportación (CSV, XLSX,
PNG, PDF y XLSX masivo), el registro backend de tablas, la migración de las 6 tablas de datos agregados existentes y el
botón de exportación en las 7 restantes.

## 1. Objetivo
Que toda tabla de datos agregados de la app muestre el conjunto estándar completo de métricas (T-05) en un componente único
ordenable, configurable, con totales, promedio de competencia, coloreado por percentil y paginación, y que cualquier tabla
se pueda exportar (CSV, XLSX, PNG, PDF, y en bloque desde Datos) reproduciendo exactamente lo que se ve, con la cabecera
que documenta entidad, competencia, temporada, filtros y fecha.

## 2. Fuentes (trazabilidad)
- Especificación v2 §3 · T-06 (texto completo, incluidos "Requisitos de toda tabla", "Exportación" y el criterio de aceptación); §1.1 (componente "Tabla y exportación"); §1.3 S1 (Datos) y S3 (pestaña Quintetos: "tabla completa de todos los quintetos").
- Especificación v2 §3 · T-05 (conjunto estándar), T-01 (percentil y color), T-02 (badge, valor ajustado, orden por ajustado), C-11 (nulos), T-03 y T-04 (contexto y base).
- `00-arquitectura-transversal.md` §3.11 (tablas y exportación), §3.3 (preferencias, scopes `table.columns`, `table.sort`, `table.colorize`), §3.2 (claves `table.page_size`, `export.csv_separator`), §3.8 (contexto y base), §3.13 (organización del frontend y service worker), §6 (endpoints `GET /api/table/<table_id>`, `POST /api/export/xlsx`, `GET /api/export/bulk` e ids de tablas), §7.4, §7.5, §7.6, §7.7, §7.8, §8 (componentes `data-table.js`, `export-menu.js`, `exporters.js`), §9.2 I-17, §11 DA-17, DA-19, DA-20, DA-36.
- `docs/frontend.md` §Vistas (Liga, Equipo, Jugador, Buscar, Importar) y §Service worker; `docs/api.md` (`/api/league`, `/api/team`, `/api/player`, `/api/search/players`, `/api/clutch`); `docs/metrics.md` (fórmulas, por medio de T-05).
- Código verificado: `frontend/js/app.js` (rama `dev`, funciones listadas en §0), `frontend/js/api.js`, `frontend/js/charts.js`, `frontend/sw.js`, `frontend/css/style.css`, `backend/app.py`.
- Specs previas: `sdd/specs/v2/fase-1-confiabilidad/13-T-05-…`, `15-T-01-…`, `14-T-02-…`, `12-F-13-…`, `01-C-11-…`; `dev:sdd/specs/12-nulos-orden-color-dnp/spec.md` (orden null-safe).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver en cada apartado la tabla completa con todas las métricas del conjunto estándar, para no tener que salir de la pantalla a completar la lectura.
- US-2: Como analista, quiero ordenar por cualquier columna sin que los datos inexistentes se mezclen con los ceros, para encontrar rápido los mejores y los peores.
- US-3: Como analista, quiero elegir qué columnas veo y que la app lo recuerde para mí en cada pantalla, para no reconfigurarla cada vez.
- US-4: Como entrenador, quiero ver al pie el total y el promedio de la competencia, y colores por percentil que pueda apagar, para leer cada fila en contexto.
- US-5: Como analista, quiero que tablas muy largas (más de mil quintetos) se paginen sin perder filas, para confiar en que veo todo.
- US-6: Como cuerpo técnico, quiero exportar cualquier tabla a CSV/XLSX (datos) y PNG/PDF (vista), con los filtros documentados en la cabecera, para compartirla y entenderla meses después.
- US-7: Como analista, quiero exportar de una vez todas las tablas de un equipo o de una competencia en un solo archivo con una hoja por apartado, para armar mis informes fuera de la app.

## 4. Requisitos funcionales

**Tabla completa**
- RF-1: El sistema DEBE ofrecer, en todo apartado que muestra datos agregados por entidad, una tabla con una fila por entidad (cada equipo, jugador, partido, quinteto, cruce o tramo) y **todas** las métricas del conjunto estándar de T-05 aplicables a ese tipo de entidad como columnas disponibles (visibles u ocultas). Una métrica que no aplica o no puede calcularse aparece como columna con celda nula y su razón; nunca se omite ni se reemplaza por 0. · (US-1; Esp. v2 §T-06 "Muestra el conjunto completo de T-05"; Esp. v2 §T-05; Arq. §3.5, §7.6)
- RF-2: El sistema DEBE permitir ordenar por cualquier columna (ascendente/descendente), dejando los nulos **siempre al final en ambos sentidos**. El orden inicial es el `default_sort` de la tabla; cuando la tabla trae valores ajustados (T-02) y `use_adjusted` es verdadero, el orden por esa métrica usa el valor ajustado. · (US-2; Esp. v2 §T-06, §C-11 "Un NULL nunca se ordena como si fuera 0", §T-02 "todo ranking se ordena por el ajustado"; Arq. §7.4)
- RF-3: El sistema DEBE ofrecer un selector de columnas visibles (agrupadas por los grupos de T-05), con opción "Restablecer" a las columnas por defecto, y DEBE recordar la selección **por usuario y por pantalla** (identificador de tabla) en el servidor, de modo que se conserve entre dispositivos del mismo usuario. El orden elegido y el estado del coloreado también se recuerdan por usuario y tabla. · (US-3; Esp. v2 §T-06; Arq. §3.3 scopes `table.columns`, `table.sort`, `table.colorize`, DA-17)
- RF-4: El sistema DEBE mostrar al pie de la tabla una **fila de totales** y una **fila de promedio de la competencia**. Totales = métricas del conjunto calculadas sobre la suma de los conteos de todas las filas del dataset (tasas como cociente de totales, DA-02), en la base activa. Promedio de competencia = media de las entidades de la población de referencia de T-01 para ese tipo de entidad, contexto y base (DA-08). Si una fila no tiene sentido para la tabla (p. ej. totales de una tabla de ligas enteras) se muestra con la razón `no_aplica`. · (US-4; Esp. v2 §T-06; Arq. §2.1, §3.6)
- RF-5: El sistema DEBE colorear cada celda de métrica según su percentil (escala continua rojo en 0 → gris en 50 → verde en 100, T-01), con un interruptor para desactivarlo; las celdas nulas, de texto o de métricas neutrales no se colorean nunca. · (US-4; Esp. v2 §T-06 "Coloreado por percentil, desactivable", §T-01 "Reglas de cálculo", §C-11 "Un NULL nunca se pinta con color de rendimiento"; Arq. §8 `percentileBg`)
- RF-6: El sistema DEBE calcular la tabla con el contexto activo (competencia y últimos N en fase 1; el resto de dimensiones de T-03 en cuanto existan) y la base de normalización activa (total y por partido en fase 1; por 40 y por 100 en cuanto exista T-04), y DEBE devolver el eco del contexto y de la base junto con los datos. · (US-1; Esp. v2 §T-06 "Respeta la barra de contexto (T-03) y la base de normalización (T-04) activas"; Arq. §3.8, §7.5)
- RF-7: El sistema DEBE paginar las tablas con un tamaño de página configurable (default 50), mostrando siempre la cantidad total de filas, la página actual y la opción "Ver todas"; ninguna fila se descarta en silencio (el servidor devuelve el dataset completo). · (US-5; Esp. v2 §T-06 "Paginación o scroll virtual … no debe truncarse en silencio"; Arq. §3.11, clave `table.page_size`)
- RF-8: El sistema DEBE mostrar en las tablas de entidades con muestra (T-02) la columna de badge de muestra; las filas de muestra baja se muestran en gris con la advertencia de T-02 y siguen siendo ordenables y exportables. · (US-4; Esp. v2 §T-02 "Qué hacer con las muestras pequeñas"; Arq. §7.2, §7.6)
- RF-9: El sistema DEBE mantener fija la primera columna (nombre de la entidad) al desplazar horizontalmente y DEBE permitir abrir la entidad de una fila (enlace de fila) cuando exista una vista de esa entidad. · (US-1; Constitución 7; Arq. §7.6 `link`)
- RF-10: El sistema DEBE migrar al componente de tabla completa las seis tablas de datos agregados existentes: ranking de Liga, tabla general de Liga, game log de equipo, game log de jugador, buscador de jugadores y cierres por partido, conservando como columnas visibles por defecto las que hoy muestra cada una. · (US-1; Esp. v2 §T-06; Arq. §6 "Ids de tablas")

**Exportación**
- RF-11: El sistema DEBE ofrecer un botón de exportación en **toda** tabla de la app, sin excepción (incluidas las 7 tablas que en esta fase no migran al componente: ranking de uso, ON/OFF, combinación, comparar equipos —dos tablas—, Four Factors, catálogo de partidos y detalle de tiro). · (US-6; Esp. v2 §T-06 "Botón de exportación en toda tabla, sin excepción")
- RF-12: El sistema DEBE exportar los datos en **CSV** y **XLSX** y la vista en **PNG** y **PDF**. · (US-6; Esp. v2 §T-06 "Formatos")
- RF-13: La exportación DEBE incluir exactamente lo que está en pantalla: mismo contexto (filtros), misma base de normalización, mismo orden, mismas columnas visibles en el mismo orden y los mismos filtros locales de la pantalla. En CSV y XLSX se exportan todas las filas del dataset filtrado (la paginación es navegación, no filtro); en PNG y PDF se exporta la vista tal como se muestra (la página visible), indicando en la cabecera qué filas contiene. · (US-6; Esp. v2 §T-06; ver §9 decisión D-3)
- RF-14: Todo archivo exportado DEBE llevar una cabecera con: título del apartado, equipo o entidad, competencia, temporada, filtros aplicados, base de normalización, orden, columnas visibles, fecha y hora de generación y usuario. · (US-6; Esp. v2 §T-06 "Cabecera del archivo…"; Arq. §7.7)
- RF-15: El sistema DEBE generar un nombre de archivo legible con el patrón `<apartado>_<entidad>_<competencia-slug>_<AAAA-MM-DD>.<ext>` (slug ASCII en minúsculas, sin tildes). · (US-6; Esp. v2 §T-06 "Nombre de archivo autogenerado y legible"; Arq. §3.11)
- RF-16: El CSV DEBE generarse en UTF-8 con BOM, separador configurable (default `;`) y coma decimal, con las líneas de cabecera como comentarios `# clave: valor` antes de la fila de títulos. · (US-6; Arq. §3.11, DA-20; clave `export.csv_separator`)
- RF-17: El XLSX DEBE abrir en Excel y LibreOffice, con una hoja "Portada" con los metadatos y una hoja de datos con números nativos (no texto) y formato de porcentaje/decimales según la métrica. · (US-6; Arq. §3.11)
- RF-18: El sistema DEBE ofrecer una **exportación masiva** desde la sección de Datos (en fase 1, la vista Importar): todas las tablas de un equipo, o todas las tablas de una competencia, en un único archivo XLSX con una hoja por apartado más la "Portada". · (US-7; Esp. v2 §T-06 "Exportación masiva desde S1"; Arq. §3.11, §9.2 I-17)
- RF-19: El sistema DEBE formatear los números de la vista y de los archivos visuales con formato es-UY (coma decimal) y mostrar los nulos como "—" con la etiqueta de su razón; en CSV/XLSX una celda nula queda vacía y la portada/cabecera lo explica. · (US-6; Esp. v2 §C-11; Arq. §7.4, DA-36)
- RF-20: Ningún número se calcula en el navegador: los valores, totales, promedios y percentiles vienen del servidor; el navegador solo ordena, pagina, oculta columnas, colorea y serializa. · (US-1; Constitución 4; Arq. §3.11 "Descartadas")

## 5. Requisitos de datos / API

Sin cambios de esquema (Arq. §5: "Sin cambios de esquema … T-06"). Usa tablas creadas por otros requisitos.

| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `user_prefs` (F-13) | tabla consumida | scopes `table.columns` (lista de claves), `table.sort` (`{key, dir}`), `table.colorize` (bool); key = id de tabla | — (F-13) |
| `app_config` (F-13) | tabla consumida | claves `table.page_size` (int, 50, 10–500) y `export.csv_separator` (`;`\|`,`, default `;`) que T-06 agrega a la especificación de configuración | claves NUEVAS (Arq. §3.2, dueño T-06) |
| `GET /api/table/<table_id>` | endpoint | query: parámetros propios de la tabla (`team`, `player_id`, …) + contexto (`competition`, `last`) + `base`; response = payload de tabla §7.6 con metadatos §7.7; errores 400/404 | **NUEVO** (Arq. §6) |
| `POST /api/export/xlsx` | endpoint | body `{meta, sheets: [{name, columns, rows}]}` → archivo XLSX adjunto; errores 400/413 | **NUEVO** (Arq. §6) |
| `GET /api/export/bulk` | endpoint | query `scope=team&team=<code>` o `scope=competition`, + `competition` → archivo XLSX multi-hoja; errores 400/404 | **NUEVO** (Arq. §6) |
| `GET /api/prefs`, `PUT /api/prefs` (F-13) | endpoints consumidos | `{scope, values}` / `{scope, key, value}` | — (F-13) |
| `GET /api/settings` (F-13) | endpoint consumido | lectura de `table.page_size` y `export.csv_separator` | — (F-13) |
| Ids de tabla de T-06 | contrato | `league_teams`, `league_standings`, `team_game_log`, `player_game_log`, `search_players`, `clutch_games` | NUEVOS (Arq. §6) |

## 6. Estados de UI

Copy nuevo (marcado para `docs/frontend.md`), siempre vía `t()`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Tabla completa (en cada apartado migrado) | spinner existente (`<span class="spinner">`) en lugar del cuerpo de la tabla | "No hay datos para esta selección." (nuevo) y, si el contexto recortó todo, "Probá con otro período o competencia." (nuevo) | mensaje del servidor en español (p. ej. "Tabla inexistente", "Parámetro inválido: …") en un `.card` con botón "Reintentar" (nuevo) | `/api/*` siempre a red: "Sin conexión. No se pudo cargar la tabla." (nuevo) | tabla con cabecera ordenable, fila de totales y de promedio, paginación "Página X de Y · N filas · Ver todas" (nuevo), barra de herramientas "Columnas · Colores · Exportar" (nuevo) |
| Selector de columnas | — | — | si no se pudo guardar la preferencia: toast "No se pudo guardar tu selección; se usará solo en esta sesión." (nuevo) | igual que error (se aplica localmente) | panel con grupos de T-05 y casillas; "Restablecer" (nuevo); en móvil, hoja inferior |
| Menú de exportación | "Generando archivo…" (nuevo) en el botón | — | "No se pudo exportar: <mensaje>" (nuevo); PNG fallido: "No se pudo generar la imagen en este navegador. Probá con PDF." (nuevo) | CSV, PNG y PDF funcionan (datos ya cargados); XLSX: "Sin conexión: el XLSX se genera en el servidor. Probá con CSV." (nuevo) | descarga del archivo con nombre legible; toast "Archivo generado: <nombre>" (nuevo) |
| Exportación masiva (vista Importar; luego Datos → Exportar) | "Preparando exportación… puede tardar hasta un minuto." (nuevo) | equipo o competencia sin tablas con datos: "No hay datos para exportar en esta selección." (nuevo) | mensaje del servidor | "Sin conexión: la exportación masiva requiere conexión." (nuevo) | descarga del XLSX |

Mobile (<768 px): la tabla se desplaza horizontalmente dentro de su tarjeta con la primera columna fija; la barra de
herramientas se reduce a íconos con etiqueta accesible; el selector de columnas y el menú de exportación abren como hoja
inferior; la paginación queda en una línea ("‹ 1/5 ›  Ver todas").

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: "cualquier tabla de la app se exporta y el archivo resultante reproduce el mismo contenido, con los filtros aplicados documentados en la cabecera." — Given cualquiera de las 13 tablas del inventario de §0, con un contexto no vacío (p. ej. competencia elegida y "Últ. 5"), columnas personalizadas y un orden elegido, When se exporta en CSV, XLSX, PNG y PDF, Then cada archivo contiene las mismas columnas visibles en el mismo orden, las mismas filas en el mismo orden y los mismos valores que la pantalla, y la cabecera documenta entidad, competencia, temporada, filtros, base, orden y fecha de generación.
- CA-2: Given la tabla del buscador de jugadores con jugadores de USO% nulo, When se ordena por USO% ascendente y luego descendente, Then en ambos sentidos las filas con "—" quedan al final y los ceros reales se ordenan como números.
- CA-3: Given el usuario A oculta 3 columnas y agrega 2 en el game log de equipo, When recarga la página, abre la app en otro navegador con el mismo usuario, y cuando el usuario B abre la misma tabla, Then A ve su selección en ambos navegadores, B ve las columnas por defecto, y el game log de jugador de A no se modificó.
- CA-4: Given el game log de un equipo en una competencia con base "por partido", When se mira el pie de la tabla, Then la fila "Total" coincide con el conjunto estándar del equipo en la misma competencia y base (`GET /api/metrics/team`), y la fila "Promedio competencia" coincide con el promedio de referencia de T-01 para cada métrica.
- CA-5: Given una tabla coloreada, When se desactiva "Colores", Then ninguna celda tiene color de fondo; al volver a activarlo, las celdas nulas, las de texto y las de métricas neutrales (p. ej. "Uso de triple") siguen sin color, y el estado se recuerda al recargar.
- CA-6: Given el game log de equipo, When se cambia la competencia o "Últ. 5", y la base entre "Totales" y "Por partido", Then las filas, los totales y el promedio se recalculan en el servidor y el eco `context`/`base` del payload refleja la selección.
- CA-7: Given el buscador de jugadores con más filas que `table.page_size` (50 por defecto; se puede bajar a 10 en Configuración para verificarlo), When se abre la tabla, Then se muestra "Página 1 de N · <total> filas", al pulsar "Ver todas" aparecen todas las filas, y la cantidad total coincide con `rows.length` del payload.
- CA-8: Given una exportación CSV, When se abre el archivo en un editor de texto y en Excel con configuración regional es-UY, Then empieza con BOM, las líneas `# clave: valor` preceden a los títulos, el separador es `;`, los decimales usan coma, las celdas nulas están vacías y el nombre sigue `<apartado>_<entidad>_<competencia-slug>_<AAAA-MM-DD>.csv`.
- CA-9: Given una exportación XLSX, When se abre en Excel o LibreOffice, Then abre sin reparación, tiene hoja "Portada" con los metadatos y la hoja de datos con números nativos (sumables) y porcentajes con formato de porcentaje.
- CA-10: Given una tabla paginada, When se exporta a PNG y a PDF, Then la imagen y el PDF muestran la cabecera con los metadatos y la página visible, indicando "Filas 1–50 de <total>".
- CA-11: Given la vista Importar, When se exporta en bloque un equipo y luego una competencia, Then cada XLSX tiene "Portada" y una hoja por tabla registrada para ese alcance, con los mismos valores que la tabla correspondiente en pantalla con las columnas completas, y la generación termina en menos de 60 s con los 13 partidos del seed.
- CA-12: Given cualquier tabla migrada, When se abre el selector de columnas, Then están disponibles todas las claves del conjunto estándar aplicables al tipo de entidad (mismos nombres que el catálogo de T-05), y las que no aplican figuran con celdas "—" y su razón en el `title`, nunca ausentes ni en 0.
- CA-13: Given peticiones inválidas, When se pide `GET /api/table/no_existe`, `GET /api/table/team_game_log` sin `team`, `POST /api/export/xlsx` con cuerpo malformado o con más filas que el límite, Then responden 404 `no_encontrado`, 400 `parametro_invalido`, 400 `parametro_invalido` y 413 `parametro_invalido` respectivamente, con mensaje en español.
- CA-14: Given un partido cuyo box no trae el dato de una métrica (p. ej. tapones recibidos antes del reproceso) o un jugador con DNP, When se ve la tabla y se exporta, Then la celda muestra "—" (nunca 0), no tiene color, va al final al ordenar, y queda vacía en CSV/XLSX.
- CA-15: Given una tabla con badge de muestra (cierres por partido o el buscador de jugadores con jugadores de pocos minutos), When se ve la tabla, Then las filas de muestra baja se ven en gris con la advertencia y siguen apareciendo en la tabla y en la exportación.
- CA-16: Given el navegador sin conexión con una tabla ya cargada, When se exporta en CSV, PNG y PDF, Then los archivos se generan; al pedir XLSX se muestra el aviso de sin conexión.
- CA-17: Given un ancho de 360 px, When se recorre una tabla migrada, Then la tabla se desplaza horizontalmente sin desbordar la página, la primera columna queda fija, y el selector de columnas y el menú de exportación abren como hoja inferior sin errores en consola.

## 8. Fuera de alcance
- Tablas de requisitos posteriores (`team_roster` F-08, `team_lineups`/`team_onoff` F-06, `period_splits` F-04, `matchups_*` F-07, tablas de A-02…A-08, A-11, F-10, F-14): las registra cada dueño usando el registro de T-06. La verificación con más de mil filas de quintetos la hace F-06 (en fase 1 la paginación se verifica con el buscador y con `table.page_size` reducido).
- INCREMENTO DIFERIDO (→ T-03, [../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)): dimensiones de contexto distintas de `competition` y `last` y su barra de filtros; la tabla ya las respeta porque usa el parser de contexto común, y los filtros aparecen en la cabecera de exportación sin cambios en T-06.
- INCREMENTO DIFERIDO (→ T-04, [../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md)): bases "por 40" y "por 100" y el selector de base; en fase 1 las vistas ofrecen solo "Totales" y "Por partido" donde ya existe ese selector.
- INCREMENTO DIFERIDO (→ X-01, [../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md)): la exportación masiva vive en la vista Importar; X-01 la reubica en Datos → Exportar sin cambiar el componente.
- INCREMENTO DIFERIDO (→ F-21): traducción de las cabeceras de exportación y de las etiquetas de la portada (en fase 1 en español, vía `t()` en el cliente y textos fijos en español en el servidor).
- INCREMENTO DIFERIDO (→ F-05 / F-06 / F-08): migración al componente de las tablas de Comparar, ON/OFF, combinación y ranking de uso (en T-06 solo reciben el botón de exportación).
- Exportación masiva de fichas personales de jugadores (Arq. R-12): no se incluye.
- Scroll virtual (se elige paginación, ver §9 D-2), edición de celdas, filtros por columna dentro de la tabla, gráficos dentro de la tabla.
- Informe PDF de 2 páginas de F-03 (usa los exportadores de T-06, pero su maqueta es de F-03).

## 9. Ambigüedades
- D-1 [DECISIÓN PROPUESTA — confirmar] **Qué es "fila de totales" en cada tabla.** Totales = conjunto estándar calculado sobre la suma de conteos de las filas del dataset (tasas pooled). En el game log equivale a la temporada del equipo/jugador en la selección; en el buscador y el ranking de Liga, al agregado de toda la competencia. Si la pantalla aplica un filtro local (buscador), la fila se rotula "Total (todas las filas, sin filtros locales)" porque el navegador no calcula métricas (regla 4).
- D-2 [DECISIÓN PROPUESTA — confirmar] **Paginación en lugar de scroll virtual**, con "Ver todas". Es más simple, funciona en móvil sin librerías y hace verificable "no truncar en silencio" (contador de filas). Arq. §3.11 lo fija.
- D-3 [DECISIÓN PROPUESTA — confirmar] **"Exactamente lo que está en pantalla" con paginación**: los formatos de datos (CSV/XLSX) exportan todas las filas del dataset con los filtros, el orden y las columnas de la pantalla; los formatos de vista (PNG/PDF) exportan la página visible y lo indican en la cabecera. Motivo: la página es navegación; exportar 50 de 1.200 quintetos en CSV sería una truncación silenciosa.
- D-4 [DECISIÓN PROPUESTA — confirmar] **Nulos en CSV/XLSX**: celda vacía (no "—"), para que las planillas sumen y promedien bien; la portada/cabecera incluye "Celda vacía = dato inexistente (—)". Los PNG/PDF muestran "—".
- D-5 [DECISIÓN PROPUESTA — confirmar] **Unidades en CSV**: los porcentajes se exportan en puntos porcentuales con un decimal (52,3) y el título de la columna agrega "(%)"; en XLSX se exporta la fracción con formato de porcentaje (0,523 → 52,3 %). Así el CSV "se ve" igual que la pantalla y el XLSX conserva el número nativo.
- D-6 [DECISIÓN PROPUESTA — confirmar] **Percentil de las filas de un game log**: el percentil de la celda de un partido se calcula contra todos los partidos-equipo (o partidos-jugador de la población de T-01) de la competencia en el mismo contexto, no contra los promedios de temporada de los equipos (comparar un partido contra temporadas exagera los extremos).
- D-7 [DECISIÓN PROPUESTA — confirmar] **Recordar selección "por usuario y por pantalla"**: la clave es el id de tabla (cada pantalla tiene su id); en modo abierto (sin `AUTH_USERS`) el dueño es `_open` y la selección se comparte en esa instalación (DA-17).
- D-8 [DECISIÓN PROPUESTA — confirmar] **Tablas de 1–2 filas o de métricas en filas** (ON/OFF, combinación, comparar, Four Factors, detalle de tiro): no migran al componente en T-06 (sus dueños las rediseñan con el conjunto completo); reciben igual el botón de exportación con los 4 formatos sobre sus datos visibles.
- D-9 [DECISIÓN PROPUESTA — confirmar] **Contenido de la exportación masiva**: todas las columnas del conjunto estándar (no las preferencias de columnas), orden por defecto de cada tabla, base `ui.default_base` salvo que se elija otra; la portada lo dice. Equipo: `team_game_log`, `clutch_games` y `search_players` filtrado por el equipo (una fila por jugador del plantel, hoja "Jugadores"); competencia: `league_teams`, `league_standings`, `search_players`. Cada requisito posterior agrega sus tablas al alcance (`bulk_scopes`).
- D-10 [DECISIÓN PROPUESTA — confirmar] **Límite de filas del XLSX por petición**: 50.000 filas por hoja y 10 MB de cuerpo; por encima, 413 con "La tabla es demasiado grande para exportar en XLSX; exportá en CSV." (el CSV se genera en el cliente sin límite).
