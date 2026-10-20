# Progress — F-06: Quintetos y ON/OFF ampliados

> **Estado:** 🔶 Tabla completa de quintetos y combinaciones de 3/4, ON/OFF de todo el plantel, cierres por quinteto y tarjetas en 7 categorías; faltan la vista de detalle con los tres bloques temáticos y la exportación del bloque de tarjetas
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
- [x] RF-13 · Récord V-D y % de victorias por quinteto en partidos cerrados (`lineups.clutch_lineup_bundles`, mínimo de posesiones del tramo configurable)
- [x] RF-14 · Diferencial propio del tramo (PF, PC, Dif) y conjunto estándar del cierre en la tabla `team_clutch_lineups`
- [x] RF-15 · Badge en partidos contados (`high_games` = 3): con menos, muestra baja, fuera de las tarjetas; Net ajustado con K = 25
- [x] RF-16 · Tarjetas en 7 categorías: Impacto, Tiro, Rebote, Cuidado del balón, Ritmo, Cierres y Volumen (el spec nombra Versatilidad; se implementó Volumen, que es lo que pide la especificación del cliente: minutos y posesiones)
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
| Cierres por quinteto | ✅ | LBO: 3 quintetos con cierre; Σ puntos = 17 = los del equipo en cierres (`/api/clutch`); ninguno cuenta más cierres que el equipo; récord y % coherentes |
| Ids consistentes | ✅ | Los ids de la tabla de cierres son un subconjunto de los de la tabla completa y los nombres coinciden |

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
- **Arreglo de paso (cierres):** `_ids_for` ordenaba los nombres del quinteto alfabéticamente y la tabla completa por id, así que el mismo quinteto se mostraba con distinto orden en cada tabla; ahora ambas usan el orden por id.
- **Segundos del cierre:** un tramo de quinteto puede empezar antes del cierre; los segundos se reparten en proporción a los eventos del tramo que caen dentro de la ventana (aproximación, el pbp no da el reloj por evento dentro del tramo).
- **Tipo de entidad:** la tabla de cierres se registra como `lineup` (mismas métricas del catálogo) y mide la muestra como `clutch_lineup`.

## Docs actualizados
- ✅ `docs/api.md` · ✅ `docs/architecture.md` · ✅ `docs/frontend.md`

## Deuda / TODO
- Vista de detalle de un quinteto (RF-2) y enlace desde las tarjetas y las filas (RF-8, RF-18).
- Exportación del bloque de tarjetas (RF-19).
- Rendimiento: la primera carga de los quintetos tarda 7–12 s con 13 partidos.
- La categoría Cierres de las tarjetas queda vacía con el seed: ningún quinteto llega a 3 cierres contados (es el comportamiento de RF-15, pero no se pudo verificar con datos reales).
- `t()` para el copy (F-21).
