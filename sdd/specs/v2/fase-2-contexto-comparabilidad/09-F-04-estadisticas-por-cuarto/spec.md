# Spec — F-04: Estadísticas por cuarto

> **ID:** F-04 · **Prioridad:** P1 · **Fase y orden:** 2·09
> **Depende de:** C-06 ([../../fase-1-confiabilidad/05-C-06-umbral-cierres/](../../fase-1-confiabilidad/05-C-06-umbral-cierres/spec.md)) · T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · T-03 ([../02-T-03-selector-global-contexto/](../02-T-03-selector-global-contexto/spec.md)) · X-01 ([../01-X-01-reorganizacion-navegacion/](../01-X-01-reorganizacion-navegacion/spec.md)) · (usa también T-06 y T-01 de fase 1)
> **Habilita:** — (consumidores indirectos: A-06 reutiliza la dimensión de tramo)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-04 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S3 "Momentos" · Arquitectura §2.1, §3.5, §3.7, §3.8, §3.12, §6, §9 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §4 F-04):**
- "Bloque nuevo debajo de la sección de equipo, con la misma información que el bloque de cierres de partido."
- "Selector para elegir el tramo del partido que se quiere ver: cada cuarto, primera y segunda parte, prórroga, últimos 5 minutos."
- Criterio de aceptación: "El mismo bloque de métricas responde al selector de tramo sin recargar la pantalla."
- En la §1.3 la pestaña **Momentos** de S3 agrupa "Por cuarto y tramo seleccionable, cierres con diferencia ≤ 10" (F-04, C-06).

**Por qué:** hoy el único corte temporal dentro de un partido son los cierres; el entrenador no puede ver si su equipo arranca mal los terceros cuartos o se cae en la segunda mitad.

**Qué existe hoy (verificado en código, rama `main`):**
- `backend/clutch.py`: `CLUTCH_SECS = 300`; `_is_clutch(ev, last_regular)` toma el último período `REGULAR` con `clock_secs <= 300` más los eventos con `period_type == "OT"`; `_agg(evs)` cuenta 2pt/3pt/TL, rebotes, AS, PER, robos, tapones, `foul` y `foulon`; `_entry_margin` mide la diferencia al minuto 5:00; `_box_metrics` devuelve `off_rating, def_rating, efg_pct, ts_pct, possessions`; `team_clutch(games, team_code, team_name, margin=15)` devuelve `{margin, games_qualified, games_excluded, clutch_record "G-P-E", aggregate{…}, per_game[…]}`. El `clutch_record` cuenta **tramos** ganados (pts del equipo > pts del rival dentro de la ventana), no partidos.
- `backend/app.py:clutch_team` (`GET /api/clutch/<team_code>`) usa `_team_pbp_games(team_code)` (todas las competencias, sin filtro) y `margin` por query (default 15; `dev`: 10).
- `frontend/js/app.js:renderTeamClutch` y `_drawClutchTable`: card "Cierres (últimos 5 min, dif ≤ 15)" con 5 `statBox` (Dif, Off, Def, eFG%, TS%), una fila de conteos (Pts F/C, REB, AST, TOV, Robos/Tapones) y la tabla por partido ordenable. Vive en `#team-clutch` dentro de la vista Equipo (scroll continuo, sin pestañas).
- **Defecto de datos (arquitectura §1.5 D-09):** FIBA envía `period_type = "OVERTIME"` (con `period` reiniciado en 1); `_is_clutch` espera `"OT"`, así que las prórrogas quedan fuera. Lo corrige C-06 con `PERIOD_TYPES`/`PERIOD_LEN` compartidas.
- No existe ningún corte por cuarto ni por mitad en backend ni frontend. `team_game_stats.period_pts` (parciales por período) no existe en `main`: lo agrega F-11 (arquitectura §5).

**Qué resolvieron features anteriores:** Feature 05 (cierres, `sdd/specs/05-clutch/spec.md` §10) fijó el formato "mini-partido agregado + desglose por partido" que F-04 replica; Feature 08 fijó la semántica de nulos (tasa con denominador 0 → nulo); en v2, C-06 corrige prórrogas, universo por competencia y umbral 10/300 (configurables desde F-13), T-05 fija el conjunto estándar y la migración de Cierres a `compute_standard` ("C-06/F-04 migran cierres", arquitectura §3.5), T-02 el badge y la regresión de splits, T-03 el contrato de contexto (incluida la dimensión `quarter`), X-01 la pestaña `momentos`.

**Qué queda para F-04:** el bloque por tramo con el conjunto estándar completo, el selector de 8 tramos que cambia sin recargar, el badge de muestra por tramo, el desglose por partido del tramo elegido, y dejar el bloque de Cierres presentado con el mismo formato en la misma pestaña.

## 1. Objetivo
Mostrar, en la pestaña Momentos del equipo, el rendimiento del equipo en un tramo del partido elegido (cada cuarto, cada mitad, prórroga o últimos 5 minutos) con el mismo formato y el mismo conjunto de métricas que el bloque de Cierres, cambiando de tramo sin recargar la pantalla.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 F-04 (requisito y CA), §1.3 S3 pestaña "Momentos", §3 T-02 (split de contexto 15/40 posesiones; K = 20 para splits), §3 T-05 ("cuarto o tramo" y "cierre de partido" como entidades), §2 C-06 (partido cerrado), §2 C-11 (nulos), §6 Glosario (Posesión, OER, DER, Net Rating, eFG%, TS%, TO%, FT Rate, PACE, Valor ajustado).
- `docs/api.md` § `GET /api/clutch/<team_code>` (formato del bloque de cierres, `clutch_record`, `per_game`).
- `docs/metrics.md` § Posesiones, § Eficiencia ofensiva y defensiva, § Eficiencia de tiro, § FT Rate, § Pace (con la conciliación de la arquitectura §2.2).
- `docs/frontend.md` § Vistas (SPA) → Equipo (card de Cierres).
- `docs/architecture.md` § `clutch.py`.
- Arquitectura: §2.1 (agregación pooled y nulos), §2.3 (fuente `pbp` para "cuarto / cierre / split"), §3.2 (`clutch.window_secs`, `sample.split.*`, `regression.split.k`), §3.5 (tipos de entidad `period` y `clutch`; migración de Cierres), §3.7 (T-02), §3.8 (contexto; `quarter` = `1,2,3,4,pr`), §3.11 (tabla `period_splits`), §3.12 (S3 pestaña `momentos`), §6 (endpoints genéricos), §7.2/§7.3/§7.5/§7.6.
- Specs previos: `sdd/specs/05-clutch/spec.md` §10, `sdd/specs/08-nulos-vs-cero/spec.md`.

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver cómo rinde mi equipo en cada cuarto, para detectar en qué tramo del partido cae su rendimiento.
- US-2: Como entrenador, quiero comparar primera y segunda mitad, prórrogas y últimos 5 minutos con las mismas métricas que uso para los cierres, para leer todo con el mismo criterio.
- US-3: Como analista, quiero cambiar de tramo sin esperar ni perder el resto de la pantalla, para recorrer los tramos rápido.
- US-4: Como analista, quiero saber cuántas posesiones y partidos respaldan cada tramo, para no sacar conclusiones de una prórroga aislada.
- US-5: Como analista, quiero el detalle partido a partido del tramo elegido y poder exportarlo, para revisar de dónde sale el agregado.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE ofrecer ocho tramos: **1.er cuarto, 2.º cuarto, 3.er cuarto, 4.º cuarto, 1.ª mitad, 2.ª mitad, Prórroga y Últimos 5 minutos**. · (US-1, US-2) (Esp. v2 §F-04)
  - Reglas: 1.º–4.º cuarto = eventos del período `REGULAR` 1–4; 1.ª mitad = períodos `REGULAR` 1–2; 2.ª mitad = períodos `REGULAR` 3–4 (sin prórrogas); Prórroga = todos los eventos con `period_type` de prórroga (FIBA `OVERTIME`); Últimos 5 minutos = la misma ventana temporal que Cierres (último período `REGULAR` con reloj ≤ `clutch.window_secs` más todas las prórrogas) **sin** el filtro de diferencia (ver §9-1).
- RF-2: El sistema DEBE calcular, para cada tramo, el agregado del equipo y del rival sobre los eventos de play-by-play del tramo en todos los partidos de la selección, con la política pooled (Σnumerador/Σdenominador de la selección). · (US-1, US-2) (Esp. v2 §F-04; arquitectura §2.1)
- RF-3: El sistema DEBE devolver para cada tramo el **conjunto estándar completo de T-05** (todos los grupos y claves del catálogo; las que no aplican o no pueden calcularse, en nulo con su razón, nunca omitidas). · (US-2) (Esp. v2 §T-05 "cuarto o tramo"; arquitectura §3.5)
  - Reglas (glosario v2 §6, copiadas): Posesión = T2i + T3i − RO + PER + 0,44 × TLi; OER = puntos anotados / posesiones propias; DER = puntos recibidos / posesiones del rival; Net Rating = OER − DER; eFG% = (T2c + T3c + 0,5 × T3c) / (T2i + T3i); TS% = Puntos / (2 × (T2i + T3i + 0,44 × TLi)); TO% = Pérdidas / posesiones; FT Rate = TLi / TCi; PACE = posesiones por 40 minutos (fórmula `40·((POS+POS_rival)/2)/minutos`, arquitectura §2.2, con los minutos del tramo).
  - Minutos del tramo: cuarto = 10; mitad = 20; prórroga = 5 por prórroga jugada; últimos 5 minutos = `clutch.window_secs`/60 + 5 por prórroga.
- RF-4: El sistema DEBE mostrar por tramo **la misma información que el bloque de Cierres**: diferencial de puntos, puntos a favor y en contra, récord del tramo ("G-P-E": tramos ganados, perdidos y empatados según los puntos del tramo), partidos con el tramo, y el desglose por partido. · (US-2, US-5) (Esp. v2 §F-04; docs/api.md § clutch)
- RF-5: El sistema DEBE cambiar el bloque de métricas al elegir otro tramo **sin recargar la pantalla**: el resto de la pestaña (encabezado, filtros de contexto, bloque de Cierres) no se vuelve a dibujar ni pierde su estado. · (US-3) (Esp. v2 §F-04 CA)
- RF-6: El sistema DEBE acompañar cada tramo del **badge de muestra de T-02** con posesiones, minutos y partidos de respaldo, usando los umbrales de "split de contexto" (`sample.split.min` = 15, `sample.split.high` = 40 posesiones, configurables). · (US-4) (Esp. v2 §T-02)
- RF-7: El sistema DEBE mostrar, para OER, DER y Net Rating de cada tramo, el valor crudo y el **valor ajustado** de T-02: valor_ajustado = (pos × valor + K × media_liga) / (pos + K), con K = `regression.split.k` (20), y la banda de error. Con muestra baja, el tramo se muestra en gris con la advertencia y queda fuera de rankings. · (US-4) (Esp. v2 §T-02)
- RF-8: El sistema DEBE acompañar cada métrica del tramo de su **ficha T-01** (valor, ranking, distancias, percentil) calculada contra la población de los equipos de la competencia **en el mismo tramo y el mismo contexto**. · (US-2) (Esp. v2 §T-05 "cada métrica se acompaña de su percentil"; §T-01)
- RF-9: El sistema DEBE respetar el contexto activo de nivel partido de la barra de T-03 (competencia, período/últimos N, sede, rival, días de descanso) y los de nivel evento que no sean de tramo (marcador, con/sin jugador). La dimensión `quarter` de la barra no se combina con el selector de tramo: el selector manda y el eco de contexto informa que `quarter` se ignoró en este bloque. · (US-1) (Esp. v2 §T-03; arquitectura §3.8)
- RF-10: El sistema DEBE excluir del cálculo los partidos sin play-by-play y contarlos en el eco de contexto (`games_excluded.sin_pbp`); los partidos sin prórroga no cuentan como "partido con el tramo" en Prórroga. · (US-4) (C-11; arquitectura §3.8)
- RF-11: El sistema DEBE ofrecer el desglose por partido del tramo elegido como **tabla completa T-06** (ordenable con nulos al final, selector de columnas, exportable en CSV/XLSX/PNG/PDF con metadatos del tramo). · (US-5) (Esp. v2 §T-06)
- RF-12: El sistema DEBE presentar el bloque de Cierres (C-06) en la misma pestaña Momentos, debajo del bloque por tramo, con el mismo formato (conjunto estándar, badge, desglose), sin cambiar su criterio (últimos 5 minutos con diferencia ≤ `clutch.margin` al entrar al tramo). · (US-2) (Esp. v2 §1.3 S3 Momentos; arquitectura §3.5 "C-06/F-04 migran cierres")
- RF-13: El sistema DEBE devolver nulo con razón (nunca 0) en toda métrica del tramo cuyo denominador sea 0 o cuyo dato no exista (p. ej. `blk_received` o `fouls_drawn` sin la ingesta v2 → `no_registrado`; `uso_pct` → `no_aplica`; Prórroga sin partidos con prórroga → `sin_datos`). · (US-4) (Esp. v2 §C-11)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events` (`period`, `period_type`, `clock_secs`, `s1`, `s2`, `action_type`, `sub_type`, `success`, `team_code`, `player_name`) | tabla consumida | — | existe |
| `games` (`home_score`, `away_score`, `date`, `competition_id` F-11) | tabla consumida | — | existe (+F-11) |
| `team_game_stats.period_pts` | columna consumida (verificación cruzada de puntos por cuarto) | TEXT JSON, DEFAULT NULL | agregada por F-11 |
| `GET /api/metrics/period?id=<team_code>:<tramo>` | endpoint genérico de T-05; F-04 registra el tipo `period` | shape §7.3 de la arquitectura con fichas T-01, `sample` §7.2, `context` §7.5 | endpoint de T-05; tipo `period` **NUEVO** (dueño F-04) |
| `GET /api/table/period_splits?team=<code>` | tabla T-06 con una fila por tramo (8 filas) | payload §7.6 | id de tabla **NUEVO** (dueño F-04, ya listado en arquitectura §6) |
| `GET /api/table/period_splits?team=<code>&view=partidos&window=<tramo>` | desglose por partido del tramo | payload §7.6 | parámetros `view`/`window`: PROPUESTA (no está en 00-arquitectura-transversal.md) |
| `GET /api/metrics/clutch?id=<team_code>` | tipo `clutch` registrado por T-05 (Cierres con conjunto estándar) | §7.3 | de T-05 |
| `GET /api/clutch/<team_code>` | legado | sin cambios (C-06 lo mantiene) | existe |
| Configuración: `clutch.window_secs`, `clutch.margin`, `sample.split.min/high/rel_pct`, `regression.split.k` | claves de `CONFIG_SPEC` | ya agregadas por F-13 | existen desde F-13 |

Sin cambios de esquema.

## 6. Estados de UI
Pestaña **Momentos** de la sección Equipo (`#/equipo/<team_code>/momentos`). Todo copy nuevo pasa por `t()` y se agrega a `docs/frontend.md` (marcado *nuevo*).

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selector de tramo (chips) | chips deshabilitados mientras carga la primera vez | — | — | — | 8 chips: "1.er C · 2.º C · 3.er C · 4.º C · 1.ª mitad · 2.ª mitad · Prórroga · Últ. 5 min" (*nuevo*); el activo resaltado; el tramo sin datos queda deshabilitado con `title` "Sin partidos con prórroga en la selección" (*nuevo*) |
| Bloque por tramo | spinner + "Calculando tramos..." (*nuevo*) | Equipo sin pbp: "Este equipo no tiene play-by-play importado. Reimportá sus partidos." (copy existente de Feature 04) | mensaje del backend (`error`) o "No se pudieron cargar los tramos" (*nuevo*) | `/api/*` siempre a red; si falla: "Sin conexión: no se pudieron cargar los tramos" (*nuevo*) | Título "Por tramo — <tramo>" (*nuevo*), resumen tipo Cierres (Dif, Pts F/C, récord del tramo "G-P-E", "N partido(s) con el tramo"), badge de muestra, panel del conjunto estándar con fichas, y botón "Ver partido a partido" |
| Tramo con muestra baja | — | — | — | — | valores en gris + aviso "Muestra baja (N posesiones): se muestra pero no se rankea" (*nuevo*) |
| Tabla partido a partido | spinner en la tabla | "Ningún partido tiene este tramo en la selección" (*nuevo*) | toast con el mensaje del backend | idem bloque | tabla T-06 con menú de exportación |
| Bloque Cierres (debajo) | spinner "Calculando cierres..." (copy existente) | "Sin cierres apretados: los N partido(s) con play-by-play se definieron por más de M al minuto 5:00." (copy existente) | copy existente | idem | título "Cierres (últimos 5 min, dif ≤ 10)" leído de la configuración (C-06) + mismo formato que el bloque por tramo |

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "El mismo bloque de métricas responde al selector de tramo sin recargar la pantalla." Given la pestaña Momentos de un equipo con pbp abierta, When se elige otro tramo en el selector, Then el bloque muestra los valores del nuevo tramo, la URL y el resto de la pestaña (contexto, bloque de Cierres, scroll) se conservan, y no hay recarga de página ni nueva navegación.
- CA-2: Given un equipo con pbp en la competencia, When se pide `GET /api/table/period_splits?team=<code>`, Then vuelven exactamente 8 filas (`q1…q4`, `h1`, `h2`, `pr`, `last5`) y cada una trae todas las columnas del conjunto estándar (claves de `METRICS` aplicables), con nulos con razón donde corresponda.
- CA-3: Given los 4 cuartos de un equipo, When se suman sus `pts` y sus `pts_against`, Then coinciden con los de 1.ª mitad + 2.ª mitad, y `pts(1.ª mitad) + pts(2.ª mitad) + pts(Prórroga)` coincide con la suma de los puntos finales del equipo en los partidos con pbp de la selección.
- CA-4: Given un partido con prórroga del dataset de verificación (2 de los 13 del seed), When se consulta el tramo Prórroga del equipo, Then el partido cuenta como "partido con el tramo", sus minutos son 5 por prórroga y sus puntos coinciden con el marcador de la prórroga (diferencia entre el resultado final y el marcador al terminar el 4.º cuarto).
- CA-5: Given un equipo sin ningún partido con prórroga en la selección, When se pide el tramo Prórroga, Then todas las métricas vienen en nulo con razón `sin_datos` (ninguna en 0), el chip queda deshabilitado y la UI muestra "—".
- CA-6: Given un tramo con menos de `sample.split.min` posesiones, When se muestra, Then el badge dice BAJA, los valores se ven en gris con la advertencia, OER/DER/Net traen `adj` con banda, y la ficha trae `in_population: false`.
- CA-7: Given el tramo "Últimos 5 minutos", When se compara con el bloque de Cierres del mismo equipo, Then "Últimos 5 minutos" incluye todos los partidos con pbp (también las palizas) y Cierres solo los calificados por `clutch.margin`; con `clutch.margin` suficientemente alto (p. ej. 40) ambos bloques devuelven los mismos `pts`, `pts_against` y `possessions`.
- CA-8: Given el contexto `last=5` (o `venue=local`) en la barra, When se cambia, Then todos los tramos se recalculan sobre esos partidos, el badge cambia y el eco `context` lo indica; con `quarter=1` en la URL el bloque informa `quarter` en `context.ignored`.
- CA-9: Given el desglose por partido del 3.er cuarto, When se exporta a CSV, Then el archivo contiene las mismas filas, columnas visibles y orden que la tabla, y la cabecera documenta equipo, competencia, tramo "3.er cuarto" y filtros.
- CA-10: Given un equipo con partidos sin pbp en la selección, When se consulta cualquier tramo, Then esos partidos no entran en el cálculo y `context.games_excluded.sin_pbp` los cuenta.
- CA-11: Given los puntos por cuarto calculados desde el pbp, When se comparan con `team_game_stats.period_pts` (partidos reprocesados con la ingesta v2), Then coinciden en todos los partidos del dataset de verificación (las diferencias, si las hay, quedan listadas en `progress.md`).

## 8. Fuera de alcance
- Tramos personalizados (p. ej. "minutos 30 a 35") o ventanas móviles: no los pide el cliente.
- Desglose por prórroga individual (1.ª prórroga vs 2.ª): todas las prórrogas se agregan en un único tramo.
- Rendimiento por tramo de **quintetos** o de **jugadores**: cierres por quinteto es F-06; tramo por jugador no está pedido.
- Selector de tramo para el rival como entidad propia (se ve desde su propio equipo).
- Tramos de reloj de posesión (A-05) y cortes por origen o tipo de posesión (A-02, A-03): son dimensiones de posesión de fase 3.
- Gráfico de evolución por cuarto (el cliente pide el bloque de métricas; un gráfico queda para F-18 si se pide).
- INCREMENTO DIFERIDO (→ A-06): la matriz tramo × otra dimensión se construye en A-06 reutilizando el tipo de entidad `period`.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **"Últimos 5 minutos" vs Cierres.** El cliente lista "últimos 5 minutos" entre los tramos del selector y a la vez pide "la misma información que el bloque de cierres". Decisión: "Últimos 5 minutos" usa la misma ventana temporal que Cierres (último período regular con reloj ≤ `clutch.window_secs` + prórrogas) pero **sin** filtrar por diferencia; el bloque Cierres queda aparte, con su filtro ≤ `clutch.margin`. Así el tramo es comparable con los cuartos (todos los partidos) y no duplica Cierres.
2. [DECISIÓN PROPUESTA — confirmar] **Mitades y prórroga.** 2.ª mitad = 3.er + 4.º cuarto, sin prórrogas (la prórroga tiene su propio tramo). Así 1.ª + 2.ª mitad + Prórroga = partido completo (CA-3).
3. [DECISIÓN PROPUESTA — confirmar] **Récord del tramo.** Se mantiene el criterio del bloque de Cierres (docs/api.md): un tramo cuenta como ganado si el equipo anotó más que el rival dentro del tramo; formato "G-P-E". No se usa el resultado final del partido (eso sí lo pide F-06 para quintetos en cierres).
4. [DECISIÓN PROPUESTA — confirmar] **Umbrales de muestra.** Un tramo se trata como "split de contexto" de T-02 (15/40 posesiones, K = 20). La especificación no fija umbral propio para "cuarto o tramo".
5. [DECISIÓN PROPUESTA — confirmar] **Ubicación.** El cliente dice "debajo de la sección de equipo"; la §1.3 lo ubica en la pestaña Momentos de S3 junto a Cierres. Se usa la pestaña Momentos (X-01), con el bloque por tramo arriba y Cierres debajo.
6. [DECISIÓN PROPUESTA — confirmar] **Faltas desde el play-by-play.** Las faltas cometidas del tramo se cuentan desde los eventos `foul` del equipo excluyendo técnicas de banco y de entrenador (no son faltas de jugador); las recibidas desde `foulon`. La diferencia con el box oficial en el partido completo se verifica y se registra (tarea de verificación).
7. [DECISIÓN PROPUESTA — confirmar] **Población de la ficha.** El percentil y el ranking de un tramo se calculan contra los demás equipos de la competencia en el mismo tramo y contexto (no contra los otros tramos del mismo equipo).
