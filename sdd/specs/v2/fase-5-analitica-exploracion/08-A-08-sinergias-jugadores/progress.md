# Progress — A-08: Sinergias de jugadores

> **Estado:** 🔶 Implementado (Equipo › Quintetos y Jugador › Impacto, `GET /api/synergy/<team>`). Faltan la tabla `pairs`, la entidad `pair` de T-05 y los rankings de T-01.
> **Fecha:** 2026-11-05

## Qué se hizo
- `backend/synergy.py` y `GET /api/synergy/<team_code>`: matriz de asistencias con cuadre, rankings de triples y de puntos tras asistencia, parejas con ajuste de T-02 y jugadores que potencian a sus compañeros.
- `components/synergy-panel.js`: bloque de sinergias en Equipo › Quintetos y pestaña **Impacto** en Jugador. `sw.js` v62.

## Estado de CA
`a08_sim.py` 27/27 y `a08_browser.py` 30/30 (1280 y 360 px), con el equipo ALB de la base de ejemplo (umbrales de pareja bajados para probar los rankings).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | matriz 33 + sin vínculo 5 + incompletas 0 = 38 asistencias del pbp = 38 del box; totales de fila = totales de columna |
| CA-2 | 🔶 | ningún anotador es el propio asistente; la matriz coincide con las asistencias vinculadas de A-07; no se distingue vínculo oficial de respaldo (no hay vínculo de FIBA guardado) |
| CA-3 | ✅ | `check.games_differing` lista los partidos que difieren del box (ninguno) |
| RF-5, RF-6, RF-7 | ✅ | triples y puntos suman los de la matriz; muestra baja al final |
| RF-8, RF-9, RF-10 | ✅ | una fila por cada pareja que compartió cancha; filas por Net ajustado; rankings solo con muestra suficiente (30 posesiones por defecto) |
| RF-12, RF-13 | ✅ | diferencial con y sin, ponderado por la menor muestra; ordenado por impacto |
| RF-14 | ✅ | Impacto en Jugador |
| RF-11, RF-18 | 🔶 | sin tabla T-06 `pairs`; solo se exporta la matriz |

## Desviaciones
- Sin tabla `pairs` ni entidad `pair` de T-05; las parejas llevan solo OER, DER, Net, TS% y eFG%.
- Las dimensiones de posesión del contexto no se aplican a las parejas (los filtros de evento no entran).
- El estado «B sin A» usa los partidos totales de B como conteo de partidos.
- Copy sin `t()` (F-21).
