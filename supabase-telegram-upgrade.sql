-- Plan9 Text Battle MVP
-- Telegram-ready upgrade migration
-- Supabase SQL Editor에 그대로 붙여 넣어 실행할 수 있습니다.

create extension if not exists pgcrypto;

-- users.telegram_id 는 나중에 텔레그램 사용자와 1:1 매핑될 수 있도록 unique index 를 둡니다.
create unique index if not exists idx_users_telegram_id_unique
on public.users (telegram_id)
where telegram_id is not null;

-- characters.user_id 조회가 자주 일어나므로 인덱스를 추가합니다.
create index if not exists idx_characters_user_id
on public.characters (user_id);

-- 캐릭터 설정 길이 제한을 다시 확인합니다.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'characters_description_length_check'
  ) then
    alter table public.characters
      add constraint characters_description_length_check
      check (char_length(description) <= 100);
  end if;
end
$$;

-- 길드 실데이터 테이블을 보장합니다.
create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.users (id) on delete cascade,
  invite_code text not null unique,
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.guild_members (
  guild_id uuid not null references public.guilds (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create unique index if not exists idx_guild_members_user_id_unique
on public.guild_members (user_id);

create index if not exists idx_guilds_score
on public.guilds (score desc, created_at desc);

create index if not exists idx_guild_members_guild_id
on public.guild_members (guild_id);

create index if not exists idx_guild_members_user_id
on public.guild_members (user_id);

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guilds'
      and policyname = 'guilds_select_public'
  ) then
    create policy "guilds_select_public"
    on public.guilds
    for select
    to public
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guilds'
      and policyname = 'guilds_insert_public'
  ) then
    create policy "guilds_insert_public"
    on public.guilds
    for insert
    to public
    with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guilds'
      and policyname = 'guilds_update_public'
  ) then
    create policy "guilds_update_public"
    on public.guilds
    for update
    to public
    using (true)
    with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guilds'
      and policyname = 'guilds_delete_public'
  ) then
    create policy "guilds_delete_public"
    on public.guilds
    for delete
    to public
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guild_members'
      and policyname = 'guild_members_select_public'
  ) then
    create policy "guild_members_select_public"
    on public.guild_members
    for select
    to public
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guild_members'
      and policyname = 'guild_members_insert_public'
  ) then
    create policy "guild_members_insert_public"
    on public.guild_members
    for insert
    to public
    with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'guild_members'
      and policyname = 'guild_members_delete_public'
  ) then
    create policy "guild_members_delete_public"
    on public.guild_members
    for delete
    to public
    using (true);
  end if;
end
$$;

-- 설명 컬럼은 현재 프론트에서 "캐릭터 설정 + 스킬 직렬화 문자열"로 사용합니다.
comment on column public.characters.description is
'현재는 캐릭터 설정과 스킬을 함께 저장하는 직렬화 문자열입니다. 운영 단계에서는 settings, skills 컬럼 분리를 권장합니다.';

comment on column public.characters.user_id is
'텔레그램 또는 웹 세션 기준 사용자 소유 캐릭터 연결용 컬럼입니다.';

comment on table public.battles is
'현재는 캐릭터 간 전투 기록용이며, 이후 텔레그램 user/chat 기준 컬럼 추가 확장이 가능합니다.';

-- RLS가 켜져 있는지 다시 보장합니다.
alter table public.users enable row level security;
alter table public.characters enable row level security;
alter table public.battles enable row level security;

-- 내 캐릭터 삭제를 위해 delete 정책을 추가합니다.
drop policy if exists "characters_delete_public" on public.characters;

create policy "characters_delete_public"
on public.characters
for delete
to public
using (true);

-- users upsert 성격 동작을 위해 읽기/삽입 정책이 없으면 기존 정책을 유지합니다.
-- 아래 정책은 이미 없다면 생성합니다.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_select_public'
  ) then
    create policy "users_select_public"
    on public.users
    for select
    to public
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_insert_public'
  ) then
    create policy "users_insert_public"
    on public.users
    for insert
    to public
    with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_update_public'
  ) then
    create policy "users_update_public"
    on public.users
    for update
    to public
    using (true)
    with check (true);
  end if;
end
$$;

-- characters 정책도 없으면 생성합니다.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'characters'
      and policyname = 'characters_select_public'
  ) then
    create policy "characters_select_public"
    on public.characters
    for select
    to public
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'characters'
      and policyname = 'characters_insert_public'
  ) then
    create policy "characters_insert_public"
    on public.characters
    for insert
    to public
    with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'characters'
      and policyname = 'characters_update_public'
  ) then
    create policy "characters_update_public"
    on public.characters
    for update
    to public
    using (true)
    with check (true);
  end if;
end
$$;

-- battles 정책도 없으면 생성합니다.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'battles'
      and policyname = 'battles_select_public'
  ) then
    create policy "battles_select_public"
    on public.battles
    for select
    to public
    using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'battles'
      and policyname = 'battles_insert_public'
  ) then
    create policy "battles_insert_public"
    on public.battles
    for insert
    to public
    with check (true);
  end if;
end
$$;

-- 스토리지 버킷이 없다면 다시 보장합니다.
insert into storage.buckets (id, name, public)
values ('character-images', 'character-images', true)
on conflict (id) do update
set public = excluded.public;

-- storage 정책도 없으면 생성합니다.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_character_images_select_public'
  ) then
    create policy "storage_character_images_select_public"
    on storage.objects
    for select
    to public
    using (bucket_id = 'character-images');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_character_images_insert_public'
  ) then
    create policy "storage_character_images_insert_public"
    on storage.objects
    for insert
    to public
    with check (bucket_id = 'character-images');
  end if;
end
$$;
