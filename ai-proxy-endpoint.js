// Add this endpoint to the Railway auth backend (server.js / index.js)
// Requires env var: ANTHROPIC_API_KEY
// Place after existing /auth/* routes.

app.post('/ai/import', async (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://runningx42.github.io');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

// Also add OPTIONS handler for CORS preflight:
app.options('/ai/import', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://runningx42.github.io');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST');
  res.sendStatus(204);
});
