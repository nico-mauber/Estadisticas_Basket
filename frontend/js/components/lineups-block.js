// ── Quintetos y ON/OFF del plantel (F-06) ────────────────────────────────────
// Tres piezas sobre las tablas T-06 `team_lineups` y `team_onoff`:
//   · tarjetas con los 3 mejores quintetos por categoría (Impacto, Tiro, Rebote, Cuidado, Ritmo),
//   · tabla completa de quintetos (o combinaciones de 3/4), ordenable y exportable,
//   · tabla ON/OFF del plantel con selector ON / OFF / Diferencia.
// Las tarjetas y la tabla salen de la MISMA respuesta: cambiar de categoría no vuelve a pedir nada.
import { api } from "../api.js";
import { mountTable } from "./data-table.js";
import { exportMenu } from "./export-menu.js";
import { sampleBadge } from "./sample-badge.js";
import { metricLabel } from "../core/catalog.js";
import { DEC1, DEC2, PCT, isNull, fmtMetric, nullDisplay } from "../core/format.js";

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

// Vista resumida de un quinteto (RF-2): las métricas que pide el cliente, en tres bloques.
const DETAIL_BLOCKS = [
  { label: "Ataque", keys: ["ppp", "ppt", "ppt_2", "ppt_3", "ppt_ft", "fga2", "fgm2", "fga3", "fgm3",
                            "fta", "ftm", "tov", "blk_received", "pf", "fouls_drawn", "orb", "ast"] },
  { label: "Defensa", keys: ["stl", "blk", "or_pct", "dr_pct", "pts_against"] },
  { label: "Avanzado", keys: ["possessions", "plus_minus", "oer", "der", "net_rating", "efg_pct",
                              "ts_pct", "to_pct", "ft_rate", "pace", "minutes", "games"] },
];
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
let _openDetailId = null;   // quinteto abierto en el detalle (sobrevive a un remontaje del bloque)

// `opts`: {params (competencia, últimos N, contexto), base, onBaseChange, teamName, competitionLabel}
let _lastTeam = null;

export async function renderLineupsBlock(el, teamCode, opts = {}) {
  if (!el) return;
  if (_lastTeam !== teamCode) { _openDetailId = null; _lastTeam = teamCode; }
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
    <div class="card lb-cards-card">
      <div class="card-title">Mejores quintetos</div>
      <span class="xm-host lb-cards-export"></span>
      <div class="lb-cats" role="group" aria-label="Categoría">
        ${CATEGORIES.map((c, i) => `<button type="button" class="filter-pill lb-cat${i === 0 ? " active" : ""}" data-cat="${c.key}">${c.label}</button>`).join("")}
      </div>
      <div class="lb-cards-host"></div>
    </div>
    <div class="lb-detail-host" hidden></div>
    <div class="card lb-table-card">
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

  const detailHost = el.querySelector(".lb-detail-host");
  let lastPayload = payload;

  // Muestra el detalle de un quinteto y oculta las tarjetas y la tabla mientras está abierto.
  const openDetail = (p, rowId) => {
    const row = p.rows.find(r => r.id === rowId);
    if (!row) return;
    _openDetailId = rowId;
    detailHost.hidden = false;
    detailHost.innerHTML = _detailHTML(p, row);
    el.classList.add("lb-detail-open");
    detailHost.querySelector(".lb-back").addEventListener("click", () => {
      _openDetailId = null;
      detailHost.hidden = true;
      detailHost.innerHTML = "";
      el.classList.remove("lb-detail-open");
    });
    detailHost.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // Exportación del bloque de tarjetas: una fila por categoría y puesto (RF-19).
  exportMenu(el.querySelector(".lb-cards-export"), {
    getData: () => {
      const rows = [];
      for (const cat of CATEGORIES) {
        const p = cat.source === "clutch" ? clutchPayload : payload;
        if (!p) continue;
        const key = cat.metrics[0];
        const ranked = p.rows.filter(r => r.sample?.ranked && _rankValue(p, r, key) != null);
        ranked.sort((a, b) => {
          const va = _rankValue(p, a, key), vb = _rankValue(p, b, key);
          return cat.lowerIsBetter ? va - vb : vb - va;
        });
        const ni = p.columns.findIndex(c => c.key === "_players");
        ranked.slice(0, TOP).forEach((r, i) => rows.push([
          cat.label, i + 1, r.values[ni], metricLabel(key), _rankValue(p, r, key),
          r.sample?.level || "",
        ]));
      }
      return {
        meta: {
          title: `Mejores quintetos — ${opts.teamName || teamCode}`,
          entity: { type: "team", id: teamCode, name: opts.teamName || teamCode },
          competition: { label: opts.competitionLabel || "" },
          generated_at: new Date().toISOString(),
          file_name: `mejores-quintetos_${teamCode}`.toLowerCase(),
        },
        columns: [
          { key: "cat", label: "Categoría", fmt: "text" }, { key: "pos", label: "Puesto", fmt: "int" },
          { key: "lineup", label: "Quinteto", fmt: "text" }, { key: "metric", label: "Métrica", fmt: "text" },
          { key: "value", label: "Valor", fmt: "dec2" }, { key: "sample", label: "Muestra", fmt: "text" },
        ],
        rows,
      };
    },
    getNode: () => cardsHost,
  });

  cardsHost.addEventListener("click", e => {
    const card = e.target.closest(".lb-card");
    if (card) openDetail(currentCat === "cierres" && clutchPayload ? clutchPayload : payload, card.dataset.lineup);
  });

  el.classList.remove("lb-detail-open");
  if (_openDetailId) openDetail(payload, _openDetailId);

  const tableHost = el.querySelector(".lb-table");
  const mountLineups = () => mountTable(tableHost,
    () => api.table("team_lineups", { team: teamCode, ...params, size, base })
      .then(p => { lastPayload = p; return p; }),
    { tableId: "team_lineups", onRowClick: row => openDetail(lastPayload, row.id) });
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

// Detalle de un quinteto: se abre al tocar una fila o una tarjeta y se cierra con "Volver".
function _detailHTML(payload, row) {
  const idx = k => payload.columns.findIndex(c => c.key === k);
  const names = String(row.values[idx("_players")] || "").split(" · ");
  const cell = k => {
    const i = idx(k);
    if (i < 0) return "";
    const v = row.values[i];
    const reason = row.reasons?.[k];
    const adj = row.adj && row.adj[k];
    const shown = isNull(v) ? nullDisplay(reason) : fmtMetric(k, v);
    return `<div class="stat-box"><div class="stat-label">${esc(metricLabel(k))}</div>
      <div class="stat-value neutral">${shown}${adj && adj.value != null
        ? ` <span class="lb-adj">aj. ${DEC2(adj.value)}${adj.band != null ? ` ± ${DEC2(adj.band)}` : ""}</span>` : ""}</div></div>`;
  };
  return `<div class="card lb-detail">
    <div class="map-header">
      <div class="card-title" style="margin:0">Quinteto <span class="lb-detail-names">${names.map(esc).join(" · ")}</span></div>
      <button type="button" class="btn btn-ghost btn-sm lb-back">← Volver</button>
    </div>
    <div class="lb-detail-badge">${sampleBadge(row.sample)}</div>
    ${DETAIL_BLOCKS.map(b => `<div class="lb-detail-block">
      <div class="card-title">${b.label}</div>
      <div class="stat-grid">${b.keys.map(cell).join("")}</div>
    </div>`).join("")}
  </div>`;
}

export function destroyLineupsBlock() { _token++; }
