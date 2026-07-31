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
