// Add these endpoints to the Railway auth backend (server.js / index.js)
// Requires env var: ANTHROPIC_API_KEY
// Place after existing /auth/* routes.

const ALLOWED_ORIGINS = new Set([
  'https://runningx42.github.io',
  'https://runyo.app',
]);
const _cors = (req, res) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type');
};

// CORS preflight for both endpoints
app.options('/ai/*', (req, res) => {
  _cors(req, res);
  res.header('Access-Control-Allow-Methods', 'POST, GET');
  res.sendStatus(204);
});

// Proxy to Anthropic API — adds API key server-side
app.post('/ai/import', async (req, res) => {
  _cors(req, res);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({ ...req.body, model: 'claude-sonnet-4-6', max_tokens: 8000 }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

// Debug log — stores last 50 import attempts in memory for inspection
const _debugLog = [];
app.post('/ai/debug-log', (req, res) => {
  _cors(req, res);
  _debugLog.unshift({ ...req.body, _received: new Date().toISOString() });
  if (_debugLog.length > 50) _debugLog.length = 50;
  console.log('[AI debug]', req.body.ts, req.body.fileName, req.body.error || 'no-error');
  res.json({ ok: true });
});

// View debug log (protect with a secret if needed)
app.get('/ai/debug-log', (req, res) => {
  res.json(_debugLog);
});
