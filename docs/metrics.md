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
| **PPT** | `PTS / FGA` | Puntos por tiro intentado (solo tiros de campo) |
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
| **Uso 2P** | `2PA / FGA` | Proporción de ataques con tiro de 2 |
| **Uso 3P** | `3PA / FGA` | Proporción de ataques con tiro de 3 |

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
