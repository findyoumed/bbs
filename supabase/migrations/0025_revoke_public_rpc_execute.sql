-- Security hardening: these legacy SECURITY DEFINER functions are not used by
-- the web application.  Remove the default PUBLIC/anon/authenticated EXECUTE
-- grants so PostgREST cannot expose balance, points, or hit-counter mutation
-- primitives.  The server's service_role grant is intentionally preserved.
REVOKE EXECUTE ON FUNCTION public.bank_deposit(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bank_deposit(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bank_withdraw(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bank_withdraw(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_points(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_post_hits(bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_points(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_points(uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- Pin the trigger function's lookup path to remove the mutable-search_path
-- advisor warning while preserving its existing trigger behavior.
ALTER FUNCTION public.set_post_local_id() SET search_path = pg_catalog, public;
