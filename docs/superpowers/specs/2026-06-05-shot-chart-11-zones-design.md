# Shot Chart — 11 Zonas con Métrica P/F

**Fecha:** 2026-06-05  
**Scope:** Player shot chart únicamente  
**Referencia visual:** imagen "El Metro 2022" — layout idéntico, dark theme del app

---

## Zonas (11 total)

Coinciden exactamente con la imagen de referencia:

| Clave | Descripción | Tipo |
|-------|-------------|------|
| `restricted_area` | Área restringida — cancha cercana | 2pt |
| `mid_left_close` | Low block izquierdo (cerca del poste) | 2pt |
| `mid_right_close` | Low block derecho | 2pt |
| `mid_left_far` | Elbow izquierdo | 2pt |
| `mid_right_far` | Elbow derecho | 2pt |
| `mid_top` | Zona alta del key (floaters/mid) | 2pt |
| `left_corner_3` | Esquina 3 izquierda | 3pt |
| `right_corner_3` | Esquina 3 derecha | 3pt |
| `left_wing_3` | Ala 3 izquierda (above break) | 3pt |
| `right_wing_3` | Ala 3 derecha (above break) | 3pt |
| `top_key_3` | 3 top del arco (centro) | 3pt |

---

## Clasificación de zonas — lógica de coordenadas

Sistema de coordenadas FIBA LiveStats normalizado:  
- `x`: 0–100, centro = 50, izquierda < 50  
- `y`: 0–100, baseline = 0, aumenta alejándose del aro

### 3pt shots (`action_type == "3pt"`)

```
y < 14:
  x < 50  → left_corner_3
  x >= 50 → right_corner_3
y >= 14:
  x < 38  → left_wing_3
  x >= 62 → right_wing_3
  else    → top_key_3
```

### 2pt shots — con coordenadas válidas (x != 0 or y != 0)

```
sub_type tiene keyword de pintura (layup/dunk/tip/etc.) OR (x in 38–62 AND y < 20):
  → restricted_area

resto:
  y < 25:
    x < 45  → mid_left_close
    x >= 55 → mid_right_close
    else    → restricted_area  (centro cercano)
  y >= 25:
    x < 42  → mid_left_far
    x >= 58 → mid_right_far
    else    → mid_top
```

### 2pt sin coordenadas (x == 0 and y == 0)

Fallback solo por sub_type:
- keywords de pintura → `restricted_area`
- default → `mid_top`

---

## Métricas por zona

```
freq    = total intentos desde esa zona
made    = canastas convertidas
pct     = made / freq (FG%)
pf      = (made × point_value) / freq
            2pt → point_value = 2
            3pt → point_value = 3
```

### Resumen global (badge)

```
global_pf  = total_pts / total_fga
efg_pct    = (fgm2 + 1.5 × fgm3) / total_fga
games      = cantidad de partidos del jugador en el dataset
```

---

## Color coding — absoluto por P/F

| P/F | Color |
|-----|-------|
| ≥ 1.05 | Verde `rgba(22,163,74,0.80)` |
| 0.90 – 1.04 | Lima `rgba(101,163,13,0.68)` |
| 0.70 – 0.89 | Naranja `rgba(234,88,12,0.68)` |
| < 0.70 | Rojo `rgba(220,38,38,0.78)` |
| Sin datos | Superficie de cancha (sin color) |

---

## Formato de etiqueta por zona

```
[freq]  [P/F]       ← tamaño pequeño, misma línea
   XX.X%            ← grande, negrita
```

Fondo: rectángulo redondeado con el color de eficiencia.  
Texto: blanco sobre todos los colores.

---

## Badge global (esquina superior derecha del SVG)

```
┌─────────────────────────────┐
│  P/F  │  eFG%  │  N part.  │
└─────────────────────────────┘
```

---

## Cambios de código

### `backend/app.py`

1. Nueva función `_classify_zone_11(action_type, sub_type, x, y)` → reemplaza `_classify_zone`
2. Actualizar endpoint `GET /api/shots/<team_code>/<player_name>`:
   - Devolver dict de 11 zonas con `{freq, made, pct, pf}` por zona
   - Agregar campo `summary: {global_pf, efg_pct, games}`
   - Mantener retrocompatibilidad: si el frontend espera `zones.paint` etc, mapear o romper limpio

### `frontend/js/app.js`

1. Reemplazar `_shotChartSVG(zones, totalShots, leagueZones)` con nueva función
2. Nueva geometría SVG con 11 zonas dibujadas sobre cancha half-court dark
3. Superficie de cancha: azul-grisáceo oscuro `#1a2744` (diferente del fondo negro)
4. Etiquetas posicionadas en el centro geométrico de cada zona
5. Badge global en esquina sup-der

---

## Fuera de scope

- Shot chart a nivel equipo (pendiente para iteración futura)
- Comparación vs promedios de liga por zona (se puede agregar después)
- Dots de tiros individuales (no está en la referencia)
