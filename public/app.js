import { currentLang, DEFAULT_ORBS, round2, fmt } from "./util.js";
import { setupGeocoding } from "./geocode.js";
import { setupChart } from "./chart.js";
import { buildInsightsText } from "./insights.js";

// DOM
const form = document.getElementById("natal-form");
const results = document.getElementById("results");
const planetsTable = document.getElementById("planets-table");
const housesTable  = document.getElementById("houses-table");
const aspectsTable = document.getElementById("aspects-table");
const wheelCanvas  = document.getElementById("wheel");
const tooltip      = document.getElementById("tooltip");
const minorToggle  = document.getElementById("show-minor-aspects");
const astToggle    = document.getElementById("show-asteroids");
const btnInsights  = document.getElementById("btn-insights");
const insightsOut  = document.getElementById("insights-output");

// Modules
setupGeocoding(form);
const chart = setupChart({ canvas: wheelCanvas, minorToggle, astToggle, tooltip });
chart.bindToggles();

// State
let lastPlanets = [];
let lastHouses  = [];
let lastAspects = [];

// API proxy
async function callAstro(path, data) {
  const resp = await fetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, data })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = json?.detail;
    const msg = (typeof detail === "string" && detail) || detail?.message || JSON.stringify(detail || json) || "API error";
    throw new Error(msg);
  }
  return json;
}

// Helpers
function readCommon(fd) {
  const [y,m,d] = String(fd.get("date_iso")).split("-").map(n=>parseInt(n,10));
  const [hh,mm] = String(fd.get("time_hm")).split(":").map(n=>parseInt(n,10));
  const seconds = parseInt(fd.get("seconds") || "0", 10);
  const base = {
    year:y, month:m, date:d,
    hours:hh, minutes:mm, seconds,
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
const buildPlanetsPayload = (fd) => { const {config, ...rest} = readCommon(fd); return { ...rest, config }; };

function signNameFromDeg(deg){
  const names=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  return names[Math.floor(((deg % 360)+360)%360/30)];
}
function buildWholeSignHouses(planets, lang="en"){
  const asc = planets.find(p => (p?.planet?.[lang] ?? p?.planet?.en) === "Ascendant");
  if (!asc) return [];
  const signNum = asc?.zodiac_sign?.number;
  if (!signNum) return [];
  const startDeg = (signNum - 1) * 30;
  const houses=[];
  for (let i=0;i<12;i++){
    const deg = (startDeg + i*30) % 360;
    houses.push({ House:i+1, degree:deg, normDegree:0, zodiac_sign:{ number:((Math.floor(deg/30))%12)+1, name:{ en: signNameFromDeg(deg) } }});
  }
  return houses;
}
function computeAspectsLocal(planets, { lang="en", allowed=null, exclude=[], orbs=DEFAULT_ORBS }={}){
  const entries = planets.map(p => {
    const name=(p?.planet?.[lang] ?? p?.planet?.en ?? "").trim();
    return { name, deg:Number(p?.fullDegree||0) };
  }).filter(e => e.name && !exclude.includes(e.name));

  const ASPECT_DEGREES = {
    "Conjunction": 0, "Opposition": 180, "Square": 90, "Trine": 120, "Sextile": 60,
    "Quincunx": 150, "Semi-Sextile": 30, "Quintile": 72, "Octile": 45, "Sesquiquadrate": 135,
    "Septile": 51.4286, "Novile": 40
  };

  const out=[];
  for (let i=0;i<entries.length;i++){
    for (let j=i+1;j<entries.length;j++){
      const a=entries[i], b=entries[j];
      const diff = Math.abs(a.deg - b.deg);
      const angle = Math.min(diff, 360 - diff);
      for (const [asp,target] of Object.entries(ASPECT_DEGREES)){
        if (allowed && !allowed.includes(asp)) continue;
        const orb = orbs?.[asp] ?? DEFAULT_ORBS[asp] ?? 0;
        const exactness = Math.abs(angle - target);
        if (exactness <= orb){ out.push({ planet_1:{[lang]:a.name}, planet_2:{[lang]:b.name}, aspect:{[lang]:asp}, exactness }); break; }
      }
    }
  }
  return out;
}

// Tables
function tableFromRows(el, rows, cols){
  const thead = `<thead><tr>${cols.map(c=>`<th>${c.label}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${
    rows.map(r => `<tr>${cols.map(c => `<td title="${String(r[c.key] ?? "")}">${fmt(r[c.key])}</td>`).join("")}</tr>`).join("")
  }</tbody>`;
  el.innerHTML = thead + tbody;
}
function renderPlanetsTable(rows, lang){
  const flat = rows.map(r => ({
    planet: r?.planet?.[lang] ?? "",
    sign: r?.zodiac_sign?.name?.[lang] ?? "",
    fullDegree: round2(r?.fullDegree),
    normDegree: round2(r?.normDegree),
    retro: String(r?.isRetro).toLowerCase()==="true"
  }));
  tableFromRows(planetsTable, flat, [
    {key:"planet",label:"Planet"},
    {key:"sign",label:"Sign"},
    {key:"fullDegree",label:"Longitude° (0–360)"},
    {key:"normDegree",label:"Norm° (0–30)"},
    {key:"retro",label:"Retro"}
  ]);
}
function renderHousesTable(rows, lang){
  const flat = rows.map(r => ({
    house:r?.House,
    sign:r?.zodiac_sign?.name?.[lang] ?? r?.zodiac_sign?.name?.en ?? "",
    degree: round2(r?.degree),
    normDegree: round2(r?.normDegree)
  }));
  tableFromRows(housesTable, flat, [
    {key:"house",label:"House"},
    {key:"sign",label:"Sign"},
    {key:"degree",label:"Longitude° (0–360)"},
    {key:"normDegree",label:"Norm° (0–30)"}
  ]);
}
function renderAspectsTable(rows, lang){
  const flat = rows.map(r => ({ p1:r?.planet_1?.[lang] ?? "", p2:r?.planet_2?.[lang] ?? "", aspect:r?.aspect?.[lang] ?? "" }));
  tableFromRows(aspectsTable, flat, [
    {key:"p1",label:"Body A"},
    {key:"p2",label:"Body B"},
    {key:"aspect",label:"Aspect"}
  ]);
}

// Submit flow
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const lang = currentLang(fd);
  const submitBtn = form.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  const labelOrig = submitBtn.textContent;
  submitBtn.textContent = "Generating…";

  try {
    const planetsRes = await callAstro("/western/planets", buildPlanetsPayload(fd));
    const planets = planetsRes.output || [];

    const houses = buildWholeSignHouses(planets, lang);

    const allowed = (fd.get("allowed_aspects") || "").trim()
      ? fd.get("allowed_aspects").split(",").map(s => s.trim()).filter(Boolean)
      : null;
    const exclude = (fd.get("exclude_planets") || "").trim()
      ? fd.get("exclude_planets").split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const orbs = (()=>{ try{return JSON.parse(fd.get("orb_values")||"");}catch{return DEFAULT_ORBS;} })();

    const aspects = computeAspectsLocal(planets, { lang, allowed, exclude, orbs });

    lastPlanets = planets; lastHouses = houses; lastAspects = aspects;

    results.classList.remove("hidden");
    renderPlanetsTable(planets, lang);
    renderHousesTable(houses, lang);
    renderAspectsTable(aspects, lang);
    chart.render(planets, houses, aspects);
    if (insightsOut) insightsOut.textContent = "";
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = labelOrig;
  }
});

// Insights button (1 extra API call for today's transits)
if (btnInsights){
  btnInsights.addEventListener("click", async () => {
    if (!lastPlanets.length){ alert("Generate your chart first."); return; }
    btnInsights.disabled = true; const old=btnInsights.textContent; btnInsights.textContent="Thinking…";
    try {
      const fd = new FormData(form);
      const now = new Date();
      const payload = {
        year: now.getUTCFullYear(), month: now.getUTCMonth()+1, date: now.getUTCDate(),
        hours: now.getUTCHours(), minutes: now.getUTCMinutes(), seconds: now.getUTCSeconds(),
        latitude: parseFloat(fd.get("latitude"))||0, longitude: parseFloat(fd.get("longitude"))||0, timezone: 0,
        config: {
          observation_point: fd.get("observation_point") || "topocentric",
          ayanamsha: fd.get("ayanamsha") || "tropical",
          language: fd.get("language") || "en"
        }
      };
      const tr = await callAstro("/western/planets", payload);
      const transit = tr.output || [];
      insightsOut.textContent = buildInsightsText(lastPlanets, lastHouses, lastAspects, transit);
    } catch(e){
      alert("Insights error: " + e.message);
    } finally {
      btnInsights.disabled=false; btnInsights.textContent=old;
    }
  });
}
