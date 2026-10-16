// Kursy walut: kilka źródeł po kolei, żeby jedno niedostępne nie psuło widżetu.
const CODE = /^[A-Z]{3,5}$/;

async function getJson(url, ms = 6000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
  finally { clearTimeout(t); }
}

const SOURCES = [
  async (from, to) => { const d = await getJson(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`); return { rate: d.rates?.[to], date: d.date }; },
  async (from, to) => { const d = await getJson(`https://api.frankfurter.app/latest?from=${from}&to=${to}`); return { rate: d.rates?.[to], date: d.date }; },
  async (from, to) => { const d = await getJson(`https://open.er-api.com/v6/latest/${from}`); return { rate: d.rates?.[to], date: (d.time_last_update_utc || '').slice(5, 16) || new Date().toISOString().slice(0, 10) }; },
  async (from, to) => { const d = await getJson(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`); return { rate: d[from.toLowerCase()]?.[to.toLowerCase()], date: d.date }; },
];

export default async function handler(req, res) {
  const from = String(req.query.from || '').toUpperCase(), to = String(req.query.to || '').toUpperCase();
  const amount = Number(req.query.amount ?? 1);
  if (!CODE.test(from) || !CODE.test(to) || !Number.isFinite(amount) || amount <= 0 || amount > 1e12) return res.status(400).json({ error: 'Nieprawidłowe waluty' });
  if (from === to) return res.json({ rate: 1, result: amount, date: new Date().toISOString().slice(0, 10) });
  for (const src of SOURCES) {
    try {
      const { rate, date } = await src(from, to);
      if (typeof rate === 'number' && rate > 0) {
        res.setHeader('cache-control', 's-maxage=900, stale-while-revalidate=3600');
        return res.json({ rate, result: amount * rate, date: date || new Date().toISOString().slice(0, 10) });
      }
    } catch (e) { /* następne źródło */ }
  }
  console.error('fx: all sources failed', from, to);
  res.status(502).json({ error: 'Kursy chwilowo niedostępne' });
}
