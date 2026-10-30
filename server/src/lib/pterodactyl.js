import { config, pterodactylEnabled } from '../config.js';
import { unavailable } from './errors.js';
import { log } from './log.js';

/**
 * The Pterodactyl token lives only in this process. Every call below is made
 * server-side; the browser can only reach it through the token-gated admin
 * routes, and the token is never included in any response.
 */
async function pteroFetch(path, options = {}) {
  if (!pterodactylEnabled) throw unavailable('Pterodactyl is not configured');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${config.pterodactyl.url}/api/client${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.pterodactyl.token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });

    if (res.status === 204) return null;
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      log('error', 'pterodactyl request failed', { status: res.status, path });
      throw unavailable('Pterodactyl did not accept the request');
    }
    return json;
  } catch (err) {
    if (err?.status) throw err;
    log('error', 'pterodactyl request error', { path, error: err?.code || err?.message });
    throw unavailable('Pterodactyl is unreachable');
  } finally {
    clearTimeout(timer);
  }
}

export const isPterodactylEnabled = () => pterodactylEnabled;

export async function getResources() {
  if (!pterodactylEnabled) return { configured: false };

  const id = encodeURIComponent(config.pterodactyl.serverId);
  const [stats, server] = await Promise.all([
    pteroFetch(`/servers/${id}/resources`),
    pteroFetch(`/servers/${id}`).catch(() => null),
  ]);

  const attrs = stats?.attributes || {};
  const r = attrs.resources || {};
  const limits = server?.attributes?.limits || {};
  const state = attrs.current_state || 'unknown';

  const pct = (used, limit) => {
    const u = Number(used);
    const l = Number(limit);
    if (!Number.isFinite(u) || !Number.isFinite(l) || l <= 0) return null;
    return Math.min(100, Math.round((u / l) * 1000) / 10);
  };

  const memoryLimit = Number(limits.memory) > 0 ? Number(limits.memory) * 1024 * 1024 : null;
  const diskLimit = Number(limits.disk) > 0 ? Number(limits.disk) * 1024 * 1024 : null;

  return {
    configured: true,
    state,
    suspended: Boolean(attrs.is_suspended),
    cpuPercent: Number.isFinite(Number(r.cpu_absolute)) ? Math.round(Number(r.cpu_absolute) * 10) / 10 : null,
    memoryPercent: memoryLimit ? pct(r.memory_bytes, memoryLimit) : null,
    diskPercent: diskLimit ? pct(r.disk_bytes, diskLimit) : null,
    cpuLimitPercent: Number(limits.cpu) > 0 ? Number(limits.cpu) : null,
    memoryBytes: Number(r.memory_bytes) || null,
    memoryLimitBytes: memoryLimit,
    diskBytes: Number(r.disk_bytes) || null,
    diskLimitBytes: diskLimit,
    uptimeMs: Number(r.uptime) || null,
    network: {
      rxBytes: Number(r.network_rx_bytes) || 0,
      txBytes: Number(r.network_tx_bytes) || 0,
    },
    checkedAt: new Date().toISOString(),
  };
}

const SIGNALS = new Set(['start', 'stop', 'restart']);

export async function sendPower(action) {
  if (!SIGNALS.has(action)) throw unavailable('Unsupported power action');
  if (!pterodactylEnabled) throw unavailable('Pterodactyl is not configured');

  const id = encodeURIComponent(config.pterodactyl.serverId);
  await pteroFetch(`/servers/${id}/power`, {
    method: 'POST',
    body: JSON.stringify({ signal: action }),
  });

  log('info', 'pterodactyl power signal sent', { action });
  return { action, sentAt: new Date().toISOString() };
}
