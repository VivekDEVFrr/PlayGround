import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { BRAND_COLOR, address } from './brand.js';
import { buildWelcomeCard } from './welcome-card.js';

function welcomeEmbed(member) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: config.brand.name.toUpperCase() })
    .setTitle(`Welcome to ${config.brand.name}, ${member.displayName}!`)
    .setDescription(
      `Hey <@${member.id}> — you're member **#${member.guild.memberCount}**. We're glad you're here.\n\n` +
        '**Getting started**\n' +
        '› Read the rules and say hi in chat.\n' +
        '› Get through the existing whitelist flow (button below).\n' +
        `› Connect to \`${address()}\` and start building.`,
    )
    .addFields(
      { name: 'Minecraft', value: `\`${address()}\``, inline: true },
      { name: 'Bedrock', value: `\`${config.mc.bedrockPort}\``, inline: true },
      { name: 'Version', value: 'Java 1.21.x', inline: true },
    )
    .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
    .setFooter({ text: `${config.brand.name} · Season III` })
    .setTimestamp();

  if (config.channels.rules) {
    embed.addFields({ name: 'Rules', value: `<#${config.channels.rules}>`, inline: true });
  }
  return embed;
}

function welcomeButtons() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('welcome:server').setLabel('Server Info').setEmoji('🎮').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('welcome:rules').setLabel('Rules').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel('Whitelist').setEmoji('🔐').setStyle(ButtonStyle.Link).setURL(config.links.whitelist),
    new ButtonBuilder().setCustomId('welcome:support').setLabel('Support').setEmoji('💬').setStyle(ButtonStyle.Primary),
  );
  return row;
}

export async function sendWelcome(member) {
  const channelId = config.channels.welcome;
  if (!channelId) {
    console.warn('[welcome] WELCOME_CHANNEL_ID not set — skipping welcome message');
    return;
  }

  const channel = await member.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) {
    console.warn('[welcome] welcome channel not found or not text-based');
    return;
  }

  const card = await buildWelcomeCard({
    username: member.displayName,
    memberCount: member.guild.memberCount,
    user: member.user,
  }).catch(() => null);

  const files = card ? [new AttachmentBuilder(card, { name: 'welcome.png' })] : [];
  const embed = welcomeEmbed(member);
  if (card) embed.setImage('attachment://welcome.png');

  await channel.send({
    content: `<@${member.id}>`,
    embeds: [embed],
    components: [welcomeButtons()],
    files,
    allowedMentions: { users: [member.id] },
  });

  if (config.welcomeDm) {
    await member
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND_COLOR)
            .setTitle(`Welcome to ${config.brand.name}!`)
            .setDescription(
              `You're in. Connect with \`${address()}\` (Java) or port \`${config.mc.bedrockPort}\` (Bedrock).\n\n` +
                `Rules: ${config.channels.rules ? `<#${config.channels.rules}>` : 'see the server'}\n` +
                `Whitelist: ${config.links.whitelist}`,
            )
            .setFooter({ text: config.brand.name }),
        ],
        files,
      })
      .catch(() => {});
  }
}
