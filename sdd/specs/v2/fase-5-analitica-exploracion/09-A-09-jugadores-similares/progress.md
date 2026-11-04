# Progress — A-09: Jugadores similares

> **Estado:** 🔶 Implementado en Jugador (pestaña Similares, `GET /api/similar/<id>`). Faltan la pestaña y la acción en Explorar, la exportación (T-06), el bloque "emparejamiento propuesto por perfil" de F-03 y el protocolo de validación con alguien del ambiente.
> **Fecha:** 2026-11-04

## Qué se hizo
- `backend/similar.py` (perfil de nueve dimensiones, z-score dentro de la competencia, distancia euclidiana, similitud `100·exp(−d)`) y `GET /api/similar/<player_id>`; `similar.top_n` activa en Configuración.
- `components/similar-panel.js` y la pestaña **Similares** de Jugador (filtros de posición y minutos, método explicado, valores de las nueve dimensiones). `sw.js` v58.

## Estado de CA
`a09_sim.py` 21/21 y `a09_browser.py` 19/19 (1280 y 360 px).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ⬜ | "reconocibles por alguien del ambiente": falta el protocolo de validación manual (RF-17) |
| CA-2 | ✅ | exactamente `similar.top_n` resultados distintos y sin el de referencia |
| CA-3 | ✅ | distancia del primero recalculada a mano con las funciones del módulo (0,74) |
| CA-4 | ✅ | posición G → solo G; "misma" usa la de la referencia |
| CA-5 | ✅ | cada resultado compara al menos 6 dimensiones (nunca 0 ni la media) |
| CA-6 | ✅ | un mínimo menor al de la población se sube; nadie bajo el mínimo |
| CA-7 | ✅ | la distancia A→B es la de B→A |
| CA-8 | 🔶 | el reparto de tiro usa pintura, media y triples del conjunto estándar, no las 11 zonas de C-03 |
| CA-9 | ✅ | pestaña Similares de Jugador |
| CA-10 | ⬜ | exportación |
| CA-11 | ✅ | jugador inexistente 404; competencia inexistente, posición inválida, `top_n` fuera de rango y `all` → 400 |
| CA-12 | ⬜ | incremento de F-03 |
| CA-13 | ✅ | `similar.top_n` cambia sin reiniciar |
| CA-14 | ✅ | 360 px sin scroll horizontal de página (la tabla se desplaza dentro de su caja) |
| CA-15 | ⬜ | no se midió en frío con 74 jugadores |

## Desviaciones
- Reparto por zona con tres componentes (pintura, media distancia, triples) en vez de 11 zonas.
- Sin Explorar, exportación ni el bloque de F-03.
- Copy sin `t()` (F-21).
