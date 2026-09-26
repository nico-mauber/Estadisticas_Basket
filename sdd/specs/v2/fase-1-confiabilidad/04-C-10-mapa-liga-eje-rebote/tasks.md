# Tasks — C-10: Mapa de liga — eje de rebote

> **ID:** C-10 · **Prioridad:** P2 · **Fase y orden:** 1·04
> **Depende de:** C-11 Grupo 0 (P-00) — [`../01-C-11-tratamiento-de-nulos/tasks.md`](../01-C-11-tratamiento-de-nulos/tasks.md) · **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [`spec.md`](spec.md) · [`plan.md`](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · N/A — sin cambio de esquema · Done: `git diff --stat` no lista `backend/`

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · N/A — sin cambios de backend · Done: idem T-A1

### Grupo C — Frontend: api.js
- [ ] T-C1 · N/A — `api.js` sin cambios

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · Helper puro `_axisTitle(name, dir, orient, qual)` con la tabla de flechas por eje/dirección · `frontend/js/app.js` · cubre RF-1, RF-2 · Done: en consola, `_axisTitle("DER","lower","x","mejor defensa")` devuelve `"DER  (← mejor defensa)"` y con `"neutral"` devuelve solo el nombre (exponer temporalmente en `window` para la prueba y retirarlo)
- [ ] T-D2 · Reescribir `LEAGUE_MAPS` con `xDir`/`yDir`/`xQual`/`yQual` (+ nombre corto para tooltip) y copy vía `t()` · `frontend/js/app.js` · cubre RF-3, RF-5, RF-6 · Done: los tres presets se dibujan con los títulos del copy de spec §6
- [ ] T-D3 · `_drawLeagueMap()` arma `axis` con `xTitle`/`yTitle` derivados y `xAvgLabel`/`yAvgLabel` ("Prom. {metrica}") · `frontend/js/app.js` · cubre RF-1, RF-4 · Done: el objeto `axis` pasado a `drawLeagueScatter` tiene las 4 claves
- [ ] T-D4 · `drawLeagueScatter`: rótulos internos desde `axis.xAvgLabel`/`axis.yAvgLabel` (fallback nombre), eliminar `` `↑ ${xName}` `` · `frontend/js/charts.js` · cubre RF-4, RF-7 · Done: `grep -n "↑ \${xName}" frontend/js/charts.js` → sin resultados
- [ ] T-D5 · Ajuste de tamaño de fuente del título de eje en lienzos < 480 px (solo si la verificación de CA-7 muestra recorte) · `frontend/js/charts.js` · cubre RF-1 · Done: títulos completos a 360 px

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Subir `CACHE` al entero asignado · `frontend/sw.js` · cubre RF-1, RF-4 · Done: Cache Storage con la versión nueva
- [ ] T-E2 · Documentar `axis.xAvgLabel`/`yAvgLabel`, la regla de flechas derivadas y el copy nuevo · `docs/frontend.md` · cubre RF-1…RF-6 · Done: secciones actualizadas

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · N/A: no toca esquema (registrar en progress.md)
- [ ] T-F3 · `curl -s -b cookies.txt http://localhost:5000/api/league` → 200 con `oer, der, or_pct, dr_pct, stl, pts` por equipo (endpoint sin cambios; base del recorrido)
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Liga y alternar los tres presets (**CA-8**)
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress.md
- [ ] T-F6 · **CA-1 (CA del cliente)** · En cada preset, leer los dos títulos y comprobar contra las posiciones del gráfico que la flecha apunta al lado del mejor (evidencia: captura por preset en progress.md)
- [ ] T-F7 · **CA-2** · Preset Rebotes: ordenar la tabla de ranking por OR% y por DR%; el líder de OR% es el punto más a la derecha (`→`) y el líder de DR% el más alto (`↑`); en consola `Chart.getChart('chart-scatter').scales.x.getPixelForValue(<or_pct líder>)` es el máximo de los píxeles X de los puntos
- [ ] T-F8 · **CA-3** · Preset Eficiencia: el equipo de menor DER es el punto más bajo; el de mayor OER el más a la derecha
- [ ] T-F9 · **CA-4** · En los tres presets, inspección visual del lienzo: rótulos "Prom. <métrica>" sin flechas; ninguna `↑` junto a la línea vertical
- [ ] T-F10 · **CA-5** · En consola: `drawLeagueScatter("chart-scatter", teams, {xKey:"der", yKey:"oer", xName:"DER", yName:"OER", xTitle:_axisTitle("DER","lower","x","mejor defensa"), yTitle:_axisTitle("OER","higher","y","mejor ataque")})` (con `teams` y helpers expuestos temporalmente) → título X con `←`
- [ ] T-F11 · **CA-6** · DevTools > intercepción de `fetch` (override de `window.fetch` que pone `or_pct: null` en un equipo de `/api/league`): el preset Rebotes dibuja un punto menos y sin error
- [ ] T-F12 · **CA-7** · Modo dispositivo a 360 px: títulos de eje completos; `document.documentElement.scrollWidth === document.documentElement.clientWidth`

## Matriz de cobertura
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-D1, T-D2, T-D3, T-D4, T-F6 |
| CA-2 | T-D2, T-D3, T-F7 |
| CA-3 | T-D2, T-D3, T-F8 |
| CA-4 | T-D4, T-F9 |
| CA-5 | T-D1, T-F10 |
| CA-6 | T-D4, T-F11 |
| CA-7 | T-D5, T-F12 |
| CA-8 | T-E1, T-F4 |

## Dependencias externas
- Grupo 0 de C-11 integrado (títulos con `→` y filtro de nulos de `dev`) y `core/i18n.js`.
- Base con al menos 2 equipos (13 partidos del seed; `SEED_ENABLED=1` + sesión).
- Coordinación con C-09 (misma vista Liga) y número de `CACHE` asignado al integrar.
