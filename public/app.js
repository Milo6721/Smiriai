'use strict';
/* Smiri — rdzeń: czaty, projekty, pamięć, wysyłanie i ustawienia. */

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v, (key, val) => (key === 'files' || key === '_mem' || key === '_artOpened' ? undefined : val))); } catch {} },
};

let settings = Object.assign({ theme: 'dark', model: 'claude-sonnet-5-5', password: '', lang: 'pl-PL', speak: false, search: true, effort: 'medium', showThinking: false, style: 'default', aboutMe: '', howRespond: '', memoryOn: true }, store.get('smiri.settings', {}));
let chats = store.get('smiri.chats', []);
let memories = store.get('smiri.memory', []);
let projects = store.get('smiri.projects', []);
let personas = store.get('smiri.personas', []);
let current = null, busy = false, pending = [], abortCtl = null, researchNext = false, chatQuery = '';

const OK_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5'];
const pickModel = (m) => (OK_MODELS.includes(m) ? m : 'claude-sonnet-5-5');
settings.model = pickModel(settings.model);
if (!settings.themeSet) settings.theme = 'dark';   // ciemny domyślnie, dopóki użytkownik sam nie wybierze

const DEFAULT_PERSONAS = [
  { id: 'smiri', icon: 'spark', name: 'Smiri', prompt: '', builtin: true },
  { id: 'teacher', icon: 'gradcap', name: 'Nauczyciel', prompt: 'Jesteś cierpliwym nauczycielem. Tłumacz krok po kroku prostym językiem, podawaj przykłady, a na końcu zadaj jedno pytanie sprawdzające. Gdy pasuje, zaproponuj fiszki.', builtin: true },
  { id: 'dev', icon: 'code', name: 'Programista', prompt: 'Jesteś doświadczonym programistą. Odpowiadaj precyzyjnie, z działającym kodem w blokach kodu i krótkim wyjaśnieniem. Wskazuj błędy i przypadki brzegowe. Dłuższe programy podawaj jako artefakty.', builtin: true },
  { id: 'translator', icon: 'globe', name: 'Tłumacz', prompt: 'Jesteś tłumaczem. Tłumacz tekst użytkownika na język, o który prosi (domyślnie PL↔EN), zachowując ton. Na końcu, jeśli to ważne, dodaj krótką uwagę o niuansach.', builtin: true },
];
const allPersonas = () => [...DEFAULT_PERSONAS, ...personas];
const pIcon = (p) => p.icon || 'bot';
const persona = (id) => allPersonas().find((p) => p.id === id) || DEFAULT_PERSONAS[0];
const project = (id) => projects.find((p) => p.id === id);

const STYLES = {
  default: { label: 'Domyślny', text: '' },
  concise: { label: 'Zwięzły', text: 'Odpowiadaj bardzo zwięźle: krótkie zdania, bez wstępów i podsumowań.' },
  explain: { label: 'Wyjaśniający', text: 'Wyjaśniaj dokładnie i przystępnie, krok po kroku, z przykładami i analogiami.' },
  formal: { label: 'Formalny', text: 'Używaj formalnego, profesjonalnego tonu, pełnych zdań i precyzyjnego słownictwa.' },
  casual: { label: 'Luźny', text: 'Pisz swobodnie i po koleżeńsku, prostym językiem, jak do znajomego.' },
};

const SYSTEM = `Jesteś Smiri — szybkim, mądrym asystentem AI. Odpowiadaj w języku użytkownika, rzeczowo, bez zbędnych wstępów. Używaj Markdown. Nie używaj emoji. Wzory matematyczne zapisuj w LaTeX: $...$ (w tekście) i $$...$$ (osobna linia).

Widżety wstawiaj jako bloki kodu z DOKŁADNIE tymi nazwami języków, gdy pomagają użytkownikowi:
1) \`\`\`chart — JSON konfiguracji Chart.js 4 (type, data, options), bez funkcji i komentarzy; opcjonalne "title" na najwyższym poziomie.
2) \`\`\`mermaid — diagram Mermaid (flowchart, sequenceDiagram, mindmap, classDiagram, gantt, erDiagram…).
3) \`\`\`timeline — [{"date":"1969","title":"…","text":"…"}] — oś czasu.
4) \`\`\`flashcards — [{"q":"…","a":"…"}] — fiszki.
5) \`\`\`currency — {"amount":100,"from":"USD","to":"PLN"} — aplikacja pobiera aktualny kurs; nie zgaduj kursów w tekście.
6) \`\`\`weather — {"city":"Kraków"} — pogoda i prognoza 5 dni.
7) \`\`\`stock — {"symbol":"aapl.us"} — wykres notowań (symbole Stooq: aapl.us, msft.us, pkn.pl, ^spx, eurusd, btc.v).
8) \`\`\`map — {"query":"Wawel, Kraków"} — mapa miejsca.
9) \`\`\`slides — [{"title":"…","bullets":["…"]}] — prezentacja z przyciskiem pobrania PowerPointa.

ARTEFAKTY: gdy wynik jest dłuższy i samodzielny (strona lub aplikacja HTML, grafika SVG, dokument, plik z kodem), umieść go w bloku zaczynającym się od linii ~~~artifact i kończącym linią ~~~ (tyldy, nie backticki). Pierwsza linia wewnątrz to JSON nagłówka w jednej linii: {"type":"html","title":"Kalkulator"} (type: html, svg, markdown, code, mermaid; dla code dodaj "language"). Potem linia --- i treść. HTML ma być kompletnym dokumentem z wbudowanym CSS i JS. Przy prośbie o zmianę wygeneruj pełny artefakt ponownie z tym samym tytułem. Krótkie fragmenty kodu podawaj w zwykłych blokach kodu.

PAMIĘĆ: gdy użytkownik poda trwały fakt o sobie lub poprosi, byś coś zapamiętał, dodaj na samym końcu blok \`\`\`memory z {"add":"krótki fakt w trzeciej osobie"}.
PODPOWIEDZI: na końcu odpowiedzi dłuższej niż dwa zdania dodaj blok \`\`\`followups z tablicą 2–3 krótkich pytań, które użytkownik mógłby zadać dalej.

Tabele pisz w Markdown. Nie opisuj składni widżetów. Gdy masz wyszukiwarkę, używaj jej przy aktualnych faktach i podawaj źródła. Do zdjęć, PDF-ów i plików użytkownika odnoś się wprost.`;

function buildSystem(p, research) {
  const parts = [SYSTEM];
  const st = STYLES[settings.style]?.text; if (st) parts.push('# Styl odpowiedzi\n' + st);
  if (settings.aboutMe.trim()) parts.push('# O użytkowniku\n' + settings.aboutMe.trim());
  if (settings.howRespond.trim()) parts.push('# Jak odpowiadać\n' + settings.howRespond.trim());
  if (settings.memoryOn && !current?.temp && memories.length) parts.push('# Pamięć (znane fakty o użytkowniku)\n' + memories.slice(0, 60).map((m) => '- ' + m.text).join('\n'));
  const pr = current?.projectId && project(current.projectId);
  if (pr) {
    parts.push(`# Projekt: ${pr.name}\n${pr.instructions || ''}`);
    let budget = 80000; (pr.files || []).forEach((f) => { if (budget <= 0) return; const t = f.text.slice(0, budget); budget -= t.length; parts.push(`## Plik projektu: ${f.name}\n${t}`); });
  }
  if (p.prompt) parts.push(`# Persona: ${p.name}\n${p.prompt}`);
  if (research) parts.push('# Tryb: głębokie badanie\nPrzeprowadź dokładne badanie: wykonaj wiele wyszukiwań z różnych źródeł, porównaj je, a wynik podaj jako uporządkowany raport z nagłówkami, kluczowymi wnioskami i rzetelnie podanymi źródłami. Zaznacz niepewności.');
  return parts.join('\n\n');
}

const GRAD = {
  blue: 'linear-gradient(135deg,#5ac8fa,#007aff)', purple: 'linear-gradient(135deg,#c084fc,#7d4cdb)', orange: 'linear-gradient(135deg,#ffb340,#ff7a00)',
  green: 'linear-gradient(135deg,#6be08a,#1fa855)', pink: 'linear-gradient(135deg,#ff8fb1,#ff2d6f)', teal: 'linear-gradient(135deg,#5ee0d6,#0aa1b8)',
};
const PLUS_ITEMS = [
  { icon: 'chartbar', label: 'Wykres', pre: 'Narysuj wykres: ' }, { icon: 'flow', label: 'Schemat', pre: 'Narysuj schemat/diagram: ' },
  { icon: 'timeline', label: 'Oś czasu', pre: 'Zrób oś czasu: ' }, { icon: 'cards', label: 'Fiszki', pre: 'Zrób fiszki do nauki: ' },
  { icon: 'slides', label: 'Prezentacja', pre: 'Zrób prezentację na temat: ' }, { icon: 'layers', label: 'Strona lub aplikacja', pre: 'Zrób jako artefakt stronę HTML: ' },
  { icon: 'exchange', label: 'Kurs walut', send: 'Przelicz walutę: 100 USD na PLN' }, { icon: 'translate', label: 'Przetłumacz', pre: 'Przetłumacz na angielski: ' },
];
const STARTERS = [
  { icon: 'chartbar', g: 'blue', t: 'Wykres', s: 'Największe miasta Polski', p: 'Narysuj wykres słupkowy: populacja 5 największych miast Polski' },
  { icon: 'layers', g: 'purple', t: 'Aplikacja', s: 'Kalkulator kredytu jako strona', p: 'Zrób jako artefakt działający kalkulator kredytu hipotecznego w HTML' },
  { icon: 'globe', g: 'teal', t: 'Głębokie badanie', s: 'Rynek fotowoltaiki w Polsce', p: '__research__Zrób raport o rynku fotowoltaiki w Polsce w 2025 roku' },
  { icon: 'code', g: 'orange', t: 'Kod', s: 'Uruchom skrypt w Pythonie', p: 'Napisz w Pythonie program liczący liczby pierwsze do 100 i go uruchomię' },
  { icon: 'cards', g: 'green', t: 'Nauka', s: 'Fiszki z angielskiego', p: 'Zrób 8 fiszek z angielskiego (czasowniki nieregularne)' },
  { icon: 'slides', g: 'pink', t: 'Prezentacja', s: 'Energia odnawialna', p: 'Zrób prezentację o energii odnawialnej (6 slajdów)' },
];

/* ---------- czaty ---------- */
function newChat(temp = false, projectId) {
  dropTemp(); closeArtifact();
  const p = persona($('#personaSel').value || 'smiri');
  current = { id: uid(), title: temp ? 'Czat tymczasowy' : 'Nowy czat', temp, personaId: p.id, projectId: projectId !== undefined ? projectId : (current?.projectId || ''), t: Date.now(), messages: [] };
  renderAll();
}
function dropTemp() { if (current && current.temp) current = null; }
function persist() { store.set('smiri.chats', chats.filter((c) => !c.temp)); }
function saveCurrent() {
  if (!current || current.temp || !current.messages.length) return;
  current.t = Date.now();
  if (!chats.find((c) => c.id === current.id)) chats.unshift(current);
  persist(); renderList();
}
function openChat(id) { dropTemp(); closeArtifact(); current = chats.find((c) => c.id === id); $('#personaSel').value = current.personaId || 'smiri'; renderAll(); closeSidebar(); }
window.addEventListener('beforeunload', dropTemp);

function renderPersonaSel() {
  const sel = $('#personaSel'), v = sel.value; sel.innerHTML = '';
  allPersonas().forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.append(o); });
  sel.value = allPersonas().some((p) => p.id === v) ? v : 'smiri';
}
function chatText(c) { return (c.title + ' ' + c.messages.map((m) => m.content).join(' ')).toLowerCase(); }
function groupChats(list) {
  const now = new Date(); const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); const day = 864e5;
  const groups = [['Przypięte', []], ['Dziś', []], ['Wczoraj', []], ['Ostatnie 7 dni', []], ['Starsze', []]];
  [...list].sort((a, b) => (b.t || 0) - (a.t || 0)).forEach((c) => {
    const t = c.t || 0; const g = c.pinned ? 0 : t >= d0 ? 1 : t >= d0 - day ? 2 : t >= d0 - 7 * day ? 3 : 4; groups[g][1].push(c);
  });
  return groups.filter((g) => g[1].length);
}
function renderList() {
  const el = $('#chatList'); el.innerHTML = '';
  const q = chatQuery.trim().toLowerCase();
  const list = q ? chats.filter((c) => chatText(c).includes(q)) : chats;
  if (!list.length) { const e = document.createElement('div'); e.className = 'empty-list'; e.textContent = q ? 'Brak wyników' : 'Tu pojawią się Twoje rozmowy'; el.append(e); return; }
  groupChats(list).forEach(([label, items]) => {
    const h = document.createElement('div'); h.className = 'grp-title'; h.textContent = label; el.append(h);
    items.forEach((c) => {
      const d = document.createElement('div'); d.className = 'chat-item' + (current && c.id === current.id ? ' active' : '');
      const s = document.createElement('span'); s.textContent = c.title;
      const x = document.createElement('button'); x.className = 'more'; x.setAttribute('aria-label', 'Opcje'); x.append(ico('more'));
      x.onclick = (e) => { e.stopPropagation(); chatMenu(c, x); };
      d.append(ico(c.projectId && project(c.projectId) ? 'folder' : pIcon(persona(c.personaId))), s, x); d.onclick = () => openChat(c.id);
      d.oncontextmenu = (e) => { e.preventDefault(); chatMenu(c, { x: e.clientX, y: e.clientY }); };
      el.append(d);
    });
  });
}
function chatMenu(c, anchor) {
  openMenu(anchor, [
    { icon: 'pin', label: c.pinned ? 'Odepnij' : 'Przypnij', fn: () => { c.pinned = !c.pinned; persist(); renderList(); } },
    { icon: 'pencil', label: 'Zmień nazwę', fn: () => { const t = prompt('Nazwa rozmowy:', c.title); if (t && t.trim()) { c.title = t.trim().slice(0, 80); persist(); renderList(); } } },
    { icon: 'download', label: 'Eksportuj jako Markdown', fn: () => exportChat(c) },
    'sep',
    { icon: 'trash', label: 'Usuń', danger: true, fn: () => { chats = chats.filter((k) => k.id !== c.id); persist(); if (current && current.id === c.id) newChat(); else renderList(); toast('Rozmowa usunięta'); } },
  ], { alignRight: !anchor.x });
}
function exportChat(c) {
  const md = `# ${c.title}\n\n` + c.messages.map((m) => `**${m.role === 'user' ? 'Ty' : 'Smiri'}:**\n\n${m.content.replace(/```(?:followups|memory)[\s\S]*?```/g, '').trim()}\n`).join('\n---\n\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' })); a.download = c.title.replace(/[^\w\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '').trim() + '.md'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* ---------- widok czatu ---------- */
function updateHeader() {
  const p = persona(current?.personaId || $('#personaSel').value || 'smiri');
  const pi = $('#ppIcon'); pi.innerHTML = ''; pi.append(ico(pIcon(p))); $('#ppName').textContent = p.name;
  const pr = current?.projectId && project(current.projectId); const b = $('#projBadge'); b.hidden = !pr; if (pr) { b.innerHTML = ''; b.append(ico('folder'), document.createTextNode(pr.name)); }
  $('#tempBadge').hidden = !current?.temp;
}
function renderAll() {
  renderList(); updateHeader(); updateSend();
  const box = $('#messages'); box.innerHTML = '';
  if (!current.messages.length) { box.append(welcomeEl(persona(current.personaId))); return; }
  current.messages.forEach((m, i) => box.append(msgEl(m, i, true)));
  box.scrollTop = box.scrollHeight; updateToBottom();
}
function welcomeEl(p) {
  const w = document.createElement('div'); w.id = 'welcome';
  const pr = current?.projectId && project(current.projectId);
  w.innerHTML = `<div class="orb big"></div><h1></h1><p></p><div class="sugg-grid"></div>`;
  w.querySelector('h1').textContent = p.id === 'smiri' ? (pr ? pr.name : 'Cześć, jestem Smiri') : p.name;
  w.querySelector('p').textContent = pr ? 'Rozmowa w projekcie. Smiri zna jego instrukcje i pliki.' : p.id === 'smiri' ? 'Pytaj o cokolwiek. Rysuję wykresy, buduję strony i aplikacje, szukam w sieci i uruchamiam kod.' : (p.greet || 'Napisz, w czym mogę pomóc.');
  if (p.id === 'smiri' && !pr) STARTERS.forEach((o, i) => {
    const c = document.createElement('button'); c.className = 'sugg'; c.style.setProperty('--i', i);
    const tile = document.createElement('span'); tile.className = 'tile'; tile.style.setProperty('--g', GRAD[o.g]); tile.append(ico(o.icon));
    const tx = document.createElement('span'); tx.innerHTML = '<div class="t"></div><div class="s"></div>'; tx.querySelector('.t').textContent = o.t; tx.querySelector('.s').textContent = o.s;
    c.append(tile, tx); c.onclick = () => { if (o.p.startsWith('__research__')) { researchNext = true; renderAttachments(); send(o.p.slice(12)); } else send(o.p); }; w.querySelector('.sugg-grid').append(c);
  });
  else w.querySelector('.sugg-grid').remove();
  return w;
}

/* ---------- strumień z /api/chat ---------- */
const authHeaders = () => Object.assign({ 'content-type': 'application/json' }, settings.password ? { 'x-smiri-pass': settings.password } : {});
async function smiriStream(params, onText, ex = {}) {
  const res = await fetch('/api/chat', { method: 'POST', headers: authHeaders(), signal: ex.signal, body: JSON.stringify({ effort: settings.effort, ...params }) });
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
      if (j.type === 'content_block_delta') {
        if (j.delta?.type === 'text_delta') onText(j.delta.text);
        else if (j.delta?.type === 'thinking_delta' && ex.onThink) ex.onThink(j.delta.thinking);
      }
      if (j.type === 'content_block_start' && j.content_block?.type === 'web_search_tool_result' && Array.isArray(j.content_block.content) && ex.onSource)
        j.content_block.content.forEach((r) => r.url && ex.onSource({ url: r.url, title: r.title }));
    }
  }
}
window.smiriStream = smiriStream;

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

/* ---------- wysyłanie i odpowiedź ---------- */
function setBusy(b) {
  busy = b; const s = $('#sendBtn'); s.classList.toggle('stop', b); s.classList.remove('empty'); s.innerHTML = ''; s.append(ico(b ? 'stop' : 'up')); s.setAttribute('aria-label', b ? 'Zatrzymaj' : 'Wyślij'); if (!b) updateSend();
  $('#voice .orb').classList.toggle('thinking', b);
}
function nearBottom(box) { return box.scrollHeight - box.scrollTop - box.clientHeight < 160; }
async function send(text) {
  text = (text || '').trim();
  if ((!text && !pending.length) || busy) return;
  text = text || 'Przeanalizuj załączony plik.';
  if (!current) newChat();
  if (!current.messages.length) current.title = text.slice(0, 48);
  const um = { role: 'user', content: text, files: pending, attached: pending.map((f) => f.name) };
  pending = []; current.messages.push(um); $('#welcome')?.remove();
  const box = $('#messages'); const urow = msgEl(um, current.messages.length - 1, true); urow.classList.add('enter'); box.append(urow);
  $('#input').value = ''; autosize(); renderAttachments();
  await runAssistant();
}
async function runAssistant() {
  if (busy) return; const research = researchNext; researchNext = false; renderAttachments();
  setBusy(true); abortCtl = new AbortController();
  const box = $('#messages'), p = persona(current.personaId), mi = current.messages.length;
  const ai = { role: 'assistant', content: '', sources: [] };
  const row = msgEl(ai, mi, false); row.classList.add('streaming', 'enter'); row.querySelector('.body').innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; box.append(row);
  box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  let last = 0; const paint = () => { const now = Date.now(); if (now - last > 90) { last = now; const nb = nearBottom(box); fillAi(row, ai, false); if (nb) box.scrollTop = box.scrollHeight; } };
  const finishAi = () => { current.messages.push(ai); row.classList.remove('streaming'); fillAi(row, ai, true); saveCurrent(); };
  try {
    await smiriStream({ model: pickModel(p.model || settings.model), search: settings.search, research, thinking: settings.showThinking, messages: apiMessages(), system: buildSystem(p, research) },
      (d) => { ai.content += d; paint(); },
      { signal: abortCtl.signal, onThink: (d) => { ai.thinking = (ai.thinking || '') + d; paint(); }, onSource: (s) => { if (!ai.sources.find((x) => x.url === s.url)) ai.sources.push(s); } });
    if (!ai.content) ai.content = '_(pusta odpowiedź)_';
    finishAi();
    if (settings.speak || !$('#voice').hidden) speak(ai.content);
    if (current.messages.length === 2 && !current.temp) autoTitle(current);
  } catch (e) {
    if (e.name === 'AbortError') { if (ai.content) finishAi(); else row.remove(); }
    else {
      row.classList.remove('streaming'); const b = row.querySelector('.body'); b.innerHTML = '';
      const er = document.createElement('div'); er.className = 'err-box'; const t = document.createElement('span'); t.textContent = e.message || 'Nie udało się uzyskać odpowiedzi.'; er.append(t);
      const r = document.createElement('button'); r.className = 'chip'; r.append(ico('refresh'), document.createTextNode('Spróbuj ponownie')); r.onclick = () => { row.remove(); runAssistant(); }; er.append(r); b.append(er);
    }
  } finally { abortCtl = null; setBusy(false); if (nearBottom(box)) box.scrollTop = box.scrollHeight; updateToBottom(); }
}
function stopGeneration() { if (abortCtl) abortCtl.abort(); }
function regenerate() {
  if (busy) return;
  while (current.messages.length && current.messages.at(-1).role === 'assistant') current.messages.pop();
  if (!current.messages.length) return; renderAll(); runAssistant();
}
function startEdit(row, m, mi) {
  if (busy) return; const col = row.querySelector('.ucol'); col.innerHTML = '';
  const ta = document.createElement('textarea'); ta.className = 'edit-ta'; ta.value = m.content; ta.rows = Math.min(8, Math.max(2, m.content.split('\n').length));
  const bar = document.createElement('div'); bar.className = 'edit-bar';
  const c = document.createElement('button'); c.className = 'btn-ghost'; c.textContent = 'Anuluj'; c.onclick = () => renderAll();
  const s = document.createElement('button'); s.className = 'btn-primary'; s.textContent = 'Wyślij ponownie';
  s.onclick = () => { const t = ta.value.trim(); if (!t) return; current.messages.splice(mi + 1); m.content = t; renderAll(); runAssistant(); };
  bar.append(c, s); col.append(ta, bar); ta.focus();
}
async function autoTitle(c) {
  try {
    let t = ''; const first = c.messages[0].content.slice(0, 400);
    await smiriStream({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: `Podaj bardzo krótki tytuł (maksymalnie 5 słów, bez cudzysłowów i kropki) dla rozmowy zaczynającej się od:\n${first}` }], search: false, effort: 'low' }, (d) => { t += d; });
    t = t.trim().replace(/^["„]|["”]$/g, '').slice(0, 60); if (t) { c.title = t; persist(); renderList(); }
  } catch { /* zostaje tytuł z pierwszej wiadomości */ }
}
window.smiriAsk = (t) => { $('#input').value = t; $('#input').focus(); autosize(); updateSend(); };

/* ---------- załączniki i tryby ---------- */
function renderAttachments() {
  const el = $('#attachments'); el.innerHTML = '';
  if (researchNext) { const c = document.createElement('span'); c.className = 'achip mode'; c.append(ico('globe'), document.createTextNode('Głębokie badanie')); const x = document.createElement('button'); x.setAttribute('aria-label', 'Wyłącz'); x.append(ico('close')); x.onclick = () => { researchNext = false; renderAttachments(); }; c.append(x); el.append(c); }
  pending.forEach((f, i) => { const c = document.createElement('span'); c.className = 'achip'; c.append(ico('clip'), document.createTextNode(f.name)); const x = document.createElement('button'); x.setAttribute('aria-label', 'Usuń'); x.append(ico('close')); x.onclick = () => { pending.splice(i, 1); renderAttachments(); }; c.append(x); el.append(c); });
  updateSend();
}
function updateSend() { if (!busy) $('#sendBtn').classList.toggle('empty', !$('#input').value.trim() && !pending.length); }
$('#file').onchange = async (e) => {
  for (const f of e.target.files) {
    if (pending.reduce((s, x) => s + x.size, 0) + f.size > 3 * 1024 * 1024) { toast('Za duże pliki — maksymalnie ok. 3 MB łącznie'); break; }
    const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(f); });
    pending.push({ name: f.name, type: f.type || 'text/plain', data, size: f.size });
  }
  e.target.value = ''; renderAttachments();
};

/* ---------- eksport: Word i PDF ---------- */
async function bodyForExport(row) {
  const clone = row.querySelector('.body').cloneNode(true);
  clone.querySelectorAll('.actions,.sources,.followups,.cb-acts,.cb-out,.think').forEach((e) => e.remove());
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
  clone.querySelectorAll('iframe,.art-card').forEach((f) => f.remove());
  clone.querySelectorAll('.card-b').forEach((b) => { b.textContent = ' → ' + b.textContent; });
  return clone.innerHTML;
}
async function exportWord(row) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Smiri</title></head><body style="font-family:Calibri,Arial">${await bodyForExport(row)}</body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
  a.download = (current.title || 'smiri').replace(/[^\w\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '') + '.doc'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function exportPdf(row) {
  const w = window.open('', '_blank'); if (!w) { toast('Zezwól na wyskakujące okna, aby wyeksportować PDF'); return; }
  w.document.write(`<html><head><meta charset="utf-8"><title>${(current.title || 'Smiri').replace(/[<>]/g, '')}</title><style>body{font-family:-apple-system,Segoe UI,Arial;max-width:780px;margin:30px auto;line-height:1.55}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 10px}pre{background:#f3f3f8;padding:10px;overflow:auto}.timeline{border-left:2px solid #7b6bff;padding-left:16px}.tl-item{margin:10px 0}</style></head><body>${await bodyForExport(row)}</body></html>`);
  w.document.close(); setTimeout(() => w.print(), 400);
}

/* ---------- głos i „Hey Smiri” ---------- */
/* Jedna ciągła sesja rozpoznawania mowy obsługuje i hasło, i polecenie — bez przełączania mikrofonu,
   które kończyło sesję i zamykało ekran. */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const WAKE_RE = /(?:hej|hey|hi|hello|ok|okej|cześć|czesc)[\s,.!-]*(?:smiri|smiry|smyri|smirri|smyry|smire|smirii|siri|siry|smiri)/i;
let rec = null, ignoreUntil = 0, wakeOn = false, vmode = 'off', cmdFrom = 0, cmdTimer = 0, idleTimer = 0, lastLen = 0, speaking = false, recStarting = false;
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const t = text.replace(/```[\s\S]*?```/g, ' ').replace(/~~~artifact[\s\S]*?~~~/g, ' ').replace(/[#*_`>|$]/g, ' ').slice(0, 1200);
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = settings.lang;
  u.onstart = () => { speaking = true; }; u.onend = u.onerror = () => { speaking = false; if (!$('#voice').hidden && !busy) setTimeout(() => { if (!speaking && !busy) closeVoice(); }, 1400); };
  speechSynthesis.speak(u);
}
function voiceStatus(t) { $('#voiceText').textContent = t; }
function startRec() {
  if (!SR) { toast('Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome lub Safari.'); wakeOn = false; $('#wakeBtn').classList.remove('on'); return false; }
  if (rec || recStarting) return true;
  const r = new SR(); r.lang = settings.lang; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1; lastLen = 0; ignoreUntil = 0;
  r.onresult = (e) => {
    lastLen = e.results.length;
    if (speaking) return;                                     // nie słuchaj własnego głosu
    if (vmode === 'wake') {
      const from = Math.max(e.resultIndex, ignoreUntil);
      const t = [...e.results].slice(from).map((x) => x[0].transcript).join(' ');
      const m = t.match(WAKE_RE);
      if (m) { vmode = 'cmd'; cmdFrom = e.results.length - 1; wakeCut = t.slice(m.index + m[0].length); showVoice(); onCmd(e); }
    } else if (vmode === 'cmd') onCmd(e);
  };
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { toast('Zezwól przeglądarce na użycie mikrofonu'); wakeOn = false; $('#wakeBtn').classList.remove('on'); vmode = 'off'; closeVoice(); }
  };
  r.onend = () => { rec = null; recStarting = false; if (wakeOn || vmode === 'cmd') setTimeout(() => { if (wakeOn || vmode === 'cmd') startRec(); }, 300); };
  try { r.start(); rec = r; } catch { setTimeout(() => (rec = null), 0); return false; }
  return true;
}
let wakeCut = '';
function cmdTextFrom(e) {
  const parts = [...e.results].slice(cmdFrom).map((x) => x[0].transcript).join(' ');
  let t = parts; if (wakeCut !== null && cmdFrom === e.results.length - 1 && WAKE_RE.test(parts)) t = parts.replace(/^.*?(?:hej|hey|hi|hello|ok|okej|cześć|czesc)[\s,.!-]*(?:smiri|smiry|smyri|smirri|smyry|smire|smirii|siri|siry)/i, '');
  return t.replace(/^[\s,.!-]+/, '').trim();
}
function onCmd(e) {
  const t = cmdTextFrom(e); clearTimeout(idleTimer);
  voiceStatus(t || 'Słucham…');
  clearTimeout(cmdTimer);
  if (t) cmdTimer = setTimeout(() => submitVoice(t), 1700);      // koniec wypowiedzi po chwili ciszy
  else idleTimer = setTimeout(() => { if (vmode === 'cmd' && !$('#voice').hidden) closeVoice(); }, 9000);
}
function submitVoice(t) {
  clearTimeout(cmdTimer); if (vmode !== 'cmd') return;
  vmode = wakeOn ? 'wake' : 'off'; ignoreUntil = lastLen; voiceStatus(t);
  if (!wakeOn && rec) { try { rec.stop(); } catch {} }
  send(t);
}
function showVoice() { $('#voice').hidden = false; voiceStatus('Słucham…'); clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (vmode === 'cmd' && !$('#voice').hidden) closeVoice(); }, 9000); }
function openVoice() {                                          // przycisk mikrofonu
  if (!SR) { toast('Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome lub Safari.'); return; }
  vmode = 'cmd'; wakeCut = null; cmdFrom = rec ? lastLen : 0; showVoice();
  if (!rec) startRec();
}
function closeVoice() {
  clearTimeout(cmdTimer); clearTimeout(idleTimer); $('#voice').hidden = true; speechSynthesis.cancel(); speaking = false;
  vmode = wakeOn ? 'wake' : 'off'; if (!wakeOn && rec) { try { rec.stop(); } catch {} }
}
function toggleWake() {
  wakeOn = !wakeOn; $('#wakeBtn').classList.toggle('on', wakeOn);
  if (wakeOn) { vmode = 'wake'; if (startRec()) toast('Nasłuchuję. Powiedz: „Hey Smiri”'); }
  else { vmode = 'off'; if (rec) { try { rec.stop(); } catch {} } }
}

/* ---------- persony ---------- */
let editing = null, pickedIcon = 'bot';
function renderIconPick() {
  const box = $('#pIcons'); box.innerHTML = '';
  ICON_NAMES.forEach((n) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ip' + (n === pickedIcon ? ' sel' : ''); b.append(ico(n)); b.onclick = () => { pickedIcon = n; renderIconPick(); }; box.append(b); });
}
function openPersona(p) {
  editing = p; pickedIcon = p ? pIcon(p) : 'bot'; renderIconPick();
  $('#personaTitle').textContent = p ? (p.builtin ? 'Kopia persony do edycji' : 'Edytuj bota') : 'Stwórz własny czat';
  $('#pName').value = p && !p.builtin ? p.name : (p ? p.name + ' (moja)' : ''); $('#pPrompt').value = p?.prompt || '';
  $('#pGreet').value = p?.greet || ''; $('#pModel').value = p?.model || ''; $('#pDelete').hidden = !p || p.builtin;
  $('#personaDlg').showModal();
}
const personaData = () => ({ icon: pickedIcon, name: $('#pName').value.trim(), prompt: $('#pPrompt').value.trim(), greet: $('#pGreet').value.trim(), model: $('#pModel').value });
$('#pSave').onclick = () => {
  const data = personaData(); if (!data.name) return;
  let id; if (editing && !editing.builtin) { Object.assign(editing, data); id = editing.id; } else { id = uid(); personas.push({ id, ...data }); }
  store.set('smiri.personas', personas); renderPersonaSel(); $('#personaSel').value = id; newChat();
};
$('#pDelete').onclick = () => { if (editing && confirm('Usunąć tego bota?')) { personas = personas.filter((p) => p.id !== editing.id); store.set('smiri.personas', personas); renderPersonaSel(); $('#personaDlg').close(); newChat(); } };
$('#pExport').onclick = () => { navigator.clipboard.writeText(JSON.stringify(personaData(), null, 2)); toast('Skopiowano JSON'); };
$('#pImport').onclick = () => {
  const t = prompt('Wklej JSON persony:'); if (!t) return;
  try { const d = JSON.parse(t); pickedIcon = ICON_NAMES.includes(d.icon) ? d.icon : 'bot'; renderIconPick(); $('#pName').value = d.name || ''; $('#pPrompt').value = d.prompt || ''; $('#pGreet').value = d.greet || ''; $('#pModel').value = d.model || ''; } catch { toast('Niepoprawny JSON'); }
};
$('#personaSel').onchange = () => newChat();

/* ---------- projekty ---------- */
function saveProjects() { store.set('smiri.projects', projects); updateHeader(); }
function openProjects(editId) {
  const dlg = $('#projects'), body = $('#projBody'); body.innerHTML = '';
  const title = $('#projTitle');
  if (!editId) {
    title.textContent = 'Projekty';
    const intro = document.createElement('p'); intro.className = 'muted'; intro.textContent = 'Projekt to wspólne instrukcje i pliki dla serii rozmów. Smiri zna je w każdym czacie projektu.'; body.append(intro);
    projects.forEach((pr) => { const r = document.createElement('button'); r.className = 'proj-row'; const t = document.createElement('span'); t.className = 'tile'; t.style.setProperty('--g', GRAD.blue); t.append(ico('folder')); const x = document.createElement('span'); x.innerHTML = '<b></b><small></small>'; x.querySelector('b').textContent = pr.name; x.querySelector('small').textContent = `${pr.files?.length || 0} plików · ${chats.filter((c) => c.projectId === pr.id).length} rozmów`; r.append(t, x, ico('chevron')); r.onclick = () => openProjects(pr.id); body.append(r); });
    const nb = document.createElement('button'); nb.className = 'btn-primary'; nb.style.marginTop = '12px'; nb.append(ico('plus'), document.createTextNode('Nowy projekt')); nb.onclick = () => { const pr = { id: uid(), name: 'Nowy projekt', instructions: '', files: [] }; projects.push(pr); saveProjects(); openProjects(pr.id); }; body.append(nb);
  } else {
    const pr = project(editId); title.textContent = 'Projekt';
    const f1 = document.createElement('div'); f1.className = 'field'; f1.innerHTML = '<label>Nazwa</label><input type="text">'; const ni = f1.querySelector('input'); ni.value = pr.name; ni.oninput = () => { pr.name = ni.value; saveProjects(); };
    const f2 = document.createElement('div'); f2.className = 'field'; f2.innerHTML = '<label>Instrukcje projektu</label><textarea rows="6" placeholder="Np. Pomagasz mi pisać pracę magisterską z ekonomii. Odpowiadaj formalnie i cytuj źródła."></textarea>'; const ta = f2.querySelector('textarea'); ta.value = pr.instructions || ''; ta.oninput = () => { pr.instructions = ta.value; saveProjects(); };
    const f3 = document.createElement('div'); f3.className = 'field'; f3.innerHTML = '<label>Wiedza projektu (pliki tekstowe)</label>';
    const list = document.createElement('div'); const draw = () => { list.innerHTML = ''; (pr.files || []).forEach((f, i) => { const r = document.createElement('div'); r.className = 'list-item'; const d = document.createElement('div'); d.textContent = f.name; const sm = document.createElement('small'); sm.textContent = Math.round(f.text.length / 1000) + ' tys. znaków'; d.append(sm); const x = document.createElement('button'); x.className = 'x'; x.append(ico('close')); x.onclick = () => { pr.files.splice(i, 1); saveProjects(); draw(); }; r.append(d, x); list.append(r); }); };
    const add = document.createElement('button'); add.className = 'btn-ghost'; add.append(ico('clip'), document.createTextNode('Dodaj plik')); const fi = document.createElement('input'); fi.type = 'file'; fi.multiple = true; fi.accept = '.txt,.md,.csv,.json,.html,.js,.py,.css,.xml,.yaml,.yml'; fi.hidden = true;
    add.onclick = () => fi.click(); fi.onchange = async () => { pr.files = pr.files || []; for (const f of fi.files) { if (f.size > 400 * 1024) { toast(f.name + ' jest za duży (maks. 400 KB)'); continue; } pr.files.push({ name: f.name, text: await f.text() }); } saveProjects(); draw(); fi.value = ''; };
    f3.append(list, add, fi); draw();
    const act = document.createElement('div'); act.className = 'sheet-actions wrap';
    const del = document.createElement('button'); del.className = 'btn-danger'; del.textContent = 'Usuń projekt'; del.onclick = () => { if (confirm('Usunąć projekt? Rozmowy zostaną, ale stracą kontekst projektu.')) { projects = projects.filter((p) => p.id !== pr.id); chats.forEach((c) => { if (c.projectId === pr.id) c.projectId = ''; }); if (current?.projectId === pr.id) current.projectId = ''; persist(); saveProjects(); openProjects(); } };
    const g = document.createElement('span'); g.className = 'grp'; const back = document.createElement('button'); back.className = 'btn-ghost'; back.textContent = 'Wstecz'; back.onclick = () => openProjects();
    const go = document.createElement('button'); go.className = 'btn-primary'; go.textContent = 'Nowy czat w projekcie'; go.onclick = () => { dlg.close(); newChat(false, pr.id); closeSidebar(); }; g.append(back, go); act.append(del, g);
    body.append(f1, f2, f3, act);
  }
  if (!dlg.open) dlg.showModal();
}

/* ---------- pamięć ---------- */
function saveMemory() { store.set('smiri.memory', memories); }
function applyMemory(items) {
  if (!settings.memoryOn || current?.temp) return;
  items.forEach((t) => { t = t.trim(); if (!t || memories.some((m) => m.text.toLowerCase() === t.toLowerCase())) return; const m = { id: uid(), text: t, t: Date.now() }; memories.unshift(m); saveMemory(); toast('Zapamiętano: ' + t.slice(0, 70), 'Cofnij', () => { memories = memories.filter((x) => x.id !== m.id); saveMemory(); }); });
}
function renderMemoryList() {
  const el = $('#memList'); el.innerHTML = '';
  if (!memories.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Smiri jeszcze nic o Tobie nie zapamiętał. Powiedz „zapamiętaj, że…”.'; el.append(p); return; }
  memories.forEach((m) => { const r = document.createElement('div'); r.className = 'list-item'; const d = document.createElement('div'); d.textContent = m.text; const x = document.createElement('button'); x.className = 'x'; x.setAttribute('aria-label', 'Usuń'); x.append(ico('close')); x.onclick = () => { memories = memories.filter((k) => k.id !== m.id); saveMemory(); renderMemoryList(); }; r.append(d, x); el.append(r); });
}

/* ---------- ustawienia ---------- */
function applyTheme() { if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = settings.theme; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = isDark() ? '#000000' : '#f5f5f7'; }
function openSettings() {
  $('#theme').value = settings.theme; $('#model').value = settings.model; $('#password').value = settings.password; $('#lang').value = settings.lang; $('#speak').checked = settings.speak;
  $('#effort').value = settings.effort; $('#showThink').checked = settings.showThinking; $('#style').value = settings.style; $('#aboutMe').value = settings.aboutMe; $('#howRespond').value = settings.howRespond; $('#memOn').checked = settings.memoryOn;
  renderMemoryList(); if (!$('#settings').open) $('#settings').showModal();
}
$('#saveSettings').onclick = () => {
  settings = Object.assign(settings, { theme: $('#theme').value, model: pickModel($('#model').value), password: $('#password').value, lang: $('#lang').value, speak: $('#speak').checked, effort: $('#effort').value, showThinking: $('#showThink').checked, style: $('#style').value, aboutMe: $('#aboutMe').value, howRespond: $('#howRespond').value, memoryOn: $('#memOn').checked });
  settings.themeSet = true; store.set('smiri.settings', settings); applyTheme();
};
$('#clearAll').onclick = () => { if (confirm('Usunąć całą historię rozmów?')) { chats = []; persist(); $('#settings').close(); newChat(); } };
$('#clearMem').onclick = () => { if (confirm('Wyczyścić całą pamięć?')) { memories = []; saveMemory(); renderMemoryList(); } };
function autosize() { const t = $('#input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px'; }
function renderSearchBtn() { $('#searchBtn').classList.toggle('on', settings.search); $('#searchBtn').title = 'Wyszukiwanie w internecie: ' + (settings.search ? 'włączone' : 'wyłączone'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); document.body.classList.remove('menu-open'); }

/* ---------- paleta poleceń (Cmd/Ctrl + K) ---------- */
let palSel = 0, palItems = [];
function paletteActions() {
  const A = [
    { icon: 'plus', label: 'Nowy czat', fn: () => newChat(false) }, { icon: 'hourglass', label: 'Czat tymczasowy', fn: () => newChat(true) },
    { icon: 'grid', label: 'Narzędzia', fn: () => $('#launcher').showModal() }, { icon: 'folder', label: 'Projekty', fn: () => openProjects() },
    { icon: 'sliders', label: 'Ustawienia', fn: openSettings }, { icon: 'brain', label: 'Pamięć', fn: openSettings },
    { icon: 'globe', label: settings.search ? 'Wyłącz wyszukiwanie w sieci' : 'Włącz wyszukiwanie w sieci', fn: () => $('#searchBtn').click() },
    { icon: 'moon', label: 'Zmień motyw (jasny / ciemny)', fn: () => { settings.theme = isDark() ? 'light' : 'dark'; settings.themeSet = true; store.set('smiri.settings', settings); applyTheme(); } },
  ];
  allPersonas().forEach((p) => A.push({ icon: pIcon(p), label: 'Persona: ' + p.name, fn: () => { $('#personaSel').value = p.id; newChat(); } }));
  TILES.forEach(([k, ic, label]) => A.push({ icon: ic, label: 'Narzędzie: ' + label, fn: () => openPanel(k) }));
  return A;
}
function openPalette() { const p = $('#palette'); p.hidden = false; const i = $('#palInput'); i.value = ''; paletteDraw(''); setTimeout(() => i.focus(), 30); }
function closePalette() { $('#palette').hidden = true; }
function paletteDraw(q) {
  q = q.trim().toLowerCase(); const list = $('#palList'); list.innerHTML = ''; palItems = [];
  const acts = paletteActions().filter((a) => !q || a.label.toLowerCase().includes(q)).slice(0, q ? 8 : 9);
  const found = q ? chats.filter((c) => chatText(c).includes(q)).slice(0, 8).map((c) => ({ icon: 'search', label: c.title, sub: 'Rozmowa', fn: () => openChat(c.id) })) : chats.slice(0, 4).map((c) => ({ icon: 'search', label: c.title, sub: 'Ostatnia rozmowa', fn: () => openChat(c.id) }));
  const ask = q ? [{ icon: 'spark', label: `Zapytaj Smiri: „${$('#palInput').value.trim()}”`, fn: () => send($('#palInput').value.trim()) }] : [];
  [['', ask], ['Rozmowy', found], ['Polecenia', acts]].forEach(([h, arr]) => {
    if (!arr.length) return; if (h) { const d = document.createElement('div'); d.className = 'pal-head'; d.textContent = h; list.append(d); }
    arr.forEach((it) => { const i = palItems.length; palItems.push(it); const b = document.createElement('button'); b.className = 'pal-item' + (i === palSel ? ' sel' : ''); b.append(ico(it.icon)); const t = document.createElement('span'); t.textContent = it.label; if (it.sub) { const sm = document.createElement('small'); sm.textContent = it.sub; t.append(sm); } b.append(t); b.onmouseenter = () => { palSel = i; paletteMark(); }; b.onclick = () => { closePalette(); it.fn(); }; list.append(b); });
  });
  palSel = 0; paletteMark();
}
function paletteMark() { const els = document.querySelectorAll('#palList .pal-item'); els.forEach((e, i) => e.classList.toggle('sel', i === palSel)); els[palSel]?.scrollIntoView({ block: 'nearest' }); }
$('#palInput').addEventListener('input', (e) => paletteDraw(e.target.value));
$('#palInput').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); paletteMark(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); paletteMark(); }
  else if (e.key === 'Enter') { e.preventDefault(); const it = palItems[palSel]; if (it) { closePalette(); it.fn(); } }
});
$('#palette').addEventListener('click', (e) => { if (e.target.id === 'palette') closePalette(); });

/* ---------- przewijanie ---------- */
function updateToBottom() { const b = $('#messages'); $('#toBottom').hidden = b.scrollHeight - b.scrollTop - b.clientHeight < 240; }
$('#messages').addEventListener('scroll', updateToBottom, { passive: true });
$('#toBottom').onclick = () => $('#messages').scrollTo({ top: $('#messages').scrollHeight, behavior: 'smooth' });

/* ---------- zdarzenia interfejsu ---------- */
$('#newChat').onclick = () => { newChat(false); closeSidebar(); };
$('#tempChat').onclick = () => { newChat(true); closeSidebar(); };
$('#newTop').onclick = () => newChat(false);
$('#settingsBtn').onclick = () => { closeSidebar(); openSettings(); };
$('#toolsBtn').onclick = () => { closeSidebar(); $('#launcher').showModal(); };
$('#projBtn').onclick = () => { closeSidebar(); openProjects(); };
$('#menuBtn').onclick = () => { $('#sidebar').classList.add('open'); document.body.classList.add('menu-open'); };
$('#sbClose').onclick = closeSidebar; $('#scrim').onclick = closeSidebar;
$('#sendBtn').onclick = () => (busy ? stopGeneration() : send($('#input').value));
$('#micBtn').onclick = openVoice; $('#voiceClose').onclick = closeVoice; $('#wakeBtn').onclick = toggleWake;
$('#searchBtn').onclick = () => { settings.search = !settings.search; store.set('smiri.settings', settings); renderSearchBtn(); };
$('#projBadge').onclick = (e) => { e.stopPropagation(); $('#personaPill').click(); };
$('#chatSearch').addEventListener('input', (e) => { chatQuery = e.target.value; renderList(); });
$('#input').addEventListener('input', () => { autosize(); updateSend(); });
$('#input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); if (!busy) send($('#input').value); } });
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (mod && k === 'k') { e.preventDefault(); $('#palette').hidden ? openPalette() : closePalette(); }
  else if (mod && e.shiftKey && k === 'o') { e.preventDefault(); newChat(false); $('#input').focus(); }
  else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $('#palette').hidden) { e.preventDefault(); $('#input').focus(); }
  if (e.key === 'Escape') { if (!$('#palette').hidden) closePalette(); else if (!$('#voice').hidden) closeVoice(); else if (document.body.classList.contains('art-open') && !document.querySelector('dialog[open]')) closeArtifact(); closeMenu(); }
});
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));

$('#plusBtn').onclick = (e) => {
  e.stopPropagation(); if (openMenu.anchor === e.currentTarget && !$('#pop').hidden) return closeMenu();
  openMenu(e.currentTarget, [
    { icon: 'clip', label: 'Dodaj plik lub zdjęcie', sub: 'Obraz, PDF, tekst, CSV', fn: () => $('#file').click() },
    { icon: 'globe', label: 'Głębokie badanie', sub: 'Wiele wyszukiwań i raport ze źródłami', check: researchNext, keep: true, fn: () => { researchNext = !researchNext; renderAttachments(); closeMenu(); } },
    { icon: 'bulb', label: 'Pokazuj tok rozumowania', sub: 'Podgląd myślenia modelu', check: settings.showThinking, keep: true, fn: () => { settings.showThinking = !settings.showThinking; store.set('smiri.settings', settings); closeMenu(); toast(settings.showThinking ? 'Tok rozumowania włączony' : 'Tok rozumowania wyłączony'); } },
    'sep', { header: 'Szybkie polecenia' },
    ...PLUS_ITEMS.map((o) => ({ icon: o.icon, label: o.label, fn: () => { if (o.send) send(o.send); else { $('#input').value = o.pre; $('#input').focus(); autosize(); updateSend(); } } })),
  ], { up: true });
};
$('#personaPill').onclick = (e) => {
  e.stopPropagation(); if (openMenu.anchor === $('#personaPill') && !$('#pop').hidden) return closeMenu();
  const cur = $('#personaSel').value || 'smiri';
  openMenu($('#personaPill'), [
    { header: 'Persona' },
    ...allPersonas().map((p) => ({ icon: pIcon(p), label: p.name, sel: p.id === cur, fn: () => { $('#personaSel').value = p.id; newChat(); } })),
    'sep', { header: 'Projekt' },
    { icon: 'folder', label: 'Bez projektu', sel: !current?.projectId, fn: () => { current.projectId = ''; saveCurrent(); updateHeader(); if (!current.messages.length) renderAll(); } },
    ...projects.map((pr) => ({ icon: 'folder', label: pr.name, sel: current?.projectId === pr.id, fn: () => { current.projectId = pr.id; saveCurrent(); updateHeader(); if (!current.messages.length) renderAll(); } })),
    { icon: 'sliders', label: 'Zarządzaj projektami…', fn: () => openProjects() },
    'sep', { icon: 'plus', label: 'Stwórz własnego bota', fn: () => openPersona(null) }, { icon: 'pencil', label: 'Edytuj tego bota', fn: () => openPersona(persona(cur)) },
  ]);
};

/* klawiatura na telefonie: dopasuj wysokość do widocznego obszaru */
if (window.visualViewport) {
  const fit = () => { document.documentElement.style.setProperty('--vvh', visualViewport.height + 'px'); window.scrollTo(0, 0); const m = $('#messages'); if (m && document.activeElement === $('#input')) m.scrollTop = m.scrollHeight; };
  visualViewport.addEventListener('resize', fit); fit();
}

hydrateIcons(); applyTheme(); renderPersonaSel(); renderSearchBtn(); newChat();
