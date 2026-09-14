# Telegram Mini App (`web-interface`)

Next.js app deployed to **Vercel**. It demonstrates:

- Loading the [Telegram Web App SDK](https://core.telegram.org/bots/webapps)
- Calling the bot API (`GET /health`, `GET /api/status`) using `NEXT_PUBLIC_BOT_API_URL`
- Sending JSON back to the bot with `Telegram.WebApp.sendData`

Replace [`app/page.tsx`](app/page.tsx) with your UI.

## Environment

Copy `.env.example` to `.env.local`:

```dotenv
NEXT_PUBLIC_BOT_API_URL=https://your-render-service.onrender.com
```

In local dev with the bot on port 3000:

```dotenv
NEXT_PUBLIC_BOT_API_URL=http://localhost:3000
```

When testing inside Telegram (not a desktop browser), the bot URL must be **public HTTPS** — use ngrok on port 3000 and run `npm run update-urls` from the repo root.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3001`.

## Deploy to Vercel

1. Import the repo; set **Root Directory** to `web-interface`.
2. Add `NEXT_PUBLIC_BOT_API_URL` pointing to your Render bot URL.
3. Deploy.

On Render, set:

- `WEB_APP_ENABLED=true`
- `WEB_APP_URL=<your-vercel-url>`

Restart the bot service after changing those variables.

## Bot-side handling

Data from the Mini App arrives as `message.web_app_data`. The template handles it in [`src/bot/handlers/message.ts`](../src/bot/handlers/message.ts) (`handleWebAppDataMessage`).

## CORS

The bot only accepts browser calls to `/api/*` from the origin of `WEB_APP_URL` configured on the server. Keep Vercel and Render URLs aligned when using custom domains.
