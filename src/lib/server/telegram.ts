import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Единственное место в проекте, где живёт криптография Telegram.
 *
 * Telegram отдаёт мини-аппу строку initData — параметры в формате query-строки
 * плюс подпись HMAC-SHA256. Ключ подписи выводится из токена бота, поэтому
 * проверить её может только тот, у кого этот токен есть.
 */

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
};

/**
 * Подписанная строка не протухает сама. Без ограничения по возрасту однажды
 * перехваченный initData работал бы вечно.
 */
const MAX_AGE_SECONDS = 24 * 60 * 60;

/** Допуск на рассинхрон часов вперёд — иначе спешащие часы клиента ломают вход. */
const MAX_SKEW_SECONDS = 5 * 60;

/**
 * Возвращает данные пользователя либо null. Намеренно не сообщает, какая
 * именно проверка не прошла: наружу это знание утекать не должно.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  now: Date = new Date()
): TelegramUser | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  /**
   * data_check_string по спецификации Telegram: пары key=value, отсортированные
   * по ключу, склеенные через \n. Значения именно декодированные — URLSearchParams
   * уже сняла процентное кодирование.
   */
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();

  /**
   * Сравнение постоянного времени, а не ===. Буфер из невалидного hex получится
   * короче 32 байт, поэтому проверка длины заодно отсекает мусор в hash —
   * timingSafeEqual на разной длине бросает исключение.
   */
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return null;

  const ageSeconds = now.getTime() / 1000 - authDate;
  if (ageSeconds > MAX_AGE_SECONDS) return null;
  if (ageSeconds < -MAX_SKEW_SECONDS) return null;

  const rawUser = params.get('user');
  if (!rawUser) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawUser);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const user = parsed as Record<string, unknown>;

  // Telegram присылает id числом, а first_name есть всегда — остальное опционально.
  if (typeof user.id !== 'number' || !Number.isInteger(user.id)) return null;
  if (typeof user.first_name !== 'string' || user.first_name === '') return null;

  return {
    id: user.id,
    first_name: user.first_name,
    last_name: typeof user.last_name === 'string' ? user.last_name : null,
    username: typeof user.username === 'string' ? user.username : null
  };
}

/** Синтетическая почта телеграмного аккаунта — Supabase требует email. */
export function telegramEmail(telegramId: number): string {
  return `tg-${telegramId}@telegram.local`;
}

/** Настоящую почту онбординг перезаписывать не должен — только синтетическую. */
export function isTelegramEmail(email: string | undefined | null): boolean {
  return typeof email === 'string' && /^tg-\d+@telegram\.local$/.test(email);
}
