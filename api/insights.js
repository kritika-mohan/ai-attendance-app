/**
 * api/insights.js - Super Robust Version
 * Handles its own body parsing and uses standard https.
 */
const https = require('https');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Debugging Helper
  const debug = (msg, data = {}) => {
    console.log(`[DEBUG] ${msg}`, data);
  };

  try {
    let body = req.body;
    
    // If Vercel didn't parse the body automatically, we do it manually
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body', detail: e.message });
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Missing API Key', 
        detail: 'OPENROUTER_API_KEY is not set in Vercel Environment Variables.' 
      });
    }

    const postData = JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: body.messages || [],
      temperature: 0.7,
      max_tokens: 600,
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://smartcurriculum.vercel.app',
        'X-Title': 'SMARTCURRICULUM',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (response) => {
      let responseBody = '';
      response.on('data', (d) => { responseBody += d; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          res.status(response.statusCode).json(parsed);
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse OpenRouter response', detail: responseBody });
        }
      });
    });

    request.on('error', (e) => {
      res.status(500).json({ error: 'Connection to OpenRouter failed', detail: e.message });
    });

    request.write(postData);
    request.end();

  } catch (err) {
    res.status(500).json({ 
      error: 'In-function Crash', 
      message: err.message,
      stack: err.stack 
    });
  }
};
