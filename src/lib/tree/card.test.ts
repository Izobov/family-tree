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
