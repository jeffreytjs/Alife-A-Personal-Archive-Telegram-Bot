/**
 * Core type definitions for the Telegram bot template.
 */

export interface BotConfig {
  telegram: {
    token: string;
    webhookUrl?: string;
  };
  bot: {
    displayName: string;
  };
  webApp: {
    enabled: boolean;
    url: string;
  };
  app: {
    nodeEnv: 'development' | 'production';
    port: number;
    maxConversationHistory: number;
    rateLimitMessagesPerMinute: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableDevJobEndpoint: boolean;
  };
  prompts: {
    configPath: string;
  };
}
