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

`POS_jugador` usa la fórmula de posesiones de arriba. Todas valen `null` con denominador 0.

---

## Pérdidas y asistencias

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **TO%** | `TOV / (FGA + FTA × 0.44 + TOV)` | Pérdidas sobre plays totales |
| **TO Ratio** | `TOV / PLAYS` | Pérdidas por play |
| **AST%** | `AST / FGM` | % de canastas con asistencia |
| **AST Ratio** | `AST / PLAYS` | Asistencias por play |
| **AST/TO** *(equipo y jugador)* | `AST_temporada / TOV_temporada` | Ratio asistencias/pérdidas — **acumulado de temporada** |

> **AS/PER es acumulado, no promediado.** Se calcula como el cociente de los **totales** de la
> temporada, no como el promedio de los ratios por partido: un partido de 2/1 no debe pesar lo mismo
> que uno de 10/5. Mismo criterio en equipo y en jugador. Vale `null` si no hubo pérdidas.
> Ver `sdd/specs/15-metricas-jugador/`.

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

## Four Factors (Oliver)

Los cuatro factores que determinan victorias/derrotas:

| Factor | Métrica | Peso aproximado |
|--------|---------|----------------|
| Eficiencia de tiro | eFG% | 40% |
| Pérdidas | TO% | 25% |
| Rebote ofensivo | OR% | 20% |
| Ir a la línea | FT Rate | 15% |

Smart-Basket muestra los Four Factors del equipo vs rival en la vista de equipo.
