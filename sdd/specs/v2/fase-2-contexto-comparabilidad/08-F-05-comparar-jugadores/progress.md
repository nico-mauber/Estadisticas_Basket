# Progress — F-05: Comparar jugadores

> **Estado:** ✅ Implementado (pestaña Jugadores en Comparar, radar por percentiles, tabla enfrentada y entrada desde el plantel)
> **Fecha:** 2026-10-20

## Estado de tareas
- [x] RF-1 · Pestaña Jugadores en la sección Comparar con dos selectores independientes
- [x] RF-2 · Radar comparativo y tabla de métricas enfrentadas con el ganador resaltado; exportable por bloque
- [x] RF-3 · Jugadores de equipos y competencias distintas, sin restricción
- [x] RF-4 · Cada métrica trae el percentil del jugador en SU competencia (`percentile` del payload de T-01)
- [x] RF-5 · Métricas del conjunto estándar de T-05
- [🔶] RF-6 · El radar usa 6 ejes en percentiles (puntos, eficiencia, rebotes, asistencias, robos, uso), no los mismos ejes normalizados que el radar de equipos: con dos ligas distintas no hay una escala común
- [x] RF-7 · Sin dato → "—" y la fila no marca ganador; las métricas neutras (minutos, partidos) nunca marcan ganador
- [x] RF-8 · `?cmp_a=<id>&cmp_b=<id>` en la dirección; abrirla reconstruye la comparación
- [x] RF-9 · Entrada desde el plantel (F-08): "Elegir para comparar" → dos filas → «Comparar»

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| Dos pestañas en Comparar | ✅ | Chromium: Equipos / Jugadores; el panel de equipos se oculta |
| Selectores completos | ✅ | 188 jugadores de todos los equipos |
| Comparación entre equipos distintos | ✅ | A. Agarbado (OLI) vs A. Amaral (LBO) |
| Percentiles por competencia | ✅ | Cada celda trae su percentil con color |
| Ganador por dirección de la métrica | ✅ | En PER gana quien tiene menos; minutos y partidos no marcan ganador |
| Nulos | ✅ | Celdas "—" y esa fila sin ganador |
| URL | ✅ | `?cmp_a=&cmp_b=`; abrir la dirección reconstruye la comparación |
| Desde el plantel | ✅ | Dos filas marcadas → Comparar abre la pestaña con ambos cargados |
| Exportación | ✅ | CSV por bloque (`comparar-<a>-<b>.csv`) |

## Gates técnicos
- Backend sin cambios: ✅ (reutiliza `GET /api/metrics/player`)
- Consola del navegador sin errores JS: ✅ (1280 y 360 px)
- Verificación: `f05_browser.py` 34/34, regresión completa en verde

## Desviaciones respecto a docs/ o plan
- **Sin router X-01:** la pestaña vive dentro de la sección Comparar y el estado va en `?cmp_a=&cmp_b=`, no en el hash.
- **Radar en percentiles:** `drawCompareRadar` (equipos) normaliza contra UNA liga; para dos jugadores de competencias distintas eso no aplica, así que se agregó `drawComparePlayersRadar`, que grafica los percentiles ya calculados por cada competencia.
- **Selectores:** se llenan con la tabla `search_players` (una llamada), no con un endpoint nuevo.

## Docs actualizados
- ✅ `docs/frontend.md`

## Deuda / TODO
- El contexto de T-03 no se aplica a esta comparación (cada jugador usa su selección completa).
- `t()` para el copy (F-21).
