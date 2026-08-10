# Spec — Feature 18: etiquetas y umbrales

> **Requisitos C-05 y C-06** (`Smart-Basket Especificacion v2.docx` §1, P2/P1). Corte:
> `sdd/ROADMAP-bloque-C.md` §4 — agrupados por ser cambios de constante/etiqueta sin lógica nueva.

## 1. Objetivo
Renombrar la métrica de puntos en la pintura a su nombre definitivo y bajar el umbral de partido
cerrado de 15 a 10 puntos.

## 2. Fuentes (trazabilidad)

**C-05 (P2):**
- *"Sustituir la etiqueta 'PEP' por 'PtsEnPint' en toda la aplicación, incluida la pantalla de comparación de equipos."*
- CA: *"Búsqueda global de 'PEP' en el código y en la UI sin resultados."*

**C-06 (P1):**
- *"Cambiar el criterio de partido cerrado de diferencia ≤ 15 a diferencia ≤ 10."*
- *"Actualizar la leyenda de la sección y el recuento de partidos calificados y excluidos."*
- CA: *"El encabezado indica 'CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)' y el conteo de partidos calificados se recalcula."*

**Docs:**
- `docs/database.md` — columna `team_game_stats.paint_pts`, descrita como "Puntos en la pintura (PeP)".
- `docs/frontend.md` §Vista Equipo — card "Desglose ofensivo" con PeP entre sus columnas.
- `docs/metrics.md` §Glosario del cliente — `PtsEnPint = Puntos anotados dentro de la zona (antes etiquetado PEP)`.

**Código (estado verificado):**
- La etiqueta real es **`PeP`**, no `PEP`: `frontend/js/app.js` (card de desglose ofensivo y fila de
  Comparar), `docs/database.md`, `docs/frontend.md`. La cadena `PEP` no existe en el repositorio.
- `backend/clutch.py` `team_clutch(games, team_code, team_name, margin=15)` (109) — umbral por defecto.
- `backend/app.py` `clutch_team` (1016-1018) — `margin` viene por query string; si falta, `15`.
- `frontend/js/app.js` (614) — título `'Cierres (últimos 5 min, dif ≤ 15)'`, **con el 15 escrito a mano**.
- `frontend/js/app.js` (624) — el estado vacío **ya** usa `d.margin` de la respuesta, no un literal.
- `frontend/js/app.js` (594) — comentario con el umbral viejo.

## 3. Historias de usuario
- **US-1**: Como entrenador, quiero ver el nombre `PtsEnPint` en toda la app, para que coincida con el
  glosario que usamos en el cuerpo técnico.
- **US-2**: Como entrenador, quiero que "partido cerrado" signifique diferencia ≤ 10, porque 15 puntos
  a falta de 5 minutos no es un partido cerrado.

## 4. Requisitos funcionales

- **RF-1**: La etiqueta visible de la métrica de puntos en la pintura DEBE ser `PtsEnPint` en toda la
  aplicación, incluida la pantalla de comparación de equipos. · (US-1, C-05)
- **RF-2**: La columna de base de datos `paint_pts` NO DEBE renombrarse. · (Constitución 5: sin
  migraciones destructivas) · El cambio es de etiqueta visible y documentación, no de esquema.
- **RF-3**: El umbral por defecto de partido cerrado DEBE ser diferencia ≤ 10. · (US-2, C-06)
- **RF-4**: El encabezado de la sección DEBE reflejar el umbral vigente, y DEBE derivarlo del dato que
  devuelve el backend en vez de tenerlo escrito a mano. · (US-2, C-06) · Así un cambio futuro de
  umbral no vuelve a dejar la leyenda desincronizada.
- **RF-5**: El recuento de partidos calificados y excluidos DEBE recalcularse con el umbral nuevo. ·
  (US-2, C-06) · Sale del backend; se verifica que cambie.

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Cambio | Nuevo? |
|---|---|---|---|
| `team_game_stats.paint_pts` | existente | **Sin cambio** — solo cambia su etiqueta en la UI (RF-2) | No |
| `GET /api/clutch/<team_code>` | existente | El `margin` por defecto pasa de `15` a `10`. `games_qualified` y `games_excluded` se recalculan. El parámetro `?margin=` sigue funcionando | No |

## 6. Estados de UI

| Vista / Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Card "Desglose ofensivo" (Equipo) | sin cambio | sin cambio | sin cambio | sin cambio | la stat se rotula `PtsEnPint` |
| Comparar — box score | sin cambio | sin cambio | sin cambio | sin cambio | la fila se rotula `PtsEnPint` |
| Card "Cierres" | sin cambio | copy existente: `"Sin cierres apretados: los N partido(s) con play-by-play se definieron por más de {margin} al minuto 5:00."` | sin cambio | sin cambio | título `Cierres (últimos 5 min, dif ≤ 10)` |

**Copy nuevo**: `PtsEnPint` (literal del glosario del cliente). El resto se conserva.

## 7. Criterios de aceptación

- **CA-1**: Given el recorrido de la app, When se busca la etiqueta `PeP`, Then no aparece en ninguna
  vista, incluida Comparar.
- **CA-2**: Given una búsqueda global de `PeP` y `PEP` en código y documentación, When se ejecuta,
  Then no hay resultados como etiqueta de UI.
- **CA-3**: Given la columna `paint_pts` de la base, When se inspecciona el esquema, Then sigue
  llamándose igual y con sus datos intactos.
- **CA-4**: Given la card de Cierres, When se abre, Then el título indica `dif ≤ 10`.
- **CA-5**: Given un equipo cuyos partidos se definieron por entre 11 y 15 puntos al minuto 5:00,
  When se abre su card de Cierres, Then esos partidos pasan a contarse como **excluidos**.
- **CA-6**: Given el título de la card, When el backend devuelve un `margin` distinto, Then el título
  lo refleja sin tocar el frontend (RF-4).
- **CA-7**: Given el recorrido de Equipo y Comparar, When se observa la consola, Then no hay errores
  JS nuevos.

## 8. Fuera de alcance

- **Renombrar la columna `paint_pts`** (RF-2).
- **Hacer el umbral configurable desde la UI.** El endpoint ya acepta `?margin=`, pero exponerlo como
  control es T-03 (selector global de contexto), del Bloque T.
- **Revisar el criterio de "últimos 5 minutos"**, que C-06 no toca.

## 9. Ambigüedades

- **[RESUELTA] C-05 dice "PEP" pero la etiqueta real es "PeP".** → **Decisión: se sustituye `PeP`.**
  *Justificación*: la cadena `PEP` no existe en el repositorio; el glosario del cliente confirma la
  equivalencia (*"PtsEnPint — Puntos anotados dentro de la zona (antes etiquetado PEP)"*). Es una
  diferencia de mayúsculas en el reporte, no otra métrica.

- **[RESUELTA] ¿El umbral se cambia en el backend, en el frontend o en ambos?** → **En el backend,
  como valor por defecto; el frontend lo lee de la respuesta.** *Justificación*: hoy el 15 está
  duplicado (default del backend y literal en el título), que es la causa de que la leyenda pueda
  quedar desincronizada. RF-4 elimina la duplicación en vez de actualizar las dos copias.
