import { ActivityType, Events } from 'discord.js';
import { config } from './config.js';
import { executeCommand } from './commands/execute.js';
import { brandEmbed } from './lib/brand.js';
import { getServerStatus } from './lib/mc.js';
import { panelButtons, refreshStatusBoard, rulesPanelEmbed, serverPanelEmbed, startStatusLoop } from './lib/status-board.js';
import { handleSuggestionButton } from './lib/suggestions.js';
import { handleTicketButton, openTicket } from './lib/tickets.js';
import { sendWelcome } from './lib/welcome.js';

async function safeError(interaction, err, label) {
  console.error(`[${label}]`, err?.stack || err?.message || err);
  const payload = {
    embeds: [brandEmbed('Something went wrong', 'The action could not be completed. Staff have been notified in the logs.')],
    ephemeral: true,
  };
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else if (interaction.isRepliable()) await interaction.reply(payload);
  } catch {
    // interaction expired — nothing else to do
  }
}

async function handleButton(interaction) {
  const id = interaction.customId || '';

  if (id.startsWith('ticket:')) return handleTicketButton(interaction);
  if (id.startsWith('suggest:')) return handleSuggestionButton(interaction);

  if (id === 'welcome:support') return openTicket(interaction, 'general');

  if (id === 'welcome:server' || id === 'panel:server') {
    await interaction.deferReply({ ephemeral: true });
    const st = await getServerStatus();
    return interaction.editReply({ embeds: [serverPanelEmbed(st)], components: [panelButtons()] });
  }

  if (id === 'welcome:rules' || id === 'panel:rules') {
    return interaction.reply({ embeds: [rulesPanelEmbed()], ephemeral: true });
  }

  return null;
}

export function registerEvents(client) {
  client.once(Events.ClientReady, () => {
    console.log(`[ready] logged in as ${client.user.tag} (${client.guilds.cache.size} guilds)`);
    client.user.setPresence({
      status: 'online',
      activities: [{ name: 'the server wake up', type: ActivityType.Watching }],
    });
    startStatusLoop(client);
    refreshStatusBoard(client, { force: true }).catch((err) => console.error('[status] initial refresh failed', err?.message));
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        return await executeCommand(interaction);
      }
      if (interaction.isButton()) {
        const handled = await handleButton(interaction);
        if (handled === null) {
          return interaction.reply({ embeds: [brandEmbed('Unknown button', 'This button is no longer active.')], ephemeral: true });
        }
        return handled;
      }
      return null;
    } catch (err) {
      const label = interaction.isChatInputCommand() ? `command:${interaction.commandName}` : 'interaction';
      return safeError(interaction, err, label);
    }
  });

  client.on(Events.GuildMemberAdd, (member) => {
    sendWelcome(member).catch((err) => console.error('[welcome] failed', err?.message));
  });

  client.on(Events.Error, (err) => console.error('[discord error]', err?.message));
  client.on(Events.Warn, (msg) => console.warn('[discord warn]', msg));

  if (!config.channels.welcome) console.warn('[welcome] WELCOME_CHANNEL_ID is empty');
  if (!config.channels.status) console.warn('[status] STATUS_CHANNEL_ID is empty');
  if (!config.channels.suggestions) console.warn('[suggest] SUGGESTION_CHANNEL_ID is empty');
  if (!config.staffRoleIds.length) console.warn('[staff] STAFF_ROLE_IDS is empty — only Manage Server counts as staff');
}
