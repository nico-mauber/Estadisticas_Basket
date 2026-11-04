// ── Líderes y perfil de la competencia (F-14) ────────────────────────────────
// Líderes: top de jugadores por métrica con un mínimo de minutos que el usuario controla (nunca menor que el de la población de
// T-01). Perfil: promedios de referencia, ritmo, reparto de tiro y PPP por origen de posesión; son los mismos promedios con
// los que se calculan los percentiles. Todo el cálculo está en el servidor (`/api/leaders`, `/api/competition-profile`).
import { api } from "../api.js";
import { fmtNumber, fmtSigned, PCT, DEC1, DEC2 } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _tokenL = 0, _tokenP = 0;

const fmt = (f, v) => v == null ? "—" : f === "pct" ? PCT(v) : f === "dec1" ? DEC1(v) : f === "signed_dec2" ? fmtSigned(v, 2) : f === "signed_int" ? fmtSigned(v, 0) : f === "int" ? fmtNumber(v, 0) : DEC2(v);
const rankText = r => `${r.rank}.º${r.tied ? " =" : ""}`;

function _error(el, title, e) {
  const offline = e instanceof TypeError || navigator.onLine === false;
  el.innerHTML = `<div class="card"><div class="card-title">${esc(title)}</div><p class="empty below-avg">${esc(offline ? "Sin conexión: esta vista necesita conexión." : e.message || "No se pudo cargar.")}</p></div>`;
}

function _rows(rows, metric, cb) {
  return rows.map(r => `<tr><td class="ld-rank">${rankText(r)}</td>
    <td><a href="#" class="ld-player" data-pid="${esc(r.id)}">${esc(r.name)}</a> <span class="td-muted">${esc(r.team_code || "")}</span></td>
    <td class="ld-val">${fmt(metric.fmt, r.value)}</td><td class="td-muted">${fmtNumber(r.minutes, 0)}'</td><td class="td-muted">${r.games} PJ</td></tr>`).join("");
}

/** `opts`: `params` (contexto de la vista), `metric` ("" = tarjetas), `minMinutes`, `onChange({metric, minMinutes})`, `onOpenPlayer(id)`. */
export async function renderLeaders(el, opts = {}) {
  if (!el) return;
  const token = ++_tokenL;
  el.innerHTML = '<div class="card"><div class="card-title">Líderes</div><p class="empty"><span class="spinner"></span>Calculando líderes…</p></div>';
  const metric = opts.metric || "";
  const minMinutes = opts.minMinutes ?? "";
  let d;
  try {
    d = await api.leaders({ ...opts.params, metric, min_minutes: minMinutes === "" ? null : minMinutes, all: metric ? 1 : null });
  } catch (e) {
    if (token !== _tokenL) return;
    return _error(el, "Líderes", e);
  }
  if (token !== _tokenL) return;
  let metrics = d.metrics;
  if (!metrics) {   // la respuesta de una métrica no trae la lista: se pide la de las tarjetas una vez
    try { metrics = (await api.leaders({ ...opts.params, top: 1 })).metrics; } catch { metrics = []; }
    if (token !== _tokenL) return;
  }
  const mm = d.min_minutes;
  const notice = mm.raised ? `<p class="td-muted below-avg">El mínimo se subió a ${fmtNumber(mm.effective, 0)} minutos, el de la población de la competencia.</p>` : "";
  const controls = `<div class="ld-controls">
    <label class="gp-lbl">Métrica<select id="ld-metric" class="map-select"><option value="">Métricas clave</option>
      ${(metrics || []).map(m => `<option value="${esc(m.key)}"${m.key === metric ? " selected" : ""}>${esc(m.label)}</option>`).join("")}</select></label>
    <label class="gp-lbl">Mínimo de minutos<input id="ld-min" type="number" min="0" step="10" value="${esc(minMinutes === "" ? mm.effective : minMinutes)}" class="ld-min"></label>
  </div>${notice}<p class="td-muted">Mínimo aplicado: ${fmtNumber(mm.effective, 0)} minutos. Solo entran jugadores de la población de la competencia.</p>`;

  let body;
  if (!metric) {
    body = `<div class="ld-grid">${d.cards.map(c => `<div class="card ld-card"><div class="card-title">${esc(c.metric.label)} <span class="td-muted ld-dir">${esc(c.metric.direction_label)}</span></div>
      ${c.rows.length ? `<table class="ld-table"><tbody>${_rows(c.rows, c.metric)}</tbody></table>` : '<p class="td-muted">Ningún jugador alcanza el mínimo.</p>'}
      <div class="ld-foot td-muted">${c.qualified} califican${c.excluded_null ? ` · ${c.excluded_null} sin dato` : ""} · Ø ${fmt(c.metric.fmt, c.avg)}
        <a href="#" class="ld-more" data-metric="${esc(c.metric.key)}">Ver todos</a></div></div>`).join("")}</div>`;
  } else {
    body = `<div class="card"><div class="card-title">${esc(d.metric.label)} <span class="td-muted ld-dir">${esc(d.metric.direction_label)}</span></div>
      <p class="td-muted">${d.qualified} jugadores califican${d.excluded_null ? ` · ${d.excluded_null} sin dato en la métrica (no se cuentan como 0)` : ""} · Ø ${fmt(d.metric.fmt, d.avg)}</p>
      ${d.rows.length ? `<div class="vs-table-wrap"><table class="ld-table"><thead><tr><th>Puesto</th><th>Jugador</th><th>Valor</th><th>Min</th><th>PJ</th></tr></thead><tbody>${_rows(d.rows, d.metric)}</tbody></table></div>` : '<p class="empty">Ningún jugador alcanza el mínimo.</p>'}</div>`;
  }
  el.innerHTML = `<div class="card"><div class="card-title">Líderes — ${esc(d.context?.label || "")}</div>${controls}</div>${body}`;
  const change = patch => opts.onChange?.({ metric, minMinutes, ...patch });
  el.querySelector("#ld-metric").addEventListener("change", e => change({ metric: e.target.value }));
  el.querySelector("#ld-min").addEventListener("change", e => change({ minMinutes: e.target.value === "" ? "" : Number(e.target.value) }));
  el.querySelectorAll(".ld-more").forEach(a => a.addEventListener("click", ev => { ev.preventDefault(); change({ metric: a.dataset.metric }); }));
  el.querySelectorAll(".ld-player").forEach(a => a.addEventListener("click", ev => { ev.preventDefault(); opts.onOpenPlayer?.(a.dataset.pid); }));
}

function _profileTable(title, rows, hint = "") {
  if (!rows.length) return "";
  return `<div class="card"><div class="card-title">${esc(title)}</div>${hint ? `<p class="td-muted">${esc(hint)}</p>` : ""}
    <div class="vs-table-wrap"><table class="vs-table"><thead><tr><th>Métrica</th><th>Promedio</th><th>Entidades</th><th>Mejor</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.label)}</td><td title="${r.avg == null ? esc(r.reason || "") : ""}"><strong>${fmt(r.fmt, r.avg)}</strong></td><td class="td-muted">${r.n}</td>
      <td class="td-muted">${r.best ? `${esc(r.best.name)} (${fmt(r.fmt, r.best.value)})` : "—"}</td></tr>`).join("")}</tbody></table></div></div>`;
}

export async function renderCompetitionProfile(el, opts = {}) {
  if (!el) return;
  const token = ++_tokenP;
  el.innerHTML = '<div class="card"><div class="card-title">Perfil de la competencia</div><p class="empty"><span class="spinner"></span>Calculando perfil…</p></div>';
  let d;
  try { d = await api.competitionProfile({ ...opts.params }); }
  catch (e) { if (token !== _tokenP) return; return _error(el, "Perfil de la competencia", e); }
  if (token !== _tokenP) return;
  if (d.insufficient) {
    el.innerHTML = '<div class="card"><div class="card-title">Perfil de la competencia</div><p class="empty">Población insuficiente para calcular referencias.</p></div>';
    return;
  }
  const origins = d.origins.some(o => o.possessions) ? `<div class="card"><div class="card-title">PPP por origen de posesión</div>
    <p class="td-muted">PPP de referencia: media de los equipos en cada origen (ataque). Peso: posesiones de ese origen sobre el total clasificado.</p>
    <div class="vs-table-wrap"><table class="vs-table"><thead><tr><th>Origen</th><th>PPP</th><th>Posesiones</th><th>Peso</th></tr></thead><tbody>
    ${d.origins.map(o => `<tr><td>${esc(o.label)}</td><td><strong>${o.ppp_avg == null ? "—" : DEC2(o.ppp_avg)}</strong></td><td class="td-muted">${fmtNumber(o.possessions, 0)}</td><td class="td-muted">${o.share == null ? "—" : PCT(o.share)}</td></tr>`).join("")}</tbody></table></div></div>` : "";
  el.innerHTML = `<div class="card"><div class="card-title">Perfil de la competencia — ${esc(d.context?.label || d.competition.label || "")}</div>
    <p class="td-muted">${d.population.teams} equipos y ${d.population.players} jugadores en la población. Son los promedios con los que se calculan los percentiles de las fichas.</p></div>
    <div class="ld-grid">${_profileTable("Promedios de referencia — equipos", d.reference.teams)}${_profileTable("Promedios de referencia — jugadores", d.reference.players, "Por partido.")}
    ${_profileTable("Ritmo", d.pace)}${_profileTable("Reparto de tiro", d.shot)}${origins}</div>`;
}

export function destroyLeaders() { _tokenL++; _tokenP++; }
