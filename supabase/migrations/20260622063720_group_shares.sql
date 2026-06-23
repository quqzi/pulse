create table public.group_shares (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('flashcard_deck','exam_set')),
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index group_shares_group_idx on public.group_shares(group_id, created_at desc);

alter table public.group_shares enable row level security;

create policy group_shares_select on public.group_shares for select
  using (private.is_group_member(group_id, auth.uid()));
create policy group_shares_insert on public.group_shares for insert
  with check (shared_by = auth.uid() and private.is_group_member(group_id, auth.uid()));
create policy group_shares_delete on public.group_shares for delete
  using (shared_by = auth.uid() or private.is_group_owner(group_id, auth.uid()));
