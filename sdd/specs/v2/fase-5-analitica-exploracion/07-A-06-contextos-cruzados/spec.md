# Spec — A-06: Motor de contextos cruzados

> **ID:** A-06 · **Prioridad:** P2 · **Fase y orden:** 5·07
> **Depende de:** A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)) · A-02 ([../../fase-3-contexto-posesion/02-A-02-origen-posesion/spec.md](../../fase-3-contexto-posesion/02-A-02-origen-posesion/spec.md)) · A-03 ([../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/spec.md](../../fase-3-contexto-posesion/03-A-03-transicion-contraataque/spec.md)) · A-04 ([../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/spec.md](../../fase-3-contexto-posesion/04-A-04-segunda-oportunidad/spec.md)) · A-05 ([../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/spec.md](../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)) — y, por las capas comunes, T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)), T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)), T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)), X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md)), C-06 ([../../fase-1-confiabilidad/05-C-06-umbral-cierres/spec.md](../../fase-1-confiabilidad/05-C-06-umbral-cierres/spec.md))
> **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §5.3 · A-06 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S7 "Contextos cruzados" · Arquitectura §3.7, §3.8, §3.9, §4 (`cross_context.py`), §6 (`GET /api/cross`) ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §5.3 A-06):** "Las dimensiones anteriores valen poco por separado y mucho combinadas. En lugar de programar una pantalla por cada cruce, construir un único componente que reciba dos dimensiones y devuelva la tabla."
- "Dimensiones disponibles: cuarto · clutch · tramo de reloj · origen de posesión · tipo (transición / early / media cancha) · oportunidad (primera / segunda) · quinteto · jugador en cancha · local o visitante · rival."
- "Métricas seleccionables: PPP · eFG% · TS% · PPT · TO% · OR% · FT Rate · volumen de posesiones."
- "Salida en matriz con escala de color por percentil y el badge de muestra de T-02 en cada celda."
- "Toda celda por debajo del umbral mínimo de posesiones se muestra en gris y no participa del coloreado."
- Cruces preconfigurados: tramo de reloj × origen · tramo de reloj × cuarto · tipo de ataque × quinteto · segunda oportunidad × jugador · transición concedida × quinteto · tramo de reloj × clutch.
- **Criterio de aceptación del cliente:** "cualquier combinación de dos dimensiones devuelve totales que, sumados, coinciden con el total general de la métrica."

El mapa de secciones (§1.3 S7 "Explorar") fija el módulo "Contextos cruzados": "Matriz de dos dimensiones cualesquiera sobre la métrica elegida".

**Qué existe hoy (verificado en código y docs):**
- No existe ningún cruce de contextos. La única segmentación disponible es la de cierres (`backend/clutch.py`: `_is_clutch(ev, last_regular, window_secs)` y `_entry_margin(evs, last_reg, window_secs)`, ventana = último período REGULAR con `clock_secs ≤ window_secs` + todas las prórrogas, partido cerrado = diferencia ≤ `DEFAULT_MARGIN` al entrar a la ventana) y la de quintetos (`backend/lineups.py` `build_segments`, `lineup_stats`).
- `frontend/js/app.js` no tiene vistas de Explorar con matrices: la sección Buscar (`sections = ["import","league","team","compare","player","search"]`, `docs/frontend.md`) es el buscador de jugadores por umbral de métrica.
- `backend/lineups.py` `_agg(evs, team_code)` (l.17) cuenta `fgm2/fga2/fgm3/fga3/ftm/fta/orb/drb/ast/tov/stl/blk` y `pts` sobre cualquier lista de eventos de pbp: es la base ya existente para sumar conteos de un subconjunto de eventos.

**Qué resolvieron features/requisitos anteriores (de esta misma corrida de specs):**
- A-01 reconstruye cada posesión como registro con sus conteos (`box`/`opp_box`), quintetos de ambos lados, jugador que finaliza/asiste/pierde y marca de incompleta; `team_possessions(team, comp, ctx, side)` devuelve las posesiones filtradas por contexto.
- A-02 asigna `origin` (7 orígenes + fila informativa del rebote ofensivo, DA-29); A-03 asigna `ptype`; A-04 asigna oportunidades (`Chance`) y `outcome`; A-05 asigna `shots[].band` (tramo de reloj de cada tiro) y deja `Chance.shot_clock_start` (24 o 14).
- T-03 fija el contrato de contexto (`Context`, `parse_context`, `context_echo`, `register_dimension`, `possession_predicate`); T-02 fija umbrales y badge por "split de contexto" (`sample.split.min/high` = 15/40 posesiones, `regression.split.k` = 20); T-01 fija percentiles con la escala rojo→gris→verde; T-06 la tabla/exportación.

**Qué queda para A-06:** un único motor que, dado un equipo, dos dimensiones y una métrica, reparte las posesiones (u oportunidades) del equipo en una matriz, calcula la métrica por celda con muestra, ajuste y color, y verifica que las celdas suman el total. Se muestra en S7 Explorar → Contextos cruzados con los seis cruces preconfigurados y se exporta con T-06.

## 1. Objetivo
Ofrecer en S7 Explorar un único componente que cruce dos dimensiones de contexto cualesquiera del equipo (cuarto, clutch, tramo de reloj, origen, tipo, oportunidad, quinteto, jugador en cancha, sede, rival) sobre una métrica a elección (PPP, eFG%, TS%, PPT, TO%, OR%, FT Rate o volumen), con color por percentil, badge de muestra por celda y la garantía de que las celdas suman el total.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5.3 A-06 (completo), §1.3 S7, §3 T-01 (percentil, escala de color), T-02 (umbral "split", badge, regresión), T-03 (contexto), T-05 (conjunto estándar), T-06 (tablas/exportación), §2 C-11 (nulos), §6 Glosario (PPP, eFG%, TS%, PPT, TO%, OR%, FT Rate, Posesión).
- `docs/metrics.md` (fórmulas de eFG%, TS%, FT Rate, OR%, posesión); `docs/frontend.md` (sección Buscar); `docs/api.md` (razones de nulo).
- Arquitectura §3.7 (`sample.py`: `sample_level`, `adjusted`), §3.8 (contexto y `register_dimension`), §3.9 (posesiones y enriquecedores), §4 (`cross_context.py`: `cross_matrix(team_code, dim_x, dim_y, metric_key, comp_id, ctx) -> dict`), §6 (`GET /api/cross`), §7.1, §7.2, §7.4, §7.5, §8 (`percentileColor`, `sample-badge.js`, `export-menu.js`).
- Specs/planes previos de esta corrida: A-01 `plan.md` §4 (posesión, `box`, `team_possessions`), A-02 `plan.md` §4.1 (orígenes), A-04 `plan.md` §4 (`Chance`), T-03 `plan.md` §4 (`possession_predicate`), T-02 `plan.md` (umbral `split`), C-06 `plan.md` §4 (definición de cierre).

## 3. Historias de usuario
- US-1: Como entrenador, quiero cruzar dos dimensiones de contexto sobre una métrica en una sola pantalla, para responder preguntas como "¿aprovechamos las posesiones que empiezan con ventaja?" sin pedir una pantalla nueva por cada cruce.
- US-2: Como entrenador, quiero partir de los seis cruces que ya están armados, para llegar a las lecturas más usadas en un toque.
- US-3: Como analista, quiero ver en cada celda cuántas posesiones la respaldan y que las celdas con muestra insuficiente queden en gris y fuera del color, para no leer ruido como patrón.
- US-4: Como analista, quiero que los totales de filas y columnas coincidan con el total general, para confiar en que ninguna posesión se pierde ni se cuenta dos veces.
- US-5: Como analista, quiero exportar la matriz tal como la veo, para llevarla al cuerpo técnico.

## 4. Requisitos funcionales

**Motor y dimensiones**
- RF-1: El sistema DEBE ofrecer, en S7 Explorar → pestaña "Contextos cruzados", un único componente que recibe un equipo, **dos dimensiones distintas** y **una métrica**, y devuelve la matriz de la métrica por celda. · (US-1) (Esp. v2 §A-06)
- RF-2: El sistema DEBE soportar como dimensiones: **cuarto** (1.º, 2.º, 3.º, 4.º, prórroga), **clutch** (cierre / resto), **tramo de reloj** (temprano, medio, tardío, sin tiro), **origen de posesión** (los 7 orígenes de A-02), **tipo** (transición, early, media cancha), **oportunidad** (primera, segunda), **quinteto**, **jugador en cancha**, **local o visitante** y **rival**. · (US-1) (Esp. v2 §A-06 "Dimensiones disponibles")
- RF-3: El sistema DEBE soportar como métricas: **PPP, eFG%, TS%, PPT, TO%, OR%, FT Rate y volumen de posesiones**, con las definiciones del glosario v2 (§6) aplicadas al subconjunto de cada celda y calculadas como cociente de totales de la celda. · (US-1) (Esp. v2 §A-06 "Métricas seleccionables"; §6 Glosario)
- RF-4: El sistema DEBE permitir elegir el **lado**: ataque (posesiones del equipo) o defensa (posesiones del rival contra el equipo, mismas dimensiones vistas desde el equipo). · (US-1) (Esp. v2 §A-02/A-03 versiones defensivas; §A-06 "Transición concedida × quinteto")
- RF-5: El sistema DEBE respetar el contexto de T-03 activo (competencia, período, sede, rival, cuarto, marcador, con/sin jugador, dimensiones de posesión) y devolver el eco `context` con los partidos usados y excluidos. Si un filtro del contexto coincide con una dimensión elegida, la matriz queda restringida a ese filtro (las demás filas/columnas aparecen con 0 posesiones). · (US-1) (Esp. v2 §T-03)

**Matriz y celdas**
- RF-6: Cada celda DEBE mostrar: valor de la métrica, **posesiones que la respaldan**, badge de muestra de T-02 y valor ajustado por regresión a la media cuando la métrica es PPP (T-02: `regression.split.k`). · (US-3) (Esp. v2 §A-06 "badge de muestra de T-02 en cada celda"; §T-02)
- RF-7: Toda celda por debajo del mínimo efectivo de posesiones de T-02 (entidad "split de contexto") DEBE mostrarse en **gris**, con badge BAJA y su valor visible, y **no participar del coloreado** ni de los percentiles. · (US-3) (Esp. v2 §A-06 "Toda celda por debajo del umbral…")
- RF-8: El sistema DEBE colorear cada celda por **percentil** con la escala continua de T-01 (rojo en 0, gris en 50, verde en 100), invirtiendo el sentido cuando "menos es mejor" (p. ej. PPP o eFG% en defensa, TO% en ataque). Las métricas neutrales (volumen) no llevan color de rendimiento. · (US-1) (Esp. v2 §A-06 "escala de color por percentil"; §T-01)
- RF-9: El percentil DEBE calcularse, por defecto, contra la **competencia**: el valor de la misma celda en los demás equipos de la población de referencia (T-01), excluyendo las celdas por debajo del mínimo. Cuando una dimensión es propia del equipo (quinteto, jugador en cancha, rival) la comparación contra la competencia no existe, y el color pasa a percentil **dentro de la matriz** (entre las celdas válidas), informando la base usada. · (US-1, US-3) (Esp. v2 §T-01 "Percentil… dentro de la competencia"; Esp. v2 §A-06)
- RF-10: La matriz DEBE incluir **totales por fila, por columna y total general** con la misma métrica, calculados sobre los mismos conteos. · (US-4) (Esp. v2 §A-06 criterio de aceptación)
- RF-11: El sistema DEBE devolver una **verificación de cuadre** con la matriz: la suma de los conteos de todas las celdas (posesiones, puntos, intentos) es igual al total general; para dimensiones solapadas (jugador en cancha: cada posesión pertenece a 5 jugadores) el cuadre se verifica contra la multiplicidad esperada y se informa. · (US-4) (Esp. v2 §A-06 criterio de aceptación)
- RF-12: El eje de quinteto y el de jugador en cancha DEBEN limitarse a los **N con más posesiones** (por defecto 8) y agrupar el resto en una fila/columna "Otros", de modo que los totales siguen cerrando; el usuario puede ampliar N. · (US-1, US-4) (Esp. v2 §A-06)
- RF-13: Con la dimensión **oportunidad**, la unidad de la matriz DEBE ser la **oportunidad** (primera = inicio de la posesión; segunda o posterior = tras rebote ofensivo propio, A-04) y no la posesión; el volumen se rotula "Oportunidades" y el total general cuenta oportunidades. OR% no se define por oportunidad y se muestra nulo con razón `no_aplica`. · (US-1) (Esp. v2 §A-04, §A-06 "oportunidad (primera / segunda)")

**Cruces preconfigurados**
- RF-14: El sistema DEBE ofrecer los seis cruces del cliente como accesos directos: tramo de reloj × origen de posesión; tramo de reloj × cuarto; tipo de ataque × quinteto; segunda oportunidad × jugador; transición concedida × quinteto (lado defensa); tramo de reloj × clutch. Cada uno fija dimensiones, lado y métrica inicial, y se puede modificar. · (US-2) (Esp. v2 §A-06 "Cruces que conviene dejar preconfigurados")
- RF-15: El sistema DEBE permitir intercambiar los ejes y cambiar la métrica **sin recargar la pantalla** ni perder la selección. · (US-1)

**Detalle, tabla y exportación**
- RF-16: Al elegir una celda, el sistema DEBE mostrar su **conjunto estándar de T-05** completo (como split de contexto), con nulos con razón donde no aplique. · (US-3) (Esp. v2 §T-05 "split de contexto")
- RF-17: La matriz DEBE ser exportable (CSV, XLSX, PNG, PDF) con los filtros, el lado, las dimensiones, la métrica y la base de color documentados en la cabecera, y el sistema DEBE ofrecer la tabla completa de celdas con el conjunto estándar de T-05 (una fila por celda). · (US-5) (Esp. v2 §T-06)

**Reglas de datos**
- RF-18: Las posesiones **incompletas** (A-01) DEBEN quedar excluidas de la matriz y de los totales, e informarse aparte; nunca se asignan a ninguna celda ni se imputan a cero. · (US-4) (Esp. v2 §A-01; C-11)
- RF-19: Un valor sin base de cálculo (celda sin posesiones, métrica con denominador 0, partido sin pbp) DEBE mostrarse nulo con razón (`sin_intentos`, `sin_pbp`, `requiere_posesiones`, `no_aplica`), nunca como 0, y sin color de rendimiento. · (US-3) (C-11)

## 5. Requisitos de datos / API
| Tabla / Endpoint | Tipo | Campos / Shape | ¿Nuevo? |
|---|---|---|---|
| `GET /api/cross?team=<code>&dim_x=<d>&dim_y=<d>&metric=<m>` + contexto T-03 (+ `side`, `limit`, `color`, `preset`, `cell_x`/`cell_y`) | endpoint (Arq. §6) | `{team, side, metric, unit, dims, cells[], row_totals, col_totals, grand_total, check, context, presets}`; objetos de celda con valor, conteos, `adj`, `pct`, `sample`; el shape completo lo fija `plan.md` §3 | **NUEVO** (ruta, método y parámetros base fijados en Arq. §6; parámetros extra y shape son del plan) |
| `GET /api/table/cross_cells` (T-06) | tabla | una fila por celda con el conjunto estándar (payload §7.6) | **NUEVO** (id PROPUESTA del plan; no figura en la lista de ids de Arq. §6) |
| Contexto T-03: `competition`, `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, `clock`, `clock_start`, `origin`, `ptype`, `chance` | parámetros de query (Arq. §3.8) | eco `context` §7.5 | existen desde T-03 |

Sin cambios de esquema (Arq. §5: A-06 es on-the-fly). Claves de configuración: A-06 no agrega ninguna; consume `clutch.margin`, `clutch.window_secs`, `clock.early_max`, `clock.mid_max`, `sample.split.min/high/rel_pct`, `regression.split.k`, `population.min_size`, `sample.team.min`.

## 6. Estados de UI
Pestaña **Contextos cruzados** de S7 (`#/explorar/contextos`). Copy nuevo marcado `(nuevo)` para `docs/frontend.md`.

| Vista / componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selectores (equipo, lado, dimensión X/Y, métrica, cruces) | — | "Elegí un equipo y dos dimensiones." (nuevo) | 400 "Elegí dos dimensiones distintas." (nuevo) | — | selectores con la selección actual y botón "⇄ Intercambiar ejes" (nuevo) |
| Matriz | spinner + "Armando la matriz…" (nuevo) | "No hay posesiones para esta combinación." (nuevo) · "Ningún partido coincide con los filtros." (nuevo) | 404 "Este equipo no tiene play-by-play importado. Reimportá sus partidos." (nuevo) · 400 contexto inválido: mensaje del backend · 5xx "No se pudo armar la matriz." (nuevo) | "Sin conexión: el cruce de contextos necesita conexión." (nuevo) | matriz con color por percentil, badge por celda, totales |
| Celda | — | celda sin posesiones: "—" con `title` "Sin posesiones en esta combinación" (nuevo) | — | — | valor + posesiones; gris + badge BAJA si la muestra es insuficiente |
| Leyenda de color | — | — | — | — | "Color: percentil frente a la competencia" o "Color: percentil dentro de esta matriz" (nuevo) según `pct_basis`; escala rojo→gris→verde |
| Verificación de cuadre | — | — | "El cuadre no cierra: revisá posesiones incompletas." (nuevo, solo si `check.ok == false`) | — | "Cuadra: Σ celdas = total (N posesiones)" (nuevo) |
| Detalle de celda | spinner | — | toast con el mensaje del backend | — | `standard-panel` T-05 de la celda |
| Exportar | — | "Sin datos para exportar." (nuevo) | toast | — | menú CSV/XLSX/PNG/PDF (T-06) |

Mobile (<768 px): la matriz se desplaza horizontalmente **dentro de su card** con la primera columna y la fila de cabecera fijas (sin scroll horizontal de página); selectores apilados; los chips de cruces en dos filas.

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "cualquier combinación de dos dimensiones devuelve totales que, sumados, coinciden con el total general de la métrica." Given cualquier par de dimensiones distintas de la lista (RF-2) y un equipo con pbp, When se pide la matriz, Then la suma de posesiones (y de puntos, tiros de campo y tiros libres) de todas las celdas es igual al total general de la matriz, y ese total es igual al total del equipo calculado sin cruzar (`possessions_counted` del equipo para el mismo contexto); `check.ok` es `true`.
- CA-2 (todos los pares): Given las 10 dimensiones, When se piden los 45 pares posibles para un equipo, Then los pares de dimensiones **partición** (todas salvo jugador en cancha) cierran exactamente, y los pares con jugador en cancha cierran contra la multiplicidad informada (`Σ celdas = Σ posesiones × jugadores en cancha del equipo`).
- CA-3 (totales de fila/columna): Given una matriz de dimensiones partición, When se suman las celdas de una fila (o columna), Then el resultado es el total de esa fila (o columna), y la suma de totales de filas es el total general.
- CA-4 (gris bajo mínimo): Given una celda con menos posesiones que el mínimo efectivo de T-02 (`sample.split.min`, 15 por defecto), When se ve la matriz, Then la celda aparece en gris, con su valor y badge BAJA, `ranked: false`, y no participa del color ni de la población de percentiles de las demás celdas.
- CA-5 (badge por celda): Given cualquier celda con posesiones, When se la ve, Then muestra el badge de T-02 con posesiones, nivel (BAJA/MEDIA/ALTA) y `n` coincidente con las posesiones de la celda.
- CA-6 (color por percentil, competencia): Given el cruce tramo × origen del equipo A, When se compara el color de una celda con el valor de esa misma celda en los demás equipos (`GET /api/cross` para cada equipo), Then el percentil de la celda es el calculado con la fórmula de T-01 sobre esos valores (excluyendo celdas BAJA y al propio equipo), y se verifica a mano en una celda.
- CA-7 (color por percentil, matriz): Given un cruce que incluye quinteto, jugador en cancha o rival, When se ve la leyenda, Then dice "percentil dentro de esta matriz", `pct_basis == "matriz"` y el percentil de una celda coincide con su posición entre las celdas válidas de la misma matriz.
- CA-8 (menos es mejor): Given `side=defensa` y métrica PPP, When se ve el color, Then la celda con el PPP concedido más bajo es la más verde; con `side=ataque` y TO%, la más baja también es verde.
- CA-9 (nulos): Given una celda sin posesiones, When se la ve, Then muestra "—" con razón `sin_intentos` y sin color; Given OR% con la dimensión oportunidad, Then todas las celdas muestran "—" con razón `no_aplica`; Given un equipo sin pbp, Then 404 `sin_pbp`.
- CA-10 (oportunidad): Given el cruce `oportunidad × cuarto`, When se suman las celdas, Then el total general es la cantidad de oportunidades (posesiones + rebotes ofensivos propios en posesiones completas) y la fila "Segunda" tiene la misma cantidad que `second_chances` de `GET /api/second-chance` (A-04) para el mismo contexto.
- CA-11 (posesiones incompletas): Given un equipo con posesiones incompletas, When se pide cualquier matriz, Then los totales excluyen esas posesiones y el response informa `excluded.incomplete = N` con N igual al de la conciliación de A-01.
- CA-12 (cruces preconfigurados): Given cada uno de los seis cruces, When se los elige, Then se aplican sus dimensiones, lado y métrica, la matriz se calcula y cierra (CA-1), y el usuario puede cambiar una dimensión o la métrica sin volver a elegir el equipo.
- CA-13 (cambiar métrica sin recargar): Given una matriz visible, When se cambia la métrica o se intercambian los ejes, Then la matriz se redibuja sin recargar la página y sin perder el equipo, el lado ni el contexto.
- CA-14 (contexto): Given `last=5` en la barra T-03, When se pide la matriz, Then solo cuentan los últimos 5 partidos del equipo (`context.games_used = 5`), y recargar la URL reproduce la misma vista.
- CA-15 (conjunto estándar, T-05): Given una celda, When se abre su detalle, Then muestra los mismos grupos de métricas que `GET /api/metrics/team?id=<equipo>`, sin huecos (los que no aplican, nulos con razón).
- CA-16 (exportación, T-06): Given una matriz visible, When se exporta a CSV, Then el archivo reproduce valores y totales de la pantalla y su cabecera documenta equipo, competencia, filtros, lado, dimensiones, métrica y base de color.
- CA-17 (clutch coherente con Cierres): Given la dimensión clutch, When se compara la fila "Cierre" con el equipo en Momentos → Cierres (C-06) para el mismo margen y ventana, Then los partidos calificados coinciden y las posesiones de "Cierre" están dentro de la ventana de esos partidos.
- CA-18 (rendimiento): Given la competencia del seed (13 partidos), When se pide una matriz en frío, Then responde en menos de 5 s y en caliente en menos de 1,5 s, incluido el percentil frente a la competencia.

## 8. Fuera de alcance
- Cruces de **tres** o más dimensiones y filtros arbitrarios dentro de la celda: v2 cruza exactamente dos.
- Cruces para **jugador y quinteto** como entidad analizada (el cliente lo pide para el panel de tramo de reloj de A-05, no para A-06): A-06 analiza un **equipo** (ataque o defensa); jugadores y quintetos son valores de eje, no la entidad.
- Cruces entre equipos distintos (comparar matrices de dos equipos) y matriz de la competencia completa: v2 no los pide.
- Zona de tiro como dimensión: es la matriz zona × tramo de A-05.
- Consultas guardadas de cruces: F-10 (consultas guardadas) guarda búsquedas de jugadores/quintetos; guardar un cruce queda fuera de v2.
- Frases/insights automáticos sobre la matriz: A-10.
- Calibración de umbrales por dimensión: T-02/F-13.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **Base del percentil.** El cliente pide "escala de color por percentil" y que la celda gris "no participa del coloreado". Decisión: por defecto el percentil es **contra la competencia** (misma celda en los demás equipos, T-01), y cuando el eje es propio del equipo (quinteto, jugador en cancha, rival, finalizador) pasa a **percentil dentro de la matriz**; la UI informa la base y permite forzar "dentro de la matriz" con `color=matriz`. Razón: coherencia con T-01 y con el CA de T-01 (el color es el de un percentil verificable).
2. [DECISIÓN PROPUESTA — confirmar] **"Tramo de reloj" de una posesión.** A-05 asigna el tramo a cada **tiro**. Decisión: el tramo de la posesión (u oportunidad) es el del **último tiro** de campo con tramo derivable; si no hubo tiro de campo (pérdida, falta sin tiro, fin de período) la posesión va a la categoría **"Sin tiro"**, para que la matriz cierre. Reloj de 14 (A-05) se filtra con `clock_start`, no es una dimensión.
3. [DECISIÓN PROPUESTA — confirmar] **Clutch.** Se reutiliza la definición de Cierres (C-06): posesión que **empieza** dentro de la ventana de cierre (último período regular con reloj ≤ `clutch.window_secs` y prórrogas) de un **partido cerrado** (diferencia ≤ `clutch.margin` al entrar a la ventana). El resto de las posesiones va a "Resto". Valores: `cierre`, `resto`.
4. [DECISIÓN PROPUESTA — confirmar] **Jugador en cancha es una dimensión solapada** (cada posesión pertenece a los 5 jugadores en cancha). Los totales de columna no pueden ser la suma de filas: el total de cada columna cuenta posesiones **únicas** y el cuadre se verifica contra la multiplicidad (RF-11). La UI lo avisa con una nota.
5. [DECISIÓN PROPUESTA — confirmar] **"Segunda oportunidad × jugador"** (cruce preconfigurado 4): "quién genera realmente los puntos extra" se lee como **quién finaliza** la oportunidad; "jugador en cancha" no contesta esa pregunta. Se agrega la dimensión **finalizador** (jugador que finaliza la oportunidad: tira o pierde el balón), PROPUESTA no listada por el cliente, y el cruce 4 usa `oportunidad × finalizador`.
6. [DECISIÓN PROPUESTA — confirmar] **Unidad con la dimensión oportunidad.** Es la oportunidad (consistente con el filtro `chance` de T-03 y con A-04). Total general = oportunidades; "Posesiones" se rotula "Oportunidades" en ese caso. OR% se muestra `no_aplica` (RF-13).
7. [DECISIÓN PROPUESTA — confirmar] **Mínimo de muestra por celda.** Se usa la entidad "split de contexto" de T-02 (15 posesiones mínimo, 40 alta; K = 20) para todas las dimensiones, incluida tramo de reloj (el mínimo de "tramo de reloj o zona de tiro", 10 intentos, aplica a la matriz zona × tramo de A-05, no a esta). Se confirma en F-13 si el cliente prefiere umbrales por dimensión.
8. [DECISIÓN PROPUESTA — confirmar] **Valor ajustado** (regresión a la media) solo para PPP (equivalente a OER/DER del split, T-02); las demás métricas no se regresan. El color de PPP usa el valor ajustado; el valor crudo se muestra en la celda con el ajustado en el `title`.
9. [DECISIÓN PROPUESTA — confirmar] **Eje de quinteto/jugador limitado a N = 8** con fila "Otros" (RF-12) para no generar matrices de cientos de filas; el cuadre se mantiene.
10. [DECISIÓN PROPUESTA — confirmar] **Lado defensa**: las dimensiones se leen desde el equipo analizado (el quinteto/jugador en cancha del equipo cuando defiende, el rival que ataca); el origen/tipo/tramo son los de la posesión **rival**. "Transición concedida × quinteto" = `tipo × quinteto` con `side=defensa`, filtrando la fila "transición" (cruce 5), lectura: qué quinteto concede más transiciones.
11. [DECISIÓN PROPUESTA — confirmar] **Tabla `cross_cells`** como id de tabla T-06 no figura en Arq. §6: se propone para cumplir "toda tabla se exporta con el conjunto estándar" (T-06); la exportación visual de la matriz sale del menú de la propia pestaña.
