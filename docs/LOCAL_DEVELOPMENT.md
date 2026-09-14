# Local development

## Modes

| `NODE_ENV` | Telegram updates | Typical use |
|------------|------------------|-------------|
| `development` | Long polling | Daily coding on your machine |
| `production` | Webhook to `/telegram/webhook` | Match Render behavior locally via ngrok |

Default `.env.example` uses `development` so you can run the bot without a public URL.

## Install

```bash
npm install
cd web-interface && npm install && cd ..
cp .env.example .env
cp web-interface/.env.example web-interface/.env.local
```

Add `TELEGRAM_BOT_TOKEN` to `.env`.

## Run bot only

```bash
npm run dev
```

- HTTP server: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- Telegram: polling (webhook cleared on startup)

## Run bot + Mini App

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:web
```

Mini App: `http://localhost:3001`

Set in `.env`:

```dotenv
WEB_APP_ENABLED=true
WEB_APP_URL=http://localhost:3001
```

Set in `web-interface/.env.local`:

```dotenv
NEXT_PUBLIC_BOT_API_URL=http://localhost:3000
```

Telegram Desktop/mobile cannot load `localhost` inside a real Mini App session — use ngrok for end-to-end Mini App tests.

## ngrok (HTTPS)

1. Copy [`ngrok.example.yml`](../ngrok.example.yml) to `ngrok.yml` and add your authtoken.
2. Start tunnels:

```bash
ngrok start --all --config ngrok.yml
```

3. Update env files:

```bash
npm run update-urls
```

This sets:

- `.env` → `TELEGRAM_WEBHOOK_URL`, `WEB_APP_URL`
- `web-interface/.env.local` → `NEXT_PUBLIC_BOT_API_URL`

4. Convenience script (Git Bash / WSL):

```bash
npm run dev:full
```

## Test webhooks locally

1. Set in `.env`:

```dotenv
NODE_ENV=production
TELEGRAM_WEBHOOK_URL=https://<bot-ngrok-subdomain>.ngrok-free.app
```

2. Restart `npm run dev`.
3. Confirm logs show webhook registration success.
4. Message the bot — updates should hit `POST /telegram/webhook` instead of polling.

Switch back to `NODE_ENV=development` for normal local work.

## Lint / typecheck

```bash
npm run lint
```

## Scripts reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Bot with hot reload |
| `npm run dev:web` | Next.js on port 3001 |
| `npm run dev:all` | Bot + web concurrently |
| `npm run update-urls` | Sync ngrok URLs into env files |
| `npm run build:bot` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled bot (production) |
