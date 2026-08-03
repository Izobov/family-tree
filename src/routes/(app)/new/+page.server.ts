import { fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import { createPerson, requireTree } from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import type { Actions } from './$types';

export const actions: Actions = {
  /**
   * Человек без единой связи. Это сознательно: /person/[id]/add умеет заводить
   * человека только в роли чьего-то родственника, а здесь роль ещё неизвестна —
   * связать можно позже, с его же страницы, «Выбрать из существующих».
   *
   * Откатывать нечего (createPerson — единственная запись), поэтому rollback,
   * который есть в add, тут не нужен.
   */
  default: async ({ request, locals }) => {
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    const t = dict(locals.locale);
    const form = await request.formData();

    const created = await createPerson(locals.supabase, tree.id, readPersonForm(form));
    if ('violations' in created) {
      return fail(400, { errors: violationsToErrors(created.violations, t) });
    }

    redirect(303, `/person/${created.id}`);
  }
};
