ALTER VIEW public.leaderboard SET (security_invoker = true);

ALTER FUNCTION public.bank_deposit(uuid, bigint) SET search_path = public;
ALTER FUNCTION public.bank_deposit(uuid, integer) SET search_path = public;
ALTER FUNCTION public.bank_withdraw(uuid, bigint) SET search_path = public;
ALTER FUNCTION public.bank_withdraw(uuid, integer) SET search_path = public;
ALTER FUNCTION public.calculate_user_rank() SET search_path = public;
ALTER FUNCTION public.cast_poll_vote(uuid, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.check_in_today(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.increment_points(uuid, integer) SET search_path = public;
ALTER FUNCTION public.increment_post_hits(bigint) SET search_path = public;
ALTER FUNCTION public.mark_memo_read(bigint, uuid) SET search_path = public;
ALTER FUNCTION public.set_memo_archive(bigint, uuid, boolean) SET search_path = public;
ALTER FUNCTION public.soft_delete_memo(bigint, uuid) SET search_path = public;
ALTER FUNCTION public.touch_chat_room_activity() SET search_path = public;
ALTER FUNCTION public.transfer_points(uuid, text, bigint) SET search_path = public;
ALTER FUNCTION public.transfer_points(uuid, text, integer) SET search_path = public;
