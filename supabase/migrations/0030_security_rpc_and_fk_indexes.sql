-- Security and performance hardening discovered by Supabase advisors.
-- Application repositories use the server-side service_role client; these
-- trigger functions do not need to be callable through the public Data API.
REVOKE EXECUTE ON FUNCTION public.calculate_user_rank() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_post_local_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_chat_room_activity() FROM PUBLIC, anon, authenticated;

-- Pin trigger lookup paths so future search_path changes cannot alter their
-- behavior. Trigger execution remains unchanged.
ALTER FUNCTION public.calculate_user_rank() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_post_local_id() SET search_path = pg_catalog, public;
ALTER FUNCTION public.touch_chat_room_activity() SET search_path = pg_catalog, public;

-- Cover foreign-key columns reported by the performance advisor. Existing
-- indexes are left untouched and all statements are idempotent.
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_memos_reply_to_id ON public.memos (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_polls_post_id ON public.polls (post_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON public.poll_votes (option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON public.poll_votes (user_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON public.game_scores (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_creator_id ON public.chat_rooms (creator_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments (author_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_scraps_post_id ON public.scraps (post_id);
CREATE INDEX IF NOT EXISTS idx_post_recommends_user_id ON public.post_recommends (user_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_reporter_id ON public.post_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_reviewed_by ON public.post_reports (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON public.chat_room_members (user_id);
