import { config, whitelistBridgeEnabled } from '../config.js';
import { createCache } from './cache.js';
import { log } from './log.js';

/**
 * READ-ONLY whitelist bridge.
 *
 * This project deliberately does NOT contain a whitelist implementation.
 * It never writes, approves, denies, renames or migrates anything. If the
 * operator exposes a cached GET endpoint with a JSON summary, we display the
 * two numbers and nothing else. If not configured, the dashboard link simply
 * points to the existing Discord flow.
 */
const cache = createCache({ ttlMs: 60_000, maxEntries: 4 });

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

function extract(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  const data = root.data && typeof root.data === 'object' ? root.data : root;
  const pending =
    number(data.pending) ??
    number(data.pendingCount) ??
    number(data.pending_applications) ??
    null;
  const total =
    number(data.total) ??
    number(data.whitelisted) ??
    number(data.whitelistedCount) ??
    number(data.approved) ??
    null;
  return { pending, total };
}

export async function getWhitelistSummary() {
  if (!whitelistBridgeEnabled) {
    return {
      configured: false,
      reachable: false,
      pending: null,
      total: null,
      note: 'No read-only bridge configured. The dashboard links to the existing Discord flow.',
    };
  }

  const { value } = await cache.wrap('summary', async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(config.whitelistStatusUrl, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'SupernovaSMP-Dashboard/2.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return { ...extract(payload), reachable: true };
    } catch (err) {
      log('warn', 'whitelist summary unreachable', { error: err?.name === 'AbortError' ? 'timeout' : err?.message });
      return { pending: null, total: null, reachable: false };
    } finally {
      clearTimeout(timer);
    }
  });

  return {
    configured: true,
    reachable: Boolean(value.reachable),
    pending: value.pending,
    total: value.total,
    checkedAt: new Date().toISOString(),
    note: 'Read-only summary. This API never writes to the whitelist system.',
  };
}
