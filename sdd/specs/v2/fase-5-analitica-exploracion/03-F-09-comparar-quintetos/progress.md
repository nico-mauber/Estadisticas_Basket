# Progress — F-09: Comparar quintetos

> **Estado:** ✅ Implementado (pestaña Quintetos de Comparar con radar, tabla enfrentada, badge de muestra y valor ajustado). Falta la acción "Comparar" desde la tabla de quintetos de F-06.
> **Fecha:** 2026-11-04

## Qué se hizo
- `components/compare-lineups.js` y la pestaña **Quintetos** de Comparar; dos selectores de combinación (equipo y 3 a 5 jugadores), del mismo equipo o de equipos distintos.
- Usa `api.metrics("lineup", {id})`, la misma fuente que la tabla de quintetos de F-06; no hay endpoint nuevo.
- Ids en la dirección (`?cmp_qa=…&cmp_qb=…`). `sw.js` v56.

## Estado de CA
`f09_browser.py` 25/25 (1280 y 360 px).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | radar y tabla enfrentada con el badge de muestra de ambos a la vista |
| CA-2 | ✅ | en OER, DER y Net Rating gana el valor ajustado; se muestran crudo y ajustado |
| CA-3 | 🔶 | por construcción (nulo "—" con razón y sin ganador); sin prueba con un quinteto sin tiros libres |
| CA-4 | ✅ | equipos distintos se comparan; cada columna lleva su equipo |
| CA-5 | 🔶 | misma fuente que F-06 (`api.metrics("lineup")`); no se contrastó fila por fila |
| CA-6 | ✅ | misma combinación en A y B → "Elegí dos combinaciones distintas." |

## Desviaciones
- Sin la acción "Comparar" en la tabla de quintetos de F-06 (RF-10).
- Sin exportación del resultado.
- Copy sin `t()` (F-21).
