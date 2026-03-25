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
      detail: 'Please add OPENROUTER_API_KEY to Vercel Environment Variables.'
    });
  }

  const data = JSON.stringify({
    model: 'openai/gpt-3.5-turbo',
    messages: req.body.messages,
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
      'HTTP-Referer': 'https://smartcurriculum.vercel.app',
      'X-Title': 'SMARTCURRICULUM',
      'Content-Length': data.length,
    },
  };

  const request = https.request(options, (response) => {
    let responseData = '';

    response.on('data', (chunk) => {
      responseData += chunk;
    });

    response.on('end', () => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        res.status(200).json(JSON.parse(responseData));
      } else {
        res.status(response.statusCode).json({ error: 'OpenRouter API error', detail: responseData });
      }
    });
  });

  request.on('error', (error) => {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  });

  request.write(data);
  request.end();
};
