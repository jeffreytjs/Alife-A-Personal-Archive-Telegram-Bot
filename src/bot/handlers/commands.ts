import TelegramBot from 'node-telegram-bot-api';
import { telegramBot } from '../platforms/telegram.js';
import {
  BUTTON_LABELS,
  CALLBACK,
  isButtonLabel,
  messageOptionsForPaused,
  messageOptionsForSubscribed,
  promptMessageOptions,
} from '../keyboards.js';
import { config } from '../../utils/config.js';
import { checkAndUpdateRateLimit } from '../../utils/memory.js';
import {
  formatAlternateLimitMessage,
  formatPrivacyNotice,
  formatPromptMessage,
} from '../../prompts/format.js';
import { getLoadedPromptConfig } from '../../prompts/loader.js';
import {
  resolveAlternatePrompt,
  resolvePrimaryPrompt,
  todayDateKeyForConfig,
} from '../../prompts/resolve.js';
import {
  canUseAlternate,
  consumeAlternate,
  isSubscribed,
  markPrimarySent,
  subscribe,
  unsubscribe,
} from '../../services/subscriberStore.js';

function getUserName(msg: TelegramBot.Message): string {
  return msg.from?.first_name || msg.from?.username || 'there';
}

function replyOptionsForChat(chatId: number): TelegramBot.SendMessageOptions {
  return isSubscribed(chatId) ? messageOptionsForSubscribed() : messageOptionsForPaused();
}

async function guardRateLimit(msg: TelegramBot.Message): Promise<boolean> {
  const userId = msg.from?.id;
  if (!userId) {
    return true;
  }

  const rateLimit = checkAndUpdateRateLimit(userId);
  if (!rateLimit.allowed) {
    const retrySeconds = Math.ceil(rateLimit.retryAfterMs / 1000);
    await telegramBot.sendMessage(
      msg.chat.id,
      `You are sending messages quickly. Please wait about ${retrySeconds}s and try again.`,
      replyOptionsForChat(msg.chat.id),
    );
    return false;
  }

  return true;
}

export class CommandHandlers {
  public static init(): void {
    telegramBot.onText(/^\/start(?:@\w+)?(?:\s|$)/i, async (msg) => {
      await CommandHandlers.handleStart(msg);
    });

    telegramBot.onText(/^\/stop(?:@\w+)?(?:\s|$)/i, async (msg) => {
      await CommandHandlers.handleStop(msg);
    });

    telegramBot.onText(/^\/prompt(?:@\w+)?(?:\s|$)/i, async (msg) => {
      await CommandHandlers.handlePrompt(msg);
    });

    telegramBot.onText(/^\/another(?:@\w+)?(?:\s|$)/i, async (msg) => {
      await CommandHandlers.handleAnother(msg);
    });

    telegramBot.onText(/^\/help(?:@\w+)?(?:\s|$)/i, async (msg) => {
      await CommandHandlers.handleHelp(msg);
    });

    telegramBot.onText(/^\/about(?:@\w+)?(?:\s|$)/i, async (msg) => {
      await CommandHandlers.handleAbout(msg);
    });

    telegramBot.onCallbackQuery(async (query) => {
      await CommandHandlers.handleCallbackQuery(query);
    });
  }

  /** Route reply-keyboard button taps (plain text). Returns true if handled. */
  public static async routeButtonLabel(msg: TelegramBot.Message): Promise<boolean> {
    const text = msg.text?.trim();
    if (!text || !isButtonLabel(text)) {
      return false;
    }

    switch (text) {
      case BUTTON_LABELS.todayWord:
        await CommandHandlers.handlePrompt(msg);
        return true;
      case BUTTON_LABELS.anotherIdea:
        await CommandHandlers.handleAnother(msg);
        return true;
      case BUTTON_LABELS.help:
        await CommandHandlers.handleHelp(msg);
        return true;
      case BUTTON_LABELS.about:
        await CommandHandlers.handleAbout(msg);
        return true;
      case BUTTON_LABELS.pauseDaily:
        await CommandHandlers.handleStop(msg);
        return true;
      case BUTTON_LABELS.resumeDaily:
        await CommandHandlers.handleStart(msg);
        return true;
      default:
        return false;
    }
  }

  private static async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const data = query.data;
    if (!chatId || !data) {
      return;
    }

    await telegramBot.answerCallbackQuery(query.id);

    const msg: TelegramBot.Message = {
      message_id: query.message?.message_id ?? 0,
      date: query.message?.date ?? 0,
      chat: query.message!.chat,
      from: query.from,
    };

    switch (data) {
      case CALLBACK.todayWord:
        await CommandHandlers.handlePrompt(msg);
        break;
      case CALLBACK.anotherIdea:
        await CommandHandlers.handleAnother(msg);
        break;
      case CALLBACK.help:
        await CommandHandlers.handleHelp(msg);
        break;
      case CALLBACK.about:
        await CommandHandlers.handleAbout(msg);
        break;
      case CALLBACK.pauseDaily:
        await CommandHandlers.handleStop(msg);
        break;
      case CALLBACK.resumeDaily:
        await CommandHandlers.handleStart(msg);
        break;
      default:
        break;
    }
  }

  private static async handleStart(msg: TelegramBot.Message): Promise<void> {
    if (!(await guardRateLimit(msg))) {
      return;
    }

    const chatId = msg.chat.id;
    const userName = getUserName(msg);
    subscribe(chatId);

    await telegramBot.sendTyping(chatId);

    const lines = [
      `Welcome to ${config.bot.displayName}, ${userName}!`,
      '',
      'One ordinary word a day — capture it with one photo or video.',
      'Each morning at 8:00 AM, you get a prompt.',
      'Build your personal archive from small moments in everyday life.',
      '',
      'Use the buttons below anytime (no need to type commands).',
      `Tap ${BUTTON_LABELS.todayWord} when you want today’s prompt — otherwise your next one arrives at 8:00 AM.`,
      'Pause whenever, resume when you are ready to receive prompts again.',
    ];

    await telegramBot.sendMessage(chatId, lines.join('\n'), messageOptionsForSubscribed());
  }

  private static async handleStop(msg: TelegramBot.Message): Promise<void> {
    if (!(await guardRateLimit(msg))) {
      return;
    }

    unsubscribe(msg.chat.id);
    await telegramBot.sendMessage(
      msg.chat.id,
      'Daily prompts paused. Tap Resume daily when you want morning messages again.',
      messageOptionsForPaused(),
    );
  }

  private static async handlePrompt(msg: TelegramBot.Message): Promise<void> {
    if (!(await guardRateLimit(msg))) {
      return;
    }

    await CommandHandlers.sendTodayPrompt(msg.chat.id, { heading: 'Today’s sign' });
  }

  private static async sendTodayPrompt(
    chatId: number,
    options?: { heading?: string },
  ): Promise<void> {
    const promptConfig = getLoadedPromptConfig();
    const dateKey = todayDateKeyForConfig(promptConfig);
    const primary = resolvePrimaryPrompt(promptConfig, dateKey);
    const text = formatPromptMessage(
      primary,
      options?.heading ? { heading: options.heading } : {},
    );
    await telegramBot.sendMessage(chatId, text, promptMessageOptions());
    markPrimarySent(chatId, dateKey);
  }

  private static async handleAnother(msg: TelegramBot.Message): Promise<void> {
    if (!(await guardRateLimit(msg))) {
      return;
    }

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    if (!userId) {
      await telegramBot.sendMessage(
        chatId,
        'Could not determine your user id.',
        replyOptionsForChat(chatId),
      );
      return;
    }

    const promptConfig = getLoadedPromptConfig();
    const dateKey = todayDateKeyForConfig(promptConfig);

    if (!canUseAlternate(chatId, dateKey)) {
      await telegramBot.sendMessage(
        chatId,
        formatAlternateLimitMessage(dateKey),
        replyOptionsForChat(chatId),
      );
      return;
    }

    const primary = resolvePrimaryPrompt(promptConfig, dateKey);
    const alternate = resolveAlternatePrompt(promptConfig, dateKey, userId, primary.word);

    if (!alternate) {
      await telegramBot.sendMessage(
        chatId,
        'No alternate word is available today. Tap Today’s word for the main prompt.',
        replyOptionsForChat(chatId),
      );
      return;
    }

    consumeAlternate(chatId, dateKey);
    const text = formatPromptMessage(alternate, {
      heading: 'Alternate sign',
      includeAnotherHint: false,
    });
    await telegramBot.sendMessage(chatId, text, replyOptionsForChat(chatId));
  }

  private static async handleHelp(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const lines = [
      `${config.bot.displayName} — Help`,
      '',
      '• Morning word at 8:00 AM Singapore time when daily prompts are on',
      `• ${BUTTON_LABELS.todayWord} — show today’s prompt anytime`,
      `• ${BUTTON_LABELS.anotherIdea} — one extra word per Singapore calendar day`,
      '• You can send a photo or video for yourself — the bot does not keep a copy',
      '• Missed 8 AM? Tap Today’s word — no catch-up blast after deploy',
      '',
      formatPrivacyNotice(),
      '',
      'Commands still work if you prefer: /start, /prompt, /another, /stop',
    ];

    await telegramBot.sendMessage(chatId, lines.join('\n'), replyOptionsForChat(chatId));
  }

  private static async handleAbout(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const promptConfig = getLoadedPromptConfig();
    const subscribed = isSubscribed(chatId);

    const lines = [
      `About ${config.bot.displayName}`,
      '',
      'A daily archive bot: get one simple word, take one photo or video.',
      'Ordinary colors and things you see every day — easy to notice and capture.',
      `Daily send: ${promptConfig.dailyAt} (${promptConfig.timezone})`,
      '',
      `Morning prompts: ${subscribed ? 'on' : 'paused'}.`,
      '',
      formatPrivacyNotice(),
    ];

    await telegramBot.sendMessage(chatId, lines.join('\n'), replyOptionsForChat(chatId));
  }
}
