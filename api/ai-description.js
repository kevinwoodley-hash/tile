module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: "ANTHROPIC_API_KEY not configured on server.",
            debug: `Available env keys: ${Object.keys(process.env).filter(k => k.startsWith("ANTHROPIC") || k.startsWith("VERCEL")).join(", ") || "none matching"}`
        });
    }

    const { prompt } = req.body || {};
    if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
    }

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 400,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err?.error?.message || "Anthropic API error" });
        }

        const data = await response.json();
        const text = data?.content?.[0]?.text || "";
        return res.status(200).json({ text });

    } catch (e) {
        return res.status(500).json({ error: e.message || "Server error" });
    }
}
