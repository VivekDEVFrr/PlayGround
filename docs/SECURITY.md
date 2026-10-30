# Security

This project handles a Discord bot token, an optional Pterodactyl key and an admin token. None of them may ever reach a browser, a log line or Git.

## Secret matrix

| Secret | Lives in | Reaches browser? | Reaches Discord? |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | `bot/.env` | No | No (used for gateway/REST) |
| `DASHBOARD_ADMIN_TOKEN` | `server/.env` | Only what the admin types into the token field (kept in `sessionStorage`) | No |
| `PTERODACTYL_TOKEN` | `server/.env` | **Never** | No |
| `PTERODACTYL_SERVER_ID` | `server/.env` | No (only derived resource numbers are returned) | No |
| `WHITELIST_STATUS_URL` | `server/.env` | No | No |
| Minecraft RCON | not used | — | — |

`.env` files, `node_modules/`, runtime data and build archives are git-ignored. `.env.example` contains placeholders only.

## Dashboard API

### Authentication

- Admin routes (`/api/admin/*`) require `Authorization: Bearer <DASHBOARD_ADMIN_TOKEN>`.
- Comparison is SHA-256 + `timingSafeEqual` (constant time).
- If `DASHBOARD_ADMIN_TOKEN` is empty, admin routes return **503** instead of silently allowing access.
- The token is never logged. Rejections log only the request IP.
- The frontend keeps the token in `sessionStorage` (cleared when the tab closes) and never writes it to disk.

Generate:

```bash
openssl rand -hex 32
```

This is a single shared operator secret, not a per-user account system. For multi-user staff access, put the dashboard behind an identity-aware proxy (Cloudflare Access, Tailscale, VPN) as well.

### Authorization

- Only Pterodactyl `start`, `stop`, `restart` are accepted; the action is validated against an allow-list.
- Power actions are audited with timestamp + action + IP.
- Nothing privileged is available without the token — resources, verify and power all sit behind the same gate.

### Transport & headers

- Helmet sets CSP (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, HSTS.
- Use HTTPS in production. `TRUST_PROXY=1` is correct behind Nginx/Cloudflare; set `0` if directly exposed.
- `express.json({ limit: '16kb' })` caps request bodies.
- Unknown `/api/*` routes return JSON 404; other paths return plain 404.

### CORS

- `DASHBOARD_ORIGIN` is an allow-list, not a wildcard.
- Empty means same-origin only (API serves the dashboard).
- Credentials are not enabled; the admin token travels in the `Authorization` header, not a cookie.

### Rate limits

| Scope | Limit |
| --- | --- |
| General API | 180 requests / minute / IP |
| Player lookup | 30 / minute / IP |
| Whitelist summary | 30 / minute / IP |
| Admin | 30 / minute / IP |

Standard `RateLimit-*` headers are emitted. Tune at the reverse proxy too if the API is public.

### Upstream calls

- Minecraft: TCP handshake only, 5s timeout, 15s cache, in-flight de-duplication. A dashboard refresh storm cannot amplify into the game server.
- Mojang: 6s timeout, 10-minute positive cache, 2-minute negative cache.
- Pterodactyl: 8s timeout, token server-side only.
- Whitelist bridge: **GET only**, 5s timeout, 60s cache. The URL is operator-controlled; never accept a user-supplied URL for this.

This avoids SSRF from user input: no endpoint accepts a URL to fetch.

### Static file exposure

The API does **not** serve the project root. Only `/`, `/index.html`, `/assets/*`, `/vendor/*` and `/favicon.ico` are mounted. `server/.env`, `bot/.env`, `docs/` and source folders are unreachable (verified with a 404 check).

### Error handling

- 4xx messages are safe, human-readable validation errors.
- 5xx responses return `Something went wrong on the server.`; stack traces stay in server logs.
- Upstream secrets, URLs and tokens are never included in responses.

## Discord bot

- Staff commands use `setDefaultMemberPermissions(ManageGuild)` **and** a runtime `isStaff()` check (`ManageGuild` or `STAFF_ROLE_IDS`). Hiding the command is not the only barrier.
- Ticket channels deny `@everyone`, allow the owner, bot and staff roles only.
- Closing a ticket requires owner or staff.
- Suggestion voting is per-user and locked after staff review.
- Announcement image/button URLs are validated as `http(s)` before use.
- Button custom IDs are parsed defensively; unknown IDs get an ephemeral error.
- Errors are caught at the interaction boundary and return a generic message; details go to stderr.
- The bot requests only `Guilds` + `GuildMembers` intents. No message content, no presence.

## Operational checklist

- [ ] `.env` files are not committed (`git status` should not list them).
- [ ] `DASHBOARD_ADMIN_TOKEN` is 32+ random bytes, unique to this deployment.
- [ ] HTTPS terminates at Nginx/Cloudflare; port 3001 is firewalled.
- [ ] Pterodactyl key is a **Client** key limited to the one server, not an Application key.
- [ ] Discord bot role is below staff roles (it cannot manage higher roles).
- [ ] `npm audit` reviewed; Node 20+ patched.
- [ ] Backups include `bot/data/` if suggestion history matters.
- [ ] Tokens rotated immediately if a laptop, zip or log is exposed.
- [ ] Uptime monitor hits `/api/health`, not `/api/status`.

## Known limitations

- Suggestions and the status message pointer use JSON files, suitable for a single bot instance. Do not run two bot processes against the same `data/` directory.
- The admin token is a shared secret; there is no per-user audit identity beyond IP.
- The optional whitelist summary trusts the configured endpoint. Point it at a cached, read-only URL.
- No RCON is implemented, so no console commands can be executed through this project.

## Reporting

If a token leaks: rotate it in the Discord Developer Portal / Pterodactyl panel, update `.env`, restart the service, and review access logs. If the admin token leaks, rotate `DASHBOARD_ADMIN_TOKEN` and restart the API.
