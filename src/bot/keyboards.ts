import type TelegramBot from 'node-telegram-bot-api';

/** Labels must match exactly — reply keyboard sends these as plain text. */
export const BUTTON_LABELS = {
  todayWord: "Today's word",
  anotherIdea: 'Another idea',
  help: 'Help',
  about: 'About',
  pauseDaily: 'Pause daily',
  resumeDaily: 'Resume daily',
} as const;

export type ButtonLabel = (typeof BUTTON_LABELS)[keyof typeof BUTTON_LABELS];

const ALL_LABELS = new Set<string>(Object.values(BUTTON_LABELS));

export function isButtonLabel(text: string): text is ButtonLabel {
  return ALL_LABELS.has(text);
}

export const CALLBACK = {
  todayWord: 'alife:prompt',
  anotherIdea: 'alife:another',
  help: 'alife:help',
  about: 'alife:about',
  pauseDaily: 'alife:stop',
  resumeDaily: 'alife:start',
} as const;

function replyKeyboard(rows: string[][]): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** Main menu while subscribed to daily pushes. */
export function subscribedReplyKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return replyKeyboard([
    [BUTTON_LABELS.todayWord, BUTTON_LABELS.anotherIdea],
    [BUTTON_LABELS.help, BUTTON_LABELS.about],
    [BUTTON_LABELS.pauseDaily],
  ]);
}

/** Shown after pause — still allows fetching today’s word. */
export function pausedReplyKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return replyKeyboard([
    [BUTTON_LABELS.todayWord, BUTTON_LABELS.anotherIdea],
    [BUTTON_LABELS.resumeDaily],
    [BUTTON_LABELS.help, BUTTON_LABELS.about],
  ]);
}

export function inlineAnotherIdeaOnly(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: BUTTON_LABELS.anotherIdea, callback_data: CALLBACK.anotherIdea }]],
  };
}

export function messageOptionsForSubscribed(
  extra?: TelegramBot.SendMessageOptions,
): TelegramBot.SendMessageOptions {
  return {
    ...extra,
    reply_markup: subscribedReplyKeyboard(),
  };
}

export function messageOptionsForPaused(
  extra?: TelegramBot.SendMessageOptions,
): TelegramBot.SendMessageOptions {
  return {
    ...extra,
    reply_markup: pausedReplyKeyboard(),
  };
}

export function promptMessageOptions(
  extra?: TelegramBot.SendMessageOptions,
): TelegramBot.SendMessageOptions {
  return {
    ...extra,
    reply_markup: inlineAnotherIdeaOnly(),
  };
}
