import cron, { type ScheduledTask } from 'node-cron';
import { promptMessageOptions } from '../bot/keyboards.js';
import { telegramBot } from '../bot/platforms/telegram.js';
import { formatPromptMessage } from '../prompts/format.js';
import { getLoadedPromptConfig } from '../prompts/loader.js';
import { resolvePrimaryPrompt, todayDateKeyForConfig } from '../prompts/resolve.js';
import {
  listSubscribers,
  markPrimarySent,
  removeSubscriber,
  wasPrimarySentToday,
} from '../services/subscriberStore.js';
import { config } from '../utils/config.js';

let cronTask: ScheduledTask | null = null;

function isBlockedBotError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const response = (error as { response?: { statusCode?: number } }).response;
  return response?.statusCode === 403;
}

export async function runDailyPromptBroadcast(): Promise<void> {
  const promptConfig = getLoadedPromptConfig();
  const dateKey = todayDateKeyForConfig(promptConfig);
  const primary = resolvePrimaryPrompt(promptConfig, dateKey);
  const text = formatPromptMessage(primary, { heading: 'Good morning — your word' });

  const chatIds = listSubscribers();
  console.info(
    `[daily-prompt] Broadcasting for ${dateKey}; subscribers=${chatIds.length}; word=${primary.word}`,
  );

  for (const chatId of chatIds) {
    if (wasPrimarySentToday(chatId, dateKey)) {
      continue;
    }

    try {
      await telegramBot.sendMessage(chatId, text, promptMessageOptions());
      markPrimarySent(chatId, dateKey);
    } catch (error) {
      console.error(`[daily-prompt] Failed to send to chat ${chatId}:`, error);
      if (isBlockedBotError(error)) {
        removeSubscriber(chatId);
      }
    }
  }
}

export function startDailyPromptScheduler(): void {
  const promptConfig = getLoadedPromptConfig();
  const [hourText, minuteText] = promptConfig.dailyAt.split(':');
  const hour = Number.parseInt(hourText ?? '8', 10);
  const minute = Number.parseInt(minuteText ?? '0', 10);
  const expression = `${minute} ${hour} * * *`;

  if (cronTask) {
    cronTask.stop();
  }

  cronTask = cron.schedule(
    expression,
    () => {
      void runDailyPromptBroadcast().catch((error) => {
        console.error('[daily-prompt] Scheduled job failed:', error);
      });
    },
    { timezone: promptConfig.timezone },
  );

  if (config.app.logLevel === 'debug') {
    console.info(`[daily-prompt] Scheduled cron "${expression}" timezone=${promptConfig.timezone}`);
  }
}

export function stopDailyPromptScheduler(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
