-- [LOG: 20260411_2125] 게시글 추천 테이블 정렬
-- 목적: 중복 추천을 방지하고 추천 이력을 관리하기 위한 테이블 구축

-- 1. post_recommendations 테이블 생성 (idempotent)
CREATE TABLE IF NOT EXISTS public.post_recommendations (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL, -- 회원 ID 또는 익명 식별자
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 중복 추천 방지 고유 제약 조건 (post_id + user_id)
DROP INDEX IF EXISTS public.idx_post_recommendations_unique;
CREATE UNIQUE INDEX idx_post_recommendations_unique ON public.post_recommendations(post_id, user_id);

-- 3. 사용자별 추천 이력 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_post_recommendations_user_id ON public.post_recommendations(user_id);
