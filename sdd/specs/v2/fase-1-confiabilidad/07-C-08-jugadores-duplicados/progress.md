# Progress — C-08: Jugadores duplicados en el buscador

> **Estado:** ✅ Implementado (2026-10-07), rama `v2` — ver commit de implementación en `git log`.
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
Todas las tareas de [tasks.md](tasks.md) quedaron `[x]`. Las que se resolvieron distinto a lo planeado están en
"Desviaciones" (T-B1/T-B2, T-B8/T-B14, T-C2, T-G1, T-G3).

## Estado de CA (gate de aceptación)

Base de verificación: la base local del seed (13 partidos, 312 filas de jugador, 187 pares `(equipo, nombre crudo)`). **No tiene
duplicados de grafía**: CA-1, 2, 5, 8 y 10 se verificaron sobre **copias** con un duplicado inyectado a mano (procedimiento abajo),
no como cobertura end-to-end sobre datos reales. CA-7 y CA-11 se verificaron sobre el seed real.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Copia con `A. Agarbado` (OLI) renombrado a `A.  AGARBADO` en su 2.º partido (box, tiros y pbp). `backfill_player_ids()` lo asigna a la ficha existente: pares crudos **188** > fichas activas **187**; en buscador y plantel de OLI hay **una** ficha Agarbado. |
| CA-2 | ✅ | `GET /api/search/players` → 1 fila `A.  AGARBADO`, `games: 2`, `player_id: 34`. |
| CA-3 | ✅ | `identity.player_card` y buscador: posición `G` estable (la más frecuente entre las no vacías; 18 de 312 filas vienen sin posición). Lógica de `resolve_identity` (desempate por reciente) heredada de `dev` sin cambios. |
| CA-4 | ✅ | Navegador: filtro "Alero/Ala-pívot (F)" → 85 jugadores, posiciones vistas `F` y `PF`, ninguno sin posición. |
| CA-5 | ✅ | Con las tres grafías (`A. Agarbado`, `A.  AGARBADO`, `a. agarbado`): perfil → `player_id 34`, 2 partidos; mapa de tiro → 18 tiros (suma de ambas grafías); ON/OFF → on 87,0 / off 88,0 posesiones; combinación con la variante → 60,6 posesiones, idéntica con la grafía original. |
| CA-6 | ✅ | `GET /api/player/34` == `GET /api/player/OLI/A. Agarbado` (JSON idéntico, incluye `player_id`, `position`, `position_group`); `GET /api/player/999999` → 404 `{"error": "Jugador no encontrado"}`. |
| CA-7 | ✅ | Seed real: 312 filas, 0 sin `player_id`, **187 fichas = 187 pares**; segunda corrida de `backfill_player_ids()` → 0; buscador devuelve 187 jugadores como antes. |
| CA-8 | ✅ | Par real del seed (STO): `R. Rodrigues` (57) y `R. Alberton Rodrigues` (180), mismo dorsal 21, nunca en el mismo partido. `POST /api/identity/merge {target 57, source 180}` → 200, `rows_moved: 1`, 2 partidos; `GET /api/player/180` devuelve la ficha 57; buscador: una fila (2 PJ); el par desaparece del panel. En el navegador: modal → toast "Fichas unificadas: R. Alberton Rodrigues ahora suma 2 partidos" y el panel queda en 0. |
| CA-9 | ✅ | Equipos distintos → 409 `"Solo se pueden unificar fichas del mismo equipo"`; misma ficha → 400; id inexistente → 404; con `AUTH_USERS` + `ADMIN_USERS=ana`: sin sesión 401, `bob` 403, `ana` pasa el permiso. |
| CA-10 | ✅ | Panel lista 2 candidatos reales del seed: `L. Cabrera`/`I. Cabrera` (ALB, `dorsal_apellido`) y `R. Rodrigues`/`R. Alberton Rodrigues` (STO, `apellido_inicial`). Con nombres completos distintos inyectados en una ficha → `posible_fusion_incorrecta / nombre_completo_distinto`. |
| CA-11 | ✅ | Reprocesados los 13 partidos desde FIBA (`ingest.reprocess_games`): fichas 187 → 187, 0 filas sin `player_id`; `ingest_version` 3 en todos; nombre 312/312, apellido 312/312, foto 262/312. |
| CA-12 | ✅ | Chromium headless (1200 px y 390 px): recorrido Buscar → Equipo (plantel, mapa, ON/OFF, combinación) → Jugador por id → Calidad → fusión sin errores de consola ni `pageerror`; en 390 px desborde horizontal 0 px en Buscar, Calidad y modal. |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente (incluye `backfill_player_ids`): ✅ (la 2.ª corrida asigna 0 filas; `CREATE INDEX IF NOT EXISTS`)
- Endpoints probados manualmente: ✅ (`app.test_client()`: players, player por id y por nombre, shots, onoff, lineup, search con y sin `competition`, merge 200/400/401/403/404/409, data-quality)
- Consola del navegador sin errores JS: ✅
- `python backend/test_auth.py`: ✅ (sin regresión)

## Procedimiento de inyección (para repetir CA-1/2/5)
Sobre una copia de la base (`DB_PATH=<copia>`): `UPDATE player_game_stats / shots / pbp_events SET player_name='A.  AGARBADO'
WHERE game_id='2849347' AND team_code='OLI' AND player_name='A. Agarbado'` y `UPDATE player_game_stats SET player_id=NULL` de esa
fila; arrancar la app (el arranque completa `player_id`). El par STO/ALB de CA-8/CA-10 ya existe en el seed.

## Desviaciones respecto a docs/ o plan
- **T-B1/T-B2 — `norm_name` y `resolve_identity` se quedan en `stats_engine.py`** (módulo puro, sin DB); `identity.py` los
  re-exporta. El plan los movía a `identity.py` con re-export en `stats_engine`; mover no aportaba nada y obligaba a que
  `stats_engine` importe `database`. Los imports existentes no cambian.
- **T-B8/T-B14 — sin `data_version`:** F-11 difirió `cache.py`; no hay nada que invalidar (RF-13 se cumple por no cachear).
- **T-C2 — el arranque llama `backfill_player_ids()`** dentro del `app_context`, junto a `competitions.backfill()` (como
  decía el plan §1; la tarea del `tasks.md` original mencionaba `upgrade_db()`).
- **Regla `foto_distinta` descartada** del panel: FIBA cambia la URL de la foto de la misma persona entre partidos (23 de 187
  fichas del seed lo mostraban) y el aviso era ruido. Se conserva `photo_url` en `players` para F-16. `nombre_completo_distinto` sí.
- **403 de la fusión** usa el mensaje común de `admin_required` ("Tu usuario no tiene permiso para esta acción."), no el copy
  propio del spec ("Necesitás permisos de administrador para unificar jugadores"): se mantuvo el comportamiento de todas las
  rutas de escritura de F-11.
- **Formato de error `{error}` sin `code`** (el de F-11); la arquitectura §7.8 previa `code`, que F-11 no adoptó.
- **El modal "Conservar A / B" elige qué `player_id` sobrevive**, no el nombre mostrado: `display_name` siempre es la grafía del
  partido más reciente (RF-6), también tras una fusión (el toast del CA-8 mostró `R. Alberton Rodrigues` por eso).
- **T-G1:** el estado "Buscando posibles duplicados…" no es separado: el panel se dibuja con el informe completo de la pestaña
  (que ya muestra su propio "Revisando la competencia…"). Los estados vacío, éxito y error de fusión sí están; el offline se mapea
  a `"Sin conexión: no se puede unificar ahora"` ante un `TypeError` de `fetch`.
- **T-G3:** los errores 400/403/404/409 de la fusión llegan al toast con el mensaje del backend (`api.js` propaga `error`).
- **`INGEST_VERSION` 2 → 3:** el panel marca todos los partidos del seed "pendientes de reproceso" hasta reprocesar (se reprocesó
  la copia de verificación; la base real del usuario debe reprocesarse desde Datos → Calidad).
- **Cambios visibles menores (plan D-5):** `GET /api/shots/<team>/<nombre inexistente>` pasa de 200 vacío a 404; `GET
  /api/lineup/<team>` con un nombre inexistente pasa a 400 `"Jugador no encontrado: <nombre>"`.

## Docs a actualizar
- [x] `docs/database.md` — tabla `players`, columnas nuevas de `player_game_stats`, identidad persistente
- [x] `docs/api.md` — `GET /api/players/<team>` (objetos + `player_id`, filtro `competition`), `GET /api/player/<player_id>`, `GET /api/search/players`
  (`player_id`, `position_group`, `competition_ids`, filtro), shots/lineup/onoff por ficha, `possible_duplicates`, `POST /api/identity/merge`
- [x] `docs/frontend.md` — buscador (grupos G/F/C), select de jugador por `player_id`, panel de duplicados y fusión
- [x] `docs/architecture.md` — módulo `identity.py`
- [x] `CLAUDE.md` — gotcha de identidad (el archivo está en `.gitignore`)

## Deuda / TODO
- **Reprocesar** cada competencia en producción (Datos → Calidad) para poblar nombre completo y foto; sin eso no se detectan
  "posibles fusiones incorrectas" (los candidatos por apellido/dorsal funcionan igual).
- Separar una ficha fusionada por error (des-fusión) desde la UI queda fuera de alcance: es reversible por datos (`merged_into = NULL`
  en la ficha absorbida y `player_id = <ella>` en las filas cuyo `(equipo, nombre normalizado)` coincide con su `norm_key`).
- `shots` y `pbp_events` no tienen `player_id`: se resuelven por alias (`identity.aliases` / `name_index`). Si T-03 necesita filtrar
  eventos por ficha a gran escala, evaluar agregarlo.
- Navegación por hash con `player_id` (X-01) y filtros `on`/`off` por id (T-03): fuera de alcance de C-08.
