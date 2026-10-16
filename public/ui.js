'use strict';
/* Smiri — drobne elementy interfejsu: powiadomienia i menu podręczne. */

function toast(msg, actionLabel, fn, ms = 4600) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const t = document.createElement('div'); t.className = 'toast';
  const s = document.createElement('span'); s.textContent = msg; t.append(s);
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
  if (actionLabel) { const b = document.createElement('button'); b.textContent = actionLabel; b.onclick = () => { fn && fn(); close(); }; t.append(b); }
  box.append(t); setTimeout(close, ms);
}

/* items: [{icon,label,sub,fn,sel,danger,header}] albo 'sep'. anchor: element lub {x,y}. */
function openMenu(anchor, items, opts = {}) {
  const m = document.getElementById('pop');
  m.innerHTML = '';
  items.forEach((it) => {
    if (it === 'sep') { const d = document.createElement('div'); d.className = 'pop-sep'; m.append(d); return; }
    if (it.header) { const d = document.createElement('div'); d.className = 'pop-head'; d.textContent = it.header; m.append(d); return; }
    const b = document.createElement('button'); b.className = 'pop-item' + (it.sel ? ' sel' : '') + (it.danger ? ' danger' : '');
    if (it.icon) b.append(ico(it.icon));
    const t = document.createElement('span'); t.className = 'pt'; t.textContent = it.label;
    if (it.sub) { const sm = document.createElement('small'); sm.textContent = it.sub; t.append(sm); }
    b.append(t);
    if (it.check !== undefined) { const c = document.createElement('span'); c.className = 'chk' + (it.check ? ' on' : ''); b.append(c); }
    b.onclick = (e) => { e.stopPropagation(); if (!it.keep) closeMenu(); it.fn && it.fn(e); };
    m.append(b);
  });
  m.hidden = false; m.style.visibility = 'hidden'; m.style.left = '0px'; m.style.top = '0px';
  const mw = m.offsetWidth, mh = m.offsetHeight, vw = innerWidth, vh = innerHeight;
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  let left = opts.alignRight ? r.right - mw : r.left;
  left = Math.max(10, Math.min(left, vw - mw - 10));
  const below = r.bottom + 8, above = r.top - 8 - mh;
  let top = opts.up ? above : below;
  if (top + mh > vh - 10 && above > 10) top = above; else if (top < 10) top = Math.max(10, below);
  top = Math.max(10, Math.min(top, vh - mh - 10));
  m.style.left = left + 'px'; m.style.top = top + 'px';
  m.style.setProperty('--ox', Math.max(0, Math.min(mw, (r.left + (r.right - r.left) / 2) - left)) + 'px');
  m.style.setProperty('--oy', top < r.top ? '100%' : '0%');
  m.style.visibility = ''; m.classList.remove('in'); void m.offsetWidth; m.classList.add('in');
  anchor.setAttribute && anchor.setAttribute('aria-expanded', 'true'); openMenu.anchor = anchor;
}
function closeMenu() {
  const m = document.getElementById('pop'); if (!m) return; m.hidden = true;
  if (openMenu.anchor && openMenu.anchor.setAttribute) openMenu.anchor.setAttribute('aria-expanded', 'false'); openMenu.anchor = null;
}
document.addEventListener('click', (e) => { if (!e.target.closest('#pop')) closeMenu(); });
window.addEventListener('resize', closeMenu);

/* okna: nie fokusuj automatycznie pierwszego pola (na telefonie wyskakuje klawiatura) */
(() => {
  const orig = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    orig.call(this);
    setTimeout(() => { const a = document.activeElement; if (a && this.contains(a) && a.matches('input,select,textarea') && !this.dataset.focus) a.blur(); }, 0);
  };
})();
