# Supernova SMP — Discord + Web Ecosystem

A premium Discord bot and web dashboard for **Supernova SMP** (`tarzan.supernovaa.in:25509`, Pterodactyl-hosted).

> **Whitelist guarantee:** this repository does **not** contain a whitelist implementation and never writes to yours. Existing whitelist commands, permissions, storage and approval flow are untouched. The only integration is a read-only summary endpoint plus links to your existing flow. See [docs/WHITELIST-PROTECTION.md](docs/WHITELIST-PROTECTION.md).

---

## What is included

| Part | Path | What it does |
| --- | --- | --- |
| Dashboard | `index.html`, `assets/` | Six responsive pages: Overview, Players, Server, Whitelist, Support, Admin |
| API | `server/` | Read-only Minecraft ping, player lookup, optional Pterodactyl proxy, admin auth |
| Discord bot | `bot/` | Welcome, status board, tickets, suggestions, announcements, community + staff commands |

The dashboard runs on its **own port (default `3001`)**. The Minecraft port `25509` is a game port and is never treated as HTTP.

## Quick start

### 1. Dashboard + API

```bash
cd server
cp .env.example .env
npm install
npm start
```

Open <http://localhost:3001>. The API also serves the static dashboard, so one process is enough.

### 2. Discord bot

```bash
cd bot
cp .env.example .env
npm install
npm run deploy     # register slash commands
npm start
```

Without `DISCORD_TOKEN`, the dashboard still works and clearly labels sample data as **Demo data**.

## Configuration

Copy the example files — never commit `.env`:

- [`bot/.env.example`](bot/.env.example) — token, channels, roles, links
- [`server/.env.example`](server/.env.example) — port, Minecraft host, admin token, optional Pterodactyl
- [`.env.example`](.env.example) — combined reference for hosting panels

Key values:

| Variable | Purpose |
| --- | --- |
| `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` | Bot login + slash command registration |
| `GUILD_ID` | Register commands instantly in one guild (recommended) |
| `WELCOME_CHANNEL_ID`, `RULES_CHANNEL_ID` | Onboarding + rules channels |
| `STATUS_CHANNEL_ID`, `STATUS_INTERVAL_SECONDS` | Auto-updating status board (min 30s) |
| `STAFF_ROLE_IDS` | Comma-separated staff roles, in addition to Manage Server |
| `TICKET_PANEL_CHANNEL_ID`, `TICKET_LOG_CHANNEL_ID`, `TICKET_CATEGORY_ID` | Tickets + transcripts |
| `SUGGESTION_CHANNEL_ID` | Where `/suggest` posts |
| `WHITELIST_URL` | Link to your **existing** whitelist flow (link only) |
| `DASHBOARD_PORT` | Dashboard/API port (not `25509`) |
| `DASHBOARD_ADMIN_TOKEN` | Bearer token for admin routes; empty disables admin |
| `DASHBOARD_ORIGIN` | Comma-separated allowed origins when API and dashboard are split |
| `PTERODACTYL_URL`, `PTERODACTYL_TOKEN`, `PTERODACTYL_SERVER_ID` | Optional resource usage + power controls |
| `WHITELIST_STATUS_URL` | Optional **GET-only** summary endpoint; never writes |

Generate a strong admin token:

```bash
openssl rand -hex 32
```

## Commands

**Public:** `/server` `/status` `/players` `/player <username>` `/ip` `/rules` `/help` `/ping` `/membercount` `/userinfo` `/avatar` `/suggest`

**Staff-only:** `/announce` `/ticketpanel` `/statuspanel` `/suggest-review`

Discord hides staff commands from members via default permissions, and every handler re-checks roles server-side.

## Dashboard

- **Overview** — live status, player ring, quick actions, online players, server info, join steps
- **Players** — username lookup (Mojang UUID + presence) and live roster
- **Server** — ping, latency, version, connection details, 24h player chart, optional Pterodactyl resources
- **Whitelist** — explains the protected boundary and links out; optional read-only counts
- **Support** — ticket categories, rules and FAQ
- **Admin** — token-gated Pterodactyl resources and start/stop/restart

The dashboard polls `/api/status` every 30 seconds with a 15-second server cache and in-flight de-duplication. It never pings the Minecraft server from the browser.

## Documentation

- [Deployment](docs/DEPLOYMENT.md) — Pterodactyl, VPS, Nginx, systemd/PM2
- [Bot setup](docs/BOT-SETUP.md) — intents, invite URL, channels, testing
- [Security](docs/SECURITY.md) — secrets, auth, CORS, rate limits, CSP
- [Whitelist protection](docs/WHITELIST-PROTECTION.md) — exact boundary and optional read-only bridge
- [API reference](docs/API.md) — endpoints and response shapes

## Security summary

- Secrets only in `.env`; `.env` is git-ignored.
- Pterodactyl token never leaves the API process and is never returned to the browser.
- Admin routes require a constant-time bearer token check; empty token disables them.
- Rate limits: global, player lookup, whitelist summary and admin routes.
- Helmet CSP, strict CORS allow-list, 16 KB JSON limit, input validation, generic error responses.
- Static serving is allow-listed to `index.html`, `/assets`, `/vendor` — `.env` and source folders are not exposed.

## Architecture

```
Browser ──HTTPS──> server/ (Express, :3001) ──TCP ping──> Minecraft :25509
                      │
                      ├── Mojang profile API (player lookup)
                      ├── Pterodactyl client API (optional, server-side only)
                      └── WHITELIST_STATUS_URL (optional, GET only)

Discord ──gateway──> bot/ (discord.js) ──TCP ping──> Minecraft :25509
```

---

<sub>Built for Supernova SMP. Not affiliated with Mojang Studios or Microsoft.</sub>
