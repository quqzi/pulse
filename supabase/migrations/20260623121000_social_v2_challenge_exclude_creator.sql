-- Exclude a challenge's creator from its own leaderboard.
-- The creator authored the payload (they hold the answer key), so ranking their
-- own attempt against takers is unfair and meaningless. get_challenge_results now
-- filters out the creator's row via group_challenges.created_by. Everyone else is
-- unchanged. (The creator can still open the challenge; they just don't appear in
-- the standings.)
create or replace function public.get_challenge_results(p_challenge_id uuid)
returns table(user_id uuid, name text, score int, total int, taken_at timestamptz)
language plpgsql security definer set search_path to 'public'
as $$
declare v_group uuid; v_creator uuid;
begin
  select group_id, created_by into v_group, v_creator
    from public.group_challenges where id = p_challenge_id;
  if v_group is null then raise exception 'challenge not found'; end if;
  if not private.is_group_member(v_group, auth.uid()) then raise exception 'not a member'; end if;
  return query
    select r.user_id,
           coalesce(u.raw_user_meta_data->>'name', 'Student') as name,
           r.score, r.total, r.taken_at
    from public.challenge_results r
    join auth.users u on u.id = r.user_id
    where r.challenge_id = p_challenge_id
      and r.user_id <> v_creator
    order by r.score desc, r.taken_at asc;
end; $$;

revoke execute on function public.get_challenge_results(uuid) from public;
revoke execute on function public.get_challenge_results(uuid) from anon;
grant  execute on function public.get_challenge_results(uuid) to authenticated;
