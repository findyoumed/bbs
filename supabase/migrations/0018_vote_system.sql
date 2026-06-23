-- =============================================================================
-- [LOG: 20260622_2301] 투표(Vote/Polling) 시스템 스키마 정의 마이그레이션
-- 목적: 투표 생성 및 참여(중복 투표 방지)를 위한 테이블 구조 및 UNIQUE 인덱스 생성
-- =============================================================================

-- 1. votes 테이블 생성
CREATE TABLE IF NOT EXISTS public.votes (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  options       JSONB NOT NULL DEFAULT '[]', -- 선택지 목록: ["짜장", "짬뽕"]
  created_by    TEXT NOT NULL DEFAULT 'system',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active     BOOLEAN NOT NULL DEFAULT true
);

-- 2. vote_records 테이블 생성 (1인 1표 보장)
CREATE TABLE IF NOT EXISTS public.vote_records (
  id            BIGSERIAL PRIMARY KEY,
  vote_id       BIGINT NOT NULL REFERENCES public.votes(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  option_index  INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 1인 1표 보장용 복합 UNIQUE 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_vote_records_unique
  ON public.vote_records(vote_id, user_id);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vote_records_vote_id ON public.vote_records(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_records_user_id ON public.vote_records(user_id);
