# Spec — Feature 12: nulos — orden, color y DNP (cierre transversal de C-11)

> **Requisito C-11 del cliente** (`Smart-Basket Especificacion v2.docx` §1, P0). Continuación directa de
> `sdd/specs/08-nulos-vs-cero/`: aquella feature separó `null` de `0` en el **cálculo**; esta cierra los
> tres comportamientos que quedaron fuera (**orden**, **color**, **DNP**) y ejecuta la auditoría de
> recorrido completo que el cliente pide como criterio de aceptación.
> Corte y orden: `sdd/ROADMAP-bloque-C.md` §2 y §4.

## 1. Objetivo
Que un dato inexistente no se comporte nunca como un cero: ni al ordenar una tabla, ni al pintar un
color de rendimiento, ni al contar los partidos sobre los que se promedia a un jugador.

## 2. Fuentes (trazabilidad)

**Requisito del cliente (C-11)** — tabla `0` vs `NULL` y sus cuatro reglas:
- *"Un NULL nunca entra en un promedio ni en un denominador."*
- *"Un NULL nunca se ordena como si fuera 0: en tablas ordenables va siempre al final, en ambos sentidos."*
- *"Un NULL nunca se pinta con color de rendimiento (verde/rojo)."*
- *"Los partidos con DNP no cuentan como partido jugado en los promedios del jugador."*
- CA del cliente: *"recorrido completo de la app sin encontrar un solo 0 que en realidad sea un dato inexistente."*

**Spec previa (base, no se re-especifica):**
- `sdd/specs/08-nulos-vs-cero/spec.md` RF-1…RF-6 — semántica `null` en tasas, exclusión de nulos en
  promedios, render `"—"` neutral. **Cerrada y verificada** (CA-1…CA-6 ✅).
- `sdd/specs/08-nulos-vs-cero/progress.md` §Desviaciones y §Deuda — registra explícitamente lo que
  quedó abierto: `charts.js` (`?? 0` en evolución), sentinels `ast_to`/`def_to_ratio`, y el fallback
  `{avg:0,best:0}` de `league_averages()`.

**Docs:**
- `docs/metrics.md` §"Nulo vs cero" (línea 5) — contrato vigente: tasa con denominador 0 → `null`;
  los promedios excluyen nulos; los conteos conservan su 0 real.
- `docs/metrics.md` §Rebotes — `Reb Share (jugador) = TRB_jugador / TRB_equipo` (es una **tasa**:
  tiene denominador, luego cae bajo la regla de nulo).
- `docs/api.md` §"Nulo vs cero en métricas de tasa" — contrato de respuesta: las tasas pueden ser `null`.
- `docs/frontend.md` — vistas afectadas (Equipo, Jugador, Liga, Comparar, Buscador, Cierres) y el
  placeholder `"—"` como copy existente para "sin dato".

**Código (estado verificado sobre el repo, no supuesto):**
- `frontend/js/app.js` `statClass` (17-20) — `value == null || avg == null → "neutral"`. **Ya cumple** la
  regla de color; esta feature lo verifica y audita los coloreos que no pasan por este helper.
- `frontend/js/app.js` `_sortedLeague` (438-447) — `if (va == null) return 1` sin multiplicar por la
  dirección. **Ya cumple** la regla de orden. Es el patrón de referencia.
- `frontend/js/app.js` `_drawClutchTable` (639-646) — `if (av == null) av = -Infinity` multiplicado por
  `_clutchSort.dir`. **No cumple**: los nulos quedan primeros en orden ascendente.
- `frontend/js/app.js` `_renderSearchResults` (1564-1571) — mismo patrón que Cierres. **No cumple**.
- `frontend/js/app.js` `_drawClutchTable` `cell()` (651) — la celda de diferencia pinta color por
  comparación directa (`v > 0` / `v < 0`) sin pasar por `statClass`, y concatena `v` sin guarda de nulo.
- `backend/app.py` `player_stats` (572-576) — `reb_share`, `oreb_share`, `dreb_share` caen a `0` cuando el
  denominador del equipo es 0 o no hay fila de equipo. **No cumple**: son tasas, deben ser `null`.
- `backend/app.py` `player_stats` `_avg` (596-599) y `"games": len(game_log)` (618) — promedian y cuentan
  sobre **todas** las filas de `player_game_stats`, incluidos los partidos sin minutos.
- `frontend/js/charts.js` (206, 218, 279, 290) — `g.oer ?? 0`, `(g.efg_pct ?? 0)`, `g.pts ?? 0`: las líneas
  de evolución dibujan un punto en 0 cuando el valor es `null`.
- `frontend/js/charts.js` `_norm` (40) — normalización del radar; mapea el nulo a 0.
- `backend/app.py` `_parse_minutes` (774) — parseo existente del campo `minutes` (texto), reusable para
  determinar si hubo minutos disputados.

## 3. Historias de usuario
- **US-1**: Como analista, quiero ordenar una tabla por cualquier columna y ver siempre arriba a los que
  tienen dato, para que los jugadores sin ese dato no encabecen el ranking al ordenar de menor a mayor.
- **US-2**: Como entrenador, quiero que una celda sin dato se vea neutra, para no leer un rojo como
  "rindió mal" cuando en realidad no hay información.
- **US-3**: Como entrenador, quiero que los partidos en los que un jugador no jugó no le bajen sus
  promedios, para que su promedio de puntos refleje lo que hace cuando juega.
- **US-4**: Como analista, quiero que el gráfico de evolución no dibuje una caída a cero en un partido
  sin dato, para no leer un bajón que no existió.

## 4. Requisitos funcionales

- **RF-1**: En toda tabla ordenable, los registros con valor `null` en la columna de orden DEBEN quedar
  al final, **tanto en orden ascendente como descendente**. · (US-1, C-11 regla 2) · Alcance verificado:
  tabla de Liga (ya conforme, sirve de patrón), tabla de Cierres, tabla del Buscador. Regla: la posición
  del nulo NO depende del sentido de orden — el nulo se aparta de la comparación, no se le asigna un
  valor extremo.

- **RF-2**: En el orden por columnas de texto, un valor `null` DEBE recibir el mismo tratamiento que en
  RF-1 (al final en ambos sentidos), no compararse como cadena vacía. · (US-1, C-11 regla 2)

- **RF-3**: Ninguna celda con valor `null` DEBE recibir color de rendimiento (verde/rojo). · (US-2,
  C-11 regla 3) · Incluye los coloreos que no pasan por el helper central de clase de stat: cada punto
  de la UI que decide color por comparación numérica directa debe tratar el nulo como neutro.

- **RF-4**: Ninguna celda con valor `null` DEBE renderizar el texto crudo del nulo (`"null"`, `"NaN"`,
  `"undefined"`). DEBE mostrar el placeholder `"—"`. · (US-2, C-11 "Se muestra '—', nunca 0")

- **RF-5**: Las métricas de **participación en el rebote del equipo** (`Reb Share` y sus variantes
  ofensiva y defensiva) DEBEN valer `null` cuando su denominador es 0 o cuando no se dispone del total
  del equipo para ese partido — no `0`. · (US-2, `docs/metrics.md` §Rebotes, `08-nulos-vs-cero` RF-1)
  · Son tasas: `Reb Share = TRB_jugador / TRB_equipo`. Quedaron fuera del alcance literal de RF-1 de la
  Feature 08 y conservan el fallback a `0`.

- **RF-6**: Un partido **DNP** (jugador en la ficha del partido sin minutos disputados) NO DEBE contar
  como partido jugado en ningún promedio del jugador — ni de tasa ni de conteo. · (US-3, C-11 regla 4)
  · Definición de DNP para esta feature: minutos disputados igual a 0 o ausentes. Un partido con minutos
  y 0 puntos SÍ cuenta (ese 0 es real — `08-nulos-vs-cero` RF-2/CA-5).

- **RF-7**: El total de partidos que la app reporta para un jugador DEBE ser el de partidos **jugados**,
  coherente con el denominador usado en sus promedios (RF-6). · (US-3, C-11 regla 4)

- **RF-8**: Los gráficos de evolución por partido NO DEBEN dibujar un punto en 0 para un partido cuyo
  valor es `null`: deben omitir el punto. · (US-4, `08-nulos-vs-cero/progress.md` §Deuda)

- **RF-9**: El gráfico radar DEBE representar una métrica `null` sin afectar la lectura del resto de los
  ejes, y sin presentarla como el peor valor posible del eje. · (US-4, `08-nulos-vs-cero/progress.md`
  §Desviaciones — `_norm()` mapea `null → 0`)

- **RF-10**: El recorrido completo de la aplicación NO DEBE presentar ningún `0` que represente un dato
  inexistente, en ninguna vista. · (US-2, C-11 criterio de aceptación literal) · Se satisface con una
  auditoría documentada vista por vista, no con una muestra: el resultado se registra en `progress.md`
  con el estado de cada pantalla.

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Cambio | Nuevo? |
|---|---|---|---|
| (ninguna tabla) | — | Sin cambio de esquema. Las métricas se calculan on-the-fly (Constitución 4) → el cambio aplica retroactivamente a todo el histórico, sin migración ni `upgrade_db()`. | No |
| `GET /api/player/<team_code>/<player_name>` | existente | **Cambio de contrato (a):** `reb_share`, `oreb_share`, `dreb_share` pueden devolver `null` donde antes devolvían `0` (RF-5). **Cambio de contrato (b):** el total de partidos reportado y los valores de `averages` pasan a calcularse solo sobre partidos jugados; un jugador con DNP verá cambiar sus promedios y su recuento (RF-6, RF-7). El `game_log` sigue devolviendo **todas** las filas, incluidos los DNP — se excluyen del promedio, no de la historia. | Cambio de contrato — se documenta en `docs/api.md` al cerrar |
| `GET /api/team/<team_code>`, `GET /api/league` | existentes | Sin cambio de contrato. Entran solo en la auditoría de RF-10. | No |

> Contrato heredado de `08-nulos-vs-cero` y vigente: `null` = "sin dato / sin intentos"; `0` = "valor
> real cero". Esta feature no lo redefine — lo extiende a orden, color y población de promedio.

## 6. Estados de UI

No agrega vista. Modifica el comportamiento de render y orden de las vistas existentes.

| Vista / Componente | loading | vacío | error | sin conexión (SW) | éxito |
|---|---|---|---|---|---|
| Tabla de Liga | sin cambio | sin cambio | sin cambio | sin cambio | orden ya conforme — se verifica, no se toca |
| Tabla de Cierres | sin cambio | sin cambio | sin cambio | sin cambio | filas con dato primero; las de valor nulo al final en ambos sentidos, con `"—"` en la celda |
| Tabla del Buscador | sin cambio | `"Ningún jugador cumple los filtros"` (copy existente) | sin cambio | sin cambio | ídem Cierres |
| Cards de stats (Equipo / Jugador) | sin cambio | sin cambio | sin cambio | sin cambio | celda nula: `"—"` en color neutro, nunca verde/rojo |
| Perfil de jugador — recuento de partidos | sin cambio | sin cambio | sin cambio | sin cambio | refleja partidos jugados (RF-7) |
| Gráfico de evolución | sin cambio | sin cambio | sin cambio | sin cambio | el partido sin dato no dibuja punto (corte en la línea), no un punto en 0 |
| Gráfico radar | sin cambio | sin cambio | sin cambio | sin cambio | eje sin dato no se lee como el peor valor del eje |

**Copy**: sin copy nuevo. `"—"` es el placeholder existente para "sin dato" (`docs/metrics.md` §Nulo vs
cero, `docs/frontend.md`). El service worker no cambia: sigue siendo network-first para `/api/`.

## 7. Criterios de aceptación

- **CA-1**: Given la tabla del Buscador con al menos un jugador cuyo valor en una columna numérica es
  `"—"`, When se ordena esa columna **de menor a mayor**, Then las filas con `"—"` quedan al final
  (no encabezan la tabla).
- **CA-2**: Given la misma tabla, When se ordena esa columna **de mayor a menor**, Then las filas con
  `"—"` siguen al final.
- **CA-3**: Given la tabla de Cierres con al menos una fila de valor nulo en la columna ordenada,
  When se alterna el sentido de orden, Then las filas nulas quedan al final en ambos sentidos.
- **CA-4**: Given cualquier celda que muestra `"—"`, When se inspecciona su estilo, Then no tiene clase
  de rendimiento positivo ni negativo (color neutro).
- **CA-5**: Given cualquier vista de la app, When se recorre en el navegador, Then ninguna celda muestra
  el texto `"null"`, `"NaN"` ni `"undefined"`.
- **CA-6**: Given un jugador de un equipo cuyo total de rebotes en un partido es 0 (o sin fila de equipo
  para ese partido), When se consulta su perfil, Then `Reb Share` de ese partido es `null` y se muestra
  `"—"`, no `0.00`.
- **CA-7**: Given un jugador con 3 partidos jugados (10, 12 y 14 puntos) y 1 partido DNP, When se consulta
  su perfil, Then el promedio de puntos es **12,0** (no 9,0) y el recuento de partidos indica **3**.
- **CA-8**: Given ese mismo jugador, When se ve su game log, Then el partido DNP **sigue apareciendo** en
  la lista (se excluye del promedio, no de la historia).
- **CA-9**: Given un jugador con un partido de 0 minutos y otro de 20 minutos y 0 puntos, When se calcula
  su promedio de puntos, Then el partido de 20 minutos SÍ aporta su 0 real y el DNP no aporta nada.
- **CA-10**: Given un gráfico de evolución de un equipo o jugador con un partido de valor `null`,
  When se renderiza, Then la línea no baja a 0 en ese partido.
- **CA-11**: Given el recorrido completo de la app (Importar, Liga, Equipo, Jugador, Comparar, Buscador,
  Cierres, Combinaciones, ON/OFF, mapas de tiro), When se revisa cada pantalla, Then no aparece ningún
  `0` que represente un dato inexistente, y el estado de cada pantalla queda registrado en `progress.md`.
- **CA-12**: Given ese mismo recorrido, When se observa la consola del navegador, Then no hay errores JS
  nuevos respecto de la línea base (el `404` de `favicon.ico` es preexistente — Feature 01).

## 8. Fuera de alcance

- **Umbrales de muestra mínima y badge BAJA/MEDIA/ALTA** — es T-02 del Bloque T. C-11 decide únicamente
  `null` vs `0`; no introduce el concepto de "muestra insuficiente" ni pinta gris por pocas posesiones.
- **Percentiles y color continuo rojo-gris-verde** — es T-01. Esta feature no cambia la escala de color,
  solo garantiza que el nulo quede fuera de ella.
- **El fallback `{avg:0, best:0}` de los promedios de liga** — misma familia de bug, pero pertenece a
  **Feature 14** (C-02) según `ROADMAP-bloque-C.md` §3.2. No se toca acá para no partir el requisito
  entre dos specs.
- **Los sentinels `ast_to` / `def_to_ratio` = 99.0 cuando no hay pérdidas** — `08-nulos-vs-cero/progress.md`
  los dejó pendientes de confirmación con el cliente. No son un "0 que debería ser —": representan un dato
  real ("jugó sin perder la pelota"). Siguen como deuda abierta de Feature 08.
- **Reclasificar qué métrica es tasa y cuál es conteo** más allá de agregar `Reb Share` (RF-5). La
  clasificación vigente es la de `08-nulos-vs-cero` RF-1/RF-2.
- **Rediseñar la interpolación de los gráficos** más allá de no dibujar un 0 falso (RF-8) y no leer el
  nulo como peor valor del radar (RF-9).
- **Corregir el origen de los DNP en la importación** — que un jugador figure en la ficha sin minutos es
  un dato correcto de FIBA LiveStats, no un error de carga.

## 9. Ambigüedades

- **[RESUELTA] ¿Qué cuenta como DNP?** → **Decisión**: minutos disputados igual a 0 o ausentes en la ficha
  de ese partido. *Justificación*: es el único criterio disponible en los datos ya persistidos y coincide
  con la lectura del cliente ("jugador sin minutos (DNP)" en la tabla de C-11). No se usa la presencia de
  la fila: un jugador convocado y no utilizado igual tiene fila.

- **[RESUELTA] ¿El DNP se excluye solo de las tasas o también de los conteos?** → **Decisión**: de **ambos**.
  C-11 dice "no cuentan como partido jugado en los promedios del jugador", sin distinguir. *Justificación*:
  es el punto donde esta feature va más allá de `08-nulos-vs-cero` — allí un 0 de conteo siempre contaba
  (RF-2/CA-5); acá se agrega la condición previa de que el partido haya sido jugado. No hay contradicción:
  un 0 en un partido jugado sigue contando (CA-9).

- **[RESUELTA] ¿El game log debe ocultar los partidos DNP?** → **Decisión**: no, siguen visibles (CA-8).
  *Justificación*: el DNP es información para el entrenador (quién no jugó y cuándo). C-11 lo excluye del
  **promedio**, no de la historia.

- **[RESUELTA] ¿Cambiar el recuento de partidos rompe alguna pantalla que dependa de ese número?**
  → **Decisión**: se asume cambio de contrato y se documenta en `docs/api.md` (§5). *Justificación*: hoy el
  número es incorrecto según C-11; mantenerlo por compatibilidad perpetuaría el bug. El Paso 2 debe
  auditar cada consumidor de ese campo antes de cambiarlo.

- **[RESUELTA] ¿Cómo se representa un eje nulo en el radar sin romper el polígono?** → **Decisión**: el
  spec fija el requisito (RF-9: no leerse como el peor valor del eje) y **deja la técnica al Paso 2**
  (omitir el eje, o dibujarlo en el valor medio marcándolo). *Justificación*: la regla 2 de
  `01-specify.md` prohíbe diseñar en el spec.
