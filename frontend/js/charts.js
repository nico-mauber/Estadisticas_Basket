/**
 * Smart-Basket chart helpers — Chart.js v4
 * All functions destroy previous instance before re-creating.
 */

const _instances = {};

function _destroy(id) {
  if (_instances[id]) { _instances[id].destroy(); delete _instances[id]; }
}

export function resetZoom(canvasId) {
  if (_instances[canvasId]) _instances[canvasId].resetZoom();
}

// ── Colour palette ──────────────────────────────────────────────────────────
const C = {
  accent:  "rgba(249,115,22,1)",
  accentA: "rgba(249,115,22,0.15)",
  blue:    "rgba(59,130,246,1)",
  blueA:   "rgba(59,130,246,0.15)",
  green:   "rgba(34,197,94,1)",
  muted:   "rgba(139,148,158,1)",
  mutedA:  "rgba(139,148,158,0.2)",
  grid:    "rgba(48,54,61,1)",
  text:    "rgba(230,237,243,0.85)",
};

// Apply defaults lazily on first use
let _defaultsApplied = false;
function _applyDefaults() {
  if (_defaultsApplied) return;
  _defaultsApplied = true;
  Chart.defaults.color = C.text;
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.font.size = 12;
}

// ── Normalize a value to 0-100 relative to league ──────────────────────────
function _norm(value, leagueKey, league, higherIsBetter = true) {
  const lg = league?.[leagueKey];
  if (!lg || value == null) return 0;
  const best  = lg.best;
  const avg   = lg.avg;
  // Estimate "worst" symmetrically from avg
  const worst = higherIsBetter ? Math.max(0, avg * 2 - best) : avg * 2 - best;
  const range = Math.abs(best - worst);
  if (!range) return 50;
  const score = higherIsBetter
    ? ((value - worst) / range) * 100
    : ((worst - value) / range) * 100;
  return Math.min(100, Math.max(0, score));
}

// ── Radar ───────────────────────────────────────────────────────────────────
export function drawRadar(canvasId, averages, league, label = "Equipo") {
  _applyDefaults();
  _destroy(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dims = [
    { key: "oer",     label: "Ataque",      hib: true  },
    { key: "der",     label: "Defensa",     hib: false },
    { key: "efg_pct", label: "eFG%",        hib: true  },
    { key: "ts_pct",  label: "TS%",         hib: true  },
    { key: "or_pct",  label: "Reb. Of.",    hib: true  },
    { key: "dr_pct",  label: "Reb. Def.",   hib: true  },
    { key: "to_pct",  label: "Cuida pelota",hib: false },
    { key: "as_pct",  label: "Asistencias", hib: true  },
  ];

  const teamScores = dims.map(d => _norm(averages[d.key], d.key, league, d.hib));
  const avgScores  = dims.map(() => 50); // league average always = 50 by construction

  _instances[canvasId] = new Chart(canvas, {
    type: "radar",
    data: {
      labels: dims.map(d => d.label),
      datasets: [
        {
          label: label,
          data: teamScores,
          borderColor: C.accent,
          backgroundColor: C.accentA,
          borderWidth: 2,
          pointBackgroundColor: C.accent,
          pointRadius: 3,
        },
        {
          label: "Promedio liga",
          data: avgScores,
          borderColor: C.muted,
          backgroundColor: C.mutedA,
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointBackgroundColor: C.muted,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false, stepSize: 25 },
          grid:        { color: C.grid },
          angleLines:  { color: C.grid },
          pointLabels: { color: C.text, font: { size: 11 } },
        },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(0)}/100`,
          },
        },
      },
    },
  });
}

// ── Radar — two-team comparison ────────────────────────────────────────────
export function drawCompareRadar(canvasId, avgA, avgB, league, labelA, labelB) {
  _applyDefaults();
  _destroy(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dims = [
    { key: "oer",     label: "Ataque",       hib: true  },
    { key: "der",     label: "Defensa",      hib: false },
    { key: "efg_pct", label: "eFG%",         hib: true  },
    { key: "ts_pct",  label: "TS%",          hib: true  },
    { key: "or_pct",  label: "Reb. Of.",     hib: true  },
    { key: "dr_pct",  label: "Reb. Def.",    hib: true  },
    { key: "to_pct",  label: "Cuida pelota", hib: false },
    { key: "as_pct",  label: "Asistencias",  hib: true  },
  ];

  _instances[canvasId] = new Chart(canvas, {
    type: "radar",
    data: {
      labels: dims.map(d => d.label),
      datasets: [
        {
          label: labelA,
          data: dims.map(d => _norm(avgA[d.key], d.key, league, d.hib)),
          borderColor: C.accent, backgroundColor: C.accentA,
          borderWidth: 2, pointBackgroundColor: C.accent, pointRadius: 3,
        },
        {
          label: labelB,
          data: dims.map(d => _norm(avgB[d.key], d.key, league, d.hib)),
          borderColor: C.blue, backgroundColor: C.blueA,
          borderWidth: 2, pointBackgroundColor: C.blue, pointRadius: 3,
        },
        {
          label: "Promedio liga",
          data: Array(dims.length).fill(50),
          borderColor: C.muted, backgroundColor: C.mutedA,
          borderDash: [4, 4], borderWidth: 1.5,
          pointBackgroundColor: C.muted, pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: C.grid }, angleLines: { color: C.grid },
          pointLabels: { color: C.text, font: { size: 11 } },
        },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(0)}/100` } },
      },
    },
  });
}

// ── Line — evolution per game ───────────────────────────────────────────────
export function drawEvolution(canvasId, gameLog, leagueOerAvg) {
  _applyDefaults();
  _destroy(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !gameLog?.length) return;

  // Sort by date ascending
  const sorted = [...gameLog].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const labels = sorted.map((g, i) => g.date ? g.date.slice(5) : `P${i + 1}`); // MM-DD

  _instances[canvasId] = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "OER",
          data: sorted.map(g => +(g.oer ?? 0).toFixed(3)),
          borderColor: C.accent,
          backgroundColor: C.accentA,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "eFG%",
          data: sorted.map(g => +(((g.efg_pct ?? 0) * 100).toFixed(1))),
          borderColor: C.blue,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          yAxisID: "y2",
        },
        ...(leagueOerAvg != null ? [{
          label: "OER liga Ø",
          data: sorted.map(() => +leagueOerAvg.toFixed(3)),
          borderColor: C.muted,
          backgroundColor: "transparent",
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          yAxisID: "y",
        }] : []),
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { color: C.grid }, ticks: { color: C.muted, maxTicksLimit: 10 } },
        y: {
          grid: { color: C.grid },
          title: { display: true, text: "OER", color: C.muted, font: { size: 11 } },
          position: "left",
        },
        y2: {
          grid: { display: false },
          title: { display: true, text: "eFG%", color: C.blue, font: { size: 11 } },
          position: "right",
          ticks: { color: C.blue, callback: v => v + "%" },
        },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } },
      },
    },
  });
}

// ── Player line — pts + OER per game ───────────────────────────────────────
export function drawPlayerEvolution(canvasId, gameLog) {
  _applyDefaults();
  _destroy(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !gameLog?.length) return;

  const sorted = [...gameLog].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const labels = sorted.map((g, i) => g.date ? g.date.slice(5) : `P${i + 1}`);

  _instances[canvasId] = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Puntos",
          data: sorted.map(g => g.pts ?? 0),
          borderColor: C.accent,
          backgroundColor: C.accentA,
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.3,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "OER",
          data: sorted.map(g => +(g.oer ?? 0).toFixed(3)),
          borderColor: C.green,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          yAxisID: "y2",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { color: C.grid }, ticks: { color: C.muted, maxTicksLimit: 10 } },
        y: {
          grid: { color: C.grid },
          title: { display: true, text: "Pts", color: C.muted, font: { size: 11 } },
          position: "left",
        },
        y2: {
          grid: { display: false },
          title: { display: true, text: "OER", color: C.green, font: { size: 11 } },
          position: "right",
          ticks: { color: C.green },
        },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } },
      },
    },
  });
}

// ── Scatter OER vs DER (league map) ────────────────────────────────────────
export function drawLeagueScatter(canvasId, teams) {
  _applyDefaults();
  _destroy(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !teams?.length) return;

  const avgOer = teams.reduce((s, t) => s + t.oer, 0) / teams.length;
  const avgDer = teams.reduce((s, t) => s + t.der, 0) / teams.length;

  const points = teams.map(t => ({
    x: +t.oer.toFixed(3),
    y: +t.der.toFixed(3),
    label: t.team_name || t.team,
  }));

  _instances[canvasId] = new Chart(canvas, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Equipos",
        data: points,
        backgroundColor: points.map(() => C.accentA.replace("0.15", "0.7")),
        borderColor: C.accent,
        borderWidth: 1.5,
        pointRadius: 7,
        pointHoverRadius: 9,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw;
              return `${p.label}  OER ${p.x}  DER ${p.y}`;
            },
          },
        },
        zoom: {
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "xy",
          },
          pan: {
            enabled: true,
            mode: "xy",
          },
        },
      },
      scales: {
        x: {
          grid: { color: C.grid },
          title: { display: true, text: "OER  (↑ mejor ataque)", color: C.muted },
          ticks: { color: C.muted },
        },
        y: {
          grid: { color: C.grid },
          title: { display: true, text: "DER  (↓ mejor defensa)", color: C.muted },
          ticks: { color: C.muted },
          reverse: false,
        },
      },
    },
    plugins: [{
      // Draw team labels and quadrant lines
      afterDraw(chart) {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        // Quadrant lines at league avg
        const xAvg = xScale.getPixelForValue(avgOer);
        const yAvg = yScale.getPixelForValue(avgDer);
        ctx.save();
        ctx.strokeStyle = "rgba(139,148,158,0.3)";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xAvg, chart.chartArea.top); ctx.lineTo(xAvg, chart.chartArea.bottom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(chart.chartArea.left, yAvg); ctx.lineTo(chart.chartArea.right, yAvg); ctx.stroke();

        // Quadrant labels
        ctx.font = "10px Inter, system-ui";
        ctx.fillStyle = "rgba(139,148,158,0.5)";
        ctx.fillText("↑ Ofensivo", xAvg + 4, chart.chartArea.top + 14);
        ctx.fillText("↓ Defensivo", chart.chartArea.left + 4, yAvg - 6);

        // Team name labels
        ctx.font = "11px Inter, system-ui";
        ctx.fillStyle = C.text;
        chart.data.datasets[0].data.forEach((p, i) => {
          const px = xScale.getPixelForValue(p.x);
          const py = yScale.getPixelForValue(p.y);
          ctx.fillText(p.label, px + 9, py + 4);
        });
        ctx.restore();
      },
    }],
  });
}
