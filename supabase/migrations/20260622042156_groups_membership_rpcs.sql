create or replace function public.create_group(p_name text)
returns public.study_groups language plpgsql security definer set search_path = public as $$
declare g public.study_groups; n int;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'invalid name'; end if;
  select count(*) into n from public.group_members where user_id = auth.uid();
  if n >= 20 then raise exception 'group limit reached'; end if;
  insert into public.study_groups(owner_id, name, invite_code)
    values (auth.uid(), trim(p_name), public.gen_invite_code()) returning * into g;
  insert into public.group_members(group_id, user_id, role, status, approved_at)
    values (g.id, auth.uid(), 'owner', 'approved', now());
  return g;
end; $$;

create or replace function public.join_group(p_invite_code text)
returns public.group_members language plpgsql security definer set search_path = public as $$
declare g public.study_groups; m public.group_members; approved_n int; my_n int;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into g from public.study_groups where invite_code = upper(trim(p_invite_code));
  if g.id is null then raise exception 'invalid code'; end if;
  select count(*) into my_n from public.group_members where user_id = auth.uid();
  if my_n >= 20 then raise exception 'group limit reached'; end if;
  select count(*) into approved_n from public.group_members where group_id = g.id and status='approved';
  if approved_n >= 50 then raise exception 'group full'; end if;
  insert into public.group_members(group_id, user_id, role, status)
    values (g.id, auth.uid(), 'member', 'pending')
    on conflict (group_id, user_id) do nothing
    returning * into m;
  if m.id is null then select * into m from public.group_members where group_id=g.id and user_id=auth.uid(); end if;
  return m;
end; $$;

create or replace function public.approve_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  update public.group_members set status='approved', approved_at=now()
    where group_id=p_group_id and user_id=p_user_id and status='pending';
end; $$;

create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  if private.is_group_owner(p_group_id, p_user_id) then raise exception 'cannot remove owner'; end if;
  delete from public.group_members where group_id=p_group_id and user_id=p_user_id;
end; $$;

create or replace function public.rename_group(p_group_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'invalid name'; end if;
  update public.study_groups set name=trim(p_name) where id=p_group_id;
end; $$;

create or replace function public.delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  delete from public.study_groups where id=p_group_id;
end; $$;

create or replace function public.leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if private.is_group_owner(p_group_id, auth.uid()) then raise exception 'owner cannot leave; delete instead'; end if;
  delete from public.group_members where group_id=p_group_id and user_id=auth.uid();
end; $$;

create or replace function public.set_visibility(p_group_id uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.group_members set visible=p_visible where group_id=p_group_id and user_id=auth.uid();
end; $$;

create or replace function public.list_my_groups()
returns table(id uuid, name text, invite_code text, role text, status text, visible boolean,
              member_count bigint, pending_count bigint, is_owner boolean)
language sql security definer set search_path = public as $$
  select g.id, g.name,
         case when g.owner_id = auth.uid() then g.invite_code else null end as invite_code,
         me.role, me.status, me.visible,
         (select count(*) from public.group_members x where x.group_id=g.id and x.status='approved') as member_count,
         (select count(*) from public.group_members x where x.group_id=g.id and x.status='pending') as pending_count,
         (g.owner_id = auth.uid()) as is_owner
  from public.group_members me
  join public.study_groups g on g.id = me.group_id
  where me.user_id = auth.uid()
  order by g.created_at desc;
$$;

create or replace function public.list_pending_requests(p_group_id uuid)
returns table(user_id uuid, display_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  return query
    select m.user_id,
           coalesce(u.raw_user_meta_data->>'name', 'Student') as display_name,
           m.created_at
    from public.group_members m
    join auth.users u on u.id = m.user_id
    where m.group_id = p_group_id and m.status = 'pending'
    order by m.created_at asc;
end; $$;
