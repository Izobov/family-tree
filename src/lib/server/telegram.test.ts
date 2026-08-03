import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyInitData, telegramEmail, isTelegramEmail } from './telegram';

const TOKEN = '123456:test-bot-token-not-a-real-one';
const NOW = new Date('2026-08-03T12:00:00Z');

/** Подписываем данные тем же алгоритмом, что и Telegram, — тестовым токеном. */
function sign(params: Record<string, string>, token = TOKEN): string {
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  return new URLSearchParams({ ...params, hash }).toString();
}

const USER = { id: 987654321, first_name: 'Иван', last_name: 'Изобов', username: 'izobov' };

function initData(over: Record<string, string> = {}, token = TOKEN): string {
  return sign(
    {
      user: JSON.stringify(USER),
      auth_date: String(Math.floor(NOW.getTime() / 1000)),
      query_id: 'AAH123',
      ...over
    },
    token
  );
}

describe('verifyInitData: валидная подпись', () => {
  it('возвращает пользователя', () => {
    expect(verifyInitData(initData(), TOKEN, NOW)).toEqual({
      id: 987654321,
      first_name: 'Иван',
      last_name: 'Изобов',
      username: 'izobov'
    });
  });

  it('необязательные поля отсутствуют — null, а не undefined', () => {
    const raw = initData({ user: JSON.stringify({ id: 42, first_name: 'Анна' }) });
    expect(verifyInitData(raw, TOKEN, NOW)).toEqual({
      id: 42,
      first_name: 'Анна',
      last_name: null,
      username: null
    });
  });

  it('кириллица и пробелы переживают процентное кодирование', () => {
    const raw = initData({
      user: JSON.stringify({ id: 7, first_name: 'Мария Анна', last_name: 'фон Дер' })
    });
    expect(verifyInitData(raw, TOKEN, NOW)?.first_name).toBe('Мария Анна');
    expect(verifyInitData(raw, TOKEN, NOW)?.last_name).toBe('фон Дер');
  });
});

describe('verifyInitData: подпись не проходит', () => {
  it('подделанный hash', () => {
    const raw = initData().replace(/hash=[0-9a-f]+/, 'hash=' + 'a'.repeat(64));
    expect(verifyInitData(raw, TOKEN, NOW)).toBeNull();
  });

  it('hash неверной длины не роняет timingSafeEqual', () => {
    const raw = initData().replace(/hash=[0-9a-f]+/, 'hash=abc');
    expect(() => verifyInitData(raw, TOKEN, NOW)).not.toThrow();
    expect(verifyInitData(raw, TOKEN, NOW)).toBeNull();
  });

  it('hash не hex вовсе', () => {
    const raw = initData().replace(/hash=[0-9a-f]+/, 'hash=zzzz');
    expect(verifyInitData(raw, TOKEN, NOW)).toBeNull();
  });

  it('hash отсутствует', () => {
    const raw = initData().replace(/&?hash=[0-9a-f]+/, '');
    expect(verifyInitData(raw, TOKEN, NOW)).toBeNull();
  });

  it('подписано ЧУЖИМ токеном', () => {
    expect(verifyInitData(initData({}, 'other:token'), TOKEN, NOW)).toBeNull();
  });

  it('подменённое поле при валидном для старых данных hash', () => {
    // Классическая атака: берём подписанные данные и правим user на своего.
    const raw = initData().replace(/user=[^&]+/, 'user=' + encodeURIComponent('{"id":1,"first_name":"Мэллори"}'));
    expect(verifyInitData(raw, TOKEN, NOW)).toBeNull();
  });
});

describe('verifyInitData: возраст подписи', () => {
  it('старше суток отвергается', () => {
    const stale = String(Math.floor(NOW.getTime() / 1000) - 24 * 60 * 60 - 60);
    expect(verifyInitData(initData({ auth_date: stale }), TOKEN, NOW)).toBeNull();
  });

  it('ровно в пределах суток принимается', () => {
    const edge = String(Math.floor(NOW.getTime() / 1000) - 24 * 60 * 60 + 60);
    expect(verifyInitData(initData({ auth_date: edge }), TOKEN, NOW)).not.toBeNull();
  });

  it('далёкое будущее отвергается', () => {
    const future = String(Math.floor(NOW.getTime() / 1000) + 60 * 60);
    expect(verifyInitData(initData({ auth_date: future }), TOKEN, NOW)).toBeNull();
  });

  it('небольшой уход часов вперёд прощается', () => {
    const skewed = String(Math.floor(NOW.getTime() / 1000) + 60);
    expect(verifyInitData(initData({ auth_date: skewed }), TOKEN, NOW)).not.toBeNull();
  });

  it('auth_date не число', () => {
    expect(verifyInitData(initData({ auth_date: 'вчера' }), TOKEN, NOW)).toBeNull();
  });
});

describe('verifyInitData: поле user', () => {
  it('отсутствует', () => {
    const raw = sign({ auth_date: String(Math.floor(NOW.getTime() / 1000)) });
    expect(verifyInitData(raw, TOKEN, NOW)).toBeNull();
  });

  it('не разбирается как JSON', () => {
    expect(verifyInitData(initData({ user: '{не json' }), TOKEN, NOW)).toBeNull();
  });

  it('без id', () => {
    expect(verifyInitData(initData({ user: '{"first_name":"Аноним"}' }), TOKEN, NOW)).toBeNull();
  });

  it('id строкой, а не числом', () => {
    const raw = initData({ user: '{"id":"42","first_name":"Аноним"}' });
    expect(verifyInitData(raw, TOKEN, NOW)).toBeNull();
  });

  it('без first_name', () => {
    expect(verifyInitData(initData({ user: '{"id":42}' }), TOKEN, NOW)).toBeNull();
  });

  it('user это массив, а не объект', () => {
    expect(verifyInitData(initData({ user: '[1,2,3]' }), TOKEN, NOW)).toBeNull();
  });
});

describe('verifyInitData: пустой ввод', () => {
  it('пустая строка', () => {
    expect(verifyInitData('', TOKEN, NOW)).toBeNull();
  });

  it('пустой токен — иначе незаданный TELEGRAM_BOT_TOKEN пускал бы кого угодно', () => {
    expect(verifyInitData(initData(), '', NOW)).toBeNull();
  });
});

describe('синтетическая почта', () => {
  it('строится по id', () => {
    expect(telegramEmail(42)).toBe('tg-42@telegram.local');
  });

  it('распознаётся', () => {
    expect(isTelegramEmail(telegramEmail(987654321))).toBe(true);
  });

  it('настоящая почта не считается синтетической', () => {
    expect(isTelegramEmail('izobov9@gmail.com')).toBe(false);
    expect(isTelegramEmail('tg-abc@telegram.local')).toBe(false);
    expect(isTelegramEmail(null)).toBe(false);
  });
});
