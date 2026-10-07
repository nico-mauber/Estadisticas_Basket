# Spec — C-04: AS/PER (asistencias sobre pérdidas)

> **ID:** C-04 · **Prioridad:** P1 · **Fase y orden:** 1·08
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/](../01-C-11-tratamiento-de-nulos/spec.md)) · **Habilita:** T-05 ([../13-T-05-conjunto-estandar-metricas/](../13-T-05-conjunto-estandar-metricas/spec.md)) · el `Ø` de AS/PER lo completa C-02 ([../11-C-02-promedios-de-liga/](../11-C-02-promedios-de-liga/spec.md), ver §8 y §9-A4)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §2 · C-04 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §6 glosario · Arquitectura §1.0, §2.1, §2.2 (fila AS/PER), §7.4 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente** (Esp. v2 §2 C-04, literal):
- *"Revisar el cálculo y su presentación. Definir explícitamente si es AS/PER por partido o acumulado de temporada, y usar el mismo criterio en equipo y en jugador."*
- CA: *"El valor coincide con el cálculo manual sobre el box score de la temporada."*

En esta app **PER = pérdidas** (no Player Efficiency Rating): es la sigla que ya usan la fila `PER` de Comparar, `Ptos/PER` y la card "PER/pos". AS/PER es, entonces, asistencias sobre pérdidas.

**Qué existe hoy (verificado en el código de la rama `v2` y sobre los 13 partidos de la base local).**
- La **definición ya está tomada** por la Feature 15 de `dev` (`sdd/specs/15-metricas-jugador/spec.md` RF-7/RF-8) y por C-11 (DA-07): AS/PER de una entidad es el **acumulado** `ΣAS / ΣPER`, igual en equipo y jugador, y vale `null` con razón `sin_perdidas` si `ΣPER = 0`. Lo implementan `stats_engine.season_ast_to()` y las rutas `team_stats`, `player_stats` y `search_players` (`backend/app.py`). El sentinel `99.0` ya no existe (C-11).
- Lo que **falta o está mal** (defectos verificados):
  1. **Presentación de equipo: no hay AS/PER.** `GET /api/team/<code>` calcula `averages.ast_to`, pero la vista Equipo no lo muestra: la card "Rebotes & Misc" solo muestra `TO` y `AS` (conteos por partido). El cliente pide el mismo criterio "en equipo y en jugador"; hoy el equipo no tiene la métrica visible.
  2. **Jugador: la card compara contra la métrica equivocada.** En "Rebotes & distribución" la caja `AST/TO` se construye con `leagueKey = "ast_ratio"`: su `Ø` es el de AST/PLAYS (≈0,2) y el color verde/rojo se decide comparando un AS/PER (≈1–3) contra ese `Ø`. Es un indicador de rendimiento falso. Además, `league_averages` no tiene la clave `ast_to`, así que ni siquiera existe un `Ø` del mismo criterio.
  3. **Con filtro de competencia el criterio cambia.** `_computeAvg()` (`frontend/js/app.js`) recalcula `ast_to` como **promedio de los ratios por partido** cuando hay un filtro de competencia activo (y, en equipo, como `null` porque el `game_log` de equipo no trae `ast_to` por partido). Caso real (base local, Olimpia): sin filtro `43/29 = 1,48`; con filtro, la media de ratios daría `(2,78 + 0,90)/2 = 1,84`. C-11 lo dejó ruteado a C-04 ("`_computeAvg` promedia `ast_to` por partido bajo filtro").
  4. **Etiqueta.** El jugador lo rotula "AST/TO"; el cliente y el resto de la app usan AS/PER.
  5. **No hay forma de verificar el número en pantalla**: la card muestra el cociente, pero no las asistencias y pérdidas acumuladas que lo producen (`totals` solo trae los seis conteos de tiro).
  6. El **Buscador** devuelve `ast_to` en cada fila pero no tiene la columna; **Comparar** no lo muestra.
- Evidencia numérica (13 partidos de "Liga de Ascenso 2026"): Olimpia (OLI) `AS 25/PER 9` y `18/20` → acumulado `43/29 = 1,4828` (el API ya lo devuelve); M. Perdomo (OLI) `12/1` y `2/6` → `14/7 = 2,0000` (media de ratios: `6,1667`); S. Sosa (TAB) `6/1` y `2/6` → `8/7 = 1,1429` (media de ratios: `3,1667`); J. Lamas (COL) `1/0` y `0/0` → `ΣPER = 0` → `null`.

**Qué ya resolvieron features anteriores** (no se rehace): 15 (acumulado de temporada, RF-7/RF-8), 12/08 (nulos), C-11 (DA-07: sin centinelas, razón `sin_perdidas`, etiqueta en `NULL_REASON_LABELS`).

**Qué queda (alcance de C-04, delta sobre `dev` + C-11):** dejar la definición escrita y única, mostrar AS/PER en equipo y en jugador con los totales que lo respaldan, que el criterio se mantenga bajo cualquier selección, corregir la comparación contra el promedio de liga y dar un procedimiento de verificación manual contra el box score.

## 1. Objetivo
Que AS/PER signifique una sola cosa —asistencias acumuladas sobre pérdidas acumuladas de la selección— en equipo, en jugador y en todas las pantallas, y que cualquiera pueda reproducirlo a mano con el box score.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 C-04 (requisito y CA), §6 glosario (no define AS/PER: la definición se fija acá, ver §9-A1), §2 C-11 (nulos), §2 C-02 (promedios de liga).
- Arquitectura §1.0 (delta sobre `dev`), §2.1 (agregación pooled, DA-02), §2.2 fila `ast_to` ("Pooled en equipo y jugador; `null` con razón `sin_perdidas`", DA-07), §3.5 (clave `ast_to`, grupo `balon`), §7.4 (códigos de razón), §11 DA-02, DA-07.
- `docs/metrics.md` §"Pérdidas y asistencias" (AST/TO acumulado) y §"Métricas de scouting defensivo" (nota "Sin centinelas").
- `docs/api.md` (nota "`ast_to` cambió de semántica", "Nulos con razón"); `docs/frontend.md` (`_computeAvg`, `statBox`, "Contexto de las cards de stat").
- Specs de `dev`: `sdd/specs/15-metricas-jugador/{spec,plan,progress}.md`; specs v2: [C-11](../01-C-11-tratamiento-de-nulos/spec.md).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver el AS/PER de mi equipo y de cada jugador, para saber si cuidan la pelota al mismo tiempo que generan juego.
- US-2: Como analista, quiero que AS/PER sea el cociente de los totales de la selección y no el promedio de los ratios de cada partido, para que un partido de 2/1 no pese lo mismo que uno de 10/5.
- US-3: Como analista, quiero ver en la misma card las asistencias y pérdidas acumuladas con las que se calculó, para poder comprobarlo contra el box score.
- US-4: Como entrenador, quiero que AS/PER no se compare con un promedio de otra métrica ni muestre números inventados cuando no hubo pérdidas, para confiar en el color y en el valor.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE calcular el AS/PER de una selección de partidos como `AS/PER = ΣAS / ΣPER` (cociente de los totales de la selección), nunca como promedio de los ratios por partido. · (US-2) (Esp. v2 §C-04) (docs/metrics.md §Pérdidas y asistencias: *"AST/TO (equipo y jugador) = AST_temporada / TOV_temporada"*) (Arquitectura §2.1, `[DECISIÓN HUMANA: DA-02]`) · "Selección" = los partidos que se están viendo: todas las competencias, una competencia o los últimos N.
- RF-2: El sistema DEBE aplicar el mismo criterio del RF-1 en equipo y en jugador, en el perfil, en Comparar y en el Buscador, y bajo cualquier selección activa (con o sin filtro de competencia o de últimos N). · (US-2) (Esp. v2 §C-04)
- RF-3: Cuando `ΣPER = 0` en la selección, el sistema DEBE devolver nulo con razón `sin_perdidas` y mostrar "—" (nunca `0`, `99`, `Infinity` ni un valor inventado); cuando `ΣAS = 0` y `ΣPER > 0`, DEBE mostrar `0,00` (es un cero real). · (US-4) (Esp. v2 §C-11) (docs/api.md §Nulos con razón) (Arquitectura §7.4)
- RF-4: El perfil de **equipo** DEBE mostrar AS/PER y el perfil de **jugador** DEBE rotularlo "AS/PER" (hoy lo rotula "AST/TO"). · (US-1) (Esp. v2 §C-04)
- RF-5: La caja de AS/PER DEBE mostrar, junto al cociente, los totales con los que se calculó (asistencias/pérdidas acumuladas de la selección), de modo que el valor se pueda reproducir con el box score. · (US-3) (Esp. v2 §C-04 CA) · La respuesta de equipo y de jugador DEBE incluir esos dos totales de la selección.
- RF-6: El `game_log` de equipo y de jugador DEBE traer el AS/PER **de cada partido** (`null` con razón `sin_perdidas` cuando ese partido tuvo 0 pérdidas), y las tablas de game log DEBEN mostrarlo en una columna "AS/PER" rotulada como valor del partido, distinta del acumulado de la card. · (US-2, US-3) (Esp. v2 §C-04: "por partido o acumulado")
- RF-7: La caja de AS/PER NO DEBE colorearse ni mostrar un `Ø` calculado con otra métrica. Mientras no exista un promedio de liga de AS/PER con el mismo criterio (acumulado por entidad, lo entrega C-02), la caja no muestra `Ø` ni color de rendimiento. · (US-4) (Esp. v2 §C-02)
- RF-8: Comparar equipos DEBE mostrar una fila "AS/PER" con el mismo criterio del RF-1, con ganador/perdedor solo si ambos valores existen. · (US-1, US-2) (Esp. v2 §C-04)
- RF-9: El Buscador de jugadores DEBE tener una columna "AS/PER" ordenable, con los nulos siempre al final. · (US-1) (docs/frontend.md §Orden de nulos)
- RF-10: La definición de AS/PER (acumulado, PER = pérdidas, nulo sin pérdidas, valor por partido en el game log) DEBE quedar escrita en un único lugar de la documentación del sistema. · (US-2) (Constitución regla 1)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `team_game_stats`, `player_game_stats` (`ast`, `tov`, `minutes`) | consumidas | sin cambio | No — sin cambio de esquema, sin `upgrade_db()` |
| `GET /api/team/<team_code>` | existente (mod.) | `game_log[].ast_to` **NUEVO** (+ `game_log[].null_reasons.ast_to` cuando es nulo); `totals.ast` y `totals.tov` **NUEVOS** (Σ de la selección); `averages.ast_to` sin cambio (ya acumulado) | Campos NUEVOS → docs/api.md |
| `GET /api/player/<team_code>/<player_name>` y `GET /api/player/<int:player_id>` (C-08) | existente (mod.) | `totals.ast` y `totals.tov` **NUEVOS** (Σ de los partidos **jugados** de la selección); `averages.ast_to` y `game_log[].ast_to` sin cambio | Campos NUEVOS |
| `GET /api/search/players` | existente | sin cambio de contrato (cada fila ya trae `ast_to` acumulado) | No |
| Errores | — | Sin códigos nuevos | No |

## 6. Estados de UI
| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Caja "AS/PER" — Equipo (card "Rebotes & Misc") y Jugador (card "Rebotes & distribución") | spinner existente de la vista | selección sin partidos: se aplican los estados existentes de la vista | toast existente con el `error` del backend | mensaje offline existente (`/api/*` siempre a red) | `1,48` con `(43/29)` debajo; sin pérdidas: "—" con `title` = "Sin pérdidas: el cociente no está definido" (etiqueta `sin_perdidas` de C-11); sin `Ø` ni color mientras no exista el `Ø` de C-02 |
| Columna "AS/PER" de los game logs (Equipo y Jugador) | sin cambio | fila DNP sin números (existente) | sin cambio | sin cambio | valor del partido; partido sin pérdidas: "—" con el `title` anterior |
| Fila "AS/PER" de Comparar | sin cambio | — | sin cambio | sin cambio | dos valores; ganador solo si ambos existen |
| Columna "AS/PER" del Buscador | sin cambio | sin cambio | sin cambio | sin cambio | ordenable; nulos al final |

Copy nuevo (→ docs/frontend.md): "AS/PER" (etiqueta; es la sigla del cliente), `title` de la etiqueta "Asistencias sobre pérdidas, acumulado de la selección (PER = pérdidas)", y el sufijo `(AS/PER)` de totales ("43/29") en la caja. El `title` "Sin pérdidas: el cociente no está definido" ya existe en `NULL_REASON_LABELS` (C-11). Formato es-UY: AS/PER con 2 decimales y coma ("1,48"); totales enteros.

## 7. Criterios de aceptación
- CA-1 (CA del cliente): Given el box score de la temporada de un equipo y de un jugador reales, When se suman a mano las asistencias y las pérdidas de sus partidos y se dividen, Then el AS/PER que muestra la app coincide con ese cálculo (a 2 decimales).
- CA-2: Given Olimpia (partidos `25/9` y `18/20`) y M. Perdomo (`12/1` y `2/6`), When se abre su perfil, Then AS/PER muestra `1,48` y `2,00` (acumulado) y **no** `1,84` ni `6,17` (media de ratios por partido).
- CA-3: Given el perfil de un equipo y el de un jugador, When se observan sus cards, Then ambos muestran AS/PER con sus totales ("43/29", "14/7") y el cociente es `ΣAS/ΣPER`.
- CA-4: Given J. Lamas (COL: 1 asistencia y 0 pérdidas en la temporada), When se abre su perfil, Then AS/PER muestra "—" (con `title` "Sin pérdidas: el cociente no está definido") y no `0`, `99` ni `Infinity`; la respuesta trae `averages.ast_to = null` y `null_reasons.ast_to = "sin_perdidas"`.
- CA-5: Given un equipo o jugador con un filtro de competencia activo que deja ≥ 2 partidos, When se mira AS/PER, Then el valor sigue siendo `ΣAS/ΣPER` de la selección (el mismo que sin filtro si los partidos son los mismos), no la media de los ratios.
- CA-6: Given la caja de AS/PER, When se observa su contexto, Then no muestra `Ø` ni color verde/rojo calculado contra `ast_ratio` ni contra otra métrica; (si C-02 ya está cerrado) el `Ø` es el promedio de liga de AS/PER del mismo criterio.
- CA-7: Given el game log de Olimpia, When se mira la columna "AS/PER", Then muestra `2,78` y `0,90` (valores de cada partido), distintos del `1,48` acumulado de la card.
- CA-8: Given Comparar equipos con dos equipos, When se compara, Then la fila "AS/PER" muestra el acumulado de cada uno; si uno no tiene pérdidas, muestra "—" y ninguno se marca ganador.
- CA-9: Given el Buscador, When se ordena por "AS/PER" ascendente y descendente, Then los jugadores sin pérdidas ("—") quedan al final en ambos sentidos.
- CA-10: Given el recorrido de Equipo, Jugador, Comparar y Buscador, When se observa la consola del navegador, Then no hay errores JS, y en 360 px no aparece scroll horizontal de página.

## 8. Fuera de alcance
- Promedio de liga (`Ø`) y percentil de AS/PER: `INCREMENTO DIFERIDO (→ C-02)` para el `Ø` (mismo criterio por entidad, [C-02](../11-C-02-promedios-de-liga/spec.md)) e `INCREMENTO DIFERIDO (→ T-01)` para el percentil y la ficha ([T-01](../15-T-01-ficha-de-metrica/spec.md)).
- Confiabilidad de muestra: un jugador con 1 pérdida mueve mucho su AS/PER; el badge y los mínimos son de T-02 ([../14-T-02-confiabilidad-muestra/](../14-T-02-confiabilidad-muestra/spec.md)).
- AS/pos, AS% y cuota de asistencias del equipo (A-12 / T-05), PER/pos (C-01), TO% (T-05, DA-04).
- DEF/TO (ya acumulado y sin centinela en C-11) y el resto del conjunto estándar (T-05).
- Base de normalización (por 40, por 100): T-04; AS/PER es una razón y no escala.
- Tablas completas y exportación del AS/PER: T-06.

## 9. Ambigüedades
- A1 · ¿AS/PER es por partido o acumulado de temporada? → [DECISIÓN PROPUESTA — confirmar] **Acumulado de la selección** (`ΣAS/ΣPER`) para toda cifra de resumen de una entidad, igual en equipo y jugador; el valor **por partido** existe solo como fila del game log, rotulado como tal. Razón: ya es lo vigente (Feature 15), es el default de DA-02/DA-07 y es lo único que coincide con el box score acumulado que pide el CA; la media de ratios daba el mismo peso a un partido de `2/1` que a uno de `10/5`. La arquitectura (§2.2) llega a la misma definición.
- A2 · ¿"PER" es pérdidas? → [DECISIÓN PROPUESTA — confirmar] Sí, igual que en el resto de la app (`PER/pos`, `Ptos/PER`, fila `PER`): no es el Player Efficiency Rating. El `title` de la etiqueta lo dice.
- A3 · ¿Cómo se rotula? → [DECISIÓN PROPUESTA — confirmar] "AS/PER" (término del cliente) en lugar de "AST/TO" en toda la UI; la clave del API sigue siendo `ast_to` (arquitectura §3.5).
- A4 · ¿Qué se muestra como promedio de liga hasta que C-02 entregue uno del mismo criterio? → [DECISIÓN PROPUESTA — confirmar] Nada: sin `Ø` y sin color. Razón: el único `Ø` posible hoy sería la media de los ratios por partido de todas las fichas (criterio distinto al del valor mostrado, contaminado por jugadores con 1 pérdida) y repetiría el problema que describe C-02. Cuando C-02 incluya `ast_to` en su población, la caja lo muestra sin cambios de código (ya pasa `leagueKey "ast_to"`).
- A5 · Orden respecto de C-02 → [DECISIÓN PROPUESTA — confirmar] El requisito es chico y funciona solo, pero conviene ejecutarlo **después de C-02** (que mueve el filtro de competencia/últimos N al backend y elimina `_computeAvg`): así el RF-2 bajo filtro sale gratis. Si se ejecuta antes (orden de carpeta), el plan incluye la tarea transitoria de parchar `_computeAvg` (ver plan §10 D-1).
- A6 · ¿AS/PER por partido en el game log del equipo? → [DECISIÓN PROPUESTA — confirmar] Sí: se calcula en `calc_team_stats` igual que en jugador; sin esto el equipo no puede mostrar la columna ni el filtro mantener el criterio.
