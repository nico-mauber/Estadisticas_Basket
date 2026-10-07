# Tasks — C-08: Jugadores duplicados en el buscador

> **ID:** C-08 · **Fase y orden:** 1·07 · **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [plan.md](plan.md) · [spec.md](spec.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Modelo `Player` (`players`: `id` PK, `team_code`, `norm_key`, `display_name`, `first_name`, `family_name`,
  `photo_url`, `merged_into` FK `players.id`, `created_at`; `UNIQUE(team_code, norm_key)`) en `backend/database.py` ·
  cubre RF-2 · Done: `db.create_all()` crea la tabla `players` sin error; una segunda corrida no falla (idempotente).
- [ ] T-A2 · Columna `player_game_stats.player_id` (INTEGER, default NULL) agregada a `upgrade_db().new_cols` ·
  `backend/database.py` · cubre RF-2 · Done: `python backend/database.py` corrido dos veces seguidas no lanza error y
  `PRAGMA table_info(player_game_stats)` incluye `player_id`.
- [ ] T-A2b · Columnas `player_game_stats.first_name`, `.family_name`, `.photo_url` (TEXT, sin DEFAULT) en el modelo y en
  `upgrade_db().new_cols` · `backend/database.py` · cubre RF-12 · Done: `PRAGMA table_info(player_game_stats)` las incluye
  tras arrancar el backend dos veces seguidas sin error (F-11 las difirió).
- [ ] T-A3 [P] · Índice `CREATE INDEX IF NOT EXISTS ix_pgs_player_id ON player_game_stats(player_id)` en
  `upgrade_db()` · `backend/database.py` · cubre RF-2 (rendimiento) · Done: `PRAGMA index_list(player_game_stats)`
  incluye `ix_pgs_player_id` tras correr `upgrade_db()`.

### Grupo B — Backend: módulo `identity.py`
- [ ] T-B1 · Mover `norm_name(s) -> str` de `stats_engine.py` a `backend/identity.py` (código de `dev` sin cambios);
  `stats_engine.norm_name` pasa a ser re-export · cubre RF-1 · Done: `identity.norm_name("Ángel  Pérez ")` devuelve
  `"angel perez"`; `stats_engine.norm_name` sigue funcionando igual para los imports existentes.
- [ ] T-B2 · Mover `resolve_identity(rows) -> tuple[str, str]` de `stats_engine.py` a `identity.py` (código de `dev`
  sin cambios); `stats_engine.resolve_identity` re-export · cubre RF-4, RF-6 · Done: con filas `[("G",), ("",),
  ("PG",), ("G",)]` en orden antiguo→reciente, devuelve posición `"G"` (más frecuente, desempate por reciente).
- [ ] T-B3 [P] · `position_group(pos: str | None) -> str | None` (`{G,PG,SG}→"G"`, `{F,SF,PF}→"F"`, `{C}→"C"`, vacío
  o desconocido → `None`) · `identity.py` · cubre RF-5 · Done: `position_group("SG") == "G"`,
  `position_group("") is None`, `position_group(None) is None`.
- [ ] T-B4 · `resolve_player_id(team_code, player_name, *, first_name=None, family_name=None, photo_url=None,
  create=True) -> int | None` · `identity.py` · cubre RF-1, RF-2 · Done: dos llamadas con el mismo `(team_code,
  player_name)` normalizado devuelven el mismo id; con `create=False` y ficha inexistente devuelve `None` sin crear
  fila; con carrera simulada (IntegrityError forzado) no crea una fila duplicada.
- [ ] T-B5 [P] · `canonical_id(player_id: int) -> int | None` (sigue `merged_into` con corte ante ciclo) ·
  `identity.py` · cubre RF-11 · Done: con A→B→C fusionado, `canonical_id(A) == C`; con id inexistente devuelve
  `None`; con un ciclo forzado en datos de prueba no entra en loop infinito.
- [ ] T-B6 · `_refresh_display(pids)` (privada: `display_name` = `player_name` de la fila más reciente por
  `(games.date, game_id)`) · `identity.py` · cubre RF-6 · Done: tras cambiar la fila más reciente de una ficha,
  `_refresh_display` actualiza `display_name` a esa grafía.
- [ ] T-B7 · `assign_game(game_id: str) -> int` (hook de ingesta: resuelve `player_id` de cada fila del partido,
  actualiza las que difieren, llama `_refresh_display`) · `identity.py` · cubre RF-2 · Done: tras `assign_game` sobre
  un partido de prueba, todas sus filas de `player_game_stats` tienen `player_id` no nulo.
- [ ] T-B8 · `backfill_player_ids() -> int` (idempotente, por lotes de 500, sube `data_version` solo si asignó algo) ·
  `identity.py` · cubre RF-2 · Done: sobre una base de prueba, la primera corrida asigna N filas; la segunda corrida
  devuelve `0` y no crea fichas nuevas (CA-7).
- [ ] T-B9 [P] · `aliases(player_id: int) -> list[str]` · `identity.py` · cubre RF-10 · Done: para una ficha con dos
  grafías en distintos partidos, devuelve ambas.
- [ ] T-B10 [P] · `name_index(team_code: str) -> dict[str, int]` (memo por request en `flask.g`) · `identity.py` ·
  cubre RF-10 · Done: `name_index("CNF")` incluye todas las grafías crudas del equipo mapeadas a su id canónico.
- [ ] T-B11 · `canonicalize_pbp_games(games: list[dict], team_code: str) -> list[dict]` (reemplaza `player_name` por
  `display_name` canónico en `events` y `player_rows` del equipo, sin tocar la base) · `identity.py` · cubre RF-10 ·
  Done: con un jugador con dos grafías en dos partidos de la lista, la salida usa una sola grafía en ambos.
- [ ] T-B12 · `player_card(player_id: int) -> dict | None` (`player_id, team_code, team_name, display_name, position,
  position_group, jersey, games, games_listed, first_name, family_name, photo_url, aliases[], competition_ids[]`) ·
  `identity.py` · cubre RF-4, RF-6, RF-9 · Done: para una ficha con 2 partidos, `games` = partidos jugados (excluye
  DNP) y `aliases` lista sus grafías.
- [ ] T-B13 · `duplicate_candidates(competition_id: int | None) -> list[dict]` (reglas `apellido_inicial` y
  `dorsal_apellido`, más `posible_fusion_incorrecta` por nombre completo o foto distintos) · `identity.py` · cubre
  RF-12 · Done: sobre una base de prueba con "J. Feldeine" y "Jerome Feldeine" del mismo equipo (nunca en el mismo
  partido), aparece un item `kind: "candidato"`.
- [ ] T-B14 · `merge_players(target_id: int, source_id: int) -> dict` (aplana la cadena, mueve `player_id` de las
  filas, completa datos faltantes del target, refresca display, sube `data_version`) · `identity.py` · cubre RF-11,
  RF-13 · Done: tras fusionar A (target) y B (source), `GET` por B resuelve a A y `rows_moved` coincide con las filas
  de B.

### Grupo C — Backend: hooks e integración con F-11
- [ ] T-C0 · `fiba_fetcher._parse_fiba_json`: cada `player_row` agrega `first_name`, `family_name` (con fallback a
  `internationalFirstName`/`internationalFamilyName`) y `photo_url` (`photoT`/`photoS`), `None` si no vienen; `ingest.py`:
  sumarlos a `player_cols` y subir `INGEST_VERSION` a 3 · `backend/fiba_fetcher.py`, `backend/ingest.py` · cubre RF-12 ·
  Done: reprocesar un partido del seed deja las tres columnas pobladas (foto puede quedar `NULL` en ~20 %) y el panel de
  calidad lo marca "pendiente de reproceso" antes de reprocesar.
- [ ] T-C1 · `ingest.persist_game` llama `identity.assign_game(game_id)` tras insertar las filas de `player_game_stats` (hace `db.session.flush()`; el commit lo hace quien llama), en la
  misma transacción · `backend/ingest.py` · cubre RF-2 · Done: importar un partido nuevo deja todas sus filas de
  jugador con `player_id` asignado sin una segunda pasada.
- [ ] T-C2 · El arranque de `app.py` llama `identity.backfill_player_ids()` dentro de `with app.app_context():`, junto a
  `competitions.backfill()` (no desde `upgrade_db()`: evita el import circular `database` ↔ `identity`) ·
  `backend/app.py` · cubre RF-2 · Done: arrancar el backend contra una base con partidos históricos deja todas
  las filas con `player_id` asignado.
- [ ] T-C3 · `data_quality.report()` arma el check `possible_duplicates` con `identity.duplicate_candidates` en vez de
  `_duplicates(player_rows)` (versión provisional de F-11 basada solo en `norm_name`; F-11 no tiene `register_check`) ·
  `backend/data_quality.py` · cubre RF-12 · Done:
  `GET /api/data-quality` devuelve el check `possible_duplicates` con `items[]` en el shape de `identity.py`.

### Grupo D — Backend: rutas
- [ ] T-D1 · Helper `_resolve_legacy_player(team_code, name) -> int | None` y `_player_payload(pid) -> dict` ·
  `backend/app.py` · cubre RF-9, RF-10 · Done: `_player_payload` para una ficha con 2 partidos devuelve el mismo
  shape que el `player_stats` actual de `dev` más `player_id`, `position`, `position_group`.
- [ ] T-D2 · `GET /api/players/<team_code>` agrupa por `player_id`, acepta `competition` opcional, responde
  `[{player_id, name, games, uso_pct, pts}]` · `backend/app.py` · cubre RF-8 · Done: equipo con un duplicado
  inyectado devuelve una sola fila con `games` = suma de ambas grafías.
- [ ] T-D3 · `GET /api/player/<int:player_id>` (NUEVO) devuelve `_player_payload(pid)`; 404 `no_encontrado`
  `"Jugador no encontrado"` si no existe · `backend/app.py` · cubre RF-9 · Done: id inexistente → 404 con ese
  mensaje; id válido → mismo shape que el perfil por nombre + `player_id`.
- [ ] T-D4 · `GET /api/player/<team_code>/<player_name>` resuelve con `_resolve_legacy_player` y delega en
  `_player_payload`; 404 sin cambio si no resuelve · `backend/app.py` · cubre RF-10 · Done: cualquiera de las
  grafías de un jugador duplicado devuelve el mismo `player_id` y el mismo `game_log` completo.
- [ ] T-D5 · `GET /api/search/players` agrupa por `player_id`, acepta `competition` opcional, agrega `player_id`,
  `position_group`, `competition_ids` · `backend/app.py` · cubre RF-7 · Done: base con un duplicado inyectado
  devuelve una sola fila por jugador con `games` sumado.
- [ ] T-D6 · `GET /api/shots/<team_code>/<player_name>` resuelve ficha, filtra `Shot.player_name IN aliases(pid)`;
  404 `"Jugador no encontrado"` si no resuelve · `backend/app.py` · cubre RF-10 · Done: con dos grafías del mismo
  jugador, la suma de tiros de ambas aparece en una sola consulta con cualquiera de las dos.
- [ ] T-D7 · `GET /api/onoff/<team_code>/<player_name>` resuelve ficha, usa `canonicalize_pbp_games`, USO% sobre
  `player_id`; response + `player_id` · `backend/app.py` · cubre RF-10 · Done: con un jugador con dos grafías, el
  ON/OFF incluye los tramos de ambos partidos sin importar cuál grafía se consulte.
- [ ] T-D8 · `GET /api/lineup/<team_code>?players=A|B|C` resuelve cada nombre con `create=False`; nombre que no
  resuelve → 400 `parametro_invalido` `"Jugador no encontrado: {nombre}"`; usa `canonicalize_pbp_games` ·
  `backend/app.py` · cubre RF-10 · Done: un nombre inexistente en la query responde 400 con ese mensaje exacto.
- [ ] T-D9 · `POST /api/identity/merge` (`admin_required`): body `{target_id, source_id}`; 400/403/404/409 según
  §3.2 del plan; éxito devuelve `{player, merged, data_version}` · `backend/app.py` · cubre RF-11 · Done: fusión
  válida devuelve 200 con `rows_moved` correcto; equipos distintos → 409; sin admin → 403.

### Grupo E — Frontend: api.js
- [ ] T-E1 · Confirmar que `qs(params)` (helper local de `api.js`, ya existe) omite `null`/`undefined`/`""` y reutilizarlo
  (no exportarlo ni duplicarlo) · `frontend/js/api.js` · cubre RF-7…RF-9, RF-11 · Done: `qs({competition: null, a: 1})`
  produce `"?a=1"`.
- [ ] T-E2 [P] · `api.players(code, params = {})` acepta `params` opcional (compatibilidad con llamadas existentes
  sin argumento) · `frontend/js/api.js` · cubre RF-8 · Done: `api.players('CNF')` sigue funcionando; `api.players
  ('CNF', {competition: 3})` agrega `?competition=3`.
- [ ] T-E3 [P] · `api.playerById(id, params = {})` (NUEVO) · `frontend/js/api.js` · cubre RF-9 · Done: llama
  `GET /api/player/<id>` con la query armada por `qs`.
- [ ] T-E4 [P] · `api.searchPlayers(params = {})` acepta `params` opcional · `frontend/js/api.js` · cubre RF-7 ·
  Done: `api.searchPlayers({competition: 3})` agrega `?competition=3` sin romper la llamada sin argumentos.
- [ ] T-E5 · `api.mergePlayers(targetId, sourceId)` (NUEVO, `POST /api/identity/merge`) · `frontend/js/api.js` ·
  cubre RF-11 · Done: devuelve el JSON de éxito en un caso válido y propaga el mensaje de error (403/409) en un
  caso inválido.

### Grupo F — Frontend: UI (render + componente)
- [ ] T-F1 · Buscador: select de posición con 3 opciones fijas (G/F/C) con el copy de §6 del plan (español directo, sin `t()`), filtra por
  `position_group` · `frontend/js/app.js` · cubre RF-5 · Done: elegir "F" muestra solo jugadores con
  `position_group === "F"`, ninguno sin posición.
- [ ] T-F2 [P] · Buscador: select de competencia por `id` (de `api.competitions()`), refetch con
  `api.searchPlayers({competition: id})` · `frontend/js/app.js` · cubre RF-7 · Done: cambiar de competencia
  recalcula la lista sin recargar la página.
- [ ] T-F3 · Buscador: filas con `data-player-id`, clic navega al perfil por id · `frontend/js/app.js` · cubre
  RF-14 · Done: clic en una fila abre la vista Jugador con el `player_id` correcto.
- [ ] T-F4 · Equipo: `player-select` con `value="${p.player_id}"`, mapa/ON/OFF/combinaciones toman el display name
  de la opción seleccionada · `frontend/js/app.js` · cubre RF-14 · Done: elegir un jugador del select carga su
  mapa de tiro y ON/OFF sin importar la grafía almacenada.
- [ ] T-F5 · Jugador: `renderPlayer` usa `api.playerById(id)`; el shot chart sigue llamando `api.playerShots(team,
  data.player)` con el display name devuelto · `frontend/js/app.js` · cubre RF-9, RF-14 · Done: abrir un jugador
  por id renderiza su perfil completo.
- [ ] T-F6 · `frontend/js/components/identity-merge.js` (NUEVO): `renderDuplicateItems(el, check, {isAdmin,
  onMerged})` — tabla/tarjetas con Equipo · Ficha A · Ficha B · Motivo · acción "Unificar" (solo admin) · cubre
  RF-11, RF-12 · Done: con un `check` de prueba con 2 items, se renderizan 2 filas/tarjetas con el motivo traducido.
- [ ] T-F7 · `openMergeDialog(pair, {onMerged})` en el mismo componente: modal para elegir qué ficha conserva el
  nombre, llama `api.mergePlayers`, toast de éxito, recarga el check · `frontend/js/components/identity-merge.js` ·
  cubre RF-11 · Done: confirmar la fusión en el modal deja de listar el par en la siguiente carga del check.
- [ ] T-F8 [P] · Sección CSS `/* ── identity-merge (C-08) ── */` (tabla de pares, modal, tarjetas apiladas
  < 768 px) · `frontend/css/style.css` · cubre RF-11, RF-12 · Done: a 360 px el panel de duplicados y el modal se
  usan sin scroll horizontal.

### Grupo G — Errores, estados vacíos, offline/SW
- [ ] T-G1 · Estados de UI de §6 del spec (loading/vacío/error/sin conexión del panel "Posibles duplicados" y del
  modal de fusión) · `frontend/js/components/identity-merge.js` · cubre RF-12 · Done: cada estado muestra el copy
  exacto listado en el spec.
- [ ] T-G2 · `frontend/sw.js`: agregar `js/components/identity-merge.js` a `STATIC` y subir `CACHE` al siguiente
  entero · cubre RF-12 · Done: `STATIC` incluye el archivo nuevo y `CACHE` cambió de versión.
- [ ] T-G3 · Mensajes 400/403/404/409 de §9 del plan se muestran en la UI (toast o mensaje inline) en sus
  respectivos flujos · `frontend/js/app.js` / `identity-merge.js` · cubre RF-11 · Done: forzar cada código desde
  DevTools (o con datos de prueba) muestra el mensaje en español correspondiente.

### Grupo H — Verificación de feature
- [ ] T-H1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-H2 · Arrancar el backend (`python backend/app.py`) dos veces seguidas sin error: `upgrade_db()` (columnas e índice nuevos)
  y `backfill_player_ids()` idempotentes (la 2.ª vez asigna 0 filas). Nota: `python backend/database.py` solo corre `init_db`
  (`create_all`), no `upgrade_db()`.
- [ ] T-H3 · Cada endpoint nuevo/tocado probado con curl o `app.test_client()`; shape verificado contra §3.2 del plan.
- [ ] T-H4 · Consola del navegador sin errores JS al recorrer Buscador, Equipo (plantel, mapa, ON/OFF, combinación) y
  Jugador.
- [ ] T-H5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`.
- [ ] T-H6 (CA-1, CA del cliente) · Sobre una copia de la base con un duplicado inyectado (dos grafías del mismo
  jugador, mismo equipo), correr `backfill_player_ids()` y verificar con `app.test_client()` que el total de fichas
  activas (`merged_into IS NULL`) es menor que el total de pares `(equipo, nombre crudo)` distintos, y que ningún
  equipo tiene dos filas con el mismo `display_name` normalizado en `GET /api/search/players` ni en
  `GET /api/players/<team>`.
- [ ] T-H7 (CA-2) · `curl http://localhost:5000/api/search/players` sobre la base con el duplicado: una sola fila con
  `games` = suma de partidos de ambas grafías y un único `player_id`.
- [ ] T-H8 (CA-3) · Con un jugador con posiciones `["", "PF"]` en dos partidos, verificar `player_card` →
  `position == "PF"`; con `[G, "", PG, G]` → `"G"` en dos llamadas seguidas (determinismo).
- [ ] T-H9 (CA-4) · Filtro de posición `F` en el buscador: `curl .../api/search/players` + filtro en el navegador
  muestra solo jugadores con `position_group == "F"`.
- [ ] T-H10 (CA-5) · Con las dos grafías de un jugador, consultar perfil, mapa de tiro, ON/OFF y una combinación que
  lo incluya usando cada grafía por separado: los cuatro incluyen todos sus partidos/tiros/eventos.
- [ ] T-H11 (CA-6) · `curl http://localhost:5000/api/player/<player_id>` devuelve el mismo shape que el perfil por
  nombre + `player_id`; con un id inexistente → 404 `"Jugador no encontrado"`.
- [ ] T-H12 (CA-7) · Sobre la base real del seed (sin duplicados de grafía), correr `backfill_player_ids()` dos
  veces: la cantidad de fichas = cantidad de pares `(equipo, nombre normalizado)`; la segunda corrida no crea fichas
  nuevas ni cambia estadísticas del buscador respecto de `dev`.
- [ ] T-H13 (CA-8) · Con dos fichas inyectadas del mismo equipo ("J. Feldeine" id A, "Jerome Feldeine" id B), un
  admin fusiona (target A, source B) vía `POST /api/identity/merge`: el buscador muestra una fila con la suma de
  partidos, `GET /api/player/<B>` devuelve la ficha A, y el panel de calidad deja de listar el par.
- [ ] T-H14 (CA-9) · Fusión entre fichas de equipos distintos → 409 `"Solo se pueden unificar fichas del mismo
  equipo"`; con un usuario no admin (`ADMIN_USERS` definida) → 403.
- [ ] T-H15 (CA-10) · Con un par candidato inyectado (mismo equipo, nunca en el mismo partido, mismo dorsal o mismo
  apellido con inicial compatible), `GET /api/data-quality` lista el par en "Posibles duplicados" con el motivo; un
  par con misma clave normalizada pero `first_name`/`family_name` distintos aparece como "posible fusión incorrecta".
- [ ] T-H16 (CA-11) · Importar (o reprocesar) un partido nuevo de un jugador existente con otra grafía: sus filas
  quedan asociadas a la ficha existente sin crear una nueva (`backfill_player_ids` posterior devuelve 0 para ese
  jugador).
- [ ] T-H17 (CA-12) · Recorrer Buscador, Equipo (plantel, mapa, ON/OFF, combinación) y Jugador sin errores JS en
  consola; a 390 px de ancho, el filtro de posición y el modal de fusión se usan sin scroll horizontal.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-B1, T-B4, T-C2, T-D2, T-D5, T-H6 |
| CA-2 | T-D2, T-D5, T-H7 |
| CA-3 | T-B2, T-B12, T-H8 |
| CA-4 | T-B3, T-F1, T-H9 |
| CA-5 | T-B9, T-D6, T-D7, T-D8, T-H10 |
| CA-6 | T-D3, T-H11 |
| CA-7 | T-B8, T-C2, T-H12 |
| CA-8 | T-B14, T-D9, T-H13 |
| CA-9 | T-D9, T-H14 |
| CA-10 | T-B13, T-C3, T-H15 |
| CA-11 | T-C1, T-B7, T-H16 |
| CA-12 | T-F1…T-F8, T-H17 |

## Dependencias externas
- C-11 Grupo 0 (integración de `dev`, `norm_name`/`resolve_identity` de lectura) debe estar mergeado antes de
  empezar: C-08 mueve esas funciones a `identity.py`, no las reescribe.
- F-11 (ya implementado en la rama `v2`) aporta: `ingest.persist_game` (hook de `assign_game`), `competitions.resolve`,
  `_visible`, `app._team_pbp_games`, `data_quality.report`, `auth.admin_required`, `GET /api/competitions` con ids. F-11 **no**
  aportó (difirió) `repository.py`, `cache.py`/`data_version`, `register_check` ni las columnas de nombre completo/foto: C-08
  usa lo existente y agrega las columnas (T-A2b, T-C0).
- Tras desplegar: reprocesar cada competencia (Datos → Calidad) para poblar nombre completo y foto; sin eso la detección de
  "posibles fusiones incorrectas" queda vacía (los candidatos por apellido/dorsal funcionan igual).
- Dataset de verificación: los 13 partidos del seed **no tienen duplicados de grafía** (verificado en `dev`: 74 =
  74 fichas). CA-1, CA-2, CA-5, CA-8, CA-10 se verifican sobre una **copia** de la base con un duplicado inyectado a
  mano (documentado como tal en `progress.md`, no como cobertura end-to-end); CA-7 y CA-11 se verifican contra el
  seed real.
- `ADMIN_USERS` (variable de entorno opcional de F-11/DA-18) debe estar configurada para probar el camino 403 de
  CA-9; sin ella, todo usuario autenticado es admin y el escenario 403 se prueba simulando la ausencia de sesión de
  admin en el test.
