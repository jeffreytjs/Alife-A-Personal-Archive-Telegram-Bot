# Deployment (Render + Vercel)

This guide describes the recommended hosting split for this template: **bot API on Render**, **Mini App on Vercel**. The Mini App is optional; you can deploy the bot alone.

## Overview

1. Deploy the **root repository** to Render as a Node web service.
2. Set production environment variables on Render.
3. Confirm webhook registration and `/health`.
4. (Optional) Deploy **`web-interface/`** to Vercel and link URLs.
5. (Optional) Enable the Mini App in Render env and BotFather menu.

## 1. Create the Telegram bot

1. Open [@BotFather](https://t.me/BotFather).
2. Run `/newbot` and save the **token**.
3. Optionally set name, description, and `/setcommands` (the app also calls `setMyCommands` on startup).

## 2. Deploy bot API to Render

### Option A — Blueprint (`render.yaml`)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint** and select the repo.
3. Render creates a web service from [`render.yaml`](../render.yaml).

### Option B — Manual web service

1. **New → Web Service**, connect the repo.
2. **Root directory:** repository root (not `web-interface`).
3. **Build command:** `npm install --include=dev && npm run build:bot` (dev deps include TypeScript; `NODE_ENV=production` alone would skip them)
4. **Start command:** `npm start`
5. **Health check path:** `/health`

### Render environment variables

Set these in the Render dashboard (Environment):

| Key | Example | Notes |
|-----|---------|--------|
| `NODE_ENV` | `production` | Enables webhook mode |
| `TELEGRAM_BOT_TOKEN` | from BotFather | Secret |
| `TELEGRAM_WEBHOOK_URL` | `https://telegram-bot-api.onrender.com` | **HTTPS base URL only** — no `/telegram/webhook` suffix |
| `BOT_DISPLAY_NAME` | `Alife - A Personal Archive` | Optional |
| `PROMPTS_CONFIG_PATH` | `config/prompts/prompts.yaml` | Bundled prompt YAML |
| `WEB_APP_ENABLED` | `false` | Keep false for MVP |
| `WEB_APP_URL` | `https://my-mini-app.vercel.app` | Required if `WEB_APP_ENABLED=true` |
| `PORT` | `3000` | Render sets `PORT` automatically; default is fine |

After deploy:

1. Open `https://<your-render-host>/health` — expect `{ "status": "healthy", ... }`.
2. Check Render logs for `Webhook registration result: success` and `Webhook URL: .../telegram/webhook`.
3. Send `/start` to your bot in Telegram.

### Product smoke test (Alife - A Personal Archive)

1. `/start` — welcome + today’s word; confirms subscription.
2. `/prompt` — same word as step 1 for the same Singapore calendar day.
3. `/another` — alternate word; second `/another` same day should refuse.
4. Send a photo — short acknowledgment reply.
5. Redeploy or restart — send `/start` again (in-memory subscribers reset).
6. Optional: at 8:00 AM Singapore time, subscribed chats receive the daily word (check Render logs for `[daily-prompt]`).

Prompt changes: edit `config/prompts/prompts.yaml`, push, wait for Render deploy, run `npm run validate:prompts` locally before push.

### Webhook behavior

On startup in production, the bot calls:

`setWebHook({TELEGRAM_WEBHOOK_URL}/telegram/webhook)`

Telegram delivers updates to `POST /telegram/webhook`. The server optionally restricts callers to [Telegram IP ranges](https://core.telegram.org/bots/webhooks#the-short-version).

If messages do not arrive:

- Confirm `TELEGRAM_WEBHOOK_URL` matches the public Render URL (HTTPS).
- Confirm `NODE_ENV=production`.
- Inspect Render logs for webhook errors.
- Use `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` to see Telegram’s view.

## 3. Deploy Mini App to Vercel (optional)

1. **New Project** in Vercel, import the same GitHub repo.
2. Set **Root Directory** to `web-interface`.
3. Framework preset: **Next.js** (defaults from [`vercel.json`](../web-interface/vercel.json)).
4. Add environment variable:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_BOT_API_URL` | Your Render service URL, e.g. `https://telegram-bot-api.onrender.com` |

5. Deploy and copy the production URL (e.g. `https://my-mini-app.vercel.app`).

### Link bot ↔ Mini App

On **Render**, update:

- `WEB_APP_ENABLED=true`
- `WEB_APP_URL=https://my-mini-app.vercel.app` (no trailing slash required)

Redeploy or restart the Render service so config reloads.

In Telegram:

- Run `/app` or use the inline **Open Mini App** button.
- Configure the Mini App URL in BotFather if you use Telegram’s menu entry (`/mybots → Bot Settings → Menu Button → Configure menu button → Web App`).

### CORS

`/api/status` allows browser requests only from the origin of `WEB_APP_URL`. Keep Render `WEB_APP_URL` in sync with your Vercel domain (including custom domains).

## 4. BotFather Mini App URL

For a persistent menu button:

1. BotFather → your bot → **Bot Settings** → **Menu Button**.
2. Set type **Web App** and URL to your Vercel deployment.

The in-chat `/app` command uses the same `WEB_APP_URL` from Render env.

## 5. Docker (optional)

Build and run locally or on any container host:

```bash
docker build -t telegram-bot-template .
docker run --env-file .env -p 3000:3000 telegram-bot-template
```

Use the same env vars as Render. For production webhooks, the container must be reachable at a public HTTPS URL (Render is simpler on the free tier).

## 6. Persistence (production note)

The template uses an **in-memory** store in [`src/utils/db.ts`](../src/utils/db.ts) suitable for a single instance and demos. Render free web services restart and scale to one instance, but memory is still lost on restart.

For production bots that need durable user state across restarts or multiple instances, replace the in-memory `Pool` in `db.ts` with Postgres and store conversation data in a `user_memory` table.

## Checklist

- [ ] Render service healthy at `/health`
- [ ] `getWebhookInfo` shows correct URL
- [ ] Bot responds to `/start` in Telegram
- [ ] (Optional) Vercel Mini App loads and shows bot health
- [ ] (Optional) Mini App “Send data to bot” returns a chat message
- [ ] Secrets only in Render/Vercel env — never committed
