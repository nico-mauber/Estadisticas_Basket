# Tasks — C-11: Tratamiento de nulos en toda la app

> **ID:** C-11 · **Prioridad:** P0 · **Fase y orden:** 1·01
> **Estado:** Completado
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md) · decisiones en [../../00-decisiones.md](../../00-decisiones.md)

## Grupo 0 — Integración del Bloque C de `dev` (P-00)
- [x] T-01 · Rama `v2` desde `main`; `git cherry-pick -n 0cc4de6` (sin `669250e`/`3c65008`) — RF-1
- [x] T-02 · `.gitignore`: `backend/venv/`, `package-lock.json` — RF-1
- [x] T-03 · Humo de los CA de las features 12–18 — CA-2

## Grupo A — Backend
- [x] T-A1 · `stats_engine.py`: sentinels 99.0 / `inf` → `None` en `ast_to` y `def_to_ratio` (equipo y jugador) — RF-2
- [x] T-A2 · `stats_engine.py`: `season_def_to_ratio()` (pooled, DA-02) — RF-2, RF-7
- [x] T-A3 · `stats_engine.py`: `FIBA_OPTIONAL_FIELDS`, `null_reason()`, `null_reasons()` — RF-3
- [x] T-A4 · `fiba_fetcher.py`: clave ausente → `None` en el desglose y `plus_minus`; `ti()` distingue 0 de ausente — RF-11, RF-12
- [x] T-A5 · `app.py` `/api/team`: desglose sin `0` por defecto, `def_to_ratio` acumulado, `null_reasons` raíz y por partido — RF-2, RF-3, RF-11
- [x] T-A6 · `app.py` `/api/player`: `def_to_ratio` acumulado, `null_reasons` raíz y por partido (`dnp`) — RF-2, RF-3, RF-10
- [x] T-A7 · `app.py` `/api/search/players`: `plus_minus` sin `None → 0`, `null_reasons` por fila — RF-7, RF-11

## Grupo B — Frontend
- [x] T-B1 · `frontend/js/core/format.js` (NUEVO): `fmtNumber` es-UY, `PCT`/`PCT0`/`DEC1`/`DEC2`, `isNull`, `nullDisplay`, `fmtOrNull`, `NULL_REASON_LABELS` — RF-4, RF-13
- [x] T-B2 · `app.js`: importar helpers; `statBox(…, reason)`; razones en Equipo, Jugador, detalle de tiro, game logs y Buscar — RF-4
- [x] T-B3 · `app.js`: `_computeAvg` con `def_to_ratio` pooled y `null_reasons` — RF-7
- [x] T-B4 · `app.js`: Four Factors (RebOf% rival nulo), ranking de uso (0 real visible), total de tiro `(—)`, desglose siempre visible, Net Rating de Liga sin color con nulo — RF-5, RF-6, RF-9
- [x] T-B5 · `app.js`: fila DNP en game log de jugador — RF-10
- [x] T-B6 · `app.js`: todos los `toFixed` de texto visible → formateadores compartidos (incluidas posesiones de ON/OFF y Combinación) — RF-13
- [x] T-B7 · `app.js` + `style.css`: modal de borrado sin token — RF-14
- [x] T-B8 · `charts.js`: `Chart.defaults.locale = "es-UY"`, formateadores compartidos, hueco DNP en evolución con título "No jugó (DNP)" — RF-10, RF-13
- [x] T-B9 · `style.css`: `.null-val`; `sw.js`: `/js/core/format.js` en `STATIC`, `CACHE` → `smart-basket-v10` — RF-4

## Grupo D — Docs
- [x] T-D1 · `docs/api.md` (`null_reasons`, códigos, sin centinelas), `docs/metrics.md` (DEF/TO acumulado, no registrado, DNP), `docs/database.md` (regla `NULL` para columnas FIBA), `docs/frontend.md` (`core/format.js`, SW) — RF-12, CA-12

## Grupo F — Verificación
- [x] T-F1 · Recorrido completo en Chromium headless + chequeos de API (ver progress.md) — CA-1…CA-14
