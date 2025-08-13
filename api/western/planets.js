export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const FREE_ASTROLOGY_BASE = process.env.FREE_ASTROLOGY_BASE || "https://json.freeastrologyapi.com";
  const FREE_ASTROLOGY_API_KEY = process.env.FREE_ASTROLOGY_API_KEY;

  if (!FREE_ASTROLOGY_API_KEY) {
    return res.status(500).json({ message: "FREE_ASTROLOGY_API_KEY not configured" });
  }

  try {
    const upstream = await fetch(`${FREE_ASTROLOGY_BASE}/western/planets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": FREE_ASTROLOGY_API_KEY,
      },
      body: JSON.stringify(req.body || {}),
    });

    const text = await upstream.text();
    res.status(upstream.status).type("application/json").send(text);
  } catch (err) {
    console.error("[api/western/planets] error", err);
    res.status(500).json({ message: "Server error" });
  }
}
