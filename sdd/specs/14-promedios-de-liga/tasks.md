# Tasks — Feature 14: promedios de liga

> Plan: `sdd/specs/14-promedios-de-liga/plan.md` (gate del Paso 2 pasado). Reglas: `sdd/03-tasks.md`.

## Orden de ejecución

### Grupo A — Backend: esquema
- [ ] **T-A1** · N/A — sin cambio de esquema · **Done:** `database.py` sin cambios en el diff.

### Grupo B — Backend: lógica y rutas
- [ ] **T-B1** · `league_averages()`: métrica sin valores válidos → `{"avg": None, "best": None}` ·
  `backend/stats_engine.py` · cubre RF-3 ·
  **Done:** `league_averages([{"oer": None}])["oer"] == {"avg": None, "best": None}`.
- [ ] **T-B2** · `league_overview._avg`: excluir `None`, devolver `None` si no queda ninguno ·
  `backend/app.py` · cubre RF-4 · **Done:** `GET /api/league` → `200`; una métrica nula no rompe ni se cuenta como 0.
- [ ] **T-B3** · `team_stats`: agrupar la población por competencia y devolver `leagues` (+ clave `""`);
  `league` = `leagues[""]` · `backend/app.py` · cubre RF-1, RF-6 · **depende de T-B1** ·
  **Done:** `GET /api/team/CNF` trae `leagues` con `""` + una clave por competencia del equipo, y `league == leagues[""]`.
- [ ] **T-B4** [P] · `player_stats`: ídem sobre la población de jugadores · `backend/app.py` ·
  cubre RF-1, RF-6 · **depende de T-B1** · **Done:** `GET /api/player/CNF/<x>` trae `leagues` con la misma forma.
- [ ] **T-B5** · Verificar RF-6: el `avg` de una métrica de equipo en `leagues["<comp>"]` coincide con
  la media de esa métrica en `GET /api/league?comp=<comp>` · cubre RF-6 · **depende de T-B3** ·
  **Done:** ambos valores coinciden para al menos 3 métricas.

### Grupo C — Frontend: api.js
- [ ] **T-C1** · N/A — sin cambios · **Done:** `api.js` sin cambios en el diff.

### Grupo D — Frontend: UI
- [ ] **T-D1** · `statBox`: retirar el `<span class="best">↑ …</span>` del bloque de contexto ·
  `frontend/js/app.js` · cubre RF-5 · **Done:** ninguna card muestra `↑`; el `Ø` se mantiene.
- [ ] **T-D2** · `_renderTeamContent`: `lg = data.leagues?.[_teamComp] ?? data.league` ·
  `frontend/js/app.js` · cubre RF-1, RF-2 · **depende de T-B3** ·
  **Done:** cambiar el filtro de competencia cambia el `Ø`; cambiar el de últimos N no lo toca.
- [ ] **T-D3** [P] · Vista Jugador: misma selección con su filtro de competencia ·
  `frontend/js/app.js` · cubre RF-1, RF-2 · **depende de T-B4** · **Done:** ídem en el perfil de jugador.

### Grupo E — Errores y estados vacíos
- [ ] **T-E1** · Competencia sin partidos válidos → entrada presente con métricas `null`, cards en `Ø —` ·
  cubre RF-3 · **Done:** no cae al agregado global ni rompe el render.
- [ ] **T-E2** · `sw.js` sin cambios · **Done:** `STATIC[]` y `CACHE` sin tocar.

### Grupo F — Verificación de feature
- [ ] **T-F1** · Backend arranca sin traceback
- [ ] **T-F2** · N/A — sin cambio de esquema
- [ ] **T-F3** · Los 3 endpoints probados contra el shape del plan §8
- [ ] **T-F4** · Consola sin errores JS nuevos al recorrer Equipo, Jugador y Liga
- [ ] **T-F5** · Recorrer CA-1…CA-8 y marcar ✅ con evidencia en `progress.md`

## Matriz de cobertura (CA → tareas)

| CA | Tareas |
|---|---|
| CA-1 · `Ø` coincide con la media de Liga por competencia | T-B3, T-B5, T-D2 |
| CA-2 · Cambiar competencia cambia el `Ø` | T-B3, T-D2, T-D3 |
| CA-3 · Filtro de últimos N no toca el `Ø` | T-D2 |
| CA-4 · Métrica sin datos → `Ø —`, nunca `Ø 0.0%` | T-B1, T-E1 |
| CA-5 · Ninguna card muestra `↑` | T-D1 |
| CA-6 · Sin valores imposibles (`1050%`, `9900%`) | T-D1 |
| CA-7 · Media de Liga con nulos no rompe | T-B2 |
| CA-8 · Consola sin errores JS | T-F4 |

8 CA, 0 sin cubrir.

## Dependencias externas

- **Base con al menos una competencia poblada** — la base real tiene 1 competencia
  (`"Liga Uruguaya de Basquetbol 2025/2026"`), suficiente para CA-1, CA-2 (verificando que la clave de
  la competencia y la clave `""` existen y son coherentes) y CA-3. Con una sola competencia, el `Ø`
  por competencia y el agregado coinciden numéricamente: se registra en `progress.md` para no leerlo
  como prueba de que el filtrado funciona.
- **Navegador** para T-F4 y las CA de UI (no hay test suite — Constitución 8).
- Sin variables de entorno ni dependencias nuevas.
