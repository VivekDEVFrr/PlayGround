import { REST, Routes } from 'discord.js';
import './config.js';
import { commands } from './commands/definitions.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('[deploy] DISCORD_TOKEN and DISCORD_CLIENT_ID are required.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

try {
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  console.log(`[deploy] registering ${commands.length} commands ${guildId ? `in guild ${guildId}` : 'globally'}`);

  const result = await rest.put(route, { body: commands });

  console.log(`[deploy] done — ${Array.isArray(result) ? result.length : commands.length} commands registered`);
  if (!guildId) console.log('[deploy] global commands can take up to an hour to appear in Discord');
} catch (err) {
  console.error('[deploy] failed:', err?.message || err);
  process.exit(1);
}
