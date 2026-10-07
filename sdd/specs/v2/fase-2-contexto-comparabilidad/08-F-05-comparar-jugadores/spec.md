# Spec — F-05: Comparar jugadores

> **ID:** F-05 · **Prioridad:** P1 · **Fase y orden:** 2·08
> **Depende de:** T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)) · C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md)) · X-01 ([01-X-01-reorganizacion-navegacion/spec.md](../01-X-01-reorganizacion-navegacion/spec.md))
> **Habilita:** F-09
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-05 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S6 "Jugadores" · §3 T-05, T-01 · Arquitectura §3.4, §3.5, §3.6, §3.12, §6, §7, §8 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §4 F-05):** "Agregar comparación de jugadores en la misma pantalla donde hoy se comparan equipos. Reutilizar el radar comparativo, la tabla de métricas enfrentadas y el bloque de métricas avanzadas. Debe permitir comparar jugadores de equipos y competencias distintas." Criterio de aceptación del cliente: "Dos jugadores seleccionados muestran radar, tabla enfrentada y avanzadas de forma equivalente a la comparación de equipos."

**Por qué:** el mapa de secciones (§1.3 S6 "Comparar") fija un módulo "Jugadores" con "Mismo formato, incluso entre equipos y competencias distintas", requisito F-05, dentro de la sección Comparar que hoy solo compara equipos.

**Qué existe hoy (verificado en código, rama `main`):**
- `frontend/js/app.js` `renderCompare()` (línea 1474): compara dos **equipos** elegidos en `#compare-a`/`#compare-b` (con filtro opcional de competencia `#compare-comp`). Pide `api.team(codeA)` y `api.team(codeB)` en paralelo, calcula promedios (`_computeAvg` si hay filtro de competencia, si no usa `dataA.averages`/`dataB.averages` directo), arma una tabla de tiro (`shootRow`, con % y color ganador/perdedor vía `winCls`), una tabla de conteos (`rawRow`: REB, AS, ST, Blq, PER, FP, PtsEnPint, PtsSegCh, PtPer, Pts Banca, PCA) y una tabla de métricas avanzadas (`advRow`: OER, DER, Net, eFG%, TS%, PACE, OR%, DR%, TO%, AS%, Pts, Pos). Dibuja el radar con `drawCompareRadar("chart-compare-radar", avA, avB, lg, nameA, nameB)` de `charts.js`. **No hay** selector de jugadores en esta pantalla; `#sec-compare` solo tiene los selects de equipo.
- `refreshCompareSelectors()` (línea 212): puebla `#compare-a`/`#compare-b` con la lista de equipos (`api.teams()`); no toca jugadores.
- `frontend/js/charts.js` expone `drawCompareRadar` — a confirmar en el plan si acepta directamente un objeto de métricas de jugador (mismas claves que equipo: `oer`, `efg_pct`, etc., ya compartidas por `calc_player_stats`/`calc_team_stats`) o si necesita adaptación de escalas (el volumen de un jugador es mucho menor que el de un equipo en las métricas de conteo).
- `backend/app.py` `player_stats(team_code, player_name)` (línea 459) resuelve por `norm_name`, devuelve `averages`, `league` (promedio de liga de esa métrica), `game_log`. No hay endpoint que compare directamente dos jugadores de equipos distintos: la comparación de equipos tampoco lo tiene, arma ambos lados en el cliente con dos llamadas paralelas.
- **No existe hoy ningún soporte para comparar jugadores de competencias distintas**: `player_stats` no recibe `competition_id`; el filtro de competencia actual (`_filterByComp`) opera sobre el `game_log` ya traído, dentro de la competencia en la que el jugador jugó.

**Qué resolvieron features anteriores:** Feature 03/04/11 dejaron el patrón de comparación de equipos (radar + tabla enfrentada + avanzadas) que F-05 debe reutilizar textualmente. En v2 fase 1: T-05 define el conjunto estándar de jugador (`StatBundle`, `compute_standard`); T-01 la ficha con percentil, ranking, distancias (necesaria para resolver "contra qué población se calcula cada percentil" cuando los jugadores son de competencias distintas, arquitectura §9 nota del orquestador); C-08 la identidad persistente con `player_id` entero (necesaria para elegir jugadores sin ambigüedad de nombre); X-01 la pestaña `jugadores` dentro de S6 Comparar.

**Qué queda para F-05:** agregar el selector de dos jugadores (de cualquier equipo y competencia) a la sección Comparar, reusar el radar/tabla/avanzadas con datos de jugador, y resolver la comparabilidad entre competencias distintas fijando la población de percentil de cada jugador como la de su propia competencia (arquitectura §9, nota del orquestador para F-05).

## 1. Objetivo
Agregar una pestaña "Jugadores" dentro de la sección Comparar que permita elegir dos jugadores de cualquier equipo y competencia y compararlos con el mismo formato que la comparación de equipos: radar, tabla de métricas enfrentadas y bloque de métricas avanzadas, cada uno con su percentil calculado contra la población de su propia competencia.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 F-05 (completo), §1.3 S6 "Comparar" → módulo Jugadores, §3 T-05 (conjunto estándar, CA), §3 T-01 (ficha, población, CA), §2 C-11 (nulos), §2 C-08 (identidad, para elegir sin ambigüedad).
- `docs/api.md` § `GET /api/player/<team_code>/<player_name>`. `docs/frontend.md` § Vistas → Comparar (`renderCompare`, `drawCompareRadar`).
- `docs/metrics.md` § fórmulas de jugador (OER, eFG%, TS%, PACE, OR%/DR%, TO%, AS%, etc.).
- Arquitectura §3.4 (identidad, `player_id`), §3.5 (conjunto estándar T-05, tipo de entidad `player`), §3.6 (ficha T-01, población de jugadores ≥60 minutos, **población de referencia por competencia**: "Equipos: al menos 3 partidos en la competencia… Jugadores: al menos 60 minutos en la competencia", clave para jugadores de competencias distintas), §3.12 (S6 `jugadores`, ids en query `a`, `b`), §6 (`GET /api/metrics/player`), §7.1, §7.3, §8 (componente `metric-card.js`, `standard-panel.js`).
- Nota del orquestador (encargo de esta tarea): "Jugadores de equipos y competencias distintas: definir contra qué población se calcula cada percentil (la de su propia competencia) → §9" — resuelta en RF-4 de este spec.
- Specs previos: patrón de comparación de equipos (`renderCompare` en `app.js`, sin spec SDD dedicado — es funcionalidad preexistente a la migración a SDD).

## 3. Historias de usuario
- US-1: Como entrenador, quiero comparar dos jugadores con el mismo formato con el que comparo equipos, para decidir por cuál apostar minutos o a quién marcar.
- US-2: Como analista, quiero comparar jugadores de equipos o competencias distintas, para evaluar un fichaje o un rival externo a mi liga.
- US-3: Como entrenador, quiero que la comparación muestre el percentil de cada jugador dentro de su propia competencia, para no comparar un valor absoluto contra poblaciones de tamaño o nivel distintos sin saberlo.

## 4. Requisitos funcionales

- RF-1: El sistema DEBE ofrecer, dentro de la sección Comparar, una pestaña o módulo "Jugadores" con dos selectores de jugador independientes (cualquier equipo, cualquier competencia), análogos a los selectores de equipo existentes. · (US-1) (Esp. v2 §F-05, §1.3 S6)
- RF-2: El sistema DEBE mostrar, para los dos jugadores elegidos, el mismo formato que la comparación de equipos: **radar comparativo**, **tabla de métricas enfrentadas** (tiro: T2/T3/TL con % y color ganador; conteos: REB, AS, ST, Blq, PER y las métricas del conjunto estándar de T-05 aplicables a jugador) y **bloque de métricas avanzadas** (OER, DER, Net Rating, eFG%, TS%, PACE, OR%, DR%, TO%, AS%, PTS, POS). · (US-1) (Esp. v2 §F-05 "Reutilizar el radar comparativo, la tabla de métricas enfrentadas y el bloque de métricas avanzadas")
- RF-3: El sistema DEBE permitir elegir dos jugadores de **equipos y/o competencias distintas** sin restricción. · (US-2) (Esp. v2 §F-05 "Debe permitir comparar jugadores de equipos y competencias distintas")
- RF-4: Cada métrica de cada jugador DEBE traer su ficha T-01 (percentil, ranking, distancias) calculada contra la población de la **propia competencia de ese jugador** (no una población combinada ni la del otro jugador): dos jugadores de competencias A y B se comparan por su valor absoluto en la tabla enfrentada, y cada uno muestra su percentil relativo a A o a B respectivamente, con la competencia de referencia visible junto al percentil. · (US-3) (arquitectura, nota del orquestador para F-05; T-01 "Población de referencia… Jugadores: al menos 60 minutos en la competencia")
- RF-5: El sistema DEBE calcular las métricas de cada jugador con el conjunto estándar de T-05 (agregación pooled sobre los partidos disponibles de ese jugador en su competencia, o en la selección de contexto activa si T-03 ya está disponible). · (US-1) (Esp. v2 §T-05)
- RF-6: El radar comparativo DEBE mostrar los mismos ejes para ambos jugadores (subconjunto de métricas del conjunto estándar adecuado a un radar: producción, tiro, balón, rebote — la misma selección de ejes que ya usa `drawCompareRadar` para equipos, adaptada a las claves de jugador). · (US-1) (Esp. v2 §F-05 "reutilizar el radar comparativo")
- RF-7: Ningún valor inexistente se muestra como 0 (C-11): un jugador sin triples intentados → fila de tiro de 3 con "—", nunca "0/0 (0%)"; una métrica no calculable para alguno de los dos jugadores → esa celda "—" y sin color ganador/perdedor en esa fila. · (US-1) (Esp. v2 §C-11) (`sdd/specs/08-nulos-vs-cero/spec.md`)
- RF-8: El sistema DEBE identificar a los jugadores elegidos por `player_id` entero en la URL (`#/comparar/jugadores?a=<id>&b=<id>`) cuando C-08 esté disponible; hasta entonces, por `team_code` + nombre (compatibilidad con el selector actual de equipo/jugador). · (US-1) (arquitectura §3.4, §3.12)
- RF-9: El sistema DEBE permitir llegar a esta comparación desde la acción "Comparar" del plantel (F-08) con los dos jugadores preseleccionados, si F-08 ya está implementado. · (US-1) (arquitectura, `../07-F-08-plantel-en-equipo/spec.md` RF-5)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `GET /api/player/<team_code>/<player_name>` | endpoint existente | `{player, team_code, team_name, games, averages, league, game_log[]}` | existe |
| `GET /api/metrics/player?id=<player_id>&competition=<id>` | endpoint genérico T-05 | shape §7.3 + fichas §7.1 (T-01) | de T-05; F-05 solo lo consume, dos veces (una por jugador), cada una con la `competition` resuelta a la del jugador elegido |
| `GET /api/rankings/player/<metric_key>?competition=<id>&highlight_id=<player_id>` | endpoint T-01 (hover del ranking completo) | shape §7.1b | de T-01; F-05 lo reusa si `metric-card.js` lo ofrece embebido |

Sin cambios de esquema (F-05 no está en la lista de `§5 Cambios de esquema previstos` de la arquitectura).

## 6. Estados de UI
Módulo **Jugadores** de S6 (`#/comparar/jugadores`). Todo copy nuevo con `t()` y marcado para `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selectores de jugador (A y B) | — | placeholder "Elegí un jugador" (copy existente, análogo al de equipo) | — | — | dos buscadores con equipo y competencia visibles junto al nombre (para distinguir homónimos) |
| Botón "Comparar" | spinner + "Comparando..." (copy existente, mismo patrón que equipos) | — | toast con el mensaje del backend o "No se pudo comparar" (*nuevo*) | `/api/*` siempre a red (SW) | — |
| Resultado (radar + tabla + avanzadas) | — | "Elegí dos jugadores para comparar" (*nuevo*, antes de la primera comparación) | mensajes de RF-3/validación: "Elegí dos jugadores distintos" (copy existente, análogo a equipos) | idem | radar comparativo con los ejes de RF-6; tabla enfrentada con colores ganador/perdedor y "—" en nulos; bloque de avanzadas; leyenda de competencia de cada jugador junto al percentil (`(percentil vs. Liga X)` / `(percentil vs. Liga Y)`, *nuevo*) |

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "Dos jugadores seleccionados muestran radar, tabla enfrentada y avanzadas de forma equivalente a la comparación de equipos." Given dos jugadores válidos elegidos en los selectores, When se pulsa "Comparar", Then se muestran las tres piezas (radar, tabla enfrentada, bloque de avanzadas) con la misma estructura visual que `renderCompare` de equipos.
- CA-2: Given dos jugadores de equipos y competencias distintas, When se comparan, Then la comparación se completa sin error y cada jugador muestra su percentil junto a la etiqueta de su propia competencia.
- CA-3: Given un jugador sin ningún triple intentado en la selección, When se lo compara, Then su fila de tiro de 3 muestra "—" en vez de "0/0 (0%)", y esa fila no colorea ganador/perdedor para ese jugador.
- CA-4: Given los mismos dos jugadores que ya se comparan en `/api/player/<team>/<name>` individualmente, When se los compara en F-05, Then los valores de la tabla enfrentada coinciden numéricamente con los de la ficha individual de cada uno (misma fuente de cálculo, T-05).
- CA-5: Given el selector con el mismo jugador elegido en A y B, When se pulsa "Comparar", Then el sistema responde "Elegí dos jugadores distintos" y no ejecuta la comparación.
- CA-6: Given una fila con acción "Comparar" en el Plantel (F-08), When se seleccionan dos jugadores y se confirma, Then la vista navega a esta comparación con ambos ya cargados (si F-08 está implementado; si no, se verifica solo el armado de la URL).

## 8. Fuera de alcance
- Comparación de más de 2 jugadores simultáneos: fuera de alcance de v2 (el cliente pide "dos jugadores").
- Comparación de quintetos: F-09 (reutiliza esta misma infraestructura, según nota del orquestador).
- Ficha de identidad completa (foto, altura, nacionalidad) en el encabezado de cada jugador comparado: F-16; F-05 solo muestra nombre, equipo y competencia como mínimo para desambiguar.
- Filtros de contexto avanzados (período, sede, rival) aplicados de forma independiente a cada jugador: T-03 los aplica igual a toda la vista cuando esté disponible; comparar bajo contextos distintos por lado queda fuera de v2.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **Radar con jugadores de escala distinta.** El radar de equipos usa las mismas claves para ambos lados con una escala común calculada sobre el promedio de liga (`lg` en `drawCompareRadar`). Con jugadores de competencias distintas no hay un único "promedio de liga" común. Decisión: el radar usa como referencia de escala el **mayor** de los dos promedios de competencia de cada métrica (o, si `drawCompareRadar` ya normaliza por percentil en vez de por promedio crudo cuando T-01 esté integrado, usar el percentil 0–100 de cada jugador en su propia competencia como valor del eje — preferible y más consistente con T-01). Se marca como decisión técnica a validar en plan.md.
2. [DECISIÓN PROPUESTA — confirmar] **Qué hace "Elegí dos jugadores distintos" cuando son homónimos de equipos distintos.** Con `player_id` (C-08) la distinción es exacta; sin C-08, dos jugadores de igual nombre en equipos distintos son personas distintas y deben poder compararse. Decisión: la validación de "mismo jugador" compara `player_id` si está disponible, o `(team_code, nombre normalizado)` si no.
3. [NEEDS CLARIFICATION] **Contexto de "últimos N partidos" quand los dos jugadores están en competencias con calendarios de longitud distinta.** El cliente no lo aclara. Hasta que T-03/T-04 completen el contrato, F-05 usa el conjunto estándar en modo `total`/`partido` (sin `last`) por defecto y aplica `last` de forma independiente a cada jugador si el selector de contexto ya está disponible.
