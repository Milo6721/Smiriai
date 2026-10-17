'use strict';
/* Smiri — własny zestaw ikon (linie 1.7 px, zaokrąglone zakończenia, siatka 24×24). Zamiast emoji. */
const ICON_PATHS = {
  plus: 'M12 5v14M5 12h14',
  hourglass: 'M7 3h10M7 21h10M8 3v3.5L12 12 8 17.5V21M16 3v3.5L12 12l4 5.5V21',
  pencil: 'M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z',
  note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4',
  cards: 'M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 6V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3',
  calc: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01',
  ruler: 'M4 16L16 4l4 4L8 20zM8 12l2 2M11 9l2 2M14 6l2 2',
  weather: 'M8 3v1.5M3 8h1.5M4.5 4.5l1 1M11.5 4.5l-1 1M10 9.3A3 3 0 1 0 5 8.2M9 20a3.5 3.5 0 0 1-.4-7 4.5 4.5 0 0 1 8.7-1A4 4 0 0 1 17 20z',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  scale: 'M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 7m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M8 17m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  clip: 'M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  left: 'M19 12H5M11 6l-6 6 6 6',
  chartbar: 'M5 20V11M12 20V5M19 20v-6',
  flow: 'M4 3h6a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 15h6a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM7 9v3a2 2 0 0 0 2 2h4',
  timeline: 'M12 3v18M12 6h6M12 12H6M12 18h6',
  slides: 'M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 21h8M12 17v4',
  exchange: 'M7 8h13M16 4l4 4-4 4M17 16H4M8 12l-4 4 4 4',
  lines: 'M4 6h16M4 12h16M4 18h10',
  translate: 'M4 5h9M8.5 3v2M6 5c.5 4 3 7.5 7 9.5M11 5c-.5 4-3 7.5-7 9.5M13 21l4-10 4 10M14.5 17.5h5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  cloud: 'M7 19a4 4 0 0 1-.6-7.96 5.5 5.5 0 0 1 10.6-1.5A4.5 4.5 0 0 1 17 19z',
  rain: 'M7 15a4 4 0 0 1-.6-7.96 5.5 5.5 0 0 1 10.6-1.5A4.5 4.5 0 0 1 17 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3',
  snow: 'M7 15a4 4 0 0 1-.6-7.96 5.5 5.5 0 0 1 10.6-1.5A4.5 4.5 0 0 1 17 15zM8 18.5h.01M12 18.5h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01',
  storm: 'M7 15a4 4 0 0 1-.6-7.96 5.5 5.5 0 0 1 10.6-1.5A4.5 4.5 0 0 1 17 15zM12.5 12l-2.5 4.5h4L11.5 21',
  fog: 'M4 8h16M3 12h18M5 16h14M8 20h8',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  gradcap: 'M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.2 2.7 3 6 3s6-1.8 6-3v-4.5M22 9v5',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  bot: 'M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM12 8V4M9 13h.01M15 13h.01M9.5 16.5h5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  pin: 'M9 4h6l-1 6 3 3v2H7v-2l3-3zM12 15v6',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.4c.6.6 1 1.3 1 2.1v.5h6v-.5c0-.8.4-1.5 1-2.1A6 6 0 0 0 12 3z',
  stop: 'M8 8h8v8H8z',
  thumbup: 'M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.8 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7',
  thumbdown: 'M7 13V4H4v9zM7 13l4 7c1.5 0 2.5-1 2.2-2.6L12.8 15H19a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17.8 4H7',
  refresh: 'M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5L20 15M20 20v-5h-5',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  play: 'M8 5l11 7-11 7z',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5',
  moon: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17zM14 7l3 3',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  archive: 'M4 7h16v4H4zM6 11v8h12v-8M10 15h4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  wave: 'M4 10v4M8 7v10M12 3v18M16 7v10M20 10v4',
  panel: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9.5 4v16',
  menu: 'M4 7h16M4 12h16M4 17h16',
  grid: 'M5 4h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM14 4h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 13h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM14 13h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z',
  chevron: 'M6 9l6 6 6-6',
  image: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 16l5-5 4 4 3-3 6 6M9 9m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
  close: 'M6 6l12 12M18 6L6 18',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  copy: 'M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  pdf: 'M6 3h9l4 4v14H6zM14 3v5h5M9 18v-5h1.8a1.6 1.6 0 0 1 0 3.2H9',
  speaker: 'M4 10v4h4l5 4V6l-5 4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  check: 'M5 12.5l4.5 4.5L19 7',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
};
const ICON_NAMES = ['spark', 'gradcap', 'code', 'globe', 'bot', 'note', 'chartbar', 'flow', 'translate', 'calc', 'map', 'trend', 'bell', 'cards', 'slides', 'link'];

function icoSvg(name) {
  const d = ICON_PATHS[name] || ICON_PATHS.spark;
  return `<svg class="ic" viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
function ico(name) { const s = document.createElement('span'); s.className = 'ico'; s.innerHTML = icoSvg(name); return s; }
/* "[[chartbar]] Wykres" -> węzły: ikona + tekst */
function richNodes(str) {
  const out = []; String(str).split(/(\[\[\w+\]\])/).forEach((p) => {
    const m = p.match(/^\[\[(\w+)\]\]$/);
    if (m) out.push(ico(m[1])); else if (p) out.push(document.createTextNode(p));
  }); return out;
}
function rich(el, str) { el.textContent = ''; richNodes(str).forEach((n) => el.append(n)); return el; }
function hydrateIcons(root = document) { root.querySelectorAll('i[data-ic]').forEach((i) => { i.className = 'ico'; i.innerHTML = icoSvg(i.dataset.ic); i.removeAttribute('data-ic'); }); }
