import { fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { userId } = await locals.safeGetSession();
  if (userId) redirect(303, '/');
  return { locale: locals.locale };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const t = dict(locals.locale);

    if (password.length < 6) return fail(400, { error: t.auth.passwordTooShort });

    const { data, error } = await locals.supabase.auth.signUp({ email, password });
    if (error || !data.user) return fail(400, { error: t.auth.emailTaken });

    // Подтверждение email выключено, поэтому сессия уже активна и RLS пропустит вставку.
    const [{ error: treeError }, { error: settingsError }] = await Promise.all([
      locals.supabase.from('trees').insert({ owner_id: data.user.id, name: t.app.myTree }),
      locals.supabase.from('user_settings').insert({ user_id: data.user.id, locale: locals.locale })
    ]);

    if (treeError || settingsError) return fail(500, { error: t.errors.unavailable });

    redirect(303, '/');
  }
};
