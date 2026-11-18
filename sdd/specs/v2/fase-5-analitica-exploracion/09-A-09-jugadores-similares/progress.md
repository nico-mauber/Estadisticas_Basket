# Progress — A-09: Jugadores similares

> **Estado:** 🔶 Implementado en Jugador (pestaña Similares) y en Explorar › Similares, con exportación. Bloque "emparejamiento propuesto por perfil" de F-03 y protocolo de validación escrito con su hoja exportable (2026-11-17); falta ejecutarlo con alguien del ambiente.
> **Fecha:** 2026-11-04

## Qué se hizo
- `backend/similar.py` (perfil de nueve dimensiones, z-score dentro de la competencia, distancia euclidiana, similitud `100·exp(−d)`) y `GET /api/similar/<player_id>`; `similar.top_n` activa en Configuración.
- `components/similar-panel.js` y la pestaña **Similares** de Jugador (filtros de posición y minutos, método explicado, valores de las nueve dimensiones). `sw.js` v58.

## Estado de CA
`a09_sim.py` 21/21 y `a09_browser.py` 19/19 (1280 y 360 px).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ⬜ | "reconocibles por alguien del ambiente": falta el protocolo de validación manual (RF-17) |
| CA-2 | ✅ | exactamente `similar.top_n` resultados distintos y sin el de referencia |
| CA-3 | ✅ | distancia del primero recalculada a mano con las funciones del módulo (0,74) |
| CA-4 | ✅ | posición G → solo G; "misma" usa la de la referencia |
| CA-5 | ✅ | cada resultado compara al menos 6 dimensiones (nunca 0 ni la media) |
| CA-6 | ✅ | un mínimo menor al de la población se sube; nadie bajo el mínimo |
| CA-7 | ✅ | la distancia A→B es la de B→A |
| CA-8 | 🔶 | el reparto de tiro usa pintura, media y triples del conjunto estándar, no las 11 zonas de C-03 |
| CA-9 | ✅ | pestaña Similares de Jugador |
| CA-10 | ✅ | exportación CSV/XLSX/PNG/PDF de la tabla con referencia, filtros y método en la cabecera (`a09_browser2.py`) |
| CA-11 | ✅ | jugador inexistente 404; competencia inexistente, posición inválida, `top_n` fuera de rango y `all` → 400 |
| CA-12 | ✅ | `profile_matchups` en `/api/prepare` y bloque del informe (`a09q_sim.py`, `a09q_browser.py`) |
| CA-13 | ✅ | `similar.top_n` cambia sin reiniciar |
| CA-14 | ✅ | 360 px sin scroll horizontal de página (la tabla se desplaza dentro de su caja) |
| CA-15 | ⬜ | no se midió en frío con 74 jugadores |

## Desviaciones
- Reparto por zona con tres componentes (pintura, media distancia, triples) en vez de 11 zonas.
- Sin Explorar, exportación ni el bloque de F-03.
- Copy sin `t()` (F-21).

## Explorar › Similares y exportación (2026-11-16)
- Pestaña Similares en Explorar: equipo + jugador → tabla de similares; `?team=&player=` en la dirección (recargar la reproduce). Exportación de la tabla (CA-10). Chromium 1280/360 px e inglés sin textos sin traducir (`a09_browser2.py` 13/13).
- Desvío: la exportación es de la tabla visible (`tableToData`), no una tabla T-06 registrada; el cálculo sigue en `GET /api/similar/<id>`.

## Emparejamiento por perfil en Preparar y protocolo de validación (2026-11-17)
- **RF-15 (incremento de F-03), con la interpretación propuesta del spec §9 (decisión del usuario, 2026-11-17):** `GET /api/prepare` suma `profile_matchups`: para cada una de las 3 amenazas de mayor USO% del rival, los 3 jugadores PROPIOS de perfil más parecido (misma competencia, mismo cálculo de A-09) con similitud, min/partido y USO%. Bloque "Emparejamiento propuesto por perfil" en el informe y en el PDF/PNG, rotulado "Estimación por similitud de perfil (A-09): no es un marcaje individual." Sin puntaje compuesto nuevo.
- **RF-17, protocolo de validación** (a ejecutar con una persona del ambiente; queda registrado acá cuando se haga):
  1. Persona: entrenador o analista de la FUBB que conozca a los jugadores de la competencia y no haya visto antes el resultado.
  2. Datos: la competencia real más completa disponible en QA o producción (no el seed de 13 partidos).
  3. Referencias: 5 jugadores de roles distintos (base organizador, escolta anotador, ala, ala-pívot, pívot reboteador), elegidos por la persona o acordados con ella.
  4. Presentación: Explorar › Similares → "⬇ Hoja de validación" (CSV/XLSX): los 10 primeros con nombre, equipo, posición y min/partido, **sin** similitud ni distancia, y columnas "Marca" y "Comentario".
  5. Marcado: por resultado, "equivalente" (juega parecido), "parecido" (comparte rasgos principales) o "no"; para los "no", la dimensión que cree que falló.
  6. Registro: en esta sección, tabla referencia × resultado × marca y observaciones.
  7. Aprobación: al menos 4 de las 5 referencias con 6 o más resultados "equivalente" o "parecido".
  8. Si no se aprueba: anotar las dimensiones señaladas, evaluar un cambio de pesos o dimensiones como decisión nueva del cliente y repetir; no se ajustan parámetros sin registrarlo.
- **Pendiente operativo:** ejecutar el protocolo (CA-1 del cliente) con una persona del ambiente.
- Evidencia: `a09q_sim.py` 8/8 (una fila por amenaza, candidatos del equipo propio ordenados por similitud, min/partido y USO%); `a09q_browser.py` 18/19 (Chromium 1280/360 px e inglés; la única marca es una frase que el servidor ya devuelve en inglés): bloque en pantalla, en el PDF y hoja de validación sin similitud.
