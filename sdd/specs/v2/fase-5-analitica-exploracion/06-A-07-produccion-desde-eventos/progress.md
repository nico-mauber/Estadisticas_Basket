# Progress — A-07: Producción desde eventos

> **Estado:** 🔶 Implementado para equipo y jugador (pestaña Eventos, `GET /api/events-production`). Faltan la entidad `chain` de T-05, la tabla `events_production`, las fichas de T-01 y el vínculo de respaldo.
> **Fecha:** 2026-11-05

## Qué se hizo
- `backend/events_production.py` y `GET /api/events-production`: cinco bloques con la consecuencia en puntos de cada evento, cuadre contra el play-by-play y control de `pts_from_tov` del box.
- `components/events-panel.js` y la pestaña **Eventos** en Equipo y en Jugador. `sw.js` v61.

## Estado de CA
`a07_sim.py` 33/33 y `a07_browser.py` 40/40 (1280 y 360 px), con el equipo ALB de la base de ejemplo.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (propuesto) | ✅ | resultado y puntos de cada evento, no solo la cantidad |
| CA-2, CA-3 | ✅ | doble + triple + 2+1 = vinculadas; vinculadas + sin vínculo + incompletas = pbp (33 + 5 + 0 = 38); puntos y promedio recalculados |
| CA-4 | ✅ | rebotes ofensivos, puntos, conversión y segundas oportunidades iguales a A-04 |
| CA-5 | ✅ | contraataque ≤ rebotes y anotación ≤ contraataque; rebotes defensivos = posesiones con ese origen en A-02 |
| CA-6 | ✅ | robos = posesiones con origen robo de A-02; 14 vinculados + 1 sin vínculo = 15 del pbp |
| CA-7 | ✅ | categorías suman las pérdidas (24 = 24 del pbp); costo y % castigadas recalculados |
| CA-8 | ✅ | jugadores + eventos de equipo = equipo en cada bloque |
| CA-9 | ✅ | `last=1` usa un partido |
| CA-10 | ✅ | jugador sin robos: conteo 0 y tasas «—» con razón |
| CA-11 | ✅ | badge por bloque con los eventos como unidad |
| CA-12, CA-13 | ⬜ | ficha T-01 por tasa y entidad `chain` de T-05 |
| CA-14 | ⬜ | tabla `events_production` y su exportación |
| CA-15 | ⬜ | no hay vínculo de respaldo: `link_fallback` es 0 |
| CA-16 | 🔶 | control con `pts_from_tov` implementado; en la base de ejemplo no hay diferencias |
| CA-17 | ✅ | 0,13 s en frío y 0,00 s en caliente |

## Desviaciones
- Los robos se identifican por el origen `robo` de la posesión (A-02), no por el evento `steal`; un robo seguido de tiempo muerto queda como robo sin vínculo.
- Los filtros de nivel evento de T-03 no se aplican.
- Sin tabla, entidad `chain` ni ranking.
- Copy sin `t()` (F-21).
