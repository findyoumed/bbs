-- The web application uses repository/service endpoints for these operations;
-- it does not call the legacy public RPCs directly. Keep the Auth trigger's
-- behavior intact while removing their PostgREST attack surface. The explicit
-- service_role grant is preserved for controlled server-side maintenance.
REVOKE EXECUTE ON FUNCTION public.cast_poll_vote(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_in_today(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_memo_read(bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_memo_archive(bigint, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_memo(bigint, uuid) FROM PUBLIC, anon, authenticated;
