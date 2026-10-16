# Tasks — Feature 16: detalle de tiro completo y PPT

> Plan: `sdd/specs/16-tiro-completo-ppt/plan.md` (gate del Paso 2 pasado). Reglas: `sdd/03-tasks.md`.

## Orden de ejecución

### Grupo A — Backend: esquema
- [ ] **T-A1** · N/A — sin cambio de esquema · **Done:** `database.py` sin cambios en el diff.

### Grupo B — Backend: lógica y rutas
- [ ] **T-B1** · `_zones_from_shots`: `pf` → `ppt`; agregar `efg` por zona (factor 1.0 en zonas de 2,
  1.5 en zonas de 3) · `backend/app.py` · cubre RF-1, RF-4 ·
  **Done:** una zona de 3 con 4/10 devuelve `ppt: 1.2` y `efg: 0.6`; una de 2 con 4/10, `ppt: 0.8` y `efg: 0.4`.
- [ ] **T-B2** · `player_shots`/`team_shots`: `summary.global_pf` → `summary.ppt` · `backend/app.py` ·
  cubre RF-2 · **depende de T-B1** · **Done:** la respuesta no contiene ninguna clave `pf`/`global_pf`.
- [ ] **T-B3** [P] · `ppt_2`, `ppt_3`, `ppt_ft` en `calc_team_stats` y `calc_player_stats` ·
  `backend/stats_engine.py` · cubre RF-6, RF-7 ·
  **Done:** un jugador sin triples devuelve `ppt_3: None`; con 4/10 de 3, `ppt_3: 1.2`.
- [ ] **T-B4** · Bloque `totals` en `team_stats` y `player_stats`, sobre la población de partidos
  jugados · `backend/app.py` · cubre RF-5 · **Done:** `totals.fga3` de un jugador coincide con la suma
  de su game log jugado.
- [ ] **T-B5** · Agregar los 3 PPT a las listas de `keys`/`metric_keys` y a `league_averages` ·
  `backend/app.py` + `backend/stats_engine.py` · cubre RF-6 · **depende de T-B3** ·
  **Done:** `averages.ppt_2` presente y con `Ø` de liga.

### Grupo C — Frontend: api.js
- [ ] **T-C1** · N/A — sin cambios · **Done:** `api.js` sin cambios en el diff.

### Grupo D — Frontend: UI
- [ ] **T-D1** · `_scBadge`: `P/F` → `PPT` · `frontend/js/app.js` · cubre RF-2 ·
  **Done:** el encabezado del mapa dice `PPT`.
- [ ] **T-D2** · `_scLbl`: cuatro valores por zona (share%, PPT, % acierto, eFG%) y caja más alta ·
  `frontend/js/app.js` · cubre RF-1, RF-2 · **depende de T-B1** ·
  **Done:** CA-1 pasa; ninguna etiqueta dice `P/F`.
- [ ] **T-D3** · Verificar que no se solapen las cajas en el modo 11 zonas · cubre RF-3 ·
  **depende de T-D2** · **Done:** mapa con coordenadas reales sin solapamiento; si lo hay, aplicar el
  fallback de plan D-2 y registrarlo.
- [ ] **T-D4** · Card "Tiro" de jugador: T2i/T2c/T3i/T3c/TLi/TLc (promedio + total) y los 4 PPT ·
  `frontend/js/app.js` · cubre RF-5, RF-6, RF-8 · **depende de T-B4, T-B5** · **Done:** CA-6 y CA-7 pasan.
- [ ] **T-D5** [P] · Card "Tiro" de equipo: mismo bloque · `frontend/js/app.js` · cubre RF-8 ·
  **depende de T-B4, T-B5** · **Done:** ídem en la vista Equipo.

### Grupo E — Errores y estados vacíos
- [ ] **T-E1** · Jugador sin triples → `PPT 3` en `"—"` y `T3i` total en `0` real · cubre RF-7 ·
  **Done:** CA-8 pasa; no se confunde "no intentó" con "intentó y no convirtió".
- [ ] **T-E2** · Card "Tiro" a 390px con ~13 stats · **Done:** sin desborde ni scroll horizontal.
- [ ] **T-E3** · `sw.js` sin cambios · **Done:** `STATIC[]` y `CACHE` sin tocar.

### Grupo F — Verificación de feature
- [ ] **T-F1** · Backend arranca sin traceback
- [ ] **T-F2** · N/A — sin cambio de esquema
- [ ] **T-F3** · `/api/shots/*`, `/api/team/*` y `/api/player/*` contra el shape del plan §8
- [ ] **T-F4** · Consola sin errores JS nuevos
- [ ] **T-F5** · Recorrer CA-1…CA-10 y marcar ✅ con evidencia en `progress.md`

## Matriz de cobertura (CA → tareas)

| CA | Tareas |
|---|---|
| CA-1 · Zona con %, eFG% y PPT, sin `P/F` | T-B1, T-D2 |
| CA-2 · Encabezado dice `PPT` | T-B2, T-D1 |
| CA-3 · Modo 3 zonas cumple lo mismo | T-D1, T-D2, T-D3 |
| CA-4 · Zona de 3 con 4/10 → eFG 60%, PPT 1.20 | T-B1 |
| CA-5 · Zona de 2 con 4/10 → eFG 40% | T-B1 |
| CA-6 · Los seis conteos en promedio y total | T-B4, T-D4, T-D5 |
| CA-7 · Los cuatro PPT visibles | T-B3, T-B5, T-D4 |
| CA-8 · Sin triples → `PPT 3` en `"—"` | T-B3, T-E1 |
| CA-9 · `PPT 2` coincide con el cálculo manual | T-B3 |
| CA-10 · Consola sin errores JS | T-F4 |

10 CA, 0 sin cubrir.

## Dependencias externas

- **Un partido con coordenadas de tiro reales para T-D3.** La base actual tiene
  `has_coordinates=false` en la competencia FUBB (Feature 01), así que el modo 11 zonas puede no ser
  alcanzable con datos reales; en ese caso se verifica el solapamiento con zonas sintéticas y se
  registra en `progress.md`.
- **Un jugador sin triples para CA-8** — verificar que exista antes de T-E1.
- **Navegador** para T-D3, T-E2 y las CA de UI.
- Sin variables de entorno ni dependencias nuevas.
