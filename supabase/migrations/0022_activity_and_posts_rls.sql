-- [LOG_ID: 20260811_1000] 활동 기록 영구 저장 및 게시글 공개 접근 차단
-- 서버는 service_role 키로만 Supabase에 접근하므로, anon/authenticated에는
-- 정책을 만들지 않고 RLS 자체로 직접 Data API 접근을 차단한다.

CREATE TABLE IF NOT EXISTS public.user_activities (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'guest',
  nickname TEXT NOT NULL DEFAULT '',
  remote_addr TEXT NOT NULL DEFAULT 'local',
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 99),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  path TEXT NOT NULL DEFAULT '/',
  action TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, remote_addr)
);

CREATE INDEX IF NOT EXISTS idx_user_activities_last_seen
  ON public.user_activities(last_seen_at DESC);

ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- posts는 브라우저가 직접 조회하지 않고 Node 서버가 service_role로 중계한다.
-- 기존에 남아 있을 수 있는 공개 정책도 제거해 anon/authenticated 직접 접근을 막는다.
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'posts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.posts', policy_record.policyname);
  END LOOP;
END
$$;
