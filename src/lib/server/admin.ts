import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { isTelegramEmail } from './telegram';

/**
 * Клиенты, живущие вне запроса пользователя. Оба намеренно без persistSession:
 * куки ставит только серверный клиент из hooks.server.ts, и второго владельца
 * сессии в приложении быть не должно.
 *
 * $env/dynamic/private, а не static: ключа может не быть на этапе сборки, и
 * static уронил бы билд вместо того, чтобы вернуть внятную ошибку в рантайме.
 */

/** Обходит RLS. Только для того, что пользователь про себя доказал подписью Telegram. */
export function adminClient(): SupabaseClient | null {
  const key = env.SUPABASE_SECRET_KEY;
  if (!key) return null;

  return createClient(PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Одноразовый клиент для проверки пароля при привязке аккаунта. Нужен именно
 * отдельный: проверка на locals.supabase выдала бы куки ДО того, как связка
 * записана, и при сбое вставки пользователь остался бы залогинен, но не привязан.
 */
export function probeClient(): SupabaseClient {
  return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Выдаёт пользователю обычную сессию Supabase по его email.
 *
 * Админ-клиент выпускает одноразовый magic-link-токен, серверный клиент из
 * хуков тут же его гасит и кладёт свои обычные куки. Смысл в том, что механизм
 * сессии в приложении остаётся ровно один: safeGetSession, getClaims, обновление
 * токена и RLS не знают, что пользователь пришёл из Telegram.
 */
export async function grantSession(
  ssr: SupabaseClient,
  admin: SupabaseClient,
  email: string
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error('generateLink failed:', error?.message ?? 'no hashed_token');
    return false;
  }

  const { error: verifyError } = await ssr.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
  if (verifyError) {
    console.error('verifyOtp failed:', verifyError.message);
    return false;
  }

  return true;
}

/**
 * Прописывает почту из онбординга в аккаунт — но только поверх синтетической,
 * выданной при входе через Telegram. Настоящую, введённую при обычной
 * регистрации, не трогает: это её логин.
 *
 * Ничего не бросает и не возвращает. Поле email в онбординге необязательное и
 * означает в первую очередь контакт человека в дереве, а запись в аккаунт —
 * бонус сверху. Если почта уже занята другим аккаунтом, ронять из-за этого
 * создание дерева несоразмерно: человек остаётся на синтетической почте.
 *
 * Само по себе это в веб не пускает — пароля у телеграмного аккаунта нет, а
 * восстановления пароля в приложении нет вовсе.
 */
export async function adoptEmail(userId: string, email: string | null): Promise<void> {
  if (!email) return;

  const admin = adminClient();
  if (!admin) return;

  const { data: found, error } = await admin.auth.admin.getUserById(userId);
  if (error || !found.user) return;
  if (!isTelegramEmail(found.user.email)) return;

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true
  });

  if (updateError) console.error('adoptEmail failed:', updateError.message);
}
