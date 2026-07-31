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
