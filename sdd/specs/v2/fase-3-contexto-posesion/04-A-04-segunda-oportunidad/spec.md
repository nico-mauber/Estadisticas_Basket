# Spec — A-04: Rebote ofensivo y segunda oportunidad

> **ID:** A-04 · **Prioridad:** P1 · **Fase y orden:** 3·04
> **Depende de:** A-01 ([../01-A-01-motor-posesiones/](../01-A-01-motor-posesiones/spec.md)), A-03 ([../03-A-03-transicion-contraataque/](../03-A-03-transicion-contraataque/spec.md)) — y por transitividad A-02 ([../02-A-02-origen-posesion/](../02-A-02-origen-posesion/spec.md)), F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md)), T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)), T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)), T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)), T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)), X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md))
> **Habilita:** A-05, A-06, A-07
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §5.2 · A-04 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.6, §2.1, §3.2, §3.8, §3.9, §6, §9 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente.** "Un rebote ofensivo no es un evento aislado: abre una posesión nueva dentro de la misma posesión. Se
analiza como cadena completa." Pide clasificar el desenlace de cada segunda oportunidad (putback inmediato, reinicio de ataque,
kick-out a triple, falta recibida, pérdida, sin puntos), métricas ofensivas (PPP de 2.ª vs 1.ª oportunidad, puntos por RO,
conversión, distribución de desenlaces, origen del RO según el tiro fallado, zona del rebote, cadenas de rebotes, captura vs
finalización por jugador, coste del RO) y defensivas (OR% concedido, PPP concedido en 2.ª oportunidad, segundos del rival hasta
tirar, rebote defensivo largo vs en la zona). "El diferencial suele ser el argumento más fuerte para insistir en el rebote de
ataque." CA: los puntos de segunda oportunidad calculados por esta vía coinciden con los del box score oficial.

**Qué existe hoy (verificado en código, rama `main`):**
- Rebotes ofensivos solo como conteo: `team_game_stats.orb` / `player_game_stats.orb` (box FIBA) y en pbp `action_type =
  "rebound"`, `sub_type = "offensive"` (`backend/lineups.py:_agg`, `backend/clutch.py:_agg`). No hay vínculo rebote → tiro
  fallado persistido: `backend/fiba_fetcher.py:_parse_fiba_json` (l.429–445) guarda en `pbp_events` solo `team_code,
  player_name, period, period_type, clock_secs, s1, s2, action_type, sub_type, success, action_number`; `previousAction` y
  `qualifier[]` (incluido `2ndchance`) **no se guardan** (Arquitectura §1.6).
- Puntos de segunda oportunidad oficiales: `team_game_stats.second_chance_pts`, leído de `tot_sPointsSecondChance` en
  `fiba_fetcher.py` l.310 (`ti(["PointsSecondChance", "SecondChancePoints"])`). Gotcha de `CLAUDE.md`: esas claves estuvieron mal
  escritas una vez y produjeron ceros silenciosos; los partidos importados antes de la corrección tienen `0` (columna `INTEGER
  DEFAULT 0`, `backend/database.py` l.78/l.172) indistinguible de "cero real" (`docs/database.md` l.68).
- La UI muestra "Seg. Op." como promedio por partido en la card "Desglose ofensivo" de Equipo (`frontend/js/app.js` l.779–785)
  y como fila "PtsSegCh" en Comparar (l.1112). No hay ningún análisis de la cadena.
- No existe motor de posesiones: la app calcula posesiones por fórmula (`stats_engine.possessions`, l.32). El reloj de partido se
  persiste como segundos enteros restantes (`fiba_fetcher._gt_to_secs`).
- Specs anteriores: 02 (pbp persistido), 03/04 (motor de quintetos `lineups.build_segments`), 05 (cierres), 08 (nulo vs cero).
  Ninguno trata segundas oportunidades.

**Qué resuelven requisitos previos de v2 (que este requisito consume):**
- F-11: `pbp_events.previous_action` y `pbp_events.qualifiers`, `player_game_stats.second_chance_pts` (NULL = no importado),
  `team_game_stats.ingest_version` y el reproceso; corrección `PERIOD_LEN` con `OVERTIME`.
- A-01: `backend/possessions.py` con `Possession`/`Chance`; cada rebote ofensivo propio abre una `Chance` con
  `shot_clock_start = clock.reset_secs` (14). El campo `Chance.outcome` está reservado para A-04 (Arquitectura §3.9).
- A-02 (origen) y A-03 (tipo/transición) enriquecen las posesiones; A-03 es necesario para el "coste del rebote ofensivo".
- F-13 (configuración), T-02 (badge de muestra, `sample.split.*`), T-05 (conjunto estándar, registro de tipos de entidad), T-06
  (tablas), T-03 (contexto, `context.register_dimension`), X-01 (pestaña `posesion` de S3/S4), C-03 (zonas de tiro).

**Qué queda para A-04:** clasificar el desenlace de cada segunda oportunidad, calcular todas las métricas ofensivas y defensivas
de la cadena, conciliar con `PointsSecondChance`, registrar la dimensión de contexto `chance` y el tipo de entidad `chance`,
publicar la tabla `team_second_chance` y el bloque "Segunda oportunidad" de la pestaña Posesión (equipo y jugador).

## 1. Objetivo
Analizar cada rebote ofensivo como el inicio de una cadena de segunda oportunidad —con su desenlace, sus puntos y los jugadores
que capturan y finalizan— para equipo y jugador, en ataque y en defensa, conciliado con los puntos de segunda oportunidad del box
score oficial.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5.2 A-04 (tabla de desenlaces, métricas ofensivas, métricas defensivas, CA); §1.3 S3 "Posesión" y S4
  "Posesión"; §6 glosario: "Segunda oportunidad", "Putback", "Puntos por rebote ofensivo", "Reset de 14", "PPP", "OR%", "DR%".
- Especificación v2 §5.1 A-01 (reglas de reconstrucción: "Un rebote ofensivo NO termina la posesión: la continúa. Pero abre una
  segunda oportunidad, que se marca como tal y reinicia el reloj a 14").
- `00-arquitectura-transversal.md` §1.6 (pbp real, `previousAction` rebote→tiro, calificador `2ndchance`, rebotes de equipo,
  "Coordenadas / zona del rebote: No"), §2.1 (pooled, nulos), §2.2 (OR%, DR%), §3.2 (`oreb.putback_secs`, `oreb.kickout_secs`,
  `sample.split.*`), §3.8 (parámetro `chance`), §3.9 (`Chance`, enum de `outcome`), §5 (sin cambios de esquema en A-0x), §6
  (tabla `team_second_chance`, tipo de entidad `chance`), §7.2–§7.6, §9.1.
- `docs/database.md` §`team_game_stats` (`second_chance_pts`, l.61, nota l.68), `docs/metrics.md` §Posesiones, §Rebotes (OR%/DR%),
  §Eficiencia.
- `CLAUDE.md` (gotcha `PointsSecondChance`).
- Specs `sdd/specs/03-lineups`, `04-on-off` (motor de quintetos), `08-nulos-vs-cero`.

## 3. Historias de usuario
- US-1: Como entrenador, quiero comparar cuántos puntos por oportunidad hace mi equipo en segunda oportunidad frente a la primera,
  para decidir si conviene mandar jugadores al rebote de ataque.
- US-2: Como analista, quiero ver cómo termina cada segunda oportunidad (putback, reinicio, kick-out, falta, pérdida, sin puntos)
  con su volumen y eficiencia, para entender cómo explota el equipo el rebote.
- US-3: Como analista, quiero saber tras qué tipo de tiro fallado captura el equipo sus rebotes ofensivos y cuántas veces
  encadena dos o más, para caracterizar su estilo de rebote.
- US-4: Como entrenador, quiero separar quién captura el rebote ofensivo de quién finaliza la segunda oportunidad, para valorar
  dos roles que hoy se confunden.
- US-5: Como entrenador, quiero ver cuántas transiciones concede el equipo cuando no captura el rebote tras un tiro propio fallado,
  para medir el coste de ir al rebote.
- US-6: Como entrenador, quiero la versión defensiva (OR% concedido, PPP concedido en segundas oportunidades del rival, segundos
  que tarda el rival en tirar), para trabajar el cierre del rebote defensivo.
- US-7: Como analista, quiero que los puntos de segunda oportunidad de la app coincidan con los del box score oficial, para confiar
  en el resto del análisis.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE identificar como **segunda oportunidad** cada oportunidad (`Chance` con n ≥ 2) que A-01 abre tras un
  rebote ofensivo propio —incluidos los rebotes ofensivos de equipo (calificador `team`, sin jugador)— dentro de posesiones
  completas; las posesiones incompletas quedan excluidas y nunca se imputan a cero. · (US-1, US-7) (Esp. v2 §A-04, §A-01)
  (Arq. §3.9) · Regla (glosario): "Segunda oportunidad: Continuación de la posesión tras rebote ofensivo propio."
- RF-2: El sistema DEBE clasificar cada segunda oportunidad en **uno y solo uno** de los desenlaces `putback`, `reinicio`,
  `kickout_triple`, `falta_recibida`, `perdida`, `sin_puntos`, con las definiciones del cliente y la precedencia de §9 (D-1):
  "Putback inmediato: Tiro en los 3 segundos siguientes al rebote, sin pase intermedio"; "Reinicio de ataque: El equipo saca el
  balón y vuelve a construir con los 14 segundos"; "Kick-out a triple: Pase al perímetro y triple en los 6 segundos siguientes";
  "Falta recibida: La segunda oportunidad termina en tiros libres"; "Pérdida: Se pierde el balón sin llegar a tirar"; "Sin
  puntos: Se tira y se falla sin nuevo rebote ofensivo". Las ventanas de 3 s y 6 s son configurables (claves de §5). · (US-2)
  (Esp. v2 §A-04 "Clasificación del desenlace", glosario "Putback")
- RF-3: El sistema DEBE calcular, por equipo y selección de contexto, **PPP de segunda oportunidad** = puntos de las segundas
  oportunidades / cantidad de segundas oportunidades, **PPP de primera oportunidad** = puntos de las primeras oportunidades /
  cantidad de primeras oportunidades, y el **diferencial** (2.ª − 1.ª), con agregación pooled. · (US-1) (Esp. v2 §A-04
  "Métricas ofensivas"; glosario "PPP: Puntos anotados / posesiones") (Arq. §2.1)
- RF-4: El sistema DEBE calcular **puntos por rebote ofensivo** = "Puntos generados en la cadena de segunda oportunidad / rebotes
  ofensivos capturados" (glosario, literal) y **tasa de conversión de segunda oportunidad** = "porcentaje de rebotes ofensivos que
  terminan en puntos" (segundas oportunidades con puntos > 0 / segundas oportunidades). · (US-1) (Esp. v2 §A-04, glosario)
- RF-5: El sistema DEBE mostrar la **distribución de desenlaces** en volumen (cantidad y % sobre las segundas oportunidades) y en
  PPP de cada desenlace. · (US-2) (Esp. v2 §A-04)
- RF-6: El sistema DEBE clasificar el **origen del rebote ofensivo según el tipo de tiro fallado**: `triple`, `media_distancia`,
  `cercano` (zona restringida) o `tiro_libre`, usando el vínculo rebote → tiro fallado y la zona del tiro (C-03), con volumen,
  % y PPP de la cadena posterior por tipo. · (US-3) (Esp. v2 §A-04) (Arq. §1.6 `previousAction`)
- RF-7: El sistema DEBE devolver la **zona del rebote** ("dentro o fuera de la zona restringida") como nulo con razón
  `no_registrado`, porque FIBA LiveStats no publica la ubicación del rebote, y la UI DEBE explicarlo. · (US-3) (Esp. v2 §A-04)
  (Arq. §1.6 "Coordenadas / zona del rebote: No → nulo con razón `no_registrado`")
- RF-8: El sistema DEBE contar las **cadenas de rebotes**: posesiones con dos o más rebotes ofensivos consecutivos (tres o más
  oportunidades), su cantidad, su % sobre las posesiones con al menos un RO y su PPP (puntos de la posesión completa / posesiones
  de la cadena). · (US-3) (Esp. v2 §A-04)
- RF-9: El sistema DEBE mostrar, **por jugador**, los dos roles por separado: **captura** (rebotes ofensivos capturados, puntos de
  las segundas oportunidades que abrió, conversión, putbacks propios) y **finalización** (segundas oportunidades finalizadas, puntos
  anotados en segundas oportunidades, eficiencia); los rebotes de equipo se muestran en una fila "Rebote de equipo". · (US-4)
  (Esp. v2 §A-04 "Por jugador")
- RF-10: El sistema DEBE calcular el **coste del rebote ofensivo** como las transiciones concedidas al rival (tipo `transicion` de
  A-03) en las posesiones rivales que empiezan con un rebote defensivo del rival tras un tiro propio fallado (origen
  `rebote_defensivo` de A-02): cantidad, % sobre esas posesiones, puntos y PPP concedidos, y transiciones concedidas por cada 100
  tiros propios fallados, rotulado como aproximación (§9 D-4). · (US-5) (Esp. v2 §A-04 "Coste del rebote ofensivo")
- RF-11: El sistema DEBE calcular las **métricas defensivas**: OR% concedido = rebotes ofensivos del rival / (rebotes ofensivos del
  rival + rebotes defensivos propios) (glosario OR% aplicado al rival), PPP concedido en las segundas oportunidades del rival, y
  **segundos que el rival tarda en tirar tras capturar rebote ofensivo** (media y distribución del reloj derivado desde el rebote
  hasta el primer tiro de la oportunidad). · (US-6) (Esp. v2 §A-04 "Métricas defensivas")
- RF-12: El sistema DEBE devolver "rebote defensivo asegurado tras tiro propio: porcentaje de rebotes largos frente a rebotes en la
  zona" como nulo con razón `no_registrado` (FIBA no publica la ubicación del rebote), con la explicación en la UI. · (US-6)
  (Esp. v2 §A-04) (Arq. §1.6)
- RF-13: El sistema DEBE **conciliar** los puntos de segunda oportunidad calculados (Σ puntos de las oportunidades n ≥ 2) con el
  box score oficial (`team_game_stats.second_chance_pts`, clave FIBA `PointsSecondChance`) por equipo-partido y por
  equipo-competencia, mostrar la diferencia y excluir de la comparación los partidos cuyo box no es confiable (importados con
  ingesta anterior a la v2 o sin pbp), informándolos con razón. · (US-7) (Esp. v2 §A-04 CA) (`docs/database.md` §team_game_stats)
- RF-14: El sistema DEBE ofrecer todo el análisis en **versión defensiva** (las mismas métricas sobre las posesiones del rival contra
  el equipo). · (US-6) (Esp. v2 §1.3 S3 "Posesión … en ataque y defensa")
- RF-15: El sistema DEBE registrar la dimensión de contexto **`chance`** (`primera` | `segunda`, nivel posesión) para que el resto
  de la app pueda filtrar por oportunidad, y el tipo de entidad **`chance`** con el **conjunto estándar completo** de T-05 para
  primera y segunda oportunidad (métricas no aplicables → nulo `no_aplica`, nunca omitidas). · (US-1) (Arq. §3.5, §3.8, §6)
- RF-16: El sistema DEBE mostrar el **badge de muestra** de T-02 (unidad posesiones/oportunidades, umbral `sample.split.*`) en cada
  fila de desenlace, origen, jugador y en los totales; las filas bajo el mínimo se muestran en gris y no se colorean. · (US-2)
  (Esp. v2 §T-02) (Arq. §3.7)
- RF-17: El sistema DEBE respetar el **contexto activo** de T-03 (competencia, últimos N, sede, rival, cuarto, marcador, con/sin
  jugador y dimensiones de posesión ya registradas) y la población de T-01 para el percentil de las métricas principales (PPP 2.ª,
  puntos por RO, conversión, OR% concedido). · (US-1) (Esp. v2 §T-03, §T-01)
- RF-18: El sistema DEBE ofrecer la tabla completa exportable (T-06) `team_second_chance` con una fila por desenlace, por origen de
  RO y por jugador. · (US-2, US-4) (Esp. v2 §T-06)
- RF-19: El sistema DEBE ofrecer el análisis a nivel **jugador** en S4 → Posesión: sus RO capturados y lo que generaron, sus
  finalizaciones en segunda oportunidad y su PPP personal en segunda oportunidad. · (US-4) (Esp. v2 §1.3 S4 "Posesión")
- RF-20: Toda tasa con denominador 0 DEBE devolverse `null` con razón (`sin_intentos` / `sin_datos`); equipos o partidos sin pbp
  DEBEN excluirse con razón `sin_pbp` y contarse en el eco de contexto (`games_excluded`). · (Esp. v2 §C-11) (Arq. §7.4)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events` (+`previous_action`, `qualifiers` de F-11) | consumida | eventos del partido, vínculo rebote→tiro, calificador `2ndchance` | columnas NUEVAS de F-11 (no de A-04) |
| `team_game_stats.second_chance_pts`, `.ingest_version` | consumida | puntos de 2.ª oportunidad oficiales; versión de ingesta | existente / F-11 |
| `player_game_stats.second_chance_pts` | consumida | puntos de 2.ª oportunidad por jugador (NULL = no importado) | F-11 |
| Posesiones de A-01 (`possessions.game_possessions`) | consumida | `Possession`, `Chance` | A-01 (on-the-fly) |
| `GET /api/second-chance` | endpoint | query `team` (o `player`), `side=ataque\|defensa` + contexto T-03 → resumen, desenlaces, orígenes del RO, cadenas, jugadores, coste, defensa, conciliación (shape en plan §8) | **NUEVO — PROPUESTA (no está en 00-arquitectura-transversal.md)** |
| `GET /api/table/team_second_chance` | endpoint T-06 | payload §7.6 | NUEVO (id fijado por la arquitectura) |
| `GET /api/metrics/chance?id=<team>:<primera\|segunda>` | endpoint T-05 | payload §7.3 | NUEVO (tipo fijado por la arquitectura) |
| Claves de config `oreb.putback_secs` (3, 1–6), `oreb.kickout_secs` (6, 2–10) | config | sección "Reglas de contexto" de S9 | NUEVAS (las agrega A-04) |

Sin cambios de esquema (Arq. §5: A-01…A-11 son on-the-fly). Requiere partidos reprocesados con la ingesta v2 (F-11) para
`previous_action` y para confiar en `second_chance_pts`.

## 6. Estados de UI
Bloque "Segunda oportunidad" de la pestaña **Posesión** de S3 Equipo (`#/equipo/<code>/posesion`) y de S4 Jugador
(`#/jugador/<id>/posesion`), con selector Ataque / Defensa. Todo copy es nuevo (va a `docs/frontend.md`) y usa `t()`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Resumen (PPP 1.ª vs 2.ª, puntos por RO, conversión, cadenas) | spinner `<span class="spinner">` | sin pbp: "Este equipo no tiene play-by-play importado. Reimportá sus partidos." · sin RO en la selección: "No hay rebotes ofensivos en esta selección." | "No se pudo calcular la segunda oportunidad. Probá de nuevo." | `/api/*` siempre a red (SW): "Sin conexión: el análisis de posesiones necesita conexión." | fichas de métrica T-01 con badge T-02 y diferencial coloreado |
| Tabla de desenlaces | spinner | "Sin segundas oportunidades en esta selección." | ídem | ídem | tabla T-06 (volumen, %, PPP, badge) |
| Origen del RO por tiro fallado | spinner | ídem | ídem | ídem | tabla T-06; fila "Zona del rebote": "—" con título "FIBA LiveStats no registra dónde se captura el rebote." |
| Captura vs finalización por jugador | spinner | ídem | ídem | ídem | tabla T-06 con fila "Rebote de equipo" |
| Coste del RO | spinner | "Sin tiros fallados en esta selección." | ídem | ídem | tarjeta con la leyenda "Aproximación: FIBA no registra quién fue al rebote." |
| Defensa | spinner | ídem | ídem | ídem | OR% concedido, PPP concedido 2.ª, segundos hasta el tiro (media + histograma) |
| Conciliación con box oficial | — | — | — | — | leyenda "Puntos de 2.ª oportunidad: 132 calculados · 132 oficiales (FIBA)" o "Diferencia de N puntos en M partidos" con detalle; partidos excluidos: "N partidos con box anterior a la ingesta v2: reprocesalos en Datos → Calidad." |

Mobile (<768 px): tablas con columna fija (T-06), fichas en una columna, histograma a ancho completo.

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "puntos de segunda oportunidad calculados por esta vía coinciden con los puntos de segunda oportunidad
  del box score oficial del partido." → Given los partidos del seed reprocesados con la ingesta v2, When se consulta `GET
  /api/second-chance?team=<code>&competition=<id>`, Then `reconcile.teams[].calc == reconcile.teams[].official` para cada equipo en
  la competencia y, por partido, cada diferencia distinta de cero figura en `reconcile.games_mismatch[]` con su causa (tolerancia
  de §9 D-6).
- CA-2: Given un equipo con pbp, When se piden los desenlaces, Then la suma de las filas de desenlace es igual a la cantidad de
  segundas oportunidades y la suma de sus puntos es igual a los puntos de segunda oportunidad calculados.
- CA-3: Given un equipo con pbp, When se consulta, Then la cantidad de segundas oportunidades es igual a la cantidad de rebotes
  ofensivos del pbp del equipo en posesiones completas (incluidos los de equipo) y `oreb_captured` coincide con el `orb` del box
  (menos los RO que caen en posesiones incompletas, informados aparte).
- CA-4: Given un putback con una asistencia vinculada al tiro, When se clasifica, Then NO es `putback` (hay pase intermedio) y cae
  en `kickout_triple` (si es triple dentro de 6 s) o `reinicio`.
- CA-5: Given que se cambia `oreb.putback_secs` de 3 a 2 en S9, When se recarga la vista, Then la cantidad de `putback` no aumenta y
  la suma total de desenlaces no cambia.
- CA-6: Given la sección "Por jugador", When se suman los RO capturados de todas las filas (incluida "Rebote de equipo"), Then es
  igual al total de RO del equipo en la selección; y la suma de puntos finalizados es igual a los puntos de segunda oportunidad.
- CA-7: Given la tarjeta "Zona del rebote" y "Rebote largo vs en la zona", When se muestra, Then aparece "—" con la explicación de
  que FIBA no lo registra (nunca 0 ni 0 %).
- CA-8: Given un equipo o selección sin rebotes ofensivos, When se consulta, Then PPP de 2.ª, puntos por RO y conversión son `null`
  con razón `sin_intentos` y la UI muestra "—" sin color (sin `NaN`/`Infinity`).
- CA-9: Given una selección con menos segundas oportunidades que `sample.split.min`, When se muestra, Then la fila lleva badge
  "baja", se ve en gris y no participa del percentil.
- CA-10: Given `side=defensa`, When se consulta, Then el OR% concedido es igual a `1 − DR%` del equipo sobre las mismas posesiones y
  el PPP concedido en 2.ª oportunidad del equipo A contra B coincide con el PPP de 2.ª oportunidad de B contra A en los mismos
  partidos.
- CA-11: Given el filtro de contexto `chance=segunda` en otra vista (p. ej. `GET /api/metrics/team?id=<code>&chance=segunda`),
  When se consulta, Then la respuesta aplica el filtro (no aparece en `context.ignored`) y `possessions_counted` es igual a la
  cantidad de segundas oportunidades.
- CA-12: Given `GET /api/metrics/chance?id=<code>:segunda`, When se consulta, Then están presentes todas las claves del conjunto
  estándar (las no aplicables con `reason: "no_aplica"`).
- CA-13: Given un partido importado antes de la ingesta v2 (sin `previous_action`, `ingest_version` nulo), When entra en la
  selección, Then el origen del RO por tiro fallado usa el evento de tiro inmediatamente anterior (fallback) y el partido no entra en
  la conciliación oficial; `reconcile.games_excluded` lo lista con razón `no_registrado`.
- CA-14: Given la vista en un teléfono (< 768 px), When se abre Equipo → Posesión → Segunda oportunidad, Then todo es legible sin
  scroll horizontal de página y la consola no muestra errores.

## 8. Fuera de alcance
- Ubicación real del rebote (dentro/fuera de la zona restringida, largo vs corto): FIBA no la publica → nulo `no_registrado`
  (RF-7, RF-12). Si en el futuro FIBA la publicara, requeriría ingesta nueva (F-11).
- Quién "mandó jugadores al rebote": FIBA no registra posiciones → el coste del RO es una aproximación (RF-10).
- Pase intermedio sin asistencia: FIBA solo registra pases que terminan en asistencia; un pase no asistido entre el rebote y el tiro
  no es observable (§9 D-2).
- Segundas oportunidades por quinteto en tabla propia: se cubre con el filtro `chance` sobre las tablas de quintetos de F-06 y con
  el cruce "Segunda oportunidad × jugador" de A-06.
- Producción desde eventos (desenlace del RO con desglose doble/triple): A-07 lo consume de este requisito.
- No hay incrementos diferidos: todas las dependencias pertenecen a fases anteriores o a la misma fase.

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **D-1 · Precedencia de desenlaces.** Cada oportunidad tiene como máximo un tiro de campo (un tiro
  fallado abre otra oportunidad o cierra la posesión). Se clasifica por su acción terminal: pérdida sin tiro → `perdida`; tiros
  libres sin canasta de campo convertida → `falta_recibida`; canasta de campo convertida → `putback` / `kickout_triple` /
  `reinicio` según el modo del tiro (and-one incluido en sus puntos); tiro fallado (seguido de rebote defensivo, de otro rebote
  ofensivo o de fin de período) o fin de período sin acción → `sin_puntos`. El "modo" del tiro (putback / kick-out / reinicio)
  también se informa para los tiros fallados, en una columna aparte "intentos por modo", para no perder la lectura de "putback
  fallado". Justificación: la tabla del cliente mezcla modo de tiro y resultado; así la suma de desenlaces es exhaustiva y
  disjunta (CA-2) y el PPP de `putback` mide lo que el cliente quiere ver.
- [DECISIÓN PROPUESTA — confirmar] **D-2 · "Sin pase intermedio".** FIBA no registra pases no asistidos. Putback = el tiro es el
  primer evento de juego del equipo tras el rebote, ocurre a ≤ `oreb.putback_secs` del rebote en el reloj derivado y no tiene
  asistencia vinculada. Kick-out a triple = triple a ≤ `oreb.kickout_secs` del rebote que no es putback (con o sin asistencia).
- [DECISIÓN PROPUESTA — confirmar] **D-3 · Unidad del PPP de 2.ª oportunidad.** El denominador es la cantidad de segundas
  oportunidades (= rebotes ofensivos en posesiones completas), no de posesiones, y se rotula "PPP (por oportunidad)". La 1.ª
  oportunidad usa la cantidad de primeras oportunidades (= posesiones completas).
- [DECISIÓN PROPUESTA — confirmar] **D-4 · Coste del RO.** Aproximación: transiciones del rival (A-03) en posesiones rivales con
  origen `rebote_defensivo` (A-02) posteriores a un tiro propio fallado. No se puede saber cuántos jugadores fueron al rebote.
- [DECISIÓN PROPUESTA — confirmar] **D-5 · Tiro libre fallado.** Un rebote ofensivo tras el último tiro libre fallado abre una
  segunda oportunidad con origen `tiro_libre`. Los rebotes "de equipo" que FIBA registra entre tiros libres de una misma serie (no
  hay cambio de posesión posible) no abren oportunidad; lo resuelve A-01.
- [DECISIÓN PROPUESTA — confirmar] **D-6 · Tolerancia de la conciliación (CA-1).** Igualdad exacta en el total por equipo y
  competencia sobre los partidos con box confiable (`ingest_version ≥ 2`); por partido se listan las diferencias con su causa
  probable (posesión incompleta, criterio FIBA distinto en jugadas de falta tras RO). Si el total no cuadra se investiga antes de
  cerrar (igual que A-01 con su 2 %). Validación cruzada adicional: Σ puntos de eventos con calificador `2ndchance` = oficial.
- [DECISIÓN PROPUESTA — confirmar] **D-7 · Filtro `chance` a nivel oportunidad.** Con `chance=segunda`, la unidad de agregación de
  toda la app pasa a ser la oportunidad (no la posesión); `possessions_counted` cuenta oportunidades. Se documenta en el eco de
  contexto (`context.applied.chance`) y en `docs/metrics.md`.
