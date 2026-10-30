/* Deterministic pixel avatars, shared by the dashboard and the landing page. */

const SKINS = ['#f0c69c', '#e2ad80', '#c9885f', '#a2673f', '#7a4a2d', '#5c3720'];
const HAIRS = ['#241c16', '#4a3120', '#7b4d25', '#d8c07a', '#1c1c26', '#8c3f2c', '#b6b0a4'];
const SHIRTS = ['#3fbf85', '#4a7bd8', '#d8674f', '#8a5fd6', '#e0b04f', '#3aa7a7'];

export function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
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

export function variant(name) {
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

export function drawFace(ctx, name, x, y, size) {
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

export function paintAvatar(canvas, name, size = 32) {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawFace(ctx, name, 0, 0, canvas.width);
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, 'rgba(255,255,255,.12)');
  g.addColorStop(1, 'rgba(0,0,0,.14)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
