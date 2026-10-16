# Spec — F-14: Líderes y perfil de competencia

> **ID:** F-14 · **Prioridad:** P2 · **Fase y orden:** 5·01
> **Depende de:** T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)) · A-02 ([../../fase-3-contexto-posesion/02-A-02-origen-posesion/spec.md](../../fase-3-contexto-posesion/02-A-02-origen-posesion/spec.md)) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/spec.md](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md)) · T-04 ([../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md)) · (usa T-05, T-02, T-06, X-01 ya cerrados)
> **Habilita:** — (los promedios de referencia que muestra son los mismos que consumen F-17, A-10 y F-12)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-14 y §1.3 S2 (Líderes, Perfil de la competencia) ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.6, §4 (`competition_profile.py`), §6 (`/api/leaders`, `/api/competition-profile`, tabla `leaders`), §3.2 (`leaders.*`) ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, F-14).** "En la sección Liga: top de jugadores por cada métrica, con mínimo de minutos
configurable. Perfil de la competencia: promedios de referencia, ritmo, reparto de tiro y PPP por origen de posesión. Estos
promedios son la base de cálculo de los percentiles de T-01, por lo que deben ser consultables." Criterio de aceptación:
"Los valores del perfil de competencia coinciden con los usados para calcular los percentiles." En S2 (Liga): "Líderes: Top de
jugadores por cada métrica, con mínimo de minutos. Perfil de la competencia: Promedios de referencia, ritmo, reparto de tiro,
PPP por origen de posesión (F-14, A-02)."

**Qué existe hoy (verificado en código, rama `v2`).** La vista Liga (`frontend/js/app.js:renderLeague`) muestra la tabla
general (C-09), el ranking de equipos y el mapa de liga; no existe ninguna lista de líderes de jugadores ni un perfil de la
competencia. `GET /api/league` devuelve una fila por equipo. El promedio de liga que ven hoy las vistas de Equipo y Jugador
sale de `stats_engine.league_averages` (promedio de las filas partido-equipo, definición que T-01 reemplaza por la media de
las entidades de la población, DA-08). El buscador de jugadores (`GET /api/search/players`, `_applySearch`) permite ordenar por
una columna pero no arma un "top por métrica" ni respeta una población común. `backend/population.py`, `backend/sample.py`,
`backend/tables.py`, `backend/competition_profile.py`, el conjunto estándar de T-05 y los orígenes de posesión (A-02) **no
existen todavía** en el código: son los requisitos de fase 1–3 de los que F-14 depende. Las claves de configuración
`leaders.min_minutes` y `leaders.top_n` están declaradas por F-13 como "reservada (→ F-14)".

**Qué resolvieron (o resolverán) los requisitos previos.** T-01 define la población de referencia (jugadores con ≥
`sample.player.min` minutos; equipos con ≥ `sample.team.min` partidos), `population.population`, `league_reference` (media de
las entidades de la población), `full_ranking` y la ficha; T-02 excluye las muestras bajas de rankings y líderes; T-05 aporta
las claves estándar y `apply_base`; T-04 la base de normalización; A-02 el PPP por origen de posesión; T-06 el componente de
tabla y la exportación; X-01 las pestañas de S2 (`tabla`, `ranking`, `mapa` y las registradas con `enabled: false`: `lideres`,
`perfil`). **Qué queda (alcance de F-14):** las dos pestañas de Liga, sus dos endpoints y el módulo `competition_profile.py`
que arma líderes y perfil **sobre las funciones de T-01, sin recálculo paralelo**.

## 1. Objetivo
Que el entrenador vea en la sección Liga quiénes lideran cada métrica entre los jugadores de la competencia (con un mínimo de
minutos que él controla) y cuál es el perfil de la competencia (promedios de referencia, ritmo, reparto de tiro y PPP por
origen de posesión), con exactamente los mismos números que el sistema usa para calcular los percentiles y las fichas de
métrica, de modo que cualquier valor del perfil se pueda verificar contra el ranking de T-01.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 · F-14 (texto completo, arriba); §1.3 S2; §3 · T-01 ("Población de referencia", "Reglas de cálculo"), T-02 (muestras bajas fuera de líderes), T-04 (base), T-06 (tabla y exportación); §5 · A-02 (origen de la posesión); §6 glosario (PPP, PACE, USO%).
- `00-arquitectura-transversal.md` §3.6 (`population.py`, población de referencia, `league_reference`, `full_ranking`, DA-08), §3.7 (exclusión de muestra baja), §3.2 (claves `leaders.min_minutes`, `leaders.top_n`, `sample.player.min`, `sample.team.min`, `population.min_size`), §3.12 (S2 Liga: `lideres`, `perfil`), §4 (`competition_profile.py`: `leaders`, `profile`), §6 (`GET /api/leaders`, `GET /api/competition-profile`, tabla `leaders`), §7.1b, §7.3, §7.5, §7.6, §8.
- `sdd/specs/v2/00-decisiones.md` (DA-21 sin `t()`; F-11 acotado), `docs/api.md` (`/api/league`, `/api/search/players`), `docs/frontend.md` (vista Liga).
- Specs previas: `sdd/specs/v2/fase-1-confiabilidad/15-T-01-…`, `14-T-02-…`, `13-T-05-…`, `12-F-13-…`, `16-T-06-…`, `06-C-09-…`; `fase-2-contexto-comparabilidad/01-X-01-…`, `03-T-04-…`; `fase-3-contexto-posesion/02-A-02-…`; `sdd/specs/09-filtro-competencia/` (filtro por competencia ya implementado).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver los diez mejores jugadores de la competencia en cada métrica clave, para saber contra quién me mido y a quién fichar o marcar.
- US-2: Como analista, quiero elegir cualquier métrica del conjunto estándar y fijar el mínimo de minutos, para evitar que un jugador con pocos minutos encabece una lista por casualidad.
- US-3: Como analista, quiero ver el perfil de la competencia (promedios de referencia, ritmo, reparto de tiro y PPP por origen), para entender contra qué se calculan los percentiles de cada equipo y jugador.
- US-4: Como analista, quiero que los números del perfil y de los líderes sean exactamente los mismos que usan las fichas y los percentiles, para confiar en que no hay dos cálculos distintos.
- US-5: Como cuerpo técnico, quiero exportar las listas y el perfil, para llevarlos a un informe.

## 4. Requisitos funcionales

**Líderes**
- RF-1: El sistema DEBE ofrecer en Liga una pestaña "Líderes" con una tarjeta por cada métrica de una lista de métricas clave de jugador (ver §9 D-2), cada una con el top de jugadores (`leaders.top_n`, default 10) ordenados por esa métrica. · (US-1; Esp. v2 §F-14 "top de jugadores por cada métrica"; Arq. §3.2, §4)
- RF-2: El sistema DEBE permitir elegir **cualquier** métrica del conjunto estándar de T-05 que aplique a jugadores y mostrar, para esa métrica, el top y la tabla completa de los jugadores que califican (tabla `leaders` de T-06: ordenable, con columnas configurables y exportable). · (US-2, US-5; Esp. v2 §F-14, §T-06; Arq. §6 ids de tablas)
- RF-3: El sistema DEBE aplicar un **mínimo de minutos** configurable: valor por defecto `leaders.min_minutes` (60), ajustable por consulta en la pantalla (campo numérico), y NUNCA menor que el mínimo de la población de T-01 (`sample.player.min`); cuando el mínimo pedido es menor, DEBE aplicar el de la población e informarlo ("Mínimo aplicado: 60 min (el mínimo de muestra de la competencia)"). · (US-2; Esp. v2 §F-14 "mínimo de minutos configurable", §T-01 "Población de referencia", §T-02; Arq. §3.2)
- RF-4: El sistema DEBE mostrar por fila: puesto (competición estándar con marca de empate, "7.º =" cuando hay empate), jugador (enlace a S4), equipo, valor formateado con el `fmt` del catálogo, minutos jugados, partidos y badge de muestra (T-02). · (US-1; Esp. v2 §T-01 "En caso de empate, mismo puesto para ambos y salto en el siguiente")
- RF-5: El sistema DEBE respetar la dirección de cada métrica: en las de "menos es mejor" (DER, TO%, pérdidas, faltas cometidas) el líder es el valor más bajo; en las neutrales (p. ej. USO%, uso de triple) se ordena de mayor a menor rotulada "Mayor valor". · (US-1; Esp. v2 §T-01 "Reglas de cálculo"; Arq. §3.6)
- RF-6: El sistema DEBE excluir de los líderes a los jugadores con muestra baja (fuera de la población de T-01) y a los que no tengan valor en la métrica (nulo), informando la cantidad de jugadores que califican y los excluidos por nulo con su razón. · (US-2; Esp. v2 §T-02 "exclusión de rankings", §C-11; Arq. §3.7)
- RF-7: El sistema DEBE calcular los líderes **con las funciones de T-01** (misma población, mismo contexto, misma base, mismo promedio y mismo percentil que la ficha), sin ninguna reimplementación del ranking ni de la población dentro de F-14: el primer puesto de la lista con el mínimo por defecto coincide con el líder de la ficha de la métrica y el promedio mostrado coincide con el `avg` de la ficha. · (US-4; Esp. v2 §F-14 CA; Arq. §3.6)

**Perfil de la competencia**
- RF-8: El sistema DEBE ofrecer en Liga una pestaña "Perfil" con cuatro bloques para la competencia seleccionada: **promedios de referencia**, **ritmo**, **reparto de tiro** y **PPP por origen de posesión** (A-02), con un selector "Equipos | Jugadores" para los bloques que existen en ambas poblaciones (§9 D-6). · (US-3; Esp. v2 §F-14 "Perfil de la competencia")
- RF-9: El sistema DEBE mostrar, por cada métrica del perfil, el **promedio de referencia** (media de los valores de las entidades de la población de T-01, DA-08), la cantidad de entidades de la población, el mejor valor con su entidad y un enlace al ranking completo de T-01 de esa métrica. · (US-3, US-4; Esp. v2 §F-14 "deben ser consultables"; Arq. §3.6)
- RF-10: El bloque "Promedios de referencia" DEBE incluir, para equipos: OER, DER, Net Rating, eFG%, TS%, PPT, TO%, OR%, DR%, FT Rate y AS/PER; para jugadores: PTS, REB, AS, ROB, TAP, eFG%, TS%, FG3%, FT%, TO%, USO% y AS/PER (en la base activa). El bloque "Ritmo" (equipos): PACE, posesiones y segundos por posesión. El bloque "Reparto de tiro": uso de 2, uso de triple, % de tiros en pintura y % de media distancia (equipos y jugadores). · (US-3; Esp. v2 §F-14; glosario §6)
- RF-11: El bloque "PPP por origen de posesión" (solo equipos) DEBE mostrar, para cada uno de los siete orígenes de A-02 (tras canasta rival, rebote defensivo, robo, pérdida rival, saque de banda, tiempo muerto, tiro libre rival), el PPP de referencia (media de los equipos de la población, DA-08), las posesiones de la competencia y el peso de cada origen (%) sobre el total clasificado, de modo que los pesos sumen 100 %. · (US-3; Esp. v2 §F-14, §A-02)
- RF-12: El sistema DEBE garantizar que **cada valor del perfil coincide con el `avg` que usa T-01** para calcular el percentil de la misma métrica, población, contexto y base: para las métricas del conjunto estándar se lee de `population.league_reference`; para el PPP por origen, de la población `origin` de T-01/A-02 agrupada por origen. Ningún valor del perfil se calcula con una fórmula propia de F-14. · (US-4; Esp. v2 §F-14 CA; Arq. §3.6)

**Transversales**
- RF-13: El sistema DEBE respetar el contexto activo (competencia obligatoria y `last` en fase 1–2; las demás dimensiones de T-03 cuando existan) recalculando la población con el mismo contexto, y la base de normalización (T-04) para las métricas de conteo y volumen; las respuestas DEBEN incluir el eco `context` y `base`. · (US-4; Esp. v2 §T-03, §T-04; Arq. §3.8)
- RF-14: El sistema DEBE pedir una competencia concreta: con `competition=all` o sin competencia resoluble responde que se elija una (no hay universo ni percentiles); con una población menor que `population.min_size` (3) DEBE mostrar "Población insuficiente para calcular referencias" en lugar de promedios. · (US-4; Esp. v2 §T-01; Arq. §3.1, §3.6, §7.4 `sin_universo`/`poblacion_insuficiente`)
- RF-15: El sistema DEBE registrar la tabla `leaders` en T-06 (columnas por defecto: jugador, equipo, partidos, minutos y la métrica elegida; orden por la métrica según su dirección) y dar al Perfil un botón de exportación (CSV, XLSX, PNG, PDF) con la cabecera de metadatos de T-06. · (US-5; Esp. v2 §T-06)
- RF-16: El sistema DEBE activar las claves `leaders.min_minutes` (int, 60, 0–2000) y `leaders.top_n` (int, 10, 3–50) en Configuración (S9, sección Preferencias) y leerlas siempre con `config.get`; un cambio se refleja en la siguiente petición sin reiniciar. · (US-2; Esp. v2 §F-13, §F-14; Arq. §3.2)
- RF-17: El sistema DEBE habilitar en Liga (S2) las pestañas `lideres` y `perfil` con rutas `#/liga/lideres` y `#/liga/perfil` que conservan el contexto, y recordar en la URL la métrica y el mínimo de minutos elegidos (`?metric=pts&min_minutes=120`). · (US-2; Arq. §3.12)

## 5. Requisitos de datos / API

Sin cambios de esquema (Arq. §5: F-14 en la lista "Sin cambios de esquema"). Usa tablas y funciones de otros requisitos.

| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `GET /api/leaders` | endpoint | query: `competition`, `last` (+ contexto T-03), `base`, `metric` (clave del catálogo; omitida ⇒ tarjetas de la lista por defecto), `min_minutes`, `top`; response: lista de líderes + metadatos (§7.1b-like, ver plan §3.1) | **NUEVO** (Arq. §6) |
| `GET /api/competition-profile` | endpoint | query: `competition`, `last` (+ contexto T-03), `base`, `entity` (`team`\|`player`, default `team`); response: bloques con promedios de referencia | **NUEVO** (Arq. §6) |
| Tabla `leaders` de `GET /api/table/<table_id>` | tabla T-06 | query: `metric`, `min_minutes` + contexto + base; payload §7.6 con todos los jugadores que califican | **NUEVA** (id fijado en Arq. §6, dueño F-14) |
| `app_config`: `leaders.min_minutes`, `leaders.top_n` | claves de configuración | int 60 (0–2000) · int 10 (3–50), sección Preferencias | claves de Arq. §3.2, activadas por F-14 |
| `GET /api/rankings/<entity_type>/<metric_key>` (T-01), `GET /api/metrics/<entity_type>` (T-05) | endpoints consumidos | verificación cruzada de valores | — |

## 6. Estados de UI

Copy nuevo (marcado para `docs/frontend.md`), en español directo (DA-21 resuelta: sin `t()` hasta F-21).

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Liga → Líderes | spinner en la grilla de tarjetas | "Ningún jugador alcanza el mínimo de {n} minutos en esta competencia. Probá con un mínimo menor." (nuevo) | mensaje del servidor + "Reintentar" | "Sin conexión. No se pudieron cargar los líderes." (nuevo) | grilla de tarjetas (top N) y, al elegir métrica, top + tabla completa con exportación |
| Liga → Perfil | spinner por bloque | "Población insuficiente para calcular referencias." (nuevo) | mensaje del servidor + "Reintentar" | "Sin conexión. No se pudo cargar el perfil." (nuevo) | cuatro bloques con promedio, N, mejor valor y enlace al ranking |
| Sin competencia concreta | — | "Elegí una competencia para ver líderes y perfil." (nuevo, mismo criterio que la tabla general de C-09) | — | — | — |
| Aviso de mínimo | — | "Mínimo aplicado: {n} min (el mínimo de muestra de la competencia)." (nuevo, cuando el pedido era menor) | — | — | — |
| Fila/valor nulo | — | "—" con razón (`sin_datos`, `no_registrado`, `requiere_posesiones` si A-02 no tiene pbp) | — | — | — |

Mobile (<768 px): las tarjetas pasan a una columna; la tabla completa usa el componente de T-06 (scroll horizontal con la
primera columna fija); el ranking completo de la ficha abre como hoja inferior; el selector de métrica y el campo de minutos
quedan en una barra apilada.

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: "Los valores del perfil de competencia coinciden con los usados para calcular los percentiles." — Given una competencia con población suficiente, When se compara cada promedio del bloque "Promedios de referencia", "Ritmo" y "Reparto de tiro" de `GET /api/competition-profile` con el `avg` de `GET /api/rankings/<entity_type>/<métrica>` y con el `avg` de la ficha de cualquier entidad (`GET /api/metrics/<entity_type>`), y cada PPP por origen con el `avg` de la ficha de A-02, Then coinciden exactamente (mismo contexto y misma base).
- CA-2: Given una métrica de jugador y el mínimo por defecto, When se piden los líderes, Then el primer puesto coincide con `leader` de la ficha T-01 de cualquier jugador para esa métrica (mismo nombre y valor) y `avg` coincide con el de la ficha.
- CA-3: Given `leaders.min_minutes` = 120, When se piden los líderes, Then solo aparecen jugadores con al menos 120 minutos; con un mínimo pedido de 10 (menor que `sample.player.min` = 60) se aplica 60 y la respuesta lo informa (`min_minutes_effective`, `min_minutes_raised: true`).
- CA-4: Given una métrica de "menos es mejor" (p. ej. `tov` o `to_pct`), When se piden sus líderes, Then el primer puesto es el valor más bajo; en una neutral (`uso_pct`) se ordena de mayor a menor y la tarjeta dice "Mayor valor".
- CA-5: Given dos jugadores con el mismo valor en el puesto 3, When se ve la lista, Then ambos muestran "3.º =" y el siguiente es el 5.º (competición estándar).
- CA-6: Given la base "por partido" y luego "total" (y "por 40"/"por 100" cuando T-04 esté), When se piden los líderes de `pts`, Then los valores y el orden corresponden a la base y el eco `base` lo confirma; en una métrica de tasa (`ts_pct`) no cambian.
- CA-7: Given el filtro "Últimos 5", When se piden líderes y perfil, Then se recalculan con la población en ese contexto (cada entidad con sus últimos 5) y `context.label` lo indica.
- CA-8: Given `competition=all` o ninguna competencia resoluble, When se piden líderes o perfil, Then la API responde 400 `parametro_invalido` con "Elegí una competencia para ver líderes y perfil." y la UI muestra ese mensaje.
- CA-9: Given una competencia con menos de `population.min_size` equipos o jugadores en la población, When se pide el perfil, Then los promedios son nulos con razón `poblacion_insuficiente` y la UI muestra "Población insuficiente para calcular referencias.", sin ceros ni promedios inventados.
- CA-10: Given el bloque "PPP por origen", When se suman las posesiones de los siete orígenes, Then el total es igual a las posesiones clasificadas de la competencia (peso 100 %) y cada PPP es igual al `ppp` de A-02 promediado por equipo.
- CA-11: Given una métrica con nulos en jugadores (p. ej. `blk_received` en partidos sin reprocesar), When se piden sus líderes, Then esos jugadores no aparecen en la lista, la respuesta cuenta `excluded_null` con su razón y nunca se tratan como 0.
- CA-12: Given un jugador de muestra baja (menos de `sample.player.min` minutos), When se piden los líderes con cualquier mínimo, Then no aparece.
- CA-13: Given la tabla completa de una métrica, When se exporta a CSV, XLSX, PNG y PDF, Then el archivo reproduce las filas, el orden y las columnas visibles con la cabecera de metadatos de T-06 (competencia, mínimo aplicado, base, fecha).
- CA-14: Given `PUT /api/settings {"values": {"leaders.top_n": 5, "leaders.min_minutes": 90}}`, When se recarga la pestaña Líderes, Then cada tarjeta muestra 5 filas y el mínimo mostrado es 90, sin reiniciar el servidor.
- CA-15: Given un ancho de 360 px, When se recorren las pestañas Líderes y Perfil, Then no hay scroll horizontal de página, las tarjetas se apilan y la consola no tiene errores JS.
- CA-16: Given la URL `#/liga/lideres?competition=<id>&metric=ast&min_minutes=120`, When se abre en una pestaña nueva, Then se reproduce la vista (métrica y mínimo elegidos).

## 8. Fuera de alcance
- Líderes de **equipos**: ya son el ranking de Liga (T-01, `league_teams` de T-06); F-14 no los duplica.
- Líderes de quintetos, parejas o emparejamientos (los cubren F-06, F-09, F-10).
- Filtro de líderes por posición o por equipo (se puede obtener con la tabla `leaders` de T-06 ordenando; un filtro por grupo G/F/C quedaría como mejora futura con los grupos de C-08).
- Mínimo de intentos para métricas de porcentaje (FG3%, FT%, etc.): ver §9 D-4.
- Históricos entre temporadas y comparación de perfiles entre competencias.
- Perfil de **jugadores** del ritmo y del PPP por origen (solo existen para equipos).
- INCREMENTO DIFERIDO: ninguno (todas las dependencias —T-01, T-02, T-04, T-05, T-06, A-02, F-13, X-01— son de fases anteriores a la 5).

## 9. Ambigüedades
- D-1 [DECISIÓN PROPUESTA — confirmar] **Mínimo de minutos efectivo.** `efectivo = max(min_minutes pedido, sample.player.min)`. Motivo: T-01 y T-02 excluyen de rankings y líderes a quien no llega a `sample.player.min` (60), y F-14 debe usar la misma población para cumplir su CA; un mínimo menor mostraría jugadores que T-01 considera muestra baja. Si el cliente quiere ver también a los de muestra baja en la lista, corresponde bajar `sample.player.min` en Configuración (afecta toda la app).
- D-2 [DECISIÓN PROPUESTA — confirmar] **Métricas de las tarjetas por defecto**: PTS, REB, AS, ROB, TAP, eFG%, TS%, FG3%, FT%, OER, USO% y AS/PER (12 tarjetas, en la base activa). El cliente dice "cada métrica": el selector permite todas las del conjunto estándar de jugador; las 12 tarjetas son la lectura rápida. Orden y lista se pueden ajustar sin tocar el cálculo (constante del módulo).
- D-3 [DECISIÓN PROPUESTA — confirmar] **PPP de referencia por origen** = media de los PPP de los equipos de la población para ese origen (DA-08, la misma definición que el `avg` de la ficha), no el cociente de totales de la competencia. La diferencia entre ambos suele ser menor a 0,01; se elige la media de entidades para que el CA ("coincide con el usado para los percentiles") se cumpla exactamente. Los pesos de cada origen (posesiones y %) sí son cociente de totales de la competencia.
- D-4 [DECISIÓN PROPUESTA — confirmar] **Sin mínimo de intentos en porcentajes.** Un jugador con 60 minutos y 2 tiros libres convertidos de 2 encabezaría FT%. La especificación pide solo mínimo de minutos. Se muestran al lado el valor, los minutos y el badge de muestra, y la tabla completa trae los intentos como columnas ocultas del selector. Si el cliente lo pide, se agrega una clave de configuración `leaders.min_attempts` (PROPUESTA, no está en la arquitectura).
- D-5 [DECISIÓN PROPUESTA — confirmar] **Corte del top con empates.** El top muestra `leaders.top_n` filas; si el puesto N está empatado con el N+1, la respuesta marca `cut_tied: true` y la UI agrega "y N más con el mismo valor" (la tabla completa los incluye).
- D-6 [DECISIÓN PROPUESTA — confirmar] **Perfil de equipos y de jugadores.** "Estos promedios son la base de cálculo de los percentiles de T-01": hay percentiles de equipos y de jugadores, por lo que el Perfil ofrece el selector "Equipos | Jugadores". Ritmo y PPP por origen existen solo para equipos.
- D-7 [DECISIÓN PROPUESTA — confirmar] **Competencia por defecto.** F-14 exige una competencia concreta (misma regla que la tabla general de C-09: con "Todas" no hay universo ni percentiles). Cuando exista la competencia por defecto de C-02 (DA-14), la pestaña la usa al abrirse.
- D-8 [DECISIÓN PROPUESTA — confirmar] **Verificación con el seed.** Los 13 partidos del seed no alcanzan para la población de equipos de T-01 (≥ 3 partidos por equipo: el máximo es 2). Para verificar se baja `sample.team.min` a 2 en Configuración (14 equipos) o se importan más partidos (Arq. R-05); la población de jugadores (≥ 60 minutos) sí existe (32 jugadores).
