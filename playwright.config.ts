import { defineConfig, devices } from '@playwright/test';
import { TEST_BOT_TOKEN } from './e2e/telegram-helpers';

export default defineConfig({
  testDir: 'e2e',
  // Сценарий сквозной и длинный: регистрация, четыре создания, правка,
  // смена языка и уборка за собой — всё против живого Supabase, где каждый
  // шаг это реальный сетевой round-trip. В 30 с он перестал укладываться.
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Явно фиксируем локаль: без неё Accept-Language берётся из системной
    // локали среды выполнения, и первый экран (без куки locale) может
    // отрендериться по-английски, ломая все проверки на русский текст.
    locale: 'ru-RU'
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // Обязательно build + preview, а не dev: service worker и поведение
    // прод-сборки существуют только там.
    command: 'npm run build && npm run preview',
    /**
     * Сервер поднимается с тестовым токеном бота, а тест подписывает им же
     * initData. Настоящий токен для этого не нужен: проверяется алгоритм, а не
     * конкретный бот. Остальные переменные приходят из .env.
     */
    env: { TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN },
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
