// ── Menú de exportación (T-06) ────────────────────────────────────────────────
// Botón "Exportar" + menú CSV/XLSX/PNG/PDF (hoja inferior en móvil). `getData` devuelve
// {meta, columns, rows, footer, pageInfo}; `getNode` el nodo visible para PNG/PDF.

import { api } from "../api.js";
import { toCSV, toPNG, printNode, downloadBlob, buildExportNode, loadCsvSeparator } from "./exporters.js";

const DEFAULT_FORMATS = ["csv", "xlsx", "png", "pdf"];
const FORMAT_LABEL = { csv: "CSV", xlsx: "XLSX", png: "PNG", pdf: "PDF" };

function _toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
}

function _nameWithExt(meta, ext) {
  const base = meta?.file_name || "exportacion";
  return `${base}.${ext}`;
}

export function exportMenu(el, { getData, getNode, formats, render, pngWidth } = {}) {
  // `render.png` / `render.pdf`: nodo ya completo (con su propia cabecera) para informes; reemplaza
  // el clon de la tabla visible + cabecera de metadatos.
  const fmts = formats || DEFAULT_FORMATS;
  loadCsvSeparator();   // precalienta el separador para el CSV offline

  el.classList.add("xm-wrap");
  el.innerHTML = `
    <button class="btn btn-ghost btn-sm xm-btn" type="button" aria-haspopup="menu" aria-expanded="false">⬇ Exportar</button>
    <div class="xm-menu" role="menu" hidden>
      ${fmts.map(f => `<button class="xm-item" role="menuitem" data-fmt="${f}" type="button">${FORMAT_LABEL[f] || f}</button>`).join("")}
    </div>`;

  const btn = el.querySelector(".xm-btn");
  const menu = el.querySelector(".xm-menu");

  const closeMenu = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); el.classList.remove("xm-open"); };
  const openMenu = () => { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); el.classList.add("xm-open"); };

  btn.addEventListener("click", e => {
    e.stopPropagation();
    menu.hidden ? openMenu() : closeMenu();
  });
  document.addEventListener("click", e => { if (!el.contains(e.target)) closeMenu(); });

  menu.querySelectorAll(".xm-item").forEach(item => {
    item.addEventListener("click", async () => {
      const fmt = item.dataset.fmt;
      closeMenu();
      await _run(fmt, btn, getData, getNode, render, pngWidth);
    });
  });

  return { destroy() { el.innerHTML = ""; el.classList.remove("xm-wrap", "xm-open"); } };
}

async function _run(fmt, btn, getData, getNode, render, pngWidth) {
  const prevLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando archivo…";
  try {
    if (fmt === "csv")  await _csv(getData);
    if (fmt === "xlsx") await _xlsx(getData);
    if (fmt === "png")  await (render?.png ? _pngNode(getData, render.png, pngWidth) : _png(getData, getNode));
    if (fmt === "pdf")  await (render?.pdf ? printNode(render.pdf(), { pageSize: "A4" }) : _pdf(getData, getNode));
  } catch (e) {
    _toast(`No se pudo exportar: ${e.message || e}`, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = prevLabel;
  }
}

async function _csv(getData) {
  const data = getData();
  const blob = toCSV(data);
  const name = _nameWithExt(data.meta, "csv");
  downloadBlob(blob, name);
  _toast(`Archivo generado: ${name}`);
}

async function _xlsx(getData) {
  const data = getData();
  if (navigator.onLine === false) {
    _toast("Sin conexión: el XLSX se genera en el servidor. Probá con CSV.", "err");
    return;
  }
  const meta = data.meta || {};
  const sheetName = (meta.title || "Datos").slice(0, 31);
  try {
    const { blob, fileName } = await api.exportXlsx({
      meta,
      sheets: [{ name: sheetName, columns: data.columns, rows: data.rows, footer: data.footer || [] }],
    });
    const name = fileName || _nameWithExt(meta, "xlsx");
    downloadBlob(blob, name);
    _toast(`Archivo generado: ${name}`);
  } catch (e) {
    if (e instanceof TypeError || navigator.onLine === false) {
      _toast("Sin conexión: el XLSX se genera en el servidor. Probá con CSV.", "err");
    } else if (e.status === 413) {
      _toast("La tabla es demasiado grande para exportar en XLSX; exportá en CSV.", "err");
    } else {
      _toast(`No se pudo exportar: ${e.message || e}`, "err");
    }
  }
}

async function _pngNode(getData, build, width = 1200) {
  const data = getData();
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-99999px;top:0";
  const node = build();
  stage.appendChild(node);
  document.body.appendChild(stage);
  try {
    const blob = await toPNG(node, { width });
    const name = _nameWithExt(data.meta, "png");
    downloadBlob(blob, name);
    _toast(`Archivo generado: ${name}`);
  } catch {
    _toast("No se pudo generar la imagen en este navegador. Probá con PDF.", "err");
  } finally {
    stage.remove();
  }
}

async function _png(getData, getNode) {
  const data = getData();
  const node = buildExportNode(getNode(), data.meta, data.pageInfo);
  try {
    const blob = await toPNG(node, { width: 1200 });
    const name = _nameWithExt(data.meta, "png");
    downloadBlob(blob, name);
    _toast(`Archivo generado: ${name}`);
  } catch {
    _toast("No se pudo generar la imagen en este navegador. Probá con PDF.", "err");
  }
}

async function _pdf(getData, getNode) {
  const data = getData();
  const node = buildExportNode(getNode(), data.meta, data.pageInfo);
  printNode(node, { pageSize: "A4" });
}
