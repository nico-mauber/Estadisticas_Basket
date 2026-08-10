"""
Advanced basketball statistics engine.
Formulas from Dean Oliver's "Basketball on Paper" and the FUBB scouting guide.
"""
import re
import unicodedata
from collections import Counter


def norm_name(s) -> str:
    """Nombre normalizado de un jugador: clave de identidad, no texto de UI.

    Minúsculas · sin tildes ni diacríticos · espacios internos colapsados · recortado.
    Dos fichas del mismo equipo cuyo nombre normaliza igual son el mismo jugador.
    La normalización es TIPOGRÁFICA, no semántica: "J. Feldeine" y "Jerome Feldeine"
    NO se unifican. Ver sdd/specs/13-dedup-jugadores/spec.md RF-1.
    """
    s = (s or "").strip().lower()
    s = "".join(ch for ch in unicodedata.normalize("NFD", s)
                if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", s)


def resolve_identity(rows):
    """(nombre a mostrar, posición) de un grupo de fichas del MISMO jugador.

    `rows`: iterable de objetos con `.player_name` y `.position`, ordenado de más
    antiguo a más reciente (el orden lo fija la ruta que llama).

    - nombre: la grafía de la ficha más reciente — nunca el nombre normalizado (RF-4).
    - posición: la más frecuente entre las no vacías; a igual frecuencia gana la más
      reciente; "" si ninguna ficha trae posición (RF-3).

    No mapea PF→F ni PG→G: unificar la taxonomía de FIBA es decisión de producto.
    """
    rows = list(rows)
    if not rows:
        return "", ""
    name = rows[-1].player_name
    positions = [(r.position or "").strip() for r in rows]
    non_empty = [p for p in positions if p]
    if not non_empty:
        return name, ""
    counts = Counter(non_empty)
    top = max(counts.values())
    tied = {p for p, n in counts.items() if n == top}
    # desempate estable: la más reciente entre las empatadas
    position = next(p for p in reversed(non_empty) if p in tied)
    return name, position


def _safe_div(num, den, default=None):
    """Divide devolviendo `None` (sin dato) cuando el denominador es 0.

    Las métricas de tasa (%/ratios/puntos por posesión) que no tienen intentos
    en un partido valen `null`, no 0: un partido sin tiros libres no debe contar
    como FT% 0 y arrastrar el promedio. Los promedios (app.py `_avg`,
    `league_averages`) y el frontend excluyen los `None`. Ver
    sdd/specs/08-nulos-vs-cero/spec.md.
    """
    return round(num / den, 4) if den else default


def _parse_minutes(s) -> float:
    """Parse '28:34' → 28.567, '0' → 0.0, None → 0.0."""
    if not s:
        return 0.0
    try:
        if ":" in str(s):
            m, sec = str(s).split(":", 1)
            return int(m) + int(sec) / 60
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def played(minutes) -> bool:
    """True si el jugador disputó minutos en ese partido (no es un DNP).

    Definición única de DNP para toda la app: un partido con 0 minutos (o sin
    dato de minutos) NO cuenta como partido jugado en los promedios del jugador
    —ni de tasa ni de conteo—. Un partido CON minutos y 0 puntos sí cuenta: ese
    0 es real. Ver sdd/specs/12-nulos-orden-color-dnp/spec.md RF-6.
    """
    return _parse_minutes(minutes) > 0


def possessions(fga2, fga3, fta, orb, tov):
    """POS = 2PA + 3PA + FTA×0.44 + TO - OR"""
    return fga2 + fga3 + fta * 0.44 + tov - orb


def calc_team_stats(t: dict, opp: dict) -> dict:
    """
    t   — team raw stats dict
    opp — opponent raw stats dict (must include fgm2, fgm3, ftm, fta)
    Returns dict with all advanced metrics.
    """
    # ── Possessions ──────────────────────────────────────────────────────────
    t_pos   = possessions(t["fga2"], t["fga3"], t["fta"], t["orb"], t["tov"])
    o_pos   = possessions(opp["fga2"], opp["fga3"], opp["fta"], opp["orb"], opp["tov"])
    avg_pos = (t_pos + o_pos) / 2 if (t_pos + o_pos) else 1

    # ── Shooting base ─────────────────────────────────────────────────────────
    fga = t["fga2"] + t["fga3"]
    fgm = t["fgm2"] + t["fgm3"]
    pts = t["pts"]
    fta = t["fta"]
    ftm = t["ftm"]

    # ── Plays (finalizaciones ofensivas) ──────────────────────────────────────
    plays = fga + 0.44 * fta + t["tov"]

    # ── Shooting efficiency ───────────────────────────────────────────────────
    efg  = _safe_div(fgm + 0.5 * t["fgm3"], fga)         # eFG%
    ts   = _safe_div(pts, 2 * (fga + 0.44 * fta))         # TS%
    ft_rate        = _safe_div(fta, fga)                   # FT Rate = 1PI/FGA
    ft_rate_report = _safe_div(ftm, fga)                   # FT% reporte = 1PC/FGA
    pps  = _safe_div(pts, fga)                             # Points Per Shot
    fg2_uso = _safe_div(t["fga2"], fga)                    # %2P uso
    fg3_uso = _safe_div(t["fga3"], fga)                    # %3P uso
    fg2_pct = _safe_div(t["fgm2"], t["fga2"])
    fg3_pct = _safe_div(t["fgm3"], t["fga3"])
    ft_pct  = _safe_div(ftm, fta)

    # ── Point distribution ────────────────────────────────────────────────────
    peso_1p = _safe_div(ftm, pts)
    peso_2p = _safe_div(2 * t["fgm2"], pts)
    peso_3p = _safe_div(3 * t["fgm3"], pts)

    # ── Efficiency ratings ────────────────────────────────────────────────────
    oer = _safe_div(pts, t_pos)
    der = _safe_div(opp["pts"], o_pos)
    net = round(oer - der, 4) if (oer is not None and der is not None) else None

    # ── PPT por tipo de tiro (C-07 / Feature 16 RF-6) ─────────────────────────
    # El PPT general es `pps` (PTS / FGA, docs/metrics.md) — no se duplica acá.
    ppt_2  = _safe_div(2 * t["fgm2"], t["fga2"])
    ppt_3  = _safe_div(3 * t["fgm3"], t["fga3"])
    ppt_ft = _safe_div(ftm, fta)

    # ── Rebound percentages ───────────────────────────────────────────────────
    or_pct   = _safe_div(t["orb"], t["orb"] + opp["drb"])
    dr_pct   = _safe_div(t["drb"], t["drb"] + opp["orb"])
    trb      = t["orb"] + t["drb"]
    opp_trb  = opp["orb"] + opp["drb"]
    trb_pct  = _safe_div(trb, trb + opp_trb)              # % Reb Total

    # ── Turnover & assist ratios ──────────────────────────────────────────────
    to_pct   = _safe_div(t["tov"], fga + 0.44 * fta + t["tov"])   # TO% (sobre plays)
    to_ratio = _safe_div(t["tov"], plays)                           # TO Ratio
    as_pct   = _safe_div(t["ast"], fgm) if fgm else None
    ast_ratio = _safe_div(t["ast"], plays)                          # AST Ratio

    # ── Pace ──────────────────────────────────────────────────────────────────
    minutes = t.get("minutes", 40) or 40
    pace = round(40 * avg_pos / minutes, 2)

    # ── Opponent / defensive metrics ──────────────────────────────────────────
    opp_fga = opp["fga2"] + opp["fga3"]
    opp_fgm = opp.get("fgm2", 0) + opp.get("fgm3", 0)
    opp_efg_pct = _safe_div(opp_fgm + 0.5 * opp.get("fgm3", 0), opp_fga)
    opp_ts_pct  = _safe_div(opp["pts"], 2 * (opp_fga + 0.44 * opp["fta"]))
    opp_to_pct  = _safe_div(opp["tov"], opp_fga + 0.44 * opp["fta"] + opp["tov"])
    opp_ft_rate = _safe_div(opp["fta"], opp_fga)

    # Defensive scouting (team level)
    t_stl = t.get("stl", 0)
    t_blk = t.get("blk", 0)
    stocks         = t_stl + t_blk
    def_playmaking = t_stl + t_blk - t["tov"]
    def_to_ratio   = _safe_div(t_stl + t_blk + t["drb"], t["tov"]) if t["tov"] else (99.0 if (t_stl + t_blk + t["drb"]) > 0 else 0.0)

    return {
        # Possessions
        "possessions": round(t_pos, 2),
        "plays":       round(plays, 2),
        # Efficiency
        "oer":         oer,
        "der":         der,
        "net_rating":  net,
        "pace":        pace,
        # Shooting
        "efg_pct":     efg,
        "ts_pct":      ts,
        "fg2_pct":     fg2_pct,
        "fg3_pct":     fg3_pct,
        "ft_pct":      ft_pct,
        "ft_rate":     ft_rate,
        "ft_rate_report": ft_rate_report,
        "pps":         pps,
        "fg2_uso":     fg2_uso,
        "fg3_uso":     fg3_uso,
        "ppt_2":       ppt_2,
        "ppt_3":       ppt_3,
        "ppt_ft":      ppt_ft,
        # Point distribution
        "peso_1p":     peso_1p,
        "peso_2p":     peso_2p,
        "peso_3p":     peso_3p,
        # Rebotes
        "or_pct":      or_pct,
        "dr_pct":      dr_pct,
        "trb_pct":     trb_pct,
        # Turnover & assist
        "to_pct":      to_pct,
        "to_ratio":    to_ratio,
        "as_pct":      as_pct,
        "ast_ratio":   ast_ratio,
        # Opponent defensive metrics
        "opp_efg_pct": opp_efg_pct,
        "opp_ts_pct":  opp_ts_pct,
        "opp_to_pct":  opp_to_pct,
        "opp_ft_rate": opp_ft_rate,
        # Defensive scouting
        "stocks":         stocks,
        "def_playmaking": def_playmaking,
        "def_to_ratio":   def_to_ratio,
        # Raw
        "pts":  pts,
        "fgm":  fgm,
        "fga":  fga,
        "fgm2": t["fgm2"],
        "fga2": t["fga2"],
        "fgm3": t["fgm3"],
        "fga3": t["fga3"],
        "ftm":  ftm,
        "fta":  fta,
        "orb":  t["orb"],
        "drb":  t["drb"],
        "trb":  t.get("trb", t["orb"] + t["drb"]),
        "ast":  t["ast"],
        "tov":  t["tov"],
        "stl":  t.get("stl", 0),
        "blk":  t.get("blk", 0),
        "pf":   t.get("pf", 0),
        "opp_pts": opp["pts"],
    }


def season_ast_to(total_ast, total_tov):
    """AS/PER de temporada = AST acumuladas / PER acumuladas. `None` si no hubo pérdidas.

    Definición ÚNICA para equipo y jugador (C-04). NO es el promedio de los ratios por
    partido: ese promedio da igual peso a un partido de 2/1 que a uno de 10/5 y no
    coincide con el box score acumulado. Ver sdd/specs/15-metricas-jugador/spec.md RF-7.
    """
    return _safe_div(total_ast or 0, total_tov or 0)


def calc_player_stats(p: dict, team_pos: float, team: dict = None, game_minutes: int = 40,
                      opp: dict = None) -> dict:
    """Player advanced stats.

    `opp` (rebotes del rival en ese partido) es opcional: sin él, OR%/DR%/TRB%
    individuales valen None en vez de romper — degradación segura (Feature 15 D-1).
    """
    fga = p["fga2"] + p["fga3"]
    fgm = p["fgm2"] + p["fgm3"]
    pts = p["pts"]
    fta = p["fta"]
    ftm = p["ftm"]

    plays = fga + 0.44 * fta + p["tov"]

    efg  = _safe_div(fgm + 0.5 * p["fgm3"], fga)
    ts   = _safe_div(pts, 2 * (fga + 0.44 * fta))
    ft_rate        = _safe_div(fta, fga)
    ft_rate_report = _safe_div(ftm, fga)
    pps  = _safe_div(pts, fga)
    ppp  = _safe_div(pts, plays)
    fg2  = _safe_div(p["fgm2"], p["fga2"])
    fg3  = _safe_div(p["fgm3"], p["fga3"])
    ft   = _safe_div(ftm, fta)
    fg2_uso = _safe_div(p["fga2"], fga)
    fg3_uso = _safe_div(p["fga3"], fga)
    # C-07: PPT abierto por tipo de tiro (Feature 16 RF-6). El PPT general es `pps`.
    ppt_2  = _safe_div(2 * p["fgm2"], p["fga2"])
    ppt_3  = _safe_div(3 * p["fgm3"], p["fga3"])
    ppt_ft = _safe_div(ftm, fta)
    to_pct  = _safe_div(p["tov"], fga + 0.44 * fta + p["tov"])
    to_ratio = _safe_div(p["tov"], plays)
    as_pct  = _safe_div(p["ast"], fgm) if fgm else None
    ast_to  = _safe_div(p["ast"], p["tov"]) if p["tov"] else (float("inf") if p["ast"] > 0 else 0.0)
    ast_ratio = _safe_div(p["ast"], plays)
    peso_1p = _safe_div(ftm, pts)
    peso_2p = _safe_div(2 * p["fgm2"], pts)
    peso_3p = _safe_div(3 * p["fgm3"], pts)

    # USO% = (FGA + 0.44×FTA + TOV) / team_possessions
    if team:
        team_fga   = (team.get("fga2", 0) or 0) + (team.get("fga3", 0) or 0)
        team_plays = team_fga + 0.44 * (team.get("fta", 0) or 0) + (team.get("tov", 0) or 0)
        uso_pct = _safe_div(plays, team_plays)
    else:
        uso_pct = None

    p_pos = possessions(p["fga2"], p["fga3"], fta, p["orb"], p["tov"])
    oer   = _safe_div(pts, p_pos)

    # ── C-01: indicadores por posesión y por minuto (Feature 15 RF-1…RF-4) ──────
    as_pos  = _safe_div(p["ast"], p_pos)
    tov_pos = _safe_div(p["tov"], p_pos)      # "PER/pos": PER = pérdidas, no Player Efficiency Rating
    pts_pos = oer                              # PTS/pos ≡ OER de jugador: misma fuente, dos etiquetas
    mp      = _parse_minutes(p.get("minutes"))
    orb_min = _safe_div(p["orb"], mp)
    drb_min = _safe_div(p["drb"], mp)

    # ── C-01: OR%/DR%/TRB% individuales (Feature 15 RF-6) ──────────────────────
    # Fórmula individual (Basketball-Reference): ajusta por los minutos en cancha, a
    # diferencia de la de equipo (docs/metrics.md §Rebotes), que no aplica a un jugador.
    #   OR% = (RO_jug × duración_partido) / (min_jug × (RO_equipo + RD_rival))
    p_trb = p.get("trb", p["orb"] + p["drb"])
    if team and opp and mp:
        t_orb, t_drb = team.get("orb", 0) or 0, team.get("drb", 0) or 0
        o_orb, o_drb = opp.get("orb", 0) or 0,  opp.get("drb", 0) or 0
        or_pct  = _safe_div(p["orb"] * game_minutes, mp * (t_orb + o_drb))
        dr_pct  = _safe_div(p["drb"] * game_minutes, mp * (t_drb + o_orb))
        trb_pct = _safe_div(p_trb    * game_minutes, mp * (t_orb + t_drb + o_orb + o_drb))
    else:
        or_pct = dr_pct = trb_pct = None

    # Defensive scouting metrics
    stl_v = p.get("stl", 0)
    blk_v = p.get("blk", 0)
    stocks         = stl_v + blk_v
    def_playmaking = stl_v + blk_v - p["tov"]
    def_to_ratio   = _safe_div(stl_v + blk_v + p["drb"], p["tov"]) if p["tov"] else (99.0 if (stl_v + blk_v + p["drb"]) > 0 else 0.0)
    physical_impact = p.get("trb", p["orb"] + p["drb"]) + stl_v

    return {
        "possessions":    round(p_pos, 2),
        "plays":          round(plays, 2),
        "oer":            oer,
        "efg_pct":        efg,
        "ts_pct":         ts,
        "ft_rate":        ft_rate,
        "ft_rate_report": ft_rate_report,
        "pps":            pps,
        "ppp":            ppp,
        "fg2_pct":        fg2,
        "fg3_pct":        fg3,
        "ft_pct":         ft,
        "fg2_uso":        fg2_uso,
        "fg3_uso":        fg3_uso,
        "ppt_2":          ppt_2,
        "ppt_3":          ppt_3,
        "ppt_ft":         ppt_ft,
        "to_pct":         to_pct,
        "to_ratio":       to_ratio,
        "as_pct":         as_pct,
        "ast_ratio":      ast_ratio,
        "ast_to":         ast_to if ast_to != float("inf") else 99.0,
        "peso_1p":        peso_1p,
        "peso_2p":        peso_2p,
        "peso_3p":        peso_3p,
        "stocks":         stocks,
        "def_playmaking": def_playmaking,
        "def_to_ratio":   def_to_ratio,
        "physical_impact": physical_impact,
        "uso_pct": uso_pct,
        # C-01 — por posesión y por minuto (Feature 15)
        "as_pos":  as_pos,
        "tov_pos": tov_pos,
        "pts_pos": pts_pos,
        "orb_min": orb_min,
        "drb_min": drb_min,
        # C-01 — rebote individual (Feature 15 RF-6)
        "or_pct":  or_pct,
        "dr_pct":  dr_pct,
        "trb_pct": trb_pct,
        "pts":  pts,
        "fgm":  fgm,
        "fga":  fga,
        "fgm2": p["fgm2"],
        "fga2": p["fga2"],
        "fgm3": p["fgm3"],
        "fga3": p["fga3"],
        "ftm":  ftm,
        "fta":  fta,
        "orb":  p["orb"],
        "drb":  p["drb"],
        "trb":  p.get("trb", p["orb"] + p["drb"]),
        "ast":  p["ast"],
        "tov":  p["tov"],
        "stl":  p.get("stl", 0),
        "blk":  p.get("blk", 0),
        "pf":   p.get("pf", 0),
    }


def league_averages(all_team_stats: list[dict]) -> dict:
    """Compute mean and best value across all team games."""
    if not all_team_stats:
        return {}

    keys = [
        "oer", "der", "net_rating", "efg_pct", "ts_pct",
        "fg2_pct", "fg3_pct", "ft_pct", "ft_rate", "pps",
        "or_pct", "dr_pct", "trb_pct",
        "to_pct", "to_ratio", "as_pct", "ast_ratio",
        "pace", "pts", "possessions",
        "opp_efg_pct", "opp_ts_pct", "opp_to_pct",
        "peso_1p", "peso_2p", "peso_3p",
        "fg2_uso", "fg3_uso",
        "stocks", "def_playmaking", "def_to_ratio",
        "uso_pct",
        # C-01 — indicadores por posesión y por minuto (Feature 15 RF-9)
        "as_pos", "tov_pos", "pts_pos", "orb_min", "drb_min",
        # C-07 — PPT por tipo de tiro (Feature 16)
        "ppt_2", "ppt_3", "ppt_ft",
    ]
    # Metrics where lower = better
    lower_is_better = {"der", "to_pct", "to_ratio", "opp_efg_pct", "opp_ts_pct", "tov_pos"}

    result = {}
    for k in keys:
        vals = [s[k] for s in all_team_stats if k in s and s[k] is not None]
        if not vals:
            # Sin ningún valor válido → None, no 0. Un `Ø 0.0%` hace creer que el
            # promedio de la liga es cero (Feature 14 RF-3; origen del bug de C-01).
            result[k] = {"avg": None, "best": None}
            continue
        avg  = round(sum(vals) / len(vals), 4)
        best = min(vals) if k in lower_is_better else max(vals)
        result[k] = {"avg": avg, "best": best}
    return result
