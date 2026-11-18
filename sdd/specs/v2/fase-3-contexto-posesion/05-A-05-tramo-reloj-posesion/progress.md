# Progress — A-05: Tramo de reloj de posesión

> **Estado:** ✅ Implementado en Equipo (ataque y defensa), Partido y Jugador: tramos del reloj, reloj de 14 s aparte, conciliación, composición de puntos, plantel por tramo, panel de decisión, matriz zona × tramo, entidad `clock` (T-05) y tablas `team_clock` / `zone_clock_matrix` (T-06). Filtros de contexto `clock` / `clock_start` de T-03 en Equipo y Jugador. Filtro del mapa de tiro por tramo y panel por quinteto (2026-11-17).
> **Fecha:** 2026-10-27
> **Origen del pedido:** el cliente marcó como urgente (a) cómo anota cada equipo, en equipo y en partido, con el peso de triples, dobles, tiros libres, pérdidas y asistencias, y (b) la segmentación por tramo del reloj (antes de 8 s, entre 8 y 16 s, más de 16 s) con el % de triples, su cantidad y su peso. Se implementó primero esa parte (partición (a) del plan §10 D-8).

## Estado de tareas
- [x] RF-1 · Reloj de posesión derivado del reloj de partido, documentado en `docs/metrics.md` y visible en pantalla
- [x] RF-2 · Tramo por tiro (`shots[].band`): temprano ≤ 8 s, medio ≤ 16 s, tardío; sin reloj derivable → sin tramo, nunca temprano
- [x] RF-3 · Reloj de 14 s aparte (`r14`), sin tramo tardío; sus tiros no entran en los promedios del reloj de 24 s
- [x] RF-4 · Unidad oportunidad: tramo del evento de decisión (último tiro de campo, pérdida o primer tiro libre)
- [x] RF-5 · Por tramo: tiros, % de los tiros, eFG%, TS%, PPT, PPP, TO%, violaciones de 24 s, reparto T2/T3/TL/pérdida, **peso de los triples** (% de sus tiros, % de los triples del equipo, puntos)
- [x] RF-6 · Conciliación: tiros de los tramos + sin reloj + posesiones incompletas = tiros del box oficial
- [x] RF-7 · Versión defensiva (`side=defensa`)
- [x] RF-8 · Por jugador (tiros, eFG%, PPT, TS%, USO% del tramo y PPP personal; tabla del plantel con fila "Equipo / sin jugador" y vista en Jugador)
- [x] RF-9 · Por quinteto (`?lineup=`, selector en Equipo › Posesión, 2026-11-17)
- [x] RF-10 · Panel de decisión de siete preguntas, con promedio de la competencia por tramo en la pregunta 2
- [x] RF-11 (parcial) · Matriz zona × tramo con intentos, FG%, eFG% y PPT por celda; falta percentil, tooltip de 7 datos de C-03 y exportación T-06
- [x] RF-12 · Filtro del mapa de tiro por tramo (`/api/shot-zones?clock=…&clock_start=…`, 2026-11-17)
- [x] RF-13 · Dimensiones de contexto `clock` / `clock_start` (T-03, 2026-11-17), entidad `clock` y tablas `team_clock` / `zone_clock_matrix`
- [x] RF-15 · `clock.early_max` y `clock.mid_max` activadas en `CONFIG_SPEC`; cambiarlas por `PUT /api/settings` reasigna sin reiniciar
- [x] RF-16 · Denominador 0 → `null` / `sin_intentos`; equipo sin pbp → 404 `sin_pbp`
- [x] Extra pedido por el cliente · **Composición de los puntos**: peso de triples, dobles y tiros libres; pérdidas (cantidad, % de posesiones, puntos perdidos estimados); asistencias (cantidad, % de canastas asistidas, puntos generados de A-12)
- [x] Extra · Modo partido: `GET /api/possession-clock?team=&game=`, pestaña "Reloj y puntos" en Partido con selector de equipo

## Estado de CA (gate de aceptación)
Seed local (13 partidos): `a05_sim.py` 70/70 y `a05_browser.py` 47/47 (1280 y 360 px, sin errores de consola).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | ALB, COL, LAG y MON, ataque y defensa: Σ tiros por tramo (24 s y 14 s) + sin reloj + incompletas = tiros del box. ALB ataque: 117 + 17 + 2 + 0 = 136 |
| CA-2 | ✅ | `band_of`: 8 s temprano, 9 y 16 s medio, 17 s tardío |
| CA-3 | ✅ | `PUT /api/settings clock.early_max=6`: tiros tempranos de ALB 34 → 25, el total sigue conciliado |
| CA-4 | ✅ | reloj de 14 s: 10 s medio, 15 s sin tramo, `r14.tardio` = `null` / `no_aplica` |
| CA-5 | ✅ | tiros sin reloj derivable en `no_clock` y dentro de la conciliación |
| CA-7 | ✅ | el reparto T2/T3/TL/pérdida suma 100 % en cada tramo |
| CA-8 | 🔶 | los tipos de pérdida suman las pérdidas del tramo por construcción; sin test propio |
| CA-9 | 🔶 | defensa y ataque concilian por separado con el box; el cruce A-defensa = B-ataque no se verificó |
| CA-10 | ✅ | `a05b_sim.py`: Σ oportunidades que terminan los jugadores + equipo = oportunidades del equipo por tramo (ALB, COL, LAG); USO% suma 100 %; Σ tiros = tiros del equipo (24 s) |
| CA-11 | ✅ | ALB: Σ de los tiros de todos sus quintetos + posesiones sin quinteto de 5 = tiros del equipo en cada tramo y reloj (temprano 34 + 17, medio 46, tardío 37) (`a05q_sim.py`) |
| CA-12 | ✅ | reparto de pérdidas suma 100 %, diferencial = valor − promedio, % que llega al tardío = tardío / oportunidades |
| CA-13 | 🔶 | Σ zonas de cada tramo = tiros del tramo y "sin reloj" = `no_clock`; falta tooltip de 7 datos y exportación |
| CA-14 | ✅ | `shot-zones?entity=team&id=ALB&clock=tardio`: 37 intentos = tiros del tramo tardío; Σ tramos (134) ≤ total (136, dos sin reloj); `clock_start=14` 17 intentos; percentiles contra la población con el mismo filtro (`t03q_sim.py`) |
| CA-15 / CA-16 | ✅ | `GET /api/metrics/team?id=ALB&clock=tardio&clock_start=14`: el filtro se aplica (no está en `ignored`) y `possessions_counted` = oportunidades que cumplen (`t03p_sim.py`); entidad `clock` con el conjunto completo (2026-11-16) |
| CA-17 | ✅ | tramo sin tiros → `null` / `sin_intentos`, sin NaN; equipo sin pbp → 404 |
| CA-19 | ✅ | prórrogas con el mismo criterio (reloj dentro del período) |
| CA-20 | ✅ | la fuente derivada se ve en pantalla y está en `docs/metrics.md` |
| CA-21 | ✅ | 360 px sin scroll horizontal de página |

## Desviaciones respecto al plan
- **Partición del alcance (D-8):** se entregó la parte (a). Lo que falta (jugador, quinteto, siete preguntas, matriz zona × tramo, filtros de contexto, entidad `clock`, tablas T-06) queda como segunda entrega.
- **Composición de puntos** no estaba en la especificación v2: la pidió el cliente como urgente. Vive en el mismo endpoint y panel (`points_mix`).
- **Clasificación de la oportunidad por su evento de decisión**, no por `end_type`: un tiro al final del período termina como `fin_periodo` y dejaba la suma en menos de 100 %.
- **Sin pestaña `posesion` ni módulo de vista** (X-01 no se hizo): el panel se monta como card en Equipo y como pestaña nueva de Partido.
- **Tiros marcados con `three`** en `Possession.shots[]` (campo nuevo) para separar dobles y triples aun sin coordenadas.

## Limitaciones conocidas
- El reloj de posesión es derivado con resolución de 1 s; tras canasta rival el saque cuenta como posesión (sobreestima 1–3 s).
- Un tiro con `elapsed` fuera de rango queda sin tramo (aparece en "Sin reloj derivable").
- `fga_team` del box oficial: si un partido no tiene fila de box, no se concilia.

## Docs actualizados
- ✅ `docs/api.md` · ✅ `docs/metrics.md` · ✅ `docs/frontend.md` · ✅ `docs/architecture.md`

## Deuda / TODO
- Quinteto (RF-9), filtro del mapa de tiro por tramo (RF-12), `clock` / `clock_start` en el contexto, entidad `clock`, tablas `team_clock` / `zone_clock_matrix`, percentil y tooltip de la matriz.
- La atribución a jugador usa quien ejecuta el tiro, la pérdida o el primer tiro libre; en faltas recibidas es el tirador de libres (normalmente el que recibió la falta).
- Vista de composición de puntos en Liga (comparar equipos) y en Preparar.
- `t()` para el copy (F-21).

## Entidad `clock` y tablas T-06 (2026-11-16)
- T-C1 ✅ `GET /api/metrics/clock?id=<equipo>:<tramo>&side=`; T-C3 ✅ `team_clock` y `zone_clock_matrix`. `a05_table.py` 17/17: oportunidades y puntos por tramo = `GET /api/possession-clock` (24 s + 14 s), Σ filas de `team_clock` = todas las oportunidades, Σ intentos de la matriz = tiros de posesiones completas, ficha con población por tramo.
- En Equipo › Posesión, "Tabla completa" del reloj con "Por tramo" y "Zona × tramo", exportable; Chromium 1280/360 px e inglés (`tables_browser.py` 11/11).
- Desvío: sin `MetricDef` nuevas (`clock_shot_share`, `clock_viol24_rate`): el reparto y las violaciones de 24 s siguen en el panel.

## Quinteto y percentil de la matriz (2026-11-17)
- **RF-9:** `?lineup=` recorta el panel completo (tramos, reloj de 14 s, matriz, plantel y panel de decisión) a las posesiones que el quinteto empezó en cancha; selector "Quinteto" en Equipo › Posesión (los 15 con más posesiones). Desvío: la atribución es al quinteto del INICIO de la posesión (no al del evento de decisión): los cambios dentro de una posesión son raros (detenciones con tiros libres) y así la suma por quintetos cierra exacta.
- **RF-11/RF-14:** cada celda de la matriz zona × tramo lleva el percentil de su PPT contra los demás equipos en la misma celda (solo con la muestra mínima), el promedio de la celda y color por tercios; tooltip con zona y tramo, convertidos/intentos, FG%, eFG%, PPT, peso en el tramo y percentil.
- **Evidencia:** `a05q_sim.py` 11/11 (CA-11 exacto, quinteto en ataque y defensa, conciliación del motor, 400 con quinteto mal formado, percentiles solo en celdas con muestra, CA-13 se mantiene).

