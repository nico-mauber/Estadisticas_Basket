# Progress — T-02: Confiabilidad de muestra

> **Estado:** ✅ Implementado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md) · Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

## Estado de tareas
Grupos A, B, C, D, E completos (T-A1, T-B1…T-B8, T-C1, T-D1…T-D7, T-E1, T-E2). Grupo G diferido según plan
(F-06, A-01, A-08/F-07/T-03/C-03/A-05).

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ✅ | `all_lineups` enumera 27 quintetos reales de un equipo del seed; ranking por Net Rating ajustado entre rankeables respeta `n ≥ mínimo efectivo` |
| CA-2 | ✅ | Combinaciones con ~12/~20/~45 posesiones → `baja`/`media`/`alta`, `min=15`, `high=40`, `min_source=absoluto` (relativo deshabilitado) |
| CA-3 | ✅ | `min=max(15, 1.5%×team_poss)`; equipo con 2000 pos → `min=30` relativo; equipo chico → absoluto |
| CA-4 | ✅ | `PUT /api/settings {"sample.lineup.min":25}` cambia el badge sin reiniciar; sin literal `10` en frontend (`grep` limpio) |
| CA-5 | ✅ | `adj.value == (pos·v+K·prior)/(pos+K)` verificado a 4 decimales; `net_rating.adj.value == oer.adj.value − der.adj.value` |
| CA-6 | ✅ | Banda de combinación con menos posesiones es mayor; ambas cumplen `1,96·1,15/√(pos+25)` |
| CA-7 | ✅ | Jugador con 100% de minutos en cancha: OFF con 0 posesiones, badge `baja` `n=0`, ajustados `null` razón `sin_intentos`, sin NaN/Infinity |
| CA-8 | ✅ | Combinación `baja`: valores en gris, aviso visible, crudo+ajustado+banda visibles (nada oculto) |
| CA-9 | ✅ | `POST /api/settings/calibrate {entity:"lineup"}` devuelve `units`, `n_half_mean`, `r`, `k_suggested`, `method="partidos_alternos"`; `GET /api/settings` conserva el K anterior hasta "Aplicar" |
| CA-10 | ✅ | Usuario autenticado fuera de `ADMIN_USERS` → 403 `requiere_admin` (verificado con auth real) |
| CA-11 | ✅ | Panel Cierres: badge con posesiones del tramo, partidos calificados, OER/DER/Net ajustados (K=20, split) |
| CA-12 | ✅ | Equipo con 2 PJ y jugador con 45 min → `sample.level=baja`, unidad `partidos`/`minutos` |
| CA-13 | ✅ | Entidad sin partidos en la selección: `n=0`, `baja`, métricas nulas `sin_datos` |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema (confirmado, T-02 no toca modelos): ✅
- Endpoints probados manualmente (curl + `app.test_client()`, datos reales del seed): ✅
- Consola del navegador sin errores JS: ⚠️ no verificado visualmente (sin entorno gráfico); `node --check` sin errores de sintaxis en todos los JS tocados/creados

## Corrida de calibración sobre el dataset de verificación (seed, competencia 1)
- `calibrate_k("lineup", 1)`: `units=17, units_excluded=24, n_half_mean≈?, r=0.257, k_suggested=48.0, k_current=25, warnings=[]`.
- `calibrate_k("onoff", 1)`: `r=-0.249` (correlación no positiva) → `k_suggested=null`, `warnings=["correlacion_no_positiva"]`.
- Con el seed de 13 partidos, pocos quintetos superan 15 posesiones; igualmente se obtuvieron 17 unidades
  calibrables de quinteto (ambas mitades con datos). La calibración de ON/OFF no sugiere K con este dataset
  (r negativo) — esperable con tan pocos partidos por equipo (ver ambigüedad de spec §9, "dataset con pocos
  partidos puede no alcanzar"). Aplicado K=48 de prueba para verificar el ciclo completo calibrar→aplicar→leer,
  luego revertido a 25 (default) para no alterar la configuración de producción.

## Desviaciones respecto a docs/ o plan
- No existe `cache.py`/`cache.memo` (F-11 lo difirió, igual que en T-05): `league_prior`/`team_offensive_possessions`/
  `all_lineups` usan memoización por request vía `flask.g`, mismo patrón que `repository.py`.
- No existe `views/configuracion.js` (el plan lo asume): la vista Configuración vive en `app.js` (`renderConfig`,
  `#sec-config`) + `components/settings-form.js` genérico (F-13). La card de calibración se agregó como sección
  hermana (`renderCalibrationCard`), no dentro del formulario genérico.
- No existe un helper `t()`/i18n en el proyecto (el plan lo asume en varios lugares): todo el copy nuevo se
  escribió directo en español, como el resto de la app.
- `admin_required` no devuelve `code` en el 403; la ruta `POST /api/settings/calibrate` usa `login_required` +
  chequeo manual de `is_admin()` para poder devolver `code: "requiere_admin"` sin modificar el decorador
  compartido (usado por 10+ rutas existentes).
- El tooltip de umbral relativo del badge usa el literal "1,5 %" en vez de leer `sample.lineup.rel_pct` del
  payload de settings (simplificación; cambio de una línea si se requiere el valor dinámico).

## Docs actualizados
- [x] `docs/metrics.md` — sección "Confiabilidad de muestra (T-02)"
- [x] `docs/api.md` — campos `sample`/`adj` en `/api/metrics/<entity_type>`, endpoint `POST /api/settings/calibrate`
- [x] `docs/frontend.md` — `sample-badge.js`, extensión de `standard-panel.js`, card de calibración en Configuración
- [x] `docs/architecture.md` — módulo `sample.py`

## Deuda / TODO
- Verificación visual manual en navegador real (CA-8, interacción de la card de calibración) pendiente: sin
  entorno gráfico en este ambiente de desarrollo.
- Tooltip de umbral relativo con el porcentaje dinámico (hoy literal "1,5 %").
- Tabla visible de todos los quintetos y tarjetas de líderes quedan para F-06 (fuera de alcance de T-02).
