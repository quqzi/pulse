-- Internal helper: not for direct/REST use at all.
revoke execute on function public.gen_invite_code() from public;
revoke execute on function public.gen_invite_code() from anon;
revoke execute on function public.gen_invite_code() from authenticated;

-- Membership RPCs: authenticated-only (clears the anon execute lints).
revoke execute on function public.create_group(text) from public;
grant  execute on function public.create_group(text) to authenticated;

revoke execute on function public.join_group(text) from public;
grant  execute on function public.join_group(text) to authenticated;

revoke execute on function public.approve_member(uuid, uuid) from public;
grant  execute on function public.approve_member(uuid, uuid) to authenticated;

revoke execute on function public.remove_member(uuid, uuid) from public;
grant  execute on function public.remove_member(uuid, uuid) to authenticated;

revoke execute on function public.rename_group(uuid, text) from public;
grant  execute on function public.rename_group(uuid, text) to authenticated;

revoke execute on function public.delete_group(uuid) from public;
grant  execute on function public.delete_group(uuid) to authenticated;

revoke execute on function public.leave_group(uuid) from public;
grant  execute on function public.leave_group(uuid) to authenticated;

revoke execute on function public.set_visibility(uuid, boolean) from public;
grant  execute on function public.set_visibility(uuid, boolean) to authenticated;

revoke execute on function public.list_my_groups() from public;
grant  execute on function public.list_my_groups() to authenticated;

revoke execute on function public.list_pending_requests(uuid) from public;
grant  execute on function public.list_pending_requests(uuid) to authenticated;
