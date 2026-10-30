# Deployment

Supernova SMP is **two services**:

| Service | Runtime | Default port | Notes |
| --- | --- | --- | --- |
| Dashboard + API | Node 20+ (Express) | `3001` | Serves `index.html`, assets and `/api/*` |
| Discord bot | Node 20+ (discord.js) | — | Outbound gateway connection |

The Minecraft port **25509 is a game port, not HTTP**. Never point a reverse proxy or browser at it. The dashboard uses its own port and talks to 25509 over a TCP Minecraft handshake, server-side.

---

## Option A — One VPS (recommended)

1. Install Node.js 20+ and clone/extract the project.
2. Install dependencies:

```bash
cd server && npm ci && cd ../bot && npm ci && cd ..
```

3. Configure:

```bash
cp server/.env.example server/.env
cp bot/.env.example bot/.env
# edit both files
```

4. Start each service under a process manager (systemd or PM2).

### systemd

`/etc/systemd/system/supernova-dashboard.service`

```ini
[Unit]
Description=Supernova SMP dashboard + API
After=network.target

[Service]
Type=simple
User=supernova
WorkingDirectory=/opt/supernova/server
EnvironmentFile=/opt/supernova/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/supernova-bot.service`

```ini
[Unit]
Description=Supernova SMP Discord bot
After=network-online.target

[Service]
Type=simple
User=supernova
WorkingDirectory=/opt/supernova/bot
EnvironmentFile=/opt/supernova/bot/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now supernova-dashboard supernova-bot
sudo journalctl -u supernova-dashboard -f
```

### PM2 alternative

```bash
cd server && pm2 start src/index.js --name supernova-api
cd ../bot && pm2 start src/index.js --name supernova-bot
pm2 save && pm2 startup
```

### Nginx + HTTPS

Point a DNS record at the VPS, e.g. `dashboard.example.com`, then:

```nginx
server {
    listen 443 ssl http2;
    server_name dashboard.example.com;

    ssl_certificate     /etc/letsencrypt/live/dashboard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name dashboard.example.com;
    return 301 https://$host$request_uri;
}
```

Keep port `3001` closed to the public firewall. Only 80/443 should be open.

### Pterodactyl note

- The Minecraft server keeps running in Pterodactyl on `25509`.
- Run the dashboard on a **separate allocation/port** on the same node, or on another VPS. Do not replace the game allocation.
- If you want the dashboard managed by Pterodactyl too, create a second server/egg for Node — or simply run it as a systemd service on the node host. The dashboard does not need to live inside the Minecraft container.
- Optional Pterodactyl integration uses a **Client API key** (not Application key) scoped to the one server. Set:

```env
PTERODACTYL_URL=https://panel.example.com
PTERODACTYL_TOKEN=
PTERODACTYL_SERVER_ID=xxxxxxxx
```

The server ID is the short code in the panel URL: `/server/xxxxxxxx`.

---

## Option B — Split static dashboard + API

Useful for Netlify/Cloudflare Pages + Railway/Fly/Render.

1. Deploy `server/` as a Node service with `SERVE_DASHBOARD=false`.
2. Set `DASHBOARD_ORIGIN=https://dashboard.example.com`.
3. Serve the static files (`index.html`, `assets/`, `vendor/`) from your static host.
4. Edit `assets/js/config.js` before uploading:

```js
window.SUPERNOVA_CONFIG = {
  apiBase: 'https://api.example.com',
  // ...
};
```

The API only allows the origins listed in `DASHBOARD_ORIGIN` (comma-separated).

---

## Option C — Dashboard-only preview

The static dashboard works without the API and labels its sample data **Demo data**. This is useful for design review:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

No build step is required. Fonts and Three.js are self-hosted.

---

## Bot deployment

Slash commands must be registered once (and again whenever definitions change):

```bash
cd bot
npm run deploy
```

- With `GUILD_ID` set, commands appear immediately in that guild.
- Without it, global registration can take up to an hour.
- Run deploy from any machine with the token; it does not require the bot to be online.

Then start the bot (`npm start`) and confirm `[ready] logged in as …` in the logs.

---

## Health checks

```bash
curl -fsS https://dashboard.example.com/api/health
```

Expected:

```json
{"data":{"status":"ok","api":"up","features":{"pterodactyl":false,"whitelistBridge":false,"admin":true}}}
```

Use this endpoint for uptime monitors. It does not ping Minecraft, so it is cheap.

---

## Updating

```bash
git pull            # or upload the new zip
cd server && npm ci
cd ../bot && npm ci
npm run deploy      # only when commands changed
sudo systemctl restart supernova-dashboard supernova-bot
```

`bot/data/suggestions.json` and `bot/data/state.json` are runtime state. Back them up if you care about suggestion history; deleting them resets votes and the status message pointer.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Dashboard says **Demo data** | API not reachable at `apiBase`; open `/api/health` |
| `/api/status` shows offline | Game server down, wrong `MC_HOST`/`MC_PORT`, or host firewall |
| Admin says **503** | `DASHBOARD_ADMIN_TOKEN` not set on the API |
| Admin says **401** | Token mismatch; re-enter the token in the Admin page |
| Pterodactyl **503/unavailable** | Client key, server ID, panel URL, or panel firewall |
| Slash commands missing | `npm run deploy`, correct `DISCORD_CLIENT_ID`, `GUILD_ID`, `applications.commands` scope |
| Welcome not sent | `WELCOME_CHANNEL_ID`, bot View/Send permissions, Guild Members intent enabled |
| Tickets fail | Bot needs Manage Channels (+ Manage Roles if using role overwrites) and a valid category ID |
| Status board never updates | `STATUS_CHANNEL_ID`, Send/Embed permissions, interval >= 30s |
| Player lookup 503 | API cannot reach `api.mojang.com` (outbound network/DNS) |
