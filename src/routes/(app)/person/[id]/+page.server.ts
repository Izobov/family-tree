import { error } from '@sveltejs/kit';
import { deriveSiblings } from '$lib/tree/to-family-chart';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
  const { people, spouses } = await parent();

  const person = people.find((p) => p.id === params.id);
  if (!person) error(404, 'person-not-found');

  const spouseIds = spouses
    .filter((s) => s.person_a_id === person.id || s.person_b_id === person.id)
    .map((s) => (s.person_a_id === person.id ? s.person_b_id : s.person_a_id));

  return {
    person,
    parents: people.filter((p) => p.id === person.father_id || p.id === person.mother_id),
    spouses: people.filter((p) => spouseIds.includes(p.id)),
    children: people.filter((p) => p.father_id === person.id || p.mother_id === person.id),
    siblings: deriveSiblings(people, person.id)
  };
};
