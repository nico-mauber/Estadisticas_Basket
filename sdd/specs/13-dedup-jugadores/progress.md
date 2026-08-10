# Progress — Feature 13: deduplicación de jugadores

> Cierre de C-08 (`Smart-Basket Especificacion v2.docx` §1, P0).

## Estado de tareas

- [x] **T-A1** · N/A — sin cambio de esquema. `database.py` sin tocar
- [x] **T-B1** · `norm_name(s)` · `backend/stats_engine.py`
- [x] **T-B2** · `resolve_identity(rows)` → `(nombre, posición)` · `backend/stats_engine.py`
- [x] **T-B3** · `search_players` agrupa por nombre normalizado · `backend/app.py`
- [x] **T-B4** · `team_players` agrupa por nombre normalizado · `backend/app.py`
- [x] **T-B5** · `player_stats` resuelve por nombre normalizado · `backend/app.py`
- [x] **T-C1** · N/A — `api.js` sin cambios
- [x] **T-D1** · N/A — `app.js` y `charts.js` sin cambios; el recuento se ajustó solo
- [x] **T-E1** · Ningún `200` previo se volvió `404`
- [x] **T-E2** · `sw.js` sin cambios
- [x] **T-F1** a **T-F5** · Ver §Gates y §CA

## Diagnóstico previo (antes de tocar código)

La base **no tiene duplicados por grafía**: 95 filas en `player_game_stats`, 74 fichas por
`(equipo, nombre crudo)` y **74** por `(equipo, nombre normalizado)`. El bug de C-08 es **latente**,
no activo: `search_players` agrupaba por `player_name` crudo (línea 748), así que la primera variante
de grafía que entre por importación parte al jugador en dos fichas.

Sí había 3 jugadores con **posición distinta entre partidos**, que es la causa que C-08 menciona:
`C. Zinaich` (`F`/`PF`), `J. Feldeine` (`G`/`PG`), `P. Prieto` (`G`/`PG`). El código elegía la última
de una iteración sin orden garantizado — no reproducible entre requests.

## Estado de CA (gate de aceptación)

Verificación en dos bases: la **real** (sin duplicados) y una **copia** en scratchpad con una variante
de grafía inyectada (`C. Zinaich` → `'C.  ZINAICH'` con posición vacía en 1 de sus 2 partidos).
La base real nunca se modificó.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | Base con duplicado: el buscador devuelve **1** entrada para Zinaich, `games: 2`, `pts: 19.0` (= (27+11)/2). Total del buscador vuelve a **74**; sin el fix serían 75 |
| CA-2 | ✅ | Misma base: roster de CNF pasa de **16 nombres crudos a 15** unificados. En navegador (base real): `player-select` con 15 opciones, 0 repetidas |
| CA-3 | ✅ | La ficha inyectada tenía `position=''` y la otra `'PF'` → resuelto `'PF'`. La posición no vacía gana |
| CA-4 | ✅ | `resolve_identity` con `[G, '', PG, G]` → `'G'` (la más frecuente); dos llamadas seguidas devuelven lo mismo. Empate `[F, PF]` → `'PF'` (la más reciente). En UI los 3 casos reales resuelven estable: Zinaich `PF`, Feldeine `PG`, Prieto `PG` |
| CA-5 | ✅ | `GET /api/player/CNF/<grafía>` con `'C. Zinaich'`, `'C.  ZINAICH'` y `'c. zinaich'`: los tres → `200` con **2 partidos** y `averages.pts: 19.0` |
| CA-6 | ✅ | El nombre devuelto es `'C. Zinaich'` (grafía real de la ficha más reciente), nunca `'c. zinaich'`. Verificado en buscador, roster y perfil |
| CA-7 | ✅ | Base real: buscador **74** entradas (igual que antes), 0 duplicados, roster CNF **15**. La unificación no inventa fusiones |
| CA-8 | ✅ | Consola tras recorrer buscador, roster y perfil: **0 errores** |

## Gates técnicos

- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: **N/A** — sin cambio de esquema
- Endpoints probados manualmente: ✅ — los 3 tocados, en base real y en copia con duplicado
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan

**D-1 · La competencia NO entra en la clave de deduplicación** (spec §9, decisión registrada).
C-08 la nombra en la clave, pero agregarla **aumentaría** el número de fichas — un jugador con
partidos en dos competencias pasaría a tener dos entradas — y eso contradice el criterio de
aceptación del propio C-08. Se conserva una ficha por `(equipo, jugador)` con `competitions[]` en la
respuesta y el filtro `sf-comp` en el buscador, que cumple el objetivo de forma más fuerte.
Desviación deliberada del texto literal, alineada con su intención.

**D-2 · La unificación es de lectura, no de escritura.**
No se corrigieron nombres ni posiciones en la tabla, y la `UniqueConstraint(game_id, team_code,
player_name)` se conserva. Cubre todo el histórico sin migrar y es reversible (Constitución 5).
Costo: una pasada de normalización por fila en cada request — irrelevante a 95 filas.

**D-3 · `search_players` y `team_players` pasaron a ordenar las filas por fecha antes de agrupar.**
No estaba explícito en el plan §4, que dejaba el orden "a la ruta que llama". Es necesario: sin orden
estable, el desempate "más reciente" de `resolve_identity` no es reproducible. `player_stats` ordena
por `game_id` porque en esa ruta no hay un mapa de fechas a mano y el desempate solo afecta a la
grafía mostrada.

**D-4 · CA-1, CA-2, CA-5 y CA-6 no son alcanzables con los datos de producción.**
Se verificaron sobre una copia con duplicado inyectado. CA-7 cubre el reverso sobre la base real.
Registrado para no leerlo como cobertura end-to-end plena.

## Docs a actualizar

- [x] `docs/api.md` — identidad de jugador por nombre normalizado en los 3 endpoints
- [x] `docs/database.md` — la unicidad de la tabla es por nombre **crudo**; la identidad se resuelve
  al leer

## Deuda / TODO

- **Riesgo de sobre-fusión** (plan D-5): dos jugadores distintos del mismo equipo cuyos nombres
  normalicen igual se fusionarían en silencio. Con el formato `Inicial. Apellido` de FIBA es plausible
  (dos hermanos). No es detectable desde los datos; la señal sería un jugador con más partidos que los
  que jugó su equipo. Si aparece, hace falta un desambiguador (dorsal).
- **Taxonomía de posiciones sin unificar**: `F`/`PF` y `G`/`PG` conviven. RF-3 elige una de forma
  determinista pero no colapsa el catálogo. Decisión de producto pendiente con el cliente.
- **Rendimiento**: si la base crece a decenas de miles de filas, la normalización por request se paga
  cara. El lugar correcto sería una columna normalizada indexada — cambio de esquema, hoy injustificado.
