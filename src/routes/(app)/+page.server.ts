import { fail } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import { createPerson, requireTree } from '$lib/server/people';
import { readPersonForm, violationsToErrors } from '$lib/server/form';
import { adoptEmail } from '$lib/server/admin';
import type { Actions } from './$types';

export const actions: Actions = {
  createFirst: async ({ request, locals }) => {
    // В actions нет parent() — дерево запрашиваем сами.
    const { userId } = await locals.safeGetSession();
    const tree = await requireTree(locals.supabase, userId!);
    const t = dict(locals.locale);
    const input = readPersonForm(await request.formData());

    const result = await createPerson(locals.supabase, tree.id, input);
    if ('violations' in result) {
      return fail(400, { errors: violationsToErrors(result.violations, t) });
    }

    /**
     * Человек уже создан, поэтому неудачу этого обновления не превращаем в
     * ошибку формы: повторная отправка создала бы дубль. Но и молча глотать
     * нельзя — без корня дерево откроется на произвольном человеке, и никто
     * не узнает почему. Логируем на сервере, пользователю показываем успех.
     */
    const { error: rootError } = await locals.supabase
      .from('trees')
      .update({ root_person_id: result.id })
      .eq('id', tree.id);

    if (rootError) {
      console.error('root_person_id update failed:', rootError.message);
    }

    /**
     * У пришедшего из Telegram почта аккаунта синтетическая. Раз человек всё
     * равно указал свою в форме — прописываем её и в аккаунт. Молча и не
     * влияя на исход: подробности в adoptEmail.
     */
    await adoptEmail(userId!, input.email);

    return { created: result.id };
  }
};
