"""Reconstrucción de posesiones (A-01) — motor sobre `pbp_events`.

Camina los eventos de un partido en orden de `action_number` con reloj monótono por período y una
máquina de estados de posesión / oportunidad / serie de tiros libres (plan §4.3). Las posesiones se
calculan al vuelo y viven SOLO en el caché en memoria (`cache.memo("poss:game", ...)`, versionado por
data_version/config_version): nunca se persisten. Conciliación contra la fórmula del glosario en
`reconcile` (plan §4.8) y check de calidad `possession_gaps_check` (F-11).

No existen `previous_action` ni `qualifiers` en `pbp_events`: los vínculos (asistencia, tapón, robo)
y el and-one se resuelven por look-ahead / último evento del equipo.
"""
import logging
import re
from collections import Counter
from dataclasses import dataclass, field

from flask import has_app_context

import cache
import config
import identity
import lineups
import repository
from database import db, Game, PbpEvent, Shot, TeamGameStats

log = logging.getLogger(__name__)

# faltas técnicas (el rival tira 1 TL sin cambiar la posesión) y antideportivas (TL + conserva balón)
_TECH = frozenset({"technical", "benchtechnical", "coachtechnical"})
_RETAIN = frozenset({"unsportsmanlike", "disqualifying"})
_NEUTRAL = frozenset({"substitution", "timeout", "headcoachchallenge", "game"})
_BOX_KEYS = ("fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "orb", "drb", "ast", "tov", "stl",
             "blk", "blk_received", "pf", "fouls_drawn")
_FT_RE = re.compile(r"(\d+)\s*of\s*(\d+)", re.I)
_LOOKAHEAD = 12          # eventos máx. que mira el and-one
_ASSIST_WINDOW = 8       # action_numbers máx. entre canasta y su asistencia
TOL_PCT = 2.0            # diferencia admitida por equipo (pooled)
OVER_PCT = 5.0           # umbral de partido-equipo desviado


# ── Modelo ───────────────────────────────────────────────────────────────────

@dataclass
class Chance:
    n: int
    start_event: int                 # action_number
    start_clock: int
    shot_clock_start: int            # 24 o config clock.reset_secs
    end_event: int | None = None
    end_type: str | None = None      # t2c, t2f, t3c, t3f, falta, perdida, fin_periodo
    pts: int = 0
    outcome: str | None = None       # lo llena A-04
    mode: str | None = None          # A-04: modo del tiro (putback, kickout, reinicio); None si no hubo tiro
    shot_secs: int | None = None     # A-04: segundos del rebote al primer tiro de la oportunidad
    source: str | None = None        # A-04: tipo de tiro fallado que dio el rebote (triple, media_distancia, cercano, tiro_libre)
    rebounder_id: int | None = None  # A-04: quien capturó el rebote ofensivo (None = rebote de equipo)
    finisher_id: int | None = None   # A-04: quien tiró, perdió el balón o recibió la falta
    band: str | None = None          # A-05: tramo del reloj de posesión del evento de decisión
    end_elapsed: int | None = None   # A-05: segundos de reloj de posesión del evento de decisión
    box: dict | None = None          # A-05: conteos propios de la oportunidad (tiros, libres, pérdidas)
    end_player_id: int | None = None  # A-05: quien tiró, perdió el balón o ejecutó los libres que cierran la oportunidad
    turnover_kind: str | None = None  # A-05: pase, manejo, pasos, viol24, otras


@dataclass
class Possession:
    poss_id: int
    team: str
    opp: str
    period: int
    period_type: str
    start_clock: int
    start_event: int
    end_clock: int | None = None
    end_event: int | None = None
    duration: int | None = None
    end_type: str | None = None
    pts: int = 0
    chances: list = field(default_factory=list)
    shots: list = field(default_factory=list)
    own_on_court: list | None = None       # player_ids ordenados o None
    opp_on_court: list | None = None
    lineup_changed: bool = False
    finisher_id: int | None = None
    assister_id: int | None = None
    turnover_by_id: int | None = None
    incomplete: bool = False
    incomplete_reason: str | None = None
    box: dict = field(default_factory=dict)
    opp_box: dict = field(default_factory=dict)
    game_id: str | None = None
    score_start: tuple | None = None       # (s1, s2) al inicio
    origin: str | None = None              # lo llena A-02
    ptype: str | None = None               # lo llena A-03
    ptype_reason: str | None = None        # A-03: por qué no hay tipo (sin_accion, reloj_no_derivable)
    first_elapsed: int | None = None       # A-03: segundos de posesión hasta el primer evento de decisión
    finish_kind: str | None = None         # A-03: bandeja_volcada, otro_2, triple_esquina, triple_frontal, tiro_libre, perdida, fin_periodo
    starter_id: int | None = None          # A-03: quien recuperó el balón (rebote defensivo o robo)
    end_player_id: int | None = None       # A-03: quien tiró, perdió el balón o recibió la falta que cerró la posesión
    event_numbers: tuple | None = None     # action_numbers de [start_event, end_event]


_enrichers: list[tuple[str, callable]] = []


def register_enricher(name, fn):
    """A-02..A-05 registran `fn(possessions, events, meta)`; mismo `name` reemplaza."""
    for k, (n, _) in enumerate(_enrichers):
        if n == name:
            _enrichers[k] = (name, fn)
            return
    _enrichers.append((name, fn))


def _box():
    return {k: 0 for k in _BOX_KEYS}


def _parse_ft(sub_type):
    """'2of3' → (2, 3); None si no parsea."""
    m = _FT_RE.search(sub_type or "")
    return (int(m.group(1)), int(m.group(2))) if m else None


def _reset_secs():
    """clock.reset_secs; fuera de contexto de aplicación (scripts) vale el default FIBA."""
    return int(config.get("clock.reset_secs")) if has_app_context() else 14


# ── Pre-proceso ──────────────────────────────────────────────────────────────

def _prepare(game_id):
    """Eventos + códigos + ids + reloj monótono + quintetos por evento. None si no hay pbp."""
    data = repository.game_pbp_data(game_id)
    if not data or not data.get("home_code") or not data.get("away_code"):
        return None
    events, rows = data["events"], data["player_rows"]
    codes = (data["home_code"], data["away_code"])

    n2id = {}                                  # (team_code, player_name) → player_id canónico
    for r in rows:
        pid = identity.canonical_id(r.player_id) if r.player_id is not None else None
        if pid is None:
            try:
                pid = identity.resolve_player_id(r.team_code, r.player_name, create=False)
            except ValueError:                 # nombre vacío
                pid = None
        if pid is not None:
            n2id[(r.team_code, r.player_name)] = pid

    xy = {s.action_number: (s.court_x, s.court_y)
          for s in Shot.query.filter_by(game_id=game_id).all()}
    return _prepare_data(game_id, events, rows, codes, xy, n2id)


def _prepare_data(game_id, events, rows, codes, xy, n2id):
    """Parte pura de `_prepare`: no toca la base (la reusa el modo en vivo, F-01)."""
    # reloj monótono: el piso arranca en plen y solo baja dentro del período
    mc, floor, last_pk = [], None, None
    for ev in events:
        pk = (ev.get("period"), ev.get("period_type"))
        if pk != last_pk:
            floor, last_pk = lineups.PERIOD_LEN.get(ev.get("period_type"), 600), pk
        c = ev.get("clock_secs")
        if c is not None and c < floor:
            floor = c
        mc.append(floor)

    starters = {c: lineups.game_starters(rows, c) for c in codes}
    return {"game_id": game_id, "events": events, "codes": codes,
            "opp": {codes[0]: codes[1], codes[1]: codes[0]},
            "n2id": n2id, "mc": mc, "evl": lineups.event_lineups(events, codes, starters),
            "xy": xy, "reset": _reset_secs()}


# ── Máquina de estados ───────────────────────────────────────────────────────

class _Walker:
    """Estado de la reconstrucción (plan §4.3). Un `_Walker` por partido."""

    def __init__(self, p):
        self.p, self.evs, self.mc, self.evl = p, p["events"], p["mc"], p["evl"]
        self.opp, self.reset = p["opp"], p["reset"]
        self.out, self.anoms = [], []
        self.outside = {c: 0 for c in p["codes"]}
        self.cur = self.chance = self.open_i = None
        self.miss = None        # tiro errado sin rebote aún: {team, end, an, i}
        self.ft = None          # serie de TL en curso: {team, y, technical, retain, end}
        self.andone = None      # TL de and-one esperado: {an, poss, end}
        self.held = None        # balón retenido: {team, i}
        self.tech, self.retain = set(), set()   # equipos que tirarán TL técnico / con retención
        self.pid, self.pk, self.last_end = 0, None, 600
        self.score = (0, 0)
        self.last_closed, self.last_made = {}, {}

    # -- utilidades --
    def anom(self, i, kind, detail=""):
        self.anoms.append({"action_number": self.evs[i]["action_number"], "kind": kind, "detail": detail})

    def pid_of(self, team, name):
        return self.p["n2id"].get((team, name)) if name else None

    def ids(self, i, code):
        """Quinteto de `code` en el evento i como player_ids ordenados; None si no hay 5 resolubles."""
        names = self.evl[i].get(code)
        if names is None or len(names) != 5:
            return None
        ids = [self.p["n2id"].get((code, n)) for n in names]
        return None if None in ids else sorted(ids)

    def flush(self):
        """Evento de juego: caducan series, banderas y balón retenido pendientes."""
        self.ft = self.andone = self.held = None
        self.tech.clear()
        self.retain.clear()

    # -- ciclo de vida --
    def open(self, team, i, sc=24):
        ev = self.evs[i]
        self.pid += 1
        po = Possession(
            poss_id=self.pid, team=team, opp=self.opp[team], period=ev.get("period"),
            period_type=ev.get("period_type"), start_clock=self.last_end,
            start_event=ev["action_number"], game_id=self.p["game_id"], score_start=self.score,
            own_on_court=self.ids(i, team), opp_on_court=self.ids(i, self.opp[team]),
            box=_box(), opp_box=_box())
        self.chance = Chance(1, ev["action_number"], po.start_clock, sc)
        po.chances.append(self.chance)
        self.cur, self.open_i, self.miss, self.held = po, i, None, None

    def close(self, i, end_type, clock=None):
        po, ch = self.cur, self.chance
        po.end_event = ch.end_event = self.evs[i]["action_number"]
        po.end_type = ch.end_type = end_type
        po.end_clock = self.mc[i] if clock is None else clock
        po.duration = max(0, po.start_clock - po.end_clock)
        po.lineup_changed = self.evl[self.open_i] != self.evl[i]
        self.last_end = po.end_clock
        self.out.append(po)
        self.last_closed[po.team] = po
        self.cur = self.chance = self.open_i = self.miss = None

    def gap(self, i, reason):
        """Posesión sin cierre válido: incompleta, se cierra en el evento anterior."""
        po = self.cur
        po.incomplete, po.incomplete_reason = True, reason
        self.anom(i, reason, f"posesion {po.poss_id} de {po.team} sin cierre")
        self.close(max(i - 1, self.open_i), None)

    def ensure(self, team, i):
        if self.cur is not None and self.cur.team != team:
            if self.held is not None and self.held["team"] == team:   # salto entre dos: cambio limpio
                self.anom(i, "salto_cambio_posesion", "informativo")
                self.close(self.held["i"], "perdida")
            else:
                self.gap(i, "cambio_sin_cierre")
        if self.cur is None:
            self.open(team, i)

    # -- recorrido --
    def run(self):
        for i, ev in enumerate(self.evs):
            self._period(i, ev)
            self._event(i, ev)
            s1, s2 = ev.get("s1") or 0, ev.get("s2") or 0     # marcador monótono (eventos fuera de orden)
            self.score = (max(self.score[0], s1), max(self.score[1], s2))
        if self.cur is not None:
            self.close(len(self.evs) - 1, "fin_periodo", clock=0)
        return self.out, self.outside, self.anoms

    def _period(self, i, ev):
        pk = (ev.get("period"), ev.get("period_type"))
        if pk == self.pk:
            return
        if self.cur is not None:                 # período anterior sin evento de fin
            self.close(max(i - 1, self.open_i), "fin_periodo", clock=0)
        self.pk = pk
        self.last_end = lineups.PERIOD_LEN.get(ev.get("period_type"), 600)
        self.flush()

    def _event(self, i, ev):
        at, T = ev.get("action_type"), ev.get("team_code") or ""
        sub = (ev.get("sub_type") or "").lower()
        if at == "period":
            if self.cur is not None:
                self.close(i, "fin_periodo", clock=0)
        elif at in _NEUTRAL:
            return
        elif at == "jumpball":
            if sub == "heldball" and T in self.opp:
                self.held = {"team": T, "i": i}
        elif at in ("2pt", "3pt", "freethrow", "rebound", "turnover"):
            if T not in self.opp:                # evento decisivo sin equipo
                if self.cur is not None:
                    self.gap(i, "evento_sin_equipo")
                else:
                    self.anom(i, "evento_sin_equipo", at)
            elif at == "freethrow":
                self._ft(i, ev, T)
            elif at == "rebound":
                self._reb(i, ev, T, sub)
            elif at == "turnover":
                self._tov(i, ev, T)
            else:
                self._shot(i, ev, T)
        elif T in self.opp:
            if at == "foul":
                self._foul(T, sub)
            elif at == "foulon":
                if self.cur is not None:
                    (self.cur.box if self.cur.team == T else self.cur.opp_box)["fouls_drawn"] += 1
            elif at in ("assist", "steal", "block"):
                self._aux(ev, T, at)

    # -- tiros de campo --
    def _andone_ahead(self, i, T):
        """Índice del TL de and-one: falta del rival + TL 1of1 de T antes del próximo evento de juego.
        No exige igualdad de reloj: FIBA registra la falta/TL con ±1 s (o hasta 9 s hacia atrás)."""
        evs, foul = self.evs, False
        pk = (evs[i].get("period"), evs[i].get("period_type"))
        for j in range(i + 1, min(i + _LOOKAHEAD + 1, len(evs))):
            e = evs[j]
            if (e.get("period"), e.get("period_type")) != pk:
                break
            at, tc, st = e.get("action_type"), e.get("team_code"), (e.get("sub_type") or "").lower()
            if at == "foul" and tc == self.opp[T] and st not in _TECH and st != "offensive":
                foul = True
            elif at == "freethrow" and tc == T:
                xy = _parse_ft(st) or (1, 1)
                return j if foul and xy == (1, 1) else None
            elif at in ("2pt", "3pt", "rebound", "turnover", "period"):
                break
        return None

    def _shot(self, i, ev, T):
        self.ensure(T, i)
        self.flush()
        po, ch, an = self.cur, self.chance, ev["action_number"]
        n = 3 if ev["action_type"] == "3pt" else 2
        ok = ev.get("success") == 1
        pid = self.pid_of(T, ev.get("player_name"))
        po.box[f"fga{n}"] += 1
        el = ch.start_clock - self.mc[i]
        if el < 0 or el > ch.shot_clock_start + 1:
            self.anom(i, "reloj_no_derivable", f"{el}s desde inicio de la oportunidad")
            el = None
        xy = self.p["xy"].get(an)
        zone = (self.p["zone"](ev["action_type"], ev.get("sub_type") or "", xy[0], xy[1])
                if xy and xy[0] is not None and xy[1] is not None else None)
        po.shots.append({"action_number": an, "elapsed": el, "band": None, "zone": zone, "three": n == 3,
                         "made": ok, "pts": n if ok else 0, "player_id": pid})
        if not ok:
            self.miss = {"team": T, "end": f"t{n}f", "an": an, "i": i}
            return
        po.box[f"fgm{n}"] += 1
        po.pts += n
        ch.pts += n
        po.finisher_id = pid
        self.last_made[T] = (po, an)
        j = self._andone_ahead(i, T)
        if j is None:
            self.close(i, f"t{n}c")
        else:                                    # and-one: cierra en el TL adicional
            self.andone = {"an": self.evs[j]["action_number"], "poss": po, "end": f"t{n}c"}

    # -- tiros libres --
    def _new_series(self, T, y, an):
        a = self.andone
        if a is not None and a["an"] == an:
            self.andone = None
            self.retain.discard(T)
            return {"team": T, "y": y, "technical": False, "retain": False,
                    "end": a["end"] if a["poss"] is self.cur else "falta"}
        tech = T in self.tech and y == 1
        retain = not tech and T in self.retain
        if tech:
            self.tech.discard(T)
        if retain:
            self.retain.discard(T)
        return {"team": T, "y": y, "technical": tech, "retain": retain, "end": "falta"}

    def _ft(self, i, ev, T):
        an, ok = ev["action_number"], ev.get("success") == 1
        xy = _parse_ft(ev.get("sub_type"))
        if xy is None:
            self.anom(i, "tl_sin_serie", f"sub_type '{ev.get('sub_type')}' no parseable")
            xy = (1, 1)
        x, y = xy
        s = self.ft
        if s is None or s["team"] != T or x == 1 or y != s["y"]:     # arranca serie nueva
            if s is not None:
                self.anom(i, "serie_tl_incompleta", f"serie de {s['team']} sin completar")
            if x > 1:
                self.anom(i, "tl_sin_serie", "TL intermedio sin inicio de serie")
            s = self._new_series(T, y, an)
        cur = self.cur

        if s["technical"]:                       # nunca abre ni cierra
            if cur is not None and cur.team == T:
                cur.box["fta"] += 1
                if ok:
                    cur.box["ftm"] += 1
                    cur.pts += 1
                    self.chance.pts += 1
            elif ok:
                self.outside[T] += 1
            self.ft = None if x >= y else s
            return

        if cur is not None and cur.team != T:    # TL del rival: ¿cerró por falta en el rebote?
            m = self.miss
            if m is not None and m["team"] == cur.team:
                self.close(m["i"], m["end"])
            elif s["retain"]:
                self.anom(i, "falta_sin_perdida", "antideportiva de la posesión en curso: cambio limpio")
                self.close(max(i - 1, self.open_i), "perdida")
            else:
                self.gap(i, "cambio_sin_cierre")
        if self.cur is None:
            self.open(T, i)
        po = self.cur
        po.box["fta"] += 1
        self.miss = None
        if ok:
            po.box["ftm"] += 1
            po.pts += 1
            self.chance.pts += 1
            if po.finisher_id is None:
                po.finisher_id = self.pid_of(T, ev.get("player_name"))
        if x < y:
            self.ft = s
            return
        self.ft = None                            # último TL de la serie
        if s["retain"]:
            return                                # conserva el balón: la posesión sigue
        if ok:
            self.close(i, s["end"])
        else:
            self.miss = {"team": T, "end": s["end"], "an": an, "i": i}

    # -- rebotes, pérdidas, faltas, vínculos --
    def _reb(self, i, ev, T, sub):
        if self.ft is not None:                   # balón no vivo entre TL de una serie
            self.anom(i, "rebote_entre_tl", "informativo")
            return
        an, cur, m = ev["action_number"], self.cur, self.miss
        self.flush()
        if cur is not None and cur.team != T:
            if sub == "offensive":
                self.gap(i, "cambio_sin_cierre")
                self.open(T, i, self.reset)
                return
            cur.opp_box["drb"] += 1
            if m is None or m["team"] != cur.team:
                self.anom(i, "rebote_sin_tiro", "rebote defensivo sin tiro errado pendiente")
                end = "t2f"
            else:
                end = m["end"]
            self.close(i, end)
            self.open(T, i)
            return
        if cur is None:
            self.open(T, i, self.reset if sub == "offensive" else 24)
            if sub == "offensive":
                self.anom(i, "rebote_ofensivo_sin_posesion", "informativo")
            return
        if sub != "offensive":                    # defensivo del equipo atacante: dato inconsistente
            self.anom(i, "rebote_inconsistente", "rebote defensivo del equipo atacante")
        cur.box["orb"] += 1
        ch = self.chance
        if m is None:
            self.anom(i, "rebote_sin_tiro", "rebote ofensivo sin tiro errado pendiente")
            ch.end_type, ch.end_event = "t2f", an
        else:
            ch.end_type, ch.end_event = m["end"], m["an"]
        self.chance = Chance(len(cur.chances) + 1, an, self.mc[i], self.reset)
        cur.chances.append(self.chance)
        self.miss = None

    def _tov(self, i, ev, T):
        self.ensure(T, i)
        self.flush()
        po = self.cur
        po.box["tov"] += 1
        po.turnover_by_id = self.pid_of(T, ev.get("player_name"))
        self.close(i, "perdida")

    def _foul(self, T, sub):
        if sub in _TECH:
            self.tech.add(self.opp[T])            # el rival tira TL técnico
        elif sub in _RETAIN:
            self.retain.add(self.opp[T])          # el rival tira y conserva el balón
        if self.cur is not None and sub not in ("benchtechnical", "coachtechnical"):
            (self.cur.box if self.cur.team == T else self.cur.opp_box)["pf"] += 1

    def _aux(self, ev, T, at):
        """assist / steal / block: se vinculan sin `previous_action` por proximidad."""
        o = self.opp[T]
        if at == "assist":
            lm = self.last_made.get(T)
            if lm is not None and 0 <= ev["action_number"] - lm[1] <= _ASSIST_WINDOW:
                po = lm[0]
            else:
                po = self.cur if self.cur is not None and self.cur.team == T else self.last_closed.get(T)
            if po is None:
                return
            po.box["ast"] += 1
            if po.assister_id is None and any(s["made"] for s in po.shots):
                po.assister_id = self.pid_of(T, ev.get("player_name"))
            return
        po = self.cur if self.cur is not None and self.cur.team == o else self.last_closed.get(o)
        if po is None:
            return
        if at == "steal":
            po.opp_box["stl"] += 1
        else:
            po.opp_box["blk"] += 1
            po.box["blk_received"] += 1


def _finish(prep, poss, anoms):
    """Post-proceso: incompletas sin cierre, puntos vs oportunidades, event_numbers, enriquecedores."""
    ans = [e["action_number"] for e in prep["events"]]
    idx = {a: k for k, a in enumerate(ans)}
    for p in poss:
        if p.end_type is None and not p.incomplete:
            p.incomplete, p.incomplete_reason = True, "sin_finalizacion"
        if p.pts != sum(c.pts for c in p.chances):
            anoms.append({"action_number": p.start_event, "kind": "pts_oportunidades_difieren",
                          "detail": f"posesion {p.poss_id}: {p.pts} vs {sum(c.pts for c in p.chances)}"})
        i0 = idx[p.start_event]
        i1 = idx.get(p.end_event, i0)
        p.event_numbers = tuple(ans[i0:i1 + 1])
    mc = prep["mc"]
    meta = {"game_id": prep["game_id"], "codes": prep["codes"], "name_to_id": prep["n2id"],
            "mclock": lambda ev: mc[idx[ev["action_number"]]],   # reloj monótono de un evento
            "mclock_list": mc, "event_index": idx,               # paralelos a `events`
            "event_lineups": prep["evl"]}
    for name, fn in _enrichers:
        try:
            fn(poss, prep["events"], meta)
        except Exception as e:                    # un enriquecedor roto no rompe la reconstrucción
            log.exception("enriquecedor %s falló en %s", name, prep["game_id"])
            anoms.append({"action_number": None, "kind": "enricher_error", "detail": f"{name}: {e}"})


def _build(game_id):
    """(posesiones, outside_points, anomalías) de un partido. Sin pbp → ([], {}, [])."""
    prep = _prepare(game_id)
    if prep is None:
        return [], {}, []
    return _run(prep)


def _run(prep):
    import shot_zones                             # diferido: shot_zones arrastra sample/context
    prep["zone"] = lambda at, st, x, y: shot_zones.classify_zone(
        at, st, *shot_zones.to_half_court(x, y), None)
    poss, outside, anoms = _Walker(prep).run()
    _finish(prep, poss, anoms)
    return poss, outside, anoms


def build_from_events(game_id, events, rows, codes, xy, n2id):
    """Posesiones desde datos en memoria (partido en vivo, F-01): sin caché ni base.

    events: dicts ordenados por action_number; rows: objetos con team_code/player_name/starter;
    xy: {action_number: (court_x, court_y)}; n2id: {(team_code, player_name): id}."""
    if not events or not all(codes):
        return [], {}, []
    return _run(_prepare_data(game_id, events, rows, codes, xy, n2id))


# ── API pública (cacheada) ───────────────────────────────────────────────────

def _game_full(game_id):
    """(posesiones, outside_points, anomalías) — cacheado."""
    return cache.memo("poss:game", (game_id, "full"), lambda: _build(game_id))


def game_possessions(game_id):
    """Posesiones del partido en orden de juego; cacheado, nunca persistido."""
    return cache.memo("poss:game", (game_id,), lambda: _game_full(game_id)[0])


def team_possessions(team_code, comp_id, ctx=None, *, side="ataque"):
    """Posesiones del equipo filtradas por contexto (plan §4.5)."""
    games = repository.team_pbp_games(team_code, comp_id)
    out = []
    for g in games:
        poss = game_possessions(g["game_id"])
        for p in poss:
            if p.incomplete:
                continue
            if side == "ataque" and p.team != team_code:
                continue
            if side == "defensa" and p.opp != team_code:
                continue
            out.append(p)
    return out


def team_possessions_in(team_code, game_ids, *, side="ataque"):
    """Posesiones completas del equipo en los partidos `game_ids` (los de la selección activa).

    No carga eventos: cada partido sale del caché de `game_possessions`. Los partidos sin pbp aportan 0."""
    out = []
    for gid in game_ids:
        for p in game_possessions(gid):
            if p.incomplete:
                continue
            if (p.team if side == "ataque" else p.opp) == team_code:
                out.append(p)
    return out


def possessions_bundle(possessions, *, entity_type, entity_id, name, games):
    """Posesiones completadas → StatBundle (plan §4.6, PROPUESTA)."""
    from stats_engine import StatBundle
    own = _box()
    opp = _box()
    poss_seconds = 0.0
    game_ids = set()
    for p in possessions:
        for k in _BOX_KEYS:
            own[k] = (own[k] or 0) + (p.box.get(k) or 0)
            opp[k] = (opp[k] or 0) + (p.opp_box.get(k) or 0)
        poss_seconds += p.duration or 0
        if p.game_id:
            game_ids.add(p.game_id)
    return StatBundle(
        entity_type=entity_type, entity_id=entity_id, name=name,
        own=own, opp=opp, team=None,
        games=len(game_ids), minutes=None, team_minutes=None,
        seconds=poss_seconds, on_court=None, shots=None,
        possessions_counted=len(possessions),
        null_reasons={"minutes": "no_aplica"},
        poss_seconds=poss_seconds,
        finished_poss=None,
        meta={"game_ids": sorted(game_ids)},
    )


def ppp_stats(comp_id):
    """PPP stats de la competencia: {mean, sd, n} (plan §4.10, PROPUESTA). Cacheado por versión de datos: el
    ajuste por muestra lo pide por cada fila de cada tabla y recorría las posesiones de toda la liga cada vez."""
    return cache.memo("poss:ppp_stats", comp_id, lambda: _ppp_stats(comp_id))


def _ppp_stats(comp_id):
    import math
    games = Game.query.filter_by(competition_id=comp_id).all()
    ppp_vals = []
    for g in games:
        poss = game_possessions(g.game_id)
        for p in poss:
            if not p.incomplete and p.duration is not None and p.duration > 0:
                ppp_vals.append(p.pts)
    n = len(ppp_vals)
    if n < 2:
        return {"mean": None, "sd": None, "n": n}
    mean = sum(ppp_vals) / n
    var = sum((v - mean) ** 2 for v in ppp_vals) / (n - 1)
    sd = math.sqrt(var)
    return {"mean": round(mean, 4), "sd": round(sd, 4), "n": n}


# ── Conciliación (plan §4.8) ─────────────────────────────────────────────────

def _diff_pct(counted, formula):
    return None if not formula else round(100 * (counted - formula) / formula, 2)


def _pos_row(r):
    """POS de una fila de team_game_stats (misma fórmula que lineups._pos)."""
    return lineups._pos({k: getattr(r, k) or 0 for k in ("fga2", "fga3", "fta", "tov", "orb")})


def _recon_game(game_id):
    """{team: {...}} de un partido con pbp; {} si no tiene."""
    data = repository.game_pbp_data(game_id)
    if not data:
        return {}
    poss, outside, _ = _game_full(game_id)
    rows = {r.team_code: r for r in TeamGameStats.query.filter_by(game_id=game_id).all()}
    out = {}
    for c in (data["home_code"], data["away_code"]):
        mine = [p for p in poss if p.team == c]
        done = [p for p in mine if not p.incomplete]
        empty = sum(1 for p in done if p.end_type == "fin_periodo"
                    and not p.shots and not p.box["fta"] and not p.box["tov"])
        fpbp = lineups._pos(lineups._agg(data["events"], c))
        r = rows.get(c)
        pts_poss, pts_out = sum(p.pts for p in mine), outside.get(c, 0)
        out[c] = {
            "counted": len(done), "incomplete": len(mine) - len(done), "period_end_empty": empty,
            "formula_pbp": round(fpbp, 2),
            "formula_box": round(_pos_row(r), 2) if r else None,
            "diff_pct": _diff_pct(len(done), fpbp),
            "pts_poss": pts_poss, "pts_outside": pts_out, "pts_box": r.pts if r else None,
            "pts_ok": (pts_poss + pts_out == r.pts) if r and r.pts is not None else None,
            "reasons": dict(Counter(p.incomplete_reason for p in mine if p.incomplete)),
        }
    return out


def _label(g):
    return (f"{g.home_team or '—'} {g.home_score if g.home_score is not None else '—'} – "
            f"{g.away_score if g.away_score is not None else '—'} {g.away_team or '—'}")


def _recon_comp(comp_id):
    games = Game.query.filter_by(competition_id=comp_id).order_by(Game.date, Game.game_id).all()
    gids = [g.game_id for g in games]
    with_pbp = ({gid for (gid,) in db.session.query(PbpEvent.game_id)
                 .filter(PbpEvent.game_id.in_(gids)).distinct()} if gids else set())
    agg, names, per_game, over, errors = {}, {}, [], [], []
    for g in games:
        names[g.home_code], names[g.away_code] = g.home_team, g.away_team
        if g.game_id not in with_pbp:
            continue
        try:
            rc = _recon_game(g.game_id)
        except Exception:                         # un partido roto no tumba la competencia
            log.exception("reconciliación falló en %s", g.game_id)
            errors.append({"game_id": g.game_id, "date": g.date, "label": _label(g),
                           "reason": "error_reconstruccion"})
            continue
        reasons, row = Counter(), {"game_id": g.game_id, "date": g.date, "label": _label(g),
                                   "incomplete": 0, "reasons": {}, "diff_pct": {}}
        for code, r in rc.items():
            a = agg.setdefault(code, {"games": 0, "counted": 0, "incomplete": 0, "empty": 0,
                                      "formula": 0.0, "formula_box": 0.0, "box_ok": True})
            a["games"] += 1
            a["counted"] += r["counted"]
            a["incomplete"] += r["incomplete"]
            a["empty"] += r["period_end_empty"]
            a["formula"] += r["formula_pbp"]
            if r["formula_box"] is None:
                a["box_ok"] = False
            else:
                a["formula_box"] += r["formula_box"]
            reasons.update(r["reasons"])
            row["incomplete"] += r["incomplete"]
            row["diff_pct"][code] = r["diff_pct"]
            if r["diff_pct"] is not None and abs(r["diff_pct"]) > OVER_PCT:
                over.append({"game_id": g.game_id, "date": g.date, "team_code": code,
                             "counted": r["counted"], "formula": r["formula_pbp"],
                             "diff_pct": r["diff_pct"], "incomplete": r["incomplete"],
                             "reasons": r["reasons"], "period_end_empty": r["period_end_empty"]})
        row["reasons"] = dict(reasons)
        per_game.append(row)

    teams = []
    for code in sorted(agg):
        a = agg[code]
        d = _diff_pct(a["counted"], a["formula"])
        teams.append({"team_code": code, "team_name": names.get(code), "games": a["games"],
                      "counted": a["counted"], "incomplete": a["incomplete"],
                      "period_end_empty": a["empty"], "formula": round(a["formula"], 2),
                      "formula_box": round(a["formula_box"], 2) if a["box_ok"] else None,
                      "diff_pct": d, "within_2pct": None if d is None else abs(d) <= TOL_PCT})
    counted = sum(t["counted"] for t in teams)
    incomplete = sum(t["incomplete"] for t in teams)
    formula = sum(t["formula"] for t in teams)
    over.sort(key=lambda o: -abs(o["diff_pct"]))
    return {
        "teams": teams,
        "totals": {"counted": counted, "formula": round(formula, 2),
                   "diff_pct": _diff_pct(counted, formula), "incomplete": incomplete,
                   "incomplete_pct": round(100 * incomplete / (counted + incomplete), 2)
                   if counted + incomplete else None},
        "games_over_5pct": over,
        "games_excluded": {"sin_pbp": len(gids) - len(with_pbp)},
        "max_diff_pct": TOL_PCT,
        "games": per_game,
        "errors": errors,
    }


def reconcile(scope):
    """scope = {"game_id": ...} → {team: {...}} · {"comp_id": ...} → conciliación por competencia."""
    if scope.get("game_id"):
        return _recon_game(scope["game_id"])
    if scope.get("comp_id") is not None:
        comp_id = scope["comp_id"]
        return cache.memo("poss:game", ("reconcile", comp_id), lambda: _recon_comp(comp_id))
    raise ValueError("scope inválido: se espera game_id o comp_id")


def possession_gaps_check(comp_id):
    """Check `possession_gaps` de F-11: incompletas y partidos con diferencia de conciliación."""
    rc = reconcile({"comp_id": comp_id})
    if not rc["games"] and not rc["errors"]:
        return {"status": "no_disponible", "count": None, "counts_as_incomplete": False,
                "reason": "sin_pbp", "items": []}
    items = [{k: g[k] for k in ("game_id", "date", "label", "incomplete", "reasons", "diff_pct")}
             for g in rc["games"]
             if g["incomplete"] or any(d is not None and abs(d) > OVER_PCT for d in g["diff_pct"].values())]
    items += rc["errors"]
    pct = rc["totals"]["incomplete_pct"]
    alerta = ((pct or 0) > 1 or bool(rc["games_over_5pct"]) or bool(rc["errors"])
              or any(t["within_2pct"] is False for t in rc["teams"]))
    return {"status": "alerta" if alerta else "ok", "count": rc["totals"]["incomplete"], "pct": pct,
            "counts_as_incomplete": False, "items": items}
