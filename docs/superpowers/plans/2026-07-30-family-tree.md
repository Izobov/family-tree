# Family Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Двуязычное PWA для построения семейного дерева с редактированием членов семьи и уведомлениями о днях рождения и годовщинах.

**Architecture:** SvelteKit с form actions и серверным клиентом `@supabase/ssr` (сессия в httpOnly-куках, RLS как вторая линия обороны). Дерево рисует `family-chart` на d3, изолированная в двух файлах. Полный экран человека — реальный маршрут, открываемый через shallow routing, чтобы диаграмма не пересоздавалась. Уведомления — экран «Ближайшие события» плюс Web Push из Vercel Cron.

**Tech Stack:** SvelteKit 2.70 + Svelte 5.56, TypeScript, Supabase (Postgres + Auth), `@supabase/ssr` 0.12, `family-chart` 0.9, `web-push` 3.6, Vitest 4, Playwright, `@sveltejs/adapter-vercel` 6.

**Спека:** `docs/superpowers/specs/2026-07-30-family-tree-design.md`

## Global Constraints

- **Без Tailwind.** Только обычный CSS и CSS custom properties.
- Локали ровно две: `ru` и `en`. `ru` — язык по умолчанию.
- Пол только `'male' | 'female'` в БД, `'M' | 'F'` в формате family-chart.
- Supabase проект: `upajaaztxuldkqocjjse`.
- Ключ для фронтенда — **publishable** (`PUBLIC_SUPABASE_PUBLISHABLE_KEY`), не legacy `anon`. Секретный ключ (`SUPABASE_SECRET_KEY`) используется только в `/api/cron/events` и никогда не импортируется в файлы без суффикса `.server`.
- Все RLS-политики объявляются с `to authenticated` и `(select auth.uid())` в подзапросе.
- Все таблицы в `public` требуют явного `grant` для `authenticated`: с 2026-04-28 Supabase не экспонирует новые таблицы в Data API автоматически.
- Версии пакетов пиновать точными (`--save-exact`), `package-lock.json` коммитить.
- Про `family-chart` знают только `src/lib/components/FamilyTree.svelte` и `src/lib/tree/card.ts`. Никакой другой файл не импортирует `family-chart`.
- Даты в БД — `date` (без времени). В коде — ISO-строки `YYYY-MM-DD`.
- Все пользовательские строки идут через `i18n`. Хардкод русского или английского текста в компонентах запрещён.
- **`parent()` есть только у `load`-событий, у form actions его нет.** В actions дерево и людей получаем через `requireTree(locals.supabase, userId)` и `fetchPeople(locals.supabase, treeId)` из `$lib/server/people`.
- **Все вызовы `supabase db query` идут с флагом `--linked`.** По умолчанию CLI работает с локальной базой в Docker, которая здесь не поднята. Пароль БД нигде не нужен — CLI авторизован и ходит через Management API.
- **Настройки проекта Supabase меняем через `supabase/config.toml` + `supabase config push`**, а не кликами в дашборде: так изменение попадает в git и воспроизводится.
- **`trees.owner_id` уникален** (вторая миграция, добавлена при доработке задачи 5). Один пользователь — одно дерево, инвариант держит БД. Это то, что делает `ensureTree` безопасным при гонке и делает `.maybeSingle()` в `loadTree` доказуемо корректным.
- **Дерево и настройки создаёт только `ensureTree` в `(app)/+layout.server.ts`.** Регистрация их не создаёт: две вставки из клиента неатомарны, и при частичном сбое пользователь остался бы с сессией, но без дерева и без пути починиться.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `src/lib/types.ts` | Типы строк БД: `Person`, `Spouse`, `Tree`, `UserSettings`, `Locale` |
| `src/lib/i18n/ru.ts` | Русский словарь — источник истины по набору ключей |
| `src/lib/i18n/en.ts` | Английский словарь, `satisfies typeof ru` |
| `src/lib/i18n/index.ts` | `dict()`, `parseLocale()`, форматтеры дат, возраста, продолжительности жизни |
| `src/lib/tree/invariants.ts` | Чистые проверки: цикл предков, пол родителя, валидация полей |
| `src/lib/tree/to-family-chart.ts` | Нормализованные строки БД → избыточный граф family-chart |
| `src/lib/tree/card.ts` | HTML одной карточки, инициалы |
| `src/lib/events/upcoming.ts` | Люди и браки → события в окне дат |
| `src/lib/server/supabase.ts` | Серверный клиент под секретным ключом (только для крона) |
| `src/lib/server/people.ts` | Чтение и запись `people`/`spouses`, применение инвариантов |
| `src/lib/server/push.ts` | Отправка Web Push, удаление мёртвых подписок |
| `src/lib/components/FamilyTree.svelte` | Единственный владелец API family-chart |
| `src/lib/components/PersonForm.svelte` | Форма человека, используется на просмотре и создании |
| `src/lib/components/ContactRow.svelte` | Кнопки контактов из полей человека |
| `src/lib/components/LangSwitch.svelte` | Переключатель локали |
| `src/lib/components/OfflineBanner.svelte` | Баннер отсутствия сети |
| `src/lib/styles/tokens.css` | Токены дизайна, светлая и тёмная тема |
| `src/lib/styles/cards.css` | Глобальные стили карточек (scoped-стили до них не долетают) |
| `src/hooks.server.ts` | Клиент Supabase на запрос, локаль, guard маршрутов |
| `src/service-worker.ts` | Precache, офлайн-фоллбэк, обработчики `push` |
| `supabase/migrations/*.sql` | Схема, RLS, grant'ы |

---

## Задачи

Фаза 1 (задачи 1–18) даёт работающее задеплоенное приложение без уведомлений.
Фаза 2 (задачи 19–22) добавляет «Ближайшие события» и Web Push.

---

### Task 1: Каркас проекта, токены стилей, smoke-тест

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json` (генерируются)
- Create: `src/lib/styles/tokens.css`
- Create: `src/routes/+layout.svelte`, `src/app.css`
- Modify: `src/app.html`
- Test: `src/lib/styles/tokens.test.ts`

**Interfaces:**
- Consumes: ничего
- Produces: работающий `npm run dev`, `npm run build`, `npm run test:unit`; CSS-переменные `--bg`, `--fg`, `--muted`, `--accent-male`, `--accent-female`, `--card-bg`, `--radius`, `--shadow-1`, `--shadow-2`, `--space-1..5`, `--font-1..5`

- [ ] **Step 1: Создать проект SvelteKit**

```bash
cd D:/IT/pet_projects/family-tree
npx sv@0.16.6 create . --template minimal --types ts --no-add-ons --install npm
```

Если `sv` спросит про непустой каталог — подтвердить (в репозитории только `docs/`, `.git`, `.claude`).

- [ ] **Step 2: Поставить зависимости точными версиями**

```bash
npm install --save-exact @supabase/ssr@0.12.4 @supabase/supabase-js family-chart@0.9.0
npm install --save-exact -D @sveltejs/adapter-vercel@6.3.4 vitest@4.1.10 @playwright/test jsdom
```

- [ ] **Step 3: Прописать adapter-vercel и скрипты**

`svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ runtime: 'nodejs22.x' }),
    serviceWorker: { register: false }
  }
};
```

В `package.json` в `"scripts"` добавить:

```json
"test:unit": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

В `vite.config.ts` добавить блок `test`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
```

- [ ] **Step 4: Написать токены**

`src/lib/styles/tokens.css`:

```css
:root {
  --bg: #faf8f5;
  --surface: #ffffff;
  --card-bg: #ffffff;
  --fg: #1c1a17;
  --muted: #6f6960;
  --line: #e4ded5;
  --accent: #7a5c3e;
  --accent-male: #4a6d7c;
  --accent-female: #a8734f;
  --danger: #a4342b;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow-1: 0 1px 2px rgb(28 26 23 / 8%);
  --shadow-2: 0 6px 20px rgb(28 26 23 / 16%);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 20px;
  --space-5: 32px;
  --font-1: 12px;
  --font-2: 14px;
  --font-3: 16px;
  --font-4: 20px;
  --font-5: 28px;
  --tap: 44px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #161513;
    --surface: #211f1c;
    --card-bg: #262320;
    --fg: #f2ece4;
    --muted: #a29a8f;
    --line: #383430;
    --accent: #c8a179;
    --accent-male: #7fa8ba;
    --accent-female: #d3a37c;
    --danger: #e0796e;
    --shadow-1: 0 1px 2px rgb(0 0 0 / 40%);
    --shadow-2: 0 6px 20px rgb(0 0 0 / 55%);
  }
}
```

`src/app.css`:

```css
@import './lib/styles/tokens.css';

* { box-sizing: border-box; }

html, body {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--fg);
  font: var(--font-3)/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
  -webkit-text-size-adjust: 100%;
}

button, input, select, textarea { font: inherit; color: inherit; }

button {
  min-height: var(--tap);
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  padding: 0 var(--space-4);
}

button:disabled { opacity: 0.5; cursor: not-allowed; }
```

`src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

- [ ] **Step 5: Написать падающий тест на наличие токенов**

`src/lib/styles/tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/lib/styles/tokens.css', 'utf8');

describe('tokens.css', () => {
  it('объявляет все токены, на которые опираются компоненты', () => {
    const required = [
      '--bg', '--surface', '--card-bg', '--fg', '--muted', '--line',
      '--accent', '--accent-male', '--accent-female', '--danger',
      '--radius', '--radius-sm', '--shadow-1', '--shadow-2',
      '--space-1', '--space-2', '--space-3', '--space-4', '--space-5',
      '--font-1', '--font-2', '--font-3', '--font-4', '--font-5', '--tap'
    ];
    for (const token of required) {
      expect(css, `отсутствует ${token}`).toContain(`${token}:`);
    }
  });

  it('переопределяет тему в prefers-color-scheme: dark', () => {
    expect(css).toContain('prefers-color-scheme: dark');
  });
});
```

- [ ] **Step 6: Прогнать тест и сборку**

```bash
npm run test:unit
npm run build
```

Ожидается: тест PASS, сборка без ошибок.

- [ ] **Step 7: Коммит**

```bash
git add -A
git commit -m "feat: каркас SvelteKit, adapter-vercel, токены дизайна"
```

---

### Task 2: i18n — словари и форматтеры

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/i18n/ru.ts`, `src/lib/i18n/en.ts`, `src/lib/i18n/index.ts`
- Test: `src/lib/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: ничего
- Produces:
  - `type Locale = 'ru' | 'en'`
  - `type Dict = typeof ru`
  - `dict(locale: Locale): Dict`
  - `parseLocale(value: string | null | undefined): Locale`
  - `formatDate(iso: string, locale: Locale): string`
  - `formatYears(birth: string | null, died: string | null, locale: Locale, today?: Date): string`
  - `plural(n: number, forms: [string, string, string]): string`

- [ ] **Step 1: Написать падающий тест**

`src/lib/i18n/i18n.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ru } from './ru';
import { en } from './en';
import { dict, parseLocale, formatDate, formatYears } from './index';

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

describe('словари', () => {
  it('en содержит все ключи ru и наоборот', () => {
    expect(keys(en).sort()).toEqual(keys(ru).sort());
  });

  it('dict отдаёт нужный словарь', () => {
    expect(dict('ru')).toBe(ru);
    expect(dict('en')).toBe(en);
  });
});

describe('parseLocale', () => {
  it('распознаёт точное значение', () => {
    expect(parseLocale('en')).toBe('en');
    expect(parseLocale('ru')).toBe('ru');
  });

  it('распознаёт Accept-Language', () => {
    expect(parseLocale('en-US,en;q=0.9')).toBe('en');
    expect(parseLocale('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru');
  });

  it('падает в ru на мусоре и пустоте', () => {
    expect(parseLocale(null)).toBe('ru');
    expect(parseLocale('')).toBe('ru');
    expect(parseLocale('de-DE')).toBe('ru');
  });
});

describe('formatDate', () => {
  it('форматирует по локали', () => {
    expect(formatDate('1948-03-07', 'ru')).toBe('7 марта 1948 г.');
    expect(formatDate('1948-03-07', 'en')).toBe('March 7, 1948');
  });
});

describe('formatYears', () => {
  const today = new Date('2026-07-30T00:00:00Z');

  it('живой: год рождения и возраст', () => {
    expect(formatYears('1948-03-07', null, 'ru', today)).toBe('1948 — 78 лет');
    expect(formatYears('1948-03-07', null, 'en', today)).toBe('1948 — 78 years');
  });

  it('русские склонения возраста', () => {
    expect(formatYears('2025-01-01', null, 'ru', today)).toBe('2025 — 1 год');
    expect(formatYears('2023-01-01', null, 'ru', today)).toBe('2023 — 3 года');
    expect(formatYears('2021-01-01', null, 'ru', today)).toBe('2021 — 5 лет');
  });

  it('день рождения ещё не наступил в этом году', () => {
    expect(formatYears('1948-12-31', null, 'ru', today)).toBe('1948 — 77 лет');
  });

  it('умерший: интервал лет, без возраста', () => {
    expect(formatYears('1948-03-07', '2011-06-01', 'ru', today)).toBe('1948–2011');
  });

  it('без даты рождения — пустая строка', () => {
    expect(formatYears(null, null, 'ru', today)).toBe('');
  });

  it('без даты рождения, но с датой смерти', () => {
    expect(formatYears(null, '2011-06-01', 'ru', today)).toBe('† 2011');
  });
});
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

```bash
npm run test:unit -- src/lib/i18n/i18n.test.ts
```

Ожидается: FAIL, `Cannot find module './ru'`.

- [ ] **Step 3: Написать типы БД**

`src/lib/types.ts`:

```ts
export type Locale = 'ru' | 'en';
export type Gender = 'male' | 'female';

export interface Person {
  id: string;
  tree_id: string;
  first_name: string;
  last_name: string | null;
  gender: Gender;
  birth_date: string | null;
  died_on: string | null;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  instagram: string | null;
  about: string | null;
}

export interface Spouse {
  tree_id: string;
  person_a_id: string;
  person_b_id: string;
  married_on: string | null;
}

export interface Tree {
  id: string;
  owner_id: string;
  name: string;
  root_person_id: string | null;
}

export interface UserSettings {
  user_id: string;
  locale: Locale;
  push_enabled: boolean;
  lead_days: number;
}
```

- [ ] **Step 4: Написать русский словарь**

`src/lib/i18n/ru.ts`:

```ts
export const ru = {
  app: { name: 'Семейное дерево', myTree: 'Моё дерево' },
  nav: { tree: 'Дерево', events: 'События', settings: 'Настройки', signOut: 'Выйти' },
  auth: {
    signInTitle: 'Вход',
    signUpTitle: 'Регистрация',
    email: 'Email',
    password: 'Пароль',
    signIn: 'Войти',
    signUp: 'Зарегистрироваться',
    toSignUp: 'Нет аккаунта? Зарегистрируйтесь',
    toSignIn: 'Уже есть аккаунт? Войдите',
    invalidCredentials: 'Неверный email или пароль',
    emailTaken: 'Этот email уже занят',
    passwordTooShort: 'Пароль короче 6 символов'
  },
  onboarding: {
    title: 'Расскажите о себе',
    hint: 'С вас начнётся дерево. Остальных добавите потом.',
    submit: 'Создать дерево'
  },
  person: {
    firstName: 'Имя',
    lastName: 'Фамилия',
    gender: 'Пол',
    male: 'Мужской',
    female: 'Женский',
    birthDate: 'Дата рождения',
    diedOn: 'Дата смерти',
    about: 'О человеке',
    email: 'Email',
    phone: 'Телефон',
    telegram: 'Telegram',
    instagram: 'Instagram',
    contacts: 'Связаться',
    relatives: 'Родственники',
    parents: 'Родители',
    spouses: 'Супруги',
    children: 'Дети',
    siblings: 'Братья и сёстры',
    edit: 'Изменить',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    showInTree: 'Показать в дереве',
    addRelative: 'Добавить родственника',
    addFather: 'Отца',
    addMother: 'Мать',
    addSpouse: 'Супруга',
    addChild: 'Ребёнка',
    marriedOn: 'Дата свадьбы',
    noData: 'Не указано',
    ageYears: ['год', 'года', 'лет'] as [string, string, string]
  },
  errors: {
    fatherMustBeMale: 'Отцом можно указать только мужчину',
    motherMustBeFemale: 'Матерью можно указать только женщину',
    cycle: 'Так человек станет своим собственным предком',
    selfParent: 'Человек не может быть своим родителем',
    otherTree: 'Этот человек из другого дерева',
    diedBeforeBorn: 'Дата смерти раньше даты рождения',
    firstNameRequired: 'Имя обязательно',
    badPhone: 'Телефон в формате +79161234567',
    badUsername: 'Только латиница, цифры, точка и подчёркивание',
    notFound: 'Человек не найден',
    unavailable: 'Сервис недоступен. Попробуйте позже.'
  },
  deleteDialog: {
    title: 'Удалить человека?',
    orphans: 'Останутся без родителя:',
    confirm: 'Удалить',
    cancel: 'Отмена'
  },
  events: {
    title: 'Ближайшие события',
    today: 'Сегодня',
    thisWeek: 'На этой неделе',
    thisMonth: 'В этом месяце',
    empty: 'В ближайшее время событий нет',
    birthday: 'День рождения',
    anniversary: 'Годовщина свадьбы',
    turns: 'исполняется',
    yearsTogether: 'лет вместе'
  },
  settings: {
    title: 'Настройки',
    language: 'Язык',
    notifications: 'Уведомления',
    enablePush: 'Включить уведомления',
    disablePush: 'Отключить уведомления',
    pushOn: 'Уведомления включены',
    pushOff: 'Уведомления выключены',
    leadDays: 'Предупреждать за (дней)',
    iosTitle: 'На iPhone и iPad',
    iosHint: 'Уведомления работают только у приложения, установленного на домашний экран: откройте «Поделиться» и выберите «На экран „Домой“».',
    unsupported: 'Этот браузер не поддерживает уведомления'
  },
  offline: { banner: 'Нет сети. Дерево доступно только для просмотра.' }
};
```

- [ ] **Step 5: Написать английский словарь**

`src/lib/i18n/en.ts`:

```ts
import type { ru } from './ru';

export const en = {
  app: { name: 'Family Tree', myTree: 'My tree' },
  nav: { tree: 'Tree', events: 'Events', settings: 'Settings', signOut: 'Sign out' },
  auth: {
    signInTitle: 'Sign in',
    signUpTitle: 'Sign up',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signUp: 'Sign up',
    toSignUp: 'No account? Sign up',
    toSignIn: 'Already have an account? Sign in',
    invalidCredentials: 'Wrong email or password',
    emailTaken: 'This email is already taken',
    passwordTooShort: 'Password is shorter than 6 characters'
  },
  onboarding: {
    title: 'Tell us about yourself',
    hint: 'The tree starts with you. Add everyone else later.',
    submit: 'Create tree'
  },
  person: {
    firstName: 'First name',
    lastName: 'Last name',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    birthDate: 'Date of birth',
    diedOn: 'Date of death',
    about: 'About',
    email: 'Email',
    phone: 'Phone',
    telegram: 'Telegram',
    instagram: 'Instagram',
    contacts: 'Get in touch',
    relatives: 'Relatives',
    parents: 'Parents',
    spouses: 'Spouses',
    children: 'Children',
    siblings: 'Siblings',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    showInTree: 'Show in tree',
    addRelative: 'Add relative',
    addFather: 'Father',
    addMother: 'Mother',
    addSpouse: 'Spouse',
    addChild: 'Child',
    marriedOn: 'Wedding date',
    noData: 'Not set',
    ageYears: ['year', 'years', 'years'] as [string, string, string]
  },
  errors: {
    fatherMustBeMale: 'Only a male person can be a father',
    motherMustBeFemale: 'Only a female person can be a mother',
    cycle: 'This would make the person their own ancestor',
    selfParent: 'A person cannot be their own parent',
    otherTree: 'This person belongs to another tree',
    diedBeforeBorn: 'Date of death is before date of birth',
    firstNameRequired: 'First name is required',
    badPhone: 'Phone must look like +19165551234',
    badUsername: 'Latin letters, digits, dot and underscore only',
    notFound: 'Person not found',
    unavailable: 'Service is unavailable. Try again later.'
  },
  deleteDialog: {
    title: 'Delete this person?',
    orphans: 'Will be left without a parent:',
    confirm: 'Delete',
    cancel: 'Cancel'
  },
  events: {
    title: 'Upcoming events',
    today: 'Today',
    thisWeek: 'This week',
    thisMonth: 'This month',
    empty: 'Nothing coming up',
    birthday: 'Birthday',
    anniversary: 'Wedding anniversary',
    turns: 'turns',
    yearsTogether: 'years together'
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    notifications: 'Notifications',
    enablePush: 'Enable notifications',
    disablePush: 'Disable notifications',
    pushOn: 'Notifications are on',
    pushOff: 'Notifications are off',
    leadDays: 'Notify this many days ahead',
    iosTitle: 'On iPhone and iPad',
    iosHint: 'Notifications only work for an app installed on the home screen: open Share and pick “Add to Home Screen”.',
    unsupported: 'This browser does not support notifications'
  },
  offline: { banner: 'No connection. The tree is view-only.' }
} satisfies typeof ru;
```

- [ ] **Step 6: Написать `index.ts`**

`src/lib/i18n/index.ts`:

```ts
import type { Locale } from '$lib/types';
import { ru } from './ru';
import { en } from './en';

export type Dict = typeof ru;
export const locales: Locale[] = ['ru', 'en'];
export const defaultLocale: Locale = 'ru';

const dicts: Record<Locale, Dict> = { ru, en };

export function dict(locale: Locale): Dict {
  return dicts[locale];
}

export function parseLocale(value: string | null | undefined): Locale {
  if (!value) return defaultLocale;
  for (const part of value.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase().slice(0, 2);
    if (tag === 'en' || tag === 'ru') return tag;
  }
  return defaultLocale;
}

/** Русские склонения: 1 год, 2 года, 5 лет. */
export function plural(n: number, forms: [string, string, string]): string {
  const rules = new Intl.PluralRules('ru-RU');
  const category = rules.select(n);
  if (category === 'one') return forms[0];
  if (category === 'few') return forms[1];
  return forms[2];
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${iso}T00:00:00Z`));
}

function yearsBetween(fromIso: string, to: Date): number {
  const [y, m, d] = fromIso.split('-').map(Number);
  let age = to.getUTCFullYear() - y;
  const monthNow = to.getUTCMonth() + 1;
  const dayNow = to.getUTCDate();
  if (monthNow < m || (monthNow === m && dayNow < d)) age -= 1;
  return age;
}

export function formatYears(
  birth: string | null,
  died: string | null,
  locale: Locale,
  today: Date = new Date()
): string {
  if (!birth && !died) return '';
  if (!birth && died) return `† ${died.slice(0, 4)}`;
  if (birth && died) return `${birth.slice(0, 4)}–${died.slice(0, 4)}`;

  const age = yearsBetween(birth!, today);
  const unit =
    locale === 'ru'
      ? plural(age, dict('ru').person.ageYears)
      : age === 1
        ? 'year'
        : 'years';
  return `${birth!.slice(0, 4)} — ${age} ${unit}`;
}
```

- [ ] **Step 7: Прогнать тест**

```bash
npm run test:unit -- src/lib/i18n/i18n.test.ts
```

Ожидается: PASS (все 12 проверок).

- [ ] **Step 8: Коммит**

```bash
git add src/lib/types.ts src/lib/i18n
git commit -m "feat: двуязычные словари ru/en и форматтеры дат через Intl"
```

---

### Task 3: Схема БД, RLS, экспозиция в Data API

**Files:**
- Create: `supabase/migrations/<timestamp>_init.sql`
- Create: `.env.example`
- Modify: `.gitignore` (добавить `.env`)

**Interfaces:**
- Consumes: ничего
- Produces: таблицы `trees`, `people`, `spouses`, `user_settings`, `push_subscriptions`, `notifications_sent` с RLS и grant'ами в проекте `upajaaztxuldkqocjjse`

- [ ] **Step 1: Инициализировать проект Supabase**

Проект **уже слинкован** контроллером (`supabase link --project-ref upajaaztxuldkqocjjse`
выполнен, каталог `supabase/.temp` на месте). Пароль БД не нужен: CLI авторизован и ходит
к удалённой базе через login role и Management API.

Осталось создать `config.toml` — без него `supabase migration new` не заработает:

```bash
supabase init
```

Если CLI спросит про перезапись — отвечать «нет» ни на что не придётся, каталог пуст,
кроме `.temp`. На вопросы про настройки редакторов отвечать отказом.

Проверить связь с удалённой базой:

```bash
supabase migration list --linked
```

Ожидается пустая таблица Local/Remote — миграций пока нет. Если команда не подключилась,
это блокер: сообщить и остановиться, не пытаясь обойти через пароль или `db-url`.

- [ ] **Step 2: Создать файл миграции**

```bash
supabase migration new init
```

Никогда не придумывать имя файла руками — CLI сам ставит корректный timestamp.

- [ ] **Step 3: Записать схему в созданный файл**

Содержимое `supabase/migrations/<timestamp>_init.sql`:

```sql
create table trees (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  root_person_id uuid,
  created_at     timestamptz not null default now()
);

create table people (
  id         uuid primary key default gen_random_uuid(),
  tree_id    uuid not null references trees(id) on delete cascade,
  first_name text not null,
  last_name  text,
  gender     text not null check (gender in ('male','female')),
  birth_date date,
  died_on    date,
  email      text,
  phone      text,
  telegram   text,
  instagram  text,
  about      text,
  father_id  uuid references people(id) on delete set null,
  mother_id  uuid references people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (father_id is null or father_id <> id),
  check (mother_id is null or mother_id <> id),
  check (died_on is null or birth_date is null or died_on >= birth_date)
);

create table spouses (
  tree_id     uuid not null references trees(id) on delete cascade,
  person_a_id uuid not null references people(id) on delete cascade,
  person_b_id uuid not null references people(id) on delete cascade,
  married_on  date,
  primary key (person_a_id, person_b_id),
  check (person_a_id < person_b_id)
);

alter table trees add constraint trees_root_fk
  foreign key (root_person_id) references people(id) on delete set null;

create table user_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  locale       text not null default 'ru' check (locale in ('ru','en')),
  push_enabled boolean not null default false,
  lead_days    int not null default 3 check (lead_days between 0 and 30)
);

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create table notifications_sent (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('birthday','anniversary')),
  subject_key text not null,
  event_date  date not null,
  sent_at     timestamptz not null default now(),
  primary key (user_id, kind, subject_key, event_date)
);

create index people_tree_idx   on people(tree_id);
create index people_father_idx on people(father_id);
create index people_mother_idx on people(mother_id);
create index spouses_tree_idx  on spouses(tree_id);
create index push_user_idx     on push_subscriptions(user_id);
create index trees_owner_idx   on trees(owner_id);

-- RLS

alter table trees              enable row level security;
alter table people             enable row level security;
alter table spouses            enable row level security;
alter table user_settings      enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications_sent enable row level security;

create policy trees_owner on trees for all
  to authenticated
  using      (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy people_owner on people for all
  to authenticated
  using      (exists (select 1 from trees t
                      where t.id = people.tree_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from trees t
                      where t.id = people.tree_id and t.owner_id = (select auth.uid())));

create policy spouses_owner on spouses for all
  to authenticated
  using      (exists (select 1 from trees t
                      where t.id = spouses.tree_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from trees t
                      where t.id = spouses.tree_id and t.owner_id = (select auth.uid())));

create policy settings_own on user_settings for all
  to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy subs_own on push_subscriptions for all
  to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- notifications_sent: политик нет, доступ только под секретным ключом

-- Экспозиция в Data API. С 2026-04-28 новые таблицы в public не экспонируются
-- автоматически, поэтому grant'ы обязательны.

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on table trees, people, spouses, user_settings, push_subscriptions
  to authenticated;
```

- [ ] **Step 4: Применить миграцию**

```bash
supabase db push --linked
supabase migration list --linked
```

Ожидается: миграция значится применённой и локально, и на удалённом проекте.

- [ ] **Step 5: Проверить советники безопасности**

```bash
supabase db advisors --linked
```

Ожидается: нет предупреждений уровня ERROR про отсутствие RLS. Предупреждения про `notifications_sent` («RLS enabled, no policies») — ожидаемы и корректны, таблица нужна только серверу.

- [ ] **Step 6: Проверить, что Data API реально отдаёт таблицы**

```bash
supabase db query --linked "select tablename from pg_tables where schemaname='public' order by tablename"
```

Ожидается 6 строк: `notifications_sent`, `people`, `push_subscriptions`, `spouses`, `trees`, `user_settings`.

Флаг `--linked` обязателен во **всех** вызовах `supabase db query` в этом плане: без него
CLI по умолчанию идёт в локальную базу (`--local` включён по умолчанию), а локальный
Postgres в Docker здесь не поднят, и команда упадёт на `dial tcp 127.0.0.1:54322`.

- [ ] **Step 7: Выключить подтверждение email через config.toml**

Причина: на Free-плане с дефолтным SMTP письма жёстко лимитированы, а с 2026-06-03 новым
проектам ещё и запрещено кастомизировать шаблоны. Без этого шага регистрация будет молча
не завершаться, и задача 5 не пройдёт проверку.

Делаем декларативно, а не кликами в дашборде. В `supabase/config.toml` найти секцию
`[auth.email]` и выставить:

```toml
[auth.email]
enable_confirmations = false
```

Затем залить конфиг в проект:

```bash
supabase config push
```

CLI покажет diff того, что изменится на удалённом проекте, и попросит подтверждение.
**Прочитать этот diff.** Ожидается изменение только `mailer_autoconfirm` (обратная сторона
`enable_confirmations`). Если CLI собирается поменять что-то ещё существенное — например
включить или выключить провайдеров входа, — остановиться и сообщить: `config push` заливает
всю секцию `[auth]`, а не одно поле.

Проверить, что применилось:

```bash
supabase config push
```

Повторный запуск на неизменённом конфиге должен сообщить, что расхождений нет.

Отдельно зафиксировать в отчёте: `supabase init` пишет в `config.toml`
`site_url = "http://localhost:3000"`, и `config push` отправляет это значение на проект.
Для входа по паролю без подтверждения email это ни на что не влияет, но задача 19 (деплой)
должна будет поменять `site_url` на продакшен-URL. Не менять его сейчас.

- [ ] **Step 8: Записать `.env.example` и защитить `.env`**

`.env.example`:

```
PUBLIC_SUPABASE_URL=https://upajaaztxuldkqocjjse.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:izobov9@gmail.com
CRON_SECRET=
```

В `.gitignore` добавить строку `.env`.

Скопировать `.env.example` в `.env` и заполнить `PUBLIC_SUPABASE_PUBLISHABLE_KEY` и `SUPABASE_SECRET_KEY` из Dashboard → Settings → API keys. VAPID и `CRON_SECRET` заполним в задаче 21.

- [ ] **Step 9: Коммит**

```bash
git add supabase .env.example .gitignore
git commit -m "feat: схема БД, RLS-политики и grant'ы для Data API"
```

---

### Task 4: Клиент Supabase, сессия, локаль, guard

**Files:**
- Create: `src/hooks.server.ts`, `src/app.d.ts`
- Create: `src/routes/+layout.server.ts`
- Modify: `src/app.html`, `src/routes/+layout.svelte`
- Test: вручную через `npm run dev` + `npm run check`

**Interfaces:**
- Consumes: `parseLocale`, `dict` из `$lib/i18n`
- Produces:
  - `event.locals.supabase: SupabaseClient`
  - `event.locals.safeGetSession(): Promise<{ userId: string | null }>`
  - `event.locals.locale: Locale`
  - в `+layout.server.ts` — `{ userId, locale }` в `data`
  - guard: неавторизованный запрос к `/`, `/person/*`, `/events`, `/settings` → редирект на `/login?redirectTo=…`

- [ ] **Step 1: Описать типы locals**

`src/app.d.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '$lib/types';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      safeGetSession(): Promise<{ userId: string | null }>;
      locale: Locale;
    }
    interface PageData {
      userId: string | null;
      locale: Locale;
    }
  }
}

export {};
```

- [ ] **Step 2: Написать hooks.server.ts**

`src/hooks.server.ts`:

```ts
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { parseLocale } from '$lib/i18n';

const PROTECTED = ['/', '/person', '/events', '/settings'];

const supabase: Handle = async ({ event, resolve }) => {
  /**
   * SvelteKit's setHeaders() throws if the same header is set twice in one
   * request, and @supabase/ssr calls setAll() more than once per request —
   * signUp() does it twice while storing the PKCE code verifier, each time
   * forwarding the same Cache-Control hint. Without this guard the second
   * call crashes the request with `"Cache-Control" header is already set`.
   * The hints are idempotent, so setting each name once is correct.
   */
  const headersAlreadySet = new Set<string>();

  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            event.cookies.set(name, value, { ...options, path: '/' })
          );

          const fresh: Record<string, string> = {};
          for (const [name, value] of Object.entries(headers)) {
            const key = name.toLowerCase();
            if (headersAlreadySet.has(key)) continue;
            headersAlreadySet.add(key);
            fresh[name] = value;
          }
          if (Object.keys(fresh).length > 0) event.setHeaders(fresh);
        }
      }
    }
  );

  /**
   * getClaims проверяет подпись JWT локально по кэшированным ключам.
   * getSession подпись НЕ проверяет и для защиты страниц не годится.
   */
  event.locals.safeGetSession = async () => {
    const { data, error } = await event.locals.supabase.auth.getClaims();
    if (error || !data?.claims) return { userId: null };
    return { userId: data.claims.sub as string };
  };

  event.locals.locale = parseLocale(
    event.cookies.get('locale') ?? event.request.headers.get('accept-language')
  );

  return resolve(event, {
    filterSerializedResponseHeaders: (name) =>
      name === 'content-range' || name === 'x-supabase-api-version'
  });
};

const guard: Handle = async ({ event, resolve }) => {
  const isProtected =
    event.url.pathname === '/' ||
    PROTECTED.some((p) => p !== '/' && event.url.pathname.startsWith(p));

  if (isProtected) {
    const { userId } = await event.locals.safeGetSession();
    if (!userId) {
      const target = event.url.pathname + event.url.search;
      redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
    }
  }

  return resolve(event);
};

const lang: Handle = async ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.locale)
  });

export const handle = sequence(supabase, guard, lang);
```

- [ ] **Step 3: Подставить `%lang%` в app.html**

В `src/app.html` заменить открывающий тег `<html ...>` на:

```html
<html lang="%lang%">
```

- [ ] **Step 4: Прокинуть userId и locale в layout**

`src/routes/+layout.server.ts`:

```ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const { userId } = await locals.safeGetSession();
  return { userId, locale: locals.locale };
};
```

`src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  import { dict } from '$lib/i18n';

  let { data, children } = $props();
  let t = $derived(dict(data.locale));
</script>

<svelte:head><title>{t.app.name}</title></svelte:head>

{@render children()}
```

- [ ] **Step 5: Проверить типы и запуск**

```bash
npm run check
npm run dev
```

Открыть `http://localhost:5173/` — ожидается редирект на `/login?redirectTo=%2F`. Страницы `/login` ещё нет, поэтому 404 на `/login` — корректный результат этого шага. В devtools проверить, что у `<html>` стоит `lang="ru"`.

- [ ] **Step 6: Коммит**

```bash
git add src/hooks.server.ts src/app.d.ts src/app.html src/routes
git commit -m "feat: серверный клиент Supabase, валидация сессии через getClaims, guard и локаль"
```

---

### Task 5: Регистрация, вход, выход

**Files:**
- Create: `src/routes/login/+page.svelte`, `src/routes/login/+page.server.ts`
- Create: `src/routes/signup/+page.svelte`, `src/routes/signup/+page.server.ts`
- Create: `src/routes/signout/+page.server.ts`
- Create: `src/lib/components/AuthForm.svelte`

**Interfaces:**
- Consumes: `event.locals.supabase`, `dict`, `Locale`
- Produces:
  - `POST /login?/signIn` — вход, редирект на `redirectTo` или `/`
  - `POST /signup?/signUp` — регистрация + создание `trees` и `user_settings`, редирект на `/`
  - `POST /signout` — выход, редирект на `/login`
  - После регистрации в БД гарантированно есть ровно одна строка `trees` с `root_person_id = null` и строка `user_settings`

- [ ] **Step 1: Написать общую форму**

`src/lib/components/AuthForm.svelte`:

```svelte
<script lang="ts">
  import type { Dict } from '$lib/i18n';

  let {
    t,
    title,
    submitLabel,
    altHref,
    altLabel,
    error = null,
    passwordAutocomplete = 'current-password'
  }: {
    t: Dict;
    title: string;
    submitLabel: string;
    altHref: string;
    altLabel: string;
    error?: string | null;
    /**
     * На входе — 'current-password', чтобы менеджер паролей подставил
     * существующий. На регистрации — 'new-password', иначе он предложит
     * старый пароль вместо генерации нового.
     */
    passwordAutocomplete?: 'current-password' | 'new-password';
  } = $props();
</script>

<main>
  <h1>{title}</h1>

  <form method="POST">
    <label>
      {t.auth.email}
      <input name="email" type="email" autocomplete="email" required />
    </label>

    <label>
      {t.auth.password}
      <input name="password" type="password" autocomplete={passwordAutocomplete} required />
    </label>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <button type="submit">{submitLabel}</button>
  </form>

  <a href={altHref}>{altLabel}</a>
</main>

<style>
  main {
    max-width: 380px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4);
    display: grid;
    gap: var(--space-4);
  }
  form { display: grid; gap: var(--space-3); }
  label { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); }
  input {
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  .error { color: var(--danger); font-size: var(--font-2); margin: 0; }
  a { color: var(--accent); font-size: var(--font-2); }
</style>
```

- [ ] **Step 2: Написать вход**

`src/routes/login/+page.server.ts`:

```ts
import { fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import type { Actions, PageServerLoad } from './$types';

/**
 * redirectTo приходит из URL, то есть от кого угодно. Без проверки это open
 * redirect: ссылка вида /login?redirectTo=https://evil.com уводит пользователя
 * на чужой сайт уже после успешного входа, с нашего домена — классический
 * фишинговый приём. Пропускаем только относительные пути внутри приложения.
 * `//evil.com` и `/\evil.com` браузеры трактуют как абсолютные, поэтому их тоже
 * отбрасываем.
 */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = await locals.safeGetSession();
  if (userId) redirect(303, '/');
  return {
    locale: locals.locale,
    redirectTo: safeRedirect(url.searchParams.get('redirectTo'))
  };
};

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const t = dict(locals.locale);

    const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
    if (error) return fail(400, { error: t.auth.invalidCredentials });

    redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
  }
};
```

`src/routes/login/+page.svelte`:

```svelte
<script lang="ts">
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { dict } from '$lib/i18n';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
</script>

<AuthForm
  {t}
  title={t.auth.signInTitle}
  submitLabel={t.auth.signIn}
  altHref="/signup"
  altLabel={t.auth.toSignUp}
  error={form?.error ?? null}
/>
```

- [ ] **Step 3: Написать регистрацию с созданием дерева**

`src/routes/signup/+page.server.ts`:

```ts
import { fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { userId } = await locals.safeGetSession();
  if (userId) redirect(303, '/');
  return { locale: locals.locale };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const t = dict(locals.locale);

    if (password.length < 6) return fail(400, { error: t.auth.passwordTooShort });

    const { data, error } = await locals.supabase.auth.signUp({ email, password });
    if (error || !data.user) return fail(400, { error: t.auth.emailTaken });

    /**
     * Дерево и настройки здесь НЕ создаём. Две отдельные вставки нельзя выполнить
     * атомарно из клиента: Supabase не бросает исключение на ошибке БД, а
     * возвращает {error}, поэтому при сбое второй вставки первая осталась бы
     * висеть, а пользователь — с активной сессией и без пути дописать
     * недостающую строку. Вместо этого дерево создаёт `ensureTree` в
     * `(app)/+layout.server.ts` — идемпотентно, при каждом входе в приложение.
     * Один путь создания вместо двух, и он же лечит пользователей, появившихся
     * мимо этой формы.
     */
    redirect(303, '/');
  }
};
```

`src/routes/signup/+page.svelte`:

```svelte
<script lang="ts">
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { dict } from '$lib/i18n';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
</script>

<AuthForm
  {t}
  title={t.auth.signUpTitle}
  submitLabel={t.auth.signUp}
  altHref="/login"
  altLabel={t.auth.toSignIn}
  error={form?.error ?? null}
  passwordAutocomplete="new-password"
/>
```

- [ ] **Step 4: Написать выход**

`src/routes/signout/+page.server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ locals }) => {
    await locals.supabase.auth.signOut();
    redirect(303, '/login');
  }
};
```

- [ ] **Step 5: Проверить вручную**

```bash
npm run dev
```

1. Открыть `/signup`, зарегистрироваться. Ожидается редирект на `/` (там пока 404 или пусто — нормально).
2. Проверить, что записи созданы:

```bash
supabase db query --linked "select (select count(*) from trees) as trees, (select count(*) from user_settings) as settings"
```

Ожидается: `trees = 1`, `settings = 1`.

3. Открыть `/login` — ожидается редирект на `/`, потому что сессия активна.
4. Ввести неверный пароль в `/login` после выхода — ожидается «Неверный email или пароль».

- [ ] **Step 6: Коммит**

```bash
git add src/routes/login src/routes/signup src/routes/signout src/lib/components/AuthForm.svelte
git commit -m "feat: регистрация, вход и выход; при регистрации создаётся дерево и настройки"
```

---

### Task 6: Инварианты дерева

**Files:**
- Create: `src/lib/tree/invariants.ts`
- Test: `src/lib/tree/invariants.test.ts`

**Interfaces:**
- Consumes: `Person`, `Gender` из `$lib/types`
- Produces:
  - `type ParentKind = 'father' | 'mother'`
  - `type Violation = { field: string; code: keyof Dict['errors'] }`
  - `createsCycle(people: Pick<Person,'id'|'father_id'|'mother_id'>[], childId: string, parentId: string): boolean`
  - `validateParent(people: Person[], childId: string, parentId: string, kind: ParentKind): Violation | null`
  - `validatePersonFields(input: PersonInput): Violation[]`
  - `type PersonInput = { first_name: string; birth_date: string | null; died_on: string | null; phone: string | null; telegram: string | null; instagram: string | null }`

- [ ] **Step 1: Написать падающий тест**

`src/lib/tree/invariants.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createsCycle, validateParent, validatePersonFields } from './invariants';
import type { Person } from '$lib/types';

function p(id: string, over: Partial<Person> = {}): Person {
  return {
    id,
    tree_id: 't1',
    first_name: id,
    last_name: null,
    gender: 'male',
    birth_date: null,
    died_on: null,
    email: null,
    phone: null,
    telegram: null,
    instagram: null,
    about: null,
    ...over
  } as Person;
}

describe('createsCycle', () => {
  it('прямой цикл: сам себе родитель', () => {
    expect(createsCycle([{ id: 'a', father_id: null, mother_id: null }], 'a', 'a')).toBe(true);
  });

  it('длинный цикл: a -> b -> c, назначаем a родителем c', () => {
    const people = [
      { id: 'a', father_id: 'b', mother_id: null },
      { id: 'b', father_id: 'c', mother_id: null },
      { id: 'c', father_id: null, mother_id: null }
    ];
    expect(createsCycle(people, 'c', 'a')).toBe(true);
  });

  it('цикл через мать', () => {
    const people = [
      { id: 'a', father_id: null, mother_id: 'b' },
      { id: 'b', father_id: null, mother_id: null }
    ];
    expect(createsCycle(people, 'b', 'a')).toBe(true);
  });

  it('нормальное назначение родителя циклом не является', () => {
    const people = [
      { id: 'child', father_id: null, mother_id: null },
      { id: 'dad', father_id: null, mother_id: null }
    ];
    expect(createsCycle(people, 'child', 'dad')).toBe(false);
  });

  it('не зависает на уже существующем цикле в данных', () => {
    const people = [
      { id: 'a', father_id: 'b', mother_id: null },
      { id: 'b', father_id: 'a', mother_id: null }
    ];
    expect(createsCycle(people, 'a', 'b')).toBe(true);
  });
});

describe('validateParent', () => {
  const people = [
    p('child'),
    p('dad', { gender: 'male' }),
    p('mom', { gender: 'female' }),
    p('outsider', { tree_id: 't2' })
  ];

  it('пропускает корректного отца', () => {
    expect(validateParent(people, 'child', 'dad', 'father')).toBeNull();
  });

  it('пропускает корректную мать', () => {
    expect(validateParent(people, 'child', 'mom', 'mother')).toBeNull();
  });

  it('отклоняет женщину в роли отца', () => {
    expect(validateParent(people, 'child', 'mom', 'father')).toEqual({
      field: 'father_id',
      code: 'fatherMustBeMale'
    });
  });

  it('отклоняет мужчину в роли матери', () => {
    expect(validateParent(people, 'child', 'dad', 'mother')).toEqual({
      field: 'mother_id',
      code: 'motherMustBeFemale'
    });
  });

  it('отклоняет самого себя', () => {
    expect(validateParent(people, 'dad', 'dad', 'father')).toEqual({
      field: 'father_id',
      code: 'selfParent'
    });
  });

  it('отклоняет человека из другого дерева', () => {
    expect(validateParent(people, 'child', 'outsider', 'father')).toEqual({
      field: 'father_id',
      code: 'otherTree'
    });
  });

  it('отклоняет несуществующего человека', () => {
    expect(validateParent(people, 'child', 'ghost', 'father')).toEqual({
      field: 'father_id',
      code: 'notFound'
    });
  });

  /**
   * Единственный тест, проходящий через createsCycle изнутри validateParent.
   * Без него перепутанный порядок аргументов в вызове createsCycle остался бы
   * незамеченным: все остальные тесты прошли бы, а защита от циклов проверяла
   * бы обратное направление. Здесь при обратном порядке результат был бы null.
   */
  it('отклоняет родителя, который станет своим предком', () => {
    const chain = [
      { ...p('child', { gender: 'male' }), father_id: 'dad' },
      p('dad', { gender: 'male' })
    ] as Person[];

    expect(validateParent(chain, 'dad', 'child', 'father')).toEqual({
      field: 'father_id',
      code: 'cycle'
    });
  });
});

describe('validatePersonFields', () => {
  const ok = {
    first_name: 'Мария',
    birth_date: '1948-03-07',
    died_on: null,
    phone: null,
    telegram: null,
    instagram: null
  };

  it('пропускает корректные данные', () => {
    expect(validatePersonFields(ok)).toEqual([]);
  });

  it('требует имя', () => {
    expect(validatePersonFields({ ...ok, first_name: '   ' })).toEqual([
      { field: 'first_name', code: 'firstNameRequired' }
    ]);
  });

  it('отклоняет смерть раньше рождения', () => {
    expect(validatePersonFields({ ...ok, died_on: '1900-01-01' })).toEqual([
      { field: 'died_on', code: 'diedBeforeBorn' }
    ]);
  });

  it('проверяет формат телефона', () => {
    expect(validatePersonFields({ ...ok, phone: '8 916 123' })).toEqual([
      { field: 'phone', code: 'badPhone' }
    ]);
    expect(validatePersonFields({ ...ok, phone: '+79161234567' })).toEqual([]);
  });

  it('проверяет юзернеймы', () => {
    expect(validatePersonFields({ ...ok, telegram: 'плохой ник' })).toEqual([
      { field: 'telegram', code: 'badUsername' }
    ]);
    expect(validatePersonFields({ ...ok, instagram: 'good_nick.1' })).toEqual([]);
  });

  it('собирает несколько нарушений сразу', () => {
    expect(validatePersonFields({ ...ok, first_name: '', phone: 'abc' })).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

```bash
npm run test:unit -- src/lib/tree/invariants.test.ts
```

Ожидается: FAIL, `Cannot find module './invariants'`.

- [ ] **Step 3: Реализовать инварианты**

`src/lib/tree/invariants.ts`:

```ts
import type { Person } from '$lib/types';

export type ParentKind = 'father' | 'mother';

export interface Violation {
  field: string;
  code:
    | 'fatherMustBeMale'
    | 'motherMustBeFemale'
    | 'cycle'
    | 'selfParent'
    | 'otherTree'
    | 'notFound'
    | 'diedBeforeBorn'
    | 'firstNameRequired'
    | 'badPhone'
    | 'badUsername';
}

export interface PersonInput {
  first_name: string;
  birth_date: string | null;
  died_on: string | null;
  phone: string | null;
  telegram: string | null;
  instagram: string | null;
}

type Node = Pick<Person, 'id'> & { father_id: string | null; mother_id: string | null };

const PHONE = /^\+[1-9]\d{7,14}$/;
const USERNAME = /^[A-Za-z0-9_.]{1,32}$/;

/**
 * Стал бы parentId предком самого себя, если сделать его родителем childId.
 * Обход снизу вверх от предполагаемого родителя: если встретили ребёнка — цикл.
 * seen защищает от зависания на уже испорченных данных.
 */
export function createsCycle(people: Node[], childId: string, parentId: string): boolean {
  if (childId === parentId) return true;

  const byId = new Map(people.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const queue = [parentId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === childId) return true;
    if (seen.has(id)) continue;
    seen.add(id);

    const node = byId.get(id);
    if (!node) continue;
    if (node.father_id) queue.push(node.father_id);
    if (node.mother_id) queue.push(node.mother_id);
  }

  return false;
}

export function validateParent(
  people: Person[],
  childId: string,
  parentId: string,
  kind: ParentKind
): Violation | null {
  const field = kind === 'father' ? 'father_id' : 'mother_id';

  if (childId === parentId) return { field, code: 'selfParent' };

  const child = people.find((p) => p.id === childId);
  const parent = people.find((p) => p.id === parentId);
  if (!parent) return { field, code: 'notFound' };
  if (child && parent.tree_id !== child.tree_id) return { field, code: 'otherTree' };

  if (kind === 'father' && parent.gender !== 'male') {
    return { field, code: 'fatherMustBeMale' };
  }
  if (kind === 'mother' && parent.gender !== 'female') {
    return { field, code: 'motherMustBeFemale' };
  }

  if (createsCycle(people as Node[], childId, parentId)) return { field, code: 'cycle' };

  return null;
}

export function validatePersonFields(input: PersonInput): Violation[] {
  const out: Violation[] = [];

  if (input.first_name.trim() === '') {
    out.push({ field: 'first_name', code: 'firstNameRequired' });
  }
  if (input.birth_date && input.died_on && input.died_on < input.birth_date) {
    out.push({ field: 'died_on', code: 'diedBeforeBorn' });
  }
  if (input.phone && !PHONE.test(input.phone)) {
    out.push({ field: 'phone', code: 'badPhone' });
  }
  for (const field of ['telegram', 'instagram'] as const) {
    const value = input[field];
    if (value && !USERNAME.test(value)) out.push({ field, code: 'badUsername' });
  }

  return out;
}
```

- [ ] **Step 4: Прогнать тест**

```bash
npm run test:unit -- src/lib/tree/invariants.test.ts
```

Ожидается: PASS (19 проверок: 5 на createsCycle, 8 на validateParent, 6 на validatePersonFields).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/tree/invariants.ts src/lib/tree/invariants.test.ts
git commit -m "feat: инварианты дерева — циклы, пол родителя, валидация полей"
```

---

### Task 7: Маппер в формат family-chart

**Files:**
- Create: `src/lib/tree/to-family-chart.ts`
- Test: `src/lib/tree/to-family-chart.test.ts`

**Interfaces:**
- Consumes: `Person`, `Spouse` из `$lib/types`
- Produces:
  - `interface FcDatum { id: string; data: { gender: 'M'|'F'; person: Person }; rels: { parents: string[]; spouses: string[]; children: string[] } }`
  - `toFamilyChart(people: PersonWithParents[], spouses: Spouse[]): FcDatum[]`
  - `type PersonWithParents = Person & { father_id: string | null; mother_id: string | null }`
  - `deriveSiblings(people: PersonWithParents[], personId: string): PersonWithParents[]`

**Почему это нужно:** family-chart 0.9 требует двусторонних связей — `children` должны быть заполнены явно, супруги указаны у обоих. Наша БД нормализована, поэтому граф разворачивается здесь.

- [ ] **Step 1: Написать падающий тест**

`src/lib/tree/to-family-chart.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toFamilyChart, deriveSiblings } from './to-family-chart';
import type { Person, Spouse } from '$lib/types';

type P = Person & { father_id: string | null; mother_id: string | null };

function p(id: string, over: Partial<P> = {}): P {
  return {
    id,
    tree_id: 't1',
    first_name: id,
    last_name: null,
    gender: 'male',
    birth_date: null,
    died_on: null,
    email: null,
    phone: null,
    telegram: null,
    instagram: null,
    about: null,
    father_id: null,
    mother_id: null,
    ...over
  } as P;
}

function sp(a: string, b: string, married_on: string | null = null): Spouse {
  return { tree_id: 't1', person_a_id: a, person_b_id: b, married_on };
}

describe('toFamilyChart', () => {
  it('одинокий человек: пустые связи, но объект rels есть', () => {
    const [d] = toFamilyChart([p('solo')], []);
    expect(d).toEqual({
      id: 'solo',
      data: { gender: 'M', person: expect.objectContaining({ id: 'solo' }) },
      rels: { parents: [], spouses: [], children: [] }
    });
  });

  it('маппит пол в M и F', () => {
    const out = toFamilyChart([p('m', { gender: 'male' }), p('f', { gender: 'female' })], []);
    expect(out.map((d) => d.data.gender)).toEqual(['M', 'F']);
  });

  it('parents собирается из father_id и mother_id', () => {
    const out = toFamilyChart(
      [p('kid', { father_id: 'dad', mother_id: 'mom' }), p('dad'), p('mom', { gender: 'female' })],
      []
    );
    const kid = out.find((d) => d.id === 'kid')!;
    expect(kid.rels.parents.sort()).toEqual(['dad', 'mom']);
  });

  it('children выводится обратно из father_id и mother_id', () => {
    const out = toFamilyChart(
      [
        p('dad'),
        p('mom', { gender: 'female' }),
        p('kid1', { father_id: 'dad', mother_id: 'mom' }),
        p('kid2', { father_id: 'dad', mother_id: 'mom' })
      ],
      []
    );
    expect(out.find((d) => d.id === 'dad')!.rels.children.sort()).toEqual(['kid1', 'kid2']);
    expect(out.find((d) => d.id === 'mom')!.rels.children.sort()).toEqual(['kid1', 'kid2']);
  });

  it('ссылка на несуществующего родителя отбрасывается', () => {
    const out = toFamilyChart([p('kid', { father_id: 'ghost' })], []);
    expect(out[0].rels.parents).toEqual([]);
  });

  it('супруги зеркальны в обе стороны', () => {
    const out = toFamilyChart([p('a'), p('b', { gender: 'female' })], [sp('a', 'b')]);
    expect(out.find((d) => d.id === 'a')!.rels.spouses).toEqual(['b']);
    expect(out.find((d) => d.id === 'b')!.rels.spouses).toEqual(['a']);
  });

  it('бездетная пара всё равно связана', () => {
    const out = toFamilyChart([p('x'), p('y', { gender: 'female' })], [sp('x', 'y')]);
    expect(out.find((d) => d.id === 'x')!.rels.children).toEqual([]);
    expect(out.find((d) => d.id === 'x')!.rels.spouses).toEqual(['y']);
  });

  it('брак со ссылкой на отсутствующего человека игнорируется', () => {
    const out = toFamilyChart([p('a')], [sp('a', 'zz')]);
    expect(out[0].rels.spouses).toEqual([]);
  });

  it('исходную строку человека кладёт в data.person', () => {
    const out = toFamilyChart([p('a', { first_name: 'Мария', birth_date: '1948-03-07' })], []);
    expect(out[0].data.person.first_name).toBe('Мария');
    expect(out[0].data.person.birth_date).toBe('1948-03-07');
  });
});

describe('deriveSiblings', () => {
  const people = [
    p('dad'),
    p('mom', { gender: 'female' }),
    p('me', { father_id: 'dad', mother_id: 'mom' }),
    p('bro', { father_id: 'dad', mother_id: 'mom' }),
    p('halfsis', { father_id: 'dad', gender: 'female' }),
    p('stranger')
  ];

  it('находит полных и полукровных сиблингов, себя не включает', () => {
    expect(deriveSiblings(people, 'me').map((s) => s.id).sort()).toEqual(['bro', 'halfsis']);
  });

  it('без родителей сиблингов нет', () => {
    expect(deriveSiblings(people, 'stranger')).toEqual([]);
  });
});
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

```bash
npm run test:unit -- src/lib/tree/to-family-chart.test.ts
```

Ожидается: FAIL, `Cannot find module './to-family-chart'`.

- [ ] **Step 3: Реализовать маппер**

`src/lib/tree/to-family-chart.ts`:

```ts
import type { Person, Spouse } from '$lib/types';

export type PersonWithParents = Person & {
  father_id: string | null;
  mother_id: string | null;
};

export interface FcDatum {
  id: string;
  data: { gender: 'M' | 'F'; person: PersonWithParents };
  rels: { parents: string[]; spouses: string[]; children: string[] };
}

/**
 * Разворачивает нормализованные строки в избыточный граф, которого требует
 * family-chart 0.9: связи должны быть двусторонними, children — заполнены явно.
 */
export function toFamilyChart(people: PersonWithParents[], spouses: Spouse[]): FcDatum[] {
  const ids = new Set(people.map((p) => p.id));
  const children = new Map<string, string[]>();
  const partners = new Map<string, string[]>();

  for (const person of people) {
    for (const parentId of [person.father_id, person.mother_id]) {
      if (!parentId || !ids.has(parentId)) continue;
      const list = children.get(parentId) ?? [];
      list.push(person.id);
      children.set(parentId, list);
    }
  }

  for (const { person_a_id, person_b_id } of spouses) {
    if (!ids.has(person_a_id) || !ids.has(person_b_id)) continue;
    for (const [self, other] of [
      [person_a_id, person_b_id],
      [person_b_id, person_a_id]
    ]) {
      const list = partners.get(self) ?? [];
      list.push(other);
      partners.set(self, list);
    }
  }

  return people.map((person) => ({
    id: person.id,
    data: { gender: person.gender === 'male' ? 'M' : 'F', person },
    rels: {
      parents: [person.father_id, person.mother_id].filter(
        (id): id is string => !!id && ids.has(id)
      ),
      spouses: partners.get(person.id) ?? [],
      children: children.get(person.id) ?? []
    }
  }));
}

/** Сиблинги не хранятся — выводятся из общего отца или общей матери. */
export function deriveSiblings(
  people: PersonWithParents[],
  personId: string
): PersonWithParents[] {
  const self = people.find((p) => p.id === personId);
  if (!self) return [];
  if (!self.father_id && !self.mother_id) return [];

  return people.filter(
    (p) =>
      p.id !== personId &&
      ((self.father_id !== null && p.father_id === self.father_id) ||
        (self.mother_id !== null && p.mother_id === self.mother_id))
  );
}
```

- [ ] **Step 4: Прогнать тест**

```bash
npm run test:unit -- src/lib/tree/to-family-chart.test.ts
```

Ожидается: PASS (11 проверок).

- [ ] **Step 5: Коммит**

```bash
git add src/lib/tree/to-family-chart.ts src/lib/tree/to-family-chart.test.ts
git commit -m "feat: маппер БД в формат family-chart с двусторонними связями"
```

---

### Task 8: Слой доступа к данным

**Files:**
- Create: `src/lib/server/people.ts`
- Test: `src/lib/server/orphans.test.ts` — только для `orphansOf`; остальное проверяется через задачи 9–14 и e2e, а инварианты уже покрыты задачей 6

**Interfaces:**
- Consumes: `SupabaseClient`, `invariants.ts`, `to-family-chart.ts`
- Produces:
  - `loadTree(supabase, userId): Promise<{ tree: Tree; people: PersonWithParents[]; spouses: Spouse[] } | null>`
  - `createPerson(supabase, treeId, input): Promise<{ id: string } | { violations: Violation[] }>`
  - `updatePerson(supabase, treeId, personId, input): Promise<{ ok: true } | { violations: Violation[] }>`
  - `setParent(supabase, treeId, childId, parentId, kind): Promise<{ ok: true } | { violations: Violation[] }>`
  - `linkSpouse(supabase, treeId, aId, bId, marriedOn): Promise<{ ok: true } | { violations: Violation[] }>`
  - `deletePerson(supabase, treeId, personId): Promise<{ ok: true }>`
  - `orphansOf(people, personId): PersonWithParents[]`
  - `type PersonWrite = PersonInput & { last_name: string | null; gender: Gender; email: string | null; about: string | null }`

- [ ] **Step 1: Написать модуль**

`src/lib/server/people.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Gender, Locale, Spouse, Tree } from '$lib/types';
import type { PersonWithParents } from '$lib/tree/to-family-chart';
import {
  validateParent,
  validatePersonFields,
  type ParentKind,
  type Violation
} from '$lib/tree/invariants';

export interface PersonWrite {
  first_name: string;
  last_name: string | null;
  gender: Gender;
  birth_date: string | null;
  died_on: string | null;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  instagram: string | null;
  about: string | null;
}

const PERSON_COLUMNS =
  'id, tree_id, first_name, last_name, gender, birth_date, died_on, email, phone, telegram, instagram, about, father_id, mother_id';

export async function loadTree(
  supabase: SupabaseClient,
  userId: string
): Promise<{ tree: Tree; people: PersonWithParents[]; spouses: Spouse[] } | null> {
  const { data: tree, error: treeError } = await supabase
    .from('trees')
    .select('id, owner_id, name, root_person_id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (treeError) throw new Error(`tree-read-failed: ${treeError.message}`);
  if (!tree) return null;

  const [people, spouses] = await Promise.all([
    supabase.from('people').select(PERSON_COLUMNS).eq('tree_id', tree.id),
    supabase
      .from('spouses')
      .select('tree_id, person_a_id, person_b_id, married_on')
      .eq('tree_id', tree.id)
  ]);

  /**
   * Ошибки чтения обязаны падать, а не превращаться в пустые списки. Пустой
   * people при существующем дереве означал бы для задачи 9 «людей нет» — она
   * показала бы онбординг «расскажите о себе» человеку с уже заполненным
   * деревом, и отправка этой формы перезаписала бы root_person_id и создала
   * дубль. Порча данных от одного сетевого сбоя.
   */
  if (people.error) throw new Error(`people-read-failed: ${people.error.message}`);
  if (spouses.error) throw new Error(`spouses-read-failed: ${spouses.error.message}`);

  return {
    tree: tree as Tree,
    people: (people.data ?? []) as PersonWithParents[],
    spouses: (spouses.data ?? []) as Spouse[]
  };
}

/**
 * Гарантирует, что у пользователя есть дерево и настройки, и возвращает дерево.
 * Идемпотентна: вызывается на каждый вход в приложение.
 *
 * Почему так, а не при регистрации: две вставки из клиента нельзя сделать
 * атомарно, и при частичном сбое пользователь остался бы с активной сессией и
 * без дерева, без пути починиться. Здесь же любой такой пользователь лечится
 * сам при следующем открытии приложения — включая созданных вручную или
 * будущим OAuth.
 *
 * Гонка двух одновременных запросов безопасна: `trees.owner_id` уникален, второй
 * insert падает на конфликте, и мы просто перечитываем строку.
 */
export async function ensureTree(
  supabase: SupabaseClient,
  userId: string,
  locale: Locale,
  treeName: string
): Promise<Tree | null> {
  const existing = await supabase
    .from('trees')
    .select('id, owner_id, name, root_person_id')
    .eq('owner_id', userId)
    .maybeSingle();

  /**
   * Настройки создаём независимо от дерева и ДО раннего возврата. Раньше upsert
   * стоял внутри ветки создания дерева, поэтому выполнялся ровно один раз за всю
   * жизнь пользователя: если он падал, повторные вызовы уходили в ранний возврат
   * и настройки не появлялись уже никогда. Молча — а крон уведомлений читает
   * оттуда locale и push_enabled, так что человек просто перестал бы получать
   * уведомления без единого признака поломки.
   * Upsert по первичному ключу идемпотентен, повторный вызов ничего не меняет.
   */
  const settings = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, locale }, { onConflict: 'user_id', ignoreDuplicates: true });

  if (settings.error) throw new Error(`settings-ensure-failed: ${settings.error.message}`);

  if (existing.data) return existing.data as Tree;

  const created = await supabase
    .from('trees')
    .insert({ owner_id: userId, name: treeName })
    .select('id, owner_id, name, root_person_id')
    .maybeSingle();

  if (created.data) return created.data as Tree;

  // Конфликт уникальности означает, что дерево создал параллельный запрос.
  const retry = await supabase
    .from('trees')
    .select('id, owner_id, name, root_person_id')
    .eq('owner_id', userId)
    .maybeSingle();

  return (retry.data as Tree) ?? null;
}

/**
 * Дерево текущего пользователя для form actions.
 * В actions нет parent() — он существует только у load-событий, — поэтому
 * дерево здесь запрашивается напрямую.
 */
export async function requireTree(
  supabase: SupabaseClient,
  userId: string
): Promise<Tree> {
  const { data } = await supabase
    .from('trees')
    .select('id, owner_id, name, root_person_id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (!data) throw new Error('tree-not-found');
  return data as Tree;
}

/**
 * Бросает на ошибке чтения, а не возвращает пустой список. Это принципиально:
 * все инварианты проверяются против этого списка, и пустой список из-за сбоя
 * сети означал бы «у человека нет детей», «родителя не существует» — то есть
 * проверки молча пропустили бы то, что обязаны отвергнуть. Отказ читать должен
 * блокировать запись, а не разрешать её.
 */
export async function fetchPeople(
  supabase: SupabaseClient,
  treeId: string
): Promise<PersonWithParents[]> {
  const { data, error } = await supabase
    .from('people')
    .select(PERSON_COLUMNS)
    .eq('tree_id', treeId);

  if (error) throw new Error(`people-read-failed: ${error.message}`);
  return (data ?? []) as PersonWithParents[];
}

export async function createPerson(
  supabase: SupabaseClient,
  treeId: string,
  input: PersonWrite
): Promise<{ id: string } | { violations: Violation[] }> {
  const violations = validatePersonFields(input);
  if (violations.length > 0) return { violations };

  const { data, error } = await supabase
    .from('people')
    .insert({ ...input, tree_id: treeId })
    .select('id')
    .single();

  if (error || !data) return { violations: [{ field: '_', code: 'notFound' }] };
  return { id: data.id as string };
}

export async function updatePerson(
  supabase: SupabaseClient,
  treeId: string,
  personId: string,
  input: PersonWrite
): Promise<{ ok: true } | { violations: Violation[] }> {
  const violations = validatePersonFields(input);
  if (violations.length > 0) return { violations };

  // Смена пола не должна оставить человека отцом при gender = 'female'.
  const people = await fetchPeople(supabase, treeId);
  const asFatherOf = people.filter((p) => p.father_id === personId);
  const asMotherOf = people.filter((p) => p.mother_id === personId);
  if (input.gender === 'female' && asFatherOf.length > 0) {
    return { violations: [{ field: 'gender', code: 'fatherMustBeMale' }] };
  }
  if (input.gender === 'male' && asMotherOf.length > 0) {
    return { violations: [{ field: 'gender', code: 'motherMustBeFemale' }] };
  }

  const { error } = await supabase
    .from('people')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', personId)
    .eq('tree_id', treeId);

  if (error) return { violations: [{ field: '_', code: 'notFound' }] };
  return { ok: true };
}

export async function setParent(
  supabase: SupabaseClient,
  treeId: string,
  childId: string,
  parentId: string,
  kind: ParentKind
): Promise<{ ok: true } | { violations: Violation[] }> {
  const people = await fetchPeople(supabase, treeId);
  const violation = validateParent(people, childId, parentId, kind);
  if (violation) return { violations: [violation] };

  const column = kind === 'father' ? 'father_id' : 'mother_id';
  const { error } = await supabase
    .from('people')
    .update({ [column]: parentId, updated_at: new Date().toISOString() })
    .eq('id', childId)
    .eq('tree_id', treeId);

  if (error) return { violations: [{ field: column, code: 'notFound' }] };
  return { ok: true };
}

export async function linkSpouse(
  supabase: SupabaseClient,
  treeId: string,
  aId: string,
  bId: string,
  marriedOn: string | null
): Promise<{ ok: true } | { violations: Violation[] }> {
  if (aId === bId) return { violations: [{ field: 'spouse', code: 'selfParent' }] };

  const people = await fetchPeople(supabase, treeId);
  if (!people.some((p) => p.id === aId) || !people.some((p) => p.id === bId)) {
    return { violations: [{ field: 'spouse', code: 'notFound' }] };
  }

  // Таблица держит пару один раз, порядок задаёт check (person_a_id < person_b_id).
  const [low, high] = aId < bId ? [aId, bId] : [bId, aId];
  const { error } = await supabase.from('spouses').upsert(
    { tree_id: treeId, person_a_id: low, person_b_id: high, married_on: marriedOn },
    { onConflict: 'person_a_id,person_b_id' }
  );

  if (error) return { violations: [{ field: 'spouse', code: 'notFound' }] };
  return { ok: true };
}

/** Кто останется без родителя, если удалить этого человека. */
export function orphansOf(
  people: PersonWithParents[],
  personId: string
): PersonWithParents[] {
  return people.filter((p) => p.father_id === personId || p.mother_id === personId);
}

export async function deletePerson(
  supabase: SupabaseClient,
  treeId: string,
  personId: string
): Promise<{ ok: true } | { violations: Violation[] }> {
  // father_id/mother_id детей обнулит on delete set null,
  // строки spouses снесёт on delete cascade,
  // trees.root_person_id обнулит trees_root_fk.
  //
  // Ошибку обязательно проверяем: без этого заблокированное удаление (протухший
  // treeId, отказ RLS) отрапортовало бы успех, и пользователь получил бы
  // подтверждение того, чего не произошло.
  const { error } = await supabase
    .from('people')
    .delete()
    .eq('id', personId)
    .eq('tree_id', treeId);

  if (error) return { violations: [{ field: '_', code: 'notFound' }] };
  return { ok: true };
}
```

- [ ] **Step 2: Написать тест на `orphansOf`**

Единственная чистая функция в этом файле, и она питает диалог подтверждения удаления.
Ошибка здесь означает, что пользователь удаляет человека, видя неверный список тех, кто
останется без родителя.

`src/lib/server/orphans.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { orphansOf } from './people';
import type { PersonWithParents } from '$lib/tree/to-family-chart';

function p(id: string, over: Partial<PersonWithParents> = {}): PersonWithParents {
  return {
    id,
    tree_id: 't1',
    first_name: id,
    last_name: null,
    gender: 'male',
    birth_date: null,
    died_on: null,
    email: null,
    phone: null,
    telegram: null,
    instagram: null,
    about: null,
    father_id: null,
    mother_id: null,
    ...over
  } as PersonWithParents;
}

describe('orphansOf', () => {
  const people = [
    p('dad'),
    p('mom', { gender: 'female' }),
    p('byFather', { father_id: 'dad' }),
    p('byMother', { mother_id: 'mom' }),
    p('byBoth', { father_id: 'dad', mother_id: 'mom' }),
    p('unrelated')
  ];

  it('находит детей по отцу', () => {
    expect(orphansOf(people, 'dad').map((x) => x.id).sort()).toEqual(['byBoth', 'byFather']);
  });

  it('находит детей по матери', () => {
    expect(orphansOf(people, 'mom').map((x) => x.id).sort()).toEqual(['byBoth', 'byMother']);
  });

  it('у бездетного человека никто не осиротеет', () => {
    expect(orphansOf(people, 'unrelated')).toEqual([]);
  });

  it('не считает сиротами тех, у кого родитель просто не указан', () => {
    // У 'unrelated' оба родителя null — он не должен попасть ни в один список.
    expect(orphansOf(people, 'dad').some((x) => x.id === 'unrelated')).toBe(false);
  });
});
```

- [ ] **Step 3: Прогнать тест и проверить типы**

```bash
npm run test:unit -- src/lib/server/orphans.test.ts
npm run check
```

Ожидается: 4 проверки PASS, 0 ошибок типов.

- [ ] **Step 4: Коммит**

```bash
git add src/lib/server/people.ts src/lib/server/orphans.test.ts
git commit -m "feat: слой доступа к people/spouses с применением инвариантов"
```

---

### Task 9: Онбординг — первый человек становится корнем

**Files:**
- Create: `src/lib/components/PersonForm.svelte`
- Create: `src/routes/(app)/+layout.server.ts`
- Create: `src/routes/(app)/+page.server.ts`, `src/routes/(app)/+page.svelte`
- Move: `src/routes/+layout.server.ts` остаётся; auth-маршруты не трогаем

**Interfaces:**
- Consumes: `loadTree`, `createPerson`, `dict`
- Produces:
  - `(app)/+layout.server.ts` отдаёт `{ userId, locale, tree, people, spouses }`
  - `(app)/+page.server.ts` action `?/createFirst` — создаёт человека и ставит его `root_person_id`
  - `PersonForm.svelte` — переиспользуемая форма человека, принимает `person` (или `null` для создания)

- [ ] **Step 1: Написать форму человека**

`src/lib/components/PersonForm.svelte`:

```svelte
<script lang="ts">
  import type { Dict } from '$lib/i18n';
  import type { PersonWithParents } from '$lib/tree/to-family-chart';

  let {
    t,
    person = null,
    errors = {},
    submitLabel,
    showDeath = true
  }: {
    t: Dict;
    person?: PersonWithParents | null;
    errors?: Record<string, string>;
    submitLabel: string;
    showDeath?: boolean;
  } = $props();
</script>

<div class="grid">
  <!--
    Общая ошибка. Слой данных возвращает нарушения с полем '_', когда падает
    сама запись, а не валидация поля. Без этого блока такая ошибка не имела бы
    места на экране: пользователь нажимал бы «Сохранить» и форма молча ничего
    не делала бы — ни сообщения, ни перехода.
  -->
  {#if errors._}<p class="err err--form" role="alert">{errors._}</p>{/if}

  <label>
    {t.person.firstName}
    <input name="first_name" value={person?.first_name ?? ''} required />
    {#if errors.first_name}<span class="err">{errors.first_name}</span>{/if}
  </label>

  <label>
    {t.person.lastName}
    <input name="last_name" value={person?.last_name ?? ''} />
  </label>

  <fieldset>
    <legend>{t.person.gender}</legend>
    <label class="inline">
      <input type="radio" name="gender" value="male"
             checked={(person?.gender ?? 'male') === 'male'} />
      {t.person.male}
    </label>
    <label class="inline">
      <input type="radio" name="gender" value="female"
             checked={person?.gender === 'female'} />
      {t.person.female}
    </label>
    {#if errors.gender}<span class="err">{errors.gender}</span>{/if}
  </fieldset>

  <label>
    {t.person.birthDate}
    <input type="date" name="birth_date" value={person?.birth_date ?? ''} />
  </label>

  {#if showDeath}
    <label>
      {t.person.diedOn}
      <input type="date" name="died_on" value={person?.died_on ?? ''} />
      {#if errors.died_on}<span class="err">{errors.died_on}</span>{/if}
    </label>
  {/if}

  <label>
    {t.person.about}
    <textarea name="about" rows="4">{person?.about ?? ''}</textarea>
  </label>

  <label>
    {t.person.email}
    <input type="email" name="email" value={person?.email ?? ''} />
  </label>

  <label>
    {t.person.phone}
    <input name="phone" inputmode="tel" placeholder="+79161234567"
           value={person?.phone ?? ''} />
    {#if errors.phone}<span class="err">{errors.phone}</span>{/if}
  </label>

  <label>
    {t.person.telegram}
    <input name="telegram" placeholder="username" value={person?.telegram ?? ''} />
    {#if errors.telegram}<span class="err">{errors.telegram}</span>{/if}
  </label>

  <label>
    {t.person.instagram}
    <input name="instagram" placeholder="username" value={person?.instagram ?? ''} />
    {#if errors.instagram}<span class="err">{errors.instagram}</span>{/if}
  </label>

  <button type="submit">{submitLabel}</button>
</div>

<style>
  .grid { display: grid; gap: var(--space-3); }
  label { display: grid; gap: var(--space-1); font-size: var(--font-2); color: var(--muted); }
  label.inline { display: flex; align-items: center; gap: var(--space-2); color: var(--fg); }
  input, textarea {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--fg);
  }
  input:not([type='radio']) { min-height: var(--tap); }
  fieldset {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    display: flex;
    gap: var(--space-4);
    align-items: center;
  }
  legend { font-size: var(--font-1); color: var(--muted); padding: 0 var(--space-1); }
  .err { color: var(--danger); font-size: var(--font-1); }
  .err--form {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    font-size: var(--font-2);
  }
</style>
```

- [ ] **Step 2: Написать layout группы (app)**

`src/routes/(app)/+layout.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import { ensureTree, loadTree } from '$lib/server/people';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const { userId } = await locals.safeGetSession();
  // guard в hooks.server.ts уже отсёк неавторизованных

  // Дерево создаётся здесь, а не при регистрации: идемпотентно и самовосстанавливается.
  await ensureTree(locals.supabase, userId!, locals.locale, dict(locals.locale).app.myTree);

  const loaded = await loadTree(locals.supabase, userId!);
  if (!loaded) error(503, 'tree-unavailable');

  return {
    userId,
    locale: locals.locale,
    tree: loaded.tree,
    people: loaded.people,
    spouses: loaded.spouses
  };
};
```

- [ ] **Step 3: Написать action создания первого человека**

`src/routes/(app)/+page.server.ts`:

```ts
import { fail } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import { createPerson, requireTree } from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import type { Actions } from './$types';

export const actions: Actions = {
  createFirst: async ({ request, locals }) => {
    // В actions нет parent() — дерево запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    const t = dict(locals.locale);
    const input = readPersonForm(await request.formData());

    const result = await createPerson(locals.supabase, tree.id, input);
    if ('violations' in result) {
      return fail(400, { errors: violationsToErrors(result.violations, t) });
    }

    /**
     * Человек уже создан, поэтому неудачу этого обновления не превращаем в
     * ошибку формы: повторная отправка создала бы дубль. Но и молча глотать
     * нельзя — без корня дерево откроется на произвольном человеке, и никто
     * не узнает почему. Логируем на сервере, пользователю показываем успех.
     */
    const { error: rootError } = await locals.supabase
      .from('trees')
      .update({ root_person_id: result.id })
      .eq('id', tree.id);

    if (rootError) {
      console.error('root_person_id update failed:', rootError.message);
    }

    return { created: result.id };
  }
};
```

- [ ] **Step 4: Написать хелперы чтения формы**

`src/lib/server/form.ts`:

```ts
import type { Dict } from '$lib/i18n';
import type { Violation } from '$lib/tree/invariants';
import type { PersonWrite } from '$lib/server/people';

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Юзернеймы храним без @ и без домена, телефон — как ввели. */
function username(form: FormData, key: string): string | null {
  const value = str(form, key);
  if (!value) return null;
  return value.replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '');
}

export function readPersonForm(form: FormData): PersonWrite {
  return {
    first_name: str(form, 'first_name') ?? '',
    last_name: str(form, 'last_name'),
    gender: form.get('gender') === 'female' ? 'female' : 'male',
    birth_date: str(form, 'birth_date'),
    died_on: str(form, 'died_on'),
    email: str(form, 'email'),
    phone: str(form, 'phone'),
    telegram: username(form, 'telegram'),
    instagram: username(form, 'instagram'),
    about: str(form, 'about')
  };
}

export function violationsToErrors(
  violations: Violation[],
  t: Dict
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of violations) out[v.field] = t.errors[v.code];
  return out;
}
```

- [ ] **Step 5: Написать страницу с пустым состоянием**

`src/routes/(app)/+page.svelte`:

```svelte
<script lang="ts">
  import { dict } from '$lib/i18n';
  import PersonForm from '$lib/components/PersonForm.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
  let isEmpty = $derived(data.people.length === 0);
</script>

{#if isEmpty}
  <main class="onboarding">
    <h1>{t.onboarding.title}</h1>
    <p>{t.onboarding.hint}</p>
    <form method="POST" action="?/createFirst">
      <PersonForm
        {t}
        errors={form?.errors ?? {}}
        submitLabel={t.onboarding.submit}
        showDeath={false}
      />
    </form>
  </main>
{:else}
  <p>Дерево: {data.people.length}</p>
{/if}

<style>
  .onboarding {
    max-width: 420px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4);
  }
  h1 { font-size: var(--font-5); margin: 0 0 var(--space-2); }
  p { color: var(--muted); margin: 0 0 var(--space-4); }
</style>
```

Заглушка `{:else}` живёт до задачи 11, где её заменит диаграмма.

- [ ] **Step 6: Проверить вручную**

```bash
npm run dev
```

Войти, открыть `/`. Ожидается форма «Расскажите о себе». Отправить с пустым именем — ожидается «Имя обязательно». Отправить с именем — ожидается текст «Дерево: 1».

```bash
supabase db query --linked "select first_name, gender from people; select root_person_id is not null as has_root from trees"
```

Ожидается: одна строка человека и `has_root = true`.

- [ ] **Step 7: Коммит**

```bash
git add src/lib/components/PersonForm.svelte src/lib/server/form.ts "src/routes/(app)"
git commit -m "feat: онбординг — первый человек становится корнем дерева"
```

---

### Task 10: HTML карточки

**Files:**
- Create: `src/lib/tree/card.ts`
- Create: `src/lib/styles/cards.css`
- Test: `src/lib/tree/card.test.ts`

**Interfaces:**
- Consumes: `Dict`, `Locale`, `formatYears`, `FcDatum`
- Produces:
  - `initials(person: { first_name: string; last_name: string | null }): string`
  - `renderCard(datum: FcDatum, opts: { t: Dict; locale: Locale; isMain: boolean; today?: Date }): string`
  - CSS-классы `.ft-card`, `.ft-card--main`, `.ft-card__avatar`, `.ft-card__counts`, `.ft-card__todo`

- [ ] **Step 1: Написать падающий тест**

`src/lib/tree/card.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initials, renderCard } from './card';
import { dict } from '$lib/i18n';
import type { FcDatum } from './to-family-chart';

const t = dict('ru');
const today = new Date('2026-07-30T00:00:00Z');

function datum(over: Partial<FcDatum> = {}): FcDatum {
  return {
    id: 'p1',
    data: {
      gender: 'F',
      person: {
        id: 'p1',
        tree_id: 't1',
        first_name: 'Мария',
        last_name: 'Петрова',
        gender: 'female',
        birth_date: '1948-03-07',
        died_on: null,
        email: null,
        phone: null,
        telegram: null,
        instagram: null,
        about: 'Работала учителем',
        father_id: null,
        mother_id: null
      }
    },
    rels: { parents: ['a', 'b'], spouses: ['c'], children: ['d', 'e', 'f'] },
    ...over
  } as FcDatum;
}

describe('initials', () => {
  it('берёт по первой букве имени и фамилии', () => {
    expect(initials({ first_name: 'Мария', last_name: 'Петрова' })).toBe('МП');
  });

  it('без фамилии — одна буква', () => {
    expect(initials({ first_name: 'Мария', last_name: null })).toBe('М');
  });

  it('приводит к верхнему регистру', () => {
    expect(initials({ first_name: 'иван', last_name: 'петров' })).toBe('ИП');
  });
});

describe('renderCard', () => {
  it('показывает имя, фамилию и годы', () => {
    const html = renderCard(datum(), { t, locale: 'ru', isMain: false, today });
    expect(html).toContain('Мария');
    expect(html).toContain('Петрова');
    expect(html).toContain('1948 — 78 лет');
  });

  it('показывает счётчики родителей, супругов и детей', () => {
    const html = renderCard(datum(), { t, locale: 'ru', isMain: false, today });
    expect(html).toContain('>2<');
    expect(html).toContain('>1<');
    expect(html).toContain('>3<');
  });

  it('скрывает счётчик, которого нет', () => {
    const html = renderCard(
      datum({ rels: { parents: [], spouses: [], children: [] } }),
      { t, locale: 'ru', isMain: false, today }
    );
    expect(html).not.toContain('ft-card__count');
  });

  it('ставит значок About только при непустом about', () => {
    const withAbout = renderCard(datum(), { t, locale: 'ru', isMain: false, today });
    expect(withAbout).toContain('ft-card__info');

    const d = datum();
    d.data.person.about = null;
    expect(renderCard(d, { t, locale: 'ru', isMain: false, today })).not.toContain(
      'ft-card__info'
    );
  });

  it('ставит индикатор незаполненности без даты рождения', () => {
    const d = datum();
    d.data.person.birth_date = null;
    expect(renderCard(d, { t, locale: 'ru', isMain: false, today })).toContain('ft-card__todo');
  });

  it('добавляет модификатор main для карточки в фокусе', () => {
    expect(renderCard(datum(), { t, locale: 'ru', isMain: true, today })).toContain(
      'ft-card--main'
    );
    expect(renderCard(datum(), { t, locale: 'ru', isMain: false, today })).not.toContain(
      'ft-card--main'
    );
  });

  it('экранирует HTML в пользовательских данных', () => {
    const d = datum();
    d.data.person.first_name = '<img src=x onerror=alert(1)>';
    const html = renderCard(d, { t, locale: 'ru', isMain: false, today });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('уважает локаль', () => {
    const html = renderCard(datum(), { t: dict('en'), locale: 'en', isMain: false, today });
    expect(html).toContain('1948 — 78 years');
  });
});
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

```bash
npm run test:unit -- src/lib/tree/card.test.ts
```

Ожидается: FAIL, `Cannot find module './card'`.

- [ ] **Step 3: Реализовать карточку**

`src/lib/tree/card.ts`:

```ts
import type { Dict } from '$lib/i18n';
import { formatYears } from '$lib/i18n';
import type { Locale } from '$lib/types';
import type { FcDatum } from './to-family-chart';

/** Данные пользовательские, а вставляем сырым HTML — экранировать обязательно. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function initials(person: { first_name: string; last_name: string | null }): string {
  const a = person.first_name.trim().charAt(0);
  const b = person.last_name?.trim().charAt(0) ?? '';
  return (a + b).toUpperCase();
}

export function renderCard(
  datum: FcDatum,
  opts: { t: Dict; locale: Locale; isMain: boolean; today?: Date }
): string {
  const { person } = datum.data;
  const { t, locale, isMain, today } = opts;

  const years = formatYears(person.birth_date, person.died_on, locale, today);
  const name = esc(person.first_name);
  const surname = person.last_name ? esc(person.last_name) : '';
  const incomplete = !person.birth_date || !person.about;

  const counts: string[] = [];
  const push = (icon: string, n: number, label: string) => {
    if (n > 0) {
      counts.push(
        `<span class="ft-card__count" title="${esc(label)}">${icon}<b>${n}</b></span>`
      );
    }
  };
  push('↑', datum.rels.parents.length, t.person.parents);
  push('♥', datum.rels.spouses.length, t.person.spouses);
  push('↓', datum.rels.children.length, t.person.children);

  return `
<div class="ft-card ${isMain ? 'ft-card--main' : ''} ft-card--${datum.data.gender}">
  <div class="ft-card__top">
    <span class="ft-card__avatar">${esc(initials(person))}</span>
    <span class="ft-card__names">
      <span class="ft-card__first">${name}</span>
      ${surname ? `<span class="ft-card__last">${surname}</span>` : ''}
      ${years ? `<span class="ft-card__years">${esc(years)}</span>` : ''}
    </span>
  </div>
  <div class="ft-card__bottom">
    <span class="ft-card__counts">${counts.join('')}</span>
    ${person.about ? '<span class="ft-card__info">&#9432;</span>' : ''}
    ${incomplete ? '<span class="ft-card__todo"></span>' : ''}
  </div>
</div>`.trim();
}
```

- [ ] **Step 4: Написать глобальные стили карточек**

`src/lib/styles/cards.css` (scoped-стили Svelte до этого DOM не долетают — d3 вставляет его вне дерева компонентов):

```css
.ft-card {
  box-sizing: border-box;
  width: 220px;
  min-height: var(--tap);
  padding: var(--space-3);
  display: grid;
  gap: var(--space-2);
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-left: 3px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.2s, box-shadow 0.2s, transform 0.2s;
}

.ft-card--M { border-left-color: var(--accent-male); }
.ft-card--F { border-left-color: var(--accent-female); }

.ft-card--main {
  opacity: 1;
  box-shadow: var(--shadow-2);
  transform: scale(1.04);
}

.ft-card__top { display: flex; gap: var(--space-3); align-items: center; }

.ft-card__avatar {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: var(--font-2);
  font-weight: 600;
  color: #fff;
}

.ft-card--M .ft-card__avatar { background: var(--accent-male); }
.ft-card--F .ft-card__avatar { background: var(--accent-female); }

.ft-card__names { display: grid; min-width: 0; }

.ft-card__first,
.ft-card__last,
.ft-card__years {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ft-card__first { font-size: var(--font-3); font-weight: 600; }
.ft-card__last { font-size: var(--font-2); color: var(--fg); }
.ft-card__years { font-size: var(--font-1); color: var(--muted); }

.ft-card__bottom {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--line);
  font-size: var(--font-1);
  color: var(--muted);
}

.ft-card__counts { display: flex; gap: var(--space-3); }
.ft-card__count { display: inline-flex; gap: 2px; align-items: baseline; }
.ft-card__count b { font-weight: 600; color: var(--fg); }
.ft-card__info { margin-left: auto; }

.ft-card__todo {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  margin-left: auto;
}

.ft-card__info + .ft-card__todo { margin-left: var(--space-2); }
```

- [ ] **Step 5: Прогнать тест**

```bash
npm run test:unit -- src/lib/tree/card.test.ts
```

Ожидается: PASS (12 проверок).

- [ ] **Step 6: Коммит**

```bash
git add src/lib/tree/card.ts src/lib/tree/card.test.ts src/lib/styles/cards.css
git commit -m "feat: HTML-карточки со счётчиками родственников и индикатором незаполненности"
```

---

### Task 11: Диаграмма дерева

**Files:**
- Create: `src/lib/components/FamilyTree.svelte`
- Modify: `src/routes/(app)/+page.svelte`

**Interfaces:**
- Consumes: `family-chart`, `toFamilyChart`, `renderCard`, `Dict`, `Locale`
- Produces: компонент `<FamilyTree {people} {spouses} {rootId} {t} {locale} onOpen={(id) => void} />`
  - тап по чужой карточке — перецентрировка (штатное поведение `onCardClickDefault`)
  - тап по карточке в фокусе — вызов `onOpen(id)`
  - обновление `people`/`spouses` перерисовывает данные **без** пересоздания графика

**Ключевые факты API** (из `family-chart/dist/types`): `createChart(cont, data)`, `.setCardHtml()`, `.setCardInnerHtmlCreator(fn)`, `.setOnCardClick(fn)`, `.onCardClickDefault(e, d)`, `.updateData(data)`, `.updateTree({initial, tree_position})`, `.updateMainId(id)`, `.getMainDatum()`, `.setOrientationVertical()`, `.setShowSiblingsOfMain(bool)`, `.setLinkSpouseText(fn)`, `.setSingleParentEmptyCard(bool, {label})`. Тип карточки — `TreeDatum` с полем `.data: Datum`.

- [ ] **Step 1: Написать компонент**

`src/lib/components/FamilyTree.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Spouse, Locale } from '$lib/types';
  import type { Dict } from '$lib/i18n';
  import { toFamilyChart, type PersonWithParents } from '$lib/tree/to-family-chart';
  import { renderCard } from '$lib/tree/card';
  import '$lib/styles/cards.css';

  let {
    people,
    spouses,
    rootId,
    t,
    locale,
    onOpen
  }: {
    people: PersonWithParents[];
    spouses: Spouse[];
    rootId: string | null;
    t: Dict;
    locale: Locale;
    onOpen: (id: string) => void;
  } = $props();

  let host: HTMLDivElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chart: any = null;

  let graph = $derived(toFamilyChart(people, spouses));

  onMount(async () => {
    const f3 = await import('family-chart');

    chart = f3
      .createChart(host, structuredClone(graph))
      .setOrientationVertical()
      .setCardXSpacing(250)
      .setCardYSpacing(160)
      .setShowSiblingsOfMain(true)
      .setSingleParentEmptyCard(false)
      .setLinkSpouseText((sp1: any, sp2: any) => {
        const match = spouses.find(
          (s) =>
            (s.person_a_id === sp1.data.id && s.person_b_id === sp2.data.id) ||
            (s.person_a_id === sp2.data.id && s.person_b_id === sp1.data.id)
        );
        return match?.married_on ? match.married_on.slice(0, 4) : '';
      });

    const card = chart.setCardHtml();

    card
      .setCardInnerHtmlCreator((d: any) =>
        renderCard(d.data, {
          t,
          locale,
          isMain: d.data.id === chart.getMainDatum().id
        })
      )
      .setCardDim({ w: 220, h: 96 })
      .setMiniTree(false)
      // Вариант A: чужая карточка перецентрирует, карточка в фокусе раскрывается.
      .setOnCardClick((e: MouseEvent, d: any) => {
        if (d.data.id === chart.getMainDatum().id) onOpen(d.data.id);
        else card.onCardClickDefault(e, d);
      });

    if (rootId) chart.updateMainId(rootId);
    chart.updateTree({ initial: true, tree_position: 'main_to_middle' });

    return () => {
      chart = null;
      host.innerHTML = '';
    };
  });

  /**
   * Данные обновляем через updateData, а не пересозданием графика:
   * пересоздание сбросило бы зум и фокус, и каждая правка выглядела бы
   * как перезагрузка страницы.
   */
  $effect(() => {
    if (!chart) return;
    chart.updateData(structuredClone(graph));
    chart.updateTree({ tree_position: 'inherit' });
  });
</script>

<div class="tree" bind:this={host}></div>

<style>
  .tree {
    width: 100%;
    height: 100%;
    touch-action: none;
    overflow: hidden;
  }
</style>
```

- [ ] **Step 2: Подключить диаграмму на главной**

Заменить в `src/routes/(app)/+page.svelte` блок `{:else}` и добавить импорты:

```svelte
<script lang="ts">
  import { dict } from '$lib/i18n';
  import { goto } from '$app/navigation';
  import PersonForm from '$lib/components/PersonForm.svelte';
  import FamilyTree from '$lib/components/FamilyTree.svelte';

  let { data, form } = $props();
  let t = $derived(dict(data.locale));
  let isEmpty = $derived(data.people.length === 0);
</script>
```

И блок `{:else}`:

```svelte
{:else}
  <div class="canvas">
    <FamilyTree
      people={data.people}
      spouses={data.spouses}
      rootId={data.tree.root_person_id}
      {t}
      locale={data.locale}
      onOpen={(id) => goto(`/person/${id}`)}
    />
  </div>
{/if}
```

Добавить в `<style>`:

```css
  .canvas {
    position: fixed;
    inset: 0;
  }
```

`goto` на этом шаге — обычная навигация; на shallow routing её заменит задача 12.

- [ ] **Step 3: Проверить вручную**

```bash
npm run dev
```

1. Открыть `/`. Ожидается карточка одного человека по центру, с инициалами и годами.
2. Проверить, что нет ошибок в консоли браузера.
3. Проверить pinch-зум и панораму (в devtools включить эмуляцию тач-устройства).
4. Тап по единственной карточке (она же в фокусе) — ожидается переход на `/person/<id>` и 404, потому что маршрута ещё нет. Это корректный результат шага.

- [ ] **Step 4: Прогнать полный набор тестов и сборку**

```bash
npm run test:unit
npm run build
```

Ожидается: все тесты PASS, сборка без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add src/lib/components/FamilyTree.svelte "src/routes/(app)/+page.svelte"
git commit -m "feat: диаграмма дерева на family-chart, тап в фокусе раскрывает человека"
```

---

*Задачи 12–24 — во второй части плана (`2026-07-30-family-tree-part2.md`): полный экран человека и shallow routing, правка, добавление родственников, удаление, переключатель языка и офлайн-баннер, PWA, сквозной тест, деплой (конец фазы 1), затем расчёт событий, экран «Ближайшие события», подписка на Web Push, ночная рассылка и тест изоляции данных между пользователями.*
