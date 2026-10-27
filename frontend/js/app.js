import { api, setUnauthorizedHandler } from "./api.js";
import { drawRadar, drawEvolution, drawPlayerEvolution, drawLeagueScatter, drawCompareRadar, resetZoom } from "./charts.js";
import { PCT, PCT0, DEC1, DEC2, fmtNumber, isNull, nullDisplay, fmtOrNull, cmpNullsLast } from "./core/format.js";
import { renderDuplicateItems } from "./components/identity-merge.js";
import { renderSettingsForm } from "./components/settings-form.js";
import { renderStandardPanel } from "./components/standard-panel.js";
import { metricCard, bindMetricCards } from "./components/metric-card.js";
import { loadCatalog, stdKeyFor, loadPopulationMinSize } from "./core/catalog.js";
import { percentileBg } from "./core/colors.js";
import { createDataTable, mountTable } from "./components/data-table.js";
import { exportMenu } from "./components/export-menu.js";
import { tableToData, downloadBlob } from "./components/exporters.js";
import { shotChart, bindZoneTooltips } from "./components/shot-chart.js";
import { renderGameView } from "./components/game-view.js";
import { renderLiveView, destroyLiveView } from "./components/live-view.js";
import { renderPrepare } from "./components/prepare-report.js";
import { initBase, getBase, setBase } from "./core/base.js";
import { initContext, contextParams, clearContext, clearPlayerFilters, dropInvalid, activeCount } from "./core/context.js";
import { mountContextBar, contextNote, invalidateContextOptions } from "./components/context-bar.js";
import { renderPeriodBlock, destroyPeriodBlock } from "./components/period-block.js";
import { renderOriginPanel } from "./components/origin-panel.js";
import { renderTransitionPanel } from "./components/transition-panel.js";
import { renderSecondChancePanel } from "./components/second-chance-panel.js";
import { renderClockPanel } from "./components/clock-panel.js";
import { renderLineupsBlock } from "./components/lineups-block.js";
import { renderComparePlayers, comparePlayersFromUrl } from "./components/compare-players.js";
import { renderPlayerHeader } from "./components/player-header.js";

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Stat helpers ───────────────────────────────────────────────────────────
// PCT/DEC1/DEC2 y la regla de nulos viven en core/format.js (C-11).

// Comparador null-safe `cmpNullsLast` vive ahora en core/format.js (T-06 T-D1).

// `reason`: código de `null_reasons` del backend; si `value` es nulo se muestra "—" con
// esa razón en el title, sea cual sea `display` (C-11 RF-4). El bloque "Ø liga" se retiró
// con T-01: Equipo y Jugador usan la ficha de métrica (metricCard); los pocos usos
// restantes (detalle de tiro, AS/PER) muestran solo el valor.
function statBox(label, value, display, reason = null) {
  return `
    <div class="stat-box">
      <div class="stat-label">${label}</div>
      <div class="stat-value neutral">${isNull(value) ? nullDisplay(reason) : display}</div>
    </div>`;
}

// ── Ficha de métrica en grillas de Equipo/Jugador (T-01) ─────────────────────
// `metrics`: [[label, claveLegada|canónica, valorPromedio, displayRespaldo, reason?]].
// Con `std` (respuesta de /api/metrics) se dibuja la ficha completa (metricCard);
// sin `std` (o si la métrica no está en el conjunto estándar) se muestra solo el valor.
function _fichaGridHTML(metrics, entityType, std, entityId) {
  return metrics.map(([label, clave, value, display, reason]) => {
    const stdKey = stdKeyFor(clave) || clave;
    const mObj = std?.metrics?.[stdKey];
    if (std && mObj) {
      return metricCard(stdKey, mObj, { entityType, label, id: entityId, minSize: std.population?.min_size });
    }
    return statBox(label, value, display, reason);
  }).join("");
}

// Nota al pie de "Creación de juego": cuántas asistencias tienen vínculo y qué pasa con los libres.
function _creationNote(std) {
  const pts = std?.metrics?.ast_points;
  if (!pts) return "";
  if (pts.value == null && pts.reason === "no_registrado") {
    return '<p class="td-muted assist-note">Los partidos de esta selección se importaron sin el vínculo de las asistencias. Reprocesalos para ver los puntos generados.</p>';
  }
  if (pts.value == null && pts.reason === "sin_pbp") {
    return '<p class="td-muted assist-note">Sin play-by-play: no se puede saber qué tiro convirtió cada asistencia.</p>';
  }
  return '<p class="td-muted assist-note">Los puntos generados cuentan solo las asistencias a tiros de campo: en un tiro libre no se sabe cuántos de la serie entraron.</p>';
}

// Etiqueta con su definición al pasar el cursor / tocar (C-01): `statBox` inserta el label como HTML.
const _hint = (label, text) => `<span title="${esc(text)}">${label}</span>`;
const _PCT_REB_HINT = "estimado por minutos mientras estuvo en cancha. No es comparable con el %s de equipo.";

// Totales que respaldan un cociente: " (43/29)" bajo el valor (C-04). Vacío si falta alguno.
const _ratioSub = (a, b) => a == null || b == null ? ""
  : `<span style="font-size:9px;color:var(--muted)"> (${a}/${b})</span>`;

// Caja de AS/PER (asistencias sobre pérdidas acumuladas de la selección). PER = pérdidas.
function _astPerBox(av, totals) {
  const label = '<span title="Asistencias sobre pérdidas, acumulado de la selección (PER = pérdidas)">AS/PER</span>';
  return statBox(label, av.ast_to, DEC2(av.ast_to) + _ratioSub(totals?.ast, totals?.tov),
                 av.null_reasons?.ast_to);
}

// ── Filtro por competencia (compartido: Liga/Equipo/Comparar/Jugador) ────────
// Por id de competencia (F-11): el texto de FIBA puede renombrarse o fusionarse. `comps` = [{id, label}]
// (de /api/competitions o del campo `competitions` del perfil). El navegador NO recalcula promedios al
// filtrar: pide el perfil al servidor con `competition`/`last` (C-02 RF-5, Constitución regla 4).
// `allValue`: valor de la opción "Todas las competencias": "all" en las vistas con promedio de liga (el
// servidor no calcula `Ø` sin una competencia, RF-7); "" en el catálogo de Datos y en Buscar.
function _compOptions(comps, selected = "", allLabel = "Todas las competencias", allValue = "") {
  return `<option value="${allValue}"${String(selected) === allValue ? " selected" : ""}>${allLabel}</option>` +
    comps.map(c => `<option value="${c.id}"${String(c.id) === String(selected) ? " selected" : ""}>${esc(c.label)}</option>`).join("");
}

// Aviso bajo los selectores: de qué población sale el `Ø` y, si la selección no tiene partidos, un
// estado vacío (C-02 RF-13). `kind`: [singular, plural] de la entidad de la población.
function _refLegend(data, kind) {
  const c = data.context, m = data.league_meta;
  return c.competition.id == null
    ? "Ø no disponible: elegí una competencia para ver el promedio de liga."
    : `Ø = promedio de ${m.size} ${m.size === 1 ? kind[0] : kind[1]} de ${esc(c.competition.label)}.`;
}
function _selectionNote(data, kind) {
  const filtered = activeCount() > 0;
  const empty = data.games === 0
    ? (filtered
      ? '<p class="empty">No hay partidos que cumplan estos filtros. <button type="button" class="btn btn-ghost btn-sm ctx-empty-clear">Limpiar filtros</button></p>'
      : '<p class="empty">Sin partidos en esta competencia</p>')
    : "";
  return `<div class="ctx-bar-host"></div>${contextNote(data.context)}<p class="td-muted" style="margin:0 0 8px">${_refLegend(data, kind)}</p>${empty}`;
}

// Monta la barra de contexto (T-03) y el botón de la selección vacía dentro de `main`; `reload` recarga la vista.
function _mountCtxBar(main, competition, reload, teamCode = null) {
  mountContextBar(main.querySelector(".ctx-bar-host"), { competition, teamCode, onChange: reload });
  main.querySelector(".ctx-empty-clear")?.addEventListener("click", () => { clearContext(); reload(); });
}

// Radar sin promedio de liga (`Ø` nulo): no hay contra qué escalar.
const _radarMsg = data => data.context.competition.id == null
  ? "El radar compara contra el promedio de una competencia: elegí una."
  : "Sin datos de la competencia para armar el radar.";

// Escapa texto para insertarlo en HTML (nombres editables por el usuario, p. ej. competencias).
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── Exportación de tablas no migradas (T-D10) ────────────────────────────────
// Lee el <table> ya renderizado con tableToData y monta el menú de exportación.
// `meta` mínima: título, entidad, competencia del filtro activo, fecha.
function _baseMeta({ title, section, entity, competitionLabel, entitySlug }) {
  const slug = s => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const today = new Date().toISOString().slice(0, 10);
  const compLabel = competitionLabel || "todas";
  const ent = entitySlug || (entity ? slug(entity) : "liga");
  return {
    title,
    section: section || slug(title),
    entity: { type: "team", id: "", name: entity || "" },
    competition: { id: null, label: competitionLabel || "", season: "" },
    filters: [],
    base: null,
    sort: null,
    columns_visible: null,
    generated_at: new Date().toISOString(),
    generated_by: _authUser || "_open",
    app_version: "smart-basket-v23",
    file_name: `${slug(section || title)}_${ent}_${slug(compLabel)}_${today}`,
  };
}

// Exportación de un panel estándar (ON/OFF compare, combinación grid): no hay un único
// <table>. Serializa la primera tabla con encabezado si existe, o las parejas de stat-box.
function _mountPanelExport(hostEl, panelFn, meta) {
  if (!hostEl) return;
  exportMenu(hostEl, {
    getData: () => {
      const panel = typeof panelFn === "function" ? panelFn() : panelFn;
      if (panel) {
        const tables = [...panel.querySelectorAll("table")];
        if (tables.length) {
          // ON/OFF: una tabla por grupo con el mismo encabezado; se unifican las filas.
          const first = tableToData(tables[0], meta);
          const rows = [];
          for (const t of tables) rows.push(...tableToData(t, meta).rows);
          return { meta, columns: first.columns, rows, footer: [], pageInfo: `${rows.length} filas` };
        }
        const boxes = [...panel.querySelectorAll(".stat-box")];
        if (boxes.length) {
          const columns = [{ key: "metrica", label: "Métrica", fmt: "text" }, { key: "valor", label: "Valor", fmt: "text" }];
          const rows = boxes.map(b => [b.querySelector(".stat-label")?.textContent.trim() || "", b.querySelector(".stat-value, .mc-value")?.textContent.trim() || ""]);
          return { meta, columns, rows, footer: [], pageInfo: `${rows.length} filas` };
        }
      }
      return { meta, columns: [], rows: [], footer: [], pageInfo: "Sin filas" };
    },
    getNode: () => (typeof panelFn === "function" ? panelFn() : panelFn) || hostEl,
  });
}

// Monta un botón "Exportar" en `hostEl` que serializa el <table> dentro de `tableElOrFn`.
function _mountTableExport(hostEl, tableElOrFn, meta) {
  if (!hostEl) return;
  exportMenu(hostEl, {
    getData: () => {
      const tableEl = typeof tableElOrFn === "function" ? tableElOrFn() : tableElOrFn;
      const d = tableEl ? tableToData(tableEl, meta) : { meta, columns: [], rows: [], footer: [] };
      return { ...d, meta, pageInfo: `${d.rows.length} fila${d.rows.length === 1 ? "" : "s"}` };
    },
    getNode: () => {
      const tableEl = typeof tableElOrFn === "function" ? tableElOrFn() : tableElOrFn;
      return tableEl ? (tableEl.closest(".table-wrap") || tableEl) : hostEl;
    },
  });
}

// ── Four Factors card ──────────────────────────────────────────────────────
function _fourFactorsCard(av, teamName) {
  const factors = [
    { label: "eFG%",    team: av.efg_pct,     opp: av.opp_efg_pct, fmt: PCT, hib: true,  title: "Eficiencia de tiro ajustada" },
    { label: "TO%",     team: av.to_pct,      opp: av.opp_to_pct,  fmt: PCT, hib: false, title: "Cuidado del balón" },
    // RebOf% rival = 1 − DR% propio; con DR% nulo el resultado es nulo, no 100% (C-11 RF-6)
    { label: "RebOf%",  team: av.or_pct,      opp: av.dr_pct == null ? null : 1 - av.dr_pct, fmt: PCT, hib: true, title: "Segundas oportunidades" },
    { label: "FT Rate", team: av.ft_rate,     opp: av.opp_ft_rate, fmt: DEC2, hib: true,  title: "Agresividad hacia el aro (FTA/FGA)" },
  ];

  const rows = factors.map(f => {
    const tWins = f.team != null && f.opp != null && (f.hib ? f.team > f.opp : f.team < f.opp);
    const oWins = f.team != null && f.opp != null && (f.hib ? f.opp > f.team : f.opp < f.team);
    return `
      <tr title="${f.title}">
        <td class="td-muted" style="font-weight:600;min-width:72px">${f.label}</td>
        <td class="${tWins ? 'above-avg' : oWins ? 'below-avg' : ''}" style="text-align:right;font-weight:700">${f.fmt(f.team)}</td>
        <td style="text-align:center;color:var(--border2);padding:0 6px">vs</td>
        <td class="${oWins ? 'above-avg' : tWins ? 'below-avg' : ''}" style="text-align:left;font-weight:700">${f.fmt(f.opp)}</td>
      </tr>`;
  }).join("");

  return `
    <div class="card">
      <div class="map-header">
        <div class="card-title" style="margin:0">Four Factors <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${teamName} vs Rival</span></div>
        <span class="xm-host" data-xm="four-factors"></span>
      </div>
      <div class="table-wrap">
        <table id="four-factors-table" style="font-size:13px">
          <thead><tr>
            <th>Factor</th>
            <th style="text-align:right;color:var(--accent)">${teamName}</th>
            <th></th>
            <th style="text-align:left;color:var(--muted)">Rival Ø</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Record badge ────────────────────────────────────────────────────────────
function _recordCard(record, teamName) {
  if (!record) return "";
  const pct = PCT0(record.win_pct);
  return `
    <div class="card" style="display:flex;align-items:center;gap:var(--sp-5);flex-wrap:wrap">
      <div>
        <div class="stat-label">Récord</div>
        <div style="font-size:28px;font-weight:800;line-height:1.1">
          <span class="above-avg">${record.wins}</span>
          <span style="color:var(--border2);margin:0 4px">-</span>
          <span class="below-avg">${record.losses}</span>
        </div>
      </div>
      <div class="stat-box" style="flex:1;min-width:80px">
        <div class="stat-label">% Victorias</div>
        <div class="stat-value">${pct}</div>
      </div>
      <div class="stat-box" style="flex:1;min-width:80px">
        <div class="stat-label">Local</div>
        <div class="stat-value">${record.home}</div>
      </div>
      <div class="stat-box" style="flex:1;min-width:80px">
        <div class="stat-label">Visitante</div>
        <div class="stat-value">${record.away}</div>
      </div>
    </div>`;
}

// ── Team selector (module-level so renderImport can call it) ───────────────
async function refreshTeamSelector() {
  const teamSel = document.getElementById("team-select");
  if (!teamSel) return;
  const current = teamSel.value;
  const teams = await api.teams().catch(() => []);
  teamSel.innerHTML = '<option value="">— Seleccionar equipo —</option>' +
    teams.map(t => `<option value="${t.code}">${t.name} (${t.games}p)</option>`).join("");
  if (current) teamSel.value = current;
}

async function refreshCompareSelectors() {
  const teams = await api.teams().catch(() => []);
  const opts = '<option value="">— Equipo —</option>' +
    teams.map(t => `<option value="${t.code}">${t.name}</option>`).join("");
  ["compare-a", "compare-b"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  // Selector de competencia (solo si hay >1 competencia en la base)
  const compSel = document.getElementById("compare-comp");
  if (compSel) {
    const comps = await api.competitions().catch(() => []);
    compSel.style.display = comps.length > 1 ? "" : "none";
    // por defecto, la competencia por defecto (C-02 RF-6); "Todas" solo si el usuario la eligió
    const defaultId = comps.find(c => c.is_default)?.id ?? "";
    const keep = comps.length > 1 ? compSel.value : "";
    compSel.innerHTML = _compOptions(comps, keep || defaultId, "Todas las competencias", "all");
  }
}

// ── Nav ────────────────────────────────────────────────────────────────────
const sections = ["import", "league", "team", "compare", "player", "search", "preparar", "partido", "config"];
let activeSection = "import";
let _lastSection = "import";

function setSection(id) {
  if (activeSection !== "config") _lastSection = activeSection;
  if (id !== "partido") destroyLiveView();
  activeSection = id;
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.section === id));
  document.querySelectorAll(".section").forEach(s => s.style.display = s.id === `sec-${id}` ? "" : "none");
}

// ── Import section ─────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
let importPage    = 0;
let selectMode    = false;
let selectedGames = new Set();
let _seedEnabled  = false;  // dev-only seed button (set from /api/me at boot)
let _authRequired = false;  // whether the backend requires login
let _authUser     = null;   // logged-in username (when auth required)
let _isAdmin      = false;  // puede modificar datos (F-11, /api/me → is_admin)
let _importTab    = "importar";   // importar · calidad · competencias (F-11)
let _catalogComp  = "";     // filtro del catálogo por competencia
let _qualityComp  = "";     // competencia elegida en Calidad de datos

function _fmtDate(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

// Estado de datos de un partido en el catálogo (F-11)
function _dataBadges(g) {
  const b = [];
  if (g.competition_status === "borrador") b.push('<span class="badge badge-muted">Borrador</span>');
  if (!g.has_pbp) b.push('<span class="badge badge-warn">Sin PBP</span>');
  else if (!g.has_coords) b.push('<span class="badge badge-muted">Sin coordenadas</span>');
  if (g.needs_reprocess) b.push('<span class="badge badge-warn">Reprocesar</span>');
  return b.join(" ") || '<span class="badge badge-ok">OK</span>';
}

function _gamesTable(games, page, emptyMsg = "Sin partidos aún.") {
  if (!games.length) return `<p class="empty">${emptyMsg}</p>`;
  const totalPages = Math.ceil(games.length / PAGE_SIZE);
  const slice = games.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const pagination = totalPages > 1 ? `
    <div class="pagination">
      <button class="btn btn-ghost btn-sm" id="pg-prev" ${page === 0 ? "disabled" : ""}>← Ant.</button>
      <span class="pagination-label">Página ${page + 1} / ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" id="pg-next" ${page >= totalPages - 1 ? "disabled" : ""}>Sig. →</button>
    </div>` : "";

  const cbHeader = selectMode ? "<th></th>" : "";
  const rows = slice.map(g => {
    const id      = g.game_id || "";
    const checked = selectedGames.has(id) ? "checked" : "";
    const selCls  = selectedGames.has(id) ? " selected-row" : "";
    const cbCell  = selectMode
      ? `<td><input type="checkbox" class="row-cb" data-id="${id}" ${checked}></td>`
      : "";
    return `<tr data-game-id="${id}" class="${selCls}">
      ${cbCell}
      <td class="td-muted">${_fmtDate(g.date)}</td>
      <td class="td-team">${g.home_team || "—"}</td>
      <td class="td-result">${g.home_score ?? "—"} – ${g.away_score ?? "—"}</td>
      <td class="td-team">${g.away_team || "—"}</td>
      <td class="td-comp">${esc(g.competition_label || g.competition || "—")}</td>
      <td>${_dataBadges(g)}</td>
    </tr>`;
  }).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${cbHeader}<th>Fecha</th><th>Local</th><th>Result.</th><th>Visitante</th><th>Competencia</th><th>Estado</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pagination}`;
}

// ── Exportación masiva (T-D11) ────────────────────────────────────────────────
async function _wireBulkExport(el, comps) {
  const scopeSel = el.querySelector("#bulk-scope");
  const compSel  = el.querySelector("#bulk-comp");
  const teamSel  = el.querySelector("#bulk-team");
  const teamField = el.querySelector("#bulk-team-field");
  const btn = el.querySelector("#btn-bulk-export");
  const status = el.querySelector("#bulk-status");
  if (!scopeSel || !compSel || !btn) return;

  // Competencias concretas (sin "Todas": la masiva requiere una competencia, plan §3.3).
  const realComps = (comps || []).filter(c => c.status !== "borrador");
  compSel.innerHTML = realComps.map(c => `<option value="${c.id}">${esc(c.label || c.name)}</option>`).join("");
  if (!realComps.length) { btn.disabled = true; status.textContent = "No hay competencias para exportar."; return; }

  const teams = await api.teams().catch(() => []);
  teamSel.innerHTML = teams.map(t => `<option value="${esc(t.code)}">${esc(t.name || t.code)} (${t.code})</option>`).join("");

  const syncScope = () => { teamField.style.display = scopeSel.value === "team" ? "" : "none"; };
  scopeSel.addEventListener("change", syncScope);
  syncScope();

  btn.addEventListener("click", async () => {
    const scope = scopeSel.value;
    const competition = compSel.value;
    const team = scope === "team" ? teamSel.value : null;
    if (!competition) { status.textContent = "Elegí una competencia."; return; }
    if (scope === "team" && !team) { status.textContent = "Elegí un equipo."; return; }
    if (navigator.onLine === false) { status.textContent = "Sin conexión: la exportación masiva requiere conexión."; return; }

    btn.disabled = true;
    const prev = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>Preparando…';
    status.textContent = "Preparando exportación… puede tardar hasta un minuto.";
    try {
      const { blob, fileName } = await api.exportBulk({ scope, team, competition });
      downloadBlob(blob, fileName || "exportacion.xlsx");
      status.textContent = `Archivo generado: ${fileName || "exportacion.xlsx"}`;
      toast(`Archivo generado: ${fileName || "exportacion.xlsx"}`);
    } catch (e) {
      if (navigator.onLine === false || e instanceof TypeError) status.textContent = "Sin conexión: la exportación masiva requiere conexión.";
      else if (e.status === 404) status.textContent = "No hay datos para exportar en esta selección.";
      else status.textContent = e.message || "No se pudo exportar.";
      toast(status.textContent, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
}

// Tras un cambio de datos (importar, borrar, reprocesar, editar competencias) los
// selectores y el buscador cacheado quedan viejos.
function _afterDataChange() {
  _searchPayload = null;
  refreshTeamSelector();
  refreshCompareSelectors();
}

// El borrado se autoriza con la sesión (admin, F-11); no pide token (C-11 RF-14).
function _showDeleteModal(count, ids) {
  _formModal({
    title: `Eliminar partido${count > 1 ? "s" : ""}`,
    text: `¿Eliminar ${count} partido${count > 1 ? "s" : ""}? Se eliminará toda la información asociada (estadísticas, jugadores, tiros). Esta acción no se puede deshacer.`,
    confirm: "Eliminar", danger: true,
    onSubmit: async () => {
      await api.deleteGames(ids);
      toast(`${count} partido${count > 1 ? "s" : ""} eliminado${count > 1 ? "s" : ""}`);
      selectMode = false;
      selectedGames.clear();
      importPage = 0;
      renderImport();
      _afterDataChange();
    },
  });
}

// Modal con formulario. `fields`: [{name, label, type: "text"|"select", value, options:[{value,label}]}].
// Si `onSubmit(values)` lanza, se muestra el error y el modal queda abierto.
function _formModal({ title, text = "", fields = [], confirm = "Guardar", danger = false, onSubmit }) {
  const field = f => f.type === "select"
    ? `<label class="modal-field">${f.label}<select name="${f.name}">${f.options.map(o =>
        `<option value="${o.value}"${String(o.value) === String(f.value ?? "") ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>`
    : `<label class="modal-field">${f.label}<input name="${f.name}" type="text" value="${esc(f.value)}" placeholder="${esc(f.placeholder)}"></label>`;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal">
      <h3>${title}</h3>
      ${text ? `<p>${text}</p>` : ""}
      ${fields.map(field).join("")}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-sm${danger ? " btn-danger" : ""}">${confirm}</button>
      </div>
    </form>`;
  document.body.appendChild(backdrop);
  const form = backdrop.querySelector("form");
  backdrop.addEventListener("click", e => {
    if (e.target === backdrop || e.target.hasAttribute("data-cancel")) backdrop.remove();
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      backdrop.remove();
    } catch (err) {
      toast(err.message, "err");
      btn.disabled = false;
    }
  });
  form.querySelector("input, select")?.focus();
}

// Reproceso por lotes (F-11): el backend procesa un lote por petición y el cliente encadena
// con `next_offset`. `onProgress(hechos, total)` actualiza la UI.
async function _runReprocess(target, onProgress) {
  const body = target.competitionId != null ? { competition_id: target.competitionId } : { game_ids: target.gameIds };
  let processed = 0, failed = [], total = target.gameIds ? target.gameIds.length : 0;
  try {
    let offset = 0;
    while (offset != null) {
      const r = await api.reprocess({ ...body, offset });
      invalidateContextOptions();
      processed += r.processed.length; failed = failed.concat(r.failed); total = r.total;
      offset = r.next_offset;
      onProgress?.(processed + failed.length, total);
    }
    toast(`Reprocesados ${processed} partidos (${failed.length} con error).`, failed.length ? "err" : "ok");
    failed.slice(0, 3).forEach(f => toast(`No se pudo reprocesar ${f.game_id}: ${f.error}`, "err"));
  } catch (e) {
    toast(`El reproceso se detuvo en ${processed + failed.length} de ${total}: ${e.message}`, "err");
  }
  _afterDataChange();
}

const IMPORT_TABS = [["importar", "Importar"], ["calidad", "Calidad de datos"], ["competencias", "Competencias"]];

// Sección Datos (F-11): pestañas Importar · Calidad de datos · Competencias.
function renderImport() {
  const sec = document.getElementById("sec-import");
  sec.innerHTML = `
    <div class="filter-pills import-tabs">
      ${IMPORT_TABS.map(([id, lbl]) =>
        `<button class="filter-pill${id === _importTab ? " active" : ""}" data-tab="${id}">${lbl}</button>`).join("")}
    </div>
    <div id="import-tab"></div>`;
  sec.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
    _importTab = b.dataset.tab;
    renderImport();
  }));
  const el = document.getElementById("import-tab");
  if (_importTab === "calidad") return _renderQualityTab(el);
  if (_importTab === "competencias") return _renderCompetitionsTab(el);
  return _renderImportTab(el);
}

const _compLabel = c => c.status === "borrador" ? `${c.label} (borrador)` : c.label;

async function _renderImportTab(el) {
  const comps = await api.competitions(true).catch(() => []);
  if (!comps.some(c => String(c.id) === String(_catalogComp))) _catalogComp = "";
  const games = await api.games(_catalogComp).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  const hasSel = selectMode && selectedGames.size > 0;

  el.innerHTML = `
    <div class="card">
      <div class="card-title">Importar partido desde FIBA LiveStats</div>
      <div class="import-panel">
        <input id="url-input" type="text" placeholder="https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2741550/bs.html" />
        <button class="btn" id="btn-import">Importar</button>
        <button class="btn btn-ghost" id="btn-live">Seguir en vivo</button>
      </div>
      <p class="import-hint">El sistema captura los datos automáticamente desde la URL de FIBA LiveStats. "Seguir en vivo" muestra un partido en curso y lo guarda solo al terminar.</p>
      ${_seedEnabled ? `
      <div class="seed-panel">
        <button class="btn btn-seed" id="btn-seed">⚡ Agregar partidos (dev)</button>
        <span class="seed-hint">Importa el set fijo de partidos de prueba (solo entorno dev).</span>
      </div>` : ""}
    </div>
    <div class="card">
      <div class="games-header">
        <div class="card-title" style="margin:0">Partidos importados (${games ? games.length : 0})</div>
        <div class="games-header-actions">
          ${comps.length > 1 ? `<select id="catalog-comp" class="map-select">${_compOptions(
            comps.map(c => ({ id: c.id, label: _compLabel(c) })), _catalogComp)}</select>` : ""}
          ${games && games.length ? '<span class="xm-host" data-xm="games"></span>' : ""}
          ${_isAdmin ? `<button class="btn btn-ghost btn-sm" id="btn-select-mode">${selectMode ? "Cancelar" : "Seleccionar partidos"}</button>` : ""}
        </div>
      </div>
      ${_isAdmin && selectMode ? `
      <div class="games-header-actions sel-actions" id="sel-actions" style="${hasSel ? "" : "display:none"}">
        ${comps.length > 1 ? '<button class="btn btn-ghost btn-sm" id="btn-move-sel">Mover a competencia…</button>' : ""}
        <button class="btn btn-ghost btn-sm" id="btn-reprocess-sel">Reprocesar</button>
        <button class="btn-delete-sel" id="btn-delete-sel">🗑 Eliminar</button>
      </div>` : ""}
      <div id="games-table">${games
        ? _gamesTable(games, importPage, _catalogComp ? "No hay partidos en esta competencia." : "Sin partidos aún.")
        : '<p class="empty below-avg">No se pudo cargar el catálogo de partidos.</p>'}</div>
    </div>
    <div class="card" id="bulk-export-card">
      <div class="card-title">Exportar todo</div>
      <p class="td-muted">Descargá todas las tablas de un equipo o de una competencia en un único XLSX (una hoja por apartado).</p>
      <div class="bulk-export">
        <div class="bulk-field">
          <label for="bulk-scope">Alcance</label>
          <select id="bulk-scope" class="map-select">
            <option value="team">Equipo</option>
            <option value="competition">Competencia</option>
          </select>
        </div>
        <div class="bulk-field">
          <label for="bulk-comp">Competencia</label>
          <select id="bulk-comp" class="map-select"></select>
        </div>
        <div class="bulk-field" id="bulk-team-field">
          <label for="bulk-team">Equipo</label>
          <select id="bulk-team" class="map-select"></select>
        </div>
        <button class="btn" id="btn-bulk-export">Exportar XLSX</button>
      </div>
      <p class="td-muted" id="bulk-status" style="margin-top:8px"></p>
    </div>`;

  const refresh = () => renderImport();

  _wireBulkExport(el, comps);

  // Exportación del catálogo de partidos (T-D10).
  const gamesHost = el.querySelector('[data-xm="games"]');
  if (gamesHost) {
    const compLabel = (comps.find(c => String(c.id) === String(_catalogComp)) || {}).label || "";
    _mountTableExport(gamesHost, () => el.querySelector("#games-table table"),
      _baseMeta({ title: "Catálogo de partidos", section: "partidos", entity: "", entitySlug: "liga", competitionLabel: compLabel }));
  }

  document.getElementById("btn-import").addEventListener("click", async () => {
    const url = document.getElementById("url-input").value.trim();
    if (!url) return toast("Ingresa una URL", "err");
    const btn = document.getElementById("btn-import");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Importando...';
    try {
      const res = await api.importGame(url);
      invalidateContextOptions();   // el import puede traer equipos o jugadores nuevos
      const teamNames = (res.teams || []).map(t => t.name).join(" vs ");
      toast(`Partido importado: ${teamNames}${res.competition_label ? ` · ${res.competition_label}` : ""}`);
      importPage = 0;
      refresh();
      _afterDataChange();
    } catch (e) {
      toast(navigator.onLine === false ? "Sin conexión. Revisá tu red e intentá de nuevo." : e.message, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Importar";
    }
  });

  document.getElementById("btn-live").addEventListener("click", () => {
    const target = _liveTarget(document.getElementById("url-input").value);
    if (!target) return toast("Ingresá la URL de FIBA LiveStats o el id del partido", "err");
    showLiveGame(target.id, target.url);
  });

  document.getElementById("btn-seed")?.addEventListener("click", async e => {
    const seedBtn = e.currentTarget;
    seedBtn.disabled = true;
    seedBtn.innerHTML = '<span class="spinner"></span>Importando partidos...';
    try {
      const res = await api.seed();
      invalidateContextOptions();
      toast(`Seed: ${res.imported} importados, ${res.failed} fallidos`, res.failed ? "err" : "ok");
      importPage = 0;
      refresh();
      _afterDataChange();
    } catch (err) {
      toast(err.message, "err");
      seedBtn.disabled = false;
      seedBtn.textContent = "⚡ Agregar partidos (dev)";
    }
  });

  document.getElementById("catalog-comp")?.addEventListener("change", e => {
    _catalogComp = e.target.value;
    importPage = 0;
    selectedGames.clear();   // no actuar sobre partidos que el filtro dejó fuera de vista
    refresh();
  });

  document.getElementById("btn-select-mode")?.addEventListener("click", () => {
    selectMode = !selectMode;
    selectedGames.clear();
    refresh();
  });

  el.querySelectorAll(".row-cb").forEach(cb => cb.addEventListener("change", () => {
    cb.checked ? selectedGames.add(cb.dataset.id) : selectedGames.delete(cb.dataset.id);
    cb.closest("tr")?.classList.toggle("selected-row", cb.checked);
    const actions = document.getElementById("sel-actions");
    if (actions) actions.style.display = selectedGames.size ? "" : "none";
  }));

  const page = delta => { importPage += delta; refresh(); };
  document.getElementById("pg-prev")?.addEventListener("click", () => page(-1));
  document.getElementById("pg-next")?.addEventListener("click", () => page(1));

  // F-07: click en fila del catálogo abre vista partido
  el.querySelectorAll("tr[data-game-id]").forEach(tr => {
    tr.style.cursor = "pointer";
    tr.addEventListener("click", e => {
      if (e.target.closest("input")) return;
      showGame(tr.dataset.gameId);
    });
  });

  document.getElementById("btn-delete-sel")?.addEventListener("click", () => {
    if (selectedGames.size) _showDeleteModal(selectedGames.size, [...selectedGames]);
  });

  document.getElementById("btn-move-sel")?.addEventListener("click", () => {
    const ids = [...selectedGames];
    _formModal({
      title: "Mover a competencia",
      text: `${ids.length} partido${ids.length > 1 ? "s" : ""} pasan a la competencia elegida. La asignación se conserva al reprocesar.`,
      fields: [{ name: "comp", label: "Competencia", type: "select",
                 options: comps.map(c => ({ value: c.id, label: _compLabel(c) })) }],
      confirm: "Mover",
      onSubmit: async v => {
        let moved = 0;
        try {
          for (const id of ids) { await api.assignGame(id, Number(v.comp)); moved++; }
        } finally {
          if (moved) {
            selectMode = false;
            selectedGames.clear();
            refresh();
            _afterDataChange();
          }
        }
        toast(`${moved} partido${moved > 1 ? "s" : ""} movido${moved > 1 ? "s" : ""}.`);
      },
    });
  });

  document.getElementById("btn-reprocess-sel")?.addEventListener("click", async e => {
    const btn = e.currentTarget, ids = [...selectedGames];
    btn.disabled = true;
    await _runReprocess({ gameIds: ids }, (done, total) => { btn.textContent = `Reprocesando ${done} de ${total}…`; });
    selectMode = false;
    selectedGames.clear();
    refresh();
  });
}

// Orden y copy de los chequeos del informe de calidad (F-11)
const QUALITY_CHECKS = [
  ["games_without_pbp",       "Partidos sin play-by-play"],
  ["games_missing_data",      "Partidos con datos básicos faltantes"],
  ["games_needing_reprocess", "Partidos pendientes de reproceso"],
  ["pbp_box_mismatch",        "Play-by-play que no cuadra con el box score"],
  ["lineup_inconsistencies",  "Quintetos inconsistentes"],
  ["games_without_coords",    "Partidos sin coordenadas de tiro"],
  ["null_fields",             "Campos nulos"],
  ["possible_duplicates",     "Jugadores posiblemente duplicados"],
  ["possession_gaps",         "Posesiones que no cerraron correctamente"],
];

function _qualityCheckCard(title, c, key) {
  if (!c) return "";
  const incomplete = c.counts_as_incomplete;
  const badge = c.status === "ok" ? '<span class="badge badge-ok">OK</span>'
    : c.status === "no_disponible" ? '<span class="badge badge-muted">No disponible</span>'
    : `<span class="badge ${incomplete ? "badge-warn" : "badge-muted"}">${c.count} ${incomplete ? "incompleto(s)" : "aviso(s)"}</span>`;
  let body = "";
  if (c.status === "no_disponible") {
    body = '<p class="td-muted">Disponible cuando se implemente el motor de posesiones.</p>';
  } else if (key === "null_fields") {
    body = `<div class="table-wrap"><table>
      <thead><tr><th>Campo</th><th style="text-align:right">Nulos</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${c.items.map(i => `<tr>
        <td>${i.label}</td><td style="text-align:right">${i.nulls} / ${i.total}</td>
        <td style="text-align:right" class="${i.nulls ? "" : "td-muted"}">${PCT(i.pct)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  } else if (key === "possible_duplicates") {
    body = '<div id="dup-panel"></div>';   // lo dibuja identity-merge.js (C-08)
  } else if (key === "possession_gaps" && c.status !== "no_disponible") {
    const n = c.count || 0, pct = c.pct != null ? DEC1(c.pct) : "—";
    const games = c.items ? c.items.length : 0;
    body = n ? `<p>${n} posesiones incompletas (${pct} %) en ${games} partido(s).</p>` : "";
    if (c.items && c.items.length) {
      const line = i => `<li class="poss-gap-item" data-game="${i.game_id}">${_fmtDate(i.date)} · ${esc(i.label)} — <span class="td-muted">${i.incomplete || 0} incompleta(s)</span></li>`;
      body += `<details${c.items.length <= 5 ? " open" : ""}><summary>Ver ${c.items.length}</summary>
        <ul class="quality-items">${c.items.map(line).join("")}</ul></details>`;
    }
  } else if (c.items.length) {
    const line = i => `<li>${_fmtDate(i.date)} · ${esc(i.label)}${i.team_code ? ` · <b>${i.team_code}</b>` : ""}${i.detail ? ` — <span class="td-muted">${esc(i.detail)}</span>` : ""}</li>`;
    body = `<details${c.items.length <= 5 ? " open" : ""}><summary>Ver ${c.items.length}</summary>
      <ul class="quality-items">${c.items.map(line).join("")}</ul></details>`;
  }
  return `
    <div class="card quality-check">
      <div class="games-header"><div class="card-title" style="margin:0">${title}</div>${badge}</div>
      ${body}
    </div>`;
}

async function _renderQualityTab(el) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Revisando la competencia…</p>';
  const comps = await api.competitions(true).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  if (!comps) { el.innerHTML = '<p class="empty below-avg">No se pudo generar el informe de calidad.</p>'; return; }
  if (!comps.length) {
    el.innerHTML = '<p class="empty">Todavía no hay competencias. Importá un partido para crear la primera.</p>';
    return;
  }
  if (!comps.some(c => String(c.id) === String(_qualityComp))) _qualityComp = String(comps[0].id);

  const requested = _qualityComp;
  let rep;
  try { rep = await api.dataQuality(requested); }
  catch { if (requested === _qualityComp) el.innerHTML = '<p class="empty below-avg">No se pudo generar el informe de calidad.</p>'; return; }
  if (!el.isConnected || requested !== _qualityComp) return;   // llegó tarde: otra competencia elegida
  const comp = rep.competition, s = rep.summary;
  const isDraft = comp.status === "borrador";

  el.innerHTML = `
    <div class="card">
      <div class="games-header">
        <select id="quality-comp" class="map-select">${comps.map(c =>
          `<option value="${c.id}"${String(c.id) === _qualityComp ? " selected" : ""}>${esc(_compLabel(c))}</option>`).join("")}</select>
        ${_isAdmin ? `<div class="games-header-actions">
          <button class="btn btn-ghost btn-sm" id="btn-reprocess-comp"${s.games ? "" : " disabled"}>Reprocesar competencia</button>
          <button class="btn btn-sm${isDraft ? "" : " btn-ghost"}" id="btn-publish">${isDraft ? "Publicar" : "Pasar a borrador"}</button>
        </div>` : ""}
      </div>
      ${s.games ? `
      <div class="quality-summary">
        <span class="badge ${s.ready_to_publish ? "badge-ok" : "badge-warn"}">${s.ready_to_publish ? "Lista para publicar" : "Revisar antes de publicar"}</span>
        <span>${s.games} partidos · ${s.incomplete_games} incompletos · ${isDraft ? "en borrador (oculta fuera de Datos)" : "publicada"}</span>
      </div>` : '<p class="empty">Esta competencia no tiene partidos.</p>'}
    </div>
    ${s.games ? QUALITY_CHECKS.map(([k, t]) => _qualityCheckCard(t, rep.checks[k], k)).join("") : ""}
    <div id="poss-conciliation"></div>`;

  renderDuplicateItems(document.getElementById("dup-panel"), rep.checks.possible_duplicates, {
    isAdmin: _isAdmin, toast,
    onMerged: () => { _afterDataChange(); _renderQualityTab(el); },
  });

  if (s.games) _renderConciliation(document.getElementById("poss-conciliation"), requested);

  el.querySelectorAll(".poss-gap-item[data-game]").forEach(li => {
    li.style.cursor = "pointer";
    li.addEventListener("click", () => _openPossInspection(li.dataset.game));
  });

  document.getElementById("quality-comp").addEventListener("change", e => {
    _qualityComp = e.target.value;
    _renderQualityTab(el);
  });

  document.getElementById("btn-reprocess-comp")?.addEventListener("click", async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    await _runReprocess({ competitionId: comp.id }, (done, total) => { btn.textContent = `Reprocesando ${done} de ${total}…`; });
    _renderQualityTab(el);
  });

  document.getElementById("btn-publish")?.addEventListener("click", () => {
    const setStatus = async status => {
      await api.updateCompetition(comp.id, { status });
      toast(status === "publicada" ? "Competencia publicada." : "Competencia pasada a borrador.");
      _afterDataChange();
      _renderQualityTab(el);
    };
    if (isDraft && s.incomplete_games === 0) return setStatus("publicada").catch(err => toast(err.message, "err"));
    _formModal(isDraft
      ? { title: "Publicar competencia", text: `Hay ${s.incomplete_games} partidos incompletos. ¿Publicar igual?`,
          confirm: "Publicar igual", onSubmit: () => setStatus("publicada") }
      : { title: "Pasar a borrador", text: "Sus partidos dejan de verse en Liga, Equipo, Jugador, Comparar y Buscar hasta que la publiques.",
          confirm: "Pasar a borrador", onSubmit: () => setStatus("borrador") });
  });
}

// ── Conciliación de posesiones (A-01, T-D1) ───────────────────────────────
async function _renderConciliation(el, compId) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Conciliando posesiones…</p>';
  let rc;
  try { rc = await api.possessionsReconcile({ competition: compId }); }
  catch { el.innerHTML = '<p class="empty td-muted">No se pudo cargar la conciliación de posesiones.</p>'; return; }
  if (!el.isConnected) return;
  const teams = rc.teams || [], totals = rc.totals || {}, over = rc.games_over_5pct || [];
  const row = t => `<tr>
    <td class="td-team">${esc(t.team_name || t.team_code)}</td>
    <td style="text-align:right">${t.games}</td>
    <td style="text-align:right">${t.counted}</td>
    <td style="text-align:right">${DEC1(t.formula)}</td>
    <td style="text-align:right" class="${t.diff_pct != null && Math.abs(t.diff_pct) > 2 ? "poss-alert" : ""}">${t.diff_pct != null ? DEC1(t.diff_pct) + " %" : "—"}</td>
    <td style="text-align:right">${t.incomplete}</td></tr>`;
  const csvData = [["Equipo", "Partidos", "Reconstruidas", "Fórmula", "Diferencia %", "Incompletas"],
    ...teams.map(t => [t.team_name || t.team_code, t.games, t.counted, t.formula, t.diff_pct, t.incomplete])];
  el.innerHTML = `
    <div class="card">
      <div class="games-header">
        <div class="card-title" style="margin:0">Conciliación de posesiones</div>
        <button class="btn btn-ghost btn-sm" id="btn-poss-csv">CSV</button>
      </div>
      <p class="td-muted" style="font-size:12px;margin:var(--sp-2) 0">Reconstruidas una por una vs fórmula del glosario. Diferencia admitida: 2 % por equipo.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Equipo</th><th style="text-align:right">PJ</th><th style="text-align:right">Reconstruidas</th><th style="text-align:right">Fórmula</th><th style="text-align:right">Dif %</th><th style="text-align:right">Incompletas</th></tr></thead>
        <tbody>${teams.map(row).join("")}</tbody>
        <tfoot><tr class="td-muted"><td>Total</td><td></td><td style="text-align:right">${totals.counted || 0}</td><td style="text-align:right">${DEC1(totals.formula)}</td><td style="text-align:right">${totals.diff_pct != null ? DEC1(totals.diff_pct) + " %" : "—"}</td><td style="text-align:right">${totals.incomplete || 0}</td></tr></tfoot>
      </table></div>
      ${over.length ? `<div style="margin-top:var(--sp-3)">
        <div class="card-title" style="font-size:13px">Partidos con diferencia mayor al 5 %</div>
        <ul class="quality-items">${over.map(o => `<li class="poss-gap-item" data-game="${o.game_id}" style="cursor:pointer">${esc(o.team_code)} · ${DEC1(o.diff_pct)} % · ${o.counted} reconstruidas / ${DEC1(o.formula)} fórmula</li>`).join("")}</ul>
      </div>` : '<p class="td-muted" style="font-size:12px;margin-top:var(--sp-2)">Ningún partido supera el 5 %.</p>'}
    </div>`;
  document.getElementById("btn-poss-csv")?.addEventListener("click", () => {
    const sep = ";", dec = v => typeof v === "number" ? String(v).replace(".", ",") : (v ?? "");
    const csv = csvData.map(r => r.map(dec).join(sep)).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "conciliacion_posesiones.csv");
  });
  el.querySelectorAll(".poss-gap-item[data-game]").forEach(li => {
    li.addEventListener("click", () => _openPossInspection(li.dataset.game));
  });
}

// ── Inspección de posesiones de un partido (A-01, T-D2) ────────────────────
async function _openPossInspection(gameId) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = '<div class="modal" style="max-width:900px;width:95vw"><p class="empty"><span class="spinner"></span>Cargando posesiones…</p></div>';
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", e => { if (e.target === backdrop) backdrop.remove(); });

  let data;
  try { data = await api.gamePossessions(gameId, { detail: 1 }); }
  catch (e) {
    backdrop.querySelector(".modal").innerHTML = `<h3>Error</h3><p>${esc(e.message || "No se pudieron cargar las posesiones.")}</p>
      <div class="modal-actions"><button class="btn btn-ghost btn-sm" data-cancel>Cerrar</button></div>`;
    backdrop.querySelector("[data-cancel]").addEventListener("click", () => backdrop.remove());
    return;
  }

  const poss = data.possessions || [], rec = data.reconcile || {};
  const teams = Object.keys(rec);
  let filter = null;

  function render() {
    const filtered = filter ? poss.filter(p => p.team === filter) : poss;
    const recSummary = teams.map(t => {
      const r = rec[t];
      if (!r) return "";
      const cls = r.diff_pct != null && Math.abs(r.diff_pct) > 2 ? " poss-alert" : "";
      return `<span>${t}: ${r.counted} reconstruidas · ${DEC1(r.formula_pbp)} fórmula · <span class="${cls}">${DEC1(r.diff_pct)} %</span></span>`;
    }).join(" · ");

    const endTypes = { t2c: "2P conv.", t2f: "2P errado", t3c: "3P conv.", t3f: "3P errado",
      falta: "Falta", perdida: "Pérdida", fin_periodo: "Fin período" };
    const fmtClock = s => s != null ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—";

    const row = p => {
      const cls = p.incomplete ? ' class="poss-incomplete"' : "";
      const status = p.incomplete ? (p.incomplete_reason || "incompleta") : "OK";
      return `<tr${cls}${p.incomplete && p.incomplete_reason ? ` title="${esc(p.incomplete_reason)}"` : ""}>
        <td>${p.poss_id}</td><td>${esc(p.team)}</td><td>${p.period}${p.period_type === "OVERTIME" ? " OT" : ""}</td>
        <td>${fmtClock(p.start_clock)}</td><td>${fmtClock(p.end_clock)}</td>
        <td>${p.duration != null ? p.duration + "s" : "—"}</td>
        <td>${p.chances ? p.chances.length : 1}</td>
        <td>${endTypes[p.end_type] || p.end_type || "—"}</td>
        <td style="text-align:right">${p.pts}</td>
        <td>${status}</td></tr>`;
    };

    backdrop.querySelector(".modal").innerHTML = `
      <div class="games-header" style="margin-bottom:var(--sp-3)">
        <h3 style="margin:0">Posesiones · ${esc(data.game_id || gameId)}</h3>
        <button class="btn btn-ghost btn-sm" data-cancel>Cerrar</button>
      </div>
      <div class="poss-summary">${recSummary}</div>
      <div class="poss-filters">
        <button class="filter-pill${!filter ? " active" : ""}" data-team="">Todos</button>
        ${teams.map(t => `<button class="filter-pill${filter === t ? " active" : ""}" data-team="${t}">${t}</button>`).join("")}
      </div>
      <div class="poss-sheet"><div class="table-wrap table-sticky"><table>
        <thead><tr><th>#</th><th>Equipo</th><th>Per.</th><th>Inicio</th><th>Fin</th><th>Dur.</th><th>Op.</th><th>Final.</th><th style="text-align:right">Pts</th><th>Estado</th></tr></thead>
        <tbody>${filtered.map(row).join("")}</tbody>
      </table></div></div>`;

    backdrop.querySelector("[data-cancel]").addEventListener("click", () => backdrop.remove());
    backdrop.querySelectorAll(".poss-filters .filter-pill").forEach(btn => {
      btn.addEventListener("click", () => { filter = btn.dataset.team || null; render(); });
    });
  }
  render();
}

async function _renderCompetitionsTab(el) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando competencias…</p>';
  const comps = await api.competitions(true).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  if (!comps) { el.innerHTML = '<p class="empty below-avg">No se pudieron cargar las competencias.</p>'; return; }

  el.innerHTML = `
    <div class="card">
      <div class="games-header">
        <div class="card-title" style="margin:0">Competencias y temporadas</div>
        ${_isAdmin ? '<button class="btn btn-ghost btn-sm" id="btn-new-comp">Nueva competencia</button>' : ""}
      </div>
      ${comps.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Competencia</th><th>Estado</th><th>PJ</th><th>Equipos</th><th>Fechas</th>${_isAdmin ? "<th></th>" : ""}</tr></thead>
        <tbody>${comps.map(c => `
          <tr data-id="${c.id}">
            <td class="td-team">${esc(c.label)}</td>
            <td><span class="badge ${c.status === "publicada" ? "badge-ok" : "badge-muted"}">${c.status === "publicada" ? "Publicada" : "Borrador"}</span></td>
            <td>${c.games}</td>
            <td>${c.teams}</td>
            <td class="td-muted">${c.first_date ? `${_fmtDate(c.first_date)} – ${_fmtDate(c.last_date)}` : "—"}</td>
            ${_isAdmin ? `<td class="comp-actions">
              <button class="btn btn-ghost btn-sm" data-act="edit">Editar</button>
              ${comps.length > 1 ? '<button class="btn btn-ghost btn-sm" data-act="merge">Fusionar en…</button>' : ""}
            </td>` : ""}
          </tr>`).join("")}</tbody>
      </table></div>` : '<p class="empty">Todavía no hay competencias. Importá un partido para crear la primera.</p>'}
    </div>`;

  const done = msg => { toast(msg); _afterDataChange(); _renderCompetitionsTab(el); };
  const statusOptions = [{ value: "publicada", label: "Publicada" }, { value: "borrador", label: "Borrador (oculta fuera de Datos)" }];

  document.getElementById("btn-new-comp")?.addEventListener("click", () => _formModal({
    title: "Nueva competencia",
    fields: [{ name: "name", label: "Nombre", placeholder: "Liga Uruguaya de Básquetbol" },
             { name: "season", label: "Temporada (opcional)", placeholder: "2025/2026" }],
    onSubmit: async v => { await api.createCompetition(v); done("Competencia guardada."); },
  }));

  el.querySelectorAll("[data-act]").forEach(btn => btn.addEventListener("click", () => {
    const c = comps.find(x => String(x.id) === btn.closest("tr").dataset.id);
    if (btn.dataset.act === "edit") {
      _formModal({
        title: "Editar competencia",
        fields: [{ name: "name", label: "Nombre", value: c.name },
                 { name: "season", label: "Temporada (opcional)", value: c.season || "" },
                 { name: "status", label: "Estado", type: "select", value: c.status, options: statusOptions }],
        onSubmit: async v => { await api.updateCompetition(c.id, v); done("Competencia guardada."); },
      });
    } else {
      _formModal({
        title: `Fusionar «${esc(c.label)}»`,
        text: `Todos sus partidos (${c.games}) pasan a la competencia elegida y «${esc(c.label)}» deja de existir.`,
        fields: [{ name: "target", label: "Fusionar en", type: "select",
                   options: comps.filter(x => x.id !== c.id).map(x => ({ value: x.id, label: _compLabel(x) })) }],
        confirm: "Fusionar", danger: true,
        onSubmit: async v => { await api.mergeCompetition(Number(v.target), c.id); done("Competencias fusionadas."); },
      });
    }
  }));
}

// ── League section — sortable table ───────────────────────────────────────
let _leagueTeams    = [];
let _leagueSummary  = null;  // {avg, leaders, population} de include=summary (T-01), alimenta el mapa
let _leagueMap      = "ef";
let _leagueComp     = null; // null = la competencia por defecto (se resuelve al cargar); "all" = todas

// Scatter map presets — each defines the X/Y axes for el mapa de liga.
// Cada eje declara la dirección de su métrica (`higher` | `lower` | `neutral`) y el título se arma
// con `_mapAxis`: nunca escribir la flecha a mano (C-10). `xLabel`/`yLabel` = nombre largo del
// título si difiere del corto (`xName`/`yName`, usado en tooltip y línea de promedio).
const LEAGUE_MAPS = [
  {
    id: "ef", label: "Eficiencia (OER / DER)",
    axis: { xKey: "oer", xName: "OER", xDir: "higher", xQual: "mejor ataque", xPct: false,
            yKey: "der", yName: "DER", yDir: "lower",  yQual: "mejor defensa", yPct: false },
    hint: "Derecha = mejor ataque (OER alto) &nbsp;|&nbsp; Abajo = mejor defensa (DER bajo) &nbsp;|&nbsp; Abajo-derecha = elite",
  },
  {
    id: "reb", label: "Rebotes (OR% / DR%)",
    axis: { xKey: "or_pct", xName: "OR%", xDir: "higher", xQual: "mejor", xPct: true,
            yKey: "dr_pct", yName: "DR%", yDir: "higher", yQual: "mejor", yPct: true },
    hint: "Derecha = mejor rebote ofensivo &nbsp;|&nbsp; Arriba = mejor rebote defensivo &nbsp;|&nbsp; Arriba-derecha = domina ambos tableros",
  },
  {
    id: "rec", label: "Recuperos / Puntos",
    axis: { xKey: "stl", xName: "Recuperos", xLabel: "Recuperos por partido", xDir: "higher", xQual: "más robos", xPct: false,
            yKey: "pts", yName: "Puntos",    yLabel: "Puntos por partido",    yDir: "higher", yQual: "más puntos", yPct: false },
    hint: "Derecha = más robos &nbsp;|&nbsp; Arriba = más puntos &nbsp;|&nbsp; Arriba-derecha = elite",
  },
];

// Flecha hacia el lado de la pantalla donde está el mejor rendimiento. El eje Y no está invertido
// (`reverse: false` en drawLeagueScatter): los valores crecen hacia arriba.
const AXIS_ARROWS = { x: { higher: "→", lower: "←" }, y: { higher: "↑", lower: "↓" } };

function _axisTitle(name, dir, orient, qual) {
  const arrow = AXIS_ARROWS[orient][dir];
  return arrow ? `${name}  (${arrow} ${qual})` : name;   // métrica neutral: sin flecha de "mejor"
}

function _mapAxis(a) {
  return {
    ...a,
    xTitle: _axisTitle(a.xLabel || a.xName, a.xDir, "x", a.xQual),
    yTitle: _axisTitle(a.yLabel || a.yName, a.yDir, "y", a.yQual),
    xAvgLabel: `Prom. ${a.xName}`,
    yAvgLabel: `Prom. ${a.yName}`,
  };
}

function _drawLeagueMap() {
  const map = LEAGUE_MAPS.find(m => m.id === _leagueMap) || LEAGUE_MAPS[0];
  const hintEl = document.getElementById("map-hint");
  if (hintEl) {
    hintEl.innerHTML = `${map.hint}
      &nbsp;&nbsp;·&nbsp;&nbsp;
      <span style="color:var(--muted)">🖱 rueda = zoom &nbsp;·&nbsp; arrastrar = mover &nbsp;·&nbsp; pellizcar = zoom táctil</span>`;
  }
  const axis = _mapAxis(map.axis);
  const avg = _leagueSummary?.avg;
  if (avg) {
    if (avg[axis.xKey] != null) axis.avgX = avg[axis.xKey];
    if (avg[axis.yKey] != null) axis.avgY = avg[axis.yKey];
  }
  drawLeagueScatter("chart-scatter", _leagueTeams, axis);
}

// T-06: abre el equipo al hacer clic en una fila del ranking (conserva el comportamiento previo).
function _openTeamFromRow(row) {
  const code = String(row.id ?? "").split(":").pop() || row.id;
  const sel = document.getElementById("team-select");
  if (sel) sel.value = code;
  setSection("team");
  renderTeam(code);
}

async function renderLeague() {
  const sec = document.getElementById("sec-league");
  sec.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  try {
    const comps = await api.competitions().catch(() => []);
    // Abre en la competencia por defecto (RF-12); "Todas" solo si el usuario la eligió y sigue vigente
    if (_leagueComp !== "all" && !comps.some(c => String(c.id) === String(_leagueComp))) {
      const def = comps.find(c => c.is_default);
      _leagueComp = def ? String(def.id) : null;
    }
    // El mapa de liga sigue con /api/league (no migra, T-D7).
    const res = await api.league(_leagueComp, { summary: true });
    _leagueTeams = res.teams || [];
    _leagueSummary = { avg: res.avg || {}, leaders: res.leaders || {}, population: res.population || null };
    if (!_leagueTeams.length) { sec.innerHTML = '<p class="empty">Sin datos. Importa partidos primero.</p>'; return; }

    const compSelHTML = comps.length > 1
      ? `<select id="league-comp" class="map-select">${_compOptions(comps, _leagueComp, "Todas las competencias", "all")}</select>`
      : "";
    sec.innerHTML = `
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">Tabla general</div>
          ${compSelHTML}
        </div>
        <p class="td-muted">Solo partidos importados, no el fixture completo.</p>
        <div id="league-standings-dt"></div>
      </div>
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">Ranking de equipos — Liga</div>
        </div>
        <div id="league-ranking-dt"></div>
      </div>`;

    // Parámetros de tabla: "all" (todas) se envía como sin competencia.
    const compParam = (_leagueComp && _leagueComp !== "all") ? _leagueComp : null;

    // Tabla general (league_standings): el backend responde 400 con el mensaje de C-09
    // cuando hay varias competencias y no se eligió una.
    const standEl = document.getElementById("league-standings-dt");
    mountTable(standEl, () => api.table("league_standings", { competition: compParam }), {
      tableId: "league_standings",
      onRowClick: _openTeamFromRow,
    });

    // Ranking (league_teams): clic de fila → abre el equipo.
    const rankEl = document.getElementById("league-ranking-dt");
    mountTable(rankEl, () => api.table("league_teams", { competition: compParam }), {
      tableId: "league_teams",
      onRowClick: _openTeamFromRow,
    });

    const compSel = document.getElementById("league-comp");
    if (compSel) compSel.addEventListener("change", e => { _leagueComp = e.target.value; renderLeague(); });

    if (_leagueTeams.length >= 2) {
      const mapOpts = LEAGUE_MAPS.map(m =>
        `<option value="${m.id}" ${m.id === _leagueMap ? "selected" : ""}>${m.label}</option>`
      ).join("");
      sec.insertAdjacentHTML("beforeend", `
        <div class="card">
          <div class="map-header">
            <div class="card-title" style="margin:0">Mapa de liga</div>
            <select id="map-select" class="map-select">${mapOpts}</select>
          </div>
          <p class="chart-hint" id="map-hint"></p>
          <canvas id="chart-scatter"></canvas>
          <div style="text-align:right;margin-top:8px">
            <button class="btn btn-ghost btn-sm" id="btn-reset-scatter">↺ Resetear zoom</button>
          </div>
        </div>`);
      _drawLeagueMap();
      document.getElementById("map-select").addEventListener("change", e => {
        _leagueMap = e.target.value;
        _drawLeagueMap();
      });
      document.getElementById("btn-reset-scatter").addEventListener("click", () => resetZoom("chart-scatter"));
    }
    // Cierres se movieron a la vista Equipo (Feature 05 v2).
  } catch (e) {
    sec.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}

// ── Clutch por equipo (últimos N min, dif ≤ `margin`) — dentro de Equipo (Feat 05 v2) ──
// Umbral y ventana salen siempre de la respuesta (`margin`, `window_secs`): nunca escribir
// esos números acá (C-06). Antes de la respuesta el título dice solo "Cierres".
let _clutchData = null;   // se mantiene para resetear al cambiar de equipo/competencia
let _clutchReq  = 0;   // descarta respuestas viejas al cambiar de equipo o competencia

function _clutchTitle(d) {
  if (!d) return `<div class="card-title">Cierres</div>`;
  const min = d.window_secs / 60;
  return `<div class="card-title">Cierres (últimos ${fmtNumber(min, Number.isInteger(min) ? 0 : 1)} min, dif ≤ ${d.margin})</div>`;
}

// Recuento que cierra: calificados + excluidos + sin eventos de cierre + sin play-by-play = partidos del equipo.
function _clutchCount(d) {
  const parts = [`${d.games_qualified} calificado(s)`,
                 `${d.games_excluded} excluido(s) por diferencia mayor a ${d.margin}`];
  if (d.games_without_clutch_events) parts.push(`${d.games_without_clutch_events} sin eventos de cierre`);
  if (d.games_without_pbp) parts.push(`${d.games_without_pbp} sin play-by-play`);
  return (d.competition ? `${esc(d.competition.label)} · ` : "") + parts.join(" · ");
}

async function renderTeamClutch(teamCode) {
  const box = document.getElementById("team-clutch");
  if (!box) return;
  const req = ++_clutchReq;
  box.innerHTML = `<div class="card">${_clutchTitle(null)}<p class="empty"><span class="spinner"></span>Calculando cierres...</p></div>`;
  let d;
  try {
    d = await api.clutchTeam(teamCode, _teamComp);
  } catch (e) {
    if (req === _clutchReq) box.innerHTML = `<div class="card">${_clutchTitle(null)}<p class="empty below-avg">${e.message || "No se pudieron cargar los cierres"}</p></div>`;
    return;
  }
  if (req !== _clutchReq) return;   // llegó tarde: otro equipo o competencia elegidos
  const title = _clutchTitle(d);
  if (!d.games_qualified) {
    box.innerHTML = `<div class="card">${title}<p class="empty">Sin cierres apretados: ${_clutchCount(d)}.</p></div>`;
    return;
  }
  box.innerHTML = `
    <div class="card">
      ${title}
      <p class="td-muted">Agregado del equipo en cierres apretados — récord <strong>${d.clutch_record}</strong> · ${_clutchCount(d)}</p>
      <div id="team-clutch-standard-panel"></div>
      <div class="card-title" style="margin-top:16px">Por partido</div>
      <div id="team-clutch-dt"></div>
    </div>`;
  // Tabla por partido migrada a createDataTable (T-06). Conserva competencia y recuento (C-06).
  const compParam = (_teamComp && _teamComp !== "all") ? _teamComp : null;
  mountTable(document.getElementById("team-clutch-dt"),
    () => api.table("clutch_games", { team: teamCode, competition: compParam }),
    { tableId: "clutch_games" });
  _loadClutchStandard(teamCode, d.margin, d.window_secs);
}

// ── Conjunto estándar de métricas — card "Cierres" (T-05, T-E5) ─────────────
let _clutchStdReq = 0;

async function _loadClutchStandard(teamCode, margin, windowSecs) {
  const el = document.getElementById("team-clutch-standard-panel");
  if (!el) return;
  const req = ++_clutchStdReq;
  renderStandardPanel(el, null, { layout: "grid" });
  try {
    await loadCatalog();
    const payload = await api.metrics("clutch", { id: teamCode, competition: _teamComp, margin, window_secs: windowSecs });
    if (req !== _clutchStdReq) return;
    renderStandardPanel(el, payload, { layout: "grid" });
    bindMetricCards(el, { entityType: "clutch", contextQuery: { competition: _teamComp, margin, window_secs: windowSecs, id: teamCode } });
  } catch (e) {
    if (req !== _clutchStdReq) return;
    renderStandardPanel(el, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "grid" });
  }
}

// Carga que tolera filtros inválidos en la dirección (T-03 RF-17): cada 400 `contexto_invalido`
// limpia EL parámetro que el backend nombró y reintenta. Una URL compartida puede traer varios
// filtros vencidos (rival que ya no está en la competencia + jugador de otro equipo), así que se
// reintenta mientras quede algo por limpiar, no una sola vez.
async function _loadDroppingInvalid(load) {
  for (let i = 0; i < 5; i++) {
    try {
      return await load();
    } catch (e) {
      if (!dropInvalid(e)) throw e;
      toast(e.message, "err");
    }
  }
  return load();
}

// ── Team section — competencia y últimos N resueltos en el servidor (C-02) ─────
let _teamData  = null;
let _teamLastN = 0;      // 0 = todos los partidos de la competencia
let _teamComp  = null;   // id de competencia (string) o "all"; null = todavía sin resolver (la elige el servidor)
let _teamReq   = 0;      // descarta respuestas viejas al cambiar de equipo, de competencia o de filtro

// Parámetros de la selección activa; `api.js` omite los nulos (sin `competition` el servidor usa la
// competencia del partido más reciente del equipo).
const _teamParams = () => ({ competition: _teamComp, last: _teamLastN || null, ...contextParams() });

// Jugador elegido en el select de Equipo: la ficha (value) y su nombre visible (C-08)
function _selectedPlayer() {
  const sel = document.getElementById("player-select");
  const opt = sel.selectedOptions[0];
  return sel.value && opt ? { id: Number(sel.value), name: opt.dataset.name } : null;
}


function _renderTeamContent(main, data) {
  const av  = { ...data.averages, null_reasons: data.null_reasons };
  const rs  = av.null_reasons;   // razón de cada nulo (C-11 RF-4)
  // Promedio de liga de la COMPETENCIA elegida, no del subconjunto en pantalla: lo calcula el servidor y
  // el filtro de últimos N no lo altera (C-02 RF-1). "Todas": `Ø —` con razón `sin_universo`.
  const lg  = data.league;
  const radarOk = lg?.oer?.avg != null;
  const charts = !data.game_log.length ? "" : `
      <div class="chart-grid">
        <div class="card">
          <div class="card-title">Perfil de equipo</div>
          ${radarOk ? '<div class="radar-wrap"><canvas id="chart-radar"></canvas></div>'
                    : `<p class="empty">${_radarMsg(data)}</p>`}
        </div>
        <div class="card">
          <div class="card-title">Evolución por partido</div>
          <canvas id="chart-evo" height="200"></canvas>
        </div>
      </div>`;

  // Definición de las cards con ficha (T-01): etiqueta, clave (legada o canónica),
  // valor promedio y display de respaldo para cuando no hay conjunto estándar.
  const TEAM_CARD_GROUPS = [
    { title: "Eficiencia", metrics: [
      ["OER", "oer", av.oer, DEC2(av.oer)], ["DER", "der", av.der, DEC2(av.der)],
      ["Net Rating", "net_rating", av.net_rating, DEC2(av.net_rating)],
      ["Pace", "pace", av.pace, DEC2(av.pace)], ["PPT", "ppt", av.ppt, DEC2(av.ppt)],
      ["FT Rate", "ft_rate", av.ft_rate, DEC2(av.ft_rate)] ] },
    { title: "Tiro", extra: _shotDetailGrid(av, data.totals), metrics: [
      ["eFG%", "efg_pct", av.efg_pct, PCT(av.efg_pct)], ["TS%", "ts_pct", av.ts_pct, PCT(av.ts_pct)],
      ["FG2%", "fg2_pct", av.fg2_pct, PCT(av.fg2_pct)], ["FG3%", "fg3_pct", av.fg3_pct, PCT(av.fg3_pct)],
      ["FT%", "ft_pct", av.ft_pct, PCT(av.ft_pct)], ["Uso 3P", "fg3_uso", av.fg3_uso, PCT(av.fg3_uso)] ] },
    { title: "Rebotes & Misc", trailing: _astPerBox(av, data.totals), metrics: [
      ["OR%", "or_pct", av.or_pct, PCT(av.or_pct)], ["DR%", "dr_pct", av.dr_pct, PCT(av.dr_pct)],
      ["Reb%", "trb_pct", av.trb_pct, PCT(av.trb_pct)], ["PER", "tov", av.tov, DEC2(av.tov)],
      ["AS", "ast", av.ast, DEC2(av.ast)] ] },
    { title: "Defensa avanzada", metrics: [
      ["Robos", "stl", av.stl, DEC2(av.stl)], ["Tapones", "blk", av.blk, DEC2(av.blk)],
      ["Stops", "stocks", av.stocks, DEC2(av.stocks)],
      ["Def Playmaking", "def_playmaking", av.def_playmaking, DEC2(av.def_playmaking)],
      ["DEF/TO Ratio", "def_to_ratio", av.def_to_ratio, DEC2(av.def_to_ratio)] ] },
    { title: "Desglose ofensivo", metrics: [
      ["PtsEnPint", "paint_pts", av.paint_pts, DEC2(av.paint_pts)],
      ["Seg. Op.", "second_chance_pts", av.second_chance_pts, DEC2(av.second_chance_pts)],
      ["Ptos/PER", "pts_from_tov", av.pts_from_tov, DEC2(av.pts_from_tov)],
      ["Banca", "bench_pts", av.bench_pts, DEC2(av.bench_pts)],
      ["PCA", "fast_break_pts", av.fast_break_pts, DEC2(av.fast_break_pts)] ] },
  ];

  main.innerHTML = `
    ${_selectionNote(data, ["equipo", "equipos"])}
    ${charts}
    ${_recordCard(data.record, data.team_name)}
    ${TEAM_CARD_GROUPS.map((g, i) => `
    <div class="card">
      <div class="card-title">${g.title}</div>
      <div class="stat-grid metric-card-grid" data-mc-group="${i}">${_fichaGridHTML(g.metrics, "team", null, data.team_code)}</div>
      ${g.trailing ? `<div class="stat-grid">${g.trailing}</div>` : ""}
      ${g.extra || ""}
    </div>${i === 0 ? _fourFactorsCard(av, data.team_name) : ""}`).join("")}
    <div class="card">
      <div class="card-title">Conjunto estándar</div>
      <div id="team-standard-panel"></div>
    </div>
    <div class="card">
      <div class="card-title">Game log</div>
      <div id="team-gamelog-dt"></div>
    </div>`;

  if (data.game_log.length) {
    if (radarOk) drawRadar("chart-radar", av, lg, data.team_name);
    drawEvolution("chart-evo", data.game_log, lg?.oer?.avg);
  }
  _teamCardGroups = TEAM_CARD_GROUPS;
  _loadTeamStandard(data.team_code);
  _loadTeamGameLog(data.team_code);

  // Exportación de las tablas no migradas de Equipo (T-D10): Four Factors y detalle de tiro.
  const ffHost = main.querySelector('[data-xm="four-factors"]');
  if (ffHost) _mountTableExport(ffHost, () => main.querySelector("#four-factors-table"),
    _baseMeta({ title: `Four Factors — ${data.team_name}`, section: "four-factors", entity: data.team_name, entitySlug: data.team_code, competitionLabel: _teamCompLabel() }));
  _mountShotDetailExports(main, data.team_name, data.team_code, _teamCompLabel());
}

// Monta exportación en cada grilla de detalle de tiro (T-D10). No es un <table>, así que
// se serializan las parejas etiqueta/valor de los stat-box.
function _mountShotDetailExports(container, entityName, entitySlug, compLabel) {
  container.querySelectorAll("[data-shot-detail]").forEach(grid => {
    const host = grid.querySelector("[data-xm-shot]");
    if (!host) return;
    const meta = _baseMeta({ title: `Detalle de tiro — ${entityName}`, section: "detalle-tiro", entity: entityName, entitySlug, competitionLabel: compLabel });
    exportMenu(host, {
      getData: () => {
        const boxes = [...grid.querySelectorAll(".stat-box")];
        const columns = [{ key: "metrica", label: "Métrica", fmt: "text" }, { key: "valor", label: "Valor", fmt: "text" }];
        const rows = boxes.map(b => [b.querySelector(".stat-label")?.textContent.trim() || "", b.querySelector(".stat-value")?.textContent.trim() || ""]);
        return { meta, columns, rows, footer: [], pageInfo: `${rows.length} filas` };
      },
      getNode: () => grid,
    });
  });
}

// Etiqueta de la competencia activa de Equipo (para la cabecera de exportación).
function _teamCompLabel() {
  const sel = document.getElementById("team-comp");
  if (sel && sel.selectedOptions[0] && _teamComp !== "all") return sel.selectedOptions[0].textContent;
  return "";
}

// Game log de equipo migrado a createDataTable (team_game_log). Respeta competencia,
// "Últ. N" y base elegida en la vista (T-D8).
function _loadTeamGameLog(teamCode) {
  const el = document.getElementById("team-gamelog-dt");
  if (!el) return;
  const compParam = (_teamComp && _teamComp !== "all") ? _teamComp : null;
  mountTable(el,
    () => api.table("team_game_log", { team: teamCode, competition: compParam, last: _teamLastN || null, ...contextParams(), base: getBase() }),
    { tableId: "team_game_log" });
}

// Re-dibuja las grillas de fichas de Equipo/Jugador con el conjunto estándar ya
// cargado (`std`), y engancha el ranking al hover/tap. `sectionEl` acota el bind.
function _fillFichaGrids(container, groups, entityType, std, entityId) {
  if (!container || !groups) return;
  groups.forEach((g, i) => {
    const grid = container.querySelector(`.metric-card-grid[data-mc-group="${i}"]`);
    if (grid) grid.innerHTML = _fichaGridHTML(g.metrics, entityType, std, entityId);
  });
}

// ── Conjunto estándar de métricas — card "Equipo" (T-05, T-E1) ──────────────
let _teamStdReq = 0;

let _teamCardGroups = null;

async function _loadTeamStandard(teamCode) {
  const el = document.getElementById("team-standard-panel");
  const main = document.getElementById("team-main");
  if (!el) return;
  const req = ++_teamStdReq;
  renderStandardPanel(el, null, { layout: "grid", base: getBase() });
  const ctxQuery = { competition: _teamComp, last: _teamLastN || null, ...contextParams() };
  try {
    await loadCatalog();
    // El conjunto estándar que alimenta las cards de ficha va siempre por partido
    // (base del ranking, RF-18); el panel usa la base elegida por el usuario.
    const fichaStd = await api.metrics("team", { id: teamCode, ...ctxQuery, base: "partido" });
    if (req !== _teamStdReq) return;
    _fillFichaGrids(main, _teamCardGroups, "team", fichaStd, teamCode);
    const payload = getBase() === "partido"
      ? fichaStd
      : await api.metrics("team", { id: teamCode, ...ctxQuery, base: getBase() });
    if (req !== _teamStdReq) return;
    renderStandardPanel(el, payload, {
      layout: "grid",
      base: getBase(),
      onBaseChange: newBase => { setBase(newBase); _loadTeamStandard(teamCode); _loadTeamGameLog(teamCode);
        _renderTeamRoster(teamCode); _renderTeamLineups(teamCode, _teamData?.team_name);
        _renderTeamPeriods(teamCode, _teamData?.team_name); },
    });
    if (main) bindMetricCards(main, { entityType: "team", contextQuery: { ...ctxQuery, id: teamCode } });
  } catch (e) {
    if (req !== _teamStdReq) return;
    // Sin conjunto estándar las cards ya muestran el valor; aviso discreto en el panel.
    _fillFichaGrids(main, _teamCardGroups, "team", null, teamCode);
    renderStandardPanel(el, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "grid", base: getBase() });
  }
}

// Plantel del equipo (F-08): tabla completa T-06; absorbe el ranking por USO% (RF-8), que ahora es
// una columna más de esta tabla. Cada fila abre la ficha del jugador.
function _renderTeamRoster(teamCode) {
  const el = document.getElementById("team-roster");
  if (!el) return;
  el.innerHTML = `<div class="card">
      <div class="map-header">
        <div class="card-title" style="margin:0">Plantel</div>
        <button type="button" class="btn btn-ghost btn-sm rs-pick-toggle">Elegir para comparar</button>
      </div>
      <p class="td-muted rs-hint">Tocá una fila para abrir la ficha del jugador.</p>
      <div class="rs-compare" style="display:none">
        <span class="rs-picked"></span>
        <button type="button" class="btn btn-ghost btn-sm rs-compare-go" disabled>Comparar</button>
        <button type="button" class="btn btn-ghost btn-sm rs-compare-clear">Limpiar</button>
      </div>
      <div id="team-roster-dt"></div>
    </div>`;
  // Selección para comparar (F-08 RF-5 → F-05 RF-9): dos jugadores y se abre Comparar › Jugadores.
  const picked = [];
  let pickMode = false;
  const bar = el.querySelector(".rs-compare");
  const label = el.querySelector(".rs-picked");
  const go = el.querySelector(".rs-compare-go");
  const hint = el.querySelector(".rs-hint");
  const toggle = el.querySelector(".rs-pick-toggle");
  const refresh = () => {
    bar.style.display = pickMode ? "" : "none";
    label.textContent = picked.length ? picked.map(p => p.name).join(" vs ") : "Elegí dos jugadores.";
    go.disabled = picked.length !== 2;
    toggle.textContent = pickMode ? "Salir de comparar" : "Elegir para comparar";
    hint.textContent = pickMode
      ? "Tocá dos filas para elegir los jugadores a comparar."
      : "Tocá una fila para abrir la ficha del jugador.";
  };
  toggle.addEventListener("click", () => {
    pickMode = !pickMode;
    if (!pickMode) picked.length = 0;
    refresh();
  });
  el.querySelector(".rs-compare-clear").addEventListener("click", () => { picked.length = 0; refresh(); });
  refresh();
  go.addEventListener("click", () => { if (picked.length === 2) showComparePlayers(picked[0].id, picked[1].id); });
  mountTable(document.getElementById("team-roster-dt"),
    () => api.table("team_roster", { team: teamCode, ...contextParams(), competition: _teamComp, last: _teamLastN || null, base: getBase() }),
    {
      tableId: "team_roster",
      onRowClick: (row, payload) => {
        const i = payload.columns.findIndex(c => c.key === "_name");
        const name = i >= 0 ? row.values[i] : "";
        if (pickMode) {   // modo comparar: la fila se marca en vez de abrir la ficha
          const at = picked.findIndex(p => String(p.id) === String(row.id));
          if (at >= 0) picked.splice(at, 1);
          else if (picked.length < 2) picked.push({ id: row.id, name });
          refresh();
          return;
        }
        setSection("player");
        renderPlayer(teamCode, name, Number(row.id) || null);
      },
    });
}

// Bloques "Mejores quintetos" / "Todos los quintetos" / "ON/OFF del plantel" (F-06).
function _renderTeamLineups(teamCode, teamName) {
  renderLineupsBlock(document.getElementById("team-lineups-block"), teamCode, {
    params: _teamParams(), base: getBase(), teamName, competitionLabel: _teamCompLabel(),
  });
}

// Bloque "Por tramo del partido" (F-04): los 8 tramos en una llamada; cambiar de tramo no vuelve a pedir nada.
function _renderTeamPeriods(teamCode, teamName) {
  renderPeriodBlock(document.getElementById("team-periods"), teamCode, {
    params: _teamParams(), base: getBase(), teamName, competitionLabel: _teamCompLabel(),
    onBaseChange: newBase => { setBase(newBase); _loadTeamStandard(teamCode); _loadTeamGameLog(teamCode); _renderTeamPeriods(teamCode, teamName); },
  });
}

// Aplica una respuesta de perfil de equipo: guarda la selección que el servidor resolvió (el eco de
// `context`), sincroniza pills y selector de competencia y dibuja.
function _applyTeamData(main, data) {
  _teamData  = data;
  _teamComp  = String(data.context.competition.id ?? "all");
  _teamLastN = data.context.applied.last || 0;
  const pills = document.getElementById("team-filter-pills");
  if (pills) {
    pills.style.display = data.context.games_total > 3 ? "" : "none";
    pills.querySelectorAll(".filter-pill").forEach(p => p.classList.toggle("active", Number(p.dataset.n) === _teamLastN));
  }
  const compWrap = document.getElementById("team-comp-wrap");
  const compSel  = document.getElementById("team-comp");
  if (compWrap && compSel) {
    compWrap.style.display = data.competitions.length > 1 ? "" : "none";
    compSel.innerHTML = _compOptions(data.competitions, _teamComp, "Todas las competencias", "all");
  }
  _renderTeamContent(main, data);
  _mountCtxBar(main, _teamComp, () => _reloadTeam(), data.team_code);
  _renderTeamPeriods(data.team_code, data.team_name);
  renderOriginPanel(document.getElementById("team-origins"), data.team_code, { mode: "team", params: _teamParams() });
  renderTransitionPanel(document.getElementById("team-transition"), data.team_code, { mode: "team", params: _teamParams() });
  renderSecondChancePanel(document.getElementById("team-second-chance"), data.team_code, { mode: "team", params: _teamParams() });
  renderClockPanel(document.getElementById("team-clock"), data.team_code, { mode: "team", params: _teamParams() });
  _renderTeamRoster(data.team_code);
  _renderTeamLineups(data.team_code, data.team_name);
}

// Cambió la competencia o el filtro de últimos N: se pide el perfil de nuevo al servidor (no se recalcula
// en el navegador, C-02 RF-5). `clutch`: los cierres dependen solo de la competencia.
async function _reloadTeam({ clutch = false } = {}) {
  if (!_teamData) return;
  const main = document.getElementById("team-main");
  const code = document.getElementById("team-select").value || _teamData.team_code;
  const req = ++_teamReq;
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  let data;
  try {
    data = await api.team(code, _teamParams());
  } catch (e) {
    if (req !== _teamReq) return;
    toast(e.message, "err");
    try {
      // La competencia elegida dejó de existir o de estar publicada: volver a la por defecto (RF-14);
      // cualquier otro error (p. ej. sin conexión): se conserva la selección anterior.
      data = /competencia/i.test(e.message) ? await api.team(code)
           : dropInvalid(e) ? await api.team(code, _teamParams()) : _teamData;
    } catch (e2) {
      if (req === _teamReq) main.innerHTML = `<p class="empty below-avg">${e2.message}</p>`;
      return;
    }
    if (req !== _teamReq) return;
    clutch = true;
  }
  if (req !== _teamReq) return;
  _applyTeamData(main, data);
  if (clutch) renderTeamClutch(code);
}

let _ctxTeam = null;   // último equipo mostrado: con/sin jugador no viajan a otro equipo
async function renderTeam(teamCode) {
  if (_ctxTeam && _ctxTeam !== teamCode) clearPlayerFilters();
  _ctxTeam = teamCode;
  const main = document.getElementById("team-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  _teamLastN = 0;
  _teamComp  = null;   // sin competencia: el servidor usa la del partido más reciente del equipo (RF-6)
  const req = ++_teamReq;

  try {
    const data = await _loadDroppingInvalid(() => api.team(teamCode, contextParams()));
    if (req !== _teamReq) return;
    _applyTeamData(main, data);

    const players = await api.players(teamCode);
    if (req !== _teamReq) return;
    const pSel = document.getElementById("player-select");
    pSel.innerHTML = '<option value="">— Seleccionar jugador —</option>' +
      players.map(p => `<option value="${p.player_id ?? ""}" data-name="${esc(p.name)}">${esc(p.name)}</option>`).join("");

    const lineupCard = document.getElementById("team-lineup-card");
    const picker = document.getElementById("team-lineup-picker");
    if (players.length >= 3) {
      picker.innerHTML = players.map(p => `
        <label class="lineup-check"><input type="checkbox" value="${p.name}" data-player-id="${p.player_id ?? ""}">${p.name}</label>`).join("");
      lineupCard.style.display = "";
    } else {
      lineupCard.style.display = "none";
    }

    renderTeamShotmapTeam(teamCode);   // mapa de tiro del equipo (Feature 10)
    renderTeamClutch(teamCode);        // cierres del equipo, de la competencia elegida (Feature 05 v2)
  } catch (e) {
    if (req === _teamReq) main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}

// Mapa de tiro AGREGADO del equipo (C-03) — usa api.shotZones + shotChart
function renderTeamShotmapTeam(teamCode) {
  const box = document.getElementById("team-teamshot");
  if (!box) return;
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando mapa de tiro del equipo...</p></div>';
  api.shotZones({ entity: 'team', id: teamCode, competition: _teamComp }).then(shots => {
    if (!shots || !shots.summary?.total_shots) {
      box.innerHTML = '<div class="card"><p class="empty">Sin tiros registrados para este equipo.</p></div>';
      return;
    }
    box.innerHTML = `
      <div class="card">
        <div class="card-title">Mapa de tiro del equipo <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${teamCode}</span></div>
        ${shotChart(shots)}
      </div>`;
    bindZoneTooltips(box, shots);
  }).catch(() => { box.innerHTML = ""; });
}

// Shot chart del jugador DENTRO de la vista Equipo (C-03) — usa api.shotZones + shotChart
function renderTeamShotmap(teamCode, playerName) {
  const box = document.getElementById("team-shotmap");
  if (!box) return;
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando mapa de tiro...</p></div>';
  const playerId = _selectedPlayer()?.id;
  if (!playerId) { box.innerHTML = ""; return; }
  api.shotZones({ entity: 'player', id: playerId, competition: _teamComp }).then(shots => {
    if (!shots || !shots.summary?.total_shots) {
      box.innerHTML = '<div class="card"><p class="empty">Sin tiros registrados para este jugador.</p></div>';
      return;
    }
    box.innerHTML = `
      <div class="card">
        <div class="card-title">Shot chart por zonas <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName}</span></div>
        ${shotChart(shots)}
      </div>`;
    bindZoneTooltips(box, shots);
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }).catch(() => { box.innerHTML = ""; });
}

// ON/OFF: rendimiento del equipo con un jugador en cancha vs en el banco (Feature 04)
// T-05/T-E4: las dos tablas (Eficiencia y Producción del equipo) se retiran; el conjunto
// estándar completo lo monta `renderStandardPanel(..., {layout:"compare"})` con
// `api.metrics("onoff", ...)`. El badge de confiabilidad de muestra (T-02) ya lo aporta
// el panel en su cabecera: no se duplica una línea propia de "ON: N pos"/"sin muestra".
async function renderTeamOnOff(teamCode, playerName, playerId = null) {
  const box = document.getElementById("team-onoff");
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Calculando ON/OFF...</p></div>';
  try {
    const r = await api.onoff(teamCode, playerName);

    box.innerHTML = `
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">ON / OFF <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName} · Uso ${r.usg_pct != null ? PCT(r.usg_pct) : "—"}</span></div>
          <span class="xm-host" data-xm="onoff"></span>
        </div>
        <div id="team-onoff-standard-panel" style="margin-top:8px"></div>
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const panelEl = document.getElementById("team-onoff-standard-panel");
    _mountPanelExport(box.querySelector('[data-xm="onoff"]'), () => panelEl,
      _baseMeta({ title: `ON/OFF — ${playerName}`, section: "on-off", entity: playerName, entitySlug: `${teamCode}-${playerName}`, competitionLabel: _teamCompLabel() }));
    if (playerId != null) {
      renderStandardPanel(panelEl, null, { layout: "compare" });
      try {
        await loadCatalog();
        const payload = await api.metrics("onoff", { id: `${teamCode}:${playerId}`, competition: _teamComp, last: _teamLastN || null, ...contextParams() });
        renderStandardPanel(panelEl, payload, { layout: "compare" });
      } catch (e) {
        renderStandardPanel(panelEl, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "compare" });
      }
    }
  } catch (e) {
    box.innerHTML = "";
    toast(e.message || "Sin datos ON/OFF para este jugador", "err");
  }
}

// Lineups: rendimiento del equipo con una combinación de 3-5 jugadores en cancha (Feature 03)
// T-05/T-E3: el resumen (statBox/tabla de 18 columnas) se retira; se conservan líderes y el
// recuento de partidos usados/excluidos de `api.lineup`. El conjunto estándar lo monta
// `renderStandardPanel` con `api.metrics("lineup", ...)`.
async function renderTeamLineup(teamCode, players, playerIds = []) {
  const box = document.getElementById("team-lineup");
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Calculando combinación...</p></div>';
  try {
    const r = await api.lineup(teamCode, players);
    const lead = (l, key) => l ? `${l.name} (${l[key]})` : "—";
    box.innerHTML = `
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">Combinación <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${players.join(" · ")}</span></div>
          <span class="xm-host" data-xm="lineup"></span>
        </div>
        <p class="td-muted" style="margin-top:8px">
          ${DEC1(r.sample.possessions)} posesiones · ${Math.round(r.sample.seconds / 60)}' en cancha ·
          ${r.games_used} partido(s) usado(s)${r.games_excluded ? ` (${r.games_excluded} excluido(s) por datos inconsistentes)` : ""}
        </p>
        <div class="stat-grid" style="margin-top:8px">
          <div class="stat-box"><div class="stat-label">Anota más</div><div class="stat-value neutral">${lead(r.leaders.scorer, "pts")}</div></div>
          <div class="stat-box"><div class="stat-label">Asiste más</div><div class="stat-value neutral">${lead(r.leaders.assister, "ast")}</div></div>
          <div class="stat-box"><div class="stat-label">Rebota más</div><div class="stat-value neutral">${lead(r.leaders.rebounder, "trb")}</div></div>
        </div>
        <div id="team-lineup-standard-panel" style="margin-top:12px"></div>
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const panelEl = document.getElementById("team-lineup-standard-panel");
    _mountPanelExport(box.querySelector('[data-xm="lineup"]'), () => panelEl,
      _baseMeta({ title: `Combinación — ${players.join(" · ")}`, section: "combinacion", entity: players.join("-"), entitySlug: teamCode, competitionLabel: _teamCompLabel() }));
    if (playerIds.length >= 3) {
      renderStandardPanel(panelEl, null, { layout: "grid" });
      try {
        await loadCatalog();
        const id = `${teamCode}:${[...playerIds].sort((a, b) => a - b).join("-")}`;
        const payload = await api.metrics("lineup", { id, competition: _teamComp, last: _teamLastN || null, ...contextParams() });
        renderStandardPanel(panelEl, payload, { layout: "grid" });
        bindMetricCards(panelEl, { entityType: "lineup", contextQuery: { competition: _teamComp, last: _teamLastN || null, ...contextParams(), id } });
      } catch (e) {
        renderStandardPanel(panelEl, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "grid" });
      }
    }
  } catch (e) {
    box.innerHTML = "";
    toast(e.message || "Sin datos para esta combinación", "err");
  }
}

// ── Compare section ────────────────────────────────────────────────────────
// Pestañas Equipos / Jugadores de la sección Comparar (F-05). La de jugadores se monta la
// primera vez que se abre (o si la dirección ya trae los dos jugadores).
let _cmpTabsBound = false;
function _initCompareTabs(force = null) {
  const show = which => {
    document.querySelectorAll(".cmp-tab").forEach(b => b.classList.toggle("active", b.dataset.cmp === which));
    document.getElementById("cmp-pane-equipos").style.display = which === "equipos" ? "" : "none";
    const pane = document.getElementById("cmp-pane-jugadores");
    pane.style.display = which === "jugadores" ? "" : "none";
    if (which === "jugadores" && !pane.dataset.mounted) {
      pane.dataset.mounted = "1";
      renderComparePlayers(pane, { base: getBase(), initial: comparePlayersFromUrl() });
    }
  };
  if (!_cmpTabsBound) {
    _cmpTabsBound = true;
    document.querySelectorAll(".cmp-tab").forEach(btn =>
      btn.addEventListener("click", () => show(btn.dataset.cmp)));
  }
  if (force) show(force);
  else if (comparePlayersFromUrl()) show("jugadores");
}

// Abre Comparar › Jugadores con dos jugadores ya elegidos (F-08 RF-5 → F-05 RF-9).
function showComparePlayers(idA, idB) {
  setSection("compare");
  const pane = document.getElementById("cmp-pane-jugadores");
  pane.dataset.mounted = "1";
  _initCompareTabs("jugadores");
  renderComparePlayers(pane, { base: getBase(), initial: { a: String(idA), b: String(idB) } });
}

async function renderCompare() {
  const sec = document.getElementById("sec-compare");
  if (sec.style.display === "none") setSection("compare");
  _initCompareTabs();
  await refreshCompareSelectors();

  const btnCompare = document.getElementById("btn-compare");
  if (btnCompare._bound) return;
  btnCompare._bound = true;

  btnCompare.addEventListener("click", async () => {
    const codeA = document.getElementById("compare-a").value;
    const codeB = document.getElementById("compare-b").value;
    if (!codeA || !codeB) return toast("Selecciona dos equipos", "err");
    if (codeA === codeB) return toast("Selecciona equipos distintos", "err");

    btnCompare.disabled = true;
    btnCompare.innerHTML = '<span class="spinner"></span>Comparando...';

    try {
      // Misma competencia para ambos equipos y para el `Ø` (RF-11): los promedios los calcula el servidor
      const comp = document.getElementById("compare-comp")?.value || "";
      const params = comp ? { competition: comp } : {};
      const [dataA, dataB] = await Promise.all([api.team(codeA, params), api.team(codeB, params)]);
      const avA = dataA.averages, avB = dataB.averages;
      const lg  = dataA.league;
      const radarOk = lg?.oer?.avg != null;

      const a = avA, b = avB;
      // Sin dato → "—", nunca 0 (Feature 12 RF-4)
      const N1 = v => v != null ? Math.round(v) : "—";
      // Ganador/perdedor: clase neutra si falta cualquiera de los dos lados — un nulo
      // no se compara ni se pinta con color de rendimiento (RF-3)
      const winCls = (va, vb, lowerBetter = false) =>
        (va == null || vb == null) ? "" : ((lowerBetter ? va <= vb : va >= vb) ? "winner" : "loser");

      const shootRow = (label, madeA, attA, madeB, attB) => {
        const pct  = (m, a) => (m == null || !a) ? null : Math.round(100 * m / a);
        const pctA = pct(madeA, attA), pctB = pct(madeB, attB);
        const shot = (m, a, p) => `${N1(m)}/${N1(a)}` + (p == null ? "" : ` (${p}%)`);
        return `<tr>
          <td class="${winCls(pctA, pctB)}">${shot(madeA, attA, pctA)}</td>
          <td class="lbl">${label}</td>
          <td class="${winCls(pctB, pctA)}">${shot(madeB, attB, pctB)}</td>
        </tr>`;
      };
      const rawRow = (label, va, vb, lowerBetter = false, fmt = DEC1) => `<tr>
          <td class="${winCls(va, vb, lowerBetter)}">${fmt(va)}</td>
          <td class="lbl">${label}</td>
          <td class="${winCls(vb, va, lowerBetter)}">${fmt(vb)}</td>
        </tr>`;

      const pfA = a.pf, pfB = b.pf, oppPfA = a.opp_pf, oppPfB = b.opp_pf;
      const rows = [
        shootRow("LC",      a.fgm,  a.fga,  b.fgm,  b.fga),
        shootRow("2Pts",    a.fgm2, a.fga2, b.fgm2, b.fga2),
        shootRow("3Pts",    a.fgm3, a.fga3, b.fgm3, b.fga3),
        shootRow("1Pt",     a.ftm,  a.fta,  b.ftm,  b.fta),
        rawRow("REB",       a.trb ?? (a.orb + a.drb), b.trb ?? (b.orb + b.drb)),
        rawRow("As",        a.ast,  b.ast),
        rawRow("ST",        a.stl,  b.stl),
        rawRow("Blq",       a.blk,  b.blk),
        rawRow("PER",       a.tov,  b.tov,  true),
        rawRow("AS/PER",    a.ast_to, b.ast_to, false, DEC2),   // acumulado ΣAS/ΣPER (C-04)
        `<tr>
          <td class="${winCls(pfA, pfB, true)}">${N1(pfA)} (${N1(oppPfA)})</td>
          <td class="lbl">FP</td>
          <td class="${winCls(pfB, pfA, true)}">${N1(pfB)} (${N1(oppPfB)})</td>
        </tr>`,
        // Sin `|| 0`: "la competencia no registra ese dato" es NULL, no cero (RF-4)
        rawRow("PtsEnPint", a.paint_pts,         b.paint_pts),
        rawRow("PtsSegCh",  a.second_chance_pts, b.second_chance_pts),
        rawRow("PtPer",     a.pts_from_tov,      b.pts_from_tov),
        rawRow("Pts Banca", a.bench_pts,         b.bench_pts),
        rawRow("PCA",       a.fast_break_pts,    b.fast_break_pts),
      ].join("");

      // Tabla de métricas avanzadas (una fila por equipo, estilo tabla de cierres)
      const advRow = (name, av, color) => `<tr>
        <td style="color:${color};font-weight:600;text-align:left">${name}</td>
        <td>${DEC2(av.oer)}</td><td>${DEC2(av.der)}</td><td>${DEC2(av.net_rating)}</td>
        <td>${PCT(av.efg_pct)}</td><td>${PCT(av.ts_pct)}</td><td>${DEC2(av.pace)}</td>
        <td>${PCT(av.or_pct)}</td><td>${PCT(av.dr_pct)}</td><td>${PCT(av.to_pct)}</td>
        <td>${PCT(av.as_pct)}</td><td>${DEC2(av.pts)}</td><td>${DEC2(av.possessions)}</td>
      </tr>`;

      // Fila "Ø liga": el promedio de la competencia, con los mismos valores que Equipo (RF-4, RF-11)
      const lgCell = (k, f) => `<td>${fmtOrNull(lg?.[k]?.avg, f, lg?.[k]?.reason)}</td>`;
      const lgRow = `<tr>
        <td style="color:var(--muted);font-weight:600;text-align:left">Ø liga</td>
        ${lgCell("oer", DEC2)}${lgCell("der", DEC2)}${lgCell("net_rating", DEC2)}
        ${lgCell("efg_pct", PCT)}${lgCell("ts_pct", PCT)}${lgCell("pace", DEC2)}
        ${lgCell("or_pct", PCT)}${lgCell("dr_pct", PCT)}${lgCell("to_pct", PCT)}
        ${lgCell("as_pct", PCT)}${lgCell("pts", DEC2)}${lgCell("possessions", DEC2)}
      </tr>`;

      document.getElementById("compare-result").innerHTML = `
        <div class="chart-grid">
          <div class="card">
            <div class="card-title">Radar comparativo</div>
            ${radarOk ? '<div class="radar-wrap"><canvas id="chart-compare-radar"></canvas></div>'
                      : `<p class="empty">${_radarMsg(dataA)}</p>`}
          </div>
          <div class="card">
            <div class="map-header">
              <div class="card-title" style="margin:0">${dataA.team_name} vs ${dataB.team_name}</div>
              <span class="xm-host" data-xm="compare-box"></span>
            </div>
            <div class="table-wrap">
              <table class="compare-table fiba-box" id="compare-box-table">
                <thead><tr>
                  <th style="color:var(--accent)">${dataA.team_name}</th>
                  <th class="lbl"></th>
                  <th style="color:var(--blue)">${dataB.team_name}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="map-header">
            <div class="card-title" style="margin:0">Métricas avanzadas</div>
            <span class="xm-host" data-xm="compare-adv"></span>
          </div>
          <div class="table-wrap">
            <table class="search-table" id="compare-adv-table">
              <thead><tr>
                <th style="text-align:left">Equipo</th>
                <th>Off</th><th>Def</th><th>Net</th><th>eFG%</th><th>TS%</th><th>Pace</th>
                <th>OR%</th><th>DR%</th><th>TO%</th><th>AS%</th><th>Pts</th><th>Pos</th>
              </tr></thead>
              <tbody>
                ${advRow(dataA.team_name, avA, "var(--accent)")}
                ${advRow(dataB.team_name, avB, "var(--blue)")}
                ${lgRow}
              </tbody>
            </table>
          </div>
          <p class="td-muted" style="margin:8px 0 0">${_refLegend(dataA, ["equipo", "equipos"])}</p>
        </div>`;

      const cmpResult = document.getElementById("compare-result");
      const cmpComp = document.getElementById("compare-comp");
      const cmpLabel = cmpComp && cmpComp.value ? cmpComp.selectedOptions[0]?.textContent : "";
      _mountTableExport(cmpResult.querySelector('[data-xm="compare-box"]'), () => cmpResult.querySelector("#compare-box-table"),
        _baseMeta({ title: `Comparación — ${dataA.team_name} vs ${dataB.team_name}`, section: "comparar", entity: `${dataA.team_name}-${dataB.team_name}`, competitionLabel: cmpLabel }));
      _mountTableExport(cmpResult.querySelector('[data-xm="compare-adv"]'), () => cmpResult.querySelector("#compare-adv-table"),
        _baseMeta({ title: `Comparación avanzada — ${dataA.team_name} vs ${dataB.team_name}`, section: "comparar-avanzadas", entity: `${dataA.team_name}-${dataB.team_name}`, competitionLabel: cmpLabel }));

      if (radarOk) drawCompareRadar("chart-compare-radar", avA, avB, lg, dataA.team_name, dataB.team_name);
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btnCompare.disabled = false;
      btnCompare.textContent = "Comparar";
    }
  });
}

// C-07 — detalle de tiro: intentos/convertidos de las 3 categorías (promedio por
// partido + total de temporada) y los 4 PPT. Compartido por Equipo y Jugador.
function _shotDetailGrid(av, totals) {
  const t = totals || {};
  const rs = av?.null_reasons || {};
  // "promedio (total)" — el promedio ya viene del backend; el total también, para no
  // arrastrar el redondeo de multiplicar promedio × partidos (Feature 16 §9).
  const cell = (label, avgKey, totKey) => {
    const a = av?.[avgKey], n = t[totKey];
    // Total ausente → "—", nunca "(0)" (C-11 RF-4)
    const disp = `${DEC2(a)}<span style="font-size:9px;color:var(--muted)"> (${n ?? "—"})</span>`;
    return statBox(label, a, disp, rs[avgKey]);
  };
  return `
    <div data-shot-detail>
      <div class="map-header" style="margin-top:14px">
        <div class="card-title" style="margin:0;font-size:11px;color:var(--muted)">Detalle de tiro — promedio (total temporada)</div>
        <span class="xm-host" data-xm-shot></span>
      </div>
      <div class="stat-grid">
        ${cell("T2i", "fga2", "fga2")}
        ${cell("T2c", "fgm2", "fgm2")}
        ${cell("T3i", "fga3", "fga3")}
        ${cell("T3c", "fgm3", "fgm3")}
        ${cell("TLi", "fta",  "fta")}
        ${cell("TLc", "ftm",  "ftm")}
      </div>
      <div class="card-title" style="margin-top:14px;font-size:11px;color:var(--muted)">Puntos por tiro</div>
      <div class="stat-grid">
        ${statBox("PPT",    av.ppt,    DEC2(av.ppt),    rs.ppt)}
        ${statBox("PPT 2",  av.ppt_2,  DEC2(av.ppt_2),  rs.ppt_2)}
        ${statBox("PPT 3",  av.ppt_3,  DEC2(av.ppt_3),  rs.ppt_3)}
        ${statBox("PPT TL", av.ppt_ft, DEC2(av.ppt_ft), rs.ppt_ft)}
      </div>
    </div>`;
}

// ── Player section — competencia resuelta en el servidor (C-02) ────────────
let _playerData = null;
let _playerComp = null;   // id de competencia (string) o "all"; null = la elige el servidor
let _playerCtx  = { teamCode: "", playerName: "" };
let _playerReq  = 0;      // descarta respuestas viejas

async function renderPlayer(teamCode, playerName, playerId = null) {
  const main = document.getElementById("player-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  _playerComp = null;   // sin competencia: la del partido más reciente del jugador (RF-6)
  _playerCtx  = { teamCode, playerName };
  const req = ++_playerReq;

  try {
    const load = () => playerId != null ? api.playerById(playerId, contextParams()) : api.player(teamCode, playerName, contextParams());
    const data = await _loadDroppingInvalid(load);
    if (req !== _playerReq) return;
    _applyPlayerData(main, data);
  } catch (e) {
    if (req === _playerReq) main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}

function _applyPlayerData(main, data) {
  _playerData = data;
  _playerComp = String(data.context.competition.id ?? "all");
  _playerCtx  = { teamCode: data.team_code, playerName: data.player };   // grafía de la ficha
  _renderPlayerContent(main, data);
  // RF-1: la identidad se dibuja antes que cualquier card de métricas.
  if (data.player_id != null) {
    renderPlayerHeader(document.getElementById("player-identity"), data.player_id, {
      params: { competition: _playerComp, ...contextParams() },
      onSaved: () => toast("Ficha actualizada"),
    });
  }
  _mountCtxBar(main, _playerComp, _reloadPlayer);
  _loadPlayerStandard(data.player_id);
  if (data.player_id != null) {
    renderOriginPanel(document.getElementById("player-origins"), data.player_id,
      { mode: "player", params: { competition: _playerComp, ...contextParams() } });
    renderTransitionPanel(document.getElementById("player-transition"), data.player_id,
      { mode: "player", params: { competition: _playerComp, ...contextParams() } });
    renderSecondChancePanel(document.getElementById("player-second-chance"), data.player_id,
      { mode: "player", params: { competition: _playerComp, ...contextParams() } });
  }
}

// ── Conjunto estándar de métricas — card "Jugador" (T-05, T-E2) ─────────────
let _playerStdReq = 0;

let _playerCardGroups = null;

async function _loadPlayerStandard(playerId) {
  const el = document.getElementById("player-standard-panel");
  const main = document.getElementById("player-main");
  if (!el) return;
  const req = ++_playerStdReq;
  renderStandardPanel(el, null, { layout: "grid", base: getBase() });
  const ctxQuery = { competition: _playerComp, ...contextParams() };
  try {
    await loadCatalog();
    const fichaStd = await api.metrics("player", { id: playerId, ...ctxQuery, base: "partido" });
    if (req !== _playerStdReq) return;
    _fillFichaGrids(main, _playerCardGroups, "player", fichaStd, playerId);
    const payload = getBase() === "partido"
      ? fichaStd
      : await api.metrics("player", { id: playerId, ...ctxQuery, base: getBase() });
    if (req !== _playerStdReq) return;
    renderStandardPanel(el, payload, {
      layout: "grid",
      base: getBase(),
      onBaseChange: newBase => { setBase(newBase); _loadPlayerStandard(playerId); _loadPlayerGameLog(playerId); },
    });
    if (main) bindMetricCards(main, { entityType: "player", contextQuery: { ...ctxQuery, id: playerId } });
  } catch (e) {
    if (req !== _playerStdReq) return;
    _fillFichaGrids(main, _playerCardGroups, "player", null, playerId);
    renderStandardPanel(el, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "grid", base: getBase() });
  }
}

// Cambió la competencia: se pide el perfil de nuevo al servidor (no se recalcula en el navegador)
async function _reloadPlayer() {
  if (!_playerData) return;
  const main = document.getElementById("player-main");
  const id = _playerData.player_id;
  const req = ++_playerReq;
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  let data;
  try {
    data = await api.playerById(id, { competition: _playerComp, ...contextParams() });
  } catch (e) {
    if (req !== _playerReq) return;
    toast(e.message, "err");
    try {
      // competencia inexistente o sin publicar: volver a la por defecto; otro error: conservar la anterior
      data = /competencia/i.test(e.message) ? await api.playerById(id)
           : dropInvalid(e) ? await api.playerById(id, { competition: _playerComp, ...contextParams() }) : _playerData;
    } catch (e2) {
      if (req === _playerReq) main.innerHTML = `<p class="empty below-avg">${e2.message}</p>`;
      return;
    }
  }
  if (req === _playerReq) _applyPlayerData(main, data);
}

function _renderPlayerContent(main, data) {
  const { teamCode, playerName } = _playerCtx;
  const log  = data.game_log;
  const av   = { ...data.averages, null_reasons: data.null_reasons };
  const rs   = av.null_reasons;   // razón de cada nulo (C-11 RF-4)
  // Promedio de liga de la COMPETENCIA elegida, calculado por el servidor (C-02 RF-1)
  const lg   = data.league;
  const comps = data.competitions;
  const radarOk = lg?.oer?.avg != null;

  {
    const PLAYER_CARD_GROUPS = [
      { title: "Producción ofensiva", metrics: [
        ["OER", "oer", av.oer, DEC2(av.oer)], ["USO%", "uso_pct", av.uso_pct, PCT(av.uso_pct)],
        ["PPP", "ppp", av.ppp, DEC2(av.ppp)], ["PPT", "ppt", av.ppt, DEC2(av.ppt)],
        ["eFG%", "efg_pct", av.efg_pct, PCT(av.efg_pct)], ["TS%", "ts_pct", av.ts_pct, PCT(av.ts_pct)],
        ["FT Rate", "ft_rate", av.ft_rate, DEC2(av.ft_rate)] ] },
      { title: "Por posesión y por minuto", metrics: [
        [_hint("AS/pos", "Asistencias por posesión propia (posesión = T2i + T3i + 0,44 × TLi + PER − RO)"), "as_pos", av.as_pos, DEC2(av.as_pos)],
        [_hint("PER/pos", "Pérdidas por posesión propia (PER = pérdidas)"), "tov_pos", av.tov_pos, DEC2(av.tov_pos)],
        [_hint("PTS/pos", "Puntos por posesión propia (igual al OER del jugador)"), "pts_pos", av.pts_pos, DEC2(av.pts_pos)],
        [_hint("RO/min", "Rebotes ofensivos por minuto disputado"), "orb_min", av.orb_min, DEC2(av.orb_min)],
        [_hint("RD/min", "Rebotes defensivos por minuto disputado"), "drb_min", av.drb_min, DEC2(av.drb_min)] ] },
      { title: "Tiro", extra: _shotDetailGrid(av, data.totals), metrics: [
        ["FG2%", "fg2_pct", av.fg2_pct, PCT(av.fg2_pct)], ["FG3%", "fg3_pct", av.fg3_pct, PCT(av.fg3_pct)],
        ["FT%", "ft_pct", av.ft_pct, PCT(av.ft_pct)], ["Uso 2P", "fg2_uso", av.fg2_uso, PCT(av.fg2_uso)],
        ["Uso 3P", "fg3_uso", av.fg3_uso, PCT(av.fg3_uso)] ] },
      { title: "Rebotes & distribución", trailing: _astPerBox(av, data.totals), metrics: [
        [_hint("OR%", "Porción de los rebotes ofensivos disponibles que capturó mientras estuvo en cancha, " + _PCT_REB_HINT.replace("%s", "OR%")), "or_pct", av.or_pct, PCT(av.or_pct)],
        [_hint("DR%", "Porción de los rebotes defensivos disponibles que capturó mientras estuvo en cancha, " + _PCT_REB_HINT.replace("%s", "DR%")), "dr_pct", av.dr_pct, PCT(av.dr_pct)],
        ["TO", "tov", av.tov, DEC2(av.tov)], ["AS", "ast", av.ast, DEC2(av.ast)],
        ["% Reb Equipo", "reb_share", av.reb_share, PCT(av.reb_share)],
        ["% RebOf Equipo", "oreb_share", av.oreb_share, PCT(av.oreb_share)],
        ["% RebDef Equipo", "dreb_share", av.dreb_share, PCT(av.dreb_share)] ] },
      { title: "Creación de juego", trailing: _creationNote(data.standard), metrics: [
        [_hint("AS/pos", "Asistencias por posesión propia (posesión = T2i + T3i + 0,44 × TLi + PER − RO)"),
         "as_pos", av.as_pos, DEC2(av.as_pos)],
        [_hint("% asistencias del equipo", "Asistencias del jugador sobre las del equipo en los partidos que disputó"),
         "ast_team_share", null, "—"],
        [_hint("Puntos generados", "2 × asistencias a tiros de 2 + 3 × asistencias a tiros de 3. Los tiros libres no suman: no se sabe cuántos de la serie entraron"),
         "ast_points", null, "—"],
        [_hint("Puntos por asistencia", "Puntos generados dividido por las asistencias a tiros de campo"),
         "pts_per_ast", null, "—"],
        [_hint("Segundos de posesión", "Duración media de las posesiones que terminó el jugador"),
         "player_poss_duration", null, "—"] ] },
      { title: "Defensa avanzada", metrics: [
        ["Robos", "stl", av.stl, DEC2(av.stl)], ["Tapones", "blk", av.blk, DEC2(av.blk)],
        ["Stops", "stocks", av.stocks, DEC2(av.stocks)],
        ["Def Playmaking", "def_playmaking", av.def_playmaking, DEC2(av.def_playmaking)],
        ["DEF/TO Ratio", "def_to_ratio", av.def_to_ratio, DEC2(av.def_to_ratio)],
        ["Impacto Físico", "physical_impact", av.physical_impact, DEC2(av.physical_impact)] ] },
    ];
    _playerCardGroups = PLAYER_CARD_GROUPS;
    main.innerHTML = `
      <div id="player-identity"></div>
      ${comps.length > 1 ? `
      <div class="card">
        <select id="player-comp" class="map-select">${_compOptions(comps, _playerComp, "Todas las competencias", "all")}</select>
      </div>` : ""}
      ${_selectionNote(data, ["jugador", "jugadores"])}
      ${PLAYER_CARD_GROUPS.map((g, i) => `
      <div class="card">
        <div class="card-title">${g.title}</div>
        <div class="stat-grid metric-card-grid" data-mc-group="${i}">${_fichaGridHTML(g.metrics, "player", null, data.player_id)}</div>
        ${g.trailing ? `<div class="stat-grid">${g.trailing}</div>` : ""}
        ${g.extra || ""}
      </div>`).join("")}
      <div class="chart-grid">
        <div class="card">
          <div class="card-title">Perfil de jugador</div>
          ${radarOk ? '<div class="radar-wrap"><canvas id="chart-player-radar"></canvas></div>'
                    : `<p class="empty">${_radarMsg(data)}</p>`}
        </div>
        <div class="card">
          <div class="card-title">Evolución por partido</div>
          <canvas id="chart-player-evo" height="200"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Conjunto estándar</div>
        <div id="player-standard-panel"></div>
      </div>
      <div id="player-origins"></div>
      <div id="player-transition"></div>
      <div id="player-second-chance"></div>
      <div class="card">
        <div class="card-title">Game log — ${playerName}</div>
        <div id="player-gamelog-dt"></div>
      </div>`;
    if (radarOk) drawRadar("chart-player-radar", av, lg, playerName);
    drawPlayerEvolution("chart-player-evo", log, lg?.oer?.avg);
    _loadPlayerGameLog(data.player_id);
    _mountShotDetailExports(main, playerName, String(data.player_id ?? ""), _playerCompLabel());

    if (comps.length > 1) {
      document.getElementById("player-comp").addEventListener("change", e => {
        _playerComp = e.target.value;
        _reloadPlayer();
      });
    }

    // Shot chart — async, non-blocking (C-03: usa api.shotZones + shotChart)
    api.shotZones({ entity: 'player', id: data.player_id, competition: _playerComp }).then(shots => {
      if (!shots || !shots.summary?.total_shots) return;
      const shotCard = document.createElement("div");
      shotCard.className = "card";
      shotCard.innerHTML = `
        <div class="card-title">Shot chart por zonas <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName}</span></div>
        ${shotChart(shots)}`;
      main.insertBefore(shotCard, main.querySelector(".chart-grid"));
      bindZoneTooltips(shotCard, shots);
    }).catch(() => {});
  }
}

// Game log de jugador migrado a createDataTable (player_game_log). Respeta competencia
// y base elegida (T-D8); los DNP vienen como filas con métricas nulas razón `dnp`.
function _loadPlayerGameLog(playerId) {
  const el = document.getElementById("player-gamelog-dt");
  if (!el || playerId == null) return;
  const compParam = (_playerComp && _playerComp !== "all") ? _playerComp : null;
  mountTable(el,
    () => api.table("player_game_log", { player_id: playerId, competition: compParam, ...contextParams(), base: getBase() }),
    { tableId: "player_game_log" });
}

function _playerCompLabel() {
  const sel = document.getElementById("player-comp");
  if (sel && sel.selectedOptions[0] && _playerComp !== "all") return sel.selectedOptions[0].textContent;
  return "";
}

// ── Search section (T-06: migrada a createDataTable con rowFilter) ─────────────
let _searchComp = "";   // id de competencia del último fetch ("" = todas)
let _searchTable = null;        // handle de createDataTable
let _searchPayload = null;      // payload actual (para el mapa de índices de columnas)
let _searchColIdx = {};         // key → índice en payload.columns

// Grupos de posición del filtro: PG/SG/G → G, SF/PF/F → F, C → C.
const POSITION_GROUPS = [["G", "Base/Escolta (G)"], ["F", "Alero/Ala-pívot (F)"], ["C", "Pívot (C)"]];
function _posGroup(pos) {
  const p = String(pos || "").toUpperCase();
  if (!p) return null;
  if (p === "C") return "C";
  if (p.includes("F")) return "F";
  if (p.includes("G")) return "G";
  return null;
}

const SEARCH_METRICS = [
  { key: "efg_pct", label: "eFG%", pct: true }, { key: "ts_pct", label: "TS%", pct: true },
  { key: "oer", label: "OER" }, { key: "uso_pct", label: "USO%", pct: true },
  { key: "ppp", label: "PPP" }, { key: "ppt", label: "PPT" },
  { key: "fg2_pct", label: "FG2%", pct: true }, { key: "fg3_pct", label: "FG3%", pct: true },
  { key: "ft_pct", label: "FT%", pct: true },
  { key: "pts", label: "Pts/g" }, { key: "ast", label: "Ast/g" }, { key: "tov", label: "Pérd/g" },
  { key: "stl", label: "Robos/g" }, { key: "blk", label: "Tapas/g" },
  { key: "reb_share", label: "% Reb Eq", pct: true },
  { key: "oreb_share", label: "% RebOf Eq", pct: true }, { key: "dreb_share", label: "% RebDef Eq", pct: true },
  { key: "minutes", label: "Min" }, { key: "plus_minus", label: "+/-" },
];

// Equipos del plantel (para el select de equipo): se leen de la columna _team del payload.
function _searchTeams() {
  if (!_searchPayload) return [];
  const idx = _searchColIdx["_team"];
  if (idx == null) return [];
  return [...new Set(_searchPayload.rows.map(r => r.values[idx]).filter(Boolean))].sort();
}

async function _loadSearchPayload() {
  _searchPayload = await api.table("search_players", { competition: _searchComp || null });
  _searchColIdx = {};
  _searchPayload.columns.forEach((c, i) => { _searchColIdx[c.key] = i; });
  return _searchPayload;
}

async function renderSearch() {
  const main = document.getElementById("search-main");
  if (!_searchPayload) {
    main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando buscador...</p>';
    try { await _loadSearchPayload(); }
    catch (e) {
      if (navigator.onLine === false || e instanceof TypeError) main.innerHTML = `<p class="empty below-avg">Sin conexión. No se pudo cargar el buscador.</p>`;
      else main.innerHTML = `<p class="empty below-avg">${e.message || "No se pudo cargar el buscador"}</p>`;
      return;
    }
  }
  if (!_searchPayload.rows.length && !_searchComp) { main.innerHTML = `<p class="empty">No hay jugadores importados todavía</p>`; return; }

  const comps = await api.competitions().catch(() => []);
  const teams = _searchTeams();

  main.innerHTML = `
    <div class="card">
      <div class="card-title">Buscador de jugadores</div>
      <div class="search-filters">
        <input type="text" id="sf-name" placeholder="Nombre contiene...">
        <select id="sf-team"><option value="">Equipo (todos)</option>${teams.map(t=>`<option>${t}</option>`).join("")}</select>
        <select id="sf-comp"><option value="">Competencia (todas)</option>${comps.map(c=>`<option value="${c.id}"${String(c.id) === _searchComp ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        <select id="sf-pos"><option value="">Posición (todas)</option>${POSITION_GROUPS.map(([v, l])=>`<option value="${v}">${l}</option>`).join("")}</select>
      </div>
      <div class="search-ranges">
        ${SEARCH_METRICS.map(m => `
          <div class="range-filter">
            <span>${m.label}</span>
            <input type="number" step="any" class="sf-min" data-key="${m.key}" data-pct="${m.pct?1:0}" placeholder="mín">
            <input type="number" step="any" class="sf-max" data-key="${m.key}" data-pct="${m.pct?1:0}" placeholder="máx">
          </div>`).join("")}
      </div>
      <div class="search-actions">
        <button class="btn" id="sf-apply">Buscar</button>
        <button class="btn btn-ghost" id="sf-clear">Limpiar</button>
        <span id="sf-count" class="td-muted"></span>
      </div>
    </div>
    <div id="search-results"></div>`;

  const box = document.getElementById("search-results");
  _searchTable = createDataTable(box, {
    tableId: "search_players",
    payload: _searchPayload,
    onRowClick: row => {
      // id del payload = player_id; el nombre/equipo salen de las columnas de texto.
      const name = row.values[_searchColIdx["_name"]];
      const team = row.values[_searchColIdx["_team"]];
      setSection("player");
      renderPlayer(team, name, Number(row.id) || null);
    },
  });

  document.getElementById("sf-apply").addEventListener("click", _applySearch);
  // Cambiar de competencia recalcula los promedios en el backend (RF-7)
  document.getElementById("sf-comp").addEventListener("change", async e => {
    _searchComp = e.target.value;
    box.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando buscador...</p>';
    try { await _loadSearchPayload(); }
    catch { box.innerHTML = '<p class="empty below-avg">No se pudo cargar el buscador</p>'; return; }
    renderSearch();
  });
  document.getElementById("sf-clear").addEventListener("click", async () => {
    main.querySelectorAll(".search-filters input, .search-ranges input").forEach(i => i.value = "");
    main.querySelectorAll(".search-filters select").forEach(s => s.value = "");
    if (_searchComp) {   // volver a "todas las competencias"
      _searchComp = "";
      try { await _loadSearchPayload(); } catch { return; }
      renderSearch();
      return;
    }
    _applySearch();
  });
  _applySearch();
}

function _applySearch() {
  if (!_searchTable) return;
  const name = document.getElementById("sf-name").value.trim().toLowerCase();
  const team = document.getElementById("sf-team").value;
  const pos  = document.getElementById("sf-pos").value;
  const ranges = [];
  document.querySelectorAll(".sf-min").forEach(inp => {
    if (inp.value.trim() === "") return;
    const pct = inp.dataset.pct === "1";
    ranges.push({ key: inp.dataset.key, op: "min", val: pct ? parseFloat(inp.value)/100 : parseFloat(inp.value) });
  });
  document.querySelectorAll(".sf-max").forEach(inp => {
    if (inp.value.trim() === "") return;
    const pct = inp.dataset.pct === "1";
    ranges.push({ key: inp.dataset.key, op: "max", val: pct ? parseFloat(inp.value)/100 : parseFloat(inp.value) });
  });

  const nameIdx = _searchColIdx["_name"], teamIdx = _searchColIdx["_team"], posIdx = _searchColIdx["_position"];
  const rowFilter = row => {
    const v = row.values;
    if (name && !String(v[nameIdx] || "").toLowerCase().includes(name)) return false;
    if (team && v[teamIdx] !== team) return false;
    if (pos && _posGroup(v[posIdx]) !== pos) return false;   // sin posición no entra en ninguno
    for (const r of ranges) {
      const idx = _searchColIdx[r.key];
      const val = idx != null ? v[idx] : null;
      if (val == null) return false;               // null no matchea rango (Feature 08)
      if (r.op === "min" && val < r.val) return false;
      if (r.op === "max" && val > r.val) return false;
    }
    return true;
  };

  // Etiquetas de filtros locales para la cabecera de exportación.
  const labels = [];
  if (name) labels.push({ label: "Nombre contiene", value: name });
  if (team) labels.push({ label: "Equipo", value: team });
  if (pos) labels.push({ label: "Posición", value: (POSITION_GROUPS.find(g => g[0] === pos) || [, pos])[1] });
  for (const r of ranges) {
    const m = SEARCH_METRICS.find(x => x.key === r.key);
    labels.push({ label: `${m ? m.label : r.key} ${r.op === "min" ? "≥" : "≤"}`, value: m?.pct ? `${(r.val * 100).toFixed(1)}%` : r.val });
  }

  _searchTable.setRowFilter(rowFilter, labels);
  const count = _searchTable.getState().rows.length;
  document.getElementById("sf-count").textContent = `${count} jugadores`;
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
const NAV_ITEMS = {
  import:  { icon: "📥", label: "Importar" },
  league:  { icon: "🏆", label: "Liga" },
  team:    { icon: "📊", label: "Equipo" },
  compare: { icon: "⚡", label: "Comparar" },
  player:  { icon: "👤", label: "Jugador" },
  search:  { icon: "🔎", label: "Buscar" },
  preparar: { icon: "📋", label: "Preparar" },
  partido: { icon: "🏀", label: "Partido" },
};

// ── F-07: Analizar partido ──────────────────────────────────────────────────
function showGame(gameId) {
  destroyLiveView();
  setSection("partido");
  renderGameView(document.getElementById("partido-main"), gameId);
}

// ── F-01: Partido en vivo ──────────────────────────────────────────────────
function showLiveGame(gameId, url = null) {
  setSection("partido");
  renderLiveView(document.getElementById("partido-main"), gameId, { url });
}

// URL de FIBA LiveStats (…/u/LIGA/<id>/bs.html) o id numérico suelto.
function _liveTarget(input) {
  const s = input.trim();
  if (/^\d{5,}$/.test(s)) return { id: s, url: null };
  const m = /\/(\d{5,})\//.exec(s);
  return m ? { id: m[1], url: s } : null;
}

function renderApp() {
  loadPopulationMinSize();   // para el copy "la población tiene menos de N entidades" (T-01)
  initBase();                // base de normalización de la sesión (T-04)
  initContext();             // filtros de sede / rival / descanso (T-03)
  document.getElementById("app").innerHTML = `
    <header>
      <span class="header-logo">🏀 Smart-Basket</span>
      <span class="header-sub">Basketball Advanced Analytics</span>
      <button class="header-gear" id="btn-config" aria-label="Configuración" title="Configuración">⚙</button>
      ${_authRequired ? `<span class="header-user">${_authUser || ""} · <button class="header-logout" id="btn-logout">Salir</button></span>` : ""}
    </header>
    <nav>
      ${sections.filter(s => s !== "config" && s !== "partido").map(s => `
        <button data-section="${s}">
          <span class="nav-icon">${NAV_ITEMS[s].icon}</span>
          ${NAV_ITEMS[s].label}
        </button>`).join("")}
    </nav>
    <main>
      <div class="section" id="sec-import"></div>
      <div class="section" id="sec-league"></div>

      <!-- Team -->
      <div class="section" id="sec-team">
        <div class="card">
          <div class="team-controls">
            <select id="team-select"><option value="">— Seleccionar equipo —</option></select>
            <select id="player-select"><option value="">— Seleccionar jugador —</option></select>
            <button class="btn btn-ghost" id="btn-show-player">Ver jugador</button>
            <button class="btn btn-ghost" id="btn-show-shotmap">Ver mapa de tiro</button>
            <button class="btn btn-ghost" id="btn-show-onoff">Ver ON/OFF</button>
          </div>
          <div class="filter-pills" id="team-filter-pills" style="display:none;margin-top:12px">
            <span style="color:var(--muted);font-size:12px;align-self:center;margin-right:4px">Período:</span>
            <button class="filter-pill active" data-n="0">Todos</button>
            <button class="filter-pill" data-n="5">Últ. 5</button>
            <button class="filter-pill" data-n="3">Últ. 3</button>
          </div>
          <span id="team-comp-wrap" style="display:none;margin-top:12px">
            <select id="team-comp" class="map-select"></select>
          </span>
        </div>
        <div id="team-teamshot"></div>
        <div id="team-shotmap"></div>
        <div id="team-onoff"></div>
        <div class="card" id="team-lineup-card" style="display:none">
          <div class="card-title">Combinaciones (Lineups)</div>
          <p class="td-muted">Elegí entre 3 y 5 jugadores para ver el rendimiento del equipo cuando comparten cancha.</p>
          <div class="lineup-picker" id="team-lineup-picker"></div>
          <button class="btn btn-ghost" id="btn-analyze-lineup" style="margin-top:12px">Analizar combinación</button>
        </div>
        <div id="team-lineup"></div>
        <div id="team-main"></div>
        <div id="team-roster"></div>
        <div id="team-lineups-block"></div>
        <div id="team-periods"></div>
        <div id="team-origins"></div>
        <div id="team-transition"></div>
        <div id="team-second-chance"></div>
        <div id="team-clock"></div>
        <div id="team-clutch"></div>
      </div>

      <!-- Compare -->
      <div class="section" id="sec-compare">
        <div class="cmp-tabs">
          <button class="filter-pill cmp-tab active" data-cmp="equipos">Equipos</button>
          <button class="filter-pill cmp-tab" data-cmp="jugadores">Jugadores</button>
        </div>
        <div id="cmp-pane-equipos">
        <div class="card">
          <div class="card-title">Comparar equipos</div>
          <div class="compare-controls">
            <select id="compare-a"><option value="">— Equipo A —</option></select>
            <select id="compare-b"><option value="">— Equipo B —</option></select>
            <select id="compare-comp" style="display:none"><option value="">Todas las competencias</option></select>
            <button class="btn" id="btn-compare">Comparar</button>
          </div>
        </div>
        <div id="compare-result"></div>
        </div>
        <div id="cmp-pane-jugadores" style="display:none"></div>
      </div>

      <!-- Player -->
      <div class="section" id="sec-player">
        <div id="player-main"><p class="empty">Selecciona un jugador desde la vista de equipo.</p></div>
      </div>

      <!-- Search -->
      <div class="section" id="sec-search">
        <div id="search-main"><p class="empty"><span class="spinner"></span>Cargando buscador...</p></div>
      </div>

      <!-- Preparar partido (F-03) -->
      <div class="section" id="sec-preparar">
        <div id="preparar-main"></div>
      </div>

      <!-- Partido (F-07) -->
      <div class="section" id="sec-partido">
        <div id="partido-main"><p class="empty">Selecciona un partido desde el catálogo.</p></div>
      </div>

      <!-- Config (F-13) -->
      <div class="section" id="sec-config"></div>
    </main>`;

  // Nav clicks
  document.querySelectorAll("nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      setSection(btn.dataset.section);
      if (btn.dataset.section === "import")  renderImport();
      if (btn.dataset.section === "league")  renderLeague();
      if (btn.dataset.section === "team")    refreshTeamSelector();
      if (btn.dataset.section === "compare") renderCompare();
      if (btn.dataset.section === "search")  renderSearch();
      if (btn.dataset.section === "preparar") renderPrepare(document.getElementById("preparar-main"), { onOpenGame: showGame });
    });
  });

  // Team selector
  const teamSel = document.getElementById("team-select");
  teamSel.addEventListener("change", () => {
    // limpiar apartados del equipo anterior (mapas de tiro, ON/OFF, lineup, cierres)
    ["team-teamshot", "team-shotmap", "team-onoff", "team-lineup", "team-clutch"].forEach(id => {
      const box = document.getElementById(id);
      if (box) box.innerHTML = "";
    });
    if (teamSel.value) renderTeam(teamSel.value);
  });

  // Player button
  document.getElementById("btn-show-player").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = _selectedPlayer();
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    setSection("player");
    renderPlayer(team, player.name, player.id);
  });

  // Shot map button — muestra el mapa de tiro DENTRO de Equipo
  document.getElementById("btn-show-shotmap").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = _selectedPlayer();
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    renderTeamShotmap(team, player.name);
  });

  // ON/OFF button
  document.getElementById("btn-show-onoff").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = _selectedPlayer();
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    renderTeamOnOff(team, player.name, player.id);
  });

  // Lineup (combinación) button
  document.getElementById("btn-analyze-lineup").addEventListener("click", () => {
    const team = document.getElementById("team-select").value;
    if (!team) return toast("Selecciona un equipo", "err");
    const checkedEls = Array.from(document.querySelectorAll("#team-lineup-picker input:checked"));
    const checked = checkedEls.map(el => el.value);
    const checkedIds = checkedEls.map(el => Number(el.dataset.playerId)).filter(id => Number.isFinite(id));
    if (checked.length < 3 || checked.length > 5) return toast("Elegí entre 3 y 5 jugadores", "err");
    renderTeamLineup(team, checked, checkedIds);
  });

  // Last-N filter pills
  document.getElementById("team-filter-pills").addEventListener("click", e => {
    const pill = e.target.closest(".filter-pill");
    if (!pill || !_teamData) return;
    const n = parseInt(pill.dataset.n, 10);
    _teamLastN = n;
    _reloadTeam();   // el servidor recalcula la selección; el `Ø` de liga no cambia (C-02 RF-1)
  });

  // Competition filter (compone con las pills Últ. N)
  document.getElementById("team-comp").addEventListener("change", e => {
    if (!_teamData) return;
    _teamComp = e.target.value;
    _reloadTeam({ clutch: true });   // los cierres también dependen de la competencia
  });

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try { await api.logout(); } catch {}
      showLogin("Sesión cerrada.");
    });
  }

  document.getElementById("btn-config").addEventListener("click", () => {
    setSection("config");
    renderConfig();
  });

  // Una dirección con dos jugadores abre directamente Comparar › Jugadores (F-05 RF-8).
  if (comparePlayersFromUrl()) {
    renderCompare();
    return;
  }
  setSection("import");
  renderImport();
}

// ── Config screen (F-13) ─────────────────────────────────────────────────────

async function renderConfig() {
  const sec = document.getElementById("sec-config");
  sec.innerHTML = `<div class="card"><div class="card-title">Configuración
    <button class="btn btn-ghost btn-back-config" id="btn-config-back">← Volver</button></div>
    <div id="config-body"><p class="empty"><span class="spinner"></span>Cargando configuración…</p></div>
  </div>
  <div id="config-calibrate-card"></div>`;
  document.getElementById("btn-config-back").addEventListener("click", () => {
    setSection(_lastSection !== "config" ? _lastSection : "import");
  });
  try {
    const data = await api.settings();
    renderSettingsForm(document.getElementById("config-body"), data, {
      onSave: async (values) => {
        const result = await api.saveSettings(values);
        toast("Configuración guardada. Los cálculos ya usan los valores nuevos.");
        _teamData = null; _clutchData = null;
        renderSettingsForm(document.getElementById("config-body"), result, { onSave: arguments.callee, onReset: arguments[1] });
        renderConfig();
      },
      onReset: async (body) => {
        const result = await api.resetSettings(body);
        toast("Valores restablecidos.");
        _teamData = null; _clutchData = null;
        renderConfig();
      },
    });
    renderCalibrationCard(document.getElementById("config-calibrate-card"));
  } catch (e) {
    const msg = e.message && e.message.includes("fetch") ? "Sin conexión: la configuración no está disponible."
      : `No se pudo cargar la configuración. ${e.message}`;
    document.getElementById("config-body").innerHTML = `<p class="empty">${msg}</p>
      <button class="btn btn-ghost" id="btn-config-retry">Reintentar</button>`;
    document.getElementById("btn-config-retry").addEventListener("click", () => renderConfig());
  }
}

// ── Calibración de K (T-02) ──────────────────────────────────────────────────
// Sección extra fuera del formulario genérico de settings-form.js (que renderiza
// solo desde el catálogo F-13): solo admins la ven. Decisión de diseño: un único
// selector de entidad (lineup/onoff) + un selector de competencia propio (no hay
// selector de competencia reusable en la vista Configuración), en vez de dos
// botones separados — más simple de mantener y de usar.
async function renderCalibrationCard(el) {
  if (!el) return;
  if (!_isAdmin) { el.innerHTML = ""; return; }

  let comps = [];
  try { comps = await api.competitions(true); } catch { comps = []; }

  el.innerHTML = `
    <div class="card">
      <div class="card-title">Calibrar K con los datos cargados</div>
      <p class="td-muted">Sugiere el factor de regresión (K) a partir de la correlación entre mitades de temporada de la competencia elegida.</p>
      <div class="modal-field">
        <label for="calib-entity">Entidad</label>
        <select id="calib-entity">
          <option value="lineup">Combinación (lineup)</option>
          <option value="onoff">ON/OFF</option>
        </select>
      </div>
      <div class="modal-field">
        <label for="calib-comp">Competencia</label>
        <select id="calib-comp">${_compOptions(comps, comps.find(c => c.is_default)?.id ?? "", "Elegí una competencia", "")}</select>
      </div>
      <button class="btn" id="btn-calibrate">Calibrar con los datos cargados</button>
      <div id="calib-result" style="margin-top:8px"></div>
    </div>`;

  document.getElementById("btn-calibrate").addEventListener("click", async () => {
    const entity = document.getElementById("calib-entity").value;
    const compId = document.getElementById("calib-comp").value;
    const resultEl = document.getElementById("calib-result");
    if (!compId) { resultEl.innerHTML = `<p class="empty below-avg">Elegí una competencia.</p>`; return; }

    const btn = document.getElementById("btn-calibrate");
    btn.disabled = true;
    resultEl.innerHTML = `<p class="empty"><span class="spinner"></span>Calibrando…</p>`;
    try {
      const r = await api.calibrate(entity, Number(compId));
      const warnings = r.warnings || [];
      if (warnings.includes("muestra_insuficiente")) {
        resultEl.innerHTML = `<p class="empty below-avg">No hay unidades suficientes para calibrar en esta competencia</p>`;
      } else if (warnings.includes("correlacion_no_positiva")) {
        resultEl.innerHTML = `<p class="empty below-avg">La correlación entre mitades no es positiva: no se sugiere K</p>`;
      } else if (r.k_suggested != null) {
        resultEl.innerHTML = `
          <p class="td-muted">K sugerido: ${r.k_suggested} (r = ${r.r} · ${r.units} unidades · ${r.n_half_mean} pos por mitad)</p>
          <button class="btn btn-sm" id="btn-calibrate-apply">Aplicar</button>`;
        document.getElementById("btn-calibrate-apply").addEventListener("click", async () => {
          const applyBtn = document.getElementById("btn-calibrate-apply");
          applyBtn.disabled = true;
          try {
            await api.saveSettings({ [r.config_key]: Math.round(r.k_suggested) });
            toast("K actualizado");
            _teamData = null; _clutchData = null;
            renderConfig();
          } catch (e) {
            toast(e.message || "No se pudo aplicar el valor sugerido", "err");
            applyBtn.disabled = false;
          }
        });
      } else {
        resultEl.innerHTML = `<p class="empty">No se pudo sugerir un valor de K para esta selección.</p>`;
      }
    } catch (e) {
      if (e.status === 403 || e.code === "requiere_admin") {
        resultEl.innerHTML = `<p class="empty below-avg">Necesitás permisos de administrador</p>`;
      } else if (e.status === 401) {
        resultEl.innerHTML = `<p class="empty below-avg">Sesión expirada. Iniciá sesión de nuevo.</p>`;
      } else if (e.status === 400) {
        resultEl.innerHTML = `<p class="empty below-avg">${e.message || "No se pudo calibrar con los parámetros elegidos"}</p>`;
      } else {
        resultEl.innerHTML = `<p class="empty below-avg">${e.message || "No se pudo calibrar"}</p>`;
      }
    } finally {
      btn.disabled = false;
    }
  });
}


// ── Login screen ─────────────────────────────────────────────────────────────
function showLogin(message = "") {
  document.getElementById("app").innerHTML = `
    <div class="login-wrap">
      <form class="login-card" id="login-form">
        <div class="login-logo">🏀 Smart-Basket</div>
        <div class="login-sub">Ingresá para continuar</div>
        ${message ? `<div class="login-msg">${message}</div>` : ""}
        <input id="login-user" type="text" placeholder="Usuario" autocomplete="username" required />
        <input id="login-pass" type="password" placeholder="Contraseña" autocomplete="current-password" required />
        <button class="btn" type="submit" id="login-btn">Entrar</button>
        <div class="login-err" id="login-err"></div>
      </form>
    </div>`;
  const form  = document.getElementById("login-form");
  const errEl = document.getElementById("login-err");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const user     = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value;
    const btn      = document.getElementById("login-btn");
    errEl.textContent = "";
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Entrando...';
    try {
      await api.login(user, password);
      boot();  // re-check session and build the app
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
  document.getElementById("login-user").focus();
}

async function boot() {
  setUnauthorizedHandler(() => showLogin("Sesión expirada. Iniciá sesión de nuevo."));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  let me;
  try { me = await api.me(); }
  catch { me = { authenticated: false, auth_required: false, seed_enabled: false, is_admin: false }; }
  _authRequired = me.auth_required === true;
  _authUser     = me.user || null;
  _seedEnabled  = me.seed_enabled === true;
  _isAdmin      = me.is_admin === true;

  if (_authRequired && !me.authenticated) {
    showLogin();
  } else {
    renderApp();
  }
}

boot();
