# Plan — C-05: Renombrar PEP

> **ID:** C-05 · **Prioridad:** P2 · **Fase y orden:** 1·03
> **Depende de:** C-11 Grupo 0 (P-00) — [`../01-C-11-tratamiento-de-nulos/plan.md`](../01-C-11-tratamiento-de-nulos/plan.md) · **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [`spec.md`](spec.md) · Especificación v2 §2 · C-05 · Arquitectura §1.0, §2.2, §3.13, §3.20
> **Estimación:** S · 1–2 h

## 1. Enfoque
Delta mínimo sobre `dev` (integrado en el Grupo 0 de C-11): las dos etiquetas visibles ya dicen `PtsEnPint`. C-05 (a) las
envuelve en `t()` de `core/i18n.js` (creado por C-11), (b) reescribe la nota residual de `docs/database.md` que todavía
cita la sigla vieja, (c) sube `CACHE` del service worker porque cambia `app.js`, y (d) fija el procedimiento de búsqueda
del CA. Sin backend, sin esquema, sin endpoints.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `frontend/js/app.js` | js-view | `statBox(t('equipo.desglose.paint_pts', 'PtsEnPint'), …)` en la card "Desglose ofensivo" (l.835 en `dev`) y `rawRow(t('comparar.box.paint_pts', 'PtsEnPint'), …)` en Comparar (l.1168 en `dev`); importar `t` desde `./core/i18n.js` si C-11 no lo importó ya | RF-1, RF-5 |
| `frontend/sw.js` | sw | Subir `CACHE` al siguiente entero asignado al integrar (arquitectura §3.13) para que el `app.js` nuevo llegue a los clientes | RF-1 |
| `docs/database.md` | doc (cierre) | l.60: reescribir la descripción de `paint_pts` sin la sigla vieja: "Puntos en la pintura. Etiqueta de UI: `PtsEnPint` — la columna no se renombra (C-05 / Constitución 5)" | RF-2, RF-3, RF-4 |
| `docs/frontend.md` | doc (cierre) | Confirmar `PtsEnPint` en §Vista Equipo y §Vista Comparar (ya en `dev`) y agregar la regla "toda etiqueta de `paint_pts` es `PtsEnPint` (catálogo, exportaciones, traducciones)" | RF-1, RF-5 |

Matriz RF→archivo: RF-1 → `app.js`, `sw.js`, `docs/frontend.md` · RF-2 → `docs/database.md` (y ausencia de cambios en
`database.py`) · RF-3 → `docs/database.md` + verificación · RF-4 → `docs/database.md` · RF-5 → `app.js`, `docs/frontend.md`.

## 3. Backend — rutas y modelos
Sin cambios. `team_game_stats.paint_pts` (INTEGER DEFAULT 0) y las claves `paint_pts` de `GET /api/team/<team_code>` y
`GET /api/team/<code>` (`game_log[]`) se conservan.

## 4. Backend — lógica
Sin cambios.

## 5. Frontend — capa API
Sin cambios en `api.js`.

## 6. Frontend — UI
- **Dónde vive:** fase 1, antes de X-01: vista Equipo (card "Desglose ofensivo", render de `renderTeam` en `app.js`) y vista
  Comparar (box score FIBA, `rawRow`). Con X-01 pasan a `#/equipo/<code>/resumen` y `#/comparar/equipos` sin cambio de etiqueta.
- **Helpers reutilizados:** `statBox`, `rawRow` (existentes), `t(key, fallback)` de `core/i18n.js` (C-11, arquitectura §8).
- **Claves i18n** (convención `seccion.componente.texto`, §3.20): `equipo.desglose.paint_pts` y `comparar.box.paint_pts`,
  ambas con fallback `'PtsEnPint'`.
- **Estados:** sin cambios (loading/vacío/error existentes). Nulos: `dev` ya pasa `a.paint_pts` sin `|| 0` en Comparar; se
  conserva (CA-5).
- **Mobile 768 px / 360 px:** `PtsEnPint` (9 caracteres) entra en `.stat-label` (verificado en `dev` a 390 px: 135 px en una
  card de 159 px); se revisa a 360 px.

## 7. Navegación
Sin cambios.

## 8. Contratos de datos
Sin cambios.

## 9. Manejo de errores y offline
Sin errores nuevos. Offline: al cambiar `app.js`, subir `CACHE` en `sw.js` (la estrategia actual es cache-first sin guardar
respuestas nuevas; sin el bump el cliente seguiría viendo el `app.js` anterior).

## 10. Riesgos / decisiones
- **Procedimiento de búsqueda (CA-1)** — comando de referencia (Git Bash, desde la raíz del repo):
  `git grep -n -i -w "pep" -- frontend backend docs ':!backend/venv'` → debe devolver 0 líneas. Complemento en navegador:
  en la consola, `document.body.innerText.match(/\bpep\b/i)` → `null` en Equipo y Comparar.
- **Riesgo:** reintroducción por copia de textos viejos en T-05/T-06/F-21. Mitigación: regla en `docs/frontend.md` (RF-5)
  y la clave i18n única.
- **Desviaciones respecto de la arquitectura:** ninguna.
- **Dependencias técnicas:** `core/i18n.js` `t()` y la integración de `dev` (Grupo 0) de C-11 —
  [`../01-C-11-tratamiento-de-nulos/plan.md`](../01-C-11-tratamiento-de-nulos/plan.md).
- **Estimación:** S · 1–2 h (incluye verificación y docs).
