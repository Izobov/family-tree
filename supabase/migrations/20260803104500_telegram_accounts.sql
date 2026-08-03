-- Связка Telegram ↔ аккаунт Supabase.
--
-- Оба ключа уникальны, и это не украшение, а вся защита от угона:
-- telegram_id первичный — один Telegram ведёт ровно в один аккаунт;
-- user_id уникальный — к одному аккаунту нельзя привязать второй Telegram.
-- Попытка привязать уже привязанное упирается в ограничение БД, а не в
-- проверку в коде, которую можно забыть.
--
-- bigint, а не int: идентификаторы Telegram уже перевалили за 2^31.
create table telegram_accounts (
  telegram_id bigint primary key,
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  username    text,
  first_name  text,
  last_name   text,
  linked_at   timestamptz not null default now()
);

alter table telegram_accounts enable row level security;

-- Политик на запись нет намеренно: строки пишет только серверный эндпоинт
-- под админ-ключом, после проверки подписи Telegram. Пользователю оставлены
-- чтение своей связки (показать «Telegram привязан») и её удаление.
create policy telegram_accounts_select_own on telegram_accounts
  for select using (user_id = (select auth.uid()));

create policy telegram_accounts_delete_own on telegram_accounts
  for delete using (user_id = (select auth.uid()));
