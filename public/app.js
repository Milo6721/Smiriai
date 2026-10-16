'use strict';
/* Smiri — rdzeń czatu. */

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v, (key, val) => (key === 'files' ? undefined : val))); } catch {} },
};

let settings = Object.assign({ theme: 'auto', model: 'claude-sonnet-5-5', password: '', lang: 'pl-PL', speak: false, search: true }, store.get('smiri.settings', {}));
let chats = store.get('smiri.chats', []);
let current = null, busy = false, pending = [];       // pending = załączniki do następnej wiadomości

const DEFAULT_PERSONAS = [
  { id: 'smiri', icon: 'spark', name: 'Smiri', prompt: '', builtin: true },
  { id: 'teacher', icon: 'gradcap', name: 'Nauczyciel', prompt: 'Jesteś cierpliwym nauczycielem. Tłumacz krok po kroku prostym językiem, podawaj przykłady, a na końcu zadaj jedno pytanie sprawdzające. Gdy pasuje, zaproponuj fiszki.', builtin: true },
  { id: 'dev', icon: 'code', name: 'Programista', prompt: 'Jesteś doświadczonym programistą. Odpowiadaj precyzyjnie, z działającym kodem w blokach kodu i krótkim wyjaśnieniem. Wskazuj błędy i przypadki brzegowe.', builtin: true },
  { id: 'translator', icon: 'globe', name: 'Tłumacz', prompt: 'Jesteś tłumaczem. Tłumacz tekst użytkownika na język, o który prosi (domyślnie PL↔EN), zachowując ton. Na końcu, jeśli to ważne, dodaj krótką uwagę o niuansach.', builtin: true },
];
let personas = store.get('smiri.personas', []);
const allPersonas = () => [...DEFAULT_PERSONAS, ...personas];
const OK_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5'];
const pickModel = (m) => (OK_MODELS.includes(m) ? m : 'claude-sonnet-5-5');
const pIcon = (p) => p.icon || 'bot';
const persona = (id) => allPersonas().find((p) => p.id === id) || DEFAULT_PERSONAS[0];

const SYSTEM = `Jesteś Smiri — szybkim, mądrym asystentem AI. Odpowiadaj w języku użytkownika, zwięźle i konkretnie. Używaj Markdown.
Gdy pomaga to użytkownikowi, wstawiaj interaktywne widżety jako bloki kodu z DOKŁADNIE tymi nazwami języków:

1) \`\`\`chart — poprawny JSON konfiguracji Chart.js 4 (type, data, options). Bez funkcji i komentarzy. Opcjonalne "title" na najwyższym poziomie.
2) \`\`\`mermaid — diagram Mermaid (flowchart, sequenceDiagram, mindmap, classDiagram, gantt, erDiagram…) do schematów i procesów.
3) \`\`\`timeline — tablica JSON: [{"date":"1969","title":"…","text":"…"}] — oś czasu.
4) \`\`\`flashcards — tablica JSON: [{"q":"pytanie","a":"odpowiedź"}] — fiszki.
5) \`\`\`currency — JSON: {"amount":100,"from":"USD","to":"PLN"} — aplikacja pobierze aktualny kurs. Nie zgaduj kursów w tekście.
6) \`\`\`weather — JSON: {"city":"Kraków"} — aktualna pogoda i prognoza 5 dni.
7) \`\`\`stock — JSON: {"symbol":"aapl.us"} — wykres notowań (symbole Stooq: aapl.us, msft.us, pkn.pl, ^spx, eurusd, btc.v).
8) \`\`\`map — JSON: {"query":"Wawel, Kraków"} — mapa miejsca.
9) \`\`\`slides — tablica JSON: [{"title":"…","bullets":["…","…"]}] — prezentacja z przyciskiem pobierania PowerPointa.

Tabele pisz w Markdown. Nie opisuj składni widżetów użytkownikowi, po prostu ich używaj, gdy pasują. Gdy masz dostęp do wyszukiwarki, używaj jej przy pytaniach o aktualne fakty i podawaj źródła. Do zdjęć, PDF-ów i plików od użytkownika odnoś się wprost. Nie używaj emoji.`;

const GRAD = {
  blue: 'linear-gradient(135deg,#5ac8fa,#007aff)', purple: 'linear-gradient(135deg,#c084fc,#7d4cdb)', orange: 'linear-gradient(135deg,#ffb340,#ff7a00)',
  green: 'linear-gradient(135deg,#6be08a,#1fa855)', pink: 'linear-gradient(135deg,#ff8fb1,#ff2d6f)', teal: 'linear-gradient(135deg,#5ee0d6,#0aa1b8)',
  yellow: 'linear-gradient(135deg,#ffd75e,#ffb000)', gray: 'linear-gradient(135deg,#8e8e93,#48484a)', red: 'linear-gradient(135deg,#ff7a6e,#ff3b30)',
};
const PLUS_ITEMS = [
  { icon: 'chartbar', label: 'Wykres', pre: 'Narysuj wykres: ' }, { icon: 'flow', label: 'Schemat', pre: 'Narysuj schemat/diagram: ' },
  { icon: 'timeline', label: 'Oś czasu', pre: 'Zrób oś czasu: ' }, { icon: 'cards', label: 'Fiszki', pre: 'Zrób fiszki do nauki: ' },
  { icon: 'slides', label: 'Prezentacja', pre: 'Zrób prezentację na temat: ' }, { icon: 'exchange', label: 'Kurs walut', send: 'Przelicz walutę: 100 USD na PLN' },
  { icon: 'lines', label: 'Podsumuj', pre: 'Podsumuj w punktach: ' }, { icon: 'translate', label: 'Przetłumacz', pre: 'Przetłumacz na angielski: ' },
];
const STARTERS = [
  { icon: 'chartbar', g: 'blue', t: 'Wykres słupkowy', s: 'Największe miasta Polski', p: 'Narysuj wykres słupkowy: populacja 5 największych miast Polski' },
  { icon: 'flow', g: 'purple', t: 'Schemat', s: 'Jak działa fotosynteza', p: 'Zrób schemat jak działa fotosynteza' },
  { icon: 'timeline', g: 'orange', t: 'Oś czasu', s: 'Loty kosmiczne NASA', p: 'Zrób oś czasu wypraw kosmicznych NASA' },
  { icon: 'cards', g: 'green', t: 'Fiszki', s: 'Angielskie czasowniki', p: 'Zrób 8 fiszek z angielskiego (czasowniki nieregularne)' },
  { icon: 'weather', g: 'teal', t: 'Pogoda i waluty', s: 'Warszawa, 250 EUR w PLN', p: 'Jaka jest teraz pogoda w Warszawie i ile to 250 EUR w PLN?' },
  { icon: 'slides', g: 'pink', t: 'Prezentacja', s: 'Energia odnawialna', p: 'Zrób prezentację o energii odnawialnej (6 slajdów)' },
];

/* ---------- czaty ---------- */
const uid = () => Math.random().toString(36).slice(2, 10);
function newChat(temp = false) {
  dropTemp();
  const p = persona($('#personaSel').value || 'smiri');
  current = { id: uid(), title: temp ? 'Czat tymczasowy' : 'Nowy czat', temp, personaId: p.id, messages: [] };
  renderAll();
}
function dropTemp() { if (current && current.temp) current = null; }
function persist() { store.set('smiri.chats', chats.filter((c) => !c.temp)); }
function saveCurrent() {
  if (!current || current.temp || !current.messages.length) return;
  if (!chats.find((c) => c.id === current.id)) chats.unshift(current);
  persist(); renderList();
}
function openChat(id) { dropTemp(); current = chats.find((c) => c.id === id); $('#personaSel').value = current.personaId || 'smiri'; renderAll(); $('#sidebar').classList.remove('open'); }
window.addEventListener('beforeunload', dropTemp);

/* ---------- render ---------- */
function renderPersonaSel() {
  const sel = $('#personaSel'), v = sel.value; sel.innerHTML = '';
  allPersonas().forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.append(o); });
  sel.value = allPersonas().some((p) => p.id === v) ? v : 'smiri';
}
function renderList() {
  const el = $('#chatList'); el.innerHTML = '';
  chats.forEach((c) => {
    const d = document.createElement('div'); d.className = 'chat-item' + (current && c.id === current.id ? ' active' : '');
    const s = document.createElement('span'); s.textContent = c.title;
    const x = document.createElement('button'); x.className = 'del'; x.append(ico('close')); x.title = 'Usuń';
    x.onclick = (e) => { e.stopPropagation(); chats = chats.filter((k) => k.id !== c.id); persist(); if (current && current.id === c.id) newChat(); else renderList(); };
    d.append(ico(pIcon(persona(c.personaId))), s, x); d.onclick = () => openChat(c.id); el.append(d);
  });
}
function renderAll() {
  renderList();
  const p = persona(current.personaId);
  updatePersonaUI();
  $('#tempBadge').hidden = !current.temp;
  updateSend();
  const box = $('#messages'); box.innerHTML = '';
  if (!current.messages.length) { box.append(welcomeEl(p)); return; }
  current.messages.forEach((m) => box.append(msgEl(m, true)));
  box.scrollTop = box.scrollHeight;
}
function welcomeEl(p) {
  const w = document.createElement('div'); w.id = 'welcome';
  w.innerHTML = `<div class="orb big"></div><h1></h1><p></p><div class="sugg-grid"></div>`;
  w.querySelector('h1').textContent = p.id === 'smiri' ? 'Cześć, jestem Smiri' : p.name;
  w.querySelector('p').textContent = p.id === 'smiri' ? 'Pytaj o cokolwiek. Rysuję wykresy i schematy, szukam w sieci i przygotowuję prezentacje.' : (p.greet || 'Napisz, w czym mogę pomóc.');
  if (p.id === 'smiri') STARTERS.forEach((o, i) => {
    const c = document.createElement('button'); c.className = 'sugg'; c.style.setProperty('--i', i);
    const tile = document.createElement('span'); tile.className = 'tile'; tile.style.setProperty('--g', GRAD[o.g]); tile.append(ico(o.icon));
    const tx = document.createElement('span'); tx.innerHTML = '<div class="t"></div><div class="s"></div>'; tx.querySelector('.t').textContent = o.t; tx.querySelector('.s').textContent = o.s;
    c.append(tile, tx); c.onclick = () => send(o.p); w.querySelector('.sugg-grid').append(c);
  });
  else w.querySelector('.sugg-grid').remove();
  return w;
}
function msgEl(m, final) {
  const row = document.createElement('div'); row.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai');
  if (m.role === 'user') {
    const b = document.createElement('div'); b.className = 'body';
    b.textContent = m.content; if (m.attached?.length) { const f = document.createElement('div'); f.className = 'att'; f.append(ico('clip'), document.createTextNode(m.attached.join(', '))); b.append(f); } row.append(b); return row;
  }
  const av = document.createElement('div'); av.className = 'av'; const b = document.createElement('div'); b.className = 'body';
  row.append(av, b); fillAi(row, m, final); return row;
}

/* Markdown + widżety */
function fillAi(row, m, final) {
  const body = row.querySelector('.body'), text = m.content, widgets = [];
  const re = /```(chart|mermaid|timeline|flashcards|currency|weather|stock|map|slides)\s*\n([\s\S]*?)```/g;
  const DRAW = '\n\n<div class="drawing"><span></span><span></span><span></span><span></span></div>\n\n';
  let md = text.replace(re, (_, type, code) => {
    if (!final) return DRAW;
    widgets.push({ type, code: code.trim() }); return `\n\n<div data-w="${widgets.length - 1}"></div>\n\n`;
  });
  md = md.replace(/```(?:chart|mermaid|timeline|flashcards|currency|weather|stock|map|slides)[^`]*$/, DRAW);   // blok jeszcze się pisze
  body.innerHTML = DOMPurify.sanitize(marked.parse(md));
  body.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  body.querySelectorAll('[data-w]').forEach((h) => { const w = widgets[+h.dataset.w]; if (w) hydrate(h, w); });
  body.querySelectorAll('.tl-item,.card,.slide,.wx>div').forEach((e, i) => e.style.setProperty('--i', i));
  if (final && !m.noActions) {
    if (m.sources?.length) {
      const s = document.createElement('div'); s.className = 'sources';
      m.sources.slice(0, 8).forEach((x) => { const a = document.createElement('a'); a.href = x.url; a.target = '_blank'; a.rel = 'noopener'; a.append(ico('link'), document.createTextNode(x.title || x.url)); s.append(a); });
      body.append(s);
    }
    addActions(row, m);
  }
}
window.smiriRender = (row, text, final) => fillAi(row, { content: text, noActions: true }, final);
function addActions(row, m) {
  const a = document.createElement('div'); a.className = 'actions';
  const add = (label, f, title) => { const b = document.createElement('button'); rich(b, label); if (title) b.title = title; b.onclick = f; a.append(b); };
  add('[[copy]] Kopiuj', () => navigator.clipboard.writeText(m.content));
  add('[[doc]] Word', () => exportWord(row));
  add('[[pdf]] PDF', () => exportPdf(row));
  add('[[speaker]]', () => speak(m.content), 'Przeczytaj na głos');
  row.querySelector('.body').append(a);
}

const PAL_L = ['#0a6cf0', '#d9650b', '#17915a', '#9b4fd1', '#d4305c', '#2a9fc4'];
const PAL_D = ['#3d86f2', '#d1701a', '#2aa874', '#a463e6', '#e0456f', '#2a9ab8'];
function deepMerge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]); else a[k] = b[k]; } return a; }
function styleChart(cfg) {
  const pal = isDark() ? PAL_D : PAL_L, text = cssVar('--muted'), line = cssVar('--line'), surface = cssVar('--surface'), ink = cssVar('--text'), font = cssVar('--font');
  const type = cfg.type || 'bar', round = ['pie', 'doughnut', 'polarArea'].includes(type), radial = round || type === 'radar';
  cfg.data = cfg.data || { labels: [], datasets: [] };
  const sets = cfg.data.datasets || [], multi = sets.length > 1;
  sets.forEach((d, i) => {
    const c = pal[i % pal.length];
    if (round) { if (!d.backgroundColor) d.backgroundColor = (cfg.data.labels || []).map((_, k) => pal[k % pal.length]); d.borderColor = surface; d.borderWidth = 3; d.borderRadius = 8; d.hoverOffset = 8; d.spacing = 1; }
    else if (type === 'bar') { d.backgroundColor = d.backgroundColor || c; d.borderRadius = d.borderRadius ?? { topLeft: 7, topRight: 7, bottomLeft: 0, bottomRight: 0 }; d.borderSkipped = 'bottom'; d.maxBarThickness = 44; d.categoryPercentage = .72; d.barPercentage = .86; d.borderWidth = 0; }
    else { d.borderColor = d.borderColor || c; d.backgroundColor = d.backgroundColor || (d.fill ? c + '26' : c); d.borderWidth = 2.5; d.tension = d.tension ?? .35; d.pointRadius = d.pointRadius ?? 0; d.pointHoverRadius = 6; d.pointHoverBackgroundColor = c; d.pointHoverBorderColor = surface; d.pointHoverBorderWidth = 3; }
  });
  const base = {
    responsive: true, maintainAspectRatio: false, layout: { padding: { top: 4, right: 4 } },
    interaction: { mode: round ? 'nearest' : 'index', intersect: round },
    animation: { duration: 1100, easing: 'easeOutQuart', delay: (ctx) => (ctx.type === 'data' && ctx.mode === 'default' && !round ? ctx.dataIndex * 70 + ctx.datasetIndex * 120 : 0) },
    plugins: {
      legend: { display: multi || round, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 16, color: text, font: { family: font, size: 12.5 } } },
      tooltip: { backgroundColor: surface, titleColor: ink, bodyColor: text, borderColor: line, borderWidth: 1, cornerRadius: 12, padding: 12, boxPadding: 5, usePointStyle: true, titleFont: { family: font, weight: '600', size: 13 }, bodyFont: { family: font, size: 13 }, displayColors: true, caretSize: 0 },
    },
    scales: radial ? undefined : {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: text, font: { family: font, size: 12 }, maxRotation: 0, autoSkipPadding: 12 } },
      y: { beginAtZero: true, grid: { color: line, drawTicks: false }, border: { display: false }, ticks: { color: text, font: { family: font, size: 12 }, padding: 8, maxTicksLimit: 6 } },
    },
  };
  if (type === 'doughnut') base.cutout = '68%';
  cfg.options = deepMerge(base, cfg.options || {});
  if (!radial && cfg.options.scales?.y2) delete cfg.options.scales.y2;   // jedna oś Y
  return cfg;
}

function hydrate(host, { type, code }) {
  host.className = 'widget';
  try {
    const J = () => JSON.parse(code);
    if (type === 'chart') {
      const cfg = J();
      if (cfg.title) { const t = document.createElement('h4'); t.textContent = cfg.title; host.append(t); delete cfg.title; }
      const wrap = document.createElement('div'); wrap.className = 'chart-wrap'; const cv = document.createElement('canvas'); wrap.append(cv); host.append(wrap);
      const mount = () => new Chart(cv, styleChart(cfg));
      if ('IntersectionObserver' in window) { const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { io.disconnect(); mount(); } }, { threshold: 0.2 }); io.observe(wrap); } else mount();
    } else if (type === 'mermaid') {
      const dk = isDark();
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', flowchart: { curve: 'basis', htmlLabels: true, padding: 14 },
        themeVariables: { fontFamily: cssVar('--font') || 'system-ui', fontSize: '15px', background: 'transparent',
          primaryColor: dk ? '#1f2c4a' : '#e6f0ff', primaryBorderColor: dk ? '#3d86f2' : '#0a6cf0', primaryTextColor: dk ? '#f5f5f7' : '#1d1d1f',
          secondaryColor: dk ? '#2a2140' : '#f1e8fb', tertiaryColor: dk ? '#1c1c1e' : '#ffffff', lineColor: dk ? '#a1a1a6' : '#6e6e73', textColor: dk ? '#f5f5f7' : '#1d1d1f', edgeLabelBackground: dk ? '#1c1c1e' : '#ffffff' } });
      mermaid.render('m' + uid(), code).then((r) => { host.innerHTML = r.svg; })
        .catch(() => { host.innerHTML = '<span class="err">Nie udało się narysować schematu.</span><pre><code></code></pre>'; host.querySelector('code').textContent = code; });
    } else if (type === 'timeline') {
      const t = document.createElement('div'); t.className = 'timeline';
      J().forEach((i) => { const d = document.createElement('div'); d.className = 'tl-item';
        for (const [c, k] of [['tl-date', 'date'], ['tl-title', 'title'], ['tl-text', 'text']]) { const e = document.createElement('div'); e.className = c; e.textContent = i[k] || ''; d.append(e); }
        t.append(d); });
      host.append(t);
    } else if (type === 'flashcards') {
      const items = J(), g = document.createElement('div'); g.className = 'cards';
      items.forEach((i) => { const c = document.createElement('div'); c.className = 'card';
        c.innerHTML = '<div class="card-in"><div class="card-f"></div><div class="card-b"></div></div>';
        c.querySelector('.card-f').textContent = i.q; c.querySelector('.card-b').textContent = i.a; c.onclick = () => c.classList.toggle('flip'); g.append(c); });
      const save = document.createElement('button'); save.className = 'chip'; rich(save, '[[save]] Zapisz do nauki');
      save.onclick = () => { saveDeck(items, current?.title); rich(save, '[[check]] Zapisano — otwórz Nauka'); };
      host.append(g, save);
    } else if (type === 'currency') { const { amount = 1, from, to } = J(); fxWidget(host, amount, from, to);
    } else if (type === 'weather') { showWeather(host, J().city);
    } else if (type === 'stock') { showStock(host, J().symbol);
    } else if (type === 'map') { showMap(host, J().query);
    } else if (type === 'slides') { slidesWidget(host, J()); }
  } catch { host.className = ''; host.innerHTML = '<pre><code></code></pre>'; host.querySelector('code').textContent = code; }
}

/* ---------- strumień z /api/chat ---------- */
function authHeaders() { return Object.assign({ 'content-type': 'application/json' }, settings.password ? { 'x-smiri-pass': settings.password } : {}); }
async function smiriStream({ model, system, messages, search }, onText, onSource) {
  const res = await fetch('/api/chat', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ model, system, messages, search }) });
  if (!res.ok) { let msg = res.status + ''; try { msg = (await res.json()).error || msg; } catch {} if (res.status === 401) openSettings(); throw new Error(msg); }
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const l of lines) {
      if (!l.startsWith('data:')) continue;
      let j; try { j = JSON.parse(l.slice(5)); } catch { continue; }
      if (j.type === 'error') throw new Error(j.error?.message || 'Błąd');
      if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') onText(j.delta.text);
      if (j.type === 'content_block_start' && j.content_block?.type === 'web_search_tool_result' && Array.isArray(j.content_block.content) && onSource)
        j.content_block.content.forEach((r) => r.url && onSource({ url: r.url, title: r.title }));
    }
  }
}
window.smiriStream = smiriStream;

/* ---------- wysyłanie ---------- */
function apiMessages() {
  return current.messages.map((m) => {
    if (m.role === 'user' && m.files?.length) {
      return { role: 'user', content: [...m.files.map((f) => f.type.startsWith('image/')
        ? { type: 'image', source: { type: 'base64', media_type: f.type, data: f.data } }
        : f.type === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: f.type, data: f.data } }
          : { type: 'text', text: `Plik ${f.name}:\n${decodeURIComponent(escape(atob(f.data)))}` }), { type: 'text', text: m.content }] };
    }
    return { role: m.role, content: m.content };
  });
}
async function send(text) {
  text = (text || '').trim();
  if ((!text && !pending.length) || busy) return;
  text = text || 'Przeanalizuj załączony plik.';
  busy = true;
  if (!current) newChat();
  if (!current.messages.length) current.title = text.slice(0, 48);
  const um = { role: 'user', content: text, files: pending, attached: pending.map((f) => f.name) };
  pending = []; renderAttachments();
  current.messages.push(um);
  const box = $('#messages'); $('#welcome')?.remove(); const urow = msgEl(um); urow.classList.add('enter'); box.append(urow);
  const ai = { role: 'assistant', content: '', sources: [] };
  const row = msgEl(ai); row.classList.add('streaming', 'enter'); row.querySelector('.body').innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; box.append(row); box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  $('#input').value = ''; autosize(); updateSend();
  const orb = $('#voice .orb'); orb.classList.add('thinking');
  const p = persona(current.personaId);
  try {
    let last = 0;
    await smiriStream({
      model: pickModel(p.model || settings.model), search: settings.search, messages: apiMessages(),
      system: SYSTEM + (p.prompt ? `\n\n# Persona: ${p.name}\n${p.prompt}` : ''),
    }, (d) => {
      ai.content += d; const now = Date.now();
      if (now - last > 80) { last = now; fillAi(row, ai, false); box.scrollTop = box.scrollHeight; }
    }, (s) => { if (!ai.sources.find((x) => x.url === s.url)) ai.sources.push(s); });
    if (!ai.content) ai.content = '_(pusta odpowiedź)_';
    current.messages.push(ai); row.classList.remove('streaming'); fillAi(row, ai, true);
    saveCurrent(); if (settings.speak || !$('#voice').hidden) speak(ai.content);
  } catch (e) {
    current.messages.pop(); row.classList.remove('streaming');
    row.querySelector('.body').innerHTML = '<span class="err"></span>'; row.querySelector('.err').textContent = 'Błąd: ' + e.message;
  } finally { busy = false; orb.classList.remove('thinking'); box.scrollTop = box.scrollHeight; }
}
window.smiriAsk = (t) => { $('#input').value = t; $('#input').focus(); autosize(); };

/* ---------- załączniki ---------- */
function renderAttachments() {
  const el = $('#attachments'); el.innerHTML = '';
  pending.forEach((f, i) => { const c = document.createElement('span'); c.className = 'achip'; c.append(ico('clip'), document.createTextNode(f.name)); const x = document.createElement('button'); x.setAttribute('aria-label', 'Usuń'); x.append(ico('close')); x.onclick = () => { pending.splice(i, 1); renderAttachments(); }; c.append(x); el.append(c); });
  updateSend();
}
function updateSend() { $('#sendBtn').classList.toggle('empty', !$('#input').value.trim() && !pending.length); }
$('#file').onchange = async (e) => {
  for (const f of e.target.files) {
    if (pending.reduce((s, x) => s + x.size, 0) + f.size > 3 * 1024 * 1024) { alert('Za duże pliki — maksymalnie ok. 3 MB łącznie.'); break; }
    const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(f); });
    pending.push({ name: f.name, type: f.type || 'text/plain', data, size: f.size });
  }
  e.target.value = ''; renderAttachments();
};

/* ---------- eksport: Word i PDF ---------- */
async function bodyForExport(row) {
  const clone = row.querySelector('.body').cloneNode(true);
  clone.querySelector('.actions')?.remove(); clone.querySelector('.sources')?.remove();
  const src = [...row.querySelectorAll('.body canvas')], dst = [...clone.querySelectorAll('canvas')];
  src.forEach((c, i) => { const img = document.createElement('img'); img.src = c.toDataURL('image/png'); img.width = 560; dst[i].replaceWith(img); });
  const svgs = [...row.querySelectorAll('.body .widget svg')], svgd = [...clone.querySelectorAll('.widget svg')];
  for (let i = 0; i < svgs.length; i++) {
    try {
      const s = svgs[i], r = s.getBoundingClientRect(), xml = new XMLSerializer().serializeToString(s);
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); await img.decode();
      const cv = document.createElement('canvas'); cv.width = r.width * 2; cv.height = r.height * 2;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      const out = document.createElement('img'); out.src = cv.toDataURL('image/png'); out.width = Math.min(560, r.width); svgd[i].replaceWith(out);
    } catch {}
  }
  clone.querySelectorAll('iframe').forEach((f) => f.remove());
  clone.querySelectorAll('.card-b').forEach((b) => { b.textContent = ' → ' + b.textContent; });
  return clone.innerHTML;
}
async function exportWord(row) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Smiri</title></head><body style="font-family:Calibri,Arial">${await bodyForExport(row)}</body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
  a.download = (current.title || 'smiri').replace(/[^\w\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '') + '.doc'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function exportPdf(row) {
  const w = window.open('', '_blank'); if (!w) { alert('Zezwól na wyskakujące okna, aby wyeksportować PDF.'); return; }
  w.document.write(`<html><head><meta charset="utf-8"><title>${(current.title || 'Smiri').replace(/[<>]/g, '')}</title><style>body{font-family:-apple-system,Segoe UI,Arial;max-width:780px;margin:30px auto;line-height:1.55}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 10px}pre{background:#f3f3f8;padding:10px;overflow:auto}.timeline{border-left:2px solid #7b6bff;padding-left:16px}.tl-item{margin:10px 0}</style></head><body>${await bodyForExport(row)}</body></html>`);
  w.document.close(); setTimeout(() => w.print(), 400);
}

/* ---------- głos i „Hey Smiri” ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let wake = null, wakeOn = false, cmdRec = null;
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const t = text.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`>|]/g, ' ').slice(0, 1200);
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = settings.lang; speechSynthesis.speak(u);
}
function listenOnce(onText, onPartial) {
  if (!SR) { alert('Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome lub Safari.'); return false; }
  cmdRec = new SR(); cmdRec.lang = settings.lang; cmdRec.interimResults = true; let final = '';
  cmdRec.onresult = (e) => { let t = ''; for (const r of e.results) { t += r[0].transcript; if (r.isFinal) final = t; } onPartial && onPartial(t); };
  cmdRec.onend = () => { onText(final); cmdRec = null; }; cmdRec.start(); return true;
}
function openVoice() {
  $('#voice').hidden = false; $('#voiceText').textContent = 'Słucham…';
  if (wake) { wake.onend = null; try { wake.stop(); } catch {} }
  const ok = listenOnce((t) => { if (t) { $('#voiceText').textContent = t; send(t); } else closeVoice(); }, (t) => { $('#voiceText').textContent = t; });
  if (!ok) closeVoice();
}
function closeVoice() {
  $('#voice').hidden = true; if (cmdRec) try { cmdRec.abort(); } catch {}
  speechSynthesis.cancel(); if (wakeOn) startWake();
}
function startWake() {
  if (!SR) { alert('Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome lub Safari.'); wakeOn = false; return; }
  wake = new SR(); wake.lang = settings.lang; wake.continuous = true; wake.interimResults = true;
  wake.onresult = (e) => {
    const t = [...e.results].slice(e.resultIndex).map((r) => r[0].transcript.toLowerCase()).join(' ');
    if (/(hey|hej|hi|cześć|czesc)\s*(smiri|smiry|smyri|smirri|siri)/.test(t)) { wake.onend = null; try { wake.stop(); } catch {} openVoice(); }
  };
  wake.onend = () => { if (wakeOn && $('#voice').hidden) try { wake.start(); } catch {} };
  try { wake.start(); } catch {}
}
function toggleWake() {
  wakeOn = !wakeOn; $('#wakeBtn').classList.toggle('on', wakeOn); 
  if (wakeOn) startWake(); else if (wake) { wake.onend = null; try { wake.stop(); } catch {} }
}

/* ---------- persony (własne boty) ---------- */
let editing = null, pickedIcon = 'bot';
function renderIconPick() {
  const box = $('#pIcons'); box.innerHTML = '';
  ICON_NAMES.forEach((n) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ip' + (n === pickedIcon ? ' sel' : ''); b.append(ico(n)); b.onclick = () => { pickedIcon = n; renderIconPick(); }; box.append(b); });
}
function openPersona(p) {
  editing = p; pickedIcon = p ? pIcon(p) : 'bot'; renderIconPick();
  $('#personaTitle').textContent = p ? (p.builtin ? 'Persona wbudowana (kopia do edycji)' : 'Edytuj bota') : 'Stwórz własny czat';
  $('#pName').value = p && !p.builtin ? p.name : (p ? p.name + ' (moja)' : ''); $('#pPrompt').value = p?.prompt || '';
  $('#pGreet').value = p?.greet || ''; $('#pModel').value = p?.model || ''; $('#pDelete').hidden = !p || p.builtin;
  $('#personaDlg').showModal();
}
const personaData = () => ({ icon: pickedIcon, name: $('#pName').value.trim(), prompt: $('#pPrompt').value.trim(), greet: $('#pGreet').value.trim(), model: $('#pModel').value });
$('#pSave').onclick = () => {
  const data = personaData(); if (!data.name) return;
  let id;
  if (editing && !editing.builtin) { Object.assign(editing, data); id = editing.id; } else { id = uid(); personas.push({ id, ...data }); }
  store.set('smiri.personas', personas); renderPersonaSel(); $('#personaSel').value = id; newChat();
};
$('#pDelete').onclick = () => { if (editing && confirm('Usunąć tego bota?')) { personas = personas.filter((p) => p.id !== editing.id); store.set('smiri.personas', personas); renderPersonaSel(); $('#personaDlg').close(); newChat(); } };
$('#pExport').onclick = () => navigator.clipboard.writeText(JSON.stringify(personaData(), null, 2));
$('#pImport').onclick = () => {
  const t = prompt('Wklej JSON persony:'); if (!t) return;
  try { const d = JSON.parse(t); pickedIcon = ICON_NAMES.includes(d.icon) ? d.icon : 'bot'; renderIconPick(); $('#pName').value = d.name || ''; $('#pPrompt').value = d.prompt || ''; $('#pGreet').value = d.greet || ''; $('#pModel').value = d.model || ''; } catch { alert('Niepoprawny JSON.'); }
};
$('#personaSel').onchange = () => newChat();
function updatePersonaUI() {
  const p = persona(current?.personaId || $('#personaSel').value || 'smiri');
  const pi = $('#ppIcon'); pi.innerHTML = ''; pi.append(ico(pIcon(p))); $('#ppName').textContent = p.name;
}

/* ---------- ustawienia i UI ---------- */
settings.model = pickModel(settings.model);
function applyTheme() { if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = settings.theme; }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function isDark() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function openSettings() { $('#theme').value = settings.theme; $('#model').value = settings.model; $('#password').value = settings.password; $('#lang').value = settings.lang; $('#speak').checked = settings.speak; if (!$('#settings').open) $('#settings').showModal(); }
function autosize() { const t = $('#input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }
function renderSearchBtn() { $('#searchBtn').classList.toggle('on', settings.search); $('#searchBtn').title = 'Wyszukiwanie w internecie: ' + (settings.search ? 'włączone' : 'wyłączone'); }

const closeMenu = () => { $('#sidebar').classList.remove('open'); document.body.classList.remove('menu-open'); };
$('#newChat').onclick = () => { newChat(false); closeMenu(); };
$('#tempChat').onclick = () => { newChat(true); closeMenu(); };
$('#newTop').onclick = () => newChat(false);
$('#settingsBtn').onclick = () => { closeMenu(); openSettings(); };
$('#toolsBtn').onclick = () => { closeMenu(); $('#launcher').showModal(); };
$('#menuBtn').onclick = () => { $('#sidebar').classList.add('open'); document.body.classList.add('menu-open'); };
$('#sbClose').onclick = closeMenu; $('#scrim').onclick = closeMenu;
$('#sendBtn').onclick = () => send($('#input').value);
$('#micBtn').onclick = openVoice; $('#voiceClose').onclick = closeVoice; $('#wakeBtn').onclick = toggleWake;
$('#searchBtn').onclick = () => { settings.search = !settings.search; store.set('smiri.settings', settings); renderSearchBtn(); };
$('#input').addEventListener('input', () => { autosize(); updateSend(); });
$('#input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); send($('#input').value); } });
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#input').focus(); }
  if (e.key === 'Escape') { if (!$('#voice').hidden) closeVoice(); closePopovers(); }
});
$('#saveSettings').onclick = () => { settings = Object.assign(settings, { theme: $('#theme').value, model: $('#model').value, password: $('#password').value, lang: $('#lang').value, speak: $('#speak').checked }); store.set('smiri.settings', settings); applyTheme(); };
$('#clearAll').onclick = () => { if (confirm('Usunąć całą historię?')) { chats = []; persist(); $('#settings').close(); newChat(); } };
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));

/* ---------- menu podręczne (popover) ---------- */
function closePopovers() { ['#plusMenu', '#personaMenu'].forEach((id) => { $(id).hidden = true; }); $('#plusBtn').setAttribute('aria-expanded', 'false'); $('#personaPill').setAttribute('aria-expanded', 'false'); }
function popItem(iconName, label, sub, fn, sel) {
  const b = document.createElement('button'); b.className = 'pop-item' + (sel ? ' sel' : ''); b.append(ico(iconName));
  const t = document.createElement('span'); t.textContent = label; if (sub) { const sm = document.createElement('small'); sm.textContent = sub; t.append(sm); } b.append(t);
  b.onclick = () => { closePopovers(); fn(); }; return b;
}
function sep() { const d = document.createElement('div'); d.className = 'pop-sep'; return d; }
$('#plusBtn').onclick = (e) => {
  e.stopPropagation(); const m = $('#plusMenu'); if (!m.hidden) return closePopovers(); closePopovers(); m.innerHTML = '';
  m.append(popItem('clip', 'Dodaj plik lub zdjęcie', 'Obraz, PDF, tekst', () => $('#file').click()), sep());
  PLUS_ITEMS.forEach((o) => m.append(popItem(o.icon, o.label, '', () => { if (o.send) send(o.send); else { $('#input').value = o.pre; $('#input').focus(); autosize(); updateSend(); } })));
  const r = $('.box').getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = 'auto'; m.style.bottom = (innerHeight - r.top + 10) + 'px'; m.style.setProperty('--ox', '0'); m.style.setProperty('--oy', '100%');
  m.hidden = false; $('#plusBtn').setAttribute('aria-expanded', 'true');
};
$('#personaPill').onclick = (e) => {
  e.stopPropagation(); const m = $('#personaMenu'); if (!m.hidden) return closePopovers(); closePopovers(); m.innerHTML = '';
  allPersonas().forEach((p) => m.append(popItem(pIcon(p), p.name, '', () => { $('#personaSel').value = p.id; newChat(); }, p.id === ($('#personaSel').value || 'smiri'))));
  m.append(sep(), popItem('plus', 'Stwórz własnego bota', '', () => openPersona(null)), popItem('pencil', 'Edytuj tego bota', '', () => openPersona(persona($('#personaSel').value))));
  const r = $('#personaPill').getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.bottom = 'auto'; m.style.top = (r.bottom + 8) + 'px'; m.style.setProperty('--ox', '0'); m.style.setProperty('--oy', '0');
  m.hidden = false; $('#personaPill').setAttribute('aria-expanded', 'true');
};
document.addEventListener('click', (e) => { if (!e.target.closest('.popover')) closePopovers(); });

/* klawiatura na telefonie: dopasuj wysokość do widocznego obszaru */
if (window.visualViewport) {
  const fit = () => { document.documentElement.style.setProperty('--vvh', visualViewport.height + 'px'); window.scrollTo(0, 0); const m = $('#messages'); if (m && document.activeElement === $('#input')) m.scrollTop = m.scrollHeight; };
  visualViewport.addEventListener('resize', fit); fit();
}

hydrateIcons(); applyTheme(); renderPersonaSel(); renderSearchBtn(); newChat();
