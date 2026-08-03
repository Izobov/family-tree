import { createHmac } from 'node:crypto';

/**
 * Токен только для тестов. Настоящий в тестах не нужен и не должен тут быть:
 * подпись проверяется тем же алгоритмом, каким бы ключом её ни делали.
 * Этим же значением playwright.config.ts запускает сервер.
 */
export const TEST_BOT_TOKEN = '999999:playwright-test-token';

export type TestTelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

/** Подписывает initData ровно так же, как это делает Telegram. */
export function signInitData(user: TestTelegramUser, token = TEST_BOT_TOKEN): string {
  const params: Record<string, string> = {
    user: JSON.stringify(user),
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAtest'
  };

  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  return new URLSearchParams({ ...params, hash }).toString();
}

/**
 * Подменяет window.Telegram до того, как отработают скрипты страницы.
 * loadTelegramWebApp() увидит готовый объект и не полезет на telegram.org —
 * тест не зависит от чужого домена, но серверный путь проверяется настоящий.
 */
export const stubScript = (initData: string) => `
  window.Telegram = {
    WebApp: {
      initData: ${JSON.stringify(initData)},
      ready() {},
      expand() {}
    }
  };
`;
