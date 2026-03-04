export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  if(!process.env.ANTHROPIC_API_KEY){
    return res.status(500).json({error:'Missing ANTHROPIC_API_KEY'});
  }

  try{
    const { prompt } = req.body || {};
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version":"2023-06-01",
        "content-type":"application/json"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-sonnet-20240229",
        max_tokens: 350,
        messages: [{ role:"user", content: String(prompt || "Write a short tiling job description.") }]
      })
    });

    const data = await r.json();
    if(!r.ok) return res.status(r.status).json(data);
    return res.status(200).json(data);
  }catch(e){
    return res.status(500).json({error: e?.message || "Server error"});
  }
}
