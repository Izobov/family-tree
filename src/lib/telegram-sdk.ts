/**
 * SDK Telegram подгружаем скриптом с их домена — иначе никак, initData живёт
 * только в нём. Грузим не всем подряд, а только внутри Telegram: веб- и
 * PWA-пользователям он не нужен и стоит лишнего запроса к чужому домену.
 *
 * Service worker его не трогает: он отдаёт кросс-доменные запросы сети как есть.
 */

const SRC = 'https://telegram.org/js/telegram-web-app.js';

export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  /** Появился в Bot API 6.1 — на старых клиентах его может не быть. */
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  };
};

function existing(): TelegramWebApp | null {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

let pending: Promise<TelegramWebApp | null> | null = null;

/**
 * Возвращает WebApp либо null, если скрипт не загрузился. Повторные вызовы
 * переиспользуют один промис: корневой layout и страница /telegram могут
 * позвать его оба, а вставлять второй тег в head не нужно.
 */
export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  const already = existing();
  if (already) return Promise.resolve(already);
  if (pending) return pending;

  pending = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve(existing());
    // Оффлайн или заблокированный домен не должны ронять страницу — вызывающий
    // сам решает, что делать с null.
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return pending;
}

/**
 * Короткий тактильный отклик на нажатие. Вне Telegram — молча ничего: ни SDK,
 * ни HapticFeedback там нет, и это не ошибка, а обычная работа в браузере.
 * Поэтому здесь только необязательные обращения и никаких await — отклик
 * обязан случиться в тот же тик, что и нажатие, иначе он ощущается запоздалым.
 */
export function haptic(style: 'light' | 'medium' = 'light'): void {
  if (typeof window === 'undefined') return;
  const webApp = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  webApp?.HapticFeedback?.impactOccurred(style);
}
