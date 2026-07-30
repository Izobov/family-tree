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
    if (error || !data.user) {
      console.error('signUp failed:', error?.message ?? 'no user returned');
      return fail(400, { error: t.auth.emailTaken });
    }

    /**
     * Дерево и настройки здесь НЕ создаём. Две отдельные вставки нельзя выполнить
     * атомарно из клиента: Supabase не бросает исключение на ошибке БД, а
     * возвращает {error}, поэтому при сбое второй вставки первая осталась бы
     * висеть, а пользователь — с активной сессией и без пути дописать
     * недостающую строку. Вместо этого дерево создаёт `ensureTree` в
     * `(app)/+layout.server.ts` — идемпотентно, при каждом входе в приложение.
     * Один путь создания вместо двух, и он же лечит пользователей, появившихся
     * мимо этой формы.
     */
    redirect(303, '/');
  }
};
