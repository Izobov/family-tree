import { describe, it, expect } from 'vitest';
import { personDetail } from './person-detail';
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

function sp(a: string, b: string): Spouse {
  return { tree_id: 't1', person_a_id: a, person_b_id: b, married_on: null };
}

const ids = (list: { id: string }[]) => list.map((x) => x.id).sort();

/**
 * Семья: отец и мать в браке, у них трое детей. У «сына» есть жена и свой
 * ребёнок — чтобы отличать его родню от родни его родителей.
 */
const people = [
  p('отец', { gender: 'male' }),
  p('мать', { gender: 'female' }),
  p('сын', { father_id: 'отец', mother_id: 'мать' }),
  p('дочь', { gender: 'female', father_id: 'отец', mother_id: 'мать' }),
  p('брат', { father_id: 'отец', mother_id: 'мать' }),
  p('жена', { gender: 'female' }),
  p('внук', { father_id: 'сын', mother_id: 'жена' })
];

const spouses = [sp('отец', 'мать'), sp('жена', 'сын')];

describe('personDetail', () => {
  it('собирает всю родню разом', () => {
    const d = personDetail(people, spouses, 'сын')!;

    expect(d.person.id).toBe('сын');
    expect(ids(d.parents)).toEqual(['мать', 'отец']);
    expect(ids(d.spouses)).toEqual(['жена']);
    expect(ids(d.children)).toEqual(['внук']);
    expect(ids(d.siblings)).toEqual(['брат', 'дочь']);
  });

  it('супруг находится независимо от того, с какой стороны записан брак', () => {
    // отец записан как person_a, сын — как person_b: обе стороны должны читаться.
    expect(ids(personDetail(people, spouses, 'отец')!.spouses)).toEqual(['мать']);
    expect(ids(personDetail(people, spouses, 'сын')!.spouses)).toEqual(['жена']);
  });

  it('сам себе не попадает ни в одну из категорий', () => {
    const d = personDetail(people, spouses, 'сын')!;
    const everyone = [...d.parents, ...d.spouses, ...d.children, ...d.siblings];
    expect(everyone.some((x) => x.id === 'сын')).toBe(false);
  });

  it('одиночка: все списки пустые, но объект есть', () => {
    const alone = [p('один')];
    const d = personDetail(alone, [], 'один')!;

    expect(d.person.id).toBe('один');
    expect(d.parents).toEqual([]);
    expect(d.spouses).toEqual([]);
    expect(d.children).toEqual([]);
    expect(d.siblings).toEqual([]);
  });

  it('неизвестный id даёт null — по нему вызывающий уходит на обычную навигацию', () => {
    expect(personDetail(people, spouses, 'нет-такого')).toBeNull();
  });

  it('родитель известен только один', () => {
    const half = [p('ребёнок', { mother_id: 'мама' }), p('мама', { gender: 'female' })];
    expect(ids(personDetail(half, [], 'ребёнок')!.parents)).toEqual(['мама']);
  });
});
