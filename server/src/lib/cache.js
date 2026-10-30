/**
 * Tiny TTL cache with in-flight de-duplication.
 * Prevents bursts of dashboard clients from hammering the Minecraft server
 * or Mojang, and guarantees at most one upstream request at a time per key.
 */
export function createCache({ ttlMs, maxEntries = 500 } = {}) {
  const entries = new Map();
  const inflight = new Map();

  function get(key) {
    const hit = entries.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key, value, ttl = ttlMs) {
    if (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(key, { value, expires: Date.now() + ttl });
    return value;
  }

  async function wrap(key, fn, ttl = ttlMs) {
    const cached = get(key);
    if (cached !== undefined) return { value: cached, cached: true };

    if (inflight.has(key)) {
      const value = await inflight.get(key);
      return { value, cached: true, shared: true };
    }

    const promise = (async () => {
      try {
        const value = await fn();
        set(key, value, ttl);
        return value;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, promise);
    return { value: await promise, cached: false };
  }

  function clear() {
    entries.clear();
  }

  return { get, set, wrap, clear, size: () => entries.size };
}
