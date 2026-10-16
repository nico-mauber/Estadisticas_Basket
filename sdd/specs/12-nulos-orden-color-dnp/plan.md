# Plan — Feature 12: nulos — orden, color y DNP

> Spec: `sdd/specs/12-nulos-orden-color-dnp/spec.md` (gate del Paso 1 pasado).
> Reglas: `sdd/02-plan.md`. Constitución: `sdd/README.md` §Constitución.

## 1. Enfoque

Tres problemas independientes que comparten una causa: el nulo se trata como un número.
La estrategia es **un único punto de decisión por problema**, reusado en todos los sitios, en vez de
parchar cada tabla y cada endpoint por separado.

- **Orden** → un comparador null-safe compartido en `app.js`. `_sortedLeague` ya implementa la
  semántica correcta: se extrae a helper y los otros dos sitios lo consumen. Cero lógica nueva.
- **DNP** → un predicado en `stats_engine.py` (donde ya vive `_parse_minutes`), consumido por los
  **tres** endpoints que promedian por jugador. `app.py` no decide qué es un DNP (Constitución 3).
- **Nulos residuales y gráficos** → `search_players` ya resuelve `reb_share` con `None`; se replica
  ese patrón en los dos endpoints que quedaron con `else 0`, y se quita el `?? 0` de `charts.js`.

Sin cambio de esquema, sin dependencias nuevas, sin endpoints nuevos. La única adición al contrato
es un flag por partido (`played`) que el frontend necesita para no divergir del backend al recalcular
promedios en el filtro de últimos N.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | service | `played(minutes)` — predicado DNP único de la app | RF-6 |
| `backend/app.py` | route | `player_stats`: `_avg` filtra DNP · `games` = jugados · `reb_share`/`oreb_share`/`dreb_share` → `None` · `played` en cada entrada del game log | RF-5, RF-6, RF-7 |
| `backend/app.py` | route | `team_players`: `games` = jugados · `avg_uso`/`avg_pts` sobre jugados · `avg_uso` sin dato → `None` | RF-6, RF-7 |
| `backend/app.py` | route | `search_players`: `games` = jugados · `_avg_count` y promedio de minutos sobre jugados | RF-6, RF-7 |
| `frontend/js/app.js` | js-view | `_cmpNullsLast(av, bv, dir)` — comparador compartido (extraído de `_sortedLeague`) | RF-1, RF-2 |
| `frontend/js/app.js` | js-view | `_sortedLeague`, `_drawClutchTable`, `_renderSearchResults` consumen el comparador | RF-1, RF-2 |
| `frontend/js/app.js` | js-view | `_drawClutchTable` `cell()`: celda de diferencia null-safe (color neutro + `"—"`) | RF-3, RF-4 |
| `frontend/js/app.js` | js-view | `_computeAvg`: excluye del promedio las entradas con `played === false` | RF-6 |
| `frontend/js/app.js` | js-view | `renderCompare`: `N1`/`D1` → `"—"`; helper `winCls` (clase neutra si falta un lado); `shootRow` omite el `%` sin dato; las 5 filas del desglose sin `\|\| 0` · **agregado en el Paso 4 tras la auditoría T-Z1 — ver progress.md D-7** | RF-3, RF-4 |
| `backend/app.py` | route | `team_stats`: `win_pct` → `None` sin partidos · **agregado tras T-Z1 — ver progress.md D-8** | RF-5 |
| `frontend/js/charts.js` | js-chart | evolución: `?? 0` → `null` (omite el punto) | RF-8 |
| `frontend/js/charts.js` | js-chart | `_norm`: valor nulo deja de mapear a 0 | RF-9 |
| `docs/api.md` | doc | Cambio de contrato de los 3 endpoints de jugador (Paso 4) | RF-5, RF-6, RF-7 |
| `docs/metrics.md` | doc | `Reb Share` entra en la nota "Nulo vs cero"; regla DNP (Paso 4) | RF-5, RF-6 |
| `docs/frontend.md` | doc | Regla de orden de nulos en tablas ordenables (Paso 4) | RF-1 |
| `sdd/specs/12-.../progress.md` | doc | Checklist de auditoría vista por vista | RF-10 |

**Matriz RF → archivo** (gate): RF-1 ✔ · RF-2 ✔ · RF-3 ✔ · RF-4 ✔ · RF-5 ✔ · RF-6 ✔ · RF-7 ✔ ·
RF-8 ✔ · RF-9 ✔ · RF-10 ✔ (`progress.md` + los archivos que la auditoría destape).

## 3. Backend — rutas y modelos

**Sin tabla ni columna nueva.** Sin `upgrade_db()`. Las métricas se calculan on-the-fly
(Constitución 4) → el cambio aplica retroactivamente a todo el histórico.

**Sin endpoint nuevo.** Tres endpoints existentes cambian su respuesta:

| Método + ruta | Cambio | Errores |
|---|---|---|
| `GET /api/player/<team_code>/<player_name>` | `games` pasa a contar solo partidos jugados · `averages.*` se calculan solo sobre jugados · `reb_share`/`oreb_share`/`dreb_share` pueden ser `null` · **cada entrada de `game_log` suma `played: bool`** | `404 {"error": "Jugador no encontrado"}` — sin cambio |
| `GET /api/players/<team_code>` | `games` solo jugados · `uso_pct` y `pts` promediados solo sobre jugados · `uso_pct` sin dato pasa de `0` a `null` | sin cambio |
| `GET /api/search/players` | `games` solo jugados · conteos y `minutes` promediados solo sobre jugados | sin cambio |

`game_log` sigue devolviendo **todas** las filas, incluidos los DNP (spec CA-8). El flag `played`
es lo que permite al frontend recalcular sin divergir (§6).

## 4. Backend — lógica

| Función | Módulo | Entrada / regla | RF |
|---|---|---|---|
| `played(minutes)` → `bool` | `stats_engine.py` (**nueva**) | `True` si los minutos disputados son > 0. Reusa `_parse_minutes`, que ya vive en este módulo y ya se importa en `app.py`. Punto único de definición de DNP — ninguna ruta la reimplementa (Constitución 3). | RF-6 |
| `player_stats._avg(key)` | `app.py` | Filtra a entradas con `played` antes de excluir `None`. Orden: primero se descarta el DNP (no jugó), después el nulo (jugó sin dato). Devuelve `None` si no queda ninguna. | RF-6 |
| `player_stats` — `reb_share`, `oreb_share`, `dreb_share` | `app.py` | Denominador 0 o sin fila de equipo → `None`. **Copiar literal el patrón ya vigente en `search_players`** (764-768), no escribir uno nuevo. `Reb Share = TRB_jugador / TRB_equipo` (`docs/metrics.md` §Rebotes) — fórmula sin cambios. | RF-5 |
| `team_players` — `avg_uso`, `avg_pts`, `games` | `app.py` | Promedios solo sobre filas jugadas. `avg_uso` sin ningún valor válido → `None` (hoy `0`): `USO%` es tasa. `avg_pts` sin partidos jugados → `None`. | RF-5, RF-6, RF-7 |
| `search_players` — `_avg_count`, `minutes`, `games` | `app.py` | Ídem: la población de promedio es la de partidos jugados. `_avg_metric` ya excluye `None` correctamente — no se toca. | RF-6, RF-7 |

Ninguna fórmula de `docs/metrics.md` cambia. Esta feature altera **la población sobre la que se
promedia**, no cómo se calcula cada métrica.

## 5. Frontend — capa API (api.js)

**Sin cambios.** Los tres endpoints ya están expuestos y sus firmas no cambian; solo cambia el
contenido de la respuesta. Cero `fetch()` nuevo fuera de `api.js` (Constitución 9).

## 6. Frontend — UI (app.js / charts.js)

**`_cmpNullsLast(av, bv, dir)` — helper nuevo, sección "Stat helpers" de `app.js`**

Semántica: el nulo se **aparta** de la comparación en vez de recibir un valor extremo — por eso su
posición no depende de `dir`, que es exactamente lo que exige RF-1.

- Ambos nulos → empate.
- `av` nulo → `1` (al final). `bv` nulo → `-1`. **Sin multiplicar por `dir`.**
- Ambos con dato: si alguno es texto → `dir × localeCompare`; si no → `dir × (av − bv)`.
- Cuenta como nulo también `NaN` (RF-4).

Es la lógica que `_sortedLeague` (438-447) ya aplica bien: se extrae y se reusa (Constitución:
reusar antes de crear). Los tres sitios pasan a llamarlo:

| Sitio | Estado hoy | Después |
|---|---|---|
| `_sortedLeague` (438-447) | correcto, inline | delega en el helper (sin cambio de comportamiento) |
| `_drawClutchTable` (639-646) | `av = -Infinity` × `dir` → nulos primero en ASC | delega |
| `_renderSearchResults` (1564-1571) | mismo bug | delega |

**`_drawClutchTable` `cell()` (651)** — la rama de diferencia pinta color por comparación directa
(`v > 0` / `v < 0`) sin pasar por `statClass`, y concatena `v` sin guarda: con `v` nulo imprimiría el
texto crudo. Se agrega guarda de nulo → `"—"` y clase neutra (RF-3, RF-4).

**`_computeAvg(gameLog)` (44-71)** — recalcula promedios en cliente cuando se filtra por competencia
o últimos N. Debe excluir las entradas con `played === false`, o los promedios del filtro divergen de
los del backend. Es el motivo por el que el contrato suma el flag `played` (§3).

**`statClass` (17-20)** — ya devuelve `"neutral"` con valor o promedio nulo. **No se toca**: se verifica
en la auditoría (RF-10) y sirve de referencia para los coloreos que no pasan por él.

**`charts.js` — evolución (206, 218, 279, 290)**: `g.oer ?? 0` → nulo, para que el punto se omita en
vez de dibujarse en 0 (RF-8). La línea queda cortada en ese partido: es la lectura honesta —
"no hay dato", no "cayó a cero".

**`charts.js` — `_norm` (40-53)**: hoy `if (!lg || value == null) return 0`, es decir el nulo se dibuja
como el peor valor posible del eje. Pasa a propagar el nulo para que el radar no dibuje ese vértice
(RF-9). Ver el trade-off en §10.

**Mobile-first**: no se agrega ni se reordena marcado. Las tablas afectadas ya viven dentro de
`.table-wrap` con scroll horizontal; el breakpoint `768px` y el nav inferior fijo no se tocan.

## 7. Navegación

Sin vistas ni hashes nuevos. El mapa de vistas de `docs/frontend.md` no cambia.

## 8. Contratos de datos

**Adición al game log de `GET /api/player/<team_code>/<player_name>`** (único campo nuevo):

```
game_log[].played : boolean   // NUEVO — false = DNP (sin minutos disputados)
```

**Campos que pasan a admitir `null` donde antes devolvían `0`:**

```
GET /api/player/...   → game_log[].{reb_share, oreb_share, dreb_share}
                        averages.{reb_share, oreb_share, dreb_share}
GET /api/players/...  → [].uso_pct
```

**Campos cuyo valor cambia sin cambiar de tipo** (misma clave, población distinta):

```
GET /api/player/...   → games, averages.*
GET /api/players/...  → games, uso_pct, pts
GET /api/search/...   → games, minutes, y los conteos promediados
```

Sin filas SQLAlchemy nuevas ni modificadas.

## 9. Manejo de errores y offline

Sin códigos HTTP nuevos. El `404 {"error": "Jugador no encontrado"}` de `player_stats` no cambia.

**Caso borde a cubrir explícitamente**: un jugador cuyos partidos son **todos** DNP. Con la población
vacía, todo promedio es `None` y el recuento es `0` — la vista debe mostrar `"—"` en las cards, no
romper ni devolver 404 (la ficha del jugador existe). Cubierto por el `else None` de cada promedio.

**Service worker**: sin assets nuevos → `STATIC[]` y la versión de `CACHE` en `sw.js` no cambian.
`/api/` sigue siendo network-first, así que no hay respuestas viejas cacheadas con la semántica previa.

## 10. Riesgos / decisiones

**D-1 · El flag `played` viaja en el contrato en vez de derivarse en el cliente.**
El frontend podría inferir el DNP desde los minutos del game log, pero eso duplicaría la definición de
DNP en dos lenguajes — exactamente el error que esta feature corrige. Un campo booleano explícito deja
`stats_engine.played()` como fuente única. Costo: un campo más por partido.

**D-2 · El radar propaga el nulo en vez de dibujarlo en el promedio de liga.**
Alternativa descartada: mapear el nulo a 50 (centro del eje). Se vería mejor, pero afirma "este equipo
está en el promedio de la liga" cuando no hay dato — el mismo tipo de mentira que C-11 viene a eliminar,
solo que en el centro del eje en vez de en el borde. Se propaga el nulo y el polígono queda con un
hueco. Si el hueco resulta ilegible en la verificación del Paso 4, el fallback es dibujar el vértice al
50% con marca visual explícita — se registra en `progress.md`, no se decide antes de verlo.

**D-3 · La línea de evolución se corta en los partidos sin dato.**
Consecuencia directa de RF-8. Se deja cortada (sin `spanGaps`): unir los extremos dibujaría una
tendencia que no ocurrió.

**D-4 · Cambiar `games` es un cambio de contrato con consumidores confirmados.**
Los consumidores del recuento de jugador son la tabla del Buscador (columna "G", `app.js:1471`) y el
badge del roster (`app.js:698`). Ambos solo lo muestran — ninguno lo usa como denominador propio.
`app.js:159`, `app.js:425/463` y `app.js:848` usan el recuento de **equipo**, que esta feature no toca.
Riesgo bajo, pero el Paso 3 lo verifica antes de tocar los endpoints.

**D-5 · El costo real de RF-10 es desconocido hasta recorrer la app.**
Es el único requisito del bloque cuyo alcance no se puede acotar desde el código: la auditoría puede
destapar sitios que no aparecen en §2. Mitigación: la auditoría se ejecuta **primero** en el Paso 4
(antes de los fixes de código), para que lo que destape entre en la lista de tareas en vez de aparecer
como sorpresa al final. Todo hallazgo fuera del alcance de esta feature se registra en `progress.md`
y se rutea al ROADMAP, no se parcha en caliente (Constitución: regla de flujo).

**D-6 · Desviación registrada respecto de `08-nulos-vs-cero`.**
Aquella feature fijó (RF-2/CA-5) que un `0` de conteo siempre cuenta en el promedio. Esta agrega una
condición previa: que el partido haya sido jugado. No se contradicen — un 0 en un partido jugado sigue
contando — pero el matiz debe quedar escrito en `docs/metrics.md` al cerrar, o el próximo lector lo
leerá como una regresión de F08.
