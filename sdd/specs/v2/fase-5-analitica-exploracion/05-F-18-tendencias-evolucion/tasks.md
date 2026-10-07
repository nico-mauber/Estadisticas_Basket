# Tasks — F-18: Tendencias y evolución configurable

> **ID:** F-18 · **Prioridad:** P2 · **Fase y orden:** 5·05
> **Depende de:** T-05 · T-06 · T-03 · T-02 · T-04 (y T-01, F-13, C-11, X-01, F-06) — ver `plan.md` §10
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

Convenciones de verificación (Constitución 8: sin suite automatizada): `curl` contra `http://localhost:5000/api/...`, recorrido en el navegador o verificación ad hoc con `app.test_client()` / imports
directos en un script descartable (no se commitea). Dataset: los 13 partidos del seed **reprocesados con ingesta v2** (F-11); para la prueba de significancia y los hitos hace falta un equipo con ≥ 8 partidos
(si el seed no alcanza, una competencia adicional o inyección controlada documentada en `progress.md`, R-05) y un partido DNP de jugador y una ausencia de jugador clave (idem).

## Orden de ejecución

### Grupo A — Backend: configuración y estadística
- [ ] T-A1 [P] · Agregar a `CONFIG_SPEC` `trends.default_ma` (enum 3|5|10, 5), `trends.last_n` (int 5, 2–20), `trends.alpha` (float 0,05, 0,01–0,2), `trends.key_players` (int 5, 1–10), `trends.streak_min` (int 3, 2–10), sección Preferencias · `backend/config.py` · cubre RF-18 · Done: `GET /api/settings` lista las cinco claves con default y rango; `config.get("trends.alpha") == 0.05`.
- [ ] T-A2 [P] · Implementar `welch_t_test(a, b)` con `_betacf`/`_betainc` (Python puro, varianza nula y `n < 2` como casos borde) · `backend/stats_engine.py` · cubre RF-7, RF-8 · Done: `t = 2,0, df = 10` ⇒ `p ≈ 0,0734` y `t = 1,0, df = 5` ⇒ `p ≈ 0,3632` (± 0,0005, comparando con tablas t); con dos listas constantes iguales `p == 1,0`; con `n1 = 1` devuelve `reason: "muestra_insuficiente"`.

### Grupo B — Backend: serie, tendencia, hitos y ruta
- [ ] T-B1 · Implementar `_game_table` (series por partido desde `load_game_bundles`, `compute_standard` + `apply_base` de todas las claves, resultado/margen, `played`, `sample` de quinteto, completar partidos sin el quinteto con `sin_datos`) con caché `trends:games` · `backend/trends.py` · cubre RF-1, RF-14, RF-15, RF-16 · Done: para un equipo del seed devuelve un registro por partido en orden de fecha; el valor de `oer` coincide con el del `game_log` de `GET /api/team/<code>`; un DNP de jugador tiene `values` nulos con razón `dnp`.
- [ ] T-B2 · Implementar `_assign_axes` (familias `pct`/`ratio`/`count`) y la validación de `metrics` (1–3, claves del catálogo, máximo dos escalas) · `backend/trends.py` · cubre RF-1, RF-2 · Done: `[oer, der, efg_pct]` → `y` = ratio/pct según la primera, `y2` = la otra familia; `[pts, efg_pct, oer]` lanza el error 400 de escalas.
- [ ] T-B3 · Implementar `_moving_average` (últimos *k* valores válidos, `k ∈ {0,3,5,10}`) y `trend_series` (series, referencia vía `population.league_reference`, `margin` desde `plus_minus`) · `backend/trends.py` · cubre RF-4, RF-5, RF-6 · Done: con `ma=5` y 10 valores válidos los primeros 4 `ma` son `null` y el quinto es el promedio de los 5 primeros; con un hueco en la ventana, la ventana toma valores válidos; la referencia de `oer` coincide con la ficha de T-01.
- [ ] T-B4 · Implementar `recent_vs_rest` (grupos por valores válidos, `sum_bundles` + `compute_standard` por grupo, delta pooled, orientación, `welch_t_test`, `significance`, `verdict`, `sample_level`, forzado a base `partido` con `base_used`) · `backend/trends.py` · cubre RF-7, RF-8 · Done: con `last_n=5` el delta de `efg_pct` = `efg(últimos 5) − efg(resto)` calculado sumando conteos; con un grupo < 3 partidos devuelve `reason: "muestra_insuficiente"`; con `der` (lower) una baja significativa da `verdict: "mejora"`.
- [ ] T-B5 · Implementar hitos: `_streak_milestones` (cortes de racha ≥ `streak_min`), `_key_players` (top por minutos, excluye al jugador de la entidad) y `_absence_milestones` (dentro del rango de actividad) · `backend/trends.py` · cubre RF-9, RF-10 · Done: una racha de 4 victorias cortada produce `Fin de racha de 4 victorias` en el partido de la derrota y con `streak_min=5` desaparece; un jugador clave ausente en el medio de su rango produce `Ausente: <nombre>`; antes de su primer partido no.
- [ ] T-B6 · Implementar `trends_report` (orquestador: `context_echo`, `presets`, `defaults`, `key_players`) y la ruta `GET /api/trends` con validación de `entity`/`id`/`metrics`/`ma`/`last_n`, `parse_context`, `parse_base` y errores 400/404 · `backend/trends.py`, `backend/app.py` · cubre RF-1, RF-11, RF-14 · Done: `curl "http://localhost:5000/api/trends?entity=team&id=CNF&metrics=oer,der&ma=5&competition=<id>"` → 200 con el shape del plan §3; `metrics=a,b,c,d` → 400; `entity=lineup&id=<id>` y `entity=player&id=<pid>` devuelven el mismo shape.

### Grupo C — Frontend: api.js
- [ ] T-C1 · Agregar `api.trends(params)` · `frontend/js/api.js` · cubre RF-1 · Done: `api.trends({entity:"team", id:"CNF", metrics:"oer,der"})` en la consola devuelve el JSON de T-B6.

### Grupo D — Frontend: gráficos y componente
- [ ] T-D1 · Agregar `drawTrend` (hasta 3 series crudas + media móvil punteada + referencia + ejes `y`/`y2` + puntos huecos de muestra baja + huecos por nulo) y `drawMargin` (barras por resultado, línea de cero) a `charts.js` · `frontend/js/charts.js` · cubre RF-2, RF-4, RF-5, RF-6, RF-15, RF-16 · Done: renderizado con el JSON de T-B6 sin errores; el DNP queda como hueco con tooltip "No jugó (DNP)"; las barras de victoria son verdes y las de derrota rojas.
- [ ] T-D2 · Agregar el plugin `milestonesPlugin` (líneas verticales de hitos, marcas "L"/"V" bajo el eje, tooltip con el detalle del hito) · `frontend/js/charts.js` · cubre RF-9, RF-10 · Done: un hito de racha y uno de ausencia se ven sobre el eje con su detalle en el tooltip.
- [ ] T-D3 · Crear `components/trend-chart.js`: selector de hasta 3 métricas agrupadas por catálogo con validación de escalas, chips de pares, media móvil (3/5/10/sin), N, interruptores, tarjetas de tendencia, lista de hitos (móvil), recarga sin recargar la página (`_renderSeq`), estado en el hash (`tm`, `ma`, `tn`) · `frontend/js/components/trend-chart.js` · cubre RF-1, RF-2, RF-3, RF-7, RF-8, RF-11, RF-12 · Done: cambiar métrica/media/N redibuja con una sola llamada a `/api/trends` y sin recarga del documento (pestaña Network); elegir tres escalas distintas muestra el aviso.
- [ ] T-D4 · Integrar la exportación: `exportMenu` con `getNode` (ambos canvas) y `getData` (meta + una fila por partido con valor y media móvil por serie) · `frontend/js/components/trend-chart.js` · cubre RF-17 · Done: PNG con gráficos y cabecera; CSV con una fila por partido.
- [ ] T-D5 · Montar el componente en S3 `gamelog` (equipo), S4 `tendencias` (jugador) y S3 `quintetos` → "Evolución del quinteto" (con `?lineup=<id>`) · `frontend/js/views/equipo.js`, `frontend/js/views/jugador.js` · cubre RF-11, RF-13 · Done: las tres entidades usan el mismo componente; el contexto T-03 recarga el gráfico (`onContextChange`).
- [ ] T-D6 · Retirar `drawEvolution` y `drawPlayerEvolution` y sus llamadas/cards "Evolución por partido" una vez migradas las vistas · `frontend/js/charts.js`, `frontend/js/app.js` · cubre RF-13 · Done: `grep -n "drawEvolution\|drawPlayerEvolution" frontend/js` no devuelve resultados; el resto de gráficos (`drawRadar`, `drawCompareRadar`, `drawLeagueScatter`) funciona.
- [ ] T-D7 [P] · Estilos `/* ── trend-chart (F-18) ── */` (selector, chips, tarjetas, lista de hitos, mobile) · `frontend/css/style.css` · cubre RF-1…RF-9 · Done: a 360 px no hay scroll horizontal de página.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/vacío/error/offline y avisos con el copy de la spec §6 (incluye "Elegí hasta tres métricas.", "Muestra insuficiente…", "No hay partidos para graficar.") · `frontend/js/components/trend-chart.js` · cubre RF-8, RF-15 · Done: sin red se ve "Sin conexión: la evolución necesita conexión."; una entidad sin partidos muestra el vacío; un 400 muestra el mensaje del backend.
- [ ] T-E2 · Sumar `js/components/trend-chart.js` a `STATIC` y subir `CACHE` en `sw.js` (solo si X-01 no migró a runtime caching; si migró, registrar "sin cambios") · `frontend/sw.js` · cubre — · Done: con la app instalada y sin red, la pestaña abre el esqueleto y no falla la carga del módulo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`) · Done: arranque limpio, `import trends` sin error.
- [ ] T-F2 · Esquema: F-18 no toca esquema; `python backend/database.py` corre 2 veces seguidas sin error · Done: sin error.
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl y shape verificado: `/api/trends` para `team`, `player` (con DNP) y `lineup`, con y sin contexto/base, 400/404 · Done: respuestas con el shape del plan §3.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer S3 Game log, S4 Tendencias y S3 Quintetos (desktop y 360 px) · Done: consola limpia.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md` (T-F6…T-F26).
- [ ] T-F6 · **Prueba de Welch (verificación numérica)**: script ad hoc que compara `welch_t_test` con un cálculo manual de `t`, `df` y `p` (con la tabla t o `math`/fórmula de la beta incompleta) para 3 pares de listas (n = 5 vs 12; varianzas distintas; dos listas iguales) · Done: coincide a 3 decimales; registrar.
- [ ] T-F7 · **CA-1 (CA del cliente)**: en el navegador, abrir la evolución de un equipo, un jugador y un quinteto; comprobar que usan el mismo componente (misma estructura DOM/clase `trend-chart`) y, con la pestaña Network abierta, cambiar una métrica, la media móvil y N · Done: no hay recarga de documento; solo llamadas `/api/trends`; entidad, contexto y base se conservan.
- [ ] T-F8 · **CA-2**: elegir `oer`, `der`, `efg_pct` y verificar `axes` (dos familias, `y` e `y2`); elegir `pts`, `efg_pct`, `oer` y verificar el aviso en la UI y el 400 de la API (`curl`) · Done: confirmado.
- [ ] T-F9 · **CA-3**: para cada clave del catálogo aplicable a `team` (`GET /api/metrics-catalog`), pedir `GET /api/trends?entity=team&id=CNF&metrics=<clave>`; para `uso_pct` comprobar serie nula con razón `no_aplica` · Done: 100 % de las claves responden 200 (valores o nulos con razón).
- [ ] T-F10 · **CA-4**: aplicar los tres pares preconfigurados y comprobar las métricas graficadas; modificar una después · Done: confirmado.
- [ ] T-F11 · **CA-5**: comparar 3 valores de `oer` de la serie con el `game_log` de `GET /api/team/<code>` y con la tabla `team_game_log` (T-06) · Done: coinciden.
- [ ] T-F12 · **CA-6**: verificar 3 barras de `margin` (equipo: `pts − opp_pts` del game log; color por `W`/`L`); para un jugador, `plus_minus` del `player_game_log`; para un quinteto, `pts − pts_against` del partido en `GET /api/lineup/<team>?players=…` filtrado por partido (script ad hoc) · Done: coinciden; línea de cero visible.
- [ ] T-F13 · **CA-7**: con `ma=5`, comparar los `ma` de `series[0].points` con el promedio manual de los últimos 5 valores válidos; probar `ma=0` y un jugador con DNP en la ventana · Done: coincide.
- [ ] T-F14 · **CA-8**: con `last_n=5`, sumar los conteos de `efg_pct` (fgm, fgm3, fga) de los últimos 5 partidos y del resto desde el game log y recalcular `delta` y `delta_rel` · Done: coincide con `trend[*].delta`/`delta_rel`.
- [ ] T-F15 · **CA-9**: con los valores por partido de ambos grupos (copiados del response), recalcular `t`, `df`, `p` a mano (T-F6) y comparar con `trend[*].test`; con `last_n=2` en una selección chica comprobar `reason: "muestra_insuficiente"` · Done: coincide.
- [ ] T-F16 · **CA-10**: con `der` (lower), localizar o construir (inyección controlada documentada) un caso con baja significativa y comprobar `verdict: "mejora"` y `delta_oriented > 0`; con una métrica neutral (p. ej. `pace`) comprobar `verdict: "cambio"` o `sin_cambio_significativo` · Done: confirmado.
- [ ] T-F17 · **CA-11**: localizar la racha más larga del equipo en el game log, comprobar el hito `streak_end` en el partido que la corta y que con `streak_min=<largo+1>` (cambiando la configuración) desaparece · Done: confirmado; restaurar la configuración.
- [ ] T-F18 · **CA-12**: comparar la marca L/V de 5 partidos con `home_away` del game log · Done: coincide.
- [ ] T-F19 · **CA-13**: listar los `key_players` (top por minutos de `GET /api/players/<team>`), identificar en el `player_game_log` un partido dentro de su rango en que no jugó y comprobar el hito `Ausente`; probar `key_players=1` y un partido anterior a su primer partido · Done: confirmado; restaurar la configuración.
- [ ] T-F20 · **CA-14**: para un jugador con DNP, comprobar hueco (sin punto), tooltip "No jugó (DNP)", `points[*].reason = "dnp"` y que la `ma` lo salta; comprobar que ningún valor nulo se dibuja en 0 · Done: confirmado.
- [ ] T-F21 · **CA-15**: para un quinteto que no jugó en algunos partidos, comprobar `reason: "sin_datos"` y, en un partido con pocas posesiones, `games[*].sample.level == "baja"` y punto hueco · Done: confirmado.
- [ ] T-F22 · **CA-16**: con `venue=local` comprobar que solo hay partidos `L` y `context.games_used`; con `base=por100` comparar un conteo (`tov`) de un partido con `apply_base` (conteo × 100 / posesiones) · Done: coincide.
- [ ] T-F23 · **CA-17**: comparar `series[oer].reference.value` con la ficha/promedio de liga de T-01 (`GET /api/league`/`GET /api/rankings/team/oer`) y comprobar `sin_universo` en el quinteto · Done: coincide.
- [ ] T-F24 · **CA-18**: exportar a PNG (desktop e iOS/Safari si hay dispositivo; R-09) y CSV; comprobar que el PNG incluye series, media móvil, hitos y cabecera, y que el CSV tiene una fila por partido con valor y `ma` por serie · Done: confirmado; si falla en iOS, registrar el fallback a PDF.
- [ ] T-F25 · **CA-19 y CA-20**: poner `trends.default_ma=10` y `trends.last_n=8` en F-13 y abrir la evolución (arranca con 10 y 8); verificar que `drawEvolution`/`drawPlayerEvolution` no existen (`grep`) y que Equipo y Jugador usan el componente · Done: confirmado; restaurar la configuración.
- [ ] T-F26 · **CA-21**: medir `GET /api/trends` (3 métricas) en frío (tras reiniciar) y en caliente (`curl -w "%{time_total}"`) para team, player y lineup · Done: < 3 s en frío y < 1 s en caliente; si no, anotar y revisar el plan §10.

## Matriz de cobertura

| CA | Tareas |
|---|---|
| CA-1 | T-B6, T-D3, T-D5, T-F7 |
| CA-2 | T-B2, T-D3, T-F8 |
| CA-3 | T-B1, T-B3, T-F9 |
| CA-4 | T-B6, T-D3, T-F10 |
| CA-5 | T-B1, T-F11 |
| CA-6 | T-B3, T-D1, T-F12 |
| CA-7 | T-B3, T-F13 |
| CA-8 | T-B4, T-F14 |
| CA-9 | T-A2, T-B4, T-F6, T-F15 |
| CA-10 | T-B4, T-F16 |
| CA-11 | T-A1, T-B5, T-D2, T-F17 |
| CA-12 | T-B1, T-D2, T-F18 |
| CA-13 | T-A1, T-B5, T-D2, T-F19 |
| CA-14 | T-B1, T-B3, T-D1, T-E1, T-F20 |
| CA-15 | T-B1, T-D1, T-F21 |
| CA-16 | T-B1, T-B6, T-F22 |
| CA-17 | T-B3, T-F23 |
| CA-18 | T-D4, T-F24 |
| CA-19 | T-A1, T-D3, T-F25 |
| CA-20 | T-D5, T-D6, T-F25 |
| CA-21 | T-B1, T-B6, T-F26 |

## Dependencias externas
- **Requisitos previos implementados:** T-05 (`compute_standard`, catálogo), T-06 (`load_game_bundles`, `sum_bundles`, `export-menu.js`, `exporters.js`), T-04 (`apply_base`), T-03 (contexto), T-02 (`sample.py`), T-01 (`league_reference`), F-13 (`CONFIG_SPEC`), F-06 (loader `lineup` y enlace `?lineup=`), F-11 (`repository`, `cache`), C-11 y X-01.
- **Reimportación/reproceso:** los 13 partidos del seed reprocesados con ingesta v2 (`plus_minus` de jugador, pbp para el quinteto).
- **Variables de entorno:** ninguna nueva.
- **Datos de verificación (R-05):** un equipo con ≥ 8 partidos, una racha ≥ 3 resultados iguales cortada, un jugador con DNP, una ausencia de jugador clave y un quinteto que no jugó en algunos partidos; documentar cualquier inyección controlada en `progress.md`.
- **Dispositivo:** Safari/iOS para la verificación de exportación PNG por `foreignObject` (R-09); si no hay, queda como riesgo anotado.
- **Docs a actualizar al cierre:** `docs/api.md`, `docs/metrics.md`, `docs/frontend.md` (incluye retirar `drawEvolution`/`drawPlayerEvolution` de la tabla de charts), `docs/architecture.md`.
