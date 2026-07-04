"""
Auth smoke tests — Flask test client. Run: python test_auth.py
No pytest needed; plain asserts + prints. Exits non-zero on failure.
"""
import os
from werkzeug.security import generate_password_hash

# Configure auth BEFORE importing app (secret_key/env read at import).
os.environ["AUTH_USERS"] = '{"nico": "%s"}' % generate_password_hash("clave123")
os.environ.pop("SESSION_SECURE", None)  # allow cookie over http in tests

import app as A
import auth


def _reset_auth_cache():
    auth._users_cache = None
    auth._fails.clear()


def run():
    # ── Scenario A: auth enabled ──────────────────────────────────────────────
    os.environ["AUTH_USERS"] = '{"nico": "%s"}' % generate_password_hash("clave123")
    _reset_auth_cache()
    c = A.app.test_client()

    assert c.get("/api/league").status_code == 401, "ruta gateada sin sesión debe dar 401"
    assert c.get("/api/me").get_json()["auth_required"] is True
    assert c.get("/api/me").get_json()["authenticated"] is False

    assert c.post("/api/login", json={"user": "nico", "password": "mala"}).status_code == 401, "clave incorrecta → 401"
    assert c.post("/api/login", json={"user": "nico", "password": "clave123"}).status_code == 200, "clave correcta → 200"
    assert c.get("/api/me").get_json()["authenticated"] is True
    assert c.get("/api/league").status_code == 200, "con sesión la ruta debe dar 200"

    assert c.post("/api/logout").status_code == 200
    assert c.get("/api/league").status_code == 401, "tras logout debe dar 401"
    print("OK  escenario auth habilitado")

    # ── Scenario rate limit: 5 fallos permitidos, 6º bloqueado ────────────────
    _reset_auth_cache()
    c2 = A.app.test_client()
    for i in range(5):
        r = c2.post("/api/login", json={"user": "nico", "password": "x"})
        assert r.status_code == 401, f"intento {i+1} debe ser 401, fue {r.status_code}"
    r = c2.post("/api/login", json={"user": "nico", "password": "x"})
    assert r.status_code == 429, f"6º intento debe ser 429 (rate-limit), fue {r.status_code}"
    print("OK  rate-limit (5 fallos -> 429)")

    # ── Scenario B: auth deshabilitado (sin AUTH_USERS) ───────────────────────
    os.environ.pop("AUTH_USERS", None)
    _reset_auth_cache()
    c3 = A.app.test_client()
    assert c3.get("/api/me").get_json()["auth_required"] is False
    assert c3.get("/api/league").status_code == 200, "sin auth, ruta abierta debe dar 200"
    print("OK  escenario auth deshabilitado (app abierta)")

    print("\nTODOS LOS TESTS OK")


if __name__ == "__main__":
    run()
