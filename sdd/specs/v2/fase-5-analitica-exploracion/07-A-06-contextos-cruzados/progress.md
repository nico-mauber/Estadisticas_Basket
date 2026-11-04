# Progress — A-06: Motor de contextos cruzados

> **Estado:** 🔶 Implementado en Explorar › Contextos (`GET /api/cross`). Faltan la tabla `cross_cells` con el conjunto estándar, el detalle de celda con el conjunto de T-05 completo, los filtros de nivel evento y la prueba del cuadre contra el cierre real de Cierres.
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
| CA-15 | 🔶 | el detalle muestra las ocho métricas de A-06 y los conteos, no el conjunto estándar de T-05 completo |
| CA-16 | 🔶 | CSV de la matriz con filtros, lado, dimensiones, métrica y base de color; sin la tabla de celdas |
| CA-17 | 🔶 | clutch usa la definición de Cierres (ventana y margen); no se comparó partido a partido |
| CA-18 | ✅ | 0,34 s en frío y 0,02 s en caliente con 13 partidos |

## Desviaciones
- Los filtros de nivel evento (cuarto, marcador, con/sin jugador, dimensiones de posesión) se informan como no aplicados; solo se aplican los de nivel partido. Elegir el cuarto como dimensión da ese corte.
- Sin la tabla T-06 `cross_cells`.
- El cruce 4 usa «finalizador» como dimensión (propuesta del spec), no «jugador en cancha».
- Copy sin `t()` (F-21).
