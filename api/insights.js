const https = require('https');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Collect the request body manually to be 100% sure we have it
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      let messages = [];
      if (body) {
        const parsedBody = JSON.parse(body);
        messages = parsedBody.messages || [];
      } else if (req.body && req.body.messages) {
        messages = req.body.messages;
      }

      const apiKey = process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ 
          error: 'Configuration Error', 
          detail: 'API key is missing from Vercel environment variables.' 
        });
      }

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
          'HTTP-Referer': 'https://smartcurriculum.vercel.app',
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
            const parsed = JSON.parse(responseData);
            res.status(response.statusCode).json(parsed);
          } catch (e) {
            res.status(500).json({ error: 'OpenRouter Parsing Error', detail: responseData });
          }
        });
      });

      request.on('error', (error) => {
        res.status(500).json({ error: 'OpenRouter Request Error', detail: error.message });
      });

      request.write(postData);
      request.end();

    } catch (err) {
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  });
};
