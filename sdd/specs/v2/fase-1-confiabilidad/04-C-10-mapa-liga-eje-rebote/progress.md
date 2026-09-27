# Progress — C-10: Mapa de liga — eje de rebote

> **Estado:** ✅ Completado (2026-09-26) · rama `v2`
> Reglas: `sdd/04-implement.md`.

## Decisiones humanas aplicadas
Las 4 propuestas de spec §9: la flecha indica la dirección en pantalla del mejor rendimiento (no se invierte la escala);
rótulos internos "Prom. <métrica>" sin flecha; métricas neutrales sin flecha; recuperos y puntos "mayor es mejor". DA-21:
copy en español directo, sin `t()`. Registro en [../../00-decisiones.md](../../00-decisiones.md).

## Estado de tareas
- [x] T-A1 / T-B1 / T-C1 · N/A — solo frontend
- [x] T-D1 · `_axisTitle(name, dir, orient, qual)` + `AXIS_ARROWS` (`app.js`)
- [x] T-D2 · `LEAGUE_MAPS` declara `xDir`/`yDir` + `xQual`/`yQual` (y `xLabel`/`yLabel` para el nombre largo)
- [x] T-D3 · `_mapAxis()` arma títulos y rótulos de promedio; `_drawLeagueMap` lo usa
- [x] T-D4 · `drawLeagueScatter` dibuja `xAvgLabel`/`yAvgLabel`; se borró `_DEFAULT_AXIS` (sin uso y con la flecha `↑` vieja)
- [x] T-D5 · Lienzo chico: en vez de achicar la fuente, lienzo cuadrado en móvil (ver desviaciones)
- [x] T-E1 · `CACHE` → `smart-basket-v12`
- [x] T-E2 · `docs/frontend.md`
- [x] T-F1 … T-F12 · ver CA

## Estado de CA (gate de aceptación)
Chromium headless sobre la base local (13 partidos). Los rótulos del lienzo se capturan interceptando `fillText`.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Títulos: "OER (→ mejor ataque)" / "DER (↓ mejor defensa)", "OR% (→ mejor)" / "DR% (↑ mejor)", "Recuperos por partido (→ más robos)" / "Puntos por partido (↑ más puntos)" |
| CA-2 | ✅ | Rebotes: el punto más a la derecha es LAGOMAR (mayor `or_pct`) y el más alto VERDIRROJO (mayor `dr_pct`); `y.reverse = false` |
| CA-3 | ✅ | Eficiencia: DER con `↓` y escala sin invertir (menor DER abajo), OER con `→` |
| CA-4 | ✅ | En los 3 presets el lienzo dibuja solo "Prom. OER"/"Prom. DER", "Prom. OR%"/"Prom. DR%", "Prom. Recuperos"/"Prom. Puntos"; ningún texto con flecha fuera de los títulos |
| CA-5 | ✅ | `_mapAxis` con DER (`lower`) en X → "DER (← mejor defensa)"; PACE (`neutral`) → "PACE", sin flecha |
| CA-6 | ✅ | `or_pct = null` inyectado en un equipo → 13 puntos de 14, sin errores |
| CA-7 | ✅ | 360 px: lienzo 310×310, títulos completos en los 3 presets, sin scroll horizontal. Antes se cortaba el título Y (lienzo 2:1 de 155 px de alto) |
| CA-8 | ✅ | Recorrido alternando presets: 0 errores JS |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: N/A
- Endpoints probados manualmente: ✅ (`/api/league`)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- **T-D5:** el plan proponía achicar la fuente de los títulos a 10 px en lienzos < 480 px. Con el lienzo 2:1 de 155 px de
  alto, el título Y ("Puntos por partido (↑ más puntos)") no entraba ni así. Se usa `aspectRatio` 1 en ≤ 768 px (lienzo
  cuadrado): el título entra completo y la dispersión se lee mejor. Desktop sin cambios.
- Se borró `_DEFAULT_AXIS` de `charts.js`: el único llamador pasa `axis` siempre, y el default conservaba la flecha
  `↑` en el eje X.
- La ayuda del preset Rebotes pasó a "Derecha = mejor rebote ofensivo | Arriba = mejor rebote defensivo | Arriba-derecha =
  domina ambos tableros", con el mismo formato que los otros presets (RF-6).

## Docs actualizados
- [x] `docs/frontend.md` — §Charts (`axis` con `xAvgLabel`/`yAvgLabel`, lienzo cuadrado en móvil), §Vista Liga (flecha
  derivada de `xDir`/`yDir`, rótulos "Prom. <métrica>", métricas neutrales)

## Deuda / TODO
- → T-05: tomar la dirección de cada métrica del catálogo (`metricDef(key).direction`) en lugar de declararla en el preset.
- Nombres de equipo largos se cortan en el borde derecho del lienzo (previo a C-10, fuera de alcance).
