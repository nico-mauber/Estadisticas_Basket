# Progress — F-06: Quintetos y ON/OFF ampliados

> **Estado:** 🔶 Primer corte: tabla completa de quintetos y combinaciones de 3/4, ON/OFF de todo el plantel y tarjetas de mejores quintetos; faltan los cierres por quinteto, la vista de detalle con los tres bloques temáticos y la exportación del bloque de tarjetas
> **Fecha:** 2026-10-20

## Estado de tareas
- [🔶] RF-1 · Conjunto estándar completo por quinteto, combinación y estado ON/OFF (ya lo daban `lineups.all_lineups` / `all_onoff_bundles`; ahora se expone en tablas)
- [ ] RF-2 · Vista de detalle con los tres bloques temáticos (Ataque / Defensa / Avanzado)
- [x] RF-3 · Tabla `team_lineups` con TODOS los quintetos, sin truncar
- [x] RF-4 · Orden, selector de columnas, totales, promedio, percentiles y exportación (T-06)
- [x] RF-5 · Badge de quinteto (`sample.lineup.*`) y OER/DER/Net ajustados con banda (`regression.lineup.k`)
- [x] RF-6 · La muestra baja se muestra en gris y se ordena al final (regla aplicada en `data-table.js` sobre `sample.ranked`)
- [x] RF-7 · Ficha T-01 por métrica (percentil contra los quintetos de la competencia en el mismo contexto)
- [🔶] RF-8 · Cada fila trae `link = lineup:<id>`; falta la vista de detalle a la que enlazar
- [x] RF-9 · Combinaciones de 3 y 4 jugadores (`?size=`)
- [x] RF-10 · ON/OFF de todo el plantel con partición exhaustiva (ON + OFF = total del equipo, verificado)
- [x] RF-11 · Badge de ON/OFF (el menor de los dos estados) y ajuste por estado
- [x] RF-12 · Tabla `team_onoff` con selector ON / OFF / Diferencia, ordenable y exportable
- [ ] RF-13 … RF-15 · Cierres por quinteto (récord V-D, % de victorias, diferencial del tramo)
- [🔶] RF-16 · Tarjetas de los 3 mejores en 5 categorías (Impacto, Tiro, Rebote, Cuidado del balón, Ritmo); faltan Cierres y Versatilidad
- [x] RF-17 · Solo entran los quintetos sobre el umbral, ordenados por el valor ajustado donde lo hay
- [🔶] RF-18 · Cada tarjeta trae nombres, valor, ajustado con banda, percentil y badge; falta el enlace a la fila
- [ ] RF-19 · Exportación del bloque de tarjetas
- [x] RF-20 · Contexto de nivel partido de T-03 y base de T-04 en tablas y tarjetas
- [x] RF-21 · Partidos sin pbp o sin 5 titulares excluidos (los descarta `lineups`)
- [x] RF-22 · Ids enteros de jugador en el id del quinteto; los endpoints legado siguen intactos
- [x] RF-23 · Diferencia nula con razón cuando un lado es nulo (nunca 0)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| Tabla completa | ✅ | LBO: 14 quintetos, Σ minutos = 45 (5 × 9 min de partido), Σ posesiones = 82,7 = las del equipo |
| Combinaciones 3/4 | ✅ | `size=3` → 66 combinaciones; `size=4` → 52; `size=7` → 400 |
| Muestra y ajuste | ✅ | Badge en posesiones con `min` 15 / `high` 40; `adj` de Net con K = 25 y banda |
| Muestra baja al final | ✅ | Chromium: al ordenar por Net, las filas grises quedan después |
| ON/OFF exhaustivo | ✅ | Para cada jugador, ON + OFF = 79 pts = total del equipo |
| Diferencia | ✅ | `view=diff` = ON − OFF clave por clave; nulos con razón `sin_datos` |
| Tarjetas | ✅ | 3 por categoría como máximo, solo sobre el umbral (con el seed, 2); cambiar de categoría no hace requests |
| Contexto y base | ✅ | `venue=local` aplicado; `quarter` informado en `ignored`; `base=por100` aplicada |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅
- Consola del navegador sin errores JS: ✅ (1280 y 360 px)
- Verificación: `f06_sim.py` 28/28, `f06_browser.py` 28/28, regresión completa en verde

## Desviaciones respecto a docs/ o plan
- **Sin vista de detalle:** los tres bloques temáticos de RF-2 no existen; el detalle de una combinación puntual sigue siendo el bloque anterior ("Analizar combinación").
- **Tarjetas:** 5 categorías de las 7 (faltan Cierres, que necesita RF-13, y Versatilidad).
- **Vista Diferencia:** se calcula en el builder sobre los valores ya escalados (`TableRow.extra["precomputed"]`), no con un bundle; la diferencia ajustada por estado queda pendiente.
- **Orden de RF-6:** la regla vive en `data-table.js` (presentación), no en el backend; las columnas de tamaño de muestra (partidos, minutos, posesiones) ordenan sin separar, porque ahí la muestra es el dato.
- **Arreglo de paso:** `meta.entity` de las tablas de quinteto y ON/OFF decía "Liga"; ahora nombra al equipo (afecta el nombre del archivo exportado).

## Docs actualizados
- ✅ `docs/api.md` · ✅ `docs/architecture.md` · ✅ `docs/frontend.md`

## Deuda / TODO
- Cierres por quinteto (RF-13 … RF-15) con `sample.clutch_lineup.*` y `regression.clutch_lineup.k`.
- Vista de detalle de un quinteto (RF-2) y enlace desde las tarjetas y las filas (RF-8, RF-18).
- Exportación del bloque de tarjetas (RF-19).
- Rendimiento: la primera carga de los quintetos tarda ~7 s con 13 partidos.
- `t()` para el copy (F-21).
