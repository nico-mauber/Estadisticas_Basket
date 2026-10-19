# Progress — T-04: Base de normalización

> **Estado:** 🔶 Implementado en el conjunto estándar (Equipo, Jugador) y tablas T-06; verificado backend 15/15 y Chromium; falta el contexto completo de T-03 (splits) que todavía no existe
> **Fecha:** 2026-10-18

## Estado de tareas
- [x] T-B1 · `stats_engine.apply_base` con las 4 bases (fixed / volume / count)
- [x] T-B2 · Segundos de la entidad (`bundle.seconds` o minutos × 60: equipo con prórrogas, jugador minutos jugados, quinteto en cancha)
- [x] T-B3 · Posesiones del denominador (`_per100_dens`: propias/rival; jugador en cancha, exactas o estimadas)
- [x] T-B4 · Denominador 0 → `null` `sin_datos`
- [x] T-B5 · Validación de `base` (metrics_catalog, tables; mensaje con las 4 opciones)
- [x] T-B6 · `base` en `GET /api/metrics/<tipo>` (ya llegaba; ahora acepta por40/por100)
- [x] T-B7 · Propagación en T-06 (`GET /api/table/...?base=por40|por100`, etiquetas `BASE_LABELS`)
- [x] T-C1 · `api.js` ya enviaba `base`
- [x] T-D1 · Selector de 4 opciones en `standard-panel.js` (no se creó `base-selector.js`: el panel ya era el único lugar)
- [x] T-D2 · Base activa: URL `?base=` > sesión (`sessionStorage sb.base`) > `ui.default_base` (`core/base.js`)
- [x] T-D3 · Equipo (panel + game log)
- [x] T-D4 · Jugador (panel + game log)
- [x] T-D5 · Indicador "estimado"
- [x] T-D6 · CSS del selector en móvil (4 botones sin desbordar a 360 px)
- [ ] T-D7 · Copy con `t()` — no existe `t()` todavía (F-21); copy directo en español
- [ ] T-E1 · Estado offline del selector — usa el error genérico del panel
- [x] T-E3 · `sw.js` v33 con `core/base.js`
- [x] T-F · Verificación (`t04_sim.py` 15/15, `t04_browser.py`)
- [ ] T-G1 … T-G3 · (diferido: splits de T-03, F-06, F-04)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Jugador con 1 partido (`last=1`): pts 15 / 15 / 22,29 (= 15 × 2400 / seg) / 26,33 (= 15 × 100 / pos); eFG% idéntico en las 4 |
| CA-2 | ✅ | LAG: total 152 = 76,0 × 2 |
| CA-3 | ✅ | Jugador sin minutos: 404 (sin partidos jugados) o conteos nulos; nunca 0 |
| CA-4 | ✅ | Todas las claves `fixed` idénticas en las 4 bases |
| CA-5 | ✅ | MON con prórroga (45 min): por 40 = pts × 40 / 45 |
| CA-6 | ✅ | Partido sin pbp (copia de la base): por 100 del jugador con `estimated: true`; total sin marca |
| CA-7 | ✅ | El selector solo aparece en el panel estándar (Equipo, Jugador) |
| CA-8 | ✅ | Por 40' en Equipo se mantiene en Jugador; Por 100 vuelve a Equipo (Chromium) |
| CA-9 | ✅ | `/?base=total` en sesión nueva arranca en Totales (Chromium) |
| CA-10 | ✅ | Sin URL ni sesión arranca en `ui.default_base` (Por partido) |
| CA-11 | ✅ | El JSON trae los valores ya escalados y `"base"` como eco |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- **URL:** no hay router X-01; la base va como `?base=` en la URL de la app (también se lee de la query del hash).
- **`per100_den`:** el catálogo lo tenía vacío; se asigna en `_md`: rival para `pts_against`, `blk_received`, `fouls_drawn`, `stops`; propio para el resto de los conteos.
- **Percentiles:** las fichas (puesto, percentil) siguen calculándose sobre la base por partido (T-01 RF-18), aunque el valor mostrado esté en otra base.
- **Bug corregido de paso (F-01):** `bundles.player_game_bundles` usaba una variable `w` que se había eliminado al extraer `player_derived`; cualquier jugador con un partido sin pbp devolvía 500.

## Docs actualizados
- ✅ `docs/metrics.md` — tabla de bases, segundos y denominadores
- ✅ `docs/api.md` — parámetro `base` con las 4 opciones
- ✅ `docs/frontend.md` — selector y persistencia

## Deuda / TODO
- Rendimiento: la primera carga en frío de Jugador (población de todos los jugadores, T-01) tarda ~30 s con 13 partidos.
- Splits de T-03, F-06 y F-04 heredan la base cuando adopten el conjunto estándar.
