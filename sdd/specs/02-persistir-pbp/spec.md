# Spec — Feature 02: persistir play-by-play (fundación de lineups / on-off / clutch)

> **Fundación compartida.** Las features 03 (lineups), 04 (on/off) y 05 (clutch) NO se pueden construir sin esto: hoy el sistema descarta el play-by-play de FIBA y solo guarda box score agregado + tiros. Esta feature persiste el pbp para que las tres siguientes tengan de dónde leer. No entrega UI propia (salvo un endpoint de verificación).

## 1. Objetivo
Persistir el play-by-play (pbp) de cada partido importado desde FIBA LiveStats — eventos con jugador, equipo, período, reloj y marcador corrido — para habilitar el análisis de combinaciones en cancha (lineups), rendimiento con/sin jugador (on/off) y cierres de partido (clutch).

## 2. Fuentes (trazabilidad)
- `docs/database.md` §`shots` — hoy es la única tabla derivada del pbp; se guardan solo eventos `2pt`/`3pt`. El resto del pbp se descarta.
- `docs/architecture.md` §Data Flow — `fiba_fetcher.py` parsea JSON → `database.py` almacena → `stats_engine.py` deriva on-the-fly.
- `backend/fiba_fetcher.py` `_parse_fiba_json()` — confirmado por lectura de código + fetch real (`data.json` del juego FUBB 2849328): `raw["pbp"]` es una lista de **555 eventos** con `actionType ∈ {game, period, rebound, 3pt, turnover, freethrow, substitution, foulon, foul, assist, 2pt, timeout, steal, block, jumpball}`. Cada evento trae: `gt` (reloj MM:SS que cuenta hacia abajo dentro del período), `clock` (MM:SS:CC), `s1`/`s2` (marcador corrido local/visitante), `lead`, `tno` (número de equipo 0/1), `period`, `periodType` (`REGULAR`/`OT`), `pno`, `player`, `shirtNumber`, `success`, `subType`, `scoring`, `actionNumber`, `previousAction`, `qualifier`.
- `backend/fiba_fetcher.py` — `tm[n].pl[pid].starter` (0/1) confirmado en fetch real: identifica los 5 titulares iniciales de cada equipo (necesario para reconstruir quién arranca en cancha).
- `docs/database.md` §"Inicialización y migración" — cambios de esquema vía `upgrade_db()` (`ALTER TABLE ADD COLUMN` idempotente) / `db.create_all()` para tablas nuevas.
- Constitución regla 5 (esquema vía `upgrade_db()`, sin migración destructiva) y regla 4 (métricas on-the-fly, nunca persistidas).

## 3. Historias de usuario
- US-1: Como entrenador/analista, quiero que al importar un partido se guarde su play-by-play completo, para poder analizar más adelante quién estaba en cancha y en qué momento (habilita lineups, on/off y clutch).
- US-2: Como usuario que ya importó partidos antes de esta feature, quiero poder reimportar esos partidos y que se complete su play-by-play sin duplicar ni romper los datos existentes, para no perder el histórico.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE, al parsear un partido, extraer del array `raw["pbp"]` **todos** los eventos (no solo `2pt`/`3pt`) y normalizarlos a filas con: equipo (`team_code` derivado de `tno`), jugador (`player_name` derivado de `shirtNumber`+`tno`, vacío si el evento no es de jugador), `period`, `period_type`, reloj restante en segundos, marcador local/visitante tras el evento, `action_type`, `sub_type`, `success`, `action_number`. · (US-1, `fiba_fetcher.py` `_parse_fiba_json`) · Regla de derivación de `team_code`/`player_name`: reusar los mapas `tno_to_code` y `shirt_to_name` ya construidos en `_parse_fiba_json`.
- RF-2: El sistema DEBE convertir el reloj `gt` (`"MM:SS"`, tiempo restante en el período) a segundos restantes enteros (`clock_secs = MM*60 + SS`), para permitir filtros temporales (ej. clutch = últimos 5:00). · (US-1, fuente §2 campo `gt`)
- RF-3: El sistema DEBE persistir el play-by-play en una tabla NUEVA `pbp_events`, de forma idempotente: reimportar el mismo partido no duplica filas (upsert/insert-or-ignore por `(game_id, action_number)`, mismo patrón que `shots`). · (US-2, `docs/database.md` §shots restricción única, Constitución 5)
- RF-4: El sistema DEBE marcar por cada jugador si fue titular (`starter`) en ese partido, tomándolo de `tm[n].pl[pid].starter`, para poder reconstruir el quinteto inicial. · (US-1, fuente §2 `starter`) · Se persiste como columna NUEVA `starter` en `player_game_stats` (0/1), vía `upgrade_db()`.
- RF-5: El sistema DEBE exponer un endpoint de solo-lectura para verificar el pbp persistido de un partido (conteo por tipo de acción + primeros/últimos eventos), para poder validar la importación sin inspeccionar la DB a mano. · (US-1) · Endpoint NUEVO `GET /api/pbp/<game_id>` (marcado NUEVO).
- RF-6: El parseo del pbp NO DEBE alterar el comportamiento existente de la tabla `shots` ni del box score: las mismas filas de tiros se siguen guardando igual (esta feature agrega datos, no reemplaza). · (US-1, US-2, `docs/database.md` §shots)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events` | tabla | `id` PK; `game_id` FK→games; `team_code` TEXT (vacío si evento no-equipo); `player_name` TEXT (vacío si no-jugador); `period` INT; `period_type` TEXT (`REGULAR`/`OT`); `clock_secs` INT (segundos restantes en el período); `s1` INT / `s2` INT (marcador local/visitante corrido); `action_type` TEXT; `sub_type` TEXT; `success` INT; `action_number` INT. Restricción única `(game_id, action_number)`. Relación con cascade delete como el resto (borrar Game borra sus pbp_events). | **NUEVO** (tabla) — irá a `docs/database.md` al cerrar |
| `player_game_stats.starter` | columna | INTEGER DEFAULT 0 (1=titular). Vía `upgrade_db()` (`ALTER TABLE ADD COLUMN`). | **NUEVO** (columna) |
| `GET /api/pbp/<game_id>` | endpoint | Response: `{ "game_id": "...", "events": <int>, "by_action_type": {"2pt": 95, "rebound": 103, ...}, "first": {...}, "last": {...} }`. `404` si el partido no existe o no tiene pbp. | **NUEVO** (endpoint) — irá a `docs/api.md` |

Sin cambios a la firma de `POST /api/import` ni a su response (sigue devolviendo `{ok, game_id, teams}`); el pbp se persiste como efecto de la importación.

## 6. Estados de UI
Esta feature es de datos + endpoint de verificación; **no agrega vista ni componente de UI**. Sin estados loading/vacío/error de frontend nuevos.
- El endpoint `GET /api/pbp/<game_id>` con partido sin pbp (importado antes de esta feature, no reimportado) responde `404 {"error": "Partido sin play-by-play. Reimportá el partido."}` (copy nuevo, a agregar a `docs/api.md`).
- Service Worker: sin cambio — `/api/pbp/*` cae bajo la regla existente `/api/*` = siempre red, nunca caché.

## 7. Criterios de aceptación
- CA-1: Given un partido FUBB reimportado tras esta feature (ej. game_id `2849328`), When se consulta `GET /api/pbp/2849328`, Then `events` es > 500 y `by_action_type` incluye al menos `substitution`, `rebound`, `assist`, `steal`, `block`, `2pt`, `3pt`, `freethrow`, `turnover`.
- CA-2: Given ese mismo partido, When se inspecciona cualquier fila `substitution` de `pbp_events`, Then tiene `team_code` no vacío, `player_name` no vacío, `sub_type ∈ {"in","out"}` y `clock_secs` entre 0 y la duración del período en segundos.
- CA-3: Given un partido ya importado, When se reimporta (`POST /api/import` con la misma URL), Then el conteo de filas en `pbp_events` para ese `game_id` es idéntico antes y después (idempotencia por `(game_id, action_number)`).
- CA-4: Given la DB inicializada dos veces seguidas (`python backend/database.py` ×2), When arranca `app.py` (`upgrade_db`), Then no hay error y la columna `player_game_stats.starter` existe (idempotencia del `ALTER TABLE ADD COLUMN`).
- CA-5: Given un partido reimportado, When se cuentan las filas de `shots` para ese partido antes y después, Then el conteo no cambia (esta feature no toca `shots`).
- CA-6: Given un jugador que arrancó de titular en un partido, When se lee su fila en `player_game_stats`, Then `starter = 1`; para un suplente, `starter = 0`.

## 8. Fuera de alcance (documentado para features siguientes)
- **Reconstrucción de quintetos en cancha** (qué 5 jugadores están juntos en cada instante) — es lógica de `stats_engine`/módulo nuevo que consume `pbp_events`; pertenece a Feature 03 (lineups) y 04 (on/off), no a esta.
- **Cálculo de métricas por stint/lineup/on-off/clutch** — Features 03/04/05.
- **Re-importación masiva de los partidos ya existentes** — los 4 partidos en la DB actual no tienen pbp hasta reimportarse; el reimport es una acción del usuario (o vía `POST /api/seed` en dev), no automática. Documentar en `progress.md` como precondición de datos de 03/04/05.
- **Coordenadas de tiro desde `tm[n].shot`** — se detectó que existe un array `shot` a nivel de equipo (`tm[n].shot`) además del top-level; explorar si trae coordenadas reales para FUBB es tema de una feature separada (relacionada con Feature 01), no de ésta.
- **Persistir `clock` con centésimas** — se guarda solo `clock_secs` (segundos enteros); la precisión de centésimas no la necesita ninguna feature MVP.

## 9. Ambigüedades
- [RESUELTA] ¿Guardar `clock_secs` como restante-en-período o como tiempo-transcurrido-total? → **Decisión:** restante-en-período (mapeo directo de `gt`, sin depender de `periodLength`). El filtro de clutch (Feature 05) se expresa como `period == último ∧ clock_secs <= 300`, que no requiere tiempo total. Justificación: menos supuestos sobre duración de período/OT; `gt` ya viene listo.
- [RESUELTA] ¿`team_code` en eventos sin equipo (ej. `actionType: "game"`/`"period"` con `tno: 0`)? → **Decisión:** `tno` 0 en esos eventos es ruido de FIBA; se guarda `team_code = ""` (vacío) y esos eventos se ignoran en features de análisis. No se filtran al persistir (se guarda el pbp íntegro para trazabilidad), pero las features 03/04/05 filtran por `action_type` relevante.
- [RESUELTA] ¿Nombre del jugador consistente entre `pbp` y `player_game_stats`? → **Decisión:** derivar `player_name` del pbp con el mismo mapa `shirt_to_name[(tno, shirtNumber)]` que ya usa el parser para tiros, garantizando que coincida con `player_game_stats.player_name`. Fallback al campo `player` del evento si no hay match de camiseta (registrar el caso en `progress.md` si ocurre).
