# Spec — Feature 17: vista Liga (tabla general y eje de rebote)

> **Requisitos C-09 y C-10** (`Smart-Basket Especificacion v2.docx` §1, P1/P2). Corte:
> `sdd/ROADMAP-bloque-C.md` §4 — agrupados por pantalla.

## 1. Objetivo
Que la vista Liga tenga la tabla de posiciones clásica que hoy no existe, y que las leyendas de los
ejes del mapa digan correctamente hacia dónde está el mejor rendimiento.

## 2. Fuentes (trazabilidad)

**C-09 (P1):**
- *"Incluir tabla de posiciones clásica: PJ, PG, PP y puntos, con 2 puntos por partido ganado y 1 por partido perdido."*
- *"Agregar columna de puntos anotados y puntos recibidos."*
- CA: *"La tabla general ordena por puntos y su suma es coherente con el game log de cada equipo."*

**C-10 (P2):**
- *"Invertir el sentido de la flecha del eje de rebote para que la dirección indique el lado favorable, igual que en los ejes de OER y DER."*
- CA: *"La leyenda del eje describe correctamente hacia dónde está el mejor rendimiento."*

**Docs:**
- `docs/api.md` — `GET /api/league`: una entrada por equipo con `games` y promedios.
- `docs/frontend.md` §Vista Liga — tabla de ranking ordenable + mapa de dispersión con presets.

**Código (estado verificado sobre el repo):**
- `backend/app.py` `league_overview` — devuelve `games` y promedios por partido. **No devuelve
  victorias, derrotas, puntos de tabla ni totales anotados/recibidos.** `TeamGameStats` sí tiene `pts`
  y `opp_pts` por partido, así que el dato está.
- `backend/app.py` `league_overview` — `result.sort(key=lambda x: x["oer"], reverse=True)`: desde la
  Feature 14 `_avg` puede devolver `None`, y comparar `None` con `float` levanta `TypeError`. Fallo
  latente, no observado porque todo equipo con partidos tiene OER.
- `frontend/js/app.js` `LEAGUE_COLS` — PJ, OER, DER, NRtg, eFG%, TS%, OR%, DR%, TO%, Pace, Pts
  (Pts es **promedio de puntos por partido**, no puntos de tabla).
- `frontend/js/app.js` `LEAGUE_MAPS` — tres presets. Los títulos de eje usan `↑`/`↓`.
- `frontend/js/charts.js` `drawLeagueScatter` — `y: { reverse: false }`: el valor más alto siempre
  arriba. Verificado en navegador: el equipo con mayor DR% se dibuja arriba (pixelY 39 vs 264).

**Hallazgo sobre C-10 (verificado en navegador):** los ejes se comportan bien —lo alto está arriba—
pero el símbolo `↑` significa **dos cosas distintas** según el eje:
- En el eje **Y**, `↓ mejor defensa` (DER) describe una **posición en pantalla**: abajo es mejor. Correcto.
- En el eje **X**, `↑ mejor ataque` (OER) describe **"más es mejor"**; en pantalla, lo mejor está a la
  **derecha**, no arriba. Una flecha vertical en un eje horizontal no puede indicar el lado favorable.

Eso es lo que incumple el CA de C-10: *"la leyenda del eje describe correctamente hacia dónde está el
mejor rendimiento"*.

## 3. Historias de usuario
- **US-1**: Como entrenador, quiero ver la tabla de posiciones con puntos, para saber cómo va el
  campeonato sin salir de la app.
- **US-2**: Como entrenador, quiero ver los puntos anotados y recibidos totales de cada equipo, porque
  es el desempate habitual en la tabla.
- **US-3**: Como analista, quiero que la leyenda de cada eje del mapa me diga hacia qué lado de la
  pantalla está el mejor rendimiento, para leer el gráfico sin tener que deducirlo.

## 4. Requisitos funcionales

- **RF-1**: La vista Liga DEBE incluir una tabla de posiciones con **PJ, PG, PP y puntos**. ·
  (US-1, C-09)
- **RF-2**: Los puntos de tabla DEBEN calcularse como **2 por partido ganado y 1 por partido
  perdido**. · (US-1, C-09)
- **RF-3**: La tabla DEBE incluir **puntos anotados** y **puntos recibidos**, acumulados de la
  competencia seleccionada. · (US-2, C-09)
- **RF-4**: La tabla DEBE ordenarse por puntos de forma descendente por defecto. · (US-1, C-09 CA)
- **RF-5**: PJ DEBE ser igual a PG + PP, y los puntos anotados y recibidos DEBEN coincidir con la suma
  del game log del equipo. · (US-1, C-09 CA)
- **RF-6**: Los datos de la tabla DEBEN respetar el filtro de competencia vigente en la vista. ·
  (US-1, `14-promedios-de-liga` RF-1)
- **RF-7**: La leyenda de cada eje del mapa DEBE indicar la **dirección en pantalla** del mejor
  rendimiento: `→` o `←` en el eje horizontal, `↑` o `↓` en el vertical. · (US-3, C-10 CA)
- **RF-8**: El orden del ranking NO DEBE romperse cuando una métrica vale `null`: los nulos van al
  final. · (`12-nulos-orden-color-dnp` RF-1) · Hoy el orden por OER levantaría `TypeError`.

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Cambio | Nuevo? |
|---|---|---|---|
| (ninguna tabla) | — | Sin cambio de esquema: `pts` y `opp_pts` ya están en `team_game_stats` | No |
| `GET /api/league` | existente | **Campos nuevos** por equipo: `wins`, `losses`, `table_points`, `pts_for`, `pts_against`. El filtro `?competition=` ya existía y los alcanza | Campos nuevos |

> `pts` (promedio de puntos por partido) se conserva y **no** debe confundirse con `pts_for`
> (total anotado). Son columnas distintas de la vista.

## 6. Estados de UI

| Vista / Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Tabla general (nueva) | sin cambio | sin partidos importados → no se renderiza | sin cambio | sin cambio | filas ordenadas por puntos: equipo, PJ, PG, PP, Pts, PF, PC |
| Tabla de ranking (existente) | sin cambio | sin cambio | sin cambio | sin cambio | sin cambios, salvo el orden null-safe |
| Mapa de liga | sin cambio | sin cambio | sin cambio | sin cambio | leyendas de eje con la flecha de dirección correcta |

**Copy nuevo**: `Tabla general`, `PJ`, `PG`, `PP`, `Pts`, `PF`, `PC`. Se agregan a
`docs/frontend.md` al cerrar.

## 7. Criterios de aceptación

- **CA-1**: Given la vista Liga, When se abre, Then muestra una tabla general con las columnas PJ, PG,
  PP, Pts, PF y PC.
- **CA-2**: Given un equipo con 2 partidos ganados y 1 perdido, When se ve su fila, Then muestra
  `PJ 3`, `PG 2`, `PP 1` y `Pts 5` (2×2 + 1×1).
- **CA-3**: Given la tabla general, When se abre sin tocar nada, Then está ordenada por puntos de mayor
  a menor.
- **CA-4**: Given cualquier fila, When se compara `PF` y `PC` con la suma del game log de ese equipo,
  Then coinciden.
- **CA-5**: Given cualquier fila, When se suman `PG` y `PP`, Then el resultado es igual a `PJ`.
- **CA-6**: Given el filtro de competencia, When se cambia, Then la tabla general se recalcula sobre
  esa competencia.
- **CA-7**: Given el mapa con el preset de Eficiencia, When se lee la leyenda del eje horizontal,
  Then indica con una flecha horizontal hacia qué lado está el mejor rendimiento.
- **CA-8**: Given el preset de Rebotes, When se leen ambas leyendas, Then cada flecha coincide con la
  posición real en pantalla del mejor rendimiento (verificable comparando con la posición del equipo
  líder de esa métrica).
- **CA-9**: Given un ranking en el que alguna métrica es `null`, When se ordena por esa columna,
  Then no se produce ningún error y los nulos quedan al final.
- **CA-10**: Given el recorrido de la vista Liga, When se observa la consola, Then no hay errores JS
  nuevos.

## 8. Fuera de alcance

- **Criterios de desempate del campeonato** (diferencia de puntos, resultado head-to-head). C-09 pide
  las columnas; la reglamentación de desempates es del organizador y no está en `docs/`.
- **Partidos no importados**: la tabla refleja lo que hay en la base, no el fixture completo.
- **Puntos de tabla configurables** (algunos torneos usan otro esquema). C-09 fija 2/1.
- **Rediseñar los presets del mapa** más allá de las leyendas (RF-7).

## 9. Ambigüedades

- **[RESUELTA] ¿Qué defecto concreto tiene el eje de rebote (C-10)?** El texto pide "invertir la
  flecha", pero se verificó en navegador que los ejes ya ubican lo mejor donde la leyenda dice.
  → **Decisión: el defecto es la ambigüedad del símbolo `↑`, y se corrige aplicando la regla del CA a
  todos los ejes**: la flecha indica la **dirección en pantalla** del mejor rendimiento (`→`/`←` en el
  horizontal, `↑`/`↓` en el vertical). *Justificación*: es lo que el CA pide literalmente, y hoy un
  eje horizontal rotulado `↑` no lo cumple. Se aplica a los tres presets, no solo al de rebote: dejar
  los otros con la convención vieja mantendría la ambigüedad que causó el reporte.

- **[RESUELTA] ¿Un empate cuenta como ganado o perdido?** → **No se contempla**: el baloncesto FIBA no
  admite empates (siempre hay prórroga). Si apareciera un registro con marcador igual, se cuenta como
  derrota para no inflar la tabla. Registrado por completitud.

- **[RESUELTA] ¿`PF`/`PC` son totales o promedios?** → **Totales**, como es habitual en una tabla de
  posiciones. *Justificación*: C-09 dice "columna de puntos anotados y puntos recibidos" dentro de una
  tabla de posiciones clásica, donde esas columnas siempre son acumuladas. El promedio por partido ya
  existe como `pts` en la tabla de ranking.
