# Progress — F-10: Buscador de quintetos y consultas guardadas

> **Estado:** 🔶 Implementado (buscador de quintetos, consultas guardadas de quintetos y de jugadores, exportación CSV). Faltan algunos detalles de forma listados en Desviaciones.
> **Fecha:** 2026-11-04

## Qué se hizo
- `backend/lineup_search.py` (universo, filtros, orden determinista, tabla T-06 `lineup_search`), `backend/saved_queries.py` y tabla `saved_queries`; rutas `GET/POST /api/saved-queries` y `DELETE /api/saved-queries/<id>`. `tables.register_table` acepta `payload_extras` (suma `info` y filtros a `meta.filters`).
- `components/lineup-search.js`, `components/saved-queries.js`; Explorar con pestañas Jugadores · Quintetos · Consultas, "Guardar búsqueda" también en el buscador de jugadores. `sw.js` v59.

## Estado de CA
`f10_sim.py` 57/57 y `f10_browser.py` 52/52 (1280 y 360 px), con la base de ejemplo (353 quintetos de la Liga de Ascenso).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | misma consulta guardada → mismas filas, orden y valores, también tras vaciar el caché (equivale a reiniciar) y al recargar la dirección |
| CA-2 | ✅ | `min_poss` 30, omitido (sin muestra baja) y 5 (muestra baja al final) |
| CA-3 | ✅ | incluir/excluir; mismo jugador en ambos → 400 |
| CA-4 | ✅ | eFG% ≥ 0,55 y los nulos se cuentan en `info.excluded.nulos` |
| CA-5 | ✅ | ajustado frente a crudo: 47 quintetos aparecen solo con el crudo |
| CA-6 | ✅ | percentil y ajustado idénticos con y sin filtros y contra `team_lineups` |
| CA-7, CA-8 | ✅ | orden y desempate estables, muestra baja al final |
| CA-9 | ✅ | todas las filas en el payload |
| CA-10 | ✅ | CSV con los filtros en la cabecera y las filas mostradas |
| CA-11, CA-12 | ✅ | 400, 409, `overwrite`, privacidad por usuario, borrado |
| CA-13 | ✅ | el buscador de jugadores restaura controles y conjunto |
| CA-14 | 🔶 | competencia inexistente → 400 y aviso en pantalla; no se probó con una competencia borrada después de guardar |
| CA-15 | 🔶 | el filtro sigue la fusión (`canonical_id`); no se probó con una fusión real |
| CA-16 | ✅ | `stale` al cambiar `data_version`; banner al ejecutar |
| CA-17 | ✅ | `last` y contexto globales se guardan con la consulta |
| CA-18 | ✅ | 0,9 s en frío y 0,36 s en caliente (353 quintetos); no se midió con una temporada completa |
| CA-19, CA-20 | ✅ | `all` → 400; 360 px sin scroll horizontal ni errores de consola |

## Desviaciones
- `min_poss` cuenta posesiones totales aunque la tabla se muestre por partido.
- Tocar una fila abre Equipo › Quintetos, no el quinteto puntual (no hay enlace profundo `?lineup=`).
- La consulta eliminada se confirma con el diálogo del navegador.
- Sin `ui.sort` guardado en la consulta (la tabla usa el orden por defecto).
- Copy sin `t()` (F-21).
