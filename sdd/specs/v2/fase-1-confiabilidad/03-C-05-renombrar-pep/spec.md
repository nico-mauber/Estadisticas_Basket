# Spec — C-05: Renombrar PEP

> **ID:** C-05 · **Prioridad:** P2 · **Fase y orden:** 1·03
> **Depende de:** C-11 Grupo 0 (integración de `dev`, precondición P-00) — [`../01-C-11-tratamiento-de-nulos/spec.md`](../01-C-11-tratamiento-de-nulos/spec.md) · **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §2 · C-05 ([`../../00-especificacion-cliente-v2.md`](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.0, §2.2 (fila PtsEnPint), §3.20 ([`../../00-arquitectura-transversal.md`](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal):** *"Sustituir la etiqueta "PEP" por "PtsEnPint" en toda la aplicación, incluida la
pantalla de comparación de equipos."* Criterio de aceptación: *"Búsqueda global de "PEP" en el código y en la UI sin
resultados."* El glosario v2 (§6) fija el nombre: *"PtsEnPint — Puntos anotados dentro de la zona (antes etiquetado PEP)"*.

**Qué existe hoy (verificado):**
- Rama `main` (producción): la etiqueta visible es **`PeP`** (no `PEP`), en dos sitios de `frontend/js/app.js`:
  l.781 (`statBox("PeP", av.paint_pts, …)` de la card "Desglose ofensivo" de Equipo) y l.1111 (`rawRow("PeP", …)` del box
  score FIBA de Comparar). En documentación: `docs/database.md` l.60 ("Puntos en la pintura (PeP)") y `docs/frontend.md`
  l.37 y l.47. La cadena `PEP` en mayúsculas no existe en el repositorio (fuera de `backend/venv/`, que no es código del
  proyecto).
- Rama `dev` (commit `0cc4de6`, feature SDD 18 `18-etiquetas-y-umbrales`): ya renombró los dos sitios de `app.js`
  (l.835 y l.1168 en `dev`) y `docs/frontend.md`. **Quedó un residuo:** `docs/database.md` l.60 en `dev` dice
  *"Etiqueta de UI: `PtsEnPint` (antes `PeP`)"*, por lo que una búsqueda global sin distinguir mayúsculas todavía
  devuelve un resultado (lo registró el propio `progress.md` de la feature 18, CA-2, y la arquitectura §1.0).
- La columna `team_game_stats.paint_pts` no se renombra (Constitución 5; arquitectura §2.2: "Columna sin renombrar").
- Las etiquetas de la app están escritas a mano en `app.js`; la función de i18n `t()` (arquitectura §3.20) la crea C-11.

**Qué resolvieron features anteriores:** la feature 18 de `dev` (se integra en el Grupo 0 de C-11) hizo el renombre visible.
**Qué queda para C-05 (delta sobre `dev`):** (1) eliminar el residuo textual para que la búsqueda global dé cero
resultados; (2) fijar con precisión el alcance y el procedimiento de la búsqueda del CA; (3) pasar las dos etiquetas por
`t()` para que F-21 las traduzca sin reintroducir la sigla vieja; (4) dejar la regla escrita para que las etiquetas futuras
(catálogo de métricas de T-05, exportaciones de T-06) usen `PtsEnPint`.

## 1. Objetivo
Que la métrica de puntos en la pintura se llame `PtsEnPint` en toda la app y su documentación, sin ningún rastro de la
sigla anterior en código, UI ni `docs/`.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 · C-05 (requisito y CA) y §6 glosario (fila PtsEnPint).
- `docs/database.md` §`team_game_stats` (columna `paint_pts`, l.60).
- `docs/frontend.md` §Vista Equipo — card "Desglose ofensivo" (l.37) y §Vista Comparar — box score FIBA (l.47).
- `00-arquitectura-transversal.md` §1.0 (tabla `dev`, fila C-05/C-06), §2.2 (fila PtsEnPint), §3.20 (i18n, `t()`).
- Spec de `dev`: `git show dev:sdd/specs/18-etiquetas-y-umbrales/spec.md` y `progress.md` (CA-2 con el residuo).

## 3. Historias de usuario
- **US-1**: Como entrenador, quiero ver `PtsEnPint` en todas las pantallas (incluida Comparar), para que coincida con el
  glosario de mi cuerpo técnico.
- **US-2**: Como responsable del producto, quiero que una búsqueda de la sigla anterior no devuelva nada en el código, la UI
  ni la documentación, para dar por cerrado el renombre sin excepciones.

## 4. Requisitos funcionales
- **RF-1**: El sistema DEBE rotular `PtsEnPint` la métrica de puntos en la pintura en la card "Desglose ofensivo" de Equipo
  y en el box score de Comparar. (US-1) (Esp. v2 §C-05) (docs/frontend.md §Vista Equipo, §Vista Comparar)
- **RF-2**: El sistema NO DEBE renombrar la columna `team_game_stats.paint_pts` ni ninguna clave JSON (`paint_pts`); el
  cambio es solo de etiqueta visible y documentación. (US-1) (Constitución 5) (docs/database.md §team_game_stats)
- **RF-3**: Una búsqueda de la palabra `pep`, sin distinguir mayúsculas y como palabra completa, sobre `frontend/`,
  `backend/` (excluido `backend/venv/`) y `docs/`, DEBE devolver cero resultados; y el texto renderizado de todas las
  vistas NO DEBE contener esa palabra. (US-2) (Esp. v2 §C-05 CA)
- **RF-4**: La documentación DEBE describir `paint_pts` con su etiqueta `PtsEnPint` sin citar la sigla anterior (la
  trazabilidad del renombre queda en `sdd/`). (US-2) (docs/database.md l.60)
- **RF-5**: Las etiquetas `PtsEnPint` DEBEN producirse con la función de textos de la app (`t()`), para que ninguna
  traducción futura reintroduzca la sigla anterior. (US-1) (Arquitectura §3.20, DA-21)

## 5. Requisitos de datos / API
| Tabla / endpoint | Cambio | ¿Nuevo? |
|---|---|---|
| `team_game_stats.paint_pts` (INTEGER DEFAULT 0) | Ninguno (RF-2) | No |
| `GET /api/team/<team_code>` (`averages.paint_pts`, `game_log[].paint_pts`) | Ninguno | No |

Sin cambios de esquema ni de endpoints.

## 6. Estados de UI
| Vista / componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Equipo — card "Desglose ofensivo" | sin cambio | sin cambio (la card no se muestra si no hay datos) | sin cambio | sin cambio (SW sirve el `app.js` nuevo tras subir `CACHE`) | stat rotulada `PtsEnPint` |
| Comparar — box score FIBA | sin cambio | sin cambio | sin cambio | sin cambio | fila rotulada `PtsEnPint` |

Copy: `PtsEnPint` (literal del glosario v2). No hay copy nuevo para `docs/frontend.md` más allá de confirmar la etiqueta.

## 7. Criterios de aceptación
- **CA-1 (CA del cliente)**: Given el código y la UI, When se hace una búsqueda global de "PEP", Then no hay resultados.
  Procedimiento fijado en §9: búsqueda sin distinguir mayúsculas, palabra completa, sobre `frontend/`, `backend/` (sin
  `backend/venv/`) y `docs/`, más barrido del texto renderizado de Equipo y Comparar.
- **CA-2**: Given la vista Equipo de un equipo con partidos importados, When se abre la card "Desglose ofensivo", Then la
  stat se rotula `PtsEnPint` y su valor coincide con `averages.paint_pts` de `GET /api/team/<code>`.
- **CA-3**: Given Comparar con dos equipos, When se abre el box score FIBA, Then la fila se rotula `PtsEnPint` y muestra los
  valores de ambos equipos.
- **CA-4**: Given el esquema SQLite, When se inspecciona `team_game_stats`, Then la columna sigue llamándose `paint_pts` y
  los datos están intactos (mismo conteo de filas no nulas antes y después).
- **CA-5**: Given un equipo cuyo `paint_pts` promedio es nulo (C-11: sin dato), When se abre Comparar, Then la fila
  `PtsEnPint` muestra "—" y no un 0 (comportamiento de `dev` preservado).
- **CA-6**: Given un teléfono de 360–390 px, When se abre la card "Desglose ofensivo", Then la etiqueta `PtsEnPint` no se
  corta ni genera scroll horizontal del body.

## 8. Fuera de alcance
- Renombrar la columna `paint_pts` o claves JSON (RF-2).
- Renombrar otras siglas del desglose (`PtsSegCh`, `PtPer`, `PCA`): no las pide C-05.
- Traducir `PtsEnPint` a inglés/portugués: F-21 ([`../../fase-5-analitica-exploracion/14-F-21-multi-idioma/spec.md`](../../fase-5-analitica-exploracion/14-F-21-multi-idioma/spec.md)).
- Etiqueta de `paint_pts` en el catálogo de métricas (grupo `extra`) y en exportaciones: la definen T-05 y T-06 con esta
  misma etiqueta; C-05 solo deja la regla escrita (ver §9).
- Editar `sdd/` (specs históricos y la especificación del cliente, que citan la sigla como trazabilidad del requisito).

## 9. Ambigüedades
- **[DECISIÓN PROPUESTA — confirmar] Alcance de la "búsqueda global".** El cliente escribe "PEP"; en el repo la etiqueta era
  `PeP`. Se busca la palabra completa sin distinguir mayúsculas (`pep`, `PeP`, `PEP`, `Pep`) para cubrir ambas grafías.
  Alcance: `frontend/`, `backend/` sin `backend/venv/` (dependencias de terceros, donde "PEP" alude a las Python
  Enhancement Proposals; además `venv` no se integra, arquitectura D-02) y `docs/`. Se excluye `sdd/` porque allí la sigla
  es trazabilidad del requisito (incluida la especificación del cliente, que no se edita a mano). Se excluyen los datos
  importados (un jugador podría llamarse "Pep"): la búsqueda es sobre código y UI, no sobre nombres de la base. Como
  palabra completa no coinciden identificadores como `prepare` o `pepito`. `CLAUDE.md` hoy no contiene la sigla; si la
  tuviera, se incluye.
- **[DECISIÓN PROPUESTA — confirmar] Nota histórica en `docs/database.md`.** `dev` la dejó como "(antes `PeP`)". Para
  cumplir el CA literal se reescribe sin la sigla ("etiqueta de UI `PtsEnPint`; la columna no se renombra — ver C-05").
  La historia del renombre queda en este spec.
- **[DECISIÓN PROPUESTA — confirmar] Etiquetas futuras.** Toda etiqueta nueva de `paint_pts` (catálogo T-05 grupo `extra`,
  cabeceras de exportación T-06, diccionarios de F-21) DEBE ser `PtsEnPint`. Se deja escrito en `docs/frontend.md` al cerrar.
