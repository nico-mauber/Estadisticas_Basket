// ── Comparar jugadores (F-05) ────────────────────────────────────────────────
// Dos jugadores cualesquiera, de cualquier equipo y competencia. Cada uno se mide contra la
// población de SU propia competencia (el percentil que ya trae `api.metrics("player")`), así que
// comparar entre ligas distintas es válido: el valor absoluto se enfrenta y el percentil dice
// cuánto vale ese número en su contexto.
import { api } from "../api.js";
import { loadCatalog, metricLabel, metricDef } from "../core/catalog.js";
import { fmtMetric, isNull, nullDisplay, DEC1 } from "../core/format.js";
import { percentileBg } from "../core/colors.js";
import { sampleBadge } from "./sample-badge.js";
import { exportMenu } from "./export-menu.js";
import { tableToData } from "./exporters.js";
import { drawComparePlayersRadar } from "../charts.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Ejes del radar: percentil de cada jugador en su propia competencia (0-100, comparable entre ligas).
const RADAR = [
  { key: "pts", label: "Puntos" },
  { key: "ts_pct", label: "Eficiencia" },
  { key: "trb", label: "Rebotes" },
  { key: "ast", label: "Asistencias" },
  { key: "stl", label: "Robos" },
  { key: "uso_pct", label: "Uso" },
];

// Filas de la tabla enfrentada, por bloques.
const TABLE_BLOCKS = [
  { label: "Producción", keys: ["pts", "trb", "ast", "stl", "blk", "tov", "minutes", "games"] },
  { label: "Tiro", keys: ["fgm2", "fga2", "fg2_pct", "fgm3", "fga3", "fg3_pct", "ftm", "fta", "ft_pct", "efg_pct", "ts_pct", "ppt"] },
  { label: "Avanzado", keys: ["oer", "uso_pct", "ast_to", "or_pct", "dr_pct", "to_pct", "plus_minus"] },
];

let _token = 0;      // montaje del panel (descarta renders viejos)
let _runToken = 0;   // comparación en curso (descarta respuestas viejas); contador aparte del montaje
let _players = null;   // catálogo de jugadores para los selectores

async function _allPlayers() {
  if (_players) return _players;
  const list = await api.table("search_players", { base: "partido" });
  const ni = list.columns.findIndex(c => c.key === "_name");
  const ti = list.columns.findIndex(c => c.key === "_team");
  _players = list.rows
    .map(r => ({ id: r.id, name: r.values[ni], team: r.values[ti] }))
    .filter(p => p.id && p.name)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return _players;
}

const _options = (players, sel) => '<option value="">— Jugador —</option>' + players.map(p =>
  `<option value="${esc(p.id)}"${String(p.id) === String(sel) ? " selected" : ""}>${esc(p.name)} (${esc(p.team)})</option>`).join("");

// Valor + percentil de una métrica en el payload de un jugador.
function _cell(payload, key) {
  const m = payload?.metrics?.[key];
  if (!m) return { text: "—", pct: null, value: null };
  return {
    text: isNull(m.value) ? nullDisplay(m.reason) : fmtMetric(key, m.value),
    pct: m.percentile ?? null,
    value: isNull(m.value) ? null : m.value,
  };
}

function _rowHTML(key, A, B) {
  const a = _cell(A, key);
  const b = _cell(B, key);
  const dir = metricDef(key)?.direction;
  // Ganador solo si ambos lados tienen valor y la métrica tiene un sentido definido (C-11 RF-7).
  let clsA = "", clsB = "";
  if (a.value != null && b.value != null && dir && dir !== "neutral" && a.value !== b.value) {
    const aWins = dir === "higher" ? a.value > b.value : a.value < b.value;
    clsA = aWins ? "cmp-win" : "";
    clsB = aWins ? "" : "cmp-win";
  }
  const pctTag = p => (p == null ? "" : `<span class="cmp-pct" style="background:${percentileBg(p)}">p${Math.round(p)}</span>`);
  return `<tr>
    <td class="${clsA}">${a.text} ${pctTag(a.pct)}</td>
    <td class="cmp-key">${esc(metricLabel(key))}</td>
    <td class="${clsB}">${b.text} ${pctTag(b.pct)}</td>
  </tr>`;
}

function _header(payload, fallback) {
  const e = payload?.entity || {};
  const comp = payload?.context?.competition?.label || "";
  return `<div class="cmp-head">
    <div class="cmp-name">${esc(e.name || fallback || "—")}</div>
    <div class="td-muted">${esc(e.team_code || "")}${comp ? ` · ${esc(comp)}` : ""}</div>
    <div>${payload?.sample ? sampleBadge(payload.sample, { compact: true }) : ""}</div>
  </div>`;
}

// `opts`: {base, initial: {a, b}}
export async function renderComparePlayers(el, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const base = opts.base || "partido";
  let idA = opts.initial?.a || null;
  let idB = opts.initial?.b || null;

  el.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando jugadores…</p></div>';
  let players;
  try {
    [players] = await Promise.all([_allPlayers(), loadCatalog()]);
  } catch (e) {
    if (token !== _token) return;
    el.innerHTML = `<div class="card"><p class="empty below-avg">${esc(e.message || "No se pudieron cargar los jugadores.")}</p>
      <button type="button" class="btn btn-ghost btn-sm cmp-retry">Reintentar</button></div>`;
    el.querySelector(".cmp-retry")?.addEventListener("click", () => renderComparePlayers(el, opts));
    return;
  }
  if (token !== _token) return;

  el.innerHTML = `
    <div class="card">
      <div class="card-title">Comparar jugadores</div>
      <div class="compare-controls">
        <select id="cmp-a">${_options(players, idA)}</select>
        <select id="cmp-b">${_options(players, idB)}</select>
        <button class="btn" id="btn-cmp-players">Comparar</button>
      </div>
      <p class="td-muted cmp-note">Cada jugador se compara contra su propia competencia: el valor es absoluto y el percentil dice cuánto vale ese número en su liga.</p>
    </div>
    <div id="cmp-players-result"></div>`;

  const selA = el.querySelector("#cmp-a");
  const selB = el.querySelector("#cmp-b");
  const result = el.querySelector("#cmp-players-result");

  const run = async () => {
    const a = selA.value, b = selB.value;
    if (!a || !b) return toastLike(result, "Elegí dos jugadores.");
    if (a === b) return toastLike(result, "Elegí dos jugadores distintos.");
    _syncUrl(a, b);
    result.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Comparando…</p></div>';
    const req = ++_runToken;
    let A, B;
    try {
      [A, B] = await Promise.all([
        api.metrics("player", { id: a, base }),
        api.metrics("player", { id: b, base }),
      ]);
    } catch (e) {
      if (req !== _runToken) return;
      result.innerHTML = `<div class="card"><p class="empty below-avg">${esc(e.message || "No se pudo comparar")}</p></div>`;
      return;
    }
    if (req !== _runToken) return;

    const nameA = players.find(p => String(p.id) === String(a))?.name;
    const nameB = players.find(p => String(p.id) === String(b))?.name;
    const radarOk = RADAR.some(d => _cell(A, d.key).pct != null || _cell(B, d.key).pct != null);

    result.innerHTML = `
      <div class="card">
        <div class="cmp-heads">${_header(A, nameA)}${_header(B, nameB)}</div>
        ${radarOk
          ? '<div class="radar-wrap"><canvas id="cmp-players-radar"></canvas></div>'
          : '<p class="empty">Sin percentiles para el radar: los jugadores no tienen población de referencia en su competencia.</p>'}
        <p class="td-muted">Radar en percentiles de la propia competencia de cada jugador (0 a 100).</p>
      </div>
      ${TABLE_BLOCKS.map(blk => `<div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">${blk.label}</div>
          <span class="xm-host" data-xm="${blk.label}"></span>
        </div>
        <table class="compare-table cmp-table" data-block="${esc(blk.label)}">
          <thead><tr><th>${esc(nameA || "A")}</th><th></th><th>${esc(nameB || "B")}</th></tr></thead>
          <tbody>${blk.keys.map(k => _rowHTML(k, A, B)).join("")}</tbody>
        </table>
      </div>`).join("")}`;

    if (radarOk) {
      drawComparePlayersRadar("cmp-players-radar",
        RADAR.map(d => _cell(A, d.key).pct),
        RADAR.map(d => _cell(B, d.key).pct),
        RADAR.map(d => d.label), nameA, nameB);
    }

    result.querySelectorAll(".cmp-table").forEach(table => {
      const host = result.querySelector(`[data-xm="${table.dataset.block}"]`);
      if (!host) return;
      exportMenu(host, {
        getData: () => tableToData(table, {
          title: `${nameA} vs ${nameB} — ${table.dataset.block}`,
          entity: { type: "player", id: `${a}-${b}`, name: `${nameA} vs ${nameB}` },
          generated_at: new Date().toISOString(),
          file_name: `comparar_${nameA}_${nameB}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        }),
        getNode: () => table,
      });
    });
  };

  el.querySelector("#btn-cmp-players").addEventListener("click", run);
  if (idA && idB) run();
}

function toastLike(host, msg) {
  host.innerHTML = `<div class="card"><p class="empty">${esc(msg)}</p></div>`;
}

function _syncUrl(a, b) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("cmp_a", a);
    url.searchParams.set("cmp_b", b);
    history.replaceState(history.state, "", url);
  } catch { /* la comparación sigue funcionando sin URL */ }
}

export function comparePlayersFromUrl() {
  try {
    const q = new URL(location.href).searchParams;
    const a = q.get("cmp_a"), b = q.get("cmp_b");
    return a && b ? { a, b } : null;
  } catch { return null; }
}

export function destroyComparePlayers() { _token++; }
