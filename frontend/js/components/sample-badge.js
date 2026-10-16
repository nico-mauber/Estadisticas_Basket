/**
 * Badge de confiabilidad de muestra — T-02. Devuelve HTML string; no monta nada
 * (lo usa `standard-panel.js`). Sin i18n: este proyecto no tiene helper `t()`.
 */
import { fmtNumber } from "../core/format.js";

const LEVEL_LABEL = { baja: "BAJA", media: "MEDIA", alta: "ALTA" };

// Simplificación documentada: el 1,5 % es el valor fijo de sample.lineup.rel_pct hoy;
// no se lee de /api/settings acá para no acoplar el badge a esa llamada.
const REL_PCT_LABEL = "1,5 %";

function _detalle(sample) {
  const parts = [];
  if (sample.possessions != null) parts.push(`${fmtNumber(sample.possessions, 1)} pos`);
  if (sample.games != null) parts.push(`${fmtNumber(sample.games, 0)} PJ`);
  if (sample.minutes != null) parts.push(`${fmtNumber(sample.minutes, 1)}'`);
  return parts.join(" · ");
}

function _tooltip(sample) {
  const unidad = sample.unit;
  const base = sample.min_source === "relativo"
    ? `Mínimo ${sample.min} ${unidad} (${REL_PCT_LABEL} de las posesiones del equipo)`
    : `Mínimo ${sample.min} ${unidad} (piso absoluto)`;
  return `${base} · alta desde ${sample.high}`;
}

export function sampleBadge(sample, { compact = false } = {}) {
  if (!sample) return "";
  if (sample.n === 0) {
    return `<span class="sample-badge sample-baja">Sin muestra</span>`;
  }
  const level = sample.level;
  const detalle = _detalle(sample);
  const label = `Muestra ${LEVEL_LABEL[level] ?? level}`;
  const text = compact ? label : (detalle ? `${label} · ${detalle}` : label);
  return `<span class="sample-badge sample-${level}" title="${_tooltip(sample)}">${text}</span>`;
}
