// Sprawdza po stronie serwera, czy gra pozwala na osadzenie w iframe.
// Jeśli nagłówki X-Frame-Options / CSP frame-ancestors blokują osadzanie,
// strona funnn.site przeniesie gracza bezpośrednio na adres gry.
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  let game = null;
  try {
    const games = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'games.json'), 'utf8'));
    game = games.find(g => g.id === (req.query && req.query.id));
  } catch (e) {
    return res.status(200).json({ ok: true, unknown: true });
  }
  if (!game) return res.status(404).json({ ok: false, error: 'unknown game' });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(game.url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'funnn-embed-check' } });
    try { if (r.body && r.body.cancel) await r.body.cancel(); } catch (e) { /* ignore */ }
    const xfo = (r.headers.get('x-frame-options') || '').toLowerCase();
    const csp = r.headers.get('content-security-policy') || '';
    const fa = /frame-ancestors\s+([^;]+)/i.exec(csp);
    // ok = czy wolno osadzić w iframe (decydują tylko nagłówki), up = czy gra w ogóle odpowiada
    let ok = true, reason = '';
    if (xfo.includes('deny') || xfo.includes('sameorigin')) { ok = false; reason = 'x-frame-options: ' + xfo; }
    if (fa && !/(\*|funnn\.site)/i.test(fa[1])) { ok = false; reason = 'frame-ancestors: ' + fa[1].trim(); }
    if (!r.ok && !reason) reason = 'status ' + r.status;
    return res.status(200).json({ ok, up: r.ok, status: r.status, reason });
  } catch (e) {
    // Gdy sprawdzenie się nie uda (timeout, błąd sieci), zakładamy, że da się osadzić.
    return res.status(200).json({ ok: true, unknown: true });
  } finally {
    clearTimeout(timer);
  }
};
