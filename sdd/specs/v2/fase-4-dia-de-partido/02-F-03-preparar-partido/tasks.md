# Tasks — F-03: Preparar partido

> **ID:** F-03 · **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** `spec.md`, `plan.md`

## Orden de ejecución

### Grupo A — Backend: módulo `prepare.py`
- [ ] T-A1 · Crear `head_to_head(team_a, team_b, comp_id)` (historial completo entre dos equipos, record W-L) · `backend/prepare.py` · cubre RF-11, RF-12, RF-28 · Done: `test_client()` a `/api/h2h?a=CNF&b=PEN` devuelve `games[]` ordenados por fecha desc y `record` coherente con la suma manual sobre `games`
- [ ] T-A2 [P] · Implementar `_advantages_and_threats(team_code, rival_code, comp_id, ctx)` delegando en `phrases.game_plan(mode="matchup")` · `backend/prepare.py` · cubre RF-4, RF-5, RF-6 · Done: llamando directo en un `python -i` (o script ad hoc), devuelve exactamente entre `gameplan.items_min` y `gameplan.items_max` ítems por columna con las 6 claves de F-17 (metric, delta, own, ref, percentile, text, direction)
- [ ] T-A3 [P] · Implementar `_rival_offensive_threats(rival_code, games_rival)` (top USO%, mejor zona por PPT, reparto de puntos) · `backend/prepare.py` · cubre RF-9, RF-10, RF-27 · Done: con un rival con coordenadas de tiro en ≥1 partido, `best_zone.has_coordinates == true`; con un rival sin coordenadas en ningún partido del filtro, cae a modo 3 zonas sin excepción
- [ ] T-A4 · Implementar `_matchups_block(team_code, rival_code, comp_id, ctx, games_rival)` reutilizando `matchups.team_matchups` de F-07 para los tres niveles · `backend/prepare.py` · cubre RF-13..RF-22 · Done: para un par de equipos con partidos en común, las tres claves `quinteto`/`jugador`/`jugador_quinteto` no están vacías y cada fila sin antecedentes trae `reason: "sin_enfrentamientos"` en vez de valor 0
- [ ] T-A5 · Implementar `prepare_report(team_code, rival_code, comp_id, ctx, *, last)` orquestando T-A1..T-A4 + filtro `last` sobre partidos del rival + caché `cache.memo("prepare", ...)` · `backend/prepare.py` · cubre RF-1, RF-2, RF-3, RF-26 · Done: dos llamadas consecutivas con los mismos parámetros devuelven el mismo objeto sin recalcular (verificar con un contador de invocaciones temporal o con tiempo de respuesta de la 2.ª llamada ≈0)
- [ ] T-A6 · Agregar `report.default_last_n` a `CONFIG_SPEC` si `backend/config.py` (F-13) ya existe en el árbol al implementar; si no, usar default embebido `None` en `prepare_report` · `backend/config.py` o `backend/prepare.py` · cubre RF-2 · Done: `config.get("report.default_last_n")` devuelve `None` sin excepción si la clave está registrada; si no está registrada, `prepare_report(last=None)` no rompe

### Grupo B — Backend: rutas
- [ ] T-B1 · `GET /api/prepare` (valida `team`/`rival`, resuelve `competition`/`last`, delega en `prepare_report`) · `backend/app.py` · cubre RF-1, RF-2, RF-3 · Done: `curl "http://localhost:5000/api/prepare?team=CNF&rival=PEN"` devuelve 200 con las 8 claves de nivel raíz (`summary, advantages, threats, rival_lineups, rival_threats, h2h, matchups, suggestions_profile`)
- [ ] T-B2 [P] · `GET /api/h2h` (valida `a`/`b`, delega en `head_to_head`) · `backend/app.py` · cubre RF-11 · Done: `curl "http://localhost:5000/api/h2h?a=CNF&b=PEN"` devuelve 200 con `games[]` y `record`
- [ ] T-B3 · Validaciones 400/404 de ambas rutas (falta `team`/`rival`/`a`/`b`, `rival==team`, equipo inexistente) · `backend/app.py` · cubre RF-1 (casos borde) · Done: `curl` sin `rival` → 400 `{"error":"Falta el rival","code":"parametro_invalido"}`; con `rival=CNF&team=CNF` → 400 `"El rival no puede ser el mismo equipo"`; con `team=ZZZ` → 404 `"Equipo no encontrado"`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.prepare(params)` y `api.h2h(params)` · `frontend/js/api.js` · cubre RF-1, RF-2, RF-11 · Done: consola del navegador, `await api.prepare({team:"CNF",rival:"PEN"})` devuelve el objeto completo sin lanzar

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · Selector inicial de equipo/rival cuando la URL no trae `team`/`rival` · `frontend/js/views/partido.js` · cubre RF-1 · Done: navegar a `#/partido/preparar` sin query muestra los dos `<select>` con el copy de spec §6
- [ ] T-D2 · Registrar modo `preparar` en el router de S5 (`core/router.js registerTab`) · `frontend/js/views/partido.js` · cubre RF-1 · Done: `#/partido/preparar?team=CNF&rival=PEN` renderiza la vista sin recargar la página
- [ ] T-D3 · Bloque Encabezado (equipo, rival, competencia, partidos del rival considerados, fecha de generación) · `frontend/js/components/prepare-report.js` · cubre RF-3 · Done: recorrido en navegador muestra los 5 datos del encabezado
- [ ] T-D4 [P] · Bloque Ventajas/Amenazas (formato F-17 vía `components/game-plan.js` renderer de ítem) · `frontend/js/components/prepare-report.js` · cubre RF-4, RF-5, RF-6 · Done: recorrido en navegador muestra 2 columnas con hasta 5 ítems cada una, cada ítem con métrica/delta/valores/percentil/lectura/flecha
- [ ] T-D5 [P] · Bloque Quintetos rivales (`components/data-table.js` con payload `rival_lineups`) · `frontend/js/components/prepare-report.js` · cubre RF-7, RF-8 · Done: tabla ordenada por minutos desc al cargar, con badge de muestra por fila
- [ ] T-D6 [P] · Bloque Amenazas ofensivas (top USO%, `components/shot-chart.js` con la mejor zona resaltada, reparto de puntos) · `frontend/js/components/prepare-report.js` · cubre RF-9, RF-10 · Done: recorrido en navegador con un rival con coordenadas muestra el mapa de zonas; con un rival sin coordenadas muestra el fallback de 3 zonas con aviso
- [ ] T-D7 [P] · Bloque Head to head (lista de partidos con enlace a `#/partido/<game_id>/analizar`, récord) · `frontend/js/components/prepare-report.js` · cubre RF-11, RF-12 · Done: clic en una fila navega a la vista Analizar (F-07) del partido correcto
- [ ] T-D8 · Componente `matchup-table.js`: selector de nivel (quinteto/jugador/jugador-quinteto), selector directo/inverso, celdas grises bajo umbral con banda visible, "Sin datos" para cruces sin antecedentes, leyenda fija de "coincidencia en cancha" · `frontend/js/components/matchup-table.js` · cubre RF-13..RF-22 · Done: recorrido completo del bloque sin encontrar la palabra "marcaje" en ningún texto; un cruce con <8 posesiones aparece en gris con badge "Baja"; un cruce sin antecedentes muestra "Sin datos"
- [ ] T-D9 · Selector de quinteto propio → ordena rivales por Net Rating del cruce; selector inverso → ordena propios · `frontend/js/components/matchup-table.js` · cubre RF-17 · Done: elegir un quinteto propio reordena la tabla de rivales de mejor a peor Net Rating del cruce, verificado visualmente contra los valores de la tabla
- [ ] T-D10 · Clic en celda con historial abre el listado de partidos del cruce con enlace a Analizar · `frontend/js/components/matchup-table.js` · cubre RF-18 · Done: clic en una celda con `games.length > 0` abre un listado con al menos un enlace `#/partido/<game_id>/analizar` válido
- [ ] T-D11 · Bloque Sugerencia por perfil oculto (placeholder que no renderiza nada hasta A-09) · `frontend/js/components/prepare-report.js` · cubre RF-21 · Done: inspección del DOM confirma que no hay ningún nodo visible para este bloque
- [ ] T-D12 · Menú de exportación: preset PDF A4 (2 páginas, `@media print`), PNG vertical 1080 px, CSV de datos base · `frontend/js/components/prepare-report.js`, `frontend/css/style.css`, uso de `components/export-menu.js`/`exporters.js` (T-06, sin cambios) · cubre RF-23, RF-24, RF-25 · Done: exportar a PDF abre el diálogo de impresión con una vista previa de 2 páginas A4; exportar a PNG descarga una imagen de 1080 px de ancho; exportar a CSV descarga un archivo con cabecera de metadatos T-06 y filas de ventajas/amenazas + quintetos rivales + emparejamientos

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados vacíos por bloque (spec §6: "Muestra insuficiente…", "El rival no tiene quintetos…", "Sin datos de tiro…", "Sin historial…", "Sin cruces registrados…") · `frontend/js/components/prepare-report.js` · cubre RF-28 · Done: con un rival sin partidos en la competencia elegida, cada bloque muestra su copy de vacío correspondiente y la vista no se rompe (sin excepción JS en consola)
- [ ] T-E2 · Estado de error general de la vista y estado offline · `frontend/js/views/partido.js` · cubre — · Done: simular fallo de red (DevTools offline) al navegar a `#/partido/preparar?...` muestra el copy de sin conexión
- [ ] T-E3 · Agregar `components/prepare-report.js` y `components/matchup-table.js` a `STATIC[]`, subir `CACHE` · `frontend/sw.js` · cubre — · Done: `grep` de ambos archivos en `sw.js` y el número de `CACHE` es mayor al anterior

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` — N/A, F-03 no toca esquema (verificar igual que corre sin error, por si otro requisito integrado en paralelo sí tocó esquema)
- [ ] T-F3 · Cada endpoint nuevo probado con curl: `GET /api/prepare?team=CNF&rival=PEN`, `GET /api/prepare?team=CNF&rival=PEN&last=5`, `GET /api/h2h?a=CNF&b=PEN`, casos de error de T-B3 — shape verificado contra §8 del plan
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la vista completa (selector → informe → cada bloque → exportar los 3 formatos)
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅/❌ (procedimiento detallado en la matriz de cobertura)

## Matriz de cobertura (CA → tareas)

| CA | Procedimiento manual | Tareas |
|---|---|---|
| CA-1 (CA del cliente) | Con dos equipos reales de la competencia del seed, cronometrar `curl -w "%{time_total}\n" "http://localhost:5000/api/prepare?team=CNF&rival=PEN"` en frío (tras reiniciar el proceso o invalidar la caché) → debe ser < 10 s; abrir el PDF exportado y confirmar que se lee sin volver a la app | T-A5, T-B1, T-D12, T-F3 |
| CA-2 | Navegador: bloque Ventajas/Amenazas con dos equipos con muestra suficiente → contar 5 ítems por columna, cruzar cada valor/percentil contra `GET /api/league?competition=<id>` (T-01) del mismo par métrica/equipo | T-A2, T-D4, T-F4 |
| CA-3 | Comparar la tabla de quintetos rivales del informe contra `GET /api/table/team_lineups?team=<rival>&competition=<id>` filtrado por los mismos `last` partidos — mismos valores y orden | T-A4 (lineups reuso), T-D5, T-F3 |
| CA-4 | Con un rival con coordenadas en ≥1 partido, verificar en el mapa de zonas que la de mayor PPT está resaltada; sumar los 5 componentes de `points_origin` y confirmar que suman ~100% de los puntos (con margen de redondeo) | T-A3, T-D6, T-F4 |
| CA-5 | Con dos equipos que jugaron entre sí, abrir H2H, contar enfrentamientos, verificar récord acumulado contra la suma manual, clic en una fila y confirmar que abre `#/partido/<game_id>/analizar` con el partido correcto | T-A1, T-D7, T-F4 |
| CA-6 (CA del cliente) | Elegir un quinteto propio en el selector → anotar el orden de los quintetos rivales listados; cambiar a selector inverso eligiendo un quinteto rival → confirmar que el orden de los propios corresponde a su Net Rating de cruce (de mayor a menor) | T-D9, T-F4 |
| CA-7 | Buscar en la matriz un cruce de quintetos que nunca coincidieron (revisar historial de partidos para confirmar que no se enfrentaron) → la celda debe decir "Sin datos", nunca "0" | T-A4, T-D8, T-F4 |
| CA-8 | Buscar un cruce con menos de 8 posesiones acumuladas → verificar que aparece en gris con badge "Baja" y con la banda de margen de error visible, y que no queda entre los primeros al ordenar por Net Rating | T-A4, T-D8, T-F4 |
| CA-9 | Clic en una celda con historial → confirmar que se abre un listado de partidos de ese cruce específico, cada uno enlazado a Analizar | T-D10, T-F4 |
| CA-10 | Buscar (Ctrl+F en el navegador) la palabra "marcaje" en toda la vista del bloque de emparejamientos → 0 resultados; confirmar que la leyenda de "coincidencia en cancha" está visible | T-D8, T-F4 |
| CA-11 | Exportar a PDF → confirmar 2 páginas A4 con encabezado, ventajas/amenazas, quintetos rivales, H2H resumido y top de emparejamientos | T-D12, T-F4 |
| CA-12 | Exportar a PNG → confirmar imagen de 1080 px de ancho con el contenido resumido | T-D12, T-F4 |
| CA-13 | Exportar a CSV → abrir el archivo y confirmar cabecera de metadatos T-06 + filas de los 3 datasets de base | T-D12, T-F4 |
| CA-14 | Cambiar el filtro de "todos" a "últimos 5" → confirmar que quintetos rivales/amenazas/emparejamientos cambian de valores y el encabezado dice "Últimos 5 partidos"; confirmar que H2H no cambia | T-A5, T-D3, T-F4 |
| CA-15 | `curl "http://localhost:5000/api/prepare?team=CNF"` (sin rival) → 400 con el mensaje exacto; `curl "http://localhost:5000/api/prepare?team=CNF&rival=CNF"` → 400 con el mensaje exacto | T-B3, T-F3 |
| CA-16 | Elegir un rival sin partidos en la competencia seleccionada → confirmar que los bloques dependientes muestran su estado vacío y el resto del informe (ventajas/amenazas si hay muestra) sigue visible, sin excepción JS | T-A5, T-E1, T-F4 |

0 CA sin cobertura (16/16).

## Dependencias externas

- Reimportación de partidos: no requiere reimportar nada nuevo (F-03 no toca esquema ni agrega columnas); sí depende de que
  los partidos del seed usados en verificación tengan `pbp_events` cargado (ya lo tienen: 13 partidos importados).
- Requisitos previos que deben estar implementados antes de ejecutar el Grupo F de F-03: F-07 (`matchups.py`,
  `game-view.js`), T-01 (`population.py`), T-02 (`sample.py`), F-06 (`lineups.all_lineups`), F-17 (`phrases.py`), T-06
  (`tables.py`, `export_xlsx.py`, `exporters.js`), C-03 (`shot_zones.py`, `shot-chart.js`, coordenadas de tiro requieren
  reproceso de F-11).
- Variables de entorno: ninguna nueva.
- Para CA-4 (coordenadas de tiro): al menos un partido del rival elegido en la verificación debe estar reprocesado con la
  ingesta v2 de F-11 (coordenadas `shots.court_x`/`court_y`); si ningún partido del seed lo está aún al momento de verificar
  F-03, usar el fallback de 3 zonas como evidencia válida de CA-4 (el CA no exige coordenadas, exige que el fallback
  funcione).
