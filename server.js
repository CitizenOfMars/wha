const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
}

loadEnv();
const PORT = Number(process.env.PORT || 3000);

const DEFAULT_MESSAGES = [
  { id: 'm1', speaker: 'G1P1', avatar: 'purple', badge: 'P1', text: 'For the case study, should we recommend reporting the error right away, even if it delays the project?', time: '10:18 AM' },
  { id: 'm2', speaker: 'G1P3', avatar: 'teal', badge: 'P3', text: 'I think we should. The impact on the people using the system seems more important than the deadline.', time: '10:19 AM' },
  { id: 'm3', speaker: 'G1P4', avatar: 'gold', badge: 'P4', text: 'Agreed. Maybe we can also suggest a short-term workaround while the team fixes it?', time: '10:20 AM' }
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(DEFAULT_MESSAGES, null, 2), 'utf8');
  }
}

function readMessages() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (error) {
    console.warn('Failed to read messages file, using defaults.', error.message);
  }
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(DEFAULT_MESSAGES, null, 2), 'utf8');
  return DEFAULT_MESSAGES;
}

function writeMessages(messages) {
  ensureStorage();
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

function makeMessage(text, author = 'G1P2') {
  const assigned = {
    G1P2: { avatar: 'coral', badge: 'P2' },
    G1P1: { avatar: 'purple', badge: 'P1' },
    G1P3: { avatar: 'teal', badge: 'P3' },
    G1P4: { avatar: 'gold', badge: 'P4' }
  }[author] || { avatar: 'purple', badge: 'P1' };

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    speaker: author,
    avatar: assigned.avatar,
    badge: assigned.badge,
    text,
    time: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date()),
    you: author === 'G1P2'
  };
}

function coachDraft(text) {
  const lower = (text || '').toLowerCase();

  if (!text || !text.trim()) {
    return {
      label: 'Add a thought',
      reason: 'Start with your main point so the group can respond clearly.',
      suggestion: 'I think we should consider the impact on the people affected before deciding on the timeline.'
    };
  }

  if (lower.includes('whatever') || lower.includes('fine') || lower.includes('idk')) {
    return {
      label: 'Softer tone',
      reason: 'This phrasing could feel dismissive in a group decision.',
      suggestion: 'I understand the time pressure. Could we agree on the option that is safest for the people affected, then outline how we can manage the delay?'
    };
  }

  if (text.length < 28 || /^(yes|no|maybe|idk|i agree)[.! ]*$/i.test(text)) {
    return {
      label: 'Add specifics',
      reason: 'A little more detail can make your position easier to act on.',
      suggestion: 'I agree that we should report the error right away. We can also propose a short-term workaround while the team prepares the fix.'
    };
  }

  if (lower.includes('should') && !lower.includes('because')) {
    return {
      label: 'Make clearer',
      reason: 'Adding your reason can help the group evaluate the proposal.',
      suggestion: `${text.trim()} I think this protects the people affected while giving the team a clear next step.`
    };
  }

  if (lower.includes('but') && !lower.includes('also')) {
    return {
      label: 'Balance the idea',
      reason: 'This version keeps your concern while showing a constructive next step.',
      suggestion: `${text.trim()} I think we should also suggest a practical workaround while the team addresses the issue.`
    };
  }

  return {
    label: 'Make clearer',
    reason: 'This revision makes the request more specific while keeping your meaning.',
    suggestion: 'Could we decide on this today and assign who will prepare the recommendation? I can draft the first part.'
  };
}

async function getAiCoachSuggestion(draftText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return coachDraft(draftText);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a coach helping a student discuss a group ethics case study. Rewrite the draft to be clearer, more respectful, and more actionable, and keep it concise.'
          },
          { role: 'user', content: draftText }
        ],
        temperature: 0.7,
        max_tokens: 180
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (content) {
      return {
        label: 'AI-assisted',
        reason: 'This version is clearer, more respectful, and more actionable.',
        suggestion: content
      };
    }
  } catch (error) {
    console.warn('OpenAI coaching failed, falling back to local heuristic:', error.message);
  }

  return coachDraft(draftText);
}

function pickReply() {
  const replies = [
    'That makes sense. I would still want us to check whether there are people affected before we finalize the timing.',
    'I agree with the direction. Maybe we can also make the recommendation more specific so the group can act quickly.',
    'I think that’s helpful. Could we mention the risk to stakeholders and the short-term workaround at the same time?',
    'Good point. I’m supportive, but I also think we should be clear about the tradeoff between speed and safety.'
  ];

  return replies[Math.floor(Math.random() * replies.length)];
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/messages' && req.method === 'GET') {
    return sendJson(res, 200, readMessages());
  }

  if (pathname === '/api/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const text = String(data.text || '').trim();
        if (!text) return sendJson(res, 400, { error: 'Message text is required.' });

        const message = makeMessage(text, data.speaker || 'G1P2');
        const messages = readMessages();
        messages.push(message);
        writeMessages(messages);
        return sendJson(res, 201, { message });
      } catch (error) {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
    });
    return;
  }

  if (pathname === '/api/coach' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const draft = String(data.draft || '').trim();
        const suggestion = await getAiCoachSuggestion(draft);
        return sendJson(res, 200, suggestion);
      } catch (error) {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
    });
    return;
  }

  if (pathname === '/api/reply' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const authors = ['G1P1', 'G1P3', 'G1P4'];
        const author = authors[Math.floor(Math.random() * authors.length)];
        const message = makeMessage(data.text || pickReply(), author);
        const messages = readMessages();
        messages.push(message);
        writeMessages(messages);
        return sendJson(res, 201, { message });
      } catch (error) {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
    });
    return;
  }

  if (pathname === '/api/reset' && req.method === 'POST') {
    writeMessages(DEFAULT_MESSAGES.map(item => ({ ...item })));
    return sendJson(res, 200, { ok: true, messages: readMessages() });
  }

  return null;
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, pathname);
    if (handled !== null) return;
  }

  let filePath = pathname === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, pathname);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    serveStaticFile(res, filePath);
  });
});

ensureStorage();
server.listen(PORT, () => {
  console.log(`EmpathiCA backend running at http://localhost:${PORT}`);
  console.log('Messages stored at:', MESSAGES_FILE);
});
