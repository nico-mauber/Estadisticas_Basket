# Paso 3 — TASKS

> Objetivo: descomponer el plan en tareas atómicas, ordenadas y verificables. Cada tarea es un commit pequeño con criterio de "hecho" objetivo.

## Entrada
- `sdd/specs/NN-<feature>/plan.md` (gate del Paso 2 pasado).
- `sdd/specs/NN-<feature>/spec.md` (para trazar CA).

## Salida
Archivo `sdd/specs/NN-<feature>/tasks.md`:

```markdown
# Tasks — Feature NN: <nombre>

## Orden de ejecución
Grupos en secuencia (un grupo depende del anterior). Dentro de un grupo, tareas paralelizables marcadas [P].

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · <acción concreta> · archivo(s) · cubre RF-x · Done: <verificación>
- [ ] T-A2 [P] · …

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · …

### Grupo C — Frontend: api.js
- [ ] T-C1 · …

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · …

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · …

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · Si tocó esquema: `python backend/database.py` corre 2 veces seguidas sin error (upgrade_db idempotente)
- [ ] T-F3 · Cada endpoint nuevo/tocado probado con curl o navegador; response shape verificado
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer la feature
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅

## Matriz de cobertura
Tabla: CA del spec → tareas que lo satisfacen. Toda CA debe tener ≥1 tarea.

## Dependencias externas
Precondiciones fuera de la feature (ej: variable de entorno nueva en Render, dato semilla en DB ya presente, Playwright instalado si se toca fetch de FIBA).
```

## Reglas de granularidad
1. **Atómica**: una tarea = un cambio coherente y testeable en aislamiento. Si una tarea necesita "y" para describirse, probablemente son dos.
2. **Verificable**: cada tarea tiene un `Done:` observable (arranca sin error, endpoint devuelve X, render Y aparece, CA-n pasa).
3. **Ordenada por dependencia**: esquema/modelos antes que lógica; lógica antes que rutas; backend antes que `api.js`; `api.js` antes que UI; UI antes que pulido de errores/offline.
4. **Trazable**: cada tarea cita el/los RF que ayuda a cumplir; el grupo F traza los CA.
5. **[P] solo si independiente**: sin estado compartido ni dependencia de orden.

## Reglas de contenido
- Ninguna tarea introduce endpoint/columna fuera de docs/ sin marcarlo NUEVO (heredado del gate del Paso 2).
- El grupo F es obligatorio y cierra la feature con verificación manual (no hay test suite automatizado en el proyecto).
- Si una tarea revela un hueco en el plan → no improvisar: anotar y, si es de alcance, volver al Paso 1/2.

## Gate de salida
- [ ] Matriz CA→tareas completa (0 CA sin cubrir).
- [ ] Toda tarea tiene `Done:` objetivo.
- [ ] Orden respeta dependencias (esquema → lógica → api.js → UI → pulido → verificación).
- [ ] Grupo F presente con los 5 checks.
- [ ] Dependencias externas listadas y agendadas antes de las tareas que las necesitan.

Al pasar el gate → avanzar a `04-implement.md`.
