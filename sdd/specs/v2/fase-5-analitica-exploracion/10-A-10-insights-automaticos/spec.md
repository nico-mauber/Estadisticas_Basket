# Spec — A-10: Insights automáticos en texto

> **ID:** A-10 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 10
> **Depende de:** T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)) · F-17 ([../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/spec.md](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/spec.md), motor de plantillas `phrases.py`); consume además T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)), T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/spec.md)), F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/spec.md](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md), claves `insights.*`) y X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md), pestañas Resumen)
> **Habilita:** F-12 (alertas de Mi equipo: insights de la última semana y cambios bruscos), F-21 (traduce las plantillas)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §5 · A-10 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.1 (capa transversal "Insights en texto") · §1.3 S8 (Alertas) · Arquitectura §3.15, §3.6, §3.7, §3.2, §4 (`insights.py`), §6 (`GET /api/insights`), §9.1 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente y por qué.** "Generar entre 3 y 5 frases por equipo y por jugador, a partir de reglas sobre los percentiles de
T-01. Se dispara cuando el percentil es menor o igual a 10 o mayor o igual a 90. Plantillas de texto fijas rellenadas con los
valores; no se usa generación por IA. Ejemplo de plantilla: «{equipo} está en el percentil {p} de {métrica} de la competencia
({valor} frente a {media} de promedio)»." Criterio de aceptación: "Ningún insight contradice los números mostrados en la misma
pantalla." Además S8 "Alertas" necesita "insights automáticos de la última semana y cambios bruscos de rendimiento": A-10 debe
**definir** qué es un cambio brusco para que F-12 lo consuma.

**Qué existe hoy (verificado en código, rama `v2`).**
- No existe ningún texto generado: no hay `insights`, plantillas ni motor de frases en `backend/` ni `frontend/` (`grep` de
  `insight`, `phrases` sin resultados). Las pantallas de Equipo (`frontend/js/app.js`, `_renderTeamContent`, l.1144) y Jugador
  (`_renderPlayerContent`, l.1790) muestran cards de métricas con valor y `Ø` de liga, sin ranking ni percentil (los trae T-01).
- No existe percentil en el backend (`backend/stats_engine.py:league_averages` devuelve solo `avg` y `best`); la población, el
  percentil y la ficha son de T-01 (`backend/population.py`).
- Identidad de jugador: hoy por nombre normalizado (`resolve_identity`); C-08 agrega `player_id`.

**Qué resuelven requisitos anteriores (supuestos de esta spec).** T-01 entrega `population.population`, `league_reference` y `ficha`
(percentil orientado: alto = mejor también en "menos es mejor", ranking, promedio de la competencia) y la población con umbrales;
T-02 clasifica la muestra y excluye la baja de sugerencias automáticas; T-03 amplía el contexto; F-13 trae las claves
`insights.low_pct`, `insights.high_pct`, `insights.min_items`, `insights.max_items` (reservadas → A-10); X-01 trae las pestañas
Resumen de Equipo y Jugador. **F-17 ya creó el motor de frases** (`backend/phrases.py`, plantillas por idioma en
`backend/phrases/es.json`, reglas en `backend/phrases/rules.json`, `format_value`, `render`, `pick_template`,
selección de ventajas/riesgos y período anterior) con las reglas que A-10 reutiliza: plantillas fijas, marcadores permitidos,
sin números a mano, plantilla elegida por el dato (nunca contradice), validación al cargar.

**Qué queda para A-10.** Las plantillas de percentil extremo (`extremo_alto` / `extremo_bajo`), la regla de disparo por percentil, el
servicio `insights.py` y su endpoint, el bloque "Insights" en las pantallas de Equipo y Jugador y la definición operativa de
"cambio brusco de rendimiento" con su función para F-12. Las alertas en pantalla (S8) y la traducción son de F-12 y F-21.

## 1. Objetivo
Que cada equipo y cada jugador muestre entre tres y cinco frases automáticas, redactadas con plantillas fijas, sobre sus métricas más
extremas dentro de la competencia (percentil ≤ 10 o ≥ 90), de modo que ninguna contradiga los números de la misma pantalla.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5 A-10 (texto completo, ejemplo de plantilla y CA); §1.1 (fila "Insights en texto"); §1.3 S8 (módulo Alertas);
  §3 T-01 (percentil, "menos es mejor", población de referencia); §3 T-02 (muestra baja fuera de sugerencias automáticas); §4 F-17
  ("mismas reglas de A-10"); §6 glosario.
- `docs/frontend.md` §Vistas (Equipo, Jugador); `docs/metrics.md` (fórmulas de las métricas citadas); `docs/api.md`.
- `00-arquitectura-transversal.md` §3.15 (motor de frases: marcadores, disparo A-10), §3.6 (ficha, percentil orientado), §3.7 (muestra),
  §3.2 (claves `insights.*`, `alerts.*`), §3.8 (contexto), §4 (`insights.py`), §6 (`GET /api/insights`), §7.1, §7.4, §9.1 (A-10 → F-12,
  F-21).
- Specs previos: F-17 (`../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/spec.md`: reglas de plantillas y modo de muestra).

## 3. Historias de usuario
- US-1: Como entrenador, quiero leer entre tres y cinco frases sobre lo más llamativo de mi equipo o de un jugador, para captar el perfil
  sin recorrer todas las tablas.
- US-2: Como analista, quiero que cada frase se dispare solo con valores realmente extremos (percentil ≤ 10 o ≥ 90) y salga de una
  plantilla fija, para confiar en que no hay texto inventado.
- US-3: Como entrenador, quiero que ninguna frase contradiga los números que veo en la misma pantalla, para no dudar de la lectura.
- US-4: Como entrenador, quiero que las frases se recalculen con el filtro activo (últimos 5, local, etc.) y avisen sobre qué
  selección se calcularon, para leer el momento actual.
- US-5: Como entrenador, quiero que Mi equipo me avise de los cambios bruscos de rendimiento recientes, para reaccionar a tiempo
  (definición operativa para F-12).

## 4. Requisitos funcionales
- RF-1: El sistema DEBE generar, para un equipo o un jugador, entre `insights.min_items` y `insights.max_items` frases (3 y 5 por
  defecto), una por métrica disparada, ordenadas de la más extrema a la menos extrema. · (US-1) (Esp. v2 §A-10 "entre 3 y 5 frases por
  equipo y por jugador")
- RF-2: Una métrica DEBE disparar una frase solo si su percentil T-01 es **menor o igual a `insights.low_pct`** (10 por defecto) o
  **mayor o igual a `insights.high_pct`** (90 por defecto), calculado sobre la población de la competencia y el contexto activos. ·
  (US-2) (Esp. v2 §A-10 "percentil menor o igual a 10 o mayor o igual a 90"; §T-01)
- RF-3: Cada frase DEBE salir de una **plantilla fija** rellenada con valores formateados del catálogo, sin generación por IA ni
  números escritos a mano. La plantilla genérica DEBE ser la del cliente: "{entidad} está en el percentil {p} de {metrica} de la
  competencia ({valor} frente a {media} de promedio)". · (US-2) (Esp. v2 §A-10 "Plantillas de texto fijas… no se usa generación por
  IA"; Arquitectura §3.15)
- RF-4: El percentil, el valor y el promedio citados en la frase DEBEN ser exactamente los de la ficha T-01 de esa métrica (misma
  población, mismo contexto) y formatearse como en la pantalla (es-UY). · (US-3) (Esp. v2 §A-10 CA; §T-01)
- RF-5: En métricas donde menos es mejor (DER, TO%, …), el percentil T-01 ya está orientado (alto = mejor); la plantilla DEBE decirlo
  en palabras ("entre los mejores"/"entre los peores", "menos es mejor") para que un percentil alto nunca se lea como un valor alto. ·
  (US-3) (Esp. v2 §T-01 "se invierte todo"; Arquitectura §3.6)
- RF-6: Una plantilla `extremo_alto` DEBE usarse solo si el percentil es ≥ `insights.high_pct` y una `extremo_bajo` solo si es ≤
  `insights.low_pct`; el servicio DEBE verificar esta coherencia antes de emitir cada frase y descartar la que no la cumpla. · (US-3)
  (Esp. v2 §A-10 CA)
- RF-7: Las métricas neutrales (`direction = neutral`, p. ej. USO%, uso de triple, PACE) DEBEN poder generar frases con redacción
  neutra (sin juicio de valor) y no recibir color de rendimiento. · (US-1) (Esp. v2 §T-01 "métricas neutrales"; Arquitectura §3.6)
- RF-8: Para no repetir la misma idea, DEBE emitirse como máximo una frase por **familia** de métricas relacionadas (por ejemplo eFG%,
  TS% y PPT son "tiro"); entra la de percentil más extremo. · (US-1) (PROPUESTA de familias, ver §9)
- RF-9: Si una entidad tiene muestra baja (T-02) NO DEBE emitirse ningún insight y el servicio DEBE informar el motivo; si el
  contexto impide comparar con la competencia (`on`/`off`, `competition=all`) o no hay universo, DEBE informar el motivo en lugar de
  frases. · (US-2) (Esp. v2 §T-02 "sugerencias automáticas"; §T-03; Arquitectura §3.6, §3.7)
- RF-10: Una métrica nula, sin percentil o fuera de la población NO DEBE disparar una frase ni sustituirse por 0. · (US-3)
  (Esp. v2 §C-11, §T-01 "población de referencia")
- RF-11: Si menos de `insights.min_items` métricas son extremas, el servicio DEBE devolver solo las que hay (no completar con
  métricas no extremas) y señalar que quedó por debajo del mínimo; la pantalla DEBE explicarlo. · (US-1) (Esp. v2 §A-10 "se
  dispara cuando…" prevalece sobre "entre 3 y 5"; ver §9)
- RF-12: Las frases DEBEN recalcularse con el contexto activo (T-03) y la pantalla DEBE indicar sobre qué selección se calcularon
  (etiqueta de contexto y partidos usados). · (US-4) (Esp. v2 §T-03, §T-01 "todo se recalcula sobre la selección activa")
- RF-13: El sistema DEBE mostrar el bloque "Insights" en la pestaña Resumen de Equipo y en la de Jugador, y cada frase DEBE permitir ver
  su evidencia (percentil, valor, promedio, puesto "n.º de N"). · (US-1, US-3) (Esp. v2 §1.1 "Insights en texto"; §1.3 S3/S4)
- RF-14: Las plantillas DEBEN vivir en el archivo de plantillas por idioma del motor de F-17 (sin frases fijas en el código), con las
  mismas reglas de validación (marcadores permitidos, sin dígitos, plantilla por dirección de métrica). · (US-2) (Arquitectura
  §3.15; F-17 RF-16/RF-17)
- RF-15: Los umbrales `insights.low_pct`, `insights.high_pct`, `insights.min_items` e `insights.max_items` DEBEN leerse de la
  configuración (F-13) y no estar fijos en el código; el cambio DEBE reflejarse sin reiniciar. · (US-2) (Esp. v2 §T-02 "ninguno debe
  quedar fijo en el código"; Arquitectura §3.2)
- RF-16: El sistema DEBE definir y exponer a F-12 el **cambio brusco de rendimiento** de un equipo: una métrica del conjunto del plan
  de juego cuyo valor en los últimos `window_games` partidos difiere del valor pooled de los partidos anteriores en al menos
  `change_z` desvíos de la población de la competencia (`|z| ≥ change_z`), con su frase de plantilla (`cambio_mejora` /
  `cambio_empeora`). · (US-5) (Esp. v2 §1.3 S8 "Alertas… cambios bruscos de rendimiento"; Arquitectura §3.2 `alerts.change_z`)
- RF-17: Todo copy nuevo DEBE estar en español rioplatense y los números en formato es-UY. · (US-1) (Arquitectura §3.20; DA-21 resuelta,
  DA-36)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| Esquema SQLite | — | sin cambios (on-the-fly sobre la población de T-01; nada se persiste) | — |
| `GET /api/insights` | endpoint | query `entity` ∈ {`team`,`player`}, `id` (team_code o player_id), + contexto T-03 → `{entity, insights[], below_min, reason, rule, sample, context}`; ítem `{metric, label, tone, when, family, percentile, value, avg, rank, rank_total, template_id, text}`; 400 `parametro_invalido`/`contexto_invalido`/`competencia_inexistente`; 404 `no_encontrado` | **NUEVO** (dueño A-10, arquitectura §6) → `docs/api.md` |
| `backend/insights.py` | módulo | `insights(entity_type, entity_id, comp_id, ctx) -> list[dict]`; `sudden_changes(…)` (cambio brusco, para F-12) | **NUEVO** (arquitectura §4) → `docs/architecture.md` |
| Plantillas `backend/phrases/es.json` y reglas `backend/phrases/rules.json` (F-17) | datos | se agregan las plantillas genéricas `extremo_alto`/`extremo_bajo` por dirección, `cambio_mejora`/`cambio_empeora` y la sección `insights` de métricas | existentes (F-17), se amplían |
| `app_config`: `insights.low_pct`, `insights.high_pct`, `insights.min_items`, `insights.max_items` | configuración | int 10 / 90 / 3 / 5; reservadas por F-13, A-10 las activa | existentes (F-13) |
| `population.population/ficha`, `sample` | consumidos | percentil orientado, ranking, promedio, badge de muestra | T-01/T-02 |
| Tablas/columnas | — | ninguna nueva | — |

## 6. Estados de UI
Componente: **bloque "Insights"** (card sin plegado) en S3 Equipo › Resumen y S4 Jugador › Resumen. Copy nuevo → `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Bloque Insights | "Generando insights…" (esqueleto de 3 líneas) | Sin extremos: "No hay valores extremos en esta selección." · `muestra_baja`: "Muestra insuficiente: no se generan insights con tan pocos datos." · `contexto_no_comparable`: "Este filtro no permite comparar con la competencia." · `sin_universo`: "Elegí una competencia para comparar." · `poblacion_insuficiente`: "La competencia no tiene suficientes datos para comparar." · `sin_datos`: "No hay datos en esta selección." | "No se pudieron generar los insights" + "Reintentar" (el resto de la pestaña sigue) | "Sin conexión: se muestran los últimos insights cargados" o "Sin conexión" | 3–5 frases con icono de tono (▲ verde / ▼ rojo / ● neutro), texto y evidencia en línea secundaria ("p92 · 1.º de 12 · Últimos 5") |
| Aviso de mínimo | — | Si hay menos de `insights.min_items`: nota "Pocos valores extremos en esta selección." bajo la lista | — | — | — |
| Evidencia (tooltip / tap) | — | — | — | — | "Percentil 92 · 56,1% (Ø 52,4%) · 1.º de 12" |

## 7. Criterios de aceptación
- CA-1 (CA del cliente): **"Ningún insight contradice los números mostrados en la misma pantalla."** Given la pestaña Resumen de un
  equipo y la de un jugador con el bloque Insights visible, When se toma cada insight, Then su percentil, valor y promedio coinciden
  con la ficha de esa métrica en la pantalla y con `GET /api/metrics/<team|player>` (valores idénticos al decimal mostrado), una frase
  `extremo_alto` corresponde a un percentil ≥ 90 y una `extremo_bajo` a uno ≤ 10, y el tono (▲/▼) coincide con el color de la ficha.
- CA-2: Given un equipo con al menos cinco métricas extremas, When se piden los insights, Then devuelve exactamente
  `insights.max_items` (5) frases ordenadas por `|percentil − 50|` decreciente, todas con percentil ≤ 10 o ≥ 90 y de familias distintas.
- CA-3: Given un equipo con sólo dos métricas extremas, When se piden los insights, Then devuelve esas dos, `below_min: true` y la
  pantalla muestra "Pocos valores extremos en esta selección."; con ninguna devuelve lista vacía y `reason: sin_extremos`.
- CA-4: Given un equipo con eFG% en el percentil 92 (56,1% frente a 52,4% de promedio), When se genera el insight, Then el texto es
  exactamente "Nacional está en el percentil 92 de eFG% de la competencia (56,1% frente a 52,4% de promedio)" (plantilla del cliente).
- CA-5: Given TO% (menos es mejor) con el valor más bajo de la competencia, When se genera el insight, Then el texto dice "entre los
  mejores de la competencia en TO% (percentil 99: … frente a … de promedio; menos es mejor)" y el tono es positivo; con el valor más alto
  dice "entre los peores" y el tono es negativo.
- CA-6: Given una métrica neutral (USO% de un jugador o uso de triple de un equipo) con percentil ≥ 90, When se genera el insight,
  Then se usa la plantilla neutra (sin "mejores/peores"), el tono es neutro (●) y no se colorea en verde ni rojo.
- CA-7: Given un equipo de muestra baja (2 partidos, `sample.team.min` = 3) o un jugador con menos de `sample.player.min` minutos,
  When se piden los insights, Then devuelve lista vacía con `reason: muestra_baja` y la pantalla lo explica.
- CA-8: Given `last=5` activo, When se piden los insights, Then se calculan sobre la población recalculada con los últimos 5 de cada
  equipo, el contexto indica "Últimos 5" y los percentiles coinciden con las fichas de esa misma selección.
- CA-9: Given `insights.high_pct` = 80 y `insights.max_items` = 3 en Configuración, When se recarga el bloque, Then se disparan métricas
  con percentil ≥ 80 y hay a lo sumo 3 frases; al restablecer vuelven 90 y 5.
- CA-10: Given una métrica nula (p. ej. AS/PER nulo por 0 pérdidas) o fuera de la población, When se generan los insights, Then no
  produce frase, no aparece "0" ni "NaN" y el resto funciona.
- CA-11: Given un filtro `on=<player_id>` (`entity_only`) o `competition=all`, When se piden los insights, Then responde 200 con lista
  vacía y `reason` `contexto_no_comparable` / `sin_universo`.
- CA-12: Given eFG%, TS% y PPT del equipo todos en el percentil ≥ 90, When se piden los insights, Then solo una de ellas aparece (la de
  percentil más extremo) y las demás familias no quedan desplazadas.
- CA-13: Given un equipo cuyo eFG% de los últimos 3 partidos supera en ≥ `change_z` desvíos de la población al valor pooled de sus
  partidos anteriores, When se llama a `sudden_changes(team, comp, ctx, window_games=3, change_z=1.5)`, Then devuelve ese cambio con
  `cambio_mejora`, `delta`, `own` y `ref` verificables a mano; con un cambio menor de `change_z` no devuelve nada; con menos partidos
  que `sample.team.min` devuelve `reason: muestra_baja`.
- CA-14: Given cualquier insight, When se compara su `text` con `backend/phrases/es.json`, Then es la plantilla indicada por
  `template_id` con los marcadores rellenados, sin dígitos escritos a mano; y `python backend/phrases.py` valida las plantillas nuevas.
- CA-15: Given `GET /api/insights` con `entity=xyz`, `id` ausente o equipo/jugador inexistente, When se llama, Then responde 400
  `parametro_invalido` ("Falta el parámetro entity", "Falta el parámetro id") o 404 `no_encontrado` ("Equipo no encontrado" / "Jugador no
  encontrado").
- CA-16: Given un viewport de 375 px, When se abre Resumen, Then el bloque Insights no genera scroll horizontal y las frases se leen
  completas en varias líneas.

## 8. Fuera de alcance
- Las alertas en pantalla de Mi equipo (S8: "insights de la última semana" y "cambios bruscos"): INCREMENTO DIFERIDO (→ F-12,
  [../12-F-12-mi-equipo/spec.md](../12-F-12-mi-equipo/spec.md)). A-10 entrega `insights()` y `sudden_changes()`; F-12 decide la
  ventana (`alerts.lookback_days` → `window_games`) y el umbral (`alerts.change_z`) y los muestra.
- Traducción de las plantillas a inglés y portugués: INCREMENTO DIFERIDO (→ F-21); A-10 deja todo el texto en `es.json`.
- Insights para quintetos, emparejamientos, parejas, cuartos o zonas: el cliente los pide solo "por equipo y por jugador".
- Generación por IA o texto libre (prohibido por el cliente); recomendaciones tácticas (eso es F-17 / F-15).
- Insights sobre métricas de conteo y volumen (dependen de la base T-04): se trabaja con las tasas y eficiencias del conjunto estándar.
- Insights sobre métricas de posesión (A-02…A-05): se agregan a `rules.json` y a las plantillas cuando existan sus entidades, sin
  cambios de motor (hoy fuera: están en otras entidades).
- Historial o persistencia de insights, y notificaciones.
- Cambios bruscos por jugador (el cliente los describe para el equipo en S8).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **"Entre 3 y 5 frases" frente a "se dispara cuando percentil ≤ 10 o ≥ 90".** Con pocos valores
  extremos, completar hasta 3 obligaría a emitir frases de percentiles no extremos, que contradice la regla de disparo. Se prioriza
  la regla de disparo: el máximo es `insights.max_items`, el mínimo `insights.min_items` solo marca `below_min` y la nota en pantalla.
- [DECISIÓN PROPUESTA — confirmar] **Percentil de métricas "menos es mejor".** T-01 orienta el percentil (alto = mejor). Un percentil
  ≥ 90 en TO% significa "de los que menos pierden"; por eso la plantilla de esas métricas lo dice en palabras ("entre los mejores…;
  menos es mejor") y no usa la redacción literal del cliente, que sería ambigua ("percentil 99 de TO%").
- [DECISIÓN PROPUESTA — confirmar] **Plantillas por dirección, no por métrica.** El cliente da una sola plantilla de ejemplo. Se
  definen seis plantillas genéricas (`extremo_alto` / `extremo_bajo` × `higher` / `lower` / `neutral`) que insertan el nombre de la
  métrica con el marcador `{metrica}`; las plantillas por métrica (con consejo accionable) son de F-17 y el modo `insights` no las usa.
  Se pueden agregar plantillas específicas de una métrica sin cambiar el motor.
- [DECISIÓN PROPUESTA — confirmar] **Qué métricas entran.** Solo tasas y eficiencias (`base_mode = fixed`). Equipo: OER, DER, Net Rating,
  PACE, eFG%, TS%, PPT, FG2%, FG3%, FT%, uso de triple, FT Rate, TO%, OR%, DR%, AS/PER y AS%. Jugador: OER, eFG%, TS%, PPT, FG2%, FG3%,
  FT%, FT Rate, uso de triple, USO%, TO%, OR%, DR%, AS%, AS/PER y AS/pos. Se excluyen DER y Net Rating de jugador (dependen de los
  compañeros en cancha) y los conteos. Es una lista de datos editable (`rules.json`).
- [DECISIÓN PROPUESTA — confirmar] **Familias.** Tiro = eFG%, TS%, PPT; Circulación = AS/PER, AS%, AS/pos; el resto son familias de un solo
  elemento. Sin esto una racha de tiro generaría tres frases casi iguales.
- [DECISIÓN PROPUESTA — confirmar] **Orden.** Por extremidad `|percentil − 50|` decreciente; con empate, orden del catálogo T-05.
- [DECISIÓN PROPUESTA — confirmar] **Definición de cambio brusco (RF-16).** Una métrica del conjunto del plan de juego de un equipo
  tiene un cambio brusco cuando `|z| ≥ change_z`, con `z = delta orientado / desvío poblacional` y `delta` = valor de los últimos
  `window_games` partidos − valor pooled de los partidos anteriores (el "período anterior" de F-17). Defaults sugeridos a F-12:
  `change_z = alerts.change_z` (1,5) y `window_games` derivado de `alerts.lookback_days` (7 días) con piso `sample.team.min`. Si el
  equipo no tiene al menos `sample.team.min` partidos en el tramo reciente ni en el anterior, no hay alerta (`muestra_baja`). Los
  valores de `change_z` y `window_games` los pasa quien llama (F-12), A-10 no agrega claves de configuración.
- [DECISIÓN PROPUESTA — confirmar] **"Insights de la última semana".** Son los insights calculados con `last` = partidos de los últimos
  7 días (o los últimos `window_games`); los arma F-12 llamando a `insights()` con ese contexto. A-10 no agrega un parámetro de fechas.
- [DECISIÓN PROPUESTA — confirmar] **Entidad "jugador".** Se identifica por `player_id` (C-08); la población es la de jugadores con
  ≥ `sample.player.min` minutos en la competencia (T-01). El nombre en la frase es el de la ficha (`display_name`).
- [DECISIÓN PROPUESTA — confirmar] **Redondeo.** Las cifras de la frase usan el mismo formato y redondeo (mitad hacia arriba) que la
  interfaz; una diferencia de último dígito por redondeo de empates exactos entre servidor y cliente no se considera contradicción,
  pero se verifica sobre el seed (CA-1).
