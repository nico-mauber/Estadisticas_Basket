# Progress — C-04: AS/PER (asistencias sobre pérdidas)

> **Estado:** ✅ Implementado (2026-10-07), rama `v2`. Pendientes solo los incrementos diferidos (T-G1 → C-02, T-G2 → T-01).
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
Todas `[x]` salvo T-G1 (`Ø` de AS/PER → C-02) y T-G2 (percentil y ficha → T-01), diferidas por diseño. T-D1 (parche transitorio de
`_computeAvg`) **se aplicó** porque C-02 todavía no está cerrado.

## Estado de CA (gate de aceptación)
Base de verificación: los 13 partidos del seed (copia con los 13 reprocesados, `INGEST_VERSION` 3). Servidor Flask real + Chromium headless.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Box persistido (lectura de solo lectura de la base, igual que el box de FIBA): Olimpia `[(2849329, AS 25, PER 9), (2849347, 18, 20)]` → `ΣAS 43 / ΣPER 29 = 1,4828`; M. Perdomo `[(12, 1), (2, 6)]` → `14 / 7 = 2,0000`. La app muestra `1,48 (43/29)` y `2,00 (14/7)`. Verificado contra la API (`averages.ast_to` 1.4828 / 2.0, `totals` 43/29 y 14/7). |
| CA-2 | ✅ | Pantalla: Olimpia `1,48`, Perdomo `2,00`. La media de ratios por partido daría `1,84` y `6,17` (no aparecen). |
| CA-3 | ✅ | Equipo (card "Rebotes & Misc") `AS/PER 1,48 (43/29)`; Jugador (card "Rebotes & distribución") `AS/PER 2,00 (14/7)`. Tabaré: `33/29 = 1,1379`. |
| CA-4 | ✅ | J. Lamas (COL): caja `AS/PER —` con `title` "Sin pérdidas: el cociente no está definido"; API `averages.ast_to = null`, `null_reasons.ast_to = "sin_perdidas"`, `totals {ast: 1, tov: 0}`; el JSON no contiene `99.0` ni `Infinity`. |
| CA-5 | ✅ | (a) Con una 2.ª competencia creada en una copia (`POST /api/competitions` + `PATCH /api/games/2849329`), Equipo → Olimpia → filtro "Liga de Ascenso 2026" deja un solo partido: `AS/PER 0,90 (18/20)` (ΣAS/ΣPER de la selección). (b) Prueba directa de `_computeAvg` con `[{ast 25, tov 9}, {ast 18, tov 20}]` → `1,4828` y `totals {43, 29}` (la media de ratios daría `1,8389`); con `tov = 0` → `null` + `sin_perdidas`. El seed no permite una selección filtrada de ≥ 2 partidos para un equipo (2 partidos por equipo), por eso se cubre con (b). |
| CA-6 | ✅ | DevTools: la caja tiene clase `stat-value neutral` y no tiene `.stat-context` (sin `Ø` ni color) en Equipo y Jugador. El `Ø` queda para C-02. |
| CA-7 | ✅ | Game log del jugador: `12,00` / `0,33` (Perdomo, valores de cada partido) y de equipo `2,78` / `0,90` (API `game_log[].ast_to` 2.7778 / 0.9), distintos del acumulado de la card. |
| CA-8 | ✅ | Comparar Olimpia vs Tabaré: fila `AS/PER` `1,48 [winner]` / `1,14 [loser]`. El helper `winCls` devuelve `""` si falta un lado (código existente). |
| CA-9 | ✅ | Buscador, columna "AS/PER": descendente `9,00 · 7,00 · 5,50 … —`, ascendente `0,00 … —`; los 79 nulos quedan al final en ambos sentidos. |
| CA-10 | ✅ | Recorrido Equipo → Jugador → Comparar → Buscador sin errores de consola ni `pageerror`; a 360 px, desborde horizontal de página 0 px en Equipo y Buscador. |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: N/A (sin cambio de esquema)
- Endpoints probados manualmente: ✅ (`app.test_client()` sobre la copia: `/api/team/OLI`, `/api/team/TAB`, `/api/player/OLI/M. Perdomo`, `/api/player/COL/J. Lamas`, `/api/search/players`; `calc_team_stats` con y sin pérdidas)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- Ninguna de contrato. Se ejecutó **antes** de C-02 (orden de carpeta), por lo que se aplicó la tarea transitoria T-D1 (parche de
  `_computeAvg`); C-02 la descarta al mover la selección al backend.
- La caja se factorizó en un helper local `_astPerBox(av, totals, lg)` (el plan la describía inline en dos lugares).
- Observación de verificación (no es un bug del producto): `renderCompare` registra el handler del botón después de cargar los
  selectores; un clic inmediato al entrar en Comparar (antes de ~1 s) se pierde. Se esperó 1,2 s en el script de prueba.

## Docs a actualizar
- [x] `docs/metrics.md` — definición única de AS/PER (fila de la tabla y nota)
- [x] `docs/api.md` — `totals.ast`/`totals.tov`, `game_log[].ast_to` de equipo, nota de semántica de `ast_to`
- [x] `docs/frontend.md` — caja AS/PER, columnas de game log, Comparar, Buscador, `_computeAvg`

## Deuda / TODO
- `Ø` y color de AS/PER: se habilitan cuando C-02 agregue `ast_to` a la población de liga (la caja ya pasa `leagueKey "ast_to"`).
- Percentil y ficha de métrica: T-01. Mínimo de muestra (un jugador con 1 pérdida mueve mucho el valor): T-02.
