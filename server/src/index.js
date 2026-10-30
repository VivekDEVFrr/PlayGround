import { config, pterodactylEnabled, whitelistBridgeEnabled } from './config.js';
import { createApp } from './app.js';
import { log } from './lib/log.js';

const app = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  log('info', 'supernova dashboard api listening', {
    port: config.port,
    dashboard: config.serveDashboard,
    minecraft: `${config.mc.host}:${config.mc.port}`,
    pterodactyl: pterodactylEnabled,
    whitelistBridge: whitelistBridgeEnabled,
    admin: Boolean(config.adminToken),
  });
  if (!config.adminToken) log('warn', 'DASHBOARD_ADMIN_TOKEN is empty — admin API disabled');
  if (!config.origins.length) log('info', 'DASHBOARD_ORIGIN empty — same-origin dashboard only');
});

server.headersTimeout = 20_000;
server.requestTimeout = 25_000;

const shutdown = (signal) => {
  log('info', 'shutting down', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  log('error', 'unhandled rejection', { error: reason?.message || String(reason) });
});
