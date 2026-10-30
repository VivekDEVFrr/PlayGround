# API reference

Base URL: `http://localhost:3001` (or your dashboard domain). All responses are JSON with a `data` wrapper, except errors.

```
GET /api/health
GET /api/config
GET /api/status
GET /api/history
GET /api/players/:name
GET /api/whitelist/summary

GET  /api/admin/verify        Bearer
GET  /api/admin/resources     Bearer
POST /api/admin/power         Bearer + JSON body
```

---

## `GET /api/health`

Cheap liveness probe. Does **not** ping Minecraft.

```json
{
  "data": {
    "status": "ok",
    "api": "up",
    "uptimeSeconds": 120,
    "features": { "pterodactyl": false, "whitelistBridge": false, "admin": true }
  }
}
```

---

## `GET /api/config`

Public branding and feature flags. Safe to expose; contains no secrets.

```json
{
  "data": {
    "brand": { "name": "Supernova SMP", "short": "Supernova", "tagline": "…", "logo": "assets/img/nova.svg" },
    "mc": { "host": "tarzan.supernovaa.in", "port": 25509, "bedrockPort": 19132, "version": null },
    "links": { "discord": "…", "whitelist": "…", "rules": "#/support", "map": "" },
    "pollSeconds": 15,
    "features": { "pterodactyl": false, "whitelistBridge": false, "admin": true }
  }
}
```

---

## `GET /api/status`

Live Minecraft status. Cached for `MC_CACHE_TTL_MS` (default 15s) with in-flight de-duplication. An offline server returns **200** with `online: false` — it is a state, not an API error.

```json
{
  "data": {
    "online": true,
    "host": "tarzan.supernovaa.in",
    "port": 25509,
    "players": { "online": 23, "max": 100, "list": ["Maya", "Kai"] },
    "version": "1.21.4",
    "protocol": 769,
    "motd": "A cozy survival SMP — Season III",
    "latencyMs": 42,
    "checkedAt": "2026-10-30T15:00:00.000Z",
    "cached": false,
    "peak": 64,
    "uptime": "99.9%",
    "historySamples": 42
  }
}
```

- `uptime` is observed availability from history samples; `null` until at least 5 samples exist.
- `peak` is the highest recorded sample.
- `players.list` is capped at 100 and only includes names the server exposes.

---

## `GET /api/history`

Player-count samples (default one every 5 minutes, max 288 = 24h).

```json
{ "data": { "points": [{ "t": 1793373935750, "count": 23, "online": true }], "peak": 23, "samples": 1, "intervalMs": 300000 } }
```

---

## `GET /api/players/:name`

Validates `^[A-Za-z0-9_]{3,16}$`, resolves the Mojang profile (10-minute cache) and cross-checks the live player list.

```json
{
  "data": {
    "name": "Notch",
    "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
    "online": false,
    "checkedAt": "2026-10-30T15:00:00.000Z",
    "source": "mojang",
    "server": { "host": "tarzan.supernovaa.in", "port": 25509, "reachable": true, "playersOnline": 23 }
  }
}
```

Errors:

| Status | Meaning |
| --- | --- |
| `400` | Invalid username |
| `404` | No Java account with that name |
| `503` | Mojang unreachable |

Playtime, balance and stats are **not** returned because no reliable source provides them.

---

## `GET /api/whitelist/summary`

Read-only. Returns `configured: false` when `WHITELIST_STATUS_URL` is unset.

```json
{
  "data": {
    "configured": true,
    "reachable": true,
    "pending": 3,
    "total": 120,
    "checkedAt": "…",
    "note": "Read-only summary. This API never writes to the whitelist system."
  }
}
```

If the bridge is down: `configured: true, reachable: false, pending: null, total: null`. Never an error, never a write.

---

## Admin

All admin routes require:

```
Authorization: Bearer <DASHBOARD_ADMIN_TOKEN>
```

Missing/invalid → `401`. Token not configured → `503`. Rate limited to 30/min/IP. Responses are `Cache-Control: no-store`.

### `GET /api/admin/verify`

```json
{ "data": { "ok": true, "pterodactyl": true, "scope": "dashboard-admin" } }
```

### `GET /api/admin/resources`

`configured: false` when Pterodactyl env vars are missing.

```json
{
  "data": {
    "configured": true,
    "state": "running",
    "suspended": false,
    "cpuPercent": 12.4,
    "memoryPercent": 48.2,
    "diskPercent": 19.1,
    "cpuLimitPercent": 200,
    "memoryBytes": 812345678,
    "memoryLimitBytes": 2147483648,
    "diskBytes": 1234567890,
    "diskLimitBytes": 10737418240,
    "uptimeMs": 918273645,
    "network": { "rxBytes": 1, "txBytes": 2 },
    "checkedAt": "…"
  }
}
```

Percentages are `null` when the panel reports an unlimited resource.

### `POST /api/admin/power`

```json
{ "action": "restart" }
```

Allowed: `start`, `stop`, `restart`. Anything else → `400`.

Success:

```json
{ "data": { "action": "restart", "sentAt": "2026-10-30T15:00:00.000Z" } }
```

Power actions are audited in the API log (`admin power action`, action + IP). Minecraft stops for every player — the dashboard asks for confirmation first.

---

## Error format

```json
{ "error": "Username must be 3–16 letters, numbers or underscores.", "code": "bad_request" }
```

5xx errors return a generic message; details stay in server logs.

## Caching summary

| Endpoint | Cache |
| --- | --- |
| `/api/status` | 15s server-side + `Cache-Control: max-age=5` |
| `/api/history` | 10s HTTP |
| `/api/players/:name` | 10 min positive, 2 min negative |
| `/api/whitelist/summary` | 60s |
| `/api/config` | none |
| `/api/admin/*` | `no-store` |
