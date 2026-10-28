# Correcciones de Equipo, Liga y Preparar — 2026-10-27

Origen: lista del cliente (mensajes de WhatsApp) tras probar la versión en QA.

| Pedido | Causa | Corrección | Verificación |
|---|---|---|---|
| Combinaciones, Uso y quintetos mezclan competencias | el selector de jugadores, el picker de combinaciones, la barra de contexto y `/api/lineup`, `/api/onoff` no pasaban ni filtraban por competencia | se pasa `competition` en todos y se recargan al cambiarla | `eq_sim.py` |
| Promedio de liga en perfil de equipo no anda | con una competencia joven ningún equipo llega a `sample.team.min` y la ficha quedaba sin promedio | `population.fallback = sin_umbral` | `eq_sim.py` (consulta con 2 partidos por equipo) |
| poss, pace y posesiones contadas distintos | "posesiones contadas" sumaba TODA la competencia aunque la selección fuera de menos partidos | se cuenta solo en los partidos de la selección (`possessions.team_possessions_in`) | `a05_sim.py`, regresión |
| Corregir mapa de tiro | la clasificación usaba `x/y` legadas (siempre 0) y asumía media cancha | geometría FIBA real (`to_half_court`) | `eq_sim.py` |
| % tiro de media / pintura no anda | `StatBundle.shots` nunca se completaba | conteo por zona desde `shots` (`game_zone_counts`) | `eq_sim.py` |
| Uso de 2P y de TL en Tiro | no existían en la card | `ft_uso` nuevo (90 claves) y Uso 2P en la card | `eq_browser.py` |
| Desglose ofensivo en blanco | la competencia no publica los campos de FIBA | se calcula desde pbp, tiros y box (`breakdown.py`) y se avisa | `eq_sim.py` |
| "No se pudo cargar" plantel, quintetos, tramos; Preparar lento | `cache.MAX_PER_NAMESPACE = 64` expulsaba las posesiones de ligas de más de 32 partidos; `canonical_id` hacía una consulta por llamada (330 000 en el plantel); eventos cargados con el ORM; 1 worker síncrono | límites por namespace, mapas por petición, carga de núcleo, `--threads 4`, calentamiento | tiempos en frío con 273 partidos |
| Análisis tipo Preparar en Equipo | — | `team_insights.py` + card "Análisis del equipo" | `eq_browser.py` |
| Liga: tablas desplegables y uso de 3P/2P | — | `_makeCollapsible`, mapas "Uso de 3P / eFG%" y "Uso de 2P / Uso de TL", columnas en el ranking | `eq_browser.py` |
| "Por tramo del partido" es tramo de la posesión | — | ya entregado en A-05 (tramos del reloj de posesión 0-8, 9-16, 17-24) | `a05_sim.py` |

## Tiempos en frío (273 partidos, 169 en la competencia, un proceso, caché vacío)
| Endpoint | Antes | Después |
|---|---|---|
| `/api/team` | 16,2 s | 4,8 s |
| plantel (`team_roster`) | más de 10 min | 8,3 s |
| quintetos (`team_lineups`) | 46 s | 3,0 s |
| ON/OFF (`team_onoff`) | 14,0 s | 2,4 s |
| `/api/periods` | 13,9 s | 6,6 s |
| `/api/prepare` | 14,1 s | 3,0 s |

Los tiempos son de la primera petición tras un cambio de datos; con `SB_WARMUP=1` el calentamiento corre en segundo plano al arrancar.

## Pendiente / límites
- No se pudo reproducir con datos de producción: el diagnóstico salió de una base clonada (273 partidos). Falta confirmar en QA con LUB 2026 / LFB 2025.
- "Mapa de tiro: corregir" se interpretó como la clasificación por zona; si el pedido era otro (estilo, ejes) hace falta el detalle.
- `ft_uso` se definió como el peso de los libres en las jugadas de tiro; confirmar con el cliente.
- El análisis del equipo es por reglas sobre percentiles, no un modelo de IA.
- Memoria: ≈ 0,7 MB por partido de posesiones en caché.
