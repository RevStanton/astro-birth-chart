// ---------- DOM ----------
const form = document.getElementById("natal-form");
const results = document.getElementById("results");
const planetsTable = document.getElementById("planets-table");
const housesTable  = document.getElementById("houses-table");
const aspectsTable = document.getElementById("aspects-table");
const wheelCanvas  = document.getElementById("wheel");
const ctx = wheelCanvas.getContext("2d");

// ---------- Proxy call ----------
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
  return { ...rest, config }; // planets supports the same base config
};

// ---------- Lite helpers ----------
function isLite(fd) {
  return String(fd.get("lite_mode")) === "on";
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

function signNameFromDeg(deg) {
  const names = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  return names[Math.floor(((deg % 360) + 360) % 360 / 30)];
}

const ASPECT_DEGREES = {
  "Conjunction": 0, "Opposition": 180, "Square": 90, "Trine": 120, "Sextile": 60,
  "Quincunx": 150, "Semi-Sextile": 30, "Quintile": 72, "Octile": 45, "Sesquiquadrate": 135,
  "Septile": 51.4286, "Novile": 40
};
const DEFAULT_ORBS = {
  Conjunction: 3, Opposition: 5, Square: 5, Trine: 5, Sextile: 5, Quincunx: 5,
  "Semi-Sextile": 5, Quintile: 5, Octile: 5, Sesquiquadrate: 5, Septile: 3, Novile: 3
};

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

  // Planets
  planets.forEach(p => {
    const deg = Number(p?.fullDegree || 0);
    const [x, y] = pointOnCircle(cx, cy, R_PLANETS, deg);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#e9ecff";
    ctx.fill();

    const retro = normalizeBool(p?.isRetro) ? "R" : "";
    const name = p?.planet?.en || "•";
    ctx.font = "12px ui-sans-serif, system-ui, Arial";
    ctx.fillStyle = "#9aa3c0";
    ctx.textAlign = "center";
    ctx.fillText(name + retro, x, y - 8);
  });
}

function drawAspectLines(aspects, planets, lang) {
  // Build map of body -> degree from planets output
  const degreeByName = new Map();
  planets.forEach(p => {
    const name = (p?.planet?.[lang] ?? p?.planet?.en ?? "").trim();
    const deg = Number(p?.fullDegree || 0);
    if (name) degreeByName.set(name, deg);
  });

  const cx = wheelCanvas.width / 2;
  const cy = wheelCanvas.height / 2;
  const R_PLANETS = 180;

  aspects.forEach(a => {
    const p1 = a?.planet_1?.[lang] ?? a?.planet_1?.en;
    const p2 = a?.planet_2?.[lang] ?? a?.planet_2?.en;
    const asp = a?.aspect?.[lang] ?? a?.aspect?.en;
    const d1 = degreeByName.get(p1);
    const d2 = degreeByName.get(p2);
    if (d1 == null || d2 == null) return;

    const [x1, y1] = pointOnCircle(cx, cy, R_PLANETS, d1);
    const [x2, y2] = pointOnCircle(cx, cy, R_PLANETS, d2);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = aspectColor(asp);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
}

function aspectColor(aspect) {
  switch (aspect) {
    case "Conjunction": return getCss("--asp-conj");
    case "Trine": return getCss("--asp-trine");
    case "Square": return getCss("--asp-square");
    case "Sextile": return getCss("--asp-sextile");
    case "Opposition": return getCss("--asp-opp");
    default: return getCss("--asp-conj");
  }
}
function getCss(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName) || "#7c8cff";
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
