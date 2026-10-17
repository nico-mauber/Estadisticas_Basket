// ── Partido en vivo (F-01) ───────────────────────────────────────────────────
// Polling con setTimeout recursivo (no solapa respuestas lentas). Al finalizar el partido
// muestra la vista Analizar (F-07) con los datos ya persistidos.
import { api } from "../api.js";
import { PCT, DEC1, DEC2, isNull, nullDisplay } from "../core/format.js";
import { renderGameView } from "./game-view.js";
import { momentumHTML } from "./momentum-panel.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

const POLL_DEFAULT = 30;
const POLL_MIN = 10;
const POLL_MAX = 60;

const TEAM_ROWS = [
  ["oer", "OER"], ["der", "DER"], ["net_rating", "Net Rating"], ["ppp", "PPP"],
  ["ppt", "Pts por tiro"], ["possessions", "Posesiones"], ["pace", "Ritmo"],
];
const FACTOR_ROWS = [["efg_pct", "eFG%"], ["ts_pct", "TS%"], ["to_pct", "TO%"], ["or_pct", "OR%"], ["ft_rate", "FT Rate"]];
const PCT_KEYS = new Set(["efg_pct", "ts_pct", "to_pct", "or_pct", "ft_rate", "uso_pct"]);
const DEC1_KEYS = new Set(["possessions", "pace"]);
const LOWER_IS_BETTER = new Set(["der", "to_pct"]);
const NEUTRAL_KEYS = new Set(["possessions", "pace"]);

const SHOT_LABELS = {
  paint_pts: "Pintura", mid_pts: "Media distancia", three_pts: "Triples", ft_pts: "Tiros libres",
  otros_no_clasificado: "Otros / no clasificado",
};
const ORIGIN_LABELS = { second_chance_pts: "Segunda oportunidad", fast_break_pts: "Contraataque", pts_from_tov: "Tras pérdida rival" };
const CHAIN_COLS = [
  ["points_created", "Creados", "Puntos propios + puntos de sus asistencias"],
  ["points_from_assist", "De asist.", "Puntos de los tiros que asistió"],
  ["oreb_points", "Tras RO", "Puntos de las oportunidades que abrió con rebote ofensivo"],
  ["steal_points", "Tras robo", "Puntos de la posesión siguiente a sus robos"],
  ["turnover_cost", "Costo pérd.", "Puntos del rival tras sus pérdidas"],
];

let _el = null;
let _gameId = null;
let _url = null;
let _data = null;
let _timer = null;
let _token = 0;
let _pollSecs = POLL_DEFAULT;
let _offline = false;
let _tab = "vivo";
let _momentum = null;
let _momentumError = null;

export function destroyLiveView() {
  _token++;
  if (_timer) clearTimeout(_timer);
  _timer = null;
  _data = null;
  _momentum = null;
  _momentumError = null;
}

export async function renderLiveView(el, gameId, { url } = {}) {
  destroyLiveView();
  const token = _token;
  _el = el;
  _gameId = gameId;
  _url = url || null;
  _offline = false;
  _tab = "vivo";
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando partido…</p>';
  _pollSecs = await _loadPollSecs();
  if (token !== _token) return;
  _poll(token);
}

async function _loadPollSecs() {
  try {
    const s = await api.settings();
    const v = Number(s?.values?.["live.poll_secs"]);
    if (Number.isFinite(v)) return Math.min(POLL_MAX, Math.max(POLL_MIN, v));
  } catch { /* default */ }
  return POLL_DEFAULT;
}

async function _poll(token) {
  let data;
  try {
    data = await api.live(_gameId, _url ? { url: _url } : {});
  } catch (e) {
    if (token !== _token) return;
    if (_data) {
      _offline = true;
      _render();
    } else {
      _renderError(e);
      if (e.status === 404 || e.status === 400) return;
    }
    _schedule(token);
    return;
  }
  if (token !== _token) return;
  _offline = false;
  _data = data;
  if (data.status === "finalizado") {
    _renderFinished();
    return;
  }
  if (_tab === "momentum") await _loadMomentum(token);   // mismo ciclo: sin temporizador propio
  if (token !== _token) return;
  _render();
  _schedule(token);
}

async function _loadMomentum(token) {
  try {
    const m = await api.momentum(_gameId, _url ? { url: _url } : {});
    if (token !== _token) return;
    _momentum = m;
    _momentumError = null;
  } catch (e) {
    if (token !== _token) return;
    if (!_momentum) _momentumError = e.message || "No se pudo cargar el momentum.";
  }
}

function _setTab(id) {
  _tab = id;
  _render();
  if (id === "momentum" && !_momentum) {
    const token = _token;
    _loadMomentum(token).then(() => { if (token === _token && _tab === "momentum") _render(); });
  }
}

function _schedule(token) {
  if (token !== _token) return;
  _timer = setTimeout(() => _poll(token), _pollSecs * 1000);
}

function _renderError(e) {
  let msg;
  if (!navigator.onLine || !e.status) msg = "Sin conexión: el seguimiento en vivo necesita conexión.";
  else if (e.status === 404) msg = "Partido no encontrado.";
  else if (e.status === 502) msg = "No se pudo obtener el partido en vivo.";
  else msg = e.message || "No se pudo cargar el partido en vivo.";
  const retry = e.status === 404 || e.status === 400 ? "" : `<p class="lv-hint">Se reintenta cada ${_pollSecs} s.</p>`;
  _el.innerHTML = `<div class="card"><p class="empty below-avg">${esc(msg)}</p>${retry}</div>`;
}

function _renderFinished() {
  _el.innerHTML = `
    <div class="lv-banner lv-banner-final">Partido finalizado: se guardó automáticamente. Estos son los datos oficiales.</div>
    <div id="lv-final-view"></div>`;
  renderGameView(_el.querySelector("#lv-final-view"), _gameId);
}

function _render() {
  const d = _data;
  const home = d.teams?.home || {};
  const away = d.teams?.away || {};
  const started = d.has_pbp || (home.score || 0) + (away.score || 0) > 0;

  let badge;
  if (_offline) badge = '<span class="lv-stale">SIN CONEXIÓN</span>';
  else if (d.stale) badge = '<span class="lv-stale">DESACTUALIZADO</span>';
  else badge = '<span class="lv-badge">EN VIVO</span>';

  const banners = [];
  if (_offline) banners.push(`Sin conexión: el seguimiento en vivo necesita conexión. Se reintenta cada ${_pollSecs} s.`);
  if (d.stale) banners.push(`Datos desactualizados desde ${_fmtTime(d.fetched_at)}.`);
  if (d.persist_error) banners.push("El partido terminó pero no se pudo guardar; se reintenta en la próxima actualización.");

  let html = `
    <div class="gv-header card">
      <div class="gv-meta">${badge} ${d.clock ? `<span class="lv-clock">${esc(d.clock.label)}</span>` : ""}
        <span class="lv-updated">Actualizado ${_fmtTime(d.fetched_at)}</span></div>
      <div class="gv-score">
        <span class="gv-team">${esc(home.name)}</span>
        <span class="gv-pts">${home.score ?? "–"}</span>
        <span class="gv-sep">–</span>
        <span class="gv-pts">${away.score ?? "–"}</span>
        <span class="gv-team">${esc(away.name)}</span>
      </div>
    </div>
    ${banners.map(b => `<div class="lv-banner">${esc(b)}</div>`).join("")}`;

  if (!started) {
    html += '<div class="card"><p class="empty">Sin datos aún: el partido no comenzó.</p></div>';
    _el.innerHTML = html;
    return;
  }

  html += `<div class="gv-tabs">
    ${[["vivo", "En vivo"], ["momentum", "Momentum"]].map(([id, label]) =>
      `<button class="gv-tab lv-tab${_tab === id ? " active" : ""}" data-tab="${id}">${label}</button>`).join("")}
  </div>`;
  html += _tab === "momentum" ? _momentumBody() : _vivoBody(d, home, away);
  _el.innerHTML = html;
  _el.querySelectorAll(".lv-tab").forEach(b => b.addEventListener("click", () => _setTab(b.dataset.tab)));
}

function _momentumBody() {
  if (_momentum) return momentumHTML(_momentum);
  if (_momentumError) return `<div class="card"><p class="empty below-avg">${esc(_momentumError)}</p></div>`;
  return '<p class="empty"><span class="spinner"></span>Cargando momentum…</p>';
}

function _vivoBody(d, home, away) {
  return `
    <div class="card">
      <div class="card-title">Eficiencia</div>
      ${_compareTable(TEAM_ROWS, home, away)}
      ${_seasonNote(home, away)}
    </div>
    <div class="card">
      <div class="card-title">Four factors</div>
      ${_compareTable(FACTOR_ROWS, home, away)}
    </div>
    <div class="card">
      <div class="card-title">Cómo se consiguen los puntos</div>
      <div class="lv-dist-row">
        ${_distributionHTML(home, d.distribution?.home)}
        ${_distributionHTML(away, d.distribution?.away)}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Jugadores</div>
      ${d.has_pbp ? "" : '<p class="lv-hint">Sin jugada a jugada todavía: estado en cancha y cadenas de puntos no disponibles.</p>'}
      ${_playersHTML(home, d.players?.home || [])}
      ${_playersHTML(away, d.players?.away || [])}
    </div>`;
}

function _fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function _fmtVal(key, m) {
  if (!m || isNull(m.value)) return nullDisplay(m?.reason);
  if (PCT_KEYS.has(key)) return PCT(m.value);
  if (DEC1_KEYS.has(key)) return DEC1(m.value);
  return DEC2(m.value);
}

function _delta(team, key) {
  const m = team.vs_season?.metrics?.[key];
  if (!m || isNull(m.delta)) return '<td class="lv-delta"></td>';
  const d = m.delta;
  const shown = PCT_KEYS.has(key) ? `${DEC1(Math.abs(d) * 100)} pp` : (DEC1_KEYS.has(key) ? DEC1(Math.abs(d)) : DEC2(Math.abs(d)));
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  let cls = "";
  if (!NEUTRAL_KEYS.has(key) && d !== 0) {
    const good = LOWER_IS_BETTER.has(key) ? d < 0 : d > 0;
    cls = good ? "above-avg" : "below-avg";
  }
  const avg = _fmtVal(key, { value: m.own_avg });
  return `<td class="lv-delta ${cls}" title="Promedio de temporada: ${avg.replace(/<[^>]+>/g, "")}">${sign}${shown}</td>`;
}

function _teamTh(team) {
  return `<span class="lv-full">${esc(team.name)}</span><span class="lv-short" title="${esc(team.name)}">${esc(team.code)}</span>`;
}

function _compareTable(rows, home, away) {
  return `<div class="lv-table-wrap"><table class="lv-cmp-table">
    <thead><tr><th></th><th>${_teamTh(home)}</th><th class="lv-delta">Δ temp.</th><th>${_teamTh(away)}</th><th class="lv-delta">Δ temp.</th></tr></thead>
    <tbody>${rows.map(([k, label]) => `
      <tr><td>${label}</td>
        <td>${_fmtVal(k, home.standard?.[k])}</td>${_delta(home, k)}
        <td>${_fmtVal(k, away.standard?.[k])}</td>${_delta(away, k)}</tr>`).join("")}
    </tbody></table></div>`;
}

function _seasonNote(home, away) {
  const parts = [home, away].filter(t => t.vs_season).map(t =>
    `${esc(t.name)}: ${t.vs_season.games} PJ${t.vs_season.competition_label ? ` en ${esc(t.vs_season.competition_label)}` : ""}`);
  if (!parts.length) return '<p class="lv-hint">Sin partidos previos en la temporada para comparar.</p>';
  return `<p class="lv-hint">Δ temp. = diferencia contra el promedio de temporada del propio equipo (${parts.join(" · ")}).</p>`;
}

function _distributionHTML(team, dist) {
  if (!dist) return '<div class="lv-dist-col"><p class="empty">Sin datos de distribución todavía.</p></div>';
  const total = dist.total || 0;
  const row = (label, m) => {
    const v = m?.value;
    const pct = !isNull(v) && total > 0 ? (v / total) * 100 : null;
    return `<div class="lv-bar-row">
      <span class="lv-bar-label">${label}</span>
      <span class="lv-bar"><span class="lv-bar-fill" style="width:${pct == null ? 0 : Math.min(100, pct).toFixed(1)}%"></span></span>
      <span class="lv-bar-val">${isNull(v) ? nullDisplay(m?.reason) : v}</span>
      <span class="lv-bar-pct">${pct == null ? "" : `${DEC1(pct)}%`}</span>
    </div>`;
  };
  return `<div class="lv-dist-col">
    <h4>${esc(team.name)} · ${total} pts</h4>
    <div class="lv-dist-group">Por tipo de tiro</div>
    ${Object.entries(SHOT_LABELS).map(([k, l]) => row(l, dist.by_shot?.[k])).join("")}
    <div class="lv-dist-group">Por origen <small>(categorías no excluyentes)</small></div>
    ${Object.entries(ORIGIN_LABELS).map(([k, l]) => row(l, dist.by_origin?.[k])).join("")}
  </div>`;
}

function _playersHTML(team, players) {
  if (!players.length) return "";
  const pm = m => {
    if (!m || isNull(m.value)) return nullDisplay(m?.reason);
    return m.value > 0 ? `+${m.value}` : String(m.value);
  };
  const chain = m => (!m || isNull(m.value)) ? nullDisplay(m?.reason) : m.value;
  return `<div class="lv-players-section">
    <h4>${esc(team.name)}</h4>
    <div class="lv-table-wrap"><table class="lv-players-table">
      <thead><tr>
        <th></th><th>Jugador</th><th>MIN</th><th>PTS</th><th>OER</th><th>TS%</th><th>eFG%</th><th>USO%</th><th>+/−</th>
        ${CHAIN_COLS.map(([, l, t]) => `<th title="${t}">${l}</th>`).join("")}
      </tr></thead>
      <tbody>${players.map(p => {
        const s = p.standard || {};
        return `<tr class="${p.on_court ? "lv-on-court" : "lv-bench"}">
          <td><span class="lv-dot${p.on_court ? " on" : ""}" title="${p.on_court ? "En cancha" : "Banco"}"></span></td>
          <td class="lv-name">${esc(p.name)}${p.jersey ? ` <small>#${esc(p.jersey)}</small>` : ""}</td>
          <td>${DEC1(p.minutes)}</td><td>${p.pts ?? "—"}</td>
          <td>${_fmtVal("oer", s.oer)}</td><td>${_fmtVal("ts_pct", s.ts_pct)}</td>
          <td>${_fmtVal("efg_pct", s.efg_pct)}</td><td>${_fmtVal("uso_pct", s.uso_pct)}</td>
          <td>${pm(s.plus_minus)}</td>
          ${CHAIN_COLS.map(([k]) => `<td>${chain(p.chains?.[k])}</td>`).join("")}
        </tr>`;
      }).join("")}</tbody>
    </table></div>
  </div>`;
}
