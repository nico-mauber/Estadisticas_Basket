"""Buscador de quintetos de una competencia (F-10).

Universo = todos los quintetos de los equipos de la competencia (`lineups.all_lineups`, F-06) con el conjunto estándar,
la regresión y la muestra de T-02. Los filtros (equipo, jugadores incluidos y excluidos, mínimo de posesiones, rangos por
métrica) se aplican en el servidor, en un orden fijo y con desempate estable por id, de modo que la misma consulta
devuelve siempre las mismas filas en el mismo orden. Se expone como la tabla T-06 `lineup_search`.
"""
import math
from dataclasses import dataclass

import cache
import config
import context as context_mod
import identity
import lineups
import metrics_catalog
import repository
import sample as sample_mod
import stats_engine
from context import context_key

ADJUSTED_KEYS = sample_mod.REGRESSED_KEYS      # oer, der, net_rating


class SearchError(Exception):
    def __init__(self, status: int, message: str, code: str = "parametro_invalido"):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code


@dataclass(frozen=True)
class SearchSpec:
    comp_id: int
    team: str | None
    include: tuple
    exclude: tuple
    min_poss: float | None
    ranges: tuple          # ((clave, minimo|None, maximo|None), ...) ordenado por clave
    adjusted: bool


def _num(raw, name):
    try:
        v = float(str(raw).replace(",", "."))
    except (TypeError, ValueError):
        raise SearchError(400, f"Valor inválido para {name}.") from None
    if not math.isfinite(v):
        raise SearchError(400, f"Valor inválido para {name}.")
    return v


def _player_ids(raw: str, name: str) -> tuple:
    out = []
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        if not part.isdigit():
            raise SearchError(400, f"Valor inválido para {name}.")
        pid = identity.canonical_id(int(part))          # un jugador fusionado se sigue hasta su ficha vigente (C-08)
        if pid is None or identity.player_card(pid) is None:
            raise SearchError(404, f"Jugador no encontrado: {part}", "no_encontrado")
        if pid not in out:
            out.append(pid)
    return tuple(sorted(out))


def teams_of(comp_id: int) -> list:
    return sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()})


def parse_search(args, ctx) -> SearchSpec:
    if ctx.competition_all or ctx.competition_id is None:
        raise SearchError(400, "Elegí una competencia.")
    comp_id = ctx.competition_id
    team = (args.get("team") or "").strip().upper() or None
    if team and team not in teams_of(comp_id):
        raise SearchError(404, f"Equipo no encontrado: {team}", "no_encontrado")
    include = _player_ids(args.get("include"), "include")
    exclude = _player_ids(args.get("exclude"), "exclude")
    if set(include) & set(exclude):
        raise SearchError(400, "Un jugador no puede estar incluido y excluido a la vez.")
    raw_min = (args.get("min_poss") or "").strip()
    min_poss = None
    if raw_min != "":
        min_poss = _num(raw_min, "min_poss")
        if min_poss < 0:
            raise SearchError(400, "Valor inválido para min_poss.")
    bounds: dict = {}
    for k, v in args.items():
        if not (k.startswith("min.") or k.startswith("max.")) or str(v).strip() == "":
            continue
        op, key = k[:3], k[4:]
        d = metrics_catalog.METRICS.get(key)
        if d is None or "lineup" not in d.entities:
            raise SearchError(400, f"Métrica inválida: {key}")
        lo, hi = bounds.get(key, (None, None))
        val = _num(v, k)
        bounds[key] = (val, hi) if op == "min" else (lo, val)
    for key, (lo, hi) in bounds.items():
        if lo is not None and hi is not None and lo > hi:
            raise SearchError(400, f"El mínimo supera al máximo en {metrics_catalog.METRICS[key].label}.")
    adjusted = (args.get("adjusted") or "1").strip() != "0"
    return SearchSpec(comp_id, team, include, exclude, min_poss,
                      tuple((k, lo, hi) for k, (lo, hi) in sorted(bounds.items())), adjusted)


def universe(comp_id: int, ctx) -> list:
    """Todos los quintetos de la competencia, ordenados por id (base determinista)."""
    def build():
        prior = sample_mod.league_prior(comp_id, ctx)
        rows = []
        for team in teams_of(comp_id):
            team_poss = sample_mod.team_offensive_possessions(team, comp_id, ctx)
            for b in lineups.all_lineups(team, comp_id, ctx, size=5):
                values = sample_mod.adjust_values(stats_engine.compute_standard(b), b, prior)
                adj = {k: values[k]["adj"] for k in ADJUSTED_KEYS if (values.get(k) or {}).get("adj") is not None}
                rows.append({
                    "id": b.entity_id, "team": team, "name": b.name,
                    "players": frozenset((b.meta or {}).get("player_ids") or []),
                    "bundle": b, "values": values, "adj": adj,
                    "badge": sample_mod.sample_for("lineup", [b], team_poss=team_poss),
                    "poss": (values.get("possessions") or {}).get("value"),
                })
        return sorted(rows, key=lambda r: r["id"])
    return cache.memo("lineup_search:universe", (comp_id, context_key(ctx)), build)


def _value(row, key, adjusted):
    if adjusted and key in ADJUSTED_KEYS:
        a = row["adj"].get(key)
        return None if a is None else a.get("value")
    return (row["values"].get(key) or {}).get("value")


def _sort_key(row):
    net = _value(row, "net_rating", True)
    return (row["badge"]["level"] == "baja", net is None, -(net if net is not None else 0), row["id"])


def search(spec: SearchSpec, ctx) -> tuple:
    """`(filas ordenadas, info)`. Cada quinteto se cuenta una sola vez, en el primer filtro que lo excluye."""
    def build():
        uni = [r for r in universe(spec.comp_id, ctx) if not spec.team or r["team"] == spec.team]
        excl = {"jugadores": 0, "min_poss": 0, "rangos": 0, "nulos": 0}
        matched = []
        inc, exc = set(spec.include), set(spec.exclude)
        for r in uni:
            if not inc <= r["players"] or exc & r["players"]:
                excl["jugadores"] += 1
                continue
            if spec.min_poss is None:
                if not sample_mod.is_ranked(r["badge"]):
                    excl["min_poss"] += 1
                    continue
            elif r["poss"] is None or r["poss"] < spec.min_poss:
                excl["min_poss"] += 1
                continue
            reason = None
            for key, lo, hi in spec.ranges:
                v = _value(r, key, spec.adjusted)
                if v is None:
                    reason = "nulos"
                    break
                if (lo is not None and v < lo) or (hi is not None and v > hi):
                    reason = "rangos"
                    break
            if reason:
                excl[reason] += 1
                continue
            matched.append(r)
        matched.sort(key=_sort_key)
        versions = cache.get_versions()
        info = {"total_lineups": len(uni), "matched": len(matched), "excluded": excl,
                "effective_min_poss": ({"rule": "usuario", "value": spec.min_poss} if spec.min_poss is not None
                                       else {"rule": "t02", "value": config.get("sample.lineup.min")}),
                "data_version": versions["data_version"], "config_version": versions["config_version"]}
        return matched, info
    return cache.memo("lineup_search:search", (spec, context_key(ctx)), build)


# ── Tabla T-06 ───────────────────────────────────────────────────────────────

def _spec_of(treq) -> SearchSpec:
    try:
        return parse_search(treq.params, treq.ctx)
    except SearchError as e:
        import tables
        raise tables.TableError(e.status, e.message, e.code) from e


def table_rows(treq) -> list:
    import tables
    spec = _spec_of(treq)
    matched, _ = search(spec, treq.ctx)
    return [tables.TableRow(id=r["id"], link=f"lineup:{r['id']}", texts={"_name": r["name"], "_team": r["team"]},
                            bundle=r["bundle"], sample=r["badge"], adj=r["adj"] or None,
                            extra={"player_ids": sorted(r["players"])})
            for r in matched]


def _pct_text(key, v):
    d = metrics_catalog.METRICS[key]
    return f"{v * 100:.1f} %".replace(".", ",") if d.fmt == "pct" else f"{v:g}".replace(".", ",")


def describe_filters(spec: SearchSpec) -> list:
    out = []
    if spec.team:
        out.append({"label": "Equipo", "value": spec.team})
    for label, ids in (("Incluye a", spec.include), ("Excluye a", spec.exclude)):
        if ids:
            out.append({"label": label, "value": ", ".join(identity.player_card(i)["display_name"] for i in ids)})
    out.append({"label": "Mínimo de posesiones",
                "value": _pct_text("possessions", spec.min_poss) if spec.min_poss is not None else "Regla de muestra (T-02)"})
    for key, lo, hi in spec.ranges:
        label = metrics_catalog.METRICS[key].label
        if lo is not None:
            out.append({"label": f"{label} mín.", "value": _pct_text(key, lo)})
        if hi is not None:
            out.append({"label": f"{label} máx.", "value": _pct_text(key, hi)})
    out.append({"label": "Valor", "value": "Ajustado por muestra" if spec.adjusted else "Crudo"})
    return out


def payload_extras(treq) -> dict:
    spec = _spec_of(treq)
    _, info = search(spec, treq.ctx)
    return {"info": info, "filters": describe_filters(spec)}
