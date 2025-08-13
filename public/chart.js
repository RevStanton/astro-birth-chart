// public/chart.js
// ES module that exports drawWheel(planets, houses, aspects, opts)

const ASPECT_COLORS = {
  Conjunction: "#6ea8ff",
  Trine:       "#38c172",
  Square:      "#f66d6d",
  Sextile:     "#fbd38d",
  Opposition:  "#c084fc",
};

const TAU = Math.PI * 2;
const toRad = (deg) => (deg * Math.PI) / 180;

function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.scale(dpr, dpr);
  return { ctx, w: cssW, h: cssH };
}

function polar(xc, yc, r, angDeg) {
  const a = toRad(angDeg - 90); // 0° at top
  return { x: xc + r * Math.cos(a), y: yc + r * Math.sin(a) };
}

function clear(ctx, w, h) {
  ctx.fillStyle = "#0b0f2b";
  ctx.fillRect(0, 0, w, h);
}

function drawRings(ctx, cx, cy, R) {
  ctx.strokeStyle = "#2a335f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();

  // sign spokes (every 30°)
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  for (let d = 0; d < 360; d += 30) {
    const p1 = polar(cx, cy, R, d);
    const p2 = polar(cx, cy, R * 0.86, d);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.restore();

  // minor ticks (every 5°)
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  for (let d = 0; d < 360; d += 5) {
    const r1 = d % 30 === 0 ? R : R * 0.98;
    const r2 = R * 0.95;
    const p1 = polar(cx, cy, r1, d);
    const p2 = polar(cx, cy, r2, d);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSigns(ctx, cx, cy, R) {
  const names = [
    "Aries","Taurus","Gemini","Cancer","Leo","Virgo",
    "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"
  ];
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 12; i++) {
    const midDeg = i * 30 + 15;
    const p = polar(cx, cy, R * 0.80, midDeg);
    ctx.fillText(names[i], p.x, p.y);
  }
}

function labelFromPlanet(p) {
  const name = p?.planet?.en || "";
  const retro = String(p?.isRetro).toLowerCase() === "true" ? " R" : "";
  return `${name}${retro}`;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  const rr = Math.min(r, h/2, w/2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawPlanets(ctx, cx, cy, R, planets) {
  const baseR = R * 0.72;
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  planets.forEach((p, idx) => {
    const deg = (p?.fullDegree ?? 0) % 360;
    const dot = polar(cx, cy, baseR, deg);

    // planet dot
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 3, 0, TAU);
    ctx.fill();

    // label
    const lbl = labelFromPlanet(p);
    const radial = baseR + 16 + (idx % 3) * 10;
    const lp = polar(cx, cy, radial, deg);
    const textW = ctx.measureText(lbl).width;

    // connector
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dot.x, dot.y);
    ctx.lineTo(lp.x, lp.y);
    ctx.stroke();

    // background pill for readability
    ctx.fillStyle = "rgba(18,22,40,.85)";
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    roundRect(ctx, lp.x + 6, lp.y - 10, textW + 12, 20, 6, true, true);

    // text
    ctx.fillStyle = "#e8ebff";
    ctx.fillText(lbl, lp.x + 12, lp.y);
  });
}

function drawAspects(ctx, cx, cy, R, planets, aspects) {
  const pos = new Map();
  planets.forEach(p => {
    const name = p?.planet?.en;
    if (!name) return;
    pos.set(name, (p?.fullDegree ?? 0) % 360);
  });

  const radius = R * 0.62;

  aspects.forEach(a => {
    const A = a?.planet_1?.en, B = a?.planet_2?.en, asp = a?.aspect?.en;
    if (!A || !B || !asp) return;
    const dA = pos.get(A), dB = pos.get(B);
    if (typeof dA !== "number" || typeof dB !== "number") return;

    const p1 = polar(cx, cy, radius, dA);
    const p2 = polar(cx, cy, radius, dB);

    const col = ASPECT_COLORS[asp] || "rgba(255,255,255,.25)";
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });
}

/**
 * Draws the wheel.
 * @param {Array} planets
 * @param {Array} houses  (unused for now, kept for future)
 * @param {Array} aspects
 * @param {Object} opts   { canvas }
 */
export function drawWheel(planets = [], houses = [], aspects = [], opts = {}) {
  const canvas = opts.canvas || document.getElementById("wheel");
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas);
  clear(ctx, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.45;

  drawRings(ctx, cx, cy, R);
  drawSigns(ctx, cx, cy, R);
  drawAspects(ctx, cx, cy, R, planets, aspects);
  drawPlanets(ctx, cx, cy, R, planets);
}
