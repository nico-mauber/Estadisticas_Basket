/**
 * Panel "Conjunto estándar" — T-05. Reusado en Equipo, Jugador, Combinación, ON/OFF y Cierres.
 * Único componente de render del conjunto estándar: ninguna pantalla mantiene su propia lista
 * de métricas (RF-17).
 */
import { metricLabel, metricDef, groupsFor } from "../core/catalog.js";
import { fmtMetric, fmtSigned, isNull, nullDisplay } from "../core/format.js";

const COMPACT_GROUPS = ["volumen", "produccion", "tiro_pct", "balon"];

function _estBadge(metricObj) {
  if (!metricObj) return "";
  let out = "";
  if (metricObj.estimated) out += `<span class="std-est" title="Estimado por minutos jugados (sin play-by-play)">est.</span>`;
  if (metricObj.partial) out += `<span class="std-partial" title="Calculado con datos parciales de la selección">parcial</span>`;
  return out;
}

// Punto de extensión: T-01 reemplaza `cellHTML` por `metricCard` (percentil/ranking/badge).
function cellHTML(key, metricObj, ctx) {
  const label = metricLabel(key);
  const value = metricObj?.value;
  const reason = metricObj?.reason;
  const display = isNull(value) ? nullDisplay(reason) : fmtMetric(key, value);
  return `
    <div class="stat-box std-cell">
      <div class="stat-label">${label}</div>
      <div class="stat-value neutral">${display}${_estBadge(metricObj)}</div>
    </div>`;
}

function _headerHTML(payload, { base, onBaseChange }) {
  const ctx = payload.context || {};
  const gamesUsed = ctx.games_used ?? payload.sample?.games ?? null;
  const gamesTotal = ctx.games_total ?? null;
  const contextLine = ctx.label
    ? `${ctx.label}${gamesUsed != null ? ` · ${gamesUsed}${gamesTotal != null ? `/${gamesTotal}` : ""} partido(s)` : ""}`
    : "";
  const coverage = payload.coverage;
  const coverageNote = coverage && coverage.on_court_games_exact < coverage.games
    ? `<p class="td-muted std-coverage">Cobertura en cancha: ${coverage.on_court_games_exact} de ${coverage.games} partido(s) con play-by-play exacto.</p>`
    : "";
  const toggle = onBaseChange ? `
    <div class="seg-toggle" role="group">
      <button type="button" data-base="total" aria-pressed="${base === "total"}">Totales</button>
      <button type="button" data-base="partido" aria-pressed="${base === "partido"}">Por partido</button>
    </div>` : "";
  return `
    <div class="std-head">
      ${toggle}
      <p class="td-muted std-context">${contextLine}</p>
      <div class="std-head-extra"></div>
    </div>
    ${coverageNote}`;
}

function _gridBody(payload, entityType, compact) {
  const groups = groupsFor(entityType);
  const shown = compact ? groups.filter(g => COMPACT_GROUPS.includes(g.key)) : groups;
  return shown.map(g => {
    const open = g.key === "extra" ? "" : " open";
    const cells = g.metrics.map(k => cellHTML(k, payload.metrics?.[k], payload)).join("");
    return `
      <details class="std-group"${open}>
        <summary>${g.label}</summary>
        <div class="stat-grid std-grid">${cells}</div>
      </details>`;
  }).join("");
}

function _compareBody(payload, entityType) {
  const groups = groupsFor(entityType);
  const states = payload.states || {};
  const diff = payload.diff || {};
  const on = states.on?.metrics || {};
  const off = states.off?.metrics || {};
  return groups.map(g => {
    const rows = g.metrics.map(k => {
      const def = metricDef(k);
      const onObj = on[k], offObj = off[k];
      const onDisp = isNull(onObj?.value) ? nullDisplay(onObj?.reason) : fmtMetric(k, onObj.value);
      const offDisp = isNull(offObj?.value) ? nullDisplay(offObj?.reason) : fmtMetric(k, offObj.value);
      const showDiff = def?.kind === "rate" && diff[k] != null;
      const diffDisp = showDiff
        ? (def.fmt === "pct" ? fmtSigned(diff[k] * 100, 1) + "%" : fmtSigned(diff[k], def.fmt === "dec1" ? 1 : 2))
        : "—";
      return `<tr><td>${metricLabel(k)}</td><td>${onDisp}</td><td>${offDisp}</td><td>${diffDisp}</td></tr>`;
    }).join("");
    return `
      <details class="std-group" open>
        <summary>${g.label}</summary>
        <div class="table-wrap std-compare">
          <table>
            <thead><tr><th>Métrica</th><th>ON</th><th>OFF</th><th>Δ</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </details>`;
  }).join("");
}

export function renderStandardPanel(el, payload, opts = {}) {
  const { compact = false, layout = "grid", base = "partido", onBaseChange } = opts;

  if (payload === null) {
    el.innerHTML = `<div class="std-panel"><p class="empty"><span class="spinner"></span>Calculando métricas…</p></div>`;
    return;
  }
  if (payload.error) {
    el.innerHTML = `<div class="std-panel"><p class="empty below-avg">${payload.error}</p></div>`;
    return;
  }

  const entityType = payload.entity?.type;
  const gamesUsed = payload.context?.games_used;
  const gamesZero = gamesUsed === 0 || (payload.sample && payload.sample.games === 0);

  el.innerHTML = `<div class="std-panel">
    ${_headerHTML(payload, { base, onBaseChange })}
    ${gamesZero
      ? `<p class="empty">Sin partidos en la selección. Cambiá el filtro de competencia o de períodos.</p>`
      : layout === "compare"
        ? _compareBody(payload, entityType)
        : _gridBody(payload, entityType, compact)}
  </div>`;

  if (onBaseChange) {
    el.querySelectorAll(".seg-toggle button").forEach(btn => {
      btn.addEventListener("click", () => onBaseChange(btn.dataset.base));
    });
  }
}
