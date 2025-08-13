// public/insights-ai.js
// Tries AI via /ai/insights; falls back to local insight generator if not configured.

function buildBriefsFromState(state) {
  const planets = state?.planets || [];
  const houses  = state?.houses  || [];
  const aspects = state?.aspects || [];

  const find = n => planets.find(p => p?.planet?.en === n);
  const sun = find("Sun"), moon = find("Moon"), asc = find("Ascendant");

  const big3 = {
    sun:  sun ? `${sun.planet.en} in ${sun.zodiac_sign?.name?.en}` : "",
    moon: moon ? `${moon.planet.en} in ${moon.zodiac_sign?.name?.en}` : "",
    rising: asc ? `Rising ${asc.zodiac_sign?.name?.en}` : ""
  };

  // A few readable bullets for the prompt (keep short)
  const planetsBrief = planets
    .filter(p => ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"].includes(p?.planet?.en))
    .map(p => `${p.planet.en} in ${p.zodiac_sign?.name?.en}`);

  const housesBrief = houses.map(h => `${h.House} — ${h.zodiac_sign?.name?.en}`);

  const majors = new Set(["Conjunction","Opposition","Square","Trine","Sextile"]);
  const aspectsTop = (aspects || [])
    .filter(a => majors.has(a?.aspect?.en))
    .map(a => `${a.planet_1?.en} ${a.aspect?.en} ${a.planet_2?.en}`);

  return { big3, planetsBrief, housesBrief, aspectsTop };
}

async function generateAIInsights(state) {
  const el = document.getElementById("insights-output");
  if (!el) return;

  el.textContent = "Thinking…";
  try {
    const { big3, planetsBrief, housesBrief, aspectsTop } = buildBriefsFromState(state);

    const resp = await fetch("/ai/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birth: state.birth, big3, planetsBrief, housesBrief, aspectsTop
      })
    });

    if (resp.status === 501) {
      // AI not configured -> let app.js fallback handle it
      el.textContent = "";
      return null;
    }

    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "AI failed");
    el.innerText = data.content?.trim() || "(No content returned)";
    return data.content?.trim() || "";
  } catch (e) {
    console.error("AI insights error:", e);
    el.textContent = "Couldn’t generate AI insights right now.";
    return null;
  }
}

// expose for app.js
window.__ASTRO_AI_INSIGHTS = { generateAIInsights };
