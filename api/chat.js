import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const MODELS = (process.env.ALLOWED_MODELS || 'claude-sonnet-5-5,claude-haiku-5-5')
  .split(',').map((s) => s.trim()).filter(Boolean);
const FALLBACK_OK = new Set(['claude-sonnet-5-5']);   // Haiku 5.5 nie ma server-side fallbacków
const EFFORTS = ['low', 'medium', 'high'];

// prosty limit zapytań na IP (best-effort, per instancja funkcji)
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 60_000, max = 30;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY is not set'); return res.status(503).json({ error: 'Usługa jest chwilowo niedostępna.' }); }

  const pass = process.env.SITE_PASSWORD;
  if (pass && req.headers['x-smiri-pass'] !== pass) return res.status(401).json({ error: 'Wymagany jest poprawny kod dostępu.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'Za dużo zapytań, spróbuj za chwilę.' });

  const { model, system, messages, search, research, effort, thinking } = req.body || {};
  if (!MODELS.includes(model)) return res.status(400).json({ error: 'Niedozwolony model.' });
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Brak wiadomości.' });
  if (system != null && typeof system !== 'string') return res.status(400).json({ error: 'Zły system prompt.' });

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  });

  const useSearch = !!(search || research);
  const msgs = [...messages];
  try {
    for (let turn = 0; turn < 4; turn++) {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: research ? 16000 : 8000,
        system: system || undefined,
        messages: msgs,
        output_config: { effort: EFFORTS.includes(effort) ? effort : 'medium' },
        ...(thinking ? { thinking: { type: 'adaptive', display: 'summarized' } } : {}),
        ...(FALLBACK_OK.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
        ...(useSearch ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: research ? 12 : 5 }] } : {}),
      });
      for await (const ev of stream) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      const final = await stream.finalMessage();
      if (final.stop_reason !== 'pause_turn') break;      // wyszukiwanie może wstrzymać turę — kontynuujemy
      msgs.push({ role: 'assistant', content: final.content });
    }
  } catch (e) {
    console.error('chat error:', e?.status, e?.message);   // szczegóły tylko w logach serwera
    const msg = e?.status === 429 ? 'Za dużo zapytań, spróbuj za chwilę.' : 'Nie udało się uzyskać odpowiedzi. Spróbuj ponownie.';
    res.write(`data: ${JSON.stringify({ type: 'error', error: { message: msg } })}\n\n`);
  }
  res.end();
}
