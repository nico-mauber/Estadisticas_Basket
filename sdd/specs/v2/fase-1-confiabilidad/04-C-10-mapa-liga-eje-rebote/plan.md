# Plan — C-10: Mapa de liga — eje de rebote

> **ID:** C-10 · **Prioridad:** P2 · **Fase y orden:** 1·04
> **Depende de:** C-11 Grupo 0 (P-00) — [`../01-C-11-tratamiento-de-nulos/plan.md`](../01-C-11-tratamiento-de-nulos/plan.md) · **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [`spec.md`](spec.md) · Especificación v2 §2 · C-10 · Arquitectura §1.5 D-18, §3.6, §3.13, §3.20
> **Estimación:** S · 1,5–3 h

## 1. Enfoque
Solo frontend. Los presets de `LEAGUE_MAPS` dejan de traer los títulos con flechas escritas a mano y pasan a declarar la
**dirección** de cada métrica (`higher` | `lower` | `neutral`) y un calificador; un helper puro arma el título con la flecha
correcta según eje y dirección. En `charts.js`, el rótulo interno `↑ ${xName}` (residuo D-18) se reemplaza por un rótulo de
promedio sin flecha que llega en `axis` desde `app.js` (así `charts.js` no contiene copy). Todo copy pasa por `t()`.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `frontend/js/app.js` | js-view | `LEAGUE_MAPS`: reemplazar `xTitle`/`yTitle` por `xDir`/`yDir` + `xQual`/`yQual`; nuevo helper `_axisTitle(name, dir, orient, qual)`; `_drawLeagueMap()` arma `axis` completo (títulos + `xAvgLabel`/`yAvgLabel`) antes de llamar a `drawLeagueScatter`; `hint` vía `t()` | RF-1, RF-2, RF-3, RF-5, RF-6 |
| `frontend/js/charts.js` | js-chart | `drawLeagueScatter`: el plugin `afterDraw` dibuja `axis.xAvgLabel`/`axis.yAvgLabel` (sin flecha) en lugar de `` `↑ ${xName}` ``/`${yName}`; fallback `xName`/`yName` si no llegan; sin cambio de firma | RF-4, RF-7 |
| `frontend/sw.js` | sw | Subir `CACHE` al entero asignado al integrar | RF-1, RF-4 |
| `docs/frontend.md` | doc (cierre) | §Charts: `axis` agrega `xAvgLabel`/`yAvgLabel`; §Vista Liga: la flecha se deriva de la dirección (`xDir`/`yDir`), rótulos de promedio sin flecha; copy nuevo | RF-1…RF-6 |

Matriz RF→archivo: RF-1/RF-2/RF-3/RF-5/RF-6 → `app.js` · RF-4 → `charts.js` · RF-7 → `charts.js` (filtro `valid` ya existe
en `dev`; se verifica) · todos → `sw.js`, `docs/frontend.md`.

## 3. Backend — rutas y modelos
Sin cambios. Consume `GET /api/league` tal cual (campos `oer`, `der`, `or_pct`, `dr_pct`, `stl`, `pts`).

## 4. Backend — lógica
Sin cambios.

## 5. Frontend — capa API
Sin cambios (`api.league(comp)` existente).

## 6. Frontend — UI
**Dónde vive:** fase 1, vista Liga (card "Mapa de liga", `renderLeague` → `_drawLeagueMap`). Con X-01 pasa a `#/liga/mapa`
sin cambios en el componente.

**Presets (nueva forma de `LEAGUE_MAPS`, pseudo-código):**
```
{ id: "ef",  label: t('liga.mapa.preset.ef', 'Eficiencia (OER / DER)'),
  axis: { xKey: "oer",    xName: "OER",  xDir: "higher", xQual: t('liga.mapa.qual.mejor_ataque', 'mejor ataque'), xPct: false,
          yKey: "der",    yName: "DER",  yDir: "lower",  yQual: t('liga.mapa.qual.mejor_defensa', 'mejor defensa'), yPct: false },
  hint: t('liga.mapa.hint.ef', 'Derecha = mejor ataque (OER alto) | Abajo = mejor defensa (DER bajo) | Abajo-derecha = elite') }
{ id: "reb", axis: { xKey: "or_pct", xName: "OR%", xDir: "higher", xQual: 'mejor', …, yKey: "dr_pct", yName: "DR%", yDir: "higher", yQual: 'mejor' } }
{ id: "rec", axis: { xKey: "stl", xName: "Recuperos por partido", xDir: "higher", xQual: 'más robos',
                     yKey: "pts", yName: "Puntos por partido",    yDir: "higher", yQual: 'más puntos' } }
```
`xName` corto para el tooltip (hoy "Recuperos"/"Puntos") se conserva como `xShort`/`yShort` si difiere del nombre largo del
título (el tooltip de `charts.js` usa `xName`; se mantiene el valor corto actual para no alargarlo).

**Helper `_axisTitle(name, dir, orient, qual)`** (puro, en `app.js`; PROPUESTA de nombre, no está en §8 de la arquitectura
porque es local a la vista):
```
ARROWS = { x: { higher: "→", lower: "←" }, y: { higher: "↑", lower: "↓" } }   // eje Y no invertido (reverse: false)
si dir == "neutral" o dir no está en ARROWS[orient] → return name
return `${name}  (${ARROWS[orient][dir]} ${qual})`
```
Si en el futuro se invierte un eje (`reverse: true`), el helper recibe `reversed` y cambia la flecha: se documenta en
`docs/frontend.md` para quien agregue presets.

**`_drawLeagueMap()`:** arma `axis = {...map.axis, xTitle: _axisTitle(...), yTitle: _axisTitle(...), xAvgLabel:
t('liga.mapa.prom', 'Prom. {metrica}', {metrica: xShort}), yAvgLabel: …}` y llama a `drawLeagueScatter("chart-scatter",
_leagueTeams, axis)`.

**`charts.js` `afterDraw`:** `ctx.fillText(axis.xAvgLabel ?? xName, xAvg + 4, top + 14)` y `ctx.fillText(axis.yAvgLabel ??
yName, left + 4, yAvg − 6)`. El resto del plugin (líneas punteadas, nombres de equipo) no cambia.

**Estados:** loading/vacío/error sin cambios. Nulos: `valid = teams.filter(t => t[xKey] != null && t[yKey] != null)` ya
excluye nulos en `dev`; los promedios de las líneas se calculan sobre `valid` (sin cambio).

**Mobile (768 px / 360 px):** los títulos de Chart.js se dibujan en el lienzo; el más largo ("Recuperos por partido  (→ más
robos)", ~36 caracteres) se verifica a 360 px; si recorta, se usa `font.size` 10 en pantallas < 480 px (ajuste en
`scales.x.title.font`, dentro de `drawLeagueScatter`, condicionado a `canvas.clientWidth < 480`).

## 7. Navegación
Sin cambios.

## 8. Contratos de datos
Objeto `axis` de `drawLeagueScatter` (contrato interno frontend, documentado en `docs/frontend.md` §Charts):
```
{ xKey, yKey, xName, yName, xTitle, yTitle, xPct, yPct,
  xAvgLabel?: string, yAvgLabel?: string }     // NUEVOS, opcionales
```

## 9. Manejo de errores y offline
Sin errores nuevos. Subir `CACHE` en `sw.js` (cambian `app.js` y `charts.js`, ambos en `STATIC`).

## 10. Riesgos / decisiones
- **Decisión:** flecha derivada de `dir` + orientación, no texto libre (evita que un preset nuevo repita el defecto).
- **Decisión:** rótulos internos "Prom. <métrica>" sin flecha (spec §9).
- **Riesgo:** colisión con cambios de C-09 en `renderLeague` (misma vista, orden 06). Mitigación: C-10 solo toca
  `LEAGUE_MAPS`, `_drawLeagueMap` y `drawLeagueScatter`; C-09 toca la card de tabla general.
- **INCREMENTO DIFERIDO (→ T-05):** reemplazar `xDir`/`yDir` por `metricDef(xKey).direction` de `core/catalog.js`
  ([`../13-T-05-conjunto-estandar-metricas/plan.md`](../13-T-05-conjunto-estandar-metricas/plan.md)); las claves `stl` y `pts`
  del ranking de liga corresponden a las claves estándar `stl`/`pts`.
- **Desviaciones respecto de la arquitectura:** ninguna.
- **Dependencias técnicas:** `core/i18n.js` `t()` (C-11) e integración de `dev` (Grupo 0, títulos con `→` y filtro de nulos
  en `drawLeagueScatter`) — [`../01-C-11-tratamiento-de-nulos/plan.md`](../01-C-11-tratamiento-de-nulos/plan.md).
- **Estimación:** S · 1,5–3 h.
