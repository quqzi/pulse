-- Defense-in-depth for challenges: the answer key must never reach the client,
-- and challenge_results may only be written through the recomputing RPC.

-- 1. Block direct writes to challenge_results. The sole writer is the
--    SECURITY DEFINER submit_challenge_result RPC (which recomputes the score
--    server-side). These client-facing policies would otherwise let a member
--    insert/update an arbitrary score straight into the table, bypassing it.
drop policy challenge_results_insert on public.challenge_results;
drop policy challenge_results_update on public.challenge_results;

-- 2. Stop shipping the answer key. A stored generated question_count lets the
--    list render without reading payload; the column-level grant then hides
--    payload (which holds correctIndex) from every client read. Row-level
--    visibility (group_challenges_select) is unchanged.
alter table public.group_challenges
  add column question_count int not null
    generated always as (coalesce(jsonb_array_length(payload->'questions'), 0)) stored;

revoke select on public.group_challenges from authenticated;
grant  select (id, group_id, created_by, title, question_count, created_at)
  on public.group_challenges to authenticated;

-- 3. Serve questions to takers with correctIndex stripped, member-gated.
create or replace function public.get_challenge_questions(p_challenge_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_group uuid; v_payload jsonb; v_questions jsonb;
begin
  select group_id, payload into v_group, v_payload
    from public.group_challenges where id = p_challenge_id;
  if v_group is null then raise exception 'challenge not found'; end if;
  if not private.is_group_member(v_group, auth.uid()) then raise exception 'not a member'; end if;
  select jsonb_agg(q - 'correctIndex') into v_questions
    from jsonb_array_elements(v_payload->'questions') as q;
  return jsonb_build_object('title', v_payload->>'title', 'questions', coalesce(v_questions, '[]'::jsonb));
end; $$;

revoke execute on function public.get_challenge_questions(uuid) from public;
revoke execute on function public.get_challenge_questions(uuid) from anon;
grant  execute on function public.get_challenge_questions(uuid) to authenticated;
