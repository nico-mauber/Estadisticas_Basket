// ── Vista Analizar Partido (F-07 frontend) ──────────────────────────────────
import { api } from "../api.js";
import { fmtNumber, fmtMetric, PCT, DEC1, DEC2, isNull, nullDisplay } from "../core/format.js";
import { metricLabel, groupsFor, loadCatalog } from "../core/catalog.js";
import { drawScoreTimeline } from "../charts.js";
import { shotChart, bindZoneTooltips } from "./shot-chart.js";
import { sampleBadge } from "./sample-badge.js";
import { createDataTable, dtLoading, dtError, dtEmpty, mountTable } from "./data-table.js";
import { momentumHTML } from "./momentum-panel.js";
import { renderClockPanel } from "./clock-panel.js";
import { mountGameExport } from "./game-report.js";

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
  tiro:"Tiro de campo", tiro_libre:"TL", rebote:"Rebote", asistencia:"Asistencia",
  perdida:"Pérdida", robo:"Robo", tapon:"Tapón", falta:"Falta",
  cambio:"Cambio", tiempo_muerto:"Timeout", otro:"Otro",
};

// Bloque con error: mensaje + "Reintentar" (sin romper el resto de la vista). Sin conexión se avisa distinto.
function _blockError(el, msg, retry) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  el.innerHTML = `<div class="empty below-avg gv-block-error">
    <p>${esc(offline ? "Sin conexión: no se pudo cargar este bloque." : msg)}</p>
    <button type="button" class="btn btn-ghost btn-sm gv-retry">Reintentar</button></div>`;
  el.querySelector(".gv-retry")?.addEventListener("click", retry);
}

let _detail = null;
let _el = null;
let _tab = "resumen";
let _pbpData = null;
let _pbpFilters = { types: null, period: null, player: null };
let _shotsHome = null;
let _shotsAway = null;
let _matchupsData = null;
let _momentumData = null;
let _opts = {};
let _shotFilters = { quarter: "", clock: "" };
let _matchupLevel = "quinteto";

const TAB_IDS = ["resumen", "box", "tiros", "jugadas", "quintetos", "cruces", "momentum", "reloj"];
// Nodo aparte para que el traductor (F-21) lo encuentre igual en todos los avisos.
const NO_PBP_HINT = '<span class="gv-hint">Reimportalo desde Datos › Calidad (reprocesar) si FIBA ya publicó el jugada a jugada.</span>';
const _live = () => _opts.mode === "vivo";

function _destroy() {
  _detail = null;
  _pbpData = null;
  _shotsHome = null;
  _shotsAway = null;
  _matchupsData = null;
  _momentumData = null;
  _tab = "resumen";
  _pbpFilters = { types: null, period: null, player: null };
  _shotFilters = { quarter: "", clock: "" };
  _matchupLevel = "quinteto";
}

/** Vista de un partido. `mode: "vivo"` (F-01, CA-2) reutiliza el componente con un `payload` del mismo shape que
 *  `GET /api/game/<id>`: no descarga nada, oculta exportación y conciliación y dibuja box y quintetos desde el payload.
 *  `tab` abre esa pestaña ("analizar" = Resumen) y `onTab(tab)` avisa cada cambio para la dirección (CA-3). */
export async function renderGameView(el, gameId, { mode = "analizar", payload = null, tab = null, onTab = null, onOpenPlayer = null } = {}) {
  _destroy();
  _el = el;
  _opts = { mode, onTab, onOpenPlayer };
  if (tab && TAB_IDS.includes(tab)) _tab = tab;
  if (payload) {
    _detail = payload;
  } else {
    el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando partido…</p>';
    try {
      _detail = await api.game(gameId);
    } catch (e) {
      _blockError(el, e.message || "No se pudo cargar el partido", () => renderGameView(el, gameId, { mode, tab: _tab, onTab, onOpenPlayer }));
      return;
    }
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
  const ot = g.overtimes ? ` · ${g.overtimes} ${g.overtimes === 1 ? "prórroga" : "prórrogas"}` : "";

  const tabs = [
    { id: "resumen", label: "Resumen" },
    { id: "box", label: "Box Score" },
    { id: "tiros", label: "Tiros" },
    { id: "jugadas", label: "Jugadas" },
    { id: "quintetos", label: "Quintetos" },
    { id: "cruces", label: "Cruces" },
    { id: "momentum", label: "Momentum" },
    { id: "reloj", label: "Reloj y puntos" },
  ];

  _el.innerHTML = `
    <div class="gv-header card">
      <div class="gv-meta">${esc([g.competition_label, g.date].filter(Boolean).join(" · "))}${ot}</div>
      <div class="gv-score">
        <span class="gv-team ${winner === 'home' ? 'gv-winner' : ''}">${esc(g.home_team)}</span>
        <span class="gv-pts">${g.home_score}</span>
        <span class="gv-sep">–</span>
        <span class="gv-pts">${g.away_score}</span>
        <span class="gv-team ${winner === 'away' ? 'gv-winner' : ''}">${esc(g.away_team)}</span>
      </div>
      ${_live() ? "" : '<div class="gv-export" id="gv-export"></div>'}
      ${g.needs_reprocess && !_live() ? '<div class="gv-warn">Partido importado con una versión anterior: reprocesalo desde Datos › Calidad para ver parciales oficiales y rebotes de equipo.</div>' : ''}
    </div>
    <div class="gv-tabs">
      ${tabs.map(t => `<button class="gv-tab${t.id === _tab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join("")}
    </div>
    <div class="gv-body" id="gv-body"></div>`;

  _el.querySelectorAll(".gv-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      _tab = btn.dataset.tab;
      _el.querySelectorAll(".gv-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === _tab));
      _opts.onTab?.(_tab);
      _renderTab();
    });
  });
  if (!_live()) {
    mountGameExport(document.getElementById("gv-export"),
      () => ({ detail: _detail, shots: { home: _shotsHome, away: _shotsAway }, matchups: _matchupsData }));
    _prefetch();
  }
  _renderTab();
}

// Carga en segundo plano lo que el informe de scouting necesita (tiros y cruces); sin error visible.
function _prefetch() {
  const g = _detail.game, id = g.game_id;
  api.gameShots(id, { team: g.home_code }).then(d => { if (_detail?.game.game_id === id) _shotsHome = d; }).catch(() => {});
  api.gameShots(id, { team: g.away_code }).then(d => { if (_detail?.game.game_id === id) _shotsAway = d; }).catch(() => {});
  if (g.has_pbp) api.gameMatchups(id).then(d => { if (_detail?.game.game_id === id) _matchupsData = d; }).catch(() => {});
}

// Pestañas que necesitan datos del servidor sobre un partido guardado: en vivo se ven al finalizar.
const _SERVER_TABS = new Set(["tiros", "jugadas", "cruces", "momentum", "reloj"]);

function _renderTab() {
  const body = document.getElementById("gv-body");
  if (!body) return;
  if (_live() && _SERVER_TABS.has(_tab)) {
    body.innerHTML = '<p class="empty">Disponible cuando el partido termine y quede guardado.</p>';
    return;
  }
  switch (_tab) {
    case "resumen":   return _renderResumen(body);
    case "box":       return _renderBox(body);
    case "tiros":     return _renderTiros(body);
    case "jugadas":   return _renderJugadas(body);
    case "quintetos": return _renderQuintetos(body);
    case "cruces":    return _renderCruces(body);
    case "momentum":  return _renderMomentum(body);
    case "reloj":     return _renderReloj(body);
  }
}

// Cómo anota cada equipo en este partido y en qué tramo del reloj de posesión tira (A-05).
function _renderReloj(el) {
  const g = _detail.game;
  if (!g.has_pbp) {
    el.innerHTML = `<p class="empty">Sin jugada a jugada: el reloj de posesión no está disponible. ${NO_PBP_HINT}</p>`;
    return;
  }
  renderClockPanel(el, g.home_code, {
    mode: "game", gameId: g.game_id,
    teams: [{ code: g.home_code, name: g.home_team }, { code: g.away_code, name: g.away_team }],
  });
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
    const src = _detail.partials_source === "oficial" ? "Fuente: box oficial de FIBA."
      : "Reconstruidos del jugada a jugada (el box oficial de este partido no trae los parciales).";
    html += `<div class="card gv-partials">
      <div class="card-title">Parciales</div>
      <p class="td-muted gv-partials-src">${src}</p>
      <table class="gv-partials-table">
        <thead><tr><th></th>${partials.map(p => `<th>${esc(p.label)}</th>`).join("")}<th>Total</th></tr></thead>
        <tbody>
          <tr><td class="td-team">${esc(g.home_team)}</td>${partials.map(p => `<td>${p.home}</td>`).join("")}<td><strong>${g.home_score}</strong></td></tr>
          <tr><td class="td-team">${esc(g.away_team)}</td>${partials.map(p => `<td>${p.away}</td>`).join("")}<td><strong>${g.away_score}</strong></td></tr>
        </tbody>
      </table>
    </div>`;
  }

  if (!g.has_pbp) {
    html += `<div class="card"><p class="empty">Este partido no tiene jugada a jugada: no hay línea de tiempo, rachas ni ratings por período. ${NO_PBP_HINT}</p></div>`;
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

  // Ratings por período (del jugada a jugada)
  if (g.has_pbp && partials?.length && partials.some(p => p.ratings)) {
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
// Analizar: una tabla completa (T-06 `game_players`) por equipo, ordenable y exportable con la cabecera del partido
// (CA-12); en vivo, el box se dibuja desde el payload.
// Tabla T-06 del partido: el catálogo de métricas tiene que estar cargado para las etiquetas de columna (pantalla y CSV).
const _loadTable = (id, extra) => async () => { await loadCatalog(); return api.table(id, _tableParams(extra)); };

function _tableParams(extra = {}) {
  const g = _detail.game;
  return { game: g.game_id, competition: g.competition_id ?? null, base: "total", ...extra };
}

function _openPlayerFromRow(row) {
  const m = /^player:(\d+)$/.exec(row.link || "");
  if (m) _opts.onOpenPlayer?.(Number(m[1]));
}

function _renderBox(el) {
  if (_live()) return _renderBoxClassic(el);
  const g = _detail.game;
  el.innerHTML = [["home", g.home_code, g.home_team], ["away", g.away_code, g.away_team]].map(([side, code, name]) =>
    `<div class="card"><div class="card-title">${esc(name)} (${esc(code)})</div><div id="gv-box-${side}"></div></div>`).join("")
    + `<div id="gv-checks"></div>`;
  for (const [side, code] of [["home", g.home_code], ["away", g.away_code]]) {
    mountTable(document.getElementById(`gv-box-${side}`),
      _loadTable("game_players", { team: code }),
      { tableId: "game_players", onRowClick: _opts.onOpenPlayer ? _openPlayerFromRow : null });
  }
  document.getElementById("gv-checks").innerHTML = _checksHTML(_detail.box?.checks);
}

function _checksHTML(checks) {
  if (!checks) return "";
  const pend = checks.items.find(c => c.check === "players_sum")?.unverified || [];
  return `<div class="card">
      <div class="card-title"><span>Conciliación con el box oficial</span> <span aria-hidden="true">${checks.ok ? "✓" : "⚠"}</span></div>
      <ul class="gv-checks">${checks.items.map(c =>
        `<li class="${c.ok === true ? 'gv-check-ok' : c.ok === false ? 'gv-check-fail' : 'gv-check-na'}"><span>${esc(c.label || c.check)}</span>: <span>${c.ok === true ? "OK" : c.ok === false ? "No cuadra" : "Sin datos"}</span></li>`
      ).join("")}</ul>
      ${pend.length ? `<p class="td-muted">Rebotes y pérdidas de equipo sin verificar: el partido se importó antes de que se guardaran. ${NO_PBP_HINT}</p>` : ""}
    </div>`;
}

function _renderBoxClassic(el) {
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
            if (p.dnp) return `<tr class="dt-row-low"><td class="dt-sticky">${esc(p.player_name)}${p.jersey ? ` #${p.jersey}` : ""}</td><td colspan="${BOX_COLS.length + 2}" class="td-muted">No jugó</td></tr>`;
            return `<tr>
              <td class="dt-sticky">${p.starter ? "★ " : ""}${esc(p.player_name)}${p.jersey ? ` #${p.jersey}` : ""}</td>
              <td>${fmtNumber(p.minutes, 1)}</td>
              ${BOX_COLS.map(c => `<td>${_playerBoxVal(p, c)}</td>`).join("")}
              <td>${p.plus_minus != null ? (p.plus_minus > 0 ? "+" : "") + p.plus_minus : "—"}</td>
            </tr>`;
          }).join("")}${_teamExtraRow(team)}</tbody>
          ${team?.official ? `<tfoot><tr class="dt-foot"><td class="dt-sticky">Total</td><td></td>${BOX_COLS.map(c => `<td>${team.official[c] ?? "—"}</td>`).join("")}<td></td></tr></tfoot>` : ""}
        </table>
      </div>
    </div>`;
  }

  if (!_live()) html += _checksHTML(box?.checks);

  el.innerHTML = html;
}

// Fila "Equipo": rebotes y pérdidas sin jugador (el total oficial los incluye).
function _teamExtraRow(team) {
  const x = team?.team_extra;
  if (!x || x.orb == null) return "";
  const v = { orb: x.orb, drb: x.drb, trb: (x.orb || 0) + (x.drb || 0), tov: x.tov };
  return `<tr class="td-muted"><td class="dt-sticky">Equipo (sin jugador)</td><td></td>${BOX_COLS.map(c => `<td>${v[c] ?? ""}</td>`).join("")}<td></td></tr>`;
}

function _playerBoxVal(p, col) {
  const m = p.metrics?.[col];
  if (m && m.value != null) return fmtNumber(m.value, 0);
  const raw = p[col];
  if (raw != null) return fmtNumber(raw, 0);
  return "—";
}

// ── Tiros ────────────────────────────────────────────────────────────────────
// Filtros de cuarto y tramo del reloj de posesión (A-05). Los tiros sin tramo (posesión incompleta) se informan
// aparte y nunca se cuentan como "temprano" (CA-6).
const CLOCK_LABELS = { temprano: "Temprano", medio: "Medio", tardio: "Tardío" };

function _shotParams(code) {
  const p = { team: code };
  if (_shotFilters.quarter) p.quarter = _shotFilters.quarter;
  if (_shotFilters.clock) p.clock = _shotFilters.clock;
  return p;
}

function _shotSummary(d) {
  const s = d?.summary;
  if (!s) return "";
  const parts = [`${fmtNumber(s.attempts, 0)} intentos`, `${fmtNumber(s.made, 0)} convertidos`];
  if (s.attempts) parts.push(`eFG% ${PCT(s.efg_pct)}`, `PPT ${DEC2(s.ppt)}`);
  const nb = s.no_band ? `<span class="gv-noband" title="Tiros de posesiones incompletas: no se asignan a ningún tramo">${fmtNumber(s.no_band, 0)} sin tramo</span>${_shotFilters.clock ? ' <span class="gv-noband">(fuera del filtro)</span>' : ""}` : "";
  const ign = (d.ignored || []).some(i => i.param === "clock") ? '<span class="td-muted"> · Sin jugada a jugada: el filtro de tramo no se aplica.</span>' : "";
  return `<p class="td-muted gv-shot-sum">${parts.join(" · ")}${nb ? " · " + nb : ""}${ign}</p>`;
}

async function _renderTiros(el) {
  const g = _detail.game;
  const filtered = !!(_shotFilters.quarter || _shotFilters.clock);
  const qOpts = [["", "Todos los cuartos"], ["1", "1.er cuarto"], ["2", "2.º cuarto"], ["3", "3.er cuarto"], ["4", "4.º cuarto"]]
    .concat(g.overtimes ? [["pr", "Prórroga"]] : []);
  const cOpts = [["", "Todo el reloj"], ...Object.entries(CLOCK_LABELS)];
  el.innerHTML = `
    <div class="gv-shot-filters">
      <label>Cuarto <select id="gv-shot-q">${qOpts.map(([v, l]) => `<option value="${v}"${v === _shotFilters.quarter ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Tramo del reloj <select id="gv-shot-c"${g.has_pbp ? "" : " disabled"}>${cOpts.map(([v, l]) => `<option value="${v}"${v === _shotFilters.clock ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      ${g.has_pbp ? "" : '<span class="td-muted">Sin jugada a jugada no hay tramo del reloj.</span>'}
    </div>
    <div id="gv-shots-body"><p class="empty"><span class="spinner"></span>Cargando tiros…</p></div>`;
  const onChange = () => {
    _shotFilters = { quarter: document.getElementById("gv-shot-q").value, clock: document.getElementById("gv-shot-c").value };
    _renderTiros(el);
  };
  document.getElementById("gv-shot-q").addEventListener("change", onChange);
  document.getElementById("gv-shot-c").addEventListener("change", onChange);

  const body = document.getElementById("gv-shots-body");
  let home, away;
  try {
    [home, away] = await Promise.all([
      !filtered && _shotsHome ? _shotsHome : api.gameShots(g.game_id, _shotParams(g.home_code)),
      !filtered && _shotsAway ? _shotsAway : api.gameShots(g.game_id, _shotParams(g.away_code)),
    ]);
    if (!filtered) { _shotsHome = home; _shotsAway = away; }
  } catch (e) {
    if (_tab !== "tiros") return;
    _blockError(body, e.message || "No se pudieron cargar los tiros", () => _renderTiros(el));
    return;
  }
  if (_tab !== "tiros" || !document.getElementById("gv-shots-body")) return;

  body.innerHTML = `
    <div class="gv-shots-row">
      <div class="card gv-shot-card">
        <div class="card-title">${esc(g.home_team)}</div>
        ${_shotSummary(home)}
        <div id="gv-shot-home"></div>
      </div>
      <div class="card gv-shot-card">
        <div class="card-title">${esc(g.away_team)}</div>
        ${_shotSummary(away)}
        <div id="gv-shot-away"></div>
      </div>
    </div>`;

  for (const [data, id] of [[home, "gv-shot-home"], [away, "gv-shot-away"]]) {
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
    el.innerHTML = `<p class="empty">Este partido no tiene jugada a jugada. ${NO_PBP_HINT}</p>`;
    return;
  }

  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando jugadas…</p>';

  try {
    if (!_pbpData) _pbpData = await api.gamePbp(g.game_id);
  } catch (e) {
    if (_tab !== "jugadas") return;
    _blockError(el, e.message || "No se pudo cargar las jugadas", () => _renderJugadas(el));
    return;
  }
  if (_tab !== "jugadas") return;

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
      <div class="card-title">Jugada a jugada <span class="td-muted gv-pbp-count" id="gv-pbp-count"></span></div>
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
  const total = _pbpData?.events?.length || 0;
  const cnt = document.getElementById("gv-pbp-count");
  if (cnt) cnt.textContent = events.length === total ? `(${fmtNumber(total, 0)} eventos)` : `(${fmtNumber(events.length, 0)} de ${fmtNumber(total, 0)} eventos)`;

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

// Subtipos de FIBA en castellano (el código crudo, p. ej. "drivinglayup", no se muestra).
const SUBTYPE_LABELS = {
  layup: "bandeja", drivinglayup: "bandeja en penetración", reverselayup: "bandeja reversa", tipinlayup: "palmeo",
  jumpshot: "en suspensión", pullupjumpshot: "tras bote", floatingjumpshot: "flotadora", turnaroundjumpshot: "en giro",
  stepbackjumpshot: "step-back", fadeaway: "cayendo hacia atrás", hookshot: "gancho", dunk: "volcada", alleyoop: "alley-oop",
  eurostep: "eurostep", personal: "personal", technical: "técnica", unsportsmanlike: "antideportiva",
  benchTechnical: "técnica al banco", coachTechnical: "técnica al entrenador", disqualifying: "descalificante",
  badpass: "mal pase", ballhandling: "manejo de balón", travel: "pasos", outofbounds: "fuera de la cancha",
  backcourt: "campo atrás", doubledribble: "doble dribling", "24sec": "24 segundos", "8sec": "8 segundos",
  "5sec": "5 segundos", "3sec": "3 segundos", in: "entra", out: "sale", full: "completo", won: "ganado", lost: "perdido",
  heldball: "balón retenido", startperiod: "inicio de período", start: "inicio", end: "fin",
};
const SUBTYPE_BY_ACTION = {
  "rebound:offensive": "ofensivo", "rebound:defensive": "defensivo", "foul:offensive": "ofensiva",
  "turnover:offensive": "falta ofensiva", "headcoachchallenge:foul": "falta",
};
function _subLabel(ev) {
  const st = ev.sub_type;
  if (!st) return "";
  const ft = /^(\d)of(\d)$/.exec(st);
  if (ft) return `${ft[1]} de ${ft[2]}`;
  return SUBTYPE_BY_ACTION[`${ev.action_type}:${st}`] || SUBTYPE_LABELS[st] || st;
}

function _pbpDesc(ev) {
  const parts = [];
  if (ev.player) parts.push(`<strong>${esc(ev.player)}</strong>`);
  const label = EVENT_TYPE_LABELS[ev.type_group] || ev.action_type || "";
  parts.push(`<span>${esc(label)}</span>`);
  const sub = _subLabel(ev);
  if (sub) parts.push(`<span class="td-muted">(${esc(sub)})</span>`);
  if (ev.success === true) parts.push("✓");
  if (ev.success === false) parts.push("✗");
  return parts.join(" ");
}

// ── Quintetos ────────────────────────────────────────────────────────────────
function _renderQuintetos(el) {
  const g = _detail.game;
  if (!g.has_pbp && !_detail.lineups) {
    el.innerHTML = `<p class="empty">Sin quintetos: este partido no tiene jugada a jugada. ${NO_PBP_HINT}</p>`;
    return;
  }
  if (_live()) return _renderQuintetosClassic(el);
  el.innerHTML = [["home", g.home_code, g.home_team], ["away", g.away_code, g.away_team]].map(([side, code, name]) =>
    `<div class="card"><div class="card-title">${esc(name)} (${esc(code)})</div><div id="gv-lu-${side}"></div></div>`).join("");
  for (const [side, code] of [["home", g.home_code], ["away", g.away_code]]) {
    mountTable(document.getElementById(`gv-lu-${side}`),
      _loadTable("game_lineups", { team: code }), { tableId: "game_lineups", collapsedRows: 8 });
  }
}

function _renderQuintetosClassic(el) {
  const g = _detail.game;
  const lineups = _detail.lineups;

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
// Tabla completa (T-06 `game_matchups`) por nivel. Un cruce mide lo que pasó mientras esos jugadores coincidieron en
// cancha: no dice quién defendió a quién (CA-14).
const MATCHUP_LEVELS = [
  ["quinteto", "Quinteto vs quinteto", {}],
  ["jugador", "Jugador vs jugador", {}],
  ["jugador_quinteto", "Jugador local vs quinteto visitante", { side: "home" }],
  ["jugador_quinteto_away", "Jugador visitante vs quinteto local", { side: "away", level: "jugador_quinteto" }],
];

function _renderCruces(el) {
  const g = _detail.game;
  if (!g.has_pbp) {
    el.innerHTML = `<p class="empty">Sin cruces: este partido no tiene jugada a jugada. ${NO_PBP_HINT}</p>`;
    return;
  }
  const cur = MATCHUP_LEVELS.find(l => l[0] === _matchupLevel) || MATCHUP_LEVELS[0];
  el.innerHTML = `<div class="card">
    <div class="card-title">Cruces</div>
    <p class="td-muted gv-matchup-legend">Coincidencia en cancha: cada fila suma lo que hizo cada lado mientras esos jugadores estuvieron juntos en la cancha. No indica quién defendió a quién. Las filas en gris tienen muestra baja.</p>
    <div class="pb-chips gv-matchup-levels" role="group" aria-label="Nivel">${MATCHUP_LEVELS.map(([id, label]) =>
      `<button type="button" class="filter-pill${id === cur[0] ? " active" : ""}" data-level="${id}">${label}</button>`).join("")}</div>
    <div id="gv-matchups-dt"></div>
  </div>`;
  el.querySelectorAll(".gv-matchup-levels .filter-pill").forEach(btn => btn.addEventListener("click", () => {
    _matchupLevel = btn.dataset.level;
    _renderCruces(el);
  }));
  const extra = { level: cur[2].level || cur[0], ...(cur[2].side ? { side: cur[2].side } : {}) };
  mountTable(document.getElementById("gv-matchups-dt"),
    _loadTable("game_matchups", extra), { tableId: "game_matchups", collapsedRows: 12 });
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
    if (_tab !== "momentum") return;
    _blockError(el, e.message || "No se pudo cargar el momentum", () => _renderMomentum(el));
    return;
  }
  if (_tab !== "momentum") return;
  el.innerHTML = momentumHTML(_momentumData, { final: _momentumData.status === "finalizado" });
}
