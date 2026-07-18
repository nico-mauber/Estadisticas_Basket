# Spec — Feature 04 (tarea 6): ON / OFF

> **Depende de Feature 02** (pbp persistido) y comparte con Feature 03 el motor de reconstrucción de quintetos. MVP: split ON/OFF con métricas núcleo; métricas sin fórmula definida (Chaos, Offensive Dependency) quedan en §9/§8.

## 1. Objetivo
Comparar automáticamente el rendimiento del equipo con un jugador en cancha (ON) versus fuera de cancha (OFF), mostrando el diferencial de las métricas clave, dentro de la vista Equipo.

## 2. Fuentes (trazabilidad)
- Feature 02 `spec.md` — `pbp_events` (eventos con `team_code`, `player_name`, `period`, `clock_secs`, `s1`/`s2`, `action_type`, `sub_type`, `success`) + `player_game_stats.starter`.
- Feature 03 `spec.md` §RF-1 — motor de reconstrucción de quintetos en cancha (mismo mecanismo; se reutiliza).
- `docs/metrics.md` §Posesiones, §Eficiencia, §Eficiencia de tiro, §Rebotes, §Uso del tiro (USO%) — fórmulas EXACTAS.
- `docs/frontend.md` §Vistas → "Equipo"; helpers `statBox`, `_colorCell`.
- `docs/api.md` — no existe endpoint on/off (NUEVO).
- Constitución 3 (lógica en módulo backend), 4 (métricas on-the-fly), 9 (reuso de helpers frontend).

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver cómo cambia el rendimiento del equipo cuando un jugador está en cancha vs cuando está en el banco, para medir su impacto real más allá de sus números individuales.
- US-2: Como entrenador, quiero ver el diferencial (ON menos OFF) de cada métrica de un vistazo, para identificar jugadores que "mueven la aguja".

## 4. Requisitos funcionales
- RF-1: El sistema DEBE, para un jugador dado, particionar los eventos de todos los partidos del equipo (con pbp) en dos conjuntos: ON (eventos ocurridos mientras el jugador estaba en cancha) y OFF (mientras estaba en el banco), reusando el motor de quintetos de Feature 03 RF-1. · (US-1)
- RF-2: El sistema DEBE agregar por cada conjunto (ON, OFF) las stats crudas del equipo (2PA/2PM, 3PA/3PM, FTA/FTM, OR, DR, AST, TOV, STL, BLK, puntos a favor / en contra) y las del rival necesarias para DER. · (US-1)
- RF-3: El sistema DEBE calcular, para ON y para OFF, con las fórmulas EXACTAS de `docs/metrics.md`: `POS`, `OER`, `DER`, `Net Rating (=OER−DER)`, `eFG%`, `TS%`. · (US-1, `docs/metrics.md`)
- RF-4: El sistema DEBE calcular el **diferencial** de cada métrica: `diff = ON − OFF`, y devolverlo junto a los valores ON y OFF. · (US-2)
- RF-5: El sistema DEBE reportar la muestra de cada conjunto: posesiones y segundos ON / OFF, para juzgar significancia. · (US-1)
- RF-6: El sistema DEBE incluir el USO% del jugador (fórmula EXACTA `docs/metrics.md` §USO%) como contexto del ON (ya calculable desde `player_game_stats`; se reutiliza `calc_player_stats`). · (US-1, `docs/metrics.md` §USO%)
- RF-7: El sistema DEBE exponer estos datos vía endpoint NUEVO `GET /api/onoff/<team_code>/<player_name>`. · (US-1)
- RF-8: **(REVISIÓN v2, feedback cliente 2026-07-08)** El sistema DEBE exponer, además de las tasas, los **conteos crudos del equipo** en cada conjunto (ON, OFF): puntos a favor, puntos en contra, REB, AST, TOV, STL, BLK. El cliente lo pidió explícito (ej.: *"con un jugador que jugó 20 min el equipo anotó 80 pts, agarró 20 reb y 5 asís y solo le anotaron 10 pts, cuando salió, cómo le fue al equipo"*). Sube desde §8 (estaba diferido). · (US-1, US-2) · Nota: los conteos crudos escalan con los minutos de cada conjunto (ON suele tener más posesiones que OFF); se muestran junto a las tasas, que sí son comparables directamente.

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events`, `player_game_stats.starter` | consumidos | (Feature 02) | — |
| `GET /api/onoff/<team_code>/<player_name>` | endpoint | Response: `{ "team_code", "player", "usg_pct": 0.24, "on": {"possessions","seconds","oer","der","net_rating","efg_pct","ts_pct","pts_for","pts_against"}, "off": {…mismas claves…}, "diff": {"oer","der","net_rating","efg_pct","ts_pct"} }`. Errores: `404` equipo/jugador sin datos. | **NUEVO** — irá a `docs/api.md` |

Reusa el motor de quintetos (módulo de Feature 03). No agrega columnas de DB.

## 6. Estados de UI
Apartado nuevo dentro de la vista Equipo (`#sec-team`), asociado al `#player-select` ya existente.
| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Panel ON/OFF (elegís un jugador del equipo → botón "Ver ON/OFF") | spinner (`<span class="spinner">`) | Equipo sin pbp: `"Este equipo no tiene play-by-play importado. Reimportá sus partidos."` (copy nuevo) | `404`: `"Sin datos ON/OFF para este jugador"` (copy nuevo) | `/api/*` siempre a red (SW) | Tabla de 3 columnas por métrica: `ON | OFF | Δ`, con el Δ coloreado verde/rojo vía `_colorCell` (verde = ON mejora al equipo) + muestra de posesiones ON/OFF |

## 7. Criterios de aceptación
- CA-1: Given un equipo con pbp y un titular, When se pide `GET /api/onoff/<team>/<player>`, Then la respuesta trae `on` y `off` con `possessions > 0` cada uno, y `diff.net_rating == on.net_rating − off.net_rating` (verificable numéricamente).
- CA-2: Given un jugador que jugó todos los minutos de todos los partidos, When se consulta, Then `off.possessions == 0` y la UI muestra OFF como "sin muestra" en vez de dividir por cero (sin `NaN`/`Infinity`).
- CA-3: Given un jugador válido, When se abre el panel ON/OFF en la vista Equipo, Then se muestra la tabla ON | OFF | Δ con el Δ coloreado y sin errores en consola.
- CA-4: Given un jugador inexistente en el equipo, When se consulta el endpoint, Then responde `404 {"error": "Sin datos ON/OFF para este jugador"}`.
- CA-5: Given la suma de posesiones ON + OFF, When se compara con las posesiones totales del equipo (todos sus partidos con pbp), Then coinciden (partición exhaustiva y disjunta).

## 8. Fuera de alcance (backlog documentado)
Indicadores pedidos por el usuario fuera del MVP:
- **% Rebote ofensivo / defensivo** (OR%/DR%) ON vs OFF — requiere rebotes del rival por partición; diferido (mismo motivo que Feature 03 §8).
- **Pace** ON/OFF — diferido (derivable de `seconds` pero fuera del MVP).
- ~~**Pérdidas / Robos / Tapones / Asistencias / Rebotes** ON vs OFF como conteos crudos~~ → **movido a alcance (RF-8, revisión v2)**.
- **Offensive Dependency** y **Chaos** — sin fórmula en `docs/metrics.md` (ver §9). No se implementan hasta definirlas.
- **Impacto por-partido** (ON/OFF de un partido puntual) — el MVP es global multi-partido.

## 9. Ambigüedades
- [NEEDS CLARIFICATION — no bloquea el MVP, difiere el indicador] **"Chaos"**: el usuario lo pide como métrica ON/OFF pero no existe en `docs/metrics.md` ni en el código. **Decisión:** fuera del MVP hasta que se defina su fórmula y sus stats de entrada. Candidata a documentar: si "Chaos" = actividad defensiva que genera desorden (STL+BLK+cargas+deflexiones), las deflexiones/cargas NO están en los datos FIBA → probablemente aproximable solo como `STL+BLK` (=Stops, ya existente). Requiere confirmación del usuario antes de agregarla a `docs/metrics.md`.
- [NEEDS CLARIFICATION — no bloquea el MVP, difiere el indicador] **"Offensive Dependency"**: sin definición en `docs/metrics.md`. **Decisión:** fuera del MVP. Interpretación tentativa a confirmar: cuánto depende el ataque del equipo de un jugador (ej. `USO% del jugador` o `puntos+asistencias generados / puntos del equipo` con el jugador en cancha). No se implementa hasta fijar fórmula.
- [RESUELTA] División por cero cuando OFF (o ON) no tiene posesiones → **Decisión:** el conjunto sin posesiones devuelve métricas `null` y la UI muestra "sin muestra" (no 0, no Infinity). Consistente con `_safe_div` de `stats_engine.py` y con la semántica null de la **Feature 08** (`spec.md`): tasa con denominador 0 → null, tanto en ON como en OFF, y el `diff` es `null` si cualquiera de los lados lo es.
