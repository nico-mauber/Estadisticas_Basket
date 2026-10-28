// ── Segunda oportunidad (A-04) ───────────────────────────────────────────────
// Cada rebote ofensivo abre una oportunidad nueva dentro de la misma posesión. Ataque: PPP de 1.ª vs 2.ª oportunidad,
// desenlaces, origen del rebote, cadenas, captura vs finalización por jugador, coste del rebote ofensivo y conciliación
// con el box oficial. Defensa: OR% concedido, PPP concedido y segundos del rival hasta tirar. El lado va en `?sside=`.
import { api } from "../api.js";
import { fmtNumber, PCT, PCT0, DEC1, DEC2, nullDisplay, isNull } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let _token = 0;   // descarta respuestas viejas al cambiar de entidad, lado o contexto

function _sideFromUrl() {
  try { return new URL(location.href).searchParams.get("sside") === "defensa" ? "defensa" : "ataque"; } catch { return "ataque"; }
}
function _setSideUrl(side) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("sside", side);
    history.replaceState(history.state, "", url);
  } catch { /* la URL no se pudo actualizar */ }
}

const val = (m, fmt) => (!m || isNull(m.value) ? nullDisplay(m?.reason || "sin_intentos") : fmt(m.value));
const low = o => o?.sample?.level === "baja";
const lowTag = o => (low(o) ? ` <span class="sample-badge sample-baja" title="${esc(`Muestra baja: mínimo ${o.sample.min} posesiones`)}">baja</span>` : "");
const table = (head, rows) => `<div class="dt-table-wrap"><table class="search-table of-table">
  <thead><tr>${head.map((h, i) => `<th${i === 0 ? ' class="of-origin"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.join("")}</tbody></table></div>`;
const stat = (label, value, sub = "") => `<div class="tp-stat"><em>${esc(label)}</em><strong>${value}</strong>${sub ? `<span>${sub}</span>` : ""}</div>`;
const sec = (title, body) => `<h4 class="tp-h">${esc(title)}</h4>${body}`;
const signed = v => `${v > 0 ? "+" : ""}${DEC2(v)}`;

function _outcomes(d) {
  return table(["Desenlace", "Segundas oport.", "%", "Puntos", "PPP"], d.outcomes.map(o =>
    `<tr class="${low(o) ? "of-low" : ""}"><td class="of-origin">${esc(o.label)}</td><td>${fmtNumber(o.count, 0)}${lowTag(o)}</td>
     <td>${isNull(o.share) ? "—" : PCT(o.share)}</td><td>${fmtNumber(o.pts, 0)}</td><td>${val(o.ppp, DEC2)}</td></tr>`));
}

function _modes(d) {
  return table(["Modo del tiro", "Intentos", "Convertidos", "%"], d.modes.map(m =>
    `<tr><td class="of-origin">${esc(m.label)}</td><td>${m.attempts}</td><td>${m.made}</td><td>${val(m.pct, PCT)}</td></tr>`));
}

function _sources(d) {
  const rows = d.sources.map(o => `<tr class="${low(o) ? "of-low" : ""}"><td class="of-origin">${esc(o.label)}</td>
    <td>${fmtNumber(o.count, 0)}${lowTag(o)}</td><td>${isNull(o.share) ? "—" : PCT(o.share)}</td><td>${val(o.ppp, DEC2)}</td></tr>`);
  rows.push(`<tr class="of-info"><td class="of-origin">Zona del rebote</td><td colspan="3" title="${esc(d.rebound_zone.note)}">${nullDisplay(d.rebound_zone.reason)} · ${esc(d.rebound_zone.note)}</td></tr>`);
  return table(["Origen del rebote", "Rebotes", "%", "PPP de la cadena"], rows);
}

function _hist(s) {
  const max = Math.max(1, ...s.distribution.map(b => b.possessions));
  return `<div class="tp-hist">${s.distribution.map(b => `<div><span style="height:${Math.round(b.possessions / max * 100)}%"></span><em>${esc(b.label)}</em><b>${b.possessions}</b></div>`).join("")}</div>
    <p class="td-muted">Promedio ${val(s.mean, v => `${DEC1(v)} s`)} sobre ${fmtNumber(s.possessions, 0)} segundas oportunidades con tiro; ${fmtNumber(s.without_shot, 0)} sin tiro.</p>`;
}

function _playersTable(pl) {
  const row = r => `<tr class="${low(r) ? "of-low" : ""}"><td class="of-origin">${esc(r.name)}</td><td>${r.captured}${lowTag(r)}</td><td>${r.capture_pts}</td>
    <td>${val(r.conversion, PCT0)}</td><td>${r.own_putbacks}</td><td>${r.finished}</td><td>${r.finish_pts}</td><td>${val(r.ppp_personal, DEC2)}</td></tr>`;
  const rows = [...pl.rows.map(row), ...(pl.team_row.captured ? [row(pl.team_row)] : [])];
  return table(["Jugador", "Rebotes ofensivos", "Pts de lo que abre", "Conversión", "Putbacks propios", "Finalizadas", "Pts finalizados", "PPP personal"], rows);
}

function _reconcile(r) {
  const base = `<p class="td-muted">Puntos de 2.ª oportunidad: ${r.calc} calculados · ${r.official} oficiales (FIBA)${r.diff ? ` — diferencia de ${Math.abs(r.diff)} en ${r.games_mismatch.length} partido(s)` : ""}.</p>`;
  const det = r.games_mismatch.length
    ? `<details class="tp-recon"><summary>Partidos con diferencia</summary>${table(["Partido", "Calculado", "Oficial", "Diferencia", "RO en posesiones incompletas"],
      r.games_mismatch.map(g => `<tr><td class="of-origin">${esc(g.game_id)}</td><td>${g.calc}</td><td>${g.official ?? "—"}</td><td>${g.diff}</td><td>${g.incomplete_oreb}</td></tr>`))}</details>` : "";
  const ex = r.excluded.length ? `<p class="td-muted">${r.excluded.length} partidos con box anterior a la ingesta v2: reprocesalos en Datos → Calidad.</p>` : "";
  return base + det + ex;
}

function _attack(d) {
  const c = d.cost;
  const cost = `<div class="tp-stats">${stat("Transiciones concedidas tras tiro fallado propio", val(c.share, PCT),
    `${c.transitions_conceded} de ${c.rival_rebound_possessions} · ${val(c.per100_misses, DEC1)} cada 100 tiros fallados`)}
    ${stat("PPP concedido en esas transiciones", val(c.ppp, DEC2))}</div><p class="td-muted">${esc(c.note)}</p>`;
  const ch = d.chains;
  const chains = `<div class="tp-stats">${stat("Cadenas de 2 o más rebotes", val(ch.share, PCT), `${ch.chains} de ${ch.possessions_with_oreb} posesiones con rebote ofensivo`)}
    ${stat("PPP de las cadenas", val(ch.ppp, DEC2))}</div>`;
  return sec("Desenlace de la segunda oportunidad", _outcomes(d)) + sec("Modo del tiro", _modes(d))
    + sec("Origen del rebote ofensivo", _sources(d)) + sec("Cadenas de rebotes", chains)
    + sec("Captura vs finalización", _playersTable(d.players)) + sec("Coste del rebote ofensivo", cost)
    + sec("Segundos del rebote al tiro", _hist(d.secs_to_shot)) + `<div class="tp-recon">${_reconcile(d.reconcile)}</div>`;
}

function _defense(d) {
  const stats = `<div class="tp-stats">${stat("OR% concedido", val(d.or_pct_conceded, PCT))}
    ${stat("PPP concedido en 2.ª oportunidad", val(d.ppp_second, DEC2), `${d.summary.second_chances} segundas oportunidades del rival`)}
    ${stat("Rebote largo vs en la zona", "—", esc(d.long_rebound.note))}</div>`;
  return sec("Defensa del rebote", stats) + sec("Segundos del rival hasta tirar", _hist(d.secs_to_shot))
    + sec("Desenlace de las segundas oportunidades del rival", _outcomes(d));
}

function _player(d) {
  const c = d.capture, f = d.finish;
  return `<div class="tp-stats">${stat("Rebotes ofensivos capturados", fmtNumber(c.captured, 0), `${c.pts} pts en lo que abre · conversión ${val(c.conversion, PCT0)}`)}
    ${stat("Putbacks propios", fmtNumber(c.own_putbacks, 0))}
    ${stat("Segundas oportunidades finalizadas", fmtNumber(f.finished, 0), `${f.pts} pts`)}
    ${stat("PPP personal en 2.ª oportunidad", val(f.ppp_personal, DEC2))}</div>`
    + sec("Desenlace de las que finaliza", _outcomes(d));
}

// `opts`: {params (competition, last, contexto), mode: "team"|"player"}
export async function renderSecondChancePanel(el, id, opts = {}) {
  if (!el) return;
  const mode = opts.mode || "team";
  const side = mode === "player" ? "ataque" : _sideFromUrl();
  const token = ++_token;
  const title = side === "defensa" ? "Segunda oportunidad del rival" : "Segunda oportunidad";
  const chips = mode === "player" ? "" : `<div class="pb-chips" role="group" aria-label="Lado">
      <button type="button" class="filter-pill sc-chip${side === "ataque" ? " active" : ""}" data-side="ataque">Ataque</button>
      <button type="button" class="filter-pill sc-chip${side === "defensa" ? " active" : ""}" data-side="defensa">Defensa</button></div>`;
  const shell = body => {
    el.innerHTML = `<div class="card of-card tp-card"><div class="card-title">${title}</div>${chips}${body}</div>`;
    el.querySelectorAll(".sc-chip").forEach(c => c.addEventListener("click", () => {
      if (c.classList.contains("active")) return;
      _setSideUrl(c.dataset.side);
      renderSecondChancePanel(el, id, opts);
    }));
  };
  shell('<p class="empty"><span class="spinner"></span>Calculando segundas oportunidades…</p>');

  let d;
  try {
    d = await api.secondChance({ ...(mode === "player" ? { player: id } : { team: id }), side, ...(opts.params || {}) });
  } catch (e) {
    if (token !== _token) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const msg = offline ? "Sin conexión: el análisis de posesiones necesita conexión."
      : (e.code === "sin_pbp" ? e.message : "No se pudo calcular la segunda oportunidad. Probá de nuevo.");
    shell(`<p class="empty below-avg">${esc(msg)}</p>${e.code === "sin_pbp" ? "" : '<button type="button" class="btn btn-ghost btn-sm sc-retry">Reintentar</button>'}`);
    el.querySelector(".sc-retry")?.addEventListener("click", () => renderSecondChancePanel(el, id, opts));
    return;
  }
  if (token !== _token) return;
  if (!d.summary.second_chances) { shell('<p class="empty">No hay rebotes ofensivos en esta selección.</p>'); return; }
  const ctx = d.context?.label ? `<p class="td-muted">${esc(d.context.label)}</p>` : "";
  if (mode === "player") { shell(ctx + _player(d)); return; }
  const head = side === "ataque"
    ? `<div class="tp-stats">${stat("PPP 1.ª oportunidad", val(d.ppp_first, DEC2))}${stat("PPP 2.ª oportunidad", val(d.ppp_second, DEC2),
        `${d.summary.second_chances} oportunidades · diferencial ${val(d.ppp_diff, signed)}`)}
      ${stat("Puntos por rebote ofensivo", val(d.pts_per_oreb, DEC2))}${stat("Conversión", val(d.conversion, PCT0), "% de rebotes ofensivos que terminan en puntos")}</div>`
    : "";
  shell(ctx + head + (side === "defensa" ? _defense(d) : _attack(d)));
}

export function destroySecondChancePanel() { _token++; }
