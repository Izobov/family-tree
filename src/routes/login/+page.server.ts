import { fail, redirect } from '@sveltejs/kit';
import { dict } from '$lib/i18n';
import type { Actions, PageServerLoad } from './$types';

/**
 * redirectTo приходит из URL, то есть от кого угодно. Без проверки это open
 * redirect: ссылка вида /login?redirectTo=https://evil.com уводит пользователя
 * на чужой сайт уже после успешного входа, с нашего домена — классический
 * фишинговый приём. Пропускаем только относительные пути внутри приложения.
 * `//evil.com` и `/\evil.com` браузеры трактуют как абсолютные, поэтому их тоже
 * отбрасываем.
 */
function safeRedirect(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = await locals.safeGetSession();
  if (userId) redirect(303, '/');
  return { locale: locals.locale, redirectTo: safeRedirect(url.searchParams.get('redirectTo')) };
};

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const t = dict(locals.locale);

    const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
    if (error) return fail(400, { error: t.auth.invalidCredentials });

    redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
  }
};
