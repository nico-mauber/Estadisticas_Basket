# Progress — C-01: Rebotes y distribución en perfil de jugador

> **Estado:** ✅ Implementado (2026-10-07), rama `v2`. Pendientes: CA-10 y CA-11 (dependen de C-02) y los incrementos diferidos T-G1…T-G3.
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
Todas `[x]` salvo el Grupo G (diferidos: `Ø` y población de liga → C-02; OR%/DR% "en cancha" → T-05; mínimos de muestra, percentil y ficha → T-02/T-01).

## Diagnóstico del cliente: ¿dato faltante o error de cálculo?
Dato faltante en `main` (ya calculado en `dev`, Feature 15). Lo que quedaba eran **incoherencias de los valores calculados**, que C-01 corrige:
posesión ≤ 0 → tasas negativas, OR%/DR% > 100 %, y media de tasas por partido en vez de cociente de totales.

## Antes / después (base local, 13 partidos)
| Jugador | Indicador | Antes | Después |
|---|---|---|---|
| M. Perdomo (OLI) | AS/pos | 0,5665 (media de tasas) | **0,4743** (14 / 29,52) |
| M. Perdomo | PER/pos · PTS/pos = OER | 0,2114 · 0,8762 | **0,2371 · 0,8469** |
| M. Perdomo | RO/min · OR% · DR% | 0,0332 · 3,33 % · 1,63 % | **0,0328 · 3,26 % · 1,58 %** |
| G. Viera (TAB) | AS/pos | **−4,1666** | **0,1453** (1 / 6,88) |
| G. Viera | PTS/pos = OER | **−7,9762** | **1,0174** (7 / 6,88) |
| G. Viera | partido con POS = −0,12 (game log) | AS/pos −8,33 · PTS/pos −16,67 | "—" (`sin_intentos`) |
| J. Lucchini (TRO, 0:15 min, 1 RO) | OR% | **516,13 %** | "—" (`estimacion_invalida`) |
| I. Rocha (UPA, 0:43 min, 1 RD) | DR% | **143,11 %** | "—" (`estimacion_invalida`) |

## Estado de CA (gate de aceptación)
Verificación: independiente de la app. Un script suma el box score persistido de la base (solo lectura, `possessions()` por partido,
`team_game_stats` propio y rival, `games.minutes`) y calcula las siete tasas a mano; se compara con la API y con la pantalla (Chromium).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Barrido de las 187 fichas: 0 valores negativos y 0 porcentajes > 100 % en las 9 tasas. Los jugadores con minutos y `ΣPOS > 0` tienen valor numérico en las cinco; los 14 con `ΣPOS ≤ 0` (0,1–4,7 min en la base local) muestran "—" con razón `sin_intentos` (decisión A3). |
| CA-2 | ✅ | M. Perdomo: API = cálculo a mano en las 7 tasas (`0,4743 · 0,2371 · 0,8469 · 0,0328 · 0,0164 · 0,0326 · 0,0158`); pantalla `AS/pos 0,47`, `PER/pos 0,24`, `PTS/pos 0,85`, `RO/min 0,03`, `RD/min 0,02`, `OR% 3,3%`, `DR% 1,6%`. No aparecen los valores de la media de tasas (`0,57`). |
| CA-3 | ✅ | G. Viera: game log del partido 2849330 con "—" en AS/pos y PTS/pos (`possessions −0,12`, razón `sin_intentos`); temporada `AS/pos 0,1453`, `PER/pos 0,0` (cero real), `PTS/pos 1,0174`, `OER 1,0174`. Ninguno negativo. |
| CA-4 | ✅ | N. Cerminatti (STO, ΣPOS = 0): AS/pos, PER/pos y PTS/pos "—" con `title` "Sin intentos: no se puede calcular"; `RO/min` y `RD/min` `0,00`. |
| CA-5 | ✅ | J. Lucchini: OR% "—" con `title` "Estimación no válida: la muestra de minutos es demasiado chica" (no 516 %); I. Rocha: DR% `null`, razón `estimacion_invalida` (no 143 %). |
| CA-6 | ✅ | DNP (A. Arreche): `as_pos`, `orb_min`, `or_pct` nulos con razón `dnp`; `games` cuenta solo jugados; `sum_pool` recibe solo los partidos jugados (G. Viera usa sus 2). |
| CA-7 | ✅ | M. Perdomo: perfil == fila de `/api/search/players` en `as_pos, tov_pos, pts_pos, orb_min, drb_min, or_pct, dr_pct, trb_pct, oer`. |
| CA-8 | ✅ | `pts_pos == oer` en las 187 filas del Buscador y en el perfil (Viera 1,0174 / 1,0174). |
| CA-9 | ✅ | Las siete etiquetas llevan `title` con su definición; las de OR%/DR% dicen "estimado por minutos mientras estuvo en cancha. No es comparable con el OR% de equipo.". |
| CA-10 | ⬜ pendiente (C-02) | Con la selección en el cliente (`_computeAvg`) estas ocho tasas siguen siendo media de tasas bajo un filtro de competencia/últimos N: no hay términos para sumar en el cliente y calcularlos en JS violaría la regla 4. Con un solo partido coincide con el game log. Lo cierra C-02 al mover la selección al backend (plan D-1). |
| CA-11 | ⬜ pendiente (C-02) | El `Ø` de OR%/DR% sigue siendo el vigente (Feature 14); la población de liga y su criterio los define C-02. |
| CA-12 | ✅ | Recorrido Equipo → Jugador (Perdomo, Lucchini, Cerminatti, Viera) sin errores de consola; a 360 px desborde horizontal 0 px. |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: N/A (sin esquema)
- Endpoints probados manualmente: ✅ (`/api/player/…` ×5 jugadores y barrido de `/api/search/players`)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- **Código de razón nuevo `estimacion_invalida`** (propuesta de la spec, no estaba en la arquitectura §7.4): agregado a `null_reasons`,
  a `NULL_REASON_LABELS` y a `docs/api.md`.
- **`oer` de jugador pasa a cociente de totales** (RF-7: PTS/pos ≡ OER); el OER de equipo no se toca (T-05).
- Se ejecutó **antes** de C-02 (orden de carpeta): las rutas llaman a `season_player_rates(sum_pool(...))` y CA-10/CA-11 quedan para C-02.
- `null_reasons(metrics, *, played, overrides)`: un jugador sin partidos jugados siempre devuelve `dnp` aunque la ruta pase `overrides`.
- Observación (fuera de alcance): un partido de solo tiros libres da `TS% 113,6 %` (2 pts con 2 TLi) — es válido matemáticamente; no es un % de rebote.

## Docs a actualizar
- [x] `docs/metrics.md` — §OR%/DR%/TRB% individual (cociente de totales, tope 100 %) y §"Por posesión y por minuto" (cociente de totales, POS ≤ 0)
- [x] `docs/api.md` — agregación de las tasas, `estimacion_invalida` en la tabla de razones
- [x] `docs/frontend.md` — rótulos con definición de la card "Por posesión y por minuto" y de OR%/DR%

## Deuda / TODO
- Muestras chicas (un jugador de 15 s con `RO/min 4,00`): lo trata T-02 (mínimos y regresión).
- `Ø` correcto y exclusión de fichas DNP de la población: C-02.
