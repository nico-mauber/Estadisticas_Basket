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
  no_registrado: "La competencia no registra este dato. Si cambió, reimportá sus partidos",
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
