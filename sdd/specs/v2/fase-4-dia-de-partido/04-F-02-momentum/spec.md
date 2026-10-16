# Spec — F-02: Pestaña Momentum

> **ID:** F-02 · **Prioridad:** P1 · **Fase y orden:** Fase 4 — Día de partido · 04
> **Depende de:** F-01 ([../03-F-01-partido-en-vivo/](../03-F-01-partido-en-vivo/spec.md)) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md)) · A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md))
> **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-02 y §1.3 S5 · modo Momentum ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.2 (claves `momentum.*`), §3.9, §3.17, §4, §6, §8 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §F-02):**
- "Dentro de la vista de partido. Muestra únicamente lo que está cambiando el partido en ese momento, no el acumulado."
- Equipo: "Racha actual (parcial abierto)"; "Últimas 10 posesiones: PPP"; "Últimos 5 minutos: OER, DER y Net Rating";
  "Últimas 5 posesiones con su desenlace: tiro, asistencia, pérdida, rebote ofensivo, triple".
- Jugadores calientes y fríos: "3 conversiones consecutivas"; "8 o más puntos en los últimos 3 minutos"; "4 asistencias
  consecutivas del equipo con ese jugador como asistente"; "3 rebotes ofensivos en el cuarto"; "3 pérdidas consecutivas
  (alerta)".
- "Las reglas y sus umbrales deben quedar en configuración, no fijos en el código."

Y §1.3 S5: modo Momentum, "durante el partido", contenido "Racha, últimas 10 posesiones, últimos 5 minutos, jugadores
calientes y alertas".

**Por qué:** distingue lo que "está cambiando el partido en ese momento" del acumulado que ya muestra En vivo (F-01): sirve
para decisiones instantáneas (pedir tiempo muerto, hacer un cambio) durante los pocos minutos en que algo se está
inclinando.

**Qué existe HOY verificado en código:** nada. No hay ningún cálculo de racha, ventana móvil de posesiones/minutos ni
detección de rachas de jugador en `main` ni en `dev` (el Bloque C no toca esto). No hay tabla ni endpoint relacionado.

**Qué resuelven requisitos anteriores (supuestos de esta spec):** F-01 crea `live.py` (`live_snapshot`, caché TTL,
detección de fin de partido) y la infraestructura de polling del cliente — F-02 reutiliza exactamente la misma fuente de
datos, sin volver a descargar ni volver a parsear el JSON de FIBA. A-01 crea `possessions.py` (`game_possessions(game_id)`,
`Possession`/`Chance` con `pts`, `end_type`, `finisher_id`, `assister_id`, `turnover_by_id`) — el motor sobre el que F-02
calcula PPP de últimas 10 posesiones, últimas 5 con desenlace y las rachas de conversión. F-13 crea `config.py`
(`CONFIG_SPEC`, `config.get`) y ya cataloga las 10 claves `momentum.*` (Arquitectura §3.2) que esta spec consume, no
redefine.

**Qué queda (esta spec):** el cálculo de racha (parcial abierto), las tres ventanas (10 posesiones, 5 minutos, últimas 5
posesiones con desenlace) y las cinco reglas de jugador caliente/frío/alerta, todo sobre el snapshot en vivo de F-01, y la
pestaña Momentum dentro de S5 · Partido.

## 1. Objetivo

Mostrar, dentro de la vista de un partido en curso, únicamente lo que está cambiando el partido en ese momento: la racha
abierta, la eficiencia de las últimas posesiones y minutos, y qué jugadores están calientes, fríos o en alerta según
reglas con umbrales configurables — sin repetir el acumulado que ya muestra En vivo.

## 2. Fuentes (trazabilidad)

- Especificación v2 §4 F-02 (requisito completo, literal arriba), §1.3 S5 (modo Momentum), §S9 "Reglas de Momentum:
  Umbrales de jugador caliente y de alerta" (F-02 los usa, F-13 los cataloga), §6 glosario (PPP, OER, DER, Net Rating).
- `docs/database.md`: no aplica (F-02 no toca esquema ni persiste nada).
- `docs/api.md`: no existe ningún endpoint de momentum (F-02 lo crea, NUEVO).
- Arquitectura §3.2 (catálogo completo de claves `momentum.*` con sus defaults y rangos, ya fijadas — F-02 no las
  redefine, las consume), §3.9 (A-01: `Possession`, `Chance`, `game_possessions`), §3.17 (F-01: fuente de datos en vivo,
  polling, caché TTL), §4 (`live.py` como consumidor/base, ningún módulo `momentum.py` listado explícitamente — ver §9
  ambigüedad sobre dónde vive el código), §6 (`GET /api/live/<game_id>/momentum`), §8 (`components/game-view.js`, que F-02
  extiende con un bloque nuevo, no reemplaza).
- Specs previas de esta fase: `../03-F-01-partido-en-vivo/spec.md`/`plan.md` (`live_snapshot`, snapshot en vivo, polling).

## 3. Historias de usuario

- US-1: Como entrenador, quiero ver la racha actual del partido (parcial abierto), para decidir si pido un tiempo muerto
  ahora mismo.
- US-2: Como entrenador, quiero ver la eficiencia de las últimas posesiones y de los últimos minutos, para juzgar si lo
  que estoy viendo en cancha es una tendencia real o ruido de corto plazo.
- US-3: Como entrenador, quiero saber qué jugador está caliente (para buscarle más volumen) o frío/en alerta (para
  considerar un cambio), sin tener que hacer la cuenta mental durante el partido.
- US-4: Como equipo de desarrollo, queremos que los umbrales de estas reglas sean configurables, para poder ajustarlos sin
  tocar código si la experiencia de uso lo pide.

## 4. Requisitos funcionales

**Ubicación y fuente de datos**
- RF-1: El sistema DEBE mostrar la pestaña Momentum dentro de S5 · Partido (`#/partido/<game_id>/momentum`), disponible
  para partidos en curso y, con el mismo criterio que F-01 RF-5, también para partidos ya finalizados (mostrando el estado
  final de las ventanas móviles calculado sobre el último tramo del partido). · (US-1, US-2, US-3) (Esp. v2 §1.3 S5 modo
  Momentum "durante el partido")
- RF-2: El sistema DEBE calcular todo lo de esta pestaña a partir de la misma fuente de datos que F-01 (`live.live_snapshot`
  o los datos persistidos si el partido ya finalizó), sin volver a descargar ni volver a parsear el JSON de FIBA por
  separado. · (US-4) (Arquitectura §3.17 "una sola descarga por intervalo para todos los usuarios"; DA-27)
- RF-3: El sistema DEBE actualizarse en el mismo ciclo de refresco que En vivo (F-01, máximo 60 s, `live.poll_secs`), sin
  un polling adicional independiente. · (US-1) (Esp. v2 §F-02 "durante el partido"; reutiliza F-01 RF-2)

**Racha (parcial abierto)**
- RF-4: El sistema DEBE mostrar la **racha actual** (parcial abierto): puntos consecutivos de un mismo equipo sin que el
  rival anote, con el equipo, el conteo (ej. "8-0") y desde cuándo (tiempo de juego transcurrido desde el primer punto de
  la racha). Una racha de 0-0 (el rival acaba de anotar, sin racha abierta) se muestra como "Sin racha abierta". · (US-1)
  (Esp. v2 §F-02 "Racha actual (parcial abierto)")

**Ventanas móviles de equipo**
- RF-5: El sistema DEBE mostrar el **PPP de las últimas `momentum.last_possessions` posesiones** (config, default 10,
  rango 3–30) de cada equipo, calculado sobre `possessions.game_possessions(game_id)` filtradas a las últimas N por
  `poss_id` descendente (excluidas las incompletas, C-11). · (US-2) (Esp. v2 §F-02 "Últimas 10 posesiones: PPP"; F-13
  "Reglas de Momentum")
- RF-6: El sistema DEBE mostrar **OER, DER y Net Rating de los últimos `momentum.window_secs` segundos** (config, default
  300 s = 5 min, rango 60–600) de tiempo de juego transcurrido (no de reloj real: se excluyen pausas), calculado sobre las
  posesiones cuyo `start_clock`/período cae dentro de esa ventana. · (US-2) (Esp. v2 §F-02 "Últimos 5 minutos: OER, DER y
  Net Rating")
- RF-7: El sistema DEBE listar las **últimas `momentum.last_outcomes` posesiones** (config, default 5, rango 3–10) de cada
  equipo con su desenlace: tiro (2/3 puntos, convertido/fallado), asistencia (si hubo), pérdida, rebote ofensivo (si la
  posesión tuvo una segunda oportunidad), triple (marcado explícitamente si `end_type` fue `t3c`). · (US-2) (Esp. v2 §F-02
  "Últimas 5 posesiones con su desenlace: tiro, asistencia, pérdida, rebote ofensivo, triple")

**Jugadores calientes y fríos**
- RF-8: El sistema DEBE marcar a un jugador como **caliente** si cumple, en la ventana correspondiente, cualquiera de:
  (a) `momentum.hot_consecutive_makes` (default 3, rango 2–10) conversiones de campo consecutivas sin fallo intermedio;
  (b) `momentum.hot_points` (default 8, rango configurable) o más puntos en los últimos `momentum.hot_points_window_secs`
  (default 180 s) de tiempo de juego; (c) `momentum.assist_streak` (default 4, rango 2–10) asistencias consecutivas del
  equipo con ese jugador como asistente (canastas consecutivas del equipo todas asistidas por el mismo jugador, sin
  canasta sin asistir o asistida por otro en el medio); (d) `momentum.oreb_in_quarter` (default 3, rango 2–10) rebotes
  ofensivos en el cuarto en curso. · (US-3) (Esp. v2 §F-02 "3 conversiones consecutivas… 8 o más puntos… 4 asistencias
  consecutivas… 3 rebotes ofensivos en el cuarto")
- RF-9: El sistema DEBE marcar a un jugador en **alerta** (frío) si acumula `momentum.cold_consecutive_tov` (default 3,
  rango 2–10) pérdidas consecutivas (sin otro evento de balón exitoso del mismo jugador en el medio). · (US-3) (Esp. v2
  §F-02 "3 pérdidas consecutivas (alerta)")
- RF-10: Cada jugador puede tener **múltiples** marcas simultáneas (ej. caliente por conversiones Y por asistencias); la
  vista DEBE mostrar todas las marcas vigentes de cada jugador, no solo la primera detectada. · (US-3) (Esp. v2 §F-02,
  reglas independientes entre sí)
- RF-11: Todos los umbrales de RF-8/RF-9 DEBEN leerse de `config.get("momentum.<clave>")` (F-13), nunca fijos en el
  código. · (US-4) (Esp. v2 §F-02 "Las reglas y sus umbrales deben quedar en configuración, no fijos en el código")

**Nulos y casos borde**
- RF-12: Un partido sin play-by-play (o con play-by-play insuficiente para alguna ventana, ej. menos de
  `momentum.last_possessions` posesiones jugadas en todo el partido) DEBE mostrar esa ventana con su estado vacío
  explícito ("Aún no hay suficientes posesiones para esta ventana"), nunca un valor calculado sobre una muestra parcial
  presentado como si fuera completo. · (Esp. v2 §C-11) (Arquitectura §7.4)
- RF-13: Al cambio de cuarto o al inicio del partido, las ventanas de tiempo (RF-6, `momentum.hot_points_window_secs`, la
  regla de rebotes "en el cuarto") DEBEN recalcularse sobre el tiempo de juego real transcurrido, sin arrastrar eventos de
  un cuarto anterior en la regla "rebotes ofensivos en el cuarto" (RF-8d) — esa regla reinicia su conteo en cada cambio de
  período. · (Esp. v2 §F-02 "3 rebotes ofensivos en el cuarto")

## 5. Requisitos de datos / API

| Tabla / endpoint | Uso | Estado |
|---|---|---|
| Ninguna tabla — cálculo on-the-fly sobre `live.live_snapshot` (F-01) y `possessions.game_possessions` (A-01) | todo el bloque | on-the-fly, sin persistencia (Constitución 4) |
| `GET /api/live/<game_id>/momentum` | racha, ventanas de equipo, jugadores calientes/fríos | **NUEVO** (Arquitectura §6, dueño F-02) |
| Claves de configuración `momentum.last_possessions`, `momentum.window_secs`, `momentum.last_outcomes`, `momentum.hot_consecutive_makes`, `momentum.hot_points`, `momentum.hot_points_window_secs`, `momentum.assist_streak`, `momentum.oreb_in_quarter`, `momentum.cold_consecutive_tov` | umbrales de todas las reglas | ya catalogadas (Arquitectura §3.2), dueño F-02 en el catálogo, expuestas por F-13 en `CONFIG_SPEC`/`GET /api/settings` |

Sin tablas ni columnas nuevas (Arquitectura §5: F-01…F-09 sin cambios de esquema). Errores: `404 no_encontrado` (`game_id`
inexistente, mismo criterio que F-01), `502 fiba_no_disponible` (heredado de F-01 si el snapshot no se pudo obtener).

## 6. Estados de UI

Vista: S5 Partido · modo Momentum (`#/partido/<game_id>/momentum`). Copy nuevo (marcar para `docs/frontend.md`), siempre
vía `t()`.

| Bloque | loading | vacío / sin datos | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Vista completa | spinner "Cargando momentum…" | — | heredado de F-01 (404/502) | heredado de F-01 | bloques de racha + ventanas + jugadores |
| Racha actual | — | "Sin racha abierta" (el rival acaba de anotar) | — | — | "Racha 8-0 de {equipo} (últimos 2:14)" |
| Últimas N posesiones (PPP) | skeleton | "Aún no hay suficientes posesiones para esta ventana." | — | — | PPP de cada equipo con la ventana indicada ("Últimas 10 posesiones") |
| Últimos 5 minutos (OER/DER/Net) | skeleton | ídem | — | — | tabla comparativa de ambos equipos |
| Últimas 5 posesiones con desenlace | skeleton | ídem | — | — | lista cronológica con ícono por desenlace |
| Jugadores calientes/fríos | skeleton | "Ningún jugador cumple las reglas de Momentum en este momento." | — | — | tarjetas por jugador con sus marcas vigentes (🔥/🧊) |

Mobile (<768 px): mismo criterio que F-01/F-07 (bloques apilados, scroll horizontal en pestañas internas si hiciera falta
dentro de esta pestaña; en la práctica el contenido de Momentum es compacto y cabe en una columna).

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: Given un partido en curso, When se abre la pestaña Momentum, Then se muestra únicamente lo
  que está cambiando el partido en ese momento (racha, últimas 10 posesiones, últimos 5 minutos, jugadores calientes y
  alertas), no el acumulado completo del partido (que vive en En vivo, F-01).
- CA-2: Given una secuencia de 8 puntos consecutivos de un equipo sin respuesta del rival, When se consulta la racha,
  Then se muestra "8-0" a favor de ese equipo con el tiempo transcurrido desde el primer punto.
- CA-3: Given un jugador con 3 conversiones de campo consecutivas sin fallo intermedio, When se consulta el bloque de
  jugadores, Then aparece marcado como caliente por esa regla específica.
- CA-4: Given un jugador con 3 pérdidas consecutivas, When se consulta el bloque de jugadores, Then aparece marcado en
  alerta.
- CA-5: Given un jugador que cumple simultáneamente la regla de conversiones consecutivas y la de asistencias
  consecutivas, When se lo consulta, Then aparecen ambas marcas, no solo una.
- CA-6: Given que se cambia `momentum.hot_consecutive_makes` de 3 a 5 en Configuración (F-13), When se vuelve a consultar
  el bloque de jugadores en la siguiente carga, Then un jugador con exactamente 3 conversiones consecutivas deja de
  aparecer como caliente por esa regla.
- CA-7: Given un partido recién comenzado (menos de `momentum.last_possessions` posesiones jugadas), When se abre
  Momentum, Then el bloque de últimas N posesiones muestra su estado vacío explícito, sin calcular un PPP sobre una
  muestra parcial sin avisarlo.
- CA-8: Given el cambio de cuarto, When se consulta la regla "3 rebotes ofensivos en el cuarto", Then el conteo se
  reinicia en 0 al comenzar el nuevo cuarto.
- CA-9: Given `GET /api/live/<game_id>/momentum` con un `game_id` inexistente, When se lo llama, Then responde 404
  `{"error": "Partido no encontrado", "code": "no_encontrado"}` (mismo criterio que F-01).

## 8. Fuera de alcance

- Notificaciones push o alertas sonoras cuando un jugador se pone caliente/frío: no pedido.
- Historial de momentum de partidos pasados (esta spec es solo del partido en curso o su último estado si ya finalizó);
  un análisis histórico de rachas por temporada no está pedido aquí.
- Reglas adicionales de "frío" simétricas a las de "caliente" (ej. fallos consecutivos de tiro) que el cliente no pidió:
  solo se implementan las 5 reglas listadas literalmente en la especificación (RF-8, RF-9).
- Configuración de nuevas reglas desde la UI (agregar una regla no prevista): F-13 permite ajustar los **valores** de los
  umbrales existentes, no crear reglas nuevas.
- Barra de contexto T-03 en esta vista: igual que F-01, un partido puntual no expone splits.

## 9. Ambigüedades

- [DECISIÓN PROPUESTA — confirmar] El módulo de cálculo se llama `backend/momentum.py` (NUEVO, no listado explícitamente
  en el mapa de módulos de la Arquitectura §4, que solo asigna el endpoint `GET /api/live/<game_id>/momentum` a F-02 sin
  nombrar su módulo interno). Se marca `PROPUESTA (no está en 00-arquitectura-transversal.md)` únicamente en el **nombre
  del archivo**; el endpoint, el dueño y el shape de respuesta ya están fijados por la arquitectura.
- [DECISIÓN PROPUESTA — confirmar] "Racha actual" (RF-4) se calcula sobre el pbp del partido en curso (eventos de
  anotación en orden), no sobre las `Possession` de A-01, porque una racha puede cruzar el límite de una posesión
  incompleta sin que eso deba cortar la racha (ej. una posesión con hueco de datos entre dos canastas del mismo equipo no
  debería "resetear" visualmente la racha si el pbp muestra la secuencia de puntos continua). Si A-01 marca la posesión
  intermedia como incompleta, la racha se corta igual por precaución (C-11: no se asume continuidad sobre datos con
  huecos) — este caso es infrecuente (0,33% de posesiones con hueco medido en el prototipo, Arquitectura §1.6).
- [DECISIÓN PROPUESTA — confirmar] "Últimos 5 minutos" (RF-6) se mide en tiempo de juego transcurrido (excluye tiempos
  muertos y descansos), consistente con cómo A-01 mide duración de posesión; no es un temporizador de reloj real de
  pared, que sería inconsistente con "5 minutos" de un deporte con reloj de partido.
- [NEEDS CLARIFICATION] El cliente no aclara qué pasa con la regla de "4 asistencias consecutivas del equipo con ese
  jugador como asistente" si el equipo anota 4 veces seguidas pero dos de esas canastas no tienen asistencia registrada
  (ej. un lay-up en transición sin pase previo): se asume que una canasta sin asistencia **corta** la racha de asistencias
  del jugador (no cuenta ni a favor ni la deja pasar), porque la racha exige que las 4 consecutivas sean **asistidas por
  el mismo jugador**, no solo que el equipo anote 4 veces. Confirmar con el cliente si una canasta no asistida debe
  cortarla o simplemente no contar (saltarla y seguir la racha).
