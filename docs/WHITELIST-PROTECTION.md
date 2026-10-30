# Whitelist protection

## The guarantee

**The existing whitelist system was not rewritten, replaced, renamed, or modified.**

This repository contains **no whitelist implementation at all**:

- No whitelist command
- No whitelist database, table, collection or file
- No whitelist permissions or role grants
- No application, approval or denial workflow
- No migration or import of existing whitelist data

The bot and dashboard only **link to** your existing flow. The optional summary endpoint is **read-only**.

> Note on this delivery: the workspace did not contain the existing bot project or whitelist files (only the web scaffold, with no `package.json`, bot folder or zip). Therefore no whitelist file could be, or was, edited. The new `bot/` is a separate service designed to sit *beside* your existing bot rather than replace it.

## Protected surface

Treat all of the following as off-limits when merging this project into an existing bot:

| Area | Rule |
| --- | --- |
| Whitelist command files | Do not rename, delete or rewrite |
| Command registration for whitelist | Keep the existing names/options exactly |
| Permissions / staff checks | Do not alter |
| Storage (SQLite, MongoDB, JSON, Pterodactyl DB) | Do not change schema or writes |
| Application UI (modals, buttons, embeds) | Do not replace |
| Approval / denial / role grant flow | Do not reimplement |
| Environment variable names used by whitelist | Do not rename |

## What this project does instead

### 1. Link-out only (default, zero coupling)

`WHITELIST_URL` (bot) and `PUBLIC_WHITELIST_URL` (dashboard) are plain links:

- Welcome embed button: **🔐 Whitelist**
- `/help` → Whitelist section
- Dashboard → Whitelist page and quick action
- Support ticket category: **🔐 Whitelist Help**

No API call, no shared storage, no permissions.

### 2. Optional read-only summary

If — and only if — you expose a small cached `GET` endpoint, the dashboard can display two numbers:

```env
WHITELIST_STATUS_URL=https://your-existing-service.example.com/whitelist/summary
```

Accepted JSON shapes (any of):

```json
{ "pending": 3, "total": 120 }
```

```json
{ "pendingCount": 3, "whitelistedCount": 120 }
```

```json
{ "data": { "pending": 3, "approved": 120 } }
```

Rules for that endpoint:

- `GET` only. It must not mutate state.
- Cache it (30–60s) on your side too.
- Return numbers only — no usernames, tokens or application bodies.
- If it is down, the dashboard shows `—`; nothing breaks.
- The API caches the response for 60 seconds and never forwards it to the browser raw.

The implementation lives in [`server/src/lib/whitelist.js`](../server/src/lib/whitelist.js).

## If you merge into your existing bot

Do this **only** if you want a single process. Otherwise run `bot/` beside the current bot.

1. Back up the existing project and database.
2. Keep every whitelist file and command untouched. Do not edit their loader conditions.
3. Add the new command files next to the existing ones and register **only the new names**.
4. Do not reuse the existing whitelist collection/table or role IDs.
5. Keep `WHITELIST_URL` pointing at the current flow.
6. Deploy and verify the whitelist works exactly as before (below).

The new bot's command names are: `server`, `status`, `players`, `player`, `ip`, `rules`, `help`, `ping`, `membercount`, `userinfo`, `avatar`, `suggest`, `announce`, `ticketpanel`, `statuspanel`, `suggest-review`.

If any of these collide with your existing commands, rename the **new** ones in `bot/src/commands/definitions.js` and `bot/src/commands/execute.js` — never the whitelist ones.

## Verification checklist (do this before and after deployment)

- [ ] Run the existing whitelist apply command — same name, same options, same modal.
- [ ] Submit a test application — confirm it lands in the same storage with the same fields.
- [ ] Approve it with the existing staff command — confirm the same role is granted.
- [ ] Deny another test application — confirm the same message/behavior.
- [ ] Check staff permissions: a normal member still cannot approve.
- [ ] Confirm database counts before/after (no unexpected rows or schema changes).
- [ ] Confirm no new environment variables are required by the whitelist code.
- [ ] Confirm the bot starts with the whitelist module loaded and logs no errors.
- [ ] Roll back by stopping the new `bot/`/`server/` processes — the whitelist is unaffected.

## What was deliberately left alone

- Whitelist commands
- Whitelist permissions
- Whitelist database/storage
- Whitelist application UI
- Approval workflow
- Existing role grants

This is enforced by architecture: the new services have no credentials or code paths that write to the whitelist.
