import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { BRAND_COLOR, RULES, address } from './brand.js';
import { getServerStatus } from './mc.js';
import { getState, setState } from './store.js';

const CHECK = (st) => (st.online ? '🟢 Online' : '🔴 Offline');

export function statusEmbed(st, { board = false } = {}) {
  const embed = new EmbedBuilder()
    .setColor(st.online ? BRAND_COLOR : 0xff7d76)
    .setAuthor({ name: config.brand.name.toUpperCase() })
    .setTitle(`${CHECK(st)} · ${address()}`)
    .setTimestamp(new Date(st.checkedAt || Date.now()));

  if (st.motd) embed.setDescription(`*${st.motd.replace(/\n/g, ' ').slice(0, 220)}*`);

  embed.addFields(
    {
      name: 'Players',
      value: st.online ? `**${st.players.online}** / ${st.players.max || '?'}` : '—',
      inline: true,
    },
    { name: 'Version', value: st.version ? String(st.version) : '—', inline: true },
    { name: 'Latency', value: st.latencyMs != null ? `${st.latencyMs} ms` : '—', inline: true },
  );

  if (st.online && st.players.list.length) {
    const names = st.players.list.slice(0, board ? 24 : 40).join(', ');
    embed.addFields({
      name: `Online now (${st.players.list.length}${st.players.online > st.players.list.length ? ' visible' : ''})`,
      value: names.slice(0, 1000),
      inline: false,
    });
  } else if (st.online) {
    embed.addFields({ name: 'Online now', value: 'Nobody is on the server right now.', inline: false });
  }

  embed.addFields({
    name: 'How to join',
    value: `\`${address()}\`\nBedrock port: \`${config.mc.bedrockPort}\``,
    inline: false,
  });

  embed.setFooter({
    text: board ? `Auto status · refreshes every ${config.statusIntervalSeconds}s` : `${config.brand.name} · live ping`,
  });
  return embed;
}

export function serverPanelEmbed(st) {
  const embed = statusEmbed(st, { board: false });
  embed.setTitle('🌌 Supernova SMP');
  embed.setDescription(
    (st.motd ? `*${st.motd.replace(/\n/g, ' ').slice(0, 200)}*\n\n` : '') +
      'A cozy survival world, three seasons deep. Java + Bedrock crossplay, land claims and a player-run economy.',
  );
  embed.addFields(
    { name: 'Address', value: `\`${address()}\``, inline: true },
    { name: 'Bedrock', value: `\`${config.mc.bedrockPort}\``, inline: true },
    { name: 'Discord', value: config.links.invite ? `[Join here](${config.links.invite})` : '—', inline: true },
  );
  return embed;
}

export function panelButtons() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('panel:server').setLabel('Server info').setEmoji('🎮').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('panel:rules').setLabel('Rules').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('Whitelist')
      .setEmoji('🔐')
      .setStyle(ButtonStyle.Link)
      .setURL(config.links.whitelist),
  );
  if (config.links.support) {
    row.addComponents(
      new ButtonBuilder().setLabel('Support').setEmoji('💬').setStyle(ButtonStyle.Link).setURL(config.links.support),
    );
  }
  return row;
}

export function rulesPanelEmbed() {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📜 Server rules')
    .setDescription('Five rules, no fine print. Staff always have the final call.')
    .setFooter({ text: config.brand.name })
    .setTimestamp();
  for (const rule of RULES) {
    embed.addFields({ name: rule.title, value: rule.text });
  }
  return embed;
}

function signature(st) {
  return JSON.stringify([
    st.online,
    st.players.online,
    st.players.max,
    st.version,
    st.players.list.slice(0, 24),
  ]);
}

async function resolveChannel(client, channelId = config.channels.status) {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return null;
  return channel;
}

let lastSignature = '';
let lastEdit = 0;

export async function refreshStatusBoard(client, { force = false, channelId } = {}) {
  const channel = await resolveChannel(client, channelId);
  if (!channel) return null;

  const st = await getServerStatus({ force });
  client.user?.setPresence({
    activities: [{ name: st.online ? `${st.players.online}/${st.players.max} players` : 'the server wake up', type: 3 }],
    status: st.online ? 'online' : 'idle',
  }).catch?.(() => {});
  const sig = signature(st);
  const now = Date.now();

  let message = null;
  const stored = getState(`statusMessage:${channel.id}`);

  if (stored) {
    message = await channel.messages.fetch(stored).catch(() => null);
  }

  if (!message) {
    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (recent) {
      message = recent.find(
        (m) =>
          m.author.id === client.user.id &&
          m.embeds.length &&
          typeof m.embeds[0]?.footer?.text === 'string' &&
          m.embeds[0].footer.text.includes('Auto status'),
      );
    }
  }

  if (message) {
    if (!force && sig === lastSignature && now - lastEdit < 5 * 60 * 1000) return message;
    message = await message.edit({ embeds: [statusEmbed(st, { board: true })] }).catch(() => null);
    if (message) setState(`statusMessage:${channel.id}`, message.id);
    lastSignature = sig;
    lastEdit = now;
    return message;
  }

  message = await channel.send({ embeds: [statusEmbed(st, { board: true })] });
  setState(`statusMessage:${channel.id}`, message.id);
  lastSignature = sig;
  lastEdit = now;
  return message;
}

export function startStatusLoop(client) {
  if (!config.channels.status) {
    console.warn('[status] STATUS_CHANNEL_ID not set — auto status board disabled');
    return () => {};
  }

  let stopped = false;
  let timer = null;

  const tick = async () => {
    if (stopped) return;
    try {
      await refreshStatusBoard(client);
    } catch (err) {
      console.error('[status] refresh failed', err?.message);
    }
    if (!stopped) timer = setTimeout(tick, config.statusIntervalSeconds * 1000);
  };

  timer = setTimeout(tick, 3000);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
