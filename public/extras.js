'use strict';
/* Smiri — dodatki: widżety „Dzisiaj”, gesty, menu „/”, wklejanie i przeciąganie plików, menu zaznaczenia, PWA. */

/* ---------- wibracje (Android; iOS Safari ich nie wspiera) ---------- */
function haptic(ms = 8) { try { if (settings.haptics !== false && navigator.vibrate) navigator.vibrate(ms); } catch {} }

/* ---------- światło podążające za kursorem lub palcem (Liquid Glass) ---------- */
(() => {
  let raf = 0;
  const GLASS = '.box,#sidebar,.persona-pill,.hbtn,.sugg,.today-tile,.popover,.pal,.seg,.art-card,.followups button';
  const move = (e) => {
    if (raf) return; const x = e.clientX, y = e.clientY, t = e.target;
    raf = requestAnimationFrame(() => {
      raf = 0; const el = t.closest && t.closest(GLASS); if (!el) return;
      const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (x - r.left) + 'px'); el.style.setProperty('--my', (y - r.top) + 'px');
    });
  };
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerdown', move, { passive: true });
})();

/* ---------- „Dzisiaj”: widżety na pustym czacie ---------- */
const TODAY_CACHE = 20 * 60 * 1000;
const cacheGet = (k) => { try { const v = JSON.parse(sessionStorage.getItem(k) || 'null'); return v && Date.now() - v.t < TODAY_CACHE ? v.d : null; } catch { return null; } };
const cacheSet = (k, d) => { try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), d })); } catch {} };
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Dobranoc' : h < 12 ? 'Dzień dobry' : h < 18 ? 'Miłego popołudnia' : 'Dobry wieczór'; }
function tile(label, icon, onclick) {
  const t = document.createElement('button'); t.className = 'today-tile'; t.onclick = onclick;
  const l = document.createElement('div'); l.className = 'tl'; l.append(ico(icon), document.createTextNode(label));
  const v = document.createElement('div'); v.className = 'tv'; const s = document.createElement('div'); s.className = 'ts';
  t.append(l, v, s); t.v = v; t.s = s; return t;
}
async function todayWeather(t) {
  const city = lsGet('smiri.city', '');
  if (!city) { t.v.textContent = 'Ustaw miasto'; t.s.textContent = 'Dotknij, aby wybrać'; t.onclick = () => { const c = prompt('Twoje miasto:'); if (c && c.trim()) { lsSet('smiri.city', c.trim()); sessionStorage.removeItem('t-w'); t.v.textContent = '…'; t.s.textContent = ''; todayWeather(t); t.onclick = () => openPanel('weather'); } }; return; }
  t.onclick = () => openPanel('weather'); t.v.innerHTML = '<span class="sk" style="display:block;width:60%;height:26px"></span>';
  try {
    let d = cacheGet('t-w');
    if (!d || d.city !== city) {
      const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pl`)).json();
      if (!g.results?.length) throw new Error('city');
      const { latitude, longitude, name } = g.results[0];
      const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`)).json();
      d = { city, name, temp: Math.round(w.current.temperature_2m), code: w.current.weather_code }; cacheSet('t-w', d);
    }
    const [ic, txt] = wx(d.code); t.v.textContent = d.temp + '°'; t.s.textContent = ''; t.s.append(ico(ic), document.createTextNode(` ${txt} · ${d.name}`));
  } catch { t.v.textContent = '—'; t.s.textContent = 'Brak danych o pogodzie'; }
}
async function todayFx(t) {
  t.onclick = () => openPanel('stock'); t.v.innerHTML = '<span class="sk" style="display:block;width:60%;height:26px"></span>';
  try {
    let d = cacheGet('t-fx');
    if (!d) { const get = async (f) => (await (await fetch(`/api/fx?amount=1&from=${f}&to=PLN`)).json()); const [e, u] = await Promise.all([get('EUR'), get('USD')]); if (!e.rate || !u.rate) throw new Error('fx'); d = { e: e.rate, u: u.rate }; cacheSet('t-fx', d); }
    const f = (n) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    t.v.textContent = f(d.e); t.s.textContent = `EUR/PLN · USD ${f(d.u)}`;
  } catch { t.v.textContent = '—'; t.s.textContent = 'Kursy niedostępne'; }
}
function buildToday() {
  const wrap = document.createElement('div'); wrap.className = 'today';
  const date = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  const head = document.createElement('div'); head.className = 'today-head'; head.innerHTML = '<b></b><span></span>'; head.querySelector('b').textContent = greeting(); head.querySelector('span').textContent = date.charAt(0).toUpperCase() + date.slice(1); wrap.append(head);
  const grid = document.createElement('div'); grid.className = 'today-grid';
  const w = tile('Pogoda', 'weather'); todayWeather(w);
  const f = tile('Kurs euro', 'exchange'); todayFx(f);
  const now = Date.now(), next = lsGet('smiri.reminders', []).filter((r) => !r.done && r.at > now).sort((a, b) => a.at - b.at)[0];
  const r = tile('Przypomnienie', 'bell', () => openPanel('reminders'));
  if (next) { r.v.textContent = new Date(next.at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }); r.s.textContent = next.text.slice(0, 40); } else { r.v.textContent = 'Brak'; r.s.textContent = 'Dotknij, aby dodać'; }
  const decks = lsGet('smiri.decks', []), due = decks.reduce((n, d) => n + d.cards.filter((c) => c.due <= now).length, 0);
  const n = tile('Nauka', 'cards', () => openPanel('study'));
  if (decks.length) { n.v.textContent = String(due); n.s.textContent = due === 1 ? 'fiszka do powtórki' : 'fiszek do powtórki'; } else { n.v.textContent = '0'; n.s.textContent = 'Zrób pierwsze fiszki'; }
  grid.append(w, f, r, n); wrap.append(grid); return wrap;
}

/* ---------- gesty na telefonie ---------- */
(() => {
  const sb = document.getElementById('sidebar'); let sx = 0, sy = 0, mode = '';
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; mode = '';
    if (!sb.classList.contains('open') && sx < 22 && innerWidth <= 820) mode = 'open'; else if (sb.classList.contains('open') && e.target.closest('#sidebar')) mode = 'close';
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!mode) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (mode === 'open' && dx > 60 && dy < 60) { sb.classList.add('open'); document.body.classList.add('menu-open'); haptic(6); }
    if (mode === 'close' && dx < -60 && dy < 60) { closeSidebar(); haptic(6); }
    mode = '';
  }, { passive: true });
  // przeciągnięcie arkusza w dół zamyka go
  document.querySelectorAll('dialog').forEach((d) => {
    let y0 = 0, dy = 0, drag = false;
    d.addEventListener('touchstart', (e) => { if (innerWidth > 820 || !d.open) return; const r = d.getBoundingClientRect(), y = e.touches[0].clientY; drag = d.scrollTop <= 0 && y - r.top < 64; y0 = y; dy = 0; }, { passive: true });
    d.addEventListener('touchmove', (e) => { if (!drag) return; dy = e.touches[0].clientY - y0; if (dy > 0) { d.style.transition = 'none'; d.style.transform = `translateY(${dy}px)`; } }, { passive: true });
    d.addEventListener('touchend', () => { if (!drag) return; d.style.transition = ''; d.style.transform = ''; if (dy > 110) { d.close(); haptic(6); } drag = false; dy = 0; });
  });
})();

/* ---------- menu „/” w polu pisania ---------- */
const SLASH = [
  ['/wykres', 'chartbar', 'Narysuj wykres: '], ['/schemat', 'flow', 'Narysuj schemat/diagram: '], ['/oś', 'timeline', 'Zrób oś czasu: '], ['/fiszki', 'cards', 'Zrób fiszki do nauki: '],
  ['/prezentacja', 'slides', 'Zrób prezentację na temat: '], ['/strona', 'layers', 'Zrób jako artefakt stronę HTML: '], ['/kod', 'code', 'Napisz kod: '], ['/podsumuj', 'lines', 'Podsumuj w punktach: '],
  ['/tłumacz', 'translate', 'Przetłumacz na angielski: '], ['/dane', 'chartbar', 'Przeanalizuj załączone dane: policz statystyki i pokaż wykresy. '], ['/kurs', 'exchange', 'Przelicz walutę: 100 USD na PLN'],
];
let slashOpen = false;
function slashItems(q) { return SLASH.filter(([c]) => c.startsWith(q.toLowerCase())); }
function slashPick(c) { const inp = document.getElementById('input'); inp.value = c[2]; inp.focus(); autosize(); updateSend(); closeMenu(); slashOpen = false; haptic(6); }
function slashUpdate() {
  const inp = document.getElementById('input'), v = inp.value;
  if (!/^\/\S*$/.test(v)) { if (slashOpen) { closeMenu(); slashOpen = false; } return; }
  const items = slashItems(v); if (!items.length) { if (slashOpen) { closeMenu(); slashOpen = false; } return; }
  slashOpen = true; openMenu(document.querySelector('.box'), [{ header: 'Polecenia' }, ...items.map((c) => ({ icon: c[1], label: c[0], sub: c[2].trim().replace(/:$/, ''), fn: () => slashPick(c) }))], { up: true });
}
document.getElementById('input').addEventListener('input', slashUpdate);
document.getElementById('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && slashOpen) { const it = slashItems(e.target.value)[0]; if (it) { e.preventDefault(); e.stopImmediatePropagation(); slashPick(it); } }
  if (e.key === 'Escape' && slashOpen) { closeMenu(); slashOpen = false; }
}, true);

/* ---------- wklejanie obrazów i przeciąganie plików ---------- */
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])]; if (!files.length) return;
  e.preventDefault(); addFiles(files); toast(files.length === 1 ? 'Dodano plik: ' + (files[0].name || 'obraz') : `Dodano pliki: ${files.length}`);
});
(() => {
  const hint = document.createElement('div'); hint.id = 'dropHint'; hint.hidden = true; hint.innerHTML = '<div><b>Upuść plik</b><span>Zdjęcie, PDF lub tekst trafi do wiadomości</span></div>'; document.body.append(hint);
  let depth = 0;
  document.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; hint.hidden = false; } });
  document.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) hint.hidden = true; });
  document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => { depth = 0; hint.hidden = true; if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); haptic(10); } });
})();

/* ---------- menu zaznaczonego tekstu: „Zapytaj Smiri” ---------- */
(() => {
  if (matchMedia('(pointer: coarse)').matches) return;       // na telefonie przeszkadzałoby natywne menu
  let tm = 0, last = '';
  document.addEventListener('selectionchange', () => {
    clearTimeout(tm); tm = setTimeout(() => {
      const sel = getSelection(); const txt = sel ? sel.toString().trim() : '';
      if (!sel || sel.isCollapsed || txt.length < 3 || txt.length > 1500) { last = ''; return; }
      const n = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      if (!n || !n.closest('.msg.ai .body') || n.closest('.codeblock,.widget,.actions')) return;
      if (txt === last) return; last = txt;
      const r = sel.getRangeAt(0).getBoundingClientRect(); if (!r.width) return;
      const q = txt.length > 400 ? txt.slice(0, 400) + '…' : txt;
      openMenu({ getBoundingClientRect: () => r }, [
        { icon: 'spark', label: 'Wyjaśnij', fn: () => send(`Wyjaśnij prościej ten fragment: „${q}”`) },
        { icon: 'translate', label: 'Przetłumacz na angielski', fn: () => send(`Przetłumacz na angielski: „${q}”`) },
        { icon: 'lines', label: 'Skróć', fn: () => send(`Skróć ten fragment: „${q}”`) },
        { icon: 'copy', label: 'Kopiuj', fn: () => { navigator.clipboard.writeText(txt); toast('Skopiowano'); } },
      ]);
    }, 320);
  });
})();

/* ---------- aplikacja (PWA) ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
window.smiriInstall = async () => {
  if (installEvt) { installEvt.prompt(); installEvt = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(ios ? 'Na iPhonie: Udostępnij → Dodaj do ekranu początkowego' : 'W menu przeglądarki wybierz „Zainstaluj aplikację”', null, null, 7000);
};

window.buildToday = buildToday;
document.getElementById('installBtn').onclick = () => window.smiriInstall();
if (current && !current.messages.length) renderAll();   // ekran powitalny narysowano zanim załadowały się widżety „Dzisiaj”
