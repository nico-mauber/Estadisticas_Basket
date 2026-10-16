# Tasks — A-11: Impacto ajustado (RAPM)

> **ID:** A-11 · **Prioridad:** P2 · **Fase y orden:** 5·11
> **Depende de:** A-01 · T-02 · F-07 (y F-13, F-11, C-08, T-01, T-05, T-06, X-01) — ver `plan.md` §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

Convenciones de verificación (Constitución 8: sin suite automatizada): `curl` contra `http://localhost:5000/api/...` o verificación ad hoc con `app.test_client()` /
imports directos de `rapm.py` en un script descartable (no se commitea). Dataset: los 13 partidos del seed **reprocesados con ingesta v2** (F-11) y, para la
medición de rendimiento y la dominancia con datos suficientes, una competencia más grande si existe (o la unión de copias del seed bajo una segunda competencia,
inyección controlada documentada en `progress.md`, R-05). Con 13 partidos y `rapm.folds = 5` se cumple `2·folds = 10`.

## Orden de ejecución

### Grupo A — Backend: configuración, stints y helpers
- [ ] T-A1 [P] · Agregar `rapm.lambdas` (json lista, `[500,1000,2000,4000,8000]`, 1–10 valores en 1–100 000) y `rapm.folds` (int 5, 2–10) a `CONFIG_SPEC`, sección Umbrales · `backend/config.py` · cubre RF-4 · Done: `GET /api/settings` lista las dos claves con default y rango; `config.get("rapm.folds") == 5`.
- [ ] T-A2 [P] · Agregar `weighted_mean` y `spearman` (rangos con empates por promedio) como helpers puros · `backend/stats_engine.py` · cubre RF-10 · Done: `spearman([1,2,3],[1,2,3]) == 1.0`, `spearman([1,2,3],[3,2,1]) == -1.0`, con empates verificado a mano.
- [ ] T-A3 · Implementar `matchups.stints(comp_id, ctx)` con las posesiones completas de A-01, `home_on`/`away_on` ids, `game_id`, resumen de exclusiones y `lineup_changed`, caché `matchups:stints` · `backend/matchups.py` · cubre RF-1, RF-2, RF-5, RF-18 · Done: `Σ(poss_home + poss_away) + incompletas + sin_quinteto = Σ posesiones de A-01` de la competencia; todos los stints tienen 5 + 5 `player_id` y `poss_home + poss_away > 0`.

### Grupo B — Backend: núcleo numérico, publicación, rutas y tabla
- [ ] T-B1 · Implementar `_design(stints)`: índice de jugadores, filas (10 columnas activas), `y = 100·pts/poss`, `w = poss`, `mu` ponderado y estado `datos_insuficientes` por `sin_stints` · `backend/rapm.py` · cubre RF-1, RF-2, RF-5 · Done: `Σ w` = posesiones usadas; `mu` = PPP ponderado ×100 de la competencia (± 0,1) y 2·P columnas.
- [ ] T-B2 · Implementar `_normal_equations` (A dispersa, `Sy`, `S1`), asignación determinista de pliegues por partido (`sorted(game_ids)` módulo `rapm.folds`) y `A_train(k)`/`b_train(k)` por resta · `backend/rapm.py` · cubre RF-4 · Done: `A_train(k) + A_fold(k)` reconstruye `A` entrada por entrada (script ad hoc); cada partido pertenece a un solo pliegue.
- [ ] T-B3 · Implementar `_cg_solve` (CG precondicionado Jacobi, arranque en caliente, `deadline`, `RapmTimeout`) · `backend/rapm.py` · cubre RF-1, RF-16 · Done: sobre un sistema sintético de 6 incógnitas coincide con la solución exacta (eliminación gaussiana en un script) con error relativo < 1e-6; con `deadline` en el pasado lanza `RapmTimeout`.
- [ ] T-B4 · Implementar `_cross_validate` (error ponderado por pliegue, `cv`, `cv_baseline`, elección de λ con empate → mayor, advertencias `lambda_en_el_borde` y `sin_mejora_vs_modelo_vacio`) · `backend/rapm.py` · cubre RF-4, RF-12, RF-15 · Done: `cv` tiene una entrada por λ de la grilla; `lambda` = argmin; con grilla de un solo valor no hay `lambda_en_el_borde`.
- [ ] T-B5 · Implementar `_publish` (off/def/total con signo orientado, posesiones por lado, minutos/partidos desde `repository.player_game_rows`, `onoff_net` crudo, `sample_level("player")`, fichas T-01 con población ranked, nulos con razón) · `backend/rapm.py` · cubre RF-3, RF-7, RF-8, RF-9, RF-11, RF-20 · Done: `total = round(off + def, 2)` ± 0,01 para todos; jugador de muestra baja con valores pero `ranked = false` y sin `rank`/`percentile`; todo jugador con valores trae `possessions`.
- [ ] T-B6 · Implementar `_diagnostics` (dominancia top 10 vs p25, Spearman, `compare_unregularized` con λ_min/100) · `backend/rapm.py` · cubre RF-10 · Done: `diagnostics.dominance` y `compare_unregularized` presentes con los campos del plan §3; `ok` coincide con el cálculo manual.
- [ ] T-B7 · Implementar `rapm(comp_id, ctx)` (validación `2·folds` partidos, tiempo máximo, almacenamiento `_RESULTS` con versiones, LRU 4) y `rapm_cached(comp_id)` (`sin_calcular`, `stale`) · `backend/rapm.py` · cubre RF-13, RF-14, RF-16, RF-17 · Done: `rapm_cached` sin cálculo devuelve `status: "sin_calcular"` en < 1 s; tras `rapm()` devuelve `listo` y `stale: false`; tras `cache.bump_data_version("test")` devuelve `stale: true` con el mismo payload.
- [ ] T-B8 · Agregar `GET /api/rapm` (lee, `player`/`top`/`diagnostics`, errores 400/404) y `POST /api/rapm/recompute` (`admin_required`, 403/502) · `backend/app.py` · cubre RF-6, RF-13, RF-14, RF-16 · Done: `curl "http://localhost:5000/api/rapm?competition=<id>"` → 200 `sin_calcular` (sin cálculo); `curl -X POST -H "Content-Type: application/json" -d '{"competition": <id>}' http://localhost:5000/api/rapm/recompute` → 200 `listo`; sin `competition` → 400.
- [ ] T-B9 · Registrar la tabla `rapm` (`table_rows` con `extra` `_rapm_*` y `_onoff_net`, `default_sort`, `totals_mode="none"`, `avg_mode="none"`, metadatos de exportación) · `backend/tables.py`, `backend/rapm.py` · cubre RF-19 · Done: `GET /api/table/rapm?competition=<id>` devuelve payload §7.6 (con filas tras calcular; `rows: []` y `meta.status = "sin_calcular"` antes).
- [ ] T-B10 **(condicional: solo si CA-16 supera 30 s y el humano aprueba)** · Agregar `numpy` a `backend/requirements.txt`, import protegido y `_solve_numpy` (resolución densa por λ y pliegue) detrás del mismo contrato de `_cg_solve`, con la justificación medida en `progress.md` · `backend/requirements.txt`, `backend/rapm.py` · cubre RF-16 · Done: mismos resultados que Python puro (diferencia máxima < 1e-3 en `off`/`def`) y tiempo < 30 s; sin `numpy` instalado el módulo sigue funcionando con Python puro.

### Grupo C — Frontend: api.js
- [ ] T-C1 · Agregar `api.rapm(params)` y `api.rapmRecompute(body)` · `frontend/js/api.js` · cubre RF-13, RF-14 · Done: en la consola `api.rapm({competition: <id>})` devuelve el JSON de T-B8; `api.rapmRecompute({competition: <id>})` devuelve `listo` (administrador).

### Grupo D — Frontend: UI
- [ ] T-D1 · Crear `components/rapm-panel.js`: estados (`sin_calcular`, `datos_insuficientes`, `listo`, `stale`), tarjeta con barras ofensivo/defensivo/total, posesiones/minutos/partidos y badge siempre visibles, `onoff_net`, ficha T-01, advertencias, ranking colapsable con `data-table`, detalles del modelo y verificación del ranking · `frontend/js/components/rapm-panel.js` · cubre RF-7…RF-15, RF-20 · Done: render con el JSON de T-B8 sin errores de consola; ninguna barra de impacto aparece sin su línea de posesiones; nulos "—" con `title`.
- [ ] T-D2 · Montar el panel en la pestaña `impacto` de S4 con `api.rapm({competition, player})`, botón "Calcular/Recalcular" solo para administradores (`api.me().is_admin`), progreso "Calculando…" y recarga · `frontend/js/views/jugador.js` · cubre RF-1, RF-13, RF-14, RF-19 · Done: `#/jugador/<id>/impacto` muestra la tarjeta; un administrador pulsa "Calcular impacto ajustado" y el bloque se completa; un no administrador ve "Pedile a un administrador que lo calcule.".
- [ ] T-D3 [P] · Estilos `/* ── rapm (A-11) ── */` (barras centradas en 0, banner, detalles del modelo, mobile) · `frontend/css/style.css` · cubre RF-7 · Done: a 360 px no hay scroll horizontal de página.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/vacío/error/offline y mensajes 403/502 con el copy de la spec §6 · `frontend/js/components/rapm-panel.js`, `frontend/js/views/jugador.js` · cubre RF-16 · Done: sin red se ve "Sin conexión: el impacto ajustado necesita conexión."; un 502 simulado (grilla enorme) muestra el mensaje de tiempo máximo; un 403 muestra el aviso de administrador.
- [ ] T-E2 · Sumar `js/components/rapm-panel.js` a `STATIC` y subir `CACHE` en `sw.js` (solo si X-01 no migró a runtime caching; si migró, registrar "sin cambios") · `frontend/sw.js` · cubre — · Done: con la app instalada y sin red, la pestaña abre el esqueleto y no falla la carga del módulo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`) · Done: arranque limpio, `import rapm` sin error.
- [ ] T-F2 · Esquema: A-11 no toca esquema; `python backend/database.py` corre 2 veces seguidas sin error y no aparecen tablas/columnas de RAPM · Done: sin error; `sqlite3 .tables` sin tablas nuevas de impacto.
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl y shape verificado: `GET /api/rapm` (sin cálculo, listo, `player`, 400/404), `POST /api/rapm/recompute` (200, 403 con `ADMIN_USERS`, 502 simulado), `GET /api/table/rapm` · Done: respuestas con el shape del plan §3.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer S4 Impacto (administrador y no administrador; desktop y 360 px) · Done: consola limpia.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (T-F6…T-F26).
- [ ] T-F6 · **Solver (verificación numérica previa)**: script ad hoc que arma 12 observaciones sintéticas con 4 jugadores, calcula `β` con `_cg_solve` y con eliminación gaussiana sobre `A + λI`, y compara; repetir con λ = 1 y 8000 · Done: diferencia máxima < 1e-6; registrar en `progress.md`.
- [ ] T-F7 · **CA-1 (CA del cliente)**: tras calcular, leer `diagnostics.dominance` de `GET /api/rapm`; verificar a mano que `top_min_possessions ≥ p25_possessions` (ordenar `players` por `total` entre `ranked`, tomar los 10 primeros, calcular p25 de `possessions` de todos los `ranked`) · Done: `ok == true`; si es `false`, anotar y aplicar el plan §10 (subir λ mínimo de la grilla).
- [ ] T-F8 · **CA-2**: leer `diagnostics.compare_unregularized`; comprobar `top10_low_sample_chosen ≤ top10_low_sample_unregularized`; recalcular con un script ad hoc (`rapm` internos) el top 10 con λ = λ_min/100 y compararlo · Done: coincide; registrar los números.
- [ ] T-F9 · **CA-3**: leer `cv`, `lambda`, `folds_by_game`; reconstruir los pliegues a mano (`sorted(game_ids)` módulo `rapm.folds`), comprobar que cada partido está en un solo pliegue y que `lambda` es el de menor error (empate → mayor) · Done: coincide.
- [ ] T-F10 · **CA-4**: inspeccionar `GET /api/rapm`, `GET /api/rapm?player=<id>`, `GET /api/table/rapm` y la UI: toda fila/tarjeta con `off`/`def`/`total` trae `possessions` (y `minutes`/`games`) · Done: 0 excepciones.
- [ ] T-F11 · **CA-5**: para 20 jugadores, `round(off + def, 2) == total` (± 0,01) en la respuesta · Done: 20/20.
- [ ] T-F12 · **CA-6**: script ad hoc: reconstruir `β_O = off`, `β_D = −def` por jugador, tomar los stints de `matchups.stints`, calcular el valor predicho de 3 filas (`mu + Σ β_O(atacantes) + Σ β_D(defensores)`) y el error cuadrático ponderado del modelo frente al del modelo vacío (`mu`); verificar que `model.intercept` = PPP ponderado ×100 de la competencia (± 0,1) · Done: error del modelo < error del vacío (en entrenamiento); intercepto coincide.
- [ ] T-F13 · **CA-7**: comparar `model.possessions_used + excluded.incompletas + excluded.sin_quinteto` con `possessions_total` y con el total de `GET /api/possessions/reconcile` (A-01) de la competencia; `coverage = used/total` · Done: igualdad exacta; `incompletas` coincide con A-01.
- [ ] T-F14 · **CA-8**: en el script de T-F12, comprobar que para dos jugadores (uno con `def > 0` y otro con `def < 0`) el coeficiente crudo `β_D` tiene el signo opuesto a `def` publicado · Done: confirmado.
- [ ] T-F15 · **CA-9**: elegir un jugador con menos de `sample.player.min` minutos; verificar en la tarjeta: gris, badge BAJA, `ranked: false`, sin `rank`; y su ausencia en `GET /api/rankings/player/<clave>` y en la lista del ranking de la tabla · Done: confirmado.
- [ ] T-F16 · **CA-10**: pasar el cursor por el impacto total de un jugador con muestra suficiente y comparar puesto, líder, promedio y percentil con la tabla `rapm` ordenada por `_rapm_total` · Done: coincide.
- [ ] T-F17 · **CA-11**: llamar tres veces a `GET /api/rapm` y comprobar el mismo `computed_at` (sin recálculo); importar un partido (o `cache.bump_data_version("test")` en un script) y comprobar `stale: true` con el mismo payload; revisar el esquema de SQLite · Done: sin recálculo; `stale` correcto; sin tablas/columnas nuevas.
- [ ] T-F18 · **CA-12**: con `ADMIN_USERS=<otro>` definida, `POST /api/rapm/recompute` con un usuario no administrador → 403 `requiere_admin`; con el administrador → 200 y `computed_at` nuevo · Done: confirmado (modo `AUTH_USERS` con dos usuarios).
- [ ] T-F19 · **CA-13**: con la caché vacía (reiniciar), medir `GET /api/rapm` (`curl -w "%{time_total}"`) y verificar `status: "sin_calcular"` y que no se disparó cálculo (la CPU no sube; el log no registra resolución) · Done: < 1 s.
- [ ] T-F20 · **CA-14**: con una competencia de menos de `2·folds` partidos con pbp (creada por inyección controlada o con `rapm.folds = 10` sobre la competencia de 13 partidos y una segunda competencia de 3 partidos), `POST /api/rapm/recompute` → `datos_insuficientes` con `games` y `needed` · Done: confirmado; no se calculó.
- [ ] T-F21 · **CA-15**: poner `rapm.lambdas` con 30 valores (rango permitido 1–10 valores: usar `app_config` directo para saltar la validación, solo en la prueba) y, bajando `MAX_SECS` temporalmente a 5 s, comprobar 502 `timeout_externo`, que no se guarda resultado y que otra petición `GET /api/me` responde · Done: confirmado; restaurar `MAX_SECS` y la configuración.
- [ ] T-F22 · **CA-16**: medir el tiempo de `POST /api/rapm/recompute` sobre los 13 partidos y, si existe, sobre la competencia más grande; registrar `duration_s`, `cg.solves`, `cg.iterations_mean` · Done: tiempo registrado; si supera 30 s, ejecutar T-B10 con aprobación y re-medir.
- [ ] T-F23 · **CA-17**: con un jugador de dos grafías de nombre (caso C-08 del seed o inyección controlada), comprobar una sola fila con `possessions` sumadas · Done: confirmado.
- [ ] T-F24 · **CA-18**: para 3 jugadores comparar `onoff_net` con `100 × net_rating` de `GET /api/metrics/player?id=<player_id>` (T-05) · Done: diferencia ≤ 5 puntos por 100; registrar las diferencias observadas.
- [ ] T-F25 · **CA-19**: exportar la tabla `rapm` a CSV y XLSX; comprobar columnas visibles, orden y cabecera con competencia, λ, pliegues, fecha y cobertura · Done: reproduce la tabla.
- [ ] T-F26 · **CA-20**: buscar un jugador con 0 posesiones en stints usados (p. ej. con minutos y todos sus partidos sin quinteto) y comprobar "—" con razón `sin_datos`, ausente del ranking · Done: confirmado (si no existe, inyección controlada documentada).

## Matriz de cobertura

| CA | Tareas |
|---|---|
| CA-1 | T-A2, T-B6, T-F7 |
| CA-2 | T-B6, T-F8 |
| CA-3 | T-A1, T-B2, T-B4, T-F9 |
| CA-4 | T-B5, T-D1, T-B9, T-F10 |
| CA-5 | T-B5, T-F11 |
| CA-6 | T-B1, T-B3, T-F6, T-F12 |
| CA-7 | T-A3, T-B1, T-F13 |
| CA-8 | T-B5, T-F14 |
| CA-9 | T-B5, T-D1, T-F15 |
| CA-10 | T-B5, T-D1, T-F16 |
| CA-11 | T-B7, T-F17 |
| CA-12 | T-B8, T-D2, T-F18 |
| CA-13 | T-B7, T-B8, T-F19 |
| CA-14 | T-B1, T-B7, T-F20 |
| CA-15 | T-B3, T-B8, T-E1, T-F21 |
| CA-16 | T-B3, T-B10 (condicional), T-F22 |
| CA-17 | T-A3, T-F23 |
| CA-18 | T-B5, T-F24 |
| CA-19 | T-B9, T-F25 |
| CA-20 | T-B5, T-D1, T-F26 |

## Dependencias externas
- **Requisitos previos implementados:** A-01 (`game_possessions`, quintetos de ambos equipos por posesión), F-07 (`matchups.py`), T-02 (`sample.py`), F-13 (`config.py`, `CONFIG_SPEC`), F-11 (`auth.admin_required`, `cache`, `repository`), C-08 (`player_id`), T-01, T-05, T-06 y X-01.
- **Reimportación/reproceso:** los 13 partidos del seed reprocesados con ingesta v2 (quintetos, `previous_action`) para que las posesiones de A-01 estén completas.
- **Variables de entorno:** `ADMIN_USERS` (opcional, F-11/DA-18) para probar el 403 de CA-12; con la variable ausente todo usuario autenticado es administrador.
- **Datos de verificación (R-05):** una competencia con ≥ 10 partidos con pbp (el seed cumple), idealmente otra con < 10 (CA-14) y un jugador con dos grafías (CA-17); documentar cualquier inyección controlada en `progress.md`.
- **Decisión pendiente (DA-25):** `numpy` solo si T-F22 supera 30 s; requiere aprobación humana antes de T-B10.
- **Despliegue:** la caché del RAPM es volátil; tras cada despliegue un administrador debe recalcular (`docs/deployment.md`).
- **Docs a actualizar al cierre:** `docs/api.md`, `docs/metrics.md`, `docs/frontend.md`, `docs/architecture.md`, `docs/deployment.md`.
