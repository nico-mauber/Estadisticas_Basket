# Spec — F-01: Partido en vivo

> **ID:** F-01 · **Prioridad:** P1 · **Fase y orden:** Fase 4 — Día de partido · 03
> **Depende de:** F-07 ([../01-F-07-analizar-partido/](../01-F-07-analizar-partido/spec.md)) · A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md))
> **Habilita:** F-02, A-07 (`chains.py`)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-01 y §1.3 S5 · modo En vivo ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.9, §3.14, §3.17, §4, §6, §8 (`game-view.js`), §9 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §F-01):**
- "Seguimiento del partido mientras transcurre, en colectivo por equipo y por jugadores."
- Actualización: "Refresco tras cada posesión detectada en el play-by-play, con un máximo de 60 segundos entre
  actualizaciones."; "Debe poder entrarse también a partidos anteriores ya finalizados con la misma vista."
- Métricas de equipo, siempre con el rival al lado: "OER · DER · Net Rating · eFG% · TS% · PPP · Posesiones"; four factors
  "eFG% · TO% · OR% · FT Rate"; "Puntos por tiro y puntos por posesión"; "Comparación de cada valor contra el promedio de
  temporada del propio equipo".
- Cómo se están consiguiendo los puntos: "Distribución: pintura · media distancia · triple · tiros libres · segunda
  oportunidad · contraataque · tras pérdida rival · tras rebote ofensivo".
- Jugadores: "Por cada jugador: OER · TS% · eFG% · USO% · +/- · puntos creados · puntos desde asistencia · rebotes
  ofensivos que terminaron en puntos · robos que terminaron en puntos · pérdidas castigadas"; "Estado visual en cancha /
  descansando".
- Criterio: "durante un partido en curso los valores se actualizan sin recargar la página y coinciden con el box score
  oficial al cierre."

Y §1.3 S5: "Un mismo partido visto en cuatro estados […] cambia la fuente de datos (en curso o cerrado), no la estructura.
Conviene construir primero 'Analizar' […] y derivar de ahí 'En vivo'."

**Por qué:** S5 completa el acompañamiento del día de partido; En vivo es el modo que usa el cuerpo técnico durante el
juego, cuando la decisión (un cambio, un tiempo muerto) tiene que tomarse con datos ya calculados, no reconstruidos a mano.

**Qué existe HOY verificado en código:**
- No hay ningún endpoint ni módulo de "vivo". `backend/app.py` no tiene rutas `/api/live/*`.
- `backend/fiba_fetcher.py:fetch_game_data(url)` (l.210) ya sabe descargar y parsear el JSON de un partido de FIBA
  LiveStats (`_fetch_direct`, timeout 20 s; fallback `_fetch_playwright`, **no disponible en Render**). El parser
  (`_parse_fiba_json`, l.246) es el mismo esté el partido en curso o finalizado: FIBA publica el mismo `data.json` durante
  el partido y lo sigue publicando después.
- No hay detección de "partido finalizado" en el código actual: `_persist_game` (l.203) se llama solo desde `POST
  /api/import`, manual. No hay polling, caché por partido con TTL, ni hilos de fondo (Render + gunicorn 1 worker síncrono,
  `render.yaml` con `--timeout 180`, Arquitectura §1.1).
- `backend/lineups.py:build_segments(events, team_code, starters)` y `PERIOD_LEN` (§1.5 D-09: FIBA envía `OVERTIME`, hoy el
  código espera `OT`) ya calculan tramos de quinteto en cancha a partir de eventos — reutilizable para "estado en cancha /
  descansando".
- No existe ningún desglose de "distribución de puntos" (pintura/media/triple/TL/segunda oportunidad/contraataque/tras
  pérdida/tras RO) en ningún endpoint de `main`; los calificadores de FIBA que lo permitirían (`qualifier[]`:
  `pointsinthepaint`, `fromturnover`, `2ndchance`, `fastbreak`) no se persisten hoy (Arquitectura §1.6, columna `col-v2`).
- No hay comparación contra "promedio de temporada del propio equipo" en ningún endpoint: existe `calc_team_stats`
  (`stats_engine.py` l.37) pero solo por partido, sin promedio acumulado listo para comparar.

**Qué resuelven requisitos anteriores (supuestos de esta spec):** F-07 crea `game_analysis.py` (`game_detail`, `game_pbp`,
`score_timeline`), el endpoint `GET /api/game/<game_id>` con el shape `{game, box, players, partials, timeline, lineups,
standard}`, y el componente `components/game-view.js` (`renderGameView(el, gamePayload, {mode})`) que F-01 reutiliza
cambiando solo `mode: "vivo"` y la fuente de datos. A-01 crea `possessions.py` (motor de posesiones on-the-fly) y
`lineups.build_segments_both` (quintetos de ambos equipos simultáneos), que F-01 usa para la distribución de puntos por
origen (parcialmente: la clasificación completa por origen es de A-02, fase 3, que ya está cerrada al llegar a fase 4) y
para el estado en cancha/banco de cada jugador. `dev` no toca nada de esto (Arquitectura §1.0: el Bloque C no incluye vivo).

**Qué queda (esta spec):** la fuente de datos "en vivo" (`live.py`, polling con caché TTL, detección de fin de partido,
persistencia automática), el endpoint `GET /api/live/<game_id>`, la comparación contra el promedio de temporada, el estado
en cancha/banco, y la vista que consume `game-view.js` en modo `vivo`.

## 1. Objetivo

Mostrar el estado de un partido en curso (o ya finalizado, con la misma vista) con la eficiencia y los four factors propios
y del rival lado a lado, la distribución de cómo se consiguieron los puntos, el detalle por jugador y su estado en cancha o
banco, actualizándose solo sin recargar la página y sin exceder 60 segundos entre actualizaciones.

## 2. Fuentes (trazabilidad)

- Especificación v2 §4 F-01 (requisito completo, literal arriba), §1.3 S5 (modo En vivo), §3 T-05 (conjunto estándar,
  fuente de las métricas de equipo y jugador), §6 glosario (fórmulas: OER, DER, Net Rating, eFG%, TS%, PPP, FT Rate).
- `docs/database.md` §`games`, §`team_game_stats`, §`player_game_stats`, §`pbp_events` (no hay columnas nuevas propias de
  esta spec).
- `docs/api.md`: no existe ningún endpoint de vivo (F-01 los crea, NUEVO).
- Arquitectura §1.1 (despliegue: Render Starter, gunicorn `--timeout 180`, 1 worker síncrono por defecto), §1.6 (pbp real,
  calificadores no persistidos — limita la distribución de puntos por origen exacto en esta fase), §3.5 (conjunto estándar,
  `stats_engine.compute_standard`), §3.9 (A-01, `possessions.py`, `lineups.build_segments_both`), §3.14 (caché por
  versiones, namespace `live:<game_id>` con TTL propio), §3.17 (Datos en vivo: polling del cliente + caché TTL en
  servidor, sin hilos de fondo, persistencia automática al detectar fin; DA-27, DA-28), §4 (`live.py`), §6 (`GET
  /api/live/<game_id>`, `GET /api/live/<game_id>/momentum` de F-02), §8 (`components/game-view.js`), §9 (grafo: F-01
  depende de F-07 y A-01; habilita F-02 y A-07 vía `chains.py`).
- Specs previas de esta fase: `../01-F-07-analizar-partido/spec.md`/`plan.md` (`game_analysis.py`, `game-view.js`, shape de
  `GET /api/game/<game_id>`).

## 3. Historias de usuario

- US-1: Como entrenador, quiero ver la eficiencia y los four factors de mi equipo junto a los del rival mientras el
  partido está en curso, para tomar decisiones (tiempo muerto, cambio) con datos ya calculados.
- US-2: Como entrenador, quiero saber de dónde vienen los puntos de ambos equipos en tiempo real, para identificar
  patrones que se están repitiendo.
- US-3: Como entrenador, quiero ver el rendimiento de cada jugador propio mientras el partido transcurre, incluido quién
  está en cancha, para decidir rotaciones.
- US-4: Como entrenador, quiero comparar los números del partido en curso contra el promedio de mi equipo en la
  temporada, para saber si estamos por encima o por debajo de lo habitual.
- US-5: Como entrenador, quiero poder abrir la misma vista para un partido ya finalizado, para revisar cómo terminó sin
  tener que esperar a que alguien lo reimporte.
- US-6: Como equipo de desarrollo, queremos que la vista en vivo se actualice sola sin recargar la página, para no
  interrumpir el seguimiento durante el partido.

## 4. Requisitos funcionales

**Acceso y actualización**
- RF-1: El sistema DEBE mostrar la vista En vivo de un partido (S5 · Partido, modo "vivo") identificado por su `game_id`,
  reutilizando el componente `components/game-view.js` de F-07 con `mode: "vivo"`. · (US-1, US-6) (Esp. v2 §1.3 S5 "Los
  cuatro modos comparten el mismo componente de partido"; §F-01)
- RF-2: El sistema DEBE refrescar los datos del partido en curso sin recargar la página, con un máximo de **60 segundos**
  entre actualizaciones; el disparador es un sondeo (`polling`) iniciado por el cliente cada `live.poll_secs` (config,
  default 30 s, rango 10–60), nunca mayor a 60 s. · (US-1, US-6) (Esp. v2 §F-01 "Refresco tras cada posesión detectada en
  el play-by-play, con un máximo de 60 segundos entre actualizaciones"; Arquitectura §3.17 "Polling iniciado por el
  cliente"; DA-27)
- RF-3: El servidor DEBE cachear el JSON descargado de FIBA por partido con TTL `live.cache_ttl_secs` (config, default 15
  s, rango 5–60), de forma que múltiples usuarios viendo el mismo partido en simultáneo generen **una sola** descarga por
  intervalo. · (US-6) (Arquitectura §3.17 "el servidor cachea el JSON por partido con TTL […] una sola descarga por
  intervalo para todos los usuarios")
- RF-4: Si la descarga del JSON de FIBA falla o excede `live.fetch_timeout_secs` (config, default 8 s, rango 3–20), el
  sistema DEBE servir el último snapshot cacheado con la marca `stale: true` en vez de romper la vista. · (US-6)
  (Arquitectura §3.17 "ante fallo sirve el último snapshot con `stale: true`")
- RF-5: El sistema DEBE poder abrir la misma vista para un partido **ya finalizado**, con la misma estructura de bloques,
  usando los datos persistidos en vez del JSON en vivo (delega en F-07 `game_analysis.game_detail`). · (US-5) (Esp. v2
  §F-01 "Debe poder entrarse también a partidos anteriores ya finalizados con la misma vista")
- RF-6: El sistema DEBE detectar automáticamente el fin del partido (evento `game`/`end` confirmado en el JSON de FIBA) y,
  al detectarlo, persistir el partido con `ingest.persist_game` (idempotente) y archivar el JSON crudo, sin intervención
  manual. · (US-5) (Arquitectura §3.17 "al detectar fin se persiste automáticamente"; DA-27)

**Métricas de equipo (con el rival al lado)**
- RF-7: El sistema DEBE mostrar, para ambos equipos lado a lado, el conjunto estándar calculado sobre lo transcurrido del
  partido: OER, DER, Net Rating, eFG%, TS%, PPP, posesiones (fórmulas del glosario §6, conciliadas en Arquitectura §2.2),
  con las fórmulas de `stats_engine.compute_standard` (Arquitectura §3.5), no una reimplementación local. · (US-1) (Esp.
  v2 §F-01 "OER · DER · Net Rating · eFG% · TS% · PPP · Posesiones")
- RF-8: El sistema DEBE mostrar los **four factors** de ambos equipos: eFG%, TO% (según glosario: pérdidas/posesiones,
  DA-04), OR%, FT Rate. · (US-1) (Esp. v2 §F-01 "Four factors: eFG% · TO% · OR% · FT Rate")
- RF-9: El sistema DEBE mostrar puntos por tiro (PPT general) y puntos por posesión (PPP) de ambos equipos. · (US-1) (Esp.
  v2 §F-01 "Puntos por tiro y puntos por posesión")
- RF-10: El sistema DEBE comparar cada valor de equipo contra el **promedio de temporada del propio equipo** en la
  competencia activa (media pooled de sus partidos ya jugados en la competencia y temporada, excluyendo el partido en
  curso), mostrando la diferencia con signo. · (US-1) (Esp. v2 §F-01 "Comparación de cada valor contra el promedio de
  temporada del propio equipo"; Arquitectura §2.1 agregación pooled, DA-02)

**Distribución de puntos**
- RF-11: El sistema DEBE mostrar, para cada equipo, la distribución de sus puntos por origen: pintura, media distancia,
  triple, tiros libres, segunda oportunidad, contraataque, tras pérdida rival, tras rebote ofensivo. · (US-2) (Esp. v2
  §F-01 "Distribución: pintura · media distancia · triple · tiros libres · segunda oportunidad · contraataque · tras
  pérdida rival · tras rebote ofensivo")
- RF-12: En esta fase (posterior a A-01 pero sin A-02/A-03/A-07 activos en el partido en curso, que operan sobre el motor
  de posesiones ya cerrado), la distribución DEBE calcularse desde las columnas ya disponibles del box en progreso
  (`paint_pts`, `second_chance_pts`, `pts_from_tov`, `fast_break_pts`) y desde `ppt_2`/`ppt_3`/`ppt_ft` para el resto
  (media distancia = puntos de campo fuera de pintura y triple; triple y TL directos de los conteos); el desglose exacto
  por posesión reconstruida (contraataque real vía A-01 sobre datos en memoria) es INCREMENTO DIFERIDO hacia A-07, que F-01
  adopta con `chains.py` (ver RF-19). · (US-2) (Arquitectura §9.2 I-11 "F-01 crea `chains.py` con las primitivas mínimas;
  A-07 lo extiende")
- RF-13: Todo componente de la distribución no calculable (partido sin play-by-play, calificador no disponible) DEBE
  mostrarse como nulo con razón, y la suma de las categorías disponibles DEBE indicar explícitamente si no alcanza el 100 %
  de los puntos (categoría "otros/no clasificado" visible, nunca oculta silenciosamente). · (Esp. v2 §C-11)

**Jugadores**
- RF-14: El sistema DEBE mostrar, por cada jugador que disputó minutos, OER, TS%, eFG%, USO% (fórmula "en cancha" de
  minutos, DA-05), +/-, puntos creados, puntos desde asistencia, rebotes ofensivos que terminaron en puntos, robos que
  terminaron en puntos, pérdidas castigadas. · (US-3) (Esp. v2 §F-01 "Por cada jugador: OER · TS% · eFG% · USO% · +/- ·
  puntos creados · puntos desde asistencia · rebotes ofensivos que terminaron en puntos · robos que terminaron en puntos ·
  pérdidas castigadas")
- RF-15: "Puntos creados", "puntos desde asistencia", "rebotes ofensivos que terminaron en puntos", "robos que terminaron
  en puntos" y "pérdidas castigadas" DEBEN calcularse con las primitivas mínimas de `chains.py` (`assist_points`,
  `oreb_points`, `steal_points`, `turnover_cost`) que esta spec crea, operando sobre las posesiones ya calculadas del
  partido en curso (A-01, en memoria, sin persistir). · (US-3) (Arquitectura §4 `chains.py` "NUEVO … `assist_points(...)`,
  `oreb_points(...)`, `steal_points(...)`, `turnover_cost(...)`"; §9.2 I-11)
- RF-16: El sistema DEBE mostrar el estado de cada jugador (en cancha / banco) en tiempo real, reutilizando
  `lineups.build_segments`/`build_segments_both` (A-01) sobre los eventos ya descargados del partido en curso. · (US-3)
  (Esp. v2 §F-01 "Estado visual en cancha / descansando")

**Nulos y casos borde**
- RF-17: Toda métrica no calculable en el partido en curso (sin play-by-play aún cargado por FIBA, división por cero, sin
  minutos jugados) DEBE mostrarse como nulo con razón (`sin_pbp`, `sin_intentos`, `dnp`), nunca reemplazada por 0. · (Esp.
  v2 §C-11; Arquitectura §7.4)
- RF-18: Un partido "en curso" con JSON temporalmente no disponible (falla de red hacia FIBA) DEBE mostrar el último
  snapshot con el aviso "Datos desactualizados desde {hora}" (`stale: true`, RF-4), nunca una pantalla en blanco ni un
  error que bloquee la vista completa. · (US-6) (Arquitectura §3.17)

**Componente reutilizable**
- RF-19: `chains.py` (NUEVO, dueño F-01) DEBE crearse en esta spec con las primitivas mínimas que A-07 (fase 5) extiende:
  `assist_points(possessions) -> dict`, `oreb_points(possessions) -> dict`, `steal_points(possessions) -> dict`,
  `turnover_cost(possessions) -> dict`, todas operando sobre `list[Possession]` de A-01 (sin persistir, Constitución 4).
  · (US-3) (Arquitectura §4, §9.2 I-11)
- RF-20: Los totales del box en vivo (equipo y jugador) DEBEN, al finalizar el partido, coincidir con el box score oficial
  persistido (mismo criterio de conciliación que F-07 CA-1): esta spec no relaja esa garantía, la hereda del parser común
  (`fiba_fetcher.parse_game`). · (Esp. v2 §F-01 CA "coinciden con el box score oficial al cierre")

## 5. Requisitos de datos / API

| Tabla / endpoint | Uso | Estado |
|---|---|---|
| `games`, `team_game_stats`, `player_game_stats`, `pbp_events` | persistencia al detectar fin (vía `ingest.persist_game`, F-11) | existen |
| `game_sources` (F-11) | archivo del JSON crudo al finalizar | existe (F-11) |
| `GET /api/live/<game_id>` | snapshot en vivo: `{status, stale, fetched_at, teams, players_on_court, distribution, vs_season}` | **NUEVO** (Arquitectura §6, dueño F-01) |
| `GET /api/game/<game_id>` (F-07) | reutilizado para abrir un partido ya finalizado con la misma vista (RF-5) | existente (F-07) |
| Claves de configuración `live.poll_secs` (30), `live.cache_ttl_secs` (15), `live.fetch_timeout_secs` (8) | ya catalogadas en la arquitectura, consumidor F-01 | catalogadas (Arquitectura §3.2), F-13 las expone en `CONFIG_SPEC`; hasta que F-13 esté integrado, `live.py` usa los defaults embebidos |

Sin tablas ni columnas nuevas (Arquitectura §5 confirma: "Sin cambios de esquema: […] F-01…F-09"). Errores: `404
no_encontrado` (`game_id` inexistente en FIBA ni en la base), `502 fiba_no_disponible` (descarga falló y no hay snapshot
cacheado previo para servir como `stale`).

## 6. Estados de UI

Vista: S5 Partido · modo En vivo (`#/partido/<game_id>/vivo`). Copy nuevo (marcar para `docs/frontend.md`), siempre vía
`t()`.

| Bloque | loading | vacío / sin datos | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Vista completa | spinner "Cargando partido…" | — | 404: "Partido no encontrado." · 502: "No se pudo obtener el partido en vivo." | "Sin conexión: el seguimiento en vivo necesita conexión." | mismos bloques de `game-view.js` (F-07) con indicador "EN VIVO" pulsante |
| Snapshot desactualizado | — | — | — | — | banner "Datos desactualizados desde {hora}" cuando `stale: true` |
| Métricas de equipo | skeleton | "Sin datos aún: el partido no comenzó." | — | — | tabla comparativa equipo · rival con Δ vs promedio de temporada |
| Distribución de puntos | skeleton | "Sin datos de distribución todavía." | — | — | barras/torta con categoría "otros/no clasificado" si no suma 100% |
| Jugadores | skeleton | — | — | — | tabla con indicador "en cancha"/"banco" y avatar de estado |
| Partido finalizado (auto-detectado) | "Persistiendo partido finalizado…" | — | — | — | banner "Partido finalizado" con enlace a `#/partido/<game_id>/analizar` |

Mobile (<768 px): mismo criterio que F-07 (bloques apilados como pestañas internas horizontales con scroll).

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: Given un partido en curso, When transcurre el tiempo, Then los valores se actualizan sin
  recargar la página, con no más de 60 segundos entre actualizaciones, y al finalizar el partido coinciden con el box
  score oficial persistido.
- CA-2: Given dos usuarios viendo el mismo partido en vivo al mismo tiempo, When ambos hacen polling dentro del mismo
  intervalo de `live.cache_ttl_secs`, Then el servidor descarga el JSON de FIBA una sola vez (verificable con un contador
  de llamadas a `fiba_fetcher.fetch_game_data` o con los logs de descarga).
- CA-3: Given una falla temporal de red hacia FIBA durante un partido en curso, When el cliente hace polling, Then la
  vista muestra el último snapshot con el aviso de datos desactualizados, sin pantalla en blanco ni excepción JS.
- CA-4: Given un partido ya finalizado, When se abre `#/partido/<game_id>/vivo`, Then se muestra la misma estructura de
  bloques que en curso, con los datos persistidos (equivalente a `#/partido/<game_id>/analizar` de F-07 en su contenido de
  equipo/jugador, con el layout de vivo).
- CA-5: Given un partido que termina mientras se lo está viendo en vivo, When el sistema detecta el evento de fin, Then el
  partido se persiste automáticamente (verificable: aparece en `GET /api/games` sin necesidad de `POST /api/import`
  manual) y la vista muestra el banner de "Partido finalizado".
- CA-6: Given las métricas de equipo en vivo, When se comparan contra el promedio de temporada, Then el promedio usado
  coincide con la media pooled de los partidos previos del equipo en la misma competencia (verificable contra `GET
  /api/team/<team_code>?competition=<id>`).
- CA-7: Given la distribución de puntos de un equipo, When no hay play-by-play para algún componente, Then ese componente
  se muestra nulo con razón y la categoría "otros/no clasificado" refleja la diferencia, nunca se omite silenciosamente.
- CA-8: Given el estado en cancha/banco de los jugadores, When se recorre la lista, Then coincide exactamente con los 5
  jugadores que `lineups.build_segments` indica en cancha en el evento más reciente procesado.
- CA-9: Given `GET /api/live/<game_id>` con un `game_id` que no existe ni en FIBA ni en la base, When se lo llama, Then
  responde 404 `{"error": "Partido no encontrado", "code": "no_encontrado"}`.

## 8. Fuera de alcance

- Momentum (F-02): reutiliza esta infraestructura, pero sus reglas (rachas, jugadores calientes/fríos) son un requisito
  aparte.
- WebSockets o Server-Sent Events: descartado por la arquitectura (§3.17), se usa polling del cliente.
- Hilo o proceso de fondo que consulte FIBA de forma proactiva: descartado (Render + gunicorn síncrono no lo garantiza).
- Distribución de puntos exacta por posesión reconstruida con clasificación completa de origen/tipo (A-02/A-03): esta spec
  usa las columnas de box ya disponibles como aproximación razonable; INCREMENTO DIFERIDO (→ A-07): el desglose fino de
  "puntos creados"/"puntos desde asistencia" para el análisis histórico completo (post-partido, todas las temporadas) lo
  entrega A-07 extendiendo `chains.py`; F-01 solo cubre el partido en curso.
- Notificaciones push o alertas sonoras cuando el partido termina: no pedido.
- Cambio de `--workers`/`--threads` de gunicorn (DA-28): es una decisión de despliegue documentada en `docs/deployment.md`
  al cerrar F-01, no código de esta feature.

## 9. Ambigüedades

- [DECISIÓN PROPUESTA — confirmar] "Refresco tras cada posesión detectada" (literal del cliente) se interpreta como
  "refresco periódico que, en la práctica, captura cada posesión nueva que FIBA ya publicó al momento del polling", no
  como un evento por posesión en tiempo real (eso requeriría push del servidor, descartado por la arquitectura). El límite
  duro de 60 s (también literal) se cumple con `live.poll_secs` ≤ 60.
- [DECISIÓN PROPUESTA — confirmar] "Promedio de temporada del propio equipo" (RF-10) excluye el partido en curso mientras
  no esté persistido (no tiene fila en `team_game_stats` todavía) — se compara contra los partidos ya cerrados de la
  competencia activa, criterio pooled (DA-02).
- [DECISIÓN PROPUESTA — confirmar] La distribución de puntos (RF-11/RF-12) usa el box en progreso (columnas ya existentes)
  en vez de reconstruir posesiones en vivo con A-01 completo, porque A-01 en esta fase opera sobre partidos ya cerrados
  para el criterio de conciliación ≤2%; sobre un partido en curso (datos parciales, posible pbp incompleto por eventos aún
  no publicados) no se puede garantizar esa conciliación. Se documenta como aproximación en `docs/metrics.md` al cerrar.
- [NEEDS CLARIFICATION] El cliente no especifica qué pasa si el `game_id` corresponde a un partido que FIBA todavía no
  publicó (URL de un partido futuro, sin `data.json` disponible): se asume 404 con el mismo mensaje que un `game_id`
  inexistente, salvo que el cliente prefiera un estado distinto ("El partido todavía no comenzó"). Confirmar.
