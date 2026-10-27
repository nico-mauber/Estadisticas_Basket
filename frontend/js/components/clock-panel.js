// ── Tramo de reloj de posesión y composición de puntos (A-05) ────────────────
// Cómo anota el equipo (peso de triples, dobles y tiros libres; pérdidas y asistencias) y en qué momento de la
// posesión tira: temprano (0-8 s), medio (9-16 s) y tardío (17-24 s) del reloj de posesión, con el reloj de 14 s
// (tras rebote ofensivo) aparte. FIBA no publica el shot clock: el reloj se deriva del reloj de partido.
// Equipo: `mode: "team"` + contexto de T-03. Partido: `gameId` + `teams` (un solo partido, selector de equipo).
// El lado va en `?cside=`.
import { api } from "../api.js";
import { fmtNumber, PCT, PCT0, DEC1, DEC2, nullDisplay, isNull } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let _token = 0;   // descarta respuestas viejas al cambiar de equipo, lado o contexto

function _sideFromUrl() {
  try { return new URL(location.href).searchParams.get("cside") === "defensa" ? "defensa" : "ataque"; } catch { return "ataque"; }
}
function _setSideUrl(side) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("cside", side);
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

const PART_CLASS = { t3: "cp-seg-3", t2: "cp-seg-2", tl: "cp-seg-ft" };

function _mix(pm, side) {
  const own = side === "ataque" ? "anota" : "concede";
  const bar = `<div class="cp-bar" role="img" aria-label="Composición de los puntos">${pm.parts.map(p =>
    isNull(p.share.value) ? "" : `<span class="${PART_CLASS[p.key]}" style="width:${(p.share.value * 100).toFixed(1)}%" title="${esc(`${p.label}: ${p.pts} puntos`)}">${PCT0(p.share.value)}</span>`).join("")}</div>`;
  const rows = pm.parts.map(p => `<tr><td class="of-origin"><i class="cp-dot ${PART_CLASS[p.key]}"></i>${esc(p.label)}</td>
    <td>${fmtNumber(p.pts, 0)}</td><td>${val(p.share, PCT)}</td><td>${p.made} / ${p.attempts}</td><td>${val(p.pct, PCT)}</td>
    <td>${val(p.attempts_share, PCT)}</td></tr>`);
  rows.push(`<tr class="of-total"><td class="of-origin">Total</td><td>${fmtNumber(pm.pts, 0)}</td><td>${pm.reconciled ? "100 %" : "—"}</td><td colspan="3"></td></tr>`);
  const t = pm.turnovers, a = pm.assists;
  const astPts = a.ast_points.value == null
    ? `<span title="${esc(a.note)}">${nullDisplay(a.ast_points.reason)}</span>` : fmtNumber(a.ast_points.value, 0);
  return `<p class="td-muted">Peso de cada tipo de tiro en los puntos que el equipo ${own} (${pm.games} partido${pm.games === 1 ? "" : "s"}, box oficial).</p>${bar}`
    + table(["Tipo", "Puntos", "% de los puntos", "Convertidos / intentos", "% acierto", "% de los intentos"], rows)
    + `<div class="tp-stats">
      ${stat("Pérdidas", fmtNumber(t.count, 0), `${val(t.per_game, DEC1)} por partido · ${val(t.poss_share, PCT)} de las posesiones`)}
      ${stat("Puntos perdidos (estimado)", val(t.est_points_lost, DEC1), esc(t.note))}
      ${stat("Asistencias", fmtNumber(a.count, 0), `${val(a.per_game, DEC1)} por partido · ${val(a.fgm_assisted_share, PCT)} de las canastas de campo`)}
      ${stat("Puntos generados por asistencias", astPts, `${val(a.ast_points_share, PCT)} de los puntos · ${a.linked.fg2} a dobles, ${a.linked.fg3} a triples, ${a.linked.ft} a tiros libres`)}
    </div>`;
}

function _bandRow(b, blk, th14) {
  const x = b[blk];
  const range = blk === "r14" && b.key === "medio" ? `${b.range.split("–")[0]}–${th14} s` : b.range;
  if (x.reason) return `<tr class="of-info"><td class="of-origin">${esc(b.label)} <small>${esc(b.range)}</small></td><td colspan="10">Sin tramo tardío: el reloj se reinicia a 14 s.</td></tr>`;
  const m = x.metrics, th = x.threes;
  return `<tr class="${low(x) ? "of-low" : ""}"><td class="of-origin">${esc(b.label)} <small>${esc(range)}</small></td>
    <td>${fmtNumber(x.shots, 0)}${lowTag(x)}</td><td>${isNull(x.share) ? "—" : PCT(x.share)}</td>
    <td>${th.made} / ${th.attempts}</td><td>${val(th.share_of_band, PCT)}</td><td>${val(th.share_of_team_3pa, PCT)}</td>
    <td>${val(m.efg_pct, PCT)}</td><td>${val(m.ppt, DEC2)}</td><td>${val(m.ppp, DEC2)}</td>
    <td>${val(m.to_pct, PCT)}</td><td>${val(m.viol24_rate, PCT)}</td></tr>`;
}

const BAND_HEAD = ["Tramo", "Tiros", "% de los tiros", "Triples (c/i)", "% de sus tiros son triples", "Peso en los triples del equipo",
  "eFG%", "PPT", "PPP", "TO%", "Viol. 24 s"];

function _bands(d) {
  const rows24 = d.bands.map(b => _bandRow(b, "r24"));
  const nc = d.no_clock;
  rows24.push(`<tr class="of-info"><td class="of-origin" title="${esc("El reloj de partido del tiro no permite derivar el reloj de posesión.")}">Sin reloj derivable</td>
    <td>${nc.shots}</td><td>${isNull(d.reconcile.fga_engine) || !d.reconcile.fga_engine ? "—" : PCT(nc.shots / d.reconcile.fga_engine)}</td><td colspan="8"></td></tr>`);
  const rows14 = d.bands.filter(b => b.key !== "tardio").map(b => _bandRow(b, "r14", d.thresholds.reset_secs));
  const types = table(["Tramo", ...["Pase", "Manejo", "Pasos", "24 segundos", "Otras"]], d.bands.map(b => {
    const t = b.r24.turnover_types;
    return `<tr><td class="of-origin">${esc(b.label)}</td><td>${t.pase}</td><td>${t.manejo}</td><td>${t.pasos}</td><td>${t.viol24}</td><td>${t.otras}</td></tr>`;
  }));
  return `<p class="td-muted">${esc(d.clock_source.note)} Resolución de 1 s: un tiro a 8,4 s cuenta como 8.</p>`
    + sec("Reloj de 24 s", table(BAND_HEAD, rows24))
    + sec("Reloj de 14 s (tras rebote ofensivo): no hay tramo tardío", table(BAND_HEAD, rows14))
    + sec("Pérdidas por tipo y tramo (reloj de 24 s)", types);
}

function _reconcile(d) {
  const r = d.reconcile;
  const txt = `Tiros: ${r.in_bands_24} en reloj de 24 s + ${r.in_bands_14} en reloj de 14 s + ${r.no_clock} sin reloj + ${r.in_incomplete} en posesiones incompletas = ${r.in_bands_24 + r.in_bands_14 + r.no_clock + r.in_incomplete}`;
  return r.ok
    ? `<p class="td-muted">${txt} (iguala los ${r.fga_team} del box oficial).</p>`
    : `<p class="td-muted below-avg">${txt}: diferencia con los ${r.fga_team} del box oficial. Revisá el motor de posesiones.</p>`;
}

// `opts`: {params (competition, last, contexto), mode: "team"|"game", gameId, teams: [{code, name}], team}
export async function renderClockPanel(el, teamCode, opts = {}) {
  if (!el) return;
  const side = _sideFromUrl();
  const token = ++_token;
  const game = opts.mode === "game";
  const team = game ? (opts.team || teamCode) : teamCode;
  const title = side === "defensa" ? "Cómo anota el rival y cuándo tira" : "Cómo anota y cuándo tira";
  const sideChips = `<div class="pb-chips" role="group" aria-label="Lado">
      <button type="button" class="filter-pill cp-chip${side === "ataque" ? " active" : ""}" data-side="ataque">Ataque</button>
      <button type="button" class="filter-pill cp-chip${side === "defensa" ? " active" : ""}" data-side="defensa">Defensa</button></div>`;
  const teamChips = game && opts.teams?.length ? `<div class="pb-chips" role="group" aria-label="Equipo">${opts.teams.map(t =>
    `<button type="button" class="filter-pill cp-team${t.code === team ? " active" : ""}" data-team="${esc(t.code)}">${esc(t.name || t.code)}</button>`).join("")}</div>` : "";
  const shell = body => {
    el.innerHTML = `<div class="card of-card tp-card"><div class="card-title">${title}</div>${teamChips}${sideChips}${body}</div>`;
    el.querySelectorAll(".cp-chip").forEach(c => c.addEventListener("click", () => {
      if (c.classList.contains("active")) return;
      _setSideUrl(c.dataset.side);
      renderClockPanel(el, teamCode, opts);
    }));
    el.querySelectorAll(".cp-team").forEach(c => c.addEventListener("click", () => {
      if (c.classList.contains("active")) return;
      renderClockPanel(el, teamCode, { ...opts, team: c.dataset.team });
    }));
  };
  shell('<p class="empty"><span class="spinner"></span>Calculando el reloj de posesión…</p>');

  let d;
  try {
    d = await api.possessionClock({ team, side, ...(game ? { game: opts.gameId } : (opts.params || {})) });
  } catch (e) {
    if (token !== _token) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const msg = offline ? "Sin conexión: el análisis de posesiones necesita conexión."
      : (e.code === "sin_pbp" ? e.message : "No se pudo calcular el reloj de posesión. Probá de nuevo.");
    shell(`<p class="empty below-avg">${esc(msg)}</p>${e.code === "sin_pbp" ? "" : '<button type="button" class="btn btn-ghost btn-sm cp-retry">Reintentar</button>'}`);
    el.querySelector(".cp-retry")?.addEventListener("click", () => renderClockPanel(el, teamCode, opts));
    return;
  }
  if (token !== _token) return;
  if (!d.summary.shots) { shell('<p class="empty">No hay tiros en esta selección.</p>'); return; }
  const ctx = d.context?.label ? `<p class="td-muted">${esc(d.context.label)}</p>` : "";
  shell(ctx + sec("Composición de los puntos", _mix(d.points_mix, side)) + sec("Tramo del reloj de posesión", _bands(d)) + _reconcile(d));
}

export function destroyClockPanel() { _token++; }
