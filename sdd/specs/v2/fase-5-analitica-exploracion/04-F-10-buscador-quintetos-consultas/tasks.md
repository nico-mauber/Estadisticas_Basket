# Tasks — F-10: Buscador de quintetos y consultas guardadas

> **ID:** F-10 · **Prioridad:** P2 · **Fase y orden:** 5·04
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y consultas guardadas
- [ ] T-A1 · Agregar el modelo `SavedQuery` (tabla `saved_queries`: `id`, `owner`, `name`, `kind`, `params`, `created_at`, `updated_at`, `UNIQUE(owner, name)`) · `backend/database.py` · cubre RF-10 · Done: `python backend/database.py` crea la tabla y corre una segunda vez sin error (`create_all` idempotente; `.schema saved_queries` muestra la restricción única)
- [ ] T-A2 · Crear `backend/saved_queries.py` con `validate_params(kind, params)` (claves permitidas por tipo, tamaño ≤ 4 KB, normalización a strings, `_saved` reservada) · `backend/saved_queries.py` · cubre RF-10, RF-11 · Done: `validate_params("quintetos", {"zzz": "1"})` lanza el error de parámetros inválidos; con `{"competition": "3", "min.efg_pct": "0.55"}` devuelve el dict normalizado
- [ ] T-A3 · `save_query` (nombre recortado, 1–80, límite de 100 por usuario, `overwrite`, escribe `_saved` con `cache.get_versions()`), `list_queries` (con `stale`), `delete_query` (filtra por `owner`) e `is_stale` · `backend/saved_queries.py` · cubre RF-10, RF-12, RF-13 · Done: `save_query` repetido con el mismo nombre lanza conflicto y con `overwrite=True` actualiza `updated_at`; `delete_query` de una consulta ajena lanza no encontrado
- [ ] T-A4 · Rutas `GET/POST /api/saved-queries` y `DELETE /api/saved-queries/<int:query_id>` (finas, `login_required`, `owner = prefs.current_owner()`) con los errores del plan §9 · `backend/app.py` · cubre RF-10, RF-12 · Done: `curl -b c.txt -X POST …/api/saved-queries -H "Content-Type: application/json" -d '{"name":"t","kind":"quintetos","params":{"competition":"3"}}'` responde 201

### Grupo B — Backend: universo y búsqueda de quintetos
- [ ] T-B1 · `SearchSpec` y `parse_search(args, ctx)` (competencia obligatoria y única, `team`, `include`/`exclude` con `identity.canonical_id`, `min_poss`, `min.*`/`max.*` validados contra el catálogo, `adjusted`) · `backend/lineup_search.py` · cubre RF-1, RF-2, RF-14 · Done: `competition=all` → error "Elegí una competencia."; mismo jugador en `include` y `exclude` → error; `min.zzz=1` → "Métrica inválida: zzz"
- [ ] T-B2 · `universe(comp_id, ctx)`: `all_lineups` por equipo (F-06), `compute_standard`, `adjust_values`, `sample_for`, orden base por id, memoizado con `cache.memo("lineup_search:universe", …)` · `backend/lineup_search.py` · cubre RF-1, RF-5, RF-16, RF-17 · Done: el universo de la competencia del seed trae solo quintetos de 5 jugadores y una segunda llamada es instantánea
- [ ] T-B3 · `search(spec, ctx)`: filtros en orden jugadores → mínimo de posesiones (regla T-02 si es `None`) → rangos (ajustado o crudo; nulo no cumple), conteo de exclusiones por primera causa y orden por defecto (baja al final, Net ajustado desc, id) · `backend/lineup_search.py` · cubre RF-2, RF-3, RF-4, RF-5, RF-7 · Done: con `min_poss` omitido no hay filas de muestra baja y con `min_poss=0` el resultado incluye las de muestra baja al final
- [ ] T-B4 [P] · `describe_filters(spec, ctx)` (etiquetas legibles para `meta.filters`) · `backend/lineup_search.py` · cubre RF-9 · Done: devuelve p. ej. `{"label": "Mínimo de posesiones", "value": "30"}`
- [ ] T-B5 · `table_rows(req)` y `payload_extras(req)` (`info` con `total_lineups`, `matched`, `excluded`, `effective_min_poss`, versiones; `filters`) · `backend/lineup_search.py` · cubre RF-6, RF-8, RF-9 · Done: `info.matched == row_count`

### Grupo C — Backend: registro en T-06
- [ ] T-C1 · Extender `tables.register_table` con `payload_extras` y `default_sort.low_sample_last` (PROPUESTAS, plan §10 D-3) · `backend/tables.py` · cubre RF-4, RF-9 · Done: una tabla sin `payload_extras` sigue devolviendo el payload de T-06 sin cambios
- [ ] T-C2 · `register_table("lineup_search", entity_type="lineup", builder=table_rows, totals_mode="none", avg_mode="population", default_sort=…, payload_extras=…)` · `backend/tables.py`, `backend/lineup_search.py` · cubre RF-6, RF-7, RF-8 · Done: `GET /api/table/lineup_search?competition=<id>` devuelve payload §7.6 con `info`
- [ ] T-C3 [P] · Errores 400/404 del plan §9 en la ruta de tablas (mensajes de la búsqueda) · `backend/tables.py`, `backend/lineup_search.py` · cubre RF-1, RF-2, RF-16 · Done: `…&include=1&exclude=1` → 400; `…&include=999999` → 404 "Jugador no encontrado: 999999"

### Grupo D — Frontend
- [ ] T-D1 · `api.savedQueries`, `api.saveQuery`, `api.deleteQuery` · `frontend/js/api.js` · cubre RF-10, RF-12 · Done: `await api.savedQueries("quintetos")` en consola devuelve la lista
- [ ] T-D2 · `components/lineup-search.js`: barra de competencia/equipo, selectores de jugadores Incluir/Excluir con chips (desde `api.searchPlayers()`), mínimo de posesiones, casilla "Valor ajustado por muestra", rangos base con `data-pct` y "Agregar métrica" · `frontend/js/components/lineup-search.js` · cubre RF-2, RF-3, RF-4, RF-5 · Done: armar una búsqueda en la UI produce la query esperada (visible en la pestaña Red)
- [ ] T-D3 · Resultado: `createDataTable` + `exportMenu` con `lineup_search`, contador "N quintetos de M", aviso de exclusiones y fila → quinteto en S3 · `frontend/js/components/lineup-search.js` · cubre RF-6, RF-9 · Done: el CSV exportado contiene solo las filas mostradas
- [ ] T-D4 · Estado ↔ URL: escribir y restaurar los parámetros en `#/explorar/quintetos?…` · `frontend/js/components/lineup-search.js`, `frontend/js/views/explorar.js` · cubre RF-15 · Done: recargar con la URL reproduce la misma búsqueda
- [ ] T-D5 · `components/saved-queries.js`: lista, "Ejecutar" (banner `stale`), "Eliminar" con confirmación y `saveQueryDialog` (409 → "Reemplazar") · `frontend/js/components/saved-queries.js` · cubre RF-10, RF-12, RF-13, RF-14 · Done: guardar, listar, ejecutar y eliminar una consulta desde la UI
- [ ] T-D6 · Pestañas `quintetos` y `consultas` en S7 y botón "Guardar búsqueda" del buscador de jugadores (serializa y restaura filtros) · `frontend/js/views/explorar.js` · cubre RF-1, RF-10, RF-12 · Done: una búsqueda de jugadores guardada restaura los controles y el mismo conjunto
- [ ] T-D7 [P] · Estados loading/vacío/error/offline y modales con el copy del spec §6 · `frontend/js/components/lineup-search.js`, `frontend/js/components/saved-queries.js` · cubre RF-16 · Done: cortar la red muestra "Sin conexión: la búsqueda de quintetos necesita conexión."
- [ ] T-D8 [P] · Estilos del formulario, chips, lista de consultas y mobile (bloque plegable "Más filtros", tarjetas) · `frontend/css/style.css` · Done: a 360 px no hay scroll horizontal de página
- [ ] T-D9 · Sumar los dos componentes a `STATIC` y subir `CACHE` solo si X-01 no pasó a runtime caching · `frontend/sw.js` · Done: las pestañas cargan con el SW activo tras recargar

### Grupo E — Documentación (cierre)
- [ ] T-E1 · `docs/api.md`: `GET/POST/DELETE /api/saved-queries` y la tabla `lineup_search` con sus parámetros
- [ ] T-E2 · `docs/database.md`: tabla `saved_queries` (columnas y restricción única)
- [ ] T-E3 · `docs/frontend.md`: pestañas Quintetos y Consultas de Explorar, "Guardar búsqueda" del buscador de jugadores y copy nuevo
- [ ] T-E4 · `docs/architecture.md`: módulos `lineup_search.py` y `saved_queries.py`

### Grupo F — Verificación de feature (manual, Constitución 8)
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `python backend/database.py` corre 2 veces seguidas sin error y la tabla `saved_queries` existe con `UNIQUE(owner, name)`
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o navegador (`/api/table/lineup_search`, `GET/POST/DELETE /api/saved-queries`); shape verificado contra el plan §3
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Explorar → Quintetos y Consultas, y el guardado desde Jugadores
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅
- [ ] T-F6 · CA-1: `curl -b c.txt "http://localhost:5000/api/table/lineup_search?competition=<id>&min_poss=30&min.efg_pct=0.5" > a.json`; guardar la consulta con esos params (`POST /api/saved-queries`); recargar y ejecutarla desde la UI (o pedir de nuevo la query guardada) → `b.json`; comparar `rows[].id` en orden, `row_count` y `values` de `a.json` y `b.json` (`diff` o `jq`); repetir tras reiniciar el servidor
- [ ] T-F7 · CA-2: con `min_poss=30` verificar `min(possessions) ≥ 30`; con `min_poss` omitido verificar que ninguna fila trae `sample.level == "baja"`; con `min_poss=5` verificar filas "baja" al final del orden por defecto
- [ ] T-F8 · CA-3: elegir 2 jugadores de un mismo quinteto de `GET /api/table/team_lineups?team=CNF` (F-06) para `include` y uno de otro quinteto para `exclude`; verificar la pertenencia en cada `id` de fila; probar `include` = `exclude` → 400
- [ ] T-F9 · CA-4: `min.efg_pct=0.55`: todo `efg_pct ≥ 0.55`; localizar un quinteto con `efg_pct` nulo (sin tiros de campo) y confirmar que no aparece y que `info.excluded.nulos` lo cuenta
- [ ] T-F10 · CA-5: elegir un quinteto de pocas posesiones con Net crudo alto y ajustado bajo; `min.net_rating=<umbral entre ambos>`: aparece con `adjusted=0` y no con `adjusted=1`
- [ ] T-F11 · CA-6: comparar `pct`/`adj` de un quinteto entre dos búsquedas con filtros distintos y contra `GET /api/table/team_lineups?team=<code>` sin filtros
- [ ] T-F12 · CA-7: pedir la misma búsqueda dos veces y comparar el orden; en la UI ordenar por una columna con nulos en ambos sentidos y confirmar nulos al final
- [ ] T-F13 · CA-8: en el orden por defecto con `min_poss=0` verificar que todas las filas "baja" están después de las "media"/"alta"
- [ ] T-F14 · CA-9: con `table.page_size` en 10 (F-13) verificar "Página 1 de N · <total> filas", `row_count == rows.length` y "Ver todas"
- [ ] T-F15 · CA-10: exportar a CSV un resultado filtrado y ordenado; abrir el archivo y verificar BOM, `;`, coma decimal, filas = mostradas, columnas = visibles y cabecera `# Filtros: …`
- [ ] T-F16 · CA-11: probar con curl nombre vacío (400), nombre duplicado (409) y con `overwrite` (200/201 y `updated_at` nuevo), `kind` inválido (400), clave desconocida (400) y, con otro usuario (segunda sesión con otro `AUTH_USERS`), `GET` (no ve la consulta) y `DELETE` (404)
- [ ] T-F17 · CA-12: eliminar una consulta desde la UI con confirmación y por `curl -X DELETE`; `DELETE` de un id inexistente → 404
- [ ] T-F18 · CA-13: en Explorar → Jugadores aplicar equipo, posición y un rango, guardar como consulta, limpiar, ejecutar desde Consultas y comparar el conjunto (cantidad y nombres)
- [ ] T-F19 · CA-14: guardar una consulta con una competencia y fusionarla con otra (S1 → Competencias, F-11) o usar un id inexistente editando la fila; ejecutar: aviso de competencia inexistente con filtros restaurados y sin 500
- [ ] T-F20 · CA-15: guardar una consulta con `include=<id de una ficha>`, fusionar esa ficha en otra (C-08, `POST /api/identity/merge`) y ejecutar: el filtro sigue al canónico
- [ ] T-F21 · CA-16: guardar una consulta, reprocesar un partido (F-11) y abrir Consultas: la fila marca `stale` y la ejecución muestra el aviso de cambio de datos
- [ ] T-F22 · CA-17: búsqueda con `last=5&venue=local`: verificar `context.applied`, que el resultado difiere de la búsqueda sin contexto, y que la consulta guardada los conserva al reejecutarse
- [ ] T-F23 · CA-18: `curl -w "%{time_total}\n" -o /dev/null -b c.txt "http://localhost:5000/api/table/lineup_search?competition=<id>"` en frío (tras reiniciar) < 10 s y en caliente < 1,5 s; registrar los tiempos en `progress.md`
- [ ] T-F24 · CA-19: `competition=all` → 400 "Elegí una competencia."; competencia sin partidos con pbp → `rows: []` y estado vacío en la UI
- [ ] T-F25 · CA-20: recorrer Explorar → Quintetos y Consultas en viewport < 768 px, sin scroll horizontal ni errores de consola

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-A3, T-B3, T-B5, T-D5, T-F6 |
| CA-2 | T-B3, T-F7 |
| CA-3 | T-B1, T-B3, T-F8 |
| CA-4 | T-B3, T-F9 |
| CA-5 | T-B3, T-F10 |
| CA-6 | T-B5, T-C2, T-F11 |
| CA-7 | T-B3, T-C1, T-F12 |
| CA-8 | T-B3, T-C1, T-F13 |
| CA-9 | T-C2, T-D3, T-F14 |
| CA-10 | T-B4, T-C1, T-D3, T-F15 |
| CA-11 | T-A2, T-A3, T-A4, T-F16 |
| CA-12 | T-A3, T-A4, T-D5, T-F17 |
| CA-13 | T-D6, T-F18 |
| CA-14 | T-B1, T-D5, T-F19 |
| CA-15 | T-B1, T-F20 |
| CA-16 | T-A3, T-D5, T-F21 |
| CA-17 | T-B1, T-B5, T-F22 |
| CA-18 | T-B2, T-F23 |
| CA-19 | T-B1, T-C3, T-D7, T-F24 |
| CA-20 | T-D8, T-F25 |

## Dependencias externas
- Competencia del seed (13 partidos) con play-by-play y, para varios equipos, quintetos suficientes: la búsqueda necesita al menos 2 equipos con partidos en la misma competencia. Para CA-9 y CA-18 (más de una página y tiempos) conviene una competencia mayor (importar partidos adicionales o usar la competencia completa de producción en un entorno de prueba); sin ella se baja `table.page_size` a 10 y se registra la limitación en `progress.md`.
- F-06 cerrado: `lineups.all_lineups` y la tabla `team_lineups`/`GET /api/metrics/lineup` (se usan para contrastar resultados).
- T-02, T-06, T-01 y T-05 cerrados (muestra y regresión, tabla y exportación, población y percentiles, conjunto estándar); C-08 cerrado (`player_id` y `identity.canonical_id`); F-13 cerrado (`prefs.current_owner`, `table.page_size`).
- X-01 cerrado: la sección S7 Explorar y la pestaña `jugadores`.
- Dos usuarios en `AUTH_USERS` (variable de entorno local) para T-F16 (aislamiento por usuario); en modo abierto el propietario es `_open` y esa verificación no aplica.
- Un segundo estado de datos (reprocesar o importar un partido) para T-F21.
