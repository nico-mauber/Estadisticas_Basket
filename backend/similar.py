"""Jugadores de perfil parecido (A-09).

Perfil de nueve dimensiones —USO%, reparto de tiro por zona, OR%, DR%, AS%, TO%, PPT, FT Rate y minutos por partido—,
normalizadas con z-score dentro de la competencia (población de jugadores de T-01) y comparadas con distancia euclidiana.
Una dimensión sin dato no se reemplaza por 0 ni por la media: el par se compara solo en las dimensiones disponibles en ambos
y un candidato con menos de `MIN_DIMS` comparables se excluye. No hay IA: son cuentas sobre los valores de la ficha.

Distancia: `d = raíz( Σ (zA − zB)² / n )` con `n` = dimensiones comparables. La reparto por zona cuenta como UNA dimensión
(su diferencia cuadrática es la media de las diferencias de sus componentes). Similitud (0 a 100): `100 · exp(−d)`, monótona
decreciente: distancia 0 → 100; una desviación estándar de diferencia media → 37.
"""
import math
import statistics

import cache
import config
import identity
import population
import repository
from context import Context, context_key

MIN_DIMS = 6
ZONE_KEYS = ("paint_fga_share", "mid_fga_share")   # el tercer componente (triples) es el resto
# (clave, etiqueta, formato): "zonas" es la dimensión compuesta; "min_pg" sale de minutos y partidos
DIMENSIONS = [
    ("uso_pct", "USO%", "pct"), ("zonas", "Reparto de tiro", "zonas"), ("or_pct", "OR%", "pct"), ("dr_pct", "DR%", "pct"),
    ("as_pct", "AS%", "pct"), ("to_pct", "TO%", "pct"), ("ppt", "PPT", "dec2"), ("ft_rate", "FT Rate", "dec2"),
    ("min_pg", "Min/partido", "dec1"),
]
POSITION_GROUPS = ("G", "F", "C")


class SimilarError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status

    def payload(self) -> dict:
        return {"error": self.message, "code": self.code}


def _positions(comp_id) -> dict:
    """Grupo de posición (G, F, C) de cada jugador: el más frecuente de sus partidos en la competencia."""
    count: dict = {}
    for r in repository.player_game_rows(comp_id):
        g = identity.position_group(r.get("position"))
        if g:
            count.setdefault(r["player_id"], {}).setdefault(g, 0)
            count[r["player_id"]][g] += 1
    return {pid: max(c.items(), key=lambda kv: (kv[1], kv[0]))[0] for pid, c in count.items()}


def _raw(m) -> dict:
    """Valores crudos de las nueve dimensiones de un miembro de la población (`None` si no hay dato)."""
    v = m.values
    games = (m.sample or {}).get("games") or m.games or 0
    minutes = (m.sample or {}).get("minutes")
    zones = [v.get(k) for k in ZONE_KEYS]
    zones = None if any(z is None for z in zones) else zones + [max(0.0, 1.0 - sum(zones))]
    return {"uso_pct": v.get("uso_pct"), "zonas": zones, "or_pct": v.get("or_pct"), "dr_pct": v.get("dr_pct"),
            "as_pct": v.get("as_pct"), "to_pct": v.get("to_pct"), "ppt": v.get("ppt"), "ft_rate": v.get("ft_rate"),
            "min_pg": (minutes / games) if minutes is not None and games else None}


def _stats(rows: list) -> dict:
    """Media y desvío de cada dimensión (por componente en las zonas). Sin variación → la dimensión no se usa."""
    out = {}
    for key, _, _ in DIMENSIONS:
        if key == "zonas":
            comps = []
            for i in range(3):
                vals = [r["zonas"][i] for r in rows if r["zonas"] is not None]
                sd = statistics.pstdev(vals) if len(vals) > 1 else 0
                comps.append((statistics.fmean(vals), sd) if vals and sd > 0 else None)
            out[key] = comps if all(comps) else None
        else:
            vals = [r[key] for r in rows if r[key] is not None]
            sd = statistics.pstdev(vals) if len(vals) > 1 else 0
            out[key] = (statistics.fmean(vals), sd) if vals and sd > 0 else None
    return out


def _z(raw: dict, st: dict) -> dict:
    z = {}
    for key, _, _ in DIMENSIONS:
        s = st.get(key)
        v = raw.get(key)
        if s is None or v is None:
            z[key] = None
        elif key == "zonas":
            z[key] = [(x - m) / sd for x, (m, sd) in zip(v, s)]
        else:
            z[key] = (v - s[0]) / s[1]
    return z


def _diff2(key: str, a, b) -> float:
    if key == "zonas":
        return sum((x - y) ** 2 for x, y in zip(a, b)) / len(a)
    return (a - b) ** 2


def similarity(d: float) -> float:
    return round(100 * math.exp(-d), 1)


def similar_players(player_id: int, comp_id: int, ctx: Context, *, top_n=None, position: str = "", min_minutes=None) -> dict:
    top = config.get("similar.top_n") if top_n is None else top_n
    key = (player_id, comp_id, context_key(ctx), top, position, min_minutes)
    return cache.memo("similar", key, lambda: _build(player_id, comp_id, ctx, top, position, min_minutes))


def _build(player_id, comp_id, ctx, top, position, min_minutes) -> dict:
    floor = float(config.get("sample.player.min"))
    min_eff = max(float(min_minutes), floor) if min_minutes is not None else floor
    pop = population.population("player", comp_id, ctx)
    members = [m for m in pop.members if m.in_population]
    ref = population.population("player", comp_id, ctx, apply_thresholds=False).get(player_id)
    if ref is None or not (ref.games or 0):
        raise SimilarError("no_encontrado", "El jugador no tiene partidos en esa competencia.", 404)
    raws = {m.id: _raw(m) for m in members}
    ref_raw = raws.get(ref.id) or _raw(ref)
    st = _stats(list(raws.values()))
    usable = [k for k, _, _ in DIMENSIONS if st.get(k) is not None]
    zs = {pid: _z(r, st) for pid, r in raws.items()}
    z_ref = _z(ref_raw, st)
    groups = _positions(comp_id)
    ref_group = groups.get(ref.id)
    want = ref_group if position == "misma" else position
    cands, excluded = [], {"perfil_incompleto": 0, "posicion": 0, "minutos": 0}
    for m in members:
        if m.id == ref.id:
            continue
        if (m.sample or {}).get("minutes", 0) < min_eff:
            excluded["minutos"] += 1
            continue
        if want and groups.get(m.id) != want:
            excluded["posicion"] += 1
            continue
        zb = zs[m.id]
        dims = [k for k in usable if z_ref.get(k) is not None and zb.get(k) is not None]
        if len(dims) < MIN_DIMS:
            excluded["perfil_incompleto"] += 1
            continue
        terms = {k: _diff2(k, z_ref[k], zb[k]) for k in dims}
        d = math.sqrt(sum(terms.values()) / len(dims))
        ordered = sorted(dims, key=lambda k: terms[k])
        cands.append({"id": m.id, "name": m.name, "team_code": m.team_code, "position_group": groups.get(m.id), "games": m.games,
                      "minutes_pg": raws[m.id]["min_pg"], "distance": round(d, 3), "similarity": similarity(d), "dims": len(dims),
                      "closest": ordered[:2], "farthest": ordered[-2:][::-1], "values": raws[m.id], "sample": m.sample})
    cands.sort(key=lambda c: (c["distance"], population._norm_name(c["name"])))
    labels = {k: lbl for k, lbl, _ in DIMENSIONS}
    for c in cands:
        c["closest"] = [{"key": k, "label": labels[k]} for k in c["closest"]]
        c["farthest"] = [{"key": k, "label": labels[k]} for k in c["farthest"]]
    return {
        "reference": {"id": ref.id, "name": ref.name, "team_code": ref.team_code, "position_group": ref_group, "games": ref.games,
                      "sample": ref.sample, "values": ref_raw, "low_sample": bool(ref.sample and ref.sample.get("level") == "baja")},
        "results": cands[:top], "candidates": len(cands), "excluded": excluded,
        "dimensions": [{"key": k, "label": lbl, "fmt": f, "used": k in usable} for k, lbl, f in DIMENSIONS],
        "method": {"normalization": "z-score dentro de la competencia", "distance": "euclidiana sobre z-scores, peso igual por dimensión",
                   "similarity": "100 · exp(−distancia)", "min_dims": MIN_DIMS},
        "filters": {"position": position or None, "position_resolved": want or None, "min_minutes": min_eff, "top_n": top},
        "population": {"size": pop.size, "criterion": pop.criterion, "competition_id": comp_id},
    }
