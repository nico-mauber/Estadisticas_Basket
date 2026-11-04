# Progress — A-10: Insights automáticos

> **Estado:** 🔶 Implementado para equipo y jugador (`GET /api/insights`, bloque "Insights" en Equipo › Resumen y en Jugador). Falta el "cambio brusco de rendimiento" que consume Mi equipo (F-12).
> **Fecha:** 2026-11-04

## Qué se hizo
- `phrases.insights` y seis plantillas genéricas (alto y bajo, por dirección) en `phrases/es.json`; conjunto de métricas y familias de insight en `phrases/rules.json`. Las plantillas de insight admiten hasta 160 caracteres.
- `GET /api/insights` (equipo y jugador) y las claves `insights.low_pct`, `insights.high_pct`, `insights.min_items` e `insights.max_items` activas en Configuración.
- `components/insights-panel.js` y el bloque en Equipo y Jugador. `sw.js` v56.

## Estado de CA
`a10_sim.py` 15/15 y `a10_browser.py` 13/13 (1280 y 360 px).

| CA | Estado | Evidencia |
|---|---|---|
| Ningún insight contradice la pantalla (cliente) | ✅ | valor, promedio y percentil de cada frase son los de la ficha de `/api/metrics/team` y `/api/metrics/player` (49 insights de equipo y los de 24 jugadores verificados) |
| Disparo ≤ 10 o ≥ 90 | ✅ | solo percentiles extremos |
| Plantillas fijas | ✅ | validadas al cargar (sin dígitos, solo marcadores permitidos) |
| Menos es mejor | ✅ | la frase lo dice y `good` sigue la orientación |
| Una frase por familia, hasta `max_items` | ✅ | |
| Muestra baja | ✅ | sin ítems y con el motivo |
| Nulos | ✅ | no disparan frase |
| Contexto | ✅ | se recalcula con el contexto y lo indica |
| Umbrales de Configuración | ✅ | cambian sin reiniciar |
| Cambio brusco (RF-16) | ⬜ | → F-12 |

## Desviaciones
- **Convive con "Análisis del equipo"** (`team-insights`): este usa umbrales 70/30 con 19 métricas; el de A-10 sigue el criterio del cliente (10/90). Falta decidir si el anterior se retira.
- Las frases de métricas neutrales no citan el percentil (por redacción de la plantilla).
- Copy sin `t()` (F-21).
