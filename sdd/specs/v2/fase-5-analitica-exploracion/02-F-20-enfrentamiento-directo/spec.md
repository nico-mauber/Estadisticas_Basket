# Spec — F-20: Enfrentamiento directo dentro de Equipo

> **ID:** F-20 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 02
> **Depende de:** X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md)) · F-03 ([../../fase-4-dia-de-partido/02-F-03-preparar-partido/](../../fase-4-dia-de-partido/02-F-03-preparar-partido/spec.md))
> **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4.2 · F-20 y §1.3 S3 · pestaña Enfrentamiento ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.10, §3.12, §4 (`prepare.py`), §6, §9 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §F-20):**
- "Pestaña de enfrentamiento en la sección Equipo: seleccionar un rival y ver el historial directo sin pasar por el modo
  Preparar."
- "Contenido: resultados de los partidos entre ambos, promedios del equipo contra ese rival frente a sus promedios
  generales, y diferencias más marcadas."
- "Enlace al informe completo de F-03 y a los emparejamientos."
- Criterio: "Desde el perfil de un equipo se accede al historial contra cualquier rival en dos clics."

Y §1.3 S3 (pestañas de Equipo): "Enfrentamiento — Historial directo contra un rival elegido, con enlace a F-03." Y §S6
(Comparar): "Head to head — Historial entre dos equipos, enlazado con el modo Preparar de S5" (F-03 crea ese H2H; F-20 lo
reutiliza, no lo recalcula).

**Por qué:** F-03 (Preparar) ya calcula el historial head-to-head completo entre dos equipos como parte del informe previo
a un partido, pero exige elegir un rival concreto y pensar en "preparar un partido". F-20 expone ese mismo dato como una
pestaña de consulta dentro del perfil de Equipo, para cuando el entrenador solo quiere revisar el historial sin estar
armando un informe de partido — es el mismo dato, presentado con otra intención de uso (spec §F-03 "Reutilizar el H2H de
F-03").

**Qué existe HOY verificado en código:**
- No hay ninguna pestaña de "Enfrentamiento" en `main` ni en `dev`. `frontend/js/app.js` no tiene ninguna función
  `render*Enfrentamiento*` ni similar.
- No hay ningún filtro por rival en el catálogo de partidos ni en el perfil de equipo: `backend/app.py:team_detail`
  (`GET /api/team/<team_code>`, l. ~415 según Arquitectura §1.1) devuelve `game_log` completo sin filtrar por oponente; el
  frontend no ofrece seleccionar un rival.
- No existe `backend/prepare.py` en `main` (lo crea F-03, en esta misma corrida de redacción); por lo tanto
  `prepare.head_to_head(team_a, team_b, comp_id)` (la función que F-20 reutiliza) tampoco existe todavía en el árbol —
  existe como contrato ya fijado en `../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md` §4 (RF-12 de esa spec:
  "El H2H DEBE ser reutilizable desde S6 · Comparar y desde F-20").
- No hay pestañas internas en la vista Equipo en `main` (Arquitectura §1.4: "No hay routing por hash"; la reorganización en
  pestañas es tarea de X-01).

**Qué resuelven requisitos anteriores (supuestos de esta spec):** X-01 crea la sección S3 · Equipo con sus pestañas
(`resumen`, `tiro`, `posesion`, `eventos`, `quintetos`, `momentos`, `plantel`, `enfrentamiento`, `gamelog`) y el router de
pestañas (`components/tabs.js`); F-20 solo habilita la pestaña `enfrentamiento` que X-01 ya registró (deshabilitada hasta
ahora). F-03 crea `prepare.py` con `head_to_head(team_a, team_b, comp_id)` (historial completo entre dos equipos, récord
W-L) y el módulo `matchups.py` de F-07 (emparejamientos) al que F-20 enlaza sin recalcular. T-01 (fase 1) ya provee
`population.ficha`, que F-20 reutiliza para mostrar "promedios contra ese rival frente a promedios generales" con el mismo
formato de ficha que el resto de la app.

**Qué queda (esta spec):** el selector de rival dentro de la pestaña Equipo, el cálculo de "promedios contra ese rival
frente a promedios generales" (una comparación nueva que ni F-03 ni T-01 calculan tal cual: T-01 compara contra la
competencia, no contra un subconjunto de partidos filtrado por rival) y el enlace de dos clics hacia F-03 y hacia los
emparejamientos de F-07/F-03.

## 1. Objetivo

Dentro del perfil de un equipo, mostrar en dos clics el historial completo contra un rival elegido: resultados de cada
enfrentamiento, comparación de los promedios del equipo contra ese rival frente a sus promedios generales de la
competencia, las diferencias más marcadas, y enlaces directos al informe de F-03 y a los emparejamientos.

## 2. Fuentes (trazabilidad)

- Especificación v2 §4.2 F-20 (requisito completo, literal arriba), §1.3 S3 (pestaña Enfrentamiento), §4 F-03
  ("Reutilizar el H2H de F-03"), §S6 (Head to head enlazado con Preparar), §6 glosario (fórmulas de las métricas
  comparadas).
- `docs/database.md` §`games`, §`team_game_stats` (no hay columnas nuevas propias de esta spec).
- `docs/api.md`: no existe ningún endpoint de enfrentamiento dentro de Equipo (F-20 lo crea, NUEVO, reutilizando
  `prepare.head_to_head`).
- Arquitectura §3.10 (emparejamientos, `matchups.team_matchups`, enlace desde F-20), §3.12 (rutas de S3, pestaña
  `enfrentamiento` ya registrada por X-01), §4 (`prepare.py`, dueño F-03; F-20 lo consume sin extenderlo), §6 (`GET
  /api/h2h`, ya creado por F-03; F-20 lo reutiliza tal cual, sin endpoint propio salvo el de comparación de promedios),
  §9 (grafo: F-20 depende de X-01 y F-03; sin requisitos que dependan de F-20).
- Specs previas: `../../fase-4-dia-de-partido/02-F-03-preparar-partido/spec.md`/`plan.md` (`head_to_head`, shape de `GET
  /api/h2h`), `../../fase-4-dia-de-partido/01-F-07-analizar-partido/spec.md` (`matchups.py`, tres niveles de
  emparejamiento).

## 3. Historias de usuario

- US-1: Como entrenador, quiero elegir un rival desde el perfil de mi equipo y ver el historial directo, para revisar
  enfrentamientos pasados sin tener que armar un informe de partido.
- US-2: Como entrenador, quiero ver cómo cambian mis promedios cuando juego contra ese rival en particular respecto a mis
  promedios generales, para detectar si ese rival me afecta en algo puntual (por ejemplo, mi TO% sube o mi eFG% baja).
- US-3: Como entrenador, quiero un enlace directo al informe completo de Preparar y a los emparejamientos contra ese
  rival, para profundizar sin tener que buscar la vista de nuevo.

## 4. Requisitos funcionales

**Acceso**
- RF-1: El sistema DEBE mostrar la pestaña "Enfrentamiento" dentro de S3 · Equipo (`#/equipo/<team_code>/enfrentamiento`),
  con un selector de rival (lista de equipos con los que el equipo consultado tiene al menos un partido registrado en la
  competencia activa, o en todas las competencias si el usuario lo pide — ver RF-2). · (US-1) (Esp. v2 §F-20 "Pestaña de
  enfrentamiento en la sección Equipo"; §1.3 S3)
- RF-2: El sistema DEBE poder abrirse en **dos clics** desde el perfil de equipo: clic 1 en la pestaña "Enfrentamiento",
  clic 2 en el rival elegido del selector — sin pasos intermedios ni pantallas de confirmación. · (US-1) (Esp. v2 §F-20
  CA "en dos clics")
- RF-3: El sistema DEBE aceptar llegar con el rival ya preseleccionado por query string (`?rival=<code>`), de forma que un
  enlace desde otra vista (ej. F-03) abra directamente el historial sin requerir el segundo clic. · (US-1) (Esp. v2 §F-03
  "Reutilizar el H2H de F-03"; consistencia con la navegación de dos clics)

**Historial**
- RF-4: El sistema DEBE mostrar el historial completo entre el equipo y el rival elegido reutilizando **exactamente**
  `prepare.head_to_head(team_code, rival_code, comp_id)` de F-03 (mismo shape, sin recalcular la lógica de acumulación):
  lista de partidos (fecha, marcador, ganador) y récord acumulado W-L. · (US-1) (Esp. v2 §F-20 "resultados de los
  partidos entre ambos"; Arquitectura §4 `prepare.py`, F-03 RF-12 "reutilizable desde F-20")
- RF-5: `comp_id` en RF-4 DEBE ser `null` (todas las competencias) por defecto, igual que en F-03, salvo que el usuario
  filtre por competencia explícitamente desde la barra de contexto (si T-03 ya está integrado en esta fase) o desde un
  selector local de competencia. · (US-1) (Esp. v2 §F-03 RF-2 "el H2H no cambia salvo que el usuario lo filtre
  explícitamente", mismo criterio heredado)

**Comparación de promedios**
- RF-6: El sistema DEBE mostrar, para el conjunto estándar de T-05 (o su subconjunto más relevante: four factors, OER,
  DER, Net Rating, eFG%, TS%, PPT, TO%, OR%, DR%), los **promedios del equipo contra ese rival** (pooled sobre los
  partidos de RF-4, DA-02) frente a los **promedios generales del equipo** en la misma competencia y período (pooled
  sobre todos los partidos de la competencia, excluidos o no los del rival según se documente — ver §9), con la
  diferencia con signo entre ambos. · (US-2) (Esp. v2 §F-20 "promedios del equipo contra ese rival frente a sus
  promedios generales")
- RF-7: El sistema DEBE destacar las **diferencias más marcadas** (mayor magnitud de delta, orientado como en T-01: mejor
  o peor que el promedio general) en un bloque resumen de 3 a 5 ítems, con el mismo formato que F-17 (métrica, delta,
  valores, lectura) cuando F-17 ya esté disponible; si no, con un formato equivalente propio de esta spec (tabla ordenada
  por magnitud de delta). · (US-2) (Esp. v2 §F-20 "diferencias más marcadas")
- RF-8: Toda métrica no calculable (rival sin partidos suficientes, división por cero) DEBE mostrarse como nulo con razón
  (C-11), nunca reemplazada por 0 ni omitida de la comparación. · (Esp. v2 §C-11)

**Enlaces**
- RF-9: El sistema DEBE ofrecer un enlace directo al informe completo de F-03 (`#/partido/preparar?team=<code>&rival=<
  rival_code>`), preservando el equipo y el rival ya elegidos. · (US-3) (Esp. v2 §F-20 "Enlace al informe completo de
  F-03")
- RF-10: El sistema DEBE ofrecer un enlace a los emparejamientos entre ambos equipos (mismo bloque de "coincidencia en
  cancha" que expone F-03, sin duplicar su tabla completa aquí: F-20 enlaza, no reimplementa la matriz de tres niveles).
  · (US-3) (Esp. v2 §F-20 "y a los emparejamientos")

## 5. Requisitos de datos / API

| Tabla / endpoint | Uso | Estado |
|---|---|---|
| `games`, `team_game_stats` | historial, promedios contra el rival y generales | existen |
| `GET /api/h2h` (F-03) | historial completo entre dos equipos | existente (F-03), reutilizado tal cual |
| `GET /api/rival-comparison` | promedios contra el rival vs. promedios generales + diferencias más marcadas | **NUEVO** — PROPUESTA (no está en 00-arquitectura-transversal.md): la arquitectura no cataloga un endpoint de comparación "equipo contra un rival específico vs. equipo en general"; se agrega porque ni T-01 (compara contra la competencia) ni F-03 (arma el informe de dos equipos, no una comparación de promedios propios con/sin filtro de rival) cubren esta necesidad puntual |

Sin tablas ni columnas nuevas (Arquitectura §5 no lista cambios de esquema para F-20). Errores: `404 no_encontrado`
(equipo o rival inexistente), `400 parametro_invalido` (`rival == team`).

## 6. Estados de UI

Vista: S3 Equipo · pestaña Enfrentamiento (`#/equipo/<team_code>/enfrentamiento?rival=<code>`). Copy nuevo (marcar para
`docs/frontend.md`), siempre vía `t()`.

| Bloque | loading | vacío / sin datos | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selector de rival (sin `rival` en la URL) | — | "Este equipo todavía no enfrentó a ningún rival con partidos importados." (si no hay ningún rival disponible) | — | — | lista de rivales con cantidad de enfrentamientos junto a cada uno |
| Historial | skeleton | "Sin historial entre estos equipos." | "No se pudo cargar el historial." | "Sin conexión: el historial necesita conexión." | lista de partidos + récord acumulado |
| Comparación de promedios | skeleton | "Muestra insuficiente contra este rival para comparar promedios." (menos de `sample.team.min` partidos contra ese rival) | — | — | tabla de métricas con Δ vs promedio general |
| Diferencias más marcadas | skeleton | "Sin diferencias destacables." | — | — | 3 a 5 ítems ordenados por magnitud |
| Enlaces | — | — | — | — | botones "Ver informe completo (Preparar)" y "Ver emparejamientos" |

Mobile (<768 px): bloques apilados en una sola columna (contenido compacto, sin necesidad de pestañas internas
adicionales dentro de esta pestaña).

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: Given el perfil de un equipo, When hago clic en la pestaña Enfrentamiento y luego elijo un
  rival, Then veo el historial completo contra ese rival — en exactamente dos clics desde el perfil de equipo.
- CA-2: Given dos equipos con partidos jugados entre sí, When abro Enfrentamiento con ese rival, Then la lista de
  partidos y el récord acumulado coinciden exactamente con los que devuelve `GET /api/h2h?a=<team>&b=<rival>` (F-03),
  sin diferencias.
- CA-3: Given la comparación de promedios, When se genera, Then cada métrica muestra el promedio contra el rival, el
  promedio general del equipo en la competencia y la diferencia con signo, verificable contra `GET
  /api/team/<team_code>?competition=<id>` (promedio general) y contra el cálculo manual pooled sobre los partidos de RF-4
  (promedio contra el rival).
- CA-4: Given el bloque de diferencias más marcadas, When se genera, Then muestra entre 3 y 5 ítems ordenados por
  magnitud de delta, de mayor a menor.
- CA-5: Given la vista con un rival elegido, When hago clic en "Ver informe completo", Then se abre
  `#/partido/preparar?team=<code>&rival=<rival_code>` con ambos equipos ya seleccionados.
- CA-6: Given la vista con un rival elegido, When hago clic en "Ver emparejamientos", Then se abre el bloque de
  coincidencia en cancha de F-03 (o el equivalente de F-07 si el enlace apunta a un partido puntual) con `team`/`rival`
  ya preseleccionados.
- CA-7: Given un rival sin partidos jugados contra el equipo consultado, When se lo elige (llegando por URL con
  `?rival=<code>` de un equipo que en realidad nunca jugó contra el actual), Then se muestra "Sin historial entre estos
  equipos" sin romper la vista.
- CA-8: Given `GET /api/rival-comparison` con `rival == team`, When se lo llama, Then responde 400
  `{"error": "El rival no puede ser el mismo equipo", "code": "parametro_invalido"}`.

## 8. Fuera de alcance

- Recalcular el historial head-to-head: se reutiliza `prepare.head_to_head` de F-03 sin modificarlo ni duplicarlo.
- La matriz completa de emparejamientos en tres niveles: F-20 enlaza a ella (F-03/F-07), no la reimplementa dentro de la
  pestaña Enfrentamiento.
- Comparación de promedios contra **múltiples** rivales a la vez (solo uno por vez, según el selector).
- Barra de contexto T-03 completa: esta pestaña usa competencia (si aplica) y el filtro de rival propio; no expone las
  demás dimensiones de T-03 (cuarto, marcador, on/off).
- Exportación de esta pestaña a PDF/PNG/CSV: no pedido explícitamente por el cliente para F-20 (a diferencia de F-03); si
  se desea en el futuro, es una extensión menor reutilizando T-06, fuera de esta spec.

## 9. Ambigüedades

- [DECISIÓN PROPUESTA — confirmar] "Promedios generales" (RF-6) se calcula **incluyendo** los partidos contra ese mismo
  rival (el promedio de temporada completo, sin excluir nada), porque es el mismo criterio que ya usa la app para
  "promedio de liga"/"promedio de competencia" en el resto de las pantallas (C-02, T-01: siempre sobre el universo
  completo de la selección). Excluir los partidos contra el rival del promedio general haría que la comparación no fuera
  contra el punto de referencia habitual del resto de la app, y complicaría la trazabilidad con `GET
  /api/team/<team_code>` (CA-3 exige que el promedio general coincida con ese endpoint). Confirmar si el cliente prefiere
  la exclusión (comparación más "pura" estadísticamente, pero menos consistente con el resto de la UI).
- [DECISIÓN PROPUESTA — confirmar] Formato de "diferencias más marcadas" (RF-7): se reutiliza el formato de ítem de F-17
  (Plan de juego) si F-17 ya está integrado al implementar F-20 (ambos son de fases distintas: F-17 es fase 2, F-20 es
  fase 5, así que F-17 estará disponible); si por algún motivo no lo está, F-20 usa una tabla propia simple con las mismas
  columnas (métrica, delta, valores, percentil si T-01 está disponible) sin depender de `phrases.py`.
- [DECISIÓN PROPUESTA — confirmar] `GET /api/rival-comparison` (NUEVO, PROPUESTA) en vez de extender `GET /api/h2h` de
  F-03: se mantiene como endpoint separado porque el H2H de F-03 no incluye promedios ni comparación (solo resultados +
  récord), y agregarle ese cálculo violaría "un solo dueño por pieza" (§0.3 de la arquitectura: F-03 es dueño de `GET
  /api/h2h`, F-20 no puede cambiar su contrato). Reportado en `huecos_arquitectura`.
- [NEEDS CLARIFICATION] El cliente no especifica el mínimo de partidos contra un rival para mostrar la comparación de
  promedios con confianza (a diferencia de T-02, que sí define umbrales para quintetos/parejas/etc., pero no para "equipo
  contra un rival específico"): se asume el mismo umbral que T-01 usa para la población de equipos (`sample.team.min` = 3
  partidos) aplicado al **subconjunto** de partidos contra ese rival, mostrando la comparación igual pero con badge de
  muestra baja por debajo de ese mínimo. Confirmar si el cliente prefiere un umbral específico para este caso (rivales
  con solo 1-2 enfrentamientos son comunes en ligas de pocos equipos).
