# Métricas avanzadas

Fuentes: Dean Oliver — *Basketball on Paper*; Guía de scouting FUBB.

> **Nulo vs cero.** Toda métrica de tasa de esta página (las que tienen denominador: porcentajes, ratios, puntos por posesión/play/tiro) vale **`null`** —no `0`— cuando su denominador es 0 en un partido (ej. sin tiros libres → FT% nulo). Los promedios entre partidos **excluyen** los nulos. Las stats de conteo conservan su 0 real. Implementado vía `_safe_div(...)=None` en `stats_engine.py`. Ver `sdd/specs/08-nulos-vs-cero/`.
>
> **Reb Share** (y sus variantes ofensiva y defensiva) también es tasa: vale `null` cuando el total del equipo es 0 o no hay dato de equipo para ese partido.

> **Partidos DNP.** Un partido con 0 minutos disputados **no cuenta como partido jugado**: queda fuera de todos los promedios del jugador, de tasa *y* de conteo. Predicado único: `played(minutes)` en `stats_engine.py`. Un partido **con** minutos y 0 puntos sí cuenta —ese 0 es real—, así que esto no contradice la regla de arriba: primero se descarta el DNP (no jugó), después el nulo (jugó sin dato). En el game log el DNP figura sin números y en la evolución queda como hueco (sin punto). Ver `sdd/specs/12-nulos-orden-color-dnp/`.

> **Dato que la competencia no registra.** Los campos de desglose de FIBA (`paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts`) y el `plus_minus` de jugador no los publican todas las competencias. Si FIBA no manda la clave, la ingesta guarda `NULL` y la métrica vale `null` (razón `no_registrado`); `0` solo cuando FIBA informa 0. Los `null` no entran en promedios. Ver `sdd/specs/v2/fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/`.

## Abreviaturas

| Símbolo | Significado |
|---------|-------------|
| PTS | Puntos |
| FGA / FGM | Intentos / Convertidos tiros de campo (total) |
| 2PA / 2PM | Intentos / Convertidos de 2 puntos |
| 3PA / 3PM | Intentos / Convertidos de 3 puntos |
| FTA / FTM | Intentos / Convertidos tiros libres |
| OR / DR | Rebotes ofensivos / defensivos |
| AST | Asistencias |
| TOV | Pérdidas |
| STL | Robos |
| BLK | Tapas |

---

## Posesiones

```
POS = 2PA + 3PA + FTA × 0.44 + TOV − OR
```

Base de todas las métricas de eficiencia. El coeficiente `0.44` estima el porcentaje de tiros libres que inician una nueva posesión.

---

## Plays (finalizaciones ofensivas)

```
PLAYS = FGA + FTA × 0.44 + TOV
```

Similar a posesiones pero sin descuento de rebotes ofensivos. Representa el total de finalizaciones del ataque.

---

## Eficiencia ofensiva y defensiva

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **OER** | `PTS / POS` | Puntos por posesión propia |
| **DER** | `PTS_rival / POS_rival` | Puntos permitidos por posesión rival |
| **Net Rating** | `OER − DER` | Diferencial; >0 = equipo ganador neto |

---

## Eficiencia de tiro

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **eFG%** | `(FGM + 0.5 × 3PM) / FGA` | Porcentaje efectivo (pondera triples) |
| **TS%** | `PTS / (2 × (FGA + FTA × 0.44))` | True Shooting; incluye tiros libres |
| **FG2%** | `2PM / 2PA` | Porcentaje de dobles |
| **FG3%** | `3PM / 3PA` | Porcentaje de triples |
| **FT%** | `FTM / FTA` | Porcentaje de tiros libres |
| **PPT** | `(2×FGM2 + 3×FGM3) / FGA` | Puntos por tiro de campo (excluye FT del numerador). Clave API: `ppt` |
| **PPS** *(legado)* | `PTS / FGA` | Points Per Shot — incluye FT en numerador. Clave API: `pps`. Mantener solo para retro-compat |
| **PPT 2** | `(2 × 2PM) / 2PA` | Puntos por intento de 2 |
| **PPT 3** | `(3 × 3PM) / 3PA` | Puntos por intento de 3 |
| **PPT TL** | `FTM / FTA` | Puntos por tiro libre intentado |
| **PPP** | `PTS / PLAYS` | Puntos por play (jugador) |

---

### eFG% por zona del mapa de tiro

`(convertidos × factor) / intentos`, con `factor = 1.0` en zonas de 2 puntos y `1.5` en zonas de 3.
Es `(FGM + 0.5 × 3PM) / FGA` aplicado a una zona de un único valor de puntos.

> En las zonas de 2 el eFG% **coincide** con el % de acierto: el factor es 1.0. Todo el diferencial
> del eFG% viene del triple.

Cada zona del mapa muestra **% de acierto**, **eFG%** y **PPT**. El indicador `P/F` fue retirado:
era esta misma fórmula de PPT con otra etiqueta. Ver `sdd/specs/16-tiro-completo-ppt/`.

---

## FT Rate

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **FT Rate** | `FTA / FGA` | Capacidad de llegar a la línea (`1PI/FGA` en scouting) |
| **FT Rate Reporte** | `FTM / FGA` | Conversión de tiros libres sobre tiros de campo (`1PC/FGA`) |

---

## Uso del tiro

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **Uso 2P** | `2PA / (FGA + 0.44 × FTA)` | Parte de las jugadas de tiro que terminan en tiro de 2 |
| **Uso 3P** | `3PA / (FGA + 0.44 × FTA)` | Parte de las jugadas de tiro que terminan en tiro de 3 |
| **Uso TL** | `0.44 × FTA / (FGA + 0.44 × FTA)` | Parte de las jugadas de tiro que terminan en tiros libres |

Los tres comparten denominador (las jugadas de tiro) y suman 100 %. Hasta 2026-10-28 Uso 2P y 3P se calculaban sobre los tiros de campo (sumaban 100 % entre ellos) y Uso TL sobre las jugadas de tiro, así que los tres juntos daban más de 100 %. El 3PAr clásico (3PA / FGA) se obtiene como Uso 3P / (Uso 2P + Uso 3P).

### USO% (Usage Rate) — solo jugador

```
USO% = (FGA + 0.44 × FTA + TOV) / (FGA_equipo + 0.44 × FTA_equipo + TOV_equipo)
```

Proporción de las finalizaciones del equipo (plays) consumidas por el jugador mientras está en cancha. Identifica a los jugadores más influyentes en el ataque. `null` si no se dispone de los totales del equipo.

---

## Distribución de puntos

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **Peso 1P** | `FTM / PTS` | % de puntos desde tiros libres |
| **Peso 2P** | `(2 × 2PM) / PTS` | % de puntos desde dobles |
| **Peso 3P** | `(3 × 3PM) / PTS` | % de puntos desde triples |

Suma ≈ 1.0 (diferencias por redondeo).

---

## Rebotes

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **OR%** *(equipo)* | `OR / (OR + DR_rival)` | % rebotes ofensivos capturados |
| **DR%** *(equipo)* | `DR / (DR + OR_rival)` | % rebotes defensivos capturados |
| **TRB%** *(equipo)* | `(OR + DR) / (OR + DR + OR_rival + DR_rival)` | % rebotes totales |
| **Reb Share** *(jugador)* | `TRB_jugador / TRB_equipo` | Porción de rebotes del equipo |

### OR% / DR% / TRB% de jugador — fórmula individual

Las fórmulas de arriba son **de equipo** y no aplican a un individuo. Para un jugador se usa la
fórmula individual, que ajusta por los minutos que estuvo en cancha:

```
OR%  = (RO_jug  × duración_partido) / (min_jug × (RO_equipo + RD_rival))
DR%  = (RD_jug  × duración_partido) / (min_jug × (RD_equipo + RO_rival))
TRB% = (REB_jug × duración_partido) / (min_jug × (REB_equipo + REB_rival))
```

Responde "de los rebotes disponibles mientras estuvo en cancha, ¿qué porción capturó?". `null` si
faltan los datos del rival o si el jugador no disputó minutos.

**Temporada (C-01):** la cifra de una selección de partidos es el **cociente de los totales** de los
términos —`OR% = Σ(RO·L) / Σ(min·(RO_eq + RD_rival))`, igual para DR% y TRB%, con `L` = duración de cada
partido—, no la media de los % de cada partido (un partido de 1 minuto no pesa lo que uno de 35). Es una
estimación por minutos: con muestras ínfimas explota (15 s con 1 RO daría 516 %). **Un OR%/DR%/TRB% mayor a
100 % no se muestra**: vale `null` con razón `estimacion_invalida`.

> ⚠️ El `OR%` de jugador y el de equipo comparten nombre pero son escalas distintas: el de equipo
> ronda 29%, el individual ~4%. No compararlos entre sí.

---

## Por posesión y por minuto *(jugador)*

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **AS/pos** | `AST / POS_jugador` | Asistencias por posesión propia |
| **PER/pos** | `TOV / POS_jugador` | Pérdidas por posesión propia (**PER = pérdidas**, no Player Efficiency Rating) |
| **PTS/pos** | `PTS / POS_jugador` | Puntos por posesión propia — **idéntico al OER de jugador**: misma fuente, dos etiquetas |
| **RO/min** | `OR / min_jugador` | Rebotes ofensivos por minuto disputado |
| **RD/min** | `DR / min_jugador` | Rebotes defensivos por minuto disputado |

`POS_jugador = T2i + T3i + 0,44 × TLi + PER − RO` (fórmula de posesiones de arriba).

**Temporada (C-01, DA-02):** la cifra de una selección de partidos es el **cociente de los totales**, no la media
de las tasas de cada partido: `AS/pos = ΣAST / ΣPOS_jug`, `PER/pos = ΣTOV / ΣPOS_jug`, `PTS/pos = ΣPTS / ΣPOS_jug`,
`RO/min = ΣRO / Σmin`, `RD/min = ΣRD / Σmin`; solo con partidos **jugados** (un DNP no suma). Como a la posesión se
le resta el rebote ofensivo, puede ser ≤ 0 (un partido con 2 tiros libres y 1 RO da −0,12): **una tasa por posesión
nunca es negativa**; con `POS ≤ 0` (en el partido o en la selección) vale `null` con razón `sin_intentos`. `RO/min`
y `RD/min` tienen valor siempre que haya minutos (0,00 es un cero real). El OER de jugador es el mismo número que
PTS/pos y sigue el mismo criterio. Se reproducen sumando el box score de la selección.

---

## Pérdidas y asistencias

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **TO%** | `TOV / (FGA + FTA × 0.44 + TOV)` | Pérdidas sobre plays totales |
| **TO Ratio** | `TOV / PLAYS` | Pérdidas por play |
| **AST%** | `AST / FGM` | % de canastas con asistencia |
| **AST Ratio** | `AST / PLAYS` | Asistencias por play |
| **AS/PER** *(equipo y jugador; clave `ast_to`)* | `ΣAS / ΣPER` de la selección | Asistencias sobre pérdidas — **acumulado de la selección**. **PER = pérdidas** (no el Player Efficiency Rating). El valor de **un partido** (`AS/PER` de ese partido) existe solo como columna del game log |

> **AS/PER es acumulado, no promediado (definición única, C-04).** Se calcula como el cociente de los
> **totales** de la selección que se está viendo (todas las competencias, una competencia o los últimos N),
> no como el promedio de los ratios por partido: un partido de 2/1 no debe pesar lo mismo que uno de 10/5.
> Mismo criterio en equipo y en jugador, en el perfil, en Comparar y en el Buscador (`stats_engine.season_ast_to`;
> el filtro del cliente lo recalcula con los mismos totales). En el jugador solo cuentan los partidos
> **jugados** (un DNP no suma). La respuesta trae los totales que lo respaldan (`totals.ast`, `totals.tov`) y la
> card los muestra: `1,48 (43/29)`. Vale `null` con razón `sin_perdidas` si `ΣPER = 0` y `0,00` si `ΣAS = 0` con
> pérdidas. El `Ø` y color de rendimiento vienen del promedio de liga de la competencia (C-02).
> Ver `sdd/specs/15-metricas-jugador/` y `sdd/specs/v2/fase-1-confiabilidad/08-C-04-as-per/`.

---

## Creación de juego *(jugador, A-12)*

FIBA publica en cada asistencia el evento del tiro que la convirtió (`previousAction`). Con ese vínculo:

| Clave | Fórmula | Base |
|---|---|---|
| `ast_team_share` | AST del jugador ÷ AST del equipo en los partidos que el jugador disputó (cociente de totales; no depende del vínculo) | fija |
| `ast_points` | 2 × asistencias a tiros de 2 + 3 × asistencias a tiros de 3 | conteo (escala con la base) |
| `pts_per_ast` | `ast_points` ÷ asistencias a tiros de campo | fija |

Las asistencias a tiro libre no suman puntos generados: no se sabe cuántos de la serie entraron. Sin el vínculo el valor es nulo con razón `no_registrado` (hay que reprocesar el partido), nunca 0; sin jugada a jugada, `sin_pbp`; sin asistencias en la selección, `sin_asistencias`. AS/pos y la cuota del equipo son indicadores distintos: el primero normaliza por las posesiones del jugador, el segundo por las asistencias del equipo.

## Origen de la posesión (A-02)

Cada posesión completa tiene **uno y solo uno** de siete orígenes (`origin.py`, sobre el evento que cerró la posesión anterior; el "tras rebote ofensivo" del cliente es origen de una *oportunidad*, no de una posesión, y se informa aparte, DA-29). Precedencia cuando el evento admite varias lecturas: `tiempo_muerto` > `robo` > `rebote_defensivo` > `tiro_libre_rival` > `canasta_rival` > `perdida_rival` > `saque_banda`.

| Origen | Regla |
|---|---|
| `tiempo_muerto` | hay un `timeout` (de cualquiera de los dos equipos) entre el evento de cierre anterior y el inicio de la posesión |
| `robo` | el cierre anterior es una pérdida rival y el equipo registra un `steal` en la vecindad (hasta 3 eventos antes de la pérdida o entre la pérdida y el inicio). FIBA no publica `previous_action` en las pérdidas, así que el vínculo es por vecindad |
| `rebote_defensivo` | la posesión abre con un rebote del equipo tras un tiro de campo errado |
| `tiro_libre_rival` | el cierre anterior es un tiro libre rival convertido, **o** un tiro libre rival errado que el equipo rebotea (definición literal del cliente: "convertido o rebotado") |
| `canasta_rival` | el cierre anterior es un tiro de campo rival convertido |
| `perdida_rival` | el cierre anterior es una pérdida rival sin robo registrado |
| `saque_banda` | inicio de período (salto inicial o posesión alterna, también en prórroga), balón retenido, y **default** de todo caso no identificable (nunca un octavo origen: garantiza que la suma de orígenes iguale el total de posesiones) |

Por origen: **volumen** y **%** = posesiones del origen / posesiones completas de la selección; **PPP** = pts / posesiones; **eFG%** = (FGM + 0,5·3PM) / FGA; **TO%** = pérdidas / posesiones; **FT Rate** = TLI / TCI; **duración media** = segundos / posesiones. Reparto de finalización sobre `end_type`: T2 (`t2c`+`t2f`), T3 (`t3c`+`t3f`), TL (`falta`), Pérdida; `fin_periodo` (posesión sin tiro por fin de cuarto) cuenta en volumen y PPP pero se informa aparte, fuera del reparto %. Un origen sin intentos → `null` con razón `sin_intentos`. Fórmulas en `stats_engine.origin_rates`.

## Tipo de posesión: transición, ataque temprano y media cancha (A-03)

Cada posesión completa con un evento de decisión tiene un tipo (`transition.py`), independiente de su origen. Se mide con los segundos de reloj de posesión hasta el **primer evento de decisión**: primer tiro de campo; si no hay tiro, la falta recibida con tiros libres o la pérdida. `transicion` si ≤ `transition.max_secs` (7), `early` si ≤ `early_offense.max_secs` (12), `media_cancha` en el resto. Los cortes se leen de la configuración (F-13) en cada reconstrucción: cambiarlos reclasifica sin reiniciar. Sin tipo, y contadas aparte: `incompleta`, `sin_accion` (fin de período sin tiro, falta ni pérdida) y `reloj_no_derivable`. El reparto de los tres tipos suma 100 % de las posesiones clasificadas (pooled).

El reloj de posesión es derivado (FIBA no publica shot clock) con resolución de 1 s: un tiro a los 7,4 s se lee como 7 y es transición. Por tipo: volumen, %, PPP, eFG%, TO%, FT Rate (fórmulas de origen), duración media y segundos hasta el primer tiro; diferencial de PPP transición − media cancha. Finalización en transición (6 categorías exclusivas, `fin_periodo` aparte): bandeja o volcada (`layup`, `drivinglayup`, `reverselayup`, `tipinlayup`, `dunk`), otro 2, triple de esquina (`left_corner_3`/`right_corner_3`), triple frontal, tiro libre (la posesión termina en falta) y pérdida. Corredores: iniciador = quien capturó el rebote defensivo o robó (el robo se busca en los 10 eventos previos); finalizador = quien tiró, perdió el balón o recibió la falta (`foulon`). Defensa: transiciones concedidas por 100 posesiones, pérdidas propias seguidas de transición rival, y balance defensivo = tiros de campo propios fallados que el rival convierte en transición con puntos (origen `rebote_defensivo`). El **primer pase de salida** no existe en el pbp de FIBA: `no_registrado`.

## Segunda oportunidad (A-04)

Cada rebote ofensivo propio (incluido el de equipo) abre una oportunidad nueva (`Chance` n ≥ 2 de A-01) dentro de la misma posesión (`second_chance.py`). Desenlace, uno y solo uno, según la acción terminal de la oportunidad: pérdida sin tiro → `perdida`; termina en tiros libres sin canasta de campo → `falta_recibida`; canasta de campo → `putback` / `kickout_triple` / `reinicio` según el modo del tiro (el and-one suma sus puntos); tiro fallado o fin de período → `sin_puntos`. Modo del tiro: `putback` = tiro a ≤ `oreb.putback_secs` del rebote **sin asistencia vinculada** (FIBA no registra pases no asistidos); `kickout` = triple a ≤ `oreb.kickout_secs` que no es putback; `reinicio` = el resto. Los segundos se miden con el reloj derivado (1 s de resolución).

**PPP de 2.ª oportunidad** = puntos de las oportunidades n ≥ 2 / cantidad de oportunidades n ≥ 2; **PPP de 1.ª** = puntos de las primeras oportunidades / posesiones completas; **puntos por rebote ofensivo** = puntos de la cadena / rebotes ofensivos capturados; **conversión** = oportunidades n ≥ 2 con puntos / oportunidades n ≥ 2. Origen del rebote por el tiro fallado que cierra la oportunidad anterior (`cercano` = zona restringida). Cadena = posesión con 2 o más rebotes ofensivos (3 o más oportunidades). **OR% concedido** = ROF rival / (ROF rival + RDEF propios) = 1 − DR%. **Coste del rebote ofensivo** (aproximación): transiciones (A-03) del rival en posesiones que abre su rebote defensivo tras un tiro propio fallado. La zona del rebote y el rebote largo vs en la zona son `no_registrado`. Conciliación con `second_chance_pts` del box: exacta en 11 de 14 equipos del seed; los otros 3 difieren en 2 puntos en un partido (uno por un rebote ofensivo en una posesión incompleta).

## Tramo de reloj de posesión (A-05)

**Fuente derivada.** FIBA LiveStats no publica el shot clock. El reloj de posesión se deriva: segundos de reloj de partido transcurridos desde el inicio de la oportunidad hasta el evento (dentro del período; resolución de 1 s, un tiro a 8,4 s cuenta como 8). Tras canasta rival el saque no se registra, así que el tiempo del saque cuenta como posesión y el valor puede estar sobreestimado en 1 a 3 s. No hay forma de validarlo contra el reloj oficial.

**Tramos** (`clock.early_max` = 8, `clock.mid_max` = 16): temprano 0–8 s, medio 9–16 s, tardío 17–24 s. Un tiro sin reloj derivable queda **sin tramo** (`no_clock`), nunca como temprano. Tras rebote ofensivo el reloj se reinicia a 14 s (`clock.reset_secs`): esas oportunidades se analizan **aparte** (`r14`), con tramos temprano y medio (9–14 s) y sin tramo tardío; sus tiros no se mezclan con los del reloj de 24 s en ningún promedio.

**Unidad.** El tramo de una *oportunidad* es el de su evento de decisión (último tiro de campo; si no hay, la pérdida; si no, el primer tiro libre de la falta). El tramo de un *tiro* es el de su propio instante. Cada tiro de campo del equipo cae en uno solo de: tramo del reloj de 24 s, tramo del reloj de 14 s, sin reloj o posesión incompleta (se concilia contra el box oficial).

**Fórmulas por tramo.** eFG% = (T2c + 1,5 × T3c) / tiros de campo del tramo; PPT = puntos de campo / tiros de campo; TS% = (puntos de campo + TLc) / (2 × (tiros de campo + 0,44 × TLi)); PPP = puntos de las oportunidades del tramo / oportunidades del tramo; TO% = pérdidas / oportunidades; violaciones de 24 s = pérdidas con subtipo `24sec` / oportunidades; reparto T2 / T3 / TL / pérdida = cómo termina cada oportunidad (suma 100 %). **Peso de los triples**: `share_of_band` = triples intentados / tiros del tramo; `share_of_team_3pa` = triples del tramo / triples del equipo; `pts_share` = puntos de triples del tramo / puntos de campo del equipo.

**Jugador por tramo.** *Tiros* = tiros de campo del jugador en el tramo (reloj de 24 s); *termina* = oportunidades del tramo cuyo evento de decisión es suyo (último tiro, pérdida o primer tiro libre de la falta recibida); **USO% del tramo** = oportunidades que termina / oportunidades del equipo en el tramo (con la fila "Equipo / sin jugador" suman 100 %); **PPP personal** = puntos de las oportunidades que termina / oportunidades que termina; eFG%, PPT y TS% como en el equipo, con los tiros libres de las oportunidades que termina.

**Matriz zona × tramo.** Los tiros de campo de posesiones completas (ambos relojes) por zona (11 zonas) y tramo; la suma de las zonas de cada tramo es igual a los tiros del tramo y la columna "Sin reloj" a los tiros sin reloj derivable. Los tiros sin coordenadas van a la fila "Sin zona".

**Panel de decisión.** Siete preguntas con los números de la propia tabla de tramos: (1) TO%, pérdidas y reparto por tipo; (2) PPP y eFG% contra el promedio de la competencia en el mismo tramo (media de los equipos con valor, reloj de 24 s); (3) zona con más tiros por tramo; (4) cómo termina cada oportunidad y peso de la pintura; (5) quién termina más oportunidades por tramo; (6) PPP tardío menos temprano y % de las oportunidades de 24 s con tramo que llega al tardío; (7) la misma lectura en la vista Defensa.

**Tipos de pérdida.** pase = `badpass`; manejo = `ballhandling`; pasos = `travel`; 24 segundos = `24sec`; otras = el resto de los subtipos y las pérdidas sin subtipo.

## Composición de los puntos (A-05)

Con el box oficial de los partidos de la selección (en defensa, el del rival): puntos de triples = 3 × T3c, de dobles = 2 × T2c, de tiros libres = TLc; el peso de cada uno es su parte de los puntos (suman 100 %). **Peso de las pérdidas**: pérdidas / posesiones (`TC + 0,44 × TL + TO − RO`) y puntos perdidos estimados = pérdidas × PPP del equipo (estimación). **Peso de las asistencias**: asistencias / canastas de campo, y puntos generados = 2 × asistencias a doble + 3 × asistencias a triple (A-12; los tiros libres asistidos no suman).

## Uso de tiro: 2P, 3P y TL, y zonas *(correcciones de Equipo, 2026-10)*

**Uso de 2P / 3P / TL** = reparto de las jugadas de tiro (TCi + 0,44 × TLi): TC2i, TC3i y 0,44 × TLi sobre ese total; los tres suman 100 % (ver "Uso del tiro"). Están en el perfil de tiro de equipo y jugador y en la tabla del ranking de Liga.

**Zonas de tiro.** Las coordenadas de FIBA (`court_x` a lo largo, `court_y` a lo ancho, 0–100) son de la cancha completa y cada equipo tira a los dos aros. `shot_zones.to_half_court` gira los tiros del aro de la derecha 180° y devuelve (posición a lo ancho en %, distancia a la línea de fondo en metros, cancha de 28 × 15 m). Zonas: **pintura** (`restricted_area`) = dentro del área (ancho 33,7–66,3 %, hasta la línea de tiros libres a 5,80 m) o bandeja, volcada y similares; **esquina** = triple a menos de 2,99 m de la línea de fondo; **media distancia** = tiro de 2 fuera de la pintura (cerca del fondo: `mid_*_close`; pasada la línea de tiros libres: `mid_*_far` y `mid_top`). Antes se clasificaba con las coordenadas legadas `x/y` (siempre 0) y todos los tiros caían en pocas zonas. **% tiros en pintura** (`paint_fga_share`) = tiros en `restricted_area` / tiros de campo; **% tiros de media** (`mid_fga_share`) = tiros en las cinco zonas de media / tiros de campo. Sin coordenadas en algún partido de la selección, ambos quedan `no_disponible`.

**Desglose ofensivo calculado.** Si FIBA no publica el campo, banca = puntos de los no titulares (exacto); pintura = 2 × tiros de campo convertidos en la pintura; segunda oportunidad = puntos de las oportunidades que siguen a un rebote ofensivo (A-04); tras pérdida rival = puntos de las posesiones que empiezan con robo o pérdida rival (A-02); contraataque = puntos de las posesiones de transición (A-03, aproximación). Lo que FIBA informa, incluso 0, no se toca.

**Promedio de liga con competencia joven.** Si ningún equipo llega al mínimo de muestra (`sample.team.min`), o si menos de la mitad de los equipos lo alcanza, la ficha quedaba sin promedio o decía "4.º de 4" con 16 equipos en la liga; ahora se compara contra todos los equipos con partidos y `population.fallback` = `sin_umbral` lo avisa.

## Pace

```
PACE = 40 × ((POS + POS_rival) / 2) / MINUTOS
```

Posesiones proyectadas a 40 minutos (partido estándar). Normaliza equipos con distintos ritmos.
`MINUTOS` = duración real del partido (`games.minutes`: 40 + 5 por prórroga). Los partidos importados
antes de F-11 tienen 40 hasta reprocesarlos. La misma duración entra en OR%/DR%/TRB% individuales.

---

## Métricas defensivas (rivales permitidos)

Calculadas sobre las stats crudas del rival en ese partido:

| Métrica | Descripción |
|---------|-------------|
| **Opp eFG%** | eFG% permitido al rival |
| **Opp TS%** | TS% permitido al rival |
| **Opp TO%** | % pérdidas forzadas al rival |
| **Opp FT Rate** | FTA/FGA permitido al rival (cuánto llegan a la línea) |

---

## Métricas de scouting defensivo

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **Stops** | `STL + BLK` | Actividad defensiva — robos + tapones |
| **Def Playmaking** | `STL + BLK − TOV` | Impacto neto defensivo |
| **Def TO Ratio** | `(STL + BLK + DR) / TOV` | Eficiencia defensiva global; alto = mejor. Promedio de temporada **acumulado** (`Σ(STL+BLK+DR) / ΣTOV`), como AS/PER |
| **Physical Impact** *(jugador)* | `TRB + STL` | Impacto físico total |

> **Sin centinelas.** AS/PER y Def TO Ratio con 0 pérdidas valen `null` (razón `sin_perdidas`), por
> partido y en el acumulado. Antes valían `99.0`, un número inventado que entraba en los promedios y
> producía comparaciones imposibles ("↑ 9900.0%"). "Jugó sin perder la pelota" se lee en PER = 0.
> Ver `sdd/specs/v2/fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/`.

---

## Promedio de liga (C-02)

El `Ø` de cada métrica es la **media de las entidades** de la competencia seleccionada (DA-08): cada
equipo o jugador contribuye con UN valor (el de todos sus partidos), no ponderado por cantidad de
partidos. Para equipos, la población son los equipos con ≥ 1 partido en la competencia; para jugadores,
los que jugaron ≥ 1 partido (DNP no cuenta). `best` es el mejor valor de la población.

```
Ø(métrica) = Σ valor_entidad / N_entidades_con_dato
```

No se recalcula con el filtro de últimos N: depende solo de la competencia. Sin competencia seleccionada
(`all`), el `Ø` es `null` con razón `sin_universo`. Implementado en `population.league_averages` →
`stats_engine.league_averages`. Ver `sdd/specs/v2/fase-1-confiabilidad/02-C-02-promedios-de-liga/`.

---

## Four Factors (Oliver)

Los cuatro factores que determinan victorias/derrotas:

| Factor | Métrica | Peso aproximado |
|--------|---------|----------------|
| Eficiencia de tiro | eFG% | 40% |
| Pérdidas | TO% | 25% |
| Rebote ofensivo | OR% | 20% |
| Ir a la línea | FT Rate | 15% |

Smart-Basket muestra los Four Factors del equipo vs rival en la vista de equipo.

---

## Conjunto estándar (T-05)

Catálogo único de **83 claves en 12 grupos** (volumen, producción, tiro — intentos/aciertos/porcentajes/
valor/perfil, balón, rebote, defensa, faltas, uso, otras métricas), definido en `backend/metrics_catalog.py`
(metadatos) y `backend/stats_engine.compute_standard(bundle)` (fórmulas, puras — no tocan la base). Se expone
en `GET /api/metrics-catalog` y `GET /api/metrics/<entity_type>` (`team`, `player`, `lineup`, `onoff`,
`clutch`), y como bloque `standard` en `GET /api/team`/`GET /api/player`. Las cinco entidades devuelven
**exactamente las mismas 83 claves**, nunca un subconjunto: la que no aplica o no se puede calcular sale
`{"value": null, "reason": "..."}`.

La mayoría de las fórmulas son las ya documentadas arriba (pooled: cociente de totales, DA-02). Fórmulas
**conciliadas** (cambian de valor respecto al legado, solo en el bloque `standard`; el legado conserva su
cálculo anterior, R-04):
- `ppt` (DA-03): `(2×FGM2 + 3×FGM3) / FGA` — ya vigente desde C-07; el legado `pps` sigue siendo `PTS/FGA`.
- `to_pct` de equipo/quinteto/ON-OFF/cierre (DA-04): `TOV / posesiones` (antes: `TOV / plays`).
- `uso_pct` de jugador (DA-05): calculado **con el jugador en cancha** (ponderado por minutos del segmento),
  no sobre el partido completo.
- `as_pct` de jugador (DA-06): `AST / (TCc_equipo·peso − TCc_jugador)` en vez de `AST/FGM` propio.
- `der`/`net_rating` de jugador (DA-34): usan las posesiones del rival **mientras el jugador está en
  cancha** (de `pbp_events`), no las del equipo en el partido completo.

Nulos nuevos de T-05 (suman a los de C-11): `sin_datos` (la selección no tiene partidos), `sin_pbp` (ninguno
de los partidos de la selección tiene play-by-play), `no_aplica` (la métrica no existe para esa entidad, ej.
USO% en equipo), `no_disponible` (definida en el catálogo pero habilitada recién con un requisito posterior,
ej. `paint_fga_share`/`mid_fga_share` hasta C-03).

**Datos nuevos de FIBA** (antes descartados): `blk_received` (tapones recibidos) y `fouls_drawn` (faltas
recibidas), por equipo-partido y jugador-partido (ver `docs/database.md`). En quinteto/ON-OFF/cierre se
derivan del play-by-play (`block` del rival, `foulon` del equipo) sin columna nueva.

**Bases de normalización (T-04).** Cada clave del catálogo tiene un `base_mode`:

| `base_mode` | Total | Por partido | Por 40 minutos | Por 100 posesiones |
|---|---|---|---|---|
| `fixed` (tasas, %, ratios, `games`, `pace`) | igual | igual | igual | igual |
| `count` (`pts`, `ast`, `tov`, `orb`…) | suma de la selección | total ÷ partidos | total × 2400 ÷ segundos de la entidad | total × 100 ÷ posesiones del denominador |
| `volume` (`minutes`, `possessions`, `plays`) | suma | total ÷ partidos | total (sin escalar) | total (sin escalar) |

- **Segundos de la entidad:** equipo = minutos de partido con prórrogas (40 + 5 por prórroga); jugador = minutos
  jugados; quinteto, ON/OFF y cierre = segundos en cancha.
- **Posesiones del denominador** (`per100_den`): propias para casi todos los conteos; del rival para lo concedido
  o generado por el rival (`pts_against`, `blk_received`, `fouls_drawn`, `stops`). Jugador: las del equipo con él en
  cancha (exactas por pbp; si algún partido no tiene pbp, estimadas por fracción de minutos y la métrica sale con
  `estimated: true`).
- Siempre sobre totales ya sumados (`por_partido × partidos = total`). Denominador 0 → nulo `sin_datos`.

Ver `sdd/specs/v2/fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/` y `docs/api.md` §Conjunto estándar.

---

## Confiabilidad de muestra (T-02)

Toda métrica derivada de posesiones (combinación de jugadores, ON/OFF, cierres) trae un **badge de
muestra** (`sample`, en la raíz del payload de `GET /api/metrics/<entity_type>`): `level` (`baja`/`media`/
`alta`), `unit`, `n`, `min`, `high`, `min_source` (`absoluto`/`relativo`), y `games`/`minutes`/`possessions`
siempre informados. `ranked = false` si `level === "baja"`: esa entidad queda fuera de rankings, tarjetas de
líderes y sugerencias automáticas — se sigue viendo, en gris, con la advertencia "Muestra baja: no entra en
rankings ni recomendaciones" (nunca se oculta).

**Umbrales por entidad** (`backend/sample.py`, configurables por F-13, ninguno fijo en el código):

| Entidad | Mínimo | Alta | Config |
|---|---|---|---|
| Quinteto | 15 pos | 40 pos | `sample.lineup.min`/`.high` (+ relativo 1,5 % de posesiones del equipo, piso absoluto) |
| ON/OFF de jugador | 40 pos en cada estado | 120 pos | `sample.onoff.min`/`.high` (n = menor de ON/OFF) |
| Cierre (split) | 15 pos | 40 pos | `sample.split.min`/`.high` |
| Jugador (población) | 60 min | 200 min | `sample.player.min`/`.high` |
| Equipo (población) | 3 PJ | 10 PJ | `sample.team.min`/`.high` |

**Regresión a la media** (OER/DER/Net Rating de quinteto, ON/OFF, cierre — nunca de equipo/jugador):
```
ajustado = (pos × crudo + K × prior) / (pos + K)
```
`prior` = puntos por posesión de la competencia (Σpts/Σposesiones de todos los equipo-partido). `K` por
entidad (defaults: 25 quinteto, 50 ON/OFF, 20 cierre), configurable y calibrable (ver abajo). Net Rating
ajustado = OER ajustado − DER ajustado (prior de Net = 0). El payload trae `adj: {value, k, prior, band}`
junto al valor crudo en `oer`/`der`/`net_rating`; la UI muestra ambos, nunca solo el ajustado.

**Banda de error (95 %):** `± z·σ/√(pos+K)` para OER/DER; para Net Rating, `± z·σ·√(1/(pos_of+K) +
1/(pos_def+K))`. `z=1,96`, `σ=1,15` (`sample.band_z`, `sample.ppp_sd`), configurables.

**Calibración de K** (`POST /api/settings/calibrate`, admin): divide los partidos de cada unidad (quinteto u
ON/OFF) en dos mitades por paridad (partidos alternos), calcula la correlación `r` de OER entre mitades y
sugiere `K = n̄_mitad·(1−r)/r`. No persiste: el admin confirma con "Aplicar" en Configuración. Con menos de
10 unidades o `r ≤ 0`, no sugiere K (`warnings`).

Ver `sdd/specs/v2/fase-1-confiabilidad/14-T-02-confiabilidad-muestra/` y `docs/api.md` §Confiabilidad de muestra.

---

## Ficha de métrica (T-01)

Toda métrica del conjunto estándar de equipo/jugador/quinteto/ON-OFF/cierre se muestra con **cinco
elementos** (reemplazan el bloque viejo "Ø liga / ↑ x"): **valor** (siempre primero), **ranking** sobre el
total de la población ("7.º de 12", con "=" en empates), **distancia al líder** (nombre + valor + distancia
orientada), **distancia al promedio** (con signo) y **percentil** 0-100 con color continuo (rojo 0 · gris 50 ·
verde 100). Los campos viajan en cada objeto de `metrics[clave]` de `GET /api/metrics/<entity_type>`:
`rank`, `rank_total`, `tied`, `in_population`, `percentile`, `avg`, `dist_avg`, `dist_avg_rel`, `leader`,
`dist_leader`, `dist_leader_rel`, `pct_reason`, `basis`. Cálculo en `backend/population.py` (puro, no
persiste; Constitución 4).

**Población de referencia** (umbrales configurables, F-13): equipos con ≥ `sample.team.min` partidos (3),
jugadores con ≥ `sample.player.min` minutos (60), quintetos/ON-OFF/cierres con muestra ≥ el mínimo efectivo de
T-02. Una entidad bajo el umbral recibe su ficha completa marcada "muestra baja" (ranking hipotético) pero NO
entra en el conteo del total, el líder, el promedio ni los percentiles de las demás.

**Fórmulas** (`s = +1` si más es mejor, `−1` si menos es mejor):
- Ranking: competición estándar "1224" (empates comparten puesto, el siguiente salta).
- Percentil: `round(100 × (B + 0,5·E) / N)`, `N` = entidades de la población distintas de la consultada con
  valor, `B` = estrictamente peores, `E` = iguales (orientado por dirección). Mid-rank, excluye la propia.
- Promedio: media aritmética de los valores de las entidades `in_population` (DA-08, mismo que la tabla de Liga).
- Distancias orientadas (DA-09): `dist_líder = s·(valor − líder)` (≤ 0 para un miembro), `dist_promedio =
  s·(valor − promedio)` — positivas cuando la entidad es mejor, en todas las métricas incluidas las de menos-
  es-mejor. La diferencia aritmética sin orientar va en el tooltip.
- Color: interpolación lineal RGB entre #ef4444 (p0) · #8b949e (p50) · #22c55e (p100); el texto "pNN" acompaña
  siempre (el color no es el único portador). Métrica neutral o valor nulo: sin color.

**Inversión completa** en métricas de menos-es-mejor (DER, PTS recibidos, pérdidas, TO%, faltas, tapones
recibidos, Opp eFG%/TS%/FT Rate, TO ratio, PER/pos): líder = valor más bajo, ranking y percentil al revés,
distancias orientadas igual.

**Valor ajustado** (T-02): donde una métrica tiene `adj` (OER/DER/Net Rating de quinteto/ON-OFF/cierre), el
ranking, el percentil, el líder y el promedio se calculan sobre el valor ajustado. **Conteos y volumen** se
rankean por partido (equipos con distinta cantidad de partidos no son comparables en totales); la ficha lo
rotula con `basis: "partido"`.

**Población insuficiente / sin universo:** si la población tiene menos de `population.min_size` (3) entidades
con valor, los campos de ficha son nulos con razón `poblacion_insuficiente`; `competition=all` → `sin_universo`;
contexto no comparable → `contexto_no_comparable`. El valor siempre se ve.

El promedio de la tabla de **Liga** pasa a ser el cociente de totales (pooled) por métrica, coherente con la
ficha (ver tabla antes/después en el `progress.md` de T-01; cambia notablemente TO% = PER/POS, DA-04).

Ver `sdd/specs/v2/fase-1-confiabilidad/15-T-01-ficha-de-metrica/` y `docs/api.md` §Ficha de métrica.
