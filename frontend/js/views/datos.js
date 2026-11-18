// Vista datos (X-01: extraída de app.js sin cambios de comportamiento).
import { api } from "../api.js";
import { syncRoute } from "../app.js";
import { invalidateContextOptions } from "../components/context-bar.js";
import { downloadBlob } from "../components/exporters.js";
import { renderFixtures } from "../components/fixtures-manager.js";
import { renderDuplicateItems } from "../components/identity-merge.js";
import { DEC1, PCT } from "../core/format.js";
import { S } from "../state.js";
import { _liveTarget, showGame, showLiveGame, showPrepare } from "./panels.js";
import { _baseMeta, _compOptions, _mountTableExport, esc, refreshCompareSelectors, refreshTeamSelector, toast } from "./shared.js";

// ── Import section ─────────────────────────────────────────────────────────
export const PAGE_SIZE = 10;
export function _fmtDate(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}
// Estado de datos de un partido en el catálogo (F-11)
export function _dataBadges(g) {
  const b = [];
  if (g.competition_status === "borrador") b.push('<span class="badge badge-muted">Borrador</span>');
  if (!g.has_pbp) b.push('<span class="badge badge-warn">Sin PBP</span>');
  else if (!g.has_coords) b.push('<span class="badge badge-muted">Sin coordenadas</span>');
  if (g.needs_reprocess) b.push('<span class="badge badge-warn">Reprocesar</span>');
  return b.join(" ") || '<span class="badge badge-ok">OK</span>';
}
export function _gamesTable(games, page, emptyMsg = "Sin partidos aún.") {
  if (!games.length) return `<p class="empty">${emptyMsg}</p>`;
  const totalPages = Math.ceil(games.length / PAGE_SIZE);
  const slice = games.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const pagination = totalPages > 1 ? `
    <div class="pagination">
      <button class="btn btn-ghost btn-sm" id="pg-prev" ${page === 0 ? "disabled" : ""}>← Ant.</button>
      <span class="pagination-label">Página ${page + 1} / ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" id="pg-next" ${page >= totalPages - 1 ? "disabled" : ""}>Sig. →</button>
    </div>` : "";

  const cbHeader = S.selectMode ? "<th></th>" : "";
  const rows = slice.map(g => {
    const id      = g.game_id || "";
    const checked = S.selectedGames.has(id) ? "checked" : "";
    const selCls  = S.selectedGames.has(id) ? " selected-row" : "";
    const cbCell  = S.selectMode
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
export async function _wireBulkExport(el, comps) {
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
export function _afterDataChange() {
  S._searchPayload = null;
  refreshTeamSelector();
  refreshCompareSelectors();
}
// El borrado se autoriza con la sesión (admin, F-11); no pide token (C-11 RF-14).
export function _showDeleteModal(count, ids) {
  _formModal({
    title: `Eliminar partido${count > 1 ? "s" : ""}`,
    text: `¿Eliminar ${count} partido${count > 1 ? "s" : ""}? Se eliminará toda la información asociada (estadísticas, jugadores, tiros). Esta acción no se puede deshacer.`,
    confirm: "Eliminar", danger: true,
    onSubmit: async () => {
      await api.deleteGames(ids);
      toast(`${count} partido${count > 1 ? "s" : ""} eliminado${count > 1 ? "s" : ""}`);
      S.selectMode = false;
      S.selectedGames.clear();
      S.importPage = 0;
      renderImport();
      _afterDataChange();
    },
  });
}
// Modal con formulario. `fields`: [{name, label, type: "text"|"select", value, options:[{value,label}]}].
// Si `onSubmit(values)` lanza, se muestra el error y el modal queda abierto.
export function _formModal({ title, text = "", fields = [], confirm = "Guardar", danger = false, onSubmit }) {
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
export async function _runReprocess(target, onProgress) {
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
export const IMPORT_TABS = [["importar", "Importar"], ["calendario", "Calendario"], ["calidad", "Calidad de datos"], ["competencias", "Competencias"]];
// Sección Datos (F-11): pestañas Importar · Calidad de datos · Competencias.
export function renderImport() {
  const sec = document.getElementById("sec-import");
  sec.innerHTML = `
    <div class="filter-pills import-tabs">
      ${IMPORT_TABS.map(([id, lbl]) =>
        `<button class="filter-pill${id === S._importTab ? " active" : ""}" data-tab="${id}">${lbl}</button>`).join("")}
    </div>
    <div id="import-tab"></div>`;
  sec.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
    S._importTab = b.dataset.tab;
    renderImport();
    syncRoute();
  }));
  const el = document.getElementById("import-tab");
  if (S._importTab === "calidad") return _renderQualityTab(el);
  if (S._importTab === "competencias") return _renderCompetitionsTab(el);
  if (S._importTab === "calendario") return renderFixtures(el, { isAdmin: S._isAdmin, toast, onPrepare: (team, rival, fixture) => showPrepare(team, rival, null, fixture) });
  return _renderImportTab(el);
}
export const _compLabel = c => c.status === "borrador" ? `${c.label} (borrador)` : c.label;
export async function _renderImportTab(el) {
  const comps = await api.competitions(true).catch(() => []);
  if (!comps.some(c => String(c.id) === String(S._catalogComp))) S._catalogComp = "";
  const games = await api.games(S._catalogComp).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  const hasSel = S.selectMode && S.selectedGames.size > 0;

  el.innerHTML = `
    <div class="card">
      <div class="card-title">Importar partido desde FIBA LiveStats</div>
      <div class="import-panel">
        <input id="url-input" type="text" placeholder="https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2741550/bs.html" />
        <button class="btn" id="btn-import">Importar</button>
        <button class="btn btn-ghost" id="btn-live">Seguir en vivo</button>
      </div>
      <p class="import-hint">El sistema captura los datos automáticamente desde la URL de FIBA LiveStats. "Seguir en vivo" muestra un partido en curso y lo guarda solo al terminar.</p>
      ${S._seedEnabled ? `
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
            comps.map(c => ({ id: c.id, label: _compLabel(c) })), S._catalogComp)}</select>` : ""}
          ${games && games.length ? '<span class="xm-host" data-xm="games"></span>' : ""}
          ${S._isAdmin ? `<button class="btn btn-ghost btn-sm" id="btn-select-mode">${S.selectMode ? "Cancelar" : "Seleccionar partidos"}</button>` : ""}
        </div>
      </div>
      ${S._isAdmin && S.selectMode ? `
      <div class="games-header-actions sel-actions" id="sel-actions" style="${hasSel ? "" : "display:none"}">
        ${comps.length > 1 ? '<button class="btn btn-ghost btn-sm" id="btn-move-sel">Mover a competencia…</button>' : ""}
        <button class="btn btn-ghost btn-sm" id="btn-reprocess-sel">Reprocesar</button>
        <button class="btn-delete-sel" id="btn-delete-sel">🗑 Eliminar</button>
      </div>` : ""}
      <div id="games-table">${games
        ? _gamesTable(games, S.importPage, S._catalogComp ? "No hay partidos en esta competencia." : "Sin partidos aún.")
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
    const compLabel = (comps.find(c => String(c.id) === String(S._catalogComp)) || {}).label || "";
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
      S.importPage = 0;
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
      S.importPage = 0;
      refresh();
      _afterDataChange();
    } catch (err) {
      toast(err.message, "err");
      seedBtn.disabled = false;
      seedBtn.textContent = "⚡ Agregar partidos (dev)";
    }
  });

  document.getElementById("catalog-comp")?.addEventListener("change", e => {
    S._catalogComp = e.target.value;
    S.importPage = 0;
    S.selectedGames.clear();   // no actuar sobre partidos que el filtro dejó fuera de vista
    refresh();
  });

  document.getElementById("btn-select-mode")?.addEventListener("click", () => {
    S.selectMode = !S.selectMode;
    S.selectedGames.clear();
    refresh();
  });

  el.querySelectorAll(".row-cb").forEach(cb => cb.addEventListener("change", () => {
    cb.checked ? S.selectedGames.add(cb.dataset.id) : S.selectedGames.delete(cb.dataset.id);
    cb.closest("tr")?.classList.toggle("selected-row", cb.checked);
    const actions = document.getElementById("sel-actions");
    if (actions) actions.style.display = S.selectedGames.size ? "" : "none";
  }));

  const page = delta => { S.importPage += delta; refresh(); };
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
    if (S.selectedGames.size) _showDeleteModal(S.selectedGames.size, [...S.selectedGames]);
  });

  document.getElementById("btn-move-sel")?.addEventListener("click", () => {
    const ids = [...S.selectedGames];
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
            S.selectMode = false;
            S.selectedGames.clear();
            refresh();
            _afterDataChange();
          }
        }
        toast(`${moved} partido${moved > 1 ? "s" : ""} movido${moved > 1 ? "s" : ""}.`);
      },
    });
  });

  document.getElementById("btn-reprocess-sel")?.addEventListener("click", async e => {
    const btn = e.currentTarget, ids = [...S.selectedGames];
    btn.disabled = true;
    await _runReprocess({ gameIds: ids }, (done, total) => { btn.textContent = `Reprocesando ${done} de ${total}…`; });
    S.selectMode = false;
    S.selectedGames.clear();
    refresh();
  });
}
// Orden y copy de los chequeos del informe de calidad (F-11)
export const QUALITY_CHECKS = [
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
export function _qualityCheckCard(title, c, key) {
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
export async function _renderQualityTab(el) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Revisando la competencia…</p>';
  const comps = await api.competitions(true).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  if (!comps) { el.innerHTML = '<p class="empty below-avg">No se pudo generar el informe de calidad.</p>'; return; }
  if (!comps.length) {
    el.innerHTML = '<p class="empty">Todavía no hay competencias. Importá un partido para crear la primera.</p>';
    return;
  }
  if (!comps.some(c => String(c.id) === String(S._qualityComp))) S._qualityComp = String(comps[0].id);

  const requested = S._qualityComp;
  let rep;
  try { rep = await api.dataQuality(requested); }
  catch { if (requested === S._qualityComp) el.innerHTML = '<p class="empty below-avg">No se pudo generar el informe de calidad.</p>'; return; }
  if (!el.isConnected || requested !== S._qualityComp) return;   // llegó tarde: otra competencia elegida
  const comp = rep.competition, s = rep.summary;
  const isDraft = comp.status === "borrador";

  el.innerHTML = `
    <div class="card">
      <div class="games-header">
        <select id="quality-comp" class="map-select">${comps.map(c =>
          `<option value="${c.id}"${String(c.id) === S._qualityComp ? " selected" : ""}>${esc(_compLabel(c))}</option>`).join("")}</select>
        ${S._isAdmin ? `<div class="games-header-actions">
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
    isAdmin: S._isAdmin, toast,
    onMerged: () => { _afterDataChange(); _renderQualityTab(el); },
  });

  if (s.games) _renderConciliation(document.getElementById("poss-conciliation"), requested);

  el.querySelectorAll(".poss-gap-item[data-game]").forEach(li => {
    li.style.cursor = "pointer";
    li.addEventListener("click", () => _openPossInspection(li.dataset.game));
  });

  document.getElementById("quality-comp").addEventListener("change", e => {
    S._qualityComp = e.target.value;
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
export async function _renderConciliation(el, compId) {
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
export async function _openPossInspection(gameId) {
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
export async function _renderCompetitionsTab(el) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando competencias…</p>';
  const comps = await api.competitions(true).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  if (!comps) { el.innerHTML = '<p class="empty below-avg">No se pudieron cargar las competencias.</p>'; return; }

  el.innerHTML = `
    <div class="card">
      <div class="games-header">
        <div class="card-title" style="margin:0">Competencias y temporadas</div>
        ${S._isAdmin ? '<button class="btn btn-ghost btn-sm" id="btn-new-comp">Nueva competencia</button>' : ""}
      </div>
      ${comps.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Competencia</th><th>Estado</th><th>PJ</th><th>Equipos</th><th>Fechas</th>${S._isAdmin ? "<th></th>" : ""}</tr></thead>
        <tbody>${comps.map(c => `
          <tr data-id="${c.id}">
            <td class="td-team">${esc(c.label)}</td>
            <td><span class="badge ${c.status === "publicada" ? "badge-ok" : "badge-muted"}">${c.status === "publicada" ? "Publicada" : "Borrador"}</span></td>
            <td>${c.games}</td>
            <td>${c.teams}</td>
            <td class="td-muted">${c.first_date ? `${_fmtDate(c.first_date)} – ${_fmtDate(c.last_date)}` : "—"}</td>
            ${S._isAdmin ? `<td class="comp-actions">
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
