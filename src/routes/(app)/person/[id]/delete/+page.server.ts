import { error, redirect } from '@sveltejs/kit';
import { deletePerson, orphansOf, requireTree } from '$lib/server/people';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
  const { people } = await parent();
  const person = people.find((p) => p.id === params.id);
  if (!person) error(404, 'person-not-found');

  return { person, orphans: orphansOf(people, person.id) };
};

export const actions: Actions = {
  confirm: async ({ params, locals }) => {
    // В actions нет parent() — дерево запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);

    const result = await deletePerson(locals.supabase, tree.id, params.id);
    // Не редиректим как при успехе, если удаление не прошло: иначе человек
    // вернётся в дерево и увидит там того, кого «удалил».
    if ('violations' in result) error(503, 'delete-failed');

    redirect(303, '/');
  }
};
