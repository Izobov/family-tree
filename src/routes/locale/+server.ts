import { redirect } from '@sveltejs/kit';
import { defaultLocale, locales } from '$lib/i18n';
import type { Locale } from '$lib/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  const form = await request.formData();
  const raw = String(form.get('locale') ?? '');
  const locale: Locale = locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;

  // Кука — для рендера страниц, БД — чтобы крон уведомлений знал язык без
  // куки: у него нет запроса пользователя, только запись в user_settings.
  cookies.set('locale', locale, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  });

  const { userId } = await locals.safeGetSession();
  if (userId) {
    const { error } = await locals.supabase
      .from('user_settings')
      .update({ locale })
      .eq('user_id', userId);
    if (error) console.error('locale-update-failed:', error.message);
  }

  redirect(303, request.headers.get('referer') ?? '/');
};
