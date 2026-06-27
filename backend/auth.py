"""
Authentication: env-var credentials + Flask server-side session.

Single auth system, differentiated only by environment config:
  - AUTH_USERS  — JSON map {"user": "<pbkdf2 hash>"}. Presence enables auth.
  - SECRET_KEY  — signs the session cookie (set per service on Render).
  - SESSION_SECURE — "true" to mark the cookie Secure (HTTPS only).

No users table: credentials live in AUTH_USERS so they survive redeploys on
both dev (ephemeral disk) and prod alike. Generate a hash with:

    python -c "from werkzeug.security import generate_password_hash as g; print(g('miclave'))"
"""
import os
import json
import time
import logging
from functools import wraps

from flask import session, jsonify, request
from werkzeug.security import check_password_hash

log = logging.getLogger(__name__)

_users_cache = None  # parsed once; None = not yet parsed


def load_users() -> dict:
    """Parse AUTH_USERS env (JSON user->hash). Cached. Fail-closed on bad JSON."""
    global _users_cache
    if _users_cache is not None:
        return _users_cache

    raw = os.environ.get("AUTH_USERS", "").strip()
    if not raw:
        _users_cache = {}
        return _users_cache

    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError("AUTH_USERS no es un objeto JSON")
        _users_cache = {str(k): str(v) for k, v in parsed.items()}
    except Exception as e:
        # Fail-closed: bad config => no valid users => nobody can log in.
        log.error("AUTH_USERS mal configurado (%s). Auth queda bloqueado.", e)
        _users_cache = {"__invalid__": "x"}  # non-empty => auth required, but no real login works
    return _users_cache


def auth_enabled() -> bool:
    """True when at least one credential is configured."""
    return bool(load_users())


def verify(user: str, password: str) -> bool:
    """Validate user/password against the stored hash."""
    users = load_users()
    h = users.get(user)
    if not h:
        return False
    try:
        return check_password_hash(h, password)
    except Exception:
        return False


# ── Rate limiting (in-memory, per IP) ────────────────────────────────────────
_MAX_FAILS = 5
_WINDOW = 60  # seconds
_fails: dict[str, list] = {}  # ip -> [count, window_start_ts]


def _now() -> float:
    return time.time()


def check_rate_limit(ip: str) -> bool:
    """Return True if the IP may still attempt a login (not locked out)."""
    entry = _fails.get(ip)
    if not entry:
        return True
    count, start = entry
    if _now() - start >= _WINDOW:
        _fails.pop(ip, None)  # window expired, reset
        return True
    return count < _MAX_FAILS


def register_fail(ip: str) -> None:
    """Record a failed attempt for the IP."""
    entry = _fails.get(ip)
    if not entry or (_now() - entry[1] >= _WINDOW):
        _fails[ip] = [1, _now()]
    else:
        entry[0] += 1


def clear_fails(ip: str) -> None:
    _fails.pop(ip, None)


# ── Decorator ────────────────────────────────────────────────────────────────

def login_required(fn):
    """Gate a route: 401 if auth is enabled and there's no active session."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if auth_enabled() and "user" not in session:
            return jsonify({"error": "No autenticado"}), 401
        return fn(*args, **kwargs)
    return wrapper


def client_ip() -> str:
    """Best-effort client IP (Render sits behind a proxy)."""
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "unknown"
