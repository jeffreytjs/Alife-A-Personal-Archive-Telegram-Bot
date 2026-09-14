import dotenv from 'dotenv';
import { botManager } from './bot/index.js';

async function main() {
  try {
    dotenv.config();

    console.log('Alife - A Personal Archive — Telegram bot');
    console.log('Platform: Telegram');
    console.log('');

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is required. Add it to your .env file.');
    }

    await botManager.start();
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});
