import type { Spouse } from '$lib/types';
import { deriveSiblings, type PersonWithParents } from './to-family-chart';

export type PersonDetailData = {
  person: PersonWithParents;
  parents: PersonWithParents[];
  spouses: PersonWithParents[];
  children: PersonWithParents[];
  siblings: PersonWithParents[];
};

/**
 * Родня человека — чистая выборка из уже загруженного дерева, без единого
 * запроса к базе.
 *
 * Именно поэтому функция общая для сервера и клиента. На странице дерева весь
 * список людей и браков уже лежит в браузере, и раньше тап по карточке всё
 * равно уходил на сервер за тем, что и так было под рукой: preloadData тянул
 * серверный load, а тот вместе с родительским layout делал четыре обращения к
 * Supabase. При базе в Сиднее и функциях в Сингапуре это и была та самая
 * задержка перед открытием профиля.
 */
export function personDetail(
  people: PersonWithParents[],
  spouses: Spouse[],
  personId: string
): PersonDetailData | null {
  const person = people.find((p) => p.id === personId);
  if (!person) return null;

  const spouseIds = spouses
    .filter((s) => s.person_a_id === personId || s.person_b_id === personId)
    .map((s) => (s.person_a_id === personId ? s.person_b_id : s.person_a_id));

  return {
    person,
    parents: people.filter((p) => p.id === person.father_id || p.id === person.mother_id),
    spouses: people.filter((p) => spouseIds.includes(p.id)),
    children: people.filter((p) => p.father_id === personId || p.mother_id === personId),
    siblings: deriveSiblings(people, personId)
  };
}
