#!/usr/bin/env node

import fs from 'fs';

async function updateNgrokUrls() {
  try {
    const response = await fetch('http://localhost:4040/api/tunnels');
    const data = await response.json();

    const botTunnel = data.tunnels.find(
      (t) => t.config.addr.includes(':3000') || t.name === 'bot-server',
    );
    const webTunnel = data.tunnels.find(
      (t) => t.config.addr.includes(':3001') || t.name === 'web-interface',
    );

    if (!botTunnel || !webTunnel) {
      console.log(
        'Available tunnels:',
        data.tunnels.map((t) => ({ name: t.name, addr: t.config.addr, url: t.public_url })),
      );
      throw new Error('Could not find both tunnels. Start ngrok with ngrok.yml (ports 3000 and 3001).');
    }

    const botUrl = botTunnel.public_url;
    const webUrl = webTunnel.public_url;

    console.log(`Bot tunnel: ${botUrl}`);
    console.log(`Web tunnel: ${webUrl}`);

    updateEnvFile('.env', {
      TELEGRAM_WEBHOOK_URL: botUrl,
      WEB_APP_URL: webUrl,
    });

    updateEnvFile('web-interface/.env.local', {
      NEXT_PUBLIC_BOT_API_URL: botUrl,
    });

    console.log('Environment files updated successfully.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error updating ngrok URLs:', message);
    console.log('\nMake sure:');
    console.log('  1. ngrok is running: ngrok start --all --config ngrok.yml');
    console.log('  2. Both tunnels (3000 and 3001) are active');
    process.exit(1);
  }
}

function updateEnvFile(filePath, updates) {
  if (!fs.existsSync(filePath)) {
    console.warn(`${filePath} does not exist, skipping...`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (content.match(regex)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  });

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

updateNgrokUrls();
