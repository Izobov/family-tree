import { test, expect } from '@playwright/test';

/** Уникальный email на прогон: подтверждение email в проекте выключено. */
const email = `e2e-${Date.now()}@example.com`;
const password = 'test-password-123';

test('регистрация, построение дерева, правка, событие', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  // Онбординг: первый человек становится корнем.
  await expect(page.getByRole('heading', { name: 'Расскажите о себе' })).toBeVisible();
  await page.getByLabel('Имя').fill('Иван');
  await page.getByLabel('Фамилия').fill('Изобов');
  await page.getByLabel('Дата рождения').fill('1990-05-15');
  await page.getByRole('button', { name: 'Создать дерево' }).click();

  // Дерево нарисовалось.
  await expect(page.locator('.ft-card').first()).toBeVisible();
  await expect(page.locator('.ft-card')).toContainText('Иван');

  // Тап по карточке в фокусе раскрывает полный экран (оверлей поверх дерева,
  // подключён через shallow routing — URL меняется на /person/<id>, само
  // дерево остаётся смонтированным).
  await page.locator('.ft-card--main').click();
  await expect(page.getByRole('heading', { name: 'Иван Изобов' })).toBeVisible();
  const ivanUrl = new URL(page.url());
  expect(ivanUrl.pathname).toMatch(/^\/person\//);
  const ivanId = ivanUrl.pathname.split('/')[2];

  // Добавляем отца.
  await page.getByRole('link', { name: 'Добавить родственника' }).click();
  await page.getByRole('link', { name: 'Отца' }).click();
  await page.getByLabel('Имя').fill('Пётр');
  await page.getByLabel('Фамилия').fill('Изобов');
  await page.getByLabel('Дата рождения').fill('1960-07-31');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('heading', { name: 'Пётр Изобов' })).toBeVisible();
  const petrUrl = new URL(page.url());
  expect(petrUrl.pathname).toMatch(/^\/person\//);
  const petrId = petrUrl.pathname.split('/')[2];

  // Правка: валидация телефона отклоняет мусор.
  await page.goto(petrUrl.pathname + '?edit=1');
  await page.getByLabel('Телефон').fill('8916');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Телефон в формате +79161234567')).toBeVisible();

  // Корректный телефон сохраняется и даёт кнопку WhatsApp.
  await page.getByLabel('Телефон').fill('+79161234567');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toBeVisible();

  // В дереве два человека.
  await page.goto('/');
  await expect(page.locator('.ft-card')).toHaveCount(2);

  // Быстрое создание: «+» в нижней панели заводит человека вообще без связей.
  // В диаграмме его закономерно нет — family-chart рисует только тех, кто
  // связан с человеком в фокусе, — поэтому карточек по-прежнему две. Найти
  // его можно в списке «Все», оттуда же и связать позже.
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByRole('heading', { name: 'Новый человек' })).toBeVisible();
  await page.getByLabel('Имя').fill('Сергей');
  await page.getByLabel('Фамилия').fill('Волков');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByRole('heading', { name: 'Сергей Волков' })).toBeVisible();
  const sergeyId = new URL(page.url()).pathname.split('/')[2];

  await page.goto('/');
  await expect(page.locator('.ft-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Все' }).click();
  await expect(page.getByText('Сергей Волков')).toBeVisible();

  // Переключение языка.
  await page.goto('/');
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('link', { name: 'Tree' })).toBeVisible();

  // Уборка за собой: тест создаёт реальные записи в живом проекте Supabase,
  // поэтому прогон обязан оставить базу такой же, какой её нашёл — только
  // через штатный флоу удаления, без прямого доступа к БД. Удаляем отца
  // первым (root ещё жив, дерево рисуется штатно), затем корень — экран
  // возвращается к онбордингу, что само по себе подтверждает, что людей
  // в дереве больше не осталось.
  await page.goto(`/person/${sergeyId}/delete`);
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL('/');

  await page.goto(`/person/${petrId}/delete`);
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL('/');

  await page.goto(`/person/${ivanId}/delete`);
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'Tell us about yourself' })).toBeVisible();
});
