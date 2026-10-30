import { status as mcStatus } from 'minecraft-server-util';
import { config } from '../config.js';

let cached = null;
let expires = 0;
let inflight = null;

const TTL = config.mc.cacheTtlMs;

/**
 * Read-only Minecraft ping with a small cache and in-flight de-duplication.
 * The bot never sends commands to the server and never touches whitelist data.
 */
export async function getServerStatus({ force = false } = {}) {
  if (!force && cached && Date.now() < expires) return { ...cached, cached: true };
  if (inflight) return inflight;

  inflight = (async () => {
    const started = Date.now();
    try {
      const res = await mcStatus(config.mc.host, config.mc.port, {
        timeout: config.mc.timeoutMs,
        enableSRV: true,
      });
      const version = typeof res.version === 'object' ? res.version?.name : res.version;
      const sample = Array.isArray(res.players?.sample) ? res.players.sample : [];
      const list = sample
        .map((p) => (typeof p === 'string' ? p : p?.name))
        .filter((p) => typeof p === 'string' && p.length)
        .slice(0, 60);

      const value = {
        online: true,
        host: config.mc.host,
        port: config.mc.port,
        players: {
          online: Number(res.players?.online) || 0,
          max: Number(res.players?.max) || 0,
          list,
        },
        version: version ? String(version) : null,
        protocol: res.version?.protocol ?? null,
        motd: res.motd?.clean || res.motd?.raw || '',
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      };
      cached = value;
      expires = Date.now() + TTL;
      return value;
    } catch (err) {
      const value = {
        online: false,
        host: config.mc.host,
        port: config.mc.port,
        players: { online: 0, max: 0, list: [] },
        version: null,
        protocol: null,
        motd: '',
        latencyMs: null,
        checkedAt: new Date().toISOString(),
        error: err?.code || 'unreachable',
      };
      cached = value;
      // Cache failures briefly so a restart loop cannot spam a dead server.
      expires = Date.now() + Math.min(TTL, 10000);
      return value;
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export async function lookupMojang(name) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'SupernovaSMP-Bot/2.0' },
    });
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw new Error(`Mojang HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.id || !json?.name) return null;
    const hex = String(json.id).replace(/-/g, '');
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return { name: json.name, uuid };
  } finally {
    clearTimeout(timer);
  }
}
