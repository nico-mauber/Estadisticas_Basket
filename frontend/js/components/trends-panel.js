// ── Tendencias y evolución (F-18) ────────────────────────────────────────────
// Un único componente para equipo y jugador: hasta tres métricas del conjunto estándar partido a partido, con media móvil,
// Ø de la competencia como referencia, diferencia de puntos por partido, indicador de tendencia (últimos N contra el resto,
// con significancia) y hitos (sede, racha cortada, ausencias de jugadores clave). El cálculo es del servidor (`/api/trends`).
import { api } from "../api.js";
import { loadCatalog, groupsFor, metricLabel, metricDef } from "../core/catalog.js";
import { fmtNumber, fmtSigned, PCT, DEC1, DEC2 } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COLORS = ["#ff6a00", "#4ea1ff", "#3ecf8e"];
const PRESET_LABEL = { pts_vs_rec: "Puntos anotados y recibidos", oer_der: "OER y DER", efg_to: "eFG% y TO%" };
const PRESETS = [["pts_vs_rec", ["pts", "pts_against"]], ["oer_der", ["oer", "der"]], ["efg_to", ["efg_pct", "to_pct"]]];
const MA_OPTIONS = [["3", "Media móvil de 3"], ["5", "Media móvil de 5"], ["10", "Media móvil de 10"], ["0", "Sin media móvil"]];
let _token = 0;
const _charts = {};

const _scale = fmt => (fmt === "pct" ? "pct" : fmt === "dec2" || fmt === "signed_dec2" ? "ratio" : "count");
const _fmt = (fmt, v) => v == null ? "—" : fmt === "pct" ? PCT(v) : fmt === "dec1" ? DEC1(v) : fmt === "signed_dec2" ? fmtSigned(v, 2) : fmt === "int" ? fmtNumber(v, 0) : DEC2(v);
const _dfmt = (fmt, v) => v == null ? "—" : fmt === "pct" ? fmtSigned(v * 100, 1) + " pp" : fmt === "dec1" ? fmtSigned(v, 1) : fmtSigned(v, 2);
const _reason = r => ({ dnp: "No jugó", sin_intentos: "Sin intentos", sin_perdidas: "Sin pérdidas", sin_datos: "Sin datos", no_registrado: "No registrado", sin_pbp: "Sin play-by-play" }[r] || "Sin dato");

function _destroy(id) { if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; } }

function _fixedState(opts) {
  const defaults = ["oer", "der"];
  return { metrics: opts.metrics?.length ? opts.metrics : defaults, ma: opts.ma ?? null, lastN: opts.lastN ?? null };
}

/** `entity`: "team" | "player". `opts`: `params` (contexto), `base`, `metrics`, `ma`, `lastN`, `onChange(state)`. */
export async function renderTrends(el, entity, id, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const st = _fixedState(opts);
  el.innerHTML = '<div class="card"><div class="card-title">Evolución y tendencias</div><p class="empty"><span class="spinner"></span>Calculando…</p></div>';
  let d;
  try {
    await loadCatalog();
    d = await api.trends({ entity, id, metrics: st.metrics.join(","), ma: st.ma && st.ma !== 0 ? st.ma : null, last_n: st.lastN, base: opts.base || "partido", ...(opts.params || {}) });
  } catch (e) {
    if (token !== _token) return;
    const msg = e instanceof TypeError || navigator.onLine === false ? "Sin conexión: el gráfico necesita conexión." : e.message || "No se pudo cargar.";
    el.innerHTML = `<div class="card"><div class="card-title">Evolución y tendencias</div><p class="empty below-avg">${esc(msg)}</p></div>`;
    return;
  }
  if (token !== _token) return;
  const maOn = st.ma !== 0;
  const ma = st.ma ?? d.ma;
  const metricsAll = groupsFor(entity).map(g => `<optgroup label="${esc(g.label)}">${g.metrics.filter(k => metricDef(k)?.base_mode !== "volume" && metricDef(k)?.direction !== undefined)
    .map(k => `<option value="${esc(k)}">${esc(metricLabel(k))}</option>`).join("")}</optgroup>`).join("");
  const sel = i => `<select class="map-select tr-metric" data-i="${i}" aria-label="Serie ${i + 1}"><option value="">${i === 0 ? "Métrica" : "— ninguna —"}</option>${metricsAll}</select>`;
  el.innerHTML = `<div class="card tr-card"><div class="card-title">Evolución y tendencias — ${esc(d.context?.label || "")}</div>
    <div class="ld-controls tr-controls">
      <label class="gp-lbl">Pares frecuentes<span class="tr-presets">${PRESETS.map(([k]) => `<button type="button" class="filter-pill tr-preset" data-preset="${k}">${esc(PRESET_LABEL[k])}</button>`).join("")}</span></label>
    </div>
    <div class="ld-controls tr-controls">${[0, 1, 2].map(sel).join("")}
      <label class="gp-lbl">Media móvil<select class="map-select" id="tr-ma">${MA_OPTIONS.map(([v, l]) => `<option value="${v}"${(maOn ? String(ma) : "0") === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="gp-lbl">Últimos N (tendencia)<input id="tr-n" type="number" min="1" class="ld-min" value="${d.last_n}"></label>
      <button type="button" class="btn btn-ghost btn-sm" id="tr-png">Descargar imagen</button></div>
    <p class="tr-warn below-avg" id="tr-warn" role="status" hidden></p>
    <div class="tr-chart"><canvas id="tr-canvas" height="240"></canvas></div>
    <p class="td-muted">Línea punteada: media móvil. Línea fina horizontal: Ø de la competencia. Los partidos sin valor quedan como hueco (no se dibujan como 0).
      Marcadores: ▲ visitante, ● local; el borde rojo marca un partido que cortó una racha; el tooltip muestra las ausencias de jugadores clave.</p></div>
    <div class="card"><div class="card-title">Diferencia de puntos por partido</div><div class="tr-chart"><canvas id="tr-diff" height="150"></canvas></div>
      <p class="td-muted">${entity === "team" ? "Puntos anotados menos puntos recibidos." : "+/- del jugador en el partido."} Verde = victoria del equipo, rojo = derrota.</p></div>
    <div class="card"><div class="card-title">Tendencia: últimos ${d.last_n} partidos contra el resto</div><div class="tr-trends" id="tr-trends"></div></div>`;
  el.querySelectorAll(".tr-metric").forEach((s, i) => { s.value = d.series[i]?.metric || ""; });

  const change = patch => opts.onChange?.({ metrics: st.metrics, ma: maOn ? ma : 0, lastN: d.last_n, ...patch });
  const picked = () => [...el.querySelectorAll(".tr-metric")].map(s => s.value).filter(Boolean);
  el.querySelectorAll(".tr-metric").forEach(s => s.addEventListener("change", () => {
    const m = picked();
    const scales = new Set(m.map(k => _scale(metricDef(k)?.fmt)));
    const warn = el.querySelector("#tr-warn");
    if (!m.length) return;
    if (new Set(m).size !== m.length) { warn.textContent = "Elegí métricas distintas."; warn.hidden = false; return; }
    if (scales.size > 2) { warn.textContent = "Solo hay dos ejes: elegí métricas de, como mucho, dos escalas distintas (porcentajes, razones o conteos)."; warn.hidden = false; return; }
    warn.hidden = true;
    change({ metrics: m });
  }));
  el.querySelectorAll(".tr-preset").forEach(b => b.addEventListener("click", () => change({ metrics: PRESETS.find(p => p[0] === b.dataset.preset)[1].filter(k => !metricDef(k) || metricDef(k).entities.includes(entity)) })));
  el.querySelector("#tr-ma").addEventListener("change", e => change({ ma: Number(e.target.value) }));
  el.querySelector("#tr-n").addEventListener("change", e => change({ lastN: Math.max(1, Number(e.target.value) || d.last_n) }));

  _draw(d, maOn, entity);
  _renderTrends(el.querySelector("#tr-trends"), d);
  el.querySelector("#tr-png").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = document.getElementById("tr-canvas").toDataURL("image/png");
    a.download = `evolucion_${entity}_${id}.png`.toLowerCase();
    a.click();
  });
}

function _draw(d, maOn, entity) {
  _destroy("tr-canvas"); _destroy("tr-diff");
  const canvas = document.getElementById("tr-canvas");
  if (!canvas || !d.games.length) return;
  const labels = d.games.map((g, i) => g.date ? g.date.slice(5) : `P${i + 1}`);
  const scales = {}; const axisOf = {}; const order = [];
  d.series.forEach(s => { const sc = _scale(s.fmt); if (!order.includes(sc)) order.push(sc); axisOf[s.metric] = order.indexOf(sc) === 0 ? "y" : "y1"; });
  const datasets = [];
  d.series.forEach((s, i) => {
    const color = COLORS[i];
    const pointStyle = d.milestones.map(m => (m.venue === "V" ? "triangle" : "circle"));
    const borders = d.milestones.map(m => (m.streak_break ? "#e5484d" : color));
    datasets.push({ label: s.label, data: s.values.map(v => (v == null ? null : +v)), borderColor: color, backgroundColor: color, yAxisID: axisOf[s.metric],
      borderWidth: 2, tension: 0.2, spanGaps: false, pointStyle, pointRadius: 4, pointBorderColor: borders, pointBorderWidth: d.milestones.map(m => (m.streak_break ? 3 : 1)), _fmt: s.fmt, _metric: s.metric });
    if (maOn) datasets.push({ label: `${s.label} (media móvil)`, data: s.ma, borderColor: color, borderDash: [6, 4], borderWidth: 2, pointRadius: 0, yAxisID: axisOf[s.metric], spanGaps: true, _fmt: s.fmt });
    const ref = d.reference?.[s.metric];
    if (ref != null) datasets.push({ label: `Ø ${s.label}`, data: labels.map(() => ref), borderColor: color, borderWidth: 1, borderDash: [2, 3], pointRadius: 0, yAxisID: axisOf[s.metric], _fmt: s.fmt });
  });
  scales.x = { ticks: { maxRotation: 0, autoSkip: true } };
  scales.y = { position: "left", title: { display: true, text: d.series.filter(s => axisOf[s.metric] === "y").map(s => s.label).join(" · ") } };
  if (order.length > 1) scales.y1 = { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: d.series.filter(s => axisOf[s.metric] === "y1").map(s => s.label).join(" · ") } };
  _charts["tr-canvas"] = new Chart(canvas, {
    type: "line", data: { labels, datasets },
    options: { responsive: true, interaction: { mode: "index", intersect: false }, scales,
      plugins: { legend: { labels: { usePointStyle: true } },
        tooltip: { callbacks: {
          label: c => `${c.dataset.label}: ${c.raw == null ? "sin dato" : _fmt(c.dataset._fmt, c.raw)}`,
          afterBody: items => {
            const i = items[0]?.dataIndex; const g = d.games[i]; const m = d.milestones[i]; if (!g) return [];
            const lines = [`${g.home_away === "L" ? "Local" : g.home_away === "V" ? "Visitante" : ""} vs ${g.opponent || "—"}${g.team_pts != null ? ` (${g.team_pts}-${g.opp_pts})` : ""}`];
            d.series.forEach(s => { if (g.values[s.metric] == null) lines.push(`${s.label}: ${_reason(g.reasons[s.metric])}`); });
            if (m?.streak_break) lines.push(`Cortó una racha de ${m.streak_break.length} ${m.streak_break.result === "V" ? "victorias" : "derrotas"}`);
            if (m?.absent?.length) lines.push(`Ausentes clave: ${m.absent.join(", ")}`);
            return lines;
          } } } } },
  });
  const diff = document.getElementById("tr-diff");
  if (diff) {
    _charts["tr-diff"] = new Chart(diff, {
      type: "bar",
      data: { labels, datasets: [{ label: entity === "team" ? "Diferencia de puntos" : "+/-", data: d.games.map(g => (g.diff == null ? null : g.diff)),
        backgroundColor: d.games.map(g => (g.result === "V" ? "#3ecf8e" : g.result === "D" ? "#e5484d" : "#8b949e")) }] },
      options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw == null ? "sin dato" : fmtSigned(c.raw, 0)}` } } },
        scales: { y: { grid: { color: ctx => (ctx.tick.value === 0 ? "#8b949e" : "rgba(127,127,127,.15)") } } } },
    });
  }
}

function _renderTrends(el, d) {
  el.innerHTML = d.series.map(s => {
    const t = s.trend;
    if (t.reason) {
      return `<div class="tr-trend"><strong>${esc(s.label)}</strong><p class="td-muted">${t.reason === "muestra_insuficiente"
        ? `Muestra insuficiente: hacen falta al menos 3 partidos con valor en cada grupo (hay ${t.n_last} y ${t.n_rest}).` : "Sin datos para comparar."}</p></div>`;
    }
    const cls = t.direction === "mejora" ? "above-avg" : t.direction === "empeora" ? "below-avg" : "";
    const word = t.direction === "mejora" ? "Mejora" : t.direction === "empeora" ? "Empeora" : t.direction === "neutral" ? "Cambia" : "Sin cambio";
    const sig = t.p_value == null ? "sin variación para evaluar la significancia"
      : t.significant ? `diferencia significativa (p = ${fmtNumber(t.p_value, 3)} < ${fmtNumber(d.alpha, 2)})` : `diferencia no significativa (p = ${fmtNumber(t.p_value, 3)}): puede ser azar`;
    return `<div class="tr-trend"><strong>${esc(s.label)}</strong>
      <div class="${cls}"><span class="tr-delta">${word} ${_dfmt(s.fmt, t.delta)}</span>${t.delta_rel != null ? ` <small>(${fmtSigned(t.delta_rel * 100, 1)} %)</small>` : ""}</div>
      <div class="td-muted">Últimos ${t.n_last}: ${_fmt(s.fmt, t.last)} · el resto (${t.n_rest}): ${_fmt(s.fmt, t.rest)}</div>
      <div class="td-muted">${esc(sig)}</div></div>`;
  }).join("");
}

export function destroyTrends() { _token++; _destroy("tr-canvas"); _destroy("tr-diff"); }
