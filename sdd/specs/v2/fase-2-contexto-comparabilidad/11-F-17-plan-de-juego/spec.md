# Spec — F-17: Plan de juego

> **ID:** F-17 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 11
> **Depende de:** T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)) · T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md), componente plegable y pestaña Resumen) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/spec.md](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md), claves `gameplan.*` y preferencias por usuario) — el grafo de la arquitectura §9 agrega X-01 y F-13 a la propuesta inicial (T-01, T-05); además consume T-02 y T-03 por transitividad de T-01
> **Habilita:** F-03 (bloque Ventajas/Amenazas del informe, vía `phrases.game_plan(mode="matchup")`), A-10 (reutiliza el motor de plantillas), F-12 (panel en Mi equipo y referencia "rival del próximo partido"), F-21 (traduce las plantillas), F-20 (formato de ítem para "diferencias más marcadas")
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4.2 · F-17 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.1 (capa transversal "Plan de juego") · §1.3 S3 Equipo/Resumen y S8 · Arquitectura §3.15, §3.6, §3.2, §3.3, §6, §8, §9.2 (I-04, I-06) ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente y por qué.** F-17 es un "panel de lectura rápida que traduce los percentiles en dos columnas: en qué se es
mejor y en qué se es vulnerable. Es la versión permanente y en pantalla de lo que F-03 entrega como informe". Cada ítem trae
métrica, diferencia contra la referencia con signo y color, valores propio vs referencia, percentil, una frase accionable de una
línea y un icono ↑/↓. La referencia es seleccionable (promedio de la competencia, promedio del rival del próximo partido o el propio
equipo en un período anterior); hay entre tres y cinco ítems por columna ordenados por magnitud del delta; las frases "salen de
plantillas fijas por métrica, con las mismas reglas de A-10. No se generan libremente"; el panel vive en Equipo, en Mi equipo (S8)
y como bloque del informe de F-03, es plegable y recuerda su estado por usuario. Criterio de aceptación del cliente: "cada ítem
del panel es verificable contra la tabla de métricas de la misma pantalla".

**Qué existe hoy (verificado en código, rama `v2`).**
- No existe ningún panel, plantilla ni frase automática: `grep` de `phrases`, `game_plan`, `plan de juego` en `backend/` y
  `frontend/` no encuentra nada. No existe `backend/phrases.py` ni el directorio de plantillas.
- La pestaña Resumen del equipo (`frontend/js/app.js`, `_renderTeamContent`, l.1144–1260) muestra cards de Eficiencia, Four Factors
  (`_fourFactorsCard`, l.134, equipo contra el rival promedio, no contra la competencia), Tiro, Rebotes & Misc, Defensa avanzada,
  Desglose ofensivo y Game log. Cada `statBox` (l.38) muestra el valor y el promedio de liga `Ø`; el "↑ mejor de la liga" se
  retiró en C-02 (Feature 14). No hay ranking, percentil ni distancias: eso lo trae T-01.
- No hay forma de comparar un equipo contra otro dentro de Equipo (eso es F-20 / F-03) ni contra su propio período anterior; el
  filtro "Últ. 5 / Últ. 3" recalcula en el cliente (`_filteredLog`, `_computeAvg`) sin población de referencia.
- `localStorage`/`user_prefs`: no hay preferencias por usuario hoy (las crea F-13); el componente plegable lo crea X-01
  (`components/collapsible.js`, primer consumidor `equipo.desglose`).
- Calendario: no existe (lo crea F-12, arquitectura §3.19). Por eso "rival del próximo partido" no puede resolverse todavía.

**Qué resuelven requisitos anteriores (supuestos de esta spec).** T-05 define el conjunto estándar (claves, dirección
`higher|lower|neutral`, formato) y `compute_standard`; T-01 crea la población con umbrales (`population.population`),
el promedio de la competencia (`league_reference`) y la ficha (percentil, ranking, distancias orientadas, DA-09); T-02 clasifica
la muestra (`baja|media|alta`) y excluye de las sugerencias automáticas a la muestra baja; T-03 amplía el contexto
(`last`, `venue`, `opponent`, …); X-01 entrega las pestañas de S3 y `collapsible`; F-13 entrega `config.get()`, las claves
`gameplan.items_min`, `gameplan.items_max`, `gameplan.min_z` (reservadas → F-17) y las preferencias por usuario
(`panel.collapsed`).

**Qué queda para F-17.** (1) El motor de frases de plantillas fijas (`backend/phrases.py` + plantillas por idioma) que
A-10 reutilizará; (2) la selección de ventajas y riesgos con su regla de disparo por puntaje estandarizado; (3) el endpoint y el
panel de Equipo; (4) la función `game_plan(..., mode="matchup")` que F-03 consume. Mi equipo (F-12) y el informe de F-03 son
presencias posteriores (incrementos diferidos, §8).

## 1. Objetivo
Que el entrenador vea, de un vistazo y dentro de la pantalla del equipo, en qué métricas está por encima o por debajo de la
referencia elegida, con el dato, la distancia, su posición en la competencia y una lectura accionable de una línea que nunca
contradiga los números.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4.2 F-17 (texto completo, formato de ítem y criterio de aceptación); §1.1 (fila "Plan de juego"); §1.3 S3
  (pestaña Resumen "… y panel Plan de juego") y S8 (módulo "Plan de juego"); §3 T-01 (ficha, "menos es mejor", población de
  referencia); §3 T-02 (muestra baja fuera de sugerencias automáticas); §4 F-03 (ventajas y amenazas); §5 A-10 (plantillas fijas
  rellenadas con valores, sin IA); §6 glosario de métricas.
- `docs/frontend.md` §Vistas (Equipo) y §Service worker; `docs/metrics.md` (fórmulas de eFG%, TS%, OER, DER, TO%, OR%, DR%,
  FT Rate); `docs/api.md` (`GET /api/team/<team_code>`, `GET /api/competitions`).
- `00-arquitectura-transversal.md` §3.15 (motor de frases: marcadores, disparo por z, referencias), §3.6 (población, ficha,
  distancias orientadas), §3.7 (muestra), §3.8 (contexto), §3.2 (claves `gameplan.*`), §3.3 (`panel.collapsed`), §3.19 (calendario,
  diferido), §6 (`GET /api/game-plan`), §7.4 (nulos con razón), §8 (`game-plan.js`, `collapsible.js`), §9.2 I-04 e I-06.
- Specs previos: `sdd/specs/09-filtro-competencia/spec.md` (competencia y últimos N en Equipo); `sdd/specs/14-promedios-de-liga/`
  (promedio de liga por competencia, base de T-01).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver en la pantalla de mi equipo dos columnas — "Ventajas" y "Vulnerabilidades" — con las métricas
  donde estoy mejor y peor que la referencia, para leer el perfil del equipo en segundos sin recorrer todas las tablas.
- US-2: Como entrenador, quiero que cada ítem muestre la diferencia con signo y color, los dos valores comparados, mi percentil y
  una frase accionable, para entender cuánto y qué hacer con ello.
- US-3: Como entrenador, quiero elegir contra qué me comparo —el promedio de la competencia, un rival concreto o mi propio equipo en
  un período anterior—, para usar el mismo panel antes de un partido o para ver si estoy mejorando.
- US-4: Como analista, quiero que cada ítem sea verificable contra los números de la misma pantalla y que las frases salgan de
  plantillas fijas, para confiar en el panel y poder auditarlo.
- US-5: Como entrenador, quiero plegar el panel y que la app recuerde mi elección, para dejarlo cerrado cuando no lo uso.
- US-6: Como desarrollador del producto (F-03, A-10, F-12), quiero un único motor de frases con plantillas por idioma y reglas
  de disparo, para no duplicar lógica en el informe previo, los insights y Mi equipo.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE mostrar, en la pestaña Resumen de la sección Equipo, un panel "Plan de juego" con dos columnas:
  "Ventajas" (métricas donde el equipo está mejor que la referencia) y "Vulnerabilidades" (donde está peor). · (US-1)
  (Esp. v2 §F-17 "dos columnas: en qué se es mejor y en qué se es vulnerable"; §1.3 S3 Resumen)
- RF-2: Cada ítem DEBE contener seis elementos: **métrica** (nombre corto), **diferencia** (delta contra la referencia, con signo
  y color), **valores** (propio frente a referencia), **percentil** (posición en la competencia, de T-01), **lectura** (frase
  accionable de una línea) y **dirección** (icono ↑ de ventaja o ↓ de riesgo). · (US-2) (Esp. v2 §F-17 "Formato de cada ítem")
- RF-3: El delta DEBE estar **orientado**: positivo = mejor que la referencia en toda métrica, incluidas las de "menos es mejor"
  (DER, TO%, pérdidas, faltas cometidas), y el color DEBE seguir ese signo (verde = mejor, rojo = peor). La diferencia aritmética
  (propio − referencia) DEBE estar disponible en un tooltip. · (US-2) (Esp. v2 §T-01 "se invierte todo… la distancia al líder nunca
  debe quedar con el signo cambiado"; Arquitectura §3.6, DA-09)
- RF-4: Los valores propio y de referencia DEBEN mostrarse con el formato de la métrica en es-UY (coma decimal), por ejemplo
  "53,2 vs 52,4" para eFG%. · (US-2) (Esp. v2 §F-17 ejemplo; Arquitectura §3.20 y DA-36)
- RF-5: El percentil de cada ítem DEBE ser el percentil T-01 del equipo en la competencia (misma población, mismo contexto) y
  mostrarse con la escala de color continua rojo → gris → verde. · (US-2) (Esp. v2 §F-17 "Percentil: posición en la competencia
  (T-01)"; §T-01 "escala de color continua")
- RF-6: La lectura DEBE salir de **plantillas fijas por métrica** (ventaja / riesgo), sin generación libre ni IA, con marcadores
  rellenados con valores formateados del catálogo; una plantilla de "ventaja" solo se usa si el delta orientado es positivo y una
  de "riesgo" solo si es negativo. · (US-4) (Esp. v2 §F-17 "plantillas fijas por métrica, con las mismas reglas de A-10";
  Arquitectura §3.15)
- RF-7: La referencia DEBE ser seleccionable entre: **promedio de la competencia** (por defecto), **un rival elegido** (equipo de
  la misma competencia) y **el propio equipo en un período anterior** (los partidos anteriores a los últimos N del contexto).
  · (US-3) (Esp. v2 §F-17 "Referencia seleccionable"; Arquitectura §3.15)
- RF-8: La referencia "promedio del rival del próximo partido" DEBE quedar reservada hasta que exista el calendario: el selector
  NO DEBE ofrecerla como opción operable y el servicio DEBE rechazarla con un error explícito. · (US-3)
  (Esp. v2 §F-17; Arquitectura §3.19, §9.2 I-06) — INCREMENTO DIFERIDO (→ F-12)
- RF-9: El panel DEBE mostrar entre `gameplan.items_min` y `gameplan.items_max` ítems por columna (3 y 5 por defecto), ordenados
  de mayor a menor magnitud, medida como el delta orientado dividido por el desvío estándar de esa métrica en la población de
  referencia (puntaje `z`). Solo entran ítems cuyo `|z|` alcance `gameplan.min_z` (0,5 por defecto), salvo para completar el
  mínimo con los siguientes de igual signo, marcados como diferencia menor. · (US-1) (Esp. v2 §F-17 "Entre tres y cinco ítems por
  columna, ordenados por magnitud del delta"; Arquitectura §3.15, §3.2)
- RF-10: Un mismo ítem DEBE responder a una sola métrica y no DEBEN repetirse en una misma columna métricas de la misma familia
  conceptual (por ejemplo eFG%, TS% y PPT cuentan como "tiro": entra la de mayor magnitud). · (US-1) (Arquitectura §3.15;
  PROPUESTA de familias, ver §9)
- RF-11: Solo DEBEN considerarse métricas con plantilla definida, de dirección no neutral y cuyo valor propio y de referencia no
  sean nulos; una métrica nula NO DEBE aparecer ni reemplazarse por 0. · (US-4) (Esp. v2 §C-11, §T-05; Arquitectura §3.15, §7.4)
- RF-12: Si el equipo tiene muestra baja (T-02), el panel NO DEBE emitir ventajas ni vulnerabilidades: DEBE explicar que la muestra
  es insuficiente y mostrar el badge de muestra. · (US-4) (Esp. v2 §T-02 "queda fuera de rankings, tarjetas de líderes y
  sugerencias automáticas"; Arquitectura §3.15 "entidades con muestra media/alta")
- RF-13: El panel DEBE recalcularse con el contexto activo (competencia y, desde T-03, período, sede, rival, etc.), indicar sobre
  qué selección se calculó (etiqueta de contexto y partidos usados) y, si el contexto impide comparar con la competencia
  (filtro `on`/`off`, sin universo), mostrar el motivo en lugar de ítems. · (US-3) (Esp. v2 §T-03, §T-01 "todo se recalcula sobre la
  selección activa"; Arquitectura §3.8)
- RF-14: Cada ítem DEBE ser verificable contra la tabla de métricas de la misma pantalla: el valor propio, el promedio de la
  competencia, el percentil y la dirección DEBEN coincidir exactamente con la ficha de esa métrica (T-01) y con
  `GET /api/metrics/team` (T-05). · (US-4) (Esp. v2 §F-17 CA)
- RF-15: El panel DEBE ser plegable y recordar el estado por usuario (preferencia `panel.collapsed` de F-13, con respaldo local si
  falla el almacenamiento). · (US-5) (Esp. v2 §F-17 "Panel plegable, con el estado recordado por usuario"; Arquitectura §3.3)
- RF-16: El sistema DEBE exponer un servicio de frases reutilizable (plantillas por idioma con identificador, métrica, disparo,
  texto y marcadores permitidos `{entidad}`, `{metrica}`, `{valor}`, `{referencia}`, `{delta}`, `{p}`, `{media}`, `{rival}`) y la
  selección de ventajas/riesgos con modo `perfil` (panel de Equipo y Mi equipo) y modo `matchup` (informe de F-03: referencia
  forzada al rival, muestra baja advertida en lugar de excluida). · (US-6) (Arquitectura §3.15; F-03)
- RF-17: Las plantillas DEBEN validarse al cargar: sin números escritos a mano, solo marcadores permitidos, métrica existente en el
  catálogo y una plantilla de ventaja y de riesgo por cada métrica del conjunto del plan de juego. · (US-4, US-6) (Esp. v2 §F-17
  "no se generan libremente"; §A-10 "plantillas de texto fijas")
- RF-18: Los umbrales del plan (`gameplan.items_min`, `gameplan.items_max`, `gameplan.min_z`) DEBEN leerse de la configuración
  (F-13) y no estar fijos en el código; el cambio debe reflejarse sin reiniciar. · (US-1) (Esp. v2 §T-02 "ninguno debe quedar fijo en
  el código"; Arquitectura §3.2)
- RF-19: Todo copy nuevo DEBE estar en español rioplatense y los números en formato es-UY; las frases de plantilla viven en un
  archivo por idioma para que F-21 las traduzca sin tocar código. · (US-6) (Arquitectura §3.15, §3.20; DA-21 resuelta: sin `t()`
  en fases tempranas, copy en español directo; DA-36)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| Esquema SQLite | — | sin cambios (cálculo on-the-fly sobre la población de T-01; nada se persiste) | — |
| `GET /api/game-plan` | endpoint | query `team` (obligatorio), `reference` ∈ {`competencia` (default), `rival`, `periodo_anterior`}, `rival` (team_code, obligatorio si `reference=rival`), + contexto T-03 (`competition`, `last`, …) → `{team, reference, advantages[], risks[], sample, reason, rule, context}`; ítem `{metric, label, direction, delta, delta_raw, own, ref, percentile, text, …}`; 400 `parametro_invalido` / `contexto_invalido` / `competencia_inexistente` / `referencia_no_disponible`; 404 `no_encontrado` | **NUEVO** (dueño F-17, arquitectura §6) → `docs/api.md` |
| `backend/phrases.py` y plantillas `backend/phrases/es.json` + reglas `backend/phrases/rules.json` | módulo y archivos de datos | `load_templates`, `render`, `game_plan`; plantillas `{id, metric, when, text}`; reglas de familias y métricas del plan | **NUEVO** (módulo: arquitectura §3.15; `rules.json`: PROPUESTA, ver plan §10) → `docs/architecture.md` |
| `app_config`: claves `gameplan.items_min` / `gameplan.items_max` / `gameplan.min_z` | configuración | int 3 / int 5 / float 0,5; reservadas por F-13, F-17 las activa y las lee | existentes (F-13) |
| `user_prefs`: `scope=panel.collapsed`, `key=<panel_id>` | preferencia | bool; F-17 usa `equipo.game_plan` | existente (F-13) |
| `GET /api/metrics/team`, `population.population/ficha/league_reference`, `sample` | consumidos | fichas y población de T-01/T-05/T-02 | T-01/T-02/T-05 |
| `GET /api/context/options` | consumido (selector de rival) | lista de equipos de la competencia | T-03 |

## 6. Estados de UI
Componente: **panel "Plan de juego"** (colapsable) con selector de referencia. Vista: S3 Equipo › Resumen. Copy nuevo →
`docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Panel Plan de juego | "Calculando plan de juego…" (esqueleto con dos columnas) | Sin diferencias: "No hay diferencias destacadas contra esta referencia." · Columna sin ítems: "Sin ventajas destacadas" / "Sin vulnerabilidades destacadas" | "No se pudo calcular el plan de juego" + botón "Reintentar" (el resto de la pestaña sigue) | "Sin conexión: se muestra el último plan cargado" (si hay respuesta previa) o "Sin conexión" | Dos columnas con 3–5 ítems; encabezado "Referencia: Ø competencia · Últimos 5 · 5 partidos" |
| Motivo sin ítems | — | `muestra_baja`: "Muestra insuficiente: el equipo tiene {n} partidos (mínimo {m}). No se arma plan de juego con tan pocos datos." · `contexto_no_comparable`: "Este filtro no permite comparar con la competencia." · `sin_universo`: "Elegí una competencia para comparar." · `poblacion_insuficiente`: "La competencia no tiene suficientes equipos para comparar." · `rival_sin_datos`: "El rival elegido no tiene partidos en esta selección." · `periodo_anterior_insuficiente`: "No hay partidos anteriores suficientes para comparar." · `sin_datos`: "El equipo no tiene partidos en esta selección." | — | — | — |
| Selector de referencia | deshabilitado mientras carga | — | "No se pudieron cargar los equipos" (rival) | opción rival usa la lista ya cargada | "Ø competencia" · "Rival: <equipo>" · "Mi equipo: período anterior" · "Rival del próximo partido" visible y deshabilitada con la nota "Disponible cuando se cargue el calendario" |
| Panel plegado | encabezado y flecha | — | — | — | Solo título y flecha (estado recordado por usuario) |
| Ítem | — | — | — | — | `↑ eFG% +0,8 · 53,2% vs 52,4% · p71 · "Ventaja en tiro: buscá volumen en medio campo"` |

## 7. Criterios de aceptación
- CA-1 (CA del cliente): **"cada ítem del panel es verificable contra la tabla de métricas de la misma pantalla."** Given la
  pestaña Resumen de un equipo con panel visible y referencia "Ø competencia", When se toma cada ítem de ambas columnas, Then su
  valor propio, el promedio de la competencia, el percentil y el signo del delta coinciden con la ficha de esa misma métrica en
  la pantalla y con `GET /api/metrics/team?id=<code>` (valores idénticos al decimal mostrado), y `delta` = dist. al promedio de la
  ficha.
- CA-2: Given un equipo con muestra media o alta y datos completos, When se abre el panel, Then cada columna tiene entre 3 y 5
  ítems, ordenados por `|z|` decreciente, con las seis partes de RF-2 y sin dos métricas de la misma familia en una columna.
- CA-3: Given una métrica de "menos es mejor" (TO%) en la que el equipo tiene un valor menor que el promedio, When aparece en el
  panel, Then está en "Ventajas" con delta positivo en verde y el tooltip muestra la diferencia aritmética negativa; y la frase
  nunca habla de "ventaja" para una métrica con delta orientado negativo.
- CA-4: Given referencia "Rival" con el equipo B elegido, When se carga el panel, Then los valores de referencia son los de B en la
  misma población y contexto (iguales a su ficha) y el encabezado dice "Referencia: Rival <B>"; con el propio equipo como rival o
  un código inexistente el servicio responde 400/404 con mensaje en español.
- CA-5: Given `last=5` activo y referencia "Período anterior", When se carga el panel, Then el valor propio es el de los últimos 5
  partidos, la referencia es el valor pooled de los partidos anteriores a esos 5 y el encabezado lo explica; sin `last` el servicio
  responde 400 "Elegí un período (Últimos N) para comparar con el período anterior".
- CA-6: Given un equipo con 2 partidos (muestra baja, `sample.team.min` = 3), When se abre el panel, Then no hay ítems y se muestra
  "Muestra insuficiente…" con el badge BAJA; al bajar `sample.team.min` a 2 en Configuración y recargar, aparecen los ítems.
- CA-7: Given el panel visible, When se pliega y se recarga la página (y también con otro dispositivo del mismo usuario), Then
  queda plegado; al desplegar queda desplegado.
- CA-8: Given cualquier ítem, When se compara su `text` con `backend/phrases/es.json`, Then es exactamente la plantilla de esa
  métrica y ese disparo con los marcadores rellenados, no contiene dígitos escritos a mano y ninguna plantilla de "ventaja" aparece
  con delta orientado ≤ 0 (verificación sobre todas las métricas con plantilla y los 13 partidos del seed).
- CA-9: Given un equipo con una métrica nula (p. ej. `ast_to` nulo por 0 pérdidas), When se arma el panel, Then esa métrica no
  aparece, no hay ítems con "0" ni "NaN" y el resto del panel funciona.
- CA-10: Given un filtro de contexto `on=<player_id>` (entity_only) o `competition=all`, When se pide el plan, Then responde 200 con
  columnas vacías y `reason` `contexto_no_comparable` / `sin_universo`, y la UI muestra el motivo.
- CA-11: Given `gameplan.items_max` cambiado a 3 y `gameplan.min_z` a 1,0 vía configuración, When se recarga el panel, Then cada
  columna muestra como máximo 3 ítems y ninguno con `|z|` < 1,0 salvo los de relleno marcados como "diferencia menor".
- CA-12: Given un viewport de 375 px, When se abre Resumen, Then las dos columnas se apilan (Ventajas arriba), no hay scroll
  horizontal y las líneas de lectura se leen completas (se parten en varias líneas en lugar de truncarse).
- CA-13: Given `GET /api/game-plan` con `reference=rival_proximo`, When se llama, Then responde 400 `referencia_no_disponible` con
  "Todavía no hay calendario cargado para resolver el rival del próximo partido"; con `reference=xyz` responde 400
  `parametro_invalido`; con `team=ZZZ` responde 404 `no_encontrado` "Equipo no encontrado".
- CA-14: Given la llamada interna `phrases.game_plan(..., reference="rival", rival=<code>, mode="matchup")` (la que usará F-03),
  When un equipo tiene muestra baja, Then devuelve igualmente ítems con `sample_warning: true`; en modo `perfil` devuelve
  columnas vacías con `reason: muestra_baja`.

## 8. Fuera de alcance
- El informe previo de F-03 (5 ventajas y 5 amenazas dentro del informe exportable): F-03 usa `phrases.game_plan(mode="matchup")`
  y el renderer de ítem de `components/game-plan.js`; F-17 solo los entrega. INCREMENTO DIFERIDO (→ F-03,
  [../../fase-4-dia-de-partido/02-F-03-preparar-partido/spec.md](../../fase-4-dia-de-partido/02-F-03-preparar-partido/spec.md)):
  presencia del plan en el informe.
- Presencia en Mi equipo (S8) con el equipo fijado: INCREMENTO DIFERIDO (→ F-12,
  [../../fase-5-analitica-exploracion/12-F-12-mi-equipo/spec.md](../../fase-5-analitica-exploracion/12-F-12-mi-equipo/spec.md)); el
  componente ya queda reutilizable (`renderGamePlan` con `panelId` propio).
- Referencia "promedio del rival del próximo partido": INCREMENTO DIFERIDO (→ F-12): requiere la tabla `fixtures` y
  `fixtures.next_fixture` (arquitectura §3.19). F-17 ofrece "rival elegido" mientras tanto.
- Plan de juego por jugador, por quinteto o por tramo: el cliente lo define solo para equipo.
- Insights por percentil extremo (≤10 / ≥90): A-10 (usa el mismo motor).
- Traducción a inglés y portugués: F-21 (F-17 deja las plantillas en un archivo por idioma).
- Métricas de conteo (PTS, robos, tapones, faltas) y de volumen: dependen de la base T-04 y no tienen una referencia comparable
  entre bases; F-17 trabaja con las tasas y eficiencias del conjunto estándar (`base_mode = fixed`).
- Métricas de posesión (A-01…A-05: PPP por origen, transición, reloj): se agregan a las plantillas cuando existan, sin cambios de
  motor.
- Exportar el panel como imagen/PDF: lo cubre T-06 para tablas; F-03 exporta su propio informe.

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **"Ordenados por magnitud del delta".** Los deltas de métricas distintas están en unidades
  distintas (+0,8 puntos porcentuales de eFG% no es comparable con +0,06 de OER). Se ordena por el puntaje `z = delta orientado /
  desvío de la métrica en la población de referencia` (arquitectura §3.15), que sí es comparable. Con empate de `z` se ordena por
  el orden del catálogo T-05.
- [DECISIÓN PROPUESTA — confirmar] **Qué es el desvío de la población.** Desvío estándar poblacional de los valores no nulos de los
  miembros `in_population` de T-01 para esa métrica, bajo el mismo contexto. Con menos de 2 valores o desvío 0 la métrica no puede
  puntuarse y se omite. Para la referencia "período anterior" se usa el mismo desvío (el de la población del contexto activo).
- [DECISIÓN PROPUESTA — confirmar] **Cuántos ítems si pocos superan `min_z`.** Entre 3 y 5 por columna es el requisito del cliente:
  se toman primero los que cumplen `|z| ≥ gameplan.min_z` (hasta `items_max`) y, si hay menos que `items_min`, se completa con los
  siguientes del mismo signo (marcados "diferencia menor", en tono atenuado). Si ni así se llega al mínimo (el equipo es mejor o peor
  que la referencia en casi todo), la columna muestra menos ítems y el texto "Sin ventajas destacadas" / "Sin vulnerabilidades
  destacadas" solo si queda vacía.
- [DECISIÓN PROPUESTA — confirmar] **Muestra baja.** En modo `perfil` (panel) no se emiten ítems (T-02: la muestra baja queda fuera
  de sugerencias automáticas). En modo `matchup` (informe F-03) se emiten con `sample_warning: true` porque el informe ya advierte la
  muestra; esto concilia la arquitectura §3.15 con el plan de F-03 (RF-6 de esa spec).
- [DECISIÓN PROPUESTA — confirmar] **Nombre de columnas.** El cliente describe "en qué se es mejor y en qué se es vulnerable" e
  icono "ventaja / riesgo". En pantalla: "Ventajas" y "Vulnerabilidades"; en la API: `advantages` y `risks` con `direction`
  `ventaja` / `riesgo`.
- [DECISIÓN PROPUESTA — confirmar] **Qué métricas entran.** Solo las de `base_mode = fixed` y dirección no neutral con plantilla: OER,
  DER, Net Rating, eFG%, TS%, PPT, FG2%, FG3%, FT%, FT Rate, TO%, OR%, DR%, AS/PER y AS%. Los conteos y volúmenes no tienen
  referencia comparable entre bases (T-04); TRB%, FG%, PPP y PPT por tipo se omiten por redundancia con las anteriores (en equipo
  PPP = OER). El conjunto es una lista de datos editable (`rules.json`), no código.
- [DECISIÓN PROPUESTA — confirmar] **Familias.** Para no repetir "tiro" tres veces: eFG%, TS% y PPT forman una familia; el resto son
  familias de una métrica (la lista exacta está en el plan).
- [DECISIÓN PROPUESTA — confirmar] **Periodo anterior.** "El propio equipo en un período anterior" = los partidos del equipo
  (con los demás filtros del contexto) anteriores a los últimos N (`last=N`); requiere que haya al menos `sample.team.min` partidos
  en ese período anterior. La referencia se calcula como valor pooled (coherente con DA-02), no como promedio de tasas.
- [DECISIÓN PROPUESTA — confirmar] **Delta en puntos porcentuales.** Para métricas en porcentaje el delta se muestra en puntos
  porcentuales con una decimal ("+0,8"), como el ejemplo del cliente; el tooltip aclara "pp".
- [DECISIÓN PROPUESTA — confirmar] **Selección de referencia en la sesión.** La referencia elegida y el rival se recuerdan solo
  durante la sesión (no son una preferencia persistente: F-13 fija las claves permitidas del ámbito `ui`). El plegado sí persiste
  (RF-15).
