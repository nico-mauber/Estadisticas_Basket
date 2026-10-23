// ── Formato numérico y nulos (C-11) ─────────────────────────────────────────
// Único punto de formateo de números de la UI: coma decimal es-UY ("1,09", "60,0%")
// (DA-36). Un valor nulo —null, undefined, NaN o ±Infinity— se muestra siempre "—",
// nunca 0: el 0 real sí se muestra como número.

const _formatters = new Map();
function _nf(decimals) {
  if (!_formatters.has(decimals)) {
    _formatters.set(decimals, new Intl.NumberFormat("es-UY", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: false,
    }));
  }
  return _formatters.get(decimals);
}

export const isNull = v => v == null || !Number.isFinite(Number(v));

// Comparador único de tablas ordenables: el nulo se APARTA de la comparación en vez de
// recibir un valor extremo, por eso su posición no depende de `dir` — queda al final
// tanto ascendente como descendente (C-11 / T-06 RF-2). Movido desde app.js.
export function cmpNullsLast(av, bv, dir) {
  const _n = v => v == null || (typeof v === "number" && isNaN(v));
  const an = _n(av), bn = _n(bv);
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof av === "string" || typeof bv === "string")
    return dir * String(av).localeCompare(String(bv), "es");
  return dir * (av - bv);
}

export function fmtNumber(v, decimals = 2) {
  return isNull(v) ? "—" : _nf(decimals).format(Number(v));
}

export const PCT  = v => isNull(v) ? "—" : fmtNumber(v * 100, 1) + "%";
export const PCT0 = v => isNull(v) ? "—" : fmtNumber(v * 100, 0) + "%";
export const DEC1 = v => fmtNumber(v, 1);
export const DEC2 = v => fmtNumber(v, 2);

// Etiquetas de los códigos de razón que emite hoy el backend (`null_reasons`,
// docs/api.md). Un código sin etiqueta cae en el texto genérico.
export const NULL_REASON_LABELS = {
  sin_intentos:  "Sin intentos: no se puede calcular",
  sin_perdidas:  "Sin pérdidas: el cociente no está definido",
  dnp:           "No jugó (DNP)",
  estimacion_invalida: "Estimación no válida: la muestra de minutos es demasiado chica",
  no_registrado: "La competencia no registra este dato. Si cambió, reimportá sus partidos",
  sin_universo:  "Elegí una competencia para ver el promedio de liga",
  sin_datos:     "Sin datos en la selección",
  sin_pbp:       "Sin play-by-play en los partidos de la selección",
  no_aplica:     "La métrica no aplica a esta entidad",
  no_disponible: "Todavía no disponible: se habilita con una versión posterior",
  requiere_posesiones: "Se calcula con el motor de posesiones (en desarrollo)",
  sin_asistencias: "Sin asistencias en la selección",
};

// "—" neutro con la razón en el title (se ve al pasar el cursor o con tap largo).
export function nullDisplay(reason) {
  const title = NULL_REASON_LABELS[reason] ?? "Sin dato";
  return `<span class="null-val" title="${title}">—</span>`;
}

// Valor formateado, o "—" con su razón si es nulo.
export function fmtOrNull(v, fmt, reason) {
  return isNull(v) ? nullDisplay(reason) : fmt(v);
}

// ── Conjunto estándar de métricas (T-05) ────────────────────────────────────
// Signo explícito "+"/"−" (carácter Unicode U+2212, no el guion "-", es-UY) + magnitud.
export function fmtSigned(v, decimals = 2) {
  if (isNull(v)) return "—";
  const n = Number(v);
  const sign = n < 0 ? "−" : "+";
  return sign + fmtNumber(Math.abs(n), decimals);
}

// Importa `metricDef` de `catalog.js` (catalog.js solo importa api.js: sin ciclo).
import { metricDef } from "./catalog.js";

export function fmtMetric(key, value) {
  if (isNull(value)) return "—";
  const def = metricDef(key);
  const fmt = def?.fmt;
  switch (fmt) {
    case "pct":         return PCT(value);
    case "dec1":        return DEC1(value);
    case "dec2":        return DEC2(value);
    case "int":         return fmtNumber(value, 0);
    case "signed_int":  return fmtSigned(value, 0);
    case "signed_dec2": return fmtSigned(value, 2);
    default:            return fmtNumber(value, 2);
  }
}
