import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const API_KEY = process.env.FREE_ASTROLOGY_API_KEY;
const BASE = (process.env.FREE_ASTROLOGY_BASE || "https://json.freeastrologyapi.com").replace(/\/+$/, "");

if (!API_KEY) {
  console.warn("⚠️ FREE_ASTROLOGY_API_KEY not set. Create a .env from .env.example and add your key.");
}

/**
 * Generic proxy:
 * POST /api/proxy
 * body: { path: "/western/planets", data: {...} }
 */
app.post("/api/proxy", async (req, res) => {
  try {
    const { path, data } = req.body || {};
    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return res.status(400).json({ error: "Missing or invalid 'path' (must start with '/')." });
    }
    const url = BASE + path;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
      },
      body: JSON.stringify(data || {})
    });

    const contentType = upstream.headers.get("content-type") || "";
    const text = await upstream.text();
    const payload = contentType.includes("application/json") ? JSON.parse(text) : { raw: text };

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream error", detail: payload });
    }
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Proxy error", detail: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
