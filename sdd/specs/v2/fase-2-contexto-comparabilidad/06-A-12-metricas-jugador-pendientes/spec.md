# Spec — A-12: Métricas de jugador pendientes

> **ID:** A-12 · **Prioridad:** P1 · **Fase y orden:** 2·06
> **Depende de:** C-01 ([../../fase-1-confiabilidad/09-C-01-rebotes-distribucion-jugador/spec.md](../../fase-1-confiabilidad/09-C-01-rebotes-distribucion-jugador/spec.md)) · T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)) · F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md), para el reproceso) · T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md), catálogo y `compute_standard`) · X-01 ([../01-X-01-reorganizacion-navegacion/spec.md](../01-X-01-reorganizacion-navegacion/spec.md), pestaña Distribución de S4)
> **Habilita:** — (el tercer indicador se completa con A-01: [../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md); A-07 reutiliza el vínculo asistencia→canasta)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §5.4 · A-12 y §1.3 S4 (pestaña Distribución) ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.6, §2.2, §3.5, §3.6, §5, §9.2 I-03 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, A-12).** "% de asistencias sobre el total del equipo, y ratio de asistencias sobre las
posesiones propias del jugador (dos indicadores distintos, ambos visibles). Puntos por asistencia: cuánto asiste y cuántos
puntos se convierten a partir de ello. Segundos promedio de posesión." Y en la sección Jugador (S4), pestaña **Distribución**:
"Rebotes, AS/pos, % de asistencias del equipo, puntos por asistencia, segundos de posesión (C-01, A-12)". Criterio de
aceptación: "Los tres indicadores aparecen en el perfil de jugador con su percentil correspondiente."

**Qué existe hoy (verificado en código, rama `v2`).**
- `backend/stats_engine.py:calc_player_stats` ya calcula `as_pos = AST / POS_jugador` (C-01, Feature 15), `ast_ratio = AST / PLAYS`,
  `as_pct = AST / FGM propio` (fórmula que el arquitecto declara incorrecta: D-13/DA-06, la corrige T-05) y `ast_to`. **No existe**
  ninguna cuota de asistencias sobre el total del equipo, ni puntos por asistencia, ni duración de posesión.
- `frontend/js/app.js:_renderPlayerContent` (l.~1820) muestra `AS/pos` con `statBox`; no hay pestañas (X-01 las crea) ni percentil
  (T-01).
- La tabla `pbp_events` (`backend/database.py:PbpEvent`) guarda `team_code, player_name, period, period_type, clock_secs, s1, s2,
  action_type, sub_type, success, action_number`. **No guarda `previous_action`** (FIBA `previousAction`): `ingest.py:pbp_cols`
  y `fiba_fetcher.py` (bloque "Full play-by-play") no lo leen. La versión acotada de F-11 difirió esa columna
  (`sdd/specs/v2/00-decisiones.md`: "cada requisito dueño agrega las suyas, sube `INGEST_VERSION` y reprocesa";
  `ingest.INGEST_VERSION = 2` hoy).
- `GET /api/player/<team_code>/<player_name>` devuelve las métricas por partido y `averages`; el conjunto estándar de T-05
  (`GET /api/metrics/player`) y la ficha de T-01 se agregan antes que A-12 (fase 1).

**Datos reales verificados (13 partidos del seed, JSON crudo archivado en `game_sources`).** Los 459 eventos `assist` del pbp
coinciden con las 459 asistencias del box (`Σ player_game_stats.ast = Σ team_game_stats.ast = 459`, partido por partido).
Los 459 traen `previousAction`; el evento vinculado es siempre del mismo equipo y de otro jugador: 237 son `2pt` convertidos,
176 `3pt` convertidos y **46 `freethrow`** convertidos (FIBA liga algunas asistencias a un tiro libre de una serie de
`1of2`/`2of2`/`1of3`/`2of3`; en esos casos no hay canasta de campo convertida en la misma jugada). El vínculo coincide con
"el último tiro convertido del mismo equipo antes del `assist`" en 458 de 459 casos; el caso restante es un and-one con tiro
libre intermedio. Por eso la regla de A-12 usa el vínculo de FIBA persistido, no una inferencia por adyacencia.
El pbp ya se guarda en la base; lo que falta es la columna.

**Qué resolvieron features anteriores.** C-01 (feature 15) dejó `as_pos` por partido y acumulado y la card "Rebotes y
distribución"; T-05 define el catálogo y `ast_pct` estándar (DA-06) dejando `ast_team_share` "aparte (A-12)"; T-01 aporta
ficha, ranking y percentil; X-01 crea la pestaña Distribución de S4. **Qué queda (alcance de A-12):** (1) la cuota de
asistencias del equipo, (2) el vínculo asistencia→canasta y los puntos por asistencia, (3) el slot de segundos de posesión
(con su valor completo en A-01), (4) la card que muestra los indicadores junto con AS/pos, cada uno con su ficha y percentil.

## 1. Objetivo
Que el perfil de jugador (S4 → Distribución) muestre, con valor, ranking y percentil de la competencia, cuánto de la
creación de juego del equipo pasa por el jugador (cuota de asistencias y asistencias por posesión propia, como dos
indicadores distintos), cuántos puntos se convierten a partir de sus asistencias y su duración promedio de posesión
(esta última, hasta que exista el motor de posesiones, como dato nulo explicado), sin cifras inventadas y sin ceros falsos.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5.4 · A-12 (texto completo, arriba) y criterio de aceptación; §1.3 S4 · Distribución; §3 · T-01 (ficha y percentil), T-02 (badge), C-11 (nulos); §6 glosario.
- `00-arquitectura-transversal.md` §1.6 (vínculos `previousAction`, 459/459 en el seed), §2.2 (filas AS/pos y AS%), §3.5 (claves `ast_team_share`, `pts_per_ast`, `player_poss_duration`), §3.6 (ficha), §5 (`pbp_events.previous_action` DEFAULT NULL, dueño F-11 → diferido), §9.2 I-03, §7.4 (códigos de nulo), DA-05, DA-06.
- `sdd/specs/v2/00-decisiones.md` (F-11 acotado: columnas diferidas a cada dueño; DA-21 sin `t()`).
- Código: `backend/stats_engine.py`, `backend/database.py` (`PbpEvent`, `upgrade_db`), `backend/ingest.py` (`persist_game`, `INGEST_VERSION`, `reprocess_games`), `backend/fiba_fetcher.py` (parseo de pbp, `_i`), `backend/data_quality.py` (`NULL_FIELDS`), `frontend/js/app.js` (`_renderPlayerContent`, `statBox`).
- Specs previas: `sdd/specs/15-metricas-jugador/` (as_pos), `sdd/specs/v2/fase-1-confiabilidad/09-C-01-…`, `13-T-05-…`, `15-T-01-…`, `02-F-11-…`, `01-C-11-…`; `sdd/specs/v2/fase-2-contexto-comparabilidad/01-X-01-…`.

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver qué porcentaje de las asistencias del equipo da cada jugador, para saber quién es el creador principal.
- US-2: Como entrenador, quiero distinguir ese porcentaje de las asistencias que da por cada posesión propia, para no confundir un creador "de volumen" con uno "eficiente" cuando el equipo reparte distinto la pelota.
- US-3: Como analista, quiero saber cuántos puntos se convierten a partir de las asistencias de un jugador, para medir el valor de lo que crea y no solo cuántas asistencias suma.
- US-4: Como analista, quiero ver cuántos segundos promedio dura la posesión de un jugador, para saber si juega rápido o pausado.
- US-5: Como entrenador, quiero el percentil de cada indicador dentro de la competencia, para leerlos sin salir de la pantalla.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE calcular la **cuota de asistencias del equipo** (`ast_team_share`) de un jugador como `AST_jugador / AST_equipo`, con `AST_equipo` = asistencias totales del equipo en los partidos que el jugador disputó (DNP excluido), en cociente de totales sobre la selección (DA-02). Si `AST_equipo = 0` el valor es nulo con razón `sin_intentos`. · (US-1; Esp. v2 §A-12 "% de asistencias sobre el total del equipo"; Arq. §2.1, §2.2 fila AS%, §3.5)
- RF-2: El sistema DEBE mostrar la cuota de asistencias del equipo y **AS/pos** (`as_pos` = asistencias / posesiones propias del jugador, ya existente) como **dos indicadores distintos**, con rótulos y tooltips de fórmula diferentes, uno junto al otro; ninguno reemplaza ni se calcula a partir del otro, y `as_pct` (AS% estándar de T-05, DA-06) sigue siendo una tercera clave distinta. · (US-2; Esp. v2 §A-12 "dos indicadores distintos, ambos visibles"; Arq. §2.2)
- RF-3: El sistema DEBE vincular cada asistencia con el evento de puntuación que la originó usando el vínculo de FIBA (`previousAction`) persistido en `pbp_events.previous_action`, clasificándola como asistencia a **2 puntos**, a **3 puntos**, a **tiro libre** (vínculo que FIBA registra en series de tiros libres, ver §0) o **sin vínculo** (evento inexistente, de otro equipo o no convertido). Un partido sin `previous_action` en sus asistencias se informa como "no registrado" y no se vincula por inferencia. · (US-3; Esp. v2 §A-12 "puntos por asistencia"; Arq. §1.6 tabla "Asistencia → canasta")
- RF-4: El sistema DEBE calcular **puntos generados por asistencias** (`ast_points`) = `2 × asistencias a 2 puntos + 3 × asistencias a 3 puntos` y **puntos por asistencia** (`pts_per_ast`) = `ast_points / (asistencias a 2 + asistencias a 3)`, ambos en cociente de totales sobre la selección. Las asistencias vinculadas a tiro libre y las sin vínculo quedan fuera del numerador y del denominador y se informan aparte (conteo visible en el tooltip). Sin asistencias a tiros de campo, `pts_per_ast` es nulo con razón `sin_intentos`. · (US-3; Esp. v2 §A-12; ver §9 D-1)
- RF-5: El sistema DEBE persistir `previous_action` de cada evento del pbp (`pbp_events.previous_action`, entero, `DEFAULT NULL`: nulo = "no importado todavía", 0/ausencia de vínculo distinguidos), leerlo del JSON de FIBA en la ingesta, subir la versión de ingesta para que el panel de calidad (F-11) marque los partidos a reprocesar, y reprocesar los partidos existentes desde el JSON archivado sin pérdida de filas. · (US-3; Arq. §5 `pbp_events.previous_action`; `00-decisiones.md` F-11 acotado)
- RF-6: El sistema DEBE registrar en el catálogo de T-05 las claves `ast_team_share` (pct), `pts_per_ast` (dec2), `ast_points` (int, conteo escalable por la base de T-04) y `player_poss_duration` (dec1, segundos) para la entidad `player` (`no_aplica` en las demás entidades), de modo que aparezcan en `GET /api/metrics/player`, en el selector de columnas de T-06 y en la ficha de T-01 sin lista paralela. · (US-5; Esp. v2 §T-05 "se define una sola vez"; Arq. §3.5)
- RF-7: El sistema DEBE mostrar en S4 → Distribución una card "Creación de juego" con `AS/pos`, `% asistencias del equipo`, `Puntos por asistencia` (con las asistencias a tiros de campo y los puntos generados) y `Segundos de posesión`, cada indicador con su ficha de T-01 (valor, ranking "N.º de M", distancia al líder y al promedio, percentil con color salvo métricas neutrales) y el badge de muestra de T-02. · (US-1…US-5; Esp. v2 §A-12 CA, §1.3 S4)
- RF-8: El sistema DEBE tratar `player_poss_duration` como **incremento diferido (→ A-01)**: hasta que exista el motor de posesiones el valor es nulo con razón `requiere_posesiones` y la card lo muestra como "—" con la explicación "Se calcula con el motor de posesiones (en desarrollo)"; la clave, su posición en la card y su lugar en la ficha ya existen, de modo que A-01 solo reemplaza el cálculo. · (US-4; Esp. v2 §A-12 "Segundos promedio de posesión"; Arq. §9.2 I-03)
- RF-9: El sistema DEBE respetar el contexto activo (competencia y últimos N en fase 2; las demás dimensiones de T-03 cuando existan, incluidas las de nivel evento) y la base de normalización (T-04): `ast_points` se escala con la base; `ast_team_share`, `pts_per_ast` y `player_poss_duration` no se escalan. · (US-5; Esp. v2 §T-03, §T-04; Arq. §3.8)
- RF-10: El sistema DEBE aplicar la política de nulos (C-11): partido sin pbp → razón `sin_pbp`; partido con asistencias pero sin `previous_action` → razón `no_registrado` ("Reimportá sus partidos"); nunca 0 por falta de dato. Cuando una selección mezcla partidos con y sin vínculo, `ast_points` y `pts_per_ast` se calculan solo con los partidos con vínculo y la card informa "calculado sobre X de Y partidos". · (US-3; Esp. v2 §C-11; Arq. §7.4)
- RF-11: El sistema DEBE agregar al panel de calidad de datos (F-11) el campo `pbp_events.previous_action` (conteo de asistencias sin vínculo por competencia) para que el usuario vea qué partidos reprocesar. · (US-3; Esp. v2 §F-11 "campos nulos"; `backend/data_quality.py:NULL_FIELDS`)

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events.previous_action` | columna | INTEGER, `DEFAULT NULL` (vía `upgrade_db` `ALTER TABLE`; modelo `PbpEvent`) | **NUEVO** (columna prevista por Arq. §5, dueño original F-11, diferida; la agrega A-12) |
| `games.ingest_version` | dato existente | A-12 sube `INGEST_VERSION` al siguiente entero al valor vigente al integrar (hoy 2 → 3 si nadie la subió antes) | — |
| Claves de catálogo `ast_team_share`, `pts_per_ast`, `player_poss_duration` | claves de métricas | Arq. §3.5 ("Claves agregadas por requisitos posteriores"), entidad `player`, grupo `balon` (la última, `uso`) | NUEVAS (Arq. §3.5) |
| Clave de catálogo `ast_points` | clave de métrica | int, conteo, grupo `balon` | **NUEVA** — `PROPUESTA (no está en 00-arquitectura-transversal.md)` |
| `GET /api/metrics/player` (T-05) | endpoint consumido | `metrics.ast_team_share`, `metrics.pts_per_ast`, `metrics.ast_points`, `metrics.player_poss_duration` con ficha T-01; sin endpoint nuevo | — |
| `GET /api/rankings/player/<metric_key>` (T-01) | endpoint consumido | ranking completo de cada clave nueva | — |
| `GET /api/table/search_players` (T-06) | endpoint consumido | las claves nuevas aparecen como columnas del selector | — |

Sin tablas nuevas. Un solo cambio de esquema: la columna `pbp_events.previous_action`, con reproceso de los partidos
ya importados (el JSON crudo está archivado en `game_sources`; no hace falta FIBA).

## 6. Estados de UI

Copy nuevo (marcado para `docs/frontend.md`), en español directo (DA-21 resuelta: sin `t()` en fase 1–2; F-21 extrae el copy).

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| S4 → Distribución · card "Creación de juego" | spinner (`<span class="spinner">`) en la card | jugador sin asistencias: AS/pos y cuota con su valor (0,00 / 0,0 %), puntos por asistencia "—" ("Sin asistencias a tiros de campo") | mensaje del servidor en `.card` con "Reintentar" | "Sin conexión. No se pudo cargar la creación de juego." (nuevo) | cuatro indicadores con ficha T-01 y badge T-02 |
| Indicador con nulo | — | `—` con `title` por razón: `sin_pbp` "Partido sin play-by-play", `no_registrado` "La competencia no registra este dato. Si cambió, reimportá sus partidos" (ya en `core/format.js`), `requiere_posesiones` "Se calcula con el motor de posesiones (en desarrollo)" (nuevo), `sin_intentos` "Sin asistencias a tiros de campo" | — | — | — |
| Tooltips de fórmula (nuevos) | — | AS/pos: "Asistencias por cada posesión propia del jugador" · % asistencias del equipo: "Qué parte de las asistencias del equipo da el jugador (en los partidos que jugó)" · Puntos por asistencia: "Puntos de las canastas de campo asistidas por el jugador, sobre esas asistencias; no cuenta asistencias ligadas a tiros libres" · Segundos de posesión: "Duración media de las posesiones que el jugador finaliza" | — | — | — |

Mobile (<768 px): los cuatro indicadores en grilla de una o dos columnas (`.stat-grid` existente) sin scroll horizontal; el
ranking completo de T-01 abre como hoja inferior.

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: "Los tres indicadores aparecen en el perfil de jugador con su percentil correspondiente." — Given un jugador con al menos `sample.player.min` minutos en una competencia con los partidos reprocesados, When se abre S4 → Distribución, Then se ven (a) la cuota de asistencias del equipo y AS/pos como dos indicadores distintos, (b) puntos por asistencia y (c) segundos de posesión, cada uno con su ficha de T-01 (valor, ranking, distancias, percentil). **Alcance en fase 2:** (a) y (b) con valores y percentil reales; (c) aparece con su ficha pero con valor "—" y razón `requiere_posesiones` hasta que A-01 lo calcule (incremento diferido, §8); el CA se da por cumplido por completo con A-01.
- CA-2: Given un equipo y un partido del seed, When se suman las `ast_team_share` de todos los jugadores calculadas solo sobre ese partido, Then el total es 100 % (`Σ AST_j / AST_equipo = 1`); y para un jugador con 80 asistencias en partidos donde el equipo sumó 400, `ast_team_share` es 20,0 %.
- CA-3: Given un jugador cuyo equipo reparte las asistencias de forma concentrada, When se comparan sus indicadores, Then `AS/pos` y `% asistencias del equipo` tienen valores y rankings distintos (no son la misma serie con otro nombre) y sus tooltips explican cada fórmula.
- CA-4: Given los partidos del seed reprocesados con la ingesta nueva, When se calcula `ast_points` de un jugador con un script ad hoc sobre `pbp_events` (asistencia → evento vinculado: `2pt` ⇒ 2, `3pt` ⇒ 3), Then coincide con el valor de `GET /api/metrics/player` y `pts_per_ast` está entre 2,00 y 3,00.
- CA-5: Given un jugador con al menos una asistencia vinculada a un tiro libre (hay 46 en el seed), When se ve su `Puntos por asistencia`, Then esas asistencias no entran en el numerador ni en el denominador, el tooltip informa cuántas son y `AS`, `AS/pos` y `% asistencias del equipo` siguen contándolas.
- CA-6: Given partidos que no se reprocesaron (sin `previous_action`), When se piden `ast_points` y `pts_per_ast`, Then los valores son nulos con razón `no_registrado` y la UI muestra "—" con "Reimportá sus partidos", nunca 0; con una selección mixta se calcula con los partidos vinculados y se indica "calculado sobre X de Y partidos".
- CA-7: Given un partido sin play-by-play, When se pide el perfil del jugador, Then `ast_points`/`pts_per_ast` ignoran ese partido (razón `sin_pbp` si ningún partido de la selección tiene pbp) y `ast_team_share`/`as_pos` (que salen del box) siguen calculándose.
- CA-8: Given cualquier jugador, When se pide `GET /api/metrics/player`, Then `player_poss_duration` está presente en `metrics` con `value: null` y `reason: "requiere_posesiones"` (nunca ausente, nunca 0).
- CA-9: Given una competencia con población suficiente, When se compara la ficha de cada indicador nuevo con `GET /api/rankings/player/<clave>`, Then el puesto, el líder y el promedio de la ficha coinciden con la tabla del ranking.
- CA-10: Given un jugador con menos de `sample.player.min` minutos, When se ve la card, Then los indicadores se muestran con el badge de muestra "baja" y en gris, y no entran en el ranking ni en el promedio de la población.
- CA-11: Given la base "por partido" y luego "por 100" (cuando exista T-04), When se ve `ast_points`, Then se escala; `pts_per_ast`, `ast_team_share` y `player_poss_duration` no cambian.
- CA-12: Given los 13 partidos del seed, When se reprocesan dos veces seguidas, Then `pbp_events` conserva sus 7.163 filas, las 459 asistencias quedan con `previous_action` no nulo, `python backend/database.py` corre dos veces sin error y el panel de calidad deja de marcar los partidos como pendientes de reproceso.
- CA-13: Given un jugador con 0 asistencias en partidos jugados, When se ve la card, Then `ast_team_share` es 0,0 % (cero real: el equipo sí asistió) y `pts_per_ast` es "—" con razón `sin_intentos`.
- CA-14: Given un ancho de 360 px, When se recorre S4 → Distribución, Then la card no desborda la página y la consola no tiene errores JS.

## 8. Fuera de alcance
- INCREMENTO DIFERIDO (→ A-01, [../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)): el **cálculo** de `player_poss_duration` (segundos promedio de posesión) necesita las duraciones de posesión del motor de posesiones. Hasta entonces: clave en el catálogo, ficha y lugar en la card con valor nulo `requiere_posesiones`. Definición propuesta para A-01: duración media de las posesiones propias que el jugador finaliza (`Possession.finisher_id`).
- INCREMENTO DIFERIDO (→ A-07, [../../fase-5-analitica-exploracion/06-A-07-produccion-desde-eventos/spec.md](../../fase-5-analitica-exploracion/06-A-07-produccion-desde-eventos/spec.md)): producción de puntos tras asistencia de **equipo** y por tipo de posesión, y la matriz asistente→finalizador (A-08). A-12 solo agrega el vínculo y los puntos por asistencia de un jugador.
- Puntos por asistencia de entidades distintas de jugador (equipo, quinteto, pareja): `no_aplica` en A-12.
- Corrección de `as_pct` (AS% estándar, DA-06): es de T-05; A-12 no la toca.
- Inferir el vínculo asistencia→canasta por adyacencia en partidos no reprocesados: descartado (C-11: sin heurísticas que fabriquen dato).
- Otros indicadores de creación (pases, asistencias potenciales, tiros creados): FIBA no los publica.
- Tabla completa de jugadores con estas columnas: la entrega T-06 sin trabajo adicional (las claves del catálogo aparecen en el selector de columnas).

## 9. Ambigüedades
- D-1 [DECISIÓN PROPUESTA — confirmar] **Asistencias ligadas a tiro libre.** FIBA vincula 46 de las 459 asistencias del seed (≈10 %) a un tiro libre convertido, no a una canasta de campo. El cliente pide "cuántos puntos se convierten a partir de ello". Propuesta: `pts_per_ast` y `ast_points` cuentan solo asistencias a tiros de campo (2 o 3 puntos, rango natural 2,00–3,00) y las ligadas a tiro libre se informan aparte (tooltip y `ast_links.ft` del payload). Alternativa: contarlas con 1 punto (baja el promedio ≈ 0,2). Se elige la primera porque un tiro libre de una serie no es el resultado de la jugada asistida y mezclarlo distorsionaría la comparación entre jugadores.
- D-2 [DECISIÓN PROPUESTA — confirmar] **Denominador de la cuota.** `AST_equipo` = asistencias del equipo en los partidos que el jugador jugó (no en toda la temporada del equipo, ni solo con él en cancha). Motivo: coincide con "total del equipo" del cliente y con el criterio de partidos jugados (DNP fuera) de las demás tasas; "con él en cancha" exigiría pbp en todos los partidos y haría el indicador inestimable sin reproceso.
- D-3 [DECISIÓN PROPUESTA — confirmar] **Qué son los "segundos promedio de posesión".** FIBA no publica quién tiene el balón ni el tiempo de posesión individual. Propuesta para A-01: duración media de las posesiones propias que el jugador finaliza (tiro, pérdida o falta recibida). Alternativas: duración media de las posesiones con él en cancha (más cercana a "tempo de equipo con el jugador"; ya cubierta por `sec_per_poss` de T-05). Se rotula siempre "de las posesiones que finaliza". No bloquea A-12 (valor nulo hasta A-01).
- D-4 [DECISIÓN PROPUESTA — confirmar] **Dirección de las métricas nuevas.** `pts_per_ast` y `ast_points` `higher`; `ast_team_share` `neutral` (mide el rol de creador, no calidad: un base y un alero que reparten poco no son "peores"), con percentil mostrado pero sin color de rendimiento (como `uso_pct`); `player_poss_duration` `neutral`.
- D-5 [DECISIÓN PROPUESTA — confirmar] **Dónde vive `AS/pos`.** C-01 lo muestra en la card "Rebotes y distribución". Para que los "dos indicadores distintos" se lean juntos, A-12 lo **mueve** a la card "Creación de juego" (misma ficha); la card de C-01 conserva los rebotes.
- D-6 [DECISIÓN PROPUESTA — confirmar] **Dueño de la columna `previous_action` y de la versión de ingesta.** La arquitectura la asignó a F-11, que la difirió; A-12 es el primer requisito que la necesita (fase 2). A-01, A-02, A-04 y A-07 la reutilizan. Si otro requisito de fase 2 subió antes `INGEST_VERSION`, A-12 sube a la siguiente; si se integran juntos, el reproceso es de una sola pasada.
- D-7 [DECISIÓN PROPUESTA — confirmar] **Mínimo de asistencias para el ranking de `pts_per_ast`.** Un jugador con 1 asistencia a 3 puntos tendría 3,00 y lideraría el ranking. T-01 solo filtra por minutos (`sample.player.min`). Propuesta: sin mínimo propio en A-12; el badge de muestra y el conteo de asistencias a tiros de campo se muestran junto al valor para que se lea con cautela. Si el cliente pide un mínimo, se agregaría una clave de configuración mínima de asistencias (PROPUESTA, no está en 00-arquitectura-transversal.md) al estilo de la `leaders.min_attempts` que menciona F-14.
- D-8 [DECISIÓN PROPUESTA — confirmar] **Cobertura mixta.** Una selección con partidos reprocesados y sin reprocesar calcula `ast_points`/`pts_per_ast` con los vinculados y lo informa (RF-10); alternativa más estricta: nulo si falta alguno. Se elige la primera para que un solo partido sin reprocesar no deje en blanco al jugador.
