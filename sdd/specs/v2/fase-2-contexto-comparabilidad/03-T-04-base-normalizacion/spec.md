# Spec — T-04: Base de normalización

> **ID:** T-04 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 03
> **Depende de:** [T-05](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md) · [T-03](../02-T-03-selector-global-contexto/spec.md)
> **Habilita:** F-14, F-18
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** [Especificación v2](../../00-especificacion-cliente-v2.md) §3 · T-04 (y §1.1 "Base de normalización") · Arquitectura [§2.1, §3.5, §3.8, §3.3, §9.2 I-02/I-08](../../00-arquitectura-transversal.md)

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §3 T-04):**
- "En toda vista con estadísticas, selector de base: totales · por partido · por 40 minutos · por 100 posesiones."
- "La selección se mantiene al navegar entre pestañas dentro de la misma sesión."
- "Aplica tanto a equipo como a jugador, a lineups y a los splits de T-03."
- Criterio de aceptación: "Las cuatro bases devuelven valores consistentes entre sí para un mismo jugador y partido."

**Qué existe hoy (verificado en código, `main`):**
- No existe selector de base en ningún lugar de la UI. `backend/app.py:team_stats` (l.409) y `player_stats` (l.543)
  devuelven siempre **promedios de tasas por partido** (`_avg` sobre `game_log`, excluye `None`); no hay un modo
  "totales" ni "por 40" ni "por 100 posesiones" en ningún endpoint.
- `backend/stats_engine.py:calc_team_stats`/`calc_player_stats` calculan sobre un único partido (o sobre las cajas
  agregadas de `lineups`/`clutch`, que ya son pooled — arquitectura §1.1): no hay un parámetro de base.
- `pace` (`stats_engine.py` l.37 y ss.) usa `t.get("minutes", 40)`, y `t` nunca trae minutos reales → PACE siempre
  calculado sobre 40 minutos aunque haya prórroga (arquitectura D-08); F-11 lo corrige escribiendo `games.minutes`.
- No hay concepto de "posesiones de la selección" reutilizable fuera de la fórmula puntual de un partido: cada handler
  recalcula `possessions(...)` (l.32) sobre las cajas que tiene a mano.
- Ningún estado de sesión persiste la elección de un selector entre pestañas (no existe `sessionStorage` para
  preferencias de UI hoy; `frontend/js/app.js` no lee/escribe ninguna clave con ese propósito).

**Qué ya resolvieron features anteriores.** Ninguna de `sdd/specs/01-*…11-*` toca bases de normalización (no existía
el concepto). `sdd/specs/03-lineups`, `04-on-off`, `05-clutch` ya agregan las cajas de forma **pooled** (suman
conteos y calculan la tasa una vez) — arquitectura §1.1, "Agregación pooled" —, que es el mismo principio que exige
DA-02 para T-04 y que ya deja sentado que "totales" y "tasas pooled" son coherentes entre sí en esos tres módulos.
`sdd/specs/08-nulos-vs-cero` fija que una tasa con denominador 0 es `null`, no 0 — regla que T-04 hereda sin
modificarla (una base no cambia si una métrica es nula, solo cómo se escala un conteo).

**Qué queda.** El propio selector de base (backend: función central de escalado; frontend: componente y persistencia
por sesión), su aplicación al conjunto estándar de T-05 (equipo, jugador, quinteto/on-off), y su combinación con los
splits de T-03 (arquitectura §3.8: la base es un parámetro más del contrato de contexto, ortogonal a los filtros).

## 1. Objetivo
Ofrecer, en toda vista con estadísticas, un selector de base (totales · por partido · por 40 minutos · por 100
posesiones) que escala las métricas de conteo de forma consistente entre las cuatro opciones, para el mismo jugador,
equipo, quinteto y split, y que se recuerda durante la sesión al navegar entre pestañas.

## 2. Fuentes (trazabilidad)
- Especificación v2 §3 T-04 (completo), §1.1 "Base de normalización", §3 T-05 (conjunto estándar al que se aplica la
  base), §2 C-11 (nulos, se mantiene sin cambios bajo cualquier base).
- `docs/metrics.md` §Posesiones (`POS = 2PA + 3PA + FTA×0.44 + TOV − OR`), §Plays, §Eficiencia ofensiva y defensiva,
  §Eficiencia de tiro (fórmulas base que T-04 no reinterpreta: son `fixed`, no se escalan).
- `docs/api.md` §GET /api/team, §GET /api/player (shape actual, sin parámro de base); `docs/database.md`
  §`games.minutes` (default 40, arquitectura D-08 lo corrige en F-11).
- `00-arquitectura-transversal.md` §2.1 (pooled, DA-02), §3.5 (`StatBundle`, `compute_standard`, `apply_base`,
  columna `base_mode` del catálogo de claves), §3.8 (parámetro `base` en el contrato de contexto, cálculo en
  backend, nunca en el frontend), §3.3 (persistencia por sesión: `sessionStorage` + URL, default `ui.default_base`),
  §7.3 (shape del conjunto estándar con el campo `base` como eco), §9.2 I-08 (T-04 recibe el contexto desde el día 1).
- Specs previos: `sdd/specs/03-lineups/spec.md`, `04-on-off/spec.md`, `05-clutch/spec.md` (agregación pooled ya
  aplicada a esos tres módulos, precedente directo de "totales" como base 0).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver las estadísticas de un jugador o un equipo en la base que me sirve para comparar
  (por partido, por 40 minutos, por 100 posesiones o el total acumulado), para no tener que recalcularlo a mano.
- US-2: Como entrenador, quiero que la base elegida se mantenga al pasar de la pestaña Resumen a la pestaña Tiro del
  mismo equipo, para no tener que volver a elegirla en cada pantalla.
- US-3: Como analista, quiero confiar en que las cuatro bases son la misma información escalada de forma coherente,
  para poder citar cualquiera de ellas sin desconfiar del número.
- US-4: Como entrenador, quiero comparar un quinteto con pocos minutos frente a uno con muchos usando "por 40
  minutos" o "por 100 posesiones", para neutralizar la diferencia de uso.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE ofrecer, en toda vista que muestre el conjunto estándar de T-05 (equipo, jugador, quinteto,
  ON/OFF y, cuando T-03 esté activo, splits de contexto), un selector con cuatro opciones: **Totales**, **Por
  partido**, **Por 40 minutos**, **Por 100 posesiones**. · (US-1) (Esp. v2 §T-04)
- RF-2: El sistema DEBE clasificar cada clave del conjunto estándar (T-05) en uno de tres modos de escalado y
  aplicarlos así:
  - **`fixed`** (tasas, porcentajes, ratios, `games`, `pace`, `sec_per_poss`): el valor **no cambia** con la base.
  - **`count`** (conteos: `pts`, `fgm2`, `ast`, `tov`, `orb`, `stl`, `pf`, etc.): en **Totales**, la suma cruda de la
    selección; en **Por partido**, dividido por `games`; en **Por 40 minutos**, multiplicado por
    `2400 / segundos_de_la_entidad`; en **Por 100 posesiones**, multiplicado por `100 / posesiones_del_denominador`
    (propias o del rival, según la clave).
  - **`volume`** (`minutes`, `possessions`): en **Totales** y **Por partido**, igual que un `count`; en **Por 40
    minutos** y **Por 100 posesiones**, se muestran siempre en **total** (son la muestra de respaldo, no tiene
    sentido escalarlas por sí mismas).
  · (US-1, US-3) (Arquitectura §3.5 columna `base_mode`, §3.8 "Base T-04")
- RF-3: "Segundos de la entidad" para **Por 40 minutos** DEBE ser: equipo → minutos de partido de la selección
  (`40 + 5 × prórrogas` por partido, sumados); jugador → minutos jugados (Σ `minutes` de `player_game_stats`
  convertidos a segundos); quinteto/ON-OFF/split → segundos en cancha (tramos de `lineups.build_segments`). ·
  (US-1, US-4) (Arquitectura §3.8)
- RF-4: "Posesiones del denominador" para **Por 100 posesiones** DEBE ser, según la clave (columna `per100_den` del
  catálogo de T-05): posesiones **propias** de la entidad para la mayoría de las claves de producción/tiro/balón/
  rebote propio; posesiones **del rival** para las claves que miden lo concedido (`pts_against`, `der`,
  `opp_*`, `blk_received`, `fouls_drawn`). Para jugador, "posesiones propias" = posesiones del equipo con el jugador
  en cancha (arquitectura §2.1; exactas por pbp si está disponible, si no estimadas por fracción de minutos y
  marcadas `"estimated": true`). · (US-1, US-4) (Esp. v2 §T-04; Arquitectura §2.1, §3.5)
- RF-5: El sistema DEBE aplicar la base **en el backend**, nunca en el frontend, y devolver el resultado ya escalado
  en la respuesta del conjunto estándar, con un campo `base` que repite (hace eco de) la base aplicada. · (US-3)
  (Arquitectura §3.8 "Se calcula en backend… nunca en el frontend"; regla 4 de la Constitución)
- RF-6: Los cuatro valores de una misma clave `count`, para la misma entidad y la misma selección, DEBEN ser
  matemáticamente consistentes entre sí: `total = por_partido × games` (con redondeo tolerado, ver CA-2) y
  `por_40 = total × 2400/segundos`, `por_100 = total × 100/posesiones_denominador`. Una clave `fixed` DEBE valer
  exactamente lo mismo en las cuatro bases. · (US-3) (Esp. v2 §T-04 "Las cuatro bases devuelven valores
  consistentes")
- RF-7: La selección de base DEBE mantenerse al cambiar de pestaña dentro de la misma sección y al cambiar de sección,
  durante la sesión del navegador (no persiste entre sesiones distintas del mismo usuario salvo el default de
  configuración). · (US-2) (Esp. v2 §T-04 "se mantiene al navegar entre pestañas… en la misma sesión"; Arquitectura
  §3.3 "por sesión (`sessionStorage` + URL)")
- RF-8: El sistema DEBE aceptar la base también como parámetro en la URL (`base=total|partido|por40|por100`), de
  forma que abrir una dirección con `base` explícito la aplica sin depender de `sessionStorage`; sin `base` en la URL
  ni en la sesión, se usa la clave de configuración `ui.default_base` (default `partido`). · (US-2) (Arquitectura
  §3.8 tabla de parámetros, fila `base`; §3.3)
- RF-9: Con posesiones o segundos de la entidad en 0 (denominador de **Por 40** o **Por 100**), toda clave `count`
  escalada por esa base DEBE devolver `null` con razón `sin_datos` — nunca dividir por cero ni mostrar 0 o
  infinito. · (US-3) (Esp. v2 §C-11; Arquitectura §2.1 "Nulos")
- RF-10: Con filtro de jugador en cancha sin play-by-play disponible (posesiones estimadas por minutos), toda
  métrica de jugador en base **Por 100 posesiones** DEBE indicar `"estimated": true` en el objeto de la métrica, sin
  dejar de mostrarse. · (US-4) (Arquitectura §2.1, §3.5 fila `possessions`)
- RF-11: El selector DEBE aplicar de manera uniforme a equipo, jugador, quinteto, ON/OFF y splits de contexto (T-03)
  en cuanto cada uno adopte el conjunto estándar de T-05; donde el conjunto estándar todavía no esté adoptado (fase
  1, endpoints legado), el selector no se muestra. · (US-1) (Esp. v2 §T-04 "Aplica… a equipo… jugador… lineups… y a
  los splits de T-03")
- RF-12: Todo copy del selector DEBE usar `t()` en español rioplatense. · (Arquitectura §3.20, DA-21)

## 5. Requisitos de datos / API
Sin cambios de esquema (Arquitectura §5: T-04 no figura en la lista de tablas/columnas nuevas — cálculo on-the-fly,
regla 4 de la Constitución).

| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `app_config` clave `ui.default_base` | config | enum `total`\|`partido`\|`por40`\|`por100`, default `partido`, sección "Preferencias" | No (ya en el catálogo de arquitectura §3.2, dueño F-13; T-04 es su consumidor) |
| Parámetro `base` en endpoints con conjunto estándar (`GET /api/metrics/<entity_type>`, `GET /api/team/<team_code>`, `GET /api/player/<team_code>/<player_name>`, `GET /api/player/<int:player_id>`, `GET /api/table/<table_id>`) | query | `base ∈ {total, partido, por40, por100}` | No (columna "Base" ya prevista en arquitectura §6 para esos endpoints; T-04 es quien la implementa) |
| Campo `base` en la respuesta del conjunto estándar (§7.3 de la arquitectura) | campo de respuesta | eco de la base aplicada | No (previsto en el shape; T-04 lo llena) |
| `user_prefs` / `sessionStorage` clave de sesión para `base` | frontend | no persiste en servidor entre sesiones (RF-7 dice "durante la sesión del navegador", no "por usuario entre sesiones"); ver §9 ambigüedad | No es una tabla nueva (usa `sessionStorage` del navegador, arquitectura §3.3) |

## 6. Estados de UI
Copy nuevo (a agregar a `docs/frontend.md`) marcado con *(nuevo)*.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selector de base | Deshabilitado con la última base conocida marcada | — (siempre hay 4 opciones) | — | Deshabilitado con aviso "Sin conexión: no se puede cambiar la base" *(nuevo)* | 4 botones/pills "Totales · Por partido · Por 40' · Por 100 pos." *(nuevo)*, el activo resaltado |
| Métrica con denominador 0 en la base elegida | — | — | — | — | "—" con `title` "Sin datos suficientes para esta base" *(nuevo)* (razón `sin_datos`) |
| Métrica estimada (posesiones de jugador sin pbp) | — | — | — | — | valor + indicador discreto "estimado" *(nuevo)* junto al número, con `title` explicando que se estimó por minutos |
| Cambio de base | Bloques en esqueleto breve mientras se repide con la nueva base *(nuevo)* | — | "No se pudo cambiar la base" *(nuevo)*, vuelve a la anterior | — | Todos los bloques de la vista muestran los valores de la nueva base |

Etiquetas *(nuevo)*: "Base", "Totales", "Por partido", "Por 40 minutos" (abreviada "Por 40'"), "Por 100 posesiones"
(abreviada "Por 100 pos."), "estimado" (tooltip: "Posesiones estimadas por minutos: no hay jugada a jugada para este
partido.").

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "Las cuatro bases devuelven valores consistentes entre sí para un mismo jugador y
  partido." — Given un jugador con un único partido jugado en la selección activa, When se piden sus métricas en las
  cuatro bases (`base=total`, `partido`, `por40`, `por100`), Then para una clave `count` como `pts`: `total == valor
  del partido`, `por_partido == total` (un solo partido), `por_40 == total × 2400/segundos_jugados` (redondeo a la
  precisión del `fmt` de la clave) y `por_100 == total × 100/posesiones_del_jugador_en_ese_partido`; para una clave
  `fixed` como `efg_pct`, el valor es idéntico en las cuatro respuestas.
- CA-2 (RF-6): Given un equipo con 4 partidos jugados en la selección, When se piden `base=total` y `base=partido`
  para `pts`, Then `total == por_partido × 4` exacto (sin redondeo intermedio: `por_partido` se calcula dividiendo el
  `total` ya sumado, no promediando valores por partido ya redondeados).
- CA-3 (RF-2, RF-9): Given un jugador con 0 minutos jugados en la selección (posesiones = 0), When se pide
  `base=por100`, Then toda clave `count` es `null` con razón `sin_datos` (ninguna división por cero ni `Infinity`).
- CA-4 (RF-2): Given cualquier entidad y cualquier base, When se compara `efg_pct` entre `base=total` y
  `base=por100`, Then el valor es idéntico (clave `fixed`, nunca se escala).
- CA-5 (RF-3): Given un equipo con un partido con prórroga en la selección, When se pide `base=por40`, Then el
  divisor de segundos usa los minutos reales del partido (40 + 5 por cada prórroga), no 40 fijo.
- CA-6 (RF-4, RF-10): Given un jugador de un partido sin play-by-play, When se pide `base=por100`, Then la métrica
  trae `"estimated": true` y el valor usa `POS_equipo × min_jugador / min_partido` como denominador.
- CA-7 (RF-1, RF-11): Given la pestaña Resumen de un equipo (T-05 ya adoptado) y la pestaña Quintetos (F-06, aún no
  implementada en esta fase), When se abre cada una, Then Resumen muestra el selector de base y Quintetos no lo
  muestra (o lo muestra deshabilitado con nota "Disponible cuando F-06 esté implementado" si F-06 decide adelantar el
  contrato — ver §9).
- CA-8 (RF-7): Given un usuario que eligió "Por 100 posesiones" en S3 › Resumen de un equipo, When navega a S3 ›
  Tiro del mismo equipo, Then el selector sigue en "Por 100 posesiones" y los bloques de Tiro (que ya usan T-05)
  muestran esa base.
- CA-9 (RF-8): Given la dirección `#/equipo/<code>/resumen?base=por40`, When se abre directamente (sesión nueva, sin
  elección previa), Then el selector arranca en "Por 40 minutos" y los bloques la reflejan.
- CA-10 (RF-8): Given ninguna base en la URL ni en la sesión, y `ui.default_base = "partido"` (default de fábrica),
  When se abre cualquier vista con el selector, Then arranca en "Por partido".
- CA-11 (RF-5): Given cualquier respuesta del conjunto estándar con `base` distinto de `total`, When se inspecciona
  el JSON crudo (curl), Then los valores `count` ya vienen escalados por el servidor (el frontend no recalcula nada,
  verificable porque el mismo `curl` sin frontend de por medio ya trae los números finales).

## 8. Fuera de alcance
- Base de normalización aplicada a tablas completas (T-06) fuera del conjunto estándar de T-05: T-06 reutiliza el
  mismo `base` como parámetro (arquitectura §6, columna "Base" de `GET /api/table/<table_id>`), pero su verificación
  de UI (selector de columnas, exportación con la base aplicada) es de T-06.
- Splits de contexto con dimensiones de posesión (tramo de reloj, origen, tipo, oportunidad): INCREMENTO DIFERIDO
  (→ A-01…A-05) — T-04 aplica la base a cualquier split ya calculable por T-03 en fase 2; los splits de posesión se
  habilitan con [A-01](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md) y siguientes.
- Aplicar la base a Quintetos/ON-OFF ampliados (F-06) y a Estadísticas por cuarto (F-04): esos requisitos, al
  adoptar el conjunto estándar de T-05, heredan el selector de T-04 sin cambios de contrato — INCREMENTO DIFERIDO
  (→ F-06, F-04), tarea final de este plan.
- Preferencia de base persistida por usuario entre sesiones distintas (login → login): la especificación pide
  explícitamente "en la misma sesión"; una preferencia de largo plazo por usuario no está pedida (ver §9).
- Selector de base dentro de F-03 (Preparar partido) y F-07 (Analizar partido): esos requisitos son de fase 4 y
  deciden en su propio plan si exponen el selector o fijan una base fija para el informe.

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **Persistencia "en la misma sesión"** se implementa con `sessionStorage` (se
  pierde al cerrar la pestaña/navegador) más el parámetro `base` en la URL (arquitectura §3.3 lo fija así
  explícitamente: "se mantiene por sesión (`sessionStorage` + URL)"). No se guarda en `user_prefs` (eso sería "por
  usuario", que el cliente no pidió) — la clave de configuración `ui.default_base` (F-13) cubre la preferencia de
  largo plazo a nivel de toda la instalación, no por persona.
- [DECISIÓN PROPUESTA — confirmar] **Redondeo en CA-2**: `por_partido` se calcula dividiendo el total ya sumado
  entre `games` (no promediando valores por partido individualmente redondeados), para que la igualdad
  `total == por_partido × games` valga exactamente salvo el redondeo de presentación de la última cifra (`fmt` de
  la clave, ej. `dec1`). Se documenta el orden de operaciones exacto en el plan.
- [DECISIÓN PROPUESTA — confirmar] **CA-7 / disponibilidad por vista**: en fase 2, T-04 solo puede verificarse de
  punta a punta en las vistas cuyo conjunto estándar ya esté adoptado (T-05 fase 1: equipo, jugador; F-06/F-04 en
  fase 2 los adoptan en su propio orden). El selector se muestra únicamente cuando la vista consume
  `GET /api/metrics/<entity_type>` o un endpoint migrado a T-05; en endpoints legado (Quintetos/ON-OFF/Cierres antes
  de que F-06/C-06/F-04 migren) no se ofrece.
- [DECISIÓN PROPUESTA — confirmar] **Indicador "estimado"** se agrega junto al valor (no solo en el JSON) porque
  RF-10 exige visibilidad, no solo el campo de datos; se marca con un ícono discreto y `title`, sin bloquear la
  lectura del número.
