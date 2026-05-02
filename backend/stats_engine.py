"""
Advanced basketball statistics engine.
Formulas sourced from basketanalisis.wordpress.com/sumario-de-la-estadistica-avanzada/
and Dean Oliver's "Basketball on Paper".
"""


def _safe_div(num, den, default=0.0):
    return round(num / den, 4) if den else default


def possessions(fga2, fga3, fta, orb, tov):
    """POS = 2PA + 3PA + FTA×0.44 + TO - OR"""
    return fga2 + fga3 + fta * 0.44 + tov - orb


def calc_team_stats(t: dict, opp: dict) -> dict:
    """
    t   — team raw stats dict
    opp — opponent raw stats dict
    Returns dict with all advanced metrics.
    """
    # Possessions
    t_pos  = possessions(t["fga2"], t["fga3"], t["fta"], t["orb"], t["tov"])
    o_pos  = possessions(opp["fga2"], opp["fga3"], opp["fta"], opp["orb"], opp["tov"])
    avg_pos = (t_pos + o_pos) / 2 if (t_pos + o_pos) else 1

    # Shooting
    fga  = t["fga2"] + t["fga3"]
    fgm  = t["fgm2"] + t["fgm3"]
    pts  = t["pts"]
    fta  = t["fta"]
    ftm  = t["ftm"]

    efg  = _safe_div(fgm + 0.5 * t["fgm3"], fga)            # eFG%
    ts   = _safe_div(pts, 2 * (fga + 0.44 * fta))           # TS%
    ftr  = _safe_div(ftm, fga)                               # FTR

    # Usage splits (shot type distribution)
    shot_base = t["fga2"] + t["fga3"] + fta * 0.44
    t2_pct = _safe_div(t["fga2"], shot_base)
    t3_pct = _safe_div(t["fga3"], shot_base)
    t1_pct = _safe_div(fta * 0.44, shot_base)

    # Efficiency ratings (pts per possession)
    oer  = _safe_div(pts, t_pos)                             # OER
    der  = _safe_div(opp["pts"], o_pos)                      # DER
    net  = round(oer - der, 4)                               # Net rating

    # Rebound percentages
    or_pct = _safe_div(t["orb"], t["orb"] + opp["drb"])     # OR%
    dr_pct = _safe_div(t["drb"], t["drb"] + opp["orb"])     # DR%

    # Turnover & assist ratios
    to_pct = _safe_div(t["tov"], fga + 0.44 * fta + t["tov"])  # TO%
    as_pct = _safe_div(t["ast"], fgm) if fgm else 0.0           # AS%

    # Pace (possessions per 40 min)
    minutes = t.get("minutes", 40) or 40
    pace = round(40 * avg_pos / minutes, 2)

    # 2PT and 3PT effectiveness
    fg2_pct = _safe_div(t["fgm2"], t["fga2"])
    fg3_pct = _safe_div(t["fgm3"], t["fga3"])
    ft_pct  = _safe_div(ftm, fta)

    return {
        "possessions": round(t_pos, 2),
        "oer":  oer,
        "der":  der,
        "net_rating": net,
        "efg_pct":  efg,
        "ts_pct":   ts,
        "ftr":      ftr,
        "fg2_pct":  fg2_pct,
        "fg3_pct":  fg3_pct,
        "ft_pct":   ft_pct,
        "t2_pct":   t2_pct,
        "t3_pct":   t3_pct,
        "t1_pct":   t1_pct,
        "or_pct":   or_pct,
        "dr_pct":   dr_pct,
        "to_pct":   to_pct,
        "as_pct":   as_pct,
        "pace":     pace,
        # raw
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
    }


def calc_player_stats(p: dict, team_pos: float) -> dict:
    """Player advanced stats — OER/DER relative to team possessions."""
    fga  = p["fga2"] + p["fga3"]
    fgm  = p["fgm2"] + p["fgm3"]
    pts  = p["pts"]
    fta  = p["fta"]
    ftm  = p["ftm"]

    efg  = _safe_div(fgm + 0.5 * p["fgm3"], fga)
    ts   = _safe_div(pts, 2 * (fga + 0.44 * fta))
    ftr  = _safe_div(ftm, fga)
    fg2  = _safe_div(p["fgm2"], p["fga2"])
    fg3  = _safe_div(p["fgm3"], p["fga3"])
    ft   = _safe_div(ftm, fta)
    to_pct = _safe_div(p["tov"], fga + 0.44 * fta + p["tov"])
    as_pct = _safe_div(p["ast"], fgm) if fgm else 0.0

    # Player possessions used (approx)
    p_pos = possessions(p["fga2"], p["fga3"], fta, p["orb"], p["tov"])
    oer   = _safe_div(pts, p_pos)

    shot_base = p["fga2"] + p["fga3"] + fta * 0.44
    t2_pct = _safe_div(p["fga2"], shot_base)
    t3_pct = _safe_div(p["fga3"], shot_base)
    t1_pct = _safe_div(fta * 0.44, shot_base)

    return {
        "possessions": round(p_pos, 2),
        "oer":     oer,
        "efg_pct": efg,
        "ts_pct":  ts,
        "ftr":     ftr,
        "fg2_pct": fg2,
        "fg3_pct": fg3,
        "ft_pct":  ft,
        "t2_pct":  t2_pct,
        "t3_pct":  t3_pct,
        "t1_pct":  t1_pct,
        "to_pct":  to_pct,
        "as_pct":  as_pct,
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
        "fg2_pct", "fg3_pct", "or_pct", "dr_pct", "to_pct",
        "as_pct", "pace", "pts", "possessions",
    ]
    result = {}
    for k in keys:
        vals = [s[k] for s in all_team_stats if k in s and s[k] is not None]
        if not vals:
            result[k] = {"avg": 0, "best": 0}
            continue
        avg  = round(sum(vals) / len(vals), 4)
        # "best" = highest for offensive stats, lowest for DER/to_pct
        if k in ("der", "to_pct"):
            best = min(vals)
        else:
            best = max(vals)
        result[k] = {"avg": avg, "best": best}
    return result
