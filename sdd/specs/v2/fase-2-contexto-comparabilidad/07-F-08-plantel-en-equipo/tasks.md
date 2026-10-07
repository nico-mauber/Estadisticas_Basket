# Tasks — F-08: Plantel dentro de Equipo

> **ID:** F-08 · **Prioridad:** P1 · **Fase y orden:** 2·07
> **Depende de:** T-05 · T-01 · T-06 · X-01
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** plan.md de este mismo requisito

## Orden de ejecución

### Grupo A — Backend: bundles del plantel
- [ ] T-A1 · `team_roster_bundles(team_code, comp_id, ctx) -> list[StatBundle]` (agrupa por identidad, excluye DNP, arma `StatBundle` por jugador) · `backend/app.py` o `backend/roster.py` (NUEVO) · cubre RF-1, RF-4, RF-7 · Done: sobre un equipo del dataset de verificación devuelve un `StatBundle` por jugador con minutos, ninguno con `games == 0`

### Grupo B — Backend: registro T-06
- [ ] T-B1 · `tables.register_table("team_roster", entity_type="player", builder=team_roster_bundles, default_columns=[...])` · `backend/tables.py` · cubre RF-1, RF-3 · Done: `GET /api/table/team_roster?team=<code>` devuelve `rows` con una fila por jugador con minutos

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.table(tableId, params)` (si T-06 no lo agregó aún) · `frontend/js/api.js` · cubre RF-1 · Done: `api.table("team_roster", {team: "<code>"})` resuelve el JSON de T-B1

### Grupo D — Frontend: UI
- [ ] T-D1 · Pestaña `plantel` de S3 con `data-table.js` sobre `api.table("team_roster", …)` + `export-menu.js` · `frontend/js/views/equipo.js` (o `app.js`) · cubre RF-1, RF-3, RF-6 · Done: la tabla se ve completa sin salir de la vista Equipo, ordena por cualquier columna con nulos al final
- [ ] T-D2 · Acción de fila "Ver ficha" (navega a la ficha del jugador) · cubre RF-5 · Done: clic en una fila navega a `#/jugador/<id>/resumen` sin recargar
- [ ] T-D3 · Acción de fila "Comparar" (checkbox + botón flotante "Comparar seleccionados (N)") · cubre RF-5 · Done: marcar 2 filas y confirmar navega a `#/comparar/jugadores?a=<id1>&b=<id2>`
- [ ] T-D4 · Retirar o condicionar `_renderUsageRanking` según spec §9.3 · `frontend/js/app.js` · cubre RF-8 · Done: si X-01 ya integró la pestaña, la tarjeta "Jugadores más influyentes" ya no aparece en Resumen; si no, queda documentada como pendiente en progress.md

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado vacío "Este equipo no tiene jugadores con minutos en la selección." · cubre CA-1 (parcialmente) · Done: un equipo sin jugadores con minutos en el filtro activo muestra el mensaje, no una tabla vacía sin explicación
- [ ] T-E2 [P] · Sumar módulos nuevos (si los hay) a `sw.js` `STATIC` y bump de `CACHE` si X-01 no migró aún a runtime caching · `frontend/sw.js`

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · N/A — F-08 no cambia esquema
- [ ] T-F3 · `curl http://localhost:5000/api/table/team_roster?team=<code>` (con sesión autenticada o `test_client()`) probado y shape verificado contra §7.6
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la pestaña Plantel completa
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅/❌
- [ ] T-F6 · CA-1 (CA del cliente): en el navegador, abrir la pestaña Plantel de un equipo del dataset y confirmar que se ve la tabla completa sin navegar a otra sección
- [ ] T-F7 · CA-2: hacer clic en 3 encabezados distintos y confirmar el reordenamiento con nulos al final en ambos sentidos
- [ ] T-F8 · CA-3: identificar un jugador con pocos minutos en el dataset, confirmar fila gris con advertencia y que no participa del promedio de competencia (comparar el promedio mostrado con/sin ese jugador)
- [ ] T-F9 · CA-4: clic en "Ver ficha" de una fila y confirmar la navegación a S4 sin recarga
- [ ] T-F10 · CA-5: marcar 2 jugadores y confirmar la navegación a la comparación con ambos preseleccionados (requiere F-05 implementado; si no, verificar solo que la URL se arma correctamente)
- [ ] T-F11 · CA-6: exportar a CSV y XLSX, abrir el archivo y comparar columnas/orden/filtros contra lo mostrado en pantalla
- [ ] T-F12 · CA-7: identificar un jugador sin triples intentados en el dataset y confirmar "—" en `fg3_pct`/`ppt_3`, no 0%/0,00
- [ ] T-F13 · CA-8: confirmar que la tarjeta "Jugadores más influyentes — USO%" ya no aparece por separado (o que su ausencia está documentada como diferida) y que ordenar la tabla por `uso_pct` reproduce el mismo ranking

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-A1, T-B1, T-D1, T-F6 |
| CA-2 | T-D1, T-F7 |
| CA-3 | T-A1, T-D1 (depende de T-02 y T-01 para badge/población), T-F8 |
| CA-4 | T-D2, T-F9 |
| CA-5 | T-D3, T-F10 (depende de F-05) |
| CA-6 | T-D1, T-F11 (depende de T-06 `export-menu.js`) |
| CA-7 | T-A1, T-F12 |
| CA-8 | T-D4, T-F13 |

## Dependencias externas
- **T-05 debe exponer `stats_engine.compute_standard`/`StatBundle` y registrar el tipo de entidad `player`** antes de T-A1.
- **T-01 debe exponer `population.attach_fichas`/`ficha`** antes de que la tabla traiga percentiles (T-B1); sin T-01, la
  tabla funciona igual pero sin columnas de ficha (degradación documentada en plan.md §10).
- **T-06 debe exponer `tables.register_table`/`build_table` y `components/data-table.js`/`export-menu.js`** antes de T-B1/T-D1.
- **X-01 debe registrar la pestaña `plantel` de S3** antes de T-D1 (o F-08 la agrega como sección propia si X-01 no llegó,
  ver plan.md §6).
- **F-05 (comparar jugadores) es necesaria para que T-F10/CA-5 sea verificable de punta a punta**; sin F-05, T-D3 arma la
  URL igual pero el destino puede no existir aún.
- **C-08 (ids de jugador) es opcional**: si no cerró, F-08 usa nombre normalizado como identificador de fila (RF-9).
- **Dataset de verificación**: los 13 partidos del seed, con al menos un equipo con jugadores de pocos minutos (para CA-3)
  y al menos un jugador sin triples intentados (para CA-7).
- Ninguna variable de entorno nueva.
