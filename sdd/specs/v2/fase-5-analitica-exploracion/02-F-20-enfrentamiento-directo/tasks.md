# Tasks — F-20: Enfrentamiento directo dentro de Equipo

> **ID:** F-20 · **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** `spec.md`, `plan.md`

## Orden de ejecución

### Grupo A — Backend: `rival_comparison.py`
- [ ] T-A1 · `compare(team_code, rival_code, comp_id)` — pasos 1-4 (agregación de `games_vs_rival`/`games_all`, `StatBundle`, `compute_standard`) · `backend/rival_comparison.py` · cubre RF-6, RF-8 · Done: sobre dos equipos del seed con partidos en común, `vs_rival.efg_pct.value` coincide con el cálculo manual pooled (Σ(2·fgm2+3·fgm3)/ΣTCi) sobre exactamente esos partidos
- [ ] T-A2 · Cálculo de `deltas` orientados y `top_deltas` (3 a 5 de mayor magnitud) · `backend/rival_comparison.py` · cubre RF-7 · Done: para una métrica `lower` (ej. `to_pct`), un `vs_rival` peor que `overall` produce `delta` negativo (orientado, no aritmético crudo)
- [ ] T-A3 · Bloque `sample` (badge de partidos contra el rival) · `backend/rival_comparison.py` · cubre — · Done: con menos de 3 partidos contra el rival, `sample.level == "baja"`

### Grupo B — Backend: ruta
- [ ] T-B1 · `GET /api/rival-comparison` (valida `team`/`rival`, delega en `compare`) · `backend/app.py` · cubre RF-6 · Done: `curl "http://localhost:5000/api/rival-comparison?team=CNF&rival=PEN"` devuelve 200 con las 5 claves de nivel raíz (`vs_rival, overall, deltas, top_deltas, sample`)
- [ ] T-B2 · Validaciones 400/404 · `backend/app.py` · cubre — · Done: `curl` con `rival=CNF&team=CNF` → 400 con el mensaje exacto; con `team=ZZZ` → 404

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.rivalComparison(params)` · `frontend/js/api.js` · cubre RF-6 · Done: en consola del navegador, `await api.rivalComparison({team:"CNF",rival:"PEN"})` devuelve el objeto completo sin lanzar

### Grupo D — Frontend: UI
- [ ] T-D1 · Habilitar la pestaña `enfrentamiento` en el router de S3 (X-01, cambiar `enabled: false` a `true`) · `frontend/js/views/equipo.js` · cubre RF-1 · Done: la pestaña "Enfrentamiento" aparece en el perfil de Equipo sin recargar la página
- [ ] T-D2 · Selector de rival (sin `?rival=` en la URL) con cantidad de enfrentamientos por rival · `frontend/js/components/rival-comparison.js` · cubre RF-1, RF-2 · Done: recorrido en navegador desde el perfil de Equipo: clic en "Enfrentamiento" + clic en un rival = historial visible (2 clics totales, cronometrado visualmente)
- [ ] T-D3 · Lectura de `?rival=` preseleccionado en la URL (llegada directa desde otra vista) · `frontend/js/views/equipo.js` · cubre RF-3 · Done: navegar directo a `#/equipo/CNF/enfrentamiento?rival=PEN` muestra el historial sin pasar por el selector
- [ ] T-D4 [P] · Bloque Historial (reutiliza `api.h2h`, de F-03, sin cambios) · `frontend/js/components/rival-comparison.js` · cubre RF-4, RF-5 · Done: la lista de partidos y el récord coinciden exactamente con los de `GET /api/h2h?a=CNF&b=PEN`
- [ ] T-D5 [P] · Bloque Comparación de promedios (tabla con Δ) · `frontend/js/components/rival-comparison.js` · cubre RF-6, RF-8 · Done: recorrido en navegador muestra cada métrica con valor vs. rival, valor general y delta con signo
- [ ] T-D6 [P] · Bloque Diferencias más marcadas (formato F-17 si está disponible) · `frontend/js/components/rival-comparison.js` · cubre RF-7 · Done: recorrido en navegador muestra entre 3 y 5 ítems ordenados por magnitud de delta, de mayor a menor
- [ ] T-D7 · Enlaces a F-03 (Preparar) y a emparejamientos · `frontend/js/components/rival-comparison.js` · cubre RF-9, RF-10 · Done: clic en "Ver informe completo" navega a `#/partido/preparar?team=CNF&rival=PEN` con ambos ya seleccionados; clic en "Ver emparejamientos" abre el bloque de coincidencia en cancha correspondiente

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados vacíos por bloque (spec §6) · `frontend/js/components/rival-comparison.js` · cubre RF-8 · Done: con un rival sin partidos contra el equipo, cada bloque muestra su copy de vacío, sin excepción JS
- [ ] T-E2 · `components/rival-comparison.js` a `STATIC[]` de `sw.js` (si X-01 aún usa lista estática en esta fase) · `frontend/sw.js` · cubre — · Done: `grep` del archivo en `sw.js` (si aplica) y `CACHE` incrementado

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` — N/A, F-20 no toca esquema
- [ ] T-F3 · `GET /api/rival-comparison` probado con curl (caso válido + los 3 casos de error de T-B2)
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la pestaña completa
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅/❌

## Matriz de cobertura (CA → tareas)

| CA | Procedimiento manual | Tareas |
|---|---|---|
| CA-1 (CA del cliente) | Desde el perfil de un equipo, cronometrar/contar los clics: pestaña Enfrentamiento (clic 1) → elegir rival (clic 2) → historial visible. Confirmar que no hay pasos intermedios | T-D1, T-D2, T-F4 |
| CA-2 | Comparar la lista de partidos y el récord del bloque Historial contra `curl "http://localhost:5000/api/h2h?a=CNF&b=PEN"` — deben coincidir exactamente | T-D4, T-F3 |
| CA-3 | Comparar cada valor de `vs_rival`/`overall`/`deltas` contra el cálculo manual pooled y contra `GET /api/team/CNF?competition=<id>` para el promedio general | T-A1, T-D5, T-F3 |
| CA-4 | Contar los ítems del bloque Diferencias más marcadas y verificar que están ordenados por magnitud de delta descendente | T-A2, T-D6, T-F4 |
| CA-5 | Clic en "Ver informe completo" y confirmar la URL resultante y que ambos equipos ya están seleccionados en F-03 | T-D7, T-F4 |
| CA-6 | Clic en "Ver emparejamientos" y confirmar que se abre la vista de coincidencia en cancha con `team`/`rival` correctos | T-D7, T-F4 |
| CA-7 | Navegar a `#/equipo/CNF/enfrentamiento?rival=<un-equipo-que-nunca-jugo-contra-CNF>` y confirmar el estado "Sin historial entre estos equipos" sin romper la vista | T-D3, T-E1, T-F4 |
| CA-8 | `curl "http://localhost:5000/api/rival-comparison?team=CNF&rival=CNF"` → 400 con el mensaje exacto | T-B2, T-F3 |

0 CA sin cobertura (8/8).

## Dependencias externas

- Reimportación de partidos: no aplica (F-20 no toca esquema ni requiere columnas nuevas).
- Variables de entorno: ninguna nueva.
- Requisitos previos que deben estar implementados antes de ejecutar el Grupo F de F-20: X-01 (pestaña `enfrentamiento`
  registrada), F-03 (`prepare.head_to_head`, `GET /api/h2h`), F-07 (`matchups.py`, para el enlace de emparejamientos),
  T-05 (`stats_engine.compute_standard`), T-02 (`sample.sample_level`), F-17 (`components/game-plan.js`, opcional para el
  formato del bloque de diferencias).
- Para la verificación completa se necesitan al menos dos equipos del seed con más de un partido jugado entre sí (para
  poder ver un récord distinto de 0-0 y una muestra de nivel "media" o "alta").
