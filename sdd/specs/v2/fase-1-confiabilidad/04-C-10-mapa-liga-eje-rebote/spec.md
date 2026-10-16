# Spec — C-10: Mapa de liga — eje de rebote

> **ID:** C-10 · **Prioridad:** P2 · **Fase y orden:** 1·04
> **Depende de:** C-11 Grupo 0 (integración de `dev`, P-00) — [`../01-C-11-tratamiento-de-nulos/spec.md`](../01-C-11-tratamiento-de-nulos/spec.md) · **Habilita:** —
> **Estado:** Implementado (2026-09-26) — ver [progress.md](progress.md)
> **Fuente:** Especificación v2 §2 · C-10 y §1.3 S2 ([`../../00-especificacion-cliente-v2.md`](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.0, §1.5 D-18, §3.12, §3.20 ([`../../00-arquitectura-transversal.md`](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal):** *"Invertir el sentido de la flecha del eje de rebote para que la dirección indique el
lado favorable, igual que en los ejes de OER y DER."* Criterio de aceptación: *"La leyenda del eje describe correctamente
hacia dónde está el mejor rendimiento."* En §1.3 (S2 · Liga) el módulo "Mapa de liga" es *"Dispersión OER/DER y otras
combinaciones de ejes"*, con C-10 como requisito.

**Qué existe hoy (verificado en código):**
- `frontend/js/app.js` `LEAGUE_MAPS` (l.401 en `main`, l.425 en `dev`): tres presets de ejes — Eficiencia (`oer` en X,
  `der` en Y), Rebotes (`or_pct` en X, `dr_pct` en Y) y Recuperos/Puntos (`stl` en X, `pts` en Y). Cada preset trae
  `xTitle`/`yTitle` escritos a mano y un `hint`. `_drawLeagueMap()` llama a `drawLeagueScatter`.
- `frontend/js/charts.js` `drawLeagueScatter(canvasId, teams, axis)` (l.331 `main` / l.335 `dev`): Chart.js scatter con
  `y.reverse: false` (el valor mayor siempre arriba; el mayor de X siempre a la derecha) y un plugin `afterDraw` que dibuja
  las líneas de promedio de liga y dos rótulos dentro del lienzo: **`↑ ${xName}`** junto a la línea vertical del promedio
  de X (l.424 `main` / l.428 `dev`) y `${yName}` junto a la horizontal.
- En `main` los títulos del eje X usan `↑` ("OER (↑ mejor ataque)", "OR% (↑ mejor)", "Recuperos por partido (↑)"):
  una flecha vertical en un eje horizontal. Es la flecha "del eje de rebote" que reporta el cliente.
- La rama `dev` (feature SDD 17 `17-vista-liga`, se integra en el Grupo 0 de C-11) cambió los títulos de X a `→` y
  verificó en navegador que la posición de los equipos coincide (mayor OR% a la derecha, mayor DR% arriba). **Quedó el
  residuo** del rótulo interno `↑ ${xName}` en `charts.js` (arquitectura D-18): en el preset Rebotes sigue apareciendo
  "↑ OR%" dibujado sobre el gráfico, contradiciendo al título "OR% (→ mejor)".
- Las flechas están codificadas como texto libre en cada preset; nada impide que un preset nuevo repita el error.

**Qué queda para C-10 (delta sobre `dev`):** (1) eliminar la flecha contradictoria del rótulo interno; (2) derivar las
flechas de todos los ejes de la dirección de la métrica (mayor es mejor / menor es mejor) y de la orientación del eje, para
que cualquier combinación de ejes —presente o futura— indique el lado favorable; (3) pasar el copy por `t()`.

## 1. Objetivo
Que cada eje del mapa de liga, en todos los presets, indique con una flecha coherente con la pantalla hacia dónde está el
mejor rendimiento, sin rótulos que lo contradigan.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 · C-10 (requisito y CA) y §1.3 S2 (módulo "Mapa de liga").
- `docs/frontend.md` §Charts (`drawLeagueScatter`, presets `LEAGUE_MAPS`) y, en `dev`, §"Vista Liga — tabla general y ejes
  del mapa (C-09 / C-10)" (convención de flechas).
- `docs/metrics.md` (sentido de OER, DER, OR%, DR%: mayor es mejor salvo DER).
- `00-arquitectura-transversal.md` §1.0 (fila C-09/C-10), §1.5 D-18, §3.6 ("menos es mejor"), §3.12 (S2 `liga/mapa`), §3.20.
- Spec de `dev`: `git show dev:sdd/specs/17-vista-liga/spec.md` (RF-7, CA-7, CA-8) y `progress.md` (D-1, D-3).

## 3. Historias de usuario
- **US-1**: Como analista, quiero que la leyenda de cada eje me diga hacia qué lado de la pantalla está el mejor
  rendimiento, para leer el mapa sin deducirlo.
- **US-2**: Como entrenador, quiero que ningún rótulo dentro del gráfico contradiga a la leyenda del eje, para no dudar de
  qué cuadrante es el bueno.

## 4. Requisitos funcionales
- **RF-1**: El título de cada eje del mapa DEBE incluir una flecha que apunte a la posición en pantalla del mejor
  rendimiento: `→` o `←` en el eje horizontal, `↑` o `↓` en el vertical. (US-1) (Esp. v2 §C-10) (docs/frontend.md `dev`
  §Vista Liga)
- **RF-2**: La flecha DEBE derivarse de la dirección de la métrica del eje (mayor es mejor → hacia valores crecientes;
  menor es mejor → hacia valores decrecientes) y de la orientación del eje (el eje Y no está invertido: los valores crecen
  hacia arriba). Para métricas sin dirección de rendimiento el título NO DEBE llevar flecha de "mejor". (US-1) (Arquitectura
  §3.6 "Menos es mejor")
- **RF-3**: El eje de rebote DEBE cumplir RF-1: OR% (horizontal) con `→` y DR% (vertical) con `↑`, ambos "mejor". (US-1)
  (Esp. v2 §C-10)
- **RF-4**: El gráfico NO DEBE dibujar dentro del lienzo flechas que contradigan los títulos; los rótulos de las líneas de
  promedio DEBEN identificar la línea (promedio de la métrica) sin flecha. (US-2) (Arquitectura D-18)
- **RF-5**: RF-1 a RF-4 DEBEN valer para los tres presets existentes (Eficiencia, Rebotes, Recuperos/Puntos) y para
  cualquier preset que se agregue. (US-1) (Esp. v2 §1.3 S2 "otras combinaciones de ejes")
- **RF-6**: La ayuda de cada preset (texto bajo el título) DEBE ser coherente con las flechas (p. ej. "Abajo = mejor
  defensa" con DER `↓`). (US-1)
- **RF-7**: Los equipos con valor nulo en alguno de los dos ejes NO DEBEN dibujarse como 0 (comportamiento de `dev`
  preservado; C-11). (US-1) (Esp. v2 §C-11)

## 5. Requisitos de datos / API
| Tabla / endpoint | Cambio | ¿Nuevo? |
|---|---|---|
| `GET /api/league` (`oer`, `der`, `or_pct`, `dr_pct`, `stl`, `pts`) | Ninguno | No |

Sin cambios de esquema ni de endpoints.

## 6. Estados de UI
| Vista / componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Liga — card "Mapa de liga" | sin cambio ("Cargando...") | sin cambio (el mapa no se muestra con menos de 2 equipos) | sin cambio | sin cambio (tras subir `CACHE`) | títulos de eje con flecha correcta; rótulos internos "Prom. <métrica>" sin flecha |

**Copy nuevo** (para `docs/frontend.md`, vía `t()`): títulos de eje con el patrón `<Métrica> (<flecha> <calificador>)`
—"OER (→ mejor ataque)", "DER (↓ mejor defensa)", "OR% (→ mejor)", "DR% (↑ mejor)", "Recuperos por partido (→ más
robos)", "Puntos por partido (↑ más puntos)"— y rótulo de línea de promedio "Prom. {metrica}".

## 7. Criterios de aceptación
- **CA-1 (CA del cliente)**: Given el mapa de liga, When se lee la leyenda de cada eje, Then describe correctamente hacia
  dónde está el mejor rendimiento.
- **CA-2**: Given el preset Rebotes con los partidos del seed, When se identifica al equipo con mayor OR% y al de mayor DR%
  (tabla de ranking), Then el de mayor OR% está en el extremo hacia el que apunta la flecha del eje horizontal (`→`,
  derecha) y el de mayor DR% en el extremo de la flecha vertical (`↑`, arriba).
- **CA-3**: Given el preset Eficiencia, When se identifica al equipo con menor DER, Then está en el extremo inferior,
  coherente con "DER (↓ mejor defensa)", y el de mayor OER a la derecha, coherente con "OER (→ mejor ataque)".
- **CA-4**: Given cualquiera de los tres presets, When se inspecciona el lienzo, Then no hay ninguna flecha vertical
  asociada al eje horizontal ni rótulo interno con flecha (los rótulos de promedio dicen "Prom. <métrica>").
- **CA-5**: Given un preset de prueba con una métrica "menor es mejor" en el eje X (p. ej. DER en X, agregado solo en
  consola), When se dibuja, Then el título muestra `←`, sin editar texto a mano (RF-2).
- **CA-6**: Given un equipo con `or_pct` nulo (inyectado vía intercepción de `fetch`), When se dibuja el preset Rebotes,
  Then ese equipo no aparece como punto en 0 y el gráfico no falla.
- **CA-7**: Given un teléfono de 360 px, When se abre el mapa, Then los títulos de eje se leen completos (sin recorte) y el
  body no genera scroll horizontal.
- **CA-8**: Given el recorrido de Liga alternando los tres presets, When se observa la consola, Then no hay errores JS.

## 8. Fuera de alcance
- Agregar presets o un selector libre de ejes: el cliente menciona "otras combinaciones de ejes" como descripción del
  módulo, ya cubierta por los tres presets; un selector libre no tiene ID propio.
- Invertir la escala del eje Y (DER hacia arriba): el cliente pide corregir la flecha, no la escala.
- Colorear cuadrantes o puntos por percentil (T-01).
- Mover el mapa a la pestaña `#/liga/mapa`: lo hace X-01 sin cambiar el componente.
- **INCREMENTO DIFERIDO (→ T-05)**: tomar la dirección de cada métrica del catálogo (`metricDef(key).direction`,
  [`../13-T-05-conjunto-estandar-metricas/spec.md`](../13-T-05-conjunto-estandar-metricas/spec.md)) en lugar de declararla en el
  preset.

## 9. Ambigüedades
- **[DECISIÓN PROPUESTA — confirmar] ¿Qué significa "invertir la flecha del eje de rebote"?** Los ejes ya ubican lo
  mejor a la derecha/arriba (verificado en `dev`); lo que estaba mal era la flecha vertical `↑` en el eje horizontal de OR%
  (título en `main`, rótulo interno en `main` y `dev`). Decisión: la flecha indica la dirección en pantalla del mejor
  rendimiento (convención de `dev`, que el cliente cita: "igual que en los ejes de OER y DER"), y se elimina la flecha del
  rótulo interno. No se invierte la escala.
- **[DECISIÓN PROPUESTA — confirmar] Rótulo interno de las líneas de promedio.** Hoy dice "↑ OR%" / "DR%". Se reemplaza por
  "Prom. OR%" / "Prom. DR%": identifica que la línea es el promedio de la liga (dato útil) y no compite con la flecha del
  título. Alternativa descartada: flecha horizontal en el rótulo (duplica la información y satura el lienzo en móvil).
- **[DECISIÓN PROPUESTA — confirmar] Métricas neutrales en ejes.** Si en el futuro se usa una métrica sin dirección de
  rendimiento (p. ej. PACE), el título lleva la métrica sin flecha de "mejor" (coherente con §3.6 de la arquitectura:
  neutrales sin color de rendimiento).
- **[DECISIÓN PROPUESTA — confirmar] "Recuperos" y "Puntos por partido".** Se tratan como "mayor es mejor" con los
  calificadores actuales ("más robos", "más puntos").
