import { telegramBot } from './platforms/telegram.js';
import { CommandHandlers } from './handlers/commands.js';
import { MessageHandlers } from './handlers/message.js';
import { botHttpServer } from './server.js';
import { startDailyPromptScheduler, stopDailyPromptScheduler } from '../jobs/dailyPromptJob.js';
import { loadPromptConfig } from '../prompts/loader.js';

export class BotManager {
  private isRunning = false;

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Bot is already running');
      return;
    }

    try {
      console.log('Starting bot...');

      const promptConfig = loadPromptConfig();
      console.log(`Prompt config loaded (${promptConfig.timezone}, daily ${promptConfig.dailyAt})`);

      await telegramBot.initialize();

      botHttpServer.setTelegramUpdateProcessor(async (update) => {
        await telegramBot.processUpdate(update as Parameters<typeof telegramBot.processUpdate>[0]);
      });

      await botHttpServer.start();

      CommandHandlers.init();
      MessageHandlers.init();

      startDailyPromptScheduler();

      this.setupGracefulShutdown();

      this.isRunning = true;

      console.log('Bot is ready.');
      console.log('Health check: http://localhost:3000/health');
      console.log('Telegram webhook: POST /telegram/webhook');
    } catch (error) {
      console.error('Failed to start bot:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    await Promise.all([telegramBot.shutdown(), botHttpServer.stop(), Promise.resolve(stopDailyPromptScheduler())]);
    this.isRunning = false;
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
  }

  public getStatus(): boolean {
    return this.isRunning;
  }
}

export const botManager = new BotManager();
