import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { BRAND_COLOR, brandEmbed } from './brand.js';
import {
  createSuggestion,
  getSuggestion,
  reviewSuggestion,
  setSuggestionMessage,
  voteSuggestion,
} from './store.js';

const STATUS = {
  open: { label: 'Open for votes', color: BRAND_COLOR },
  approved: { label: 'Approved', color: 0x4ee6a4 },
  denied: { label: 'Not planned', color: 0xff7d76 },
};

function suggestionEmbed(item) {
  const status = STATUS[item.status] || STATUS.open;
  const embed = new EmbedBuilder()
    .setColor(status.color)
    .setAuthor({ name: `Suggestion #${item.id}` })
    .setTitle('💡 Community suggestion')
    .setDescription(item.text)
    .addFields(
      { name: '👍 Upvotes', value: String(item.up.length), inline: true },
      { name: '👎 Downvotes', value: String(item.down.length), inline: true },
      { name: 'Status', value: status.label, inline: true },
    )
    .setFooter({ text: `Submitted by ${item.authorTag} · ${config.brand.name}` })
    .setTimestamp(new Date(item.createdAt));

  if (item.staffNote) {
    embed.addFields({ name: 'Staff note', value: item.staffNote, inline: false });
  }
  return embed;
}

function suggestionRow(item) {
  const closed = item.status !== 'open';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest:vote:up:${item.id}`)
      .setLabel(`Upvote · ${item.up.length}`)
      .setEmoji('👍')
      .setStyle(ButtonStyle.Success)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId(`suggest:vote:down:${item.id}`)
      .setLabel(`Downvote · ${item.down.length}`)
      .setEmoji('👎')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(closed),
  );
}

export async function postSuggestion(interaction, text) {
  if (!config.channels.suggestions) {
    return interaction.reply({
      embeds: [brandEmbed('Suggestions are not configured', 'Set `SUGGESTION_CHANNEL_ID` in the bot environment.')],
      ephemeral: true,
    });
  }

  const channel = await interaction.client.channels.fetch(config.channels.suggestions).catch(() => null);
  if (!channel?.isTextBased?.()) {
    return interaction.reply({ embeds: [brandEmbed('Suggestions channel unavailable', 'Please tell a staff member.')], ephemeral: true });
  }

  const item = createSuggestion({
    authorId: interaction.user.id,
    authorTag: interaction.user.tag,
    text: String(text).slice(0, 1500),
    channelId: channel.id,
    messageId: null,
  });

  const message = await channel.send({ embeds: [suggestionEmbed(item)], components: [suggestionRow(item)] });
  setSuggestionMessage(item.id, message.id);
  await message.startThread({ name: `Suggestion #${item.id} discussion`, autoArchiveDuration: 1440 }).catch(() => {});

  return interaction.reply({
    embeds: [brandEmbed('Suggestion posted', `Thanks! Vote and discuss here: ${message.url}`)],
    ephemeral: true,
  });
}

export async function handleSuggestionButton(interaction) {
  const [, action, kind, idRaw] = interaction.customId.split(':');
  if (action !== 'vote') return null;

  const item = getSuggestion(Number(idRaw));
  if (!item) {
    return interaction.reply({ embeds: [brandEmbed('Suggestion not found', 'This suggestion is no longer stored.')], ephemeral: true });
  }
  if (item.status !== 'open') {
    return interaction.reply({ embeds: [brandEmbed('Voting closed', 'Staff have already reviewed this suggestion.')], ephemeral: true });
  }

  const result = voteSuggestion(item.id, interaction.user.id, kind);
  if (!result?.changed) {
    return interaction.reply({ embeds: [brandEmbed('Vote not counted', 'Try again in a moment.')], ephemeral: true });
  }

  return interaction.update({
    embeds: [suggestionEmbed(result.item)],
    components: [suggestionRow(result.item)],
  });
}

export async function reviewSuggestionCommand(interaction) {
  const id = interaction.options.getInteger('id', true);
  const status = interaction.options.getString('status', true);
  const note = interaction.options.getString('note') || '';

  const item = reviewSuggestion(id, status, note);
  if (!item) {
    return interaction.reply({ embeds: [brandEmbed('Suggestion not found', `No stored suggestion with id ${id}.`)], ephemeral: true });
  }

  const channel = await interaction.client.channels.fetch(item.channelId).catch(() => null);
  if (channel?.isTextBased?.()) {
    const message = await channel.messages.fetch(item.messageId).catch(() => null);
    if (message) {
      await message.edit({ embeds: [suggestionEmbed(item)], components: [suggestionRow(item)] }).catch(() => {});
    }
  }

  return interaction.reply({
    embeds: [brandEmbed('Suggestion updated', `#${id} is now **${STATUS[status]?.label || status}**.`)],
    ephemeral: true,
  });
}
