# Spec — A-01: Reconstrucción de la posesión

> **ID:** A-01 · **Prioridad:** P0 · **Fase y orden:** 3·01
> **Depende de:** T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)), F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md)), C-11 ([../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/](../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/spec.md)); usa F-13 (config) y T-03 (contexto) ya cerrados
> **Habilita:** A-02, A-03, A-04, A-05, A-06, A-07, A-11, F-01, F-02, F-07 (quintetos de ambos equipos) · completa incrementos diferidos de F-11 (`possession_gaps`), T-02 (σ empírico y calibración por posesiones alternas), T-03 (nivel "posesión") y A-12 (`player_poss_duration`)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** [Especificación v2 §5.1 · A-01](../../00-especificacion-cliente-v2.md) · Arquitectura §1.6, §2.1, §3.9, §3.10, §3.14, §9.2 (I-01, I-03, I-10, I-19)

## 0. Contexto y situación actual

**Qué pide el cliente (literal):** "Prerrequisito técnico de todo el bloque. Hoy la app calcula posesiones por fórmula agregada; para el contexto hace falta que cada posesión sea un registro individual con sus atributos." El registro tiene 13 campos (id_posesión, equipo, inicio/fin, duración, origen, tipo, oportunidad, reloj_inicial, tramo_tiro, finalización, puntos, quinteto propio/rival, jugadores implicados) y cinco reglas de reconstrucción. El criterio de aceptación exige que el total reconstruido no difiera más de un 2 % del total por fórmula: "Toda diferencia mayor indica huecos en la reconstrucción y debe investigarse antes de seguir."

**Qué existe hoy (verificado en código, rama `main`):**
- Posesiones solo por fórmula: `stats_engine.py:possessions()` (`2PA + 3PA + 0.44·FTA + TOV − OR`), repetida localmente en `lineups.py:_pos` y `clutch.py:_pos`.
- Play-by-play persistido completo en `pbp_events` (`database.py:PbpEvent`: `team_code`, `player_name`, `period`, `period_type`, `clock_secs` restantes, `s1`/`s2`, `action_type`, `sub_type`, `success`, `action_number`; única `(game_id, action_number)`). Lo escribe `fiba_fetcher.py:_parse_fiba_json` (l.431–449) con `clock_secs = _gt_to_secs(gt)` (segundos enteros; las centésimas se pierden).
- Los eventos se leen **ordenados por `action_number`**, no por reloj (`app.py:_team_pbp_games`, l.835; `app.py:game_pbp`, l.808). Lección de la Feature 04 v3 (`sdd/specs/04-on-off/progress.md`): el reloj puede saltar hacia arriba dentro de un período porque la misma jugada se registra fuera de orden; `lineups.py:build_segments` lo resolvió con un "piso monótono" por período y volcado de la cola, y la suma de segundos quedó exacta.
- Reconstrucción de quintetos de **un** equipo: `lineups.py:build_segments(events, team_code, starters)` (fusiona cambios simultáneos, sin quintetos parciales); `lineups.py:game_starters` exige exactamente 5 titulares. `lineups.py:PERIOD_LEN = {"REGULAR": 600, "OT": 300}` no reconoce `OVERTIME`, que es lo que envía FIBA (arquitectura §1.5 D-09; F-11 lo corrige).
- Nada persiste vínculos entre eventos en `main`: `previous_action` y `qualifiers` los agrega la ingesta v2 de F-11 (`pbp_events.previous_action`, `pbp_events.qualifiers`, arquitectura §5).
- `repository.py`, `cache.py`, `context.py`, `data_quality.py`, `metrics_catalog.py`, `config.py` y `sample.py` los crean F-11, C-02/T-03, T-05, F-13 y T-02 (fases 1–2); A-01 los consume.

**Qué resolvieron features anteriores:** Feature 02 (pbp persistido), 03 (quintetos), 04 (on/off con partición exhaustiva y minutos exactos), 05 (cierres por pbp), 08 (nulo vs cero). La arquitectura (§1.6) reporta un prototipo fuera del repo sobre los 13 partidos del seed: 2.116 posesiones reconstruidas vs 2.104,8 por fórmula (**+0,53 %**), puntos conciliados con el box en 26/26 equipo-partido, 7 posesiones con hueco (0,33 %); por equipo-partido la diferencia va de −1,3 % a +3,3 %.

**Qué queda (este requisito):** el motor que convierte el pbp de cada partido en una lista de posesiones con sus campos base, los quintetos de ambos equipos, la marca de posesión incompleta, la conciliación contra la fórmula (por equipo y competencia) con diagnóstico de huecos, el camino de agregación "nivel posesión" que usan los filtros de contexto, y los enganches para que A-02…A-05 completen origen, tipo, oportunidad y tramo.

## 1. Objetivo
Reconstruir cada posesión de cada partido con play-by-play como un registro individual con sus atributos base, conciliado contra la fórmula agregada del glosario, como servicio compartido del bloque de analítica.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5 (introducción del bloque A), §5.1 A-01 (estructura del registro, reglas, criterio de aceptación), §1.1 (capa transversal: "Motor de posesiones"), §1.3 S1 "Calidad de datos … posesiones incompletas", §6 glosario ("Posesión", "Reloj de posesión", "Reset de 14", "Segunda oportunidad").
- `docs/metrics.md` §Posesiones (fórmula `POS`), nota "Nulo vs cero".
- `docs/database.md` — tabla `pbp_events`, `player_game_stats.starter`.
- `docs/api.md` — `GET /api/pbp/<game_id>` (verificación del pbp).
- Arquitectura: §1.6 (pbp real de FIBA: tipos, subtipos, calificadores, vínculos, prototipo), §2.1 (definición de posesiones por entidad), §3.9 (motor A-01, dataclasses, reglas, conciliación, enganches), §3.10 (`build_segments_both`), §3.14 (caché `poss:game`), §3.8 (nivel "posesion" del contexto), §6 (endpoints A-01), §9.2 I-01, I-03, I-10, I-19; DA-29, DA-30, DA-37.
- `sdd/specs/03-lineups/`, `sdd/specs/04-on-off/` (motor de quintetos y lección de orden por `action_number`), `sdd/specs/05-clutch/`, `sdd/specs/08-nulos-vs-cero/`.

## 3. Historias de usuario
- US-1: Como analista, quiero que cada posesión exista como registro individual con quién atacó, cuánto duró, cómo terminó y cuántos puntos produjo, para poder filtrar y medir por contexto de posesión (origen, tipo, oportunidad, tramo).
- US-2: Como analista, quiero saber qué cinco jugadores de cada lado estaban en cancha en cada posesión, para analizar quintetos y emparejamientos por posesión.
- US-3: Como responsable de datos, quiero ver cuánto difiere el total reconstruido del total por fórmula por equipo y competencia, y qué partidos tienen huecos, para decidir si los datos son confiables antes de usarlos.
- US-4: Como entrenador, quiero que una posesión que no se pudo reconstruir quede fuera de los cálculos y no cuente como "cero puntos", para no sacar conclusiones con datos rotos.
- US-5: Como responsable de datos, quiero inspeccionar las posesiones de un partido una por una, para investigar una diferencia de conciliación.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE reconstruir, para cada partido con play-by-play, la secuencia completa de posesiones de ambos equipos recorriendo los eventos en el orden de registro de FIBA (número de acción), sin depender de que el reloj sea monótono. · (US-1; Esp. v2 §A-01; docs/database.md `pbp_events`; lección Feature 04 v3)
- RF-2: El sistema DEBE producir por posesión los campos del cliente: identificador único dentro del partido, equipo que ataca, reloj de partido al inicio y al final, duración en segundos, finalización (T2c, T2f, T3c, T3f, falta recibida, pérdida, fin de cuarto), puntos (incluidos tiros libres y adicionales), quinteto propio y rival, y jugadores implicados (quién finaliza, quién asiste, quién comete la pérdida). Los campos origen, tipo, tramo_tiro y el desenlace de cada oportunidad existen en el registro y los completan A-02, A-03, A-05 y A-04; hasta entonces valen nulo. · (US-1, US-2; Esp. v2 §A-01 "Estructura del registro de posesión")
- RF-3: El sistema DEBE cerrar una posesión con: canasta convertida (salvo canasta con falta y tiro libre adicional, que cierra en el tiro libre adicional), tiro libre final convertido de una serie (no técnica), rebote defensivo del rival (incluido el rebote de equipo), pérdida, o fin de cuarto/prórroga. · (US-1; Esp. v2 §A-01 regla 1)
- RF-4: El sistema DEBE tratar el rebote ofensivo como continuación de la posesión: no la cierra, abre una nueva oportunidad (segunda, tercera…) dentro de la misma posesión y reinicia el reloj de posesión a 14 segundos (valor configurable, clave de configuración NUEVA de A-01). · (US-1; Esp. v2 §A-01 regla 2; glosario "Reset de 14", "Segunda oportunidad")
- RF-5: El sistema DEBE asignar los tiros libres derivados de una falta en acción de tiro a la posesión que generó la falta. · (US-1; Esp. v2 §A-01 regla 3)
- RF-6: El sistema DEBE tratar faltas técnicas y antideportivas sin cerrar la posesión en curso, salvo que cambie el sentido del ataque; los puntos de tiros libres técnicos del equipo que no ataca se registran fuera de toda posesión (para que los puntos sigan conciliando con el box). · (US-1; Esp. v2 §A-01 regla 4)
- RF-7: El sistema DEBE marcar como **incompleta**, con un motivo, toda posesión que no cierre con una finalización válida (cambio de equipo atacante sin evento de cierre, reloj no reparable, eventos sin equipo en posición decisiva); la posesión incompleta DEBE quedar excluida de todos los cálculos de contexto y de las métricas por posesión, y NUNCA imputarse como cero puntos. · (US-4; Esp. v2 §A-01 regla 5; C-11)
- RF-8: El sistema DEBE derivar el reloj de posesión (FIBA no publica el shot clock) como `segundos transcurridos = reloj de partido al inicio de la oportunidad − reloj de partido del evento` dentro del mismo período, con resolución de 1 segundo, y registrar para cada oportunidad su reloj inicial (24 o 14). · (US-1; Esp. v2 §A-01 "reloj_inicial"; glosario "Reloj de posesión"; §A-05 "Definición del reloj")
- RF-9: El sistema DEBE reconstruir los quintetos en cancha de **ambos** equipos por evento, reutilizando la lógica de quintetos existente (fusión de cambios simultáneos y piso monótono del reloj), y asignar a cada posesión el quinteto propio y el rival vigentes al inicio de la posesión, con los jugadores identificados por su identificador persistente. Si un partido no tiene exactamente 5 titulares por equipo, sus quintetos valen nulo (la posesión no se marca incompleta por eso). · (US-2; Esp. v2 §A-01 "quinteto_propio / rival"; arquitectura §3.9, §3.10)
- RF-10: El sistema DEBE conciliar el total de posesiones reconstruidas (completas) con el total por fórmula del glosario (`Posesión = T2i + T3i − RO + PER + 0,44 × TLi`, calculada sobre los conteos del pbp del mismo equipo y partidos) por equipo y competencia, y listar los partidos cuya diferencia supere el 5 %, con el diagnóstico de huecos de cada uno (posesiones incompletas y su motivo, posesiones de fin de cuarto sin acción, diferencia de puntos contra el box). · (US-3; Esp. v2 §A-01 criterio de aceptación; DA-30)
- RF-11: El sistema DEBE verificar que la suma de puntos de las posesiones completas e incompletas más los puntos fuera de posesión de cada equipo en cada partido coincide con los puntos del equipo en el box score, e informarlo en la conciliación. · (US-3; Esp. v2 §A-01 "puntos")
- RF-12: El sistema DEBE exponer la lista de posesiones de un partido (con su conciliación) y la conciliación por equipo de una competencia vía los endpoints NUEVOS de la arquitectura. · (US-3, US-5; arquitectura §6)
- RF-13: El sistema DEBE completar el incremento diferido de F-11: el check de calidad "posesiones incompletas" (`possession_gaps`) pasa de "no disponible" a calculado por competencia (cantidad, porcentaje y partidos afectados, más los partidos con diferencia de conciliación mayor al 5 %). · (US-3; Esp. v2 §1.3 S1 "Calidad de datos"; arquitectura §9.2 I-01)
- RF-14: El sistema DEBE permitir que las métricas se calculen agregando posesiones cuando el contexto pide un filtro de nivel posesión (camino "nivel posesión" del contrato de contexto), de modo que A-02…A-05 solo registren su dimensión; en este requisito el camino queda operativo sin dimensiones propias (los parámetros de posesión siguen informándose como ignorados hasta que su dueño los registre). · (US-1; Esp. v2 §1.1 "Barra de contexto … dimensiones de posesión"; arquitectura §3.8, §9.2 I-02)
- RF-15: El sistema DEBE agregar al conjunto estándar las métricas de volumen de posesión: posesiones contadas (`possessions_counted`) y duración media de las posesiones propias (`off_poss_duration`) para equipo, quinteto, split y tramo; y completar el incremento diferido de A-12 calculando la duración media de las posesiones que el jugador finaliza (`player_poss_duration`). · (US-1; arquitectura §3.5 "claves agregadas"; §9.2 I-03)
- RF-16: El sistema DEBE completar el incremento diferido de T-02: el desvío de puntos por posesión usado en la banda de error pasa a ser el desvío empírico de la competencia (sobre posesiones completas) cuando hay posesiones, y la calibración de K ofrece el método por posesiones alternas además del de partidos alternos. · (US-3; arquitectura §3.7, §9.2 I-10)
- RF-17: El sistema DEBE calcular las posesiones bajo demanda y guardarlas solo en caché en memoria invalidada por versión de datos y de configuración; nunca se persisten en la base. · (Constitución 4; arquitectura §3.9, §3.14)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events` (incl. `previous_action`, `qualifiers` de F-11) | tabla consumida | orden por `action_number`; `period_type` ∈ {REGULAR, OVERTIME} | columnas v2 de F-11 |
| `player_game_stats.starter`, `.player_id` | consumida | titulares; id persistente (C-08) | — / C-08 |
| `team_game_stats.pts` | consumida | puntos del box para RF-11 | — |
| `GET /api/game/<game_id>/possessions` | endpoint | `{game_id, possessions[], reconcile}` | **NUEVO** (arquitectura §6) |
| `GET /api/possessions/reconcile?competition=` | endpoint | `{teams: [{team_code, counted, formula, diff_pct}], games_over_5pct[]}` | **NUEVO** (arquitectura §6) |
| `GET /api/data-quality` (check `possession_gaps`) | endpoint existente (F-11) | check pasa de `no_disponible` a `ok`/`alerta` | modificado (incremento F-11) |
| `GET /api/metrics/<entity_type>` y `standard` | endpoints existentes (T-05) | + `possessions_counted`, `off_poss_duration`, `player_poss_duration` | claves nuevas del catálogo |
| Clave de config `clock.reset_secs` | configuración | int, default 14, rango 10–24, sección "Reglas de contexto" | **NUEVA** (arquitectura §3.2) |
| Tabla de posesiones persistida | — | **no existe ni se crea** (on-the-fly) | — |

Sin cambios de esquema (arquitectura §5).

## 6. Estados de UI
A-01 no tiene pantalla propia de análisis (lo consumen A-02…A-07 y S5). Su UI es de control de calidad, en S1 Datos → pestaña **Calidad** (creada por F-11; reubicada por X-01).

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Check "Posesiones incompletas" (Calidad) | skeleton del check (patrón de F-11) | competencia sin pbp: "Ningún partido de esta competencia tiene play-by-play. Reimportá sus partidos." (copy nuevo) | "No se pudo calcular la reconstrucción de posesiones." (copy nuevo) | `/api/*` siempre a red: "Sin conexión: la calidad de datos necesita conexión." (copy de F-11) | estado ok/alerta + "N posesiones incompletas (x,x %) en M partidos" (copy nuevo) |
| Tarjeta "Conciliación de posesiones" (Calidad) | spinner | ídem vacío | ídem error | ídem | tabla por equipo: Reconstruidas · Fórmula · Diferencia % (color de alerta si \|dif\| > 2 %), lista "Partidos con diferencia mayor al 5 %" con enlace a la inspección (copy nuevo) |
| Inspección de posesiones de un partido (modal/hoja desde la tarjeta) | spinner | partido sin pbp: "Este partido no tiene play-by-play." (copy nuevo) | 404: "Partido no encontrado." | ídem | tabla: # · Equipo · Período · Inicio · Fin · Duración · Oportunidades · Finalización · Puntos · Incompleta (motivo) — nulos "—" con `title` de la razón |

Todo copy nuevo va con `t()` y se agrega a `docs/frontend.md`.

## 7. Criterios de aceptación
- CA-1 (CA del cliente): Given la competencia del seed reprocesada con ingesta v2, When se consulta la conciliación de posesiones, Then "el total de posesiones reconstruidas individualmente no difiere en más de un 2% del total calculado por la fórmula agregada del glosario" — evaluado por equipo y competencia (DA-30) — "Toda diferencia mayor indica huecos en la reconstrucción y debe investigarse antes de seguir."
- CA-2: Given cualquier partido con pbp, When se piden sus posesiones, Then para cada equipo la suma de puntos de sus posesiones (completas + incompletas) más sus puntos fuera de posesión es igual a sus puntos del box score.
- CA-3: Given un partido con un rebote ofensivo seguido de canasta, When se inspecciona la posesión, Then es una sola posesión con dos oportunidades, la segunda con reloj inicial 14 y los puntos de la canasta.
- CA-4: Given una falta en acción de tiro con 2 tiros libres, el último convertido, When se inspecciona, Then los tiros libres están en la posesión del equipo que recibió la falta, la posesión cierra en el último tiro libre y su finalización es "falta recibida".
- CA-5: Given una canasta con falta y tiro libre adicional, When se inspecciona, Then la posesión cierra en el tiro libre adicional y sus puntos incluyen la canasta y el tiro libre.
- CA-6: Given una falta técnica pitada durante una posesión, When se inspecciona, Then la posesión en curso no se cierra por la técnica y los puntos del tiro libre técnico del equipo que no atacaba figuran fuera de posesión.
- CA-7: Given un partido con prórroga (2 de los 13 del seed), When se piden sus posesiones, Then hay posesiones con período de tipo OVERTIME, ninguna duración negativa ni mayor a la duración del período, y el último evento de cada período cierra la posesión abierta como "fin de cuarto" si no cerró antes.
- CA-8: Given un partido con un hueco (inyección controlada documentada: eliminar en una copia de la base el evento de rebote defensivo de una posesión), When se reconstruye, Then esa posesión queda `incomplete: true` con motivo, no aparece en las métricas por posesión (`possessions_counted` no la cuenta) y sus puntos no se imputan a cero; el check `possession_gaps` la lista.
- CA-9: Given un partido sin exactamente 5 titulares en un equipo, When se reconstruye, Then las posesiones existen con `own_on_court`/`opp_on_court` nulos para ese equipo y el resto de campos completos.
- CA-10: Given un partido sin pbp, When se pide `GET /api/game/<game_id>/possessions`, Then responde 404 con `{"error": "Este partido no tiene play-by-play.", "code": "sin_pbp"}`; y la conciliación de la competencia lo excluye y lo informa en `games_excluded`.
- CA-11: Given una posesión cualquiera, When se inspecciona, Then su duración es igual a reloj inicio − reloj fin (≥ 0) y cada tiro tiene `elapsed` entre 0 y el reloj inicial de su oportunidad (o nulo si el reloj no es derivable), nunca negativo.
- CA-12: Given que se cambia `clock.reset_secs` a 12 en Configuración, When se vuelve a pedir la inspección, Then las segundas oportunidades muestran reloj inicial 12 sin reiniciar el servidor (caché invalidada por `config_version`).
- CA-13: Given un equipo con posesiones, When se pide `GET /api/metrics/team?id=<code>`, Then `possessions_counted` y `off_poss_duration` tienen valor; y para un quinteto sin pbp suficiente devuelven nulo con razón, nunca 0 ni se omiten.
- CA-14: Given la competencia con pbp, When se abre Datos → Calidad, Then el check "Posesiones incompletas" ya no dice "no disponible" y muestra cantidad, porcentaje y partidos afectados.
- CA-15: Given la competencia completa del seed, When se calculan las posesiones en frío y luego en caliente, Then la primera petición termina en menos de 3 s y la segunda en menos de 0,5 s (medido y anotado en `progress.md`).

## 8. Fuera de alcance
- Origen de la posesión — A-02 ([../02-A-02-origen-posesion/](../02-A-02-origen-posesion/spec.md)).
- Tipo por velocidad — A-03 ([../03-A-03-transicion-contraataque/](../03-A-03-transicion-contraataque/spec.md)).
- Desenlace de cada oportunidad y métricas de segunda oportunidad — A-04 ([../04-A-04-segunda-oportunidad/](../04-A-04-segunda-oportunidad/spec.md)).
- Tramo de reloj de cada tiro — A-05 ([../05-A-05-tramo-reloj-posesion/](../05-A-05-tramo-reloj-posesion/spec.md)).
- Pantallas de análisis de posesión (pestaña Posesión de S3/S4): A-02 y A-03 las habilitan.
- Uso de posesiones en vivo, momentum, emparejamientos, cadenas y RAPM: F-01, F-02, F-07, A-07, A-11.
- Persistir posesiones en la base (descartado por arquitectura §3.9).
- Shot clock oficial (FIBA no lo publica): se deriva (RF-8).
- Reemplazar la fórmula de posesiones del conjunto estándar (`possessions` sigue siendo la del glosario; `possessions_counted` es una clave aparte).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **Nivel de evaluación del 2 %**: por equipo y competencia (no partido a partido), como fija DA-30; el prototipo muestra partidos individuales de hasta +3,3 % por la naturaleza del 0,44. Los partidos con más del 5 % se listan para investigar.
- [DECISIÓN PROPUESTA — confirmar] **Fórmula de referencia para conciliar**: la del glosario sobre los conteos **del pbp** del equipo (no del box), para que la comparación mida la reconstrucción y no diferencias pbp↔box (esas las cubre el check `pbp_box_mismatch` de F-11). La conciliación informa ambas cifras (fórmula pbp y fórmula box).
- [DECISIÓN PROPUESTA — confirmar] **Posesiones de fin de cuarto sin acción** (el equipo recupera con 1–2 s y termina el período sin tiro, pérdida ni falta): se cuentan como posesiones completas con finalización "fin de cuarto" y 0 puntos (son posesiones reales), pero la conciliación informa su cantidad aparte porque la fórmula no las cuenta. Explican la mayor parte del +0,5 % del prototipo.
- [DECISIÓN PROPUESTA — confirmar] **Finalización de una canasta con falta (and-one)**: T2c/T3c (la canasta), con los puntos del tiro libre adicional sumados; "falta recibida" queda para las posesiones que terminan en tiros libres sin canasta.
- [DECISIÓN PROPUESTA — confirmar] **Puntos de tiros libres técnicos**: los del equipo que ataca suman a su posesión; los del equipo que no ataca van a "puntos fuera de posesión" (no abren ni cierran posesiones). Así se cumple RF-11 sin inventar posesiones.
- [DECISIÓN PROPUESTA — confirmar] **Quinteto de la posesión**: el vigente al primer evento de juego de la posesión. Si hay cambios durante la posesión (típicamente entre tiros libres), se conserva el inicial y se marca `lineup_changed` (PROPUESTA de campo en el plan) para que F-06/F-07 decidan cómo atribuir.
- [DECISIÓN PROPUESTA — confirmar] **Reloj inicial 14 "por falta"**: el cliente dice "24 segundos, o 14 si hubo reset por rebote ofensivo o falta". FIBA no registra el reinicio del shot clock por faltas defensivas en campo delantero; A-01 solo aplica 14 tras rebote ofensivo. Una falta defensiva sin tiros libres no cierra la posesión y no reinicia el reloj derivado (queda documentado como limitación en `docs/metrics.md`).
- [DECISIÓN PROPUESTA — confirmar] **Duración**: segundos enteros (resolución de `clock_secs`); en el último minuto FIBA publica centésimas que hoy no se persisten; no se reprocesa por esto.
