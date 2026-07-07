create table public.custom_goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  icon text not null default '🎯',
  metric text not null,
  target numeric not null,
  created_at timestamptz not null default now()
);

create index custom_goals_user_id_idx on public.custom_goals (user_id);

alter table public.custom_goals enable row level security;

create policy "custom_goals_select_own" on public.custom_goals
  for select using (auth.uid() = user_id);
create policy "custom_goals_insert_own" on public.custom_goals
  for insert with check (auth.uid() = user_id);
create policy "custom_goals_update_own" on public.custom_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_goals_delete_own" on public.custom_goals
  for delete using (auth.uid() = user_id);
