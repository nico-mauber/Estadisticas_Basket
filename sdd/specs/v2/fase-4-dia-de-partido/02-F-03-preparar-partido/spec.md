# Spec — F-03: Preparar partido

> **ID:** F-03 · **Prioridad:** P0 · **Fase y orden:** Fase 4 — Día de partido · 02
> **Depende de:** F-07 ([../01-F-07-analizar-partido/](../01-F-07-analizar-partido/spec.md)) · T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · F-06 ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md)) · F-17 ([../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/spec.md)) · T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md))
> **Habilita:** F-20, F-12, F-15 (fase 5)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-03 y §1.3 S5 · modo Preparar ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.7, §3.9, §3.10, §3.11, §3.12, §4 (`prepare.py`, `matchups.py`), §6, §9 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §F-03):**
- "Es la función de mayor valor para un entrenador y hoy no existe. El resultado no es un dashboard para navegar, sino un informe para leer antes del tip-off."
- Contenido: "5 ventajas propias y 5 amenazas del rival, generadas automáticamente comparando four factors y percentiles (T-01) de ambos equipos"; "Quintetos rivales más usados, con minutos, posesiones y Net Rating ajustado"; "Principales amenazas ofensivas del rival: USO%, zonas de tiro con mayor PPT y de dónde reciben sus puntos"; "Historial head to head entre ambos equipos"; "Tabla de matchups: resultado de cada combinación de quintetos que ambos equipos usaron entre sí"; "Filtro de últimos N partidos del rival para evitar arrastrar información vieja".
- Emparejamientos en tres niveles (quinteto vs quinteto, jugador vs jugador, jugador vs quinteto), selector directo/inverso, historial por celda con enlace a S5, "sin datos" (C-11) para cruces sin antecedentes, gris bajo el umbral de T-02 (8/25) con margen de error visible, y sugerencia por perfil (A-09) marcada como estimación.
- Advertencia técnica literal: "FIBA LiveStats no registra la asignación defensiva, por lo que 'quién marca a quién' no es un dato medido. […] El módulo debe nombrarse y presentarse en esos términos, no como marcaje individual, y la sugerencia por perfil debe aparecer marcada como estimación."
- Salidas: "PDF A4 de dos páginas, listo para imprimir"; "Imagen PNG en formato vertical para compartir por WhatsApp"; "Exportación CSV de los datos de base".
- Criterio: "desde la selección de dos equipos, el informe se genera en menos de 10 segundos y es legible sin necesidad de abrir la app."

**Por qué:** §1.2 dice que S5 "es la incorporación más importante: hoy la app es una herramienta de temporada y no acompaña el día del partido, que es cuando el entrenador realmente la necesita." Preparar es, según §1.3, el modo que se usa "antes del tip-off".

**Qué existe HOY verificado en código:**
- No hay ningún endpoint, módulo ni vista de "preparar partido". `backend/app.py` no tiene rutas `/api/prepare` ni `/api/h2h`.
- No existe `backend/matchups.py` ni `backend/prepare.py` en `main`: los crea F-07 (`matchups.py`, coincidencia en cancha de un partido) y esta spec (`prepare.py`).
- `backend/lineups.py:lineup_stats(games, team_code, players)` calcula un quinteto puntual; no hay "todos los quintetos de un equipo" (`all_lineups`) — lo crea F-06.
- No hay historial head-to-head en ningún endpoint: `backend/app.py:list_games` no filtra por rival.
- No hay percentiles (T-01), badge de muestra (T-02) ni conjunto estándar (T-05) en `main`.
- No hay exportación de ningún tipo (PDF/PNG/CSV de un informe) en el proyecto: `frontend/js/` no tiene `exporters.js` ni `export-menu.js` — los crea T-06.
- No existe similitud de jugadores (A-09, fase 5): no hay `backend/similarity.py`.

**Qué resuelven requisitos anteriores (supuestos de esta spec):** F-07 crea `matchups.py` (`_game_segments`, `_side_counts`, `_player_counts`, `game_matchups`, `team_matchups`, `load_matchup_bundles`, tablas `matchups_quinteto`/`matchups_jugador`/`matchups_jugador_quinteto`) y el componente `components/game-view.js` (sub-bloques `gvMatchups` reutilizables). T-01 crea `population.py` (ficha, percentil, ranking). T-02 crea `sample.py` (badge, regresión, banda, umbral de emparejamiento `sample.matchup.min`/`.high` = 8/25). T-05 crea el conjunto estándar y `stats_engine.compute_standard`. F-06 crea `lineups.all_lineups` (todos los quintetos de un equipo) y `lineup_clutch`. F-17 crea `phrases.py` y el formato de plantillas de frase (F-03 usa `mode="matchup"`). T-06 crea `tables.py`, `export_xlsz.py`, `components/data-table.js`, `export-menu.js`, `exporters.js`. X-01 registra la sección S5 (deshabilitada) y su modo `preparar` como pestaña sin id.

**Qué queda (esta spec):** el informe Preparar en sí — comparación de ventajas/amenazas, quintetos rivales, amenazas ofensivas del rival, H2H, la vista de emparejamientos en tres niveles con selector directo/inverso y el bloque de exportación (PDF A4, PNG vertical, CSV), reutilizando por completo `matchups.py` de F-07 y sin duplicar su lógica.

## 1. Objetivo
Generar, para cualquier par (equipo propio, rival), un informe de scouting legible en menos de 10 segundos: ventajas y amenazas por percentil, quintetos rivales más usados, amenazas ofensivas del rival, historial H2H, y una tabla de emparejamientos en tres niveles con selector directo/inverso, exportable en PDF A4, PNG vertical y CSV.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 F-03 (requisito completo, literal arriba), §1.3 S5 (modo Preparar), §3 T-01 (ficha de métrica), T-02 (umbral de emparejamiento 8/25), T-05 (conjunto estándar), T-06 (tablas y exportación), §5 A-09 (similitud, fase 5, consumido como incremento diferido), §6 glosario (fórmulas).
- `docs/database.md` §`games`, §`team_game_stats`, §`player_game_stats` (no hay columnas nuevas propias de esta spec).
- `docs/api.md`: no existe ningún endpoint de preparación de partido (F-03 los crea todos, NUEVO).
- Arquitectura §3.7 (T-02: `sample.sample_level`, `adjusted`, `band`), §3.9 (A-01, fuera de alcance de fase 4 salvo lo que F-07 ya resolvió con eventos crudos), §3.10 (`matchups.py`, tabla de necesidades por dueño), §3.11 (T-06 exportación), §3.12 (rutas S5, modo `preparar` sin id), §3.15 (`phrases.py`, `game_plan` con `mode="matchup"`), §4 (`prepare.py`), §6 (endpoints `GET /api/prepare`, `GET /api/h2h`), §9 (grafo: F-03 depende de F-07, T-01, T-02, F-06, F-17, T-06; habilita F-20, F-12, F-15).
- Specs previas de esta fase: F-07 `spec.md`/`plan.md` (matchups, tablas, componente `game-view.js`).

## 3. Historias de usuario
- US-1: Como entrenador, quiero un informe con las ventajas propias y las amenazas del rival antes de un partido, para preparar la charla táctica sin tener que cruzar números a mano.
- US-2: Como entrenador, quiero ver los quintetos que más usa el rival y su rendimiento, para anticipar sus rotaciones.
- US-3: Como entrenador, quiero saber de dónde vienen los puntos del rival (zonas, USO%), para saber a quién marcar de cerca y qué zona cerrar.
- US-4: Como entrenador, quiero el historial entre mi equipo y el rival, para tener contexto de enfrentamientos anteriores.
- US-5: Como entrenador, quiero comparar mis quintetos contra los del rival (y viceversa) para decidir con qué cinco salir.
- US-6: Como entrenador, quiero comparar jugador contra jugador y jugador contra quinteto rival, para anticipar emparejamientos favorables.
- US-7: Como entrenador, quiero exportar el informe en PDF y en una imagen vertical, para llevarlo impreso o mandarlo por WhatsApp al cuerpo técnico.
- US-8: Como entrenador, quiero filtrar el informe a los últimos N partidos del rival, para no arrastrar información vieja de principio de temporada.

## 4. Requisitos funcionales

**Acceso y encabezado**
- RF-1: El sistema DEBE generar el informe Preparar para un par (`team`, `rival`) elegido por el usuario, dentro de la sección Partido (S5), modo "Preparar", sin necesidad de un `game_id` (partido aún no jugado o sin importar). · (US-1) (Esp. v2 §F-03; §1.3 S5 "Antes del tip-off")
- RF-2: El sistema DEBE aceptar un filtro de **últimos N partidos del rival** (default: todos) que se aplica a todo el informe salvo el H2H, que siempre usa el historial completo entre ambos equipos salvo que el usuario aplique el mismo filtro sobre el H2H explícitamente. · (US-8) (Esp. v2 §F-03 "Filtro de últimos N partidos del rival para evitar arrastrar información vieja")
- RF-3: El sistema DEBE mostrar un encabezado con ambos equipos, competencia y temporada, cantidad de partidos del rival considerados, y la fecha/hora de generación del informe. · (US-1)

**Ventajas y amenazas**
- RF-4: El sistema DEBE generar automáticamente **5 ventajas propias y 5 amenazas del rival**, comparando four factors (eFG%, TO%, OR%, FT Rate) y el resto de las métricas con plantilla de F-17 (`phrases.game_plan`) entre ambos equipos, usando los percentiles de T-01 de cada uno contra la misma competencia. · (US-1) (Esp. v2 §F-03 "5 ventajas propias y 5 amenazas del rival, generadas automáticamente comparando four factors y percentiles (T-01) de ambos equipos")
- RF-5: Cada ítem de ventaja/amenaza DEBE mostrarse con el formato de F-17 (métrica, diferencia con signo, valores propio vs rival, percentil, lectura de una línea, dirección ↑/↓), invocando `phrases.game_plan(..., reference="rival", rival=<rival_code>, mode="matchup")`. · (US-1) (Esp. v2 §F-17 formato de ítem; Arquitectura §3.15)
- RF-6: Si alguno de los dos equipos tiene muestra baja (menos de `sample.team.min` partidos, T-02/T-01) en la competencia elegida, el informe DEBE advertirlo explícitamente en el bloque de ventajas/amenazas sin dejar de mostrarlo. · (Esp. v2 §T-02; §C-11)

**Quintetos rivales**
- RF-7: El sistema DEBE listar los quintetos rivales más usados (ordenados por minutos jugados, de mayor a menor) con: minutos, posesiones y **Net Rating ajustado** (regresión de T-02), en una tabla completa T-06 con badge de muestra. · (US-2) (Esp. v2 §F-03 "Quintetos rivales más usados, con minutos, posesiones y Net Rating ajustado")
- RF-8: La tabla de quintetos rivales DEBE reutilizar `lineups.all_lineups` (F-06) sobre los partidos del rival filtrados por el últimos-N de RF-2, sin duplicar la lógica de reconstrucción de quintetos. · (US-2) (Arquitectura §3.10)

**Amenazas ofensivas del rival**
- RF-9: El sistema DEBE mostrar el USO% de los jugadores del rival (top por volumen), las zonas de tiro con mayor PPT del rival (mapa de zonas de C-03, reutilizado) y de dónde vienen sus puntos (reparto pintura/media/triple/TL/segunda oportunidad/contraataque/tras pérdida propia — mismo desglose que F-01/F-07 cuando esté disponible; en esta fase, desde `team_game_stats.paint_pts/second_chance_pts/pts_from_tov/fast_break_pts` y el resto de TCi por PPT según T-05). · (US-3) (Esp. v2 §F-03 "Principales amenazas ofensivas del rival: USO%, zonas de tiro con mayor PPT y de dónde reciben sus puntos")
- RF-10: Sin coordenadas de tiro para algún partido del rival (partido no reprocesado), el mapa de zonas DEBE caer al modo de 3 zonas de C-03 con el aviso correspondiente, sin romper el resto del informe. · (US-3) (Arquitectura §8 `shot-chart.js`)

**Head to head**
- RF-11: El sistema DEBE mostrar el historial head to head completo entre ambos equipos: resultados de cada enfrentamiento (fecha, marcador, ganador), récord acumulado, y enlace a cada partido en S5 · Analizar (F-07). · (US-4) (Esp. v2 §F-03 "Historial head to head entre ambos equipos"; §S6 "Head to head […] enlazado con el modo Preparar de S5")
- RF-12: El H2H DEBE ser reutilizable desde S6 · Comparar (`h2h`, F-03 lo crea aquí) y desde F-20 (Enfrentamiento, dentro de Equipo), mediante la función pública `prepare.head_to_head(team_a, team_b, comp_id)`. · (US-4) (Esp. v2 §F-20 "Reutilizar el H2H de F-03")

**Emparejamientos**
- RF-13: El sistema DEBE mostrar la tabla de emparejamientos en **tres niveles** — quinteto vs quinteto, jugador vs jugador, jugador vs quinteto (en ambos sentidos) — acumulando todos los partidos históricos entre `team` y `rival` (filtrados por el últimos-N del rival, RF-2), reutilizando `matchups.team_matchups(team_code, rival_code, comp_id, ctx, level)` de F-07 sin duplicar el algoritmo de acumulación por segmentos. · (US-5, US-6) (Esp. v2 §F-03 tabla de niveles; Arquitectura §3.10 `team_matchups`)
- RF-14: Nivel quinteto vs quinteto DEBE incluir, por cruce: minutos compartidos, posesiones, puntos a favor y en contra, Net Rating, eFG% y TS% de cada lado, TO% y OR% del tramo — el conjunto estándar completo de la entidad `matchup` (T-05) está disponible al expandir la fila. · (US-5) (Esp. v2 §F-03 nivel "Quinteto vs quinteto")
- RF-15: Nivel jugador vs jugador DEBE incluir, por cruce: minutos compartidos, posesiones, +/- del tramo, producción de cada uno mientras coincidieron (PTS, T2c/T2i, T3c/T3i, TLc/TLi, RO, RD, AS, PER) y desglose de tiro de ambos. · (US-6) (Esp. v2 §F-03 nivel "Jugador vs jugador")
- RF-16: Nivel jugador vs quinteto DEBE mostrar el rendimiento de cada jugador propio contra cada quinteto rival, y el sentido inverso (parámetro `side`), reutilizando el mismo `team_matchups(level="jugador_quinteto")` de F-07. · (US-6) (Esp. v2 §F-03 nivel "Jugador vs quinteto")
- RF-17: El sistema DEBE ofrecer un **selector de quinteto propio**: al elegir uno, se ordenan todos los quintetos rivales por Net Rating del cruce, de mejor a peor (responde "con qué cinco salgo contra los suyos"), y un **selector inverso**: al elegir un quinteto rival, se ordenan los propios que mejor rindieron contra él. · (US-5) (Esp. v2 §F-03 "Selector de quinteto propio […] Selector inverso")
- RF-18: Cada celda de la matriz de cruces DEBE indicar en qué partidos y con cuántas posesiones se produjo ese cruce, con enlace al partido correspondiente en S5 · Analizar; esto ya lo entrega `team_matchups` en su campo `games: [{game_id, possessions}]` (F-07). · (US-5, US-6) (Esp. v2 §F-03 "Historial: cada celda de la matriz indica en qué partidos […] con enlace al partido correspondiente en S5")
- RF-19: Cruces sin antecedentes (dos quintetos/jugadores que nunca se enfrentaron) DEBEN mostrarse como celda vacía con la marca de "sin datos" (razón `sin_enfrentamientos`), nunca como cero. · (US-5, US-6) (Esp. v2 §F-03 "Cruces sin antecedentes […] nunca como cero"; §C-11)
- RF-20: Todo cruce por debajo del umbral de emparejamiento de T-02 (`sample.matchup.min` = 8 posesiones) DEBE mostrarse en gris y no ordenarse entre los recomendados; su margen de error (banda) DEBE mostrarse siempre visible, sin ocultar el dato. · (US-5, US-6) (Esp. v2 §F-03 "Todo cruce por debajo del umbral de emparejamiento de T-02 se muestra en gris […] la contrapartida es que el margen de error se muestra siempre"; §T-02)
- RF-21: El sistema DEBE reservar (oculto tras una bandera de configuración/disponibilidad) el bloque de **emparejamiento propuesto por perfil**: sugerencia de qué jugador propio puede asumir a cada amenaza rival, cruzando el perfil de similitud (A-09, fase 5) con minutos y uso; hasta que A-09 exista, el bloque no se muestra (INCREMENTO DIFERIDO). · (Esp. v2 §F-03 "Emparejamiento propuesto por perfil […] sugerencia […] marcada como estimación"; Arquitectura §9.2 I-05)
- RF-22: El módulo de emparejamientos DEBE nombrarse y presentarse en toda la vista como **"coincidencia en cancha"**, nunca como "marcaje" ni "asignación defensiva"; la vista DEBE incluir la advertencia técnica literal de que FIBA no registra la asignación defensiva. · (Esp. v2 §F-03 "Advertencia técnica"; Arquitectura §3.10 "el módulo se nombra 'coincidencia en cancha', no 'marcaje'")

**Salidas**
- RF-23: El sistema DEBE ofrecer exportación del informe completo a **PDF A4 de dos páginas** (impresión del navegador, DA-19), lista para imprimir. · (US-7) (Esp. v2 §F-03 "PDF A4 de dos páginas, listo para imprimir")
- RF-24: El sistema DEBE ofrecer exportación a **PNG vertical** (maqueta de 1080 px de ancho) apta para compartir por WhatsApp. · (US-7) (Esp. v2 §F-03 "Imagen PNG en formato vertical para compartir por WhatsApp")
- RF-25: El sistema DEBE ofrecer exportación a **CSV de los datos de base** (ventajas/amenazas, quintetos rivales, emparejamientos), con la cabecera de metadatos de T-06 (entidad, competencia, temporada, filtros, fecha de generación). · (US-7) (Esp. v2 §F-03 "Exportación CSV de los datos de base"; §T-06)
- RF-26: El informe completo (todos los bloques, sin exportación) DEBE generarse en **menos de 10 segundos** para cualquier par de equipos de una competencia con hasta ~35 partidos por equipo. · (US-1) (Esp. v2 §F-03 CA; Arquitectura §3.14 "objetivo: informe F-03 < 10 s en frío")

**Nulos y casos borde**
- RF-27: Toda métrica no calculable DEBE mostrarse como nulo con su razón (`sin_intentos`, `sin_pbp`, `sin_enfrentamientos`, `poblacion_insuficiente`, `no_registrado`, `dnp`, `no_aplica`); ninguna se reemplaza por 0 ni se omite. · (Esp. v2 §C-11; Arquitectura §7.4)
- RF-28: Un rival sin ningún partido en la competencia elegida (o sin partidos tras aplicar el últimos-N) DEBE mostrar el informe con los bloques que sí tengan datos (ventajas/amenazas si ambos equipos tienen muestra, aunque no haya H2H) y "Sin historial entre estos equipos" en H2H y emparejamientos, nunca un error que bloquee toda la vista. · (Esp. v2 §C-11)

## 5. Requisitos de datos / API

| Tabla / endpoint | Uso | Estado |
|---|---|---|
| `games`, `team_game_stats`, `player_game_stats` | quintetos rivales, amenazas ofensivas, H2H | existen |
| `shots` (+ `court_x`/`court_y` de F-11) | mapa de zonas del rival | existe / columnas F-11 |
| `pbp_events` | emparejamientos (vía `matchups.py` de F-07) | existe |
| `GET /api/prepare` | informe completo: `{summary, advantages, threats, rival_lineups, rival_threats, h2h, matchups, suggestions_profile}` | **NUEVO** (Arquitectura §6, dueño F-03) |
| `GET /api/h2h` | historial entre dos equipos | **NUEVO** (Arquitectura §6, dueño F-03) |
| `GET /api/game/<game_id>/matchups` (F-07) | reutilizado indirectamente vía `matchups.team_matchups` | existe (F-07) |
| `GET /api/table/matchups_quinteto` \| `matchups_jugador` \| `matchups_jugador_quinteto` con `team`/`rival` (+ contexto) en vez de `game` | tabla de emparejamientos F-03 (mismos ids de F-07, parámetros distintos) | existente (F-07), consumo por F-03 |
| `POST /api/export/xlsx`, exportación cliente (CSV/PNG/PDF) | exportación del informe | existentes (T-06) |
| Clave de configuración `report.default_last_n` | valor por defecto del filtro "últimos N partidos del rival" | **NUEVO** — PROPUESTA (no está en 00-arquitectura-transversal.md) |

Sin tablas ni columnas nuevas (Arquitectura §5 confirma: "Sin cambios de esquema: […] F-01…F-09"). Errores: `404 no_encontrado` (equipo o rival inexistente), `400 parametro_invalido` (rival = team, `last` no numérico), `502 fiba_no_disponible` no aplica (no hay fetch externo en este requisito).

## 6. Estados de UI

Vista: S5 Partido · modo Preparar (`#/partido/preparar?team=<code>&rival=<code>[&last=<n>][&fixture=<id>]`). Copy nuevo (marcar para `docs/frontend.md`), siempre vía `t()`.

| Bloque | loading | vacío / sin datos | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selector inicial (sin team/rival) | — | — | — | — | "Elegí tu equipo y el rival para generar el informe." con dos selectores |
| Vista completa | "Generando informe…" (spinner con progreso por bloque) | — | "No se pudo generar el informe." | "Sin conexión: preparar un partido necesita conexión." | encabezado + bloques |
| Ventajas / Amenazas | skeleton de 5 filas por columna | "Muestra insuficiente para comparar estos equipos." (si ninguno llega al mínimo de T-01) | — | — | dos columnas "Ventajas" / "Amenazas del rival" con formato F-17 |
| Quintetos rivales | skeleton de tabla | "El rival no tiene quintetos con play-by-play en esta selección." | — | — | tabla T-06 con badge de muestra |
| Amenazas ofensivas | skeleton | "Sin datos de tiro para el rival en esta selección." | — | — | top USO%, mapa de zonas, reparto de puntos |
| Head to head | skeleton | "Sin historial entre estos equipos." | — | — | lista de partidos con enlace a S5 · Analizar + récord acumulado |
| Coincidencia en cancha | skeleton de tabla | celda sin cruce: "Sin datos" · sin historial: "Sin cruces registrados entre estos equipos." | "No se pudieron calcular los cruces." | idem | selector de nivel + selector directo/inverso + tabla; leyenda fija: "Coincidencia en cancha: FIBA no registra quién marca a quién; se mide el rendimiento mientras ambos estuvieron en cancha." |
| Sugerencia por perfil | (oculto hasta A-09) | — | — | — | — |
| Exportar | "Generando PDF/PNG…" | — | "No se pudo generar el archivo." | CSV/PNG/PDF funcionan sin red (cliente) | menú con PDF, PNG, CSV |

Mobile (<768 px): bloques apilados como pestañas internas horizontales con scroll (Ventajas · Quintetos · Amenazas · H2H · Cruces); PDF y PNG conservan su formato fijo (A4 / 1080 px) independiente del viewport.

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: Given la selección de dos equipos (propio y rival), When se genera el informe, Then se completa en menos de 10 segundos y es legible sin necesidad de abrir la app (verificable con el informe exportado en PDF/PNG, que no requiere interacción para leerse).
- CA-2: Given el bloque de ventajas/amenazas, When se genera, Then muestra exactamente 5 ítems de ventaja propia y 5 de amenaza del rival, cada uno con métrica, diferencia con signo, valores propio vs rival, percentil y lectura, verificable contra la tabla de percentiles de T-01 de la misma competencia.
- CA-3: Given la tabla de quintetos rivales, When se ordena por minutos, Then coincide con `lineups.all_lineups` del rival sobre los mismos partidos filtrados por el últimos-N aplicado.
- CA-4: Given un rival con coordenadas de tiro en al menos un partido, When se muestran las amenazas ofensivas, Then el mapa de zonas indica la de mayor PPT y el reparto de origen de puntos suma el 100% de los puntos del rival en la selección.
- CA-5: Given dos equipos con partidos jugados entre sí, When se abre H2H, Then aparece cada enfrentamiento con fecha, marcador y ganador, el récord acumulado es correcto, y cada fila enlaza a `#/partido/<game_id>/analizar`.
- CA-6 **(CA del cliente)**: Given la tabla de emparejamientos quinteto vs quinteto, When se elige un quinteto propio, Then los quintetos rivales quedan ordenados por Net Rating del cruce de mejor a peor; When se elige un quinteto rival (selector inverso), Then los propios quedan ordenados por su rendimiento contra ese quinteto.
- CA-7: Given un cruce que nunca ocurrió entre dos quintetos, When se lo busca en la matriz, Then aparece como "Sin datos" (nunca como fila con valor 0).
- CA-8: Given un cruce con menos de 8 posesiones (umbral T-02), When se lo ve en la tabla, Then aparece en gris, con badge "Baja" y la banda de error visible, y no aparece entre los cruces recomendados al ordenar por Net Rating.
- CA-9: Given una celda de la matriz con historial, When se hace clic, Then se abre el listado de partidos de ese cruce, cada uno enlazado a `#/partido/<game_id>/analizar`.
- CA-10: Given la vista completa, When se recorre cualquier texto del bloque de emparejamientos, Then en ningún lugar aparece la palabra "marcaje" y la leyenda de "coincidencia en cancha" está visible.
- CA-11: Given el informe generado, When se exporta a PDF, Then se abre un documento A4 de dos páginas con encabezado, ventajas/amenazas, quintetos rivales, H2H resumido y top de emparejamientos, legible sin la app.
- CA-12: Given el informe generado, When se exporta a PNG, Then se descarga una imagen vertical (1080 px de ancho) con el mismo contenido resumido, apta para compartir por chat.
- CA-13: Given el informe generado, When se exporta a CSV, Then el archivo contiene los datos de base (ventajas/amenazas, quintetos rivales, emparejamientos) con la cabecera de metadatos de T-06.
- CA-14: Given el filtro de últimos N partidos del rival, When se cambia de "todos" a "últimos 5", Then los quintetos rivales, amenazas ofensivas y emparejamientos se recalculan sobre esos 5 partidos, y el encabezado indica "Últimos 5 partidos del rival"; el H2H no cambia salvo que el usuario lo filtre explícitamente.
- CA-15: Given `GET /api/prepare` sin parámetro `rival`, When se llama, Then responde 400 `{"error": "Falta el rival", "code": "parametro_invalido"}`; con `rival == team`, 400 `{"error": "El rival no puede ser el mismo equipo", "code": "parametro_invalido"}`.
- CA-16: Given un rival sin ningún partido en la competencia elegida, When se genera el informe, Then los bloques de quintetos/amenazas/H2H/cruces muestran su estado vacío y el resto del informe (ventajas/amenazas si hay muestra) sigue disponible, sin que la vista se rompa.

## 8. Fuera de alcance
- El cálculo de emparejamientos en sí (algoritmo de acumulación por segmentos, `matchups.team_matchups`): lo implementa F-07; F-03 solo lo consume con parámetros `team`/`rival` en vez de `game`.
- El bloque F-17 (Plan de juego) como panel permanente en pantalla: F-03 reutiliza su función `phrases.game_plan` para el bloque de ventajas/amenazas, pero el panel persistente en S3/S8 lo entrega F-17.
- INCREMENTO DIFERIDO (→ A-09): "Emparejamiento propuesto por perfil" — se reserva el bloque oculto; A-09 lo activa con `similarity.similar_players`.
- INCREMENTO DIFERIDO (→ F-12): abrir Preparar directamente desde el calendario/próximo partido de Mi equipo (`fixtures`); en esta fase se abre eligiendo manualmente `team` y `rival`.
- Video o sincronización con video del partido.
- Asignación defensiva real / marcaje individual (FIBA no lo registra; ver advertencia técnica RF-22).
- Barra de contexto T-03 completa: el informe usa `competition` y el últimos-N propio del rival (RF-2); no expone las demás dimensiones de T-03 (cuarto, marcador, on/off) en esta vista.
- Percentiles de "informe" contra otros informes: no pedido.

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] El filtro "últimos N partidos del rival" (RF-2) se implementa como parámetro `last` sobre los partidos del **rival** exclusivamente (no afecta la muestra del equipo propio, que usa todos sus partidos de la competencia para las ventajas/amenazas). Justificación: el cliente dice literalmente "para evitar arrastrar información vieja **del rival**"; el propio equipo se supone siempre representado por su forma completa de temporada.
- [DECISIÓN PROPUESTA — confirmar] "H2H siempre usa el historial completo salvo que se filtre explícitamente" (RF-2): se agrega un control separado en el bloque H2H para aplicar el mismo `last` si el usuario lo pide, sin acoplarlo al filtro general del informe. Motivo: un historial acortado por defecto sería sorprendente para un dato que el cliente pide como "historial" sin calificar.
- [DECISIÓN PROPUESTA — confirmar] Clave de configuración nueva `report.default_last_n` (default `null` = todos): PROPUESTA no listada en la arquitectura, agregada porque el filtro de RF-2 necesita un valor inicial configurable (F-13 lo agrega a su catálogo si el humano lo aprueba); hasta entonces vive con default embebido en `prepare.py`.
- [DECISIÓN PROPUESTA — confirmar] "Reparto de origen de puntos del rival" (RF-9) se calcula en esta fase desde las columnas ya existentes del box (`paint_pts`, `second_chance_pts`, `pts_from_tov`, `fast_break_pts`) más el resto (pintura/media/triple/TL) derivado del PPT por zona; el desglose completo por posesión (contraataque real vía A-01/A-02/A-03) es INCREMENTO DIFERIDO hacia A-02/A-03/A-07 (fase 3/5), que F-03 adoptará cuando existan sin cambiar el contrato de `GET /api/prepare` (mismas claves, valores más precisos).
- [NEEDS CLARIFICATION] El cliente no define un límite superior de partidos considerados para "quintetos rivales más usados" (¿todos? ¿top 5? ¿top 8?): se asume mostrar **todos** los quintetos que superan el umbral de muestra baja de T-02 más los de muestra baja (visibles en gris), sin truncar arbitrariamente, porque T-06 exige tabla completa. Confirmar con el cliente si el informe (a diferencia de la tabla completa) debe recortarse a un top N para caber en 2 páginas de PDF.
