export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY on server (Vercel env var)." });

    const { style = "Professional", customerName = "", rooms = "" } = req.body || {};

    const prompt =
      `Write a single short paragraph (60-90 words) describing the scope of work for a tiling job quote. ` +
      `Style: ${style}. Customer: ${customerName}. Rooms: ${rooms}. ` +
      `Use UK English, third person, professional tone.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 220,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || data?.message || "Anthropic API error";
      return res.status(r.status).json({ error: msg, raw: data });
    }

    const text = data?.content?.[0]?.text || "";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
