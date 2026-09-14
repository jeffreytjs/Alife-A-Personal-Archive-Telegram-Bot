# ADR 0001: Daily prompt Telegram bot (MVP)

- **Status:** Accepted
- **Date:** 2026-09-14
- **Deciders:** Project owner
- **Related:** [ADR 0002](./0002-prompt-configuration-format.md), [ADR 0003](./0003-state-without-database.md), [TICKETS.md](../TICKETS.md)

## Context

The repository is a Telegram bot template (Node.js, TypeScript, Express, webhooks on Render, optional Next.js Mini App). The product goal is different:

- Once per day at **08:00 Singapore time (SGT)**, send each subscribed user **one word** as a creative prompt.
- Users respond with a **photo or video** in Telegram (no in-bot editor required for MVP).
- Over time, users compile captures into a personal archive montage (out of scope for MVP automation; messaging can explain the vision).
- **No web interface** and **no database** for the first release.
- Prompts must be **updateable by the developer** without code changes (config in repo + Render deploy).
- Users may **request one alternate prompt per calendar day** (SGT).

Future: prompt **categories**, durable subscriber lists, export helpers.

## Decision

Build a **single Render web service** (existing `render.yaml` pattern) that:

1. Receives Telegram updates via **webhook** in production and **polling** in local development.
2. Runs an in-process **scheduler** aligned to `Asia/Singapore` for the 08:00 broadcast.
3. Loads prompt rules from **version-controlled config files** (see ADR 0002).
4. Keeps **subscriber chat IDs** and **per-day alternate-prompt quotas** in **process memory** (see ADR 0003).
5. **Disables** the Mini App path by default (`WEB_APP_ENABLED=false`); no Vercel dependency for MVP.

### User-facing commands (MVP)

| Command | Purpose |
|---------|---------|
| `/start` | Subscribe to daily 8am prompts + short product explanation |
| `/stop` | Unsubscribe |
| `/prompt` | Show today’s assigned prompt (idempotent) |
| `/another` | One alternate prompt per SGT calendar day (see ADR 0003) |
| `/help` | Commands + how to post photo/video |
| `/about` | Project vision + timezone note |

Remove or repurpose template commands that do not fit the product (`/memory`, `/forget`, echo handler) in implementation tickets.

### Daily message content (MVP)

Each scheduled (or on-demand) delivery should include:

- The **word** (primary).
- **Date** in SGT (`YYYY-MM-DD`).
- One line of **guidance**: capture one photo or video inspired by the word today.
- Optional: reminder that `/another` works once per day.

No scoring, streaks, or storage of user media in MVP.

### Prompt selection (high level)

Phased content strategy (config-driven, detail in ADR 0002):

1. **Phase A — Colors:** random word from a fixed color list.
2. **Phase B — Weekday letter:** common words starting with the first letter of the **English weekday name** (e.g. Monday → **M**).
3. **Phase C — Month letter:** common words starting with the first letter of the **English month name** (e.g. September → **S**).

Phase boundaries and per-day overrides are defined in config, not hard-coded.

### Scheduling approach

Use **`node-cron`** (or equivalent) with timezone **`Asia/Singapore`**, cron expression `0 8 * * *`, started when the bot process starts.

**On startup:** compute whether today’s 08:00 SGT has already passed; if yes and no broadcast marker exists for today in memory, optionally send **catch-up** only to users who `/prompt` or on next deploy — **default MVP: no catch-up broadcast** (avoid duplicate spam after deploy). Document in `/help` that the daily push is at 8am.

**Render free tier:** service may sleep or restart; in-memory subscriber list may reset (ADR 0003). Accept for MVP; ticket backlog includes persistence.

**Alternative considered:** Render Cron Job hitting `POST /internal/jobs/daily-prompt` with a shared secret. Rejected for MVP to reduce moving parts; may revisit if missed fires become common.

### Developer prompt updates

1. Edit files under `config/prompts/` (schema in ADR 0002).
2. Commit and push; Render **autoDeploy** rebuilds and restarts.
3. Bot reloads config on startup (and optionally on `SIGHUP`/file watch in dev only).

No admin Telegram command in MVP (avoid accidental public edits). Future ticket: protected `/reload` for allowlisted developer user IDs.

### Security and abuse

- Keep existing **per-user message rate limiting** from the template.
- `/another` limited to **once per user per SGT day** (in memory).
- Do not log full message bodies of user photos; log chat id + update type only at `info` level.

### Out of scope (MVP)

- Web UI, Mini App, Postgres/Redis
- Storing or retrieving user photos/videos server-side
- Automatic video stitching / export
- Prompt categories (tracked as future epic)
- Multi-language prompts (English MVP)

## Consequences

### Positive

- Minimal infra: one Render service, BotFather token, env vars.
- Prompt changes are reviewable in git.
- Fits existing template webhook and `/health` for Render.

### Negative

- **Subscriber list and alternate-prompt counts are lost** on process restart unless persisted later.
- Single-instance scheduler: multiple replicas would duplicate broadcasts (Render MVP assumes **one** instance).
- Weekday/month letter logic depends on **English** day/month names unless config supplies localized names later.

### Migration path

- ADR 0003 → SQLite file or Render Postgres for subscribers + daily state.
- Categories as additional dimension in prompt config (ADR 0002 extension).
- Optional Render Cron + idempotent job id for reliable 8am delivery.

## Compliance with template

| Template piece | MVP disposition |
|----------------|-----------------|
| `web-interface/` | Unused; leave in repo or remove in cleanup ticket |
| `src/utils/db.ts` in-memory pool | Extend for subscriber/quota tables **or** parallel in-memory module |
| `src/bot/handlers/message.ts` echo | Replace with acknowledgment for media + ignore non-command text |
| `BOT_DISPLAY_NAME` | Set to product name on Render |
