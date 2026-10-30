// ── Tabla completa (T-06) ─────────────────────────────────────────────────────
// Componente único: ordena, pagina, oculta columnas, colorea por percentil, muestra
// totales y promedio de competencia, y expone getState() para la exportación. NINGÚN
// número se calcula acá (RF-20): todo viene del payload de /api/table/<id>.

import { fmtMetric, nullDisplay, NULL_REASON_LABELS, cmpNullsLast, DEC2 } from "../core/format.js";
import { metricLabel, metricDef, groupsFor } from "../core/catalog.js";
import { percentileBg } from "../core/colors.js";
import { getPref, setPref } from "../core/prefs.js";
import { sampleBadge } from "./sample-badge.js";
import { exportMenu } from "./export-menu.js";
import { api } from "../api.js";

let _pageSize = 50;   // cache de table.page_size (una lectura por sesión)
let _pageSizeLoaded = false;
async function _loadPageSize() {
  if (_pageSizeLoaded) return _pageSize;
  try {
    const s = await api.settings();
    const v = s?.values?.["table.page_size"];
    const n = typeof v === "object" ? v?.value : v;
    if (n != null && Number(n) > 0) _pageSize = Number(n);
  } catch { /* usa el default 50 */ }
  _pageSizeLoaded = true;
  return _pageSize;
}

function _escHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const _isMobile = () => window.matchMedia && window.matchMedia("(max-width: 767px)").matches;

// Etiqueta de una columna: value/text la traen inline; metric sale del catálogo.
function _colLabel(col) {
  if (col.type === "metric") return metricLabel(col.key);
  return col.label || col.key;
}

// fmt de una columna para la exportación (CSV/XLSX).
function _colFmt(col) {
  if (col.type === "text") return "text";
  if (col.fmt) return col.fmt;
  return metricDef(col.key)?.fmt || "dec2";
}

// Dirección de una columna (para color y orden inicial). Las métricas neutrales no se colorean.
function _isNeutral(col) {
  if (col.type !== "metric") return true;
  const dir = metricDef(col.key)?.direction;
  return dir == null || dir === "neutral";
}

// `collapsedRows`: la tabla arranca mostrando solo las primeras N filas, con "Ver todos" para extenderla (y
// "Ver menos" para volver a acortarla); el orden, la exportación y las filas tocables no cambian.
export function createDataTable(el, {
  tableId, payload, onRowClick, rowFilter, filterLabels, title, exportFormats, collapsedRows,
} = {}) {
  const _collapsedRows = Number(collapsedRows) > 0 ? Number(collapsedRows) : 0;
  let collapsed = _collapsedRows > 0;
  let _payload = payload;
  let _rowFilter = rowFilter;
  let _filterLabels = filterLabels || [];

  // ── Estado (paso 1) ────────────────────────────────────────────────────────
  let visible = _initVisible();
  let sort = getPref("table.sort", tableId, null) || (_payload?.default_sort ? { key: _payload.default_sort.key, dir: _payload.default_sort.dir } : null);
  let colorize = getPref("table.colorize", tableId, true);
  let page = 0;
  let showAll = false;
  let _colPanel = null;
  const _listeners = [];

  function _initVisible() {
    if (!_payload) return [];
    const saved = getPref("table.columns", tableId, null);
    const allKeys = _payload.columns.map(c => c.key);
    if (Array.isArray(saved) && saved.length) {
      const filtered = saved.filter(k => allKeys.includes(k));
      // La columna fija siempre visible
      const sticky = _payload.columns.find(c => c.sticky);
      if (sticky && !filtered.includes(sticky.key)) filtered.unshift(sticky.key);
      if (filtered.length) return filtered;
    }
    return _payload.columns.filter(c => c.default_visible).map(c => c.key);
  }

  // Columnas visibles como objetos, en el orden del payload.
  function _visibleCols() {
    return _payload.columns.filter(c => visible.includes(c.key));
  }
  function _colByKey(k) { return _payload.columns.find(c => c.key === k); }
  function _colIndex(k) { return _payload.columns.findIndex(c => c.key === k); }

  // ── Orden (paso 2) ──────────────────────────────────────────────────────────
  function _sortValue(row, col) {
    const idx = _colIndex(col.key);
    if (idx < 0) return null;
    // Valor ajustado si el payload lo pide y existe (T-02)
    if (_payload.default_sort?.use_adjusted && row.adj && row.adj[col.key] != null) {
      const a = row.adj[col.key];
      return typeof a === "object" ? a.value : a;
    }
    return row.values[idx];
  }

  // T-02: al ordenar por una métrica de rendimiento, las filas de muestra baja van siempre al final
  // (no entran en rankings, pero tampoco se ocultan). Las columnas de texto y de tamaño de muestra
  // (partidos, minutos, posesiones) ordenan sin esa separación: ahí la muestra ES el dato.
  const SAMPLE_KEYS = new Set(["games", "minutes", "possessions", "_sample"]);
  function _lowSampleLast(col) {
    return col.type === "metric" && !SAMPLE_KEYS.has(col.key)
      && _payload.rows.some(r => r.sample && r.sample.ranked === false);
  }

  function _sortedRows() {
    let rows = _payload.rows.slice();
    if (typeof _rowFilter === "function") {
      rows = rows.filter((r, i) => _rowFilter(r, i));
    }
    if (sort) {
      const col = _colByKey(sort.key);
      const dir = sort.dir === "asc" ? 1 : -1;
      if (col) {
        const lowLast = _lowSampleLast(col);
        const indexed = rows.map((r, i) => [r, i]);
        indexed.sort((A, B) => {
          if (lowLast) {
            const lowA = A[0].sample?.ranked === false ? 1 : 0;
            const lowB = B[0].sample?.ranked === false ? 1 : 0;
            if (lowA !== lowB) return lowA - lowB;
          }
          const c = cmpNullsLast(_sortValue(A[0], col), _sortValue(B[0], col), dir);
          return c !== 0 ? c : A[1] - B[1];   // desempate estable por índice
        });
        rows = indexed.map(x => x[0]);
      }
    }
    return rows;
  }

  // ── Cabecera de exportación (meta + sort + columns_visible + filtros) ────────
  function _exportMeta(sorted, pageRows) {
    const base = _payload.meta || {};
    const sortCol = sort ? _colByKey(sort.key) : null;
    const sortLabel = sortCol ? `${_colLabel(sortCol)} ${sort.dir === "asc" ? "↑" : "↓"}` : null;
    const total = sorted.length;
    const from = showAll || total === 0 ? 1 : page * _pageSize + 1;
    const to = showAll ? total : Math.min((page + 1) * _pageSize, total);
    const vis = _visibleCols();
    return {
      meta: {
        ...base,
        filters: [...(base.filters || []), ...(_filterLabels || [])],
        sort: sort ? { key: sort.key, dir: sort.dir, label: sortLabel } : null,
        columns_visible: vis.map(c => _colLabel(c)),
      },
      pageInfo: total ? `Filas ${from}–${to} de ${total}` : "Sin filas",
    };
  }

  // getData para el export-menu: filas crudas (sin formatear), footer = totales + promedio.
  function _exportData() {
    const sorted = _sortedRows();
    const vis = _visibleCols();
    const { meta, pageInfo } = _exportMeta(sorted);
    const columns = vis.map(c => ({ key: c.key, label: _colLabel(c), fmt: _colFmt(c) }));
    const rows = sorted.map(r => vis.map(c => r.values[_colIndex(c.key)]));
    const footer = [];
    if (_payload.totals) footer.push(vis.map(c => _footVal(_payload.totals, c)));
    if (_payload.competition_avg) footer.push(vis.map(c => _footVal(_payload.competition_avg, c)));
    return { meta, columns, rows, footer, pageInfo };
  }

  function _footVal(footRow, col) {
    const idx = _colIndex(col.key);
    return idx >= 0 ? footRow.values[idx] : null;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function render() {
    if (!_payload) return;
    const vis = _visibleCols();
    const sorted = _sortedRows();
    const total = sorted.length;
    const pageCount = Math.max(1, Math.ceil(total / _pageSize));
    if (page >= pageCount) page = pageCount - 1;
    const short = collapsed && total > _collapsedRows;
    const pageRows = short ? sorted.slice(0, _collapsedRows)
      : showAll ? sorted : sorted.slice(page * _pageSize, (page + 1) * _pageSize);

    el.innerHTML = `
      ${_toolbarHTML(total)}
      <div class="dt-table-wrap">
        <table class="dt-table search-table">
          <thead>${_theadHTML(vis)}</thead>
          <tbody>${pageRows.map(r => _rowHTML(r, vis)).join("")}</tbody>
          ${_tfootHTML(vis)}
        </table>
      </div>
      ${_pagerHTML(total, pageCount, short)}`;

    _bindToolbar();
    _bindHead();
    _bindRows(pageRows);
    _bindPager(pageCount);
    _mountExport();
  }

  function _toolbarHTML(total) {
    return `
      <div class="dt-toolbar">
        <button class="btn btn-ghost btn-sm dt-cols-btn" type="button">Columnas</button>
        <label class="dt-color-toggle"><input type="checkbox" class="dt-colorize" ${colorize ? "checked" : ""}> Colores</label>
        <span class="dt-export"></span>
        <span class="dt-count td-muted">${total} fila${total === 1 ? "" : "s"}</span>
      </div>`;
  }

  function _theadHTML(vis) {
    const ths = vis.map(c => {
      const isSort = sort && sort.key === c.key;
      const dirCls = isSort ? (sort.dir === "asc" ? "dt-sort-asc" : "dt-sort-desc") : "";
      const ariaSort = isSort ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
      const stickyCls = c.sticky ? "dt-sticky" : "";
      const label = _escHtml(_colLabel(c));
      const arrow = isSort ? (sort.dir === "asc" ? " ↑" : " ↓") : "";
      return `<th class="${dirCls} ${stickyCls}" data-key="${_escHtml(c.key)}" aria-sort="${ariaSort}" scope="col">${label}${arrow}</th>`;
    }).join("");
    return `<tr>${ths}</tr>`;
  }

  function _rowHTML(row, vis) {
    const low = row.sample && row.sample.level === "baja";
    const lowAttr = low ? ` class="dt-row-low" title="Muestra baja: fuera de rankings"` : "";
    const cursor = (onRowClick || row.link) ? ' style="cursor:pointer"' : "";
    const cells = vis.map(c => _cellHTML(row, c)).join("");
    return `<tr${lowAttr}${cursor} data-id="${_escHtml(row.id)}">${cells}</tr>`;
  }

  function _cellHTML(row, col) {
    const idx = _colIndex(col.key);
    const v = idx >= 0 ? row.values[idx] : null;
    const stickyCls = col.sticky ? "dt-sticky" : "";

    // Badge de muestra
    if (col.key === "_sample") {
      return `<td class="${stickyCls}">${row.sample ? sampleBadge(row.sample, { compact: true }) : ""}</td>`;
    }
    // Texto / value crudo
    if (col.type === "text") {
      return `<td class="${stickyCls}">${_escHtml(v == null ? "" : v)}</td>`;
    }
    if (col.type === "value") {
      if (v == null) {
        const reason = row.reasons?.[col.key];
        return `<td class="${stickyCls}">${nullDisplay(reason)}</td>`;
      }
      return `<td class="${stickyCls}">${_escHtml(v)}</td>`;
    }
    // Métrica
    if (v == null) {
      const reason = row.reasons?.[col.key];
      return `<td class="${stickyCls}">${nullDisplay(reason)}</td>`;
    }
    const pct = idx >= 0 ? row.pct?.[idx] : null;
    const bg = (colorize && pct != null && !_isNeutral(col)) ? percentileBg(pct) : null;
    const style = bg ? ` style="background:${bg}"` : "";
    const title = pct != null ? ` title="p${pct}"` : "";
    let disp = fmtMetric(col.key, v);
    // Valor ajustado debajo (T-02)
    if (row.adj && row.adj[col.key] != null) {
      const a = row.adj[col.key];
      const av = typeof a === "object" ? a.value : a;
      const err = typeof a === "object" ? a.error : null;
      disp += `<div class="dt-adj">aj. ${DEC2(av)}${err != null ? ` ± ${DEC2(err)}` : ""}</div>`;
    }
    return `<td class="${stickyCls}"${style}${title}>${disp}</td>`;
  }

  function _tfootHTML(vis) {
    const rows = [];
    const footRow = (fr) => {
      if (!fr) return "";
      return `<tr class="dt-foot">${vis.map((c, i) => {
        const stickyCls = c.sticky ? "dt-sticky" : "";
        if (i === 0) return `<td class="${stickyCls}">${_escHtml(fr.label || "")}</td>`;
        const idx = _colIndex(c.key);
        const v = idx >= 0 ? fr.values[idx] : null;
        if (v == null) {
          const reason = fr.reasons?.[c.key];
          return `<td class="${stickyCls}">${nullDisplay(reason)}</td>`;
        }
        if (c.type === "text" || c.type === "value") return `<td class="${stickyCls}">${_escHtml(v)}</td>`;
        return `<td class="${stickyCls}">${fmtMetric(c.key, v)}</td>`;
      }).join("")}</tr>`;
    };
    if (_payload.totals) rows.push(footRow(_payload.totals));
    if (_payload.competition_avg) rows.push(footRow(_payload.competition_avg));
    return rows.length ? `<tfoot>${rows.join("")}</tfoot>` : "";
  }

  function _pagerHTML(total, pageCount, short = false) {
    if (short) {
      return `<div class="dt-pager"><button class="btn btn-ghost btn-sm dt-expand" type="button">Ver todos (${total})</button> <span class="td-muted">Mostrando ${_collapsedRows} de ${total}</span></div>`;
    }
    const less = _collapsedRows && total > _collapsedRows
      ? ' <button class="btn btn-ghost btn-sm dt-collapse" type="button">Ver menos</button>' : "";
    if (total <= _pageSize) return less ? `<div class="dt-pager">${less.trim()}</div>` : "";
    if (showAll) {
      return `<div class="dt-pager"><button class="btn btn-ghost btn-sm dt-paginate" type="button">Paginar</button> <span class="td-muted">${total} filas</span>${less}</div>`;
    }
    return `
      <div class="dt-pager">
        <button class="btn btn-ghost btn-sm dt-prev" type="button" ${page === 0 ? "disabled" : ""}>‹ Anterior</button>
        <span class="td-muted">Página ${page + 1} de ${pageCount}</span>
        <button class="btn btn-ghost btn-sm dt-next" type="button" ${page >= pageCount - 1 ? "disabled" : ""}>Siguiente ›</button>
        <button class="btn btn-ghost btn-sm dt-showall" type="button">Ver todas (${total})</button>${less}
      </div>`;
  }

  // ── Bindings ──────────────────────────────────────────────────────────────────
  function _on(node, ev, fn) { if (node) { node.addEventListener(ev, fn); _listeners.push([node, ev, fn]); } }

  function _bindToolbar() {
    _on(el.querySelector(".dt-cols-btn"), "click", _openColPanel);
    _on(el.querySelector(".dt-colorize"), "change", e => {
      colorize = e.target.checked;
      setPref("table.colorize", tableId, colorize).catch(_prefFail);
      render();
    });
  }

  function _bindHead() {
    el.querySelectorAll("thead th").forEach(th => {
      _on(th, "click", () => {
        const key = th.dataset.key;
        const col = _colByKey(key);
        if (!col) return;
        if (sort && sort.key === key) {
          sort = { key, dir: sort.dir === "asc" ? "desc" : "asc" };
        } else {
          // Texto arranca asc; métricas/valores arrancan desc
          sort = { key, dir: (col.type === "text") ? "asc" : "desc" };
        }
        page = 0;
        setPref("table.sort", tableId, sort).catch(_prefFail);
        render();
      });
    });
  }

  function _bindRows(pageRows) {
    const trs = el.querySelectorAll("tbody tr");
    trs.forEach((tr, i) => {
      const row = pageRows[i];
      if (!row) return;
      _on(tr, "click", () => {
        if (onRowClick) return onRowClick(row, _payload);
        if (row.link) _navigate(row.link);
      });
    });
  }

  function _bindPager(pageCount) {
    _on(el.querySelector(".dt-prev"), "click", () => { if (page > 0) { page--; render(); } });
    _on(el.querySelector(".dt-next"), "click", () => { if (page < pageCount - 1) { page++; render(); } });
    _on(el.querySelector(".dt-showall"), "click", () => { showAll = true; render(); });
    _on(el.querySelector(".dt-paginate"), "click", () => { showAll = false; page = 0; render(); });
    _on(el.querySelector(".dt-expand"), "click", () => { collapsed = false; render(); });
    _on(el.querySelector(".dt-collapse"), "click", () => { collapsed = true; showAll = false; page = 0; render(); });
  }

  function _mountExport() {
    const host = el.querySelector(".dt-export");
    if (host) exportMenu(host, { getData: _exportData, getNode: () => el.querySelector(".dt-table-wrap"), formats: exportFormats });
  }

  function _prefFail() {
    _toast("No se pudo guardar tu selección; se usará solo en esta sesión.", "err");
  }

  // ── Selector de columnas (paso 10) ────────────────────────────────────────────
  function _openColPanel() {
    _closeColPanel();
    const groups = groupsFor(_payload.entity_type);
    const allKeys = _payload.columns.map(c => c.key);
    const stickyKey = _payload.columns.find(c => c.sticky)?.key;

    // Columnas de texto/value (fuera del catálogo) en un bloque "Generales".
    const nonMetric = _payload.columns.filter(c => c.type !== "metric");
    const groupBlocks = [];
    if (nonMetric.length) {
      groupBlocks.push({ key: "_general", label: "Generales", keys: nonMetric.map(c => c.key) });
    }
    for (const g of groups) {
      const keys = g.metrics.filter(k => allKeys.includes(k));
      if (keys.length) groupBlocks.push({ key: g.key, label: g.label, keys });
    }

    const body = groupBlocks.map(g => `
      <div class="dt-colgroup">
        <div class="dt-colgroup-title">${_escHtml(g.label)}</div>
        ${g.keys.map(k => {
          const col = _colByKey(k);
          const checked = visible.includes(k) ? "checked" : "";
          const disabled = k === stickyKey ? "disabled" : "";
          return `<label class="dt-colcheck"><input type="checkbox" value="${_escHtml(k)}" ${checked} ${disabled}> ${_escHtml(_colLabel(col))}</label>`;
        }).join("")}
      </div>`).join("");

    const mobile = _isMobile();
    const panel = document.createElement("div");
    panel.className = mobile ? "dt-sheet dt-colpanel" : "dt-colpanel";
    panel.innerHTML = `
      <div class="dt-colpanel-head">
        <strong>Columnas</strong>
        <button class="btn btn-ghost btn-sm dt-col-reset" type="button">Restablecer</button>
        <button class="btn btn-ghost btn-sm dt-col-close" type="button">Cerrar</button>
      </div>
      <div class="dt-colpanel-body">${body}</div>`;

    (mobile ? document.body : el).appendChild(panel);
    _colPanel = panel;

    panel.querySelectorAll(".dt-colcheck input").forEach(inp => {
      inp.addEventListener("change", () => {
        const key = inp.value;
        if (inp.checked) { if (!visible.includes(key)) visible = _payload.columns.map(c => c.key).filter(k => visible.includes(k) || k === key); }
        else visible = visible.filter(k => k !== key);
        setPref("table.columns", tableId, visible).catch(_prefFail);
        render();
        // Re-render del panel mantiene el estado de las casillas sin reabrir
      });
    });
    panel.querySelector(".dt-col-reset").addEventListener("click", () => {
      visible = _payload.columns.filter(c => c.default_visible).map(c => c.key);
      setPref("table.columns", tableId, null).catch(_prefFail);
      _closeColPanel();
      render();
    });
    panel.querySelector(".dt-col-close").addEventListener("click", _closeColPanel);
  }

  function _closeColPanel() {
    if (_colPanel) { _colPanel.remove(); _colPanel = null; }
  }

  function _navigate(link) {
    // link = "team:ALB" | "player:12"
    const [type, id] = String(link).split(":");
    if (typeof onRowClick === "function") return;
    // Fallback genérico (las vistas suelen pasar onRowClick):
    window.dispatchEvent(new CustomEvent("dt:navigate", { detail: { type, id, link } }));
  }

  // ── API pública ────────────────────────────────────────────────────────────
  function setPayload(p) {
    const sameTable = _payload && p && _payload.table_id === p.table_id;
    _payload = p;
    if (!sameTable) {
      visible = _initVisible();
      sort = getPref("table.sort", tableId, null) || (_payload?.default_sort ? { key: _payload.default_sort.key, dir: _payload.default_sort.dir } : null);
      page = 0;
      showAll = false;
    } else {
      // Conserva columnas/orden/página, pero descarta claves que ya no existan
      const allKeys = _payload.columns.map(c => c.key);
      visible = visible.filter(k => allKeys.includes(k));
      if (!visible.length) visible = _initVisible();
    }
    render();
  }

  function getState() {
    const sorted = _sortedRows();
    const total = sorted.length;
    const pageCount = Math.max(1, Math.ceil(total / _pageSize));
    const pageRows = showAll ? sorted : sorted.slice(page * _pageSize, (page + 1) * _pageSize);
    return {
      columns: _visibleCols(),
      rows: sorted,
      pageRows,
      sort,
      colorize,
      page,
      pageCount,
      showAll,
      filterLabels: _filterLabels,
    };
  }

  function destroy() {
    _closeColPanel();
    for (const [node, ev, fn] of _listeners) node.removeEventListener(ev, fn);
    _listeners.length = 0;
    el.innerHTML = "";
  }

  // Permite a la vista re-aplicar su filtro local (buscador) sin re-pedir el payload.
  function setRowFilter(fn, labels) {
    _rowFilter = fn;
    if (labels) _filterLabels = labels;
    page = 0;
    render();
  }

  // Arranque: asegura page_size y catálogo antes del primer render.
  _loadPageSize().then(ps => { _pageSize = ps; render(); });

  return { setPayload, getState, destroy, setRowFilter, render };
}

function _toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Estados de la tabla (T-E1) ─────────────────────────────────────────────────
// Helpers que la vista usa en el mismo contenedor antes/alrededor del montaje.
export function dtLoading(el) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
}

export function dtEmpty(el, { trimmed = false } = {}) {
  const extra = trimmed ? ' <span class="td-muted">Probá con otro período o competencia.</span>' : "";
  el.innerHTML = `<p class="empty">No hay datos para esta selección.${extra}</p>`;
}

export function dtError(el, message, onRetry) {
  el.innerHTML = `
    <div class="card dt-error">
      <p class="empty below-avg">${_escHtml(message || "No se pudo cargar la tabla.")}</p>
      <div style="text-align:center"><button class="btn btn-ghost btn-sm dt-retry" type="button">Reintentar</button></div>
    </div>`;
  const btn = el.querySelector(".dt-retry");
  if (btn && onRetry) btn.addEventListener("click", onRetry);
}

export function dtOffline(el, onRetry) {
  el.innerHTML = `
    <div class="card dt-error">
      <p class="empty below-avg">Sin conexión. No se pudo cargar la tabla.</p>
      <div style="text-align:center"><button class="btn btn-ghost btn-sm dt-retry" type="button">Reintentar</button></div>
    </div>`;
  const btn = el.querySelector(".dt-retry");
  if (btn && onRetry) btn.addEventListener("click", onRetry);
}

// Monta una tabla a partir de una promesa de payload, resolviendo estados. Devuelve
// el handle de createDataTable (o null si falló), y re-pide al "Reintentar".
export async function mountTable(el, loader, opts = {}) {
  dtLoading(el);
  let payload;
  try {
    payload = await loader();
  } catch (e) {
    if (navigator.onLine === false || e instanceof TypeError) {
      dtOffline(el, () => mountTable(el, loader, opts));
    } else {
      dtError(el, e.message, () => mountTable(el, loader, opts));
    }
    return null;
  }
  if (!payload || !payload.rows || !payload.rows.length) {
    const trimmed = payload?.context && payload.context.games_used === 0 && payload.context.games_total > 0;
    dtEmpty(el, { trimmed });
    return null;
  }
  const dt = createDataTable(el, { ...opts, payload });
  _noteIgnored(el, payload);
  return dt;
}

// Etiquetas de los filtros que el backend informó como no aplicados en ESTA tabla (T-03 `context.ignored`).
const _IGNORED_LABELS = {
  quarter: "cuarto", score: "marcador", on: "con jugador", off: "sin jugador",
  venue: "sede", opponent: "rival", rest: "descanso", last: "período",
};

// Aviso al pie de la tabla: qué filtros activos NO se aplicaron acá. Sin él, la tabla muestra
// números de partido completo debajo de una barra que dice "4.º cuarto" (T-03 RF-16).
function _noteIgnored(el, payload) {
  const ignored = (payload?.context?.ignored || [])
    .filter(i => i.reason === "no_aplica" || i.reason === "no_implementado");
  if (!ignored.length) return;
  const names = [...new Set(ignored.map(i => _IGNORED_LABELS[i.param] || i.param))];
  const note = document.createElement("p");
  note.className = "td-muted dt-ignored";
  note.textContent = names.length === 1
    ? `Esta tabla no aplica el filtro de ${names[0]}.`
    : `Esta tabla no aplica los filtros de ${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}.`;
  el.appendChild(note);
}
