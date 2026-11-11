// ── Plan de juego (F-17) ─────────────────────────────────────────────────────
// Panel de lectura rápida de Equipo: en qué métricas el equipo está mejor ("Ventajas") y peor ("Vulnerabilidades") que
// una referencia. Cada ítem trae métrica, diferencia orientada (positivo = mejor, también en las de "menos es mejor"),
// valores propio y de referencia, percentil en la competencia y una frase de plantilla fija. Los números salen de
// `GET /api/game-plan`, de la misma población que las fichas de la tabla de métricas.
import { api } from "../api.js";
import { fmtNumber, fmtSigned, PCT, DEC1, DEC2 } from "../core/format.js";
import { percentileColor } from "../core/colors.js";
import { loadPrefs, getPref, setPref } from "../core/prefs.js";
import { sampleBadge } from "./sample-badge.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Copy del panel (F-21 lo va a extraer; hoy va directo en español).
const COPY = {
  title: "Plan de juego",
  advantages: "Ventajas",
  risks: "Vulnerabilidades",
  noAdvantages: "Sin ventajas destacadas",
  noRisks: "Sin vulnerabilidades destacadas",
  loading: "Calculando plan de juego…",
  error: "No se pudo calcular el plan de juego",
  offline: "Sin conexión",
  retry: "Reintentar",
  minor: "Diferencia menor",
  refs: { competencia: "Ø competencia", rival: "Un rival…", periodo_anterior: "Mi equipo: período anterior",
          rival_proximo: "Rival del próximo partido" },
  refNeedsLast: "Elegí un período (Últimos N) para usarla",
  refNeedsCalendar: "Disponible cuando se cargue el calendario",
  reasons: {
    muestra_baja: "Muestra insuficiente: el equipo tiene {n} {unit} (mínimo {m}). No se arma plan de juego con tan pocos datos.",
    contexto_no_comparable: "Este filtro no permite comparar con la competencia.",
    sin_universo: "Elegí una competencia para comparar.",
    poblacion_insuficiente: "La competencia no tiene suficientes equipos para comparar.",
    rival_sin_datos: "El rival elegido no tiene partidos en esta selección.",
    periodo_anterior_insuficiente: "No hay partidos anteriores suficientes para comparar.",
    sin_datos: "El equipo no tiene partidos en esta selección.",
    sin_diferencias: "No hay diferencias destacadas contra esta referencia.",
  },
};

const PANEL_ID = "equipo.game_plan";
let _token = 0;
let _prefsReady = null;
const _teamsByComp = new Map();
let _sessPrefix = "sb.gp.";   // cada panel (Equipo, Mi equipo) recuerda su propia referencia en la sesión

function _session(key, def) {
  try { return sessionStorage.getItem(`${_sessPrefix}${key}`) ?? def; } catch { return def; }
}
function _saveSession(key, value) {
  try { value ? sessionStorage.setItem(`${_sessPrefix}${key}`, value) : sessionStorage.removeItem(`${_sessPrefix}${key}`); } catch { /* sin almacenamiento */ }
}

// Próximo partido del equipo en el calendario manual (F-12): habilita la referencia «Rival del próximo partido».
async function _nextFixture(teamCode) {
  try {
    const r = await api.fixtures({ team: teamCode });
    return (r.fixtures || []).find(f => !f.played && f.date >= r.today) || null;
  } catch { return null; }
}
function _rivalName(next, teamCode) {
  if (!next) return "";
  if (next.rival) return next.rival.name || next.rival.code;
  return next.home_code === teamCode ? (next.away_name || next.away_code) : (next.home_name || next.home_code);
}

async function _teams(competition) {
  const key = String(competition ?? "");
  if (_teamsByComp.has(key)) return _teamsByComp.get(key);
  try {
    const o = await api.contextOptions({ competition: competition && competition !== "all" ? competition : null });
    _teamsByComp.set(key, o.teams || []);
    return _teamsByComp.get(key);
  } catch {
    return null;
  }
}

// ── Formato (es-UY) ──────────────────────────────────────────────────────────
function _fmtVal(fmt, v) {
  if (v == null) return "—";
  switch (fmt) {
    case "pct": return PCT(v);
    case "dec1": return DEC1(v);
    case "signed_int": return fmtSigned(v, 0);
    case "int": return fmtNumber(v, 0);
    case "signed_dec2": return fmtSigned(v, 2);
    default: return DEC2(v);
  }
}

// Diferencia con signo: los porcentajes van en puntos porcentuales con una decimal ("+0,8").
export function fmtPlanDelta(item, raw = false) {
  const v = raw ? item.delta_raw : item.delta;
  if (v == null) return "—";
  switch (item.fmt) {
    case "pct": return fmtSigned(v * 100, 1);
    case "dec1": return fmtSigned(v, 1);
    case "int": case "signed_int": return fmtSigned(v, 0);
    default: return fmtSigned(v, 2);
  }
}

export function planReasonText(reason, payload) {
  const t = COPY.reasons[reason];
  if (!t) return COPY.reasons.sin_diferencias;
  const own = payload?.sample?.own || {};
  return t.replace("{n}", fmtNumber(own.n ?? 0, 0)).replace("{unit}", own.unit || "partidos").replace("{m}", fmtNumber(own.min ?? 0, 0));
}

// Un ítem del plan (también lo reutilizan F-03, F-12 y F-20).
export function renderPlanItem(item) {
  const pos = item.direction === "ventaja";
  const arith = `${fmtPlanDelta(item, true)}${item.fmt === "pct" ? " pp" : ""}`;
  const title = `Diferencia aritmética: ${arith} (propio − referencia)${item.minor ? ` · ${COPY.minor}` : ""}`;
  const pc = item.percentile;
  const pct = pc == null ? '<span class="gp-pct td-muted">—</span>'
    : `<span class="gp-pct" style="background:${percentileColor(pc)}" title="Percentil entre los equipos de la competencia">p${fmtNumber(pc, 0)}</span>`;
  return `<li class="gp-item ${pos ? "gp-pos" : "gp-neg"}${item.minor ? " gp-minor" : ""}" title="${esc(title)}" data-metric="${esc(item.metric)}">
    <span class="gp-ico" aria-label="${pos ? "Ventaja" : "Riesgo"}">${pos ? "↑" : "↓"}</span>
    <span class="gp-metric">${esc(item.label)}</span>
    <span class="gp-delta ${pos ? "above-avg" : "below-avg"}">${fmtPlanDelta(item)}${item.fmt === "pct" ? '<small> pp</small>' : ""}</span>
    <span class="gp-vals">${esc(_fmtVal(item.fmt, item.own))} <em>vs</em> ${esc(_fmtVal(item.fmt, item.ref))}</span>
    ${pct}
    <span class="gp-text">${esc(item.text)}</span>
  </li>`;
}

function _column(title, items, emptyText, kind) {
  return `<div class="gp-col gp-col-${kind}"><h4 class="tp-h">${esc(title)}</h4>${items.length
    ? `<ul class="gp-list">${items.map(renderPlanItem).join("")}</ul>` : `<p class="td-muted">${esc(emptyText)}</p>`}</div>`;
}

function _controls({ reference, rival, teams, teamCode, hasLast, error, next }) {
  const opt = (v, disabled = false, title = "") =>
    `<option value="${v}"${reference === v ? " selected" : ""}${disabled ? " disabled" : ""}${title ? ` title="${esc(title)}"` : ""}>${esc(COPY.refs[v])}${v === "rival_proximo" ? ` (${esc(next ? _rivalName(next, teamCode) : COPY.refNeedsCalendar)})` : ""}</option>`;
  const rivals = (teams || []).filter(t => t.code !== teamCode);
  return `<div class="gp-controls">
    <label class="gp-lbl">Referencia
      <select class="gp-ref map-select" aria-label="Referencia del plan de juego">
        ${opt("competencia")}${opt("rival")}${opt("periodo_anterior", !hasLast, COPY.refNeedsLast)}${opt("rival_proximo", !next, next ? "" : COPY.refNeedsCalendar)}
      </select></label>
    ${reference === "rival" ? `<label class="gp-lbl">Rival
      <select class="gp-rival map-select" aria-label="Rival de referencia">
        <option value="">— Elegí un rival —</option>
        ${rivals.map(t => `<option value="${esc(t.code)}"${rival === t.code ? " selected" : ""}>${esc(t.name)}</option>`).join("")}
      </select></label>${teams === null ? '<span class="td-muted">No se pudieron cargar los equipos</span>' : ""}` : ""}
    ${error ? `<span class="gp-err below-avg" role="alert">${esc(error)}</span>` : ""}
  </div>`;
}

// `opts.params`: contexto de la vista ({competition, last, venue, …}). `opts.panelId`: panel plegable (Equipo o Mi
// equipo). `opts.nextFixture`: próximo partido ya conocido (`null` = no hay); si no se pasa, se consulta el calendario.
// `opts.defaultReference`: la referencia inicial cuando el panel no tiene una recordada.
export async function renderGamePlan(el, teamCode, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const params = opts.params || {};
  const hasLast = !!params.last;
  const panelId = opts.panelId || PANEL_ID;
  _sessPrefix = panelId === PANEL_ID ? "sb.gp." : `sb.gp.${panelId}.`;
  _prefsReady ??= loadPrefs("panel.collapsed");
  await _prefsReady;
  if (token !== _token) return;

  const next = opts.nextFixture !== undefined ? opts.nextFixture : await _nextFixture(teamCode);
  if (token !== _token) return;
  let reference = _session("reference", opts.defaultReference || "competencia");
  if (!["competencia", "rival", "periodo_anterior", "rival_proximo"].includes(reference)) reference = "competencia";
  if (reference === "periodo_anterior" && !hasLast) reference = "competencia";   // sin período no se puede pedir
  if (reference === "rival_proximo" && !next) reference = "competencia";        // sin calendario no hay próximo rival
  let rival = _session("rival", "");
  const teams = await _teams(params.competition);
  if (token !== _token) return;
  const state = { reference, rival, teams, teamCode, hasLast, error: "", next };

  const collapsed = getPref("panel.collapsed", panelId, false) === true;
  el.innerHTML = `<div class="card gp-card${collapsed ? " gp-collapsed" : ""}">
    <div class="card-title gp-head"><span>${esc(COPY.title)}</span>
      <button type="button" class="cd-toggle gp-toggle" aria-expanded="${!collapsed}" aria-label="Mostrar u ocultar el plan de juego">${collapsed ? "▸" : "▾"}</button></div>
    <div class="gp-wrap"${collapsed ? " hidden" : ""}>
      <div class="gp-ctl"></div><div class="gp-meta td-muted"></div><div class="gp-body"></div>
    </div></div>`;
  const card = el.querySelector(".gp-card"), wrap = el.querySelector(".gp-wrap"), toggle = el.querySelector(".gp-toggle");
  toggle.addEventListener("click", () => {
    const open = wrap.hidden;       // estaba cerrado → se abre
    wrap.hidden = !open;
    card.classList.toggle("gp-collapsed", !open);
    toggle.textContent = open ? "▾" : "▸";
    toggle.setAttribute("aria-expanded", String(open));
    setPref("panel.collapsed", panelId, !open).catch(() => {});
  });

  const ctl = el.querySelector(".gp-ctl"), meta = el.querySelector(".gp-meta"), body = el.querySelector(".gp-body");
  const drawControls = () => {
    ctl.innerHTML = _controls(state);
    ctl.querySelector(".gp-ref").addEventListener("change", e => {
      state.reference = e.target.value; state.error = "";
      _saveSession("reference", state.reference);
      if (state.reference !== "rival") { load(); } else { drawControls(); if (state.rival) load(); else { meta.textContent = ""; body.innerHTML = ""; } }
    });
    ctl.querySelector(".gp-rival")?.addEventListener("change", e => {
      state.rival = e.target.value; _saveSession("rival", state.rival);
      if (state.rival) load(); else { meta.textContent = ""; body.innerHTML = ""; }
    });
  };

  async function load() {
    const t = ++_token;
    drawControls();
    meta.innerHTML = "";
    body.innerHTML = `<p class="empty"><span class="spinner"></span>${esc(COPY.loading)}</p>`;
    let d;
    try {
      d = await api.gamePlan({ team: teamCode, reference: state.reference, rival: state.reference === "rival" ? state.rival : null, ...params });
    } catch (e) {
      if (t !== _token) return;
      if (e.code === "parametro_invalido" || e.code === "referencia_no_disponible" || e.code === "no_encontrado" || e.code === "sin_proximo_partido") {
        // La referencia elegida ya no sirve (por ejemplo, un rival que no está en esta competencia): se vuelve a la base.
        if (state.reference !== "competencia") {
          state.error = e.message; state.reference = "competencia"; state.rival = "";
          _saveSession("reference", ""); _saveSession("rival", "");
          return load();
        }
      }
      const offline = e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
      body.innerHTML = `<p class="empty">${esc(offline ? COPY.offline : e.code === "contexto_invalido" ? "Hay un filtro inválido en la dirección. Limpiá los filtros." : COPY.error)}
        <button type="button" class="btn btn-ghost btn-sm gp-retry">${esc(COPY.retry)}</button></p>`;
      body.querySelector(".gp-retry")?.addEventListener("click", () => load());
      return;
    }
    if (t !== _token) return;
    drawControls();
    const c = d.context || {};
    meta.innerHTML = `Referencia: ${esc(d.reference.label)} · ${esc(c.label || "Todos los partidos")} · ${fmtNumber(c.games_used ?? 0, 0)} de ${fmtNumber(c.games_total ?? 0, 0)} partidos
      ${sampleBadge(d.sample?.own, { compact: true })}${d.sample_warning ? ' <span class="gp-warn below-avg">muestra baja: tomalo con cautela</span>' : ""}`;
    if (d.reason && !d.items.length) {
      body.innerHTML = `<p class="empty" role="status">${esc(planReasonText(d.reason, d))}</p>`;
      return;
    }
    body.innerHTML = `<div class="gp-cols">${_column(COPY.advantages, d.advantages, COPY.noAdvantages, "pos")}${_column(COPY.risks, d.risks, COPY.noRisks, "neg")}</div>`;
  }

  drawControls();
  if (reference === "rival" && !rival) { meta.textContent = ""; return; }
  await load();
}

export function destroyGamePlan() { _token++; }
