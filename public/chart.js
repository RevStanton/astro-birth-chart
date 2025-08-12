import {
  MINOR_ASPECTS, ASTEROIDS_OR_POINTS,
  toRadians, pointOnCircle, clamp, normalizeBool, aspectColor
} from "./util.js";

export function setupChart({ canvas, minorToggle, astToggle, tooltip }){
  const ctx = canvas.getContext("2d");
  let lastPlanets = [];
  let lastHouses = [];
  let lastAspects = [];
  let lastPoints = [];

  function drawCircle(cx, cy, r){
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#2c3358"; ctx.lineWidth = 2; ctx.stroke();
  }
  function drawTick(cx, cy, angleRad, r1, r2){
    const x1 = cx + r1 * Math.cos(angleRad), y1 = cy + r1 * Math.sin(angleRad);
    const x2 = cx + r2 * Math.cos(angleRad), y2 = cy + r2 * Math.sin(angleRad);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = "#2c3358"; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawWheel(planets, houses){
    const cx = canvas.width/2, cy = canvas.height/2;
    const R_OUTER=240, R_HOUSES=210, R_PLANETS=180;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawCircle(cx,cy,R_OUTER); drawCircle(cx,cy,R_HOUSES); drawCircle(cx,cy,R_PLANETS);
    for (let i=0;i<12;i++) drawTick(cx,cy,toRadians(i*30), R_HOUSES-6,R_OUTER);
    houses.forEach(h => drawTick(cx,cy,toRadians(Number(h?.degree||0)), R_HOUSES-5,R_OUTER));

    lastPoints = [];
    const R_LABEL = R_PLANETS + 12, EDGE_PAD = 8;
    const useFullLabels = true;
    const labelSlots = [];
    const showAst = astToggle ? astToggle.checked : true;

    planets.forEach(p => {
      const name = p?.planet?.en || "•";
      if (!showAst && ASTEROIDS_OR_POINTS.has(name)) return;
      const deg = Number(p?.fullDegree || 0);
      const [x,y] = pointOnCircle(cx,cy,R_PLANETS,deg);
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle="#e9ecff"; ctx.fill();

      let label = useFullLabels ? name : name; // keep full labels for now
      if (normalizeBool(p?.isRetro)) label += "R";

      let placeDeg = deg;
      while (labelSlots.some(a => Math.abs(a - placeDeg) < 8)) placeDeg += 3;
      labelSlots.push(placeDeg);

      const [lx,ly] = pointOnCircle(cx,cy,R_LABEL,placeDeg);
      ctx.font = "12px ui-sans-serif, system-ui, Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
      const m = ctx.measureText(label); const w=m.width, h=12;
      const sideShift = (placeDeg>90 && placeDeg<270) ? -6 : 6;
      let tx = lx + sideShift, ty = ly;
      tx = clamp(tx, EDGE_PAD + w/2, canvas.width - EDGE_PAD - w/2);
      ty = clamp(ty, EDGE_PAD + h/2, canvas.height - EDGE_PAD - h/2);
      ctx.fillStyle="#c8cee9"; ctx.fillText(label, tx, ty);

      lastPoints.push({ name, x, y, deg });
    });
  }

  function drawAspectLines(aspects, planets, lang="en"){
    const degreeBy = new Map();
    const showAst = astToggle ? astToggle.checked : true;
    const showMinor = minorToggle ? minorToggle.checked : false;
    planets.forEach(p => {
      const name = (p?.planet?.[lang] ?? p?.planet?.en ?? "").trim();
      if (!showAst && ASTEROIDS_OR_POINTS.has(name)) return;
      degreeBy.set(name, Number(p?.fullDegree||0));
    });
    const cx = canvas.width/2, cy = canvas.height/2, R_PLANETS = 180;

    aspects.forEach(a => {
      const asp = a?.aspect?.[lang] ?? a?.aspect?.en;
      if (!showMinor && MINOR_ASPECTS.has(asp)) return;
      const p1 = a?.planet_1?.[lang] ?? a?.planet_1?.en;
      const p2 = a?.planet_2?.[lang] ?? a?.planet_2?.en;
      const d1 = degreeBy.get(p1), d2 = degreeBy.get(p2);
      if (d1==null || d2==null) return;
      const [x1,y1] = pointOnCircle(cx,cy,R_PLANETS,d1);
      const [x2,y2] = pointOnCircle(cx,cy,R_PLANETS,d2);
      ctx.lineWidth = 1.2; ctx.globalAlpha=.7; ctx.strokeStyle=aspectColor(asp);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.globalAlpha=1;
    });
  }

  // Hover highlight
  if (canvas && tooltip){
    canvas.addEventListener("mousemove", (e) => {
      if (!lastPoints.length) return;
      const r = canvas.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
      let best=null, bestD2=100; // 10px radius
      for (const pt of lastPoints){ const d2=(pt.x-mx)**2+(pt.y-my)**2; if (d2<bestD2){best=pt; bestD2=d2;} }
      if (!best){ tooltip.hidden=true; redraw(); return; }
      tooltip.style.left = `${e.clientX}px`; tooltip.style.top = `${e.clientY}px`; tooltip.textContent = best.name; tooltip.hidden=false;

      // redraw with focused lines
      redraw(true);
      const lang="en";
      const focused = lastAspects.filter(a => {
        const p1 = a?.planet_1?.en, p2=a?.planet_2?.en;
        return p1===best.name || p2===best.name;
      });
      drawAspectLines(focused, lastPlanets, lang);
    });
    canvas.addEventListener("mouseleave", ()=>{ tooltip.hidden=true; redraw(); });
  }

  function redraw(dim=false){
    drawWheel(lastPlanets, lastHouses);
    if (dim) { ctx.globalAlpha=.15; drawAspectLines(lastAspects, lastPlanets, "en"); ctx.globalAlpha=1; }
    else drawAspectLines(lastAspects, lastPlanets, "en");
  }

  // Public API from this module
  return {
    render(planets, houses, aspects){
      lastPlanets = planets; lastHouses = houses; lastAspects = aspects;
      redraw(false);
    },
    bindToggles(){
      [minorToggle, astToggle].forEach(el => el && el.addEventListener("change", () => redraw(false)));
    }
  };
}

