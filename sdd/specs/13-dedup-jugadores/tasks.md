# Tasks — Feature 13: deduplicación de jugadores

> Plan: `sdd/specs/13-dedup-jugadores/plan.md` (gate del Paso 2 pasado). Reglas: `sdd/03-tasks.md`.

## Orden de ejecución

### Grupo A — Backend: esquema
- [ ] **T-A1** · N/A — sin cambio de esquema (plan §3). La `UniqueConstraint` se conserva ·
  **Done:** `database.py` sin cambios en el diff final.

### Grupo B — Backend: lógica y rutas
- [ ] **T-B1** · `norm_name(s)` (minúsculas, sin diacríticos, espacios colapsados, recortado) ·
  `backend/stats_engine.py` · cubre RF-1 · **Done:** `norm_name("  J.  FELDEÍNE ")` == `norm_name("j. feldeine")`.
- [ ] **T-B2** · `resolve_identity(rows)` → `(name, position)`: nombre de la ficha más reciente;
  posición más frecuente entre las no vacías, desempate por la más reciente, `""` si ninguna ·
  `backend/stats_engine.py` · cubre RF-3, RF-4 · **depende de T-B1** ·
  **Done:** con `[("A. Perez","G"), ("A. Perez",""), ("A. Perez","PG"), ("A. Perez","G")]` devuelve posición `G`; dos llamadas seguidas dan lo mismo.
- [ ] **T-B3** · `search_players`: clave de grupo `(team_code, norm_name(...))`; `player` y `position`
  desde `resolve_identity` · `backend/app.py` · cubre RF-1, RF-2, RF-3, RF-4 · **depende de T-B2** ·
  **Done:** `GET /api/search/players` → 74 entradas sobre la base real (sin duplicados, CA-7) y una sola entrada en la base con variante inyectada.
- [ ] **T-B4** [P] · `team_players`: agrupar por nombre normalizado en vez de `distinct()` crudo ·
  `backend/app.py` · cubre RF-1, RF-2, RF-3 · **depende de T-B2** ·
  **Done:** `GET /api/players/CNF` sin entradas repetidas y con el mismo total que antes en la base real.
- [ ] **T-B5** [P] · `player_stats`: filtrar por nombre normalizado en vez de igualdad exacta ·
  `backend/app.py` · cubre RF-1, RF-5 · **depende de T-B1** ·
  **Done:** el perfil resuelve con cualquier grafía en la URL y devuelve todos los partidos; nombre inexistente sigue dando `404`.

### Grupo C — Frontend: api.js
- [ ] **T-C1** · N/A — sin cambios (plan §5) · **Done:** `api.js` sin cambios en el diff.

### Grupo D — Frontend: UI
- [ ] **T-D1** · N/A — sin cambios (plan §6). El recuento `"N jugadores"` ya sale de `filtered.length` ·
  **Done:** `app.js` y `charts.js` sin cambios en el diff; el recuento se ajusta solo.

### Grupo E — Errores y estados vacíos
- [ ] **T-E1** · Verificar que la normalización no convierte en `404` nada que antes diera `200` ·
  cubre RF-5 · **Done:** los 74 jugadores de la base resuelven `200` con su grafía original.
- [ ] **T-E2** · `sw.js` sin cambios · **Done:** `STATIC[]` y `CACHE` sin tocar.

### Grupo F — Verificación de feature
- [ ] **T-F1** · Backend arranca sin traceback
- [ ] **T-F2** · N/A — sin cambio de esquema
- [ ] **T-F3** · Los 3 endpoints probados contra el shape del plan §8, en base real y en copia con duplicado inyectado
- [ ] **T-F4** · Consola sin errores JS nuevos al recorrer buscador, roster y perfil
- [ ] **T-F5** · Recorrer CA-1…CA-8 y marcar ✅ con evidencia en `progress.md`

## Matriz de cobertura (CA → tareas)

| CA | Tareas |
|---|---|
| CA-1 · Una sola fila en buscador | T-B1, T-B3 |
| CA-2 · Una sola entrada en roster | T-B1, T-B4 |
| CA-3 · Posición no vacía gana | T-B2, T-B3, T-B4 |
| CA-4 · Posición determinista y más frecuente | T-B2 |
| CA-5 · Perfil con cualquier grafía | T-B5 |
| CA-6 · Nombre mostrado es grafía real | T-B2, T-B3, T-B4 |
| CA-7 · Sin duplicados, nada cambia | T-B3, T-B4, T-E1 |
| CA-8 · Consola sin errores JS | T-F4 |

8 CA, 0 sin cubrir.

## Dependencias externas

- **Copia de la base con un duplicado de grafía inyectado** — precondición de CA-1, CA-2, CA-5 y CA-6
  (plan §D-4). La base real **no se modifica**: se trabaja sobre una copia vía `DB_PATH`, que
  `database.py` ya lee de variable de entorno.
- **Navegador** para T-F4 (no hay test suite — Constitución 8).
- Sin variables de entorno nuevas, sin dependencias pip/npm nuevas (`unicodedata` y `re` son stdlib).
