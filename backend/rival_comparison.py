"""Enfrentamiento directo (F-20): el equipo contra un rival elegido frente a sus promedios generales.

El historial de partidos lo da `prepare.head_to_head` (F-03); acá se compara el valor agregado ("pooled") del equipo en
los partidos contra ese rival con su valor agregado en toda la selección, para las métricas del plan de juego (F-17).
Las diferencias más marcadas usan el mismo criterio que el plan: diferencia orientada (positivo = mejor) dividida por el
desvío poblacional de la métrica.
"""
from dataclasses import replace

import bundles
import config
import context as context_mod
import metrics_catalog
import phrases
import population
import repository
import sample as sample_mod
import stats_engine


def opponents(team_code: str, comp_id: int | None) -> list:
    """Rivales con los que el equipo jugó en la competencia, con la cantidad de enfrentamientos (más jugados primero)."""
    rows = repository.team_game_rows(comp_id)
    counts, names = {}, {}
    for r in rows.values():
        if r["team_code"] != team_code:
            continue
        opp = repository.opponent_row(rows, r)
        if opp is None:
            continue
        counts[opp["team_code"]] = counts.get(opp["team_code"], 0) + 1
        names[opp["team_code"]] = opp["team_name"]
    return sorted(({"code": c, "name": names[c], "games": n} for c, n in counts.items()),
                  key=lambda o: (-o["games"], o["name"]))


def _values(bundle) -> dict:
    vals = stats_engine.compute_standard(bundle)
    try:
        vals = stats_engine.apply_base(vals, bundle, "partido")
    except ValueError:
        pass
    return {k: (vals.get(k) or {}).get("value") for k in stats_engine.metrics_catalog_keys()}


def compare(team_code: str, rival_code: str, comp_id: int | None, ctx) -> dict:
    """`{vs, general, rows, items, reason}`: el equipo contra el rival y en general, por métrica del plan de juego."""
    rules = phrases.load_rules()
    keys = rules["game_plan"]["team"]
    cfg = {"items_min": config.get("gameplan.items_min"), "items_max": config.get("gameplan.items_max"),
           "min_z": config.get("gameplan.min_z")}
    ctx_general = replace(ctx, opponent=None)
    ctx_vs = replace(ctx, opponent=rival_code)
    b_vs = bundles._team_bundle_from_games(team_code, comp_id, ctx_vs)
    b_all = bundles._team_bundle_from_games(team_code, comp_id, ctx_general)
    out = {"team": team_code, "rival": rival_code, "rows": [], "items": [], "reason": None,
           "vs": {"games": 0, "sample": None}, "general": {"games": 0},
           "rule": {**cfg, "order": "abs_z"}}
    if b_vs is None:
        out["reason"] = "sin_historial"
        return out
    out["vs"] = {"games": b_vs.games, "sample": sample_mod.sample_for("team", [b_vs])}
    out["general"] = {"games": b_all.games if b_all else 0}
    if b_all is None:
        out["reason"] = "sin_datos"
        return out
    v_vs, v_all = _values(b_vs), _values(b_all)
    # El desvío sale de toda la competencia sin mínimos de muestra (como en Preparar): con pocos partidos por equipo la población con umbrales queda vacía.
    pop = population.population("team", comp_id, ctx_general, apply_thresholds=False)
    cands = []
    for order, m in enumerate(keys):
        d = metrics_catalog.METRICS[m]
        a, g = v_vs.get(m), v_all.get(m)
        row = {"metric": m, "label": d.label, "group": d.group, "fmt": d.fmt, "vs": a, "general": g,
               "delta": None, "delta_raw": None, "reason": None if a is not None and g is not None else "sin_dato"}
        if a is not None and g is not None:
            s = -1 if d.direction == "lower" else 1
            row["delta_raw"] = round(a - g, 4)
            row["delta"] = round(s * (a - g), 4)
            sigma = phrases._sigma(pop, m)
            if sigma is not None and row["delta"] != 0:
                cands.append({**row, "z": round(row["delta"] / sigma, 3), "order": order,
                              "family": phrases._family(m, rules)})
        out["rows"].append(row)
    # Diferencias más marcadas: con |z| ≥ min_z (hasta items_max); si hay menos que items_min, se completa con las siguientes.
    pool = sorted(cands, key=lambda c: (-abs(c["z"]), c["order"]))
    items, used = [], set()
    for c in pool:
        if abs(c["z"]) >= cfg["min_z"] and len(items) < cfg["items_max"] and c["family"] not in used:
            items.append(c); used.add(c["family"])
    for c in pool:
        if len(items) >= cfg["items_min"]:
            break
        if c not in items and c["family"] not in used:
            c["minor"] = True; items.append(c); used.add(c["family"])
    for c in items:
        c.setdefault("minor", False)
        c["direction"] = "ventaja" if c["delta"] > 0 else "riesgo"
        c["icon"] = "↑" if c["delta"] > 0 else "↓"
        c["own"], c["ref"] = c["vs"], c["general"]
        c["percentile"] = None
        tpl = phrases.pick_template(c["metric"], c["direction"], "team")
        c["text"] = phrases.render(tpl["id"], {"entidad": team_code, "metrica": c["label"], "valor": "", "referencia": "",
                                              "delta": "", "p": "", "media": "", "rival": rival_code}) if tpl else ""
        c.pop("order", None)
    out["items"] = sorted(items, key=lambda c: -abs(c["z"]))
    if not out["items"]:
        out["reason"] = "sin_diferencias"
    return out
