"""Mi equipo (F-12, sección S8): la pantalla de entrada del entrenador en una sola llamada.

Arma, para el equipo fijado y sin filtros de contexto: cabecera (récord, diferencia media, muestra), próximo partido del
calendario manual, plan de juego (F-17), alertas de la última semana (insights de A-10 sobre la ventana y variaciones
bruscas) y accesos directos (últimos partidos, quintetos más usados, jugadores seguidos). Cada bloque se arma aislado:
si uno falla, el resto responde (`blocks_failed`).
"""
import dataclasses
import logging
import statistics
from datetime import date, timedelta

import bundles
import cache
import config
import context as context_mod
import fixtures
import identity
import lineups
import metrics_catalog
import phrases
import repository
import sample
import stats_engine

log = logging.getLogger(__name__)

# Métricas direccionales del conjunto estándar que pueden disparar una alerta de cambio brusco.
ALERT_METRICS = ("oer", "der", "net_rating", "efg_pct", "ts_pct", "ppt", "to_pct", "or_pct", "dr_pct", "ft_rate", "ast_to")
BLOCKS = ("next_fixture", "game_plan", "alerts", "last_games", "top_lineups")


def _v(value, reason="sin_datos"):
    return {"value": value, "reason": None if value is not None else reason}


# ── Cabecera ─────────────────────────────────────────────────────────────────

def _games(team, comp_id, ctx):
    """[(info, bundle)] por partido jugado del equipo, en orden cronológico."""
    return bundles.team_game_bundles(team, comp_id, ctx)


def _header(team, per_game):
    played = [(i, b) for i, b in per_game if i.get("team_pts") is not None and i.get("opp_pts") is not None]
    wins = sum(1 for i, _ in played if i["team_pts"] > i["opp_pts"])
    losses = len(played) - wins
    n = len(per_game)
    margin = round(sum(i["team_pts"] - i["opp_pts"] for i, _ in played) / len(played), 1) if played else None
    return {"record": {"wins": wins, "losses": losses, "text": f"{wins}-{losses}"}, "avg_margin": _v(margin),
            "games": n, "games_total": n, "sample": sample.sample_level("team", n=n, unit="partidos", games=n)}


# ── Próximo partido ──────────────────────────────────────────────────────────

def _next_fixture(team, today):
    f = fixtures.next_fixture(team, today)
    if f is None:
        return None, ("sin_proximos" if fixtures.has_any() else "sin_calendario")
    names = fixtures.team_names()
    rival = f.away_code if f.home_code == team else f.home_code
    days_left = (fixtures.parse_day(f.date) - fixtures.parse_day(today)).days
    return {"fixture_id": f.id, "date": f.date, "time": f.time, "days_left": days_left, "is_home": f.home_code == team,
            "rival": {"code": rival, "name": names.get(rival, rival)}, "competition_id": f.competition_id, "notes": f.notes,
            "source_url": f.source_url,
            "prepare_link": f"#/preparar?team={team}&rival={rival}&fixture={f.id}"}, None


# ── Alertas ──────────────────────────────────────────────────────────────────

def alert_window(per_game, today: str) -> dict:
    days = int(config.get("alerts.lookback_days"))
    end = fixtures.parse_day(today)
    start = end - timedelta(days=days)
    dated = [(fixtures.parse_day(i.get("date")), i, b) for i, b in per_game]
    week = [(d, i, b) for d, i, b in dated if d is not None and start <= d <= end]
    rest = [(d, i, b) for d, i, b in dated if d is not None and d < start]
    later = [(d, i, b) for d, i, b in dated if d is not None and d > end]
    n = len(week)
    return {"days": days, "from": start.isoformat(), "to": end.isoformat(), "games": n,
            "game_ids": [i["game_id"] for _, i, _ in week],
            "sample": sample.sample_level("team", n=n, unit="partidos", games=n),
            "_week": [b for _, _, b in week], "_rest": [(i, b) for _, i, b in rest], "_later": len(later)}


def sudden_changes(team_name: str, week_bundles: list, rest_bundles: list, week_sample: dict) -> list:
    """Métricas cuyo valor agrupado de la ventana se aparta del resto de la temporada en `alerts.change_z` desvíos
    (desvío muestral de los valores por partido del resto), orientado por la dirección de la métrica."""
    min_rest = int(config.get("sample.team.min"))
    zmin = float(config.get("alerts.change_z"))
    if not week_bundles or len(rest_bundles) < max(2, min_rest):
        return []
    v_week = stats_engine.compute_standard(stats_engine.sum_bundles(week_bundles))
    per_game = [stats_engine.compute_standard(b) for b in rest_bundles]
    out = []
    for key in ALERT_METRICS:
        d = metrics_catalog.METRICS.get(key)
        if d is None or d.direction not in ("higher", "lower"):
            continue
        vw = (v_week.get(key) or {}).get("value")
        xs = [(v.get(key) or {}).get("value") for v in per_game]
        xs = [x for x in xs if x is not None]
        if vw is None or len(xs) < max(2, min_rest):
            continue                                          # un nulo nunca genera alerta
        mu, sd = statistics.mean(xs), statistics.stdev(xs)
        if sd == 0:
            continue
        s = 1 if d.direction == "higher" else -1
        z = s * (vw - mu) / sd
        if abs(z) < zmin:
            continue
        direction = "mejora" if z > 0 else "empeora"
        text = phrases.render(f"cambio_{direction}", {"entidad": team_name, "metrica": d.label,
                                                      "valor": phrases.format_value(key, vw), "media": phrases.format_value(key, mu)})
        out.append({"metric": key, "label": d.label, "fmt": d.fmt, "direction": direction, "week_value": round(vw, 4),
                    "rest_value": round(mu, 4), "rest_sd": round(sd, 4), "delta": round(vw - mu, 4), "z": round(z, 2),
                    "games_week": len(week_bundles), "games_rest": len(xs), "sample": week_sample, "text": text})
    out.sort(key=lambda c: -abs(c["z"]))
    return out[:int(config.get("insights.max_items"))]


def _alerts(team, team_name, comp_id, ctx, per_game, today):
    win = alert_window(per_game, today)
    week, rest, later = win.pop("_week"), win.pop("_rest"), win.pop("_later")
    if not win["games"]:
        return {"window": win, "insights": [], "insights_reason": None, "changes": [], "reason": "sin_partidos_en_ventana"}
    # La ventana termina hoy: sus partidos son los últimos n del equipo y A-10 se calcula con `last = n`.
    if later:
        ins, ins_reason = [], "ventana_no_final"
    else:
        res = phrases.insights("team", team, comp_id=comp_id, ctx=dataclasses.replace(ctx, last=win["games"]))
        ins, ins_reason = res.get("items") or [], res.get("reason")
    changes = sudden_changes(team_name, week, [b for _, b in rest], win["sample"])
    return {"window": win, "insights": ins, "insights_reason": ins_reason, "changes": changes,
            "changes_basis": {"games_rest": len(rest), "min_rest": max(2, int(config.get("sample.team.min")))}, "reason": None}


# ── Accesos directos ─────────────────────────────────────────────────────────

def _last_games(per_game):
    n = int(config.get("my_team.last_games"))
    rows = sorted(per_game, key=lambda ib: (ib[0].get("date") or "", ib[0]["game_id"]), reverse=True)[:n]
    out = []
    for i, _ in rows:
        tp, op = i.get("team_pts"), i.get("opp_pts")
        out.append({"game_id": i["game_id"], "date": i.get("date") or None, "rival": {"code": i.get("opponent_code"), "name": i.get("opponent")},
                    "is_home": i.get("home_away") == "L", "score_own": tp, "score_rival": op,
                    "result": None if tp is None or op is None else ("G" if tp > op else "P"), "link": f"#/partido/{i['game_id']}"})
    return out


def _top_lineups(team, comp_id, ctx):
    if not repository.team_pbp_games(team, comp_id):
        return {"rows": [], "reason": "sin_pbp"}
    bs = lineups.all_lineups(team, comp_id, ctx, size=5)
    team_poss = sample.team_offensive_possessions(team, comp_id, ctx)
    prior = sample.league_prior(comp_id, ctx)
    bs = sorted(bs, key=lambda b: (-(b.seconds or 0), str(b.entity_id)))[:int(config.get("my_team.top_lineups"))]
    rows = []
    for b in bs:
        values = sample.adjust_values(stats_engine.compute_standard(b), b, prior)
        net = values.get("net_rating") or {}
        rows.append({"lineup_id": b.entity_id, "names": b.name, "minutes": _v(round((b.seconds or 0) / 60, 1)),
                     "possessions": _v((values.get("possessions") or {}).get("value")), "games": b.games,
                     "net_rating": {"value": net.get("value"), "reason": net.get("reason"), "adj": net.get("adj")},
                     "sample": sample.sample_for("lineup", [b], team_poss=team_poss),
                     "link": f"#/equipo/{team}/quintetos"})
    return {"rows": rows, "reason": None}


def followed_players(ids: list) -> dict:
    """Tarjetas de los jugadores seguidos (preferencia del usuario: se arma fuera de la caché compartida)."""
    mx = int(config.get("my_team.max_followed"))
    ids = [i for i in (ids or []) if isinstance(i, int) and not isinstance(i, bool)]
    truncated = len(ids) > mx
    rows_all = repository.player_game_rows(None)
    out, seen = [], set()
    for raw in ids[:mx]:
        pid = identity.canonical_id(raw)
        card = identity.player_card(pid) if pid is not None else None
        if card is None:
            out.append({"player_id": raw, "available": False, "reason": "no_encontrado"})
            continue
        if pid in seen:
            continue
        seen.add(pid)
        mine = [r for r in rows_all if r.get("player_id") is not None and identity.canonical_id(r["player_id"]) == pid
                and stats_engine.played(r.get("minutes"))]
        mine.sort(key=lambda r: (r.get("date") or "", r["game_id"]), reverse=True)
        recent = mine[:5]
        k = len(recent)

        def avg(f):
            vals = [f(r) for r in recent]
            vals = [x for x in vals if x is not None]
            return _v(round(sum(vals) / len(vals), 1) if vals else None, "dnp" if not k else "sin_datos")
        pts = sum(r.get("pts") or 0 for r in recent)
        fga = sum(r.get("fga") or 0 for r in recent)
        fta = sum(r.get("fta") or 0 for r in recent)
        den = 2 * (fga + 0.44 * fta)
        out.append({"player_id": pid, "followed_id": raw, "name": card["display_name"], "team_code": card.get("team_code"),
                    "available": True, "games": _v(len(mine)),
                    "recent": {"games": k, "metrics": {
                        "pts": avg(lambda r: r.get("pts")), "trb": avg(lambda r: r.get("trb")), "ast": avg(lambda r: r.get("ast")),
                        "minutes": avg(lambda r: stats_engine._parse_minutes(r.get("minutes"))),
                        "ts_pct": _v(round(pts / den, 4) if den else None, "sin_intentos" if k else "dnp")}},
                    "link": f"#/jugador/{pid}"})
    return {"rows": out, "truncated": truncated, "max": mx}


# ── Payload ──────────────────────────────────────────────────────────────────

def payload(team: str, comp_id: int, today: str) -> dict:
    """Parte compartida (cacheada por equipo, competencia y día) de `GET /api/my-team`."""
    return cache.memo("my_team", (team, comp_id, today), lambda: _build(team, comp_id, today))


def _build(team, comp_id, today):
    ctx = context_mod.parse_context({"competition": str(comp_id)}, team_code=team)
    per_game = _games(team, comp_id, ctx)
    names = fixtures.team_names()
    team_name = names.get(team, team)
    labels = repository.competition_labels()
    out = {"team": {"code": team, "name": team_name}, "competition": {"id": comp_id, "label": labels.get(comp_id)},
           "today": today, "header": _header(team, per_game), "blocks_failed": {}}
    nf_holder = {}

    def nf():
        f, reason = _next_fixture(team, today)
        nf_holder["f"] = f
        out["next_fixture_reason"] = reason
        return f

    def gp():
        f = nf_holder.get("f")
        if f:
            res = phrases.game_plan("team", team, reference="rival", rival=f["rival"]["code"], comp_id=comp_id, ctx=ctx)
            res = {**res, "reference": {**(res.get("reference") or {}), "type": "rival_proximo", "fixture_id": f["fixture_id"]}}
        else:
            res = phrases.game_plan("team", team, reference="competencia", comp_id=comp_id, ctx=ctx)
        return {**res, "next_available": f is not None}

    steps = (("next_fixture", nf), ("game_plan", gp), ("alerts", lambda: _alerts(team, team_name, comp_id, ctx, per_game, today)),
             ("last_games", lambda: _last_games(per_game)), ("top_lineups", lambda: _top_lineups(team, comp_id, ctx)))
    for name, fn in steps:
        try:
            out[name] = fn()
        except Exception as e:          # un bloque roto no tumba la pantalla (RF-25)
            log.exception("Mi equipo: falló el bloque %s de %s", name, team)
            out[name] = None
            out["blocks_failed"][name] = {"code": getattr(e, "code", None) or "error_interno",
                                          "error": getattr(e, "message", None) or "No se pudo calcular este bloque."}
    out.setdefault("next_fixture_reason", None)
    out["context"] = context_mod.context_echo(ctx, games_used=len(per_game), games_total=len(per_game), games_excluded={},
                                              ignored=[], competition_label=labels.get(comp_id))
    return out
