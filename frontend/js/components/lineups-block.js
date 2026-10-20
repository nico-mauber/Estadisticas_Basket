// ── Quintetos y ON/OFF del plantel (F-06) ────────────────────────────────────
// Tres piezas sobre las tablas T-06 `team_lineups` y `team_onoff`:
//   · tarjetas con los 3 mejores quintetos por categoría (Impacto, Tiro, Rebote, Cuidado, Ritmo),
//   · tabla completa de quintetos (o combinaciones de 3/4), ordenable y exportable,
//   · tabla ON/OFF del plantel con selector ON / OFF / Diferencia.
// Las tarjetas y la tabla salen de la MISMA respuesta: cambiar de categoría no vuelve a pedir nada.
import { api } from "../api.js";
import { mountTable } from "./data-table.js";
import { sampleBadge } from "./sample-badge.js";
import { metricLabel } from "../core/catalog.js";
import { DEC1, DEC2, PCT, isNull } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Categoría → métricas que la definen (la primera manda el orden) y si se ordena de menor a mayor.
const CATEGORIES = [
  { key: "impacto", label: "Impacto", metrics: ["net_rating", "oer", "der"] },
  { key: "tiro", label: "Tiro", metrics: ["efg_pct", "ts_pct", "ppt"] },
  { key: "rebote", label: "Rebote", metrics: ["or_pct", "dr_pct", "trb_pct", "trb"] },
  { key: "cuidado", label: "Cuidado del balón", metrics: ["to_pct", "ast_to"], lowerIsBetter: true },
  { key: "ritmo", label: "Ritmo", metrics: ["pace"] },
  { key: "cierres", label: "Cierres", metrics: ["net_rating"], source: "clutch" },
  { key: "volumen", label: "Volumen", metrics: ["minutes", "possessions"] },
];
const TOP = 3;
const PCT_KEYS = new Set(["efg_pct", "ts_pct", "to_pct", "or_pct", "dr_pct", "trb_pct", "ft_rate"]);
const ADJUSTED = new Set(["net_rating", "oer", "der"]);

function _fmt(key, v) {
  if (isNull(v)) return "—";
  return PCT_KEYS.has(key) ? PCT(v) : (Number.isInteger(v) ? String(v) : DEC2(v));
}

// Valor de ranking de una fila: el ajustado si la métrica lo tiene (RF-17), si no el crudo.
function _rankValue(payload, row, key) {
  const adj = row.adj && row.adj[key];
  if (ADJUSTED.has(key) && adj && adj.value != null) return adj.value;
  const idx = payload.columns.findIndex(c => c.key === key);
  return idx < 0 ? null : row.values[idx];
}

function _cardHTML(payload, cat, row, pos) {
  const key = cat.metrics[0];
  const nameIdx = payload.columns.findIndex(c => c.key === "_players");
  const names = String(row.values[nameIdx] || "").split(" · ");
  const raw = _rankValue(payload, row, key);
  const adj = row.adj && row.adj[key];
  const pctIdx = payload.columns.findIndex(c => c.key === key);
  const pct = pctIdx >= 0 ? row.pct?.[pctIdx] : null;
  const recIdx = payload.columns.findIndex(c => c.key === "_record");
  const wpIdx = payload.columns.findIndex(c => c.key === "_win_pct");
  const record = recIdx >= 0
    ? `<span>Cierres ${esc(row.values[recIdx])}${row.values[wpIdx] != null ? ` · ${DEC1(row.values[wpIdx])}% victorias` : ""}</span>`
    : "";
  const others = cat.metrics.slice(1).map(k => {
    const i = payload.columns.findIndex(c => c.key === k);
    return i < 0 ? "" : `<span>${esc(metricLabel(k))} ${_fmt(k, _rankValue(payload, row, k))}</span>`;
  }).join("");
  return `<div class="lb-card" data-lineup="${esc(row.id)}">
    <div class="lb-card-head"><span class="lb-pos">${pos}.º</span>
      <span class="lb-metric">${esc(metricLabel(key))} <strong>${_fmt(key, raw)}</strong>${
        ADJUSTED.has(key) && adj && adj.band != null ? ` <em>± ${DEC2(adj.band)}</em>` : ""}</span>
      ${pct != null ? `<span class="lb-pct">p${Math.round(pct)}</span>` : ""}</div>
    <ol class="lb-names">${names.map(n => `<li>${esc(n)}</li>`).join("")}</ol>
    <div class="lb-extra">${record}${others}</div>
    <div class="lb-badge">${sampleBadge(row.sample, { compact: true })}</div>
  </div>`;
}

function _cardsHTML(payload, catKey, clutchPayload) {
  const cat = CATEGORIES.find(c => c.key === catKey) || CATEGORIES[0];
  if (cat.source === "clutch") {
    if (!clutchPayload) return '<p class="empty"><span class="spinner"></span>Calculando cierres…</p>';
    if (!clutchPayload.rows.length) return '<p class="empty">Sin partidos cerrados en la selección.</p>';
    payload = clutchPayload;
  }
  const key = cat.metrics[0];
  // Solo entran los quintetos que superan el umbral de muestra (RF-17).
  const eligible = payload.rows.filter(r => r.sample?.ranked && _rankValue(payload, r, key) != null);
  eligible.sort((a, b) => {
    const va = _rankValue(payload, a, key), vb = _rankValue(payload, b, key);
    return cat.lowerIsBetter ? va - vb : vb - va;
  });
  const top = eligible.slice(0, TOP);
  if (!top.length) {
    return `<p class="empty">Ningún quinteto supera el mínimo de muestra en esta categoría.</p>`;
  }
  return `<div class="lb-cards">${top.map((r, i) => _cardHTML(payload, cat, r, i + 1)).join("")}</div>`;
}

let _token = 0;

// `opts`: {params (competencia, últimos N, contexto), base, onBaseChange, teamName, competitionLabel}
export async function renderLineupsBlock(el, teamCode, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const { params = {}, base = "partido" } = opts;
  let size = 5;
  let view = "on";

  el.innerHTML = `<div class="card"><div class="card-title">Quintetos del equipo</div>
    <p class="empty"><span class="spinner"></span>Calculando quintetos…</p></div>`;

  let payload;
  try {
    payload = await api.table("team_lineups", { team: teamCode, ...params, size, base });
  } catch (e) {
    if (token !== _token) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    el.innerHTML = `<div class="card"><div class="card-title">Quintetos del equipo</div>
      <p class="empty below-avg">${esc(offline ? "Sin conexión: no se pueden cargar los quintetos." : (e.message || "No se pudieron cargar los quintetos."))}</p>
      <button type="button" class="btn btn-ghost btn-sm lb-retry">Reintentar</button></div>`;
    el.querySelector(".lb-retry")?.addEventListener("click", () => renderLineupsBlock(el, teamCode, opts));
    return;
  }
  if (token !== _token) return;

  if (!payload.rows.length) {
    el.innerHTML = `<div class="card"><div class="card-title">Quintetos del equipo</div>
      <p class="empty">Sin quintetos: este equipo no tiene play-by-play con cinco titulares en la selección.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-title">Mejores quintetos</div>
      <div class="lb-cats" role="group" aria-label="Categoría">
        ${CATEGORIES.map((c, i) => `<button type="button" class="filter-pill lb-cat${i === 0 ? " active" : ""}" data-cat="${c.key}">${c.label}</button>`).join("")}
      </div>
      <div class="lb-cards-host"></div>
    </div>
    <div class="card">
      <div class="card-title">Todos los quintetos</div>
      <div class="lb-sizes" role="group" aria-label="Jugadores">
        ${[5, 4, 3].map(n => `<button type="button" class="filter-pill lb-size${n === 5 ? " active" : ""}" data-size="${n}">${n === 5 ? "Quintetos" : `Combinaciones de ${n}`}</button>`).join("")}
      </div>
      <div class="lb-table"></div>
    </div>
    <div class="card">
      <div class="card-title">Quintetos en cierres</div>
      <p class="td-muted lb-note">Últimos minutos de los partidos cerrados: el récord cuenta un partido cuando el quinteto jugó al menos el mínimo de posesiones del tramo, y el resultado es el del partido.</p>
      <div class="lb-clutch"></div>
    </div>
    <div class="card">
      <div class="card-title">ON/OFF del plantel</div>
      <div class="lb-views" role="group" aria-label="Vista">
        ${[["on", "En cancha"], ["off", "Fuera de cancha"], ["diff", "Diferencia"]].map(([k, l]) =>
          `<button type="button" class="filter-pill lb-view${k === "on" ? " active" : ""}" data-view="${k}">${l}</button>`).join("")}
      </div>
      <div class="lb-onoff"></div>
    </div>`;

  const cardsHost = el.querySelector(".lb-cards-host");
  let clutchPayload = null;
  let currentCat = CATEGORIES[0].key;
  const drawCards = catKey => {
    currentCat = catKey;
    cardsHost.innerHTML = _cardsHTML(payload, catKey, clutchPayload);
  };
  drawCards(currentCat);
  el.querySelectorAll(".lb-cat").forEach(btn => btn.addEventListener("click", () => {
    el.querySelectorAll(".lb-cat").forEach(b => b.classList.toggle("active", b === btn));
    drawCards(btn.dataset.cat);   // de la misma respuesta: sin requests
  }));

  // Los cierres salen de otra tabla: se piden una vez, en segundo plano.
  api.table("team_clutch_lineups", { team: teamCode, ...params, base })
    .then(p => {
      if (token !== _token) return;
      clutchPayload = p;
      if (currentCat === "cierres") drawCards(currentCat);
    })
    .catch(() => {
      if (token !== _token) return;
      clutchPayload = { rows: [], columns: [] };
      if (currentCat === "cierres") drawCards(currentCat);
    });

  const tableHost = el.querySelector(".lb-table");
  const mountLineups = () => mountTable(tableHost,
    () => api.table("team_lineups", { team: teamCode, ...params, size, base }),
    { tableId: "team_lineups" });
  mountLineups();
  el.querySelectorAll(".lb-size").forEach(btn => btn.addEventListener("click", () => {
    el.querySelectorAll(".lb-size").forEach(b => b.classList.toggle("active", b === btn));
    size = Number(btn.dataset.size);
    mountLineups();
  }));

  mountTable(el.querySelector(".lb-clutch"),
    () => api.table("team_clutch_lineups", { team: teamCode, ...params, base }),
    { tableId: "team_clutch_lineups" });

  const onoffHost = el.querySelector(".lb-onoff");
  const mountOnoff = () => mountTable(onoffHost,
    () => api.table("team_onoff", { team: teamCode, ...params, view, base }),
    { tableId: "team_onoff" });
  mountOnoff();
  el.querySelectorAll(".lb-view").forEach(btn => btn.addEventListener("click", () => {
    el.querySelectorAll(".lb-view").forEach(b => b.classList.toggle("active", b === btn));
    view = btn.dataset.view;
    mountOnoff();
  }));
}

export function destroyLineupsBlock() { _token++; }
