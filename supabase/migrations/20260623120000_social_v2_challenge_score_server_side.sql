-- Harden challenge scoring against a forged-score leaderboard exploit.
-- The previous submit_challenge_result trusted a client-supplied (score, total),
-- so any member could upsert a perfect score. Now the client sends only its
-- chosen answers and the score is recomputed server-side from the stored
-- group_challenges.payload correctIndex values. Total is the question count.
--
-- The attempt is also ONE-SHOT: the first submission is recorded and every
-- later submission is ignored, returning the stored result unchanged. Without
-- this a member could re-submit endlessly, flip one answer at a time, watch the
-- returned score move, and reconstruct the hidden answer key by probing.
drop function if exists public.submit_challenge_result(uuid, int, int);

create or replace function public.submit_challenge_result(p_challenge_id uuid, p_answers int[])
returns table(score int, total int)
language plpgsql security definer set search_path to 'public'
as $$
declare v_group uuid; v_payload jsonb; v_total int; v_score int;
begin
  select group_id, payload into v_group, v_payload
    from public.group_challenges where id = p_challenge_id;
  if v_group is null then raise exception 'challenge not found'; end if;
  if not private.is_group_member(v_group, auth.uid()) then raise exception 'not a member'; end if;

  v_total := coalesce(jsonb_array_length(v_payload->'questions'), 0);
  select count(*)::int into v_score
    from generate_series(0, v_total - 1) as i
    where p_answers[i + 1] is not null
      and p_answers[i + 1] = (v_payload->'questions'->i->>'correctIndex')::int;

  -- First attempt wins; re-submissions are no-ops (no probing feedback).
  insert into public.challenge_results(challenge_id, user_id, score, total)
    values (p_challenge_id, auth.uid(), v_score, v_total)
    on conflict (challenge_id, user_id) do nothing;

  -- Always return the stored result, so a re-submit reveals nothing new.
  select r.score, r.total into v_score, v_total
    from public.challenge_results r
    where r.challenge_id = p_challenge_id and r.user_id = auth.uid();
  return query select v_score, v_total;
end; $$;

revoke execute on function public.submit_challenge_result(uuid, int[]) from public;
revoke execute on function public.submit_challenge_result(uuid, int[]) from anon;
grant  execute on function public.submit_challenge_result(uuid, int[]) to authenticated;
