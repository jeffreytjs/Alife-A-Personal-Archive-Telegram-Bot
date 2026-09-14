'use client';

import { useCallback, useEffect, useState } from 'react';

type BotStatus = {
  ok?: boolean;
  botName?: string;
  webAppEnabled?: boolean;
  environment?: string;
};

export default function MiniAppPage() {
  const [telegramUser, setTelegramUser] = useState<string>('Guest');
  const [health, setHealth] = useState<string>('Checking…');
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const botApiBase = process.env.NEXT_PUBLIC_BOT_API_URL?.replace(/\/$/, '') ?? '';

  const [canSend, setCanSend] = useState(false);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();
    setCanSend(Boolean(webApp));

    const user = webApp?.initDataUnsafe?.user;
    if (user) {
      setTelegramUser(user.first_name || user.username || `User ${user.id}`);
    }
  }, []);

  useEffect(() => {
    if (!botApiBase) {
      setError('Set NEXT_PUBLIC_BOT_API_URL in web-interface/.env.local');
      setHealth('Not configured');
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const healthRes = await fetch(`${botApiBase}/health`);
        const healthJson = (await healthRes.json()) as { status?: string; service?: string };
        if (!cancelled) {
          setHealth(healthJson.status === 'healthy' ? `Healthy (${healthJson.service ?? 'bot'})` : 'Unexpected health response');
        }

        const statusRes = await fetch(`${botApiBase}/api/status`);
        const statusJson = (await statusRes.json()) as BotStatus;
        if (!cancelled) {
          setStatus(statusJson);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to reach bot API');
          setHealth('Unreachable');
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [botApiBase]);

  const sendPing = useCallback(() => {
    const payload = JSON.stringify({
      action: 'ping',
      message: 'Hello from the Mini App',
      at: new Date().toISOString(),
    });
    window.Telegram?.WebApp?.sendData(payload);
    window.Telegram?.WebApp?.close();
  }, []);

  return (
    <main>
      <h1>Telegram Mini App</h1>
      <p className="muted">Template UI hosted on Vercel, talking to your bot API on Render.</p>

      <section className="card">
        <h2>Telegram user</h2>
        <p>{telegramUser}</p>
      </section>

      <section className="card">
        <h2>Bot API</h2>
        <p>
          Base URL: <code>{botApiBase || '(not set)'}</code>
        </p>
        <p>Health: {health}</p>
        {status && (
          <ul>
            <li>Bot name: {status.botName}</li>
            <li>Environment: {status.environment}</li>
            <li>Mini App enabled on server: {String(status.webAppEnabled)}</li>
          </ul>
        )}
        {error && <p className="muted">Error: {error}</p>}
      </section>

      <button type="button" onClick={sendPing} disabled={!canSend}>
        Send data to bot &amp; close
      </button>
    </main>
  );
}
