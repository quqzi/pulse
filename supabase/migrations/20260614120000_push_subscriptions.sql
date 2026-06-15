-- Web Push: one row per device/browser endpoint, plus a dedupe log so each
-- nudge fires at most once per (user, key). Applied via the Supabase MCP /
-- dashboard (this repo has no local CLI stack).

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions own rows"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

-- Dedupe log. kind examples: 'block:<slotId>:<YYYY-MM-DD>', 'daily:<YYYY-MM-DD>',
-- 'streak:<YYYY-MM-DD>'. RLS on with NO policies → only the service role (the
-- Edge Function) can read/write it.
create table if not exists public.notification_sends (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  kind     text not null,
  sent_at  timestamptz not null default now(),
  unique (user_id, kind)
);

alter table public.notification_sends enable row level security;
