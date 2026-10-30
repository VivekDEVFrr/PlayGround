# Bot setup

## 1. Create / reuse the Discord application

1. Open <https://discord.com/developers/applications>.
2. Select your existing bot application (or create one).
3. **Bot → Privileged Gateway Intents:** enable **Server Members Intent**.
   - Required for `guildMemberAdd` (welcome) and member counts.
   - Message Content is **not** required.
4. Copy the **Bot Token** into `DISCORD_TOKEN`.
5. Copy the **Application ID** into `DISCORD_CLIENT_ID`.

## 2. Invite the bot

Scopes: `bot` + `applications.commands`.

Permissions used:

- View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Manage Channels (ticket channels)
- Manage Roles (channel permission overwrites)
- Mention Everyone (`/announce` pings)
- Manage Messages
- Create Public Threads + Send Messages in Threads (suggestion discussion)
- Add Reactions

Permission integer: **`309506337872`**

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=309506337872&scope=bot%20applications.commands
```

Administrator is **not** required.

## 3. Configure channels

Right-click a channel → **Copy Channel ID** (enable Developer Mode in Discord settings).

| Variable | Where it is used |
| --- | --- |
| `WELCOME_CHANNEL_ID` | Welcome embed + card on join |
| `RULES_CHANNEL_ID` | Linked in welcome, `/rules`, `/server` |
| `STATUS_CHANNEL_ID` | Auto-updating status board (one message, edited in place) |
| `TICKET_PANEL_CHANNEL_ID` | Where `/ticketpanel` posts by default |
| `TICKET_LOG_CHANNEL_ID` | Closed-ticket logs + transcript `.txt` |
| `TICKET_CATEGORY_ID` | Optional category for new ticket channels |
| `SUGGESTION_CHANNEL_ID` | Where `/suggest` posts |

Roles:

```env
STAFF_ROLE_IDS=123456789012345678,234567890123456789
```

Members with **Manage Server** always count as staff. The role list adds more staff without granting Discord permissions.

## 4. Register commands

```bash
cd bot
cp .env.example .env
# fill DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID, channels, roles
npm install
npm run deploy
npm start
```

`GUILD_ID` is strongly recommended during setup — guild commands update instantly.

## 5. One-time channel setup

As a staff member:

1. In `#tickets`, run `/ticketpanel`.
2. In `#server-status` (or your status channel), run `/statuspanel`.
3. Post the rules in `#rules` and set `RULES_CHANNEL_ID`.

The status board is edited in place on every refresh (default 60 seconds, minimum 30) and survives restarts via `bot/data/state.json`.

## 6. Feature tour

### Welcome

On join, the bot posts a generated 960×360 card (if `@napi-rs/canvas` installed), an embed with the member mention, member number, join steps and IP, plus buttons:

- 🎮 Server Info (ephemeral panel)
- 📜 Rules (ephemeral)
- 🔐 Whitelist (**link to your existing flow**)
- 💬 Support (opens a General ticket)

If `WELCOME_DM=true`, it also tries to DM a compact welcome. DMs can be disabled by the user; failures are ignored.

If canvas is unavailable, the welcome still sends without the image.

### Status board

- One message per channel, edited rather than re-posted.
- Uses a 15-second in-memory cache (configurable `MC_CACHE_TTL_MS`).
- Only edits when the signature changes, or every 5 minutes, to respect rate limits.
- Sets the bot presence to the current player count.
- Offline servers are shown as offline — not hidden.

### Tickets

Panel categories: 🎮 General Support, 🔐 Whitelist Help, 🐛 Bug Report, 🚨 Player Report, 💡 Other.

- One open ticket per member (detected via channel topic).
- Private channel with owner + staff roles.
- **Claim** (staff only) and **Close** buttons.
- Closing saves a transcript to `TICKET_LOG_CHANNEL_ID`, then deletes the channel after 5 seconds.
- Transcript = last 200 messages, plain text.

### Suggestions

`/suggest` posts an embed with 👍/👎 buttons and starts a discussion thread.

- Votes persist in `bot/data/suggestions.json`.
- One vote per member per direction; clicking again removes it.
- Staff review with `/suggest-review id:<n> status:<approved|denied> note:<optional>`.
- Reviewed suggestions lock their vote buttons and show the staff note.

### Announcements

`/announce` supports title, body, optional image, optional `@everyone`/`@here`, and an optional link button. Staff-only via default permissions **and** a runtime role check.

## 7. Test checklist

- [ ] `npm run deploy` reports 16 commands.
- [ ] `/help` responds; `/server` shows the correct IP.
- [ ] `/status` shows online/offline and player count.
- [ ] `/player Notch` returns a UUID.
- [ ] Join with an alt → welcome card appears; all four buttons work.
- [ ] `/ticketpanel` → open a ticket, claim it, close it, confirm the log + transcript.
- [ ] `/suggest` → vote, switch vote, remove vote; `/suggest-review` locks it.
- [ ] `/announce` as a normal member is hidden/rejected; as staff it posts.
- [ ] Status board edits the same message after a minute.
- [ ] Stop the Minecraft server → dashboard and bot both show **Offline** (not an error).

## 8. Whitelist boundary

This bot deliberately has **no whitelist command, no whitelist storage and no approval logic**. `/help` and the welcome buttons only link to `WHITELIST_URL`. Adding this bot alongside your current whitelist code cannot rename, replace or migrate anything. See [WHITELIST-PROTECTION.md](WHITELIST-PROTECTION.md).
