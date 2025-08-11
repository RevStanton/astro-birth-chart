// ============================
// public/app.js  (Lite Mode)
// ============================

// ---------- DOM ----------
const form = document.getElementById("natal-form");
const results = document.getElementById("results");
const planetsTable = document.getElementById("planets-table");
const housesTable  = document.getElementById("houses-table");
const aspectsTable = document.getElementById("aspects-table");
const wheelCanvas  = document.getElementById("wheel");
const ctx = wheelCanvas.getContext("2d");

// Optional controls (if present in HTML)
const minorToggle = document.getElementById("show-minor-aspects");
const astToggle   = document.getElementById("show-asteroids");
const tooltip     = document.getElementById("tooltip");

// ---------- Constants / Maps ----------
const MINOR_ASPECTS = new Set([
  "Semi-Sextile","Quintile","Septile","Octile","Novile","Quincunx","Sesquiquadrate"
]);
const ASTEROIDS_OR_POINTS = new Set([
  "Ceres","Vesta","Juno","Pallas","Lilith","Chiron","Mean Node","True Node","Ascendant","Descendant","MC","IC"
]);

const ABBR = {
  "Sun":"Su","Moon":"Mo","Mercury":"Me","Venus":"Ve","Mars":"Ma","Jupiter":"Ju","Saturn":"Sa",
  "Uranus":"Ur","Neptune":"Ne","Pluto":"Pl","Ascendant":"Asc","Descendant":"Dsc","MC":"MC","IC":"IC",
  "Ceres":"Ce","Vesta":"Veᵥ","Juno":"Juᵥ","Pallas":"Pa","Lilith":"Li","Chiron":"Ch",
  "True Node":"☊","Mean Node":"☊̄"
};

const ASPECT_DEGREES = {
  "Conjunction": 0, "Opposition": 180, "Square": 90, "Trine": 120, "Sextile": 60,
  "Quincunx": 150, "Semi-Sextile": 30, "Quintile": 72, "Octile": 45, "Sesquiquadrate": 135,
  "Septile": 51.4286, "Novile": 40
};
const DEFAULT_ORBS = {
  Conjunction: 3, Opposition: 5, Square: 5, Trine: 5, Sextile: 5, Quincunx: 5,
  "Semi-Sextile": 5, Quintile: 5, Octile: 5, Sesquiquadrate: 5, Septile: 3, Novile: 3
};

// ---------- State (for redraw/hover) ----------
let lastPlanets = [];
let lastHouses  = [];
let lastAspects = [];
let LAST_PLANET_POINTS = []; // [{name, x, y, deg}]

// ---------- Server proxy ----------
async function callAstro(path, data) {
  const resp = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, data })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = json?.detail;
    const msg =
      (typeof detail === "string" && detail) ||
      detail?.message ||
      JSON.stringify(detail || json) ||
      "API error";
    throw new Error(msg);
  }
  return json;
}

// ---------- Payload builders ----------
function readCommon(fd) {
  const [y, m, d] = String(fd.get("date_iso")).split("-").map(n => parseInt(n, 10));
  const [hh, mm] = String(fd.get("time_hm")).split(":").map(n => parseInt(n, 10));
  const seconds = parseInt(fd.get("seconds") || "0", 10);

  const base = {
    year: y, month: m, date: d,
    hours: hh, minutes: mm, seconds,
    latitude: parseFloat(fd.get("latitude")),
    longitude: parseFloat(fd.get("longitude")),
    timezone: parseFloat(fd.get("timezone"))
  };

  const cfg = {
    observation_point: fd.get("observation_point") || "topocentric",
    ayanamsha: fd.get("ayanamsha") || "tropical",
    language: fd.get("language") || "en"
  };

  return { ...base, config: cfg };
}

const buildPlanetsPayload = (fd) => {
  const { config, ...rest } = readCommon(fd);
  return { ...rest, config };
};

// ---------- Lite helpers ----------
function isLite(fd) {
  return String(fd.get("lite_mode")) === "on";
}

function signNameFromDeg(deg) {
  const names = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  return names[Math.floor(((deg % 360) + 360) % 360 / 30)];
}

function buildWholeSignHouses(planets, lang = "en") {
  const asc = planets.find(p => (p?.planet?.[lang] ?? p?.planet?.en) === "Ascendant");
  if (!asc) return [];
  const signNum = asc?.zodiac_sign?.number; // 1..12
  if (!signNum) return [];
  const startDeg = (signNum - 1) * 30;

  const houses = [];
  for (let i = 0; i < 12; i++) {
    const deg = (startDeg + i * 30) % 360;
    houses.push({
      House: i + 1,
      degree: deg,
      normDegree: 0,
      zodiac_sign: { number: ((Math.floor(deg / 30)) % 12) + 1, name: { en: signNameFromDeg(deg) } }
    });
  }
  return houses;
}

function computeAspectsLocal(planets, options) {
  const {
    lang = "en",
    allowed = null,            // array or null => all
    exclude = [],              // array of names to skip
    orbs = DEFAULT_ORBS        // map
  } = options || {};

  const entries = planets
    .map(p => {
      const name = (p?.planet?.[lang] ?? p?.planet?.en ?? "").trim();
      return { name, deg: Number(p?.fullDegree || 0) };
    })
    .filter(e => e.name && !exclude.includes(e.name));

  const out = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      const diff = Math.abs(a.deg - b.deg);
      const angle = Math.min(diff, 360 - diff); // shortest arc
      for (const [asp, target] of Object.entries(ASPECT_DEGREES)) {
        if (allowed && !allowed.includes(asp)) continue;
        const orb = orbs?.[asp] ?? DEFAULT_ORBS[asp] ?? 0;
        if (Math.abs(angle - target) <= orb) {
          out.push({ planet_1: { [lang]: a.name }, planet_2: { [lang]: b.name }, aspect: { [lang]: asp } });
          break; // one aspect per pair
        }
      }
    }
  }
  return out;
}

// ---------- Submit flow ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const lang = currentLang(fd);
  const lite = isLite(fd);
  const submitBtn = form.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  const labelOrig = submitBtn.textContent;
  submitBtn.textContent = "Generating…";

  try {
    // Only API call (Lite)
    const planetsRes = await callAstro("/western/planets", buildPlanetsPayload(fd));
    const planets = planetsRes.output || [];

    // Local compute
    const houses = buildWholeSignHouses(planets, lang);

    const allowed = (fd.get("allowed_aspects") || "").trim()
      ? fd.get("allowed_aspects").split(",").map(s => s.trim()).filter(Boolean)
      : null;
    const exclude = (fd.get("exclude_planets") || "").trim()
      ? fd.get("exclude_planets").split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const orbs = safeJSON(fd.get("orb_values") || "") || DEFAULT_ORBS;

    const aspects = computeAspectsLocal(planets, { lang, allowed, exclude, orbs });

    // Store for redraws
    lastPlanets = planets;
    lastHouses  = houses;
    lastAspects = aspects;

    // Render
    results.classList.remove("hidden");
    renderPlanetsTable(planets, lang);
    renderHousesTable(houses, lang);
    renderAspectsTable(aspects, lang);
    drawCustomWheel(planets, houses);
    drawAspectLines(aspects, planets, lang);
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = labelOrig;
  }
});

// ---------- Renderers: Tables ----------
function renderPlanetsTable(rows, lang) {
  const flat = rows.map(r => ({
    planet: r?.planet?.[lang] ?? "",
    sign: r?.zodiac_sign?.name?.[lang] ?? "",
    fullDegree: round2(r?.fullDegree),
    normDegree: round2(r?.normDegree),
    retro: normalizeBool(r?.isRetro)
  }));

  tableFromRows(planetsTable, flat, [
    { key: "planet", label: "Planet" },
    { key: "sign", label: "Sign" },
    { key: "fullDegree", label: "Longitude° (0–360)" },
    { key: "normDegree", label: "Norm° (0–30)" },
    { key: "retro", label: "Retro" }
  ]);
}

function renderHousesTable(rows, lang) {
  const flat = rows.map(r => ({
    house: r?.House,
    sign: r?.zodiac_sign?.name?.[lang] ?? r?.zodiac_sign?.name?.en ?? "",
    degree: round2(r?.degree),
    normDegree: round2(r?.normDegree)
  }));

  tableFromRows(housesTable, flat, [
    { key: "house", label: "House" },
    { key: "sign", label: "Sign" },
    { key: "degree", label: "Longitude° (0–360)" },
    { key: "normDegree", label: "Norm° (0–30)" }
  ]);
}

function renderAspectsTable(rows, lang) {
  const flat = rows.map(r => ({
    p1: r?.planet_1?.[lang] ?? "",
    p2: r?.planet_2?.[lang] ?? "",
    aspect: r?.aspect?.[lang] ?? ""
  }));

  tableFromRows(aspectsTable, flat, [
    { key: "p1", label: "Body A" },
    { key: "p2", label: "Body B" },
    { key: "aspect", label: "Aspect" }
  ]);
}

function tableFromRows(el, rows, cols) {
  const thead = `<thead><tr>${cols.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${
    rows.map(r => `<tr>${cols.map(c => `<td title="${String(r[c.key] ?? "")}">${fmt(r[c.key])}</td>`).join("")}</tr>`).join("")
  }</tbody>`;
  el.innerHTML = thead + tbody;
}

// ---------- Renderers: Wheel ----------
function drawCustomWheel(planets, houses) {
  const cx = wheelCanvas.width / 2;
  const cy = wheelCanvas.height / 2;
  const R_OUTER = 240;
  const R_HOUSES = 210;
  const R_PLANETS = 180;

  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  // Base rings
  drawCircle(cx, cy, R_OUTER);
  drawCircle(cx, cy, R_HOUSES);
  drawCircle(cx, cy, R_PLANETS);

  // Zodiac 30° ticks
  for (let i = 0; i < 12; i++) {
    drawTick(cx, cy, toRadians(i * 30), R_HOUSES - 6, R_OUTER);
  }

  // House cusps
  houses.forEach(h => {
    const deg = Number(h?.degree || 0);
    drawTick(cx, cy, toRadians(deg), R_HOUSES - 5, R_OUTER);
  });

  // Planets with improved labels
  LAST_PLANET_POINTS = [];
  const R_LABEL = R_PLANETS + 12; // slightly outside the orbit ring
  const EDGE_PAD = 8;             // keep text away from canvas edges
  const useFullLabels = true;     // set false to use ABBR map

  const labelSlots = []; // used label angles (deg) to avoid overlap
  const showAsteroids = astToggle ? astToggle.checked : true;

  planets.forEach(p => {
    const rawName = p?.planet?.en || "•";
    if (!showAsteroids && ASTEROIDS_OR_POINTS.has(rawName)) return;

    const deg = Number(p?.fullDegree || 0);
    const [x, y] = pointOnCircle(cx, cy, R_PLANETS, deg);

    // planet dot
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#e9ecff";
    ctx.fill();

    // choose label text
    let labelText = useFullLabels ? rawName : (ABBR[rawName] || rawName);
    if (normalizeBool(p?.isRetro)) labelText += "R";

    // nudge angle to reduce collisions
    let placeDeg = deg;
    while (labelSlots.some(a => Math.abs(a - placeDeg) < 8)) placeDeg += 3;
    labelSlots.push(placeDeg);

    // anchor point for label
    const [lx, ly] = pointOnCircle(cx, cy, R_LABEL, placeDeg);

    // center text and prevent clipping by measuring width/height
    ctx.font = "12px ui-sans-serif, system-ui, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const m = ctx.measureText(labelText);
    const textW = m.width;
    const textH = 12; // rough height

    // slight tangential shift based on quadrant
    const sideShift = (placeDeg > 90 && placeDeg < 270) ? -6 : 6;
    let tx = lx + sideShift;
    let ty = ly;

    // clamp so text stays inside canvas
    tx = clamp(tx, EDGE_PAD + textW / 2, wheelCanvas.width  - EDGE_PAD - textW / 2);
    ty = clamp(ty, EDGE_PAD + textH / 2, wheelCanvas.height - EDGE_PAD - textH / 2);

    ctx.fillStyle = "#c8cee9";
    ctx.fillText(labelText, tx, ty);

    LAST_PLANET_POINTS.push({ name: rawName, x, y, deg });
  });
}

function drawAspectLines(aspects, planets, lang) {
  const degreeByName = new Map();
  const showAsteroids = astToggle ? astToggle.checked : true;
  const showMinor = minorToggle ? minorToggle.checked : false;

  planets.forEach(p => {
    const name = (p?.planet?.[lang] ?? p?.planet?.en ?? "").trim();
    if (!showAsteroids && ASTEROIDS_OR_POINTS.has(name)) return;
    degreeByName.set(name, Number(p?.fullDegree || 0));
  });

  const cx = wheelCanvas.width / 2;
  const cy = wheelCanvas.height / 2;
  const R_PLANETS = 180;

  aspects.forEach(a => {
    const asp = a?.aspect?.[lang] ?? a?.aspect?.en;
    if (!showMinor && MINOR_ASPECTS.has(asp)) return;

    const p1 = a?.planet_1?.[lang] ?? a?.planet_1?.en;
    const p2 = a?.planet_2?.[lang] ?? a?.planet_2?.en;
    const d1 = degreeByName.get(p1), d2 = degreeByName.get(p2);
    if (d1 == null || d2 == null) return;

    const [x1, y1] = pointOnCircle(cx, cy, R_PLANETS, d1);
    const [x2, y2] = pointOnCircle(cx, cy, R_PLANETS, d2);

    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = aspectColor(asp);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

// ---------- Hover tooltip + focus highlight ----------
if (wheelCanvas && tooltip) {
  wheelCanvas.addEventListener("mousemove", (e) => {
    if (!LAST_PLANET_POINTS.length) return;

    const rect = wheelCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // nearest planet within ~10px
    let best = null, bestD2 = 10 * 10;
    for (const pt of LAST_PLANET_POINTS) {
      const d2 = (pt.x - mx) ** 2 + (pt.y - my) ** 2;
      if (d2 < bestD2) { best = pt; bestD2 = d2; }
    }

    if (!best) {
      tooltip.hidden = true;
      redrawAll();
      return;
    }

    // position tooltip (absolute page coords)
    tooltip.style.left = `${e.clientX}px`;
    tooltip.style.top  = `${e.clientY}px`;
    tooltip.textContent = best.name;
    tooltip.hidden = false;

    // redraw with focused aspects
    const lang = "en";
    drawCustomWheel(lastPlanets, lastHouses);

    // draw all faint
    ctx.globalAlpha = 0.15;
    drawAspectLines(lastAspects, lastPlanets, lang);
    ctx.globalAlpha = 1;

    // highlight those involving hovered planet
    const focused = lastAspects.filter(a => {
      const p1 = a?.planet_1?.en, p2 = a?.planet_2?.en;
      return p1 === best.name || p2 === best.name;
    });
    drawAspectLines(focused, lastPlanets, lang);
  });

  wheelCanvas.addEventListener("mouseleave", () => { tooltip.hidden = true; redrawAll(); });
}

// ---------- Redraw on toggles ----------
[minorToggle, astToggle].forEach(el => {
  if (!el) return;
  el.addEventListener("change", redrawAll);
});

function redrawAll() {
  if (!lastPlanets.length) return;
  drawCustomWheel(lastPlanets, lastHouses);
  drawAspectLines(lastAspects, lastPlanets, "en");
}

// ---------- Aspect color helper ----------
function aspectColor(aspect) {
  const map = {
    Conjunction: "#ffffff",
    Opposition: "#ff5c5c",
    Square: "#ff9f40",
    Trine: "#4bc0c0",
    Sextile: "#36a2eb",
    Quincunx: "#9966ff",
    "Semi-Sextile": "#ffcd56",
    Quintile: "#b5e853",
    Septile: "#00cc88",
    Octile: "#ff66cc",
    Novile: "#66ffcc",
    Sesquiquadrate: "#ff66a3"
  };
  return map[aspect] || "#cccccc";
}

// ---------- Utils ----------
function currentLang(fd) { return fd.get("language") || "en"; }
function drawCircle(cx, cy, r) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#2c3358"; ctx.lineWidth = 2; ctx.stroke();
}
function drawTick(cx, cy, angleRad, r1, r2) {
  const x1 = cx + r1 * Math.cos(angleRad), y1 = cy + r1 * Math.sin(angleRad);
  const x2 = cx + r2 * Math.cos(angleRad), y2 = cy + r2 * Math.sin(angleRad);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = "#2c3358"; ctx.lineWidth = 1; ctx.stroke();
}
function pointOnCircle(cx, cy, r, deg) {
  const rad = toRadians(deg);
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
const toRadians = (deg) => (deg * Math.PI) / 180;
const round2 = (v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v);
const fmt = (v) => (v === true ? "Yes" : v === false ? "No" : v ?? "");
function normalizeBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}
function safeJSON(s) { try { return JSON.parse(s); } catch { return undefined; } }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// ============================
// end public/app.js
// ============================
