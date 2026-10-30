import 'dotenv/config';

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const bool = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',

  brand: {
    name: process.env.BRAND_NAME || 'Supernova SMP',
    short: process.env.BRAND_SHORT || 'Supernova',
    color: process.env.BRAND_COLOR || '#4EE6A4',
  },

  mc: {
    host: process.env.MC_HOST || 'tarzan.supernovaa.in',
    port: num(process.env.MC_PORT, 25509),
    timeoutMs: num(process.env.MC_TIMEOUT_MS, 5000),
    cacheTtlMs: num(process.env.MC_CACHE_TTL_MS, 15000),
    bedrockPort: num(process.env.BEDROCK_PORT, 19132),
  },

  channels: {
    welcome: process.env.WELCOME_CHANNEL_ID || '',
    rules: process.env.RULES_CHANNEL_ID || '',
    status: process.env.STATUS_CHANNEL_ID || '',
    ticketPanel: process.env.TICKET_PANEL_CHANNEL_ID || '',
    ticketLog: process.env.TICKET_LOG_CHANNEL_ID || '',
    ticketCategory: process.env.TICKET_CATEGORY_ID || '',
    suggestions: process.env.SUGGESTION_CHANNEL_ID || '',
  },

  statusIntervalSeconds: Math.max(30, num(process.env.STATUS_INTERVAL_SECONDS, 60)),
  welcomeDm: bool(process.env.WELCOME_DM, false),
  staffRoleIds: list(process.env.STAFF_ROLE_IDS),

  links: {
    whitelist: process.env.WHITELIST_URL || 'https://discord.gg/supernova',
    invite: process.env.DISCORD_INVITE_URL || 'https://discord.gg/supernova',
    rules: process.env.RULES_URL || '',
    support: process.env.SUPPORT_URL || '',
  },
};

export function assertBotConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (missing.length) {
    console.error(`[config] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[config] Copy bot/.env.example to bot/.env and fill it in.');
    return false;
  }
  return true;
}
