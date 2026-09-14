import TelegramBot from 'node-telegram-bot-api';
import { config, isDevelopment } from '../../utils/config.js';

/**
 * Telegram Bot Setup and Management
 */
export class TelegramBotManager {
  private bot: TelegramBot;
  private isInitialized = false;

  constructor() {
    // Initialize bot with polling for development, webhook for production
    this.bot = new TelegramBot(config.telegram.token, {
      polling: isDevelopment(), // Use polling in development
      filepath: false, // Don't download files automatically
    });

    this.setupErrorHandling();
  }

  /**
   * Initialize the bot and set up handlers
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📱 Telegram bot already initialized');
      return;
    }

    try {
      console.log('🔄 Testing Telegram bot connection...');
      
      // Test bot connection
      const botInfo = await this.bot.getMe();

      console.log(`🤖 Telegram bot initialized: @${botInfo.username}`);
      console.log(`📊 Bot ID: ${botInfo.id}`);
      console.log(`🔧 Mode: ${isDevelopment() ? 'Development (Polling)' : 'Production (Webhook)'}`);

      if (isDevelopment()) {
        await this.bot.deleteWebHook();
        console.log('🔄 Cleared webhook for development polling mode');
      } else {
        if (!config.telegram.webhookUrl) {
          throw new Error('TELEGRAM_WEBHOOK_URL is required in production webhook mode.');
        }

        const webhookUrl = this.buildWebhookUrl(config.telegram.webhookUrl);
        const webhookSet = await this.bot.setWebHook(webhookUrl);
        console.log(`📡 Webhook URL: ${webhookUrl}`);
        console.log(`📡 Webhook registration result: ${webhookSet ? 'success' : 'failure'}`);
      }

      // Register commands in Telegram so they appear in the command menu.
      // Mini App commands (/map, /save, /saved) are only registered when the
      // web app is enabled, otherwise they are advertised but do nothing.
      const commands: TelegramBot.BotCommand[] = [
        { command: 'start', description: 'Subscribe and show menu buttons' },
        { command: 'prompt', description: 'Today’s word (or use menu)' },
        { command: 'another', description: 'Extra word once per day' },
        { command: 'stop', description: 'Pause morning prompts' },
        { command: 'help', description: 'Button guide' },
        { command: 'about', description: 'Alife - A Personal Archive' },
      ];

      if (config.webApp.enabled) {
        commands.push({ command: 'app', description: 'Open the Telegram Mini App' });
      }

      await this.bot.setMyCommands(commands);
      console.log('📋 Bot commands registered with Telegram');

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  private buildWebhookUrl(baseWebhookUrl: string): string {
    return `${baseWebhookUrl.replace(/\/$/, '')}/telegram/webhook`;
  }

  /**
   * Set up error handling for the bot
   */
  private setupErrorHandling(): void {
    this.bot.on('error', (error) => {
      console.error('🚨 Telegram Bot Error:', error);
    });

    this.bot.on('polling_error', (error) => {
      console.error('🚨 Telegram Polling Error:', error);
    });

    // Handle webhook errors in production
    if (!isDevelopment()) {
      this.bot.on('webhook_error', (error) => {
        console.error('🚨 Telegram Webhook Error:', error);
      });
    }
  }

  /**
   * Register a text message handler
   */
  public onText(regex: RegExp, callback: (msg: TelegramBot.Message, match: RegExpExecArray | null) => Promise<void>): void {
    this.bot.onText(regex, async (msg, match) => {
      try {
        await callback(msg, match);
      } catch (error) {
        console.error('❌ Error handling text message:', error);
        await this.sendErrorMessage(msg.chat.id, 'Sorry, something went wrong. Please try again.');
      }
    });
  }

  /**
   * Register a general message handler
   */
  public onCallbackQuery(
    callback: (query: TelegramBot.CallbackQuery) => Promise<void>,
  ): void {
    this.bot.on('callback_query', async (query) => {
      try {
        await callback(query);
      } catch (error) {
        console.error('❌ Error handling callback query:', error);
        const chatId = query.message?.chat.id;
        if (chatId) {
          await this.sendErrorMessage(chatId, 'Sorry, something went wrong. Please try again.');
        }
      }
    });
  }

  public async answerCallbackQuery(
    callbackQueryId: string,
    options?: TelegramBot.AnswerCallbackQueryOptions,
  ): Promise<boolean> {
    return this.bot.answerCallbackQuery(callbackQueryId, options);
  }

  public onMessage(callback: (msg: TelegramBot.Message) => Promise<void>): void {
    this.bot.on('message', async (msg) => {
      try {
        // Skip if message has been handled by onText handlers
        if (msg.text && msg.text.startsWith('/')) {
          return; // Let command handlers deal with it
        }
        await callback(msg);
      } catch (error) {
        console.error('❌ Error handling message:', error);
        await this.sendErrorMessage(msg.chat.id, 'Sorry, something went wrong. Please try again.');
      }
    });
  }

  /**
   * Send a text message.
   *
   * Messages are sent as plain text by default. The bot composes replies as
   * plain text with emojis and raw Google Maps URLs (which contain characters
   * like `_ ! * ( )` that break Telegram's Markdown parser), so forcing a
   * parse_mode caused send failures / garbled rendering. Callers that genuinely
   * need formatting can pass `parse_mode` explicitly via `options`.
   *
   * As a safety net, if a send fails while a parse_mode is set, we retry once
   * as plain text so a formatting hiccup never drops the user's reply.
   */
  public async sendMessage(chatId: number, text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message> {
    try {
      return await this.bot.sendMessage(chatId, text, {
        disable_web_page_preview: true,
        ...options,
      });
    } catch (error) {
      if (options?.parse_mode) {
        console.warn('⚠️ sendMessage failed with parse_mode; retrying as plain text');
        try {
          const { parse_mode: _parseMode, ...rest } = options;
          return await this.bot.sendMessage(chatId, text, {
            disable_web_page_preview: true,
            ...rest,
          });
        } catch (retryError) {
          console.error('❌ Error sending message (plain-text retry):', retryError);
          throw retryError;
        }
      }

      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send an error message to user
   */
  private async sendErrorMessage(chatId: number, message: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, `❌ ${message}`);
    } catch (error) {
      console.error('❌ Failed to send error message:', error);
    }
  }

  /**
   * Send a typing indicator
   */
  public async sendTyping(chatId: number): Promise<void> {
    try {
      await this.bot.sendChatAction(chatId, 'typing');
    } catch (error) {
      console.error('❌ Error sending typing indicator:', error);
    }
  }

  /**
   * Process Telegram updates delivered through webhook route.
   */
  public async processUpdate(update: TelegramBot.Update): Promise<void> {
    await this.bot.processUpdate(update);
  }

  /**
   * Get bot instance (for advanced usage)
   */
  public getBotInstance(): TelegramBot {
    return this.bot;
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Telegram bot...');
    try {
      if (isDevelopment()) {
        await this.bot.stopPolling();
      }
      console.log('✅ Telegram bot shutdown complete');
    } catch (error) {
      console.error('❌ Error during bot shutdown:', error);
    }
  }
}

/**
 * Singleton instance for the bot manager
 */
export const telegramBot = new TelegramBotManager(); 