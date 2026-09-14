import type { ResolvedPrompt } from './resolve.js';
import { config } from '../utils/config.js';

export function formatPromptMessage(
  prompt: ResolvedPrompt,
  options?: { heading?: string; includeAnotherHint?: boolean },
): string {
  const heading = options?.heading ?? 'Today’s sign';
  const lines = [
    `${heading}: ${prompt.word}`,
    `Date: ${prompt.dateKey}`,
    '',
    'Capture one photo or video inspired by this word today.',
    'Over time, string those moments into your personal archive.',
  ];

  if (options?.includeAnotherHint !== false) {
    lines.push('', 'Need a different idea? Tap Another idea — once per day.');
  }

  return lines.join('\n');
}

export function formatPrivacyNotice(): string {
  return [
    'Privacy:',
    `${config.bot.displayName} does not process or store any messages you send — text, photos, and videos are not saved on our servers.`,
    'They remain only in your Telegram chat with this bot.',
    '',
    'We do plan to one day support putting the captured daily photos and videos into a montage one day, we just do not have the resources to support that yet. When we do, it will be transparent and on an opt-in only basis.',
  ].join('\n');
}

export function formatAlternateLimitMessage(dateKey: string): string {
  return [
    'You already used your extra prompt for today.',
    `Date: ${dateKey}`,
    '',
    'Come back after midnight (Singapore time) or use today’s word above.',
  ].join('\n');
}

export function formatMediaAcknowledgment(): string {
  return 'Nice capture — we do not store your media. See you tomorrow at 8:00 AM Singapore time.';
}

export function formatPlainTextHint(): string {
  return 'Tap Today’s word on the keyboard below, or Help for a quick guide.';
}
