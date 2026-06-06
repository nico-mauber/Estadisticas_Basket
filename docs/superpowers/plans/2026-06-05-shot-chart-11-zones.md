# Shot Chart 11 Zonas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 4-zone player shot chart with an 11-zone chart matching the reference image, adding P/F metric, frequency count, and a global summary badge.

**Architecture:** Two independent changes — backend (new zone classifier + updated API response) and frontend (new SVG generator). Backend is implemented first so the frontend has real data to render. The existing `_classify_zone` function stays in place (it is not called anywhere else), and a new `_classify_zone_11` function is added. The `player_shots` endpoint is rewritten in-place.

**Tech Stack:** Python 3.11 / Flask-SQLAlchemy (backend), Vanilla JS ES6 SVG (frontend)

---

## File Map

| File | Change |
|------|--------|
| `backend/app.py` | Add `_classify_zone_11`, `ZONE_KEYS_11`, `ZONE_POINTS`; rewrite `player_shots()` |
| `frontend/js/app.js` | Replace `_shotChartSVG()` (lines ~686–827) |
| `frontend/sw.js` | Bump cache version to `courtiq-v12` |

---

## Task 1 — Backend: zone classifier + updated endpoint

**Files:**
- Modify: `backend/app.py` (after `_classify_zone`, around line 47; and `player_shots` at line 405)

- [ ] **Step 1.1 — Add constants and classifier after `_classify_zone`**

In `backend/app.py`, insert the following block immediately after the `_classify_zone` function (after line 47):

```python
_PAINT_KWORDS = {"layup", "dunk", "alley", "tip", "hook", "putback", "driving", "fingerroll"}

ZONE_KEYS_11 = [
    "restricted_area",
    "mid_left_close", "mid_right_close",
    "mid_left_far",   "mid_right_far",   "mid_top",
    "left_corner_3",  "right_corner_3",
    "left_wing_3",    "right_wing_3",    "top_key_3",
]

ZONE_POINTS = {
    "restricted_area": 2, "mid_left_close": 2, "mid_right_close": 2,
    "mid_left_far": 2,    "mid_right_far": 2,   "mid_top": 2,
    "left_corner_3": 3,   "right_corner_3": 3,
    "left_wing_3": 3,     "right_wing_3": 3,    "top_key_3": 3,
}

_2PT_ZONES = {"restricted_area", "mid_left_close", "mid_right_close",
              "mid_left_far", "mid_right_far", "mid_top"}
_3PT_ZONES = {"left_corner_3", "right_corner_3", "left_wing_3",
              "right_wing_3", "top_key_3"}


def _classify_zone_11(action_type: str, sub_type: str, x: float = 0, y: float = 0) -> str:
    """
    Classify a shot into one of 11 zones.

    Coordinate system (FIBA LiveStats normalized):
      x: 0–100, center=50, left<50
      y: 0–100, baseline=0, increases away from basket

    Zone geometry matches SVG rendering:
      restricted_area  = full paint box (x 34–66)
      mid_left_close   = outside paint left, near baseline (x<34, y<25)
      mid_right_close  = outside paint right, near baseline (x>66, y<25)
      mid_left_far     = left elbow / wing mid (x<42, y≥25)
      mid_right_far    = right elbow (x≥58, y≥25)
      mid_top          = high post center (x 42–58, y≥25)
    """
    sub       = (sub_type or "").lower()
    has_coord = x != 0 or y != 0

    if action_type == "3pt":
        if has_coord and y < 14:
            return "left_corner_3" if x < 50 else "right_corner_3"
        if not has_coord:
            return "top_key_3"
        if x < 38:
            return "left_wing_3"
        if x >= 62:
            return "right_wing_3"
        return "top_key_3"

    # 2pt — paint keywords always → restricted area
    paint_sub = any(k in sub for k in _PAINT_KWORDS)
    if paint_sub:
        return "restricted_area"

    if has_coord:
        # Inside paint box (lane lines x ≈ 34–66)
        if 34 <= x <= 66:
            return "restricted_area"
        # Outside paint, near baseline
        if y < 25:
            return "mid_left_close" if x < 50 else "mid_right_close"
        # Mid-range above baseline
        if x < 42:
            return "mid_left_far"
        if x >= 58:
            return "mid_right_far"
        return "mid_top"

    return "mid_top"
```

- [ ] **Step 1.2 — Rewrite `player_shots` endpoint**

Replace the entire `player_shots` function in `backend/app.py` (lines 405–444) with:

```python
@app.route("/api/shots/<team_code>/<player_name>")
def player_shots(team_code: str, player_name: str):
    team_code = team_code.upper()
    rows = Shot.query.filter_by(team_code=team_code, player_name=player_name).all()

    zones = {k: {"made": 0, "attempts": 0} for k in ZONE_KEYS_11}
    for row in rows:
        z = _classify_zone_11(row.action_type, row.sub_type, row.x or 0, row.y or 0)
        zones[z]["attempts"] += 1
        zones[z]["made"]     += row.made

    total_fga = sum(z["attempts"] for z in zones.values())
    total_pts = sum(zones[k]["made"] * ZONE_POINTS[k] for k in ZONE_KEYS_11)
    fgm2 = sum(zones[k]["made"]     for k in _2PT_ZONES)
    fgm3 = sum(zones[k]["made"]     for k in _3PT_ZONES)

    for k, z in zones.items():
        if z["attempts"]:
            z["pct"] = round(z["made"] / z["attempts"], 4)
            z["pf"]  = round(z["made"] * ZONE_POINTS[k] / z["attempts"], 3)
        else:
            z["pct"] = None
            z["pf"]  = None

    games = db.session.query(Shot.game_id).filter_by(
        team_code=team_code, player_name=player_name
    ).distinct().count()

    summary = {
        "global_pf": round(total_pts / total_fga, 3) if total_fga else None,
        "efg_pct":   round((fgm2 + 1.5 * fgm3) / total_fga, 4) if total_fga else None,
        "games":     games,
    }

    return jsonify({
        "zones":       zones,
        "total_shots": total_fga,
        "summary":     summary,
    })
```

- [ ] **Step 1.3 — Verify backend starts**

```bash
cd backend && python app.py
```

Expected: Flask starts on port 5000 with no import errors.

- [ ] **Step 1.4 — Smoke-test the endpoint**

```bash
curl "http://localhost:5000/api/shots/FUBB/PLAYER_NAME_HERE"
```

Replace `FUBB` and `PLAYER_NAME_HERE` with any team/player from `GET /api/games`.
Expected response shape:
```json
{
  "zones": {
    "restricted_area": {"made": 5, "attempts": 9, "pct": 0.5556, "pf": 1.111},
    "mid_left_close":  {"made": 1, "attempts": 3, "pct": 0.3333, "pf": 0.667},
    ...
  },
  "total_shots": 28,
  "summary": {"global_pf": 0.893, "efg_pct": 0.4643, "games": 2}
}
```

- [ ] **Step 1.5 — Commit**

```bash
git add backend/app.py
git commit -m "feat: 11-zone shot classifier + updated player_shots endpoint"
```

---

## Task 2 — Frontend: new SVG shot chart

**Files:**
- Modify: `frontend/js/app.js` — replace `_shotChartSVG` function (lines ~686–827)
- Modify: `frontend/sw.js` — bump cache version

- [ ] **Step 2.1 — Replace `_shotChartSVG` in `frontend/js/app.js`**

Delete the entire `_shotChartSVG` function (from `// ── Shot chart SVG` comment through closing `}`) and replace with:

```javascript
// ── Shot chart SVG — half court, 11 zones (P/F color coding) ──────────────
function _shotChartSVG(zones, totalShots, summary) {
  const W = 340, H = 320;
  // Court geometry (basket at bottom-center, shooting UP, ~20px/m)
  const cx = 170, cy = 256;
  const cL = 20, cR = 320, cT = 8, cB = 288;
  const r3 = 135, rP = 50;
  const pbX1 = 121, pbX2 = 219, pbTop = 140; // paint box
  // Corner 3: straight line 0.9m from sideline, meets arc at c3yJoin
  const c3xL = 38, c3xR = 302;
  const c3yJoin = Math.round(cy - Math.sqrt(r3 * r3 - (cx - c3xL) ** 2)); // ≈228
  // Wing/top-key split at ±75px (3.75m) from center
  const wingX = 75;
  const c3TopY = Math.round(cy - Math.sqrt(r3 * r3 - wingX * wingX));      // ≈144

  const courtBg = "#162032", line = "#374151", muted = "#6b7280";

  // Color by P/F value (absolute thresholds)
  function zFill(key) {
    const z = zones?.[key];
    if (!z?.attempts) return courtBg;
    const pf = z.pf;
    if (pf >= 1.05) return "rgba(22,163,74,0.80)";
    if (pf >= 0.90) return "rgba(101,163,13,0.72)";
    if (pf >= 0.70) return "rgba(234,88,12,0.72)";
    return "rgba(220,38,38,0.82)";
  }

  // Half-circle (above basket, r from basket center)
  const hCirc = r => `M${cx - r},${cy} A${r},${r} 0 0,0 ${cx + r},${cy} Z`;
  // Half-ring (above basket)
  const hRing = (r1, r2) =>
    `M${cx-r2},${cy} A${r2},${r2} 0 0,0 ${cx+r2},${cy} L${cx+r1},${cy} A${r1},${r1} 0 0,1 ${cx-r1},${cy} Z`;

  // Zone label card: lx,ly = center of card
  function lbl(key, lx, ly) {
    const z = zones?.[key];
    if (!z?.attempts) return '';
    const pct = (z.pct * 100).toFixed(1) + '%';
    const pf  = z.pf.toFixed(2);
    const bg  = zFill(key);
    const w = 58, h = 38, r = 4;
    const x0 = lx - w / 2, y0 = ly - h / 2;
    return `
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="${bg}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
      <text x="${lx - 6}" y="${ly - 5}" text-anchor="end"   fill="rgba(255,255,255,0.75)" font-size="9" font-family="Inter,sans-serif">${z.attempts}</text>
      <text x="${lx + 4}" y="${ly - 5}" text-anchor="start" fill="rgba(255,255,255,0.75)" font-size="9" font-family="Inter,sans-serif">${pf}</text>
      <text x="${lx}"     y="${ly + 11}" text-anchor="middle" fill="#fff" font-size="14" font-weight="800" font-family="Inter,sans-serif">${pct}</text>`;
  }

  // Summary badge (top-right)
  function badge() {
    if (!summary) return '';
    const pf  = summary.global_pf  != null ? summary.global_pf.toFixed(2)          : '—';
    const efg = summary.efg_pct    != null ? (summary.efg_pct * 100).toFixed(1)+'%': '—';
    const g   = summary.games ?? 0;
    return `
      <rect x="${cR - 116}" y="${cT}"     width="56" height="22" rx="3" fill="rgba(234,88,12,0.90)"/>
      <text x="${cR - 88}"  y="${cT+14}"  text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="Inter,sans-serif">P/F ${pf}</text>
      <rect x="${cR - 58}"  y="${cT}"     width="56" height="22" rx="3" fill="rgba(101,163,13,0.90)"/>
      <text x="${cR - 30}"  y="${cT+14}"  text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="Inter,sans-serif">eFG ${efg}</text>
      <circle cx="${cR - 4}" cy="${cT+11}" r="11" fill="#374151"/>
      <text   x="${cR - 4}"  y="${cT+15}" text-anchor="middle" fill="#e2e8f0" font-size="9" font-weight="700" font-family="Inter,sans-serif">${g}P</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:420px;margin:0 auto;display:block;border-radius:8px">
    <defs>
      <clipPath id="sc-clip">
        <rect x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}"/>
      </clipPath>
      <clipPath id="sc-left">
        <rect x="${cL}" y="${cT}" width="${cx-cL}" height="${cB-cT}"/>
      </clipPath>
      <clipPath id="sc-right">
        <rect x="${cx}" y="${cT}" width="${cR-cx}" height="${cB-cT}"/>
      </clipPath>
      <clipPath id="sc-ctr">
        <rect x="${cx-wingX}" y="${cT}" width="${wingX*2}" height="${cB-cT}"/>
      </clipPath>
    </defs>

    <!-- Background -->
    <rect width="${W}" height="${H}" fill="#0d1117" rx="8"/>
    <rect x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}" fill="${courtBg}" rx="3"/>

    <!-- ── ZONE FILLS (back → front) ── -->

    <!-- 3pt zones: tile the full court then inner zones overwrite -->
    <rect x="${cx-wingX}" y="${cT}" width="${wingX*2}"  height="${cB-cT}" fill="${zFill('top_key_3')}"    clip-path="url(#sc-clip)"/>
    <rect x="${cL}"        y="${cT}" width="${cx-cL}"    height="${cB-cT}" fill="${zFill('left_wing_3')}"  clip-path="url(#sc-left)"/>
    <rect x="${cx}"        y="${cT}" width="${cR-cx}"    height="${cB-cT}" fill="${zFill('right_wing_3')}" clip-path="url(#sc-right)"/>

    <!-- Corner 3 overwrites wing base -->
    <rect x="${cL}"   y="${c3yJoin}" width="${c3xL-cL}"   height="${cB-c3yJoin}" fill="${zFill('left_corner_3')}"  clip-path="url(#sc-clip)"/>
    <rect x="${c3xR}" y="${c3yJoin}" width="${cR-c3xR}"   height="${cB-c3yJoin}" fill="${zFill('right_corner_3')}" clip-path="url(#sc-clip)"/>

    <!-- Mid-range half-rings (overwrite 3pt fills inside the arc) -->
    <path d="${hRing(rP, r3)}" fill="${zFill('mid_left_far')}"  clip-path="url(#sc-left)"/>
    <path d="${hRing(rP, r3)}" fill="${zFill('mid_right_far')}" clip-path="url(#sc-right)"/>
    <path d="${hRing(rP, r3)}" fill="${zFill('mid_top')}"       clip-path="url(#sc-ctr)"/>

    <!-- Low block strips: outside paint, between corner line and lane line, below basket -->
    <rect x="${c3xL}" y="${cy}" width="${pbX1-c3xL}" height="${cB-cy}" fill="${zFill('mid_left_close')}"  clip-path="url(#sc-clip)"/>
    <rect x="${pbX2}" y="${cy}" width="${c3xR-pbX2}" height="${cB-cy}" fill="${zFill('mid_right_close')}" clip-path="url(#sc-clip)"/>

    <!-- Restricted area: full paint box (arc above basket + full paint rect) -->
    <path d="${hCirc(rP)}"                                                                          fill="${zFill('restricted_area')}" clip-path="url(#sc-clip)"/>
    <rect x="${pbX1}" y="${pbTop}" width="${pbX2-pbX1}" height="${cB-pbTop}"                        fill="${zFill('restricted_area')}" clip-path="url(#sc-clip)"/>

    <!-- ── COURT LINES ── -->
    <rect  x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}" fill="none" stroke="${line}" stroke-width="1.5" rx="3"/>
    <!-- Paint box -->
    <rect  x="${pbX1}" y="${pbTop}" width="${pbX2-pbX1}" height="${cB-pbTop}" fill="none" stroke="#4b5563" stroke-width="1.5"/>
    <!-- Free throw arc (dashed) -->
    <path  d="M${pbX1},${pbTop} A49,49 0 0,0 ${pbX2},${pbTop}" fill="none" stroke="#4b5563" stroke-width="1.5" stroke-dasharray="4,3"/>
    <!-- 3pt arc -->
    <path  d="M${c3xL},${cB} L${c3xL},${c3yJoin} A${r3},${r3} 0 0,0 ${c3xR},${c3yJoin} L${c3xR},${cB}" fill="none" stroke="#4b5563" stroke-width="1.5"/>
    <!-- Paint semi-circle (dashed) -->
    <path  d="M${cx-rP},${cy} A${rP},${rP} 0 0,0 ${cx+rP},${cy}" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
    <!-- Basket -->
    <circle cx="${cx}" cy="${cy}" r="9"  fill="none" stroke="#9ca3af" stroke-width="2"/>
    <line   x1="${cx-26}" y1="${cB-3}" x2="${cx+26}" y2="${cB-3}" stroke="#9ca3af" stroke-width="3"/>

    <!-- ── ZONE LABELS ── -->
    ${lbl('top_key_3',      cx,          75)}
    ${lbl('left_wing_3',    cL + 36,    200)}
    ${lbl('right_wing_3',   cR - 36,    200)}
    ${lbl('left_corner_3',  cL + 22,    266)}
    ${lbl('right_corner_3', cR - 22,    266)}
    ${lbl('mid_top',        cx,         168)}
    ${lbl('mid_left_far',   cx - 102,   172)}
    ${lbl('mid_right_far',  cx + 102,   172)}
    ${lbl('mid_left_close', cx - 68,    268)}
    ${lbl('mid_right_close',cx + 68,    268)}
    ${lbl('restricted_area',cx,         222)}

    <!-- ── SUMMARY BADGE ── -->
    ${badge()}
  </svg>`;
}
```

- [ ] **Step 2.2 — Update `renderPlayer` to pass new response shape**

Find the call to `_shotChartSVG` in `renderPlayer` (around line 935–938). The current call is:

```javascript
${_shotChartSVG(shots.zones, shots.total_shots, shots.league_zones)}
```

Replace with:

```javascript
${_shotChartSVG(shots.zones, shots.total_shots, shots.summary)}
```

- [ ] **Step 2.3 — Bump service worker cache version**

In `frontend/sw.js`, change:

```javascript
const CACHE = "courtiq-v11";
```

to:

```javascript
const CACHE = "courtiq-v12";
```

- [ ] **Step 2.4 — Manual test**

Start the backend (`python backend/app.py`), open the app at `http://localhost:5000`, navigate to any player that has shot data, scroll to the shot chart. Verify:

- 11 colored zone regions visible (color varies by zone efficiency)
- Each zone with attempts shows a label card with `[attempts  P/F]` on line 1 and `XX.X%` larger on line 2
- Top-right badge shows P/F, eFG%, and game count
- Zones with no shots show the dark court background (no label)
- Court lines visible: paint box, 3pt line with corners, free throw arc

- [ ] **Step 2.5 — Commit**

```bash
git add frontend/js/app.js frontend/sw.js
git commit -m "feat: shot chart 11 zonas con metrica P/F — layout identico a referencia"
```

---

## Task 3 — Push

- [ ] **Step 3.1 — Push to remote**

```bash
git push origin main
```

Expected: render.com deploy triggers automatically.
