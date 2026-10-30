import 'dotenv/config';

const bool = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.DASHBOARD_PORT || process.env.PORT, 3001),
  trustProxy: num(process.env.TRUST_PROXY, 1),
  serveDashboard: bool(process.env.SERVE_DASHBOARD, true),
  origins: list(process.env.DASHBOARD_ORIGIN),
  logLevel: process.env.LOG_LEVEL || 'info',

  adminToken: process.env.DASHBOARD_ADMIN_TOKEN || '',

  mc: {
    host: process.env.MC_HOST || 'tarzan.supernovaa.in',
    port: num(process.env.MC_PORT, 25509),
    timeoutMs: num(process.env.MC_TIMEOUT_MS, 5000),
    cacheTtlMs: num(process.env.MC_CACHE_TTL_MS, 15000),
    historyMax: num(process.env.MC_HISTORY_MAX, 288),
    historyIntervalMs: num(process.env.MC_HISTORY_INTERVAL_MS, 300000),
  },

  brand: {
    name: process.env.PUBLIC_BRAND_NAME || 'Supernova SMP',
    short: process.env.PUBLIC_BRAND_SHORT || 'Supernova',
    tagline: process.env.PUBLIC_TAGLINE || 'A cozy survival world, three seasons deep.',
    logo: 'assets/img/nova.svg',
  },

  links: {
    discord: process.env.PUBLIC_DISCORD_URL || 'https://discord.gg/supernova',
    whitelist: process.env.PUBLIC_WHITELIST_URL || 'https://discord.gg/supernova',
    rules: process.env.PUBLIC_RULES_URL || '#/support',
    map: '',
  },

  bedrockPort: num(process.env.PUBLIC_BEDROCK_PORT, 19132),
  pollSeconds: Math.max(10, Math.round(num(process.env.MC_CACHE_TTL_MS, 15000) / 1000) || 30),

  whitelistStatusUrl: process.env.WHITELIST_STATUS_URL || '',

  pterodactyl: {
    url: (process.env.PTERODACTYL_URL || '').replace(/\/+$/, ''),
    token: process.env.PTERODACTYL_TOKEN || '',
    serverId: process.env.PTERODACTYL_SERVER_ID || '',
  },
};

export const pterodactylEnabled = Boolean(
  config.pterodactyl.url && config.pterodactyl.token && config.pterodactyl.serverId,
);

export const whitelistBridgeEnabled = Boolean(config.whitelistStatusUrl);
