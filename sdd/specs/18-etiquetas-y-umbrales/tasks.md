# Tasks — Feature 18: etiquetas y umbrales

> Plan: `sdd/specs/18-etiquetas-y-umbrales/plan.md` (gate del Paso 2 pasado). Reglas: `sdd/03-tasks.md`.

## Orden de ejecución

### Grupo A — Backend: esquema
- [ ] **T-A1** · N/A — sin cambio de esquema; `paint_pts` no se renombra (RF-2) ·
  **Done:** `database.py` sin cambios en el diff.

### Grupo B — Backend: lógica y rutas
- [ ] **T-B1** [P] · `team_clutch`: `margin=15` → `margin=10` · `backend/clutch.py` · cubre RF-3 ·
  **Done:** la firma y el docstring indican 10.
- [ ] **T-B2** [P] · `clutch_team`: default `15` → `10` · `backend/app.py` · cubre RF-3 ·
  **Done:** `GET /api/clutch/CNF` (sin `?margin=`) devuelve `margin: 10`.
- [ ] **T-B3** · Verificar el recuento con el umbral nuevo · cubre RF-5 · **depende de T-B1, T-B2** ·
  **Done:** `games_qualified` + `games_excluded` es constante; los partidos con margen 11-15 pasaron a excluidos.

### Grupo C — Frontend: api.js
- [ ] **T-C1** · N/A — sin cambios · **Done:** `api.js` sin cambios en el diff.

### Grupo D — Frontend: UI
- [ ] **T-D1** [P] · `PeP` → `PtsEnPint` en el `statBox` del desglose ofensivo · `frontend/js/app.js` ·
  cubre RF-1 · **Done:** la card de Equipo rotula `PtsEnPint`.
- [ ] **T-D2** [P] · `PeP` → `PtsEnPint` en el `rawRow` de Comparar · `frontend/js/app.js` ·
  cubre RF-1 · **Done:** el box score de Comparar rotula `PtsEnPint`.
- [ ] **T-D3** · Título de Cierres derivado de `d.margin`; actualizar el comentario de sección ·
  `frontend/js/app.js` · cubre RF-4 · **depende de T-B2** ·
  **Done:** el título muestra `dif ≤ 10` sin ningún literal de umbral en el código.

### Grupo E — Errores y estados vacíos
- [ ] **T-E1** · Equipo sin partidos calificados con el umbral nuevo → estado vacío con su copy
  existente y el `margin` correcto · cubre RF-5 · **Done:** el mensaje dice "más de 10".
- [ ] **T-E2** · Verificar `PtsEnPint` a 768px (etiqueta más larga que `PeP`) · cubre RF-1 ·
  **Done:** la card no desborda ni corta el texto.
- [ ] **T-E3** · `sw.js` sin cambios · **Done:** `STATIC[]` y `CACHE` sin tocar.

### Grupo F — Verificación de feature
- [ ] **T-F1** · Backend arranca sin traceback
- [ ] **T-F2** · N/A — sin cambio de esquema
- [ ] **T-F3** · `GET /api/clutch/<code>` probado con y sin `?margin=`
- [ ] **T-F4** · Consola sin errores JS nuevos
- [ ] **T-F5** · Recorrer CA-1…CA-7 y marcar ✅ con evidencia en `progress.md`

## Matriz de cobertura (CA → tareas)

| CA | Tareas |
|---|---|
| CA-1 · `PeP` no aparece en ninguna vista | T-D1, T-D2 |
| CA-2 · Búsqueda global sin resultados | T-D1, T-D2, docs |
| CA-3 · `paint_pts` intacta en el esquema | T-A1 |
| CA-4 · Título con `dif ≤ 10` | T-B2, T-D3 |
| CA-5 · Partidos de margen 11-15 pasan a excluidos | T-B1, T-B3 |
| CA-6 · El título sigue al `margin` del backend | T-D3 |
| CA-7 · Consola sin errores JS | T-F4 |

7 CA, 0 sin cubrir.

## Dependencias externas

- **Un equipo con al menos un partido de margen entre 11 y 15 al minuto 5:00** para CA-5. Verificar
  antes de T-B3; si no existe, comparar los recuentos con `?margin=15` vs `?margin=10` sobre el mismo
  equipo y registrarlo.
- **Navegador** para T-E2 y las CA de UI.
- Sin variables de entorno ni dependencias nuevas.
