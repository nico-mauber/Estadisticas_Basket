# Paso 1 — SPECIFY

> Objetivo: convertir una feature/cambio en un **spec ejecutable**: qué se construye y por qué, sin decir cómo. Cero código, cero nombres de archivo salvo los ya fijados por la Constitución.

## Entrada
- La feature a especificar (nombre descriptivo, ej. "shot chart por zonas", "borrado en cascada de partidos").
- Los docs de insumo relevantes según la feature: `docs/architecture.md`, `docs/database.md`, `docs/api.md`, `docs/metrics.md`, `docs/frontend.md`, `docs/deployment.md`.
- Siempre: `docs/database.md` (esquema actual) y `docs/api.md` (endpoints actuales) — para no duplicar ni chocar con lo existente.

## Salida
Archivo `sdd/specs/NN-<feature>/spec.md` con esta estructura EXACTA:

```markdown
# Spec — Feature NN: <nombre>

## 1. Objetivo
Una frase: qué capacidad entrega esta feature.

## 2. Fuentes (trazabilidad)
Lista de archivos de docs/ consumidos, con las secciones concretas usadas.

## 3. Historias de usuario
US-1 … US-n. Formato: "Como <rol>, quiero <acción>, para <valor>."
Rol casi siempre: usuario de la app (entrenador/analista FUBB).

## 4. Requisitos funcionales
RF-1 … RF-n. Cada uno:
- Enunciado imperativo y verificable ("El sistema DEBE…").
- Trazado: (US-x) + (doc §y).
- Reglas de negocio exactas (fórmulas de métricas, límites, formatos) copiadas de docs/, no reinterpretadas.

## 5. Requisitos de datos / API
Tablas SQLite y endpoints Flask que la feature consume o crea — SOLO los que existen en docs/database.md y docs/api.md, o nuevos marcados explícitamente como "NUEVO" con justificación (irán a esos docs al cerrar la feature).
Por cada tabla/columna: nombre, tipo, default, si requiere `upgrade_db()`.
Por cada endpoint: método+ruta, request/response, código de error.

## 6. Estados de UI
Por cada vista/componente de la feature: loading, vacío, error, sin conexión (service worker), éxito.
Textos en español COPIADOS literal de docs (no inventar copy) o marcados como nuevo copy a agregar a docs/frontend.md.

## 7. Criterios de aceptación
CA-1 … CA-n. Verificables por observación del comportamiento (no por implementación).
Formato Given/When/Then. Estos son el gate del Paso 4 — se verifican a mano (curl/navegador), no hay test suite.

## 8. Fuera de alcance
Qué NO entra en esta feature (relacionado pero futuro).

## 9. Ambigüedades
[NEEDS CLARIFICATION: …] por cada punto que docs/ no resuelve.
Si la lista NO está vacía, el spec NO pasa el gate hasta resolverla (preguntar al humano o decidir con fundamento y registrar la decisión aquí).
```

## Reglas
1. **Trazabilidad total**: cada RF y CA apunta a una historia y a una sección de docs/. Si algo no tiene fuente en docs/ → va a §9, no al cuerpo.
2. **Prohibido diseñar**: nada de nombres de funciones JS, rutas de archivo, ni estructura de código. Eso es Paso 2.
3. **Copiar, no parafrasear**, las reglas duras: fórmulas de métricas (`docs/metrics.md`), restricciones únicas y columnas de tablas (`docs/database.md`), formatos de request/response y códigos de error (`docs/api.md`), textos de UI (`docs/frontend.md`).
4. **Reusar la Constitución**: no re-especificar stack ni invariantes; darlos por dados.

## Gate de salida (todos deben cumplirse)
- [ ] Cada RF es verificable y trazable (US + doc§).
- [ ] §5 solo referencia tablas/endpoints existentes en docs/, o nuevos marcados explícitamente.
- [ ] Fórmulas de métricas (si aplica) idénticas a docs/metrics.md.
- [ ] Estados de UI cubren loading/vacío/error/sin conexión con copy literal.
- [ ] §9 vacía (o cada ambigüedad tiene decisión registrada con justificación).
- [ ] Fuera de alcance explícito para no arrastrar scope de otras features.

Al pasar el gate → avanzar a `02-plan.md`.
