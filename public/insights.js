import { CORE_PLANETS, DEFAULT_ORBS, ASPECT_DEGREES } from "./util.js";

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

export function computeTransitToNatalAspects(transitPlanets, natalPlanets, opts){
  const allowed = ["Conjunction","Opposition","Square","Trine","Sextile"];
  const orbs = { ...DEFAULT_ORBS, ...(opts?.orbs||{}) };

  const tEntries = transitPlanets
    .map(p => ({ name: p?.planet?.en, deg: Number(p?.fullDegree||0) }))
    .filter(e => e.name && CORE_PLANETS.has(e.name));

  const nEntries = natalPlanets
    .map(p => ({ name: p?.planet?.en, deg: Number(p?.fullDegree||0) }))
    .filter(e => e.name);

  const out=[];
  tEntries.forEach(t => {
    nEntries.forEach(n => {
      const diff=Math.abs(t.deg-n.deg); const angle=Math.min(diff,360-diff);
      for (const asp of allowed){
        const target=ASPECT_DEGREES[asp]; const orb=orbs[asp]??0; const exactness=Math.abs(angle-target);
        if (exactness<=orb){ out.push({ from:t.name, to:n.name, aspect:asp, exactness }); break; }
      }
    });
  });
  return out;
}

function transitHint(t){
  const a=t.aspect, n=t.to; const soft=["Trine","Sextile"], hard=["Square","Opposition"];
  if (a==="Conjunction") return `Spotlight on ${n.toLowerCase()}. Lean into awareness and keep the volume at a mindful level.`;
  if (soft.includes(a)) return `Favorable window—make small moves around ${PLANET_VERBS[n] || "priorities"}.`;
  if (hard.includes(a)) return `Tension exposes growth edges. Avoid extremes; choose one concrete action to honor ${PLANET_VERBS[n] || "this area"}.`;
  return `Notice the nudge. Micro-adjustments go far today.`;
}

// public/insights.js
export function buildLocalInsights(state) {
  const p = state?.planets || [];
  const f = name => p.find(x => x?.planet?.en === name);
  const sun  = f("Sun")?.zodiac_sign?.name?.en;
  const moon = f("Moon")?.zodiac_sign?.name?.en;
  const asc  = f("Ascendant")?.zodiac_sign?.name?.en;

  const lines = [];
  if (sun && moon && asc) {
    lines.push(`Your vibe blends ${sun} Sun, ${moon} Moon, and ${asc} Rising—think identity, needs, and first impression working as a team.`);
  }
  // Add any other heuristic blurbs you had here…

  return lines.join("\n\n") || "Generate your chart first, then tap Generate Insights.";
}

export function buildInsightsText(natalPlanets, houses, natalAspects, transitPlanets){
  const getByName = (arr, name) => arr.find(p => p?.planet?.en === name);
  const sun = getByName(natalPlanets, "Sun");
  const moon = getByName(natalPlanets, "Moon");
  const asc  = getByName(natalPlanets, "Ascendant");

  const sunSign = sun?.zodiac_sign?.name?.en;
  const moonSign = moon?.zodiac_sign?.name?.en;
  const ascSign  = asc?.zodiac_sign?.name?.en;

  let intro = "Your snapshot:\n";
  if (sunSign)  intro += `• Sun in ${sunSign}: ${BLURB_SUN[sunSign] || ""}\n`;
  if (moonSign) intro += `• Moon in ${moonSign}: ${BLURB_MOON[moonSign] || ""}\n`;
  if (ascSign)  intro += `• Rising ${ascSign}: ${BLURB_ASC[ascSign] || ""}\n`;

  const core = natalPlanets.filter(p => CORE_PLANETS.has(p?.planet?.en));
  const elementCounts = { Fire:0, Earth:0, Air:0, Water:0 };
  const qualityCounts = { Cardinal:0, Fixed:0, Mutable:0 };
  core.forEach(p => {
    const s = p.zodiac_sign?.name?.en;
    if (s){ elementCounts[ELEMENT_BY_SIGN[s]]++; qualityCounts[QUALITY_BY_SIGN[s]]++; }
  });
  const dominantElement = Object.entries(elementCounts).sort((a,b)=>b[1]-a[1])[0][0];
  const dominantQuality = Object.entries(qualityCounts).sort((a,b)=>b[1]-a[1])[0][0];

  let themes = `\nChart themes:\n• Element emphasis: ${dominantElement}\n• Mode emphasis: ${dominantQuality}`;

  // Stellium
  const signCounts={}; core.forEach(p=>{ const s=p.zodiac_sign?.name?.en; if(s) signCounts[s]=(signCounts[s]||0)+1; });
  const stelliumSign = Object.entries(signCounts).find(([,c])=>c>=3)?.[0];
  if (stelliumSign) themes += `\n• Stellium in ${stelliumSign} (strong focus here)`;

  // Angular planets
  const angleDeg = (name) => getByName(natalPlanets, name)?.fullDegree ?? null;
  const A = angleDeg("Ascendant"), D = angleDeg("Descendant"), M = angleDeg("MC"), I = angleDeg("IC");
  const nearAngle = (deg, target) => {
    if (deg==null || target==null) return false;
    const diff = Math.abs(deg - target);
    return Math.min(diff, 360 - diff) <= 10;
  };
  const angular = core.filter(p => [A,D,M,I].some(t => nearAngle(p.fullDegree, t))).map(p => p.planet.en);
  if (angular.length) themes += `\n• Angular emphasis: ${angular.join(", ")}`;

  const retros = core.filter(p=>String(p.isRetro).toLowerCase()==="true").map(p=>p.planet.en+"R");
  if (retros.length) themes += `\n• Natal retrogrades: ${retros.join(", ")}`;

  // Natal aspects (expect app to include exactness)
  const natMaj = (natalAspects || []).filter(a => ["Conjunction","Opposition","Square","Trine","Sextile"].includes(a?.aspect?.en))
    .sort((a,b) => (a.exactness ?? 99) - (b.exactness ?? 99)).slice(0,5);
  let natTxt = "\nKey natal aspects:\n";
  if (!natMaj.length) natTxt += "• None of the major aspects stood out tightly.\n";
  else natMaj.forEach(a => { natTxt += `• ${a.planet_1.en} ${a.aspect.en} ${a.planet_2.en} — ${ASPECT_TONE[a.aspect.en]} how these two operate.\n`; });

  // Transits today
  const transitAspects = computeTransitToNatalAspects(transitPlanets, natalPlanets, { orbs: { Conjunction:2, Opposition:2, Square:2.5, Trine:2.5, Sextile:2 } });
  const topTransits = transitAspects.filter(t => CORE_PLANETS.has(t.to)).sort((a,b)=>a.exactness-b.exactness).slice(0,3);
  let today = "\nToday’s alignment for you:\n";
  if (!topTransits.length) today += "• Nothing major pinging the core today—take it steady and follow your baseline rhythm.\n";
  else topTransits.forEach(t => {
    const tone = ASPECT_TONE[t.aspect] || "interacts with";
    const verb = PLANET_VERBS[t.to] || "life";
    today += `• Transit ${t.from} ${t.aspect} natal ${t.to}: ${tone} your ${verb}. ${transitHint(t)}\n`;
  });

  const wrap = "\nTake what resonates, leave the rest. Use the easy flows; respect the edges. You’ve got this.";
  return [intro, themes, natTxt, today, wrap].join("\n");
}
