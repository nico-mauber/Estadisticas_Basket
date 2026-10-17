// ── Preparar partido (F-03) ──────────────────────────────────────────────────
// Informe de scouting de un rival: ventajas/amenazas, quintetos rivales, amenazas
// ofensivas, historial y coincidencia en cancha. Un solo GET /api/prepare.
// Salidas: PDF A4 (impresión), PNG vertical 1080 px y CSV de los datos base.
import { api } from "../api.js";
import { PCT, DEC1, DEC2, isNull, nullDisplay } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";
import { shotChart, bindZoneTooltips, ZONE_LABELS } from "./shot-chart.js";
import { pointsDistributionHTML } from "./live-view.js";
import { toCSV, toPNG, printNode, downloadBlob, loadCsvSeparator } from "./exporters.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

const LEGEND = "Coincidencia en cancha: FIBA no registra quién marca a quién; se mide el rendimiento mientras ambos estuvieron en cancha.";
const LEVELS = [["quinteto", "Quinteto vs quinteto"], ["jugador", "Jugador vs jugador"], ["jugador_quinteto", "Jugador vs quinteto"]];
const LAST_OPTIONS = [["", "Todos"], ["3", "Últimos 3"], ["5", "Últimos 5"], ["10", "Últimos 10"]];
const TOP_LINEUPS = 8;
const TOP_ROWS = 30;

let _el = null;
let _onOpenGame = null;
let _teams = null;
let _form = { team: "", rival: "", last: "" };
let _data = null;
let _token = 0;
let _mu = null;

function _resetMu() {
  _mu = { level: "quinteto", jqSide: "team", own: "", opp: "", allRows: false, allLineups: false, open: null };
}

export async function renderPrepare(el, { onOpenGame } = {}) {
  _el = el;
  _onOpenGame = onOpenGame;
  loadCsvSeparator();
  if (!_teams) {
    el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando equipos…</p>';
    try {
      _teams = await api.teams();
    } catch (e) {
      el.innerHTML = `<p class="empty below-avg">${esc(e.message || "No se pudieron cargar los equipos.")}</p>`;
      return;
    }
  }
  _renderShell();
}

function _renderShell() {
  const opts = sel => '<option value="">— Elegir —</option>' + _teams.map(t =>
    `<option value="${esc(t.code)}"${t.code === sel ? " selected" : ""}>${esc(t.name)}</option>`).join("");
  _el.innerHTML = `
    <div class="card">
      <div class="card-title">Preparar partido</div>
      <p class="td-muted">Elegí tu equipo y el rival para generar el informe.</p>
      <div class="pr-form">
        <label>Mi equipo<select id="pr-team">${opts(_form.team)}</select></label>
        <label>Rival<select id="pr-rival">${opts(_form.rival)}</select></label>
        <label>Partidos del rival<select id="pr-last">${LAST_OPTIONS.map(([v, l]) =>
          `<option value="${v}"${v === _form.last ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <button class="btn" id="pr-go">Generar informe</button>
      </div>
      <p class="pr-form-msg below-avg" id="pr-msg" hidden></p>
    </div>
    <div id="pr-report"></div>`;
  _el.querySelector("#pr-go").addEventListener("click", _generate);
  if (_data) _renderReport();
}

async function _generate() {
  _form = {
    team: _el.querySelector("#pr-team").value,
    rival: _el.querySelector("#pr-rival").value,
    last: _el.querySelector("#pr-last").value,
  };
  const msg = _el.querySelector("#pr-msg");
  const problem = !_form.team || !_form.rival ? "Elegí tu equipo y el rival."
    : _form.team === _form.rival ? "El rival no puede ser el mismo equipo." : "";
  msg.hidden = !problem;
  msg.textContent = problem;
  if (problem) return;

  const token = ++_token;
  const report = _el.querySelector("#pr-report");
  report.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Generando informe…</p></div>';
  let data;
  try {
    data = await api.prepare({ team: _form.team, rival: _form.rival, last: _form.last });
  } catch (e) {
    if (token !== _token) return;
    const text = navigator.onLine === false || !e.status
      ? "Sin conexión: preparar un partido necesita conexión."
      : e.message || "No se pudo generar el informe.";
    report.innerHTML = `<div class="card"><p class="empty below-avg">${esc(text)}</p>
      <p style="text-align:center"><button class="btn btn-ghost btn-sm" id="pr-retry">Reintentar</button></p></div>`;
    report.querySelector("#pr-retry").addEventListener("click", _generate);
    return;
  }
  if (token !== _token) return;
  _data = data;
  _resetMu();
  _renderReport();
}

// ── Formato ──────────────────────────────────────────────────────────────────

function fmtBy(fmt, v) {
  if (isNull(v)) return "—";
  if (fmt === "pct") return PCT(v);
  if (fmt === "dec1") return DEC1(v);
  if (fmt === "int") return Number.isInteger(v) ? String(v) : DEC1(v);
  return DEC2(v);
}
const signed = (v, f = DEC2) => isNull(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${f(Math.abs(v))}`;
const metricVal = m => (!m || isNull(m.value)) ? nullDisplay(m?.reason) : PCT(m.value);

function _fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d ? `${d}/${m}/${y}` : iso;
}

function _fmtDateTime(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function _rivalGamesLabel(s) {
  return s.last
    ? `Últimos ${s.rival_games_considered} partidos del rival (de ${s.rival_games_total})`
    : `Todos los partidos del rival (${s.rival_games_total})`;
}

// ── Informe ──────────────────────────────────────────────────────────────────

function _renderReport() {
  const d = _data;
  const s = d.summary;
  const report = _el.querySelector("#pr-report");
  report.innerHTML = `
    <div class="card pr-header">
      <div class="pr-title">${esc(s.team.name)} <span class="pr-vs">vs</span> ${esc(s.rival.name)}</div>
      <div class="pr-meta">${esc(s.competition.label || "")} · ${esc(_rivalGamesLabel(s))} · Generado ${esc(_fmtDateTime(s.generated_at))}</div>
      <div class="pr-actions">
        <button class="btn btn-ghost btn-sm" data-export="pdf">PDF A4</button>
        <button class="btn btn-ghost btn-sm" data-export="png">Imagen PNG</button>
        <button class="btn btn-ghost btn-sm" data-export="csv">CSV</button>
      </div>
    </div>
    <div class="card"><div class="card-title">Ventajas y amenazas</div>${_advThrHTML(d)}</div>
    <div class="card"><div class="card-title">Quintetos más usados de ${esc(s.rival.name)}</div>${_lineupsHTML(d)}</div>
    <div class="card"><div class="card-title">Amenazas ofensivas de ${esc(s.rival.name)}</div>${_threatsHTML(d)}</div>
    <div class="card"><div class="card-title">Historial entre ambos</div>${_h2hHTML(d)}</div>
    <div class="card" id="pr-mu-card"><div class="card-title">Coincidencia en cancha</div><div id="pr-mu"></div></div>`;

  report.querySelectorAll("[data-export]").forEach(b => b.addEventListener("click", () => _export(b.dataset.export, b)));
  report.querySelectorAll("[data-game]").forEach(tr => tr.addEventListener("click", () => _onOpenGame?.(tr.dataset.game)));
  report.querySelector("#pr-lineups-toggle")?.addEventListener("click", () => { _mu.allLineups = !_mu.allLineups; _renderReport(); });
  const zones = d.rival_threats?.zones;
  const shotEl = report.querySelector("#pr-shotchart");
  if (shotEl && zones) bindZoneTooltips(shotEl, zones);
  _renderMatchups();
}

function _itemHTML(i, kind, s) {
  return `<div class="pr-item pr-${kind}">
    <div class="pr-item-head"><span class="pr-arrow">${i.direction === "up" ? "▲" : "▼"}</span>
      <strong>${esc(i.title)}</strong><span class="pr-strength">${esc(i.strength)}</span></div>
    <div class="pr-item-vals">
      <span>${esc(s.team.code)} ${esc(i.own_label)} <b>${fmtBy(i.own_fmt, i.own)}</b> <small>P${i.own_pct}</small></span>
      <span>${esc(s.rival.code)} ${esc(i.ref_label)} <b>${fmtBy(i.ref_fmt, i.ref)}</b> <small>P${i.ref_pct}</small></span>
      <span class="pr-edge">${i.edge > 0 ? "+" : ""}${i.edge}</span>
    </div>
    <div class="pr-item-text">${esc(i.text)}</div>
  </div>`;
}

function _advThrHTML(d) {
  const s = d.summary;
  if (!d.advantages.length && !d.threats.length) return '<p class="empty">Muestra insuficiente para comparar estos equipos.</p>';
  const warn = d.sample_warning
    ? `<div class="lv-banner">Muestra baja: ${esc(s.team.name)} tiene ${s.team_games} partidos y ${esc(s.rival.name)} ${s.rival_games_considered} en la selección. Tomá la comparación con cautela.</div>`
    : "";
  return `${warn}<div class="pr-cols">
      <div><h4 class="pr-col-h pr-adv-h">Ventajas</h4>${d.advantages.map(i => _itemHTML(i, "adv", s)).join("")}</div>
      <div><h4 class="pr-col-h pr-thr-h">Amenazas del rival</h4>${d.threats.map(i => _itemHTML(i, "thr", s)).join("")}</div>
    </div>
    <p class="lv-hint">P = percentil en la competencia (100 = el mejor). La diferencia compara nuestro percentil con el del rival en cada duelo.</p>`;
}

function _lineupRowHTML(r) {
  const low = r.sample?.level === "baja";
  return `<tr class="${low ? "pr-low" : ""}">
    <td class="pr-name">${esc(r.name)}</td><td>${r.games}</td><td>${DEC1(r.minutes)}</td><td>${DEC1(r.possessions)}</td>
    <td>${signed(r.net_rating)}</td>
    <td>${signed(r.net_adj)}${isNull(r.net_band) ? "" : ` <small class="td-muted">±${DEC2(r.net_band)}</small>`}</td>
    <td>${sampleBadge(r.sample, { compact: true })}</td></tr>`;
}

function _lineupsHTML(d) {
  const rows = d.rival_lineups?.rows || [];
  if (!rows.length) return '<p class="empty">El rival no tiene quintetos con play-by-play en esta selección.</p>';
  const shown = _mu.allLineups ? rows : rows.slice(0, TOP_LINEUPS);
  return `<div class="lv-table-wrap"><table class="pr-table">
      <thead><tr><th>Quinteto</th><th>PJ</th><th>Min</th><th>Pos</th><th>Net</th><th>Net aj.</th><th>Muestra</th></tr></thead>
      <tbody>${shown.map(_lineupRowHTML).join("")}</tbody></table></div>
    ${rows.length > TOP_LINEUPS ? `<p class="pr-more"><button class="btn btn-ghost btn-sm" id="pr-lineups-toggle">${_mu.allLineups ? "Ver menos" : `Ver todos (${rows.length})`}</button></p>` : ""}
    <p class="lv-hint">Ordenados por minutos. Net aj. = Net Rating ajustado por muestra (regresión a la media); ± = margen de error 95 %. En gris, muestra baja.</p>`;
}

function _threatsHTML(d) {
  const t = d.rival_threats || {};
  const s = d.summary;
  const players = t.top_usage || [];
  const usage = players.length
    ? `<table class="pr-table"><thead><tr><th>Jugador</th><th>PJ</th><th>Min/PJ</th><th>Pts/PJ</th><th>USO%</th><th>TS%</th></tr></thead>
        <tbody>${players.map(p => `<tr><td class="pr-name">${esc(p.name)}</td><td>${p.games}</td><td>${DEC1(p.mpg)}</td><td>${DEC1(p.ppg)}</td>
          <td>${metricVal(p.uso_pct)}</td><td>${metricVal(p.ts_pct)}</td></tr>`).join("")}</tbody></table>`
    : '<p class="empty">Sin jugadores con minutos suficientes.</p>';
  const zones = t.zones;
  const hasShots = (zones?.summary?.total_shots || 0) > 0;
  const best = t.best_zone
    ? `<p class="pr-best">Zona más productiva: <b>${esc(ZONE_LABELS[t.best_zone.zone] || t.best_zone.zone)}</b> — ${DEC2(t.best_zone.ppt)} pts por tiro (${t.best_zone.attempts} intentos)</p>`
    : "";
  const chart = hasShots
    ? `${best}<div id="pr-shotchart" class="pr-shotchart">${shotChart(zones)}</div>`
    : '<p class="empty">Sin datos de tiro para el rival en esta selección.</p>';
  return `<div class="pr-threats">
      <div><h4>Mayor uso</h4><div class="lv-table-wrap">${usage}</div></div>
      <div><h4>Zonas de tiro</h4>${chart}</div>
    </div>
    <h4>De dónde vienen sus puntos</h4>
    <div class="lv-dist-row">${t.points ? pointsDistributionHTML(s.rival.name, t.points) : '<p class="empty">Sin datos.</p>'}</div>`;
}

function _h2hHTML(d) {
  const h = d.h2h;
  const s = d.summary;
  if (!h.games.length) return '<p class="empty">Sin historial entre estos equipos.</p>';
  return `<p class="pr-record">${esc(s.team.name)} <b>${h.record.wins_a}</b> – <b>${h.record.wins_b}</b> ${esc(s.rival.name)}</p>
    <div class="lv-table-wrap"><table class="pr-table pr-h2h">
      <thead><tr><th>Fecha</th><th>Competencia</th><th>L/V</th><th>Resultado</th><th></th></tr></thead>
      <tbody>${h.games.map(g => `<tr data-game="${esc(g.game_id)}" class="pr-click" title="Ver partido">
        <td class="pr-name">${_fmtDate(g.date)}</td><td>${esc(g.competition_label || "")}</td><td>${g.venue}</td>
        <td>${g.score_a ?? "—"} – ${g.score_b ?? "—"}</td>
        <td class="${g.winner === s.team.code ? "above-avg" : g.winner ? "below-avg" : ""}">${g.winner === s.team.code ? "G" : g.winner ? "P" : "E"}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="lv-hint">Historial completo en todas las competencias (no lo afecta el filtro de últimos partidos). Tocá un partido para analizarlo.</p>`;
}

// ── Coincidencia en cancha ───────────────────────────────────────────────────

const _ownKey = r => r.id.split("|")[0];
const _oppKey = r => r.id.split("|")[1];

function _muRowHTML(r, { ownLabel = true, oppLabel = true } = {}) {
  const low = r.sample?.level === "baja";
  const open = _mu.open === r.id;
  const games = (r.games || []).map(g => `<a href="javascript:void(0)" data-game="${esc(g.game_id)}">${esc(_gameLabel(g.game_id))}</a> (${DEC1(g.possessions)} pos.)`).join(" · ");
  return `<tr class="pr-click ${low ? "pr-low" : ""}" data-mu="${esc(r.id)}">
      ${ownLabel ? `<td class="pr-name">${esc(r.own_name)}</td>` : ""}
      ${oppLabel ? `<td class="pr-name">${esc(r.opp_name)}</td>` : ""}
      <td>${DEC1(r.possessions)}</td><td>${r.pts_for}–${r.pts_against}</td>
      <td>${signed(r.net_rating)}${isNull(r.net_band) ? "" : ` <small class="td-muted">±${DEC2(r.net_band)}</small>`}</td>
      <td>${sampleBadge(r.sample, { compact: true })}</td><td>${(r.games || []).length}</td>
    </tr>${open ? `<tr class="pr-games-row"><td colspan="${5 + ownLabel + oppLabel}">Partidos: ${games}</td></tr>` : ""}`;
}

function _emptyRowHTML(label) {
  return `<tr class="pr-nodata"><td class="pr-name">${esc(label)}</td><td colspan="5">Sin datos</td></tr>`;
}

function _gameLabel(gid) {
  const g = _data.h2h.games.find(x => x.game_id === gid);
  return g ? `${_fmtDate(g.date)} ${g.score_a}–${g.score_b}` : gid;
}

function _sortCrosses(list) {
  // con datos y muestra suficiente primero (por Net), luego muestra baja, al final sin datos
  const rank = r => !r ? 2 : r.sample?.level === "baja" ? 1 : 0;
  return list.sort((a, b) => rank(a.row) - rank(b.row) || (b.row?.net_rating ?? -9) - (a.row?.net_rating ?? -9));
}

function _renderMatchups() {
  const host = _el.querySelector("#pr-mu");
  if (!host) return;
  const m = _data.matchups;
  const s = _data.summary;
  const legend = `<p class="pr-legend">${esc(LEGEND)}</p>`;
  if (m.reason) {
    host.innerHTML = `${legend}<p class="empty">Sin cruces registrados entre estos equipos${s.last ? " en los partidos considerados del rival" : ""}.</p>`;
    return;
  }
  const tabs = `<div class="gv-tabs pr-mu-tabs">${LEVELS.map(([id, label]) =>
    `<button class="gv-tab${_mu.level === id ? " active" : ""}" data-level="${id}">${label}</button>`).join("")}</div>`;
  let body;
  if (_mu.level === "quinteto") body = _quintetoHTML(m.quinteto?.rows || [], s);
  else if (_mu.level === "jugador") body = _plainHTML(m.jugador?.rows || [], "Nuestro jugador", "Su jugador");
  else {
    const side = _mu.jqSide;
    const rows = (side === "team" ? m.jugador_quinteto : m.jugador_quinteto_rival)?.rows || [];
    body = `<div class="pr-side">
        <button class="filter-pill${side === "team" ? " active" : ""}" data-jq="team">Nuestros jugadores vs sus quintetos</button>
        <button class="filter-pill${side === "rival" ? " active" : ""}" data-jq="rival">Sus jugadores vs nuestros quintetos</button>
      </div>${_plainHTML(rows, side === "team" ? "Nuestro jugador" : "Su jugador", side === "team" ? "Su quinteto" : "Nuestro quinteto")}`;
  }
  const minPoss = (m.quinteto?.rows || [])[0]?.sample?.min;
  host.innerHTML = `${legend}${tabs}${body}
    <p class="lv-hint">En gris, muestra baja${minPoss ? ` (menos de ${minPoss} posesiones)` : ""}: se muestra con su margen de error (±) y no se recomienda. Tocá una fila para ver en qué partidos ocurrió.</p>`;

  host.querySelectorAll("[data-level]").forEach(b => b.addEventListener("click", () => { _mu.level = b.dataset.level; _mu.open = null; _mu.allRows = false; _renderMatchups(); }));
  host.querySelectorAll("[data-jq]").forEach(b => b.addEventListener("click", () => { _mu.jqSide = b.dataset.jq; _mu.open = null; _renderMatchups(); }));
  host.querySelector("#pr-mu-own")?.addEventListener("change", e => { _mu.own = e.target.value; _mu.opp = ""; _mu.open = null; _renderMatchups(); });
  host.querySelector("#pr-mu-opp")?.addEventListener("change", e => { _mu.opp = e.target.value; _mu.own = ""; _mu.open = null; _renderMatchups(); });
  host.querySelector("#pr-mu-all")?.addEventListener("click", () => { _mu.allRows = !_mu.allRows; _renderMatchups(); });
  host.querySelectorAll("tr[data-mu]").forEach(tr => tr.addEventListener("click", e => {
    if (e.target.closest("[data-game]")) return;
    _mu.open = _mu.open === tr.dataset.mu ? null : tr.dataset.mu;
    _renderMatchups();
  }));
  host.querySelectorAll("[data-game]").forEach(a => a.addEventListener("click", e => { e.stopPropagation(); _onOpenGame?.(a.dataset.game); }));
}

function _quintetoHTML(rows, s) {
  const own = new Map(), opp = new Map();
  rows.forEach(r => { own.set(_ownKey(r), r.own_name); opp.set(_oppKey(r), r.opp_name); });
  const select = (id, label, map, value) => `<label>${label}<select id="${id}"><option value="">— Todos —</option>
    ${[...map].map(([k, n]) => `<option value="${esc(k)}"${k === value ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;
  const selectors = `<div class="pr-form pr-mu-form">
      ${select("pr-mu-own", `Con qué cinco salgo (${esc(s.team.code)})`, own, _mu.own)}
      ${select("pr-mu-opp", `Contra su quinteto (${esc(s.rival.code)})`, opp, _mu.opp)}
    </div>`;
  let table;
  if (_mu.own) {
    const list = _sortCrosses([...opp].map(([k, name]) => ({ name, row: rows.find(r => _ownKey(r) === _mu.own && _oppKey(r) === k) })));
    table = `<p class="pr-pick">Sus quintetos ordenados por Net Rating del cruce contra <b>${esc(own.get(_mu.own))}</b>:</p>
      ${_tableHTML(["Su quinteto"], list.map(x => x.row ? _muRowHTML(x.row, { ownLabel: false }) : _emptyRowHTML(x.name)).join(""))}`;
  } else if (_mu.opp) {
    const list = _sortCrosses([...own].map(([k, name]) => ({ name, row: rows.find(r => _oppKey(r) === _mu.opp && _ownKey(r) === k) })));
    table = `<p class="pr-pick">Nuestros quintetos ordenados por rendimiento contra <b>${esc(opp.get(_mu.opp))}</b>:</p>
      ${_tableHTML(["Nuestro quinteto"], list.map(x => x.row ? _muRowHTML(x.row, { oppLabel: false }) : _emptyRowHTML(x.name)).join(""))}`;
  } else {
    table = _plainHTML(rows, "Nuestro quinteto", "Su quinteto");
  }
  return selectors + table;
}

function _tableHTML(nameCols, body) {
  return `<div class="lv-table-wrap"><table class="pr-table pr-mu-table">
    <thead><tr>${nameCols.map(c => `<th>${c}</th>`).join("")}<th>Pos</th><th>PF–PC</th><th>Net</th><th>Muestra</th><th>PJ</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

function _plainHTML(rows, ownLabel, oppLabel) {
  if (!rows.length) return '<p class="empty">Sin cruces registrados entre estos equipos.</p>';
  const shown = _mu.allRows ? rows : rows.slice(0, TOP_ROWS);
  return `${_tableHTML([ownLabel, oppLabel], shown.map(r => _muRowHTML(r)).join(""))}
    ${rows.length > TOP_ROWS ? `<p class="pr-more"><button class="btn btn-ghost btn-sm" id="pr-mu-all">${_mu.allRows ? "Ver menos" : `Ver todos (${rows.length})`}</button></p>` : ""}`;
}

// ── Exportación ──────────────────────────────────────────────────────────────

function _toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
}

function _fileBase() {
  const s = _data.summary;
  return `preparar_${s.team.code}_vs_${s.rival.code}`.toLowerCase();
}

function _topCrosses(n) {
  const rows = (_data.matchups?.quinteto?.rows || []).filter(r => r.sample?.level !== "baja");
  return [...rows].sort((a, b) => (b.net_rating ?? -9) - (a.net_rating ?? -9)).slice(0, n);
}

async function _export(fmt, btn) {
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando…";
  try {
    if (fmt === "csv") {
      downloadBlob(_csvBlob(), `${_fileBase()}.csv`);
      _toast(`Archivo generado: ${_fileBase()}.csv`);
    } else if (fmt === "png") {
      const stage = document.createElement("div");
      stage.style.cssText = "position:fixed;left:-99999px;top:0";
      const node = _summaryNode({ png: true });
      stage.appendChild(node);
      document.body.appendChild(stage);
      try {
        const blob = await toPNG(node, { width: 1080 });
        downloadBlob(blob, `${_fileBase()}.png`);
        _toast(`Archivo generado: ${_fileBase()}.png`);
      } catch {
        _toast("No se pudo generar la imagen en este navegador. Probá con PDF.", "err");
      } finally {
        stage.remove();
      }
    } else {
      printNode(_summaryNode({ png: false }), { pageSize: "A4" });
    }
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

// Informe resumido legible sin la app: PNG vertical (1080 px) y PDF A4 de 2 páginas.
function _summaryNode({ png }) {
  const d = _data, s = d.summary;
  const item = (i, kind) => `<div class="prx-item prx-${kind}"><b>${i.direction === "up" ? "▲" : "▼"} ${esc(i.title)}</b>
    <span>${esc(s.team.code)} ${esc(i.own_label)} ${fmtBy(i.own_fmt, i.own)} (P${i.own_pct}) · ${esc(s.rival.code)} ${esc(i.ref_label)} ${fmtBy(i.ref_fmt, i.ref)} (P${i.ref_pct})</span>
    <em>${esc(i.text)}</em></div>`;
  const lineups = (d.rival_lineups?.rows || []).slice(0, TOP_LINEUPS);
  const usage = (d.rival_threats?.top_usage || []);
  const pts = d.rival_threats?.points;
  const best = d.rival_threats?.best_zone;
  const crosses = _topCrosses(8);
  const pct = (v, total) => isNull(v) || !total ? "—" : `${v} (${DEC1(v / total * 100)}%)`;

  const page1 = `<div class="prx-page">
      <div class="prx-head"><div class="prx-title">${esc(s.team.name)} vs ${esc(s.rival.name)}</div>
        <div class="prx-meta">Preparar partido · ${esc(s.competition.label || "")} · ${esc(_rivalGamesLabel(s))} · ${esc(_fmtDateTime(s.generated_at))}</div></div>
      ${d.sample_warning ? '<p class="prx-warn">Muestra baja: comparación orientativa.</p>' : ""}
      <div class="prx-cols"><div><h3>Ventajas</h3>${d.advantages.map(i => item(i, "adv")).join("") || "—"}</div>
        <div><h3>Amenazas del rival</h3>${d.threats.map(i => item(i, "thr")).join("") || "—"}</div></div>
      <h3>Quintetos más usados de ${esc(s.rival.name)}</h3>
      ${lineups.length ? `<table class="prx-table"><thead><tr><th>Quinteto</th><th>Min</th><th>Pos</th><th>Net</th><th>Net aj. ±</th></tr></thead><tbody>
        ${lineups.map(r => `<tr${r.sample?.level === "baja" ? ' class="prx-low"' : ""}><td>${esc(r.name)}</td><td>${DEC1(r.minutes)}</td><td>${DEC1(r.possessions)}</td>
          <td>${signed(r.net_rating)}</td><td>${signed(r.net_adj)}${isNull(r.net_band) ? "" : ` ±${DEC2(r.net_band)}`}</td></tr>`).join("")}</tbody></table>`
        : "<p>Sin quintetos con play-by-play.</p>"}
    </div>`;
  const page2 = `<div class="prx-page">
      <h3>Amenazas ofensivas de ${esc(s.rival.name)}</h3>
      ${usage.length ? `<table class="prx-table"><thead><tr><th>Jugador</th><th>Pts/PJ</th><th>USO%</th><th>TS%</th></tr></thead><tbody>
        ${usage.map(p => `<tr><td>${esc(p.name)}</td><td>${DEC1(p.ppg)}</td><td>${isNull(p.uso_pct?.value) ? "—" : PCT(p.uso_pct.value)}</td>
          <td>${isNull(p.ts_pct?.value) ? "—" : PCT(p.ts_pct.value)}</td></tr>`).join("")}</tbody></table>` : ""}
      ${best ? `<p>Zona más productiva: <b>${esc(ZONE_LABELS[best.zone] || best.zone)}</b> — ${DEC2(best.ppt)} pts por tiro (${best.attempts} intentos).</p>` : ""}
      ${pts ? `<p>Puntos (${pts.total}): pintura ${pct(pts.by_shot.paint_pts?.value, pts.total)} · media ${pct(pts.by_shot.mid_pts?.value, pts.total)} ·
        triples ${pct(pts.by_shot.three_pts?.value, pts.total)} · libres ${pct(pts.by_shot.ft_pts?.value, pts.total)}.
        Segunda oportunidad ${pct(pts.by_origin.second_chance_pts?.value, pts.total)} · contraataque ${pct(pts.by_origin.fast_break_pts?.value, pts.total)} ·
        tras pérdida ${pct(pts.by_origin.pts_from_tov?.value, pts.total)}.</p>` : ""}
      <h3>Historial</h3>
      ${d.h2h.games.length ? `<p>${esc(s.team.name)} ${d.h2h.record.wins_a} – ${d.h2h.record.wins_b} ${esc(s.rival.name)}: ${d.h2h.games.slice(0, 6).map(g =>
        `${_fmtDate(g.date)} ${g.score_a}–${g.score_b} (${g.venue})`).join(" · ")}</p>` : "<p>Sin historial entre estos equipos.</p>"}
      <h3>Coincidencia en cancha: mejores cruces de quintetos</h3>
      ${crosses.length ? `<table class="prx-table"><thead><tr><th>Nuestro quinteto</th><th>Su quinteto</th><th>Pos</th><th>Net ±</th></tr></thead><tbody>
        ${crosses.map(r => `<tr><td>${esc(r.own_name)}</td><td>${esc(r.opp_name)}</td><td>${DEC1(r.possessions)}</td>
          <td>${signed(r.net_rating)}${isNull(r.net_band) ? "" : ` ±${DEC2(r.net_band)}`}</td></tr>`).join("")}</tbody></table>`
        : "<p>Sin cruces con muestra suficiente.</p>"}
      <p class="prx-legend">${esc(LEGEND)}</p>
    </div>`;
  const node = document.createElement("div");
  node.className = `prx ${png ? "prx-png" : "prx-print"}`;
  node.innerHTML = page1 + page2;
  return node;
}

function _csvBlob() {
  const d = _data, s = d.summary;
  const columns = [
    { label: "Bloque", fmt: "text" }, { label: "Elemento", fmt: "text" }, { label: "Detalle", fmt: "text" },
    { label: "Valor propio", fmt: "text" }, { label: "Valor rival", fmt: "text" },
    { label: "Percentil propio", fmt: "int" }, { label: "Percentil rival", fmt: "int" },
    { label: "Diferencia / Net", fmt: "dec2" }, { label: "Posesiones", fmt: "dec1" }, { label: "Minutos", fmt: "dec1" },
    { label: "Muestra", fmt: "text" },
  ];
  const rows = [];
  for (const [block, list] of [["Ventaja", d.advantages], ["Amenaza", d.threats]]) {
    for (const i of list) rows.push([block, i.title, i.text, `${i.own_label} ${fmtBy(i.own_fmt, i.own)}`,
      `${i.ref_label} ${fmtBy(i.ref_fmt, i.ref)}`, i.own_pct, i.ref_pct, i.edge, null, null, null]);
  }
  for (const r of d.rival_lineups?.rows || []) {
    rows.push(["Quinteto rival", r.name, `PJ ${r.games}`, null, null, null, null, r.net_rating, r.possessions, r.minutes, r.sample?.level || ""]);
  }
  for (const r of d.matchups?.quinteto?.rows || []) {
    rows.push(["Cruce de quintetos", r.own_name, r.opp_name, `${r.pts_for}`, `${r.pts_against}`, null, null, r.net_rating,
      r.possessions, r.minutes, r.sample?.level || ""]);
  }
  return toCSV({
    meta: {
      title: `Preparar partido — ${s.team.name} vs ${s.rival.name}`,
      entity: { name: `${s.team.name} vs ${s.rival.name}` },
      competition: { label: s.competition.label },
      filters: [{ label: "Partidos del rival", value: s.last ? `últimos ${s.last}` : "todos" }],
      generated_at: s.generated_at,
    },
    columns, rows,
  });
}
