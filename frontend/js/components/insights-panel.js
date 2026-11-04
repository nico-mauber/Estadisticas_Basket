// ── Insights automáticos (A-10) ──────────────────────────────────────────────
// Entre 3 y 5 frases de plantilla fija sobre las métricas con percentil extremo (≤ 10 o ≥ 90) de un equipo o un jugador.
// El texto, el percentil, el valor y el promedio salen del servidor y son los de la ficha de la misma métrica.
import { api } from "../api.js";
import { fmtNumber } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _token = 0;

const REASONS = {
  muestra_baja: "Muestra insuficiente: todavía no se generan insights para esta selección.",
  contexto_no_comparable: "Este filtro no permite comparar con la competencia.",
  sin_universo: "Elegí una competencia para ver los insights.",
  poblacion_insuficiente: "La competencia no tiene suficientes entidades para comparar.",
  sin_datos: "No hay datos en esta selección.",
  sin_extremos: "Sin valores extremos: ninguna métrica queda en el 10 % de arriba ni en el de abajo.",
};

/** `opts.params`: contexto de la vista (competition, last, venue, …). `entity`: "team" | "player". */
export async function renderInsights(el, entity, id, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const shell = body => { el.innerHTML = `<div class="card ins-card"><div class="card-title">Insights</div>${body}</div>`; };
  shell('<p class="empty"><span class="spinner"></span>Generando insights…</p>');
  let d;
  try {
    d = await api.insights({ entity, id, ...(opts.params || {}) });
  } catch (e) {
    if (token !== _token) return;
    shell(`<p class="empty below-avg">${esc(e instanceof TypeError || navigator.onLine === false ? "Sin conexión: los insights necesitan conexión." : "No se pudieron generar los insights.")}</p>`);
    return;
  }
  if (token !== _token) return;
  if (d.reason && !d.items.length) {
    shell(`<p class="empty">${esc(REASONS[d.reason] || "Sin insights para esta selección.")}</p>${d.sample ? `<p>${sampleBadge(d.sample, { compact: true })}</p>` : ""}`);
    return;
  }
  shell(`<p class="td-muted">${esc(d.context?.label || "")} · ${fmtNumber(d.context?.games_used ?? 0, 0)} partidos · ${sampleBadge(d.sample, { compact: true })}</p>
    <ul class="ins-list">${d.items.map(i => `<li class="ins-item ${i.good === true ? "ins-good" : i.good === false ? "ins-bad" : "ins-neutral"}" title="Puesto ${i.rank} de ${i.rank_total} · percentil ${i.percentile}">
      <span class="ins-ico" aria-hidden="true">${i.tone === "alto" ? "▲" : "▼"}</span><span class="ins-text">${esc(i.text)}</span></li>`).join("")}</ul>
    <p class="td-muted">Reglas automáticas sobre el percentil de cada métrica en la competencia (arriba de ${d.rule.high_pct} o abajo de ${d.rule.low_pct}); no es una opinión.</p>`);
}

export function destroyInsights() { _token++; }
