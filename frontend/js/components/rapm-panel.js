// Impacto ajustado — RAPM (A-11). Va en Jugador › Impacto: tarjeta del jugador (ofensivo, defensivo y total en puntos por
// 100 posesiones sobre el promedio de la competencia, siempre con sus posesiones), top 10 de la competencia, ranking
// completo (tabla T-06 `rapm`), detalles del modelo y la acción Recalcular (solo administradores). La lectura nunca calcula.
import { api } from "../api.js";
import { fmtNumber, fmtSigned, nullDisplay } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";
import { mountTable } from "./data-table.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _token = 0;
const TITLE = '<div class="card-title">Impacto ajustado (RAPM)</div>';
const sig = m => (m && m.value != null ? fmtSigned(m.value, 2) : nullDisplay(m?.reason));
const fmtDate = iso => { try { return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso || ""; } };

function _err(e) {
  if (e instanceof TypeError || navigator.onLine === false) return "Sin conexión: el impacto ajustado necesita conexión.";
  if (e.status === 403) return "Solo un administrador puede recalcular.";
  if (e.status >= 500 && e.code !== "timeout_externo") return "No se pudo cargar el impacto ajustado.";
  return e.message;
}

function _recomputeBtn(d, label) {
  return d.can_recompute ? `<button class="btn btn-primary btn-sm rp-recompute" type="button">${esc(label)}</button>` : "";
}

function _bar(label, m, scale) {
  const v = m?.value;
  const w = v == null ? 0 : Math.min(50, Math.abs(v) / scale * 50);
  const side = v != null && v < 0 ? "neg" : "pos";
  const rank = m?.rank ? `${m.rank}.º de ${m.rank_total}${m.tied ? " (empate)" : ""}${m.percentile != null ? ` · p${m.percentile}` : ""}`
    : (m?.pct_reason === "muestra_baja" ? "Fuera del ranking (muestra baja)" : m?.pct_reason === "poblacion_insuficiente" ? "Población insuficiente para ranking" : "");
  const title = m?.leader ? ` title="Líder: ${esc(m.leader.name)} (${fmtSigned(m.leader.value, 2)}) · promedio de la población ${fmtSigned(m.avg, 2)}"` : "";
  return `<div class="rp-bar-row"${title}>
    <div class="rp-bar-label">${esc(label)}</div>
    <div class="rp-bar"><span class="rp-axis"></span>${v != null ? `<span class="rp-fill rp-${side}" style="width:${w.toFixed(1)}%"></span>` : ""}</div>
    <div class="rp-bar-val"><strong>${sig(m)}</strong><span class="td-muted rp-rank">${esc(rank)}</span></div>
  </div>`;
}

function _card(d, p) {
  if (!p) return '<p class="empty">Este jugador no tiene posesiones suficientes en los stints.</p>';
  const low = !p.ranked;
  const leaders = ["off", "def", "total"].map(k => Math.abs(p[k]?.leader?.value || 0));
  const scale = Math.max(0.01, ...leaders, ...["off", "def", "total"].map(k => Math.abs(p[k]?.value || 0))) * 1.1;
  const net = p.onoff_net;
  return `<div class="rp-card${low ? " rp-low" : ""}" id="rp-card">
    ${low && p.total.value != null ? '<p class="rp-low-note">Muestra baja: el valor se muestra pero no entra al ranking ni a los percentiles.</p>' : ""}
    ${_bar("Ofensivo", p.off, scale)}${_bar("Defensivo", p.def, scale)}${_bar("Total", p.total, scale)}
    <p class="rp-poss" id="rp-poss">Posesiones: <strong>${fmtNumber(p.possessions, 0)}</strong> (ataque ${fmtNumber(p.poss_off, 0)} · defensa ${fmtNumber(p.poss_def, 0)})
      · Minutos ${fmtNumber(p.minutes, 1)} · Partidos ${p.games} ${sampleBadge(p.sample, { compact: true })}</p>
    <p class="rp-onoff td-muted">ON/OFF crudo: <strong>${net?.value != null ? fmtSigned(net.value, 1) : nullDisplay(net?.reason)}</strong> por 100 posesiones
      (Net Rating con el jugador en cancha, sin ajustar) · Impacto total ajustado: <strong>${sig(p.total)}</strong></p>
    <p class="td-muted rp-unit">Puntos por 100 posesiones sobre el promedio de la competencia. Defensivo positivo = reduce los puntos del rival.</p>
  </div>`;
}

function _top(d, playerId) {
  const rows = (d.players || []).filter(r => r.ranked && r.total.value != null).slice(0, 10);
  if (!rows.length) return '<p class="empty">Sin jugadores con muestra suficiente.</p>';
  return `<div class="ev-scroll"><table class="ld-table rp-top" id="rp-top"><thead><tr><th>#</th><th>Jugador</th><th>Total</th><th>Of.</th><th>Def.</th><th>Posesiones</th></tr></thead><tbody>${
    rows.map(r => `<tr class="${r.player_id === playerId ? "rp-me" : ""}"><td>${r.total.rank ?? ""}</td><td>${esc(r.name)} <span class="td-muted">${esc(r.team_code || "")}</span></td>
      <td>${sig(r.total)}</td><td>${sig(r.off)}</td><td>${sig(r.def)}</td><td>${fmtNumber(r.possessions, 0)}</td></tr>`).join("")}</tbody></table></div>`;
}

function _details(d) {
  const m = d.model, dg = d.diagnostics || {}, dom = dg.dominance || {}, cu = dg.compare_unregularized || {};
  const cv = (d.cv || []).map(c => `<tr class="${c.lambda === d.lambda ? "rp-me" : ""}"><td>${fmtNumber(c.lambda, 0)}</td><td>${fmtNumber(c.error, 1)}</td></tr>`).join("");
  const domTxt = dom.ok == null ? "Sin jugadores en el ranking."
    : `${dom.ok ? "✓" : "✗"} Top ${dom.top_n}: ${dom.top_below_p25} jugadores debajo del percentil 25 de posesiones (${fmtNumber(dom.p25_possessions, 0)}); el azar daría ${fmtNumber(dom.expected_below_p25, 1)} y el máximo admitido es ${dom.max_below_p25}. Mínimo del top: ${fmtNumber(dom.top_min_possessions, 0)} posesiones. Correlación de rangos entre |impacto| y posesiones: ${dom.spearman_abs_total_vs_possessions != null ? fmtNumber(dom.spearman_abs_total_vs_possessions, 2) : "—"} (mínimo admitido ${fmtNumber(dom.spearman_floor, 1)}).`;
  return `<details class="rp-details" id="rp-details"><summary>Detalles del modelo</summary>
    <div class="ev-grid">
      <div><p><strong>λ elegido: ${fmtNumber(d.lambda, 0)}</strong> (validación cruzada con ${d.folds} pliegues por partido)</p>
        <div class="ev-scroll"><table class="ld-table"><thead><tr><th>λ</th><th>Error de validación</th></tr></thead><tbody>${cv}
          <tr><td>Modelo vacío</td><td>${fmtNumber(d.cv_baseline, 1)}</td></tr></tbody></table></div></div>
      <div><ul class="rp-facts">
        <li>Partidos: ${m.games} · Stints: ${fmtNumber(m.stints, 0)} · Observaciones: ${fmtNumber(m.rows, 0)} · Jugadores: ${m.players}</li>
        <li>Posesiones usadas: ${fmtNumber(m.possessions_used, 0)} de ${fmtNumber(m.possessions_total, 0)} (cobertura ${fmtNumber((m.coverage || 0) * 100, 1)} %; incompletas ${m.excluded.incompletas}, sin quinteto ${m.excluded.sin_quinteto})</li>
        <li>Nivel base: ${fmtNumber(m.intercept, 1)} puntos por 100 posesiones · Posesiones con cambio de quinteto: ${fmtNumber((m.lineup_changed_share || 0) * 100, 1)} %</li>
        <li>Calculado ${esc(fmtDate(d.computed_at))} en ${fmtNumber(d.duration_s, 1)} s (${m.cg.solves} resoluciones)</li>
      </ul></div>
    </div>
    <p class="rp-check" id="rp-check"><strong>Verificación del ranking.</strong> ${domTxt}</p>
    <p class="td-muted">Sin regularizar (λ = ${fmtNumber(cu.lambda, 1)}) entrarían ${cu.top10_low_sample_unregularized} jugadores de muestra baja al top 10; con el λ elegido, ${cu.top10_low_sample_chosen} (los dos top 10 sin filtro de muestra). Coinciden ${cu.top10_overlap} de 10.</p>
  </details>`;
}

export async function renderRapm(el, playerId, opts = {}) {
  if (!el) return;
  const token = ++_token;
  el.innerHTML = `<div class="card">${TITLE}<p class="empty"><span class="spinner"></span>Cargando impacto ajustado…</p></div>`;
  const params = opts.params || {};
  let d;
  try { d = await api.rapm({ competition: params.competition, player: playerId, top: 10 }); }
  catch (e) { if (token === _token) el.innerHTML = `<div class="card">${TITLE}<p class="empty below-avg">${esc(_err(e))}</p></div>`; return; }
  if (token !== _token) return;

  let body;
  if (d.status === "sin_calcular") {
    body = `<p class="empty">El impacto ajustado todavía no se calculó.</p>
      ${d.can_recompute ? _recomputeBtn(d, "Calcular impacto ajustado") : '<p class="td-muted">Pedile a un administrador que lo calcule.</p>'}`;
  } else if (d.status === "datos_insuficientes") {
    body = `<p class="empty">${esc(d.message)}</p>${_recomputeBtn(d, "Recalcular")}`;
  } else {
    const stale = d.stale ? `<div class="rp-stale" id="rp-stale">Los datos cambiaron desde el último cálculo (${esc(fmtDate(d.computed_at))}). Recalculá para actualizar. ${_recomputeBtn(d, "Recalcular")}</div>` : "";
    const warns = (d.warnings || []).map(w => `<p class="rp-warn">${esc(w.message)}</p>`).join("");
    body = `${stale}${warns}${_card(d, d.player)}
      <div class="rp-section"><div class="rp-sub">Top 10 de la competencia</div>${_top(d, playerId)}</div>
      <div class="rp-section"><button class="btn btn-ghost btn-sm" type="button" id="rp-full-btn">Ver ranking completo</button><div id="rp-full"></div></div>
      ${_details(d)}
      ${d.stale ? "" : `<div class="rp-actions">${_recomputeBtn(d, "Recalcular")}</div>`}`;
  }
  const label = d.competition?.label ? `<span class="td-muted rp-comp">${esc(d.competition.label)} · toda la competencia (los filtros de contexto no aplican)</span>` : "";
  el.innerHTML = `<div class="card" id="rp-panel">${TITLE}${label}${body}</div>`;

  el.querySelectorAll(".rp-recompute").forEach(btn => btn.addEventListener("click", async () => {
    el.querySelectorAll(".rp-recompute").forEach(b => { b.disabled = true; });
    btn.insertAdjacentHTML("afterend", '<span class="td-muted rp-busy"> <span class="spinner"></span>Calculando… puede tardar hasta un minuto.</span>');
    try {
      await api.rapmRecompute({ competition: d.competition.id });
      opts.toast?.("Impacto ajustado recalculado.");
      renderRapm(el, playerId, opts);
    } catch (e) {
      el.querySelectorAll(".rp-recompute").forEach(b => { b.disabled = false; });
      el.querySelector(".rp-busy")?.remove();
      opts.toast ? opts.toast(_err(e), "error") : alert(_err(e));
    }
  }));
  const fullBtn = el.querySelector("#rp-full-btn");
  fullBtn?.addEventListener("click", () => {
    fullBtn.remove();
    mountTable(el.querySelector("#rp-full"), () => api.table("rapm", { competition: d.competition.id }), { tableId: "rapm", title: "Impacto ajustado" });
  });
}
