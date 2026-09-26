# Progress — C-11: Tratamiento de nulos en toda la app

> **Estado:** ✅ Completado (2026-09-26) · rama `v2`, sin commitear
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Decisiones humanas aplicadas
DA-01 (integrar `dev`), DA-02 (pooled; acá solo DEF/TO), DA-07 (sentinels → nulo), DA-21 (sin `t()` ni `core/i18n.js`),
DA-36 (coma decimal), C-11 RF-11 (nulo desde la ingesta, sin heurística), C-11 RF-10 (hueco DNP). Registro en
[../../00-decisiones.md](../../00-decisiones.md).

## Desviaciones respecto del plan
- **Sin `core/i18n.js` ni `t()`** (DA-21). El copy nuevo está en español directo.
- **RF-11 por ingesta**, no por heurística: no existen `unrecorded_fields` ni `UNRECORDABLE_*`. `fiba_fetcher.py` guarda
  `None` si falta la clave; la razón `no_registrado` sale de `FIBA_OPTIONAL_FIELDS` cuando el valor es nulo.
- **`null_reason()` simplificado**: sin tabla de denominadores; emite solo `dnp`, `no_registrado`, `sin_perdidas`,
  `sin_intentos`. `NULL_REASON_LABELS` tiene solo esos 4 códigos: cada requisito posterior agrega el suyo.
- **`_cmpNullsLast` queda en `app.js`** (no se movió a `core/format.js`): hoy lo usan solo vistas de `app.js`; T-06 lo
  moverá si su componente de tabla vive en otro módulo.
- `ti()` de `fiba_fetcher.py` se reescribió para distinguir "0 informado" de "clave ausente" (antes `a or b` convertía un 0
  en "siguiente clave"). Verificado sin cambios en los datos reales (abajo).

## Evidencia

### Grupo 0 — humo de las features 12–18 (CA-2)
`git status` tras el cherry-pick: 9 archivos modificados + specs 12–18; ningún archivo de `backend/venv/` ni
`package-lock.json` versionado. Script contra `http://localhost:5000` (13 partidos de "Liga de Ascenso 2026"):
```
PASS /api/teams -> 14 equipos
PASS team: campo leagues (F14)          PASS team: campo totals (F16)      PASS team: averages.ppt_2 (F16)
PASS player: game_log[].played (F12)    PASS player: averages.as_pos (F15) PASS player: leagues (F14)
PASS clutch margin == 10 (F18)          PASS league: tabla general (F17)   PASS search: 187 filas (F13)
PASS app.js: _cmpNullsLast (F12)        PASS app.js: PtsEnPint sin PeP (F18)
```

### Backend (CA-3, CA-4, CA-10, CA-11)
Recorrido de los 14 equipos y todos sus jugadores, JSON parseado con parser estricto (rechaza `NaN`/`Infinity`):
```
PASS ningún 99.0 en ast_to/def_to_ratio (0 encontrados)
PASS CA-3 jugador 0 pérdidas (J. Brisset 2849337): null + sin_perdidas
PASS DNP (S. Vallejo 2849332): razón dnp en tasas
PASS team averages.def_to_ratio pooled = 3.25
PASS search: null_reasons en todas las filas
```
Sobre una **copia** de la base (equipo con `fast_break_pts`/`plus_minus` en `NULL` y un partido con `tov = 0`), vía
`app.test_client()`:
```
PASS CA-10 averages.fast_break_pts null + no_registrado
PASS CA-10 game_log fast_break_pts null + no_registrado
PASS CA-10 campo registrado sigue con número: paint_pts=36.0
PASS CA-4 partido con 0 pérdidas: def_to_ratio null + sin_perdidas
PASS CA-4 averages.def_to_ratio pooled 9.75 == 9.75
PASS search: plus_minus null + no_registrado
```
Ingesta (partido real de `SEED_URLS`, re-descargado de FIBA): con las claves presentes `paint_pts=30, fast_break_pts=6,
bench_pts=31, plus_minus=7`; quitando `*FastBreak*`, `BenchPoints` y `sPlusMinusPoints` del JSON →
`fast_break_pts=None, bench_pts=None, plus_minus=None`, resto de conteos idénticos. El parser nuevo contra lo guardado en la
base para 4 partidos: **0 diferencias** en `team_game_stats`.

`python backend/test_auth.py` → `TODOS LOS TESTS OK`.

### Frontend — recorrido en Chromium headless (CA-1, CA-5, CA-6, CA-9, CA-11, CA-13, CA-14)
Playwright (dependencia ya declarada en `requirements.txt`), viewport 1280×900. En cada pantalla: texto visible sin
`null`/`NaN`/`undefined`/`Infinity`, sin decimales con punto, ningún `.null-val` dentro de `.above-avg/.below-avg/.winner/.loser`,
errores de consola y `pageerror` capturados.
```
importar: 0 nulos con razón          liga / liga-sort asc / desc: 0
equipo: 0                            equipo-extras (mapa jugador, ON/OFF, combinación): 0
jugador S. Vallejo: 1 filas DNP en game log · 24 nulos con razón
comparar: 0                          buscar / buscar-sort (+/- asc y desc): 424 nulos con razón
offline: app carga = True            (service worker con format.js en STATIC)
ERRORES JS: 0 · HALLAZGOS: 0
```
- Primera pasada encontró **2 hallazgos, corregidos**: posesiones de ON/OFF y Combinación en crudo con punto (`162.44`,
  `51.16`) → `DEC1`; Net Rating nulo pintado de rojo en la tabla de Liga → sin clase.
- Modal de borrado: se abre sin campo de token (CA-13).
- Capturas revisadas: Jugador con 1 partido jugado sin tiros muestra conteos `0,00` reales y tasas `—` (sin intentos); fila
  `DNP` sin números; Equipo con desglose ofensivo visible, ranking de uso con `0,0%` reales (CA-8).

### Checklist de recorrido (plan §6.4)
| Pantalla | Resultado |
|---|---|
| Importar (catálogo, modal) | ⚠️ corregida (token eliminado, T-B7) |
| Liga — tabla general / ranking / mapa | ⚠️ corregida (Net Rating nulo sin color); orden con `_cmpNullsLast` ✅ |
| Equipo — récord, eficiencia, tiro, detalle | ⚠️ corregida (total `(—)`, razones en "—") |
| Equipo — Four Factors | ⚠️ corregida (RebOf% rival nulo) |
| Equipo — rebotes, defensa | ⚠️ corregida (DEF/TO sin 99.0, acumulado) |
| Equipo — desglose ofensivo | ⚠️ corregida (siempre visible; `no_registrado`) |
| Equipo — game log / radar / evolución | ✅ (razones en celdas nulas) |
| Equipo — ranking de uso | ⚠️ corregida (0 real visible) |
| Cierres | ✅ |
| Combinación / ON/OFF | ⚠️ corregida (posesiones con coma) |
| Mapa de tiro equipo / jugador | ✅ (zonas sin intentos no se dibujan; coma decimal) |
| Jugador — cards / game log / evolución | ⚠️ corregida (razones, fila DNP, hueco DNP) |
| Comparar | ✅ |
| Buscar | ⚠️ corregida (+/- sin `None → 0`; razones) |

## Hallazgos ruteados (no se parchan acá)
- Población de liga de jugadores incluye fichas DNP → deprime el Ø de conteos → **C-02**.
- `_computeAvg` promedia `ast_to` por partido bajo filtro (el backend lo acumula) → **C-04**.
- Totales del detalle de tiro no respetan el filtro de competencia/últimos N → **C-07**.
- `statBox` compara conteos contra tasas (`TO` vs `to_ratio`) → **T-01**.
- `-0,00` para valores negativos que redondean a cero (comportamiento previo de `toFixed`) → se resuelve con la ficha de T-01.

## Pendiente de verificación humana
- Revisión visual en un navegador real y en móvil (768 px): el title del "—" se ve con tap largo.
- Reimportar en producción los partidos de competencias que no publiquen el desglose, para que pasen de `0` a `NULL`.
