// ── Escala de color por percentil (T-01) ────────────────────────────────────
// Rojo en 0, gris en 50, verde en 100; interpolación lineal en RGB por tramo.
// El texto "pNN" acompaña siempre al color (accesibilidad): el color no es el
// único portador. Un percentil nulo o una métrica neutral no se pinta.

export const PCT_ANCHORS = [
  [0,   [239, 68, 68]],   // #ef4444
  [50,  [139, 148, 158]], // #8b949e
  [100, [34, 197, 94]],   // #22c55e
];

function _lerp(a, b, t) { return Math.round(a + (b - a) * t); }

export function percentileColor(p) {
  if (p == null) return null;
  const v = Math.max(0, Math.min(100, Number(p)));
  for (let i = 1; i < PCT_ANCHORS.length; i++) {
    const [p0, c0] = PCT_ANCHORS[i - 1];
    const [p1, c1] = PCT_ANCHORS[i];
    if (v <= p1) {
      const t = p1 === p0 ? 0 : (v - p0) / (p1 - p0);
      const r = _lerp(c0[0], c1[0], t);
      const g = _lerp(c0[1], c1[1], t);
      const b = _lerp(c0[2], c1[2], t);
      return `rgb(${r},${g},${b})`;
    }
  }
  const last = PCT_ANCHORS[PCT_ANCHORS.length - 1][1];
  return `rgb(${last[0]},${last[1]},${last[2]})`;
}

export function percentileBg(p, alpha = 0.18) {
  const rgb = percentileColor(p);
  if (rgb == null) return null;
  return rgb.replace("rgb(", "rgba(").replace(")", `,${alpha})`);
}
