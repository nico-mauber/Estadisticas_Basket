// Vista config (X-01: extraída de app.js sin cambios de comportamiento).
import { api } from "../api.js";
import { goSection, syncRoute } from "../app.js";
import { chooseLanguage, mountLanguageSelector } from "../components/language-selector.js";
import { renderSettingsForm } from "../components/settings-form.js";
import { S } from "../state.js";
import { _compOptions, toast } from "./shared.js";

export async function renderConfig() {
  const sec = document.getElementById("sec-config");
  sec.innerHTML = `<div class="card"><div class="card-title">Configuración
    <button class="btn btn-ghost btn-back-config" id="btn-config-back">← Volver</button></div>
    <div class="config-lang"><label>Idioma</label><span id="config-lang-slot" class="lang-slot"></span></div>
    <div id="config-body"><p class="empty"><span class="spinner"></span>Cargando configuración…</p></div>
  </div>
  <div id="config-calibrate-card"></div>`;
  mountLanguageSelector(document.getElementById("config-lang-slot"), { onPick: lang => chooseLanguage(lang, { persist: true, toast }) });
  document.getElementById("btn-config-back").addEventListener("click", () => {
    goSection(S._lastSection !== "config" ? S._lastSection : "import");
  });
  try {
    const data = await api.settings();
    renderSettingsForm(document.getElementById("config-body"), data, {
      initialSection: S._configTab,
      onSection: slug => { S._configTab = slug; syncRoute(); },
      onSave: async (values) => {
        const result = await api.saveSettings(values);
        toast("Configuración guardada. Los cálculos ya usan los valores nuevos.");
        S._teamData = null; S._clutchData = null;
        renderConfig();
      },
      onReset: async (body) => {
        const result = await api.resetSettings(body);
        toast("Valores restablecidos.");
        S._teamData = null; S._clutchData = null;
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
export async function renderCalibrationCard(el) {
  if (!el) return;
  if (!S._isAdmin) { el.innerHTML = ""; return; }

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
            S._teamData = null; S._clutchData = null;
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
