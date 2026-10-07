"""Preferencias personales por usuario de sesión — F-13.

Cada preferencia pertenece a un (owner, scope, key). Solo el dueño puede leer/escribir
las suyas. No afecta cálculos compartidos.
"""
import json
from datetime import datetime, timezone

from flask import session
from database import db

PREF_SCOPES = {
    "table.columns": None,
    "table.sort": None,
    "table.colorize": None,
    "panel.collapsed": None,
    "ui": {"language", "home_team", "followed_players", "last_competition"},
}

MAX_VALUE_BYTES = 8192


def current_owner() -> str:
    from auth import auth_enabled
    if auth_enabled():
        return session.get("user", "_open")
    return "_open"


def get_prefs(scope: str) -> dict:
    if scope not in PREF_SCOPES:
        raise ValueError("Ámbito de preferencia inválido")
    owner = current_owner()
    rows = db.session.execute(
        db.text("SELECT key, value FROM user_prefs WHERE owner = :o AND scope = :s"),
        {"o": owner, "s": scope}
    ).fetchall()
    result = {}
    for key, raw in rows:
        try:
            result[key] = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            pass
    return result


def set_pref(scope: str, key: str, value) -> None:
    if scope not in PREF_SCOPES:
        raise ValueError("Ámbito de preferencia inválido")
    allowed = PREF_SCOPES[scope]
    if allowed is not None and key not in allowed:
        raise ValueError(f"Clave '{key}' no permitida en ámbito '{scope}'")
    if not key or len(key) > 64:
        raise ValueError("Clave vacía o demasiado larga (máx 64 caracteres)")

    raw = json.dumps(value)
    if len(raw.encode("utf-8")) > MAX_VALUE_BYTES:
        raise ValueError(f"Valor demasiado grande (máx {MAX_VALUE_BYTES} bytes)")

    owner = current_owner()
    now = datetime.now(timezone.utc).isoformat()

    existing = db.session.execute(
        db.text("SELECT owner FROM user_prefs WHERE owner = :o AND scope = :s AND key = :k"),
        {"o": owner, "s": scope, "k": key}
    ).fetchone()

    if existing:
        db.session.execute(db.text(
            "UPDATE user_prefs SET value = :v, updated_at = :t WHERE owner = :o AND scope = :s AND key = :k"
        ), {"o": owner, "s": scope, "k": key, "v": raw, "t": now})
    else:
        db.session.execute(db.text(
            "INSERT INTO user_prefs (owner, scope, key, value, updated_at) VALUES (:o, :s, :k, :v, :t)"
        ), {"o": owner, "s": scope, "k": key, "v": raw, "t": now})
    db.session.commit()


def delete_pref(scope: str, key: str) -> bool:
    if scope not in PREF_SCOPES:
        raise ValueError("Ámbito de preferencia inválido")
    owner = current_owner()
    result = db.session.execute(
        db.text("DELETE FROM user_prefs WHERE owner = :o AND scope = :s AND key = :k"),
        {"o": owner, "s": scope, "k": key}
    )
    db.session.commit()
    return result.rowcount > 0
