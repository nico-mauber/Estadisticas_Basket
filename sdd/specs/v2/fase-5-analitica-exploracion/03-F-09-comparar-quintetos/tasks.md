# Tasks — F-09: Comparar quintetos

> **ID:** F-09 · **Prioridad:** P2 · **Fase y orden:** 5·03
> **Depende de:** T-02 · T-05 · F-05 · F-06
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** plan.md de este mismo requisito

## Orden de ejecución

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.metrics("lineup", {id, competition})` (si F-06/T-05 no lo dejaron disponible) · `frontend/js/api.js` · cubre RF-2, RF-7 · Done: llamada resuelve el shape §7.3 con `adj`/`sample`

### Grupo D — Frontend: UI
- [ ] T-D1 · Pestaña "Quintetos" dentro de S6 Comparar (junto a "Equipos"/"Jugadores") · `frontend/js/views/comparar.js` (o `app.js`) · cubre RF-1 · Done: `#/comparar/quintetos` muestra dos selectores de combinación
- [ ] T-D2 · Selector de combinación por lado: elegir equipo + checkboxes de 3–5 jugadores de ese equipo · cubre RF-1, RF-6 · Done: se puede elegir un equipo distinto en A y en B
- [ ] T-D3 · `renderCompareLineups()`: pide `api.metrics("lineup", …)` (o `api.lineup` legado) para A y B en paralelo · cubre RF-2, RF-7 · Done: comparar dos combinaciones de equipos distintos no produce error
- [ ] T-D4 · Tabla de métricas enfrentadas con valor **ajustado** como base de comparación en OER/DER/Net Rating y colores ganador/perdedor, "—" en nulos · cubre RF-2, RF-3, RF-8 · Done: un quinteto de pocas posesiones con Net crudo alto no gana la fila si su ajustado es menor que el del otro lado
- [ ] T-D5 · Badge de muestra de T-02 visible junto a la cabecera de cada columna (no solo dentro de la tabla) · `frontend/js/components/sample-badge.js` (consumido) · cubre RF-4, RF-5 · Done: ambos quintetos muestran su badge (nivel, posesiones, partidos) sin interacción adicional
- [ ] T-D6 · Radar comparativo con ejes ajustados donde aplica (OER/DER/Net) y crudos en el resto · `frontend/js/charts.js` · cubre RF-2, RF-3 · Done: el radar se dibuja sin error para dos quintetos con niveles de muestra distintos
- [ ] T-D7 [P] · Validación "Elegí dos combinaciones distintas" (por id de quinteto) · cubre RF-9, CA-6 · Done: elegir la misma combinación exacta en A y B muestra el mensaje y no ejecuta la comparación
- [ ] T-D8 [P] · Panel opcional "Ver todas las métricas" con `standard-panel.js` (ambigüedad 2 del spec) · cubre RF-2 · Done: expandir el panel muestra el conjunto completo de T-05 de ambos quintetos
- [ ] T-D9 [P] · Deep link `#/comparar/quintetos?a=<id>&b=<id>` y precarga desde la acción "Comparar" de la tabla de quintetos (F-06, si está implementado) · cubre RF-9, RF-10 · Done: abrir la URL con `a`/`b` precarga ambos selectores

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado vacío "Elegí dos combinaciones para comparar" antes de la primera comparación
- [ ] T-E2 [P] · Bump de `sw.js` `CACHE` si se agregan archivos nuevos y X-01 no migró aún a runtime caching

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · N/A — F-09 no cambia esquema ni crea endpoints backend
- [ ] T-F3 · `curl`/navegador: confirmar que `GET /api/metrics/lineup?id=<team>:<pids>&competition=<comp>` (o el legado `GET /api/lineup/<team>?players=A|B|C`) responde 200 para dos combinaciones del dataset
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la comparación de quintetos completa
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅/❌
- [ ] T-F6 · CA-1 (CA del cliente): en el navegador, comparar dos combinaciones válidas y confirmar radar + tabla enfrentada + badge de muestra visible en ambos sin interacción adicional
- [ ] T-F7 · CA-2: identificar en el dataset (o construir sintéticamente) un quinteto de pocas posesiones y otro de muchas con Net crudo similar; comparar y confirmar que el ganador de la fila se decide por el ajustado, con badge BAJA y banda más ancha en el de menos posesiones
- [ ] T-F8 · CA-3: identificar un quinteto sin tiros libres intentados en el dataset, compararlo y confirmar "—" en FT%, sin color
- [ ] T-F9 · CA-4: comparar dos quintetos de equipos distintos y confirmar que no hay error y que cada columna conserva la identificación de su equipo
- [ ] T-F10 · CA-5: comparar los valores mostrados en F-09 contra la fila correspondiente de la tabla completa de quintetos de F-06 (`GET /api/table/team_lineups`) y confirmar coincidencia numérica en crudo y ajustado
- [ ] T-F11 · CA-6: elegir la misma combinación exacta en A y B y confirmar el mensaje de validación sin ejecutar la comparación

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-D1, T-D3, T-D4, T-D5, T-D6, T-F6 |
| CA-2 | T-D4, T-D5, T-F7 (depende de T-02) |
| CA-3 | T-D4, T-F8 |
| CA-4 | T-D2, T-D3, T-F9 |
| CA-5 | T-D3, T-D4, T-F10 (depende de F-06) |
| CA-6 | T-D7, T-F11 |

## Dependencias externas
- **T-05 debe exponer `stats_engine.compute_standard`** antes de que `/api/metrics/lineup` tenga contenido (indirecto,
  vía F-06).
- **T-02 debe exponer `sample.adjusted`/`sample_level`/`band`** antes de que RF-3/RF-4 (el mandato del cliente) sean
  verificables con datos reales; sin T-02, F-09 muestra solo valores crudos sin badge (degradación documentada en
  plan.md §10).
- **F-06 debe exponer `all_lineups`/`GET /api/metrics/lineup`/tabla `team_lineups`** antes de T-C1/T-D3/T-F10; sin F-06,
  F-09 usa el legado `GET /api/lineup/<team>?players=A|B|C` con degradación (sin ficha/ajuste).
- **F-05 debe haber dejado el patrón de comparación y la pestaña "Jugadores" de S6** antes de T-D1 (F-09 agrega una
  tercera pestaña al mismo módulo, no crea el módulo Comparar desde cero).
- **X-01 debe registrar la pestaña `quintetos` de S6** antes de T-D1 (o F-09 la agrega como sección propia si X-01 no
  llegó).
- **Dataset de verificación**: los 13 partidos del seed, con al menos dos combinaciones de 5 jugadores del mismo equipo
  con posesiones muy distintas (para CA-2) y un quinteto sin tiros libres intentados (para CA-3).
- Ninguna variable de entorno nueva.
