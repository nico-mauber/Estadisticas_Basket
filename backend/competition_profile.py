"""Líderes y perfil de la competencia (F-14), sobre la población de T-01.

Nada se recalcula acá: los líderes salen de `population.population("player", …)` (la misma población y los mismos valores
que usan las fichas y los percentiles) y los promedios del perfil de `population.league_reference` (el `avg` de la ficha).
"""
import config
import metrics_catalog
import origin as origin_mod
import population
import repository
from context import Context, context_echo

# Métricas clave de la pestaña Líderes (una tarjeta por cada una).
LEADER_METRICS = ["pts", "trb", "ast", "stl", "blk", "efg_pct", "ts_pct", "fg3_pct", "ft_pct", "oer", "uso_pct", "ast_to", "to_pct", "plus_minus"]

# Bloques del perfil: (clave, grupo)
PROFILE_TEAM = ["oer", "der", "net_rating", "efg_pct", "ts_pct", "ppt", "to_pct", "or_pct", "dr_pct", "ft_rate", "ast_to"]
PROFILE_PLAYER = ["pts", "trb", "ast", "stl", "blk", "efg_pct", "ts_pct", "fg3_pct", "ft_pct", "to_pct", "uso_pct", "ast_to"]
PROFILE_PACE = ["pace", "possessions", "sec_per_poss"]
PROFILE_SHOT = ["fg2_uso", "fg3_uso", "ft_uso", "paint_fga_share", "mid_fga_share"]


def _label(comp_id) -> str | None:
    return repository.competition_labels().get(comp_id) if comp_id is not None else None


def _echo(ctx, used=0, total=0):
    return context_echo(ctx, games_used=used, games_total=total, games_excluded={}, ignored=[],
                        competition_label=_label(ctx.competition_id))


def _dir_label(direction: str) -> str:
    return {"lower": "Menor es mejor", "neutral": "Mayor valor"}.get(direction, "Mayor es mejor")


def _meta(key: str) -> dict:
    d = metrics_catalog.METRICS[key]
    return {"key": key, "label": d.label, "fmt": d.fmt, "direction": d.direction, "direction_label": _dir_label(d.direction),
            "base_mode": d.base_mode}


def effective_min_minutes(requested) -> tuple:
    """`(efectivo, subido)`: el mínimo pedido o el de Configuración, nunca menor que el de la población de T-01."""
    floor = config.get("sample.player.min")
    base = config.get("leaders.min_minutes") if requested is None else requested
    eff = max(float(base), float(floor))
    return eff, eff > float(base)


def leaders(metric: str, comp_id: int, ctx: Context, *, min_minutes=None, top_n=None) -> dict:
    """Jugadores de la población ordenados por la métrica según su dirección, con mínimo de minutos. `top_n=None`: todos."""
    d = metrics_catalog.METRICS[metric]
    s = -1 if d.direction == "lower" else 1
    eff, raised = effective_min_minutes(min_minutes)
    pop = population.population("player", comp_id, ctx)
    in_pop = [m for m in pop.members if m.in_population]
    excluded_null = sum(1 for m in in_pop if m.values.get(metric) is None)
    elig = [m for m in in_pop if m.values.get(metric) is not None and (m.sample or {}).get("minutes", 0) >= eff]
    values = [m.values[metric] for m in elig]
    rows = []
    for m in elig:
        v = m.values[metric]
        better = sum(1 for o in values if s * (o - v) > 0)
        rows.append({"rank": better + 1, "tied": sum(1 for o in values if o == v) > 1, "id": m.id, "name": m.name,
                     "team_code": m.team_code, "value": v, "minutes": round((m.sample or {}).get("minutes", 0), 1),
                     "games": m.games, "sample": m.sample})
    rows.sort(key=lambda r: (r["rank"], population._norm_name(r["name"])))
    avg = round(sum(values) / len(values), 4) if values else None
    return {"metric": _meta(metric), "rows": rows if top_n is None else rows[:top_n], "qualified": len(rows),
            "excluded_null": excluded_null, "avg": avg,
            "min_minutes": {"requested": min_minutes, "effective": eff, "raised": raised,
                            "default": config.get("leaders.min_minutes"), "floor": config.get("sample.player.min")},
            "population": {"size": pop.size, "reason": pop.reason, "context_label": pop.context_label}}


def leader_cards(comp_id: int, ctx: Context, *, min_minutes=None, top_n=None) -> dict:
    top = config.get("leaders.top_n") if top_n is None else top_n
    cards = [leaders(m, comp_id, ctx, min_minutes=min_minutes, top_n=top) for m in LEADER_METRICS
             if m in metrics_catalog.METRICS and "player" in metrics_catalog.METRICS[m].entities]
    eff, raised = effective_min_minutes(min_minutes)
    return {"cards": cards, "top_n": top,
            "min_minutes": {"requested": min_minutes, "effective": eff, "raised": raised,
                            "default": config.get("leaders.min_minutes"), "floor": config.get("sample.player.min")},
            "metrics": [_meta(k) for k, dd in metrics_catalog.METRICS.items()
                        if "player" in dd.entities and dd.base_mode in ("count", "fixed") and dd.direction != "none"]}


def _block(entity_type: str, keys: list, comp_id: int, ctx: Context) -> list:
    pop = population.population(entity_type, comp_id, ctx)
    members = [m for m in pop.members if m.in_population]
    ref = population.league_reference(entity_type, comp_id, ctx)
    out = []
    for k in keys:
        if k not in metrics_catalog.METRICS or entity_type not in metrics_catalog.METRICS[k].entities:
            continue
        vals = [m for m in members if m.values.get(k) is not None]
        best = population._leader(vals, k, metrics_catalog.METRICS[k].direction) if vals else None
        out.append({**_meta(k), "avg": ref.get(k), "n": len(vals),
                    "best": {"id": best.id, "name": best.name, "value": best.values[k]} if best else None,
                    "reason": None if ref.get(k) is not None else ("poblacion_insuficiente" if len(vals) < config.get("population.min_size") else "sin_datos")})
    return out


def _origins(comp_id: int, ctx: Context, side: str = "ataque") -> list:
    rows, total = [], 0
    for key in origin_mod.ORIGINS:
        pop = population.population("origin", comp_id, ctx, variant=f"{key}:{side}", apply_thresholds=False)
        vals = [m.values.get("ppp") for m in pop.members if m.values.get("ppp") is not None]
        poss = sum(((m.sample or {}).get("possessions") or 0) for m in pop.members)
        total += poss
        rows.append({"origin": key, "label": origin_mod.LABELS.get(key, key), "ppp_avg": round(sum(vals) / len(vals), 4) if vals else None,
                     "teams": len(vals), "possessions": round(poss, 1)})
    for r in rows:
        r["share"] = round(r["possessions"] / total, 4) if total else None
    return rows


def profile(comp_id: int, ctx: Context) -> dict:
    """Perfil de la competencia: promedios de referencia (equipos y jugadores), ritmo, reparto de tiro y PPP por origen."""
    tpop = population.population("team", comp_id, ctx)
    out = {"competition": {"id": comp_id, "label": _label(comp_id)},
           "population": {"teams": tpop.size, "reason": tpop.reason, "criterion": tpop.criterion,
                          "context_label": tpop.context_label,
                          "players": population.population("player", comp_id, ctx).size},
           "reference": {"teams": _block("team", PROFILE_TEAM, comp_id, ctx), "players": _block("player", PROFILE_PLAYER, comp_id, ctx)},
           "pace": _block("team", PROFILE_PACE, comp_id, ctx),
           "shot": _block("team", PROFILE_SHOT, comp_id, ctx),
           "origins": _origins(comp_id, ctx),
           "insufficient": tpop.size < config.get("population.min_size")}
    out["context"] = _echo(ctx)
    return out
