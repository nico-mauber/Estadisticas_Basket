# Tasks — A-06: Motor de contextos cruzados

> **ID:** A-06 · **Prioridad:** P2 · **Fase y orden:** 5·07
> **Depende de:** A-01 · A-02 · A-03 · A-04 · A-05 · T-02 · T-03 (y T-01, T-05, T-06, X-01, C-06, F-13) — ver `plan.md` §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

Convenciones de verificación (Constitución 8: sin suite automatizada): `curl` contra `http://localhost:5000/api/...` o verificación ad hoc con
`app.test_client()` en un script descartable (no se commitea). Dataset: los 13 partidos del seed **reprocesados con ingesta v2** (F-11) y, para
el percentil contra la competencia, al menos 3 equipos con ≥ `sample.team.min` partidos (R-05: si el seed no alcanza, inyección controlada
documentada en `progress.md`).

## Orden de ejecución

### Grupo A — Backend: fórmulas y registro de dimensiones
- [ ] T-A1 [P] · Agregar `cross_rates(counts, *, unit)` con las 8 métricas (PPP, eFG%, TS%, PPT, TO%, OR%, FT Rate, volumen); OR% → `no_aplica` si `unit == "oportunidad"`; denominador 0 → `sin_intentos` · `backend/stats_engine.py` · cubre RF-3, RF-13, RF-19 · Done: llamada directa con contadores sintéticos devuelve los valores esperados (p. ej. `pts=47, n=41` → `ppp=1,146`); con `n=0` devuelve `{"value": None, "reason": "sin_intentos"}` sin `NaN`/`Infinity`.
- [ ] T-A2 · Crear `backend/cross_context.py` con el registro `DIMENSIONS` (11 dimensiones: clave, etiqueta, partición, específica del equipo, valores fijos, `value_of`) y las etiquetas de `tramo` desde `clock.early_max`/`clock.mid_max` · `backend/cross_context.py` · cubre RF-2 · Done: `import cross_context` sin error; `len(DIMENSIONS) == 11`; `DIMENSIONS["jugador"].partition is False`.
- [ ] T-A3 · Implementar `_clutch_info(game_id)` y `value_of` de `clutch` con `clutch._entry_margin`/`_is_clutch` y `config.get("clutch.margin"/"clutch.window_secs")` · `backend/cross_context.py` · cubre RF-2, RF-5 · Done: en un partido cerrado del seed la primera posesión tras el reloj ≤ ventana del último cuarto es `cierre`; en un partido con diferencia > margen al entrar a la ventana, todas son `resto`; una posesión de prórroga es `cierre` si el partido califica.
- [ ] T-A4 · Implementar `value_of` del resto de dimensiones (`cuarto`, `tramo`, `origen`, `tipo`, `oportunidad`, `quinteto`, `jugador`, `finalizador`, `sede`, `rival`) con las reglas del plan §4.1 y §4.3 · `backend/cross_context.py` · cubre RF-2, RF-13 · Done: sobre un partido, cada posesión completa recibe exactamente un valor en cada dimensión de partición; `tramo` devuelve `sin_tiro` para una pérdida sin tiro; `jugador` devuelve 5 ids.
- [ ] T-A5 · Agregar `include_incomplete` a `possessions.team_possessions` si A-07 todavía no lo hizo (mismo contrato; default `False`) · `backend/possessions.py` · cubre RF-18 · Done: con `True` la cantidad sube exactamente en las incompletas informadas por la conciliación de A-01.

### Grupo B — Backend: motor, muestra, color, ruta y tabla
- [ ] T-B1 · Implementar `_units` (posesión u oportunidad; conteos propios/rivales completos; oportunidad con `lineups._agg` sobre el rango `start_event`–`end_event`) y `_cells` con caché `cross:cells`, top-N + "Otros" y multiplicidad · `backend/cross_context.py` · cubre RF-1, RF-4, RF-12, RF-13, RF-18 · Done: `Σ cells.n == grand.n` para un par de dimensiones de partición; con `quinteto` y `limit=3` aparece "otros" y el total no cambia; `excluded.incomplete` = incompletas de A-01.
- [ ] T-B2 · Implementar la capa de muestra y ajuste por celda (`sample.sample_level("split", …)`, `adjusted` para PPP con `possessions.ppp_stats().mean`) · `backend/cross_context.py` · cubre RF-6, RF-7 · Done: celda con 4 posesiones → `level: "baja"`, `ranked: false`; celda con 41 → `alta`; `adj.k == 20`.
- [ ] T-B3 · Implementar percentiles: base `competencia` (matriz de cada equipo de la población, celdas BAJA excluidas, `population.percentile`) y base `matriz`; direcciones por métrica y lado · `backend/cross_context.py` · cubre RF-8, RF-9 · Done: para el cruce tramo × origen, el percentil de una celda coincide con el cálculo manual (fórmula T-01) sobre los valores de los demás equipos; con `quinteto` como eje devuelve `pct_basis: "matriz"` y `pct_reason: "contexto_no_comparable"` o `sin_universo`.
- [ ] T-B4 · Implementar `_check` (partición y solapada), totales de fila/columna/general y la orquestación `cross_matrix` con caché `cross:matrix` · `backend/cross_context.py` · cubre RF-10, RF-11 · Done: `check.ok == true` para los 45 pares (script ad hoc que itera todos los pares de las 11 dimensiones); `multiplicity` informado para pares con `jugador`.
- [ ] T-B5 · Definir `PRESETS` (6 cruces) y devolverlos en el response; implementar `preset=` en `cross_matrix` · `backend/cross_context.py` · cubre RF-14 · Done: `GET /api/cross?team=CNF&preset=tramo_origen` devuelve `dims.x.key == "tramo"`, `dims.y.key == "origen"`, `metric.key == "ppp"`.
- [ ] T-B6 · Implementar `cell_detail` (StatBundle `split` + `compute_standard` + `standard_payload`) · `backend/cross_context.py` · cubre RF-16 · Done: `GET /api/cross?…&cell_x=temprano&cell_y=1` devuelve el payload §7.3 con los mismos grupos que `GET /api/metrics/team?id=CNF`.
- [ ] T-B7 · Registrar la tabla `cross_cells` (`table_rows`) · `backend/tables.py`, `backend/cross_context.py` · cubre RF-17 · Done: `GET /api/table/cross_cells?team=CNF&dim_x=tramo&dim_y=cuarto` devuelve payload §7.6 con una fila por celda con `n > 0` y las columnas del conjunto estándar.
- [ ] T-B8 · Agregar la ruta fina `GET /api/cross` con validación de parámetros (`dim_x != dim_y`, dimensión, métrica, lado, `limit`, `color`) y mapeo de errores 400/404 · `backend/app.py` · cubre RF-1, RF-5 · Done: `curl "…/api/cross?team=CNF&dim_x=tramo&dim_y=tramo&metric=ppp"` → 400 "Elegí dos dimensiones distintas."; `team=ZZZ` → 404; request válido → 200 con el shape del plan §3.

### Grupo C — Frontend: api.js
- [ ] T-C1 · Agregar `api.cross(params)` · `frontend/js/api.js` · cubre RF-1 · Done: `api.cross({team:"CNF", dim_x:"tramo", dim_y:"cuarto", metric:"ppp"})` en la consola devuelve el JSON de T-B8.

### Grupo D — Frontend: UI
- [ ] T-D1 · Crear `components/cross-matrix.js` con `renderCrossMatrix`: celdas con valor, `n` y badge, color `percentileBg`, gris para BAJA, "—" con razón, totales, leyenda de base de color, verificación de cuadre, nota de solapamiento · `frontend/js/components/cross-matrix.js` · cubre RF-6…RF-12, RF-19 · Done: render con el JSON de T-B8 sin errores de consola; celdas BAJA grises; nulos sin color.
- [ ] T-D2 · Montar la pestaña `contextos` en S7 (`views/explorar.js`): selectores (equipo, lado, X, Y, métrica, N, base de color), chips de los 6 cruces, "⇄ Intercambiar ejes", estado en el hash, recarga al cambiar el contexto T-03 · `frontend/js/views/explorar.js` · cubre RF-1, RF-5, RF-14, RF-15 · Done: elegir un cruce preconfigurado aplica dimensiones/lado/métrica; cambiar la métrica o intercambiar ejes redibuja sin recargar la página y conserva el equipo y el contexto; recargar la URL reproduce la vista.
- [ ] T-D3 · Detalle de celda (hoja lateral/inferior con `renderStandardPanel`) y exportación (`exportMenu` con `getData` ancho y `getNode`; tabla "Ver todas las celdas" con `createDataTable`) · `frontend/js/views/explorar.js` · cubre RF-16, RF-17 · Done: clic en una celda abre el panel estándar; el CSV exportado reproduce la matriz con su cabecera de filtros.
- [ ] T-D4 [P] · Estilos `/* ── cross-matrix (A-06) ── */` (celdas, gris, sticky, `.matrix-scroll`, leyenda, mobile) · `frontend/css/style.css` · cubre RF-6, RF-7 · Done: a 360 px no hay scroll horizontal de página; la primera columna y la cabecera quedan fijas dentro del contenedor.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/vacío/error/offline con el copy de la spec §6 · `frontend/js/views/explorar.js`, `frontend/js/components/cross-matrix.js` · cubre RF-19 · Done: sin red se ve "Sin conexión: el cruce de contextos necesita conexión."; un equipo sin pbp muestra el copy del 404; elegir la misma dimensión dos veces muestra "Elegí dos dimensiones distintas."
- [ ] T-E2 · Sumar `js/components/cross-matrix.js` a `STATIC` y subir `CACHE` en `sw.js` (solo si X-01 no migró a runtime caching; si migró, registrar "sin cambios") · `frontend/sw.js` · cubre — · Done: con la app instalada y sin red, la pestaña abre el esqueleto y no falla la carga del módulo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`) · Done: arranque limpio, `import cross_context` sin error.
- [ ] T-F2 · Esquema: A-06 no toca esquema; `python backend/database.py` corre 2 veces seguidas sin error · Done: sin error.
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl y shape verificado: `/api/cross` (matriz, preset, `cell_x/cell_y`, 400/404), `/api/table/cross_cells` · Done: respuestas con el shape del plan §3/§7.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la pestaña (desktop y 360 px) · Done: consola limpia.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (T-F6…T-F23).
- [ ] T-F6 · **CA-1 (CA del cliente)**: pedir `GET /api/cross` para 5 pares de dimensiones de partición (p. ej. tramo×origen, cuarto×tipo, sede×rival, origen×tipo, clutch×cuarto); en cada respuesta sumar `cells[*].n`, `cells[*].counts.own.pts`, `fga2+fga3`, `fta` y comparar con `grand_total` y con `check`; comparar `grand_total.n` con `possessions_counted` del equipo (`GET /api/metrics/team?id=CNF`, mismo contexto) · Done: igualdad exacta registrada; `check.ok == true`.
- [ ] T-F7 · **CA-2**: script ad hoc (`app.test_client()`) que recorre los 45 pares de las 10 dimensiones del cliente y valida `check.ok`; para pares con `jugador`, comprobar `multiplicity.found == multiplicity.expected` · Done: 45/45 pares válidos; resultado registrado.
- [ ] T-F8 · **CA-3**: en una matriz de partición, sumar a mano una fila y una columna y compararlas con `row_totals`/`col_totals`; sumar `row_totals` y comparar con `grand_total` · Done: coinciden.
- [ ] T-F9 · **CA-4**: localizar una celda con `n < 15` (p. ej. tramo `tardio` × `pr`) y comprobar `sample.level == "baja"`, `ranked == false`, `pct == null` y gris en pantalla; comprobar que su valor no cambia el percentil de otra celda (recalcular un percentil excluyéndola) · Done: confirmado.
- [ ] T-F10 · **CA-5**: comparar `sample.n` de 3 celdas con su `n` y con el conteo manual de posesiones del partido (`GET /api/game/<id>/possessions`, A-01) · Done: coincide.
- [ ] T-F11 · **CA-6**: para el cruce tramo × origen, pedir `GET /api/cross` de cada equipo de la población, tomar la misma celda, calcular a mano el percentil con la fórmula de T-01 (excluye al propio equipo y a celdas BAJA) y comparar con `pct` del equipo analizado · Done: coincide en al menos 2 celdas.
- [ ] T-F12 · **CA-7**: pedir `dim_y=quinteto` y comprobar `color.basis == "matriz"`, la leyenda "percentil dentro de esta matriz" y que el percentil de una celda coincide con su posición entre las celdas válidas · Done: confirmado.
- [ ] T-F13 · **CA-8**: con `side=defensa&metric=ppp`, comprobar que la celda de menor PPP concedido tiene el mayor `pct`; con `side=ataque&metric=to_pct`, que la de menor TO% tiene el mayor `pct` · Done: confirmado.
- [ ] T-F14 · **CA-9**: comprobar una celda vacía (`value: null`, `reason: "sin_intentos"`, sin color), `metric=or_pct&dim_x=oportunidad` (todas `no_aplica`) y un equipo sin pbp (404 `sin_pbp`) · Done: razones correctas; "—" sin color en pantalla.
- [ ] T-F15 · **CA-10**: pedir `dim_x=oportunidad&dim_y=cuarto`; comparar `grand_total.n` con (posesiones completas + rebotes ofensivos propios en posesiones completas) y la columna `segunda` con `second_chances` de `GET /api/second-chance?team=CNF` (A-04) · Done: coincide.
- [ ] T-F16 · **CA-11**: comparar `excluded.incomplete` con `incomplete` de `GET /api/possessions/reconcile` (A-01) para el equipo · Done: coincide.
- [ ] T-F17 · **CA-12**: elegir cada uno de los 6 cruces; comprobar dimensiones/lado/métrica aplicados, `check.ok` y que se puede cambiar una dimensión sin volver a elegir el equipo · Done: 6/6 verificados en el navegador.
- [ ] T-F18 · **CA-13**: en el navegador, cambiar la métrica y pulsar "⇄ Intercambiar ejes" con las herramientas de red abiertas · Done: no hay recarga de documento; solo llamadas `/api/cross`; el equipo, el lado y el contexto se conservan.
- [ ] T-F19 · **CA-14**: aplicar `last=5` en la barra T-03 y comprobar `context.games_used == 5`; recargar la URL y comprobar que la vista es idéntica · Done: confirmado.
- [ ] T-F20 · **CA-15**: abrir el detalle de una celda y comparar los grupos con `GET /api/metrics/team?id=CNF` · Done: mismos grupos y claves, sin huecos.
- [ ] T-F21 · **CA-16**: exportar la matriz a CSV y XLSX y comprobar valores, totales y cabecera (equipo, competencia, filtros, lado, dimensiones, métrica, base de color) · Done: reproduce la pantalla.
- [ ] T-F22 · **CA-17**: comparar la fila `cierre` de `dim_y=clutch` con `GET /api/clutch/CNF` (Cierres, C-06) para el mismo `margin` y ventana: partidos calificados y que las posesiones de `cierre` caen dentro de la ventana de esos partidos · Done: coincide.
- [ ] T-F23 · **CA-18**: medir `GET /api/cross` en frío (tras reiniciar) y en caliente (`curl -w "%{time_total}"`) sobre los 13 partidos, con `color=competencia` · Done: < 5 s en frío y < 1,5 s en caliente; si no, anotar y aplicar la degradación del plan §10.

## Matriz de cobertura

| CA | Tareas |
|---|---|
| CA-1 | T-A1, T-B1, T-B4, T-F6 |
| CA-2 | T-A4, T-B4, T-F7 |
| CA-3 | T-B4, T-F8 |
| CA-4 | T-B2, T-B3, T-D1, T-F9 |
| CA-5 | T-B2, T-D1, T-F10 |
| CA-6 | T-B3, T-F11 |
| CA-7 | T-B3, T-D1, T-F12 |
| CA-8 | T-B3, T-F13 |
| CA-9 | T-A1, T-B8, T-D1, T-E1, T-F14 |
| CA-10 | T-A4, T-B1, T-F15 |
| CA-11 | T-A5, T-B1, T-F16 |
| CA-12 | T-B5, T-D2, T-F17 |
| CA-13 | T-D2, T-F18 |
| CA-14 | T-B8, T-D2, T-F19 |
| CA-15 | T-B6, T-D3, T-F20 |
| CA-16 | T-B7, T-D3, T-F21 |
| CA-17 | T-A3, T-F22 |
| CA-18 | T-B1, T-B3, T-F23 |

## Dependencias externas
- **Requisitos previos implementados:** A-01 (`team_possessions`, `ppp_stats`, `game_possessions`), A-02 (`origin`), A-03 (`ptype`), A-04 (`Chance`), A-05 (`shots[].band`), T-02, T-03, T-01, T-05, T-06, X-01, C-06 y F-13 (config de cierres), F-11 (`repository`, `cache`).
- **A-07:** el parámetro `include_incomplete` de `team_possessions` lo agrega A-07 (orden 06 de la fase); si A-06 se implementa antes, lo agrega T-A5 con el mismo contrato.
- **Reimportación/reproceso:** los 13 partidos del seed deben estar reprocesados con ingesta v2 (el tramo de reloj y la clasificación de posesiones dependen de coordenadas, `previous_action` y `qualifiers`).
- **Variables de entorno:** ninguna nueva.
- **Datos de verificación (R-05):** al menos 3 equipos con ≥ `sample.team.min` partidos (percentil frente a la competencia, CA-6) y un partido con prórroga (dimensión `cuarto`=`pr` y `clutch`); documentar cualquier inyección controlada.
- **Docs a actualizar al cierre:** `docs/api.md`, `docs/metrics.md`, `docs/frontend.md`, `docs/architecture.md`.
