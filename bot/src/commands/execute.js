import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { address, assertStaff, brandEmbed, linkRow, rulesEmbed } from '../lib/brand.js';
import { getServerStatus, lookupMojang } from '../lib/mc.js';
import { panelButtons, refreshStatusBoard, serverPanelEmbed, statusEmbed } from '../lib/status-board.js';
import { postSuggestion, reviewSuggestionCommand } from '../lib/suggestions.js';
import { postTicketPanel } from '../lib/tickets.js';

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

function guildOnly(interaction) {
  if (interaction.inGuild()) return true;
  interaction.reply({ embeds: [brandEmbed('Server only', 'This command only works inside the Discord server.')], ephemeral: true });
  return false;
}

function urlOk(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const handlers = {
  async server(interaction) {
    await interaction.deferReply();
    const st = await getServerStatus();
    await interaction.editReply({ embeds: [serverPanelEmbed(st)], components: [panelButtons()] });
  },

  async status(interaction) {
    await interaction.deferReply();
    const st = await getServerStatus();
    await interaction.editReply({ embeds: [statusEmbed(st)] });
  },

  async players(interaction) {
    await interaction.deferReply();
    const st = await getServerStatus();
    if (!st.online) {
      return interaction.editReply({
        embeds: [brandEmbed('🔴 Server offline', `The server is not responding right now. Try again in a minute, or check \`${address()}\`.`).setColor(0xff7d76)],
      });
    }
    const embed = brandEmbed(
      '👥 Players online',
      `**${st.players.online}** / ${st.players.max || '?'} players are in the world.`,
    );
    if (st.players.list.length) {
      embed.addFields({ name: 'Online now', value: st.players.list.map((n) => `• ${n}`).join('\n').slice(0, 1024) });
    } else {
      embed.addFields({ name: 'Online now', value: 'The server does not expose a public player list.' });
    }
    embed.setFooter({ text: `${config.brand.name} · checked ${st.latencyMs} ms` });
    await interaction.editReply({ embeds: [embed] });
  },

  async player(interaction) {
    const name = interaction.options.getString('username', true).trim();
    if (!NAME_RE.test(name)) {
      return interaction.reply({
        embeds: [brandEmbed('Invalid username', 'Use 3–16 letters, numbers or underscores.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    const [profile, st] = await Promise.all([lookupMojang(name), getServerStatus()]);

    if (!profile) {
      return interaction.editReply({
        embeds: [brandEmbed('No account found', `Mojang has no Java account called **${name}**.`)],
      });
    }

    const online = st.online && st.players.list.some((p) => p.toLowerCase() === profile.name.toLowerCase());
    const embed = new EmbedBuilder()
      .setColor(online ? 0x4ee6a4 : 0x90a5ae)
      .setAuthor({ name: 'Minecraft profile' })
      .setTitle(profile.name)
      .setThumbnail(`https://mc-heads.net/avatar/${profile.uuid}/128`)
      .addFields(
        { name: 'UUID', value: `\`${profile.uuid}\``, inline: false },
        { name: 'Status', value: online ? '🟢 Online now' : '⚪ Offline / not in the visible list', inline: true },
        { name: 'Server', value: `\`${address()}\``, inline: true },
      )
      .setFooter({ text: 'Profile: Mojang · presence: live server ping' })
      .setTimestamp();

    const row = linkRow({ rules: false, support: false });
    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  },

  async ip(interaction) {
    await interaction.deferReply();
    const st = await getServerStatus();
    const embed = brandEmbed('🌐 How to join', `**Java:** \`${address()}\`\n**Bedrock:** \`${address()}\` with port \`${config.mc.bedrockPort}\``)
      .addFields(
        { name: 'Status', value: st.online ? '🟢 Online' : '🔴 Offline', inline: true },
        { name: 'Version', value: st.version ? String(st.version) : '1.21.x', inline: true },
        { name: 'Players', value: st.online ? `${st.players.online} / ${st.players.max}` : '—', inline: true },
      );
    await interaction.editReply({ embeds: [embed], components: [linkRow({ rules: false })] });
  },

  async rules(interaction) {
    await interaction.reply({ embeds: [rulesEmbed()], components: [linkRow({ rules: false, support: false })] });
  },

  async help(interaction) {
    const embed = brandEmbed(
      '🧭 Supernova commands',
      `Everything you need for **${config.brand.name}**. Server address: \`${address()}\`.`,
    ).addFields(
      {
        name: '🎮 Minecraft',
        value: [
          '`/server` — full server panel',
          '`/status` — live status + latency',
          '`/players` — who is online',
          '`/player <username>` — UUID + presence',
          '`/ip` — Java and Bedrock details',
        ].join('\n'),
      },
      {
        name: '📜 Community',
        value: ['`/rules` — the short rules', '`/suggest <idea>` — post an idea', '`/help` — this message'].join('\n'),
      },
      {
        name: '👤 Member tools',
        value: ['`/ping` — bot latency', '`/membercount` — member totals', '`/userinfo [user]` — account + roles', '`/avatar [user]` — avatar image'].join('\n'),
      },
      {
        name: '🛡️ Staff',
        value: ['`/announce` — branded announcement', '`/ticketpanel` — post the ticket panel', '`/statuspanel` — refresh the status board', '`/suggest-review` — approve or deny an idea'].join('\n'),
      },
      {
        name: '🔐 Whitelist',
        value: `The whitelist is handled by the existing system, unchanged. Use the button below.`,
      },
    );

    await interaction.reply({ embeds: [embed], components: [linkRow({ rules: false, support: false })] });
  },

  async ping(interaction) {
    const roundtrip = Date.now() - interaction.createdTimestamp;
    const embed = brandEmbed('🏓 Pong', `**Gateway:** ${Math.max(0, Math.round(interaction.client.ws.ping))} ms\n**Round-trip:** ${roundtrip} ms`)
      .setColor(roundtrip < 250 ? 0x4ee6a4 : 0xf6c66a);
    await interaction.reply({ embeds: [embed] });
  },

  async membercount(interaction) {
    if (!guildOnly(interaction)) return;
    await interaction.deferReply();
    const guild = interaction.guild;

    let members = guild.members.cache;
    if (members.size < guild.memberCount - 5) {
      members = await guild.members.fetch().catch(() => members);
    }

    const total = guild.memberCount;
    const bots = members.filter((m) => m.user.bot).size;
    const humans = Math.max(0, members.size - bots);

    const embed = brandEmbed('👥 Member count', `**${guild.name}**`)
      .addFields(
        { name: 'All members', value: String(total), inline: true },
        { name: 'Humans', value: String(humans), inline: true },
        { name: 'Bots', value: String(bots), inline: true },
      )
      .setFooter({ text: 'Counts come from the Discord member cache' });
    await interaction.editReply({ embeds: [embed] });
  },

  async userinfo(interaction) {
    if (!guildOnly(interaction)) return;
    await interaction.deferReply();
    let member = interaction.options.getMember('user');
    if (!member) member = interaction.member;
    if (!member) member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      return interaction.editReply({ embeds: [brandEmbed('Member not found', 'I could not resolve that member.')] });
    }

    const roles = [...member.roles.cache.values()].filter((r) => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position);
    const embed = new EmbedBuilder()
      .setColor(member.displayColor || 0x4ee6a4)
      .setTitle(member.user.tag)
      .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
      .addFields(
        { name: 'Display name', value: member.displayName, inline: true },
        { name: 'User ID', value: `\`${member.id}\``, inline: true },
        { name: 'Bot', value: member.user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Joined', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : '—' },
        { name: 'Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F> (<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>)` },
        {
          name: `Roles (${roles.length})`,
          value: roles.length ? roles.slice(0, 20).map((r) => `<@&${r.id}>`).join(' ').slice(0, 1024) : 'None',
        },
      )
      .setFooter({ text: config.brand.name })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },

  async avatar(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const embed = brandEmbed(`${user.username}’s avatar`, `[Open full size](${user.displayAvatarURL({ extension: 'png', size: 1024 })})`)
      .setImage(user.displayAvatarURL({ extension: 'png', size: 1024 }));
    await interaction.reply({ embeds: [embed] });
  },

  async suggest(interaction) {
    if (!guildOnly(interaction)) return;
    const idea = interaction.options.getString('idea', true).trim();
    await postSuggestion(interaction, idea);
  },

  async announce(interaction) {
    if (!assertStaff(interaction)) return;

    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const image = interaction.options.getString('image') || '';
    const ping = interaction.options.getString('ping') || 'none';
    const label = interaction.options.getString('button_label') || '';
    const buttonUrl = interaction.options.getString('button_url') || '';

    if (image && !urlOk(image)) {
      return interaction.reply({ embeds: [brandEmbed('Invalid image URL', 'Use a full http(s) image link.')], ephemeral: true });
    }
    if (buttonUrl && !urlOk(buttonUrl)) {
      return interaction.reply({ embeds: [brandEmbed('Invalid button URL', 'Use a full http(s) link.')], ephemeral: true });
    }

    const embed = brandEmbed(`📢 ${title}`, description)
      .setFooter({ text: `${config.brand.name} · announcement by ${interaction.user.tag}` });
    if (image) embed.setImage(image);

    const components = [];
    if (buttonUrl) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(label || 'Open link')
            .setStyle(ButtonStyle.Link)
            .setURL(buttonUrl),
        ),
      );
    }

    const content = ping === 'everyone' ? '@everyone' : ping === 'here' ? '@here' : '';
    await interaction.reply({
      content: content || undefined,
      embeds: [embed],
      components,
      allowedMentions: ping === 'none' ? { parse: [] } : { parse: ['everyone'] },
    });
  },

  async ticketpanel(interaction) {
    if (!assertStaff(interaction)) return;
    if (!guildOnly(interaction)) return;

    const chosen = interaction.options.getChannel('channel');
    const channelId = chosen?.id || config.channels.ticketPanel || interaction.channelId;
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
      return interaction.reply({ embeds: [brandEmbed('Channel unavailable', 'Pick a text channel or set `TICKET_PANEL_CHANNEL_ID`.')], ephemeral: true });
    }

    const panel = await postTicketPanel(channel);
    await interaction.reply({ embeds: [brandEmbed('Ticket panel posted', `Live in <#${channel.id}>: ${panel.url}`)], ephemeral: true });
  },

  async statuspanel(interaction) {
    if (!assertStaff(interaction)) return;

    const chosen = interaction.options.getChannel('channel');
    const channelId = chosen?.id || config.channels.status;
    if (!channelId) {
      return interaction.reply({
        embeds: [brandEmbed('No status channel', 'Set `STATUS_CHANNEL_ID` or pass a channel option.')],
        ephemeral: true,
      });
    }

    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
      return interaction.reply({ embeds: [brandEmbed('Channel unavailable', 'Pick a text channel the bot can post in.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const message = await refreshStatusBoard(interaction.client, { force: true, channelId });
    await interaction.editReply({
      embeds: [brandEmbed('Status board ready', message ? `Live in <#${channel.id}>.` : 'Could not post the status board. Check permissions.')],
    });
  },

  async 'suggest-review'(interaction) {
    if (!assertStaff(interaction)) return;
    await reviewSuggestionCommand(interaction);
  },
};

export async function executeCommand(interaction) {
  const handler = handlers[interaction.commandName];
  if (!handler) {
    return interaction.reply({ embeds: [brandEmbed('Unknown command', 'Run `/help` to see what is available.')], ephemeral: true });
  }
  return handler(interaction);
}
