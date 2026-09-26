# Tasks — C-05: Renombrar PEP

> **ID:** C-05 · **Prioridad:** P2 · **Fase y orden:** 1·03
> **Depende de:** C-11 Grupo 0 (P-00) — [`../01-C-11-tratamiento-de-nulos/tasks.md`](../01-C-11-tratamiento-de-nulos/tasks.md) · **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [`spec.md`](spec.md) · [`plan.md`](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · N/A — sin cambio de esquema; confirmar que `backend/database.py` no se toca · cubre RF-2 · Done: `git diff --stat` no lista `backend/database.py`

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · N/A — sin cambios de backend · cubre RF-2 · Done: `git diff --stat` no lista archivos de `backend/`

### Grupo C — Frontend: api.js
- [ ] T-C1 · N/A — `api.js` sin cambios · Done: `git diff --stat` no lista `frontend/js/api.js`

### Grupo D — Frontend: UI
- [ ] T-D1 [P] · Envolver la etiqueta de la card "Desglose ofensivo" en `t('equipo.desglose.paint_pts', 'PtsEnPint')` · `frontend/js/app.js` (`statBox` de `renderTeam`) · cubre RF-1, RF-5 · Done: la card muestra `PtsEnPint`
- [ ] T-D2 [P] · Envolver la etiqueta de la fila de Comparar en `t('comparar.box.paint_pts', 'PtsEnPint')` · `frontend/js/app.js` (`rawRow`) · cubre RF-1, RF-5 · Done: el box score muestra `PtsEnPint`
- [ ] T-D3 · Asegurar `import { t } from "./core/i18n.js"` en `app.js` (si C-11 no lo dejó) · `frontend/js/app.js` · cubre RF-5 · Done: consola sin `ReferenceError: t is not defined`

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Subir `CACHE` al entero asignado al integrar · `frontend/sw.js` · cubre RF-1 · Done: DevTools > Application > Cache Storage muestra la versión nueva tras recargar
- [ ] T-E2 · Reescribir la descripción de `paint_pts` sin la sigla vieja · `docs/database.md` l.60 · cubre RF-3, RF-4 · Done: `git grep -n -i -w "pep" -- docs` → 0 líneas
- [ ] T-E3 · Agregar la regla "toda etiqueta de `paint_pts` es `PtsEnPint`" y confirmar §Vista Equipo/Comparar · `docs/frontend.md` · cubre RF-1, RF-5 · Done: texto presente

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · N/A: no toca esquema (registrar "N/A" en progress.md)
- [ ] T-F3 · `curl -s -b cookies.txt http://localhost:5000/api/team/CNF` → `averages.paint_pts` presente con el mismo nombre de clave
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo y Comparar
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress.md
- [ ] T-F6 · **CA-1 (CA del cliente)** · En Git Bash desde la raíz: `git grep -n -i -w "pep" -- frontend backend docs ':!backend/venv'` → 0 líneas; en el navegador, en Equipo (CNF) y en Comparar (CNF vs HYM), consola `document.body.innerText.match(/\bpep\b/i)` → `null`
- [ ] T-F7 · **CA-2** · Equipo CNF: la card "Desglose ofensivo" muestra `PtsEnPint` con el mismo valor (formato `DEC2`) que `averages.paint_pts` del curl de T-F3
- [ ] T-F8 · **CA-3** · Comparar CNF vs HYM: la fila `PtsEnPint` muestra ambos valores y resalta al mayor
- [ ] T-F9 · **CA-4** · `python -c "import sqlite3; c=sqlite3.connect('backend/basketball.db'); print([r[1] for r in c.execute('PRAGMA table_info(team_game_stats)')]); print(c.execute('select count(paint_pts) from team_game_stats').fetchone())"` antes y después: la columna `paint_pts` existe y el conteo no cambia
- [ ] T-F10 · **CA-5** · Con `app.test_client()` o intercepción de `fetch` en DevTools, forzar `averages.paint_pts = null` en uno de los equipos: la fila `PtsEnPint` de Comparar muestra "—"
- [ ] T-F11 · **CA-6** · DevTools en modo dispositivo a 360 px y 390 px: `PtsEnPint` completo, `document.documentElement.scrollWidth === document.documentElement.clientWidth`

## Matriz de cobertura
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-D1, T-D2, T-E2, T-F6 |
| CA-2 | T-D1, T-D3, T-E1, T-F7 |
| CA-3 | T-D2, T-D3, T-E1, T-F8 |
| CA-4 | T-A1, T-F9 |
| CA-5 | T-D2, T-F10 |
| CA-6 | T-D1, T-F11 |

## Dependencias externas
- Grupo 0 de C-11 integrado (commit `0cc4de6` de `dev`) y `frontend/js/core/i18n.js` disponible.
- Base con partidos: los 13 del seed (`POST /api/seed` con `SEED_ENABLED=1` y sesión iniciada; base local vacía, R-05).
- Número de `CACHE` asignado al integrar (coordinar con los demás requisitos de la fase, R-07).
