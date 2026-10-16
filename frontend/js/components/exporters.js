// ── Exportadores en el cliente (T-06) ────────────────────────────────────────
// CSV, PNG (SVG foreignObject) y PDF (window.print()). El XLSX lo genera el servidor
// (api.exportXlsx). Ningún número se calcula acá: solo se serializa lo que ya vino del
// backend. Separador y coma decimal salen de la configuración (export.csv_separator).

import { api } from "../api.js";

let _csvSep = ";";   // cache de export.csv_separator (una lectura por sesión)
let _sepLoaded = false;
export async function loadCsvSeparator() {
  if (_sepLoaded) return _csvSep;
  try {
    const s = await api.settings();
    const v = s?.values?.["export.csv_separator"];
    const sep = typeof v === "object" ? v?.value : v;
    if (sep === "," || sep === ";") _csvSep = sep;
  } catch { /* usa el default ";" */ }
  _sepLoaded = true;
  return _csvSep;
}

// ── Descarga de un Blob ──────────────────────────────────────────────────────
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "descarga";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Cabecera de metadatos (compartida por CSV y vista) ───────────────────────
const _pad2 = n => String(n).padStart(2, "0");
function _fmtDateTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d)) return iso || "";
  return `${_pad2(d.getDate())}/${_pad2(d.getMonth() + 1)}/${d.getFullYear()} ${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
}

// Líneas legibles "Clave: valor" para la cabecera (CSV → `# …`, vista → filas).
function _headerLines(meta, pageInfo) {
  const m = meta || {};
  const lines = [];
  if (m.title) lines.push(["Título", m.title]);
  if (m.entity?.name) lines.push(["Entidad", m.entity.name]);
  if (m.competition?.label) lines.push(["Competencia", m.competition.label]);
  if (m.competition?.season) lines.push(["Temporada", m.competition.season]);
  const filters = (m.filters || []).map(f => `${f.label}=${f.value}`).join("; ");
  if (filters) lines.push(["Filtros", filters]);
  if (m.base?.label) lines.push(["Base", m.base.label]);
  if (m.sort?.label) lines.push(["Orden", m.sort.label]);
  if (m.columns_visible) lines.push(["Columnas visibles", m.columns_visible.join(", ")]);
  const gen = `${_fmtDateTime(m.generated_at)}${m.generated_by ? ` por ${m.generated_by}` : ""}`;
  lines.push(["Generado el", gen]);
  if (pageInfo) lines.push(["Filas", pageInfo]);
  return lines;
}

// ── CSV (T-D2) ───────────────────────────────────────────────────────────────
// BOM + líneas `# clave: valor` + títulos (pct → "col (%)") + filas. Nulo → vacío.
// Decimal coma si sep=";", punto si ",". Anti-inyección de fórmulas con prefijo "'".
export function toCSV({ meta, columns, rows, footer }) {
  const sep = _csvSep;
  const decComma = sep === ";";
  const cols = columns || [];

  const num = (v, fmt) => {
    if (v == null || (typeof v === "number" && !isFinite(v))) return "";
    let n = Number(v);
    if (isNaN(n)) return String(v);
    let s;
    if (fmt === "pct") s = (n * 100).toFixed(1);
    else if (fmt === "dec1") s = n.toFixed(1);
    else if (fmt === "dec2" || fmt === "signed_dec2") s = n.toFixed(2);
    else if (fmt === "int" || fmt === "signed_int") s = Math.round(n).toString();
    else s = String(n);
    return decComma ? s.replace(".", ",") : s;
  };

  const esc = raw => {
    let s = raw == null ? "" : String(raw);
    // Anti-inyección: texto que empieza con = + - @ se prefija con '
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    if (s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  // El número ya es seguro (sin sep/comillas), así que no necesita escaparse.
  const cell = (v, fmt) => fmt === "text" ? esc(v) : num(v, fmt);

  const lines = [];
  for (const [k, val] of _headerLines(meta)) lines.push(`# ${k}: ${esc(val)}`);
  lines.push("# Celda vacía = dato inexistente (—)");
  lines.push(cols.map(c => esc(c.fmt === "pct" ? `${c.label} (%)` : c.label)).join(sep));
  for (const r of rows || []) lines.push(cols.map((c, i) => cell(r[i], c.fmt)).join(sep));
  for (const f of footer || []) lines.push(cols.map((c, i) => cell(f[i], c.fmt)).join(sep));

  const text = "﻿" + lines.join("\r\n") + "\r\n";
  return new Blob([text], { type: "text/csv;charset=utf-8" });
}

// ── Lectura de un <table> ya renderizado (tablas no migradas, T-D10) ─────────
// Devuelve {meta, columns, rows} con el texto visible de las celdas. `fmt` = "text"
// (ya formateado en pantalla): el CSV lo exporta tal cual y el XLSX como texto.
export function tableToData(tableEl, meta) {
  const headRow = tableEl.querySelector("thead tr");
  const ths = headRow ? [...headRow.children] : [];
  const columns = ths.map((th, i) => ({ key: `c${i}`, label: th.textContent.trim(), fmt: "text" }));
  const rows = [...tableEl.querySelectorAll("tbody tr")].map(tr =>
    [...tr.children].map(td => td.textContent.trim()));
  // El pie (tfoot) se incluye como filas extra para no perder totales/promedios visibles.
  const footer = [...tableEl.querySelectorAll("tfoot tr")].map(tr =>
    [...tr.children].map(td => td.textContent.trim()));
  return { meta, columns, rows, footer };
}

// ── Nodo de exportación visual con cabecera (interno, usado por PNG/PDF) ──────
export function buildExportNode(node, meta, pageInfo) {
  const wrap = document.createElement("div");
  wrap.className = "xm-export-node";
  wrap.style.cssText = "background:var(--bg,#0d1117);color:var(--fg,#e6edf3);padding:20px;width:1200px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif";

  const head = document.createElement("div");
  head.className = "xm-export-head";
  head.style.cssText = "margin-bottom:16px;border-bottom:1px solid var(--border,#30363d);padding-bottom:12px";
  const title = meta?.title || "Exportación";
  const rows = _headerLines(meta, pageInfo)
    .filter(([k]) => k !== "Título")
    .map(([k, v]) => `<div style="font-size:12px;color:var(--muted,#8b949e)"><span style="font-weight:600">${k}:</span> ${_escHtml(v)}</div>`)
    .join("");
  head.innerHTML = `<div style="font-size:18px;font-weight:700;margin-bottom:6px">${_escHtml(title)}</div>${rows}`;
  wrap.appendChild(head);

  wrap.appendChild(node.cloneNode(true));
  return wrap;
}

function _escHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── PNG (T-D3) ───────────────────────────────────────────────────────────────
// SVG foreignObject con estilos computados inline (lista blanca). Rechaza en
// SecurityError (canvas contaminado en Safari/iOS) → el menú cae a PDF.
const _STYLE_PROPS = [
  "color", "background-color", "background", "font-family", "font-size", "font-weight",
  "font-style", "text-align", "padding", "padding-top", "padding-right", "padding-bottom",
  "padding-left", "margin", "border", "border-top", "border-right", "border-bottom",
  "border-left", "border-color", "border-width", "border-style", "border-radius",
  "width", "height", "line-height", "vertical-align", "white-space", "text-transform",
  "letter-spacing", "box-sizing", "display", "opacity",
];

function _inlineStyles(src, dst) {
  const cs = getComputedStyle(src);
  let decl = "";
  for (const p of _STYLE_PROPS) {
    const v = cs.getPropertyValue(p);
    if (v) decl += `${p}:${v};`;
  }
  dst.setAttribute("style", decl + (dst.getAttribute("style") || ""));
  const sk = src.children, dk = dst.children;
  for (let i = 0; i < sk.length && i < dk.length; i++) _inlineStyles(sk[i], dk[i]);
}

export function toPNG(node, { width = 1200 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const clone = node.cloneNode(true);
      // canvas → <img> (foreignObject no serializa <canvas>)
      const srcCanvases = node.querySelectorAll("canvas");
      const dstCanvases = clone.querySelectorAll("canvas");
      for (let i = 0; i < srcCanvases.length; i++) {
        try {
          const img = document.createElement("img");
          img.src = srcCanvases[i].toDataURL();
          dstCanvases[i].replaceWith(img);
        } catch (e) { return reject(e); }
      }
      // Monta el clon fuera de pantalla para medir y copiar estilos computados
      const stage = document.createElement("div");
      stage.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px`;
      stage.appendChild(clone);
      document.body.appendChild(stage);
      _inlineStyles(node, clone);
      const rect = clone.getBoundingClientRect();
      const w = Math.ceil(rect.width) || width;
      const h = Math.ceil(rect.height) || 600;
      const xml = new XMLSerializer().serializeToString(clone);
      stage.remove();

      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<foreignObject width="100%" height="100%">` +
        `<div xmlns="http://www.w3.org/1999/xhtml">${xml}</div>` +
        `</foreignObject></svg>`;
      const img = new Image();
      img.onload = () => {
        try {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const canvas = document.createElement("canvas");
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          const ctx = canvas.getContext("2d");
          ctx.scale(dpr, dpr);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("toBlob vacío")), "image/png");
        } catch (e) { reject(e); }   // SecurityError → fallback a PDF
      };
      img.onerror = () => reject(new Error("No se pudo renderizar la imagen"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    } catch (e) { reject(e); }
  });
}

// ── PDF por window.print() (T-D3) ────────────────────────────────────────────
// Inserta #print-root con el nodo (ya trae cabecera vía buildExportNode) y
// body.printing; @media print en style.css oculta todo lo demás.
export function printNode(node, { pageSize = "A4" } = {}) {
  const prev = document.getElementById("print-root");
  if (prev) prev.remove();
  const root = document.createElement("div");
  root.id = "print-root";
  root.appendChild(node);
  document.body.appendChild(root);
  document.body.classList.add("printing");

  const cleanup = () => {
    document.body.classList.remove("printing");
    const r = document.getElementById("print-root");
    if (r) r.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Da un tick para que el navegador pinte el clon antes de abrir el diálogo.
  setTimeout(() => { window.print(); }, 50);
}
