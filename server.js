// server.js
// Express static server + API proxies (FreeAstrologyAPI + Groq)
// Run: node server.js
// Env (.env):
//   FREE_ASTROLOGY_API_KEY=YOUR_FREE_ASTROLOGY_API_KEY
//   FREE_ASTROLOGY_BASE=https://json.freeastrologyapi.com
//   GROQ_API_KEY=YOUR_GROQ_API_KEY
//   GROQ_API_BASE=https://api.groq.com/openai/v1
//   PORT=3000

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Config from env ----
const ASTRO_KEY  = process.env.FREE_ASTROLOGY_API_KEY || "";
const ASTRO_BASE = (process.env.FREE_ASTROLOGY_BASE || "https://json.freeastrologyapi.com").replace(/\/+$/,"");

const GROQ_KEY   = process.env.GROQ_API_KEY || "";
const GROQ_BASE  = (process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1").replace(/\/+$/,"");

// ---- Middleware ----
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public"), {
  etag: false,
  lastModified: false,
  cacheControl: false
}));

// ---- Health ----
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    astroConfigured: Boolean(ASTRO_KEY),
    groqConfigured: Boolean(GROQ_KEY)
  });
});

// ---- Helper: fetch with timeout ----
async function fetchWithTimeout(url, opts = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    return r;
  } finally {
    clearTimeout(t);
  }
}

// ---- FreeAstrologyAPI proxy (hides your key) ----
async function proxyAstro(req, res, endpointPath) {
  if (!ASTRO_KEY) {
    return res.status(501).json({ ok: false, error: "FREE_ASTROLOGY_API_KEY missing (Lite mode only)" });
  }
  try {
    const url = `${ASTRO_BASE}${endpointPath}`;
    const r = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ASTRO_KEY
      },
      body: JSON.stringify(req.body || {})
    }, 25000);

    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (err) {
    console.error("Astro proxy error:", err);
    res.status(500).json({ ok: false, error: "Astrology proxy error" });
  }
}

// Routes for the 3 endpoints you use
app.post("/api/western/planets", (req, res) => proxyAstro(req, res, "/western/planets"));
app.post("/api/western/houses",  (req, res) => proxyAstro(req, res, "/western/houses"));
app.post("/api/western/aspects", (req, res) => proxyAstro(req, res, "/western/aspects"));

// ---- AI insights via Groq (optional) ----
app.post("/ai/insights", async (req, res) => {
  if (!GROQ_KEY) {
    return res.status(501).json({ ok: false, error: "GROQ_API_KEY missing (AI disabled)" });
  }
  try {
    const { birth, big3, aspectsTop, housesBrief, planetsBrief } = req.body || {};

    const prompt = `
You are an astrologer who writes warm, grounded, practical reflections.
Audience: curious newcomer. Keep it conversational, specific, and empowering. No fatalism.
Tone: friendly coach + 1 short poetic line max; then concrete advice.

Birth:
- Date/Time: ${birth?.dateISO || ""} ${birth?.timeHM || ""} (UTC${birth?.timezone >= 0 ? "+" : ""}${birth?.timezone ?? ""})
- Location: ${birth?.cityState || `${birth?.latitude}, ${birth?.longitude}`}

Big 3:
- Sun: ${big3?.sun || ""}
- Moon: ${big3?.moon || ""}
- Rising: ${big3?.rising || ""}

Planets in signs (selected):
${(planetsBrief || []).slice(0,12).map(s => `- ${s}`).join("\n")}

Houses brief (selected):
${(housesBrief || []).slice(0,12).map(s => `- ${s}`).join("\n")}

Major aspects (top themes):
${(aspectsTop || []).slice(0,12).map(a => `- ${a}`).join("\n")}

Write:
1) A 2–3 sentence snapshot tying Sun/Moon/Rising together.
2) 3 numbered themes you see (each 2–3 sentences, actionable).
3) A tiny “today’s focus” (1 sentence) someone could try immediately.
Avoid jargon unless explained. Do not re-list placements—interpret them.
`.trim();

    const url = `${GROQ_BASE}/chat/completions`;
    const r = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a concise, kind, practical astrologer." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 700
      })
    }, 30000);

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ ok: false, error: errText });
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content?.trim?.() || "";
    return res.json({ ok: true, content });
  } catch (err) {
    console.error("Groq insights error:", err);
    return res.status(500).json({ ok: false, error: "AI proxy error" });
  }
});

// ---- Fallback for HTML routes (optional: serve index) ----
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// If you want deep links like /learn to serve learn.html explicitly:
app.get("/learn", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "learn.html"));
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Astrology API: ${ASTRO_KEY ? "configured" : "not set (Lite mode)"} | Base: ${ASTRO_BASE}`);
  console.log(`Groq API:      ${GROQ_KEY ? "configured" : "not set"}           | Base: ${GROQ_BASE}`);
});
