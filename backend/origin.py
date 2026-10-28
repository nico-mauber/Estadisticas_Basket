"""Origen de la posesión (A-02): cómo empieza cada posesión y cómo termina según su origen.

`enrich_origin` se registra como enriquecedor de `possessions` y completa `Possession.origin` mirando
el evento que cerró la posesión anterior (con la precedencia de la arquitectura §3.9). `origin_report`
y `player_origin` agregan las posesiones COMPLETAS por origen, en ataque y en defensa. Todo on-the-fly:
nada se persiste; las posesiones enriquecidas viven en el caché de `possessions.game_possessions`.

Los ocho orígenes del cliente son siete claves de posesión (`ORIGINS`) más "tras rebote ofensivo", que
es el origen de una oportunidad (`Chance.n >= 2`) y NO de una posesión (DA-29): se informa aparte en
`oreb_info`, fuera de la suma.
"""
import cache
import context as context_mod
import identity
import metrics_catalog
import possessions
import repository
import sample
import stats_engine
import tables
from stats_engine import StatBundle

ORIGINS = ("canasta_rival", "rebote_defensivo", "robo", "perdida_rival", "saque_banda",
           "tiempo_muerto", "tiro_libre_rival")
LABELS = {
    "canasta_rival": "Tras canasta rival",
    "rebote_defensivo": "Tras rebote defensivo",
    "robo": "Tras robo",
    "perdida_rival": "Tras pérdida rival sin robo",
    "saque_banda": "Saque de banda",
    "tiempo_muerto": "Saque de fondo tras tiempo muerto",
    "tiro_libre_rival": "Tras tiro libre rival",
}
OREB_NOTE = ("No participa de los ocho orígenes: es el inicio de una segunda oportunidad "
             "(ver Segunda oportunidad, A-04).")
SIDES = ("ataque", "defensa")

# eventos que cambian el estado del balón: el primero hacia atrás es el "evento de cierre"
_TRIGGERS = frozenset({"2pt", "3pt", "freethrow", "rebound", "turnover", "period", "jumpball"})
_STEAL_LOOKBACK = 3          # eventos antes de la pérdida donde FIBA a veces registra el robo


# ── Clasificación ────────────────────────────────────────────────────────────

def _period_key(ev):
    return (ev.get("period"), ev.get("period_type"))


def _classify(pos, evs, i0):
    """Origen de la posesión `pos` que abre el evento `evs[i0]` (precedencia de Arq. §3.9)."""
    opener, me, rival = evs[i0], pos.team, pos.opp
    pk = _period_key(opener)
    timeout = False
    steal = False
    trig = None
    j = i0 - 1
    while j >= 0:
        e = evs[j]
        if _period_key(e) != pk:
            break
        at = e.get("action_type")
        if at == "timeout":
            timeout = True
        elif at == "steal" and e.get("team_code") == me:
            steal = True
        elif at in _TRIGGERS:
            trig = (j, e)
            break
        j -= 1

    if timeout and trig is not None:
        return "tiempo_muerto"
    if trig is None:                       # inicio de período (salto inicial o posesión alterna)
        return "saque_banda"
    k, t = trig
    at, sub, team = t.get("action_type"), (t.get("sub_type") or "").lower(), t.get("team_code")
    if at in ("period", "jumpball"):
        return "saque_banda"
    if at == "turnover" and team == rival:
        if not steal:                      # el robo a veces va ANTES de la pérdida en el pbp
            for b in range(max(0, k - _STEAL_LOOKBACK), k):
                e = evs[b]
                if (_period_key(e) == pk and e.get("action_type") == "steal"
                        and e.get("team_code") == me):
                    steal = True
                    break
        return "robo" if steal else "perdida_rival"
    if at == "rebound" and team == me:
        return "rebote_defensivo"
    if opener.get("action_type") == "rebound" and opener.get("team_code") == me:
        # el rebote que abre la posesión: ¿el tiro fallado era un tiro libre rival?
        return "tiro_libre_rival" if at == "freethrow" and team == rival else "rebote_defensivo"
    if at == "freethrow" and team == rival and t.get("success") == 1:
        return "tiro_libre_rival"
    if at in ("2pt", "3pt") and team == rival and t.get("success") == 1:
        return "canasta_rival"
    return "saque_banda"                   # origen no identificable: default conservador (suma exacta)


def enrich_origin(poss, events, meta):
    """Enriquecedor de A-01: completa `Possession.origin`. Incompleta → None (RF-9)."""
    idx = meta["event_index"]
    for p in poss:
        if p.incomplete:
            p.origin = None
            continue
        i0 = idx.get(p.start_event)
        p.origin = _classify(p, events, i0) if i0 is not None else "saque_banda"


possessions.register_enricher("origin", enrich_origin)


# ── Agregación ───────────────────────────────────────────────────────────────

def _counts(group):
    c = {"n": len(group), "pts": 0, "fga2": 0, "fgm2": 0, "fga3": 0, "fgm3": 0, "fta": 0,
         "tov": 0, "duration_sum": 0, "t2": 0, "t3": 0, "tl": 0, "perdida": 0, "fin_periodo": 0}
    for p in group:
        c["pts"] += p.pts
        for k in ("fga2", "fgm2", "fga3", "fgm3", "fta", "tov"):
            c[k] += p.box.get(k) or 0
        c["duration_sum"] += p.duration or 0
        e = p.end_type
        if e in ("t2c", "t2f"):
            c["t2"] += 1
        elif e in ("t3c", "t3f"):
            c["t3"] += 1
        elif e == "falta":
            c["tl"] += 1
        elif e == "perdida":
            c["perdida"] += 1
        elif e == "fin_periodo":
            c["fin_periodo"] += 1
    return c


def _metric(value):
    return {"value": value, "reason": None if value is not None else "sin_intentos"}


def _row(key, group, total, team_poss):
    c = _counts(group)
    rates = stats_engine.origin_rates(c)
    games = {p.game_id for p in group}
    played = c["n"] - c["fin_periodo"]       # fin_periodo no es una finalización de juego (spec §9)
    finish = {k: (round(c[k] / played, 4) if played else None) for k in ("t2", "t3", "tl", "perdida")}
    finish["fin_periodo"] = {"count": c["fin_periodo"], "excluded_from_share": True}
    return {
        "key": key, "label": LABELS[key], "possessions": c["n"],
        "share": round(c["n"] / total, 4) if total else None,
        "metrics": {m: _metric(v) for m, v in rates.items()},
        "finish": finish,
        "sample": sample.sample_level("origin", n=c["n"], unit="posesiones",
                                      team_poss=team_poss, games=len(games)),
    }


def _summarize(complete, *, with_oreb=True):
    total = len(complete)
    by = {k: [] for k in ORIGINS}
    for p in complete:
        by.setdefault(p.origin, []).append(p)
    rows = [_row(k, by[k], total, total) for k in ORIGINS]
    out = {"origins": rows}
    summed = sum(r["possessions"] for r in rows)
    if with_oreb:
        out["oreb_info"] = {"label": "Tras rebote ofensivo",
                            "possessions": sum(len(p.chances) - 1 for p in complete if len(p.chances) >= 2),
                            "note": OREB_NOTE}
        out["reconcile"] = {"sum_origins": summed, "total_possessions": total, "ok": summed == total}
    out["summary"] = {"possessions": total, "classified": summed, "reconciled": summed == total}
    return out


def _games_for(team_code, comp_id, ctx):
    """Partidos con pbp que entran en el contexto: (seleccionados, total de la competencia, excluidos)."""
    all_games = repository.team_pbp_games(team_code, comp_id)
    games, excluded = context_mod.filter_games_ex(all_games, ctx, team_code)
    return games, len(all_games), excluded


def _selected(team_code, comp_id, ctx, side):
    games, total, excluded = _games_for(team_code, comp_id, ctx)
    out = []
    for g in games:
        for p in possessions.game_possessions(g["game_id"]):
            if p.incomplete:
                continue
            if (p.team if side == "ataque" else p.opp) == team_code:
                out.append(p)
    return out, len(games), total, excluded


def _echo(ctx, used, total, excluded):
    import metrics_catalog
    return context_mod.context_echo(
        ctx, games_used=used, games_total=total, games_excluded=excluded, ignored=[],
        competition_label=metrics_catalog._competition_label(ctx))


def origin_report(team_code, comp_id, ctx, *, side="ataque"):
    """Resumen por origen de las posesiones del equipo (ataque) o del rival contra él (defensa)."""
    def build():
        complete, used, total, excluded = _selected(team_code, comp_id, ctx, side)
        out = _summarize(complete)
        out.update({"side": side, "games_used": used, "games_total": total, "games_excluded": excluded})
        return out
    out = dict(cache.memo("poss:origin", (team_code, comp_id, context_mod.context_key(ctx), side), build))
    out["context"] = _echo(ctx, out.pop("games_used"), out.pop("games_total"), out.pop("games_excluded"))
    return out


def player_origin(player_id, comp_id, ctx):
    """De qué origen recibe el balón el jugador cuando FINALIZA la posesión (`finisher_id`)."""
    card = identity.player_card(player_id)
    if card is None:
        return None
    team_code = card["team_code"]
    pid = identity.canonical_id(player_id) or player_id
    complete, used, total, excluded = _selected(team_code, comp_id, ctx, "ataque")
    mine = [p for p in complete if p.finisher_id == pid]
    out = _summarize(mine, with_oreb=False)
    out["context"] = _echo(ctx, used, total, excluded)
    out["side"] = "ataque"
    return out


# ── Entidad `origin` (T-05) y tabla `team_origins` (T-06) ────────────────────
# id de entidad `<equipo>:<origen>`; `side=ataque|defensa` en `EntityRequest.params`. En defensa el bundle
# describe las posesiones del RIVAL contra el equipo (`own` = lo que el rival hizo, `opp` = lo que el equipo
# hizo en esas posesiones), igual que en `origin_report`.

_BUNDLE_KEYS = ("fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "orb", "drb", "ast", "tov", "stl",
                "blk", "blk_received", "pf", "fouls_drawn")


def _team_name(team_code):
    for r in repository.team_game_rows(None).values():
        if r["team_code"] == team_code:
            return r.get("team_name") or team_code
    return team_code


def _parse_id(entity_id):
    team_code, _, key = str(entity_id).partition(":")
    if key not in ORIGINS:
        raise metrics_catalog.MetricsError(
            "Origen inválido. Usá " + ", ".join(ORIGINS), 400, "parametro_invalido")
    return team_code.upper(), key


def _side(params):
    side = (params or {}).get("side") or "ataque"
    if side not in SIDES:
        raise metrics_catalog.MetricsError("El lado debe ser ataque o defensa.", 400, "parametro_invalido")
    return side


def origin_bundle(team_code, key, comp_id, ctx, side="ataque"):
    """`StatBundle` con las posesiones de UN origen del equipo; `None` si la selección no tiene ninguna."""
    k = ("origin_bundle", team_code, key, comp_id, context_mod.context_key(ctx), side)
    return repository.memo(k, lambda: _origin_bundle(team_code, key, comp_id, ctx, side))


def _origin_bundle(team_code, key, comp_id, ctx, side):
    complete, used, total, excluded = _selected(team_code, comp_id, ctx, side)
    group = [p for p in complete if p.origin == key]
    if not group:
        return None
    own = {k: sum(p.box.get(k) or 0 for p in group) for k in _BUNDLE_KEYS}
    opp = {k: sum(p.opp_box.get(k) or 0 for p in group) for k in _BUNDLE_KEYS}
    own["pts"], opp["pts"] = sum(p.pts for p in group), 0
    own["plus_minus"] = opp["plus_minus"] = None
    seconds = sum(p.duration or 0 for p in group)
    name = _team_name(team_code)
    meta = {"team_code": team_code, "team_name": name, "split": True, "poss_exact": True,
            "origin": key, "side": side, "variant": f"{key}:{side}",
            "games_total": total, "games_excluded": excluded}
    return StatBundle(
        entity_type="split", entity_id=team_code, name=name, own=own, opp=opp, team=None,
        games=len({p.game_id for p in group}), minutes=seconds / 60, team_minutes=None, seconds=seconds,
        on_court=None, shots=None, possessions_counted=len(group), null_reasons={}, meta=meta)


def _origin_loader(req):
    team_code, key = _parse_id(req.entity_id)
    b = origin_bundle(team_code, key, req.comp_id, req.ctx, _side(req.params))
    return [b] if b is not None else []


def all_origin_bundles(comp_id, ctx, variant=None):
    """Población del tipo `origin`: todos los equipos en el MISMO origen y lado (`variant` = `origen:lado`)."""
    if not variant or ":" not in str(variant):
        return []
    key, side = str(variant).split(":", 1)
    if key not in ORIGINS or side not in SIDES:
        return []
    out = []
    for code in sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()}):
        b = origin_bundle(code, key, comp_id, ctx, side)
        if b is not None:
            out.append(b)
    return out


metrics_catalog.register_entity("origin", _origin_loader, enumerator=all_origin_bundles)


def _share_text(n, total):
    return "—" if not total else f"{n / total * 100:.1f}".replace(".", ",") + " %"


def table_rows(treq):
    """Builder de `team_origins`: una fila por origen del equipo (ataque o defensa según `side`)."""
    team_code = (treq.params.get("team") or "").upper()
    side = treq.params.get("side") or "ataque"
    if side not in SIDES:
        raise tables.TableError(400, "El lado debe ser ataque o defensa.", "parametro_invalido", {"param": "side"})
    complete, _, _, _ = _selected(team_code, treq.comp_id, treq.ctx, side)
    total = len(complete)
    rows = []
    for key in ORIGINS:
        b = origin_bundle(team_code, key, treq.comp_id, treq.ctx, side)
        n = sum(1 for p in complete if p.origin == key)
        badge = sample.sample_level("origin", n=n, unit="posesiones", team_poss=total)
        rows.append(tables.TableRow(
            id=f"{team_code}:{key}", link=None,
            texts={"_origin": LABELS[key], "_share": _share_text(n, total)},
            bundle=b, sample=badge, extra={"possessions": n}, reason_if_null="sin_intentos"))
    return rows


tables.register_table(
    "team_origins", entity_type="origin", title="Origen de la posesión", builder=table_rows,
    required_params=("team",),
    default_columns=("_origin", "possessions", "_share", "pts", "oer", "efg_pct", "to_pct", "ft_rate"),
    bulk_scopes=("team",), row_kind="entity",
    extra_columns=(("_origin", "Origen", "text"), ("_share", "% del total", "text")),
    default_sort=None, totals_mode="none",
    title_fn=lambda treq: (
        f"Origen de la posesión{' rival' if treq.params.get('side') == 'defensa' else ''} — "
        f"{(treq.params.get('team') or '').upper()}"),
)
