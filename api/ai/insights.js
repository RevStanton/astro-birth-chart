export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GROQ_BASE = process.env.GROQ_BASE || "https://api.groq.com/openai/v1";
  const model = req.body?.model || "llama-3.1-70b-versatile";

  if (!GROQ_API_KEY) {
    return res.status(500).json({ message: "GROQ_API_KEY not configured" });
  }

  try {
    const r = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: req.body?.system || "You are a friendly astrology explainer." },
          { role: "user", content: req.body?.prompt || "Write a short friendly note." }
        ],
        max_tokens: req.body?.max_tokens ?? 700,
        temperature: req.body?.temperature ?? 0.7,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("[api/ai/insights] upstream error", r.status, detail);
      return res.status(r.status).json({ message: "Groq error", detail });
    }
    const data = await r.json();
    res.json({ text: data?.choices?.[0]?.message?.content || "", raw: data });
  } catch (err) {
    console.error("[api/ai/insights] error", err);
    res.status(500).json({ message: "Server error" });
  }
}
