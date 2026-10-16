# Spec — A-07: Producción desde eventos

> **ID:** A-07 · **Prioridad:** P1 · **Fase y orden:** 5·06
> **Depende de:** A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)) · A-02 ([../../fase-3-contexto-posesion/02-A-02-origen-posesion/spec.md](../../fase-3-contexto-posesion/02-A-02-origen-posesion/spec.md)) · A-03 ([../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/spec.md](../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/spec.md)) · A-04 ([../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/spec.md](../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/spec.md)) · F-01 ([../../fase-4-dia-de-partido/03-F-01-partido-en-vivo/spec.md](../../fase-4-dia-de-partido/03-F-01-partido-en-vivo/spec.md), crea `chains.py`) — y, por las capas comunes, T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)), T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)), T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)), T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)), T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)), X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md))
> **Habilita:** A-08 ([../08-A-08-sinergias-jugadores/spec.md](../08-A-08-sinergias-jugadores/spec.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §5.4 · A-07 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S3 "Eventos" y S4 "Eventos" · Arquitectura §3.9, §4 (`chains.py`), §6 (`/api/events-production`, tabla `events_production`, tipo `chain`), §9.2 (I-11) ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §5.4 A-07):** "No mostrar solamente la cantidad de cada evento, sino su consecuencia. Aplica a equipo y a jugador." Y, por evento:
- **Asistencias:** "Puntos generados por asistencias · asistencias que terminan en doble · en triple · en 2+1 · promedio de puntos generados por asistencia · jugador al que más asiste".
- **Rebotes ofensivos:** "Resultado de cada rebote ofensivo: putback · doble · triple · falta recibida · pérdida · finalización sin puntos" y "Puntos generados tras rebote ofensivo · conversión de segundas oportunidades · puntos por rebote ofensivo".
- **Rebotes defensivos:** "Cuántos inician contraataque · cuántos terminan en anotación · puntos generados después · primer pase de salida".
- **Robos:** "Resultado de cada robo: doble · triple · falta recibida · pérdida posterior · sin conversión" y "Puntos generados tras cada robo · eficiencia de las posesiones iniciadas con recuperación".
- **Pérdidas:** "Puntos recibidos tras cada pérdida · dobles recibidos · triples recibidos · faltas recibidas por el rival" y "Costo promedio por pérdida · porcentaje de pérdidas castigadas por el rival".

El mapa de secciones (§1.3) ubica el módulo en la pestaña **Eventos** de S3 Equipo ("Producción tras asistencia, robo, rebote ofensivo, rebote defensivo y pérdida") y de S4 Jugador ("Asistencias, robos, rebotes ofensivos y pérdidas con su consecuencia en puntos"). **El cliente no define "Criterio de aceptación" para A-07**: los CA de §7 son propuestos (§9 punto 1).

**Qué existe hoy (verificado en código y docs):**
- `backend/lineups.py` `_agg(evs, team_code)` (l.17) cuenta `ast`, `stl`, `tov`, `orb`, `drb` de un equipo sobre una lista de eventos de pbp, y `onoff_stats`/`lineup_stats` las muestran como **conteos crudos** (`reb/orb/drb/ast/tov/stl/blk`). Ninguna pantalla muestra qué pasó *después* del evento.
- `backend/database.py` `TeamGameStats` guarda el desglose oficial de FIBA `second_chance_pts` (PtsSegCh) y `pts_from_tov` (PtPer, "puntos tras pérdida rival") (l.106–107; `docs/database.md` l.95–96) y la vista Equipo los muestra en la card "Desglose ofensivo" (`docs/frontend.md` l.37). Son totales por partido, sin desglose por jugador ni por resultado de la cadena, y sirven como **referencia de conciliación**.
- `pbp_events` guarda `team_code`, `player_name`, `period`, `period_type`, `clock_secs`, `s1`, `s2`, `action_type`, `sub_type`, `success`, `action_number` (`database.py` `PbpEvent`; el parser `fiba_fetcher.py` l.436–452 no lee `previousAction` ni `qualifier[]` todavía: los agrega F-11 como `previous_action`/`qualifiers`, ver Arquitectura §1.6 y §5).
- `docs/api.md` documenta `GET /api/pbp/<game_id>` (verificación del pbp). No existe ningún endpoint de producción por evento.

**Qué resolvieron features/requisitos anteriores (de esta misma corrida de specs):**
- A-01 reconstruye cada posesión como registro (`Possession`: `end_type`, `pts`, `finisher_id`, `assister_id`, `turnover_by_id`, `chances[]`, `incomplete`, conteos `box`/`opp_box`).
- A-02 asigna `origin` (incluye `robo`, `rebote_defensivo`, `perdida_rival`); A-03 asigna `ptype` (`transicion|early|media_cancha`); A-04 asigna `Chance.outcome` y los campos de captura del rebote ofensivo (`oreb_by_id`).
- F-01 (fase 4) ya creó `backend/chains.py` con cuatro primitivas mínimas (`assist_points`, `oreb_points`, `steal_points`, `turnover_cost`) para el bloque de jugadores del partido en vivo; su spec declara "INCREMENTO DIFERIDO (→ A-07): desglose fino de producción desde eventos para el análisis histórico completo".

**Qué queda para A-07:** el análisis histórico completo, por equipo y por jugador, sobre toda la selección (competencia + contexto T-03): resultado de cada evento, puntos asociados y tasas derivadas, con el conjunto estándar de T-05 para cada cadena (tipo de entidad `chain`), la ficha de T-01 y el badge de T-02, la tabla completa exportable de T-06 y la pestaña Eventos de S3/S4. Extiende `chains.py` sin cambiar las firmas públicas de F-01.

## 1. Objetivo
Mostrar, para un equipo y para un jugador, la **consecuencia en puntos** de cada asistencia, rebote ofensivo, rebote defensivo, robo y pérdida —desenlace, puntos generados o recibidos y tasas derivadas— calculada sobre las cadenas de posesión de A-01 a A-04, en la pestaña Eventos de Equipo y Jugador.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5.4 A-07 (completo), §1.3 S3 y S4 (pestaña Eventos), §3 T-01, T-02, T-03, T-05 ("cadena de evento" como entidad), T-06, §2 C-11 (nulos), §6 Glosario (Posesión, Putback, Puntos por rebote ofensivo, Transición).
- `docs/database.md` §`team_game_stats` (`second_chance_pts`, `pts_from_tov`), §`pbp_events`; `docs/api.md` (`/api/pbp/<game_id>`, razones de nulo); `docs/frontend.md` (card "Desglose ofensivo"); `docs/metrics.md` (fórmula de posesión).
- Arquitectura §1.6 (vínculos `assist → 2pt/3pt`, `steal → turnover`, `rebound → tiro fallado`), §3.9 (`Possession`, `Chance`, enriquecedores), §4 (`chains.py`: `assist_points`, `oreb_points`, `steal_points`, `turnover_cost`), §6 (`GET /api/events-production`, tabla `events_production`, tipo de entidad `chain`), §7.1–§7.6, §8 (`metric-card.js`, `sample-badge.js`, `data-table.js`, `export-menu.js`), §9.2 I-11.
- Specs/planes previos de esta corrida: A-01 `plan.md` §4 (`assist`, `steal`, `turnover` en la máquina de estados), A-02 `plan.md` §4.1 (origen), A-04 `plan.md` §3–§4 (desenlaces, `Chance`), F-01 `plan.md` §4 (`chains.py`).

## 3. Historias de usuario
- US-1: Como entrenador, quiero saber cuántos puntos genera mi equipo después de cada asistencia, rebote ofensivo y robo, para valorar el *resultado* de esas acciones y no solo cuántas hubo.
- US-2: Como entrenador, quiero saber cuántos puntos nos hacen después de cada pérdida nuestra y qué porcentaje de pérdidas nos castigan, para dimensionar el costo real del descuido.
- US-3: Como analista, quiero ver la misma producción por jugador (a quién asiste, quién captura rebotes que terminan en puntos, quién recupera y quién pierde balones caros), para evaluar roles con evidencia.
- US-4: Como analista, quiero que cada porcentaje de esta pestaña venga con su muestra y su ranking en la competencia, para no sobre-interpretar un jugador con 3 robos.
- US-5: Como entrenador, quiero exportar estas tablas con los filtros activos, para llevarlas al cuerpo técnico.

## 4. Requisitos funcionales

**Estructura general**
- RF-1: El sistema DEBE mostrar, en la pestaña **Eventos** de S3 Equipo y de S4 Jugador, cinco bloques —Asistencias, Rebotes ofensivos, Rebotes defensivos, Robos y Pérdidas— con la consecuencia en puntos de cada evento. · (US-1…US-3) (Esp. v2 §A-07, §1.3 S3/S4)
- RF-2: El sistema DEBE calcular toda consecuencia sobre las **cadenas de posesión** reconstruidas por A-01 (posesión que contiene el evento o que lo sigue), no sobre fórmulas agregadas ni sobre el box de FIBA. Las posesiones incompletas de A-01 quedan **excluidas** de los desenlaces y se informan aparte ("eventos en posesiones incompletas"), nunca imputadas a cero. · (US-1) (Esp. v2 §A-01 regla C-11; Arq. §3.9)
- RF-3: El sistema DEBE aceptar el contexto de la barra de T-03 (competencia, período, sede, rival, cuarto, marcador, con/sin jugador, dimensiones de posesión) y devolver el eco `context` con partidos usados y excluidos (`sin_pbp`). · (US-1, US-3) (Esp. v2 §T-03; Arq. §3.8, §7.5)

**Asistencias**
- RF-4: El sistema DEBE contar las asistencias **vinculadas a una canasta de campo convertida** de la selección (vínculo `assist → 2pt/3pt` de FIBA) y mostrar los **puntos generados por asistencias**: Σ `pts` de las posesiones que terminan en canasta asistida (incluye el tiro libre de un and-one de esa posesión). · (US-1) (Esp. v2 §A-07 "Puntos generados por asistencias")
- RF-5: El sistema DEBE repartir las asistencias vinculadas, de forma exhaustiva y disjunta, en **doble** (canasta de 2 sin adicional), **triple** (canasta de 3 sin adicional) y **2+1** (cualquier canasta de campo asistida con tiro libre adicional concedido por falta en el tiro, "and-one"), con cantidad, porcentaje y puntos de cada categoría. · (US-1) (Esp. v2 §A-07 "a doble · en triple · en 2+1")
- RF-6: El sistema DEBE calcular el **promedio de puntos generados por asistencia** = puntos generados / asistencias vinculadas (nulo `sin_intentos` si no hay asistencias). · (US-1) (Esp. v2 §A-07)
- RF-7: El sistema DEBE mostrar el **jugador al que más asiste**: para un jugador, el receptor con más canastas asistidas por él (con cantidad y puntos); para un equipo, el par asistente → receptor más frecuente y el receptor que más asistencias recibe. Empates → orden alfabético del nombre. · (US-1, US-3) (Esp. v2 §A-07 "jugador al que más asiste")
- RF-8: El sistema DEBE informar las asistencias **sin canasta vinculada** (dato inconsistente, tiro no encontrado o posesión incompleta) como categoría explícita, de modo que `vinculadas + sin_vínculo + en_posesión_incompleta = asistencias del pbp`. · (US-1) (C-11)

**Rebotes ofensivos** (coherentes con A-04)
- RF-9: El sistema DEBE repartir cada rebote ofensivo capturado (cada `Chance` n ≥ 2 de posesiones completas) en **putback, doble, triple, falta recibida, pérdida y finalización sin puntos**, con cantidad, porcentaje, puntos y PPP de cada resultado. La partición es la de `Chance.outcome` de A-04 con `doble`/`triple` = canasta de campo convertida que no es putback, según el valor de la canasta. · (US-1) (Esp. v2 §A-07 "Resultado de cada rebote ofensivo"; A-04)
- RF-10: El sistema DEBE calcular **puntos generados tras rebote ofensivo** (Σ `pts` de las oportunidades abiertas por el rebote), **conversión de segundas oportunidades** (% de rebotes ofensivos cuya oportunidad termina en puntos) y **puntos por rebote ofensivo** (puntos / rebotes ofensivos capturados), con los **mismos valores** que A-04 para la misma selección. · (US-1) (Esp. v2 §A-07; §6 Glosario "Puntos por rebote ofensivo")
- RF-11: En modo jugador, el sistema DEBE atribuir el rebote y sus puntos a quien lo captura; los rebotes de equipo (sin jugador) aparecen como fila "Rebote de equipo" en el modo equipo y no se asignan a ningún jugador. · (US-3) (Arq. §1.6: 141 rebotes de equipo en 13 partidos)

**Rebotes defensivos**
- RF-12: El sistema DEBE mostrar, para los rebotes defensivos que abren una posesión propia completa: cuántos **inician contraataque** (la posesión que abren es de tipo `transicion` según A-03), cuántos de esos **terminan en anotación** (la posesión suma puntos), los **puntos generados después** (Σ `pts` de las posesiones abiertas por rebote defensivo, y el subtotal de las de transición) y su PPP. · (US-1) (Esp. v2 §A-07 "Rebotes defensivos"; A-03)
- RF-13: El **primer pase de salida** NO se puede calcular porque FIBA LiveStats no publica los pases: el sistema DEBE mostrarlo como nulo con razón `no_registrado` (nunca como 0) y con la leyenda "FIBA no registra los pases de salida". · (US-1) (C-11; Arq. §1.6 "No publicados")

**Robos**
- RF-14: El sistema DEBE repartir los robos —cada robo con la posesión propia que sigue, identificada por el vínculo `steal → turnover`— en **doble, triple, falta recibida, pérdida posterior y sin conversión**, con cantidad, porcentaje y puntos. · (US-1) (Esp. v2 §A-07 "Resultado de cada robo")
- RF-15: El sistema DEBE calcular los **puntos generados tras cada robo** (promedio y total) y la **eficiencia de las posesiones iniciadas con recuperación**: PPP de las posesiones con origen `robo` (A-02), comparado con el PPP de todas las posesiones propias. · (US-1) (Esp. v2 §A-07 "eficiencia de las posesiones iniciadas con recuperación")

**Pérdidas**
- RF-16: El sistema DEBE asociar a cada pérdida propia la posesión **inmediatamente siguiente del rival** y mostrar los **puntos recibidos** tras la pérdida (total y por pérdida), los **dobles recibidos**, **triples recibidos** y **faltas recibidas por el rival** (la posesión rival termina en tiros libres), más "sin castigo". · (US-2) (Esp. v2 §A-07 "Pérdidas")
- RF-17: El sistema DEBE calcular el **costo promedio por pérdida** = puntos recibidos / pérdidas con posesión rival siguiente, y el **porcentaje de pérdidas castigadas** = pérdidas tras las cuales el rival suma al menos 1 punto en esa posesión / pérdidas con posesión rival siguiente. Las pérdidas sin posesión rival siguiente (fin de período) se informan aparte como `sin_posesion_siguiente`. · (US-2) (Esp. v2 §A-07)
- RF-18: En modo jugador, la pérdida se atribuye a quien la comete; las pérdidas de equipo (sin jugador) aparecen como fila "Pérdida de equipo" en modo equipo. · (US-3)

**Capas comunes**
- RF-19: Toda tasa y todo promedio de los cinco bloques DEBE ser un cociente de totales (pooled) de la selección y, cuando el denominador es 0, devolver nulo con razón `sin_intentos`; los conteos sin eventos son 0 real solo si el equipo/jugador tiene posesiones en la selección. Partido o selección sin pbp → nulo `sin_pbp`. · (US-1) (C-11; Arq. §2.1)
- RF-20: Cada bloque DEBE llevar el **badge de muestra** de T-02 (eventos del bloque como unidad) y las tasas clave DEBEN llevar la **ficha T-01** (ranking, líder, promedio, percentil dentro de la competencia). Un bloque por debajo del mínimo se muestra en gris con advertencia y no entra en la población de percentiles. · (US-4) (Esp. v2 §T-01, §T-02)
- RF-21: Cada cadena DEBE estar disponible como entidad `chain` del conjunto estándar de T-05 (`GET /api/metrics/chain`), con el **conjunto completo** de métricas calculado sobre las posesiones de esa cadena y nulos con razón donde no aplique. · (US-1) (Esp. v2 §T-05 "cadena de evento (asistencia, robo, rebote ofensivo, pérdida)")
- RF-22: El sistema DEBE ofrecer la tabla completa `events_production` (T-06) con una fila por bloque/desenlace (equipo) o por jugador (modo equipo, para ver quién produce cada cadena), ordenable, con totales, coloreado por percentil y exportable (CSV, XLSX, PNG, PDF) con los filtros activos. · (US-5) (Esp. v2 §T-06)
- RF-23: El sistema DEBE ofrecer una **conciliación** visible por bloque: suma de desenlaces = eventos del bloque; eventos del bloque = conteo del pbp; y, como control informativo, puntos tras pérdida rival calculados vs `pts_from_tov` del box oficial, con la lista de partidos que difieren y su causa probable. · (US-4) (Esp. v2 §A-01 "toda diferencia mayor debe investigarse")
- RF-24: El sistema DEBE funcionar sin ingesta v2 (partidos sin `previous_action`) con un **vínculo de respaldo** por proximidad de eventos, marcando en la respuesta cuántos eventos se vincularon por respaldo (`link_fallback`) y avisando "Reimportá sus partidos para vincular todos los eventos". · (US-1) (Arq. §1.6, DA-12)

## 5. Requisitos de datos / API
| Tabla / Endpoint | Tipo | Campos / Shape | ¿Nuevo? |
|---|---|---|---|
| `GET /api/events-production?entity=team\|player&id=<team_code\|player_id>` + contexto T-03 | endpoint (Arq. §6) | `{entity, context, blocks: {assists, oreb, dreb, steals, turnovers}, reconcile}`; objetos métrica = ficha T-01 (§7.1) con razón de nulo (§7.4) y `sample` (§7.2); el shape completo lo fija `plan.md` §3 | **NUEVO** (nombre y ruta fijados en Arq. §6; el shape lo define el plan) |
| `GET /api/table/events_production` (T-06) | tabla (Arq. §6) | payload §7.6, filas por bloque/desenlace o por jugador | **NUEVO** (id fijado en Arq. §6) |
| `GET /api/metrics/chain?id=<team_code>:<cadena>` (T-05) | entidad estándar (Arq. §6) | payload §7.3; `<cadena>` ∈ `asistencia`, `rebote_ofensivo`, `rebote_defensivo`, `robo`, `perdida` | **NUEVO** (tipo fijado en Arq. §6; el formato de id es PROPUESTA del plan) |
| `pbp_events.previous_action`, `pbp_events.qualifiers` | columnas (F-11) | vínculo FIBA y calificadores | existen desde F-11; A-07 solo las lee |
| `team_game_stats.pts_from_tov`, `.second_chance_pts` | columnas existentes (`docs/database.md` §team_game_stats) | referencia de conciliación | existen |

Sin cambios de esquema (Arq. §5: A-07 es on-the-fly). Claves de configuración: A-07 no agrega ninguna; consume `oreb.putback_secs`, `oreb.kickout_secs` (A-04), `transition.max_secs` (A-03), `sample.split.min/high` y `regression.split.k` (T-02/F-13).

## 6. Estados de UI
Pestaña **Eventos** de S3 (`#/equipo/<code>/eventos`) y S4 (`#/jugador/<id>/eventos`). Copy nuevo marcado `(nuevo)` para `docs/frontend.md`.

| Vista / componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Pestaña Eventos (cinco bloques) | spinner + "Calculando producción por evento…" (nuevo) | "Todavía no hay play-by-play importado para esta selección." (nuevo) · selección sin partidos: "Ningún partido coincide con los filtros." (nuevo) | 404 sin pbp: "Este equipo no tiene play-by-play importado. Reimportá sus partidos." (nuevo, mismo copy que A-04) · 400 contexto inválido: mensaje del backend · 5xx: "No se pudo calcular la producción por evento." (nuevo) | "Sin conexión: el análisis por evento necesita conexión." (nuevo) | cinco cards con fichas T-01, badge T-02 y tabla de desenlaces |
| Card Asistencias | — | "Sin asistencias en la selección." (nuevo) | — | — | puntos generados, puntos por asistencia, reparto doble/triple/2+1, "Asiste más a …" |
| Card Rebotes ofensivos | — | "Sin rebotes ofensivos en la selección." (nuevo) | — | — | desenlaces, puntos tras RO, conversión, puntos por RO (mismos valores que Posesión → Segunda oportunidad) |
| Card Rebotes defensivos | — | "Sin rebotes defensivos en la selección." (nuevo) | — | — | inician contraataque, terminan en anotación, puntos; "Primer pase de salida: —" con `title` "FIBA no registra los pases de salida" (nuevo) |
| Card Robos | — | "Sin robos en la selección." (nuevo) | — | — | desenlaces, puntos por robo, PPP tras robo vs PPP general |
| Card Pérdidas | — | "Sin pérdidas en la selección." (nuevo) | — | — | puntos recibidos, dobles/triples/faltas, costo medio, % castigadas |
| Valor nulo | — | "—" con `title` = razón de C-11 (`nullDisplay`) | — | — | nunca color de rendimiento |
| Muestra baja | — | — | — | — | card en gris con badge BAJA y advertencia (T-02); sin ranking |
| Tabla completa / exportar | skeleton | "Sin datos para exportar." (nuevo) | toast con el mensaje del backend | — | `data-table.js` con botón de exportación (T-06) |
| Aviso de vínculo de respaldo | — | — | — | — | banner "N eventos se vincularon por proximidad. Reimportá sus partidos para vincular todos." (nuevo) |

Mobile (<768 px): cards apiladas a una columna, tablas con primera columna fija; sin cambios de nav inferior (la pestaña vive dentro de S3/S4).

## 7. Criterios de aceptación
*El cliente no define "Criterio de aceptación" para A-07; los CA siguientes se derivan de su enunciado y de los CA de A-01/A-04 (§9 punto 1).*

- CA-1 **(propuesto, equivalente al CA del cliente de A-01/A-04)**: Given un equipo con pbp importado, When se abre la pestaña Eventos, Then cada uno de los cinco bloques muestra el **resultado y los puntos** de cada evento (no solo su cantidad) para la competencia seleccionada.
- CA-2 (asistencias): Given un equipo y una competencia, When se suman `doble + triple + 2+1`, Then el total es igual a las asistencias vinculadas, y `vinculadas + sin_vínculo + en_posesión_incompleta` es igual a la cantidad de eventos `assist` del equipo en el pbp de esos partidos (y al `ast` del box cuando pbp y box coinciden).
- CA-3 (puntos por asistencia): Given esas asistencias, When se recorre el pbp por canasta asistida y se suman los puntos de la canasta (más el tiro libre adicional de un and-one), Then el resultado es igual a "puntos generados por asistencias" y `promedio = puntos / asistencias vinculadas`.
- CA-4 (rebotes ofensivos): Given un equipo, When se suman putback + doble + triple + falta recibida + pérdida + sin puntos, Then el total es igual a los rebotes ofensivos capturados en posesiones completas, y `puntos tras RO`, `conversión` y `puntos por RO` son **iguales** a `pts_2nd`, `oreb_conversion` y `pts_per_oreb` de `GET /api/second-chance` (A-04) para la misma selección.
- CA-5 (rebotes defensivos): Given un equipo, When se cuentan los rebotes que inician contraataque, Then son ≤ rebotes defensivos que abren posesión completa; los "terminan en anotación" son ≤ los que inician contraataque; y el porcentaje de rebotes defensivos que se convierten en transición coincide con el de la pestaña Posesión (A-03).
- CA-6 (robos): Given un equipo, When se suman doble + triple + falta recibida + pérdida posterior + sin conversión (+ `sin_posesion_siguiente`), Then el total es igual a los eventos `steal` del equipo en el pbp; y los puntos tras robo de un equipo coinciden con los puntos recibidos tras pérdida del rival en las pérdidas vinculadas a esos robos.
- CA-7 (pérdidas): Given un equipo, When se suman doble + triple + falta + sin castigo + `sin_posesion_siguiente`, Then el total es igual a los eventos `turnover` del equipo (incluidas las pérdidas de equipo); `costo promedio = puntos recibidos / pérdidas con posesión rival siguiente` y `% castigadas = castigadas / pérdidas con posesión rival siguiente`.
- CA-8 (jugador vs equipo): Given un equipo, When se suman los valores de todos sus jugadores más la fila de equipo ("Rebote de equipo", "Pérdida de equipo", eventos sin jugador), Then se obtiene el total del equipo en cada bloque.
- CA-9 (contexto): Given la selección `quarter=1,2,3,4,pr` partida por cuarto, When se suman las asistencias vinculadas de las consultas por cuarto, Then es igual al total de la consulta sin filtro; y con `last=5` solo se usan los últimos 5 partidos del equipo (`context.games_used = 5`).
- CA-10 (nulos): Given un jugador sin robos en la selección pero con minutos, When se abre su bloque Robos, Then los conteos son 0 reales, las tasas son "—" con razón `sin_intentos`, y ningún valor se pinta con color de rendimiento; Given una selección sin pbp, Then todo el bloque es "—" con razón `sin_pbp`.
- CA-11 (muestra, T-02): Given un jugador con menos eventos que `sample.split.min` en un bloque, When se ve la pestaña, Then el bloque muestra badge BAJA en gris y no aparece rankeado ni cuenta en percentiles.
- CA-12 (ficha, T-01): Given una tasa con muestra suficiente (p. ej. puntos por asistencia), When se pasa el cursor, Then se ve ranking (X.º de N), líder, promedio y percentil de la competencia, verificables con `GET /api/rankings/chain/<clave>`.
- CA-13 (estándar, T-05): Given `GET /api/metrics/chain?id=<equipo>:asistencia`, `…:robo` y `GET /api/metrics/team?id=<equipo>`, When se comparan los grupos de métricas, Then son los mismos, sin huecos (los que no aplican, nulos con razón).
- CA-14 (tabla y exportación, T-06): Given la tabla `events_production`, When se exporta a CSV con `last=5`, Then el archivo reproduce las filas mostradas y su cabecera documenta el filtro.
- CA-15 (vínculo de respaldo): Given un partido sin `previous_action` (no reprocesado), When se abre la pestaña, Then el bloque se calcula con vínculo de respaldo, `link_fallback > 0` y se ve el aviso de reimportación; las sumas de CA-2/CA-6/CA-7 se mantienen.
- CA-16 (conciliación): Given la conciliación de pérdidas, When se compara "puntos tras pérdida rival" calculados con `pts_from_tov` del box, Then los partidos que difieren quedan listados con su causa probable (`posesion_incompleta`, `criterio_fiba`, `no_registrado`); los partidos con `pts_from_tov` NULL quedan excluidos con razón `no_registrado`.
- CA-17 (rendimiento): Given la competencia del seed (13 partidos), When se pide `GET /api/events-production` en frío, Then responde en menos de 5 s y en caliente en menos de 1,5 s (objetivo de Arq. §3.14).

## 8. Fuera de alcance
- **Primer pase de salida** y toda métrica de pases: FIBA LiveStats no los publica (nulo `no_registrado`); no hay incremento posible con la fuente actual.
- Producción desde eventos **por quinteto, ON/OFF o por cuarto** como entidades propias: solo se accede vía el filtro `on`/`off`/`quarter` de T-03 sobre equipo o jugador.
- Lado defensivo del rebote ofensivo (OR% concedido, segundos hasta el tiro rival): ya es de A-04.
- Matriz asistente → receptor y sinergias de pareja: A-08 (reutiliza `chains.assist_pairs_from_events`).
- Atribución de asistencias a posesiones no vinculadas por FIBA ("pase previo al pase"): fuera de alcance de v2.
- Insights/frases automáticas sobre esta producción: A-10.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **El cliente no define CA para A-07.** Se proponen CA-1…CA-17 derivados del enunciado y de los criterios de A-01/A-04 (cuadre de sumas, coherencia con A-04 y con el box). Confirmar con el cliente si espera un CA distinto.
2. [DECISIÓN PROPUESTA — confirmar] **"2+1"** = canasta de campo asistida **con tiro libre adicional concedido** (and-one), sea de 2 o de 3 puntos. La partición doble/triple/2+1 es exhaustiva y disjunta; el and-one se detecta con "canasta convertida y al menos un tiro libre en la misma posesión" (A-01). Caso borde conocido: antideportiva con posesión retenida (A-01 `retain`) seguida de canasta se clasificaría como 2+1; se documenta como limitación.
3. [DECISIÓN PROPUESTA — confirmar] **"Puntos generados" por asistencia** = puntos **de la posesión** terminada en canasta asistida (canasta + tiro libre del and-one), no solo el valor del tiro. Razón: es la definición ya adoptada por `chains.assist_points` de F-01 (`points` = Σ `pts` de posesiones con `assister_id`).
4. [DECISIÓN PROPUESTA — confirmar] **Primer pase de salida** → nulo `no_registrado` (RF-13). Se alinea con el criterio que A-03 adopte para "Primer pase de salida" (su spec define la misma limitación); si A-03 resolviera otra cosa, A-07 la hereda.
5. [DECISIÓN PROPUESTA — confirmar] **Horizonte de la consecuencia = una posesión.** Para robos, rebotes defensivos y pérdidas, la consecuencia es la posesión **inmediatamente siguiente** (incluidas sus oportunidades por rebote ofensivo, que pertenecen a la misma posesión). No se acumulan puntos de posesiones posteriores. Es lo que hace `chains.turnover_cost` de F-01.
6. [DECISIÓN PROPUESTA — confirmar] **Robo ≠ origen `robo`.** Los robos se identifican por el evento `steal` y su vínculo con la pérdida, no por `Possession.origin` (A-02 da precedencia a `tiempo_muerto` sobre `robo`; un robo seguido de tiempo muerto perdería su origen). El PPP "de las posesiones iniciadas con recuperación" (RF-15) sí usa `origin == "robo"` por pedido del cliente ("eficiencia de las posesiones iniciadas con recuperación").
7. [DECISIÓN PROPUESTA — confirmar] **"Inician contraataque"** (RF-12) = la posesión abierta por el rebote defensivo es de tipo `transicion` (A-03: primer tiro o falta recibida dentro de `transition.max_secs`, hoy 7 s). No se agrega otra definición.
8. [DECISIÓN PROPUESTA — confirmar] **Faltas recibidas por el rival tras pérdida / robo propio** = posesión que termina en tiros libres sin canasta de campo (`end_type == "falta"`); si hubo canasta con tiro libre (and-one) cuenta como doble/triple, igual que en los robos del equipo.
9. [DECISIÓN PROPUESTA — confirmar] **Eventos sin jugador** (rebotes y pérdidas de equipo): se atribuyen al equipo en modo equipo (filas "Rebote de equipo"/"Pérdida de equipo") y no se asignan a ningún jugador.
10. [DECISIÓN PROPUESTA — confirmar] **Cadena `perdida` como entidad T-05**: el lado atacante es el rival (la consecuencia es lo que *concede* el equipo), por lo que el `StatBundle` de esa cadena lleva como `own` el box del rival en las posesiones posteriores y la UI lo rotula "Concedido tras pérdida". Se reporta como hueco de la arquitectura.
