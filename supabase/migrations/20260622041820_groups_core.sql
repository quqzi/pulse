create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  status text not null default 'pending' check (status in ('pending','approved')),
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (group_id, user_id)
);
create index group_members_group_idx on public.group_members(group_id);
create index group_members_user_idx on public.group_members(user_id);
create index group_members_pending_idx on public.group_members(group_id) where status = 'pending';

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id and status = 'approved'
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.study_groups where id = p_group_id and owner_id = p_user_id);
$$;

create or replace function public.gen_invite_code()
returns text language plpgsql set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.study_groups where invite_code = code);
  end loop;
  return code;
end;
$$;

alter table public.study_groups enable row level security;
alter table public.group_members enable row level security;

create policy study_groups_select on public.study_groups for select
  using (owner_id = auth.uid() or public.is_group_member(id, auth.uid()));

create policy group_members_select_self on public.group_members for select
  using (user_id = auth.uid());
create policy group_members_select_comember on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));
