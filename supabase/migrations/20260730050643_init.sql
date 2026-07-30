create table trees (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  root_person_id uuid,
  created_at     timestamptz not null default now()
);

create table people (
  id         uuid primary key default gen_random_uuid(),
  tree_id    uuid not null references trees(id) on delete cascade,
  first_name text not null,
  last_name  text,
  gender     text not null check (gender in ('male','female')),
  birth_date date,
  died_on    date,
  email      text,
  phone      text,
  telegram   text,
  instagram  text,
  about      text,
  father_id  uuid references people(id) on delete set null,
  mother_id  uuid references people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (father_id is null or father_id <> id),
  check (mother_id is null or mother_id <> id),
  check (died_on is null or birth_date is null or died_on >= birth_date)
);

create table spouses (
  tree_id     uuid not null references trees(id) on delete cascade,
  person_a_id uuid not null references people(id) on delete cascade,
  person_b_id uuid not null references people(id) on delete cascade,
  married_on  date,
  primary key (person_a_id, person_b_id),
  check (person_a_id < person_b_id)
);

alter table trees add constraint trees_root_fk
  foreign key (root_person_id) references people(id) on delete set null;

create table user_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  locale       text not null default 'ru' check (locale in ('ru','en')),
  push_enabled boolean not null default false,
  lead_days    int not null default 3 check (lead_days between 0 and 30)
);

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create table notifications_sent (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('birthday','anniversary')),
  subject_key text not null,
  event_date  date not null,
  sent_at     timestamptz not null default now(),
  primary key (user_id, kind, subject_key, event_date)
);

create index people_tree_idx   on people(tree_id);
create index people_father_idx on people(father_id);
create index people_mother_idx on people(mother_id);
create index spouses_tree_idx  on spouses(tree_id);
create index push_user_idx     on push_subscriptions(user_id);
create index trees_owner_idx   on trees(owner_id);

-- RLS

alter table trees              enable row level security;
alter table people             enable row level security;
alter table spouses            enable row level security;
alter table user_settings      enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications_sent enable row level security;

create policy trees_owner on trees for all
  to authenticated
  using      (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy people_owner on people for all
  to authenticated
  using      (exists (select 1 from trees t
                      where t.id = people.tree_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from trees t
                      where t.id = people.tree_id and t.owner_id = (select auth.uid())));

create policy spouses_owner on spouses for all
  to authenticated
  using      (exists (select 1 from trees t
                      where t.id = spouses.tree_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from trees t
                      where t.id = spouses.tree_id and t.owner_id = (select auth.uid())));

create policy settings_own on user_settings for all
  to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy subs_own on push_subscriptions for all
  to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- notifications_sent: политик нет, доступ только под секретным ключом

-- Экспозиция в Data API. С 2026-04-28 новые таблицы в public не экспонируются
-- автоматически, поэтому grant'ы обязательны.

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on table trees, people, spouses, user_settings, push_subscriptions
  to authenticated;
