# Tasks — C-04: AS/PER (asistencias sobre pérdidas)

> **ID:** C-04 · **Prioridad:** P1 · **Fase y orden:** 1·08 (recomendado: después de C-02)
> **Depende de:** C-11 · **Habilita:** T-05 · el `Ø` lo completa C-02
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · N/A — sin cambio de esquema (confirmar que ningún modelo de `backend/database.py` cambia) · cubre — · Done: `git diff backend/database.py` vacío.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Agregar `"ast_to": _safe_div(t["ast"], t["tov"])` al dict de retorno de `calc_team_stats` y ajustar el docstring de `season_ast_to` ("definición única de AS/PER, PER = pérdidas") · `backend/stats_engine.py` · cubre RF-1, RF-3, RF-6 · Done: en `python -c` con `calc_team_stats` sobre un equipo con `ast=25, tov=9` → `ast_to == 2.7778`; con `tov=0` → `None`, y `null_reason("ast_to") == "sin_perdidas"`.
- [ ] T-B2 [P] · `team_stats`: `totals` suma `ast` y `tov` además de las 6 claves de tiro (con C-02 cerrado: agregar `"ast"` y `"tov"` a `TOTAL_KEYS` en `stats_engine.py`) · `backend/app.py` (o `backend/stats_engine.py`) · cubre RF-5 · Done: `curl -s http://localhost:5000/api/team/OLI` → `totals.ast == 43` y `totals.tov == 29`.
- [ ] T-B3 [P] · `player_stats`: `totals` suma `ast` y `tov` sobre los partidos jugados (con C-02 cerrado ya sale de `TOTAL_KEYS`, T-B2) · `backend/app.py` · cubre RF-5 · Done: `curl -s "http://localhost:5000/api/player/OLI/M.%20Perdomo"` → `totals.ast == 14`, `totals.tov == 7`; jugador con un DNP: el DNP no suma.
- [ ] T-B4 · Verificar que `null_reasons` de `team_stats` incluye `ast_to` por partido sin pérdidas, y que `averages.ast_to` sigue siendo `season_ast_to(Σast, Σtov)` · `backend/app.py` · cubre RF-1, RF-3 · Done: partido de equipo con `tov == 0` (ad hoc con `app.test_client()` sobre copia de la base) → `game_log[i].ast_to is None` y `null_reasons.ast_to == "sin_perdidas"`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · N/A — sin métodos nuevos en `api.js` · cubre — · Done: `git diff frontend/js/api.js` vacío.

### Grupo D — Frontend: UI (render + tablas)
- [ ] T-D1 · **(solo si C-02 no está cerrado)** `_computeAvg`: calcular `ast_to = Σast/Σtov` (null si `Σtov = 0`) y `totals = {ast, tov}` del subconjunto; forzar razón `sin_perdidas` para `ast_to` y `def_to_ratio` nulos · `frontend/js/app.js` · cubre RF-1, RF-2, RF-3 · Done: con la selección `[{ast:25,tov:9},{ast:18,tov:20}]` devuelve `ast_to == 1.4828` (no `1.8389`) y `totals == {ast: 43, tov: 29}`.
- [ ] T-D2 · Helper `_ratioSub(a, b)` y caja AS/PER en la card "Rebotes & Misc" de `_renderTeamContent` (`leagueKey "ast_to"`, razón `rs.ast_to`, totales `av.totals ?? data.totals`) · `frontend/js/app.js` · cubre RF-4, RF-5, RF-7 · Done: Equipo → Olimpia muestra `AS/PER 1,48 (43/29)` sin `Ø` ni color.
- [ ] T-D3 · Jugador: reemplazar la caja `AST/TO` por `AS/PER` con `leagueKey "ast_to"` (se elimina la comparación contra `ast_ratio`), mismo helper de totales, y agregar `"ast_to"` a `NOT_PCT` de `statBox` · `frontend/js/app.js` · cubre RF-4, RF-5, RF-7 · Done: Jugador → M. Perdomo muestra `AS/PER 2,00 (14/7)`; la caja no tiene clase `above-avg`/`below-avg`; `grep -n '"ast_ratio", lg, true, rs.ast_to' frontend/js/app.js` sin resultados.
- [ ] T-D4 · Columna "AS/PER" en el game log de equipo (tras `TO%`) y de jugador (tras `TOV`; la fila DNP pasa de `colspan="11"` a `12`); encabezado con `title="AS/PER del partido"` · `frontend/js/app.js` · cubre RF-6 · Done: game log de Olimpia muestra `2,78` y `0,90`; un partido sin pérdidas muestra "—" con `title`; la fila DNP ocupa todo el ancho.
- [ ] T-D5 [P] · Comparar: `rawRow(label, va, vb, lowerBetter = false, fmt = DEC1)` y fila `rawRow("AS/PER", a.ast_to, b.ast_to, false, DEC2)` tras la fila `PER` · `frontend/js/app.js` · cubre RF-8 · Done: Olimpia vs Tabaré muestra `1,48` y `1,14`; con un lado nulo, "—" y sin `winner`/`loser`.
- [ ] T-D6 [P] · Buscador: `{ key: "ast_to", label: "AS/PER" }` en `SEARCH_COLS` tras `TOV` · `frontend/js/app.js` · cubre RF-9 · Done: columna visible; ordenar asc/desc deja los "—" (J. Lamas y similares) al final en ambos sentidos.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado sin pérdidas: confirmar que "—" lleva `title` "Sin pérdidas: el cociente no está definido" en la caja, en el game log y en el Buscador (ya existe la etiqueta `sin_perdidas`) · `frontend/js/app.js`, `frontend/js/core/format.js` · cubre RF-3 · Done: J. Lamas → el `title` del "—" de AS/PER es el de la etiqueta.
- [ ] T-E2 · Subir `CACHE` al siguiente entero · `frontend/sw.js` · cubre (assets) · Done: DevTools → Application → Cache Storage lista la caja nueva y no la anterior; recargar el cliente ya instalado trae el `app.js` nuevo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · `upgrade_db()` idempotente: N/A (sin esquema) — anotar en progress.
- [ ] T-F3 · Endpoints probados con curl: `/api/team/OLI`, `/api/player/OLI/M.%20Perdomo`, `/api/player/COL/J.%20Lamas`, `/api/search/players` → shapes de plan §3 y §8.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo, Jugador, Comparar y Buscador.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress.md.
- [ ] T-F6 · CA-1 (cliente): seguir el procedimiento de plan §10.1 pasos 1–4 con Olimpia y M. Perdomo (box oficial o consulta de solo lectura); anotar en progress los totales y los dos cocientes (`1,4828` y `2,0000`) y capturar la pantalla.
- [ ] T-F7 · CA-2: confirmar que la pantalla muestra `1,48` y `2,00` y no `1,84` ni `6,17` (cálculo de la media de ratios hecho a mano para descartarla).
- [ ] T-F8 · CA-3: card de equipo y de jugador con sus totales `(43/29)` y `(14/7)`; `ΣAS/ΣPER` recalculado a mano coincide.
- [ ] T-F9 · CA-4: J. Lamas → "—" con `title`; `curl` muestra `averages.ast_to == null` y `null_reasons.ast_to == "sin_perdidas"`; buscar `99`/`Infinity` en el JSON de `/api/team/COL` y `/api/player/COL/J.%20Lamas` (sin resultados).
- [ ] T-F10 · CA-5: sobre copia de la base con 2ª competencia (plan §10.1 paso 6) → Equipo → Olimpia → seleccionar "Liga de Ascenso 2026" → AS/PER sigue `1,48 (43/29)`; repetir con jugador. Si C-02 está cerrado, verificar además `curl "…/api/team/OLI?competition=1"`.
- [ ] T-F11 · CA-6: inspeccionar la caja (DevTools): sin `.above-avg`/`.below-avg`, sin línea `Ø`; (si C-02 cerrado) `Ø` = `league.ast_to.avg` de la respuesta.
- [ ] T-F12 · CA-7: game log de Olimpia → `2,78` / `0,90` distintos del `1,48` de la card.
- [ ] T-F13 · CA-8: Comparar Olimpia vs Tabaré → `1,48` / `1,14`; caso con un lado nulo (equipo sin pérdidas, ad hoc sobre copia) → "—" sin ganador.
- [ ] T-F14 · CA-9: Buscador ordenado por AS/PER asc y desc → nulos al final en ambos.
- [ ] T-F15 · CA-10: consola sin errores y 360 px sin scroll horizontal de página en las cuatro vistas.

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 · **(diferido → C-02)** Confirmar que la población de liga incluye `ast_to` (acumulado por entidad) y que la caja de AS/PER muestra `Ø` y color sin cambios de código · `frontend/js/app.js` (sin cambio esperado) · cubre RF-7 · Done: con C-02 cerrado, `league.ast_to.avg` es la media de los `averages.ast_to` de los equipos (y de los jugadores) de la competencia, y la caja muestra `Ø`.
- [ ] T-G2 · **(diferido → T-01)** Percentil y ficha de AS/PER reemplazan al `Ø` · se resuelve en [T-01](../15-T-01-ficha-de-metrica/plan.md) · Done: lo verifica T-01.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B1…T-B4, T-D2, T-D3, T-F6 |
| CA-2 | T-D1 (si aplica), T-D2, T-D3, T-F7 |
| CA-3 | T-B2, T-B3, T-D2, T-D3, T-F8 |
| CA-4 | T-B1, T-B4, T-E1, T-F9 |
| CA-5 | T-D1 (si aplica) o C-02, T-F10 |
| CA-6 | T-D2, T-D3, T-F11 (+ T-G1) |
| CA-7 | T-B1, T-D4, T-F12 |
| CA-8 | T-D5, T-F13 |
| CA-9 | T-D6, T-F14 |
| CA-10 | T-E2, T-F4, T-F15 |

## Dependencias externas
- Grupo 0 de C-11 cerrado (código de `dev` integrado) y `core/format.js` con `NULL_REASON_LABELS.sin_perdidas` (C-11 ya cerrado en la rama `v2`).
- Dataset de verificación: los 13 partidos del seed en `backend/basketball.db` (competencia "Liga de Ascenso 2026"); para CA-5, una **copia** de la base con una 2ª competencia (Arquitectura R-05); no tocar la base real.
- C-02 cerrado (recomendado antes; si no, aplicar T-D1) — plan §10 D-1.
- C-08 para `GET /api/player/<int:player_id>` (opcional; si no está, usar la ruta por nombre).
- Acceso a FIBA LiveStats solo si se verifica contra el box oficial; la alternativa de solo lectura sobre la base local no requiere red.
