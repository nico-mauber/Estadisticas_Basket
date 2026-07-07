# Spec — Feature 03 (tarea 5): Lineups (combinaciones de 3, 4 y 5 jugadores)

> **Depende de Feature 02** (pbp persistido). Sin `pbp_events` + `starter` no hay forma de saber quién comparte cancha. MVP acotado: métricas núcleo para una combinación seleccionada; el resto queda en §8.

## 1. Objetivo
Dentro de la vista Equipo, permitir seleccionar 3, 4 o 5 jugadores del equipo y obtener el rendimiento del equipo durante los minutos en que esos jugadores comparten cancha (métricas núcleo de eficiencia + líderes de la combinación).

## 2. Fuentes (trazabilidad)
- Feature 02 `spec.md` — tabla `pbp_events` (eventos con `team_code`, `player_name`, `period`, `clock_secs`, `s1`/`s2`, `action_type`, `sub_type`, `success`) y `player_game_stats.starter`.
- `docs/metrics.md` §Posesiones, §Eficiencia ofensiva y defensiva, §Eficiencia de tiro — fórmulas EXACTAS (copiadas abajo en RF, sin reinterpretar).
- `docs/frontend.md` §Vistas → "Equipo" y §"app.js" — la vista Equipo ya tiene `#team-select` y `#player-select`; se agrega un apartado nuevo.
- `docs/api.md` — no existe endpoint de lineups (será NUEVO).
- Constitución regla 3 (rutas `/api/*`, lógica en módulo backend), regla 4 (métricas on-the-fly en `stats_engine.py`), regla 9 (frontend reusa helpers `_colorCell`, `statBox`).

## 3. Historias de usuario
- US-1: Como entrenador, quiero seleccionar 3, 4 o 5 jugadores y ver cómo rinde el equipo cuando están juntos en cancha, para entender qué combinaciones funcionan.
- US-2: Como entrenador, quiero saber, dentro de esa combinación, quién anota / asiste / rebotea más, para entender los roles.
- US-3: Como entrenador, quiero ver cuántos minutos/posesiones jugó realmente esa combinación, para saber si la muestra es significativa.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE reconstruir, recorriendo `pbp_events` de cada partido del equipo, el conjunto de jugadores en cancha en cada instante: quinteto inicial = los 5 con `starter=1` de ese equipo en ese partido; cada evento `substitution` con `sub_type="in"`/`"out"` actualiza el conjunto. · (US-1, Feature 02 RF-3/RF-4) · Si en algún partido el conjunto no queda en 5 (dato FIBA inconsistente), ese partido se excluye del cálculo de lineups y se reporta (ver RF-7).
- RF-2: El sistema DEBE, dada una combinación de K jugadores (K ∈ {3,4,5}) del equipo, identificar los "stints" (tramos de eventos consecutivos) en que **los K jugadores seleccionados están simultáneamente en cancha**, agregando sobre esos stints las stats crudas del equipo: 2PA/2PM, 3PA/3PM, FTA/FTM, OR, DR, AST, TOV, STL, BLK, y puntos a favor / en contra (de las variaciones de `s1`/`s2`). · (US-1)
- RF-3: El sistema DEBE calcular, sobre las stats agregadas de la combinación, las métricas con las fórmulas EXACTAS de `docs/metrics.md`:
  - `POS = 2PA + 3PA + FTA×0.44 + TOV − OR`
  - `OER = PTS / POS` (PTS = puntos a favor del equipo con la combo en cancha)
  - `DER = PTS_rival / POS_rival` (POS_rival = posesiones del rival durante esos stints)
  - `Net Rating = OER − DER`
  - `eFG% = (FGM + 0.5×3PM) / FGA`
  - `TS% = PTS / (2 × (FGA + FTA×0.44))`
  · (US-1, `docs/metrics.md` §Posesiones/§Eficiencia/§Tiro)
- RF-4: El sistema DEBE reportar el tamaño de muestra de la combinación: posesiones jugadas y segundos en cancha (suma de `clock_secs` recorridos). · (US-3)
- RF-5: El sistema DEBE reportar los líderes de la combinación entre los K jugadores: quién anota más (puntos), quién asiste más (AST), quién rebotea más (TRB), contabilizados **solo con eventos ocurridos mientras la combinación estaba en cancha**. · (US-2)
- RF-6: El sistema DEBE exponer estos datos vía endpoint NUEVO `GET /api/lineup/<team_code>?players=<n1>|<n2>|...` (2 a 5 nombres separados por `|`). · (US-1) · Valida 3–5 jugadores; con <3 o >5 → `400`.
- RF-7: El sistema DEBE devolver, además de las métricas, cuántos partidos entraron en el cálculo y cuántos se excluyeron por datos de pbp inconsistentes. · (US-3, RF-1)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events`, `player_game_stats.starter` | consumidos | (definidos en Feature 02) | — |
| `GET /api/lineup/<team_code>?players=A\|B\|C` | endpoint | Response: `{ "team_code", "players": [...], "size": 3, "games_used": 3, "games_excluded": 1, "sample": {"possessions": 42.5, "seconds": 610}, "metrics": {"oer","der","net_rating","efg_pct","ts_pct","pts_for","pts_against"}, "raw": {"fga","fgm","fga3","fgm3","fta","ftm","orb","drb","ast","tov","stl","blk"}, "leaders": {"scorer": {"name","pts"}, "assister": {"name","ast"}, "rebounder": {"name","trb"}} }`. Errores: `400` (K fuera de 3–5), `404` (equipo sin datos). | **NUEVO** |

Nueva función de servicio en módulo backend (NO en `app.py`): reconstrucción de quintetos + agregación por combinación (candidato: `lineups.py` nuevo, o `stats_engine.py`). El plan (Paso 2) decide el archivo.

## 6. Estados de UI
Apartado nuevo dentro de la vista Equipo (`#sec-team`), debajo del contenido existente.
| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selector de combinación (multi-select 3–5 jugadores del equipo actual) + botón "Analizar combinación" | — | Si el equipo no tiene partidos con pbp: `"Este equipo no tiene play-by-play importado. Reimportá sus partidos."` (copy nuevo) | Selección inválida: `"Elegí entre 3 y 5 jugadores"` (toast, reusa `toast()`); `404`: `"Sin datos para esta combinación"` | `/api/*` siempre a red (SW existente) | Tarjeta con métricas núcleo (reusa `statBox`/`_colorCell`), muestra de posesiones/segundos, y líderes |
| Estado "muestra chica" | — | Si `possessions < 10`: mostrar aviso `"Muestra chica (N posesiones) — tomar con cuidado"` (copy nuevo) | — | — | — |

## 7. Criterios de aceptación
- CA-1: Given un equipo con partidos que tienen pbp, When se pide `GET /api/lineup/<team>?players=A|B|C|D|E` con 5 titulares habituales, Then la respuesta trae `size:5`, `sample.possessions > 0` y `metrics.net_rating` = `oer − der` (verificable numéricamente).
- CA-2: Given una combinación de 3 jugadores, When se consulta el endpoint, Then `size:3` y las métricas se calculan solo sobre los stints donde esos 3 están juntos (verificar que `sample.seconds` ≤ segundos totales del jugador que menos jugó de los 3).
- CA-3: Given `players` con 2 nombres (o 6), When se consulta, Then responde `400` con `"Elegí entre 3 y 5 jugadores"`.
- CA-4: Given la combinación de titulares, When se abre el apartado en la vista Equipo y se analiza, Then se muestran OER/DER/Net Rating/eFG%/TS%, posesiones, y los tres líderes (anotador/asistente/reboteador) sin errores en consola.
- CA-5: Given un partido con pbp inconsistente (quinteto ≠ 5 en algún tramo), When se calcula el lineup, Then ese partido cuenta en `games_excluded` y no rompe el resultado de los demás.
- CA-6: Given una combinación con `possessions < 10`, When se renderiza, Then aparece el aviso de muestra chica.

## 8. Fuera de alcance (backlog documentado)
Indicadores pedidos por el usuario que NO entran en el MVP y quedan para una feature siguiente:
- **% Rebote ofensivo / defensivo de la combinación** (OR%/DR%) — requieren rebotes del rival durante los stints; `pbp_events` los tiene (rebounds con `tno` rival) pero suma complejidad. Diferido.
- **Pace de la combinación** — requiere minutos exactos en cancha por stint proyectados a 40'; se puede derivar de `sample.seconds` pero se difiere para acotar el MVP.
- **Offensive Rating / Defensive Rating** como métricas separadas de OER/DER (el usuario los listó aparte; en `docs/metrics.md` OER/DER SON el offensive/defensive rating por posesión — se documenta esta equivalencia en el plan; no se inventa una segunda fórmula).
- **Distribución de tiros de la combinación** (shot chart por zonas del quinteto) — reusa la lógica de zonas pero agregada por lineup; diferido.
- **Enumeración automática de las "mejores" combinaciones** (rankear todos los quintetos posibles por Net Rating) — el MVP responde por combinación consultada, no explora el espacio completo.
- **Plus/Minus por jugador dentro de la combinación** — el +/- de equipo con la combo en cancha se cubre vía `pts_for − pts_against`; el desglose por jugador se difiere.
- **Comparar dos combinaciones lado a lado.**

## 9. Ambigüedades
- [RESUELTA] "Net Rating / OER / DER / Offensive Rating / Defensive Rating" — el usuario los listó como métricas separadas, pero `docs/metrics.md` define OER/DER como puntos por posesión (que ES el offensive/defensive rating) y Net Rating = OER−DER. **Decisión:** se usan las fórmulas de `docs/metrics.md` tal cual; "Offensive/Defensive Rating" se muestran como sinónimos de OER/DER escalados ×100 si se quiere presentación estilo NBA, pero el número base es el de `metrics.md`. No se inventa fórmula nueva.
- [RESUELTA] ¿Agregación por-partido o global multi-partido? → **Decisión MVP:** global (suma de stints de todos los partidos del equipo con pbp). El filtro por partido específico se difiere a §8. Justificación: el valor de un lineup es el acumulado; por-partido es refinamiento.
- [RESUELTA] ¿Qué es un "stint" cuando hay tiros libres / rebotes con reloj detenido? → **Decisión:** el conjunto en cancha solo cambia con eventos `substitution`; todos los demás eventos (incluidos FT y rebotes) se atribuyen al conjunto vigente. No se intenta modelar el reloj parado.
- [RESUELTA] Nulo vs cero → **Decisión:** las tasas de la combinación (OER/DER/eFG%/TS%) valen `null` (no 0) si su denominador es 0, con la semántica de la **Feature 08** (`spec.md`). El agregado suma conteos crudos y calcula la tasa una vez sobre la suma; si esa suma-denominador es 0 → tasa null.
