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

  /**
   * Дата рождения в будущем — почти всегда опечатка, но показывать «-1 год»
   * нельзя: это выглядит как поломка приложения, а не как ошибка ввода.
   * Показываем только год, возраст опускаем.
   */
  if (age < 0) return birth!.slice(0, 4);

  const unit =
    locale === 'ru'
      ? plural(age, dict('ru').person.ageYears)
      : age === 1
        ? 'year'
        : 'years';
  return `${birth!.slice(0, 4)} — ${age} ${unit}`;
}
