# Spec — A-08: Sinergias entre jugadores

> **ID:** A-08 · **Prioridad:** P2 · **Fase y orden:** 5·08
> **Depende de:** A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · F-06 ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md)) · A-07 ([../06-A-07-produccion-desde-eventos/spec.md](../06-A-07-produccion-desde-eventos/spec.md), por §9.1 de la arquitectura: provee `chains.assist_pairs_from_events`) · F-07 ([../../fase-4-dia-de-partido/01-F-07-analizar-partido/spec.md](../../fase-4-dia-de-partido/01-F-07-analizar-partido/spec.md), por §9.1) — y, por las capas comunes, T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)), T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)), T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)), C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md)), X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md))
> **Habilita:** F-15 ([../13-F-15-sugerencias-quinteto-ia/spec.md](../13-F-15-sugerencias-quinteto-ia/spec.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §5.4 · A-08 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S3 "Quintetos" y S4 "Impacto" · Arquitectura §3.7, §3.10, §4 (`synergy.py`), §6 (`GET /api/synergy/<team_code>`, tabla `pairs`, tipo `pair`) ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §5.4 A-08):**
- "Matriz de quién asiste a quién dentro del plantel."
- "Quién genera más triples para otro jugador."
- "Quién convierte más puntos tras asistencia de un compañero."
- "Parejas con mejor Net Rating, mejor OER y mayor eficiencia ofensiva (siempre con el ajuste de T-02)."
- "Jugadores que más potencian el rendimiento de otros: diferencial de rendimiento del compañero con y sin ese jugador en cancha."
- **Criterio de aceptación del cliente:** "La matriz de asistencias cuadra con el total de asistencias del equipo en la temporada."

El mapa de secciones ubica el módulo en la pestaña **Quintetos** de S3 ("Combinaciones, tabla completa de todos los quintetos, ON/OFF, sinergias") y en la pestaña **Impacto** de S4 ("+/-, ON/OFF, impacto ajustado, con quién rinde mejor"). El orquestador pidió además "verificar vínculo asistencia → anotador en pbp".

**Qué existe hoy (verificado en código y docs):**
- `backend/lineups.py` calcula quintetos de 3–5 jugadores elegidos (`lineup_stats(games, team_code, players)`) y ON/OFF de un jugador (`onoff_stats`), con segmentos exactos (`build_segments`, fusión de cambios simultáneos, piso monótono por período). **No hay parejas**: la única forma de ver dos jugadores juntos es elegir una "combinación" de 3 como mínimo (`GET /api/lineup/<team>?players=A|B|C` exige 3–5 nombres; `app.py` `lineup_route`).
- `lineups._leaders(evs, players)` (l.148) devuelve el asistidor líder de una combinación (`assist` por `player_name`) pero **no a quién asiste**: el pbp guardado (`PbpEvent`, `database.py`) no tiene el vínculo `previousAction`; el parser `fiba_fetcher.py` (l.436–452) lo descarta. F-11 agrega `pbp_events.previous_action` y `qualifiers` (Arquitectura §1.6: `assist → 2pt/3pt` 459/459 en 13 partidos).
- La asistencia se cuenta hoy por jugador en el box (`player_game_stats.ast`) y por equipo en `team_game_stats.ast`; ninguna pantalla muestra la relación asistente → anotador.

**Qué resolvieron features/requisitos anteriores (de esta misma corrida de specs):**
- A-01: posesiones reconstruidas con `assister_id`/`finisher_id` (una por posesión) y quintetos en cancha de ambos equipos; `lineups.build_segments_both`.
- A-07 (orden anterior en la fase): `chains.assist_pairs_from_events(events, name_to_id, *, team_code)` — vínculo exacto asistente → anotador **de todas las asistencias del pbp**, con vínculo FIBA o de respaldo y marca `sin_vinculo`; A-08 lo consume para la matriz.
- F-06: `lineups.all_lineups(team_code, comp_id, ctx, *, size=5) -> list[StatBundle]` y la tabla `team_lineups` con el conjunto estándar, ajuste y badge para quintetos; A-08 generaliza `all_lineups` a `size=2`.
- T-02: entidad "pareja de jugadores" con mínimo 30 posesiones, alta 80, regresión con K = 25 (`sample.pair.*`, `regression.pair.k`); T-05: tipo de entidad `pair` a cargo de A-08; T-06: tabla `pairs` a cargo de A-08.

**Qué queda para A-08:** el módulo `synergy.py` (matriz de asistencias, ranking de triples generados y de puntos tras asistencia, tabla de parejas con ajuste de T-02, ranking de jugadores que potencian a sus compañeros), su endpoint, su tabla y su presentación en S3 Quintetos y S4 Impacto, con la verificación de que la matriz cuadra con el total de asistencias del equipo.

## 1. Objetivo
Mostrar, para un equipo y para un jugador, quién asiste a quién (matriz y rankings de triples y puntos generados), qué parejas rinden mejor (Net Rating, OER y eficiencia ofensiva, siempre con el ajuste de muestra de T-02) y qué jugadores hacen mejores a sus compañeros, con la garantía de que la matriz de asistencias cuadra con el total de asistencias del equipo.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5.4 A-08 (completo), §1.3 S3 "Quintetos" y S4 "Impacto", §3 T-01, T-02 (pareja: 30/80 posesiones, regresión K), T-03, T-05 ("pareja de jugadores" como entidad), T-06, §2 C-11, §6 Glosario (OER, DER, Net Rating, eFG%, TS%, Valor ajustado).
- `docs/api.md` (`/api/lineup`, `/api/onoff`, `/api/pbp/<game_id>`); `docs/metrics.md` (fórmulas de OER, DER, Net Rating, eFG%, TS%, posesión); `docs/database.md` (`pbp_events`, `team_game_stats.ast`, `player_game_stats.ast`).
- Arquitectura §1.6 (vínculo `assist → 2pt/3pt`), §3.7 (`sample.py`: `sample_level`, `adjusted`, `band`; prior), §3.10 (`all_lineups`, parejas K = 2: "generaliza lineup_stats/all_lineups a size=2", dueño A-08), §4 (`synergy.py`: `assist_matrix`, `pair_table`, `teammate_impact`), §6 (`GET /api/synergy/<team_code>`, tabla `pairs`, tipo `pair`), §7.1–§7.6, §8.
- Specs/planes previos de esta corrida: A-07 `plan.md` §4.10 (`assist_pairs_from_events`), F-06 `plan.md` §4 (`all_lineups`), T-02 `plan.md` (pareja), A-01 `plan.md` §4.1 (`build_segments_both`).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver quién le asiste a quién en mi plantel, para entender cómo circula el balón y quién depende de quién para anotar.
- US-2: Como entrenador, quiero saber qué jugador genera más triples para otro y qué jugador convierte más puntos tras asistencia de un compañero, para diseñar jugadas con esas conexiones.
- US-3: Como entrenador, quiero ver qué parejas de jugadores rinden mejor con la muestra ajustada, para armar quintetos con evidencia y no con una racha de pocas posesiones.
- US-4: Como analista, quiero saber qué jugadores mejoran a sus compañeros (rendimiento con y sin él en cancha), para identificar al que "hace jugar" al resto.
- US-5: Como analista, quiero que la matriz de asistencias cuadre con el total de asistencias del equipo, para confiar en ella.
- US-6: Como analista, quiero ver, desde la ficha de un jugador, con quién rinde mejor y a quién potencia, para evaluar su rol.

## 4. Requisitos funcionales

**Matriz de asistencias**
- RF-1: El sistema DEBE mostrar, para un equipo, la **matriz asistente → anotador**: una fila por jugador que asiste, una columna por jugador que anota, y en cada celda las canastas de campo asistidas (cantidad), los puntos de esas canastas y cuántas fueron triples. · (US-1) (Esp. v2 §A-08 "Matriz de quién asiste a quién")
- RF-2: La matriz DEBE incluir **totales por fila** (asistencias dadas), **totales por columna** (asistencias recibidas) y una columna/fila **"Sin vínculo"** con las asistencias cuyo anotador no se pudo identificar (dato inconsistente, tiro no encontrado), de modo que `Σ celdas + sin_vínculo = asistencias del equipo`. · (US-5) (Esp. v2 §A-08 criterio de aceptación)
- RF-3: El sistema DEBE **verificar el vínculo asistencia → anotador** del pbp: informar, por selección, cuántas asistencias se vincularon por el vínculo oficial de FIBA, cuántas por proximidad de eventos (respaldo) y cuántas quedaron sin vínculo, y que toda asistencia vinculada apunta a una canasta de campo **convertida de un compañero distinto al asistente**. · (US-5) (Orquestador: "Verificar vínculo asistencia→anotador en pbp"; Arq. §1.6)
- RF-4: El sistema DEBE ofrecer la **conciliación** de la matriz: total de la matriz + sin vínculo = asistencias del pbp de los partidos con pbp = asistencias del box (`team_game_stats.ast`) de esos mismos partidos; las diferencias deben listarse por partido con su causa probable. · (US-5) (Esp. v2 §A-08 criterio de aceptación)

**Triples y puntos tras asistencia**
- RF-5: El sistema DEBE mostrar el ranking **"Quién genera más triples para otro jugador"**: pares asistente → anotador ordenados por triples asistidos, y por jugador el total de triples que genera para compañeros. · (US-2) (Esp. v2 §A-08)
- RF-6: El sistema DEBE mostrar el ranking **"Quién convierte más puntos tras asistencia de un compañero"**: por anotador, puntos de canastas de campo asistidas, porcentaje de sus canastas de campo que fueron asistidas y su asistente principal. · (US-2) (Esp. v2 §A-08)
- RF-7: Los rankings de RF-5 y RF-6 DEBEN excluir de las posiciones destacadas a quienes no llegan al mínimo de muestra de T-02 para jugador (minutos) y mostrarlos igual en gris, sin ranking. · (US-2) (Esp. v2 §T-02 "queda fuera de rankings")

**Parejas**
- RF-8: El sistema DEBE calcular, para **cada pareja de jugadores del plantel** que compartió cancha, el **conjunto estándar de T-05** del equipo mientras ambos están en cancha (tipo de entidad `pair`), incluidos OER, DER, Net Rating, eFG% y TS%, con muestra de respaldo (posesiones, minutos, partidos). · (US-3) (Esp. v2 §A-08, §T-05 "pareja de jugadores")
- RF-9: El sistema DEBE aplicar a las parejas el **ajuste de T-02** (umbrales de pareja: mínimo 30 posesiones, alta 80; regresión a la media con K = `regression.pair.k` y banda de error) y ordenar todo ranking de parejas por el valor **ajustado**. · (US-3) (Esp. v2 §A-08 "siempre con el ajuste de T-02"; §T-02)
- RF-10: El sistema DEBE presentar tres rankings de parejas: **mejor Net Rating** (ajustado), **mejor OER** (ajustado) y **mayor eficiencia ofensiva** (TS%), cada uno con las posiciones destacadas solo para parejas con muestra suficiente; las de muestra baja se muestran en gris con advertencia y fuera del ranking. · (US-3) (Esp. v2 §A-08; §T-02)
- RF-11: El sistema DEBE ofrecer la **tabla completa de parejas** (`pairs`, T-06) con todas las parejas, el conjunto estándar, el badge de muestra, los valores crudo y ajustado y la exportación. · (US-3) (Esp. v2 §T-06)

**Jugadores que potencian a otros**
- RF-12: El sistema DEBE calcular, para cada jugador A y cada compañero B, el **diferencial de rendimiento de B con y sin A en cancha**: Net Rating (y OER) del equipo cuando B está en cancha **junto a A** menos cuando B está en cancha **sin A**, con ajuste de T-02 en cada estado y exigiendo muestra suficiente en ambos. · (US-4) (Esp. v2 §A-08 "diferencial de rendimiento del compañero con y sin ese jugador")
- RF-13: El sistema DEBE ordenar a los jugadores por su **impacto sobre compañeros** (promedio del diferencial sobre los compañeros con muestra en ambos estados, ponderado por la menor de las dos muestras), mostrando cuántos compañeros entran en el cálculo y el detalle por compañero. · (US-4) (Esp. v2 §A-08)
- RF-14: En S4 Impacto, el sistema DEBE mostrar para el jugador consultado: sus **mejores parejas** (con quién rinde mejor), a **quién asiste más** y **quién le asiste más**, y **a quién potencia** (detalle del RF-12). · (US-6) (Esp. v2 §1.3 S4 "con quién rinde mejor")

**Capas comunes**
- RF-15: El sistema DEBE aceptar el contexto T-03 de partido y de evento (competencia, período, sede, rival, descanso, cuarto, marcador, con/sin jugador) y devolver el eco `context`; las dimensiones de posesión (`clock`, `clock_start`, `origin`, `ptype`, `chance`) se ignoran con razón `no_aplica` informada en `context.ignored`. · (US-1, US-3) (Esp. v2 §T-03)
- RF-16: Todo valor sin base de cálculo DEBE mostrarse nulo con razón (`sin_intentos`, `sin_pbp`, `sin_datos`, `no_aplica`), nunca 0; las celdas de la matriz sin asistencias son 0 **real** cuando el equipo tiene partidos con pbp y vacías ("·") en la visualización. · (US-1) (C-08/C-11)
- RF-17: Los jugadores de la matriz y de las parejas DEBEN identificarse por `player_id` (sin duplicados por variantes del nombre). · (US-1) (Esp. v2 §C-08)
- RF-18: Matriz, rankings y tablas DEBEN ser exportables (CSV, XLSX, PNG, PDF) con los filtros activos documentados en la cabecera. · (US-3) (Esp. v2 §T-06)

## 5. Requisitos de datos / API
| Tabla / Endpoint | Tipo | Campos / Shape | ¿Nuevo? |
|---|---|---|---|
| `GET /api/synergy/<team_code>` + contexto T-03 | endpoint (Arq. §6) | `{assist_matrix, pairs, teammate_impact}` (+ `check`, `context`); `?player=<player_id>` agrega el recorte para S4 (PROPUESTA); el shape lo fija `plan.md` §3 | **NUEVO** (ruta y claves de primer nivel fijadas en Arq. §6) |
| `GET /api/table/pairs` (T-06) | tabla (Arq. §6) | una fila por pareja con el conjunto estándar (payload §7.6) | **NUEVO** (id fijado en Arq. §6) |
| `GET /api/metrics/pair?id=<team_code>:<pid>-<pid>` (T-05) | entidad estándar (Arq. §6) | payload §7.3 | **NUEVO** (tipo fijado en Arq. §6) |
| `pbp_events.previous_action`, `pbp_events.qualifiers` | columnas (F-11) | vínculo FIBA | existen desde F-11; A-08 solo las lee |

Sin cambios de esquema (Arq. §5: A-08 es on-the-fly). Claves de configuración: A-08 no agrega ninguna; consume `sample.pair.min/high/rel_pct`, `regression.pair.k`, `sample.player.min`, `population.min_size` (T-02/F-13).

## 6. Estados de UI
S3 Equipo → pestaña **Quintetos** (`#/equipo/<code>/quintetos`), sección "Sinergias"; S4 Jugador → pestaña **Impacto** (`#/jugador/<id>/impacto`). Copy nuevo marcado `(nuevo)` para `docs/frontend.md`.

| Vista / componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Sección Sinergias (S3) | spinner + "Calculando sinergias…" (nuevo) | "Todavía no hay play-by-play importado para este equipo." (nuevo) · "Ningún partido coincide con los filtros." (nuevo) | 404 "Este equipo no tiene play-by-play importado. Reimportá sus partidos." (nuevo) · 400 contexto: mensaje del backend · 5xx "No se pudieron calcular las sinergias." (nuevo) | "Sin conexión: las sinergias necesitan conexión." (nuevo) | cuatro bloques: matriz, triples y puntos tras asistencia, parejas, potenciadores |
| Matriz de asistencias | — | "El equipo no registra asistencias en la selección." (nuevo) | — | — | matriz con intensidad por cantidad, totales, columna "Sin vínculo", leyenda "Filas: quien asiste · Columnas: quien anota" (nuevo) |
| Rankings de parejas | — | "Ninguna pareja alcanza la muestra mínima." (nuevo) | — | — | tres rankings con badge T-02, crudo y ajustado, banda; parejas BAJA en gris |
| Tabla de parejas / exportar | skeleton | "Sin datos para exportar." (nuevo) | toast del backend | — | `data-table.js` con exportación (T-06) |
| Potenciadores | — | "Ningún jugador tiene compañeros con muestra suficiente en ambos estados." (nuevo) | — | — | ranking con "N compañeros" y detalle plegable |
| Verificación de vínculo | — | — | aviso "N asistencias sin anotador identificado." (nuevo, si > 0) | — | "Cuadra: matriz + sin vínculo = asistencias del equipo (N)." (nuevo) |
| Impacto en S4 | spinner | "Este jugador no tiene parejas con muestra suficiente." (nuevo) | — | — | mejores parejas, a quién asiste, quién le asiste, a quién potencia |
| Valor nulo | — | "—" con `title` = razón (`nullDisplay`) | — | — | sin color de rendimiento |

Mobile (<768 px): la matriz se desplaza horizontalmente **dentro de su card** con primera columna y cabecera fijas; rankings y tablas en una columna; sin cambios en la nav inferior.

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "La matriz de asistencias cuadra con el total de asistencias del equipo en la temporada." Given un equipo y una competencia con pbp importado, When se suman todas las celdas de la matriz más la columna "Sin vínculo", Then el resultado es igual al total de asistencias del equipo (eventos `assist` del pbp de los partidos de la selección y `team_game_stats.ast` de esos mismos partidos), y la suma de totales por fila es igual a la suma de totales por columna más "Sin vínculo".
- CA-2 (vínculo): Given los 13 partidos del seed reprocesados con ingesta v2, When se consulta `check.link`, Then `fiba + respaldo + sin_vinculo = asistencias` y, para toda asistencia vinculada, el anotador es un compañero distinto del asistente y el tiro vinculado es una canasta de campo convertida; `sin_vinculo` es 0 salvo anomalías listadas.
- CA-3 (conciliación por partido): Given un partido, When se suma su matriz parcial, Then coincide con las asistencias del partido (`team_game_stats.ast`) y con `GET /api/pbp/<game_id>`; los partidos que difieran quedan listados con causa probable.
- CA-4 (triples): Given un par asistente → anotador de la matriz, When se cuentan a mano en el pbp las canastas de 3 asistidas por A a B, Then el valor `threes` de la celda coincide; y el ranking "genera más triples" se ordena por esa cantidad.
- CA-5 (puntos tras asistencia): Given un anotador, When se suman los puntos de sus canastas de campo asistidas y se dividen sobre sus puntos de campo, Then coincide con `assisted_pts` y con el porcentaje asistido mostrado.
- CA-6 (parejas, ajuste T-02): Given una pareja con menos posesiones que el mínimo efectivo de pareja (30 por defecto), When se ve la tabla o los rankings, Then aparece en gris con badge BAJA, advertencia, valor crudo visible y **no** aparece en las posiciones destacadas; Given una pareja con muestra suficiente, Then trae valor crudo, ajustado `(pos·valor + K·prior)/(pos + K)` con K = 25, y banda.
- CA-7 (orden por ajustado): Given el ranking "mejor Net Rating", When se lo compara con el orden por Net crudo, Then el orden usa el ajustado (`adj.value`), verificable recalculando `net_aj = oer_aj − der_aj` para dos parejas.
- CA-8 (estándar, T-05): Given `GET /api/metrics/pair?id=<equipo>:<pid>-<pid>`, `GET /api/metrics/lineup?id=…` y `GET /api/metrics/player?id=…`, When se comparan los grupos de métricas, Then son los mismos, sin huecos (los que no aplican, nulos con razón).
- CA-9 (coherencia con quintetos): Given una pareja (A, B), When se compara su posesión total con la suma de las posesiones de los quintetos de `team_lineups` que contienen a A y a B, Then son iguales (un tramo con A y B en cancha pertenece a un solo quinteto).
- CA-10 (potenciadores): Given un jugador A y un compañero B, When se recalcula a mano el Net ajustado de B con A (tramos con A y B en cancha) y sin A (tramos con B y sin A), Then el diferencial mostrado coincide; y `posesiones con A + posesiones sin A = posesiones de B en cancha`.
- CA-11 (muestra en ambos estados): Given un compañero B con menos posesiones que el mínimo de pareja en alguno de los dos estados, When se ve el detalle de A, Then B aparece en gris y no entra en el promedio ponderado ni en el conteo "N compañeros".
- CA-12 (nulos): Given un equipo sin pbp, Then 404 `sin_pbp`; Given una pareja sin intentos de tiro libre, Then FT% es "—" con razón `sin_intentos`; Given un jugador sin asistencias, Then su fila de la matriz está vacía ("·") y sus totales son 0 reales.
- CA-13 (contexto): Given `last=5`, When se pide la sinergia, Then solo cuentan los últimos 5 partidos del equipo (`context.games_used = 5`) y el cuadre de CA-1 se mantiene sobre esos partidos; Given `quarter=4`, Then la matriz cuenta solo asistencias del 4.º cuarto y sigue cuadrando contra los eventos `assist` de ese cuarto.
- CA-14 (identidad, C-08): Given un jugador con dos grafías de nombre en el pbp, When se ve la matriz, Then aparece una sola fila/columna con sus asistencias sumadas.
- CA-15 (S4 Impacto): Given un jugador, When se abre Impacto, Then muestra sus mejores parejas, a quién asiste, quién le asiste y a quién potencia, con valores iguales a los de la pestaña Quintetos del equipo.
- CA-16 (exportación, T-06): Given la tabla `pairs`, When se exporta a CSV con un filtro activo, Then el archivo reproduce lo mostrado y su cabecera documenta el filtro; la matriz se exporta con filas = asistentes y columnas = anotadores.
- CA-17 (rendimiento): Given la competencia del seed (13 partidos), When se pide `GET /api/synergy/<team>` en frío, Then responde en menos de 5 s y en caliente en menos de 1,5 s.

## 8. Fuera de alcance
- Sinergias de **tres o más** jugadores (tríos): los quintetos ya se cubren en F-06; v2 trabaja parejas.
- Marcaje defensivo individual y "quién defiende a quién": FIBA no lo registra (F-03 lo advierte); la pareja se mide por coincidencia en cancha.
- Asistencias "secundarias" (pase previo al pase) y pases: FIBA no los publica.
- Sugerencias de quinteto asistidas por IA que usan estas sinergias: F-15.
- Comparación de dos parejas lado a lado: no está en v2.
- Percentiles contra otros equipos de la competencia para métricas de pareja: la población de T-01 para `pair` es **el plantel del equipo** (una pareja solo existe dentro de un equipo, §9.5); no hay ranking de parejas de toda la liga en v2.
- Impacto ajustado (RAPM) y ON/OFF por jugador: A-11 y F-06 respectivamente.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **"Mayor eficiencia ofensiva"** (RF-10) frente a "mejor OER": OER ya es eficiencia ofensiva por posesión. Decisión: el tercer ranking usa **TS%** (eficiencia de tiro) para no duplicar el OER; ambos aparecen etiquetados. Si el cliente quería otra métrica (eFG%, PPT), solo cambia la clave del tercer ranking.
2. [DECISIÓN PROPUESTA — confirmar] **Matriz basada en eventos del pbp, no en posesiones.** El vínculo `assist → tiro` se lee de los eventos (todas las asistencias, también las de posesiones incompletas de A-01), para que el cuadre con el total del equipo sea exacto. Las celdas cuentan **canastas de campo asistidas**; los puntos de la celda son los de la canasta (2 o 3), sin el tiro libre del and-one (a diferencia de A-07, que cuenta "puntos de la posesión").
3. [DECISIÓN PROPUESTA — confirmar] **Mínimos de muestra de la matriz.** Es una tabla de conteos, no una tasa de posesiones: no lleva badge por celda. Los rankings por jugador (RF-5/RF-6) usan el mínimo de jugador de T-02 (`sample.player.min`, 60 minutos) para las posiciones destacadas.
4. [DECISIÓN PROPUESTA — confirmar] **Umbrales de "con y sin jugador"** (RF-12): cada estado (B con A, B sin A) debe alcanzar el **mínimo de pareja** de T-02 (30 posesiones) y se ajusta con K = `regression.pair.k` (25); no se agrega una entidad nueva en T-02/F-13. Si el cliente prefiere los umbrales de ON/OFF (40 posesiones por estado, K = 50), se cambia la clave de entidad sin tocar el algoritmo.
5. [DECISIÓN PROPUESTA — confirmar] **Población de T-01 para parejas** = las parejas del propio equipo con muestra suficiente (no hay parejas "de la competencia" comparables entre equipos); percentil y ranking se calculan dentro del plantel, y la ficha lo indica en `population.criterion`. Se reporta como hueco de la arquitectura (T-01 define poblaciones por competencia).
6. [DECISIÓN PROPUESTA — confirmar] **Definición del rendimiento del compañero:** Net Rating (y OER) **del equipo** mientras B está en cancha, con y sin A. No se usa una métrica individual de B porque la regresión de T-02 aplica a OER/DER/Net de entidades tipo split/pareja y porque el efecto de A sobre B se manifiesta en el rendimiento colectivo.
7. [DECISIÓN PROPUESTA — confirmar] **Agregación del impacto de A** (RF-13): promedio del diferencial ponderado por `min(posesiones con A, posesiones sin A)` de cada compañero válido; el badge de A usa la muestra media por compañero (`Σ pesos / N`). Un jugador con un solo compañero válido se muestra pero sin posición destacada.
8. [DECISIÓN PROPUESTA — confirmar] **Parámetro `player` en `GET /api/synergy/<team_code>`** para el recorte de S4: no figura en Arq. §6 y se reporta como PROPUESTA.
9. [DECISIÓN PROPUESTA — confirmar] **Contexto de posesión no aplica** (RF-15): las parejas y la matriz se calculan sobre tramos de cancha y eventos; los filtros `clock`, `origin`, `ptype`, `chance` no tienen sentido para el vínculo asistente-anotador y se ignoran con razón `no_aplica` (no `requiere_posesiones`).
