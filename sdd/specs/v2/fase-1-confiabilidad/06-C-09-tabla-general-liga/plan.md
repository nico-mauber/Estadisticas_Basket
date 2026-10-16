# Plan — C-09: Tabla general en Liga

> **ID:** C-09 · **Prioridad:** P1 · **Fase y orden:** 1·06
> **Depende de:** C-11 Grupo 0 (P-00) — [`../01-C-11-tratamiento-de-nulos/plan.md`](../01-C-11-tratamiento-de-nulos/plan.md) · F-11 — [`../02-F-11-calidad-datos-competencias/plan.md`](../02-F-11-calidad-datos-competencias/plan.md)
> **Habilita:** F-13 (`standings.win_points`, `standings.loss_points`, `standings.tiebreak`), T-06 (`league_standings`)
> **Estado:** Implementado (2026-09-26) — ver [progress.md](progress.md)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 · C-09 · Arquitectura §1.0 (fila C-09/C-10), §3.2 (`standings.*`), §6 (`GET /api/league`), DA-31
> **Estimación:** S · 2–3 h

> Plan escrito al documentar el trabajo ya implementado (ver spec.md §0 y progress.md): describe el diseño realmente
> construido, verificado contra `backend/app.py`, `backend/stats_engine.py` y `frontend/js/app.js` en el working tree.

## 1. Enfoque

La feature 17 de `dev` (integrada en C-11 Grupo 0) ya agregaba `wins/losses/table_points/pts_for/pts_against` a
`GET /api/league` y la card `_standingsCardHTML`, pero los puntos (`2 * wins + losses`) y el orden vivían repartidos entre
la ruta y el frontend. C-09 los mueve a un **único lugar de backend**: dos funciones puras en `stats_engine.py`
(`standings_row`, `standings_sort_key`) más dos constantes de módulo (`WIN_POINTS`, `LOSS_POINTS`) que F-13 reemplaza
después por `config.get("standings.win_points")`/`.loss_points`/`.tiebreak` sin tocar la firma. `/api/league` calcula
`standings_pos` con ese orden y lo agrega a cada fila; el frontend solo pinta `standings_pos`, `table_points`, etc., sin
recalcular nada. Con más de una competencia y "Todas" elegido, la card pide elegir una (evita sumar torneos distintos,
RF-4). Un marcador empatado (dato corrupto, no existe en FIBA) cuenta como derrota para que PG + PP = PJ se sostenga
siempre (RF-5).

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | módulo (mod.) | `WIN_POINTS = 2`, `LOSS_POINTS = 1` (único lugar); `standings_row(results: list[tuple]) -> dict` (`games`, `wins`, `losses`, `table_points`, `pts_for`, `pts_against`); `standings_sort_key(row: dict) -> tuple` (orden: más puntos, desempate por diferencia PF−PC) | RF-1, RF-2, RF-5 |
| `backend/app.py` | ruta (mod.) | `league_overview` (`GET /api/league`): construye `rows = [(pts, opp_pts), ...]` por equipo desde `TeamGameStats` (todos los partidos del equipo en el universo, no solo los que tienen fila del rival — corrige PJ); llama `standings_row`; ordena con `standings_sort_key` para asignar `standings_pos` a cada fila | RF-1, RF-2 |
| `frontend/js/app.js` | vista (mod.) | `_standingsCardHTML(teams, compSelHTML, pickComp)` (card "Tabla general": PJ/PG/PP/Pts/PF/PC ordenados por `standings_pos`, nota "Solo partidos importados…", selector de competencia dentro de la card, estado "Elegí una competencia…" si `pickComp`); `renderLeague()` pasa `pickComp = comps.length > 1 && !_leagueComp` | RF-2, RF-3, RF-4 |
| `frontend/sw.js` | sw | `CACHE` → `smart-basket-v13` (asset de la card ya estaba en `STATIC`, solo sube la versión) | — |
| `docs/api.md` | doc (cierre) | `GET /api/league`: campos de la tabla general, `standings_pos`, nota "único lugar de puntos/desempate" | RF-1, RF-2 |
| `docs/frontend.md` | doc (cierre) | Vista Liga: selector en la card de la tabla, §Tabla general (orden del backend, nota, comportamiento "Todas") | RF-3, RF-4 |

**Matriz RF → archivo:** RF-1 stats_engine.py/app.py · RF-2 stats_engine.py/app.py/app.js · RF-3 app.js/docs ·
RF-4 app.js/docs · RF-5 stats_engine.py. Sin RF huérfanos.

## 3. Backend — rutas y modelos

### 3.1 Esquema
Sin cambios de esquema (Arquitectura §5: "Sin cambios de esquema: … C-09 …").

### 3.2 Endpoints

**GET `/api/league`** (modificado · `login_required`)

Query: `competition` (opcional) — id entero, `all`, o string legado; resuelto con `competitions.resolve` (F-11). Sin
parámetro o `all` → todas las competencias.

Response 200, por equipo (shape existente + campos de la tabla general, ya en `dev`, más `standings_pos` **NUEVO** de
C-09):
```json
{
  "team_code": "TRO", "team_name": "Trouville",
  "games": 4, "wins": 4, "losses": 0, "table_points": 8, "pts_for": 312, "pts_against": 280,
  "standings_pos": 1,
  "oer": 1.12, "der": 1.02, "net_rating": 0.10, "efg_pct": 0.53, "ts_pct": 0.57,
  "or_pct": 0.29, "dr_pct": 0.71, "to_pct": 0.14, "pace": 78.4, "pts": 78.0, "stl": 7.2
}
```
`standings_pos` es el único campo nuevo de C-09 sobre el shape de `dev`; se marca `PROPUESTA (no está en
00-arquitectura-transversal.md)` porque la arquitectura §6 no detalla el shape de `/api/league` fila por fila (solo dice
"lista de equipos + `stl`" y, en la tabla de módulos, que C-09 lo hereda sin agregar endpoint nuevo).

Errores: sin cambio — 400 `competencia_inexistente` (resolución F-11), sin partidos → lista vacía (existente).

Sin cambios de esquema.

## 4. Backend — lógica

**`backend/stats_engine.py`** (se agrega, después de las funciones de agregado existentes):

```python
WIN_POINTS = 2
LOSS_POINTS = 1

def standings_row(results: list[tuple]) -> dict:
    """Fila de tabla de posiciones a partir de [(pts, opp_pts), ...] de un equipo.
    Un marcador empatado cuenta como derrota (dato corrupto, no existe en FIBA;
    mantiene PG + PP == PJ)."""
    wins = sum(1 for pts, opp in results if (pts or 0) > (opp or 0))
    losses = len(results) - wins
    return {
        "games": len(results), "wins": wins, "losses": losses,
        "table_points": WIN_POINTS * wins + LOSS_POINTS * losses,
        "pts_for": sum(pts or 0 for pts, _ in results),
        "pts_against": sum(opp or 0 for _, opp in results),
    }

def standings_sort_key(row: dict) -> tuple:
    """Orden: más puntos primero; desempate por diferencia (PF − PC)."""
    return (-row["table_points"], -(row["pts_for"] - row["pts_against"]))
```

Entradas: `results` = lista de tuplas `(pts, opp_pts)` de `TeamGameStats` del equipo en el universo filtrado (no requiere
`_opp_for`: usa `TeamGameStats.pts`/`opp_pts`, ya persistidos por partido, así que un partido sin fila del rival igual
cuenta para PJ/PG/PP — esto corrige el bug de `dev` donde `games` solo contaba partidos con fila del rival presente).

Manejo de nulos (C-11): `pts`/`opp_pts` son columnas `INTEGER DEFAULT 0` (nunca `NULL` en un partido importado), así que
`or 0` es una salvaguarda defensiva, no una regla de nulos activa; no hay `null` en esta fila.

Sin caché adicional (la función es pura y barata; se recalcula en cada `GET /api/league`, igual que el resto de la
ruta).

**`backend/app.py`** (`league_overview`, se edita):
```
rows_por_equipo = agrupar TeamGameStats visibles (filtradas por competencia si aplica) por team_code
para cada código de equipo:
    result.append({..., **standings_row([(r.pts, r.opp_pts) for r in rows]), ...})   # ya no calcula table_points a mano
# después de armar `result` completo:
for pos, row in enumerate(sorted(result, key=standings_sort_key), start=1):
    row["standings_pos"] = pos
```
El resto de `league_overview` (promedios `_avg` con exclusión de `None`, orden final por `oer` para el ranking avanzado)
no cambia: `standings_pos` es un campo adicional, no reemplaza el orden de la tabla de ranking OER/DER existente.

## 5. Frontend — capa API (`api.js`)

Sin cambio: `api.league(comp)` ya existe (`GET /api/league?competition=<comp>`) y ya lo usa `renderLeague()`. C-09 no
agrega método nuevo.

## 6. Frontend — UI

Ubicación: vista Liga (S2 en la navegación X-01, fase 2; en fase 1 sigue siendo la sección `league` existente).

`_standingsCardHTML(teams, compSelHTML, pickComp)` (nueva función, `frontend/js/app.js`):
- Recibe `_leagueTeams` (ya cargado por `renderLeague` con `api.league`, sin fetch adicional) y arma la card "Tabla
  general" arriba del ranking avanzado existente.
- `pickComp = comps.length > 1 && !_leagueComp` (más de una competencia y ninguna elegida): la card muestra solo el
  header y `"Elegí una competencia para ver la tabla general."` (RF-4); el selector de competencia (`compSelHTML`) vive
  **dentro** de esta card, no en el header general de Liga (así también filtra las otras cards de la sección).
- Con una competencia elegida o una sola disponible: tabla ordenada por `t.standings_pos` (nunca recalculada en el
  cliente), columnas Equipo/PJ/PG/PP/Pts/PF/PC, más la nota `"Solo partidos importados, no el fixture completo."`
  (RF-3).
- Clic en una fila navega al equipo (reusa el patrón de `_bindLeagueRowClicks`).

Componentes compartidos reutilizados: `.search-table`/`.table-wrap` (estilos existentes), `_compOptions` (armado del
`<select>` de competencia, ya usado por Liga/Equipo/Comparar/Jugador).

Estados: sin loading propio (la card se pinta junto con el resto de `renderLeague`, que ya tiene su spinner de sección);
sin estado de error propio (errores de `api.league` los captura el `catch` de `renderLeague`, existente); vacío = 0
equipos con partidos → no se ve card (mismo criterio que el resto de la sección, "Sin datos. Importa partidos primero.").

Mobile 768 px: tabla dentro de `.table-wrap` con scroll horizontal interno si hace falta (PF/PC son las columnas que
más se recortan primero, como el resto de las tablas de la app); la página en sí no tiene scroll horizontal a 360 px.

## 7. Navegación
Sin cambio: la card vive en la sección `league` existente, arriba del ranking avanzado. X-01 (fase 2) reubica la sección
completa en S2 sin tocar el componente.

## 8. Contratos (shapes)
Ver §3.2 (response completa).

## 9. Errores y offline
Sin errores nuevos: hereda el manejo existente de `renderLeague` (catch genérico → mensaje de error de `api.js`) y de
`league_overview` (400 `competencia_inexistente`, lista vacía si no hay datos). Offline: `/api/*` a red siempre; sin
conexión, el error de red existente cubre toda la sección (incluida la card nueva).

## 10. Riesgos y decisiones

- **D-1 · `standings_pos` como PROPUESTA.** La arquitectura §6 no detalla el shape fila por fila de `/api/league`; se
  agrega `standings_pos` como campo del dueño del endpoint (permitido por §0.3, "agregar campos declarados"), marcado
  `PROPUESTA (no está en 00-arquitectura-transversal.md)` — se reporta en `huecos_arquitectura`.
- **D-2 · PJ corregido.** El código de `dev` contaba `games` solo cuando existía fila del rival (`_opp_for`); usar
  `TeamGameStats` directamente (con `pts`/`opp_pts` propios) corrige el conteo sin depender de que la fila rival esté
  presente. Esto es una corrección de bug dentro del propio alcance de C-09 (RF-1 "games... calculados sobre los mismos
  partidos"), no una desviación de la arquitectura.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato — C-09 no crea endpoint nuevo, solo agrega un campo
  a uno existente del que ya es dueño según la tabla de fases (§9.1: "C-09 | Habilita: T-06 (`league_standings`)").
- **Dependencias técnicas:** C-11 Grupo 0 → integración de `dev` (card y campos base ya presentes)
  ([`../01-C-11-tratamiento-de-nulos/plan.md`](../01-C-11-tratamiento-de-nulos/plan.md)); F-11 → `competitions.resolve`,
  universo por competencia ([`../02-F-11-calidad-datos-competencias/plan.md`](../02-F-11-calidad-datos-competencias/plan.md));
  F-13 (después) → migra `WIN_POINTS`/`LOSS_POINTS`/el criterio de desempate de `standings_sort_key` a
  `config.get("standings.win_points")`/`.loss_points`/`.tiebreak` sin tocar las firmas
  ([`../12-F-13-configuracion/plan.md`](../12-F-13-configuracion/plan.md)).
- **Incremento diferido:** editar puntos y desempate desde la UI de Configuración — se habilita con F-13
  ([`../12-F-13-configuracion/`](../12-F-13-configuracion/)); tabla exportable `league_standings` — se habilita con T-06
  ([`../16-T-06-tablas-completas-exportacion/`](../16-T-06-tablas-completas-exportacion/)); fixture y partidos no
  importados — F-12.
- **Estimación: S · 2–3 h** (funciones puras en `stats_engine.py` + PJ corregido: 1 h; ruta con `standings_pos`: 0,5 h;
  card frontend con selector y estado "elegí competencia": 1 h; docs + verificación: 0,5 h).
