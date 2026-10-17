'use strict';
/* Smiri — renderowanie odpowiedzi: Markdown, wzory, kod, wykresy, schematy i artefakty. */

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function isDark() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
const uid = () => Math.random().toString(36).slice(2, 10);

if (window.marked) {
  marked.setOptions({ gfm: true, breaks: false });
  if (window.markedKatex) marked.use(markedKatex({ throwOnError: false, nonStandard: true }));
}
function renderMd(md) { return DOMPurify.sanitize(marked.parse(md), { ADD_ATTR: ['target'] }); }

/* ---------- wykresy ---------- */
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
  if (!radial && cfg.options.scales?.y2) delete cfg.options.scales.y2;
  return cfg;
}

/* ---------- widżety w odpowiedziach ---------- */
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
      renderMermaid(host, code);
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
function renderMermaid(host, code) {
  const dk = isDark();
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', flowchart: { curve: 'basis', htmlLabels: true, padding: 14 },
    themeVariables: { fontFamily: cssVar('--font') || 'system-ui', fontSize: '15px', background: 'transparent',
      primaryColor: dk ? '#1f2c4a' : '#e6f0ff', primaryBorderColor: dk ? '#3d86f2' : '#0a6cf0', primaryTextColor: dk ? '#f5f5f7' : '#1d1d1f',
      secondaryColor: dk ? '#2a2140' : '#f1e8fb', tertiaryColor: dk ? '#1c1c1e' : '#ffffff', lineColor: dk ? '#a1a1a6' : '#6e6e73', textColor: dk ? '#f5f5f7' : '#1d1d1f', edgeLabelBackground: dk ? '#1c1c1e' : '#ffffff' } });
  return mermaid.render('m' + uid(), code).then((r) => { host.innerHTML = r.svg; })
    .catch(() => { host.innerHTML = '<span class="err">Nie udało się narysować schematu.</span><pre><code></code></pre>'; host.querySelector('code').textContent = code; });
}

/* ---------- parsowanie odpowiedzi ---------- */
const WIDGET_TYPES = 'chart|mermaid|timeline|flashcards|currency|weather|stock|map|slides|followups|memory';
const RE_W = new RegExp('```(' + WIDGET_TYPES + ')[ \\t]*\\n([\\s\\S]*?)```', 'g');
const RE_W_OPEN = new RegExp('```(?:' + WIDGET_TYPES + ')[^`]*$');
const RE_ART = /~~~artifact[ \t]*\n([\s\S]*?)\n?~~~/g;
const RE_ART_OPEN = /~~~artifact[ \t]*\n[\s\S]*$/;
const ART_EXT = { html: 'html', svg: 'svg', markdown: 'md', mermaid: 'mmd', code: 'txt', js: 'js', javascript: 'js', python: 'py', py: 'py', css: 'css', json: 'json', ts: 'ts', typescript: 'ts', java: 'java', c: 'c', cpp: 'cpp', go: 'go', rust: 'rs', sql: 'sql', bash: 'sh', sh: 'sh' };
const ART_LABEL = { html: 'Strona', svg: 'Grafika', markdown: 'Dokument', code: 'Kod', mermaid: 'Schemat' };

function parseArt(raw) {
  const m = raw.match(/^\s*(\{[^\n]*\})\s*\n---[ \t]*\n([\s\S]*)$/);
  if (m) { try { const h = JSON.parse(m[1]); return { type: h.type || 'html', title: h.title || 'Artefakt', lang: h.language || '', body: m[2] }; } catch { /* spadnij niżej */ } }
  return { type: 'markdown', title: 'Dokument', lang: '', body: raw };
}
function parseMessage(text, final) {
  const out = { md: text, arts: [], widgets: [], followups: [], memory: [] };
  out.md = out.md.replace(RE_ART, (_, raw) => { out.arts.push(parseArt(raw)); return `\n\n<div data-a="${out.arts.length - 1}"></div>\n\n`; });
  out.md = out.md.replace(RE_ART_OPEN, (all) => { const t = all.match(/"title"\s*:\s*"([^"]*)"/); out.arts.push({ creating: true, title: t ? t[1] : 'Artefakt', type: ((all.match(/"type"\s*:\s*"([^"]*)"/) || [])[1]) || 'html', body: '' }); return `\n\n<div data-a="${out.arts.length - 1}"></div>\n\n`; });
  out.md = out.md.replace(RE_W, (_, type, code) => {
    if (type === 'followups') { try { out.followups = JSON.parse(code).filter((s) => typeof s === 'string').slice(0, 4); } catch {} return ''; }
    if (type === 'memory') { try { const d = JSON.parse(code); if (d.add) out.memory.push(String(d.add)); } catch {} return ''; }
    if (!final) return DRAW;
    out.widgets.push({ type, code: code.trim() }); return `\n\n<div data-w="${out.widgets.length - 1}"></div>\n\n`;
  });
  out.md = out.md.replace(RE_W_OPEN, DRAW);
  return out;
}
const DRAW = '\n\n<div class="drawing"><span></span><span></span><span></span><span></span></div>\n\n';

/* ---------- wiadomości ---------- */
function msgEl(m, mi, final) {
  const row = document.createElement('div'); row.className = 'msg ' + (m.role === 'user' ? 'user' : 'ai'); row.dataset.mi = mi;
  if (m.role === 'user') {
    const col = document.createElement('div'); col.className = 'ucol';
    const b = document.createElement('div'); b.className = 'body'; b.textContent = m.content;
    if (m.attached?.length) { const f = document.createElement('div'); f.className = 'att'; f.append(ico('clip'), document.createTextNode(m.attached.join(', '))); b.append(f); }
    const a = document.createElement('div'); a.className = 'uacts';
    const mk = (icon, title, fn) => { const x = document.createElement('button'); x.title = title; x.setAttribute('aria-label', title); x.append(ico(icon)); x.onclick = fn; a.append(x); };
    mk('copy', 'Kopiuj', () => { navigator.clipboard.writeText(m.content); toast('Skopiowano'); });
    mk('edit', 'Edytuj', () => startEdit(row, m, mi));
    col.append(b, a); row.append(col); return row;
  }
  const av = document.createElement('div'); av.className = 'av'; const col = document.createElement('div'); col.className = 'acol'; const b = document.createElement('div'); b.className = 'body';
  col.append(b); row.append(av, col); fillAi(row, m, final); return row;
}

function fillAi(row, m, final) {
  const body = row.querySelector('.body'), mi = +row.dataset.mi;
  const P = parseMessage(m.content, final);
  let html = '';
  if (m.thinking) html += `<details class="think"${final ? '' : ' open'}><summary>${final ? 'Tok rozumowania' : 'Myślę…'}</summary><div class="think-body"></div></details>`;
  html += renderMd(P.md);
  body.innerHTML = html;
  if (m.thinking) body.querySelector('.think-body').textContent = m.thinking;
  body.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  body.querySelectorAll('[data-w]').forEach((h) => { const w = P.widgets[+h.dataset.w]; if (w) hydrate(h, w); });
  body.querySelectorAll('[data-a]').forEach((h, i) => artCard(h, P.arts[+h.dataset.a], mi, +h.dataset.a, final));
  body.querySelectorAll('.tl-item,.card,.slide,.wx>div').forEach((e, i) => e.style.setProperty('--i', i));
  enhanceCode(body, final);
  if (!final && row.classList.contains('streaming')) setStatus(row, statusFor(m)); else setStatus(row, null);
  if (final && !m.noActions) {
    if (P.memory.length && !m._mem && typeof applyMemory === 'function') { m._mem = true; applyMemory(P.memory); }
    if (m.sources?.length) {
      const s = document.createElement('div'); s.className = 'sources';
      m.sources.slice(0, 8).forEach((x) => { const a = document.createElement('a'); a.href = x.url; a.target = '_blank'; a.rel = 'noopener'; a.append(ico('link'), document.createTextNode(x.title || x.url)); s.append(a); });
      body.append(s);
    }
    addActions(row, m, mi);
    if (P.followups.length && mi === current.messages.length - 1) {
      const f = document.createElement('div'); f.className = 'followups';
      P.followups.forEach((q, i) => { const c = document.createElement('button'); c.style.setProperty('--i', i); c.append(ico('up'), document.createTextNode(q)); c.onclick = () => send(q); f.append(c); });
      body.append(f);
    }
    if (P.arts.length && !m._artOpened && mi === current.messages.length - 1 && matchMedia('(min-width: 1100px)').matches) {
      m._artOpened = true; const last = P.arts.length - 1; if (!P.arts[last].creating) openArtifact(artKey(mi, last));
    }
  }
}
window.smiriRender = (row, text, final) => { row.dataset.mi = row.dataset.mi || '-1'; fillAi(row, { content: text, noActions: true }, final); };

function addActions(row, m, mi) {
  const a = document.createElement('div'); a.className = 'actions';
  const add = (icon, title, fn, on) => { const b = document.createElement('button'); b.title = title; b.setAttribute('aria-label', title); if (on) b.classList.add('on'); b.append(ico(icon)); b.onclick = (e) => fn(e, b); a.append(b); return b; };
  add('copy', 'Kopiuj', () => { navigator.clipboard.writeText(m.content.replace(/```(?:followups|memory)[\s\S]*?```/g, '').trim()); toast('Skopiowano'); });
  add('thumbup', 'Dobra odpowiedź', (e, b) => { m.feedback = m.feedback === 1 ? 0 : 1; saveCurrent(); a.querySelectorAll('.fb').forEach((x) => x.classList.remove('on')); if (m.feedback) b.classList.add('on'); }, m.feedback === 1).classList.add('fb');
  add('thumbdown', 'Zła odpowiedź', (e, b) => { m.feedback = m.feedback === -1 ? 0 : -1; saveCurrent(); a.querySelectorAll('.fb').forEach((x) => x.classList.remove('on')); if (m.feedback) b.classList.add('on'); }, m.feedback === -1).classList.add('fb');
  add('speaker', 'Przeczytaj na głos', () => speak(m.content));
  if (mi === current.messages.length - 1) add('refresh', 'Wygeneruj ponownie', () => regenerate());
  add('share', 'Eksportuj', (e, b) => openMenu(b, [{ icon: 'doc', label: 'Do Worda', fn: () => exportWord(row) }, { icon: 'pdf', label: 'Do PDF', fn: () => exportPdf(row) }, { icon: 'copy', label: 'Skopiuj jako Markdown', fn: () => { navigator.clipboard.writeText(m.content); toast('Skopiowano'); } }]));
  row.querySelector('.body').append(a);
}

/* ---------- kod: kolorowanie, kopiowanie, uruchamianie ---------- */
const RUNNABLE = { js: 'js', javascript: 'js', python: 'py', py: 'py' };
function enhanceCode(body, final) {
  body.querySelectorAll('pre > code').forEach((code) => {
    const pre = code.parentElement; if (pre.parentElement.classList.contains('codeblock')) return;
    const lang = ((code.className.match(/language-([\w+-]+)/) || [])[1] || '').toLowerCase();
    if (window.hljs && final) { try { if (lang && hljs.getLanguage(lang)) hljs.highlightElement(code); else if (lang === 'html') hljs.highlightElement(code); } catch {} }
    const wrap = document.createElement('div'); wrap.className = 'codeblock';
    const head = document.createElement('div'); head.className = 'cb-head';
    const l = document.createElement('span'); l.textContent = lang || 'kod'; head.append(l);
    const acts = document.createElement('span'); acts.className = 'cb-acts';
    const out = document.createElement('div'); out.className = 'cb-out'; out.hidden = true;
    if (final && RUNNABLE[lang]) { const r = document.createElement('button'); r.append(ico('play'), document.createTextNode('Uruchom')); r.onclick = () => (RUNNABLE[lang] === 'js' ? runJs(code.textContent, out) : runPy(code.textContent, out)); acts.append(r); }
    const c = document.createElement('button'); c.append(ico('copy'), document.createTextNode('Kopiuj')); c.onclick = () => { navigator.clipboard.writeText(code.textContent); toast('Skopiowano'); };
    acts.append(c); head.append(acts);
    pre.replaceWith(wrap); wrap.append(head, pre, out);
  });
}
function runJs(code, out) {
  out.hidden = false; out.innerHTML = ''; const id = uid();
  const line = (txt, cls) => { const d = document.createElement('div'); d.className = cls || ''; d.textContent = txt; out.append(d); };
  const ifr = document.createElement('iframe'); ifr.sandbox = 'allow-scripts'; ifr.style.display = 'none';
  const done = () => { window.removeEventListener('message', on); ifr.remove(); clearTimeout(tm); };
  const on = (e) => { const d = e.data; if (!d || d.__smiri !== id) return; if (d.k === 'log') line(d.v); else if (d.k === 'err') line(d.v, 'err'); else if (d.k === 'res') line('→ ' + d.v, 'res'); else if (d.k === 'done') { if (!out.children.length) line('(brak wyniku)', 'dim'); done(); } };
  const tm = setTimeout(() => { line('Przerwano po 10 s.', 'err'); done(); }, 10000);
  window.addEventListener('message', on);
  const safe = JSON.stringify(code).replace(/</g, '\\u003c');
  ifr.srcdoc = `<script>const id=${JSON.stringify(id)};const f=(v)=>{try{return typeof v==='string'?v:JSON.stringify(v,null,2)??String(v)}catch{return String(v)}};const s=(k,v)=>parent.postMessage({__smiri:id,k,v},'*');
console.log=(...a)=>s('log',a.map(f).join(' '));console.info=console.log;console.warn=console.log;console.error=(...a)=>s('err',a.map(f).join(' '));
(async()=>{try{const r=await (0,eval)(${safe});if(r!==undefined)s('res',f(r))}catch(e){s('err',String(e))}s('done')})();<\/script>`;
  document.body.append(ifr);
}
async function runPy(code, out) {
  out.hidden = false; out.innerHTML = '<div class="dim">Uruchamiam Pythona…</div>';
  try {
    if (!window.__pyodide) {
      await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
      window.__pyodide = await loadPyodide();
    }
    const py = window.__pyodide; let buf = '';
    py.setStdout({ batched: (x) => { buf += x + '\n'; } }); py.setStderr({ batched: (x) => { buf += x + '\n'; } });
    await py.loadPackagesFromImports(code);
    const r = await py.runPythonAsync(code); if (r !== undefined && r !== null) buf += '→ ' + String(r);
    out.innerHTML = ''; const d = document.createElement('div'); d.textContent = buf.trim() || '(brak wyniku)'; out.append(d);
  } catch (e) { out.innerHTML = ''; const d = document.createElement('div'); d.className = 'err'; d.textContent = String(e.message || e); out.append(d); }
}

/* ---------- artefakty ---------- */
const ART = {};
let artCur = null, artTab = 'preview';
const artKey = (mi, i) => `${current ? current.id : 'x'}|${mi}|${i}`;
const artIcon = (t) => ({ html: 'code', svg: 'image', markdown: 'doc', code: 'code', mermaid: 'flow' }[t] || 'layers');
function artCard(host, art, mi, i, final) {
  const key = artKey(mi, i); if (!art.creating) ART[key] = Object.assign(ART[key] || {}, art, { mi, i });
  host.className = 'art-card' + (art.creating ? ' creating' : '');
  host.innerHTML = '';
  const tile = document.createElement('span'); tile.className = 'tile'; tile.style.setProperty('--g', 'linear-gradient(135deg,#7d7aff,#bf5af2)'); tile.append(ico(artIcon(art.type)));
  const tx = document.createElement('span'); tx.className = 'at'; tx.innerHTML = '<b></b><small></small>'; tx.querySelector('b').textContent = art.title;
  tx.querySelector('small').textContent = art.creating ? 'Tworzę…' : `${ART_LABEL[art.type] || 'Artefakt'} · otwórz podgląd`;
  host.append(tile, tx);
  if (!art.creating) { host.setAttribute('role', 'button'); host.tabIndex = 0; host.onclick = () => openArtifact(key); host.onkeydown = (e) => { if (e.key === 'Enter') openArtifact(key); }; }
}
function artHtml(a) { return /<html[\s>]/i.test(a.body) ? a.body : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,system-ui,sans-serif;margin:16px}</style></head><body>${a.body}</body></html>`; }
function openArtifact(key, tab) {
  const a = ART[key]; if (!a) return; artCur = key; artTab = tab || (a.type === 'markdown' || a.type === 'code' ? 'preview' : 'preview');
  document.getElementById('artPanel').hidden = false; document.body.classList.add('art-open'); renderArtPanel();
}
function closeArtifact() { artCur = null; document.getElementById('artPanel').hidden = true; document.body.classList.remove('art-open'); }
function artFile(a) { return (a.title || 'artefakt').replace(/[^\w\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').trim().replace(/\s+/g, '-') + '.' + (a.type === 'code' ? (ART_EXT[(a.lang || '').toLowerCase()] || 'txt') : ART_EXT[a.type] || 'txt'); }
function saveArtifactEdit(a) {
  const m = current.messages[a.mi]; if (!m) return; let n = -1;
  m.content = m.content.replace(RE_ART, (all) => { n++; if (n !== a.i) return all; const hdr = JSON.stringify({ type: a.type, title: a.title, ...(a.lang ? { language: a.lang } : {}) }); return '~~~artifact\n' + hdr + '\n---\n' + a.body + '\n~~~'; });
  saveCurrent();
}
function renderArtPanel() {
  const a = ART[artCur]; if (!a) return closeArtifact();
  const P = document.getElementById('artPanel'); P.innerHTML = '';
  const head = document.createElement('div'); head.className = 'ap-head';
  const t = document.createElement('div'); t.className = 'ap-title'; t.textContent = a.title;
  const tabs = document.createElement('div'); tabs.className = 'seg';
  [['preview', 'Podgląd'], ['code', 'Kod'], ['edit', 'Edytuj']].forEach(([k, l]) => { const b = document.createElement('button'); b.textContent = l; if (artTab === k) b.classList.add('on'); b.onclick = () => { artTab = k; renderArtPanel(); }; tabs.append(b); });
  const acts = document.createElement('div'); acts.className = 'ap-acts';
  const mk = (icon, title, fn) => { const b = document.createElement('button'); b.className = 'icon'; b.title = title; b.setAttribute('aria-label', title); b.append(ico(icon)); b.onclick = fn; acts.append(b); };
  mk('copy', 'Kopiuj', () => { navigator.clipboard.writeText(a.body); toast('Skopiowano'); });
  mk('download', 'Pobierz', () => { const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([a.body], { type: 'text/plain;charset=utf-8' })); l.download = artFile(a); l.click(); setTimeout(() => URL.revokeObjectURL(l.href), 3000); });
  if (a.type === 'html' || a.type === 'svg') mk('expand', 'Pełny ekran', () => { const w = window.open(URL.createObjectURL(new Blob([a.type === 'svg' ? a.body : artHtml(a)], { type: a.type === 'svg' ? 'image/svg+xml' : 'text/html' })), '_blank'); if (!w) toast('Zezwól na wyskakujące okna'); });
  if (a.type === 'markdown') mk('doc', 'Do Worda', () => { const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob(['﻿', `<html><head><meta charset="utf-8"></head><body>${renderMd(a.body)}</body></html>`], { type: 'application/msword' })); l.download = artFile(a).replace(/\.md$/, '.doc'); l.click(); });
  mk('close', 'Zamknij', closeArtifact);
  head.append(t, tabs, acts);
  const body = document.createElement('div'); body.className = 'ap-body';
  if (artTab === 'preview') {
    if (a.type === 'html') { const f = document.createElement('iframe'); f.className = 'ap-frame'; f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups'); f.srcdoc = artHtml(a); body.append(f); }
    else if (a.type === 'svg') { const im = document.createElement('img'); im.className = 'ap-img'; im.alt = a.title; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.body); body.append(im); }
    else if (a.type === 'mermaid') { const w = document.createElement('div'); w.className = 'ap-doc widget'; body.append(w); renderMermaid(w, a.body); }
    else if (a.type === 'markdown') { const d = document.createElement('div'); d.className = 'ap-doc body'; d.innerHTML = renderMd(a.body); enhanceCode(d, true); body.append(d); }
    else { const pre = document.createElement('pre'); pre.className = 'ap-code'; const c = document.createElement('code'); c.textContent = a.body; if (a.lang) c.className = 'language-' + a.lang; pre.append(c); body.append(pre); if (window.hljs) try { hljs.highlightElement(c); } catch {} }
  } else if (artTab === 'code') {
    const pre = document.createElement('pre'); pre.className = 'ap-code'; const c = document.createElement('code'); c.textContent = a.body; c.className = 'language-' + (a.type === 'html' ? 'xml' : a.type === 'svg' ? 'xml' : a.lang || a.type); pre.append(c); body.append(pre); if (window.hljs) try { hljs.highlightElement(c); } catch {}
  } else {
    const ta = document.createElement('textarea'); ta.className = 'ap-edit'; ta.value = a.body; ta.spellcheck = false;
    let tm; ta.oninput = () => { a.body = ta.value; clearTimeout(tm); tm = setTimeout(() => saveArtifactEdit(a), 400); };
    body.append(ta);
    const bar = document.createElement('div'); bar.className = 'ap-ask';
    const b = document.createElement('button'); b.className = 'chip'; b.append(ico('spark'), document.createTextNode('Poproś Smiri o zmianę')); b.onclick = () => { window.smiriAsk(`Zmień artefakt „${a.title}”: `); if (matchMedia('(max-width: 1099px)').matches) closeArtifact(); };
    bar.append(b); body.append(bar);
  }
  P.append(head, body);
}

/* ---------- pasek stanu podczas pracy (fale + połyskujący tekst) ---------- */
function statusFor(m) {
  const t = (m.content || '').replace(RE_ART, '').replace(RE_W, '');
  if (RE_ART_OPEN.test(t)) return 'Tworzę artefakt…';
  const w = t.match(RE_W_OPEN);
  if (w) { const k = (w[0].match(/```(\w+)/) || [])[1]; return ({ chart: 'Rysuję wykres…', mermaid: 'Rysuję schemat…', timeline: 'Buduję oś czasu…', flashcards: 'Tworzę fiszki…', slides: 'Przygotowuję prezentację…', currency: 'Sprawdzam kurs…', weather: 'Sprawdzam pogodę…', stock: 'Pobieram notowania…', map: 'Szukam miejsca…' })[k] || 'Przygotowuję…'; }
  if ((t.match(/```/g) || []).length % 2 === 1) return 'Piszę kod…';
  if (!m.content) return m.thinking ? 'Myślę…' : (m.sources && m.sources.length ? 'Czytam źródła…' : 'Myślę…');
  return 'Piszę…';
}
function setStatus(row, text) {
  const col = row.querySelector('.acol'); if (!col) return;
  let st = col.querySelector(':scope > .status');
  if (!text) { if (st) st.remove(); return; }
  if (!st) { st = document.createElement('div'); st.className = 'status'; st.innerHTML = '<span class="wave"><i></i><i></i><i></i><i></i><i></i></span><span class="gl"></span>'; col.append(st); }
  const g = st.querySelector('.gl'); if (g.textContent !== text) g.textContent = text;
}
