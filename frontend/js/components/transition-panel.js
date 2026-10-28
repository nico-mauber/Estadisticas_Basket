// ── Transición y contraataque (A-03) ─────────────────────────────────────────
// Reparto de las posesiones por velocidad (transición / ataque temprano / media cancha), origen del contraataque,
// finalización, corredores y bloque defensivo. Una llamada por lado; el lado va en `?tside=` de la URL. En modo
// jugador solo hay ataque: posesiones que finaliza por tipo y transiciones que inicia.
import { api } from "../api.js";
import { fmtNumber, PCT, PCT0, DEC1, DEC2, nullDisplay, isNull } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let _token = 0;   // descarta respuestas viejas al cambiar de entidad, lado o contexto

function _sideFromUrl() {
  try { return new URL(location.href).searchParams.get("tside") === "defensa" ? "defensa" : "ataque"; } catch { return "ataque"; }
}
function _setSideUrl(side) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("tside", side);
    history.replaceState(history.state, "", url);
  } catch { /* la URL no se pudo actualizar */ }
}

const val = (m, fmt) => (!m || isNull(m.value) ? nullDisplay(m?.reason || "sin_intentos") : fmt(m.value));
const low = o => o?.sample?.level === "baja";
const lowTag = o => (low(o) ? ` <span class="sample-badge sample-baja" title="${esc(`Muestra baja: mínimo ${o.sample.min} posesiones`)}">baja</span>` : "");
const table = (head, rows, cls = "") => `<div class="dt-table-wrap"><table class="search-table of-table ${cls}">
  <thead><tr>${head.map((h, i) => `<th${i === 0 ? ' class="of-origin"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.join("")}</tbody></table></div>`;
const stat = (label, value, sub = "") => `<div class="tp-stat"><em>${esc(label)}</em><strong>${value}</strong>${sub ? `<span>${sub}</span>` : ""}</div>`;
const sec = (title, body) => `<h4 class="tp-h">${esc(title)}</h4>${body}`;

function _typesTable(d, mode) {
  const def = d.side === "defensa";
  const head = def
    ? ["Tipo (rival)", "Posesiones", "%", "PPP conced.", "eFG% conced.", "TO% forzado", "FT Rate conced.", "Duración"]
    : ["Tipo", "Posesiones", "%", "PPP", "eFG%", "TO%", "FT Rate", "Duración", "Seg. al 1.er tiro"];
  const rows = d.types.map(t => {
    const m = t.metrics || {};
    const cells = mode === "player"
      ? `<td>${val(m.ppp, DEC2)}</td><td>${val(m.efg_pct, PCT)}</td>`
      : `<td>${val(m.ppp, DEC2)}</td><td>${val(m.efg_pct, PCT)}</td><td>${val(m.to_pct, PCT)}</td><td>${val(m.ft_rate, PCT)}</td>
         <td>${val(m.duration_avg, v => `${DEC1(v)} s`)}</td>${def ? "" : `<td>${val(m.first_shot_secs, v => `${DEC1(v)} s`)}</td>`}`;
    return `<tr class="${low(t) ? "of-low" : ""}"><td class="of-origin">${esc(t.label)}</td>
      <td>${fmtNumber(t.possessions, 0)}${lowTag(t)}</td><td>${isNull(t.share) ? "—" : PCT(t.share)}</td>${cells}</tr>`;
  });
  const h = mode === "player" ? ["Tipo que finaliza", "Posesiones", "%", "PPP", "eFG%"] : head;
  return table(h, rows);
}

function _highlights(d) {
  const tr = d.types.find(t => t.key === "transicion");
  const diff = d.ppp_diff?.transicion_vs_media_cancha;
  const freq = stat(d.side === "defensa" ? "Transiciones del rival" : "Frecuencia de transición", isNull(tr?.share) ? "—" : PCT(tr.share),
    `${fmtNumber(tr?.possessions ?? 0, 0)} de ${fmtNumber(d.summary.classified, 0)} posesiones`);
  const dv = stat("PPP transición − media cancha", val(diff, v => `${v > 0 ? "+" : ""}${DEC2(v)}`));
  return `<div class="tp-stats">${freq}${dv}</div>`;
}

function _attack(d) {
  const fs = d.first_shot, dr = d.dreb_to_transition, pl = d.players;
  const origin = table(["Origen del contraataque", "Transiciones", "%", "PPP", "% del origen que corre"], d.origin_of_transition.map(o =>
    `<tr><td class="of-origin">${esc(o.label)}</td><td>${fmtNumber(o.transitions, 0)}</td><td>${isNull(o.share) ? "—" : PCT(o.share)}</td>
     <td>${val(o.ppp, DEC2)}</td><td>${val(o.origin_runs_share, PCT)}</td></tr>`));
  const finish = table(["Finalización en transición", "Posesiones", "%", "Puntos", "PPP"], d.finish_in_transition.map(o =>
    `<tr><td class="of-origin">${esc(o.label)}</td><td>${fmtNumber(o.possessions, 0)}</td><td>${isNull(o.share) ? "—" : PCT(o.share)}</td>
     <td>${fmtNumber(o.pts, 0)}</td><td>${val(o.ppp, DEC2)}</td></tr>`));
  const max = Math.max(1, ...fs.distribution.map(b => b.possessions));
  const hist = `<div class="tp-hist">${fs.distribution.map(b => `<div><span style="height:${Math.round(b.possessions / max * 100)}%"></span><em>${esc(b.label)}</em><b>${b.possessions}</b></div>`).join("")}</div>
    <p class="td-muted">Promedio ${val(fs.mean, v => `${DEC1(v)} s`)} sobre ${fmtNumber(fs.possessions, 0)} posesiones con tiro; ${fmtNumber(fs.without_shot, 0)} sin tiro (pérdida o falta).</p>`;
  const rebounds = `<div class="tp-stats">${stat("Rebotes defensivos que corren", val(dr.share, PCT), `${dr.to_transition} de ${dr.defensive_rebounds}`)}
    ${stat("De esas transiciones, terminan en anotación", val(dr.scored_share, PCT), `${dr.scored} de ${dr.to_transition}`)}</div>`;
  const runners = pl.rows.length
    ? table(["Jugador", "Iniciadas", "Finalizadas", "PPP personal", "Asist. en transición"], pl.rows.map(r =>
      `<tr class="${low(r) ? "of-low" : ""}"><td class="of-origin">${esc(r.name)}</td><td>${r.initiated}</td><td>${r.finished}${lowTag(r)}</td>
       <td>${val(r.ppp_personal, DEC2)}</td><td>${r.assists_in_transition}</td></tr>`))
      + `<p class="td-muted">Iniciador identificado en ${pl.coverage.initiator_identified} de ${pl.coverage.transitions} transiciones.</p>`
    : '<p class="empty">Sin transiciones en esta selección.</p>';
  const pass = `<p class="td-muted" title="${esc(d.pass_out.note)}">Primer pase de salida: ${nullDisplay(d.pass_out.reason)} · ${esc(d.pass_out.note)}</p>`;
  const fb = d.reconcile_fastbreak;
  const fbRows = fb.games.map(g => `<tr><td>${esc(g.game_id)}</td><td>${g.reconstructed}</td><td>${g.official ?? "—"}</td><td>${g.diff ?? "—"}</td></tr>`);
  const recon = `<details class="tp-recon"><summary>Contraataque oficial de FIBA</summary>
    ${fbRows.length ? table(["Partido", "Reconstruido (pts)", "Oficial (pts)", "Diferencia"], fbRows) : '<p class="td-muted">Sin partidos con ingesta actual.</p>'}
    <p class="td-muted">${esc(fb.note)}${fb.excluded.length ? ` ${fb.excluded.length} partidos sin dato oficial confiable.` : ""}</p></details>`;
  return sec("Origen del contraataque", origin) + sec("Finalización en transición", finish) + sec("Segundos hasta el primer tiro", hist)
    + sec("Del rebote defensivo a la transición", rebounds) + sec("Jugadores que más corren", runners + pass) + recon;
}

function _defense(d) {
  const o = d.own_turnovers_to_transition, b = d.balance;
  const stats = `<div class="tp-stats">
    ${stat("Transiciones concedidas cada 100 posesiones", val(d.conceded_per100, DEC1), `${d.conceded_per100.transitions} transiciones`)}
    ${stat("Pérdidas propias que el rival corre", val(o.share, PCT), `${o.followed_by_transition} de ${o.own_turnovers}`)}
    ${stat("…y terminan en anotación", val(o.scored_share, PCT), `${o.followed_by_scored} de ${o.followed_by_transition}`)}
    ${stat("Balance defensivo: tiros fallados que el rival convierte en transición", val(b.share, PCT), `${b.rival_scored_transitions} de ${b.fg_misses} · ${val(b.per100_possessions, DEC1)} cada 100 pos.`)}</div>`;
  const origin = table(["Origen de la transición concedida", "Transiciones", "%", "PPP conced."], d.conceded_by_origin.map(r =>
    `<tr><td class="of-origin">${esc(r.label)}</td><td>${fmtNumber(r.transitions, 0)}</td><td>${isNull(r.share) ? "—" : PCT(r.share)}</td><td>${val(r.ppp, DEC2)}</td></tr>`));
  return sec("Defensa de transición", stats) + origin;
}

function _legend(d) {
  const s = d.summary, u = s.unclassified || {};
  const parts = Object.entries(u).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${{ incompleta: "incompletas", sin_accion: "sin acción", reloj_no_derivable: "sin reloj" }[k] || k}`);
  if (d.side === undefined || d.runner) return `<p class="td-muted">Posesiones que el jugador finaliza: ${fmtNumber(s.possessions, 0)}.</p>`;
  return `<p class="td-muted">Posesiones clasificadas: ${fmtNumber(s.classified, 0)} de ${fmtNumber(s.possessions, 0)}${parts.length ? ` (${parts.join(", ")})` : ""}.</p>`;
}

function _playerExtra(d) {
  const r = d.runner;
  return `<div class="tp-stats">${stat("Transiciones que inicia", fmtNumber(r.initiated, 0), `${fmtNumber(r.initiated_pts, 0)} pts`)}
    ${stat("Asistencias en transición", fmtNumber(r.assists_in_transition, 0))}</div>
    <p class="td-muted">Primer pase de salida: ${nullDisplay(r.pass_out.reason)} · ${esc(r.pass_out.note)}</p>`;
}

// `opts`: {params (competition, last, contexto), mode: "team"|"player"}
export async function renderTransitionPanel(el, id, opts = {}) {
  if (!el) return;
  const mode = opts.mode || "team";
  const side = mode === "player" ? "ataque" : _sideFromUrl();
  const token = ++_token;
  const title = side === "defensa" ? "Transición y contraataque del rival" : "Transición y contraataque";
  const chips = mode === "player" ? "" : `<div class="pb-chips" role="group" aria-label="Lado">
      <button type="button" class="filter-pill tp-chip${side === "ataque" ? " active" : ""}" data-side="ataque">Ataque</button>
      <button type="button" class="filter-pill tp-chip${side === "defensa" ? " active" : ""}" data-side="defensa">Defensa</button></div>`;
  const shell = body => { el.innerHTML = `<div class="card of-card tp-card"><div class="card-title">${title}</div>${chips}${body}</div>`; _bind(el, id, opts); };
  shell('<p class="empty"><span class="spinner"></span>Calculando transición…</p>');

  let d;
  try {
    d = await api.transition({ ...(mode === "player" ? { player: id } : { team: id }), side, ...(opts.params || {}) });
  } catch (e) {
    if (token !== _token) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const msg = offline ? "Sin conexión: el análisis de posesiones necesita conexión."
      : (e.code === "sin_pbp" ? e.message : "No se pudo calcular la transición. Probá de nuevo.");
    shell(`<p class="empty below-avg">${esc(msg)}</p>${e.code === "sin_pbp" ? "" : '<button type="button" class="btn btn-ghost btn-sm tp-retry">Reintentar</button>'}`);
    el.querySelector(".tp-retry")?.addEventListener("click", () => renderTransitionPanel(el, id, opts));
    return;
  }
  if (token !== _token) return;
  if (!d.summary.possessions) { shell('<p class="empty">No hay posesiones en esta selección.</p>'); return; }
  const body = mode === "player"
    ? _typesTable(d, "player") + _playerExtra(d)
    : _highlights(d) + _typesTable(d, "team") + (side === "defensa" ? _defense(d) : _attack(d));
  shell(`${d.context?.label ? `<p class="td-muted">${esc(d.context.label)}</p>` : ""}${body}${_legend(d)}`);
}

function _bind(el, id, opts) {
  el.querySelectorAll(".tp-chip").forEach(c => c.addEventListener("click", () => {
    if (c.classList.contains("active")) return;
    _setSideUrl(c.dataset.side);
    renderTransitionPanel(el, id, opts);
  }));
}

export function destroyTransitionPanel() { _token++; }
