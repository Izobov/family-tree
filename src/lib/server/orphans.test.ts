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
