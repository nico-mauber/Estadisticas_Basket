# Spec — F-18: Tendencias y evolución configurable

> **ID:** F-18 · **Prioridad:** P2 · **Fase y orden:** 5·05
> **Depende de:** T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)) — y, por el grafo corregido de la arquitectura (§9.1), T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · T-04 ([../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md)) — más T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)), F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/spec.md](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md)), C-11 ([../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/spec.md](../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/spec.md)) y X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md))
> **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-18 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S3 "Game log" y S4 "Tendencias" · Arquitectura §3.5, §3.8, §3.11, §4 (`trends.py`), §6 (`GET /api/trends`), §8 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §4 F-18):** "El gráfico de evolución actual muestra siempre las mismas dos series. Debe convertirse en un componente configurable, y sumarse la lectura de tendencia."
- "Selector de series a graficar: cualquier métrica del conjunto estándar de T-05, hasta tres simultáneas con eje secundario."
- "Pares preconfigurados de uso frecuente: puntos anotados frente a puntos recibidos, OER frente a DER, eFG% frente a TO%."
- "Gráfico de diferencia de puntos por partido, con línea de cero y color según resultado."
- "Media móvil configurable de 3, 5 o 10 partidos, superpuesta a la serie cruda."
- "Indicador de tendencia: comparación de los últimos N partidos contra el resto de la temporada, con el delta y su significancia según la muestra."
- "Marcado de hitos sobre el eje: cambios de racha, partidos como local o visitante, ausencias de jugadores clave."
- "Disponible en equipo, jugador y quinteto, y exportable como imagen (T-06)."
- **Criterio de aceptación del cliente:** "el mismo componente sirve para las tres entidades y permite cambiar de métrica sin recargar la pantalla."

El mapa de secciones ubica el módulo en S3 Equipo → pestaña **Game log** ("Partido a partido, evolución configurable y tendencias") y en S4 Jugador → pestaña **Tendencias** ("Medias móviles, últimos N contra el resto de la temporada, hitos"); el quinteto lo aloja la pestaña Quintetos de S3.

**Qué existe hoy (verificado en código y docs):**
- `frontend/js/charts.js` tiene dos gráficos de evolución **fijos**: `drawEvolution(canvasId, gameLog, leagueOerAvg)` (línea 194: OER con eje izquierdo, eFG% con eje `y2` derecho y una línea punteada con el OER promedio de liga) y `drawPlayerEvolution(canvasId, gameLog)` (línea 269: Puntos y OER; el DNP se omite como hueco, C-11 RF-10). Se invocan desde `frontend/js/app.js` en la vista Equipo (`drawEvolution("chart-evo", filtered, lg?.oer?.avg)`, línea ≈1258) y en la de Jugador (`drawPlayerEvolution("chart-player-evo", log)`, línea ≈1915). Ambos reciben el `game_log` ya filtrado en el cliente (competencia, últimos N) y no tienen selector de series, media móvil, diferencia de puntos, tendencia ni hitos (`docs/frontend.md` l.96–97).
- El `game_log` de equipo (`backend/app.py` `team_stats`, l.≈400) trae por partido las métricas ya calculadas (`oer`, `der`, `efg_pct`, `pts`, `opp_pts`…), `home_away` ("L"/"V"), `opponent`, `date`; el de jugador agrega `played` (false = DNP). No hay serie de quinteto.
- No existe ninguna prueba estadística en el repositorio ni un lugar donde compare "últimos N" contra "el resto": el filtro actual "Últ. 5 · Últ. 3" (`_filteredLog`) solo **recorta** el game log.

**Qué resolvieron features/requisitos anteriores (de esta misma corrida de specs):**
- T-05 define el conjunto estándar (≈ 60 claves con `direction`, `fmt`, `entities`) y el endpoint genérico; T-06 (plan §4.3) agrega `metrics_catalog.load_game_bundles(req)` —la serie **partido a partido** de cualquier entidad: "F-18 necesita la serie por partido"— y `stats_engine.sum_bundles`, además del menú de exportación (`export-menu.js`, PNG por `foreignObject` que convierte los `<canvas>` en imágenes).
- T-03 aporta el contexto (competencia, período, sede, rival, cuarto, marcador, con/sin jugador) y T-04 la base (`partido`, `por40`, `por100`); T-02 el badge y los umbrales de muestra; F-13 las claves `trends.default_ma` y `trends.last_n` (Arq. §3.2, dueño F-18).
- X-01 ya registró las pestañas `gamelog` (S3 y S4) y `tendencias` (S4).

**Qué queda para F-18:** el servicio de series y tendencia (`trends.py`), un único componente de gráfico configurable para las tres entidades, el gráfico de diferencia de puntos, el indicador de tendencia con su prueba de significancia, los hitos, la exportación como imagen y la sustitución de los dos gráficos fijos.

## 1. Objetivo
Reemplazar los dos gráficos de evolución fijos por un único componente configurable —hasta tres métricas del conjunto estándar con media móvil, pares preconfigurados, diferencia de puntos por partido, indicador de tendencia con significancia e hitos— que sirve para equipo, jugador y quinteto, cambia de métrica sin recargar la pantalla y se exporta como imagen.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 F-18 (completo), §1.3 S3 "Game log" y S4 "Tendencias", §3 T-01, T-02 (muestra), T-03 (contexto), T-04 (base), T-05 (conjunto estándar), T-06 (exportación como imagen), §2 C-11 (nulos; DNP en evolución), §2 C-02 (promedio de liga en la evolución).
- `docs/frontend.md` §Charts (`drawEvolution`, `drawPlayerEvolution`), §Reglas de nulos (el DNP queda como hueco); `docs/metrics.md` (DNP, fórmulas de métricas); `docs/api.md` (`/api/team`, `/api/player`: `game_log`).
- Arquitectura §3.5 (conjunto estándar, claves y direcciones), §3.8 (contexto y base), §3.11 (exportación PNG), §4 (`trends.py`: `trend_series(entity_type, entity_id, metric_keys, comp_id, ctx, ma) -> dict`, `recent_vs_rest(...) -> dict`), §6 (`GET /api/trends`: query `entity`, `id`, `metrics`, `ma`; Ctx; Base), §3.2 (`trends.default_ma` = 5, `trends.last_n` = 5), §7.1–§7.5, §8 (`export-menu.js`, `exporters.js`).
- Specs/planes previos de esta corrida: T-06 `plan.md` §4.3 (`load_game_bundles`, `sum_bundles`), T-04 `plan.md` (`apply_base`), X-01 `plan.md` §6.2 (pestañas), C-11 spec (DNP como hueco), F-06 `plan.md` (tabla y enlace de quintetos).

## 3. Historias de usuario
- US-1: Como entrenador, quiero elegir qué métricas ver partido a partido (hasta tres a la vez), para analizar la evolución que me interesa sin quedar atado a OER y eFG%.
- US-2: Como entrenador, quiero partir de pares útiles ya armados (puntos anotados vs recibidos, OER vs DER, eFG% vs TO%), para llegar a la lectura habitual en un toque.
- US-3: Como entrenador, quiero ver la diferencia de puntos de cada partido con su color de resultado, para recorrer la temporada de un vistazo.
- US-4: Como analista, quiero una media móvil superpuesta a la serie cruda, para separar la tendencia del ruido de un partido.
- US-5: Como analista, quiero saber si los últimos N partidos difieren del resto de la temporada y con qué respaldo estadístico, para no confundir una racha corta con un cambio real.
- US-6: Como entrenador, quiero ver sobre el eje los hitos del equipo (rachas, local o visitante, ausencias de jugadores clave), para explicar los cambios de rendimiento.
- US-7: Como entrenador, quiero el mismo gráfico para un equipo, un jugador y un quinteto, y poder exportarlo como imagen, para llevarlo al cuerpo técnico.

## 4. Requisitos funcionales

**Series y selector**
- RF-1: El sistema DEBE permitir graficar partido a partido **cualquier métrica del conjunto estándar de T-05 aplicable a la entidad** (equipo, jugador o quinteto), con selector de hasta **tres series simultáneas**, tomando etiquetas, formato y dirección del catálogo de métricas. · (US-1) (Esp. v2 §F-18 "Selector de series"; §T-05)
- RF-2: El sistema DEBE asignar las series a un eje principal y a un **eje secundario** según su escala: las métricas de la misma escala (porcentajes; razones tipo OER/DER/PPT; conteos y ritmos) comparten eje; una métrica de otra escala va al eje secundario. Como solo hay dos ejes, el sistema DEBE impedir (con aviso) elegir tres métricas de tres escalas distintas. · (US-1) (Esp. v2 §F-18 "con eje secundario")
- RF-3: El sistema DEBE ofrecer los **pares preconfigurados**: puntos anotados frente a puntos recibidos (`pts` / `pts_against`), OER frente a DER (`oer` / `der`) y eFG% frente a TO% (`efg_pct` / `to_pct`), aplicables con un toque y modificables después. · (US-2) (Esp. v2 §F-18 "Pares preconfigurados")
- RF-4: El sistema DEBE mostrar, además, el **promedio de la competencia** como línea de referencia de cada serie cuando existe población comparable (equipo y jugador), conservando el comportamiento actual del gráfico ("OER liga Ø"); para el quinteto no hay referencia (nulo `sin_universo`). · (US-1) (Esp. v2 §C-02, §T-01; docs/frontend.md)

**Diferencia de puntos**
- RF-5: El sistema DEBE ofrecer un **gráfico de diferencia de puntos por partido** (barras) con línea de cero y **color según el resultado del partido** (victoria / derrota). Para el equipo la diferencia es `pts − pts_against`; para el jugador, su `plus_minus` en el partido; para el quinteto, `pts − pts_against` mientras estuvo en cancha. El color es siempre el del resultado del equipo en ese partido. · (US-3) (Esp. v2 §F-18 "Gráfico de diferencia de puntos")

**Media móvil**
- RF-6: El sistema DEBE superponer a cada serie cruda una **media móvil configurable de 3, 5 o 10 partidos** (por defecto `trends.default_ma`), con la opción de ocultarla. La media móvil de un partido es el promedio simple de los últimos *k* valores válidos de la serie hasta ese partido (los partidos sin valor no cuentan ni se rellenan); antes de reunir *k* valores no se dibuja. · (US-4) (Esp. v2 §F-18 "Media móvil configurable")

**Tendencia**
- RF-7: El sistema DEBE calcular, para cada serie, el **indicador de tendencia**: comparación de los **últimos N partidos** de la selección (por defecto `trends.last_n`) contra el **resto**, con el **delta** (últimos N − resto, cociente de totales de cada grupo) en las unidades de la métrica, su valor relativo, su sentido (mejora / empeora según la dirección de la métrica) y su **significancia estadística según la muestra** (prueba de Welch sobre los valores por partido). · (US-5) (Esp. v2 §F-18 "Indicador de tendencia")
- RF-8: Si alguno de los dos grupos tiene menos de 3 partidos con valor, el sistema DEBE devolver el indicador como nulo con razón `muestra_insuficiente` (nunca una conclusión) y mostrar el badge de muestra de T-02 sobre la comparación. · (US-5) (Esp. v2 §T-02, §C-11)

**Hitos**
- RF-9: El sistema DEBE marcar sobre el eje los **hitos**: (a) **cambios de racha** (el partido que corta una racha de al menos `trends.streak_min` victorias o derrotas consecutivas); (b) **local o visitante** de cada partido; (c) **ausencias de jugadores clave** del equipo (partido en que un jugador clave no jugó estando dentro del período en que sí jugó). · (US-6) (Esp. v2 §F-18 "Marcado de hitos")
- RF-10: El sistema DEBE definir y mostrar qué es un **jugador clave**: los `trends.key_players` jugadores del equipo con más minutos en la selección; el detalle de cada hito (racha, nombres) DEBE verse al pasar el cursor o tocar el marcador. · (US-6) (Esp. v2 §F-18; orquestador: "definir 'clave'")

**Entidades y componente**
- RF-11: El sistema DEBE usar **un único componente** para equipo, jugador y quinteto: el mismo selector, el mismo gráfico, el mismo indicador de tendencia y la misma exportación; solo cambia el identificador de entidad. · (US-7) (Esp. v2 §F-18 criterio de aceptación)
- RF-12: El componente DEBE **cambiar de métrica, de media móvil o de N sin recargar la pantalla**: redibuja el gráfico con una nueva consulta y conserva entidad, contexto y base. · (US-1, US-7) (Esp. v2 §F-18 criterio de aceptación)
- RF-13: El componente DEBE aparecer en S3 Equipo → Game log (equipo), S4 Jugador → Tendencias (jugador) y en el detalle del quinteto seleccionado de S3 Equipo → Quintetos (quinteto), y DEBE **reemplazar** a los dos gráficos de evolución fijos actuales. · (US-7) (Esp. v2 §1.3 S3/S4)

**Contexto, base, nulos y muestra**
- RF-14: El sistema DEBE respetar el contexto de T-03 (competencia, período, sede, rival, cuarto, marcador, con/sin jugador) y la base de T-04 (`partido`, `por40`, `por100`, `total`) para construir la serie y devolver el eco `context`; el filtro de período del contexto acota el universo y el "últimos N" del indicador se calcula **dentro** de esa selección. · (US-1) (Esp. v2 §T-03, §T-04)
- RF-15: Un partido sin valor para una métrica DEBE quedar en el eje como **hueco** (sin punto), con razón (`dnp`, `sin_intentos`, `sin_datos`, `sin_perdidas`, `no_registrado`, `sin_pbp`…); un DNP de jugador, un partido donde el quinteto no jugó y una métrica sin intentos NUNCA se dibujan como 0. · (US-4) (Esp. v2 §C-11; decisión C-11 RF-10)
- RF-16: En la serie del quinteto, un partido con menos posesiones que el mínimo de muestra de T-02 para quintetos DEBE marcarse como **muestra baja** (punto hueco y tooltip) sin ocultarlo. · (US-5) (Esp. v2 §T-02)

**Exportación y configuración**
- RF-17: El sistema DEBE permitir **exportar el gráfico como imagen (PNG)** —y también PDF y CSV de la serie— con el menú de T-06, incluyendo en la cabecera entidad, competencia, filtros, base, métricas, media móvil y fecha. · (US-7) (Esp. v2 §F-18 "exportable como imagen (T-06)")
- RF-18: Las preferencias de arranque DEBEN leerse de configuración (F-13): media móvil por defecto (`trends.default_ma`), N de la tendencia (`trends.last_n`), nivel de significancia (`trends.alpha`), cantidad de jugadores clave (`trends.key_players`) y largo mínimo de racha (`trends.streak_min`). · (US-5, US-6) (Esp. v2 §T-02 "ninguno debe quedar fijo en el código")

## 5. Requisitos de datos / API
| Tabla / Endpoint | Tipo | Campos / Shape | ¿Nuevo? |
|---|---|---|---|
| `GET /api/trends?entity=team\|player\|lineup&id=<id>&metrics=<k1,k2,k3>&ma=<3\|5\|10\|0>` + contexto T-03 + `base` | endpoint (Arq. §6) | `{entity, context, base, metrics, axes, ma, games, series, margin, trend, milestones, key_players, presets}`; `last_n` (PROPUESTA) fija el N del indicador; el shape completo lo fija `plan.md` §3 | **NUEVO** (ruta y parámetros base fijados en Arq. §6) |
| `metrics_catalog.load_game_bundles`, `stats_engine.sum_bundles` | funciones backend (T-06 §4.3) | serie por partido de cualquier entidad; suma de `StatBundle` | de T-06 (PROPUESTA de T-06); F-18 las consume |
| `trends.default_ma` (enum 3\|5\|10, 5) · `trends.last_n` (int, 5, 2–20) | claves de configuración (Arq. §3.2) | sección Preferencias | **NUEVO** (se agregan a `CONFIG_SPEC`) |
| `trends.alpha` · `trends.key_players` · `trends.streak_min` | claves de configuración (**PROPUESTA**) | float 0,05 (0,01–0,2) · int 5 (1–10) · int 3 (2–10) | **NUEVO** (PROPUESTA: no figuran en la tabla de claves de Arq. §3.2) |

Sin cambios de esquema (Arq. §5: F-18 es on-the-fly).

## 6. Estados de UI
Componente de evolución en S3 Equipo → Game log, S4 Jugador → Tendencias y detalle de quinteto en S3 → Quintetos. Copy nuevo marcado `(nuevo)` para `docs/frontend.md`.

| Vista / componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Gráfico de evolución | spinner + "Armando la evolución…" (nuevo) | "No hay partidos para graficar." (nuevo) · "Esta métrica no tiene valores en la selección." (nuevo) | 400 "Elegí hasta tres métricas." (nuevo) · 400 "Las métricas elegidas tienen más de dos escalas distintas." (nuevo) · 5xx "No se pudo armar la evolución." (nuevo) | "Sin conexión: la evolución necesita conexión." (nuevo) | líneas por serie con media móvil, eje secundario si corresponde, línea de referencia, hitos |
| Selector de series | — | "Elegí una métrica." (nuevo) | aviso "Máximo tres series." (nuevo) | — | selector agrupado por familias del catálogo, chips de pares, selector de media móvil (3 · 5 · 10 · Sin media) y de N |
| Gráfico de diferencia de puntos | — | "Sin diferencia de puntos disponible." (nuevo; p. ej. jugador sin `plus_minus`) | — | — | barras verdes (victoria) y rojas (derrota), línea de cero |
| Indicador de tendencia | — | "Sin datos suficientes para comparar." (nuevo) | — | — | por serie: "Últimos {N}: {valor} · Resto: {valor} · Δ {delta} ({sentido})" con significancia ("Diferencia significativa" / "Sin diferencia significativa") y badge de muestra |
| Muestra insuficiente | — | "Muestra insuficiente (menos de 3 partidos en un grupo)." (nuevo) | — | — | indicador en gris sin sentido |
| Hitos | — | — | — | — | marcadores sobre el eje con tooltip: "Fin de racha de {n} victorias/derrotas" · "Local"/"Visitante" · "Ausente: {nombres}" (nuevo) |
| Punto sin valor | — | hueco con tooltip de la razón (p. ej. "No jugó (DNP)") | — | — | sin punto, sin 0 |
| Exportar | — | "Sin datos para exportar." (nuevo) | toast con el mensaje | — | menú PNG · PDF · CSV (T-06) |

Mobile (<768 px): el selector se apila (series en una columna, chips con scroll interno), el gráfico ocupa el ancho completo con altura reducida, los marcadores de hitos se agrupan en una lista debajo del gráfico (los tooltips táctiles se abren con toque), el indicador de tendencia pasa a tarjetas apiladas; sin scroll horizontal de página.

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "el mismo componente sirve para las tres entidades y permite cambiar de métrica sin recargar la pantalla." Given un equipo, un jugador y un quinteto con partidos en la competencia, When se abre su evolución, Then los tres usan el **mismo** componente (mismo selector, gráfico, indicador y exportación) y, When se cambia una métrica, la media móvil o N, Then el gráfico se redibuja sin recarga del documento (solo llamadas `/api/trends`) conservando entidad, contexto y base.
- CA-2 (hasta tres series y ejes): Given la selección de tres métricas de dos escalas (p. ej. `oer`, `der`, `efg_pct`), When se grafica, Then las de la misma escala comparten eje y la otra va al eje secundario; Given tres escalas distintas (p. ej. `pts`, `efg_pct`, `oer`), Then el sistema lo impide con el aviso y la API responde 400.
- CA-3 (cualquier métrica del conjunto estándar): Given el catálogo de T-05, When se pide `GET /api/trends` con cada clave aplicable a `team`, Then devuelve una serie por partido (valores o nulos con razón); una clave no aplicable a la entidad (p. ej. `uso_pct` en `team`) devuelve la serie nula con razón `no_aplica`.
- CA-4 (pares preconfigurados): Given los tres pares, When se aplican, Then se grafican `pts`/`pts_against`, `oer`/`der` y `efg_pct`/`to_pct` y se pueden cambiar después.
- CA-5 (valores por partido = game log): Given un equipo y un partido, When se compara el valor de `oer` de la serie con el del game log y con `GET /api/team/<code>` para ese partido, Then coincide.
- CA-6 (diferencia de puntos): Given el gráfico de diferencia, When se verifican 3 partidos de un equipo, Then cada barra es `pts − opp_pts` del partido, el color es verde si ganó y rojo si perdió, y hay línea en cero; para el jugador cada barra es su `plus_minus`; para el quinteto, `pts − pts_against` en cancha.
- CA-7 (media móvil): Given `ma=5` y una serie con 10 valores válidos, When se consulta, Then los primeros 4 puntos tienen `ma = null`, y el `ma` del quinto es el promedio de los 5 primeros valores (verificable a mano); con `ma=0` no hay media; con un hueco (DNP) en la ventana, la ventana toma los 5 últimos valores **válidos**.
- CA-8 (tendencia, delta pooled): Given `last_n=5`, When se calcula el indicador de `efg_pct`, Then el delta es `efg(últimos 5) − efg(resto)` con cada término como cociente de totales del grupo (suma de conteos), verificable sumando los conteos de los partidos; `delta_rel = delta / |resto|` (nulo si el resto es 0).
- CA-9 (significancia): Given dos grupos de al menos 3 partidos, When se calcula el p-valor de Welch con los valores por partido, Then coincide con el cálculo manual (`t`, `df`, `p` bilateral) y la significancia es "significativa" si `p < trends.alpha`; con un grupo de menos de 3 partidos, la significancia es nula con razón `muestra_insuficiente`.
- CA-10 (sentido del cambio): Given una métrica con dirección `lower` (p. ej. `der`), When los últimos N bajan respecto del resto de forma significativa, Then el sentido es "mejora" (delta orientado positivo); con una métrica neutral el sentido es "cambio" sin juicio.
- CA-11 (hitos de racha): Given un equipo con una racha de 4 victorias cortada por una derrota, When se ven los hitos con `trends.streak_min = 3`, Then aparece un hito "Fin de racha de 4 victorias" en el partido de la derrota; con `streak_min = 5` desaparece.
- CA-12 (local/visitante): Given el game log, When se ve el eje, Then cada partido está marcado local o visitante coincidente con `home_away` del game log.
- CA-13 (ausencias de clave): Given los `trends.key_players` con más minutos del equipo, When un jugador clave no jugó un partido dentro de su período de actividad, Then ese partido trae el hito "Ausente: {nombre}"; un partido anterior a su primer partido o posterior al último no cuenta; con `key_players = 1` solo se evalúa el de más minutos.
- CA-14 (DNP y nulos): Given un jugador con un partido DNP, When se grafican sus puntos, Then el partido queda en el eje sin punto y con tooltip "No jugó (DNP)"; la media móvil lo salta; ningún valor nulo se dibuja como 0.
- CA-15 (quinteto): Given un quinteto que no jugó en 3 partidos de la selección, When se grafica, Then esos partidos son huecos con razón `sin_datos`; los partidos con menos posesiones que el mínimo de muestra de quintetos quedan marcados como muestra baja.
- CA-16 (contexto y base): Given `venue=local` en la barra T-03, When se pide la serie, Then solo hay partidos como local y `context.games_used` coincide; Given `base=por100`, Then los conteos de la serie están normalizados por 100 posesiones y coinciden con `apply_base` de T-04.
- CA-17 (referencia de liga): Given la serie `oer` de un equipo, When se ve la línea de referencia, Then su valor es el promedio de la competencia de T-01 (`GET /api/league` / ficha) para esa métrica; para el quinteto no hay referencia.
- CA-18 (exportación, T-06): Given el gráfico visible, When se exporta a PNG, Then la imagen contiene el gráfico (con las series, la media móvil y los hitos) y la cabecera con entidad, competencia, filtros, base y métricas; el CSV contiene una fila por partido con valor y media móvil de cada serie.
- CA-19 (configuración): Given `trends.default_ma = 10` y `trends.last_n = 8` en F-13, When se abre la evolución por primera vez, Then arranca con media móvil de 10 y N = 8.
- CA-20 (reemplazo de gráficos fijos): Given la vista de Equipo y de Jugador, When se las recorre, Then ya no existen las funciones `drawEvolution`/`drawPlayerEvolution` y las vistas usan el componente nuevo; las demás funciones de `charts.js` siguen funcionando.
- CA-21 (rendimiento): Given un equipo con la competencia del seed (13 partidos), When se pide `GET /api/trends` con tres métricas en frío, Then responde en menos de 3 s y en caliente en menos de 1 s; el cambio de métrica en pantalla se percibe inmediato.

## 8. Fuera de alcance
- Series de otros tipos de entidad (parejas, ON/OFF, emparejamientos, cierres, tramos): v2 pide equipo, jugador y quinteto.
- Comparar dos entidades en el mismo gráfico (equipo contra equipo): fuera de v2 (la comparación vive en S6).
- Detección automática de cambios de régimen (puntos de cambio) más allá de las rachas, pronósticos y proyecciones.
- Corrección por comparaciones múltiples cuando se prueban varias métricas a la vez: cada indicador se informa con su propio p-valor y se avisa en `docs/metrics.md`.
- Datos de lesiones: la "ausencia" se deriva del box score (no jugó), no de un registro médico.
- Series por posesión o por minuto dentro del partido (evolución intra-partido): es del análisis de partido (F-07).
- Anotaciones editables por el usuario sobre el gráfico.
- Tendencia entre temporadas/competencias: el universo es la selección de una competencia.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **Prueba de significancia (el cliente pide "definir el test").** Prueba t de **Welch** bilateral sobre los valores **por partido** de los últimos N frente al resto, con `trends.alpha` = 0,05 (configurable) y mínimo de 3 partidos por grupo. Razón: grupos de tamaño muy distinto (5 contra 25), varianzas desiguales, sin supuesto de igualdad de varianzas; implementable en Python puro. Limitación documentada: valores por partido de tasas se tratan como aproximadamente normales, y el delta mostrado es el cociente de totales (DA-02), que puede diferir levemente de la diferencia de medias.
2. [DECISIÓN PROPUESTA — confirmar] **"Jugador clave" (el cliente pide "definir 'clave'").** Los `trends.key_players` (por defecto 5) jugadores del equipo con **más minutos totales** en la selección. Una **ausencia** es un partido del equipo, dentro del rango entre el primer y el último partido en que el jugador jugó, en el que no jugó (DNP o sin fila). Para la evolución de un jugador, los jugadores clave son los **compañeros** (se excluye a sí mismo; sus propios DNP ya son huecos).
3. [DECISIÓN PROPUESTA — confirmar] **Cambio de racha.** Un hito marca el partido que **corta** una racha de al menos `trends.streak_min` (3) victorias o derrotas consecutivas del equipo; se informa su longitud. No se marcan inicios de racha ni rachas en curso.
4. [DECISIÓN PROPUESTA — confirmar] **Media móvil = promedio simple de los últimos *k* valores válidos** de la serie graficada (suavizado visual); el **indicador de tendencia** usa cociente de totales por grupo (DA-02). Pueden diferir en una tasa; se documenta.
5. [DECISIÓN PROPUESTA — confirmar] **Eje secundario por escala.** Familias: porcentajes (`pct`); razones y valores por posesión (`dec2`, `signed_dec2`); conteos y ritmos (`int`, `signed_int`, `dec1`). Dos familias → dos ejes; una sola → un eje; tres → bloqueado. Alternativa descartada: un tercer eje (ilegible en 360 px).
6. [DECISIÓN PROPUESTA — confirmar] **Diferencia de puntos para jugador y quinteto** = su `plus_minus` por partido (T-05: Σ `sPlusMinusPoints` del jugador; `pts − pts_against` del quinteto), coloreada por el **resultado del equipo** (no por el signo de la barra), como pide el cliente ("color según resultado").
7. [DECISIÓN PROPUESTA — confirmar] **Local/visitante como marcador del eje**, no como "hito" por partido: cada partido lleva una marca "L"/"V" bajo el punto; el hito destacable de local/visitante es el cambio de condición cuando hay una racha de partidos seguidos en el mismo lugar (no se agrega: se deja la marca por partido).
8. [DECISIÓN PROPUESTA — confirmar] **N del indicador y período del contexto.** `last` de T-03 acota el universo (p. ej. últimos 15); el N del indicador (`last_n`) parte **esa** selección en "últimos N" y "resto". Si el universo tiene N o menos partidos, el resto queda vacío y el indicador es `sin_datos`.
9. [DECISIÓN PROPUESTA — confirmar] **Base por partido.** La base por defecto del gráfico es `partido` (valores del partido, equivalente a `total` por partido); `por40`/`por100` se aplican por partido con `apply_base`. Las métricas `fixed` (tasas) no cambian.
10. [DECISIÓN PROPUESTA — confirmar] **Quinteto sin referencia ni percentil:** la línea de promedio de la competencia solo existe para equipo y jugador (población de T-01); el quinteto muestra sus partidos con la marca de muestra baja de T-02.
11. [DECISIÓN PROPUESTA — confirmar] **Claves de configuración nuevas** `trends.alpha`, `trends.key_players`, `trends.streak_min`: la arquitectura solo define `trends.default_ma` y `trends.last_n`; para cumplir "ningún umbral fijo en el código" (T-02/F-13) se proponen estas tres (sección Preferencias). Se reportan como hueco.
