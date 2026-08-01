import { error, fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import { deriveSiblings } from '$lib/tree/to-family-chart';
import { updatePerson, requireTree } from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import type { Actions, PageServerLoad } from './$types';

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

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    // В actions нет parent() — дерево запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    const t = dict(locals.locale);
    const input = readPersonForm(await request.formData());

    const result = await updatePerson(locals.supabase, tree.id, params.id, input);
    if ('violations' in result) {
      return fail(400, { errors: violationsToErrors(result.violations, t) });
    }

    redirect(303, `/person/${params.id}`);
  }
};
