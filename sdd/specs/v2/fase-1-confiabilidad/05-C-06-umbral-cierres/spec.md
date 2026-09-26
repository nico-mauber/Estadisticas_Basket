# Spec — C-06: Umbral de cierres de partido

> **ID:** C-06 · **Prioridad:** P1 · **Fase y orden:** 1·05
> **Depende de:** C-11 Grupo 0 (P-00) — [`../01-C-11-tratamiento-de-nulos/spec.md`](../01-C-11-tratamiento-de-nulos/spec.md) · F-11 (universo de competencia y constantes de período) — [`../02-F-11-calidad-datos-competencias/spec.md`](../02-F-11-calidad-datos-competencias/spec.md)
> **Habilita:** F-13, F-04, F-06
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §2 · C-06 y §1.3 S9 ([`../../00-especificacion-cliente-v2.md`](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.0, §1.1 (`clutch.py`), §1.5 D-09, §3.2 (`clutch.margin`, `clutch.window_secs`), §4, §6 ([`../../00-arquitectura-transversal.md`](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal):** *"Cambiar el criterio de partido cerrado de diferencia ≤ 15 a diferencia ≤ 10."* ·
*"Actualizar la leyenda de la sección y el recuento de partidos calificados y excluidos."* Criterio de aceptación: *"El
encabezado indica "CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)" y el conteo de partidos calificados se recalcula."* En §1.3 (S9 ·
Configuración) el "umbral de partido cerrado" figura entre las reglas de contexto editables (F-13), y F-13 exige que
*"ningún umbral debe quedar fijo en el código"*.

**Qué existe hoy (verificado):**
- Rama `main` (producción): el umbral es **15** en tres lugares: `backend/clutch.py` `team_clutch(games, team_code,
  team_name, margin=15)` (l.109), `backend/app.py` `clutch_team` (l.931–933: si falta `?margin` o es negativo → `15`) y
  `frontend/js/app.js` l.596 (título `'Cierres (últimos 5 min, dif ≤ 15)'` escrito a mano). `docs/api.md` l.309,
  `docs/architecture.md` l.75 y `docs/frontend.md` l.32 dicen 15. El `CLAUDE.md` local ya dice ≤ 10 (describe `dev`,
  arquitectura D-01).
- Rama `dev` (feature SDD 18 `18-etiquetas-y-umbrales`, se integra en el Grupo 0 de C-11): pasó el umbral a **10**, pero
  **sigue en tres lugares**: el default de `team_clutch(..., margin=10)`, el literal `margin = 10` de `clutch_team`
  (l.1036 en `dev`, con docstring que todavía dice "default 15") y la constante `CLUTCH_MARGIN_DEFAULT = 10` de
  `renderTeamClutch` en `app.js` (l.650 en `dev`), que usa para el título en los estados de carga y error. El título del
  estado de éxito ya sale de `d.margin`. En `dev`, `docs/api.md` (l.335, ejemplo con `"margin": 15`) y
  `docs/architecture.md` (l.75, `margin=15`) quedaron desactualizados.
- La ventana "últimos 5 minutos" es `CLUTCH_SECS = 300` en `clutch.py` (l.9); el "5 min" del título está escrito a mano.
- **Prórrogas mal detectadas (arquitectura D-09, R-16):** FIBA envía `period_type = "OVERTIME"` (con `period` reiniciado
  en 1), pero `clutch._is_clutch` (l.12) solo reconoce `"OT"`. Resultado: **los eventos de prórroga no entran en los
  cierres** en `main` ni en `dev`, aunque `docs/api.md` y el propio docstring dicen "+ prórrogas".
- **Recuento incompleto:** `team_clutch` descarta sin contarlos los partidos que califican por margen pero no tienen
  eventos de cierre de ambos equipos (`continue` sin sumar a ningún contador); `games_qualified + games_excluded` puede
  no coincidir con los partidos con play-by-play. Tampoco se informa cuántos partidos del equipo no tienen play-by-play.
- **Universo:** `app._team_pbp_games(team_code)` junta los partidos de **todas** las competencias; la card de Cierres
  ignora el filtro de competencia de la vista Equipo (que filtra el `game_log` en el cliente).

**Qué resolvieron features anteriores:** 05-clutch (cierres por equipo, calificación por margen al 5:00), 08-nulos-vs-cero
(tasas nulas con denominador 0) y la feature 18 de `dev` (umbral 10, título de éxito desde la respuesta).
**Qué queda para C-06 (delta sobre `dev`):** umbral y ventana en un único lugar del backend, listos para que F-13 los lea
de configuración; título completo (umbral y minutos) siempre leído de la respuesta; recuento completo y coherente;
prórrogas incluidas; universo por competencia; documentación sincronizada.

## 1. Objetivo
Que "partido cerrado" signifique diferencia ≤ 10 al entrar a los últimos 5 minutos, que la card de Cierres lo diga siempre
con los valores que usó el backend y que el recuento de partidos calificados y excluidos cierre sin huecos.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 · C-06 (requisito y CA), §1.3 S9 (reglas de contexto), §4 · F-13 ("ningún umbral fijo en el código").
- `docs/api.md` §`GET /api/clutch/<team_code>` (l.309–345: shape, calificación por ventana, `games_excluded`).
- `docs/architecture.md` §clutch.py (l.75). `docs/frontend.md` §Vista Equipo (l.32, apartado Cierres).
- `docs/metrics.md` (posesiones, OER/DER, eFG%, TS% usados por el agregado de cierres).
- `docs/database.md` §`pbp_events` (`period_type`, `clock_secs`, `s1`/`s2`).
- `sdd/specs/05-clutch/spec.md` §10 (ventana y calificación).
- `00-arquitectura-transversal.md` §1.0, §1.1, §1.5 D-01/D-09, §3.1 (resolución de competencia), §3.2 (claves
  `clutch.margin` y `clutch.window_secs`), §3.9 (`PERIOD_TYPES`), §4 (`clutch.py`), §6 (`GET /api/clutch/<team_code>`), §7.8.
- Spec de `dev`: `git show dev:sdd/specs/18-etiquetas-y-umbrales/spec.md` y `progress.md`.

## 3. Historias de usuario
- **US-1**: Como entrenador, quiero que un partido cuente como cerrado solo si la diferencia era de 10 o menos a falta de 5
  minutos, porque 15 puntos a esa altura no es un partido cerrado.
- **US-2**: Como entrenador, quiero que el encabezado de Cierres diga exactamente qué criterio se usó, para leer los números
  sabiendo qué incluyen.
- **US-3**: Como analista, quiero saber cuántos partidos entraron, cuántos quedaron afuera y por qué, para juzgar si la
  muestra alcanza.
- **US-4**: Como entrenador, quiero que las prórrogas cuenten dentro del cierre, porque son la parte más apretada del partido.
- **US-5**: Como analista, quiero que Cierres respete la competencia elegida en Equipo, para no mezclar torneos.

## 4. Requisitos funcionales
- **RF-1**: El sistema DEBE considerar "partido cerrado" al que llega a la ventana de cierre con diferencia absoluta de
  marcador ≤ 10 puntos (valor por defecto). (US-1) (Esp. v2 §C-06) (docs/api.md §clutch "Calificación por ventana")
- **RF-2**: El umbral (10) y la ventana (300 s) DEBEN definirse en un único lugar del backend, del que los lean la ruta y
  el cálculo; ni la ruta ni el frontend DEBEN contener esos números. El único lugar DEBE poder reemplazarse por la lectura
  de configuración de F-13 sin tocar consumidores. (US-2) (Esp. v2 §C-06, §F-13) (Arquitectura §3.2)
- **RF-3**: La respuesta de cierres DEBE informar el umbral y la ventana efectivamente usados (`margin`, `window_secs`).
  (US-2) (docs/api.md §clutch)
- **RF-4**: El encabezado de la sección DEBE construirse con esos dos valores de la respuesta: "Cierres (últimos {minutos}
  min, dif ≤ {margen})", que la UI muestra en mayúsculas ("CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)"). Antes de tener respuesta
  (carga o error) el encabezado DEBE decir solo "Cierres", sin números. (US-2) (Esp. v2 §C-06 CA)
- **RF-5**: La respuesta DEBE informar el recuento completo de partidos del equipo en el universo: con play-by-play, sin
  play-by-play, calificados, excluidos por diferencia mayor al umbral y sin eventos de cierre de ambos equipos, cumpliendo
  calificados + excluidos + sin eventos = con play-by-play, y con play-by-play + sin play-by-play = total. (US-3) (Esp. v2
  §C-06 "recuento de partidos calificados y excluidos")
- **RF-6**: La UI DEBE mostrar ese recuento junto al encabezado ("N calificado(s) · M excluido(s) por diferencia mayor a
  {margen} …") y el estado vacío DEBE usar el umbral y la ventana de la respuesta. (US-3) (Esp. v2 §C-06)
- **RF-7**: La ventana de cierre DEBE incluir todos los eventos de prórroga, reconociendo el tipo de período que envía
  FIBA (`OVERTIME`) y el legado `OT`. (US-4) (docs/api.md §clutch "+ prórrogas") (Arquitectura D-09)
- **RF-8**: El endpoint DEBE aceptar el parámetro de competencia (`competition=<id>` | `all` | string legado) con la
  resolución de la arquitectura §3.1, calcular solo con los partidos de ese universo e informar la competencia usada; la
  card DEBE pedir los cierres con la competencia elegida en Equipo ("Todas" → `all`). (US-5) (Arquitectura §3.1, §6)
- **RF-9**: El endpoint DEBE seguir aceptando `?margin=<n>` y aceptar `?window_secs=<n>`, validando rangos (margen 0–40,
  ventana 60–600 s, los de `CONFIG_SPEC`); fuera de rango → error 400 con mensaje en español. (US-2) (Arquitectura §3.2, §7.8)
- **RF-10**: Las tasas del agregado y de cada partido DEBEN seguir siendo nulas cuando su denominador es 0 (sin
  posesiones, sin intentos), nunca 0. (US-3) (Esp. v2 §C-11) (docs/metrics.md) (sdd/specs/08-nulos-vs-cero)

## 5. Requisitos de datos / API
| Tabla / endpoint | Cambio | ¿Nuevo? |
|---|---|---|
| `pbp_events` (`period`, `period_type`, `clock_secs`, `s1`, `s2`, `team_code`, …) | Solo lectura | No |
| `games.competition_id` | Solo lectura (lo crea F-11) | No (F-11) |
| `GET /api/clutch/<team_code>` (mod.) | Default `margin` 10 desde el único lugar (RF-2); nuevo query `window_secs`; query `competition`; respuesta + `window_secs`, `competition`, `games_total`, `games_with_pbp`, `games_without_pbp`, `games_without_clutch_events`; `per_game[].overtime_periods`; eventos `OVERTIME` en la ventana; errores 400 de validación | Campos nuevos (PROPUESTA, ver §9) |

Errores (formato arquitectura §7.8): 404 `no_encontrado` "Equipo no encontrado" (existente) · 404 `no_encontrado` "El
equipo no tiene partidos en la competencia seleccionada." (NUEVO) · 404 `sin_pbp` "Equipo sin play-by-play. Reimportá sus
partidos." (existente) · 400 `parametro_invalido` (NUEVO, RF-9) · 400 `competencia_inexistente` (resolución F-11).
Sin cambios de esquema.

## 6. Estados de UI
| Vista / componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Equipo — card "Cierres" | título "Cierres" + "Calculando cierres..." (existente) | 0 calificados: "Sin cierres apretados: los {e} partido(s) con play-by-play se definieron por más de {margen} al minuto {mm:ss}." (copy existente, parametrizado con la ventana) | título "Cierres" + mensaje del backend o "No se pudieron cargar los cierres" (existente) | mensaje de error de red de `api.js` (existente) | título "Cierres (últimos {min} min, dif ≤ {margen})" + competencia + recuento + agregado + tabla por partido |

**Copy nuevo** (vía `t()`, a `docs/frontend.md`): título base "Cierres"; título completo "Cierres (últimos {min} min,
dif ≤ {margen})"; recuento "{q} calificado(s) · {e} excluido(s) por diferencia mayor a {margen}"; segmentos opcionales
" · {s} sin eventos de cierre" y " · {n} sin play-by-play"; columna "PR" (prórrogas) en la tabla por partido; error 404
"El equipo no tiene partidos en la competencia seleccionada."

## 7. Criterios de aceptación
- **CA-1 (CA del cliente)**: Given la vista Equipo, When se abre la card de Cierres, Then el encabezado indica "CIERRES
  (ÚLTIMOS 5 MIN, DIF ≤ 10)" y el conteo de partidos calificados se recalcula.
- **CA-2**: Given un equipo con algún partido que llegó al 5:00 con diferencia entre 11 y 15 (HYM en el seed), When se
  compara `GET /api/clutch/HYM?margin=15` con `GET /api/clutch/HYM`, Then ese partido pasa de calificado a excluido
  (`games_qualified` baja y `games_excluded` sube en la misma cantidad).
- **CA-3**: Given cualquier equipo, When se pide `/api/clutch/<code>`, Then `games_qualified + games_excluded +
  games_without_clutch_events == games_with_pbp` y `games_with_pbp + games_without_pbp == games_total`.
- **CA-4**: Given el backend devolviendo otro umbral o ventana (`?margin=8&window_secs=180` en la prueba de la ruta, o
  cambiando la constante única), When se lee la respuesta, Then `margin` y `window_secs` reflejan esos valores; y el título
  de la card se construye solo con los valores de la respuesta (búsqueda: ningún literal `10`, `15` ni `300` asociado a
  cierres en `app.js` ni en la ruta).
- **CA-5**: Given un partido del seed con prórroga y diferencia ≤ 10 al 5:00 del último cuarto, When se consulta el cierre
  de uno de sus equipos, Then `per_game` de ese partido tiene `overtime_periods ≥ 1` y sus `pts`/`opp_pts` incluyen los
  puntos de la prórroga (coinciden con la suma de eventos de pbp del último cuarto con reloj ≤ 5:00 más los `OVERTIME`).
- **CA-6**: Given `?margin=50` o `?margin=abc` o `?window_secs=30`, When se llama al endpoint, Then responde 400 con
  `code: "parametro_invalido"` y mensaje en español.
- **CA-7**: Given una base con dos competencias y la vista Equipo con una elegida, When se abre Cierres, Then la respuesta
  trae `competition.id` de esa competencia y `games_total` igual a los partidos del equipo en ella; con "Todas", la card
  pide `competition=all`.
- **CA-8**: Given un equipo cuyos partidos no tienen play-by-play, When se abre Cierres, Then se muestra "Equipo sin
  play-by-play. Reimportá sus partidos." (404 `sin_pbp`).
- **CA-9**: Given un cierre calificado sin tiros de un equipo (denominador 0), When se lee el agregado o la fila, Then
  `efg_pct`/`ts_pct` son `null` y la UI muestra "—", nunca 0.
- **CA-10**: Given la card en carga o con error, When se observa el encabezado, Then dice solo "CIERRES", sin umbral.
- **CA-11**: Given el recorrido de Equipo (desktop y 360 px), When se abre Cierres, Then no hay errores en consola y el
  encabezado no desborda.

## 8. Fuera de alcance
- Editar el umbral y la ventana desde la UI: **INCREMENTO DIFERIDO (→ F-13)** — F-13 crea `config.py` con `clutch.margin`
  y `clutch.window_secs` y el único lugar de C-06 pasa a leer `config.get(...)`
  ([`../12-F-13-configuracion/spec.md`](../12-F-13-configuracion/spec.md)).
- Filtro "últimos N partidos" y demás dimensiones de contexto en Cierres: **INCREMENTO DIFERIDO (→ T-03)**
  ([`../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md`](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)).
- Conjunto estándar de métricas en Cierres (tipo de entidad `clutch`) y migración de `_box_metrics` a
  `stats_engine.compute_standard`: **INCREMENTO DIFERIDO (→ T-05)**
  ([`../13-T-05-conjunto-estandar-metricas/spec.md`](../13-T-05-conjunto-estandar-metricas/spec.md)); badge de muestra (→ T-02);
  tabla exportable `clutch_games` (→ T-06).
- Cierres por quinteto (F-06) y estadísticas por cuarto (F-04), que reutilizan la ventana.
- Cambiar la regla de calificación (marcador al entrar al cierre) o la definición de ventana (último cuarto regular con
  reloj ≤ 5:00 + prórrogas).

## 9. Ambigüedades
- **[DECISIÓN PROPUESTA — confirmar] "Recuento de partidos calificados y excluidos".** Se amplía la respuesta con
  `games_total`, `games_with_pbp`, `games_without_pbp` y `games_without_clutch_events`, y se conserva `games_excluded` con
  su semántica actual (excluidos por diferencia), para no romper a quien lo lea. Así el recuento cierra (RF-5). Los campos
  nuevos no figuran en la arquitectura §6 ("shape actual"): se agregan como PROPUESTA sobre un endpoint del que C-06 es
  dueño.
- **[DECISIÓN PROPUESTA — confirmar] "5 MIN" del encabezado.** También sale de la respuesta (`window_secs / 60`), porque
  F-13 hace configurable la ventana (`clutch.window_secs`); con 300 s se lee "5 min". Una ventana no entera en minutos se
  muestra con coma decimal ("1,5 min").
- **[DECISIÓN PROPUESTA — confirmar] Prórrogas.** Se corrigen dentro de C-06 (arquitectura D-09/R-16): sin la corrección
  el recuento "se recalcula" pero el contenido de los cierres de partidos con prórroga es incorrecto.
- **[DECISIÓN PROPUESTA — confirmar] Validación estricta de `margin`.** Hoy un `margin` negativo o no numérico cae al
  default en silencio; pasa a 400 (arquitectura §7.8). Ningún consumidor actual envía `margin`.
- **[DECISIÓN PROPUESTA — confirmar] Dependencia de F-11.** El universo por competencia (`repository`) y las constantes de
  período (`PERIOD_TYPES`) los crea F-11 (orden 02, antes que C-06); se agrega F-11 a "Depende de" aunque la arquitectura
  §9.1 solo lista C-11.
