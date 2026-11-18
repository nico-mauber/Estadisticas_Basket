// Vista compare (X-01: extraída de app.js sin cambios de comportamiento).
import { api } from "../api.js";
import { setSection, syncRoute } from "../app.js";
import { drawCompareRadar } from "../charts.js";
import { lineupsFromUrl, renderCompareLineups } from "../components/compare-lineups.js";
import { comparePlayersFromUrl, renderComparePlayers } from "../components/compare-players.js";
import { mountContextBar } from "../components/context-bar.js";
import { getBase } from "../core/base.js";
import { contextParams } from "../core/context.js";
import { DEC1, DEC2, PCT, fmtOrNull } from "../core/format.js";
import { S } from "../state.js";
import { _baseMeta, _mountTableExport, _radarMsg, _refLegend, refreshCompareSelectors, toast } from "./shared.js";

export function _syncLineupsUrl(a, b) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("cmp_qa", a); url.searchParams.set("cmp_qb", b);
    history.replaceState(history.state, "", url);
  } catch { /* la comparación sigue sin dirección */ }
}
export function _initCompareTabs(force = null) {
  const show = which => {
    document.querySelectorAll(".cmp-tab").forEach(b => b.classList.toggle("active", b.dataset.cmp === which));
    document.getElementById("cmp-pane-equipos").style.display = which === "equipos" ? "" : "none";
    const pane = document.getElementById("cmp-pane-jugadores");
    pane.style.display = which === "jugadores" ? "" : "none";
    const qPane = document.getElementById("cmp-pane-quintetos");
    qPane.style.display = which === "quintetos" ? "" : "none";
    if (which === "quintetos" && !qPane.dataset.mounted) {
      qPane.dataset.mounted = "1";
      renderCompareLineups(qPane, { initial: lineupsFromUrl(), params: contextParams(), onSync: _syncLineupsUrl });
    }
    syncRoute();
    if (which === "jugadores" && !pane.dataset.mounted) {
      pane.dataset.mounted = "1";
      renderComparePlayers(pane, { base: getBase(), initial: comparePlayersFromUrl(), params: contextParams() });
    }
    _mountCompareBar(which);
  };
  if (!S._cmpTabsBound) {
    S._cmpTabsBound = true;
    document.querySelectorAll(".cmp-tab").forEach(btn =>
      btn.addEventListener("click", () => show(btn.dataset.cmp)));
  }
  if (force) show(force);
  else if (lineupsFromUrl()) show("quintetos");
  else if (comparePlayersFromUrl()) show("jugadores");
}
// Barra de contexto de Comparar (T-03): el mismo contexto para los dos lados. Jugadores aplica también los niveles
// evento y posesión; equipos y quintetos, el nivel partido (los demás filtros se avisan en la barra).
export function _mountCompareBar(which) {
  const rerun = () => {
    if (which === "jugadores") {
      renderComparePlayers(document.getElementById("cmp-pane-jugadores"), { base: getBase(), initial: comparePlayersFromUrl(), params: contextParams() });
    } else if (which === "quintetos") {
      renderCompareLineups(document.getElementById("cmp-pane-quintetos"), { initial: lineupsFromUrl(), params: contextParams(), onSync: _syncLineupsUrl });
    } else if (document.getElementById("compare-a")?.value && document.getElementById("compare-b")?.value) {
      document.getElementById("btn-compare")?.click();
    }
    _mountCompareBar(which);
  };
  mountContextBar(document.getElementById("cmp-ctx-bar"), {
    competition: document.getElementById("compare-comp")?.value || null, events: which === "jugadores", onChange: rerun,
  });
}
// Abre Comparar › Jugadores con dos jugadores ya elegidos (F-08 RF-5 → F-05 RF-9).
export function showComparePlayers(idA, idB) {
  setSection("compare");
  const pane = document.getElementById("cmp-pane-jugadores");
  pane.dataset.mounted = "1";
  _initCompareTabs("jugadores");
  renderComparePlayers(pane, { base: getBase(), initial: { a: String(idA), b: String(idB) }, params: contextParams() });
}
export async function renderCompare() {
  const sec = document.getElementById("sec-compare");
  if (sec.style.display === "none") setSection("compare");
  _initCompareTabs();
  await refreshCompareSelectors();

  const btnCompare = document.getElementById("btn-compare");
  if (btnCompare._bound) return;
  btnCompare._bound = true;

  btnCompare.addEventListener("click", async () => {
    const codeA = document.getElementById("compare-a").value;
    const codeB = document.getElementById("compare-b").value;
    if (!codeA || !codeB) return toast("Selecciona dos equipos", "err");
    if (codeA === codeB) return toast("Selecciona equipos distintos", "err");

    btnCompare.disabled = true;
    btnCompare.innerHTML = '<span class="spinner"></span>Comparando...';

    try {
      // Misma competencia para ambos equipos y para el `Ø` (RF-11): los promedios los calcula el servidor
      const comp = document.getElementById("compare-comp")?.value || "";
      const params = { ...(comp ? { competition: comp } : {}), ...contextParams() };
      const [dataA, dataB] = await Promise.all([api.team(codeA, params), api.team(codeB, params)]);
      const avA = dataA.averages, avB = dataB.averages;
      const lg  = dataA.league;
      const radarOk = lg?.oer?.avg != null;

      const a = avA, b = avB;
      // Sin dato → "—", nunca 0 (Feature 12 RF-4)
      const N1 = v => v != null ? Math.round(v) : "—";
      // Ganador/perdedor: clase neutra si falta cualquiera de los dos lados — un nulo
      // no se compara ni se pinta con color de rendimiento (RF-3)
      const winCls = (va, vb, lowerBetter = false) =>
        (va == null || vb == null) ? "" : ((lowerBetter ? va <= vb : va >= vb) ? "winner" : "loser");

      const shootRow = (label, madeA, attA, madeB, attB) => {
        const pct  = (m, a) => (m == null || !a) ? null : Math.round(100 * m / a);
        const pctA = pct(madeA, attA), pctB = pct(madeB, attB);
        const shot = (m, a, p) => `${N1(m)}/${N1(a)}` + (p == null ? "" : ` (${p}%)`);
        return `<tr>
          <td class="${winCls(pctA, pctB)}">${shot(madeA, attA, pctA)}</td>
          <td class="lbl">${label}</td>
          <td class="${winCls(pctB, pctA)}">${shot(madeB, attB, pctB)}</td>
        </tr>`;
      };
      const rawRow = (label, va, vb, lowerBetter = false, fmt = DEC1) => `<tr>
          <td class="${winCls(va, vb, lowerBetter)}">${fmt(va)}</td>
          <td class="lbl">${label}</td>
          <td class="${winCls(vb, va, lowerBetter)}">${fmt(vb)}</td>
        </tr>`;

      const pfA = a.pf, pfB = b.pf, oppPfA = a.opp_pf, oppPfB = b.opp_pf;
      const rows = [
        shootRow("LC",      a.fgm,  a.fga,  b.fgm,  b.fga),
        shootRow("2Pts",    a.fgm2, a.fga2, b.fgm2, b.fga2),
        shootRow("3Pts",    a.fgm3, a.fga3, b.fgm3, b.fga3),
        shootRow("1Pt",     a.ftm,  a.fta,  b.ftm,  b.fta),
        rawRow("REB",       a.trb ?? (a.orb + a.drb), b.trb ?? (b.orb + b.drb)),
        rawRow("As",        a.ast,  b.ast),
        rawRow("ST",        a.stl,  b.stl),
        rawRow("Blq",       a.blk,  b.blk),
        rawRow("PER",       a.tov,  b.tov,  true),
        rawRow("AS/PER",    a.ast_to, b.ast_to, false, DEC2),   // acumulado ΣAS/ΣPER (C-04)
        `<tr>
          <td class="${winCls(pfA, pfB, true)}">${N1(pfA)} (${N1(oppPfA)})</td>
          <td class="lbl">FP</td>
          <td class="${winCls(pfB, pfA, true)}">${N1(pfB)} (${N1(oppPfB)})</td>
        </tr>`,
        // Sin `|| 0`: "la competencia no registra ese dato" es NULL, no cero (RF-4)
        rawRow("PtsEnPint", a.paint_pts,         b.paint_pts),
        rawRow("PtsSegCh",  a.second_chance_pts, b.second_chance_pts),
        rawRow("PtPer",     a.pts_from_tov,      b.pts_from_tov),
        rawRow("Pts Banca", a.bench_pts,         b.bench_pts),
        rawRow("PCA",       a.fast_break_pts,    b.fast_break_pts),
      ].join("");

      // Tabla de métricas avanzadas (una fila por equipo, estilo tabla de cierres)
      const advRow = (name, av, color) => `<tr>
        <td style="color:${color};font-weight:600;text-align:left">${name}</td>
        <td>${DEC2(av.oer)}</td><td>${DEC2(av.der)}</td><td>${DEC2(av.net_rating)}</td>
        <td>${PCT(av.efg_pct)}</td><td>${PCT(av.ts_pct)}</td><td>${DEC2(av.pace)}</td>
        <td>${PCT(av.or_pct)}</td><td>${PCT(av.dr_pct)}</td><td>${PCT(av.to_pct)}</td>
        <td>${PCT(av.as_pct)}</td><td>${DEC2(av.pts)}</td><td>${DEC2(av.possessions)}</td>
      </tr>`;

      // Fila "Ø liga": el promedio de la competencia, con los mismos valores que Equipo (RF-4, RF-11)
      const lgCell = (k, f) => `<td>${fmtOrNull(lg?.[k]?.avg, f, lg?.[k]?.reason)}</td>`;
      const lgRow = `<tr>
        <td style="color:var(--muted);font-weight:600;text-align:left">Ø liga</td>
        ${lgCell("oer", DEC2)}${lgCell("der", DEC2)}${lgCell("net_rating", DEC2)}
        ${lgCell("efg_pct", PCT)}${lgCell("ts_pct", PCT)}${lgCell("pace", DEC2)}
        ${lgCell("or_pct", PCT)}${lgCell("dr_pct", PCT)}${lgCell("to_pct", PCT)}
        ${lgCell("as_pct", PCT)}${lgCell("pts", DEC2)}${lgCell("possessions", DEC2)}
      </tr>`;

      document.getElementById("compare-result").innerHTML = `
        <div class="chart-grid">
          <div class="card">
            <div class="card-title">Radar comparativo</div>
            ${radarOk ? '<div class="radar-wrap"><canvas id="chart-compare-radar"></canvas></div>'
                      : `<p class="empty">${_radarMsg(dataA)}</p>`}
          </div>
          <div class="card">
            <div class="map-header">
              <div class="card-title" style="margin:0">${dataA.team_name} vs ${dataB.team_name}</div>
              <span class="xm-host" data-xm="compare-box"></span>
            </div>
            <div class="table-wrap">
              <table class="compare-table fiba-box" id="compare-box-table">
                <thead><tr>
                  <th style="color:var(--accent)">${dataA.team_name}</th>
                  <th class="lbl"></th>
                  <th style="color:var(--blue)">${dataB.team_name}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="map-header">
            <div class="card-title" style="margin:0">Métricas avanzadas</div>
            <span class="xm-host" data-xm="compare-adv"></span>
          </div>
          <div class="table-wrap">
            <table class="search-table" id="compare-adv-table">
              <thead><tr>
                <th style="text-align:left">Equipo</th>
                <th>Off</th><th>Def</th><th>Net</th><th>eFG%</th><th>TS%</th><th>Pace</th>
                <th>OR%</th><th>DR%</th><th>TO%</th><th>AS%</th><th>Pts</th><th>Pos</th>
              </tr></thead>
              <tbody>
                ${advRow(dataA.team_name, avA, "var(--accent)")}
                ${advRow(dataB.team_name, avB, "var(--blue)")}
                ${lgRow}
              </tbody>
            </table>
          </div>
          <p class="td-muted" style="margin:8px 0 0">${_refLegend(dataA, ["equipo", "equipos"])}</p>
        </div>`;

      const cmpResult = document.getElementById("compare-result");
      const cmpComp = document.getElementById("compare-comp");
      const cmpLabel = cmpComp && cmpComp.value ? cmpComp.selectedOptions[0]?.textContent : "";
      _mountTableExport(cmpResult.querySelector('[data-xm="compare-box"]'), () => cmpResult.querySelector("#compare-box-table"),
        _baseMeta({ title: `Comparación — ${dataA.team_name} vs ${dataB.team_name}`, section: "comparar", entity: `${dataA.team_name}-${dataB.team_name}`, competitionLabel: cmpLabel }));
      _mountTableExport(cmpResult.querySelector('[data-xm="compare-adv"]'), () => cmpResult.querySelector("#compare-adv-table"),
        _baseMeta({ title: `Comparación avanzada — ${dataA.team_name} vs ${dataB.team_name}`, section: "comparar-avanzadas", entity: `${dataA.team_name}-${dataB.team_name}`, competitionLabel: cmpLabel }));

      if (radarOk) drawCompareRadar("chart-compare-radar", avA, avB, lg, dataA.team_name, dataB.team_name);
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btnCompare.disabled = false;
      btnCompare.textContent = "Comparar";
    }
  });
}
