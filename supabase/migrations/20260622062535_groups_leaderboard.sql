-- Streak helper: consecutive day-streak (Bangkok) ending today or yesterday.
-- Mirrors src/lib/stores/data.ts streak logic. Internal-only (private schema).
create or replace function private.user_streak(p_user_id uuid)
returns int language sql security definer stable set search_path = public as $$
  with days as (
    select distinct (started_at at time zone 'Asia/Bangkok')::date as d
    from public.study_sessions where user_id = p_user_id
  ),
  ranked as ( select d, (d - (row_number() over (order by d))::int) as grp from days ),
  islands as ( select max(d) as last_day, count(*)::int as len from ranked group by grp )
  select coalesce((
    select len from islands
    where last_day >= (now() at time zone 'Asia/Bangkok')::date - 1
    order by last_day desc limit 1
  ), 0);
$$;

create or replace function public.get_group_leaderboard(p_group_id uuid)
returns table(
  user_id uuid, display_name text,
  weekly_hours numeric, streak int, total_hours numeric,
  session_count int, mock_count int, best_mock_accuracy numeric,
  cards_count int, tasks_completed int
)
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_group_member(p_group_id, auth.uid()) then raise exception 'not a member'; end if;
  return query
  select m.user_id,
         coalesce(u.raw_user_meta_data->>'name','Student') as display_name,
         coalesce(agg.weekly_hours,0)::numeric as weekly_hours,
         coalesce(private.user_streak(m.user_id),0) as streak,
         coalesce(agg.total_hours,0)::numeric as total_hours,
         coalesce(agg.session_count,0) as session_count,
         coalesce(mk.mock_count,0) as mock_count,
         coalesce(mk.best_accuracy,0)::numeric as best_mock_accuracy,
         coalesce(cd.cards_count,0) as cards_count,
         coalesce(tk.tasks_completed,0) as tasks_completed
  from public.group_members m
  join auth.users u on u.id = m.user_id
  left join lateral (
    select sum(s.duration_sec)/3600.0 as total_hours,
           sum(s.duration_sec) filter (
             where (s.started_at at time zone 'Asia/Bangkok')::date
                   >= date_trunc('week', (now() at time zone 'Asia/Bangkok'))::date
           )/3600.0 as weekly_hours,
           count(*)::int as session_count
    from public.study_sessions s where s.user_id = m.user_id
  ) agg on true
  left join lateral (
    -- parity with AchievementWall.svelte: from exam_sessions, not mock_scores
    select count(*)::int as mock_count,
           max(100.0 * total_correct / nullif(total_questions,0)) as best_accuracy
    from public.exam_sessions es where es.user_id = m.user_id
  ) mk on true
  left join lateral (
    select count(*)::int as cards_count from public.flashcards f where f.user_id = m.user_id
  ) cd on true
  left join lateral (
    select count(*)::int as tasks_completed from public.tasks t
    where t.user_id = m.user_id and t.completed_at is not null
  ) tk on true
  where m.group_id = p_group_id and m.status='approved'
    and (m.visible = true or m.user_id = auth.uid())
  order by weekly_hours desc, streak desc;
end; $$;

-- Auth-only API; lock the internal helper.
revoke execute on function private.user_streak(uuid) from public, anon, authenticated;
revoke execute on function public.get_group_leaderboard(uuid) from public;
revoke execute on function public.get_group_leaderboard(uuid) from anon;
grant  execute on function public.get_group_leaderboard(uuid) to authenticated;
