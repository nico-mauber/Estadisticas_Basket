// ── Cabecera e identidad del jugador (F-16) ──────────────────────────────────
// Toda ficha identifica al jugador ANTES de mostrar un solo número: nombre, dorsal, posición, club
// y la línea de contexto con los partidos de la selección activa. Debajo, la ficha con los datos que
// FIBA no publica (altura, año, nacionalidad, notas), que un administrador carga a mano.
import { api } from "../api.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const NO_REG = "No registrado: FIBA no publica este dato. Podés cargarlo a mano.";

// Mismo texto que devuelve el backend, para que el usuario lea lo mismo lo bloquee quien lo bloquee.
const FIELD_ERRORS = {
  height_cm: "La altura debe estar entre 140 y 240 cm.",
  birth_year: "El año de nacimiento debe estar entre 1940 y 2020.",
  nationality: "La nacionalidad no puede superar los 60 caracteres.",
  profile_notes: "Las notas no pueden superar los 2000 caracteres.",
};

// Un dato ausente se muestra "—" con su razón, nunca 0 ni vacío (C-11).
const _val = (v, fmt) => (v == null || v === "" ? `<span title="${NO_REG}">—</span>` : esc(fmt ? fmt(v) : v));
const _height = cm => `${(cm / 100).toFixed(2).replace(".", ",")} m`;

function _initials(name) {
  return String(name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function _fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function _headerHTML(p) {
  const bits = [
    p.jersey != null ? `#${esc(p.jersey)}` : null,
    esc(p.display_name),
    p.position ? esc(p.position) : null,
    esc(p.team?.name || p.team?.code || ""),
  ].filter(Boolean);
  return `<div class="card ph-card">
    <div class="ph-main">
      ${p.photo_url
        ? `<img class="ph-photo" src="${esc(p.photo_url)}" alt="">`
        : `<div class="ph-photo ph-initials">${esc(_initials(p.display_name))}</div>`}
      <div class="ph-text">
        <div class="ph-name">${bits.join(" · ")}</div>
        <div class="td-muted ph-context">${esc(p.context_line || "")}</div>
      </div>
      ${p.editable ? '<button type="button" class="btn btn-ghost btn-sm ph-edit">Editar ficha</button>' : ""}
    </div>
    <div class="ph-fields">
      <div><span class="ph-label">Nombre completo</span>${_val(p.full_name)}</div>
      <div><span class="ph-label">Altura</span>${_val(p.height_cm, _height)}</div>
      <div><span class="ph-label">Año de nacimiento</span>${_val(p.birth_year)}</div>
      <div><span class="ph-label">Nacionalidad</span>${_val(p.nationality)}</div>
    </div>
    ${p.profile_notes ? `<p class="ph-notes">${esc(p.profile_notes)}</p>` : ""}
    ${p.profile_updated_at
      ? `<p class="td-muted ph-audit">Editado el ${esc(_fmtDateTime(p.profile_updated_at))}${
          p.profile_updated_by ? ` por ${esc(p.profile_updated_by)}` : ""}</p>`
      : ""}
    <div class="ph-form" hidden></div>
  </div>`;
}

function _formHTML(p) {
  return `<form class="ph-edit-form">
    <label>Altura (cm) <input type="number" name="height_cm" min="140" max="240" value="${p.height_cm ?? ""}"></label>
    <label>Año de nacimiento <input type="number" name="birth_year" min="1940" max="2020" value="${p.birth_year ?? ""}"></label>
    <label>Nacionalidad <input type="text" name="nationality" maxlength="60" value="${esc(p.nationality ?? "")}"></label>
    <label class="ph-notes-field">Notas <textarea name="profile_notes" maxlength="2000" rows="2">${esc(p.profile_notes ?? "")}</textarea></label>
    <div class="ph-form-actions">
      <button type="submit" class="btn btn-sm">Guardar</button>
      <button type="button" class="btn btn-ghost btn-sm ph-cancel">Cancelar</button>
      <span class="ph-form-msg td-muted"></span>
    </div>
  </form>`;
}

let _token = 0;

// `opts`: {params (contexto activo), onSaved}
export async function renderPlayerHeader(el, playerId, opts = {}) {
  if (!el) return null;
  const token = ++_token;
  el.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando jugador…</p></div>';

  let p;
  try {
    p = await api.playerProfile(playerId, opts.params || {});
  } catch (e) {
    if (token !== _token) return null;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    el.innerHTML = `<div class="card"><p class="empty below-avg">${esc(offline
      ? "Sin conexión: no se pudo cargar la ficha."
      : (e.status === 404 ? "No encontramos este jugador." : (e.message || "No se pudo cargar la ficha.")))}</p></div>`;
    return null;
  }
  if (token !== _token) return null;

  el.innerHTML = _headerHTML(p);
  const formHost = el.querySelector(".ph-form");

  el.querySelector(".ph-edit")?.addEventListener("click", () => {
    formHost.hidden = false;
    formHost.innerHTML = _formHTML(p);
    const form = formHost.querySelector("form");
    const msg = formHost.querySelector(".ph-form-msg");
    formHost.querySelector(".ph-cancel").addEventListener("click", () => {
      formHost.hidden = true;
      formHost.innerHTML = "";
    });
    // El navegador bloquea el envío con los `min`/`max` del input y no deja rastro en el formulario:
    // se muestra el mismo mensaje que daría el servidor para que el usuario sepa qué corregir.
    form.addEventListener("invalid", ev => {
      ev.preventDefault();
      const field = ev.target;
      msg.textContent = FIELD_ERRORS[field.name] || field.validationMessage || "Revisá el valor de este campo.";
      msg.classList.add("below-avg");
      field.focus();
    }, true);

    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      msg.classList.remove("below-avg");
      msg.textContent = "Guardando…";
      const body = {};
      for (const field of ["height_cm", "birth_year", "nationality", "profile_notes"]) {
        const raw = form.elements[field].value.trim();
        body[field] = raw === "" ? null : raw;   // vacío borra el dato (vuelve a "no registrado")
      }
      try {
        await api.updatePlayerProfile(playerId, body);
        await renderPlayerHeader(el, playerId, opts);
        opts.onSaved?.();
      } catch (e) {
        btn.disabled = false;
        msg.textContent = e.message || "No se pudo guardar.";
        msg.classList.add("below-avg");
      }
    });
  });
  return p;
}

export function destroyPlayerHeader() { _token++; }
