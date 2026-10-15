"""
Confiabilidad de muestra (T-02) — plan §4.1: niveles, umbral relativo, prior de la
competencia, regresión a la media, banda de error, rankeabilidad y calibración de K.

Módulo sin persistencia (DA-37): lee todo de `config.get()` (F-13) y opera sobre los
`StatBundle` de T-05 (`stats_engine.py`). Se engancha en un único punto: el armado del
payload estándar (`metrics_catalog.build_payload`).
"""
import math

import config
import context
import repository
from stats_engine import pos, StatBundle

# ── Mapeo entidad → prefijo de configuración (plan §4.1, PROPUESTA) ──────────
ENTITY_SAMPLE = {
    "lineup": "lineup", "pair": "pair", "onoff": "onoff", "matchup": "matchup",
    "split": "split", "clutch": "split", "period": "split", "origin": "split",
    "ptype": "split", "chance": "split", "chain": "split",
    "clock": "clock_zone", "zone": "clock_zone", "clutch_lineup": "clutch_lineup",
    "player": "player", "team": "team",
}

UNIT = {}
for _e in ("lineup", "pair", "onoff", "matchup", "split", "clutch", "period", "origin",
           "ptype", "chance", "chain"):
    UNIT[_e] = "posesiones"
for _e in ("clock", "zone"):
    UNIT[_e] = "intentos"
UNIT["player"] = "minutos"
UNIT["team"] = "partidos"
UNIT["clutch_lineup"] = "partidos"

REGRESSED_TYPES = {"lineup", "pair", "onoff", "matchup", "split", "clutch", "clutch_lineup"}
REGRESSED_KEYS = ("oer", "der", "net_rating")


# ── T-B1: niveles, umbral relativo, rankeabilidad ────────────────────────────

def effective_min(entity_type: str, *, team_poss: float | None = None) -> float:
    """Mínimo efectivo de la entidad: piso absoluto o, si está habilitado el umbral relativo
    y la entidad tiene porcentaje definido, `max(absoluto, pct/100 · team_poss)` (RF-4)."""
    p = ENTITY_SAMPLE[entity_type]
    if entity_type == "clutch_lineup":
        m = config.get(f"sample.{p}.min_poss")
    else:
        m = config.get(f"sample.{p}.min")
    rel_key = f"sample.{p}.rel_pct"
    rel = config.get(rel_key) if rel_key in config.CONFIG_SPEC else None
    if config.get("sample.relative_enabled") and rel is not None and team_poss is not None:
        return max(m, rel / 100 * team_poss)
    return m


def sample_level(entity_type: str, *, n: float | None, unit: str, team_poss: float | None = None,
                  games: int | None = None, minutes: float | None = None,
                  possessions: float | None = None) -> dict:
    """Badge de muestra (plan §4.1/§8, arquitectura §7.2)."""
    p = ENTITY_SAMPLE[entity_type]
    n_eff = n if n is not None else 0

    if entity_type == "clutch_lineup":
        m_abs = config.get(f"sample.{p}.min_poss")
        hi = config.get(f"sample.{p}.high_games")
        mn = effective_min(entity_type, team_poss=team_poss)
        if n_eff < mn:
            level = "baja"
        else:
            level = "alta"
    else:
        m_abs = config.get(f"sample.{p}.min")
        hi = config.get(f"sample.{p}.high")
        mn = effective_min(entity_type, team_poss=team_poss)
        if n_eff < mn:
            level = "baja"
        elif n_eff < hi:
            level = "media"
        else:
            level = "alta"

    min_source = "relativo" if mn > m_abs else "absoluto"

    return {
        "level": level,
        "unit": unit,
        "n": round(n_eff, 1),
        "min": round(mn, 1),
        "high": hi,
        "min_source": min_source,
        "games": games,
        "minutes": minutes,
        "possessions": possessions,
        "ranked": level != "baja",
    }


def is_ranked(badge: dict | None) -> bool:
    return badge is not None and badge["level"] != "baja"


# ── T-B2: prior de la competencia y posesiones ofensivas del equipo ──────────

def league_prior(comp_id: int | None, ctx: "context.Context") -> float | None:
    """Σ puntos / Σ posesiones de todos los equipo-partido de la competencia en el contexto
    (plan §4.1). `None` si no hay posesiones."""
    key = ("sample:prior", comp_id, context.context_key(ctx))

    def build():
        rows = repository.team_game_rows(comp_id)
        games = list(rows.values())
        games = context.filter_games(games, ctx)
        total_pts = 0.0
        total_pos = 0.0
        for r in games:
            p = pos(r)
            if p is None:
                continue
            total_pos += p
            total_pts += r.get("pts") or 0
        if total_pos <= 0:
            return None
        return total_pts / total_pos

    return repository.memo(key, build)


def team_offensive_possessions(team_code: str, comp_id: int | None,
                                ctx: "context.Context") -> float | None:
    """Σ posesiones ofensivas del equipo en la competencia y el contexto (plan §4.1)."""
    key = ("sample:team_poss", team_code, comp_id, context.context_key(ctx))

    def build():
        rows = repository.team_game_rows(comp_id)
        own = [r for r in rows.values() if r["team_code"] == team_code]
        own = context.filter_games(own, ctx, team_code)
        total = 0.0
        any_val = False
        for r in own:
            p = pos(r)
            if p is None:
                continue
            total += p
            any_val = True
        return total if any_val else None

    return repository.memo(key, build)


# ── T-B3: regresión a la media, banda de error ───────────────────────────────

def band(poss: float, entity_type: str, metric_key: str, *, poss_def: float | None = None) -> float:
    """Banda de error 95% (plan §4.1/RF-9): OER/DER `z·σ/√(poss+K)`; Net Rating
    `z·σ·√(1/(poss_of+K) + 1/(poss_def+K))`."""
    p = ENTITY_SAMPLE[entity_type]
    z = config.get("sample.band_z")
    try:
        import possessions as _poss_mod
        ps = _poss_mod.ppp_stats(config.get("ui.default_competition_id") or 1)
        sigma = ps["sd"] if ps["n"] >= 500 and ps["sd"] else config.get("sample.ppp_sd")
    except Exception:
        sigma = config.get("sample.ppp_sd")
    k = config.get(f"regression.{p}.k")
    if metric_key == "net_rating":
        pd = poss_def if poss_def is not None else poss
        denom_of = poss + k
        denom_def = pd + k
        if denom_of <= 0 or denom_def <= 0:
            return 0.0
        return round(z * sigma * math.sqrt(1 / denom_of + 1 / denom_def), 4)
    denom = poss + k
    if denom <= 0:
        return 0.0
    return round(z * sigma / math.sqrt(denom), 4)


def adjusted(value: float | None, poss: float, prior: float | None, entity_type: str,
             *, metric_key: str = "oer") -> dict | None:
    """Valor ajustado por regresión a la media (plan §4.1/RF-7): `(pos·v + K·prior)/(pos+K)`."""
    if value is None or prior is None:
        return None
    p = ENTITY_SAMPLE[entity_type]
    k = config.get(f"regression.{p}.k")
    denom = poss + k
    if denom == 0:
        return None
    v_aj = (poss * value + k * prior) / denom
    return {
        "value": round(v_aj, 4),
        "k": k,
        "prior": round(prior, 4),
        "band": band(poss, entity_type, metric_key),
    }


def adjust_values(values: dict, bundle: "StatBundle", prior: float | None) -> dict:
    """Agrega `.adj` a `oer`/`der`/`net_rating` de `values` (plan §4.1 última fila)."""
    if bundle.entity_type not in REGRESSED_TYPES:
        return values

    pos_of = pos(bundle.own) or 0
    pos_def = pos(bundle.opp) if bundle.opp is not None else None
    pos_def = pos_def if pos_def is not None else 0

    out = dict(values)

    oer_obj = out.get("oer") or {}
    der_obj = out.get("der") or {}
    net_obj = out.get("net_rating") or {}

    oer_adj = adjusted(oer_obj.get("value"), pos_of, prior, bundle.entity_type, metric_key="oer")
    der_adj = adjusted(der_obj.get("value"), pos_def, prior, bundle.entity_type, metric_key="der")

    if oer_obj:
        new_oer = dict(oer_obj)
        new_oer["adj"] = oer_adj
        out["oer"] = new_oer
    if der_obj:
        new_der = dict(der_obj)
        new_der["adj"] = der_adj
        out["der"] = new_der

    if oer_adj is not None and der_adj is not None:
        p = ENTITY_SAMPLE[bundle.entity_type]
        k = config.get(f"regression.{p}.k")
        net_adj = {
            "value": round(oer_adj["value"] - der_adj["value"], 4),
            "k": k,
            "prior": 0.0,
            "band": band(pos_of, bundle.entity_type, "net_rating", poss_def=pos_def),
        }
    else:
        net_adj = None

    if net_obj:
        new_net = dict(net_obj)
        new_net["adj"] = net_adj
        out["net_rating"] = new_net

    return out


# ── T-B4: badge de una entidad a partir de sus bundles ───────────────────────

def sample_for(entity_type: str, bundles: list, *, team_poss: float | None = None) -> dict:
    """Badge de muestra de una entidad a partir de sus `StatBundle` (plan §4.1)."""
    unit = UNIT[entity_type]

    if entity_type == "onoff":
        on_b, off_b = bundles[0], bundles[1]
        pos_on = pos(on_b.own) or 0
        pos_off = pos(off_b.own) or 0
        n = min(pos_on, pos_off)
        games = (on_b.games or 0) + (off_b.games or 0)
        seconds = (on_b.seconds or 0) + (off_b.seconds or 0)
        minutes = (on_b.minutes if on_b.minutes is not None else (seconds / 60 if seconds else 0.0))
        possessions = pos_on + pos_off
        return sample_level(entity_type, n=n, unit=unit, team_poss=team_poss,
                             games=games, minutes=minutes, possessions=possessions)

    bundle = bundles[0]
    own_pos = pos(bundle.own) or 0
    games = bundle.games
    minutes = bundle.minutes if bundle.minutes is not None else (
        (bundle.seconds / 60) if bundle.seconds else None)
    possessions = own_pos

    if entity_type == "clutch_lineup":
        n = games
    elif unit == "minutos":
        n = minutes
    elif unit == "partidos":
        n = games
    else:
        n = own_pos

    return sample_level(entity_type, n=n, unit=unit, team_poss=team_poss,
                         games=games, minutes=minutes, possessions=possessions)


# ── T-B6: calibración de K por correlación de mitades ────────────────────────

def _pearson(xs: list, ys: list) -> float | None:
    """Correlación de Pearson en Python puro (sin numpy/scipy)."""
    n = len(xs)
    if n < 2:
        return None
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den_x = math.sqrt(sum((x - mean_x) ** 2 for x in xs))
    den_y = math.sqrt(sum((y - mean_y) ** 2 for y in ys))
    if den_x == 0 or den_y == 0:
        return None
    return num / (den_x * den_y)


def _teams_of(comp_id: int) -> list[str]:
    rows = repository.team_game_rows(comp_id)
    return sorted({r["team_code"] for r in rows.values()})


def _lineup_units_for_team(team_code: str, comp_id: int, min_poss: float) -> tuple[list, int]:
    """`([(n_a, oer_a, n_b, oer_b), ...], excluded)` por quinteto del equipo, partidos alternos."""
    import lineups
    games = repository.team_pbp_games(team_code, comp_id)
    games = sorted(games, key=lambda g: (g.get("info", {}).get("date") or "", g.get("game_id") or ""))
    half_a = games[0::2]
    half_b = games[1::2]
    a_bundles = {b.entity_id: b for b in lineups._lineup_bundles(half_a, team_code, 5)}
    b_bundles = {b.entity_id: b for b in lineups._lineup_bundles(half_b, team_code, 5)}
    out = []
    excluded = 0
    for uid in set(a_bundles) & set(b_bundles):
        ba, bb = a_bundles[uid], b_bundles[uid]
        n_a, n_b = pos(ba.own) or 0, pos(bb.own) or 0
        pts_a, pts_b = ba.own.get("pts") or 0, bb.own.get("pts") or 0
        if n_a + n_b < min_poss or n_a == 0 or n_b == 0:
            excluded += 1
            continue
        out.append((n_a, pts_a / n_a, n_b, pts_b / n_b))
    return out, excluded


def _onoff_units_for_team(team_code: str, comp_id: int, min_poss: float) -> tuple[list, int]:
    """`([(n_a, oer_a, n_b, oer_b), ...], excluded)` por jugador (estado ON) del equipo,
    partidos alternos.

    DECISIÓN DE DISEÑO (T-B6, no está en el pseudo-código literal): la unidad es el jugador,
    estado ON; se construye con `lineups.onoff_bundles` sobre cada mitad de partidos (misma
    partición ON/OFF que el endpoint usa en producción), filtrando el lado ON de cada mitad.
    """
    import lineups
    import identity
    from database import Player

    games = repository.team_pbp_games(team_code, comp_id)
    games = sorted(games, key=lambda g: (g.get("info", {}).get("date") or "", g.get("game_id") or ""))
    games = identity.canonicalize_pbp_games(games, team_code)
    half_a = games[0::2]
    half_b = games[1::2]

    players = Player.query.filter_by(team_code=team_code).all()
    names = sorted({p.display_name for p in players})

    out = []
    excluded = 0
    for name in names:
        res_a = lineups.onoff_bundles(half_a, team_code, name, entity_id=f"{team_code}:{name}", name=name)
        res_b = lineups.onoff_bundles(half_b, team_code, name, entity_id=f"{team_code}:{name}", name=name)
        if res_a is None or res_b is None:
            continue
        on_a, _ = res_a
        on_b, _ = res_b
        n_a, n_b = pos(on_a.own) or 0, pos(on_b.own) or 0
        pts_a, pts_b = on_a.own.get("pts") or 0, on_b.own.get("pts") or 0
        if n_a + n_b < min_poss or n_a == 0 or n_b == 0:
            excluded += 1
            continue
        out.append((n_a, pts_a / n_a, n_b, pts_b / n_b))
    return out, excluded


def calibrate_k(entity_type: str, comp_id: int, method: str = "partidos_alternos") -> dict:
    """Calibración de K por correlación de mitades (partidos alternos), plan §4.3."""
    if entity_type not in ("lineup", "onoff"):
        raise ValueError("no_calibrable")

    p = ENTITY_SAMPLE[entity_type]
    min_poss = config.get(f"sample.{p}.min")

    units = []
    excluded = 0
    for team in _teams_of(comp_id):
        if entity_type == "lineup":
            team_units, team_excluded = _lineup_units_for_team(team, comp_id, min_poss)
        else:
            team_units, team_excluded = _onoff_units_for_team(team, comp_id, min_poss)
        units.extend(team_units)
        excluded += team_excluded

    warnings = []
    if len(units) < 10:
        warnings.append("muestra_insuficiente")

    r = _pearson([u[1] for u in units], [u[3] for u in units]) if len(units) >= 3 else None
    if r is None or r <= 0:
        warnings.append("correlacion_no_positiva")

    if units:
        n_half_mean = sum((u[0] + u[2]) / 2 for u in units) / len(units)
    else:
        n_half_mean = None

    if warnings or r is None or n_half_mean is None:
        k_suggested = None
    else:
        k_suggested = n_half_mean * (1 - r) / r

    return {
        "entity": entity_type,
        "competition_id": comp_id,
        "method": method,
        "units": len(units),
        "units_excluded": excluded,
        "n_half_mean": round(n_half_mean, 1) if n_half_mean is not None else None,
        "r": round(r, 3) if r is not None else None,
        "k_suggested": round(k_suggested, 1) if k_suggested is not None else None,
        "k_current": config.get(f"regression.{p}.k"),
        "config_key": f"regression.{p}.k",
        "warnings": warnings,
    }
