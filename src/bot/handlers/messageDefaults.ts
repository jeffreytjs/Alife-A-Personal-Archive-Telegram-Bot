const GREETING_PATTERN = /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)$/;

export function tryDefaultReply(messageText: string, userName: string): string | null {
  const normalized = messageText.trim().toLowerCase();

  if (/^(thanks|thank you|ok|okay|cool|great|sure|sounds good)$/.test(normalized)) {
    return 'You are welcome. Send another message whenever you are ready.';
  }

  if (GREETING_PATTERN.test(normalized)) {
    return `Hello ${userName}! I am a starter Telegram bot. Try /help to see what I can do.`;
  }

  if (/^(how are you|how r u|how are u)\??$/.test(normalized)) {
    return 'Doing well, thanks for asking. How can I help you today?';
  }

  return null;
}
