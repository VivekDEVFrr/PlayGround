import { status as mcStatus } from 'minecraft-server-util';
import { createCache } from './cache.js';
import { config } from '../config.js';
import { log } from './log.js';

/**
 * Minecraft status service.
 *
 * Only this process talks to the Minecraft server. The browser never opens a
 * TCP connection to the game port (25509 is not HTTP), which also means the
 * dashboard cannot be used to amplify traffic against the server.
 */
export function createStatusService() {
  const cache = createCache({ ttlMs: config.mc.cacheTtlMs });
  const history = [];
  let lastRecorded = 0;

  function pushHistory(online, count) {
    const now = Date.now();
    if (history.length && now - lastRecorded < config.mc.historyIntervalMs) return;
    history.push({ t: now, count: online ? count : 0, online });
    lastRecorded = now;
    while (history.length > config.mc.historyMax) history.shift();
  }

  async function ping() {
    const started = Date.now();
    const response = await mcStatus(config.mc.host, config.mc.port, {
      timeout: config.mc.timeoutMs,
      enableSRV: true,
    });
    const latencyMs = Date.now() - started;

    const version = typeof response.version === 'object' ? response.version?.name : response.version;
    const protocol = response.version?.protocol ?? null;
    const rawSample = Array.isArray(response.players?.sample) ? response.players.sample : [];
    const list = rawSample
      .map((p) => (typeof p === 'string' ? p : p?.name))
      .filter((p) => typeof p === 'string' && p.length > 0)
      .slice(0, 100);

    const online = Number(response.players?.online) || 0;
    const max = Number(response.players?.max) || 0;

    pushHistory(true, online);

    return {
      online: true,
      host: config.mc.host,
      port: config.mc.port,
      players: { online, max, list },
      version: version ? String(version) : null,
      protocol: protocol != null ? Number(protocol) : null,
      motd: response.motd?.clean || response.motd?.raw || '',
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }

  function decorate(base) {
    const counts = history.map((h) => h.count);
    const peak = counts.length ? Math.max(...counts) : base.players.online;
    const seen = history.length;
    const up = history.filter((h) => h.online).length;
    const uptime = seen >= 5 ? `${((up / seen) * 100).toFixed(1)}%` : null;

    return {
      ...base,
      peak,
      uptime,
      historySamples: seen,
    };
  }

  async function getStatus() {
    const { value, cached } = await cache.wrap('status', async () => {
      try {
        return await ping();
      } catch (err) {
        // An offline server is a valid state, not an API failure.
        pushHistory(false, 0);
        log('warn', 'minecraft ping failed', { host: config.mc.host, port: config.mc.port, error: err?.code || err?.message });
        return {
          online: false,
          host: config.mc.host,
          port: config.mc.port,
          players: { online: 0, max: 0, list: [] },
          version: null,
          protocol: null,
          motd: '',
          latencyMs: null,
          checkedAt: new Date().toISOString(),
        };
      }
    });

    return decorate({ ...value, cached });
  }

  function getHistory() {
    const counts = history.map((h) => h.count);
    return {
      points: history.slice(),
      peak: counts.length ? Math.max(...counts) : 0,
      samples: history.length,
      intervalMs: config.mc.historyIntervalMs,
    };
  }

  return { getStatus, getHistory, invalidate: () => cache.clear() };
}
