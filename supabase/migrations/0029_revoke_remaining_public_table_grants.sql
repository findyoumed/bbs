-- Security hardening: all application repositories use the server-side
-- service_role client. Remove redundant Data API table grants from the
-- remaining RLS-protected tables while preserving service_role access.
REVOKE ALL ON TABLE
  public.attendance_logs,
  public.audit_log,
  public.chat_messages,
  public.comments,
  public.conf_agendas,
  public.conf_rooms,
  public.conf_seconds,
  public.faqs,
  public.game_scores,
  public.leaderboard,
  public.poll_options,
  public.poll_votes,
  public.polls,
  public.post_recommends,
  public.post_reports,
  public.profiles,
  public.scraps,
  public.vote_records,
  public.votes
FROM PUBLIC, anon, authenticated;
