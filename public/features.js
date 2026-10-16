'use strict';
/* Smiri — narzędzia: notatki, przypomnienia, nauka, kalkulator, konwerter, pogoda, giełda, mapa, porównanie modeli */

const $$ = (s) => document.querySelector(s);
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const rid = () => Math.random().toString(36).slice(2, 10);
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (k === 'text') richNodes(v).forEach((n) => e.append(n)); else e.setAttribute(k, v);
  }
  kids.flat().forEach((c) => { if (c == null) return; if (c.nodeType) e.append(c); else richNodes(c).forEach((n) => e.append(n)); });
  return e;
}

/* ---------- pogoda ---------- */
const WMO = { 0: ['sun', 'bezchmurnie'], 1: ['sun', 'prawie bezchmurnie'], 2: ['weather', 'częściowe zachmurzenie'], 3: ['cloud', 'pochmurno'], 45: ['fog', 'mgła'], 48: ['fog', 'szron'], 51: ['rain', 'mżawka'], 53: ['rain', 'mżawka'], 55: ['rain', 'mżawka'], 61: ['rain', 'deszcz'], 63: ['rain', 'deszcz'], 65: ['rain', 'ulewa'], 71: ['snow', 'śnieg'], 73: ['snow', 'śnieg'], 75: ['snow', 'mocny śnieg'], 80: ['rain', 'przelotny deszcz'], 81: ['rain', 'przelotny deszcz'], 82: ['storm', 'gwałtowne opady'], 95: ['storm', 'burza'], 96: ['storm', 'burza z gradem'], 99: ['storm', 'burza z gradem'] };
const wx = (c) => WMO[c] || ['cloud', ''];
async function showWeather(host, city) {
  host.textContent = 'Pobieram pogodę…';
  try {
    const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pl`)).json();
    if (!g.results?.length) throw new Error('nie znaleziono miasta');
    const { latitude, longitude, name, country } = g.results[0];
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&forecast_days=5`)).json();
    host.innerHTML = '';
    host.append(h('h4', { text: `Pogoda — ${name}, ${country || ''}` }),
      h('div', { class: 'fx' }, h('big', { text: Math.round(w.current.temperature_2m) + '°C' }), h('small', { text: `[[${wx(w.current.weather_code)[0]}]] ${wx(w.current.weather_code)[1]} · odczuwalna ${Math.round(w.current.apparent_temperature)}° · wiatr ${Math.round(w.current.wind_speed_10m)} km/h` })),
      h('div', { class: 'wx' }, w.daily.time.map((d, i) => h('div', {}, h('small', { text: new Date(d).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric' }) }), h('div', { class: 'wxi' }, ico(wx(w.daily.weather_code[i])[0])), h('div', { text: `${Math.round(w.daily.temperature_2m_max[i])}° / ${Math.round(w.daily.temperature_2m_min[i])}°` }), h('small', { text: `${w.daily.precipitation_sum[i]} mm` })))));
  } catch (e) { host.textContent = 'Nie udało się pobrać pogody: ' + e.message; }
}

/* ---------- giełda (przez /api/stock) ---------- */
async function showStock(host, symbol) {
  host.textContent = 'Pobieram notowania…';
  try {
    const r = await fetch('/api/stock?s=' + encodeURIComponent(symbol));
    const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status);
    host.innerHTML = '';
    const ch = d.prev ? ((d.last.close / d.prev.close - 1) * 100) : 0;
    const price = h('big', { text: d.last.close.toLocaleString('pl-PL') });
    host.append(h('h4', { text: d.symbol.toUpperCase() }), h('div', { class: 'fx' }, price, h('small', { class: ch >= 0 ? 'up' : 'down', text: `[[${ch >= 0 ? 'up' : 'down'}]] ${Math.abs(ch).toFixed(2)}% · ${d.last.date}` })));
    const cv = h('canvas'), wrap = h('div', { class: 'chart-wrap' }, cv); host.append(wrap);
    const col = ch >= 0 ? '#17915a' : '#d4305c';
    new Chart(cv, styleChart({ type: 'line', data: { labels: d.series.map((p) => p.date), datasets: [{ label: d.symbol.toUpperCase(), data: d.series.map((p) => p.close), borderColor: col, backgroundColor: col + '22', fill: true }] }, options: { scales: { x: { ticks: { maxTicksLimit: 5 } }, y: { beginAtZero: false } } } }));
  } catch (e) { host.textContent = ''; host.append(h('div', { class: 'err' }, 'Nie udało się pobrać notowań. Spróbuj symbolu w formacie aapl.us, pkn.pl, ^spx lub eurusd.')); }
}

/* ---------- mapa (OpenStreetMap) ---------- */
async function showMap(host, query) {
  host.textContent = 'Szukam miejsca…';
  try {
    const r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`)).json();
    if (!r.length) throw new Error('nie znaleziono');
    const { lat, lon, display_name, boundingbox } = r[0];
    const [s, n, w, e] = boundingbox.map(Number); const pad = 0.01;
    host.innerHTML = '';
    host.append(h('h4', { text: display_name }),
      h('iframe', { class: 'map-frame', src: `https://www.openstreetmap.org/export/embed.html?bbox=${w - pad},${s - pad},${e + pad},${n + pad}&layer=mapnik&marker=${lat},${lon}` }),
      h('a', { href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`, target: '_blank', rel: 'noopener', text: 'Otwórz większą mapę' }));
  } catch (e) { host.textContent = 'Nie udało się znaleźć miejsca: ' + e.message; }
}

/* ---------- slajdy -> PowerPoint ---------- */
function slidesWidget(host, slides) {
  host.append(h('h4', { text: 'Prezentacja' }));
  slides.forEach((s, i) => host.append(h('div', { class: 'slide' }, h('b', { text: `${i + 1}. ${s.title}` }), h('ul', {}, (s.bullets || []).map((b) => h('li', { text: b }))))));
  host.append(h('button', { class: 'chip', text: '[[download]] Pobierz PowerPoint (.pptx)', onclick: () => {
    const p = new PptxGenJS(); p.layout = 'LAYOUT_WIDE';
    slides.forEach((s) => {
      const sl = p.addSlide(); sl.background = { color: '0B0B1C' };
      sl.addText(String(s.title || ''), { x: .6, y: .4, w: 12, h: 1, fontSize: 32, bold: true, color: '7B6BFF' });
      sl.addText((s.bullets || []).map((b) => ({ text: String(b), options: { bullet: true, breakLine: true } })), { x: .8, y: 1.6, w: 11.5, h: 5, fontSize: 20, color: 'ECEEFC', valign: 'top' });
    });
    p.writeFile({ fileName: 'smiri.pptx' });
  } }));
}

/* ---------- zapis fiszek do nauki ---------- */
function saveDeck(cards, title) {
  const decks = lsGet('smiri.decks', []);
  decks.push({ id: rid(), title: title || 'Talia ' + new Date().toLocaleDateString('pl-PL'), cards: cards.map((c) => ({ q: c.q, a: c.a, box: 0, due: 0 })) });
  lsSet('smiri.decks', decks);
}

/* ---------- panel ---------- */
const PANELS = {};
function openPanel(name) {
  const p = PANELS[name]; if (!p) return;
  rich($$('#panelTitle'), p.title); const body = $$('#panelBody'); body.innerHTML = '';
  p.render(body); $$('#panel').showModal();
}
$$('#panelClose').onclick = () => $$('#panel').close();

PANELS.notes = { title: '[[note]] Notatki', render(b) {
  const area = h('textarea', { rows: 3, placeholder: 'Nowa notatka…' });
  const list = h('div');
  const draw = () => { list.innerHTML = ''; lsGet('smiri.notes', []).forEach((n) => list.append(h('div', { class: 'list-item' }, h('div', {}, n.text, h('small', { text: new Date(n.t).toLocaleString('pl-PL') })),
    h('button', { text: 'Zapytaj Smiri', onclick: () => { $$('#panel').close(); window.smiriAsk('Na podstawie mojej notatki: ' + n.text + '\n\n'); } }),
    h('button', { class: 'x', text: '[[close]]', onclick: () => { lsSet('smiri.notes', lsGet('smiri.notes', []).filter((x) => x.id !== n.id)); draw(); } })))); };
  b.append(area, h('div', { class: 'bar' }, h('button', { class: 'primary', text: 'Dodaj notatkę', onclick: () => { if (!area.value.trim()) return; lsSet('smiri.notes', [{ id: rid(), t: Date.now(), text: area.value.trim() }, ...lsGet('smiri.notes', [])]); area.value = ''; draw(); } })), list);
  draw();
} };

PANELS.reminders = { title: '[[bell]] Przypomnienia', render(b) {
  const txt = h('input', { type: 'text', placeholder: 'O czym przypomnieć?' }), when = h('input', { type: 'datetime-local' });
  const list = h('div');
  const draw = () => { list.innerHTML = ''; lsGet('smiri.reminders', []).sort((a, c) => a.at - c.at).forEach((r) => list.append(h('div', { class: 'list-item' }, h('div', {}, r.text, h('small', { text: new Date(r.at).toLocaleString('pl-PL') + (r.done ? ' · wykonane' : '') })), h('button', { class: 'x', text: '[[close]]', onclick: () => { lsSet('smiri.reminders', lsGet('smiri.reminders', []).filter((x) => x.id !== r.id)); draw(); } })))); };
  b.append(h('div', { class: 'bar' }, txt, when), h('div', { class: 'bar' }, h('button', { class: 'primary', text: 'Dodaj przypomnienie', onclick: () => {
    if (!txt.value.trim() || !when.value) return;
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    lsSet('smiri.reminders', [...lsGet('smiri.reminders', []), { id: rid(), text: txt.value.trim(), at: new Date(when.value).getTime(), done: false }]); txt.value = ''; draw();
  } })), h('small', { text: 'Przypomnienia działają, gdy strona Smiri jest otwarta w przeglądarce.' }), list);
  draw();
} };
setInterval(() => {
  const rs = lsGet('smiri.reminders', []); let ch = false;
  rs.forEach((r) => { if (!r.done && r.at <= Date.now()) { r.done = true; ch = true; try { if (Notification.permission === 'granted') new Notification('Smiri', { body: r.text }); else alert(r.text); } catch { alert(r.text); } } });
  if (ch) lsSet('smiri.reminders', rs);
}, 15000);

PANELS.study = { title: '[[cards]] Nauka — powtórki fiszek', render(b) {
  const decks = lsGet('smiri.decks', []);
  if (!decks.length) { b.append(h('p', { text: 'Brak talii. Poproś Smiri o fiszki i kliknij „Zapisz do nauki” pod nimi.' })); return; }
  const INT = [0, 1, 3, 7, 16, 35];   // dni — pudełka Leitnera
  const show = (deck) => {
    b.innerHTML = ''; const due = deck.cards.filter((c) => c.due <= Date.now());
    b.append(h('h3', { text: deck.title }), h('small', { text: `${due.length} do powtórki z ${deck.cards.length}` }));
    if (!due.length) { b.append(h('p', { text: 'Na dziś koniec. Dobra robota.' }), h('button', { text: '[[left]] Talie', onclick: () => PANELS.study.render((b.innerHTML = '', b)) })); return; }
    const c = due[0]; let flipped = false;
    const card = h('div', { class: 'study-card', text: c.q, onclick: () => { flipped = !flipped; card.textContent = flipped ? c.a : c.q; } });
    const grade = (ok) => { c.box = ok ? Math.min(c.box + 1, INT.length - 1) : 0; c.due = Date.now() + INT[c.box] * 86400000; lsSet('smiri.decks', decks); show(deck); };
    b.append(card, h('small', { text: 'Kliknij kartę, by zobaczyć odpowiedź' }), h('div', { class: 'bar' }, h('button', { text: '[[close]] Nie wiem', onclick: () => grade(false) }), h('button', { class: 'primary', text: '[[check]] Wiem', onclick: () => grade(true) })));
  };
  decks.forEach((d) => b.append(h('div', { class: 'list-item' }, h('div', {}, d.title, h('small', { text: d.cards.length + ' fiszek' })), h('button', { text: 'Ucz się', onclick: () => show(d) }), h('button', { class: 'x', text: '[[close]]', onclick: () => { lsSet('smiri.decks', decks.filter((x) => x.id !== d.id)); PANELS.study.render((b.innerHTML = '', b)); } }))));
} };

PANELS.calc = { title: '[[calc]] Kalkulator', render(b) {
  const inp = h('input', { type: 'text', placeholder: 'np. (12+8)*3^2 / sqrt(16)   |   sin(pi/2)   |   15% z 200 → 0.15*200' });
  const out = h('div', { class: 'big-num', text: ' ' });
  const run = () => {
    try {
      let s = inp.value.replace(/,/g, '.').replace(/\^/g, '**').replace(/\bpi\b/gi, 'Math.PI').replace(/\be\b/g, 'Math.E');
      s = s.replace(/\b(sqrt|sin|cos|tan|abs|log10|log|ln|exp|round|floor|ceil)\b/g, (m) => 'Math.' + (m === 'ln' ? 'log' : m === 'log' ? 'log10' : m));
      if (/[^0-9+\-*/().\sA-Za-z_]/.test(s) || /[A-Za-z_]+/.test(s.replace(/Math\.(PI|E|sqrt|sin|cos|tan|abs|log10|log|exp|round|floor|ceil)/g, ''))) throw 0;
      const v = Function('"use strict";return (' + s + ')')(); out.textContent = Number.isFinite(v) ? String(+v.toPrecision(12)) : 'błąd';
    } catch { out.textContent = 'błąd'; }
  };
  inp.oninput = run; b.append(inp, out);
} };

const UNITS = {
  'Długość': { m: 1, km: 1000, cm: .01, mm: .001, mila: 1609.344, stopa: .3048, cal: .0254, jard: .9144 },
  'Masa': { kg: 1, g: .001, t: 1000, funt: .45359237, uncja: .0283495 },
  'Objętość': { l: 1, ml: .001, 'm³': 1000, galon: 3.78541, 'szklanka': .25 },
  'Prędkość': { 'm/s': 1, 'km/h': 1 / 3.6, mph: .44704, węzeł: .514444 },
  'Dane': { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 },
  'Temperatura': { '°C': 1, '°F': 1, K: 1 },
};
function convTemp(v, f, t) { const c = f === '°C' ? v : f === '°F' ? (v - 32) * 5 / 9 : v - 273.15; return t === '°C' ? c : t === '°F' ? c * 9 / 5 + 32 : c + 273.15; }
PANELS.conv = { title: '[[ruler]] Konwerter jednostek', render(b) {
  const cat = h('select', {}, Object.keys(UNITS).map((k) => h('option', { text: k }))), v = h('input', { type: 'number', value: 1 });
  const f = h('select'), t = h('select'), out = h('div', { class: 'big-num' });
  const fill = () => { [f, t].forEach((s) => { s.innerHTML = ''; Object.keys(UNITS[cat.value]).forEach((u) => s.append(h('option', { text: u }))); }); t.selectedIndex = 1; run(); };
  const run = () => { const u = UNITS[cat.value], x = +v.value; const r = cat.value === 'Temperatura' ? convTemp(x, f.value, t.value) : x * u[f.value] / u[t.value]; out.textContent = `${+r.toPrecision(8)} ${t.value}`; };
  cat.onchange = fill; [v, f, t].forEach((e) => (e.oninput = run)); b.append(cat, h('div', { class: 'bar' }, v, f, t), out); fill();
} };

PANELS.weather = { title: '[[weather]] Pogoda', render(b) {
  const city = h('input', { type: 'text', placeholder: 'Miasto, np. Kraków', value: lsGet('smiri.city', '') }), box = h('div', { class: 'widget' });
  const go = () => { if (!city.value.trim()) return; lsSet('smiri.city', city.value.trim()); showWeather(box, city.value.trim()); };
  city.onkeydown = (e) => e.key === 'Enter' && go(); b.append(h('div', { class: 'bar' }, city, h('button', { class: 'primary', text: 'Pokaż', onclick: go })), box); if (city.value) go();
} };
PANELS.stock = { title: '[[trend]] Giełda i kursy', render(b) {
  const s = h('input', { type: 'text', placeholder: 'Symbol: aapl.us, pkn.pl, ^spx, eurusd, btc.v', value: lsGet('smiri.sym', 'aapl.us') }), box = h('div', { class: 'widget' });
  const go = () => { lsSet('smiri.sym', s.value.trim()); showStock(box, s.value.trim()); };
  s.onkeydown = (e) => e.key === 'Enter' && go(); b.append(h('div', { class: 'bar' }, s, h('button', { class: 'primary', text: 'Pokaż', onclick: go })), box);
  const cur = h('div'); b.append(h('h3', { text: 'Waluty' }), h('div', { class: 'bar' }, h('input', { id: 'fxA', type: 'number', value: 100 }), h('input', { id: 'fxF', type: 'text', value: 'USD' }), h('input', { id: 'fxT', type: 'text', value: 'PLN' }), h('button', { class: 'primary', text: 'Przelicz', onclick: () => fxWidget(cur, +$$('#fxA').value, $$('#fxF').value.toUpperCase(), $$('#fxT').value.toUpperCase()) })), cur);
} };
PANELS.map = { title: '[[map]] Mapa', render(b) {
  const q = h('input', { type: 'text', placeholder: 'Miejsce lub adres' }), box = h('div', { class: 'widget' });
  const go = () => q.value.trim() && showMap(box, q.value.trim()); q.onkeydown = (e) => e.key === 'Enter' && go(); b.append(h('div', { class: 'bar' }, q, h('button', { class: 'primary', text: 'Szukaj', onclick: go })), box);
} };

async function fxWidget(host, amount, from, to, attempt = 0) {
  host.classList.add('widget');
  amount = Number(amount) || 1; from = String(from || '').toUpperCase().trim(); to = String(to || '').toUpperCase().trim();
  host.innerHTML = '<h4></h4><div class="sk" style="width:58%;height:34px;border-radius:10px"></div><div class="sk" style="width:34%;margin-top:10px"></div>';
  host.querySelector('h4').textContent = `Kurs ${from} → ${to}`;
  try {
    const r = await fetch(`/api/fx?amount=${encodeURIComponent(amount)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const d = await r.json(); if (!r.ok || typeof d.result !== 'number') throw new Error(d.error || r.status);
    const f = (n, max = 4) => n.toLocaleString('pl-PL', { maximumFractionDigits: max });
    host.innerHTML = '';
    host.append(h('h4', { text: `Kurs ${from} → ${to}` }),
      h('div', { class: 'fx' }, h('big', { text: `${f(d.result, 2)} ${to}` }), h('small', { text: `${f(amount, 2)} ${from}` })),
      h('div', { class: 'fx-meta' }, `1 ${from} = ${f(d.rate)} ${to} · 1 ${to} = ${f(1 / d.rate)} ${from} · ${d.date}`));
  } catch (e) {
    if (attempt < 1) return setTimeout(() => fxWidget(host, amount, from, to, attempt + 1), 900);
    host.innerHTML = ''; host.append(h('h4', { text: `Kurs ${from} → ${to}` }), h('div', { class: 'err' }, 'Nie udało się pobrać kursu. '), h('button', { class: 'chip', text: 'Spróbuj ponownie', onclick: () => fxWidget(host, amount, from, to) }));
  }
}

PANELS.compare = { title: '[[scale]] Porównaj modele', render(b) {
  const q = h('textarea', { rows: 3, placeholder: 'Jedno pytanie — kilka modeli odpowie obok siebie' });
  const MODELS = [['claude-haiku-5-5', 'Haiku 5.5'], ['claude-sonnet-5-5', 'Sonnet 5.5']];
  const checks = MODELS.map(([id, n], i) => { const c = h('input', { type: 'checkbox', value: id }); c.checked = true; return [c, n]; });
  const cols = h('div', { class: 'cols' });
  b.append(q, h('div', { class: 'bar' }, checks.map(([c, n]) => h('label', { style: 'flex-direction:row;align-items:center;gap:6px;margin:0' }, c, n))),
    h('div', { class: 'bar' }, h('button', { class: 'primary', text: 'Porównaj', onclick: () => {
      cols.innerHTML = ''; const text = q.value.trim(); if (!text) return;
      checks.filter(([c]) => c.checked).forEach(([c, n]) => {
        const body = h('div', { class: 'body', text: 'Piszę…' }), wrap = h('div', { class: 'cmp' }, body); cols.append(h('div', { class: 'col' }, h('h4', { text: n }), wrap)); let acc = '', last = 0;
        window.smiriStream({ model: c.value, system: 'Odpowiedz zwięźle. Jeśli to pomaga, możesz użyć widżetów (wykres, schemat, tabela), ale tylko gdy naprawdę są potrzebne. Nie używaj emoji.', messages: [{ role: 'user', content: text }], search: false }, (d) => { acc += d; if (Date.now() - last > 120) { last = Date.now(); window.smiriRender(wrap, acc, false); } }).then(() => window.smiriRender(wrap, acc, true)).catch((e) => { body.textContent = 'Błąd: ' + e.message; });
      });
    } })), cols);
} };

/* ekran narzędzi: kafelki jak aplikacje na iOS */
const TILES = [['notes', 'note', 'Notatki', 'yellow'], ['reminders', 'bell', 'Przypomnienia', 'red'], ['study', 'cards', 'Nauka', 'orange'], ['calc', 'calc', 'Kalkulator', 'gray'], ['conv', 'ruler', 'Konwerter', 'teal'], ['weather', 'weather', 'Pogoda', 'blue'], ['stock', 'trend', 'Giełda', 'green'], ['map', 'map', 'Mapa', 'green'], ['compare', 'scale', 'Porównaj', 'purple']];
const TILE_G = { yellow: 'linear-gradient(135deg,#ffd75e,#ffb000)', red: 'linear-gradient(135deg,#ff7a6e,#ff3b30)', orange: 'linear-gradient(135deg,#ffb340,#ff7a00)', gray: 'linear-gradient(135deg,#8e8e93,#48484a)', teal: 'linear-gradient(135deg,#5ee0d6,#0aa1b8)', blue: 'linear-gradient(135deg,#5ac8fa,#007aff)', green: 'linear-gradient(135deg,#6be08a,#1fa855)', purple: 'linear-gradient(135deg,#c084fc,#7d4cdb)' };
TILES.forEach(([k, ic, label, g], i) => {
  const b = h('button', { class: 'lt', style: `--i:${i}`, onclick: () => { $$('#launcher').close(); setTimeout(() => openPanel(k), 120); } }, h('span', { class: 'tile', style: `--g:${TILE_G[g]}` }, ico(ic)), label);
  $$('#launcherGrid').append(b);
});
