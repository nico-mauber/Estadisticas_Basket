# Plan — Feature 18: etiquetas y umbrales

> Spec: `sdd/specs/18-etiquetas-y-umbrales/spec.md` (gate del Paso 1 pasado). Reglas: `sdd/02-plan.md`.

## 1. Enfoque

Dos cambios sin lógica nueva. El único matiz de diseño está en C-06: en vez de actualizar el `15` en
los dos lugares donde vive, se **elimina la duplicación** — el backend queda como única fuente del
umbral y el título lo lee de la respuesta. Así el próximo cambio de umbral es de una línea.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `frontend/js/app.js` | js-view | `PeP` → `PtsEnPint` en la card de desglose y en la fila de Comparar | RF-1 |
| `backend/clutch.py` | module | `team_clutch(..., margin=10)` | RF-3 |
| `backend/app.py` | route | `clutch_team`: default `10` | RF-3 |
| `frontend/js/app.js` | js-view | Título de Cierres derivado de `d.margin` | RF-4, RF-5 |
| `docs/database.md` | doc | La etiqueta de `paint_pts` es `PtsEnPint` (Paso 4) | RF-1, RF-2 |
| `docs/frontend.md` | doc | `PtsEnPint` en el desglose; umbral de cierres (Paso 4) | RF-1, RF-4 |

**Matriz RF → archivo**: RF-1 ✔ · RF-2 ✔ (por omisión: no se toca esquema) · RF-3 ✔ · RF-4 ✔ · RF-5 ✔

## 3. Backend — rutas y modelos

**Sin tabla, columna ni endpoint nuevo.** Sin `upgrade_db()`.

| Método + ruta | Cambio | Errores |
|---|---|---|
| `GET /api/clutch/<team_code>` | `margin` por defecto `15` → `10`. `games_qualified` / `games_excluded` se recalculan. `?margin=` sigue aceptándose | sin cambio |

## 4. Backend — lógica

| Función | Módulo | Cambio | RF |
|---|---|---|---|
| `team_clutch` | `clutch.py` | Firma: `margin=10`. La lógica de filtrado (`if em > margin: excluir`) no cambia | RF-3, RF-5 |
| `clutch_team` | `app.py` | El default cuando falta o es inválido el query param pasa a `10` | RF-3 |

Sin fórmulas de `docs/metrics.md` involucradas.

## 5. Frontend — capa API (api.js)

**Sin cambios.**

## 6. Frontend — UI (app.js)

**C-05** — dos ocurrencias de la etiqueta: el `statBox` del desglose ofensivo (Equipo) y el `rawRow`
del box score (Comparar). Solo cambia el texto visible; la clave `paint_pts` que las alimenta no.

**C-06** — el título pasa de literal a derivado:

```
'Cierres (últimos 5 min, dif ≤ 15)'   →   `Cierres (últimos 5 min, dif ≤ ${d.margin})`
```

El estado vacío ya usaba `d.margin`, así que después del cambio ambos textos salen de la misma
fuente. También se actualiza el comentario de sección que menciona el umbral viejo.

Mobile-first: `PtsEnPint` es 4 caracteres más largo que `PeP` en una `.stat-label`; el `.stat-grid`
ya hace wrap y las etiquetas usan fuente chica. Verificar a 768px en el Paso 4.

## 7. Navegación

Sin cambios.

## 8. Contratos de datos

Sin campos nuevos. Cambia el valor por defecto de `margin` en la respuesta de `/api/clutch/<code>`,
y en consecuencia `games_qualified` y `games_excluded`.

## 9. Manejo de errores y offline

Sin códigos nuevos. El estado vacío conserva su copy y ahora es coherente con el título, porque ambos
leen `d.margin`.

**Service worker**: sin assets nuevos.

## 10. Riesgos / decisiones

**D-1 · Bajar el umbral reduce la muestra de cierres.**
Es el punto del requisito, pero tiene un efecto secundario: con menos partidos calificados, las
métricas de la card de Cierres se calculan sobre menos posesiones y son más ruidosas. Con la base
actual puede dejar equipos sin ningún partido calificado — el estado vacío ya está contemplado. El
badge de confiabilidad que corresponde es T-02, fuera del Bloque C.

**D-2 · El título derivado es un cambio de más que C-06 no pide.**
C-06 pide actualizar la leyenda. Actualizar el literal habría bastado. Se elimina la duplicación
porque **fue la causa del defecto**: el umbral vivía en dos lugares y solo uno se mantenía. Costo:
una interpolación. Beneficio: no vuelve a pasar.

**D-3 · `PtsEnPint` no se renombra en la base.**
La columna sigue siendo `paint_pts` (RF-2). Queda una diferencia entre el nombre técnico y la
etiqueta visible, que se documenta en `docs/database.md` para que nadie la lea como inconsistencia.
