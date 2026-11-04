// ── Enfrentamiento directo (F-20) ────────────────────────────────────────────
// Pestaña de Equipo: se elige un rival y se ve el historial entre ambos (el mismo de Preparar), los promedios del equipo
// contra ese rival frente a sus promedios generales y las diferencias más marcadas, con enlaces al informe de Preparar.
import { api } from "../api.js";
import { fmtNumber, fmtSigned, PCT, DEC1, DEC2 } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";
import { renderPlanItem } from "./game-plan.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _token = 0;

const _val = (fmt, v) => v == null ? "—" : fmt === "pct" ? PCT(v) : fmt === "dec1" ? DEC1(v) : fmt === "signed_dec2" ? fmtSigned(v, 2) : DEC2(v);
const _delta = (fmt, v) => v == null ? "—" : fmt === "pct" ? fmtSigned(v * 100, 1) + " pp" : fmt === "dec1" ? fmtSigned(v, 1) : fmtSigned(v, 2);
const _fmtDate = d => { const p = String(d || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (d || "—"); };

function _history(h, teamName, rivalName) {
  if (!h.games.length) return '<p class="empty">Sin historial entre estos equipos.</p>';
  const rows = h.games.map(g => {
    const won = g.winner === h.team_a, lost = g.winner === h.team_b;
    return `<tr><td>${esc(_fmtDate(g.date))}</td><td>${g.venue === "L" ? "Local" : "Visitante"}</td>
      <td class="vs-score">${g.score_a ?? "—"} – ${g.score_b ?? "—"}</td>
      <td class="${won ? "above-avg" : lost ? "below-avg" : ""}">${won ? "Ganó " + esc(teamName) : lost ? "Ganó " + esc(rivalName) : "—"}</td>
      <td class="td-muted">${esc(g.competition_label || "")}</td></tr>`;
  }).join("");
  return `<p class="td-muted">Récord ${esc(teamName)} ${h.record.wins_a} – ${h.record.wins_b} ${esc(rivalName)}</p>
    <div class="vs-table-wrap"><table class="vs-table"><thead><tr><th>Fecha</th><th>Sede</th><th>Marcador</th><th>Resultado</th><th>Competencia</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function _comparison(d, rivalName) {
  const rows = d.rows.map(r => {
    const good = r.delta == null ? "" : r.delta > 0 ? "above-avg" : r.delta < 0 ? "below-avg" : "";
    return `<tr><td>${esc(r.label)}</td><td>${_val(r.fmt, r.vs)}</td><td>${_val(r.fmt, r.general)}</td>
      <td class="${good}" title="Diferencia aritmética: ${_delta(r.fmt, r.delta_raw)} (contra el rival − general)">${_delta(r.fmt, r.delta)}</td></tr>`;
  }).join("");
  return `<div class="vs-table-wrap"><table class="vs-table"><thead><tr><th>Métrica</th><th>Contra ${esc(rivalName)}</th><th>General</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="td-muted">Δ con signo: positivo es mejor que su promedio general, también en las métricas de "menos es mejor". General = todos los partidos de la selección, incluidos los de este rival.</p>`;
}

/** `opts`: `params` (contexto de la vista), `rival` (código ya elegido), `onRival(code)`, `onOpenPrepare(team, rival, focus)`. */
export async function renderVersus(el, teamCode, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const params = { competition: opts.params?.competition ?? null, last: opts.params?.last ?? null, ...(opts.params || {}) };
  delete params.opponent;
  el.innerHTML = '<div class="card vs-card"><div class="card-title">Enfrentamiento directo</div><p class="empty"><span class="spinner"></span>Cargando rivales…</p></div>';
  let list;
  try {
    list = await api.rivalComparison({ team: teamCode, ...params });
  } catch (e) {
    if (token !== _token) return;
    const offline = e instanceof TypeError || navigator.onLine === false;
    el.innerHTML = `<div class="card vs-card"><div class="card-title">Enfrentamiento directo</div><p class="empty below-avg">${offline ? "Sin conexión: el historial necesita conexión." : "No se pudo cargar el historial."}</p></div>`;
    return;
  }
  if (token !== _token) return;
  const rivals = list.rivals || [];
  if (!rivals.length) {
    el.innerHTML = '<div class="card vs-card"><div class="card-title">Enfrentamiento directo</div><p class="empty">Este equipo todavía no enfrentó a ningún rival con partidos importados.</p></div>';
    return;
  }
  let rival = opts.rival && opts.rival !== teamCode ? opts.rival : "";
  el.innerHTML = `<div class="card vs-card"><div class="card-title">Enfrentamiento directo</div>
    <label class="gp-lbl">Rival<select id="vs-rival" class="map-select" aria-label="Rival">
      <option value="">— Elegí un rival —</option>
      ${rivals.map(r => `<option value="${esc(r.code)}"${r.code === rival ? " selected" : ""}>${esc(r.name)} (${r.games} ${r.games === 1 ? "partido" : "partidos"})</option>`).join("")}
    </select></label>
    <div id="vs-body"></div></div>`;
  const body = el.querySelector("#vs-body");
  const sel = el.querySelector("#vs-rival");

  async function load() {
    const t = ++_token;
    if (!rival) { body.innerHTML = '<p class="td-muted">Elegí un rival para ver el historial.</p>'; return; }
    body.innerHTML = '<p class="empty"><span class="spinner"></span>Calculando…</p>';
    let cmp, h2h = null;
    try {
      [cmp, h2h] = await Promise.all([
        api.rivalComparison({ team: teamCode, rival, ...params }),
        api.h2h({ a: teamCode, b: rival, competition: params.competition }).catch(() => null),
      ]);
    } catch (e) {
      if (t !== _token) return;
      body.innerHTML = `<p class="empty below-avg">${esc(e instanceof TypeError ? "Sin conexión: el historial necesita conexión." : e.message || "No se pudo cargar el historial.")}</p>`;
      return;
    }
    if (t !== _token) return;
    const rivalName = rivals.find(r => r.code === rival)?.name || rival;
    const teamName = h2h ? (opts.teamName || teamCode) : teamCode;
    let html = `<h4 class="tp-h">Historial</h4>${h2h ? _history(h2h, opts.teamName || teamCode, rivalName) : '<p class="empty below-avg">No se pudo cargar el historial.</p>'}`;
    if (cmp.reason === "sin_historial") {
      html += '<p class="empty">Sin historial entre estos equipos.</p>';
    } else {
      html += `<h4 class="tp-h">Promedios contra ${esc(rivalName)} y generales ${sampleBadge(cmp.vs.sample, { compact: true })}</h4>`;
      if (cmp.vs.sample?.level === "baja") html += `<p class="td-muted below-avg">Muestra baja contra este rival (${fmtNumber(cmp.vs.games, 0)} ${cmp.vs.games === 1 ? "partido" : "partidos"}): las diferencias pueden ser azar.</p>`;
      html += _comparison(cmp, rivalName);
      html += '<h4 class="tp-h">Diferencias más marcadas</h4>';
      html += cmp.items.length ? `<ul class="gp-list">${cmp.items.map(renderPlanItem).join("")}</ul>` : '<p class="empty">Sin diferencias destacables.</p>';
    }
    html += `<div class="vs-links"><button type="button" class="btn btn-sm" id="vs-prepare">Ver informe completo (Preparar)</button>
      <button type="button" class="btn btn-ghost btn-sm" id="vs-matchups">Ver emparejamientos</button></div>`;
    body.innerHTML = html;
    body.querySelector("#vs-prepare")?.addEventListener("click", () => opts.onOpenPrepare?.(teamCode, rival, null));
    body.querySelector("#vs-matchups")?.addEventListener("click", () => opts.onOpenPrepare?.(teamCode, rival, "matchups"));
  }

  sel.addEventListener("change", () => { rival = sel.value; opts.onRival?.(rival); load(); });
  await load();
}

export function destroyVersus() { _token++; }
