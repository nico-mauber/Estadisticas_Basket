# Plan — Feature 15: métricas de jugador

> Spec: `sdd/specs/15-metricas-jugador/spec.md` (gate del Paso 1 pasado). Reglas: `sdd/02-plan.md`.

## 1. Enfoque

Tres bloques independientes, todos en `calc_player_stats` salvo el último:

1. **Cinco indicadores nuevos** — divisiones sobre magnitudes que la función ya tiene calculadas
   (`p_pos`) o que puede derivar del dict de entrada (`minutes`). Sin datos externos.
2. **OR%/DR%/TRB% individuales** — necesitan los rebotes del **rival**, que hoy no llega a la función.
   El cambio de fondo es de firma: `calc_player_stats(..., opp=None)`, y que las tres rutas que la
   llaman le pasen el rival.
3. **AS/PER acumulado** — no es un cambio de fórmula sino de **dónde** se calcula: deja de ser un
   valor por partido promediado y pasa a computarse una vez, sobre los totales de la temporada. Vive
   en las rutas, junto al resto de los agregados.

Sin esquema, sin dependencias, sin endpoints nuevos.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | service | `calc_player_stats`: `as_pos`, `tov_pos`, `pts_pos`, `orb_min`, `drb_min` | RF-1…RF-5 |
| `backend/stats_engine.py` | service | `calc_player_stats`: parámetro `opp` + `or_pct`/`dr_pct`/`trb_pct` individuales | RF-6 |
| `backend/stats_engine.py` | service | `season_ast_to(total_ast, total_tov)` — AS/PER acumulado, única definición | RF-7, RF-8 |
| `backend/stats_engine.py` | service | `league_averages`: sumar las claves nuevas a la lista de métricas | RF-9 |
| `backend/app.py` | route | `player_stats`: pasar `opp`; `averages.ast_to` desde los totales | RF-6, RF-7 |
| `backend/app.py` | route | `team_stats`: `averages.ast_to` de equipo desde los totales | RF-7, RF-8 |
| `backend/app.py` | route | `search_players`: pasar `opp` (derivado de `team_rows`); AS/PER acumulado | RF-6, RF-7 |
| `backend/app.py` | route | `team_players`: pasar `opp` | RF-6 |
| `frontend/js/app.js` | js-view | Perfil de jugador: 5 cards nuevas con su `Ø` | RF-1…RF-4, RF-9 |
| `docs/metrics.md` | doc | Fórmulas nuevas, equivalencia `PTS/pos ≡ OER`, criterio de AS/PER (Paso 4) | todos |
| `docs/api.md` | doc | Campos nuevos y cambio de semántica de `ast_to` (Paso 4) | RF-7 |
| `docs/frontend.md` | doc | Etiquetas nuevas del perfil (Paso 4) | RF-1…RF-4 |

**Matriz RF → archivo**: RF-1 ✔ · RF-2 ✔ · RF-3 ✔ · RF-4 ✔ · RF-5 ✔ · RF-6 ✔ · RF-7 ✔ · RF-8 ✔ · RF-9 ✔

## 3. Backend — rutas y modelos

**Sin tabla, columna ni endpoint nuevo.** Sin `upgrade_db()`.

| Método + ruta | Cambio | Errores |
|---|---|---|
| `GET /api/player/<team>/<name>` | `game_log[]` y `averages` suman `as_pos`, `tov_pos`, `pts_pos`, `orb_min`, `drb_min`; `or_pct`/`dr_pct`/`trb_pct` pasan de ausentes a presentes; `averages.ast_to` cambia de semántica (acumulado) | sin cambio |
| `GET /api/players/<team>`, `GET /api/search/players` | Mismos campos nuevos | sin cambio |
| `GET /api/team/<code>` | `averages.ast_to` acumulado | sin cambio |

## 4. Backend — lógica

| Función | Módulo | Fórmula exacta | RF |
|---|---|---|---|
| `calc_player_stats` — `as_pos` | `stats_engine.py` | `AST / POS_jug` · `POS_jug = 2PA + 3PA + FTA×0.44 + TOV − OR` (`docs/metrics.md` §Posesiones), ya calculado como `p_pos` | RF-1 |
| `calc_player_stats` — `tov_pos` | `stats_engine.py` | `TOV / POS_jug` — etiqueta de UI `PER/pos` | RF-2 |
| `calc_player_stats` — `pts_pos` | `stats_engine.py` | `PTS / POS_jug`. **Reusa la variable `oer` ya calculada** — no se recalcula (spec §9) | RF-3 |
| `calc_player_stats` — `orb_min`, `drb_min` | `stats_engine.py` | `OR / min_jug` y `DR / min_jug`, con `min_jug = _parse_minutes(p["minutes"])`. `null` si `min_jug == 0` | RF-4, RF-5 |
| `calc_player_stats` — `or_pct`, `dr_pct`, `trb_pct` | `stats_engine.py` | `(REB_jug × dur_partido) / (min_jug × (REB_equipo + REB_rival_complementario))` — RF-6. `null` si falta `team`, falta `opp` o `min_jug == 0` | RF-6 |
| `season_ast_to(ast, tov)` | `stats_engine.py` (**nueva**) | `AST_total / TOV_total`; `None` si `TOV_total == 0`. Definición única compartida por equipo y jugador | RF-7, RF-8 |
| `league_averages` | `stats_engine.py` | Agregar `as_pos`, `tov_pos`, `pts_pos`, `orb_min`, `drb_min` a `keys`. `tov_pos` entra en `lower_is_better` | RF-9 |

Todas las divisiones usan `_safe_div`, que ya devuelve `None` con denominador 0 (Feature 08) — RF-5
sale por construcción.

**Cómo obtiene cada ruta el rival:**
- `player_stats` — ya tiene `opp = _opp_for(row.game_id, team_code)` en el bucle.
- `team_players` — agregar la misma llamada.
- `search_players` — derivarlo del mapa `team_rows` ya construido: la otra entrada con el mismo
  `game_id` y distinto `team_code`. Sin consulta extra a la base.

## 5. Frontend — capa API (api.js)

**Sin cambios.** Solo llegan campos nuevos.

## 6. Frontend — UI (app.js)

Cinco `statBox` nuevas en el bloque de producción del perfil de jugador, reusando el helper existente
(que ya trae el `Ø` de la competencia activa desde la Feature 14):

| Etiqueta | Clave | Formato | Mejor |
|---|---|---|---|
| `AS/pos` | `as_pos` | decimal | alto |
| `PER/pos` | `tov_pos` | decimal | **bajo** |
| `PTS/pos` | `pts_pos` | decimal | alto |
| `RO/min` | `orb_min` | decimal | alto |
| `RD/min` | `drb_min` | decimal | alto |

Las cards `OR%`/`DR%` existentes no cambian de marcado: pasan a recibir valor en vez de `undefined`.

Ninguna clave nueva contiene `pct`, `or_`, `dr_`, `to_` ni `as_`… salvo **`as_pos`**, que dispararía el
heurístico `isPct` de `statBox` (`includes("as_")`) y lo mostraría multiplicado por 100. Va a la lista
`NOT_PCT` junto a `def_to_ratio` — la fragilidad que la Feature 14 dejó documentada.

Mobile-first: cinco cards más en un `.stat-grid` que ya hace wrap; sin cambios de breakpoint.

## 7. Navegación

Sin vistas ni hashes nuevos.

## 8. Contratos de datos

```
GET /api/player/<team>/<name>
  game_log[].{as_pos, tov_pos, pts_pos, orb_min, drb_min}   // NUEVOS, pueden ser null
  game_log[].{or_pct, dr_pct, trb_pct}                      // antes AUSENTES, ahora presentes
  averages.{...}                                            // mismos campos
  averages.ast_to                                           // CAMBIO DE SEMÁNTICA: acumulado
```

Sin filas SQLAlchemy nuevas ni modificadas.

## 9. Manejo de errores y offline

Sin códigos HTTP nuevos.

**Casos borde**:
- Jugador con minutos pero 0 posesiones (solo rebotes y faltas) → `as_pos`/`tov_pos`/`pts_pos` `null`,
  `orb_min`/`drb_min` con valor.
- Partido sin fila del rival → `or_pct`/`dr_pct`/`trb_pct` `null`; los cinco indicadores no se ven
  afectados (no dependen del rival).
- Temporada sin pérdidas → AS/PER `"—"` (RF-8).

**Service worker**: sin assets nuevos.

## 10. Riesgos / decisiones

**D-1 · Cambiar la firma de `calc_player_stats` toca cuatro llamadas.**
`opp` se agrega como parámetro **opcional** con default `None`: las llamadas que no lo pasen siguen
funcionando y devuelven `null` en las tres métricas de rebote. Así el cambio no puede romper un
llamador olvidado — degrada a "sin dato", que es la semántica correcta.

**D-2 · `PTS/pos` duplica al OER de jugador.**
Se expone la misma variable bajo dos claves. Es redundancia deliberada (spec §9): el cliente pide el
indicador por su nombre y una sola fuente evita que diverjan. Documentado en `docs/metrics.md`.

**D-3 · `averages.ast_to` cambia de significado sin cambiar de nombre.**
Un consumidor que compare valores viejos contra nuevos verá un salto. Es el punto del requisito —
el valor viejo era incorrecto— pero se documenta en `docs/api.md` para que el salto sea explicable.

**D-4 · El sentinel `99.0` sobrevive en el `game_log`.**
RF-8 corrige el valor de temporada, que es el visible. El valor por partido sigue con el sentinel
(spec §8). Consecuencia: la evolución por partido de AS/PER, si alguna vez se grafica, mostraría
picos de 99. Hoy no se grafica. Registrado.

**D-5 · La fórmula individual de rebote depende de que los minutos sean parseables.**
`_parse_minutes` devuelve `0.0` ante cualquier formato raro, y `0` minutos produce `null` — nunca una
división por cero ni un número inflado. Degradación segura.

**D-6 · `as_pos` cae en la trampa de `isPct`.**
Detectado en el plan, no en la implementación: `"as_pos".includes("as_")` es verdadero. Sin agregarlo
a `NOT_PCT`, un AS/pos de `0.12` se mostraría como `12.0%`. Es exactamente la fragilidad que la
Feature 14 registró como deuda; acá se paga por segunda vez.
