import { Client, GatewayIntentBits } from 'discord.js';
import { assertBotConfig, config } from './config.js';
import { registerEvents } from './events.js';

if (!assertBotConfig()) process.exit(1);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.on('error', (err) => console.error('[client error]', err?.message));
client.on('shardError', (err) => console.error('[shard error]', err?.message));

process.on('unhandledRejection', (reason) => {
  console.error('[unhandled rejection]', reason?.message || reason);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal}`);
  try {
    await client.destroy();
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

registerEvents(client);

try {
  await client.login(config.token);
} catch (err) {
  console.error('[login] failed:', err?.message || err);
  console.error('[login] Check DISCORD_TOKEN and that the bot is invited to the server.');
  process.exit(1);
}
