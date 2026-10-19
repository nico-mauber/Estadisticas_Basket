// ── Vista Analizar Partido (F-07 frontend) ──────────────────────────────────
import { api } from "../api.js";
import { fmtNumber, fmtMetric, PCT, DEC1, DEC2, isNull, nullDisplay } from "../core/format.js";
import { metricLabel, groupsFor } from "../core/catalog.js";
import { drawScoreTimeline } from "../charts.js";
import { shotChart, bindZoneTooltips } from "./shot-chart.js";
import { sampleBadge } from "./sample-badge.js";
import { createDataTable, dtLoading, dtError, dtEmpty } from "./data-table.js";
import { momentumHTML } from "./momentum-panel.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

const RATING_KEYS = ["oer", "der", "net_rating", "pace", "efg_pct", "ts_pct", "to_pct", "or_pct", "ft_rate"];
const RATING_LABELS = {
  oer: "OER", der: "DER", net_rating: "Net", pace: "Pace",
  efg_pct: "eFG%", ts_pct: "TS%", to_pct: "TO%", or_pct: "OR%", ft_rate: "FT Rate",
};
const PCT_KEYS = new Set(["efg_pct", "ts_pct", "to_pct", "or_pct", "ft_rate"]);
function _fmtRating(key, obj) {
  if (!obj || isNull(obj.value)) return nullDisplay(obj?.reason);
  return PCT_KEYS.has(key) ? PCT(obj.value) : DEC2(obj.value);
}

const BOX_COLS = ["pts","fgm2","fga2","fgm3","fga3","ftm","fta","orb","drb","trb","ast","tov","stl","blk","pf"];
const BOX_LABELS = {
  pts:"PTS", fgm2:"2M", fga2:"2A", fgm3:"3M", fga3:"3A", ftm:"TLM", fta:"TLA",
  orb:"RO", drb:"RD", trb:"RT", ast:"AST", tov:"PER", stl:"ROB", blk:"TAP", pf:"FP",
};

const EVENT_TYPE_LABELS = {
  tiro:"Tiro", tiro_libre:"TL", rebote:"Rebote", asistencia:"Asistencia",
  perdida:"Pérdida", robo:"Robo", tapon:"Tapón", falta:"Falta",
  cambio:"Cambio", tiempo_muerto:"Timeout", otro:"Otro",
};

let _detail = null;
let _el = null;
let _tab = "resumen";
let _pbpData = null;
let _pbpFilters = { types: null, period: null, player: null };
let _shotsHome = null;
let _shotsAway = null;
let _matchupsData = null;
let _momentumData = null;

function _destroy() {
  _detail = null;
  _pbpData = null;
  _shotsHome = null;
  _shotsAway = null;
  _matchupsData = null;
  _momentumData = null;
  _tab = "resumen";
  _pbpFilters = { types: null, period: null, player: null };
}

export async function renderGameView(el, gameId) {
  _destroy();
  _el = el;
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando partido…</p>';

  try {
    _detail = await api.game(gameId);
  } catch (e) {
    el.innerHTML = `<p class="empty below-avg">${esc(e.message || "No se pudo cargar el partido")}</p>`;
    return;
  }
  if (!_detail || !_detail.game) {
    el.innerHTML = '<p class="empty">Partido no encontrado.</p>';
    return;
  }
  _renderShell();
}

function _renderShell() {
  const g = _detail.game;
  const winner = g.home_score > g.away_score ? "home" : (g.away_score > g.home_score ? "away" : null);
  const ot = g.overtimes ? ` (${g.overtimes} PR)` : "";

  const tabs = [
    { id: "resumen", label: "Resumen" },
    { id: "box", label: "Box Score" },
    { id: "tiros", label: "Tiros" },
    { id: "jugadas", label: "Jugadas" },
    { id: "quintetos", label: "Quintetos" },
    { id: "cruces", label: "Cruces" },
    { id: "momentum", label: "Momentum" },
  ];

  _el.innerHTML = `
    <div class="gv-header card">
      <div class="gv-meta">${esc(g.competition_label)} · ${g.date || ""}${ot}</div>
      <div class="gv-score">
        <span class="gv-team ${winner === 'home' ? 'gv-winner' : ''}">${esc(g.home_team)}</span>
        <span class="gv-pts">${g.home_score}</span>
        <span class="gv-sep">–</span>
        <span class="gv-pts">${g.away_score}</span>
        <span class="gv-team ${winner === 'away' ? 'gv-winner' : ''}">${esc(g.away_team)}</span>
      </div>
      ${g.needs_reprocess ? '<div class="gv-warn">Partido importado con versión anterior. Reprocesá para obtener datos completos.</div>' : ''}
    </div>
    <div class="gv-tabs">
      ${tabs.map(t => `<button class="gv-tab${t.id === _tab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join("")}
    </div>
    <div class="gv-body" id="gv-body"></div>`;

  _el.querySelectorAll(".gv-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      _tab = btn.dataset.tab;
      _el.querySelectorAll(".gv-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === _tab));
      _renderTab();
    });
  });
  _renderTab();
}

function _renderTab() {
  const body = document.getElementById("gv-body");
  if (!body) return;
  switch (_tab) {
    case "resumen":   return _renderResumen(body);
    case "box":       return _renderBox(body);
    case "tiros":     return _renderTiros(body);
    case "jugadas":   return _renderJugadas(body);
    case "quintetos": return _renderQuintetos(body);
    case "cruces":    return _renderCruces(body);
    case "momentum":  return _renderMomentum(body);
  }
}

// ── Resumen ──────────────────────────────────────────────────────────────────
function _renderResumen(el) {
  const g = _detail.game;
  const tl = _detail.timeline;
  const partials = _detail.partials;
  const std = _detail.standard;

  let html = "";

  // Parciales
  if (partials?.length) {
    html += `<div class="card gv-partials">
      <div class="card-title">Parciales</div>
      <table class="gv-partials-table">
        <thead><tr><th></th>${partials.map(p => `<th>${esc(p.label)}</th>`).join("")}<th>Total</th></tr></thead>
        <tbody>
          <tr><td class="td-team">${esc(g.home_team)}</td>${partials.map(p => `<td>${p.home}</td>`).join("")}<td><strong>${g.home_score}</strong></td></tr>
          <tr><td class="td-team">${esc(g.away_team)}</td>${partials.map(p => `<td>${p.away}</td>`).join("")}<td><strong>${g.away_score}</strong></td></tr>
        </tbody>
      </table>
    </div>`;
  }

  // Timeline
  if (tl) {
    html += `<div class="card">
      <div class="card-title">Línea de tiempo del marcador</div>
      <canvas id="gv-timeline-canvas"></canvas>
      <div class="gv-tl-stats">
        <span>Cambios de ventaja: <strong>${tl.lead_changes}</strong></span>
        <span>Empates: <strong>${tl.ties}</strong></span>
        <span>Mayor ventaja ${esc(g.home_team)}: <strong>${tl.biggest_lead?.home?.pts || 0}</strong></span>
        <span>Mayor ventaja ${esc(g.away_team)}: <strong>${tl.biggest_lead?.away?.pts || 0}</strong></span>
        ${tl.runs?.length ? `<span>Rachas (≥${tl.run_min_points} pts): <strong>${tl.runs.length}</strong></span>` : ""}
      </div>
    </div>`;
  }

  // Ratings por período
  if (partials?.length && partials.some(p => p.ratings)) {
    html += `<div class="card">
      <div class="card-title">Ratings por período</div>
      <div class="gv-period-ratings">${_periodRatingsHTML(partials, g)}</div>
    </div>`;
  }

  // Standard comparison
  if (std?.home && std?.away) {
    html += `<div class="card">
      <div class="card-title">Conjunto estándar</div>
      <div class="gv-std-compare">${_stdCompareHTML(std, g)}</div>
    </div>`;
  }

  el.innerHTML = html;

  // Draw timeline chart
  if (tl) {
    setTimeout(() => {
      drawScoreTimeline("gv-timeline-canvas", tl, {
        homeName: g.home_team, awayName: g.away_team,
      });
    }, 0);
  }
}

function _periodRatingsHTML(partials, g) {
  const keys = ["oer", "der", "efg_pct", "pace"];
  let html = '<table class="gv-ratings-table"><thead><tr><th></th>';
  for (const p of partials) html += `<th colspan="2">${esc(p.label)}</th>`;
  html += "</tr><tr><th></th>";
  for (const p of partials) html += `<th>${esc(g.home_code)}</th><th>${esc(g.away_code)}</th>`;
  html += "</tr></thead><tbody>";
  for (const k of keys) {
    html += `<tr><td>${RATING_LABELS[k] || k}</td>`;
    for (const p of partials) {
      const h = p.ratings?.home?.[k];
      const a = p.ratings?.away?.[k];
      html += `<td>${_fmtRating(k, h)}</td><td>${_fmtRating(k, a)}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

function _stdCompareHTML(std, g) {
  const keys = RATING_KEYS;
  let html = '<table class="gv-std-table"><thead><tr><th></th>';
  html += `<th>${esc(g.home_code)}</th><th>${esc(g.away_code)}</th></tr></thead><tbody>`;
  for (const k of keys) {
    const h = std.home?.[k];
    const a = std.away?.[k];
    html += `<tr><td>${RATING_LABELS[k] || k}</td><td>${_fmtRating(k, h)}</td><td>${_fmtRating(k, a)}</td></tr>`;
  }
  html += "</tbody></table>";
  return html;
}

// ── Box Score ────────────────────────────────────────────────────────────────
function _renderBox(el) {
  const g = _detail.game;
  const box = _detail.box;
  const players = _detail.players || [];

  let html = "";
  for (const side of ["home", "away"]) {
    const team = box?.[side];
    const teamCode = side === "home" ? g.home_code : g.away_code;
    const teamName = side === "home" ? g.home_team : g.away_team;
    const sidePlayers = players.filter(p => p.side === side).sort((a, b) => {
      if (a.starter && !b.starter) return -1;
      if (!a.starter && b.starter) return 1;
      return (b.minutes || 0) - (a.minutes || 0);
    });

    html += `<div class="card">
      <div class="card-title">${esc(teamName)} (${esc(teamCode)})</div>
      <div class="dt-table-wrap">
        <table class="gv-box-table search-table">
          <thead><tr><th class="dt-sticky">Jugador</th><th>Min</th>${BOX_COLS.map(c => `<th>${BOX_LABELS[c]}</th>`).join("")}<th>+/−</th></tr></thead>
          <tbody>${sidePlayers.map(p => {
            if (p.dnp) return `<tr class="dt-row-low"><td class="dt-sticky">${esc(p.player_name)}${p.jersey ? ` #${p.jersey}` : ""}</td><td colspan="${BOX_COLS.length + 2}" class="td-muted">DNP</td></tr>`;
            return `<tr>
              <td class="dt-sticky">${p.starter ? "★ " : ""}${esc(p.player_name)}${p.jersey ? ` #${p.jersey}` : ""}</td>
              <td>${fmtNumber(p.minutes, 1)}</td>
              ${BOX_COLS.map(c => `<td>${_playerBoxVal(p, c)}</td>`).join("")}
              <td>${p.plus_minus != null ? (p.plus_minus > 0 ? "+" : "") + p.plus_minus : "—"}</td>
            </tr>`;
          }).join("")}</tbody>
          ${team?.official ? `<tfoot><tr class="dt-foot"><td class="dt-sticky">Total</td><td></td>${BOX_COLS.map(c => `<td>${team.official[c] ?? "—"}</td>`).join("")}<td></td></tr></tfoot>` : ""}
        </table>
      </div>
    </div>`;
  }

  // Conciliación
  const checks = box?.checks;
  if (checks) {
    const ok = checks.ok;
    html += `<div class="card">
      <div class="card-title">Conciliación ${ok ? "✓" : "⚠"}</div>
      <ul class="gv-checks">${checks.items.map(c =>
        `<li class="${c.ok === true ? 'gv-check-ok' : c.ok === false ? 'gv-check-fail' : 'gv-check-na'}">${esc(c.check)}: ${c.ok === true ? "OK" : c.ok === false ? "Falla" : "N/A"}</li>`
      ).join("")}</ul>
    </div>`;
  }

  el.innerHTML = html;
}

function _playerBoxVal(p, col) {
  const m = p.metrics?.[col];
  if (m && m.value != null) return fmtNumber(m.value, 0);
  const raw = p[col];
  if (raw != null) return fmtNumber(raw, 0);
  return "—";
}

// ── Tiros ────────────────────────────────────────────────────────────────────
async function _renderTiros(el) {
  const g = _detail.game;
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando tiros…</p>';

  try {
    const [home, away] = await Promise.all([
      _shotsHome || api.gameShots(g.game_id, { team: g.home_code }),
      _shotsAway || api.gameShots(g.game_id, { team: g.away_code }),
    ]);
    _shotsHome = home;
    _shotsAway = away;
  } catch (e) {
    el.innerHTML = `<p class="empty below-avg">${esc(e.message || "No se pudo cargar los tiros")}</p>`;
    return;
  }

  el.innerHTML = `
    <div class="gv-shots-row">
      <div class="card gv-shot-card">
        <div class="card-title">${esc(g.home_team)}</div>
        <div id="gv-shot-home"></div>
      </div>
      <div class="card gv-shot-card">
        <div class="card-title">${esc(g.away_team)}</div>
        <div id="gv-shot-away"></div>
      </div>
    </div>`;

  for (const [data, id] of [[_shotsHome, "gv-shot-home"], [_shotsAway, "gv-shot-away"]]) {
    const wrap = document.getElementById(id);
    if (!wrap || !data) continue;
    wrap.innerHTML = shotChart(data, { colorBy: "none" });
    bindZoneTooltips(wrap, data);
  }
}

// ── Jugadas (PBP) ────────────────────────────────────────────────────────────
async function _renderJugadas(el) {
  const g = _detail.game;
  if (!g.has_pbp) {
    el.innerHTML = '<p class="empty">Este partido no tiene play-by-play.</p>';
    return;
  }

  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando jugadas…</p>';

  try {
    if (!_pbpData) _pbpData = await api.gamePbp(g.game_id);
  } catch (e) {
    el.innerHTML = `<p class="empty below-avg">${esc(e.message || "No se pudo cargar las jugadas")}</p>`;
    return;
  }

  const pbp = _pbpData;
  const typeGroups = pbp.type_groups || [];
  const events = pbp.events || [];

  // Collect periods + players for filters
  const periodSet = new Set();
  const playerSet = new Set();
  for (const ev of events) {
    periodSet.add(ev.period_label);
    if (ev.player) playerSet.add(ev.player);
  }
  const periods = [...periodSet];
  const players = [...playerSet].sort();

  el.innerHTML = `
    <div class="card">
      <div class="card-title">Jugada a jugada (${pbp.total} eventos, ${pbp.count} filtrados)</div>
      <div class="gv-pbp-filters">
        <select id="gv-pbp-period"><option value="">Período (todos)</option>${periods.map(p => `<option value="${p}">${p}</option>`).join("")}</select>
        <select id="gv-pbp-type"><option value="">Tipo (todos)</option>${typeGroups.map(tg => `<option value="${tg.key}">${EVENT_TYPE_LABELS[tg.key] || tg.key} (${tg.count})</option>`).join("")}</select>
        <select id="gv-pbp-player"><option value="">Jugador (todos)</option>${players.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select>
      </div>
      <div class="dt-table-wrap" id="gv-pbp-table"></div>
    </div>`;

  _renderPbpTable(events);

  // filter bindings
  const filters = ["gv-pbp-period", "gv-pbp-type", "gv-pbp-player"];
  for (const fid of filters) {
    document.getElementById(fid)?.addEventListener("change", () => _applyPbpFilter(events));
  }
}

function _applyPbpFilter(allEvents) {
  const period = document.getElementById("gv-pbp-period")?.value;
  const type = document.getElementById("gv-pbp-type")?.value;
  const player = document.getElementById("gv-pbp-player")?.value;
  let filtered = allEvents;
  if (period) filtered = filtered.filter(e => e.period_label === period);
  if (type) filtered = filtered.filter(e => e.type_group === type);
  if (player) filtered = filtered.filter(e => e.player === player);
  _renderPbpTable(filtered);
}

function _renderPbpTable(events) {
  const el = document.getElementById("gv-pbp-table");
  if (!el) return;
  const g = _detail.game;

  if (!events.length) {
    el.innerHTML = '<p class="empty">Sin eventos para este filtro.</p>';
    return;
  }

  const rows = events.slice(0, 200).map(ev => {
    const isHome = ev.team_code === g.home_code;
    return `<tr>
      <td>${esc(ev.period_label)}</td>
      <td>${esc(ev.clock)}</td>
      <td class="${isHome ? '' : 'td-muted'}">${isHome ? _pbpDesc(ev) : ''}</td>
      <td style="text-align:center">${ev.score ? `${ev.score.home}-${ev.score.away}` : ''}</td>
      <td class="${!isHome ? '' : 'td-muted'}">${!isHome ? _pbpDesc(ev) : ''}</td>
    </tr>`;
  }).join("");

  el.innerHTML = `
    <table class="gv-pbp search-table">
      <thead><tr><th>Per</th><th>Reloj</th><th>${esc(g.home_team)}</th><th>Marcador</th><th>${esc(g.away_team)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${events.length > 200 ? `<p class="td-muted" style="text-align:center;margin-top:8px">Mostrando 200 de ${events.length} eventos</p>` : ""}`;
}

function _pbpDesc(ev) {
  const parts = [];
  if (ev.player) parts.push(`<strong>${esc(ev.player)}</strong>`);
  const label = EVENT_TYPE_LABELS[ev.type_group] || ev.action_type || "";
  parts.push(label);
  if (ev.sub_type) parts.push(`(${esc(ev.sub_type)})`);
  if (ev.success === true) parts.push("✓");
  if (ev.success === false) parts.push("✗");
  return parts.join(" ");
}

// ── Quintetos ────────────────────────────────────────────────────────────────
function _renderQuintetos(el) {
  const g = _detail.game;
  const lineups = _detail.lineups;

  if (!lineups) {
    el.innerHTML = '<p class="empty">Sin datos de quintetos (requiere play-by-play).</p>';
    return;
  }

  let html = "";
  for (const side of ["home", "away"]) {
    const teamName = side === "home" ? g.home_team : g.away_team;
    const data = lineups[side] || [];

    if (!data.length) {
      html += `<div class="card"><div class="card-title">${esc(teamName)}</div><p class="empty">Sin quintetos.</p></div>`;
      continue;
    }

    const sorted = [...data].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
    html += `<div class="card">
      <div class="card-title">${esc(teamName)} — ${data.length} quinteto${data.length === 1 ? "" : "s"}</div>
      <div class="dt-table-wrap">
        <table class="gv-lineup-table search-table">
          <thead><tr><th>Quinteto</th><th>Min</th><th>Pos</th><th>OER</th><th>DER</th><th>Net</th><th>eFG%</th><th>Muestra</th></tr></thead>
          <tbody>${sorted.map(lu => {
            const m = lu.metrics || {};
            return `<tr>
              <td>${esc(lu.name)}</td>
              <td>${fmtNumber(lu.minutes, 1)}</td>
              <td>${fmtNumber(lu.possessions, 1)}</td>
              <td>${_fmtRating("oer", m.oer)}</td>
              <td>${_fmtRating("der", m.der)}</td>
              <td>${_fmtRating("net_rating", m.net_rating)}</td>
              <td>${_fmtRating("efg_pct", m.efg_pct)}</td>
              <td>${sampleBadge(lu.sample, { compact: true })}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

// ── Cruces (Matchups) ────────────────────────────────────────────────────────
async function _renderCruces(el) {
  const g = _detail.game;
  if (!g.has_pbp) {
    el.innerHTML = '<p class="empty">Sin datos de cruces (requiere play-by-play).</p>';
    return;
  }

  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando cruces…</p>';

  try {
    if (!_matchupsData) _matchupsData = await api.gameMatchups(g.game_id);
  } catch (e) {
    el.innerHTML = `<p class="empty below-avg">${esc(e.message || "No se pudo cargar los cruces")}</p>`;
    return;
  }

  const data = _matchupsData;
  const matchups = data.rows || [];
  if (!matchups.length) {
    el.innerHTML = `<p class="empty">${data.reason === "titulares_incompletos" ? "Titulares incompletos: no se pueden calcular cruces." : "Sin cruces disponibles."}</p>`;
    return;
  }

  const rows = matchups.slice(0, 50).map(mu => `<tr>
    <td>${esc(mu.own_name || "—")}</td>
    <td>${esc(mu.opp_name || "—")}</td>
    <td>${fmtNumber(mu.possessions, 1)}</td>
    <td>${mu.pts_for != null ? fmtNumber(mu.pts_for, 0) : "—"}</td>
    <td>${mu.oer != null ? DEC2(mu.oer) : "—"}</td>
    <td>${fmtNumber(mu.minutes, 1)}</td>
    <td>${sampleBadge(mu.sample, { compact: true })}</td>
  </tr>`).join("");

  el.innerHTML = `<div class="card">
    <div class="card-title">Cruces quinteto (${matchups.length})</div>
    <div class="dt-table-wrap">
      <table class="gv-matchup-table search-table">
        <thead><tr><th>Local</th><th>Visitante</th><th>Pos</th><th>PTS</th><th>OER</th><th>Min</th><th>Muestra</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${matchups.length > 50 ? `<p class="td-muted" style="text-align:center;margin-top:8px">Mostrando 50 de ${matchups.length}</p>` : ""}
  </div>`;
}

// ── Momentum (F-02): estado al cierre ────────────────────────────────────────
async function _renderMomentum(el) {
  const g = _detail.game;
  if (!g.has_pbp) {
    el.innerHTML = '<p class="empty">Sin jugada a jugada: Momentum no disponible.</p>';
    return;
  }
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando momentum…</p>';
  try {
    if (!_momentumData) _momentumData = await api.momentum(g.game_id);
  } catch (e) {
    el.innerHTML = `<p class="empty below-avg">${esc(e.message || "No se pudo cargar el momentum")}</p>`;
    return;
  }
  if (_tab !== "momentum") return;
  el.innerHTML = momentumHTML(_momentumData, { final: _momentumData.status === "finalizado" });
}
