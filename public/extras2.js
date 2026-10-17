'use strict';
/* Smiri — biblioteka artefaktów, zadania zaplanowane, dyktowanie i fale podczas pracy. */

/* ---------- dyktowanie do pola pisania ---------- */
let dict = null;
document.getElementById('dictBtn').onclick = () => {
  if (dict) { try { dict.stop(); } catch {} return; }
  if (!SR) { toast('Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome, Edge lub Safari.'); return; }
  const inp = document.getElementById('input'), base = inp.value, sep = base && !/\s$/.test(base) ? ' ' : '';
  const r = new SR(); r.lang = settings.lang; r.interimResults = true; r.continuous = false;
  r.onresult = (e) => { let t = ''; for (const x of e.results) t += x[0].transcript; inp.value = base + sep + t; autosize(); updateSend(); };
  r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Zezwól przeglądarce na użycie mikrofonu', null, null, 6000); else if (e.error === 'network') toast('Dyktowanie wymaga połączenia z internetem'); };
  r.onend = () => { dict = null; document.getElementById('dictBtn').classList.remove('on'); inp.focus(); };
  try { r.start(); dict = r; document.getElementById('dictBtn').classList.add('on'); haptic(8); } catch { dict = null; }
};

/* ---------- biblioteka artefaktów ---------- */
function artLibItems() {
  const out = [];
  chats.forEach((c) => c.messages.forEach((m, mi) => {
    if (m.role !== 'assistant') return; let i = 0;
    (m.content || '').replace(RE_ART, (all, raw) => { out.push({ chat: c, mi, i: i++, art: parseArt(raw) }); return all; });
  }));
  return out.sort((a, b) => (b.chat.t || 0) - (a.chat.t || 0));
}
function openArtLib() {
  const body = document.getElementById('artlibBody'); body.innerHTML = '';
  const items = artLibItems();
  const search = document.createElement('div'); search.className = 'search-box lib'; search.innerHTML = '<span></span><input type="search" placeholder="Szukaj artefaktów" autocomplete="off">'; search.firstChild.append(ico('search')); body.append(search);
  const list = document.createElement('div'); body.append(list);
  const draw = (q = '') => {
    list.innerHTML = ''; q = q.toLowerCase();
    const f = items.filter((x) => !q || (x.art.title + ' ' + x.chat.title).toLowerCase().includes(q));
    if (!f.length) { const p = document.createElement('p'); p.className = 'muted'; p.style.padding = '12px 4px'; p.textContent = items.length ? 'Brak wyników.' : 'Tu pojawią się strony, grafiki, dokumenty i kod, które Smiri przygotuje w rozmowach.'; list.append(p); return; }
    f.forEach((x, k) => {
      const r = document.createElement('button'); r.className = 'proj-row'; r.style.setProperty('--i', k);
      const t = document.createElement('span'); t.className = 'tile'; t.style.setProperty('--g', 'linear-gradient(135deg,#7d7aff,#bf5af2)'); t.append(ico(artIcon(x.art.type)));
      const d = document.createElement('span'); d.innerHTML = '<b></b><small></small>'; d.querySelector('b').textContent = x.art.title; d.querySelector('small').textContent = `${ART_LABEL[x.art.type] || 'Artefakt'} · ${x.chat.title}`;
      r.append(t, d, ico('chevron'));
      r.onclick = () => { document.getElementById('artlib').close(); openChat(x.chat.id); setTimeout(() => openArtifact(artKey(x.mi, x.i)), 60); };
      list.append(r);
    });
  };
  search.querySelector('input').oninput = (e) => draw(e.target.value); draw();
  document.getElementById('artlib').showModal();
}
document.getElementById('artLibBtn').onclick = () => { closeSidebar(); openArtLib(); };

/* ---------- zadania zaplanowane ---------- */
const TASKS_KEY = 'smiri.tasks';
let tasks = store.get(TASKS_KEY, []);
const saveTasks = () => store.set(TASKS_KEY, tasks);
const DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
function nextRun(t, from = Date.now()) {
  const [hh, mm] = (t.time || '08:00').split(':').map(Number);
  if (t.freq === 'once') { const ms = new Date(`${t.date}T${t.time || '08:00'}`).getTime(); return ms > from ? ms : null; }
  for (let d = 0; d < 9; d++) {
    const c = new Date(from); c.setDate(c.getDate() + d); c.setHours(hh, mm, 0, 0);
    if (c.getTime() <= from) continue;
    const dow = c.getDay();
    if (t.freq === 'daily' || (t.freq === 'weekdays' && dow >= 1 && dow <= 5) || (t.freq === 'weekly' && dow === +t.day)) return c.getTime();
  }
  return null;
}
function taskLabel(t) {
  const tm = t.time || '08:00';
  return t.freq === 'once' ? `Jednorazowo · ${new Date(`${t.date}T${tm}`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}, ${tm}` : t.freq === 'daily' ? `Codziennie o ${tm}` : t.freq === 'weekdays' ? `W dni robocze o ${tm}` : `Co tydzień, ${DAYS[+t.day]} o ${tm}`;
}
function runTask(t, manual) {
  if (busy) { toast('Smiri jeszcze odpowiada. Spróbuj za chwilę.'); return; }
  t.last = Date.now(); t.next = t.enabled !== false ? nextRun(t) : null; if (t.freq === 'once' && !manual) t.enabled = false; saveTasks();
  newChat(false, ''); current.title = t.name; send(t.prompt); haptic(10);
}
function dueCheck() {
  const now = Date.now();
  tasks.forEach((t) => {
    if (t.enabled === false || !t.next || t.next > now || t._pinged === t.next) return;
    const idle = current && !current.messages.length && !busy && !document.getElementById('input').value.trim() && document.getElementById('voice').hidden;
    if (idle && now - t.next < 5 * 60 * 1000) { t._pinged = t.next; runTask(t); }
    else { t._pinged = t.next; toast(`Zaplanowane: ${t.name}`, 'Uruchom', () => runTask(t), 20000); try { if (Notification.permission === 'granted') new Notification('Smiri', { body: t.name }); } catch {} t.next = nextRun(t); if (t.freq === 'once') t.enabled = false; saveTasks(); }
  });
}
tasks.forEach((t) => { if (t.enabled !== false && t.next && t.next < Date.now() - 60000) { t.missed = true; } });
setInterval(dueCheck, 20000); setTimeout(dueCheck, 2500);
function openSched() {
  const body = document.getElementById('schedBody'); body.innerHTML = '';
  const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Smiri wykona zadanie o wyznaczonej porze, gdy jest otwarty w przeglądarce. Jeśli akurat piszesz, dostaniesz powiadomienie z przyciskiem „Uruchom”.'; body.append(note);
  const list = document.createElement('div'); body.append(list);
  const draw = () => {
    list.innerHTML = '';
    if (!tasks.length) { const p = document.createElement('p'); p.className = 'muted'; p.style.padding = '6px 2px 10px'; p.textContent = 'Nie masz jeszcze zaplanowanych zadań.'; list.append(p); }
    tasks.forEach((t, k) => {
      const r = document.createElement('div'); r.className = 'list-item'; r.style.setProperty('--i', k);
      const d = document.createElement('div'); d.innerHTML = '<b></b><small></small><small class="nx"></small>'; d.querySelector('b').textContent = t.name; d.querySelectorAll('small')[0].textContent = taskLabel(t);
      d.querySelector('.nx').textContent = t.enabled === false ? 'Wyłączone' : (t.next ? 'Następne: ' + new Date(t.next).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Zakończone');
      const run = document.createElement('button'); run.className = 'x'; run.title = 'Uruchom teraz'; run.append(ico('play')); run.onclick = () => { document.getElementById('sched').close(); runTask(t, true); };
      const sw = document.createElement('input'); sw.type = 'checkbox'; sw.className = 'switch'; sw.checked = t.enabled !== false; sw.onchange = () => { t.enabled = sw.checked; t.next = t.enabled ? nextRun(t) : null; t._pinged = null; saveTasks(); draw(); };
      const del = document.createElement('button'); del.className = 'x'; del.title = 'Usuń'; del.append(ico('trash')); del.onclick = () => { tasks.splice(k, 1); saveTasks(); draw(); };
      r.append(d, run, sw, del); list.append(r);
    });
  };
  draw();
  const form = document.createElement('div'); form.className = 'task-form';
  form.innerHTML = `<h3>Nowe zadanie</h3>
    <div class="field"><label>Nazwa</label><input type="text" class="t-name" placeholder="Np. Poranne wiadomości"></div>
    <div class="field"><label>Co ma zrobić Smiri?</label><textarea class="t-prompt" rows="3" placeholder="Np. Podsumuj najważniejsze wiadomości technologiczne z dziś w 5 punktach."></textarea></div>
    <div class="field"><label>Kiedy?</label>
      <select class="t-freq"><option value="daily">Codziennie</option><option value="weekdays">W dni robocze</option><option value="weekly">Co tydzień</option><option value="once">Jednorazowo</option></select></div>
    <div class="bar2"><div class="field t-dayw" hidden><label>Dzień tygodnia</label><select class="t-day">${DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select></div>
      <div class="field t-datew" hidden><label>Data</label><input type="date" class="t-date"></div>
      <div class="field"><label>Godzina</label><input type="time" class="t-time" value="08:00"></div></div>
    <button type="button" class="btn-primary t-add">Zaplanuj</button>`;
  body.append(form);
  const q = (c) => form.querySelector(c), fr = q('.t-freq');
  const upd = () => { q('.t-dayw').hidden = fr.value !== 'weekly'; q('.t-datew').hidden = fr.value !== 'once'; }; fr.onchange = upd; upd();
  q('.t-date').value = new Date().toISOString().slice(0, 10);
  q('.t-add').onclick = () => {
    const prompt = q('.t-prompt').value.trim(); if (!prompt) { toast('Wpisz, co ma zrobić Smiri'); return; }
    const t = { id: uid(), name: q('.t-name').value.trim() || prompt.slice(0, 32), prompt, freq: fr.value, time: q('.t-time').value || '08:00', date: q('.t-date').value, day: q('.t-day').value, enabled: true };
    t.next = nextRun(t); if (!t.next) { toast('Ten termin już minął'); return; }
    tasks.push(t); saveTasks(); q('.t-name').value = ''; q('.t-prompt').value = ''; draw(); toast('Zadanie zaplanowane'); haptic(10);
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
  };
  document.getElementById('sched').showModal();
}
document.getElementById('schedBtn').onclick = () => { closeSidebar(); openSched(); };
// zadania, które minęły, gdy strona była zamknięta
setTimeout(() => { const missed = tasks.filter((t) => t.missed && t.enabled !== false); if (missed.length) { toast(`Ominięte zadania: ${missed.length}`, 'Zobacz', openSched, 12000); missed.forEach((t) => { delete t.missed; t.next = nextRun(t); }); saveTasks(); } }, 3000);

/* ---------- fale (styl Siri) pokazywane, gdy Smiri pracuje ---------- */
(() => {
  const host = document.getElementById('waves'); if (!host) return;
  const W = 1200, H = 150;
  const path = (amp, len, base, ph) => { let d = `M ${-len} ${base}`; let up = ph; for (let x = -len; x <= W * 2 + len; x += len / 2) { d += ` Q ${x + len / 4} ${base + (up ? -amp : amp)} ${x + len / 2} ${base}`; up = !up; } return d + ` L ${W * 2 + len} ${H} L ${-len} ${H} Z`; };
  const layers = [
    { amp: 22, len: 340, base: 96, ph: true, dur: 11, c1: '#64d2ff', c2: '#7d7aff', o: .5 },
    { amp: 28, len: 460, base: 108, ph: false, dur: 15, c1: '#bf5af2', c2: '#ff6fb5', o: .45 },
    { amp: 16, len: 280, base: 118, ph: true, dur: 9, c1: '#ff6fb5', c2: '#ffb86b', o: .4 },
  ];
  host.innerHTML = layers.map((l, i) => `<svg class="wv" style="animation-duration:${l.dur}s;${i % 2 ? 'animation-direction:reverse;' : ''}" viewBox="0 0 ${W * 2} ${H}" preserveAspectRatio="none"><defs><linearGradient id="wg${i}" x1="0" x2="1"><stop offset="0" stop-color="${l.c1}"/><stop offset=".5" stop-color="${l.c2}"/><stop offset="1" stop-color="${l.c1}"/></linearGradient></defs><path d="${path(l.amp, l.len, l.base, l.ph)}" fill="url(#wg${i})" opacity="${l.o}"/></svg>`).join('');
})();
