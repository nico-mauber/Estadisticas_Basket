# Spec — T-01: Ficha de métrica: valor, ranking y distancias

> **ID:** T-01 · **Prioridad:** P0 · **Fase y orden:** Fase 1 · 15
> **Depende de:** C-02 ([../11-C-02-promedios-de-liga/spec.md](../11-C-02-promedios-de-liga/spec.md)) · C-08 ([../07-C-08-jugadores-duplicados/spec.md](../07-C-08-jugadores-duplicados/spec.md)) · F-11 ([../02-F-11-calidad-datos-competencias/spec.md](../02-F-11-calidad-datos-competencias/spec.md)) · T-05 ([../13-T-05-conjunto-estandar-metricas/spec.md](../13-T-05-conjunto-estandar-metricas/spec.md)) · T-02 ([../14-T-02-confiabilidad-muestra/spec.md](../14-T-02-confiabilidad-muestra/spec.md))
> **Habilita:** T-06, C-03, A-12, F-05, F-08, F-06, F-17, F-03, F-14, A-09, A-10
> **Estado:** ✅ Aprobado — defaults de arquitectura confirmados (§9)
> **Fuente:** Especificación v2 §3 · T-01 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §2.1, §3.6, §7.1, §7.1b, §8, §9.2 I-08 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (T-01, literal resumido).** "Toda métrica de equipo, jugador o quinteto se muestra siempre con el mismo conjunto de cinco elementos. No basta con el número ni con el
percentil: el entrenador necesita saber en qué puesto está y cuánto le falta para alcanzar al de arriba." Los cinco elementos: **valor** (siempre visible, en primer lugar), **ranking** ("7.º de 12": "el
total de la población, no solo el puesto"), **distancia al líder** con el nombre del líder (−0,06 (Peñarol 1,15)), **distancia al promedio** con signo (+0,02 (Ø 1,07)) y **percentil** 0-100 con "escala de
color continua: rojo en 0, gris en 50, verde en 100". Este conjunto "reemplaza el bloque actual 'Ø liga / ↑ x', que es la fuente de los valores inconsistentes descritos en C-02". En las métricas donde menos es
mejor "se invierte todo… La distancia al líder nunca debe quedar con el signo cambiado". Empates: "mismo puesto para ambos y salto en el siguiente, con la marca de empate". Todo "se recalcula sobre la selección
activa" y debe indicarse. "Al pasar el cursor sobre la ficha se despliega el ranking completo de la métrica, con la entidad consultada resaltada". La población de referencia son equipos con ≥ 3 partidos,
jugadores con ≥ 60 minutos, quintetos y parejas según los umbrales de T-02; quien no llega "recibe igualmente su ficha completa, marcada como muestra baja, pero queda fuera de la población que define percentiles, líder y promedio".

**Qué existe HOY (verificado en el código de la rama `v2`).**
- `statBox(label, value, display, leagueKey, league, higherIsBetter, reason)` (`frontend/js/app.js`) muestra el valor y, si hay `league[leagueKey]`, una línea `Ø <avg>`; el "↑ mejor de la liga" ya se retiró en la Feature 14
  (C-02 de `dev`) porque era el máximo sin mínimo de muestra (`stats_engine.league_averages` aún devuelve `{avg, best}` por clave). El color del valor es binario (`statClass`: "above-avg"/"below-avg" según `value` vs `avg`), no continuo.
  `statBox` se llama desde Equipo (~30 veces), Jugador (~25), Cierres y Combinación (sin liga). La heurística `isPct`/`NOT_PCT` por substring de la clave decide si es porcentaje.
- No hay ranking, líder, distancia ni percentil en ninguna pantalla. La tabla de Liga (`_leagueTableHTML`) ordena 11 columnas por clic y pinta solo `net_rating` en verde/rojo; el número `#` es el índice de la fila ordenada.
- `GET /api/league` (`backend/app.py:league_overview`) devuelve una lista de equipos con el **promedio de las tasas por partido** (`_avg`), no el cociente de totales; incluye todos los equipos con al menos un partido, sin mínimo.
- `GET /api/team` y `GET /api/player` devuelven `leagues` (promedio por competencia sobre **partidos-equipo** / **partidos-jugador**, `league_averages`) en vez de la media de las entidades; C-02 (previo en el orden de fase) los reemplaza por `population.league_reference`.
- `_colorCell(val, avg, invert)` que citan `docs/frontend.md`, `CLAUDE.md` y la regla 9 de la Constitución **no existe** en ninguna rama (arquitectura §1.5 D-04). `percentileColor` es nueva.
- Los umbrales de muestra (equipo 3 partidos, jugador 60 minutos, quinteto 15 posesiones…) están en `sample.*` (T-02, previo) y se leen de la configuración (F-13).
- El conjunto estándar (T-05, previo) entrega los valores pooled de cada entidad con `value`/`reason`; la ficha se agrega sobre ese payload.

**Qué resolvieron features anteriores.** Feature 14/C-02: promedios por competencia, nulos fuera del promedio, retiro del "↑ best". C-02 (v2): `population.py` con `population()` y `league_reference()` (todas las entidades con datos, sin umbrales) y `context.py` con
`competition`/`last`. T-05: valores y razones de nulo. T-02: `sample.sample_for`, niveles y `ranked`. **Queda para T-01**: umbrales de la población, ranking, líder, distancias orientadas, percentil, color continuo, hover, ficha en todas las cards,
endpoint de ranking completo y coherencia con la tabla de Liga.

**Dataset de verificación (R-05).** El seed tiene 13 partidos, 14 equipos con 2 partidos cada uno (dos con 1) y 187 jugadores de los cuales 32 superan 60 minutos. Con los umbrales por defecto **ningún equipo llega a 3 partidos**: la población de equipos queda vacía y la ficha
muestra `poblacion_insuficiente`. Para verificar se baja `sample.team.min` a 2 desde Configuración (12 equipos califican) o se importan más partidos; es parte del procedimiento, no un defecto.

## 1. Objetivo
Mostrar toda métrica de equipo, jugador o quinteto con la ficha de cinco elementos (valor, ranking sobre el total de la población, distancia al líder con nombre, distancia al promedio con signo y percentil con color continuo), calculada sobre una
población de referencia bien definida y recalculada sobre la selección activa, de modo que coincida con la tabla de Liga y reemplace el bloque "Ø liga / ↑ x".

## 2. Fuentes (trazabilidad)
- Especificación v2: §3 T-01 (cinco elementos, reglas de cálculo, población de referencia, criterio de aceptación), §3 T-02 (umbrales y muestra baja), §2 C-02 (promedios de liga) y C-11 (nulos), §4 F-14 (los promedios son la base de los percentiles), §6 (glosario: percentil, ficha de métrica).
- Arquitectura: §2.1 (promedio de competencia y pooled), §3.6 (fórmulas exactas de la ficha), §7.1 y §7.1b (shapes), §7.4 (razones de percentil), §8 (`core/colors.js`, `components/metric-card.js`), §9.2 I-08 y I-12.
- `docs/frontend.md` §"Stat helpers" (`statBox`, `statClass`), §Liga; `docs/api.md` §Liga, §Equipo, §Jugador; `docs/metrics.md` §"Promedio de liga".
- Decisiones: [../../00-decisiones.md](../../00-decisiones.md) (DA-02, DA-36); DA-08 (promedio = media de entidades) y DA-09 (distancias orientadas) con el default de la arquitectura; DA-14 (competencia por defecto, de C-02).
- Specs previos: `sdd/specs/14-promedios-liga` (Feature 14), `sdd/specs/09-filtro-competencia`, `sdd/specs/12-nulos-orden-color-dnp`.

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver, junto a cada métrica, en qué puesto está mi equipo o jugador sobre el total de la competencia, para interpretar el número sin salir de la pantalla.
- US-2: Como entrenador, quiero saber cuánto me falta para alcanzar al mejor (con su nombre) y cuánto me separo del promedio, con signo, para saber qué tan lejos está cada área.
- US-3: Como analista, quiero un percentil de 0 a 100 con un color continuo rojo-gris-verde, para ver de un vistazo fortalezas y debilidades.
- US-4: Como entrenador, quiero que en las métricas donde menos es mejor (DER, pérdidas, faltas) todo esté invertido y el signo siga significando "mejor o peor", para no leer al revés.
- US-5: Como analista, quiero que un equipo, jugador o quinteto con muestra insuficiente muestre su ficha pero no distorsione el promedio, el líder ni los percentiles de los demás.
- US-6: Como entrenador, quiero que la ficha cambie cuando cambio el filtro (competencia, últimos 5 partidos) e indique cuál es la referencia, para no comparar contra otra población sin saberlo.
- US-7: Como entrenador, quiero ver el ranking completo de la métrica al pasar el cursor (o tocar) con mi entidad resaltada, para ubicarme entre los demás.
- US-8: Como analista, quiero que el puesto, el líder y el promedio de la ficha coincidan con la tabla de Liga, para poder verificarlos.

## 4. Requisitos funcionales
- **RF-1 — Cinco elementos.** Toda métrica del conjunto estándar (T-05) de equipo, jugador, quinteto, ON/OFF y cierre DEBE mostrarse con: valor, ranking, distancia al líder (con nombre y valor del líder), distancia al promedio (con signo y valor del promedio) y percentil. (US-1, US-2, US-3) (Esp. v2 §3 T-01)
- **RF-2 — Valor primero.** El valor absoluto DEBE estar siempre visible y en primer lugar; si es nulo se muestra "—" con la razón y la ficha no muestra ranking, distancias ni color. (US-1) (Esp. v2 §3 T-01; §2 C-11)
- **RF-3 — Ranking con total y empates.** El ranking DEBE indicar siempre el puesto y el total de la población ("7.º de 12"). Con empates, las entidades con el mismo valor comparten puesto, la siguiente salta (1, 2, 2, 4) y se marca el empate. (US-1) (Esp. v2 §3 T-01)
- **RF-4 — Líder.** El líder es la entidad de la población con el mejor valor (el mayor, o el menor si menos es mejor); ante un empate por el primer puesto gana el nombre alfabéticamente primero. La ficha muestra su nombre y su valor; si la entidad consultada es el líder, la distancia es 0. (US-2) (Esp. v2 §3 T-01)
- **RF-5 — Promedio de la competencia.** El promedio es la media aritmética de los valores de las entidades de la población de referencia (cada entidad con su valor de la selección), sin ponderar por partidos y sin nulos (DA-08). El mismo promedio se usa en la ficha, en la tabla de Liga y donde se muestre "Ø". (US-2, US-8) (Arq. §2.1; Esp. v2 §2 C-02)
- **RF-6 — Distancias orientadas.** Las distancias DEBEN ser positivas cuando la entidad es mejor que la referencia y negativas cuando es peor, en todas las métricas (incluidas las de menos es mejor): `dist_líder = s·(valor − líder)` (siempre ≤ 0 para un miembro de la población) y
  `dist_promedio = s·(valor − promedio)`, con `s = +1` si más es mejor y `s = −1` si menos es mejor (DA-09). Se expresan en las unidades de la métrica (puntos porcentuales en los porcentajes) y, cuando la magnitud lo justifica, también como porcentaje relativo a la referencia. La
  diferencia aritmética (sin orientar) se ofrece en el detalle (tooltip). (US-2, US-4) (Esp. v2 §3 T-01; Arq. §3.6)
- **RF-7 — Percentil.** El percentil DEBE ser un entero de 0 a 100: `100 × (B + 0,5 × E) / N`, con `N` = entidades de la población distintas de la consultada con valor, `B` = las estrictamente peores y `E` = las iguales (orientado por la dirección de la métrica). Se calcula igual para entidades dentro y fuera de la población. (US-3) (Arq. §3.6)
- **RF-8 — Escala de color.** El percentil DEBE pintarse con una escala continua: rojo en 0, gris en 50, verde en 100, interpolada linealmente entre los tres anclas. Un valor nulo o una métrica sin color de rendimiento (neutral) NO se pinta. El percentil se muestra también como texto ("p58"), de modo que el color no sea el único portador. (US-3) (Esp. v2 §3 T-01; §2 C-11)
- **RF-9 — Inversión completa.** En las métricas donde menos es mejor (DER, PTS recibidos, pérdidas, TO%, faltas cometidas, tapones recibidos, eFG%/TS%/FT Rate del rival, TO ratio, PER/pos), el líder es el valor más bajo, el ranking se ordena a la inversa, el percentil se calcula al revés y las distancias siguen orientadas (RF-6). (US-4) (Esp. v2 §3 T-01)
- **RF-10 — Población de referencia.** Pertenecen a la población: equipos con al menos 3 partidos en la competencia; jugadores con al menos 60 minutos; quintetos, ON/OFF y cierres con muestra igual o superior al mínimo efectivo de T-02. Los umbrales son configurables y no están fijos en el código. (US-5) (Esp. v2 §3 T-01, T-02)
- **RF-11 — Muestra baja fuera de la población.** Una entidad que no llega al mínimo DEBE recibir igualmente su ficha completa, marcada "muestra baja", con su ranking como posición hipotética dentro de la población y su percentil calculado contra ella, pero NO entra en el conteo del total, el líder, el promedio ni los percentiles de las demás. (US-5) (Esp. v2 §3 T-01)
- **RF-12 — Población insuficiente y sin universo.** Si la población de la métrica tiene menos de 3 entidades con valor, el ranking, el líder, el promedio, las distancias y el percentil DEBEN ser nulos con razón `poblacion_insuficiente`; si la vista abarca "todas las competencias" (sin universo) con razón `sin_universo`; si el contexto no es comparable, `contexto_no_comparable`. (US-5) (Arq. §3.6, §7.4)
- **RF-13 — Selección activa.** La población, el ranking, el líder, el promedio y los percentiles DEBEN calcularse sobre la misma selección que la pantalla (competencia y, en esta fase, últimos N partidos), aplicada a todas las entidades por igual (cada equipo con sus últimos N), y la ficha DEBE indicar la referencia ("14 equipos · Últimos 5 partidos"). Las demás dimensiones del selector global se incorporan con T-03 (§8). (US-6) (Esp. v2 §3 T-01)
- **RF-14 — Ranking completo.** Al pasar el cursor (escritorio) o tocar (móvil) la ficha, el sistema DEBE mostrar el ranking completo de la métrica en la población, con la entidad consultada resaltada, las entidades fuera de la población en una sección aparte y el promedio; en móvil se presenta como hoja inferior que se puede cerrar. (US-7) (Esp. v2 §3 T-01)
- **RF-15 — Reemplazo de "Ø liga / ↑ x".** El bloque "Ø <promedio>" de `statBox` y sus usos DEBEN reemplazarse por la ficha en Equipo y Jugador; ninguna pantalla DEBE volver a mostrar una variación porcentual contra el mejor o el promedio (p. ej. "↑ 9900,0 %") calculada fuera de la ficha. (US-1, US-8) (Esp. v2 §3 T-01; §2 C-02)
- **RF-16 — Valor ajustado.** Cuando una métrica tiene valor ajustado por T-02 (OER, DER y Net Rating de entidades tipo quinteto), el ranking, el percentil, el líder y el promedio DEBEN calcularse sobre el valor ajustado. (US-5) (Arq. §3.6)
- **RF-17 — Coherencia con Liga.** El puesto, el líder y el promedio de la ficha de un equipo DEBEN coincidir con los de la tabla de ranking de Liga; la tabla DEBE mostrar la posición y el percentil de cada celda, marcar los equipos fuera de la población y ofrecer el promedio y el líder de cada columna. (US-8) (Esp. v2 §3 T-01 "Criterio de aceptación")
- **RF-18 — Cantidades por partido.** Para las métricas de conteo y de volumen, el ranking, el líder y el promedio DEBEN compararse por partido (equipos con distinta cantidad de partidos no son comparables en totales), y la ficha DEBE indicarlo cuando el valor mostrado está en totales. (US-1) (Esp. v2 §3 T-01 "población"; §3 T-04)
- **RF-19 — Una sola ficha.** La misma métrica, entidad y selección DEBE mostrar los mismos cinco elementos en cualquier pantalla (cards, panel estándar, tablas). (US-8) (Esp. v2 §3 T-01; §1.1)

## 5. Requisitos de datos / API
Sin tablas ni columnas nuevas (el percentil, el ranking y el promedio se calculan al vuelo y no se persisten; Constitución 4).

**Endpoints.**
- `GET /api/rankings/<entity_type>/<metric_key>?id=<id>[&competition=&last=&base=]` — NUEVO. `entity_type ∈ {team, player, lineup, onoff, clutch}`. Respuesta = Arq. §7.1b (`entity_type`, `metric`, `direction`, `population{size, criterion, competition_id, context_label}`, `rows[]`, `outside_population[]`, `avg`). Errores 400 (tipo o métrica desconocida, métrica que no aplica al tipo, competencia inexistente); con población vacía o sin universo responde 200 con `rows` vacío y la razón en `population.reason`.
- `GET /api/metrics/<entity_type>` (T-05) y los bloques `standard` de `GET /api/team|player` — modificados: cada métrica agrega los campos de la ficha (`rank`, `rank_total`, `tied`, `in_population`, `percentile`, `avg`, `dist_avg`, `dist_avg_rel`, `leader{id,name,value}`, `dist_leader`, `dist_leader_rel`, `pct_reason`, `basis`) según Arq. §7.1.
- `GET /api/league` — modificado: cada fila agrega `in_population`, `rank{clave:{rank,total,tied}}` y `pct{clave:p}`; con `include=summary` devuelve `{teams[], avg{}, leaders{}, population{}}` (lista sin cambios si no se pide).
- Configuración (F-13): se activan `population.min_size`, `sample.team.min/high`, `sample.player.min/high` (consumidores T-01/T-02).

## 6. Estados de UI
Ficha (componente reusado en Equipo, Jugador, panel estándar, Liga, tablas). Copy NUEVO a agregar a `docs/frontend.md`:
- **Cargando:** la ficha se pinta con el valor y "…" en ranking/percentil hasta que llega la respuesta (la ficha viaja en la misma respuesta que el valor: normalmente no hay estado intermedio).
- **Éxito (tarjeta):** valor; "7.º de 12" (con "=" si hay empate: "=7.º de 12"); "Líder: Peñarol 1,15 (−0,06)"; "Ø 1,07 (+0,02)"; chip "p58" coloreado. Ayuda de la selección: "Referencia: 12 equipos · Últimos 5 partidos".
- **Tooltip de distancia:** "Diferencia: −0,06 (menos es mejor: valor − líder = +0,06)"; para porcentajes: "−2,1 pp".
- **Muestra baja:** chip "Muestra baja · fuera de la población" y texto "No entra en promedios, líder ni percentiles".
- **Población insuficiente:** "Sin referencia: la población tiene menos de {n} entidades"; **sin universo:** "Elegí una competencia para ver el ranking"; **contexto no comparable:** "Este filtro no tiene una población comparable".
- **Hover/tap:** título "Ranking — {métrica}", filas "{puesto}. {nombre} {valor}" (la consultada en negrita y con fondo), sección "Fuera de la población (muestra baja)", pie "Ø {promedio} · {n} entidades". Error: "No se pudo cargar el ranking". Móvil: hoja inferior con botón "Cerrar".
- **Vacío:** población sin entidades → "Sin datos para armar el ranking".
- **Sin conexión (service worker):** `/api/*` va siempre a la red; la ficha ya recibida sigue visible, el ranking completo muestra "No se pudo cargar el ranking".
- **Liga:** columna "#" muestra el puesto de la métrica ordenada; las filas fuera de la población se atenúan con el chip "Muestra baja"; pie de tabla con las filas "Líder" y "Ø competencia".

## 7. Criterios de aceptación
- **CA-1 (CA del cliente):** Given la ficha de una métrica cualquiera de un equipo; When se compara con la tabla de ranking de la sección Liga ordenada por esa métrica; Then el puesto, el líder y el promedio mostrados coinciden con los de la tabla.
- **CA-2 (cinco elementos):** Given un equipo con valor en OER; When se abre su card de Equipo; Then se ven el valor, "N.º de M", el líder con nombre y distancia, el promedio con distancia con signo y el percentil con color.
- **CA-3 (inversión):** Given DER (menos es mejor) de un equipo con DER menor que el promedio y mayor que el líder; When se ve su ficha; Then el líder es el equipo de DER más bajo, el ranking es 1 para el DER más bajo, el percentil es mayor que 50, la distancia al promedio es positiva, la distancia al líder es negativa y el tooltip muestra la diferencia aritmética con el signo contrario.
- **CA-4 (empates):** Given dos equipos con el mismo valor en una métrica en el puesto 2; When se ven sus fichas; Then ambos muestran "=2.º de M", el siguiente equipo muestra 4.º, y sus percentiles son iguales.
- **CA-5 (percentil):** Given una población de 12 equipos y un equipo con 5 peores, 1 igual y 5 mejores (excluido el propio); Then su percentil es `100 × (5 + 0,5) / 11 = 50`; y un equipo líder único tiene percentil 100 × (11 + 0) / 11 = 100 (mid-rank sin la propia entidad).
- **CA-6 (color):** Given percentiles 0, 25, 50, 75 y 100; When se pinta; Then 0 es rojo (#ef4444), 50 es gris (#8b949e), 100 es verde (#22c55e) y 25/75 son los puntos medios lineales entre anclas; un valor nulo o una métrica neutral no tiene color.
- **CA-7 (muestra baja):** Given un equipo con 2 partidos (menos que `sample.team.min`) en una competencia con otros 10 equipos calificados; When se ve su ficha; Then muestra el chip "Muestra baja", su ranking es hipotético y `in_population` es falso, y el total, el líder y el promedio de las demás fichas no cambian si ese equipo se agrega o se quita.
- **CA-8 (población insuficiente / sin universo):** Given una competencia con 2 entidades calificadas (`population.min_size = 3`); When se ve una ficha; Then ranking, líder, promedio, distancias y percentil son nulos con razón `poblacion_insuficiente` y el valor se ve igual; y given `competition=all`, la razón es `sin_universo`.
- **CA-9 (selección):** Given `last=5`; When se ve la ficha de un equipo; Then la población, el líder y el promedio corresponden a los últimos 5 partidos de cada equipo, la ficha lo indica ("Últimos 5 partidos") y, al volver a "Todos", los números vuelven a los de la temporada.
- **CA-10 (hover/tap):** Given una ficha; When se pasa el cursor (o se toca en móvil); Then aparece el ranking completo de la población con la entidad resaltada, las entidades fuera de la población aparte y el promedio; en móvil se presenta como hoja inferior con botón "Cerrar".
- **CA-11 (reemplazo):** Given las pantallas Equipo y Jugador; When se recorren; Then no queda ningún "Ø" suelto de `statBox` ni "↑ x"; todas las métricas con ficha usan el componente; buscar en la UI "9900" y "1050" no encuentra variaciones.
- **CA-12 (nulos):** Given una métrica con valor nulo (p. ej. `blk_received` antes del reproceso o AS/PER sin pérdidas); When se ve la ficha; Then muestra "—" con su razón, sin ranking, distancias ni color, y esa entidad no cuenta en el total de la métrica.
- **CA-13 (ajustado):** Given un quinteto con valor ajustado de Net Rating; When se ve su ficha de Net Rating; Then el ranking y el percentil son los del valor ajustado, y el endpoint de ranking completo ordena por el ajustado.
- **CA-14 (consistencia entre pantallas):** Given un equipo y la métrica OER; When se ve su ficha en Equipo, en el panel estándar y en `GET /api/rankings/team/oer`; Then el puesto, el total, el líder y el promedio son los mismos.
- **CA-15 (conteos por partido):** Given la métrica `pts` en base "Totales" para un equipo con más partidos que otros; When se ve la ficha; Then el ranking y el promedio son por partido (la ficha indica "por partido") y el valor mostrado sigue siendo el total.
- **CA-16 (configuración):** Given `sample.team.min = 2`; When se vuelve a pedir la ficha; Then la población incluye a los equipos con 2 partidos, los totales de ranking cambian de acuerdo y sin reiniciar el servidor; restituir el valor por defecto deja los números originales.
- **CA-17 (UI móvil):** Given 360 px de ancho; When se ven las cards con ficha; Then no hay scroll horizontal de página, el texto es ≥ 11 px y la hoja inferior del ranking cabe en pantalla con scroll interno.
- **CA-18 (Liga):** Given la tabla de Liga; When se ordena por una columna; Then la columna "#" muestra el puesto de esa métrica, los equipos fuera de la población aparecen atenuados con "Muestra baja", y el pie muestra el líder y el promedio de la columna.

## 8. Fuera de alcance
- INCREMENTO DIFERIDO (→ T-03, [../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)): recalcular la ficha sobre las demás dimensiones del selector global (sede, rival, cuarto, marcador, con/sin jugador, descanso, dimensiones de posesión). En esta fase la selección es competencia + últimos N; `population()` ya recibe el `Context` completo (Arq. §9.2 I-08), por lo que T-03 no obliga a retrabajo.
- INCREMENTO DIFERIDO (→ T-04, [../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md)): población y ficha en las bases por 40 minutos y por 100 posesiones.
- INCREMENTO DIFERIDO (→ T-06, [../16-T-06-tablas-completas-exportacion/spec.md](../16-T-06-tablas-completas-exportacion/spec.md)): coloreado por percentil, promedio y totales en las tablas completas (usan las mismas funciones de `population.py`).
- INCREMENTO DIFERIDO (→ C-03, [../17-C-03-mapas-tiro-ppt-tooltip/spec.md](../17-C-03-mapas-tiro-ppt-tooltip/spec.md)): percentil de PPT por zona (tipo de entidad `zone`).
- INCREMENTO DIFERIDO (→ cada dueño de entidad): población de pareja (A-08), emparejamiento (F-07), cuarto/tramo (F-04), split (T-03), origen/tipo/oportunidad/tramo de reloj (A-02…A-05) y cadena (A-07); registran su enumerador al construirse.
- INCREMENTO DIFERIDO (→ F-14, F-17, A-10): tarjetas de líderes, plan de juego y frases automáticas (consumen estas funciones; no se construyen aquí).
- Radar de equipo/jugador, evolución por partido y línea de promedio del mapa de liga (`charts.js` sigue usando `league_averages` salvo el Ø del mapa de liga, que pasa a leer el promedio de la población).
- La pantalla Comparar (`winCls`) y Buscar mantienen su presentación actual (F-05/T-06).
- Persistir percentiles (Constitución 4).

## 9. Ambigüedades
- [DECISIÓN CONFIRMADA — default de arquitectura] **Promedio y percentil (DA-08, DA-09, Arq. §3.6).** Promedio = media de los valores de las entidades de la población (incluida la consultada si pertenece); percentil mid-rank que **excluye** a la propia entidad; distancias orientadas con la diferencia aritmética en el tooltip. Es la combinación que cierra con los ejemplos del cliente (7.º de 12, +0,02, p58).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Total del ranking** = entidades de la población con valor en esa métrica (no el tamaño de la población bruta): si 3 de 12 equipos tienen la métrica nula, el total es 9. Con entidad fuera de la población el puesto es hipotético y el total no la incluye.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Mínimo de población.** "Población insuficiente" = menos de `population.min_size` (3) entidades con valor en la métrica, contando a la consultada si pertenece (reformulación de Arq. §3.6: `N' + 1 < min_size`). Con el seed y los umbrales por defecto no hay población de equipos (ningún equipo llega a 3 partidos).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Conteos y volumen se rankean por partido.** Con base "Totales" el valor mostrado es el total pero el ranking, el líder y el promedio son por partido y la ficha lo rotula. Alternativa descartada: ranking sobre totales (premia al equipo con más partidos jugados).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Neutrales.** Las métricas sin color de rendimiento (uso de triple, USO%, volumen, etc.) muestran ranking y percentil pero sin color ni signo "mejor/peor"; se rankean como si más fuera mejor y la ficha lo aclara ("sin juicio de rendimiento").
- [DECISIÓN CONFIRMADA — default de arquitectura] **Porcentaje relativo** solo en métricas no porcentuales, no firmadas y no neutrales, y solo si |referencia| ≥ 0,05 (para evitar divisiones por casi cero); en porcentajes se muestran puntos porcentuales ("−2,1 pp").
- [DECISIÓN CONFIRMADA — default de arquitectura] **Escala de color.** Interpolación lineal en RGB por tramo entre #ef4444 (0), #8b949e (50) y #22c55e (100); el texto "pNN" acompaña siempre (accesibilidad). Los colores de texto sobre el fondo con transparencia 18 % mantienen contraste ≥ 4,5:1 en los dos temas (se verifica en T-F).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Población de ON/OFF y cierres.** ON/OFF: un jugador por equipo, estado ON, muestra = el menor de ON y OFF; cierres: un equipo por entrada, muestra = posesiones del agregado de cierre con los umbrales de `split` de T-02 (el cliente no fija un umbral propio del cierre de equipo, T-02 §9).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Población de quintetos por tamaño.** La población de un quinteto son los quintetos de 5 jugadores de todos los equipos de la competencia; la de una combinación de 3 o 4 jugadores son las combinaciones del mismo tamaño (se calcula bajo demanda).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Valores de Liga.** Para que la tabla coincida con la ficha, `GET /api/league` pasa a devolver el cociente de totales (pooled) en OER, DER, NRtg, eFG%, TS%, OR%, DR%, TO%, PACE; los números de la tabla pueden moverse respecto de hoy (promedio de tasas por partido) y de TO% (DA-04). Se documenta con una tabla antes/después en `progress.md`.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Hover en móvil:** no existe; el toque en la ficha abre la hoja inferior, un segundo toque fuera la cierra. Las cards de Equipo y Jugador conservan su navegación habitual.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Dependencia de `cache.py`.** Calcular poblaciones en cada petición es costoso con quintetos; se usa el caché por versión de datos de la arquitectura (§3.14). F-11 lo difirió; si no existe al implementar, T-01 lo crea con la firma de la arquitectura (plan §10).
