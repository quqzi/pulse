create table public.group_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  created_by uuid not null,
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.group_challenges enable row level security;
create index group_challenges_group_id_idx on public.group_challenges(group_id);

create policy group_challenges_select on public.group_challenges
  for select to authenticated
  using (private.is_group_member(group_id, auth.uid()));

create policy group_challenges_insert on public.group_challenges
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.is_group_member(group_id, auth.uid())
    and (
      private.is_group_owner(group_id, auth.uid())
      or exists (select 1 from public.study_groups g where g.id = group_id and g.share_policy = 'members')
    )
  );

create policy group_challenges_delete on public.group_challenges
  for delete to authenticated
  using (created_by = auth.uid() or private.is_group_owner(group_id, auth.uid()));

create table public.challenge_results (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.group_challenges(id) on delete cascade,
  user_id uuid not null,
  score int not null,
  total int not null,
  taken_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);
alter table public.challenge_results enable row level security;
create index challenge_results_challenge_id_idx on public.challenge_results(challenge_id);

create policy challenge_results_select on public.challenge_results
  for select to authenticated
  using (exists (
    select 1 from public.group_challenges c
    where c.id = challenge_id and private.is_group_member(c.group_id, auth.uid())
  ));

create policy challenge_results_insert on public.challenge_results
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_challenges c
      where c.id = challenge_id and private.is_group_member(c.group_id, auth.uid())
    )
  );

create policy challenge_results_update on public.challenge_results
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_challenges c
      where c.id = challenge_id and private.is_group_member(c.group_id, auth.uid())
    )
  )
  with check (user_id = auth.uid());

create or replace function public.post_challenge(p_group_id uuid, p_title text, p_payload jsonb)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid;
begin
  if not private.is_group_member(p_group_id, auth.uid()) then raise exception 'not a member'; end if;
  if not (private.is_group_owner(p_group_id, auth.uid())
          or exists (select 1 from public.study_groups g where g.id = p_group_id and g.share_policy = 'members')) then
    raise exception 'not allowed to share';
  end if;
  insert into public.group_challenges(group_id, created_by, title, payload)
    values (p_group_id, auth.uid(), p_title, p_payload)
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.submit_challenge_result(p_challenge_id uuid, p_score int, p_total int)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_group uuid;
begin
  select group_id into v_group from public.group_challenges where id = p_challenge_id;
  if v_group is null then raise exception 'challenge not found'; end if;
  if not private.is_group_member(v_group, auth.uid()) then raise exception 'not a member'; end if;
  insert into public.challenge_results(challenge_id, user_id, score, total)
    values (p_challenge_id, auth.uid(), p_score, p_total)
    on conflict (challenge_id, user_id)
    do update set score = excluded.score, total = excluded.total, taken_at = now();
end; $$;

create or replace function public.get_challenge_results(p_challenge_id uuid)
returns table(user_id uuid, name text, score int, total int, taken_at timestamptz)
language plpgsql security definer set search_path to 'public'
as $$
declare v_group uuid;
begin
  select group_id into v_group from public.group_challenges where id = p_challenge_id;
  if v_group is null then raise exception 'challenge not found'; end if;
  if not private.is_group_member(v_group, auth.uid()) then raise exception 'not a member'; end if;
  return query
    select r.user_id,
           coalesce(u.raw_user_meta_data->>'name', 'Student') as name,
           r.score, r.total, r.taken_at
    from public.challenge_results r
    join auth.users u on u.id = r.user_id
    where r.challenge_id = p_challenge_id
    order by r.score desc, r.taken_at asc;
end; $$;

revoke execute on function public.post_challenge(uuid, text, jsonb) from public;
revoke execute on function public.submit_challenge_result(uuid, int, int) from public;
revoke execute on function public.get_challenge_results(uuid) from public;
grant execute on function public.post_challenge(uuid, text, jsonb) to authenticated;
grant execute on function public.submit_challenge_result(uuid, int, int) to authenticated;
grant execute on function public.get_challenge_results(uuid) to authenticated;
