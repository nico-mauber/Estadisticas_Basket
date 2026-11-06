// Sugerencias de quinteto asistidas por IA (F-15): panel de Equipo › Quintetos. Solo se dibuja si el servidor tiene la
// función habilitada (`/api/me.llm_enabled`). Genera solo cuando el usuario toca el botón; el modelo redacta sobre un
// resumen ya calculado y cada sugerencia se muestra con los datos que la sustentan. El texto del modelo nunca se inserta
// como HTML.
import { api } from "../api.js";
import { sampleBadge } from "./sample-badge.js";
import { getPref, setPref, loadPrefs } from "../core/prefs.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PANEL_ID = "equipo.quintetos.ia";
const GOALS = [["anotar", "Anotar"], ["defender", "Defender"], ["reboteear", "Reboteear"], ["frenar_ritmo", "Frenar el ritmo"],
  ["cerrar", "Cerrar el partido"], ["vs_rival", "Contra un rival…"], ["infrautilizados", "Quintetos infrautilizados"],
  ["a_evitar", "Quintetos a evitar"], ["cambio_pieza", "Cambios de una pieza"], ["lectura_cierres", "Lectura de cierres"]];
const LIMITS = ["Describe lo que ya ocurrió; no predice lo que va a ocurrir.",
  "No sustituye el criterio del entrenador: no contempla lesiones, faltas, estado físico ni decisiones tácticas.",
  "Si ningún quinteto supera el umbral de muestra, no se genera sugerencia."];
let _state = { goal: "anotar", rival: "" };
let _token = 0;
let _prefs = null;

function _errText(e) {
  if (e instanceof TypeError || navigator.onLine === false) return "Sin conexión: las sugerencias necesitan conexión.";
  if (e.code === "limite_ia") return e.message;
  if (e.code === "llm_deshabilitado") return "Las sugerencias asistidas por IA no están disponibles.";
  if (e.code === "timeout_externo" || e.code === "llm_error") return "No se pudo generar la lectura. Probá de nuevo en unos minutos.";
  return e.message || "No se pudo generar la lectura. Probá de nuevo en unos minutos.";
}

function _reasonText(d) {
  if (d.reason === "sin_quintetos_sobre_umbral") {
    const m = d.considered?.min_poss;
    return `Ningún quinteto supera el umbral de muestra${m != null ? ` (${String(m).replace(".", ",")} posesiones)` : ""} para esta lectura. No se genera sugerencia.`;
  }
  if (d.reason === "validacion_fallida") return "No se pudo generar una lectura verificable. Probá de nuevo.";
  if (d.reason === "rechazo_modelo") return "El servicio de IA no pudo responder esta consulta.";
  return "Sin sugerencias.";
}

function _support(rows) {
  return `<div class="ev-scroll"><table class="ld-table ai-support"><thead><tr><th>Quinteto</th><th>Valores</th><th>Muestra</th><th></th></tr></thead><tbody>${
    rows.map(r => `<tr><td>${esc(r.row_id)} · ${esc((r.names || []).join(" · "))}${r.change ? `<div class="td-muted">Sale ${esc(r.change.out)} · entra ${esc(r.change.in)}</div>` : ""}${r.rival_lineup ? `<div class="td-muted">vs ${esc(r.rival_lineup)}</div>` : ""}</td>
      <td>${Object.values(r.values || {}).map(v => `<span class="ai-val">${esc(v.label)}: <strong>${esc(v.display)}</strong></span>`).join(" ")}</td>
      <td>${r.badge ? sampleBadge(r.badge, { compact: true }) : esc(r.sample?.level || "")}</td>
      <td><a href="${esc(r.table_link)}" class="ai-link">Ver tabla</a></td></tr>`).join("")}</tbody></table></div>`;
}

function _result(d) {
  if (!d.suggestions?.length) return `<p class="empty">${esc(_reasonText(d))}</p>`;
  const when = d.generated_at ? new Date(d.generated_at).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  return `${d.suggestions.map(s => `<article class="ai-card">
      <span class="ai-tag">Generada automáticamente</span>
      <h4 class="ai-title">${esc(s.title)}</h4>
      <p class="ai-text">${esc(s.text)}</p>
      <div class="ai-sub">Datos que la sustentan</div>${_support(s.supporting_rows || [])}
    </article>`).join("")}
    <p class="td-muted ai-foot">Generado el ${esc(when)}${d.cached ? " (reutilizado)" : ""} · ${d.considered?.rows ?? 0} quintetos considerados · umbral: ${esc(String(d.considered?.min_poss ?? "—").replace(".", ","))} posesiones
      <button type="button" class="btn btn-ghost btn-sm ai-regen">Regenerar</button></p>
    <p class="td-muted ai-disclaimer">${esc(d.disclaimer || "")}</p>`;
}

export async function renderLineupSuggestions(el, { teamCode, enabled, params = {} } = {}) {
  if (!el) return;
  if (!enabled || !teamCode) { el.innerHTML = ""; return; }
  _prefs ??= loadPrefs("panel.collapsed");
  await _prefs;
  const collapsed = getPref("panel.collapsed", PANEL_ID, false) === true;
  let teams = [];
  try { teams = (await api.teams()).filter(t => t.code !== teamCode); } catch { teams = []; }
  el.innerHTML = `<div class="card ai-panel" id="ai-panel">
    <div class="card-title ai-head"><span>Sugerencias asistidas por IA</span>
      <button type="button" class="cd-toggle ai-toggle" aria-expanded="${!collapsed}" aria-label="Mostrar u ocultar las sugerencias">${collapsed ? "▸" : "▾"}</button></div>
    <ul class="ai-limits">${LIMITS.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
    <div class="ai-body"${collapsed ? " hidden" : ""}>
      <p class="td-muted ai-ondemand">Las sugerencias se generan solo cuando las pedís.</p>
      <div class="ai-controls">
        <label>¿Qué querés saber?<select class="map-select" id="ai-goal">${GOALS.map(([v, l]) => `<option value="${v}"${_state.goal === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        <label id="ai-rival-wrap"${_state.goal === "vs_rival" ? "" : " hidden"}>Rival<select class="map-select" id="ai-rival"><option value="">— Elegí el rival —</option>${teams.map(t => `<option value="${esc(t.code)}"${_state.rival === t.code ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
        <button type="button" class="btn btn-sm" id="ai-generate">Generar sugerencias</button>
      </div>
      <div id="ai-result"></div>
    </div></div>`;
  const body = el.querySelector(".ai-body"), toggle = el.querySelector(".ai-toggle");
  toggle.addEventListener("click", () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.textContent = open ? "▾" : "▸";
    toggle.setAttribute("aria-expanded", String(open));
    setPref("panel.collapsed", PANEL_ID, !open).catch(() => {});
  });
  const goalSel = el.querySelector("#ai-goal"), rivalSel = el.querySelector("#ai-rival"), btn = el.querySelector("#ai-generate");
  const out = el.querySelector("#ai-result");
  goalSel.addEventListener("change", () => { _state.goal = goalSel.value; el.querySelector("#ai-rival-wrap").hidden = _state.goal !== "vs_rival"; });
  rivalSel.addEventListener("change", () => { _state.rival = rivalSel.value; });
  const run = async (refresh = false) => {
    if (_state.goal === "vs_rival" && !_state.rival) { out.innerHTML = '<p class="empty below-avg">Elegí el rival.</p>'; return; }
    if (navigator.onLine === false) { out.innerHTML = '<p class="empty below-avg">Sin conexión: las sugerencias necesitan conexión.</p>'; return; }
    const t = ++_token;
    btn.disabled = true;
    out.innerHTML = '<p class="empty"><span class="spinner"></span>Generando la lectura… puede tardar hasta un minuto.</p>';
    try {
      const d = await api.aiLineupSuggestions({ team: teamCode, goal: _state.goal, rival: _state.goal === "vs_rival" ? _state.rival : null,
        competition: params.competition || null, last: params.last || null, refresh });
      if (t !== _token) return;
      out.innerHTML = _result(d);
      out.querySelector(".ai-regen")?.addEventListener("click", () => run(true));
    } catch (e) {
      if (t !== _token) return;
      out.innerHTML = `<p class="empty below-avg">${esc(_errText(e))}</p>`;
    } finally {
      if (t === _token) btn.disabled = false;
    }
  };
  btn.addEventListener("click", () => run(false));
}
