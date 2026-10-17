"""Momentum (F-02): solo lo que está cambiando el partido ahora, no el acumulado.

Cálculo puro sobre los eventos del pbp (ordenados por action_number) y las posesiones de A-01
del mismo partido; sirve igual para un partido en curso (datos en memoria de `live.py`) y para
uno guardado (estado al cierre). Todos los umbrales se leen de `config.get("momentum.*")`.
Tiempos en tiempo de juego transcurrido (`elapsed_secs`), no en reloj de pared.
"""
import config
from game_analysis import elapsed_secs, period_label, _clock_display

_FG = ("2pt", "3pt")
_SHOT_PTS = {"2pt": 2, "3pt": 3, "freethrow": 1}
_ASSIST_LOOKAHEAD = 8          # action_numbers máx. entre la canasta y su asistencia (= possessions)
_OUTCOME_LABELS = {
    "t2c": "Doble convertido", "t2f": "Doble fallado", "t3c": "Triple convertido", "t3f": "Triple fallado",
    "perdida": "Pérdida", "falta": "Falta / tiros libres", "fin_periodo": "Fin de período",
}
_KEYS = ("last_possessions", "window_secs", "last_outcomes", "hot_consecutive_makes", "hot_points",
         "hot_points_window_secs", "assist_streak", "oreb_in_quarter", "cold_consecutive_tov")


def compute(events: list, poss: list, codes: tuple, names: dict) -> dict:
    """events: dicts del pbp ordenados; poss: posesiones del partido; codes: (local, visitante);
    names: {team_code: nombre}."""
    cfg = {k: int(config.get(f"momentum.{k}")) for k in _KEYS}
    now = _now(events)
    now_el = now["elapsed_secs"] if now else None
    assists = _assisters(events)
    return {
        "has_pbp": bool(events),
        "now": now,
        "teams": {side: {"code": c, "name": names.get(c)} for side, c in zip(("home", "away"), codes)},
        "thresholds": cfg,
        "run": _current_run(events, codes, now_el),
        "last_possessions": _last_n_ppp(poss, codes, cfg["last_possessions"]),
        "last_window": _last_window(poss, codes, cfg["window_secs"], now_el),
        "last_outcomes": _last_outcomes(poss, events, assists, codes, cfg["last_outcomes"]),
        "hot": _hot_players(events, assists, codes, cfg, now),
        "cold": _cold_players(events, codes, cfg["cold_consecutive_tov"]),
    }


# ── Tiempo ───────────────────────────────────────────────────────────────────

def _el(ev) -> int | None:
    return elapsed_secs(ev.get("period") or 1, ev.get("period_type") or "REGULAR", ev.get("clock_secs"))


def _label(period, ptype, clock_secs) -> str:
    return f"{period_label(period or 1, ptype or 'REGULAR')} {_clock_display(clock_secs)}".strip()


def _now(events) -> dict | None:
    best, best_el = None, -1
    for ev in events:
        el = _el(ev)
        if el is not None and el > best_el:
            best, best_el = ev, el
    if best is None:
        return None
    return {"period": best.get("period") or 1, "period_type": best.get("period_type") or "REGULAR",
            "elapsed_secs": best_el, "label": _label(best.get("period"), best.get("period_type"), best.get("clock_secs"))}


# ── Racha (parcial abierto) ──────────────────────────────────────────────────

def _current_run(events, codes, now_el) -> dict | None:
    """Puntos seguidos del último equipo que anotó, hasta la última anotación del rival."""
    scores, prev = [], (0, 0)
    for ev in events:
        s1, s2 = ev.get("s1"), ev.get("s2")
        if s1 is None or s2 is None:
            continue
        for code, delta in ((codes[0], s1 - prev[0]), (codes[1], s2 - prev[1])):
            if delta > 0:
                scores.append((ev, code, delta))
        prev = (s1, s2)
    if not scores:
        return None
    team = scores[-1][1]
    points, first = 0, None
    for ev, code, delta in reversed(scores):
        if code != team:
            break
        points += delta
        first = ev
    start_el = _el(first)
    return {
        "team_code": team, "side": "home" if team == codes[0] else "away",
        "points": points, "opp_points": 0,
        "since": {"period": first.get("period"), "clock_secs": first.get("clock_secs"),
                  "label": _label(first.get("period"), first.get("period_type"), first.get("clock_secs"))},
        "elapsed_secs": None if start_el is None or now_el is None else max(0, now_el - start_el),
    }


# ── Ventanas de equipo ───────────────────────────────────────────────────────

def _last_n_ppp(poss, codes, n) -> dict:
    out = {"n": n}
    for side, code in zip(("home", "away"), codes):
        last = [p for p in poss if p.team == code and not p.incomplete][-n:]
        pts = sum(p.pts for p in last)
        if len(last) < n:
            out[side] = {"ppp": {"value": None, "reason": "pocas_posesiones"}, "possessions": len(last), "points": pts}
        else:
            out[side] = {"ppp": {"value": round(pts / n, 2), "reason": None}, "possessions": n, "points": pts}
    return out


def _poss_el(p) -> int | None:
    return elapsed_secs(p.period or 1, p.period_type or "REGULAR", p.start_clock)


def _ratio(num, den):
    return {"value": round(num / den, 2), "reason": None} if den else {"value": None, "reason": "sin_posesiones"}


def _last_window(poss, codes, window, now_el) -> dict:
    """OER = puntos por posesión propia; DER = puntos del rival por posesión suya (posesiones
    contadas por A-01 que empiezan dentro de la ventana)."""
    out = {"window_secs": window}
    if now_el is None or now_el < window:
        out["reason"] = "pocos_minutos"
        for side in ("home", "away"):
            out[side] = {k: {"value": None, "reason": "pocos_minutos"} for k in ("oer", "der", "net_rating")}
        return out
    start = now_el - window
    inwin = [p for p in poss if not p.incomplete and (_poss_el(p) or -1) >= start]
    out["reason"] = None
    for side, code in zip(("home", "away"), codes):
        own = [p for p in inwin if p.team == code]
        opp = [p for p in inwin if p.team != code]
        oer = _ratio(sum(p.pts for p in own), len(own))
        der = _ratio(sum(p.pts for p in opp), len(opp))
        net = ({"value": round(oer["value"] - der["value"], 2), "reason": None}
               if oer["value"] is not None and der["value"] is not None else {"value": None, "reason": "sin_posesiones"})
        out[side] = {"oer": oer, "der": der, "net_rating": net,
                     "possessions": len(own), "points": sum(p.pts for p in own)}
    return out


def _assisters(events) -> dict:
    """{action_number de canasta de campo convertida: nombre del asistente}. La asistencia viene
    después de la canasta, antes del siguiente tiro de campo."""
    out = {}
    for i, ev in enumerate(events):
        if ev.get("action_type") not in _FG or not ev.get("success"):
            continue
        for nxt in events[i + 1:]:
            if (nxt.get("action_number") or 0) - (ev.get("action_number") or 0) > _ASSIST_LOOKAHEAD:
                break
            if nxt.get("action_type") in _FG:
                break
            if nxt.get("action_type") == "assist" and nxt.get("team_code") == ev.get("team_code"):
                out[ev.get("action_number")] = nxt.get("player_name") or None
                break
    return out


def _last_outcomes(poss, events, assists, codes, n) -> dict:
    by_an = {e.get("action_number"): e for e in events}
    out = {"n": n}
    for side, code in zip(("home", "away"), codes):
        items = []
        for p in reversed([p for p in poss if p.team == code][-n:]):
            end = by_an.get(p.end_event) or {}
            items.append({
                "end_type": p.end_type,
                "label": "Incompleta" if p.incomplete and not p.end_type else _OUTCOME_LABELS.get(p.end_type, p.end_type or "—"),
                "pts": p.pts,
                "player": end.get("player_name") or None,
                "assister": assists.get(p.end_event) if p.end_type in ("t2c", "t3c") else None,
                "is_three": p.end_type == "t3c",
                "had_second_chance": len(p.chances) > 1,
                "incomplete": p.incomplete,
                "clock": _label(end.get("period") or p.period, end.get("period_type") or p.period_type,
                                end.get("clock_secs")) if end else None,
            })
        out[side] = items
    return out


# ── Jugadores ────────────────────────────────────────────────────────────────

def _player(code, name, codes) -> dict:
    return {"player_key": f"{code}|{name}", "name": name, "team_code": code,
            "side": "home" if code == codes[0] else "away", "marks": []}


def _mmss(secs) -> str:
    return f"{secs // 60}:{secs % 60:02d}"


def _hot_players(events, assists, codes, cfg, now) -> list:
    players = {}

    def mark(code, name, rule, value, label):
        players.setdefault((code, name), _player(code, name, codes))["marks"].append(
            {"rule": rule, "value": value, "label": label})

    now_el = now["elapsed_secs"] if now else None
    window = cfg["hot_points_window_secs"]
    makes, points, oreb = {}, {}, {}
    for ev in events:
        code, name, at = ev.get("team_code"), ev.get("player_name"), ev.get("action_type")
        if not name or code not in codes:
            continue
        key = (code, name)
        if at in _FG:
            makes[key] = makes.get(key, 0) + 1 if ev.get("success") else 0
        if at in _SHOT_PTS and ev.get("success"):
            el = _el(ev)
            if now_el is not None and el is not None and el >= now_el - window:
                points[key] = points.get(key, 0) + _SHOT_PTS[at]
        if (at == "rebound" and ev.get("sub_type") == "offensive" and now
                and ev.get("period") == now["period"] and (ev.get("period_type") or "REGULAR") == now["period_type"]):
            oreb[key] = oreb.get(key, 0) + 1

    for (code, name), v in makes.items():
        if v >= cfg["hot_consecutive_makes"]:
            mark(code, name, "makes_streak", v, f"{v} tiros de campo convertidos seguidos")
    for (code, name), v in points.items():
        if v >= cfg["hot_points"]:
            mark(code, name, "points_window", v, f"{v} pts en los últimos {_mmss(window)}")
    for code in codes:
        made = [ev for ev in events
                if ev.get("team_code") == code and ev.get("action_type") in _FG and ev.get("success")]
        if not made:
            continue
        who = assists.get(made[-1].get("action_number"))
        streak = 0
        for ev in reversed(made):
            if who is None or assists.get(ev.get("action_number")) != who:
                break
            streak += 1
        if who and streak >= cfg["assist_streak"]:
            mark(code, who, "assist_streak", streak, f"asistió las últimas {streak} canastas del equipo")
    for (code, name), v in oreb.items():
        if v >= cfg["oreb_in_quarter"]:
            mark(code, name, "oreb_in_quarter", v, f"{v} rebotes ofensivos en el cuarto")
    return sorted(players.values(), key=lambda p: (-len(p["marks"]), p["name"]))


def _cold_players(events, codes, threshold) -> list:
    """Pérdidas seguidas del jugador sin canasta, asistencia ni rebote propio en el medio."""
    tov = {}
    for ev in events:
        code, name, at = ev.get("team_code"), ev.get("player_name"), ev.get("action_type")
        if not name or code not in codes:
            continue
        key = (code, name)
        if at == "turnover":
            tov[key] = tov.get(key, 0) + 1
        elif at in ("assist", "rebound") or (at in _SHOT_PTS and ev.get("success")):
            tov[key] = 0
    out = []
    for (code, name), v in tov.items():
        if v >= threshold:
            p = _player(code, name, codes)
            p["marks"].append({"rule": "cold_streak", "value": v, "label": f"{v} pérdidas seguidas"})
            out.append(p)
    return sorted(out, key=lambda p: (-p["marks"][0]["value"], p["name"]))
