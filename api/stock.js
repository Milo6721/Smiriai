// Notowania z Stooq. Symbole np.: aapl.us, msft.us, pkn.pl, ^spx, eurusd, btc.v
export default async function handler(req, res) {
  const s = String(req.query.s || '').toLowerCase();
  if (!/^[\^a-z0-9.\-]{1,20}$/.test(s)) return res.status(400).json({ error: 'Zły symbol' });
  try {
    const r = await fetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`);
    const csv = await r.text();
    const rows = csv.trim().split('\n').slice(1).map((l) => l.split(','));
    if (!rows.length || rows[0][0] === 'No data' || rows[0].length < 5) return res.status(404).json({ error: 'Brak danych dla symbolu' });
    const last = rows.slice(-90).map(([date, o, h, l, c]) => ({ date, close: +c }));
    res.setHeader('cache-control', 's-maxage=300');
    res.json({ symbol: s, last: last.at(-1), prev: last.at(-2) || null, series: last });
  } catch (e) {
    res.status(502).json({ error: 'Nie udało się pobrać notowań' });
  }
}
