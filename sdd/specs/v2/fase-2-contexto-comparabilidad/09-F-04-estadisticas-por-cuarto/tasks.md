# Tasks — F-04: Estadísticas por cuarto

> **ID:** F-04 · **Prioridad:** P1 · **Fase y orden:** 2·09
> **Depende de:** C-06 · T-05 · T-02 · T-03 · X-01 (rutas en [spec.md](spec.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Confirmar que F-04 no requiere cambios de esquema y que existen las precondiciones: `pbp_events.qualifiers`, `team_game_stats.period_pts` (F-11), claves `clutch.window_secs`, `sample.split.*`, `regression.split.k` en `CONFIG_SPEC` (F-13) · `backend/database.py`, `backend/config.py` (solo lectura) · cubre RF-3, RF-6, RF-7 · Done: nota en `progress.md` con las columnas y claves encontradas (o el bloqueo si falta alguna).

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Agregar `WINDOWS`, `WINDOW_LABELS` y `window_events()` reutilizando el predicado de ventana corregido por C-06 (`PERIOD_TYPES`) · `backend/clutch.py` · cubre RF-1 · Done: en un shell con `app.app_context()`, para un partido con prórroga del seed, `len(window_events(evs,"pr",window_secs=300)) > 0` y para uno sin prórroga devuelve `None`; `q1+q2+q3+q4` suman todos los eventos `REGULAR` con `team_code`.
- [ ] T-B2 · Revisar el constructor de `StatBundle` que dejó T-05 para el tipo `clutch`; crear o reutilizar `events_bundle()` y extender `_agg` con `pf` (sin técnicas de banco/entrenador), `fouls_drawn`, `blk_received` (= `blk` del rival) y `plus_minus` · `backend/clutch.py` · cubre RF-2, RF-3, RF-13 · Done: `compute_standard(events_bundle(...))` sobre el partido completo devuelve todas las claves de `METRICS` con `pts` igual al box y `pf` comparado con el box (diferencias anotadas).
- [ ] T-B3 · Implementar `window_minutes()` y `period_bundles(team_code, comp_id, ctx)` con filtro de contexto de partido y de evento, récord del tramo y `null_reasons["*"]="sin_datos"` para tramos sin partidos · `backend/clutch.py` · cubre RF-2, RF-4, RF-9, RF-10, RF-13 · Done: para un equipo del seed, 8 bundles; Σ`pts` de q1..q4 = `pts` de h1 + h2; `pr` sin partidos → todo nulo `sin_datos`.
- [ ] T-B4 · Implementar `period_game_rows(team_code, window, comp_id, ctx)` (fila por partido con fecha, rival, L/V, `entry_margin` en `last5`) · `backend/clutch.py` · cubre RF-4, RF-11 · Done: filas ordenadas por fecha desc; Σ`pts` de las filas = `pts` del bundle del tramo.
- [ ] T-B5 · Registrar el tipo `period` con `_load_period` (parseo de `<team>:<tramo>`, error 400 si el tramo es inválido; población = todos los equipos de la competencia en el mismo tramo) y caché `cache.memo("period", …)` · `backend/clutch.py`, `backend/metrics_catalog.py` · cubre RF-3, RF-8 · Done: `curl -s -b c.txt "http://localhost:5000/api/metrics/period?id=CNF:q3"` devuelve el shape de plan §3.1 con fichas (`rank`, `rank_total`, `percentile`) y `summary`.
- [ ] T-B6 · Aplicar muestra y regresión de split: `sample_level("split", …)`, `adjusted` para `oer`/`der`, `net_aj`, `band` · `backend/clutch.py` (loader) · cubre RF-6, RF-7 · Done: el payload trae `sample.level` y `metrics.oer.adj{value,k=20,prior,band}`; con `sample.split.min` subido a 500 desde S9 el tramo pasa a `baja` e `in_population=false`.
- [ ] T-B7 · Eco de contexto: excluir `quarter` del predicado y reportarlo en `context.ignored` con razón `no_aplica`; contar `games_excluded.sin_pbp` · `backend/clutch.py` (loader) usando `context.context_echo` · cubre RF-9, RF-10 · Done: `curl ".../api/metrics/period?id=CNF:q1&quarter=1&last=5"` → `context.ignored` contiene `quarter`, `context.applied.last == 5`.
- [ ] T-B8 · Registrar la tabla `period_splits` (`view=tramos` con 8 filas y `totals` "Partido completo"; `view=partidos&window=`) con columnas default del plan §3.2 · `backend/tables.py` · cubre RF-4, RF-11 · Done: `curl -s -b c.txt "http://localhost:5000/api/table/period_splits?team=CNF"` → 8 filas en orden `WINDOWS`; `...&view=partidos&window=q3` → una fila por partido.
- [ ] T-B9 · Verificar que el tipo `clutch` de T-05 usa la ventana y el umbral de C-06 y, si todavía usa `_box_metrics`, reencaminarlo a `events_bundle` sin tocar el shape legado de `/api/clutch/<team>` · `backend/clutch.py`, `backend/metrics_catalog.py` · cubre RF-12 · Done: `/api/metrics/clutch?id=CNF` y `/api/clutch/CNF` dan los mismos `pts_for/pts_against/possessions`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · Confirmar que `api.table()` y `api.metrics()` (T-05/T-06) aceptan los parámetros `view`, `window` y el contexto; no crear métodos nuevos · `frontend/js/api.js` (solo lectura) · cubre RF-5 · Done: llamada desde la consola del navegador `await api.table("period_splits",{team:"CNF"})` devuelve 8 filas.

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · Crear `renderPeriodBlock(el, payload, {initialWindow, onWindowChange})` con chips, resumen tipo Cierres, `renderStandardPanel` y `sampleBadge`; cambio de tramo en memoria (sin `fetch`) · `frontend/js/components/period-block.js` · cubre RF-1, RF-4, RF-5, RF-6, RF-7, RF-8 · Done: en la pestaña, al tocar chips el panel cambia y la pestaña Network no muestra requests nuevas.
- [ ] T-D2 · Montar la pestaña `momentos` en `views/equipo.js`: bloque por tramo arriba (una llamada a `period_splits`), bloque Cierres debajo (`api.metrics("clutch")` + tabla `clutch_games`), parámetro de vista `window` en la URL con `replaceState`, re-carga solo al cambiar el contexto · `frontend/js/views/equipo.js` · cubre RF-5, RF-9, RF-12 · Done: `#/equipo/CNF/momentos?window=q3` abre en 3.er cuarto; cambiar de chip actualiza `window` sin re-render del resto.
- [ ] T-D3 · Tabla "Ver partido a partido" con `createDataTable` + `exportMenu` (metadatos con el tramo) · `frontend/js/components/period-block.js` · cubre RF-11 · Done: la tabla ordena con nulos al final y exporta CSV con cabecera `# Tramo: 3.er cuarto`.
- [ ] T-D4 · Estilos de chips (scroll horizontal en <768 px), estado gris de muestra baja y panel en una columna en móvil · `frontend/css/style.css` · cubre RF-1, RF-6 · Done: en DevTools a 375 px, chips desplazables, sin desborde horizontal de página.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/vacío/error/offline y chips deshabilitados con `title`, todo con `t()` y el copy del spec §6 · `frontend/js/components/period-block.js`, `frontend/js/views/equipo.js` · cubre RF-10, RF-13 · Done: equipo sin pbp → copy "Este equipo no tiene play-by-play importado. Reimportá sus partidos."; con el backend detenido → copy de sin conexión.
- [ ] T-E2 · Sumar `period-block.js` a `STATIC` (si aplica) y subir `CACHE` · `frontend/sw.js` · Done: tras recargar, el SW nuevo queda activo (DevTools → Application) y el módulo carga desde caché offline.
- [ ] T-E3 · Actualizar docs al cierre: `docs/api.md` (tipo `period`, tabla `period_splits`), `docs/metrics.md` (tramos, minutos, faltas desde pbp), `docs/frontend.md` (pestaña Momentos, componente, copy), `docs/architecture.md` (`clutch.py`) · Done: los cuatro docs mencionan F-04 y coinciden con lo implementado.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · `upgrade_db()` idempotente: N/A (sin cambios de esquema); confirmar que `python backend/database.py` sigue corriendo dos veces sin error.
- [ ] T-F3 · Endpoints probados con curl: `/api/metrics/period?id=CNF:q1…last5`, `/api/table/period_splits?team=CNF`, `...&view=partidos&window=pr`, errores 400 (tramo `q9`) y 404 (equipo `ZZZ`); shapes contra plan §3.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la pestaña Momentos (desktop y 375 px).
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md`:
  - [ ] CA-1 (cliente) · Navegador: abrir `#/equipo/CNF/momentos`, pestaña Network abierta; tocar los 8 chips → el bloque cambia, 0 requests nuevas, sin recarga; el bloque de Cierres y el scroll se conservan.
  - [ ] CA-2 · `curl -s -b c.txt "http://localhost:5000/api/table/period_splits?team=CNF" | python -c "import json,sys;d=json.load(sys.stdin);print(len(d['rows']),[r['id'] for r in d['rows']])"` → 8 filas; comprobar que cada clave de `/api/metrics-catalog` aplicable a `period` está en `columns`.
  - [ ] CA-3 · Script ad hoc con `app.test_client()`: Σ`pts`/`pts_against` de q1..q4 == h1 + h2; h1 + h2 + pr == Σ de los puntos finales del equipo en `games` con pbp.
  - [ ] CA-4 · Con uno de los 2 partidos con prórroga del seed: `.../api/table/period_splits?team=<code>&view=partidos&window=pr` → el partido aparece, `minutes` = 5 × n_prórrogas, `pts` = final − marcador al cierre del 4.º cuarto (leído de `/api/pbp/<game_id>` o de `period_pts`).
  - [ ] CA-5 · Equipo sin prórrogas: `.../api/metrics/period?id=<code>:pr` → todas las métricas `value: null`, `reason: "sin_datos"`; en la UI el chip "Prórroga" deshabilitado.
  - [ ] CA-6 · Subir `sample.split.min` a 500 en S9 → el tramo muestra BAJA, gris, `adj` con banda, `in_population: false`; restaurar el valor.
  - [ ] CA-7 · Comparar `last5` con `/api/metrics/clutch?id=CNF`: `last5` incluye todos los partidos; con `clutch.margin=40` (S9) ambos dan iguales `pts`, `pts_against`, `possessions`; restaurar.
  - [ ] CA-8 · Navegador: aplicar `last=5` y `venue=local` en la barra → los 8 tramos cambian y el badge también; URL con `&quarter=1` → `context.ignored` incluye `quarter` (verificar en la respuesta en Network).
  - [ ] CA-9 · Exportar CSV del desglose del 3.er cuarto → abrir el archivo: mismas filas/orden/columnas visibles; cabecera con equipo, competencia, "Tramo: 3.er cuarto" y filtros.
  - [ ] CA-10 · Con un partido importado sin pbp para el equipo (o borrando temporalmente sus `pbp_events` en una copia de la base): `context.games_excluded.sin_pbp == 1` y el partido no entra en ningún tramo.
  - [ ] CA-11 · Script ad hoc: para cada partido reprocesado con ingesta v2, puntos por cuarto desde pbp == `team_game_stats.period_pts`; listar diferencias en `progress.md`.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-D1, T-D2, T-F5 |
| CA-2 | T-B2, T-B5, T-B8, T-F5 |
| CA-3 | T-B1, T-B3, T-F5 |
| CA-4 | T-B1, T-B3, T-B4, T-F5 |
| CA-5 | T-B3, T-E1, T-F5 |
| CA-6 | T-B6, T-D1, T-F5 |
| CA-7 | T-B1, T-B9, T-F5 |
| CA-8 | T-B7, T-D2, T-F5 |
| CA-9 | T-B8, T-D3, T-F5 |
| CA-10 | T-B7, T-F5 |
| CA-11 | T-A1, T-B3, T-F5 |

## Dependencias externas
- Fase 1 cerrada y X-01, T-03 implementados (pestaña `momentos`, `core/context.js`, `context.event_predicate`).
- Base local con los 13 partidos del seed **reprocesados con la ingesta v2 de F-11** (incluye los 2 con prórroga, `period_pts`, `qualifiers`); `SEED_ENABLED=1` y sesión iniciada para el seed si hay `AUTH_USERS`.
- Configuración F-13 operativa (para CA-6 y CA-7 se modifican y restauran valores desde S9; requiere usuario admin según `ADMIN_USERS`).
- Cookie de sesión para curl (`curl -c c.txt -X POST .../api/login ...`) si `AUTH_USERS` está definida; en modo abierto no hace falta.
