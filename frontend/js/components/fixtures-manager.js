// Calendario manual (F-12): pestaña Datos › Calendario. FIBA no publica el fixture: un administrador carga los partidos
// (fecha, hora, local, visitante, competencia, enlace FIBA y notas). Cualquier usuario lo ve y puede abrir Preparar con
// el cruce ya elegido. Al importar el partido real, el backend lo vincula y pasa a «Jugado».
import { api } from "../api.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDay = d => { const p = String(d || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (d || "—"); };
let _state = { team: "", future: true };

function _err(e) {
  if (e instanceof TypeError || navigator.onLine === false) return "Sin conexión: el calendario necesita conexión.";
  if (e.status === 403) return "Solo un administrador puede modificar el calendario.";
  return e.message || "No se pudo cargar el calendario.";
}

function _form(teams, comps, f = null) {
  const teamOpts = sel => `<option value="">— Elegí —</option>${teams.map(t => `<option value="${esc(t.code)}"${sel === t.code ? " selected" : ""}>${esc(t.name)}</option>`).join("")}`;
  const compOpts = `<option value="">— Sin competencia —</option>${comps.map(c => `<option value="${c.id}"${f && f.competition_id === c.id ? " selected" : ""}>${esc(c.label || c.name)}</option>`).join("")}`;
  return `<form class="fx-form" id="fx-form" novalidate>
    <div class="fx-grid">
      <label>Fecha<input type="date" name="date" value="${esc(f?.date || "")}" required></label>
      <label>Hora<input type="time" name="time" value="${esc(f?.time || "")}"></label>
      <label>Local<select name="home_code">${teamOpts(f?.home_code)}</select></label>
      <label>Visitante<select name="away_code">${teamOpts(f?.away_code)}</select></label>
      <label>Competencia<select name="competition_id">${compOpts}</select></label>
      <label class="fx-wide">Enlace FIBA (opcional)<input type="url" name="source_url" value="${esc(f?.source_url || "")}" placeholder="https://fibalivestats.dcd.shared.geniussports.com/u/…/bs.html"></label>
      <label class="fx-wide">Notas<input type="text" name="notes" maxlength="300" value="${esc(f?.notes || "")}"></label>
    </div>
    <div class="fx-form-actions">
      <button type="submit" class="btn btn-sm">${f ? "Guardar cambios" : "Agregar partido"}</button>
      ${f ? '<button type="button" class="btn btn-ghost btn-sm fx-cancel">Cancelar</button>' : ""}
      <span class="fx-msg" role="status"></span>
    </div>
  </form>`;
}

function _rows(list, canEdit) {
  if (!list.length) return '<p class="empty">El calendario está vacío.</p>';
  return `<div class="ev-scroll"><table class="ld-table fx-table" id="fx-table"><thead><tr><th>Fecha</th><th>Hora</th><th>Local</th><th>Visitante</th><th>Competencia</th><th>Estado</th><th></th></tr></thead><tbody>${
    list.map(f => `<tr data-id="${f.id}" class="${f.played ? "fx-played" : ""}">
      <td>${fmtDay(f.date)}</td><td>${esc(f.time || "—")}</td><td>${esc(f.home_name)}</td><td>${esc(f.away_name)}</td>
      <td>${esc(f.competition_label || "—")}</td>
      <td>${f.played ? `<a href="#/partido/${esc(f.game_id)}">Jugado</a>` : "Pendiente"}${f.notes ? `<div class="td-muted fx-notes">${esc(f.notes)}</div>` : ""}</td>
      <td class="fx-actions">
        ${f.played ? "" : `<button type="button" class="btn btn-ghost btn-sm fx-prepare">Preparar</button>`}
        ${!f.played && f.source_url ? `<button type="button" class="btn btn-ghost btn-sm fx-import">Importar</button>` : ""}
        ${canEdit ? `<button type="button" class="btn btn-ghost btn-sm fx-edit">Editar</button><button type="button" class="btn btn-ghost btn-sm fx-del">Borrar</button>` : ""}
      </td></tr>`).join("")}</tbody></table></div>`;
}

export async function renderFixtures(el, { isAdmin = false, toast, onPrepare, onImported } = {}) {
  if (!el) return;
  el.innerHTML = '<div class="card"><div class="card-title">Calendario</div><p class="empty"><span class="spinner"></span>Cargando calendario…</p></div>';
  let data, teams, comps;
  try {
    [data, teams, comps] = await Promise.all([api.fixtures({}), api.teams(), api.competitions().catch(() => [])]);
  } catch (e) {
    el.innerHTML = `<div class="card"><div class="card-title">Calendario</div><p class="empty below-avg">${esc(_err(e))}</p></div>`;
    return;
  }
  const canEdit = isAdmin && data.can_edit !== false;
  const all = data.fixtures || [];
  const shown = all.filter(f => (!_state.team || f.home_code === _state.team || f.away_code === _state.team)
    && (!_state.future || (!f.played && f.date >= data.today)));
  el.innerHTML = `<div class="card" id="fx-panel"><div class="card-title">Calendario</div>
    <p class="td-muted">FIBA no publica el fixture: los partidos se cargan a mano. Al importar el partido real queda vinculado y pasa a «Jugado».</p>
    ${canEdit ? `<details class="fx-add"${all.length ? "" : " open"}><summary>Agregar partido</summary>${_form(teams, comps)}</details>` : ""}
    <div class="fx-filters">
      <select class="map-select" id="fx-team" aria-label="Filtrar por equipo"><option value="">Todos los equipos</option>${teams.map(t => `<option value="${esc(t.code)}"${_state.team === t.code ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
      <label class="fx-check"><input type="checkbox" id="fx-future"${_state.future ? " checked" : ""}> Solo próximos</label>
      <span class="td-muted">${shown.length} de ${all.length} partidos</span>
    </div>
    <div id="fx-list">${all.length && !shown.length ? '<p class="empty">No hay partidos para este filtro.</p>' : _rows(shown, canEdit)}</div>
  </div>`;
  const rerender = () => renderFixtures(el, { isAdmin, toast, onPrepare, onImported });
  el.querySelector("#fx-team").addEventListener("change", e => { _state.team = e.target.value; rerender(); });
  el.querySelector("#fx-future").addEventListener("change", e => { _state.future = e.target.checked; rerender(); });

  const bindForm = (form, fixture) => {
    if (!form) return;
    const msg = form.querySelector(".fx-msg");
    form.querySelector(".fx-cancel")?.addEventListener("click", rerender);
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      const fd = new FormData(form);
      const body = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim() || null]));
      if (body.competition_id) body.competition_id = Number(body.competition_id);
      if (!body.date) { msg.textContent = "Elegí la fecha del partido."; msg.classList.add("below-avg"); return; }
      if (!body.home_code || !body.away_code || body.home_code === body.away_code) { msg.textContent = "Elegí dos equipos distintos."; msg.classList.add("below-avg"); return; }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; msg.classList.remove("below-avg"); msg.textContent = "Guardando…";
      try {
        if (fixture) await api.updateFixture(fixture.id, body); else await api.createFixture(body);
        toast?.(fixture ? "Partido actualizado." : "Partido agregado al calendario.");
        rerender();
      } catch (e) {
        btn.disabled = false; msg.textContent = _err(e); msg.classList.add("below-avg");
      }
    });
  };
  bindForm(el.querySelector(".fx-add #fx-form"), null);

  el.querySelectorAll("#fx-table tbody tr").forEach(tr => {
    const f = all.find(x => String(x.id) === tr.dataset.id);
    tr.querySelector(".fx-prepare")?.addEventListener("click", () => onPrepare?.(f.home_code, f.away_code, f.id));
    tr.querySelector(".fx-import")?.addEventListener("click", async e => {
      e.target.disabled = true; e.target.textContent = "Importando…";
      try { await api.importGame(f.source_url); toast?.("Partido importado."); onImported?.(); rerender(); }
      catch (err) { toast?.(_err(err), "err"); e.target.disabled = false; e.target.textContent = "Importar"; }
    });
    tr.querySelector(".fx-edit")?.addEventListener("click", () => {
      const row = document.createElement("tr");
      row.className = "fx-edit-row";
      row.innerHTML = `<td colspan="7">${_form(teams, comps, f)}</td>`;
      tr.after(row);
      tr.querySelector(".fx-edit").disabled = true;
      bindForm(row.querySelector("form"), f);
    });
    tr.querySelector(".fx-del")?.addEventListener("click", async () => {
      if (!confirm(`¿Borrar ${f.home_name} – ${f.away_name} del ${fmtDay(f.date)}?`)) return;
      try { await api.deleteFixture(f.id); toast?.("Partido borrado del calendario."); rerender(); }
      catch (err) { toast?.(_err(err), "err"); }
    });
  });
}
