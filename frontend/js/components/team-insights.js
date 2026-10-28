// ── Análisis del equipo (fortalezas y debilidades contra la competencia) ─────
// Reglas fijas sobre el percentil de cada métrica entre los equipos de la competencia (misma idea que "Ventajas y
// amenazas" de Preparar). No es un modelo: cada frase dice qué mide la métrica y en qué puesto está el equipo.
import { api } from "../api.js";
import { fmtNumber, PCT, DEC2 } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _token = 0;

const fmtValue = (fmt, v) => (fmt === "pct" ? PCT(v) : fmt === "dec1" ? fmtNumber(v, 1) : DEC2(v));

function _list(items, kind) {
  if (!items.length) {
    return `<p class="td-muted">${kind === "up" ? "Ninguna métrica destaca por encima del resto de la competencia." : "Ninguna métrica queda por debajo del resto de la competencia."}</p>`;
  }
  return `<ul class="ti-list">${items.map(i => `<li class="ti-item ti-${kind}">
    <span class="ti-pct" title="Percentil entre los equipos de la competencia">P${Math.round(i.percentile)}</span>
    <span class="ti-text"><strong>${esc(i.label)}</strong> ${esc(fmtValue(i.fmt, i.value))} · ${esc(i.text)}</span></li>`).join("")}</ul>`;
}

// `opts.params`: competition, last, contexto de la vista
export async function renderTeamInsights(el, teamCode, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const shell = body => { el.innerHTML = `<div class="card ti-card"><div class="card-title">Análisis del equipo</div>${body}</div>`; };
  shell('<p class="empty"><span class="spinner"></span>Analizando…</p>');
  const params = { competition: opts.params?.competition ?? null, last: opts.params?.last ?? null };
  let d;
  try {
    d = await api.teamInsights(teamCode, params);
  } catch (e) {
    if (token !== _token) return;
    shell(`<p class="empty">${esc(e.code === "parametro_invalido" ? "Elegí una competencia para ver el análisis." : "No se pudo calcular el análisis.")}</p>`);
    return;
  }
  if (token !== _token) return;
  if (!d.evaluated) { shell('<p class="empty">Sin datos suficientes para comparar con la competencia.</p>'); return; }
  const warn = d.low_sample ? `<p class="td-muted below-avg">Muestra baja (${d.games} partidos): las conclusiones pueden cambiar.</p>` : "";
  shell(`<p class="td-muted">Cada métrica se compara con los otros ${Math.max(0, d.teams - 1)} equipos de la competencia (P = percentil; 100 es el mejor). Son reglas automáticas, no una opinión.</p>${warn}
    <div class="ti-cols"><div><h4 class="tp-h">Fortalezas</h4>${_list(d.strengths, "up")}</div>
    <div><h4 class="tp-h">Para mejorar</h4>${_list(d.weaknesses, "down")}</div></div>`);
}

export function destroyTeamInsights() { _token++; }
