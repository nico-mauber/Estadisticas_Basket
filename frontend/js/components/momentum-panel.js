// ── Panel Momentum (F-02) ────────────────────────────────────────────────────
// HTML puro a partir de GET /api/live/<id>/momentum; lo usan En vivo y Analizar (estado al cierre).
import { DEC2, isNull, nullDisplay } from "../core/format.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

const mmss = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

function val(m) {
  return !m || isNull(m.value) ? nullDisplay(m?.reason) : DEC2(m.value);
}

function netCell(m) {
  if (!m || isNull(m.value)) return `<td>${nullDisplay(m?.reason)}</td>`;
  const cls = m.value > 0 ? "above-avg" : m.value < 0 ? "below-avg" : "";
  return `<td class="${cls}">${m.value > 0 ? "+" : ""}${DEC2(m.value)}</td>`;
}

function runHTML(m) {
  const r = m.run;
  if (!r) return '<p class="empty">Sin racha abierta.</p>';
  const team = m.teams?.[r.side]?.name || r.team_code;
  const since = r.elapsed_secs != null ? ` · ${mmss(r.elapsed_secs)} de juego` : "";
  return `<div class="mo-run mo-${r.side}">
    <span class="mo-run-score">${r.points}-${r.opp_points}</span>
    <span class="mo-run-text">Racha de <strong>${esc(team)}</strong><br><small>desde ${esc(r.since?.label)}${since}</small></span>
  </div>`;
}

function windowsHTML(m) {
  const home = m.teams?.home?.name, away = m.teams?.away?.name;
  const lp = m.last_possessions || {};
  const lw = m.last_window || {};
  const ppp = (lp.home?.ppp?.value == null && lp.away?.ppp?.value == null)
    ? `<tr><td>PPP últimas ${lp.n} pos.</td><td colspan="2" class="mo-empty">Aún no hay suficientes posesiones para esta ventana.</td></tr>`
    : `<tr><td>PPP últimas ${lp.n} pos.</td><td>${val(lp.home?.ppp)}</td><td>${val(lp.away?.ppp)}</td></tr>`;
  const wl = lw.window_secs ? mmss(lw.window_secs) : "";
  const win = lw.reason === "pocos_minutos"
    ? `<tr><td>Últimos ${wl}</td><td colspan="2" class="mo-empty">Aún no se jugaron ${wl} de partido.</td></tr>`
    : `<tr><td>OER últimos ${wl}</td><td>${val(lw.home?.oer)}</td><td>${val(lw.away?.oer)}</td></tr>
       <tr><td>DER últimos ${wl}</td><td>${val(lw.home?.der)}</td><td>${val(lw.away?.der)}</td></tr>
       <tr><td>Net últimos ${wl}</td>${netCell(lw.home?.net_rating)}${netCell(lw.away?.net_rating)}</tr>`;
  return `<table class="lv-cmp-table">
    <thead><tr><th></th><th>${esc(home)}</th><th>${esc(away)}</th></tr></thead>
    <tbody>${ppp}${win}</tbody></table>
    <p class="lv-hint">OER/DER = puntos por posesión propia / del rival en la ventana (posesiones reconstruidas).</p>`;
}

function outcomeItem(o) {
  const scored = o.pts > 0;
  const tags = [];
  if (o.is_three) tags.push('<span class="mo-tag mo-tag-3">Triple</span>');
  if (o.had_second_chance) tags.push('<span class="mo-tag">Rebote ofensivo</span>');
  if (o.assister) tags.push(`<span class="mo-tag">Asist. ${esc(o.assister)}</span>`);
  return `<li class="mo-out ${scored ? "mo-out-pts" : "mo-out-zero"}">
    <span class="mo-out-pts-val">${o.pts > 0 ? `+${o.pts}` : "0"}</span>
    <span class="mo-out-main">${esc(o.label)}${o.player ? ` · ${esc(o.player)}` : ""} ${tags.join(" ")}</span>
    <span class="mo-out-clock">${esc(o.clock || "")}</span>
  </li>`;
}

function outcomesHTML(m) {
  const lo = m.last_outcomes || {};
  const col = side => {
    const items = lo[side] || [];
    return `<div class="mo-out-col"><h4>${esc(m.teams?.[side]?.name)}</h4>
      ${items.length ? `<ul class="mo-out-list">${items.map(outcomeItem).join("")}</ul>`
                     : '<p class="empty">Aún no hay suficientes posesiones para esta ventana.</p>'}</div>`;
  };
  return `<div class="lv-dist-row">${col("home")}${col("away")}</div>`;
}

function playersHTML(m) {
  const card = (p, kind) => `<div class="mo-player mo-${kind}">
    <span class="mo-player-icon">${kind === "hot" ? "🔥" : "🧊"}</span>
    <div><div class="mo-player-name">${esc(p.name)} <small>${esc(m.teams?.[p.side]?.name || p.team_code)}</small></div>
      <div class="mo-player-marks">${p.marks.map(x => `<span class="mo-mark">${esc(x.label)}</span>`).join("")}</div></div>
  </div>`;
  const hot = m.hot || [], cold = m.cold || [];
  if (!hot.length && !cold.length) return '<p class="empty">Ningún jugador cumple las reglas de Momentum en este momento.</p>';
  return `<div class="mo-players">${hot.map(p => card(p, "hot")).join("")}${cold.map(p => card(p, "cold")).join("")}</div>`;
}

function rulesHint(t) {
  if (!t) return "";
  return `<p class="lv-hint">Caliente: ${t.hot_consecutive_makes} tiros de campo seguidos · ${t.hot_points} pts en ${mmss(t.hot_points_window_secs)} ·
    ${t.assist_streak} canastas seguidas asistidas · ${t.oreb_in_quarter} rebotes ofensivos en el cuarto. Alerta: ${t.cold_consecutive_tov} pérdidas seguidas.
    Umbrales editables en Configuración → Reglas de Momentum.</p>`;
}

export function momentumHTML(m, { final = false } = {}) {
  if (!m.has_pbp) return '<div class="card"><p class="empty">Sin jugada a jugada: Momentum no disponible.</p></div>';
  const note = final
    ? `<p class="lv-hint">Estado al cierre del partido${m.now ? ` (${esc(m.now.label)})` : ""}: lo que estaba cambiando el partido en sus últimos minutos.</p>`
    : "";
  return `${note}
    <div class="card"><div class="card-title">Parcial abierto</div>${runHTML(m)}</div>
    <div class="card"><div class="card-title">Ritmo reciente</div>${windowsHTML(m)}</div>
    <div class="card"><div class="card-title">Últimas ${m.last_outcomes?.n ?? ""} posesiones</div>${outcomesHTML(m)}</div>
    <div class="card"><div class="card-title">Jugadores calientes y alertas</div>${playersHTML(m)}${rulesHint(m.thresholds)}</div>`;
}
