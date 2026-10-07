# Spec — C-01: Rebotes y distribución en perfil de jugador

> **ID:** C-01 · **Prioridad:** P0 · **Fase y orden:** 1·09
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/](../01-C-11-tratamiento-de-nulos/spec.md)) · **Habilita:** T-05 ([../13-T-05-conjunto-estandar-metricas/](../13-T-05-conjunto-estandar-metricas/spec.md)) · A-12 ([../../fase-2-contexto-comparabilidad/06-A-12-metricas-jugador-pendientes/](../../fase-2-contexto-comparabilidad/06-A-12-metricas-jugador-pendientes/spec.md)) · el `Ø` de liga lo completa C-02 ([../11-C-02-promedios-de-liga/](../11-C-02-promedios-de-liga/spec.md), ver §8 y §9-A5)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §2 · C-01 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 (S4 pestaña Distribución) · §6 glosario (OR%, DR%, Posesión) · Arquitectura §1.0, §2.1, §2.2 (filas OR%/DR%, AS/pos, RO/min), §3.5, §7.4

## 0. Contexto y situación actual

**Qué pide el cliente** (Esp. v2 §2 C-01, literal):
- *"Revisar el cálculo de AS/pos, PER/pos, PTS/pos, RO/min y RD/min."*
- *"Hoy en el perfil de jugador OR% y DR% se muestran vacíos ("—") con Ø 0.0%: verificar si es dato faltante o error de cálculo, y aplicar la regla de nulos de C-11."*
- CA: *"Los cinco indicadores devuelven valor numérico coherente para todo jugador con minutos disputados."*

En esta app **PER = pérdidas** (no Player Efficiency Rating): `PER/pos` son pérdidas por posesión.

**Diagnóstico pedido por el cliente: ¿dato faltante o error de cálculo?** Respuesta (ya establecida por la Feature 15 de `dev` y verificada en el código de la rama `v2`): era **dato faltante**. En `main` (producción) `calc_player_stats` nunca incluía `or_pct`, `dr_pct` ni `trb_pct`: la UI los pedía, recibía `undefined` y mostraba "—". El `Ø 0.0%` era un bug distinto, de `league_averages` (devolvía `{avg: 0, best: 0}` sin datos), corregido en la Feature 14. Ambas correcciones ya están integradas (`stats_engine.calc_player_stats` calcula las tres con la fórmula individual por minutos; la card muestra `Ø —` si no hay promedio).

**Qué existe hoy (verificado en `backend/stats_engine.py`, `backend/app.py`, `frontend/js/app.js` y en los 13 partidos de la base local).**
- `calc_player_stats` devuelve por partido `as_pos = AST/POS`, `tov_pos = PER/POS`, `pts_pos = PTS/POS` (idéntico a `oer`), `orb_min = RO/min`, `drb_min = RD/min` y `or_pct`/`dr_pct`/`trb_pct` individuales. `player_stats` (perfil) y `search_players` (Buscador) los **promedian** (media de las tasas de cada partido, excluyendo nulos). La card "Por posesión y por minuto" y la card "Rebotes & distribución" los muestran.
- **Defectos verificados** (los que impiden la coherencia que pide el CA):
  1. **Posesión negativa → tasas absurdas.** `POS = T2i + T3i + 0,44·TLi + PER − RO` puede ser ≤ 0 en un partido (se resta el rebote ofensivo). Caso real: G. Viera (Tabaré), partido 2849330: 8:58 min, 0 tiros de campo, 2 tiros libres, 1 RO → `POS = −0,12` → `AS/pos = −8,33`, `PTS/pos = −16,67`; su perfil muestra `AS/pos −4,17` y `OER −7,98`. Un ratio por posesión negativo no tiene sentido.
  2. **Posesión 0 → nulo aunque jugó.** 22 de las 259 fichas-partido jugadas tienen `POS = 0`; en ese partido los tres indicadores por posesión valen `null` aunque el jugador sumó minutos (p. ej. F. Satut Hornos, 7:46). En la temporada, 14 de los 152 jugadores con minutos terminan con `ΣPOS = 0`.
  3. **Media de tasas por partido ≠ cociente de totales.** Un partido de 1 minuto pesa igual que uno de 35. Caso real, M. Perdomo (Olimpia; `AST 12 + 2`, `POS 11,76 + 17,76 = 29,52`): `AS/pos` de perfil `0,5665` (media) vs `14/29,52 = 0,4743` (acumulado); `RO/min` `0,0332` vs `2/60,88 = 0,0328`. El cliente verifica contra el box score de la temporada, que es acumulado.
  4. **OR%/DR% mayores a 100 %.** La fórmula individual estima por minutos; con minutos ínfimos explota: J. Lucchini (Trouville, 0:15 min, 1 RO) → `OR% = 516 %`; I. Rocha (Urupán, 0:43, 1 RD) → `DR% = 143 %`. Es la misma familia de "valores imposibles" que describe C-02.
  5. **Escala sin explicar.** El OR% de jugador ronda 3–5 % y el de equipo 29 %; en pantalla ambos se llaman "OR%" sin aclaración (deuda anotada en la Feature 15).
  6. **Promedio de liga contaminado** (lo resuelve C-02): el `Ø` de `AS/pos` (`0,1961`) incluye la ficha de `−8,33`, y la población de jugadores incluye las 53 fichas DNP (312 fichas, 259 jugadas); el `best` de `orb_min` es `4,0` y el de `or_pct` `5,16`.

**Qué ya resolvieron features anteriores** (no se rehace): 15 (las cinco métricas nuevas y OR%/DR%/TRB% individuales, `PTS/pos ≡ OER`), 12/08 (nulos y DNP fuera de promedios), 14 (`Ø —`), C-11 (nulos con razón, coma decimal).

**Qué queda (alcance de C-01, delta sobre `dev` + C-11):** valores coherentes —sin negativos ni porcentajes imposibles—, calculados sobre los totales de la selección (DA-02) como se verifica contra el box, nulos con razón cuando el denominador no existe, y rótulos que expliquen la escala del OR%/DR% de jugador.

## 1. Objetivo
Que en el perfil de jugador AS/pos, PER/pos, PTS/pos, RO/min, RD/min, OR% y DR% devuelvan siempre un valor numérico coherente —o un nulo con razón cuando el denominador no existe— y se puedan reproducir a mano con el box score.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 C-01 (requisito y CA), §1.3 S4 "Distribución" (RO/min, AS/pos, PER/pos…), §6 glosario (Posesión, OR%, DR%), §2 C-11 (nulos), §2 C-02 (promedios de liga).
- Arquitectura §1.0 (delta sobre `dev`), §2.1 (agregación pooled, DA-02; "Jugador: OER individual y AS/pos: `POS_jugador`"), §2.2 (filas AS/pos, OR%/DR%, RO/min · RD/min, "La UI rotula la escala"), §3.5 (claves `as_pos`, `orb_min`, `drb_min`, `or_pct`, `dr_pct`), §7.4 (códigos de razón), §11 DA-02.
- `docs/metrics.md` §Posesiones, §"Por posesión y por minuto (jugador)", §"OR% / DR% / TRB% de jugador — fórmula individual", §Rebotes; `docs/api.md` (nota "Métricas de jugador por posesión y por minuto", "Nulos con razón"); `docs/frontend.md` (cards del perfil de jugador).
- Specs de `dev`: `sdd/specs/15-metricas-jugador/{spec,plan,progress}.md` (diagnóstico y decisiones del cliente del 2026-08-10: las cinco son métricas nuevas; OR%/DR% se calculan, no se retiran); specs v2: [C-11](../01-C-11-tratamiento-de-nulos/spec.md).

## 3. Historias de usuario
- US-1: Como analista, quiero ver cuántas asistencias, pérdidas y puntos produce un jugador por posesión propia, para comparar jugadores con volúmenes de uso distintos.
- US-2: Como analista, quiero ver el rebote ofensivo y defensivo por minuto, para comparar titulares con jugadores de rotación corta.
- US-3: Como analista, quiero el porcentaje de rebote ofensivo y defensivo del jugador, para saber qué porción de los rebotes disponibles capturó mientras estuvo en cancha.
- US-4: Como entrenador, quiero que ninguno de estos indicadores muestre valores negativos o mayores a 100 %, y que al lado de un "—" haya una razón, para confiar en el perfil.
- US-5: Como analista, quiero poder reproducir cada indicador sumando el box score de la temporada, para validar el número.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE calcular **AS/pos**, **PER/pos** y **PTS/pos** de una selección de partidos como cociente de totales: `AS/pos = ΣAST / ΣPOS_jug`, `PER/pos = ΣTOV / ΣPOS_jug`, `PTS/pos = ΣPTS / ΣPOS_jug`, con `POS_jug = T2i + T3i + 0,44 × TLi + PER − RO` calculada sobre los totales de los partidos **jugados** de la selección. · (US-1, US-5) (Esp. v2 §C-01; §6 glosario "Posesión") (docs/metrics.md §Posesiones y §Por posesión y por minuto) (Arquitectura §2.1 `[DECISIÓN HUMANA: DA-02]`)
- RF-2: El sistema DEBE calcular **RO/min** y **RD/min** de una selección como `ΣRO / Σmin` y `ΣRD / Σmin`, con `Σmin` = minutos disputados en los partidos jugados (los `MM:SS` del box convertidos a minutos decimales). · (US-2, US-5) (Esp. v2 §C-01) (docs/metrics.md §Por posesión y por minuto)
- RF-3: El sistema DEBE calcular **OR%** y **DR%** (y `TRB%`) individuales de una selección como cociente de los totales de los términos de la fórmula individual: `OR% = Σ(RO_jug × L) / Σ(min_jug × (RO_equipo + RD_rival))` y `DR% = Σ(RD_jug × L) / Σ(min_jug × (RD_equipo + RO_rival))`, `TRB% = Σ(REB_jug × L) / Σ(min_jug × (REB_equipo + REB_rival))`, con `L` = duración del partido (`games.minutes`: 40 + 5 por prórroga). · (US-3, US-5) (Esp. v2 §C-01) (docs/metrics.md §"OR% / DR% / TRB% de jugador — fórmula individual") · Por partido (game log) se conserva la fórmula del partido.
- RF-4: Cuando el denominador de `POS_jug` de la selección (o del partido, en el game log) es **menor o igual a 0**, AS/pos, PER/pos y PTS/pos (y el OER de jugador, que es el mismo número) DEBEN valer nulo con razón `sin_intentos`, mostrarse "—" y nunca ser negativos ni `0` inventado. Un `0` real (p. ej. 0 pérdidas con posesiones > 0) se muestra `0,00`. · (US-4) (Esp. v2 §C-11) (Arquitectura §7.4)
- RF-5: Un OR%, DR% o TRB% individual calculado mayor a 100 % (artefacto de la estimación por minutos con muestra ínfima) DEBE tratarse como no calculable: nulo con razón `estimacion_invalida` y "—" en la UI; nunca se muestra un porcentaje mayor a 100 %. · (US-4) (Esp. v2 §C-02 "valores imposibles") `[DECISIÓN PROPUESTA — confirmar, §9-A4]`
- RF-6: Todo jugador con minutos disputados en la selección DEBE obtener valor numérico en RO/min y RD/min, y en AS/pos, PER/pos y PTS/pos siempre que `ΣPOS_jug > 0`; OR% y DR% DEBEN tener valor numérico siempre que existan los rebotes del equipo y del rival del partido, el denominador sea > 0 y el resultado no supere 100 %. En el resto de los casos el nulo lleva su razón (RF-4, RF-5). · (US-1, US-2, US-3) (Esp. v2 §C-01 CA)
- RF-7: PTS/pos y OER de jugador DEBEN seguir siendo el mismo número en el perfil, el game log y el Buscador (una sola fuente, dos rótulos). · (US-1) (docs/metrics.md: *"PTS/pos … idéntico al OER de jugador"*)
- RF-8: Un partido DNP (0 minutos) NO DEBE aportar ni al numerador ni al denominador de ningún indicador, y `games` cuenta solo partidos jugados. · (US-4) (Esp. v2 §C-11) (Feature 12 RF-6)
- RF-9: El Buscador de jugadores (`/api/search/players`) DEBE entregar los mismos valores que el perfil para estos indicadores (mismo criterio y mismos nulos con razón). · (US-5) (Esp. v2 §C-01)
- RF-10: La UI DEBE rotular los indicadores para que se entienda qué miden: AS/pos, PER/pos, PTS/pos y RO/min/RD/min con su definición, y OR%/DR% de jugador aclarando que es la porción de los rebotes disponibles mientras estuvo en cancha, estimada por minutos, y que **no es comparable** con el OR%/DR% de equipo. · (US-3) (docs/metrics.md: *"El OR% de jugador y el de equipo comparten nombre pero son escalas distintas"*) (Arquitectura §2.2 "La UI rotula la escala")
- RF-11: El promedio de liga (`Ø`) de estos siete indicadores DEBE usar el mismo criterio (acumulado por jugador) y no incluir fichas DNP. · (US-4) (Esp. v2 §C-02) · `INCREMENTO DIFERIDO (→ C-02)`: lo entrega [C-02](../11-C-02-promedios-de-liga/spec.md); C-01 exige solo que los siete indicadores salgan de la misma agregación que usará la población de liga.

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `player_game_stats` (`ast`, `tov`, `pts`, `orb`, `drb`, `fga2`, `fga3`, `fta`, `minutes`) y `team_game_stats` (`orb`, `drb` propios y del rival), `games.minutes` | consumidas | sin cambio | No — sin cambio de esquema, sin `upgrade_db()` |
| `GET /api/player/<team_code>/<player_name>` y `GET /api/player/<int:player_id>` (C-08) | existente (mod.) | `averages.{as_pos, tov_pos, pts_pos, oer, orb_min, drb_min, or_pct, dr_pct, trb_pct}` pasan a cociente de totales de la selección; `game_log[]` conserva el valor del partido pero con `null` en vez de negativos cuando `POS ≤ 0`; `null_reasons` agrega `sin_intentos` (POS ≤ 0) y `estimacion_invalida` (porcentaje > 100 %) | Semántica cambia; razón `estimacion_invalida` **NUEVA** → docs/api.md |
| `GET /api/search/players` | existente (mod.) | mismas 9 claves con el criterio nuevo; `null_reasons` con las razones anteriores | Semántica cambia |
| Errores | — | Sin códigos HTTP nuevos | No |

## 6. Estados de UI
Cards "Por posesión y por minuto" y "Rebotes & distribución" del perfil de jugador (en fase 1 son cards de `#sec-player`; X-01 las mueve a la pestaña `distribucion` de S4 sin cambiarlas).

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Cards de indicadores del jugador | spinner existente de la vista | jugador sin partidos jugados: todos los valores "—" con `title` "No jugó (DNP)" (existente) | toast existente con el `error` del backend | mensaje offline existente (`/api/*` siempre a red) | valores con coma decimal (`0,47`, `3,3%`); nulos "—" con `title` de su razón (`sin_intentos`: "Sin intentos: no se puede calcular"; `estimacion_invalida`: **copy nuevo**) |

Copy nuevo (→ docs/frontend.md y `NULL_REASON_LABELS`): razón `estimacion_invalida` → "Estimación no válida: la muestra de minutos es demasiado chica". Rótulos con `title`: "AS/pos" → "Asistencias por posesión propia (posesión = T2i + T3i + 0,44 × TLi + PER − RO)"; "PER/pos" → "Pérdidas por posesión propia (PER = pérdidas)"; "PTS/pos" → "Puntos por posesión propia (igual al OER del jugador)"; "RO/min" → "Rebotes ofensivos por minuto disputado"; "RD/min" → "Rebotes defensivos por minuto disputado"; "OR%" → "Porción de los rebotes ofensivos disponibles que capturó mientras estuvo en cancha (estimado por minutos). No es comparable con el OR% de equipo."; "DR%" → ídem con rebotes defensivos.

## 7. Criterios de aceptación
- CA-1 (CA del cliente): Given cualquier jugador con minutos disputados y `ΣPOS_jug > 0`, When se abre su perfil, Then AS/pos, PER/pos, PTS/pos, RO/min y RD/min muestran un valor numérico coherente (ningún "—", ningún negativo), y OR% y DR% también (entre 0 % y 100 %).
- CA-2: Given M. Perdomo (Olimpia: `AST 12/2`, `TOV 1/6`, `PTS 12/13`, `RO 1/1`, `RD 1/0`, `POS 11,76/17,76`, `27:21 + 33:32` min), When se recalcula a mano con los totales, Then la pantalla muestra `AS/pos 0,47` (`14/29,52`), `PER/pos 0,24` (`7/29,52`), `PTS/pos 0,85` (`25/29,52`), `RO/min 0,03` (`2/60,88`), `RD/min 0,02` (`1/60,88`), `OR% 3,3%` y `DR% 1,6%`, y no los valores de la media de tasas (`0,57`, `0,03`…).
- CA-3: Given G. Viera (Tabaré, partido 2849330 con `POS = −0,12`), When se abre su perfil, Then en el game log ese partido muestra "—" en AS/pos y PTS/pos (razón `sin_intentos`), y los valores de temporada son `AS/pos 0,15` (`1/6,88`), `PER/pos 0,00` (`0/6,88`, cero real), `PTS/pos 1,02` (`7/6,88`) y `OER 1,02`; ninguno negativo.
- CA-4: Given N. Cerminatti (Stockolmo, 12 s jugados, sin acciones, `ΣPOS = 0`), When se abre su perfil, Then AS/pos, PER/pos y PTS/pos muestran "—" con `title` "Sin intentos: no se puede calcular", y RO/min y RD/min muestran `0,00` (cero real).
- CA-5: Given J. Lucchini (Trouville, 0:15 min, 1 RO) e I. Rocha (Urupán, 0:43 min, 1 RD), When se abren sus perfiles, Then el OR% de Lucchini y el DR% de Rocha muestran "—" con el `title` de `estimacion_invalida` y no `516 %` ni `143 %`.
- CA-6: Given un jugador con partidos DNP en la selección, When se observan los indicadores, Then los DNP no aportan al numerador ni al denominador y `games` cuenta solo los jugados.
- CA-7: Given M. Perdomo, When se compara el perfil con su fila de `GET /api/search/players`, Then `as_pos`, `tov_pos`, `pts_pos`, `orb_min`, `drb_min`, `or_pct`, `dr_pct` y `oer` coinciden exactamente.
- CA-8: Given cualquier jugador, When se compara `averages.pts_pos` con `averages.oer` (perfil, game log y Buscador), Then son idénticos.
- CA-9: Given el perfil de jugador, When se pasa el cursor (o se toca) las etiquetas de AS/pos, PER/pos, PTS/pos, RO/min, RD/min, OR% y DR%, Then se ve la definición; la de OR%/DR% aclara que es una estimación por minutos y que no es comparable con el OR% de equipo.
- CA-10: Given una selección con filtro de competencia o de últimos N (cuando [C-02](../11-C-02-promedios-de-liga/spec.md) mueve la selección al backend), When se mira cualquiera de los siete indicadores, Then es el cociente de totales de esa selección (con un solo partido en la selección coincide con el valor del game log de ese partido).
- CA-11: Given C-02 cerrado, When se mira `Ø` de OR% y DR% en el perfil, Then muestran el promedio de liga del mismo criterio (no `Ø 0,0 %` ni `Ø —` cuando la competencia tiene jugadores con datos).
- CA-12: Given el recorrido del perfil de jugador y del Buscador, When se observa la consola del navegador, Then no hay errores JS, y en 360 px no aparece scroll horizontal de página.

## 8. Fuera de alcance
- Promedio de liga de estos indicadores y exclusión de DNP de la población: `INCREMENTO DIFERIDO (→ C-02)` ([../11-C-02-promedios-de-liga/](../11-C-02-promedios-de-liga/spec.md)). Percentil y ficha: `INCREMENTO DIFERIDO (→ T-01)`.
- Mínimos de muestra (jugadores con 3 minutos que encabezan RO/min) y regresión a la media: T-02 ([../14-T-02-confiabilidad-muestra/](../14-T-02-confiabilidad-muestra/spec.md)). C-01 solo evita los valores imposibles, no cura las muestras chicas.
- OR%/DR% "en cancha" exactos con los rebotes del equipo mientras el jugador está en cancha (play-by-play): `INCREMENTO DIFERIDO (→ T-05)` (`on_court` del `StatBundle`). Hasta entonces la estimación es por minutos (decisión del cliente, Feature 15).
- RO/pos, AS%, cuota de asistencias del equipo, USO% "en cancha", `oreb_share`/`dreb_share`/`reb_share` (T-05 / A-12); REB% (`trb_pct`) se calcula pero su caja en pantalla es de T-05.
- Migración general de OER y del resto de las tasas a cociente de totales: T-05 (DA-02). C-01 adelanta solo la familia de este requisito y el OER de jugador (por la equivalencia PTS/pos ≡ OER).
- Base de normalización (por 40, por 100): T-04.

## 9. Ambigüedades
- A1 · ¿El "—" de OR%/DR% era dato faltante o error de cálculo? → Resuelto (§0): dato faltante en `main`; ya calculado en `dev`. Lo que queda son incoherencias de los valores calculados (negativos, > 100 %, media de tasas).
- A2 · ¿Cómo se agregan los indicadores de una temporada? → [DECISIÓN PROPUESTA — confirmar] Cociente de totales de la selección (default de `[DECISIÓN HUMANA: DA-02]`, ya resuelta por el humano en `00-decisiones.md`; la migración general es de T-05). Razón: el CA se verifica "con el box score"; la media de tasas por partido da el mismo peso a 1 minuto que a 35 y no se reproduce a mano. Cambia el número visible de varios jugadores (antes/después en progress).
- A3 · "Valor numérico para todo jugador con minutos" y la posesión ≤ 0 → [DECISIÓN PROPUESTA — confirmar] Un jugador sin posesiones propias (`ΣPOS ≤ 0`: p. ej. 14 de 152 con 0,1–4,7 minutos de la base local) no tiene tasa por posesión definida: se muestra "—" con razón `sin_intentos`, nunca `0` ni un negativo. RO/min y RD/min siempre tienen valor con minutos > 0. Alternativa descartada: imputar la posesión por minutos (inventa un dato).
- A4 · OR%/DR% > 100 % → [DECISIÓN PROPUESTA — confirmar] Nulo con razón nueva `estimacion_invalida`. Razón: un porcentaje de rebotes capturados no puede superar 100 % y mostrarlo repite el problema de "valores imposibles" de C-02. Código **PROPUESTA (no está en 00-arquitectura-transversal.md §7.4)**; alternativas: topear en 100 % (inventa un dato) o dejar el valor (impone un 516 % en pantalla). El umbral de minutos de T-02 lo reemplazará.
- A5 · Orden respecto de C-02 → [DECISIÓN PROPUESTA — confirmar] Conviene ejecutar C-01 **después de C-02**: C-02 crea la agregación única de selección (`aggregate_games`) y mueve el filtro de competencia/últimos N al backend, y C-01 se registra ahí (CA-10, CA-11 salen sin código extra). Si se ejecuta antes (orden de carpeta), el plan lo cubre con funciones puras que C-02 absorbe (plan §10 D-1); CA-10 y CA-11 quedan pendientes hasta cerrar C-02.
- A6 · OER de jugador también pasa a cociente de totales → [DECISIÓN PROPUESTA — confirmar] Sí, solo para jugador: es el mismo número que PTS/pos y no pueden divergir (RF-7). El OER de equipo no se toca (T-05).
- A7 · `Ø` de estos indicadores hasta C-02 → [DECISIÓN PROPUESTA — confirmar] Se mantiene el vigente (Feature 14); no se corrige acá porque la población de jugadores y su criterio los define C-02.
