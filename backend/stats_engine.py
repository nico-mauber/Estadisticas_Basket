"""
Advanced basketball statistics engine.
Formulas from Dean Oliver's "Basketball on Paper" and the FUBB scouting guide.
"""
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field


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
    como FT% 0 y arrastrar el promedio. Los promedios (`aggregate_games`,
    `league_averages`) y el frontend excluyen los `None`. Ver
    sdd/specs/08-nulos-vs-cero/spec.md.
    """
    return round(num / den, 4) if den else default


def _safe_pos_div(num, den):
    """Cociente por posesión propia (C-01): la posesión individual puede ser ≤ 0 porque se le
    resta el rebote ofensivo; una tasa por posesión negativa no tiene sentido → `None`."""
    return round(num / den, 4) if den is not None and den > 0 else None


def _pct_individual(num, den):
    """`(valor, invalido)` de un % de rebote individual (C-01). El OR%/DR% individual estima por
    minutos y con minutos ínfimos explota (516 %): un porcentaje > 100 % se descarta como no
    calculable (`invalido=True`) en lugar de mostrarse. Denominador 0 → `(None, False)`."""
    v = _safe_div(num, den)
    if v is not None and v > 1:
        return None, True
    return v, False


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

    # ── PPT por tipo de tiro (C-07) ─────────────────────────────────────────────
    ppt    = _safe_div(2 * t["fgm2"] + 3 * t["fgm3"], t["fga2"] + t["fga3"])
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
    # Sin pérdidas el cociente no está definido → None, nunca un centinela 99.0 (C-11 / DA-07)
    def_to_ratio   = _safe_div(t_stl + t_blk + t["drb"], t["tov"])

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
        "ppt":         ppt,
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
        "ast_to":      _safe_div(t["ast"], t["tov"]),   # AS/PER del partido; 0 pérdidas → None (C-04, DA-07)
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
    """AS/PER de una selección = AST acumuladas / PER acumuladas. `None` si no hubo pérdidas.

    Definición ÚNICA de AS/PER (C-04), igual para equipo y jugador: PER = pérdidas (no el Player
    Efficiency Rating) y la selección es la que se está viendo (todo, una competencia, últimos N).
    NO es el promedio de los ratios por partido: ese promedio da igual peso a un partido de 2/1 que
    a uno de 10/5 y no coincide con el box score acumulado. El valor de UN partido es `ast_to` de
    `calc_team_stats` / `calc_player_stats` y solo aparece en el game log.
    Ver sdd/specs/15-metricas-jugador/spec.md RF-7 y docs/metrics.md.
    """
    return _safe_div(total_ast or 0, total_tov or 0)


def season_def_to_ratio(total_stl, total_blk, total_drb, total_tov):
    """DEF/TO de temporada = (ROB + TAP + RD) acumulados / PER acumuladas. `None` si no hubo pérdidas.

    Cociente de totales (pooled, DA-02), mismo criterio que `season_ast_to`.
    """
    return _safe_div((total_stl or 0) + (total_blk or 0) + (total_drb or 0), total_tov or 0)


# ── Tabla general (C-09 / F-13) ──────────────────────────────────────────────
# Puntos por resultado y desempate leídos de la configuración (F-13).


def standings_row(results: list[tuple], win_points: int = 2, loss_points: int = 1) -> dict:
    """Fila de la tabla de posiciones a partir de `[(pts, opp_pts), ...]` de un equipo.

    Un marcador igualado cuenta como derrota (no existe en FIBA; se define para que
    PG + PP == PJ se sostenga ante un dato corrupto). Feature 17 RF-2.
    """
    wins = sum(1 for pts, opp in results if (pts or 0) > (opp or 0))
    losses = len(results) - wins
    return {
        "games":        len(results),
        "wins":         wins,
        "losses":       losses,
        "table_points": win_points * wins + loss_points * losses,
        "pts_for":      sum(pts or 0 for pts, _ in results),
        "pts_against":  sum(opp or 0 for _, opp in results),
    }


def standings_sort_key(row: dict, tiebreak: str = "diferencia") -> tuple:
    """Orden de la tabla: más puntos primero; desempate configurable."""
    diff = -(row["pts_for"] - row["pts_against"]) if tiebreak == "diferencia" else 0
    return (-row["table_points"], diff)


# ── Razón de un nulo (C-11 RF-3) ─────────────────────────────────────────────
# Campos del box de FIBA que no todas las competencias publican: si FIBA no manda la
# clave, la ingesta guarda NULL (fiba_fetcher.py) y el nulo significa "no registrado".
FIBA_OPTIONAL_FIELDS = frozenset({
    "paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts",
    "plus_minus",
})


def null_reason(key: str, *, played: bool = True) -> str:
    """Código de por qué la métrica `key` vale None. Ver docs/api.md §"Nulos con razón".

    - `dnp`: el jugador no disputó minutos en ese partido.
    - `no_registrado`: la competencia no publica ese campo (o el conteo crudo es `None`).
    - `sin_perdidas`: AS/PER o DEF/TO con 0 pérdidas (cociente no definido).
    - `sin_intentos`: cualquier otra tasa con denominador 0.
    - `sin_datos`: la selección no tiene partidos (T-05).
    - `sin_pbp`: la métrica necesita play-by-play y la entidad no tiene (T-05).
    - `no_aplica`: la métrica no aplica a este tipo de entidad (T-05).
    - `no_disponible`: el dato existe conceptualmente pero la app no lo deriva todavía (T-05, C-03).
    """
    if not played:
        return "dnp"
    if key in FIBA_OPTIONAL_FIELDS:
        return "no_registrado"
    if key in ("ast_to", "def_to_ratio"):
        return "sin_perdidas"
    return "sin_intentos"


def null_reasons(metrics: dict, *, played: bool = True, overrides: dict | None = None) -> dict:
    """`{clave: código}` para cada clave de `metrics` cuyo valor es None.

    `overrides` fija la razón de claves que la ruta calculó aparte (p. ej. las tasas de temporada
    de `season_player_rates`); `metrics["_invalid"]` marca los % de rebote individual > 100 %
    (`estimacion_invalida`, C-01). Un jugador sin partidos jugados es siempre `dnp`.
    """
    invalid = metrics.get("_invalid") or ()
    out = {}
    for k, v in metrics.items():
        if v is not None:
            continue
        if not played:
            out[k] = "dnp"
        elif overrides and k in overrides:
            out[k] = overrides[k]
        elif k in invalid:
            out[k] = "estimacion_invalida"
        else:
            out[k] = null_reason(k, played=played)
    return out


def strip_private(d: dict) -> dict:
    """Quita los términos privados (`_pool`, `_invalid`) antes de serializar un dict de jugador."""
    return {k: v for k, v in d.items() if not k.startswith("_")}


# ── Temporada de jugador como cociente de totales (C-01 / DA-02) ──────────────
_SUM_KEYS = ("ast", "tov", "pts", "orb", "drb")
_POOL_KEYS = ("pos", "min", "or_n", "or_d", "dr_n", "dr_d", "tr_n", "tr_d")


def sum_pool(per_game: list) -> dict:
    """Suma, sobre los dicts de `calc_player_stats` de los partidos JUGADOS de una selección, los
    conteos y los términos privados. Lista vacía → `{}`. Un DNP no se pasa (RF-8)."""
    if not per_game:
        return {}
    out = {k: 0 for k in _SUM_KEYS}
    out.update({"pool_" + k: 0 for k in _POOL_KEYS})
    for adv in per_game:
        for k in _SUM_KEYS:
            out[k] += adv.get(k, 0) or 0
        for k, v in (adv.get("_pool") or {}).items():
            out["pool_" + k] += v or 0
    return out


def season_player_rates(sums: dict) -> tuple:
    """`(valores, razones)` de las 9 tasas de jugador de una selección, como cociente de totales.

    AS/pos = ΣAS/ΣPOS · PER/pos = ΣPER/ΣPOS · PTS/pos = ΣPTS/ΣPOS (≡ OER de jugador) ·
    RO/min = ΣRO/Σmin · RD/min = ΣRD/Σmin · OR% = Σ(RO·L)/Σ(min·(RO_eq+RD_riv)) y análogos.
    ΣPOS ≤ 0 → `sin_intentos`; un % > 100 % → `estimacion_invalida`. Nunca devuelve negativos.
    """
    s = sums.get
    pos, mn = s("pool_pos", 0), s("pool_min", 0)
    vals = {
        "as_pos":  _safe_pos_div(s("ast", 0), pos),
        "tov_pos": _safe_pos_div(s("tov", 0), pos),
        "pts_pos": _safe_pos_div(s("pts", 0), pos),
        "orb_min": _safe_div(s("orb", 0), mn),
        "drb_min": _safe_div(s("drb", 0), mn),
    }
    vals["oer"] = vals["pts_pos"]   # PTS/pos ≡ OER de jugador (RF-7)
    invalid = set()
    for key, num, den in (("or_pct", "pool_or_n", "pool_or_d"), ("dr_pct", "pool_dr_n", "pool_dr_d"),
                          ("trb_pct", "pool_tr_n", "pool_tr_d")):
        vals[key], bad = _pct_individual(s(num, 0), s(den, 0))
        if bad:
            invalid.add(key)
    reasons = {k: ("estimacion_invalida" if k in invalid else "sin_intentos")
               for k, v in vals.items() if v is None}
    return vals, reasons


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
    # C-07: PPT (glosario: puntos de campo / tiros de campo intentados)
    ppt    = _safe_div(2 * p["fgm2"] + 3 * p["fgm3"], p["fga2"] + p["fga3"])
    ppt_2  = _safe_div(2 * p["fgm2"], p["fga2"])
    ppt_3  = _safe_div(3 * p["fgm3"], p["fga3"])
    ppt_ft = _safe_div(ftm, fta)
    to_pct  = _safe_div(p["tov"], fga + 0.44 * fta + p["tov"])
    to_ratio = _safe_div(p["tov"], plays)
    as_pct  = _safe_div(p["ast"], fgm) if fgm else None
    ast_to  = _safe_div(p["ast"], p["tov"])   # 0 pérdidas → None (C-11 / DA-07)
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
    oer   = _safe_pos_div(pts, p_pos)   # posesión ≤ 0 → None, nunca negativo (C-01)

    # ── C-01: indicadores por posesión y por minuto (Feature 15 RF-1…RF-4) ──────
    as_pos  = _safe_pos_div(p["ast"], p_pos)
    tov_pos = _safe_pos_div(p["tov"], p_pos)  # "PER/pos": PER = pérdidas, no Player Efficiency Rating
    pts_pos = oer                              # PTS/pos ≡ OER de jugador: misma fuente, dos etiquetas
    mp      = _parse_minutes(p.get("minutes"))
    orb_min = _safe_div(p["orb"], mp)
    drb_min = _safe_div(p["drb"], mp)

    # ── C-01: OR%/DR%/TRB% individuales (Feature 15 RF-6) ──────────────────────
    # Fórmula individual (Basketball-Reference): ajusta por los minutos en cancha, a
    # diferencia de la de equipo (docs/metrics.md §Rebotes), que no aplica a un jugador.
    #   OR% = (RO_jug × duración_partido) / (min_jug × (RO_equipo + RD_rival))
    p_trb = p.get("trb", p["orb"] + p["drb"])
    # Términos privados para agregar una temporada como cociente de totales (DA-02, C-01):
    # nunca se serializan (`strip_private`).
    pool = {"pos": p_pos, "min": mp}
    invalid = set()
    if team and opp and mp:
        t_orb, t_drb = team.get("orb", 0) or 0, team.get("drb", 0) or 0
        o_orb, o_drb = opp.get("orb", 0) or 0,  opp.get("drb", 0) or 0
        terms = {"or": (p["orb"] * game_minutes, mp * (t_orb + o_drb)),
                 "dr": (p["drb"] * game_minutes, mp * (t_drb + o_orb)),
                 "tr": (p_trb    * game_minutes, mp * (t_orb + t_drb + o_orb + o_drb))}
        for k, (n, d) in terms.items():
            pool[k + "_n"], pool[k + "_d"] = n, d
        or_pct,  bad_or = _pct_individual(*terms["or"])
        dr_pct,  bad_dr = _pct_individual(*terms["dr"])
        trb_pct, bad_tr = _pct_individual(*terms["tr"])
        invalid = {k for k, bad in (("or_pct", bad_or), ("dr_pct", bad_dr), ("trb_pct", bad_tr)) if bad}
    else:
        or_pct = dr_pct = trb_pct = None

    # Defensive scouting metrics
    stl_v = p.get("stl", 0)
    blk_v = p.get("blk", 0)
    stocks         = stl_v + blk_v
    def_playmaking = stl_v + blk_v - p["tov"]
    def_to_ratio   = _safe_div(stl_v + blk_v + p["drb"], p["tov"])   # 0 pérdidas → None (C-11 / DA-07)
    physical_impact = p.get("trb", p["orb"] + p["drb"]) + stl_v

    return {
        "possessions":    round(p_pos, 2),
        "plays":          round(plays, 2),
        "oer":            oer,
        "_pool":          pool,      # privados (C-01): ver sum_pool / strip_private
        "_invalid":       invalid,
        "efg_pct":        efg,
        "ts_pct":         ts,
        "ft_rate":        ft_rate,
        "ft_rate_report": ft_rate_report,
        "pps":            pps,
        "ppp":            ppp,
        "ppt":            ppt,
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
        "ast_to":         ast_to,
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


# ── Agregación única de una selección (C-02) ─────────────────────────────────
# Una selección es la lista de partidos de UNA entidad (equipo o jugador) que entran en el contexto:
# una competencia, los últimos N… `aggregate_games` es el único camino que la convierte en promedios,
# totales y razones de nulo: lo usan el perfil de la entidad y el valor de cada miembro de la población
# de liga (population.py), de modo que el `Ø` y la card se calculan con el mismo criterio.

# Claves cuyo valor de selección es la media de los valores por partido, excluyendo los nulos. Las
# tasas que se agregan como cociente de totales (DA-02) NO van acá: las entrega un grupo de
# POOLED_GROUPS (AS/PER, DEF/TO y, para el jugador, las nueve de C-01).
TEAM_AVG_KEYS = [
    "oer", "der", "net_rating", "efg_pct", "ts_pct",
    "fg2_pct", "fg3_pct", "ft_pct", "ft_rate", "ft_rate_report",
    "pps", "ppt", "fg2_uso", "fg3_uso",
    "or_pct", "dr_pct", "trb_pct", "to_pct", "to_ratio",
    "as_pct", "ast_ratio", "pace", "pts", "possessions", "plays",
    "peso_1p", "peso_2p", "peso_3p",
    "opp_efg_pct", "opp_ts_pct", "opp_to_pct", "opp_ft_rate",
    "stocks", "def_playmaking",
    "ppt_2", "ppt_3", "ppt_ft",
    "fgm", "fga", "fgm2", "fga2", "fgm3", "fga3",
    "ftm", "fta", "orb", "drb", "trb", "ast", "tov", "stl", "blk", "pf",
    "opp_pf", "paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts",
]
PLAYER_AVG_KEYS = [
    "efg_pct", "ts_pct", "fg2_pct", "fg3_pct",
    "ft_pct", "ft_rate", "ft_rate_report", "pps", "ppp", "ppt",
    "fg2_uso", "fg3_uso", "peso_1p", "peso_2p", "peso_3p",
    "to_pct", "to_ratio", "as_pct", "ast_ratio",
    "ppt_2", "ppt_3", "ppt_ft",
    "stocks", "def_playmaking", "physical_impact",
    "reb_share", "oreb_share", "dreb_share",
    "uso_pct",
    "pts", "fgm", "fga", "fgm2", "fga2", "fgm3", "fga3",
    "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk",
]
AVG_KEYS = {"team": TEAM_AVG_KEYS, "player": PLAYER_AVG_KEYS}

# Totales de la selección que respaldan cocientes y detalle de tiro (C-07, C-04): C-07/C-04 los agregaron
# a la respuesta; acá es el único lugar que los lista.
TOTAL_KEYS = ("fga2", "fgm2", "fga3", "fgm3", "fta", "ftm", "ast", "tov")

# Métricas donde un valor menor es mejor: solo definen el `best` de la población (escala del radar).
LOWER_IS_BETTER = {"der", "to_pct", "to_ratio", "opp_efg_pct", "opp_ts_pct", "opp_ft_rate",
                   "tov_pos", "tov", "pf"}


def _season_balance(sums: dict) -> tuple:
    """`(valores, razones)` de AS/PER y DEF/TO de una selección: cociente de totales (DA-02, C-04)."""
    s = sums.get
    vals = {"ast_to": season_ast_to(s("ast"), s("tov")),
            "def_to_ratio": season_def_to_ratio(s("stl"), s("blk"), s("drb"), s("tov"))}
    return vals, {k: "sin_perdidas" for k, v in vals.items() if v is None}


def season_shooting(sums: dict) -> tuple:
    """`(valores, razones)` de las 9 tasas de tiro de una selección: cociente de totales (DA-02, C-07).

    `ppt` = (2·FGM2 + 3·FGM3) / (FGA2 + FGA3) — glosario v2 §6, DA-03.
    `pps` (PTS/FGA) queda como legado, no se recalcula pooled.
    """
    s = sums.get
    fga2, fgm2 = s("fga2", 0), s("fgm2", 0)
    fga3, fgm3 = s("fga3", 0), s("fgm3", 0)
    fta, ftm = s("fta", 0), s("ftm", 0)
    fga = fga2 + fga3
    vals = {
        "ppt":     _safe_div(2 * fgm2 + 3 * fgm3, fga),
        "ppt_2":   _safe_div(2 * fgm2, fga2),
        "ppt_3":   _safe_div(3 * fgm3, fga3),
        "ppt_ft":  _safe_div(ftm, fta),
        "fg2_pct": _safe_div(fgm2, fga2),
        "fg3_pct": _safe_div(fgm3, fga3),
        "ft_pct":  _safe_div(ftm, fta),
        "fg2_uso": _safe_div(fga2, fga),
        "fg3_uso": _safe_div(fga3, fga),
    }
    return vals, {k: "sin_intentos" for k, v in vals.items() if v is None}


# Grupos de tasas de temporada, por tipo de entidad. Cada grupo recibe las sumas de la selección
# (`ast`, `tov`, … y `pool_*` de los términos privados) y devuelve `(valores, razones)`. Una familia
# nueva de tasas pooled se registra acá (C-07: tiro; T-05: el resto) sin tocar `aggregate_games`.
POOLED_GROUPS = {
    "team":   [_season_balance, season_shooting],
    "player": [_season_balance, season_player_rates, season_shooting],
}


def _finite(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def _sum_games(per_game: list) -> dict:
    """Σ de cada clave numérica de los partidos; los términos privados `_pool` van con prefijo `pool_`."""
    sums: dict = {}
    for g in per_game:
        for k, v in g.items():
            if not k.startswith("_") and _finite(v):
                sums[k] = sums.get(k, 0) + v
        for k, v in (g.get("_pool") or {}).items():
            sums["pool_" + k] = sums.get("pool_" + k, 0) + (v or 0)
    return sums


def aggregate_games(per_game: list, keys: list, *, entity_type: str = "team",
                    empty_reason: str = "sin_datos") -> dict:
    """Promedios, totales y razones de nulo de una selección de partidos de UNA entidad.

    `per_game`: los dicts de `calc_team_stats` / `calc_player_stats` (más el desglose FIBA) de los
    partidos de la selección; para un jugador, solo los JUGADOS (un DNP no se pasa). Devuelve
    `{"games", "averages", "totals", "null_reasons"}`:
    - cada clave de `keys` = media de sus valores por partido, sin los nulos (`round(…, 4)`);
    - cada grupo de `POOLED_GROUPS[entity_type]` = cociente de los totales de la selección;
    - `totals` = Σ de `TOTAL_KEYS`.
    Sin partidos, todo es `None` con la razón `empty_reason` (`sin_datos` en equipo, `dnp` en jugador).
    Nunca reemplaza un nulo por cero.
    """
    n = len(per_game)
    sums = _sum_games(per_game)
    averages = {}
    for k in keys:
        vals = [g[k] for g in per_game if _finite(g.get(k))]
        averages[k] = round(sum(vals) / len(vals), 4) if vals else None
    overrides: dict = {}
    for group in POOLED_GROUPS[entity_type]:
        vals, reasons = group(sums)
        averages.update(vals)
        overrides.update(reasons)
    totals = {k: int(sums.get(k, 0)) for k in TOTAL_KEYS}
    if not n:
        reasons = {k: empty_reason for k in averages}
    else:
        reasons = null_reasons(averages, played=True, overrides=overrides)
    return {"games": n, "averages": averages, "totals": totals, "null_reasons": reasons}


def metric_keys(entity_type: str) -> list:
    """Todas las claves de `averages` de un tipo de entidad (las del `Ø` de liga)."""
    return list(aggregate_games([], AVG_KEYS[entity_type], entity_type=entity_type)["averages"])


def league_averages(member_values: list, keys: list) -> dict:
    """Promedio de la competencia (`Ø`) por métrica: la media de los valores de las ENTIDADES.

    `member_values`: un dict por entidad (el `averages` de `aggregate_games` sobre TODOS sus partidos de
    la competencia). Cada entidad pesa una vez (DA-08); un valor nulo no entra en la media ni cuenta como
    0. Devuelve `{clave: {"avg", "best", "reason", "n"}}`: `best` es el mejor valor de la población
    (solo escala el radar), `n` cuántas entidades aportaron un valor. Sin ningún valor: `avg`/`best`
    `None` con razón `sin_datos`, nunca 0 (Feature 14 RF-3).
    """
    out = {}
    for k in keys:
        vals = [m[k] for m in member_values if _finite(m.get(k))]
        if not vals:
            out[k] = {"avg": None, "best": None, "reason": "sin_datos", "n": 0}
            continue
        out[k] = {"avg": round(sum(vals) / len(vals), 4),
                  "best": min(vals) if k in LOWER_IS_BETTER else max(vals),
                  "reason": None, "n": len(vals)}
    return out


# ── T-05: conjunto estándar de métricas (Grupo B) ────────────────────────────
# `compute_standard` es el único lugar con las 86 fórmulas del catálogo (metrics_catalog.py,
# Grupo C, solo metadatos). `StatBundle` es el contrato de entrada: conteos crudos ya sumados
# de una selección de partidos de una entidad (equipo, jugador, quinteto, ON/OFF, cierre).

NULL_REASON_CODES = (
    "sin_intentos", "sin_perdidas", "sin_pbp", "no_registrado",
    "no_aplica", "sin_datos", "no_disponible", "dnp",
)

RAW_KEYS = (
    "pts", "fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "orb", "drb", "ast", "tov",
    "stl", "blk", "blk_received", "pf", "fouls_drawn", "plus_minus",
)

TEAMLIKE_ENTITIES = frozenset({"team", "lineup", "onoff", "clutch"})


@dataclass
class StatBundle:
    """Conteos crudos ya sumados de UNA entidad sobre una selección de partidos (plan §4.1).

    `own`/`opp`/`team`: dicts con claves de `RAW_KEYS`; un conteo desconocido (columna NULL sin
    reprocesar) vale `None`, nunca 0. `on_court` (jugador): `{"own", "opp", "seconds",
    "games_exact", "games_estimated", "poss_estimated"}`. `shots`: `{"paint_fga", "mid_fga",
    "fg3a"}` o `None` (C-03, todavía no implementado). `derived`: sumandos ponderados por
    minutos del jugador (plan §4.5): `plays_team_w, t2a_team_w, t3a_team_w, fgm_team_w,
    orb_pool_w, drb_pool_w, trb_pool_w`.
    """
    entity_type: str
    entity_id: object
    name: str
    own: dict
    opp: dict | None
    team: dict | None
    games: int
    minutes: float | None
    team_minutes: float | None
    seconds: float | None
    on_court: dict | None
    shots: dict | None
    possessions_counted: float | None
    null_reasons: dict
    poss_seconds: float | None = None
    finished_poss: dict | None = None
    derived: dict | None = None
    meta: dict = field(default_factory=dict)


def _ratio(num, den, reason="sin_intentos"):
    """`(valor, razón)` de un cociente (plan §4.3). `None` en `num`/`den` → `no_registrado`
    (conteo crudo desconocido); `den == 0` → `reason` (`sin_intentos` salvo que se pida otra,
    p. ej. `sin_perdidas`); si no, `(round(num/den, 4), None)`. Nunca redondea un nulo a 0."""
    if num is None or den is None:
        return None, "no_registrado"
    if den == 0:
        return None, reason
    return round(num / den, 4), None


def fga(c: dict):
    """T2i + T3i; `None` si cualquiera de los dos conteos es desconocido."""
    a, b = c.get("fga2"), c.get("fga3")
    return None if a is None or b is None else a + b


def fgm(c: dict):
    """T2c + T3c; `None` si cualquiera de los dos conteos es desconocido."""
    a, b = c.get("fgm2"), c.get("fgm3")
    return None if a is None or b is None else a + b


def pos(c: dict):
    """POS = T2i + T3i + 0,44·TLi + PER − RO. `None` si falta cualquier conteo (equivale a
    `possessions()` ya existente, mismos 5 operandos; T-B1 lo verifica con vectores de prueba)."""
    f2, f3, fta, tov, orb = c.get("fga2"), c.get("fga3"), c.get("fta"), c.get("tov"), c.get("orb")
    if None in (f2, f3, fta, tov, orb):
        return None
    return f2 + f3 + 0.44 * fta + tov - orb


def plays(c: dict):
    """Jugadas = T2i + T3i + 0,44·TLi + PER (sin restar el rebote ofensivo, a diferencia de `pos`)."""
    f = fga(c)
    fta, tov = c.get("fta"), c.get("tov")
    if f is None or fta is None or tov is None:
        return None
    return f + 0.44 * fta + tov


def _round_rate(v):
    return None if v is None else round(v, 4)


def _round_vol(v):
    return None if v is None else round(v, 2)


def _m(value=None, reason=None, *, estimated=None, partial=None):
    """Construye un objeto de métrica `{value, reason[, estimated][, partial]}`. Nunca redondea
    un nulo a 0 (regla 6): se espera que `value` ya venga redondeado por el llamador."""
    out = {"value": value, "reason": reason}
    if estimated:
        out["estimated"] = True
    if partial:
        out["partial"] = True
    return out


def _rate_metric(num, den, *, reason="sin_intentos", estimated=None, partial=None):
    v, r = _ratio(num, den, reason)
    return _m(_round_rate(v), r, estimated=estimated, partial=partial)


def _count_metric(value, *, reason_if_none="no_registrado", estimated=None, partial=None):
    if value is None:
        return _m(None, reason_if_none, estimated=estimated, partial=partial)
    return _m(round(value, 2) if isinstance(value, float) else value, None,
               estimated=estimated, partial=partial)


def _na():
    return _m(None, "no_aplica")


def _no_disponible():
    return _m(None, "no_disponible")


def _sin_pbp(*, estimated=None, partial=None):
    return _m(None, "sin_pbp", estimated=estimated, partial=partial)


def _oc_exact_state(oc: dict | None, games: int):
    """`(games_exact, is_partial, has_any)` de la cobertura de pbp de un jugador."""
    if not oc:
        return 0, False, False
    ge = oc.get("games_exact") or 0
    has_any = ge > 0 or (oc.get("games_estimated") or 0) > 0
    return ge, (0 < ge < games), has_any


def _teamlike_volume(bundle: "StatBundle") -> dict:
    own, opp = bundle.own, bundle.opp or {}
    minutes = bundle.minutes
    out = {}
    out["games"] = _m(bundle.games, None)
    out["minutes"] = _m(_round_vol(minutes), None if minutes is not None else "no_registrado")
    own_pos, opp_pos = pos(own), pos(opp)
    out["possessions"] = _m(_round_vol(own_pos), None if own_pos is not None else "no_registrado")
    if own_pos is None or opp_pos is None:
        out["pace"] = _m(None, "no_registrado")
        out["sec_per_poss"] = _m(None, "no_registrado")
    elif not minutes:
        out["pace"] = _m(None, "sin_intentos")
        out["sec_per_poss"] = _m(None, "sin_intentos")
    else:
        avg_pos = (own_pos + opp_pos) / 2
        out["pace"] = _m(_round_vol(40 * avg_pos / minutes), None)
        denom = own_pos + opp_pos
        out["sec_per_poss"] = _rate_metric(minutes * 60, denom)
    return out


def _player_volume(bundle: "StatBundle") -> dict:
    oc = bundle.on_court or {}
    games_exact, is_partial, has_any = _oc_exact_state(bundle.on_court, bundle.games)
    out = {}
    out["games"] = _m(bundle.games, None)
    out["minutes"] = _m(_round_vol(bundle.minutes), None if bundle.minutes is not None else "no_registrado")
    oc_own, oc_opp = oc.get("own") or {}, oc.get("opp") or {}
    oc_own_pos = pos(oc_own) if oc_own else None
    poss_est = oc.get("poss_estimated") or 0
    if not has_any:
        out["possessions"] = _sin_pbp()
    else:
        total_pos = (oc_own_pos or 0) + poss_est
        estimated = (oc.get("games_estimated") or 0) > 0
        out["possessions"] = _m(_round_vol(total_pos), None, estimated=estimated)
    if games_exact == 0:
        out["pace"] = _sin_pbp()
        out["sec_per_poss"] = _sin_pbp()
    else:
        oc_opp_pos = pos(oc_opp)
        oc_seconds = oc.get("seconds") or 0
        if oc_own_pos is None or oc_opp_pos is None or not oc_seconds:
            out["pace"] = _m(None, "sin_intentos", partial=is_partial)
            out["sec_per_poss"] = _m(None, "sin_intentos", partial=is_partial)
        else:
            avg_pos = (oc_own_pos + oc_opp_pos) / 2
            out["pace"] = _m(_round_vol(40 * avg_pos / (oc_seconds / 60)), None, partial=is_partial)
            out["sec_per_poss"] = _rate_metric(oc_seconds, oc_own_pos + oc_opp_pos, partial=is_partial)
    return out


def _teamlike_production(bundle: "StatBundle") -> dict:
    own, opp = bundle.own, bundle.opp or {}
    out = {}
    out["pts"] = _count_metric(own.get("pts"))
    out["pts_against"] = _count_metric(opp.get("pts"))
    own_pos, opp_pos = pos(own), pos(opp)
    out["ppp"] = _rate_metric(own.get("pts"), own_pos)
    out["oer"] = _rate_metric(own.get("pts"), own_pos)
    out["der"] = _rate_metric(opp.get("pts"), opp_pos)
    oer_v = out["oer"]["value"]
    der_v = out["der"]["value"]
    if oer_v is None or der_v is None:
        out["net_rating"] = _m(None, out["oer"]["reason"] or out["der"]["reason"])
    else:
        out["net_rating"] = _m(round(oer_v - der_v, 4), None)
    pts_v, opp_pts_v = own.get("pts"), opp.get("pts")
    out["plus_minus"] = _count_metric(
        None if pts_v is None or opp_pts_v is None else pts_v - opp_pts_v)
    return out


def _player_production(bundle: "StatBundle") -> dict:
    own = bundle.own
    oc = bundle.on_court or {}
    oc_own, oc_opp = oc.get("own") or {}, oc.get("opp") or {}
    games_exact, is_partial, has_any = _oc_exact_state(bundle.on_court, bundle.games)
    out = {}
    out["pts"] = _count_metric(own.get("pts"))
    if games_exact == 0:
        out["pts_against"] = _sin_pbp()
    else:
        out["pts_against"] = _m(oc_opp.get("pts"),
                                  None if oc_opp.get("pts") is not None else "no_registrado",
                                  partial=is_partial)
    own_pos = pos(own)
    out["ppp"] = _rate_metric(own.get("pts"), plays(own))
    out["oer"] = _rate_metric(own.get("pts"), own_pos)
    if games_exact == 0:
        out["der"] = _sin_pbp()
    else:
        oc_opp_pos = pos(oc_opp)
        out["der"] = _rate_metric(oc_opp.get("pts"), oc_opp_pos, partial=is_partial)
    if games_exact == 0 or out["der"]["value"] is None:
        if games_exact == 0:
            out["net_rating"] = _sin_pbp()
        else:
            out["net_rating"] = _m(None, out["der"]["reason"], partial=is_partial)
    else:
        oc_own_pos = pos(oc_own)
        oc_own_rate, oc_reason = _ratio(oc_own.get("pts"), oc_own_pos)
        if oc_own_rate is None:
            out["net_rating"] = _m(None, oc_reason, partial=is_partial)
        else:
            out["net_rating"] = _m(round(oc_own_rate - out["der"]["value"], 4), None, partial=is_partial)
    out["plus_minus"] = _count_metric(own.get("plus_minus"))
    return out


_SHOOTING_COUNT_KEYS = ("fga2", "fgm2", "fga3", "fgm3", "fta", "ftm")


def _shooting_counts(c: dict) -> dict:
    out = {k: _count_metric(c.get(k)) for k in _SHOOTING_COUNT_KEYS}
    out["fga"] = _count_metric(fga(c))
    out["fgm"] = _count_metric(fgm(c))
    return out


def _shooting_rates(c: dict) -> dict:
    out = {}
    f, g = fga(c), fgm(c)
    out["fg_pct"] = _rate_metric(g, f)
    out["fg2_pct"] = _rate_metric(c.get("fgm2"), c.get("fga2"))
    out["fg3_pct"] = _rate_metric(c.get("fgm3"), c.get("fga3"))
    out["ft_pct"] = _rate_metric(c.get("ftm"), c.get("fta"))
    g3 = c.get("fgm3")
    if g is None or g3 is None or f is None:
        out["efg_pct"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(g + 0.5 * g3, f)
        out["efg_pct"] = _m(_round_rate(v), r)
    fta, pts = c.get("fta"), c.get("pts")
    if f is None or fta is None or pts is None:
        out["ts_pct"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(pts, 2 * (f + 0.44 * fta))
        out["ts_pct"] = _m(_round_rate(v), r)
    return out


def _shooting_value(c: dict) -> dict:
    out = {}
    fgm2, fgm3 = c.get("fgm2"), c.get("fgm3")
    f = fga(c)
    if fgm2 is None or fgm3 is None or f is None:
        out["ppt"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(2 * fgm2 + 3 * fgm3, f)
        out["ppt"] = _m(_round_rate(v), r)
    if fgm2 is None or c.get("fga2") is None:
        out["ppt_2"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(2 * fgm2, c.get("fga2"))
        out["ppt_2"] = _m(_round_rate(v), r)
    if fgm3 is None or c.get("fga3") is None:
        out["ppt_3"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(3 * fgm3, c.get("fga3"))
        out["ppt_3"] = _m(_round_rate(v), r)
    out["ppt_ft"] = _rate_metric(c.get("ftm"), c.get("fta"))
    return out


def _shooting_profile(c: dict, shots: dict | None) -> dict:
    out = {}
    f = fga(c)
    out["fg3_uso"] = _rate_metric(c.get("fga3"), f)
    out["fg2_uso"] = _rate_metric(c.get("fga2"), f)
    out["ft_rate"] = _rate_metric(c.get("fta"), f)
    if shots:
        out["paint_fga_share"] = _rate_metric(shots.get("paint_fga"), f)
        out["mid_fga_share"] = _rate_metric(shots.get("mid_fga"), f)
    else:
        out["paint_fga_share"] = _no_disponible()
        out["mid_fga_share"] = _no_disponible()
    return out


def _teamlike_ball(bundle: "StatBundle") -> dict:
    own = bundle.own
    out = {}
    out["ast"] = _count_metric(own.get("ast"))
    out["tov"] = _count_metric(own.get("tov"))
    out["ast_to"] = _rate_metric(own.get("ast"), own.get("tov"), reason="sin_perdidas")
    own_pos = pos(own)
    out["as_pos"] = _rate_metric(own.get("ast"), own_pos)
    f_, g_ = fga(own), fgm(own)
    out["as_pct"] = _rate_metric(own.get("ast"), g_)
    out["to_pct"] = _rate_metric(own.get("tov"), own_pos)   # DA-04: sobre posesiones (no plays)
    return out


def _player_ball(bundle: "StatBundle") -> dict:
    own = bundle.own
    derived = bundle.derived or {}
    out = {}
    out["ast"] = _count_metric(own.get("ast"))
    out["tov"] = _count_metric(own.get("tov"))
    out["ast_to"] = _rate_metric(own.get("ast"), own.get("tov"), reason="sin_perdidas")
    own_pos = pos(own)
    out["as_pos"] = _rate_metric(own.get("ast"), own_pos)
    ast_v, fgm_team_w, own_fgm = own.get("ast"), derived.get("fgm_team_w"), fgm(own)
    if ast_v is None or fgm_team_w is None or own_fgm is None:
        out["as_pct"] = _m(None, "no_registrado")
    else:
        den = fgm_team_w - own_fgm
        v, r = _ratio(ast_v, den)
        out["as_pct"] = _m(_round_rate(v), r)
    out["to_pct"] = _rate_metric(own.get("tov"), plays(own))   # jugador: sobre jugadas propias
    return out


def _teamlike_rebound(bundle: "StatBundle") -> dict:
    own, opp = bundle.own, bundle.opp or {}
    out = {}
    out["orb"] = _count_metric(own.get("orb"))
    out["drb"] = _count_metric(own.get("drb"))
    orb_v, drb_v = own.get("orb"), own.get("drb")
    trb_v = None if orb_v is None or drb_v is None else orb_v + drb_v
    out["trb"] = _count_metric(trb_v)
    opp_orb, opp_drb = opp.get("orb"), opp.get("drb")
    if orb_v is None or opp_drb is None:
        out["or_pct"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(orb_v, orb_v + opp_drb)
        out["or_pct"] = _m(_round_rate(v), r)
    if drb_v is None or opp_orb is None:
        out["dr_pct"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(drb_v, drb_v + opp_orb)
        out["dr_pct"] = _m(_round_rate(v), r)
    if trb_v is None or opp_orb is None or opp_drb is None:
        out["trb_pct"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(trb_v, trb_v + opp_orb + opp_drb)
        out["trb_pct"] = _m(_round_rate(v), r)
    own_pos = pos(own)
    out["orb_pos"] = _rate_metric(orb_v, own_pos)
    minutes = bundle.minutes
    if orb_v is None or not minutes:
        out["orb_min"] = _m(None, "no_registrado" if orb_v is None else "sin_intentos")
    else:
        out["orb_min"] = _m(_round_rate(orb_v / minutes), None)
    if drb_v is None or not minutes:
        out["drb_min"] = _m(None, "no_registrado" if drb_v is None else "sin_intentos")
    else:
        out["drb_min"] = _m(_round_rate(drb_v / minutes), None)
    return out


def _player_rebound(bundle: "StatBundle") -> dict:
    own = bundle.own
    derived = bundle.derived or {}
    out = {}
    out["orb"] = _count_metric(own.get("orb"))
    out["drb"] = _count_metric(own.get("drb"))
    orb_v, drb_v = own.get("orb"), own.get("drb")
    trb_v = None if orb_v is None or drb_v is None else orb_v + drb_v
    out["trb"] = _count_metric(trb_v)
    out["or_pct"] = _rate_metric(orb_v, derived.get("orb_pool_w"))
    out["dr_pct"] = _rate_metric(drb_v, derived.get("drb_pool_w"))
    out["trb_pct"] = _rate_metric(trb_v, derived.get("trb_pool_w"))
    # orb_pos hereda la posesión de volumen (bundle.on_court); se calcula afuera y se inyecta
    out["_orb_pos_num"] = orb_v
    minutes = bundle.minutes
    if orb_v is None or not minutes:
        out["orb_min"] = _m(None, "no_registrado" if orb_v is None else "sin_intentos")
    else:
        out["orb_min"] = _m(_round_rate(orb_v / minutes), None)
    if drb_v is None or not minutes:
        out["drb_min"] = _m(None, "no_registrado" if drb_v is None else "sin_intentos")
    else:
        out["drb_min"] = _m(_round_rate(drb_v / minutes), None)
    return out


def _teamlike_defense(bundle: "StatBundle") -> dict:
    own, opp = bundle.own, bundle.opp or {}
    out = {}
    out["stl"] = _count_metric(own.get("stl"))
    out["blk"] = _count_metric(own.get("blk"))
    if bundle.entity_type == "team":
        out["blk_received"] = _count_metric(own.get("blk_received"))
    else:
        out["blk_received"] = _count_metric(opp.get("blk"))
    stl_v, blk_v = own.get("stl"), own.get("blk")
    out["stops"] = _count_metric(None if stl_v is None or blk_v is None else stl_v + blk_v)
    return out


def _player_defense(bundle: "StatBundle") -> dict:
    own = bundle.own
    out = {}
    out["stl"] = _count_metric(own.get("stl"))
    out["blk"] = _count_metric(own.get("blk"))
    out["blk_received"] = _count_metric(own.get("blk_received"))
    stl_v, blk_v = own.get("stl"), own.get("blk")
    out["stops"] = _count_metric(None if stl_v is None or blk_v is None else stl_v + blk_v)
    return out


def _teamlike_fouls(bundle: "StatBundle") -> dict:
    own = bundle.own
    out = {"pf": _count_metric(own.get("pf"))}
    if bundle.entity_type == "team":
        out["fouls_drawn"] = _count_metric(own.get("fouls_drawn"))
    else:
        # quinteto/onoff/cierre: `fouls_drawn` ya viene derivado de `foulon` del pbp por
        # `lineups.py`/`clutch.py` (plan §4.6/§4.7) y llega en `own["fouls_drawn"]`.
        out["fouls_drawn"] = _count_metric(own.get("fouls_drawn"))
    return out


def _player_fouls(bundle: "StatBundle") -> dict:
    own = bundle.own
    return {"pf": _count_metric(own.get("pf")), "fouls_drawn": _count_metric(own.get("fouls_drawn"))}


def _usage_na() -> dict:
    return {"uso_pct": _na(), "uso_2p": _na(), "uso_3p": _na()}


def _usage_player(bundle: "StatBundle") -> dict:
    own = bundle.own
    derived = bundle.derived or {}
    out = {}
    plays_own = plays(own)
    out["uso_pct"] = _rate_metric(plays_own, derived.get("plays_team_w"))
    out["uso_2p"] = _rate_metric(own.get("fga2"), derived.get("t2a_team_w"))
    out["uso_3p"] = _rate_metric(own.get("fga3"), derived.get("t3a_team_w"))
    return out


def _teamlike_extra(bundle: "StatBundle") -> dict:
    own, opp = bundle.own, bundle.opp or {}
    out = {}
    f = fga(own)
    out["plays"] = _m(_round_vol(plays(own)), None if plays(own) is not None else "no_registrado")
    out["pps"] = _rate_metric(own.get("pts"), f)
    out["ft_rate_report"] = _rate_metric(own.get("ftm"), f)
    pts_v = own.get("pts")
    ftm_v, fgm2_v, fgm3_v = own.get("ftm"), own.get("fgm2"), own.get("fgm3")
    out["peso_1p"] = _rate_metric(ftm_v, pts_v)
    out["peso_2p"] = _rate_metric(None if fgm2_v is None else 2 * fgm2_v, pts_v)
    out["peso_3p"] = _rate_metric(None if fgm3_v is None else 3 * fgm3_v, pts_v)
    plays_own = plays(own)
    out["to_ratio"] = _rate_metric(own.get("tov"), plays_own)
    out["ast_ratio"] = _rate_metric(own.get("ast"), plays_own)
    out.update(_opp_extra(opp))
    stl_v, blk_v, tov_v = own.get("stl"), own.get("blk"), own.get("tov")
    if stl_v is None or blk_v is None or tov_v is None:
        out["def_playmaking"] = _m(None, "no_registrado")
    else:
        out["def_playmaking"] = _m(stl_v + blk_v - tov_v, None)
    drb_v = own.get("drb")
    if stl_v is None or blk_v is None or drb_v is None or tov_v is None:
        out["def_to_ratio"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(stl_v + blk_v + drb_v, tov_v, reason="sin_perdidas")
        out["def_to_ratio"] = _m(_round_rate(v), r)
    orb_v, drb_v2 = own.get("orb"), own.get("drb")
    trb_v = None if orb_v is None or drb_v2 is None else orb_v + drb_v2
    if trb_v is None or stl_v is None:
        out["physical_impact"] = _m(None, "no_registrado")
    else:
        out["physical_impact"] = _m(trb_v + stl_v, None)
    own_pos = pos(own)
    out["tov_pos"] = _rate_metric(tov_v, own_pos)
    out["reb_share"] = _na()
    out["oreb_share"] = _na()
    out["dreb_share"] = _na()
    if bundle.entity_type == "team":
        for key in ("paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts"):
            out[key] = _count_metric(own.get(key))
    else:
        for key in ("paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts"):
            out[key] = _na()
    return out


def _opp_extra(opp: dict) -> dict:
    out = {}
    f = fga(opp)
    g, g3 = fgm(opp), opp.get("fgm3")
    if g is None or g3 is None or f is None:
        out["opp_efg_pct"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(g + 0.5 * g3, f)
        out["opp_efg_pct"] = _m(_round_rate(v), r)
    pts_v, fta_v = opp.get("pts"), opp.get("fta")
    if pts_v is None or f is None or fta_v is None:
        out["opp_ts_pct"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(pts_v, 2 * (f + 0.44 * fta_v))
        out["opp_ts_pct"] = _m(_round_rate(v), r)
    tov_v = opp.get("tov")
    opp_pos = pos(opp)
    out["opp_to_pct"] = _rate_metric(tov_v, opp_pos)
    out["opp_ft_rate"] = _rate_metric(fta_v, f)
    return out


def _player_extra(bundle: "StatBundle") -> dict:
    own = bundle.own
    oc = bundle.on_court or {}
    games_exact, is_partial, has_any = _oc_exact_state(bundle.on_court, bundle.games)
    out = {}
    f = fga(own)
    plays_own = plays(own)
    out["plays"] = _m(_round_vol(plays_own), None if plays_own is not None else "no_registrado")
    out["pps"] = _rate_metric(own.get("pts"), f)
    out["ft_rate_report"] = _rate_metric(own.get("ftm"), f)
    pts_v = own.get("pts")
    ftm_v, fgm2_v, fgm3_v = own.get("ftm"), own.get("fgm2"), own.get("fgm3")
    out["peso_1p"] = _rate_metric(ftm_v, pts_v)
    out["peso_2p"] = _rate_metric(None if fgm2_v is None else 2 * fgm2_v, pts_v)
    out["peso_3p"] = _rate_metric(None if fgm3_v is None else 3 * fgm3_v, pts_v)
    out["to_ratio"] = _rate_metric(own.get("tov"), plays_own)
    out["ast_ratio"] = _rate_metric(own.get("ast"), plays_own)
    if games_exact == 0:
        for key in ("opp_efg_pct", "opp_ts_pct", "opp_to_pct", "opp_ft_rate"):
            out[key] = _sin_pbp()
    else:
        oc_opp = oc.get("opp") or {}
        opp_extra = _opp_extra(oc_opp)
        for key in ("opp_efg_pct", "opp_ts_pct", "opp_to_pct", "opp_ft_rate"):
            v = opp_extra[key]
            v["partial"] = True if is_partial else v.get("partial", False)
            if not v.get("partial"):
                v.pop("partial", None)
            out[key] = v
    stl_v, blk_v, tov_v = own.get("stl"), own.get("blk"), own.get("tov")
    if stl_v is None or blk_v is None or tov_v is None:
        out["def_playmaking"] = _m(None, "no_registrado")
    else:
        out["def_playmaking"] = _m(stl_v + blk_v - tov_v, None)
    drb_v = own.get("drb")
    if stl_v is None or blk_v is None or drb_v is None or tov_v is None:
        out["def_to_ratio"] = _m(None, "no_registrado")
    else:
        v, r = _ratio(stl_v + blk_v + drb_v, tov_v, reason="sin_perdidas")
        out["def_to_ratio"] = _m(_round_rate(v), r)
    orb_v, drb_v2 = own.get("orb"), own.get("drb")
    trb_v = None if orb_v is None or drb_v2 is None else orb_v + drb_v2
    if trb_v is None or stl_v is None:
        out["physical_impact"] = _m(None, "no_registrado")
    else:
        out["physical_impact"] = _m(trb_v + stl_v, None)
    own_pos = pos(own)
    out["tov_pos"] = _rate_metric(tov_v, own_pos)
    team = bundle.team or {}
    t_orb, t_drb = team.get("orb"), team.get("drb")
    t_trb = None if t_orb is None or t_drb is None else t_orb + t_drb
    out["reb_share"] = _rate_metric(trb_v, t_trb)
    out["oreb_share"] = _rate_metric(orb_v, t_orb)
    out["dreb_share"] = _rate_metric(drb_v, t_drb)
    for key in ("paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts"):
        out[key] = _na()
    return out


def compute_standard(bundle: "StatBundle") -> dict:
    """Las 86 métricas del catálogo estándar (plan §4.2/§4.3) a partir de un `StatBundle`.

    Entidades *teamlike* (`team`, `lineup`, `onoff`, `clutch`) usan `own`/`opp`. *player* usa
    `own` para tiro/balón/rebote/defensa/faltas/USO y `on_court` (equipo con el jugador en
    cancha) para volumen y defensa-equipo; `derived` arma USO%/AS%/OR%/DR%/REB% (pesos
    ponderados por minutos, plan §4.5 — ese armado NO vive acá, es `bundles.py`).
    Pureza: no accede a la base ni a la configuración (se prueba con dicts).
    """
    if bundle.games == 0:
        return {key: _m(None, "sin_datos") for key in metrics_catalog_keys()}

    is_player = bundle.entity_type == "player"
    out: dict = {}
    if is_player:
        out.update(_player_volume(bundle))
        out.update(_player_production(bundle))
        out.update(_shooting_counts(bundle.own))
        out.update(_shooting_rates(bundle.own))
        out.update(_shooting_value(bundle.own))
        out.update(_shooting_profile(bundle.own, bundle.shots))
        out.update(_player_ball(bundle))
        rebound = _player_rebound(bundle)
        orb_pos_num = rebound.pop("_orb_pos_num", None)
        out.update(rebound)
        possessions_metric = out.get("possessions", {})
        poss_v = possessions_metric.get("value")
        if orb_pos_num is None or poss_v in (None, 0):
            out["orb_pos"] = _m(None, possessions_metric.get("reason") or "sin_intentos",
                                 estimated=possessions_metric.get("estimated"))
        else:
            out["orb_pos"] = _m(_round_rate(orb_pos_num / poss_v), None,
                                 estimated=possessions_metric.get("estimated"))
        out.update(_player_defense(bundle))
        out.update(_player_fouls(bundle))
        out.update(_usage_player(bundle))
        out.update(_player_extra(bundle))
    else:
        out.update(_teamlike_volume(bundle))
        out.update(_teamlike_production(bundle))
        out.update(_shooting_counts(bundle.own))
        out.update(_shooting_rates(bundle.own))
        out.update(_shooting_value(bundle.own))
        out.update(_shooting_profile(bundle.own, bundle.shots))
        out.update(_teamlike_ball(bundle))
        out.update(_teamlike_rebound(bundle))
        out.update(_teamlike_defense(bundle))
        out.update(_teamlike_fouls(bundle))
        out.update(_usage_na())
        out.update(_teamlike_extra(bundle))

    # A-01: métricas de posesiones reconstruidas
    pc = bundle.possessions_counted
    if pc is not None:
        out["possessions_counted"] = _m(pc, None)
        out["off_poss_duration"] = (_m(round(bundle.poss_seconds / pc, 1), None)
                                    if pc > 0 and bundle.poss_seconds is not None
                                    else _m(None, "sin_intentos"))
    else:
        reason = "sin_pbp" if bundle.games == 0 else "requiere_posesiones"
        out["possessions_counted"] = _m(None, reason)
        out["off_poss_duration"] = _m(None, reason)

    if is_player:
        fp = bundle.finished_poss
        if fp is not None and fp.get("count", 0) > 0 and fp.get("seconds") is not None:
            out["player_poss_duration"] = _m(round(fp["seconds"] / fp["count"], 1), None)
        elif pc is not None:
            out["player_poss_duration"] = _m(None, "sin_intentos")
        else:
            out["player_poss_duration"] = _m(None, reason)
    else:
        out["player_poss_duration"] = _na()

    missing = set(metrics_catalog_keys()) - set(out)
    for key in missing:
        out[key] = _na()
    return out


def metrics_catalog_keys() -> frozenset:
    """Las 86 claves de `compute_standard` (plan §4.2). Vive acá (no en `metrics_catalog.py`,
    Grupo C) para que `compute_standard` no dependa de ese módulo nuevo; cuando exista,
    `metrics_catalog.METRICS` debe tener el mismo `set` (se verifica en T-C1/T-F3)."""
    groups = {
        "volumen": ("games", "minutes", "possessions", "pace", "sec_per_poss",
                    "possessions_counted", "off_poss_duration"),
        "produccion": ("pts", "pts_against", "ppp", "oer", "der", "net_rating", "plus_minus"),
        "tiro_volumen": ("fga2", "fgm2", "fga3", "fgm3", "fta", "ftm", "fga", "fgm"),
        "tiro_pct": ("fg_pct", "fg2_pct", "fg3_pct", "ft_pct", "efg_pct", "ts_pct"),
        "tiro_valor": ("ppt", "ppt_2", "ppt_3", "ppt_ft"),
        "tiro_perfil": ("fg3_uso", "fg2_uso", "ft_rate", "paint_fga_share", "mid_fga_share"),
        "balon": ("ast", "tov", "ast_to", "as_pos", "as_pct", "to_pct"),
        "rebote": ("orb", "drb", "trb", "or_pct", "dr_pct", "trb_pct", "orb_pos", "drb_min", "orb_min"),
        "defensa": ("stl", "blk", "blk_received", "stops"),
        "faltas": ("pf", "fouls_drawn"),
        "uso": ("uso_pct", "uso_2p", "uso_3p", "player_poss_duration"),
        "extra": (
            "plays", "pps", "ft_rate_report", "peso_1p", "peso_2p", "peso_3p",
            "to_ratio", "ast_ratio", "opp_efg_pct", "opp_ts_pct", "opp_to_pct", "opp_ft_rate",
            "def_playmaking", "def_to_ratio", "physical_impact", "tov_pos",
            "reb_share", "oreb_share", "dreb_share",
            "paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts",
        ),
    }
    out = []
    for keys in groups.values():
        out.extend(keys)
    return frozenset(out)


POINTS_ORIGIN_KEYS = ("second_chance_pts", "fast_break_pts", "pts_from_tov")


def points_distribution(t: dict) -> dict:
    """Cómo se consiguieron los puntos de un box de equipo (F-01, F-03). Por tipo de tiro las
    categorías son excluyentes y suman PTS; por origen (desglose de FIBA) se superponen entre sí.
    Desglose no publicado → nulo con razón, nunca 0 (C-11)."""
    def v(value):
        return {"value": value, "reason": None if value is not None else "no_registrado"}

    pts = t.get("pts") or 0
    paint = t.get("paint_pts")
    three = (t.get("fgm3") or 0) * 3
    ft = t.get("ftm") or 0
    mid = None if paint is None else max(0, (t.get("fgm2") or 0) * 2 - paint)
    known = sum(x for x in (paint, mid, three, ft) if x is not None)
    return {
        "total": pts,
        "by_shot": {
            "paint_pts": v(paint), "mid_pts": v(mid), "three_pts": v(three), "ft_pts": v(ft),
            "otros_no_clasificado": v(max(0, pts - known)),
        },
        "by_origin": {k: v(t.get(k)) for k in POINTS_ORIGIN_KEYS},
    }


def sum_bundles(bundles: list) -> "StatBundle":
    """Suma una lista de `StatBundle` de la MISMA entidad (un bundle por partido) en uno solo
    (plan §4.4). Un `None` en cualquier sumando de un conteo deja el total en `None` (C-11: un
    nulo no entra en una suma como 0, nunca se vuelve 0 silencioso)."""
    if not bundles:
        raise ValueError("sum_bundles: lista vacía")

    def _sum_dicts(dicts: list):
        dicts = [d for d in dicts if d is not None]
        if not dicts:
            return None
        keys = set()
        for d in dicts:
            keys.update(d.keys())
        out = {}
        for k in keys:
            vals = [d.get(k) for d in dicts]
            out[k] = None if any(v is None for v in vals) else sum(vals)
        return out

    def _sum_plain(values: list):
        if any(v is None for v in values):
            return None
        return sum(values)

    first = bundles[0]
    own = _sum_dicts([b.own for b in bundles])
    opp = _sum_dicts([b.opp for b in bundles]) if any(b.opp is not None for b in bundles) else None
    team = _sum_dicts([b.team for b in bundles]) if any(b.team is not None for b in bundles) else None

    games = sum(b.games for b in bundles)
    minutes = _sum_plain([b.minutes for b in bundles]) if any(b.minutes is not None for b in bundles) else None
    team_minutes = (_sum_plain([b.team_minutes for b in bundles])
                    if any(b.team_minutes is not None for b in bundles) else None)
    seconds = _sum_plain([b.seconds for b in bundles]) if any(b.seconds is not None for b in bundles) else None
    shots = _sum_dicts([b.shots for b in bundles]) if any(b.shots is not None for b in bundles) else None
    derived = _sum_dicts([b.derived for b in bundles]) if any(b.derived is not None for b in bundles) else None
    possessions_counted = (_sum_plain([b.possessions_counted for b in bundles])
                            if any(b.possessions_counted is not None for b in bundles) else None)

    on_court = None
    if any(b.on_court is not None for b in bundles):
        ocs = [b.on_court or {} for b in bundles]
        on_court = {
            "own": _sum_dicts([oc.get("own") for oc in ocs]),
            "opp": _sum_dicts([oc.get("opp") for oc in ocs]),
            "seconds": _sum_plain([oc.get("seconds") or 0 for oc in ocs]),
            "games_exact": sum(oc.get("games_exact") or 0 for oc in ocs),
            "games_estimated": sum(oc.get("games_estimated") or 0 for oc in ocs),
            "poss_estimated": _sum_plain([oc.get("poss_estimated") or 0 for oc in ocs]),
        }

    game_ids = []
    for b in bundles:
        game_ids.extend((b.meta or {}).get("game_ids") or [])
    meta = dict(bundles[-1].meta or {})
    meta["game_ids"] = game_ids

    null_reasons: dict = {}
    for b in bundles:
        null_reasons.update(b.null_reasons or {})

    return StatBundle(
        entity_type=first.entity_type, entity_id=first.entity_id, name=first.name,
        own=own, opp=opp, team=team,
        games=games, minutes=minutes, team_minutes=team_minutes, seconds=seconds,
        on_court=on_court, shots=shots, possessions_counted=possessions_counted,
        null_reasons=null_reasons, derived=derived, meta=meta,
    )


def apply_base(values: dict, bundle: "StatBundle", base: str) -> dict:
    """Escala el dict `{clave: {value, reason, ...}}` de `compute_standard` a la base pedida
    (plan §4.4). `base == "total"`: igual. `"partido"`: cada clave con `base_mode` `count` o
    `volume` (de `metrics_catalog.METRICS`, Grupo C) y valor no nulo se divide por `bundle.games`
    (`games == 0` → nulo `sin_datos`); `fixed` y `games` no cambian. Cualquier otra base
    (`por40`, `por100`) no está disponible todavía (T-04 la habilita) → `ValueError`.

    NOTA para el Grupo C (`metrics_catalog.py`): esta función importa `METRICS` adentro (import
    local) para evitar el ciclo de imports; hasta que `metrics_catalog.py` exista, cualquier
    `base == "partido"` deja los valores sin escalar y antepone un TODO (ver el bloque
    `except ImportError`). Cuando el catálogo exista, cada `MetricDef` DEBE tener un atributo
    `base_mode` con uno de `"count" | "volume" | "fixed"` (más `"games"` para la propia clave
    `games`, que nunca se escala) para que esta función sepa qué dividir.
    """
    if base == "total":
        return values
    if base not in ("total", "partido", "por40", "por100"):
        raise ValueError("Base no disponible: llega con la normalización por 40 minutos y por 100 posesiones")
    if base in ("por40", "por100"):
        raise ValueError("Base no disponible: llega con la normalización por 40 minutos y por 100 posesiones")

    # base == "partido"
    try:
        from metrics_catalog import METRICS  # import local: evita el ciclo con metrics_catalog.py
    except ImportError:
        # TODO(Grupo C): sin metrics_catalog.METRICS todavía no se puede saber el base_mode de
        # cada clave; se devuelve sin escalar en vez de romper el endpoint. Cuando exista el
        # módulo, este bloque deja de ejecutarse y aplica la división real de abajo.
        return values

    games = bundle.games
    out = {}
    for key, obj in values.items():
        mdef = METRICS.get(key)
        base_mode = getattr(mdef, "base_mode", None) if mdef else None
        value = obj.get("value")
        if base_mode not in ("count", "volume") or value is None:
            out[key] = obj
            continue
        if games == 0:
            new_obj = dict(obj)
            new_obj["value"] = None
            new_obj["reason"] = "sin_datos"
            out[key] = new_obj
        else:
            new_obj = dict(obj)
            new_obj["value"] = round(value / games, 2)
            out[key] = new_obj
    return out
