/**
 * Panel "Conjunto estándar" — T-05. Reusado en Equipo, Jugador, Combinación, ON/OFF y Cierres.
 * Único componente de render del conjunto estándar: ninguna pantalla mantiene su propia lista
 * de métricas (RF-17).
 */
import { metricLabel, metricDef, groupsFor } from "../core/catalog.js";
import { fmtMetric, fmtSigned, isNull, nullDisplay } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";
import { metricCard } from "./metric-card.js";
import { BASE_OPTIONS } from "../core/base.js";

const COMPACT_GROUPS = ["volumen", "produccion", "tiro_pct", "balon"];

// oer/der/net_rating: cuando el backend informa regresión hacia la media (T-02),
// se muestra crudo + ajustado + banda en vez de solo el valor crudo.
const REGRESSED_KEYS = ["oer", "der", "net_rating"];

function _adjHTML(key, metricObj) {
  const adj = metricObj?.adj;
  if (!adj || isNull(adj.value)) return "";
  const ajustado = fmtMetric(key, adj.value);
  const banda = fmtMetric(key, adj.band);
  const prior = adj.prior != null ? fmtMetric(key, adj.prior) : "—";
  const title = `Ajustado hacia la media de la competencia (K = ${adj.k}, media ${prior})`;
  return ` <span class="adj-value" title="${title}">aj. ${ajustado}</span><span class="adj-band" title="${title}">± ${banda}</span>`;
}

function _estBadge(metricObj) {
  if (!metricObj) return "";
  let out = "";
  if (metricObj.estimated) out += `<span class="std-est" title="Posesiones estimadas por minutos: no hay jugada a jugada para algún partido.">estimado</span>`;
  if (metricObj.partial) out += `<span class="std-partial" title="Calculado con datos parciales de la selección">parcial</span>`;
  return out;
}

// T-01: la celda del panel estándar usa la ficha en layout "row" (valor · puesto · percentil).
function cellHTML(key, metricObj, ctx) {
  const label = metricLabel(key);
  const entityType = ctx?.entity?.type;
  const minSize = ctx?.population?.min_size;
  const value = metricObj?.value;
  const adjHTML = REGRESSED_KEYS.includes(key) && !isNull(value) ? _adjHTML(key, metricObj) : "";
  const extra = _estBadge(metricObj) + adjHTML;
  const card = metricCard(key, metricObj, { layout: "row", entityType, label, id: ctx?.entity?.id, minSize });
  return `
    <div class="stat-box std-cell">
      <div class="stat-label">${label}</div>
      <div class="stat-value neutral">${card}${extra}</div>
    </div>`;
}

// Línea "Referencia: {rank_total} {criterion} · {context_label}" desde payload.population.
function _referenceLine(payload) {
  const pop = payload.population;
  if (!pop || pop.reason) return "";
  const size = pop.size != null ? pop.size : "";
  const parts = [pop.criterion ? `${size} ${pop.criterion}`.trim() : (size ? `${size}` : "")];
  if (pop.context_label) parts.push(pop.context_label);
  const text = parts.filter(Boolean).join(" · ");
  return text ? `<p class="td-muted std-reference">Referencia: ${text}</p>` : "";
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
    <div class="seg-toggle" role="group" aria-label="Base">
      ${BASE_OPTIONS.map(o => `<button type="button" data-base="${o.key}" title="${o.title}" aria-pressed="${base === o.key}">${o.label}</button>`).join("")}
    </div>` : "";
  const badge = payload.sample ? sampleBadge(payload.sample) : "";
  const lowSampleWarning = payload.sample && !payload.sample.ranked
    ? `<p class="empty below-avg std-low-sample-warning">Muestra baja: no entra en rankings ni recomendaciones</p>`
    : "";
  return `
    <div class="std-head">
      ${toggle}
      <p class="td-muted std-context">${contextLine}</p>
      <div class="std-head-extra">${badge}</div>
    </div>
    ${_referenceLine(payload)}
    ${coverageNote}
    ${lowSampleWarning}`;
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
      const onAdj = REGRESSED_KEYS.includes(k) && !isNull(onObj?.value) ? _adjHTML(k, onObj) : "";
      const offAdj = REGRESSED_KEYS.includes(k) && !isNull(offObj?.value) ? _adjHTML(k, offObj) : "";
      const onDisp = (isNull(onObj?.value) ? nullDisplay(onObj?.reason) : fmtMetric(k, onObj.value)) + onAdj;
      const offDisp = (isNull(offObj?.value) ? nullDisplay(offObj?.reason) : fmtMetric(k, offObj.value)) + offAdj;
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
  const lowSampleClass = payload.sample && !payload.sample.ranked ? " metric-low-sample" : "";

  el.innerHTML = `<div class="std-panel">
    ${_headerHTML(payload, { base, onBaseChange })}
    <div class="std-body${lowSampleClass}">
      ${gamesZero
        ? `<p class="empty">Sin partidos en la selección. Cambiá el filtro de competencia o de períodos.</p>`
        : layout === "compare"
          ? _compareBody(payload, entityType)
          : _gridBody(payload, entityType, compact)}
    </div>
  </div>`;

  if (onBaseChange) {
    el.querySelectorAll(".seg-toggle button").forEach(btn => {
      btn.addEventListener("click", () => onBaseChange(btn.dataset.base));
    });
  }
}
