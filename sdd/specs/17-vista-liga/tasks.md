# Tasks — Feature 17: vista Liga

> Plan: `sdd/specs/17-vista-liga/plan.md` (gate del Paso 2 pasado). Reglas: `sdd/03-tasks.md`.

## Orden de ejecución

### Grupo A — Backend: esquema
- [ ] **T-A1** · N/A — sin cambio de esquema · **Done:** `database.py` sin cambios en el diff.

### Grupo B — Backend: lógica y rutas
- [ ] **T-B1** · `league_overview`: acumular `wins`, `losses`, `pts_for`, `pts_against` y calcular
  `table_points = 2×wins + 1×losses` · `backend/app.py` · cubre RF-1, RF-2, RF-3, RF-5, RF-6 ·
  **Done:** `GET /api/league` trae los 5 campos; `wins + losses == games` para todo equipo.
- [ ] **T-B2** · `league_overview`: orden final null-safe · `backend/app.py` · cubre RF-8 ·
  **Done:** con un `oer` nulo forzado, la ruta devuelve `200` en vez de `500`.

### Grupo C — Frontend: api.js
- [ ] **T-C1** · N/A — sin cambios · **Done:** `api.js` sin cambios en el diff.

### Grupo D — Frontend: UI
- [ ] **T-D1** · Tabla general (Equipo, PJ, PG, PP, Pts, PF, PC) ordenada por Pts descendente,
  alimentada de `_leagueTeams` sin fetch adicional · `frontend/js/app.js` · cubre RF-1, RF-4 ·
  **depende de T-B1** · **Done:** CA-1, CA-2 y CA-3 pasan.
- [ ] **T-D2** [P] · `LEAGUE_MAPS`: flechas horizontales en los títulos de eje X de los tres presets ·
  `frontend/js/app.js` · cubre RF-7 · **Done:** CA-7 y CA-8 pasan.

### Grupo E — Errores y estados vacíos
- [ ] **T-E1** · Filtro de competencia recalcula la tabla general · cubre RF-6 · **depende de T-D1** ·
  **Done:** CA-6 pasa.
- [ ] **T-E2** · Tabla general a 390px dentro de `.table-wrap` · **Done:** sin scroll horizontal del body.
- [ ] **T-E3** · `sw.js` sin cambios · **Done:** `STATIC[]` y `CACHE` sin tocar.

### Grupo F — Verificación de feature
- [ ] **T-F1** · Backend arranca sin traceback
- [ ] **T-F2** · N/A — sin cambio de esquema
- [ ] **T-F3** · `GET /api/league` con y sin `?competition=` contra el shape del plan §8
- [ ] **T-F4** · Consola sin errores JS nuevos
- [ ] **T-F5** · Recorrer CA-1…CA-10 y marcar ✅ con evidencia en `progress.md`

## Matriz de cobertura (CA → tareas)

| CA | Tareas |
|---|---|
| CA-1 · Tabla con PJ/PG/PP/Pts/PF/PC | T-B1, T-D1 |
| CA-2 · 2G+1P → Pts 5 | T-B1 |
| CA-3 · Ordenada por puntos | T-D1 |
| CA-4 · PF/PC coinciden con el game log | T-B1 |
| CA-5 · PG + PP == PJ | T-B1 |
| CA-6 · Filtro de competencia recalcula | T-E1 |
| CA-7 · Flecha horizontal en el eje X | T-D2 |
| CA-8 · Flechas coinciden con la posición real | T-D2 |
| CA-9 · Orden con nulos no rompe | T-B2 |
| CA-10 · Consola sin errores JS | T-F4 |

10 CA, 0 sin cubrir.

## Dependencias externas

- **Base con al menos un equipo con victorias y derrotas** para CA-2 y CA-5 — presente: CNF tiene 2
  partidos, HYM tiene 2 con resultados mixtos.
- **Navegador** para T-E2 y las CA de UI.
- Sin variables de entorno ni dependencias nuevas.
