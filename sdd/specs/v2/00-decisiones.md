# Decisiones humanas resueltas — Smart-Basket v2

Registro de las decisiones de `00-arquitectura-transversal.md` §11 que ya tomó el humano. Una decisión registrada acá
reemplaza al "default que asumen los redactores". Las no listadas siguen abiertas: se preguntan al llegar al requisito que
las necesita.

| ID | Decisión | Fecha | Nota |
|---|---|---|---|
| DA-01 | Integrar el Bloque C de `dev` (`0cc4de6`) sin `backend/venv/` ni `package-lock.json`, en la rama `v2` | 2026-09-26 | Las C-xx son delta sobre `dev` |
| DA-02 | Tasas de una selección = cociente de totales (pooled), no promedio de tasas por partido | 2026-09-26 | C-11 lo aplica solo a DEF/TO; la migración general es de T-05 |
| DA-07 | AS/PER y DEF/TO con 0 pérdidas → `null` con razón `sin_perdidas` (por partido y acumulado) | 2026-09-26 | Se eliminan los sentinels 99.0 |
| DA-21 | **No** preparar i18n en fase 1: sin `t()` ni `core/i18n.js`; el copy se extrae en F-21 | 2026-09-26 | Se aparta del default de la arquitectura (§3.20). Los planes que citan `t()` escriben el copy en español directo |
| DA-36 | Formato numérico es-UY (coma decimal) en toda la UI, con un único formateador | 2026-09-26 | |

## Ambigüedades de spec resueltas

| Requisito | Decisión | Fecha |
|---|---|---|
| C-11 RF-11 | "La competencia no registra el dato" se resuelve en la ingesta: si FIBA no manda la clave se guarda `NULL` (0 solo si FIBA informa 0). Se descarta la heurística "0 en toda la competencia" | 2026-09-26 |
| C-11 RF-10 | DNP en evolución: el partido queda en el eje, sin punto en ninguna serie | 2026-09-26 |
