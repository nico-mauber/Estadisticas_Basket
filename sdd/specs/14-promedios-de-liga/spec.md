# Spec — Feature 14: promedios de liga

> **Requisito C-02** (`Smart-Basket Especificacion v2.docx` §1, P0). Corte y orden:
> `sdd/ROADMAP-bloque-C.md` §2 y §4. Decisión de alcance cerrada en ROADMAP §5.

## 1. Objetivo
Que el promedio de liga contra el que se compara cualquier métrica sea el de la competencia y
temporada seleccionadas, idéntico se lo consulte desde donde se lo consulte.

## 2. Fuentes (trazabilidad)

**Requisito del cliente (C-02):**
- *"Afecta a: perfil de equipo, evolución por partido, perfil de jugador y evolución por partido de jugador."*
- *"El promedio de liga debe calcularse siempre sobre todos los partidos de la competencia y temporada seleccionadas, no sobre el subconjunto filtrado en pantalla."*
- *"Excluir del promedio los registros nulos. Nunca reemplazar un nulo por cero."*
- *"Revisar además la columna de variación porcentual: hoy arroja valores imposibles (ejemplos vistos: '↑ 1050.0%', '↑ 9900.0%'). Ese indicador se reemplaza por percentiles según T-01."*
- CA del cliente: *"El mismo equipo consultado desde dos pantallas distintas muestra idéntico promedio de liga."*

**Decisión de alcance (ROADMAP §5, tomada por el cliente el 2026-08-10):** el indicador de variación
**se elimina**, no se arregla. Su reemplazo es T-01 (percentiles), fuera del Bloque C.

**Specs previas:**
- `sdd/specs/12-nulos-orden-color-dnp/spec.md` §8 — el fallback `{avg:0, best:0}` de
  `league_averages()` quedó explícitamente fuera de la Feature 12 y ruteado acá.
- `sdd/specs/12-.../progress.md` §Auditoría — registrado como origen del `Ø 0.0%` que reporta C-01.
- `sdd/specs/08-nulos-vs-cero/progress.md` §Desviaciones — `league_averages()` se dejó sin tocar allí.

**Docs:**
- `docs/api.md` — `GET /api/team/<code>`, `GET /api/player/<team>/<name>`, `GET /api/league`;
  nota "Nulo vs cero" (una tasa sin dato es `null`, y los promedios excluyen nulos).
- `docs/frontend.md` — vistas Equipo, Jugador y Liga; filtro por competencia.

**Código (estado verificado sobre el repo):**
- `backend/stats_engine.py` `league_averages()` (329) — recibe una lista de stats ya calculadas y
  devuelve `{avg, best}` por métrica. **Excluye `None` correctamente** (351), pero cuando una métrica
  no tiene ningún valor válido devuelve `{"avg": 0, "best": 0}` (353) — un `0` que la UI muestra como
  `Ø 0.0%`. Es el bug que C-01 reporta como "OR% y DR% vacíos con Ø 0.0%".
- `backend/app.py` `team_stats` (444-452) — construye la población de liga con **`TeamGameStats.query.all()`**:
  todas las competencias mezcladas, sin filtrar por la seleccionada.
- `backend/app.py` `player_stats` — mismo patrón con `PlayerGameStats.query.all()`.
- `backend/app.py` `league_overview` (982-983) — **sí** filtra por competencia (`?comp=`). De ahí la
  discrepancia entre pantallas que denuncia el CA del cliente.
- `backend/app.py` `league_overview._avg` (1002-1004) — `vals = [a[key] for a in adv_list if key in a]`:
  **no excluye `None`**. Con una métrica nula levanta `TypeError` al sumar; y devuelve `0` (no `None`)
  cuando no hay datos. Bug latente además de violación de la regla de nulos.
- `frontend/js/app.js` `statBox` (29-34) — bloque `Ø {avg} ↑ {best}`. El `↑` es el **máximo** de la
  población, sin mínimo de muestra: un jugador con 1 posesión aporta un OER de 10, y el sentinel
  `ast_to = 99.0` de la Feature 08 se renderiza como `↑ 9900.0%`. Son los "valores imposibles" del reporte.
- `frontend/js/app.js` `_renderTeamContent` (731-736) — al filtrar por competencia recalcula los
  promedios del equipo desde el game log, pero `lg = data.league` queda con el valor global.

## 3. Historias de usuario
- **US-1**: Como analista, quiero comparar a mi equipo contra el promedio de **su** competencia, para
  que el contexto sea real y no una mezcla de torneos distintos.
- **US-2**: Como analista, quiero que el promedio de liga no cambie al filtrar la pantalla por últimos
  N partidos, para que el punto de comparación sea estable mientras exploro.
- **US-3**: Como entrenador, quiero que una métrica sin datos en la liga se muestre como "—" y no como
  `Ø 0.0%`, para no creer que el promedio de la liga es cero.
- **US-4**: Como entrenador, quiero dejar de ver indicadores imposibles como `↑ 9900.0%`, porque me
  hacen desconfiar de todos los demás números de la pantalla.

## 4. Requisitos funcionales

- **RF-1**: El promedio de liga DEBE calcularse sobre **todos los partidos de la competencia
  seleccionada**, no sobre el conjunto de todas las competencias. · (US-1, C-02)

- **RF-2**: El promedio de liga NO DEBE recalcularse a partir del subconjunto filtrado en pantalla
  (últimos N partidos, local/visitante o cualquier otro filtro de vista). Cambiar un filtro que no sea
  el de competencia deja el promedio de liga intacto. · (US-2, C-02)

- **RF-3**: El promedio de liga DEBE excluir los valores nulos, y valer `null` —no `0`— cuando ninguna
  métrica de la población tiene dato. · (US-3, C-02 "Nunca reemplazar un nulo por cero",
  `08-nulos-vs-cero` RF-3)

- **RF-4**: El cálculo de las medias de la tabla de Liga DEBE excluir los nulos igual que el resto de
  la app, y devolver `null` cuando no queda ningún valor válido. · (US-3, C-02) · Hoy no los excluye:
  además de violar la regla, puede levantar `TypeError`.

- **RF-5**: El indicador de variación (`↑ x`, el máximo de la población) DEBE eliminarse de la
  interfaz. · (US-4, C-02 + decisión de ROADMAP §5) · No se corrige su cálculo: se retira. El valor
  absoluto de la métrica y el promedio de liga (`Ø`) siguen visibles.

- **RF-6**: El promedio de liga de una misma métrica, misma competencia y misma temporada DEBE ser
  idéntico en todas las pantallas que lo muestren. · (US-1, C-02 criterio de aceptación) · Se compara
  lo comparable: el promedio de liga de métricas de equipo se calcula sobre la población de equipos, y
  el de métricas de jugador sobre la población de jugadores; lo que debe coincidir es el mismo tipo de
  métrica entre pantallas.

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Cambio | Nuevo? |
|---|---|---|---|
| (ninguna tabla) | — | Sin cambio de esquema. Métricas on-the-fly (Constitución 4): aplica retroactivamente sin migración | No |
| `GET /api/team/<team_code>` | existente | **Campo nuevo `leagues`**: mapa `{"<competencia>": {…}}` con el promedio de liga de cada competencia en que el equipo jugó, más la clave `""` para el agregado de todas. `league` se conserva (= `leagues[""]`) para no romper consumidores | Campo nuevo — a `docs/api.md` al cerrar |
| `GET /api/player/<team>/<name>` | existente | Ídem, sobre la población de jugadores | Campo nuevo |
| `GET /api/league` | existente | `_avg` excluye nulos y devuelve `null` sin datos. El filtro `?comp=` ya existía | No |

> Los valores de `avg` pueden pasar de `0` a `null`. El campo `best` deja de consumirse en la UI
> (RF-5); se mantiene en la respuesta para no romper el contrato de golpe — ver §8.

## 6. Estados de UI

No agrega vista. Cambia el bloque de contexto de cada métrica.

| Vista / Componente | loading | vacío | error | sin conexión (SW) | éxito |
|---|---|---|---|---|---|
| Card de stat (Equipo/Jugador) | sin cambio | sin cambio | sin cambio | sin cambio | muestra `Ø {promedio}` de la competencia activa. **Ya no muestra `↑ x`**. Si el promedio es nulo, `Ø —` |
| Filtro de competencia (Equipo/Jugador) | sin cambio | sin cambio | sin cambio | sin cambio | al cambiarlo, el `Ø` de cada card pasa al de esa competencia |
| Filtro de últimos N | sin cambio | sin cambio | sin cambio | sin cambio | recalcula los valores del equipo; **no** toca el `Ø` de liga |
| Tabla de Liga | sin cambio | sin cambio | sin cambio | sin cambio | una media sin datos muestra `"—"`, no `0` |

**Copy**: sin copy nuevo. `Ø` y `"—"` son los existentes. Se **retira** el `↑` de `statBox`.

## 7. Criterios de aceptación

- **CA-1**: Given una competencia seleccionada, When se lee el `Ø` de una métrica en el perfil de un
  equipo, Then ese valor es la media de esa métrica **sobre todos los partidos-equipo** de esa
  competencia — es decir, ponderada por partidos jugados. Un equipo con 2 partidos aporta el doble que
  uno con 1. · *(Corregido en el Paso 4 — ver §9, última entrada)*
- **CA-2**: Given el perfil de un equipo, When se cambia el filtro de competencia, Then el `Ø` de cada
  card cambia al promedio de esa competencia.
- **CA-3**: Given el perfil de un equipo, When se aplica el filtro de últimos 3 o 5 partidos, Then los
  valores del equipo cambian y el `Ø` de liga **no**.
- **CA-4**: Given una métrica sin ningún dato válido en toda la población de la competencia, When se
  consulta, Then su promedio de liga es `null` y se muestra `Ø —`, nunca `Ø 0.0%`.
- **CA-5**: Given cualquier card de stat de Equipo o Jugador, When se observa, Then **no** aparece
  ningún indicador `↑`.
- **CA-6**: Given el recorrido completo de la app, When se buscan valores imposibles del tipo
  `1050.0%` o `9900.0%`, Then no aparece ninguno.
- **CA-7**: Given la tabla de Liga con una métrica nula en algún equipo, When se calcula la media,
  Then no se produce ningún error y el nulo queda excluido del promedio.
- **CA-8**: Given el recorrido de Equipo, Jugador y Liga, When se observa la consola, Then no hay
  errores JS nuevos.

## 8. Fuera de alcance

- **Percentiles y escala de color continua (T-01).** Son el reemplazo del indicador que esta feature
  retira, pero pertenecen al Bloque T. Consecuencia aceptada y registrada: entre esta feature y T-01,
  las cards quedan con `Ø` pero sin indicador de dispersión.
- **Umbral mínimo de muestra para entrar en la población de liga** (T-01 lo fija en 5 partidos por
  equipo y 100 minutos por jugador). Sin él, la media sigue incluyendo muestras chicas. Esta feature
  corrige el **alcance** de la población (competencia), no su **calidad**.
- **La "temporada" como dimensión propia.** Hoy no existe columna de temporada: la competencia ya la
  incorpora en su nombre (`"Liga Uruguaya de Basquetbol 2025/2026"`). Separarlas requiere cambio de
  esquema. Ver §9.
- **Los sentinels `ast_to` / `def_to_ratio` = 99.0.** Alimentaban el `↑ 9900.0%`, pero al retirarse el
  indicador dejan de ser visibles. Siguen como deuda de Feature 08.
- **Eliminar `best` de la respuesta del API.** Se deja de consumir en la UI; retirarlo del JSON es
  limpieza para cuando T-01 cierre el tema.

## 9. Ambigüedades

- **[RESUELTA] ¿Se arregla o se elimina el indicador de variación?** → **Decisión del cliente
  (2026-08-10): eliminar.** *Justificación*: el propio documento lo declara reemplazado por T-01;
  corregir un cálculo marcado para reemplazo es trabajo descartable. Registrado en ROADMAP §5.

- **[RESUELTA] ¿Qué es "temporada" si no hay columna?** → **Decisión: la competencia ya la contiene.**
  *Justificación*: los valores reales de `games.competition` incluyen el año
  (`"Liga Uruguaya de Basquetbol 2025/2026"`), así que filtrar por competencia filtra por temporada.
  Separarlas exigiría columna nueva y re-parseo del histórico, fuera del alcance de una corrección.

- **[RESUELTA] ¿Mapa de promedios por competencia, o refetch al cambiar el filtro?** → **Decisión:
  mapa `leagues` en la respuesta.** *Justificación*: el filtro de competencia hoy es instantáneo y
  client-side; un refetch introduciría latencia y un estado de carga donde no había. El número de
  competencias por equipo es de un dígito, así que el peso extra de la respuesta es despreciable.

- **[RESUELTA — detectada en el Paso 4] ¿El promedio de liga es la media sobre partidos o la media de
  los promedios por equipo?** Son estadísticos distintos cuando los equipos tienen distinta cantidad
  de partidos. Con los datos reales: OER da **1.0171** ponderando por partidos y **0.9908** promediando
  los promedios por equipo (CNF y HYM tienen 2 partidos; los otros cuatro, 1).
  → **Decisión: media sobre todos los partidos-equipo (ponderada).** *Justificación*: es el texto
  literal de C-02, *"sobre todos los partidos de la competencia y temporada seleccionadas"*, y es el
  comportamiento que ya tenía `league_averages()`. Un partido es una observación; ponderar por equipo
  daría el mismo peso a quien jugó 1 que a quien jugó 12.
  *Impacto en el spec*: **CA-1 estaba mal formulado** — pedía que el `Ø` coincidiera con la media de
  la columna de la tabla de Liga, que es la media de medias. Reescrito arriba para verificar el
  estadístico correcto. El código no cambió; el criterio sí.

- **[RESUELTA] ¿"Idéntico promedio desde dos pantallas" incluye equipo vs jugador?** → **Decisión: no.**
  *Justificación*: el promedio de liga de una métrica de equipo se calcula sobre equipos y el de una
  métrica de jugador sobre jugadores; son poblaciones distintas por definición y deben serlo. Lo que
  el CA exige es que **la misma métrica del mismo tipo** coincida entre pantallas — verificable en
  CA-1 contra la tabla de Liga.
