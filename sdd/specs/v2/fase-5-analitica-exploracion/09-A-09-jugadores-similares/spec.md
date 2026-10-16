# Spec — A-09: Jugadores similares

> **ID:** A-09 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 09
> **Depende de:** T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)); además C-03 ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/spec.md](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/spec.md), zonas de tiro) y C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md), `player_id` y grupos de posición) según el grafo de la arquitectura §9.1; consume T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)), F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/spec.md](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md), clave `similar.top_n`) y X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md), pestañas `similares` de S4 y S7)
> **Habilita:** F-03 (completa su incremento diferido: emparejamiento propuesto por perfil)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §5 · A-09 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S4 (Similares) y S7 (Similares) · §4 F-03 (emparejamiento propuesto por perfil) · Arquitectura §3.18, §3.4, §3.6, §3.2, §4 (`similarity.py`), §6 (`GET /api/similar/<player_id>`), §9.2 I-05 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente y por qué.** "Con la base actual de jugadores, devolver los 10 jugadores de perfil más parecido a uno dado."
Vector de perfil: "USO% · distribución de tiro por zona · OR% · DR% · AS% · TO% · PPT · FT Rate · minutos por partido". "Normalizar cada
dimensión por z-score dentro de la competencia y calcular distancia euclidiana o coseno." Filtros por competencia, posición y mínimo de
minutos. "Se integra como acción dentro del perfil de jugador y del buscador." Criterio de aceptación: "Para un jugador de referencia
conocido, los resultados son reconocibles como perfiles equivalentes por alguien del ambiente." En S4 hay una pestaña "Similares: diez
jugadores de perfil más parecido" y en S7 un módulo "Similares: búsqueda por perfil en lugar de por umbral". En F-03, el
"emparejamiento propuesto por perfil" cruza este perfil con minutos y uso y debe presentarse como estimación.

**Qué existe hoy (verificado en código, rama `v2`).**
- No existe similitud de jugadores: no hay `backend/similarity.py` ni endpoint ni UI (`grep` de `similar`, `similitud` sin resultados).
- Buscador de jugadores (`frontend/js/app.js`, `renderSearch` l.1964, `_applySearch` l.2011, `_renderSearchResults` l.2045) con
  filtros por nombre, equipo, competencia, posición y rangos de métricas; consume `GET /api/search/players`
  (`backend/app.py:search_players`, l.705), que devuelve una entrada por (equipo, jugador) con promedios de tasas por partido
  (`uso_pct`, `or_pct`, `dr_pct`, `ppt_2/3/ft`, `as_pos`, …); **no** devuelve `as_pct`, `ppt` general ni `ft_rate`, ni reparto de tiro por zona.
- Las zonas de tiro (`_zones_from_shots`, `_classify_zone_11` en `backend/app.py`) operan con `shots.x`/`y` legados (siempre 0) y caen a tres
  zonas; las coordenadas reales ya se guardan (`shots.court_x`/`court_y`, ingesta v2 de F-11) pero el mapa de 11 zonas lo activa C-03.
- Fórmulas actuales de jugador (`backend/stats_engine.py:calc_player_stats`): `as_pct` = AST/FGM propio (puede superar 100 %, D-13),
  `uso_pct` sobre el partido completo del equipo (D-16), `pps` = PTS/FGA (D-15). T-05 las corrige (DA-03, DA-05, DA-06) y publica las
  claves estándar `uso_pct`, `or_pct`, `dr_pct`, `as_pct`, `to_pct`, `ppt`, `ft_rate`, `minutes`, `games`, `fg3_uso`, `paint_fga_share`,
  `mid_fga_share`.
- Identidad: hoy por nombre normalizado; C-08 agrega `player_id`, la posición de la ficha y los grupos G/F/C (`identity.position_group`).

**Qué resuelven requisitos anteriores (supuestos de esta spec).** T-05 entrega el conjunto estándar por jugador (con las fórmulas
conciliadas del glosario); T-01 entrega la población de jugadores de una competencia (≥ `sample.player.min` minutos, 60 por defecto) con
los valores de cada miembro; C-03 entrega las 11 zonas con su reparto (`share`) a partir de las coordenadas reales; C-08 entrega
`player_id`, posición y grupos; T-02 clasifica la muestra de jugador por minutos; F-13 entrega `similar.top_n` (reservada → A-09); X-01
entrega las pestañas (`similares` de S4 y de S7 registradas deshabilitadas) y el router.

**Qué queda para A-09.** El perfil vectorial, su normalización, la distancia, el endpoint y las dos pantallas (pestaña de Jugador, módulo
de Explorar con acción desde el buscador), el protocolo de validación con alguien del ambiente y la activación del bloque
"emparejamiento propuesto por perfil" del informe de F-03.

## 1. Objetivo
Que, dado un jugador, el usuario obtenga los diez jugadores de perfil de juego más parecido de la misma competencia, con la
distancia explicada y filtros por posición y minutos, y que ese perfil alimente la sugerencia por perfil del informe previo.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5 A-09 (texto completo y CA); §1.3 S4 (pestaña Similares) y S7 (módulo Similares); §4 F-03 (emparejamiento propuesto
  por perfil, advertencia "estimación"); §3 T-01 (población de jugadores: 60 minutos); §3 T-02 (jugador: mínimo 60, alto 200 minutos);
  §3 T-05 (conjunto estándar); §6 glosario (USO%, OR%, DR%, TO%, PPT, FT Rate).
- `docs/frontend.md` §Vistas (Buscar/Explorar, Jugador); `docs/metrics.md` (USO%, OR%, DR%, AS%, TO%, PPT, FT Rate, shot chart por zonas);
  `docs/api.md` (`GET /api/search/players`, `GET /api/player/...`, `GET /api/shots/...`).
- `00-arquitectura-transversal.md` §3.18 (similitud en Python puro, z-score, distancia euclidiana, ~200 jugadores × 10 dimensiones), §3.4
  (identidad, grupos de posición, DA-11), §3.6 (población de jugadores), §3.2 (`similar.top_n`), §4 (`similarity.py`), §6 (`GET /api/similar/<player_id>`),
  §9.2 (I-05), §7.4 (nulos con razón).
- Specs previos: `sdd/specs/06-buscador-jugadores/` (buscador), `sdd/specs/10-mapa-tiro-equipo/` (zonas), `sdd/specs/13-dedup-jugadores/`
  (identidad, rama `dev`).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver qué jugadores de la competencia se parecen más a uno dado, para reconocer perfiles equivalentes
  (reemplazos, referentes, rivales de rol parecido).
- US-2: Como analista, quiero filtrar los parecidos por competencia, posición y mínimo de minutos, para que la comparación sea relevante
  y de muestra confiable.
- US-3: Como analista, quiero ver en qué dimensiones se parecen y en cuáles difieren dos jugadores y por qué se calculó esa distancia,
  para auditar el resultado en lugar de confiar a ciegas.
- US-4: Como entrenador, quiero llegar a "Similares" desde el perfil de un jugador y desde el buscador, para no reconstruir la búsqueda.
- US-5: Como entrenador que prepara un partido, quiero que el informe previo proponga, para cada amenaza rival, jugadores propios de perfil
  parecido con sus minutos y uso, marcado como estimación, para orientar el entrenamiento y los emparejamientos.
- US-6: Como dueño del producto, quiero un protocolo de validación con alguien del ambiente, para comprobar que "perfil parecido" es
  reconocible antes de darlo por bueno.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE devolver, para un jugador de referencia y una competencia, los `similar.top_n` jugadores (10 por defecto) de
  perfil más parecido, ordenados del más parecido al menos, sin incluir al jugador de referencia. · (US-1) (Esp. v2 §A-09 "los 10
  jugadores de perfil más parecido"; Arquitectura §3.18, §3.2)
- RF-2: El perfil DEBE tener nueve dimensiones: **USO%**, **distribución de tiro por zona**, **OR%**, **DR%**, **AS%**, **TO%**,
  **PPT**, **FT Rate** y **minutos por partido**, con las definiciones del conjunto estándar de T-05 (glosario v2 §6: USO% = posesiones
  terminadas por el jugador / posesiones del equipo con el jugador en cancha; OR% = rebotes ofensivos propios / (rebotes ofensivos propios +
  rebotes defensivos del rival); DR% = rebotes defensivos propios / (rebotes defensivos propios + rebotes ofensivos del rival); TO% =
  pérdidas / posesiones; PPT = puntos anotados desde tiros de campo / tiros de campo intentados; FT Rate = tiros libres intentados / tiros de
  campo intentados; minutos por partido = minutos jugados / partidos jugados). · (US-1) (Esp. v2 §A-09 "Vector de perfil", §6 glosario)
- RF-3: La distribución de tiro por zona DEBE representarse como el reparto de intentos de tiro de campo entre las zonas (11 zonas de C-03
  cuando la competencia tiene coordenadas; el reparto de pintura / media distancia / triples del conjunto estándar cuando no). · (US-1)
  (Esp. v2 §A-09; §T-05 "reparto por zona")
- RF-4: Cada dimensión DEBE normalizarse con z-score (valor − media) / desvío, calculado **dentro de la competencia** sobre la población de
  jugadores de T-01 (≥ `sample.player.min` minutos). Una dimensión sin variación (desvío 0) NO DEBE usarse. · (US-1) (Esp. v2 §A-09
  "Normalizar cada dimensión por z-score dentro de la competencia"; §T-01 población de jugadores)
- RF-5: La distancia entre dos jugadores DEBE ser **euclidiana** sobre los z-scores, con peso igual por dimensión (la distribución por zona
  cuenta como **una** dimensión, no como once) y normalizada por la cantidad de dimensiones disponibles en ambos; la similitud mostrada
  (0–100) DEBE derivarse de la distancia con una fórmula monótona documentada. · (US-1, US-3) (Esp. v2 §A-09 "distancia euclidiana o coseno";
  decisión en §9)
- RF-6: El sistema DEBE permitir filtrar los resultados por **competencia**, por **posición** (grupos G / F / C de C-08, o "misma posición que
  el jugador de referencia") y por **mínimo de minutos** (nunca menor que `sample.player.min`). · (US-2) (Esp. v2 §A-09 "Filtros por
  competencia, posición y mínimo de minutos"; Arquitectura §3.4, DA-11)
- RF-7: Una dimensión nula (sin dato: sin tiros, sin posesiones, sin zonas con coordenadas) NO DEBE reemplazarse por 0 ni por la media: el par
  se compara solo en las dimensiones disponibles en ambos jugadores; un candidato con menos de 6 de las 9 dimensiones comparables DEBE
  excluirse y contarse con su razón (`perfil_incompleto`). · (US-1, US-3) (Esp. v2 §C-11; Arquitectura §7.4)
- RF-8: Los candidatos DEBEN pertenecer a la población de muestra suficiente (no baja, T-02): jugadores con menos minutos que
  `sample.player.min` NO DEBEN aparecer entre los resultados. Si el jugador de referencia es de muestra baja, el sistema DEBE calcular
  igualmente y advertirlo. · (US-2) (Esp. v2 §T-02 "queda fuera de rankings… y sugerencias automáticas"; §T-01)
- RF-9: Cada resultado DEBE mostrar: posición, equipo, partidos, minutos por partido, similitud (0–100), distancia, las dimensiones donde más
  se parece al jugador de referencia, las dimensiones donde más difiere y el valor de las nueve dimensiones junto al de la referencia. · (US-3)
  (Esp. v2 §A-09; transparencia del método)
- RF-10: La pantalla DEBE explicar el método (dimensiones, z-score dentro de la competencia, distancia euclidiana, filtros aplicados) y la
  población de referencia (cantidad de jugadores y criterio). · (US-3) (Esp. v2 §T-01 "población de referencia")
- RF-11: La búsqueda DEBE ofrecerse como pestaña "Similares" en la sección Jugador y como pestaña "Similares" en Explorar, y como acción
  "Similares" en cada fila del buscador de jugadores. · (US-4) (Esp. v2 §A-09 "acción dentro del perfil de jugador y del buscador"; §1.3 S4, S7)
- RF-12: Los resultados DEBEN poder exportarse con el menú de exportación de T-06 (CSV, XLSX, PNG, PDF) con los metadatos de contexto
  (jugador de referencia, competencia, filtros). · (US-4) (Esp. v2 §T-06)
- RF-13: El resultado DEBE ser determinista: mismo jugador, misma competencia y mismos filtros devuelven el mismo orden; a igual distancia se
  ordena por nombre. · (US-1) (verificabilidad de la validación, US-6)
- RF-14: El jugador de referencia DEBE pertenecer a la competencia elegida (con al menos un partido jugado); si no, el sistema DEBE informarlo.
  La comparación entre jugadores de competencias distintas NO DEBE hacerse (los z-score no son comparables). · (US-2) (Esp. v2 §A-09 "dentro
  de la competencia")
- RF-15: El sistema DEBE completar el incremento diferido de F-03: habilitar el bloque "emparejamiento propuesto por perfil" del informe
  previo, proponiendo para cada amenaza ofensiva del rival (los jugadores de mayor USO% de `rival_threats`) los jugadores del equipo propio de
  perfil más parecido, cruzados con sus minutos por partido y su USO%, siempre rotulado como **estimación** y sin presentarlo como marcaje
  individual. · (US-5) (Esp. v2 §F-03 "Emparejamiento propuesto por perfil… marcada como estimación"; Arquitectura §9.2 I-05)
- RF-16: La cantidad de resultados DEBE leerse de la configuración (`similar.top_n`) y no estar fija en el código; el cambio DEBE reflejarse
  sin reiniciar. · (US-1) (Esp. v2 §T-02 "ninguno debe quedar fijo en el código"; Arquitectura §3.2)
- RF-17: El sistema DEBE incluir un protocolo de validación manual con alguien del ambiente (qué jugadores de referencia, cómo se muestran
  los resultados, qué se registra y cuándo se aprueba) que se ejecute y registre en `progress.md` antes de cerrar el requisito. · (US-6)
  (Esp. v2 §A-09 CA cualitativo)
- RF-18: Todo copy nuevo DEBE estar en español rioplatense y los números en formato es-UY. · (US-1) (Arquitectura §3.20; DA-21 resuelta,
  DA-36)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| Esquema SQLite | — | sin cambios (cálculo on-the-fly; nada se persiste) | — |
| `GET /api/similar/<int:player_id>` | endpoint | query `competition` (id; default: la más reciente del jugador), `position` ∈ {`G`,`F`,`C`,`mismo`}, `min_minutes` (≥ `sample.player.min`), `top_n` (3–50; default `similar.top_n`) → `{reference, competition, filters, dimensions[], population, results[], excluded, method, reason}`; 400 `parametro_invalido`/`competencia_inexistente`; 404 `no_encontrado` | **NUEVO** (dueño A-09, arquitectura §6) → `docs/api.md` |
| `backend/similarity.py` | módulo | `similar_players(...)`, `similar_payload(...)`, `profile_suggestions(...)` | **NUEVO** (arquitectura §4) → `docs/architecture.md` |
| `GET /api/prepare` (F-03) | endpoint existente | `suggestions_profile` deja de ser `null`: `{estimate: true, method, rows[{threat, candidates[]}]}` | modificado (F-03, completa su incremento) |
| `app_config`: `similar.top_n` | configuración | int 10 (3–50); reservada por F-13, A-09 la activa | existente (F-13) |
| `population.population("player", …)`, `shot_zones.zone_table`, `identity.*`, `sample` | consumidos | valores del conjunto estándar, reparto por zona, posición y muestra | T-01/C-03/C-08/T-02 |
| Tablas/columnas | — | ninguna nueva | — |

## 6. Estados de UI
Componentes: **pestaña Similares de Jugador**, **módulo Similares de Explorar** (con selector de jugador) y **acción "Similares"** en el
buscador; bloque **"Perfil parecido en tu plantel (estimación)"** del informe de F-03. Copy nuevo → `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Pestaña Similares (S4) y módulo Similares (S7) | "Buscando jugadores parecidos…" | Sin resultados: "Ningún jugador cumple los filtros." · `muestra_baja` de la referencia: aviso "Este jugador tiene pocos minutos ({m} min): el parecido es orientativo." · sin población: "La competencia no tiene suficientes jugadores para comparar." · jugador sin minutos: "Este jugador no tiene minutos en esta competencia." | "No se pudieron buscar jugadores parecidos" + "Reintentar" | "Sin conexión: se muestran los últimos resultados cargados" o "Sin conexión" | Tabla de hasta N filas: posición, equipo, partidos, MPG, barra de similitud, "Se parecen en…" / "Difieren en…", fila expandible con las nueve dimensiones frente a la referencia |
| Selector de jugador (S7) | "Cargando jugadores…" | "Elegí un jugador para ver sus parecidos." | "No se pudo cargar la lista de jugadores" | idem | buscador por nombre + equipo |
| Filtros | deshabilitados mientras carga | — | — | — | Competencia · Posición ("Todas", "Base/Escolta (G)", "Alero/Ala-pívot (F)", "Pívot (C)", "Misma posición") · Minutos mínimos |
| Método | — | — | — | — | Texto: "Parecido = distancia en nueve dimensiones estandarizadas dentro de la competencia ({n} jugadores con ≥ {m} min)" |
| Bloque F-03 | oculto mientras no hay datos | oculto si `suggestions_profile` es `null` o sin filas | oculto | oculto | "Perfil parecido en tu plantel — estimación" con aviso "No es marcaje individual: FIBA no registra la asignación defensiva" |

## 7. Criterios de aceptación
- CA-1 (CA del cliente): **"Para un jugador de referencia conocido, los resultados son reconocibles como perfiles equivalentes por alguien
  del ambiente."** Given el protocolo de validación del §9 con 5 jugadores de referencia (con la competencia real más completa disponible) y
  una persona del ambiente (entrenador o analista de la FUBB) que ve cada top 10 sin las cifras, When marca cada resultado como "equivalente",
  "parecido" o "no", Then en al menos 4 de las 5 referencias 6 o más de los 10 resultados quedan marcados "equivalente" o "parecido"; el
  resultado y las observaciones se registran en `progress.md`.
- CA-2: Given un jugador con muestra suficiente, When se piden sus parecidos, Then devuelve exactamente `similar.top_n` resultados distintos
  (o menos si no hay tantos candidatos), el jugador de referencia no figura, el orden es por distancia ascendente y a igual distancia por nombre.
- CA-3: Given un resultado cualquiera, When se recalcula a mano (script ad hoc) la distancia con los valores del conjunto estándar de
  `GET /api/metrics/player` y las medias y desvíos de la población, Then coincide con `distance` y `similarity` del resultado (tolerancia de
  redondeo de 4 decimales) y el ranking es el mismo.
- CA-4: Given el filtro de posición "G", When se piden los parecidos, Then todos los resultados tienen `position_group = G`; con "Misma
  posición" todos comparten el grupo del jugador de referencia (y si el jugador no tiene grupo, devuelve 400 con mensaje); con
  `min_minutes` = 200 todos los resultados tienen ≥ 200 minutos; con `min_minutes` menor que `sample.player.min` responde 400.
- CA-5: Given un jugador sin tiros de campo (PPT, FT Rate y zonas nulos) en la selección, When es referencia o candidato, Then esas
  dimensiones no se imputan (ni 0 ni media): el par se compara en las restantes; un candidato con menos de 6 dimensiones comparables queda
  fuera y se cuenta en `excluded.perfil_incompleto`.
- CA-6: Given jugadores con menos de `sample.player.min` minutos, When se arma el ranking, Then ninguno aparece entre los resultados; y dado
  un jugador de referencia con esa muestra baja, Then el endpoint responde 200 con `reference.in_population = false` y la pantalla muestra
  la advertencia.
- CA-7: Given dos jugadores A y B con perfil completo, When se calcula la distancia A→B y B→A (jugador B como referencia), Then ambas son
  iguales; y un jugador con perfil idéntico a la referencia (distancia 0) tiene similitud 100.
- CA-8: Given una competencia con coordenadas de tiro, When se calcula el perfil, Then la dimensión de zonas usa las 11 zonas de C-03;
  Given una competencia donde menos del 90 % de los intentos tiene coordenadas, Then usa el reparto de pintura / media distancia /
  triples del conjunto estándar y `population.zone_mode` lo indica ("3").
- CA-9: Given el perfil de un jugador (S4 › Similares), When se abre la pestaña, Then se muestran los parecidos de la competencia activa con
  los filtros; y Given el buscador de jugadores de S7, When se toca "Similares" en una fila, Then se abre Explorar › Similares con ese jugador
  ya elegido (`#/explorar/similares?player=<id>`) y los mismos resultados.
- CA-10: Given los resultados en pantalla, When se usa el menú de exportación, Then el CSV, el XLSX, el PNG y el PDF traen el jugador de
  referencia, la competencia, los filtros aplicados y una fila por resultado con sus nueve dimensiones.
- CA-11: Given `GET /api/similar/999999` o `competition` inexistente o `position=Z` o `top_n=2` o `top_n=99`, When se llama, Then responde
  404 `no_encontrado` ("Jugador no encontrado") / 400 `competencia_inexistente` / 400 `parametro_invalido` con mensaje en español.
- CA-12 (incremento de F-03): Given el informe previo de F-03 de un equipo contra un rival con jugadores de alto USO%, When se genera
  (`GET /api/prepare`), Then `suggestions_profile` trae `estimate: true` y, para cada amenaza de `rival_threats.top_usage`, hasta 3
  jugadores propios de perfil parecido con `similarity`, `minutes_per_game` y `uso_pct`; la pantalla muestra el bloque rotulado
  "estimación" con la aclaración "No es marcaje individual"; una amenaza sin perfil suficiente figura con su razón en lugar de candidatos.
- CA-13: Given `similar.top_n` cambiado a 5 en Configuración, When se recarga la pestaña, Then se muestran 5 resultados; al restablecer, 10.
- CA-14: Given un viewport de 375 px, When se abre Similares, Then la tabla se adapta (filas apiladas o scroll interno de la tabla) sin
  scroll horizontal de la página y los filtros caben en pantalla.
- CA-15: Given una competencia con 74 jugadores en la población, When se piden los parecidos con la caché fría y luego caliente, Then la
  respuesta fría tarda menos de 3 s y la caliente menos de 1,5 s (medición registrada en `progress.md`).

## 8. Fuera de alcance
- Comparar jugadores de competencias distintas (los z-score no son comparables entre universos) y fichas del mismo jugador en equipos
  distintos (cada ficha es por equipo, arquitectura §3.4).
- Otras métricas de distancia (coseno, Mahalanobis) y pesos configurables por dimensión; el método es fijo (decisión en §9).
- Similitud por quintetos, equipos o contextos (solo jugadores).
- Dimensiones que dependen del motor de posesiones (segundos de posesión, tramo de reloj, tipo de ataque: A-01…A-05) o de la identidad
  ampliada (altura, edad: F-16): el vector de nueve dimensiones es el del cliente.
- Recomendaciones de fichaje o de reemplazo con criterio económico; ranking de "mejor que".
- Emparejamiento por complementariedad (jugador que contrarreste el perfil): la sugerencia de F-03 es por **parecido** (§9).
- Persistir resultados, historial de búsquedas o consultas guardadas (F-10 tiene las suyas).
- Gráfico radar comparativo del par de jugadores en la pantalla de Similares (la fila expandida muestra los valores; el radar de
  Comparar sigue siendo de S6).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **Euclidiana, no coseno.** Se usa distancia euclidiana sobre z-scores. El coseno compara solo la forma
  del vector y descarta la magnitud: un especialista de rol con la mitad de uso y de producción de una estrella, pero con el mismo reparto,
  saldría como "idéntico" a la estrella, que es justamente lo que un entrenador no reconoce como perfil equivalente. Con z-scores centrados
  el coseno además se vuelve inestable cuando el vector es chico (jugadores cerca de la media en todo). La euclidiana trata el nivel de uso,
  de producción y de minutos como parte del perfil.
- [DECISIÓN PROPUESTA — confirmar] **Peso de la dimensión de zonas.** Once componentes de zona no pueden pesar once veces más que el USO%.
  Cada una de las nueve dimensiones pesa igual; la de zonas pesa 1/11 por componente (media de los cuadrados de las diferencias de
  zona). La distancia final es la raíz del promedio, sobre las dimensiones disponibles en ambos, de la diferencia cuadrática estandarizada
  (`d` en "desvíos estándar de diferencia promedio"); la similitud es `100 / (1 + d)` (0 desvíos → 100; 1 desvío → 50; 2 desvíos → 33).
- [DECISIÓN PROPUESTA — confirmar] **Población de z-score.** Los jugadores de la competencia con ≥ `sample.player.min` minutos (la población
  de T-01), siempre con toda la competencia (sin `last` ni otros filtros de contexto): el perfil es un rasgo estable, no un momento. El filtro de
  mínimo de minutos del usuario solo restringe los candidatos mostrados; no cambia las medias y desvíos.
- [DECISIÓN PROPUESTA — confirmar] **Mínimo de minutos.** No puede ser inferior a `sample.player.min` (T-02 excluye muestra baja de las
  sugerencias automáticas); por defecto es ese umbral. Subirlo está permitido (p. ej. 200 = muestra alta).
- [DECISIÓN PROPUESTA — confirmar] **Zonas con y sin coordenadas.** Con ≥ 90 % de intentos con coordenadas en la población se usan las 11 zonas
  de C-03; si no, el reparto pintura / media distancia / triples del conjunto estándar. Un jugador con menos de 90 % de sus intentos con
  coordenadas queda sin dimensión de zonas (no se imputa).
- [DECISIÓN PROPUESTA — confirmar] **Mínimo de dimensiones comparables.** 6 de 9. Con menos, la comparación sería sobre un vector demasiado
  parcial y el parecido no es confiable.
- [DECISIÓN PROPUESTA — confirmar] **Posición.** Filtro por grupo G / F / C (DA-11) y la opción "Misma posición". Por defecto no se filtra:
  un base de ataque y un ala pueden parecerse, y la posición FIBA es un rol por partido, no un atributo estable (D-23).
- [DECISIÓN PROPUESTA — confirmar] **Compañeros de equipo.** Se muestran como cualquier otro candidato (un compañero puede ser el jugador más
  parecido); el filtro de equipo no se ofrece en esta versión.
- [DECISIÓN PROPUESTA — confirmar] **Interpretación del "emparejamiento propuesto por perfil" de F-03.** El cliente dice "qué jugador propio
  puede asumir a cada amenaza rival, cruzando el perfil de similitud con minutos y uso". Se interpreta como: para cada amenaza rival, los
  jugadores propios de **perfil más parecido** (candidatos para emular a esa amenaza en el entrenamiento o para ser considerados en su
  emparejamiento), mostrados con sus minutos por partido y su USO% para juzgar disponibilidad. No se crea un puntaje compuesto nuevo
  (similitud × minutos × uso) porque el cliente no define pesos; el cruce es de presentación. Si el cliente pretendía un criterio de
  complementariedad (el perfil que mejor contrarresta a la amenaza), hay que definirlo aparte.
  [NEEDS CLARIFICATION: confirmar con el cliente esta interpretación antes de implementar RF-15; no bloquea RF-1…RF-14.]
- [DECISIÓN PROPUESTA — confirmar] **Protocolo de validación manual con alguien del ambiente (RF-17).** (1) Persona: entrenador o analista
  de la FUBB que conozca a los jugadores de la competencia, que no haya visto antes el resultado. (2) Datos: la competencia real más completa
  disponible (no solo los 13 partidos del seed, que dan pocos minutos por jugador). (3) Referencias: 5 jugadores de roles distintos (un base
  organizador, un escolta anotador, un ala, un ala-pívot y un pívot reboteador), elegidos por la persona o por el equipo con su acuerdo.
  (4) Presentación: lista de los 10 resultados de cada referencia con nombre, equipo, posición y minutos por partido, sin similitud ni
  distancia. (5) Marcado: por cada resultado, "equivalente" (juega parecido), "parecido" (comparte rasgos principales) o "no". (6) Registro
  en `progress.md`: tabla referencia × resultado × marca, observaciones y, para los "no", la dimensión que la persona cree que falló.
  (7) Aprobación: al menos 4 de las 5 referencias con 6 o más resultados "equivalente" o "parecido". (8) Si no se aprueba: se anotan las
  dimensiones señaladas, se evalúa un cambio de pesos o de dimensiones **como decisión nueva del cliente** y se repite el protocolo; no se
  ajustan parámetros hasta aprobar sin registrarlo.
- [DECISIÓN PROPUESTA — confirmar] **Definición de "minutos por partido".** Minutos jugados / partidos jugados (sin DNP) en la competencia,
  con la definición de `minutes` y `games` de T-05; no se normaliza por la duración del partido (las prórrogas cuentan por sus minutos reales).
