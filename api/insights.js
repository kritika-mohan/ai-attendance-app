export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // TEST: Check if API key is even visible to Vercel
  const apiKey = process.env.OPENROUTER_API_KEY;

  return res.status(200).json({ 
    status: "API is reachable!",
    method: req.method,
    hasApiKey: !!apiKey,
    keyPrefix: apiKey ? apiKey.substring(0, 10) + "..." : "none",
    note: "If you see this, the function is working. The issue is likely the body data or OpenRouter connection."
  });
}
