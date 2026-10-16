# Plan — T-04: Base de normalización

> **ID:** T-04 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 03
> **Depende de:** [T-05](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md) · [T-03](../02-T-03-selector-global-contexto/plan.md)
> **Habilita:** F-14, F-18
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Arquitectura §2.1, §3.5, §3.8, §3.3, §7.3, §9.2 (I-08)
> **Estimación:** M · 6–9 h

## 1. Enfoque

T-04 es casi enteramente el `apply_base` que la arquitectura ya reserva en `stats_engine.py` (§3.5, dueño T-05, pero
la **fórmula** de escalado —qué significa cada una de las 4 bases— la fija T-04 por ser su requisito dueño según la
especificación del cliente y el mapa del orquestador). En la práctica: `compute_standard(bundle)` (T-05) calcula los
valores en su unidad natural (equivalente a "totales" para conteos, "fixed" para tasas); `apply_base(values, bundle,
base)` (T-04, función nueva sobre la firma que T-05 ya declaró) transforma ese diccionario según `base_mode` y
`per100_den` del catálogo (`metrics_catalog.METRICS`), usando `bundle.games`, `bundle.seconds`/`minutes`/
`team_minutes` y `bundle.possessions_counted`/posesiones ya presentes en `StatBundle`. No hay tabla ni columna nueva:
todo el trabajo de backend es una función pura sobre datos que T-05 ya entrega. El trabajo de frontend es un
componente `base-selector.js` + persistencia en `sessionStorage`/URL vía `core/context.js` (T-03, que ya versiona el
query string) y su integración en las vistas que ya usan T-05.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` (T-05, extendido por T-04) | module | `apply_base(values: dict, bundle: StatBundle, base: str) -> dict` (implementación completa; T-05 solo dejó la firma) | RF-2, RF-3, RF-4, RF-5, RF-6, RF-9, RF-10 |
| `backend/metrics_catalog.py` (T-05, consumido) | module | ninguna función nueva; T-04 verifica que cada `MetricDef` traiga `base_mode` y `per100_den` correctos (tabla §3.5 de la arquitectura) | RF-2 |
| `backend/context.py` (T-03, extendido) | module | `parse_context`/`Context` ya no tocan `base` (T-03 lo deja fuera de `Context`, arquitectura §3.8: `base` es un parámetro aparte, no del contexto); T-04 agrega `parse_base(args) -> str` (valida `total\|partido\|por40\|por100`, default `config.get("ui.default_base")`) | RF-8 |
| `backend/app.py` | route | cada handler que devuelve conjunto estándar (`GET /api/metrics/<entity_type>`, `GET /api/team/<team_code>`, `GET /api/player/<team_code>/<player_name>`, `GET /api/player/<int:player_id>`) lee `base = parse_base(request.args)` y lo pasa a `standard_payload` | RF-1, RF-11 |
| `backend/tables.py` (T-06, consumido, solo verificación) | module | confirmar que `build_table` acepta y propaga `base` a cada `StatBundle`/`apply_base` de sus filas | RF-11 (nota: implementación completa es de T-06; T-04 solo fija la fórmula que T-06 debe invocar) |
| `frontend/js/core/context.js` (T-03, consumido) | js-core | `getContext()`/`setContext()` ya versionan el query string; T-04 no lo modifica, usa `contextToQuery`/`contextFromQuery` para incluir `base` | RF-7, RF-8 |
| `frontend/js/components/base-selector.js` | js-component **NUEVO** | `renderBaseSelector(el, {value, onChange})` | RF-1, RF-12 |
| `frontend/js/api.js` | js-api | métodos que llaman a T-05 agregan `base` a `qs(...)` cuando está definido | RF-5 |
| `frontend/js/views/equipo.js` · `jugador.js` (X-01) | js-view | montar `base-selector` junto a la barra de contexto (T-03); leer/escribir `sessionStorage` clave `ui.base` con try/catch | RF-1, RF-7, RF-8 |
| `frontend/css/style.css` | css | sección `/* ── base-selector (T-04) ── */` (pills o select, alineado con `context-bar`) | RF-1 |
| `frontend/sw.js` | sw | agregar `base-selector.js` si no cubre runtime caching todavía | §9 |
| `docs/metrics.md` | doc | sección nueva "Base de normalización" con las 4 fórmulas y la tabla `base_mode`/`per100_den` | cierre |
| `docs/api.md` | doc | parámetro `base` en los endpoints tocados; campo `base` en la respuesta | cierre |
| `docs/frontend.md` | doc | `components/base-selector.js`, persistencia por sesión, copy nuevo | cierre |

**Matriz RF → archivo:** RF-1 → `base-selector.js`, vistas; RF-2 → `stats_engine.apply_base`; RF-3 → `apply_base`
(segundos de la entidad, usa `StatBundle.seconds`/`minutes`/`team_minutes`); RF-4 → `apply_base` (posesiones del
denominador, usa `StatBundle.possessions_counted`/`on_court`); RF-5 → `apply_base` (backend-only) + `api.js` (sin
recálculo cliente); RF-6 → `apply_base` (orden de operaciones, verificado en CA-2); RF-7 → `core/context.js`
(reusado) + `sessionStorage` en las vistas; RF-8 → `context.parse_base`, `app.py`; RF-9 → `apply_base` (denominador
0 → `null` `sin_datos`); RF-10 → `apply_base` (propaga `estimated` desde `StatBundle.on_court.estimated`); RF-11 →
`app.py` (solo en handlers que ya devuelven T-05); RF-12 → `base-selector.js` (`t()`).

## 3. Backend — rutas y modelos

Sin cambios de esquema (Arquitectura §5, confirmado: T-04 no aparece en la tabla de cambios de esquema). Sin tabla ni
columna nueva. Parámetro de query nuevo en los endpoints que ya exponen el conjunto estándar de T-05:

| Endpoint | Parámetro | Valores | Default | Error |
|---|---|---|---|---|
| `GET /api/metrics/<entity_type>` | `base` | `total`\|`partido`\|`por40`\|`por100` | `config.get("ui.default_base")` (F-13, default de fábrica `partido`) | 400 `parametro_invalido` si el valor no es uno de los 4 |
| `GET /api/team/<team_code>` | `base` | ídem | ídem | ídem |
| `GET /api/player/<team_code>/<player_name>` · `GET /api/player/<int:player_id>` | `base` | ídem | ídem | ídem |
| `GET /api/table/<table_id>` (T-06, dueño T-06) | `base` | ídem | ídem | T-06 lo valida en su propio handler; T-04 solo fija la fórmula que invoca |

Respuesta: el shape del conjunto estándar (arquitectura §7.3) ya reserva el campo `"base": "partido"` a nivel raíz
del payload — T-04 lo llena con el valor efectivamente aplicado (nunca lo que pidió el cliente si fuese inválido,
porque eso ya cortó en 400 antes de llegar a `apply_base`).

## 4. Backend — lógica

### `apply_base(values: dict, bundle: StatBundle, base: str) -> dict`
Módulo: `backend/stats_engine.py`. Entrada: `values` = salida de `compute_standard(bundle)` (`{key: {"value": v|None,
"reason": str|None, ...}}`, en unidad **total** — conteos ya sumados, tasas ya calculadas pooled); `bundle`:
`StatBundle` con `games`, `minutes`, `team_minutes`, `seconds`, `on_court`, `possessions_counted`. Fórmula exacta
(idéntica para todas las entidades, arquitectura §3.8):

```
def apply_base(values, bundle, base):
    if base == "total":
        return values   # ya está en total; nada que escalar

    out = {}
    for key, obj in values.items():
        meta = metrics_catalog.METRICS[key]
        if obj["value"] is None:
            out[key] = obj                          # nulo se mantiene nulo, cualquier base (C-11)
            continue
        if meta.base_mode == "fixed":
            out[key] = obj                           # tasas/porcentajes: no se escalan (RF-2)
            continue
        if meta.base_mode == "volume":
            # minutes, possessions: en total/partido se escalan como count; en por40/por100 quedan en TOTAL
            if base == "partido":
                out[key] = _scale(obj, 1 / bundle.games) if bundle.games else _null(key, "sin_datos")
            else:
                out[key] = obj                        # por40/por100: se muestran en total (RF-2)
            continue
        # meta.base_mode == "count"
        if base == "partido":
            factor = 1 / bundle.games if bundle.games else None
        elif base == "por40":
            segundos = _segundos_entidad(bundle)       # RF-3
            factor = 2400 / segundos if segundos else None
        elif base == "por100":
            den = _posesiones_denominador(bundle, meta.per100_den)   # RF-4
            factor = 100 / den if den else None
        if factor is None:
            out[key] = _null(key, "sin_datos")          # RF-9: denominador 0 → null, nunca división por cero
        else:
            out[key] = _scale(obj, factor)
    return out
```
- `_scale(obj, factor)`: `{"value": round(obj["value"] * factor, decimales_de(meta.fmt)), "reason": None, **resto de
  obj sin "value"/"reason"}` — conserva `sample`, `adj`, etc. si estuvieran presentes (T-01/T-02 los agregan después,
  fuera de `apply_base`).
- `_segundos_entidad(bundle)` (RF-3): equipo → `bundle.seconds` (= Σ `games.minutes` de la selección × 60, con
  minutos reales de F-11: `40 + 5×prórrogas` por partido); jugador → `bundle.minutes × 60` (Σ `player_game_stats.
  minutes` parseados); quinteto/ON-OFF/split → `bundle.seconds` (segundos en cancha de `lineups.build_segments`,
  igual que la unidad de muestra de T-02).
- `_posesiones_denominador(bundle, per100_den)` (RF-4): `per100_den == "own"` → `bundle.possessions_counted` si
  existe (A-01) o, mientras tanto, `bundle.own["possessions"]` calculado por la fórmula del glosario sobre
  `bundle.own` (equipo/quinteto/split) o `bundle.on_court["own_possessions"]` (jugador: posesiones del equipo con
  él en cancha, exactas por pbp o `estimated: true` si se estiman por fracción de minutos, arquitectura §2.1);
  `per100_den == "opp"` → el mismo cálculo sobre `bundle.opp`.
- `_null(key, reason)`: `{"value": None, "reason": reason}` (RF-9).
- Propagación de `estimated` (RF-10): si `bundle.on_court` trae `estimated: True` y la clave usó ese denominador,
  `_scale` agrega `"estimated": true` al objeto de salida.
- **Casos borde**: `bundle.games == 0` (entidad sin partidos en la selección) → todas las claves `count`/`volume`
  en cualquier base ≠ total devuelven `null` `sin_datos` (coherente con RF-9 y con T-03 RF-18); métrica ya nula por
  su propia razón (`sin_intentos`, `sin_perdidas`, `no_aplica`, …) → se preserva esa razón, `apply_base` no la
  sobreescribe (rama `if obj["value"] is None`).
- **Caché**: `apply_base` es una función pura sin I/O; no se memoiza aparte (el costo está en construir `StatBundle`,
  ya cacheado aguas arriba por `repository`/`cache.memo`).

### `parse_base(args: Mapping[str, str]) -> str`
Módulo: `backend/context.py` (T-03, extendido) o `backend/config.py` si T-03 prefiere no tocar `context.py` por no
ser parte del contexto propiamente (arquitectura §3.8 dice explícitamente que `base` es una fila más de la tabla de
parámetros pero **no** integra el dataclass `Context`: viaja aparte). T-04 lo define en `context.py` junto a
`parse_context` por conveniencia de import único desde `app.py`, sin agregarlo a `Context`:
```
def parse_base(args) -> str:
    raw = args.get("base") or config.get("ui.default_base")
    if raw not in ("total", "partido", "por40", "por100"):
        raise ContextError(f"Valor inválido para 'base': '{raw}'.", code="parametro_invalido")
    return raw
```

## 5. Frontend — capa API (api.js)
- Ningún método nuevo: los métodos existentes de T-05 (`api.metrics`, `api.team`, `api.player`) agregan `base` al
  objeto de parámetros que ya arman con `qs()`, cuando `base` está definido en el estado de la vista.

## 6. Frontend — UI

**Ubicación:** junto a la barra de contexto de T-03 (misma franja o inmediatamente debajo), en toda vista que consuma
el conjunto estándar de T-05: en fase 2, S3 Equipo (pestañas ya migradas) y S4 Jugador. **Componentes reutilizados**
(arquitectura §8): `core/context.js` (T-03, para reflejar `base` en la URL igual que los demás parámetros de
contexto — aunque `base` no es parte de `Context`, se persiste con el mismo mecanismo de query string),
`core/i18n.js` (`t()`), `core/format.js` (`fmtNumber` para los valores ya escalados que llegan del backend).

**`components/base-selector.js`** — `renderBaseSelector(el, {value, onChange})` (PROPUESTA de nombre de archivo, ya
listado en arquitectura §8 con esta firma exacta: no es una propuesta real, es NUEVO conforme al catálogo):
- 4 pills/botones: "Totales", "Por partido", "Por 40'", "Por 100 pos."; el activo resaltado (`aria-pressed`).
- Al tocar uno: `onChange(nuevaBase)` → la vista actualiza `sessionStorage.setItem('ui.base', nuevaBase)` (con
  try/catch, nunca rompe si `sessionStorage` no está disponible) y `setContext`-like update de la URL (`?base=...`),
  y vuelve a pedir los bloques con la nueva base.
- **Prioridad de resolución** (RF-8): `base` de la URL > `sessionStorage['ui.base']` > `ui.default_base` (config,
  vía `/api/settings` ya cargado por la vista o un valor por defecto local `"partido"` mientras carga).

**Estados:** los de spec §6 (deshabilitado durante carga, error al cambiar, indicador "estimado").

**Mobile 768 px:** el selector entra en la misma fila que la barra de contexto o pasa a una fila propia sin scroll
horizontal de página (4 pills caben en 320 px con texto abreviado "Por 40'"/"Por 100 pos.").

## 7. Navegación
No agrega secciones ni pestañas. `base` viaja en el query string de la ruta hash activa, igual que los parámetros de
T-03 (arquitectura §3.12), y `core/router.js` (X-01) ya conserva el query al cambiar de pestaña.

## 8. Contratos de datos
- Campo `"base"` a nivel raíz del payload del conjunto estándar (§7.3 de la arquitectura), valor efectivo aplicado.
- Objeto de métrica bajo una base ≠ total: mismo shape que sin base (`{"value", "reason", ...}`), con `"estimated":
  true` agregado cuando corresponde (RF-10); nunca se agrega ni se quita ninguna otra clave del objeto.

## 9. Manejo de errores y offline
| Código | Mensaje |
|---|---|
| 400 `parametro_invalido` | "Valor inválido para 'base': '<valor>'." |
| red/offline | selector deshabilitado, aviso "Sin conexión: no se puede cambiar la base"; los bloques quedan con la última base cargada |
- `sw.js`: agregar `base-selector.js` a `STATIC[]` y subir `CACHE` si X-01 todavía no migró a runtime caching en el
  momento de integrar T-04.

## 10. Riesgos / decisiones
- **Sin desviación de la arquitectura.** `apply_base` implementa exactamente la fórmula de §3.8 ("Base T-04") sin
  agregar ni quitar reglas.
- **PROPUESTA (aclaración, no hueco):** la arquitectura no dice explícitamente si `parse_base` vive en `context.py` o
  en un módulo propio de T-04; se eligió `context.py` porque `app.py` ya importa ese módulo para cada handler "Ctx"
  y separar un archivo de una función no se justifica (regla 3: rutas finas, lógica en módulo dedicado — no exige
  un módulo por requisito). Si el humano prefiere un `backend/normalization.py` dedicado, es un cambio de una línea
  de import. Reportado igual en huecos por transparencia (no es un contrato que la arquitectura fije con nombre de
  archivo).
- **Riesgo de redondeo (CA-2):** para que `total == por_partido × games` valga con la tolerancia de presentación,
  `apply_base` divide el total **crudo** (no redondeado) entre `games` y solo redondea al formatear; se verifica en
  tasks con un caso concreto (equipo de 4 partidos).
- **Dependencias técnicas:** `StatBundle`, `compute_standard`, `metrics_catalog.METRICS` (`base_mode`, `per100_den`)
  (T-05, [../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md), si su plan aún no existe se referencia por la ruta fija del mapa);
  `context.parse_context`, patrón de `ContextError` (T-03, [../02-T-03-selector-global-contexto/plan.md](../02-T-03-selector-global-contexto/plan.md));
  `config.get("ui.default_base")` (F-13, [../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md));
  `lineups.build_segments` (segundos en cancha, ya existe); `core/router.js` (X-01, [../01-X-01-reorganizacion-navegacion/plan.md](../01-X-01-reorganizacion-navegacion/plan.md)).
- **Incremento diferido:** Quintetos/ON-OFF (F-06), Cierres (C-06/F-04) y splits de posesión (A-01…A-05) adoptan el
  selector automáticamente en cuanto migren a T-05/T-03 — sin trabajo adicional de T-04, documentado como grupo de
  tareas final "(diferido)" a modo de recordatorio de verificación cruzada, no de implementación.
- **Estimación:** M · 6–9 h (`apply_base` + `parse_base` + tests manuales 3–4 h, `base-selector.js` + integración en
  2 vistas 2–3 h, docs y verificación 1–2 h).
