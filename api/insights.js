/**
 * Vercel Serverless Function: api/insights.js
 * Proxy for OpenRouter API to hide the secret key.
 */
const https = require('https');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'OpenRouter API key not configured on server.',
      detail: 'Please ensure OPENROUTER_API_KEY is set in Vercel Environment Variables.'
    });
  }

  // Ensure body is parsed (Vercel usually does this for POST with Content-Type: application/json)
  const messages = req.body && req.body.messages ? req.body.messages : [];

  const postData = JSON.stringify({
    model: 'openai/gpt-3.5-turbo',
    messages: messages,
    temperature: 0.7,
    max_tokens: 600,
  });

  const options = {
    hostname: 'openrouter.ai',
    port: 443,
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://smartcurriculum.vercel.app', // Update if necessary
      'X-Title': 'SMARTCURRICULUM',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const request = https.request(options, (response) => {
    let responseData = '';

    response.on('data', (chunk) => {
      responseData += chunk;
    });

    response.on('end', () => {
      try {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          res.status(200).json(JSON.parse(responseData));
        } else {
          res.status(response.statusCode).json({ error: 'OpenRouter API error', detail: responseData });
        }
      } catch (err) {
        res.status(500).json({ error: 'Failed to parse response from OpenRouter', detail: responseData });
      }
    });
  });

  request.on('error', (error) => {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  });

  request.write(postData);
  request.end();
};
