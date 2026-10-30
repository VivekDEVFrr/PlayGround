import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config.js';
import { BRAND_COLOR, brandEmbed, isStaff } from './brand.js';

export const TICKET_CATEGORIES = {
  general: { label: 'General Support', emoji: '🎮', blurb: 'Stuck, confused, or something looks broken?' },
  whitelist: { label: 'Whitelist Help', emoji: '🔐', blurb: 'Questions about your existing whitelist application.' },
  bug: { label: 'Bug Report', emoji: '🐛', blurb: 'Lag, lost items, or a plugin misbehaving.' },
  report: { label: 'Player Report', emoji: '🚨', blurb: 'Griefing, cheating or harassment.' },
  other: { label: 'Other', emoji: '💡', blurb: 'Suggestions, partnerships, anything else.' },
};

export function ticketPanelEmbed() {
  const embed = brandEmbed(
    '🎫 Need a hand?',
    'Pick the category that fits best and a private channel will be created for you and the staff team.\n\n' +
      Object.values(TICKET_CATEGORIES)
        .map((c) => `${c.emoji} **${c.label}** — ${c.blurb}`)
        .join('\n'),
  );
  embed.setFooter({ text: 'One open ticket per member · Staff will reply as soon as they can' });
  return embed;
}

export function ticketPanelRow() {
  const row = new ActionRowBuilder();
  for (const [key, cat] of Object.entries(TICKET_CATEGORIES)) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:open:${key}`)
        .setLabel(`${cat.emoji} ${cat.label}`)
        .setStyle(ButtonStyle.Secondary),
    );
  }
  return row;
}

export async function postTicketPanel(channel) {
  if (!channel?.isTextBased?.()) throw new Error('Ticket panel channel is not a text channel');
  return channel.send({ embeds: [ticketPanelEmbed()], components: [ticketPanelRow()] });
}

const safeName = (name) => String(name || 'member').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'member';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findOpenTicket(guild, userId) {
  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && typeof c.topic === 'string' && c.topic.includes(`ticket-owner:${userId}`),
  );
}

export async function openTicket(interaction, categoryOverride = null) {
  if (!interaction.inGuild()) {
    return interaction.reply({ embeds: [brandEmbed('Tickets are Discord-only', 'Open a ticket inside the server.')], ephemeral: true });
  }

  const key = categoryOverride || interaction.customId.split(':')[2];
  const category = TICKET_CATEGORIES[key];
  if (!category) return interaction.reply({ embeds: [brandEmbed('Unknown category', 'Please use the ticket panel.')], ephemeral: true });

  const existing = findOpenTicket(interaction.guild, interaction.user.id);
  if (existing) {
    return interaction.reply({
      embeds: [brandEmbed('You already have a ticket open', `Continue in <#${existing.id}> or close it first.`)],
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  for (const roleId of config.staffRoleIds) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  }

  let parent = null;
  if (config.channels.ticketCategory) {
    const found = guild.channels.cache.get(config.channels.ticketCategory);
    if (found?.type === ChannelType.GuildCategory) parent = found.id;
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${safeName(interaction.user.username)}`,
      type: ChannelType.GuildText,
      parent: parent || undefined,
      topic: `ticket-owner:${interaction.user.id} | category:${key} | opened:${Date.now()}`,
      permissionOverwrites: overwrites,
      reason: `Ticket opened by ${interaction.user.tag} (${category.label})`,
    });
  } catch (err) {
    console.error('[tickets] create failed', err?.message);
    return interaction.editReply({
      embeds: [brandEmbed('Could not create the ticket', 'Please check the bot’s Manage Channels permission and try again.')],
    });
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${category.emoji} ${category.label}`)
    .setDescription(
      `Hey <@${interaction.user.id}>, thanks for reaching out. A staff member will be with you shortly.\n\n` +
        '**While you wait**\n' +
        '• Describe the issue with as much detail as you can.\n' +
        '• Add screenshots or coordinates if they help.\n' +
        '• Please do not open duplicate tickets.',
    )
    .setFooter({ text: `${config.brand.name} · ticket #${channel.id.slice(-4)}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Close ticket').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
  await interaction.editReply({ embeds: [brandEmbed('Ticket created', `Your private channel is ready: <#${channel.id}>`)] });
}

function ownerIdFrom(channel) {
  const match = /ticket-owner:(\d+)/.exec(channel?.topic || '');
  return match ? match[1] : null;
}

export async function claimTicket(interaction) {
  const member = interaction.member;
  if (!isStaff(member)) {
    return interaction.reply({ embeds: [brandEmbed('Staff only', 'Only staff can claim tickets.')], ephemeral: true });
  }

  const channel = interaction.channel;
  channel.setTopic(`${channel.topic || ''} | claimed:${interaction.user.id}`.slice(0, 1024)).catch(() => {});

  return interaction.reply({
    embeds: [
      brandEmbed('Ticket claimed', `Handled by <@${interaction.user.id}>. They will reply here shortly.`).setColor(0x7cd0ff),
    ],
  });
}

export async function askCloseTicket(interaction) {
  const channel = interaction.channel;
  const owner = ownerIdFrom(channel);
  const allowed = isStaff(interaction.member) || owner === interaction.user.id;
  if (!allowed) {
    return interaction.reply({ embeds: [brandEmbed('Not your ticket', 'Only the ticket owner or staff can close this.')], ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close:yes').setLabel('Yes, close it').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:close:no').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  return interaction.reply({
    embeds: [brandEmbed('Close this ticket?', 'The channel will be deleted and a transcript saved to the staff log.')],
    components: [row],
    ephemeral: true,
  });
}

async function buildTranscript(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 200 });
    const lines = [...messages.values()]
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map((m) => {
        const body = m.content || (m.embeds.length ? '[embed]' : m.attachments.size ? '[attachment]' : '');
        return `[${m.createdAt.toISOString()}] ${m.author.tag}: ${body}`;
      });
    return lines.join('\n') || 'No messages.';
  } catch {
    return 'Transcript unavailable (missing message history permission).';
  }
}

export async function closeTicket(interaction, confirmed) {
  const channel = interaction.channel;
  const owner = ownerIdFrom(channel);

  if (!confirmed) {
    return interaction.update({
      embeds: [brandEmbed('Cancelled', 'The ticket stays open.')],
      components: [],
    });
  }

  if (!isStaff(interaction.member) && owner !== interaction.user.id) {
    return interaction.reply({ embeds: [brandEmbed('Not allowed', 'Only the owner or staff can close this ticket.')], ephemeral: true });
  }

  await interaction.update({
    embeds: [brandEmbed('Closing ticket', 'Saving a transcript and deleting this channel in 5 seconds…')],
    components: [],
  });

  const transcript = await buildTranscript(channel);
  const catKey = /category:(\w+)/.exec(channel.topic || '')?.[1];
  const cat = TICKET_CATEGORIES[catKey];

  if (config.channels.ticketLog) {
    const logChannel = await interaction.client.channels.fetch(config.channels.ticketLog).catch(() => null);
    if (logChannel?.isTextBased?.()) {
      const embed = brandEmbed(
        '🎫 Ticket closed',
        [
          `**Channel:** #${channel.name}`,
          `**Category:** ${cat ? `${cat.emoji} ${cat.label}` : 'unknown'}`,
          `**Owner:** <@${owner || 'unknown'}>`,
          `**Closed by:** <@${interaction.user.id}>`,
          `**Opened:** ${channel.createdAt ? `<t:${Math.floor(channel.createdAt.getTime() / 1000)}:R>` : 'unknown'}`,
        ].join('\n'),
      );
      const file = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `transcript-${channel.name}.txt` });
      await logChannel.send({ embeds: [embed], files: [file] }).catch(() => {});
    }
  }

  await sleep(5000);
  await channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => {});
}

export async function handleTicketButton(interaction) {
  const parts = interaction.customId.split(':');
  if (parts[1] === 'open') return openTicket(interaction);
  if (parts[1] === 'claim') return claimTicket(interaction);
  if (parts[1] === 'close' && !parts[2]) return askCloseTicket(interaction);
  if (parts[1] === 'close' && parts[2] === 'yes') return closeTicket(interaction, true);
  if (parts[1] === 'close' && parts[2] === 'no') return closeTicket(interaction, false);
  return null;
}
