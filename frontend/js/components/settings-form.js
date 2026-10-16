/**
 * Formulario de Configuración — F-13.
 * Genera controles por tipo desde el spec del backend. Solo lectura si !is_admin.
 */

const SECTION_LABELS = { umbrales: "Umbrales de muestra", contexto: "Reglas de contexto",
                         momentum: "Reglas de Momentum", preferencias: "Preferencias" };

function _control(s, value) {
  const id = `cfg-${s.key}`;
  const dis = s._readonly ? "disabled" : "";
  if (s.type === "bool") {
    return `<label class="settings-toggle"><input type="checkbox" id="${id}" ${value ? "checked" : ""} ${dis}>
      <span>${s.label}</span></label>`;
  }
  if (s.type === "enum" || (s.choices && Array.isArray(s.choices))) {
    const opts = (s.choices || []).map(c => {
      const cv = typeof c === "object" ? c.value : c;
      const cl = typeof c === "object" ? c.label : c;
      const sel = (cv === value || (cv === null && value === null)) ? "selected" : "";
      return `<option value="${cv === null ? "" : cv}" ${sel}>${cl}</option>`;
    }).join("");
    return `<select id="${id}" ${dis}>${opts}</select>`;
  }
  if (s.type === "int" || s.type === "float") {
    const step = s.type === "float" ? "0.01" : "1";
    return `<input type="number" id="${id}" value="${value ?? ""}" min="${s.min ?? ""}" max="${s.max ?? ""}" step="${step}" inputmode="decimal" ${dis}>`;
  }
  if (s.type === "int_or_null" || s.type === "float_or_null") {
    if (s.choices) {
      const opts = s.choices.map(c => {
        const cv = typeof c === "object" ? c.value : c;
        const cl = typeof c === "object" ? c.label : c;
        const sel = (cv === value || (cv === null && value === null)) ? "selected" : "";
        return `<option value="${cv === null ? "" : cv}" ${sel}>${cl}</option>`;
      }).join("");
      return `<select id="${id}" ${dis}>${opts}</select>`;
    }
    return `<input type="number" id="${id}" value="${value ?? ""}" min="${s.min ?? ""}" max="${s.max ?? ""}" step="1" inputmode="decimal" ${dis}>`;
  }
  if (s.type === "json") {
    return `<textarea id="${id}" rows="2" ${dis}>${typeof value === "string" ? value : JSON.stringify(value, null, 2)}</textarea>`;
  }
  return `<input type="text" id="${id}" value="${value ?? ""}" ${dis}>`;
}

function _readControl(s) {
  const el = document.getElementById(`cfg-${s.key}`);
  if (!el) return undefined;
  if (s.type === "bool") return el.checked;
  if (s.type === "int") return el.value === "" ? undefined : parseInt(el.value, 10);
  if (s.type === "float") return el.value === "" ? undefined : parseFloat(el.value.replace(",", "."));
  if (s.type === "int_or_null" || s.type === "float_or_null") return el.value === "" ? null : parseInt(el.value, 10);
  if (s.type === "enum") return el.value;
  if (s.type === "json") { try { return JSON.parse(el.value); } catch { return undefined; } }
  return el.value;
}

function _fmtDate(iso) {
  if (!iso) return "";
  try { const d = new Date(iso); return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

export function renderSettingsForm(el, payload, { onSave, onReset }) {
  const { values, spec, sections, is_admin } = payload;
  const readonly = !is_admin;
  const sectionSlugs = sections.map(s => s.slug);
  let activeSection = sectionSlugs[0];
  try { activeSection = sessionStorage.getItem("sb.config.section") || activeSection; } catch {}
  if (!sectionSlugs.includes(activeSection)) activeSection = sectionSlugs[0];

  function render() {
    try { sessionStorage.setItem("sb.config.section", activeSection); } catch {}
    const pills = sections.map(s =>
      `<button class="filter-pill${s.slug === activeSection ? " active" : ""}" data-section="${s.slug}">${s.label}</button>`
    ).join("");

    const activeSpecs = spec.filter(s => s.section === activeSection && s.status === "activa");
    const reservedSpecs = spec.filter(s => s.section === activeSection && s.status === "reservada");

    let body;
    if (activeSpecs.length === 0) {
      const consumers = [...new Set(reservedSpecs.map(s => s.consumer).filter(Boolean))].join(", ");
      body = `<div class="settings-empty">
        <p>Todavía no hay reglas editables en este módulo.</p>
        <p>Se habilitan con: ${consumers || "requisitos futuros"}.</p>
      </div>`;
    } else {
      body = activeSpecs.map(s => {
        s._readonly = readonly;
        const v = values[s.key] ?? s.default;
        const modified = s.modified ? `<span class="settings-modified">Modificado</span>` : "";
        const meta = s.updated_by ? `<span class="settings-meta">Modificado por ${s.updated_by} el ${_fmtDate(s.updated_at)}</span>` : "";
        const range = s.min != null && s.max != null ? `<span class="settings-range">entre ${s.min} y ${s.max}${s.unit ? " " + s.unit : ""}</span>` : "";
        const defVal = s.default === null ? "Automática (la más reciente)" : s.default;
        const resetBtn = s.modified && !readonly ? `<button class="settings-reset-key" data-key="${s.key}" title="Restablecer">↺</button>` : "";

        return `<div class="settings-row" data-key="${s.key}">
          <div class="settings-label">${s.label} ${modified} ${resetBtn}</div>
          <div class="settings-control">${_control(s, v)}</div>
          <div class="settings-info">
            ${range}
            <span class="settings-default">Por defecto: ${defVal}</span>
            ${s.help ? `<span class="settings-help">${s.help}</span>` : ""}
            ${meta}
          </div>
          <div class="settings-error" id="err-${s.key}"></div>
        </div>`;
      }).join("");
    }

    const actions = readonly
      ? `<div class="settings-readonly-notice">Solo un administrador puede modificar la configuración.</div>`
      : `<div class="settings-actions">
          <button id="btn-settings-save" class="btn-primary" disabled>Guardar cambios</button>
          <button id="btn-settings-reset-section" class="btn-secondary">Restablecer módulo</button>
        </div>`;

    el.innerHTML = `<div class="settings-form">
      <div class="settings-pills">${pills}</div>
      ${body}
      ${activeSpecs.length > 0 ? actions : ""}
    </div>`;

    el.querySelectorAll(".filter-pill").forEach(btn => {
      btn.addEventListener("click", () => { activeSection = btn.dataset.section; render(); });
    });

    if (!readonly && activeSpecs.length > 0) {
      const saveBtn = el.querySelector("#btn-settings-save");
      const inputs = el.querySelectorAll("input, select, textarea");
      inputs.forEach(inp => inp.addEventListener("input", () => { saveBtn.disabled = false; }));
      inputs.forEach(inp => inp.addEventListener("change", () => { saveBtn.disabled = false; }));

      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = "Guardando…";
        el.querySelectorAll(".settings-error").forEach(e => e.textContent = "");

        const changed = {};
        for (const s of activeSpecs) {
          const v = _readControl(s);
          if (v !== undefined) {
            const orig = values[s.key] ?? s.default;
            if (v !== orig || (v === null && orig !== null) || (v !== null && orig === null)) changed[s.key] = v;
          }
        }
        if (Object.keys(changed).length === 0) { saveBtn.textContent = "Guardar cambios"; return; }
        try {
          await onSave(changed);
        } catch (e) {
          if (e.details) {
            for (const [k, msg] of Object.entries(e.details)) {
              const errEl = document.getElementById(`err-${k}`);
              if (errEl) errEl.textContent = msg;
            }
          }
          saveBtn.textContent = "Guardar cambios";
          saveBtn.disabled = false;
        }
      });

      const resetSectionBtn = el.querySelector("#btn-settings-reset-section");
      if (resetSectionBtn) {
        const modCount = activeSpecs.filter(s => s.modified).length;
        if (modCount === 0) resetSectionBtn.disabled = true;
        resetSectionBtn.addEventListener("click", async () => {
          if (!confirm(`¿Volver ${modCount} valor(es) a su valor por defecto?`)) return;
          resetSectionBtn.disabled = true;
          resetSectionBtn.textContent = "Restableciendo…";
          try { await onReset({ section: activeSection }); } catch { resetSectionBtn.disabled = false; }
          resetSectionBtn.textContent = "Restablecer módulo";
        });
      }

      el.querySelectorAll(".settings-reset-key").forEach(btn => {
        btn.addEventListener("click", async () => {
          try { await onReset({ keys: [btn.dataset.key] }); } catch {}
        });
      });
    }
  }

  render();
}
