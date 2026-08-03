import { error, fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import { personDetail } from '$lib/tree/person-detail';
import { updatePerson, requireTree } from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
  const { people, spouses } = await parent();

  // Та же функция, которой страница дерева собирает оверлей на клиенте, —
  // иначе прямой переход и тап по карточке показывали бы разное.
  const detail = personDetail(people, spouses, params.id);
  if (!detail) error(404, 'person-not-found');

  return detail;
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
