# Spec — T-02: Confiabilidad de muestra

> **ID:** T-02 · **Prioridad:** P0 · **Fase y orden:** 1·14
> **Depende de:** F-13 ([../12-F-13-configuracion/](../12-F-13-configuracion/spec.md)), T-05 ([../13-T-05-conjunto-estandar-metricas/](../13-T-05-conjunto-estandar-metricas/spec.md)); indirectas: F-11 ([../02-F-11-calidad-datos-competencias/](../02-F-11-calidad-datos-competencias/spec.md), universo por competencia y `admin_required`), C-08 ([../07-C-08-jugadores-duplicados/](../07-C-08-jugadores-duplicados/spec.md), ids de jugador en los ids de quinteto)
> **Habilita:** T-01, T-06, C-03, F-06, F-19, T-03, F-09, F-10, A-06, A-08, A-11, F-15
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §3 · T-02 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §2.1, §3.2, §3.7, §7.2, §9 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente y por qué.** "Toda métrica derivada de posesiones muestra junto a ella las posesiones, los minutos y los
partidos sobre los que se calculó. Aplica a combinaciones, ON/OFF, cierres, emparejamientos, splits y cualquier filtro por
período." La nota de §0 de la especificación lo pone como condición para salir de la Fase 1: hoy hay "quintetos rankeados sin
ninguna corrección por muestra". El cliente pide umbrales calibrados "para el volumen real de estas competencias: entre 16 y 33
partidos por equipo, con unas 80 posesiones por partido", un badge BAJA/MEDIA/ALTA, umbral relativo con piso absoluto,
regresión a la media en OER/DER/Net Rating con K por entidad calibrable por correlación de mitades, banda de error, y que lo
que está por debajo del mínimo "se sigue viendo, pero no se recomienda a partir de ella".

**Qué existe hoy (verificado en `main`, working tree):**
- `backend/lineups.py:lineup_stats` devuelve `sample{possessions, seconds}`, `games_used`, `games_excluded` y `metrics{oer, der,
  net_rating, efg_pct, ts_pct}` crudos: no hay nivel de muestra, ni ajuste, ni banda.
- `backend/lineups.py:onoff_stats` devuelve `on/off{possessions, seconds, …}` sin nivel de muestra; `diff` solo de tasas.
- `backend/clutch.py:team_clutch` devuelve `games_qualified`, `aggregate.possessions` sin nivel de muestra.
- `frontend/js/app.js:renderTeamLineup` (l.~996–1001) tiene un **umbral fijo en el código**: `r.sample.possessions < 10` →
  "Muestra chica (N posesiones) — tomar con cuidado". Contradice "ningún umbral fijo en el código" (T-02, F-13) y usa 10, no 15.
- `frontend/js/app.js:renderTeamOnOff` muestra "ON: N pos · M' en cancha" o "sin muestra" (solo cuando hay 0 posesiones).
- No existe enumeración de **todos** los quintetos de un equipo: la vista Equipo solo calcula la combinación que elige el
  usuario (3–5 jugadores). No hay tabla de quintetos ni tarjetas de líderes (llegan con F-06, fase 2).
- No existe configuración editable: F-13 crea `app_config`/`config.py` con las claves `sample.*`, `regression.*`,
  `sample.ppp_sd`, `sample.band_z` (arquitectura §3.2).
- Features anteriores: `sdd/specs/03-lineups` y `04-on-off` (motor `build_segments`, agregación pooled, semántica null de
  `08-nulos-vs-cero`: tasa con denominador 0 → `null`); `05-clutch` (cierres). Ninguna trató confiabilidad de muestra; 03-lineups
  dejó el aviso de "muestra chica" como paliativo.

**Qué queda para T-02:** la capa de muestra completa (niveles, umbral relativo, regresión, banda, exclusión de rankings,
calibración de K) como servicio de backend reutilizable, integrada en las entidades que existen en fase 1 (combinación de
jugadores, ON/OFF, cierres del equipo, y los badges de población de equipo y jugador que usa T-01), más la enumeración de todos
los quintetos del equipo que la calibración y el CA del cliente necesitan.

## 1. Objetivo
Que toda métrica derivada de posesiones se muestre con su muestra de respaldo y su nivel de confiabilidad, que las eficiencias
de muestras chicas se corrijan por regresión a la media con banda de error, y que ninguna entidad por debajo del mínimo entre
en rankings, tarjetas de líderes ni sugerencias.

## 2. Fuentes (trazabilidad)
- Especificación v2 §3 T-02 completo (Umbrales; Qué hacer con las muestras pequeñas; Criterio de aceptación); §1.3 S9
  (Umbrales de muestra); §6 Glosario ("Valor ajustado"); F-13 ("Umbrales de muestra y constante de regresión de T-02";
  "Ningún umbral debe quedar fijo en el código"); F-06 (reglas de quintetos líderes y de cierres por quinteto, consumidor).
- Arquitectura §2.1 (política pooled; prior de la regresión), §3.2 (claves `sample.*`, `regression.*`), §3.7 (módulo
  `sample.py`, fórmulas, calibración), §3.10 (`all_lineups`), §7.2 (badge), §7.1 (`adj`), §7.4 (nulos con razón), §7.8
  (errores), §9.2 I-10 (calibración por partidos alternos), §11 DA-15, DA-16, DA-18, DA-37.
- `docs/metrics.md` §Posesiones (`POS = 2PA + 3PA + 0,44·FTA + TOV − OR`), §Eficiencia (OER, DER, Net Rating).
- `docs/api.md` §`GET /api/lineup/<team_code>`, §`GET /api/onoff/<team_code>/<player_name>`, §`GET /api/clutch/<team_code>`.
- `docs/frontend.md` §Vistas → Equipo (paneles Combinación, ON/OFF, Cierres).
- `sdd/specs/03-lineups/spec.md`, `04-on-off/spec.md`, `05-clutch/spec.md`, `08-nulos-vs-cero/spec.md`.

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver junto a cada número derivado de posesiones cuántas posesiones, minutos y partidos lo
  respaldan y un nivel BAJA/MEDIA/ALTA, para saber cuánto confiar en él.
- US-2: Como entrenador, quiero que un quinteto de pocas posesiones no aparezca como el mejor, para no tomar decisiones sobre ruido.
- US-3: Como entrenador, quiero ver el valor crudo y el ajustado con su margen de error, para leer el dato sin esconderlo.
- US-4: Como analista, quiero que los umbrales y la constante K se configuren y se calibren con los datos cargados, para
  adaptarlos a una liga de 16 o de 33 partidos sin tocar el código.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE devolver, para toda entidad cuyas métricas derivan de posesiones (combinación de jugadores, ON/OFF,
  cierres del equipo) y para las entidades de población (equipo, jugador), un **badge de muestra** con: nivel, unidad, valor
  `n`, mínimo efectivo, nivel alto, origen del mínimo (absoluto o relativo), y las posesiones, minutos y partidos de respaldo
  (los tres siempre presentes; nulo con razón si no aplican). · (US-1; Esp. v2 §T-02 párr. 1; Arq. §7.2)
- RF-2: El sistema DEBE leer todos los umbrales de la configuración (F-13), con estos valores por defecto copiados de la
  tabla del cliente, y ninguno fijo en el código: · (US-4; Esp. v2 §T-02 Umbrales; F-13)

  | Entidad | Mínimo para mostrar | Muestra alta | Clave de configuración |
  |---|---|---|---|
  | Quinteto | 15 posesiones | 40 posesiones | `sample.lineup.min` / `.high` |
  | Pareja de jugadores | 30 posesiones | 80 posesiones | `sample.pair.min` / `.high` |
  | ON/OFF de jugador | 40 posesiones en cada estado | 120 posesiones | `sample.onoff.min` / `.high` |
  | Emparejamiento quinteto vs quinteto | 8 posesiones | 25 posesiones | `sample.matchup.min` / `.high` |
  | Split de contexto | 15 posesiones | 40 posesiones | `sample.split.min` / `.high` |
  | Tramo de reloj o zona de tiro | 10 intentos | 30 intentos | `sample.clock_zone.min` / `.high` |
  | Cierre de partido por quinteto | 2 posesiones del tramo | 3 partidos cerrados | `sample.clutch_lineup.min_poss` / `.high_games` |
  | Jugador (población de percentiles) | 60 minutos | 200 minutos | `sample.player.min` / `.high` |
  | Equipo (población de percentiles) | 3 partidos | 10 partidos | `sample.team.min` / `.high` |
- RF-3: El sistema DEBE asignar el nivel así: "BAJA por debajo del mínimo, MEDIA entre el mínimo y el nivel alto, ALTA por
  encima" — `baja` si `n < mínimo efectivo`; `media` si `mínimo efectivo ≤ n < alto`; `alta` si `n ≥ alto`. Unidad por
  entidad: posesiones (quinteto/combinación, pareja, ON/OFF, emparejamiento, split, cierres del equipo), intentos (tramo de
  reloj, zona de tiro), minutos (jugador), partidos (equipo). · (US-1; Esp. v2 §T-02; Arq. §3.7)
- RF-4: El sistema DEBE soportar el **umbral relativo**: "un porcentaje de las posesiones totales del equipo en la temporada
  (por ejemplo, 1,5% para quintetos), con el valor absoluto de la tabla como piso": `mínimo efectivo = max(mínimo absoluto,
  porcentaje/100 × posesiones ofensivas del equipo en la competencia y el contexto)`, activo solo si el umbral relativo está
  habilitado globalmente y la entidad tiene porcentaje definido (por defecto solo quintetos, 1,5 %). El badge informa si el
  mínimo vino del piso absoluto o del relativo. · (US-4; Esp. v2 §T-02; Arq. §3.7; DA-15)
- RF-5: En ON/OFF el sistema DEBE medir la muestra "en cada estado": `n` = el menor de las posesiones ON y OFF. · (US-1; Esp. v2 §T-02 tabla)
- RF-6: En cierre de partido por quinteto el sistema DEBE contar un partido solo si el quinteto jugó al menos el mínimo de
  posesiones del tramo, con nivel `baja` si los partidos contados son menos que el nivel alto y `alta` si alcanzan (sin
  `media`). En fase 1 se entrega la regla en el servicio; su pantalla la construye F-06. · (Esp. v2 §T-02 tabla, §F-06; Arq. §3.7)
- RF-7: El sistema DEBE aplicar **regresión a la media** en OER, DER y Net Rating de las entidades tipo quinteto (combinación,
  pareja, ON/OFF —cada estado—, emparejamiento, split —incluidos los cierres del equipo—, cierre por quinteto), con la fórmula
  del cliente: "valor_ajustado = (pos × valor + K × media_liga) / (pos + K)". `pos` = posesiones propias para OER y del rival
  para DER; `media_liga` (prior) = puntos por posesión de la competencia (Σ puntos / Σ posesiones de todos los equipo-partido de
  la competencia en el contexto); Net Rating ajustado = OER ajustado − DER ajustado (prior de Net = 0). K por entidad desde
  configuración, con los defaults del cliente "25 posesiones para quintetos, 50 para ON/OFF, 20 para splits" y 25 para pareja,
  emparejamiento y cierre por quinteto. Si el valor crudo es nulo, el ajustado es nulo con la misma razón. · (US-2, US-3;
  Esp. v2 §T-02, §6 "Valor ajustado"; Arq. §2.1, §3.7; DA-16)
- RF-8: El sistema DEBE devolver **el valor crudo y el ajustado** (con K y prior usados) de cada métrica regresada, y la UI
  DEBE mostrar ambos. · (US-3; Esp. v2 §T-02 "Se muestran el valor crudo y el ajustado")
- RF-9: El sistema DEBE devolver la **banda de error** (95 %) junto al ajustado: OER/DER `± z · σ / √(pos + K)`; Net Rating
  `± z · σ · √(1/(pos_of + K) + 1/(pos_def + K))`, con `z` y `σ` configurables (defaults 1,96 y 1,15). · (US-3; Esp. v2 §T-02
  "Banda de error"; Arq. §3.7; DA-16)
- RF-10: El sistema DEBE marcar cada entidad como rankeable solo si su nivel no es `baja`, y todo ranking de entidades tipo
  quinteto DEBE ordenarse por el valor **ajustado** ("todo ranking se ordena por el ajustado"). T-01 (población), F-06
  (tarjetas de líderes), F-14 (líderes) y F-15/F-03/A-10 (sugerencias) consumen esta marca. · (US-2; Esp. v2 §T-02)
- RF-11: "Por debajo del mínimo, la métrica se muestra en gris con la advertencia correspondiente y queda fuera de rankings,
  tarjetas de líderes y sugerencias automáticas. Se sigue viendo, pero no se recomienda a partir de ella." La UI DEBE mostrar
  el dato en gris con la advertencia, nunca ocultarlo. · (US-2; Esp. v2 §T-02)
- RF-12: El sistema DEBE ofrecer una **calibración de K** por correlación de mitades, ejecutable por un administrador para una
  entidad y una competencia: divide los partidos de cada unidad en dos mitades por paridad (partidos alternos), calcula OER en
  cada mitad, la correlación `r` entre unidades y `K sugerido = n̄_mitad · (1 − r) / r`. Devuelve el resultado sin modificar
  la configuración; la pantalla de Configuración ofrece "Aplicar", que guarda el K sugerido en la configuración. En fase 1:
  entidades quinteto y ON/OFF. · (US-4; Esp. v2 §T-02 "K no es un número arbitrario"; Arq. §3.7, §9.2 I-10)
- RF-13: El sistema DEBE poder enumerar **todos los quintetos** (y combinaciones de 3 o 4) de un equipo en una competencia y
  contexto, con su muestra y métricas, para la calibración y para verificar el CA del cliente; la tabla visible de quintetos
  la construye F-06. · (US-2; Esp. v2 §T-02 CA; Arq. §3.10)
- RF-14: El sistema DEBE integrar el badge, el ajustado y la banda en los paneles existentes de la vista Equipo
  (Combinación, ON/OFF, Cierres) y retirar el aviso fijo "Muestra chica" basado en 10 posesiones. · (US-1, US-3; Esp. v2 §T-02; F-13)
- RF-15: Cada cambio de umbral, K, σ o z en la configuración DEBE reflejarse en la siguiente consulta sin reiniciar el
  servidor. · (US-4; Esp. v2 §F-13; Arq. §3.2)

## 5. Requisitos de datos / API
Sin cambios de esquema (arquitectura §5). Consume `pbp_events`, `player_game_stats`, `team_game_stats`, `games.competition_id`
(F-11), `app_config` (F-13).

| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `app_config` (F-13) | tabla (lectura/escritura vía config) | claves `sample.*`, `regression.*`, `sample.ppp_sd`, `sample.band_z`, `sample.relative_enabled` | existe desde F-13 |
| `GET /api/metrics/<entity_type>` (T-05) | endpoint | `sample` (badge §7.2) completo para `team`, `player`, `lineup`, `onoff`, `clutch`; `metrics.oer/der/net_rating.adj = {value, k, prior, band}` en `lineup`, `onoff`, `clutch` | campos que agrega T-02 |
| `GET /api/team/<team_code>`, `GET /api/player/<team_code>/<player_name>` (bloque `standard`, T-05) | endpoint | `standard.sample` = badge de equipo (partidos) o jugador (minutos) | campos que agrega T-02 |
| `POST /api/settings/calibrate` | endpoint (admin) | body `{entity: "lineup"\|"onoff", competition: <id>}` → `{entity, competition_id, units, n_half_mean, r, k_suggested, k_current, method, warnings[]}`; 400 entidad no calibrable, 403 sin permiso de admin | **NUEVO** (arquitectura §6) → `docs/api.md` |
| `GET /api/lineup/<team_code>`, `GET /api/onoff/…`, `GET /api/clutch/…` (legado) | endpoint | sin cambios de shape (la UI pasa a leer el conjunto estándar de T-05) | — |

## 6. Estados de UI
Copy nuevo (vía `t()`, a agregar a `docs/frontend.md`) marcado con ★.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Badge de muestra (Combinación, ON/OFF, Cierres, cabecera de Equipo/Jugador) | hereda el spinner del panel | ★ "Sin muestra" (n = 0) | — (el badge no pide datos propios) | `/api/*` siempre a red (SW) | ★ "Muestra BAJA · 12 pos · 3 PJ · 18'" / "Muestra MEDIA …" / "Muestra ALTA …"; tooltip ★ "Mínimo 15 pos (piso absoluto) · alta desde 40" o ★ "Mínimo 30 pos (1,5 % de las posesiones del equipo)" |
| Métrica bajo el mínimo | — | — | — | — | valor en gris + ★ "Muestra baja: no entra en rankings ni recomendaciones" |
| Valor ajustado (OER/DER/Net) | — | — | — | — | ★ "1,08 crudo · 1,03 ajustado ± 0,36"; tooltip ★ "Ajustado hacia la media de la competencia (K = 25, media 1,02)" |
| ON/OFF | spinner existente | estado sin muestra: ★ "OFF: sin muestra" (reemplaza "sin muestra") | 404 existentes (copy de `docs/frontend.md`) | a red | badge del menor de los dos estados + ajustados por estado |
| Calibración de K (Configuración → Umbrales) | ★ "Calibrando…" (spinner) | ★ "No hay unidades suficientes para calibrar en esta competencia" | 403: ★ "Necesitás permisos de administrador"; 400: ★ "Calibración no disponible para esta entidad" | ★ "Sin conexión: no se puede calibrar" | ★ "K sugerido: 31 (r = 0,45 · 42 quintetos · 38 pos por mitad)" + botón ★ "Aplicar" → toast ★ "K actualizado" |

## 7. Criterios de aceptación
- CA-1 (CA del cliente): "la tabla de quintetos de un equipo devuelve un número útil de filas ordenables, y ninguna de las
  tarjetas de líderes está encabezada por una combinación de menos posesiones que el umbral." En fase 1 se verifica sobre la
  enumeración de quintetos del servicio: Given el equipo con más partidos del dataset de verificación, When se enumeran sus
  quintetos con la configuración por defecto, Then al menos 5 quedan con nivel `media` o `alta` y, ordenando por Net Rating
  ajustado solo entre los rankeables, el primero tiene `n ≥ mínimo efectivo`. La parte visual (tabla y tarjetas) se re-verifica
  en F-06 (INCREMENTO DIFERIDO).
- CA-2: Given una combinación con 12 posesiones, otra con 20 y otra con 45 y el umbral relativo deshabilitado, When se piden
  sus métricas, Then los badges dicen `baja`, `media` y `alta` respectivamente con `min = 15`, `high = 40`, `min_source = absoluto`.
- CA-3: Given un equipo con 2.000 posesiones ofensivas en la competencia y `sample.lineup.rel_pct = 1,5`, When se pide una
  combinación, Then `min = 30` y `min_source = relativo`; con un equipo de 600 posesiones, `min = 15` y `min_source = absoluto`.
- CA-4: Given `sample.lineup.min` cambiado a 25 desde Configuración, When se vuelve a pedir la misma combinación, Then el
  badge muestra `min = 25` sin reiniciar el servidor; y una búsqueda en el código de frontend no encuentra el umbral fijo de 10
  posesiones.
- CA-5: Given una combinación con OER crudo `v`, `pos` posesiones, `K = 25` y prior `p` (devueltos en `adj`), When se lee
  `adj.value`, Then es igual a `(pos·v + 25·p)/(pos + 25)` redondeado a 4 decimales, y `net_rating.adj.value =
  oer.adj.value − der.adj.value`.
- CA-6: Given dos combinaciones del mismo equipo con 15 y 60 posesiones, When se comparan sus bandas de OER, Then la de 15 es
  mayor y ambas cumplen `band = 1,96 · 1,15 / √(pos + 25)`.
- CA-7: Given un jugador que jugó todos los minutos de los partidos con pbp, When se pide su ON/OFF, Then OFF tiene 0
  posesiones, el badge es `baja` con `n = 0`, los ajustados de OFF son `null` (razón `sin_intentos`) y la UI no muestra `NaN`
  ni `Infinity`.
- CA-8: Given una combinación en nivel `baja`, When se abre el panel Combinación, Then los valores se ven en gris con la
  advertencia "Muestra baja: no entra en rankings ni recomendaciones", el dato no se oculta y se ven crudo, ajustado y banda.
- CA-9: Given un usuario administrador, When hace `POST /api/settings/calibrate {entity: "lineup", competition: <id>}`, Then
  recibe `units`, `n_half_mean`, `r`, `k_suggested` y `method = "partidos_alternos"`, y `GET /api/settings` sigue mostrando el K
  anterior hasta que presiona "Aplicar".
- CA-10: Given `ADMIN_USERS` definida y un usuario autenticado que no figura en ella, When llama a la calibración, Then
  recibe 403 con `code = requiere_admin`.
- CA-11: Given un equipo con cierres calificados, When se abre el panel Cierres, Then muestra el badge con las posesiones del
  tramo, los partidos calificados y el OER/DER/Net ajustados (entidad split, K = 20).
- CA-12: Given un equipo con 2 partidos y un jugador con 45 minutos en la competencia, When se piden sus conjuntos estándar,
  Then `sample.level = baja` con unidad `partidos` y `minutos` respectivamente (consumido por T-01 para la población).
- CA-13: Given una entidad sin partidos en la competencia seleccionada, When se pide, Then el badge tiene `n = 0`, nivel
  `baja` y las métricas vienen nulas con razón `sin_datos` (nunca 0).

## 8. Fuera de alcance
- Tabla visible de todos los quintetos y tarjetas de quintetos líderes — INCREMENTO DIFERIDO (→ F-06,
  [../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md)): F-06 consume `is_ranked` y el ajustado, y re-verifica el CA-1 en pantalla.
- Cierre por quinteto en pantalla (récord y badge especial) — INCREMENTO DIFERIDO (→ F-06).
- Badges de pareja (→ A-08), emparejamiento (→ F-07), split de la barra de contexto (→ T-03), tramo de reloj y zona (→ C-03, A-05):
  cada dueño llama al servicio con su entidad.
- Calibración por mitades de **posesiones** alternas — INCREMENTO DIFERIDO (→ A-01, [../../fase-3-contexto-posesion/01-A-01-motor-posesiones/](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)).
- σ empírico de puntos por posesión de la competencia — INCREMENTO DIFERIDO (→ A-01).
- Calibración de pareja, emparejamiento y split — con sus dueños (A-08, F-07, T-03).
- Percentiles, ranking y ficha (T-01). Exclusión en sugerencias automáticas: el servicio la provee; F-15, F-03, A-10 la aplican.

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] "Número útil de filas" (CA del cliente) no está cuantificado. Se propone: ≥ 5 quintetos
  con nivel `media` o `alta` para el equipo con más partidos del dataset de verificación. Con los 13 partidos del seed (pocos
  partidos por equipo) puede no alcanzarse con umbral 15: en ese caso se documenta en `progress.md` y se verifica con la segunda
  competencia de R-05.
- [DECISIÓN PROPUESTA — confirmar] Los **cierres del equipo** (panel Cierres) se tratan como entidad "split de contexto"
  (umbral 15/40 posesiones, K = 20), porque son el equipo filtrado por un tramo. El umbral "Cierre de partido por quinteto"
  es de F-06.
- [DECISIÓN PROPUESTA — confirmar] Las **combinaciones de 3 o 4 jugadores** (el panel actual permite 3–5) usan los umbrales y
  el K de quinteto.
- [DECISIÓN PROPUESTA — confirmar] Equipo y jugador llevan badge (partidos/minutos) pero **sin regresión**: el cliente limita
  la regresión a entidades pequeñas; equipos y jugadores entran en percentiles por umbral de población (T-01).
- [DECISIÓN PROPUESTA — confirmar] La calibración por mitades usa **partidos alternos** (el cliente pide dividir posesiones;
  eso requiere A-01). Unidades con menos del mínimo de la entidad quedan fuera; con menos de 10 unidades o `r ≤ 0` no se sugiere
  K y se devuelve la advertencia correspondiente.
- [DECISIÓN PROPUESTA — confirmar] El resultado de la calibración **no se persiste** (se recalcula a pedido); al aplicar, el K
  queda en la configuración con usuario y fecha (`app_config.updated_by/updated_at`), y la corrida sobre el dataset de
  verificación se registra en `progress.md`.
- [DECISIÓN HUMANA: DA-15] Umbral relativo solo para quintetos (1,5 %) hasta calibrar. [DECISIÓN HUMANA: DA-16] K = 25 para
  pareja, emparejamiento y cierre por quinteto; σ = 1,15. [DECISIÓN HUMANA: DA-18] Calibrar exige admin (sin `ADMIN_USERS`,
  todo usuario autenticado).
