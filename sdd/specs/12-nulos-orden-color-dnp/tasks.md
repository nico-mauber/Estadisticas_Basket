# Tasks — Feature 12: nulos — orden, color y DNP

> Plan: `sdd/specs/12-nulos-orden-color-dnp/plan.md` (gate del Paso 2 pasado).
> Reglas: `sdd/03-tasks.md`.

## Orden de ejecución

Grupos en secuencia. `[P]` = paralelizable dentro del grupo (sin estado compartido).

> **T-Z1 va primero, antes de tocar código.** Es la decisión D-5 del plan: la auditoría de RF-10
> se ejecuta antes de los fixes para que lo que destape entre como tarea, no como sorpresa al cierre.

### Grupo Z — Auditoría previa (antes de tocar código)

- [ ] **T-Z1** · Recorrer las 10 vistas con el backend levantado y anotar cada `0` sospechoso de ser
  dato inexistente, más cada `"null"`/`"NaN"` visible · vistas: Importar, Liga, Equipo, Jugador,
  Comparar, Buscador, Cierres, Combinaciones, ON/OFF, mapas de tiro · cubre RF-10 ·
  **Done:** tabla vista-por-vista en `progress.md` con estado y hallazgos; los que caen fuera del
  alcance de esta feature quedan ruteados al ROADMAP, no parchados.

### Grupo A — Backend: esquema y modelos

- [ ] **T-A1** · N/A — esta feature no toca esquema (plan §3). Sin `upgrade_db()`, sin columna nueva ·
  **Done:** confirmado explícitamente; `database.py` sin cambios en el diff final.

### Grupo B — Backend: lógica y rutas

- [ ] **T-B1** · Agregar `played(minutes) -> bool` (True si los minutos disputados son > 0), reusando
  `_parse_minutes` · `backend/stats_engine.py` · cubre RF-6 ·
  **Done:** `played("00:00")`, `played("")`, `played(None)` → `False`; `played("12:34")` → `True`.

- [ ] **T-B2** · `player_stats`: `reb_share`/`oreb_share`/`dreb_share` → `None` cuando el denominador
  es 0 o no hay fila de equipo (copiar el patrón vigente en `search_players` 764-768) ·
  `backend/app.py` · cubre RF-5 ·
  **Done:** `GET /api/player/<t>/<p>` de un jugador con partido de `t_trb = 0` devuelve `null`, no `0`.

- [ ] **T-B3** · `player_stats`: agregar `played` a cada entrada de `game_log` (campo NUEVO del
  contrato, plan §8) · `backend/app.py` · cubre RF-6 ·
  **Done:** toda entrada de `game_log` trae `played` booleano; el conteo de `played: false` coincide
  con el de filas sin minutos.

- [ ] **T-B4** · `player_stats`: `_avg()` promedia solo sobre entradas con `played`; `None` si no
  queda ninguna · `backend/app.py` · cubre RF-6 · **depende de T-B3** ·
  **Done:** jugador con 3 partidos jugados (10/12/14 pts) + 1 DNP → `averages.pts = 12.0`, no `9.0`.

- [ ] **T-B5** · `player_stats`: `games` cuenta solo partidos jugados · `backend/app.py` · cubre RF-7 ·
  **depende de T-B3** · **Done:** ese mismo jugador devuelve `games: 3` y `game_log` con 4 entradas.

- [ ] **T-B6** [P] · `team_players`: `games` solo jugados; `avg_uso` y `avg_pts` promediados solo sobre
  jugados; `avg_uso` sin ningún valor válido → `None` (hoy `0`) · `backend/app.py` · cubre RF-5, RF-6,
  RF-7 · **Done:** `GET /api/players/<t>` — el `games` de un jugador con DNP baja, y un jugador sin
  `uso_pct` válido devuelve `null`.

- [ ] **T-B7** [P] · `search_players`: `games` solo jugados; `_avg_count` y el promedio de `minutes`
  sobre jugados (`_avg_metric` ya excluye `None`, no se toca) · `backend/app.py` · cubre RF-6, RF-7 ·
  **Done:** `GET /api/search/players` — `games` y `minutes` de un jugador con DNP coinciden con los de
  `GET /api/player/...` del mismo jugador.

### Grupo C — Frontend: api.js

- [ ] **T-C1** · N/A — sin firma nueva ni endpoint nuevo (plan §5) ·
  **Done:** `api.js` sin cambios en el diff final.

### Grupo D — Frontend: UI (render + charts)

- [ ] **T-D1** · Agregar `_cmpNullsLast(av, bv, dir)` en la sección "Stat helpers": nulo y `NaN` se
  apartan de la comparación devolviendo `1`/`-1` **sin multiplicar por `dir`**; texto vía
  `localeCompare × dir`; número vía `(av − bv) × dir` · `frontend/js/app.js` · cubre RF-1, RF-2 ·
  **Done:** el helper existe y es la única implementación de orden null-safe del archivo.

- [ ] **T-D2** · `_sortedLeague` delega en `_cmpNullsLast` · `frontend/js/app.js` · cubre RF-1 ·
  **depende de T-D1** · **Done:** el orden de la tabla de Liga no cambia respecto de antes (era el
  patrón correcto); nulos al final en ambos sentidos.

- [ ] **T-D3** · `_drawClutchTable` delega en `_cmpNullsLast` (elimina `av = -Infinity`) ·
  `frontend/js/app.js` · cubre RF-1, RF-2 · **depende de T-D1** ·
  **Done:** CA-3 pasa — nulos al final al alternar el sentido de orden.

- [ ] **T-D4** · `_renderSearchResults` delega en `_cmpNullsLast` (elimina `av = -Infinity`) ·
  `frontend/js/app.js` · cubre RF-1, RF-2 · **depende de T-D1** ·
  **Done:** CA-1 y CA-2 pasan.

- [ ] **T-D5** [P] · `_drawClutchTable` `cell()`: la rama de diferencia trata el nulo → `"—"` y clase
  neutra, sin concatenar el valor crudo · `frontend/js/app.js` · cubre RF-3, RF-4 ·
  **Done:** ninguna celda de esa tabla imprime `"null"`; una diferencia nula no se pinta verde ni rojo.

- [ ] **T-D6** · `_computeAvg(gameLog)` excluye las entradas con `played === false` ·
  `frontend/js/app.js` · cubre RF-6 · **depende de T-B3** ·
  **Done:** con el filtro de últimos N o por competencia activo, el promedio en pantalla coincide con
  el `averages` del backend para el mismo subconjunto (divergencia = bug).

- [ ] **T-D7** [P] · `charts.js` evolución (206, 218, 279, 290): `?? 0` → nulo, para omitir el punto ·
  `frontend/js/charts.js` · cubre RF-8 ·
  **Done:** CA-10 pasa — la línea no baja a 0 en un partido sin dato.

- [ ] **T-D8** [P] · `charts.js` `_norm`: el valor nulo deja de mapear a 0 y se propaga ·
  `frontend/js/charts.js` · cubre RF-9 ·
  **Done:** un eje sin dato no se dibuja en el borde interior del radar. Si el hueco resulta
  ilegible → aplicar el fallback de D-2 del plan y registrarlo en `progress.md`.

### Grupo E — Errores, estados vacíos, offline/SW

- [ ] **T-E1** · Verificar el caso borde de plan §9: jugador con **todos** sus partidos DNP →
  promedios `None`, recuento `0`, cards en `"—"`, sin `404` ni excepción · `backend/app.py` +
  `frontend/js/app.js` · cubre RF-6, RF-7 ·
  **Done:** la vista del jugador carga y muestra `"—"`; el endpoint devuelve `200`.

- [ ] **T-E2** · Confirmar que `sw.js` no cambia: sin assets nuevos, `/api/` sigue network-first ·
  `frontend/sw.js` · **Done:** `STATIC[]` y versión de `CACHE` sin tocar en el diff final.

- [ ] **T-E3** · Aplicar los hallazgos de T-Z1 que caen dentro del alcance de esta feature ·
  archivos según hallazgo · cubre RF-10 · **depende de T-Z1** ·
  **Done:** cada hallazgo en alcance queda corregido o explícitamente ruteado en `progress.md`.

### Grupo F — Verificación de feature

- [ ] **T-F1** · Backend arranca sin traceback (`python backend/app.py`)
- [ ] **T-F2** · N/A — sin cambio de esquema (T-A1)
- [ ] **T-F3** · Los 3 endpoints tocados probados y comparados contra el response shape del plan §8
- [ ] **T-F4** · Consola del navegador sin errores JS nuevos al recorrer la feature (línea base: el
  `404` de `favicon.ico` es preexistente — Feature 01)
- [ ] **T-F5** · Recorrer CA-1…CA-12 del spec y marcar ✅ con evidencia en `progress.md`

## Matriz de cobertura (CA → tareas)

| CA | Tareas |
|---|---|
| CA-1 · Buscador, orden ASC, nulos al final | T-D1, T-D4 |
| CA-2 · Buscador, orden DESC, nulos al final | T-D1, T-D4 |
| CA-3 · Cierres, nulos al final en ambos sentidos | T-D1, T-D3 |
| CA-4 · Celda `"—"` sin color de rendimiento | T-D5, T-Z1, T-E3 |
| CA-5 · Sin `"null"`/`"NaN"`/`"undefined"` en pantalla | T-D5, T-Z1, T-E3 |
| CA-6 · `Reb Share` nulo, no `0.00` | T-B2 |
| CA-7 · Promedio 12,0 y recuento 3 con 1 DNP | T-B1, T-B3, T-B4, T-B5 |
| CA-8 · El DNP sigue visible en el game log | T-B3, T-B4 |
| CA-9 · 0 real de partido jugado sí cuenta | T-B1, T-B4 |
| CA-10 · Evolución no baja a 0 | T-D7 |
| CA-11 · Recorrido completo sin 0 falso | T-Z1, T-E3, T-F5 |
| CA-12 · Consola sin errores JS nuevos | T-F4 |

12 CA, 0 sin cubrir.

## Dependencias externas

- **DB con datos reales cargados** — la verificación necesita al menos un jugador con un partido DNP
  (fila en `player_game_stats` con minutos 0 o vacíos) y un jugador con un partido de `t_trb = 0`
  o sin fila de equipo. Precondición de T-B2, T-B4, T-B5 y de todo el Grupo F.
  Si no existe ningún DNP en la base, identificarlo antes de T-B4 y registrarlo en `progress.md`.
- **Navegador para la verificación manual** — no hay test suite (Constitución 8). El proyecto ya usó
  Playwright en Features 08/10/11 para la evidencia de CA.
- Sin variables de entorno nuevas, sin dependencias pip/npm nuevas (Constitución 2).
