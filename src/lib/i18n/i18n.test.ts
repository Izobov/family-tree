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

describe('formatYears — дата рождения в будущем', () => {
  const today = new Date('2026-07-30T00:00:00Z');

  it('не показывает отрицательный возраст, только год', () => {
    expect(formatYears('2030-01-01', null, 'ru', today)).toBe('2030');
    expect(formatYears('2030-01-01', null, 'en', today)).toBe('2030');
  });

  it('нулевой возраст остаётся допустимым', () => {
    expect(formatYears('2026-01-01', null, 'ru', today)).toBe('2026 — 0 лет');
  });
});
