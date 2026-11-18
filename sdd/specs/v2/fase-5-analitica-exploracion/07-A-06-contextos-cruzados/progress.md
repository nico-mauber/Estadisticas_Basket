# Progress — A-06: Motor de contextos cruzados

> **Estado:** ✅ Implementado en Explorar › Contextos (`GET /api/cross`) con la tabla `cross_cells` de T-06. Detalle de celda con el conjunto de T-05 completo (`cross_cell`), filtros de nivel evento y posesión y cuadre contra Cierres (2026-11-17).
> **Fecha:** 2026-11-04

## Qué se hizo
- `backend/cross_context.py` (11 dimensiones, 8 métricas, matriz, totales, cuadre, percentiles, seis cruces) y `GET /api/cross`.
- `components/cross-panel.js` y la pestaña **Contextos** de Explorar. `sw.js` v60.

## Estado de CA
`a06_sim.py` 47/47 y `a06_browser.py` 38/38 (1280 y 360 px), con el equipo ALB de la base de ejemplo.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | los 55 pares de dimensiones, en ataque y en defensa, cierran: Σ celdas = total, y el total es el de posesiones de A-02 (160); puntos de las celdas = puntos del total |
| CA-2 | ✅ | los pares con «jugador en cancha» cierran contra la multiplicidad informada |
| CA-3 | ✅ | totales de fila y de columna = suma de sus celdas |
| CA-4, CA-5 | ✅ | celda bajo el mínimo: gris, `ranked: false`, sin percentil; el badge usa las posesiones de la celda |
| CA-6 | ✅ | percentil de una celda verificado a mano con las celdas de los demás equipos |
| CA-7 | ✅ | quinteto, jugador, finalizador y rival → percentil dentro de la matriz |
| CA-8 | ✅ | PPP concedido más bajo y TO% más bajo, los más verdes |
| CA-9 | ✅ | celda vacía «—» con razón; OR% con oportunidad `no_aplica` |
| CA-10 | ✅ | oportunidad × cuarto cierra y la fila «Segunda» = `second_chances` de A-04 |
| CA-11 | ✅ | `excluded.incomplete` informa las incompletas |
| CA-12, CA-13 | ✅ | los seis cruces cierran; cambiar métrica, ejes o cruce no recarga la pantalla |
| CA-14 | ✅ | `last=1` usa un partido; la dirección reproduce la vista |
| CA-15 | ✅ | `GET /api/metrics/cross_cell`: mismas claves que `/api/metrics/team` (sin huecos); posesiones y puntos = la celda; ritmo/DER/Net `no_aplica`; desplegable "Conjunto estándar de la celda" en el detalle (`a06q_sim.py`, `a06q_browser.py`) |
| CA-16 | ✅ | CSV de la matriz con filtros, lado, dimensiones, métrica y base de color; tabla `cross_cells` (2026-11-16) con el mismo contexto |
| CA-17 | ✅ | ALB: los partidos con posesiones «Cierre» = los partidos calificados de `/api/clutch/ALB` (2849337) (`a06q_sim.py`) |
| CA-18 | ✅ | 0,34 s en frío y 0,02 s en caliente con 13 partidos |

## Desviaciones
- Los filtros de nivel evento (cuarto, marcador, con/sin jugador, dimensiones de posesión) se informan como no aplicados; solo se aplican los de nivel partido. Elegir el cuarto como dimensión da ese corte.
- Sin la tabla T-06 `cross_cells`.
- El cruce 4 usa «finalizador» como dimensión (propuesta del spec), no «jugador en cancha».
- Copy sin `t()` (F-21).

## Tabla `cross_cells` (2026-11-16)
- T-B7 ✅ `GET /api/table/cross_cells`: una fila por celda con datos; `a06_table.py` 18/18 (filas = celdas con datos, Σ = cuadre de la matriz, métricas por celda iguales, también con oportunidades y con jugador en cancha superpuesto). En la UI, "Ver todas las celdas como tabla" debajo de la matriz, exportable; Chromium 1280/360 px e inglés (`tables_browser.py`), con los textos del panel traducidos.
- Desvío: las columnas son las métricas del cruce, no el conjunto estándar de T-05 (las celdas solo acumulan tiros, libres, pérdidas y rebotes).

## Detalle de celda, filtros y CA-17 (2026-11-17)
- Entidad `cross_cell` (id `equipo|dim_x|x|dim_y|y`, `side`, `limit`): conjunto estándar de las posesiones u oportunidades de la celda (cajas del motor A-01; por oportunidad, con los rebotes por estructura de A-04); un solo lado; sin población. En pantalla, desplegable "Conjunto estándar de la celda" bajo el detalle.
- La matriz y la tabla `cross_cells` aplican el contexto completo de T-03: cuarto, marcador, con/sin jugador (estado al inicio de la posesión), origen y tipo; con oportunidad, tramo o reloj la unidad pasa a oportunidades.
- Evidencia: `a06q_sim.py` 17/17 (quarter=4: 43 posesiones y cuadre; origin=robo = 14 = posesiones del equipo con el filtro; chance=segunda en oportunidades; celda con n y puntos iguales a la matriz; celdas «Otros» suman la fila; CA-17). `a06q_browser.py` 12/12 (Chromium 1280/360 px e inglés).

