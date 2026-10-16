/**
 * Ficha de métrica — T-01. Único componente de la ficha de cinco elementos
 * (valor, ranking, líder, promedio, percentil). Devuelve HTML string; el hover/tap
 * del ranking completo se engancha con `bindMetricCards`. Sin i18n: copy en español.
 */
import { metricLabel, metricDef, populationMinSize } from "../core/catalog.js";
import { fmtMetric, fmtNumber, isNull, nullDisplay } from "../core/format.js";
import { percentileBg } from "../core/colors.js";
import { api } from "../api.js";

// Decimales con que se formatea una distancia según el fmt del catálogo.
function _deltaDecimals(fmt) {
  switch (fmt) {
    case "dec1": return 1;
    case "int":
    case "signed_int": return 0;
    default: return 2; // dec2, signed_dec2 y resto
  }
}

// Signo "+"/"−" (U+2212) + magnitud en los decimales indicados.
function _signed(n, decimals) {
  const sign = n < 0 ? "−" : "+";
  return sign + fmtNumber(Math.abs(n), decimals);
}

// Distancia orientada ya calculada por el backend (dist_avg / dist_leader) a texto.
// pct → puntos porcentuales " pp"; resto → signo + número en decimales del catálogo;
// porcentaje relativo entre paréntesis cuando rel != null.
export function fmtDelta(key, d, rel) {
  if (isNull(d)) return "";
  const def = metricDef(key);
  const fmt = def?.fmt;
  let base;
  if (fmt === "pct") {
    base = _signed(d * 100, 1) + " pp";
  } else {
    base = _signed(d, _deltaDecimals(fmt));
  }
  if (rel != null && !isNull(rel)) {
    base += ` (${_signed(rel * 100, 1)} %)`;
  }
  return base;
}

// Texto de razón de percentil (spec §6). `minSize` del payload si se conoce.
function _pctReasonText(reason, minSize) {
  switch (reason) {
    case "poblacion_insuficiente":
      return `Sin referencia: la población tiene menos de ${minSize ?? "varias"} entidades`;
    case "sin_universo":
      return "Elegí una competencia para ver el ranking";
    case "contexto_no_comparable":
      return "Este filtro no tiene una población comparable";
    default:
      return "";
  }
}

function _rankText(m) {
  const sign = m.tied ? "=" : "";
  return `${sign}${m.rank}.º de ${m.rank_total}`;
}

function _chipHTML(percentile) {
  if (isNull(percentile)) return "";
  const bg = percentileBg(percentile);
  const style = bg ? ` style="background:${bg}"` : "";
  return `<span class="mc-chip"${style}>p${percentile}</span>`;
}

// ── metricCard ───────────────────────────────────────────────────────────────
// opts: { entityType, label, layout="card", showRanking=true, valueOverride, minSize }
export function metricCard(key, metricObj, opts = {}) {
  const { entityType, label, layout = "card", showRanking = true, valueOverride } = opts;
  const minSize = opts.minSize ?? populationMinSize();
  const def = metricDef(key);
  const neutral = def?.direction === "neutral";
  const m = metricObj || {};
  const value = valueOverride !== undefined ? valueOverride : m.value;
  const name = label || metricLabel(key);

  const dataAttrs = showRanking && entityType && key
    ? ` data-metric="${key}" data-entity="${entityType}"${opts.id != null ? ` data-id="${opts.id}"` : ""}`
    : "";

  // Valor nulo: solo "—" con razón, sin ficha.
  if (isNull(value)) {
    const disp = nullDisplay(m.reason);
    if (layout === "row") {
      return `<div class="metric-cell"><span class="mc-val">${disp}</span></div>`;
    }
    return `<div class="stat-box metric-card"><div class="stat-label">${name}</div><div class="mc-value">${disp}</div></div>`;
  }

  const valDisp = fmtMetric(key, value);
  const hasFicha = m.rank != null && m.rank_total != null && !m.pct_reason;
  const fuera = m.in_population === false;
  const basisPartido = m.basis === "partido";

  // ── Layout row (panel estándar / tablas): valor · N.º/M · pNN ───────────────
  if (layout === "row") {
    let parts = `<span class="mc-val">${valDisp}</span>`;
    let title = name;
    if (hasFicha) {
      parts += ` <span class="mc-rank">${_rankText(m)}</span>`;
      if (!isNull(m.percentile)) parts += ` ${_chipHTML(neutral ? null : m.percentile)}`;
      title = `${name} · ${_rankText(m)}${basisPartido ? " (por partido)" : ""}`;
      if (m.leader) title += ` · Líder: ${m.leader.name} ${fmtMetric(key, m.leader.value)}`;
      if (!isNull(m.avg)) title += ` · Ø ${fmtMetric(key, m.avg)}`;
    } else if (m.pct_reason) {
      title = `${name} · ${_pctReasonText(m.pct_reason, minSize)}`;
    }
    const cls = `metric-cell${fuera ? " fuera-poblacion" : ""}`;
    return `<div class="${cls}"${dataAttrs} title="${title.replace(/"/g, "&quot;")}">${parts}</div>`;
  }

  // ── Layout card (Equipo / Jugador) ──────────────────────────────────────────
  const lines = [];
  if (hasFicha) {
    const porPartido = basisPartido ? ` <span class="mc-basis">(por partido)</span>` : "";
    lines.push(`<div class="mc-line mc-rank-line">${_rankText(m)}${porPartido}</div>`);
    if (m.leader) {
      const dl = fmtDelta(key, m.dist_leader, m.dist_leader_rel);
      const dlTxt = dl ? ` (${dl})` : "";
      lines.push(`<div class="mc-line mc-leader">Líder: ${m.leader.name} ${fmtMetric(key, m.leader.value)}${dlTxt}</div>`);
    }
    if (!isNull(m.avg)) {
      const da = fmtDelta(key, m.dist_avg, m.dist_avg_rel);
      const daTxt = da ? ` (${da})` : "";
      lines.push(`<div class="mc-line mc-avg">Ø ${fmtMetric(key, m.avg)}${daTxt}</div>`);
    }
    if (!isNull(m.percentile) && !neutral) {
      lines.push(`<div class="mc-line mc-pct-line">${_chipHTML(m.percentile)}</div>`);
    }
  } else if (m.pct_reason) {
    lines.push(`<div class="mc-line mc-no-ref">${_pctReasonText(m.pct_reason, minSize)}</div>`);
  }

  const fueraChip = fuera
    ? `<div class="mc-line mc-low-sample"><span class="mc-low-chip">Muestra baja · fuera de la población</span></div>`
    : "";

  const cls = `stat-box metric-card${fuera ? " fuera-poblacion" : ""}`;
  return `
    <div class="${cls}"${dataAttrs}>
      <div class="stat-label">${name}</div>
      <div class="mc-value">${valDisp}</div>
      ${lines.join("")}
      ${fueraChip}
    </div>`;
}

// ── bindMetricCards: ranking completo al hover (escritorio) / tap (táctil) ─────
const _canHover = () => typeof matchMedia === "function" && matchMedia("(hover: hover)").matches;

export function bindMetricCards(el, { entityType, contextQuery = {} } = {}) {
  if (!el || el._mcBound) {
    if (el) el._mcCtx = { entityType, contextQuery, cache: new Map() };
    return;
  }
  el._mcBound = true;
  el._mcCtx = { entityType, contextQuery, cache: new Map() };

  let openPanel = null;
  let hoverTimer = null;
  let activeCard = null;

  const close = () => {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (openPanel) { openPanel.remove(); openPanel = null; }
    if (el._mcBackdrop) { el._mcBackdrop.remove(); el._mcBackdrop = null; }
    activeCard = null;
  };

  async function fetchRanking(type, metric, id) {
    const params = { id, ...el._mcCtx.contextQuery };
    const url = `${type}/${metric}?${JSON.stringify(params)}`;
    if (el._mcCtx.cache.has(url)) return el._mcCtx.cache.get(url);
    const data = await api.ranking(type, metric, params);
    el._mcCtx.cache.set(url, data);
    return data;
  }

  function rowsHTML(data, type, metric) {
    const rows = (data.rows || []).map(r => {
      const hi = r.highlight ? " mc-row-hi" : "";
      const sign = r.tied ? "=" : "";
      return `<tr class="mc-rank-row${hi}"><td>${sign}${r.rank}.</td><td>${r.name}</td><td>${fmtMetric(metric, r.value)}</td></tr>`;
    }).join("");
    const outside = (data.outside_population || []).length
      ? `<tr class="mc-rank-sep"><td colspan="3">Fuera de la población (muestra baja)</td></tr>` +
        data.outside_population.map(r =>
          `<tr class="mc-rank-out"><td>${r.hypothetical_rank != null ? r.hypothetical_rank + "." : "—"}</td><td>${r.name}</td><td>${fmtMetric(metric, r.value)}</td></tr>`
        ).join("")
      : "";
    const n = data.population?.size ?? (data.rows || []).length;
    const foot = !isNull(data.avg)
      ? `<tfoot><tr><td colspan="3">Ø ${fmtMetric(metric, data.avg)} · ${n} entidades</td></tr></tfoot>`
      : "";
    if (!rows && !outside) {
      return `<p class="empty">Sin datos para armar el ranking</p>`;
    }
    return `<table class="mc-rank-table"><tbody>${rows}${outside}</tbody>${foot}</table>`;
  }

  function panelHTML(title, inner) {
    return `<div class="mc-popover-head">Ranking — ${title}</div><div class="mc-popover-body">${inner}</div>`;
  }

  async function open(card, { sheet }) {
    const metric = card.dataset.metric;
    const type = card.dataset.entity || el._mcCtx.entityType;
    const id = card.dataset.id || el._mcCtx.contextQuery.id;
    const title = metricLabel(metric);
    close();
    activeCard = card;

    const node = document.createElement("div");
    if (sheet) {
      node.className = "mc-sheet";
      const backdrop = document.createElement("div");
      backdrop.className = "mc-sheet-backdrop";
      backdrop.addEventListener("click", close);
      document.body.appendChild(backdrop);
      el._mcBackdrop = backdrop;
      document.body.appendChild(node);
    } else {
      node.className = "mc-popover";
      node.setAttribute("role", "dialog");
      node.tabIndex = -1;
      card.appendChild(node);
    }
    openPanel = node;

    const headerExtra = sheet ? `<button type="button" class="mc-sheet-close">Cerrar</button>` : "";
    node.innerHTML = panelHTML(title, `<p class="empty"><span class="spinner"></span>Cargando…</p>`) + headerExtra;

    if (sheet) node.querySelector(".mc-sheet-close")?.addEventListener("click", close);

    try {
      const data = await fetchRanking(type, metric, id);
      if (openPanel !== node) return; // se cerró/cambió mientras cargaba
      node.innerHTML = panelHTML(title, rowsHTML(data, type, metric)) + headerExtra;
      if (sheet) node.querySelector(".mc-sheet-close")?.addEventListener("click", close);
      const hiRow = node.querySelector(".mc-row-hi");
      if (hiRow) hiRow.scrollIntoView({ block: "center" });
      if (!sheet) node.focus();
    } catch {
      if (openPanel !== node) return;
      node.innerHTML = panelHTML(title, `<p class="empty below-avg">No se pudo cargar el ranking</p>`) + headerExtra;
      if (sheet) node.querySelector(".mc-sheet-close")?.addEventListener("click", close);
    }
  }

  const cardOf = e => e.target.closest?.(".metric-card[data-metric], .metric-cell[data-metric]");

  if (_canHover()) {
    el.addEventListener("mouseover", e => {
      const card = cardOf(e);
      if (!card || card === activeCard) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => open(card, { sheet: false }), 250);
    });
    el.addEventListener("focusin", e => {
      const card = cardOf(e);
      if (!card || card === activeCard) return;
      open(card, { sheet: false });
    });
    el.addEventListener("mouseout", e => {
      const card = cardOf(e);
      if (!card) return;
      const to = e.relatedTarget;
      if (to && (card.contains(to) || (openPanel && openPanel.contains(to)))) return;
      close();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  } else {
    el.addEventListener("click", e => {
      const card = cardOf(e);
      if (!card) return;
      open(card, { sheet: true });
    });
  }
}
