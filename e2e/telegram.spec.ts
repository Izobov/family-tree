import { test, expect, type Page } from '@playwright/test';
import { signInitData, stubScript } from './telegram-helpers';

/** Уникальны на прогон: тесты идут против живого проекта Supabase. */
const stamp = Date.now();
const newTgId = stamp % 1_000_000_000;
const linkTgId = (stamp % 1_000_000_000) + 1;
const email = `e2e-tg-${stamp}@example.com`;
const password = 'test-password-123';

async function asTelegramUser(page: Page, initData: string) {
  await page.addInitScript({ content: stubScript(initData) });
}

test('регистрация прямо из Telegram, минуя login и signup', async ({ page }) => {
  await asTelegramUser(page, signInitData({ id: newTgId, first_name: 'Тимур' }));

  await page.goto('/telegram');

  // Незнакомый Telegram — предлагается выбор.
  await expect(page.getByRole('button', { name: 'Создать новое дерево' })).toBeVisible();
  await page.getByRole('button', { name: 'Создать новое дерево' }).click();

  // Ни /login, ни /signup по пути не встретилось: сразу онбординг.
  await expect(page.getByRole('heading', { name: 'Расскажите о себе' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');

  await page.getByLabel('Имя').fill('Тимур');
  await page.getByLabel('Фамилия').fill('Тестов');
  await page.getByRole('button', { name: 'Создать дерево' }).click();

  await expect(page.locator('.ft-card').first()).toBeVisible();
  await expect(page.locator('.ft-card')).toContainText('Тимур');

  /**
   * Оверлей открывается через preloadData + pushState, то есть асинхронно.
   * Без ожидания заголовка URL читается до смены и personId выходит undefined.
   */
  await page.locator('.ft-card--main').click();
  await expect(page.getByRole('heading', { name: 'Тимур Тестов' })).toBeVisible();
  const personId = new URL(page.url()).pathname.split('/')[2];
  expect(personId).toBeTruthy();

  // Второй заход тем же Telegram — уже без единого экрана, сразу дерево.
  await page.context().clearCookies();
  await page.goto('/telegram');
  await expect(page.locator('.ft-card').first()).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');

  // Уборка: людей удаляем штатным флоу, аккаунт остаётся (см. README).
  await page.goto(`/person/${personId}/delete`);
  await page.getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByRole('heading', { name: 'Расскажите о себе' })).toBeVisible();
});

test('привязка Telegram к существующему аккаунту', async ({ page }) => {
  // Сначала заводим обычный аккаунт с паролем.
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  await expect(page.getByRole('heading', { name: 'Расскажите о себе' })).toBeVisible();
  await page.getByLabel('Имя').fill('Ольга');
  await page.getByLabel('Фамилия').fill('Существующая');
  await page.getByRole('button', { name: 'Создать дерево' }).click();
  await expect(page.locator('.ft-card')).toContainText('Ольга');

  await page.locator('.ft-card--main').click();
  await expect(page.getByRole('heading', { name: 'Ольга Существующая' })).toBeVisible();
  const personId = new URL(page.url()).pathname.split('/')[2];
  expect(personId).toBeTruthy();

  // Выходим и приходим заново — уже из Telegram, с другим telegram_id.
  await page.context().clearCookies();
  await asTelegramUser(page, signInitData({ id: linkTgId, first_name: 'Ольга' }));
  await page.goto('/telegram');

  await page.getByRole('button', { name: 'У меня уже есть аккаунт' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти и привязать' }).click();

  // Попали в СВОЁ дерево, а не в новое пустое.
  await expect(page.locator('.ft-card')).toContainText('Ольга');

  // И дальше пароль уже не спрашивают.
  await page.context().clearCookies();
  await page.goto('/telegram');
  await expect(page.locator('.ft-card')).toContainText('Ольга');

  await page.goto(`/person/${personId}/delete`);
  await page.getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByRole('heading', { name: 'Расскажите о себе' })).toBeVisible();
});

test('неверная подпись не пускает', async ({ page }) => {
  const tampered = signInitData({ id: 555, first_name: 'Мэллори' }, 'wrong:token');
  await asTelegramUser(page, tampered);

  await page.goto('/telegram');

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Создать новое дерево' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/telegram');
});
