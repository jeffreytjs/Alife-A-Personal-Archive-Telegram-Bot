export {};

declare global {
  interface TelegramWebAppUser {
    id: number;
    first_name?: string;
    username?: string;
  }

  interface TelegramWebApp {
    ready: () => void;
    expand: () => void;
    close: () => void;
    sendData: (data: string) => void;
    initDataUnsafe?: {
      user?: TelegramWebAppUser;
    };
  }

  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
