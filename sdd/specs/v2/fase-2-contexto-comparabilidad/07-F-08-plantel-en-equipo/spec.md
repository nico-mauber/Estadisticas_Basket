# Spec — F-08: Plantel dentro de Equipo

> **ID:** F-08 · **Prioridad:** P1 · **Fase y orden:** 2·07
> **Depende de:** T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)) · T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)) · X-01 ([01-X-01-reorganizacion-navegacion/spec.md](../01-X-01-reorganizacion-navegacion/spec.md)) · (usa también C-08 ids de jugador, F-05 enlace a comparación)
> **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-08 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S3 "Plantel" · §3 T-05, T-06, T-01 · Arquitectura §3.5, §3.6, §3.11, §3.12, §6, §7 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §4 F-08):** "Tabla con todos los jugadores del equipo y sus métricas principales, ordenable por cualquier columna, con percentiles. Hoy para comparar a dos jugadores del mismo plantel hay que entrar y salir de la ficha de cada uno." Enlace directo a la ficha del jugador y a la comparación. Criterio de aceptación del cliente: "Desde el perfil de un equipo se ve todo el plantel sin abandonar la pantalla."

**Por qué:** el mapa de secciones (§1.3 S3) fija una pestaña "Plantel" nueva dentro de Equipo, con la nota "Tabla de todos los jugadores del equipo con sus métricas, ordenable" y el requisito F-08 como dueño.

**Qué existe hoy (verificado en código, rama `main`):**
- `backend/app.py` `team_players(team_code)` (`GET /api/players/<team_code>`, línea 412): agrupa `player_game_stats` por nombre normalizado (`norm_name`, de `dev`/C-08), usa `resolve_identity` para la grafía y filtra partidos jugados con `played(minutes)`; calcula `uso_pct` (promedio de tasas por partido, no pooled) y `pts` (promedio simple) por jugador vía `calc_player_stats`; devuelve `[{name, games, uso_pct, pts}]` ordenado por `uso_pct` descendente (nulos al final). **No** trae `player_id`, ni el conjunto estándar, ni percentiles: solo 2 métricas.
- `frontend/js/app.js` `_renderUsageRanking(players)` (línea 1100): tarjeta "Jugadores más influyentes — USO%" dentro de la vista Equipo (no una pestaña separada), con una tabla de 5 columnas (Jugador, barra de USO%, USO%, PPG, PJ) ordenada por USO% de mayor a menor; cada fila es clicable y navega a la ficha del jugador (`#player-select` + evento `change`), pero **no** hay enlace a comparación. Se llama en línea 1292, dentro del render de la vista Equipo (no una pestaña propia).
- `docs/api.md` documenta `GET /api/players/<team_code>` como lista de strings (discrepancia D-05 de la arquitectura); el shape real ya es de objetos desde Feature 13.
- No existe endpoint de tabla T-06 para el plantel, ni pestaña `plantel` en la navegación (X-01 aún no está integrado en fase 1; F-08 es fase 2, así que X-01 debería estar resuelto cuando se implemente).

**Qué resolvieron features anteriores:** Feature 13 (identidad al leer, `norm_name`/`resolve_identity`, la base de `team_players`); Feature 12 (`played(minutes)`, DNP fuera de promedios); Feature 15 (`calc_player_stats` con `opp`). En v2 fase 1: T-05 define el conjunto estándar y registra el tipo de entidad `player`; T-01 la ficha (valor, ranking, distancias, percentil); T-06 el componente de tabla completa y exportación; C-08 la identidad persistente con `player_id` entero y el buscador sin duplicados; X-01 la pestaña `plantel` de S3.

**Qué queda para F-08:** construir la tabla del plantel como tabla T-06 sobre el conjunto estándar de T-05 (todas las métricas principales, no solo USO% y PPG), con la ficha T-01 de cada métrica (percentiles), enlaces a la ficha del jugador y a F-05 (comparar), reemplazando o absorbiendo `_renderUsageRanking` según §9.

## 1. Objetivo
Convertir la tarjeta "Jugadores más influyentes" en una pestaña Plantel dentro de Equipo con la tabla completa y exportable de todos los jugadores del equipo y sus métricas principales (conjunto estándar de T-05, con percentiles de T-01), ordenable por cualquier columna, con enlaces a la ficha del jugador y a la comparación.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 F-08 (completo), §1.3 S3 "Plantel", §3 T-05 (conjunto estándar, CA), §3 T-06 (requisitos de toda tabla y exportación), §3 T-01 (ficha, CA), §2 C-11 (nulos).
- `docs/api.md` § `GET /api/players/<team_code>` (discrepancia D-05: docs dice strings, el código ya devuelve objetos).
- `docs/architecture.md` § `app.py` rutas de Players. `docs/frontend.md` § Vistas → Equipo, tarjeta "Jugadores más influyentes".
- Arquitectura §3.5 (conjunto estándar T-05, tipo de entidad `player`, `StatBundle`, `compute_standard`), §3.6 (ficha T-01, `population.ficha`, población de jugadores: ≥60 minutos), §3.11 (tablas T-06, `register_table`, payload §7.6), §3.12 (S3 pestaña `plantel`), §6 (`GET /api/players/<team_code>` mod. con `player_id`; `GET /api/table/<table_id>`), §7.3, §7.6.
- Specs previos: `sdd/specs/12-nulos-orden-color-dnp/` (Bloque C `dev`, `played`), `sdd/specs/13-*` (identidad al leer).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver todo el plantel de un equipo con sus métricas principales en una tabla ordenable, para decidir a quién revisar sin salir de la pantalla de Equipo.
- US-2: Como entrenador, quiero que cada métrica de la tabla traiga su percentil, para saber si un valor es bueno relativo a la competencia sin abrir la ficha del jugador.
- US-3: Como entrenador, quiero ir directo de una fila del plantel a la ficha completa del jugador o a compararlo con otro del plantel, para no tener que buscarlo de nuevo.

## 4. Requisitos funcionales

- RF-1: El sistema DEBE devolver una tabla con **todos** los jugadores que disputaron minutos con el equipo en la selección activa (uno por jugador, identidad ya unificada por C-08/`resolve_identity`), con el conjunto estándar de T-05 completo (grupos: volumen, producción, tiro, balón, rebote, defensa, faltas, uso), sin truncar. · (US-1) (Esp. v2 §F-08, §T-05)
- RF-2: Cada métrica de cada jugador DEBE traer su ficha T-01 (valor, ranking "N.º de M", distancia al líder con nombre, distancia al promedio, percentil con escala de color), con población = los jugadores de la **competencia** con ≥ `sample.player.min` minutos (T-01 §Población de referencia). · (US-2) (Esp. v2 §F-08 "con percentiles", §T-01)
- RF-3: La tabla DEBE ser ordenable por cualquier columna (nulos al final en ambos sentidos), con selector de columnas visibles recordado por usuario y por pantalla, fila de totales del equipo y fila de promedio de la competencia al pie, coloreado por percentil desactivable, y exportable en CSV, XLSX, PNG y PDF con los metadatos de T-06. · (US-1) (Esp. v2 §T-06)
- RF-4: Jugadores por debajo del mínimo de minutos de T-01 (`sample.player.min`) DEBEN mostrarse en la tabla con su ficha completa marcada de muestra baja, fuera de la población que define percentiles, líder y promedio, sin ocultarse. · (US-2) (Esp. v2 §T-01 "Quien no llegue al mínimo recibe igualmente su ficha completa, marcada como muestra baja")
- RF-5: Cada fila DEBE enlazar a la ficha completa del jugador (S4) y ofrecer una acción para agregarlo a la comparación de jugadores (F-05), sin necesidad de volver a buscarlo. · (US-3) (Esp. v2 §F-08 "Enlace directo a la ficha del jugador y a la comparación")
- RF-6: El sistema DEBE respetar el contexto activo de T-03 (competencia, período, sede, rival, etc., disponibles desde su fase) y la base de normalización de T-04 en la tabla. · (US-1) (Esp. v2 §T-03, §T-04, §T-06; en fase 2 sin T-03 completo aún, la vista pasa `{competition, last}` explícitos, arquitectura §3.8)
- RF-7: El sistema DEBE excluir de la tabla los partidos DNP del cálculo de cada jugador (`played(minutes)`, ya resuelto por Feature 12/C-11) y mostrar como nulo con razón cualquier métrica no calculable para un jugador (por ejemplo, un jugador sin tiros de 3 intentados → `fg3_pct` nulo `sin_intentos`), nunca cero. · (US-1) (Esp. v2 §C-11; docs `played(minutes)`)
- RF-8: El sistema DEBE reemplazar o absorber la tarjeta actual "Jugadores más influyentes — USO%" (`_renderUsageRanking`) en la nueva pestaña Plantel: el ranking por USO% queda disponible como uno de los órdenes posibles de la tabla completa (columna `uso_pct`, orden descendente por defecto opcional), no como tarjeta separada. · (US-1) (nota del orquestador: "Revisar `_renderUsageRanking` (existente) para reubicarlo/absorberlo")
- RF-9: Los jugadores DEBEN identificarse por `player_id` entero en la URL/parámetros de la tabla y del enlace a ficha/comparación cuando C-08 esté disponible; mientras tanto (o como fallback), el enlace usa el nombre (grafía de `resolve_identity`) igual que hoy. · (US-3) (arquitectura §3.4, §3.12)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `player_game_stats` (`player_id` si C-08 cerró, `starter`, `minutes`) | consumida | — | existe (+C-08) |
| `GET /api/table/team_roster?team=<code>&competition=<id>&last=<n>&base=<b>` | tabla T-06 (id fijado en arquitectura §6, "Ids de tablas … `team_roster` (F-08)") | payload §7.6: una fila por jugador, columnas del conjunto estándar T-05 + `_sample` (badge T-02, si T-02 ya cerró; si no, `sample: null` hasta que T-02 esté disponible) | **NUEVO** (dueño F-08, ya listado en el catálogo de tablas de la arquitectura) |
| `GET /api/metrics/player?id=<player_id>` (o `?team=<code>&name=<name>` legado) | endpoint genérico T-05 (tipo `player`) | shape §7.3 + fichas §7.1 (T-01) | de T-05; F-08 solo lo consume para el detalle de una fila si hace falta |
| `GET /api/players/<team_code>` (mod.) | endpoint legado | `[{player_id, name, games, uso_pct, pts}]` (agrega `player_id` cuando C-08 cierre; shape actual se mantiene si C-08 no está disponible aún) | mod. por C-08; F-08 no lo toca, usa `team_roster` |

Sin cambios de esquema (F-08 no está en la lista de `§5 Cambios de esquema previstos` de la arquitectura).

## 6. Estados de UI
Pestaña **Plantel** de S3 (`#/equipo/<code>/plantel`). Todo copy nuevo con `t()` y marcado para `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Tabla del plantel | spinner en la tabla (copy existente del patrón de tablas) | "Este equipo no tiene jugadores con minutos en la selección." (*nuevo*) | toast con el mensaje del backend o "No se pudo cargar el plantel" (*nuevo*) | `/api/*` siempre a red (SW) | tabla T-06 completa; filas de muestra baja (< `sample.player.min` minutos) en gris con aviso "Muestra baja: se muestra pero no se rankea" (copy compartido con F-06); cada fila con acción "Ver ficha" y "Agregar a comparar" (*nuevo*); pie "N jugadores · M sobre el umbral" (*nuevo*, copy compartido con F-06) |

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "Desde el perfil de un equipo se ve todo el plantel sin abandonar la pantalla." Given un equipo con jugadores con minutos en la selección activa, When se abre la pestaña Plantel dentro de Equipo, Then se ve la tabla completa de todos los jugadores sin navegar a otra sección ni recargar la página.
- CA-2: Given la pestaña Plantel abierta, When se hace clic en el encabezado de cualquier columna del conjunto estándar, Then la tabla se reordena por esa columna con los valores nulos al final en ambos sentidos de orden.
- CA-3: Given un jugador con menos de `sample.player.min` minutos en la selección, When se lo ve en la tabla, Then su fila aparece en gris con la advertencia de muestra baja, su ficha trae los valores igual (no se omite), y no participa del percentil/promedio de la competencia.
- CA-4: Given una fila de la tabla, When se hace clic en "Ver ficha", Then la vista navega a la ficha completa de ese jugador (S4) sin recargar la página.
- CA-5: Given dos filas de la tabla, When se marca "Agregar a comparar" en ambas y se confirma, Then la vista navega a la comparación de jugadores (F-05) con ambos jugadores ya seleccionados.
- CA-6: Given la tabla del plantel, When se exporta a CSV o XLSX, Then el archivo reproduce exactamente las columnas visibles, el orden aplicado y los filtros de contexto activos, con la cabecera de metadatos de T-06.
- CA-7: Given un jugador sin ningún triple intentado en la selección, When se ve su fila, Then `fg3_pct`/`fg3_uso`/`ppt_3` se muestran como "—" (nulo con razón), nunca como 0% o 0,00.
- CA-8: Given la tarjeta "Jugadores más influyentes — USO%" existente antes de F-08, When se implementa F-08, Then esa tarjeta deja de mostrarse por separado y su función (ranking por USO%) queda disponible ordenando la tabla del plantel por la columna `uso_pct`.

## 8. Fuera de alcance
- Ficha de identidad del jugador (dorsal, posición, altura, nacionalidad, foto): F-16.
- Comparación de jugadores en sí (radar, tabla enfrentada): F-05 (F-08 solo enlaza).
- Buscador de jugadores entre equipos: existe (S7), fuera de esta pestaña.
- Filtros rápidos y cabecera de contexto propios de la pestaña: F-19 (F-08 respeta el contexto activo, no construye su propia barra).
- Percentiles de la ficha completa desplegada por jugador (ranking completo al pasar el cursor): eso vive en `metric-card.js`/`GET /api/rankings/<entity>/<metric>` de T-01; F-08 solo consume el componente.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **Columnas por defecto de la tabla.** El cliente pide "métricas principales", sin listar cuáles. Decisión: por defecto se muestran los grupos `produccion`, `tiro_pct`, `tiro_valor`, `balon`, `rebote`, `uso` (subconjunto reducido pero representativo del conjunto de T-05), con el resto disponible vía el selector de columnas de T-06 (persistido por `user_prefs` `table.columns`). No se restringe el conjunto disponible: solo la vista inicial.
2. [DECISIÓN PROPUESTA — confirmar] **Alcance de "Agregar a comparar" (RF-5, CA-5).** El cliente no especifica el mecanismo. Decisión: cada fila tiene un checkbox "Comparar"; con 2 o más marcados aparece un botón flotante "Comparar seleccionados (N)" que navega a `#/comparar/jugadores?a=<id1>&b=<id2>`; si F-05 aún no soporta más de 2, el botón se deshabilita a partir de 3 marcados con un tooltip ("Elegí hasta 2 jugadores").
3. [DECISIÓN PROPUESTA — confirmar] **Destino de `_renderUsageRanking`.** RF-8 asume que la tarjeta se retira de la vista Resumen de Equipo cuando la pestaña Plantel esté disponible (X-01 ya reorganizó Equipo en pestañas en fase 2). Si X-01 no llegó a integrarse cuando se implemente F-08, la tarjeta se mantiene en Resumen hasta que X-01 cierre, y F-08 solo agrega la tabla completa en una sección nueva de la misma vista (sin pestañas) — INCREMENTO DIFERIDO (→ X-01): mudanza a pestaña propia.
4. [DECISIÓN PROPUESTA — confirmar] **Población de percentiles de jugadores sin C-08 cerrado.** Si F-08 se implementa antes de que C-08 complete la tabla `players`/`player_id`, la identidad sigue siendo la de `resolve_identity` (unificación al leer, sin id estable); el enlace de fila usa nombre + equipo en vez de `player_id`, y se migra sin romper URLs cuando C-08 cierre (RF-9 ya lo contempla).
