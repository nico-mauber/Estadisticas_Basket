# Spec — F-16: Ficha de identidad del jugador

> **ID:** F-16 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 05
> **Depende de:** C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md)) · X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md)) · F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md)) · T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md), "selección activa")
> **Habilita:** F-05 (lista de competencias del jugador para comparar entre competencias)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4.2 · F-16 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S4 (pestaña Ficha) · Arquitectura §1.1, §3.4, §3.21, §5, §6 (`/api/player-profile`), §12 R-12 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente y por qué.** "Cabecera de la sección Jugador con los datos de plantel: dorsal, posición, altura, año de
nacimiento, nacionalidad y club actual", más una "línea de contexto bajo el nombre: competencia, equipo y partidos disputados
en la selección activa (por ejemplo, 'Liga de Ascenso 2026 · Welcome · 16 partidos')". "Los datos que FIBA LiveStats no
publique se muestran como nulos, nunca en blanco silencioso (C-11), y deben poder completarse manualmente." Motivo: "Hoy el
perfil arranca directamente en las métricas y el usuario no sabe a quién está mirando." En el mapa S4 la pestaña **Ficha**
lista "Dorsal, posición, altura, año de nacimiento, nacionalidad, partidos disputados".

**Qué existe hoy (verificado).**
- `frontend/js/app.js:renderPlayer` (l.1313) / `_renderPlayerContent` (l.1327): la vista arranca con el selector de
  competencia y la card "Producción ofensiva"; el nombre del jugador aparece recién en el título del game log
  ("Game log — ${playerName}", l.1399). No hay dorsal, posición ni equipo en pantalla.
- `backend/app.py:player_stats` (l.543–624): devuelve `{player, team_code, team_name, games, averages, league, game_log}`;
  no expone `jersey` ni `position`.
- `backend/fiba_fetcher.py:_parse_fiba_json` (l.335–350): de cada `pl[k]` persiste `jersey` (`shirtNumber`) y `position`
  (`playingPosition`) por partido; arma `player_name` con `name` o `firstName + familyName` o `scoreboardName`; **no**
  guarda `firstName`/`familyName` por separado ni la foto.
- `backend/database.py:PlayerGameStats` (l.93–95): columnas `jersey` (String) y `position` (String, default `''`) por partido.
- Búsqueda de jugadores (`app.py:search_players`, l.727–792) ya toma la última posición no vacía.
- Verificación sobre el JSON real (arquitectura §1.1): FIBA publica `shirtNumber`, `playingPosition` (rol por partido,
  varía: D-23), `firstName`, `familyName`, `internationalFirstName/FamilyName`, `scoreboardName`, `photoT`/`photoS` (~80 %
  de las fichas); **no** publica altura, fecha/año de nacimiento ni nacionalidad.

**Qué resolvieron features anteriores / fase 1.** En `dev`, C-08 (Feature 13) unifica al jugador por (equipo, nombre
normalizado) con `norm_name`/`resolve_identity` (posición = valor FIBA más frecuente, desempate por el más reciente). En v2,
F-11 captura `player_game_stats.first_name`, `family_name`, `photo_url`; C-08 crea la tabla `players` + `player_id`, la ruta
`GET /api/player/<int:player_id>`, `identity.player_card(player_id)` y la fusión manual; X-01 crea la sección S4 con la
pestaña `ficha`; T-03 define la "selección activa" (contexto).

**Qué queda para F-16.** Los campos manuales (altura, año de nacimiento, nacionalidad, notas) en `players`, la ficha de
identidad (endpoint de lectura con línea de contexto y edición manual para administradores), la cabecera de identidad
visible en todas las pestañas de S4 antes de cualquier métrica, y la pestaña `ficha` con el detalle y el formulario.

## 1. Objetivo
Que toda vista de un jugador lo identifique (nombre, dorsal, posición, club, datos de plantel y contexto de la selección)
antes de mostrar cualquier métrica, con los datos que FIBA no publica visibles como nulos y editables a mano.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4.2 F-16 (texto y CA); §1.3 S4 (pestaña Ficha); §2 C-11 (nulos); §2 C-08 (identidad única).
- `docs/database.md` §`player_game_stats` (`jersey`, `position`); `docs/api.md` §`GET /api/player/<team_code>/<player_name>`;
  `docs/frontend.md` §Vistas "Jugador".
- `00-arquitectura-transversal.md` §1.1 (campos FIBA disponibles y no publicados), §3.1 (resolución de competencia), §3.4
  (identidad: `players`, `player_id`, posición y dorsal de la ficha, "club actual", campos de F-16), §3.14 (`data_version` al
  editar fichas), §3.21 (`admin_required` para editar fichas), §5 (columnas de F-16), §6 (`GET`/`PUT /api/player-profile`),
  §7.4 (códigos de nulo), §12 R-12 (datos personales).
- `sdd/specs/06-buscador-jugadores/spec.md` (posición en el buscador).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver arriba de todo a quién estoy mirando (nombre, dorsal, posición, club), para no confundir
  jugadores con nombres parecidos antes de leer números.
- US-2: Como entrenador, quiero ver altura, año de nacimiento y nacionalidad del jugador, para ubicarlo físicamente y en el
  plantel.
- US-3: Como analista, quiero completar a mano los datos que FIBA no publica, para que la ficha quede completa para todo el
  cuerpo técnico.
- US-4: Como entrenador, quiero una línea que me diga competencia, equipo y partidos disputados en la selección activa, para
  saber sobre qué base se calculan las métricas del perfil.
- US-5: Como entrenador, quiero distinguir un dato "no registrado" de un dato vacío por error, para confiar en la ficha.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE mostrar, en todas las pestañas de la sección Jugador y antes de cualquier métrica, una **cabecera de
  identidad** con: nombre, dorsal, posición, club actual y la línea de contexto. · (US-1, US-4) (Esp. v2 §F-16)
- RF-2: El sistema DEBE ofrecer la pestaña **Ficha** con: nombre completo (nombre y apellido cuando existen), dorsal,
  posición (y su grupo G/F/C), altura, año de nacimiento, nacionalidad, club actual, partidos disputados en la selección
  activa y, si existe, la foto publicada por FIBA. · (US-1, US-2) (Esp. v2 §1.3 S4 "Ficha")
- RF-3: Dorsal DEBE ser el del partido más reciente del jugador en su ficha; posición = valor FIBA no vacío más frecuente
  (desempate: el más reciente), con grupo G = {G, PG, SG}, F = {F, SF, PF}, C = {C}; club actual = equipo de la ficha
  consultada. · (US-1) (Arquitectura §3.4, DA-11)
- RF-4: La línea de contexto DEBE tener el formato "<competencia y temporada> · <equipo> · <N> partidos", donde N = partidos
  **jugados** (sin DNP) en la selección activa (competencia y filtros de T-03). Con 1 partido dice "1 partido". ·
  (US-4) (Esp. v2 §F-16 ejemplo "Liga de Ascenso 2026 · Welcome · 16 partidos")
- RF-5: Todo dato no publicado por FIBA ni cargado a mano DEBE mostrarse como nulo "—" con la razón "No registrado"
  (código `no_registrado`), nunca en blanco ni con 0. Un dato que FIBA sí publica pero falta en todos los partidos del
  jugador (dorsal o posición vacíos) DEBE mostrarse igual como nulo con razón. · (US-5) (Esp. v2 §F-16, §C-11; arquitectura §7.4)
- RF-6: Un usuario administrador DEBE poder cargar y corregir altura (cm), año de nacimiento, nacionalidad y notas de la
  ficha, y dejar un campo vacío para volver a nulo; los cambios quedan con fecha y usuario. · (US-3) (Esp. v2 §F-16;
  arquitectura §3.4, §3.21) · Reglas de validación: altura entero 140–240 cm; año de nacimiento entero entre 1950 y el año
  actual − 12; nacionalidad texto de 2 a 56 caracteres; notas hasta 500 caracteres.
- RF-7: Los datos manuales DEBEN pertenecer a la ficha del jugador (identidad de C-08), no a un partido: se ven en todas las
  competencias y sobreviven a reimportaciones y reprocesos. Si la ficha fue fusionada (`merged_into`), la lectura y la
  edición se resuelven sobre la ficha destino. · (US-3) (Arquitectura §3.4)
- RF-8: La ficha DEBE mostrar cuándo y quién cargó por última vez los datos manuales ("Editado el 23/09/2026 por nico"). ·
  (US-3)
- RF-9: Los usuarios que no son administradores DEBEN ver la ficha sin controles de edición; un intento de edición sin
  permiso DEBE rechazarse. · (US-3) (Arquitectura §3.21, DA-18)
- RF-10: Editar una ficha DEBE invalidar las cachés de datos (sube `data_version`), para que la cabecera y cualquier vista
  que la use reflejen el cambio en la siguiente petición. · (US-3) (Arquitectura §3.14)
- RF-11: El sistema DEBE devolver, junto con la ficha, la lista de competencias en las que el jugador tiene partidos
  jugados (id, nombre y temporada, partidos), para la línea de contexto y para la comparación entre competencias (F-05). ·
  (US-4)
- RF-12: Los datos personales cargados a mano NO DEBEN incluirse en la exportación masiva (T-06) ni en ningún listado
  fuera de la ficha. · (US-3) (Arquitectura §12 R-12)
- RF-13: Todo copy nuevo en español rioplatense vía `t()`; altura en metros con coma decimal ("1,98 m"). · (US-2)
  (Arquitectura §3.20, DA-36)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `players` (C-08) | consumida | `id`, `team_code`, `display_name`, `first_name`, `family_name`, `photo_url`, `merged_into` | C-08 |
| `players.height_cm` | columna INTEGER, DEFAULT NULL, `upgrade_db()` | altura en cm (carga manual) | **NUEVO** (arquitectura §5) |
| `players.birth_year` | columna INTEGER, DEFAULT NULL, `upgrade_db()` | año de nacimiento | **NUEVO** |
| `players.nationality` | columna TEXT, DEFAULT NULL, `upgrade_db()` | nacionalidad (texto) | **NUEVO** |
| `players.profile_notes` | columna TEXT, DEFAULT NULL, `upgrade_db()` | notas de plantel | **NUEVO** |
| `players.profile_updated_at` · `.profile_updated_by` | columnas TEXT, DEFAULT NULL, `upgrade_db()` | auditoría mínima | **NUEVO** |
| `player_game_stats` (`jersey`, `position`, `minutes`, `player_id`, `game_id`) | consumida | dorsal, posición, partidos jugados | existe (+`player_id` C-08) |
| `GET /api/player-profile/<int:player_id>` | endpoint (Ctx) | `{player_id, display_name, full_name, first_name, family_name, jersey, position, position_group, height_cm, birth_year, nationality, profile_notes, photo_url, team{code,name}, competition{id,label}, games, context_line, competitions[], fields_null_reasons{}, profile_updated_at, profile_updated_by, editable}`; 404 `no_encontrado` | **NUEVO** (dueño F-16) → `docs/api.md` |
| `PUT /api/player-profile/<int:player_id>` | endpoint (`admin_required`) | body parcial `{height_cm, birth_year, nationality, profile_notes}` (null = borrar) → mismo shape que GET; 400 `parametro_invalido`, 403 `requiere_admin`, 404 | **NUEVO** (dueño F-16) → `docs/api.md` |

## 6. Estados de UI
Cabecera de identidad (todas las pestañas de S4) y pestaña `ficha`. Copy nuevo → `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Cabecera de identidad | Esqueleto con "Cargando jugador…" (las métricas de la pestaña esperan a la cabecera) | — (siempre hay jugador si la ruta es válida) | "No encontramos este jugador" + enlace "Volver a Explorar" | "Sin conexión: no se pudo cargar la ficha" | "#7 · A. Varela · Base (G) · Nacional" + línea "Liga Uruguaya de Básquetbol 2025/2026 · Nacional · 16 partidos" |
| Línea de contexto con selección vacía | — | "Liga … · Nacional · 0 partidos en la selección" | — | — | — |
| Pestaña Ficha | "Cargando ficha…" | Campos con "—" y tooltip "No registrado: FIBA no publica este dato. Podés cargarlo a mano." | "No se pudo cargar la ficha" | idem cabecera | Tabla de datos + foto o iniciales + "Editado el … por …" |
| Formulario de edición (admin) | "Guardando…" (botón deshabilitado) | — | Mensaje del campo inválido ("La altura debe estar entre 140 y 240 cm") | "Sin conexión: no se pudo guardar" | toast "Ficha actualizada" |
| Usuario sin permiso | — | — | "Solo un administrador puede editar la ficha" (si fuerza el PUT) | — | Ficha sin botón "Editar" |

## 7. Criterios de aceptación
- CA-1 (CA del cliente): **"Toda ficha de jugador identifica al jugador antes de mostrar un solo número."** Given cualquier
  pestaña de S4 de cualquier jugador, When se abre la vista (también por URL directa), Then la cabecera con nombre, dorsal,
  posición, club y línea de contexto se renderiza arriba y antes que cualquier card de métricas.
- CA-2: Given un jugador del seed que jugó 16 partidos y tiene 1 DNP en la competencia, When se abre su ficha sin filtros,
  Then la línea de contexto dice "<competencia> · <equipo> · 16 partidos"; con "Últimos 5" (T-03) dice "5 partidos".
- CA-3: Given un jugador sin datos manuales, When se abre la pestaña Ficha, Then altura, año de nacimiento y nacionalidad
  muestran "—" con el tooltip "No registrado" y el JSON trae `fields_null_reasons.height_cm == "no_registrado"`.
- CA-4: Given un administrador, When carga altura 198, año 1999 y nacionalidad "Uruguay" y guarda, Then la ficha muestra
  "1,98 m", "1999", "Uruguay" y "Editado el <fecha> por <usuario>", y tras reimportar/reprocesar un partido del jugador los
  datos siguen.
- CA-5: Given un administrador, When envía altura 300, Then recibe 400 con "La altura debe estar entre 140 y 240 cm" y la
  ficha no cambia; When borra la nacionalidad (campo vacío), Then vuelve a "—" con razón `no_registrado`.
- CA-6: Given `ADMIN_USERS` definida y un usuario autenticado fuera de la lista, When abre la ficha, Then no ve "Editar", y
  un `PUT` directo responde 403 `requiere_admin`.
- CA-7: Given un jugador cuya posición FIBA varía entre partidos (G, PG, G), When se abre la ficha, Then la posición es la
  más frecuente ("G") y el grupo "G".
- CA-8: Given dos fichas fusionadas (C-08) con datos manuales cargados en la ficha destino, When se abre la ficha origen por
  su id, Then se ven los datos de la ficha destino.
- CA-9: Given `GET /api/player-profile/999999`, When el id no existe, Then 404 `{"error": "Jugador no encontrado",
  "code": "no_encontrado"}`.
- CA-10: Given un viewport de 375 px, When se abre S4, Then la cabecera de identidad entra en el ancho sin scroll horizontal
  y la línea de contexto se corta con puntos suspensivos sin tapar el nombre.

## 8. Fuera de alcance
- Vincular fichas de la misma persona en equipos distintos (cada ficha es por equipo, arquitectura §3.4): fuera de alcance
  de v2. "Club actual" = equipo de la ficha consultada.
- Scraping de altura/nacimiento/nacionalidad desde sitios de terceros (FIBA LiveStats no los publica; dominio permitido).
- Fecha de nacimiento completa y edad calculada: solo año (la especificación pide "año de nacimiento").
- Subida de fotos propias: solo se muestra `photo_url` de FIBA si existe.
- Carga masiva de fichas por archivo: [DECISIÓN PROPUESTA] diferible a pedido del cliente (no pedida).
- Fusión/separación de fichas: C-08.
- Métricas del jugador: T-05/T-01 y demás requisitos de S4.

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **Nacionalidad como texto libre** ("Uruguay"), no código ISO: es lo que el cuerpo técnico
  escribe y no hay una fuente FIBA para validar códigos; se ofrece una lista de sugerencias (datalist) con las nacionalidades
  ya cargadas para evitar variantes.
- [DECISIÓN PROPUESTA — confirmar] **Rangos de validación**: altura 140–240 cm; año de nacimiento 1950…(año actual − 12).
  Evitan errores de tipeo sin excluir casos reales de estas competencias.
- [DECISIÓN PROPUESTA — confirmar] **Cabecera en todas las pestañas y pestaña Ficha con el detalle.** El CA pide identificar
  al jugador "antes de mostrar un solo número" en toda ficha; la cabecera compacta vive sobre las pestañas y la pestaña
  `ficha` tiene el detalle y la edición. La pestaña por defecto sigue siendo `resumen` (arquitectura §3.12).
- [DECISIÓN PROPUESTA — confirmar] **"Partidos disputados"** = partidos jugados (minutos > 0) en la selección activa, igual
  que `games` del conjunto estándar para jugador (T-05) y que la cabecera de F-19.
- [DECISIÓN PROPUESTA — confirmar] **Notas de plantel** (`profile_notes`, previsto por la arquitectura §3.4) se muestran solo
  en la pestaña Ficha, visibles para todos los usuarios autenticados.
- [DECISIÓN PROPUESTA — confirmar] **Datos personales (Ley 18.331).** Se limitan a datos deportivos (altura, año, nacionalidad)
  cargados por administradores, sin exportación masiva (RF-12). Si el cliente necesita exportarlos, se revisa con él.
