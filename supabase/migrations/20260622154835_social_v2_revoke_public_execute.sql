-- Lock the new/recreated RPCs to authenticated only (CREATE grants EXECUTE to PUBLIC by default)
revoke execute on function public.list_my_groups() from public;
revoke execute on function public.update_group_settings(uuid,text,text,text,text,text,int) from public;
-- keep authenticated grants explicit
grant execute on function public.list_my_groups() to authenticated;
grant execute on function public.update_group_settings(uuid,text,text,text,text,text,int) to authenticated;
