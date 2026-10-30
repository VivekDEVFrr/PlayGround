/* =========================================================
   Evergreen SMP — page behaviour
   Welcome-card renderer · whitelist wizard · small delights
   ========================================================= */
import { initHeroScene } from './scene.js';

document.documentElement.classList.add('js');

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

const CONFIG = {
  name: 'Evergreen',
  ip: 'play.evergreensmp.net',
  discord: 'discord.gg/evergreen',
  season: 'III',
  members: 1284,
  slots: 120,
};

/* ───────────────────────── toasts ───────────────────────── */
const toastStack = $('#toasts');
function toast(message, icon = 'i-check') {
  if (!toastStack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${icon}"/></svg><span></span>`;
  el.querySelector('span').textContent = message;
  toastStack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

/* ───────────────────────── header ───────────────────────── */
const menuBtn = $('#menuBtn');
const mobileNav = $('#mobileNav');
function setMenu(open) {
  if (!menuBtn || !mobileNav) return;
  menuBtn.setAttribute('aria-expanded', String(open));
  mobileNav.hidden = !open;
  mobileNav.classList.toggle('is-open', open);
  menuBtn.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${open ? 'i-close' : 'i-menu'}"/></svg>`;
}
menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
$$('#mobileNav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('click', (e) => {
  if (!mobileNav || mobileNav.hidden) return;
  if (!e.target.closest('#mobileNav') && !e.target.closest('#menuBtn')) setMenu(false);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenu(false);
});

/* ───────────────────────── copy handlers ───────────────────────── */
$$('.copy-ip').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const ok = await copyText(btn.dataset.copy || CONFIG.ip);
    toast(ok ? `${btn.dataset.copyLabel || 'Server IP'} copied — paste it in Minecraft` : 'Copy failed — select the address manually', 'i-copy');
  });
});

/* ───────────────────────── reveal + counters ───────────────────────── */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    revealIO.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px' });
$$('.reveal').forEach((el) => revealIO.observe(el));

function formatNumber(n) {
  return n.toLocaleString('en-US');
}
const counterIO = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = Number(el.dataset.count);
    counterIO.unobserve(el);
    if (prefersReduced || !Number.isFinite(target)) {
      el.textContent = formatNumber(target);
      return;
    }
    const start = performance.now();
    const dur = 1400;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatNumber(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, { threshold: 0.5 });
$$('[data-count]').forEach((el) => counterIO.observe(el));

/* ───────────────────────── event countdown ───────────────────────── */
function nextEvent() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 19, 0, 0));
  const day = d.getUTCDay();
  let add = (6 - day + 7) % 7; // next Saturday
  if (add === 0 && now.getTime() >= d.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}
function updateCountdown() {
  const el = $('#countdown');
  if (!el) return;
  const diff = nextEvent().getTime() - Date.now();
  if (diff <= 0) { el.textContent = 'live now'; return; }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  el.textContent = days > 0 ? `in ${days}d ${String(hours).padStart(2, '0')}h` : `in ${hours}h ${String(mins).padStart(2, '0')}m`;
}
updateCountdown();
setInterval(updateCountdown, 60000);

/* ───────────────────────── procedural pixel avatars ───────────────────────── */
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SKINS = ['#f0c69c', '#e2ad80', '#c9885f', '#a2673f', '#7a4a2d', '#5c3720'];
const HAIRS = ['#241c16', '#4a3120', '#7b4d25', '#d8c07a', '#1c1c26', '#8c3f2c', '#b6b0a4'];
const SHIRTS = ['#3fbf85', '#4a7bd8', '#d8674f', '#8a5fd6', '#e0b04f', '#3aa7a7'];

function variant(name) {
  const rnd = mulberry32(seedFrom(name || 'Steve'));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    shirt: pick(SHIRTS),
    fringe: rnd() > 0.4 ? 3 : 2,
    mouth: rnd() > 0.5 ? 2 : 1,
  };
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
function drawFace(ctx, name, x, y, size) {
  const v = variant(name);
  const cell = size / 8;
  const grid = [];
  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      const mx = Math.min(px, 7 - px);
      let color = v.skin;
      if (py === 0) color = v.hair;
      else if (py === 1 && mx < v.fringe) color = v.hair;
      else if (py === 2 && mx === 0) color = v.hair;
      else if (py === 1 && mx >= v.fringe) color = v.skin;
      else if (py === 4 && (px === 2 || px === 5)) color = '#20303a';
      else if (py === 5 && (px === 3 || px === 4)) color = shade(v.skin, -28);
      else if (py === 6 && px >= 3 && px <= 4 - (v.mouth === 1 ? 1 : 0)) color = shade(v.skin, -60);
      else if (px === 0 && py >= 3 && py <= 5) color = shade(v.skin, -18);
      else if (px === 7 && py >= 3 && py <= 5) color = shade(v.skin, -24);
      else if (py === 7) color = v.shirt;
      grid.push(color);
    }
  }
  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      ctx.fillStyle = grid[py * 8 + px];
      ctx.fillRect(x + px * cell, y + py * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function paintSmallAvatars() {
  $$('canvas[data-avatar]').forEach((cv) => {
    const ctx = cv.getContext('2d');
    const size = cv.width;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    drawFace(ctx, cv.dataset.avatar, 0, 0, size);
    // soft top light
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(0,0,0,.08)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}
paintSmallAvatars();

/* ───────────────────────── logo handling ───────────────────────── */
const DEFAULT_LOGO = 'assets/img/logo.svg';
const logoImages = new Set();
let logoImg = new Image();
let logoReady = false;
logoImg.decoding = 'sync';

function applyLogoToPage(src) {
  ['#brandLogo', '#footerLogo', '#dcAvatar', '#dcAuthorIcon'].forEach((sel) => {
    const el = $(sel);
    if (el) el.src = src;
  });
}

function loadLogo(src) {
  logoImg = new Image();
  logoImg.onload = () => {
    logoReady = true;
    drawCard();
    updateEmbed();
  };
  logoImg.onerror = () => {
    logoReady = false;
    drawCard();
  };
  logoImg.src = src;
  logoImages.add(logoImg);
}

const savedLogo = store.get('evergreen.logo', null);
loadLogo(typeof savedLogo === 'string' && savedLogo.startsWith('data:') ? savedLogo : DEFAULT_LOGO);
if (typeof savedLogo === 'string' && savedLogo.startsWith('data:')) {
  applyLogoToPage(savedLogo);
  const state = $('#logoState');
  if (state) state.textContent = 'Custom logo';
  const reset = $('#logoReset');
  if (reset) reset.hidden = false;
}

$('#logoUpload')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2.5 * 1024 * 1024) { toast('Logo is over 2.5 MB — try a smaller file', 'i-upload'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result);
    store.set('evergreen.logo', src);
    loadLogo(src);
    applyLogoToPage(src);
    const state = $('#logoState');
    if (state) state.textContent = file.name.length > 24 ? `${file.name.slice(0, 21)}…` : file.name;
    const reset = $('#logoReset');
    if (reset) reset.hidden = false;
    toast('Logo updated everywhere on this page', 'i-upload');
  };
  reader.readAsDataURL(file);
});

$('#logoReset')?.addEventListener('click', () => {
  store.remove('evergreen.logo');
  loadLogo(DEFAULT_LOGO);
  applyLogoToPage(DEFAULT_LOGO);
  const state = $('#logoState');
  if (state) state.textContent = 'Evergreen crest';
  const reset = $('#logoReset');
  if (reset) reset.hidden = true;
  const input = $('#logoUpload');
  if (input) input.value = '';
  toast('Back to the Evergreen crest', 'i-refresh');
});

/* ───────────────────────── welcome card ───────────────────────── */
const CARD_W = 1600;
const CARD_H = 900;
const card = $('#welcomeCard');
const cctx = card?.getContext('2d');

const PALETTES = {
  emerald: { a: '#0c3527', b: '#04120d', accent: '#63e6a4', accent2: '#c4f57e', ink: '#f0fff7', muted: '#a9c9b9', glow: '#2fbf85' },
  sunset: { a: '#30141f', b: '#150810', accent: '#ffb86b', accent2: '#ffd9a8', ink: '#fff6ec', muted: '#d8b7a8', glow: '#ff7a59' },
  nether: { a: '#2c0d0d', b: '#120505', accent: '#ff8d6b', accent2: '#ffd06b', ink: '#fff0ea', muted: '#d6a89e', glow: '#f04f3f' },
  aurora: { a: '#0b2033', b: '#040b15', accent: '#8bd7ff', accent2: '#c9b3ff', ink: '#eefaff', muted: '#a6c4d6', glow: '#5aa9ff' },
};

let palette = 'emerald';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitFont(ctx, text, maxWidth, start, min, weight = 800, family = 'Outfit') {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${family}, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > min);
  return size;
}

function star(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * .16, y - r * .16, x + r, y);
  ctx.quadraticCurveTo(x + r * .16, y + r * .16, x, y + r);
  ctx.quadraticCurveTo(x - r * .16, y + r * .16, x - r, y);
  ctx.quadraticCurveTo(x - r * .16, y - r * .16, x, y - r);
  ctx.fill();
  ctx.restore();
}

function drawCard() {
  if (!cctx) return;
  const ctx = cctx;
  const p = PALETTES[palette] || PALETTES.emerald;
  const name = ($('#mcName')?.value || 'Steve').trim().slice(0, 16) || 'Steve';
  const member = Math.max(1, Math.min(99999, Number($('#memberNo')?.value) || 1));

  ctx.save();
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 46);
  ctx.clip();

  // base gradient
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, p.a);
  bg.addColorStop(.55, p.a);
  bg.addColorStop(1, p.b);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // glows
  let glow = ctx.createRadialGradient(1340, 80, 0, 1340, 80, 780);
  glow.addColorStop(0, `${p.glow}55`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  glow = ctx.createRadialGradient(140, 880, 0, 140, 880, 620);
  glow.addColorStop(0, `${p.accent}30`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // dot grid
  ctx.fillStyle = 'rgba(255,255,255,.055)';
  for (let x = 30; x < CARD_W; x += 30) {
    for (let y = 30; y < CARD_H; y += 30) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // giant isometric cube watermark
  ctx.save();
  ctx.translate(1330, 250);
  ctx.rotate(-.08);
  const R = 250;
  const pts = [
    [0, -R], [R * .866, -R * .5], [R * .866, R * .5],
    [0, R], [-R * .866, R * .5], [-R * .866, -R * .5],
  ];
  const line = ctx.createLinearGradient(-R, -R, R, R);
  line.addColorStop(0, `${p.accent}55`);
  line.addColorStop(1, `${p.accent}00`);
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -R);
  ctx.lineTo(0, R);
  ctx.moveTo(0, 0);
  ctx.lineTo(-R * .866, -R * .5);
  ctx.moveTo(0, 0);
  ctx.lineTo(R * .866, -R * .5);
  ctx.stroke();
  ctx.restore();

  // corner ticks
  ctx.strokeStyle = `${p.accent}66`;
  ctx.lineWidth = 2.5;
  [[46, 46, 1, 1], [CARD_W - 46, 46, -1, 1], [46, CARD_H - 46, 1, -1], [CARD_W - 46, CARD_H - 46, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + 22 * sy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 22 * sx, y);
    ctx.stroke();
  });

  // inner border
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 2;
  roundRect(ctx, 1.5, 1.5, CARD_W - 3, CARD_H - 3, 45);
  ctx.stroke();

  // logo
  const lx = 72, ly = 64, ls = 86;
  ctx.save();
  roundRect(ctx, lx, ly, ls, ls, 24);
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.fill();
  ctx.clip();
  if (logoReady && logoImg.complete && logoImg.naturalWidth) {
    const pad = 6;
    ctx.drawImage(logoImg, lx + pad, ly + pad, ls - pad * 2, ls - pad * 2);
  } else {
    ctx.fillStyle = p.accent;
    ctx.font = '800 46px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', lx + ls / 2, ly + ls / 2 + 2);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  ctx.lineWidth = 2;
  roundRect(ctx, lx, ly, ls, ls, 24);
  ctx.stroke();

  // wordmark
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = p.ink;
  ctx.font = '600 27px Outfit, sans-serif';
  ctx.letterSpacing = '7px';
  ctx.fillText(CONFIG.name.toUpperCase(), lx + ls + 24, ly + 36);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = p.accent;
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.letterSpacing = '8px';
  ctx.fillText('S M P', lx + ls + 26, ly + 66);
  ctx.letterSpacing = '0px';

  // top-right season / member pill
  const pillText = `SEASON ${CONFIG.season}   ·   MEMBER #${member.toLocaleString('en-US')}`;
  ctx.font = '500 18px "JetBrains Mono", monospace';
  const tw = ctx.measureText(pillText).width;
  const pillW = tw + 56;
  const pillH = 52;
  const pillX = CARD_W - 72 - pillW;
  const pillY = 72;
  roundRect(ctx, pillX, pillY, pillW, pillH, 26);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = p.muted;
  ctx.textAlign = 'right';
  ctx.fillText(pillText, CARD_W - 72 - 28, pillY + 34);
  ctx.textAlign = 'left';

  // kicker
  ctx.fillStyle = p.accent;
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.letterSpacing = '7px';
  ctx.fillText('WELCOME TO THE SMP', 72, 356);
  ctx.letterSpacing = '0px';

  // name
  const nameSize = fitFont(ctx, name, 1060, 108, 54, 800);
  ctx.font = `800 ${nameSize}px Outfit, sans-serif`;
  const nameGrad = ctx.createLinearGradient(72, 380, 72, 490);
  nameGrad.addColorStop(0, p.ink);
  nameGrad.addColorStop(1, p.accent2);
  ctx.fillStyle = nameGrad;
  ctx.fillText(name, 72, 468, 1080);

  // subtitle
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.font = '400 27px Outfit, sans-serif';
  ctx.fillText("You're in. Grab a plot near spawn,", 74, 536);
  ctx.fillText('say hi in #introductions — and build something.', 74, 578);

  // member line
  ctx.fillStyle = p.muted;
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText(`MEMBER #${member.toLocaleString('en-US')}  ·  SEASON ${CONFIG.season}  ·  JAVA + BEDROCK`, 74, 652);

  // sparkles
  star(ctx, 1050, 168, 11, `${p.accent}cc`);
  star(ctx, 1126, 232, 6, 'rgba(255,255,255,.5)');
  star(ctx, 990, 82, 5, `${p.accent2}88`);

  // divider
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(72, 748);
  ctx.lineTo(CARD_W - 72, 748);
  ctx.stroke();

  // footer
  ctx.fillStyle = p.muted;
  ctx.font = '500 19px "JetBrains Mono", monospace';
  ctx.fillText(CONFIG.discord, 72, 802);
  ctx.textAlign = 'right';
  ctx.fillStyle = p.accent;
  ctx.fillText(CONFIG.ip, CARD_W - 72, 802);
  ctx.textAlign = 'left';

  // avatar
  const ax = 1290, ay = 452, as = 224;
  ctx.save();
  ctx.shadowColor = `${p.glow}88`;
  ctx.shadowBlur = 46;
  roundRect(ctx, ax, ay, as, as, 40);
  ctx.fillStyle = 'rgba(3,10,8,.55)';
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, ax + 8, ay + 8, as - 16, as - 16, 32);
  ctx.clip();
  drawFace(ctx, name, ax + 8, ay + 8, as - 16);
  const shade2 = ctx.createLinearGradient(0, ay, 0, ay + as);
  shade2.addColorStop(0, 'rgba(255,255,255,.12)');
  shade2.addColorStop(1, 'rgba(0,0,0,.18)');
  ctx.fillStyle = shade2;
  ctx.fillRect(ax, ay, as, as);
  ctx.restore();
  roundRect(ctx, ax, ay, as, as, 40);
  ctx.strokeStyle = `${p.accent}80`;
  ctx.lineWidth = 3;
  ctx.stroke();

  // corners fade for a printed look
  const vig = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, CARD_H * .25, CARD_W / 2, CARD_H / 2, CARD_W * .72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.restore();
  card.setAttribute('aria-label', `Welcome card for ${name}, member ${member}, ${palette} palette`);
}

let embedTimer = 0;
function updateEmbed() {
  const img = $('#embedCard');
  if (!img || !card) return;
  clearTimeout(embedTimer);
  embedTimer = setTimeout(() => {
    try {
      const url = card.toDataURL('image/png');
      img.src = url;
      img.alt = `Welcome card for ${($('#mcName')?.value || 'a new member').trim()}`;
    } catch { /* ignore */ }
  }, 260);
}

let cardRaf = 0;
function scheduleCard() {
  if (cardRaf) return;
  cardRaf = requestAnimationFrame(() => {
    cardRaf = 0;
    drawCard();
    const name = ($('#mcName')?.value || 'Steve').trim() || 'Steve';
    const member = Number($('#memberNo')?.value) || 1;
    const dn = $('#dcName');
    const dm = $('#dcMember');
    if (dn) dn.textContent = name;
    if (dm) dm.textContent = `#${member.toLocaleString('en-US')}`;
    updateEmbed();
  });
}

$('#mcName')?.addEventListener('input', scheduleCard);
$('#memberNo')?.addEventListener('input', scheduleCard);
$('#cardForm')?.addEventListener('submit', (e) => e.preventDefault());

$$('#palette .swatch').forEach((sw) => {
  sw.addEventListener('click', () => {
    $$('#palette .swatch').forEach((s) => {
      s.classList.toggle('is-active', s === sw);
      s.setAttribute('aria-checked', String(s === sw));
    });
    palette = sw.dataset.palette || 'emerald';
    scheduleCard();
  });
  sw.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sw.click(); }
  });
});

$('#shuffleCard')?.addEventListener('click', () => {
  const keys = Object.keys(PALETTES);
  const next = keys[(keys.indexOf(palette) + 1 + Math.floor(Math.random() * 2)) % keys.length];
  const btn = $(`#palette .swatch[data-palette="${next}"]`);
  btn?.click();
  const names = ['MayaBuilds', 'KaiRedstone', 'Rowan', 'NovaByte', 'Mossy', 'IrisPlays', 'CraftyAarav'];
  const el = $('#mcName');
  if (el) el.value = names[Math.floor(Math.random() * names.length)];
  const no = $('#memberNo');
  if (no) no.value = String(1000 + Math.floor(Math.random() * 9000));
  scheduleCard();
  toast('Fresh card, fresh palette', 'i-refresh');
});

$('#downloadCard')?.addEventListener('click', () => {
  const name = ($('#mcName')?.value || 'Steve').trim().replace(/[^\w-]+/g, '-') || 'Steve';
  card.toBlob((blob) => {
    if (!blob) { toast('Could not export the card', 'i-download'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evergreen-welcome-${name}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Welcome card downloaded', 'i-download');
  }, 'image/png');
});

$('#copyCaption')?.addEventListener('click', async () => {
  const name = ($('#mcName')?.value || 'Steve').trim() || 'Steve';
  const member = Number($('#memberNo')?.value) || 1;
  const caption = [
    `Welcome to ${CONFIG.name} SMP, ${name}!`,
    `You're member #${member.toLocaleString('en-US')} — a whitelisted survival server that actually feels like a neighbourhood.`,
    '',
    `• Java 1.21.4 + Bedrock · ${CONFIG.ip}`,
    `• Rules + setup · ${CONFIG.discord}`,
    '',
    '#Minecraft #SMP #Welcome',
  ].join('\n');
  const ok = await copyText(caption);
  toast(ok ? 'Caption copied — paste it with the card' : 'Copy failed — try again', 'i-copy');
});

// first paint once fonts are ready
if (document.fonts?.ready) {
  document.fonts.ready.then(() => { drawCard(); updateEmbed(); });
  Promise.all([
    document.fonts.load('800 108px Outfit'),
    document.fonts.load('500 19px "JetBrains Mono"'),
  ]).then(() => { drawCard(); updateEmbed(); }).catch(() => {});
} else {
  drawCard();
  updateEmbed();
}

/* ───────────────────────── whitelist wizard ───────────────────────── */
const form = $('#applyForm');
const steps = $$('.form-step');
const stepDots = $$('.step[data-step-dot]');
const nextBtn = $('#nextBtn');
const backBtn = $('#backBtn');
const submitBtn = $('#submitBtn');
const summary = $('#applySummary');
let step = 1;

const roleBtns = $$('#roles .chip-toggle');
roleBtns.forEach((b) => b.addEventListener('click', () => {
  b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  updateSummary();
}));

const aboutField = $('#apAbout');
const aboutCount = $('#aboutCount');
aboutField?.addEventListener('input', () => {
  if (aboutCount) aboutCount.textContent = `${aboutField.value.length} / 600`;
  updateSummary();
});

function roles() {
  return roleBtns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent.trim());
}

function fieldValue(name) {
  const el = form?.elements.namedItem(name);
  return el ? String(el.value || '').trim() : '';
}

function showError(key, show) {
  const err = $(`[data-err="${key}"]`);
  if (err) err.hidden = !show;
  const field = form?.elements.namedItem(key);
  if (field && field.classList) field.classList.toggle('invalid', show);
}
function clearErrors() {
  $$('.err').forEach((e) => { e.hidden = true; });
  $$('.invalid').forEach((e) => e.classList.remove('invalid'));
}

function validateStep(n, silent = false) {
  let ok = true;
  const fail = (key) => { ok = false; if (!silent) showError(key, true); };
  if (n === 1) {
    if (!/^[A-Za-z0-9_]{3,16}$/.test(fieldValue('mc'))) fail('mc'); else showError('mc', false);
    if (fieldValue('discord').length < 2) fail('discord'); else showError('discord', false);
    const age = Number(fieldValue('age'));
    if (!Number.isInteger(age) || age < 13 || age > 99) fail('age'); else showError('age', false);
    if (!fieldValue('tz')) fail('tz'); else showError('tz', false);
  }
  if (n === 2) {
    if (!fieldValue('hours')) fail('hours'); else showError('hours', false);
    if (!fieldValue('source')) fail('source'); else showError('source', false);
    if (roles().length === 0) fail('roles'); else showError('roles', false);
    if (fieldValue('about').length < 40) fail('about'); else showError('about', false);
  }
  if (n === 3) {
    if (!$('#apAgree')?.checked) fail('agree'); else showError('agree', false);
  }
  return ok;
}

function setStep(n) {
  step = Math.max(1, Math.min(3, n));
  steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== step; });
  stepDots.forEach((d) => {
    const num = Number(d.dataset.stepDot);
    d.classList.toggle('is-active', num === step);
    d.classList.toggle('is-done', num < step);
  });
  if (backBtn) backBtn.hidden = step === 1;
  if (nextBtn) nextBtn.hidden = step === 3;
  if (submitBtn) submitBtn.hidden = step !== 3;
  if (step === 3) updateSummary();
  clearErrors();
  const card2 = $('.apply-card');
  if (card2 && step > 1) {
    const top = card2.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo({ top, behavior: prefersReduced ? 'auto' : 'smooth' });
  }
}

nextBtn?.addEventListener('click', () => {
  if (!validateStep(step)) {
    const first = $('.err:not([hidden])');
    first?.scrollIntoView({ block: 'center', behavior: prefersReduced ? 'auto' : 'smooth' });
    return;
  }
  setStep(step + 1);
});
backBtn?.addEventListener('click', () => setStep(step - 1));

form?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && step < 3) {
    e.preventDefault();
    nextBtn?.click();
  }
});

function updateSummary() {
  if (!summary) return;
  const parts = [];
  const mc = fieldValue('mc');
  const tz = fieldValue('tz');
  const hrs = fieldValue('hours');
  if (mc) parts.push(`<b>${escapeHtml(mc)}</b>`);
  if (tz) parts.push(escapeHtml(tz.split(' · ')[0]));
  if (hrs) parts.push(`${escapeHtml(hrs)} h/week`);
  const r = roles();
  if (r.length) parts.push(r.join(', '));
  summary.innerHTML = parts.length
    ? `Application preview · ${parts.join(' · ')}`
    : 'Your application summary will appear here.';
  summary.classList.toggle('is-visible', parts.length > 0);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildApplication() {
  const mc = fieldValue('mc');
  const id = `EG-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  const now = new Date();
  const when = now.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const line = '────────────────────────────';
  const text = [
    `WHITELIST APPLICATION — ${id}`,
    line,
    `Minecraft   : ${mc}`,
    `Discord     : ${fieldValue('discord')}`,
    `Age         : ${fieldValue('age')}`,
    `Timezone    : ${fieldValue('tz')}`,
    `Hours/week  : ${fieldValue('hours')}`,
    `Roles       : ${roles().join(', ')}`,
    `Found us    : ${fieldValue('source')}`,
    `Submitted   : ${when}`,
    '',
    'About',
    fieldValue('about'),
    '',
    'Rules accepted: yes',
    line,
    `Ticket ${id} · ${CONFIG.name} SMP · ${CONFIG.ip}`,
  ].join('\n');
  return { id, text, mc };
}

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  clearErrors();
  const ok = validateStep(1, true) && validateStep(2, true) && validateStep(3);
  if (!ok) {
    for (let n = 1; n <= 3; n++) {
      if (!validateStep(n, true)) { setStep(n); validateStep(n); break; }
    }
    return;
  }
  const app = buildApplication();
  const output = $('#appOutput');
  if (output) output.value = app.text;
  const successName = $('#successName');
  if (successName) successName.textContent = app.mc;
  const ticket = $('#ticketId');
  if (ticket) ticket.textContent = app.id;

  const saved = store.get('evergreen.applications', []);
  saved.unshift({ id: app.id, mc: app.mc, at: Date.now() });
  store.set('evergreen.applications', saved.slice(0, 20));
  store.remove('evergreen.draft');

  form.hidden = true;
  const success = $('#applySuccess');
  if (success) {
    success.hidden = false;
    success.scrollIntoView({ block: 'center', behavior: prefersReduced ? 'auto' : 'smooth' });
  }
  toast('Application ready — copy it into Discord', 'i-check');
});

$('#copyApp')?.addEventListener('click', async () => {
  const text = $('#appOutput')?.value || '';
  const ok = await copyText(text);
  toast(ok ? 'Application copied' : 'Copy failed — select the text manually', 'i-copy');
});

$('#downloadApp')?.addEventListener('click', () => {
  const text = $('#appOutput')?.value || '';
  const name = fieldValue('mc') || 'application';
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evergreen-whitelist-${name}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Application downloaded', 'i-download');
});

$('#resetApply')?.addEventListener('click', () => {
  form?.reset();
  $$('#roles .chip-toggle').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  if (aboutCount) aboutCount.textContent = '0 / 600';
  const success = $('#applySuccess');
  if (success) success.hidden = true;
  if (form) form.hidden = false;
  setStep(1);
  store.remove('evergreen.draft');
  toast('Cleared — start fresh', 'i-refresh');
});

// autosave draft
let draftTimer = 0;
form?.addEventListener('input', () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    store.set('evergreen.draft', {
      mc: fieldValue('mc'), discord: fieldValue('discord'), age: fieldValue('age'), tz: fieldValue('tz'),
      hours: fieldValue('hours'), source: fieldValue('source'), about: fieldValue('about'),
      roles: roles(), agree: !!$('#apAgree')?.checked, step,
    });
  }, 400);
});

function restoreDraft() {
  const draft = store.get('evergreen.draft', null);
  if (!draft || typeof draft !== 'object') return;
  const set = (name, value) => {
    const el = form?.elements.namedItem(name);
    if (el && value != null) el.value = value;
  };
  set('mc', draft.mc); set('discord', draft.discord); set('age', draft.age); set('tz', draft.tz);
  set('hours', draft.hours); set('source', draft.source); set('about', draft.about);
  if (draft.agree) { const cb = $('#apAgree'); if (cb) cb.checked = true; }
  (draft.roles || []).forEach((label) => {
    const b = roleBtns.find((btn) => btn.textContent.trim() === label);
    if (b) b.setAttribute('aria-pressed', 'true');
  });
  if (aboutCount) aboutCount.textContent = `${fieldValue('about').length} / 600`;
  if (Number(draft.step) > 1) setStep(Number(draft.step));
  updateSummary();
}
restoreDraft();
if (form && !$('#applySuccess')?.hidden) setStep(1);

/* ───────────────────────── bot feature cards ───────────────────────── */
$$('.feature').forEach((cardEl) => {
  cardEl.addEventListener('click', async () => {
    const cmd = cardEl.dataset.command || '';
    const ok = await copyText(cmd);
    toast(ok ? `${cmd} copied` : 'Copy failed — select the command', 'i-copy');
  });
});

/* ───────────────────────── 3D hero ───────────────────────── */
const sceneCanvas = $('#scene');
if (sceneCanvas) {
  try {
    const hero = initHeroScene(sceneCanvas);
    const tiltBtn = $('#tiltBtn');
    const canTilt = 'DeviceOrientationEvent' in window && matchMedia('(max-width: 900px)').matches && (navigator.maxTouchPoints > 0 || typeof window.DeviceOrientationEvent.requestPermission === 'function');
    if (tiltBtn && canTilt) {
      tiltBtn.hidden = false;
      tiltBtn.addEventListener('click', async () => {
        const wasOn = tiltBtn.classList.contains('is-on');
        const on = await hero.toggleTilt();
        if (!on && !wasOn) {
          toast('Motion access denied — drag to orbit instead', 'i-tilt');
          return;
        }
        tiltBtn.querySelector('span').textContent = on ? 'Tilt on' : 'Enable tilt';
        tiltBtn.classList.toggle('is-on', !!on);
      });
    }
  } catch (err) {
    console.warn('3D scene unavailable:', err);
    sceneCanvas.style.display = 'none';
  }
}
