/* Public runtime config — safe to edit and commit.
   The dashboard merges this with GET /api/config when the backend is running.
   Never put secrets here. */
window.SUPERNOVA_CONFIG = {
  apiBase: '',
  pollSeconds: 30,
  brand: {
    name: 'Supernova SMP',
    short: 'Supernova',
    tagline: 'A cozy survival world, three seasons deep.',
    logo: 'assets/img/nova.svg',
  },
  mc: {
    host: 'tarzan.supernovaa.in',
    port: 25509,
    bedrockPort: 19132,
    version: '1.21.4',
  },
  links: {
    discord: 'https://discord.gg/supernova',
    whitelist: 'https://discord.gg/supernova',
    rules: '#/support',
    map: '',
  },
  features: { pterodactyl: false, whitelistBridge: false, admin: true },
};
