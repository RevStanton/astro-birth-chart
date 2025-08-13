// public/app.js
// Wires the form, calls planets endpoint (strict payload), renders wheel & tables,
// and exposes state for insights/report.

console.log("[app] loaded", document.readyState);
window.addEventListener("error", e => console.error("[window error]", e.error || e.message));
window.addEventListener("unhandledrejection", e => console.error("[unhandled]", e.reason));

import { setupGeocoding } from "./geocode.js";
import { drawWheel } from "./chart.js";
import { buildLocalInsights } from "./insights.js";

// ---- DOM ----
function getFormEl() {
  return document.getElementById("natal-form"); // <-- matches index.html
}
const wheelCanvas = document.getElementById("wheel");
const planetsTable = document.getElementById("planets-table");
const housesTable  = document.getElementById("houses-table");
const aspectsTable = document.getElementById("aspects-table");
const insightsOut  = document.getElementById("insights-output");
const legend       = document.getElementById("legend");
const liteCheckbox = document.querySelector('input[name="lite_mode"]');

// Init geocoder
setupGeocoding(getFormEl());

// ---- State ----
let lastPlanets = [];
let lastHouses  = [];
let lastAspects = [];

// ---- Helpers ----
function getFormData() {
  const form = getFormEl();
  if (!form) throw new Error("Form '#natal-form' not found.");

  const fd = new FormData(form);

  const dateISO = (fd.get("date_iso") || "").trim();   // "YYYY-MM-DD"
  const timeHM  = (fd.get("time_hm")  || "").trim();   // "HH:mm"

  const [Y, M, D] = dateISO.split("-").map(n => Number(n));
  const [HH, MM]  = timeHM.split(":").map(n => Number(n));

  if (!Number.isFinite(Y) || !Number.isFinite(M) || !Number.isFinite(D)) {
    throw new Error('Field "date_iso" is missing or invalid.');
  }
  if (!Number.isFinite(HH) || !Number.isFinite(MM)) {
    throw new Error('Field "time_hm" is missing or invalid.');
  }

  const seconds   = Number(fd.get("seconds") || 0);
  const latitude  = Number(fd.get("latitude"));
  const longitude = Number(fd.get("longitude"));
  const timezone  = Number(fd.get("timezone")); // hours; filled by geocode.js

  if (!Number.isFinite(seconds)   || seconds < 0 || seconds > 59)  throw new Error('Field "seconds" is missing or invalid.');
  if (!Number.isFinite(latitude)  || latitude < -90 || latitude > 90)    throw new Error('Field "latitude" is missing or invalid.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Field "longitude" is missing or invalid.');
  if (!Number.isFinite(timezone)  || timezone < -14 || timezone > 14)     throw new Error('Field "timezone" is missing or invalid.\n\nTip: pick a location from the dropdown so timezone fills in.');

  const config = {
    observation_point: (fd.get("observation_point") || "topocentric").trim(),
    ayanamsha: (fd.get("ayanamsha") || "tropical").trim(),
    language: (fd.get("language") || "en").trim(),
  };

  // STRICT payload for Free Astrology API (no extra keys!)
  const payload = {
    year: Y,
    month: M,
    date: D,
    hours: HH,
    minutes: MM,
    seconds,
    latitude,
    longitude,
    timezone,
    config
  };

  // meta for UI/report only (not sent to API)
  const meta = {
    dateISO,
    timeHM,
    timezone,
    latitude,
    longitude,
    cityState: (document.getElementById("location-input")?.value || "").trim()
  };

  const lite = !!(liteCheckbox && liteCheckbox.checked);
  return { payload, meta, lite };
}

function cell(th) {
  const e = document.createElement("th");
  e.textContent = th;
  return e;
}
function rowTds(vals) {
  const tr = document.createElement("tr");
  vals.forEach(v => {
    const td = document.createElement("td");
    td.textContent = v;
    tr.appendChild(td);
  });
  return tr;
}
function clearTable(t) { if (t) t.innerHTML = ""; }

function fillPlanetsTable(planets) {
  if (!planetsTable) return;
  clearTable(planetsTable);
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  trh.appendChild(cell("Planet"));
  trh.appendChild(cell("Sign"));
  trh.appendChild(cell("Longitude°"));
  trh.appendChild(cell("Retro"));
  thead.appendChild(trh);
  planetsTable.appendChild(thead);

  const tb = document.createElement("tbody");
  planets.forEach(p => {
    const name  = p?.planet?.en ?? "";
    const sign  = p?.zodiac_sign?.name?.en ?? "";
    const lon   = (p?.fullDegree ?? 0).toFixed(2);
    const retro = String(p?.isRetro).toLowerCase() === "true" ? "Yes" : "";
    tb.appendChild(rowTds([name, sign, lon, retro]));
  });
  planetsTable.appendChild(tb);
}

function fillHousesTable(houses) {
  if (!housesTable) return;
  clearTable(housesTable);
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  trh.appendChild(cell("House"));
  trh.appendChild(cell("# Sign"));
  trh.appendChild(cell("Cuspal°"));
  thead.appendChild(trh);
  housesTable.appendChild(thead);

  const tb = document.createElement("tbody");
  houses.forEach(h => {
    tb.appendChild(rowTds([
      h?.House ?? "",
      h?.zodiac_sign?.name?.en ?? "",
      (h?.degree ?? 0).toFixed(2)
    ]));
  });
  housesTable.appendChild(tb);
}

function fillAspectsTable(aspects) {
  if (!aspectsTable) return;
  clearTable(aspectsTable);
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  trh.appendChild(cell("Body A"));
  trh.appendChild(cell("Aspect"));
  trh.appendChild(cell("Body B"));
  thead.appendChild(trh);
  aspectsTable.appendChild(thead);

  const majors = new Set(["Conjunction","Opposition","Square","Trine","Sextile"]);
  const tb = document.createElement("tbody");
  (aspects || []).filter(a => majors.has(a?.aspect?.en)).forEach(a => {
    tb.appendChild(rowTds([
      a?.planet_1?.en ?? "",
      a?.aspect?.en ?? "",
      a?.planet_2?.en ?? ""
    ]));
  });
  aspectsTable.appendChild(tb);
}

// ---- Local (lite-mode) calculators ----
function computeWholeSignHousesFromAsc(ascDegree) {
  const signs = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const ascSignIndex = Math.floor(((ascDegree % 360)+360)%360 / 30);
  const houses = [];
  for (let i=0;i<12;i++){
    const signIndex = (ascSignIndex + i) % 12;
    houses.push({
      House: i+1,
      degree: (Math.floor(ascDegree/30) * 30 + i*30) % 360,
      normDegree: 0,
      zodiac_sign: { number: signIndex+1, name: { en: signs[signIndex] } }
    });
  }
  return houses;
}
function computeAspectsLocal(planets) {
  const majors = [
    { name: "Conjunction", angle: 0,   orb: 6 },
    { name: "Opposition",  angle: 180, orb: 6 },
    { name: "Square",      angle: 90,  orb: 6 },
    { name: "Trine",       angle: 120, orb: 6 },
    { name: "Sextile",     angle: 60,  orb: 4 },
  ];
  const pts = planets.map(p => ({
    name: p?.planet?.en,
    deg: (p?.fullDegree ?? 0) % 360
  })).filter(p => !!p.name);

  const out = [];
  for (let i=0;i<pts.length;i++){
    for (let j=i+1;j<pts.length;j++){
      const a = pts[i], b = pts[j];
      const diff = Math.abs(a.deg - b.deg);
      const sep = Math.min(diff, 360 - diff);
      for (const asp of majors){
        if (Math.abs(sep - asp.angle) <= asp.orb){
          out.push({ planet_1:{en:a.name}, planet_2:{en:b.name}, aspect:{en:asp.name} });
          break;
        }
      }
    }
  }
  return out;
}

// ---- API calls ----
async function fetchPlanets(payload) {
  console.log("[app] POST /api/western/planets payload:", payload);
  const r = await fetch("/api/western/planets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const text = await r.text();
    console.error("[app] planets error", r.status, text);
    throw new Error(`Planets API error (${r.status}): ${text}`);
  }
  const data = await r.json();
  return Array.isArray(data?.output) ? data.output : (data?.output || data || []);
}

// ---- Render & publish ----
function renderAll(planets, houses, aspects) {
  if (wheelCanvas) {
    drawWheel(planets, houses, aspects, { canvas: wheelCanvas, legendEl: legend });
  }
  fillPlanetsTable(planets);
  fillHousesTable(houses);
  fillAspectsTable(aspects);
}
function publishState(meta, planets, houses, aspects) {
  window.__ASTRO_STATE = { planets, houses, aspects, birth: meta };
  if (window.__ASTRO_REPORT_READY) window.__ASTRO_REPORT_READY();
}

// ---- Generate handler ----
async function onGenerate(e) {
  e?.preventDefault?.();
  try {
    const { payload, meta, lite } = getFormData();

    const planets = await fetchPlanets(payload);

    let houses, aspects;
    const asc = planets.find(p => p?.planet?.en === "Ascendant");
    const ascDeg = asc?.fullDegree ?? 0;
    houses = computeWholeSignHousesFromAsc(ascDeg);
    aspects = computeAspectsLocal(planets);

    lastPlanets = planets; lastHouses = houses; lastAspects = aspects;

    renderAll(planets, houses, aspects);
    publishState(meta, planets, houses, aspects);
  } catch (err) {
    console.error("[app] generate error", err);
    alert(err.message || "Could not generate the chart. Check console for details.");
  }
}

// ---- Insights ----
document.getElementById("btn-insights")?.addEventListener("click", async () => {
  if (!window.__ASTRO_STATE?.planets?.length) {
    if (insightsOut) insightsOut.textContent = "Generate your chart first.";
    return;
  }
  // Optional AI first (if you wired insights-ai.js)
  let usedAI = false;
  if (window.__ASTRO_AI_INSIGHTS?.generateAIInsights) {
    const text = await window.__ASTRO_AI_INSIGHTS.generateAIInsights(window.__ASTRO_STATE);
    usedAI = typeof text === "string" && text.length > 0;
    if (usedAI && insightsOut) insightsOut.textContent = text;
  }
  if (!usedAI && insightsOut) {
    insightsOut.textContent = buildLocalInsights(window.__ASTRO_STATE);
  }
});

// ---- Wire form ----
function wireGenerate() {
  const form = getFormEl();
  const btn = form?.querySelector('button[type="submit"]');
  form?.addEventListener("submit", onGenerate);
  // safety: also attach to the button
  btn?.addEventListener("click", onGenerate);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireGenerate);
} else {
  wireGenerate();
}
