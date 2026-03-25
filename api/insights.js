/**
 * Vercel Serverless Function: api/insights.js
 * Proxy for OpenRouter API to hide the secret key.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!req.body) {
    return res.status(400).json({ error: 'Missing request body' });
  }
  const { messages, attendanceSummary } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('SERVER ERROR: OPENROUTER_API_KEY is missing.');
    return res.status(500).json({ 
      error: 'OpenRouter API key not configured on server.',
      detail: 'Please ensure OPENROUTER_API_KEY is set in Vercel Environment Variables.'
    });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://smartcurriculum.vercel.app', // Update with actual domain
        'X-Title': 'SMARTCURRICULUM',
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
