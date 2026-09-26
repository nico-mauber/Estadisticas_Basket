# Spec — F-11: Panel de calidad de datos

> **ID:** F-11 · **Prioridad:** P1 · **Fase y orden:** 1·02
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/spec.md](../01-C-11-tratamiento-de-nulos/spec.md)) — incluye la precondición P-00 (integración del Bloque C de `dev`)
> **Habilita:** C-09, C-08, C-02, T-05, C-03, T-01, F-13 (usa `admin_required`), F-16, A-12, A-01, T-03, F-14
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** [Especificación v2](../../00-especificacion-cliente-v2.md) §4 · F-11 (y §1.3 S1 · Datos) · Arquitectura [§1.1, §1.2, §1.5, §1.6, §3.1, §3.14, §3.21, §4, §5, §6, §9.2 I-01/I-14/I-15/I-18](../../00-arquitectura-transversal.md)

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §4 F-11):**
- "Dentro de la sección Datos: partidos importados sin play-by-play, posesiones que no cerraron correctamente, jugadores duplicados detectados, campos nulos por competencia."
- "Alta y edición de competencias y temporadas, que definen el universo de cálculo de los percentiles de T-01."
- "Acción de reprocesado de un partido o de una competencia completa tras un cambio de fórmula."
- Criterio de aceptación: "Antes de publicar una competencia se puede verificar en una sola pantalla que no hay partidos incompletos."

Por qué: la Fase 1 ("que los números sean confiables") necesita saber qué datos hay, en qué estado están y sobre qué universo se comparan. Sin una entidad competencia+temporada no hay universo estable para percentiles (T-01), promedios (C-02), tabla general (C-09) ni líderes (F-14); sin reprocesado, las correcciones de ingesta (coordenadas de tiro, prórrogas, columnas nuevas) no llegan a los partidos ya importados.

**Qué existe HOY (verificado en código, rama `main`; `dev` no cambia nada de esto salvo lo indicado):**
- No existe entidad competencia ni temporada: `games.competition` es un TEXT scrapeado de `bs.html` (`backend/fiba_fetcher.py:_fetch_page_info`, `span#competitionName`), p. ej. "Liga Uruguaya de Basquetbol 2025/2026". `GET /api/competitions` (`backend/app.py:competitions`, l.939) devuelve la lista de strings distintos. `GET /api/league` (`app.py:league_overview`, l.947) filtra por el string exacto. Equipo/Comparar/Jugador filtran el `game_log` en el cliente por string (`frontend/js/app.js:_logComps`, `_filterByComp`, `_compOptions`, l.74–80).
- Persistencia (`app.py:_persist_game`, l.203–379, lógica de negocio en `app.py`, contra la regla 3): upsert `on_conflict_do_update` en `games`, `team_game_stats`, `player_game_stats`, pero **`on_conflict_do_nothing` en `shots` y `pbp_events`** (reimportar no corrige tiros ni eventos). No guarda la URL de origen ni el JSON crudo; `games.minutes` (DEFAULT 40) **nunca se escribe**.
- Parser (`fiba_fetcher.py:_parse_fiba_json`, l.246): lee los tiros de `raw["shot"]` (nivel raíz), que **no existe** en los JSON de FIBA → cae siempre al pbp con `x = y = 0` (l.378–427). Las coordenadas reales están en `tm[n].shot[]` (arquitectura §1.6: 1.769/1.769 tiros). No lee `tot_sBlocksReceived`, `tot_sFoulsOn`, rebotes/pérdidas de equipo, `pN_score`, `tot_sMinutes`, `firstName`/`familyName`, `photoT`/`photoS`, `previousAction`, `qualifier[]`. Los helpers `ti()`/`pi()`/`_i()` devuelven 0 cuando falta la clave (indistinguible de "cero", anti-patrón C-11).
- Prórrogas: FIBA manda `periodType = "OVERTIME"`; `backend/lineups.py:PERIOD_LEN = {"REGULAR": 600, "OT": 300}` (l.12) → en `build_segments` una prórroga cuenta 600 s en vez de 300 (arquitectura §1.5 D-09). `docs/database.md` §`pbp_events` dice "REGULAR / OT".
- Esquema (`backend/database.py`): `Game`, `TeamGameStats`, `PlayerGameStats`, `Shot`, `PbpEvent`; `upgrade_db()` (l.167) aplica `ALTER TABLE ADD COLUMN` ignorando errores. No hay tabla de metadatos ni de versiones.
- Permisos (`backend/auth.py`): solo `login_required`; no hay roles. El borrado (`app.py:delete_games`, l.1004) exige solo login; el modal todavía pide un "token de administrador" en `localStorage` (`app.js:_showDeleteModal`, resabio; su limpieza es de C-11, D-19).
- UI de Importar (`app.js:renderImport`, l.316): card de importación por URL + card "Partidos importados (N)" con tabla paginada de 10 (`_gamesTable`), modo selección y borrado. No hay pestañas, ni filtro por competencia, ni estado de calidad.
- No hay caché: cada petición recalcula todo; `_opp_for` hace una consulta por fila (N+1).

**Qué resolvieron features anteriores:** 02-persistir-pbp (tabla `pbp_events`), 08-nulos-vs-cero (semántica null en tasas), 09-filtro-competencia (filtro por string, selects ocultos con ≤1 competencia), 13-dedup-jugadores en `dev` (`norm_name`, `resolve_identity`: unificación al leer por equipo + nombre normalizado).

**Qué queda (alcance de F-11):** entidad competencia+temporada con alias y estado de publicación; ingesta v2 (única, con archivo del JSON crudo y columnas nuevas nulas por defecto); reprocesado por partido y por competencia; panel de calidad en una sola pantalla; versión de datos para invalidar cachés; carga en bloque por competencia; permiso de administración opcional; corrección de `OVERTIME` en quintetos. La verificación de "posesiones que no cerraron correctamente" depende del motor de posesiones (A-01, fase 3) → incremento diferido.

## 1. Objetivo
Dar al usuario, en la sección Datos, un lugar único para administrar competencias y temporadas (el universo de cálculo), revisar la calidad de los partidos importados de una competencia antes de publicarla y reprocesar partidos o competencias completas con la ingesta vigente.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 F-11 (requisito y CA), §1.3 "S1 · Datos" (módulos Calidad de datos, Competencias y temporadas, Reprocesado), §2 C-11 (política de nulos), §2 C-08 (normalización de nombres), §3 T-01 "Población de referencia" (universo de percentiles).
- `docs/database.md` §Esquema (`games`, `team_game_stats`, `player_game_stats`, `shots`, `pbp_events`), §Inicialización y migración.
- `docs/api.md` §POST `/api/import`, §GET `/api/games`, §GET `/api/teams`, §GET `/api/competitions`, §GET `/api/league`, §DELETE `/api/games`, §Autenticación (`/api/me`).
- `docs/architecture.md` §`fiba_fetcher.py`, §`app.py`, §`lineups.py`, §Flujo de datos principal.
- `docs/frontend.md` §Vistas (Importar), §`api.js`, §Service Worker.
- `docs/deployment.md` §Variables de entorno (se agrega `ADMIN_USERS`), §Configuración (`render.yaml`, timeout 180 s).
- `docs/metrics.md` §Pace (usa minutos de partido: hoy siempre 40).
- Arquitectura: §3.1 (competencias), §3.14 (caché y `repository`), §3.21 (permisos), §4 (módulos `ingest`, `competitions`, `repository`, `cache`, `data_quality`, `auth`, `fiba_fetcher`, `lineups`), §5 (esquema), §6 (endpoints), §7.4 (códigos de nulo), §7.8 (errores), §9.2 I-01, I-14, I-15, I-18; DA-12, DA-13, DA-14, DA-18, DA-30, DA-32.
- `dev`: `sdd/specs/13-dedup-jugadores/spec.md` (`norm_name`), `sdd/specs/14-*` (mapa `leagues` por competencia string).

## 3. Historias de usuario
- US-1: Como analista, quiero ver en una sola pantalla el estado de calidad de una competencia (partidos sin play-by-play, sin coordenadas, pendientes de reprocesar, duplicados posibles, campos nulos, inconsistencias), para saber si puedo confiar en sus números antes de publicarla.
- US-2: Como analista, quiero dar de alta, renombrar, fijar la temporada, fusionar y publicar/ocultar competencias, para que los percentiles y promedios se calculen sobre el universo correcto.
- US-3: Como analista, quiero reasignar un partido a otra competencia, para corregir partidos que FIBA etiquetó mal.
- US-4: Como analista, quiero reprocesar un partido o una competencia completa, para que los partidos ya importados reciban las correcciones de la ingesta (coordenadas, prórrogas, datos nuevos) sin reimportarlos a mano uno por uno.
- US-5: Como administrador del despliegue, quiero poder restringir las acciones que modifican datos a ciertos usuarios, para que un usuario de solo lectura no altere el universo de cálculo.
- US-6: Como entrenador, quiero que los selectores de competencia de Liga, Equipo, Comparar y Jugador muestren competencia y temporada y oculten las competencias no publicadas, para no mezclar datos en preparación.

## 4. Requisitos funcionales

**A. Competencias y temporadas (universo de cálculo)**
- RF-1: El sistema DEBE modelar la competencia como entidad con nombre, temporada (opcional), estado ∈ {`publicada`, `borrador`, `archivada`} y marca "por defecto"; una competencia en una temporada es el universo de cálculo de percentiles, promedios, líderes y rankings. · (US-2, Esp. v2 §F-11, §1.3 S1, docs/database.md §`games`) · Reglas: (nombre, temporada) único; estado inicial `publicada` `[DECISIÓN HUMANA: DA-13]`.
- RF-2: El sistema DEBE asociar cada partido a una competencia sin modificar el texto de competencia scrapeado (se conserva como dato crudo), mediante un alias por cada texto distinto recibido de FIBA. · (US-2, docs/database.md §`games`; Constitución 5)
- RF-3: El sistema DEBE, al importar un partido, resolver su competencia por alias; si el alias no existe, crear la competencia separando nombre y temporada con la regla de sufijo de temporada (`(\d{4}(?:\s*[/-]\s*\d{2,4})?)\s*$` al final del texto; si no hay sufijo, temporada vacía) y crear el alias. · (US-2, Esp. v2 §F-11)
- RF-4: El sistema DEBE completar, de forma idempotente, la competencia de los partidos ya importados que no la tengan (solo los que están sin asignar). · (US-2; Constitución 5)
- RF-5: El sistema DEBE permitir dar de alta una competencia (nombre, temporada), editarla (nombre, temporada, estado, por defecto), fusionar dos competencias (todos los partidos y alias de la origen pasan a la destino; la origen deja de existir) y reasignar un partido a otra competencia. · (US-2, US-3, Esp. v2 §F-11) · Reglas: solo una competencia puede ser "por defecto"; fusionar consigo misma o crear un duplicado (nombre, temporada) → conflicto; la reasignación manual de un partido sobrevive a reimportaciones y reprocesos.
- RF-6: El sistema DEBE ocultar las competencias en `borrador` fuera de la sección Datos (selectores, listados y resolución automática de competencia) y mostrar las `archivada` en los selectores solo como opción explícita al final, nunca como competencia por defecto. · (US-6, Esp. v2 §F-11 "antes de publicar")
- RF-7: El sistema DEBE resolver la competencia de cada petición de datos en este orden: competencia pedida por id → "todas" (sin universo: solo listados; percentiles nulos con razón `sin_universo`) → texto legado (resuelto por alias) → la competencia publicada más reciente de la entidad consultada → la competencia por defecto de la configuración → la competencia publicada con el partido más reciente. · (US-6, Arquitectura §3.1 `[DECISIÓN HUMANA: DA-14]`)
- RF-8: El sistema DEBE listar las competencias con id, nombre, temporada, etiqueta ("<nombre> <temporada>"), estado, por defecto, cantidad de partidos, cantidad de equipos y fechas del primer y último partido. · (US-2, US-6, docs/api.md §GET `/api/competitions`)
- RF-9: El sistema DEBE migrar los cuatro selectores de competencia existentes (Liga, Equipo, Comparar, Jugador) a identificadores de competencia, con la etiqueta completa, conservando el comportamiento actual (ocultarse con ≤ 1 competencia visible; "Todas" como opción). · (US-6, docs/frontend.md §Vistas; Arquitectura §3.1)

**B. Ingesta v2 y archivo del dato crudo**
- RF-10: El sistema DEBE guardar, por cada partido importado, la URL de origen y una copia comprimida del JSON crudo de FIBA junto con la información de página (fecha y competencia scrapeadas) y la versión del parser. · (US-4, `[DECISIÓN HUMANA: DA-12]`)
- RF-11: El sistema DEBE capturar en la importación: coordenadas de cancha de cada tiro desde el arreglo de tiros de cada equipo; minutos del partido = 40 + 5 × prórrogas; puntos por período de cada equipo; tapones recibidos y faltas recibidas (equipo y jugador); rebotes ofensivos/defensivos y pérdidas de equipo; puntos en la pintura, de segunda oportunidad y de contraataque por jugador; nombre, apellido y foto del jugador; vínculo al evento previo y calificadores de cada evento del play-by-play. · (US-4, Arquitectura §1.1 "Campos del JSON de FIBA disponibles pero NO persistidos", §5)
- RF-12: El sistema DEBE almacenar como nulo todo dato nuevo que FIBA no informa (clave ausente) y como 0 el que FIBA informa como 0; los datos nuevos de partidos anteriores a la ingesta v2 quedan nulos ("no importado todavía") hasta reprocesar. · (US-1, Esp. v2 §C-11 "NULL = la competencia no registra ese dato"; docs/database.md)
- RF-13: El sistema DEBE actualizar (no ignorar) tiros y eventos del play-by-play cuando un partido se reimporta o reprocesa, sin duplicar filas (mismas restricciones únicas actuales). · (US-4, docs/database.md §`shots`, §`pbp_events`)
- RF-14: El sistema DEBE marcar la versión de ingesta con la que se procesó cada partido, para detectar los que necesitan reproceso. · (US-1, US-4)
- RF-15: El sistema DEBE tratar el tipo de período de prórroga que envía FIBA (`OVERTIME`) con su duración real de 300 s en la reconstrucción de quintetos, de modo que la suma de segundos de los tramos de un partido sea 60 × minutos del partido. · (US-1, docs/architecture.md §`lineups.py`, Arquitectura §1.5 D-09)

**C. Reprocesado**
- RF-16: El sistema DEBE permitir reprocesar uno o varios partidos, o una competencia completa, re-ejecutando la ingesta vigente a partir del JSON archivado; si el partido no tiene archivo, a partir de FIBA (URL de origen o, en su defecto, el identificador de partido), y archivándolo. · (US-4, Esp. v2 §F-11 "reprocesado de un partido o de una competencia completa")
- RF-17: El reprocesado DEBE ser idempotente (reprocesar dos veces deja el mismo estado y la misma cantidad de filas), conservar la competencia asignada al partido y procesar en lotes acotados que el cliente encadena, informando procesados, fallidos (con motivo) y el siguiente lote. · (US-4; Arquitectura §4 `ingest.reprocess_games` máx. 20)
- RF-18: El sistema DEBE invalidar todos los resultados calculados en memoria (métricas, poblaciones, posesiones) cada vez que cambian los datos: importar, borrar, reprocesar, editar/fusionar competencias o reasignar partidos; así un cambio de fórmula desplegado o una corrección de datos se refleja en la siguiente consulta. · (US-4, Esp. v2 §F-11 "tras un cambio de fórmula"; Constitución 4: las métricas no se persisten, nada que recalcular en la base) · Regla: "reprocesar tras un cambio de fórmula" = re-ingesta desde el archivo (para cambios del parser o de columnas) + invalidación de cachés (para cambios de fórmula); nunca se persisten métricas.

**D. Panel de calidad**
- RF-19: El sistema DEBE mostrar, para una competencia elegida y en una sola pantalla, un resumen (partidos totales, partidos incompletos, lista para publicar sí/no) y los chequeos: partidos sin play-by-play; partidos sin coordenadas de tiro; partidos pendientes de reproceso; campos nulos por competencia; jugadores posiblemente duplicados; inconsistencias de quintetos; discrepancias entre play-by-play y box score; posesiones que no cerraron correctamente. Cada chequeo informa estado (`ok` · `alerta` · `no_disponible`), cantidad y la lista de ítems afectados con acceso a su acción (reprocesar, reasignar). · (US-1, Esp. v2 §F-11, §1.3 S1 "Calidad de datos")
- RF-20: "Partido incompleto" DEBE significar: sin play-by-play, o sin los dos equipos o sin jugadores, o sin fecha, o pendiente de reproceso, o con discrepancia play-by-play/box score, o con inconsistencia de quintetos. La competencia está "lista para publicar" si no tiene partidos incompletos. · (US-1, CA del cliente) · `[DECISIÓN PROPUESTA — confirmar]` (§9).
- RF-21: El chequeo de campos nulos DEBE informar, por cada campo relevante (datos de box, datos nuevos de ingesta v2, fecha, posición, coordenadas), cuántas filas de la competencia lo tienen nulo sobre el total, con porcentaje, sin contar como nulo un 0 informado. · (US-1, Esp. v2 §F-11 "campos nulos por competencia", §C-11)
- RF-22: El chequeo de duplicados DEBE listar, por equipo de la competencia, los grupos de fichas cuyo nombre normalizado (minúsculas, sin tildes, sin espacios dobles — misma normalización que C-08) coincide pero con grafías distintas ("se unifican al leer"), y los grupos con riesgo de sobre-fusión (mismo nombre normalizado con nombre/apellido completos o foto distintos). · (US-1, Esp. v2 §C-08 regla de normalización, §F-11; Arquitectura §3.4, I-15)
- RF-23: El chequeo de discrepancias DEBE comparar, por equipo-partido con play-by-play, los puntos, tiros de campo intentados y tiros libres intentados reconstruidos del play-by-play contra el box score, listando los que difieren. · (US-1; Arquitectura I-01 "proxy")
- RF-24: El chequeo de inconsistencias de quintetos DEBE listar los equipo-partido cuyo quinteto inicial no tiene 5 jugadores, con algún tramo sin 5 jugadores en cancha, o cuya suma de segundos de tramos difiere de 60 × minutos del partido. · (US-1, docs/architecture.md §`lineups.py`)
- RF-25: El chequeo de posesiones que no cerraron correctamente DEBE mostrarse con estado `no_disponible` y la razón `requiere_posesiones` hasta que exista el motor de posesiones. · (US-1, Esp. v2 §F-11) · INCREMENTO DIFERIDO (→ A-01).
- RF-26: El panel DEBE permitir publicar la competencia desde la misma pantalla; si hay partidos incompletos, pedir confirmación explícita indicando cuántos. · (US-1, US-2, CA del cliente)
- RF-27: El catálogo de partidos DEBE poder filtrarse por competencia e indicar por partido su competencia (etiqueta), si tiene play-by-play, si tiene coordenadas y si necesita reproceso. · (US-1, Esp. v2 §1.3 S1 "Catálogo de partidos"; docs/api.md §GET `/api/games`)
- RF-28: El listado de equipos DEBE poder acotarse a una competencia. · (US-6, docs/api.md §GET `/api/teams`)

**E. Permisos**
- RF-29: El sistema DEBE soportar una lista opcional de usuarios administradores definida por variable de entorno: con autenticación activa y la lista definida, solo esos usuarios pueden borrar partidos, reasignarlos, editar/fusionar/crear competencias y reprocesar; sin la lista, todo usuario autenticado es administrador; en modo abierto (sin `AUTH_USERS`) todo está permitido. La sesión informa si el usuario es administrador y la UI oculta las acciones que no puede ejecutar. · (US-5, docs/deployment.md §Variables de entorno; Constitución 6; `[DECISIÓN HUMANA: DA-18]`)

## 5. Requisitos de datos / API

| Tabla / Endpoint | Tipo | Campos / Shape | ¿Nuevo? |
|---|---|---|---|
| `competitions` | tabla | `id` PK, `name` TEXT NOT NULL, `season` TEXT, `status` TEXT NOT NULL DEFAULT 'publicada', `is_default` INTEGER DEFAULT 0, `created_at`, `updated_at`; UNIQUE(`name`, `season`) | **NUEVO** (create_all) |
| `competition_aliases` | tabla | `source_name` TEXT PK, `competition_id` INTEGER NOT NULL FK | **NUEVO** (create_all) |
| `games.competition_id` | columna | INTEGER, NULL, backfill idempotente | **NUEVO** (upgrade_db) |
| `games.source_url` | columna | TEXT, NULL | **NUEVO** (upgrade_db) |
| `games.minutes` | columna existente | ahora se escribe: 40 + 5 × prórrogas | existe |
| `game_sources` | tabla | `game_id` TEXT PK FK cascade, `fetched_at`, `raw_gz` BLOB, `page_info` TEXT JSON, `parser_version` INTEGER | **NUEVO** (create_all) |
| `app_meta` | tabla | `key` TEXT PK, `value` TEXT (`data_version`, `config_version`) | **NUEVO** (create_all) |
| `team_game_stats.blk_received`, `.fouls_drawn`, `.team_orb`, `.team_drb`, `.team_tov` | columnas | INTEGER, NULL | **NUEVO** (upgrade_db) |
| `team_game_stats.period_pts` | columna | TEXT JSON (lista por período), NULL | **NUEVO** |
| `team_game_stats.ingest_version` | columna | INTEGER, NULL | **NUEVO** |
| `player_game_stats.blk_received`, `.fouls_drawn`, `.paint_pts`, `.second_chance_pts`, `.fast_break_pts` | columnas | INTEGER, NULL | **NUEVO** |
| `player_game_stats.first_name`, `.family_name`, `.photo_url` | columnas | TEXT, NULL | **NUEVO** |
| `shots.court_x`, `shots.court_y` | columnas | REAL, NULL (x/y legado sin cambios) | **NUEVO** |
| `pbp_events.previous_action` | columna | INTEGER, NULL | **NUEVO** |
| `pbp_events.qualifiers` | columna | TEXT (CSV ordenado), NULL | **NUEVO** |
| POST `/api/import` | endpoint (mod.) | request igual; response + `competition_id` | mod. |
| GET `/api/games` | endpoint (mod.) | `?competition=`; filas + `competition_id`, `competition_label`, `has_pbp`, `has_coords`, `needs_reprocess` | mod. |
| DELETE `/api/games` | endpoint (mod.) | igual; pasa a requerir admin; sube versión de datos | mod. |
| PATCH `/api/games/<game_id>` | endpoint | body `{competition_id}` → partido actualizado; admin | **NUEVO** |
| GET `/api/teams` | endpoint (mod.) | `?competition=`; + `competition_id` | mod. |
| GET `/api/competitions` | endpoint (mod.) | lista de objetos (RF-8) en lugar de strings | mod. (cambio de shape) |
| POST `/api/competitions` | endpoint | `{name, season}`; admin | **NUEVO** |
| PATCH `/api/competitions/<comp_id>` | endpoint | parcial `{name, season, status, is_default}`; admin | **NUEVO** |
| POST `/api/competitions/<comp_id>/merge` | endpoint | `{source_id}`; admin | **NUEVO** |
| GET `/api/data-quality` | endpoint | `?competition=<id>` → resumen + 8 chequeos | **NUEVO** |
| POST `/api/reprocess` | endpoint | `{game_ids[]}` o `{competition_id, offset}` → `{processed, failed[], next_offset, data_version}`; admin | **NUEVO** |
| GET `/api/me` | endpoint (mod.) | + `is_admin` | mod. |
| GET `/api/league` | endpoint (mod. mínima) | `competition` acepta id (además del texto legado) | mod. |

Errores (formato arquitectura §7.8, `{"error", "code", "details"}`): 400 `parametro_invalido` / `competencia_inexistente`; 403 `requiere_admin`; 404 `no_encontrado`; 409 `conflicto` (duplicado nombre+temporada, fusión consigo misma); 502 `fiba_no_disponible` (reproceso por FIBA de un partido: se informa en `failed[]`, no aborta el lote).

## 6. Estados de UI

Ubicación en fase 1 (antes de X-01): pestañas internas en la vista Importar: **Importar · Partidos · Calidad · Competencias** (X-01 las reubica en S1 `datos/importar`, `datos/partidos`, `datos/calidad`, `datos/competencias` sin cambiar sus componentes). Todo copy nuevo va por `t()` y se agrega a `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Pestaña Importar | spinner "Importando..." (existente) | — | toast con el mensaje del backend (existente) | toast "Sin conexión. Revisá tu red e intentá de nuevo." (nuevo) | toast "Partido importado: A vs B" (existente) + "Competencia: <etiqueta>" (nuevo) |
| Pestaña Partidos | `<span class="spinner">` | "Sin partidos aún." (existente) / con filtro: "No hay partidos en esta competencia." (nuevo) | "No se pudo cargar el catálogo de partidos." (nuevo) | ídem error | tabla con columnas Fecha · Local · Result. · Visitante · Competencia · Estado (badges "Sin PBP", "Sin coordenadas", "Reprocesar") (nuevo) |
| Pestaña Calidad | spinner "Revisando la competencia…" (nuevo) | sin competencias: "Todavía no hay competencias. Importá un partido para crear la primera." (nuevo); competencia sin partidos: "Esta competencia no tiene partidos." (nuevo) | "No se pudo generar el informe de calidad." (nuevo) | ídem error | resumen "N partidos · M incompletos" + etiqueta "Lista para publicar" (verde) o "Revisar antes de publicar" (ámbar); una card por chequeo con estado y lista; chequeo diferido: "Disponible cuando se implemente el motor de posesiones." (nuevo) |
| Reproceso (desde Partidos o Calidad) | barra "Reprocesando X de N…" (nuevo) | — | por partido fallido: "No se pudo reprocesar <id>: <motivo>" (nuevo) | "Sin conexión: el reproceso se detuvo en X de N." (nuevo) | toast "Reprocesados N partidos (F con error)." (nuevo) |
| Pestaña Competencias | spinner | "Todavía no hay competencias. Importá un partido para crear la primera." | 409: "Ya existe una competencia con ese nombre y temporada." / "No se puede fusionar una competencia consigo misma." (nuevos) | ídem error | lista con etiqueta, estado, partidos, equipos, fechas; acciones Editar · Fusionar en… · Publicar/Pasar a borrador/Archivar · Marcar por defecto; toast "Competencia guardada." (nuevo) |
| Publicar desde Calidad | botón deshabilitado con spinner | — | toast error | ídem | con incompletos: confirmación "Hay M partidos incompletos. ¿Publicar igual?" (nuevo); éxito: "Competencia publicada." (nuevo) |
| Usuario no admin | — | — | 403: "Tu usuario no tiene permiso para esta acción." (nuevo) | — | acciones de escritura ocultas; lectura intacta |

Mobile (< 768 px): pestañas como fila de pills con scroll horizontal dentro de la card; cards de chequeo apiladas; listas de ítems colapsables.

## 7. Criterios de aceptación
- CA-1 (CA del cliente): Given una competencia en estado `borrador` con partidos importados, When el analista abre la pestaña Calidad y la elige, Then en una sola pantalla ve el resumen (partidos totales, partidos incompletos, "Lista para publicar" o "Revisar antes de publicar") y todos los chequeos, y puede publicarla desde esa misma pantalla — "Antes de publicar una competencia se puede verificar en una sola pantalla que no hay partidos incompletos."
- CA-2: Given los 13 partidos del seed importados con la ingesta anterior (sin `competition_id`), When arranca el backend dos veces seguidas, Then cada partido queda con una competencia cuyo nombre no incluye la temporada y cuya temporada es "2025/2026" (o la detectada), y la cantidad de filas de `competitions` y `competition_aliases` no cambia en el segundo arranque.
- CA-3: Given un partido al que se le borraron sus eventos de play-by-play (inyección controlada en una copia de la base), When se consulta la calidad de su competencia, Then el chequeo "partidos sin play-by-play" está en `alerta` con ese partido listado, el resumen lo cuenta como incompleto y la competencia no figura "Lista para publicar".
- CA-4: Given partidos importados antes de la ingesta v2, When se consulta la calidad, Then "campos nulos" informa 100 % nulo en los datos nuevos (p. ej. tapones recibidos, coordenadas) y "pendientes de reproceso" lista todos los partidos; When se reprocesa la competencia, Then esos porcentajes bajan a 0 % (salvo campos que FIBA no informa, que siguen nulos y nunca aparecen como 0) y "pendientes de reproceso" queda en `ok`.
- CA-5: Given dos fichas del mismo equipo "Juan Pérez" y "juan  perez" (inyección controlada), When se consulta la calidad, Then el chequeo de duplicados lista el grupo con ambas grafías y la cantidad de partidos de cada una.
- CA-6: Given la calidad de cualquier competencia, When se consulta en fase 1, Then el chequeo "posesiones que no cerraron correctamente" aparece con estado `no_disponible`, razón `requiere_posesiones` y el texto "Disponible cuando se implemente el motor de posesiones."; no cuenta para "partidos incompletos".
- CA-7: Given dos competencias A y B, When se fusiona B en A, Then todos los partidos de B pasan a A, B deja de listarse, sus alias apuntan a A y una nueva importación de un partido con el texto original de B queda en A.
- CA-8: Given un partido reasignado manualmente a otra competencia, When se lo reprocesa o reimporta, Then conserva la competencia asignada.
- CA-9: Given una competencia en `borrador`, When se consulta `GET /api/competitions` sin parámetros y se abren los selectores de Liga/Equipo/Comparar/Jugador, Then no aparece; When se abre la pestaña Competencias o Calidad, Then sí aparece.
- CA-10: Given un partido con prórroga del seed reprocesado, When se consulta la base, Then `games.minutes = 45`, sus tiros tienen `court_x`/`court_y` no nulos, `team_game_stats.ingest_version = 2`, `period_pts` tiene 5 elementos, y la suma de segundos de los tramos de quintetos de cada equipo es 2700 (el chequeo de inconsistencias de quintetos no lo lista).
- CA-11: Given un partido ya reprocesado, When se lo reprocesa otra vez, Then las cantidades de filas de `shots`, `pbp_events`, `player_game_stats` y `team_game_stats` no cambian y `data_version` aumenta en 1.
- CA-12: Given una competencia de 13 partidos, When se la reprocesa desde la UI, Then el cliente encadena lotes hasta que `next_offset` es nulo, muestra el progreso y termina con "Reprocesados 13 partidos (0 con error)."; Given un partido sin archivo y FIBA inaccesible, Then ese partido figura en `failed[]` con su motivo y el resto del lote se procesa.
- CA-13: Given un partido reprocesado desde el archivo con la red a FIBA bloqueada (verificación ad hoc con la descarga forzada a fallar), When se reprocesa en modo archivo, Then termina bien sin acceder a la red.
- CA-14: Given `AUTH_USERS` con dos usuarios y `ADMIN_USERS` con solo uno, When el otro usuario intenta borrar, reasignar, editar competencias o reprocesar, Then recibe 403 `{"code": "requiere_admin"}` y la UI no le muestra esas acciones; `GET /api/me` devuelve `is_admin: false` para él y `true` para el administrador; Given `ADMIN_USERS` sin definir, Then ambos son administradores.
- CA-15: Given un equipo con 0 tapones recibidos informados por FIBA en un partido reprocesado, When se consulta la base, Then el valor es 0 (no nulo); Given un campo que FIBA no envía, Then el valor es nulo (no 0).
- CA-16: Given datos cargados, When se elige una competencia en el selector de Liga, Then la URL de la petición usa su id y el ranking es idéntico al que devolvía el texto legado de esa competencia (`/api/league?competition=<id>` y `/api/league?competition=<texto>` devuelven las mismas filas).
- CA-17: Given una discrepancia de puntos entre play-by-play y box en un equipo-partido (inyección controlada: se altera un `success`), When se consulta la calidad, Then el chequeo de discrepancias lista ese equipo-partido con los valores del box y del play-by-play.
- CA-18: Given la base sin partidos, When se abre cada pestaña (Partidos, Calidad, Competencias), Then se ven los textos de vacío de §6, sin errores en consola.

## 8. Fuera de alcance
- INCREMENTO DIFERIDO (→ A-01, [../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)): chequeo "posesiones que no cerraron correctamente" (`possession_gaps`) y listado de partidos con conciliación de posesiones > 5 % (DA-30). A-01 lo registra en el panel sin tocar F-11.
- Identidad persistente de jugadores (tabla `players`, `player_id`, fusión manual de fichas): C-08. F-11 solo detecta duplicados con la normalización de `dev`; C-08 migra el chequeo a `identity.duplicate_candidates`.
- Uso de las coordenadas en el mapa de tiro (11 zonas con geometría FIBA): C-03. F-11 solo las captura.
- Uso de las columnas nuevas en métricas (`blk_received`, `fouls_drawn`, rebotes de equipo, etc.): T-05. Parciales por cuarto: F-04/F-07.
- Corrección de `OVERTIME` en cierres (`clutch.py`): C-06.
- Migración completa de las consultas existentes a `repository` (eliminar todos los N+1): cada dueño al migrar su pantalla (T-05, T-01, C-02). F-11 crea el módulo y migra lo que toca.
- Importación por lote de URLs y exportación masiva desde S1: fuera de este requisito (lote: mejora futura sin ID; exportación: T-06).
- Calendario de partidos (S1 `calendario`): F-12.
- Limpieza del modal de borrado con token (D-19): C-11.
- Separar una ficha sobre-fusionada: PROPUESTA de C-08 si aparece un caso real.

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **Qué es un "partido incompleto"** (CA del cliente): se propone la definición de RF-20 (sin pbp, sin equipos/jugadores, sin fecha, pendiente de reproceso, discrepancia pbp/box, inconsistencia de quintetos). Sin coordenadas y campos nulos que FIBA no informa son advertencias, no incompletitud (hay competencias que no registran coordenadas).
- [DECISIÓN PROPUESTA — confirmar] **"Antes de publicar"**: se modela con el estado de la competencia (`borrador` → `publicada`). Publicar con incompletos se permite con confirmación explícita (no se bloquea: el analista puede aceptar un partido sin pbp). Estado inicial de las competencias creadas al importar: `publicada` (DA-13), para no ocultar datos ya visibles en producción; el analista puede pasar a `borrador` una competencia nueva mientras la revisa.
- [DECISIÓN PROPUESTA — confirmar] **"Reprocesado tras un cambio de fórmula"**: como las métricas no se persisten (Constitución 4), un cambio de fórmula no requiere recalcular nada en la base; basta invalidar cachés (versión de datos). El reprocesado re-ejecuta la ingesta desde el JSON archivado (cambios del parser o columnas nuevas). Ambos efectos ocurren en la misma acción.
- [DECISIÓN PROPUESTA — confirmar] **Permiso de importar**: la arquitectura (§3.21) lista "importar/borrar partidos" entre las acciones de administrador, pero su tabla de endpoints (§6) no marca `POST /api/import` como admin. Se propone: borrar, reasignar, reprocesar y editar competencias = admin; importar = cualquier usuario autenticado (comportamiento actual; el seed ya está protegido por `SEED_ENABLED`).
- [DECISIÓN PROPUESTA — confirmar] **Competencias archivadas**: visibles en los selectores al final como "<etiqueta> (archivada)", nunca elegidas automáticamente.
- [DECISIÓN PROPUESTA — confirmar] **Duplicados por abreviatura** ("J. Feldeine" vs "Jerome Feldeine"): la normalización tipográfica no los une (decisión de `dev`); el panel los lista aparte como "posibles duplicados (revisar)" cuando coinciden apellido normalizado e inicial del nombre, sin unificarlos (la unificación manual es de C-08).
</content>
</invoke>
