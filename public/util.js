export const MINOR_ASPECTS = new Set([
  "Semi-Sextile","Quintile","Septile","Octile","Novile","Quincunx","Sesquiquadrate"
]);

export const ASTEROIDS_OR_POINTS = new Set([
  "Ceres","Vesta","Juno","Pallas","Lilith","Chiron","Mean Node","True Node","Ascendant","Descendant","MC","IC"
]);

export const CORE_PLANETS = new Set(["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]);

export const ASPECT_DEGREES = {
  "Conjunction": 0, "Opposition": 180, "Square": 90, "Trine": 120, "Sextile": 60,
  "Quincunx": 150, "Semi-Sextile": 30, "Quintile": 72, "Octile": 45, "Sesquiquadrate": 135,
  "Septile": 51.4286, "Novile": 40
};

export const DEFAULT_ORBS = {
  Conjunction: 3, Opposition: 5, Square: 5, Trine: 5, Sextile: 5, Quincunx: 5,
  "Semi-Sextile": 5, Quintile: 5, Octile: 5, Sesquiquadrate: 5, Septile: 3, Novile: 3
};

export function toRadians(deg){ return (deg * Math.PI) / 180; }
export const round2 = v => (typeof v === "number" ? Math.round(v * 100) / 100 : v);
export const round4 = v => (typeof v === "number" ? Math.round(v * 10000) / 10000 : v);
export const fmt = v => (v === true ? "Yes" : v === false ? "No" : v ?? "");
export function normalizeBool(v){ if (typeof v === "boolean") return v; if (typeof v === "string") return v.toLowerCase()==="true"; return false; }
export function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
export function aspectColor(aspect){
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

export function pointOnCircle(cx, cy, r, deg){
  const rad = toRadians(deg);
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function signNameFromDeg(deg){
  const names = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  return names[Math.floor(((deg % 360) + 360) % 360 / 30)];
}

export function currentLang(fd){ return fd.get("language") || "en"; }
