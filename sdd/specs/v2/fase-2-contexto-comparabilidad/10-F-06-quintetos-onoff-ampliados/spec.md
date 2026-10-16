# Spec — F-06: Combinaciones y ON/OFF ampliados

> **ID:** F-06 · **Prioridad:** P1 · **Fase y orden:** 2·10
> **Depende de:** T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)) · T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)) · C-06 ([../../fase-1-confiabilidad/05-C-06-umbral-cierres/](../../fase-1-confiabilidad/05-C-06-umbral-cierres/spec.md)) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md)) · (usa también C-08 ids de jugador, X-01 pestaña `quintetos`, T-03 contexto y F-04 ventana de tramo)
> **Habilita:** F-07, F-03, F-09, F-10, A-08, F-15
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-06 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S3 "Quintetos" · §3 T-02 (CA), T-05, T-06 · Arquitectura §2.1, §2.3, §3.2, §3.5–§3.7, §3.10, §3.11, §3.12, §6, §7 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §4 F-06):** "Ampliar los parámetros de comparación en ambas secciones" (Combinaciones y ON/OFF), agrupados en tres bloques: **Ataque** (PPP · PPT general, de 2, de 3 y de TL · T2i · T2c · T3i · T3c · TLi · TLc · pérdidas · tapones recibidos · faltas cometidas · faltas recibidas · rebotes ofensivos · asistencias), **Defensa** (recuperos · tapones a favor · % de rebote ofensivo y defensivo · puntos recibidos), **Avanzado** (posesiones jugadas · +/- · OER · DER · Net Rating · eFG% · RO/pos · AS/pos). Además:
- "Agregar una tabla con todos los quintetos del equipo y sus respectivos números, ordenable por cualquier columna y exportable (T-06)."
- "Aplicar obligatoriamente los umbrales y la regresión de T-02 antes de rankear."
- "Los tres bloques anteriores son el mínimo temático: el detalle exacto de métricas lo fija el conjunto estándar de T-05 […]. Hoy es el apartado más incompleto de la app."
- **Rendimiento en cierres por quinteto:** récord V-D en partidos cerrados (ej. "2-1") con % de victorias; un partido cuenta si el quinteto estuvo en cancha en el tramo de cierre un mínimo configurable de posesiones (sugerido 2, F-13); partido cerrado = últimos 5 minutos con diferencia ≤ 10 (C-06); diferencial propio del tramo; métricas del tramo (posesiones, OER, DER, Net Rating, eFG%, TS%, TO%, OR%, FT Rate según T-05); con menos de tres partidos cerrados, badge de muestra baja y no se ordena entre los mejores.
- **Quintetos líderes del equipo:** tarjetas con los tres mejores quintetos en 7 categorías (Impacto, Tiro, Rebote, Cuidado del balón, Ritmo, Cierres, Volumen); cada tarjeta con los cinco nombres, valor, percentil, muestra, ranking y distancia al líder y al promedio (T-01), enlace a la fila de la tabla completa; solo quintetos sobre el umbral de T-02, ordenados por el valor ajustado; bloque exportable.
- El requisito F-06 **no trae un "Criterio de aceptación" propio**; el de T-02 lo aplica directamente: "la tabla de quintetos de un equipo devuelve un número útil de filas ordenables, y ninguna de las tarjetas de líderes está encabezada por una combinación de menos posesiones que el umbral".

**Por qué:** la nota del cliente (§0) cita "quintetos rankeados sin ninguna corrección por muestra" como una de las fallas que minan la confianza; la sección de quintetos es "el apartado más incompleto de la app".

**Qué existe hoy (verificado en código, rama `main`; `dev` no cambia estos módulos salvo el umbral de cierres):**
- `backend/lineups.py`: `PERIOD_LEN = {"REGULAR": 600, "OT": 300}` (FIBA manda `OVERTIME` → 300 s fantasma, arquitectura D-09; lo corrige F-11); `_agg(evs, team_code)` cuenta 2pt/3pt/TL, rebotes, AS, PER, robos y tapones (**no** faltas, faltas recibidas ni tapones recibidos); `_metrics` calcula OER, DER, Net, eFG%, TS%; `game_starters` exige exactamente 5 titulares; `build_segments(events, team_code, starters)` produce tramos `{on_court, events, seconds}` con fusión de cambios simultáneos y piso monótono del reloj; `lineup_stats(games, team_code, players)` (3–5 **nombres**) devuelve `games_used, games_excluded, sample{possessions, seconds}, metrics{oer, der, net_rating, efg_pct, ts_pct}, raw{…}, leaders`; `onoff_stats(games, team_code, player_name)` devuelve `on`, `off` (tasas + conteos) y `diff` solo de 5 tasas.
- `backend/app.py`: `_team_pbp_games(team_code)` (todas las competencias, N+1 consultas); `lineup_route` (`GET /api/lineup/<team>?players=A|B|C`, 400 "Elegí entre 3 y 5 jugadores", 404 "Equipo no encontrado o sin play-by-play"); `onoff_route` (`GET /api/onoff/<team>/<player>`, + `usg_pct`).
- `frontend/js/app.js`: `renderTeamLineup` (5 `statBox`, tabla ancha de 18 columnas de Feature 11, líderes, aviso "Muestra chica" con < 10 posesiones fijo en el código) y `renderTeamOnOff` (tablas Eficiencia y Producción ON | OFF | Δ). El selector de combinación es una lista de checkboxes por nombre (`#team-lineup-picker`). **No existe** una tabla de todos los quintetos, ni tarjetas de líderes, ni cierres por quinteto, ni corrección por muestra.
- `backend/clutch.py`: ventana de cierre y `_entry_margin` (diferencia al 5:00), con prórrogas mal detectadas (`"OT"`) en `main` y `dev`.

**Qué resolvieron features anteriores:** 03 (motor de quintetos), 04 (ON/OFF con partición exhaustiva, CA-5), 05 (cierres), 08 (nulos), 11 (tabla ancha de combinación). En v2 fase 1: T-05 define el conjunto estándar, `StatBundle`/`compute_standard` y registra los tipos `lineup` y `onoff` (arquitectura §3.5); T-02 define umbrales, regresión, banda y el caso especial `clutch_lineup`; T-01 la ficha y la población de quintetos; T-06 la tabla completa y la exportación; C-06 la ventana de cierre con `clutch.margin`/`clutch.window_secs`; F-13 las claves `sample.clutch_lineup.*`; C-08 los `player_id`; F-11 la corrección de `PERIOD_LEN`.

**Qué queda para F-06:** construir **todos** los quintetos del equipo como entidades con el conjunto completo, la tabla, el ON/OFF completo de todo el plantel, el rendimiento en cierres por quinteto, las tarjetas de líderes, y migrar las pantallas de Combinación y ON/OFF al conjunto estándar (arquitectura §3.5: "F-06 migra lineups/on-off").

## 1. Objetivo
Convertir la pestaña Quintetos del equipo en un análisis completo de combinaciones y ON/OFF: conjunto estándar para cada quinteto, combinación y estado ON/OFF, tabla exportable de todos los quintetos rankeada con corrección por muestra, rendimiento en cierres por quinteto y tarjetas de quintetos líderes.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 F-06 (completo), §1.3 S3 "Quintetos", §3 T-02 (umbrales: quinteto 15/40, ON/OFF 40/120 por estado, cierre por quinteto 2 posesiones / 3 partidos; K 25 quintetos / 50 ON/OFF; CA), §3 T-05 (conjunto estándar, CA), §3 T-06 (requisitos de toda tabla y exportación), §3 T-01 (ficha, población de quintetos), §2 C-06 (partido cerrado ≤ 10), §2 C-11 (nulos), §6 Glosario (Posesión, OER, DER, Net Rating, eFG%, TS%, PPT, PPP, OR%, DR%, TO%, FT Rate, PACE, Valor ajustado).
- `docs/api.md` § `GET /api/lineup/<team_code>?players=A|B|C`, § `GET /api/onoff/<team_code>/<player_name>`, § `GET /api/clutch/<team_code>`.
- `docs/metrics.md` § Posesiones, § Eficiencia ofensiva y defensiva, § Eficiencia de tiro, § FT Rate, § Rebotes, § Pérdidas y asistencias, § Pace.
- `docs/architecture.md` § `lineups.py`, § `clutch.py`. `docs/frontend.md` § Vistas → Equipo (Combinación, ON/OFF).
- Arquitectura §2.1 (pooled; posesiones de quinteto), §2.2 (TO% = PER/POS en quinteto, DA-04; `blk_received` quinteto = tapón del rival sobre tiro propio; `fouls_drawn` quinteto = `foulon`), §2.3, §3.2 (`sample.lineup.*`, `sample.onoff.*`, `sample.clutch_lineup.*`, `regression.lineup.k`, `regression.onoff.k`, `regression.clutch_lineup.k`, `clutch.margin`, `clutch.window_secs`), §3.4 (ids de jugador), §3.5, §3.6, §3.7, §3.10 (`all_lineups`, `lineup_clutch`), §3.11 (tablas `team_lineups`, `team_onoff`), §3.12 (S3 `quintetos`; id de quinteto `<team_code>:<pid>-<pid>-…`), §7.1–§7.7.
- Specs previos: `sdd/specs/03-lineups/`, `04-on-off/`, `05-clutch/`, `08-nulos-vs-cero/`, `11-mas-stats-lineup-comparar/`.

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver todos los quintetos que usé con todas sus métricas en una tabla ordenable, para decidir qué combinaciones repetir.
- US-2: Como entrenador, quiero que el ranking de quintetos corrija por muestra, para no confiar en un quinteto que jugó ocho posesiones.
- US-3: Como entrenador, quiero una lectura rápida de los mejores quintetos por categoría (impacto, tiro, rebote, balón, ritmo, cierres, volumen), para no recorrer la tabla completa.
- US-4: Como entrenador, quiero saber qué quintetos rinden en los cierres de partidos apretados, separando el resultado del partido de lo que hizo el quinteto en cancha.
- US-5: Como analista, quiero el ON/OFF de cualquier jugador (y de todo el plantel) con el conjunto completo de métricas, para medir su impacto sin salir de la pantalla.
- US-6: Como analista, quiero analizar una combinación de 3, 4 o 5 jugadores con el conjunto completo agrupado en Ataque, Defensa y Avanzado.
- US-7: Como analista, quiero exportar la tabla y las tarjetas con los filtros aplicados, para compartirlas con el cuerpo técnico.

## 4. Requisitos funcionales

**Conjunto de métricas y bloques**
- RF-1: El sistema DEBE calcular para cada quinteto, cada combinación de 3–5 jugadores y cada estado ON/OFF el **conjunto estándar completo de T-05** sobre los eventos de play-by-play de los tramos correspondientes, con agregación pooled. Toda métrica no calculable va en nulo con razón, nunca omitida. · (US-1, US-5, US-6) (Esp. v2 §F-06, §T-05; arquitectura §2.1, §3.5)
  - Reglas (glosario v2 §6, copiadas): Posesión = T2i + T3i − RO + PER + 0,44 × TLi; OER = puntos anotados / posesiones propias; DER = puntos recibidos / posesiones del rival; Net Rating = OER − DER; eFG% = (T2c + T3c + 0,5 × T3c) / (T2i + T3i); TS% = Puntos / (2 × (T2i + T3i + 0,44 × TLi)); PPT = puntos anotados desde tiros de campo / tiros de campo intentados; PPP = puntos anotados / posesiones; OR% = RO propios / (RO propios + RD del rival); DR% = RD propios / (RD propios + RO del rival); TO% = pérdidas / posesiones; FT Rate = TLi / TCi; PACE = posesiones por 40 minutos (40·((POS+POS_rival)/2)/minutos con los segundos en cancha, arquitectura §2.2).
  - Tapones recibidos del quinteto = tapones del rival sobre tiros propios durante sus tramos; faltas recibidas = eventos `foulon` del equipo; +/- = puntos a favor − puntos en contra (arquitectura §2.2).
- RF-2: El sistema DEBE presentar, como vista resumida de cada quinteto/combinación/estado ON/OFF, los tres bloques temáticos del cliente con exactamente estas métricas: **Ataque** = PPP, PPT, PPT 2, PPT 3, PPT TL, T2i, T2c, T3i, T3c, TLi, TLc, PER, tapones recibidos, faltas cometidas, faltas recibidas, RO, AS; **Defensa** = robos ("recuperos"), tapones, OR%, DR%, PTS recibidos; **Avanzado** = posesiones, +/-, OER, DER, Net Rating, eFG%, RO/pos, AS/pos. Debajo, el conjunto estándar completo por grupos de T-05. · (US-6) (Esp. v2 §F-06 tabla de bloques)

**Tabla de todos los quintetos**
- RF-3: El sistema DEBE devolver una tabla con **todos** los quintetos (5 jugadores) que el equipo usó en la selección, una fila por quinteto, con el conjunto estándar, sin truncar (paginación con "Ver todas" de T-06). · (US-1) (Esp. v2 §F-06, §T-06)
- RF-4: La tabla DEBE ser ordenable por cualquier columna (nulos al final en ambos sentidos), con selector de columnas recordado por usuario, fila de totales del equipo y fila de promedio de la competencia, coloreado por percentil desactivable, y exportable en CSV, XLSX, PNG y PDF con los metadatos de T-06. · (US-1, US-7) (Esp. v2 §T-06)
- RF-5: El sistema DEBE aplicar T-02 **antes de rankear**: cada quinteto trae su badge de muestra (umbral de quinteto `sample.lineup.min` con piso absoluto y umbral relativo `sample.lineup.rel_pct` sobre las posesiones del equipo, nivel alto `sample.lineup.high`); OER, DER y Net Rating traen el valor ajustado valor_ajustado = (pos × valor + K × media_liga) / (pos + K), K = `regression.lineup.k`, y la banda de error; el orden por defecto es Net Rating **ajustado** descendente. · (US-2) (Esp. v2 §F-06, §T-02)
- RF-6: Los quintetos por debajo del mínimo DEBEN mostrarse en gris con la advertencia y ordenarse **después** de los que superan el umbral en cualquier orden por métrica de rendimiento (quedan fuera de rankings, percentiles, promedio y tarjetas de líderes), sin ocultarse. · (US-2) (Esp. v2 §T-02 "Qué hacer con las muestras pequeñas")
- RF-7: Cada métrica de cada quinteto DEBE traer su ficha T-01 (valor, ranking "N.º de M", distancia al líder con nombre, distancia al promedio, percentil con escala de color), con población = los quintetos de la **competencia** que superan el umbral en el mismo contexto. · (US-1) (Esp. v2 §T-01 "Quintetos y parejas: los umbrales de posesiones de T-02")
- RF-8: Cada fila DEBE enlazar al detalle del quinteto (vista de RF-2) y conservar un enlace directo (URL con el id del quinteto) para que las tarjetas lo apunten. · (US-3) (Esp. v2 §F-06 "Cada tarjeta enlaza a la fila correspondiente")

**Combinación personalizada**
- RF-9: El sistema DEBE permitir elegir entre 3 y 5 jugadores del equipo y mostrar su combinación con los bloques de RF-2, el conjunto completo, el badge T-02 (umbral de quinteto) y la ficha T-01. Las combinaciones de 3 o 4 jugadores agregan todos los tramos en que esos jugadores comparten cancha. · (US-6) (Esp. v2 §F-06; docs/api.md § lineup)

**ON/OFF**
- RF-10: El sistema DEBE calcular, para cada jugador del equipo, el conjunto estándar del equipo con el jugador en cancha (ON), fuera de cancha (OFF) y la diferencia ON − OFF, manteniendo la partición exhaustiva y disjunta (ON + OFF = total del equipo en los partidos usados). · (US-5) (Esp. v2 §F-06; docs/api.md § onoff)
- RF-11: El ON/OFF DEBE traer el badge T-02 con el umbral de ON/OFF (`sample.onoff.min` en **cada** estado; el nivel lo define el menor de los dos) y el valor ajustado de OER, DER y Net Rating en cada estado con K = `regression.onoff.k`; la diferencia ajustada = ajustado ON − ajustado OFF. · (US-5) (Esp. v2 §T-02)
- RF-12: El sistema DEBE ofrecer una tabla ON/OFF de todo el plantel (una fila por jugador) con selector de vista ON, OFF o Diferencia, ordenable y exportable (T-06). · (US-5, US-7) (Esp. v2 §F-06 "ambas secciones", §T-06)

**Cierres por quinteto**
- RF-13: El sistema DEBE calcular, para cada quinteto, su récord **V-D** en partidos cerrados (últimos `clutch.window_secs` segundos del último período regular más prórrogas, con diferencia ≤ `clutch.margin` al entrar al tramo, C-06) y su % de victorias, contando un partido solo si el quinteto jugó en ese tramo al menos `sample.clutch_lineup.min_poss` posesiones (default 2). El resultado es el del partido (victoria o derrota del equipo). · (US-4) (Esp. v2 §F-06 "Rendimiento en cierres por quinteto")
- RF-14: El sistema DEBE mostrar además el **diferencial propio del tramo** (puntos a favor, en contra y diferencia mientras el quinteto estuvo en cancha dentro del tramo de cierre) y las métricas del tramo del conjunto estándar, con columnas visibles por defecto: posesiones, OER, DER, Net Rating, eFG%, TS%, TO%, OR% y FT Rate. · (US-4) (Esp. v2 §F-06)
- RF-15: Con menos de `sample.clutch_lineup.high_games` partidos cerrados contados (default 3), el récord DEBE mostrarse con el badge de muestra baja y ese quinteto NO DEBE ordenarse entre los mejores ni entrar en la categoría Cierres de las tarjetas. El Net Rating del tramo se muestra también ajustado con K = `regression.clutch_lineup.k`. · (US-4) (Esp. v2 §F-06, §T-02 tabla de umbrales)

**Quintetos líderes**
- RF-16: El sistema DEBE mostrar tarjetas con los tres mejores quintetos del equipo en 7 categorías y sus criterios: Impacto (Net Rating ajustado · OER ajustado · DER ajustado), Tiro (eFG% · TS% · PPT), Rebote (OR% · DR% · REB% · rebotes totales), Cuidado del balón (TO%, menor es mejor · AS/PER), Ritmo (PACE = posesiones por 40 minutos), Cierres (Net Rating ajustado del tramo de cierre · % de victorias en cierres), Volumen (minutos · posesiones). · (US-3) (Esp. v2 §F-06 "Quintetos líderes del equipo")
- RF-17: Solo DEBEN entrar a las tarjetas los quintetos que superan el umbral de T-02 (en Cierres, los que tienen al menos `sample.clutch_lineup.high_games` partidos contados), ordenados por el valor ajustado cuando la métrica tiene regresión (OER, DER, Net Rating) y por el valor crudo en el resto. · (US-2, US-3) (Esp. v2 §F-06, §T-02 CA)
- RF-18: Cada tarjeta DEBE mostrar los cinco nombres, el valor de la métrica (y el ajustado con banda si aplica), su percentil, la muestra de respaldo (badge), el ranking y la distancia al líder y al promedio de la ficha T-01, y enlazar a la fila del quinteto en la tabla completa. · (US-3) (Esp. v2 §F-06)
- RF-19: El bloque de tarjetas completo DEBE ser exportable (CSV/XLSX con una fila por tarjeta y puesto; PNG/PDF de la vista). · (US-7) (Esp. v2 §F-06 "El bloque completo es exportable")

**Transversales**
- RF-20: Toda la pestaña DEBE respetar el contexto activo de T-03 (competencia, período, sede, rival, descanso, cuarto, marcador; `on`/`off` con percentiles `contexto_no_comparable`) y la base de normalización de T-04 en tablas y paneles. · (US-1) (Esp. v2 §T-03, §T-04, §T-06)
- RF-21: El sistema DEBE excluir los partidos sin play-by-play o sin cinco titulares identificables e informarlos (`games_excluded` con razón), y descartar los tramos con un número de jugadores en cancha distinto de 5 al armar quintetos (contados como inconsistencias para calidad de datos). · (US-1) (C-11; arquitectura §3.8, F-11 check `lineup_inconsistencies`)
- RF-22: Los quintetos y combinaciones DEBEN identificarse por ids enteros de jugador (`<team_code>:<pid>-<pid>-…`, ids ascendentes) en URLs y parámetros; los nombres se muestran con la grafía de la ficha. Los endpoints legado por nombre (`/api/lineup`, `/api/onoff`) siguen funcionando con su shape actual. · (US-6) (arquitectura §3.4, §3.12, §3.5 compatibilidad)
- RF-23: Ningún valor inexistente se muestra como 0 (C-11): quinteto sin intentos de TL → FT% nulo `sin_intentos`; estado OFF sin posesiones → métricas nulas y "sin muestra"; diferencia nula si cualquiera de los lados es nulo. · (US-2) (Esp. v2 §C-11; `sdd/specs/04-on-off/spec.md` §9)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events`, `player_game_stats` (`starter`, `player_id` C-08), `games` (`home_score`, `away_score`, `competition_id`) | consumidas | — | existen (+F-11/C-08) |
| `pbp_events.previous_action`, `.qualifiers` | consumidas (tapón→tiro propio, `pointsinthepaint`) | INTEGER / TEXT, DEFAULT NULL | agregadas por F-11 |
| `GET /api/metrics/lineup?id=<team>:<pids>` | endpoint genérico T-05 (tipo `lineup` de 3–5 jugadores) | §7.3 + fichas §7.1 + `adj` + `sample` §7.2 | de T-05; F-06 migra su loader |
| `GET /api/metrics/onoff?id=<team>:<pid>` | endpoint genérico T-05 (tipo `onoff`) | §7.3 del estado ON + `off` + `diff` | de T-05; forma de `off`/`diff`: PROPUESTA (no está en 00-arquitectura-transversal.md) |
| `GET /api/table/team_lineups?team=<code>[&size=5]` | tabla T-06 | §7.6 | id **NUEVO** (dueño F-06, listado en arquitectura §6) |
| `GET /api/table/team_onoff?team=<code>&state=diff\|on\|off` | tabla T-06 | §7.6 | id **NUEVO** (dueño F-06); parámetro `state`: PROPUESTA |
| `GET /api/table/team_lineup_clutch?team=<code>` | tabla T-06 de cierres por quinteto | §7.6 | PROPUESTA (no está en 00-arquitectura-transversal.md) |
| `GET /api/lineup-leaders/<team_code>` | tarjetas de líderes | `{team_code, categories[{key,label,criteria[{metric,label,direction,adjusted,items[top 3]}]}], context, thresholds}` | PROPUESTA (no está en 00-arquitectura-transversal.md) |
| `GET /api/lineup/<team_code>`, `GET /api/onoff/<team_code>/<player_name>` | legado | sin cambios de shape | existen |
| Configuración `sample.lineup.*`, `sample.onoff.*`, `sample.clutch_lineup.min_poss`, `sample.clutch_lineup.high_games`, `regression.lineup.k`, `regression.onoff.k`, `regression.clutch_lineup.k`, `clutch.margin`, `clutch.window_secs` | claves | agregadas por F-13 | existen desde F-13 |

Sin cambios de esquema.

## 6. Estados de UI
Pestaña **Quintetos** de S3 (`#/equipo/<code>/quintetos`). Todo copy nuevo con `t()` y marcado para `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Tarjetas de líderes | skeleton de 7 tarjetas + "Calculando quintetos líderes..." (*nuevo*) | "Ningún quinteto supera el umbral de muestra (N posesiones). Revisá el umbral en Configuración." (*nuevo*); categoría Cierres sin candidatos: "Ningún quinteto tiene 3 o más partidos cerrados" (*nuevo*, número leído de la config) | mensaje del backend o "No se pudieron cargar los quintetos líderes" (*nuevo*) | "Sin conexión: no se pudieron cargar los quintetos" (*nuevo*) | 7 tarjetas; chips de criterio por categoría; top 3 con nombres, valor, ajustado ± banda, percentil coloreado, badge, "N.º de M", distancias; clic → fila en la tabla |
| Tabla de todos los quintetos | spinner en la tabla | equipo sin pbp: "Este equipo no tiene play-by-play importado. Reimportá sus partidos." (copy existente) | toast con el mensaje | idem | tabla T-06; filas de muestra baja en gris con aviso "Muestra baja: se muestra pero no se rankea" (*nuevo*); pie con "N quintetos · M sobre el umbral" (*nuevo*) |
| Detalle de quinteto / combinación | spinner "Calculando combinación..." (copy existente) | — | 400 "Elegí entre 3 y 5 jugadores" (copy existente); 404 "Equipo no encontrado o sin play-by-play" (existente) | idem | bloques Ataque · Defensa · Avanzado (*nuevo*: títulos) + panel completo + badge |
| ON/OFF de un jugador | spinner | — | 404 "Sin datos ON/OFF para este jugador" (existente) | idem | columnas ON · OFF · Δ con los 3 bloques + panel completo; estado sin posesiones: "sin muestra" (existente) |
| Tabla ON/OFF del plantel | spinner | "Sin jugadores con play-by-play" (*nuevo*) | toast | idem | selector "ON · OFF · Diferencia" (*nuevo*) + tabla T-06 |
| Cierres por quinteto | spinner "Calculando cierres por quinteto..." (*nuevo*) | "Sin partidos cerrados en la selección (dif ≤ 10 en los últimos 5 min)" (*nuevo*, valores de la config) | toast | idem | tabla T-06 con récord "V-D", % victorias, badge (BAJA si < 3 partidos), diferencial del tramo y métricas del tramo |

## 7. Criterios de aceptación
- CA-1 **(CA del cliente, T-02 aplicado a F-06)**: "la tabla de quintetos de un equipo devuelve un número útil de filas ordenables, y ninguna de las tarjetas de líderes está encabezada por una combinación de menos posesiones que el umbral." Given un equipo del dataset de verificación, When se abre la pestaña Quintetos, Then la tabla lista todos sus quintetos con al menos una fila sobre el umbral y ordenable por cualquier columna, y ningún primer puesto de ninguna tarjeta (ni ningún puesto) tiene menos posesiones que el mínimo efectivo de T-02 (ni menos de 3 partidos cerrados en Cierres).
- CA-2 **(CA del cliente, T-05 aplicado a quintetos)**: "seleccionar un quinteto, un jugador y un emparejamiento devuelve exactamente los mismos grupos de métricas, sin huecos y sin diferencias de nomenclatura." Given un quinteto y un estado ON/OFF, When se piden por `/api/metrics/lineup` y `/api/metrics/onoff`, Then devuelven los mismos `groups` y las mismas claves que `/api/metrics/player`, con nulos con razón donde no aplican.
- CA-3: Given un equipo, When se suman `possessions`, `pts` y `pts_against` de todas las filas de `team_lineups` (sin filtros), Then coinciden con los totales del equipo en los partidos usados (partición exhaustiva de los tramos de 5 jugadores; los tramos inconsistentes se informan aparte).
- CA-4: Given la tabla de quintetos, When se ordena por Net Rating, Then el orden usa el valor ajustado, los quintetos de muestra baja quedan después de todos los que superan el umbral en ambos sentidos y los valores nulos quedan al final.
- CA-5: Given un quinteto con 12 posesiones y otro con 60 y el mismo Net crudo, When se muestran, Then el de 12 tiene el ajustado más cerca de la media y una banda más ancha, y aparece en gris fuera de rankings (percentil de población nulo o marcado `in_population: false`).
- CA-6: Given un jugador titular, When se consulta su ON/OFF, Then `on.possessions + off.possessions` = posesiones totales del equipo en los partidos usados, Δ Net = Net ON − Net OFF, y cada estado trae el conjunto completo con badge (nivel = el menor de los dos estados).
- CA-7: Given un jugador que jugó todos los minutos de los partidos usados (o un caso sintético equivalente), When se consulta su ON/OFF, Then el estado OFF tiene métricas nulas con razón, la UI muestra "sin muestra" y ningún `NaN`/`Infinity`/0 falso.
- CA-8: Given los cierres del equipo, When se consulta la tabla de cierres por quinteto, Then para un quinteto el récord V-D cuenta solo partidos cerrados (≤ `clutch.margin`) donde jugó ≥ `sample.clutch_lineup.min_poss` posesiones del tramo, la suma V + D coincide con esos partidos verificados a mano en el pbp, y el diferencial del tramo es puntos a favor − en contra con el quinteto en cancha dentro del tramo.
- CA-9: Given un quinteto con 2 partidos cerrados contados y buen Net del tramo, When se ven la tabla de cierres y la tarjeta Cierres, Then su récord tiene badge BAJA y no aparece en la tarjeta Cierres ni se ordena antes que los quintetos con ≥ 3 partidos.
- CA-10: Given `sample.clutch_lineup.min_poss` cambiado a 5 en Configuración, When se recarga la tabla de cierres por quinteto, Then los récords se recalculan (menos partidos contados) sin reiniciar el servidor.
- CA-11: Given las tarjetas de líderes, When se toca un quinteto de una tarjeta, Then la vista navega a la tabla con esa fila resaltada (URL con `lineup=<id>`), y la tarjeta muestra nombres, valor, percentil, badge, ranking y distancias coherentes con la ficha de la fila.
- CA-12: Given la tabla de quintetos con un orden y columnas elegidas y el contexto `last=5`, When se exporta a CSV y XLSX, Then los archivos reproducen exactamente filas, orden y columnas visibles, y la cabecera documenta equipo, competencia, "Últimos 5" y la base.
- CA-13: Given el bloque de tarjetas, When se exporta, Then el CSV tiene una fila por categoría × criterio × puesto con el quinteto, valor, ajustado, percentil y muestra, y el PNG/PDF reproduce la vista.
- CA-14: Given una combinación de 3 jugadores elegida en el selector, When se analiza, Then se muestran los bloques Ataque/Defensa/Avanzado con todas las métricas del cliente y el panel completo; con 2 o 6 jugadores la UI no permite analizar y el backend responde 400 "Elegí entre 3 y 5 jugadores".
- CA-15: Given un partido con prórroga en la selección, When se calculan los segundos en cancha de los quintetos de ese partido, Then la suma es 2400 + 300 × prórrogas (sin segundos fantasma) y el partido cuenta como cerrado si corresponde (prórroga dentro del tramo).
- CA-16: Given un equipo sin play-by-play, When se abre la pestaña, Then todos los bloques muestran el copy de sin pbp y ningún 0.

## 8. Fuera de alcance
- Parejas de jugadores (K = 2) y matriz de asistencias: A-08 (generaliza `all_lineups` a `size=2`).
- Emparejamientos quinteto vs quinteto rival: F-07/F-03.
- Comparación lado a lado de dos quintetos: F-09 (incremento sobre esta tabla: acción "Comparar" en la fila). INCREMENTO DIFERIDO (→ F-09).
- Buscador de quintetos entre equipos y consultas guardadas: F-10.
- Sugerencias de quinteto por IA: F-15.
- Tabla de todas las combinaciones de 3 o 4 jugadores (la tabla es de quintetos; 3–4 se analizan a demanda en el selector).
- ON/OFF por partido puntual y "Chaos"/"Offensive Dependency" (backlog de Feature 04, sin fórmula).
- Cierres por quinteto con posesiones reconstruidas (A-01) en lugar de la fórmula: INCREMENTO DIFERIDO (→ A-01) si A-01 publica `possessions_counted` por tramo.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **Criterios por categoría de las tarjetas.** El cliente lista varios criterios por categoría ("Net Rating ajustado · OER · DER"). Decisión: cada categoría muestra chips con sus criterios; el primero es el default y cada chip tiene su propio top 3. No se interpreta como desempate.
2. [DECISIÓN PROPUESTA — confirmar] **Ritmo.** El glosario define PACE como "posesiones por 40 minutos"; la categoría Ritmo usa un solo criterio (PACE) en lugar de duplicar la misma magnitud.
3. [DECISIÓN PROPUESTA — confirmar] **Récord en cierres.** V-D = resultado **del partido** (lo que pide el cliente: "récord en partidos cerrados"), distinto del `clutch_record` actual del bloque de Cierres del equipo (tramos ganados). El diferencial del tramo cubre lo atribuible al quinteto.
4. [DECISIÓN PROPUESTA — confirmar] **Qué partidos entran en las métricas del tramo de cierre.** El récord cuenta solo partidos con ≥ `min_poss` posesiones; el diferencial y las métricas del tramo agregan **todo** el tiempo del quinteto en tramos de cierre de partidos cerrados (aunque en algún partido haya jugado menos de `min_poss`), para no perder datos reales.
5. [DECISIÓN PROPUESTA — confirmar] **Población de la ficha de un quinteto.** Percentil, ranking, líder y promedio se calculan sobre los quintetos de toda la competencia que superan el umbral (regla T-01: "posición dentro de la competencia"); las tarjetas agregan el puesto dentro del equipo (1.º–3.º de N quintetos del equipo sobre el umbral).
6. [DECISIÓN PROPUESTA — confirmar] **Población de la categoría Cierres.** Percentil y ranking de los criterios de cierre se calculan sobre los quintetos de la competencia con al menos `high_games` partidos cerrados contados.
7. [DECISIÓN PROPUESTA — confirmar] **Tabla ON/OFF del plantel.** Una fila por jugador con selector ON / OFF / Diferencia (una tabla T-06 por vista) en lugar de tres filas por jugador; así se ordena por cualquier métrica sin mezclar estados.
8. [DECISIÓN PROPUESTA — confirmar] **Orden de las filas de muestra baja.** Se muestran siempre después de las rankeadas en los órdenes por métricas de rendimiento; en órdenes por texto o por volumen (nombre, minutos, posesiones) se ordenan con el resto.
9. [DECISIÓN PROPUESTA — confirmar] **Faltas cometidas desde el play-by-play.** Se cuentan los eventos `foul` del equipo excepto técnicas de banco y de entrenador; la diferencia con el box en el partido completo se verifica y documenta.
