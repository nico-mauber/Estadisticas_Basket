// ── Jugadores similares (A-09) ───────────────────────────────────────────────
// Los jugadores de la competencia con el perfil más parecido al de uno de referencia: nueve dimensiones normalizadas con
// z-score dentro de la competencia y distancia euclidiana. Todo el cálculo es del servidor (`GET /api/similar/<id>`).
import { api } from "../api.js";
import { fmtNumber, PCT, DEC1, DEC2 } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _token = 0;

const POS = [["", "Todas"], ["misma", "Misma posición"], ["G", "Bases y escoltas (G)"], ["F", "Aleros y ala-pívots (F)"], ["C", "Pívots (C)"]];

function _val(dim, v) {
  if (v == null) return "—";
  if (dim.key === "zonas") return `${PCT(v[0])} · ${PCT(v[1])} · ${PCT(v[2])}`;
  return dim.fmt === "pct" ? PCT(v) : dim.fmt === "dec1" ? DEC1(v) : DEC2(v);
}

/** `opts`: `params` (contexto), `position`, `minMinutes`, `onChange({position, minMinutes})`, `onOpenPlayer(id)`. */
export async function renderSimilar(el, playerId, opts = {}) {
  if (!el) return;
  const token = ++_token;
  el.innerHTML = '<div class="card"><div class="card-title">Jugadores similares</div><p class="empty"><span class="spinner"></span>Buscando jugadores parecidos…</p></div>';
  const position = opts.position || "", minMinutes = opts.minMinutes ?? "";
  let d;
  try {
    d = await api.similar(playerId, { ...(opts.params || {}), position, min_minutes: minMinutes === "" ? null : minMinutes });
  } catch (e) {
    if (token !== _token) return;
    const msg = e instanceof TypeError || navigator.onLine === false ? "Sin conexión: la búsqueda necesita conexión." : e.message || "No se pudo calcular.";
    el.innerHTML = `<div class="card"><div class="card-title">Jugadores similares</div><p class="empty below-avg">${esc(msg)}</p></div>`;
    return;
  }
  if (token !== _token) return;
  const dims = d.dimensions.filter(x => x.used);
  const ex = d.excluded || {};
  const controls = `<div class="ld-controls">
    <label class="gp-lbl">Posición<select id="sm-pos" class="map-select">${POS.map(([v, l]) => `<option value="${v}"${v === position ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="gp-lbl">Mínimo de minutos<input id="sm-min" type="number" min="0" step="10" class="ld-min" value="${esc(minMinutes === "" ? d.filters.min_minutes : minMinutes)}"></label></div>`;
  const ref = d.reference;
  const rows = d.results.map((r, i) => `<tr><td class="ld-rank">${i + 1}.º</td>
    <td><a href="#" class="sm-player" data-pid="${esc(r.id)}">${esc(r.name)}</a><div class="td-muted">${esc(r.team_code || "")} · ${esc(r.position_group || "—")} · ${r.games} PJ · ${fmtNumber(r.minutes_pg, 1)} min</div></td>
    <td class="ld-val" title="Distancia ${fmtNumber(r.distance, 2)}">${fmtNumber(r.similarity, 0)}</td>
    <td class="td-muted">${esc(r.closest.map(x => x.label).join(", "))}</td><td class="td-muted">${esc(r.farthest.map(x => x.label).join(", "))}</td>
    ${dims.map(x => `<td class="td-muted">${_val(x, r.values[x.key])}</td>`).join("")}</tr>`).join("");
  el.innerHTML = `<div class="card"><div class="card-title">Jugadores similares a ${esc(ref.name)}</div>${controls}
    ${ref.low_sample ? '<p class="td-muted below-avg">La muestra del jugador de referencia es baja: el perfil puede ser poco estable.</p>' : ""}
    <p class="td-muted">${sampleBadge(ref.sample, { compact: true })} Población: ${d.population.size} jugadores de la competencia (${esc(d.population.criterion)}).
      Se descartaron ${ex.minutos || 0} por minutos, ${ex.posicion || 0} por posición y ${ex.perfil_incompleto || 0} por perfil incompleto.</p></div>
    <div class="card">${d.results.length ? `<div class="vs-table-wrap"><table class="ld-table sm-table"><thead><tr><th></th><th>Jugador</th><th title="100 · exp(−distancia)">Similitud</th><th>Se parece en</th><th>Difiere en</th>
      ${dims.map(x => `<th>${esc(x.label)}</th>`).join("")}</tr></thead>
      <tbody><tr class="sm-ref"><td></td><td><strong>${esc(ref.name)}</strong><div class="td-muted">referencia</div></td><td></td><td></td><td></td>${dims.map(x => `<td><strong>${_val(x, ref.values[x.key])}</strong></td>`).join("")}</tr>${rows}</tbody></table></div>`
      : '<p class="empty">No hay jugadores comparables con estos filtros.</p>'}
      <p class="td-muted sm-method">Método: nueve dimensiones (${esc(d.dimensions.map(x => x.label).join(", "))}), cada una normalizada con z-score dentro de la competencia; distancia euclidiana con el mismo peso por dimensión (el reparto de tiro cuenta como una); similitud = 100 · exp(−distancia). Solo se comparan las dimensiones disponibles en ambos jugadores (al menos ${d.method.min_dims}). Es un cálculo, no una opinión.</p></div>`;
  const change = patch => opts.onChange?.({ position, minMinutes, ...patch });
  el.querySelector("#sm-pos").addEventListener("change", e => change({ position: e.target.value }));
  el.querySelector("#sm-min").addEventListener("change", e => change({ minMinutes: e.target.value === "" ? "" : Number(e.target.value) }));
  el.querySelectorAll(".sm-player").forEach(a => a.addEventListener("click", ev => { ev.preventDefault(); opts.onOpenPlayer?.(a.dataset.pid); }));
}

export function destroySimilar() { _token++; }
