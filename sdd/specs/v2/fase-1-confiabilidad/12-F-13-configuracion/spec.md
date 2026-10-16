# Spec — F-13: Configuración

> **ID:** F-13 · **Prioridad:** P1 · **Fase y orden:** 1·12
> **Depende de:** C-06 ([../05-C-06-umbral-cierres/](../05-C-06-umbral-cierres/spec.md)), C-11 ([../01-C-11-tratamiento-de-nulos/](../01-C-11-tratamiento-de-nulos/spec.md)), F-11 ([../02-F-11-calidad-datos-competencias/](../02-F-11-calidad-datos-competencias/spec.md)) · **Habilita:** T-02, T-04, T-06, F-06, F-17, A-03, A-05, F-02, F-14, F-12, F-21
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** [Especificación v2](../../00-especificacion-cliente-v2.md) §1.3 (S9 · Configuración) y §4 · F-13 · Arquitectura [§3.2, §3.3, §3.12, §3.14, §3.21, §5, §6](../../00-arquitectura-transversal.md)

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §4 F-13):**
- "Umbrales de muestra y constante de regresión de T-02."
- "Cortes de tramo de reloj, criterio de transición y umbral de partido cerrado."
- "Umbrales de las reglas de Momentum."
- "Base de normalización y competencia por defecto, y etiquetas de métricas."
- "Ningún umbral debe quedar fijo en el código."
- **Criterio de aceptación:** "Cambiar un umbral en configuración se refleja inmediatamente en los cálculos de toda la app."

Y en §1.3 (S9): "Los criterios de cálculo deben ser visibles y editables, no estar escondidos en el código", con cuatro módulos: Umbrales de muestra (T-02, F-13), Reglas de contexto (A-03, A-05, C-06), Reglas de Momentum (F-02) y Preferencias (base de normalización, competencia por defecto, etiquetas de métricas e idioma — T-04, F-13, F-21). T-02 agrega: "Todos los valores son configurables desde F-13 y ninguno debe quedar fijo en el código".

**Qué existe hoy (verificado en código, rama `dev` = base de v2 por DA-01):**
- No existe ninguna configuración editable: no hay tabla, módulo ni endpoint de configuración (`backend/database.py` solo define `Game`, `TeamGameStats`, `PlayerGameStats`, `Shot`, `PbpEvent`; `docs/api.md` no lista nada parecido).
- Umbrales fijos en el código (inventario verificado):
  | Umbral | Dónde está hoy | Valor | Quién lo retira |
  |---|---|---|---|
  | Diferencia de partido cerrado | `backend/app.py:clutch_team` (`margin = 10` si falta el query) y `backend/clutch.py:team_clutch(..., margin=10)` | 10 | **F-13** (clave `clutch.margin`) |
  | Ventana de cierre | `backend/clutch.py:CLUTCH_SECS = 300` (usado por `_is_clutch` y `_entry_margin`) | 300 s | **F-13** (clave `clutch.window_secs`) |
  | Puntos de la tabla general | `backend/app.py:league_overview` (`"table_points": 2 * wins + losses`) | 2 / 1 | **F-13** (claves `standings.*`, DA-31) |
  | Umbral mostrado en la leyenda de Cierres mientras carga | `frontend/js/app.js:renderTeamClutch` (`const CLUTCH_MARGIN_DEFAULT = 10`) | 10 | **F-13** |
  | "Muestra chica" de Combinación | `frontend/js/app.js:renderTeamLineup` (`r.sample.possessions < 10`) | 10 pos | T-02 (badge con `sample.lineup.*`) |
  | Colores del mapa de tiro | `frontend/js/app.js` (`_scBoxFill`, umbrales 1,00/0,85) | — | C-03 (percentil, DA-35) |
- Autorización: `backend/auth.py` tiene `login_required` sin roles. `auth.admin_required` e `is_admin` los crea F-11 (pieza adelantada I-14 de la arquitectura).
- Caché: no existe. `app_meta` (`data_version`, `config_version`) y `backend/cache.py` los crea F-11 (arquitectura §3.14).
- Navegación: `frontend/js/app.js` tiene `sections = ["import","league","team","compare","player","search"]` y `setSection(id)`; el header (`<header>` en el layout de `app.js`) muestra logo, subtítulo y "Salir". No hay routing por hash ni sección de configuración.

**Qué resolvieron features anteriores:** Feature 18 de `dev` (C-06) bajó el umbral a 10 e hizo que la leyenda de Cierres se lea de `margin` en la respuesta (solo el estado de carga sigue con el literal). Feature 17 de `dev` (C-09) agregó la tabla general con 2/1 fijos. Ninguna feature previa trató configuración.

**Qué queda (alcance de F-13):** crear el almacenamiento y el catálogo único de claves de configuración (arquitectura §3.2), la API de lectura/escritura con validación y permisos, la invalidación inmediata de cálculos al cambiar un valor, la pantalla de Configuración (en fase 1 detrás de un engranaje en el header; X-01 la reubica como S9), las preferencias por usuario (arquitectura §3.3) y migrar a configuración los umbrales de C-06 y C-09. Los umbrales cuyos consumidores se construyen después (T-02, T-01, T-04, A-03, A-05, F-02, F-14, etc.) quedan **declarados con su nombre y default definitivos** y se activan cuando su requisito los empieza a leer.

## 1. Objetivo
Hacer visibles y editables desde la app todos los criterios de cálculo (umbrales, cortes, reglas y preferencias), con un catálogo único en el backend y efecto inmediato en todos los cálculos, sin ningún umbral fijo en el código.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4 · F-13 (requisito y CA, literal arriba); §1.3 S9 (módulos de la sección); §3 · T-02 (umbrales, K, "configurables desde F-13"); §4 · C-06 (umbral de partido cerrado); §2 · C-09 (2 puntos por ganado, 1 por perdido); §4 · F-02 (reglas de Momentum); §4 · F-21 (idioma).
- Arquitectura §3.2 (tabla `app_config`, `backend/config.py`, `CONFIG_SPEC`, catálogo completo de claves, invalidación, permisos), §3.3 (`user_prefs`, `prefs.py`, scopes fijados), §3.12 (S9 y engranaje de fase 1), §3.14 (`app_meta.config_version`, `cache.py`), §3.21 (`admin_required`, `ADMIN_USERS`), §5 (esquema), §6 (endpoints `/api/settings*`, `/api/prefs`), §7.8 (formato de error), §8 (`core/prefs.js`), DA-15, DA-16, DA-17, DA-18, DA-31.
- `docs/database.md` (esquema actual; no hay tablas de configuración), `docs/api.md` (no hay endpoints de configuración), `docs/frontend.md` §Vistas (secciones actuales), `docs/deployment.md` (variables de entorno: `AUTH_USERS`, `SECRET_KEY`).
- Constitución reglas 3 (lógica en módulo dedicado), 5 (tablas nuevas vía `create_all`, sin migraciones destructivas), 6 (sin tabla `users`), 7 (español, mobile-first), 8 (verificación manual), 9 (`fetch` solo en `api.js`).
- Specs de `dev`: `sdd/specs/18-etiquetas-y-umbrales/` (C-06: `margin` en la respuesta) y `sdd/specs/17-*` (C-09: tabla general).

## 3. Historias de usuario
- US-1: Como entrenador/analista, quiero ver con qué criterios calcula la app (umbrales de muestra, partido cerrado, cortes de reloj, reglas de Momentum), para entender y confiar en los números.
- US-2: Como administrador de la app, quiero cambiar un umbral y que todos los cálculos lo usen de inmediato, para adaptar la app al volumen real de cada competencia.
- US-3: Como administrador, quiero volver una o todas las claves a su valor por defecto, para deshacer ajustes sin recordar los valores originales.
- US-4: Como usuario sin permisos de administración, quiero ver la configuración vigente sin poder modificarla, para no cambiar por error criterios que afectan a todo el cuerpo técnico.
- US-5: Como usuario, quiero que la app recuerde mis preferencias personales (columnas de tablas, paneles plegados, idioma, equipo propio) entre sesiones y dispositivos, para no reconfigurar cada vez.
- US-6: Como entrenador, quiero fijar la competencia y la base de normalización por defecto y renombrar etiquetas de métricas, para que la app hable el idioma de mi cuerpo técnico.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE mantener un **catálogo único** de claves de configuración en el backend, donde cada clave tiene nombre, tipo, valor por defecto, rango o valores válidos, etiqueta en español, ayuda, sección de S9, requisito consumidor y estado (activa o reservada). · (US-1, US-2; Esp. v2 §F-13 "Ningún umbral debe quedar fijo en el código"; Arq. §3.2)
  - Reglas: el catálogo contiene exactamente las claves de la tabla de Arquitectura §3.2 con su nombre, tipo, default y rango literales (ver §5). Secciones: `umbrales` ("Umbrales de muestra"), `contexto` ("Reglas de contexto"), `momentum` ("Reglas de Momentum"), `preferencias` ("Preferencias").
- RF-2: El sistema DEBE persistir únicamente los valores modificados respecto del default; una clave sin valor guardado vale su default. · (US-2, US-3; Arq. §3.2)
- RF-3: El sistema DEBE exponer la configuración vigente (valores efectivos + catálogo) a todo usuario autenticado. · (US-1, US-4; Esp. v2 §1.3 S9 "visibles"; Arq. §6 `GET /api/settings`)
- RF-4: El sistema DEBE permitir guardar uno o varios valores en una sola operación, validando tipo, rango y coherencia entre claves; si un solo valor es inválido no se guarda ninguno y se informa cada error por clave. · (US-2; Arq. §3.2 `config.set_values`)
  - Reglas de coherencia: para cada entidad de muestra, `sample.<e>.min ≤ sample.<e>.high`; `clock.early_max < clock.mid_max`; `transition.max_secs < early_offense.max_secs`; `gameplan.items_min ≤ gameplan.items_max`; `insights.min_items ≤ insights.max_items`; `insights.low_pct < insights.high_pct`; `oreb.putback_secs < oreb.kickout_secs`.
- RF-5: El sistema DEBE permitir restablecer al default una lista de claves o todas las claves de una sección. · (US-3; Arq. §6 `POST /api/settings/reset`)
- RF-6: El sistema DEBE restringir la escritura y el restablecimiento de configuración a usuarios administradores (con autenticación habilitada: si `ADMIN_USERS` está definida, solo los usuarios listados; si no, todo usuario autenticado; en modo abierto local, todos). La lectura exige solo sesión. · (US-4; Arq. §3.21, DA-18)
- RF-7: El sistema DEBE hacer que **todo** cálculo que dependa de un umbral lo lea de la configuración vigente, y que un cambio guardado se aplique a partir de la siguiente petición en cualquier proceso del servidor, sin reiniciar la app. · (US-2; Esp. v2 §F-13 CA; Arq. §3.2 "Invalidación de cachés", §3.14)
- RF-8: El sistema DEBE migrar a configuración los umbrales hoy fijos de partido cerrado (diferencia y ventana de cierre, C-06) y de tabla general (puntos por ganado, puntos por perdido y desempate, C-09), manteniendo sus valores actuales como default (10 puntos, 300 s, 2, 1, `diferencia`). · (US-2; Esp. v2 §C-06, §C-09; Arq. §3.2, DA-31)
  - Regla C-06: un partido califica como cierre si la diferencia absoluta al inicio de la ventana es ≤ `clutch.margin`; la ventana abarca los últimos `clutch.window_secs` segundos del último período regular más todas las prórrogas.
  - Regla C-09: puntos de tabla = `standings.win_points × PG + standings.loss_points × PP`; con `standings.tiebreak = diferencia`, a igual puntaje ordena por (puntos a favor − puntos en contra) descendente; con `ninguno`, mantiene el orden por puntos y luego alfabético.
  - La leyenda de Cierres y la de la tabla general DEBEN mostrar los valores vigentes (nunca un literal del frontend).
  - El parámetro de consulta `margin` de Cierres se sigue aceptando como override puntual (compatibilidad); sin él, rige `clutch.margin`.
- RF-9: El sistema DEBE usar la competencia por defecto configurada (`ui.default_competition_id`) como cuarto criterio de resolución de la competencia de una petición (después del parámetro explícito y de la competencia más reciente de la entidad), y ofrecer como valores válidos solo competencias existentes o "automática" (nulo). · (US-6; Esp. v2 §F-13 "competencia por defecto"; Arq. §3.1, DA-14)
- RF-10: El sistema DEBE declarar desde ya, con su nombre y default definitivos, las claves cuyos consumidores se construyen en requisitos posteriores (estado "reservada"), sin mostrarlas como editables ni aceptarlas en escritura hasta que su requisito consumidor las active. · (US-1; Esp. v2 §F-13 "Cortes de tramo de reloj, criterio de transición… Umbrales de las reglas de Momentum"; Arq. §3.2)
  - Reglas: al cerrar F-13 quedan **activas** `clutch.margin`, `clutch.window_secs`, `standings.win_points`, `standings.loss_points`, `standings.tiebreak` y `ui.default_competition_id`. Todas las demás quedan reservadas con su consumidor indicado (ej. `sample.*`/`regression.*` → T-02; `population.min_size` → T-01; `ui.metric_labels` → T-05; `ui.default_base` → T-05/T-04; `clock.*` → A-05; `transition.max_secs`, `early_offense.max_secs` → A-03; `momentum.*` → F-02; `leaders.*` → F-14; `ui.default_language` → F-21).
- RF-11: El sistema DEBE ofrecer una pantalla de Configuración con los cuatro módulos de S9 (Umbrales de muestra · Reglas de contexto · Reglas de Momentum · Preferencias), que muestre cada clave activa con su etiqueta, valor vigente, default, unidad/rango y ayuda, y marque las que difieren del default. · (US-1, US-2, US-6; Esp. v2 §1.3 S9; Arq. §3.12)
  - Fase 1: se accede desde un botón de engranaje en el header, sin ocupar lugar en la barra inferior móvil. X-01 la reubica como sección S9 (`#/configuracion/<modulo>`) sin cambiar su contenido.
  - Un módulo sin claves activas muestra el mensaje de vacío (ver §6) con la lista de reglas que se habilitarán y su requisito.
- RF-12: El sistema DEBE, tras guardar o restablecer, confirmar la operación, mostrar los valores efectivos devueltos por el servidor y hacer que la vista que el usuario abra a continuación ya use los valores nuevos. · (US-2; Esp. v2 §F-13 CA)
- RF-13: El sistema DEBE mostrar la pantalla en modo solo lectura a usuarios no administradores, con la indicación de que solo un administrador puede modificarla. · (US-4; Arq. §3.21)
- RF-14: El sistema DEBE guardar preferencias personales por usuario de sesión (o por un dueño común en modo abierto), por ámbito y clave, con lectura, escritura y borrado solo de las propias, y aceptar únicamente los ámbitos fijados por la arquitectura (`table.columns`, `table.sort`, `table.colorize`, `panel.collapsed`, `ui`). No guarda credenciales ni define usuarios. · (US-5; Arq. §3.3, DA-17; Constitución 6)
- RF-15: El frontend DEBE ofrecer una utilidad única de preferencias con copia local para arranque rápido y degradación segura si el almacenamiento local no está disponible, que usarán T-06, F-17, F-12, F-21 y T-03. · (US-5; Arq. §8 `core/prefs.js`)
- RF-16: El sistema DEBE registrar quién y cuándo modificó por última vez cada clave, y mostrarlo en la pantalla. · (US-2; Arq. §5 `app_config.updated_at`, `updated_by`)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `app_config` | tabla | `key` TEXT PK, `value` TEXT (JSON), `updated_at` TEXT, `updated_by` TEXT; solo claves modificadas | **NUEVO** (create_all) — Arq. §5 |
| `user_prefs` | tabla | `owner` TEXT, `scope` TEXT, `key` TEXT, `value` TEXT (JSON), `updated_at` TEXT; PK `(owner, scope, key)` | **NUEVO** (create_all) — Arq. §5; no es tabla de usuarios |
| `app_meta.config_version` | fila de tabla existente tras F-11 | entero; sube en cada guardado/restablecimiento | tabla creada por F-11 |
| `GET /api/settings` | endpoint | `{version, values: {clave: valor}, spec: [{key, type, default, min, max, choices, label, section, help, unit, status, consumer, updated_at, updated_by}], is_admin}` | **NUEVO** — Arq. §6 |
| `PUT /api/settings` **(admin)** | endpoint | body `{values: {clave: valor}}` → igual a GET. 400 `parametro_invalido` con `details: {clave: mensaje}`; 400 `clave_no_disponible` si la clave es reservada o desconocida; 403 `requiere_admin` | **NUEVO** — Arq. §6 |
| `POST /api/settings/reset` **(admin)** | endpoint | body `{keys: [...]}` o `{section: "<slug>"}` → igual a GET | **NUEVO** — Arq. §6 (`section` es PROPUESTA) |
| `GET /api/prefs?scope=<scope>` | endpoint | `{scope, values: {key: value}}` | **NUEVO** — Arq. §6 |
| `PUT /api/prefs` | endpoint | body `{scope, key, value}` → `{scope, key, value}` | **NUEVO** — Arq. §6 |
| `DELETE /api/prefs` | endpoint | body `{scope, key}` → `{scope, key, deleted: true}` | **NUEVO** — Arq. §6 |
| `GET /api/clutch/<team_code>` | endpoint existente (dueño C-06) | sin cambio de shape; `margin` y ventana por defecto leídos de configuración | modificado (Arq. §6 fila C-06) |
| `GET /api/league` | endpoint existente | `table_points` y orden según `standings.*` | modificado |

**Catálogo de claves (literal de Arquitectura §3.2; estado al cerrar F-13):**
| Clave | Tipo | Default | Rango | Sección | Consumidor | Estado en F-13 |
|---|---|---|---|---|---|---|
| `clutch.margin` | int (pts) | 10 | 0–40 | contexto | C-06, F-06, A-06 | **activa** |
| `clutch.window_secs` | int (s) | 300 | 60–600 | contexto | C-06, F-04, F-06 | **activa** |
| `standings.win_points` / `standings.loss_points` | int | 2 / 1 | 0–5 | preferencias | C-09 | **activa** |
| `standings.tiebreak` | enum `diferencia`\|`ninguno` | `diferencia` | | preferencias | C-09 | **activa** |
| `ui.default_competition_id` | int o null | null (automática) | competencias existentes | preferencias | F-11, T-03 | **activa** |
| `sample.lineup.min` / `.high` / `.rel_pct` | int / int / float·null | 15 / 40 / 1.5 | 1–500 / 1–2000 / 0–20 | umbrales | T-02 | reservada (→ T-02) |
| `sample.pair.*` | int/int/float·null | 30 / 80 / null | | umbrales | T-02, A-08 | reservada (→ T-02) |
| `sample.onoff.*` | int | 40 / 120 / null | | umbrales | T-02, F-06 | reservada (→ T-02) |
| `sample.matchup.*` | int | 8 / 25 / null | | umbrales | T-02, F-07 | reservada (→ T-02) |
| `sample.split.*` | int | 15 / 40 / null | | umbrales | T-02, T-03 | reservada (→ T-02) |
| `sample.clock_zone.min` / `.high` | int (intentos) | 10 / 30 | | umbrales | T-02, C-03 | reservada (→ T-02) |
| `sample.clutch_lineup.min_poss` / `.high_games` | int | 2 / 3 | 1–20 | umbrales | F-06 | reservada (→ T-02) |
| `sample.player.min` / `.high` | int (min) | 60 / 200 | | umbrales | T-01, T-02 | reservada (→ T-02) |
| `sample.team.min` / `.high` | int (partidos) | 3 / 10 | | umbrales | T-01, T-02 | reservada (→ T-02) |
| `sample.relative_enabled` | bool | true | | umbrales | T-02 | reservada (→ T-02) |
| `regression.lineup.k` · `.onoff.k` · `.split.k` · `.pair.k` · `.matchup.k` · `.clutch_lineup.k` | int | 25 · 50 · 20 · 25 · 25 · 25 | 0–500 | umbrales | T-02 | reservada (→ T-02) |
| `sample.ppp_sd` / `sample.band_z` | float | 1.15 / 1.96 | 0.5–2 / 1–3 | umbrales | T-02 | reservada (→ T-02) |
| `population.min_size` | int | 3 | 2–20 | umbrales | T-01 | reservada (→ T-01) |
| `ui.default_base` | enum `total`\|`partido`\|`por40`\|`por100` | `partido` | | preferencias | T-05, T-04 | reservada (→ T-05) |
| `ui.metric_labels` | json `{clave: etiqueta}` | `{}` | | preferencias | T-05 | reservada (→ T-05) |
| `table.page_size` · `export.csv_separator` | int · enum | 50 · `;` | 10–500 | preferencias | T-06 | reservada (→ T-06) |
| `context.close_margin` | int (pts) | 10 | 1–40 | contexto | T-03 | reservada (→ T-03) |
| `transition.max_secs` · `early_offense.max_secs` | int (s) | 7 · 12 | 3–12 · 8–20 | contexto | A-03 | reservada (→ A-03) |
| `oreb.putback_secs` · `oreb.kickout_secs` | int (s) | 3 · 6 | 1–6 · 2–10 | contexto | A-04 | reservada (→ A-04) |
| `clock.early_max` · `clock.mid_max` | int (s) | 8 · 16 | 4–12 · 10–20 | contexto | A-05 | reservada (→ A-05) |
| `clock.reset_secs` | int (s) | 14 | 10–24 | contexto | A-01, A-05 | reservada (→ A-01) |
| `momentum.*` (9 claves) | int | 10 / 300 / 5 / 3 / 8 / 180 / 4 / 3 / 3 | Arq. §3.2 | momentum | F-02 | reservada (→ F-02) |
| `live.poll_secs` · `live.cache_ttl_secs` · `live.fetch_timeout_secs` | int (s) | 30 · 15 · 8 | Arq. §3.2 | preferencias | F-01 | reservada (→ F-01) |
| `leaders.min_minutes` · `leaders.top_n` | int | 60 · 10 | 0–2000 · 3–50 | preferencias | F-14 | reservada (→ F-14) |
| `gameplan.items_min` / `items_max` / `min_z` | int/int/float | 3 / 5 / 0.5 | Arq. §3.2 | preferencias | F-17 | reservada (→ F-17) |
| `insights.*` (4 claves) | int | 10 / 90 / 3 / 5 | Arq. §3.2 | preferencias | A-10 | reservada (→ A-10) |
| `alerts.lookback_days` · `alerts.change_z` | int · float | 7 · 1.5 | Arq. §3.2 | preferencias | F-12 | reservada (→ F-12) |
| `trends.default_ma` · `trends.last_n` | enum · int | 5 · 5 | Arq. §3.2 | preferencias | F-18 | reservada (→ F-18) |
| `similar.top_n` | int | 10 | 3–50 | preferencias | A-09 | reservada (→ A-09) |
| `rapm.lambdas` · `rapm.folds` | json · int | `[500,1000,2000,4000,8000]` · 5 | · 2–10 | umbrales | A-11 | reservada (→ A-11) |
| `ai.suggestions_enabled` | bool | true | | preferencias | F-15 | reservada (→ F-15) |
| `ui.default_language` | enum `es`\|`en`\|`pt` | `es` | | preferencias | F-21 | reservada (→ F-21) |

Scopes de `user_prefs` aceptados (Arq. §3.3): `table.columns`, `table.sort`, `table.colorize`, `panel.collapsed`, `ui` (claves `language`, `home_team`, `followed_players`, `last_competition`).

## 6. Estados de UI
Pantalla de Configuración (fase 1: vista abierta desde el engranaje del header; desde X-01: S9 con módulos `umbrales`, `contexto`, `momentum`, `preferencias`). Todo el copy es **nuevo** (a agregar a `docs/frontend.md`), vía `t()`.

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Pantalla Configuración | spinner + "Cargando configuración…" | Módulo sin claves activas: "Todavía no hay reglas editables en este módulo. Se habilitan con: {lista de requisitos}." | "No se pudo cargar la configuración. Probá de nuevo." + botón "Reintentar" | `/api/*` siempre a red: "Sin conexión: la configuración no está disponible." | Lista de claves por módulo: etiqueta, control editable (número, selector o interruptor), unidad y rango ("entre 0 y 40 puntos"), "Por defecto: 10", marca "Modificado" si difiere, "Modificado por {usuario} el {fecha}" |
| Guardar | botón "Guardando…" deshabilitado | Sin cambios: botón "Guardar cambios" deshabilitado | 400: error debajo de cada campo con el mensaje del servidor ("Debe estar entre 0 y 40", "El mínimo no puede superar al de muestra alta"); 403: "Solo un administrador puede modificar la configuración." | "Sin conexión: no se guardaron los cambios." | Toast "Configuración guardada. Los cálculos ya usan los valores nuevos." |
| Restablecer | "Restableciendo…" | — | ídem Guardar | ídem | Confirmación previa "¿Volver {n} valor(es) a su valor por defecto?" → toast "Valores restablecidos." |
| Modo solo lectura (no admin) | — | — | — | — | Controles deshabilitados + aviso "Solo un administrador puede modificar la configuración." |
| Engranaje del header | — | — | — | — | Ícono con `aria-label` "Configuración"; visible para todo usuario autenticado |
| Leyenda de Cierres (Equipo) | "Cierres (últimos {n} min…)" sin número de diferencia hasta tener respuesta | (sin cambio respecto de C-06) | (sin cambio) | (sin cambio) | "Cierres (últimos {window/60} min, dif ≤ {margin})" con los valores de la respuesta |
| Tabla general (Liga) | (sin cambio) | (sin cambio) | (sin cambio) | (sin cambio) | Leyenda "{win_points} pts por ganado · {loss_points} por perdido · solo partidos importados" |

Mobile (<768 px): una columna, etiqueta arriba del control, botones "Guardar cambios" y "Restablecer" fijos al pie de la vista por encima de la barra inferior.

## 7. Criterios de aceptación
- CA-1 (CA del cliente): Given un administrador en la pantalla de Configuración, When cambia un umbral y guarda, Then el cambio **se refleja inmediatamente en los cálculos de toda la app**. Verificación en fase 1: cambiar `clutch.margin` de 10 a 5 → `GET /api/clutch/<equipo>` devuelve `margin: 5`, `games_qualified` recalculado (≤ que con 10) y la leyenda de Cierres dice "dif ≤ 5", sin reiniciar el servidor; cambiar `standings.win_points` a 3 → `GET /api/league` devuelve `table_points = 3·PG + 1·PP` para cada equipo y reordena la tabla.
- CA-2: Given la base sin ningún valor guardado, When se consulta `GET /api/settings`, Then `values` trae todas las claves activas con su default literal de Arquitectura §3.2 (`clutch.margin` = 10, `clutch.window_secs` = 300, `standings.win_points` = 2, `standings.loss_points` = 1, `standings.tiebreak` = "diferencia", `ui.default_competition_id` = null) y `spec` incluye también las reservadas con `status: "reservada"` y su consumidor.
- CA-3: Given un administrador, When envía `PUT /api/settings` con `{"clutch.margin": 50}` (fuera de rango), Then responde 400 con `code: "parametro_invalido"` y `details["clutch.margin"]`, y el valor vigente sigue siendo el anterior.
- CA-4: Given un administrador, When envía `PUT /api/settings` con un valor válido y otro inválido en la misma petición, Then no se guarda ninguno (operación atómica) y `config_version` no cambia.
- CA-5: Given `ADMIN_USERS=nico` y un usuario autenticado `ana`, When `ana` envía `PUT /api/settings` o `POST /api/settings/reset`, Then responde 403 `requiere_admin`; y `GET /api/settings` le responde 200 con `is_admin: false` y la pantalla se muestra en solo lectura.
- CA-6: Given un valor modificado, When un administrador lo restablece (`POST /api/settings/reset` con esa clave), Then la fila desaparece de `app_config`, `values` vuelve al default y los cálculos (CA-1) vuelven a los resultados originales.
- CA-7: Given una clave reservada (ej. `momentum.window_secs`), When se intenta escribirla, Then responde 400 `clave_no_disponible`; y la pantalla no la muestra como editable (el módulo Momentum muestra el mensaje de vacío que nombra a F-02).
- CA-8: Given dos procesos del servidor (o un proceso y una segunda petición tras el guardado), When se guarda un cambio, Then la siguiente petición de cualquier proceso usa el valor nuevo (`config_version` incrementado; verificable con dos `test_client` o con gunicorn `--workers 2`).
- CA-9: Given un inventario de umbrales fijos (§0), When se busca en `backend/` y `frontend/js/` el literal del margen de cierre (`margin=10`, `CLUTCH_MARGIN_DEFAULT`), la ventana (`CLUTCH_SECS`) y los puntos de tabla (`2 * wins + losses`), Then no quedan usos fuera de los defaults del catálogo de configuración.
- CA-10: Given un usuario autenticado, When guarda `PUT /api/prefs {scope: "panel.collapsed", key: "x", value: true}` y luego consulta `GET /api/prefs?scope=panel.collapsed`, Then recibe `{values: {"x": true}}`; otro usuario no la ve; y un scope no permitido responde 400 `parametro_invalido`.
- CA-11: Given `ui.default_competition_id` = id de una competencia existente, When se consulta un endpoint con contexto sin `competition` para una entidad sin competencia propia resoluble, Then se usa esa competencia (eco `context.competition.id`); un id inexistente en `PUT /api/settings` responde 400.
- CA-12: Given una pantalla de 360 px de ancho, When se abre Configuración desde el engranaje, Then se ve en una columna, sin scroll horizontal, con los botones al pie visibles sobre la barra inferior, y la barra inferior no ganó un botón nuevo.
- CA-13: Given un valor guardado, When se vuelve a abrir la pantalla, Then la clave muestra la marca "Modificado", el default y "Modificado por {usuario} el {fecha}".
- CA-14 (nulos, C-11): Given `ui.default_competition_id` en "automática", When se muestra la pantalla, Then el valor se muestra como "Automática (la más reciente)" y nunca como 0 o vacío.

## 8. Fuera de alcance
- Consumo de las claves reservadas: cada requisito consumidor las activa y las lee (INCREMENTO DIFERIDO (→ T-02, T-01, T-05, T-06, T-03, T-04, A-01, A-03, A-04, A-05, F-01, F-02, F-14, F-17, A-10, F-12, F-18, A-09, A-11, F-15, F-21)). En cada uno es un RF explícito: "activa sus claves de `CONFIG_SPEC` y las lee con `config.get`".
- Calibración de K ("Aplicar" desde la herramienta de calibración): INCREMENTO DIFERIDO (→ T-02, `POST /api/settings/calibrate`).
- Editor de etiquetas de métricas contra el catálogo de métricas: INCREMENTO DIFERIDO (→ T-05; F-13 deja la clave `ui.metric_labels` reservada y el control genérico de tipo json).
- Selector de idioma y su preferencia por usuario: INCREMENTO DIFERIDO (→ F-21).
- Reubicación como sección S9 con pestañas y ruta hash: INCREMENTO DIFERIDO (→ X-01).
- Uso de las preferencias por usuario (columnas de tablas, paneles plegados, equipo propio): lo hacen T-06, X-01/F-17, F-12, T-03; F-13 solo provee la infraestructura.
- Historial de cambios de configuración (más allá del último autor/fecha por clave), configuración por competencia y exportar/importar configuración.
- Roles o gestión de usuarios (prohibido por la Constitución 6).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **Claves de fases futuras.** La nota del orquestador pide definirlas ahora; la Arquitectura §3.2 asigna a cada requisito posterior "agregar sus claves". Se decide declararlas todas ahora con el nombre y default de §3.2, en estado **reservada** (no visibles ni escribibles), y que su requisito consumidor las **active**. Evita mostrar controles que no cambian nada (lo que violaría el CA) y deja el catálogo completo y único desde el día 1.
- [DECISIÓN PROPUESTA — confirmar] **Claves de T-02/T-01 activas en fase 1.** Aunque T-02 y T-01 son de fase 1, se activan cuando esos requisitos las leen (orden 14 y 15), no al cerrar F-13, por la misma razón.
- [DECISIÓN PROPUESTA — confirmar] **Override `margin` por query en Cierres.** Se conserva como override puntual (compatibilidad con `dev`), pero la UI deja de enviarlo; el default pasa a ser la configuración.
- [DECISIÓN PROPUESTA — confirmar] **Efecto "inmediato".** Se interpreta como "desde la siguiente petición de cualquier proceso, sin reiniciar"; la pantalla que el usuario tiene abierta se recarga al volver a ella (no hay empuje en vivo a otras sesiones abiertas).
- [DECISIÓN PROPUESTA — confirmar] **Restablecer por sección.** Además de por lista de claves (Arq. §6), se acepta `{section}` para "Restablecer módulo".
- [DECISIÓN PROPUESTA — confirmar] **Tabla general: puntos 2/1 y desempate** configurables con la aclaración "solo partidos importados" (DA-31, default adoptado).
- [DECISIÓN HUMANA: DA-17] Preferencias por usuario en servidor con `owner` = usuario de sesión (default: sí; no es una tabla de usuarios).
- [DECISIÓN HUMANA: DA-18] Permisos con `ADMIN_USERS` opcional (default: sin la variable, todo usuario autenticado es admin).
