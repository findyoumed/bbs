-- [LOG: 20260411_2120] 게시글 스키마 보강 (계층형 답글 및 호환성)
-- 목적: posts 테이블에 답글 정렬 컬럼을 추가하고 기존 데이터와의 호환성 확보

-- 1. posts 테이블 생성 또는 컬럼 보강
CREATE TABLE IF NOT EXISTS public.posts (
  id              BIGSERIAL PRIMARY KEY,
  board_id        TEXT NOT NULL REFERENCES public.boards(board_id) ON DELETE CASCADE,
  author_id       UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_nickname TEXT NOT NULL DEFAULT '',
  user_id         TEXT NOT NULL DEFAULT 'guest',
  nick_name       TEXT NOT NULL DEFAULT '',
  family_id       BIGINT NOT NULL DEFAULT 0,
  sort_order      BIGINT NOT NULL DEFAULT 0,
  depth           INT NOT NULL DEFAULT 0,
  title           TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',
  hits            INT NOT NULL DEFAULT 0,
  recommend       INT NOT NULL DEFAULT 0,
  is_notice       BOOLEAN NOT NULL DEFAULT false,
  is_hidden       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 누락 컬럼 개별 추가 (idempotent)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS family_id  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depth      INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommend  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_id    TEXT NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS nick_name  TEXT NOT NULL DEFAULT '';

-- 3. 계층형 정렬 및 검색 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_board_thread ON public.posts(board_id, family_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_posts_board_recent ON public.posts(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id    ON public.posts(author_id);

-- 4. 기존 데이터 백필 (Backfill)
-- family_id가 0인 경우 id와 동일하게 설정 (최상위 글로 취급)
UPDATE public.posts
SET family_id = id
WHERE family_id = 0;

-- author_nickname 정보를 nick_name으로 복사 (호환성)
UPDATE public.posts
SET nick_name = author_nickname
WHERE nick_name = '' AND author_nickname <> '';
