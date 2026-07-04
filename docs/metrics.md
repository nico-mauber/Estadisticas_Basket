# Métricas avanzadas

Fuentes: Dean Oliver — *Basketball on Paper*; Guía de scouting FUBB.

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
| **PPT** | `PTS / FGA` | Puntos por tiro intentado |
| **PPP** | `PTS / PLAYS` | Puntos por play (jugador) |

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
| **OR%** | `OR / (OR + DR_rival)` | % rebotes ofensivos capturados |
| **DR%** | `DR / (DR + OR_rival)` | % rebotes defensivos capturados |
| **TRB%** | `(OR + DR) / (OR + DR + OR_rival + DR_rival)` | % rebotes totales |
| **Reb Share** *(jugador)* | `TRB_jugador / TRB_equipo` | Porción de rebotes del equipo |

---

## Pérdidas y asistencias

| Métrica | Fórmula | Descripción |
|---------|---------|-------------|
| **TO%** | `TOV / (FGA + FTA × 0.44 + TOV)` | Pérdidas sobre plays totales |
| **TO Ratio** | `TOV / PLAYS` | Pérdidas por play |
| **AST%** | `AST / FGM` | % de canastas con asistencia |
| **AST Ratio** | `AST / PLAYS` | Asistencias por play |
| **AST/TO** *(jugador)* | `AST / TOV` | Ratio asistencias/pérdidas |

---

## Pace

```
PACE = 40 × ((POS + POS_rival) / 2) / MINUTOS
```

Posesiones proyectadas a 40 minutos (partido estándar). Normaliza equipos con distintos ritmos.

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
| **Def TO Ratio** | `(STL + BLK + DR) / TOV` | Eficiencia defensiva global; alto = mejor |
| **Physical Impact** *(jugador)* | `TRB + STL` | Impacto físico total |

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
