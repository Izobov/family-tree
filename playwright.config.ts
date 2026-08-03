import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
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
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
