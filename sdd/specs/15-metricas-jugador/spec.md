# Spec — Feature 15: métricas de jugador (indicadores por posesión/minuto, rebote individual y AS/PER)

> **Requisitos C-01 y C-04** (`Smart-Basket Especificacion v2.docx` §1, P0/P1). Corte y orden:
> `sdd/ROADMAP-bloque-C.md` §2 y §4 — se especifica **después** de cerrar la Feature 14, según §3.2.

## 1. Objetivo
Que el perfil de jugador tenga los cinco indicadores normalizados por posesión y por minuto que hoy
no existen, que su porcentaje de rebote se calcule con la fórmula individual en vez de quedar vacío,
y que AS/PER tenga una definición única y verificable contra el box score.

## 2. Fuentes (trazabilidad)

**Requisito del cliente (C-01, P0):**
- *"Revisar el cálculo de AS/pos, PER/pos, PTS/pos, RO/min y RD/min."*
- *"Hoy en el perfil de jugador OR% y DR% se muestran vacíos ('—') con Ø 0.0%: verificar si es dato faltante o error de cálculo, y aplicar la regla de nulos de C-11."*
- CA: *"Los cinco indicadores devuelven valor numérico coherente para todo jugador con minutos disputados."*

**Requisito del cliente (C-04, P1):**
- *"Revisar el cálculo y su presentación. Definir explícitamente si es AS/PER por partido o acumulado de temporada, y usar el mismo criterio en equipo y en jugador."*
- CA: *"El valor coincide con el cálculo manual sobre el box score de la temporada."*

**Decisiones del cliente (2026-08-10), tomadas tras el diagnóstico de código:**
1. Los cinco indicadores son **métricas nuevas a agregar**, no existentes mal nombradas.
2. OR%/DR% de jugador se **calculan con la fórmula individual**, no se retiran del perfil.

**Specs previas:**
- `sdd/specs/12-nulos-orden-color-dnp/` — regla de nulos y DNP; los indicadores nuevos la heredan.
- `sdd/specs/14-promedios-de-liga/` — el `Ø 0.0%` que C-01 menciona **ya se corrigió allí**: hoy esas
  cards muestran `Ø —`. Lo que queda de C-01 es el dato faltante, no el promedio.

**Docs:**
- `docs/metrics.md` §Posesiones — `POS = 2PA + 3PA + FTA × 0.44 + TOV − OR`.
- `docs/metrics.md` §Rebotes — `OR% = OR / (OR + DR_rival)`, `DR% = DR / (DR + OR_rival)`,
  `TRB% = (OR + DR) / (OR + DR + OR_rival + DR_rival)`, `Reb Share (jugador) = TRB_jugador / TRB_equipo`.
- `docs/metrics.md` §Pérdidas y asistencias — `AST/TO (jugador) = AST / TOV`.
- `docs/database.md` — `player_game_stats.minutes` es TEXT (`"28:34"`); `games.minutes` es la duración
  del partido (default 40).

**Código (estado verificado sobre el repo):**
- `backend/stats_engine.py` `calc_player_stats` (232-326) — **no calcula `or_pct`, `dr_pct` ni
  `trb_pct`**: no están en el dict que devuelve. La UI los pide, recibe `undefined` y renderiza `"—"`.
  Respuesta a la pregunta de C-01: **dato faltante, no error de cálculo.**
- `backend/stats_engine.py` `calc_team_stats` (137-141) — sí los calcula, con las fórmulas de equipo
  de `docs/metrics.md`.
- `backend/stats_engine.py` `calc_player_stats` (270-271) — ya calcula `p_pos` (posesiones del
  jugador) y `oer = pts / p_pos`. **`oer` de jugador ya es PTS/pos**: ver §9.
- `backend/stats_engine.py` `calc_player_stats` (256, 300) — `ast_to` se calcula **por partido**, y
  `app.py` `_avg("ast_to")` promedia esos ratios entre partidos. Un promedio de ratios no es el ratio
  de la temporada: no coincide con el box score acumulado que pide el CA de C-04.
- `backend/stats_engine.py` `calc_player_stats` — recibe `game_minutes` (duración del partido) pero
  **no usa los minutos del jugador**: hoy ninguna métrica es por minuto.
- `backend/app.py` — `player_stats` tiene el rival a mano (`_opp_for`); `team_players` y
  `search_players` no se lo pasan a `calc_player_stats`.
- Etiquetas actuales del perfil (verificadas): `AS` (`ast_ratio`), `TO` (`to_pct`), `PPP`, `OER`,
  `% RebOf Equipo` / `% RebDef Equipo` (`oreb_share`/`dreb_share`). Ninguna es por minuto.

## 3. Historias de usuario
- **US-1**: Como analista, quiero ver cuántas asistencias, pérdidas y puntos produce un jugador **por
  posesión propia**, para comparar jugadores con volúmenes de uso distintos.
- **US-2**: Como analista, quiero ver el rebote ofensivo y defensivo **por minuto**, para comparar
  titulares con jugadores de rotación corta.
- **US-3**: Como analista, quiero el porcentaje de rebote individual de un jugador, para saber qué
  porción de los rebotes disponibles capturó mientras estuvo en cancha.
- **US-4**: Como entrenador, quiero que AS/PER signifique una sola cosa y pueda verificarla sumando el
  box score de la temporada, para poder confiar en el número.

## 4. Requisitos funcionales

- **RF-1**: El perfil de jugador DEBE mostrar **AS/pos** = asistencias / posesiones del jugador. ·
  (US-1, `docs/metrics.md` §Posesiones) · Posesiones del jugador con la fórmula ya vigente:
  `POS = 2PA + 3PA + FTA × 0.44 + TOV − OR`.

- **RF-2**: El perfil de jugador DEBE mostrar **PER/pos** = pérdidas / posesiones del jugador. ·
  (US-1) · "PER" es *pérdidas*, no Player Efficiency Rating — es la convención ya vigente en la app
  (`Ptos/PER`, fila `PER` de Comparar).

- **RF-3**: El perfil de jugador DEBE mostrar **PTS/pos** = puntos / posesiones del jugador. ·
  (US-1) · Es numéricamente idéntico al OER de jugador ya existente; se expone con la etiqueta que
  pide el cliente sin duplicar el cálculo. Ver §9.

- **RF-4**: El perfil de jugador DEBE mostrar **RO/min** y **RD/min** = rebotes ofensivos y
  defensivos por minuto disputado. · (US-2) · Denominador: minutos del jugador en ese partido,
  parseados del campo de texto (`"28:34"` → 28.57).

- **RF-5**: Los cinco indicadores DEBEN devolver valor numérico para todo jugador con minutos
  disputados, y `null` cuando el denominador es 0 (jugador sin posesiones, o DNP). · (C-01 CA,
  `12-nulos-orden-color-dnp` RF-6) · Un DNP no aporta a estos promedios.

- **RF-6**: El perfil de jugador DEBE calcular **OR%**, **DR%** y **TRB%** con la fórmula
  **individual**, que ajusta por los minutos que el jugador estuvo en cancha:

  ```
  OR%  = (RO_jug  × duración_partido) / (min_jug × (RO_equipo + RD_rival))
  DR%  = (RD_jug  × duración_partido) / (min_jug × (RD_equipo + RO_rival))
  TRB% = (REB_jug × duración_partido) / (min_jug × (REB_equipo + REB_rival))
  ```

  · (US-3, decisión del cliente) · Requiere los rebotes del equipo y del rival de ese partido. Cuando
  falte cualquiera de esos datos, o los minutos sean 0, la métrica vale `null` — nunca `0`.

- **RF-7**: **AS/PER DEBE ser acumulado de temporada**: la suma de asistencias dividida por la suma
  de pérdidas de todos los partidos jugados, no el promedio de los ratios por partido. · (US-4, C-04)
  · Se aplica el **mismo criterio en equipo y en jugador**.

- **RF-8**: AS/PER DEBE valer `null` cuando el total de pérdidas de la temporada es 0. · (US-4,
  C-11) · Reemplaza el sentinel `99.0` **solo para el valor de temporada**; ver §8.

- **RF-9**: Los indicadores nuevos DEBEN tener promedio de liga y respetar el alcance por competencia
  de la Feature 14. · (US-1, `14-promedios-de-liga` RF-1)

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Cambio | Nuevo? |
|---|---|---|---|
| (ninguna tabla) | — | Sin cambio de esquema. Todo se deriva de columnas existentes (`orb`, `drb`, `ast`, `tov`, `minutes`, más los rebotes de equipo y rival). Métricas on-the-fly (Constitución 4) | No |
| `GET /api/player/<team>/<name>` | existente | **Campos nuevos**: `as_pos`, `tov_pos`, `pts_pos`, `orb_min`, `drb_min`. **Campos que pasan a tener valor**: `or_pct`, `dr_pct`, `trb_pct` (hoy ausentes). `averages.ast_to` pasa a ser el acumulado de temporada | Campos nuevos |
| `GET /api/search/players`, `GET /api/players/<team>` | existentes | Los mismos campos nuevos, para que el buscador pueda ordenar por ellos | Campos nuevos |
| `GET /api/team/<team_code>` | existente | `averages.ast_to` (equipo) pasa a ser el acumulado de temporada, con el mismo criterio | No |

## 6. Estados de UI

| Vista / Componente | loading | vacío | error | sin conexión (SW) | éxito |
|---|---|---|---|---|---|
| Perfil de jugador — bloque de producción | sin cambio | sin cambio | sin cambio | sin cambio | cinco cards nuevas: `AS/pos`, `PER/pos`, `PTS/pos`, `RO/min`, `RD/min`, con su `Ø` de liga |
| Perfil de jugador — bloque de rebote | sin cambio | sin cambio | sin cambio | sin cambio | `OR%` y `DR%` muestran valor; `"—"` solo si faltan los datos del rival o el jugador no jugó |
| Card AS/PER (equipo y jugador) | sin cambio | sin cambio | sin cambio | sin cambio | valor acumulado de temporada; `"—"` si no hubo pérdidas |

**Copy**: etiquetas nuevas literales del documento del cliente — `AS/pos`, `PER/pos`, `PTS/pos`,
`RO/min`, `RD/min`. Se agregan a `docs/frontend.md` al cerrar.

## 7. Criterios de aceptación

- **CA-1**: Given un jugador con minutos disputados, When se abre su perfil, Then `AS/pos`, `PER/pos`,
  `PTS/pos`, `RO/min` y `RD/min` muestran valor numérico, ninguno `"—"`.
- **CA-2**: Given un jugador con 0 posesiones en un partido, When se calcula ese partido, Then
  `AS/pos`, `PER/pos` y `PTS/pos` valen `null` y no entran en su promedio.
- **CA-3**: Given un jugador DNP, When se calculan sus promedios, Then ese partido no aporta a ninguno
  de los cinco indicadores (`12-nulos-orden-color-dnp` RF-6).
- **CA-4**: Given un jugador y un partido concretos, When se calcula `RO/min` a mano (RO del box score
  dividido por sus minutos), Then coincide con lo que muestra la app.
- **CA-5**: Given un jugador con rebotes y con datos de equipo y rival, When se abre su perfil, Then
  `OR%` y `DR%` muestran valor numérico, no `"—"`.
- **CA-6**: Given ese jugador, When se calcula su `OR%` a mano con la fórmula de RF-6, Then coincide
  con lo que muestra la app.
- **CA-7**: Given un jugador cuyos partidos suman 12 asistencias y 6 pérdidas, When se ve su AS/PER,
  Then vale **2.00** — el cociente de los totales, no el promedio de los cocientes por partido.
- **CA-8**: Given un equipo, When se ve su AS/PER, Then usa el mismo criterio acumulado que el jugador.
- **CA-9**: Given un jugador sin ninguna pérdida en la temporada, When se ve su AS/PER, Then muestra
  `"—"`, no `99.0` ni `Infinity`.
- **CA-10**: Given el recorrido de perfil de jugador y buscador, When se observa la consola, Then no
  hay errores JS nuevos.

## 8. Fuera de alcance

- **Percentiles de los indicadores nuevos (T-01)** y **umbrales de muestra (T-02)**. Los cinco
  indicadores heredan el `Ø` de liga de la Feature 14, sin percentil ni badge.
- **Los sentinels `ast_to` y `def_to_ratio` por partido.** RF-8 cambia el valor **de temporada**, que
  es el que se muestra. El valor por partido del `game_log` conserva el sentinel: tocarlo es la deuda
  abierta de Feature 08 y afecta a otras vistas. Se acota deliberadamente.
- **A-07** (% de asistencias sobre el total del equipo, puntos por asistencia, segundos de posesión).
  Es Bloque A y necesita play-by-play.
- **Reformular `def_to_ratio`**, que arrastra el mismo problema de promedio-de-ratios que AS/PER. No
  lo pide C-04; se registra como deuda.

## 9. Ambigüedades

- **[RESUELTA — cliente, 2026-08-10] ¿Los cinco indicadores existen o se agregan?** → **Se agregan.**
  *Justificación*: el diagnóstico de código confirmó que ninguno existe con ese nombre y que `RO/min`
  y `RD/min` no tienen análogo alguno (nada en la app es por minuto). "Revisar el cálculo" se
  interpreta como "que estos cinco indicadores existan y sean correctos".

- **[RESUELTA — cliente, 2026-08-10] ¿OR%/DR% de jugador se calculan o se retiran?** → **Se calculan
  con la fórmula individual.** *Justificación*: A-04 los lista en el vector de perfil de jugador, así
  que el cliente los espera como métrica de jugador. La fórmula de equipo de `docs/metrics.md` no
  aplica a un individuo; la individual ajusta por minutos en cancha.

- **[RESUELTA] `PTS/pos` es idéntico al OER de jugador.** → **Decisión: exponerlo con la etiqueta
  pedida, reusando el mismo cálculo, y documentar la equivalencia en `docs/metrics.md`.**
  *Justificación*: el cliente pide el indicador por su nombre; duplicar la fórmula abriría la puerta a
  que las dos versiones diverjan. Una sola fuente, dos etiquetas, equivalencia documentada.

- **[RESUELTA] ¿AS/PER por partido o acumulado?** → **Acumulado de temporada** (RF-7).
  *Justificación*: es lo que exige el CA de C-04 ("coincide con el cálculo manual sobre el box score de
  la temporada"). Además, el promedio de ratios por partido es estadísticamente incorrecto: un partido
  de 2 asistencias y 1 pérdida pesa igual que uno de 10 y 5.

- **[RESUELTA] ¿El denominador de RO/min son los minutos del jugador o los del partido?** →
  **Los del jugador.** *Justificación*: US-2 pide comparar titulares con rotación corta, lo que exige
  normalizar por el tiempo de cada uno. Los minutos del partido solo entran en la fórmula de RF-6,
  donde representan la ventana total de rebotes disponibles.
