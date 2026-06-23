revoke execute on function public.post_challenge(uuid, text, jsonb) from anon;
revoke execute on function public.submit_challenge_result(uuid, int, int) from anon;
revoke execute on function public.get_challenge_results(uuid) from anon;
