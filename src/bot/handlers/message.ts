import TelegramBot from 'node-telegram-bot-api';
import { telegramBot } from '../platforms/telegram.js';
import { CommandHandlers } from './commands.js';
import { messageOptionsForPaused, messageOptionsForSubscribed } from '../keyboards.js';
import { formatMediaAcknowledgment, formatPlainTextHint } from '../../prompts/format.js';
import { isSubscribed } from '../../services/subscriberStore.js';
import { checkAndUpdateRateLimit } from '../../utils/memory.js';

function getUserId(msg: TelegramBot.Message): number | undefined {
  return msg.from?.id;
}

function hasVisualMedia(msg: TelegramBot.Message): boolean {
  return Boolean(msg.photo?.length || msg.video || msg.video_note);
}

export class MessageHandlers {
  public static init(): void {
    telegramBot.onMessage(async (msg) => {
      await MessageHandlers.handleIncomingMessage(msg);
    });
  }

  public static async handleIncomingMessage(msg: TelegramBot.Message): Promise<void> {
    if (msg.web_app_data) {
      return;
    }

    if (hasVisualMedia(msg)) {
      await MessageHandlers.handleMediaMessage(msg);
      return;
    }

    if (msg.text && !msg.text.startsWith('/')) {
      if (await CommandHandlers.routeButtonLabel(msg)) {
        return;
      }
      await MessageHandlers.handlePlainText(msg);
    }
  }

  private static async handleMediaMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = getUserId(msg);

    if (userId) {
      const rateLimit = checkAndUpdateRateLimit(userId);
      if (!rateLimit.allowed) {
        return;
      }
    }

    const keyboardOptions = isSubscribed(chatId)
      ? messageOptionsForSubscribed()
      : messageOptionsForPaused();
    await telegramBot.sendMessage(chatId, formatMediaAcknowledgment(), keyboardOptions);
  }

  private static async handlePlainText(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = getUserId(msg);

    if (userId) {
      const rateLimit = checkAndUpdateRateLimit(userId);
      if (!rateLimit.allowed) {
        return;
      }
    }

    const keyboardOptions = isSubscribed(chatId)
      ? messageOptionsForSubscribed()
      : messageOptionsForPaused();
    await telegramBot.sendMessage(chatId, formatPlainTextHint(), keyboardOptions);
  }
}
