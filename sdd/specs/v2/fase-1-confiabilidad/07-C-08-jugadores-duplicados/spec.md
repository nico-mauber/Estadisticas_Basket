# Spec — C-08: Jugadores duplicados en el buscador

> **ID:** C-08 · **Prioridad:** P0 · **Fase y orden:** 1·07
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/](../01-C-11-tratamiento-de-nulos/spec.md), incluye el Grupo 0 = integración de `dev`) · F-11 ([../02-F-11-calidad-datos-competencias/](../02-F-11-calidad-datos-competencias/spec.md))
> **Habilita:** T-01, F-16, F-05, T-03, F-10, A-09, A-11, F-12 (y C-03 para el mapa de tiro por `player_id`)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §2 · C-08 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.0, §1.5 (D-05, D-23), §3.4, §4, §5, §6, §9.2 (I-15) ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §2 C-08):**
- *"Si en el mismo equipo y la misma competencia aparecen dos jugadores con idéntico nombre, deben unificarse en un solo registro."*
- *"Causa habitual: en algunos partidos no se carga la posición desde FIBA LiveStats."*
- *"Clave de deduplicación: nombre normalizado + equipo + competencia. Al unificar, conservar la posición no vacía y sumar los partidos de ambos registros."*
- *"Normalizar el nombre antes de comparar: minúsculas, sin tildes, sin espacios dobles."*
- **Criterio de aceptación:** *"El total de jugadores de la base baja al eliminar duplicados y ningún equipo muestra dos fichas con el mismo nombre."*
- En la §1.3 el requisito aparece en S1 "Calidad de datos" (*"jugadores duplicados"*, con F-11) y en S7 "Buscador de jugadores" (*"sin duplicados"*).

**Por qué importa:** un jugador partido en dos fichas tiene promedios calculados sobre la mitad de sus partidos, desaparece del filtro por posición de forma intermitente y rompe todo lo que en v2 se apoya en "un jugador" (percentiles T-01, ON/OFF, comparación F-05, jugadores seguidos F-12, consultas guardadas F-10, similares A-09, RAPM A-11).

**Cómo se identifica hoy un jugador (verificado en código):**
- No existe entidad jugador. La identidad es el **string** `player_name` repetido en tres tablas: `player_game_stats` (con `UNIQUE(game_id, team_code, player_name)`, `backend/database.py` l.86), `shots.player_name` y `pbp_events.player_name`.
- `player_name` lo arma `backend/fiba_fetcher.py:_parse_fiba_json` (l.336–341) como `p["name"]` o `firstName + familyName` o `scoreboardName`; los tiros y eventos del pbp toman el nombre del mapa `(tno, dorsal) → nombre` del mismo partido (l.370–372, 392, 436), así que **dentro de un partido** los tres coinciden, pero **entre partidos** la grafía puede variar.
- `position` = `playingPosition` de FIBA por partido (l.348), default `''`. La arquitectura verificó (D-23) que en los 13 partidos del seed 20 de 125 fichas con más de un partido cambian de posición (G/PG, F/PF, C/PF) y 18 filas jugador-partido vienen sin posición: es un rol por partido, no un atributo.

**Qué ya resolvió `dev` (Feature 13 `sdd/specs/13-dedup-jugadores`, commit `0cc4de6`, que entra en v2 por el Grupo 0 de C-11 — DA-01):**
- `backend/stats_engine.py:norm_name` (l.10 en `dev`): minúsculas, sin diacríticos (NFD sin marcas `Mn`), espacios colapsados, recortado.
- `backend/stats_engine.py:resolve_identity` (l.24 en `dev`): nombre mostrado = grafía de la ficha más reciente; posición = la no vacía más frecuente, desempate por la más reciente.
- Unificación **al leer** en tres rutas de `backend/app.py` (`dev`): `team_players` (l.525), `player_stats` (l.572) y `search_players` (l.809) agrupan por `(team_code, norm_name(player_name))`.
- Decisión D-1 de `dev`: la competencia **no** entra en la clave (agregarla partiría a un jugador en dos fichas).
- Verificación de `dev`: la base no tenía duplicados por grafía (74 = 74 fichas); los CA de fusión se probaron sobre una copia con un duplicado inyectado.

**Qué queda pendiente (verificado en `dev`):**
1. **Rutas que siguen usando el nombre exacto** y parten al jugador si la grafía varía: `player_shots` (`dev` l.734: `Shot.query.filter_by(team_code, player_name)`), `onoff_route` (`dev` l.991: existencia y USO% por `player_name` exacto; `backend/lineups.py:onoff_stats` l.243 compara `player_name in s["on_court"]`), `lineup_route` (`dev` l.973: nombres crudos contra los tramos del pbp).
2. **Sin id estable**: no hay forma de referir a un jugador en URLs, filtros `on`/`off` (T-03), jugadores seguidos (F-12) ni consultas guardadas (F-10). La arquitectura (§3.4) decide una tabla `players` persistente con `player_game_stats.player_id` (descartó "solo unificación al leer").
3. **Sin fusión manual** para los casos que la normalización tipográfica no cubre (p. ej. "J. Feldeine" vs "Jerome Feldeine").
4. **Panel de duplicados**: F-11 lo construye con `norm_name` de `dev` (I-15); C-08 lo migra a la identidad persistente.
5. **Posición por grupo**: la arquitectura fija grupos G/F/C para los filtros (DA-11); el buscador de `dev` filtra por el valor FIBA crudo (G, PG, F, PF… como opciones separadas).
6. `docs/api.md` (l.160–167) documenta `GET /api/players/<team>` como lista de strings; el código devuelve objetos (D-05).

## 1. Objetivo
Que cada jugador tenga **una sola ficha por equipo**, con un identificador estable, sin importar variaciones de grafía o de posición entre partidos, y que toda la app (buscador, plantel, perfil, mapa de tiro, ON/OFF, combinaciones y panel de calidad) lo resuelva igual.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 C-08 (texto completo y CA), §1.3 S1 (Calidad de datos) y S7 (Buscador de jugadores).
- Arquitectura §3.4 (identidad de jugador: tabla `players`, `player_id`, funciones de `identity.py`, fusión, posición), §5 (esquema), §6 (endpoints de C-08), §3.21 (`admin_required`), §3.14 (`data_version`), §9.2 I-15 (panel de duplicados F-11 → C-08), §11 DA-10, DA-11, DA-18.
- `docs/database.md` — `player_game_stats` (restricción única `(game_id, team_code, player_name)`, `position` default `''`), `shots.player_name`, `pbp_events.player_name` (l.128).
- `docs/api.md` — `GET /api/players/<team_code>` (l.160), `GET /api/player/<team_code>/<player_name>` (l.171, 404), `GET /api/shots/<team_code>/<player_name>` (l.212), `GET /api/search/players` (l.275: "una entrada por `(team_code, player_name)`"; `position` = "última posición no vacía observada"), `GET /api/onoff/<team_code>/<player_name>` (l.377), `GET /api/lineup/<team_code>` (l.349).
- `docs/frontend.md` — vista Buscar (filtros equipo/competencia/posición), vista Equipo (select de jugador, combinaciones), vista Jugador.
- Specs de `dev`: `git show dev:sdd/specs/13-dedup-jugadores/{spec,plan,progress}.md`.

## 3. Historias de usuario
- **US-1**: Como analista, quiero que un jugador tenga una sola ficha por equipo, para que sus promedios se calculen sobre todos sus partidos.
- **US-2**: Como analista, quiero que la posición de un jugador sea estable entre consultas y que el filtro por posición agrupe variantes (G/PG), para no perder jugadores al filtrar.
- **US-3**: Como entrenador, quiero que el perfil, el mapa de tiro, el ON/OFF y las combinaciones de un jugador incluyan todos sus partidos aunque su nombre haya variado de grafía, para no ver datos parciales.
- **US-4**: Como administrador de datos, quiero ver los posibles duplicados que la normalización no detecta y fusionarlos a mano, para dejar la base limpia.
- **US-5**: Como usuario de funciones futuras (comparar, seguir jugadores, consultas guardadas), quiero que cada jugador tenga un identificador estable, para que los enlaces y filtros no se rompan si cambia la grafía.

## 4. Requisitos funcionales

- **RF-1**: El sistema DEBE resolver la identidad de un jugador por la clave **(equipo, nombre normalizado)**. Normalización (literal del cliente): minúsculas · sin tildes · sin espacios dobles (además: sin espacios al inicio ni al final; sin ningún diacrítico). · (US-1, Esp. v2 §C-08, Arquitectura §3.4) · Regla: la competencia **no** forma parte de la clave, es un filtro (ver §9, DA-10).
- **RF-2**: El sistema DEBE mantener una **ficha persistente por jugador y equipo** con un identificador entero estable, y DEBE asociar cada fila de estadísticas por partido a su ficha, tanto para los partidos ya importados (completado idempotente al arrancar) como para cada partido nuevo o reprocesado. · (US-1, US-5, Arquitectura §3.4, §5) · Regla: no se modifica ni se reescribe el nombre crudo de ninguna fila; la restricción única `(game_id, team_code, player_name)` queda intacta (Constitución 5).
- **RF-3**: Al unificar, el sistema DEBE **sumar los partidos** de todos los registros de la ficha y no alterar ninguna estadística (solo agrupa filas existentes); las reglas de nulos y DNP de C-11 se aplican después de agrupar. · (US-1, Esp. v2 §C-08 "sumar los partidos de ambos registros", `docs/api.md` §search `games` = partidos jugados)
- **RF-4**: La **posición** de la ficha DEBE ser el valor FIBA **no vacío más frecuente** entre sus partidos; a igual frecuencia, el del partido más reciente; vacía solo si ningún partido la trae. Es determinista entre consultas. · (US-2, Esp. v2 §C-08 "conservar la posición no vacía", DA-11)
- **RF-5**: Los filtros por posición DEBEN usar **grupos**: G = {G, PG, SG}, F = {F, SF, PF}, C = {C}; un jugador sin posición no entra en ningún grupo y aparece solo con el filtro "Posición (todas)". · (US-2, Arquitectura §3.4, DA-11)
- **RF-6**: El **nombre mostrado** DEBE ser una grafía real del jugador (la del partido más reciente), nunca la clave normalizada. · (US-1, `dev` Feature 13 RF-4)
- **RF-7**: El **buscador de jugadores** DEBE devolver una sola entrada por ficha, con su identificador, y DEBE aceptar el filtro de competencia; sin filtro lista todas las competencias (con la lista de competencias del jugador, como hoy). · (US-1, US-5, Esp. v2 §C-08, §1.3 S7, `docs/api.md` §GET /api/search/players, Arquitectura §6)
- **RF-8**: El **plantel de un equipo** DEBE devolver una entrada por ficha con su identificador, y DEBE aceptar el filtro de competencia. · (US-1, US-5, `docs/api.md` §GET /api/players, Arquitectura §6, D-05)
- **RF-9**: El sistema DEBE ofrecer el **perfil de jugador por identificador** con el mismo contenido que el perfil por nombre, más el identificador. · (US-5, Arquitectura §6 "`/api/player/<int:player_id>`")
- **RF-10**: Las consultas existentes **por nombre** (perfil, mapa de tiro, ON/OFF y combinaciones) DEBEN seguir funcionando con cualquier grafía del jugador y DEBEN incluir **todos** los partidos, tiros y eventos de la ficha, aunque el nombre haya variado entre partidos. · (US-3, `docs/api.md` §player, §shots, §onoff, §lineup; Arquitectura §3.4 "Las rutas legado por nombre siguen funcionando") · Regla: si el nombre no resuelve a ninguna ficha del equipo, se mantienen los 404 y mensajes actuales.
- **RF-11**: El sistema DEBE permitir a un administrador **fusionar manualmente** dos fichas **del mismo equipo** (una absorbe a la otra); tras la fusión, toda consulta por la ficha absorbida (id o nombre) resuelve a la ficha que la absorbió, y las estadísticas se suman según RF-3. · (US-4, Arquitectura §3.4, §3.21, DA-18) · Reglas: fichas de equipos distintos → rechazo; fusionar una ficha consigo misma → rechazo; fusión encadenada (A absorbió a B, luego C absorbe a A) → B también resuelve a C.
- **RF-12**: El panel de **calidad de datos** (F-11) DEBE listar, por competencia, los **posibles duplicados** que la normalización tipográfica no unifica (candidatos a fusión manual) y los **posibles jugadores distintos unificados por error** (misma clave normalizada con nombre completo o foto distintos), con acceso a la fusión manual. · (US-4, Esp. v2 §1.3 S1 "jugadores duplicados", Arquitectura §3.4, §9.2 I-15, R-11)
- **RF-13**: Toda fusión o creación de fichas DEBE invalidar los datos cacheados (los números de cualquier pantalla reflejan la fusión en la siguiente consulta). · (US-4, Arquitectura §3.14)
- **RF-14**: La UI DEBE usar el identificador de ficha para navegar al perfil desde el buscador y desde el plantel; el total de jugadores que muestra el buscador DEBE reflejar el total unificado. · (US-1, US-5, Esp. v2 §C-08 CA)

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `players` | tabla | `id` INTEGER PK, `team_code` TEXT NOT NULL, `norm_key` TEXT NOT NULL, `display_name` TEXT NOT NULL, `first_name` TEXT, `family_name` TEXT, `photo_url` TEXT, `merged_into` INTEGER FK `players.id` NULL, `created_at` TEXT; `UNIQUE(team_code, norm_key)` · vía `create_all` | **NUEVO** (Arquitectura §5) |
| `player_game_stats.player_id` | columna | INTEGER, default NULL · vía `upgrade_db()` + completado idempotente (solo filas con NULL) | **NUEVO** (Arquitectura §5) |
| `player_game_stats.first_name` · `.family_name` · `.photo_url` | columnas | TEXT NULL (las agrega F-11; C-08 las lee) | No (F-11) |
| `GET /api/players/<team_code>` | modificado | query `competition` (opcional) → `[{player_id, name, games, uso_pct, pts}]` | Cambio de contrato (+`player_id`, + filtro) |
| `GET /api/player/<int:player_id>` | endpoint | shape de `GET /api/player/<team>/<name>` + `player_id`; 404 `"Jugador no encontrado"` | **NUEVO** (Arquitectura §6) |
| `GET /api/player/<team_code>/<player_name>` | existente | resuelve el nombre a ficha; + `player_id` en la respuesta; 404 sin cambio | Campo nuevo |
| `GET /api/search/players` | modificado | query `competition` (opcional); cada entrada + `player_id` (+ `position_group`, ver §9) | Campos nuevos |
| `GET /api/shots/<team_code>/<player_name>` · `GET /api/onoff/<team_code>/<player_name>` · `GET /api/lineup/<team_code>` | existentes | resuelven el nombre a ficha y toman todas sus grafías; shape sin cambio (+`player_id` en on/off) | No (comportamiento) |
| `POST /api/identity/merge` | endpoint admin | body `{target_id, source_id}` → ficha resultante; 400/403/404/409 | **NUEVO** (Arquitectura §6) |
| `GET /api/data-quality` | existente (F-11) | check `possible_duplicates` con `items[]` de candidatos (C-08 define su contenido) | No (F-11 dueño; C-08 alimenta) |

## 6. Estados de UI

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Buscador | sin cambio | `"Ningún jugador cumple los filtros"` (copy existente) | sin cambio | sin cambio (datos a red) | una fila por ficha; `"N jugadores"` = total unificado; filtro Posición con opciones **G · F · C** (copy nuevo: `"Base/Escolta (G)"`, `"Alero/Ala-pívot (F)"`, `"Pívot (C)"`) |
| Plantel / select de jugador (Equipo) | sin cambio | `"— Seleccionar jugador —"` (existente) | sin cambio | sin cambio | una opción por ficha |
| Perfil de jugador | sin cambio | — | `"Jugador no encontrado"` (existente) | sin cambio | game log con todos los partidos de la ficha |
| Calidad de datos → "Posibles duplicados" (pestaña de F-11) | `"Buscando posibles duplicados…"` (nuevo) | `"No se detectaron posibles duplicados en esta competencia"` (nuevo) | `"No se pudo cargar el control de duplicados"` (nuevo) | `"Sin conexión: el panel de calidad necesita conexión"` (nuevo) | tabla de pares con motivo y botón `"Unificar"` (solo admin) |
| Modal de fusión | `"Unificando fichas…"` (nuevo) | — | 409 `"Solo se pueden unificar fichas del mismo equipo"` · 403 `"Necesitás permisos de administrador para unificar jugadores"` (nuevos) | `"Sin conexión: no se puede unificar ahora"` (nuevo) | toast `"Fichas unificadas: {nombre} ahora suma {n} partidos"` (nuevo) |

Todo copy nuevo va por `t()` y se agrega a `docs/frontend.md` al cerrar.

## 7. Criterios de aceptación

- **CA-1 (CA del cliente)**: Given una base con al menos un jugador partido en dos grafías del mismo equipo (p. ej. `"C. Zinaich"` y `"C.  ZINAICH"`), When se aplica la identidad de C-08, Then **el total de jugadores de la base baja** al eliminar duplicados (fichas activas < pares distintos `(equipo, nombre crudo)`) **y ningún equipo muestra dos fichas con el mismo nombre** (normalizado) en el buscador ni en el plantel.
- **CA-2**: Given ese jugador duplicado, When se consulta el buscador, Then aparece una sola fila con `games` = suma de los partidos jugados de ambas grafías y un único `player_id`.
- **CA-3**: Given un jugador con posición vacía en un partido y `"PF"` en otro, When se consulta su ficha, Then la posición es `"PF"`; y con posiciones `[G, "", PG, G]` es `"G"` en dos consultas seguidas.
- **CA-4**: Given el filtro de posición `F` en el buscador, When se aplica, Then aparecen los jugadores con posición F, SF o PF, y ninguno sin posición.
- **CA-5**: Given un jugador cuyo nombre varió de grafía entre partidos, When se consultan su perfil, su mapa de tiro, su ON/OFF y una combinación que lo incluye usando **cualquiera** de las grafías, Then los cuatro incluyen todos sus partidos, tiros y eventos (partidos del perfil = partidos de la ficha; tiros del mapa = Σ tiros de ambas grafías).
- **CA-6**: Given un `player_id` válido, When se consulta `GET /api/player/<player_id>`, Then la respuesta es idéntica a la del perfil por nombre más `player_id`; con un id inexistente → 404 `"Jugador no encontrado"`.
- **CA-7**: Given una base **sin** duplicados de grafía (los 13 partidos del seed), When se completa la asociación de fichas, Then la cantidad de fichas = cantidad de pares `(equipo, nombre normalizado)`, ninguna estadística del buscador cambia respecto de `dev` y ejecutar el completado dos veces no crea fichas nuevas (idempotente).
- **CA-8**: Given dos fichas del mismo equipo `"J. Feldeine"` (id A) y `"Jerome Feldeine"` (id B, inyectada), When un admin las fusiona (target A, source B), Then el buscador muestra una sola fila con la suma de partidos, `GET /api/player/B` devuelve la ficha A y el panel de calidad deja de listar el par.
- **CA-9**: Given dos fichas de **equipos distintos**, When se intenta fusionarlas, Then la respuesta es 409 `"Solo se pueden unificar fichas del mismo equipo"` y nada cambia; Given un usuario no admin (con `ADMIN_USERS` definida), Then 403.
- **CA-10**: Given una competencia con un par candidato (mismo equipo, nunca en el mismo partido, mismo dorsal o mismo apellido con inicial compatible), When se abre Calidad de datos, Then el par aparece en "Posibles duplicados" con el motivo; y un par con igual clave normalizada pero nombre completo distinto aparece como "posible fusión incorrecta".
- **CA-11**: Given un partido nuevo importado (o reprocesado) de un jugador existente con otra grafía, When termina la importación, Then sus filas quedan asociadas a la ficha existente (sin crear una nueva) y el total de fichas no sube.
- **CA-12**: Given el recorrido de Buscador, Equipo (plantel, mapa, ON/OFF, combinación) y Jugador, When se observa la consola, Then no hay errores JS; y en 390 px de ancho el filtro de posición y el modal de fusión se usan sin scroll horizontal.

## 8. Fuera de alcance
- **Vincular fichas de la misma persona en equipos distintos** (cambio de club): cada ficha es por equipo (Arquitectura §3.4).
- **Emparejamiento difuso automático** (apodos, abreviaturas): solo se **sugieren** candidatos; la fusión semántica es siempre manual.
- **Separar** una ficha fusionada por error (des-fusión) desde la UI: queda como PROPUESTA si aparece un caso real (R-11); la fusión es reversible por datos (ver plan §10).
- **Datos de ficha cargados a mano** (altura, nacimiento, nacionalidad): F-16.
- **Reescribir `player_name`** en las tablas o normalizar el nombre al importar (Constitución 5).
- **Migrar todas las pantallas a `player_id`** en rutas hash: X-01 (fase 2); acá solo buscador → perfil y plantel → perfil.
- **Filtros `on`/`off` por `player_id`**: T-03.

## 9. Ambigüedades
- **[DECISIÓN PROPUESTA — confirmar] ¿La competencia forma parte de la clave?** El cliente escribe "nombre normalizado + equipo + competencia". Se adopta **(equipo, nombre normalizado)** sin competencia (DA-10, default de la arquitectura y decisión D-1 de `dev`): con competencia en la clave, un jugador con partidos en dos competencias quedaría en **dos** fichas, lo que contradice el propio CA ("ningún equipo muestra dos fichas con el mismo nombre"). La competencia sigue disponible como **filtro** en buscador y plantel (RF-7, RF-8), que es lo que el texto del cliente busca: comparar dentro de una misma competencia.
- **[DECISIÓN PROPUESTA — confirmar] ¿Unificación en consulta, limpieza de datos o normalización al importar?** Se adopta **identidad persistente**: tabla de fichas + asociación por fila, completada al arrancar y al importar (Arquitectura §3.4). Descartadas: solo en consulta (estado de `dev`; no da id estable), reescribir nombres (destructivo) y normalizar al importar (no arregla lo ya cargado y tocaría la restricción única).
- **[DECISIÓN PROPUESTA — confirmar] Taxonomía de posiciones.** Se muestra el valor FIBA más frecuente y los filtros usan grupos G/F/C (DA-11). El grupo se expone en la respuesta del buscador como campo `position_group` (G/F/C/null), para que el filtro no dependa de una heurística del frontend.
- **[DECISIÓN PROPUESTA — confirmar] Competencia por defecto del buscador y del plantel.** Sin parámetro → **todas** las competencias (listados; DA-14 "'todas' solo para listados"), que es el comportamiento actual. El perfil por id delega en el mismo cálculo que el perfil por nombre (la semántica de competencia la fijan C-02/T-05).
- **[DECISIÓN PROPUESTA — confirmar] ¿Qué es un "posible duplicado" después de la unificación?** Tras RF-1 ya no pueden existir dos fichas con la misma clave; el panel lista candidatos a fusión manual con estas reglas (mismo equipo y competencia, **nunca en el mismo partido**): (a) mismo apellido normalizado y la inicial de una coincide con el nombre de la otra ("J. Feldeine" / "Jerome Feldeine"); (b) mismo dorsal y apellido que comparte al menos 4 caracteres iniciales. Además lista "posibles fusiones incorrectas": misma clave con `first_name`/`family_name` completos distintos o `photo_url` distinta (R-11).
- **[DECISIÓN PROPUESTA — confirmar] Verificación del CA del cliente.** La base de verificación (13 partidos del seed) no tiene duplicados por grafía (verificado en `dev`: 74 = 74). CA-1, CA-2, CA-5 y CA-8 se verifican sobre una **copia** de la base con duplicados inyectados; CA-7 cubre la base real (nada cambia si no hay duplicados). Se registra en `progress.md` para no leerlo como cobertura end-to-end.
