# Decisiones humanas resueltas — Smart-Basket v2

Registro de las decisiones de `00-arquitectura-transversal.md` §11 que ya tomó el humano. Una decisión registrada acá
reemplaza al "default que asumen los redactores". Las no listadas siguen abiertas: se preguntan al llegar al requisito que
las necesita.

| ID | Decisión | Fecha | Nota |
|---|---|---|---|
| DA-01 | Integrar el Bloque C de `dev` (`0cc4de6`) sin `backend/venv/` ni `package-lock.json`, en la rama `v2` | 2026-09-26 | Las C-xx son delta sobre `dev` |
| DA-02 | Tasas de una selección = cociente de totales (pooled), no promedio de tasas por partido | 2026-09-26 | C-11 lo aplica solo a DEF/TO; la migración general es de T-05 |
| DA-07 | AS/PER y DEF/TO con 0 pérdidas → `null` con razón `sin_perdidas` (por partido y acumulado) | 2026-09-26 | Se eliminan los sentinels 99.0 |
| DA-12 | Archivar el JSON crudo de FIBA (gzip) de cada partido para reprocesar sin depender de FIBA | 2026-09-26 | F-11 |
| DA-13 | Las competencias creadas al importar nacen `publicada` | 2026-09-26 | F-11 |
| DA-18 | `ADMIN_USERS` opcional: con la variable, solo esos usuarios modifican datos; sin ella, todo usuario logueado es admin. Importar sigue abierto a cualquier logueado | 2026-09-26 | F-11 |
| DA-21 | **No** preparar i18n en fase 1: sin `t()` ni `core/i18n.js`; el copy se extrae en F-21 | 2026-09-26 | Se aparta del default de la arquitectura (§3.20). Los planes que citan `t()` escriben el copy en español directo |
| DA-32 | Capturar las coordenadas reales de tiro (`tm[n].shot[]`) en la ingesta; el mapa de 11 zonas las usa en C-03 | 2026-09-26 | F-11 solo las guarda |
| DA-36 | Formato numérico es-UY (coma decimal) en toda la UI, con un único formateador | 2026-09-26 | |

## Ambigüedades de spec resueltas

| Requisito | Decisión | Fecha |
|---|---|---|
| C-11 RF-11 | "La competencia no registra el dato" se resuelve en la ingesta: si FIBA no manda la clave se guarda `NULL` (0 solo si FIBA informa 0). Se descarta la heurística "0 en toda la competencia" | 2026-09-26 |
| C-11 RF-10 | DNP en evolución: el partido queda en el eje, sin punto en ninguna serie | 2026-09-26 |
| F-11 alcance | Versión acotada: competencias (alias, estado, fusión, reasignación), ingesta en `ingest.py` (archivo crudo, upsert de tiros/pbp, minutos reales, coordenadas, fix `OVERTIME`), reproceso y panel de calidad. **Diferido**: columnas para requisitos futuros (cada dueño agrega las suyas y reprocesa), `cache.py`/`data_version`, `repository.py`, competencia por defecto (DA-14 → C-02) | 2026-09-26 |
| F-11 borrador | Una competencia en `borrador` oculta todo: sus partidos no entran en ningún cálculo ni listado fuera de la sección Datos | 2026-09-26 |
| C-05 §9 | Se aplican las 3 propuestas: búsqueda de la palabra `pep` sin distinguir mayúsculas en `frontend/`, `backend/` (sin `venv/`) y `docs/`, excluido `sdd/`; `docs/database.md` describe `paint_pts` sin la sigla vieja; toda etiqueta futura de `paint_pts` es `PtsEnPint` | 2026-09-26 |
| C-10 §9 | Se aplican las 4 propuestas: la flecha indica la dirección en pantalla del mejor rendimiento y se deriva de la dirección de la métrica (sin invertir escalas); rótulos internos "Prom. <métrica>" sin flecha; métricas neutrales sin flecha; recuperos y puntos "mayor es mejor" | 2026-09-26 |
| C-06 alcance | Completo: umbral y ventana en un único lugar del backend, título desde la respuesta, recuento que cierra, prórrogas `OVERTIME` en la ventana, filtro de competencia de Equipo y validación estricta (400) de `margin`/`window_secs` | 2026-09-26 |

