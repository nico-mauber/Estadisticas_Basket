# Roadmap SDD — Bloque C (Correcciones C-01 … C-11)

> Fuente: `Smart-Basket Especificacion v2.docx` §1 "Bloque C — Correcciones" (Agosto 2026).
> Este archivo NO es un spec: define el **corte en features** y el **orden** para recorrer el pipeline
> `sdd/01-specify.md` → `02-plan.md` → `03-tasks.md` → `04-implement.md` una vez por feature.
> Alcance: solo Bloque C. Los bloques T / F / A quedan fuera (ver §6, cruces).

---

## 1. Por qué 7 features y no 11

El doc numera 11 correcciones, pero varias comparten superficie de código y criterio de verificación.
La Constitución (§22 del README) pide "una feature o cambio concreto" por spec: agrupar los que se
tocan y se verifican juntos evita 11 ciclos de gate para cambios de 1 hora, y evita que dos specs
editen la misma función.

| Feature | Cubre | P | Superficie principal |
|---|---|---|---|
| **12 — nulos: orden, color y DNP** ✅ **CERRADA** | C-11 | P0 | `app.js` (orden + `statClass`), `app.py` (`_avg`, DNP) |
| **13 — dedup de jugadores** | C-08 | P0 | `app.py` (`search_players`, `team_players`), normalización |
| **14 — promedios de liga** | C-02 | P0 | `stats_engine.league_averages`, `app.py`, `app.js` |
| **15 — métricas de jugador rotas** | C-01, C-04 | P0/P1 | `stats_engine.calc_player_stats` |
| **16 — tiro completo y PPT** | C-03, C-07 | P1 | `_zones_from_shots`, sección Tiro de equipo y jugador |
| **17 — vista Liga** | C-09, C-10 | P1/P2 | `league_overview`, mapa de liga |
| **18 — etiquetas y umbrales** | C-05, C-06 | P2/P1 | `clutch.py`, labels en `app.js` + `docs/` |

---

## 2. Orden de ejecución y por qué

```
12 ──► 13 ──► 14 ──► 15        16 ┐
(nulos) (dedup) (Ø liga) (jugador)  17 ├─ independientes, cualquier orden
                                    18 ┘
```

**La cadena 12 → 13 → 14 → 15 no es negociable.** Cada eslabón cambia los números que el
siguiente tiene que verificar; invertir el orden obliga a re-verificar lo ya cerrado.

- **12 antes que todo.** C-11 define qué significa un número en pantalla. Cerrar C-01 o C-02
  antes implica validarlos contra una semántica que después cambia.
- **13 antes de 14.** El dedup altera la población de jugadores; un promedio de liga calculado
  sobre la base con duplicados queda mal y hay que rehacerlo.
- **14 antes de 15.** El síntoma `Ø 0.0%` de C-01 sale del fallback de `league_averages()`
  (ver §3). Arreglado en 14, parte de C-01 desaparece sola.
- **16, 17, 18 son independientes** entre sí y del resto: no comparten función con la cadena.
  Si hay más de una persona, van en paralelo desde el día 1.

---

## 3. Hallazgos de código previos al specify

Verificados sobre el repo, no supuestos. Entran como Fuentes (§2) de cada spec.

### 3.1 · Feature 08 ya resolvió el backend de C-11

`sdd/specs/08-nulos-vs-cero/` está cerrada con CA-1…CA-6 ✅. Ya implementa:
`_safe_div → None`, `net_rating` null-safe, `_avg()` que saltea `None` (team y player),
`_computeAvg()` con fallback `null`, y `PCT`/`DEC2`/`statClass` renderizando `"—"` neutral.

**C-11 NO es "implementar nulos" — es la fase 2 de Feature 08.** Lo que falta:

| Requisito C-11 | Estado | Trabajo real |
|---|---|---|
| Mostrar `"—"` en vez de 0 | ✅ hecho (F08) | Solo auditoría |
| NULL fuera de promedios y denominadores | ✅ hecho (F08) | Solo auditoría |
| NULL sin color de rendimiento | ⚠️ verificar | `statClass` (`app.js:17`) confirmado neutral en F08/T-D2; falta auditar las tablas que colorean por fuera del helper |
| **NULL al final en tablas ordenables, en ambos sentidos** | ❌ falta | 4 sitios: `app.js:439` (liga), `app.js:639` (clutch), `app.js:1564` (buscador), `charts.js:196/269` (por fecha, no aplica) |
| **DNP no cuenta como partido jugado** | ❌ falta | `app.py` `_avg()` de `player_stats` promedia sobre el game_log completo |
| Recorrido completo sin un solo 0 falso | ❌ falta | Auditoría pantalla por pantalla (el grueso de la feature) |

### 3.2 · El `Ø 0.0%` de C-01 y C-02 tienen la misma raíz

`sdd/specs/08-nulos-vs-cero/progress.md` §Desviaciones lo dejó registrado:

> *"`league_averages()` sin cambios: ya filtraba `None`; su fallback `{avg:0, best:0}` para una
> métrica totalmente ausente se conserva (contexto de liga, no rompe)."*

C-01 reporta el síntoma en producción: *"OR% y DR% se muestran vacíos ('—') con Ø 0.0%"*.
El `"—"` es correcto. El `Ø 0.0%` es ese fallback. **Se arregla en Feature 14, no en 15.**

Consecuencia de alcance: parte de C-01 no es un bug de cálculo sino la deuda de F08.
El spec de 15 debe confirmar contra el box score qué queda realmente roto **después** de 14.

### 3.3 · `pf` por zona ya es PPT

`_zones_from_shots` (`app.py:645`):

```python
z["pf"] = round(z["made"] * ZONE_POINTS[k] / z["attempts"], 3)
```

Eso es `puntos de la zona / intentos de la zona` = **PPT**, con la etiqueta equivocada.
C-03 es: renombrar `pf` → `ppt` en el contrato, **agregar** `efg` por zona (no existe hoy),
y limpiar la etiqueta del encabezado (`summary.global_pf`).
`docs/metrics.md:63` ya define `PPT = PTS / FGA` — la fórmula no se toca.

### 3.4 · La etiqueta es `PeP`, no `PEP`

C-05 dice "PEP". En el código no existe esa cadena. Lo que existe es **`PeP`**:
`app.js:781` (statBox del desglose ofensivo), `app.js:1111` (`rawRow` de Comparar),
`docs/database.md:60`, `docs/frontend.md:37`.
La columna DB `paint_pts` **no** se renombra (Constitución 5: sin migraciones destructivas);
solo cambia la etiqueta visible y la doc.

---

## 4. Detalle por feature

### Feature 12 — Nulos: orden, color y DNP `[P0]` · 12-18h
**Cubre C-11.** Continuación de Feature 08.
- Orden: `null` siempre al final, en ASC y DESC, en las 3 tablas ordenables.
- Color: ninguna celda `null` recibe verde/rojo (auditar coloreo fuera de `statClass`).
- DNP: un partido sin minutos no cuenta como PJ en los promedios del jugador.
- Auditoría de recorrido completo — es el grueso, no el código.
- Cierra la deuda de `charts.js` (`_norm()` mapea `null → 0` en el radar) que F08 dejó abierta.
- **Gate**: el CA del doc es *"recorrido completo de la app sin encontrar un solo 0 que en realidad
  sea un dato inexistente"*. Requiere checklist de pantallas en `progress.md`, no una muestra.

### Feature 13 — Dedup de jugadores `[P0]` · 5-7h
**Cubre C-08.**
- Clave: nombre normalizado (minúsculas, sin tildes, sin espacios dobles) + equipo + competencia.
- Al unificar: conservar la posición no vacía, sumar los partidos de ambos registros.
- Causa raíz: `playingPosition` ausente en algunos partidos de FIBA LiveStats.
- **Decisión de plan**: ¿dedup en query (`search_players` / `team_players`) o normalización
  al importar en `_persist_game`? La segunda arregla el origen pero no los partidos ya
  importados; la primera cubre el histórico sin migrar. Recomendado: ambas — normalizar al
  importar y agrupar en query.
- **Gate**: el total de jugadores de la base baja, y ningún equipo muestra dos fichas iguales.

### Feature 14 — Promedios de liga `[P0]` · 5-8h
**Cubre C-02.** Afecta 4 pantallas: perfil de equipo, evolución por partido, perfil de jugador,
evolución por partido de jugador.
- Base de cálculo: **todos** los partidos de la competencia y temporada seleccionadas,
  nunca el subconjunto filtrado en pantalla.
- Excluir nulos del promedio; nunca reemplazar nulo por cero → mata el fallback `{avg:0,best:0}`
  de `league_averages()` (§3.2). Una métrica sin ningún dato válido devuelve `null`, no 0.
- **Eliminar el bloque "Ø liga / ↑ x"** de la UI — decisión cerrada en §5. No se arregla el
  cálculo de la variación porcentual: se borra. Su reemplazo es T-01 (fuera de alcance).
- **Gate**: el mismo equipo consultado desde dos pantallas distintas muestra idéntico Ø liga,
  y no queda ninguna columna de variación porcentual en pantalla.

### Feature 15 — Métricas de jugador rotas `[P0/P1]` · 6-9h
**Cubre C-01 + C-04.** Specificar **después** de cerrar 14 (§3.2).
- C-01: revisar AS/pos, PER/pos, PTS/pos, RO/min, RD/min. Confirmar qué sigue roto post-14.
- C-04: definir explícitamente si AS/PER es por partido o acumulado de temporada, y aplicar
  el mismo criterio en equipo y en jugador. La definición elegida se escribe en `docs/metrics.md`
  (hoy `docs/metrics.md:125` define `AST/TO = AST / TOV` sin fijar la base temporal).
- **Gate**: los cinco indicadores devuelven valor coherente para todo jugador con minutos, y
  AS/PER coincide con el cálculo manual sobre el box score.

### Feature 16 — Tiro completo y PPT `[P1]` · 6-9h
**Cubre C-03 + C-07.** Agrupados: comparten la definición de PPT y la sección Tiro.
- C-03: `pf` → `ppt` (rename, §3.3), **agregar** `efg` por zona, sacar P/F de etiquetas y
  encabezado. Aplica al mapa de equipo y al shot chart por zonas de jugador.
- C-07: T2i, T2c, T3i, T3c, TLi, TLc en promedio por partido **y** totales de temporada,
  más PPT general, de 2, de 3 y de tiros libres.
- Los datos ya están en DB (`fga2/fgm2/fga3/fgm3/fta/ftm`) — es serializer + UI, sin esquema.
- **Cambio de contrato** en `GET /api/shots/*`: se documenta en `docs/api.md` al cerrar.
- **Gate**: ninguna etiqueta del mapa muestra "P/F"; la sección Tiro muestra las 3 categorías
  con intentos y convertidos más los 4 PPT.

### Feature 17 — Vista Liga `[P1/P2]` · 5-7h
**Cubre C-09 + C-10.** Agrupados por pantalla.
- C-09: tabla de posiciones — PJ, PG, PP, puntos (2 por ganado, 1 por perdido), PF y PC.
- C-10: invertir el sentido de la flecha del eje de rebote del mapa de liga, para que apunte
  al lado favorable igual que OER y DER.
- **Gate**: la tabla ordena por puntos y su suma es coherente con el game log de cada equipo.

### Feature 18 — Etiquetas y umbrales `[P2/P1]` · 2-3h
**Cubre C-05 + C-06.** Agrupados: ambos son cambio de constante/label sin lógica nueva.
- C-05: `PeP` → `PtsEnPint` en los 2 sitios de `app.js` + `docs/database.md` + `docs/frontend.md`.
  La columna DB `paint_pts` no se toca (§3.4).
- C-06: umbral de partido cerrado de ≤ 15 a ≤ 10 en `clutch.py`, más la leyenda y el recuento
  de partidos calificados y excluidos.
- **Gate**: búsqueda global de "PeP" sin resultados; el encabezado dice
  "CIERRES (ÚLTIMOS 5 MIN, DIF ≤ 10)" y el conteo se recalcula.

---

## 5. Decisión de alcance de Feature 14 — RESUELTA

C-02 pide revisar la columna de variación porcentual (los `↑ 1050.0%`, `↑ 9900.0%`) y añade:
*"Ese indicador se reemplaza por percentiles según T-01"*. T-01 pertenece al Bloque T, fuera
del alcance de este roadmap.

**[RESUELTA — 2026-08-10] Decisión: eliminar la columna.** No se arregla el cálculo.
Feature 14 corrige únicamente la **base** del promedio de liga (todos los partidos de la
competencia/temporada, excluyendo nulos) y **borra** el bloque "Ø liga / ↑ x" de la UI.

Justificación: el doc ya declara el indicador muerto. Corregir un cálculo marcado para
reemplazo es trabajo descartable (~2-3h). El hueco de contexto en pantalla queda abierto
hasta que se implemente T-01 (percentiles), que es su reemplazo definitivo.

Consecuencias para el spec de Feature 14:
- Entra como RF explícito: "el bloque de variación porcentual DEBE eliminarse de la UI".
- Entra en §8 Fuera de alcance: "mostrar cualquier indicador de contexto en su lugar — es T-01".
- Se registra en `progress.md` como deuda visible: pantallas sin indicador de contexto
  hasta T-01.
- El valor absoluto y el Ø liga corregido **siguen visibles**; lo que desaparece es la
  columna de variación.

---

## 6. Cruces con Bloques T / F / A

Registrados para que no se resuelvan por accidente dentro del Bloque C:

- **C-02 ↔ T-01** — la variación porcentual muere con los percentiles. Ver §5.
- **C-11 ↔ T-02** — ambos gobiernan qué se muestra con muestra insuficiente. C-11 decide
  `null` vs `0`; T-02 decide gris + badge bajo umbral. No confundir: C-11 no introduce umbrales.
- **C-07 ↔ F-06** — F-06 pide las mismas métricas de tiro en lineups y ON/OFF. Si el serializer
  de Feature 16 se factoriza limpio, F-06 lo reusa.
- **C-01 ↔ A-07** — A-07 agrega AS% del equipo y AS/pos. Definir bien AS/PER en Feature 15
  deja el terreno listo.

---

## 7. Totales

| Feature | Horas |
|---|---|
| 12 — nulos: orden, color, DNP | 12-18 |
| 13 — dedup de jugadores | 5-7 |
| 14 — promedios de liga | 5-8 |
| 15 — métricas de jugador rotas | 6-9 |
| 16 — tiro completo y PPT | 6-9 |
| 17 — vista Liga | 5-7 |
| 18 — etiquetas y umbrales | 2-3 |
| **Total Bloque C** | **41-61h** |

≈ **1,5 semanas** full-time. Incluye el gate manual de verificación (Constitución 8: no hay
test suite, la evidencia se documenta en `progress.md`, no se asume).

**Riesgo principal**: Feature 12. Su criterio de aceptación es un recorrido exhaustivo de la app,
no un cambio acotado — es la única del bloque cuyo costo depende de cuántas pantallas fallen
la auditoría, y no se sabe hasta recorrerlas.

---

## 8. Estado — BLOQUE C COMPLETO ✅

Las **7 features cerradas**, cubriendo las 11 correcciones C-01 … C-11. Cada una con sus 4
artefactos SDD y evidencia de CA en su `progress.md`.

| Feature | Cubre | CA | Estado |
|---|---|---|---|
| 12 — nulos: orden, color, DNP | C-11 | 12/12 ✅ | cerrada |
| 13 — dedup de jugadores | C-08 | 8/8 ✅ | cerrada |
| 14 — promedios de liga | C-02 | 8/8 ✅ | cerrada |
| 15 — métricas de jugador | C-01, C-04 | 10/10 ✅ | cerrada |
| 16 — tiro completo y PPT | C-03, C-07 | 10/10 ✅ | cerrada |
| 17 — vista Liga | C-09, C-10 | 9/10 ✅ · 1 ⚠️ | cerrada |
| 18 — etiquetas y umbrales | C-05, C-06 | 7/7 ✅ | cerrada |

**64 de 65 CA verificados.** El restante (17/CA-6) no es alcanzable con los datos actuales: el
selector de competencia solo aparece con más de una competencia y la base tiene una.

### Casos no alcanzables con los datos de producción

Verificados por inyección controlada (intercepción de `fetch` o copia de la base), nunca modificando
la base real. Registrado en cada `progress.md` para no leerlos como cobertura end-to-end plena:

- **12/CA-3** — ninguna fila de cierres tiene nulos.
- **12/CA-6**, **16/CA-4** — ningún equipo con 0 rebotes en un partido.
- **13/CA-1, CA-2, CA-5, CA-6** — la base **no tiene duplicados de grafía** (74 = 74). El bug de C-08
  era latente, no activo.
- **14/CA-2, CA-4** — una sola competencia; ninguna métrica sin datos.
- **16/T-D3** — la competencia FUBB no expone coordenadas, así que el modo de 11 zonas del mapa no se
  renderiza nunca.
- **17/CA-6** — ídem competencia única.

### Deuda que requiere decisión del cliente

1. **Sentinels `ast_to` / `def_to_ratio` = 99.0** cuando no hay pérdidas (deuda abierta de Feature 08).
   Contamina el `Ø` de liga: el perfil de jugador marca **26.66** en DEF/TO, un ratio que vale 2-5.
   Barato de cerrar (1 línea por sentinel) pero es decisión de producto.
2. **eFG% == % de acierto en las zonas de 2** del mapa (Feature 16 D-3). Inevitable por fórmula;
   confirmar si resulta ruido visual.
3. **Umbrales de color del heatmap** calibrados sobre el indicador viejo (Feature 16).
4. **Criterio de desempate de la tabla general** — hoy diferencia de puntos (Feature 17 D-5).
5. **Taxonomía de posiciones** `F`/`PF` y `G`/`PG` sin unificar (Feature 13).

### Lo que queda para el Bloque T

Tres consecuencias asumidas que solo cierra T-01/T-02:

- Las cards quedaron **sin indicador de dispersión** entre el retiro del `↑` y los percentiles de T-01.
- **Sin umbral mínimo de muestra** en ninguna población: un equipo con 1 partido pesa igual que uno
  con 12; una zona con 2 intentos muestra su PPT sin advertencia.
- Con el umbral de cierres en 10, **AGU queda con 0 partidos calificados** — el badge de
  confiabilidad es T-02.
