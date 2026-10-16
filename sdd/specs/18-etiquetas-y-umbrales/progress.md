# Progress — Feature 18: etiquetas y umbrales

> Cierre de C-05 y C-06 (`Smart-Basket Especificacion v2.docx` §1, P2/P1).

## Estado de tareas

- [x] **T-A1** · N/A — sin cambio de esquema; `paint_pts` intacta
- [x] **T-B1** · `team_clutch(..., margin=10)` · `backend/clutch.py`
- [x] **T-B2** · `clutch_team`: default `10` · `backend/app.py`
- [x] **T-B3** · Recuento verificado con el umbral nuevo
- [x] **T-C1** · N/A — `api.js` sin cambios
- [x] **T-D1** · `PeP` → `PtsEnPint` en el desglose ofensivo
- [x] **T-D2** · `PeP` → `PtsEnPint` en Comparar
- [x] **T-D3** · Título de Cierres derivado de `d.margin` — **requirió corrección**, ver D-1
- [x] **T-E1** · Estado vacío coherente con el título
- [x] **T-E2** · Verificado a 390px
- [x] **T-E3** · `sw.js` sin cambios
- [x] **T-F1** a **T-F5** · Ver §Gates y §CA

## Estado de CA (gate de aceptación)

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | Card de desglose (Equipo): etiqueta `PtsEnPint`. Comparar: fila `PtsEnPint`. Barrido de `\bPeP\b` en el texto renderizado: **0** ocurrencias |
| CA-2 | ✅ | Búsqueda global de `PeP` en `frontend/`, `backend/` y `docs/`: **una sola** ocurrencia, en `docs/database.md` como nota histórica (*"Etiqueta de UI: `PtsEnPint` (antes `PeP`)"*). Es documentación deliberada del renombre, no una etiqueta viva. También se corrigieron dos referencias viejas en `docs/frontend.md` que el reemplazo inicial no alcanzó: el título de Cierres con `≤ 15` y la lista de filas de Comparar |
| CA-3 | ✅ | `team_game_stats.paint_pts` sin cambios: `database.py` no aparece en el diff. Solo cambió la etiqueta visible |
| CA-4 | ✅ | Título renderizado: **"Cierres (últimos 5 min, dif ≤ 10)"** |
| CA-5 | ✅ | HYM es el caso discriminante: con `?margin=15` → 2 calificados / 0 excluidos; con el default nuevo (10) → **1 calificado / 1 excluido**. El partido de margen 11-15 pasó a excluido. CNF y AGU sin cambios (sus márgenes caen fuera de esa banda) |
| CA-6 | ✅ | El título sale de `d.margin`; no queda ningún literal de umbral en el render. Un cambio de default en el backend se refleja sin tocar el frontend |
| CA-7 | ✅ | Consola tras recorrer Equipo, Cierres y Comparar: **0 errores** |

## Gates técnicos

- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: **N/A** — sin cambio de esquema
- Endpoints probados manualmente: ✅ — `/api/clutch/<code>` con y sin `?margin=`, sobre 3 equipos
- Consola del navegador sin errores JS: ✅
- Mobile 390px: ✅ — `PtsEnPint` mide 135px en una card de 159px; no desborda, no se trunca
  (`scrollWidth == clientWidth`), y el body no genera scroll horizontal

## Desviaciones respecto a docs/ o plan

**D-1 · El título derivado introdujo un `ReferenceError` que el chequeo de sintaxis no detecta.**
La primera versión calculaba `title` con `d?.margin` **antes** de la línea `const d = _clutchData`.
El encadenamiento opcional no protege contra la *temporal dead zone*: acceder a un `const` antes de su
declaración lanza `ReferenceError`, y `node --check` solo valida sintaxis. Habría roto la card de
Cierres por completo. Corregido con `titleFor(margin)`: los estados de carga y error usan el default
(todavía no se conoce el umbral) y el estado de éxito usa `d.margin`. **Detectado al leer el archivo
tras el reemplazo, antes de la verificación en navegador.**

**D-2 · La etiqueta real era `PeP`, no `PEP`** (spec §9). C-05 la nombra en mayúsculas; en el
repositorio no existe esa cadena. Se sustituyó `PeP`, que es lo que el usuario ve.

**D-3 · Se eliminó la duplicación del umbral, que C-06 no pedía** (plan D-2).
C-06 pedía actualizar la leyenda; bastaba con cambiar el literal. Se eliminó la duplicación porque
**era la causa del defecto**: el umbral vivía en el backend y escrito a mano en el título, y solo uno
se mantenía actualizado.

## Docs a actualizar

- [x] `docs/database.md` — `paint_pts` se rotula `PtsEnPint` en la UI; la columna no se renombra
- [x] `docs/frontend.md` — `PtsEnPint` en el desglose ofensivo; el umbral de cierres sale del backend

## Deuda / TODO

- **Bajar el umbral reduce la muestra** (plan D-1): con dif ≤ 10 hay menos partidos calificados, así
  que las métricas de la card de Cierres se calculan sobre menos posesiones y son más ruidosas. AGU
  queda con **0** partidos calificados. El badge de confiabilidad que corresponde es **T-02**, fuera
  del Bloque C.
- **El umbral no es configurable desde la UI.** El endpoint ya acepta `?margin=`; exponerlo como
  control es **T-03** (selector global de contexto).
