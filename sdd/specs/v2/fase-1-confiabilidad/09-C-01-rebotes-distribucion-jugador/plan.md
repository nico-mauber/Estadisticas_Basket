# Plan — C-01: Rebotes y distribución en perfil de jugador

> **ID:** C-01 · **Prioridad:** P0 · **Fase y orden:** 1·09 (se recomienda ejecutarlo después de C-02, ver §10 D-1)
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)) · **Habilita:** T-05 ([../13-T-05-conjunto-estandar-metricas/plan.md](../13-T-05-conjunto-estandar-metricas/plan.md)), A-12 · el `Ø` lo completa C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 C-01 · Arquitectura §2.1, §2.2, §3.5, §7.4
> **Estimación:** M · 4–6 h

## 1. Enfoque
Las cinco métricas y OR%/DR%/TRB% individuales ya existen (Feature 15). C-01 es un delta de **coherencia** sobre `stats_engine`
y las rutas de jugador, sin esquema ni endpoints nuevos:
1. **Fórmulas por partido** (`calc_player_stats`): las tasas por posesión valen `None` cuando `POS ≤ 0` (hoy salen negativas) y
   los porcentajes de rebote individual valen `None` con marca `estimacion_invalida` cuando superan 100 %. El dict devuelto lleva
   además términos privados (`_pool`, `_invalid`) para poder agregar la temporada.
2. **Agregación de temporada**: función pura `season_player_rates(sums)` que calcula las ocho tasas como **cociente de totales**
   (DA-02) a partir de las sumas de la selección (`sum_pool`). `player_stats` y `search_players` la usan en lugar de promediar las
   tasas por partido; `oer` de jugador sale del mismo cálculo (equivalencia PTS/pos ≡ OER).
3. **Razones de nulo**: `sin_intentos` (POS ≤ 0, ya existente) y `estimacion_invalida` (**código nuevo**, propuesta).
4. **UI**: rótulos con definición (`title`) en las dos cards del perfil, con la aclaración de escala del OR%/DR%, y la etiqueta
   nueva en `NULL_REASON_LABELS`.
5. **Documentación** y procedimiento de verificación contra el box (§10.1).

La selección (competencia / últimos N) la entrega C-02 (backend); C-01 se **registra** en su agregación (`POOLED_GROUPS`). Con C-02
cerrado, los Grupos B3/B4 se reducen a ese registro (ver §10 D-1).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | service | `_safe_pos_div`; `calc_player_stats` (tasas por posesión con `POS > 0`, `_pct_individual` con tope 100 %, `_pool`/`_invalid`); `sum_pool(per_game)`; `season_player_rates(sums)`; `strip_private(d)`; `null_reasons(..., overrides)` con `estimacion_invalida`; `null_reason` sin cambios de mapeo | RF-1…RF-8 |
| `backend/app.py` | route | `player_stats`: `game_log` sin claves privadas, `averages` de las 8 claves + `oer` desde `season_player_rates`, `null_reasons` con las razones; `search_players`: ídem sobre sus `per_game`. Sin fórmulas en la ruta | RF-6, RF-7, RF-9 |
| `frontend/js/core/format.js` | js-core | `NULL_REASON_LABELS.estimacion_invalida` | RF-5 |
| `frontend/js/app.js` | js-view | `_renderPlayerContent`: rótulos con `title` (AS/pos, PER/pos, PTS/pos, RO/min, RD/min, OR%, DR%) en las dos cards | RF-10 |
| `frontend/sw.js` | sw | Subir `CACHE` al siguiente entero (hoy `smart-basket-v13`; el número se asigna al integrar). Sin archivos nuevos en `STATIC` | assets |
| `docs/metrics.md` | doc (cierre) | §"Por posesión y por minuto": cociente de totales, POS ≤ 0 → nulo; §OR%/DR% individual: forma acumulada, tope 100 %, aclaración de escala | RF-1…RF-5 |
| `docs/api.md` | doc (cierre) | Nota "Métricas de jugador por posesión y por minuto": agregación acumulada y razones (`sin_intentos`, `estimacion_invalida`); tabla de códigos de `null_reasons` | RF-4, RF-5, RF-9 |
| `docs/frontend.md` | doc (cierre) | Cards del perfil de jugador: rótulos/definiciones; etiqueta nueva | RF-10 |

**Matriz RF → archivo:** RF-1 ✔ (stats_engine, app.py) · RF-2 ✔ (stats_engine, app.py) · RF-3 ✔ (stats_engine, app.py) · RF-4 ✔ (stats_engine, format.js) ·
RF-5 ✔ (stats_engine, format.js) · RF-6 ✔ (stats_engine, app.py) · RF-7 ✔ (stats_engine `season_player_rates`) · RF-8 ✔ (app.py `played_log`, `sum_pool`) ·
RF-9 ✔ (app.py `search_players`) · RF-10 ✔ (app.js) · RF-11 ✔ (diferido a C-02; la estructura de `season_player_rates` lo habilita). Sin RF huérfanos.

## 3. Backend — rutas y modelos
**Sin tablas ni columnas nuevas. Sin `upgrade_db()`. Sin endpoints nuevos.**

| Método + ruta | Cambio de C-01 | Errores |
|---|---|---|
| `GET /api/player/<team_code>/<player_name>` · `GET /api/player/<int:player_id>` (C-08) | `averages.{as_pos, tov_pos, pts_pos, oer, orb_min, drb_min, or_pct, dr_pct, trb_pct}`: cociente de totales de la selección; `game_log[]`: valor del partido, `null` (razón `sin_intentos`) si `POS ≤ 0` y `null` (razón `estimacion_invalida`) si el % individual > 100 %; las claves privadas no se serializan | 404 "Jugador no encontrado" (existente) |
| `GET /api/search/players` | las mismas 9 claves con el criterio nuevo; `null_reasons` por fila con las razones | — |

Ejemplo 1 — G. Viera (TAB), base local (`GET /api/player/TAB/G.%20Viera`, extracto):
```json
{
  "player": "G. Viera", "games": 2,
  "averages": {"as_pos": 0.1453, "tov_pos": 0.0, "pts_pos": 1.0174, "oer": 1.0174,
               "orb_min": 0.0403, "drb_min": 0.0403, "or_pct": 0.0423, "dr_pct": 0.0387, "trb_pct": 0.0404},
  "null_reasons": {},
  "game_log": [
    {"game_id": "2849330", "played": true, "possessions": -0.12, "as_pos": null, "tov_pos": null, "pts_pos": null, "oer": null,
     "orb_min": 0.1115, "null_reasons": {"as_pos": "sin_intentos", "tov_pos": "sin_intentos", "pts_pos": "sin_intentos", "oer": "sin_intentos"}},
    {"game_id": "2849343", "played": true, "possessions": 7.0, "as_pos": 0.0, "tov_pos": 0.0, "pts_pos": 0.7143, "oer": 0.7143}
  ]
}
```
(antes: `averages.as_pos −4.1666`, `oer −7.9762`.) Ejemplo 2 — J. Lucchini (TRO; 0:15 min, 1 RO):
`"averages": {"as_pos": null, "tov_pos": null, "pts_pos": null, "oer": null, "orb_min": 4.0, "drb_min": 0.0, "or_pct": null, "dr_pct": 0.0, "trb_pct": null}`,
`"null_reasons": {"as_pos": "sin_intentos", "tov_pos": "sin_intentos", "pts_pos": "sin_intentos", "oer": "sin_intentos", "or_pct": "estimacion_invalida", "trb_pct": "estimacion_invalida"}`
(`orb_min 4,0` es el valor correcto de 1 RO en 15 s: la muestra chica es asunto de T-02).

## 4. Backend — lógica
Todas en `backend/stats_engine.py` (Constitución regla 4: fórmulas on-the-fly, nada persistido).

| Función | Firma / algoritmo | RF |
|---|---|---|
| `_safe_pos_div` NUEVO (privada) | `_safe_pos_div(num, den)` → `round(num/den, 4)` si `den` es un número `> 0`; si no, `None`. Para tasas por posesión: la posesión puede ser ≤ 0 (se resta el RO) | RF-4 |
| `_pct_individual` NUEVO (privada) | `_pct_individual(num, den) -> (valor, invalido)`: `v = _safe_div(num, den)`; si `v is not None and v > 1` → `(None, True)`; si no `(v, False)`. `den == 0` → `(None, False)` (razón `sin_intentos`) | RF-5 |
| `calc_player_stats(p, team_pos, team=None, game_minutes=40, opp=None)` (mod.) | `p_pos = possessions(fga2, fga3, fta, orb, tov)`; `oer = _safe_pos_div(pts, p_pos)`; `as_pos = _safe_pos_div(ast, p_pos)`; `tov_pos = _safe_pos_div(tov, p_pos)`; `pts_pos = oer`; `mp = _parse_minutes(minutes)`; `orb_min = _safe_div(orb, mp)`; `drb_min = _safe_div(drb, mp)`. Si `team and opp and mp`: `L = game_minutes`; `or_n = orb·L`, `or_d = mp·(t_orb + o_drb)`; `dr_n = drb·L`, `dr_d = mp·(t_drb + o_orb)`; `tr_n = (orb+drb)·L`, `tr_d = mp·(t_orb + t_drb + o_orb + o_drb)`; cada `*_pct` con `_pct_individual`. Retorno: las claves actuales + `"_pool": {"pos": p_pos, "min": mp, "or_n", "or_d", "dr_n", "dr_d", "tr_n", "tr_d"}` (los seis términos de rebote solo si hay equipo y rival) + `"_invalid": {"or_pct", …}` (conjunto con los % > 100 %). `possessions` (clave pública) sigue siendo `round(p_pos, 2)` | RF-1…RF-5 |
| `sum_pool(per_game: list[dict]) -> dict` NUEVO | Suma sobre los dicts de `calc_player_stats` **de partidos jugados**: `ast`, `tov`, `pts`, `orb`, `drb` y cada término de `_pool` con prefijo `pool_` (`pool_pos`, `pool_min`, `pool_or_n`, …). Lista vacía → `{}` | RF-1, RF-2, RF-3, RF-8 |
| `season_player_rates(sums: dict) -> tuple[dict, dict]` NUEVO | Ver pseudo-código abajo. Devuelve `(valores, razones)` | RF-1…RF-7 |
| `strip_private(d: dict) -> dict` NUEVO | `{k: v for k, v in d.items() if not k.startswith("_")}`; se usa antes de serializar `game_log` | — |
| `null_reasons(metrics, *, played=True, overrides=None)` (mod.) | Para cada clave con valor `None`: `overrides[k]` si existe → `"estimacion_invalida"` si `k in metrics.get("_invalid", ())` → `null_reason(k, played=played)`. Los valores no-`None` (incluidos `_pool` y `_invalid`) se ignoran | RF-4, RF-5 |

**`season_player_rates(sums)`** (pseudo-código; `s = sums.get`):
```
pos = s("pool_pos", 0); mn = s("pool_min", 0)
vals = {
  "as_pos":  _safe_pos_div(s("ast",0), pos),
  "tov_pos": _safe_pos_div(s("tov",0), pos),
  "pts_pos": _safe_pos_div(s("pts",0), pos),
  "orb_min": _safe_div(s("orb",0), mn),
  "drb_min": _safe_div(s("drb",0), mn),
}
vals["oer"] = vals["pts_pos"]                       # PTS/pos ≡ OER de jugador (RF-7)
invalid = set()
for key, num, den in (("or_pct","pool_or_n","pool_or_d"), ("dr_pct","pool_dr_n","pool_dr_d"), ("trb_pct","pool_tr_n","pool_tr_d")):
    v, bad = _pct_individual(s(num,0), s(den,0))
    vals[key] = v
    if bad: invalid.add(key)
reasons = {k: ("estimacion_invalida" if k in invalid else "sin_intentos") for k, v in vals.items() if v is None}
return vals, reasons
```
Fórmulas (copiadas de `docs/metrics.md` y del glosario v2): `POS_jug = T2i + T3i + 0,44 × TLi + PER − RO`;
`AS/pos = ΣAST/ΣPOS_jug`; `PER/pos = ΣTOV/ΣPOS_jug`; `PTS/pos = ΣPTS/ΣPOS_jug`; `RO/min = ΣRO/Σmin`; `RD/min = ΣRD/Σmin`;
`OR% = Σ(RO·L)/Σ(min·(RO_eq + RD_riv))`, `DR% = Σ(RD·L)/Σ(min·(RD_eq + RO_riv))`, `TRB% = Σ(REB·L)/Σ(min·(REB_eq + REB_riv))`.
La suma de `POS_jug` partido a partido es igual a la fórmula aplicada a los totales de la temporada (es lineal en los conteos), así que un partido
con `POS < 0` resta de la suma (es el RO que ese partido le "debe") en lugar de descartarse.

**Manejo de nulos (C-11).** `ΣPOS ≤ 0` → `sin_intentos` en `as_pos`, `tov_pos`, `pts_pos`, `oer`; `Σmin = 0` (jugador sin minutos) → `None` y,
para el perfil completo, razón `dnp` (la ruta lo decide con `played=bool(played_log)`); denominador de % = 0 o sin equipo/rival → `None`
`sin_intentos`; % > 100 % → `estimacion_invalida`. Un `0.0` real (0 pérdidas con `ΣPOS > 0`) se conserva. Los DNP no se pasan a
`sum_pool` (RF-8). **Casos borde**: `ΣPOS = 0` con minutos > 0 (14 de 152 jugadores en la base local) → tres tasas nulas y `orb_min`/`drb_min`
numéricos; partido jugado sin fila de equipo o de rival (importación parcial) → sin términos de rebote ese partido (no entra ni al
numerador ni al denominador); si ninguno tiene términos, % nulo `sin_intentos`. **Caché:** ninguna (cálculo por petición, como hoy).

**Rutas (sin lógica de negocio):**
- `player_stats`: `adv = calc_player_stats(...)` se conserva en `per_game_adv`; `game_log.append({…, **strip_private(adv), "null_reasons": null_reasons(adv, played=is_played)})`;
  tras `averages = {k: _avg(k) for k in keys}`: `vals, reasons = season_player_rates(sum_pool([a for a, g in zip(per_game_adv, game_log) if g["played"]]))`;
  `averages.update(vals)`; `null_reasons(averages, played=bool(played_log), overrides=reasons)`.
- `search_players`: `vals, reasons = season_player_rates(sum_pool(per_game))` por jugador; `rec.update({k: vals[k] for k in vals})`; `null_reasons({…}, played=bool(per_game), overrides=reasons)`.

## 5. Frontend — capa API (api.js)
Sin métodos nuevos ni cambios.

## 6. Frontend — UI
**Dónde vive.** Fase 1 (antes de X-01): cards "Por posesión y por minuto" y "Rebotes & distribución" de `_renderPlayerContent`
(`#sec-player`). X-01 las reubica en la pestaña `distribucion` de S4 sin cambiar su contenido (Arquitectura §3.12).

**Rótulos con definición.** `statBox` inserta el `label` como HTML, así que se pasa `<span title="…">AS/pos</span>` (sin cambiar la
firma de `statBox`). Textos (español rioplatense, sin `t()` por DA-21), fijados en el spec §6:
`AS/pos`, `PER/pos`, `PTS/pos`, `RO/min`, `RD/min`, `OR%` y `DR%` (estos dos con la aclaración "estimado por minutos; no comparable con el OR% de equipo").
Un helper local `_hint(label, text)` en `app.js` (1 línea) arma el `<span title>` con `esc(text)`.

**Nulos.** `rs.<clave>` ya llega a `statBox` (`nullDisplay(reason)`); `estimacion_invalida` agrega su etiqueta a
`NULL_REASON_LABELS` ("Estimación no válida: la muestra de minutos es demasiado chica"). Los "—" de `sin_intentos` conservan la
etiqueta existente. Nunca se aplica color de rendimiento a un nulo (`statClass`).

**Estados.** loading / vacío / error / offline: los existentes de la vista. Jugador sin partidos jugados → "—" con `title` "No jugó (DNP)".
Mobile (<768 px): sin cambios de layout (solo atributos `title`; en táctil se ve con tap largo, igual que los nulos de C-11).

Sin componentes nuevos ni CSS nuevo. `sw.js`: `app.js` y `format.js` cambian → subir `CACHE`.

## 7. Navegación
Sin vistas ni rutas nuevas. En X-01: `#/jugador/<id>/distribucion`.

## 8. Contratos de datos
```
GET /api/player/…   averages.{as_pos, tov_pos, pts_pos, oer, orb_min, drb_min, or_pct, dr_pct, trb_pct} : number | null
                    null_reasons.<clave> : "sin_intentos" | "estimacion_invalida" | "dnp" | "no_registrado" | "sin_perdidas"
                    game_log[i].<clave>  : valor del partido | null (+ game_log[i].null_reasons)
GET /api/search/players   fila.<las mismas 9 claves> + null_reasons
```
Códigos de razón: `estimacion_invalida` es **PROPUESTA (no está en 00-arquitectura-transversal.md §7.4)**; ver §10 D-2.
Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
Sin códigos HTTP nuevos. 404 como hoy. `sw.js`: subir `CACHE` (cache-first). Un nulo no es un error: se renderiza "—" con su razón.

## 10. Riesgos / decisiones
- **D-1 · Orden con C-02 (recomendado: C-02 antes).** C-02 crea `stats_engine.aggregate_games` con `POOLED_GROUPS` (grupos que reciben las
  sumas de la selección y devuelven `(valores, razones)`, la misma firma que `season_player_rates`) y mueve el filtro de competencia / últimos N al backend. Con C-02 cerrado,
  `season_player_rates` se registra como grupo (junto con `sum_pool` para los términos `_pool`) y `player_stats`/`search_players` no la
  llaman directamente; CA-10 y CA-11 salen sin código extra. Si C-01 se ejecuta antes (orden de carpeta), las rutas llaman a
  `season_player_rates(sum_pool(...))` como describe §4, y **bajo un filtro del cliente (`_computeAvg`)** estos ocho indicadores siguen
  siendo media de tasas (no hay términos para sumar en el cliente, y calcularlos en JS violaría la regla 4): CA-10 queda pendiente
  hasta cerrar C-02 (registrar en progress).
- **D-2 · Código `estimacion_invalida` (PROPUESTA).** Alternativa: reutilizar `sin_datos` o `no_aplica` (semánticas distintas). Justificación del código
  propio: la UI puede explicarle al usuario *por qué* un porcentaje no se muestra. Se agrega a `NULL_REASON_LABELS` y a `docs/api.md`;
  reportado como hueco de la arquitectura. T-02 podría reemplazarlo por su propio criterio de muestra.
- **D-3 · Se cambia el número visible de varios jugadores** (media de tasas → cociente de totales; negativos → nulo). Registrar antes/después en
  progress (R-04) para al menos: M. Perdomo (`AS/pos 0,5665 → 0,4743`), G. Viera (`−4,1666 → 0,1453`; `OER −7,9762 → 1,0174`), S. Sosa (TAB).
- **D-4 · `oer` de jugador pooled, `oer` de equipo no.** Adelanto parcial de DA-02 limitado a lo que exige la equivalencia PTS/pos ≡ OER; T-05 unifica.
- **D-5 · Términos privados en el dict por partido (`_pool`, `_invalid`).** Evita cambiar la firma de retorno de `calc_player_stats`
  (la usan `team_players`, `onoff_route`, `search_players`, `player_stats`). Riesgo: olvidar `strip_private` al serializar (un `set` rompe `jsonify`).
  Mitigación: única ruta que serializa un dict de `calc_player_stats` es `player_stats` (T-B4 lo verifica con `grep`).
- **D-6 · Muestras chicas (T-02).** `RO/min 4,00` de un jugador de 15 segundos es correcto pero engañoso; C-01 no impone mínimos.
- **Desviaciones respecto de la arquitectura:** código de razón nuevo (D-2); `Ø` diferido a C-02 (consistente con §9.2 I-12). **Dependencias técnicas:**
  `stats_engine.null_reasons`/`played`/`_safe_div` y `core/format.js` (`NULL_REASON_LABELS`, `nullDisplay`) de [C-11](../01-C-11-tratamiento-de-nulos/plan.md);
  `aggregate_games`/`POOLED_GROUPS`, `api.player(…, params)` y la población de liga de [C-02](../11-C-02-promedios-de-liga/plan.md);
  `GET /api/player/<int:player_id>` de [C-08](../07-C-08-jugadores-duplicados/plan.md). Consumidores: T-05 (claves `as_pos`, `orb_min`, `drb_min`, `or_pct`, `dr_pct`), A-12.

### 10.1 Procedimiento de verificación manual (jugador real contra el box score)
Dataset: los 13 partidos del seed en `backend/basketball.db` ("Liga de Ascenso 2026"); servidor `python backend/app.py` (modo abierto).
1. **Totales del box** (solo lectura) para M. Perdomo (OLI): `python` con `sqlite3` (modo `?mode=ro`) sumando, de `player_game_stats`, `ast`,
   `tov`, `pts`, `orb`, `drb`, `minutes` y la posesión con `stats_engine.possessions(fga2, fga3, fta, orb, tov)` por partido; de
   `team_game_stats` el `orb`/`drb` propio y del rival; de `games.minutes` la duración (`40` y `45`). Script de referencia:
   ```
   python - <<'EOF'
   import sqlite3, sys; sys.path.insert(0, "backend")
   from stats_engine import possessions, _parse_minutes
   c = sqlite3.connect("file:backend/basketball.db?mode=ro", uri=True)
   def hand(team, name):
       S = dict(ast=0, tov=0, pts=0, pos=0.0, orb=0, drb=0, mp=0.0, orn=0, ord=0.0, drn=0, drd=0.0)
       for gid, mn, pts, f2, f3, fta, orb, drb, ast, tov in c.execute("select game_id, minutes, pts, fga2, fga3, fta, orb, drb, ast, tov from player_game_stats where team_code=? and player_name=? order by game_id", (team, name)):
           mp = _parse_minutes(mn)
           if mp <= 0: continue
           L, = c.execute("select minutes from games where game_id=?", (gid,)).fetchone()
           t = c.execute("select orb, drb from team_game_stats where game_id=? and team_code=?", (gid, team)).fetchone()
           o = c.execute("select orb, drb from team_game_stats where game_id=? and team_code<>?", (gid, team)).fetchone()
           S["ast"] += ast; S["tov"] += tov; S["pts"] += pts; S["orb"] += orb; S["drb"] += drb; S["mp"] += mp
           S["pos"] += possessions(f2, f3, fta, orb, tov)
           S["orn"] += orb * L; S["ord"] += mp * (t[0] + o[1]); S["drn"] += drb * L; S["drd"] += mp * (t[1] + o[0])
       d = lambda a, b: round(a / b, 4) if b > 0 else None
       print(name, "POS=%.2f MIN=%.4f" % (S["pos"], S["mp"]), "AS/pos", d(S["ast"], S["pos"]), "PER/pos", d(S["tov"], S["pos"]),
             "PTS/pos", d(S["pts"], S["pos"]), "RO/min", d(S["orb"], S["mp"]), "RD/min", d(S["drb"], S["mp"]),
             "OR%", d(S["orn"], S["ord"]), "DR%", d(S["drn"], S["drd"]))
   hand("OLI", "M. Perdomo"); hand("TAB", "G. Viera"); hand("STO", "N. Cerminatti"); hand("TRO", "J. Lucchini"); hand("UPA", "I. Rocha")
   EOF
   ```
   Salida esperada (probada sobre la base local): Perdomo `POS=29.52 MIN=60.8833 AS/pos 0.4743 PER/pos 0.2371 PTS/pos 0.8469 RO/min 0.0328 RD/min 0.0164 OR% 0.0326 DR% 0.0158`;
   Viera `POS=6.88 … AS/pos 0.1453 PER/pos 0.0 PTS/pos 1.0174 RO/min 0.0403 OR% 0.0423`; Cerminatti `AS/pos None … RO/min 0.0`; Lucchini `OR% 5.1613` (>100 %); Rocha `DR% 1.4311`.
2. **API.** `curl -s "http://localhost:5000/api/player/OLI/M.%20Perdomo"` → `averages` igual al paso 1 (a 4 decimales); `curl -s "http://localhost:5000/api/player/TAB/G.%20Viera"` → `game_log[0].as_pos == null`, `averages.oer == 1.0174`;
   `curl -s "http://localhost:5000/api/player/TRO/J.%20Lucchini"` → `averages.or_pct == null` y `null_reasons.or_pct == "estimacion_invalida"`.
3. **Pantalla.** Jugador → M. Perdomo: `AS/pos 0,47`, `PER/pos 0,24`, `PTS/pos 0,85`, `RO/min 0,03`, `RD/min 0,02`, `OR% 3,3%`, `DR% 1,6%`; pasar el cursor por cada etiqueta y leer la definición.
4. **Antes/después** (registrar en progress): `git stash`/checkout del código anterior o la salida previa de `/api/player/…` → `AS/pos 0.5665`, `OER 0.8762` (Perdomo); `AS/pos −4.1666`, `OER −7.9762` (Viera); `or_pct 0.0333` (Perdomo, media de tasas).

## Estimación: M · 4–6 h
Backend 2–3 h (fórmulas, `sum_pool`, razones, dos rutas) · frontend 0,5–1 h · verificación y docs 1,5–2 h. Mayor que la estimación de la arquitectura (S 2–3 h) porque el diagnóstico encontró defectos de coherencia (posesión ≤ 0, % > 100 %, media de tasas) que no estaban en la hipótesis de partida.
