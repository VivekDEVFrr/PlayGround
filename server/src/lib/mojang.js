import { createCache } from './cache.js';
import { config } from '../config.js';
import { badRequest, notFound, unavailable } from './errors.js';

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const UUID_RE = /^[0-9a-f]{32}$/i;

const cache = createCache({ ttlMs: 10 * 60 * 1000, maxEntries: 1000 });

function formatUuid(raw) {
  const hex = String(raw || '').replace(/-/g, '');
  if (!UUID_RE.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function validateUsername(name) {
  const value = String(name || '').trim();
  if (!NAME_RE.test(value)) {
    throw badRequest('Username must be 3–16 letters, numbers or underscores.');
  }
  return value;
}

async function fetchMojang(name) {
  const url = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'SupernovaSMP-Dashboard/2.0' },
    });
    if (res.status === 204 || res.status === 404) return { found: false };
    if (!res.ok) throw unavailable('Mojang profile lookup failed');
    const json = await res.json();
    if (!json || !json.id || !json.name) return { found: false };
    return {
      found: true,
      profile: {
        name: String(json.name),
        uuid: formatUuid(json.id),
        rawUuid: String(json.id).toLowerCase(),
      },
    };
  } catch (err) {
    if (err?.name === 'AbortError') throw unavailable('Mojang did not respond in time');
    if (err?.status) throw err;
    throw unavailable('Mojang profile lookup is unreachable');
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupPlayer(name, status) {
  const username = validateUsername(name);
  const key = username.toLowerCase();

  let entry = cache.get(key);
  if (!entry) {
    const { value } = await cache.wrap(key, () => fetchMojang(username), 10 * 60 * 1000);
    entry = value;
  }

  if (!entry?.found) {
    // Negative hits are cached briefly so a refresh loop cannot spam Mojang.
    cache.set(key, { found: false }, 2 * 60 * 1000);
    throw notFound('No Minecraft account with that name.');
  }

  const list = Array.isArray(status?.players?.list) ? status.players.list : [];
  const onlineNow = list.some((p) => String(p).toLowerCase() === username.toLowerCase());

  return {
    name: entry.profile.name,
    uuid: entry.profile.uuid,
    online: Boolean(status?.online && onlineNow),
    checkedAt: new Date().toISOString(),
    source: 'mojang',
    server: {
      host: config.mc.host,
      port: config.mc.port,
      reachable: Boolean(status?.online),
      playersOnline: status?.players?.online ?? null,
    },
  };
}
