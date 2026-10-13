"""
Identidad de jugador (C-08): una ficha por jugador y equipo, con id estable.

Hasta C-08 el "jugador" era el string `player_name`, agrupado al leer. Ahora cada fila de
`player_game_stats` apunta a una ficha de `players` por `player_id`. La clave de la ficha es
(equipo, nombre normalizado): minúsculas, sin tildes, sin espacios dobles. La competencia NO
forma parte de la clave (un jugador con partidos en dos competencias seguiría siendo uno).

La normalización es TIPOGRÁFICA: "J. Feldeine" y "Jerome Feldeine" no se unifican solas. Esos
casos los lista `duplicate_candidates` (panel de calidad) y los une un administrador con
`merge_players`.

Los nombres crudos de `player_game_stats`, `shots` y `pbp_events` nunca se reescriben: las
consultas por nombre resuelven a la ficha y usan todas sus grafías (`aliases`).
"""
import logging
from collections import defaultdict
from datetime import datetime
from types import SimpleNamespace

from flask import g, has_request_context
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from database import db, Game, Player, PlayerGameStats
from stats_engine import norm_name, resolve_identity, played   # noqa: F401 (re-export)

log = logging.getLogger(__name__)

# Grupos de posición para el filtro del buscador (DA-11). FIBA publica G/PG/SG, F/SF/PF y C.
_POSITION_GROUPS = {"G": "G", "PG": "G", "SG": "G", "F": "F", "SF": "F", "PF": "F", "C": "C"}

BACKFILL_BATCH = 500


class IdentityError(Exception):
    """Error de negocio de identidad con su código HTTP (400, 404, 409)."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def position_group(pos) -> str | None:
    """Posición FIBA → grupo G/F/C; vacía o desconocida → None (no entra en ningún grupo)."""
    p = (pos or "").strip().upper()
    if not p:
        return None
    if p in _POSITION_GROUPS:
        return _POSITION_GROUPS[p]
    return p[0] if p[0] in ("G", "F", "C") else None   # p. ej. "G-F" → "G"


# ── Fichas ─────────────────────────────────────────────────────────────────

def canonical_id(player_id: int | None) -> int | None:
    """Sigue `merged_into` hasta la ficha vigente. None si el id no existe; ante un ciclo en
    los datos corta en el último id visitado en vez de colgarse."""
    seen, cur, last = set(), player_id, None
    while cur is not None and cur not in seen:
        seen.add(cur)
        row = db.session.get(Player, cur)
        if row is None:
            return last
        last, cur = cur, row.merged_into
    if cur is not None:
        log.warning("Ciclo de merged_into en players (id %s)", cur)
    return last


def resolve_player_id(team_code: str, player_name: str, *, first_name=None, family_name=None,
                      photo_url=None, create: bool = True) -> int | None:
    """Ficha canónica de (equipo, nombre). Con `create=False` devuelve None si no existe."""
    key = norm_name(player_name)
    if not key:
        raise ValueError("nombre vacío")
    row = Player.query.filter_by(team_code=team_code, norm_key=key).first()
    if row is None:
        if not create:
            return None
        row = Player(team_code=team_code, norm_key=key, display_name=player_name.strip(),
                     first_name=first_name, family_name=family_name, photo_url=photo_url,
                     created_at=datetime.utcnow().isoformat())
        try:
            with db.session.begin_nested():   # savepoint: una carrera entre workers no aborta todo
                db.session.add(row)
        except IntegrityError:
            row = Player.query.filter_by(team_code=team_code, norm_key=key).first()
    else:
        # completa datos que la ficha no tenía; nunca sobrescribe
        for col, val in (("first_name", first_name), ("family_name", family_name), ("photo_url", photo_url)):
            if val and not getattr(row, col):
                setattr(row, col, val)
    return canonical_id(row.id)


def _refresh_display(pids) -> None:
    """`display_name` = grafía real de la fila más reciente de cada ficha."""
    for pid in set(pids):
        latest = (db.session.query(PlayerGameStats.player_name)
                  .join(Game, Game.game_id == PlayerGameStats.game_id)
                  .filter(PlayerGameStats.player_id == pid)
                  .order_by(Game.date.desc(), Game.game_id.desc()).first())
        if latest and (latest[0] or "").strip():
            db.session.execute(update(Player).where(Player.id == pid)
                               .values(display_name=latest[0].strip()))


def _assign(rows) -> set[int]:
    """Asigna `player_id` a filas (id, team_code, player_name, first, family, photo, player_id)."""
    touched = set()
    for r in rows:
        if not norm_name(r.player_name):
            continue
        pid = resolve_player_id(r.team_code, r.player_name, first_name=r.first_name,
                                family_name=r.family_name, photo_url=r.photo_url)
        if r.player_id != pid:
            db.session.execute(update(PlayerGameStats).where(PlayerGameStats.id == r.id)
                               .values(player_id=pid))
        touched.add(pid)
    return touched


_COLS = (PlayerGameStats.id, PlayerGameStats.team_code, PlayerGameStats.player_name,
         PlayerGameStats.first_name, PlayerGameStats.family_name, PlayerGameStats.photo_url,
         PlayerGameStats.player_id)


def assign_game(game_id: str) -> int:
    """Hook de la ingesta: asocia a su ficha cada jugador de un partido. No hace commit."""
    db.session.flush()
    rows = db.session.query(*_COLS).filter(PlayerGameStats.game_id == game_id).all()
    touched = _assign(rows)
    db.session.flush()
    _refresh_display(touched)
    return len(rows)


def backfill_player_ids() -> int:
    """Completa `player_id` en las filas que no lo tienen. Idempotente: sin filas pendientes no
    hace nada. Se llama al arrancar (no desde `upgrade_db`: identity importa de database)."""
    total = 0
    while True:
        rows = (db.session.query(*_COLS)
                .join(Game, Game.game_id == PlayerGameStats.game_id, isouter=True)
                .filter(PlayerGameStats.player_id.is_(None))
                .order_by(Game.date, PlayerGameStats.game_id, PlayerGameStats.id)
                .limit(BACKFILL_BATCH).all())
        if not rows:
            break
        # una fila con nombre vacío no puede tener ficha: se saltea (y no se reintenta eternamente)
        valid = [r for r in rows if norm_name(r.player_name)]
        touched = _assign(valid)
        db.session.flush()
        _refresh_display(touched)
        db.session.commit()
        total += len(valid)
        if len(valid) < len(rows):
            break
    if total:
        try:
            import cache
            cache.bump_data_version("identity.backfill_player_ids")
        except Exception:
            pass
    return total


# ── Consultas por ficha ────────────────────────────────────────────────────

def group_key(row):
    """Clave para agrupar filas de un mismo jugador: su ficha, o (equipo, nombre normalizado) si la
    fila todavía no la tiene (no debería ocurrir tras `backfill_player_ids`). Acepta filas ORM o dicts
    (`repository.player_game_rows`)."""
    get = row.get if isinstance(row, dict) else lambda k: getattr(row, k)
    pid = get("player_id")
    return pid if pid is not None else (get("team_code"), norm_name(get("player_name")))


def aliases(player_id: int) -> list[str]:
    """Todas las grafías crudas con que aparece la ficha en `player_game_stats`."""
    pid = canonical_id(player_id)
    if pid is None:
        return []
    return sorted(n for (n,) in db.session.query(PlayerGameStats.player_name)
                  .filter(PlayerGameStats.player_id == pid).distinct())


def name_index(team_code: str) -> dict[str, int]:
    """{grafía cruda o normalizada → id canónico} de un equipo (memo por petición)."""
    cache = g.setdefault("_identity_name_index", {}) if has_request_context() else {}
    if team_code in cache:
        return cache[team_code]
    idx = {}
    for name, pid in (db.session.query(PlayerGameStats.player_name, PlayerGameStats.player_id)
                      .filter(PlayerGameStats.team_code == team_code,
                              PlayerGameStats.player_id.isnot(None)).distinct()):
        canon = canonical_id(pid)
        if canon is not None:
            idx[name] = canon
            idx.setdefault(norm_name(name), canon)
    cache[team_code] = idx
    return idx


def canonicalize_pbp_games(games: list[dict], team_code: str) -> list[dict]:
    """Copia de los partidos del equipo con UN nombre por jugador (el de su ficha) en eventos y
    filas de box. Garantiza que `lineups` vea al mismo jugador con cualquier grafía. No toca la base."""
    idx = name_index(team_code)
    display = {p.id: p.display_name for p in Player.query.filter_by(team_code=team_code).all()}

    def canon(name):
        if not name:
            return name
        pid = idx.get(name) or idx.get(norm_name(name))
        return display.get(pid, name) if pid is not None else name

    out = []
    for gm in games:
        events = [dict(ev, player_name=canon(ev.get("player_name")))
                  if ev.get("team_code") == team_code and ev.get("player_name") else ev
                  for ev in gm["events"]]
        rows = [SimpleNamespace(player_name=canon(r.player_name), team_code=r.team_code,
                                starter=r.starter, minutes=r.minutes)
                if r.team_code == team_code else r
                for r in gm["player_rows"]]
        out.append({**gm, "events": events, "player_rows": rows})
    return out


def player_card(player_id: int) -> dict | None:
    """Datos de la ficha canónica: identidad, posición estable, partidos, grafías."""
    pid = canonical_id(player_id)
    if pid is None:
        return None
    ficha = db.session.get(Player, pid)
    rows = (PlayerGameStats.query.join(Game, Game.game_id == PlayerGameStats.game_id)
            .filter(PlayerGameStats.player_id == pid)
            .order_by(Game.date, PlayerGameStats.game_id).all())
    _name, position = resolve_identity(rows)
    latest = rows[-1] if rows else None
    comp_ids = sorted({cid for (cid,) in db.session.query(Game.competition_id)
                       .join(PlayerGameStats, PlayerGameStats.game_id == Game.game_id)
                       .filter(PlayerGameStats.player_id == pid, Game.competition_id.isnot(None)).distinct()})
    return {
        "player_id": pid, "team_code": ficha.team_code,
        "team_name": latest.team_name if latest else None,
        "display_name": ficha.display_name,
        "position": position, "position_group": position_group(position),
        "jersey": (latest.jersey or None) if latest else None,
        "games": sum(1 for r in rows if played(r.minutes)),   # jugados (excluye DNP)
        "games_listed": len(rows),                            # convocatorias
        "first_name": ficha.first_name, "family_name": ficha.family_name, "photo_url": ficha.photo_url,
        "aliases": sorted({r.player_name for r in rows}),
        "competition_ids": comp_ids,
    }


# ── Duplicados y fusión ────────────────────────────────────────────────────

def _name_parts(display: str) -> tuple[str, str]:
    """(apellido, nombre de pila) del nombre normalizado, sin puntos: 'J. Feldeine' → ('feldeine', 'j')."""
    tokens = norm_name(display).replace(".", " ").split()
    if len(tokens) < 2:
        return (tokens[0] if tokens else ""), ""
    return tokens[-1], tokens[0]


def _common_prefix(a: str, b: str) -> int:
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def duplicate_candidates(competition_id: int | None) -> list[dict]:
    """Candidatos a fusión manual que la normalización tipográfica no unifica, y fichas que
    parecen reunir a personas distintas. Solo fichas canónicas con filas en la competencia."""
    q = (db.session.query(PlayerGameStats.player_id, PlayerGameStats.game_id, PlayerGameStats.jersey,
                          PlayerGameStats.minutes, PlayerGameStats.first_name, PlayerGameStats.family_name,
                          PlayerGameStats.photo_url, Game.date)
         .join(Game, Game.game_id == PlayerGameStats.game_id)
         .filter(PlayerGameStats.player_id.isnot(None)))
    if competition_id is not None:
        q = q.filter(Game.competition_id == competition_id)

    info = defaultdict(lambda: {"games": set(), "played": set(), "jerseys": set(), "dates": [],
                                "fulls": set()})
    for pid, gid, jersey, minutes, first, family, photo, date in q:
        cid = canonical_id(pid)
        if cid is None:   # player_id huérfano: no debería existir
            continue
        f = info[cid]
        f["games"].add(gid)
        if played(minutes):
            f["played"].add(gid)
        if jersey:
            f["jerseys"].add(jersey)
        if date:
            f["dates"].append(date)
        if first or family:
            f["fulls"].add((norm_name(first), norm_name(family)))

    fichas = {p.id: p for p in Player.query.filter(Player.id.in_(list(info))).all()} if info else {}

    def summary(pid):
        f, p = info[pid], fichas[pid]
        return {"player_id": pid, "name": p.display_name, "games": len(f["played"]),
                "jerseys": sorted(f["jerseys"]),
                "first_date": min(f["dates"]) if f["dates"] else None,
                "last_date": max(f["dates"]) if f["dates"] else None}

    items = []
    by_team = defaultdict(list)
    for pid, p in fichas.items():
        if p.merged_into is None:
            by_team[p.team_code].append(pid)
    for team, pids in by_team.items():
        pids.sort()
        for i, a in enumerate(pids):
            for b in pids[i + 1:]:
                if info[a]["games"] & info[b]["games"]:
                    continue   # coincidieron en un partido: son personas distintas
                reason = _pair_reason(fichas[a].display_name, info[a], fichas[b].display_name, info[b])
                if reason:
                    items.append({"kind": "candidato", "reason": reason, "team_code": team,
                                  "can_merge": True, "players": [summary(a), summary(b)]})
    for pid in sorted(info):
        p = fichas.get(pid)
        if not p or p.merged_into is not None:
            continue
        # Nombre completo informado y distinto entre partidos: la clave tipográfica pudo juntar a dos
        # personas ("P. Prieto"). La foto NO se compara: FIBA cambia la URL de la misma persona entre
        # partidos (en el seed, 23 de 187 fichas) y el aviso sería ruido.
        if len(info[pid]["fulls"]) > 1:
            items.append({"kind": "posible_fusion_incorrecta", "reason": "nombre_completo_distinto",
                          "team_code": p.team_code, "can_merge": False, "players": [summary(pid)]})
    items.sort(key=lambda it: (it["team_code"], it["kind"], it["reason"], it["players"][0]["name"]))
    return items


def _pair_reason(name_a, fa, name_b, fb) -> str | None:
    sa, ga = _name_parts(name_a)
    sb, gb = _name_parts(name_b)
    if sa and sa == sb and ga and gb and ga[0] == gb[0] and (len(ga) == 1 or len(gb) == 1):
        return "apellido_inicial"
    if fa["jerseys"] & fb["jerseys"] and _common_prefix(sa, sb) >= 4:
        return "dorsal_apellido"
    return None


def merge_players(target_id: int, source_id: int) -> dict:
    """Une la ficha `source` en `target` (mismo equipo). Las filas de `source` pasan a `target`;
    `source.merged_into` conserva el rastro (la fusión es reversible por datos). No hace commit."""
    t, s = canonical_id(target_id), canonical_id(source_id)
    if t is None or s is None:
        raise IdentityError("Jugador no encontrado", 404)
    if t == s:
        raise IdentityError("No se puede unificar una ficha consigo misma", 400)
    ft, fs = db.session.get(Player, t), db.session.get(Player, s)
    if ft.team_code != fs.team_code:
        raise IdentityError("Solo se pueden unificar fichas del mismo equipo", 409)
    db.session.execute(update(Player).where((Player.id == s) | (Player.merged_into == s))
                       .values(merged_into=t))   # aplana la cadena: lo absorbido por s ahora apunta a t
    moved = db.session.execute(update(PlayerGameStats).where(PlayerGameStats.player_id == s)
                               .values(player_id=t)).rowcount
    for col in ("first_name", "family_name", "photo_url"):
        if not getattr(ft, col) and getattr(fs, col):
            setattr(ft, col, getattr(fs, col))
    db.session.flush()
    _refresh_display([t])
    db.session.flush()
    return {"player": player_card(t), "merged": {"source_id": s, "rows_moved": moved}}
