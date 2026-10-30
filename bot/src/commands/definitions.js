import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

const staffOnly = (builder) => builder.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const commands = [
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Server panel: status, address, version and links'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Live online/offline status, player count and latency'),

  new SlashCommandBuilder()
    .setName('players')
    .setDescription('List the players online right now'),

  new SlashCommandBuilder()
    .setName('player')
    .setDescription('Look up a Minecraft account (UUID + online status)')
    .addStringOption((opt) =>
      opt.setName('username').setDescription('Minecraft username').setRequired(true).setMinLength(3).setMaxLength(16),
    ),

  new SlashCommandBuilder()
    .setName('ip')
    .setDescription('Show the Java and Bedrock connection details'),

  new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Read the short version of the server rules'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('List every Supernova command'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot and gateway latency'),

  new SlashCommandBuilder()
    .setName('membercount')
    .setDescription('Show total members, humans and bots'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show account, join date and roles for a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to inspect (defaults to you)')),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Show a member’s avatar')
    .addUserOption((opt) => opt.setName('user').setDescription('Member (defaults to you)')),

  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit an idea for the server')
    .addStringOption((opt) =>
      opt.setName('idea').setDescription('Describe your suggestion').setRequired(true).setMinLength(10).setMaxLength(1500),
    ),

  staffOnly(
    new SlashCommandBuilder()
      .setName('announce')
      .setDescription('Post a branded announcement (staff only)')
      .addStringOption((opt) => opt.setName('title').setDescription('Announcement title').setRequired(true).setMaxLength(100))
      .addStringOption((opt) =>
        opt.setName('description').setDescription('Announcement body').setRequired(true).setMaxLength(2000),
      )
      .addStringOption((opt) => opt.setName('image').setDescription('Optional image URL (https://…)'))
      .addStringOption((opt) =>
        opt
          .setName('ping')
          .setDescription('Who to ping')
          .addChoices(
            { name: 'Nobody', value: 'none' },
            { name: '@everyone', value: 'everyone' },
            { name: '@here', value: 'here' },
          ),
      )
      .addStringOption((opt) => opt.setName('button_label').setDescription('Optional link button label').setMaxLength(80))
      .addStringOption((opt) => opt.setName('button_url').setDescription('Optional link button URL (https://…)')),
  ),

  staffOnly(
    new SlashCommandBuilder()
      .setName('ticketpanel')
      .setDescription('Post the ticket panel (staff only)')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Where to post the panel')),
  ),

  staffOnly(
    new SlashCommandBuilder()
      .setName('statuspanel')
      .setDescription('Create or refresh the auto-updating status message (staff only)')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Where to post the status board')),
  ),

  staffOnly(
    new SlashCommandBuilder()
      .setName('suggest-review')
      .setDescription('Approve or deny a stored suggestion (staff only)')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('Suggestion number').setRequired(true).setMinValue(1),
      )
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('New status')
          .setRequired(true)
          .addChoices(
            { name: 'Approved', value: 'approved' },
            { name: 'Denied', value: 'denied' },
          ),
      )
      .addStringOption((opt) => opt.setName('note').setDescription('Optional staff note').setMaxLength(300)),
  ),
].map((c) => c.toJSON());
