import { z } from 'zod';
import dotenv from 'dotenv';
import type { BotConfig } from '../types/index.js';

dotenv.config();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  TELEGRAM_WEBHOOK_URL: z
    .string()
    .optional()
    .refine((val) => !val || val === '' || z.string().url().safeParse(val).success, {
      message: 'Must be empty or a valid URL',
    }),
  BOT_DISPLAY_NAME: z.string().min(1).default('Alife - A Personal Archive'),
  WEB_APP_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
  WEB_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(65535))
    .default('3000'),
  MAX_CONVERSATION_HISTORY: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .default('20'),
  RATE_LIMIT_MESSAGES_PER_MINUTE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .default('10'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PROMPTS_CONFIG_PATH: z.string().min(1).default('config/prompts/prompts.yaml'),
  ENABLE_DEV_JOB_ENDPOINT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.TELEGRAM_WEBHOOK_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TELEGRAM_WEBHOOK_URL'],
      message: 'TELEGRAM_WEBHOOK_URL is required in production for Telegram webhook mode.',
    });
  }

  if (env.NODE_ENV === 'production' && env.WEB_APP_ENABLED && !env.WEB_APP_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['WEB_APP_URL'],
      message: 'WEB_APP_URL is required in production when WEB_APP_ENABLED=true.',
    });
  }
});

function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

const env = validateEnv();

export const config: BotConfig = {
  telegram: {
    token: env.TELEGRAM_BOT_TOKEN,
    ...(env.TELEGRAM_WEBHOOK_URL && { webhookUrl: env.TELEGRAM_WEBHOOK_URL }),
  },
  bot: {
    displayName: env.BOT_DISPLAY_NAME,
  },
  webApp: {
    enabled: env.WEB_APP_ENABLED,
    url: env.WEB_APP_URL || 'http://localhost:3001',
  },
  app: {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    maxConversationHistory: env.MAX_CONVERSATION_HISTORY,
    rateLimitMessagesPerMinute: env.RATE_LIMIT_MESSAGES_PER_MINUTE,
    logLevel: env.LOG_LEVEL,
    enableDevJobEndpoint: env.ENABLE_DEV_JOB_ENDPOINT,
  },
  prompts: {
    configPath: env.PROMPTS_CONFIG_PATH,
  },
};

export const isDevelopment = () => config.app.nodeEnv === 'development';
