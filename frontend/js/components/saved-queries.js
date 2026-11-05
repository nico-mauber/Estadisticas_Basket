// Consultas guardadas (F-10): lista de las búsquedas con nombre del usuario (de quintetos y de jugadores), con
// "Ejecutar" y "Eliminar", y el diálogo para guardar la búsqueda actual. Una consulta es el nombre más el
// objeto plano de parámetros de la búsqueda: ejecutarla es volver a pedir esa búsqueda.
import { api } from "../api.js";
import { loadCatalog, metricLabel, metricDef } from "../core/catalog.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND_LABEL = { quintetos: "Quintetos", jugadores: "Jugadores" };

function _val(key, v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return metricDef(key)?.fmt === "pct" || (metricDef(key) == null && ["efg_pct", "ts_pct", "fg2_pct", "fg3_pct", "ft_pct", "uso_pct"].includes(key))
    ? `${Math.round(n * 1000) / 10} %` : String(n);
}

/** Resumen legible de los filtros de una consulta guardada. */
export function summarizeParams(kind, p) {
  const out = [];
  if (p.team) out.push(`Equipo ${p.team}`);
  if (p.name) out.push(`Nombre «${p.name}»`);
  if (p.position) out.push(`Posición ${p.position}`);
  if (p.include) out.push(`Incluye ${p.include.split(",").length} jugador${p.include.split(",").length > 1 ? "es" : ""}`);
  if (p.exclude) out.push(`Excluye ${p.exclude.split(",").length} jugador${p.exclude.split(",").length > 1 ? "es" : ""}`);
  if (p.min_poss) out.push(`≥ ${p.min_poss} posesiones`);
  if (p.last) out.push(`Últimos ${p.last}`);
  if (p.venue) out.push(`Sede ${p.venue}`);
  for (const [k, v] of Object.entries(p)) {
    const m = /^(min|max)\.(.+)$/.exec(k);
    if (m) out.push(`${metricLabel(m[2])} ${m[1] === "min" ? "≥" : "≤"} ${_val(m[2], v)}`);
  }
  if (kind === "quintetos" && p.adjusted === "0") out.push("valor crudo");
  return out.length ? out.join(" · ") : "Sin filtros";
}

function _fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Lista de consultas del usuario. `onRun(consulta)` abre la búsqueda con los filtros restaurados. */
export async function renderSavedQueries(el, { onRun, notify = () => {} } = {}) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando consultas…</p>';
  let list;
  try { await loadCatalog().catch(() => {}); list = await api.savedQueries(); }
  catch (e) {
    el.innerHTML = `<p class="empty below-avg">${navigator.onLine === false || e instanceof TypeError ? "Sin conexión: las consultas necesitan conexión." : "No se pudieron cargar las consultas."}</p>`;
    return;
  }
  if (!el.isConnected) return;
  if (!list.length) { el.innerHTML = '<div class="card"><div class="card-title">Consultas guardadas</div><p class="empty">Todavía no guardaste ninguna consulta.</p></div>'; return; }
  el.innerHTML = `<div class="card"><div class="card-title">Consultas guardadas</div><div class="sq-list">${list.map(q => `
    <div class="sq-item" data-id="${q.id}">
      <div class="sq-main">
        <strong class="sq-name">${esc(q.name)}</strong>
        <span class="sq-kind">${esc(KIND_LABEL[q.kind] || q.kind)}</span>
        ${q.stale ? '<span class="sq-stale" title="Los datos o la configuración cambiaron desde que la guardaste">datos cambiaron</span>' : ""}
        <div class="sq-sum td-muted">${esc(summarizeParams(q.kind, q.params))}</div>
        <div class="sq-date td-muted">${esc(_fmtDate(q.updated_at))}</div>
      </div>
      <div class="sq-actions">
        <button class="btn btn-sm sq-run">Ejecutar</button>
        <button class="btn btn-ghost btn-sm sq-del">Eliminar</button>
      </div>
    </div>`).join("")}</div></div>`;
  el.querySelectorAll(".sq-item").forEach(row => {
    const q = list.find(x => String(x.id) === row.dataset.id);
    row.querySelector(".sq-run").addEventListener("click", () => onRun?.(q));
    row.querySelector(".sq-del").addEventListener("click", () => {
      if (!confirm(`¿Eliminar la consulta «${q.name}»?`)) return;
      api.deleteQuery(q.id).then(() => { notify("Consulta eliminada."); renderSavedQueries(el, { onRun, notify }); })
        .catch(() => notify("No se pudo eliminar la consulta.", "err"));
    });
  });
}

/** Pide un nombre y guarda `params` como consulta de tipo `kind`. Con un nombre repetido ofrece reemplazar. */
export function saveQueryDialog({ kind, params, onSaved, notify = () => {} }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal sq-modal">
      <h3>Guardar búsqueda</h3>
      <p class="sq-modal-sum">${esc(summarizeParams(kind, params))}</p>
      <label class="modal-field">Nombre<input name="name" type="text" maxlength="80" placeholder="Ej.: Cierres sólidos" autocomplete="off"></label>
      <p class="below-avg sq-modal-err" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-sm">Guardar</button>
      </div>
    </form>`;
  document.body.appendChild(backdrop);
  const form = backdrop.querySelector("form"), err = backdrop.querySelector(".sq-modal-err"), input = form.name;
  const actions = backdrop.querySelector(".modal-actions");
  let overwrite = false;
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", e => { if (e.target === backdrop || e.target.hasAttribute("data-cancel")) close(); });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = input.value.trim();
    err.hidden = true;
    if (!name) { err.textContent = "Poné un nombre a la consulta."; err.hidden = false; return; }
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const row = await api.saveQuery({ name, kind, params, overwrite });
      close();
      notify("Consulta guardada.");
      onSaved?.(row);
    } catch (ex) {
      btn.disabled = false;
      if (ex.code === "conflicto") {
        overwrite = true;
        err.textContent = "Ya tenés una consulta con ese nombre. ¿Reemplazarla?";
        err.hidden = false;
        btn.textContent = "Reemplazar";
      } else if (navigator.onLine === false || ex instanceof TypeError) {
        err.textContent = "Sin conexión: no se puede guardar ahora."; err.hidden = false;
      } else if (ex.status === 400) {
        err.textContent = ex.message; err.hidden = false;
      } else {
        err.textContent = "No se pudo guardar la consulta."; err.hidden = false;
      }
    }
  });
  input.addEventListener("input", () => { if (overwrite) { overwrite = false; form.querySelector('[type="submit"]').textContent = "Guardar"; err.hidden = true; } });
  input.focus();
  return { close };
}
