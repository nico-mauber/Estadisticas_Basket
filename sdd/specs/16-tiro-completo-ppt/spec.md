# Spec — Feature 16: detalle de tiro completo y PPT

> **Requisitos C-03 y C-07** (`Smart-Basket Especificacion v2.docx` §1, P1). Corte:
> `sdd/ROADMAP-bloque-C.md` §4 — agrupados por compartir la definición de PPT y la sección Tiro.

## 1. Objetivo
Que el mapa de tiro hable en puntos por tiro en vez de en un indicador mal etiquetado, y que la
sección de Tiro muestre intentos y convertidos de las tres categorías junto a los cuatro PPT.

## 2. Fuentes (trazabilidad)

**C-03 (P1):**
- *"En cada zona del mapa mostrar: % de acierto, eFG% de la zona y PPT (puntos por tiro)."*
- *"Eliminar el indicador P/F de las etiquetas por zona y del encabezado."*
- *"Aplica al mapa de tiro de equipo y al shot chart por zonas de jugador."*
- CA: *"Ninguna etiqueta del mapa de tiro muestra 'P/F'; todas muestran PPT."*

**C-07 (P1):**
- *"Agregar T2i, T2c, T3i, T3c, TLi y TLc, en promedio por partido y en totales de temporada."*
- *"Agregar puntos por tiro (PPT) general, de 2, de 3 y de tiros libres."*
- CA: *"La sección Tiro muestra intentos y convertidos de las tres categorías más los cuatro valores de PPT."*

**Docs:**
- `docs/metrics.md` §Eficiencia de tiro — **`PPT = PTS / FGA`** (puntos por tiro intentado). Ya definida.
- `docs/api.md` — `GET /api/shots/<team_code>` y `GET /api/shots/<team_code>/<player_name>`:
  `zones{}` con `pct`/`pf` por zona y `summary{global_pf, efg_pct, ppp, games}`.
- `docs/frontend.md` §Shot chart — modos de 11 y 3 zonas.

**Código (estado verificado sobre el repo):**
- `backend/app.py` `_zones_from_shots` — `z["pf"] = made × ZONE_POINTS[k] / attempts`. Eso **ya es
  PPT** (puntos de la zona ÷ intentos de la zona): la fórmula es correcta, la etiqueta no.
  No calcula `efg` por zona.
- `backend/app.py` — `summary.global_pf = total_pts / total_fga`: también PPT, mal etiquetado.
- `frontend/js/app.js` `_scLbl` — la etiqueta de zona pinta `share%`, `P/F {pf}` y `fg%`.
- `frontend/js/app.js` `_scBadge` — el encabezado muestra dos cajas: `P/F` y `eFG%`.
- `frontend/js/app.js` `_scBoxFill` — el color de la zona se elige por umbrales sobre `pf`.
- `frontend/js/app.js` — card "Tiro" del perfil de jugador: `FG2%`, `FG3%`, `FT%`, `Uso 2P`, `Uso 3P`.
  **No muestra intentos ni convertidos, ni ningún PPT desglosado.**
- `backend/stats_engine.py` `calc_player_stats` / `calc_team_stats` — ya devuelven `fgm2`/`fga2`,
  `fgm3`/`fga3`, `ftm`/`fta` crudos, y `pps` (que es PPT general). **Los datos ya están**: falta
  exponer los desgloses de PPT y mostrarlos.

## 3. Historias de usuario
- **US-1**: Como entrenador, quiero leer cada zona del mapa en puntos por tiro, para comparar zonas de
  2 y de 3 en la misma unidad.
- **US-2**: Como analista, quiero ver el eFG% de cada zona además del porcentaje de acierto, para
  distinguir una zona de triples eficiente de una de dobles con el mismo porcentaje.
- **US-3**: Como entrenador, quiero ver cuántos tiros de cada tipo se intentan y se convierten, en
  promedio y en total de temporada, para dimensionar el volumen además de la eficacia.
- **US-4**: Como analista, quiero el PPT abierto por tipo de tiro, para saber de dónde salen los
  puntos más baratos.

## 4. Requisitos funcionales

- **RF-1**: Cada zona del mapa de tiro DEBE mostrar **% de acierto**, **eFG% de la zona** y **PPT**. ·
  (US-1, US-2, C-03)
- **RF-2**: La etiqueta `P/F` NO DEBE aparecer en ninguna parte del mapa: ni en las etiquetas por zona
  ni en el encabezado. · (US-1, C-03 CA)
- **RF-3**: Lo anterior DEBE aplicar tanto al mapa de tiro de **equipo** como al shot chart por zonas
  de **jugador**, y en los dos modos de render (11 zonas y 3 zonas). · (C-03)
- **RF-4**: El eFG% por zona DEBE calcularse como `(convertidos × factor) / intentos`, con factor
  `1.0` en zonas de 2 puntos y `1.5` en zonas de 3. · (US-2, `docs/metrics.md` §eFG%) · Es la fórmula
  `(FGM + 0.5 × 3PM) / FGA` aplicada a una zona de un solo valor de puntos.
- **RF-5**: La sección Tiro DEBE mostrar **T2i, T2c, T3i, T3c, TLi y TLc**, en **promedio por partido**
  y en **totales de temporada**. · (US-3, C-07)
- **RF-6**: La sección Tiro DEBE mostrar **PPT general, de 2, de 3 y de tiros libres**. · (US-4, C-07)
  Fórmulas:
  ```
  PPT general = PTS_de_campo / FGA        (docs/metrics.md: PPT = PTS / FGA)
  PPT de 2    = (2 × T2c) / T2i
  PPT de 3    = (3 × T3c) / T3i
  PPT de TL   = TLc / TLi
  ```
- **RF-7**: Todo valor de RF-5 y RF-6 DEBE respetar la regla de nulos: `null` con denominador 0, nunca
  `0`. · (`12-nulos-orden-color-dnp` RF-4)
- **RF-8**: RF-5 y RF-6 DEBEN aplicar a la sección Tiro de **equipo** y de **jugador**. · (C-07)

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Cambio | Nuevo? |
|---|---|---|---|
| (ninguna tabla) | — | Sin cambio de esquema. Todo se deriva de `fgm2/fga2`, `fgm3/fga3`, `ftm/fta` ya persistidos | No |
| `GET /api/shots/<team_code>` y `.../<player_name>` | existentes | **Cambio de contrato:** cada zona suma `efg`; `zones[].pf` se renombra a `zones[].ppt` y `summary.global_pf` a `summary.ppt` | Cambio de contrato — a `docs/api.md` al cerrar |
| `GET /api/team/<code>`, `GET /api/player/<team>/<name>` | existentes | **Campos nuevos**: `ppt_2`, `ppt_3`, `ppt_ft` (el general ya existe como `pps`). Los totales de temporada se derivan en el frontend de los promedios y el número de partidos, o se agregan como `totals` — lo fija el Paso 2 | Campos nuevos |

## 6. Estados de UI

| Vista / Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Mapa de tiro (equipo y jugador) | sin cambio | sin cambio (zona sin intentos no se dibuja) | sin cambio | sin cambio | cada zona: `%` de acierto, `eFG%` y `PPT`. Encabezado: `PPT` y `eFG%` |
| Card "Tiro" (equipo y jugador) | sin cambio | sin cambio | sin cambio | sin cambio | T2i/T2c, T3i/T3c, TLi/TLc en promedio y total; PPT general, de 2, de 3 y de TL |

**Copy nuevo**: `PPT`, `T2i`, `T2c`, `T3i`, `T3c`, `TLi`, `TLc`, `PPT 2`, `PPT 3`, `PPT TL` —
literales del documento del cliente. Se agregan a `docs/frontend.md` al cerrar.

## 7. Criterios de aceptación

- **CA-1**: Given el mapa de tiro de un equipo, When se observa cualquier etiqueta de zona, Then
  muestra `%` de acierto, `eFG%` y `PPT`, y **no** muestra `P/F`.
- **CA-2**: Given el encabezado del mapa, When se observa, Then la caja que decía `P/F` dice `PPT`.
- **CA-3**: Given el shot chart de un jugador en modo 3 zonas, When se observa, Then cumple CA-1 y CA-2.
- **CA-4**: Given una zona de triples con 4 de 10, When se calcula su eFG%, Then vale `60.0%`
  (`4 × 1.5 ÷ 10`) y su PPT vale `1.20` (`4 × 3 ÷ 10`).
- **CA-5**: Given una zona de dobles con 4 de 10, When se calcula su eFG%, Then vale `40.0%` — igual
  al porcentaje de acierto, porque en zonas de 2 el eFG% coincide con el FG%.
- **CA-6**: Given la sección Tiro de un jugador, When se observa, Then muestra T2i, T2c, T3i, T3c, TLi
  y TLc en promedio por partido **y** en total de temporada.
- **CA-7**: Given esa misma sección, When se observa, Then muestra los cuatro PPT (general, 2, 3, TL).
- **CA-8**: Given un jugador que no intentó ningún triple en la temporada, When se ve su `PPT 3`,
  Then muestra `"—"`, no `0.00`.
- **CA-9**: Given un jugador y un partido concretos, When se calcula su `PPT 2` a mano
  (`2 × T2c ÷ T2i`), Then coincide con lo que muestra la app.
- **CA-10**: Given el recorrido de Equipo y Jugador, When se observa la consola, Then no hay errores
  JS nuevos.

## 8. Fuera de alcance

- **Los umbrales de color del mapa** (`_scBoxFill`): hoy colorean por el valor que se renombra a PPT.
  Como la fórmula no cambia, los colores quedan idénticos. Recalibrarlos es otra discusión.
- **Agregar zonas nuevas** o cambiar la clasificación de las 11 existentes.
- **F-06** (las mismas métricas de tiro en lineups y ON/OFF). Si el serializador de esta feature queda
  factorizado, F-06 lo reusa — pero es Bloque F.
- **Percentiles y umbrales de muestra** (T-01/T-02): una zona con 2 intentos mostrará un PPT sin
  ninguna advertencia.

## 9. Ambigüedades

- **[RESUELTA] ¿`P/F` era una métrica distinta de PPT?** → **No: es la misma fórmula mal etiquetada.**
  `pf = convertidos × puntos_de_la_zona / intentos` es exactamente puntos por tiro intentado.
  *Consecuencia*: C-03 es un renombre más el agregado de `eFG%` por zona, no un recálculo. Los valores
  que el usuario ve hoy no cambian de número, solo de nombre.

- **[RESUELTA] ¿`PPT general` incluye los tiros libres?** → **No.** *Justificación*:
  `docs/metrics.md` define `PPT = PTS / FGA` sobre tiros de campo, y C-07 pide el PPT de tiros libres
  como un valor **aparte**. Incluirlos en el general duplicaría el aporte de la línea.

- **[RESUELTA] ¿Los totales de temporada se calculan en el backend o en el frontend?** → **En el
  backend**, junto a los promedios. *Justificación*: Constitución 4 — las métricas se derivan en
  `stats_engine.py`, no en la vista. Derivar el total como `promedio × partidos` en el frontend
  arrastraría el error de redondeo del promedio.
