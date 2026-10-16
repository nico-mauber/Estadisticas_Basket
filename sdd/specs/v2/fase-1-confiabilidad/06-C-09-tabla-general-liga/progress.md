# Progress — C-09: Tabla general en Liga

> **Estado:** ✅ Completado (2026-09-26) · rama `v2`
> Reglas: `sdd/04-implement.md`. Spec: [spec.md](spec.md).

## Decisiones humanas aplicadas
DA-31 (2/1 y desempate por diferencia, configurables en F-13, con aclaración visible) y **universo** (con varias
competencias y "Todas", pedir elegir). Registro en [../../00-decisiones.md](../../00-decisiones.md).

## Cambios
- `backend/stats_engine.py`: `WIN_POINTS = 2`, `LOSS_POINTS = 1`, `standings_row(results)` y `standings_sort_key(row)`
  — único lugar de puntos y desempate.
- `backend/app.py` (`/api/league`): usa `standings_row` (sale el `2 * wins + losses` de la ruta) y agrega
  `standings_pos`. `games` pasa a contar todos los partidos del equipo (antes solo los que tenían fila del rival).
- `frontend/js/app.js`: `_standingsCardHTML(teams, compSelHTML, pickComp)` ordena por `standings_pos`, muestra la nota y,
  con varias competencias en "Todas", pide elegir. El selector de competencia sube a la card de la tabla (filtra las tres
  cards de Liga).
- `frontend/sw.js`: `CACHE` → `smart-basket-v13`.

## Estado de CA
Backend: `app.test_client()` sobre una copia de la base (13 partidos, 14 equipos). Frontend: Chromium headless sobre la
base local.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Los 14 equipos: PJ/PG/PP/Pts/PF/PC iguales a los de su game log; total PG = total PP = 13 partidos. Orden: TRO 4 (+32), ALB 4 (+25), STO 4 (+11), UPA 3 (+20)… MNE 1 (−12). La tabla del navegador coincide fila por fila con `standings_pos` |
| CA-2 | ✅ | `standings_row([(80,70),(70,70),(60,75)])` → 1 PG, 2 PP, 4 pts. Con `WIN_POINTS=3, LOSS_POINTS=0` cambian los puntos (único lugar) |
| CA-3 | ✅ | Partido movido a "Copa C09": `?competition=` → 2 equipos, ganador 2 pts / perdedor 1 pt; la competencia 1 queda con 24 equipo-partidos |
| CA-4 | ✅ | Con 2 competencias: "Todas" muestra "Elegí una competencia para ver la tabla general." con el selector en esa card; Copa C09 → 2 filas y ranking filtrado; competencia 1 → 14; volver a "Todas" pide elegir de nuevo. Con una sola competencia: tabla visible, sin selector |
| CA-5 | ✅ | `/api/league` (todas y competencia 1) del código anterior vs el nuevo sobre la misma base: idéntico salvo `standings_pos` |
| CA-6 | ✅ | 360 px sin scroll horizontal de página (PF/PC con scroll dentro de la tabla, como el resto); 0 errores JS |

## Docs actualizados
- [x] `docs/api.md` — `GET /api/league`: campos de la tabla general, `standings_pos`, único lugar de puntos/desempate
- [x] `docs/frontend.md` — Vista Liga: selector en la card de la tabla; §Tabla general (orden del backend, nota, "Todas")

## Deuda / TODO
- → F-13: `WIN_POINTS`/`LOSS_POINTS`/`standings_sort_key` pasan a leer `standings.win_points`, `standings.loss_points`,
  `standings.tiebreak`.
- → C-02: competencia por defecto (DA-14); hoy Liga arranca en "Todas" y, con varias competencias, la tabla pide elegir.
