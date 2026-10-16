# Spec — F-09: Comparar quintetos

> **ID:** F-09 · **Prioridad:** P2 · **Fase y orden:** 5·03
> **Depende de:** T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · F-05 ([../../fase-2-contexto-comparabilidad/08-F-05-comparar-jugadores/spec.md](../../fase-2-contexto-comparabilidad/08-F-05-comparar-jugadores/spec.md)) · F-06 ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md))
> **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-09 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S6 "Quintetos" · §3 T-02, T-05 · Arquitectura §3.5, §3.6, §3.7, §3.10, §3.12, §6, §7, §8 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §4 F-09):** "Comparación de dos combinaciones con el mismo formato que la comparación de equipos, aplicando los umbrales y la regresión de T-02." Criterio de aceptación del cliente: "Dos quintetos se comparan con radar y tabla enfrentada, con el badge de muestra visible en ambos."

**Por qué:** el mapa de secciones (§1.3 S6 "Comparar") fija un módulo "Quintetos" con "Comparación de dos combinaciones con el ajuste de muestra aplicado", requisito F-09. F-06 (fase 2) ya dejó pendiente esta comparación explícitamente: su spec §8 la marca "Comparación lado a lado de dos quintetos: F-09 (incremento sobre esta tabla: acción 'Comparar' en la fila). INCREMENTO DIFERIDO (→ F-09)."

**Qué existe hoy (verificado en código, rama `main`, y en el plan de F-06 de esta misma corrida):**
- `frontend/js/app.js` `renderCompare()` (línea 1474): patrón de comparación de equipos (radar + tabla enfrentada + avanzadas) que F-05 ya reutilizó para jugadores y que F-09 debe reutilizar para quintetos.
- `backend/lineups.py` `lineup_stats(games, team_code, players)`: dado un conjunto de 3-5 nombres, devuelve `sample{possessions, seconds}`, `metrics{oer, der, net_rating, efg_pct, ts_pct}`, `raw{...}`, `leaders`. F-06 (plan.md de esta misma corrida) agrega `all_lineups()` (todos los quintetos del equipo como `StatBundle`) y registra la tabla T-06 `team_lineups`, además de exponer `GET /api/metrics/lineup?id=<team>:<pids>` (tipo de entidad `lineup` de T-05).
- No existe hoy ningún endpoint ni vista que compare dos quintetos lado a lado (de un mismo equipo o de equipos distintos): la única forma de ver dos quintetos hoy es abrir el selector de combinación dos veces, sin comparación visual.
- `GET /api/lineup/<team_code>?players=A|B|C` (legado, sigue funcionando según F-06 RF-22) no admite comparar dos combinaciones en una sola llamada.

**Qué resolvieron features anteriores:** F-05 (fase 2, esta misma corrida) ya construyó el patrón de comparación reutilizando radar/tabla/avanzadas para jugadores con percentil por población propia; F-06 (fase 2, esta misma corrida) construyó `all_lineups()`, el conjunto estándar de quinteto vía `StatBundle`/`compute_standard`, la ficha T-01 de quinteto y el badge de muestra T-02 (con regresión y banda) para cada fila de la tabla de quintetos. T-02 (fase 1) define los umbrales, la regresión a la media y la banda de error que F-09 debe aplicar obligatoriamente (mandato explícito del cliente).

**Qué queda para F-09:** agregar el módulo "Quintetos" a la sección Comparar, con dos selectores de combinación (de 3 a 5 jugadores cada uno, de cualquier equipo), reusando `all_lineups`/`lineup_stats` de F-06 para obtener el `StatBundle` de cada combinación, aplicando el ajuste y el badge de T-02 a ambos lados, y el mismo formato visual (radar + tabla enfrentada) que equipos y jugadores.

## 1. Objetivo
Agregar un módulo "Quintetos" dentro de la sección Comparar que permita elegir dos combinaciones de 3 a 5 jugadores (del mismo equipo o de equipos distintos) y compararlas con el formato de radar y tabla enfrentada de la comparación de equipos, mostrando en ambos lados el ajuste por muestra y el badge de confiabilidad de T-02.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 F-09 (completo), §1.3 S6 "Comparar" → módulo Quintetos, §3 T-02 (umbrales, regresión, banda, badge, CA), §3 T-05 (conjunto estándar), §2 C-11 (nulos).
- `docs/api.md` § `GET /api/lineup/<team_code>?players=A|B|C`. `docs/frontend.md` § Vistas → Comparar, Equipo (pestaña Quintetos, si F-06 ya cerró).
- Arquitectura §3.5 (conjunto estándar T-05, tipo de entidad `lineup`), §3.6 (ficha T-01, población de quintetos = umbral de T-02), §3.7 (`sample.py`: `effective_min`, `sample_level`, `adjusted`, `band`, `is_ranked`), §3.10 (`all_lineups`, F-06), §3.12 (S6 `quintetos`, id de quinteto `<team_code>:<pid>-<pid>-…`), §6 (`GET /api/metrics/lineup`), §7.1, §7.2, §7.3, §8 (`metric-card.js`, `sample-badge.js`, `standard-panel.js`).
- Specs previos: `../../fase-2-contexto-comparabilidad/08-F-05-comparar-jugadores/spec.md` (mismo patrón, aplicado a jugadores); `../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md` §8 (incremento diferido que F-09 completa).

## 3. Historias de usuario
- US-1: Como entrenador, quiero comparar dos quintetos con el mismo formato con el que comparo equipos o jugadores, para decidir cuál combinación conviene usar en una situación concreta.
- US-2: Como entrenador, quiero que la comparación de quintetos muestre el ajuste por muestra en ambos lados, para no confiar en un quinteto de pocas posesiones que parece mejor que otro con muestra sólida.
- US-3: Como analista, quiero comparar un quinteto propio contra uno rival, para preparar un partido con evidencia previa.

## 4. Requisitos funcionales

- RF-1: El sistema DEBE ofrecer, dentro de la sección Comparar, un módulo "Quintetos" con dos selectores de combinación independientes (3 a 5 jugadores cada uno, de cualquier equipo), análogos a los de equipos y jugadores (F-05). · (US-1, US-3) (Esp. v2 §F-09, §1.3 S6)
- RF-2: El sistema DEBE mostrar, para las dos combinaciones elegidas, el mismo formato que la comparación de equipos: **radar comparativo** y **tabla de métricas enfrentadas**, con las claves del conjunto estándar de quinteto de T-05. · (US-1) (Esp. v2 §F-09 "mismo formato que la comparación de equipos")
- RF-3: El sistema DEBE aplicar **obligatoriamente** los umbrales y la regresión de T-02 a ambos quintetos antes de mostrarlos: cada métrica con regresión (OER, DER, Net Rating) trae el valor crudo y el ajustado, y la comparación usa el ajustado para determinar cuál color/ganador se resalta. · (US-2) (Esp. v2 §F-09 "aplicando los umbrales y la regresión de T-02")
- RF-4: El sistema DEBE mostrar el **badge de muestra** (T-02: nivel, posesiones, minutos, partidos) de cada uno de los dos quintetos, visible sin necesidad de interacción adicional. · (US-2) (Esp. v2 §F-09 CA "con el badge de muestra visible en ambos")
- RF-5: Un quinteto con muestra por debajo del mínimo efectivo de T-02 DEBE poder compararse igual (no se bloquea la comparación), mostrando su badge en gris con la advertencia correspondiente, sin ocultar ningún valor. · (US-2) (Esp. v2 §T-02 "Por debajo del mínimo, la métrica se muestra en gris… Se sigue viendo, pero no se recomienda a partir de ella")
- RF-6: El sistema DEBE permitir comparar quintetos del **mismo equipo** o de **equipos distintos** (incluida la combinación de un quinteto propio contra uno rival, ya usada por F-03 en el módulo de emparejamientos cuando esté disponible). · (US-3) (Esp. v2 §1.3 S6 "Head to head", contexto de la sección Comparar)
- RF-7: El sistema DEBE reusar `all_lineups`/`lineup_stats` (F-06) para obtener el `StatBundle` de cada combinación elegida, sin duplicar la lógica de reconstrucción de segmentos (`build_segments`). · (US-1) (arquitectura §3.10, F-06 "reusa `build_segments`")
- RF-8: Ningún valor inexistente se muestra como 0 (C-11): un quinteto sin intentos de tiros libres → fila de FT% "—"; un quinteto con posesiones insuficientes para una métrica derivada → "—" con razón, sin color ganador/perdedor en esa fila. · (US-2) (Esp. v2 §C-11)
- RF-9: El sistema DEBE identificar cada combinación por su id (`<team_code>:<pid>-<pid>-…`) en la URL de comparación (`#/comparar/quintetos?a=<id>&b=<id>`), reusando el mismo formato de id que F-06. · (US-1) (arquitectura §3.12)
- RF-10: El sistema DEBE permitir llegar a esta comparación desde una acción "Comparar" en la tabla de quintetos de F-06 (fila con checkbox, igual patrón que F-08→F-05), si F-06 ya está implementado. · (US-1) (F-06 spec §8 "acción 'Comparar' en la fila")

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `GET /api/metrics/lineup?id=<team>:<pids>&competition=<id>` | endpoint genérico T-05 (tipo `lineup`, registrado por F-06) | shape §7.3 + fichas §7.1 (T-01) + `adj`/`sample` §7.2 (T-02) | de T-05/F-06; F-09 solo lo consume, dos veces |
| `GET /api/lineup/<team_code>?players=A\|B\|C` (legado) | endpoint existente | shape actual (`sample`, `metrics`, `raw`, `leaders`) | existe; F-09 lo usa como fallback si `/api/metrics/lineup` no está disponible aún |

Sin cambios de esquema (F-09 no está en la lista de `§5 Cambios de esquema previstos` de la arquitectura).

## 6. Estados de UI
Módulo **Quintetos** de S6 (`#/comparar/quintetos`). Todo copy nuevo con `t()` y marcado para `docs/frontend.md`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selectores de combinación (A y B) | — | placeholder "Elegí entre 3 y 5 jugadores" (copy existente, Feature 03) | 400 "Elegí entre 3 y 5 jugadores" (existente) | — | dos selectores de checkboxes con equipo visible en cada uno |
| Botón "Comparar" | spinner + "Comparando..." (copy existente, mismo patrón que equipos/jugadores) | — | toast con el mensaje del backend o "No se pudo comparar" (*nuevo*, mismo patrón F-05) | `/api/*` siempre a red (SW) | — |
| Resultado (radar + tabla + badges) | — | "Elegí dos combinaciones para comparar" (*nuevo*, antes de la primera comparación) | 404 "Equipo no encontrado o sin play-by-play" (existente) | idem | radar comparativo, tabla enfrentada con colores ganador/perdedor sobre el valor **ajustado** (T-02) y "—" en nulos, badge de muestra de T-02 visible junto a cada quinteto (RF-4) |

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "Dos quintetos se comparan con radar y tabla enfrentada, con el badge de muestra visible en ambos." Given dos combinaciones válidas elegidas en los selectores, When se pulsa "Comparar", Then se muestran el radar comparativo y la tabla de métricas enfrentadas, y el badge de muestra de T-02 aparece junto a cada uno de los dos quintetos sin necesidad de interacción adicional.
- CA-2: Given dos quintetos con Net Rating crudo similar pero posesiones muy distintas (uno con 12, otro con 60), When se comparan, Then el ganador de la fila Net Rating se determina por el valor **ajustado**, no por el crudo, y el quinteto de 12 posesiones muestra badge BAJA con banda más ancha.
- CA-3: Given un quinteto sin ningún tiro libre intentado en la selección, When se lo compara, Then su fila de FT% muestra "—", no "0/0 (0%)", y esa fila no colorea ganador/perdedor para ese lado.
- CA-4: Given dos quintetos de equipos distintos, When se comparan, Then la comparación se completa sin error (RF-6) y cada uno conserva la identificación de su equipo en la cabecera de su columna.
- CA-5: Given los mismos valores que ya se muestran en la tabla completa de quintetos de F-06 para una combinación concreta, When se la compara en F-09, Then los valores crudo y ajustado coinciden numéricamente con los de esa fila (misma fuente, `all_lineups`/T-05/T-02).
- CA-6: Given el selector con la misma combinación exacta elegida en A y B, When se pulsa "Comparar", Then el sistema responde "Elegí dos combinaciones distintas" (*nuevo*, análogo a F-05 CA-5) y no ejecuta la comparación.

## 8. Fuera de alcance
- Comparación de más de dos quintetos simultáneos: fuera de alcance de v2.
- Emparejamiento quinteto propio vs quinteto rival con historial de enfrentamientos (matriz completa): F-03/F-07 (F-09 solo compara dos combinaciones sueltas, sin historial de cruces).
- Búsqueda de quintetos por filtro de métrica para elegir cuáles comparar: F-10 (buscador de quintetos); F-09 solo ofrece el selector directo de jugadores, igual que el selector de combinación de F-06.
- Sugerencia automática de qué quinteto comparar: F-15.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **Radar de quintetos con muestra baja.** El radar de equipos/jugadores no tiene noción de "muestra insuficiente" por eje; con quintetos, una métrica de un eje puede venir con banda muy ancha. Decisión: el radar usa el valor **ajustado** (T-02) para los ejes con regresión (OER, DER derivados) y el valor crudo para el resto (eFG%, TS%, etc., que T-02 no regresiona); no se dibuja banda de error en el radar (queda solo en la tabla enfrentada y en el badge), para no sobrecargar el gráfico.
2. [DECISIÓN PROPUESTA — confirmar] **Comparación con las tres tablas de equipos (tiro, conteos, avanzadas) o con el conjunto completo de T-05.** El cliente pide "mismo formato que la comparación de equipos", que hoy tiene 3 bloques con un subconjunto fijo de métricas (no el conjunto completo de T-05). Decisión: F-09 replica esos 3 bloques con las claves de quinteto equivalentes (mismo criterio que F-05 para jugador), y dentro de la tabla de avanzadas agrega las columnas con regresión (`adj`) que T-02 exige mostrar. El conjunto completo de T-05 queda disponible solo si el usuario expande un panel adicional "Ver todas las métricas" (reutiliza `standard-panel.js` de T-05), no reemplaza el formato de 3 bloques.
3. [DECISIÓN PROPUESTA — confirmar] **Identificación de "misma combinación" (CA-6).** Se compara por el id de quinteto (`<team_code>:<pid>-<pid>-…` ordenado ascendente); dos combinaciones con los mismos jugadores pero de distinto equipo (caso imposible en la práctica, un jugador solo pertenece a un equipo por temporada) nunca colisionan.
