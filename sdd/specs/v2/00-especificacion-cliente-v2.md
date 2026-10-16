# Smart-Basket — Especificación de cambios para desarrollo

> Versión 2 · Agosto 2026 · Reemplaza al documento "Correcciones Smart 23/07/26"
>
> **Conversión a Markdown** del documento del cliente `Smart-Basket_Especificacion_v2.docx` (ubicado en `C:\Develop\Basketball\`, fuera del repo),
> generada para trazabilidad de los specs de `sdd/specs/v2/`. Es la fuente de verdad de **producto** para v2
> (qué pide el cliente); `docs/` sigue siendo la fuente de verdad del **estado actual** del sistema.
> **No editar a mano:** si el cliente emite una nueva versión, regenerar desde el `.docx`.
> Los IDs (C-xx, T-xx, F-xx, A-xx) son estables: usarlos en commits, ramas y tablero.

## 0. Cómo leer este documento

Cada requisito tiene un ID estable. Usalos en commits, ramas y en el tablero de tareas para poder rastrear el estado de cada punto.

| ID | Bloque | Descripción |
|---|---|---|
| C-xx | Correcciones | Bugs y ajustes sobre lo que ya existe |
| T-xx | Transversales | Cambios que afectan a toda la app |
| F-xx | Funcionalidades | Pantallas y features nuevas |
| A-xx | Analítica | Métricas y modelos nuevos sobre el play-by-play |

Prioridades: P0 = bloqueante, se hace primero. P1 = alta. P2 = deseable, después de P0 y P1.

### Orden de trabajo propuesto

| Fase | Objetivo | Incluye |
|---|---|---|
| Fase 1 | Que los números sean confiables | Todo el bloque C + T-01, T-02, T-05, T-06, F-11, F-13 |
| Fase 2 | Contexto y comparabilidad | T-03, T-04, F-04, F-05, F-06, F-08, F-16, F-17, F-19, A-12 |
| Fase 3 | Contexto de posesión | A-01 a A-05 |
| Fase 4 | Día de partido | F-07, F-03, F-01, F-02 |
| Fase 5 | Analítica diferencial y exploración | A-06 a A-11, F-09, F-10, F-12, F-14, F-15, F-18, F-20, F-21 |

La sección 1 describe cómo queda organizada la app; las secciones 2 a 5 detallan cada requisito.

**Nota importante:** no avanzar a la Fase 2 sin cerrar la Fase 1. Hoy hay métricas visibles que muestran valores imposibles (por ejemplo, comparativas de "↑ 9900.0%" y quintetos rankeados sin ninguna corrección por muestra). Mientras eso siga en pantalla, cualquier función nueva hereda esa falta de confianza.

## 1. Arquitectura de la aplicación

Reorganización de la app en secciones y módulos. Cada módulo indica su estado actual y los requisitos que lo afectan. Nada de lo que existe hoy se elimina: se reubica.

### 1.1 Capa transversal

Componentes compartidos por todas las secciones. Se desarrollan una sola vez y se consumen desde cualquier pantalla. Todo lo que sigue en este documento asume que esta capa existe.

| Componente | Función | Requisito |
|---|---|---|
| Barra de contexto | Filtros de competencia, período, sede, rival, cuarto, marcador, con/sin jugador y dimensiones de posesión | T-03 |
| Base de normalización | Totales · por partido · por 40 min · por 100 posesiones | T-04 |
| Indicador de percentil | Valor absoluto + percentil de competencia + escala de color | T-01 |
| Badge de muestra | Posesiones, minutos y partidos de respaldo; bloqueo por debajo del umbral | T-02 |
| Política de nulos | Distinción estricta entre 0 y dato inexistente | C-11 |
| Conjunto estándar | Lista única de métricas que toda entidad debe devolver completa | T-05 |
| Tabla y exportación | Tabla completa ordenable y exportable en CSV, XLSX, PNG y PDF | T-06 |
| Insights en texto | Frases automáticas a partir de percentiles extremos | A-10 |
| Plan de juego | Panel de ventajas y riesgos con delta, valores y lectura accionable | F-17 |
| Filtros rápidos y cabecera | Chips de período, sede y rival, con récord y muestra siempre visibles | F-19 |
| Idioma | Interfaz en español, inglés y portugués | F-21 |
| Motor de posesiones | Servicio que reconstruye cada posesión con sus atributos | A-01 |
| Conjunto estándar de métricas | Lista única de indicadores que toda entidad debe devolver completa | T-05 |
| Tabla completa exportable | Componente de tabla con columnas configurables, orden, totales y exportación | T-06 |

### 1.2 Mapa de secciones

| # | Sección | Estado | Pregunta que responde |
|---|---|---|---|
| S1 | Datos | Existe (Importar) | ¿Qué información tengo cargada y en qué estado está? |
| S2 | Liga | Existe | ¿Cómo es la competencia y dónde está cada equipo? |
| S3 | Equipo | Existe | ¿Cómo juega este equipo? |
| S4 | Jugador | Existe | ¿Cómo juega este jugador? |
| S5 | Partido | Nueva | ¿Qué hago antes, durante y después de un partido? |
| S6 | Comparar | Existe | ¿En qué se diferencian dos equipos, jugadores o quintetos? |
| S7 | Explorar | Existe (Buscar) | ¿Quién cumple estas condiciones? |
| S8 | Mi equipo | Nueva | ¿Qué necesito ver hoy sin buscarlo? |
| S9 | Configuración | Nueva | ¿Con qué criterios calcula la app? |

S5 es la incorporación más importante: hoy la app es una herramienta de temporada y no acompaña el día del partido, que es cuando el entrenador realmente la necesita.

### 1.3 Composición de cada sección

#### S1 · Datos

| Módulo | Contenido | Requisito |
|---|---|---|
| Importar | Alta desde URL de FIBA LiveStats, individual y por lote | Existe |
| Catálogo de partidos | Listado filtrable por competencia, fecha y equipo, con acceso directo a S5 | Existe |
| Calidad de datos | Partidos sin play-by-play, posesiones incompletas, jugadores duplicados, campos nulos por competencia | F-11, C-08, C-11, A-01 |
| Competencias y temporadas | Alta y edición; define el universo de cálculo de los percentiles | F-11, T-01 |
| Reprocesado | Recalcular métricas de un partido o una competencia tras un cambio de fórmula | F-11 |

#### S2 · Liga

| Módulo | Contenido | Requisito |
|---|---|---|
| Tabla general | PJ, PG, PP, puntos (2 por victoria, 1 por derrota), anotados y recibidos | C-09 |
| Ranking avanzado | OER, DER, NRTG, four factors, PACE, en percentiles | T-01 |
| Mapa de liga | Dispersión OER/DER y otras combinaciones de ejes | C-10 |
| Líderes | Top de jugadores por cada métrica, con mínimo de minutos | F-14 |
| Perfil de la competencia | Promedios de referencia, ritmo, reparto de tiro, PPP por origen de posesión | F-14, A-02 |

#### S3 · Equipo

Organizado en pestañas internas para que la pantalla deje de ser un scroll continuo.

| Pestaña | Contenido | Requisito |
|---|---|---|
| Resumen | Récord, eficiencia, radar vs liga, four factors y panel Plan de juego | C-02, T-01, F-17 |
| Tiro | Mapa por zonas con PPT, detalle T2/T3/TL en promedio y totales | C-03, C-07 |
| Posesión | Origen, transición, segunda oportunidad y tramo de reloj, en ataque y defensa | A-02 a A-05 |
| Eventos | Producción tras asistencia, robo, rebote ofensivo, rebote defensivo y pérdida | A-07 |
| Quintetos | Combinaciones, tabla completa de todos los quintetos, ON/OFF, sinergias | F-06, T-05, T-06, A-08 |
| Momentos | Por cuarto y tramo seleccionable, cierres con diferencia ≤ 10 | F-04, C-06 |
| Plantel | Tabla de todos los jugadores del equipo con sus métricas, ordenable | F-08 |
| Enfrentamiento | Historial directo contra un rival elegido, con enlace a F-03 | F-20 |
| Game log | Partido a partido, evolución configurable y tendencias | F-18, Existe |

#### S4 · Jugador

| Pestaña | Contenido | Requisito |
|---|---|---|
| Ficha | Dorsal, posición, altura, año de nacimiento, nacionalidad, partidos disputados | F-16 |
| Resumen | Producción ofensiva, radar, evolución, percentiles | T-01, C-02 |
| Tiro | Shot chart por zonas con PPT, detalle T2/T3/TL | C-03, C-07 |
| Posesión | En qué tramo de reloj y en qué tipo de ataque participa y con qué eficiencia | A-03, A-05 |
| Eventos | Asistencias, robos, rebotes ofensivos y pérdidas con su consecuencia en puntos | A-07 |
| Distribución | Rebotes, AS/pos, % de asistencias del equipo, puntos por asistencia, segundos de posesión | C-01, A-12 |
| Impacto | +/-, ON/OFF, impacto ajustado, con quién rinde mejor | A-11, A-08 |
| Similares | Diez jugadores de perfil más parecido | A-09 |
| Tendencias | Medias móviles, últimos N contra el resto de la temporada, hitos | F-18 |
| Game log | Partido a partido con enlace al partido en S5 | Existe |

#### S5 · Partido  (sección nueva)

Un mismo partido visto en cuatro estados. La sección se abre desde el catálogo, desde el game log de un equipo o desde el calendario de S8.

| Modo | Cuándo se usa | Contenido | Requisito |
|---|---|---|---|
| Preparar | Antes del tip-off | Ventajas y amenazas, quintetos rivales, H2H, emparejamientos en tres niveles, informe exportable | F-03 |
| En vivo | Durante el partido | Eficiencia y four factors propios y del rival, distribución de puntos, jugadores en cancha, comparación con la temporada | F-01 |
| Momentum | Durante el partido | Racha, últimas 10 posesiones, últimos 5 minutos, jugadores calientes y alertas | F-02 |
| Analizar | Después del partido | Boxscore avanzado, mapa de tiros por zona y cuarto, jugada a jugada filtrable, línea de tiempo del marcador, parciales, quintetos del partido, exportación | F-07 |

Los cuatro modos comparten el mismo componente de partido: cambia la fuente de datos (en curso o cerrado), no la estructura. Conviene construir primero "Analizar", que trabaja sobre datos ya cargados, y derivar de ahí "En vivo".

#### S6 · Comparar

| Módulo | Contenido | Requisito |
|---|---|---|
| Equipos | Radar, tabla enfrentada, métricas avanzadas | Existe |
| Jugadores | Mismo formato, incluso entre equipos y competencias distintas | F-05 |
| Quintetos | Comparación de dos combinaciones con el ajuste de muestra aplicado | F-09 |
| Head to head | Historial entre dos equipos, enlazado con el modo Preparar de S5 | F-03 |

#### S7 · Explorar  (hoy Buscar)

| Módulo | Contenido | Requisito |
|---|---|---|
| Buscador de jugadores | Filtros por métrica, equipo, competencia y posición, sin duplicados | C-08, Existe |
| Buscador de quintetos | Mismos filtros aplicados a combinaciones, con umbral de posesiones | F-10, T-02 |
| Contextos cruzados | Matriz de dos dimensiones cualesquiera sobre la métrica elegida | A-06 |
| Similares | Búsqueda por perfil en lugar de por umbral | A-09 |
| Consultas guardadas | Guardar una búsqueda con su nombre y exportarla | F-10 |

#### S8 · Mi equipo  (sección nueva)

Pantalla de entrada para el entrenador: evita que tenga que reconstruir su contexto cada vez que abre la app.

| Módulo | Contenido | Requisito |
|---|---|---|
| Equipo fijado | Un equipo marcado como propio; la app arranca siempre en él | F-12 |
| Próximo partido | Rival, fecha y acceso directo al modo Preparar | F-12, F-03 |
| Plan de juego | Ventajas y riesgos del equipo contra la referencia elegida | F-17 |
| Alertas | Insights automáticos de la última semana y cambios bruscos de rendimiento | A-10 |
| Accesos directos | Últimos partidos, quintetos más usados, jugadores seguidos | F-12 |

#### S9 · Configuración  (sección nueva)

Los criterios de cálculo deben ser visibles y editables, no estar escondidos en el código.

| Módulo | Contenido | Requisito |
|---|---|---|
| Umbrales de muestra | Mínimos de posesiones para quintetos, ON/OFF y splits; constante de regresión | T-02, F-13 |
| Reglas de contexto | Cortes de tramo de reloj y de transición, umbral de partido cerrado | A-03, A-05, C-06 |
| Reglas de Momentum | Umbrales de jugador caliente y de alerta | F-02 |
| Preferencias | Base de normalización, competencia por defecto, etiquetas de métricas e idioma | T-04, F-13, F-21 |

## 2. Bloque C — Correcciones

### C-01 · Rebotes y distribución en perfil de jugador [P0]

- Revisar el cálculo de AS/pos, PER/pos, PTS/pos, RO/min y RD/min.
- Hoy en el perfil de jugador OR% y DR% se muestran vacíos ("—") con Ø 0.0%: verificar si es dato faltante o error de cálculo, y aplicar la regla de nulos de C-11.

**Criterio de aceptación:** Los cinco indicadores devuelven valor numérico coherente para todo jugador con minutos disputados.

### C-02 · Promedios de liga rotos [P0]

- Afecta a: perfil de equipo, evolución por partido, perfil de jugador y evolución por partido de jugador.
- El promedio de liga debe calcularse siempre sobre todos los partidos de la competencia y temporada seleccionadas, no sobre el subconjunto filtrado en pantalla.
- Excluir del promedio los registros nulos. Nunca reemplazar un nulo por cero.
- Revisar además la columna de variación porcentual: hoy arroja valores imposibles (ejemplos vistos: "↑ 1050.0%", "↑ 9900.0%"). Ese indicador se reemplaza por percentiles según T-01.

**Criterio de aceptación:** El mismo equipo consultado desde dos pantallas distintas muestra idéntico promedio de liga.

### C-03 · Mapas de tiro: PPT y detalle por zona [P1]

- En la etiqueta fija de cada zona mostrar: % de acierto, eFG% de la zona y PPT (puntos por tiro).
- Eliminar el indicador P/F de las etiquetas por zona y del encabezado.
- Aplica al mapa de tiro de equipo y al shot chart por zonas de jugador.

Detalle al pasar el cursor sobre una zona (en móvil y tablet, al tocarla), en un tooltip:

| Dato | Formato | Ejemplo |
|---|---|---|
| Convertidos / intentados | c/i | 3/5 |
| FG% de la zona | Un decimal | 60,0% |
| eFG% de la zona | Un decimal | 70,0% |
| PPT de la zona | Dos decimales | 1,40 |
| Peso de la zona | % de los tiros del equipo o jugador | 12,3% de los tiros |
| Percentil | Comparación con la competencia (T-01) | p78 |
| Muestra | Badge de T-02 cuando hay pocos intentos | Muestra baja |

- El tooltip respeta la barra de contexto (T-03): si hay filtro de tramo de reloj, cuarto o rival aplicado, muestra los datos de ese subconjunto.
- Zonas sin intentos: el tooltip indica que no hay tiros registrados, no muestra 0% ni PPT 0,00 (C-11).

**Criterio de aceptación:** ninguna etiqueta muestra "P/F", y al posarse sobre cualquier zona aparecen los siete datos de la tabla anterior.

### C-04 · AS/PER (asistencias sobre pérdidas) [P1]

- Revisar el cálculo y su presentación. Definir explícitamente si es AS/PER por partido o acumulado de temporada, y usar el mismo criterio en equipo y en jugador.

**Criterio de aceptación:** El valor coincide con el cálculo manual sobre el box score de la temporada.

### C-05 · Renombrar PEP [P2]

- Sustituir la etiqueta "PEP" por "PtsEnPint" en toda la aplicación, incluida la pantalla de comparación de equipos.

**Criterio de aceptación:** Búsqueda global de "PEP" en el código y en la UI sin resultados.

### C-06 · Umbral de cierres de partido [P1]

- Cambiar el criterio de partido cerrado de diferencia ≤ 15 a diferencia ≤ 10.
- Actualizar la leyenda de la sección y el recuento de partidos calificados y excluidos.

**Criterio de aceptación:** El encabezado indica "CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)" y el conteo de partidos calificados se recalcula.

### C-07 · Detalle de tiro completo en equipo y jugador [P1]

- Agregar T2i, T2c, T3i, T3c, TLi y TLc, en promedio por partido y en totales de temporada.
- Agregar puntos por tiro (PPT) general, de 2, de 3 y de tiros libres.

**Criterio de aceptación:** La sección Tiro muestra intentos y convertidos de las tres categorías más los cuatro valores de PPT.

### C-08 · Jugadores duplicados en el buscador [P0]

- Si en el mismo equipo y la misma competencia aparecen dos jugadores con idéntico nombre, deben unificarse en un solo registro.
- Causa habitual: en algunos partidos no se carga la posición desde FIBA LiveStats.
- Clave de deduplicación: nombre normalizado + equipo + competencia. Al unificar, conservar la posición no vacía y sumar los partidos de ambos registros.
- Normalizar el nombre antes de comparar: minúsculas, sin tildes, sin espacios dobles.

**Criterio de aceptación:** El total de jugadores de la base baja al eliminar duplicados y ningún equipo muestra dos fichas con el mismo nombre.

### C-09 · Tabla general en Liga [P1]

- Incluir tabla de posiciones clásica: PJ, PG, PP y puntos, con 2 puntos por partido ganado y 1 por partido perdido.
- Agregar columna de puntos anotados y puntos recibidos.

**Criterio de aceptación:** La tabla general ordena por puntos y su suma es coherente con el game log de cada equipo.

### C-10 · Mapa de liga — eje de rebote [P2]

- Invertir el sentido de la flecha del eje de rebote para que la dirección indique el lado favorable, igual que en los ejes de OER y DER.

**Criterio de aceptación:** La leyenda del eje describe correctamente hacia dónde está el mejor rendimiento.

### C-11 · Tratamiento de nulos en toda la app [P0]

Esta regla se aplica a todas las pantallas, sin excepción. Es la corrección de mayor impacto sobre la confianza en los datos.

| Valor | Significa | Ejemplos | Cómo se muestra |
|---|---|---|---|
| 0 | El dato existe y vale cero | 0 puntos · 0 rebotes · 0 asistencias · 0/5 en triples | Se muestra el número 0 |
| NULL | El dato no existe o no puede calcularse | Partido no cargado · sin play-by-play para la métrica · jugador sin minutos (DNP) · la competencia no registra ese dato | Se muestra "—", nunca 0 |

- Un NULL nunca entra en un promedio ni en un denominador.
- Un NULL nunca se ordena como si fuera 0: en tablas ordenables va siempre al final, en ambos sentidos.
- Un NULL nunca se pinta con color de rendimiento (verde/rojo).
- Los partidos con DNP no cuentan como partido jugado en los promedios del jugador.

**Criterio de aceptación:** recorrido completo de la app sin encontrar un solo 0 que en realidad sea un dato inexistente.

## 3. Bloque T — Cambios transversales

Estos seis cambios afectan a todas las pantallas y deben resolverse en una capa común, no pantalla por pantalla. T-05 y T-06 son los que evitan que cada apartado nuevo vuelva a quedar incompleto.

### T-01 · Ficha de métrica: valor, ranking y distancias [P0]

Toda métrica de equipo, jugador o quinteto se muestra siempre con el mismo conjunto de cinco elementos. No basta con el número ni con el percentil: el entrenador necesita saber en qué puesto está y cuánto le falta para alcanzar al de arriba.

| Elemento | Qué muestra | Ejemplo |
|---|---|---|
| Valor | El dato absoluto, siempre visible y en primer lugar | 1,09 |
| Ranking | Posición dentro de la competencia sobre el total de la población | 7.º de 12 |
| Distancia al líder | Diferencia con el mejor valor, con el nombre del líder | −0,06 (Peñarol 1,15) |
| Distancia al promedio | Diferencia con la media de la competencia, con signo | +0,02 (Ø 1,07) |
| Percentil | Posición relativa 0-100, con escala de color continua | p58 |

#### Reglas de cálculo

- El percentil usa escala de color continua: rojo en 0, gris en 50, verde en 100.
- Este conjunto reemplaza el bloque actual "Ø liga / ↑ x", que es la fuente de los valores inconsistentes descritos en C-02.
- En las métricas donde menos es mejor (DER, TO%, pérdidas, faltas cometidas), se invierte todo: el líder es el valor más bajo, el ranking se ordena a la inversa y el percentil se calcula al revés. La distancia al líder nunca debe quedar con el signo cambiado.
- El ranking indica siempre el total de la población, no solo el puesto: "7.º de 12" es interpretable, "7.º" no lo es.
- En caso de empate, mismo puesto para ambos y salto en el siguiente, con la marca de empate.
- Las distancias se expresan en las unidades de la métrica y, cuando la magnitud lo justifique, también en porcentaje relativo.
- Todo se recalcula sobre la selección activa de la barra de contexto (T-03): si el filtro es "últimos 5 partidos", el ranking y el líder son los de ese subconjunto, y debe indicarse.
- Al pasar el cursor sobre la ficha se despliega el ranking completo de la métrica, con la entidad consultada resaltada.

#### Población de referencia

- Equipos: al menos 3 partidos en la competencia.
- Jugadores: al menos 60 minutos en la competencia.
- Quintetos y parejas: los umbrales de posesiones de T-02.
- Quien no llegue al mínimo recibe igualmente su ficha completa, marcada como muestra baja, pero queda fuera de la población que define percentiles, líder y promedio. Así un quinteto de doce posesiones no distorsiona la referencia de todos los demás.

**Criterio de aceptación:** la ficha de una métrica cualquiera coincide con el ranking de liga: el puesto, el líder y el promedio mostrados son verificables en la tabla de la sección Liga.

### T-02 · Confiabilidad de muestra [P0]

Toda métrica derivada de posesiones muestra junto a ella las posesiones, los minutos y los partidos sobre los que se calculó. Aplica a combinaciones, ON/OFF, cierres, emparejamientos, splits y cualquier filtro por período.

#### Umbrales

Calibrados para el volumen real de estas competencias: entre 16 y 33 partidos por equipo, con unas 80 posesiones por partido. Un umbral alto dejaría la sección de quintetos prácticamente vacía, que es el error opuesto y no menos grave.

| Entidad | Mínimo para mostrar | Muestra alta |
|---|---|---|
| Quinteto | 15 posesiones | 40 posesiones |
| Pareja de jugadores | 30 posesiones | 80 posesiones |
| ON/OFF de jugador | 40 posesiones en cada estado | 120 posesiones |
| Emparejamiento quinteto vs quinteto | 8 posesiones | 25 posesiones |
| Split de contexto | 15 posesiones | 40 posesiones |
| Tramo de reloj o zona de tiro | 10 intentos | 30 intentos |
| Cierre de partido por quinteto | 2 posesiones del tramo | 3 partidos cerrados |
| Jugador (población de percentiles) | 60 minutos | 200 minutos |
| Equipo (población de percentiles) | 3 partidos | 10 partidos |

- Todos los valores son configurables desde F-13 y ninguno debe quedar fijo en el código.
- Badge de muestra: BAJA por debajo del mínimo, MEDIA entre el mínimo y el nivel alto, ALTA por encima.
- Umbral relativo como alternativa recomendada: en lugar de un número fijo, un porcentaje de las posesiones totales del equipo en la temporada (por ejemplo, 1,5% para quintetos), con el valor absoluto de la tabla como piso. Así el umbral se adapta solo a una liga de 16 partidos y a una de 33 sin tocar la configuración.

#### Qué hacer con las muestras pequeñas

Bajar el umbral no elimina el ruido, lo hace visible. La app compensa con tres mecanismos en lugar de esconder el dato:

- Regresión a la media en OER, DER y Net Rating: valor_ajustado = (pos × valor + K × media_liga) / (pos + K). K por defecto: 25 posesiones para quintetos, 50 para ON/OFF, 20 para splits. Se muestran el valor crudo y el ajustado, y todo ranking se ordena por el ajustado.
- K no es un número arbitrario: debe calibrarse sobre los datos ya cargados con correlación de mitades (dividir las posesiones de cada quinteto en dos mitades y ver a partir de qué volumen la primera predice la segunda). Los valores de arriba son el punto de partida hasta que se haga esa calibración.
- Banda de error: junto al valor ajustado, el margen esperado según las posesiones. Con 15 posesiones el margen es amplio y eso debe verse, no ocultarse.
- Por debajo del mínimo, la métrica se muestra en gris con la advertencia correspondiente y queda fuera de rankings, tarjetas de líderes y sugerencias automáticas. Se sigue viendo, pero no se recomienda a partir de ella.

**Criterio de aceptación:** la tabla de quintetos de un equipo devuelve un número útil de filas ordenables, y ninguna de las tarjetas de líderes está encabezada por una combinación de menos posesiones que el umbral.

### T-03 · Selector global de contexto (splits) [P1]

- Barra de filtros persistente que afecta a toda la vista activa.
- Dimensiones: competencia · período (todos / últimos 3 / 5 / 10) · local o visitante · rival · cuarto (1 a 4 y prórroga) · situación de marcador (diferencia ≤ 10 o paliza) · con y sin jugador X · días de descanso.
- Dimensiones de posesión, definidas en el bloque A: tramo de reloj (0-8 / 9-16 / 17-24) · origen de la posesión · transición o media cancha · primera oportunidad o segunda oportunidad.
- Los filtros se combinan entre sí.
- El estado del filtro viaja en la URL para poder compartir una vista concreta con el cuerpo técnico.
- Cada filtro aplicado recalcula también el badge de muestra de T-02.

**Criterio de aceptación:** Cambiar un filtro recalcula todos los bloques de la pantalla, y recargar la URL reproduce exactamente la misma vista.

### T-04 · Base de normalización [P1]

- En toda vista con estadísticas, selector de base: totales · por partido · por 40 minutos · por 100 posesiones.
- La selección se mantiene al navegar entre pestañas dentro de la misma sesión.
- Aplica tanto a equipo como a jugador, a lineups y a los splits de T-03.

**Criterio de aceptación:** Las cuatro bases devuelven valores consistentes entre sí para un mismo jugador y partido.

### T-05 · Conjunto estándar de métricas — regla de completitud [P0]

Regla general de la aplicación: ningún apartado puede mostrar un subconjunto arbitrario de métricas. Toda entidad analizable devuelve el conjunto completo. Hoy los quintetos y el ON/OFF muestran cuatro o cinco indicadores sueltos y quedan sin eFG%, FG2%, FG3%, TS%, uso de triple, tiros libres o rebote; eso obliga a salir de la pantalla para completar la lectura y hace la información inutilizable para decidir.

Entidades a las que aplica, sin excepción: equipo · jugador · quinteto · ON/OFF · pareja de jugadores · emparejamiento · cuarto o tramo · cierre de partido · split de contexto · origen de posesión · tramo de reloj · zona de tiro · cadena de evento (asistencia, robo, rebote ofensivo, pérdida).

#### Conjunto estándar

| Grupo | Métricas obligatorias |
|---|---|
| Volumen | Partidos · minutos · posesiones · PACE · segundos por posesión |
| Producción | PTS · PTS recibidos · PPP · OER · DER · Net Rating · +/- |
| Tiro — intentos y aciertos | T2i · T2c · T3i · T3c · TLi · TLc · TCi · TCc (totales y por partido) |
| Tiro — porcentajes | FG% · FG2% · FG3% · FT% · eFG% · TS% |
| Tiro — valor | PPT general · PPT de 2 · PPT de 3 · PPT de TL |
| Tiro — perfil | Uso de triple (T3i sobre TCi) · uso de 2 · FT Rate · reparto por zona |
| Balón | AS · PER · AS/PER · AS/pos · AS% · TO% |
| Rebote | RO · RD · REB · OR% · DR% · REB% · RO/pos · RD/min · RO/min |
| Defensa | Robos · tapones a favor · tapones recibidos · stops · puntos recibidos |
| Faltas | Faltas cometidas · faltas recibidas |
| Uso e impacto | USO% · USO 2P · USO 3P · percentil de cada métrica · muestra de respaldo |

- Cada métrica se acompaña siempre de su percentil (T-01) y del badge de muestra (T-02).
- Si una métrica no puede calcularse para esa entidad, se muestra como nulo con la razón, nunca se omite de la tabla ni se sustituye por cero (C-11). Un campo ausente y un campo vacío no comunican lo mismo.
- El conjunto se define una sola vez en el backend y se reutiliza. No debe haber una lista de métricas distinta por pantalla.
- Las cuatro bases de normalización de T-04 se aplican a todo el conjunto.

**Criterio de aceptación:** seleccionar un quinteto, un jugador y un emparejamiento devuelve exactamente los mismos grupos de métricas, sin huecos y sin diferencias de nomenclatura.

### T-06 · Tablas completas y exportación [P0]

Todo apartado que muestre datos agregados debe ofrecer, además de la visualización resumida, la tabla completa con el conjunto estándar de T-05. Las tarjetas y los gráficos son la lectura rápida; la tabla es el dato.

#### Requisitos de toda tabla

- Muestra el conjunto completo de T-05, con una fila por entidad (cada quinteto, cada jugador, cada cruce, cada tramo).
- Ordenable por cualquier columna, con los nulos siempre al final en ambos sentidos.
- Selector de columnas visibles, con la selección recordada por usuario y por pantalla.
- Fila de totales y fila de promedio de la competencia al pie.
- Coloreado por percentil, desactivable.
- Respeta la barra de contexto (T-03) y la base de normalización (T-04) activas.
- Paginación o scroll virtual: la tabla de quintetos de un equipo puede superar las mil filas y no debe truncarse en silencio.

#### Exportación

- Botón de exportación en toda tabla, sin excepción.
- Formatos: CSV y XLSX para datos; PNG y PDF para la vista tal como se muestra.
- La exportación incluye exactamente lo que está en pantalla: mismos filtros, misma base de normalización, mismo orden y mismas columnas visibles.
- Cabecera del archivo con equipo o entidad, competencia, temporada, filtros aplicados y fecha de generación, para que el archivo sea interpretable meses después.
- Exportación masiva desde S1: todas las tablas de un equipo o de una competencia en un único archivo con una hoja por apartado.
- Nombre de archivo autogenerado y legible, con entidad, competencia y fecha.

**Criterio de aceptación:** cualquier tabla de la app se exporta y el archivo resultante reproduce el mismo contenido, con los filtros aplicados documentados en la cabecera.

## 4. Bloque F — Funcionalidades

### F-01 · Partido en vivo [P1]

Seguimiento del partido mientras transcurre, en colectivo por equipo y por jugadores.

#### Actualización

- Refresco tras cada posesión detectada en el play-by-play, con un máximo de 60 segundos entre actualizaciones.
- Debe poder entrarse también a partidos anteriores ya finalizados con la misma vista.

#### Métricas de equipo, siempre con el rival al lado

- OER · DER · Net Rating · eFG% · TS% · PPP · Posesiones
- Four factors: eFG% · TO% · OR% · FT Rate
- Puntos por tiro y puntos por posesión
- Comparación de cada valor contra el promedio de temporada del propio equipo

#### Cómo se están consiguiendo los puntos

- Distribución: pintura · media distancia · triple · tiros libres · segunda oportunidad · contraataque · tras pérdida rival · tras rebote ofensivo

#### Jugadores

- Por cada jugador: OER · TS% · eFG% · USO% · +/- · puntos creados · puntos desde asistencia · rebotes ofensivos que terminaron en puntos · robos que terminaron en puntos · pérdidas castigadas
- Estado visual en cancha / descansando

**Criterio de aceptación:** durante un partido en curso los valores se actualizan sin recargar la página y coinciden con el box score oficial al cierre.

### F-02 · Pestaña Momentum [P1]

Dentro de la vista de partido. Muestra únicamente lo que está cambiando el partido en ese momento, no el acumulado.

#### Equipo

- Racha actual (parcial abierto)
- Últimas 10 posesiones: PPP
- Últimos 5 minutos: OER, DER y Net Rating
- Últimas 5 posesiones con su desenlace: tiro, asistencia, pérdida, rebote ofensivo, triple

#### Jugadores calientes y fríos

- 3 conversiones consecutivas
- 8 o más puntos en los últimos 3 minutos
- 4 asistencias consecutivas del equipo con ese jugador como asistente
- 3 rebotes ofensivos en el cuarto
- 3 pérdidas consecutivas (alerta)

Las reglas y sus umbrales deben quedar en configuración, no fijos en el código.

### F-03 · Preparar partido [P0]

Es la función de mayor valor para un entrenador y hoy no existe. El resultado no es un dashboard para navegar, sino un informe para leer antes del tip-off.

#### Contenido del informe

- 5 ventajas propias y 5 amenazas del rival, generadas automáticamente comparando four factors y percentiles (T-01) de ambos equipos.
- Quintetos rivales más usados, con minutos, posesiones y Net Rating ajustado.
- Principales amenazas ofensivas del rival: USO%, zonas de tiro con mayor PPT y de dónde reciben sus puntos.
- Historial head to head entre ambos equipos.
- Tabla de matchups: resultado de cada combinación de quintetos que ambos equipos usaron entre sí.
- Filtro de últimos N partidos del rival para evitar arrastrar información vieja.

#### Emparejamientos

Módulo central del informe. Debe permitir revisar los cruces en los tres niveles, y en todos los casos con tabla completa y exportable según T-06.

| Nivel | Contenido |
|---|---|
| Quinteto vs quinteto | Matriz de todos los quintetos propios contra todos los del rival: minutos compartidos, posesiones, puntos a favor y en contra, Net Rating, eFG% y TS% de cada lado, TO% y OR% del tramo |
| Jugador vs jugador | Minutos compartidos en cancha, posesiones, +/- del tramo, producción de cada uno mientras coincidieron, y desglose de tiro de ambos |
| Jugador vs quinteto | Rendimiento de cada jugador propio contra cada combinación rival, y a la inversa |

- Selector de quinteto propio: al elegir uno, se ordenan todos los quintetos rivales por Net Rating del cruce, de mejor a peor. Responde directamente a "con qué cinco salgo contra los suyos".
- Selector inverso: al elegir un quinteto rival, se ordenan los propios que mejor rindieron contra él.
- Historial: cada celda de la matriz indica en qué partidos y con cuántas posesiones se produjo ese cruce, con enlace al partido correspondiente en S5.
- Cruces sin antecedentes: cuando dos quintetos nunca se enfrentaron, la celda se muestra vacía con la marca de sin datos, nunca como cero (C-11).
- Todo cruce por debajo del umbral de emparejamiento de T-02 se muestra en gris y no se ordena entre los recomendados. Los cruces entre quintetos concretos suelen tener poco volumen, por eso su umbral es el más bajo de la tabla; la contrapartida es que el margen de error se muestra siempre.
- Emparejamiento propuesto por perfil: sugerencia de qué jugador propio puede asumir a cada amenaza rival, cruzando el perfil de similitud (A-09) con minutos y uso.

**Advertencia técnica:** FIBA LiveStats no registra la asignación defensiva, por lo que "quién marca a quién" no es un dato medido. Lo que la app puede calcular con rigor es la coincidencia en cancha y el rendimiento durante esos tramos. El módulo debe nombrarse y presentarse en esos términos, no como marcaje individual, y la sugerencia por perfil debe aparecer marcada como estimación.

#### Salida

- PDF A4 de dos páginas, listo para imprimir.
- Imagen PNG en formato vertical para compartir por WhatsApp con el cuerpo técnico.
- Exportación CSV de los datos de base.

**Criterio de aceptación:** desde la selección de dos equipos, el informe se genera en menos de 10 segundos y es legible sin necesidad de abrir la app.

### F-04 · Estadísticas por cuarto [P1]

- Bloque nuevo debajo de la sección de equipo, con la misma información que el bloque de cierres de partido.
- Selector para elegir el tramo del partido que se quiere ver: cada cuarto, primera y segunda parte, prórroga, últimos 5 minutos.

**Criterio de aceptación:** El mismo bloque de métricas responde al selector de tramo sin recargar la pantalla.

### F-05 · Comparar jugadores [P1]

- Agregar comparación de jugadores en la misma pantalla donde hoy se comparan equipos.
- Reutilizar el radar comparativo, la tabla de métricas enfrentadas y el bloque de métricas avanzadas.
- Debe permitir comparar jugadores de equipos y competencias distintas.

**Criterio de aceptación:** Dos jugadores seleccionados muestran radar, tabla enfrentada y avanzadas de forma equivalente a la comparación de equipos.

### F-06 · Combinaciones y ON/OFF ampliados [P1]

Ampliar los parámetros de comparación en ambas secciones. Agrupar en tres bloques:

| Bloque | Métricas |
|---|---|
| Ataque | PPP · PPT general, de 2, de 3 y de TL · T2i · T2c · T3i · T3c · TLi · TLc · pérdidas · tapones recibidos · faltas cometidas · faltas recibidas · rebotes ofensivos · asistencias |
| Defensa | Recuperos · tapones a favor · % de rebote ofensivo y defensivo · puntos recibidos |
| Avanzado | Posesiones jugadas · +/- · OER · DER · Net Rating · eFG% · RO/pos · AS/pos |

- Agregar una tabla con todos los quintetos del equipo y sus respectivos números, ordenable por cualquier columna y exportable (T-06).
- Aplicar obligatoriamente los umbrales y la regresión de T-02 antes de rankear.
- Los tres bloques anteriores son el mínimo temático: el detalle exacto de métricas lo fija el conjunto estándar de T-05, que es de cumplimiento obligatorio también aquí. Hoy es el apartado más incompleto de la app.

#### Rendimiento en cierres por quinteto

- Récord en partidos cerrados con el formato victorias-derrotas, por ejemplo 2-1, junto al porcentaje de victorias.
- Un partido cuenta para el récord de un quinteto cuando ese quinteto estuvo en cancha durante el tramo de cierre un mínimo de posesiones configurable (valor sugerido: 2 posesiones, según T-02). El umbral se define en F-13.
- Criterio de partido cerrado: últimos 5 minutos con diferencia ≤ 10 (C-06).
- Además del récord, mostrar el diferencial propio del tramo: puntos a favor y en contra mientras ese quinteto estuvo en cancha. El resultado del partido no siempre es atribuible al quinteto, y el diferencial del tramo sí lo es.
- Métricas del tramo de cierre por quinteto: posesiones, OER, DER, Net Rating, eFG%, TS%, TO%, OR% y FT Rate, según el conjunto estándar de T-05.
- Con menos de tres partidos cerrados disputados, el récord se muestra acompañado del badge de muestra baja y no se ordena entre los mejores.

#### Quintetos líderes del equipo

Bloque de tarjetas con los tres mejores quintetos en cada categoría, para lectura rápida sin recorrer la tabla completa.

| Categoría | Criterio de orden |
|---|---|
| Impacto | Net Rating ajustado · OER · DER |
| Tiro | eFG% · TS% · PPT |
| Rebote | OR% · DR% · REB% · rebotes totales |
| Cuidado del balón | TO% (menor es mejor) · AS/PER |
| Ritmo | PACE · posesiones por 40 minutos |
| Cierres | Net Rating en tramo de cierre · récord clutch |
| Volumen | Minutos y posesiones compartidas (quintetos más utilizados) |

- Cada tarjeta muestra los cinco nombres, el valor de la métrica, su percentil y la muestra de respaldo.
- Solo entran al ranking los quintetos que superan el umbral de posesiones de T-02, y se ordenan por el valor ajustado, no por el crudo. Sin esta regla el líder sería siempre un quinteto que jugó ocho posesiones.
- Cada tarjeta muestra además el ranking y la distancia al líder y al promedio, según la ficha de métrica de T-01.
- Cada tarjeta enlaza a la fila correspondiente de la tabla completa.
- El bloque completo es exportable (T-06).

### 4.1 Módulos nuevos derivados de la arquitectura

### F-07 · Analizar partido [P1]

- Vista completa de un partido ya finalizado, dentro de la sección Partido.
- Boxscore con métricas avanzadas de tiro por jugador y equipo.
- Mapa de tiros filtrable por zona, cuarto y tramo de reloj.
- Jugada a jugada con filtros por jugador, tipo de evento y período.
- Línea de tiempo del marcador con los parciales y los tiempos muertos marcados.
- Parciales por cuarto y ratings avanzados de ambos equipos.
- Quintetos utilizados en el partido y tabla de matchups contra los quintetos rivales.
- Exportación a CSV y a informe de scouting.

**Criterio de aceptación:** Cualquier partido del catálogo se abre en esta vista y sus totales coinciden con el box score oficial. Es la base técnica sobre la que se construye F-01.

### F-08 · Plantel dentro de Equipo [P1]

- Tabla con todos los jugadores del equipo y sus métricas principales, ordenable por cualquier columna, con percentiles.
- Hoy para comparar a dos jugadores del mismo plantel hay que entrar y salir de la ficha de cada uno.
- Enlace directo a la ficha del jugador y a la comparación.

**Criterio de aceptación:** Desde el perfil de un equipo se ve todo el plantel sin abandonar la pantalla.

### F-09 · Comparar quintetos [P2]

- Comparación de dos combinaciones con el mismo formato que la comparación de equipos, aplicando los umbrales y la regresión de T-02.

**Criterio de aceptación:** Dos quintetos se comparan con radar y tabla enfrentada, con el badge de muestra visible en ambos.

### F-10 · Buscador de quintetos y consultas guardadas [P2]

- Aplicar la lógica del buscador de jugadores a las combinaciones: filtros por métrica, mínimo de posesiones y jugadores incluidos o excluidos.
- Permitir guardar una búsqueda con nombre y volver a ejecutarla.
- Exportar el resultado a CSV.

**Criterio de aceptación:** Una búsqueda guardada devuelve el mismo resultado al reejecutarse sobre los mismos datos.

### F-11 · Panel de calidad de datos [P1]

- Dentro de la sección Datos: partidos importados sin play-by-play, posesiones que no cerraron correctamente, jugadores duplicados detectados, campos nulos por competencia.
- Alta y edición de competencias y temporadas, que definen el universo de cálculo de los percentiles de T-01.
- Acción de reprocesado de un partido o de una competencia completa tras un cambio de fórmula.

**Criterio de aceptación:** Antes de publicar una competencia se puede verificar en una sola pantalla que no hay partidos incompletos.

### F-12 · Mi equipo [P2]

- Marcar un equipo como propio; la app arranca siempre en él.
- Próximo partido con acceso directo al modo Preparar.
- Alertas: insights automáticos de la última semana y variaciones bruscas de rendimiento.
- Accesos directos a últimos partidos, quintetos más usados y jugadores seguidos.

**Criterio de aceptación:** Al abrir la app, el entrenador ve su equipo sin aplicar ningún filtro.

### F-13 · Configuración [P1]

- Umbrales de muestra y constante de regresión de T-02.
- Cortes de tramo de reloj, criterio de transición y umbral de partido cerrado.
- Umbrales de las reglas de Momentum.
- Base de normalización y competencia por defecto, y etiquetas de métricas.
- Ningún umbral debe quedar fijo en el código.

**Criterio de aceptación:** Cambiar un umbral en configuración se refleja inmediatamente en los cálculos de toda la app.

### F-15 · Sugerencias de quinteto asistidas por IA [P2]

Capa de lectura sobre la sección de quintetos: convierte la tabla en recomendaciones accionables. Se apoya en un modelo de lenguaje, pero el modelo no calcula nada.

#### Arquitectura obligatoria

- Todos los números se calculan en el backend con las reglas de este documento. El modelo recibe un resumen ya calculado (quintetos, métricas, percentiles, muestra) y solo redacta la lectura.
- El modelo no accede a datos crudos ni realiza operaciones aritméticas. Cualquier cifra que aparezca en el texto debe existir previamente en el resumen enviado.
- Solo se envían al modelo quintetos que superan el umbral de muestra de T-02.
- Cada sugerencia se muestra junto a los datos que la sustentan, para que el entrenador pueda verificarla en la misma pantalla.
- Etiquetado explícito de que se trata de una sugerencia generada automáticamente.
- La sugerencia se genera bajo demanda, no en cada carga de pantalla, por coste y por latencia.

#### Tipos de sugerencia

- Quinteto recomendado según el objetivo elegido: anotar, defender, reboteear, frenar el ritmo o cerrar el partido.
- Quinteto recomendado contra un rival concreto, cruzando con los emparejamientos de F-03.
- Quintetos infrautilizados: buen rendimiento ajustado y pocos minutos.
- Quintetos a evitar: rendimiento bajo sostenido con muestra suficiente.
- Cambios de una pieza: qué jugador entra o sale de un quinteto y cómo cambia su perfil, apoyado en las sinergias de A-08.
- Lectura de cierres: qué quinteto sostiene mejor los finales ajustados según el récord clutch y el diferencial del tramo.

#### Límites que deben quedar escritos en la interfaz

- La sugerencia describe lo que ya ocurrió, no predice lo que va a ocurrir.
- No sustituye el criterio del entrenador ni contempla lesiones, faltas, estado físico ni decisiones tácticas.
- Si ningún quinteto supera el umbral de muestra, la app lo dice y no genera sugerencia. Es preferible no responder que responder sobre veinte posesiones.

**Criterio de aceptación:** ninguna cifra del texto generado difiere de la que muestra la tabla, y desactivar la función deja el resto de la sección intacta.

### F-14 · Líderes y perfil de competencia [P2]

- En la sección Liga: top de jugadores por cada métrica, con mínimo de minutos configurable.
- Perfil de la competencia: promedios de referencia, ritmo, reparto de tiro y PPP por origen de posesión.
- Estos promedios son la base de cálculo de los percentiles de T-01, por lo que deben ser consultables.

**Criterio de aceptación:** Los valores del perfil de competencia coinciden con los usados para calcular los percentiles.

### 4.2 Módulos derivados del análisis de referencia

Incorporaciones tomadas de una herramienta comparable del mercado. Son patrones de presentación y de flujo de trabajo, no de profundidad analítica: en mapas de tiro por zona, quintetos y contexto de posesión, Smart-Basket ya va por delante y no debe simplificarse para parecerse a la referencia.

### F-16 · Ficha de identidad del jugador [P1]

- Cabecera de la sección Jugador con los datos de plantel: dorsal, posición, altura, año de nacimiento, nacionalidad y club actual.
- Línea de contexto bajo el nombre: competencia, equipo y partidos disputados en la selección activa (por ejemplo, "Liga de Ascenso 2026 · Welcome · 16 partidos").
- Los datos que FIBA LiveStats no publique se muestran como nulos, nunca en blanco silencioso (C-11), y deben poder completarse manualmente.
- Hoy el perfil arranca directamente en las métricas y el usuario no sabe a quién está mirando.

**Criterio de aceptación:** Toda ficha de jugador identifica al jugador antes de mostrar un solo número.

### F-17 · Plan de juego [P1]

Panel de lectura rápida que traduce los percentiles en dos columnas: en qué se es mejor y en qué se es vulnerable. Es la versión permanente y en pantalla de lo que F-03 entrega como informe.

#### Formato de cada ítem

| Elemento | Contenido | Ejemplo |
|---|---|---|
| Métrica | Nombre corto | eFG% |
| Diferencia | Delta contra la referencia, con signo y color | +0,8 |
| Valores | Propio frente a referencia | 53,2 vs 52,4 |
| Percentil | Posición en la competencia (T-01) | p71 |
| Lectura | Frase accionable de una línea | Ventaja en tiro: buscá volumen en medio campo |
| Dirección | Icono de ventaja o de riesgo | ↑ / ↓ |

- Referencia seleccionable: promedio de la competencia, promedio del rival del próximo partido, o el propio equipo en un período anterior.
- Entre tres y cinco ítems por columna, ordenados por magnitud del delta.
- Las frases salen de plantillas fijas por métrica, con las mismas reglas de A-10. No se generan libremente.
- Presente en la sección Equipo, en Mi equipo (S8) y como bloque del informe de F-03.
- Panel plegable, con el estado recordado por usuario.

**Criterio de aceptación:** cada ítem del panel es verificable contra la tabla de métricas de la misma pantalla.

### F-18 · Tendencias y evolución configurable [P2]

El gráfico de evolución actual muestra siempre las mismas dos series. Debe convertirse en un componente configurable, y sumarse la lectura de tendencia.

- Selector de series a graficar: cualquier métrica del conjunto estándar de T-05, hasta tres simultáneas con eje secundario.
- Pares preconfigurados de uso frecuente: puntos anotados frente a puntos recibidos, OER frente a DER, eFG% frente a TO%.
- Gráfico de diferencia de puntos por partido, con línea de cero y color según resultado.
- Media móvil configurable de 3, 5 o 10 partidos, superpuesta a la serie cruda.
- Indicador de tendencia: comparación de los últimos N partidos contra el resto de la temporada, con el delta y su significancia según la muestra.
- Marcado de hitos sobre el eje: cambios de racha, partidos como local o visitante, ausencias de jugadores clave.
- Disponible en equipo, jugador y quinteto, y exportable como imagen (T-06).

**Criterio de aceptación:** el mismo componente sirve para las tres entidades y permite cambiar de métrica sin recargar la pantalla.

### F-19 · Filtros rápidos y cabecera de contexto [P1]

Capa de presentación de la barra de contexto de T-03. El filtro existe, pero debe estar al alcance de un toque y ser visible en todo momento.

- Chips de acceso directo en línea: período (Todos · Últimos 3 · 5 · 10 · 15), sede (Todos · Local · Visitante) y rival, con un chip por cada equipo de la competencia.
- Los chips reflejan el estado activo y se combinan entre sí; el resto de dimensiones de T-03 queda en un panel desplegable.
- Cabecera de contexto permanente: nombre de la entidad, récord con formato victorias-derrotas, diferencia media de puntos, partidos incluidos en la selección activa y badge de muestra (T-02).
- Al cambiar un filtro, la cabecera indica cuántos partidos quedaron dentro de la selección. Es la forma más simple de evitar que alguien lea una métrica sin saber sobre cuántos partidos se calculó.
- Botón de limpiar filtros siempre visible cuando hay alguno activo.

**Criterio de aceptación:** en cualquier pantalla se puede saber, sin desplazarse, qué filtros están aplicados y sobre cuántos partidos.

### F-20 · Enfrentamiento directo dentro de Equipo [P2]

- Pestaña de enfrentamiento en la sección Equipo: seleccionar un rival y ver el historial directo sin pasar por el modo Preparar.
- Contenido: resultados de los partidos entre ambos, promedios del equipo contra ese rival frente a sus promedios generales, y diferencias más marcadas.
- Enlace al informe completo de F-03 y a los emparejamientos.

**Criterio de aceptación:** Desde el perfil de un equipo se accede al historial contra cualquier rival en dos clics.

### F-21 · Multi-idioma [P2]

- Interfaz en español, inglés y portugués, con selector persistente por usuario.
- Extraer todos los textos a archivos de traducción; no debe quedar texto fijo en los componentes.
- Incluye las plantillas de frases de A-10 y F-17, y las cabeceras de los archivos exportados de T-06.
- Los nombres de métricas se mantienen en su forma estándar internacional (eFG%, TS%, OER) en los tres idiomas; solo se traducen las descripciones.
- Relevante para abrir la herramienta a otros mercados de la región.

**Criterio de aceptación:** Cambiar de idioma traduce toda la interfaz sin dejar cadenas sin traducir ni romper el diseño.

## 5. Bloque A — Analítica avanzada

Todo este bloque se alimenta del play-by-play, que ya se está importando. Es la parte que ninguna herramienta disponible en el mercado local ofrece.

Los cinco primeros requisitos de este bloque (A-01 a A-05) forman una unidad: definen la posesión como objeto de análisis con sus atributos de contexto. Conviene desarrollarlos juntos, porque comparten el mismo motor de reconstrucción del play-by-play.

### 5.1 Motor de posesiones

### A-01 · Reconstrucción de la posesión [P0]

Prerrequisito técnico de todo el bloque. Hoy la app calcula posesiones por fórmula agregada; para el contexto hace falta que cada posesión sea un registro individual con sus atributos.

#### Estructura del registro de posesión

| Campo | Contenido |
|---|---|
| id_posesión | Identificador único dentro del partido |
| equipo | Equipo que ataca |
| inicio / fin | Reloj de partido al comienzo y al final |
| duración | Segundos transcurridos |
| origen | Cómo empezó la posesión (ver A-02) |
| tipo | Transición, early offense o media cancha (ver A-03) |
| oportunidad | Primera oportunidad o segunda oportunidad tras rebote ofensivo (ver A-04) |
| reloj_inicial | 24 segundos, o 14 si hubo reset por rebote ofensivo o falta |
| tramo_tiro | Tramo de reloj en que se produjo el tiro (ver A-05) |
| finalización | Cómo terminó: T2c, T2f, T3c, T3f, falta recibida, pérdida, fin de cuarto |
| puntos | Puntos anotados en la posesión, incluidos tiros libres y adicionales |
| quinteto_propio / rival | Los cinco jugadores de cada lado en cancha |
| jugadores implicados | Quién finaliza, quién asiste, quién comete la pérdida |

#### Reglas de reconstrucción

- La posesión termina con: canasta convertida, tiro libre final convertido, rebote defensivo del rival, pérdida, o fin de cuarto.
- Un rebote ofensivo NO termina la posesión: la continúa. Pero abre una segunda oportunidad, que se marca como tal y reinicia el reloj a 14.
- Los tiros libres derivados de una falta en acción de tiro pertenecen a la posesión que generó la falta.
- Una falta técnica o antideportiva no cierra la posesión salvo que cambie el sentido del ataque.
- Toda posesión debe cerrar con una finalización. Si el play-by-play deja huecos, la posesión se marca como incompleta y queda excluida de los cálculos de contexto, no imputada a cero (regla C-11).

**Criterio de aceptación:** el total de posesiones reconstruidas individualmente no difiere en más de un 2% del total calculado por la fórmula agregada del glosario. Toda diferencia mayor indica huecos en la reconstrucción y debe investigarse antes de seguir.

### 5.2 Dimensiones de contexto

### A-02 · Origen de la posesión [P1]

De dónde viene el balón condiciona todo lo que pasa después. Cada posesión se clasifica en uno y solo uno de estos orígenes:

| Origen | Definición |
|---|---|
| Tras canasta rival | El rival anotó; saque de fondo sin interrupción |
| Tras rebote defensivo | Recuperación del balón tras tiro fallado del rival |
| Tras robo | Recuperación por robo o balón suelto |
| Tras pérdida rival sin robo | Pasos, dobles, fuera de banda, 24 segundos del rival |
| Tras rebote ofensivo | Continuación de posesión propia (se cruza con A-04) |
| Saque de banda | Reanudación de juego en zona de ataque o defensa |
| Saque de fondo tras tiempo muerto | Jugada preparada, alto valor de scouting |
| Tras tiro libre rival | Convertido o rebotado |

#### Qué se muestra por cada origen

- Volumen: cantidad y porcentaje sobre el total de posesiones.
- Eficiencia: PPP, eFG%, TO% y FT Rate.
- Duración media de la posesión.
- Distribución de finalizaciones: qué porcentaje termina en T2, T3, TL o pérdida.
- La misma tabla en versión defensiva: qué PPP concede el equipo según el origen de la posesión rival. Es lo que revela, por ejemplo, si un equipo defiende bien en estático pero se desarma tras canasta propia.

**Criterio de aceptación:** la suma de posesiones de todos los orígenes coincide exactamente con el total de posesiones del equipo.

### A-03 · Transición y contraataque [P1]

Clasificación por velocidad de ataque, independiente del origen. Una posesión tiene origen y además tiene tipo.

| Tipo | Criterio | Qué mide |
|---|---|---|
| Transición | Tiro o falta recibida en los primeros 7 segundos de posesión | Contraataque puro |
| Early offense | Entre 8 y 12 segundos | Ataque temprano sin sistema completo |
| Media cancha | A partir del segundo 13 | Juego de sistema |

#### Métricas ofensivas de transición

- Frecuencia de transición: posesiones de transición sobre el total. Es el indicador de identidad de juego del equipo.
- PPP en transición frente a PPP en media cancha, y el diferencial entre ambos.
- Origen del contraataque: tras rebote defensivo, tras robo, tras canasta rival, tras pérdida rival. Cruzar con A-02.
- Segundos hasta el primer tiro, promedio y distribución.
- Distribución de finalización en transición: bandeja o volcada, triple de esquina, triple frontal, tiro libre, pérdida.
- Porcentaje de rebotes defensivos que se convierten en transición, y de esos cuántos terminan en anotación.
- Jugadores que más corren: transiciones iniciadas y finalizadas por jugador, y PPP personal en transición.
- Primer pase de salida: quién lo da y qué PPP genera el equipo tras cada pasador.

#### Métricas defensivas de transición

- PPP concedido en transición frente al concedido en media cancha.
- Transiciones concedidas por cada 100 posesiones y su origen: tras pérdida propia, tras tiro fallado, tras canasta propia.
- Porcentaje de pérdidas propias que el rival convierte en contraataque. Cruzar con la sección de pérdidas de A-06.
- Balance defensivo: posesiones donde el rival anota en los primeros 7 segundos tras un tiro propio fallado.

**Criterio de aceptación:** la frecuencia de transición de un equipo se mantiene estable al recalcular sobre subconjuntos de partidos, y el reparto transición / early / media cancha suma 100%.

### A-04 · Rebote ofensivo y segunda oportunidad [P1]

Un rebote ofensivo no es un evento aislado: abre una posesión nueva dentro de la misma posesión. Se analiza como cadena completa.

#### Clasificación del desenlace

| Desenlace | Definición |
|---|---|
| Putback inmediato | Tiro en los 3 segundos siguientes al rebote, sin pase intermedio |
| Reinicio de ataque | El equipo saca el balón y vuelve a construir con los 14 segundos |
| Kick-out a triple | Pase al perímetro y triple en los 6 segundos siguientes |
| Falta recibida | La segunda oportunidad termina en tiros libres |
| Pérdida | Se pierde el balón sin llegar a tirar |
| Sin puntos | Se tira y se falla sin nuevo rebote ofensivo |

#### Métricas ofensivas

- PPP de segunda oportunidad frente a PPP de primera oportunidad. El diferencial suele ser el argumento más fuerte para insistir en el rebote de ataque.
- Puntos por rebote ofensivo: puntos generados en la cadena dividido por rebotes ofensivos capturados.
- Tasa de conversión de segunda oportunidad: porcentaje de rebotes ofensivos que terminan en puntos.
- Distribución de desenlaces según la tabla anterior, en volumen y en PPP de cada uno.
- Origen del rebote ofensivo según el tipo de tiro fallado: triple, media distancia, tiro cercano o tiro libre. Un equipo que rebotea bien tras triple fallado juega distinto a uno que solo rebotea bajo el aro.
- Zona del rebote: dentro o fuera de la zona restringida.
- Cadena de rebotes: posesiones con dos o más rebotes ofensivos consecutivos y su PPP.
- Por jugador: quién captura y quién finaliza. Son dos roles distintos y hoy se confunden en un solo número.
- Coste del rebote ofensivo: transiciones concedidas al rival en las posesiones donde el equipo mandó jugadores al rebote y no lo capturó.

#### Métricas defensivas

- OR% concedido, y PPP concedido en las segundas oportunidades del rival.
- Segundos que el rival tarda en tirar tras capturar rebote ofensivo.
- Rebote defensivo asegurado tras tiro propio: porcentaje de rebotes largos frente a rebotes en la zona.

**Criterio de aceptación:** puntos de segunda oportunidad calculados por esta vía coinciden con los puntos de segunda oportunidad del box score oficial del partido.

### A-05 · Tramo de reloj de posesión [P1]

Segmentación por el momento de la posesión en que se produce el tiro.

| Tramo | Reloj de posesión | Lectura habitual |
|---|---|---|
| Temprano | 0 a 8 segundos | Transición, ataque rápido, ventaja no defendida |
| Medio | 9 a 16 segundos | Sistema en curso, primera y segunda opción |
| Tardío | 17 a 24 segundos | Ataque forzado, juego individual, riesgo de violación |

#### Definición del reloj

- El tramo se mide sobre el reloj de posesión, no sobre el reloj de partido: segundo 0 es el inicio de la posesión.
- Punto crítico: tras rebote ofensivo o tras determinadas faltas el reloj se reinicia a 14 segundos, no a 24. En esos casos los tramos son 0-8, 9-14 y no existe tramo tardío completo. Debe marcarse explícitamente en la interfaz y no mezclarse con las posesiones de 24 segundos al calcular promedios.
- Si FIBA LiveStats no publica el shot clock de forma fiable, se deriva restando el reloj de partido en el momento del tiro al reloj de partido al inicio de la posesión. Documentar cuál de las dos fuentes se usa.
- Las posesiones incompletas o con reloj no derivable quedan como NULL, nunca como tramo temprano.

#### Qué se muestra por tramo

- Volumen de tiros y porcentaje sobre el total.
- eFG%, TS%, PPT y PPP del tramo.
- Reparto T2 / T3 / TL dentro del tramo.
- Tasa de pérdidas y de violaciones de 24 segundos.
- Versión defensiva: en qué tramo obliga a tirar al rival y con qué eficacia. Una defensa que empuja al rival al tramo tardío está haciendo bien su trabajo aunque el marcador no lo refleje todavía.
- Por jugador: en qué tramo tira cada uno y con qué eficiencia. Identifica al que salva posesiones al final del reloj y al que precipita el ataque.
- Mapa de tiro filtrable por tramo, reutilizando el componente existente.

Panel de decisión por tramo

El objetivo del apartado no es describir, es permitir decidir. Además de las métricas por tramo, la app debe responder de forma directa a estas preguntas:

| Pregunta | Cómo se responde |
|---|---|
| ¿Dónde perdemos balones? | TO% por tramo y reparto de las pérdidas totales entre los tres tramos, con el tipo de pérdida (pase, manejo, pasos, 24 segundos) |
| ¿Dónde somos más eficientes? | PPP y eFG% por tramo, con el diferencial contra el promedio de la competencia en ese mismo tramo |
| ¿Desde dónde tiramos según el reloj? | Matriz zona de tiro × tramo: volumen, FG%, eFG% y PPT de cada celda |
| ¿Cómo cambia la selección de tiro? | Reparto T2 / T3 / TL por tramo y peso de la pintura frente al perímetro |
| ¿Quién decide en cada tramo? | USO% por jugador dentro de cada tramo y eficiencia de cada uno |
| ¿Cuánto nos cuesta llegar al tramo tardío? | PPP del tramo tardío frente al del temprano y porcentaje de posesiones que llegan allí |
| ¿A qué tramo empujamos al rival? | Las mismas métricas en versión defensiva |

- La matriz zona × tramo reutiliza el mapa de tiro con el tooltip completo de C-03, y es exportable (T-06).
- Todo el panel se replica a nivel de jugador y de quinteto, no solo de equipo.

**Criterio de aceptación:** la suma de tiros de los tres tramos iguala el total de tiros de campo del equipo, y las posesiones con reloj de 14 aparecen identificadas por separado.

### 5.3 Cruce de contextos

### A-06 · Motor de contextos cruzados [P2]

Las dimensiones anteriores valen poco por separado y mucho combinadas. En lugar de programar una pantalla por cada cruce, construir un único componente que reciba dos dimensiones y devuelva la tabla.

- Dimensiones disponibles: cuarto · clutch · tramo de reloj · origen de posesión · tipo (transición / early / media cancha) · oportunidad (primera / segunda) · quinteto · jugador en cancha · local o visitante · rival.
- Métricas seleccionables: PPP · eFG% · TS% · PPT · TO% · OR% · FT Rate · volumen de posesiones.
- Salida en matriz con escala de color por percentil y el badge de muestra de T-02 en cada celda.
- Toda celda por debajo del umbral mínimo de posesiones se muestra en gris y no participa del coloreado.

#### Cruces que conviene dejar preconfigurados

- Tramo de reloj × origen de posesión: revela si el equipo aprovecha las posesiones que empiezan con ventaja.
- Tramo de reloj × cuarto: detecta si el ataque se precipita o se atasca al final del partido.
- Tipo de ataque × quinteto: qué combinación corre y cuál juega en estático.
- Segunda oportunidad × jugador: quién genera realmente los puntos extra.
- Transición concedida × quinteto: qué quinteto no equilibra atrás.
- Tramo de reloj × clutch: cómo cambia la selección de tiro en los últimos cinco minutos de partido igualado.

**Criterio de aceptación:** cualquier combinación de dos dimensiones devuelve totales que, sumados, coinciden con el total general de la métrica.

### 5.4 Resto del bloque analítico

### A-07 · Producción desde eventos [P1]

No mostrar solamente la cantidad de cada evento, sino su consecuencia. Aplica a equipo y a jugador.

#### Asistencias

- Puntos generados por asistencias · asistencias que terminan en doble · en triple · en 2+1 · promedio de puntos generados por asistencia · jugador al que más asiste

#### Rebotes ofensivos

- Resultado de cada rebote ofensivo: putback · doble · triple · falta recibida · pérdida · finalización sin puntos
- Puntos generados tras rebote ofensivo · conversión de segundas oportunidades · puntos por rebote ofensivo

#### Rebotes defensivos

- Cuántos inician contraataque · cuántos terminan en anotación · puntos generados después · primer pase de salida

#### Robos

- Resultado de cada robo: doble · triple · falta recibida · pérdida posterior · sin conversión
- Puntos generados tras cada robo · eficiencia de las posesiones iniciadas con recuperación

#### Pérdidas

- Puntos recibidos tras cada pérdida · dobles recibidos · triples recibidos · faltas recibidas por el rival
- Costo promedio por pérdida · porcentaje de pérdidas castigadas por el rival

### A-08 · Sinergias entre jugadores [P2]

- Matriz de quién asiste a quién dentro del plantel.
- Quién genera más triples para otro jugador.
- Quién convierte más puntos tras asistencia de un compañero.
- Parejas con mejor Net Rating, mejor OER y mayor eficiencia ofensiva (siempre con el ajuste de T-02).
- Jugadores que más potencian el rendimiento de otros: diferencial de rendimiento del compañero con y sin ese jugador en cancha.

**Criterio de aceptación:** La matriz de asistencias cuadra con el total de asistencias del equipo en la temporada.

### A-09 · Jugadores similares [P2]

- Con la base actual de jugadores, devolver los 10 jugadores de perfil más parecido a uno dado.
- Vector de perfil: USO% · distribución de tiro por zona · OR% · DR% · AS% · TO% · PPT · FT Rate · minutos por partido.
- Normalizar cada dimensión por z-score dentro de la competencia y calcular distancia euclidiana o coseno.
- Filtros por competencia, posición y mínimo de minutos.
- Se integra como acción dentro del perfil de jugador y del buscador.

**Criterio de aceptación:** Para un jugador de referencia conocido, los resultados son reconocibles como perfiles equivalentes por alguien del ambiente.

### A-10 · Insights automáticos en texto [P2]

- Generar entre 3 y 5 frases por equipo y por jugador, a partir de reglas sobre los percentiles de T-01.
- Se dispara cuando el percentil es menor o igual a 10 o mayor o igual a 90.
- Plantillas de texto fijas rellenadas con los valores; no se usa generación por IA.
- Ejemplo de plantilla: "{equipo} está en el percentil {p} de {métrica} de la competencia ({valor} frente a {media} de promedio)".

**Criterio de aceptación:** Ningún insight contradice los números mostrados en la misma pantalla.

### A-11 · Impacto ajustado (RAPM) [P2]

- El ON/OFF actual está contaminado por con quién comparte cancha cada jugador.
- Implementar una regresión ridge sobre stints de posesiones para obtener impacto ofensivo, defensivo y total ajustado por jugador.
- Lambda determinada por validación cruzada.
- Requiere al menos una temporada completa de play-by-play; con la base actual de partidos importados es viable.
- Mostrar siempre junto al número de posesiones del jugador.

**Criterio de aceptación:** El ranking resultante no está dominado por jugadores con pocas posesiones.

### A-12 · Métricas de jugador pendientes [P1]

- % de asistencias sobre el total del equipo, y ratio de asistencias sobre las posesiones propias del jugador (dos indicadores distintos, ambos visibles).
- Puntos por asistencia: cuánto asiste y cuántos puntos se convierten a partir de ello.
- Segundos promedio de posesión.

**Criterio de aceptación:** Los tres indicadores aparecen en el perfil de jugador con su percentil correspondiente.

## 6. Glosario de métricas

Definiciones únicas para toda la aplicación. Cualquier discrepancia entre pantallas se resuelve contra esta tabla.

| Métrica | Definición / fórmula |
|---|---|
| Posesión | T2i + T3i − RO + PER + 0,44 × TLi |
| OER | Puntos anotados / posesiones propias |
| DER | Puntos recibidos / posesiones del rival |
| Net Rating | OER − DER |
| eFG% | (T2c + T3c + 0,5 × T3c) / (T2i + T3i) |
| TS% | Puntos / (2 × (T2i + T3i + 0,44 × TLi)) |
| PPT | Puntos anotados desde tiros de campo / tiros de campo intentados |
| PPP | Puntos anotados / posesiones |
| USO% | Posesiones terminadas por el jugador / posesiones del equipo con el jugador en cancha |
| OR% | Rebotes ofensivos propios / (rebotes ofensivos propios + rebotes defensivos del rival) |
| DR% | Rebotes defensivos propios / (rebotes defensivos propios + rebotes ofensivos del rival) |
| TO% | Pérdidas / posesiones |
| FT Rate | Tiros libres intentados / tiros de campo intentados |
| PACE | Posesiones por 40 minutos |
| PtsEnPint | Puntos anotados dentro de la zona (antes etiquetado PEP) |
| Percentil | Posición relativa 0-100 de un valor dentro de la competencia y temporada seleccionadas |
| Valor ajustado | (posesiones × valor + K × media de liga) / (posesiones + K); K según entidad, ver T-02 |
| Ficha de métrica | Valor + ranking + distancia al líder + distancia al promedio + percentil (T-01) |
| Reloj de posesión | Segundos transcurridos desde el inicio de la posesión. Tramos: 0-8, 9-16, 17-24 |
| Reset de 14 | Reinicio del reloj a 14 segundos tras rebote ofensivo o falta; sus posesiones se analizan aparte |
| Transición | Posesión que termina en tiro o falta recibida dentro de los primeros 7 segundos |
| Early offense | Posesión que termina entre los segundos 8 y 12 |
| Media cancha | Posesión que termina a partir del segundo 13 |
| Origen de posesión | Evento que da inicio a la posesión (ver A-02) |
| Segunda oportunidad | Continuación de la posesión tras rebote ofensivo propio |
| Putback | Tiro dentro de los 3 segundos posteriores al rebote ofensivo, sin pase intermedio |
| Puntos por rebote ofensivo | Puntos generados en la cadena de segunda oportunidad / rebotes ofensivos capturados |

Este documento reemplaza al listado de correcciones del 23/07/26. Cualquier requisito que no figure aquí queda fuera de alcance hasta que se agregue con su ID correspondiente.
