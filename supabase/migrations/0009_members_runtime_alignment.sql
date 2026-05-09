-- [LOG: 20260411_2100] 회원/인증 레이어 정렬 (auth.users 연동 및 성능 최적화)
-- 목적: public.members 테이블을 Supabase Auth와 연결하고 검색 성능을 위한 인덱스 보강

-- 1. auth_user_id 및 updated_at 컬럼 추가 (idempotent)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. 이메일 조건부 UNIQUE 인덱스 (NULL 허용하되 값이 있을 때만 중복 방지)
DROP INDEX IF EXISTS public.idx_members_email_unique;
CREATE UNIQUE INDEX idx_members_email_unique ON public.members(email) WHERE email IS NOT NULL;

-- 3. 성능 최적화를 위한 보조 인덱스
CREATE INDEX IF NOT EXISTS idx_members_auth_user_id ON public.members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_members_level        ON public.members(level);
CREATE INDEX IF NOT EXISTS idx_members_registration_datetime ON public.members(registration_datetime DESC);

-- 4. updated_at 자동 갱신 트리거 (있으면 보강)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.members;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. 기존 데이터 정합성 보정 (auth.users 테이블과 이메일 기준으로 auth_user_id 매칭 시도)
-- 이 작업은 운영 환경에 따라 선택적으로 실행되지만, 초기 정합성을 위해 포함
UPDATE public.members m
SET auth_user_id = u.id
FROM auth.users u
WHERE m.email = u.email
  AND m.auth_user_id IS NULL;
