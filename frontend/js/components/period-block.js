// ── Estadísticas por tramo (F-04) ────────────────────────────────────────────
// Una sola llamada trae los 8 tramos (1.º–4.º cuarto, mitades, prórroga, últimos 5 min); cambiar de tramo
// repinta solo el resumen y el panel, sin pedir nada al servidor. Respeta el contexto de T-03 (el filtro
// de cuarto de la barra se ignora: manda el tramo). El tramo elegido va en `?window=` de la URL.
import { api } from "../api.js";
import { renderStandardPanel } from "./standard-panel.js";
import { exportMenu } from "./export-menu.js";
import { tableToData } from "./exporters.js";
import { fmtNumber, DEC1, DEC2, isNull } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const signed = v => (isNull(v) ? "—" : `${v > 0 ? "+" : ""}${fmtNumber(v, 0)}`);

let _token = 0;   // descarta respuestas viejas al cambiar de equipo, contexto o base

function _windowFromUrl() {
  try { return new URL(location.href).searchParams.get("window"); } catch { return null; }
}
function _setWindowUrl(w) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("window", w);
    history.replaceState(history.state, "", url);
  } catch { /* la URL no se pudo actualizar */ }
}

function _summaryHTML(w) {
  const s = w.summary;
  if (!s) return "";
  const cls = s.point_diff > 0 ? "above-avg" : s.point_diff < 0 ? "below-avg" : "";
  return `<div class="pb-summary">
    <span><em>Dif</em> <strong class="${cls}">${signed(s.point_diff)}</strong></span>
    <span><em>Pts a favor</em> <strong>${fmtNumber(s.pts, 0)}</strong></span>
    <span><em>Pts en contra</em> <strong>${fmtNumber(s.pts_against, 0)}</strong></span>
    <span><em>Récord del tramo</em> <strong>${esc(s.record)}</strong></span>
    <span><em>Partidos con el tramo</em> <strong>${s.games_with_window}</strong></span>
  </div>`;
}

function _gamesTableHTML(w) {
  const venue = v => (v === "L" ? "Local" : v === "V" ? "Visitante" : "—");
  return `<div class="dt-table-wrap"><table class="pb-games search-table">
    <thead><tr><th>Fecha</th><th>Rival</th><th>Sede</th><th>Pts</th><th>Rival pts</th><th>Dif</th><th>Min</th></tr></thead>
    <tbody>${w.games.map(g => `<tr>
      <td>${esc(g.date || "—")}</td><td>${esc(g.opponent_code)}</td><td>${venue(g.home_away)}</td>
      <td>${g.pts}</td><td>${g.opp_pts}</td><td>${signed(g.point_diff)}</td><td>${DEC1(g.minutes)}</td></tr>`).join("")}</tbody>
  </table></div>`;
}

// `opts`: {params (competition, last, contexto), base, onBaseChange, teamName, competitionLabel}
export async function renderPeriodBlock(el, teamCode, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const { params = {}, base = "partido", onBaseChange } = opts;
  el.innerHTML = `<div class="card"><div class="card-title">Por tramo del partido</div>
    <p class="empty"><span class="spinner"></span>Calculando tramos…</p></div>`;

  let data;
  try {
    data = await api.periods(teamCode, { ...params, base });
  } catch (e) {
    if (token !== _token) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const msg = offline ? "Sin conexión: no se pueden cargar los tramos." : (e.message || "No se pudieron cargar los tramos.");
    el.innerHTML = `<div class="card"><div class="card-title">Por tramo del partido</div>
      <p class="empty below-avg">${esc(msg)}</p><button type="button" class="btn btn-ghost btn-sm pb-retry">Reintentar</button></div>`;
    el.querySelector(".pb-retry")?.addEventListener("click", () => renderPeriodBlock(el, teamCode, opts));
    return;
  }
  if (token !== _token) return;

  const wins = data.windows;
  const any = wins.some(w => !w.empty);
  if (!any) {
    el.innerHTML = `<div class="card"><div class="card-title">Por tramo del partido</div>
      <p class="empty">${data.context?.games_excluded?.sin_pbp
        ? "Este equipo no tiene play-by-play importado. Reimportá sus partidos."
        : "No hay partidos con play-by-play que cumplan estos filtros."}</p></div>`;
    return;
  }

  const wanted = _windowFromUrl();
  let current = wins.find(w => w.window === wanted && !w.empty)?.window || wins.find(w => !w.empty).window;

  el.innerHTML = `<div class="card pb-card">
    <div class="card-title">Por tramo del partido</div>
    <div class="pb-chips" role="group" aria-label="Tramo">
      ${wins.map(w => `<button type="button" class="filter-pill pb-chip" data-w="${w.window}"${w.empty ? ` disabled title="${w.window === "pr" ? "Ningún partido de la selección tuvo prórroga." : "Sin partidos con play-by-play en este tramo."}"` : ""}>${esc(w.label)}</button>`).join("")}
    </div>
    <div class="pb-summary-host"></div>
    <div class="pb-panel"></div>
    <details class="pb-games-wrap"><summary>Ver partido a partido</summary>
      <div class="pb-export"></div><div class="pb-games-host"></div></details>
  </div>`;

  const chips = el.querySelectorAll(".pb-chip");
  const summaryHost = el.querySelector(".pb-summary-host");
  const panelHost = el.querySelector(".pb-panel");
  const gamesHost = el.querySelector(".pb-games-host");
  let xm = null;

  const select = w => {
    current = w;
    _setWindowUrl(w);
    const win = wins.find(x => x.window === w);
    chips.forEach(c => c.classList.toggle("active", c.dataset.w === w));
    summaryHost.innerHTML = _summaryHTML(win);
    renderStandardPanel(panelHost, win.standard, { layout: "grid", base, onBaseChange });
    gamesHost.innerHTML = win.games.length ? _gamesTableHTML(win) : '<p class="empty">Sin partidos con este tramo.</p>';
    xm?.destroy();
    const table = gamesHost.querySelector("table");
    if (table) {
      const c = data.context || {};
      xm = exportMenu(el.querySelector(".pb-export"), {
        getData: () => tableToData(table, {
          title: `${opts.teamName || teamCode} — ${win.label}`,
          entity: { type: "team", id: teamCode, name: opts.teamName || teamCode },
          competition: { label: opts.competitionLabel || c.competition?.label || "" },
          filters: [{ label: "Tramo", value: win.label }, ...(c.label ? [{ label: "Contexto", value: c.label }] : [])],
          generated_at: new Date().toISOString(),
          file_name: `momentos-${w}_${teamCode}`.toLowerCase(),
        }),
        getNode: () => table.closest(".dt-table-wrap"),
      });
    }
  };

  chips.forEach(c => c.addEventListener("click", () => { if (!c.disabled) select(c.dataset.w); }));
  select(current);
}

export function destroyPeriodBlock() { _token++; }
