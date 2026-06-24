-- 1. New configurable columns on study_groups
alter table public.study_groups
  add column join_policy  text not null default 'approval'
    check (join_policy in ('approval','open')),
  add column share_policy text not null default 'members'
    check (share_policy in ('members','owner')),
  add column description  text check (char_length(description) <= 280),
  add column icon         text check (char_length(icon) <= 8),
  add column member_cap   int  check (member_cap is null or member_cap > 0);

-- 2. join_group respects join_policy + member_cap (within the existing 50 ceiling)
create or replace function public.join_group(p_invite_code text)
returns group_members language plpgsql security definer set search_path to 'public'
as $$
declare g public.study_groups; m public.group_members; approved_n int; my_n int; v_status text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into g from public.study_groups where invite_code = upper(trim(p_invite_code));
  if g.id is null then raise exception 'invalid code'; end if;
  select count(*) into my_n from public.group_members where user_id = auth.uid();
  if my_n >= 20 then raise exception 'group limit reached'; end if;
  select count(*) into approved_n from public.group_members where group_id = g.id and status='approved';
  if approved_n >= least(coalesce(g.member_cap, 50), 50) then raise exception 'group full'; end if;
  v_status := case when g.join_policy = 'open' then 'approved' else 'pending' end;
  insert into public.group_members(group_id, user_id, role, status, approved_at)
    values (g.id, auth.uid(), 'member', v_status,
            case when v_status='approved' then now() else null end)
    on conflict (group_id, user_id) do nothing
    returning * into m;
  if m.id is null then select * into m from public.group_members where group_id=g.id and user_id=auth.uid(); end if;
  return m;
end; $$;

-- 3. Owner-only settings update
create or replace function public.update_group_settings(
  p_group_id uuid, p_name text, p_description text, p_icon text,
  p_join_policy text, p_share_policy text, p_member_cap int)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if not private.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  if p_join_policy  is not null and p_join_policy  not in ('approval','open')  then raise exception 'bad join_policy'; end if;
  if p_share_policy is not null and p_share_policy not in ('members','owner') then raise exception 'bad share_policy'; end if;
  if p_member_cap is not null and p_member_cap <= 0 then raise exception 'bad member_cap'; end if;
  update public.study_groups set
    name        = coalesce(nullif(trim(p_name),''), name),
    description = case when p_description is null then description else nullif(trim(p_description),'') end,
    icon        = case when p_icon is null then icon else nullif(trim(p_icon),'') end,
    join_policy = coalesce(p_join_policy, join_policy),
    share_policy= coalesce(p_share_policy, share_policy),
    member_cap  = p_member_cap
  where id = p_group_id;
end; $$;

-- 4. list_my_groups returns the new fields (return type changed → drop first)
drop function if exists public.list_my_groups();
create function public.list_my_groups()
returns table(id uuid, name text, invite_code text, role text, status text, visible boolean,
              member_count bigint, pending_count bigint, is_owner boolean,
              description text, icon text, join_policy text, share_policy text, member_cap int)
language sql security definer set search_path to 'public'
as $$
  select g.id, g.name,
         case when g.owner_id = auth.uid() then g.invite_code else null end as invite_code,
         me.role, me.status, me.visible,
         (select count(*) from public.group_members x where x.group_id=g.id and x.status='approved') as member_count,
         (select count(*) from public.group_members x where x.group_id=g.id and x.status='pending') as pending_count,
         (g.owner_id = auth.uid()) as is_owner,
         g.description, g.icon, g.join_policy, g.share_policy, g.member_cap
  from public.group_members me
  join public.study_groups g on g.id = me.group_id
  where me.user_id = auth.uid()
  order by g.created_at desc;
$$;

-- 5. share_policy gate on group_shares insert
drop policy group_shares_insert on public.group_shares;
create policy group_shares_insert on public.group_shares for insert to authenticated
  with check (
    shared_by = auth.uid()
    and private.is_group_member(group_id, auth.uid())
    and (
      (select share_policy from public.study_groups where id = group_id) = 'members'
      or private.is_group_owner(group_id, auth.uid())
    )
  );

-- 6. grants (authenticated only; anon explicitly revoked)
grant execute on function public.list_my_groups() to authenticated;
revoke execute on function public.list_my_groups() from anon;
grant execute on function public.update_group_settings(uuid,text,text,text,text,text,int) to authenticated;
revoke execute on function public.update_group_settings(uuid,text,text,text,text,text,int) from anon;
revoke execute on function public.join_group(text) from anon;
