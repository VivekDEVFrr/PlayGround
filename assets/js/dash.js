/* =========================================================
   Supernova SMP — dashboard client
   Talks to /api when the Node backend is running, otherwise
   renders clearly-labelled sample data.
   ========================================================= */
import { paintAvatar } from './avatar.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const FALLBACK = window.SUPERNOVA_CONFIG || {};
const ROSTER = [
  'MayaBuilds', 'KaiRedstone', 'Rowan_Ash', 'NovaByte', 'Mossy', 'IrisPlays',
  'CraftyAarav', 'Lin', 'Oakley', 'PixelPine', 'Skye', 'Tarzan', 'Ember',
  'Quartz', 'Willow', 'Atlas', 'Juniper', 'Flint', 'Sable', 'Onyx',
  'Clover', 'Ridge', 'Vale',
];

const state = {
  config: JSON.parse(JSON.stringify(FALLBACK)),
  mode: 'demo',
  status: null,
  history: [],
  pollMs: Math.max(10, Number(FALLBACK.pollSeconds) || 30) * 1000,
  timer: null,
  lastChecked: 0,
  adminToken: sessionStorage.getItem('supernova.admin') || '',
  pteroReady: false,
  route: 'overview',
};

const TITLES = {
  overview: 'Overview',
  players: 'Players',
  server: 'Server status',
  whitelist: 'Whitelist',
  support: 'Support',
  admin: 'Admin',
};

/* ───────────────────────── helpers ───────────────────────── */
function toast(message, kind = 'ok') {
  const stack = $('#toasts');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'error' ? ' is-error' : '');
  el.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${kind === 'error' ? 'i-info' : 'i-check'}"/></svg><span></span>`;
  el.querySelector('span').textContent = message;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 300);
  }, 2800);
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

function ago(ts) {
  if (!ts) return 'just now';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' UTC';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const apiBase = () => (state.config.apiBase || '').replace(/\/$/, '');

async function api(path, options = {}, timeout = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/* ───────────────────────── config ───────────────────────── */
function applyConfig() {
  const cfg = state.config;
  const brand = cfg.brand || {};
  const mc = cfg.mc || {};
  const links = cfg.links || {};

  const short = (brand.short || 'Supernova').toUpperCase();
  $('#brandName').textContent = short;
  $('#crumbBrand').textContent = brand.name || 'Supernova SMP';
  const dn = $('#dataModeText');
  if (dn && state.mode === 'demo') dn.textContent = 'Demo data';

  const host = mc.host || 'tarzan.supernovaa.in';
  const port = mc.port || 25509;
  const bed = mc.bedrockPort || 19132;
  const ip = `${host}:${port}`;

  setText('heroHost', host);
  setText('heroPort', `:${port}`);
  setText('heroIp', ip);
  setText('infoIp', host);
  setText('infoPort', String(port));
  setText('javaAddress', ip);
  setText('bedrockPort', String(bed));
  setText('srvAddress', host);
  setText('srvPort', String(port));
  setText('connectVersion', mc.version || '1.21.4');
  setText('statVersion', mc.version || '1.21.4');
  setText('infoVersion', mc.version || '1.21.4');

  const map = { discord: links.discord, whitelist: links.whitelist, rules: links.rules, map: links.map };
  $$('[data-link]').forEach((el) => {
    const url = map[el.dataset.link];
    if (!url) return;
    if (url.startsWith('#')) { el.setAttribute('href', url); el.removeAttribute('target'); el.removeAttribute('rel'); }
    else el.setAttribute('href', url);
  });

  // logo: a real logo.png dropped into assets/img wins over the built-in crest
  const custom = 'assets/img/logo.png';
  const probe = new Image();
  probe.onload = () => setLogo(custom);
  probe.onerror = () => setLogo(brand.logo || 'assets/img/nova.svg');
  probe.src = custom;

  if (state.mode === 'live') $('#demoNote')?.setAttribute('hidden', '');
}

function setLogo(src) {
  const img = $('#brandLogo');
  if (img && src) img.src = src;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.textContent = value;
}

/* ───────────────────────── routing ───────────────────────── */
function route() {
  const raw = (location.hash || '#/overview').replace(/^#\/?/, '').split('?')[0];
  const name = TITLES[raw] ? raw : 'overview';
  state.route = name;

  $$('.page').forEach((p) => {
    const active = p.dataset.page === name;
    p.hidden = !active;
    p.classList.toggle('is-active', active);
  });
  $$('[data-route]').forEach((a) => {
    const active = a.dataset.route === name;
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  setText('pageTitle', TITLES[name]);
  setText('crumbRoute', name);
  document.title = `${TITLES[name]} · ${state.config.brand?.name || 'Supernova SMP'}`;
  closeDrawer();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  if (name === 'server') requestAnimationFrame(drawChart);
  if (name === 'admin' && state.adminToken) verifyAdmin(true);
}

/* ───────────────────────── drawer ───────────────────────── */
const sidebar = $('#sidebar');
const scrim = $('#scrim');
const menuBtn = $('#menuBtn');

function openDrawer() {
  sidebar?.classList.add('is-open');
  if (scrim) scrim.hidden = false;
  menuBtn?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('no-scroll');
}
function closeDrawer() {
  sidebar?.classList.remove('is-open');
  if (scrim) scrim.hidden = true;
  menuBtn?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('no-scroll');
}
menuBtn?.addEventListener('click', () => (sidebar?.classList.contains('is-open') ? closeDrawer() : openDrawer()));
scrim?.addEventListener('click', closeDrawer);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
$$('.nav-item').forEach((a) => a.addEventListener('click', closeDrawer));

/* ───────────────────────── demo data ───────────────────────── */
function demoStatus() {
  const cfg = state.config.mc || {};
  return {
    online: true,
    host: cfg.host || 'tarzan.supernovaa.in',
    port: cfg.port || 25509,
    players: { online: 23, max: 100, list: ROSTER.slice() },
    version: cfg.version || '1.21.4',
    protocol: 769,
    motd: 'A cozy survival SMP — Season III',
    latencyMs: 42,
    uptime: '99.9%',
    peak: 64,
    checkedAt: new Date().toISOString(),
    demo: true,
  };
}

function demoHistory() {
  const base = [8, 7, 6, 6, 9, 12, 10, 11, 14, 13, 16, 15, 18, 17, 19, 16, 14, 17, 20, 21, 19, 22, 21, 23];
  return base.map((count, i) => ({ t: Date.now() - (23 - i) * 3600000, count }));
}

/* ───────────────────────── render status ───────────────────────── */
function setMode(mode) {
  state.mode = mode;
  const chip = $('#dataMode');
  const text = $('#dataModeText');
  if (chip) {
    chip.classList.toggle('chip-live', mode === 'live');
    chip.classList.toggle('chip-demo', mode !== 'live');
    chip.title = mode === 'live'
      ? 'Connected to the dashboard API'
      : 'Sample data until the API backend is connected';
  }
  if (text) text.textContent = mode === 'live' ? 'Live' : 'Demo data';
  const apiState = $('#apiState');
  if (apiState) apiState.textContent = mode === 'live' ? 'live API' : 'demo mode';
  const note = $('#demoNote');
  if (note) note.hidden = mode === 'live';
}

function renderStatus(st) {
  if (!st) return;
  state.status = st;
  state.lastChecked = Date.now();

  const online = st.online !== false;
  const players = st.players || {};
  const count = Number(players.online) || 0;
  const max = Number(players.max) || 0;
  const list = Array.isArray(players.list) ? players.list : [];
  const pct = max > 0 ? Math.min(1, count / max) : 0;

  // chips
  const chip = $('#heroStatusChip');
  if (chip) {
    chip.classList.toggle('chip-live', online);
    chip.classList.toggle('chip-offline', !online);
    const t = $('#heroStatusText');
    if (t) t.textContent = online ? 'Online' : 'Offline';
  }
  const srvChip = $('#srvStatusChip');
  if (srvChip) {
    srvChip.classList.toggle('chip-live', online);
    srvChip.classList.toggle('chip-offline', !online);
    const t = $('#srvStatusText');
    if (t) t.textContent = online ? 'Online' : 'Offline';
  }
  const side = $('#sideStatus');
  if (side) side.classList.toggle('is-offline', !online);
  setText('sideStatusText', online ? 'Online' : 'Offline');
  setText('sidePlayers', `${count} / ${max} players`);

  // counts
  setText('heroCount', String(count));
  setText('heroMax', `/${max}`);
  setText('statPlayers', String(count));
  setText('statMax', `/${max}`);
  setText('navOnline', String(count));
  setText('allCount', String(count));
  setText('heroPeak', String(st.peak || Math.max(count, 0)));
  setText('chartPeak', `peak ${st.peak || count}`);

  // ring
  const ring = $('#ringFill');
  if (ring) {
    const C = 326.7;
    ring.style.strokeDashoffset = String(C * (1 - pct));
  }

  // connection details
  const host = st.host || state.config.mc?.host || 'tarzan.supernovaa.in';
  const port = st.port || state.config.mc?.port || 25509;
  const ip = `${host}:${port}`;
  setText('heroHost', host);
  setText('heroPort', `:${port}`);
  setText('heroIp', ip);
  setText('javaAddress', ip);
  setText('infoIp', host);
  setText('infoPort', String(port));
  setText('srvAddress', host);
  setText('srvPort', String(port));

  // version + performance
  setText('statVersion', st.version || '—');
  setText('tagVersion', st.version || '—');
  setText('infoVersion', st.version || '—');
  setText('srvVersion', st.version || '—');
  setText('connectVersion', st.version || state.config.mc?.version || '—');
  setText('srvProtocol', st.protocol ? String(st.protocol) : '—');
  const ping = st.latencyMs != null ? `${st.latencyMs} ms` : '—';
  setText('heroPing', ping);
  setText('statPing', st.latencyMs != null ? String(st.latencyMs) : '—');
  setText('srvPing', ping);
  setText('heroUptime', st.uptime || '—');
  setText('srvUptime', st.uptime || '—');
  setText('srvMotd', st.motd || (online ? 'A quiet day on the SMP.' : 'Server is offline.'));
  setText('heroChecked', online ? 'checked just now' : 'last checked just now');
  setText('srvChecked', `checked just now`);
  setText('playersUpdated', 'updated just now');

  // status message config
  const sc = st.statusChannel;
  if (sc) setText('statusChannel', sc);

  renderPlayerGrids(list, count);
  if (state.route === 'server') drawChart();
}

function playerChip(name, online = true) {
  const el = document.createElement('div');
  el.className = 'player-chip' + (online ? '' : ' is-offline');
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  el.appendChild(cv);
  const meta = document.createElement('div');
  meta.style.minWidth = '0';
  const n = document.createElement('span');
  n.className = 'pc-name';
  n.textContent = name;
  const m = document.createElement('span');
  m.className = 'pc-meta';
  m.textContent = online ? 'survival' : 'offline';
  meta.append(n, m);
  el.appendChild(meta);
  const dot = document.createElement('span');
  dot.className = 'pc-dot';
  dot.setAttribute('aria-hidden', 'true');
  el.appendChild(dot);
  paintAvatar(cv, name, 32);
  return el;
}

function renderPlayerGrids(list, total) {
  const overview = $('#onlinePlayers');
  const all = $('#allPlayers');
  if (overview) {
    overview.innerHTML = '';
    list.slice(0, 8).forEach((name) => overview.appendChild(playerChip(name, true)));
    if (!list.length) overview.innerHTML = '<p class="hint">Nobody online right now.</p>';
  }
  if (all) {
    all.innerHTML = '';
    list.forEach((name) => all.appendChild(playerChip(name, true)));
    if (!list.length) all.innerHTML = '<p class="hint">Nobody online right now. Check back after the next refresh.</p>';
  }
  setText('allCount', String(total || list.length));
}

/* ───────────────────────── chart ───────────────────────── */
function drawChart() {
  const cv = $('#historyChart');
  if (!cv || !cv.isConnected) return;
  const points = state.history.length ? state.history.map((p) => p.count) : demoHistory().map((p) => p.count);
  const rect = cv.getBoundingClientRect();
  const w = Math.max(240, rect.width);
  const h = 132;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = { t: 12, r: 6, b: 18, l: 6 };
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 10);
  const span = Math.max(1, max - min);
  const x = (i) => pad.l + (i / Math.max(1, points.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,.055)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const gy = pad.t + (i / 4) * (h - pad.t - pad.b);
    ctx.beginPath();
    ctx.moveTo(pad.l, gy);
    ctx.lineTo(w - pad.r, gy);
    ctx.stroke();
  }

  // smooth-ish path
  const pts = points.map((v, i) => [x(i), y(v)]);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const mx = (p0[0] + p1[0]) / 2;
    ctx.bezierCurveTo(mx, p0[1], mx, p1[1], p1[0], p1[1]);
  }
  const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
  lineGrad.addColorStop(0, 'rgba(78,230,164,.5)');
  lineGrad.addColorStop(1, '#4ee6a4');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // fill
  ctx.lineTo(pts[pts.length - 1][0], h - pad.b);
  ctx.lineTo(pts[0][0], h - pad.b);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, pad.t, 0, h);
  fill.addColorStop(0, 'rgba(78,230,164,.22)');
  fill.addColorStop(1, 'rgba(78,230,164,0)');
  ctx.fillStyle = fill;
  ctx.fill();

  // last point
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last[0], last[1], 3, 0, Math.PI * 2);
  ctx.fillStyle = '#4ee6a4';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(last[0], last[1], 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(78,230,164,.18)';
  ctx.fill();
}

let chartResize = 0;
window.addEventListener('resize', () => {
  clearTimeout(chartResize);
  chartResize = setTimeout(() => { if (state.route === 'server') drawChart(); }, 150);
});

/* ───────────────────────── data loading ───────────────────────── */
async function loadRemoteConfig() {
  try {
    const json = await api('/api/config', {}, 4000);
    const remote = json.data || json;
    if (remote && typeof remote === 'object') {
      state.config = {
        ...state.config,
        ...remote,
        brand: { ...(state.config.brand || {}), ...(remote.brand || {}) },
        mc: { ...(state.config.mc || {}), ...(remote.mc || {}) },
        links: { ...(state.config.links || {}), ...(remote.links || {}) },
        features: { ...(state.config.features || {}), ...(remote.features || {}) },
      };
      if (remote.pollSeconds) state.pollMs = Math.max(10, Number(remote.pollSeconds)) * 1000;
      applyConfig();
      applyFeatureState();
    }
  } catch { /* static preview */ }
}

let refreshing = false;
async function refresh({ manual = false } = {}) {
  if (refreshing) return;
  refreshing = true;
  const btn = $('#refreshBtn');
  btn?.classList.add('is-spinning');

  try {
    const json = await api('/api/status', {}, 9000);
    const st = json.data || json;
    if (!st || typeof st !== 'object') throw new Error('Bad status payload');
    setMode('live');
    renderStatus(st);
    setText('playersUpdated', 'updated just now');

    try {
      const hist = await api('/api/history', {}, 4000);
      const h = hist.data || hist;
      const points = Array.isArray(h) ? h : h.points;
      if (Array.isArray(points) && points.length > 1) state.history = points;
      else if (!state.history.length) state.history = demoHistory();
    } catch { if (!state.history.length) state.history = demoHistory(); }

    loadWhitelistSummary();
    if (manual) toast('Status refreshed');
  } catch (err) {
    if (state.mode === 'live') toast('API unreachable — showing the last known status', 'error');
    setMode('demo');
    const demo = demoStatus();
    if (!state.history.length) state.history = demoHistory();
    renderStatus(demo);
    if (manual) toast('Demo mode — start the API for live data', 'error');
  } finally {
    refreshing = false;
    setTimeout(() => btn?.classList.remove('is-spinning'), 400);
  }
}

function startPolling() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (document.hidden) return;
    refresh();
  }, state.pollMs);
}

/* ───────────────────────── whitelist bridge (read-only) ───────────────────────── */
async function loadWhitelistSummary() {
  try {
    const json = await api('/api/whitelist/summary', {}, 5000);
    const data = json.data || json;
    const tag = $('#bridgeTag');
    if (data.configured) {
      if (tag) { tag.textContent = 'Read-only'; tag.classList.add('tag-gold'); }
      setText('bridgePending', data.pending != null ? String(data.pending) : '—');
      setText('bridgeTotal', data.total != null ? String(data.total) : '—');
    }
  } catch { /* bridge is optional */ }
}

/* ───────────────────────── player lookup ───────────────────────── */
const nameRe = /^[A-Za-z0-9_]{3,16}$/;

async function lookup(name) {
  const err = $('#playerError');
  const box = $('#playerResult');
  if (err) { err.hidden = true; err.textContent = ''; }
  if (!nameRe.test(name)) {
    if (err) { err.hidden = false; err.textContent = 'Enter a valid Minecraft username (3–16 letters, numbers or underscores).'; }
    if (box) box.hidden = true;
    return;
  }
  if (box) box.hidden = true;

  let data = null;
  if (state.mode === 'live') {
    try {
      const json = await api(`/api/players/${encodeURIComponent(name)}`, {}, 8000);
      data = json.data || json;
    } catch (e) {
      if (e.status === 404) {
        if (err) { err.hidden = false; err.textContent = `No Mojang account found for “${name}”.`; }
        return;
      }
      if (err) { err.hidden = false; err.textContent = 'Player lookup is unavailable right now.'; }
      return;
    }
  } else {
    const hit = ROSTER.find((n) => n.toLowerCase() === name.toLowerCase());
    if (!hit) {
      if (err) {
        err.hidden = false;
        err.textContent = 'Demo mode only knows the sample roster. Run the API for real Mojang lookups.';
      }
      return;
    }
    data = { name: hit, uuid: null, online: true, demo: true };
  }

  if (!data) return;
  renderPlayerResult(data);
  box.hidden = false;
}

function renderPlayerResult(p) {
  const box = $('#playerResult');
  if (!box) return;
  const online = !!p.online;
  const uuid = p.uuid || '';
  box.innerHTML = `
    <div class="result-card">
      <canvas aria-hidden="true"></canvas>
      <div class="result-main">
        <h4>${escapeHtml(p.name)}</h4>
        <div class="result-meta">
          <span class="chip ${online ? 'chip-live' : ''}">
            <span class="${online ? 'dot-live' : 'dot'}" aria-hidden="true"></span>
            ${online ? 'Online now' : 'Offline'}
          </span>
          ${p.demo ? '<span class="tag tag-gold">demo name</span>' : ''}
          ${uuid ? `<span class="tag mono">${escapeHtml(uuid.slice(0, 8))}…</span>` : '<span class="tag">UUID withheld</span>'}
        </div>
        <p class="result-uuid">${uuid ? escapeHtml(uuid) : 'UUID is fetched from Mojang when the API is connected.'}</p>
        <div class="result-actions">
          ${uuid ? `<button class="btn btn-glass btn-sm" type="button" data-copy-uuid="${escapeHtml(uuid)}"><svg class="ic"><use href="#i-copy"/></svg> Copy UUID</button>` : ''}
          ${uuid ? `<a class="btn btn-glass btn-sm" href="https://namemc.com/profile/${encodeURIComponent(uuid)}" target="_blank" rel="noopener noreferrer">NameMC <svg class="ic"><use href="#i-external"/></svg></a>` : ''}
          <a class="btn btn-glass btn-sm" href="${escapeHtml(state.config.links?.discord || '#')}" target="_blank" rel="noopener noreferrer">Ask in Discord</a>
        </div>
      </div>
    </div>`;
  const cv = box.querySelector('canvas');
  paintAvatar(cv, p.name, 64);
  cv.style.width = '64px';
  cv.style.height = '64px';
  const copyBtn = box.querySelector('[data-copy-uuid]');
  copyBtn?.addEventListener('click', async () => {
    const ok = await copyText(copyBtn.dataset.copyUuid);
    toast(ok ? 'UUID copied' : 'Copy failed', ok ? 'ok' : 'error');
  });
}

/* ───────────────────────── admin ───────────────────────── */
async function adminApi(path, options = {}) {
  return api(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${state.adminToken}`,
    },
  }, 10000);
}

async function verifyAdmin(silent = false) {
  const err = $('#adminError');
  if (!state.adminToken) return false;
  try {
    await adminApi('/api/admin/verify');
    state.pteroReady = true;
    $('#adminGate').hidden = true;
    $('#adminPanel').hidden = false;
    if (err) err.hidden = true;
    if (!silent) toast('Admin unlocked');
    await loadResources();
    return true;
  } catch (e) {
    state.pteroReady = false;
    if (state.adminToken && !silent) {
      if (err) { err.hidden = false; err.textContent = e.status === 401 ? 'That token was rejected.' : 'Admin API is not available.'; }
    }
    return false;
  }
}

async function loadResources() {
  const tag = $('#adminPteroTag');
  try {
    const json = await adminApi('/api/admin/resources');
    const r = json.data || json;
    if (!r.configured) {
      if (tag) tag.textContent = 'Not configured';
      setText('adminPteroHint', 'Pterodactyl credentials are not set on the API. Power controls are disabled.');
      $$('.power-btn').forEach((b) => { b.disabled = true; });
      return;
    }
    if (tag) { tag.textContent = 'Connected'; tag.classList.add('tag-gold'); }
    setText('resCpu', r.cpuPercent != null ? `${Math.round(r.cpuPercent)}%` : '—');
    setText('resMem', r.memoryPercent != null ? `${Math.round(r.memoryPercent)}%` : '—');
    setText('resDisk', r.diskPercent != null ? `${Math.round(r.diskPercent)}%` : '—');
    setText('resState', r.state || '—');
    setBar('#resCpuBar', r.cpuPercent);
    setBar('#resMemBar', r.memoryPercent);
    setBar('#resDiskBar', r.diskPercent);
    setBar('#resStateBar', r.state === 'running' ? 100 : 0);
    $$('.power-btn').forEach((b) => { b.disabled = false; });
  } catch (e) {
    if (tag) tag.textContent = 'Unavailable';
    if (e.status === 503) setText('adminPteroHint', 'Pterodactyl is not configured on the API server.');
    $$('.power-btn').forEach((b) => { b.disabled = true; });
  }
}

function setBar(sel, pct) {
  const el = $(sel);
  if (!el) return;
  const v = Number(pct) || 0;
  el.style.width = `${Math.min(100, Math.max(0, v))}%`;
  el.classList.toggle('warn', v >= 70 && v < 90);
  el.classList.toggle('danger', v >= 90);
}

$('#adminForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#adminToken');
  const err = $('#adminError');
  const token = input?.value.trim() || '';
  if (!token) return;
  state.adminToken = token;
  sessionStorage.setItem('supernova.admin', token);
  const ok = await verifyAdmin();
  if (!ok && err) {
    sessionStorage.removeItem('supernova.admin');
    state.adminToken = '';
    err.hidden = false;
    err.textContent = 'Token rejected. Check DASHBOARD_ADMIN_TOKEN on the API server.';
  }
});

$$('.power-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.power;
    const label = action.charAt(0).toUpperCase() + action.slice(1);
    if (!['start', 'stop', 'restart'].includes(action)) return;
    if (action === 'stop' && !window.confirm('Stop the Minecraft server? Every player will be disconnected.')) return;
    if (action === 'restart' && !window.confirm('Restart the server? Players will be disconnected for a moment.')) return;
    const err = $('#powerError');
    if (err) err.hidden = true;
    btn.disabled = true;
    try {
      await adminApi('/api/admin/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      toast(`${label} signal sent`);
      setTimeout(loadResources, 2500);
    } catch (e) {
      if (err) {
        err.hidden = false;
        err.textContent = e.status === 401 ? 'Session expired — unlock again.' : 'Power action failed. Check the API logs.';
      }
    } finally {
      btn.disabled = false;
    }
  });
});

function applyFeatureState() {
  const f = state.config.features || {};
  const pteroTag = $('#pteroTag');
  if (pteroTag && f.pterodactyl) pteroTag.textContent = 'Configured';
  if (!f.admin) {
    const link = $('.nav-item[data-route="admin"]');
    if (link) { link.style.opacity = '.5'; link.setAttribute('aria-disabled', 'true'); }
  }
}

/* ───────────────────────── wire up ───────────────────────── */
$$('[data-copy-ip]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const ip = `${state.status?.host || state.config.mc?.host || 'tarzan.supernovaa.in'}:${state.status?.port || state.config.mc?.port || 25509}`;
    const ok = await copyText(ip);
    toast(ok ? `${ip} copied` : 'Copy failed', ok ? 'ok' : 'error');
  });
});
$$('[data-copy-bedrock]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const port = String(state.config.mc?.bedrockPort || 19132);
    const ok = await copyText(port);
    toast(ok ? `Bedrock port ${port} copied` : 'Copy failed', ok ? 'ok' : 'error');
  });
});

$('#playerForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#playerInput');
  lookup((input?.value || '').trim());
});

$$('[data-sample]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $('#playerInput');
    if (input) input.value = btn.dataset.sample;
    lookup(btn.dataset.sample);
  });
});

$('#refreshBtn')?.addEventListener('click', () => refresh({ manual: true }));
$('#refreshServer')?.addEventListener('click', () => refresh({ manual: true }));

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - state.lastChecked > state.pollMs) refresh();
});

window.addEventListener('hashchange', route);

/* relative "checked" labels */
setInterval(() => {
  if (!state.lastChecked) return;
  const label = ago(state.lastChecked);
  if (state.status) {
    setText('heroChecked', `checked ${label}`);
    setText('srvChecked', `checked ${label}`);
    setText('playersUpdated', `updated ${label}`);
  }
}, 10000);

/* ───────────────────────── boot ───────────────────────── */
applyConfig();
route();
setMode('demo');
state.history = demoHistory();
renderStatus(demoStatus());
startPolling();
loadRemoteConfig().then(() => {
  refresh();
  if (state.adminToken) verifyAdmin(true);
});
/* keep first paint complete even if the API hangs */
setTimeout(() => {
  if (!state.status) {
    state.history = state.history.length ? state.history : demoHistory();
    renderStatus(demoStatus());
  }
}, 1200);
