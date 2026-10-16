/**
 * Shot chart SVG — half court, estilo "El Metro" (cancha clara, heatmap por percentil).
 * Extraído de app.js (C-03): geometría y paleta compartidas entre el modo 11 zonas
 * (coords reales) y el modo simplificado de 3 zonas (fallback sin coordenadas).
 */
import { percentileColor } from "../core/colors.js";
import { sampleBadge } from "./sample-badge.js";
import { DEC1, DEC2 } from "../core/format.js";

// ── Geometría de la media cancha ──────────────────────────────────────────
const SC_W = 340, SC_H = 320;
const SC_cx = 170, SC_cy = 256;
const SC_cL = 20, SC_cR = 320, SC_cT = 8, SC_cB = 288;
const SC_r3 = 135, SC_rP = 50;
const SC_pbX1 = 121, SC_pbX2 = 219, SC_pbTop = 140;
const SC_c3xL = 38, SC_c3xR = 302;
const SC_c3yJoin = Math.round(SC_cy - Math.sqrt(SC_r3 * SC_r3 - (SC_cx - SC_c3xL) ** 2));

const SC_courtBg = "#f3f6fa", SC_paintBg = "#c7d8ec", SC_restrictBg = "#b4c8e6",
      SC_cornerBg = "#efe9c4", SC_line = "#46566a", SC_boxText = "#1f2937";

// ── Nombres de zona para tooltip ──────────────────────────────────────────
const ZONE_LABELS = {
  restricted_area:   "Zona restringida",
  mid_top:           "Media distancia central",
  mid_left_far:      "Media izquierda lejana",
  mid_right_far:     "Media derecha lejana",
  mid_left_close:    "Media izquierda cercana",
  mid_right_close:   "Media derecha cercana",
  top_key_3:         "Triple central",
  left_wing_3:       "Triple ala izquierda",
  right_wing_3:      "Triple ala derecha",
  left_corner_3:     "Triple esquina izquierda",
  right_corner_3:    "Triple esquina derecha",
};

// ── Helpers SVG internos ──────────────────────────────────────────────────

function _scHCirc(r) {
  return `M${SC_cx - r},${SC_cy} A${r},${r} 0 0,0 ${SC_cx + r},${SC_cy} Z`;
}

function _scSpoke(deg) {
  const t = deg * Math.PI / 180;
  const x1 = SC_cx + SC_rP * Math.cos(t),  y1 = SC_cy - SC_rP * Math.sin(t);
  const x2 = SC_cx + 250 * Math.cos(t),    y2 = SC_cy - 250 * Math.sin(t);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${SC_line}" stroke-width="1.2" clip-path="url(#sc-clip)"/>`;
}

/**
 * Caja de estadística por zona. Campos del nuevo endpoint /api/shot-zones:
 * fg_pct, efg_pct, ppt, share, percentile, sample.
 * Color por percentil (percentileColor); gris neutro si percentile es null.
 */
function _scLbl(zones, totalShots, key, lx, ly) {
  const z = zones?.[key];
  if (!z) return '';
  // Zona con 0 intentos: caja gris chica con "—"
  if (!z.attempts) {
    const sw = 30, sh = 20, sr = 4;
    const sx0 = lx - sw / 2, sy0 = ly - sh / 2;
    return `
      <rect x="${sx0}" y="${sy0}" width="${sw}" height="${sh}" rx="${sr}" fill="#d1d5db" stroke="rgba(0,0,0,0.15)" stroke-width="0.6" data-zone="${key}" style="cursor:pointer"/>
      <text x="${lx}" y="${ly + 4}" text-anchor="middle" fill="${SC_boxText}" font-size="11" font-weight="700" font-family="Inter,sans-serif">—</text>`;
  }
  const share = DEC1(z.share * 100);
  const ppt   = z.ppt != null ? DEC2(z.ppt) : '—';
  const fg    = z.fg_pct != null ? DEC1(z.fg_pct * 100) + '%' : '—';
  const efg   = z.efg_pct != null ? DEC1(z.efg_pct * 100) + '%' : '—';
  const bg    = z.percentile != null ? percentileColor(z.percentile) : '#d1d5db';
  const w = 54, h = 44, r = 4;
  const x0 = lx - w / 2, y0 = ly - h / 2;
  return `
    <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="${bg}" stroke="rgba(0,0,0,0.25)" stroke-width="0.8" data-zone="${key}" style="cursor:pointer"/>
    <text x="${lx - 5}" y="${ly - 11}" text-anchor="end"   fill="rgba(0,0,0,0.70)" font-size="7.5" font-family="Inter,sans-serif">${share}%</text>
    <text x="${lx + 4}" y="${ly - 11}" text-anchor="start" fill="rgba(0,0,0,0.70)" font-size="7.5" font-family="Inter,sans-serif">PPT ${ppt}</text>
    <text x="${lx}"     y="${ly + 5}"  text-anchor="middle" fill="${SC_boxText}" font-size="14" font-weight="800" font-family="Inter,sans-serif">${fg}</text>
    <text x="${lx}"     y="${ly + 16}" text-anchor="middle" fill="rgba(0,0,0,0.70)" font-size="7.5" font-family="Inter,sans-serif">eFG ${efg}</text>`;
}

function _scBadge(summary) {
  if (!summary) return '';
  const pf  = summary.ppt     != null ? DEC2(summary.ppt) : '—';
  const efg = summary.efg_pct != null ? DEC1(summary.efg_pct * 100) + ' %' : '—';
  const cw = 70, ch = 38, bx = SC_cR - 2 * cw, by = SC_cT + 2;
  return `
    <rect x="${bx}"      y="${by}" width="${cw}" height="${ch}" rx="4" fill="#ef8b3a"/>
    <rect x="${bx + cw}" y="${by}" width="${cw}" height="${ch}" rx="4" fill="#9aa83a"/>
    <text x="${bx + cw/2}"        y="${by + 14}" text-anchor="middle" fill="rgba(0,0,0,0.65)" font-size="9"  font-family="Inter,sans-serif">PPT</text>
    <text x="${bx + cw/2}"        y="${by + 31}" text-anchor="middle" fill="${SC_boxText}" font-size="15" font-weight="800" font-family="Inter,sans-serif">${pf}</text>
    <text x="${bx + cw + cw/2}"   y="${by + 14}" text-anchor="middle" fill="rgba(0,0,0,0.65)" font-size="9"  font-family="Inter,sans-serif">eFG%</text>
    <text x="${bx + cw + cw/2}"   y="${by + 31}" text-anchor="middle" fill="${SC_boxText}" font-size="15" font-weight="800" font-family="Inter,sans-serif">${efg}</text>`;
}

function _courtLinesSVG() {
  return `
    <rect width="${SC_W}" height="${SC_H}" fill="${SC_courtBg}" rx="8"/>
    <rect x="${SC_cL}" y="${SC_cT}" width="${SC_cR-SC_cL}" height="${SC_cB-SC_cT}" fill="${SC_courtBg}" rx="3"/>
    <!-- Esquinas amarillas (fuera de la linea de 3 lateral) -->
    <rect x="${SC_cL}"   y="${SC_c3yJoin}" width="${SC_c3xL-SC_cL}" height="${SC_cB-SC_c3yJoin}" fill="${SC_cornerBg}" clip-path="url(#sc-clip)"/>
    <rect x="${SC_c3xR}" y="${SC_c3yJoin}" width="${SC_cR-SC_c3xR}" height="${SC_cB-SC_c3yJoin}" fill="${SC_cornerBg}" clip-path="url(#sc-clip)"/>
    <!-- Pintura + zona restringida (azul) -->
    <rect x="${SC_pbX1}" y="${SC_pbTop}" width="${SC_pbX2-SC_pbX1}" height="${SC_cB-SC_pbTop}" fill="${SC_paintBg}" clip-path="url(#sc-clip)"/>
    <path d="${_scHCirc(SC_rP)}" fill="${SC_restrictBg}" clip-path="url(#sc-clip)"/>
    <!-- Spokes (sectores) -->
    ${_scSpoke(150)}${_scSpoke(108)}${_scSpoke(72)}${_scSpoke(30)}
    <!-- Lineas de cancha -->
    <rect x="${SC_cL}" y="${SC_cT}" width="${SC_cR-SC_cL}" height="${SC_cB-SC_cT}" fill="none" stroke="${SC_line}" stroke-width="1.5" rx="3"/>
    <rect x="${SC_pbX1}" y="${SC_pbTop}" width="${SC_pbX2-SC_pbX1}" height="${SC_cB-SC_pbTop}" fill="none" stroke="${SC_line}" stroke-width="1.5"/>
    <path d="M${SC_pbX1},${SC_pbTop} A49,49 0 0,0 ${SC_pbX2},${SC_pbTop}" fill="none" stroke="${SC_line}" stroke-width="1.5" stroke-dasharray="4,3"/>
    <path d="M${SC_c3xL},${SC_cB} L${SC_c3xL},${SC_c3yJoin} A${SC_r3},${SC_r3} 0 0,0 ${SC_c3xR},${SC_c3yJoin} L${SC_c3xR},${SC_cB}" fill="none" stroke="${SC_line}" stroke-width="1.5"/>
    <path d="M${SC_cx-SC_rP},${SC_cy} A${SC_rP},${SC_rP} 0 0,0 ${SC_cx+SC_rP},${SC_cy}" fill="none" stroke="${SC_line}" stroke-width="1.2"/>
    <circle cx="${SC_cx}" cy="${SC_cy}" r="9" fill="none" stroke="#c2611f" stroke-width="2"/>
    <line x1="${SC_cx-26}" y1="${SC_cB-3}" x2="${SC_cx+26}" y2="${SC_cB-3}" stroke="${SC_line}" stroke-width="3"/>`;
}

function _scSvgWrap(inner) {
  return `<svg viewBox="0 0 ${SC_W} ${SC_H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:440px;margin:0 auto;display:block;border-radius:8px">
    <defs>
      <clipPath id="sc-clip"><rect x="${SC_cL}" y="${SC_cT}" width="${SC_cR-SC_cL}" height="${SC_cB-SC_cT}"/></clipPath>
    </defs>
    ${inner}
  </svg>`;
}

// 11 zonas — requiere coordenadas reales de tiro (array `shot` de FIBA con x/y)
function _shotChart11SVG(zones, totalShots, summary) {
  return _scSvgWrap(`
    ${_courtLinesSVG()}
    <!-- Cajas de estadistica por zona (heatmap) -->
    ${_scLbl(zones, totalShots, 'top_key_3',       SC_cx,          70)}
    ${_scLbl(zones, totalShots, 'left_wing_3',     SC_cL + 34,    150)}
    ${_scLbl(zones, totalShots, 'right_wing_3',    SC_cR - 34,    150)}
    ${_scLbl(zones, totalShots, 'mid_top',         SC_cx,         162)}
    ${_scLbl(zones, totalShots, 'mid_left_far',    SC_cx - 64,    206)}
    ${_scLbl(zones, totalShots, 'mid_right_far',   SC_cx + 64,    206)}
    ${_scLbl(zones, totalShots, 'restricted_area', SC_cx,         236)}
    ${_scLbl(zones, totalShots, 'mid_left_close',  SC_cx - 64,    263)}
    ${_scLbl(zones, totalShots, 'mid_right_close', SC_cx + 64,    263)}
    ${_scLbl(zones, totalShots, 'left_corner_3',   SC_cL + 30,    263)}
    ${_scLbl(zones, totalShots, 'right_corner_3',  SC_cR - 30,    263)}
    ${_scBadge(summary)}`);
}

// 3 zonas — fallback cuando el partido no trae coordenadas de tiro
function _shotChart3SVG(zones, totalShots, summary) {
  return _scSvgWrap(`
    ${_courtLinesSVG()}
    <!-- Cajas de estadistica: Triple / Media / Pintura -->
    ${_scLbl(zones, totalShots, 'top_key_3',       SC_cx, 70)}
    ${_scLbl(zones, totalShots, 'mid_top',         SC_cx, 162)}
    ${_scLbl(zones, totalShots, 'restricted_area', SC_cx, 236)}
    ${_scBadge(summary)}`);
}

// ── Exports ───────────────────────────────────────────────────────────────

/**
 * Renderiza el SVG del shot chart a partir del payload de /api/shot-zones.
 * @param {object} payload  — { zones, summary, has_coordinates, context }
 * @param {object} [opts]   — { mode, colorBy } (colorBy default "percentile")
 * @returns {string} HTML string del SVG
 */
export function shotChart(payload, opts = {}) {
  const { zones, summary, has_coordinates } = payload;
  const totalShots = summary?.total_shots || 0;
  const mode = has_coordinates === false ? 3 : 11;
  return mode === 3
    ? _shotChart3SVG(zones, totalShots, summary)
    : _shotChart11SVG(zones, totalShots, summary);
}

// ── Tooltip / bottom-sheet ────────────────────────────────────────────────

function _tooltipHTML(key, z) {
  const label = ZONE_LABELS[key] || key;
  if (!z || !z.attempts) {
    return `<div class="sc-ci">${label}</div><div>Sin tiros registrados en esta zona.</div>`;
  }
  const fg  = z.fg_pct  != null ? DEC1(z.fg_pct  * 100) + '%' : '—';
  const efg = z.efg_pct != null ? DEC1(z.efg_pct * 100) + '%' : '—';
  const ppt = z.ppt     != null ? DEC2(z.ppt) : '—';
  const share = DEC1(z.share * 100);
  const pctLine = z.percentile != null
    ? `Percentil ${z.percentile}`
    : 'Sin datos de percentil';
  const badge = z.sample && z.sample.level !== "alta"
    ? sampleBadge(z.sample, { compact: true })
    : '';
  return `
    <div class="sc-ci">${label}</div>
    <div class="sc-row"><span>${z.made}/${z.attempts}</span></div>
    <div class="sc-row"><span>FG%</span><span>${fg}</span></div>
    <div class="sc-row"><span>eFG%</span><span>${efg}</span></div>
    <div class="sc-row"><span>PPT</span><span>${ppt}</span></div>
    <div class="sc-row"><span class="sc-pct">${share}% de los tiros</span></div>
    <div class="sc-row"><span>${pctLine}</span></div>
    ${badge ? `<div style="margin-top:4px">${badge}</div>` : ''}`;
}

function _removeTooltip() {
  document.querySelectorAll('.sc-tooltip').forEach(el => el.remove());
}

function _removeSheet() {
  document.querySelectorAll('.sc-sheet, .sc-sheet-backdrop').forEach(el => el.remove());
}

/**
 * Enlaza tooltips (desktop: hover, mobile: bottom sheet) a los elementos
 * [data-zone] dentro del contenedor `el`.
 * @param {HTMLElement} el       — contenedor del SVG
 * @param {object}      payload  — respuesta de /api/shot-zones
 */
export function bindZoneTooltips(el, payload) {
  const zones = payload?.zones;
  if (!zones) return;
  const zoneEls = el.querySelectorAll('[data-zone]');
  const canHover = matchMedia("(hover: hover)").matches;

  zoneEls.forEach(zEl => {
    const key = zEl.getAttribute('data-zone');
    const z = zones[key];

    if (canHover) {
      // Desktop: tooltip near cursor
      zEl.addEventListener('mouseenter', e => {
        _removeTooltip();
        const tip = document.createElement('div');
        tip.className = 'sc-tooltip';
        tip.innerHTML = _tooltipHTML(key, z);
        document.body.appendChild(tip);
        _positionTooltip(tip, e.clientX, e.clientY);
      });
      zEl.addEventListener('mousemove', e => {
        const tip = document.querySelector('.sc-tooltip');
        if (tip) _positionTooltip(tip, e.clientX, e.clientY);
      });
      zEl.addEventListener('mouseleave', () => _removeTooltip());
    } else {
      // Mobile: bottom sheet
      zEl.addEventListener('click', e => {
        e.stopPropagation();
        const existing = document.querySelector('.sc-sheet');
        if (existing && existing.dataset.zone === key) {
          _removeSheet();
          return;
        }
        _removeSheet();
        const backdrop = document.createElement('div');
        backdrop.className = 'sc-sheet-backdrop';
        backdrop.addEventListener('click', () => _removeSheet());

        const sheet = document.createElement('div');
        sheet.className = 'sc-sheet';
        sheet.dataset.zone = key;
        sheet.innerHTML = `<button class="sc-close" aria-label="Cerrar">&times;</button>${_tooltipHTML(key, z)}`;
        sheet.querySelector('.sc-close').addEventListener('click', () => _removeSheet());

        document.body.appendChild(backdrop);
        document.body.appendChild(sheet);
      });
      zEl.addEventListener('touchstart', e => {
        // Prevent duplicate from click
        e.preventDefault();
        zEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, { passive: false });
    }
  });
}

function _positionTooltip(tip, mx, my) {
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = mx + pad;
  let y = my + pad;
  // Clamp to viewport
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  if (x + tw > vw - pad) x = mx - tw - pad;
  if (y + th > vh - pad) y = my - th - pad;
  if (x < pad) x = pad;
  if (y < pad) y = pad;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}
