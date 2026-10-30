import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';

export const BRAND_COLOR = config.brand.color;

export const RULES = [
  { title: 'Build, don’t bulldoze.', text: 'No griefing or stealing, claimed or not.' },
  { title: 'Play fair.', text: 'No x-ray, auto-clickers, duping or alt farming.' },
  { title: 'Keep chat human.', text: 'Banter yes, harassment no.' },
  { title: 'Trade honestly.', text: 'Agree the price in chat before you hand anything over.' },
  { title: 'One person, one account.', text: 'Alts for storage need staff approval.' },
];

export const address = () => `${config.mc.host}:${config.mc.port}`;

export function brandEmbed(title, description) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setFooter({ text: `${config.brand.name} · ${address()}` })
    .setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(message) {
  return brandEmbed('Something went wrong', message).setColor(0xff7d76);
}

export function rulesEmbed() {
  const embed = brandEmbed(
    '📜 Server rules',
    'The short version. Staff always have the final call — open a ticket if something is unclear.',
  );
  for (const rule of RULES) {
    embed.addFields({ name: rule.title, value: rule.text, inline: false });
  }
  if (config.channels.rules) embed.addFields({ name: 'Full rules', value: `<#${config.channels.rules}>`, inline: true });
  return embed;
}

export function linkRow({ whitelist = true, rules = true, support = true } = {}) {
  const row = new ActionRowBuilder();
  if (whitelist) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('🔐 Whitelist')
        .setStyle(ButtonStyle.Link)
        .setURL(config.links.whitelist),
    );
  }
  if (rules && config.links.rules) {
    row.addComponents(
      new ButtonBuilder().setLabel('📜 Rules').setStyle(ButtonStyle.Link).setURL(config.links.rules),
    );
  }
  if (support && config.links.support) {
    row.addComponents(
      new ButtonBuilder().setLabel('💬 Support').setStyle(ButtonStyle.Link).setURL(config.links.support),
    );
  }
  return row;
}

export function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageGuild)) return true;
  if (!config.staffRoleIds.length) return false;
  return config.staffRoleIds.some((id) => member.roles?.cache?.has?.(id));
}

export function assertStaff(interaction) {
  if (isStaff(interaction.member)) return true;
  interaction.reply({
    embeds: [errorEmbed('This command is for staff only.')],
    ephemeral: true,
  });
  return false;
}
