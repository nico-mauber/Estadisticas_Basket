# Plan — F-05: Comparar jugadores

> **ID:** F-05 · **Prioridad:** P1 · **Fase y orden:** 2·08
> **Depende de:** T-05 · T-01 · C-08 · X-01 (rutas relativas en spec.md §0/§2)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** spec.md de este mismo requisito · Arquitectura §3.4, §3.5, §3.6, §3.12, §6, §7, §8
> **Estimación:** M · 6–10 h

## 1. Enfoque
Agregar un módulo "Jugadores" a la sección Comparar (S6) que replica `renderCompare()` (equipos) con dos jugadores en vez
de dos equipos: dos selectores de jugador (con equipo y competencia visibles para desambiguar), dos llamadas paralelas a
`GET /api/metrics/player?id=<id>&competition=<comp_de_ese_jugador>` (T-05/T-01), y el mismo patrón visual de radar + tabla
enfrentada + avanzadas. La pieza nueva de diseño es RF-4: cada jugador trae su propia `competition_id` resuelta (la de sus
partidos, o la elegida en el selector si el jugador jugó en más de una), y su ficha T-01 se pide con esa competencia — sin
mezclar poblaciones. Se resuelve el radar con jugadores de competencias distintas normalizando por percentil (decisión
técnica, ambigüedad 1 del spec) en lugar de por promedio crudo de liga.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `frontend/js/app.js` (mod.) o `frontend/js/views/comparar.js` (X-01) | js-view | `renderComparePlayers()` (nueva función, paralela a `renderCompare()`); selectores de jugador con búsqueda por nombre+equipo+competencia | RF-1, RF-2, RF-3 |
| `frontend/js/components/tabs.js` (X-01, consumido) | component | pestañas "Equipos" / "Jugadores" (/ "Quintetos" cuando F-09 exista) dentro de S6 | RF-1 |
| `frontend/js/api.js` (mod. si T-05/T-01 no agregaron `api.metrics`/`api.ranking` aún) | api | `api.metrics("player", {id, competition})` | RF-5 |
| `frontend/js/charts.js` (mod.) | js-chart | `drawCompareRadar` adaptado o nueva variante `drawComparePlayerRadar(elId, fichaA, fichaB, ejes, nameA, nameB)` que grafica percentiles 0–100 en vez de valores crudos con promedio de liga | RF-6, ambigüedad 1 |
| `frontend/js/components/metric-card.js` (T-01, consumido) | component | fichas embebidas en la tabla enfrentada (percentil + competencia de referencia) | RF-4 |
| `frontend/css/style.css` (mod.) | css | sección `/* ── compare-players (F-05) ── */` (leyenda de competencia por jugador) | — |
| `frontend/sw.js` (mod., si X-01 no migró a runtime caching) | cache | módulo nuevo a `STATIC`, bump `CACHE` | — |
| `docs/api.md`, `docs/frontend.md` | doc | módulo Jugadores de Comparar, uso de `/api/metrics/player` desde F-05 | — (cierre) |

Matriz RF → archivo: RF-1 → `views/comparar.js`+`tabs.js`; RF-2 → `views/comparar.js` (reusa el HTML/CSS de `renderCompare`);
RF-3 → `views/comparar.js` (selectores sin filtrar por equipo/competencia); RF-4 → `population.ficha` (T-01, consumido,
llamado con la `competition_id` propia de cada jugador); RF-5 → `stats_engine.compute_standard` (T-05, consumido) vía
`GET /api/metrics/player`; RF-6 → `charts.js`; RF-7 → `stats_engine.py` (C-11, consumido, ya devuelve nulos con razón);
RF-8 → `identity.py` (C-08, consumido) / fallback por nombre; RF-9 → `views/equipo.js` (F-08, consumido, botón "Comparar
seleccionados").

## 3. Backend — rutas y modelos

### Endpoints
F-05 **no crea endpoints backend nuevos**: consume `GET /api/metrics/player?id=<player_id>&competition=<comp_id>` de T-05
(con fichas T-01 embebidas, shape §7.3) dos veces, una por jugador, cada vez con la `competition_id` de ese jugador. Si
T-05 aún no expone ese endpoint genérico cuando se implemente F-05, F-05 usa el legado `GET
/api/player/<team_code>/<player_name>` (shape actual, sin fichas T-01: la comparación se degrada a valores crudos sin
percentil hasta que T-05/T-01 estén disponibles — documentado en §10 como degradación temporal, no como hueco de
arquitectura).

### Tablas/columnas
Sin cambios de esquema (F-05 no está en `§5 Cambios de esquema previstos` de la arquitectura).

## 4. Backend — lógica
F-05 no agrega funciones de backend nuevas: toda la lógica de cálculo (conjunto estándar, percentil, población por
competencia) ya vive en `stats_engine.compute_standard` (T-05) y `population.ficha` (T-01), llamadas con la
`competition_id` propia de cada jugador — la única regla nueva de F-05 es **cuál** `competition_id` usar por jugador:

```
# resolución de competencia por jugador (en el frontend, al armar la petición; sin lógica backend nueva)
resolve_player_competition(player):
    """
    1. Si el jugador tiene una única competition_id en sus partidos → esa.
    2. Si tiene más de una (jugó en más de una competencia importada) → la más reciente
       (mismo criterio de DA-14, "competencia más reciente de la entidad"), con un selector
       para elegir otra si el usuario lo pide.
    3. La ficha T-01 de ese jugador siempre se pide con esa competition_id: nunca se mezcla
       con la competencia del otro jugador comparado.
    """
```

Manejo de nulos (C-11): heredado sin cambios de `compute_standard`/`population.ficha` — F-05 no reimplementa reglas de
nulos, solo consume el resultado y renderiza "—" donde `value` o `percentile` es `null`.

## 5. Frontend — capa API (api.js)
```js
api.metrics = (entityType, params) => apiFetch(`/api/metrics/${entityType}${qs(params)}`);   // de T-05, F-05 lo reusa
api.ranking = (entityType, metric, params) => apiFetch(`/api/rankings/${entityType}/${metric}${qs(params)}`); // de T-01
```
F-05 no agrega métodos propios a `api.js`; si T-05/T-01 aún no los agregaron, F-05 usa `api.player(team, name)` (legado,
existente) para ambos jugadores.

## 6. Frontend — UI
Módulo `jugadores` de S6 (`#/comparar/jugadores`). Estructura idéntica a `renderCompare()` de equipos:

1. **Selectores A/B**: dos campos de búsqueda con autocompletado (nombre, equipo, competencia visibles en cada opción
   para desambiguar homónimos — reusa el patrón de búsqueda de S7 si `components/` ya lo generalizó, o un `<datalist>`
   simple si no).
2. **Botón "Comparar"**: mismo patrón de spinner/disabled que `renderCompare()`.
3. **Radar comparativo**: `drawComparePlayerRadar` (o `drawCompareRadar` adaptado) con ejes de producción/tiro/balón/rebote
   del conjunto estándar de jugador, valores normalizados a percentil 0–100 (cada jugador contra su propia competencia,
   RF-4/ambigüedad 1) en vez del valor crudo usado en el radar de equipos.
4. **Tabla de métricas enfrentadas**: mismo layout que `rows`/`shootRow`/`rawRow` de `renderCompare()`, con las claves de
   jugador del conjunto estándar T-05 (T2/T3/TL, REB, AS, ST, Blq, PER) y, debajo de cada valor, el percentil vía
   `metric-card.js` compacto con la etiqueta de competencia (`p62 vs. Liga Uruguaya 2025/2026`).
5. **Bloque de métricas avanzadas**: misma tabla `advRow` que equipos, con las claves de jugador (`oer`, `der`,
   `net_rating`, `efg_pct`, `ts_pct`, `pace`, `or_pct`, `dr_pct`, `to_pct`, `as_pct`, `pts`, `possessions`).

Estados loading/vacío/error/offline/éxito: tabla §6 de spec.md. Mobile 768px: mismo comportamiento responsive que
`renderCompare()` de equipos (ya probado en producción; F-05 no cambia el breakpoint ni el layout base).

Componentes compartidos reusados: `drawCompareRadar`/nueva variante (`charts.js`), `metric-card.js` (T-01), `tabs.js`
(X-01), helpers existentes `PCT`, `DEC1`, `DEC2`, `winCls`, `N1` (de `renderCompare`, mismos criterios).

## 7. Navegación
Módulo `jugadores` dentro de S6 `comparar` (registrado por X-01 como pestaña; F-05 llama
`router.registerTab("comparar", {slug: "jugadores", label: "Jugadores", enabled: true, render: renderComparePlayers})`).
Ids en query: `#/comparar/jugadores?a=<player_id>&b=<player_id>` (o `?a=<team>:<nombre>&b=<team>:<nombre>` si C-08 no
cerró aún, arquitectura §3.12).

## 8. Contratos de datos
Shape: `/api/metrics/player` → §7.3 de la arquitectura (T-05/T-01). Sin contrato propio adicional; F-05 no inventa shapes
nuevos.

## 9. Manejo de errores y offline
| Código | Caso | Mensaje es |
|---|---|---|
| — (validación cliente) | mismo jugador en A y B | "Elegí dos jugadores distintos" (copy existente, análogo a equipos) |
| — (validación cliente) | falta elegir alguno de los dos | "Elegí dos jugadores" (copy existente, análogo a "Selecciona dos equipos") |
| 404 | jugador no encontrado (legado) | "Jugador no encontrado" (existente) |

`sw.js`: si F-05 agrega un archivo nuevo (`drawComparePlayerRadar` en `charts.js` no es un archivo nuevo, es una función),
no hay cambio de `STATIC`; si X-01 no migró a runtime caching y se crea un componente nuevo, sube `CACHE` en 1.

## 10. Riesgos y decisiones
- **Riesgo:** si F-05 se implementa antes que T-01, no hay percentil por competencia disponible; el radar y la tabla se
  degradan a valores crudos (como hoy en equipos, sin T-01). Mitigación: documentado como degradación temporal;
  RF-4/ambigüedad 1 solo aplica una vez T-01 esté disponible.
- **Desviación respecto de la arquitectura:** ninguna. La resolución de competencia por jugador (RF-4) es una decisión de
  UX de F-05 sobre datos que T-01/T-05 ya exponen (población "de su propia competencia" ya está en la arquitectura §3.6);
  no se propone ningún endpoint, columna o módulo nuevo.
- **Dependencias técnicas:** `stats_engine.compute_standard`/`StatBundle` (T-05,
  `../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md`); `population.ficha` (T-01,
  `../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md`); identidad/`player_id` (C-08,
  `../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md`); pestaña y router (X-01,
  `../01-X-01-reorganizacion-navegacion/plan.md`); origen de navegación desde el plantel (F-08,
  `../07-F-08-plantel-en-equipo/plan.md`, opcional).
- **Estimación:** M · 6–10 h (frontend selectores + vista comparación 3–5 h; adaptación del radar a percentil 1–2 h;
  verificación manual y docs 2–3 h). Sin trabajo de backend nuevo.
