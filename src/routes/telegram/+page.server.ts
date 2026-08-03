import { fail, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { dict } from '$lib/i18n';
import { verifyInitData, telegramEmail, type TelegramUser } from '$lib/server/telegram';
import { adminClient, probeClient, grantSession } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  return { locale: locals.locale };
};

/**
 * Кука-признак «мы внутри Telegram». Её читает корневой layout, чтобы подгрузить
 * SDK и вызвать expand() — без него на части клиентов окно открывается в
 * половину экрана. Веб- и PWA-пользователи куки не имеют и лишнего запроса к
 * чужому домену не делают.
 */
function markTelegram(cookies: Cookies) {
  cookies.set('tg', '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  });
}

/** Разбор и проверка подписи — общее начало всех трёх экшнов. */
async function readInitData(
  request: Request
): Promise<{ form: FormData; tgUser: TelegramUser | null }> {
  const form = await request.formData();
  const initData = String(form.get('init_data') ?? '');
  return { form, tgUser: verifyInitData(initData, env.TELEGRAM_BOT_TOKEN ?? '') };
}

async function linkedUserId(
  admin: NonNullable<ReturnType<typeof adminClient>>,
  telegramId: number
): Promise<{ userId: string | null } | { failed: true }> {
  const { data, error } = await admin
    .from('telegram_accounts')
    .select('user_id')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) {
    console.error('telegram_accounts read failed:', error.message);
    return { failed: true };
  }
  return { userId: (data?.user_id as string | undefined) ?? null };
}

export const actions: Actions = {
  /**
   * Знакомый Telegram — сразу в дерево, без единого экрана. Незнакомый —
   * возвращаем `unknown`, и страница показывает выбор из двух кнопок.
   */
  auto: async ({ request, locals, cookies }: RequestEvent) => {
    const t = dict(locals.locale);
    const { tgUser } = await readInitData(request);
    if (!tgUser) return fail(400, { error: t.telegram.invalid });

    const admin = adminClient();
    if (!admin) return fail(503, { error: t.telegram.unavailable });

    const link = await linkedUserId(admin, tgUser.id);
    if ('failed' in link) return fail(503, { error: t.telegram.unavailable });
    if (!link.userId) return { status: 'unknown' as const, firstName: tgUser.first_name };

    const { data: found, error } = await admin.auth.admin.getUserById(link.userId);
    if (error || !found.user?.email) {
      console.error('getUserById failed:', error?.message ?? 'no email');
      return fail(503, { error: t.telegram.unavailable });
    }

    if (!(await grantSession(locals.supabase, admin, found.user.email))) {
      return fail(503, { error: t.telegram.unavailable });
    }

    markTelegram(cookies);
    redirect(303, '/');
  },

  /**
   * Новый аккаунт. Пароля нет намеренно: Telegram уже подтвердил, кто это.
   * Дерево создаст ensureTree при первом входе в (app), как и всем остальным.
   */
  signup: async ({ request, locals, cookies }: RequestEvent) => {
    const t = dict(locals.locale);
    const { tgUser } = await readInitData(request);
    if (!tgUser) return fail(400, { error: t.telegram.invalid });

    const admin = adminClient();
    if (!admin) return fail(503, { error: t.telegram.unavailable });

    // Гонка: пока человек читал экран выбора, связка могла появиться.
    const link = await linkedUserId(admin, tgUser.id);
    if ('failed' in link) return fail(503, { error: t.telegram.unavailable });
    if (link.userId) return fail(409, { error: t.telegram.alreadyLinked });

    const email = telegramEmail(tgUser.id);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true
    });

    /**
     * Конфликт здесь означает аккаунт с этой синтетической почтой, но без
     * строки связки. Штатным путём такое не получается — строка удаляется
     * только каскадом вместе с аккаунтом. Если появится отвязка Telegram,
     * этот случай надо будет разобрать там, а не молча создавать второй аккаунт.
     */
    if (createError || !created.user) {
      console.error('createUser failed:', createError?.message ?? 'no user');
      return fail(503, { error: t.telegram.unavailable });
    }

    const { error: linkError } = await admin.from('telegram_accounts').insert({
      telegram_id: tgUser.id,
      user_id: created.user.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name
    });

    if (linkError) {
      // Связка не легла — не оставляем аккаунт, в который никто не сможет войти.
      console.error('telegram_accounts insert failed:', linkError.message);
      await admin.auth.admin.deleteUser(created.user.id);
      return fail(503, { error: t.telegram.unavailable });
    }

    if (!(await grantSession(locals.supabase, admin, email))) {
      return fail(503, { error: t.telegram.unavailable });
    }

    markTelegram(cookies);
    redirect(303, '/');
  },

  /**
   * Привязка к существующему аккаунту. Пароль проверяется на отдельном
   * одноразовом клиенте, а не на locals.supabase: иначе куки легли бы ДО
   * записи связки, и при сбое вставки пользователь остался бы залогинен, но
   * не привязан. Сессия выдаётся только после того, как всё остальное удалось.
   */
  link: async ({ request, locals, cookies }: RequestEvent) => {
    const t = dict(locals.locale);
    const { form, tgUser } = await readInitData(request);
    if (!tgUser) return fail(400, { error: t.telegram.invalid });

    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    const admin = adminClient();
    if (!admin) return fail(503, { error: t.telegram.unavailable, mode: 'link' as const });

    const link = await linkedUserId(admin, tgUser.id);
    if ('failed' in link) return fail(503, { error: t.telegram.unavailable, mode: 'link' as const });
    if (link.userId) return fail(409, { error: t.telegram.alreadyLinked, mode: 'link' as const });

    const probe = probeClient();
    const { data: signedIn, error: passwordError } = await probe.auth.signInWithPassword({
      email,
      password
    });

    if (passwordError || !signedIn.user) {
      return fail(400, { error: t.auth.invalidCredentials, mode: 'link' as const });
    }
    // Сессия проверочного клиента больше не нужна и жить не должна.
    await probe.auth.signOut();

    const { error: linkError } = await admin.from('telegram_accounts').insert({
      telegram_id: tgUser.id,
      user_id: signedIn.user.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name
    });

    if (linkError) {
      /**
       * Единственная реальная причина — у аккаунта уже есть другой Telegram
       * (user_id уникален). Ограничение БД, а не проверка в коде, поэтому
       * гонка двух одновременных привязок сюда же и приходит.
       */
      console.error('telegram_accounts insert failed:', linkError.message);
      return fail(409, { error: t.telegram.accountTaken, mode: 'link' as const });
    }

    if (!(await grantSession(locals.supabase, admin, email))) {
      return fail(503, { error: t.telegram.unavailable, mode: 'link' as const });
    }

    markTelegram(cookies);
    redirect(303, '/');
  }
};
