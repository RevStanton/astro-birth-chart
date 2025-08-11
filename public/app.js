// ============================
// public/app.js  (Lite Mode + Insight Writer)
// ============================

// ---------- DOM ----------
const form = document.getElementById("natal-form");
const results = document.getElementById("results");
const planetsTable = document.getElementById("planets-table");
const housesTable  = document.getElementById("houses-table");
const aspectsTable = document.getElementById("aspects-table");
const wheelCanvas  = document.getElementById("wheel");
const ctx = wheelCanvas.getContext("2d");
const btnInsights = document.getElementById("btn-insights");
const insightsOut = document.getElementById("insights-output");

// Optional controls
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

const CORE_PLANETS = new Set(["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]);

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
const MAJOR_ASPECTS = ["Conjunction","Opposition","Square","Trine","Sextile"];

// ---------- State (for redraw/hover/insights) ----------
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

function signFromNumber(n) {
  const names = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  return names[(Number(n)-1+12)%12];
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
    allowed = null,
    exclude = [],
    orbs = DEFAULT_ORBS
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
          out.push({ planet_1: { [lang]: a.name }, planet_2: { [lang]: b.name }, aspect: { [lang]: asp }, exactness: Math.abs(angle - target) });
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

    // Store for redraws/insights
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

    // clear insights output
    if (insightsOut) insightsOut.textContent = "";
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

// =====================================================
// ===============  INSIGHT WRITER  ====================
// =====================================================

// Click handler
if (btnInsights) {
  btnInsights.addEventListener("click", async () => {
    if (!lastPlanets.length) { alert("Generate your chart first."); return; }

    btnInsights.disabled = true;
    const old = btnInsights.textContent;
    btnInsights.textContent = "Thinking…";

    try {
      // one extra call: today's planets (UTC now, observation/ayanamsha/language from form)
      const fd = new FormData(form);
      const transPayload = buildTodayPlanetsPayload(fd);
      const transRes = await callAstro("/western/planets", transPayload);
      const transitPlanets = transRes.output || [];

      const message = buildInsightsText(lastPlanets, lastHouses, lastAspects, transitPlanets);
      insightsOut.textContent = message;
    } catch (e) {
      console.error(e);
      alert("Insights error: " + e.message);
    } finally {
      btnInsights.disabled = false;
      btnInsights.textContent = old;
    }
  });
}

function buildTodayPlanetsPayload(fd) {
  const now = new Date();
  // use UTC for consistency (Angles won't be used for transits)
  const base = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    date: now.getUTCDate(),
    hours: now.getUTCHours(),
    minutes: now.getUTCMinutes(),
    seconds: now.getUTCSeconds(),
    latitude: parseFloat(fd.get("latitude")) || 0,
    longitude: parseFloat(fd.get("longitude")) || 0,
    timezone: 0
  };
  const cfg = {
    observation_point: fd.get("observation_point") || "topocentric",
    ayanamsha: fd.get("ayanamsha") || "tropical",
    language: fd.get("language") || "en"
  };
  return { ...base, config: cfg };
}

// Sign + element/quality helpers
const ELEMENT_BY_SIGN = {
  Aries:"Fire", Leo:"Fire", Sagittarius:"Fire",
  Taurus:"Earth", Virgo:"Earth", Capricorn:"Earth",
  Gemini:"Air", Libra:"Air", Aquarius:"Air",
  Cancer:"Water", Scorpio:"Water", Pisces:"Water"
};
const QUALITY_BY_SIGN = {
  Aries:"Cardinal", Cancer:"Cardinal", Libra:"Cardinal", Capricorn:"Cardinal",
  Taurus:"Fixed", Leo:"Fixed", Scorpio:"Fixed", Aquarius:"Fixed",
  Gemini:"Mutable", Virgo:"Mutable", Sagittarius:"Mutable", Pisces:"Mutable"
};

// Short blurbs (tiny, tasteful; you can expand later)
const BLURB_SUN = {
  Aries:"direct, pioneering, energized", Taurus:"grounded, steady, sensual", Gemini:"curious, witty, adaptable",
  Cancer:"protective, intuitive, nurturing", Leo:"expressive, bold, warm", Virgo:"precise, helpful, discerning",
  Libra:"relational, balanced, aesthetic", Scorpio:"intense, perceptive, transformative", Sagittarius:"expansive, candid, adventurous",
  Capricorn:"disciplined, strategic, patient", Aquarius:"original, humanitarian, future-minded", Pisces:"empathetic, imaginative, porous"
};
const BLURB_MOON = {
  Aries:"acts fast on feelings", Taurus:"needs calm & comfort", Gemini:"talks feelings out",
  Cancer:"home-centered heart", Leo:"needs to be seen", Virgo:"seeks useful order",
  Libra:"soothes through harmony", Scorpio:"deep waters; all-or-nothing", Sagittarius:"needs open space",
  Capricorn:"stoic container", Aquarius:"cool-headed reflector", Pisces:"soaks moods, needs rest"
};
const BLURB_ASC = {
  Aries:"comes in hot; straight shooter", Taurus:"unhurried, dependable presence", Gemini:"quick, lively, chatty",
  Cancer:"soft shell, warm center", Leo:"sunny, generous aura", Virgo:"neat, noticing everything",
  Libra:"graceful diplomat", Scorpio:"quiet magnetism", Sagittarius:"big laugh, bigger horizon",
  Capricorn:"calm, competent", Aquarius:"quirky, friendly outsider", Pisces:"gentle, dreamy vibe"
};

const ASPECT_TONE = {
  Conjunction: "amplifies",
  Trine: "flows easily with",
  Sextile: "supports and opens a door with",
  Square: "challenges and sharpens",
  Opposition: "asks for balance with"
};

const PLANET_VERBS = {
  Sun:"identity", Moon:"mood", Mercury:"mind & messages", Venus:"love & aesthetics", Mars:"drive & action",
  Jupiter:"growth & opportunity", Saturn:"discipline & boundaries", Uranus:"surprise & freedom",
  Neptune:"dreams & intuition", Pluto:"power & transformation"
};

function buildInsightsText(natalPlanets, houses, natalAspects, transitPlanets) {
  // ---------- Big Three ----------
  const getByName = (arr, name) => arr.find(p => p?.planet?.en === name);
  const sun = getByName(natalPlanets, "Sun");
  const moon = getByName(natalPlanets, "Moon");
  const asc  = getByName(natalPlanets, "Ascendant");

  const sunSign = sun ? sun.zodiac_sign?.name?.en : null;
  const moonSign = moon ? moon.zodiac_sign?.name?.en : null;
  const ascSign  = asc  ? asc.zodiac_sign?.name?.en  : null;

  let intro = "Your snapshot:\n";
  if (sunSign)  intro += `• Sun in ${sunSign}: ${BLURB_SUN[sunSign] || ""}\n`;
  if (moonSign) intro += `• Moon in ${moonSign}: ${BLURB_MOON[moonSign] || ""}\n`;
  if (ascSign)  intro += `• Rising ${ascSign}: ${BLURB_ASC[ascSign] || ""}\n`;

  // ---------- Theme: elements / qualities ----------
  const core = natalPlanets.filter(p => CORE_PLANETS.has(p?.planet?.en));
  const elementCounts = { Fire:0, Earth:0, Air:0, Water:0 };
  const qualityCounts = { Cardinal:0, Fixed:0, Mutable:0 };
  core.forEach(p => {
    const s = p.zodiac_sign?.name?.en;
    if (s) { elementCounts[ELEMENT_BY_SIGN[s]]++; qualityCounts[QUALITY_BY_SIGN[s]]++; }
  });
  const dominantElement = Object.entries(elementCounts).sort((a,b)=>b[1]-a[1])[0][0];
  const dominantQuality = Object.entries(qualityCounts).sort((a,b)=>b[1]-a[1])[0][0];

  let themes = `\nChart themes:\n• Element emphasis: ${dominantElement}\n• Mode emphasis: ${dominantQuality}`;

  // Stellium (≥3 in one sign)
  const signCounts = {};
  core.forEach(p => {
    const s = p.zodiac_sign?.name?.en;
    if (s) signCounts[s] = (signCounts[s]||0)+1;
  });
  const stelliumSign = Object.entries(signCounts).find(([,c]) => c>=3)?.[0];
  if (stelliumSign) themes += `\n• Stellium in ${stelliumSign} (strong focus here)`;

  // Angular planets (within 10° of Asc/Desc/MC/IC)
  const angleDeg = (name) => getByName(natalPlanets, name)?.fullDegree ?? null;
  const A = angleDeg("Ascendant"), D = angleDeg("Descendant"), M = angleDeg("MC"), I = angleDeg("IC");
  const nearAngle = (deg, target) => {
    if (deg==null || target==null) return false;
    const diff = Math.abs(deg - target);
    return Math.min(diff, 360 - diff) <= 10;
  };
  const angular = core.filter(p => [A,D,M,I].some(t => nearAngle(p.fullDegree, t))).map(p => p.planet.en);
  if (angular.length) themes += `\n• Angular emphasis: ${angular.join(", ")}`;

  // Retrogrades
  const retros = core.filter(p => normalizeBool(p.isRetro)).map(p => p.planet.en + "R");
  if (retros.length) themes += `\n• Natal retrogrades: ${retros.join(", ")}`;

  // ---------- Tight natal aspects (top 5 major by exactness) ----------
  const natMaj = natalAspects
    .filter(a => MAJOR_ASPECTS.includes(a?.aspect?.en))
    .sort((a,b) => (a.exactness ?? 99) - (b.exactness ?? 99))
    .slice(0,5);
  let natTxt = "\nKey natal aspects:\n";
  if (!natMaj.length) natTxt += "• None of the major aspects stood out tightly.\n";
  else {
    natMaj.forEach(a => {
      natTxt += `• ${a.planet_1.en} ${a.aspect.en} ${a.planet_2.en} — ${ASPECT_TONE[a.aspect.en]} how these two operate.\n`;
    });
  }

  // ---------- Transits -> natal (today) ----------
  const transitAspects = computeTransitToNatalAspects(transitPlanets, natalPlanets, { orbs: { Conjunction:2, Opposition:2, Square:2.5, Trine:2.5, Sextile:2 } });
  const topTransits = transitAspects
    .filter(t => CORE_PLANETS.has(t.to)) // to natal core planet
    .sort((a,b) => a.exactness - b.exactness)
    .slice(0,3);

  let today = "\nToday’s alignment for you:\n";
  if (!topTransits.length) today += "• Nothing major pinging the core today—take it steady and follow your baseline rhythm.\n";
  else {
    topTransits.forEach(t => {
      const tone = ASPECT_TONE[t.aspect] || "interacts with";
      const verb = PLANET_VERBS[t.to] || "life";
      today += `• Transit ${t.from} ${t.aspect} natal ${t.to}: ${tone} your ${verb}. ${transitHint(t)}\n`;
    });
  }

  // ---------- Wrap ----------
  const wrap = "\nTake what resonates, leave the rest. Use the easy flows; respect the edges. You’ve got this.";

  return [intro, themes, natTxt, today, wrap].join("\n");
}

function computeTransitToNatalAspects(transitPlanets, natalPlanets, opts) {
  const lang = "en";
  const allowed = MAJOR_ASPECTS;
  const orbs = { ...DEFAULT_ORBS, ...(opts?.orbs||{}) };

  const tEntries = transitPlanets
    .map(p => ({ name: p?.planet?.[lang] ?? p?.planet?.en, deg: Number(p?.fullDegree||0) }))
    .filter(e => e.name && CORE_PLANETS.has(e.name)); // ignore angles/asteroids

  const nEntries = natalPlanets
    .map(p => ({ name: p?.planet?.[lang] ?? p?.planet?.en, deg: Number(p?.fullDegree||0) }))
    .filter(e => e.name); // include core + angles, but we’ll mostly talk about core

  const out = [];
  tEntries.forEach(t => {
    nEntries.forEach(n => {
      const diff = Math.abs(t.deg - n.deg);
      const angle = Math.min(diff, 360 - diff);
      for (const asp of allowed) {
        const target = ASPECT_DEGREES[asp];
        const orb = orbs[asp] ?? 0;
        const exactness = Math.abs(angle - target);
        if (exactness <= orb) {
          out.push({ from: t.name, to: n.name, aspect: asp, exactness });
          break;
        }
      }
    });
  });
  return out;
}

function transitHint(t) {
  const a = t.aspect, p = t.from, n = t.to;
  const soft = ["Trine","Sextile"];
  const hard = ["Square","Opposition"];
  if (a === "Conjunction") return `Spotlight on ${n.toLowerCase()}. Lean into awareness and keep the volume at a mindful level.`;
  if (soft.includes(a)) return `Favorable window—make small moves around ${PLANET_VERBS[n] || "priorities"}.`;
  if (hard.includes(a)) return `Tension exposes growth edges. Avoid extremes; choose one concrete action to honor ${PLANET_VERBS[n] || "this area"}.`;
  return `Notice the nudge. Micro-adjustments go far today.`;
}

// =====================================================
// ===============  END INSIGHT WRITER  ================
// =====================================================

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
