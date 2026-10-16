# Plan — C-04: AS/PER (asistencias sobre pérdidas)

> **ID:** C-04 · **Prioridad:** P1 · **Fase y orden:** 1·08 (se recomienda ejecutarlo después de C-02, ver §10 D-1)
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)) · **Habilita:** T-05 ([../13-T-05-conjunto-estandar-metricas/plan.md](../13-T-05-conjunto-estandar-metricas/plan.md)) · el `Ø` lo completa C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 C-04 · Arquitectura §2.1, §2.2, §3.5, §7.4
> **Estimación:** S · 2–3 h

## 1. Enfoque
La definición (acumulado `ΣAS/ΣPER`, nulo `sin_perdidas`) ya está implementada en el backend por la Feature 15 y C-11
(`stats_engine.season_ast_to`, usada por `team_stats`, `player_stats` y `search_players`). C-04 es un delta de **cierre y
presentación**, sin esquema ni endpoints nuevos:
1. **Backend**: `calc_team_stats` pasa a devolver `ast_to` por partido (hoy solo lo hace `calc_player_stats`) y las respuestas de
   equipo y jugador agregan `totals.ast` y `totals.tov` de la selección para poder reproducir el cociente.
2. **Frontend**: AS/PER aparece en el perfil de equipo, se rotula igual en jugador, se arregla la comparación contra un
   promedio de otra métrica (`leagueKey "ast_ratio"`), se agrega la columna al game log, a Comparar y al Buscador, y la caja
   muestra los totales "(43/29)".
3. **Criterio bajo filtro**: se corrige el único lugar donde el criterio se rompe, `_computeAvg` (filtro de competencia / últimos
   N en el cliente). Es un parche transitorio: C-02 elimina `_computeAvg` al mover la selección al backend.
4. **Documentación**: la definición queda escrita en `docs/metrics.md`; el plan trae el procedimiento de verificación manual
   contra el box score con un equipo y un jugador reales (§10.1).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | service | `calc_team_stats`: clave `ast_to = _safe_div(ast, tov)` por partido; `season_ast_to` sin cambio (docstring: "definición única de AS/PER") | RF-1, RF-3, RF-6 |
| `backend/app.py` | route | `team_stats` y `player_stats`: `totals` agrega `ast` y `tov` (Σ de la selección; jugador: partidos jugados). Sin lógica nueva | RF-5 |
| `frontend/js/app.js` | js-view | `_computeAvg`: `ast_to` y `def_to_ratio` con razón `sin_perdidas`, y `totals {ast, tov}` del subconjunto (transitorio, ver D-1); `_renderTeamContent`: caja AS/PER; `_renderPlayerContent`: rótulo y `leagueKey`; columna AS/PER en ambos game logs (y `colspan` de la fila DNP); fila AS/PER en Comparar (`rawRow` con `fmt`); columna AS/PER en `SEARCH_COLS` | RF-2, RF-4, RF-5, RF-6, RF-7, RF-8, RF-9 |
| `frontend/sw.js` | sw | Subir `CACHE` al siguiente entero (hoy `smart-basket-v13`; el número se asigna al integrar). No hay archivos nuevos que sumar a `STATIC` | todos (assets) |
| `docs/metrics.md` | doc (cierre) | §"Pérdidas y asistencias": definición única de AS/PER (rótulo, PER = pérdidas, acumulado, valor por partido, nulo) | RF-10 |
| `docs/api.md` | doc (cierre) | `totals.ast`/`totals.tov`; `game_log[].ast_to` de equipo; fila AS/PER en la tabla de `null_reasons` si corresponde | RF-5, RF-6 |
| `docs/frontend.md` | doc (cierre) | Cards "Rebotes & Misc" (equipo) y "Rebotes & distribución" (jugador): caja AS/PER; `_computeAvg` (transitorio); columnas nuevas de game log, Comparar y Buscador | RF-4…RF-9 |

**Matriz RF → archivo:** RF-1 ✔ (stats_engine, app.py ya existente + `_computeAvg`) · RF-2 ✔ (app.js `_computeAvg`, Comparar, Buscador) ·
RF-3 ✔ (stats_engine `null_reason`, app.js) · RF-4 ✔ (app.js) · RF-5 ✔ (app.py `totals`, app.js) · RF-6 ✔ (stats_engine, app.js) ·
RF-7 ✔ (app.js) · RF-8 ✔ (app.js) · RF-9 ✔ (app.js) · RF-10 ✔ (docs/metrics.md). Sin RF huérfanos.

## 3. Backend — rutas y modelos
**Sin tablas ni columnas nuevas. Sin `upgrade_db()`. Sin endpoints nuevos.**

| Método + ruta | Cambio de C-04 | Errores |
|---|---|---|
| `GET /api/team/<team_code>` | `game_log[].ast_to` NUEVO (+ `game_log[].null_reasons.ast_to = "sin_perdidas"` cuando el partido tuvo 0 pérdidas); `totals` pasa de 6 a 8 claves: **`ast`, `tov` NUEVAS**; `averages.ast_to` sin cambio (ya `ΣAS/ΣPER`) | 404 "Equipo no encontrado" (existente) |
| `GET /api/player/<team_code>/<player_name>` · `GET /api/player/<int:player_id>` (C-08) | `totals.ast`, `totals.tov` NUEVAS (partidos jugados); `game_log[].ast_to` y `averages.ast_to` sin cambio | 404 "Jugador no encontrado" |
| `GET /api/search/players` | sin cambio (cada fila ya trae `ast_to` acumulado y `null_reasons.ast_to`) | — |

Ejemplo (`GET /api/team/OLI`, extracto; base local de 13 partidos):
```json
{
  "team_code": "OLI", "team_name": "OLIMPIA", "games": 2,
  "averages": {"ast": 21.5, "tov": 14.5, "ast_to": 1.4828},
  "totals":   {"fga2": "…", "fgm2": "…", "fga3": "…", "fgm3": "…", "fta": "…", "ftm": "…", "ast": 43, "tov": 29},
  "null_reasons": {},
  "game_log": [
    {"game_id": "2849329", "ast": 25, "tov": 9,  "ast_to": 2.7778},
    {"game_id": "2849347", "ast": 18, "tov": 20, "ast_to": 0.9}
  ]
}
```
(Los seis conteos de tiro de `totals` conservan sus valores reales; se abrevian con "…".) Partido sin pérdidas:
`"ast_to": null` y `"null_reasons": {"ast_to": "sin_perdidas"}`. Jugador sin pérdidas en la temporada: `"averages": {"ast_to": null}`,
`"null_reasons": {"ast_to": "sin_perdidas"}`, `"totals": {"ast": 1, "tov": 0}`.

## 4. Backend — lógica
| Función | Módulo | Firma / algoritmo | RF |
|---|---|---|---|
| `calc_team_stats(t, opp)` (mod.) | `stats_engine.py` | agrega al dict de retorno `"ast_to": _safe_div(t["ast"], t["tov"])` junto a `as_pct`/`ast_ratio`. `_safe_div` devuelve `None` con `tov == 0` (C-11/DA-07). `null_reason("ast_to")` ya devuelve `sin_perdidas` | RF-3, RF-6 |
| `calc_player_stats` | `stats_engine.py` | **sin cambio** (ya calcula `ast_to = _safe_div(ast, tov)` por partido) | RF-6 |
| `season_ast_to(total_ast, total_tov)` | `stats_engine.py` | **sin cambio** de código: `_safe_div(total_ast or 0, total_tov or 0)`. Se ajusta el docstring: "Definición ÚNICA de AS/PER (C-04): PER = pérdidas; acumulado de la selección" | RF-1 |
| `team_stats` (mod.) | `app.py` | `totals = {k: _sum(k) for k in ("fga2", "fgm2", "fga3", "fgm3", "fta", "ftm", "ast", "tov")}` (la lista de claves es config de la respuesta, no lógica) | RF-5 |
| `player_stats` (mod.) | `app.py` | idem sobre `played_log` | RF-5 |

Fórmula (copiada de `docs/metrics.md`): `AS/PER = AST_selección / TOV_selección`, con `AST_selección = Σ AST` y
`TOV_selección = Σ TOV` de los partidos de la selección (jugador: solo los **jugados**, `played(minutes)`). `null` si
`TOV_selección = 0`. **Manejo de nulos (C-11):** razón `sin_perdidas` (por partido y acumulado). Casos borde: `ΣAS = 0` y
`ΣPER > 0` → `0.0` real (se muestra `0,00`); `ΣAS = 0` y `ΣPER = 0` → `null` `sin_perdidas`; jugador sin partidos jugados →
`null` razón `dnp` (existente). No hay dependencia del play-by-play (box score): no aplica `sin_pbp`. Sin caché.

## 5. Frontend — capa API (api.js)
Sin métodos nuevos ni cambios: `api.team(code)`, `api.player(code, name)` y `api.searchPlayers()` ya devuelven los campos.
(C-02 les agrega `params`; no afecta a C-04.)

## 6. Frontend — UI
**Dónde vive.** Fase 1, antes de X-01: vistas `#sec-team` y `#sec-player`, Comparar `#sec-compare` y Buscador `#sec-search`. X-01
las reubica (pestañas `resumen`/`distribucion` de S3/S4) sin cambiar el contenido.

**Caja AS/PER** (reusa `statBox`, sin cambios de firma):
```
statBox('<span title="Asistencias sobre pérdidas, acumulado de la selección (PER = pérdidas)">AS/PER</span>',
        av.ast_to, DEC2(av.ast_to) + _ratioSub(totals.ast, totals.tov), "ast_to", lg, true, rs.ast_to)
```
- `_ratioSub(a, b)` (helper NUEVO local de `app.js`, 2 líneas): `<span style="font-size:9px;color:var(--muted)"> (${a}/${b})</span>`
  (mismo patrón que el "(total)" de `_shotDetailGrid`); devuelve `""` si alguno es `null`. `totals` = `av.totals ?? data.totals`
  (ver D-1: `_computeAvg` transitorio devuelve `totals` del subconjunto; sin filtro, el de la respuesta).
- Equipo: la caja va en la card "Rebotes & Misc", a continuación de `AS`. Jugador: reemplaza a `AST/TO` en "Rebotes & distribución"
  (se corrige `"ast_ratio"` → `"ast_to"`). Como `league_averages` no tiene `ast_to`, `lg.ast_to` es `undefined` y `statBox` no dibuja
  `Ø` ni color (`statClass` → `neutral`): cumple RF-7. Cuando C-02 agregue `ast_to` a la población, aparece `Ø` sin tocar esta línea.
- `isPct` de `statBox`: `"ast_to"` no contiene `pct`, `or_`, `dr_`, `to_` ni `as_` → formato decimal. Se agrega igualmente a `NOT_PCT`
  por prevención (la nota de `docs/frontend.md` lo recomienda).
- Nulo: `statBox` muestra `nullDisplay(rs.ast_to)` → "—" con `title` "Sin pérdidas: el cociente no está definido".

**Game logs.** Equipo: columna `AS/PER` a continuación de `TO%`: `<td>${c("ast_to", DEC2)}</td>` (el helper `c` ya usa
`fmtOrNull(g[k], f, g.null_reasons?.[k])`). Jugador: columna a continuación de `TOV`; la fila DNP sube su `colspan` de 11 a 12.
Encabezado con `title="AS/PER del partido"` para distinguirlo del acumulado de la card.

**Comparar.** `rawRow(label, va, vb, lowerBetter = false, fmt = DEC1)`; nueva fila `rawRow("AS/PER", a.ast_to, b.ast_to, false, DEC2)`
a continuación de la fila `PER`. `winCls` ya devuelve `""` si falta un lado.

**Buscador.** `SEARCH_COLS`: `{ key: "ast_to", label: "AS/PER" }` a continuación de `TOV`; el formateador existente usa `DEC2`
con `p.null_reasons?.ast_to`; el orden usa `_cmpNullsLast` (nulos al final en ambos sentidos).

**Estados.** loading/vacío/error/offline: los existentes de cada vista (sin estados nuevos). Mobile (<768 px): la caja entra en el
`stat-grid` existente; la columna extra del game log y del Buscador queda dentro de `.table-wrap` (scroll interno de la tabla, no
de la página). Copy sin `t()` (DA-21): español directo.

## 7. Navegación
Sin vistas ni rutas nuevas. En X-01 la caja vive en `#/equipo/<code>/resumen` y `#/jugador/<id>/distribucion` (slugs de Arquitectura §3.12).

## 8. Contratos de datos
```
GET /api/team/<code>
  game_log[i].ast_to : number | null      // AS/PER del partido; null con null_reasons.ast_to = "sin_perdidas"
  totals.ast, totals.tov : int            // Σ de la selección (aquí: todos los partidos del equipo)
  averages.ast_to : number | null         // ΣAS/ΣPER, sin cambio
GET /api/player/<team>/<name>  ·  GET /api/player/<int:player_id>
  totals.ast, totals.tov : int            // Σ de los partidos JUGADOS
```
Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
- Sin códigos HTTP nuevos; 404 como hoy (toast con `error`). `ast_to` nulo no es un error: se renderiza "—".
- `sw.js`: no se agregan archivos a `STATIC`, pero `app.js` cambia → **subir `CACHE`** (cache-first: sin el cambio de versión los
  clientes con el service worker instalado seguirían viendo el `app.js` viejo).

## 10. Riesgos / decisiones
- **D-1 · Orden con C-02 (recomendado: C-02 antes).** C-02 mueve la selección (competencia, últimos N) al backend y elimina
  `_computeAvg`; con eso el RF-2 bajo filtro es automático (el backend calcula `ΣAS/ΣPER` de la selección y devuelve `totals`
  de la selección). Si C-04 se ejecuta antes (orden de carpeta), la tarea T-D1 parcha `_computeAvg` (tres líneas, mismo patrón que
  `def_to_ratio` de C-11) y C-02 la descarta. Por eso T-D1 está marcada "(solo si C-02 no está)". Con C-02 cerrado, además,
  `totals` ya no se arma en las rutas sino en `aggregate_games` (`TOTAL_KEYS`): T-B2 y T-B3 se reducen a **agregar `"ast"` y `"tov"` a
  `TOTAL_KEYS`** de `stats_engine.py`, y `ast_to` por partido de equipo (T-B1) llega a `game_log` por `population.team_game_adv`.
- **D-2 · Sin `Ø` hasta C-02 (spec §9-A4).** Alternativa descartada: agregar `ast_to` a `league_averages`: el `Ø` sería la media
  de los ratios por partido (criterio distinto al del valor) y dejaría entrar partidos de 1 pérdida con ratios de 10.
- **D-3 · `totals` crece de 6 a 8 claves.** C-07 declara que "no agrega claves" a `totals`; no hay conflicto (C-04 agrega `ast`/`tov`,
  ver [C-07 plan §4](../10-C-07-detalle-tiro-completo/plan.md)). T-05 reemplaza `totals` por el bloque `standard`.
- **D-4 · `calc_team_stats` devuelve una clave más.** Los consumidores que recorren el dict (`league_averages`) ignoran claves
  que no están en su lista; `lineups.py`/`clutch.py` no usan `calc_team_stats`.
- **D-5 · `rawRow` gana un parámetro opcional.** Compatible con todas las llamadas existentes (`DEC1` por defecto).
- **Desviaciones respecto de la arquitectura:** ninguna de contrato. **Dependencias técnicas:** `stats_engine.season_ast_to` y
  `null_reason` (Feature 15 / C-11), `core/format.js` (`DEC2`, `fmtOrNull`, `nullDisplay`, `NULL_REASON_LABELS.sin_perdidas`)
  de [C-11](../01-C-11-tratamiento-de-nulos/plan.md); opcional [C-02](../11-C-02-promedios-de-liga/plan.md) (selección en backend y `Ø`)
  y [C-08](../07-C-08-jugadores-duplicados/plan.md) (`/api/player/<int:player_id>`, mismo builder).

### 10.1 Procedimiento de verificación manual del CA del cliente (equipo y jugador reales)
Dataset: los 13 partidos del seed ya importados en `backend/basketball.db` ("Liga de Ascenso 2026"). Servidor: `python backend/app.py`
(http://localhost:5000, modo abierto sin `AUTH_USERS`; con auth, `curl -c c.txt -X POST … /api/login` y `-b c.txt`).

1. **Fuente independiente (box score).** Abrir el box oficial de los partidos de Olimpia
   (`https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2849329/bs.html` y `…/2849347/bs.html`) y anotar las columnas AS y TO
   del total del equipo y de M. Perdomo. Alternativa sin red (mismos datos persistidos):
   ```
   python -c "import sqlite3;c=sqlite3.connect('file:backend/basketball.db?mode=ro',uri=True);\
   print(c.execute(\"select game_id,ast,tov from team_game_stats where team_code='OLI' order by game_id\").fetchall());\
   print(c.execute(\"select game_id,ast,tov,minutes from player_game_stats where team_code='OLI' and player_name='M. Perdomo' order by game_id\").fetchall())"
   ```
   Esperado: `[('2849329',25,9),('2849347',18,20)]` y `[('2849329',12,1,'27:21'),('2849347',2,6,'33:32')]`.
2. **Cálculo manual.** Equipo: `ΣAS = 25 + 18 = 43`, `ΣPER = 9 + 20 = 29` → `43 / 29 = 1,4828` (**1,48**). Jugador: `12 + 2 = 14`,
   `1 + 6 = 7` → `14 / 7 = 2,0000` (**2,00**). La media de los ratios por partido daría `1,84` y `6,17`: es la prueba de que el criterio
   es el acumulado.
3. **API.** `curl -s http://localhost:5000/api/team/OLI` → `averages.ast_to = 1.4828`, `totals.ast = 43`, `totals.tov = 29`,
   `game_log[].ast_to = 2.7778 / 0.9`. `curl -s "http://localhost:5000/api/player/OLI/M.%20Perdomo"` → `averages.ast_to = 2.0`,
   `totals.ast = 14`, `totals.tov = 7`.
4. **Pantalla.** Equipo → Olimpia → card "Rebotes & Misc": `AS/PER 1,48 (43/29)`. Jugador → M. Perdomo → "Rebotes & distribución":
   `AS/PER 2,00 (14/7)`. Game log: columna AS/PER `2,78` / `0,90` (equipo). Comparar Olimpia vs Tabaré: fila AS/PER `1,48` vs `1,14`
   (Tabaré: `17/9` y `16/20` → `33/29`).
5. **Sin pérdidas.** Jugador → J. Lamas (COL): AS/PER "—", `title` "Sin pérdidas: el cociente no está definido".
6. **Bajo filtro (CA-5).** En una **copia** de la base (`DB_PATH=<copia>`): `POST /api/competitions {"name": "Copa C04", "season": "2026"}` y
   `PATCH /api/games/2849327 {"competition_id": <id nuevo>}` (partido ajeno a Olimpia). Con 2 competencias aparece el selector; en Equipo →
   Olimpia → elegir "Liga de Ascenso 2026": AS/PER debe seguir en **1,48**; con el cálculo viejo mostraría `1,84`.

## Estimación: S · 2–3 h
Backend 0,5 h · frontend 1–1,5 h · verificación y docs 0,5–1 h. (Arquitectura §9.1: S 1–3 h.)
