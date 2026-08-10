# Progress — Feature 16: detalle de tiro completo y PPT

> Cierre de C-03 y C-07 (`Smart-Basket Especificacion v2.docx` §1, P1).

## Estado de tareas

- [x] **T-A1** · N/A — sin cambio de esquema
- [x] **T-B1** · `_zones_from_shots`: `pf` → `ppt` + `efg` por zona · `backend/app.py`
- [x] **T-B2** · `summary.global_pf` → `summary.ppt` · `backend/app.py`
- [x] **T-B3** · `ppt_2`/`ppt_3`/`ppt_ft` en equipo y jugador · `backend/stats_engine.py`
- [x] **T-B4** · Bloque `totals` en `team_stats` y `player_stats` · `backend/app.py`
- [x] **T-B5** · Los 3 PPT en `keys`/`metric_keys` y en `league_averages`
- [x] **T-C1** · N/A — `api.js` sin cambios
- [x] **T-D1** · `_scBadge`: `P/F` → `PPT`
- [x] **T-D2** · `_scLbl`: 4 valores por zona, caja de 33 → 44px
- [x] **T-D3** · Verificado — ver D-2 sobre el alcance real
- [x] **T-D4** · Card "Tiro" de jugador con `_shotDetailGrid`
- [x] **T-D5** · Card "Tiro" de equipo con el mismo helper
- [x] **T-E1**, **T-E2**, **T-E3** · Ver §CA y §Gates
- [x] **T-F1** a **T-F5** · Ver §Gates y §CA

## Diagnóstico previo

`_zones_from_shots` calculaba `z["pf"] = convertidos × ZONE_POINTS[k] / intentos`, que **es
exactamente PPT** (puntos de la zona ÷ intentos de la zona). C-03 no pedía recalcular nada: la
fórmula estaba bien y la etiqueta mal. Consecuencia práctica: **los números que el usuario veía no
cambiaron**, solo su nombre — y se agregó el eFG% por zona, que sí faltaba.

## Estado de CA (gate de aceptación)

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | Mapa de CNF, etiquetas de zona: `37,1%` (volumen) · `PPT 1,30` · `43,4%` (acierto) · `eFG 65,1%`. Barrido de `P/F` en los `<text>` del SVG: **0** |
| CA-2 | ✅ | Encabezado del mapa: caja `PPT` con valor `1,21` (antes decía `P/F`) |
| CA-3 | ✅ | Shot chart de jugador (`E. Oglivie`, modo 3 zonas): `PPT 1,00` / `eFG 50,0%`; **0** ocurrencias de `P/F` |
| CA-4 | ✅ | Unitario: zona de 3 con 4/10 → `ppt 1.2`, `efg 0.6`. En el mapa real, la zona de triples muestra `PPT 1,30` con `eFG 65,1%` ≠ `43,4%` de acierto |
| CA-5 | ✅ | Zonas de 2 puntos: `eFG 43,5%` == `43,5%` de acierto, y `eFG 62,7%` == `62,7%`. El eFG% coincide con el FG% cuando el factor es 1.0 — comportamiento esperado (ver D-3) |
| CA-6 | ✅ | Card Tiro de CNF: `T2i 45.00 (90)`, `T2c 26.00 (52)`, `T3i 26.50 (53)`, `T3c 11.50 (23)`, `TLi 25.00 (50)`, `TLc 17.00 (34)` — promedio por partido y total de temporada entre paréntesis. `totals` verificado contra la suma manual del game log |
| CA-7 | ✅ | `PPT 1.43`, `PPT 2 1.12`, `PPT 3 1.32`, `PPT TL 0.68`, todos con su `Ø` de liga |
| CA-8 | ✅ | `E. Oglivie` (0 triples en la temporada): `PPT 3` muestra **`"—"`**, mientras `T3i` y `T3c` muestran **`0.00 (0)`** — un 0 real. Es exactamente la distinción de C-11: "no intentó" vs "intentó y no convirtió" |
| CA-9 | ✅ | Unitario con 4/10 de 2, 4/10 de 3 y 5/6 de TL: `ppt_2 = 0.8` (= 2×4÷10), `ppt_3 = 1.2` (= 3×4÷10), `ppt_ft = 0.8333` (= 5÷6) |
| CA-10 | ✅ | Consola tras recorrer Equipo, mapa de tiro y perfil de jugador: **0 errores** |

## Gates técnicos

- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: **N/A** — sin cambio de esquema
- Endpoints probados manualmente: ✅ — `/api/shots/<code>`, `/api/shots/<code>/<player>`,
  `/api/team/<code>`, `/api/player/<t>/<n>`
- Consola del navegador sin errores JS: ✅
- Mobile 390px: ✅ — la card Tiro pasó a **16** stats, 0 desbordan, sin scroll horizontal; el SVG del
  mapa se ajusta al viewport

## Desviaciones respecto a docs/ o plan

**D-1 · `pf` se eliminó del contrato sin alias** (plan D-1). El CA del cliente es explícito
(*"Ninguna etiqueta del mapa de tiro muestra 'P/F'"*), y mantener las dos claves habría perpetuado el
nombre. `zones[].pf` y `summary.global_pf` ya no existen.

**D-2 · T-D3 (solapamiento en modo 11 zonas) no es verificable con los datos reales.**
La competencia FUBB no expone coordenadas de tiro (`has_coordinates=false`, documentado en Feature
01), así que la app siempre renderiza el modo de **3 zonas**, donde las cajas están muy separadas y no
hay riesgo de solapamiento — verificado. El modo de 11 zonas, con las cajas 33% más altas, **no pudo
probarse con datos reales**. Riesgo abierto: si en el futuro se importa una competencia con
coordenadas, revisar el solapamiento antes de darlo por bueno.

**D-3 · En las 6 zonas de 2 puntos, el eFG% es idéntico al % de acierto.**
Inevitable: el factor del eFG% es 1.0 cuando la zona vale 2. Se ven dos números iguales en la misma
caja. No es un error —es lo que pide C-03— y tiene una lectura útil: hace evidente que todo el
diferencial del eFG% viene del triple. **Vale confirmarlo con el cliente** por si lo considera ruido
visual; si molesta, la alternativa es mostrar el eFG% solo en zonas de 3.

**D-4 · El PPT general no se duplicó.** Ya existía como `pps` (`PTS / FGA`, `docs/metrics.md`), así
que se muestra bajo la etiqueta `PPT` sin agregar una clave nueva. Dos etiquetas, una fuente.

## Docs a actualizar

- [x] `docs/metrics.md` — los tres PPT desglosados y el eFG% por zona
- [x] `docs/api.md` — `zones[].ppt`/`efg`, `summary.ppt`, bloque `totals`
- [x] `docs/frontend.md` — el mapa ya no muestra `P/F`; etiquetas nuevas de la card Tiro

## Deuda / TODO

- **Modo 11 zonas sin verificar** (D-2): las cajas crecieron a 44px de alto y ese modo no es
  alcanzable con los datos actuales.
- **Los umbrales de color del heatmap** (`_scBoxFill`: verde ≥1.00, naranja ≥0.85) se calibraron sobre
  el indicador viejo. Como la fórmula no cambió, siguen siendo válidos — pero ahora que la etiqueta
  dice PPT, conviene revisarlos con el cliente: un PPT de 0.85 en zona de 3 y en zona de 2 no tienen
  la misma lectura.
- **Sin umbral de muestra por zona** (T-02): una zona con 2 intentos muestra su PPT sin advertencia.
- **F-06** pide estas mismas métricas de tiro en lineups y ON/OFF. `_shotDetailGrid` quedó factorizado
  y reusable; el backend expone `totals` por entidad.
