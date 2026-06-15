-- One-off scheduled pushes (e.g. "your pomodoro just finished"), fired by the
-- same send-push cron. The client inserts a row when a pomodoro starts (fire_at =
-- when it will complete) and deletes it on pause/stop; the function sends any row
-- whose fire_at has passed and stamps sent_at so it never fires twice.
create table if not exists public.scheduled_pushes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fire_at timestamptz not null,
  title text not null,
  body text not null,
  url text not null default '/timer',
  tag text not null default 'pomodoro',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.scheduled_pushes enable row level security;

-- Owners manage their own scheduled pushes (insert on start, delete on cancel).
create policy "own scheduled_pushes"
  on public.scheduled_pushes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The cron query: pending rows whose time has come.
create index if not exists scheduled_pushes_due_idx
  on public.scheduled_pushes (fire_at)
  where sent_at is null;
