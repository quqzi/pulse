create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id and status = 'approved'
  );
$$;

create or replace function private.is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.study_groups where id = p_group_id and owner_id = p_user_id);
$$;

grant execute on function private.is_group_member(uuid, uuid) to anon, authenticated;
grant execute on function private.is_group_owner(uuid, uuid) to anon, authenticated;

drop policy study_groups_select on public.study_groups;
create policy study_groups_select on public.study_groups for select
  using (owner_id = auth.uid() or private.is_group_member(id, auth.uid()));

drop policy group_members_select_comember on public.group_members;
create policy group_members_select_comember on public.group_members for select
  using (private.is_group_member(group_id, auth.uid()));

drop function public.is_group_member(uuid, uuid);
drop function public.is_group_owner(uuid, uuid);
