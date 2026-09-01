-- The application accesses these tables through the server's service_role
-- repositories. RLS is already enabled with no public policies; remove the
-- redundant anon/authenticated table grants as defense in depth so a future
-- policy mistake cannot expose or mutate server-owned data through PostgREST.
REVOKE ALL ON TABLE public.attachments, public.boards, public.chat_room_members,
  public.chat_rooms, public.members, public.memos, public.post_recommendations,
  public.posts, public.rss_cache, public.user_activities
  FROM PUBLIC, anon, authenticated;
