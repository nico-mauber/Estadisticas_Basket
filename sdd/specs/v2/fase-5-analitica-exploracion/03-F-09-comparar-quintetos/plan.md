# Plan — F-09: Comparar quintetos

> **ID:** F-09 · **Prioridad:** P2 · **Fase y orden:** 5·03
> **Depende de:** T-02 · T-05 · F-05 · F-06 (rutas relativas en spec.md §0/§2)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** spec.md de este mismo requisito · Arquitectura §3.5, §3.6, §3.7, §3.10, §3.12, §6, §7, §8
> **Estimación:** M · 4–8 h

## 1. Enfoque
Agregar un módulo "Quintetos" a la sección Comparar (S6), calcado del módulo "Jugadores" de F-05: dos selectores de
combinación (3–5 jugadores, checkboxes reusados del selector de F-06), dos llamadas paralelas a `GET
/api/metrics/lineup?id=<id>&competition=<comp>` (T-05/T-01/T-02, registrado por F-06), y el mismo patrón visual de radar +
tabla enfrentada. La única pieza propia de F-09 es aplicar el ajuste/banda/badge de T-02 en ambos lados de la tabla y del
radar (mandato explícito del cliente, RF-3/RF-4) — sin agregar ninguna función de cálculo nueva: todo ya existe en
`sample.py` (T-02) y en `all_lineups` (F-06).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `frontend/js/app.js` (mod.) o `frontend/js/views/comparar.js` (X-01) | js-view | `renderCompareLineups()` (nueva función, paralela a `renderCompare()`/`renderComparePlayers()` de F-05); dos selectores de combinación (checkboxes por equipo, reusa el patrón `#team-lineup-picker` de F-06 pero permitiendo elegir el equipo de cada lado) | RF-1, RF-2, RF-6 |
| `frontend/js/components/tabs.js` (X-01, consumido) | component | agrega la pestaña "Quintetos" a las ya existentes "Equipos"/"Jugadores" (F-05) dentro de S6 | RF-1 |
| `frontend/js/api.js` (mod. si F-06/T-05 no dejaron `api.metrics`/`api.table` disponibles) | api | `api.metrics("lineup", {id, competition})` | RF-2, RF-7 |
| `frontend/js/charts.js` (mod.) | js-chart | variante de `drawCompareRadar`/`drawComparePlayerRadar` (F-05) para quintetos: ejes con valor ajustado donde T-02 aplica | RF-2, RF-3, ambigüedad 1 |
| `frontend/js/components/sample-badge.js` (T-02, consumido) | component | badge de cada quinteto, sin modificar | RF-4, RF-5 |
| `frontend/js/components/metric-card.js` (T-01, consumido) | component | fichas embebidas si se expone el panel "Ver todas las métricas" (ambigüedad 2) | RF-2 |
| `frontend/css/style.css` (mod.) | css | sección `/* ── compare-lineups (F-09) ── */` (selector de equipo por lado, layout de badges) | — |
| `frontend/sw.js` (mod., si X-01 no migró a runtime caching) | cache | módulo nuevo a `STATIC`, bump `CACHE` | — |
| `docs/api.md`, `docs/frontend.md` | doc | módulo Quintetos de Comparar | — (cierre) |

Matriz RF → archivo: RF-1 → `views/comparar.js`+`tabs.js`; RF-2 → `views/comparar.js` (reusa el HTML/CSS de
`renderCompare`/`renderComparePlayers`); RF-3/RF-4/RF-5 → `sample.py` (T-02, consumido) vía el payload de
`/api/metrics/lineup` (`adj`, `sample` ya vienen calculados); RF-6 → `views/comparar.js` (selectores sin filtrar por
equipo); RF-7 → `lineups.all_lineups`/`lineup_stats` (F-06, consumido); RF-8 → `stats_engine.py` (C-11, consumido); RF-9 →
`lineups.py` (formato de id, F-06/arquitectura §3.12, consumido); RF-10 → `views/equipo.js` (F-06, consumido, botón
"Comparar" en la fila de la tabla de quintetos).

## 3. Backend — rutas y modelos

### Endpoints
F-09 **no crea endpoints backend nuevos**: consume `GET /api/metrics/lineup?id=<team>:<pids>&competition=<comp_id>` (T-05,
registrado por F-06, con fichas T-01 y ajuste/banda/badge de T-02 embebidos, shape §7.3) dos veces, una por combinación. Si
ese endpoint no está disponible aún cuando se implemente F-09, usa el legado `GET /api/lineup/<team_code>?players=A|B|C`
(shape actual, sin ficha/ajuste — degradación documentada en §10; en ese caso RF-3/RF-4 no son verificables hasta que T-02
esté integrado en la respuesta).

### Tablas/columnas
Sin cambios de esquema (F-09 no está en `§5 Cambios de esquema previstos` de la arquitectura).

## 4. Backend — lógica
F-09 no agrega funciones de backend nuevas: toda la lógica (conjunto estándar, ajuste, banda, badge) ya vive en
`stats_engine.compute_standard` (T-05), `sample.adjusted`/`sample_level`/`band` (T-02) y `lineups.all_lineups` (F-06),
consumida a través del endpoint genérico de métricas. La única regla de F-09 es de presentación (frontend): qué eje del
radar usa el valor ajustado y cuál el crudo (ambigüedad 1, resuelta en el plan como valores ajustados para OER/DER/Net y
crudos para el resto).

Manejo de nulos (C-11): heredado sin cambios de `compute_standard` — F-09 no reimplementa reglas de nulos, renderiza "—"
donde `value` es `null`.

## 5. Frontend — capa API (api.js)
```js
api.metrics = (entityType, params) => apiFetch(`/api/metrics/${entityType}${qs(params)}`);   // de T-05, F-09 lo reusa
```
F-09 no agrega métodos propios a `api.js`; si `/api/metrics/lineup` no está disponible, usa `api.lineup(team, players)`
(legado, existente).

## 6. Frontend — UI
Módulo `quintetos` de S6 (`#/comparar/quintetos`). Estructura idéntica a `renderComparePlayers()` (F-05):

1. **Selectores A/B**: cada uno con un selector de equipo (cualquiera del catálogo) + checkboxes de 3–5 jugadores de ese
   equipo (reusa el patrón `#team-lineup-picker` de F-06, duplicado para dos equipos independientes).
2. **Botón "Comparar"**: mismo patrón de spinner/disabled que `renderCompare()`/`renderComparePlayers()`.
3. **Radar comparativo**: ejes de producción/tiro/rebote/balón del conjunto estándar de quinteto, con valor ajustado en
   los ejes con regresión (OER, DER, Net Rating) y crudo en el resto (ambigüedad 1).
4. **Tabla de métricas enfrentadas**: mismo layout `rows`/`shootRow`/`rawRow`/`advRow` que equipos/jugadores, con las
   claves de quinteto; filas con regresión muestran valor ajustado como base de comparación y el crudo entre paréntesis
   (o en tooltip, según el componente `metric-card.js` lo permita).
5. **Badge de muestra** (RF-4): `sample-badge.js` junto a la cabecera de cada columna (no solo dentro de la tabla), visible
   sin interacción adicional — literal del CA del cliente.
6. Panel opcional "Ver todas las métricas" (ambigüedad 2): despliega `standard-panel.js` con el conjunto completo de T-05
   de ambos quintetos lado a lado.

Estados loading/vacío/error/offline/éxito: tabla §6 de spec.md. Mobile 768px: mismo comportamiento responsive que
`renderCompare()`/`renderComparePlayers()` (ya probado; F-09 no cambia el breakpoint ni el layout base); selectores de
equipo+checkboxes se apilan verticalmente en mobile.

Componentes compartidos reusados: `drawCompareRadar`/variante de F-05 (`charts.js`), `sample-badge.js` (T-02),
`metric-card.js` (T-01), `standard-panel.js` (T-05, panel opcional), `tabs.js` (X-01), helpers existentes `PCT`, `DEC1`,
`DEC2`, `winCls`, `N1` (de `renderCompare`).

## 7. Navegación
Módulo `quintetos` dentro de S6 `comparar` (registrado por X-01 como pestaña, junto a "Equipos" y "Jugadores" de F-05;
F-09 llama `router.registerTab("comparar", {slug: "quintetos", label: "Quintetos", enabled: true, render:
renderCompareLineups})`). Ids en query: `#/comparar/quintetos?a=<team>:<pids>&b=<team>:<pids>` (arquitectura §3.12).

## 8. Contratos de datos
Shape: `/api/metrics/lineup` → §7.3 de la arquitectura (T-05/T-01/T-02, ya definido por F-06). Sin contrato propio
adicional; F-09 no inventa shapes nuevos.

## 9. Manejo de errores y offline
| Código | Caso | Mensaje es |
|---|---|---|
| 400 | selector con 2 o 6 jugadores en algún lado | "Elegí entre 3 y 5 jugadores" (copy existente, Feature 03) |
| — (validación cliente) | misma combinación en A y B | "Elegí dos combinaciones distintas" (*nuevo*, análogo a F-05 CA-5) |
| 404 | equipo sin pbp / combinación nunca usada | "Equipo no encontrado o sin play-by-play" (existente) |

`sw.js`: si F-09 agrega un archivo/componente nuevo y X-01 no migró a runtime caching, sube `CACHE` en 1; si solo agrega
funciones dentro de archivos existentes (`app.js`, `charts.js`), no hay cambio de `STATIC`.

## 10. Riesgos y decisiones
- **Riesgo:** si F-09 se implementa antes que T-02 esté completamente integrado en el endpoint de métricas, RF-3/RF-4 (el
  mandato explícito del cliente) no son verificables con datos reales. Mitigación: documentado como bloqueante de facto —
  F-09 depende funcionalmente de T-02 aunque el grafo de la arquitectura ya lo liste como dependencia directa.
- **Desviación respecto de la arquitectura:** ninguna. F-09 no propone ningún endpoint, columna, tabla o componente
  nuevo: reusa íntegramente lo que T-05/T-01/T-02/F-06 ya exponen. Las dos decisiones marcadas en spec.md §9 son de
  presentación (qué eje del radar usa el valor ajustado, cómo se organiza la tabla), no de contrato.
- **Dependencias técnicas:** `stats_engine.compute_standard`/`StatBundle` (T-05,
  `../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md`); `sample.adjusted`/`sample_level`/`band`/
  `is_ranked` (T-02, `../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md`); patrón de comparación y
  `drawComparePlayerRadar` (F-05, `../../fase-2-contexto-comparabilidad/08-F-05-comparar-jugadores/plan.md`);
  `all_lineups`/`GET /api/metrics/lineup`/tabla `team_lineups` (F-06,
  `../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md`); pestaña y router (X-01,
  `../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md`).
- **Estimación:** M · 4–8 h (frontend selectores + vista comparación 2–4 h; adaptación del radar 1–2 h; verificación
  manual y docs 1–2 h). Sin trabajo de backend nuevo — estimación menor que F-05 porque reusa directamente la
  infraestructura que F-06 ya deja lista (a diferencia de F-05, que fue la primera en construir el patrón de
  comparación por percentil de población propia).
