"""Preparar partido (F-03): informe de scouting de un rival antes del tip-off.

Orquestador: no reconstruye nada propio. Percentiles de `population` (T-01), quintetos de
`lineups.all_lineups` + regresión/banda de `sample` (T-02), zonas de `shot_zones` (C-03),
reparto de puntos de `stats_engine.points_distribution`, cruces de `matchups.team_matchups`
(F-07). El filtro "últimos N" aplica solo al rival y a todo el informe salvo el historial H2H.
"""
from datetime import datetime, timezone

import bundles
import cache
import config
import identity
import lineups
import matchups
import metrics_catalog
import population
import repository
import sample
import shot_zones
from context import Context
from stats_engine import compute_standard, pos, points_distribution


class PrepareError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "parametro_invalido"):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


# Duelos para ventajas / amenazas: (id, lado, métrica propia, métrica del rival, título,
# lectura si es ventaja, lectura si es amenaza). Lado "ataque" = nuestro ataque contra su
# defensa; "defensa" = nuestra defensa contra su ataque; "comparado" = la misma métrica.
DUELS = (
    ("tiro_ataque", "ataque", "efg_pct", "opp_efg_pct", "Nuestro tiro vs su defensa del tiro",
     "Tiramos mejor de lo que ellos defienden el tiro: buscar volumen de tiros abiertos.",
     "Defienden el tiro mejor de lo que tiramos: evitar tiros forzados, atacar el aro."),
    ("perdidas_ataque", "ataque", "to_pct", "opp_to_pct", "Nuestras pérdidas vs su presión",
     "Cuidamos la pelota más de lo que ellos fuerzan pérdidas: sostener el ritmo.",
     "Fuerzan pérdidas y nosotros perdemos seguido: cuidar la salida y los pases."),
    ("rebote_ataque", "ataque", "or_pct", "dr_pct", "Nuestro rebote ofensivo vs su rebote defensivo",
     "Les ganamos el rebote ofensivo: cargar el aro para segundas oportunidades.",
     "Cierran bien su rebote: priorizar el balance defensivo."),
    ("libres_ataque", "ataque", "ft_rate", "opp_ft_rate", "Nuestra llegada a la línea vs sus faltas",
     "Llegamos a la línea más de lo que ellos la conceden: atacar el aro.",
     "Defienden sin falta y nosotros llegamos poco a la línea."),
    ("eficiencia_ataque", "ataque", "oer", "der", "Nuestro ataque vs su defensa",
     "Nuestro ataque rinde más de lo que su defensa permite.",
     "Su defensa está por encima de nuestro ataque."),
    ("tiro_defensa", "defensa", "opp_efg_pct", "efg_pct", "Su tiro vs nuestra defensa del tiro",
     "Defendemos el tiro mejor de lo que ellos tiran.",
     "Tiran mejor de lo que defendemos el tiro: cerrar líneas de pase y salir a los tiradores."),
    ("perdidas_defensa", "defensa", "opp_to_pct", "to_pct", "Su manejo vs nuestra presión",
     "Forzamos pérdidas y ellos pierden seguido: presionar la salida.",
     "Cuidan la pelota y nuestra presión no las genera: no arriesgar en robos."),
    ("rebote_defensa", "defensa", "dr_pct", "or_pct", "Su rebote ofensivo vs nuestro rebote defensivo",
     "Cerramos nuestro rebote mejor de lo que ellos atacan el ofensivo.",
     "Su rebote ofensivo es una amenaza: cerrar el rebote con los cinco."),
    ("libres_defensa", "defensa", "opp_ft_rate", "ft_rate", "Su llegada a la línea vs nuestras faltas",
     "Defendemos sin falta y ellos llegan poco a la línea.",
     "Llegan a la línea y nosotros hacemos faltas: defender sin manos, cuidar el bonus."),
    ("eficiencia_defensa", "defensa", "der", "oer", "Su ataque vs nuestra defensa",
     "Nuestra defensa está por encima de su ataque.",
     "Su ataque rinde más de lo que nuestra defensa permite."),
    ("triple", "comparado", "fg3_pct", "fg3_pct", "Acierto de triple",
     "Tiramos mejor el triple.", "Tiran mejor el triple: no dejar tiradores libres."),
    ("pases", "comparado", "ast_to", "ast_to", "Asistencias por pérdida",
     "Mejor circulación de pelota (AS/PER).", "Circulan mejor la pelota (AS/PER)."),
    ("robos", "comparado", "stl", "stl", "Robos por partido",
     "Robamos más pelotas.", "Roban más pelotas: cuidado con los pases cruzados."),
    ("pintura", "comparado", "paint_pts", "paint_pts", "Puntos en la pintura",
     "Producimos más en la pintura.", "Producen más en la pintura: proteger el aro."),
    ("contraataque", "comparado", "fast_break_pts", "fast_break_pts", "Puntos de contraataque",
     "Corremos más la cancha.", "Corren la cancha: balance defensivo tras cada tiro."),
)
ITEMS_PER_SIDE = 5


def _ctx(comp_id: int, last: int | None) -> Context:
    return Context(competition_id=comp_id, competition_all=False, last=last)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Informe ──────────────────────────────────────────────────────────────────

def prepare_report(team: str, rival: str, comp_id: int, *, last: int | None = None) -> dict:
    if team == rival:
        raise PrepareError("El rival no puede ser el mismo equipo")
    rows = repository.team_game_rows(comp_id)
    codes = {r["team_code"] for r in rows.values()}
    if team not in codes:
        raise PrepareError("Equipo no encontrado", 404, "no_encontrado")
    if rival not in codes:
        raise PrepareError("Rival no encontrado", 404, "no_encontrado")
    return cache.memo("prepare", (team, rival, comp_id, last), lambda: _build(team, rival, comp_id, last, rows))


def _build(team, rival, comp_id, last, rows) -> dict:
    ctx_team, ctx_rival = _ctx(comp_id, None), _ctx(comp_id, last)
    team_rows = sorted((r for r in rows.values() if r["team_code"] == team), key=_chrono)
    rival_all = sorted((r for r in rows.values() if r["team_code"] == rival), key=_chrono)
    rival_rows = rival_all[-last:] if last else rival_all

    h2h = head_to_head(team, rival)
    considered = {r["game_id"] for r in rival_rows}
    mu_games = [g["game_id"] for g in h2h["games"] if g["game_id"] in considered]
    advantages, threats, warning = _advantages_and_threats(team, rival, comp_id, ctx_team, ctx_rival,
                                                           len(team_rows), len(rival_rows))
    return {
        "summary": {
            "team": {"code": team, "name": _name(team_rows, team)},
            "rival": {"code": rival, "name": _name(rival_all, rival)},
            "competition": {"id": comp_id, "label": repository.competition_labels().get(comp_id)},
            "team_games": len(team_rows),
            "rival_games_considered": len(rival_rows), "rival_games_total": len(rival_all), "last": last,
            "generated_at": _now_iso(),
        },
        "advantages": advantages,
        "threats": threats,
        "sample_warning": warning,
        "rival_lineups": _rival_lineups(rival, comp_id, ctx_rival),
        "rival_threats": _rival_threats(rival, comp_id, ctx_rival, last, rival_rows),
        "h2h": h2h,
        "matchups": _matchups_block(team, rival, mu_games),
        "suggestions_profile": None,
    }


def _chrono(r: dict) -> tuple:
    return (r.get("date") or "", r.get("game_id") or "")


def _name(rows: list, code: str) -> str:
    return next((r.get("team_name") for r in reversed(rows) if r.get("team_name")), code)


# ── Ventajas y amenazas ──────────────────────────────────────────────────────

def _pct(pop, entity_id, key):
    """Percentil orientado (alto = mejor) contra el resto de la competencia, o None."""
    me = pop.get(entity_id)
    mdef = metrics_catalog.METRICS.get(key)
    if me is None or mdef is None or mdef.direction == "neutral":
        return None, None
    v = me.values.get(key)
    if v is None:
        return None, None
    others = [m.values.get(key) for m in pop.members if str(m.id) != str(entity_id)]
    return v, population.percentile(v, others, mdef.direction)


def _advantages_and_threats(team, rival, comp_id, ctx_team, ctx_rival, team_games, rival_games):
    # Universo completo de la competencia, sin umbral de muestra: la muestra baja se advierte
    # (sample_warning) en vez de dejar el bloque vacío (RF-6).
    pop_team = population.population("team", comp_id, ctx_team, apply_thresholds=False)
    pop_rival = (population.population("team", comp_id, ctx_rival, apply_thresholds=False)
                 if ctx_rival.last else pop_team)
    items = []
    for did, side, own_key, ref_key, title, adv_text, thr_text in DUELS:
        own_v, own_p = _pct(pop_team, team, own_key)
        ref_v, ref_p = _pct(pop_rival, rival, ref_key)
        if own_p is None or ref_p is None:
            continue
        edge = own_p - ref_p
        items.append({
            "id": did, "side": side, "title": title,
            "own_metric": own_key, "ref_metric": ref_key,
            "own_label": metrics_catalog.METRICS[own_key].label,
            "ref_label": metrics_catalog.METRICS[ref_key].label,
            "own_fmt": metrics_catalog.METRICS[own_key].fmt,
            "ref_fmt": metrics_catalog.METRICS[ref_key].fmt,
            "own": own_v, "ref": ref_v, "own_pct": own_p, "ref_pct": ref_p,
            "edge": edge, "strength": "clara" if abs(edge) >= 30 else "moderada" if abs(edge) >= 15 else "leve",
            "_texts": (adv_text, thr_text),
        })
    items.sort(key=lambda i: i["edge"], reverse=True)
    n = min(ITEMS_PER_SIDE, len(items) // 2)
    advantages = [_item(i, True) for i in items[:n]]
    threats = [_item(i, False) for i in reversed(items[len(items) - n:])] if n else []
    min_games = config.get("sample.team.min")
    return advantages, threats, team_games < min_games or rival_games < min_games


def _item(i: dict, advantage: bool) -> dict:
    adv_text, thr_text = i.pop("_texts")
    favorable = i["edge"] > 0
    if advantage:
        text = adv_text if favorable else "Parejos: sin una ventaja marcada en este aspecto."
    else:
        text = thr_text if not favorable else "Parejos: sin una amenaza marcada en este aspecto."
    return {**i, "text": text, "direction": "up" if favorable else "down"}


# ── Quintetos rivales ────────────────────────────────────────────────────────

def _rival_lineups(rival, comp_id, ctx) -> dict:
    bundles = lineups.all_lineups(rival, comp_id, ctx)
    if not bundles:
        return {"rows": [], "reason": "sin_pbp"}
    prior = sample.league_prior(comp_id, ctx)
    team_poss = sample.team_offensive_possessions(rival, comp_id, ctx)
    rows = []
    for b in sorted(bundles, key=lambda b: b.minutes or 0, reverse=True):
        vals = sample.adjust_values(compute_standard(b), b, prior)
        net = vals.get("net_rating") or {}
        adj = net.get("adj") or {}
        rows.append({
            "id": b.entity_id, "name": b.name, "player_ids": (b.meta or {}).get("player_ids", []),
            "games": b.games, "minutes": round(b.minutes or 0, 1),
            "possessions": round(pos(b.own) or 0, 1),
            "oer": (vals.get("oer") or {}).get("value"), "der": (vals.get("der") or {}).get("value"),
            "net_rating": net.get("value"), "net_adj": adj.get("value"), "net_band": adj.get("band"),
            "sample": sample.sample_for("lineup", [b], team_poss=team_poss),
        })
    return {"rows": rows, "reason": None}


# ── Amenazas ofensivas del rival ─────────────────────────────────────────────

def _rival_threats(rival, comp_id, ctx, last, rival_rows) -> dict:
    # Solo los jugadores del rival (enumerar la competencia completa tarda ~30 s en frío).
    pids = sorted({identity.canonical_id(r["player_id"]) for r in repository.player_game_rows(comp_id)
                   if r.get("team_code") == rival and r.get("player_id") is not None} - {None})
    players = []
    for pid in pids:
        b = bundles._player_bundle_from_games(pid, comp_id, ctx)
        if b is None or not b.games:
            continue
        vals = compute_standard(b)
        mpg = (b.minutes or 0) / b.games
        if mpg < 10:
            continue
        players.append({
            "player_id": b.entity_id, "name": b.name, "games": b.games, "mpg": round(mpg, 1),
            "ppg": round((b.own.get("pts") or 0) / b.games, 1),
            "uso_pct": vals.get("uso_pct"), "ts_pct": vals.get("ts_pct"), "efg_pct": vals.get("efg_pct"),
        })
    players.sort(key=lambda p: (p["uso_pct"] or {}).get("value") or -1, reverse=True)

    zones = shot_zones.zones_with_stats("team", rival, comp_id, last, shot_zones._shots_for_team)
    min_att = config.get("sample.clock_zone.min")
    candidates = [{"zone": k, **z} for k, z in (zones.get("zones") or {}).items()
                  if (z.get("attempts") or 0) >= min_att and z.get("ppt") is not None]
    best = max(candidates, key=lambda z: z["ppt"]) if candidates else None

    return {
        "top_usage": players[:5],
        "zones": zones,
        "best_zone": best,
        "points": points_distribution(_sum_rows(rival_rows)) if rival_rows else None,
    }


_SUM_KEYS = ("pts", "fgm2", "fgm3", "ftm")
_OPTIONAL_KEYS = ("paint_pts", "second_chance_pts", "fast_break_pts", "pts_from_tov")


def _sum_rows(rows: list) -> dict:
    """Suma de boxes de equipo. Un desglose opcional nulo en algún partido deja el total nulo
    (C-11: no se suma como 0)."""
    out = {k: sum(r.get(k) or 0 for r in rows) for k in _SUM_KEYS}
    for k in _OPTIONAL_KEYS:
        vals = [r.get(k) for r in rows]
        out[k] = None if any(v is None for v in vals) else sum(vals)
    return out


# ── Head to head ─────────────────────────────────────────────────────────────

def head_to_head(team_a: str, team_b: str, comp_id: int | None = None) -> dict:
    """Historial completo entre dos equipos (más reciente primero), en todas las competencias
    visibles salvo que se pida una."""
    labels = repository.competition_labels()
    games = []
    for g in repository.competition_games(comp_id):
        if {g.home_code, g.away_code} != {team_a, team_b}:
            continue
        a_home = g.home_code == team_a
        sa, sb = (g.home_score, g.away_score) if a_home else (g.away_score, g.home_score)
        winner = None if sa is None or sb is None or sa == sb else (team_a if sa > sb else team_b)
        games.append({"game_id": g.game_id, "date": g.date, "competition_id": g.competition_id,
                      "competition_label": labels.get(g.competition_id), "venue": "L" if a_home else "V",
                      "score_a": sa, "score_b": sb, "winner": winner})
    games.sort(key=lambda r: (r["date"] or "", r["game_id"]), reverse=True)
    return {"team_a": team_a, "team_b": team_b, "games": games,
            "record": {"wins_a": sum(1 for r in games if r["winner"] == team_a),
                       "wins_b": sum(1 for r in games if r["winner"] == team_b)}}


# ── Coincidencia en cancha ───────────────────────────────────────────────────

def _matchups_block(team, rival, game_ids) -> dict:
    if not game_ids:
        return {"games": [], "reason": "sin_enfrentamientos"}
    return {
        "games": game_ids,
        "reason": None,
        "quinteto": matchups.team_matchups(team, rival, game_ids, "quinteto"),
        "jugador": matchups.team_matchups(team, rival, game_ids, "jugador"),
        "jugador_quinteto": matchups.team_matchups(team, rival, game_ids, "jugador_quinteto", side="team"),
        "jugador_quinteto_rival": matchups.team_matchups(team, rival, game_ids, "jugador_quinteto", side="rival"),
    }
