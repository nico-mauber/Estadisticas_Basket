"""
Fetches FIBA LiveStats data.

Strategy:
1. Extract game ID from the LiveStats URL.
2. Construct the direct data.json URL (no browser needed).
3. Fetch with browser-like headers via requests.
4. Fall back to Playwright if requests gets a 403.
"""
import re
import json
import urllib.request
import urllib.error
try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False


_ALLOWED_HOST = "fibalivestats.dcd.shared.geniussports.com"
_ALLOWED_BASE = f"https://{_ALLOWED_HOST}"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-UY,es;q=0.9,en;q=0.8",
}


def _extract_game_id(url: str) -> str:
    """Extract numeric game ID from a FIBA LiveStats URL."""
    m = re.search(r"/(\d{5,})/", url)
    if m:
        return m.group(1)
    raise ValueError(f"No se pudo extraer el game ID de: {url}")


def _data_url(url: str) -> str:
    """Convert a bs.html URL to its data.json URL."""
    game_id = _extract_game_id(url)
    m = re.match(r"https?://([^/]+)", url)
    if not m or m.group(1) != _ALLOWED_HOST:
        raise ValueError(
            f"URL no permitida. Solo se aceptan URLs de {_ALLOWED_HOST}."
        )
    return f"{_ALLOWED_BASE}/data/{game_id}/data.json"


def _fetch_direct(data_url: str, referer: str) -> dict:
    """Fetch data.json with urllib and browser-like headers."""
    req = urllib.request.Request(data_url, headers={**_HEADERS, "Referer": referer})
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw = resp.read()
    return json.loads(raw)


def _fetch_game_date(page_url: str) -> str:
    """Extract game date from the bs.html page (DD/MM/YY or DD/MM/YYYY pattern)."""
    m_host = re.match(r"https?://([^/]+)", page_url)
    if not m_host or m_host.group(1) != _ALLOWED_HOST:
        return ""
    try:
        req = urllib.request.Request(page_url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        m = re.search(r"(\d{1,2})[./](\d{1,2})[./](\d{2,4})", html)
        if m:
            d, mo, y = m.group(1), m.group(2), m.group(3)
            if len(y) == 2:
                y = "20" + y
            return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    except Exception:
        pass
    return ""


def _fetch_playwright(data_url: str) -> dict:
    """Fetch data.json by navigating directly to the JSON URL in Chromium."""
    result = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=_HEADERS["User-Agent"],
            extra_http_headers={"Accept": _HEADERS["Accept"]},
        )
        page = ctx.new_page()

        def on_response(resp):
            if resp.url == data_url and resp.status == 200:
                try:
                    result["data"] = resp.json()
                except Exception:
                    pass

        page.on("response", on_response)
        try:
            page.goto(data_url, wait_until="networkidle", timeout=20000)
        except PWTimeout:
            pass

        if not result:
            # Last resort: read page body as JSON
            try:
                text = page.content()
                # Strip HTML wrapper if present
                m = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
                if m:
                    result["data"] = json.loads(m.group(1))
            except Exception:
                pass

        browser.close()

    if not result:
        raise RuntimeError("Playwright no pudo obtener datos de FIBA LiveStats.")
    return result["data"]


def fetch_game_data(url: str) -> dict:
    """
    Main entry point. Accepts any FIBA LiveStats bs.html URL.
    Returns a normalised game dict ready for DB insertion.
    """
    data_url = _data_url(url)

    # Try direct HTTP first (faster, no browser overhead)
    raw = None
    try:
        raw = _fetch_direct(data_url, referer=url)
    except (urllib.error.HTTPError, urllib.error.URLError, Exception):
        pass

    if raw is None:
        if not _PLAYWRIGHT_AVAILABLE:
            raise RuntimeError("No se pudo obtener datos de FIBA LiveStats (urllib falló y Playwright no está disponible).")
        raw = _fetch_playwright(data_url)

    game = _parse_fiba_json(raw, url)

    # Date not in JSON — extract from HTML page
    if not game.get("date"):
        game["date"] = _fetch_game_date(url)

    return game


# ── Parser ────────────────────────────────────────────────────────────────

def _parse_fiba_json(raw: dict, source_url: str = "") -> dict:
    """
    Normalise FIBA LiveStats data.json into a flat game dict.
    Verified key structure from live FUBB data:
      - Team totals are flat on the team dict with prefix tot_s*
      - Player stats are flat on the player dict with prefix s*
      - Players stored under tm[n]['pl'][player_id]
    """
    game_id = _extract_game_id(source_url) if source_url else raw.get("gid", "unknown")

    game = {
        "game_id":     game_id,
        "competition": raw.get("competition") or raw.get("comp") or "",
        "date":        raw.get("gdate") or raw.get("date") or "",
        "teams":       [],
        "players":     [],
        "shots":       [],
    }

    teams_raw = raw.get("tm") or {}
    if not isinstance(teams_raw, dict):
        raise RuntimeError("Estructura JSON inesperada: 'tm' no es un dict.")

    # Maps for enriching shots with team_code and player_name
    tno_to_code = {}      # tno (int) → team_code
    shirt_to_name = {}    # (tno, shirtNumber str) → player_name

    for i, (tk, t) in enumerate(teams_raw.items()):
        is_home = (i == 0)
        tno = int(tk) if str(tk).isdigit() else (i + 1)

        # Team totals are flat on t with prefix "tot_s"
        def ti(suffixes):
            for s in suffixes:
                v = t.get("tot_s" + s) or t.get(s)
                if v is not None:
                    try: return int(float(str(v)))
                    except: pass
            return 0

        team_code = (t.get("code") or t.get("codeInternational") or t.get("shortName") or f"T{tk}").strip().upper()
        tno_to_code[tno] = team_code

        team_row = {
            "team_code": team_code,
            "team_name": t.get("name") or t.get("tn") or f"Team{tk}",
            "is_home":   int(is_home),
            "pts":  ti(["Points", "score"]) or _i(t, ["score", "pts"]),
            "fgm2": ti(["TwoPointersMade"]),
            "fga2": ti(["TwoPointersAttempted"]),
            "fgm3": ti(["ThreePointersMade"]),
            "fga3": ti(["ThreePointersAttempted"]),
            "ftm":  ti(["FreeThrowsMade"]),
            "fta":  ti(["FreeThrowsAttempted"]),
            "orb":  ti(["ReboundsOffensive"]),
            "drb":  ti(["ReboundsDefensive"]),
            "trb":  ti(["ReboundsTotal"]),
            "ast":  ti(["Assists"]),
            "tov":  ti(["Turnovers"]),
            "stl":  ti(["Steals"]),
            "blk":  ti(["Blocks"]),
            "pf":   ti(["FoulsPersonal"]),
        }
        team_row["fgm"] = team_row["fgm2"] + team_row["fgm3"]
        team_row["fga"] = team_row["fga2"] + team_row["fga3"]
        if not team_row["trb"]:
            team_row["trb"] = team_row["orb"] + team_row["drb"]
        if not team_row["pts"]:
            team_row["pts"] = _i(t, ["score", "pts", "tot_sPoints"])

        game["teams"].append(team_row)

        # Players — stats are flat on player dict with prefix "s"
        players_raw = t.get("pl") or {}
        if isinstance(players_raw, dict):
            for pk, p in players_raw.items():
                def pi(suffixes):
                    for s in suffixes:
                        v = p.get("s" + s) or p.get(s)
                        if v is not None:
                            try: return int(float(str(v)))
                            except: pass
                    return 0

                full_name = (
                    p.get("name") or
                    ((p.get("firstName") or p.get("internationalFirstName") or "") + " " +
                     (p.get("familyName") or p.get("internationalFamilyName") or "")).strip() or
                    p.get("scoreboardName") or f"Player{pk}"
                )
                player_row = {
                    "team_code":   team_code,
                    "team_name":   team_row["team_name"],
                    "player_name": full_name,
                    "jersey":      str(p.get("shirtNumber") or ""),
                    "minutes":     str(p.get("sMinutes") or p.get("Min") or "0:00"),
                    "pts":  pi(["Points"]),
                    "fgm2": pi(["TwoPointersMade"]),
                    "fga2": pi(["TwoPointersAttempted"]),
                    "fgm3": pi(["ThreePointersMade"]),
                    "fga3": pi(["ThreePointersAttempted"]),
                    "ftm":  pi(["FreeThrowsMade"]),
                    "fta":  pi(["FreeThrowsAttempted"]),
                    "orb":  pi(["ReboundsOffensive"]),
                    "drb":  pi(["ReboundsDefensive"]),
                    "trb":  pi(["ReboundsTotal"]),
                    "ast":  pi(["Assists"]),
                    "tov":  pi(["Turnovers"]),
                    "stl":  pi(["Steals"]),
                    "blk":  pi(["Blocks"]),
                    "pf":   pi(["FoulsPersonal"]),
                }
                player_row["fgm"] = player_row["fgm2"] + player_row["fgm3"]
                player_row["fga"] = player_row["fga2"] + player_row["fga3"]
                if not player_row["trb"]:
                    player_row["trb"] = player_row["orb"] + player_row["drb"]
                game["players"].append(player_row)

                # Map jersey → full name for shot enrichment
                jersey = str(p.get("shirtNumber") or "")
                if jersey:
                    shirt_to_name[(tno, jersey)] = full_name

    # Prefer top-level shot array (has x/y coordinates); fall back to pbp (no coordinates)
    shot_array = raw.get("shot") or []
    if shot_array:
        for shot in shot_array:
            if not isinstance(shot, dict):
                continue
            action = shot.get("actionType") or ""
            if action not in ("2pt", "3pt"):
                continue
            s_tno  = int(shot.get("tno") or 0)
            shirt  = str(shot.get("shirtNumber") or "")
            player = shirt_to_name.get((s_tno, shirt)) or shot.get("player") or ""
            tc     = tno_to_code.get(s_tno, "")
            if not tc:
                continue
            game["shots"].append({
                "team_code":     tc,
                "player_name":   player,
                "x":             float(shot.get("x") or 0),
                "y":             float(shot.get("y") or 0),
                "made":          int(shot.get("r") or 0),      # 'r' in shot array (not 'success')
                "action_type":   action,
                "sub_type":      shot.get("subType") or "",
                "period":        int(shot.get("per") or 0),    # 'per' in shot array (not 'period')
                "action_number": int(shot.get("actionNumber") or 0),
            })
    else:
        for shot in raw.get("pbp", []):
            if not isinstance(shot, dict):
                continue
            action = shot.get("actionType") or ""
            if action not in ("2pt", "3pt"):
                continue
            s_tno  = int(shot.get("tno") or 0)
            shirt  = str(shot.get("shirtNumber") or "")
            player = shirt_to_name.get((s_tno, shirt)) or shot.get("player") or ""
            tc     = tno_to_code.get(s_tno, "")
            if not tc:
                continue
            game["shots"].append({
                "team_code":     tc,
                "player_name":   player,
                "x":             0.0,
                "y":             0.0,
                "made":          int(shot.get("success") or 0),
                "action_type":   action,
                "sub_type":      shot.get("subType") or "",
                "period":        int(shot.get("period") or 0),
                "action_number": int(shot.get("actionNumber") or 0),
            })

    # Cross-fill opponent stats
    if len(game["teams"]) == 2:
        a, b = game["teams"]
        a["opp_pts"] = b["pts"]; b["opp_pts"] = a["pts"]
        a["opp_fga2"] = b["fga2"]; b["opp_fga2"] = a["fga2"]
        a["opp_fga3"] = b["fga3"]; b["opp_fga3"] = a["fga3"]
        a["opp_fta"]  = b["fta"];  b["opp_fta"]  = a["fta"]
        a["opp_orb"]  = b["orb"];  b["opp_orb"]  = a["orb"]
        a["opp_drb"]  = b["drb"];  b["opp_drb"]  = a["drb"]
        a["opp_tov"]  = b["tov"];  b["opp_tov"]  = a["tov"]
        game["home_team"]  = a["team_name"]
        game["home_code"]  = a["team_code"]
        game["away_team"]  = b["team_name"]
        game["away_code"]  = b["team_code"]
        game["home_score"] = a["pts"]
        game["away_score"] = b["pts"]

    return game


def _has_stat_keys(d: dict) -> bool:
    stat_keys = {"Pts", "pts", "Fg2M", "fg2m", "Fg3M", "fg3m", "Ftm", "ftm"}
    return bool(stat_keys & d.keys())


def _i(d: dict, keys: list, default: int = 0) -> int:
    for k in keys:
        v = d.get(k)
        if v is not None:
            try:
                return int(float(str(v)))
            except (ValueError, TypeError):
                pass
    return default
